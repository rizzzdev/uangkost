import { Queue } from "bullmq";
import { redis } from "../../config/redis.js";
import { prisma } from "../../config/prisma.js";

export const WA_REMINDERS_QUEUE = "wa-reminders";

export const waQueue = new Queue(WA_REMINDERS_QUEUE, {
  connection: redis,
});

/**
 * Konversi periode + "HH:MM" + hari/tanggal → cron 5-bagian.
 * - daily   → setiap hari (argumen hari/tanggal diabaikan)
 * - weekly  → hari-hari pilihan (weekdays, 0=Minggu..6=Sabtu; default: Senin)
 * - monthly → tanggal pilihan (dates 1..31; default: 1)
 */
export function toCronPattern(
  frequency: string,
  hhmm: string,
  weekdays?: string | null,
  dates?: string | null,
): string {
  const [h, m] = hhmm.split(":").map(Number);
  const safeH = Number.isFinite(h) ? h : 0;
  const safeM = Number.isFinite(m) ? m : 0;
  switch (frequency) {
    case "weekly": {
      // 0=Minggu..6=Sabtu → cron 1=Senin..7=Minggu; buang nilai di luar rentang
      const days = (weekdays ?? "1")
        .split(",")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
        .map((n) => String((n + 6) % 7 + 1));
      const safe = days.length ? days.join(",") : "1";
      return `${safeM} ${safeH} * * ${safe}`;
    }
    case "monthly": {
      // tanggal 1..31; buang nilai di luar rentang agar croniter tidak error
      const days = (dates ?? "1")
        .split(",")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 31)
        .sort((a, b) => a - b);
      const safe = days.length ? days.join(",") : "1";
      return `${safeM} ${safeH} ${safe} * *`;
    }
    default:
      return `${safeM} ${safeH} * * *`; // daily
  }
}

/** Default jadwal bila admin belum menyetel. */
export const DEFAULT_SCHEDULES = {
  reminderFrequency: "daily",
  reminderTime: "08:00",
  reminderWeekdays: "1", // Senin
  reminderDates: "1",
  billCreationFrequency: "daily",
  billCreationTime: "00:05",
  billCreationWeekdays: "1",
  billCreationDates: "1",
} as const;

/**
 * Sinkronkan jadwal repeatable job dengan pengaturan admin.
 * Dipanggil saat server start & setiap kali admin mengubah jadwal.
 */
export async function syncScheduleJobs(): Promise<void> {
  const settings = await prisma.systemSetting.findFirst({ where: { id: 1 } });
  const reminderPattern = toCronPattern(
    settings?.reminderFrequency ?? DEFAULT_SCHEDULES.reminderFrequency,
    settings?.reminderTime ?? DEFAULT_SCHEDULES.reminderTime,
    settings?.reminderWeekdays ?? DEFAULT_SCHEDULES.reminderWeekdays,
    settings?.reminderDates ?? DEFAULT_SCHEDULES.reminderDates,
  );
  const billPattern = toCronPattern(
    settings?.billCreationFrequency ?? DEFAULT_SCHEDULES.billCreationFrequency,
    settings?.billCreationTime ?? DEFAULT_SCHEDULES.billCreationTime,
    settings?.billCreationWeekdays ?? DEFAULT_SCHEDULES.billCreationWeekdays,
    settings?.billCreationDates ?? DEFAULT_SCHEDULES.billCreationDates,
  );

  // Hapus job lama agar perubahan jadwal langsung berlaku (tanpa restart)
  const jobs = await waQueue.getRepeatableJobs();
  for (const job of jobs) {
    if (job.id === "daily-unpaid-scan" || job.id === "monthly-bill-creation") {
      await waQueue.removeRepeatableByKey(job.key);
    }
  }

  await waQueue.add(
    "scan-unpaid-tenants",
    { manual: false },
    {
      repeat: { pattern: reminderPattern },
      jobId: "daily-unpaid-scan",
      removeOnComplete: true,
      removeOnFail: true,
    },
  );

  await waQueue.add(
    "create-monthly-bills",
    { manual: false },
    {
      repeat: { pattern: billPattern },
      jobId: "monthly-bill-creation",
      removeOnComplete: true,
      removeOnFail: true,
    },
  );

  console.log(
    `[scheduler] jadwal diterapkan: reminder WA ${reminderPattern} | tagihan otomatis ${billPattern}`,
  );
}
