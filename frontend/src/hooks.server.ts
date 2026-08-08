import { redirect, type Handle } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';

const API_URL = (publicEnv as Record<string, string>).PUBLIC_API_URL || 'http://localhost:4000/api';
const AUTH_URL = `${API_URL}/auth`;

// Domain cookie bersama (mis. "example.com") — dipakai saat frontend (uangkost.example.com)
// & API (api.uangkost.example.com) berada di subdomain berbeda. Kosong = development.
const COOKIE_DOMAIN = (privateEnv.COOKIE_DOMAIN || '').trim().replace(/^\./, '');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

interface MeResponseData {
  id?: string;
  roles?: string[];
  identifiers?: Array<{ type: string; value: string }>;
}

interface MeResponse {
  data?: MeResponseData;
}

interface ParsedSetCookie {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  maxAge?: number;
}

interface CookieOptions {
  path: string;
  secure: boolean;
  domain?: string;
}

/** Opsi cookie untuk penghapusan (domain bersama, secure di production). */
function cookieOpts(): CookieOptions {
  const opts: CookieOptions = {
    path: '/',
    secure: IS_PRODUCTION
  };
  if (COOKIE_DOMAIN) opts.domain = COOKIE_DOMAIN;
  return opts;
}

/**
 * Parse nama/nilai + atribut dari satu header Set-Cookie.
 * Dipakai propagasi hasil refresh — atribut (httpOnly/secure) mengikuti backend
 * sebagai sumber kebenaran, bukan asumsi dari NODE_ENV frontend.
 */
function parseSetCookie(header: string): ParsedSetCookie | null {
  const first = header.split(';')[0];
  const eq = first.indexOf('=');
  if (eq === -1) return null;
  const maxAgeMatch = /;\s*Max-Age=(\d+)/i.exec(header);
  return {
    name: first.slice(0, eq).trim(),
    value: first.slice(eq + 1).trim(),
    httpOnly: /;\s*HttpOnly/i.test(header),
    secure: /;\s*Secure/i.test(header),
    maxAge: maxAgeMatch ? Number(maxAgeMatch[1]) : undefined
  };
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
      event.cookies.delete('access_token', cookieOpts());
      event.cookies.delete('refresh_token', cookieOpts());
    }
    return resolve(event);
  }

  // Protected: forward browser cookies langsung ke backend
  if (isProtected) {
    const rawCookie = event.request.headers.get('cookie') || '';

    // Try refresh first if access_token might be expired
    const refreshToken = event.cookies.get('refresh_token');
    if (!refreshToken) {
      // Hapus access_token yang basi — tanpa ini /login akan mengarahkan balik ke
      // /dashboard (guest-check melihat access_token) dan terjadi ERR_TOO_MANY_REDIRECTS.
      if (event.cookies.get('access_token')) {
        event.cookies.delete('access_token', cookieOpts());
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
          // Propagate new cookies ke browser — atribut mengikuti header backend
          // (httpOnly/secure/maxAge = sumber kebenaran), plus domain bersama
          const setCookies = refreshRes.headers.getSetCookie?.() ?? [];
          for (const h of setCookies) {
            const parsed = parseSetCookie(h);
            if (!parsed) continue;
            event.cookies.set(parsed.name, parsed.value, {
              path: '/',
              secure: parsed.secure,
              httpOnly: parsed.httpOnly,
              ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
              ...(parsed.maxAge !== undefined ? { maxAge: parsed.maxAge } : {})
            });
          }

          // Retry /me dengan fresh cookies dari refresh response
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
        event.cookies.delete('access_token', cookieOpts());
        event.cookies.delete('refresh_token', cookieOpts());
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
