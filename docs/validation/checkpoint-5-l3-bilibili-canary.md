# Checkpoint 5 L3 B站真实 canary

## 结论

`proved`。2026-08-03，在 Windows 用户日常浏览器中已配对的 production MV3、正式 Collector
Core 0.7.17、打包安装后的 stdio MCP 与真实 MCP client 之间，完成了：

```text
collector_bilibili_native_search
  -> one Core Operation
  -> completed / search_ready
  -> Artifact metadata
  -> one bounded canonical UTF-8 chunk
```

这只证明 `bilibili.native_search` 在这一项真实配置中的 L3 闭环，不外推为全部平台或全部
B站 Tool。后续 L4 已完成，见
[Checkpoint 5 L4 pinned-Skill Agent canary](checkpoint-5-l4-codex-pinned-skill-canary.md)。

## 环境与边界

- Core release：`0.7.17`；service schema：`3`；
- MCP transport：打包安装后的 `stdio`；Tool catalog：`collector.mcp.tools/v1`；
- Tool：`collector_bilibili_native_search`；capability：`bilibili.native_search`；
- Tool input schema digest：
  `sha256:4df1134a927c11dc7b456a9ef7f9c5f80f844b470a80bd728b7115bd231e6c2e`；
- 浏览器模式：用户日常浏览器中的 production MV3；Gateway 不具备浏览器进程控制；
- 前检：2 个已配对 binding，唯一 1 个在线；MCP 只使用 session-local `binding-1`；
- 查询正文没有写入 MCP 日志、canary 输出或本文；固定查询的 UTF-8 SHA-256 为
  `sha256:161332dd5ba244f14566d9ccfc214dbbd620bcd401cded068fc230e3d4e2815b`；
- 未使用浏览器 Profile、Cookie、tab/window ID、selector、脚本、CDP、DevTools 或任意 Network
  接口；未输出 Core token 或 Artifact 正文。

AI Integration 的 L3 职责是验证已经由 Core 登记并真实验证的平台 capability 能否穿过 MCP
合同。它不会越界重新控制浏览器，因此本轮没有截图或独立 DOM/XHR 侦察，也不把本轮当作
新 selector 或平台交互策略的可行性研究。

## 首次真实提交

- run ID：`824f8eff-cfa3-47f2-b071-7cadfdb41e15`；
- `clientRequestId`：`fdddcb3c-26f0-4d92-900a-49c9a232572b`；
- Operation ID：`a20b1a96-22b7-45a8-804a-45074526a87a`；
- Artifact ID：`b7e86d3c-98c6-4100-9178-2ab45d63c527`；
- Tool call：1；自动提交重试：0；新 Core Operation：1；
- queued：`2026-08-03T12:11:21.611Z`；
- claimed：`2026-08-03T12:11:35.787Z`；
- completed：`2026-08-03T12:11:48.814Z`；
- exact Core state：`completed`；terminal reason：`search_ready`；error code：`null`。

首次 harness 已经读完 Artifact metadata 与 chunk，随后只因本地后置日志断言失败而退出：
日志的稳定字段是 `eventType`，harness 错读成了 `event`。这个失败发生在平台 Operation 完成和
Artifact 读取之后；没有换新 ID，也没有自动重放平台动作。

## 幂等对账

修正本地断言后，使用完全相同的 `clientRequestId`、binding、Tool 与 payload 执行一次明确的
reconciliation：

- run ID：`27a2c241-3e78-46a1-823e-b7d1b8d51c9f`；
- `idempotentReplay=true`；
- 返回原 Operation ID 与原 Artifact ID；
- 新 Core Operation：0；预期新增平台动作：0；
- 自动提交重试：0；
- 原 exact Core terminal state 仍为 `completed / search_ready`。

这同时证明了 MCP 保留 caller-owned request ID，Core 的持久幂等身份能够跨 MCP 进程重启
恢复，且本地后置检查失败不会迫使上层重新采集。

## Artifact 证据

- representation：`canonical_json_utf8`；media type：`application/json`；
- byte length：`12816`；
- Artifact SHA-256：
  `sha256:9b2a5d78f6f61cb35f25b8bd7e8a0a63e6d37467d401020b5a7dc3b5a6f4ed20`；
- captured at：`2026-08-03T12:11:48.814Z`；terminal status：`completed`；
- first bounded chunk：`[0, 12816)` / total `12816`；
- chunk SHA-256 与 Artifact SHA-256 相同；`truncated=false`；`nextCursor=null`；
- canary 输出只保留 metadata、range 与 digest，没有输出正文。

## 生命周期与残留

- canary 只关闭自己的 stdio MCP 进程并删除临时 npm package consumer；
- 正式 Gateway 作为长期服务有意保留；
- 用户日常浏览器及其 production MV3 会话有意保留；
- harness 没有启动、附着、切换、刷新、关闭或重启浏览器；
- 没有遇到登录、验证码、限流、风控或平台安全终态；
- 没有执行点赞、关注、收藏、评论、私信、发布或删除等平台写操作。

## 后续门禁（已完成）

L4 必须由真实 Agent runtime 加载精确固定版本与 digest 的官方 Skill，自主发现 capability、选择
Tool、保留 `clientRequestId`、解释 exact terminal state、metadata-first 读取有界 Artifact，并在
caller-owned 输出中保留 provenance。L4 不得把 workflow、模型 provider 或浏览器控制加入 MCP。
该门禁已由上述 L4 证据完成。
