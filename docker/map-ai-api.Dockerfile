FROM node:20-bookworm-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.17.1 --activate

# 使用原生镜像源（VPN 环境）
# RUN pnpm config set registry https://registry.npmmirror.com

WORKDIR /app

COPY . .

RUN pnpm install --no-frozen-lockfile
RUN pnpm prisma generate --schema api/prisma/schema.prisma
RUN pnpm --filter @txwx-monorepo/api build

FROM node:20-bookworm-slim AS dev

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends gdal-bin libgdal32 openssl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.17.1 --activate

WORKDIR /app

COPY . .

RUN pnpm install --no-frozen-lockfile

FROM node:20-bookworm-slim

ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update \
  && apt-get install -y --no-install-recommends gdal-bin libgdal32 openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/api/prisma ./api/prisma

RUN mkdir -p uploads

EXPOSE 3000

CMD npx prisma migrate deploy --schema=api/prisma/schema.prisma && node dist/api/main.js
