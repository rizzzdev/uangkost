import { prisma } from "../../config/prisma.js";
import { cached, cacheInvalidate, cacheInvalidatePattern, CACHE_KEYS } from "../../config/cache.js";
import { AppError } from "../../middlewares/error-handler.js";
import type { Prisma } from "@prisma/client";
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionFilterQuery,
  TransactionResponse,
  FinanceSummary,
  MonthlyReportResponse,
} from "../../types/index.js";

const NOT_DELETED = { deletedAt: null } as const;

type TransactionWithRelations = Prisma.TransactionGetPayload<{
  include: {
    user: { select: { name: true; roomNumber: true } };
    installments: true;
  };
}>;

function toTransactionResponse(tx: TransactionWithRelations): TransactionResponse {
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
    transactionDate: tx.transactionDate.toISOString().split("T")[0]!,
    paymentProofUrl: tx.paymentProofUrl,
    isVerified: tx.isVerified,
    waNotifiedAt: tx.waNotifiedAt?.toISOString() ?? null,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
    user: tx.user
      ? { name: tx.user.name, roomNumber: tx.user.roomNumber }
      : null,
    installments: tx.installments?.map((i) => ({
      id: i.id,
      transactionId: i.transactionId,
      amount: i.amount.toString(),
      paymentProofUrl: i.paymentProofUrl,
      isVerified: i.isVerified,
      verifiedAt: i.verifiedAt?.toISOString() ?? null,
      rejectedAt: i.rejectedAt?.toISOString() ?? null,
      description: i.description,
      createdAt: i.createdAt,
    })),
  };
}

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** Format tanggal sebagai "Agustus 2026" */
export function formatBillingMonth(date: Date = new Date()): string {
  return `${MONTHS_ID[date.getMonth()]} ${date.getFullYear()}`;
}

function buildWhereClause(
  filter: TransactionFilterQuery,
): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { ...NOT_DELETED };

  if (filter.start_date && filter.end_date) {
    where.transactionDate = {
      gte: new Date(filter.start_date),
      lte: new Date(filter.end_date),
    };
  }

  if (filter.type) {
    where.type = filter.type;
  }

  if (filter.status) {
    where.status = filter.status;
  }

  if (filter.category) {
    where.category = filter.category;
  }

  if (filter.userId) {
    where.userId = filter.userId;
  }

  return where;
}

