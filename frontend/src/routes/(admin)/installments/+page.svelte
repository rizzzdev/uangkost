<script lang="ts">
  import { onMount } from 'svelte';
  import { getFinanceFeature, getTenantFeature } from '$lib/features/index.js';
  import {
    Button,
    Card,
    Chart,
    DataTable,
    Modal,
    Dropdown,
    Icon,
    Pagination,
    MonthFilter,
    ConfirmDialog,
    ProofButton,
    askConfirm,
    buildTypeBarData
  } from '$lib/ui/index.js';
  import { toast } from '$lib/ui/molecules/toast-store.svelte.js';
  import {
    formatRupiahInput,
    parseRupiahInput,
    formatRupiahDisplay,
    toDateKeyLocal,
    monthLabelFromDate,
    uniqueMonthLabels,
    useIsMobile
  } from '$lib/core/index.js';
  import type { DailyPoint } from '$lib/ui/molecules/chart-builders.js';
  import type { InstallmentWithTransaction } from '$lib/features/finance/types.js';

  const finance = getFinanceFeature();
  const tenantsFeature = getTenantFeature();

  let rows = $state<InstallmentWithTransaction[]>([]);
  let loading = $state(true);

  // Modal state
  let showCreate = $state(false);
  let showEdit = $state(false);
  let editInst = $state<InstallmentWithTransaction | null>(null);
  let createForm = $state({ transactionId: '', amount: 0, description: '' });
  let editForm = $state({ amount: 0, description: '' });
  let createFile = $state<File | null>(null);
  let busy = $state(false);

  // Pagination & filter bulan
  let page = $state(1);
  let filterMonth = $state('');
  const PER_PAGE = 10;

  onMount(async () => {
    await Promise.all([tenantsFeature.load(), finance.load('income')]);
    await loadData();
  });

  async function loadData() {
    loading = true;
    try {
      rows = await finance.getAllInstallments();
      // Segarkan juga daftar pemasukan (sumber dropdown & status sisa) agar konsisten
      await finance.refresh();
    } catch {
      toast.error('Gagal memuat data cicilan');
    } finally {
      loading = false;
    }
  }

  // Opsi pemasukan yang bisa dicicil (belum lunas)
  const billingOptions = $derived(
    finance.transactions
      .filter((t) => t.type === 'income' && t.status !== 'paid')
      .map((t) => ({
        value: t.id,
        label: `${t.user?.name ?? 'Tanpa penghuni'} — ${t.description || t.category} — ${t.billingMonth ?? monthLabelFromDate(t.transactionDate)} (${formatRupiahDisplay(Number(t.amount) - Number(t.totalPaid))} sisa)`,
        icon: 'receipt_long'
      }))
  );

  // Filter bulan tahun dari pemasukan/tagihan (data sudah terurut terbaru dulu)
  const monthOptions = $derived(uniqueMonthLabels(rows.map((r) => r.transaction.billingMonth)));

  const filteredRows = $derived(
    filterMonth ? rows.filter((r) => r.transaction.billingMonth === filterMonth) : rows
  );

  const pagedRows = $derived(filteredRows.slice((page - 1) * PER_PAGE, page * PER_PAGE));

  // Jaga halaman tetap valid saat filter/data berubah
  $effect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredRows.length / PER_PAGE));
    if (page > maxPage) page = maxPage;
  });

  // Card stats — breakdown status cicilan
  const totalCicilan = $derived(rows.reduce((s, r) => s + Number(r.amount), 0));
  const verifiedAmount = $derived(
    rows.reduce((s, r) => (r.isVerified ? s + Number(r.amount) : s), 0)
  );
  const pendingAmount = $derived(
    rows.reduce((s, r) => (!r.isVerified && !r.rejectedAt ? s + Number(r.amount) : s), 0)
  );
  const rejectedAmount = $derived(
    rows.reduce((s, r) => (r.rejectedAt ? s + Number(r.amount) : s), 0)
  );

  // Grafik cicilan 7 hari terakhir (3 di mobile) — agregasi dari tanggal pembayaran
  const isMobile = useIsMobile();
  const chartDaily = $derived.by((): DailyPoint[] => {
    const now = new Date();
    const days: DailyPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ date: key, income: 0, expense: 0 });
    }
    const byDate = new Map(days.map((d) => [d.date, d]));
    for (const r of rows) {
      // Tanggal cicilan otomatis dari createdAt (zona lokal)
      const key = toDateKeyLocal(new Date(r.createdAt));
      const entry = byDate.get(key);
      if (entry) entry.income += Number(r.amount);
    }
    return days;
  });
  const barData = $derived(buildTypeBarData(chartDaily, 'income', isMobile.value));

  const columns = ['Tanggal', 'Penghuni', 'Pemasukan', 'Jumlah', 'Status', 'Deskripsi'];

  function statusInfo(i: InstallmentWithTransaction): {
    text: string;
    badge: 'success' | 'danger' | 'warning' | 'neutral';
    icon: string;
  } {
    if (i.isVerified) return { text: 'Terverifikasi', badge: 'success', icon: 'verified' };
    if (i.rejectedAt) return { text: 'Ditolak', badge: 'danger', icon: 'block' };
    return { text: 'Menunggu', badge: 'warning', icon: 'pending' };
  }

  function getCell(
    row: InstallmentWithTransaction,
    col: string
  ): string | { text: string; icon?: string } {
    const map: Record<string, string | { text: string; icon?: string }> = {
      Tanggal: toDateKeyLocal(new Date(row.createdAt)),
      Penghuni: row.transaction.user?.name ?? '-',
      Pemasukan: row.transaction.description || row.transaction.billingMonth || '-',
      Jumlah: formatRupiahDisplay(row.amount),
      Status: { text: statusInfo(row).text, icon: statusInfo(row).icon },
      Deskripsi: row.description ?? '-'
    };
    return map[col] ?? '';
  }

  function openCreate() {
    createForm = { transactionId: '', amount: 0, description: '' };
    createFile = null;
    showCreate = true;
  }

  async function handleCreate() {
    if (!createForm.transactionId) {
      toast.error('Pilih pemasukan');
      return;
    }
    if (createForm.amount <= 0) {
      toast.error('Masukkan jumlah');
      return;
    }
    busy = true;
    try {
      await finance.createInstallmentByAdmin(
        createForm.transactionId,
        {
          amount: createForm.amount,
          description: createForm.description || undefined
        },
        createFile ?? undefined
      );
      showCreate = false;
      toast.success('Cicilan ditambahkan');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menambah');
    } finally {
      busy = false;
    }
  }

  function openEdit(i: InstallmentWithTransaction) {
    editInst = i;
    editForm = {
      amount: Number(i.amount),
      description: i.description ?? ''
    };
    showEdit = true;
  }

  async function handleUpdate() {
    if (!editInst) return;
    busy = true;
    try {
      await finance.updateInstallment(editInst.id, {
        amount: editForm.amount > 0 ? editForm.amount : undefined,
        description: editForm.description || null
      });
      showEdit = false;
      editInst = null;
      toast.success('Cicilan diperbarui');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memperbarui');
    } finally {
      busy = false;
    }
  }

  async function verifyInstallment(i: InstallmentWithTransaction) {
    const ok = await askConfirm({
      title: 'Verifikasi Cicilan',
      message: `Verifikasi cicilan ${formatRupiahDisplay(i.amount)}? Jumlah akan ditambahkan ke pembayaran tagihan.`,
      variant: 'primary'
    });
    if (!ok) return;
    try {
      await finance.verifyInstallment(i.id);
      toast.success('Cicilan diverifikasi');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal verifikasi');
    }
  }

  async function rejectInstallment(i: InstallmentWithTransaction) {
    const ok = await askConfirm({
      title: 'Tolak Cicilan',
      message: 'Tolak cicilan ini? Jumlah tidak akan dihitung ke pembayaran tagihan.'
    });
    if (!ok) return;
    try {
      await finance.rejectInstallment(i.id);
      toast.info('Cicilan ditolak');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menolak');
    }
  }

  async function deleteInstallment(i: InstallmentWithTransaction) {
    const ok = await askConfirm({
      title: 'Hapus Cicilan',
      message: `Hapus cicilan ${formatRupiahDisplay(i.amount)}? Total yang sudah dibayar akan disesuaikan.`
    });
    if (!ok) return;
    try {
      await finance.deleteInstallment(i.id);
      toast.info('Cicilan dihapus');
      await loadData();
    } catch {
      toast.error('Gagal menghapus');
    }
  }
