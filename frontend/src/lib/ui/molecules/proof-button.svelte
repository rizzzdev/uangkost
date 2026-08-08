<script lang="ts">
  import Button from '../atoms/button.svelte';
  import { assetUrl } from '$lib/core/index.js';

  interface Props {
    /** URL bukti (relatif). Null/undefined = tombol disabled. */
    url: string | null | undefined;
    title?: string;
  }

  let { url, title = 'Lihat bukti pembayaran' }: Props = $props();
</script>

<Button
  variant="secondary"
  iconOnly
  icon="visibility"
  size="sm"
  {title}
  disabled={!url}
  onclick={() => {
    if (url) window.open(assetUrl(url), '_blank', 'noopener');
  }}
/>