const DEFAULT_TRANSACTION_INCLUDE = {
  user: { select: { name: true, roomNumber: true } },
  installments: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

export async function getTransactions(
  filter: TransactionFilterQuery,
): Promise<TransactionResponse[]> {
  const queryKey = JSON.stringify({
    start_date: filter.start_date,
    end_date: filter.end_date,
    type: filter.type,
    status: filter.status,
    category: filter.category,
    userId: filter.userId,
    limit: filter.limit,
  });
  return cached(CACHE_KEYS.financeTransactions(queryKey), () =>
    fetchTransactions(filter),
  );
}

async function fetchTransactions(
  filter: TransactionFilterQuery,
): Promise<TransactionResponse[]> {
  const where = buildWhereClause(filter);
  const transactions = await prisma.transaction.findMany({
    where,
    include: DEFAULT_TRANSACTION_INCLUDE,
    orderBy: [{ createdAt: "desc" }, { transactionDate: "desc" }],
    ...(filter.limit ? { take: filter.limit } : {}),
  });
  return transactions.map(toTransactionResponse);
}

export async function getTransactionsByTenant(
  tenantId: string,
): Promise<TransactionResponse[]> {
  return cached(
    CACHE_KEYS.financeTenantTransactions(tenantId),
    () => fetchTransactionsByTenant(tenantId),
  );
}

async function fetchTransactionsByTenant(
  tenantId: string,
): Promise<TransactionResponse[]> {
  const transactions = await prisma.transaction.findMany({
    where: { userId: tenantId, ...NOT_DELETED },
    include: DEFAULT_TRANSACTION_INCLUDE,
    orderBy: [{ createdAt: "desc" }, { transactionDate: "desc" }],
  });
  return transactions.map(toTransactionResponse);
}

export async function getTransactionById(
  id: string,
): Promise<TransactionResponse> {
  const tx = await prisma.transaction.findFirst({
    where: { id, ...NOT_DELETED },
    include: DEFAULT_TRANSACTION_INCLUDE,
  });

  if (!tx) {
    throw new AppError("Transaction not found", 404);
  }

  return toTransactionResponse(tx);
}

/**
 * Semua data agregasi dipengaruhi oleh mutasi apa pun (transaksi/cicilan/
 * tagihan otomatis). Hapus cache agar selalu segar.
 * Dipakai juga oleh worker createMonthlyBills.
 */
export async function invalidateFinanceCache(): Promise<void> {
  await cacheInvalidate(CACHE_KEYS.financeSummary, CACHE_KEYS.financeChart);
  // Cache per-penghuni, per-filter, per-bulan laporan publik: hapus semua
  // karena tidak tahu siapa/bulan mana yang berubah
  await cacheInvalidatePattern("finance:public-dashboard:*");
  await cacheInvalidatePattern("finance:tenant-cashflow:*");
  await cacheInvalidatePattern("finance:tenant-transactions:*");
  await cacheInvalidatePattern("finance:transactions:*");
  await cacheInvalidatePattern("finance:monthly-report:*");
}

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<TransactionResponse> {
  const tx = await prisma.transaction.create({
    data: {
      userId: input.userId ?? null,
      type: input.type,
      amount: input.amount,
      category: input.category ?? (input.type === "expense" ? "Pengeluaran" : "Lainnya"),
      description: input.description ?? null,
      // Pemasukan (income) otomatis memakai bulan berjalan bila tidak diisi
      billingMonth:
        input.billingMonth ?? (input.type === "income" ? formatBillingMonth() : null),
      transactionDate: input.transactionDate ? new Date(input.transactionDate) : undefined,
    },
    include: DEFAULT_TRANSACTION_INCLUDE,
  });

  await invalidateFinanceCache(); // SEBELUM respons — refetch client selalu dapat data segar
  return toTransactionResponse(tx);
}

export async function updateTransaction(
  id: string,
  input: UpdateTransactionInput,
): Promise<TransactionResponse> {
  const existing = await prisma.transaction.findFirst({
    where: { id, ...NOT_DELETED },
  });
  if (!existing) {
    throw new AppError("Transaction not found", 404);
  }

  const tx = await prisma.transaction.update({
    where: { id },
    data: {
      ...(input.type !== undefined && { type: input.type }),
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.billingMonth !== undefined && { billingMonth: input.billingMonth }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.isVerified !== undefined && { isVerified: input.isVerified }),
      ...(input.paymentProofUrl !== undefined && { paymentProofUrl: input.paymentProofUrl }),
      ...(input.transactionDate !== undefined && { transactionDate: new Date(input.transactionDate) }),
    },
    include: DEFAULT_TRANSACTION_INCLUDE,
  });

  await invalidateFinanceCache(); // SEBELUM respons — refetch client selalu dapat data segar
  return toTransactionResponse(tx);
}

export async function verifyTransaction(
  id: string,
): Promise<TransactionResponse> {
  const existing = await prisma.transaction.findFirst({
    where: { id, ...NOT_DELETED },
  });
  if (!existing) {
    throw new AppError("Transaction not found", 404);
  }

  if (!existing.paymentProofUrl) {
    throw new AppError("No payment proof uploaded yet", 400);
  }

  const tx = await prisma.transaction.update({
    where: { id },
    data: {
      isVerified: true,
      status: "paid",
    },
    include: DEFAULT_TRANSACTION_INCLUDE,
  });

  await invalidateFinanceCache(); // SEBELUM respons — refetch client selalu dapat data segar
  return toTransactionResponse(tx);
}

export async function rejectTransaction(
  id: string,
): Promise<TransactionResponse> {
  const existing = await prisma.transaction.findFirst({
    where: { id, ...NOT_DELETED },
  });
  if (!existing) {
    throw new AppError("Transaction not found", 404);
  }

  if (!existing.paymentProofUrl) {
    throw new AppError("Tidak ada bukti pembayaran untuk ditolak", 400);
  }

  // Jika ada cicilan terverifikasi, status tetap partial; selain itu unpaid
  const newStatus =
    Number(existing.totalPaid) > 0
      ? ("partial" as const)
      : ("unpaid" as const);

  const tx = await prisma.transaction.update({
    where: { id },
    data: {
      isVerified: false,
      paymentProofUrl: null,
      status: newStatus,
    },
    include: DEFAULT_TRANSACTION_INCLUDE,
  });

  await invalidateFinanceCache(); // SEBELUM respons — refetch client selalu dapat data segar
  return toTransactionResponse(tx);
}

