<script lang="ts">
  import Icon from '../atoms/icon.svelte';

  interface Props {
    /** Ikon brand — default dompet (keuangan). */
    icon?: string;
    /** Subtitle di bawah nama aplikasi. */
    subtitle?: string;
    /** sm = header baris (portal/reports/sidebar), lg = pusat besar (login), text = kata saja (topbar). */
    size?: 'sm' | 'lg' | 'text';
    /** Saat diisi, brand header dibungkus tautan ke tujuan ini (mis. "/" untuk admin terautentikasi). */
    href?: string;
    class?: string;
  }

  let {
    icon = 'account_balance_wallet',
    subtitle = 'Sistem Manajemen Iuran Kost',
    size = 'sm',
    href,
    class: cls = ''
  }: Props = $props();
</script>

{#snippet content()}
  {#if size === 'text'}
    <span
      class="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent drop-shadow-sm {cls} font-extrabold! tracking-tight"
    >
      uangkost
    </span>
  {:else if size === 'lg'}
    <div class="mb-8 text-center {cls}">
      <div
        class="relative mx-auto mb-5 inline-flex h-20 w-20 items-center justify-center rounded-3xl border border-white/20 bg-gradient-to-br from-primary to-secondary shadow-xl ring-4 shadow-primary/30 ring-primary/15"
      >
        <Icon name={icon} size="2.5rem" class="text-white drop-shadow-md" />
      </div>
      <h1
        class="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text headline-lg font-extrabold! tracking-tight text-transparent drop-shadow-sm"
      >
        uangkost
      </h1>
      <p class="mt-2 label-md text-text-secondary">{subtitle}</p>
    </div>
  {:else}
    <div class="flex items-center gap-3 {cls}">
      <div
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/25"
      >
        <Icon name={icon} size="1.4rem" class="text-white drop-shadow-md" />
      </div>
      <div>
        <h1
          class="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text headline-sm font-extrabold! tracking-tight text-transparent drop-shadow-sm"
        >
          uangkost
        </h1>
        {#if subtitle}
          <p class="label-md text-text-secondary">{subtitle}</p>
        {/if}
      </div>
    </div>
  {/if}
{/snippet}

{#if href}
  <!-- href adalah prop generik (bukan route literal) → resolve() tidak berlaku -->
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
  <a {href} class="block" aria-label="uangkost">{@render content()}</a>
{:else}
  {@render content()}
{/if}
