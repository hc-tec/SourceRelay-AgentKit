# 学习：MCP 和 Skills 怎么用（SourceRelay AgentKit 版）

> 这是一份面向初学者的入门材料，按“零基础也能看懂”的方式写。
> 读完你会明白三件事：
> 1. MCP 是什么、为什么这个项目要用它；
> 2. Skills 是什么、和 MCP 是什么关系；
> 3. 在你自己电脑上，怎么把这一套真正用起来。
> 建议边读边在终端敲命令，效果最好。

## 0. 用一句话说清楚这个项目

这个仓库（SourceRelay AgentKit）是一个“翻译层”：

它把 Core 已经登记好的**浏览器采集能力**，包装成 AI 能直接调用的**工具（MCP Tools）**，
再配上**说明书（Skills）**，让 AI 知道什么时候用哪个工具、怎么用、用错了怎么办。

它自己**不采集、不推理、不写报告**。真正操作浏览器采集的是 Core；思考、写报告的是 Agent（AI）。

## 1. 一个生活比喻

想象你开了一家“信息厨房”：

- **Core（厨师）**：真正干活的人。他在用户自己的浏览器里按规矩采集，做完把结果放到窗口。
- **MCP Server（菜单 + 传菜口）**：把厨师会做的菜（capability）写成一张菜单（Tools），服务员照着菜单点菜。
- **Skill（贴在墙上的服务规范）**：不点菜、不做菜，只教服务员：“客人要 B 站信息时，先点搜索菜、再点详情菜；遇到‘需要登录’要如实告诉客人，不能编个‘没有’。”
- **Agent（服务员/店长）**：决定客人要什么、怎么搭配、最后怎么解释。

MCP（Model Context Protocol）就是“餐厅行业通用的点菜协议”：
让任何 AI 程序（Codex、Claude、DeerFlow……）都用同一套方式调用外部工具，不用每家餐厅重新学一套。

## 2. MCP 是什么

一句话：**MCP 是让 AI 程序调用外部工具、读取外部信息的统一标准**，就像 USB 是设备统一的插口。

在本项目里，MCP 提供两类东西：

### 2.1 Tools（工具）—— AI 可以“点菜”

- **一个 Core 能力（capability）对应一个强类型工具（Tool）**。
- 当前共 **18 个 direct-ready 能力 = 18 个工具**，一一对应。
- 工具名是固定的，例如：
  - `collector_bilibili_native_search`（B 站搜索）
  - `collector_bilibili_video_detail`（B 站视频详情）
  - `collector_xiaohongshu_public_notes_search`（小红书笔记搜索）
  - `collector_zhihu_search_public_content`（知乎搜索）
- 每个工具只收**固定字段**（比如 `query`、`canonicalVideoUrl`），
  **不收**任意 URL、selector、脚本、坐标、tab ID、CDP 命令。

完整工具清单见 `manifests/compatibility.json` 的 `mcp.tools` 数组。

### 2.2 Resources（资源）—— AI 可以“看仪表盘”

MCP 里还有一批**只读资源**，以 `collector://` 开头：

```text
collector://release                        # 版本与合同
collector://capabilities                   # 现在有哪些能力、是否 ready
collector://bindings                       # 浏览器绑定（安全摘要）
collector://operations/{operationId}       # 某次操作的实时状态
collector://artifacts/{artifactId}         # 采集结果的元信息
collector://artifacts/{artifactId}/chunks/{cursor}  # 结果正文（分块读取）
```

原则：**先看元信息（多大、什么类型、SHA-256 是多少），需要正文才按块读**，不要一次性把正文全读进上下文。

## 3. 一次完整采集是怎么发生的（核心流程）

记住这个“六步流程”，就学会了 MCP 的核心用法：

```text
1. 先读 collector://release 和 collector://capabilities
   → 确认“现在”这个能力真的可用（不能从说明书猜）

2. 生成一个唯一请求号 clientRequestId（UUID）

3. 调用一个强类型 Tool（只调用一次！）

4. 立刻拿到 operationId，不等页面加载完

5. 轮询 Operation 状态，直到终态：
   非终态：queued / claimed
   终态：completed / partial / stopped / failed

6. 有结果时先读 Artifact 元信息，再按需读 chunks
```

用 B 站搜索走一遍：

