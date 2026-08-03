# Checkpoint 3 Core prerequisite audit

- Status: `Implementation contract accepted`
- Date: 2026-08-03
- Core evidence: `D:\AIProject\inteligence`, `feat/browser-extension-system@5948d44`
- Runtime decision: [ADR-0001](../adr/0001-typescript-node-stdio-mcp.md)

## Outcome

The current Core already has the correct product boundary and fifteen direct-ready capabilities, but
its public API does not yet provide enough restart-safe identity and bounded Artifact semantics for a
thin MCP adapter. These are Core contract gaps, not reasons to add a workflow layer to MCP.

Checkpoint 3 will add the following public primitives before any platform Tool catalog is implemented.

## Verified current facts

### Collection submission

- `POST /v2/collect` accepts exactly six top-level fields:
  `schemaVersion`, `browserBindingId`, `platform`, `capability`, `executionTarget`, `input`.
- It dispatches once and returns a persisted Core Operation.
- The persistent work queue is restart-safe for queued/claimed Operations, but it has no stable
  caller-supplied request identity.
- A transport timeout therefore cannot be reconciled to an earlier submission by request identity.

### Capability and release identity

- `GET /v2/release` publishes release/protocol versions and the user-owned-browser boundary.
- `GET /v2/capabilities` publishes readiness and safety descriptors.
- `GET /v2/openapi.json` contains request schemas.
- No response binds those surfaces with canonical schema/catalog SHA-256 values or feature flags.
- Multi-target semantics live partly in the dispatch registry and partly in OpenAPI; catalog entries do
  not expose the complete admitted execution-target set.

### Operation

- Core states are exactly `queued`, `claimed`, `completed`, `partial`, `stopped`, and `failed`.
- `errorCode`, `terminalReason`, timestamps, exact capability, execution target, and Artifact reference
  are already persisted and public.
- MCP must preserve these facts and may only add a separate derived status class.

### Artifact

- The current controlled path is `/v1/collect/artifacts/{capability}/{artifactId}`.
- It returns the complete capability-bound JSON view in one response.
- There is no metadata-only read, global Artifact identity route, bounded byte window, retention state,
  or tombstone contract.
- The route does not expose filesystem paths, which is already correct.

### Authorization

The required least-privilege scopes already exist:

```text
browser-bindings:read
collect:execute
operations:read
artifacts:read
```

The user-browser client-creation route already rejects `profiles:read`.

## Accepted Core contract changes

### 1. Required stable `clientRequestId`

The next service schema requires a UUID `clientRequestId` on every valid collection submission.

```text
same clientRequestId + same canonical normalized request
  -> same Core operationId

same clientRequestId + different canonical normalized request
  -> 409 collector_service_idempotency_conflict
```

Core persists only request ID, SHA-256 digest, preallocated Operation ID, state, safe error code, and
timestamps. It does not persist the query, URL, prompt, or Artifact content in the idempotency ledger.

The reservation is persisted before dispatch. If Core crashes after reservation but before it can
prove whether the Operation was accepted, the request becomes explicit `idempotency_outcome_unknown`
and is never automatically replayed.

### 2. Release and capability schema identity

`/v2/release` gains a compatibility block with:

```text
digest algorithm
OpenAPI schema digest
capability catalog digest
versioned feature flags
```

`/v2/capabilities` gains the same catalog digest. Every direct-ready entry gains a contract projection:

```text
requestSchemaRef
requestSchemaDigest
executionTargets
defaultExecutionTarget
executionTargetMode
budgetPolicy
```

The projection is generated from the dispatch registry and OpenAPI components; it is not manually
maintained as a second capability list.

### 3. Metadata-first bounded Artifact API

New read-only routes:

```text
GET /v2/collect/artifacts/{artifactId}
GET /v2/collect/artifacts/{artifactId}/content?offset={byteOffset}&maxBytes={boundedSize}
```

Metadata includes:

```text
artifactId / operationId / capability
mediaType / representation / byteLength / sha256
capturedAt / terminalStatus
retentionClass / retainedUntil / deletionState / available
```

Content uses one canonical UTF-8 JSON representation. Windows are bounded to 64 KiB, contain byte
range, whole/chunk hashes, next offset, and truncation, and reject non-UTF-8 boundaries or out-of-range
requests. No path, arbitrary file, automatic summary, or implicit recollection is exposed.

### 4. Operation semantics remain exact

No Core state is renamed. The MCP adapter will expose `coreState`, `terminalReason`, and `errorCode`
verbatim. Derived convenience classification is optional and cannot replace the raw fields.

## Deliberate non-goals

- No MCP Tool implementation in the Core repository.
- No arbitrary browser control or Network response interface.
- No Artifact deletion route in the MVP.
- No model, Agent, Skill, workflow, Task database, or report state in Core.
- No migration or compatibility adapter for `inteligence-apps`.
- No platform request is needed to prove these protocol/state-machine changes.

## Required evidence

- pure idempotency ledger tests including restart, conflict, concurrent reservation, rejection, and
  outcome-unknown behavior;
- OpenAPI/catalog/release digest and execution-target parity tests;
- Artifact metadata/window/hash/bounds tests against real local Artifact-store objects, not fake
  platform claims;
- JavaScript and Python SDK request/response parity;
- existing Core boundary and fifteen-capability matrix gates;
- real-process L2 from packaged MCP to a real local Core process after the MCP foundation exists.
