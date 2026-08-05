# SourceRelay AgentKit

> A thin MCP + Skills integration layer for SourceRelay Core.

SourceRelay AgentKit 把 SourceRelay Core 已登记的采集能力，转换成 AI Host 可以安全发现和调用的
强类型 MCP Tools、只读 Resources 与版本化 Skills。它是协议适配层，不是 Workflow Engine、
Planner、模型 Provider 或浏览器自动化框架。

[SourceRelay Core](https://github.com/hc-tec/SourceRelay) 负责浏览器扩展、Gateway、官方 Provider
和数据采集；AgentKit 只负责把 Core 合同带到 Codex、Claude、DeerFlow 或其他 MCP Client。

## 先看结论

- 当前 MCP catalog：18 个 typed Tools、3 个静态 Resources、3 个 Resource templates。
- 15 个 Tool 通过用户已经配对的 Browser Provider 执行，3 个 Tool 通过 Core Gateway 的
  Zhihu Official Provider 执行。
- 每次 Tool 调用最多提交一个 Core Operation，立即返回 Operation Resource URI；Agent Host 自己
  决定目标、推理、轮询预算和最终输出。
- MCP 不读取 Cookie/Profile，不控制浏览器，不接受任意 URL、selector、script、tab、CDP、
  DevTools 或 Network response body。
- 当前 release anchor：Core `0.7.17`、service schema `3`、tool catalog
  `collector.mcp.tools/v1`。

## 它在系统中的位置

```text
Agent / AI-native Application
  ├─ owns goal, reasoning, project state and final output
  ├─ loads pinned Skills
  └─ uses an MCP Client
          │ stdio
          ▼
SourceRelay AgentKit
  ├─ compatibility preflight
  ├─ typed Tools
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

这个边界是硬合同：Core 可以脱离 AgentKit 独立运行；AgentKit 也不能导入、启动、代理或回退到
历史 `inteligence-apps` 原型。

## 快速开始

### 前置条件

- Node.js `>=22`；
- 一个已运行并完成配对的 SourceRelay Core Gateway；
- Core 为 MCP 子进程签发的最小权限 token：通常为
  `browser-bindings:read`、`collect:execute`、`operations:read`、`artifacts:read`；
- 不把 token 写入仓库、Skill、prompt、日志或命令行历史。

Core 的安装、扩展加载、配对和 token 创建见[SourceRelay 用户浏览器部署 runbook](https://github.com/hc-tec/SourceRelay/blob/main/docs/runbooks/core-user-browser-deployment-v0.7.md)。

### 安装、构建并运行 stdio MCP

```powershell
Set-Location D:\AIProject\collector-ai-integration
npm ci
npm run build

$env:COLLECTOR_CORE_ORIGIN = 'http://127.0.0.1:43127'
$env:COLLECTOR_CORE_TOKEN = 'cst_...'
node .\packages\mcp-server\dist\src\cli.js
```

MCP 进程只从自己的进程环境读取专用 Core token。Agent Host 看不到 token 的内容，Tool 和
Resource 结果也不会回显它。

### 配置 MCP Client

Agent Host 只需要启动这个 stdio 进程。不同 Host 的配置文件位置不同，核心配置等价于：

```json
{
  "mcpServers": {
    "sourcerelay": {
      "command": "node",
      "args": ["<absolute-path>/packages/mcp-server/dist/src/cli.js"],
      "env": {
        "COLLECTOR_CORE_ORIGIN": "http://127.0.0.1:43127",
        "COLLECTOR_CORE_TOKEN": "<inject-from-local-secret-store>"
      }
    }
  }
}
```

上面的 `<inject-from-local-secret-store>` 是部署占位符，不要把真实 token 提交到配置文件。

启动后，MCP 会先读取并校验 Core 的 release、capability catalog、OpenAPI schema 和 binding
合同；任一 digest、feature 或 direct-ready 集合不一致时会 fail closed，不会继续暴露过期 Tool。

### 使用 GitHub Release Core 制品做 L2 验证

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

仓库中的 `.github/workflows/released-core-l2.yml` 会在 CI 中重复同一条路径：下载固定的
SourceRelay Core GitHub Release asset，先校验归档 SHA-256，再让 AgentKit 的 packaged MCP 消费
解压目录中的 Gateway。它不 checkout Core 源码、不依赖用户浏览器、Profile、Cookie 或真实平台。

## Tool 与 Resource 合同

### Tool catalog

| Provider | Tool 数量 | 是否需要 `bindingAlias` | 代表能力 |
| --- | ---: | --- | --- |
| Bilibili Browser Provider | 10 | 是 | 搜索、视频详情、账号、动态、合集、弹幕、讨论 |
| Xiaohongshu Browser Provider | 5 | 是 | 公开搜索、博主笔记、详情、评论、评论回复 |
| Zhihu Official Provider | 2 | 否 | 公开内容搜索、热榜 |
| Global Web Search via Zhihu Provider | 1 | 否 | 公共网页搜索 |

每项 direct-ready Core capability 对应一个强类型 Tool。Browser Provider 的 AI-visible schema
包含 session-local `bindingAlias`；Official Provider 不暴露浏览器身份，也不接受 binding，内部
固定使用 Core 的 `official_api` execution target。

典型 Browser Provider 调用形状（字段仍以实时 Tool schema 为准）：

```json
{
  "bindingAlias": "binding-1",
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
outcome uncertainty；Artifact 先读取 metadata，再沿返回的 chunk URI 进行固定大小的 UTF-8
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

# 仓库边界、Skill package、TypeScript build 与 39 项 L1 合同测试
npm run verify
```

L2 使用发布形态的 MCP 与真实本地 Core 进程，但不会创建平台 Operation：

```powershell
$env:COLLECTOR_L2_CORE_ENTRYPOINT = '<released Core user-browser-server.js>'
npm run test:l2
```

L3/L4 只在明确的真实 Core + packaged MCP + 真实平台 / Agent Host 条件下执行。当前证据状态：

- Bilibili：typed Tool L3 matrix 与 pinned-Skill Agent L4 已验证；
- Xiaohongshu：5 个 typed Tool 的真实 L3 matrix 已验证；
- Zhihu Official Provider：Core Gateway 已验证，AgentKit MCP L3 三能力矩阵待有效本机凭证下单独验证；
- 默认 L1/L2 通过不等于平台能力通过。

## 明确不负责什么

- Workflow Engine、Planner、Workspace、Task/Run/Step 或统一恢复器；
- DeepResearch、DeerFlow、蜂群调度、报告生成、向量数据库或业务数据库；
- 模型 Provider、prompt 管理、长期账号档案和跨平台分析；
- Cookie/Profile/密码/浏览器生命周期管理；
- Playwright、CDP、DevTools、任意 tab、任意 selector、任意脚本或任意 Network API；
- 对 Core Artifact 的二次复制和无限制原始内容读取；
- 未登记在 Core live catalog 中的隐藏能力。

## 仓库结构

```text
contracts/                  manifest 与协议 schema
manifests/                  机器可读兼容性清单
packages/mcp-server/        thin stdio MCP runtime、Core client、Tools、Resources
skills/                     Foundation、Platform、Intent Skills
tests/                      repository gate、L1、real-Core stdio L2
scripts/                    verification 与 package digest 入口
docs/architecture/          目标架构与决策记录
docs/validation/            L3/L4 真实证据与边界
```

## 从哪里继续读

- [目标架构](docs/architecture/collector-ai-native-target-architecture.md)
- [MCP Tool contract](docs/architecture/checkpoint-4-capability-tool-contract.md)
- [Skills catalog](skills/README.md)
- [L3/L4 验证证据](docs/validation/)
- [兼容性清单](manifests/compatibility.json)
- [SourceRelay Core](https://github.com/hc-tec/SourceRelay)

## 贡献、安全与许可

贡献前阅读 [AGENTS.md](AGENTS.md)、[CONTRIBUTING.md](CONTRIBUTING.md) 和
[SECURITY.md](SECURITY.md)。新增 Tool 或 Skill 必须先完成 Core 合同、schema digest、权限边界、
测试和真实验证证据，不能通过增加一个 generic JSON Tool 绕过能力登记。

本项目使用 [Apache License 2.0](LICENSE) 开源。