export async function uploadPaymentProof(
  id: string,
  filePath: string,
  tenantUserId?: string,
): Promise<TransactionResponse> {
  const existing = await prisma.transaction.findFirst({
    where: { id, ...NOT_DELETED },
  });
  if (!existing) {
    throw new AppError("Transaction not found", 404);
  }

  if (tenantUserId && existing.userId !== tenantUserId) {
    throw new AppError("You are not allowed to upload proof for this bill", 403);
  }

  const tx = await prisma.transaction.update({
    where: { id },
    data: { paymentProofUrl: filePath },
    include: DEFAULT_TRANSACTION_INCLUDE,
  });

  await invalidateFinanceCache(); // SEBELUM respons — refetch client selalu dapat data segar
  return toTransactionResponse(tx);
}

export async function deleteTransaction(
  id: string,
): Promise<{ deleted: boolean }> {
  const existing = await prisma.transaction.findFirst({
    where: { id, ...NOT_DELETED },
  });
  if (!existing) {
    throw new AppError("Transaction not found", 404);
  }

  // Soft delete
  await prisma.transaction.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await invalidateFinanceCache(); // SEBELUM respons — refetch client selalu dapat data segar
  return { deleted: true };
}

export async function getFinanceSummary(): Promise<FinanceSummary> {
  return cached(CACHE_KEYS.financeSummary, () => computeFinanceSummary());
}

async function computeFinanceSummary(): Promise<FinanceSummary> {
  const [paidIncome, partialIncome, expenseResult, paidCount, unpaidCount] =
    await Promise.all([
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: "income", status: "paid", ...NOT_DELETED },
      }),
      // Cicilan (partial): hanya nominal yang BENAR-BENAR sudah dibayar (totalPaid)
      prisma.transaction.aggregate({
        _sum: { totalPaid: true },
        where: { type: "income", status: "partial", ...NOT_DELETED },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: "expense", ...NOT_DELETED },
      }),
      prisma.transaction.count({ where: { status: "paid", ...NOT_DELETED } }),
      prisma.transaction.count({ where: { status: "unpaid", ...NOT_DELETED } }),
    ]);

  // Pemasukan = pembayaran lunas (penuh) + cicilan yang sudah dibayar (totalPaid)
  const totalIncome =
    Number(paidIncome._sum.amount ?? 0) + Number(partialIncome._sum.totalPaid ?? 0);
  const totalExpense = Number(expenseResult._sum.amount ?? 0);

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    paidCount,
    unpaidCount,
  };
}

export interface DailyAggregate {
  date: string;
  income: number;
  expense: number;
}

export interface ChartDataResponse {
  daily: DailyAggregate[];
  monthlyIncome: number;
  monthlyExpense: number;
}

export async function getChartData(): Promise<ChartDataResponse> {
  return cached(CACHE_KEYS.financeChart, () =>
    buildChartData({ ...NOT_DELETED }),
  );
}

export interface TenantExpenseResponse {
  id: string;
  type: TransactionResponse["type"];
  amount: string;
  category: string;
  description: string | null;
  transactionDate: string;
  createdAt: Date;
  /** Nama & kamar penghuni terkait (opsional — laporan publik). */
  userName?: string | null;
  roomNumber?: string | null;
  /** Status pembayaran — khusus pemasukan (opsional — laporan publik). */
  status?: "paid" | "unpaid" | "partial";
  /** Hanya diisi pada laporan publik (opsional) — tautan bukti pembayaran. */
  paymentProofUrl?: string | null;
}

export interface PublicDashboardTenantStatus {
  id: string;
  name: string;
  roomNumber: string | null;
  status: "paid" | "unpaid" | "partial" | "none";
  total: number;
  paid: number;
}

