<script lang="ts">
  import Card from '../molecules/card.svelte';
  import Button from '../atoms/button.svelte';
  import Icon from '../atoms/icon.svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  interface Props {
    title?: string;
    description?: string;
    showHomeButton?: boolean;
  }

  let {
    title = 'Halaman Tidak Ditemukan',
    description = 'Maaf, halaman atau sumber daya yang Anda cari tidak ditemukan, tidak valid, atau sudah kedaluwarsa.',
    showHomeButton = true
  }: Props = $props();
</script>

<div class="flex min-h-[60vh] w-full items-center justify-center p-4">
  <Card class="w-full max-w-md border-outline-variant/30 text-center shadow-xl">
    <div class="py-6">
      <div
        class="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-error/10 text-error ring-8 ring-error/5"
      >
        <Icon name="search_off" size="2.75rem" />
      </div>

      <h1 class="headline-md font-bold text-text-primary">{title}</h1>

      <p class="mt-2 body-md text-text-secondary">
        {description}
      </p>

      {#if showHomeButton}
        <div class="mt-6 flex justify-center gap-3">
          <Button variant="secondary" icon="arrow_back" onclick={() => history.back()}>
            Kembali
          </Button>
          <Button variant="primary" icon="home" onclick={() => goto(resolve('/'))}>Beranda</Button>
        </div>
      {/if}
    </div>
  </Card>
</div>
