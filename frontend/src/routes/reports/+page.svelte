<script lang="ts">
  import { onMount } from 'svelte';
  import { getFinanceFeature } from '$lib/features/index.js';
  import {
    Badge,
    Card,
    Chart,
    Footer,
    Icon,
    PaymentStatusTable,
    buildCashflowBarData,
    buildMonthlyDoughnutData
  } from '$lib/ui/index.js';
  import {
    formatRupiahDisplay,
    useIsMobile,
    assetUrl,
    billingStatusMeta
  } from '$lib/core/index.js';
  import type { PublicDashboard } from '$lib/features/finance/index.svelte.js';

  const fin = getFinanceFeature();

  let data = $state<PublicDashboard | null>(null);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      data = await fin.getPublicDashboard();
    } catch {
      error = 'Gagal memuat data. Pastikan backend berjalan.';
    }
  });

  const isMobile = useIsMobile();

  // Bar chart 7 hari (3 di mobile) + doughnut bulan ini — dibagi dengan dashboard admin
  const barData = $derived(buildCashflowBarData(data?.chartData.daily ?? [], isMobile.value));
  const doughnutData = $derived(
    buildMonthlyDoughnutData(
      data?.chartData.monthlyIncome ?? 0,
      data?.chartData.monthlyExpense ?? 0
    )
  );
</script>

<svelte:head>
  <title>uangkost — Laporan</title>
</svelte:head>