</script>

<svelte:head>
  <title>uangkost — Cicilan</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div>
      <h1 class="headline-lg text-text-primary">Cicilan</h1>
      <p class="mt-1 body-md text-text-secondary">Kelola cicilan pembayaran penghuni</p>
    </div>
    <Button icon="add" onclick={openCreate}>Tambah Cicilan</Button>
  </div>

  <!-- Total Card (mirror halaman Pemasukan) -->
  <div
    class="card-surface border-tertiary/20 bg-gradient-to-br from-tertiary/10 to-tertiary/5 p-5 card-glow"
  >
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-tertiary/20">
        <Icon name="payments" class="text-tertiary" />
      </div>
      <div>
        <span class="label-md text-text-secondary">Total Cicilan</span>
        <p class="headline-md text-text-primary">{formatRupiahDisplay(totalCicilan)}</p>
      </div>
    </div>
    <p class="mt-2 label-md text-text-secondary">
      Terverifikasi:
      <span class="font-medium text-secondary">{formatRupiahDisplay(verifiedAmount)}</span>
      · Menunggu:
      <span class="font-medium text-tertiary">{formatRupiahDisplay(pendingAmount)}</span>
      · Ditolak:
      <span class="font-medium text-error">{formatRupiahDisplay(rejectedAmount)}</span>
    </p>
  </div>

  <Card>
    <h2 class="mb-4 flex items-center gap-2 headline-sm text-text-primary">
      <Icon name="bar_chart" size="1.25rem" class="text-tertiary" />
      Grafik Cicilan {isMobile.value ? '3' : '7'} Hari Terakhir
    </h2>
    {#if rows.length > 0}
      <Chart type="bar" data={barData} />
    {:else}
      <div class="flex h-[260px] items-center justify-center text-text-secondary">
        <p>Belum ada data cicilan</p>
      </div>
    {/if}
  </Card>

  {#if loading}
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
    <DataTable {columns} rows={pagedRows} {getCell} emptyMessage="Belum ada data cicilan">
      {#snippet children({ row }: { row: InstallmentWithTransaction })}
        <div class="flex items-center justify-end gap-1.5">
          <ProofButton url={row.paymentProofUrl} title="Lihat bukti cicilan" />
          <Button
            variant="primary"
            iconOnly
            icon="verified"
            size="sm"
            title="Verifikasi cicilan"
            disabled={row.isVerified || Boolean(row.rejectedAt)}
            onclick={() => verifyInstallment(row)}
          />
          <Button
            variant="danger"
            iconOnly
            icon="block"
            size="sm"
            title="Tolak cicilan"
            disabled={row.isVerified || Boolean(row.rejectedAt)}
            onclick={() => rejectInstallment(row)}
          />
          <Button
            variant="secondary"
            iconOnly
            icon="edit"
            size="sm"
            title="Edit cicilan"
            onclick={() => openEdit(row)}
          />
          <Button
            variant="danger"
            iconOnly
            icon="delete"
            size="sm"
            title="Hapus cicilan"
            onclick={() => deleteInstallment(row)}
          />
        </div>
      {/snippet}
    </DataTable>
    <Pagination
      total={filteredRows.length}
      perPage={PER_PAGE}
      {page}
      onchange={(p) => (page = p)}
    />
  {/if}

  <!-- Create Modal -->
  <Modal open={showCreate} title="Tambah Cicilan" onclose={() => (showCreate = false)}>
    <form
      class="space-y-4"
      onsubmit={(e) => {
        e.preventDefault();
        handleCreate();
      }}
    >
      <div>
        <label for="installment-billing" class="mb-1.5 block label-md text-text-secondary"
          >Pemasukan</label
        >
        {#if billingOptions.length === 0}
          <p class="body-md text-text-secondary">Tidak ada pemasukan yang belum lunas.</p>
        {:else}
          <Dropdown
            id="installment-billing"
            options={billingOptions}
            value={createForm.transactionId}
            placeholder="Pilih pemasukan"
            onselect={(v) => (createForm.transactionId = v)}
          />
        {/if}
      </div>
      <div>
        <label for="installment-amount-create" class="mb-1.5 block label-md text-text-secondary"
          >Jumlah (Rp)</label
        >
        <input
          id="installment-amount-create"
          type="text"
          inputmode="numeric"
          class="input-field"
          placeholder="100.000"
          value={createForm.amount ? formatRupiahInput(createForm.amount) : ''}
          oninput={(e) =>
            (createForm.amount = parseRupiahInput((e.target as HTMLInputElement).value))}
          required
        />
      </div>
      <div>
        <label
          for="installment-description-create"
          class="mb-1.5 block label-md text-text-secondary">Deskripsi</label
        >
        <input
          id="installment-description-create"
          type="text"
          class="input-field"
          placeholder="Cicilan ke-1..."
          value={createForm.description}
          oninput={(e) => (createForm.description = (e.target as HTMLInputElement).value)}
        />
      </div>
      <div>
        <label for="installment-proof-create" class="mb-1.5 block label-md text-text-secondary"
          >Bukti Pembayaran (opsional)</label
        >
        <input
          id="installment-proof-create"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          class="input-field w-full text-sm file:mr-2 file:cursor-pointer file:btn-primary"
          onchange={(e) => {
            const el = e.target as HTMLInputElement;
            createFile = el.files?.[0] ?? null;
          }}
        />
      </div>
      <Button
        type="submit"
        icon="save"
        class="mt-2 w-full"
        disabled={busy || billingOptions.length === 0}
      >
        {busy ? 'Menyimpan...' : 'Simpan Cicilan'}
      </Button>
    </form>
  </Modal>

  <!-- Edit Modal -->
  <Modal open={showEdit} title="Edit Cicilan" onclose={() => (showEdit = false)}>
    {#if editInst}
      <form
        class="space-y-4"
        onsubmit={(e) => {
          e.preventDefault();
          handleUpdate();
        }}
      >
        <div class="rounded-lg bg-surface-container-low px-3 py-2.5">
          <p class="label-md text-text-secondary">Pemasukan</p>
          <p class="body-md text-text-primary">
            {editInst.transaction.user?.name ?? '-'} — {editInst.transaction.description ||
              editInst.transaction.billingMonth}
          </p>
        </div>
        <div>
          <label for="installment-amount-edit" class="mb-1.5 block label-md text-text-secondary"
            >Jumlah (Rp)</label
          >
          <input
            id="installment-amount-edit"
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
          <label
            for="installment-description-edit"
            class="mb-1.5 block label-md text-text-secondary">Deskripsi</label
          >
          <input
            id="installment-description-edit"
            type="text"
            class="input-field"
            placeholder="Cicilan ke-2..."
            value={editForm.description}
            oninput={(e) => (editForm.description = (e.target as HTMLInputElement).value)}
          />
        </div>
        <Button type="submit" icon="save" class="mt-2 w-full" disabled={busy}>
          {busy ? 'Menyimpan...' : 'Perbarui Cicilan'}
        </Button>
      </form>
    {/if}
  </Modal>

  <ConfirmDialog />
</div>
