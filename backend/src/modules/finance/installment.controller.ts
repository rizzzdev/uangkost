import type { Request, Response } from "express";
import { asyncHandler } from "../../middlewares/error-handler.js";
import * as svc from "./installment.service.js";
import { param } from "../../utils/request.js";
import { ok, created } from "../../utils/response.js";
import { validate, createInstallmentSchema, createInstallmentByAdminSchema, updateInstallmentSchema } from "../../utils/validation.js";

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = validate(createInstallmentSchema, req.body);
  const proofFile = req.file?.filename ? `/uploads/${req.file.filename}` : undefined;
  const data = await svc.createInstallment(param(req, "id"), input, proofFile);
  created(res, data);
});

export const getAll = asyncHandler(async (_req: Request, res: Response) => {
  const data = await svc.getAllInstallments();
  ok(res, data);
});

export const createByAdmin = asyncHandler(async (req: Request, res: Response) => {
  const input = validate(createInstallmentByAdminSchema, req.body);
  const proofFile = req.file?.filename ? `/uploads/${req.file.filename}` : undefined;
  const data = await svc.createInstallmentByAdmin(input.transactionId, input, proofFile);
  created(res, data);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const input = validate(updateInstallmentSchema, req.body);
  const data = await svc.updateInstallment(param(req, "installmentId"), input);
  ok(res, data);
});

export const verify = asyncHandler(async (req: Request, res: Response) => {
  const data = await svc.verifyInstallment(param(req, "installmentId"));
  ok(res, data);
});

export const reject = asyncHandler(async (req: Request, res: Response) => {
  const data = await svc.rejectInstallment(param(req, "installmentId"));
  ok(res, data);
});

export const getByTransaction = asyncHandler(async (req: Request, res: Response) => {
  const data = await svc.getInstallments(param(req, "id"));
  ok(res, data);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await svc.deleteInstallment(param(req, "installmentId"));
  ok(res, { deleted: true });
});
