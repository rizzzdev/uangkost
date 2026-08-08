import { redirect, type Handle } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';

const API_URL = (publicEnv as Record<string, string>).PUBLIC_API_URL || 'http://localhost:4000/api';
const AUTH_URL = `${API_URL}/auth`;

interface MeResponseData {
  id?: string;
  roles?: string[];
  identifiers?: Array<{ type: string; value: string }>;
}

interface MeResponse {
  data?: MeResponseData;
}

const PROTECTED = ['/dashboard', '/billing', '/installments', '/expenses', '/tenants', '/settings'];
const GUEST_ONLY = ['/login'];

export const handle: Handle = async ({ event, resolve }) => {
  const pathname = event.url.pathname;

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const isGuest = GUEST_ONLY.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (!isProtected && !isGuest) {
    return resolve(event);
  }

  // Guest-only: redirect ke dashboard hanya bila SESI LENGKAP (access + refresh).
  // Cookie setengah-auth (mis. access_token basi tanpa refresh_token) justru dibersihkan
  // agar tidak memicu redirect loop (dashboard → login → dashboard → …).
  if (isGuest) {
    const hasAccess = event.cookies.get('access_token');
    const hasRefresh = event.cookies.get('refresh_token');

    if (hasAccess && hasRefresh) {
      throw redirect(303, '/dashboard');
    }

    if (hasAccess || hasRefresh) {
      event.cookies.delete('access_token', { path: '/' });
      event.cookies.delete('refresh_token', { path: '/' });
    }
    return resolve(event);
  }

  // Protected: forward browser cookies directly to backend
  if (isProtected) {
    const rawCookie = event.request.headers.get('cookie') || '';

    // Try refresh first if access_token might be expired
    const refreshToken = event.cookies.get('refresh_token');
    if (!refreshToken) {
      // Hapus access_token yang basi — tanpa ini /login akan mengarahkan balik ke
      // /dashboard (guest-check melihat access_token) dan terjadi ERR_TOO_MANY_REDIRECTS.
      if (event.cookies.get('access_token')) {
        event.cookies.delete('access_token', { path: '/' });
      }
      throw redirect(303, '/login');
    }

    try {
      // Forward raw cookies — let Sentri validate natively
      const meRes = await event.fetch(`${AUTH_URL}/me`, {
        headers: { cookie: rawCookie }
      });

      if (meRes.ok) {
        const body = (await meRes.json().catch(() => ({}))) as MeResponse;
        const raw = body.data;
        if (raw?.id && raw?.roles) {
          event.locals.user = {
            id: raw.id,
            name: raw.identifiers?.find((i) => i.type === 'username')?.value ?? 'Admin',
            roles: raw.roles
          };
        }
      } else {
        // Try refresh
        const refreshRes = await event.fetch(`${AUTH_URL}/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: rawCookie
          }
        });

        if (refreshRes.ok) {
          // Propagate new cookies to browser
          const setCookies = refreshRes.headers.getSetCookie?.() ?? [];
          for (const h of setCookies) {
            const match = h.match(/^([^=]+)=([^;]*)/);
            if (match) {
              event.cookies.set(match[1], match[2], { path: '/' });
            }
          }

          // Retry /me with fresh cookies from refresh response
          const setCookieStr = setCookies.map((c) => c.split(';')[0]).join('; ');
          const meRetry = await event.fetch(`${AUTH_URL}/me`, {
            headers: { cookie: setCookieStr || rawCookie }
          });

          if (meRetry.ok) {
            const body = (await meRetry.json().catch(() => ({}))) as MeResponse;
            const raw = body.data;
            if (raw?.id && raw?.roles) {
              event.locals.user = {
                id: raw.id,
                name: raw.identifiers?.find((i) => i.type === 'username')?.value ?? 'Admin',
                roles: raw.roles
              };
              return resolve(event);
            }
          }
        }

        // Both failed — clear and redirect
        event.cookies.delete('access_token', { path: '/' });
        event.cookies.delete('refresh_token', { path: '/' });
        throw redirect(303, '/login');
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'status' in err && 'location' in err) {
        throw err;
      }
      throw redirect(303, '/login');
    }
  }

  return resolve(event);
};
