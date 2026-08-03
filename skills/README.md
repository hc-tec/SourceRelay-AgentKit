# Official Skills

Checkpoint 5 is in progress. Four official versioned Skills are implemented and L1-validated:

| Skill | Layer | Version | Purpose |
| --- | --- | --- | --- |
| `use-collector-mcp` | Foundation | `0.1.0` | Compatibility, binding aliases, idempotent submission, Operation and Artifact use |
| `collect-bilibili` | Platform | `0.1.0` | Safe selection and sequencing of all 10 Bilibili Tools |
| `collect-xiaohongshu` | Platform | `0.1.0` | Page-state-safe selection and sequencing of all 5 Xiaohongshu Tools |
| `research-search-then-detail` | Intent | `0.1.0` | Bounded breadth first, then selected detail |

Each Skill contains only `SKILL.md`, `agents/openai.yaml`, its required manifest, and an optional
single-level reference. Package digests and exact MCP requirements are pinned in each `manifest.json`
and `../manifests/compatibility.json`.

A Skill teaches method. It does not grant permission, execute a Tool by itself, own runtime state,
receive a secret, or prove that a live capability is currently available. L3 real-platform and L4
pinned-Skill Agent canaries remain required before Checkpoint 5 is complete.
