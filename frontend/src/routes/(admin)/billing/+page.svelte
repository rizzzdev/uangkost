<script lang="ts">
  import { onMount } from 'svelte';
  import { getFinanceFeature, getTenantFeature } from '$lib/features/index.js';
  import {
    Button,
    Badge,
    Card,
    Chart,
    DataTable,
    Modal,
    Dropdown,
    Icon,
    Pagination,
    MonthFilter,
    ConfirmDialog,
    askConfirm,
    buildTypeBarData
  } from '$lib/ui/index.js';
  import { toast } from '$lib/ui/molecules/toast-store.svelte.js';
  import {
    formatRupiahInput,
    parseRupiahInput,
    formatRupiahDisplay,
    formatBillingMonth,
    assetUrl,
    billingStatusMeta,
    useIsMobile
  } from '$lib/core/index.js';
  import type { Transaction } from '$lib/features/finance/types.js';
  import type { ChartData } from '$lib/features/finance/index.svelte.js';

  const finance = getFinanceFeature();
  const tenantsFeature = getTenantFeature();

  let showCreate = $state(false);
  let showEdit = $state(false);
  let showDetail = $state(false);
  let editTx = $state<Transaction | null>(null);
  let detailTx = $state<Transaction | null>(null);
  let form = $state({ userId: null as string | null, amount: 0, description: '' });
  let editForm = $state({ amount: 0, description: '', status: 'unpaid' as string });
  let page = $state(1);
  let filterMonth = $state('');
  const PER_PAGE = 10;

  const today = new Date().toISOString().split('T')[0]!;

  let chartData = $state<ChartData | null>(null);
  const isMobile = useIsMobile();
  const barData = $derived(buildTypeBarData(chartData?.daily ?? [], 'income', isMobile.value));

  async function loadCharts() {
    try {
      chartData = await finance.getChartData();
    } catch {
      /* silent */
    }
  }

  onMount(async () => {
    await Promise.all([tenantsFeature.load(), finance.load('income')]);
    await loadCharts();
  });

  const tenantOptions = $derived(
    tenantsFeature.tenants
      .filter((t) => t.isActive)
      .map((t) => ({
        value: t.id,
        label: `${t.name} — ${t.roomNumber ?? 'tanpa kamar'}`,
        icon: 'person'
      }))
  );

  const columns = ['Tanggal', 'Penghuni', 'Keterangan', 'Jumlah', 'Status'];

  // Data sudah diurutkan terbaru dulu (backend: createdAt desc)
  const monthOptions = $derived(
    [
      ...new Set(finance.transactions.map((t) => t.billingMonth).filter((m): m is string => !!m))
    ].sort((a, b) => b.localeCompare(a))
  );

  const filtered = $derived(
    filterMonth
      ? finance.transactions.filter((t) => t.billingMonth === filterMonth)
      : finance.transactions
  );

  const pagedRows = $derived(filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE));

  // Card stats — total tagihan, uang terkumpul (totalPaid), dan sisa belum dibayar
  const totalIncome = $derived(finance.transactions.reduce((s, t) => s + Number(t.amount), 0));
  const collectedIncome = $derived(
    finance.transactions.reduce((s, t) => s + Number(t.totalPaid), 0)
  );

  // Jaga halaman tetap valid saat filter/data berubah
  $effect(() => {
    const maxPage = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    if (page > maxPage) page = maxPage;
  });

  function getCell(row: Transaction, col: string): string | { text: string; icon?: string } {
    const map: Record<string, string | { text: string; icon?: string }> = {
      Tanggal: row.transactionDate,
      Penghuni: row.user?.name ?? '-',
      Keterangan: row.description || row.category,
      Jumlah: formatRupiahDisplay(row.amount),
      Status: {
        text: billingStatusMeta(row.status).label,
        icon: billingStatusMeta(row.status).icon
      }
    };
    return map[col] ?? '';
  }

  async function handleCreate() {
    if (!form.userId) {
      toast.error('Pilih penghuni');
      return;
    }
    const description = form.description.trim();
    try {
      await finance.create({
        type: 'income',
        userId: form.userId,
        amount: Number(form.amount),
        category: description || 'Pemasukan',
        description: description || undefined,
        billingMonth: formatBillingMonth(),
        transactionDate: today
      });
      showCreate = false;
      form = { userId: null, amount: 0, description: '' };
      toast.success('Pemasukan berhasil dicatat');
    } catch {
      toast.error('Gagal mencatat pemasukan');
    }
  }

  function openEdit(tx: Transaction) {
    editTx = tx;
    editForm = {
      amount: Number(tx.amount),
      description: tx.description ?? tx.category,
      status: tx.status
    };
    showEdit = true;
  }

  async function handleUpdate() {
    if (!editTx) return;
    const description = editForm.description.trim();
    try {
      await finance.update(editTx.id, {
        amount: Number(editForm.amount),
        category: description || editTx.category,
        description: description || null,
        billingMonth: editTx.billingMonth ?? formatBillingMonth(),
        status: editForm.status as 'paid' | 'unpaid' | 'partial',
        transactionDate: today
      });
      showEdit = false;
      editTx = null;
      toast.success('Pemasukan diperbarui');
    } catch {
      toast.error('Gagal memperbarui');
    }
  }

  async function handleRemove(tx: Transaction) {
    const ok = await askConfirm({
      title: 'Hapus Pemasukan',
      message: `Hapus pemasukan ${tx.category} sebesar ${formatRupiahDisplay(tx.amount)}?`
    });
    if (!ok) return;
    try {
      await finance.remove(tx.id);
      toast.info('Pemasukan dihapus');
    } catch {
      toast.error('Gagal menghapus');
    }
  }

  function openDetail(tx: Transaction) {
    detailTx = tx;
    showDetail = true;
  }

  async function verifyInstallment(instId: string) {
    try {
      await finance.verifyInstallment(instId);
      toast.success('Cicilan diverifikasi');
    } catch {
      toast.error('Gagal verifikasi');
    }
  }

  async function rejectInstallment(instId: string) {
    const ok = await askConfirm({
      title: 'Tolak Cicilan',
      message: 'Tolak cicilan ini? Status akan tetap menunggu/tidak dihitung.'
    });
    if (!ok) return;
    try {
      await finance.rejectInstallment(instId);
      toast.info('Cicilan ditolak');
    } catch {
      toast.error('Gagal menolak');
    }
  }

  async function verifyPayment(tx: Transaction) {
    const ok = await askConfirm({
      title: 'Verifikasi Pembayaran',
      message: `Verifikasi pembayaran pemasukan ${tx.category} sebesar ${formatRupiahDisplay(tx.amount)}?`,
      variant: 'primary'
    });
    if (!ok) return;
    try {
      await finance.verify(tx.id);
      toast.success('Pembayaran diverifikasi');
    } catch {
      toast.error('Gagal verifikasi');
    }
  }

  async function rejectPayment(tx: Transaction) {
    const ok = await askConfirm({
      title: 'Tolak Bukti Pembayaran',
      message: `Tolak bukti pembayaran pemasukan ${tx.category}? Bukti akan dihapus.`
    });
    if (!ok) return;
    try {
      await finance.reject(tx.id);
      toast.info('Pembayaran ditolak');
    } catch {
      toast.error('Gagal menolak');
    }
  }

  async function deleteInstallment(instId: string) {
    const ok = await askConfirm({
      title: 'Hapus Cicilan',
      message: 'Hapus cicilan ini? Total yang sudah dibayar akan disesuaikan.'
    });
    if (!ok) return;
    try {
      await finance.deleteInstallment(instId);
      toast.info('Cicilan dihapus');
    } catch {
      toast.error('Gagal menghapus');
    }
  }
