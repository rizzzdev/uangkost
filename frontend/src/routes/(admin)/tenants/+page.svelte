<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { getTenantFeature } from '$lib/features/index.js';
  import { Button, DataTable, Modal, Icon, ConfirmDialog, askConfirm } from '$lib/ui/index.js';
  import { toast } from '$lib/ui/molecules/toast-store.svelte.js';
  import type { Tenant } from '$lib/features/tenants/types.js';

  const tenantsFeature = getTenantFeature();

  // Base URL portal = origin frontend itu sendiri (admin + portal satu aplikasi)
  function portalBase(): string {
    return window.location.origin;
  }

  let showCreate = $state(false);
  let showEdit = $state(false);
  let showLink = $state(false);
  let editTenant = $state<Tenant | null>(null);
  let newTenant = $state({ name: '', phone: '', roomNumber: '' });
  let editForm = $state({ name: '', phone: '', roomNumber: '', isActive: true });
  let copiedId = $state<string | null>(null);
  let createdLink = $state('');

  onMount(tenantsFeature.load);

  const columns = ['Nama', 'HP', 'Kamar', 'Status'];

  function getCell(row: Tenant, col: string): string | { text: string; icon?: string } {
    const map: Record<string, string | { text: string; icon?: string }> = {
      Nama: row.name,
      HP: row.phone,
      Kamar: row.roomNumber ?? '-',
      Status: {
        text: row.isActive ? 'Aktif' : 'Nonaktif',
        icon: row.isActive ? 'check_circle' : 'cancel'
      }
    };
    return map[col] ?? '';
  }

  async function handleCreate() {
    try {
      const created = await tenantsFeature.create(newTenant);
      showCreate = false;
      newTenant = { name: '', phone: '', roomNumber: '' };
      createdLink = `${portalBase()}/portal/${created.accessToken}`;
      showLink = true;
      toast.success('Penghuni ditambahkan');
    } catch {
      toast.error('Gagal menambahkan');
    }
  }

  async function copyCreatedLink() {
    await navigator.clipboard.writeText(createdLink);
    toast.success('Link portal disalin!');
  }

  function openEdit(t: Tenant) {
    editTenant = t;
    editForm = {
      name: t.name,
      phone: t.phone,
      roomNumber: t.roomNumber ?? '',
      isActive: t.isActive
    };
    showEdit = true;
  }

  async function handleUpdate() {
    if (!editTenant) return;
    try {
      await tenantsFeature.update(editTenant.id, {
        name: editForm.name,
        phone: editForm.phone,
        roomNumber: editForm.roomNumber || null,
        isActive: editForm.isActive
      });
      showEdit = false;
      editTenant = null;
      toast.success('Penghuni diperbarui');
      await tenantsFeature.load();
    } catch {
      toast.error('Gagal memperbarui');
    }
  }

  async function copyLink(t: Tenant) {
    const ok = await askConfirm({
      title: 'Buat Link Portal Baru',
      message: `Buat link portal baru untuk ${t.name}? Link lama langsung tidak berlaku lagi.`,
      variant: 'primary'
    });
    if (!ok) return;
    try {
      const res = await tenantsFeature.regenerateToken(t.id);
      const link = `${portalBase()}/portal/${res.accessToken}`;
      await navigator.clipboard.writeText(link);
      copiedId = t.id;
      toast.success('Link baru dibuat & disalin!');
      setTimeout(() => {
        copiedId = null;
      }, 2000);
    } catch {
      toast.error('Gagal membuat link baru');
    }
  }

  async function handleRemove(id: string, name: string) {
    const ok = await askConfirm({
      title: 'Hapus Penghuni',
      message: `Hapus penghuni ${name}? Data terkaitnya ikut dihapus (soft delete).`
    });
    if (!ok) return;
    await tenantsFeature.remove(id);
    toast.info(`${name} dihapus`);
  }
</script>

