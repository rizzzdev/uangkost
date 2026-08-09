import crypto from "node:crypto";
import { prisma, NOT_DELETED } from "../../config/prisma.js";
import { cached, cacheInvalidate, CACHE_KEYS } from "../../config/cache.js";
import { env } from "../../config/env.js";
import { AppError } from "../../middlewares/error-handler.js";
import { toTenantResponse } from "../../utils/mappers.js";
import type {
  CreateTenantInput,
  UpdateTenantInput,
  TenantResponse,
  TenantWithToken,
} from "../../types/index.js";
import type { User } from "@prisma/client";

function sha256(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Terbitkan raw token + hash + waktu kedaluwarsa (TTL dari env). */
function generateAccessToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + env.PORTAL_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  return { raw, hash: sha256(raw), expiresAt };
}


export async function getAllTenants(): Promise<TenantResponse[]> {
  return cached(CACHE_KEYS.tenantsList, async () => {
    const tenants = await prisma.user.findMany({
      where: { role: "tenant", ...NOT_DELETED },
      orderBy: { createdAt: "desc" },
    });
    return tenants.map(toTenantResponse);
  });
}

async function invalidateTenantsCache(): Promise<void> {
  await cacheInvalidate(CACHE_KEYS.tenantsList); // SEBELUM respons — refetch client selalu dapat data segar
}

export async function getTenantById(id: string): Promise<TenantResponse> {
  const tenant = await prisma.user.findFirst({
    where: { id, role: "tenant", ...NOT_DELETED },
  });

  if (!tenant) {
    throw new AppError("Tenant not found", 404);
  }

  return toTenantResponse(tenant);
}

/**
 * Cari tenant aktif yang token RAW-nya cocok (di-hash) & belum kedaluwarsa.
 * Dipakai oleh middleware auth & login portal.
 */
export async function findTenantByRawToken(
  rawToken: string,
): Promise<User | null> {
  return prisma.user.findFirst({
    where: {
      accessTokenHash: sha256(rawToken),
      role: "tenant",
      isActive: true,
      ...NOT_DELETED,
      accessTokenExpiresAt: { gt: new Date() },
    },
  });
}

export async function getTenantByToken(
  rawToken: string,
): Promise<TenantResponse> {
  const tenant = await findTenantByRawToken(rawToken);
  if (!tenant) {
    throw new AppError("Invalid or expired access token", 401);
  }
  return toTenantResponse(tenant);
}

export async function createTenant(
  input: CreateTenantInput,
): Promise<TenantWithToken> {
  const existing = await prisma.user.findFirst({
    where: { phone: input.phone, ...NOT_DELETED },
  });

  if (existing) {
    throw new AppError("Phone number already registered", 409);
  }

  const { raw, hash, expiresAt } = generateAccessToken();
  const tenant = await prisma.user.create({
    data: {
      name: input.name,
      phone: input.phone,
      roomNumber: input.roomNumber ?? null,
      role: "tenant",
      accessTokenHash: hash,
      accessTokenExpiresAt: expiresAt,
    },
  });

  await invalidateTenantsCache();
  return { ...toTenantResponse(tenant), accessToken: raw };
}

export async function updateTenant(
  id: string,
  input: UpdateTenantInput,
): Promise<TenantResponse> {
  const existing = await prisma.user.findFirst({
    where: { id, role: "tenant", ...NOT_DELETED },
  });

  if (!existing) {
    throw new AppError("Tenant not found", 404);
  }

  if (input.phone && input.phone !== existing.phone) {
    const phoneTaken = await prisma.user.findFirst({
      where: { phone: input.phone, ...NOT_DELETED },
    });
    if (phoneTaken) {
      throw new AppError("Phone number already taken", 409);
    }
  }

  const tenant = await prisma.user.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.roomNumber !== undefined && { roomNumber: input.roomNumber }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });

  await invalidateTenantsCache();
  return toTenantResponse(tenant);
}

export async function deleteTenant(id: string): Promise<{ deleted: boolean }> {
  const existing = await prisma.user.findFirst({
    where: { id, role: "tenant", ...NOT_DELETED },
  });

  if (!existing) {
    throw new AppError("Tenant not found", 404);
  }

  // Soft delete — token portal otomatis mati (lookup selalu filter deletedAt)
  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await invalidateTenantsCache();
  return { deleted: true };
}

/**
 * Terbitkan token portal BARU untuk user (rotate).
 * Digunakan worker WA reminder agar setiap pengiriman punya link segar,
 * dan sesi login yang lama (hash lama) otomatis mati.
 * Mengembalikan RAW token — hanya boleh dipakai sekali.
 */
export async function issuePortalToken(userId: string): Promise<string> {
  const { raw, hash, expiresAt } = generateAccessToken();
  await prisma.user.update({
    where: { id: userId },
    data: { accessTokenHash: hash, accessTokenExpiresAt: expiresAt },
  });
  return raw;
}

/**
 * Login portal: validasi token RAW (hash + aktif + belum expired) + verifikasi 4 digit terakhir nomor HP,
 * lalu ROTATE ke token baru (link lama langsung mati = one-time entry).
 * Mengembalikan raw token baru + hash (untuk sesi cookie).
 */
export async function loginWithToken(
  rawToken: string,
  last4Phone?: string,
): Promise<{ token: string; hash: string; user: TenantResponse }> {
  const tenant = await findTenantByRawToken(rawToken);
  if (!tenant) {
    throw new AppError("Link portal tidak valid atau sudah kedaluwarsa.", 401);
  }

  // Jika tenant memiliki nomor telepon terdaftar, konfirmasi 4 digit terakhir
  if (tenant.phone) {
    const cleanPhone = tenant.phone.replace(/\D/g, "");
    const actualLast4 = cleanPhone.slice(-4);

    if (!last4Phone || last4Phone.trim() !== actualLast4) {
      throw new AppError(
        "4 digit terakhir nomor WhatsApp tidak sesuai.",
        400,
      );
    }
  }

  const { raw, hash, expiresAt } = generateAccessToken();
  const updated = await prisma.user.update({
    where: { id: tenant.id },
    data: { accessTokenHash: hash, accessTokenExpiresAt: expiresAt },
  });

  return { token: raw, hash, user: toTenantResponse(updated) };
}

export async function regenerateAccessToken(
  id: string,
): Promise<TenantWithToken> {
  const existing = await prisma.user.findFirst({
    where: { id, role: "tenant", ...NOT_DELETED },
  });

  if (!existing) {
    throw new AppError("Tenant not found", 404);
  }

  const { raw, hash, expiresAt } = generateAccessToken();

  const tenant = await prisma.user.update({
    where: { id },
    data: { accessTokenHash: hash, accessTokenExpiresAt: expiresAt },
  });

  await invalidateTenantsCache();
  return { ...toTenantResponse(tenant), accessToken: raw };
}
