<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { getFinanceFeature } from '$lib/features/index.js';
  import { api } from '$lib/core/index.js';
  import {
    Card,
    Button,
    Icon,
    MonthFilter,
    Pagination,
    TenantBillCard,
    BillSummary
  } from '$lib/ui/index.js';
  import { toast } from '$lib/ui/molecules/toast-store.svelte.js';
  import {
    formatRupiahInput,
    parseRupiahInput,
    formatRupiahDisplay,
    formatBillingMonth,
    monthLabelFromDate,
    uniqueMonthLabels
  } from '$lib/core/index.js';
  import type { Tenant } from '$lib/features/tenants/types.js';
  import type { Transaction } from '$lib/features/finance/types.js';

  const finance = getFinanceFeature();

  let tenant = $state<Tenant | null>(null);
  let bills = $state<Transaction[]>([]);
  let kostName = $state<string | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Form cicilan per tagihan (mode admin — langsung terverifikasi)
  let cicilanAmounts = $state<Record<string, number>>({});
  let cicilanDescriptions = $state<Record<string, string>>({});
  let files = $state<Record<string, File | null>>({});
  let savingId = $state<string | null>(null);

  // Filter & pagination
  let filterMonth = $state(formatBillingMonth());
  let billPage = $state(1);
  const PER_PAGE = 5;

  async function load(): Promise<void> {
    const tenantId = $page.params.tenantId;
    if (!tenantId) return;
    loading = true;
    error = null;
    try {
      const [t, b, settings] = await Promise.all([
        api.get<Tenant>(`/tenants/${tenantId}`),
        finance.getTenantBills(tenantId),
        // Nama kost bersifat opsional — kegagalan endpoint ini tidak boleh menggagalkan halaman
        api.get<{ kostName: string | null }>('/settings/public').catch(() => null)
      ]);
      tenant = t;
      bills = b;
      kostName = settings?.kostName ?? null;
    } catch {
      error = 'Gagal memuat data penghuni. Pastikan backend berjalan.';
    } finally {
      loading = false;
    }
  }

  onMount(load);

  const monthOptions = $derived(
    uniqueMonthLabels(bills.map((t) => t.billingMonth ?? monthLabelFromDate(t.transactionDate)))
  );

  const filteredBills = $derived(
    filterMonth === ''
      ? bills
      : bills.filter(
          (t) => (t.billingMonth ?? monthLabelFromDate(t.transactionDate)) === filterMonth
        )
  );

  const monthTotal = $derived(filteredBills.reduce((s, t) => s + Number(t.amount), 0));
  const monthPaid = $derived(filteredBills.reduce((s, t) => s + Number(t.totalPaid), 0));
  const monthRemaining = $derived(monthTotal - monthPaid);

  const pagedBills = $derived(filteredBills.slice((billPage - 1) * PER_PAGE, billPage * PER_PAGE));

  $effect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredBills.length / PER_PAGE));
    if (billPage > maxPage) billPage = maxPage;
  });

  async function handleSaveCicilan(txId: string): Promise<void> {
    const amount = cicilanAmounts[txId];
    if (!amount || amount <= 0) {
      toast.error('Isi jumlah cicilan dulu');
      return;
    }
    savingId = txId;
    try {
      await finance.createInstallmentByAdmin(
        txId,
        {
          amount,
          description: cicilanDescriptions[txId]?.trim() || undefined
        },
        files[txId] ?? undefined,
        true // autoVerify — admin yang menginput, langsung terverifikasi
      );
      cicilanAmounts[txId] = 0;
      cicilanDescriptions[txId] = '';
      files[txId] = null;
      toast.success('Cicilan dicatat & langsung terverifikasi');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mencatat cicilan');
    } finally {
      savingId = null;
    }
  }
</script>

<svelte:head>
  <title>{tenant?.name ? `${tenant.name} — Detail Penghuni` : 'Detail Penghuni'} — uangkost</title>
</svelte:head>

