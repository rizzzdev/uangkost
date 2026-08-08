import { Router } from "express";
import { requireAdmin, requireTenant } from "../../middlewares/auth.js";
import * as ctrl from "./tenant.controller.js";

const router = Router();

// Login portal (publik): validasi token → rotate → set sesi cookie
router.post("/portal-login", ctrl.portalLogin);
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
