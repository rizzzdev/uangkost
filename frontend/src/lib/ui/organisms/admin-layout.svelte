<script lang="ts">
  import type { Snippet } from 'svelte';
  import { signOut } from '$lib/auth-client.js';
  import { toast } from '$lib/ui/molecules/toast-store.svelte.js';
  import { Button, Footer, Icon } from '$lib/ui/index.js';
  import Sidebar from './sidebar.svelte';

  interface Props {
    userName: string;
    children: Snippet;
  }

  let { userName, children }: Props = $props();

  let mobileOpen = $state(false);

  async function handleLogout() {
    await signOut();
    toast.info('Logged out');
    window.location.href = '/login';
  }
</script>

<div class="flex min-h-screen bg-background">
  <Sidebar open={mobileOpen} onclose={() => (mobileOpen = false)} />
  <main class="flex min-w-0 flex-1 flex-col lg:ml-0">
    <header
      class="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-outline-variant bg-surface-dim/80 px-4 backdrop-blur-sm lg:justify-end lg:px-6"
    >
      <span class="headline-sm text-primary lg:hidden">uangkost</span>
      <div class="flex items-center gap-2">
        <div class="hidden items-center gap-2 sm:flex">
          <div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
            <Icon name="person" size="1rem" class="text-primary" />
          </div>
          <span class="hidden body-md text-text-primary md:inline">{userName}</span>
        </div>
        <Button variant="danger" size="sm" icon="logout" onclick={handleLogout}>
          <span class="hidden sm:inline">Logout</span>
        </Button>
        <Button
          variant="secondary"
          iconOnly
          icon="menu"
          class="lg:hidden"
          aria-label="Buka menu"
          onclick={() => (mobileOpen = true)}
        />
      </div>
    </header>
    <div class="flex-1 p-4 lg:p-6">
      {@render children()}
    </div>
    <Footer />
  </main>
</div>
