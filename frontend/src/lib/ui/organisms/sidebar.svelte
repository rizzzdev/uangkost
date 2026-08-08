<script lang="ts">
  import { page } from '$app/stores';
  import { resolve } from '$app/paths';
  import { Icon } from '$lib/ui/index.js';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  type AdminRoute =
    '/dashboard' | '/billing' | '/installments' | '/expenses' | '/tenants' | '/settings';

  interface NavItem {
    label: string;
    href: AdminRoute;
    icon: string;
  }

  const navItems: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
    { label: 'Pemasukan', href: '/billing', icon: 'payments' },
    { label: 'Cicilan', href: '/installments', icon: 'install_mobile' },
    { label: 'Pengeluaran', href: '/expenses', icon: 'shopping_cart' },
    { label: 'Penghuni', href: '/tenants', icon: 'groups' },
    { label: 'Pengaturan', href: '/settings', icon: 'settings' }
  ];

  const currentPath = $derived($page.url.pathname);
</script>

<!-- Overlay (mobile) -->
{#if open}
  <button class="fixed inset-0 z-40 bg-black/50 lg:hidden" onclick={onclose} aria-label="Close menu"
  ></button>
{/if}

<aside
  class="fixed top-0 left-0 z-40 flex h-screen w-64 flex-col overflow-hidden border-r border-outline-variant bg-surface-dim p-4 transition-transform duration-300 lg:sticky lg:translate-x-0 {open
    ? 'translate-x-0'
    : '-translate-x-full'}"
>
  <div class="mb-8 px-3">
    <div class="flex items-center gap-2">
      <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20">
        <Icon name="account_balance_wallet" size="1.25rem" class="text-primary" />
      </div>
      <div>
        <span class="headline-sm text-primary">uangkost</span>
        <p class="label-md text-text-secondary">Manajemen</p>
      </div>
    </div>
  </div>

  <nav class="flex-1 space-y-1 overflow-hidden">
    {#each navItems as item (item.href)}
      <a
        href={resolve(item.href)}
        onclick={onclose}
        class="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 {currentPath ===
        item.href
          ? 'bg-primary/15 text-primary shadow-sm shadow-primary/10'
          : 'text-text-secondary hover:bg-surface-container-high hover:text-text-primary'}"
      >
        <Icon name={item.icon} size="1.25rem" />
        <span class="body-md font-medium">{item.label}</span>
      </a>
    {/each}
  </nav>
</aside>
