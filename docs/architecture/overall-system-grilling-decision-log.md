# 整体系统架构 Grill 决策账本

- 状态：`Complete through decision 40 — target approved; Checkpoints 0–2 complete`
- 创建日期：2026-08-03
- 目标架构批准日期：2026-08-03
- 内容权威性：本文中的“已采纳决定”是整体系统架构的新决策源；尚未回答的问题不构成决定。
- 路径状态：自 Checkpoint 2 起由 `collector-ai-integration` 仓库维护唯一权威副本；旧原型路径只保留迁移指针。
- 现状审计：`inteligence-apps@final-prototype:docs/architecture/overall-system-as-is-audit.draft.md`
- 一致性审计：[Collector AI-Native 整体架构一致性审计](overall-system-consistency-audit.md)
- 目标架构：[Collector AI-Native 目标架构](collector-ai-native-target-architecture.md)
- Collector 既有决定：`D:\AIProject\inteligence\docs\design\collector-grilling-decision-log.md`

## 1. 适用范围与决策优先级

本账本只决定 Collector Core 之上的整体产品生态，包括产品地图、仓库、MCP/Skills AI
集成、API、扩展点、部署、开源和迁移边界。用户已明确拒绝建设通用 Workflow/Planner
层；应用自己的任务、项目和报告模型不属于共享基础设施的预设领域。

它不重问 Collector 已经完成的浏览器、标签页、Profile、DOM/XHR、平台动作、账号安全、
capability 和真实验证细节。整体架构必须兼容 Collector 第 1–178 条既有决定；若未来确实
出现冲突，使用以下优先级处理：

```text
用户对具体整体架构问题的显式自定义
  > 本账本较晚的已采纳决定
  > 本账本较早的已采纳决定
  > Collector 文档中关于上层应用的旧推测
  > 当前 inteligence-apps 原型实现
```

Collector 内部已经确认的安全和生产边界，不会因为上层架构决定而被默认放宽。

## 2. 已采纳决策总览

| 批次 | 主题 | 采纳结果 |
| --- | --- | --- |
| 1–5 | 北极星、Core 身份、证据编排、AI 边界、Git 拓扑 | 全部采纳推荐方案 A |
| 6–10 | 工作区层级、Core Operation 映射、证据对象、交付包、不可变真相 | 全部采纳推荐方案 A |
| 2026-08-03 显式纠正 | 取消 Workflow/Planner/Evidence Workspace 平台，改为 MCP + Skills | 用户自定义决定；覆盖第 3、6、7 条并收窄第 5、8–10 条 |
| 11–15（修订批次） | MCP 归属、Tool/Resource、Skills、状态所有权、自主调用安全 | 全部采纳推荐方案 A |
| 16–20 | 能力真相、版本兼容、Artifact 读取、上下文来源、多 Agent 并发 | 全部采纳推荐方案 A |
| 21–25 | Skill 信任与更新、MCP secret、日志、分层真实验证 | 全部采纳推荐方案 A |
| 26–30 | 安装、进程、transport、操作系统、开源与许可证 | 全部采纳推荐方案 A |
| 31–35 | 原型归档、选择性迁移、MVP、新仓库、零兼容 checkpoint | 全部采纳推荐方案 A |
| 36–40 | 异步 Tool、execution target、终态、Artifact 生命周期、SDK 共存 | 全部采纳推荐方案 A |

## 后续显式架构纠正：采用 MCP + Skills，而不是 Workflow 平台

2026-08-03，项目负责人明确否决建设 WorkflowDefinition、Planner、Workspace/Task/Run/Step
编排平台，并指定未来使用更符合 AI-native 特征的 MCP + Skills。

该纠正不是对 Workflow 实现方式的小调整，而是删除整层产品：

```text
错误方向
  Apps -> Workflow/Planner/Evidence Workspace -> Core

当前方向
  Agent / AI-native App
    ├─ Skills：场景知识、研究方法、工具选择、迭代判断
    └─ MCP Client
          -> thin Collector MCP Server
               -> versioned Core API / SDK
                    -> Gateway / Extension / Browser
```

权威职责改为：

- Collector Core 保持 capability、browser binding、operation、raw artifact、安全和审计真相；
- MCP 只把 Core 的已登记能力投影成强类型工具和有界资源，不拥有业务工作流；
- Skills 承载“什么时候调用什么、如何观察结果、何时补采或停止”的可读方法；
- Agent 或具体应用拥有自己的临时计划、循环、项目状态和最终产物；
- 不建立共享 Workflow Registry、通用 Planner、中央 Workspace 数据库或 Task/Run/Step 平台；
- 需要传统 API 的非 AI 应用仍可直接使用 Core Python/JavaScript SDK。

覆盖关系：

```text
本纠正覆盖第 3 条的独立证据编排服务
本纠正覆盖第 6 条的共享 Workspace -> Task -> Run -> Step 模型
本纠正覆盖第 7 条的共享 Workflow Step 领域
本纠正将第 5 条中的 Evidence Workspace repo 改为待定的 MCP/Skills 集成边界
本纠正把第 8–10 条从平台强制领域模型收窄为消费者可选输出原则
```

## 批次 1–5：产品地图与仓库边界

### 1. 整个产品生态的北极星

采纳 **A：按需公共信息证据基础设施**。

系统的首要价值是把上层提出的信息需求，通过用户日常浏览器中的已登记采集能力，转化
为本地、raw-first、可追溯、可复用的证据。核心交付是稳定 API、采集结果、来源、覆盖、
状态和证据，而不是把某个 UI、报告格式、模型或 DeepResearch 框架定义为整个系统。

具体个人情报工作台、研究应用、AI 报告、持续监控或垂直场景可以作为独立消费者建设，
但不能反向污染底层的采集与证据合同。系统不转向任意浏览器自动化平台，也不以提前抓取
并囤积全平台数据为北极星。

### 2. Collector Core 的产品身份

采纳 **A：Collector Core 是可独立成功的基础设施产品，也是产品家族中的采集平面**。

Core 可以独立安装、发布、开源、维护和升级。其职责继续限定为：

```text
MV3 Extension
Local Collector Gateway
user-owned-browser binding
registered platform capabilities
operation / raw artifact / audit
versioned OpenAPI / Python SDK / JavaScript SDK
真实验证与 test/isolated-account lane
```

Core 不拥有证据工作区、跨 capability 业务编排、知识包场景、AI 分析、DeepResearch、
业务控制台或最终用户应用。上层缺失或未安装时，Core 仍然是完整、可使用的采集基础服务。

### 3. 知识包编排的长期身份（已被 AI-native 纠正覆盖）

第 3 条最初采纳过“独立证据工作区与采集编排服务”，但 2026-08-03 的显式纠正已经将
该产品层删除。系统不建设跨 capability 的公共 Workflow、Task/Run、Planner、恢复器或
Workspace Catalog。

B站账号、广度、搜索深度、评论、UP 主知识包等流程应当表达为：

