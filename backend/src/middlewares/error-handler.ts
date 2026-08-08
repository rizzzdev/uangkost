import type { Request, Response, NextFunction } from "express";
import type { ApiResponse } from "../types/index.js";

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

/** Error HTTP generik (mis. dari multer/zod/Sentri) yang membawa status opsional. */
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

/** Ambil pesan aman dari error tak dikenal (catch block dengan unknown). */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response<ApiResponse<never>>,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  const status = (err as HttpError).status ?? (err as HttpError).statusCode;
  if (typeof status === "number" && status >= 401 && status < 500) {
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
