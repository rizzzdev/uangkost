import { api } from '$lib/core/index.js';
import type { FinanceSummary } from './types.js';

let summary = $state<FinanceSummary | null>(null);
let loading = $state(false);

async function load(): Promise<void> {
  loading = true;
  try {
    const data = await api.get<FinanceSummary>('/finance/summary');
    summary = data;
  } finally {
    loading = false;
  }
}

export function getDashboardFeature() {
  return {
    get summary() {
      return summary;
    },
    get loading() {
      return loading;
    },
    load
  };
}