- 面向 AI Agent 的版本化 Skills；或
- 某个具体应用自己的逻辑；或
- 仅用于说明 Core 调用方式的 reference example。

它们不能进入 Core，也不升级为新的中央编排服务。`KnowledgePack`、EvidencePackage、
Resource 和 Evidence 可以由 Skill 或应用按场景生成，但不是所有调用者必须采用的共享
运行时领域模型。

### 4. AI 分析与 DeepResearch 的所有权

采纳 **A：AI 分析和 DeepResearch 是完全可替换的外部消费者**。

Collector MCP/Core 只提供稳定的 capability、operation、raw artifact 和有界 artifact
读取接口。DeepSeek、DeerFlow、蜂群研究、其他模型提供商和业务分析器分别作为独立应用或
Agent 使用这些工具，并自行决定是否生成 EvidencePackage、citation、coverage 或报告。

基础服务运行时不内置固定模型提供商，不要求模型密钥，也不因模型不可用影响采集、证据
封存或证据读取。当前已经验证的 DeepSeek consumer 和 analysis API 可以保留为迁移来源或
参考分析器，但不能被当前代码位置倒推为未来平台内置能力。

### 5. Git 仓库按独立产品划分（被收窄为 Core、AI 集成与应用）

继续保留 **按产品边界建立独立 Git 仓库** 的原则，但删除尚未成立的 Evidence Workspace
产品。当前目标仓库类别为：

```text
Collector Core repo
  └─ 当前 D:\AIProject\inteligence

Collector AI Integration boundary（具体仓库归属待后续决定）
  └─ thin MCP server + versioned Skills + examples
  └─ 只依赖公开 Core API/SDK，不含 Workflow Engine

End-user App / Analyzer / DeepResearch repos
  └─ 各自拥有业务状态、模型密钥、项目模型和最终产物
```

仓库之间只通过发布的版本化 API、SDK、MCP 协议和 Skill 合同依赖，不通过相对路径 import，
不复制浏览器或平台实现，也不形成 Core 对上层的反向依赖。MCP/Skills 最终放入 Core、独立
集成仓库还是其他发布单元，将在新的 AI-native Grill 中决定。

当前 `D:\AIProject\inteligence-apps` 继续只被视为上层原型和迁移来源，其中的知识包、任务
服务和 analysis API 不会自动成为新产品。

## 3. 当前已采纳的 AI-native 产品地图

```text
┌──────────────────────────────────────────────┐
│ Agent / AI-native App / DeepResearch         │
│ 自己拥有目标、推理循环、业务状态和最终产物   │
└───────────────┬──────────────────────────────┘
                │ follows
        ┌───────▼────────┐
        │ Versioned Skills│ 场景方法与工具使用知识
        └───────┬────────┘
                │ invokes through MCP
┌───────────────▼──────────────────────────────┐
│ Thin Collector MCP Server                    │
│ typed tools + bounded resources; no workflow │
└───────────────┬──────────────────────────────┘
                │ versioned Core API / SDK
┌───────────────▼──────────────────────────────┐
│ Collector Core                               │
│ capability / operation / raw artifact / audit│
└───────────────┬──────────────────────────────┘
                │ paired MV3 work
┌───────────────▼──────────────────────────────┐
│ User-owned Chrome / Edge + Extension         │
└──────────────────────────────────────────────┘

Non-AI Application
  └─ may call the versioned Core Python/JavaScript SDK directly
```

依赖方向只能向下。MCP 和 Skills 不获得比 Core API 更多的浏览器权限，下层不理解上层的
prompt、报告、项目、业务用户、研究 UI 或模型提供商。

## 4. 本批决定带来的立即约束

在后续整体架构 Grill 完成前：

- 不再把 `inteligence-apps` 称为已经定型的上层产品；
- 不向 Core 加入知识包、分析或业务 workflow；
- 不建设 Evidence Workspace、Workflow Registry、通用 Planner 或中央 Task/Run 服务；
- 不继续设计 Workspace/Task/Run/Step 共享领域层；
- 不继续扩展当前 DeepSeek/analysis API；
- 不因选择独立仓库而立刻复制、移动或删除代码；
- 不把 `KnowledgePack`、EvidencePackage、Resource、当前四个 B站 task type、端口 43128 或
  单进程部署当作所有调用者必须遵守的公共合同；
- 下一步只讨论 MCP tool/resource 边界、Skills 组织、Core API 映射和 AI 自主调用的安全上限；
- 保留现有真实 canary 和测试基线，作为迁移后行为不退化的验证证据；
- 只有完整目标架构获得批准后，才开始仓库建立和一次性迁移。

## 批次 6–10：原领域模型决定及 AI-native 覆盖关系

### 6. 顶层对象采用 Workspace -> Task -> Run -> Step（已覆盖）

> 2026-08-03 覆盖：该层级不再是共享基础设施或 MCP 的领域模型。Agent 或具体应用可以
> 按自身需要使用 project/task/run/step，但 Collector 产品家族不规定、存储或调度它们。

采纳 **A：使用四层、职责互不替代的任务模型**。

```text
Workspace
  └─ Task
       └─ Run
            └─ Step
```

- `Workspace` 是稳定的研究和证据边界，承载用途、访问、保留和相关任务的组织关系；
- `Task` 表达用户或上层应用批准的一项信息需求，以及其计划版本、范围和预算；
- `Run` 是针对一个确定 Task Plan 版本的一次执行尝试，拥有独立开始时间、终态和覆盖；
- `Step` 是 Run 中最小的可审计编排步骤，例如搜索、目录、详情、评论、导出或本地处理。

Task 不能与某次执行结果合并；一个失败 Run 不能把用户的信息需求本身改写为失败。Run 与
Step 也不能隐藏在 KnowledgePack builder 的进程内状态中。尚未决定的具体 Workspace
保留期、Task Plan 版本流程和 Run 恢复协议将在后续批次继续细化。

### 7. 平台采集 Step 与 Core Operation 保持精确映射（已覆盖）

> 2026-08-03 覆盖：共享 Workflow Step 不再存在。每次 MCP 采集工具调用直接产生一个
> 可查询的 Core Operation；Agent/应用可以在自己的日志中组织多次调用，但 MCP 不要求
> 其采用统一 Step、Run 或父子模型，也不替调用者隐藏或自动重放 Operation。

采纳 **A：一个会触发平台采集的 Step 最多提交一个 Core Operation**。

```text
Workflow Run
  └─ typed Step
       └─ Core Operation
            └─ Core Artifact
```

不触发平台动作的本地投影、封存或导出 Step 可以没有 Core Operation。需要搜索、三个详情
和一组评论的工作流必须拆成分别可审计的 Step；不能在一个 Step 内隐藏任意数量的平台
Operation，再只输出一个聚合成功状态。

Step 保存 Core Operation 的稳定 ID、capability、输入摘要、终态、artifact 引用和覆盖，
但不复制或改写 Core 的动作事实。网络失败、超时、部分完成、Gateway 重启或上层进程重启
都不授权自动重新提交。确需再次执行时，创建新的 Step attempt 或新的 Run，显式保存
`parent/supersedes` 关系和新的批准，不覆盖旧 Operation。

