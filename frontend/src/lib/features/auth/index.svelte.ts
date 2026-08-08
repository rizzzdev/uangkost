import { api, ApiError, getAuthStore } from '$lib/core/index.js';
import type { LoginResponse } from './types.js';

const { setSession } = getAuthStore();

let error = $state<string | null>(null);
let loading = $state(false);

async function login(name: string, password: string): Promise<boolean> {
  loading = true;
  error = null;
  try {
    const data = await api.post<LoginResponse>('/auth/login', { name, password });
    setSession(data.token, data.admin);
    return true;
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Login failed';
    return false;
  } finally {
    loading = false;
  }
}

export function getAuthFeature() {
  return {
    get error() {
      return error;
    },
    get loading() {
      return loading;
    },
    login
  };
}
