# Xiaohongshu developer-readiness L3 matrix

Date: 2026-08-04
Status: all five typed Xiaohongshu Tools have a real `completed` L3 path. This document records exact
evidence and the page-state contract that an upper-layer developer must preserve; it is not a claim
that every arbitrary Xiaohongshu page state is collectable.

## Scope and execution contract

The matrix used the packaged stdio MCP, Collector Core `0.7.17` with service schema `3`, production
MV3 control-surface revision `16`, a paired isolated validation browser, and the real Xiaohongshu
website. The final post-fix extension build fingerprint used by the completed search, detail, and
account Operations was:

```text
631e8a778a7efa8be00341fd52339946b245198f84e20581359e7ab8817be630
```

The completed comments and replies evidence was captured immediately beforehand on production build
fingerprint `769a7810f8ab84bb087efc7d036a2519a1e0da6bbfd0e18a5eb40a127a186d47`.
The only intervening platform-execution source change was the account-specific note-overlay author
target module in Core commit `5945930`; comments and replies code did not change, and the final Core
gate passed all 99 test files and 345 tests. Those two already-proved public discussion actions were
therefore not repeated merely to make the build fingerprints identical.

Each L3 process selected one explicit case, generated a new caller-owned `clientRequestId`, submitted
one typed Tool at most once, and polled only its returned Operation. There were no automatic Tool
submission retries. Each process received a newly issued least-privilege local Core client with only:

```text
browser-bindings:read
collect:execute
operations:read
artifacts:read
```

Every temporary client was revoked in `finally`; the final audit found zero active `l3-xhs-*`
clients. The production Gateway and validation browser were retained after each Operation.

Every terminal Artifact was read metadata-first. The matrix followed only advertised chunk Resource
URIs, verified every UTF-8 range and chunk SHA-256, and reconstructed the complete Artifact SHA-256.
It did not print query content, Artifact content, browser identities, credentials, Profile data, tab
identities, signed profile URLs, or Network response URLs.

## Completed capability matrix

| Case | Terminal | Reason | Artifact bytes | Chunks | Artifact SHA-256 | Live data path |
| --- | --- | --- | ---: | ---: | --- | --- |
| `xiaohongshu.public-notes-search` | `completed` | `search_ready` | 5577 | 1 | `sha256:444880be31088da22dbb8fa1677d7ca0059af01e527918a39e455a58d7b9a0fe` | Network projection; 17 bounded public cards |
| `xiaohongshu.note-public-detail` | `completed` | `note_detail_ready` | 4371 | 1 | `sha256:1ffebd84d88b4c995cdf5ee205f9f14315ec8d310b6e9da5b17a56e8f6b78683` | Same-document overlay with DOM fallback |
| `xiaohongshu.note-public-comments` | `completed` | `note_comments_ready` | 11135 | 1 | `sha256:2ccfa9b716c28172c0df312e1473b1528410cbabaaa1bd64578a87eacbad1320` | Hybrid Network/DOM projection; 37 bounded public comments |
| `xiaohongshu.note-public-comment-replies` | `completed` | `comment_replies_ready` | 1869 | 1 | `sha256:c57d30aef67fcb45ac70f7f83c15f6146a9325c948703d137e1677d21e69734a` | Network projection; one bounded public reply |
| `xiaohongshu.account-public-notes` | `completed` | `profile_notes_ready` | 7019 | 1 | `sha256:dd87e541da9a4ace43e358c9d2575576567ba0921c3c7aa164970e54b9430bb7` | Visible note-author discovery; 30 bounded public cards through DOM fallback |

All five Operations exposed the state sequence:

```text
queued -> claimed -> completed
```

No case was rewritten from a stopped, partial, or failed state into apparent success.

## Exact completed provenance

| Case | Client request | Operation | Artifact |
| --- | --- | --- | --- |
| `xiaohongshu.public-notes-search` | `6e693371-0951-440e-88a7-8cbaf156c0d7` | `e80f967f-a984-4c27-99f3-d9fe71072b38` | `eea7bd7b-5d34-44ba-84b6-4dec90992666` |
| `xiaohongshu.note-public-detail` | `af8d9d17-20e3-4286-b5bd-a538b5452605` | `6a908257-e95d-4874-a94f-d0d3675f430b` | `49c82735-6a64-4ae8-8ab1-4d8e2e1dbbe9` |
| `xiaohongshu.note-public-comments` | `a0713ddc-d051-4c9c-8712-20c7616b9596` | `d8362dbd-35b8-47c8-b50c-674b6f1e29af` | `b3c12bca-a9af-4215-83bd-32ddf881fd23` |
| `xiaohongshu.note-public-comment-replies` | `2c62735d-c2af-4878-b783-e1943b3cf7f5` | `27fe8232-c753-4ad5-8961-8fab968f0af7` | `88891659-eeaf-400c-a9c9-036564d3b2d4` |
| `xiaohongshu.account-public-notes` | `efb9f626-dcfc-4092-a138-6fbd9c5b0e11` | `4d1f6b49-a53a-4d4c-83b2-5e0ac2096357` | `64c24c6f-66c7-440c-938e-4f6b979f6429` |

## Real page-state and action evidence

### Public search

The validation browser was prepared with one explicit official `/explore` navigation before the L3
matrix. The Tool itself then performed no platform navigation, reload, or new-tab creation. It used
one trusted semantic search action, temporarily read one matching public response (`43690` bytes),
projected 17 public cards, and stored neither raw payloads nor response URLs.

### Public note detail

