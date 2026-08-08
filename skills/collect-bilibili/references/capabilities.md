# Bilibili capability reference

## Tool inputs

| Tool | Required capability fields | Execution target | Primary use |
| --- | --- | --- | --- |
| `collector_bilibili_video_detail` | `canonicalVideoUrl` | fixed internally | One public BV video detail |
| `collector_bilibili_native_search` | `query` | fixed internally | One bounded native search |
| `collector_bilibili_native_search_batch` | `query` | fixed internally | Registered broader multi-page search |
| `collector_bilibili_account_profile` | `canonicalProfileUrl` | fixed internally | Public account profile |
| `collector_bilibili_account_inventory` | `canonicalProfileUrl`, `executionTarget` | `collector_work_tab` or `user_selected_tab` | Public投稿 inventory |
| `collector_bilibili_dynamic` | `canonicalProfileUrl` | fixed internally | Bounded public dynamic feed |
| `collector_bilibili_collection_series_overview` | `canonicalProfileUrl` | fixed internally | Discover stable public series/season IDs |
| `collector_bilibili_collection_series_detail` | `canonicalProfileUrl`, `stableSeriesId`, `listType` | fixed internally | Selected `series` or `season` detail |
| `collector_bilibili_danmaku` | `canonicalVideoUrl` | fixed internally | Public danmaku evidence |
| `collector_bilibili_discussion` | `canonicalVideoUrl` | fixed internally | Public comments/discussion evidence |

Every Tool requires a caller-controlled UUID `clientRequestId`. Browser Tools normally auto-select
the only online binding; provide `bindingAlias` only when the session has multiple online bindings
and the caller has deliberately chosen one. Fixed execution
targets must not be supplied as extra fields.

## Input boundaries

- Keep a search query non-empty and at most 160 characters. Use a human query, not a search URL.
- Keep a BV URL on `www.bilibili.com/video/BV...` without query, fragment, credentials, or alternate
  host.
- Keep a profile URL on `space.bilibili.com/<numeric-uid>` without a subroute, query, or fragment.
- Keep `stableSeriesId` as a positive decimal string and `listType` as `series` or `season`.
- Treat all queue and page budgets as Core-owned. Do not add page counts, delays, scroll counts, or
  interaction plans that the Tool schema does not expose.

## Evidence-directed chains

### Search then selected detail

```text
native search or native search batch
  -> terminal search Artifact
  -> select canonical BV URLs by relevance
  -> video detail
  -> optional discussion or danmaku
```

Do not deepen every result by default. State the selection reason and the number selected before
creating detail Operations.

### Account public-content research

```text
account profile
  + account inventory when投稿 are requested
  + dynamic when recent public activity is requested
  + series overview when structured collections are requested
      -> selected series detail
```

These are separate Operations and may produce separate Artifacts. Preserve each terminal state; do
not merge failed or partial sources into a synthetic completed state.

## Known direct-surface boundary

The current Core catalog may publish `bilibili.transcript` as a migration-bound capability while the
MCP Tool catalog has no corresponding transcript Tool. Re-read `collector://capabilities` before every
subtitle request. A migration-bound capability is not callable and must not be simulated with CDP,
DevTools, arbitrary selectors, or raw response-body access.

When a future direct-ready video-detail contract exposes a bounded `subtitle` projection, read it as
Artifact evidence only after the Operation reaches a terminal state. Preserve `available`, `language`,
`panelVisible`, `segmentCount`, `partial`, and the bounded `segments` fields; distinguish empty,
partial, unavailable, risk-stopped, and failed outcomes.

The current Tool catalog still has no standalone subtitle, article, arbitrary account pagination,
arbitrary sort, arbitrary comments action plan, raw response-body, or browser-control Tool. Re-read
`collector://capabilities` rather than relying on this reference if the catalog changes.