<div class="w-full space-y-6">
  <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
    <div>
      <h1 class="headline-lg text-text-primary">Portal Penghuni</h1>
      <p class="mt-1 body-md text-text-secondary">
        Kelola tagihan & catat pembayaran — {tenant?.name ?? 'memuat...'}
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        icon="bar_chart"
        title="Lihat laporan keuangan publik"
        onclick={() => goto(resolve('/reports'))}
      >
        Lihat Laporan
      </Button>
      <Button
        variant="secondary"
        icon="arrow_back"
        onclick={() => goto(resolve('/tenants'))}
        title="Kembali ke daftar penghuni"
      >
        Kembali
      </Button>
    </div>
  </div>

  {#if loading}
    <div class="animate-pulse card-surface p-8"></div>
  {:else if error}
    <Card>
      <div class="py-8 text-center">
        <Icon name="error" size="2rem" class="mx-auto mb-3 text-error" />
        <p class="body-md text-error">{error}</p>
      </div>
    </Card>
  {:else if tenant}
    <!-- Tenant Info -->
    <Card>
      <div class="mb-3 flex items-center gap-3">
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
          <Icon name="person" size="1.5rem" class="text-primary" />
        </div>
        <div>
          <h2 class="headline-sm text-text-primary">{tenant.name}</h2>
          <p class="body-md text-text-secondary">
            Kamar {tenant.roomNumber ?? '-'} &bull; {tenant.phone}
          </p>
          {#if kostName}
            <p class="mt-0.5 label-md text-text-secondary">{kostName}</p>
          {/if}
        </div>
      </div>
    </Card>

    <!-- Bills Table -->
    <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <h2 class="headline-sm text-text-primary">Daftar Tagihan</h2>
      <MonthFilter
        months={monthOptions}
        value={filterMonth}
        onchange={(m) => (filterMonth = m)}
        label="Periode"
      />
    </div>

    {#if filteredBills.length > 0}
      <!-- Ringkasan periode terpilih -->
      <BillSummary total={monthTotal} paid={monthPaid} remaining={monthRemaining} />
    {/if}

    {#if filteredBills.length === 0}
      <Card>
        <p class="py-8 text-center body-md text-text-secondary">
          {bills.length === 0
            ? 'Belum ada tagihan'
            : `Belum ada tagihan untuk ${filterMonth || 'semua periode'}`}
        </p>
      </Card>
    {:else}
      <div class="space-y-3">
        {#each pagedBills as tx (tx.id)}
          <TenantBillCard bill={tx}>
            {#snippet children({ remaining })}
              <!-- Admin Catat Cicilan (auto-verified) -->
              {#if remaining > 0}
                <div class="mt-4 border-t border-outline-variant/50 pt-4">
                  <p class="mb-2 label-md text-text-secondary">
                    Catat pembayaran cicilan (admin) —
                    <span class="font-medium text-secondary">langsung terverifikasi</span>:
                  </p>
                  <div class="space-y-2">
                    <div class="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        inputmode="numeric"
                        class="input-field flex-1 text-sm"
                        placeholder="Jumlah (Rp)"
                        value={cicilanAmounts[tx.id]
                          ? formatRupiahInput(cicilanAmounts[tx.id])
                          : ''}
                        oninput={(e) => {
                          cicilanAmounts[tx.id] = parseRupiahInput(
                            (e.target as HTMLInputElement).value
                          );
                        }}
                      />
                      <input
                        type="text"
                        class="input-field flex-1 text-sm"
                        placeholder="Deskripsi (opsional)"
                        value={cicilanDescriptions[tx.id] ?? ''}
                        oninput={(e) =>
                          (cicilanDescriptions[tx.id] = (e.target as HTMLInputElement).value)}
                      />
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        class="input-field w-full text-sm file:mr-2 file:cursor-pointer file:btn-primary sm:w-auto"
                        onchange={(e) => {
                          const el = e.target as HTMLInputElement;
                          files[tx.id] = el.files?.[0] ?? null;
                        }}
                      />
                    </div>
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <p class="label-md text-text-secondary">
                        Sisa: {formatRupiahDisplay(remaining)}
                      </p>
                      <Button
                        icon="check_circle"
                        onclick={() => handleSaveCicilan(tx.id)}
                        disabled={savingId !== null ||
                          !cicilanAmounts[tx.id] ||
                          cicilanAmounts[tx.id] <= 0}
                      >
                        {savingId === tx.id ? 'Menyimpan...' : 'Catat & Verifikasi Cicilan'}
                      </Button>
                    </div>
                  </div>
                </div>
              {/if}
            {/snippet}
          </TenantBillCard>
        {/each}
      </div>
      <Pagination
        total={filteredBills.length}
        perPage={PER_PAGE}
        page={billPage}
        onchange={(p) => (billPage = p)}
      />
    {/if}
  {/if}
</div>
