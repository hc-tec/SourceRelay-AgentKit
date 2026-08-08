# SourceRelay AgentKit

> SourceRelay Core 的 MCP + Skills 适配层，让 AI Agent 可以安全调用已经登记的浏览器采集能力。

SourceRelay AgentKit 把 Core 的 capability catalog 转换成强类型 MCP Tools、只读 Resources 和
版本化 Skills。它是一个薄协议适配层，不是 Workflow Engine、Planner、模型 Provider、DeepResearch
框架或浏览器自动化框架。

[SourceRelay Core](https://github.com/hc-tec/SourceRelay) 负责 Gateway、MV3 扩展、用户日常浏览器、
官方 Provider 和平台采集；AgentKit 负责把已经发布的 Core 合同安全地带到 Codex、Claude、DeerFlow
或其他 MCP Host。

## 先看使用体验

### 第一次安装

前提是已经安装 SourceRelay Core，并在用户自己的 Chrome/Edge 中完成扩展配对。Core 可以已经
运行，也可以在 setup 时提供一个正式发布版的 Gateway entrypoint。

```powershell
Set-Location D:\AIProject\collector-ai-integration
npm ci
npm run build

# 只在第一次执行：输入一次 Core 签发的最小权限 scoped token
npm run agent:setup

# 只在第一次执行：把无密钥 launcher 注册到 Codex
npm run agent:install-codex
```

`agent:setup` 将凭据保存到当前用户目录：

```text
Windows: %LOCALAPPDATA%\SourceRelay\AgentKit\core-credential.json
其他系统: $XDG_CONFIG_HOME/SourceRelay/AgentKit/core-credential.json
```

凭据文件只供本机 launcher 使用，不会进入 Git、MCP JSON、Skill、prompt、stdout 或日志。默认
scopes 为：

```text
browser-bindings:read
collect:execute
operations:read
artifacts:read
```

如果 setup 时 Gateway 暂未运行，可以把正式 Core entrypoint 一起登记；`--skip-core-check` 只
跳过当次网络检查，不改变 token 权限：

```powershell
npm run agent:setup -- `
  --skip-core-check `
  --core-entrypoint 'C:\Path\to\core-release\gateway\dist\user-browser-server.js'
```

### 以后日常使用

```powershell
codex
```

Codex 会按需启动 `collector-agent mcp`。launcher 会自动读取本机凭据，检查 Core 的 release、
capability、OpenAPI、binding 和 digest；如果 Gateway 不可达且已经配置了正式 entrypoint，它会
自动拉起 Gateway。MCP 是 Agent Host 的 stdio 子进程，不需要作为另一个常驻服务手动维护。

健康检查：

```powershell
npm run agent:status
npm run agent:doctor
```

`status` 与真正的 MCP 启动使用同一份 compatibility preflight。只要 Core 身份不匹配，命令会
返回 `compatibility_unmet`，不会让 Agent 看到一组过期 Tools。

### 其他 MCP Host

先生成无密钥配置：

```powershell
npm run agent:print-config
```

生成的配置形状如下，真实 token 不会出现在其中：

```json
{
  "mcpServers": {
    "collector": {
      "command": "<absolute-path-to-node>",
      "args": [
        "<absolute-path>/packages/mcp-server/dist/src/agent-cli.js",
        "mcp"
      ]
    }
  }
}
```

也可以直接使用：

```text
collector-agent mcp
```

维护者需要对真实 B 站 hover 菜单或扩展 worker 做开发验证时，使用独立的
[Chrome DevTools MCP 验证 runbook](docs/runbooks/chrome-devtools-mcp-validation.md)。它不属于
Collector MCP Tool catalog，不得连接或接管日常 Chrome/Edge；正式 L3/L4 仍通过 released Core
和 `collector` MCP 证明。

它只负责本机 bootstrap 和 stdio 转发，不导入 Core 源码，不创建 Profile，不打开或关闭浏览器，
也不会在 MCP 退出时关闭 Core Gateway。

## 它在系统中的位置

```text
Agent / AI-native Application
  ├─ owns goal, reasoning, project state and final output
  ├─ loads pinned Skills
  └─ uses an MCP Client
          │ stdio
          ▼
collector-agent launcher
  ├─ reads local credential store
  ├─ probes/optionally starts released Core Gateway
  └─ starts the thin MCP runtime
          │ stdio
          ▼
SourceRelay AgentKit MCP
  ├─ compatibility preflight
  ├─ 18 typed Tools
  ├─ Operation / Artifact Resources
  ├─ bounded logs and Core auth boundary
  └─ no workflow, model or browser lifecycle
          │ versioned Core API
          ▼
SourceRelay Core
  ├─ loopback Gateway
  ├─ paired MV3 extension in the user's daily browser
  └─ allowlisted Official Providers
```

这个边界是硬合同：Core 可以脱离 AgentKit 独立运行；AgentKit 不导入历史 `inteligence-apps`，
不接受任意 URL、selector、script、tab、CDP、DevTools 或 Network response body，也不扩大 Core
已经发布的浏览器权限。

## 当前能力锚点

- 18 个 typed MCP Tools；
- 3 个静态 Resources；
- 3 个 Resource templates；
- 15 个 Browser Provider Tools，3 个 Zhihu Official Provider Tools；
- 每次 Tool 调用最多提交一个 Core Operation，立即返回 Operation Resource URI；
- Agent 自己负责目标、推理、预算、轮询和最终报告，MCP 不创建 Workflow 或 Planner；
- AgentKit `0.0.0-mcp-foundation` 配套 Core `0.7.17`、service schema `3`、
  `collector.mcp.tools/v1`。

## 使用 GitHub Release Core 制品做 L2 验证

L2 必须消费 SourceRelay GitHub Release 中的版本化制品，不能把 MCP 接到相邻 checkout 的源码
构建目录。当前兼容锚点为 `core-v0.7.17`，发布包下载地址为：

```text
https://github.com/hc-tec/SourceRelay/releases/download/core-v0.7.17/sourcerelay-core-0.7.17.tar.gz
```

下载并解压后，先用 Core release verifier 校验 `release-manifest.json`、SBOM 和 checksum；也可以
直接运行下面的 AgentKit L2，它会在启动 Core 前再次检查整个 bundle：

```powershell
Set-Location D:\AIProject\collector-ai-integration
$env:COLLECTOR_L2_CORE_ENTRYPOINT = `
  '<downloaded>\core-release-0.7.17\gateway\dist\user-browser-server.js'
npm run test:l2
```

`release-manifest.json`、`sbom.cdx.json` 和 `sha256sums.json` 是发布身份与完整性依据。AgentKit 的
L2 脚本会检查 Core Gateway entrypoint 确实位于该 bundle，并重新核对整个文件集合、SHA-256、SBOM
和 checksum；源码目录或没有 manifest 的任意 `dist` 都会直接失败。

成功结果必须同时包含 `releasedCoreVersion: "0.7.17"`、`releasedCoreBundleVerified: true`、
30 个 manifest 文件、31 个 checksum 文件、169 个 SBOM components、18 个 Tool、18 个 direct contract、
`manifestParity: true`、`platformOperationsCreated: 0`、`officialOperationsCreated: 0` 和
`livePlatformRequests: 0`。这一步验证的是“packaged MCP + released Core process”的 L2
协议闭环，不代表真实平台 L3 已验收。

验证 launcher 使用本机 credential store 接入真实 Core 的 L2：

```powershell
$env:COLLECTOR_L2_CORE_ENTRYPOINT = `
  '<downloaded>\core-release-0.7.17\gateway\dist\user-browser-server.js'
npm run test:l2:launcher
```

该测试会在临时 loopback 端口启动真实 Core，签发临时 scoped token，通过
`collector-agent mcp` 完成 MCP initialize，然后清理临时进程和凭据；不会创建平台 Operation。

仓库中的 `.github/workflows/released-core-l2.yml` 会在 CI 中重复同一条路径：下载固定的
SourceRelay Core GitHub Release asset，先校验归档 SHA-256，再让 AgentKit 的 packaged MCP 消费
解压目录中的 Gateway。它不 checkout Core 源码、不依赖用户浏览器、Profile、Cookie 或真实平台。

### AgentKit release candidate

当前组合使用 AgentKit `0.0.0-mcp-foundation` + Core `0.7.17`。对应的 release-candidate tag 为：

```text
agentkit-v0.0.0-mcp-foundation
```

`.github/workflows/agentkit-release-candidate.yml` 只在这个 tag（或显式手动运行）上发布。它会
先下载并校验固定的 Core Release，再运行真实本地 Core 进程 L2，最后发布 MCP npm tarball、
`compatibility.json` 与 `SHA256SUMS`。因此 AgentKit release 不会把 Core 源码、Profile、Cookie
或平台数据打进制品，也不会把一个只通过单元测试的 MCP 包标记为可用。

## Tool 与 Resource 合同

### Tool catalog

| Provider | Tool 数量 | `bindingAlias` | 代表能力 |
| --- | ---: | --- | --- |
| Bilibili Browser Provider | 10 | 单一 online 会话可省略 | 搜索、视频详情、账号、动态、合集、弹幕、讨论 |
| Xiaohongshu Browser Provider | 5 | 单一 online 会话可省略 | 公开搜索、博主笔记、详情、评论、评论回复 |
| Zhihu Official Provider | 3 | 否 | 公开内容搜索、热榜、全网搜索 |
| Global Web Search via Zhihu Provider | 1 | 否 | 公共网页搜索 |

每项 direct-ready Core capability 对应一个强类型 Tool。Browser Provider 的 AI-visible schema
允许 session-local `bindingAlias`；省略时 AgentKit 自动选择唯一 online 会话，只有多在线会话时才需要显式选择。Official Provider 不暴露浏览器身份，也不接受 binding，内部
固定使用 Core 的 `official_api` execution target。

知乎 Official Provider 的三项能力还带有实时 `runtimeState`。AgentKit 会在每次读取
`collector://capabilities` 时刷新该状态，并在 Tool 提交前再次检查：`ready` 才会提交一次
Core Operation；`credential_required` 则返回 `official_provider_credential_required`，通过
`configurationAction=configure_gateway_official_provider` 指向本机 Gateway 配置，不索要聊天
中的 Secret，也不回退到浏览器或 Cookie。
如果 Official Provider 的 live catalog 缺少或给出未知 `runtimeState`，MCP 会以
`compatibility_unmet` fail-closed，不发送 Core POST。

典型 Browser Provider 调用形状（字段仍以实时 Tool schema 为准）：

```json
{
  "clientRequestId": "<uuid>",
  "query": "人工智能"
}
```

典型 Official Provider 调用不包含浏览器绑定：

```json
{
  "clientRequestId": "<uuid>",
  "query": "人工智能",
  "count": 10
}
```

### Resource surface

```text
collector://release
collector://capabilities
collector://bindings
collector://operations/{operationId}
collector://artifacts/{artifactId}
collector://artifacts/{artifactId}/chunks/{cursor}
```

Operation Resource 保留 Core 的 exact state、terminal reason、error code、partial coverage 和
outcome uncertainty，并提供非权威的 `recommendedAction` 处理提示；Artifact 先读取 metadata，再沿返回的 chunk URI 进行固定大小的 UTF-8
读取。AgentKit 不把 Artifact 复制到自己的数据库，也不把内容交给模型处理。

## Skills 是方法，不是权限

仓库提供 5 个版本化、带 digest 的官方 Skill：

| Skill | 用途 |
| --- | --- |
| `use-collector-mcp` | compatibility、binding、一次提交、Operation、Artifact 和错误处理 |
| `collect-bilibili` | Bilibili Tool 选择、输入边界与序列化读取 |
| `collect-xiaohongshu` | 小红书 no-refresh / overlay / Network-first 页面状态边界 |
| `collect-zhihu` | Zhihu Official Provider 的搜索、热榜和公共网页搜索 |
| `research-search-then-detail` | 先广度搜索、再对选中结果做有界详情读取 |

Skill 只教授 Agent 如何选择和调用能力，不授予权限、不保存凭证、不拥有 Operation 状态，
也不创建 workflow。Skill package digest 和精确 Tool/Resource 要求记录在各自的 `manifest.json`
和 [skills/README.md](skills/README.md) 中。

## 验证

默认验证不访问真实平台：

```powershell
Set-Location D:\AIProject\collector-ai-integration
npm ci

# 仓库边界、Skill package、TypeScript build 与 49 项 L1 合同测试
npm run verify
```

L2 使用发布形态的 MCP 与真实本地 Core 进程，但不会创建平台 Operation：

```powershell
$env:COLLECTOR_L2_CORE_ENTRYPOINT = '<released Core user-browser-server.js>'
npm run test:l2
```

launcher 的真实本地闭环：

```powershell
$env:COLLECTOR_L2_CORE_ENTRYPOINT = '<released Core user-browser-server.js>'
npm run test:l2:launcher
```

L3/L4 只在明确的真实 Core + packaged MCP + 真实平台 / Agent Host 条件下执行。当前证据状态：

- Bilibili：typed Tool L3 matrix 与 pinned-Skill Agent L4 已验证；
- Xiaohongshu：5 个 typed Tool 的真实 L3 matrix 已验证；
- Zhihu Official Provider：三个 typed Tool 的 AgentKit MCP L3 矩阵已验证（见
  [`developer-readiness-zhihu-l3-matrix`](docs/validation/developer-readiness-zhihu-l3-matrix.md)）；
- 默认 L1/L2 通过不等于平台能力通过。

## 明确不负责什么

- Workflow Engine、Planner、Workspace、Task/Run/Step 或统一恢复器；
- DeepResearch、DeerFlow、蜂群调度、报告生成、向量数据库或业务数据库；
- 模型 Provider、prompt 管理、长期账号档案和跨平台分析；
- Cookie/Profile/密码/浏览器生命周期管理；launcher 只可按显式 entrypoint 启动 Core，不控制浏览器；
- Playwright、CDP、DevTools、任意 tab、任意 selector、任意脚本或任意 Network API；
- 对 Core Artifact 的二次复制和无限制原始内容读取；
- 未登记在 Core live catalog 中的隐藏能力。

## 仓库结构

```text
contracts/                  manifest 与协议 schema
manifests/                  机器可读兼容性清单
packages/mcp-server/        launcher、credential store、thin MCP runtime、Core client、Tools、Resources
skills/                     Foundation、Platform、Intent Skills
tests/                      repository gate、L1、real-Core stdio/launcher L2
scripts/                    verification 与 package digest 入口
docs/architecture/          目标架构与决策记录
docs/validation/            L3/L4 真实证据与边界
```

## 从哪里继续读

- [目标架构](docs/architecture/collector-ai-native-target-architecture.md)
- [MCP Tool contract](docs/architecture/checkpoint-4-capability-tool-contract.md)
- [Skills catalog](skills/README.md)
- [L3/L4 验证证据](docs/validation/)
- [AgentKit developer runbook](docs/runbooks/agentkit-developer-runbook.md)
- [兼容性清单](manifests/compatibility.json)
- [SourceRelay Core](https://github.com/hc-tec/SourceRelay)

## 贡献、安全与许可

贡献前阅读 [AGENTS.md](AGENTS.md)、[CONTRIBUTING.md](CONTRIBUTING.md) 和
[SECURITY.md](SECURITY.md)。新增 Tool 或 Skill 必须先完成 Core 合同、schema digest、权限边界、
测试和真实验证证据，不能通过增加一个 generic JSON Tool 绕过能力登记。

本项目使用 [Apache License 2.0](LICENSE) 开源。
