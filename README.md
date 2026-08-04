# Collector AI Integration

Collector AI Integration 是 Collector Core 的独立 AI-native 接入产品。它用一个薄的 MCP
协议适配器公开 Core 已登记的强类型采集能力，并用版本化 Skills 教 Agent 正确发现能力、
提交 Operation、解释终态和有界读取 raw Artifact。

## 当前状态

```text
architecture: approved
checkpoint 0: complete
checkpoint 1: complete
checkpoint 2: complete — repository foundation only
checkpoint 3: complete — thin stdio MCP foundation + L1/L2
checkpoint 4: complete — 15 typed capability Tools + exact parity gates
checkpoint 5: complete — 4 official Skills + Bilibili L3 + pinned-Skill Agent L4
runtime MCP: implemented — asynchronous Tools + read-only Operation/Artifact Resources
official Skills: 4 pinned version 0.1.0 packages; Foundation + Bilibili L4 validated
platform capability claim: Bilibili native search L3/L4 on one Windows production-MV3 configuration
```

当前仓库已经提供可打包的 TypeScript/Node stdio MCP 进程。它在启动时用真实 Core
`release + capabilities + OpenAPI + bindings` 完成 SHA-256 compatibility preflight，并只公开
Operation 与 Artifact 等只读 Resources。当前 15 项 direct-ready Core capability 均以独立强类型
Tool 发布；每次调用最多提交一个 Core Operation，并立即返回 Operation Resource URI。README、
manifest 或 Skill 说明永远不能替代实时 Core catalog。

## 产品位置

```text
Agent / AI-native Application
  ├─ owns goal, reasoning, project state and output
  ├─ loads pinned versioned Skills
  └─ uses MCP Client
          ↓
Collector AI Integration
  ├─ thin typed MCP adapter
  ├─ Operation Resources
  ├─ bounded Artifact Resources
  ├─ compatibility / auth / budgets / logs
  └─ no workflow, planner, model or browser control
          ↓
Collector Core API / SDK
          ↓
Paired MV3 extension in the user's daily Chrome/Edge
```

Collector Core 位于独立仓库 `D:\AIProject\inteligence`，必须能在没有本项目时独立使用。
已冻结历史原型位于 `D:\AIProject\inteligence-apps`；本项目禁止导入、启动、转发或回退到
该原型。

## 只负责什么

- 默认 stdio 的 thin Collector MCP Server；
- Core release、OpenAPI、capability 与 binding compatibility preflight；
- 一项 direct-ready Core capability 对应一项强类型 MCP Tool；
- Core Operation 的只读 Resources；
- Core Artifact 的 metadata-first、有界 Resources；
- 最小权限 Core credential、调用预算和内容最小化日志；
- Foundation、Platform、Intent 三层版本化 Skills；
- Windows 安装、配置、升级和卸载；
- L1–L4 分层验证与公开兼容清单。

## 明确不负责什么

- Workflow Engine、Planner、Workspace/Task/Run/Step 服务；
- KnowledgePack、Evidence Workspace、Analysis API 或报告生成；
- DeepSeek、DeerFlow、DeepResearch 或任何模型 provider；
- Cookie、Profile、Storage、密码或浏览器生命周期；
- Playwright、CDP、DevTools 或任意 URL/selector/script/tab/network Tool；
- Core raw Artifact 的复制数据库；
- 对 `inteligence-apps` 的兼容层；
- 未经 Core direct-ready catalog 登记的隐藏能力。

## 仓库结构

```text
contracts/                 versioned manifest schemas
docs/architecture/         canonical approved architecture and decision record
examples/                  future AI-native examples; currently empty by contract
manifests/                 truthful machine-readable product compatibility
packages/mcp-server/       thin stdio MCP runtime、Core client、typed Tools、Resources 与 L1 tests
packages/windows-configurator/
                            superseded boundary marker; no implementation planned
skills/                     Foundation、Bilibili、Xiaohongshu、search-then-detail official Skills
tests/                      repository gate 与 real-Core stdio L2
scripts/                    verification entrypoints
```

不存在根级 `src/`、通用 workflow 包或旧原型 adapter。Checkpoint 3 已通过 ADR-0001 选择
TypeScript/Node ESM 与官方 `@modelcontextprotocol/sdk@1.30.0`；默认 transport 只有 stdio。

## 运行与验证

安装依赖并运行 L1：

```powershell
Set-Location D:\AIProject\collector-ai-integration
npm install
python .\scripts\verify_repository.py
python -X utf8 .\scripts\skill_package.py verify .\skills
npm run test:l1
```

开发/L2 进程从子进程环境读取专用 Core token；Agent/MCP client 看不到它：

```powershell
$env:COLLECTOR_CORE_ORIGIN = 'http://127.0.0.1:43127'
$env:COLLECTOR_CORE_TOKEN = 'cst_...'
node .\packages\mcp-server\dist\src\cli.js
```

