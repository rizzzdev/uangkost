export interface Installment {
  id: string;
  transactionId: string;
  amount: string;
  paymentProofUrl: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  rejectedAt: string | null;
  note: string | null;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string | null;
  type: 'income' | 'expense';
  amount: string;
  totalPaid: string;
  billingMonth: string | null;
  status: 'paid' | 'unpaid' | 'partial';
  category: string;
  description: string | null;
  transactionDate: string;
  paymentProofUrl: string | null;
  isVerified: boolean;
  waNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { name: string; roomNumber: string | null } | null;
  installments?: Installment[];
}

export interface CreateTransactionInput {
  userId?: string;
  type: 'income' | 'expense';
  amount: number;
  category?: string;
  description?: string;
  billingMonth?: string;
  transactionDate?: string;
}

export interface UpdateTransactionInput {
  type?: 'income' | 'expense';
  amount?: number;
  category?: string;
  description?: string | null;
  billingMonth?: string | null;
  status?: 'paid' | 'unpaid' | 'partial';
  transactionDate?: string;
}

export interface CreateInstallmentInput {
  amount: number;
  note?: string;
}

export interface InstallmentWithTransaction extends Installment {
  transaction: {
    id: string;
    amount: string;
    status: 'paid' | 'unpaid' | 'partial';
    billingMonth: string | null;
    description: string | null;
    user: { name: string; roomNumber: string | null } | null;
  };
}

export interface TransactionFilter {
  start_date?: string;
  end_date?: string;
  type?: string;
  status?: string;
}

export interface TenantExpense {
  id: string;
  type: 'income' | 'expense';
  amount: string;
  category: string;
  description: string | null;
  transactionDate: string;
  createdAt: string;
  userName?: string | null;
  roomNumber?: string | null;
  status?: 'paid' | 'unpaid' | 'partial';
  paymentProofUrl?: string | null;
}

export interface MonthlyReportItem {
  id: string;
  type: 'income' | 'expense';
  transactionDate: string;
  description: string | null;
  category: string;
  amount: string;
  status: 'paid' | 'unpaid' | 'partial';
  userName: string | null;
  roomNumber: string | null;
}

export interface MonthlyReport {
  month: string;
  monthKey: string;
  openingBalance: number;
  income: number;
  expense: number;
  closingBalance: number;
  incomeCount: number;
  expenseCount: number;
  items: MonthlyReportItem[];
}
