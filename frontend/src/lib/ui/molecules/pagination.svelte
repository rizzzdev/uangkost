<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import Icon from '../atoms/icon.svelte';

  interface Props {
    total: number;
    perPage?: number;
    page: number;
    onchange: (page: number) => void;
  }

  let { total, perPage = 10, page, onchange }: Props = $props();

  const totalPages = $derived(Math.max(1, Math.ceil(total / perPage)));

  // Smart algorithm: selalu tampilkan halaman pertama & terakhir,
  // plus window 1 halaman di kiri/kanan halaman aktif, sisanya ellipsis.
  const items = $derived.by(() => {
    const p = totalPages;
    if (p <= 7) return Array.from({ length: p }, (_, i) => i + 1);

    const current = Math.min(Math.max(page, 1), p);
    const set = new SvelteSet<number>([1, p, current]);
    for (let i = Math.max(2, current - 1); i <= Math.min(p - 1, current + 1); i++) {
      set.add(i);
    }
    return [...set].sort((a, b) => a - b);
  });

  function go(target: number): void {
    if (target < 1 || target > totalPages || target === page) return;
    onchange(target);
  }
</script>

<nav class="mt-4 flex flex-wrap items-center justify-center gap-1" aria-label="Pagination">
  <button
    type="button"
    class="pagination-btn"
    title="Halaman sebelumnya"
    aria-label="Halaman sebelumnya"
    disabled={page <= 1}
    onclick={() => go(page - 1)}
  >
    <Icon name="chevron_left" size="1rem" />
  </button>

  {#each items as item, i (item)}
    {#if i > 0 && item - items[i - 1] > 1}
      <span class="pagination-ellipsis" aria-hidden="true">…</span>
    {/if}
    <button
      type="button"
      class="pagination-btn {item === page ? 'pagination-active' : ''}"
      aria-label="Halaman {item}"
      aria-current={item === page ? 'page' : undefined}
      onclick={() => go(item)}
    >
      {item}
    </button>
  {/each}

  <button
    type="button"
    class="pagination-btn"
    title="Halaman berikutnya"
    aria-label="Halaman berikutnya"
    disabled={page >= totalPages}
    onclick={() => go(page + 1)}
  >
    <Icon name="chevron_right" size="1rem" />
  </button>
</nav>

<style>
  .pagination-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.25rem;
    height: 2.25rem;
    padding: 0 0.5rem;
    border-radius: var(--radius-md);
    background-color: var(--color-surface-container-high);
    color: var(--color-text-primary);
    border: 1px solid var(--color-outline-variant);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .pagination-btn:hover:not(:disabled):not(.pagination-active) {
    background-color: var(--color-surface-container-highest);
    border-color: var(--color-outline);
  }
  .pagination-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .pagination-active {
    background: linear-gradient(
      135deg,
      var(--color-primary) 0%,
      color-mix(in srgb, var(--color-primary) 80%, #fff) 100%
    );
    color: var(--color-on-primary);
    border-color: transparent;
  }
  .pagination-ellipsis {
    display: inline-flex;
    align-items: flex-end;
    min-width: 1.5rem;
    justify-content: center;
    color: var(--color-text-secondary);
    padding-bottom: 0.25rem;
  }
</style>
