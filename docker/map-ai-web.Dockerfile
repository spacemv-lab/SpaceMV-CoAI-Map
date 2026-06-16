FROM node:20-bookworm-slim AS builder

# IAM 服务通过 nginx 代理，前端不需要配置 IAM_BASE_URL
# VITE_IAM_BASE_URL 保持为空，请求走相对路径 /auth/* /system/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@10.17.1 --activate

# 使用国内镜像源
RUN pnpm config set registry https://registry.npmmirror.com

WORKDIR /app

COPY . .

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @txwx-monorepo/web build

FROM nginx:1.27-alpine

COPY conf/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/web /usr/share/nginx/html

EXPOSE 80