真实 L2 由发布形态 MCP 包连接真实本地 Core 进程：

```powershell
$env:COLLECTOR_L2_CORE_ENTRYPOINT = '<released Core user-browser-server.js>'
npm run test:l2
```

L2 只验证 stdio、真实 auth/preflight、15 项 Tool schema/Core parity、Resource/error/log 映射，
并硬检查非法调用创建了 0 个平台 Operation；它不能宣称任何网站能力。

## Compatibility 原则

唯一机器可读入口是：

```text
manifests/compatibility.json
```

Checkpoint 5 完成后的 manifest 必须诚实声明：

- phase 保持 `skills_canary`，Checkpoint 5 已进入 completed，current 为空，next 为 6；
- Core release `0.7.17`、Service schema 3、feature 与 catalog digest 已绑定；
- MCP protocol `2025-11-25`、stdio、15 项 typed Tool 与 6 类只读 Resource 已实现；
- Tool catalog 为 `collector.mcp.tools/v1`，每项记录 AI-visible input schema digest；
- 4 个官方 Skill 均固定 `0.1.0`、package digest、Tool/Resource/capability 要求和外部影响；
- `highestCompletedLevel` 为 `l4`，且只声明一个 B站原生搜索 L3/L4 实证配置；
- Windows real-process L2 已记录，但 browser 支持与平台 claim 仍为空；
- Workflow、模型、浏览器控制和旧原型依赖均为禁止状态。

后续只有在实现和对应验证 checkpoint 同时通过后，manifest 才能扩大声明。

## 后续 Checkpoints

### Checkpoint 3 — MCP Foundation

- 已完成：TypeScript/Node + 官方 MCP SDK；
- 已完成：stdio、Core auth、live discovery；
- 已完成：Resource/error/content-minimized log 合同；
- 已完成：Core 幂等、schema identity、Artifact metadata/window 前置合同；
- 已完成：13 项 L1 与 packaged MCP + real Core L2（0 platform action）。

### Checkpoint 4 — Full Capability Parity

- 已完成：当前全部 15 项 direct-ready capability 的强类型 Tools；
- 已完成：单 POST、caller-controlled `clientRequestId`、session binding alias 与异步 Operation 返回；
- 已完成：Tool schema digest、Core capability 与 manifest parity gate；
- 已完成：Core 的 JavaScript/Python SDK capability matrix gate 与 MCP live-catalog gate 形成传递
  一致性；
- 已完成：packaged MCP + real Core L2（0 accepted platform Operation）。

### Checkpoint 5 — Skills + Real AI Canary

- 已完成：使用官方 `$skill-creator` 初始化并校验 Foundation、Bilibili、Xiaohongshu 和最小
  search-then-detail Intent Skills；
- 已完成：Skill manifest、MCP Tool/Capability/Resource parity 与 package SHA-256 门禁；
- 已完成：production MV3 + real Core + packaged stdio MCP 的 B站原生搜索 L3 canary，证据见
  [Checkpoint 5 L3 B站 canary](docs/validation/checkpoint-5-l3-bilibili-canary.md)；
- 已完成：真实 Codex Agent Host + 精确 Skill version/digest + packaged MCP 的 L4 canary，证据见
  [Checkpoint 5 L4 pinned-Skill Agent canary](docs/validation/checkpoint-5-l4-codex-pinned-skill-canary.md)。

### Checkpoint 6 — Developer Readiness & Full Capability Acceptance

- 进行中：B站 10 个 typed Tools 已完成 production MV3 + real Core + packaged MCP 的真实 L3
  矩阵，证据见 [B站 developer-readiness L3 matrix](docs/validation/developer-readiness-bilibili-l3-matrix.md)；
- 待完成：小红书 typed Tools 的真实 L3 矩阵及其 no-refresh、overlay、Network-first 安全边界；
- 待完成：JavaScript/Python SDK、MCP Resources/Tools 与官方 Skills 的开发者文档和可复制验收；
- 待完成：发布 hash、SBOM、兼容性说明与开发者 runbook。

Windows installer、Credential Manager configurator 和普通用户安装向导不属于当前仓库的目标
架构；不得为了它们向 MCP 加入浏览器生命周期、Profile 或 secret 管理。

## 权威架构

- [目标架构](docs/architecture/collector-ai-native-target-architecture.md)
- [一致性审计](docs/architecture/overall-system-consistency-audit.md)
- [整体决策账本](docs/architecture/overall-system-grilling-decision-log.md)

## 贡献与安全

贡献前阅读 [AGENTS.md](AGENTS.md)、[CONTRIBUTING.md](CONTRIBUTING.md) 和
[SECURITY.md](SECURITY.md)。任何真实平台验证都必须通过正式 Core capability 执行，不能把
fixture、fake Gateway 或 synthetic page 当成平台证据。

## License

Apache License 2.0，见 [LICENSE](LICENSE)。
