<script lang="ts">
  import { onMount } from 'svelte';
  import { getFinanceFeature } from '$lib/features/index.js';
  import {
    Button,
    Card,
    Chart,
    DataTable,
    Modal,
    Icon,
    Pagination,
    MonthFilter,
    ConfirmDialog,
    askConfirm,
    buildTypeBarData
  } from '$lib/ui/index.js';
  import { toast } from '$lib/ui/molecules/toast-store.svelte.js';
  import { API_BASE_URL } from '$lib/core/api-client.js';
  import {
    formatRupiahInput,
    parseRupiahInput,
    formatRupiahDisplay,
    monthLabelFromDate,
    uniqueMonthLabels,
    getTodayLocal,
    assetUrl,
    useIsMobile
  } from '$lib/core/index.js';
  import type { Transaction } from '$lib/features/finance/types.js';
  import type { ChartData } from '$lib/features/finance/index.svelte.js';

  const finance = getFinanceFeature();

  let showCreate = $state(false);
  let showEdit = $state(false);
  let editTx = $state<Transaction | null>(null);
  let uploadFile = $state<File | null>(null);
  let uploading = $state(false);
  let page = $state(1);
  let filterMonth = $state('');
  const PER_PAGE = 10;

  const today = getTodayLocal();

  let form = $state({ amount: 0, description: '', transactionDate: today });
  let editForm = $state({ amount: 0, description: '', transactionDate: today });

  let chartData = $state<ChartData | null>(null);
  const isMobile = useIsMobile();
  const barData = $derived(buildTypeBarData(chartData?.daily ?? [], 'expense', isMobile.value));

  async function loadCharts() {
    try {
      chartData = await finance.getChartData();
    } catch {
      /* silent */
    }
  }

  onMount(() => {
    finance.load('expense');
    loadCharts();
  });

  const columns = ['Tanggal', 'Deskripsi', 'Jumlah'];

  function getCell(row: Transaction, col: string): string | { text: string; icon?: string } {
    const map: Record<string, string | { text: string; icon?: string }> = {
      Tanggal: row.transactionDate,
      Deskripsi: row.description || row.category,
      Jumlah: { text: formatRupiahDisplay(row.amount), icon: 'trending_down' }
    };
    return map[col] ?? '';
  }

  async function handleCreate() {
    uploading = true;
    try {
      const input = {
        type: 'expense' as const,
        amount: Number(form.amount),
        description: form.description,
        transactionDate: form.transactionDate
      };

      if (uploadFile) {
        const fd = new FormData();
        fd.append('type', 'expense');
        fd.append('amount', String(form.amount));
        fd.append('description', form.description);
        fd.append('transactionDate', form.transactionDate);
        fd.append('paymentProof', uploadFile);
        await fetch(`${API_BASE_URL}/finance/expense-with-proof`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${document.cookie.match(/(?:^|;\s*)access_token=([^;]*)/)?.[1] ?? ''}`
          },
          credentials: 'include',
          body: fd
        }).then(async (r) => {
          if (!r.ok) {
            const b = await r.json().catch(() => ({}));
            throw new Error(b.message ?? 'Upload failed');
          }
        });
        await finance.load('expense'); // refetch tabel (create via fetch mentah tidak otomatis)
      } else {
        await finance.create(input);
      }

      showCreate = false;
      form = { amount: 0, description: '', transactionDate: today };
      uploadFile = null;
      toast.success('Pengeluaran dicatat');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Gagal: ${msg}`);
    } finally {
      uploading = false;
    }
  }

  function openEdit(tx: Transaction) {
    editTx = tx;
    editForm = {
      amount: Number(tx.amount),
      description: tx.description ?? '',
      transactionDate: tx.transactionDate
    };
    showEdit = true;
  }

  async function handleUpdate() {
    if (!editTx) return;
    try {
      await finance.update(editTx.id, {
        amount: Number(editForm.amount),
        description: editForm.description || null,
        transactionDate: editForm.transactionDate
      });
      showEdit = false;
      editTx = null;
      toast.success('Pengeluaran diperbarui');
      await finance.load('expense');
    } catch {
      toast.error('Gagal memperbarui');
    }
  }

  async function handleRemove(tx: Transaction) {
    const ok = await askConfirm({
      title: 'Hapus Pengeluaran',
      message: `Hapus pengeluaran sebesar ${formatRupiahDisplay(tx.amount)}?`
    });
    if (!ok) return;
    try {
      await finance.remove(tx.id);
      toast.info('Pengeluaran dihapus');
    } catch {
      toast.error('Gagal menghapus');
    }
  }

  const totalExpense = $derived(finance.transactions.reduce((s, t) => s + Number(t.amount), 0));

  const monthOptions = $derived(
    uniqueMonthLabels(finance.transactions.map((t) => monthLabelFromDate(t.transactionDate)))
  );

  const filtered = $derived(
    filterMonth
      ? finance.transactions.filter((t) => monthLabelFromDate(t.transactionDate) === filterMonth)
      : finance.transactions
  );

  const pagedRows = $derived(filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE));

  // Jaga halaman tetap valid saat filter/data berubah
  $effect(() => {
    const maxPage = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    if (page > maxPage) page = maxPage;
  });
</script>

