# Collector AI-Native 目标架构

- 版本：`v1 approved`
- 状态：`Approved — Architecture Freeze complete`
- 日期：2026-08-03
- 批准日期：2026-08-03
- 决策源：[整体系统架构 Grill 决策账本](overall-system-grilling-decision-log.md)
- 一致性审计：[整体架构一致性审计](overall-system-consistency-audit.md)
- 文档位置：自 Checkpoint 2 起由 `collector-ai-integration` 仓库维护唯一权威副本。

## 1. 一句话结论

本项目的长期架构不是“浏览器采集 + Workflow 平台 + AI 分析服务”，而是：

> Collector Core 作为安全、稳定、raw-first 的浏览器采集真相；thin MCP Server 把已登记
> capability 转换成 AI 可发现的强类型 Tools 与有界 Resources；版本化 Skills 教 Agent
> 如何使用这些工具；Agent 和具体应用自己拥有任务、推理、上下文和最终产物。

```text
Agent / AI-native Application
  ├─ consumer-owned goal, reasoning, state and output
  ├─ versioned Skills
  └─ MCP Client
       |
       v
Thin Collector MCP Server
  ├─ typed capability Tools
  ├─ Operation Resources
  ├─ bounded Artifact Resources
  ├─ compatibility / auth / budgets / logs
  └─ no workflow, planner, model or browser control
       |
       v
Collector Core API / SDK
  ├─ release / capabilities / OpenAPI
  ├─ browser bindings when a capability requires them
  ├─ Browser Provider (paired MV3 extension)
  ├─ Official Provider (allowlisted Gateway source adapters)
  ├─ async operations
  ├─ raw artifacts
  ├─ safety / scopes / audit
  └─ Python + JavaScript SDK
       |
       v
Provider execution: paired MV3 Extension in the user's daily Chrome/Edge or Gateway-only Official Provider
```

## 2. 北极星与非目标

北极星是**按需公共信息采集基础设施**：当人或 AI 需要某个平台上的公开信息时，系统可以
在用户日常浏览器的正常登录上下文中，通过已登记、低频、只读、可审计的能力获取 raw-first
产物，再交给上层自由分析。

北极星不是：

- 通用浏览器自动化或任意网页 Agent；
- 私有 API 模拟器或传统爬虫集合；
- 中央 Workflow/Planner；
- 内置 DeepResearch 或模型分析服务；
- 统一知识库、向量数据库或预先全量入库；
- 远程控制用户浏览器的云服务。

## 3. 产品地图

### 3.1 Collector Core

Collector Core 是可独立成功、安装、发布和开源的产品，负责：

```text
production MV3 extension
loopback Local Collector Gateway
allowlisted Official Provider adapters
user-owned-browser pairing and binding
registered capability registry
input validation and hard budgets
operation / raw artifact / audit
account safety and at-most-once
OpenAPI / release manifest
Python SDK / JavaScript SDK
test/isolated-account verification lane
```

Core 不负责 Agent prompts/memory、MCP sessions、Skills、研究规划、KnowledgePack、报告、
DeepResearch、模型密钥、业务 UI 或项目数据库。

### 3.2 Collector AI Integration

Collector AI Integration 是独立开源产品，负责：

```text
thin stdio MCP Server
optional authenticated loopback MCP transport later
Core compatibility negotiation
typed capability Tool catalog
Operation and bounded Artifact Resources
client/session safety ceilings
clientRequestId handling
content-minimized observability
Foundation / Platform / Intent Skills
AI-native examples and L1-L4 verification
Windows install/configure/uninstall
```

它不得拥有 Workflow Engine、Planner、Workspace/Task/Run/Step service、中央 Artifact 数据库、
浏览器/Profile 生命周期、Playwright/CDP runtime control、任意浏览器 Tool、模型 provider、
KnowledgePack server 或 Analysis server。

### 3.3 Agent 与具体应用

Agent、DeepResearch、桌面研究应用和行业应用负责：

- 用户目标、项目与研究计划；
- 多 Agent 分工；
- 上下文压缩和 working notes；
- Resource/Evidence 等可选业务投影；
- KnowledgePack/EvidencePackage 等可选交付物；
- 模型选择、密钥、prompt、成本、引用、报告、UI 和业务权限。

