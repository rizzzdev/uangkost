<script lang="ts">
  import { page } from '$app/stores';
  import { NotFound } from '$lib/ui/index.js';

  const status = $derived($page.status);
  const message = $derived($page.error?.message ?? 'Halaman tidak ditemukan');
</script>

<svelte:head>
  <title>{status === 404 ? '404 Not Found' : 'Error'} — uangkost</title>
</svelte:head>

<NotFound
  title={status === 404 ? '404 Not Found' : `Error ${status}`}
  description={message}
  showHomeButton={true}
/>
