<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { getTenantPortalFeature } from '$lib/features/index.js';
  import { Card, Badge, Button, Footer, Icon, Pagination } from '$lib/ui/index.js';
  import { toast } from '$lib/ui/molecules/toast-store.svelte.js';
  import {
    formatRupiahInput,
    parseRupiahInput,
    formatRupiahDisplay,
    assetUrl
  } from '$lib/core/index.js';
  import type { Transaction } from '$lib/features/finance/types.js';

  const portal = getTenantPortalFeature();

  let files = $state<Record<string, File | null>>({});
  let cicilanAmounts = $state<Record<string, number>>({});
  let cicilanNotes = $state<Record<string, string>>({});
  let uploadingId = $state<string | null>(null);
  let billPage = $state(1);
  const PER_PAGE = 5;
  let initializing = $state(true);

  onMount(async () => {
    const tok = $page.params.token;
    try {
      // 1) Coba pakai sesi cookie dulu (tanpa perlu token di URL)
      await Promise.all([portal.load(), portal.loadBank()]);
    } catch {
      // 2) Belum ada sesi — login magic link (validasi → rotate → set cookie)
      if (!tok) return;
      try {
        const newToken = await portal.login(tok);
        // Perbarui URL ke token baru agar link yang terlihat tetap valid
        history.replaceState(null, '', `/portal/${newToken}`);
        await Promise.all([portal.load(), portal.loadBank()]);
      } catch {
        // Token tidak valid / kedaluwarsa — state error tampil otomatis
      }
    } finally {
      initializing = false;
    }
  });

  const pagedBills = $derived(
    portal.transactions.slice((billPage - 1) * PER_PAGE, billPage * PER_PAGE)
  );

  // Jaga agar halaman tetap valid saat data berubah
  $effect(() => {
    const maxPage = Math.max(1, Math.ceil(portal.transactions.length / PER_PAGE));
    if (billPage > maxPage) billPage = maxPage;
  });

  function remainingBill(tx: Transaction): number {
    return Number(tx.amount) - Number(tx.totalPaid);
  }

  function progressPercent(tx: Transaction): number {
    return Math.min(100, (Number(tx.totalPaid) / Number(tx.amount)) * 100);
  }

  async function handleUploadCicilan(txId: string) {
    const file = files[txId];
    const rawAmount = cicilanAmounts[txId];
    const note = cicilanNotes[txId] ?? '';
    const amount = Number(rawAmount);
    if (!file || !amount || amount <= 0) return;
    uploadingId = txId;
    try {
      await portal.uploadInstallment(txId, amount, note, file);
      files[txId] = null;
      cicilanAmounts[txId] = 0;
      cicilanNotes[txId] = '';
      toast.success('Cicilan terkirim, menunggu verifikasi admin');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Gagal: ${msg}`);
    } finally {
      uploadingId = null;
    }
  }
</script>

<svelte:head>
  <title>{portal.tenant?.name ?? 'Portal'} — uangkost</title>
</svelte:head>

<div class="mx-auto min-h-screen max-w-3xl space-y-6 bg-background p-4 sm:p-6">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
        <Icon name="account_balance_wallet" size="1.25rem" class="text-primary" />
      </div>
      <div>
        <h1 class="headline-sm text-primary">uangkost</h1>
        <p class="label-md text-text-secondary">Portal Penghuni</p>
      </div>
    </div>
  </div>

  {#if initializing || portal.loading}
    <div class="animate-pulse card-surface p-8"></div>
  {:else if portal.tenant}
    <!-- Tenant Info -->
    <Card>
      <div class="mb-3 flex items-center gap-3">
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
          <Icon name="person" size="1.5rem" class="text-primary" />
        </div>
        <div>
          <h2 class="headline-sm text-text-primary">{portal.tenant.name}</h2>
          <p class="body-md text-text-secondary">
            Kamar {portal.tenant.roomNumber ?? '-'} &bull; {portal.tenant.phone}
          </p>
          {#if portal.bankInfo.kostName}
            <p class="mt-0.5 label-md text-text-secondary">{portal.bankInfo.kostName}</p>
          {/if}
        </div>
      </div>
    </Card>

    <!-- Bank Info -->
    {#if portal.bankInfo.bankAccountInfo || portal.bankInfo.qrisImageUrl}
      <Card class="border-secondary/30 bg-gradient-to-br from-secondary/5 to-transparent">
        <div class="mb-2 flex items-center gap-2">
          <Icon name="account_balance" class="text-secondary" />
          <h2 class="headline-sm text-text-primary">Info Pembayaran</h2>
        </div>
        {#if portal.bankInfo.bankAccountInfo}
          <p class="body-md whitespace-pre-line text-text-primary">
            {portal.bankInfo.bankAccountInfo}
          </p>
        {/if}
        {#if portal.bankInfo.qrisImageUrl}
          <div class="mt-3">
            <p class="mb-2 flex items-center gap-1 label-md text-text-secondary">
              <Icon name="qr_code_2" size="1rem" /> Scan QRIS berikut untuk membayar:
            </p>
            <div
              class="w-full overflow-hidden rounded-xl border-2 border-secondary/30 bg-white p-2"
            >
              <img
                src={assetUrl(portal.bankInfo.qrisImageUrl)}
                alt="QRIS"
                class="h-auto w-full object-contain"
              />
            </div>
          </div>
        {/if}
        <p class="mt-2 label-md text-text-secondary">
          Transfer/scan sejumlah cicilan, lalu unggah buktinya di bawah.
        </p>
      </Card>
    {/if}

    <!-- Bills Table -->
    <h2 class="headline-sm text-text-primary">Daftar Tagihan</h2>
    {#if portal.transactions.length === 0}
      <Card>
        <p class="py-8 text-center body-md text-text-secondary">Belum ada tagihan</p>
      </Card>
    {:else}
      <div class="space-y-3">
        {#each pagedBills as tx (tx.id)}
          {@const remaining = remainingBill(tx)}
          {@const pct = progressPercent(tx)}
          <Card>
            <!-- Header -->
            <div class="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <p class="body-lg font-medium text-text-primary">{tx.category}</p>
                  {#if tx.status === 'paid'}
                    <Badge variant="success">Lunas</Badge>
                  {:else if tx.status === 'partial'}
                    <Badge variant="warning">Cicilan</Badge>
                  {:else if tx.paymentProofUrl || (tx.installments && tx.installments.length > 0)}
                    <Badge variant="warning">Menunggu Verifikasi</Badge>
                  {:else}
                    <Badge variant="danger">Belum Dibayar</Badge>
                  {/if}
                </div>
                <p class="mt-1 label-md text-text-secondary">
                  {tx.billingMonth ?? tx.transactionDate}
                </p>
              </div>
              <div class="text-left sm:text-right">
                <p class="headline-sm text-text-primary">{formatRupiahDisplay(tx.amount)}</p>
                {#if remaining > 0 && Number(tx.totalPaid) > 0}
                  <p class="label-md text-text-secondary">Sisa: {formatRupiahDisplay(remaining)}</p>
                {/if}
              </div>
            </div>

            <!-- Progress Bar -->
            {#if tx.status !== 'paid' && Number(tx.amount) > 0}
              <div class="mb-3">
                <div class="mb-1 flex justify-between label-md text-text-secondary">
                  <span>Dibayar: {formatRupiahDisplay(tx.totalPaid)}</span>
                  <span>{pct.toFixed(0)}%</span>
                </div>
                <div class="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
                  <div
                    class="h-full rounded-full bg-secondary transition-all duration-500"
                    style="width: {pct}%"
                  ></div>
                </div>
              </div>
            {/if}

            <!-- Installment History -->
            {#if tx.installments && tx.installments.length > 0}
              <div class="mb-3 space-y-1.5">
                <p class="label-md font-medium text-text-secondary">Riwayat Cicilan:</p>
                {#each tx.installments as inst (inst.id)}
                  <div
                    class="flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-1.5 text-sm"
                  >
                    <div class="flex items-center gap-2">
                      <span class="text-text-primary">{formatRupiahDisplay(inst.amount)}</span>
                      {#if inst.note}
                        <span class="text-text-secondary">— {inst.note}</span>
                      {/if}
                    </div>
                    <div class="flex items-center gap-2">
                      {#if inst.isVerified}
                        <span
                          class="inline-flex items-center gap-1 rounded-full bg-[#34D399]/20 px-2 py-0.5 text-xs font-medium text-[#34D399]"
                          >Terverifikasi</span
                        >
                      {:else if inst.rejectedAt}
                        <span
                          class="inline-flex items-center gap-1 rounded-full bg-[#F87171]/20 px-2 py-0.5 text-xs font-medium text-[#F87171]"
                          >Ditolak</span
                        >
                      {:else}
                        <span
                          class="inline-flex items-center gap-1 rounded-full bg-[#fabd34]/20 px-2 py-0.5 text-xs font-medium text-[#fabd34]"
                          >Menunggu</span
                        >
                      {/if}
                      {#if inst.paymentProofUrl}
                        <a
                          href={assetUrl(inst.paymentProofUrl)}
                          target="_blank"
                          rel="external noopener"
                          class="text-xs text-primary underline">Bukti</a
                        >
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}

            <!-- Upload Cicilan (only if not fully paid) -->
            {#if remaining > 0}
              <div class="mt-4 border-t border-outline-variant/50 pt-4">
                <p class="mb-2 label-md text-text-secondary">
                  Bayar cicilan — transfer ke rekening di atas, isi jumlah & unggah bukti:
                </p>
                <div class="space-y-2">
                  <div class="flex gap-2">
                    <input
                      type="text"
                      inputmode="numeric"
                      class="input-field w-40 text-sm"
                      placeholder="Jumlah (Rp)"
                      value={cicilanAmounts[tx.id] ? formatRupiahInput(cicilanAmounts[tx.id]) : ''}
                      oninput={(e) => {
                        cicilanAmounts[tx.id] = parseRupiahInput(
                          (e.target as HTMLInputElement).value
                        );
                      }}
                    />
                    <input
                      type="text"
                      class="input-field flex-1 text-sm"
                      placeholder="Catatan (opsional)"
                      value={cicilanNotes[tx.id] ?? ''}
                      oninput={(e) => (cicilanNotes[tx.id] = (e.target as HTMLInputElement).value)}
                    />
                  </div>
                  <div class="space-y-2">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      class="input-field w-full text-sm file:mr-2 file:cursor-pointer file:btn-primary"
                      onchange={(e) => {
                        const el = e.target as HTMLInputElement;
                        files[tx.id] = el.files?.[0] ?? null;
                      }}
                    />
                    <Button
                      icon="upload"
                      class="w-full"
                      onclick={() => handleUploadCicilan(tx.id)}
                      disabled={!files[tx.id] ||
                        !cicilanAmounts[tx.id] ||
                        cicilanAmounts[tx.id] <= 0 ||
                        uploadingId !== null}
                    >
                      {uploadingId === tx.id ? 'Mengirim...' : 'Bayar Cicilan'}
                    </Button>
                  </div>
                  <p class="label-md text-text-secondary">Sisa: {formatRupiahDisplay(remaining)}</p>
                </div>
              </div>
            {/if}
          </Card>
        {/each}
      </div>
      <Pagination
        total={portal.transactions.length}
        perPage={PER_PAGE}
        page={billPage}
        onchange={(p) => (billPage = p)}
      />
    {/if}
  {:else}
    <Card>
      <div class="py-8 text-center">
        <div
          class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-error/10"
        >
          <Icon name="error" size="2rem" class="text-error" />
        </div>
        <p class="body-lg font-medium text-error">Link tidak valid atau sudah kadaluarsa</p>
        <p class="mt-2 label-md text-text-secondary">
          Silakan hubungi admin kost untuk mendapatkan link baru.
        </p>
      </div>
    </Card>
  {/if}

  <Footer />
</div>
