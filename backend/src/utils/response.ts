import type { Response } from "express";
import type { ApiResponse } from "../types/index.js";

export function ok<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({ success: true, data } satisfies ApiResponse<T>);
}

export function created<T>(res: Response, data: T): void {
  ok(res, data, 201);
}

export function noContent(res: Response): void {
  res.status(204).send();
}
