# Project agent instructions

## Priority

- Deliver the current checkpoint's core contract first. Do not spend time on branding, UI, optional
  transports, portability polish, or speculative abstractions while a required boundary is missing.
- Read `docs/architecture/collector-ai-native-target-architecture.md` and the applicable checkpoint
  before changing product structure or runtime behavior.
- Treat the approved MCP + Skills architecture as a hard boundary. Do not reintroduce a shared
  Workflow, Planner, Workspace, Task/Run/Step, KnowledgePack, Analysis, or model-provider layer.

## Text and editing

- Read and write all text as UTF-8. In PowerShell, use `Get-Content -Encoding utf8`; with ripgrep,
  use `rg --encoding utf-8`.
- Use `apply_patch` for source and documentation edits.
- Preserve unrelated dirty-worktree changes. Commit coherent, verified checkpoints promptly.

## Repository boundary

- This repository contains only the thin Collector MCP adapter, versioned Skills, compatibility
  contracts, examples, tests, and Windows installation/configuration.
- Depend only on released Collector Core API/SDK contracts. Never import Core source by relative
  path.
- Never import, launch, proxy, fall back to, or dual-write with `inteligence-apps`. That repository is
  a frozen historical prototype.
- Do not add a model provider, report generator, vector database, business UI, or project database.
- Do not let MCP own Core, browser, binding, Operation, or Artifact lifecycle.

## MCP and capability boundary

- The live Collector Core release/capability/OpenAPI surface is the only runtime capability truth.
- A direct-ready Core capability maps to one strongly typed MCP Tool. Do not expose a generic
  `capability + JSON` Tool as the primary surface.
- Never expose arbitrary URL, selector, script, coordinate, tab/window ID, CDP, DevTools, response
  body, or Network primitives.
- Preserve exact Core Operation state, terminal reason, error code, partial coverage, and outcome
  uncertainty. Never rewrite platform failure as `no_results`.
- Tool submission is at-most-once and asynchronous. Return the Core Operation identity; do not hide a
  multi-step workflow inside one Tool.
- Artifact access is metadata-first and bounded. Never expose arbitrary local file paths.
- Agent-visible data must not contain Core tokens, cookies, profiles, browser identities, secrets, or
  unbounded raw content.

## Skills

- Skills teach methods; they do not grant permissions, execute Tools, own runtime state, or claim that
  a capability is currently available.
- Official Skills require publisher, source, version, digest, compatibility, license, and exact Tool/
  Resource requirements.
- A session pins an exact Skill version/digest. Do not hot-switch instructions during a session.
- Third-party Skills are never installed or trusted implicitly.

## Real-platform validation

- This repository never controls a browser directly. L3/L4 validation must invoke released Core
  capabilities through the real MCP surface.
- Before any live website/browser-extension validation, read the Core reconnaissance skill completely.
  In the current sibling workspace it is
  `..\inteligence\skills\recon-live-web-interactions\SKILL.md`; follow its routed references.
- Do not use platform fixtures, fake XHR, fake Gateway responses, or synthetic page clones as evidence
  of real platform capability. Pure functions and protocol state machines may use unit tests.
- Low-frequency, read-only real-platform actions in project-managed validation contexts are already
  authorized. Ask the user only for indispensable human authentication such as QR scan, password, or
  captcha.
- Do not bypass access controls, captchas, rate limits, paid restrictions, or platform safety measures.
  Do not like, follow, favorite, comment, message, publish, or delete without separate user instruction.

## Verification

- Run `python scripts/verify_repository.py` before every repository-boundary checkpoint commit.
- L1 proves pure contracts only. L2 requires real local processes. L3 requires production MV3 + Core +
  MCP + a registered live capability. L4 requires a real Agent runtime with a pinned Skill.
- Never promote an L1/L2 result into a platform capability claim.
- Keep Python SDK, JavaScript SDK, MCP Tool catalog, and Core direct-ready capability set under an
  automated parity gate once Tools exist.
