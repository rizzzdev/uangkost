import { api } from '$lib/core/index.js';
import type {
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  Installment,
  CreateInstallmentInput,
  TenantExpense,
  InstallmentWithTransaction,
  MonthlyReport
} from './types.js';

let transactions = $state<Transaction[]>([]);
let loading = $state(false);
let activeFilter = $state<'income' | 'expense' | undefined>(undefined);

async function load(type?: 'income' | 'expense'): Promise<void> {
  activeFilter = type;
  loading = true;
  try {
    const query = type ? `?type=${type}` : '';
    transactions = await api.get<Transaction[]>(`/finance${query}`);
  } finally {
    loading = false;
  }
}

async function refresh(): Promise<void> {
  await load(activeFilter);
}

async function create(input: CreateTransactionInput): Promise<void> {
  await api.post<Transaction>('/finance', input);
  await load(input.type);
}

async function update(id: string, input: UpdateTransactionInput): Promise<void> {
  await api.put<Transaction>(`/finance/${id}`, input);
  await refresh();
}

async function verify(id: string): Promise<void> {
  await api.post<Transaction>(`/finance/${id}/verify`, {});
  await refresh();
}

async function reject(id: string): Promise<void> {
  await api.post<Transaction>(`/finance/${id}/reject`, {});
  await refresh();
}

async function remove(id: string): Promise<void> {
  await api.delete(`/finance/${id}`);
  await refresh();
}

// --- Installments ---

async function addInstallment(
  transactionId: string,
  input: CreateInstallmentInput,
  file?: File
): Promise<Installment> {
  const result = file
    ? await (() => {
        const fd = new FormData();
        fd.append('amount', String(input.amount));
        if (input.note) fd.append('note', input.note);
        fd.append('paymentProof', file);
        return api.upload<Installment>(`/finance/${transactionId}/installments`, fd);
      })()
    : await api.post<Installment>(`/finance/${transactionId}/installments`, input);
  await refresh();
  return result;
}

async function verifyInstallment(installmentId: string): Promise<void> {
  await api.post(`/finance/installments/${installmentId}/verify`, {});
  await refresh();
}

async function rejectInstallment(installmentId: string): Promise<void> {
  await api.post(`/finance/installments/${installmentId}/reject`, {});
  await refresh();
}

async function deleteInstallment(installmentId: string): Promise<void> {
  await api.delete(`/finance/installments/${installmentId}`);
  await refresh();
}

async function getAllInstallments(): Promise<InstallmentWithTransaction[]> {
  return api.get<InstallmentWithTransaction[]>('/finance/installments');
}

async function createInstallmentByAdmin(
  transactionId: string,
  input: CreateInstallmentInput,
  file?: File
): Promise<Installment> {
  const result = file
    ? await (() => {
        const fd = new FormData();
        fd.append('transactionId', transactionId);
        fd.append('amount', String(input.amount));
        if (input.note) fd.append('note', input.note);
        fd.append('paymentProof', file);
        return api.upload<Installment>('/finance/installments', fd);
      })()
    : await api.post<Installment>('/finance/installments', { transactionId, ...input });
  await refresh();
  return result;
}

async function updateInstallment(
  installmentId: string,
  input: { amount?: number; note?: string | null }
): Promise<Installment> {
  const result = await api.put<Installment>(`/finance/installments/${installmentId}`, input);
  await refresh();
  return result;
}

export interface ChartData {
  daily: Array<{ date: string; income: number; expense: number }>;
  monthlyIncome: number;
  monthlyExpense: number;
}

async function getChartData(): Promise<ChartData> {
  return api.get<ChartData>('/finance/chart-data');
}

async function getRecentExpenses(limit = 5): Promise<Transaction[]> {
  return api.get<Transaction[]>(`/finance?type=expense&limit=${limit}`);
}

async function getRecentIncome(limit = 5): Promise<Transaction[]> {
  return api.get<Transaction[]>(`/finance?type=income&limit=${limit}`);
}

async function getMonthlyReport(monthKey: string): Promise<MonthlyReport> {
  return api.get<MonthlyReport>(`/finance/monthly-report?month=${monthKey}`);
}

export interface PublicDashboardTenantStatus {
  id: string;
  name: string;
  roomNumber: string | null;
  status: 'paid' | 'unpaid' | 'partial' | 'none';
  total: number;
  paid: number;
}

export interface PublicDashboard {
  summary: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    paidCount: number;
    unpaidCount: number;
  };
  monthly: { income: number; expense: number; paidCount: number; unpaidCount: number };
  chartData: ChartData;
  recentIncome: TenantExpense[];
  recentExpenses: TenantExpense[];
  tenants: PublicDashboardTenantStatus[];
}

async function getPublicDashboard(): Promise<PublicDashboard> {
  return api.get<PublicDashboard>('/finance/public-dashboard');
}

async function getTenantCashflow(headers: Record<string, string>): Promise<{
  transactions: Transaction[];
  chartData: ChartData;
  expenses: TenantExpense[];
}> {
  return api.get('/finance/tenant-cashflow', headers);
}

export function getFinanceFeature() {
  return {
    get transactions() {
      return transactions;
    },
    get loading() {
      return loading;
    },
    load,
    refresh,
    create,
    update,
    verify,
    reject,
    remove,
    addInstallment,
    verifyInstallment,
    rejectInstallment,
    deleteInstallment,
    getAllInstallments,
    createInstallmentByAdmin,
    updateInstallment,
    getChartData,
    getRecentExpenses,
    getRecentIncome,
    getMonthlyReport,
    getTenantCashflow,
    getPublicDashboard
  };
}
