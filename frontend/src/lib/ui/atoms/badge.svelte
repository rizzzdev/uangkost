<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'success' | 'danger' | 'warning' | 'neutral';
    children: Snippet;
  }

  let { variant = 'neutral', children }: Props = $props();

  const colorMap: Record<string, string> = {
    success: 'bg-[#34D399]/20 text-[#34D399]',
    danger: 'bg-[#F87171]/20 text-[#F87171]',
    warning: 'bg-[#fabd34]/20 text-[#fabd34]',
    neutral: 'bg-surface-container-high text-text-secondary'
  };
</script>

<span class="rounded-full px-3 py-1 label-md {colorMap[variant]}">
  {@render children()}
</span>
