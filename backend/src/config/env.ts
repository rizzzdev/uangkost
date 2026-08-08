import "dotenv/config";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  DATABASE_URL: requireEnv("DATABASE_URL"),
  REDIS_URL: optionalEnv("REDIS_URL", "redis://localhost:6379"),
  PUBLIC_URL: optionalEnv("PUBLIC_URL", "http://localhost:4001"),
  PORT: parseInt(optionalEnv("PORT", "4000"), 10),
  NODE_ENV: optionalEnv("NODE_ENV", "development"),
  UPLOAD_DIR: optionalEnv("UPLOAD_DIR", "./uploads"),
  JWT_SECRET: requireEnv("JWT_SECRET"),
  SENTRI_API_KEY: optionalEnv(
    "SENTRI_API_KEY",
    "sk_dev_uangkost_change_me_123456",
  ),
  FONNTE_TOKEN: optionalEnv("FONNTE_TOKEN", ""),
  // Domain cookie bersama untuk production multi-subdomain (mis. "example.com")
  // dipakai frontend (uangkost.example.com) & API (api.uangkost.example.com).
  // Kosong = cookie host-only (cukup untuk development di localhost).
  COOKIE_DOMAIN: optionalEnv("COOKIE_DOMAIN", ""),
  // Lama berlaku link portal penghuni (hari) — raw token hanya valid dalam jendela ini
  PORTAL_TOKEN_TTL_DAYS: parseInt(optionalEnv("PORTAL_TOKEN_TTL_DAYS", "90"), 10),
  // Lama sesi cookie tenant (hari) — lebih pendek dari token, perpanjang lewat link lagi
  TENANT_SESSION_TTL_DAYS: parseInt(optionalEnv("TENANT_SESSION_TTL_DAYS", "30"), 10),
} as const;
