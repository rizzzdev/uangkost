import { prisma, NOT_DELETED } from "../../config/prisma.js";
import { AppError } from "../../middlewares/error-handler.js";
import { invalidateFinanceCache } from "./finance.service.js";
import type {
  CreateInstallmentInput,
  UpdateInstallmentInput,
  InstallmentResponse,
  InstallmentWithTransactionResponse,
} from "../../types/index.js";

function computeStatus(amount: number, totalPaid: number): "unpaid" | "partial" | "paid" {
  if (totalPaid >= amount) return "paid";
  if (totalPaid > 0) return "partial";
  return "unpaid";
}

function toResponse(i: {
  id: string;
  transactionId: string;
  amount: { toString(): string };
  paymentProofUrl: string | null;
  isVerified: boolean;
  verifiedAt: Date | null;
  rejectedAt: Date | null;
  description: string | null;
  createdAt: Date;
}): InstallmentResponse {
  return {
    id: i.id,
    transactionId: i.transactionId,
    amount: i.amount.toString(),
    paymentProofUrl: i.paymentProofUrl,
    isVerified: i.isVerified,
    verifiedAt: i.verifiedAt?.toISOString() ?? null,
    rejectedAt: i.rejectedAt?.toISOString() ?? null,
    description: i.description,
    createdAt: i.createdAt,
  };
}

/**
 * Tenant uploads a cicilan payment for a transaction.
 * Validates: no overpay, transaction exists and is unpaid/partial.
 * totalPaid hanya bertambah setelah diverifikasi admin, KECUALI autoVerify=true
 * (admin menginput langsung → langsung terverifikasi & masuk totalPaid).
 */
export async function createInstallment(
  transactionId: string,
  input: CreateInstallmentInput,
  proofFilePath?: string,
  autoVerify = false,
): Promise<InstallmentResponse> {
  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, ...NOT_DELETED },
  });

  if (!tx) {
    throw new AppError("Transaction not found", 404);
  }

  if (tx.type !== "income") {
    throw new AppError("Cicilan hanya untuk tagihan (income)", 400);
  }

  if (tx.status === "paid") {
    throw new AppError("Tagihan sudah lunas", 400);
  }

  // Hitung cicilan yang masih pending (belum diverifikasi & belum ditolak)
  const pendingAgg = await prisma.installment.aggregate({
    _sum: { amount: true },
    where: {
      transactionId,
      isVerified: false,
      rejectedAt: null,
      ...NOT_DELETED,
    },
  });

  const remaining =
    Number(tx.amount) -
    Number(tx.totalPaid) -
    Number(pendingAgg._sum.amount ?? 0);

  if (input.amount <= 0) {
    throw new AppError("Jumlah cicilan harus lebih dari 0", 400);
  }

  if (input.amount > remaining) {
    throw new AppError(
      `Tidak boleh overpay. Sisa tagihan: Rp${remaining.toLocaleString("id-ID")}`,
      400,
    );
  }

  const installment = await prisma.installment.create({
    data: {
      transactionId,
      amount: input.amount,
      description: input.description ?? null,
      paymentProofUrl: proofFilePath ?? null,
      ...(autoVerify ? { isVerified: true, verifiedAt: new Date() } : {}),
    },
  });

  // Admin menginput langsung: cicilan langsung terverifikasi → tambah ke totalPaid & status
  if (autoVerify) {
    const newTotalPaid = Number(tx.totalPaid) + Number(installment.amount);
    const newStatus = computeStatus(Number(tx.amount), newTotalPaid);
    await prisma.transaction.update({
      where: { id: tx.id },
      data: { totalPaid: newTotalPaid, status: newStatus },
    });
  }

  await invalidateFinanceCache(); // SEBELUM respons — refetch client selalu dapat data segar
  return toResponse(installment);
}

/**
 * Admin creates a cicilan directly (manual record) for a transaction.
 * autoVerify=true → cicilan langsung terverifikasi (dipakai halaman portal admin).
 */
export async function createInstallmentByAdmin(
  transactionId: string,
  input: CreateInstallmentInput,
  proofFilePath?: string,
  autoVerify = false,
): Promise<InstallmentResponse> {
  return createInstallment(transactionId, input, proofFilePath, autoVerify);
}

/**
 * Admin edits a cicilan (amount / note) — keeps totalPaid consistent.
 */
export async function updateInstallment(
  id: string,
  input: UpdateInstallmentInput,
): Promise<InstallmentResponse> {
  const installment = await prisma.installment.findFirst({
    where: { id, ...NOT_DELETED },
  });
  if (!installment) throw new AppError("Installment not found", 404);

  const tx = await prisma.transaction.findFirst({
    where: { id: installment.transactionId, ...NOT_DELETED },
  });
  if (!tx) throw new AppError("Transaction not found", 404);

  const newAmount = input.amount !== undefined ? input.amount : Number(installment.amount);

  if (input.amount !== undefined && input.amount <= 0) {
    throw new AppError("Jumlah cicilan harus lebih dari 0", 400);
  }

  // Validasi overpay terhadap total pemasukan + cicilan terverifikasi lainnya
  const othersVerified = await prisma.installment.aggregate({
    _sum: { amount: true },
    where: {
      transactionId: tx.id,
      isVerified: true,
      ...NOT_DELETED,
      id: { not: id },
    },
  });

  const verifiedTotal = Number(othersVerified._sum.amount ?? 0);
  const remaining = Number(tx.amount) - verifiedTotal;

  if (newAmount > remaining) {
    throw new AppError(
      `Tidak boleh overpay. Sisa tagihan: Rp${remaining.toLocaleString("id-ID")}`,
      400,
    );
  }

  const updated = await prisma.installment.update({
    where: { id },
    data: {
      ...(input.amount !== undefined && { amount: newAmount }),
      ...(input.description !== undefined && { description: input.description }),
    },
  });

  // Hitung ulang totalPaid (jumlah cicilan terverifikasi)
  const verifiedAgg = await prisma.installment.aggregate({
    _sum: { amount: true },
    where: { transactionId: tx.id, isVerified: true, ...NOT_DELETED },
  });
  const totalPaid = Number(verifiedAgg._sum.amount ?? 0);
  const newStatus = computeStatus(Number(tx.amount), totalPaid);

  await prisma.transaction.update({
    where: { id: tx.id },
    data: { totalPaid, status: newStatus },
  });

  await invalidateFinanceCache(); // SEBELUM respons — refetch client selalu dapat data segar
  return toResponse(updated);
}