The detail Tool reused the existing search document and clicked result rank 1 once. It opened a
same-document note overlay with zero navigation, zero reload, and zero page-initiated new tabs. No
matching detail response was observed in that run, so the truthful capture mode was `dom_fallback`.
The fixed bounded public detail projection completed and the overlay remained available for the
following discussion and account Operations.

### Public comments and replies

The comments Tool required the already-visible note overlay. With `maximumScrolls=2`, it executed two
trusted bounded scrolls, observed one matching public payload (`17762` temporary bytes), and combined
Network and visible DOM evidence into 37 public comments. It did not navigate, reload, or open a tab.

The replies Tool reused the same admitted overlay and already-visible public reply context. With
`maximumThreads=1`, it required no additional semantic action in the successful run, reused one
matching projected payload, and returned one bounded public reply. It also performed no navigation,
reload, or new-tab creation.

### Blogger public-note inventory

The account Tool used `executionTarget=discover_public_profile_from_note` with
`maximumScrolls=3`. The production path was:

```text
existing public search document
  -> already-open same-document note overlay
  -> visible overlay-header author target
  -> one trusted author-link click
  -> observe an official public profile document with a short-lived xsec_token
  -> arm the fixed profile observer and read the public profile
  -> return a bounded public-card projection
```

The exact successful result reported:

```text
profileLinkDiscovery.attempted:    true
profileLinkDiscovery.attemptCount: 1
profileLinkDiscovery.targetMode:   new_tab
profileLinkDiscovery.tokenObserved:true
page reloads:                      0
registered platform navigations:  0
page-initiated new tabs:           1
requested scroll budget:           3
completed profile scrolls:         0
projected public cards:            30
matched Network payloads:          0
temporarily read response bytes:   0
```

The new document was created only by the Tool-owned natural public author link; the caller supplied
no URL, tab, selector, coordinate, script, route, or browser-control primitive. The short-lived
profile URL stayed in memory long enough to bind the resulting public document. The Artifact retained
only `tokenObserved=true`, not the URL or token. Because 30 visible public cards already satisfied the
postcondition, the Tool correctly consumed none of its three-scroll upper bound. The Network observer
remained the first-choice path, but no matching profile response was observed in this run, so the
actual records came from the bounded DOM fallback. This distinction is preserved rather than claiming
a Network hit that did not occur.

All five successful Artifacts reported `rawPayloadStored=false` and `responseUrlsStored=false`; every
trusted-input run also reported `debuggerDetached=true`.

## Defects discovered by the real matrix

### Risk-text false positive

The first real search rendered valid public results but stopped as `rate_limited` because a public
card contained the ordinary business phrase “金融风控”:

```text
clientRequestId: 92af41d0-d450-481b-8b96-c74f3f948cd4
operationId:     cc09aace-da01-45f4-9b15-d4b082909e7e
artifactId:      bd98eb8e-9696-4e78-9ad3-273ea19060c1
coreState:       stopped
terminalReason:  rate_limited
errorCode:       xiaohongshu_rate_limited
byteLength:      1521
sha256:          sha256:2252f0d671c2a375908744de00aa369dc90e68d2ec7f87f32521ffdf5fbc1d7a
```

Core commit `208c0b1` removed the bare content word as a platform-risk signal and made the search
executor reuse the shared risk classifier. Explicit phrases such as “请求过于频繁，请稍后再试” remain
blocking. The completed search above is the independent post-fix Operation.

### Platform-specific binding recovery

The false stop exposed that the legacy binding unlock endpoint was hard-coded to Bilibili. Core commit
`b6ee71e` added explicit Xiaohongshu safety read/unlock routes. Only the isolated validation binding
was restored after confirming that the stopped Artifact had executed no platform action. The final
Xiaohongshu safety state is `ready`, with no manual unlock required.

### Note-overlay author discovery

The first account request stopped before any platform action because production code looked only for
an author inside the first background `section.note-item`, ignoring the author visibly present in the
open note overlay:

```text
clientRequestId: 1d9c5d8e-c702-4f22-809d-2c9f3c807c9b
operationId:     95697827-acb9-4eb4-92aa-fd3f39e9d4e2
artifactId:      07b4db40-c433-4dd4-b364-2f84ecd9b233
coreState:       stopped
terminalReason:  profile_source_tab_required
errorCode:       xiaohongshu_profile_source_tab_required
byteLength:      1507
sha256:          sha256:634ba86ff9ffbac63055c0234d07d50e0c6448ccc3ea8c8d6dbc52a52b72e64b
```

Core commit `5945930` introduced a dedicated author-target module. It recognises the admitted
same-document public-note route, gives the visible overlay header absolute priority, excludes comment
and reply authors, excludes state-changing controls, requires a real pointer hit, and falls back to a
search-card author only when no overlay exists. The successful `profile_notes_ready` Operation above
is the independent post-fix proof.

## Developer-facing acceptance

The following packaged MCP Tools are now evidence-backed for upper-layer use:

```text
collector_xiaohongshu_public_notes_search
collector_xiaohongshu_note_public_detail
collector_xiaohongshu_note_public_comments
collector_xiaohongshu_note_public_comment_replies
collector_xiaohongshu_account_public_notes
```

Upper-layer developers must still obey each Tool's typed page prerequisite. A breadth search does not
magically create a detail overlay; comments and replies require the admitted visible overlay; account
collection requires one of its three explicit execution targets. Login, captcha, verification,
rate-limit, source-unavailable, document replacement, and safety terminals remain exact stop states.
`partial`, `stopped`, and `failed` must never be presented as empty success.

No raw Artifact content, screenshots, browser Profile, browser identity, signed profile URL, service
credential, or tab identity is committed with this document. No release version was bumped.
