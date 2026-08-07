# Official Skills

Checkpoint 6 extends the official Skill set to five versioned packages; all are L1-validated:

| Skill | Layer | Version | Purpose |
| --- | --- | --- | --- |
| `use-collector-mcp` | Foundation | `0.1.0` | Compatibility, optional binding selection, idempotent submission, Operation and Artifact use |
| `collect-bilibili` | Platform | `0.1.0` | Safe selection and sequencing of all 10 Bilibili Tools |
| `collect-xiaohongshu` | Platform | `0.1.0` | Page-state-safe selection and sequencing of all 5 Xiaohongshu Tools |
| `collect-zhihu` | Platform | `0.1.0` | Bounded Official Provider search, hot-list, and global-search selection |
| `research-search-then-detail` | Intent | `0.1.0` | Bounded breadth first, then selected detail |

Each Skill contains only `SKILL.md`, `agents/openai.yaml`, its required manifest, and an optional
single-level reference. Package digests and exact MCP requirements are pinned in each `manifest.json`
and `../manifests/compatibility.json`.

The `sha256-skill-package-v1` digest canonicalizes packaged UTF-8 text (`.md`, `.yaml`, `.yml`, and
`.json`) to LF before hashing. This keeps a Windows worktree with CRLF files equivalent to a clean
Linux checkout; the manifest and compatibility catalog therefore pin one cross-platform digest.

A Skill teaches method. It does not grant permission, execute a Tool by itself, own runtime state,
receive a secret, or prove that a live capability is currently available. `collect-zhihu` requires the
caller to read the live `runtimeState` from `collector://capabilities`; `credential_required` means
the local Core Gateway must be configured and is never a reason to request a Secret in chat or fall
back to browser collection. The narrow Bilibili native search L3 canary, the Zhihu Official Provider
L3 matrix, and the pinned Foundation + Bilibili L4 Agent canary are recorded under
`../docs/validation/`; they do not promote every Skill or capability to the same live validation level.
