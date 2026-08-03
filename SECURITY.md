# Security Policy

## Support status

Collector AI Integration is currently at repository-foundation stage. There is no released MCP
runtime, installer, Tool, Resource, or official Skill yet. No production version is currently
supported.

After public release, supported versions and security-fix windows will be listed here. Until then,
do not deploy this repository as a service or infer capability from its manifests.

## Reporting a vulnerability

Do not publish credentials, browser data, raw artifacts, private logs, exploit details, or account
identifiers in a public issue. Once the public repository exists, use its private security-advisory
channel. For the current local phase, report directly to the project owner without attaching secrets.

Include only minimized reproduction information:

- affected commit or release;
- affected contract, Tool, Resource, Skill, installer, or log surface;
- whether a platform action may have occurred;
- whether secrets or unbounded Artifact content may have been exposed;
- safe steps to reproduce without bypassing access controls.

## Security boundary

This product is a local AI protocol adapter, not a browser controller. Its intended production chain
is:

```text
approved local Agent host
  -> per-session stdio MCP process
  -> authenticated 127.0.0.1 Collector Core API
  -> paired production MV3 in the user's daily browser
```

The MCP process must never receive or expose browser cookies, passwords, Profile directories, tab IDs,
arbitrary response bodies, Core service credentials, or model API keys. Agent-visible operations are
limited to registered, strongly typed Core capabilities and bounded Artifact reads.

## Secrets

- Never commit Core tokens, model keys, cookies, browser data, pairing materials, or captured headers.
- Production Core credentials must be least-privilege and protected by the operating system.
- Secrets must not appear in Tool inputs/results, Resource URIs/content, Skills, logs, diagnostics,
  test snapshots, exceptions, or reports.
- A suspected leaked credential must be revoked and rotated at its owner; redacting Git history alone
  is insufficient.

## Out of scope by design

Security reports requesting any of the following will not be implemented as features:

- captcha/access-control bypass;
- arbitrary browser automation, script execution, selectors, CDP, DevTools, or Network access;
- LAN or Internet exposure of the default MCP/Core path;
- extraction of browser credentials or private account state;
- automatic state-changing platform actions;
- fallback to third-party crawlers or the frozen `inteligence-apps` runtime.
