<script lang="ts">
  import { onMount } from 'svelte';
  import { Chart, registerables, type ChartOptions } from 'chart.js';
  import type { Snippet } from 'svelte';

  Chart.register(...registerables);

  interface Props {
    type: 'bar' | 'doughnut';
    data: {
      labels: string[];
      datasets: Array<{
        label: string;
        data: number[];
        backgroundColor?: string | string[];
        borderColor?: string | string[];
        borderRadius?: number;
      }>;
    };
    options?: ChartOptions;
    class?: string;
    children?: Snippet;
  }

  let { type, data, options = {}, class: cls = '', children }: Props = $props();

  let canvas = $state<HTMLCanvasElement>();
  let chart = $state<Chart | null>(null);

  onMount(() => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    chart = new Chart(ctx, {
      type,
      data: structuredClone(data),
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#9CA3AF',
              font: { family: 'Inter', size: 12 },
              usePointStyle: true,
              padding: 16
            }
          }
        },
        scales:
          type === 'bar'
            ? {
                x: {
                  ticks: { color: '#9CA3AF', font: { family: 'Inter', size: 11 } },
                  grid: { color: 'rgba(65,71,81,0.3)' }
                },
                y: {
                  ticks: {
                    color: '#9CA3AF',
                    font: { family: 'Inter', size: 11 },
                    callback: (v: string | number) => `Rp${(Number(v) / 1000).toFixed(0)}k`
                  },
                  grid: { color: 'rgba(65,71,81,0.3)' }
                }
              }
            : {},
        ...options
      } as ChartOptions
    });

    return () => chart?.destroy();
  });

  // Deep update chart data when props change
  $effect(() => {
    const c = chart;
    if (!c || !data) return;
    c.data.labels = data.labels;
    c.data.datasets = data.datasets.map((ds, i) => {
      const existing = c.data.datasets[i];
      if (existing) {
        existing.data = ds.data;
        return existing;
      }
      return ds;
    });
    // Remove extra datasets if new data has fewer
    c.data.datasets.length = data.datasets.length;
    c.update();
  });
</script>

<div class="relative {cls}" style="height: 260px;">
  <canvas bind:this={canvas}></canvas>
  {#if children}
    {@render children()}
  {/if}
</div>
