import type { NextFunction, Request, Response } from "express";
import express from "express";
import cors from "cors";
import path from "node:path";
import { SentriError } from "sentri/core";
import { auth } from "./config/auth.js";
import { env } from "./config/env.js";
import { prisma, NOT_DELETED } from "./config/prisma.js";
import { AppError, asyncHandler, errorHandler } from "./middlewares/error-handler.js";
import { ensureUploadDir } from "./middlewares/upload.js";
import { optionalTenant, requireAdmin } from "./middlewares/auth.js";
import { tenantRoutes } from "./modules/tenants/tenant.routes.js";
import { financeRoutes } from "./modules/finance/finance.routes.js";
import { settingsRoutes } from "./modules/settings/settings.routes.js";
import { schedulerRoutes } from "./modules/scheduler/scheduler.routes.js";

const app = express();

await ensureUploadDir();

// --- Global Middleware ---
app.use(cors({ origin: env.PUBLIC_URL, credentials: true }));

// Body parsing for all JSON routes (Sentri requires express.json())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Tambahkan atribut Domain pada semua Set-Cookie ketika frontend & API berada di
 * subdomain berbeda (mis. uangkost.example.com & api.uangkost.example.com).
 * Sentri tidak mendukung opsi `domain` pada cookie config-nya, jadi atribut
 * disuntikkan langsung ke header lewat res.append (Express memakai append untuk
 * set/clear cookie). No-op di development (COOKIE_DOMAIN kosong → host-only).
 */
function withCookieDomain(): (req: Request, res: Response, next: NextFunction) => void {
  const rawDomain = env.COOKIE_DOMAIN.trim();
  if (!rawDomain) return (_req, _res, next) => next();
  const cookieDomain = rawDomain.replace(/^\./, "");

  /** Tambahkan atribut Domain bila belum ada (idempotent). */
  function ensureCookieDomain(cookie: string): string {
    return /;\s*domain=/i.test(cookie) ? cookie : `${cookie}; Domain=${cookieDomain}`;
  }

  return (_req, res, next) => {
    const originalAppend = res.append.bind(res) as Response["append"];
    res.append = ((field: string, value?: string | string[]) => {
      if (field.toLowerCase() === "set-cookie") {
        if (typeof value === "string") {
          value = ensureCookieDomain(value);
        } else if (Array.isArray(value)) {
          value = value.map(ensureCookieDomain);
        }
      }
      return originalAppend(field, value);
    }) as Response["append"];
    next();
  };
}

// Terapkan sebelum semua rute yang menetapkan cookie (auth, portal tenant, dll.)
app.use(withCookieDomain());

// --- Sentri Auth Server (server mode) ---
// Mounts: POST /register, /login, /refresh, /logout, GET /me, /me/identifiers, ...
app.use("/api/auth", auth.router());

// Admin profile endpoint (uses Sentri auth + Prisma users table for name/phone)
app.get(
  "/api/auth/profile",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Try to find admin in Prisma users table for extra profile data
    const user = await prisma.user.findFirst({
      where: { id: req.userId, ...NOT_DELETED },
      select: { id: true, name: true, phone: true, role: true },
    });

    // Fallback: return basic info from Sentri user
    res.json({
      success: true,
      data: user ?? {
        id: req.userId,
        name: req.user?.identifiers?.[0]?.value ?? "Admin",
        phone: null,
        role: "admin",
      },
    });
  }),
);

// Serve uploaded files statically
app.use("/uploads", express.static(path.resolve(env.UPLOAD_DIR)));

// Optional: Set tenant context dari token
app.use(optionalTenant);

// --- API Routes ---
app.use("/api/tenants", tenantRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api", schedulerRoutes);

// --- Health Check ---
app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "uangkost API is running" });
});

// --- Error Handler ---
app.use((err: unknown, _req: Request, _res: Response, next: NextFunction) => {
  if (err instanceof SentriError) {
    console.error("[SentriError]", err.message, "|", "status:", err.statusCode);
    next(new AppError(err.message, err.statusCode));
    return;
  }
  next(err);
});
app.use((err: unknown, _req: Request, _res: Response, next: NextFunction) => {
  if (err instanceof Error && !(err instanceof AppError)) {
    console.error("[UnhandledError]", err.message, err.stack?.split("\n").slice(0, 3).join("\n"));
  }
  next(err);
});
app.use(errorHandler);

export default app;