</script>

<svelte:head>
  <title>uangkost — Pemasukan</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div>
      <h1 class="headline-lg text-text-primary">Pemasukan</h1>
      <p class="mt-1 body-md text-text-secondary">Kelola pemasukan iuran penghuni</p>
    </div>
    <Button icon="add" onclick={() => (showCreate = true)}>Tambah Pemasukan</Button>
  </div>

  <!-- Total Card (mirror halaman Pengeluaran) -->
  <div
    class="card-surface border-secondary/20 bg-gradient-to-br from-secondary/10 to-secondary/5 p-5 card-glow"
  >
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/20">
        <Icon name="trending_up" class="text-secondary" />
      </div>
      <div>
        <span class="label-md text-text-secondary">Total Pemasukan</span>
        <p class="headline-md text-text-primary">{formatRupiahDisplay(totalIncome)}</p>
      </div>
    </div>
    <p class="mt-2 label-md text-text-secondary">
      Terkumpul: <span class="font-medium text-secondary"
        >{formatRupiahDisplay(collectedIncome)}</span
      >
      · Belum:
      <span class="font-medium text-error"
        >{formatRupiahDisplay(totalIncome - collectedIncome)}</span
      >
    </p>
  </div>

  <Card>
    <h2 class="mb-4 flex items-center gap-2 headline-sm text-text-primary">
      <Icon name="bar_chart" size="1.25rem" class="text-secondary" />
      Grafik Pemasukan {isMobile.value ? '3' : '7'} Hari Terakhir
    </h2>
    {#if chartData}
      <Chart type="bar" data={barData} />
    {:else}
      <div class="flex h-[260px] items-center justify-center text-text-secondary">
        <p>Memuat data...</p>
      </div>
    {/if}
  </Card>

  {#if finance.loading}
    <div class="animate-pulse card-surface p-8"></div>
  {:else}
    <div class="mb-3 flex justify-end">
      <MonthFilter
        months={monthOptions}
        value={filterMonth}
        onchange={(m) => (filterMonth = m)}
        label="Bulan"
      />
    </div>
    <DataTable {columns} rows={pagedRows} {getCell}>
      {#snippet children({ row }: { row: Transaction })}
        <div class="flex items-center justify-end gap-1.5">
          {#if (row.installments?.length ?? 0) > 0}
            <Button
              variant="secondary"
              iconOnly
              icon="list"
              size="sm"
              title="Lihat detail cicilan"
              onclick={() => openDetail(row)}
            />
          {/if}
          {#if row.paymentProofUrl && !row.isVerified}
            <Button
              variant="primary"
              iconOnly
              icon="verified"
              size="sm"
              title="Verifikasi pembayaran"
              onclick={() => verifyPayment(row)}
            />
            <Button
              variant="danger"
              iconOnly
              icon="block"
              size="sm"
              title="Tolak bukti pembayaran"
              onclick={() => rejectPayment(row)}
            />
          {/if}
          {#if row.paymentProofUrl}
            <a
              href={assetUrl(row.paymentProofUrl)}
              target="_blank"
              rel="external noopener"
              class="inline-flex items-center justify-center btn-secondary p-2 text-xs"
              title="Lihat bukti pembayaran"
            >
              <Icon name="visibility" size="1rem" />
            </a>
          {/if}
          <Button
            variant="secondary"
            iconOnly
            icon="edit"
            size="sm"
            title="Edit pemasukan"
            onclick={() => openEdit(row)}
          />
          <Button
            variant="danger"
            iconOnly
            icon="delete"
            size="sm"
            title="Hapus pemasukan"
            onclick={() => handleRemove(row)}
          />
        </div>
      {/snippet}
    </DataTable>
    <Pagination total={filtered.length} perPage={PER_PAGE} {page} onchange={(p) => (page = p)} />
  {/if}

  <!-- Create Modal -->
  <Modal open={showCreate} title="Tambah Pemasukan Baru" onclose={() => (showCreate = false)}>
    <form
      class="space-y-4"
      onsubmit={(e) => {
        e.preventDefault();
        handleCreate();
      }}
    >
      <div>
        <label for="billing-tenant" class="mb-1.5 block label-md text-text-secondary"
          >Penghuni</label
        >
        <Dropdown
          id="billing-tenant"
          options={tenantOptions}
          value={form.userId ?? ''}
          placeholder="Pilih penghuni"
          onselect={(v) => (form.userId = v)}
        />
      </div>
      <div>
        <label for="billing-amount-create" class="mb-1.5 block label-md text-text-secondary"
          >Jumlah (Rp)</label
        >
        <input
          id="billing-amount-create"
          type="text"
          inputmode="numeric"
          class="input-field"
          placeholder="500.000"
          value={form.amount ? formatRupiahInput(form.amount) : ''}
          oninput={(e) => (form.amount = parseRupiahInput((e.target as HTMLInputElement).value))}
          required
        />
      </div>
      <div>
        <label for="billing-desc-create" class="mb-1.5 block label-md text-text-secondary"
          >Keterangan</label
        >
        <input
          id="billing-desc-create"
          type="text"
          class="input-field"
          placeholder="Iuran bulanan / listrik / dll."
          value={form.description}
          oninput={(e) => (form.description = (e.target as HTMLInputElement).value)}
        />
      </div>
      <div>
        <label for="billing-month-create" class="mb-1.5 block label-md text-text-secondary"
          >Bulan Pemasukan</label
        >
        <input
          id="billing-month-create"
          type="text"
          class="input-field opacity-70"
          value={formatBillingMonth()}
          disabled
        />
      </div>
      <Button type="submit" icon="save" class="mt-2 w-full">Simpan Pemasukan</Button>
    </form>
  </Modal>

  <!-- Edit Modal -->
  <Modal open={showEdit} title="Edit Pemasukan" onclose={() => (showEdit = false)}>
    <form
      class="space-y-4"
      onsubmit={(e) => {
        e.preventDefault();
        handleUpdate();
      }}
    >
      <div>
        <label for="billing-amount-edit" class="mb-1.5 block label-md text-text-secondary"
          >Jumlah (Rp)</label
        >
        <input
          id="billing-amount-edit"
          type="text"
          inputmode="numeric"
          class="input-field"
          value={editForm.amount ? formatRupiahInput(editForm.amount) : ''}
          oninput={(e) =>
            (editForm.amount = parseRupiahInput((e.target as HTMLInputElement).value))}
          required
        />
      </div>
      <div>
        <label for="billing-desc-edit" class="mb-1.5 block label-md text-text-secondary"
          >Keterangan</label
        >
        <input
          id="billing-desc-edit"
          type="text"
          class="input-field"
          value={editForm.description}
          oninput={(e) => (editForm.description = (e.target as HTMLInputElement).value)}
        />
      </div>
      <div>
        <label for="billing-month-edit" class="mb-1.5 block label-md text-text-secondary"
          >Bulan Pemasukan</label
        >
        <input
          id="billing-month-edit"
          type="text"
          class="input-field opacity-70"
          value={editTx?.billingMonth ?? formatBillingMonth()}
          disabled
        />
      </div>
      <div>
        <label for="billing-status-edit" class="mb-1.5 block label-md text-text-secondary"
          >Status</label
        >
        <Dropdown
          id="billing-status-edit"
          options={[
            { value: 'unpaid', label: 'Belum Lunas' },
            { value: 'partial', label: 'Cicilan' },
            { value: 'paid', label: 'Lunas' }
          ]}
          value={editForm.status}
          onselect={(v) => (editForm.status = v)}
        />
      </div>
      <Button type="submit" icon="save" class="mt-2 w-full">Perbarui Pemasukan</Button>
    </form>
  </Modal>

  <!-- Detail Cicilan Modal -->
  <Modal open={showDetail} title="Detail Cicilan" onclose={() => (showDetail = false)}>
    {#if detailTx}
      {@const pct = Math.min(100, (Number(detailTx.totalPaid) / Number(detailTx.amount)) * 100)}
      <div class="space-y-4">
        <div class="flex justify-between">
          <div>
            <p class="body-md font-medium text-text-primary">
              {detailTx.description || detailTx.category}
            </p>
            <p class="label-md text-text-secondary">
              {detailTx.user?.name} — {detailTx.billingMonth}
            </p>
          </div>
          <div class="text-right">
            <p class="headline-sm text-text-primary">{formatRupiahDisplay(detailTx.amount)}</p>
            <p class="label-md text-text-secondary">
              Dibayar: {formatRupiahDisplay(detailTx.totalPaid)}
            </p>
          </div>
        </div>
        <div class="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
          <div class="h-full rounded-full bg-secondary transition-all" style="width: {pct}%"></div>
        </div>
        {#if detailTx.installments && detailTx.installments.length > 0}
          <div class="space-y-2">
            <p class="label-md font-medium text-text-secondary">Cicilan:</p>
            {#each detailTx.installments as inst (inst.id)}
              <div
                class="flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-2"
              >
                <div>
                  <p class="body-md text-text-primary">{formatRupiahDisplay(inst.amount)}</p>
                  {#if inst.note}<p class="label-md text-text-secondary">{inst.note}</p>{/if}
                </div>
                <div class="flex items-center gap-1.5">
                  {#if inst.isVerified}
                    <Badge variant="success">Terverifikasi</Badge>
                  {:else if inst.rejectedAt}
                    <Badge variant="danger">Ditolak</Badge>
                  {:else}
                    <Badge variant="warning">Menunggu</Badge>
                    <Button
                      variant="primary"
                      iconOnly
                      icon="verified"
                      size="sm"
                      title="Verifikasi cicilan"
                      onclick={() => verifyInstallment(inst.id)}
                    />
                    <Button
                      variant="danger"
                      iconOnly
                      icon="block"
                      size="sm"
                      title="Tolak cicilan"
                      onclick={() => rejectInstallment(inst.id)}
                    />
                  {/if}
                  {#if inst.paymentProofUrl}
                    <a
                      href={assetUrl(inst.paymentProofUrl)}
                      target="_blank"
                      rel="external noopener"
                      class="text-xs text-primary underline"
                      title="Lihat bukti">Bukti</a
                    >
                  {/if}
                  <Button
                    variant="danger"
                    iconOnly
                    icon="delete"
                    size="sm"
                    title="Hapus cicilan"
                    onclick={() => deleteInstallment(inst.id)}
                  />
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="py-4 text-center body-md text-text-secondary">Belum ada cicilan</p>
        {/if}
      </div>
    {/if}
  </Modal>

  <ConfirmDialog />
</div>
