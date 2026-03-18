FROM node:20-bookworm-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@10.17.1 --activate

WORKDIR /app

COPY . .

RUN pnpm install --no-frozen-lockfile
RUN pnpm nx build map-ai

FROM nginx:1.27-alpine

COPY conf/map-ai.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/apps/web/map-ai /usr/share/nginx/html

EXPOSE 80
