<script lang="ts">
  import type { Snippet } from 'svelte';
  import Badge from '../atoms/badge.svelte';
  import Card from './card.svelte';
  import InstallmentStatus from './installment-status.svelte';
  import ProofButton from './proof-button.svelte';
  import { formatRupiahDisplay, toDateKeyLocal } from '$lib/core/index.js';
  import type { Transaction } from '$lib/features/finance/types.js';

  interface Props {
    bill: Transaction;
    /** Form pembayaran sesuai konteks (tenant upload / admin auto-verify). */
    children: Snippet<[{ remaining: number }]>;
  }

  let { bill, children }: Props = $props();

  const remaining = $derived(Number(bill.amount) - Number(bill.totalPaid));
  const pct = $derived(Math.min(100, (Number(bill.totalPaid) / Number(bill.amount)) * 100));
</script>

<Card>
  <!-- Header -->
  <div class="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
    <div class="flex-1">
      <div class="flex items-center gap-2">
        <p class="body-lg font-medium text-text-primary">{bill.category}</p>
        {#if bill.status === 'paid'}
          <Badge variant="success">Lunas</Badge>
        {:else if bill.status === 'partial'}
          <Badge variant="warning">Cicilan</Badge>
        {:else if bill.paymentProofUrl || (bill.installments && bill.installments.length > 0)}
          <Badge variant="warning">Menunggu Verifikasi</Badge>
        {:else}
          <Badge variant="danger">Belum Dibayar</Badge>
        {/if}
      </div>
      <p class="mt-1 label-md text-text-secondary">{bill.billingMonth ?? bill.transactionDate}</p>
    </div>
    <div class="text-left sm:text-right">
      <p class="headline-sm text-text-primary">{formatRupiahDisplay(bill.amount)}</p>
      {#if remaining > 0 && Number(bill.totalPaid) > 0}
        <p class="label-md text-text-secondary">Sisa: {formatRupiahDisplay(remaining)}</p>
      {/if}
    </div>
  </div>

  <!-- Progress Bar -->
  {#if bill.status !== 'paid' && Number(bill.amount) > 0}
    <div class="mb-3">
      <div class="mb-1 flex justify-between label-md text-text-secondary">
        <span>Dibayar: {formatRupiahDisplay(bill.totalPaid)}</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
        <div
          class="h-full rounded-full bg-secondary transition-all duration-500"
          style="width: {pct}%"
        ></div>
      </div>
    </div>
  {/if}

  <!-- Installment History -->
  {#if bill.installments && bill.installments.length > 0}
    <div class="mb-3 space-y-1.5">
      <p class="label-md font-medium text-text-secondary">Riwayat Cicilan:</p>
      {#each bill.installments as inst (inst.id)}
        <div
          class="flex flex-col justify-between gap-1 rounded-lg bg-surface-container-low px-3 py-1.5 text-sm sm:flex-row sm:items-center"
        >
          <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span class="text-text-primary">{formatRupiahDisplay(inst.amount)}</span>
            <span class="label-md text-text-secondary"
              >{toDateKeyLocal(new Date(inst.createdAt))}</span
            >
            {#if inst.description}
              <span class="text-text-secondary">— {inst.description}</span>
            {/if}
          </div>
          <div class="flex items-center gap-1.5">
            <InstallmentStatus
              status={inst.isVerified ? 'verified' : inst.rejectedAt ? 'rejected' : 'pending'}
            />
            <ProofButton url={inst.paymentProofUrl} title="Lihat bukti cicilan" />
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Form pembayaran sesuai konteks -->
  {@render children({ remaining })}
</Card>
