import { Router } from "express";
import { requireAdmin } from "../../middlewares/auth.js";
import { upload } from "../../middlewares/upload.js";
import * as ctrl from "./settings.controller.js";

const router = Router();

router.get("/", requireAdmin, ctrl.get);
router.get("/public", ctrl.getPublicSettings);
router.put("/", requireAdmin, ctrl.update);
router.post("/qris-image", requireAdmin, upload.single("qrisImage"), ctrl.uploadQrisImage);

export const settingsRoutes = router;
