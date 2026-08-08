import { Worker } from "bullmq";
import { redis } from "../../config/redis.js";
import { env } from "../../config/env.js";
import { sendWaMessage, getWaState } from "./wa.client.js";
import { prisma } from "../../config/prisma.js";
import { formatBillingMonth, invalidateFinanceCache } from "../finance/finance.service.js";
import { issuePortalToken } from "../tenants/tenant.service.js";
import { WA_REMINDERS_QUEUE, syncScheduleJobs } from "./queue.js";

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
      return { sent: 0, failed: 0, total: 0 };
    }
  }

  const { connected } = getWaState();
  if (!connected) {
    console.warn("FONNTE_TOKEN tidak dikonfigurasi. Tidak bisa kirim WA.");
    return { sent: 0, failed: 0, total: 0 };
  }

  // Reminder tetap dikirim ke tagihan yang BELUM LUNAS — termasuk yang dicicil (partial),
  // selama masih ada sisa tagihan (totalPaid < amount).
  const unpaidBills = await prisma.transaction.findMany({
    where: {
      status: { in: ["unpaid", "partial"] },
      type: "income",
      deletedAt: null,
    },
    include: {
      user: true,
    },
  });

  if (unpaidBills.length === 0) {
    console.log("Scan: tidak ada tagihan unpaid/partial");
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

      console.log(`WA terkirim ke ${bill.user.name} (${bill.user.phone})`);
    } catch (err) {
      failed++;
      console.error(
        `Gagal kirim WA ke ${bill.user.name}:`,
        (err as Error).message,
      );
    }

    // Delay 2 detik antar pesan
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log(`Scan selesai: ${sent} terkirim, ${failed} gagal`);

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
    return { created: 0, tenants: 0, month: formatBillingMonth() };
  }

  const month = formatBillingMonth();

  const tenants = await prisma.user.findMany({
    where: { role: "tenant", isActive: true, deletedAt: null },
    select: { id: true },
  });

  const existing = await prisma.transaction.findMany({
    where: { type: "income", billingMonth: month, deletedAt: null },
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
  }

  console.log(`createMonthlyBills: ${data.length} tagihan dibuat untuk bulan ${month}`);
  return { created: data.length, tenants: tenants.length, month };
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

// Jadwal repeatable job kini dikelola dari pengaturan admin (lihat queue.ts).
// Terapkan jadwal saat server start — perubahan selanjutnya via endpoint settings.
void syncScheduleJobs().catch((err) =>
  console.error("[scheduler] gagal menerapkan jadwal:", (err as Error).message),
);

waWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

waWorker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});
