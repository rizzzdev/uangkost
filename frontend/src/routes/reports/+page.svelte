<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { getFinanceFeature } from '$lib/features/index.js';
  import { api } from '$lib/core/api-client.js';
  import {
    Badge,
    BrandHeader,
    Button,
    Card,
    Chart,
    Footer,
    Icon,
    MonthFilter,
    PaymentStatusTable,
    ProofButton,
    buildMonthlyDoughnutData
  } from '$lib/ui/index.js';
  import {
    formatRupiahDisplay,
    billingStatusMeta,
    currentMonthKey,
    monthLabelFromKey,
    monthKeyFromLabel
  } from '$lib/core/index.js';
  import type { PublicDashboard } from '$lib/features/finance/index.svelte.js';

  const fin = getFinanceFeature();

  let data = $state<PublicDashboard | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(true);
  // Deteksi admin (sesi cookie valid) — hanya untuk navigasi tambahan ke dashboard
  let isAdmin = $state(false);
  // Filter bulan — default: bulan berjalan. '' = Semua Bulan (dikirim sebagai "all")
  let filterMonthKey = $state(currentMonthKey());

  const periodLabel = $derived(
    filterMonthKey === 'all' ? 'Semua Bulan' : monthLabelFromKey(filterMonthKey)
  );
  const filterValue = $derived(filterMonthKey === 'all' ? '' : monthLabelFromKey(filterMonthKey));
  const filterMonths = $derived(data?.availableMonths ?? []);

  let loadSeq = 0;
  async function load(): Promise<void> {
    const seq = ++loadSeq;
    loading = true;
    error = null;
    try {
      const d = await fin.getPublicDashboard(filterMonthKey);
      if (seq === loadSeq) data = d;
    } catch {
      if (seq === loadSeq) error = 'Gagal memuat data. Pastikan backend berjalan.';
    } finally {
      if (seq === loadSeq) loading = false;
    }
  }

  onMount(async () => {
    load();
    // Cek sesi admin via cookie (httpOnly) — non-blocking, hanya untuk tombol dashboard
    try {
      await api.get('/auth/me');
      isAdmin = true;
    } catch {
      isAdmin = false;
    }
  });

  function onMonthChange(value: string): void {
    // MonthFilter mengirim '' untuk "Semua Bulan" → internal pakai sentinel "all"
    filterMonthKey = value ? monthKeyFromLabel(value) : 'all';
    load();
  }

  // Bar chart: arus kas mengikuti periode terpilih (per hari untuk bulan,
  // per bulan untuk "Semua Bulan") — dikirim backend sebagai periodChart
  const barData = $derived({
    labels: (data?.periodChart ?? []).map((p) => p.label),
    datasets: [
      {
        label: 'Pemasukan',
        data: (data?.periodChart ?? []).map((p) => p.income),
        backgroundColor: '#34D399',
        borderColor: '#34D399',
        borderRadius: 6
      },
      {
        label: 'Pengeluaran',
        data: (data?.periodChart ?? []).map((p) => p.expense),
        backgroundColor: '#F87171',
        borderColor: '#F87171',
        borderRadius: 6
      }
    ]
  });
  // Doughnut: pemasukan vs pengeluaran sesuai bulan terpilih
  const doughnutData = $derived(
    buildMonthlyDoughnutData(data?.monthly.income ?? 0, data?.monthly.expense ?? 0)
  );
</script>

<svelte:head>
  <title>Laporan Keuangan — uangkost</title>
</svelte:head>

<div class="mx-auto min-h-screen max-w-6xl space-y-6 bg-background p-4 sm:p-6">
  <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
    <BrandHeader icon="bar_chart" subtitle="Laporan Publik — {periodLabel}" />
    <div class="flex flex-wrap items-center gap-2">
      {#if data && !error}
        <MonthFilter
          months={filterMonths}
          value={filterValue}
          onchange={onMonthChange}
          label="Periode"
        />
      {/if}
      {#if isAdmin}
        <Button
          variant="primary"
          icon="dashboard"
          title="Buka dashboard admin"
          onclick={() => goto(resolve('/dashboard'))}
        >
          Dashboard
        </Button>
      {/if}
      <Button
        variant="secondary"
        icon="arrow_back"
        title="Kembali ke halaman sebelumnya"
        onclick={() => {
          if (history.length > 1) history.back();
          else goto(resolve('/'));
        }}
      >
        Kembali
      </Button>
    </div>
  </div>

  {#if error}
    <Card>
      <div class="py-8 text-center">
        <Icon name="error" size="2rem" class="mx-auto mb-3 text-error" />
        <p class="body-md text-error">{error}</p>
      </div>
    </Card>
  {:else if loading || !data}
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
          {formatRupiahDisplay(data.monthly.closingBalance)}
        </p>
        <p class="mt-0.5 label-md text-text-secondary">{periodLabel}</p>
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
        <p class="mt-0.5 label-md text-text-secondary">{periodLabel}</p>
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
        <p class="mt-0.5 label-md text-text-secondary">{periodLabel}</p>
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
        <p class="mt-0.5 label-md text-text-secondary">{periodLabel}</p>
      </div>
    </div>

    <!-- Charts -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
      <Card>
        <h2 class="mb-4 flex items-center gap-2 headline-sm text-text-primary">
          <Icon name="bar_chart" size="1.25rem" class="text-primary" />
          Arus Kas {periodLabel}
        </h2>
        <Chart type="bar" data={barData} />
      </Card>
      <Card>
        <h2 class="mb-4 flex items-center gap-2 headline-sm text-text-primary">
          <Icon name="donut_large" size="1.25rem" class="text-secondary" />
          Pemasukan vs Pengeluaran {periodLabel}
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
      <p class="mb-4 label-md text-text-secondary">{periodLabel}</p>
      <PaymentStatusTable tenants={data.tenants} />
    </Card>

    <!-- Pemasukan -->
    <Card>
      <div class="mb-1 flex items-center gap-2">
        <Icon name="payments" size="1.25rem" class="text-secondary" />
        <h2 class="headline-sm text-text-primary">Pemasukan</h2>
      </div>
      <p class="mb-4 label-md text-text-secondary">{periodLabel}</p>
      {#if data.recentIncome.length === 0}
        <div class="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <Icon name="receipt_long" size="2rem" class="text-text-secondary" />
          <p class="body-md text-text-secondary">Belum ada data pemasukan untuk {periodLabel}</p>
        </div>
      {:else}
        <div class="-mx-6 overflow-x-auto px-6">
          <table class="w-full min-w-[760px] text-left">
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
                    <ProofButton url={tx.paymentProofUrl} title="Lihat bukti pembayaran" />
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Card>

    <!-- Pengeluaran -->
    <Card>
      <div class="mb-1 flex items-center gap-2">
        <Icon name="receipt_long" size="1.25rem" class="text-error" />
        <h2 class="headline-sm text-text-primary">Pengeluaran</h2>
      </div>
      <p class="mb-4 label-md text-text-secondary">{periodLabel}</p>
      {#if data.recentExpenses.length === 0}
        <div class="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <Icon name="receipt_long" size="2rem" class="text-text-secondary" />
          <p class="body-md text-text-secondary">Belum ada data pengeluaran untuk {periodLabel}</p>
        </div>
      {:else}
        <div class="-mx-6 overflow-x-auto px-6">
          <table class="w-full min-w-[520px] text-left">
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
                    <ProofButton url={ex.paymentProofUrl} title="Lihat bukti pembayaran" />
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
