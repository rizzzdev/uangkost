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
  return monthLabelFromKey(dateStr);
}

/** "2026-08" → "Agustus 2026"; fallback ke input bila tidak valid. */
export function monthLabelFromKey(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  if (!y || !m) return monthKey;
  return `${MONTHS_ID[Number(m) - 1] ?? m} ${y}`;
}

/** "Agustus 2026" → "2026-08"; fallback ke input bila tidak dikenal. */
export function monthKeyFromLabel(label: string): string {
  const match = /^([A-Za-z]+) (\d{4})$/.exec(label.trim());
  if (!match) return label;
  const idx = MONTHS_ID.findIndex((mn) => mn.toLowerCase() === match[1]!.toLowerCase());
  if (idx === -1) return label;
  return `${match[2]}-${String(idx + 1).padStart(2, '0')}`;
}

/** Key bulan berjalan, mis. "2026-08". */
export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Daftar label bulan-tahun UNIK dari koleksi label (mis. "Agustus 2026"),
 * diurutkan terbaru dulu. Dipakai opsi filter bulan di halaman pemasukan,
 * pengeluaran, cicilan, portal tenant, dan portal admin.
 */
export function uniqueMonthLabels(labels: Array<string | null | undefined>): string[] {
  return [...new Set(labels.filter((l): l is string => !!l))].sort((a, b) => {
    const ka = monthKeyFromLabel(a);
    const kb = monthKeyFromLabel(b);
    return kb.localeCompare(ka);
  });
}

/**
 * Tanggal hari ini dalam zona waktu LOKAL sebagai "YYYY-MM-DD"
 * (aman untuk input type=date — toISOString() berbasis UTC bisa off-by-one).
 */
export function getTodayLocal(): string {
  return toDateKeyLocal(new Date());
}

/**
 * Format Date ke "YYYY-MM-DD" dalam zona waktu LOKAL.
 * Dipakai saat fallback ke createdAt (datetime) agar tidak bergeser sehari
 * akibat perbedaan UTC vs WIB.
 */
export function toDateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

/** URL file upload (bukti pembayaran / QRIS) — diserve langsung oleh Nginx di Production via path relatif /uploads/... */
export function assetUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return path.startsWith('/') ? path : `/${path}`;
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
