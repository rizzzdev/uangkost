import { Router } from "express";
import { requireAdmin, requireTenant } from "../../middlewares/auth.js";
import { upload } from "../../middlewares/upload.js";
import * as ctrl from "./finance.controller.js";
import * as instCtrl from "./installment.controller.js";

const router = Router();

// --- Installment (cicilan) routes ---
// Daftarkan route dengan prefix tetap SEBELUM /:id agar tidak tertangkap sebagai id
router.get("/installments", requireAdmin, instCtrl.getAll);
router.post("/installments", requireAdmin, upload.single("paymentProof"), instCtrl.createByAdmin);
router.put("/installments/:installmentId", requireAdmin, instCtrl.update);
router.post("/installments/:installmentId/verify", requireAdmin, instCtrl.verify);
router.post("/installments/:installmentId/reject", requireAdmin, instCtrl.reject);
router.delete("/installments/:installmentId", requireAdmin, instCtrl.remove);

// --- Transaction routes ---
router.get("/", requireAdmin, ctrl.getAll);
router.get("/me", requireTenant, ctrl.getMe);
router.get("/summary", requireAdmin, ctrl.getSummary);
router.get("/chart-data", requireAdmin, ctrl.getChartData);
router.get("/monthly-report", requireAdmin, ctrl.getMonthlyReport);
router.get("/tenant-cashflow", requireTenant, ctrl.getPublicTenant);
router.get("/public-dashboard", ctrl.getPublicDashboard);
router.get("/:id/installments", requireAdmin, instCtrl.getByTransaction);
router.get("/:id", requireAdmin, ctrl.getById);
router.post("/", requireAdmin, ctrl.create);
router.post("/expense-with-proof", requireAdmin, upload.single("paymentProof"), ctrl.createWithProof);
router.put("/:id", requireAdmin, ctrl.update);
router.post("/:id/verify", requireAdmin, ctrl.verify);
router.post("/:id/reject", requireAdmin, ctrl.reject);
router.post("/:id/upload-proof", requireTenant, upload.single("paymentProof"), ctrl.uploadProof);
router.delete("/:id", requireAdmin, ctrl.remove);

// --- Installment tenant upload ---
router.post("/:id/installments", requireTenant, upload.single("paymentProof"), instCtrl.create);

export const financeRoutes = router;
