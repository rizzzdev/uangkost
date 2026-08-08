import { API_BASE_URL } from './api-client.js';

const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember'
] as const;

/** Format tanggal sebagai "Agustus 2026" (bulan pemasukan/tagihan). */
export function formatBillingMonth(d: Date = new Date()): string {
  return `${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

/** Konversi "2026-08-15" → "Agustus 2026"; fallback ke input bila tidak valid. */
export function monthLabelFromDate(dateStr: string): string {
  const [y, m] = dateStr.split('-');
  if (!y || !m) return dateStr;
  return `${MONTHS_ID[Number(m) - 1] ?? m} ${y}`;
}

/**
 * Format angka menjadi "1.500.000" (Rupiah tanpa simbol & koma desimal).
 * Dipakai untuk input jumlah uang agar terbaca ribuan.
 */
export function formatRupiahInput(value: number | string): string {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '';
  return Math.floor(num).toLocaleString('id-ID');
}

/**
 * Parse string hasil input (mis. "1.500.000") menjadi number (1500000).
 * Mengabaikan semua karakter non-digit.
 */
export function parseRupiahInput(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  return Number(digits);
}

/** Format number menjadi "Rp 1.500.000" untuk tampilan. */
export function formatRupiahDisplay(value: number | string): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return 'Rp 0';
  return `Rp ${Math.floor(num).toLocaleString('id-ID')}`;
}

/** URL absolut untuk file upload (bukti pembayaran / QRIS). */
export function assetUrl(path: string | null | undefined): string {
  return path ? `${API_BASE_URL.replace(/\/api$/, '')}${path}` : '';
}

/** Meta tampilan status pemasukan: label, variant badge, dan ikon. */
export function billingStatusMeta(status: string): {
  label: string;
  badge: 'success' | 'warning' | 'danger';
  icon: string;
} {
  if (status === 'paid') return { label: 'Lunas', badge: 'success', icon: 'check_circle' };
  if (status === 'partial') return { label: 'Cicilan', badge: 'warning', icon: 'pending' };
  return { label: 'Belum Lunas', badge: 'danger', icon: 'hourglass_top' };
}
