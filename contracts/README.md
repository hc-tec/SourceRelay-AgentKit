# Contracts

This directory contains protocol-independent, versioned schemas owned by Collector AI Integration.
They describe compatibility and Skill metadata; they do not create runtime capability.

Current schemas:

- `compatibility-manifest.schema.json` — truthful product/Core/MCP/verification compatibility claims;
- `skill-manifest.schema.json` — future official/third-party Skill identity and requirements.

The live Collector Core release, capability catalog, and OpenAPI remain the runtime source of truth.
No schema in this repository may invent a capability that Core does not publish as direct-ready.