export interface PublicDashboardMonthly {
  income: number;
  expense: number;
  paidCount: number;
  unpaidCount: number;
  /** Saldo sebelum periode (pemasukan − pengeluaran periode-periode sebelumnya). */
  openingBalance: number;
  /** Saldo akhir periode = openingBalance + income − expense. */
  closingBalance: number;
}

export interface PeriodChartPoint {
  /** Label sumbu-X: "08/08" (per hari) atau "08/26" (per bulan saat "all"). */
  label: string;
  income: number;
  expense: number;
}

export interface PublicDashboardResponse {
  summary: FinanceSummary;
  monthly: PublicDashboardMonthly;
  chartData: ChartDataResponse;
  /** Bar chart periode terpilih: per hari untuk bulan tertentu, per bulan untuk "all". */
  periodChart: PeriodChartPoint[];
  recentIncome: TenantExpenseResponse[];
  recentExpenses: TenantExpenseResponse[];
  tenants: PublicDashboardTenantStatus[];
  /** Bulan yang punya data (label "Agustus 2026"), terbaru dulu — untuk filter. */
  availableMonths: string[];
}

export async function getPublicDashboard(
  monthKey?: string,
): Promise<PublicDashboardResponse> {
  const key = monthKey?.trim() ?? "";
  return cached(CACHE_KEYS.publicDashboard(key), () => buildPublicDashboard(key));
}

/** "2026-08" → range { gte, lt } bulan tersebut; null bila key tidak valid. */
function resolveMonthRange(monthKey: string): { gte: Date; lt: Date } | null {
  if (/^\d{4}-\d{2}$/.test(monthKey)) {
    const py = Number(monthKey.slice(0, 4));
    const pm = Number(monthKey.slice(5, 7)) - 1;
    if (pm >= 0 && pm <= 11 && py >= 2000 && py <= 2100) {
      return { gte: new Date(py, pm, 1), lt: new Date(py, pm + 1, 1) };
    }
  }
  return null;
}

