# Coding Standards

## Coding Principles

1. Fail fast and loudly.
2. Do not add fallback logic unless it is explicitly required.
3. Let exceptions bubble up early; do not swallow errors inside business layers.
4. Tests should prove behavior or regression, not only pass trivially.

## Branch Naming

```text
main
feature/v<日期>-<描述>
fix/v<日期>-<描述>
chore/v<日期>-<描述>
```

## Commit Message

Follow Conventional Commits:

```text
<type>(<scope>): <简短描述>

<详细描述>
```

Common types:

- `feat`
- `fix`
- `docs`
- `style`
- `refactor`
- `perf`
- `test`
- `chore`
- `security`

## Standard Workflow

1. 从 `main` 更新最新代码
2. 创建功能/修复分支
3. 小步提交
4. 推送并发起 MR / PR
5. 通过 Review 后合并

## Code Review Checklist

- 逻辑正确
- 无明显安全问题
- 无硬编码敏感信息
- 无调试残留
- Commit message 合规
