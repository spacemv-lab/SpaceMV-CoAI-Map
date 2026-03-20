# SpaceMV-CoAI-Map : 产业地图智能管理平台

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub issues](https://img.shields.io/github/issues/spacemv-lab/SpaceMV-CoAI-Map.svg)](https://github.com/spacemv-lab/SpaceMV-CoAI-Map/issues)
[![GitHub forks](https://img.shields.io/github/forks/spacemv-lab/SpaceMV-CoAI-Map.svg)](https://github.com/spacemv-lab/SpaceMV-CoAI-Map/network)
[![GitHub stars](https://img.shields.io/github/stars/spacemv-lab/SpaceMV-CoAI-Map.svg)](https://github.com/spacemv-lab/SpaceMV-CoAI-Map/stargazers)

**Language:** [English](README.en.md) | [简体中文](README.md)


Space-CoAI-Map是一个基于空间数据的产业地图智能管理平台，提供地理信息管理、分析和可视化功能。
它采用全栈 monorepo 架构，包含前端 Web 应用、API 网关、Python GIS Agent 以及数据库和缓存组件。

## 技术栈

| 模块      | 技术栈                                   |
| --------- | ---------------------------------------- |
| Web 前端  | React 19 + Vite 7 + TailwindCSS + Cesium |
| API 网关  | NestJS 11 + Prisma + BullMQ              |
| GIS Agent | Python + FastAPI                         |
| 数据库    | PostgreSQL + PostGIS                     |
| 缓存      | Redis                                    |
| 部署      | Docker + K8s                             |

## 快速开始

### 环境要求

- Node.js 20+
- pnpm 10+
- Docker 24+
- Python 3.11+ (仅开发 Agent 需要)

## 项目结构

```
TXWX-Monorepo/
├── apps/
│   ├── map-ai/
│   │   ├── web/           # 前端 Web 应用
│   │   ├── server/        # API 网关应用
│   │   └── agent/         # Python GIS Agent
│   └── map-ai-e2e/        # e2e 测试
├── libs/
│   └── features/
│       ├── ai-chat/       # AI 对话模块
│       ├── GIS-DataManger/# GIS 数据管理
│       └── map-core/      # Cesium 地图核心
├── docker/
│   ├── infra/             # 基础设施（DB/Redis）
│   └── map-ai/            # 应用镜像
├── .envs/
│   └── map-ai/
│       ├── dev/           # 本地开发配置
│       ├── test/          # 内网测试配置

```

## 本地开发环境

```bash
# 1.1 安装依赖
pnpm install

# 1.2 配置环境变量（本地开发）
cp .envs/map-ai/dev/api.env.example .envs/map-ai/dev/api.env
cp .envs/map-ai/dev/agent.env.example .envs/map-ai/dev/agent.env
cp .envs/map-ai/dev/web.env.example .envs/map-ai/dev/web.env
# 编辑 .envs/map-ai/dev/api.env 配置本地数据库连接
# 编辑 .envs/map-ai/dev/agent.env 配置 LLM API Key
# 编辑 .envs/map-ai/dev/web.env 配置 API 网关地址

# 1.3 启动基础设施（DB + Redis + MinIO）
docker compose -f docker/infra/docker-compose.yml \
  --env-file .envs/map-ai/dev/docker.env up -d

# 1.4 创建 MinIO bucket（首次运行需要）
# 访问控制台 http://localhost:9001
#   - 登录：ruoyi/ruoyi123
#   - 点击 "Create Bucket" 创建 gis-uploads
mc alias set local http://localhost:9000 ruoyi ruoyi123
mc mb local/gis-uploads

# 1.5 启动开发服务
# API 服务（后端）
set -a && source .envs/map-ai/dev/api.env && set +a
pnpm nx serve map-ai-api

# Web 服务（前端，新终端）
pnpm nx serve map-ai

# Agent 服务（Python，新终端）
set -a && source .envs/map-ai/dev/agent.env && set +a
pnpm nx serve map-ai-agent
```

**访问地址**：

- Web 前端：http://localhost:5173
- API 网关：http://localhost:3000
- Agent 服务：http://localhost:8001
- MinIO 控制台：http://localhost:9001

## Docker 打包流程

### 1. 构建并推送 API 镜像

```bash
# 切换到项目根目录
cd <your-project-path>

# 构建 API 镜像（打标签）v0.5.4为版本号示例
docker build -f docker/map-ai/map-ai-api.Dockerfile \
  -t <your-registry>/map-ai-api:v0.5.4 \
  -t <your-registry>/map-ai-api:latest .

# 推送镜像到 registry
docker push <your-registry>/map-ai-api:v0.5.4
docker push <your-registry>/map-ai-api:latest
```

### 2. 构建并推送 Web 镜像

```bash
# 构建 Web 镜像（打标签）v0.5.4为版本号示例
docker build -f docker/map-ai/map-ai-web.Dockerfile \
  -t <your-registry>/map-ai-web:v0.5.4 \
  -t <your-registry>/map-ai-web:latest .

# 推送镜像到 registry
docker push <your-registry>/map-ai-web:v0.5.4
docker push <your-registry>/map-ai-web:latest
```

### 3. 验证镜像推送

```bash
# 查看本地镜像
docker images | grep map-ai-v0.5.4

# 预期输出:
# <your-registry>/map-ai-api     v0.5.4     xxxxx   2 hours ago    xxx MB
# <your-registry>/map-ai-api     latest    xxxxx   2 hours ago    xxx MB
# <your-registry>/map-ai-web     v0.5.4     xxxxx   2 hours ago    xxx MB
# <your-registry>/map-ai-web     latest    xxxxx   2 hours ago    xxx MB
```

---

## 环境文件说明

| 文件         | 用途                      | 敏感信息                        |
| ------------ | ------------------------- | ------------------------------- |
| `api.env`    | NestJS API 服务配置       | 数据库连接、Redis 密码、API Key |
| `web.env`    | Vite 前端环境变量         | 天地图 Token、Cesium Ion Token  |
| `agent.env`  | Python FastAPI Agent      | LLM API Key                     |
| `docker.env` | Docker Compose 容器初始化 | 数据库初始密码                  |

## 环境变量列表

### 后端 API (api.env)

| 变量名           | 说明              | 本地默认值                            |
| ---------------- | ----------------- | ------------------------------------- |
| `NODE_ENV`       | Node.js 环境      | `development`                         |
| `DEPLOY_ENV`     | 部署环境          | `local`                               |
| `DATABASE_URL`   | PostgreSQL 连接串 | `postgresql://...@localhost:5433/...` |
| `REDIS_HOST`     | Redis 主机        | `localhost`                           |
| `REDIS_PORT`     | Redis 端口        | `6380`                                |
| `REDIS_PASSWORD` | Redis 密码        | 空                                    |
| `AGENT_BASE_URL` | Agent 服务地址    | `http://localhost:8001`               |
| `OPENAI_API_KEY` | LLM API Key       | 需自行配置                            |
| `MODEL`          | 模型名称          | `gpt-4o-mini`                         |

### 前端 Web (web.env)

| 变量名                | 说明             | 前缀要求      |
| --------------------- | ---------------- | ------------- |
| `VITE_DEPLOY_ENV`     | 部署环境标识     | 必须 `VITE_*` |
| `VITE_TIANDITU_TOKEN` | 天地图 API Token | 必须 `VITE_*` |
| `VITE_CESIUM_ION`     | Cesium Ion Token | 必须 `VITE_*` |
| `VITE_API_BASE_URL`   | API 代理地址     | 必须 `VITE_*` |

**注意**：Vite 只会将 `VITE_*` 前缀的变量注入到浏览器端，这是安全机制。

### Python Agent (agent.env)

| 变量名                | 说明         |
| --------------------- | ------------ |
| `ENV`                 | 环境标识     |
| `openai_api_key`      | LLM API Key  |
| `openai_api_base_url` | LLM API 地址 |
| `model`               | 模型名称     |
| `HOST`                | 服务监听地址 |
| `PORT`                | 服务端口     |

## 常用命令

### Nx 任务

```bash
# 构建
pnpm nx build map-ai-api
pnpm nx build map-ai

# 测试
pnpm nx test map-ai-api
pnpm nx test map-ai-agent

# 类型检查
pnpm nx typecheck map-ai-api

# 格式化
pnpm nx format:write
```

### Docker

```bash
# 启动本地全套服务
docker compose -f docker/map-ai/compose.local.yml up -d

# 查看日志
docker compose -f docker/map-ai/compose.local.yml logs -f api

# 停止服务
docker compose -f docker/map-ai/compose.local.yml down
```

---

## 分支策略

- `main`: 主分支，始终保持可部署状态
- `feature/*`: 功能分支
- `fix/*`: 修复分支
- `release/*`: 发布分支

## 贡献指南

我们非常欢迎社区开发者参与 SpaceMV-CoAI-Map 项目的建设！详见 [CONTRIBUTING.md](CONTRIBUTING.md)

## 许可证

本项目采用 [MIT 许可证](LICENSE)。

Copyright (c) 2026 成都天巡微小卫星科技有限责任公司

## 安全性

发现安全漏洞？请详见 [SECURITY.md](SECURITY.md)

**⚠️ 请勿在公开 Issue 中报告安全问题**

## 联系方式

如有任何问题、建议或商务合作需求，请联系项目维护团队。

- **Email**: code@spacemv.com
- **Issues**: [GitHub Issues](https://github.com/spacemv-lab/SpaceMV-CoAI-Map/issues)
- **Discussions**: [GitHub Discussions](https://github.com/spacemv-lab/SpaceMV-CoAI-Map/discussions)

更多信息可关注公司微信公众号：

![SpaceMV 微信公众号](packages/images/公司二维码.png)