### 8. Artifact、Resource、Evidence 与 DerivedArtifact 严格分离（收窄为可选输出词汇）

> 2026-08-03 收窄：只有 Core Operation 和 raw Artifact 是所有调用者共享的强制事实。
> Resource、Evidence 与 DerivedArtifact 可以由某个 Skill、Agent 或应用按场景建立，
> 但 MCP/Core 不要求预先归一化全部结果，也不建设中央 Resource/Evidence Store。

采纳 **A：建立四种不同身份，并通过稳定引用关联**。

```text
Artifact
  Core 或处理器封存的不可变原始产物

Resource
  对账号、视频、笔记、文章、回答等内容实体的最小公共身份和投影

Evidence
  指向具体 Artifact / Resource / locator / capturedAt 的可引用证据锚点

DerivedArtifact
  OCR、ASR、摘要、主题、实体、报告等派生结果
```

Artifact 保留平台特有、安全投影后的 raw 内容。Resource 只固定跨平台查找、身份、去重和
关联真正需要的公共字段，不要求把所有平台字段拆成统一数据库列。Evidence 不是 AI 生成
的观点，而是人或 AI 的结论能够回溯的来源锚点。DerivedArtifact 必须引用输入 Artifact
或 Evidence，不能覆盖、替代或修改原始事实。

只存 Artifact 而完全不建 Resource/Evidence 会让稳定引用、跨任务复用和 coverage 对账
失去公共合同；反过来只存统一表、删除 raw artifact 也不符合本系统的 raw-first 原则。

### 9. EvidencePackage 是平台交付合同，KnowledgePack 是场景视图（收窄为可选约定）

> 2026-08-03 收窄：EvidencePackage/KnowledgePack 不再是 MCP 或共享服务的强制返回类型。
> 它们可以作为 Skills、示例或具体应用使用的可复制输出约定；AI 也可以直接按需读取
> Core Artifact。是否形成 package 由消费者目标决定。

采纳 **A：通用标准交付物为不可变、版本化的 EvidencePackage**。

EvidencePackage 从一个 Workspace/Task/Run 的已封存内容中选择和生成，至少保存：

```text
package identity and schema version
source workspace / task / run references
manifest and integrity digests
coverage and failure semantics
artifact / resource / evidence references
provenance and capture times
optional materialized readable files
```

`KnowledgePack` 保留为面向具体消费者的场景视图，例如“UP 主知识包”“品牌研究知识包”或
某个应用的阅读结构；它构建在 EvidencePackage/Workspace 之上，不再作为证据工作区的根
聚合、唯一目录格式或所有 task 的强制终点。

消费者既可以读取封存 EvidencePackage，也可以在获准范围内查询 Workspace；正式报告、
模型分析和跨仓交接优先使用不可变 Package，避免读取仍在变化的实时状态。

### 10. 采用可演进索引与不可变封存事实（收窄到 Core 与消费者各自边界）

> 2026-08-03 收窄：Core 继续保证 Operation、raw Artifact 和调用审计的稳定事实；MCP
> 不新增中央 Workspace 索引。具体应用若生成 KnowledgePack、EvidencePackage、报告或
> 数据库，应自行决定其版本和保留策略。不可覆盖原始 Core Artifact 继续是推荐原则。

采纳 **A：Workspace 元数据可以演进，已经发生和封存的事实不得原地改写**。

- Workspace 的名称、标签、策略和可重建索引可以更新；
- 尚未执行的 Task Plan 可以产生新版本，已经批准并开始执行的 Plan 版本不可修改；
- terminal Run、Step attempt、Core Operation 引用、已封存 Artifact、EvidencePackage 和
  DerivedArtifact 不可原地重写；
- 修正、补采、重新投影和重新分析创建新对象或新版本，并保存
  `parentRunId`、`derivedFrom`、`supersedes` 等显式关系；
- 删除由用户或获准的上层应用显式发起，并保留不含正文的最小 tombstone 与审计事实；
- raw Artifact 是内容事实来源；catalog、关系数据库、全文索引、向量索引和缓存都必须可
  从封存事实重建，不能成为唯一真相。

因此，后续一次成功采集不能覆盖旧失败、旧部分完成或旧快照；“最新视图”只是索引结果，
不是对历史证据的改写。

## 5. 当前稳定的 AI-native 领域边界

```text
Agent / Application Intent and State
  └─ consumer-owned; no shared workflow schema

Versioned Skill
  └─ teaches when and how to invoke MCP tools

Collector MCP Tool Call
  └─ registered Core capability
       └─ Core Operation
            └─ raw Artifact

Optional consumer output
  └─ Resource / Evidence / EvidencePackage / KnowledgePack / Report
```

当前 `inteligence-apps` 中的知识包、Task API、Analysis API 和 builder 都只能被视为一种
消费者原型。它们可以为未来 Skills、示例和应用提供经验，但不再是待抽象成中央服务的
基础层。

## 批次 11–15（修订）：MCP + Skills AI-native 集成边界

原第 11–15 题关于 Workflow Registry、Planner 和统一恢复器的提问已经作废，不计入决策
编号。本节记录的是纠正后重新提出并采纳的第 11–15 题。

### 11. MCP 与 Skills 使用独立的官方 AI Integration 仓库

采纳 **A：建立独立 AI Integration 产品边界**。

目标仓库职责为：

```text
Collector Core repo
  MV3 / Gateway / Core API / OpenAPI / Python SDK / JavaScript SDK

Collector AI Integration repo（名称后定）
  thin MCP server
  versioned Foundation / Platform / Intent Skills
  AI-native examples
  MCP <-> released Core compatibility and real integration tests

End-user App / Analyzer / DeepResearch repos
  application state / model credentials / final outputs
```

AI Integration 只依赖已发布 Core API/SDK，不相对 import Core 源码，不复制平台注册策略，
不包含 KnowledgePack Task Service、Analysis Service 或通用 Workflow Engine。MCP 是官方 AI
接入面，但不是 Collector Gateway 内置协议；这样 Core 的浏览器采集发布周期和 AI 生态的
Skills/MCP 迭代周期可以独立。

当前 `inteligence-apps` 不是该边界的默认仓库。完整迁移决定前不新建或改名仓库。

### 12. MCP 使用强类型 capability Tools 与只读 Resources 双表面

采纳 **A：有副作用的提交使用 Tool，状态与内容读取使用 Resource**。

每个 direct-ready Core capability 对应一个可发现、强类型的 MCP Tool，例如：

```text
collector_bilibili_native_search
collector_bilibili_video_detail
collector_bilibili_account_profile
collector_xiaohongshu_public_search
collector_xiaohongshu_note_detail
```

