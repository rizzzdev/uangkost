import { api } from '$lib/core/index.js';
import type { Settings } from './types.js';

let settings = $state<Settings | null>(null);
let loading = $state(false);

async function load(): Promise<void> {
  loading = true;
  try {
    settings = await api.get<Settings>('/settings');
  } finally {
    loading = false;
  }
}

async function save(input: Partial<Settings>): Promise<Settings> {
  const updated = await api.put<Settings>('/settings', input);
  settings = updated;
  return updated;
}

async function uploadQris(file: File): Promise<void> {
  const fd = new FormData();
  fd.append('qrisImage', file);
  const updated = await api.upload<Settings>('/settings/qris-image', fd);
  settings = updated;
}

/** Panggil scheduler manual: buat tagihan bulan ini untuk semua penghuni. */
async function triggerCreateBills(): Promise<string> {
  const data = await api.post<{ message: string; created: number }>('/create-bills/trigger');
  return data.message;
}

export function getSettingsFeature() {
  return {
    get settings() {
      return settings;
    },
    get loading() {
      return loading;
    },
    load,
    save,
    uploadQris,
    triggerCreateBills
  };
}
