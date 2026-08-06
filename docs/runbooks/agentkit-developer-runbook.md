# SourceRelay AgentKit 开发者 Runbook

> 适用版本：AgentKit `0.0.0-mcp-foundation`，Core `0.7.17`，service schema `3`。
>
> 这份 runbook 只描述已经冻结的 thin stdio MCP + released Core 路径。它不是安装器、浏览器
> 自动化脚本或上层 Agent/DeepResearch 工作流。

## 1. 仓库边界

| 仓库 | 位置 | 责任 |
| --- | --- | --- |
| SourceRelay Core | `D:\AIProject\inteligence` | Gateway、MV3 扩展、Browser Provider、Official Provider、Operation、Artifact、双 SDK |
| SourceRelay AgentKit | `D:\AIProject\collector-ai-integration` | stdio MCP、强类型 Tools、只读 Resources、Skills、兼容性与验证门禁 |
| 历史 prototype | `D:\AIProject\inteligence-apps` | 冻结归档，不是任何运行时依赖 |

两个产品通过已发布的 Core API/SDK、OpenAPI digest、capability catalog 和 MCP/Skill 合同连接。
AgentKit 不导入 Core 源码，不读取 Profile/Cookie，不接管浏览器，不启动或关闭 Gateway，也不
兼容历史 Task/Analysis API。

## 2. 前置条件

- Windows 11 首发环境；
- Node.js `>=22`（本次发布材料在 Node `24.13.0` 上验证）；
- Python `3.12` 或更高版本，用于 repository gate；
- 一个已经运行的 SourceRelay Core Gateway；
- 需要 Browser Provider 时，用户自己的 Chrome/Edge 已安装 production MV3 扩展并完成配对；
- 需要 Official Provider 时，凭证只配置在 Core 的 Gateway-only provider 边界，不传给 AgentKit。

