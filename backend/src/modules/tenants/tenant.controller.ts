import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../../middlewares/error-handler.js";
import { env } from "../../config/env.js";
import * as tenantService from "./tenant.service.js";
import { param } from "../../utils/request.js";
import { ok, created } from "../../utils/response.js";
import { validate, createTenantSchema, updateTenantSchema } from "../../utils/validation.js";

const TENANT_SESSION_COOKIE = "tenant_session";

export const getAll = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const data = await tenantService.getAllTenants();
    ok(res, data);
  },
);

export const getById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = await tenantService.getTenantById(param(req, "id"));
    ok(res, data);
  },
);

export const getByToken = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = await tenantService.getTenantByToken(param(req, "token"));
    ok(res, data);
  },
);

export const create = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const input = validate(createTenantSchema, req.body);
    const data = await tenantService.createTenant(input);
    created(res, data);
  },
);

export const update = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const input = validate(updateTenantSchema, req.body);
    const data = await tenantService.updateTenant(param(req, "id"), input);
    ok(res, data);
  },
);

export const remove = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await tenantService.deleteTenant(param(req, "id"));
    ok(res, { deleted: true });
  },
);

export const regenerateToken = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = await tenantService.regenerateAccessToken(param(req, "id"));
    ok(res, data);
  },
);

/**
 * Login portal penghuni (magic link): validasi token RAW + last4Phone → rotate ke token baru →
 * set sesi cookie httpOnly. Token lama mati setelah dipakai (one-time entry).
 */
export const portalLogin = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const raw =
      (req.body?.token as string | undefined) ??
      (req.query.token as string | undefined);
    const last4Phone = req.body?.last4Phone as string | undefined;

    if (!raw) {
      res.status(401).json({ success: false, message: "Access token required" });
      return;
    }

    const { token, hash, user } = await tenantService.loginWithToken(raw, last4Phone);
    const session = jwt.sign(
      { sub: user.id, th: hash },
      env.JWT_SECRET,
      { expiresIn: env.TENANT_SESSION_TTL_DAYS * 24 * 60 * 60 },
    );

    res.cookie(TENANT_SESSION_COOKIE, session, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      maxAge: env.TENANT_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
      path: "/",
    });

    ok(res, { token, user });
  },
);

/**
 * Logout portal penghuni: bersihkan cookie sesi tenant_session.
 */
export const portalLogout = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    res.clearCookie(TENANT_SESSION_COOKIE, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
    });
    ok(res, { message: "Sesi portal berhasil diakhiri." });
  },
);

/** Profil tenant dari sesi cookie (tanpa perlu token di URL). */
export const me = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = await tenantService.getTenantById(req.tenantUser!.id);
    ok(res, data);
  },
);
