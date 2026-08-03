# Collector AI-Native 整体架构一致性审计

- 状态：`Complete — target approved; Checkpoint 2 foundation established; no product-level blocker`
- 日期：2026-08-03
- 目标架构批准日期：2026-08-03
- 决策源：[整体系统架构 Grill 决策账本](overall-system-grilling-decision-log.md)
- 现状源：`inteligence-apps@final-prototype:docs/architecture/overall-system-as-is-audit.draft.md`
- 目标架构：[Collector AI-Native 目标架构](collector-ai-native-target-architecture.md)
- 审计范围：Collector 既有 1–178 条决定、当前 Core 源码与公开合同、当前
  `inteligence-apps` 原型、整体系统第 1–40 条决定及 2026-08-03 MCP + Skills 显式纠正。

## 1. 审计结论

整体架构已经具备唯一、内部一致的目标方向，不需要继续追加产品级 Grill：

```text
Collector Core
  -> official versioned API / OpenAPI / Python SDK / JavaScript SDK
  -> thin Collector MCP Server
  -> versioned Skills
  -> Agent / AI-native Application
```

中间不存在 Workflow Engine、Planner、Evidence Workspace、共享 Task/Run/Step 数据库或模型
分析服务。MCP 是 Core 的 AI 协议适配器，Skills 是可读方法知识，Agent/具体应用拥有自己的
目标、推理循环、业务状态和最终产物。

审计发现的未完成项都属于实现缺口，不是需要负责人重新选择的产品方向。最重要的缺口是：

1. Core direct API 尚无可跨 MCP 重启复用的 `clientRequestId` 幂等合同；
2. Core Artifact API 当前偏向完整 capability-bound JSON 读取，尚无统一 metadata/range/chunk
   与 retention/tombstone 合同；
3. Core release/capability catalog 尚未发布 MCP 所需的完整 schema digest、execution-target
   描述和 compatibility feature flags；
4. 当前 Operation state 与目标通用语义词不完全同名，MCP 必须保留原始 `coreState`，不能
   通过重命名隐藏 `stopped`、terminalReason 或部分结果；
5. 新 AI Integration 仓库、MCP、Skills、安装器和 L3/L4 验证尚未创建；
6. Collector Core 当前没有仓库级 Apache-2.0 `LICENSE`，公开发布前必须补齐。

这些缺口已经能够按 Checkpoint 0–6 排序解决，没有新的架构岔路。

## 2. 当前证据快照

### 2.1 Collector Core

```text
repository: D:\AIProject\inteligence
branch: feat/browser-extension-system
observed head: 5948d44 docs(observability): record live canary baseline
workspace version: 0.7.17
production browser mode: user-owned browser
```

本轮只做只读检查，未修改 Core。Core 工作树原有：

```text
M  AGENTS.md
?? .playwright-cli/
```

它们属于用户现有修改/运行材料，没有进入本轮提交。

实际执行结果：

```text
npm run verify:core-boundaries
  collector core import boundaries: ok

npm run verify:core-capability-matrix
  collector core capability matrix: ok (15 direct capabilities)
```

15 项 direct capability 在 Gateway registry、Artifact Reader、OpenAPI request/operation/artifact
schema、JavaScript SDK、Python SDK 和 Extension work catalog 六个表面保持一致：

```text
bilibili.account_inventory
bilibili.account_profile
bilibili.collection_series.detail
bilibili.collection_series.overview
bilibili.danmaku
bilibili.discussion
bilibili.dynamic
bilibili.native_search
bilibili.native_search_batch
bilibili.video_detail
xiaohongshu.account.public_notes.v1
xiaohongshu.note.public_comment_replies.v1
xiaohongshu.note.public_comments.v1
xiaohongshu.note.public_detail.v1
xiaohongshu.search.public_notes.v1
```

Core 已有 MCP 可以直接复用的公开基础：

- `GET /v2/release`；
- `GET /v2/capabilities`；
- `GET /v2/openapi.json`；
- browser binding list；
- `POST /v2/collect`；
- 异步 Operation 查询；
- capability-bound Artifact retrieval；
- `browser-bindings:read`、`collect:execute`、`operations:read`、`artifacts:read` scope；
- Python/JavaScript typed builders、Operation/Artifact/CollectionResult models；
- SDK 的 wait 只查询既有 Operation、不重新提交；
- Core release 边界声明：`user_owned_browser_only`、`arbitraryBrowserControl=not_exposed`、
  `upperApplications=external_projects_only`。

### 2.2 当前上层原型

```text
repository: D:\AIProject\inteligence-apps
branch: main
prototype package: intelligence-collector-knowledge-pack 0.1.0
```

本轮重新验证：

```text
Python: 85 passed
JavaScript: 9 passed
```

这些测试证明旧原型在自身合同下仍完整，不能证明它属于目标产品。原型同时包含
KnowledgePack、B站 workflow builders、Task API、ASGI server、Python/JavaScript task
clients、Analysis API、DeepSeek consumer 和分析 clients；这正是需要冻结而不是继续抽象的
历史结构。

## 3. 决策优先级