async function buildPublicDashboard(monthKey: string): Promise<PublicDashboardResponse> {
  const now = new Date();
  // "" (default) → bulan berjalan; "all" → Semua Bulan (tanpa filter tanggal);
  // "YYYY-MM" → bulan tersebut; lainnya → fallback bulan berjalan
  let rangeWhere: Prisma.TransactionWhereInput;
  let periodStart: Date | null = null;
  const range = resolveMonthRange(monthKey);
  if (range) {
    rangeWhere = { transactionDate: range };
    periodStart = range.gte;
  } else if (monthKey === "all") {
    rangeWhere = {};
  } else {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    periodStart = startOfMonth;
    rangeWhere = {
      transactionDate: {
        gte: startOfMonth,
        lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      },
    };
  }

  const [summary, chartData, recentIncome, recentExpenses, tenants, monthlyCounts, monthlyAgg, beforeAgg] =
    await Promise.all([
      getFinanceSummary(),
      getChartData(),
      // Laporan publik menampilkan SEMUA data periode terpilih (bukan hanya 5 terbaru)
      prisma.transaction.findMany({
        where: { type: "income", ...rangeWhere, ...NOT_DELETED },
        include: DEFAULT_TRANSACTION_INCLUDE,
        orderBy: [{ createdAt: "desc" }, { transactionDate: "desc" }],
      }),
      prisma.transaction.findMany({
        where: { type: "expense", ...rangeWhere, ...NOT_DELETED },
        include: DEFAULT_TRANSACTION_INCLUDE,
        orderBy: [{ createdAt: "desc" }, { transactionDate: "desc" }],
      }),
      prisma.user.findMany({
        where: { role: "tenant", isActive: true, ...NOT_DELETED },
        select: { id: true, name: true, roomNumber: true },
        orderBy: { name: "asc" },
      }),
      Promise.all([
        prisma.transaction.count({
          where: { type: "income", status: "paid", ...rangeWhere, ...NOT_DELETED },
        }),
        prisma.transaction.count({
          where: { type: "income", status: "unpaid", ...rangeWhere, ...NOT_DELETED },
        }),
      ]),
      Promise.all([
        prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { type: "income", status: "paid", ...rangeWhere, ...NOT_DELETED },
        }),
        prisma.transaction.aggregate({
          _sum: { totalPaid: true },
          where: { type: "income", status: "partial", ...rangeWhere, ...NOT_DELETED },
        }),
        prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { type: "expense", ...rangeWhere, ...NOT_DELETED },
        }),
      ]),
      // Saldo awal periode: pemasukan (lunas + cicilan terbayar) − pengeluaran SEBELUM periode.
      // Untuk "all" (Semua Bulan) tidak ada periode sebelumnya → saldo awal 0.
      periodStart
        ? Promise.all([
            prisma.transaction.aggregate({
              _sum: { amount: true },
              where: {
                type: "income",
                status: "paid",
                transactionDate: { lt: periodStart },
                ...NOT_DELETED,
              },
            }),
            prisma.transaction.aggregate({
              _sum: { totalPaid: true },
              where: {
                type: "income",
                status: "partial",
                transactionDate: { lt: periodStart },
                ...NOT_DELETED,
              },
            }),
            prisma.transaction.aggregate({
              _sum: { amount: true },
              where: {
                type: "expense",
                transactionDate: { lt: periodStart },
                ...NOT_DELETED,
              },
            }),
          ])
        : Promise.resolve(null),
    ]);

  // Kumpulkan status + total/dibayar tagihan penghuni untuk periode terpilih
  const bills = await prisma.transaction.findMany({
    where: {
      type: "income",
      ...rangeWhere,
      ...NOT_DELETED,
      userId: { in: tenants.map((t) => t.id) },
    },
    select: { userId: true, status: true, amount: true, totalPaid: true },
  });

  // Bulan-bulan yang punya data (label "Agustus 2026"), terbaru dulu — untuk filter
  const distinctDates = await prisma.transaction.findMany({
    where: { ...NOT_DELETED },
    select: { transactionDate: true },
    distinct: ["transactionDate"],
  });
  const monthSet = new Set<string>();
  for (const d of distinctDates) {
    const dt = d.transactionDate;
    monthSet.add(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  }
  const availableMonths = [...monthSet]
    .sort((a, b) => b.localeCompare(a))
    .map((k) => {
      const [y, m] = k.split("-");
      return `${MONTHS_ID[Number(m) - 1]} ${y}`;
    });

  // Status tenant berbasis JUMLAH YANG SUDAH DIBAYAR (konsisten dengan kolom total/paid):
  //  - belum dibayar sama sekali → unpaid
  //  - sudah ada yang dibayar tapi belum lunas semua → partial
  //  - lunas semua (paid >= total) → paid
  // Pendekatan ini juga menangani data tak konsisten (tagihan ditandai lunas
  // tapi totalPaid belum penuh → otomatis turun ke partial).
  const totalByTenant = new Map<string, number>();
  const paidByTenant = new Map<string, number>();
  for (const b of bills) {
    if (!b.userId) continue;
    totalByTenant.set(b.userId, (totalByTenant.get(b.userId) ?? 0) + Number(b.amount));
    paidByTenant.set(b.userId, (paidByTenant.get(b.userId) ?? 0) + Number(b.totalPaid));
  }
  function aggregateStatus(uid: string): "paid" | "unpaid" | "partial" {
    const total = totalByTenant.get(uid) ?? 0;
    const paid = paidByTenant.get(uid) ?? 0;
    if (total > 0 && paid >= total) return "paid";
    if (paid > 0) return "partial";
    return "unpaid";
  }

  // Pemasukan = lunas (penuh) + cicilan yang sudah dibayar (totalPaid)
  const income =
    Number(monthlyAgg[0]._sum.amount ?? 0) + Number(monthlyAgg[1]._sum.totalPaid ?? 0);
  const expense = Number(monthlyAgg[2]._sum.amount ?? 0);
  const openingBalance = beforeAgg
    ? Number(beforeAgg[0]._sum.amount ?? 0) +
      Number(beforeAgg[1]._sum.totalPaid ?? 0) -
      Number(beforeAgg[2]._sum.amount ?? 0)
    : 0;

  return {
    summary,
    monthly: {
      income,
      expense,
      paidCount: monthlyCounts[0],
      unpaidCount: monthlyCounts[1],
      openingBalance,
      closingBalance: openingBalance + income - expense,
    },
    chartData,
    periodChart: buildPeriodChart(monthKey, recentIncome, recentExpenses),
    recentIncome: recentIncome.map((tx) => toTenantExpense(tx, { includeProof: true })),
    recentExpenses: recentExpenses.map((tx) => toTenantExpense(tx, { includeProof: true })),
    tenants: tenants.map((t) => ({
      id: t.id,
      name: t.name,
      roomNumber: t.roomNumber,
      status: totalByTenant.has(t.id) ? aggregateStatus(t.id) : "none",
      total: totalByTenant.get(t.id) ?? 0,
      paid: paidByTenant.get(t.id) ?? 0,
    })),
    availableMonths,
  };
}

