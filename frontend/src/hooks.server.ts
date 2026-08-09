import { redirect, type Handle } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';

const API_URL =
  (publicEnv as Record<string, string>).PUBLIC_API_URL || 'http://localhost:4000/api';
const AUTH_URL = `${API_URL}/auth`;

const getCookieDomain = (): string => {
  const raw =
    (publicEnv as Record<string, string | undefined>).PUBLIC_COOKIE_DOMAIN ||
    (privateEnv as Record<string, string | undefined>).COOKIE_DOMAIN ||
    '';
  if (!raw) return '';
  return raw.trim().replace(/^\.+/, '');
};

const clearAuthCookies = (event: Parameters<Handle>[0]['event']) => {
  const domain = getCookieDomain();
  const base = { path: '/', ...(domain ? { domain } : {}) };
  event.cookies.delete('access_token', base);
  event.cookies.delete('refresh_token', base);
};

interface MeResponseData {
  id?: string;
  roles?: string[];
  identifiers?: Array<{ type: string; value: string }>;
}

interface MeResponse {
  data?: MeResponseData;
}

const PROTECTED = [
  '/dashboard',
  '/billing',
  '/installments',
  '/expenses',
  '/tenants',
  '/settings'
];
const GUEST_ONLY = ['/login'];

export const handle: Handle = async ({ event, resolve }) => {
  const pathname = event.url.pathname;
  let accessToken = event.cookies.get('access_token');
  const refreshToken = event.cookies.get('refresh_token');
  const apiSetCookies: string[] = [];

  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );
  const isGuest = GUEST_ONLY.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  if (!isProtected && !isGuest) {
    return resolve(event);
  }

  // Auto-refresh access token di server-side jika access_token habis tapi refresh_token ada
  if (!accessToken && refreshToken) {
    try {
      const refreshRes = await event.fetch(`${AUTH_URL}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `refresh_token=${refreshToken}`
        }
      });

      if (refreshRes.ok) {
        const setCookies = refreshRes.headers.getSetCookie?.() || [];
        apiSetCookies.push(...setCookies);

        const refreshData = await refreshRes.json().catch(() => ({}));
        accessToken = refreshData.accessToken || refreshData.data?.accessToken;
      }
    } catch {
      // Abaikan error jaringan saat refresh
    }
  }

  let userLoaded = false;
  if (accessToken) {
    try {
      const meRes = await event.fetch(`${AUTH_URL}/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (meRes.ok) {
        const body = (await meRes.json().catch(() => ({}))) as MeResponse;
        const raw = body.data ?? (body as unknown as MeResponseData);
        if (raw?.id) {
          event.locals.user = {
            id: raw.id,
            name: raw.identifiers?.find((i) => i.type === 'username')?.value ?? 'Admin',
            roles: raw.roles ?? []
          };
          userLoaded = true;
        }
      }
    } catch {
      // Abaikan error jaringan saat me
    }
  }

  if (isProtected) {
    if (!userLoaded) {
      clearAuthCookies(event);
      throw redirect(303, '/login');
    }
  }

  if (isGuest) {
    if (userLoaded) {
      throw redirect(303, '/dashboard');
    }
  }

  const response = await resolve(event);

  // Teruskan header Set-Cookie yang dihasilkan oleh backend Sentri secara langsung (verbatim) ke browser
  for (const header of apiSetCookies) {
    response.headers.append('set-cookie', header);
  }

  return response;
};
