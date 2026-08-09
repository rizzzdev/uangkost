import { Worker } from "bullmq";
import { redis } from "../../config/redis.js";
import { env } from "../../config/env.js";
import { sendWaMessage, getWaState } from "./wa-client.js";
import { prisma, NOT_DELETED } from "../../config/prisma.js";
import type { Prisma } from "@prisma/client";
import { errorMessage } from "../../middlewares/error-handler.js";
import { formatBillingMonth, invalidateFinanceCache } from "../finance/finance.service.js";
import { issuePortalToken } from "../tenants/tenant.service.js";
import { WA_REMINDERS_QUEUE, syncScheduleJobs } from "./queue.js";

/**
 * Catat aktivitas scheduler ke database (tabel scheduler_logs).
 */
export async function recordSchedulerLog(input: {
  type: "reminder" | "bill_creation";
  status: "success" | "failed" | "skipped";
  title: string;
  message: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.schedulerLog.create({
      data: {
        type: input.type,
        status: input.status,
        title: input.title,
        message: input.message,
        details: input.details ? (input.details as Prisma.InputJsonObject) : undefined,
      },
    });
  } catch (err) {
    console.error("Gagal mencatat scheduler log:", errorMessage(err));
  }
}

/**
 * Scan unpaid bills and send WA reminders.
 * Used by both manual trigger (direct API) and scheduled worker.
 */
