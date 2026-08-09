import { env as publicEnv } from '$env/dynamic/public';

const BASE_URL =
  (publicEnv as Record<string, string>).PUBLIC_API_URL || 'http://localhost:4000/api';

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

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const accessToken = getCookie('access_token');
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...((options.headers as Record<string, string>) || {})
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include'
  });

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
          headers['Authorization'] = `Bearer ${newAccessToken}`;
          res = await fetch(`${BASE_URL}${endpoint}`, {
            ...options,
            headers,
            credentials: 'include'
          });
        }
      }
    } catch {
      // Abaikan error jaringan saat refresh client-side
    }
  }

  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    message?: string;
  };

  if (!res.ok || json.success === false) {
    throw new ApiError(json.message ?? 'Request failed', res.status);
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
