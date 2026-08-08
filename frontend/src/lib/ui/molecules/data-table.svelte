<script module lang="ts">
  export type CellValue = string | { text: string; icon?: string };
</script>

<script lang="ts" generics="Row">
  import type { Snippet } from 'svelte';
  import Icon from '../atoms/icon.svelte';

  interface Props {
    columns: string[];
    rows: Row[];
    getCell: (row: Row, col: string) => CellValue;
    children?: Snippet<[{ row: Row; cols: string[] }]>;
    emptyMessage?: string;
    class?: string;
  }

  let {
    columns,
    rows,
    getCell,
    children,
    emptyMessage = 'No data',
    class: cls = ''
  }: Props = $props();

  // Min-width agar kolom tidak berdempetan di layar sempit (scroll horizontal).
  // ~130px per kolom + kolom aksi (bila ada) + buffer.
  const tableMinWidth = $derived(Math.max(420, columns.length * 130 + (children ? 110 : 0)));
</script>

<div class="overflow-hidden card-surface {cls}">
  <div class="overflow-x-auto">
    <table class="w-full" style="min-width: {tableMinWidth}px">
      <thead>
        <tr class="border-b border-outline-variant">
          {#each columns as col (col)}
            <th class="px-5 py-3 text-left label-md text-text-secondary">{col}</th>
          {/each}
          {#if children}
            <th class="px-5 py-3 text-right label-md text-text-secondary">Actions</th>
          {/if}
        </tr>
      </thead>
      <tbody>
        {#if rows.length === 0}
          <tr>
            <td
              colspan={columns.length + (children ? 1 : 0)}
              class="py-8 text-center body-md text-text-secondary"
            >
              {emptyMessage}
            </td>
          </tr>
        {:else}
          {#each rows as row (row)}
            <tr
              class="border-b border-outline-variant/50 transition-colors hover:bg-surface-container-high/50"
            >
              {#each columns as col (col)}
                {@const cell = getCell(row, col)}
                <td class="px-5 py-3 body-md text-text-primary">
                  {#if typeof cell === 'object'}
                    <span class="inline-flex items-center gap-1.5">
                      {#if cell.icon}
                        <Icon name={cell.icon} size="0.95rem" class="text-text-secondary" />
                      {/if}
                      <span>{cell.text}</span>
                    </span>
                  {:else}
                    {cell}
                  {/if}
                </td>
              {/each}
              {#if children}
                <td class="px-5 py-3 text-right">
                  {@render children({ row, cols: columns })}
                </td>
              {/if}
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
