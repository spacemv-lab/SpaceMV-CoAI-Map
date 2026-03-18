---
name: Pull Request
description: 提交代码贡献
title: "[PR]: "
labels: []
body:
  - type: markdown
    attributes:
      value: |
        感谢您的贡献！请按照以下模板填写 PR 信息。

        **⚠️ 提交前请确认：**
        - 代码已通过本地测试
        - 遵循项目代码规范
        - 不包含敏感信息（密码、密钥、内网 IP 等）
  - type: dropdown
    id: type
    attributes:
      label: PR 类型
      options:
        - feat: 新功能
        - fix: Bug 修复
        - docs: 文档更新
        - style: 代码格式（不影响功能）
        - refactor: 重构
        - perf: 性能优化
        - test: 测试相关
        - chore: 构建/工具相关
        - revert: 回滚
    validations:
      required: true
  - type: textarea
    id: description
    attributes:
      label: 变更描述
      description: 请详细描述此 PR 的变更内容
      placeholder: 例如：新增了用户登录功能，包括...
    validations:
      required: true
  - type: textarea
    id: motivation
    attributes:
      label: 变更动机
      description: 为什么需要这些变更？解决了什么问题？
    validations:
      required: true
  - type: textarea
    id: testing
    attributes:
      label: 测试说明
      description: 请说明如何测试这些变更
      placeholder: |
        1. 运行测试：pnpm nx test xxx
        2. 手动验证：...
    validations:
      required: true
  - type: input
    id: issue
    attributes:
      label: 关联 Issue
      placeholder: 例如：#123, #456
  - type: checkboxes
    id: checklist
    attributes:
      label: 提交前检查清单
      options:
        - label: 代码遵循项目规范
        - label: 已添加必要的注释
        - label: 已添加/更新测试用例
        - label: 已更新相关文档
        - label: 不包含敏感信息
        - label: 无 GPL/AGPL 等传染性协议依赖
    validations:
      required: true
  - type: markdown
    attributes:
      value: |
        ## 贡献者版权约定

        通过提交此 PR，您同意将贡献内容的版权转让给项目主体（成都天巡微小卫星科技有限责任公司），
        并授权项目以 MIT 许可证发布。