<svelte:head>
  <title>Penghuni — uangkost</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div>
      <h1 class="headline-lg text-text-primary">Manajemen Penghuni</h1>
      <p class="mt-1 body-md text-text-secondary">Kelola data penghuni kost</p>
    </div>
    <Button icon="person_add" onclick={() => (showCreate = true)}>Tambah Penghuni</Button>
  </div>

  {#if tenantsFeature.loading}
    <div class="animate-pulse card-surface p-8"></div>
  {:else}
    <DataTable {columns} rows={tenantsFeature.tenants} {getCell}>
      {#snippet children({ row }: { row: Tenant })}
        <div class="flex items-center justify-end gap-1.5">
          <Button
            variant="secondary"
            iconOnly
            icon="account_balance_wallet"
            size="sm"
            title="Buka portal admin penghuni"
            onclick={() => goto(resolve(`/tenants/${row.id}`))}
          />
          <Button
            variant="secondary"
            iconOnly
            icon="edit"
            size="sm"
            title="Edit penghuni"
            onclick={() => openEdit(row)}
          />
          <Button
            variant="secondary"
            iconOnly
            icon={copiedId === row.id ? 'check' : 'link'}
            size="sm"
            title={copiedId === row.id ? 'Link disalin!' : 'Salin link portal'}
            onclick={() => copyLink(row)}
          />
          <Button
            variant="danger"
            iconOnly
            icon="delete"
            size="sm"
            title="Hapus penghuni"
            onclick={() => handleRemove(row.id, row.name)}
          />
        </div>
      {/snippet}
    </DataTable>
  {/if}

  <!-- Create Modal -->
  <Modal open={showCreate} title="Tambah Penghuni" onclose={() => (showCreate = false)}>
    <form
      class="space-y-4"
      onsubmit={(e) => {
        e.preventDefault();
        handleCreate();
      }}
    >
      <div>
        <label for="tenant-name-create" class="mb-1.5 block label-md text-text-secondary"
          >Nama</label
        >
        <input
          id="tenant-name-create"
          type="text"
          class="input-field"
          placeholder="Nama lengkap"
          value={newTenant.name}
          oninput={(e) => (newTenant.name = (e.target as HTMLInputElement).value)}
          required
        />
      </div>
      <div>
        <label for="tenant-phone-create" class="mb-1.5 block label-md text-text-secondary"
          >Nomor HP</label
        >
        <input
          id="tenant-phone-create"
          type="text"
          class="input-field"
          placeholder="08123456789"
          value={newTenant.phone}
          oninput={(e) => (newTenant.phone = (e.target as HTMLInputElement).value)}
          required
        />
      </div>
      <div>
        <label for="tenant-room-create" class="mb-1.5 block label-md text-text-secondary"
          >Nomor Kamar</label
        >
        <input
          id="tenant-room-create"
          type="text"
          class="input-field"
          placeholder="A1"
          value={newTenant.roomNumber}
          oninput={(e) => (newTenant.roomNumber = (e.target as HTMLInputElement).value)}
        />
      </div>
      <Button type="submit" icon="save" class="mt-2 w-full">Simpan Penghuni</Button>
    </form>
  </Modal>

  <!-- Edit Modal -->
  <Modal open={showEdit} title="Edit Penghuni" onclose={() => (showEdit = false)}>
    <form
      class="space-y-4"
      onsubmit={(e) => {
        e.preventDefault();
        handleUpdate();
      }}
    >
      <div>
        <label for="tenant-name-edit" class="mb-1.5 block label-md text-text-secondary">Nama</label>
        <input
          id="tenant-name-edit"
          type="text"
          class="input-field"
          value={editForm.name}
          oninput={(e) => (editForm.name = (e.target as HTMLInputElement).value)}
          required
        />
      </div>
      <div>
        <label for="tenant-phone-edit" class="mb-1.5 block label-md text-text-secondary"
          >Nomor HP</label
        >
        <input
          id="tenant-phone-edit"
          type="text"
          class="input-field"
          value={editForm.phone}
          oninput={(e) => (editForm.phone = (e.target as HTMLInputElement).value)}
          required
        />
      </div>
      <div>
        <label for="tenant-room-edit" class="mb-1.5 block label-md text-text-secondary"
          >Nomor Kamar</label
        >
        <input
          id="tenant-room-edit"
          type="text"
          class="input-field"
          value={editForm.roomNumber}
          oninput={(e) => (editForm.roomNumber = (e.target as HTMLInputElement).value)}
        />
      </div>
      <label class="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          class="h-4 w-4 accent-[var(--color-secondary)]"
          checked={editForm.isActive}
          onchange={(e) => (editForm.isActive = (e.target as HTMLInputElement).checked)}
        />
        <span class="body-md text-text-primary">Aktif</span>
      </label>
      <Button type="submit" icon="save" class="mt-2 w-full">Perbarui Penghuni</Button>
    </form>
  </Modal>

  <!-- Link Portal Modal (raw token hanya tampil sekali saat create) -->
  <Modal open={showLink} title="Link Portal Penghuni" onclose={() => (showLink = false)}>
    <div class="space-y-4">
      <div class="flex items-start gap-2 rounded-lg bg-surface-container-low px-3 py-2.5">
        <Icon name="info" size="1rem" class="mt-0.5 shrink-0 text-tertiary" />
        <p class="body-md text-text-secondary">
          Link ini <strong class="text-text-primary">hanya tampil sekali</strong> dan punya masa berlaku
          otomatis. Simpan & bagikan sekarang ke penghuni. Untuk membuat link baru nanti, gunakan tombol
          salin di tabel.
        </p>
      </div>
      <div class="flex gap-2">
        <input
          readonly
          class="input-field flex-1 text-xs"
          value={createdLink}
          onfocus={(e) => (e.target as HTMLInputElement).select()}
        />
        <Button variant="secondary" icon="link" onclick={copyCreatedLink}>Salin</Button>
      </div>
    </div>
  </Modal>

  <ConfirmDialog />
</div>
