# Test layers

The current suite is a repository-foundation boundary gate. It verifies truthful manifests, canonical
architecture documents, UTF-8, license/governance files, and the deliberate absence of runtime code.
It does not prove MCP behavior or platform capability.

Future verification layers remain distinct:

- L1 — pure schemas, compatibility, URI/range, redaction, idempotency, Skill metadata;
- L2 — packaged MCP + released Core + real transport/auth and process lifecycle;
- L3 — production MV3 + Core + MCP + real client + registered live platform capability;
- L4 — real Agent runtime + pinned Skill + provenance-preserving outcome.

Run all currently applicable gates with:

```powershell
python .\scripts\verify_repository.py
```
