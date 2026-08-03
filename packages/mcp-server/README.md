# MCP Server package boundary

Reserved for Checkpoint 3. No runtime source, dependency manifest, transport, Tool, or Resource is
implemented in Checkpoint 2.

The future package must remain a thin adapter over a released Collector Core API/SDK. Language and MCP
SDK selection require a focused technical decision before source is added. It must not own workflows,
models, browser lifecycle, raw Artifact storage, or the frozen `inteligence-apps` runtime.
