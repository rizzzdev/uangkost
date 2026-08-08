<script lang="ts">
  import { confirmDialogStore } from './confirm-dialog.svelte.js';
  import Modal from './modal.svelte';
  import Button from '../atoms/button.svelte';
  import Icon from '../atoms/icon.svelte';

  const store = confirmDialogStore();
  const pending = $derived(store.pending);
</script>

<Modal
  open={pending !== null}
  title={pending?.title ?? 'Konfirmasi'}
  onclose={() => store.cancel()}
>
  {#if pending}
    <div class="space-y-5">
      <div class="flex items-start gap-3">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg {pending.variant ===
          'danger'
            ? 'bg-error/15'
            : 'bg-primary/15'}"
        >
          <Icon
            name={pending.variant === 'danger' ? 'warning' : 'help'}
            size="1.25rem"
            class={pending.variant === 'danger' ? 'text-error' : 'text-primary'}
          />
        </div>
        <p class="pt-1.5 body-md text-text-primary">{pending.message}</p>
      </div>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onclick={() => store.cancel()}>
          {pending.cancelText}
        </Button>
        <Button
          type="button"
          variant={pending.variant}
          icon={pending.variant === 'danger' ? 'delete' : 'check'}
          onclick={() => store.confirm()}
        >
          {pending.confirmText}
        </Button>
      </div>
    </div>
  {/if}
</Modal>