Tool 的 input schema 必须来自或严格校验于 Core capability/OpenAPI 合同。AI 不能传任意
URL、selector、脚本、tab ID、坐标、Network route 或未登记 input。共享控制 Tool 只保留
必要的 binding/capability 查询和 Core 正式支持的 operation 控制，不生成浏览器原语。

只读事实通过有界 MCP Resource 提供：

```text
collector://capabilities
collector://bindings
collector://operations/{operationId}
collector://artifacts/{artifactId}
collector://artifacts/{artifactId}/chunks/{cursor}
```

Tool 调用返回 Core Operation 引用和必要终态，不把潜在大 Artifact 全部塞进 Tool 响应。
Resource 读取必须限制相对身份、大小、chunk 和文本窗口，不接受任意本地文件路径。

不提供单个任意 `capability + JSON` 万能 Tool，不提供 navigate/click/evaluate/CDP 等浏览器
控制 Tool，也不把一个完整业务工作流包装成 MCP Tool。

### 13. Skills 采用 Foundation、Platform、Intent 三层可组合结构

采纳 **A：Skills 承载方法知识，而不是复制 Tool schema 或保存运行状态**。

```text
Foundation Skills
  capability discovery
  operation/artifact reading
  failure and safety semantics

Platform Skills
  bilibili collection
  xiaohongshu collection
  future zhihu/wechat/news collection

Intent Skills
  cross-platform topic research
  account public-content research
  search then detail
  discussion/comments research
  evidence-gap follow-up
```

Foundation Skill 解释 Core/MCP 的通用事实；Platform Skill 记录平台当前真实能力、输入边界、
状态解释和禁止行为；Intent Skill 教 Agent 怎样根据目标选择平台、渐进读取结果、判断是否
需要详情或停止。三层可以按任务组合，避免一个巨型 Skill，也避免每个 Tool 重复一份 Skill。

Skill 是版本化、可读、可审查的指导和示例，不是运行时下载代码，不保存 Task/Run，不拥有
浏览器或模型密钥，也不能通过文字指令放宽 MCP/Core 的机器门禁。

### 14. Core 持有采集事实，MCP 无业务状态，消费者持有任务与产物

采纳 **A：状态所有权固定为三段**。

```text
Collector Core
  operation / raw artifact / capability version / safety terminal / audit

MCP Server
  Core connection / protocol negotiation / short-lived resource cursor
  no Workflow / Task / Workspace / report database

Agent or Application
  conversation / research goal / project / call history / citations / final output
  optional KnowledgePack / EvidencePackage / report
```

MCP 原则上是可重启、可替换的薄适配器。重启后它从 Core 重新发现 capability，并通过
operation/artifact ID 读取既有事实；它不恢复 AI 计划，也不为消费者创建中央项目。

Skills 可以建议某种本地输出目录、引用格式或 EvidencePackage 布局，但具体应用可以使用
自己的数据库、Agent memory、文件系统或报告模型。Core 不保存 prompt、对话、模型回答或
业务报告。

### 15. AI 自主调用使用应用、MCP、Core 三层硬边界

采纳 **A：在明确授权包络内允许自主调用，不逐 Tool 人工确认，也不无限信任 Agent**。

```text
Calling App / Agent Session
  allowed platforms / capability classes / total calls / time / data budget

MCP Server
  client/session call count / concurrency / rate / artifact-read byte ceilings
  no silent scope expansion and no automatic platform Tool retry

Collector Core
  token scopes / binding / input schema / capability hard budget
  platform actions / deadline / at-most-once / account safety
```

Agent 可以在调用应用授权的范围内根据 Skills 自主决定下一 Tool，不需要每次弹窗。超过平台、
能力类别、调用量、时间或数据范围时，必须由调用应用或用户提供新的明确授权。MCP session
budget 是短时安全包络，不是 Task/Workflow 数据库。

`get_operation`、capability discovery 和有界 artifact chunk 等纯本地读取可以在传输失败时
有界重试；任何产生新 Core Operation 的平台 Tool 不由 MCP 自动重放。Skills 中的自然语言
预算只是指导，不能替代 MCP/Core 硬限制。

## 6. 第 11–15 条形成的稳定 AI 调用链

```text
Agent-owned goal and state
  -> load only relevant versioned Skills
  -> discover compatible typed MCP Tools
  -> invoke one registered capability Tool
  -> receive Core Operation identity
  -> inspect Operation Resource
  -> read bounded raw Artifact Resources as needed
  -> reason and choose next Tool within caller budget
  -> write consumer-owned final output
```

整条链中不存在中央 Workflow/Planner/Workspace 服务。MCP 不能隐藏多个平台操作为一个成功，
Skill 不能执行工具，Agent 的最终报告也不能反向改写 Core Artifact。

## 批次 16–20：能力发现、上下文和多 Agent 可靠性

### 16. 运行中的 Collector Core 是唯一能力真相

采纳 **A：MCP 根据当前 Core 状态决定实际 Tool 表面，Skills 不能声明运行时可用性**。

MCP 在初始化和新 session 开始时读取 Core 的版本化 release、capability catalog、OpenAPI 和
binding 摘要。只有满足下列条件的 capability 才能作为当前可调用 Tool：

```text
registered
direct-ready
schema compatible
current browser mode supported
not suspended
required binding/permission state discoverable
```

MCP 同时发布 `collector://release`、`collector://capabilities` 和
`collector://bindings`。Skill 只能声明 required/optional capability，并描述能力存在时的
使用方法；Agent 在计划新平台动作前必须先发现当前能力。缺失、暂停、权限不足、需要登录、
binding 离线和不兼容都是显式状态，不能由 Skill README 或历史 canary 覆盖。

同一 MCP session 内 capability 表面变化时，优先使用标准 tool-list change 通知；客户端
不支持安全更新时要求重建 session。旧 Tool 描述不得继续执行已经不可用的能力。

### 17. Core、MCP 和 Skills 独立版本化并机器协商兼容性

采纳 **A：使用 compatibility manifest，不强制三者版本号锁步**。

MCP release 至少声明：

```text
mcpProtocolVersion
toolCatalogVersion
supportedCoreApiSchemaRange
supportedCoreReleaseRange
requiredCoreFeatures
toolSchemaDigests
```

Skill manifest 至少声明：

```text
skillId / skillVersion
requiredMcpTools
requiredCapabilityIds
minimumOutputSchemas
acceptedCapabilityMaturity
optionalCapabilities
testedCompatibility
```

Skill 依赖语义 Tool、capability ID 和输出合同，不硬编码 Core Git commit。MCP 启动时先验证
Core API；Agent/Skill loader 使用当前 Tool/Capability 验证 Skill 要求。无法满足时返回稳定
`compatibility_unmet`，在任何平台动作前停止。

不通过 LLM 猜字段、动态生成兼容转换或自动下载代码。兼容层只能来自显式发布、测试和版本
记录；Core、MCP 和 Skills 可以各自发布，不因一处文案修改而整体同步升级。

### 18. Artifact 使用 metadata-first、有界窗口和内容地址校验

采纳 **A：第一次只读安全元数据，正文和二进制按需读取**。

