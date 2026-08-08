<script lang="ts">
  import Icon from '../atoms/icon.svelte';

  interface Props {
    months: string[];
    value: string;
    onchange: (value: string) => void;
    label?: string;
    /** true = tombol memanjang penuh (mobile); default = auto dengan min-width. */
    fullWidth?: boolean;
    class?: string;
  }

  let {
    months,
    value,
    onchange,
    label = 'Filter Bulan',
    fullWidth = false,
    class: cls = ''
  }: Props = $props();

  let open = $state(false);
  let rootEl = $state<HTMLDivElement>();

  function onClickOutside(e: MouseEvent): void {
    if (rootEl && !rootEl.contains(e.target as Node)) open = false;
  }
</script>

<svelte:window onmousedown={onClickOutside} />

<div bind:this={rootEl} class="relative inline-block {cls}">
  <button
    type="button"
    onclick={() => (open = !open)}
    class="flex input-field {fullWidth
      ? 'w-full sm:min-w-44'
      : 'w-auto! min-w-44'} cursor-pointer items-center justify-between gap-2 text-left"
    aria-haspopup="listbox"
    aria-expanded={open}
  >
    <span class="flex min-w-0 items-center gap-2">
      <Icon name="calendar_month" size="1rem" class="shrink-0 text-text-secondary" />
      <span class="truncate">
        {value ? `${label}: ${value}` : label}
      </span>
    </span>
    <Icon
      name="expand_more"
      size="1.1rem"
      class="shrink-0 text-text-secondary transition-transform {open ? 'rotate-180' : ''}"
    />
  </button>

  {#if open}
    <!-- right-0: MonthFilter selalu dipakai di sisi kanan (justify-end / flex-1) —
         panel membuka ke kiri sehingga tidak pernah overflow-x di layar sempit -->
    <ul
      class="absolute right-0 z-20 mt-1 max-h-64 w-56 max-w-[calc(100vw-2rem)] overflow-auto card-surface p-1"
      role="listbox"
    >
      <li>
        <button
          type="button"
          role="option"
          aria-selected={value === ''}
          onclick={() => {
            value = '';
            open = false;
            onchange('');
          }}
          class="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left body-md transition-colors {value ===
          ''
            ? 'bg-primary/15 text-primary'
            : 'text-text-primary hover:bg-surface-container-high'}"
        >
          <Icon name="filter_alt_off" size="1rem" class="text-text-secondary" />
          <span>Semua Bulan</span>
          {#if value === ''}
            <Icon name="check" size="1rem" class="ms-auto" />
          {/if}
        </button>
      </li>
      {#each months as m (m)}
        <li>
          <button
            type="button"
            role="option"
            aria-selected={value === m}
            onclick={() => {
              value = m;
              open = false;
              onchange(m);
            }}
            class="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left body-md transition-colors {value ===
            m
              ? 'bg-primary/15 text-primary'
              : 'text-text-primary hover:bg-surface-container-high'}"
          >
            <Icon name="calendar_month" size="1rem" class="text-text-secondary" />
            <span>{m}</span>
            {#if value === m}
              <Icon name="check" size="1rem" class="ms-auto" />
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
