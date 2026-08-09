import type { Request, Response, NextFunction } from "express";
import type { ApiResponse } from "../types/index.js";
import { getErrorMessage, isAppError, isZodError } from "../utils/type-guards.js";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void fn(req, res, next).catch(next);
  };
}

export function errorMessage(err: Error | AppError | unknown): string {
  return getErrorMessage(err);
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response<ApiResponse<never>>,
  _next: NextFunction,
): void {
  if (isAppError(err)) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  if (isZodError(err)) {
    const formatted = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    res.status(400).json({
      success: false,
      message: `Validation error: ${formatted}`,
    });
    return;
  }

  const httpErr = err as HttpError;
  const status = httpErr.status ?? httpErr.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    res.status(status).json({
      success: false,
      message: err.message,
    });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}
