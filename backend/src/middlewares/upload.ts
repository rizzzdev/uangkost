import multer, { type FileFilterCallback } from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { env } from "../config/env.js";
import { AppError } from "./error-handler.js";
import type { Request } from "express";

const uploadDir = path.resolve(env.UPLOAD_DIR);

// Ensure upload directory exists — async init, call at startup
export async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
    cb(null, uploadDir);
  },
  filename(_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const ALLOWED_MIMETYPES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

/** MIME yang boleh untuk gambar QRIS (jalur khusus settings). */
export const QRIS_ALLOWED_MIMETYPES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/** URL publik file hasil upload dari middleware multer ini. */
export function resolveUploadUrl(filename: string): string {
  return `/uploads/${filename}`;
}

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void {
  if (ALLOWED_MIMETYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError("File type not allowed. Use JPEG, PNG, WEBP, or PDF.", 400));
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});