它们不能绕过 MCP/Core 获取浏览器、Cookie、tab、selector 或任意 Network 能力。

## 4. Git 与发布边界

```text
D:\AIProject\inteligence
  Collector Core
  future public repository: Apache-2.0

D:\AIProject\collector-ai-integration   # 架构批准后创建
  SourceRelay AgentKit: MCP Server / Skills / examples / tests
  future public repository: Apache-2.0

D:\AIProject\inteligence-apps
  current prototype/history
  frozen at final-prototype tag
  never a runtime dependency of the new product

other application repositories
  independent licenses and release cycles
```

仓库之间只允许版本化 API、SDK、MCP 和 Skill compatibility 合同。禁止相对 import、源码
路径依赖、submodule 运行时耦合、HTTP fallback 和双写。

## 5. Windows 正式运行拓扑

```text
Windows current user session
  |
  +-- Chrome/Edge used normally by the user
  |     +-- installed and paired Collector MV3
  |     +-- user's own login sessions
  |     +-- extension-owned work tabs
  |     +-- optional user-selected short tab lease
  |
  +-- Collector Core Gateway
  |     +-- current-user singleton
  |     +-- optional login autostart
  |     +-- 127.0.0.1 only
  |     +-- persistent bindings / operations / artifacts / audit
  |
  +-- Agent Host
        +-- starts one stdio MCP process per session
        +-- loads pinned official/approved Skills
        +-- owns conversation and application state
```

Core Gateway 不启动、关闭或附着日常浏览器。MCP runtime 不启动、关闭或重启 Core/浏览器。
AgentKit 的独立 `collector-agent` launcher 只做本机 bootstrap：读取用户凭据、探测 loopback
Gateway，并可在用户明确配置已发布 Core entrypoint 时启动一个缺失的 Gateway；它不导入 Core
源码、不创建 Profile，也不在 MCP session 结束时关闭 Gateway。Agent session 结束只结束自己的
MCP process，不影响 binding、Operation 或 Artifact。

## 6. 信任边界

| 边界 | 可信内容 | 不可信或不授予的内容 |
| --- | --- | --- |
| 浏览器页面 | 当前获准页面正常呈现的信息 | 页面脚本、隐藏状态、任意 response、认证材料 |
| Extension | 已构建平台注册策略与白名单投影 | 任意 runtime script、模型生成 selector |
| Core | capability、Operation、Artifact、安全终态 | 上层 prompt、报告、模型决定 |
| MCP | Core 合同映射、auth、budget、Resource window | 浏览器控制、业务 workflow、模型 key |
| Skill | 已验证方法和 Tool 使用知识 | 额外权限、运行状态、自动安装代码 |
| Agent | 目标、推理和消费者输出 | Core token、Cookie、Profile、tab identity |

下层永远不因上层更智能而扩大权限。Skill 指令不能覆盖 MCP/Core 的机器门禁。

## 7. Core 公共合同是唯一来源真相

AI Integration 只依赖：

```text
GET /v2/release
GET /v2/capabilities
GET /v2/openapi.json
browser binding API
POST /v2/collect
operation read API
artifact read API
released Python or JavaScript SDK
```

Core release/capability/OpenAPI 必须共同给出 release/service schema、direct-ready capability、
强类型 input/output schema、dispatch/maturity/availability、允许的 execution target、hard
budgets、schema digest、兼容 feature 和 Artifact read contract。

MCP 不从 Core 源码、README、历史 canary 或第三方项目推断能力。

## 8. MCP Tool 表面

### 8.1 一 capability 一强类型 Tool

当前 Core 的全部 direct-ready capability 必须与 MCP Tool catalog 保持 parity。Tool ID 的
具体命名在 contract checkpoint 固化，但必须满足：

- toolId 稳定；
- input schema 来自 Core；
- 不接受额外字段；
- 不以任意 `capability + JSON` 万能 Tool 作为主要 AI 表面；
- 不接受 URL/selector/script/coordinate/tab/network primitive；
- Tool catalog 与 Core/双 SDK 自动 parity。

