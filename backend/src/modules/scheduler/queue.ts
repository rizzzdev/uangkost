import { Queue } from "bullmq";
import { redis } from "../../config/redis.js";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";

export const WA_REMINDERS_QUEUE = "wa-reminders";

export const waQueue = new Queue(WA_REMINDERS_QUEUE, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export function toCronPattern(
  frequency: string,
  hhmm: string,
  weekdays?: string | null,
  dates?: string | null,
): string {
  const [h, m] = hhmm.split(":").map(Number);
  const safeH = Number.isFinite(h) ? h! : 0;
  const safeM = Number.isFinite(m) ? m! : 0;
  switch (frequency) {
    case "weekly": {
      const days = (weekdays ?? "1")
        .split(",")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
        .map((n) => String((n + 6) % 7 + 1));
      const safe = days.length ? days.join(",") : "1";
      return `${safeM} ${safeH} * * ${safe}`;
    }
    case "monthly": {
      const days = (dates ?? "1")
        .split(",")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 31)
        .sort((a, b) => a - b);
      const safe = days.length ? days.join(",") : "1";
      return `${safeM} ${safeH} ${safe} * *`;
    }
    default:
      return `${safeM} ${safeH} * * *`;
  }
}

export const DEFAULT_SCHEDULES = {
  reminderFrequency: "daily",
  reminderTime: "08:00",
  reminderWeekdays: "1",
  reminderDates: "1",
  billCreationFrequency: "daily",
  billCreationTime: "00:05",
  billCreationWeekdays: "1",
  billCreationDates: "1",
} as const;

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
      repeat: {
        pattern: reminderPattern,
        tz: env.TIMEZONE,
      },
      jobId: "daily-unpaid-scan",
    },
  );

  await waQueue.add(
    "create-monthly-bills",
    { manual: false },
    {
      repeat: {
        pattern: billPattern,
        tz: env.TIMEZONE,
      },
      jobId: "monthly-bill-creation",
    },
  );

  console.log(
    `[scheduler] jadwal diterapkan: reminder WA ${reminderPattern} | tagihan otomatis ${billPattern}`,
  );
}
