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

function getAccessToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)access_token=([^;]*)/);
  return match ? match[1] : null;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const accessToken = getAccessToken();
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

  // Auto-refresh on 401
  if (res.status === 401) {
    const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    if (refreshRes.ok) {
      // Retry original request — new cookies set automatically via Set-Cookie
      res = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          ...headers,
          ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()!}` } : {})
        },
        credentials: 'include'
      });
    }
  }

  const json = (await res.json().catch(() => ({}))) as {
    success: boolean;
    data?: T;
    message?: string;
  };

  if (!res.ok || !json.success) {
    throw new ApiError(json.message ?? 'Request failed', res.status);
  }

  return json.data as T;
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
