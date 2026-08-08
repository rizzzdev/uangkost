<script lang="ts">
  import type { Snippet } from 'svelte';
  import Button from '../atoms/button.svelte';

  interface Props {
    open: boolean;
    title: string;
    onclose: () => void;
    children: Snippet;
  }

  let { open, title, onclose, children }: Props = $props();

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
    <!-- Backdrop -->
    <button class="fixed inset-0 cursor-default bg-black/60" onclick={onclose} aria-label="Close"
    ></button>
    <!-- Panel -->
    <div class="animate-in relative z-10 mx-4 w-full max-w-md card-surface p-6">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="headline-sm text-text-primary">{title}</h2>
        <Button variant="ghost" iconOnly icon="close" aria-label="Close" onclick={onclose} />
      </div>
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .animate-in {
    animation: slideUp 0.2s ease-out;
  }
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
