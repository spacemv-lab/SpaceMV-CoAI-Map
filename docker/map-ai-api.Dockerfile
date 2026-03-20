FROM node:20-bookworm-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.17.1 --activate

WORKDIR /app

COPY . .

RUN pnpm install --no-frozen-lockfile
RUN pnpm prisma generate --schema libs/features/GIS-DataManger/prisma/schema.prisma
RUN pnpm nx build map-ai-api

FROM node:20-bookworm-slim

ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update \
  && apt-get install -y --no-install-recommends gdal-bin libgdal32 openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/libs/features/GIS-DataManger/prisma ./libs/features/GIS-DataManger/prisma

RUN mkdir -p uploads

EXPOSE 3000

CMD ["node", "dist/apps/map-ai/server/main.js"]
