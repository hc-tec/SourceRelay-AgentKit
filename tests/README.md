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
