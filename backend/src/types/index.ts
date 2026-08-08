import type {
  User,
  Transaction,
  SystemSetting,
  UserRole,
  TransactionType,
  PaymentStatus,
} from "@prisma/client";

export type {
  User,
  Transaction,
  SystemSetting,
  UserRole,
  TransactionType,
  PaymentStatus,
};

// --- API Response Types ---

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

// --- Auth Types ---

export interface LoginInput {
  name: string;
  password: string;
}

export interface AuthPayload {
  userId: string;
  role: "admin";
}

export interface AdminProfile {
  id: string;
  name: string;
  phone: string;
}

export interface LoginResponse {
  token: string;
  admin: AdminProfile;
}

// --- User DTOs ---

export interface CreateTenantInput {
  name: string;
  phone: string;
  roomNumber?: string;
}

export interface UpdateTenantInput {
  name?: string;
  phone?: string;
  roomNumber?: string | null;
  isActive?: boolean;
}

export interface TenantResponse {
  id: string;
  role: UserRole;
  name: string;
  phone: string | null;
  roomNumber: string | null;
  isActive: boolean;
  accessTokenExpiresAt: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Tenant + raw portal token — hanya dikembalikan SEKALI (create / regenerate / login). */
export interface TenantWithToken extends TenantResponse {
  accessToken: string;
}

// --- Transaction DTOs ---

export interface CreateTransactionInput {
  userId?: string;
  type: TransactionType;
  amount: number;
  category?: string;
  description?: string;
  billingMonth?: string;
  transactionDate?: string;
}

export interface UpdateTransactionInput {
  type?: TransactionType;
  amount?: number;
  category?: string;
  description?: string | null;
  billingMonth?: string | null;
  status?: PaymentStatus;
  isVerified?: boolean;
  paymentProofUrl?: string | null;
  transactionDate?: string;
}

export interface TransactionFilterQuery {
  start_date?: string;
  end_date?: string;
  type?: TransactionType;
  status?: PaymentStatus;
  category?: string;
  userId?: string;
  limit?: number;
}

export interface TransactionResponse {
  id: string;
  userId: string | null;
  type: TransactionType;
  amount: string;
  totalPaid: string;
  billingMonth: string | null;
  status: PaymentStatus;
  category: string;
  description: string | null;
  transactionDate: string;
  paymentProofUrl: string | null;
  isVerified: boolean;
  waNotifiedAt: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    name: string;
    roomNumber: string | null;
  } | null;
  installments?: InstallmentResponse[];
}

// --- Installment DTOs ---

export interface CreateInstallmentInput {
  amount: number;
  note?: string;
}

export interface UpdateInstallmentInput {
  amount?: number;
  note?: string | null;
}

export interface InstallmentResponse {
  id: string;
  transactionId: string;
  amount: string;
  paymentProofUrl: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  rejectedAt: string | null;
  note: string | null;
  createdAt: Date;
}

export interface InstallmentWithTransactionResponse extends InstallmentResponse {
  transaction: {
    id: string;
    amount: string;
    status: PaymentStatus;
    billingMonth: string | null;
    description: string | null;
    user: {
      name: string;
      roomNumber: string | null;
    } | null;
  };
}

// --- System Setting DTOs ---

export interface UpdateSettingsInput {
  kostName?: string;
  bankAccountInfo?: string;
  qrisImageUrl?: string;
  botWaStatus?: boolean;
  defaultBillAmount?: number | null;
  reminderTime?: string | null;
  reminderFrequency?: string | null;
  reminderWeekdays?: string | null;
  reminderDates?: string | null;
  billCreationTime?: string | null;
  billCreationFrequency?: string | null;
  billCreationWeekdays?: string | null;
  billCreationDates?: string | null;
}

export interface SettingsResponse {
  id: number;
  kostName: string | null;
  bankAccountInfo: string | null;
  qrisImageUrl: string | null;
  botWaStatus: boolean;
  defaultBillAmount: number | null;
  reminderTime: string | null;
  reminderFrequency: string | null;
  reminderWeekdays: string | null;
  reminderDates: string | null;
  billCreationTime: string | null;
  billCreationFrequency: string | null;
  billCreationWeekdays: string | null;
  billCreationDates: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// --- Monthly Report (PDF) ---

export interface MonthlyReportItem {
  id: string;
  type: TransactionType;
  transactionDate: string;
  description: string | null;
  category: string;
  amount: string;
  status: PaymentStatus;
  userName: string | null;
  roomNumber: string | null;
}

export interface MonthlyReportResponse {
  month: string; // "Agustus 2026"
  monthKey: string; // "2026-08"
  openingBalance: number;
  income: number;
  expense: number;
  closingBalance: number;
  incomeCount: number;
  expenseCount: number;
  items: MonthlyReportItem[];
}

// --- Finance Summary ---

export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  paidCount: number;
  unpaidCount: number;
}

// --- Scheduler DTOs ---

export interface WaStatusResponse {
  connected: boolean;
  qrCode?: string;
}
