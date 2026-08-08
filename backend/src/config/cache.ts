import { redis } from "./redis.js";

/** TTL default cache: 5 menit. */
export const CACHE_TTL = 300;

const PREFIX = "uangkost:";

export const CACHE_KEYS = {
  financeSummary: "finance:summary",
  financeChart: "finance:chart",
  publicDashboard: "finance:public-dashboard",
  tenantCashflow: (tenantId: string) => `finance:tenant-cashflow:${tenantId}`,
  financeTransactions: (query: string) => `finance:transactions:${query}`,
  financeTenantTransactions: (tenantId: string) => `finance:tenant-transactions:${tenantId}`,
  financeMonthlyReport: (monthKey: string) => `finance:monthly-report:${monthKey}`,
  settings: "settings",
  tenantsList: "tenants:list",
} as const;

/** Baca cache. Return undefined bila miss / Redis bermasalah. */
export async function cacheGet<T>(key: string): Promise<T | undefined> {
  try {
    const raw = await redis.get(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined; // Redis down — biarkan request lanjut ke DB
  }
}

/** Tulis cache dengan TTL. Gagal diam-diam bila Redis bermasalah. */
export async function cacheSet<T>(key: string, value: T, ttl = CACHE_TTL): Promise<void> {
  try {
    await redis.set(PREFIX + key, JSON.stringify(value), "EX", ttl);
  } catch {
    // Redis down — cache di-skip
  }
}

/** Hapus satu/beberapa key (prefix "uangkost:" otomatis ditambahkan). */
export async function cacheInvalidate(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    const full = keys.map((k) => PREFIX + k);
    await redis.del(...full);
  } catch {
    // Redis down — abaikan
  }
}

/**
 * Hapus key berdasarkan pola (mis. "finance:chart:*" via SCAN).
 * Berguna untuk menghapus cache per-entitas tanpa tahu id-nya.
 */
export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  try {
    const fullPattern = PREFIX + pattern;
    const stream = redis.scanStream({ match: fullPattern, count: 100 });
    for await (const keys of stream) {
      if (keys.length > 0) {
        await redis.del(...(keys as string[]));
      }
    }
  } catch {
    // Redis down — abaikan
  }
}

/**
 * Pattern helper: ambil dari cache, isi bila miss, return hasil.
 * Jika operasi Redis gagal, langsung delegasikan ke loader (fallback DB).
 */
export async function cached<T>(
  key: string,
  loader: () => Promise<T>,
  ttl = CACHE_TTL,
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== undefined) return hit;

  const value = await loader();
  await cacheSet(key, value, ttl);
  return value;
}
