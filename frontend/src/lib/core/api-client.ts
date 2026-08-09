import { env as publicEnv } from '$env/dynamic/public';
import { toast } from '$lib/ui/molecules/toast-store.svelte.js';

const BASE_URL = publicEnv.PUBLIC_API_URL || 'http://localhost:4000/api';

export const API_BASE_URL = BASE_URL;

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

interface ApiResponseShape<T> {
  success?: boolean;
  data?: T;
  message?: string;
  accessToken?: string;
  error?: boolean;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const accessToken = getCookie('access_token');
  const isFormData = options.body instanceof FormData;

  const requestHeaders: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...((options.headers as Record<string, string>) || {})
  };

  if (accessToken) {
    requestHeaders['Authorization'] = `Bearer ${accessToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: requestHeaders,
      credentials: 'include'
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error occurred';
    toast.error(msg);
    throw new ApiError(msg, 0);
  }

  // Auto-refresh on 401 Unauthorized
  if (res.status === 401) {
    try {
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      const refreshData = (await refreshRes.json().catch(() => ({}))) as {
        accessToken?: string;
        data?: { accessToken?: string };
        error?: boolean;
      };

      if (refreshRes.ok && !refreshData.error) {
        const newAccessToken =
          refreshData.accessToken || refreshData.data?.accessToken || getCookie('access_token');

        if (newAccessToken) {
          requestHeaders['Authorization'] = `Bearer ${newAccessToken}`;
          res = await fetch(`${BASE_URL}${endpoint}`, {
            ...options,
            headers: requestHeaders,
            credentials: 'include'
          });
        }
      }
    } catch {
      // Ignore network errors during client-side refresh retry
    }
  }

  const json = (await res.json().catch(() => ({}))) as ApiResponseShape<T>;

  if (!res.ok || json.success === false) {
    const errorMsg = json.message ?? 'Request failed';
    throw new ApiError(errorMsg, res.status);
  }

  return (json.data ?? json) as T;
}

export const api = {
  get: <T>(endpoint: string, extraHeaders?: Record<string, string>) =>
    request<T>(endpoint, { headers: extraHeaders }),

  post: <T>(endpoint: string, body?: object) =>
    request<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),

  put: <T>(endpoint: string, body?: object) =>
    request<T>(endpoint, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),

  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),

  upload: <T>(
    endpoint: string,
    formData: FormData,
    extraHeaders?: Record<string, string>
  ): Promise<T> => {
    return request<T>(endpoint, {
      method: 'POST',
      body: formData,
      headers: extraHeaders
    });
  }
};

export { ApiError };
