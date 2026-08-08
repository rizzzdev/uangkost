<script lang="ts">
  import { getToastStore } from './toast-store.svelte.js';
  import Icon from '../atoms/icon.svelte';
  import Button from '../atoms/button.svelte';

  const { toasts, dismiss } = getToastStore();

  const variantIcons: Record<string, string> = {
    info: 'info',
    warning: 'warning',
    error: 'error',
    success: 'check_circle'
  };

  const variantStyles: Record<string, string> = {
    info: 'border-primary/40 bg-primary/10 text-primary',
    warning: 'border-tertiary/40 bg-tertiary/10 text-tertiary',
    error: 'border-error/40 bg-error/10 text-error',
    success: 'border-secondary/40 bg-secondary/10 text-secondary'
  };
</script>

<div class="fixed top-4 right-4 z-50 flex max-w-sm flex-col gap-2">
  {#each toasts as toast (toast.id)}
    <div
      class="animate-slide-in flex items-start gap-3 card-surface border px-4 py-3 {variantStyles[
        toast.variant
      ] ?? variantStyles.info}"
      role="alert"
    >
      <Icon name={variantIcons[toast.variant] ?? 'info'} size="1.25rem" class="mt-0.5" />
      <p class="flex-1 body-md">{toast.message}</p>
      <Button
        variant="ghost"
        iconOnly
        icon="close"
        size="sm"
        class="-mt-1"
        onclick={() => dismiss(toast.id)}
        aria-label="Dismiss"
      />
    </div>
  {/each}
</div>

<style>
  .animate-slide-in {
    animation: slideIn 0.25s ease-out;
  }
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
</style>
