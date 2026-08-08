import type { Request } from "express";

/**
 * Ekstrak route parameter sebagai string dari Express 5 Request.
 * Express 5 mengembalikan string | string[], ini memastikan kita selalu dapat string.
 */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

/**
 * Ekstrak query parameter sebagai string dari Express 5 Request.
 */
export function queryStr(
  req: Request,
  name: string,
): string | undefined {
  const value = req.query[name];
  if (Array.isArray(value)) {
    return value[0] as string | undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}