export async function scanAndSendReminders(opts?: {
  isManual?: boolean;
}): Promise<{ sent: number; failed: number; total: number }> {
  const { isManual = false } = opts ?? {};

  const settings = await prisma.systemSetting.findFirst({
    where: { id: 1 },
    select: { botWaStatus: true, kostName: true },
  });

  if (!isManual) {
    if (!settings?.botWaStatus) {
      console.log("Scan skipped: notifikasi WA nonaktif");
      await recordSchedulerLog({
        type: "reminder",
        status: "skipped",
        title: "Pengingat WA Dilewati",
        message: "Scan pengingat WA otomatis dilewati karena notifikasi WA dinonaktifkan di pengaturan.",
      });
      return { sent: 0, failed: 0, total: 0 };
    }
  }

  const { connected } = getWaState();
  if (!connected) {
    console.warn("FONNTE_TOKEN tidak dikonfigurasi. Tidak bisa kirim WA.");
    await recordSchedulerLog({
      type: "reminder",
      status: "skipped",
      title: "Pengingat WA Dilewati",
      message: "Gagal memproses pengingat WA: Token Fonnte belum dikonfigurasi atau tidak terhubung.",
    });
    return { sent: 0, failed: 0, total: 0 };
  }

  // Reminder tetap dikirim ke tagihan yang BELUM LUNAS — termasuk yang dicicil (partial),
  // selama masih ada sisa tagihan (totalPaid < amount).
  const unpaidBills = await prisma.transaction.findMany({
    where: {
      status: { in: ["unpaid", "partial"] },
      type: "income",
      ...NOT_DELETED,
    },
    include: {
      user: true,
    },
  });

  if (unpaidBills.length === 0) {
    console.log("Scan: tidak ada tagihan unpaid/partial");
    await recordSchedulerLog({
      type: "reminder",
      status: "skipped",
      title: "Pengingat WA Selesai",
      message: "Scan pengingat WA selesai: tidak ada tagihan belum lunas (unpaid/partial).",
    });
    return { sent: 0, failed: 0, total: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const bill of unpaidBills) {
    if (!bill.user?.phone) {
      continue;
    }

    // Jaga-jaga: lewati bila sisa tagihan sudah tidak ada (defensif)
    const remaining = Number(bill.amount) - Number(bill.totalPaid);
    if (remaining <= 0) {
      continue;
    }

    // Terbitkan token portal SEGAR per pengiriman (rotate) — link lama mati,
    // dan tiap reminder punya link unik dengan masa berlaku baru.
    const portalLink = `${env.PUBLIC_URL}/portal/${await issuePortalToken(bill.user.id)}`;
    const reportLink = `${env.PUBLIC_URL}/reports`;
    const kostName = settings?.kostName ?? null;
    const paidNote =
      Number(bill.totalPaid) > 0
        ? ` (dari total Rp${Number(bill.amount).toLocaleString("id-ID")})`
        : "";
    const message =
      `Halo ${bill.user.name},\n` +
      `${kostName ? `Tagihan ${kostName} bulan ${bill.billingMonth ?? "ini"}` : `Tagihan kost bulan ${bill.billingMonth ?? "ini"}`} belum lunas.\n\n` +
      `Sisa tagihan yang harus dibayar: Rp${remaining.toLocaleString("id-ID")}${paidNote}.\n\n` +
      `Cek detail & unggah bukti transfer di sini:\n\n${portalLink}\n\n` +
      `Lihat laporan keuangan kost di sini:\n\n${reportLink}`;

    console.log(`[WA] Mengirim ke ${bill.user.name} (${bill.user.phone})...`);
    try {
      await sendWaMessage(bill.user.phone!, message, portalLink);
      sent++;

      await prisma.transaction.update({
        where: { id: bill.id },
        data: { waNotifiedAt: new Date() },
      });

      await recordSchedulerLog({
        type: "reminder",
        status: "success",
        title: "Pengingat WA Terkirim",
        message: `Berhasil mengirim pengingat WA ke ${bill.user.name} (${bill.user.phone}) untuk tagihan bulan ${bill.billingMonth ?? "ini"}.`,
        details: {
          userId: bill.user.id,
          name: bill.user.name,
          phone: bill.user.phone,
          amount: Number(bill.amount),
          remaining,
          isManual,
        },
      });

      console.log(`WA terkirim ke ${bill.user.name} (${bill.user.phone})`);
    } catch (err) {
      failed++;
      const errText = errorMessage(err);
      await recordSchedulerLog({
        type: "reminder",
        status: "failed",
        title: "Pengingat WA Gagal",
        message: `Gagal mengirim pengingat WA ke ${bill.user.name} (${bill.user.phone}): ${errText}`,
        details: {
          userId: bill.user.id,
          name: bill.user.name,
          phone: bill.user.phone,
          error: errText,
          isManual,
        },
      });

      console.error(
        `Gagal kirim WA ke ${bill.user.name}:`,
        errText,
      );
    }

    // Delay 2 detik antar pesan
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log(`Scan selesai: ${sent} terkirim, ${failed} gagal`);

  await recordSchedulerLog({
    type: "reminder",
    status: failed > 0 ? "failed" : "success",
    title: isManual ? "Trigger Pengingat WA Manual" : "Pengingat WA Otomatis Selesai",
    message: `Proses pengingat WA selesai: ${sent} terkirim, ${failed} gagal dari total ${unpaidBills.length} tagihan.`,
    details: { sent, failed, total: unpaidBills.length, isManual },
  });

  // waNotifiedAt ikut berubah — bersihkan cache agar daftar tagihan tidak basi
  if (sent > 0) {
    await invalidateFinanceCache();
  }

  return { sent, failed, total: unpaidBills.length };
}

/**
 * Buat tagihan bulanan otomatis untuk semua penghuni aktif yang belum punya
 * tagihan pada bulan berjalan. Nominal dari pengaturan "Tagihan Default".
 * Idempotent — aman dijalankan setiap hari.
 */
export async function createMonthlyBills(): Promise<{
  created: number;
  tenants: number;
  month: string;
}> {
  const settings = await prisma.systemSetting.findFirst({
    where: { id: 1 },
    select: { defaultBillAmount: true },
  });

  const amount = settings?.defaultBillAmount;
  if (amount === null || amount === undefined || Number(amount) <= 0) {
    console.log("createMonthlyBills: tagihan default belum diset, dilewati");
    await recordSchedulerLog({
      type: "bill_creation",
      status: "skipped",
      title: "Pembuatan Tagihan Dilewati",
      message: "Pembuatan tagihan bulanan otomatis dilewati karena nominal tagihan default belum diatur di pengaturan.",
    });
    return { created: 0, tenants: 0, month: formatBillingMonth() };
  }

  const month = formatBillingMonth();

  try {
    const tenants = await prisma.user.findMany({
      where: { role: "tenant", isActive: true, ...NOT_DELETED },
      select: { id: true },
    });

    const existing = await prisma.transaction.findMany({
      where: { type: "income", billingMonth: month, ...NOT_DELETED },
      select: { userId: true },
    });
    const existingUserIds = new Set(
      existing.map((e) => e.userId).filter((id): id is string => !!id),
    );

    const data = tenants
      .filter((t) => !existingUserIds.has(t.id))
      .map((t) => ({
        userId: t.id,
        type: "income" as const,
        amount,
        billingMonth: month,
        category: "Iuran Bulanan",
        description: "Iuran Bulanan",
        transactionDate: new Date(),
      }));

    if (data.length > 0) {
      await prisma.transaction.createMany({ data });
      await invalidateFinanceCache();

      await recordSchedulerLog({
        type: "bill_creation",
        status: "success",
        title: "Tagihan Bulanan Dibuat",
        message: `Berhasil membuat ${data.length} tagihan bulanan baru untuk bulan ${month} (total ${tenants.length} penghuni aktif).`,
        details: { createdCount: data.length, totalTenants: tenants.length, month, amount: Number(amount) },
      });
    } else {
      await recordSchedulerLog({
        type: "bill_creation",
        status: "success",
        title: "Tagihan Bulanan Sudah Ada",
        message: `Semua ${tenants.length} penghuni aktif sudah memiliki tagihan untuk bulan ${month}. Tidak ada tagihan baru yang dibuat.`,
        details: { createdCount: 0, totalTenants: tenants.length, month },
      });
    }

    console.log(`createMonthlyBills: ${data.length} tagihan dibuat untuk bulan ${month}`);
    return { created: data.length, tenants: tenants.length, month };
  } catch (err) {
    const errText = errorMessage(err);
    await recordSchedulerLog({
      type: "bill_creation",
      status: "failed",
      title: "Pembuatan Tagihan Gagal",
      message: `Gagal membuat tagihan bulanan otomatis: ${errText}`,
      details: { error: errText },
    });
    throw err;
  }
}

// Worker for scheduled cron jobs only
export const waWorker = new Worker(
  WA_REMINDERS_QUEUE,
  async (job) => {
    if (job.name === "scan-unpaid-tenants") {
      await scanAndSendReminders({ isManual: false });
    } else if (job.name === "create-monthly-bills") {
      await createMonthlyBills();
    }
  },
  { connection: redis },
);

// Terapkan jadwal saat server start dengan retry otomatis bila DB/Redis masih booting
async function initSchedulerWithRetry(retries = 5, delayMs = 3000): Promise<void> {
  for (let i = 1; i <= retries; i++) {
    try {
      await syncScheduleJobs();
      return;
    } catch (err) {
      console.warn(
        `[scheduler] Percobaan ${i}/${retries} gagal menerapkan jadwal:`,
        errorMessage(err),
      );
      if (i < retries) await new Promise((res) => setTimeout(res, delayMs));
    }
  }
}
void initSchedulerWithRetry();

waWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

waWorker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});
