<script lang="ts">
  import { formatRupiahDisplay } from '$lib/core/index.js';

  interface Props {
    total: number;
    paid: number;
    remaining: number;
  }

  let { total, paid, remaining }: Props = $props();
</script>

<div class="grid grid-cols-3 gap-3">
  <div class="card-surface p-3 text-center">
    <p class="label-md text-text-secondary">Total Tagihan</p>
    <p class="mt-0.5 truncate headline-sm text-text-primary">{formatRupiahDisplay(total)}</p>
  </div>
  <div class="card-surface p-3 text-center">
    <p class="label-md text-text-secondary">Dibayar</p>
    <p class="mt-0.5 truncate headline-sm text-secondary">{formatRupiahDisplay(paid)}</p>
  </div>
  <div class="card-surface p-3 text-center">
    <p class="label-md text-text-secondary">Sisa</p>
    <p class="mt-0.5 truncate headline-sm text-error">{formatRupiahDisplay(remaining)}</p>
  </div>
</div>
