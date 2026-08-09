import { redirect, type ServerLoad } from '@sveltejs/kit';

/**
 * Halaman "/" — arahkan sesuai status sesi:
 * - Jika ada refresh_token atau access_token → /dashboard (hooks.server.ts akan menangani silent refresh jika access_token habis)
 * - Jika tidak ada cookie auth → /login
 */
export const load: ServerLoad = ({ cookies, locals }) => {
  const hasRefresh = cookies.get('refresh_token');
  const hasAccess = cookies.get('access_token');
  const isAuthenticated = !!locals.user || !!hasRefresh || !!hasAccess;

  throw redirect(307, isAuthenticated ? '/dashboard' : '/login');
};
