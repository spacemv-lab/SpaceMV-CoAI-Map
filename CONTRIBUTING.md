# 贡献指南

我们非常欢迎社区开发者参与 SpaceMV-CoAI-Map 项目的建设！如果您有任何改进建议或发现了 Bug，请遵循以下流程：

## 贡献流程

### 1. Fork 本仓库

点击右上角的 Fork 按钮将项目复制到您的 GitHub 账户。

### 2. 创建分支

从 `main` 分支切出一个新分支用于开发：

```bash
git checkout -b feature/AmazingFeature
```

### 3. 提交更改

确保代码风格统一，并撰写清晰的 Commit Message：

```bash
git commit -m 'feat: Add some AmazingFeature'
```

### 4. 推送分支

```bash
git push origin feature/AmazingFeature
```

### 5. 提交 Pull Request

在 GitHub 上发起 PR，并详细描述您的更改内容。

---

## 开发建议

### 代码风格

遵循项目的代码风格规范，确保代码可读性。

- TypeScript/JavaScript：使用 ESLint + Prettier 进行代码检查和格式化
- Python：遵循 PEP 8 规范，使用 Ruff 进行 linting 和格式化

```bash
# 运行代码检查
pnpm nx lint map-ai-api

# 格式化代码
pnpm nx format:write

# Python 代码检查
pnpm nx run map-ai-agent:lint
pnpm nx run map-ai-agent:format
```

### 组件设计

开发新组件时，确保组件的复用性和可维护性。

### API 调用

添加新 API 调用时，遵循现有的模块化组织方式。

### 样式管理

使用 Less 变量和混合器，结合 Tailwind CSS 工具类，确保样式的一致性和可维护性。

### 测试

为新功能添加适当的测试用例，确保代码质量。

```bash
# 运行测试
pnpm nx test map-ai-api
pnpm nx test map-ai-agent
```

---

## 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 重构 |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建/工具/配置 |

### 提交示例

```
feat(web): 添加地图缩放控制功能
fix(api): 修复文件上传超时问题
docs(readme): 更新快速开始指南
refactor(core): 重构坐标转换逻辑
```

### 提交者命名规范

提交者命名需严格遵循 `spacemv+ 姓名首字母` 规则，姓名首字母统一采用小写，无空格、连字符等分隔符。

**示例**：姓名为 "张小红"，提交者命名为 `spacemvzxh`。

```bash
# 配置 Git 用户信息
git config user.name "spacemvxjw"
git config user.email "your-email@example.com"
```

---

## 许可证

通过贡献代码，您同意根据项目的 MIT 许可证授权您的贡献。

---

## 需要帮助？

如有任何问题，请：
1. 查看现有文档
2. 搜索已有 Issue
3. 创建新的 Issue

感谢你的贡献！
