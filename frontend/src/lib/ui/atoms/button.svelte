<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Icon from './icon.svelte';

  type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

  interface Props extends HTMLButtonAttributes {
    variant?: Variant;
    icon?: string;
    iconOnly?: boolean;
    size?: 'sm' | 'md';
    class?: string;
    children?: Snippet;
  }

  let {
    variant = 'primary',
    icon,
    iconOnly = false,
    size = 'md',
    class: cls = '',
    children,
    ...rest
  }: Props = $props();

  // String literal dibutuhkan agar Tailwind v4 menghasilkan aturan @utility ini
  // (class dinamis `btn-{variant}` tidak terdeteksi scanner Tailwind).
  const variantClass: Record<Variant, string> = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-danger'
  };
</script>

<button
  class="{variantClass[
    variant
  ]} inline-flex cursor-pointer items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 {size ===
  'sm'
    ? 'px-2.5 py-1.5 text-sm'
    : ''} {iconOnly ? 'p-2' : ''} {cls}"
  {...rest}
>
  {#if icon}
    <Icon name={icon} size={size === 'sm' ? '0.9rem' : '1.15rem'} />
  {/if}
  {#if children}
    <span>{@render children()}</span>
  {/if}
</button>
