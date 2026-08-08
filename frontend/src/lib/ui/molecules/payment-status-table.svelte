<script lang="ts">
  import Badge from '../atoms/badge.svelte';
  import { billingStatusMeta, formatRupiahDisplay } from '$lib/core/index.js';
  import type { PublicDashboardTenantStatus } from '$lib/features/finance/index.svelte.js';

  interface Props {
    tenants: PublicDashboardTenantStatus[];
  }

  let { tenants }: Props = $props();
</script>

{#if tenants.length === 0}
  <p class="py-6 text-center body-md text-text-secondary">Belum ada penghuni terdaftar</p>
{:else}
  <div class="-mx-6 overflow-x-auto px-6">
    <table class="w-full text-left">
      <thead>
        <tr class="border-b border-outline-variant/50 label-md text-text-secondary">
          <th class="py-2 pr-3 font-medium">Penghuni</th>
          <th class="py-2 pr-3 font-medium">Kamar</th>
          <th class="py-2 pr-3 text-right font-medium">Total Tagihan</th>
          <th class="py-2 pr-3 text-right font-medium">Sudah Dibayar</th>
          <th class="py-2 text-right font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {#each tenants as t (t.id)}
          <tr class="border-b border-outline-variant/30 last:border-0">
            <td class="py-2.5 pr-3 body-md text-text-primary">{t.name}</td>
            <td class="py-2.5 pr-3 body-md text-text-secondary">Kamar {t.roomNumber ?? '-'}</td>
            <td class="py-2.5 pr-3 text-right body-md whitespace-nowrap text-text-primary"
              >{formatRupiahDisplay(t.total)}</td
            >
            <td class="py-2.5 pr-3 text-right body-md whitespace-nowrap text-text-primary"
              >{formatRupiahDisplay(t.paid)}</td
            >
            <td class="py-2.5 text-right whitespace-nowrap">
              {#if t.status === 'none'}
                <Badge variant="neutral">Tanpa Tagihan</Badge>
              {:else}
                <Badge variant={billingStatusMeta(t.status).badge}
                  >{billingStatusMeta(t.status).label}</Badge
                >
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