审计按以下顺序解决文档年代与实现差异：

```text
负责人最新显式 MCP + Skills 纠正
  > 整体系统较晚的 11–40 条已采纳决定
  > 整体系统未被覆盖的 1–10 条原则
  > Collector 第 171–178 条 user-owned-browser 决定
  > Collector 第 1–170 条中仍适用于安全/采集事实的决定
  > 较早产品规格和 ADR
  > 当前 POC/原型代码
```

因此，“当前有代码”不能覆盖后续架构决定；“早期 ADR 标为 Accepted”也不能覆盖较晚的
user-owned-browser 或 MCP + Skills 纠正。

## 4. 与 Collector 既有决定的一致性

| 主题 | Collector 既有边界 | AI-Native 目标 | 审计结果 |
| --- | --- | --- | --- |
| 正式浏览器 | 第 171 条：用户日常浏览器，Core 不管理 Profile | MCP 只调用 Core binding/capability | 一致 |
| Browser Host | 第 171 条后只用于 test/isolated lane | MCP 不接触 Browser Host | 一致 |
| 任意控制 | 禁止 URL/selector/script/tab/CDP/任意 Network | 强类型 capability Tool，无浏览器原语 | 一致 |
| 数据真相 | raw-first artifact，失败和 coverage 可见 | metadata-first、有界 raw Resource | 一致 |
| 平台动作 | at-most-once，未知结果不自动重放 | Tool 提交一次并立即返回 Operation | 一致 |
| 用户选定页 | 短时、显式 lease；不暴露 tab ID | capability 固定语义 execution target | 一致 |
| 账号安全 | 验证码/风控/限流/登录/未知结果显式停止 | MCP 原样保留 Core terminalReason | 一致 |
| 第三方爬虫 | 只作调研，不复制/集成/运行 | MCP/Skills 只消费官方 Core | 一致 |
| DeepResearch | 外部消费者，不拥有浏览器/凭据 | Agent/应用外置；MCP 无模型 | 一致 |
| 蜂群 | 上层协调，不争抢同一浏览器动作 | Agent runtime 协调；MCP/Core 幂等与并发 | 一致 |
| 测试 | 纯逻辑可单测；真实进程/浏览器/平台分层 | L1–L4，L3/L4 才证明平台/Agent 闭环 | 一致 |
| 仓库边界 | 上层应用必须是外部项目 | AI Integration 独立开源仓库 | 一致 |

## 5. 已解决的历史冲突

### 5.1 BrowserWing/Profile 旧路线

`data-source-layer.md` 中 BrowserWing、人工持久 Profile 和传统 Intelligence Gateway 属于早期
研究。Collector 第 171 条和当前 Core release 已将正式模式固定为 user-owned browser。
MCP 只能使用 `browserBindingId` 和公开 Core API，不能复活旧 Profile 路线。

### 5.2 Browser Host 页面池

`managed-page-pool-browser-host-mvp.md` 明确只适用于 test/isolated-account lane。AI
Integration 不导入、不启动、不配置 Browser Host；L3/L4 可以使用 Core 自己的验证通道，
但测试基础设施不会成为 MCP 生产依赖。

### 5.3 历史 DeepResearch Gateway

`deepresearch-gateway-adapter.md` 曾提出框架工具层，但 Core README 已将其标为历史 POC。
新 MCP 不从该包迁移、不保留默认搜索框架适配、不嵌入 DeerFlow/DeepSeek，也不通过旧
`gateway_*` workflow 工具名延续历史合同。

### 5.4 Evidence Workspace/Workflow 误抽象

整体系统第 3、6、7 条曾短暂采纳中央 Evidence Workspace 与 Workspace/Task/Run/Step。
2026-08-03 显式纠正已经覆盖它们：

- MCP 无 Task/Workflow 数据库；
- Skills 不保存运行状态；
- Agent/应用自己拥有项目和计划；
- Core Operation/raw Artifact 是共享采集事实；
- Resource/Evidence/Package 只是消费者可选输出。

目标架构没有通过“Session Budget”“Compatibility Manifest”或“Intent Skill”暗中恢复
Workflow。MCP session 只保存短时协议、安全计数和 cursor；它不理解研究任务。

### 5.5 EvidencePackage 与 CollectionGapRequest

Collector 旧规格中的 EvidencePackage/CollectionGapRequest 可以作为某个 Skill 或应用的输出
惯例继续参考，但不进入 MCP 强制合同。Agent 可以在自己的项目中提出补采理由，真正的下一次
平台动作仍是一个新的强类型 Tool 调用并由当前授权包络/Core 门禁决定。

## 6. 当前实现与目标架构的差距

