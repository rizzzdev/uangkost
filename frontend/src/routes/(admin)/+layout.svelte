<script lang="ts">
  import { AdminLayout } from '$lib/ui/index.js';
  import { page } from '$app/stores';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
  const user = $derived($page.data.user);
</script>

<AdminLayout userName={user?.name ?? 'Admin'}>
  {@render children()}
</AdminLayout>
