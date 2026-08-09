import { api } from '$lib/core/index.js';
import type { Transaction, Installment } from '../finance/types.js';
import type { Tenant } from '../tenants/types.js';

let tenant = $state<Tenant | null>(null);
let transactions = $state<Transaction[]>([]);
// Awalnya true agar halaman menampilkan skeleton, bukan error flash content
let loading = $state(true);
let bankInfo = $state<{
  kostName: string | null;
  bankAccountInfo: string | null;
  qrisImageUrl: string | null;
}>({
  kostName: null,
  bankAccountInfo: null,
  qrisImageUrl: null
});

/**
 * Login magic link: token divalidasi (hash + belum expired + last4Phone), lalu di-ROTATE
 * (link lama mati) dan sesi cookie httpOnly dipasang. Mengembalikan token baru.
 */
async function login(accessToken: string, last4Phone?: string): Promise<string> {
  const res = await api.post<{ token: string; user: Tenant }>('/tenants/portal-login', {
    token: accessToken,
    last4Phone
  });
  tenant = res.user;
  return res.token;
}

/** Keluar dari portal penghuni: hapus sesi cookie di backend & reset state. */
async function logout(): Promise<void> {
  try {
    await api.post<{ message: string }>('/tenants/portal-logout', {});
  } finally {
    tenant = null;
    transactions = [];
  }
}

/** Muat profil + tagihan via sesi cookie (tidak perlu token di URL). */
async function load(): Promise<void> {
  loading = true;
  try {
    const [profile, bills] = await Promise.all([
      api.get<Tenant>('/tenants/me'),
      api.get<Transaction[]>('/finance/me')
    ]);
    tenant = profile;
    transactions = bills;
  } finally {
    loading = false;
  }
}

async function loadBank(): Promise<void> {
  try {
    const data = await api.get<{
      kostName: string | null;
      bankAccountInfo: string | null;
      qrisImageUrl: string | null;
    }>('/settings/public');
    bankInfo = data;
  } catch {
    bankInfo = { kostName: null, bankAccountInfo: null, qrisImageUrl: null };
  }
}

async function uploadProof(txId: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append('paymentProof', file);
  await api.upload<Transaction>(`/finance/${txId}/upload-proof`, formData);
  await load();
}

async function uploadInstallment(
  transactionId: string,
  amount: number,
  description: string,
  file: File
): Promise<void> {
  const formData = new FormData();
  formData.append('amount', String(amount));
  formData.append('description', description);
  formData.append('paymentProof', file);
  await api.upload<Installment>(`/finance/${transactionId}/installments`, formData);
  await load();
}

export function getTenantPortalFeature() {
  return {
    get tenant() {
      return tenant;
    },
    get transactions() {
      return transactions;
    },
    get loading() {
      return loading;
    },
    get bankInfo() {
      return bankInfo;
    },
    login,
    logout,
    load,
    loadBank,
    uploadProof,
    uploadInstallment
  };
}
