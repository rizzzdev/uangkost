<script lang="ts">
  import { onMount } from 'svelte';
  import { getSettingsFeature, getWaFeature, type Settings } from '$lib/features/index.js';
  import { askConfirm, Badge, Button, Card, DataTable, Dropdown, Icon, Pagination } from '$lib/ui/index.js';
  import { toast } from '$lib/ui/molecules/toast-store.svelte.js';
  import { api, assetUrl, formatRupiahInput, parseRupiahInput, toDateKeyLocal } from '$lib/core/index.js';

  const settingsFeature = getSettingsFeature();
  const wa = getWaFeature();

  // Default jadwal mengikuti fallback backend (queue.ts)
  const DEFAULT_REMINDER_TIME = '08:00';
  const DEFAULT_BILL_TIME = '00:05';
  const DEFAULT_FREQUENCY = 'daily';

  const FREQUENCY_OPTIONS = [
    { value: 'daily', label: 'Setiap hari' },
    { value: 'weekly', label: 'Setiap minggu' },
    { value: 'monthly', label: 'Setiap bulan' }
  ];

  // 0=Minggu .. 6=Sabtu
  const WEEKDAY_OPTIONS = [
    { value: '0', label: 'Min' },
    { value: '1', label: 'Sen' },
    { value: '2', label: 'Sel' },
    { value: '3', label: 'Rab' },
    { value: '4', label: 'Kam' },
    { value: '5', label: 'Jum' },
    { value: '6', label: 'Sab' }
  ];

  const WEEKDAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const DATE_OPTIONS = Array.from({ length: 31 }, (_, i) => String(i + 1));

  function toggleChip(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  function scheduleLabel(freq: string, time: string, weekdays: string[], dates: string[]): string {
    const suffix = time ? `pukul ${time}` : '';
    switch (freq) {
      case 'weekly': {
        const days = weekdays
          .map((d) => WEEKDAY_NAMES[Number(d)])
          .filter(Boolean)
          .join(', ');
        return days ? `Setiap minggu: ${days} ${suffix}`.trim() : `Setiap minggu ${suffix}`.trim();
      }
      case 'monthly': {
        const ds = [...dates].sort((a, b) => Number(a) - Number(b));
        return ds.length
          ? `Tanggal ${ds.join(', ')} ${suffix}`.trim()
          : `Setiap bulan ${suffix}`.trim();
      }
      default:
        return `Setiap hari ${suffix}`.trim();
    }
  }

  let form = $state({
    kostName: '',
    bankAccountInfo: '',
    defaultBillAmount: 0,
    reminderTime: DEFAULT_REMINDER_TIME,
    reminderFrequency: DEFAULT_FREQUENCY,
    reminderWeekdays: ['1'],
    reminderDates: ['1'],
    billCreationTime: DEFAULT_BILL_TIME,
    billCreationFrequency: DEFAULT_FREQUENCY,
    billCreationWeekdays: ['1'],
    billCreationDates: ['1']
  });
  let botWa = $state(false);
  let sending = $state(false);
  let creatingBills = $state(false);
  let savingSchedule = $state(false);
  let qrisUploading = $state(false);

  function toForm(s: Settings | null) {
    const parseList = (raw: string | null | undefined): string[] =>
      raw?.split(',').filter(Boolean) ?? [];
    return {
      kostName: s?.kostName ?? '',
      bankAccountInfo: s?.bankAccountInfo ?? '',
      defaultBillAmount: Number(s?.defaultBillAmount ?? 0),
      reminderTime: s?.reminderTime ?? DEFAULT_REMINDER_TIME,
      reminderFrequency: s?.reminderFrequency ?? DEFAULT_FREQUENCY,
      reminderWeekdays: parseList(s?.reminderWeekdays).length
        ? parseList(s?.reminderWeekdays)
        : ['1'],
      reminderDates: parseList(s?.reminderDates).length ? parseList(s?.reminderDates) : ['1'],
      billCreationTime: s?.billCreationTime ?? DEFAULT_BILL_TIME,
      billCreationFrequency: s?.billCreationFrequency ?? DEFAULT_FREQUENCY,
      billCreationWeekdays: parseList(s?.billCreationWeekdays).length
        ? parseList(s?.billCreationWeekdays)
        : ['1'],
      billCreationDates: parseList(s?.billCreationDates).length
        ? parseList(s?.billCreationDates)
        : ['1']
    };
  }

  interface SchedulerLogItem {
    id: string;
    type: 'reminder' | 'bill_creation';
    status: 'success' | 'failed' | 'skipped';
    title: string;
    message: string;
    details?: Record<string, unknown>;
    createdAt: string;
  }

  interface SchedulerLogsResponse {
    logs: SchedulerLogItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }

  let schedulerLogs = $state<SchedulerLogItem[]>([]);
  let logsLoading = $state(false);
  let logTypeFilter = $state<'all' | 'reminder' | 'bill_creation'>('all');
  let logStatusFilter = $state<'all' | 'success' | 'failed' | 'skipped'>('all');
  let clearingLogs = $state(false);
  let logsPage = $state(1);
  let logsTotal = $state(0);
  const LOGS_PER_PAGE = 10;

  const LOG_TYPE_OPTIONS = [
    { value: 'all', label: 'Semua Tipe', icon: 'filter_list' },
    { value: 'reminder', label: 'Pengingat WA', icon: 'chat' },
    { value: 'bill_creation', label: 'Tagihan Otomatis', icon: 'receipt_long' }
  ];

  const LOG_STATUS_OPTIONS = [
    { value: 'all', label: 'Semua Status', icon: 'filter_alt' },
    { value: 'success', label: 'Berhasil', icon: 'check_circle' },
    { value: 'failed', label: 'Gagal', icon: 'error' },
    { value: 'skipped', label: 'Dilewati', icon: 'info' }
  ];

  const logColumns = ['Waktu', 'Tipe', 'Status', 'Pesan / Rincian'];

  function getLogCell(
    row: SchedulerLogItem,
    col: string
  ): string | { text: string; icon?: string } {
    const d = new Date(row.createdAt);
    const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const dateStr = `${toDateKeyLocal(d)} ${timeStr}`;
    const map: Record<string, string | { text: string; icon?: string }> = {
      Waktu: dateStr,
      Tipe: row.type === 'reminder' ? 'Pengingat WA' : 'Tagihan Otomatis',
      Status: {
        text: row.status === 'success' ? 'Berhasil' : row.status === 'failed' ? 'Gagal' : 'Dilewati',
        icon: row.status === 'success' ? 'check_circle' : row.status === 'failed' ? 'error' : 'info'
      },
      'Pesan / Rincian': `${row.title} — ${row.message}`
    };
    return map[col] ?? '';
  }

  async function loadSchedulerLogs(targetPage = 1) {
    logsLoading = true;
    logsPage = targetPage;
    try {
      const params = new URLSearchParams();
      if (logTypeFilter !== 'all') params.append('type', logTypeFilter);
      if (logStatusFilter !== 'all') params.append('status', logStatusFilter);
      params.append('page', String(targetPage));
      params.append('limit', String(LOGS_PER_PAGE));
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get<SchedulerLogsResponse>(`/scheduler/logs${query}`);
      schedulerLogs = res.logs ?? [];
      logsTotal = res.pagination?.total ?? schedulerLogs.length;
    } catch (err) {
      console.error('Gagal memuat log scheduler:', err);
    } finally {
      logsLoading = false;
    }
  }

  async function handleClearLogs() {
    const confirmClear = await askConfirm({
      title: 'Hapus Log Penjadwalan',
      message: 'Apakah Anda yakin ingin menghapus seluruh riwayat log penjadwalan otomatis?',
      confirmText: 'Hapus Semua Log',
      variant: 'danger'
    });
    if (!confirmClear) return;

    clearingLogs = true;
    try {
      await api.delete('/scheduler/logs');
      schedulerLogs = [];
      toast.success('Log penjadwalan berhasil dibersihkan');
    } catch {
      toast.error('Gagal menghapus log');
    } finally {
      clearingLogs = false;
    }
  }

  onMount(async () => {
    await settingsFeature.load();
    form = toForm(settingsFeature.settings);
    botWa = settingsFeature.settings?.botWaStatus ?? false;
    await wa.fetchStatus();
    await loadSchedulerLogs();
  });

  async function handleUploadQris(e: Event) {
    const el = e.target as HTMLInputElement;
    const file = el.files?.[0];
    if (!file) return;
    qrisUploading = true;
    try {
      await settingsFeature.uploadQris(file);
      toast.success('Foto QRIS diperbarui');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Gagal: ${msg}`);
    } finally {
      qrisUploading = false;
      el.value = '';
    }
  }

  async function handleSave(e: Event) {
    e.preventDefault();
    try {
      const updated = await settingsFeature.save({
        kostName: form.kostName,
        bankAccountInfo: form.bankAccountInfo,
        defaultBillAmount: form.defaultBillAmount > 0 ? form.defaultBillAmount : null
      });
      form = toForm(updated);
      toast.success('Pengaturan disimpan');
    } catch {
      toast.error('Gagal menyimpan');
    }
  }

  async function handleSaveSchedule() {
    savingSchedule = true;
    try {
      const updated = await settingsFeature.save({
        reminderTime: form.reminderTime || null,
        reminderFrequency: form.reminderFrequency || null,
        reminderWeekdays: form.reminderWeekdays.length ? form.reminderWeekdays.join(',') : null,
        reminderDates: form.reminderDates.length ? form.reminderDates.join(',') : null,
        billCreationTime: form.billCreationTime || null,
        billCreationFrequency: form.billCreationFrequency || null,
        billCreationWeekdays: form.billCreationWeekdays.length
          ? form.billCreationWeekdays.join(',')
          : null,
        billCreationDates: form.billCreationDates.length ? form.billCreationDates.join(',') : null
      });
      form = toForm(updated);
      toast.success('Jadwal disimpan — berlaku otomatis tanpa restart');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan jadwal';
      toast.error(msg);
    } finally {
      savingSchedule = false;
    }
  }

  async function handleCreateBills() {
    if (!form.defaultBillAmount || form.defaultBillAmount <= 0) {
      toast.warning('Isi nominal tagihan default dulu, lalu simpan pengaturan');
      return;
    }
    creatingBills = true;
    try {
      const msg = await settingsFeature.triggerCreateBills();
      toast.success(msg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Gagal: ${msg}`);
    } finally {
      creatingBills = false;
      await loadSchedulerLogs();
    }
  }

  async function handleToggleWa(e: Event) {
    const next = (e.target as HTMLInputElement).checked;
    botWa = next;
    try {
      await settingsFeature.save({ botWaStatus: next });
      toast.success(next ? 'Notifikasi otomatis aktif' : 'Notifikasi nonaktif');
    } catch {
      botWa = !next;
      toast.error('Gagal menyimpan');
    }
  }

  async function handleSendReminder() {
    if (!wa.connected) {
      toast.warning('FONNTE_TOKEN belum dikonfigurasi di .env backend');
      return;
    }
    sending = true;
    try {
      const res = await wa.triggerScan();
      toast.success(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[WA] triggerScan error:', msg);
      toast.error(`Gagal: ${msg}`);
    } finally {
      sending = false;
      await loadSchedulerLogs();
    }
  }
</script>

<svelte:head>
  <title>Pengaturan — uangkost</title>
</svelte:head>

<div class="space-y-6">
  <div>
    <h1 class="headline-lg text-text-primary">Pengaturan</h1>
    <p class="mt-1 body-md text-text-secondary">Konfigurasi sistem kost</p>
  </div>

  {#if settingsFeature.loading}
    <div class="animate-pulse card-surface p-8"></div>
  {:else}
    <Card>
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tertiary/20">
          <Icon name="settings_applications" class="text-tertiary" />
        </div>
        <div class="flex-1">
          <h2 class="headline-sm text-text-primary">Pengaturan Umum</h2>
          <p class="body-md text-text-secondary">
            Nama kost, rekening bank, tagihan default & QRIS
          </p>
        </div>
      </div>
      <form onsubmit={handleSave} class="space-y-4">
        <div>
          <label for="kost-name" class="mb-1.5 block label-md text-text-secondary">Nama Kost</label>
          <input
            id="kost-name"
            type="text"
            class="input-field"
            placeholder="Kost Bahagia"
            value={form.kostName}
            oninput={(e) => (form.kostName = (e.target as HTMLInputElement).value)}
          />
        </div>
        <div>
          <label for="bank-info" class="mb-1.5 block label-md text-text-secondary"
            >Info Rekening Bank</label
          >
          <textarea
            id="bank-info"
            class="input-field"
            rows="3"
            placeholder="BCA: 1234567890 a.n. Pemilik Kost"
            value={form.bankAccountInfo}
            oninput={(e) => (form.bankAccountInfo = (e.target as HTMLTextAreaElement).value)}
          ></textarea>
          <p class="mt-1 label-md text-text-secondary">
            Info ini akan ditampilkan ke penghuni saat membayar
          </p>
        </div>

        <div>
          <label for="default-bill" class="mb-1.5 block label-md text-text-secondary"
            >Tagihan Default (Rp) — opsional</label
          >
          <input
            id="default-bill"
            type="text"
            inputmode="numeric"
            class="input-field"
            placeholder="500.000"
            value={form.defaultBillAmount ? formatRupiahInput(form.defaultBillAmount) : ''}
            oninput={(e) =>
              (form.defaultBillAmount = parseRupiahInput((e.target as HTMLInputElement).value))}
          />
          <p class="mt-1 label-md text-text-secondary">
            Nominal tagihan bulanan yang dibuat otomatis untuk semua penghuni (mis. iuran kamar).
          </p>
          <div class="mt-3">
            <Button
              type="button"
              variant="primary"
              icon="auto_awesome"
              onclick={handleCreateBills}
              disabled={creatingBills}
            >
              {creatingBills ? 'Membuat...' : 'Buat Tagihan untuk Semua Penghuni Sekarang'}
            </Button>
          </div>
        </div>

        <div>
          <label for="qris-image" class="mb-1.5 block label-md text-text-secondary">Foto QRIS</label
          >
          <div class="flex items-center gap-4">
            <div
              class="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low"
            >
              {#if assetUrl(settingsFeature.settings?.qrisImageUrl)}
                <img
                  src={assetUrl(settingsFeature.settings?.qrisImageUrl)}
                  alt="QRIS"
                  class="h-full w-full object-cover"
                />
              {:else}
                <Icon name="qr_code_2" size="2.5rem" class="text-text-secondary" />
              {/if}
            </div>
            <div class="flex-1 space-y-2">
              <input
                id="qris-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="input-field w-full text-sm file:mr-2 file:cursor-pointer file:btn-primary"
                onchange={handleUploadQris}
              />
              <p class="label-md text-text-secondary">
                {qrisUploading
                  ? 'Mengunggah...'
                  : 'Unggah gambar QRIS agar penghuni bisa bayar via QRIS.'}
              </p>
            </div>
          </div>
        </div>
        <Button type="submit" icon="save">Simpan Pengaturan</Button>
      </form>
    </Card>

    <Card>
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20">
          <Icon name="schedule" class="text-primary" />
        </div>
        <div class="flex-1">
          <h2 class="headline-sm text-text-primary">Jadwal Scheduler</h2>
          <p class="body-md text-text-secondary">
            Atur kapan sistem menjalankan tugas otomatis — pilih periode & jam.
          </p>
        </div>
      </div>

      <div class="space-y-4">
        <div>
          <label for="settings-reminder-period" class="mb-1.5 block label-md text-text-secondary"
            >Kirim Reminder WA</label
          >
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span class="mb-1 block label-md text-text-secondary">Periode</span>
              <Dropdown
                id="settings-reminder-period"
                options={FREQUENCY_OPTIONS}
                value={form.reminderFrequency}
                placeholder="Pilih periode"
                onselect={(v) => (form.reminderFrequency = v)}
              />
            </div>
            <div>
              <label for="reminder-time" class="mb-1 block label-md text-text-secondary">Jam</label>
              <input
                id="reminder-time"
                type="time"
                class="input-field"
                value={form.reminderTime}
                oninput={(e) => (form.reminderTime = (e.target as HTMLInputElement).value)}
              />
            </div>
          </div>
          {#if form.reminderFrequency === 'weekly'}
            <div class="mt-3">
              <span class="mb-1 block label-md text-text-secondary">Pilih hari</span>
              <div class="flex flex-wrap gap-1.5">
                {#each WEEKDAY_OPTIONS as d (d.value)}
                  <button
                    type="button"
                    class="h-9 min-w-9 cursor-pointer rounded-full border px-2 text-sm transition-colors {form.reminderWeekdays.includes(
                      d.value
                    )
                      ? 'border-primary bg-primary/15 font-semibold text-primary'
                      : 'border-outline-variant text-text-secondary hover:bg-surface-container-high'}"
                    onclick={() =>
                      (form.reminderWeekdays = toggleChip(form.reminderWeekdays, d.value))}
                    >{d.label}</button
                  >
                {/each}
              </div>
            </div>
          {:else if form.reminderFrequency === 'monthly'}
            <div class="mt-3">
              <span class="mb-1 block label-md text-text-secondary"
                >Pilih tanggal (bisa lebih dari satu)</span
              >
              <div class="grid max-h-32 grid-cols-8 gap-1.5 overflow-y-auto p-0.5 sm:grid-cols-16">
                {#each DATE_OPTIONS as d (d)}
                  <button
                    type="button"
                    class="h-8 cursor-pointer rounded-md border text-sm transition-colors {form.reminderDates.includes(
                      d
                    )
                      ? 'border-primary bg-primary/15 font-semibold text-primary'
                      : 'border-outline-variant text-text-secondary hover:bg-surface-container-high'}"
                    onclick={() => (form.reminderDates = toggleChip(form.reminderDates, d))}
                    >{d}</button
                  >
                {/each}
              </div>
            </div>
          {/if}
          <p class="mt-1.5 label-md text-text-secondary">
            Mengirim pengingat WA ke penghuni yang belum membayar. Berlaku: {scheduleLabel(
              form.reminderFrequency,
              form.reminderTime,
              form.reminderWeekdays,
              form.reminderDates
            )}.
          </p>
        </div>
        <div>
          <label for="settings-bill-period" class="mb-1.5 block label-md text-text-secondary"
            >Buat Tagihan Otomatis</label
          >
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span class="mb-1 block label-md text-text-secondary">Periode</span>
              <Dropdown
                id="settings-bill-period"
                options={FREQUENCY_OPTIONS}
                value={form.billCreationFrequency}
                placeholder="Pilih periode"
                onselect={(v) => (form.billCreationFrequency = v)}
              />
            </div>
            <div>
              <label for="bill-time" class="mb-1 block label-md text-text-secondary">Jam</label>
              <input
                id="bill-time"
                type="time"
                class="input-field"
                value={form.billCreationTime}
                oninput={(e) => (form.billCreationTime = (e.target as HTMLInputElement).value)}
              />
            </div>
          </div>
          {#if form.billCreationFrequency === 'weekly'}
            <div class="mt-3">
              <span class="mb-1 block label-md text-text-secondary">Pilih hari</span>
              <div class="flex flex-wrap gap-1.5">
                {#each WEEKDAY_OPTIONS as d (d.value)}
                  <button
                    type="button"
                    class="h-9 min-w-9 cursor-pointer rounded-full border px-2 text-sm transition-colors {form.billCreationWeekdays.includes(
                      d.value
                    )
                      ? 'border-primary bg-primary/15 font-semibold text-primary'
                      : 'border-outline-variant text-text-secondary hover:bg-surface-container-high'}"
                    onclick={() =>
                      (form.billCreationWeekdays = toggleChip(form.billCreationWeekdays, d.value))}
                    >{d.label}</button
                  >
                {/each}
              </div>
            </div>
          {:else if form.billCreationFrequency === 'monthly'}
            <div class="mt-3">
              <span class="mb-1 block label-md text-text-secondary"
                >Pilih tanggal (bisa lebih dari satu)</span
              >
              <div class="grid max-h-32 grid-cols-8 gap-1.5 overflow-y-auto p-0.5 sm:grid-cols-16">
                {#each DATE_OPTIONS as d (d)}
                  <button
                    type="button"
                    class="h-8 cursor-pointer rounded-md border text-sm transition-colors {form.billCreationDates.includes(
                      d
                    )
                      ? 'border-primary bg-primary/15 font-semibold text-primary'
                      : 'border-outline-variant text-text-secondary hover:bg-surface-container-high'}"
                    onclick={() => (form.billCreationDates = toggleChip(form.billCreationDates, d))}
                    >{d}</button
                  >
                {/each}
              </div>
            </div>
          {/if}
          <p class="mt-1.5 label-md text-text-secondary">
            Membuat tagihan bulan berjalan untuk penghuni yang belum memilikinya (idempotent).
            Berlaku: {scheduleLabel(
              form.billCreationFrequency,
              form.billCreationTime,
              form.billCreationWeekdays,
              form.billCreationDates
            )}.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          icon="save"
          onclick={handleSaveSchedule}
          disabled={savingSchedule}
        >
          {savingSchedule ? 'Menyimpan...' : 'Simpan Jadwal'}
        </Button>
      </div>
    </Card>
  {/if}

  <Card>
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/20">
        <Icon name="chat" class="text-secondary" />
      </div>
      <div class="flex-1">
        <h2 class="headline-sm text-text-primary">Reminder WhatsApp</h2>
        <p class="body-md text-text-secondary">Kirim notifikasi otomatis ke penghuni via Fonnte</p>
      </div>
      <Badge variant={wa.connected ? 'success' : 'danger'}>
        {wa.connected ? 'Fonnte Aktif' : wa.tokenSet ? 'Error' : 'Token Belum Diisi'}
      </Badge>
    </div>

    {#if wa.message}
      <p class="mb-3 body-md text-text-secondary">{wa.message}</p>
    {/if}

    <div class="space-y-3">
      <label class="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          class="h-4 w-4 accent-[var(--color-secondary)]"
          checked={botWa}
          onchange={handleToggleWa}
        />
        <span class="body-md text-text-primary"
          >Aktifkan notifikasi otomatis harian ke penghuni yang belum bayar</span
        >
      </label>

      <div class="flex flex-wrap gap-2">
        <Button variant="primary" icon="refresh" onclick={() => wa.fetchStatus()} disabled={wa.busy}
          >Cek Ulang</Button
        >
        <Button
          variant="primary"
          icon="send"
          onclick={handleSendReminder}
          disabled={sending || !wa.connected}
        >
          {sending ? 'Mengirim...' : 'Kirim Reminder Sekarang'}
        </Button>
      </div>

      {#if !wa.tokenSet}
        <p class="flex items-center gap-1.5 label-md text-text-secondary">
          <Icon name="info" size="1rem" />
          Isi <code class="rounded bg-surface-container-high px-1">FONNTE_TOKEN</code> di
          <code class="rounded bg-surface-container-high px-1">backend/.env</code>
          untuk mengaktifkan. Dapatkan token gratis di
          <a href="https://fonnte.com" target="_blank" rel="noopener" class="text-primary underline"
            >fonnte.com</a
          >.
        </p>
      {/if}
    </div>
  </Card>

  <Card>
    <div class="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20">
          <Icon name="history" class="text-primary" />
        </div>
        <div>
          <h2 class="headline-sm text-text-primary">Log Penjadwalan Otomatis</h2>
          <p class="body-md text-text-secondary">
            Riwayat eksekusi pengingat WA dan pembuatan tagihan bulanan otomatis
          </p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          icon="refresh"
          size="sm"
          onclick={() => loadSchedulerLogs()}
          disabled={logsLoading}
        >
          {logsLoading ? 'Memuat...' : 'Refresh Log'}
        </Button>

        {#if schedulerLogs.length > 0}
          <Button
            variant="ghost"
            icon="delete"
            size="sm"
            class="text-danger hover:bg-danger/10"
            onclick={handleClearLogs}
            disabled={clearingLogs}
          >
            {clearingLogs ? 'Hapus...' : 'Hapus Log'}
          </Button>
        {/if}
      </div>
    </div>

    <!-- Filter Dropdowns -->
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <Dropdown
        options={LOG_TYPE_OPTIONS}
        value={logTypeFilter}
        onselect={(val) => {
          logTypeFilter = val as 'all' | 'reminder' | 'bill_creation';
          loadSchedulerLogs(1);
        }}
        class="w-48"
      />
      <Dropdown
        options={LOG_STATUS_OPTIONS}
        value={logStatusFilter}
        onselect={(val) => {
          logStatusFilter = val as 'all' | 'success' | 'failed' | 'skipped';
          loadSchedulerLogs(1);
        }}
        class="w-44"
      />
    </div>

    <!-- Logs Table & Pagination -->
    {#if logsLoading}
      <div class="py-8 text-center body-md text-text-secondary">Memuat log scheduler...</div>
    {:else}
      <DataTable
        columns={logColumns}
        rows={schedulerLogs}
        getCell={getLogCell}
        emptyMessage="Belum ada riwayat log penjadwalan otomatis."
      />
      <Pagination
        total={logsTotal}
        perPage={LOGS_PER_PAGE}
        page={logsPage}
        onchange={(p) => loadSchedulerLogs(p)}
      />
    {/if}
  </Card>
</div>