### 8.2 提交 Tool 的统一异步返回

```text
Tool call with stable clientRequestId
  -> submit exactly one Core request
  -> return operationId immediately
  -> never wait for full page completion inside the Tool call
```

Tool 返回 Operation Resource URI；Agent 后续只读查询，不在 Tool timeout、MCP 重启或 Agent
重连时重复提交。

### 8.3 Execution target

execution target 是 capability 合同，不是浏览器控制参数：

- work-tab-only：Tool 不暴露参数；
- user-selected-only：需要当前用户显式短 lease；
- 两者安全支持：只允许固定枚举；
- 从不暴露 tab/window ID 或普通标签页列表。

## 9. MCP Resource 表面

```text
collector://release
collector://capabilities
collector://bindings
collector://operations/{operationId}
collector://artifacts/{artifactId}
collector://artifacts/{artifactId}/chunks/{cursor}
```

### 9.1 Operation Resource

必须保留 exact Core facts：

```text
operationId / capabilityId
coreState / terminalReason / errorCode
platformActionAttempted
createdAt / updatedAt / completedAt
artifact references
partial/truncation/coverage
safe retry/next-action classification
```

MCP 可增加版本化 `statusClass` 方便 Agent，但不能删除或重写 `coreState`。`no_results`、登录、
验证码、限流、partial 和 outcome unknown 不能合并成 no data。

### 9.2 Artifact Resource

第一次读取 metadata：

```text
artifactId / operationId / capabilityId
schemaVersion / mediaType / byteLength
sha256 / capturedAt / terminalStatus
availableRepresentations
retentionClass / retainedUntil / deletionState / available
```

正文按需读取：

- UTF-8 byte/line window；
- JSON/JSONL bounded records or JSON Pointer；
- HTML/Markdown text window；
- binary metadata first, explicitly bounded bytes only；
- 每个 chunk 带 hash、range、cursor 和 truncation。

禁止绝对路径、路径穿越、任意本地文件和自动 LLM 摘要。

## 10. Skills 架构

### 10.1 三层组合

```text
Foundation
  Core capability discovery
  Operation/Artifact reading
  safety/failure interpretation

Platform
  Bilibili
  Xiaohongshu
  Zhihu Official Provider
  future platforms after real capability admission

Intent
  search then detail
  account research
  discussion research
  cross-platform research
```

Skill 只描述方法、条件、失败解读、停止和示例，不执行 Tool、不保存运行状态、不获得 secret。

### 10.2 Trust 与版本

每个 Skill 必须有 publisher、source、version、digest、required tools/resources、外部影响声明、
compatibility 和 license。官方 Skill 随 AI Integration release；第三方 Skill 只能显式安装。

Agent session 固定 Skill digest。更新 staging、校验、测试、显式激活，只影响新 session；保留
最近已验证版本回滚。

## 11. State 与数据所有权

| 数据 | 唯一所有者 | MCP 行为 |
| --- | --- | --- |
| browser binding | Core | 只读安全摘要 |
| capability truth | Core | 发现并映射 Tool |
| Operation | Core | 立即返回 ID、只读状态 |
| raw Artifact | Core | metadata-first 有界读取 |
| retention/deletion | Core | 只读；MVP 无删除 Tool |
| MCP session/cursor/budget | MCP 进程 | 短时，退出即失效 |
| Agent plan/conversation | Agent/应用 | MCP 不保存 |
| working notes/summary | Agent/应用 | 保留 provenance 后可选生成 |
| Resource/Evidence/Package/report | Agent/应用 | 可选，不是共享强制模型 |
| model API key | Agent/应用 | Core/MCP 不读取 |

MCP 不是第二个 Artifact Store，也不是 Workspace Service。

## 12. Idempotency 与多 Agent

每个有副作用 Tool 调用携带稳定 `clientRequestId`：

```text
same request ID + same canonical payload -> same Core Operation
same request ID + different payload -> idempotency conflict
```

由于 MCP 是短进程，跨 session 幂等必须落在 Core direct API 或 Core 发布的等价一次提交合同，
不能靠 MCP 内存或中央 Workflow DB。

