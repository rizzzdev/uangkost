import { redirect, type ServerLoad } from '@sveltejs/kit';

/**
 * Halaman "/" — arahkan sesuai status sesi:
 * - Terautentikasi (access + refresh cookie) → /dashboard
 * - Tamu → /login
 */
export const load: ServerLoad = ({ cookies }) => {
  const hasAccess = cookies.get('access_token');
  const hasRefresh = cookies.get('refresh_token');
  throw redirect(307, hasAccess && hasRefresh ? '/dashboard' : '/login');
};
