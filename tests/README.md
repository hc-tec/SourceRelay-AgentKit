# Test layers

当前套件覆盖 repository boundary、MCP L1 与 real-process L2。它验证 truthful manifest、UTF-8、
依赖/包边界、compatibility digest、URI/range、credential/log redaction、只读 Resource 投影，以及
打包 MCP 通过 stdio 连接真实 Core。它不证明任何平台能力。

Future verification layers remain distinct:

- L1 — pure schemas, compatibility, URI/range, redaction, idempotency, Skill metadata;
- L2 — packaged MCP + released Core + real transport/auth and process lifecycle;
- L3 — production MV3 + Core + MCP + real client + registered live platform capability;
- L4 — real Agent runtime + pinned Skill + provenance-preserving outcome.

运行 repository + L1：

```powershell
python .\scripts\verify_repository.py
npm run test:l1
```

运行 L2（Core entrypoint 必须来自发布/已构建的真实 Core，而不是 fake server）：

```powershell
$env:COLLECTOR_L2_CORE_ENTRYPOINT = '<released Core user-browser-server.js>'
npm run test:l2
```

验证用户体验入口（真实本地 Core + 一次性临时 scoped credential + `collector-agent mcp` stdio
launcher）：

```powershell
$env:COLLECTOR_L2_CORE_ENTRYPOINT = '<released Core user-browser-server.js>'
npm run test:l2:launcher
```

该门禁只验证 AgentKit launcher 能把本机 credential store 接到真实 Core/MCP 初始化，不创建
平台 Operation，也不接触用户日常浏览器。它会在临时 loopback 端口启动自己管理的 Core，结束时
清理临时进程和凭据。

运行 L3 前必须让正式 Core Gateway 与用户日常浏览器中的 production MV3 保持在线，并向
MCP 子进程注入已有的最小 scope Core token。先列出已登记 case；该命令只做本地构建与列表，
不会创建平台 Operation：

```powershell
npm run test:l3 -- --list
```

每个真实进程必须显式指定一个 case 和 `--execute-live`。以下命令只执行一次视频详情 Tool；
运行器会在提交前输出 caller-owned `clientRequestId`，按实时 Tool schema 校验输入，自动选择
唯一在线 binding alias，且不会自动重试：

```powershell
$env:COLLECTOR_CORE_TOKEN = '<scoped Core token>'
npm run test:l3 -- --case bilibili.video-detail --execute-live
```

Official Provider 的隔离 L3 可以把正式发布 Core 启动在随机 loopback 端口，避免接管默认的
`43127` Gateway。只有同时显式设置 `COLLECTOR_L3_ALLOW_ISOLATED_CORE=true` 时，运行器才接受
`http://127.0.0.1:<port>`；它仍拒绝非 loopback、HTTPS、路径、query 和 fragment。Browser
Provider 的隔离验证还必须满足各自的真实浏览器/Profile 前置条件。

Official Provider 的 Tool 不需要 `collector://bindings`。先从实时
`collector://capabilities` 确认对应能力的 `runtimeState=ready`；若为
`credential_required`，AgentKit MCP 会在 Core POST 前返回
`official_provider_credential_required` 及 Gateway 配置动作，不请求平台 Secret，也不改走
浏览器。L2 无凭证 Core 会用这一 fail-closed 分支验证该边界；L3 ready 路径才允许真实官方
只读请求。

系列详情不能猜 ID。先单独运行 `bilibili.collection-series-overview`，从其真实 Artifact 中选定
公开的稳定 ID/type，再为下一独立 run 提供：

```powershell
$env:COLLECTOR_L3_BILIBILI_SERIES_ID = '<ID from overview Artifact>'
$env:COLLECTOR_L3_BILIBILI_SERIES_TYPE = 'series' # or season
npm run test:l3 -- --case bilibili.collection-series-detail --execute-live
```

若进程在 Core 已接受 Operation 后只因本地后置检查中断，不得换新 ID 重采。使用第一次输出的
精确 `clientRequestId`、`operationId` 和 `artifactId`，对同一个 case 执行一次幂等对账；Core
必须返回 `idempotentReplay=true` 与同一身份，且不产生第二次平台动作：

```powershell
$env:COLLECTOR_L3_CLIENT_REQUEST_ID = '<original clientRequestId>'
$env:COLLECTOR_L3_EXPECTED_OPERATION_ID = '<original operationId>'
$env:COLLECTOR_L3_EXPECTED_ARTIFACT_ID = '<original artifactId>'
npm run test:l3 -- --case bilibili.video-detail --reconcile-live
```

L3 矩阵不启动、附着或关闭浏览器与 Core，不刷新页面，每个进程最多调用一次 Tool，也不输出
查询、URL 或 Artifact 正文。它先读 Artifact metadata，再严格跟随每个 `nextChunkResourceUri`，
复算所有 chunk 与整件 Artifact SHA-256；随后保留 Gateway 和用户浏览器，只关闭自己的 stdio
MCP 子进程并清理临时 package consumer。已通过的最初搜索 canary 去敏证据见
[Checkpoint 5 L3 B站 canary](../docs/validation/checkpoint-5-l3-bilibili-canary.md)。

运行 L4 必须复用一个已经完成的 L3 request identity，不得生成新 ID。harness 会把两个官方
Skill 复制到临时快照、重新校验 package digest，用 `skills.config` 固定快照路径，再启动真实
`codex exec --ephemeral` Agent。Agent 只看到一个 Collector Tool，工作目录为空，shell、web
search 与 multi-agent 均关闭；Artifact 的预期 hash/大小只属于外层 harness，不进入 Agent
prompt：

```powershell
$env:COLLECTOR_CORE_TOKEN = '<scoped Core token>'
$env:COLLECTOR_L4_CLIENT_REQUEST_ID = '<completed L3 clientRequestId>'
$env:COLLECTOR_L4_EXPECTED_OPERATION_ID = '<completed L3 operationId>'
$env:COLLECTOR_L4_EXPECTED_ARTIFACT_ID = '<completed L3 artifactId>'
$env:COLLECTOR_L4_EXPECTED_ARTIFACT_SHA256 = '<completed L3 Artifact SHA-256>'
$env:COLLECTOR_L4_EXPECTED_ARTIFACT_BYTES = '<completed L3 Artifact byte length>'
npm run test:l4 -- --reconcile-live
```

L4 Agent 必须显式使用 `$use-collector-mcp` 与 `$collect-bilibili`，读取实时 release、capabilities
和 bindings，恰好调用一次 typed Tool，并取得 `idempotentReplay=true`。随后它要解释 exact
Operation terminal state、metadata-first 读取 Artifact 与一个 bounded chunk，并只返回去敏
provenance JSON。外层 harness 会独立校验 Skill pins、Agent Tool trace 和未提供给 Agent 的
Artifact hash/大小；失败不会自动重启 Agent 或换新 request ID。

已通过的去敏证据见
[Checkpoint 5 L4 pinned-Skill Agent canary](../docs/validation/checkpoint-5-l4-codex-pinned-skill-canary.md)。
