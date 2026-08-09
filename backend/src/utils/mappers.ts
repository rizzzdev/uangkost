import type { User, Transaction, Installment } from "@prisma/client";
import type {
  TenantResponse,
  TransactionResponse,
  InstallmentResponse,
  InstallmentWithTransactionResponse,
} from "../types/index.js";

export function toDateKey(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

export function toTenantResponse(user: User): TenantResponse {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    phone: user.phone,
    roomNumber: user.roomNumber,
    isActive: user.isActive,
    accessTokenExpiresAt: user.accessTokenExpiresAt?.toISOString() ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function toInstallmentResponse(i: Installment): InstallmentResponse {
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

export type TransactionWithRelations = Transaction & {
  user?: { name: string; roomNumber: string | null } | null;
  installments?: Installment[];
};

export function toTransactionResponse(tx: TransactionWithRelations): TransactionResponse {
  return {
    id: tx.id,
    userId: tx.userId,
    type: tx.type,
    amount: tx.amount.toString(),
    totalPaid: tx.totalPaid.toString(),
    billingMonth: tx.billingMonth,
    status: tx.status,
    category: tx.category,
    description: tx.description,
    transactionDate: toDateKey(tx.transactionDate),
    paymentProofUrl: tx.paymentProofUrl,
    isVerified: tx.isVerified,
    waNotifiedAt: tx.waNotifiedAt?.toISOString() ?? null,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
    user: tx.user
      ? { name: tx.user.name, roomNumber: tx.user.roomNumber }
      : null,
    installments: tx.installments?.map(toInstallmentResponse),
  };
}

export type InstallmentWithTxRelation = Installment & {
  transaction: Transaction & {
    user?: { name: string; roomNumber: string | null } | null;
  };
};

export function toInstallmentWithTransactionResponse(
  inst: InstallmentWithTxRelation,
): InstallmentWithTransactionResponse {
  return {
    ...toInstallmentResponse(inst),
    transaction: {
      id: inst.transaction.id,
      amount: inst.transaction.amount.toString(),
      status: inst.transaction.status,
      billingMonth: inst.transaction.billingMonth,
      description: inst.transaction.description,
      user: inst.transaction.user
        ? { name: inst.transaction.user.name, roomNumber: inst.transaction.user.roomNumber }
        : null,
    },
  };
}
