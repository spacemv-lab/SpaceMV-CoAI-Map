# TXWX Monorepo

智慧图维地理信息管理平台 - 全栈 Monorepo 项目

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 简介

TXWX Monorepo 是一个基于 Nx 的现代化地理信息管理平台 monorepo 项目，提供从前端可视化到后端 API、GIS 智能体处理的完整解决方案。

## 技术栈

| 模块 | 技术栈 |
|------|--------|
| Web 前端 | React 19 + Vite 7 + TailwindCSS + Cesium |
| API 网关 | NestJS 11 + Prisma + BullMQ |
| GIS Agent | Python + FastAPI |
| 数据库 | PostgreSQL + PostGIS |
| 缓存 | Redis |
| 部署 | Docker + K8s |

## 目录结构

```
TXWX-Monorepo/
├── apps/                    # 应用程序
│   ├── map-ai/
│   │   ├── web/            # 前端 Web 应用
│   │   ├── server/         # API 网关应用
│   │   └── agent/          # Python GIS Agent
│   └── map-ai-e2e/         # e2e 测试
├── libs/                    # 共享库
│   └── features/
│       ├── ai-chat/        # AI 对话模块
│       ├── GIS-DataManger/ # GIS 数据管理
│       └── map-core/       # Cesium 地图核心
├── docker/                  # Docker 配置
│   ├── infra/              # 基础设施（DB/Redis）
│   └── map-ai/             # 应用镜像
├── .envs/                   # 环境变量模板
│   └── map-ai/
│       ├── dev/            # 开发环境
│       ├── test/           # 测试环境
│       └── production/     # 生产环境
└── scripts/                 # 工具脚本
```

## 快速开始

### 环境要求

- Node.js 20+
- pnpm 10+
- Docker 24+
- Python 3.11+ (开发 Agent 需要)

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境

```bash
# 复制环境变量模板
cp .envs/map-ai/dev/api.env.example .envs/map-ai/dev/api.env

# 编辑配置文件，设置数据库连接等
vim .envs/map-ai/dev/api.env
```

### 3. 启动基础设施

```bash
# 启动 PostgreSQL、Redis、MinIO
docker compose -f docker/infra/docker-compose.yml up -d
```

### 4. 启动开发服务

```bash
# API 服务
pnpm nx serve map-ai-api

# Web 服务（新终端）
pnpm nx serve map-ai

# Agent 服务（新终端）
pnpm nx serve map-ai-agent
```

**访问地址**：
- Web 前端：http://localhost:5173
- API 网关：http://localhost:3000
- Agent 服务：http://localhost:8001

## 常用命令

### 开发

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
# 启动全套服务
docker compose -f docker/map-ai/compose.local.yml up -d

# 查看日志
docker compose logs -f api
```

## 项目模块

### Web 前端 (`apps/map-ai/web`)

基于 React 19 + Vite 7 的现代化前端应用，提供：
- Cesium 3D 地理信息可视化
- AI 对话交互界面
- GIS 数据管理功能

### API 网关 (`apps/map-ai/server`)

基于 NestJS 11 的后端服务，提供：
- RESTful API
- WebSocket 实时通信
- 文件上传处理
- AI Agent 集成

### GIS Agent (`apps/map-ai/agent`)

基于 Python FastAPI 的地理空间处理服务，提供：
- 空间分析功能
- 地理数据处理
- LLM 集成

## 贡献指南

我们欢迎各种形式的贡献！

### 开发流程

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 代码规范

- 遵循 ESLint 和 Prettier 规则
- TypeScript 代码需要添加类型注解
- 公共 API 必须添加 JSDoc 注释
- 编写单元测试覆盖核心逻辑

### 提交信息规范

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式调整
refactor: 重构
test: 测试相关
chore: 构建/工具相关
```

## 分支策略

- `main`: 主分支，始终保持可部署状态
- `feature/*`: 功能分支
- `fix/*`: 修复分支
- `release/*`: 发布分支

## 许可证

本项目采用 [MIT 许可证](LICENSE)。

Copyright (c) 2026 成都天巡微小卫星科技有限责任公司

## 安全性

发现安全漏洞？请详见 [SECURITY.md](SECURITY.md)

**⚠️ 请勿在公开 Issue 中报告安全问题**

## 免责声明

**本软件按"原样"提供，不提供任何明示或暗示的保证，包括但不限于适销性、特定用途适用性和非侵权保证。在任何情况下，版权持有者或贡献者不对因使用本软件或以任何方式处理本软件而引起的或与之相关的任何索赔、损害或其他责任负责，无论是合同诉讼、侵权行为还是其他行为。**

**本软件仅供学习和研究使用，禁止用于任何非法用途。使用本软件产生的所有风险由使用者自行承担。**

## 联系方式

- 项目主页：[待添加]
- 问题反馈：[待添加]
- 安全报告：[待添加]