Agent runtime 自己协调蜂群。Core/MCP 只执行 client/session 调用上限、Artifact 读取字节上限、
per-binding/platform action concurrency、at-most-once/account safety，以及不同平台/安全 binding/
纯读取的允许并行。MCP 不创建 subagent、不做 planner、不拆研究任务。

## 13. 认证与 Secret

默认 stdio MCP 由 Agent host 启动。正常安装通过 AgentKit 的一次性 `collector-agent setup`
将最小 Core token 保存到当前用户受限配置；CI/L2 仍可通过进程环境显式注入。Agent 看不到
token。这个 launcher/configurer 属于 AgentKit 安装入口，不属于 MCP Tool、Skill 或 Core 业务
合同。

MCP 所需 Core scopes 默认只包含：

```text
browser-bindings:read
collect:execute
operations:read
artifacts:read
```

不得默认获得旧 `profiles:read`。可选 loopback MCP 使用独立 client credential，不复用 Core
token，只监听 `127.0.0.1`，不支持 LAN/Internet。

Secret 不进入 Tool、Resource、Skill、日志、诊断或报告。MCP 不读取模型 key、Cookie、
Storage、密码、Profile 或代理凭据。

## 14. 可观察性

结构化日志关联：

```text
mcpSessionId / client alias
toolCallId / clientRequestId
toolId / schema digest
coreOperationId / capabilityId
safe binding alias
state / duration / budgets
artifactId / mediaType / bytes / sha256
errorCode / terminalReason / retryClass
```

默认不保存 prompt、查询词、完整 URL、Tool 正文、Artifact 正文、模型回答、账号档案正文、
公开联系方式或任何 secret。日志只在本地轮转，远程 telemetry 默认关闭。

## 15. Compatibility

MCP manifest：

```text
mcpProtocolVersion
toolCatalogVersion
supportedCoreApiSchemaRange
supportedCoreReleaseRange
requiredCoreFeatures
toolSchemaDigests
```

Skill manifest：

```text
skillId / skillVersion
requiredMcpTools / requiredCapabilityIds
minimumOutputSchemas
acceptedCapabilityMaturity
optionalCapabilities
testedCompatibility
```

无法满足时在平台动作前返回 `compatibility_unmet`。不由 LLM 猜字段或下载兼容代码。

## 16. SDK 与 MCP 共存

Python/JavaScript SDK 面向确定性应用；MCP/Skills 面向 AI Agent。三者共享 Core 合同和
capability matrix gate。SDK 不通过 MCP；MCP 可以使用 release SDK，但不得导入 Core 源码。

```text
Core OpenAPI/capabilities
  == Python SDK surface
  == JavaScript SDK surface
  == MCP typed Tool catalog
```

任何新 capability 先进入 Core 并完成真实验证、OpenAPI/SDK parity，再进入 MCP 候选表面。

## 17. 测试与真实验证

```text
L1 pure unit
  schema / compatibility / URI / ranges / redaction / idempotency / Skill metadata

L2 real local processes
  packaged MCP + released Core + real transport/auth/resource mapping
  zero platform requests allowed; no platform claim

L3 real platform/provider
  production MV3 or Official Provider + real Core + real MCP + real client harness
  Tool -> Operation -> Artifact metadata/chunk

L4 pinned-Skill Agent canary
  real Agent runtime discovers capability, invokes Tool,
  interprets terminal state, reads bounded raw and keeps provenance
```

远程 CI 运行 build/L1/L2 可行部分；L3/L4 仅在用户控制本机低频运行。Fake Gateway/page/XHR
不能证明平台或 Agent 闭环。除扫码、密码、验证码外，验证全流程自动化。

## 18. 安装、升级和进程

- Core installer：Gateway/launcher、稳定 MV3 目录、配对与 scoped credentials；
- AI Integration installer/configurer：MCP、Skills、compatibility、Agent host config、本机
  credential store 与无密钥 launcher；
- Core：当前用户单实例、可选登录自启、独立长期运行；
- MCP：Agent session stdio 子进程；
- browser：始终由用户自己运行；
- Agent：拥有自己的 session 和应用状态。

