# syntax=docker/dockerfile:1

# ============================================================
# uangkost — Backend (Express + Prisma + Redis/BullMQ)
# Multistage: deps → build → runtime
# Alpine (musl). argon2 tidak punya prebuild musl → dikompilasi di
# stage deps (toolchain tidak ikut ke image final).
# ============================================================

FROM node:24-alpine AS base
WORKDIR /app

# --- Stage 1: dependencies (cache-friendly) ---
FROM base AS deps
# Toolchain kompilasi untuk argon2 (node-gyp) — hanya stage ini
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# --- Stage 2: build (generate Prisma client + compile TS) ---
FROM base AS build
# Prisma 7 butuh DATABASE_URL valid saat generate (tanpa koneksi, hanya parse).
# Runtime tetap memakai nilai dari compose environment (menang atas ENV ini).
ARG DATABASE_URL="postgresql://postgres:password@localhost:5432/uang_kost"
ENV DATABASE_URL=$DATABASE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# --- Stage 3: runtime (minimal) ---
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/package.json ./package.json
# Folder bukti pembayaran (persist via volume)
RUN mkdir -p /app/uploads

EXPOSE 4000

# Jalankan migrasi database lalu mulai server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