Artifact metadata Resource 至少返回：

```text
artifactId / operationId / capabilityId
schemaVersion / mediaType / byteLength
sha256 / capturedAt / terminalStatus
availableRepresentations
```

内容读取规则：

- UTF-8 文本按字节范围或行窗口读取，返回 next cursor；
- JSON/JSONL 支持原始窗口、JSON Pointer 或有界记录分页，不执行任意查询脚本；
- HTML/Markdown 按安全文本窗口读取，同时保留 raw artifact identity；
- 图片、音频、视频等二进制默认只返回 metadata、MIME、尺寸、hash 和 resource URI；只有调用
  方明确请求且客户端支持时才按硬字节上限读取；
- 每个 chunk 返回 artifact SHA-256、精确范围、截断和 cursor，禁止拼接不同版本内容。

MCP 不接受绝对路径、`..`、任意文件 URI 或任意本地 JSONPath/evaluate。Tool 结果不内嵌
大型 Artifact；MCP 读取阶段不调用模型、不自动摘要、不强制字段归一化。

### 19. 上下文压缩由消费者完成，并保留最小 provenance

采纳 **A：Agent/Skill 可以生成有损 working notes，但原始 Artifact 始终可重新定位**。

每个压缩片段、摘要或引用候选至少关联：

```text
sourceArtifactId
sourceSha256
operationId / capabilityId
capturedAt
sourceRange / line window / JSON pointer / record IDs
compressionMethod
truncated
```

推荐的 AI-native 渐进读取顺序为：

```text
artifact metadata
  -> manifest/top-level shape
  -> question-relevant bounded windows
  -> consumer-owned working notes
  -> citation-time raw window recheck
```

Working notes、摘要、向量和上下文缓存属于 Agent/应用的派生状态，不由 MCP 持久化成采集
事实。MCP 不内置 LLM，不因生成摘要删除 raw Artifact。最终结论如果需要引用，必须能够回到
原 Operation、Artifact hash 和内容范围，而不是只引用模型摘要或向量 ID。

### 20. 多 Agent 由调用方协调，MCP/Core 负责幂等与动作并发

采纳 **A：MCP 不生成 subagent，也不成为蜂群 Planner**。

调用方 Agent runtime 自己定义 coordinator/worker、平台和目标分工，并为每个产生 Core
Operation 的 Tool 调用提供稳定 `clientRequestId`。MCP 执行：

```text
same clientRequestId + same canonical payload
  -> return the same Core Operation

same clientRequestId + different payload
  -> reject idempotency conflict
```

MCP 继续执行 client/session 调用、并发和读取预算；Core 对 binding + platform 执行 capability
声明的动作并发上限，默认同一 binding/platform 同时最多一个平台动作。不同平台、不同安全
binding、Operation 状态查询、Artifact 读取和 Agent 本地推理可以按声明并行。

未来某项 capability 只有在真实验证和 Core contract 明确允许后才能提高动作并发；Agent
数量、tab 数量或模型建议都不能自行放宽。多个 Agent 的价值是跨平台与分析并行，不是对同一
账号、搜索或详情重复发出平台动作。

## 7. 第 16–20 条形成的可靠读取与并发链

```text
Core live capability catalog
  -> MCP session exposes only compatible typed Tools
  -> Skill requirements checked against the live surface
  -> Agent invokes with stable clientRequestId
  -> MCP/Core return one Operation identity
  -> metadata-first Artifact inspection
  -> bounded raw windows with sha256/range
  -> consumer-owned compression with provenance
  -> parallel reasoning; platform actions remain hard-bounded
```

## 批次 21–25：Skill 供应链、Secret、日志与真实验证

### 21. 官方 Skills 随 AI Integration 发布，第三方只能显式安装

采纳 **A：Skill 是影响 Agent 行为的供应链输入，不能因其是文本就默认可信**。

官方 Skill 随版本化 AI Integration release 发布，每个 package 至少声明：

```text
skillId / skillVersion
publisher / sourceRepository
releaseDigest / SHA-256
requiredMcpTools / requiredResources / optionalTools
declaredFileWrites / declaredExternalNetwork
secretRequirements = none
compatibility / license
```

官方 release 提供完整 manifest、文件 hash 和来源记录。Agent loader 在加载前验证文件、版本
和 compatibility；Skill 本身不获得任何额外 Tool 权限，真正可调用表面仍由 Agent host、MCP
和 Core 决定。

第三方 Skill 允许存在，但只能由用户或应用显式安装到自己的 Agent 环境。不得根据网页、
README、GitHub Star 或模型推荐自动下载执行；安装前展示来源、hash、Tool/Resource 要求、
文件写入和外部网络声明。第三方 Skill 默认不得读取模型 key、Core token、浏览器凭据或任意
本地文件，并且必须能够被固定版本、禁用和删除。

### 22. Skill 更新显式、原子、会话固定且可回滚

采纳 **A：一个 Agent session 从开始到结束锁定精确 Skill version 和 digest**。

更新流程为：

```text
discover release
  -> isolated staging
  -> publisher/manifest/hash verification
  -> MCP/Core compatibility check
  -> static and integration gates
  -> explicit activation
  -> only new sessions adopt it
```

已有 session 不在推理中途换 Skill。至少保留一个最近已验证版本用于回滚；回滚只影响新
session，不重放旧 Tool 调用、不修改 Core Operation。Skill 内容、Tool 选择方法、停止规则或
引用示例发生行为性改变时必须升级版本和 digest。

不自动拉取 Git `main`，不原地覆盖已安装文件，不允许修改后的 Skill 继续冒充官方 hash，
也不因 Core 补丁或文档调整强制所有 Skill 无意义锁步升级。

### 23. MCP 默认 stdio，Core token 与 MCP client credential 分离

采纳 **A：MCP 使用最小 scope Core client token，但 Agent 永远看不到该 token**。

默认部署为受信本机 Agent host 启动的 stdio MCP Server：

```text
Agent / MCP Client
  -> MCP protocol only
  -> no Core service token

MCP Server
  -> reads least-privilege Core token from OS credential store,
     restricted local config, or process environment
  -> token remains in process memory

Collector Core
  -> validates token scope, binding, capability and operation
```

如果后续启用共享本机 transport，只允许认证的 `127.0.0.1`，并使用独立 MCP client
credential；不得复用或下发 Core token。不同 MCP client 可以拥有不同 Tool、平台、调用量
和 Artifact 读取 scope。MCP 不读取模型提供商 key，也不接触 Cookie、Storage、密码或
Profile。

任何 Tool input/result、Resource、Skill manifest、日志、诊断和报告均不得包含 Core token
或其他 secret。localhost 本身不等于认证，不允许公网、局域网共享管理员 token或网页直连。

### 24. 日志跨层关联 Tool、Operation 和 Artifact，但不复制情报内容

采纳 **A：使用本地、结构化、内容最小化的事件日志**。

允许记录：

