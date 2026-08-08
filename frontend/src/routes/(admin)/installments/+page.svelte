<script lang="ts">
  import { onMount } from 'svelte';
  import { getFinanceFeature, getTenantFeature } from '$lib/features/index.js';
  import {
    Button,
    DataTable,
    Modal,
    Dropdown,
    Icon,
    Pagination,
    ConfirmDialog,
    askConfirm
  } from '$lib/ui/index.js';
  import { toast } from '$lib/ui/molecules/toast-store.svelte.js';
  import {
    formatRupiahInput,
    parseRupiahInput,
    formatRupiahDisplay,
    assetUrl
  } from '$lib/core/index.js';
  import type { InstallmentWithTransaction } from '$lib/features/finance/types.js';

  const finance = getFinanceFeature();
  const tenantsFeature = getTenantFeature();

  let rows = $state<InstallmentWithTransaction[]>([]);
  let loading = $state(true);

  // Modal state
  let showCreate = $state(false);
  let showEdit = $state(false);
  let editInst = $state<InstallmentWithTransaction | null>(null);
  let createForm = $state({ transactionId: '', amount: 0, note: '' });
  let editForm = $state({ amount: 0, note: '' });
  let createFile = $state<File | null>(null);
  let busy = $state(false);

  // Pagination
  let page = $state(1);
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
        label: `${t.user?.name ?? 'Tanpa penghuni'} — ${t.description || t.category} (${formatRupiahDisplay(Number(t.amount) - Number(t.totalPaid))} sisa)`,
        icon: 'receipt_long'
      }))
  );

  const pagedRows = $derived(rows.slice((page - 1) * PER_PAGE, page * PER_PAGE));

  $effect(() => {
    const maxPage = Math.max(1, Math.ceil(rows.length / PER_PAGE));
    if (page > maxPage) page = maxPage;
  });

  const columns = ['Tanggal', 'Penghuni', 'Pemasukan', 'Jumlah', 'Status', 'Catatan'];

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
      Tanggal: row.createdAt ? new Date(row.createdAt).toLocaleDateString('id-ID') : '-',
      Penghuni: row.transaction.user?.name ?? '-',
      Pemasukan: row.transaction.description || row.transaction.billingMonth || '-',
      Jumlah: formatRupiahDisplay(row.amount),
      Status: { text: statusInfo(row).text, icon: statusInfo(row).icon },
      Catatan: row.note ?? '-'
    };
    return map[col] ?? '';
  }

  function openCreate() {
    createForm = { transactionId: '', amount: 0, note: '' };
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
        { amount: createForm.amount, note: createForm.note || undefined },
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
    editForm = { amount: Number(i.amount), note: i.note ?? '' };
    showEdit = true;
  }

  async function handleUpdate() {
    if (!editInst) return;
    busy = true;
    try {
      await finance.updateInstallment(editInst.id, {
        amount: editForm.amount > 0 ? editForm.amount : undefined,
        note: editForm.note || null
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

  {#if loading}
    <div class="animate-pulse card-surface p-8"></div>
  {:else}
    <DataTable {columns} rows={pagedRows} {getCell} emptyMessage="Belum ada data cicilan">
      {#snippet children({ row }: { row: InstallmentWithTransaction })}
        <div class="flex items-center justify-end gap-1.5">
          {#if row.paymentProofUrl}
            <a
              href={assetUrl(row.paymentProofUrl)}
              target="_blank"
              rel="external noopener"
              class="inline-flex items-center justify-center btn-secondary p-2 text-xs"
              title="Lihat bukti"
            >
              <Icon name="visibility" size="1rem" />
            </a>
          {/if}
          {#if !row.isVerified && !row.rejectedAt}
            <Button
              variant="primary"
              iconOnly
              icon="verified"
              size="sm"
              title="Verifikasi cicilan"
              onclick={() => verifyInstallment(row)}
            />
            <Button
              variant="danger"
              iconOnly
              icon="block"
              size="sm"
              title="Tolak cicilan"
              onclick={() => rejectInstallment(row)}
            />
          {/if}
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
    <Pagination total={rows.length} perPage={PER_PAGE} {page} onchange={(p) => (page = p)} />
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
        <label for="installment-note-create" class="mb-1.5 block label-md text-text-secondary"
          >Catatan (opsional)</label
        >
        <input
          id="installment-note-create"
          type="text"
          class="input-field"
          placeholder="Cicilan ke-1..."
          value={createForm.note}
          oninput={(e) => (createForm.note = (e.target as HTMLInputElement).value)}
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
          <label for="installment-note-edit" class="mb-1.5 block label-md text-text-secondary"
            >Catatan</label
          >
          <input
            id="installment-note-edit"
            type="text"
            class="input-field"
            value={editForm.note}
            oninput={(e) => (editForm.note = (e.target as HTMLInputElement).value)}
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
