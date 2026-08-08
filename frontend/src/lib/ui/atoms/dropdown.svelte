<script lang="ts">
  import Icon from '../atoms/icon.svelte';

  export interface DropdownOption {
    value: string;
    label: string;
    icon?: string;
  }

  interface Props {
    options: DropdownOption[];
    value?: string;
    placeholder?: string;
    id?: string;
    name?: string;
    onselect?: (value: string) => void;
    class?: string;
  }

  let {
    options,
    value,
    placeholder = 'Pilih...',
    id = '',
    name = '',
    onselect,
    class: cls = ''
  }: Props = $props();

  let open = $state(false);
  let rootEl = $state<HTMLDivElement>();

  const selected = $derived(options.find((o) => o.value === value) ?? null);

  function select(o: DropdownOption): void {
    value = o.value;
    open = false;
    onselect?.(o.value);
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') open = false;
  }

  function onClickOutside(e: MouseEvent): void {
    if (rootEl && !rootEl.contains(e.target as Node)) open = false;
  }
</script>

<svelte:window onmousedown={onClickOutside} onkeydown={onKeydown} />

<div bind:this={rootEl} class="relative {cls}">
  <button
    type="button"
    {id}
    {name}
    onclick={() => (open = !open)}
    class="flex input-field cursor-pointer items-center justify-between gap-2 text-left"
    aria-haspopup="listbox"
    aria-expanded={open}
  >
    <span class="flex min-w-0 items-center gap-2">
      {#if selected?.icon}
        <Icon name={selected.icon} size="1rem" class="text-text-secondary" />
      {/if}
      <span class="truncate {selected ? 'text-text-primary' : 'text-text-secondary'}">
        {selected?.label ?? placeholder}
      </span>
    </span>
    <Icon
      name="expand_more"
      size="1.1rem"
      class="text-text-secondary transition-transform {open ? 'rotate-180' : ''}"
    />
  </button>

  {#if open}
    <ul
      class="absolute left-0 z-20 mt-1 max-h-56 w-full max-w-[calc(100vw-2rem)] min-w-40 overflow-auto card-surface p-1"
      role="listbox"
    >
      {#each options as o (o.value)}
        <li>
          <button
            type="button"
            role="option"
            aria-selected={o.value === value}
            onclick={() => select(o)}
            class="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left body-md transition-colors {o.value ===
            value
              ? 'bg-primary/15 text-primary'
              : 'text-text-primary hover:bg-surface-container-high'}"
          >
            {#if o.icon}
              <Icon name={o.icon} size="1rem" class="text-text-secondary" />
            {/if}
            <span class="truncate">{o.label}</span>
            {#if o.value === value}
              <Icon name="check" size="1rem" class="ms-auto" />
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
