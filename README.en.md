# TXWX Monorepo

Smart Map Geographic Information Management Platform - Full-Stack Monorepo Project

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

TXWX Monorepo is a modern geographic information management platform built with Nx, providing a complete solution from frontend visualization to backend API and GIS intelligent agent processing.

## Tech Stack

| Module | Stack |
|--------|-------|
| Web Frontend | React 19 + Vite 7 + TailwindCSS + Cesium |
| API Gateway | NestJS 11 + Prisma + BullMQ |
| GIS Agent | Python + FastAPI |
| Database | PostgreSQL + PostGIS |
| Cache | Redis |
| Deployment | Docker + K8s |

## Directory Structure

```
TXWX-Monorepo/
├── apps/                    # Applications
│   ├── map-ai/
│   │   ├── web/            # Frontend Web App
│   │   ├── server/         # API Gateway App
│   │   └── agent/          # Python GIS Agent
│   └── map-ai-e2e/         # e2e Tests
├── libs/                    # Shared Libraries
│   └── features/
│       ├── ai-chat/        # AI Conversation Module
│       ├── GIS-DataManger/ # GIS Data Management
│       └── map-core/       # Cesium Map Core
├── docker/                  # Docker Configuration
│   ├── infra/              # Infrastructure (DB/Redis)
│   └── map-ai/             # Application Images
├── .envs/                   # Environment Variable Templates
│   └── map-ai/
│       ├── dev/            # Development
│       ├── test/           # Testing
│       └── production/     # Production
└── scripts/                 # Tool Scripts
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10+
- Docker 24+
- Python 3.11+ (required for Agent development)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

```bash
# Copy environment variable template
cp .envs/map-ai/dev/api.env.example .envs/map-ai/dev/api.env

# Edit configuration file, set database connection, etc.
vim .envs/map-ai/dev/api.env
```

### 3. Start Infrastructure

```bash
# Start PostgreSQL, Redis, MinIO
docker compose -f docker/infra/docker-compose.yml up -d
```

### 4. Start Development Services

```bash
# API service
pnpm nx serve map-ai-api

# Web service (new terminal)
pnpm nx serve map-ai

# Agent service (new terminal)
pnpm nx serve map-ai-agent
```

**Access URLs**:
- Web Frontend: http://localhost:5173
- API Gateway: http://localhost:3000
- Agent Service: http://localhost:8001

## Common Commands

### Development

```bash
# Build
pnpm nx build map-ai-api
pnpm nx build map-ai

# Test
pnpm nx test map-ai-api
pnpm nx test map-ai-agent

# Type check
pnpm nx typecheck map-ai-api

# Format
pnpm nx format:write
```

### Docker

```bash
# Start full stack services
docker compose -f docker/map-ai/compose.local.yml up -d

# View logs
docker compose logs -f api
```

## Project Modules

### Web Frontend (`apps/map-ai/web`)

Modern frontend application based on React 19 + Vite 7, providing:
- Cesium 3D geographic information visualization
- AI conversation interactive interface
- GIS data management capabilities

### API Gateway (`apps/map-ai/server`)

Backend service based on NestJS 11, providing:
- RESTful API
- WebSocket real-time communication
- File upload handling
- AI Agent integration

### GIS Agent (`apps/map-ai/agent`)

Geospatial processing service based on Python FastAPI, providing:
- Spatial analysis functions
- Geographic data processing
- LLM integration

## Contributing

We welcome all forms of contributions!

### Development Workflow

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

### Code Style

- Follow ESLint and Prettier rules
- Add type annotations to TypeScript code
- Add JSDoc comments to public APIs
- Write unit tests to cover core logic

### Commit Message Convention

```
feat: New feature
fix: Bug fix
docs: Documentation update
style: Code style changes
refactor: Code refactoring
test: Test-related
chore: Build/tools-related
```

## Branch Strategy

- `main`: Main branch, always in a deployable state
- `feature/*`: Feature branches
- `fix/*`: Bug fix branches
- `release/*`: Release branches

## License

This project is licensed under the [MIT License](LICENSE).

Copyright (c) 2026 Chengdu TXWX Micro & Small Satellite Technology Co., Ltd.

## Security

Found a security vulnerability? Please see [SECURITY.md](SECURITY.md)

**⚠️ Please do not report security vulnerabilities in public Issues**

## Disclaimer

**THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.**

**This software is provided for learning and research purposes only. Any use of this software for illegal purposes is strictly prohibited. All risks arising from the use of this software are borne by the user.**

## Contact

- Project Homepage: [To be added]
- Issue Tracker: [To be added]
- Security Reports: [To be added]
