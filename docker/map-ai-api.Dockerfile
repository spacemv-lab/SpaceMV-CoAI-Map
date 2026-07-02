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

# 入口路径需与 tsc 产物一致：api/tsconfig.app.json 的 outDir=../dist/api + 继承的
# rootDir=仓库根，使 api/src/main.ts 编译到 dist/api/api/src/main.js（outDir 的 api +
# 源相对路径 api/src，故套两层）。仓库重构后产物路径变了，原先写死 dist/api/main.js
# 会导致 Cannot find module → CrashLoopBackOff。
CMD npx prisma migrate deploy --schema=api/prisma/schema.prisma && node dist/api/api/src/main.js