- Agent 决定：“搜一下 B 站上‘xxx’相关视频”
- 生成 `clientRequestId = 550e8400-...`（UUID）
- 调用 `collector_bilibili_native_search(query="xxx", clientRequestId="...")`
- 立即返回 `operationId=abc-123` 和 `operationResourceUri=collector://operations/abc-123`
- Agent 按 2、4、8 秒（最多 15 秒）的节奏轮询，直到 `completed / search_ready`
- 读 `collector://artifacts/{artifactId}` 拿元信息（字节数、SHA-256）
- 需要正文时读 `chunks/0`，然后只跟返回的 `nextChunkResourceUri` 走
- 报告里写上：操作 ID、Artifact ID、SHA-256、终态——这就是**证据链（provenance）**

### 为什么“只调用一次”这么重要

平台动作有成本，也可能触发风控。所以协议是 **at-most-once（最多一次）**：

- 同一个请求号 + 同样的参数 = 同一个操作（幂等，可以安全对账，不会重复执行）
- 同一个请求号 + 改了参数 = **冲突（禁止）**
- 一个新的动作 = 一个新的请求号
- 如果结果是 `submission_outcome_unknown`（不确定提交成功没有）：**不自动重试**；
  确实需要对账时，用**完全相同的参数 + 同一个请求号**再提交一次，然后停止。

### 终态必须“原样保留”

- `no_results`、登录失效、验证码、限流、`partial`（部分成功）、`failed` 是**不同的事实**。
- 平台失败就是平台失败，**不能改写成“没找到”（no_results）**。
- 这是本项目的硬规矩，AGENTS.md 和所有 Skill 里反复强调。

## 4. Skills 是什么

MCP 给了 AI“工具”（能做什么），但没告诉 AI“怎么做才安全高效”。
Skills 就是补这一块：**一份给 Agent 看的方法说明书**。

### 三条铁律

1. **Skill 不执行任何工具**。它只是文字指导，真正调用工具的是 Agent。
2. **Skill 不给权限**。权限由 MCP/Core 的机器门禁决定，说明书不能越过门禁。
3. **Skill 不保证能力可用**。某个能力现在能不能用，必须现场读 `collector://capabilities` 确认。

### 当前 5 个官方 Skills（三层结构）

| 层 | Skill | 版本 | 干什么 |
| --- | --- | --- | --- |
| Foundation（地基） | `use-collector-mcp` | 0.1.0 | 兼容性检查、幂等提交、Operation/Artifact 读写、失败解读 |
| Platform（平台） | `collect-bilibili` | 0.1.1 | B 站 10 个工具怎么选、怎么排序 |
| Platform（平台） | `collect-xiaohongshu` | 0.1.1 | 小红书 5 个工具、页面状态安全 |
| Platform（平台） | `collect-zhihu` | 0.1.0 | 知乎官方 Provider 搜索/热榜/全网搜索 |
| Intent（意图） | `research-search-then-detail` | 0.1.1 | “先搜索、再挑几个看详情”这类研究套路 |

每个 Skill 的目录结构：

```text
skills/collect-bilibili/
├── SKILL.md            # 说明书正文（Agent 会读这个）
├── manifest.json       # 版本、digest、依赖的工具/资源
├── agents/openai.yaml  # Agent 平台元数据
└── references/         # 可选参考资料
```

`manifest.json` 里固定了 **digest（哈希指纹）**。Agent 会话会“钉住”一个精确版本：
session 开始用什么版本，中间**不能热切换**（防止说明书被偷偷替换）。

### 在 Codex 里怎么调用

Agent 通过 `$技能名` 引用技能，例如：

```text
$use-collector-mcp
$collect-bilibili
```

实际使用中你**不需要自己敲这些**——你只要用自然语言说需求，Agent 会自己判断加载哪个 Skill。
但你可以明确要求它，例如：“请按 use-collector-mcp 的流程，先检查 capabilities，再搜索。”

## 5. 实操：在你电脑上跑起来

### 5.1 前置条件（缺一不可）

1. 已安装 **SourceRelay Core Gateway**（正式 release，本仓库锁定 Core `0.7.17`）；
2. 需要浏览器能力时，你的 Chrome/Edge 已安装 **production MV3 扩展并完成配对**；
3. Node.js >= 22（当前机器 v24.13.0，满足）；
4. Python 3.12+（跑仓库门禁用）。

### 5.2 第一次安装（只做一次）

```powershell
Set-Location D:\AIProject\collector-ai-integration
npm ci
npm run build
npm run agent:setup    # 输入一次 Core 签发的最小权限 token（cst_...）
npm run agent:status   # 检查是否就绪
```

