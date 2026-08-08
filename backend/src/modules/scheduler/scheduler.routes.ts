import { Router, type Request, type Response } from "express";
import { requireAdmin } from "../../middlewares/auth.js";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../middlewares/error-handler.js";
import { ok } from "../../utils/response.js";
import { getWaState } from "./wa.client.js";
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
      console.error("[WA trigger] Fatal error:", (err as Error).message);
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
      console.error("[Create bills trigger] Fatal error:", (err as Error).message);
      throw err;
    }
  }),
);

export const schedulerRoutes = router;
