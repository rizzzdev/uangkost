<script lang="ts">
  import '../app.css';
  import Toast from '$lib/ui/molecules/toast.svelte';
  import { toast } from '$lib/ui/molecules/toast-store.svelte.js';
  import { ApiError } from '$lib/core/api-client.js';
  import { page } from '$app/stores';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  let accessDenied = $derived($page.data.accessDenied ?? false);

  // Global unhandled promise rejection → toast
  $effect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      if (e.reason instanceof ApiError) {
        toast.error(e.reason.message);
      }
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  });
</script>

{#if accessDenied}
  <div class="flex min-h-screen items-center justify-center bg-background p-6">
    <div class="max-w-md card-surface p-8 text-center">
      <h1 class="mb-3 headline-lg text-error">Akses Ditolak</h1>
      <p class="body-md text-text-secondary">
        Anda tidak memiliki izin untuk mengakses halaman ini.
      </p>
    </div>
  </div>
{:else}
  {@render children()}
{/if}

<Toast />
