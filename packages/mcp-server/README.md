# Collector MCP Server

Checkpoint 3 的薄 stdio MCP runtime。它只调用发布版 Collector Core loopback API，不导入 Core
源码，不控制浏览器，也不拥有 Operation/Artifact 生命周期。

启动时必须同时验证：

- Core release `0.7.17` 与 Service schema 3；
- required feature flags；
- origin-independent OpenAPI SHA-256；
- capability catalog SHA-256；
- 15 项 direct-ready contract、request schema digest 与 execution target；
- 带 `browser-bindings:read` scope 的真实 Core token。

当前 MCP 表面只有：

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

Checkpoint 3 不注册任何 MCP Tool，所以这个包不能创建平台 Operation。15 项强类型 capability
Tools 属于 Checkpoint 4。

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
