import { api } from '$lib/core/index.js';
import type { Tenant, TenantWithToken, CreateTenantInput, UpdateTenantInput } from './types.js';

let tenants = $state<Tenant[]>([]);
let loading = $state(false);

async function load(): Promise<void> {
  loading = true;
  try {
    tenants = await api.get<Tenant[]>('/tenants');
  } finally {
    loading = false;
  }
}

async function create(input: CreateTenantInput): Promise<TenantWithToken> {
  const created = await api.post<TenantWithToken>('/tenants', input);
  await load();
  return created;
}

async function update(id: string, input: UpdateTenantInput): Promise<void> {
  await api.put<Tenant>(`/tenants/${id}`, input);
  await load();
}

async function remove(id: string): Promise<void> {
  await api.delete(`/tenants/${id}`);
  await load();
}

async function regenerateToken(id: string): Promise<TenantWithToken> {
  const result = await api.post<TenantWithToken>(`/tenants/${id}/regenerate-token`);
  await load(); // refetch tabel — masa berlaku token baru
  return result;
}

export function getTenantFeature() {
  return {
    get tenants() {
      return tenants;
    },
    get loading() {
      return loading;
    },
    load,
    create,
    update,
    remove,
    regenerateToken
  };
}
