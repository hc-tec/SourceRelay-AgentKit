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

运行 L3 前必须让正式 Core Gateway 与用户日常浏览器中的 production MV3 保持在线，并向
MCP 子进程注入已有的最小 scope Core token。该命令只允许固定的 B站原生搜索 Tool，自动
选择唯一在线 binding alias，只提交一次平台动作；`--execute-live` 是防止误触真实平台的
显式本地 canary 门禁，不属于产品运行配置：

```powershell
$env:COLLECTOR_CORE_TOKEN = '<scoped Core token>'
npm run test:l3 -- --execute-live
```

若进程在 Core 已接受 Operation 后只因本地后置检查中断，不得换新 ID 重采。使用第一次输出的
精确 `clientRequestId`、`operationId` 和 `artifactId` 执行一次幂等对账；Core 必须返回
`idempotentReplay=true` 与同一身份，且不产生第二次平台动作：

```powershell
$env:COLLECTOR_L3_CLIENT_REQUEST_ID = '<original clientRequestId>'
$env:COLLECTOR_L3_EXPECTED_OPERATION_ID = '<original operationId>'
$env:COLLECTOR_L3_EXPECTED_ARTIFACT_ID = '<original artifactId>'
npm run test:l3 -- --reconcile-live
```

L3 不启动、附着或关闭浏览器与 Core，不刷新页面，不重试 Tool 提交，也不输出查询正文或
Artifact 正文。它保留 Gateway 和用户浏览器会话，只关闭自己的 stdio MCP 子进程并清理临时
package consumer。已通过的去敏证据见
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
