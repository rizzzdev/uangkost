import pg from "pg";
import { PostgresDialect } from "kysely";
import { createAuthExpress } from "sentri/express";
import { env } from "./env.js";

const { Pool } = pg;

export const auth = createAuthExpress({
  mode: "server",
  secret: env.JWT_SECRET,
  validRoles: ["admin"],
  validIdentifiers: ["username"],
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: env.DATABASE_URL }),
  }),
  apiKey: env.SENTRI_API_KEY,
  redisUrl: env.REDIS_URL,
  cookie: {
    name: "refresh_token",
    httpOnly: true,
    sameSite: "lax",
  },
  accessCookie: {
    name: "access_token",
    sameSite: "lax",
  },
  // Nonaktifkan rate limit di environment development agar mudah dites
  rateLimit: env.NODE_ENV === "development" ? false : undefined,
  logger: console,
});
