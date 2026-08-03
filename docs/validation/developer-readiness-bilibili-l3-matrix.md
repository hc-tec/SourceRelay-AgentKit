# Bilibili developer-readiness L3 matrix

Date: 2026-08-03  
Status: 9 of 10 typed Bilibili Tools have a real `completed` L3 path; the authenticated discussion
completion path remains pending. This document records evidence, not a blanket availability claim.

## Scope and execution contract

The matrix uses the packaged stdio MCP, released Collector Core `0.7.17`, production MV3, and the
real platform. Each process selects one explicit case, creates at most one new Core Operation, calls
the Tool at most once, polls only the returned Operation, and performs no automatic submission retry.
The output field `newCoreOperationsExpected` deliberately describes Core Operation creation rather
than the number of registered navigations that may occur inside a bounded capability.

Every terminal Artifact below was read metadata-first. The matrix followed only advertised chunk
resource URIs, verified each UTF-8 byte range and chunk SHA-256, and reconstructed the complete
Artifact SHA-256. It did not print input content, Artifact content, browser identities, credentials,
Profile data, or tab identities. Temporary least-privilege Core clients were revoked after use. No
version was bumped for this work.

## Current capability results

| Case | Terminal | Reason | Artifact bytes | Chunks | Artifact SHA-256 | Acceptance |
| --- | --- | --- | ---: | ---: | --- | --- |
| `bilibili.native-search` | `completed` | `search_ready` | 12816 | 1 | `sha256:9b2a5d78f6f61cb35f25b8bd7e8a0a63e6d37467d401020b5a7dc3b5a6f4ed20` | Passed |
| `bilibili.video-detail` | `completed` | `detail_ready` | 4160 | 1 | `sha256:77f241b44d9f81697b0d5d307e639aa82756b579338601fc76cbf500ec453d42` | Passed |
| `bilibili.native-search-batch` | `completed` | `search_batch_ready` | 13375 | 1 | `sha256:6857a1c4b9211ff1d32e2b5026ca878509bd2a885e7ceff71b56e2ec314d4e3a` | Passed |
| `bilibili.account-profile` | `completed` | `profile_ready` | 3513 | 1 | `sha256:1dfd629bc6c1bd433bb0df644010b60552e844e6cc0d9db92c223051e6f7e3c5` | Passed |
| `bilibili.account-inventory` | `completed` | `inventory_ready` | 18752 | 2 | `sha256:5524befe722ae9c697ab072d3958715ead51b7bb649fe90d45ffbf16cc5c1b86` | Passed; real multi-chunk path proved |
| `bilibili.dynamic` | `completed` | `dynamic_ready` | 12427 | 1 | `sha256:adf461ef3d62fffdb670c7d119e5ba70ff48e5b074fad45881c930180f240ece` | Passed |
| `bilibili.collection-series-overview` | `completed` | `collection_series_overview_ready` | 3343 | 1 | `sha256:407e07f34923f733654f1b4e69506da1de9a107880aced8ae53160cc1c12593b` | Passed on isolated validation binding |
| `bilibili.collection-series-detail` | `completed` | `collection_series_detail_ready` | 2423 | 1 | `sha256:7ed3eb5b6ec11775c6e5c292b6ac07d6be611c7ff6c32e7e75fbce475f99a306` | Passed with an overview-derived season ID |
| `bilibili.danmaku` | `completed` | `danmaku_ready` | 1560 | 1 | `sha256:d4cf4e89cd37086d5bb1cfe4a2352d04e4253b63428ea9224d884eed6efdf359` | Passed on isolated validation binding |
| `bilibili.discussion` | `stopped` | `login_required` | 2344 | 1 | `sha256:09b89b01492b9906f7057e62727becc0bb861d6f7c98a490084ff0040144c07b` | Safe terminal passed; authenticated completion pending |

## Exact completed provenance

| Case | Client request | Operation | Artifact |
| --- | --- | --- | --- |
| `bilibili.video-detail` | `68edbbd8-5238-4e8d-b082-3650755ad12e` | `775258bb-8322-4111-a441-7e12c44bb118` | `f0211d92-4172-468d-b515-57550f5956a0` |
| `bilibili.account-profile` | `2b09f228-ce6e-4de5-9716-44dcbc6429b9` | `23e8f829-c105-4f44-95c6-3cb29efd6266` | `61ac26f3-4dbf-408e-8a6e-a939c3dcce66` |
| `bilibili.dynamic` | `6a2ac826-4840-46c1-b540-3a1fec97807a` | `81e2a3e6-f9be-4eb2-b918-b7c2695dad66` | `40f6ba86-3219-4f54-b535-4b1c1a3e1138` |
| `bilibili.account-inventory` | `1abf585a-3b00-474b-8a26-d3eb5c9e10d5` | `13e7eaba-9005-416b-bd40-83c463acfd67` | `a54d682b-dd4d-4c58-bbf2-15bdd12901f3` |
| `bilibili.collection-series-overview` | `d9444983-87bd-44be-a231-a522097ba8b7` | `e0e89f5f-3dbc-406d-af89-ff48952966bd` | `47034e79-4b14-48e8-a119-5c499bc60e63` |
| `bilibili.collection-series-detail` | `dbd62f32-c908-47ef-9faa-508158625e16` | `6b05a05a-8281-47df-8002-62c730b34642` | `9295244c-2582-4360-8ea2-e537e5483057` |
| `bilibili.native-search-batch` | `da33f884-bdc9-4d74-8e0c-3cbeec528038` | `f4c57e73-6110-4f63-928f-2b8897bb354f` | `4b76f0b3-5ce0-4852-90df-cfa3e54ff49a` |
| `bilibili.danmaku` | `1cd0a400-de13-437d-b2aa-7e715ed0b6ea` | `c421ecef-d94d-4cf7-b63a-d53fe58b46f6` | `32d90838-bd54-4b8d-9f86-3ff7addf0104` |