用户一次可见安装/配对后，不手工复制 token、不提供 Profile、不启动 testbench。

Windows 11 + Chrome/Edge 首发。OS adapter 隔离路径、secret、launcher、process probe 和
packaging。macOS/Linux 完成自己的真实闭环后才进入支持矩阵。

## 19. 开源边界

Collector Core 与 SourceRelay AgentKit 分别使用 Apache-2.0 独立开源。各自包含
LICENSE、SECURITY、CONTRIBUTING、SBOM/依赖许可证、release hash、边界和非目标。

具体应用、Analyzer、DeepResearch、prompt 和模型业务可开源、闭源或商业化。第三方 Skill
保留自己的来源与许可证，不因安装而变成官方 Skill。

## 20. AI Integration MVP

### 20.1 必须交付

1. Windows stdio MCP Server；
2. Core release/capability/binding compatibility preflight；
3. 当前全部 18 项 direct-ready capability 的 Tool catalog parity（15 Browser Provider + 3 Official Provider）；
4. 强类型 capability Tools；
5. Operation Resources；
6. Artifact metadata 与 bounded UTF-8/JSON Resources；
7. Core-backed clientRequestId 幂等；
8. 最小 Core credential；
9. 内容最小化结构日志；
10. Foundation Skills；
11. Bilibili Platform Skill；
12. Xiaohongshu Platform Skill；
13. Zhihu Official Provider Platform Skill；
14. 一个 search-then-detail Intent Skill；
15. 一个 Agent host 配置入口；
16. L1/L2 gates；
17. 至少一个 B站真实 L3 canary；
18. 至少一个 pinned-Skill L4 Agent canary。

### 20.2 明确不做

- shared loopback MCP、macOS/Linux、Skill market/auto update；
- Workflow/Planner/Task API、KnowledgePack/Analysis Service；
- DeepSeek/DeepResearch、UI、vector database、持续监控；
- 任意浏览器 Tool；
- 每个 capability 重复实网 canary。

## 21. 迁移 Checkpoints

### Checkpoint 0 — Architecture Freeze

- 状态：`Completed — 2026-08-03`；
- 完成第 1–40 条、覆盖审计和本文件；
- 项目负责人批准；
- docs only。

### Checkpoint 1 — Prototype Freeze

- 状态：`Completed — 2026-08-03`；
- `inteligence-apps` README 标记 prototype/archive；
- 创建 `final-prototype` tag；
- 停止功能提交；
- 保留测试与真实 canary。

### Checkpoint 2 — New Repository Foundation

- 状态：`Completed — 2026-08-03`；
- 创建 sibling `collector-ai-integration`；
- Apache-2.0、AGENTS、README、SECURITY、CONTRIBUTING；
- 决策账本只迁移一次；
- package/manifest/test skeleton；
- no MCP Tool yet。

### Checkpoint 3 — MCP Foundation

- 状态：`Completed — 2026-08-03`；
- stdio、Core auth、live discovery；
- read-only Resource/error/content-minimized log contracts，平台 Tools 仍为 0；
- Core prerequisites：idempotency、schema identity、Artifact metadata/window；
- 13 项 L1 + packaged MCP / real Core L2，0 platform Operation。

### Checkpoint 4 — Full Capability Parity

- 状态：`Completed — 2026-08-03`；
- 全部 direct-ready Tool；
- Operation/Artifact Resources；
- schema digest；
- Core/SDK/MCP parity gate。

### Checkpoint 5 — Skills + Real AI Canary

- 状态：`Completed — 2026-08-03`；
- 已实现并 L1 固定 Foundation/Bilibili/Xiaohongshu/Zhihu/Intent Skills；
- 已完成 production MV3 + real Core + packaged MCP 的 B站原生搜索 L3 canary；
- 已完成 real Codex Agent Host + exact pinned Skill snapshot + packaged MCP 的 L4 canary。

### Checkpoint 6 — Developer Readiness & Full Capability Acceptance

