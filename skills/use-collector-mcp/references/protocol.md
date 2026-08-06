# Collector MCP protocol reference

## Resources

| URI | Expected schema | Use |
| --- | --- | --- |
| `collector://release` | `collector.mcp.release/v1` | Verified Core identity and feature contract |
| `collector://capabilities` | `collector.mcp.capabilities/v1` | Current capability and direct-contract truth |
| `collector://bindings` | `collector.mcp.bindings/v1` | Safe session-local binding aliases and state |
| `collector://operations/{operationId}` | `collector.mcp.operation/v1` | Exact Core state, terminal facts, Artifact reference |
| `collector://artifacts/{artifactId}` | `collector.mcp.artifact-metadata/v1` | Metadata before content |
| `collector://artifacts/{artifactId}/chunks/{cursor}` | `collector.mcp.artifact-chunk/v1` | Fixed 16 KiB canonical UTF-8 JSON window |

## Tool submission result

Expect only:

```text
accepted = true
clientRequestId
idempotentReplay
operationId
capabilityId
coreState
operationResourceUri
```

The result is not the collected data. It does not prove terminal success and does not contain a
browser identity or Artifact body.

## Core state interpretation

| Core state | Terminal | Action |
| --- | --- | --- |
| `queued` | no | Continue bounded Operation reads |
| `claimed` | no | Continue bounded Operation reads; never submit a duplicate |
| `completed` | yes | Read Artifact metadata when present |
| `partial` | yes | Use available Artifact and retain stated gaps |
| `stopped` | yes | Preserve stop reason; do not override a safety stop |
| `failed` | yes | Preserve error and terminal reason; do not claim no results |

## Submission and protocol errors

| Error | Meaning | Safe response |
| --- | --- | --- |
| `compatibility_unmet` | Published Core identity or contract is unsupported | Stop before platform action |
| `tool_input_invalid` | Tool arguments violate the AI-visible schema | Correct arguments; use a new ID only if no POST occurred |
| `binding_alias_not_found` | Alias is absent from this MCP session | Re-read bindings; do not invent an alias |
| `binding_selection_required` | More than one online binding is available for an omitted alias | Read bindings once, choose one deliberate alias, and retry the exact new action only if no POST occurred |
| `binding_unavailable` | No online binding is available for a Browser Provider Tool | Preserve the unavailable source and continue independent sources; do not open or pair a browser from the Agent |
| `authentication_failed` | MCP's dedicated Core credential failed | Stop and repair local configuration outside the Agent |
| `permission_denied` | Required Core scope or origin policy rejected | Stop; do not seek broader browser credentials |
| `request_rejected` | Core rejected capability input or admission | Preserve safe Core error and correct the explicit request |
| `submission_conflict` | The ID is bound to a different request or Core cannot safely admit it | Stop; never mutate and replay under the same ID |
| `submission_outcome_unknown` | MCP cannot prove whether the one POST was accepted | Reconcile once with exact arguments and the same ID |
| `core_unavailable` | Core returned an unavailable condition | Wait under caller policy; never blind-loop POST |
| `resource_not_found` | Requested Operation or Artifact identity is unavailable | Verify the returned URI; do not scan identities |
| `artifact_read_out_of_bounds` | Cursor is invalid or not on a UTF-8 boundary | Follow the previous chunk's next URI only |

Core may attach a safe `coreErrorCode`; retain it without exposing request content. Never treat an
upstream exception message as a stable code.

## Provenance minimum

Keep these facts in caller-owned output when evidence is used:

```text
capabilityId
clientRequestId
operationId and exact terminal coreState
artifactId and artifact SHA-256
capturedAt
chunk byte range and chunk SHA-256 when quoting raw content
partial or truncation facts
```