<div class="mx-auto min-h-screen max-w-6xl space-y-6 bg-background p-4 sm:p-6">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
        <Icon name="bar_chart" size="1.25rem" class="text-primary" />
      </div>
      <div>
        <h1 class="headline-sm text-primary">uangkost</h1>
        <p class="label-md text-text-secondary">Laporan Bulan Ini — Publik</p>
      </div>
    </div>
  </div>

  {#if error}
    <Card>
      <div class="py-8 text-center">
        <Icon name="error" size="2rem" class="mx-auto mb-3 text-error" />
        <p class="body-md text-error">{error}</p>
      </div>
    </Card>
  {:else if !data}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {#each [1, 2, 3, 4] as _, i (i)}
        <div class="h-28 animate-pulse card-surface p-5"></div>
      {/each}
    </div>
  {:else}
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
          {formatRupiahDisplay(data.summary.balance)}
        </p>
        <p class="mt-0.5 label-md text-text-secondary">Semua Waktu</p>
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
          {formatRupiahDisplay(data.monthly.income)}
        </p>
        <p class="mt-0.5 label-md text-text-secondary">Bulan Ini</p>
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
          {formatRupiahDisplay(data.monthly.expense)}
        </p>
        <p class="mt-0.5 label-md text-text-secondary">Bulan Ini</p>
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
          <span class="label-md text-text-secondary">Pembayaran</span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="headline-sm text-secondary lg:headline-md">{data.monthly.paidCount}</span>
          <span class="label-md text-text-secondary">Lunas,</span>
          <span class="headline-sm text-error lg:headline-md">{data.monthly.unpaidCount}</span>
          <span class="label-md text-text-secondary">Blm</span>
        </div>
        <p class="mt-0.5 label-md text-text-secondary">Bulan Ini</p>
      </div>
    </div>

    <!-- Charts -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
      <Card>
        <h2 class="mb-4 flex items-center gap-2 headline-sm text-text-primary">
          <Icon name="bar_chart" size="1.25rem" class="text-primary" />
          Arus Kas {isMobile.value ? '3' : '7'} Hari Terakhir
        </h2>
        <Chart type="bar" data={barData} />
      </Card>
      <Card>
        <h2 class="mb-4 flex items-center gap-2 headline-sm text-text-primary">
          <Icon name="donut_large" size="1.25rem" class="text-secondary" />
          Pemasukan vs Pengeluaran Bulan Ini
        </h2>
        <Chart type="doughnut" data={doughnutData} />
      </Card>
    </div>

    <!-- Status Pembayaran Penghuni -->
    <Card>
      <div class="mb-1 flex items-center gap-2">
        <Icon name="fact_check" size="1.25rem" class="text-tertiary" />
        <h2 class="headline-sm text-text-primary">Status Pembayaran Penghuni</h2>
      </div>
      <p class="mb-4 label-md text-text-secondary">Bulan Ini</p>
      <PaymentStatusTable tenants={data.tenants} />
    </Card>

    <!-- Recent Income (Pemasukan) -->
    <Card>
      <div class="mb-1 flex items-center gap-2">
        <Icon name="payments" size="1.25rem" class="text-secondary" />
        <h2 class="headline-sm text-text-primary">Pemasukan</h2>
      </div>
      <p class="mb-4 label-md text-text-secondary">Bulan Ini</p>
      {#if data.recentIncome.length === 0}
        <div class="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <Icon name="receipt_long" size="2rem" class="text-text-secondary" />
          <p class="body-md text-text-secondary">Belum ada data pemasukan bulan ini</p>
        </div>
      {:else}
        <div class="-mx-6 overflow-x-auto px-6">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-outline-variant/50 label-md text-text-secondary">
                <th class="py-2 pr-3 font-medium">Tanggal</th>
                <th class="py-2 pr-3 font-medium">Penghuni</th>
                <th class="py-2 pr-3 font-medium">Keterangan</th>
                <th class="py-2 pr-3 font-medium">Status</th>
                <th class="py-2 pr-3 text-right font-medium">Jumlah</th>
                <th class="py-2 text-right font-medium">Bukti</th>
              </tr>
            </thead>
            <tbody>
              {#each data.recentIncome as tx (tx.id)}
                <tr class="border-b border-outline-variant/30 last:border-0">
                  <td class="py-2.5 pr-3 body-md whitespace-nowrap text-text-secondary"
                    >{tx.transactionDate}</td
                  >
                  <td class="py-2.5 pr-3 body-md whitespace-nowrap text-text-primary"
                    >{tx.userName ?? '-'}</td
                  >
                  <td class="py-2.5 pr-3 body-md text-text-primary"
                    >{tx.description || tx.category}</td
                  >
                  <td class="py-2.5 pr-3 whitespace-nowrap">
                    {#if tx.status}
                      <Badge variant={billingStatusMeta(tx.status).badge}
                        >{billingStatusMeta(tx.status).label}</Badge
                      >
                    {:else}
                      <span class="body-md text-text-secondary">—</span>
                    {/if}
                  </td>
                  <td class="py-2.5 text-right body-md font-medium whitespace-nowrap text-secondary"
                    >{formatRupiahDisplay(tx.amount)}</td
                  >
                  <td class="py-2.5 text-right">
                    {#if tx.paymentProofUrl}
                      <a
                        href={assetUrl(tx.paymentProofUrl)}
                        target="_blank"
                        rel="external noopener"
                        class="inline-flex items-center justify-center btn-secondary p-2 text-xs"
                        title="Lihat bukti pembayaran"
                      >
                        <Icon name="visibility" size="1rem" />
                      </a>
                    {:else}
                      <span class="body-md text-text-secondary">—</span>
                    {/if}
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
      <div class="mb-1 flex items-center gap-2">
        <Icon name="receipt_long" size="1.25rem" class="text-error" />
        <h2 class="headline-sm text-text-primary">Pengeluaran</h2>
      </div>
      <p class="mb-4 label-md text-text-secondary">Bulan Ini</p>
      {#if data.recentExpenses.length === 0}
        <div class="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <Icon name="receipt_long" size="2rem" class="text-text-secondary" />
          <p class="body-md text-text-secondary">Belum ada data pengeluaran bulan ini</p>
        </div>
      {:else}
        <div class="-mx-6 overflow-x-auto px-6">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-outline-variant/50 label-md text-text-secondary">
                <th class="py-2 pr-3 font-medium">Tanggal</th>
                <th class="py-2 pr-3 font-medium">Deskripsi</th>
                <th class="py-2 pr-3 text-right font-medium">Jumlah</th>
                <th class="py-2 text-right font-medium">Bukti</th>
              </tr>
            </thead>
            <tbody>
              {#each data.recentExpenses as ex (ex.id)}
                <tr class="border-b border-outline-variant/30 last:border-0">
                  <td class="py-2.5 pr-3 body-md whitespace-nowrap text-text-secondary"
                    >{ex.transactionDate}</td
                  >
                  <td class="py-2.5 pr-3 body-md text-text-primary"
                    >{ex.description || ex.category}</td
                  >
                  <td
                    class="py-2.5 pr-3 text-right body-md font-medium whitespace-nowrap text-error"
                    >{formatRupiahDisplay(ex.amount)}</td
                  >
                  <td class="py-2.5 text-right">
                    {#if ex.paymentProofUrl}
                      <a
                        href={assetUrl(ex.paymentProofUrl)}
                        target="_blank"
                        rel="external noopener"
                        class="inline-flex items-center justify-center btn-secondary p-2 text-xs"
                        title="Lihat bukti pembayaran"
                      >
                        <Icon name="visibility" size="1rem" />
                      </a>
                    {:else}
                      <span class="body-md text-text-secondary">—</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Card>
  {/if}

  <Footer />
</div>