```text
timestamp / level / eventName
mcpSessionId / safe mcpClientAlias
toolCallId / clientRequestId
toolId / toolSchemaDigest
coreOperationId / capabilityId
safe browserBindingAlias
state transition / durationMs
budget requested / consumed
artifactId / mediaType / byteLength / sha256
stable errorCode / terminalReason / retryClass
```

默认禁止记录：

```text
full prompt / conversation / model answer
raw query text / full URL with query
Tool result content / Artifact body
account profile content / public contact details
Cookie / Token / API key / Authorization
headers / request body / browser Profile / raw tab or window identity
```

需要关联输入时只保存 Core 已批准的 digest、长度、类型和安全别名。日志本地轮转并有大小、
保留期和去敏诊断导出；默认不上传远程 telemetry。具体应用可以按自己的数据政策保存问题和
报告，但不能把它们混入 MCP 基础设施日志。

### 25. 使用 L1–L4 四层测试，只有真实闭环证明平台能力

采纳 **A：每层证明不同事实，不能用 fake 平台或手工操作互相冒充**。

```text
L1 pure unit
  manifest/schema/compatibility
  URI/path/range/cursor
  redaction/idempotency/budget reducers
  Skill metadata validation

L2 real local process integration
  packaged MCP process
  released Core SDK/API
  real stdio or authenticated loopback
  real token scopes, operation/resource mapping and secret isolation
  may use zero platform requests, but cannot claim platform behavior

L3 real browser platform E2E
  production MV3 + real Core Gateway + real MCP Server
  real MCP client harness + registered live capability
  Tool -> Operation -> Artifact metadata -> bounded raw read

L4 Skill-driven Agent canary
  real Agent runtime + pinned Skill
  capability discovery -> real MCP Tool -> terminal interpretation
  bounded Artifact reading -> correct continue/stop -> provenance output
```

远程 CI 运行构建、L1 和不访问平台的协议门禁；L3/L4 只在用户控制的本机验证环境低频、只读
运行。离线 Skill/prompt evaluation 可以检查格式、选择和错误理解，但不能升级 platform
capability。平台证据不得来自 fake Gateway、fake XHR、fixture page 或 synthetic clone。

必须自动覆盖不兼容 Skill 的动作前拒绝、secret 扫描、大 Artifact chunk/hash/range、相同
`clientRequestId` 不产生第二 Operation、多 Agent 不突破动作并发、MCP 重启不重放平台 Tool，
以及 Agent 不把登录/验证码/风控/部分完成解释成“没有信息”。除本人扫码、密码和验证码外，
验证不依赖用户手工加载扩展、点击 Tool 或关闭浏览器。

## 8. 第 21–25 条形成的可信发布链

```text
versioned Skill source
  -> manifest/hash/compatibility verification
  -> explicit atomic activation
  -> session pins exact Skill digest
  -> authenticated stdio MCP with hidden least-privilege Core token
  -> content-minimized correlated logs
  -> L1/L2 gates
  -> low-frequency real L3/L4 canary
```

## 批次 26–30：安装、生命周期、平台与开源交付

### 26. Core 与 AI Integration 独立安装，但由配置器消除手工接线

采纳 **A：提供两个独立 release 和一个面向用户的 AI Integration 配置命令**。

一次性流程为：

```text
Install Collector Core
  -> install per-user Gateway/launcher
  -> place production MV3 in a stable directory
  -> user visibly installs and pairs it in daily Chrome/Edge
  -> create scoped local-application credentials

Install Collector AI Integration
  -> install thin MCP executable/package
  -> install versioned official Skills
  -> detect local Core release and compatibility
  -> user selects Agent host
  -> write MCP/Skill host configuration
  -> request a least-privilege Core token and store it via OS protection
```

用户不手工复制 Core token、不编辑长段 MCP JSON、不提供 Chrome Profile、不启动 testbench，
也不把模型 key 交给 Core/MCP。扩展安装、站点权限和首次配对继续是用户可见的一次性安全
动作，安装器不能静默批准浏览器权限。

Core 和 AI Integration 可以独立升级、回滚和卸载；卸载 AI Integration 不删除 Core
artifact/binding，卸载 Core 也不能让 MCP 回退到其他浏览器控制路线。

### 27. Core 是当前用户级长期服务，MCP 是 Agent session 短进程

采纳 **A：两者生命周期严格分离**。

```text
Collector Core Gateway
  current-user singleton
  optional OS-login autostart or explicit official launcher
  independent of Agent sessions
  never launches/closes/attaches the user's browser

MCP Server
  spawned by Agent host over stdio
  exits with the MCP session
  never owns Core or browser lifecycle
  returns core_unavailable when Core is offline
```

MCP 不因 Core 离线循环启动进程，不在退出时关闭 Core，也不创建浏览器。正式安装器可以让
用户选择当前用户登录自启 Core；用户关闭该选项后通过同一官方 launcher 管理服务。

Gateway 身份、browser binding、Operation 和 Artifact 不依赖 MCP 进程存在。MCP 重启后
重新验证兼容性并读取 Core 事实，不能恢复或重放 Agent 以前的计划。

### 28. stdio 为默认 transport，认证 loopback 是可选共享模式

采纳 **A：两种 transport 共享完全相同的 Tool/Resource 合同**。

```text
Default
  Agent Host -> stdio MCP child -> Core loopback API

Optional shared-local mode
  multiple approved local clients
    -> authenticated 127.0.0.1 MCP transport
    -> one long-lived MCP process
    -> Core loopback API
```

stdio 无额外网络端口，默认绑定启动它的 Agent host。只有多个本地 client 确有共享需要时
才显式启用 loopback，并为每个 client 签发独立 credential、Tool/platform scope、调用预算
和 Artifact 读取范围。

Skill 不感知 transport；两种模式的 Tool schema、Resource URI、错误、幂等和兼容清单一致。
不支持局域网、公网、反向隧道、浏览器网页直连或共享管理员 credential。

### 29. Windows-first 正式发布，跨平台只在真实验证后声明

采纳 **A：第一阶段正式支持 Windows 11 + Chrome/Edge**。

首个发布闭环包含：

```text
current-user installation
Windows Credential Manager or DPAPI-backed secret storage
per-user launcher and optional login autostart
stdio MCP packaging
production MV3 + Core + MCP + pinned Skill + Agent canary
```

实现层提前隔离 user data directory、secret store、launcher/autostart、process probe、路径与
权限、浏览器安装说明、日志目录和 executable packaging，但不为同步支持 macOS/Linux 阻塞
Windows MVP，也不硬编码当前机器绝对路径作为公共合同。

macOS/Linux 后续分别完成原生凭据存储、进程生命周期、浏览器安装、stdio/loopback、MV3
配对和真实 Core-to-MCP-to-Agent canary 后，才能进入支持矩阵。Docker/远程 Linux 不能替代
用户日常浏览器的本地生产路径。

### 30. Core 与 AI Integration 分别以 Apache-2.0 独立开源

