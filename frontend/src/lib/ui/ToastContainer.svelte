<script lang="ts">
  import { getToasts, dismissToast } from '$lib/core/toast.svelte.js';

  const toasts = $derived(getToasts());
</script>

{#if toasts.length > 0}
  <div
    class="pointer-events-none fixed top-5 right-5 z-50 flex w-full max-w-sm flex-col gap-2 px-4"
  >
    {#each toasts as t (t.id)}
      <div
        class="pointer-events-auto flex translate-y-0 transform items-center justify-between rounded-xl border p-4 text-sm font-medium shadow-lg backdrop-blur-md transition-all duration-300
          {t.type === 'success' ? 'border-emerald-700/50 bg-emerald-900/90 text-emerald-100' : ''}
          {t.type === 'error' ? 'border-rose-700/50 bg-rose-900/90 text-rose-100' : ''}
          {t.type === 'warning' ? 'border-amber-700/50 bg-amber-900/90 text-amber-100' : ''}
          {t.type === 'info' ? 'border-slate-700/50 bg-slate-900/90 text-slate-100' : ''}"
        role="alert"
      >
        <div class="flex items-center gap-3 pr-2">
          {#if t.type === 'success'}
            <svg
              class="h-5 w-5 shrink-0 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          {:else if t.type === 'error'}
            <svg
              class="h-5 w-5 shrink-0 text-rose-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          {:else if t.type === 'warning'}
            <svg
              class="h-5 w-5 shrink-0 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          {:else}
            <svg
              class="h-5 w-5 shrink-0 text-sky-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          {/if}
          <span>{t.message}</span>
        </div>
        <button
          type="button"
          class="rounded-lg p-1 text-current opacity-60 transition-opacity hover:opacity-100"
          onclick={() => dismissToast(t.id)}
          aria-label="Tutup notifikasi"
        >
          ✕
        </button>
      </div>
    {/each}
  </div>
{/if}
