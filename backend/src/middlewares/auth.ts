import type { Request, RequestHandler, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { auth } from "../config/auth.js";
import { prisma, NOT_DELETED } from "../config/prisma.js";
import { env } from "../config/env.js";
import { findTenantByRawToken } from "../modules/tenants/tenant.service.js";
import { AppError, asyncHandler } from "./error-handler.js";

const TENANT_SESSION_COOKIE = "tenant_session";

/** Baca nilai cookie dari header (tanpa cookie-parser). */
function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

interface TenantSession {
  sub: string; // userId
  th: string; // accessTokenHash saat sesi dibuat — berubah bila admin regenerate
}

/** Verifikasi cookie sesi tenant (JWT httpOnly). Null bila tidak valid/kedaluwarsa. */
function parseTenantSession(header: string | undefined): TenantSession | null {
  const raw = readCookie(header, TENANT_SESSION_COOKIE);
  if (!raw) return null;
  try {
    const payload = jwt.verify(raw, env.JWT_SECRET);
    if (typeof payload === "object" && payload.sub && payload.th) {
      return { sub: payload.sub as string, th: payload.th as string };
    }
  } catch {
    // token tidak valid / kedaluwarsa
  }
  return null;
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      isAdmin?: boolean;
      tenantUser?: {
        id: string;
        name: string;
        phone: string | null;
        roomNumber: string | null;
      };
    }
  }
}

/**
 * Admin-only middleware.
 * Relies entirely on Sentri for authentication & authorization.
 * Sets req.userId and req.isAdmin from the verified JWT.
 */
export const requireAdmin: RequestHandler[] = [
  auth.protect(),
  auth.authorize("admin"),
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user?.id) {
      next(new AppError("Authentication required", 401));
      return;
    }

    req.userId = req.user.id;
    req.isAdmin = true;
    next();
  },
];

const TENANT_SELECT = {
  id: true,
  name: true,
  phone: true,
  roomNumber: true,
} as const;

/** Muat tenant dari sesi cookie (JWT) bila valid & hash masih cocok. */
async function loadTenantFromSession(
  req: Request,
): Promise<{ id: string; name: string; phone: string | null; roomNumber: string | null } | null> {
  const session = parseTenantSession(req.headers.cookie);
  if (!session) return null;

  return prisma.user.findFirst({
    where: {
      id: session.sub,
      role: "tenant",
      isActive: true,
      ...NOT_DELETED,
      accessTokenHash: session.th,
      // Sesi juga mati bila token portal sudah kedaluwarsa (anti konfigurasi TTL terbalik)
      accessTokenExpiresAt: { gt: new Date() },
    },
    select: TENANT_SELECT,
  });
}

export const optionalTenant = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // 1) Sesi cookie tenant
    const fromSession = await loadTenantFromSession(req);
    if (fromSession) {
      req.tenantUser = fromSession;
      next();
      return;
    }

    // 2) Token RAW (query / header) — hash lookup + cek kedaluwarsa
    const token =
      (req.query.token as string | undefined) ??
      (req.headers["x-tenant-token"] as string | undefined);

    if (token) {
      const tenant = await findTenantByRawToken(token);
      if (tenant) {
        req.tenantUser = {
          id: tenant.id,
          name: tenant.name,
          phone: tenant.phone,
          roomNumber: tenant.roomNumber,
        };
      }
    }

    next();
  },
);

export const requireTenant = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // 1) Sesi cookie tenant
    const fromSession = await loadTenantFromSession(req);
    if (fromSession) {
      req.tenantUser = fromSession;
      next();
      return;
    }

    // 2) Token RAW (param / query / header)
    const token =
      (req.params.token as string | undefined) ??
      (req.query.token as string | undefined) ??
      (req.headers["x-tenant-token"] as string | undefined);

    if (!token) {
      throw new AppError("Access token required", 401);
    }

    const tenant = await findTenantByRawToken(token);
    if (!tenant) {
      throw new AppError("Invalid or expired access token", 401);
    }

    req.tenantUser = {
      id: tenant.id,
      name: tenant.name,
      phone: tenant.phone,
      roomNumber: tenant.roomNumber,
    };
    next();
  },
);
