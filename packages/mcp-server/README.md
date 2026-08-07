# Collector MCP Server

Checkpoint 4 的薄 stdio MCP runtime。它只调用发布版 Collector Core loopback API，不导入 Core
源码，不控制浏览器，也不拥有 Operation/Artifact 生命周期。

启动时必须同时验证：

- Core release `0.7.17` 与 Service schema 3；
- required feature flags；
- origin-independent OpenAPI SHA-256；
- capability catalog SHA-256；
- 18 项 direct-ready contract、request schema digest 与 execution target（15 项 Browser Provider、
  3 项 Zhihu Official Provider）；
- 带 `browser-bindings:read` scope 的真实 Core token。

当前 MCP Resource 表面是：

```text
collector://release
collector://capabilities
collector://bindings
collector://operations/{operationId}
collector://artifacts/{artifactId}
collector://artifacts/{artifactId}/chunks/{cursor}
```

`bindings` 只返回 session-local `binding-N` 别名；不返回 Core binding/extension identity。
Operation Resource 保留 exact Core state/error/terminal facts，但去除 binding identity 与旧 retrieval
path。Artifact 先读 metadata，再用固定 16 KiB UTF-8 byte cursor 读取正文；不接受 query、文件
路径、JSONPath 或任意字节上限。

当前 MCP Tool catalog 是 `collector.mcp.tools/v1`，严格一项 direct-ready capability 对应一项
Tool：

```text
collector_bilibili_video_detail
collector_bilibili_native_search
collector_bilibili_native_search_batch
collector_bilibili_account_profile
collector_bilibili_account_inventory
collector_bilibili_dynamic
collector_bilibili_collection_series_overview
collector_bilibili_collection_series_detail
collector_bilibili_danmaku
collector_bilibili_discussion
collector_xiaohongshu_public_notes_search
collector_xiaohongshu_account_public_notes
collector_xiaohongshu_note_public_detail
collector_xiaohongshu_note_public_comments
collector_xiaohongshu_note_public_comment_replies
collector_zhihu_search_public_content
collector_zhihu_hot_list_public_content
collector_web_search_global_zhihu_provider
```

Tool input schema 由启动时 digest-verified Core request schema 机械变换：Browser Provider Tool
可选使用 session-local `bindingAlias` 替换 Core browser binding ID；省略时，AgentKit 会在提交前
刷新安全绑定投影并自动选择唯一 `online` 会话，隐藏
schema/platform/capability/fixed target，并把 capability input 字段扁平化。Official Provider
Tool 不暴露浏览器身份，也不接受 `bindingAlias`；其 execution target 由 Core 固定为
`official_api`。只有 Core 声明为 enum 的 execution target 才能由调用者选择。

在 readiness 和输入都满足时，每次 Tool 调用最多执行一次 `POST /v2/collect`，保留调用者提供的
`clientRequestId`，并立即返回 `operationId` 与 `collector://operations/{operationId}`。知乎
Official Provider 在 `runtimeState=credential_required` 时会先做一次本地能力 readiness 读取，
直接返回配置错误而不发送 POST。MCP 不等待终态、不轮询、不读取 Artifact、不调用模型，也不在
transport outcome unknown 时自动重试。Operation Resource 会额外给出一个
非权威的 `recommendedAction` 提示，帮助 Agent 直接决定轮询、读取 Artifact、继续其他来源或
停止平台动作；Core 的 exact state、terminal reason 和 error code 始终是事实来源。

知乎 Official Provider 的 `runtimeState` 是 Gateway 运行时状态，不改变静态 catalog digest。
`collector://capabilities` 每次读取都会刷新这个状态。状态为 `ready` 时，三个知乎 Tool 正常
提交；状态为 `credential_required` 时，MCP 在 POST 前 fail-closed，返回
`official_provider_credential_required`（Core code 为
`zhihu_official_api_credential_required`），并要求在本机 Gateway 边界配置 Provider。MCP 没有
配置凭证的 Tool，也不会把 Secret 放进 Tool 参数、日志、Artifact 或 Skill 状态；Agent 不应
要求用户在对话中粘贴 Secret，也不应改用浏览器/Cookie 路线。

如果 live catalog 缺少 Official Provider 的 `runtimeState` 或给出未知状态，MCP 以
`compatibility_unmet` fail-closed，不发送 Core POST；只有明确的 `ready` 才是提交许可。

开发启动（推荐使用 launcher）：

```powershell
npm run build
npm run agent:setup
node .\packages\mcp-server\dist\src\agent-cli.js status
node .\packages\mcp-server\dist\src\agent-cli.js mcp
```

首次 `setup` 后，Core token 只保存在当前用户目录的受限
`%LOCALAPPDATA%\\SourceRelay\\AgentKit\\core-credential.json`（非 Windows 使用
`$XDG_CONFIG_HOME/SourceRelay/AgentKit/core-credential.json`）。MCP Host 只需启动
`collector-agent mcp`，不会再要求手工复制 token、设置环境变量或编辑带 secret 的配置。
环境变量 `COLLECTOR_CORE_TOKEN` 仍作为 CI/L2 的显式覆盖入口，但不应写入仓库或 MCP 配置。
