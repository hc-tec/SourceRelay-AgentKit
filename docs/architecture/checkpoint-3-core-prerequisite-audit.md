# Checkpoint 3 Core prerequisite audit

- Status: `Completed — Core prerequisite and thin MCP foundation verified`
- Date: 2026-08-03
- Core pre-implementation evidence: `D:\AIProject\inteligence`, `feat/browser-extension-system@5948d44`
- Core implementation checkpoint: `feat/browser-extension-system@3562b48`
- Runtime decision: [ADR-0001](../adr/0001-typescript-node-stdio-mcp.md)

## Outcome

Core now publishes the restart-safe identity, compatibility digest and bounded Artifact primitives
required by the thin MCP adapter. No Workflow/Planner layer was added.

Implemented Core result:

- Service schema 3 with required `clientRequestId` and Core-backed persistent reservation;
- preallocated Operation ID, same-request replay, conflict, rejection recovery and explicit
  outcome-unknown;
- release/OpenAPI/catalog SHA-256 identity and six required feature flags, including a stable catalog
  identity that excludes transient Official Provider readiness;
- 15 generated direct contracts with request schema digest, target mode and budget policy;
- global Artifact metadata and canonical UTF-8 window routes bounded to 64 KiB;
- JavaScript/Python SDK parity and packaged-install verification.

Implemented MCP foundation result:

- TypeScript/Node ESM with `@modelcontextprotocol/sdk@1.30.0` and stdio only;
- startup preflight against real release/catalog/OpenAPI/bindings;
- 3 static + 3 templated read-only Resources, 0 platform Tools;
- binding aliases, exact Operation state, metadata-first Artifact reads and fixed 16 KiB cursors;
- stable protocol errors and content-minimized JSON stderr;
- 13 L1 tests and packaged MCP + real Core L2 with 0 platform Operations.

## Pre-implementation verified facts

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

All listed evidence is now complete. The real-process L2 command is:

```powershell
$env:COLLECTOR_L2_CORE_ENTRYPOINT = '<released Core user-browser-server.js>'
npm run test:l2
```

L2 is not platform evidence; L3/L4 remain unstarted.
