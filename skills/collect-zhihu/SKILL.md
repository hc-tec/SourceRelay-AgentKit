---
name: collect-zhihu
description: Collect public Zhihu content through the registered official-provider MCP Tools. Use for bounded Zhihu public-content search, the public hot list, or global public-web search through the Zhihu provider. Use together with use-collector-mcp whenever an Agent must select an official source, preserve the no-browser-binding boundary, construct bounded inputs, interpret exact provider errors, or retain Operation and Artifact provenance.
---

# Collect Zhihu

Use the registered Official Provider Tools only. These capabilities call the official Zhihu Open
Platform through Collector Core; they do not use the browser, browser bindings, page URLs, Cookie,
or caller-supplied platform credentials.

Apply `$use-collector-mcp` for Core compatibility, caller-owned request IDs, asynchronous Operation
monitoring, and bounded Artifact reads. Do not invent a browser binding for an Official Provider call.

## Choose the smallest source

- Use `collector_zhihu_search_public_content` for public Zhihu content search. Provide a trimmed
  `query` and an optional `count` from 1 through 10.
- Use `collector_zhihu_hot_list_public_content` for the public hot list. Set an explicit `limit`
  from 1 through 30 when the caller needs less than the maximum.
- Use `collector_web_search_global_zhihu_provider` for bounded public-web search. Provide a trimmed
  `query`, optional `count` from 1 through 20, and the fixed `searchDatabase` enum (`all`,
  `realtime`, or `static`).

Read [references/capabilities.md](references/capabilities.md) before constructing a Tool call or
combining multiple official sources.

## Global-search boundary

Use `site` only for a non-Zhihu hostname matching the Tool schema. Do not pass `zhihu.com` or a
Zhihu subdomain to global search; use the dedicated Zhihu public-content search instead. Use
`publishedAfter` only when the request needs the bounded RFC 3339 time filter. Do not pass arbitrary
SearchDB, Filter, route, URL, or API parameters.

## Submit and read

1. Read `collector://release` and `collector://capabilities`. If the Official Provider capability is
   absent or its `runtimeState` is `credential_required`, record that source as unavailable and
   continue independent platform sources; do not stop the whole research task or request a secret.
   Tell the caller that the local Core Gateway's Zhihu Official Provider is not configured and that
   configuration must happen at the Gateway boundary. Do not ask for a Secret in chat. Once the
   live capability reports `ready`, call the typed Tool normally; the MCP server rechecks readiness
   immediately before submission and fails closed if it changed.
2. Do not read or request `collector://bindings` as a prerequisite for these three Tools. Their
   input schema intentionally has no `bindingAlias`.
3. Generate one UUID `clientRequestId` for one canonical request and call exactly one typed Tool.
4. Return and preserve the `operationId` and Operation Resource URI. Do not hide submission, polling,
   or reconciliation inside a synthetic research workflow.
5. Read the Operation until its exact terminal state, then read Artifact metadata before any chunks.
   Preserve Artifact hash, byte ranges, capability, and provider provenance in caller-owned notes.

`completed`, `partial`, `stopped`, `failed`, and `outcome_unknown` are distinct facts. A quota,
authentication, source-unavailable, or invalid-parameter result is not `no_results`. Do not retry a
platform request automatically. For an uncertain submission, reconcile the same request ID only as
directed by the Foundation Skill.

## Credential and privacy boundary

The Access Secret belongs only to the Core Gateway process. Never put it in Tool arguments, Skill
state, MCP logs, Artifact content, prompts, reports, or Git. Do not ask the user to paste it into an
AI conversation. Official results are public-source data, but caller-owned analysis must preserve
the exact source capability and terminal provenance.

Never call browser Tools, invent a profile URL, use a browser tab, or fall back from an Official
Provider error to a logged-in browser path. Do not like, follow, favorite, comment, message, publish,
delete, bypass paid restrictions, or bypass platform safety controls.
