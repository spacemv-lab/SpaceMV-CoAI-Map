# AI Chat Web

功能概览：
- 会话管理：本地持久化、创建/切换、消息统计
- 消息渲染：Markdown、代码块复制
- 输入与流控：Enter 发送、Shift+Enter 换行、停止与重新生成
- 附件与语音：GeoJSON 上传提示、浏览器语音识别转写
- 工具面板：展示工具事件，支持图层显隐联动
- 主题系统：自动亮/暗模式
- 性能优化：content-visibility、消息项 memo

入口示例：
- `src/lib/examples/Demo.tsx` 展示完整组合与适配器

主要组件：
- `ChatWindow` 窗口容器与侧栏
- `MessageList`/`MessageItem` 消息列表与渲染
- `ChatInput` 输入框/上传/语音/停止/重试
- `ToolPanel` 工具事件与图层联动
- `AiTheme` 主题变量与亮/暗模式

数据与实时：
- `use-socket-chat` WebSocket 连接、流式消息、工具事件、图层联动
- `store/chat-store` 本地会话与消息持久化

集成方式（示例）：
1. 在应用中引入 `AiTheme` 设置主题
2. 使用 `useSocketChat` 建立连接并传入 `ChatWindow`
3. 通过适配器 `chat/files/voice` 发送/上传/语音操作
4. 可选：接入 `ToolPanel` 以展示工具结果与联动