| 差距 | 当前事实 | 目标处置 | Checkpoint |
| --- | --- | --- | --- |
| 新仓库基础 | clean sibling repo、治理文件、manifest/schema、测试骨架已建立 | 不复制旧运行时；进入 thin MCP Foundation | 2 complete / 3 |
| MCP 不存在 | Core 只有 API/SDK | 建立 stdio thin adapter | 3 |
| Skill manifest | 已建立 schema，但 official Skills 清单为空 | Checkpoint 5 才发布三层 Skills | 2 complete / 5 |
| `clientRequestId` | direct `/v2/collect` 未发现公共幂等字段 | Core 合同增加稳定 request identity；MCP 不自建持久 workflow DB | Core prerequisite / 3 |
| Tool schema digest | OpenAPI/SDK parity 已有，digest/feature manifest 不完整 | 从 Core 发布机器可读 schema identity | Core prerequisite / 3 |
| execution-target descriptor | capability catalog 有 input/capture/dispatch，目标语义分散 | Core/OpenAPI 明确每 capability 的安全 execution target | Core prerequisite / 3 |
| Artifact metadata/chunk | SDK 当前读取完整 capability-bound JSON | 增加 metadata-first 与有界 text/JSON/binary read 合同 | Core prerequisite / 3 |
| Artifact retention | 未发现统一 retainedUntil/deletionState/tombstone 公共字段 | 生命周期仍归 Core；MCP MVP 只读 | Core prerequisite / 3 |
| Operation 通用状态词 | 当前主要为 queued/claimed/completed/partial/stopped/failed | MCP 必须返回 exact `coreState`；可另加非替代性的 status class | 3 |
| MCP client scope | Core scopes 已有，但默认集合含旧 `profiles:read` | 安装器签发明确最小 user-browser scopes | 3/6 |
| OS credential integration | 目前主要靠 token/env/runbook | Windows 安装配置器接入 OS protection | 6 |
| Core LICENSE | 根目录没有 LICENSE | 公开发布前加入 Apache-2.0 和依赖/SBOM | Core release prerequisite |
| apps 原型冻结 | README 已标记 archive，最终状态由 `final-prototype` tag 固化 | 只保留历史证据；新产品无运行时依赖 | 1 complete |

### 6.1 Operation state 的审计修正

第 38 条列出的 `accepted/running/blocked/cancelled/outcome_unknown` 是目标语义类别，而当前 Core
公开状态主要是：

```text
queued / claimed / completed / partial / stopped / failed
```

MCP 不得为了匹配新词而覆盖 Core 状态。目标合同应同时包含：

```text
coreState          exact Core value
terminalReason     exact Core value
errorCode          exact safe Core value
statusClass?       optional stable derived class for Agent convenience
```

`statusClass` 如果存在，只能由版本化映射生成，且不能删除原始值。这属于合同实现细化，不是
新的产品选择。

### 6.2 `clientRequestId` 的所有权

MCP 被定义为可重启的薄进程，不能依赖自己的中央持久数据库保证跨 session 幂等。因此真正的
有副作用请求幂等 identity 必须由 Core direct API 接受和持久化，或者由 Core 发布等价的一次
提交合同。MCP 只验证格式、canonical payload 和冲突，并把 identity 传给 Core。

这是一项必要的 Core 基础合同增强，但不扩大浏览器能力，也不增加平台动作。

## 7. 新仓库的反回归架构门禁

新 AI Integration 仓库从 Checkpoint 2 起应自动拒绝：

- 对 `inteligence-apps` 的相对 import、HTTP 43128 依赖或 runtime fallback；
- Workflow/Planner/Workspace/Task/Run service/database 依赖；
- DeepSeek、DeerFlow 或任意模型 provider 的运行时依赖；
- Playwright、Chrome DevTools、CDP、browser Profile 或 Native Messaging 控制依赖；
- arbitrary URL/selector/script/tab/network Tool；
- 不存在于 Core direct-ready matrix 的隐藏 Tool；
- MCP/SDK/Core capability set 漂移；
- Tool result、Resource、日志中的 secret 或未界定正文；
- fake Gateway/fake page 作为 L3/L4 平台证明；
- MCP 重启后重新提交未知 Operation；
- Skill 在 session 中途无版本换代地热更新。

## 8. 不需要继续 Grill 的技术选择

以下选择在对应 checkpoint 通过小型技术调研和实测决定即可，不改变产品架构：

- MCP Server 使用 TypeScript 还是 Python；
- 具体 MCP SDK/framework；
- executable 打包工具；
- 首个正式适配的 Agent host；
- JSON chunk 与 JSON Pointer 的具体分页参数名；
- Windows Credential Manager 与 DPAPI 包装库；
- 日志轮转库；
- CI provider；
- 首次 release 的品牌名和图标。

这些技术选择必须满足已冻结合同，不应再演变成新的产品层。

## 9. 最终判断

整体系统已经从错误的“Collector -> Evidence Workflow Platform -> Analysis”路线，收敛为：

```text
Collector Core as the safe collection truth
  + thin MCP as the AI protocol adapter
  + versioned Skills as method knowledge
  + consumer-owned Agent state and outputs
```

该方向与当前 Core 的真实能力、user-owned-browser 产品边界、raw-first 原则、SDK parity、
账号安全和真实验证规范一致。没有需要继续向负责人追问的阻塞性架构问题。

目标架构已经获得负责人批准，Checkpoint 0–2 已按顺序完成。下一步进入 Core 前置合同与
thin MCP Foundation；不从旧原型复制运行时，也不把 MCP 扩张成 Workflow 产品。