The inventory Artifact proved the real 16 KiB Resource window:

```text
chunk 0:     [0, 16384), truncated=true, nextCursor=16384
chunk 16384: [16384, 18752), truncated=false, nextCursor=null
verified total bytes: 18752
reconstructed SHA-256 == metadata SHA-256
```

## Overview-to-detail evidence chain

The completed overview Artifact exposed three stable public seasons. The caller selected the smallest
declared collection to minimize platform load; no identity was guessed from display text.

| Stable ID | Type | Declared items | Use |
| --- | --- | ---: | --- |
| `1848225` | `season` | 6 | Selected for detail validation |
| `2904` | `season` | 25 | Not deepened |
| `333822` | `season` | 165 | Not deepened |

The subsequent detail Tool used `1848225 / season` and completed once. This proves the intended typed
chain: overview Artifact evidence, caller-owned selection, then one separate detail Operation.

## Safety and non-success evidence

### Daily-browser foreground takeover

Collection overview first failed on the daily-browser binding. The latest instrumented terminal was:

```text
clientRequestId: f285622a-9f55-4ae1-9d18-d28b33249c55
operationId:     bf045aac-af2b-4c50-8c6e-aa7906366936
artifactId:      3d462cd6-c8a6-4674-8e7d-a106d0efaebd
coreState:       failed
terminalReason:  work_tab_user_taken_over
workTabLossCause: another_tab_activated
byteLength:      1359
sha256:          sha256:a9c2b9e254d8cc31453ba2e79fa3f0f4eaa67522a03c967d5a15af3ef519cc60
```

The exact loss cause excludes URL drift, work-tab closure or movement, duplicate activation, and a
silent foreground-to-background transition. An independent anonymous headed reconnaissance run
opened the public collection page once without the production extension: DOM was `visible/complete`,
the browser retained one tab, and the public collection route returned `200`. Therefore an unrelated
tab or extension in the daily window performed a real activation. The daily binding remains manually
locked; the takeover rule was not weakened. The same overview capability then completed on the quiet
isolated validation binding, proving the capability without hiding the daily-browser contention fact.

### Admission rejection while locked

A new request against the locked binding was rejected before an Operation or platform navigation was
created. The packaged MCP exposed both stable levels:

```text
error: submission_conflict
coreErrorCode: browser_binding_safety_manual_unlock_required
clientRequestId: a3e89333-90eb-4427-a204-1641625176a1
```

### Discussion login boundary

The unauthenticated discussion run terminated once as a truthful safety stop:

```text
clientRequestId: cdd2ee76-13c0-435f-bc6e-56e0cf8b12ba
operationId:     6d0b7a1b-bf9b-4f94-be00-9821421403a7
artifactId:      c8ae3505-36f1-4d86-b72b-f16342de5325
coreState:       stopped
terminalReason:  login_required
errorCode:       bilibili_login_required
byteLength:      2344
sha256:          sha256:09b89b01492b9906f7057e62727becc0bb861d6f7c98a490084ff0040144c07b
```

The Operation, metadata-first Artifact path, chunk verification, whole hash, and no-retry behavior all
passed. This does not count as a completed discussion capability. A new request may be run once only
after the user authenticates the isolated validation browser.

## Remaining acceptance work

1. Complete one authenticated `bilibili.discussion` run in the already-running isolated validation
   browser. Preserve any `completed`, `partial`, `stopped`, or `failed` terminal exactly.
2. Run repository verification and secret scanning, then commit this coherent L3 checkpoint.
3. Replace stale Bilibili-readiness wording elsewhere only after discussion has a truthful terminal.
4. Start the Xiaohongshu typed Tool matrix only after reading and applying its stricter no-refresh,
   no-arbitrary-new-document, overlay, and Network-first constraints.

Raw Artifact content, screenshots, browser Profiles, service credentials, and tab identities are not
committed.
