# 贡献指南

感谢你对本项目的关注！我们欢迎各种形式的贡献。

## 快速导航

- [代码规范](#代码规范)
- [开发流程](#开发流程)
- [提交规范](#提交规范)
- [问题反馈](#问题反馈)

## 代码规范

### TypeScript/JavaScript

- 使用 ESLint + Prettier 进行代码检查和格式化
- 所有公共 API 必须有类型注解
- 使用语义化命名
- 组件文件使用 `.tsx` 扩展名

```bash
# 运行代码检查
pnpm nx lint map-ai-api

# 格式化代码
pnpm nx format:write
```

### Python

- 遵循 PEP 8 规范
- 使用 Ruff 进行 linting 和格式化

```bash
pnpm nx run map-ai-agent:lint
pnpm nx run map-ai-agent:format
```

## 开发流程

### 1. 环境设置

```bash
# Fork 并克隆
git clone https://github.com/your-username/txwx-monorepo.git
cd txwx-monorepo

# 安装依赖
pnpm install

# 设置开发环境
cp .envs/map-ai/dev/api.env.example .envs/map-ai/dev/api.env
```

### 2. 创建分支

```bash
# 功能开发
git checkout -b feature/your-feature

# Bug 修复
git checkout -b fix/issue-123
```

### 3. 开发和测试

```bash
# 运行开发服务器
pnpm nx serve map-ai-api
pnpm nx serve map-ai

# 运行测试
pnpm nx test map-ai-api
```

### 4. 提交代码

```bash
git add .
git commit -m "feat: add your feature"
```

**建议配置 GPG 签名**（确保提交者身份真实）：

```bash
# 生成 GPG 密钥
gpg --full-generate-key

# 配置 Git 使用 GPG 签名
git config --global commit.gpgsign true
git config --global user.signingkey <你的密钥 ID>

# 添加密钥到 GitHub
# 设置 → SSH and GPG keys → New GPG key
```

### 5. 创建 PR

推送到你的 fork 并创建 Pull Request。

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

## 问题反馈

### Bug 报告

请使用 Issue 模板报告 Bug，包含：
- 问题描述
- 复现步骤
- 预期行为
- 实际行为
- 环境信息（Node.js 版本、浏览器等）

### 功能建议

欢迎提出新功能建议，请说明：
- 功能描述
- 使用场景
- 预期效果

## Pull Request 指南

1. **PR 标题**：使用简洁的描述性标题
2. **PR 描述**：包含更改说明、测试方法、相关 Issue
3. **代码审查**：响应审查意见并及时修改
4. **测试**：确保所有测试通过

### PR 模板

```markdown
## 描述
简要说明更改内容

## 类型
- [ ] Bug 修复
- [ ] 新功能
- [ ] 文档更新
- [ ] 重构

## 测试
说明如何测试这些更改

## 相关 Issue
关联的 Issue 编号
```

## 许可证

通过贡献代码，您同意根据项目的 MIT 许可证授权您的贡献。

## 需要帮助？

如有任何问题，请：
1. 查看现有文档
2. 搜索已有 Issue
3. 创建新的 Issue

感谢你的贡献！
