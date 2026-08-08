<script lang="ts">
  interface Props {
    label: string;
    value: string;
    trend?: string;
    trendUp?: boolean;
  }

  let { label, value, trend, trendUp }: Props = $props();
</script>

<div class="card-surface p-5">
  <span class="label-md text-text-secondary">{label}</span>
  <p class="mt-1 headline-md text-text-primary">{value}</p>
  {#if trend}
    <span class="body-md {trendUp ? 'text-income' : 'text-expense'} mt-2 block">
      {trend}
    </span>
  {/if}
</div>