/**
 * Bar chart periode terpilih (laporan publik & reports).
 * Dibangun dari transaksi yang SUDAH di-fetch (tanpa query tambahan):
 * - bulan tertentu (termasuk default bulan berjalan) → agregasi per hari,
 *   seluruh hari bulan diisi 0 agar bar kontinu;
 * - "all" (Semua Bulan) → agregasi per bulan.
 * Pemasukan = pembayaran lunas (penuh) + cicilan yang sudah dibayar (totalPaid),
 * konsisten dengan agregasi lain.
 */
function buildPeriodChart(
  monthKey: string,
  incomes: TransactionWithRelations[],
  expenses: TransactionWithRelations[],
): PeriodChartPoint[] {
  let start: Date | null = null;
  const range = resolveMonthRange(monthKey);
  if (range) {
    start = range.gte;
  } else if (monthKey !== "all") {
    // Default ("") → bulan berjalan
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // Buka cache inline di dalam editor loop closure
  const applyContribution = (
    entry: { income: number; expense: number },
    tx: TransactionWithRelations,
    isIncome: boolean,
  ): void => {
    if (isIncome) {
      // Pemasukan = lunas (penuh) + cicilan yang sudah dibayar (totalPaid)
      if (tx.status === "paid") entry.income += Number(tx.amount);
      else if (tx.status === "partial") entry.income += Number(tx.totalPaid);
    } else {
      entry.expense += Number(tx.amount);
    }
  };

  if (start) {
    const y = start.getFullYear();
    const m = start.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const dayMap = new Map<string, { income: number; expense: number }>();
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      dayMap.set(key, { income: 0, expense: 0 });
    }
    for (const tx of incomes) {
      const entry = dayMap.get(tx.transactionDate.toISOString().split("T")[0]!);
      if (entry) applyContribution(entry, tx, true);
    }
    for (const tx of expenses) {
      const entry = dayMap.get(tx.transactionDate.toISOString().split("T")[0]!);
      if (entry) applyContribution(entry, tx, false);
    }
    return [...dayMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({
        label: `${date.slice(8, 10)}/${date.slice(5, 7)}`,
        income: v.income,
        expense: v.expense,
      }));
  }

  // "all" → agregasi per bulan (label "08/26" = MM/YY)
  const monthMap = new Map<string, { income: number; expense: number }>();
  const aggregateMonth = (
    txs: TransactionWithRelations[],
    isIncome: boolean,
  ): void => {
    for (const tx of txs) {
      const d = tx.transactionDate;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entry = monthMap.get(key) ?? { income: 0, expense: 0 };
      applyContribution(entry, tx, isIncome);
      monthMap.set(key, entry);
    }
  };
  aggregateMonth(incomes, true);
  aggregateMonth(expenses, false);
  return [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({
      label: `${key.slice(5, 7)}/${key.slice(2, 4)}`,
      income: v.income,
      expense: v.expense,
    }));
}

