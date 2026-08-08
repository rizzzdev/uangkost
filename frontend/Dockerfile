# syntax=docker/dockerfile:1

# ============================================================
# uangkost — Frontend (SvelteKit + adapter-node)
# Multistage: deps → build → runtime
# ============================================================

FROM node:24-alpine AS base
WORKDIR /app

# --- Stage 1: dependencies (cache-friendly) ---
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# --- Stage 2: build (SvelteKit output via adapter-node) ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Stage 3: runtime ---
FROM base AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4001
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules

EXPOSE 4001

CMD ["node", "build/index.js"]
