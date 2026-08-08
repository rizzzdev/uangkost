import { api } from '$lib/core/index.js';

const state = $state({
  connected: false,
  tokenSet: false,
  qr: null as string | null,
  busy: false,
  message: ''
});

async function fetchStatus(): Promise<void> {
  state.busy = true;
  try {
    const data = await api.get<{ connected: boolean; tokenSet?: boolean }>('/wa/status');
    state.connected = data.connected;
    state.tokenSet = data.tokenSet ?? data.connected;
    state.qr = null;
    state.message = state.connected ? 'Fonnte terhubung' : 'FONNTE_TOKEN belum dikonfigurasi';
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    state.message = `Gagal cek status: ${msg}`;
    state.connected = false;
  } finally {
    state.busy = false;
  }
}

async function triggerScan(): Promise<string> {
  const data = await api.post<{ message: string; sent: number; failed: number; total: number }>(
    '/scan-unpaid/trigger'
  );
  return data.message;
}

export function getWaFeature() {
  return {
    get connected() {
      return state.connected;
    },
    get tokenSet() {
      return state.tokenSet;
    },
    get qr() {
      return state.qr;
    },
    get busy() {
      return state.busy;
    },
    get message() {
      return state.message;
    },
    fetchStatus,
    triggerScan
  };
}
