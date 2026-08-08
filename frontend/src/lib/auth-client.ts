import { browser } from '$app/environment';
import { env as publicEnv } from '$env/dynamic/public';

const API_URL = (publicEnv as Record<string, string>).PUBLIC_API_URL || 'http://localhost:4000/api';
const AUTH_URL = `${API_URL}/auth`;

export async function signIn(identifier: string, password: string): Promise<void> {
  if (!browser) throw new Error('Cannot sign in during SSR');

  const res = await fetch(`${AUTH_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ identifier, password })
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body || body.error) {
    throw new Error(body?.message ?? 'Login failed');
  }
}

export async function signOut(): Promise<void> {
  await fetch(`${AUTH_URL}/logout`, {
    method: 'POST',
    credentials: 'include'
  }).catch(() => undefined);
}