// Tenant-facing expense view: tanpa bukti pembayaran kecuali untuk laporan publik (includeProof)
function toTenantExpense(
  tx: TransactionWithRelations,
  opts: { includeProof?: boolean } = {},
): TenantExpenseResponse {
  // Untuk pemasukan yang dibayar lewat cicilan, bukti ada di Installment.paymentProofUrl
  // (bukan di transaction). Prioritas: bukti transaksi → bukti cicilan terverifikasi → cicilan apa pun.
  const proof = opts.includeProof
    ? (tx.paymentProofUrl ??
        tx.installments?.find((i) => i.isVerified && i.paymentProofUrl)?.paymentProofUrl ??
        tx.installments?.find((i) => i.paymentProofUrl)?.paymentProofUrl ??
        null)
    : undefined;

  return {
    id: tx.id,
    type: tx.type,
    amount: tx.amount.toString(),
    category: tx.category,
    description: tx.description,
    transactionDate: tx.transactionDate.toISOString().split("T")[0]!,
    createdAt: tx.createdAt,
    userName: tx.user?.name ?? null,
    roomNumber: tx.user?.roomNumber ?? null,
    status: tx.type === "income" ? tx.status : undefined,
    ...(opts.includeProof ? { paymentProofUrl: proof } : {}),
  };
}

export async function getPublicTenantTransactions(
  tenantId: string,
): Promise<{
  transactions: TransactionResponse[];
  chartData: ChartDataResponse;
  expenses: TenantExpenseResponse[];
}> {
  return cached(CACHE_KEYS.tenantCashflow(tenantId), () =>
    buildTenantCashflow(tenantId),
  );
}

async function buildTenantCashflow(tenantId: string): Promise<{
  transactions: TransactionResponse[];
  chartData: ChartDataResponse;
  expenses: TenantExpenseResponse[];
}> {
  const [transactions, chartData, expenses] = await Promise.all([
    getTransactionsByTenant(tenantId),
    getTenantChartData(tenantId),
    prisma.transaction.findMany({
      where: { type: "expense", ...NOT_DELETED },
      include: DEFAULT_TRANSACTION_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { transactionDate: "desc" }],
      take: 20,
    }),
  ]);
  return {
    transactions,
    chartData,
    expenses: expenses.map((tx) => toTenantExpense(tx)),
  };
}

async function getTenantChartData(tenantId: string): Promise<ChartDataResponse> {
  return buildChartData({ userId: tenantId, ...NOT_DELETED });
}

/**
 * Laporan bulanan untuk export PDF (admin).
 * - Saldo awal = pemasukan (lunas + cicilan terbayar) − pengeluaran SEBELUM bulan terpilih
 * - Pemasukan bulan ini = pembayaran lunas (penuh) + cicilan yang sudah dibayar (totalPaid)
 * - Pengeluaran bulan ini = semua pengeluaran
 * - Sisa saldo akhir = saldo awal + pemasukan − pengeluaran
 */
export async function getMonthlyReport(
  monthKey?: string,
): Promise<MonthlyReportResponse> {
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();
  if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
    const py = Number(monthKey.slice(0, 4));
    const pm = Number(monthKey.slice(5, 7)) - 1;
    // Tolak bulan/nilai di luar jangkauan (mis. "2026-13") — fallback ke bulan berjalan
    if (pm >= 0 && pm <= 11 && py >= 2000 && py <= 2100) {
      y = py;
      m = pm;
    }
  }
  const key = `${y}-${String(m + 1).padStart(2, "0")}`;
  const startOfMonth = new Date(y, m, 1);
  const startOfNextMonth = new Date(y, m + 1, 1);

  return cached(
    CACHE_KEYS.financeMonthlyReport(key),
    () => buildMonthlyReport(startOfMonth, startOfNextMonth, key),
  );
}

