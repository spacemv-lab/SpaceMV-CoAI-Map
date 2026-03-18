# 环境变量配置指南

本目录包含 `map-ai` 项目的所有环境变量配置，按环境和组件分类管理。

## 目录结构

```
.envs/
└── map-ai/
    ├── local/         # 本地开发环境
    │   ├── api.env          - 后端 API (NestJS)
    │   ├── web.env          - 前端 Web (Vite)
    │   ├── agent.env        - Python Agent
    │   └── docker.env       - Docker 容器 (DB/Redis)
    ├── staging/       # 内网测试环境
    │   └── ...
    └── production/    # 外网生产环境
        └── ...
```

## 本地开发快速开始

### 1. 启动基础设施 (Docker)

```bash
cd /home/xjw-linux/projects/TXWX-Monorepo
docker-compose -f docker/infra/docker-compose.yml --env-file .envs/map-ai/local/docker.env up -d
```

### 2. 启动后端 API

```bash
# 方式 A: source 环境变量后启动
set -a; source .envs/map-ai/local/api.env; set +a
pnpm nx serve map-ai-api

# 方式 B: 使用 nx --env-file (如支持)
pnpm nx serve map-ai-api --env-file=.envs/map-ai/local/api.env
```

### 3. 启动前端 Web

```bash
# 复制环境变量到 Web 应用目录
cp .envs/map-ai/local/web.env apps/map-ai/web/.env.local

# 启动 Vite 开发服务器
pnpm nx serve map-ai
```

### 4. 启动 Python Agent

```bash
# source 环境变量后启动
set -a; source .envs/map-ai/local/agent.env; set +a
cd apps/map-ai/agent
uv run uvicorn map_ai_agent.hello:app --reload
```

## 环境文件说明

| 文件 | 用途 | 敏感信息 |
|------|------|---------|
| `api.env` | NestJS API 服务配置 | 数据库连接、Redis 密码、API Key |
| `web.env` | Vite 前端环境变量 | 天地图 Token、Cesium Ion Token |
| `agent.env` | Python FastAPI Agent | LLM API Key |
| `docker.env` | Docker Compose 容器初始化 | 数据库初始密码 |

## 环境变量列表

### 后端 API (api.env)

| 变量名 | 说明 | 本地默认值 |
|--------|------|-----------|
| `NODE_ENV` | Node.js 环境 | `development` |
| `DEPLOY_ENV` | 部署环境 | `local` |
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://...@localhost:5433/...` |
| `REDIS_HOST` | Redis 主机 | `localhost` |
| `REDIS_PORT` | Redis 端口 | `6380` |
| `REDIS_PASSWORD` | Redis 密码 | 空 |
| `AGENT_BASE_URL` | Agent 服务地址 | `http://localhost:8001` |
| `OPENAI_API_KEY` | LLM API Key | 需自行配置 |
| `MODEL` | 模型名称 | `gpt-4o-mini` |

### 前端 Web (web.env)

| 变量名 | 说明 | 前缀要求 |
|--------|------|---------|
| `VITE_DEPLOY_ENV` | 部署环境标识 | 必须 `VITE_*` |
| `VITE_TIANDITU_TOKEN` | 天地图 API Token | 必须 `VITE_*` |
| `VITE_CESIUM_ION` | Cesium Ion Token | 必须 `VITE_*` |
| `VITE_API_BASE_URL` | API 代理地址 | 必须 `VITE_*` |

**注意**：Vite 只会将 `VITE_*` 前缀的变量注入到浏览器端，这是安全机制。

### Python Agent (agent.env)

| 变量名 | 说明 |
|--------|------|
| `ENV` | 环境标识 |
| `openai_api_key` | LLM API Key |
| `openai_api_base_url` | LLM API 地址 |
| `model` | 模型名称 |
| `HOST` | 服务监听地址 |
| `PORT` | 服务端口 |

## 安全提示

1. **不要提交敏感信息**：`.env` 文件已在 `.gitignore` 中忽略，但请勿将真实密钥写入 `.env.example` 模板
2. **生产环境使用强密码**：数据库密码、Redis 密码应使用强随机密码
3. **使用密钥管理服务**：生产环境建议使用 AWS Secrets Manager、HashiCorp Vault 等管理敏感配置
4. **天地图/Cesium Token**：这些是前端公开 Token，建议申请项目专用的只读 Token

## 故障排查

### 后端无法连接数据库

```bash
# 检查 Docker 容器是否运行
docker ps | grep txwx-postgis

# 检查数据库连接
docker exec txwx-postgis pg_isready -U txwx -d txwx_db
```

### 前端环境变量不生效

```bash
# 检查 .env.local 是否存在
ls -la apps/map-ai/web/.env.local

# 检查变量是否有 VITE_ 前缀
cat apps/map-ai/web/.env.local

# 重启 Vite 开发服务器
pnpm nx serve map-ai
```

### Agent 无法调用 LLM

```bash
# 检查环境变量是否加载
echo $openai_api_key

# 检查 Agent 健康状态
curl http://localhost:8001/health
```
