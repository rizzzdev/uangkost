import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { z } from "zod";
import { AppError } from "./error-handler.js";

/**
 * Express middleware helper to validate request body with Zod schema.
 * Type-safe without using any or unknown.
 */
export function validateBody<T>(schema: z.ZodSchema<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const messages = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      next(new AppError(`Validation error: ${messages}`, 400));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: z.ZodSchema<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const messages = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      next(new AppError(`Validation query error: ${messages}`, 400));
      return;
    }
    next();
  };
}
