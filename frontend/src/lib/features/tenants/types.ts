export interface Tenant {
  id: string;
  name: string;
  phone: string;
  roomNumber: string | null;
  isActive: boolean;
  accessTokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Tenant + raw portal token — hanya dikembalikan saat create / regenerate / login. */
export interface TenantWithToken extends Tenant {
  accessToken: string;
}

export interface CreateTenantInput {
  name: string;
  phone: string;
  roomNumber?: string;
}

export interface UpdateTenantInput {
  name?: string;
  phone?: string;
  roomNumber?: string | null;
  isActive?: boolean;
}
