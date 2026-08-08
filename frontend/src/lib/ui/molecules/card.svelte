<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    glow?: boolean;
    class?: string;
    children: Snippet;
  }

  let { glow = false, class: cls = '', children }: Props = $props();
</script>

<div class="card-surface {glow ? 'card-glow' : ''} p-6 {cls}">
  {@render children()}
</div>