- 状态：`Completed — 2026-08-05`；
- B站全部 10 个 typed Tools 已完成 packaged MCP → real Core → production MV3 → real platform
  的真实 L3 验收；
- 小红书 5 个 typed Tools 的真实 L3 矩阵已经完成；
- 18 项 Core catalog、MCP Tools、双 SDK 与官方 Skills 的 parity 已完成；
- 知乎 Official Provider 三项 MCP 真实 L3 矩阵已完成，见
  `docs/validation/developer-readiness-zhihu-l3-matrix.md`；不改变运行时能力边界；
- 2026-08-07 readiness follow-up：`credential_required` 在 MCP Tool POST 前 fail-closed，
  `ready` 路径已用当前 Gateway 完成一次有界只读 canary；配置动作仍只属于 Gateway，不进入
  Agent、Skill 或 SDK。
- 发布材料已收口：Core `0.7.17` 正式 archive hash、SBOM/checksum 验证与 AgentKit developer
  runbook 均已登记；AgentKit 已提供一次 setup/status/无密钥 MCP launcher/Codex 注册入口。
  完整 Windows installer、DPAPI/Credential Manager 原生适配和普通用户 GUI 向导仍属于后续
  安装器工作，不进入 thin MCP 或 Core 采集合同。

不提供旧 Task/Analysis API 兼容、43128 forwarding、dual-write、fallback 或旧仓库 runtime
dependency。

## 22. Stop-Doing List

从目标架构批准起，停止：

- 向 `inteligence-apps` 增加功能；
- 将 KnowledgePack/Task/Analysis 抽象成平台服务；
- 在 Core 中增加 DeepResearch 或 MCP workflow；
- 为一个 Agent 场景新增 Core 便捷业务 API；
- 逐 capability 手工维护脱离 Core catalog 的 MCP Tool；
- 让 Skills 宣称 runtime capability；
- 让 MCP 保存项目、prompt、报告或 Artifact 副本；
- 让 MCP 启停浏览器或 Core；
- 通过 fake page/Gateway 证明平台能力；
- 在架构批准前创建新仓库或复制旧代码；
- 为旧 apps API 付出兼容成本。

## 23. 目标验收标准

1. Core 可以在没有 MCP/Agent 时独立使用；
2. MCP 可以删除并重装，不影响 Core binding/Operation/Artifact；
3. Agent 看不到 Core token、浏览器 Profile、Cookie 或 tab identity；
4. MCP catalog 与 Core/双 SDK direct capability 完全一致；
5. Tool 提交一次并立即返回可恢复的 Operation ID；
6. MCP/Agent 重启不会重放平台动作；
7. Artifact 可 metadata-first、按需窗口、带 hash 读取；
8. Skills 可更新/回滚且 session 固定版本；
9. 多 Agent 不突破 Core binding/platform 动作上限；
10. 日志能关联 Tool→Operation→Artifact，但不包含 prompt/正文/secret；
11. 至少一条 production MV3 + Core + MCP + pinned Skill + Agent 真实闭环通过；
12. 新仓库不依赖旧 apps、Workflow、模型 provider 或浏览器控制库；
13. 上层开发者可通过发布的双 SDK 或 packaged stdio MCP 使用 Core，不依赖 testbench、任意
    浏览器控制接口或调用方管理的 Profile；
14. Core 与 AI Integration 分别具备可发布的 Apache-2.0 开源材料。

## 24. 批准门禁（已通过）

项目负责人已于 2026-08-03 批准本文件，Checkpoint 0 已完成。批准前的门禁是：

- 不创建 `collector-ai-integration`；
- 不冻结/tag `inteligence-apps`；
- 不修改 Core contract；
- 不选择 MCP framework；
- 不实现任何 Tool/Skill/installer。

批准后已经严格完成 Checkpoint 1，没有跳过原型冻结，也没有把旧代码先搬入新仓库。
Checkpoint 2–5 已依次完成 repository foundation、thin MCP、typed capability parity、官方
Skills，以及真实 L3/L4 canary；Checkpoint 6 已按项目负责人决定收敛为 Developer Readiness
& Full Capability Acceptance，不再建设 Windows installer/configurator。