采纳 **A：通用基础设施开源，具体应用和模型业务独立选择许可证**。

```text
Collector Core repo — Apache-2.0
  MV3 / Gateway / contracts / SDK / registered capabilities
  no third-party crawler code or real credentials/runtime artifacts

Collector AI Integration repo — Apache-2.0
  thin MCP Server / official Skills / compatibility manifests / examples
  no model keys / workflow engine / proprietary Agent framework lock-in

Application / Analyzer repos — independent license
  may be open-source, private or commercial
  own prompts, UI, project data and final outputs
```

两个开源仓库都发布 LICENSE、依赖/SBOM、第三方许可证、安全边界、非目标、release hash、
贡献规范以及“README/Skill 声明不等于实时 capability”的说明。官方 Skills 与 AI
Integration 同仓、同 release manifest 和许可证；第三方 Skill 保留自己的来源与许可证。

传统平台爬虫仓库继续只作调研线索，不复制、不集成、不运行，也不因 Apache-2.0 开源目标
放宽现有平台、隐私和浏览器凭据边界。

## 9. 第 26–30 条形成的正式交付拓扑

```text
Windows current user
  ├─ Daily Chrome/Edge + paired production MV3
  ├─ Long-lived per-user Collector Core Gateway
  ├─ Agent host
  │    └─ per-session stdio Collector MCP process
  └─ versioned official Skills

Released separately
  ├─ Apache-2.0 Collector Core
  └─ Apache-2.0 Collector AI Integration
```

## 批次 31–35：原型归档与零兼容迁移

### 31. `inteligence-apps` 冻结为历史原型，新产品使用干净仓库

采纳 **A：保留旧仓库的真实证据和历史，但停止把它演进为正式产品**。

目标处理方式：

```text
D:\AIProject\inteligence-apps
  -> stop feature work
  -> add prominent prototype/archive README
  -> create final-prototype tag
  -> retain Git history, tests and real canary records
  -> no runtime dependency from the new product

new Collector AI Integration repo
  -> clean Apache-2.0 product boundary
  -> MCP / Skills / compatibility / examples / tests only
  -> no inherited KnowledgePack/Task/Analysis architecture
```

旧仓库不立即删除。只有新仓库完成真实 MCP/Agent 闭环，并核对所有需要的验证经验与文档后，
才决定长期只读归档或本地保留策略。新仓库不得通过 git submodule、相对 import、HTTP fallback
或启动旧 server 使用它。

### 32. 迁移已验证的行为经验，不整体复制旧源码

采纳 **A：选择性重写符合新合同的窄逻辑，旧类型和服务结构不进入新运行时**。

可以迁移为新 MCP 测试或实现经验的内容包括：

- Python/JavaScript 调用表面一致性；
- loopback origin、Bearer、响应大小、UTF-8 和路径边界；
- Artifact metadata/hash/bounded read、去敏和 provenance；
- Operation 不自动重试、部分完成和稳定错误；
- 真实 Core-to-browser canary 的选择与验收方法；
- token、日志、文件越界和进程残留的测试模式；
- DeepSeek smoke 证明“分析必须外置”的失败经验；
- 不含 secret 的真实验证文档。

明确不迁入 AI Integration 运行时：

```text
KnowledgePack domain/writer/catalog
KnowledgePackTaskService and ASGI Task API
the four Bilibili workflow builders
task-api Python/JavaScript clients
Analysis Task API / DeepSeek client / model settings
port 43128 contract
Workspace/Task/Run/Step shared abstractions
```

现有 Core SDK 已经是正式依赖，不从旧仓库复制 client。需要的功能按 MCP 合同重新实现并由
新测试证明，不通过 compatibility adapter 或“临时保留旧服务”过渡。

### 33. AI Integration MVP 只证明完整 Core AI-native 接入

采纳 **A：MVP 覆盖当前全部 direct-ready capability 的 Tool catalog parity，但只做必要的
低频真实 canary**。

MVP 必须交付：

```text
Windows stdio MCP Server
Core release/capability/binding compatibility preflight
all current direct-ready capability Tools and schema parity
Operation Resources
Artifact metadata + bounded UTF-8/JSON chunk Resources
clientRequestId idempotency
least-privilege Core credential loading
content-minimized structured logs
Foundation Skills
Bilibili Platform Skill
Xiaohongshu Platform Skill
one minimal search-then-detail Intent Skill
one Agent-host configuration entry
L1/L2 automated gates
at least one real Bilibili L3 MCP canary
at least one pinned-Skill L4 Agent canary
```

全部 direct-ready capability 必须出现在 Tool catalog、schema digest 和 Core matrix parity 中，
不能再以单个 B站 Tool 演示冒充产品。但 MVP 不为每个 Tool 重复实网动作；真实 canary 依据
变更影响、平台风险和已有 Core 证据低频选择。

MVP 不做 shared loopback MCP、macOS/Linux、Skill marketplace、自动 Skill 更新、Task API、
KnowledgePack、Workflow/Planner、DeepSeek/DeepResearch、UI、向量数据库、持续监控或任意浏览器
Tool。

### 34. 完整架构批准后再创建 `collector-ai-integration` sibling repo

采纳 **A：先完成决策和一致性审计，再建立新 Git 产品**。

暂定本地路径：

```text
D:\AIProject\collector-ai-integration
```

公开仓库和品牌名可在首次 release 前调整一次；公共 package 使用 `collector-mcp` 语义，避免
绑定某个 Agent 框架。创建顺序固定为：

```text
1. complete overall Grill
2. publish target architecture and consistency audit
3. owner approves architecture
4. freeze/tag inteligence-apps
5. create empty sibling Git repo
6. add AGENTS/README/LICENSE/SECURITY/CONTRIBUTING
7. move this decision log once; old path becomes a pointer
8. define compatibility manifest and MCP contracts
9. only then implement source and tests
```

新仓库从首日只依赖已发布 Core SDK/API。不得先在 Core `poc/`、临时无 Git 目录或旧 apps
package 中写完代码后再搬迁。

### 35. 采用七个零兼容、可独立验证的 Git checkpoint

采纳 **A：不为旧 Task/Analysis API 提供 adapter、forwarding、dual-write 或 fallback**。

```text
Checkpoint 0 — architecture freeze
  complete decisions, audit, target map, non-goals and migration list
  docs only

Checkpoint 1 — prototype freeze
  mark inteligence-apps prototype/archive
  create final-prototype tag
  stop feature work

Checkpoint 2 — new repository foundation
  Git / Apache-2.0 / AGENTS / README / SECURITY
  package boundaries / compatibility manifest / test skeleton

Checkpoint 3 — MCP protocol foundation
  stdio / Core auth / live capability discovery
  Tool/Resource contracts / errors / logs
  L1 + real-process L2

Checkpoint 4 — full direct capability parity
  all direct-ready Tools
  Operation/Artifact Resources
  schema digest and Core matrix parity gate

Checkpoint 5 — Skills and real AI-native canary
  Foundation/Bilibili/Xiaohongshu/Intent Skills
  L3 real MCP canary + L4 pinned-Skill Agent canary

Checkpoint 6 — Windows user release
  install/configure/uninstall / OS secret protection
  Agent host configuration / release hash / SBOM / runbook
```

