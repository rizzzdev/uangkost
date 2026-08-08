import { prisma } from "../../config/prisma.js";
import { cached, cacheInvalidate, CACHE_KEYS } from "../../config/cache.js";
import type { SystemSetting } from "@prisma/client";
import type { UpdateSettingsInput, SettingsResponse } from "../../types/index.js";

function toSettingsResponse(settings: SystemSetting): SettingsResponse {
  return {
    id: settings.id,
    kostName: settings.kostName,
    bankAccountInfo: settings.bankAccountInfo,
    qrisImageUrl: settings.qrisImageUrl,
    botWaStatus: settings.botWaStatus,
    defaultBillAmount:
      settings.defaultBillAmount === null ? null : Number(settings.defaultBillAmount),
    reminderTime: settings.reminderTime,
    reminderFrequency: settings.reminderFrequency,
    reminderWeekdays: settings.reminderWeekdays,
    reminderDates: settings.reminderDates,
    billCreationTime: settings.billCreationTime,
    billCreationFrequency: settings.billCreationFrequency,
    billCreationWeekdays: settings.billCreationWeekdays,
    billCreationDates: settings.billCreationDates,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
}

const DEFAULT_SETTINGS_ID = 1;

async function getOrCreateSettings(): Promise<SystemSetting> {
  let settings = await prisma.systemSetting.findFirst({
    where: { id: DEFAULT_SETTINGS_ID },
  });

  if (!settings) {
    settings = await prisma.systemSetting.create({
      data: { id: DEFAULT_SETTINGS_ID },
    });
  }

  return settings;
}

export async function getSettings(): Promise<SettingsResponse> {
  return cached(CACHE_KEYS.settings, async () => {
    const settings = await getOrCreateSettings();
    return toSettingsResponse(settings);
  });
}

export async function updateSettings(
  input: UpdateSettingsInput,
): Promise<SettingsResponse> {
  await getOrCreateSettings();

  const settings = await prisma.systemSetting.update({
    where: { id: DEFAULT_SETTINGS_ID },
    data: {
      ...(input.kostName !== undefined && { kostName: input.kostName }),
      ...(input.bankAccountInfo !== undefined && {
        bankAccountInfo: input.bankAccountInfo,
      }),
      ...(input.qrisImageUrl !== undefined && {
        qrisImageUrl: input.qrisImageUrl,
      }),
      ...(input.botWaStatus !== undefined && {
        botWaStatus: input.botWaStatus,
      }),
      ...(input.defaultBillAmount !== undefined && {
        defaultBillAmount: input.defaultBillAmount,
      }),
      ...(input.reminderTime !== undefined && {
        reminderTime: input.reminderTime,
      }),
      ...(input.reminderFrequency !== undefined && {
        reminderFrequency: input.reminderFrequency,
      }),
      ...(input.reminderWeekdays !== undefined && {
        reminderWeekdays: input.reminderWeekdays,
      }),
      ...(input.reminderDates !== undefined && {
        reminderDates: input.reminderDates,
      }),
      ...(input.billCreationTime !== undefined && {
        billCreationTime: input.billCreationTime,
      }),
      ...(input.billCreationFrequency !== undefined && {
        billCreationFrequency: input.billCreationFrequency,
      }),
      ...(input.billCreationWeekdays !== undefined && {
        billCreationWeekdays: input.billCreationWeekdays,
      }),
      ...(input.billCreationDates !== undefined && {
        billCreationDates: input.billCreationDates,
      }),
    },
  });

  await cacheInvalidate(CACHE_KEYS.settings); // SEBELUM respons — refetch client selalu dapat data segar
  return toSettingsResponse(settings);
}
