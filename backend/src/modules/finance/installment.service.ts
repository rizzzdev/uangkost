import { Prisma } from "@prisma/client";
import { prisma, NOT_DELETED } from "../../config/prisma.js";
import { AppError } from "../../middlewares/error-handler.js";
import { invalidateFinanceCache } from "./finance.service.js";
import { toInstallmentResponse, toInstallmentWithTransactionResponse } from "../../utils/mappers.js";
import type {
  CreateInstallmentInput,
  UpdateInstallmentInput,
  InstallmentResponse,
  InstallmentWithTransactionResponse,
} from "../../types/index.js";

function computeStatus(amount: Prisma.Decimal, totalPaid: Prisma.Decimal): "unpaid" | "partial" | "paid" {
  if (totalPaid.gte(amount)) return "paid";
  if (totalPaid.gt(0)) return "partial";
  return "unpaid";
}

/**
 * Tenant uploads a cicilan payment for a transaction.
 * Wrapped in prisma.$transaction for database concurrency safety & data integrity.
 */
export async function createInstallment(
  transactionId: string,
  input: CreateInstallmentInput,
  proofFilePath?: string,
  autoVerify = false,
): Promise<InstallmentResponse> {
  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findFirst({
      where: { id: transactionId, ...NOT_DELETED },
    });

    if (!transaction) {
      throw new AppError("Transaction not found", 404);
    }

    if (transaction.type !== "income") {
      throw new AppError("Cicilan hanya untuk tagihan (income)", 400);
    }

    if (transaction.status === "paid") {
      throw new AppError("Tagihan sudah lunas", 400);
    }

    const inputAmount = new Prisma.Decimal(input.amount);
    if (inputAmount.lte(0)) {
      throw new AppError("Jumlah cicilan harus lebih dari 0", 400);
    }

    // Hitung cicilan pending
    const pendingAgg = await tx.installment.aggregate({
      _sum: { amount: true },
      where: {
        transactionId,
        isVerified: false,
        rejectedAt: null,
        ...NOT_DELETED,
      },
    });

    const pendingSum = pendingAgg._sum.amount ?? new Prisma.Decimal(0);
    const remaining = transaction.amount.minus(transaction.totalPaid).minus(pendingSum);

    if (inputAmount.gt(remaining)) {
      throw new AppError(
        `Tidak boleh overpay. Sisa tagihan: Rp${remaining.toNumber().toLocaleString("id-ID")}`,
        400,
      );
    }

    const installment = await tx.installment.create({
      data: {
        transactionId,
        amount: inputAmount,
        description: input.description ?? null,
        paymentProofUrl: proofFilePath ?? null,
        ...(autoVerify ? { isVerified: true, verifiedAt: new Date() } : {}),
      },
    });

    if (autoVerify) {
      const newTotalPaid = transaction.totalPaid.plus(installment.amount);
      const newStatus = computeStatus(transaction.amount, newTotalPaid);
      await tx.transaction.update({
        where: { id: transaction.id },
        data: { totalPaid: newTotalPaid, status: newStatus },
      });
    }

    return installment;
  });

  await invalidateFinanceCache();
  return toInstallmentResponse(result);
}

export async function createInstallmentByAdmin(
  transactionId: string,
  input: CreateInstallmentInput,
  proofFilePath?: string,
  autoVerify = false,
): Promise<InstallmentResponse> {
  return createInstallment(transactionId, input, proofFilePath, autoVerify);
}

