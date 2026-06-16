# Coding Principles
1. Fail fast and loudly: Do not write fallback logic unless it is explicitly required.
2. Let exceptions/errors bubble up early: Do not handle errors inside business layers.
3. Valid test: Prove a bug/problem exists by failing it. Only write tests that will pass prove nothing.

# Git Conventions

## Branch Naming
```
main                        ← protected,禁止直接 push
├── feature/v<日期>-<描述>   ← 功能开发 (如 feature/v2026.06.05-migration)
├── fix/v<日期>-<描述>       ← Bug 修复
└── release/<版本>          ← 发布准备（按需）
```

Rules:
- 禁止直接 push 到 `main` 分支
- 通过 Pull Request 提交所有变更
- PR 合并前至少 1 人 Approve
- 分支合并后 24 小时内删除

## Commit Message Format

- 使用 `git config` 已有的 user.name / user.email 署名，不覆写环境变量
- Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <简短描述>

<详细描述>
```

| type | 何时用 | 示例 |
|---|---|---|
| `feat` | 新功能 | `feat(auth): add OAuth2 login` |
| `fix` | Bug 修复 | `fix(api): prevent SQL injection` |
| `docs` | 文档 | `docs(readme): update guide` |
| `style` | 格式调整 | `style(ui): format code` |
| `refactor` | 重构 | `refactor(db): extract builder` |
| `perf` | 性能优化 | `perf(api): add cache` |
| `test` | 测试 | `test(auth): add login tests` |
| `chore` | 构建/依赖 | `chore(deps): upgrade axios` |
| `security` | 安全修复 | `security(jwt): upgrade jjwt` |

## Code Review Checklist
- [ ] 逻辑正确性
- [ ] 无安全漏洞（SQL 注入、XSS、CSRF）
- [ ] 无硬编码密码
- [ ] 依赖版本无已知 CVE 漏洞（结合实际项目），如必须引入需说明原因
- [ ] Commit message 符合格式规范
- [ ] 无调试代码、console.log、注释掉的无用代码
- [ ] 无 `.pem` / `.key` 等敏感文件
