import { z } from "zod";
import { AppError } from "../middlewares/error-handler.js";

/**
 * Parse & validate request body dengan Zod schema.
 * Throw AppError(400) jika tidak valid.
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new AppError(`Validation error: ${messages}`, 400);
  }
  return result.data;
}

// --- Auth schemas ---

export const loginSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerAdminSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

// --- Tenant schemas ---

export const createTenantSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phone: z.string().min(6, "Phone too short").max(20),
  roomNumber: z.string().max(10).optional(),
});

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().min(6).max(20).optional(),
  roomNumber: z.string().max(10).nullable().optional(),
  isActive: z.boolean().optional(),
});

// --- Finance schemas ---

export const createTransactionSchema = z.object({
  userId: z.string().optional(),
  type: z.enum(["income", "expense"]),
  amount: z.number().positive("Amount must be positive"),
  category: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  billingMonth: z.string().max(20).optional(),
  transactionDate: z.string().optional(),
});

export const updateTransactionSchema = z.object({
  type: z.enum(["income", "expense"]).optional(),
  amount: z.number().positive().optional(),
  category: z.string().max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  billingMonth: z.string().max(20).nullable().optional(),
  status: z.enum(["paid", "unpaid", "partial"]).optional(),
  isVerified: z.boolean().optional(),
  paymentProofUrl: z.string().nullable().optional(),
  transactionDate: z.string().optional(),
});

// --- Installment schema ---

export const createInstallmentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  description: z.string().max(500).optional(),
});

export const createInstallmentByAdminSchema = z.object({
  transactionId: z.string().min(1, "Transaction is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  description: z.string().max(500).optional(),
});

export const updateInstallmentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive").optional(),
  description: z.string().max(500).nullable().optional(),
});

// --- Settings schema ---

const HHMM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const updateSettingsSchema = z.object({
  kostName: z.string().max(100).optional(),
  bankAccountInfo: z.string().optional(),
  qrisImageUrl: z.string().optional(),
  botWaStatus: z.boolean().optional(),
  defaultBillAmount: z.coerce.number().positive().nullable().optional(),
  reminderTime: z.string().regex(HHMM_PATTERN, "Format HH:MM").nullable().optional(),
  reminderFrequency: z.enum(["daily", "weekly", "monthly"]).nullable().optional(),
  reminderWeekdays: z.string().regex(/^\d(,\d)*$/, "Format '0,2,4' (0=Minggu..6=Sabtu)").nullable().optional(),
  reminderDates: z.string().regex(/^\d(,\d)*$/, "Format '1,15'").nullable().optional(),
  billCreationTime: z.string().regex(HHMM_PATTERN, "Format HH:MM").nullable().optional(),
  billCreationFrequency: z.enum(["daily", "weekly", "monthly"]).nullable().optional(),
  billCreationWeekdays: z.string().regex(/^\d(,\d)*$/, "Format '0,2,4' (0=Minggu..6=Sabtu)").nullable().optional(),
  billCreationDates: z.string().regex(/^\d(,\d)*$/, "Format '1,15'").nullable().optional(),
});
