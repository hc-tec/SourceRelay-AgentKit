# Windows configurator package boundary

Reserved for Checkpoint 6. No installer or credential-store implementation exists in Checkpoint 2.

The future package will configure the separately installed Collector Core and per-session stdio MCP
integration without copying tokens into Agent-visible configuration. It must not install browser
permissions silently, manage browser Profiles, or start/close the user's daily browser.
