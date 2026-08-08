<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { getDashboardFeature, getFinanceFeature } from '$lib/features/index.js';
  import {
    Button,
    Card,
    Chart,
    Icon,
    Badge,
    MonthFilter,
    PaymentStatusTable,
    buildCashflowBarData,
    buildMonthlyDoughnutData
  } from '$lib/ui/index.js';
  import { toast } from '$lib/ui/molecules/toast-store.svelte.js';
  import {
    formatRupiahDisplay,
    formatBillingMonth,
    billingStatusMeta,
    useIsMobile
  } from '$lib/core/index.js';
  import type {
    ChartData,
    PublicDashboardTenantStatus
  } from '$lib/features/finance/index.svelte.js';
  import type { Transaction } from '$lib/features/finance/types.js';

  const dash = getDashboardFeature();
  const fin = getFinanceFeature();

  let chartData = $state<ChartData | null>(null);
  let recentIncome = $state<Transaction[]>([]);
  let recentExpenses = $state<Transaction[]>([]);
  let tenantStatuses = $state<PublicDashboardTenantStatus[]>([]);

  // --- Laporan Bulanan (PDF) ---
  const monthOptions = (() => {
    const now = new Date();
    const labels: string[] = [];
    const keys: string[] = [];
    for (let i = 0; i < 36; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(formatBillingMonth(d));
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return { labels, keys };
  })();

  let selectedMonth = $state(formatBillingMonth());
  let exporting = $state(false);

  async function handleExportPdf() {
    if (!selectedMonth) {
      toast.warning('Pilih bulan laporan dulu');
      return;
    }
    const idx = monthOptions.labels.indexOf(selectedMonth);
    const monthKey = idx >= 0 ? monthOptions.keys[idx]! : selectedMonth;
    exporting = true;
    try {
      const report = await fin.getMonthlyReport(monthKey);
      // Lazy import — jspdf tidak ikut bundle SSR, hanya dimuat saat export
      const { downloadMonthlyReportPdf } = await import('$lib/core/pdf-report.js');
      downloadMonthlyReportPdf(report);
      toast.success(`Laporan ${report.month} berhasil diunduh`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat PDF');
    } finally {
      exporting = false;
    }
  }

  onMount(async () => {
    await Promise.all([
      dash.load(),
      loadCharts(),
      loadRecentIncome(),
      loadRecentExpenses(),
      loadTenantStatuses()
    ]);
  });

  async function loadTenantStatuses() {
    try {
      const pd = await fin.getPublicDashboard();
      tenantStatuses = pd.tenants;
    } catch {
      /* silent */
    }
  }

  async function loadCharts() {
    try {
      chartData = await fin.getChartData();
    } catch {
      /* silent */
    }
  }

  async function loadRecentIncome() {
    try {
      recentIncome = await fin.getRecentIncome(5);
    } catch {
      /* silent */
    }
  }

  async function loadRecentExpenses() {
    try {
      recentExpenses = await fin.getRecentExpenses(5);
    } catch {
      /* silent */
    }
  }

  const isMobile = useIsMobile();

  // Bar chart 7 hari (3 di mobile) + doughnut bulan ini — dibagi dengan halaman reports
  const barData = $derived(buildCashflowBarData(chartData?.daily ?? [], isMobile.value));
  const doughnutData = $derived(
    buildMonthlyDoughnutData(chartData?.monthlyIncome ?? 0, chartData?.monthlyExpense ?? 0)
  );
</script>

<svelte:head>
  <title>uangkost — Dashboard</title>
</svelte:head>

<div class="space-y-6">
  <div>
    <h1 class="headline-lg text-text-primary">Dashboard</h1>
    <p class="mt-1 body-md text-text-secondary">Ringkasan keuangan kost Anda</p>
  </div>

  {#if dash.loading}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {#each [1, 2, 3, 4] as _, i (i)}
        <div class="h-28 animate-pulse card-surface p-5"></div>
      {/each}
    </div>
  {:else if dash.summary}
    <!-- Stat Cards -->
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <div
        class="card-surface border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-4 card-glow lg:p-5"
      >
        <div class="mb-2 flex items-center gap-2 lg:mb-3 lg:gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/20 lg:h-10 lg:w-10"
          >
            <Icon name="account_balance" class="text-primary" />
          </div>
          <span class="label-md text-text-secondary">Saldo</span>
        </div>
        <p class="truncate headline-sm text-text-primary lg:headline-md">
          {formatRupiahDisplay(dash.summary.balance)}
        </p>
      </div>

      <div
        class="card-surface border-secondary/20 bg-gradient-to-br from-secondary/10 to-secondary/5 p-4 lg:p-5"
      >
        <div class="mb-2 flex items-center gap-2 lg:mb-3 lg:gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/20 lg:h-10 lg:w-10"
          >
            <Icon name="trending_up" class="text-secondary" />
          </div>
          <span class="label-md text-text-secondary">Pemasukan</span>
        </div>
        <p class="truncate headline-sm text-text-primary lg:headline-md">
          {formatRupiahDisplay(dash.summary.totalIncome)}
        </p>
      </div>

      <div
        class="card-surface border-error/20 bg-gradient-to-br from-error/10 to-error/5 p-4 lg:p-5"
      >
        <div class="mb-2 flex items-center gap-2 lg:mb-3 lg:gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-error/20 lg:h-10 lg:w-10"
          >
            <Icon name="trending_down" class="text-error" />
          </div>
          <span class="label-md text-text-secondary">Pengeluaran</span>
        </div>
        <p class="truncate headline-sm text-text-primary lg:headline-md">
          {formatRupiahDisplay(dash.summary.totalExpense)}
        </p>
      </div>

      <div
        class="card-surface border-tertiary/20 bg-gradient-to-br from-tertiary/10 to-tertiary/5 p-4 lg:p-5"
      >
        <div class="mb-2 flex items-center gap-2 lg:mb-3 lg:gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tertiary/20 lg:h-10 lg:w-10"
          >
            <Icon name="groups" class="text-tertiary" />
          </div>
          <span class="label-md text-text-secondary">Penghuni</span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="headline-sm text-secondary lg:headline-md">{dash.summary.paidCount}</span>
          <span class="label-md text-text-secondary">Lunas,</span>
          <span class="headline-sm text-error lg:headline-md">{dash.summary.unpaidCount}</span>
          <span class="label-md text-text-secondary">Blm</span>
        </div>
      </div>
    </div>

    <!-- Charts -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
      <Card>
        <h2 class="mb-4 flex items-center gap-2 headline-sm text-text-primary">
          <Icon name="bar_chart" size="1.25rem" class="text-primary" />
          Arus Kas {isMobile.value ? '3' : '7'} Hari Terakhir
        </h2>
        {#if chartData}
          <Chart type="bar" data={barData} />
        {:else}
          <div class="flex h-[260px] items-center justify-center text-text-secondary">
            <p>Memuat data...</p>
          </div>
        {/if}
      </Card>

      <Card>
        <h2 class="mb-4 flex items-center gap-2 headline-sm text-text-primary">
          <Icon name="donut_large" size="1.25rem" class="text-secondary" />
          Pemasukan vs Pengeluaran Bulan Ini
        </h2>
        {#if chartData}
          <Chart type="doughnut" data={doughnutData} />
        {:else}
          <div class="flex h-[260px] items-center justify-center text-text-secondary">
            <p>Memuat data...</p>
          </div>
        {/if}
      </Card>
    </div>

    <!-- Laporan Bulanan (PDF) -->
    <Card>
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tertiary/20">
          <Icon name="picture_as_pdf" class="text-tertiary" />
        </div>
        <div class="flex-1">
          <h2 class="headline-sm text-text-primary">Laporan Bulanan (PDF)</h2>
          <p class="body-md text-text-secondary">Pilih bulan lalu ekspor laporan keuangan ke PDF</p>
        </div>
      </div>
      <div class="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <MonthFilter
          months={monthOptions.labels}
          value={selectedMonth}
          onchange={(m) => (selectedMonth = m)}
          label="Bulan"
          class="flex-1"
        />
        <Button icon="picture_as_pdf" onclick={handleExportPdf} disabled={exporting}>
          {exporting ? 'Menyiapkan PDF...' : 'Export PDF'}
        </Button>
      </div>
      <p class="mt-3 label-md text-text-secondary">
        Berisi saldo awal bulan, pemasukan & pengeluaran bulan ini, sisa saldo akhir, tabel semua
        transaksi, dan perhitungannya.
      </p>
    </Card>

    <!-- Status Pembayaran Penghuni -->
    <Card>
      <div class="mb-1 flex items-center gap-2">
        <Icon name="fact_check" size="1.25rem" class="text-tertiary" />
        <h2 class="headline-sm text-text-primary">Status Pembayaran Penghuni</h2>
      </div>
      <p class="mb-4 label-md text-text-secondary">Bulan Ini</p>
      <PaymentStatusTable tenants={tenantStatuses} />
    </Card>

    <!-- Recent Income (Pemasukan) -->
    <Card>
      <div class="mb-4 flex items-center justify-between">
        <h2 class="flex items-center gap-2 headline-sm text-text-primary">
          <Icon name="payments" size="1.25rem" class="text-secondary" />
          Pemasukan Terbaru
        </h2>
        <a href={resolve('/billing')} class="label-md text-primary hover:underline">Lihat semua</a>
      </div>
      {#if recentIncome.length === 0}
        <div class="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <Icon name="receipt_long" size="2rem" class="text-text-secondary" />
          <p class="body-md text-text-secondary">Belum ada data pemasukan</p>
        </div>
      {:else}
        <div class="-mx-6 overflow-x-auto px-6">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-outline-variant/50 label-md text-text-secondary">
                <th class="py-2 pr-3 font-medium">Tanggal</th>
                <th class="py-2 pr-3 font-medium">Penghuni</th>
                <th class="py-2 pr-3 font-medium">Keterangan</th>
                <th class="py-2 pr-3 text-right font-medium">Jumlah</th>
                <th class="py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {#each recentIncome as tx (tx.id)}
                <tr class="border-b border-outline-variant/30 last:border-0">
                  <td class="py-2.5 pr-3 body-md whitespace-nowrap text-text-secondary"
                    >{tx.transactionDate}</td
                  >
                  <td class="py-2.5 pr-3 body-md text-text-primary">{tx.user?.name ?? '-'}</td>
                  <td class="py-2.5 pr-3 body-md text-text-primary"
                    >{tx.description || tx.category}</td
                  >
                  <td
                    class="py-2.5 pr-3 text-right body-md font-medium whitespace-nowrap text-text-primary"
                    >{formatRupiahDisplay(tx.amount)}</td
                  >
                  <td class="py-2.5 text-right whitespace-nowrap">
                    <Badge variant={billingStatusMeta(tx.status).badge}
                      >{billingStatusMeta(tx.status).label}</Badge
                    >
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Card>

    <!-- Recent Expenses -->
    <Card>
      <div class="mb-4 flex items-center justify-between">
        <h2 class="flex items-center gap-2 headline-sm text-text-primary">
          <Icon name="receipt_long" size="1.25rem" class="text-error" />
          Pengeluaran Terbaru
        </h2>
        <a href={resolve('/expenses')} class="label-md text-primary hover:underline">Lihat semua</a>
      </div>
      {#if recentExpenses.length === 0}
        <div class="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <Icon name="receipt_long" size="2rem" class="text-text-secondary" />
          <p class="body-md text-text-secondary">Belum ada data pengeluaran</p>
        </div>
      {:else}
        <div class="-mx-6 overflow-x-auto px-6">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-outline-variant/50 label-md text-text-secondary">
                <th class="py-2 pr-3 font-medium">Tanggal</th>
                <th class="py-2 pr-3 font-medium">Deskripsi</th>
                <th class="py-2 text-right font-medium">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {#each recentExpenses as ex (ex.id)}
                <tr class="border-b border-outline-variant/30 last:border-0">
                  <td class="py-2.5 pr-3 body-md whitespace-nowrap text-text-secondary"
                    >{ex.transactionDate}</td
                  >
                  <td class="py-2.5 pr-3 body-md text-text-primary"
                    >{ex.description || ex.category}</td
                  >
                  <td class="py-2.5 text-right body-md font-medium whitespace-nowrap text-error"
                    >{formatRupiahDisplay(ex.amount)}</td
                  >
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Card>
  {:else}
    <Card>
      <p class="py-8 text-center body-md text-text-secondary">Belum ada data</p>
    </Card>
  {/if}
</div>
