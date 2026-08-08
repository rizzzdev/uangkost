import type { Request, Response } from "express";
import { asyncHandler } from "../../middlewares/error-handler.js";
import * as settingsService from "./settings.service.js";
import { ok } from "../../utils/response.js";
import { validate, updateSettingsSchema } from "../../utils/validation.js";
import { syncScheduleJobs } from "../scheduler/queue.js";

export const get = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const data = await settingsService.getSettings();
    ok(res, data);
  },
);

export const getPublicSettings = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const settings = await settingsService.getSettings();
    ok(res, {
      kostName: settings.kostName,
      bankAccountInfo: settings.bankAccountInfo,
      qrisImageUrl: settings.qrisImageUrl,
    });
  },
);

export const update = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const input = validate(updateSettingsSchema, req.body);
    const data = await settingsService.updateSettings(input);

    // Terapkan jadwal baru langsung tanpa restart server
    if (
      input.reminderTime !== undefined ||
      input.reminderFrequency !== undefined ||
      input.reminderWeekdays !== undefined ||
      input.reminderDates !== undefined ||
      input.billCreationTime !== undefined ||
      input.billCreationFrequency !== undefined ||
      input.billCreationWeekdays !== undefined ||
      input.billCreationDates !== undefined
    ) {
      try {
        await syncScheduleJobs();
      } catch (err) {
        console.error(
          "Gagal sinkronisasi jadwal scheduler:",
          (err as Error).message,
        );
      }
    }

    ok(res, data);
  },
);

const QRIS_ALLOWED_MIMETYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const uploadQrisImage = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: "File is required" });
      return;
    }
    if (!QRIS_ALLOWED_MIMETYPES.has(file.mimetype)) {
      res.status(400).json({ success: false, message: "QRIS harus berupa gambar (JPEG, PNG, atau WEBP)" });
      return;
    }
    const data = await settingsService.updateSettings({
      qrisImageUrl: `/uploads/${file.filename}`,
    });
    ok(res, data);
  },
);