/**
 * Admin verifies a cicilan — marks it as verified and adds to totalPaid.
 */
export async function verifyInstallment(id: string): Promise<InstallmentResponse> {
  const installment = await prisma.installment.findFirst({
    where: { id, ...NOT_DELETED },
  });

  if (!installment) {
    throw new AppError("Installment not found", 404);
  }

  if (installment.isVerified) {
    throw new AppError("Cicilan sudah diverifikasi", 400);
  }

  if (installment.rejectedAt) {
    throw new AppError("Cicilan sudah ditolak", 400);
  }

  const tx = await prisma.transaction.findFirst({
    where: { id: installment.transactionId, ...NOT_DELETED },
  });

  if (!tx) {
    throw new AppError("Transaction not found", 404);
  }

  // Validate no overpay
  const newTotal = Number(tx.totalPaid) + Number(installment.amount);
  if (newTotal > Number(tx.amount)) {
    throw new AppError(
      `Verifikasi akan melebihi total tagihan (overpay). Sisa: Rp${(Number(tx.amount) - Number(tx.totalPaid)).toLocaleString("id-ID")}`,
      400,
    );
  }

  const updated = await prisma.installment.update({
    where: { id },
    data: { isVerified: true, verifiedAt: new Date() },
  });

  const newTotalPaid = Number(tx.totalPaid) + Number(updated.amount);
  const newStatus = computeStatus(Number(tx.amount), newTotalPaid);

  await prisma.transaction.update({
    where: { id: installment.transactionId },
    data: { totalPaid: newTotalPaid, status: newStatus },
  });

  await invalidateFinanceCache(); // SEBELUM respons — refetch client selalu dapat data segar
  return toResponse(updated);
}

/**
 * Admin rejects a cicilan — marks it rejected (tidak menambah totalPaid).
 */
export async function rejectInstallment(id: string): Promise<InstallmentResponse> {
  const installment = await prisma.installment.findFirst({
    where: { id, ...NOT_DELETED },
  });

  if (!installment) {
    throw new AppError("Installment not found", 404);
  }

  if (installment.isVerified) {
    throw new AppError("Cicilan sudah diverifikasi, tidak bisa ditolak", 400);
  }

  if (installment.rejectedAt) {
    throw new AppError("Cicilan sudah ditolak", 400);
  }

  const updated = await prisma.installment.update({
    where: { id },
    data: { rejectedAt: new Date() },
  });

  return toResponse(updated);
}

/**
 * Get all installments (admin) — with transaction + tenant info.
 */
export async function getAllInstallments(): Promise<InstallmentWithTransactionResponse[]> {
  const installments = await prisma.installment.findMany({
    where: { ...NOT_DELETED },
    include: {
      transaction: {
        include: {
          user: { select: { name: true, roomNumber: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return installments.map((i) => ({
    ...toResponse(i),
    transaction: {
      id: i.transaction.id,
      amount: i.transaction.amount.toString(),
      status: i.transaction.status,
      billingMonth: i.transaction.billingMonth,
      description: i.transaction.description,
      user: i.transaction.user
        ? { name: i.transaction.user.name, roomNumber: i.transaction.user.roomNumber }
        : null,
    },
  }));
}

/**
 * Get all installments for a transaction.
 */
export async function getInstallments(transactionId: string): Promise<InstallmentResponse[]> {
  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, ...NOT_DELETED },
  });
  if (!tx) throw new AppError("Transaction not found", 404);

  const installments = await prisma.installment.findMany({
    where: { transactionId, ...NOT_DELETED },
    orderBy: { createdAt: "asc" },
  });

  return installments.map(toResponse);
}

/**
 * Admin deletes an installment (soft delete) — reverts totalPaid if it was verified.
 */
export async function deleteInstallment(id: string): Promise<void> {
  const installment = await prisma.installment.findFirst({
    where: { id, ...NOT_DELETED },
  });
  if (!installment) throw new AppError("Installment not found", 404);

  const tx = await prisma.transaction.findFirst({
    where: { id: installment.transactionId, ...NOT_DELETED },
  });
  if (!tx) throw new AppError("Transaction not found", 404);

  if (installment.isVerified) {
    const newTotalPaid = Math.max(0, Number(tx.totalPaid) - Number(installment.amount));
    const newStatus = computeStatus(Number(tx.amount), newTotalPaid);
    await prisma.transaction.update({
      where: { id: installment.transactionId },
      data: { totalPaid: newTotalPaid, status: newStatus },
    });
  }

  // Soft delete
  await prisma.installment.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await invalidateFinanceCache(); // SEBELUM respons — refetch client selalu dapat data segar
}
