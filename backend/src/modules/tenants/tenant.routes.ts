import { Router } from "express";
import { requireAdmin, requireTenant } from "../../middlewares/auth.js";
import { rateLimiter } from "../../middlewares/rate-limiter.js";
import * as ctrl from "./tenant.controller.js";

const router = Router();

// Rate limiter khusus endpoint login portal (maksimal 10 hit per 15 menit per IP)
const portalLoginLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  maxHits: 10,
  message: "Terlalu banyak percobaan masuk portal. Silakan coba lagi 15 menit kemudian.",
});

// Login portal (publik): validasi token + last4Phone → rotate → set sesi cookie
router.post("/portal-login", portalLoginLimiter, ctrl.portalLogin);
// Logout portal: bersihkan cookie sesi
router.post("/portal-logout", ctrl.portalLogout);
// Profil tenant via sesi cookie
router.get("/me", requireTenant, ctrl.me);

router.get("/", requireAdmin, ctrl.getAll);
router.get("/token/:token", ctrl.getByToken);
router.get("/:id", requireAdmin, ctrl.getById);
router.post("/", requireAdmin, ctrl.create);
router.put("/:id", requireAdmin, ctrl.update);
router.delete("/:id", requireAdmin, ctrl.remove);
router.post("/:id/regenerate-token", requireAdmin, ctrl.regenerateToken);

export const tenantRoutes = router;
