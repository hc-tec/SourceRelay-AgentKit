# Checkpoint 4 capability Tool contract

Status: completed

Core identity: `0.7.17` / service schema `3`

Tool catalog version: `collector.mcp.tools/v1`

## Outcome

Every Core capability whose live catalog state is `direct_ready` maps to exactly one MCP Tool. The
MCP remains an asynchronous protocol adapter: a Tool validates one capability request, resolves a
session-local browser-binding alias, performs exactly one `POST /v2/collect`, and immediately returns
the Core Operation identity. It does not poll, read an Artifact, call a model, retry a submission, or
compose multiple capabilities.

## Stable mapping

| MCP Tool ID | Core capability ID |
| --- | --- |
| `collector_bilibili_video_detail` | `bilibili.video_detail` |
| `collector_bilibili_native_search` | `bilibili.native_search` |
| `collector_bilibili_native_search_batch` | `bilibili.native_search_batch` |
| `collector_bilibili_account_profile` | `bilibili.account_profile` |
| `collector_bilibili_account_inventory` | `bilibili.account_inventory` |
| `collector_bilibili_dynamic` | `bilibili.dynamic` |
| `collector_bilibili_collection_series_overview` | `bilibili.collection_series.overview` |
| `collector_bilibili_collection_series_detail` | `bilibili.collection_series.detail` |
| `collector_bilibili_danmaku` | `bilibili.danmaku` |
| `collector_bilibili_discussion` | `bilibili.discussion` |
| `collector_xiaohongshu_public_notes_search` | `xiaohongshu.search.public_notes.v1` |
| `collector_xiaohongshu_account_public_notes` | `xiaohongshu.account.public_notes.v1` |
| `collector_xiaohongshu_note_public_detail` | `xiaohongshu.note.public_detail.v1` |
| `collector_xiaohongshu_note_public_comments` | `xiaohongshu.note.public_comments.v1` |
| `collector_xiaohongshu_note_public_comment_replies` | `xiaohongshu.note.public_comment_replies.v1` |

There is no generic `capability + JSON` Tool and no alias for the historical application prototype.

## AI-visible input transformation

The live, digest-verified Core request schema is transformed mechanically:

```text
Core envelope
  schemaVersion / clientRequestId / browserBindingId / platform /
  capability / executionTarget / input

MCP Tool input
  bindingAlias / clientRequestId /
  executionTarget only for a Core enum contract /
  the capability-specific fields formerly inside input
```

Rules:

- `schemaVersion`, `platform`, `capability`, and every fixed execution target are injected internally.
- `browserBindingId` is never exposed; `bindingAlias` is resolved inside the MCP session.
- An enum execution target is required and is limited to the exact verified Core enum. The MCP does
  not invent tab identities or browser controls.
- Capability input properties, required fields, bounds, enums, formats, conditional constraints,
  descriptions, and `additionalProperties: false` come from the verified Core schema.
- The transformed schema is canonical-JSON hashed. Startup fails closed if the source schema or
  direct contract does not match the published Core identity.

The official high-level `McpServer.registerTool()` path converts Zod back to JSON Schema. Zod's JSON
Schema importer rejects the Core contract's `if` / `then` / `not` constraints, so it cannot preserve
the exact schema. Checkpoint 4 therefore uses the official SDK's low-level Tool request handlers with
the mechanically derived JSON Schema and standards-based JSON Schema validation. Resources continue
to use `McpServer`. This avoids maintaining 15 handwritten validation contracts.

## Submission and result

The MCP performs one authenticated Core POST and never retries it automatically. A transport failure
after dispatch may have begun is reported as `submission_outcome_unknown`; the caller must preserve
the exact Tool arguments and reuse the same `clientRequestId` to ask Core for an idempotent replay.

The successful Tool result is deliberately small:

```json
{
  "accepted": true,
  "clientRequestId": "00000000-0000-4000-8000-000000000000",
  "idempotentReplay": false,
  "operationId": "00000000-0000-4000-8000-000000000000",
  "capabilityId": "bilibili.video_detail",
  "coreState": "queued",
  "operationResourceUri": "collector://operations/00000000-0000-4000-8000-000000000000"
}
```

On an idempotent replay, `coreState` may already be terminal; it is never rewritten. The Tool does not
return browser identity, Core token, input body, query, URL, Artifact content, or a legacy retrieval
path.

## Verification boundary

- L1 proves exact Tool listing, schema transformation, extra-field rejection, alias resolution,
  response projection, one-POST semantics, no automatic retry, and stable safe errors.
- L2 proves the packaged MCP against a real Core process and scoped token. Invalid or offline-binding
  submissions may create a Core idempotency record, but must create no accepted platform Operation.
- Only L3 may claim an accepted Tool-to-Operation-to-Artifact platform path, using production MV3,
  real Core, and a real platform under the reconnaissance rules.

## Completion evidence

- `npm run verify`: 10 repository-boundary tests and 26 MCP L1 tests passed.
- Core `npm run verify:core-capability-matrix`: 15-way registry/OpenAPI/extension/JavaScript SDK/
  Python SDK parity passed.
- `npm run test:l2` with the released Core `user-browser-server.js`: packaged MCP, real Core process,
  scoped Core token, 15 Tool schemas, Core/manifest parity, and all 15 schema digests passed.
- L2 created zero accepted platform Operations and made zero live-platform requests. This is process
  and protocol evidence only; it is not a platform capability claim.
