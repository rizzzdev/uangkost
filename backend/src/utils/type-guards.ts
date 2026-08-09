import { AppError } from "../middlewares/error-handler.js";

/** Type guard to check if an object is a standard JavaScript Error. */
export function isError(err: Error | AppError | unknown): err is Error {
  return err instanceof Error;
}

/** Type guard to check if an error is a custom AppError instance. */
export function isAppError(err: Error | AppError | unknown): err is AppError {
  return err instanceof AppError;
}

/** Type guard to check if an error is a Zod Error instance. */
export interface ZodLikeIssue {
  path: (string | number)[];
  message: string;
}

export interface ZodLikeError extends Error {
  issues: ZodLikeIssue[];
}

export function isZodError(err: Error | AppError | unknown): err is ZodLikeError {
  return (
    isError(err) &&
    "issues" in err &&
    Array.isArray((err as ZodLikeError).issues)
  );
}

/** Safely format any caught exception message without resorting to any/unknown. */
export function getErrorMessage(err: Error | AppError | unknown): string {
  if (isAppError(err)) return err.message;
  if (isError(err)) return err.message;
  if (typeof err === "string") return err;
  return "An unexpected error occurred";
}