浏览器、扩展、Gateway 和凭证的部署步骤见 [SourceRelay Core 用户浏览器部署 runbook](https://github.com/hc-tec/SourceRelay/blob/main/docs/runbooks/core-user-browser-deployment-v0.7.md)。
AgentKit 不创建测试 Profile，也不要求用户把日常浏览器迁移到 testbench。

## 3. 安装、构建与本地门禁

在 AgentKit 仓库执行：

```powershell
Set-Location D:\AIProject\collector-ai-integration
npm ci
npm run build
npm run verify
```

`npm run verify` 包含仓库边界、UTF-8、manifest、官方 Skill digest、TypeScript build、MCP
L1 合同、日志/secret 隔离和双 SDK/Tool catalog 相关门禁。门禁失败时先修复合同或依赖问题，
不要通过关闭断言或引入 fake Gateway 绕过。

## 4. 一次 setup，之后由 Agent Host 自动启动

用户不应为每个 Agent session 找端口、复制 token 或编辑 MCP 配置。AgentKit 提供一个很薄的
`collector-agent` launcher：它不是 Workflow/Planner，也不控制浏览器，只负责读取本机凭据、检查
Core loopback Gateway，并把 stdio 原样交给正式 MCP runtime。

首次安装在 AgentKit 仓库执行一次：

```powershell
Set-Location D:\AIProject\collector-ai-integration
npm ci
npm run build
npm run agent:setup
npm run agent:status
```

`setup` 只要求用户输入一次 Core Console 签发的最小权限 `cst_...` token。默认保存到：

```text
%LOCALAPPDATA%\SourceRelay\AgentKit\core-credential.json
```

文件只包含 schema、loopback origin、scoped token、创建时间和可选的已发布 Core entrypoint；
不会写入 Cookie、Profile、浏览器身份、Operation 内容或平台数据。Windows 首版使用当前用户
目录与受限文件模式；完整 DPAPI/Credential Manager 适配属于后续安装器增强，不在 MCP 合同内。

`status` 不只检查端口和 token 格式，还会执行与 MCP 启动相同的 release、capability、OpenAPI、
binding 和 digest 预检；不兼容时直接显示 `compatibility_unmet`，不会误报“已就绪”。

Codex 用户再执行一次：

```powershell
npm run agent:install-codex
```

它注册的是不含 secret 的 `collector-agent mcp` 命令。以后 Codex/其他 MCP Host 每个 session
只需启动这个命令：

```powershell
node .\packages\mcp-server\dist\src\agent-cli.js mcp
```

launcher 会复用已经运行的 Core。若首次 setup 时提供了已发布 Core 的 entrypoint：

```powershell
npm run agent:setup -- --core-entrypoint `
  'C:\Path\to\core-release\gateway\dist\user-browser-server.js'
```

那么 Gateway 不可达时 launcher 会启动这个明确配置的 release entrypoint，等待 loopback 健康后
再启动 MCP。它不会导入 Core 源码、创建 Profile、打开或关闭浏览器，也不会在 MCP 退出时关闭
Gateway。没有配置 entrypoint 时，`agent:status` 会明确告诉用户需要启动 Core，而不是反复重试。

推荐 token scopes：

```text
browser-bindings:read
collect:execute
operations:read
artifacts:read
```

不要把真实 token 写入仓库、`.env`、Skill、prompt、MCP 配置提交、命令行历史或日志。生产
Agent Host 仍可在 CI/L2 中显式注入 `COLLECTOR_CORE_TOKEN`，它优先于本机 credential store；
正常安装不需要环境变量。

等价的 MCP host 配置形状如下，配置中没有 secret：

```json
{
  "mcpServers": {
    "collector": {
      "command": "<absolute-path-to-node>",
      "args": ["<absolute-path>/packages/mcp-server/dist/src/agent-cli.js", "mcp"]
    }
  }
}
```

如果 Host 没有 Codex CLI，可使用 `npm run agent:print-config` 生成上面的无密钥配置。启动时 MCP 会读取 Core release、capability catalog、OpenAPI schema 和 binding 合同。任一
release/API/schema/feature/digest 不满足时，进程应 fail closed 并返回 `compatibility_unmet`；
不得让 Agent 猜字段、切换到旧 endpoint 或下载未经验证的兼容代码。

## 5. 使用正式 Core Release 做 L2

L2 必须使用 GitHub Release 的完整制品，而不是相邻 Core checkout 中任意一个 `dist` 目录。
当前固定 release：

```text
tag:       core-v0.7.17
asset:     sourcerelay-core-0.7.17.tar.gz
download:  https://github.com/hc-tec/SourceRelay/releases/download/core-v0.7.17/sourcerelay-core-0.7.17.tar.gz
sha256:    ab444468be0209100371651de2e65284e07cee319bee8eed8db3822ded7784d7
```

下载后先校验归档，再解压并确认 `release-manifest.json`、`sha256sums.json`、SBOM 与 Gateway
entrypoint 都在同一个 release 根目录中：

```powershell
Set-Location D:\AIProject\collector-ai-integration
New-Item -ItemType Directory -Force .\runtime\core-release-download | Out-Null
$archive = (Resolve-Path .\runtime\core-release-download).Path + '\sourcerelay-core-0.7.17.tar.gz'
Invoke-WebRequest `
  -Uri 'https://github.com/hc-tec/SourceRelay/releases/download/core-v0.7.17/sourcerelay-core-0.7.17.tar.gz' `
  -OutFile $archive
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant() -ne `
    'ab444468be0209100371651de2e65284e07cee319bee8eed8db3822ded7784d7') {
  throw 'SourceRelay Core release archive SHA-256 mismatch'
}
tar -xzf $archive -C .\runtime\core-release-download
$env:COLLECTOR_L2_CORE_ENTRYPOINT = `
  (Resolve-Path .\runtime\core-release-download\core-release-0.7.17\gateway\dist\user-browser-server.js).Path
npm run test:l2
```

成功的 L2 必须显示 `releasedCoreBundleVerified: true`、Core `0.7.17`、18 个 direct contracts、
18 个 Tools、`platformOperationsCreated: 0`、`officialOperationsCreated: 0` 和
`livePlatformRequests: 0`。L2 证明的是 packaged MCP 与真实本地 Core 的协议闭环，不是平台
真实可用性；平台能力只能由 L3/L4 证据证明。

额外的 launcher 入口门禁使用同一个真实 Core entrypoint，但通过本机 credential store 启动
`collector-agent mcp`，验证“Agent Host 不需要把 token 放进 MCP 配置”的闭环：

```powershell
$env:COLLECTOR_L2_CORE_ENTRYPOINT = '<released Core user-browser-server.js>'
npm run test:l2:launcher
```

它在临时 loopback 端口创建 scoped client、启动真实 Core/MCP、完成一次 MCP initialize 后清理
临时进程和凭据；不会创建平台 Operation，也不接触日常浏览器。

## 6. 真实 L3/L4 的边界

L3/L4 是低频、只读、显式 case 的验证，不属于普通开发启动命令：

- Browser Provider 只通过用户日常浏览器中已经配对的 production MV3 执行；AgentKit 不打开、
  关闭、刷新或附着浏览器，不管理 Profile；
- Official Provider 可在随机 `127.0.0.1` 隔离端口运行正式 Core，但必须显式设置
  `COLLECTOR_L3_ALLOW_ISOLATED_CORE=true`，且仍然使用真实 Provider；
- 每个进程最多提交一次 Tool，不自动重试，不换新的 `clientRequestId` 掩盖不确定结果；
- 失败、登录失效、验证码、限流或 outcome unknown 必须保留原始 Core 终态；不能改写成
  `no_results`；
- L4 只能复用一个已经完成的 L3 request identity，Skill digest 必须固定。

矩阵证据：

- [B站 L3/L4](../validation/developer-readiness-bilibili-l3-matrix.md)；
- [小红书 L3](../validation/developer-readiness-xiaohongshu-l3-matrix.md)；
- [知乎 Official Provider L3](../validation/developer-readiness-zhihu-l3-matrix.md)；
- [Checkpoint 5 B站 canary](../validation/checkpoint-5-l3-bilibili-canary.md)；
- [Checkpoint 5 pinned-Skill L4](../validation/checkpoint-5-l4-codex-pinned-skill-canary.md)。

## 7. 常见故障定位

### `compatibility_unmet`

1. 确认 AgentKit 运行的是 Core `0.7.17` 正式制品，而不是旧 Gateway、源码目录或缓存临时
   bundle；
2. 读取 `collector://release`、`collector://capabilities` 和 `collector://bindings`，对照
   `manifests/compatibility.json` 的 service schema、required features、OpenAPI digest、
   catalog digest 与 18 项 direct capability；
3. 凭证 readiness（例如 Official Provider 的 `ready`/`credential_required`）是运行时状态，
   不属于静态 catalog identity；不要因为换凭证而手工改 digest；
4. 若 release 合同确实变化，先发布/更新 Core 与 manifest 的版本化合同，再重新运行门禁。

### token 或 scope 错误

- `COLLECTOR_CORE_ORIGIN` 必须是 `http://127.0.0.1:<port>`，不要使用 LAN 地址、HTTPS、路径、
  query 或 fragment；
- token 必须是 Core 为 AgentKit 签发的最小 scope token，不能使用浏览器 Cookie、Profile 或
  平台 secret 代替；
- 403 时保留 Core error code，检查 scope 与 binding 是否匹配，不要重试平台动作。

### 没有 binding 或页面仍在加载

先检查 Core Gateway 和用户日常浏览器中的 production MV3 是否在线、配对是否仍有效、目标
能力的 execution target 是否满足。AgentKit 不通过 tab 切换、DOM 点击、任意 selector 或
Network API 补救，也不应因为等待页面而快速开关页面。

### L2/L3 进程退出

只清理自己启动的 MCP 子进程和临时 release 解压目录；不要停止、重启或接管用户正在使用的
Gateway、浏览器、扩展或其他验证会话。若 Core 已接受 Operation，使用原始
`clientRequestId` 做幂等对账，不创建第二次平台动作。

## 8. 发布前清单

- `npm ci`、`npm run verify`、`npm run test:l2` 均通过；
- `manifests/compatibility.json` 的 checkpoint 为 `completed: [0,1,2,3,4,5,6]`、`next: null`；
- Core release asset hash 与 workflow 中的 `210d7107...` 一致；
- release-manifest、SBOM、checksum 与 Tool/catalog/OpenAPI digest 一致；
- L3/L4 证据只记录去敏 provenance、大小和 hash，不记录 token、Cookie、Profile、查询正文
  或 Artifact 正文；
- `git diff --check` 通过，staged 内容没有 secret、Profile、临时 bundle 或 runtime 数据；
- 变更提交到 AgentKit 仓库并推送 `main`，不要把上层应用提交到 SourceRelay Core。

## 9. 当前发布身份

```text
AgentKit version:       0.0.0-mcp-foundation
Core release:           0.7.17
Core service schema:    3
MCP tool catalog:       collector.mcp.tools/v1
Core catalog digest:    sha256:3c05da851fff32fecf4da4b36ccfcec24a6630118ccd4b2e3552d17caa5b3ab4
Core OpenAPI digest:    sha256:c1f9b713f7e5ae1bd7d5d4294f08d5bda52b4352f6b30665d4c1b9b168b56cea
Core archive SHA-256:   ab444468be0209100371651de2e65284e07cee319bee8eed8db3822ded7784d7
```
