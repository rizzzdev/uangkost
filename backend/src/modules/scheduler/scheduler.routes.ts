import { Router, type Request, type Response } from "express";
import { requireAdmin } from "../../middlewares/auth.js";
import { env } from "../../config/env.js";
import { asyncHandler, errorMessage } from "../../middlewares/error-handler.js";
import { ok } from "../../utils/response.js";
import { prisma } from "../../config/prisma.js";
import { getWaState } from "./wa-client.js";
import { scanAndSendReminders, createMonthlyBills } from "./worker.js";

const router = Router();

router.get(
  "/wa/status",
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const state = getWaState();
    ok(res, { ...state, tokenSet: !!env.FONNTE_TOKEN });
  }),
);

router.post(
  "/scan-unpaid/trigger",
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      // Kirim langsung, tanpa queue — blocking sampai semua WA terkirim
      const result = await scanAndSendReminders({ isManual: true });
      ok(res, {
        message: `${result.sent} terkirim, ${result.failed} gagal dari ${result.total} tagihan`,
        ...result,
      });
    } catch (err) {
      console.error("[WA trigger] Fatal error:", errorMessage(err));
      throw err;
    }
  }),
);

router.post(
  "/create-bills/trigger",
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      const result = await createMonthlyBills();
      ok(res, {
        message: `${result.created} tagihan dibuat untuk bulan ${result.month} (${result.tenants} penghuni)`,
        ...result,
      });
    } catch (err) {
      console.error("[Create bills trigger] Fatal error:", errorMessage(err));
      throw err;
    }
  }),
);

/**
 * GET /api/scheduler/logs — Ambil riwayat log eksekusi scheduler (paginasi & filter).
 */
router.get(
  ["/logs", "/scheduler/logs"],
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "20", 10)));
    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;

    const where: { type?: "reminder" | "bill_creation"; status?: "success" | "failed" | "skipped" } = {};
    if (type === "reminder" || type === "bill_creation") {
      where.type = type;
    }
    if (status === "success" || status === "failed" || status === "skipped") {
      where.status = status;
    }

    const [total, logs] = await Promise.all([
      prisma.schedulerLog.count({ where }),
      prisma.schedulerLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    ok(res, {
      logs: logs.map((log) => ({
        ...log,
        details: typeof log.details === "string" ? JSON.parse(log.details) : log.details,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  }),
);

/**
 * DELETE /api/scheduler/logs — Hapus semua log scheduler.
 */
router.delete(
  ["/logs", "/scheduler/logs"],
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    await prisma.schedulerLog.deleteMany({});
    ok(res, { message: "Semua log penjadwalan otomatis telah dihapus" });
  }),
);

export const schedulerRoutes = router;
