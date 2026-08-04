# ADR-0001: TypeScript/Node for the thin stdio MCP runtime

- Status: `Accepted`
- Date: 2026-08-03
- Scope: Checkpoint 3 runtime and official MCP SDK only

## Context

Collector AI Integration needs one short-lived stdio MCP process that performs compatibility
preflight, maps registered Core contracts into MCP protocol objects, and exits with its Agent session.
It must not introduce a Workflow engine, model provider, browser controller, or second Artifact store.

The released Collector Core implementation and JavaScript SDK already use Node ESM. The Core workspace
requires Node 22+, and the current verified machine provides Node 24.13.0. Core also publishes a Python
SDK, so both official MCP SDK languages were viable.

Metadata was read from the official package registries on 2026-08-03:

| Candidate | Observed stable package | Runtime floor | Official source |
| --- | --- | --- | --- |
| TypeScript | `@modelcontextprotocol/sdk@1.30.0` | Node 18+ | `modelcontextprotocol/typescript-sdk` |
| Python | `mcp==2.0.0` | Python 3.10+ | `modelcontextprotocol/python-sdk` |

The TypeScript package exposes separate `server`, `client`, and validation entry points and supports
stdio without requiring this product to publish an HTTP transport. The Python package is also official,
but brings a second application model and a larger ASGI/Pydantic/HTTP packaging surface that this thin
adapter does not need.

Sources:

- <https://www.npmjs.com/package/@modelcontextprotocol/sdk>
- <https://github.com/modelcontextprotocol/typescript-sdk>
- <https://pypi.org/project/mcp/>
- <https://github.com/modelcontextprotocol/python-sdk>

## Decision

Use TypeScript compiled to Node ESM for the MCP runtime, with the official
`@modelcontextprotocol/sdk` package pinned by the repository lockfile.

```text
Agent host
  -> stdio
  -> TypeScript/Node Collector MCP process
  -> released Collector JavaScript SDK or its versioned HTTP contract
  -> Collector Core
```

The first implementation uses stdio only. It does not use experimental MCP Tasks, HTTP transports,
SSE, an Agent framework, or server-side workflow helpers. Runtime validation uses JSON Schema/Zod only
at protocol boundaries; the live Core catalog remains capability truth.

## Why this is the smaller boundary

- It reuses the same Node/ESM runtime already verified by Core and its JavaScript SDK.
- It avoids maintaining Python and JavaScript mappings simultaneously inside the MCP adapter.
- Core/OpenAPI/JavaScript SDK/MCP parity can be tested without cross-language code generation first.
- Node's built-in test runner is sufficient for L1 and real-process L2.
- Windows stdio process behavior can be exercised directly without an ASGI server or extra port.
- Python applications remain first-class Core consumers through the independent Python SDK; they do not
  need to embed the MCP runtime.

## Consequences

- Checkpoint 3 may add `package.json`, `package-lock.json`, TypeScript config, and source under
  `packages/mcp-server`.
- Dependency installation is local to this repository; no Core or old-prototype source import is
  allowed.
- The compatibility manifest must record the exact MCP protocol/runtime surface only after L1/L2 pass.
- Distribution packaging remains outside this runtime ADR. The approved target architecture does not
  add a Windows installer or credential configurator to this repository.
- If the official SDK changes major protocol APIs, compatibility is handled through a versioned adapter
  inside the MCP package, not by changing Core or exposing framework-specific Tools.

## Implementation evidence

Checkpoint 3 implemented this ADR with:

```text
Node 24.13.0
TypeScript 5.9.3
@modelcontextprotocol/sdk 1.30.0
MCP protocol 2025-11-25
default transport stdio
platform Tools 0
read-only Resources 6
```

`npm run test:l1` exercises the official in-memory MCP transport. `npm run test:l2` packs and installs
the MCP package, starts a real released Core process, issues a real four-scope local token, connects over
stdio, reads release/capability/binding Resources, verifies Operation/Artifact not-found mapping, and
asserts zero Core platform Operations. This is L2 protocol evidence, not a platform claim.

## Rejected alternatives

### Python MCP runtime

Technically viable, especially for Python Agent hosts, but it duplicates Core client mapping and adds a
second runtime/tooling path without improving the stdio contract. Python applications can still use the
Core Python SDK directly.

### Custom MCP protocol implementation

Rejected because protocol framing, initialization, capability negotiation, and error behavior should
come from the official SDK rather than locally reimplemented JSON-RPC code.

### HTTP-first or shared MCP daemon

Rejected for the MVP. The approved topology is one stdio process per Agent session. Authenticated
loopback MCP remains an optional later mode with the same Tool/Resource contract.
