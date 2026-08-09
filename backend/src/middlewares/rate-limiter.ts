import type { Request, Response, NextFunction, RequestHandler } from "express";
import { AppError } from "./error-handler.js";

interface RateLimitStore {
  hits: number;
  resetTime: number;
}

/**
 * In-memory rate limiter middleware sederhana untuk membatasi endpoint sensitif.
 */
export function rateLimiter(options: {
  windowMs: number;
  maxHits: number;
  message?: string;
}): RequestHandler {
  const store = new Map<string, RateLimitStore>();

  // Bersihkan entry tua setiap 5 menit agar memori hemat
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(ip);
      }
    }
  }, 5 * 60 * 1000);

  return (req: Request, _res: Response, next: NextFunction): void => {
    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
      req.ip ??
      "unknown_ip";

    const now = Date.now();
    const record = store.get(ip);

    if (!record || now > record.resetTime) {
      store.set(ip, {
        hits: 1,
        resetTime: now + options.windowMs,
      });
      next();
      return;
    }

    if (record.hits >= options.maxHits) {
      next(
        new AppError(
          options.message ?? "Terlalu banyak percobaan. Silakan coba lagi nanti.",
          429,
        ),
      );
      return;
    }

    record.hits += 1;
    next();
  };
}