明确禁止旧 `/v1/tasks`、`/v1/analysis`、43128 server、`KnowledgePackTaskClient` 适配、新旧
双写、MCP 失败回退旧 builder、相对 import 旧仓库，以及一个大提交同时完成所有 checkpoint。

## 10. 第 31–35 条形成的一次性迁移路线

```text
current architecture decisions
  -> final consistency audit and owner approval
  -> freeze/tag inteligence-apps prototype
  -> create clean collector-ai-integration repo
  -> contracts and L1/L2 before platform Tools
  -> full direct capability parity
  -> Skills plus real L3/L4 canary
  -> Windows release
```

## 批次 36–40：异步接口、终态与长期 Core 合同

### 36. 产生平台动作的 Tool 立即返回 Core Operation 引用

采纳 **A：所有有副作用的 MCP capability Tool 使用统一异步语义**。

Core 接受唯一一次提交后，Tool 立即返回：

```text
accepted
operationId
capabilityId
current state
collector://operations/{operationId}
```

MCP 不在同一 Tool 调用中等待页面终态或读取完整 Artifact。Agent 后续通过只读
`collector_get_operation`、Operation Resource 或客户端支持的 Resource subscription 观察；
终态后再读取 Artifact metadata/chunks。

Tool timeout、MCP 断开或 Agent 重启不等于 Operation 失败，也不授权重新提交。重新连接后
使用已有 Operation ID。状态查询和 Artifact 读取不产生平台动作，可以按 transport policy
有界重试。Skill 可以教授 submit/wait/read 方法，但 MCP 不包装隐藏 Workflow。

### 37. Execution target 由 capability 合同限定为安全语义枚举

采纳 **A：Agent 永远看不到或传入 tab/window/browser 内部身份**。

```text
collector_work_tab-only capability
  -> Tool has no executionTarget input
  -> Core fixes collector_work_tab

user_selected_tab-only capability
  -> Tool has no executionTarget input
  -> requires a current user-created short lease

capability safely supports both
  -> Tool may accept only:
     collector_work_tab | user_selected_tab
  -> default declared by the capability contract
```

需要 user-selected page 但没有有效 lease 时返回 `user_action_required`，引导用户在扩展 UI
选择当前页。MCP 不枚举普通 tab，不按 URL/标题猜页，不接受 tab ID/window ID/任意 URL，
也不在缺少 lease 时回退到另一 execution target。

### 38. MCP 协议错误与 Core Operation 终态严格分层

采纳 **A：只有调用/协议边界错误属于 MCP error**。

MCP 层错误包括：

```text
invalid_tool_input
authentication_failed / permission_denied
compatibility_unmet / core_unavailable
resource_uri_invalid / artifact_read_out_of_bounds
idempotency_conflict
```

一旦创建 Core Operation，业务结果始终通过结构化 Operation Resource 表达并保留：

```text
accepted / running / completed / partial
blocked / failed / cancelled / outcome_unknown

coreErrorCode / terminalReason / retryClass
platformActionAttempted / safeNextAction
partialArtifactRefs / coverage / truncation
```

`no_results` 是成功执行后的内容终态，不等于失败。authentication、verification、rate limit、
layout drift、user action、budget exhausted 和 outcome unknown 原样可见。MCP 不解析错误消息、
不将失败改写为 no data，也不因存在 partial artifact 把状态提升为 completed。

### 39. Core 是 raw Artifact 生命周期的唯一所有者

采纳 **A：MCP 只读取 Core retention 状态，MVP 不提供删除 Tool**。

Core 独立负责 artifact root、retention policy、integrity/hash、local protection/encryption、
quota、显式删除、tombstone 和清理策略。MCP metadata Resource 只投影：

```text
retentionClass
retainedUntil
deletionState
available
```

MCP 不复制中央 Artifact cache。Agent/应用可以生成自己的派生产物，但不能冒充 Core raw
Artifact。Artifact 删除、过期、损坏或不可用时返回结构化状态和最小 tombstone，不自动重新
执行原平台采集。

未来只有 Core 正式发布版本化删除 capability，且 MCP client 另有 `artifacts:delete` scope
时，才能单独审议删除 Tool。Agent 不能通过本地路径、文件系统 Tool 或 MCP Resource 删除
Core 产物。

### 40. Python/JavaScript SDK 与 MCP 长期并存并共享 Core 合同

采纳 **A：两者是用途不同、平等正式的 Core 接口**。

```text
Deterministic application
  -> Python SDK or JavaScript SDK
  -> Core API

AI-native application
  -> MCP Tools/Resources + Skills
  -> released Core SDK/API
  -> Core API
```

Core OpenAPI/capability catalog 是共同真相。Python SDK、JavaScript SDK 与 MCP Tool catalog
必须通过自动 parity gate；MCP 不增加隐藏 capability，SDK 不经 MCP 转发。MCP 可以使用正式
SDK 作为内部 adapter，但不相对 import Core 源码。

同一应用可以同时使用 SDK 和 MCP，但同一有副作用动作必须用稳定 clientRequestId 去重，
不能从两条路径重复提交。Skills 只面向 MCP；SDK 继续提供确定性的 typed builders/models，
不要求普通程序引入 Agent 协议。

## 11. 第 36–40 条形成的公共调用合同

```text
typed capability Tool
  -> one accepted Core Operation
  -> immediate Operation identity
  -> structured terminal Resource
  -> Core-owned retained raw Artifact
  -> metadata-first bounded Resource reads

execution target
  -> capability-fixed semantic mode
  -> never a browser/tab primitive

contract parity
  -> Core OpenAPI/capabilities
  -> Python SDK == JavaScript SDK == MCP Tool catalog
```

## 12. Grill 完成状态

整体系统宏观 Grill 完成至第 40 条，一致性与缺口审计已经完成：

- 对照 Collector 第 1–178 条既有决定；
- 对照当前 Core user-owned-browser、API/SDK/capability 实现；
- 对照当前 `inteligence-apps` 原型；
- 检查 MCP/Skills 是否暗中恢复 Workflow/Planner；
- 区分产品决定、实现缺口和未来非阻塞扩展；
- 输出唯一目标架构、MVP、迁移 checkpoints、非目标和 Stop-Doing List。

审计结论是没有不能由现有决定解决的产品级阻塞，不再追加新的五题。实现缺口已经分配到
Checkpoint 0–6，不重新打开产品方向。项目负责人已于 2026-08-03 批准
[Collector AI-Native 目标架构](collector-ai-native-target-architecture.md)，Checkpoint 0 完成；
随后严格完成 Prototype Freeze（Checkpoint 1）与干净新仓库基础（Checkpoint 2）。下一步
进入 Core 前置合同与 thin MCP Foundation，不再打开已关闭的产品方向。
