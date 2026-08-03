# Checkpoint 5 L4 pinned-Skill Agent canary

## 结论

`proved`。2026-08-03，一个真实 `codex exec --ephemeral` Agent session 使用精确固定的
Foundation 与 Bilibili Skill 快照，经打包安装后的 Collector stdio MCP，对已有 L3 B站搜索
Operation 完成了安全幂等对账、终态解释和有界 Artifact provenance 输出。

这证明 Agent Host 可以保持自己的模型、认证、推理和最终输出，同时只通过 Skills + thin MCP
使用 Collector Core。它不证明全部四个官方 Skill 都已通过 L4，也不把 Codex 或任何模型
provider 变成本仓库的运行时依赖。

## Agent 与隔离边界

- Agent Host：`codex-cli 0.144.4`；mode：`exec --ephemeral`；turn：1；
- Agent 的宿主 provider、模型和认证继续由用户级 Codex 配置拥有，没有复制、解析、提交或写入
  本仓库；
- 工作目录是空的临时目录，Agent 看不到仓库中的 L3 证据文档；
- `shell_tool`、web search、multi-agent、Apps、remote plugin、memories、goals 与 hooks 均关闭；
- 用户级非 Collector MCP 在 session 启动前按名称全部禁用；
- Collector MCP 只暴露 `collector_bilibili_native_search` 一个 Tool；
- MCP 使用临时安装的当前 package；Agent 结束后临时 package、Skill 快照与 workspace 删除；
- Core token 只通过 Agent Host 到 stdio MCP 的命名环境变量转发，不进入 prompt、Skill、Agent
  output 或 trace 摘要。

宿主原有高推理/高冗余设置只在本次确定性 canary session 内覆盖为 `low/low`，未修改用户全局
配置，也未在仓库中指定 model 或 provider。

## 精确 Skill pins

session 启动前，harness 将以下两个 package 复制到临时快照，重新执行
`sha256-skill-package-v1` 校验，并通过 `skills.config` 只启用快照路径：

| Skill | Version | Digest |
| --- | --- | --- |
| `use-collector-mcp` | `0.1.0` | `sha256:138aa97b0c588538f25daf273c27f61d5397ae9b67b86e6638926bfa0fd49563` |
| `collect-bilibili` | `0.1.0` | `sha256:9ed4641eb0cda7f5844cec27fe9896e754e93d914361f97dc03d3abc37e66796` |

prompt 显式调用 `$use-collector-mcp` 与 `$collect-bilibili`。session 期间不热切换 Skill，不从
第三方仓库或全局 Skill 覆盖这两个包。

## 成功 run

- run ID：`7a492acd-a1f7-4c4f-912e-d47c8e573d62`；
- started：`2026-08-03T12:58:39.595Z`；finished：`2026-08-03T12:59:56.240Z`；
- Agent turn：1；目标 Tool call：1；Agent 自动重启：0；
- `clientRequestId`：`fdddcb3c-26f0-4d92-900a-49c9a232572b`；
- returned `idempotentReplay=true`；
- Operation ID：`a20b1a96-22b7-45a8-804a-45074526a87a`；
- Artifact ID：`b7e86d3c-98c6-4100-9178-2ab45d63c527`；
- 新 Core Operation：0；预期新增平台动作：0。

Artifact 的预期 SHA-256 与 byte length 只存在于外层 harness 环境，没有放入 Agent prompt、空
workspace 或 pinned Skills。Agent 必须读取真实 MCP Artifact Resources 才能给出通过外层比较器
的值。

## Agent trace

去敏 JSONL trace 证明：

- `thread.started=1`、`turn.started=1`、`turn.completed=1`；
- 目标 typed Tool 的唯一 call identity 数量为 1；
- 读取了 `collector://release`；
- 读取了 `collector://capabilities`；
- 读取了 `collector://bindings`；
- 读取了精确 Operation Resource；
- 先读取精确 Artifact metadata Resource；
- 再读取 `chunks/0`，没有读取下一 chunk；
- error category 为空；raw Agent trace 未输出或提交。

## Agent 解释与 provenance

- Core release：`0.7.17`；service schema：`3`；Tool catalog：`collector.mcp.tools/v1`；
- 唯一在线 binding：1；session alias：`binding-1`；
- capability：`bilibili.native_search`；
- exact terminal：`completed / search_ready`；error code：`null`；
- Artifact byte length：`12816`；
- Artifact SHA-256：
  `sha256:9b2a5d78f6f61cb35f25b8bd7e8a0a63e6d37467d401020b5a7dc3b5a6f4ed20`；
- captured at：`2026-08-03T12:11:48.814Z`；terminal status：`completed`；
- chunk range：`[0, 12816)` / total `12816`；
- chunk SHA-256 与 Artifact SHA-256 相同；`truncated=false`；`nextCursor=null`；
- `contentExposed=false`；Agent output 与 harness 输出均未包含 Artifact 正文。

## 预检修复与动作账本

正式成功前发现并修正了四类 Agent Host/harness 问题：忽略用户配置会错误移除宿主 provider、
严格配置会被用户配置中的旧字段阻断、外部 provider 要求 `const` JSON Schema 同时声明
`type`，以及 Skill pin 比较不能依赖 JSON 对象字段顺序。另一次已完整完成 Tool/Resource 链的
session 因宿主默认 `max/high` 在 300 秒 finalization 截止前未结束，促使本 canary 使用适合
确定性对账的 `low/low`。

发生在 Agent thread 或 MCP 之前的失败，其 Tool/Resource 计数均为 0。进入 MCP 的预检 run
始终复用同一个 `clientRequestId`；Core 返回同一个 Operation 的幂等 replay，没有创建第二个
平台 Operation。harness 内没有自动 Agent 重启、Tool 重试或 request ID 替换。

## Checkpoint 含义

Checkpoint 5 的四个必需部分已经完成：官方 Skills、真实 L3、真实 pinned-Skill L4，以及
Skill/Core/MCP parity 与 package digest 门禁。下一阶段是 Checkpoint 6 Windows User Release；
它负责安装、OS credential、Agent Host 配置入口、release hash、SBOM 与 runbook，不在 MCP
中加入 Workflow、模型 provider 或浏览器控制。
