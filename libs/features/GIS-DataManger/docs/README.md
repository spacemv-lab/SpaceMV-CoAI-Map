# GIS-DataManger 文档索引

本文档目录遵循 **Feature Development Workflow (Nx Monorepo)** 规范组织。

## 文档结构

```
docs/
├── README.md              # 本文档索引
├── PRD.md                 # 产品需求文档
├── ARCHITECTURE.md        # 技术架构设计
├── UI-SPEC.md             # UI 规范
├── UX-DESIGN.md           # UX 设计
└── technical/             # 技术实现细节
    ├── gdal-shapefile-parser.md    # Shapefile 解析优化
    ├── async-upload-queue.md       # 异步上传队列实现
    └── 06 复盘 -Shapefile 解析优化.md  # 复盘文档（历史归档）
```

## 文档状态

| 文档 | 状态 | 最后更新 |
|------|------|----------|
| PRD.md | ✅ 已实现 | 2026-03-12 |
| ARCHITECTURE.md | ✅ 已实现 | 2026-03-12 |
| UI-SPEC.md | ✅ 已实现 | 2026-03-12 |
| UX-DESIGN.md | ✅ 已实现 | 2026-03-12 |
| technical/gdal-shapefile-parser.md | ✅ 已实现 | 2026-03-12 |
| technical/async-upload-queue.md | ✅ 已实现 | 2026-03-12 |

## 快速导航

- **新功能开发**：从 [PRD.md](./PRD.md) 开始
- **技术实现**：参考 [ARCHITECTURE.md](./ARCHITECTURE.md)
- **UI 开发**：查看 [UI-SPEC.md](./UI-SPEC.md)
- **交互设计**：参考 [UX-DESIGN.md](./UX-DESIGN.md)
- **技术细节**：浏览 [technical/](./technical/) 目录

## 文档规范

每个文档在开头声明状态：

```yaml
status: draft | review | confirmed | implemented
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: x.y.z
```

**状态流转**：
```
draft → review → confirmed → implemented
  ↑__________________________|
         (需要修改时)
```

## 相关资源

- [Feature Development Skill](~/.config/skillshare/skills/feature-development/SKILL.md)
- [项目 CLAUDE.md](../../../../doc/CLAUDE.md)
