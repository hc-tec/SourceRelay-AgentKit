# Windows configurator package boundary

This placeholder is superseded by the approved Developer Readiness & Full Capability Acceptance
architecture. No Windows installer, Credential Manager adapter, browser-Profile manager, or ordinary
user configuration wizard will be implemented in this repository.

Collector Core credential issuance and stdio child-process environment injection remain deployment
responsibilities of the Core/Agent Host. MCP continues to accept only its dedicated process credential
and never receives browser credentials, Profile paths, cookies, or tab identities.