async function buildMonthlyReport(
  start: Date,
  end: Date,
  monthKey: string,
): Promise<MonthlyReportResponse> {
  const [
    beforePaidIncome,
    beforePartialIncome,
    beforeExpense,
    paidIncome,
    partialIncome,
    expenseAgg,
    txs,
  ] =
    await Promise.all([
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: "income", status: "paid", transactionDate: { lt: start }, ...NOT_DELETED },
      }),
      prisma.transaction.aggregate({
        _sum: { totalPaid: true },
        where: { type: "income", status: "partial", transactionDate: { lt: start }, ...NOT_DELETED },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: "expense", transactionDate: { lt: start }, ...NOT_DELETED },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: "income", status: "paid", transactionDate: { gte: start, lt: end }, ...NOT_DELETED },
      }),
      prisma.transaction.aggregate({
        _sum: { totalPaid: true },
        where: { type: "income", status: "partial", transactionDate: { gte: start, lt: end }, ...NOT_DELETED },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: "expense", transactionDate: { gte: start, lt: end }, ...NOT_DELETED },
      }),
      prisma.transaction.findMany({
        where: { transactionDate: { gte: start, lt: end }, ...NOT_DELETED },
        include: { user: { select: { name: true, roomNumber: true } } },
        orderBy: [{ transactionDate: "asc" as const }, { createdAt: "asc" as const }],
      }),
    ]);

  const openingBalance =
    Number(beforePaidIncome._sum.amount ?? 0) +
    Number(beforePartialIncome._sum.totalPaid ?? 0) -
    Number(beforeExpense._sum.amount ?? 0);
  const income =
    Number(paidIncome._sum.amount ?? 0) + Number(partialIncome._sum.totalPaid ?? 0);
  const expense = Number(expenseAgg._sum.amount ?? 0);

  return {
    month: start.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
    monthKey,
    openingBalance,
    income,
    expense,
    closingBalance: openingBalance + income - expense,
    // incomeCount = pemasukan lunas + dicicil (konsisten dengan angka income),
    // expenseCount semua pengeluaran (pengeluaran selalu "realisasi")
    incomeCount: txs.filter(
      (t) => t.type === "income" && (t.status === "paid" || t.status === "partial"),
    ).length,
    expenseCount: txs.filter((t) => t.type === "expense").length,
    items: txs.map((tx) => ({
      id: tx.id,
      type: tx.type,
      transactionDate: tx.transactionDate.toISOString().split("T")[0]!,
      description: tx.description,
      category: tx.category,
      amount: tx.amount.toString(),
      status: tx.status,
      userName: tx.user?.name ?? null,
      roomNumber: tx.user?.roomNumber ?? null,
    })),
  };
}

/**
 * Agregasi chart: bar harian 7 hari + total bulan berjalan.
 * Dipakai dashboard admin (semua data) & tenant (scoped per user).
 */
async function buildChartData(where: Prisma.TransactionWhereInput): Promise<ChartDataResponse> {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  // Start of current month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [dailyTxns, monthlyAgg] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        ...where,
        transactionDate: { gte: sevenDaysAgo, lte: now },
      },
      select: { type: true, amount: true, status: true, totalPaid: true, transactionDate: true },
      orderBy: { transactionDate: "asc" },
    }),
    Promise.all([
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          ...where,
          type: "income",
          status: "paid",
          transactionDate: { gte: startOfMonth, lte: now },
        },
      }),
      prisma.transaction.aggregate({
        _sum: { totalPaid: true },
        where: {
          ...where,
          type: "income",
          status: "partial",
          transactionDate: { gte: startOfMonth, lte: now },
        },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          ...where,
          type: "expense",
          transactionDate: { gte: startOfMonth, lte: now },
        },
      }),
    ]),
  ]);

  // Build daily aggregation map
  const dayMap = new Map<string, { income: number; expense: number }>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split("T")[0]!;
    dayMap.set(key, { income: 0, expense: 0 });
  }

  for (const tx of dailyTxns) {
    const key = tx.transactionDate.toISOString().split("T")[0]!;
    const entry = dayMap.get(key);
    if (entry) {
      const amt = Number(tx.amount);
      // Pemasukan = pembayaran lunas (penuh) + cicilan yang sudah dibayar (totalPaid);
      // tagihan belum dibayar tidak dihitung. Konsisten dengan agregasi bulanan.
      if (tx.type === "income") {
        if (tx.status === "paid") entry.income += amt;
        else if (tx.status === "partial") entry.income += Number(tx.totalPaid);
      } else {
        entry.expense += amt;
      }
    }
  }

  const daily: DailyAggregate[] = [];
  for (const [date, vals] of dayMap) {
    daily.push({ date, income: vals.income, expense: vals.expense });
  }

  return {
    daily,
    monthlyIncome:
      Number(monthlyAgg[0]._sum.amount ?? 0) + Number(monthlyAgg[1]._sum.totalPaid ?? 0),
    monthlyExpense: Number(monthlyAgg[2]._sum.amount ?? 0),
  };
}
