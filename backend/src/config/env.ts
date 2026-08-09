import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  PUBLIC_URL: z.string().default("http://localhost:4001"),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  UPLOAD_DIR: z.string().default("./uploads"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  SENTRI_API_KEY: z.string().default("sk_dev_uangkost_change_me_123456"),
  FONNTE_TOKEN: z.string().default(""),
  COOKIE_DOMAIN: z.string().default(""),
  PORTAL_TOKEN_TTL_DAYS: z.coerce.number().default(90),
  TENANT_SESSION_TTL_DAYS: z.coerce.number().default(30),
  TIMEZONE: z.string().default("Asia/Jakarta"),
});

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  PUBLIC_URL: process.env.PUBLIC_URL,
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  UPLOAD_DIR: process.env.UPLOAD_DIR,
  JWT_SECRET: process.env.JWT_SECRET,
  SENTRI_API_KEY: process.env.SENTRI_API_KEY,
  FONNTE_TOKEN: process.env.FONNTE_TOKEN,
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN ?? process.env.DOMAIN_NAME ?? "",
  PORTAL_TOKEN_TTL_DAYS: process.env.PORTAL_TOKEN_TTL_DAYS,
  TENANT_SESSION_TTL_DAYS: process.env.TENANT_SESSION_TTL_DAYS,
  TIMEZONE: process.env.TZ ?? "Asia/Jakarta",
});

if (!parsed.success) {
  console.error("❌ Invalid environment variables configuration:");
  for (const issue of parsed.error.issues) {
    console.error(` - ${issue.path.join(".")}: ${issue.message}`);
  }
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
