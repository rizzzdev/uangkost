import multer, { type FileFilterCallback } from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "./error-handler.js";
import type { Request } from "express";

const uploadDir = path.resolve(env.UPLOAD_DIR);

export async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(uploadDir, { recursive: true });
}

const ALLOWED_EXTENSIONS = new Set<string>([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);

const storage = multer.diskStorage({
  destination(_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
    cb(null, uploadDir);
  },
  filename(_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : ".bin";
    const uuid = crypto.randomUUID();
    cb(null, `${uuid}${safeExt}`);
  },
});

const ALLOWED_MIMETYPES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export const QRIS_ALLOWED_MIMETYPES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function resolveUploadUrl(filename: string): string {
  return `/uploads/${filename}`;
}

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void {
  const rawExt = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIMETYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(rawExt)) {
    cb(null, true);
  } else {
    cb(new AppError("Tipe file tidak diizinkan. Gunakan JPEG, PNG, WEBP, atau PDF.", 400));
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});
