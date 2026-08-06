# Agent-facing prerequisite simplification

## Decision

The MCP surface remains a typed, asynchronous adapter. It does not gain a Workflow, Planner,
swarm, arbitrary browser-control API, or platform bypass. Low-level session preparation that can be
resolved without changing platform state belongs inside the MCP/Core adapter instead of in a Skill.

## Implemented in this checkpoint

### Browser binding selection

Browser Provider Tools now accept an optional `bindingAlias`.

- When the live binding projection contains exactly one `online` binding, AgentKit refreshes the
  safe projection at submission time and selects it automatically.
- When there is no online binding, the Tool returns `binding_unavailable` without a Core POST.
- When multiple bindings are online, the Tool returns `binding_selection_required` without guessing.
- Explicit aliases remain supported for callers that intentionally choose a session.

The Core browser-binding ID, extension ID, Profile, Cookie, tab ID, and storage state never enter the
AI-visible result or logs.

### Operation handling hint

Operation Resources retain the exact Core state, terminal reason, error code, and Artifact identity.
They additionally expose a non-authoritative `recommendedAction`:

- `poll_operation` for `queued` / `claimed`;
- `read_artifact` for `completed` / `partial`;
- `continue_other_sources` for an unavailable independent source or missing public context;
- `stop_platform_action` for login, verification, rate-limit, or permission stops;
- `reconcile_submission` for an uncertain submission;
- `preserve_terminal` for other terminal facts.

This is a handling hint, not a status rewrite. The caller must still preserve the exact Core facts.

### Skill behavior

The Foundation, Xiaohongshu, Zhihu, and search-then-detail Skills no longer make binding selection,
Explore-tab preparation, or a single provider's credential readiness a hidden workflow. A Skill makes
one typed call, records the exact gap, and lets the caller continue independent sources. It never asks
for platform credentials or falls back from the Zhihu Official Provider to browser collection.

For Xiaohongshu specifically, the no-refresh/no-page-initiated-new-document boundary is preserved,
but the old "pre-open Explore" prerequisite is removed. A search call creates or reuses one
Collector-managed work tab and may enter only the fixed official
`https://www.xiaohongshu.com/explore` surface once. The Agent still cannot supply a URL, tab ID,
selector, or navigation plan. A successful run releases the tab as `idle_reusable`; an uncertain or
risk-stopped run retains it for inspection and marks it non-reusable. The legacy
`existing_public_explore_tab_required` terminal remains only for the internal canary path.

## Deliberately deferred

The current catalog exposes public image/thumbnail URLs as data but does not expose a media Artifact
capture Tool. A future media MVP must accept only a Core-issued `assetRef` from a verified Artifact,
allowlist the platform/source capability, capture into a Core-managed Artifact, and return media type,
byte length, SHA-256, provenance, and retention metadata. It must not accept arbitrary URLs or put
OCR/vision analysis into Core. This requires a separate Core contract and a real browser/provider
validation run; it is not folded into this prerequisite cleanup.

## Verification

- AgentKit `npm run test:l1`: 45 tests passed.
- AgentKit `npm run verify:skills`: all five official Skill digests passed.
- No browser credential, platform token, or Artifact body was added to source, logs, or Git.