export async function updateInstallment(
  id: string,
  input: UpdateInstallmentInput,
): Promise<InstallmentResponse> {
  const result = await prisma.$transaction(async (tx) => {
    const installment = await tx.installment.findFirst({
      where: { id, ...NOT_DELETED },
    });
    if (!installment) throw new AppError("Installment not found", 404);

    const transaction = await tx.transaction.findFirst({
      where: { id: installment.transactionId, ...NOT_DELETED },
    });
    if (!transaction) throw new AppError("Transaction not found", 404);

    const newAmount = input.amount !== undefined ? new Prisma.Decimal(input.amount) : installment.amount;
    if (newAmount.lte(0)) {
      throw new AppError("Jumlah cicilan harus lebih dari 0", 400);
    }

    const othersVerified = await tx.installment.aggregate({
      _sum: { amount: true },
      where: {
        transactionId: transaction.id,
        isVerified: true,
        ...NOT_DELETED,
        id: { not: id },
      },
    });

    const verifiedTotal = othersVerified._sum.amount ?? new Prisma.Decimal(0);
    const remaining = transaction.amount.minus(verifiedTotal);

    if (newAmount.gt(remaining)) {
      throw new AppError(
        `Tidak boleh overpay. Sisa tagihan: Rp${remaining.toNumber().toLocaleString("id-ID")}`,
        400,
      );
    }

    const updated = await tx.installment.update({
      where: { id },
      data: {
        amount: newAmount,
        ...(input.description !== undefined && { description: input.description }),
      },
    });

    const verifiedAgg = await tx.installment.aggregate({
      _sum: { amount: true },
      where: { transactionId: transaction.id, isVerified: true, ...NOT_DELETED },
    });

    const totalPaid = verifiedAgg._sum.amount ?? new Prisma.Decimal(0);
    const newStatus = computeStatus(transaction.amount, totalPaid);

    await tx.transaction.update({
      where: { id: transaction.id },
      data: { totalPaid, status: newStatus },
    });

    return updated;
  });

  await invalidateFinanceCache();
  return toInstallmentResponse(result);
}

export async function verifyInstallment(id: string): Promise<InstallmentResponse> {
  const result = await prisma.$transaction(async (tx) => {
    const installment = await tx.installment.findFirst({
      where: { id, ...NOT_DELETED },
    });

    if (!installment) throw new AppError("Installment not found", 404);
    if (installment.isVerified) throw new AppError("Cicilan sudah diverifikasi", 400);
    if (installment.rejectedAt) throw new AppError("Cicilan sudah ditolak", 400);

    const transaction = await tx.transaction.findFirst({
      where: { id: installment.transactionId, ...NOT_DELETED },
    });

    if (!transaction) throw new AppError("Transaction not found", 404);

    const newTotalPaid = transaction.totalPaid.plus(installment.amount);
    if (newTotalPaid.gt(transaction.amount)) {
      throw new AppError(
        `Verifikasi akan melebihi total tagihan (overpay). Sisa: Rp${transaction.amount.minus(transaction.totalPaid).toNumber().toLocaleString("id-ID")}`,
        400,
      );
    }

    const updated = await tx.installment.update({
      where: { id },
      data: { isVerified: true, verifiedAt: new Date() },
    });

    const newStatus = computeStatus(transaction.amount, newTotalPaid);
    await tx.transaction.update({
      where: { id: installment.transactionId },
      data: { totalPaid: newTotalPaid, status: newStatus },
    });

    return updated;
  });

  await invalidateFinanceCache();
  return toInstallmentResponse(result);
}

export async function rejectInstallment(id: string): Promise<InstallmentResponse> {
  const installment = await prisma.installment.findFirst({
    where: { id, ...NOT_DELETED },
  });

  if (!installment) throw new AppError("Installment not found", 404);
  if (installment.isVerified) throw new AppError("Cicilan sudah diverifikasi, tidak bisa ditolak", 400);
  if (installment.rejectedAt) throw new AppError("Cicilan sudah ditolak", 400);

  const updated = await prisma.installment.update({
    where: { id },
    data: { rejectedAt: new Date() },
  });

  return toInstallmentResponse(updated);
}

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

  return installments.map(toInstallmentWithTransactionResponse);
}

export async function getInstallments(transactionId: string): Promise<InstallmentResponse[]> {
  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, ...NOT_DELETED },
  });
  if (!tx) throw new AppError("Transaction not found", 404);

  const installments = await prisma.installment.findMany({
    where: { transactionId, ...NOT_DELETED },
    orderBy: { createdAt: "asc" },
  });

  return installments.map(toInstallmentResponse);
}

export async function deleteInstallment(id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const installment = await tx.installment.findFirst({
      where: { id, ...NOT_DELETED },
    });
    if (!installment) throw new AppError("Installment not found", 404);

    const transaction = await tx.transaction.findFirst({
      where: { id: installment.transactionId, ...NOT_DELETED },
    });
    if (!transaction) throw new AppError("Transaction not found", 404);

    if (installment.isVerified) {
      const newTotalPaid = Prisma.Decimal.max(new Prisma.Decimal(0), transaction.totalPaid.minus(installment.amount));
      const newStatus = computeStatus(transaction.amount, newTotalPaid);
      await tx.transaction.update({
        where: { id: installment.transactionId },
        data: { totalPaid: newTotalPaid, status: newStatus },
      });
    }

    await tx.installment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  });

  await invalidateFinanceCache();
}
