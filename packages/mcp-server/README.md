# Collector MCP Server

Checkpoint 4 的薄 stdio MCP runtime。它只调用发布版 Collector Core loopback API，不导入 Core
源码，不控制浏览器，也不拥有 Operation/Artifact 生命周期。

启动时必须同时验证：

- Core release `0.7.17` 与 Service schema 3；
- required feature flags；
- origin-independent OpenAPI SHA-256；
- capability catalog SHA-256；
- 15 项 direct-ready contract、request schema digest 与 execution target；
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
```

Tool input schema 由启动时 digest-verified Core request schema 机械变换：使用 session-local
`bindingAlias` 替换 Core browser binding ID，隐藏 schema/platform/capability/fixed target，并把
capability input 字段扁平化。只有 Core 声明为 enum 的 execution target 才能由调用者选择。

每次 Tool 调用只执行一次 `POST /v2/collect`，保留调用者提供的 `clientRequestId`，并立即返回
`operationId` 与 `collector://operations/{operationId}`。它不等待终态、不轮询、不读取 Artifact、
不调用模型，也不在 transport outcome unknown 时自动重试。

开发启动：

```powershell
$env:COLLECTOR_CORE_ORIGIN = 'http://127.0.0.1:43127'
$env:COLLECTOR_CORE_TOKEN = 'cst_...'
npm run build
node .\packages\mcp-server\dist\src\cli.js
```

Core token 仅从 MCP 子进程环境进入内存，不进入 stdout、Resource 或结构化 stderr。Windows
Credential Manager 与普通用户安装配置属于 Checkpoint 6，当前不得把环境变量 L2 当成最终
安装体验。