<svelte:head>
  <title>uangkost — Pengeluaran</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div>
      <h1 class="headline-lg text-text-primary">Pengeluaran</h1>
      <p class="mt-1 body-md text-text-secondary">Catat pengeluaran operasional kost</p>
    </div>
    <Button icon="add" onclick={() => (showCreate = true)}>Tambah Pengeluaran</Button>
  </div>

  <!-- Total Card -->
  <div
    class="card-surface border-error/20 bg-gradient-to-br from-error/10 to-error/5 p-5 card-glow"
  >
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-error/20">
        <Icon name="trending_down" class="text-error" />
      </div>
      <div>
        <span class="label-md text-text-secondary">Total Pengeluaran</span>
        <p class="headline-md text-text-primary">{formatRupiahDisplay(totalExpense)}</p>
      </div>
    </div>
  </div>

  <Card>
    <h2 class="mb-4 flex items-center gap-2 headline-sm text-text-primary">
      <Icon name="bar_chart" size="1.25rem" class="text-error" />
      Grafik Pengeluaran {isMobile.value ? '3' : '7'} Hari Terakhir
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
          {#if row.paymentProofUrl}
            <a
              href={assetUrl(row.paymentProofUrl)}
              target="_blank"
              rel="external noopener"
              class="inline-flex items-center justify-center btn-secondary p-2 text-xs"
              title="Lihat bukti pengeluaran"
            >
              <Icon name="visibility" size="1rem" />
            </a>
          {/if}
          <Button
            variant="secondary"
            iconOnly
            icon="edit"
            size="sm"
            title="Edit pengeluaran"
            onclick={() => openEdit(row)}
          />
          <Button
            variant="danger"
            iconOnly
            icon="delete"
            size="sm"
            title="Hapus pengeluaran"
            onclick={() => handleRemove(row)}
          />
        </div>
      {/snippet}
    </DataTable>
    <Pagination total={filtered.length} perPage={PER_PAGE} {page} onchange={(p) => (page = p)} />
  {/if}

  <!-- Create Modal -->
  <Modal open={showCreate} title="Tambah Pengeluaran" onclose={() => (showCreate = false)}>
    <form
      class="space-y-4"
      onsubmit={(e) => {
        e.preventDefault();
        handleCreate();
      }}
    >
      <div>
        <label for="expense-amount-create" class="mb-1.5 block label-md text-text-secondary"
          >Jumlah (Rp)</label
        >
        <input
          id="expense-amount-create"
          type="text"
          inputmode="numeric"
          class="input-field"
          placeholder="150.000"
          value={form.amount ? formatRupiahInput(form.amount) : ''}
          oninput={(e) => (form.amount = parseRupiahInput((e.target as HTMLInputElement).value))}
          required
        />
      </div>
      <div>
        <label for="expense-date-create" class="mb-1.5 block label-md text-text-secondary"
          >Tanggal</label
        >
        <input
          id="expense-date-create"
          type="date"
          class="input-field"
          value={form.transactionDate}
          oninput={(e) => (form.transactionDate = (e.target as HTMLInputElement).value)}
          required
        />
      </div>
      <div>
        <label for="expense-desc-create" class="mb-1.5 block label-md text-text-secondary"
          >Deskripsi</label
        >
        <textarea
          id="expense-desc-create"
          class="input-field"
          rows="2"
          placeholder="Bayar listrik bulan Agustus..."
          value={form.description}
          oninput={(e) => (form.description = (e.target as HTMLTextAreaElement).value)}></textarea>
      </div>
      <div>
        <label for="expense-proof-create" class="mb-1.5 block label-md text-text-secondary"
          >Bukti Pembayaran (opsional)</label
        >
        <input
          id="expense-proof-create"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          class="input-field w-full text-sm file:mr-2 file:cursor-pointer file:btn-primary"
          onchange={(e) => {
            const el = e.target as HTMLInputElement;
            uploadFile = el.files?.[0] ?? null;
          }}
        />
      </div>
      <Button type="submit" icon="save" class="mt-2 w-full" disabled={uploading}>
        {uploading ? 'Menyimpan...' : 'Simpan Pengeluaran'}
      </Button>
    </form>
  </Modal>

  <!-- Edit Modal -->
  <Modal open={showEdit} title="Edit Pengeluaran" onclose={() => (showEdit = false)}>
    <form
      class="space-y-4"
      onsubmit={(e) => {
        e.preventDefault();
        handleUpdate();
      }}
    >
      <div>
        <label for="expense-amount-edit" class="mb-1.5 block label-md text-text-secondary"
          >Jumlah (Rp)</label
        >
        <input
          id="expense-amount-edit"
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
        <label for="expense-date-edit" class="mb-1.5 block label-md text-text-secondary"
          >Tanggal</label
        >
        <input
          id="expense-date-edit"
          type="date"
          class="input-field"
          value={editForm.transactionDate}
          oninput={(e) => (editForm.transactionDate = (e.target as HTMLInputElement).value)}
          required
        />
      </div>
      <div>
        <label for="expense-desc-edit" class="mb-1.5 block label-md text-text-secondary"
          >Deskripsi</label
        >
        <textarea
          id="expense-desc-edit"
          class="input-field"
          rows="2"
          placeholder="Bayar listrik bulan Agustus..."
          value={editForm.description}
          oninput={(e) => (editForm.description = (e.target as HTMLTextAreaElement).value)}
        ></textarea>
      </div>
      <Button type="submit" icon="save" class="mt-2 w-full">Perbarui Pengeluaran</Button>
    </form>
  </Modal>

  <ConfirmDialog />
</div>
