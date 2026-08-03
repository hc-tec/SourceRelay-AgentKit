# Xiaohongshu capability reference

## Tool inputs and page prerequisites

| Tool | Capability fields | Required page state or target |
| --- | --- | --- |
| `collector_xiaohongshu_public_notes_search` | `query`; optional `maximumDetails`; optional nested `comments` | Unique existing public Explore page; target fixed internally |
| `collector_xiaohongshu_account_public_notes` | `executionTarget`, `maximumScrolls`; conditional `profileUrl` | Existing profile, ephemeral official profile URL, or discoverable visible note author |
| `collector_xiaohongshu_note_public_detail` | `executionTarget`, `resultRank` | Existing public search or profile page with the ranked card visible |
| `collector_xiaohongshu_note_public_comments` | `maximumScrolls` | Already-open same-document public note overlay |
| `collector_xiaohongshu_note_public_comment_replies` | `maximumThreads` | Same admitted note overlay with public reply context |

Every Tool also requires `bindingAlias` and caller-controlled UUID `clientRequestId`.

## Search input shape

```text
query: 1–80 characters, already trimmed
maximumDetails: optional integer 0–20
comments:
  maximumScrolls: 1 | 2 | 3
  replies:
    maximumThreads: 1 | 2 | 3
```

Require `maximumDetails > 0` before enabling comments. Require comments before enabling replies.
Choose enough detail for the task; do not equate risk control with unusably low coverage.

## Account target matrix

| executionTarget | maximumScrolls | profileUrl | Meaning |
| --- | ---: | --- | --- |
| `existing_public_profile_tab` | 1–3 | forbidden | Read the already-open public profile |
| `ephemeral_public_profile_url` | 1–20 | required | Consume one short-lived official signed profile URL |
| `discover_public_profile_from_note` | 1–20 | forbidden | Use the natural visible author-avatar path from an admitted note |

Keep an ephemeral URL under 4096 characters and pass it without reserializing its signature. Do not
store it in provenance; store the resulting Operation and Artifact identities instead.

## Safe chains

### Known depth at search time

```text
public notes search with maximumDetails
  -> optional nested comments
  -> optional nested replies
  -> one terminal Artifact
```

Use this chain to minimize repeated overlay operations. The Tool opens and closes bounded detail
overlays itself.

### Select after breadth review

```text
breadth-only public notes search
  -> read cards and choose resultRank 1–20
  -> note public detail on existing search page
  -> optional public comments while overlay remains open
  -> optional public comment replies in the same overlay context
```

Do not refresh between these Operations. If the overlay or source page is lost, stop and create a new
explicit plan rather than repeatedly clicking or reopening.

### Blogger public-note inventory

Use account public notes with one target from the matrix. Treat the result as public card inventory,
not proof that every historical note exists or that account-scoped data is available.

## Known boundary

The current direct surface does not expose arbitrary note URLs, note IDs, cursors, media download,
expiring image/video preservation, favorites, messages, account-private data, arbitrary response
bodies, or browser-control primitives. Re-read `collector://capabilities` when the catalog changes.

