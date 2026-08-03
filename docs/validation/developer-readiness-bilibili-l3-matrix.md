# Bilibili developer-readiness L3 matrix

Date: 2026-08-03  
Status: in progress; this document records evidence, not a blanket support claim.

## Scope and execution contract

The matrix uses the packaged stdio MCP, released Collector Core `0.7.17`, the production MV3 in the
user-owned browser, one unique online binding alias, one explicit case per process, and at most one
Tool submission per process. It never retries a Tool submission, starts or controls the browser, or
prints input content or Artifact content.

Every terminal Artifact below was read metadata-first. Each advertised chunk cursor, byte range and
chunk SHA-256 was verified, followed by reconstruction of the complete Artifact SHA-256. Temporary
scoped Core clients were revoked after each process. No version was bumped for matrix work.

## Current capability results

| Case | Terminal | Reason | Artifact bytes | Chunks | Artifact SHA-256 | Status |
| --- | --- | --- | ---: | ---: | --- | --- |
| `bilibili.native-search` | `completed` | `search_ready` | 12816 | 1 | `sha256:9b2a5d78f6f61cb35f25b8bd7e8a0a63e6d37467d401020b5a7dc3b5a6f4ed20` | Existing L3 evidence passed |
| `bilibili.video-detail` | `completed` | `detail_ready` | 4160 | 1 | `sha256:77f241b44d9f81697b0d5d307e639aa82756b579338601fc76cbf500ec453d42` | Passed in reusable matrix |
| `bilibili.account-profile` | `completed` | `profile_ready` | 3513 | 1 | `sha256:1dfd629bc6c1bd433bb0df644010b60552e844e6cc0d9db92c223051e6f7e3c5` | Passed in reusable matrix |
| `bilibili.dynamic` | `completed` | `dynamic_ready` | 12427 | 1 | `sha256:adf461ef3d62fffdb670c7d119e5ba70ff48e5b074fad45881c930180f240ece` | Passed in reusable matrix |
| `bilibili.account-inventory` | `completed` | `inventory_ready` | 18752 | 2 | `sha256:5524befe722ae9c697ab072d3958715ead51b7bb649fe90d45ffbf16cc5c1b86` | Passed; real multi-chunk path proved |
| `bilibili.collection-series-overview` | `failed` | `work_tab_user_taken_over` | 1358 / 1359 | 1 | See terminal Operations below | Not passed; stopped after two independent takeover terminals |
| `bilibili.collection-series-detail` | — | — | — | — | — | Blocked on a real overview-derived series identity |
| `bilibili.native-search-batch` | — | — | — | — | — | Pending |
| `bilibili.discussion` | — | — | — | — | — | Pending |
| `bilibili.danmaku` | — | — | — | — | — | Pending; lowest priority in this matrix |

## Exact passed provenance

| Case | Client request | Operation | Artifact |
| --- | --- | --- | --- |
| `bilibili.video-detail` | `68edbbd8-5238-4e8d-b082-3650755ad12e` | `775258bb-8322-4111-a441-7e12c44bb118` | `f0211d92-4172-468d-b515-57550f5956a0` |
| `bilibili.account-profile` | `2b09f228-ce6e-4de5-9716-44dcbc6429b9` | `23e8f829-c105-4f44-95c6-3cb29efd6266` | `61ac26f3-4dbf-408e-8a6e-a939c3dcce66` |
| `bilibili.dynamic` | `6a2ac826-4840-46c1-b540-3a1fec97807a` | `81e2a3e6-f9be-4eb2-b918-b7c2695dad66` | `40f6ba86-3219-4f54-b535-4b1c1a3e1138` |
| `bilibili.account-inventory` | `1abf585a-3b00-474b-8a26-d3eb5c9e10d5` | `13e7eaba-9005-416b-bd40-83c463acfd67` | `a54d682b-dd4d-4c58-bbf2-15bdd12901f3` |

The inventory Artifact proved the real 16 KiB Resource window:

```text
chunk 0:     [0, 16384), truncated=true, nextCursor=16384
chunk 16384: [16384, 18752), truncated=false, nextCursor=null
verified total bytes: 18752
reconstructed SHA-256 == metadata SHA-256
```

## Failure and safety evidence

The first video-detail run terminated as `failed/work_tab_user_taken_over`. Reconciliation with the
same request identity returned `idempotentReplay=true`, the same Operation and the same Artifact, and
created zero new platform actions. A work-tab activation-state regression was fixed in Collector Core
commit `f46d32a`; extension unit/build/load gates and the Core unit suite then passed, followed by the
successful video-detail run recorded above.

The locked binding then rejected a new submission before platform work. Gateway logs reported the
safe Core code `browser_binding_safety_manual_unlock_required`; this is a useful non-success admission
path and exposed that the matrix output must preserve MCP protocol `data.coreErrorCode` in addition to
the stable `submission_conflict` category. After that projection was implemented, a real locked-binding
request (`a3e89333-90eb-4427-a204-1641625176a1`) returned both values through the packaged MCP while
accepting no Operation and creating no platform navigation.

Collection overview produced two separate `failed/work_tab_user_taken_over` terminals and was not
automatically retried again:

| Client request | Operation | Artifact | Bytes | SHA-256 |
| --- | --- | --- | --- | ---: | --- |
| `ed1995fa-206c-4f7c-87fd-7f741e4d50db` | `47c5d0e7-ec0d-4820-ae8f-1094388f8642` | `685a965b-c7d5-4c2f-8382-30b7f4fa047d` | 1358 | `sha256:8f2662695211c597dc900bdf7bc4d1520046e7c5626d490318222e6bed150a23` |
| `f1bf7a80-e721-4974-b0b7-8928b8ba1941` | `426883b8-8eec-4bdf-8901-104b016aed64` | `f364c553-ac6f-4843-bdb2-7f6f098eb15c` | 1359 | `sha256:ce7889837dee64a8190dfea206c78124910f8492a952484073a3663ca6e508ed` |

A separate anonymous headed reconnaissance run opened the public canonical `/7481602/lists` page
once without the production extension. Visual evidence showed the public collection list; DOM state
was `visible/complete`; the browser retained exactly one tab; and the fixed public route
`GET /x/polymer/web-space/seasons_series_list` returned `200`. Therefore the page itself did not open
or activate another tab. The production safety stop remains truthful; further host-browser attempts
require a quiet foreground window or stronger extension-side loss-cause telemetry.

## Remaining acceptance work

1. Resolve or positively classify collection-overview foreground takeover without repeated platform
   attempts.
2. Derive a real stable series/season identity only from a completed overview Artifact, then run detail.
3. Run native search batch and use its Artifact as another natural multi-chunk candidate.
4. Run discussion, then danmaku.
5. After the Bilibili matrix is stable, add Xiaohongshu cases under its stricter no-refresh/no-new-
   document constraints.

Raw Artifact content, screenshots, browser Profiles and service credentials are not committed.
