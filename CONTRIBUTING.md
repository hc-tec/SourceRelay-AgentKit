# Contributing

Collector AI Integration is intentionally narrow. Contributions are accepted only when they preserve
the approved boundary: thin MCP adapter + versioned Skills over the released Collector Core contract.

## Before changing code or contracts

1. Read [the target architecture](docs/architecture/collector-ai-native-target-architecture.md).
2. Identify the active migration checkpoint.
3. Confirm the change belongs to this repository rather than Collector Core or a consumer application.
4. Confirm it does not depend on the frozen `inteligence-apps` prototype.
5. Define the validation level the change can honestly prove.

## Checkpoint discipline

- Checkpoint 2 contains repository/contracts/tests only; no executable MCP runtime or official Skill.
- Checkpoint 3 is complete: the thin stdio protocol/Resource foundation is frozen by ADR-0001 and L1/L2.
- Checkpoint 4 adds direct capability Tool parity, not hidden convenience capabilities.
- Checkpoint 5 adds official Skills and real L3/L4 canaries.
- Checkpoint 6 adds the supported Windows user release.

Do not combine multiple checkpoints into one large commit. Do not add compatibility adapters for the
old Task/Analysis API, port 43128, KnowledgePack builders, or model consumers.

## Required boundaries

Changes must not add:

- Workflow, Planner, Workspace, Task/Run/Step, KnowledgePack, or Analysis services;
- arbitrary browser, URL, selector, script, tab, CDP, DevTools, or Network tools;
- direct browser Profile or credential access;
- a model provider or Agent framework runtime dependency;
- Core source-tree imports or `inteligence-apps` runtime dependencies;
- fake-platform evidence presented as a real canary;
- Tool/Resource/log fields that expose secrets or unbounded content.

## Verification

Run the foundation gate:

```powershell
python .\scripts\verify_repository.py
```

When runtime code exists, add the narrowest applicable layer:

- L1: pure schemas, compatibility, redaction, URI/range, idempotency and Skill metadata;
- L2: packaged MCP + released Core + real transport/auth, with zero platform requests allowed;
- L3: production extension + Core + MCP + real client + registered platform capability;
- L4: real Agent runtime + pinned Skill + provenance-preserving output.

No fake page, fake XHR, or fake Gateway result can satisfy L3 or L4.

## Commit hygiene

- Keep text UTF-8 and run `git diff --check`.
- Scan staged content for credentials and local runtime artifacts.
- Preserve unrelated worktree changes.
- Make one coherent, verified commit per checkpoint or contract increment.
- Describe what was proven and what remains unverified.
