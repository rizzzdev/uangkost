import { browser } from '$app/environment';

interface Admin {
  id: string;
  name: string;
  phone: string;
}

let token = $state<string | null>(browser ? localStorage.getItem('uangkost-token') : null);
let admin = $state<Admin | null>(
  browser ? JSON.parse(localStorage.getItem('uangkost-admin') ?? 'null') : null
);

function setSession(newToken: string, newAdmin: Admin) {
  token = newToken;
  admin = newAdmin;
  if (browser) {
    localStorage.setItem('uangkost-token', newToken);
    localStorage.setItem('uangkost-admin', JSON.stringify(newAdmin));
  }
}

function clearSession() {
  token = null;
  admin = null;
  if (browser) {
    localStorage.removeItem('uangkost-token');
    localStorage.removeItem('uangkost-admin');
  }
}

const isAuthenticated = $derived(token !== null);

export function getAuthStore() {
  return {
    get token() {
      return token;
    },
    get admin() {
      return admin;
    },
    get isAuthenticated() {
      return isAuthenticated;
    },
    setSession,
    clearSession
  };
}