- token 保存在 `%LOCALAPPDATA%\SourceRelay\AgentKit\core-credential.json`
- **token 不会进入 Git、MCP 配置、Skill、prompt 或日志**

如果使用 Codex，再执行一次：

```powershell
npm run agent:install-codex
```

它注册的是一个**不含密钥**的启动命令：`collector-agent mcp`。
以后 Codex 每个会话需要时会自动启动这个 MCP 子进程，你不需要手动维护一个常驻服务。

### 5.3 日常使用

```powershell
codex
```

然后直接说需求，例如：

> 请用 Collector 在 B 站搜索“xxx”相关视频，先搜索，再挑前 3 个结果看视频详情，
> 最后把搜索词、操作 ID、Artifact ID 和结论一起整理给我。

Agent 会自己走一遍：读 capabilities → 生成请求号 → 调工具 → 轮询 → 读 Artifact → 给你带证据的答案。

### 5.4 健康检查 / 排障

```powershell
npm run agent:status   # 是否就绪（与 MCP 启动同一套预检）
npm run agent:doctor   # 详细诊断
```

如果看到 `compatibility_unmet`：

- 说明 AgentKit 与当前 Core 的版本/合同不匹配（本项目锁定 Core `0.7.17`、service schema `3`）；
- 读 `collector://release`、`collector://capabilities`、`collector://bindings`，
  对照 `manifests/compatibility.json` 的 digest 和 required features；
- 不要手动关断言或绕过门禁。

### 5.5 其他 MCP Host（Claude 等）

```powershell
npm run agent:print-config
```

会输出一个**不含密钥**的 `mcpServers` 配置块，粘到你的 Host 配置即可。

## 6. 名词小抄

| 词 | 意思 |
| --- | --- |
| MCP | 模型上下文协议，AI 调用外部工具的标准接口 |
| Tool | MCP 暴露给 AI 的一个可调用操作（本仓库 18 个强类型工具） |
| Resource | MCP 暴露的只读数据（`collector://...`） |
| capability | Core 登记的某个平台能力（如 `bilibili.native_search`） |
| Operation | 一次异步采集任务（有 ID、有状态） |
| Artifact | 采集产出的原始结果（有元信息 + 分块正文） |
| clientRequestId | 幂等请求号：同一个号 + 同样参数 = 同一个操作 |
| binding | 浏览器绑定（用户浏览器与 Core 的安全连接） |
| MV3 extension | 装在用户浏览器里的官方扩展，真正执行浏览器能力 |
| Official Provider | 不依赖浏览器的官方数据源适配器（如知乎） |
| digest | 哈希指纹，用来固定版本、防篡改 |
| stdio | MCP 通过标准输入/输出与本机进程通信（本项目传输方式） |
| L1/L2/L3/L4 | 验证等级：纯合同 → 真实进程 → 真实平台 → 真实 Agent + 固定 Skill |

## 7. 红线（什么绝对不能做）

- 不要向 Agent 粘贴 Core token / Cookie / 平台密码；凭证只配置在 Core 侧。
- 不要让 Agent 用任意 URL、selector、脚本、tab ID、CDP 去“补采集”——MCP 表面根本没有这些。
- 不要把平台失败改写成 `no_results`。
- 不要重复提交同一个操作；不确定时用同一个请求号幂等对账一次，然后停止。
- 不要热切换 Skill；一个 session 钉一个版本。
- 不要绕过验证码/登录/限流，也不要点赞、关注、评论、发布、删除（除非用户另行明确指示）。

## 8. 学习路线（接下来读什么）

按顺序读，由浅入深：

1. 本文件（先建立心智模型）；
2. `docs/architecture/collector-ai-native-target-architecture.md`（全貌：谁负责什么、边界在哪）；
3. `skills/use-collector-mcp/SKILL.md`（地基说明书，必读）；
4. `skills/collect-bilibili/SKILL.md`、`skills/collect-xiaohongshu/SKILL.md`、`skills/collect-zhihu/SKILL.md`（平台层）；
5. `docs/runbooks/agentkit-developer-runbook.md`（安装、排障、发布清单）；
6. `docs/validation/checkpoint-5-l4-codex-pinned-skill-canary.md`（看一次真实的 L4 验证：真实 Agent + 固定 Skill + 真实 MCP 是怎么协作的）。