import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["query", "info", "warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalThis.__prismaClient ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalThis.__prismaClient = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  await pool.end();
}

/** Filter soft-delete generik — pakai di semua query Prisma. */
export const NOT_DELETED = { deletedAt: null } as const;
