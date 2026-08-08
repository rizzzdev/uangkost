import type { Request, Response } from "express";
import { asyncHandler } from "../../middlewares/error-handler.js";
import * as financeService from "./finance.service.js";
import { param, queryStr } from "../../utils/request.js";
import { ok, created } from "../../utils/response.js";
import { validate, createTransactionSchema, updateTransactionSchema } from "../../utils/validation.js";
import type { TransactionFilterQuery } from "../../types/index.js";

export const getAll = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const rawLimit = queryStr(req, "limit");
    const parsedLimit = rawLimit ? Number(rawLimit) : NaN;
    const filter: TransactionFilterQuery = {
      start_date: queryStr(req, "start_date"),
      end_date: queryStr(req, "end_date"),
      type: queryStr(req, "type") as TransactionFilterQuery["type"],
      status: queryStr(req, "status") as TransactionFilterQuery["status"],
      category: queryStr(req, "category"),
      userId: queryStr(req, "userId"),
      limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.floor(parsedLimit) : undefined,
    };
    const data = await financeService.getTransactions(filter);
    ok(res, data);
  },
);

export const getMe = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenantUser!.id;
    const data = await financeService.getTransactionsByTenant(tenantId);
    ok(res, data);
  },
);

export const getById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = await financeService.getTransactionById(param(req, "id"));
    ok(res, data);
  },
);

export const create = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const input = validate(createTransactionSchema, req.body);
    const data = await financeService.createTransaction(input);
    created(res, data);
  },
);

export const createWithProof = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    // Parse amount/description from FormData or JSON body
    const body = req.body as Record<string, string>;
    const input = validate(createTransactionSchema, {
      userId: body.userId,
      type: body.type || "expense",
      amount: Number(body.amount),
      category: body.category,
      description: body.description,
      billingMonth: body.billingMonth,
      transactionDate: body.transactionDate,
    });
    const proofFile = req.file?.filename ? `/uploads/${req.file.filename}` : undefined;
    
    // Create first, then attach proof
    const tx = await financeService.createTransaction(input);
    if (proofFile) {
      const updated = await financeService.updateTransaction(tx.id, { paymentProofUrl: proofFile });
      created(res, updated);
    } else {
      created(res, tx);
    }
  },
);

export const update = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const input = validate(updateTransactionSchema, req.body);
    const data = await financeService.updateTransaction(param(req, "id"), input);
    ok(res, data);
  },
);

export const verify = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = await financeService.verifyTransaction(param(req, "id"));
    ok(res, data);
  },
);

export const reject = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = await financeService.rejectTransaction(param(req, "id"));
    ok(res, data);
  },
);

export const uploadProof = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const filename = req.file?.filename;
    if (!filename) {
      res.status(400).json({ success: false, message: "File is required" });
      return;
    }
    const data = await financeService.uploadPaymentProof(
      param(req, "id"),
      `/uploads/${filename}`,
      req.tenantUser?.id,
    );
    ok(res, data);
  },
);

export const getSummary = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const data = await financeService.getFinanceSummary();
    ok(res, data);
  },
);

export const getChartData = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const data = await financeService.getChartData();
    ok(res, data);
  },
);

export const getMonthlyReport = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const month = queryStr(req, "month") || undefined;
    const data = await financeService.getMonthlyReport(month);
    ok(res, data);
  },
);

export const remove = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await financeService.deleteTransaction(param(req, "id"));
    ok(res, { deleted: true });
  },
);

export const getPublicTenant = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenantUser!.id;
    const data = await financeService.getPublicTenantTransactions(tenantId);
    ok(res, data);
  },
);

export const getPublicDashboard = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const data = await financeService.getPublicDashboard();
    ok(res, data);
  },
);
