# SpaceMV-CoAI-Map : 产业地图智能管理平台

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub issues](https://img.shields.io/github/issues/spacemv-lab/SpaceMV-CoAI-Map.svg)](https://github.com/spacemv-lab/SpaceMV-CoAI-Map/issues)
[![GitHub forks](https://img.shields.io/github/forks/spacemv-lab/SpaceMV-CoAI-Map.svg)](https://github.com/spacemv-lab/SpaceMV-CoAI-Map/network)
[![GitHub stars](https://img.shields.io/github/stars/spacemv-lab/SpaceMV-CoAI-Map.svg)](https://github.com/spacemv-lab/SpaceMV-CoAI-Map/stargazers)

**Language:** [English](README.en.md) | [简体中文](README.md)


SpaceMV-CoAI-Map 是一个基于空间数据的产业地图智能管理平台，提供地理信息管理、分析和可视化能力。

当前仓库是公司内部开发源仓库，用于日常开发、测试、部署与内部协作。审计仓库和开源仓库由脚本基于当前仓库做删减和补充后生成。

## 技术栈

| 模块 | 技术栈 |
|---|---|
| Web | React 19 + Vite 7 + TailwindCSS + Cesium |
| API | NestJS 11 + Prisma + BullMQ |
| Agent | Python + FastAPI |
| 数据库 | PostgreSQL + PostGIS |
| 缓存 | Redis |
| 对象存储 | MinIO |
| 部署 | Docker + K8s |

## 仓库结构

```text
web/        前端应用
api/        后端应用
agent/      Python Agent
packages/   共享包
docker/     Dockerfile 与开发/基础设施 compose
k8s/        Kubernetes 清单
docs/       内部开发文档
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

- **Email**: xiaojunwen@spacemv.com
- **Issues**: [GitHub Issues](https://github.com/spacemv-lab/SpaceMV-CoAI-Map/issues)
- **Discussions**: [GitHub Discussions](https://github.com/spacemv-lab/SpaceMV-CoAI-Map/discussions)

更多信息可关注公司微信公众号：

![SpaceMV 微信公众号](packages/images/公司二维码.png)
