---
name: collect-bilibili
description: Collect public Bilibili information through the registered typed Collector MCP Tools. Use for Bilibili keyword search, video detail, UP account profile,投稿 inventory, dynamics, collection or series overview/detail, danmaku, or public discussion collection. Use together with use-collector-mcp whenever an Agent must choose a Bilibili capability, construct its bounded input, sequence related reads, or interpret platform-specific prerequisites without arbitrary browser control.
---

# Collect Bilibili

Use only the Bilibili Tools currently present in MCP. Apply `$use-collector-mcp` for compatibility,
binding selection, idempotency, Operation monitoring, and bounded Artifact reads.

## Choose the smallest capability

- Use `collector_bilibili_native_search` for one bounded relevance search.
- Use `collector_bilibili_native_search_batch` only when the request genuinely needs the registered
  broader multi-page search budget.
- Use `collector_bilibili_video_detail` for one known canonical BV video.
- Use `collector_bilibili_account_profile` for public UP identity and profile facts.
- Use `collector_bilibili_account_inventory` for public投稿 inventory.
- Use `collector_bilibili_dynamic` for the registered bounded public dynamic feed.
- Use `collector_bilibili_collection_series_overview` before requesting an unknown series or season.
- Use `collector_bilibili_collection_series_detail` only with a stable ID and type obtained from
  overview evidence.
- Use `collector_bilibili_discussion` for public video discussion.
- Use `collector_bilibili_danmaku` only when danmaku is part of the user's requested evidence.

Read [references/capabilities.md](references/capabilities.md) before constructing Tool arguments or
chaining more than one capability.

## Keep inputs canonical

Use canonical public URLs without query or fragment:

```text
https://www.bilibili.com/video/BVxxxxxxxxxx
https://space.bilibili.com/<numeric-uid>
```

Prefer URLs and stable IDs returned by a prior Artifact. Do not guess a BV ID, UID, series ID, or
season ID from display text. Let the Tool/Core schema reject invalid inputs; never work around it with
navigation, selectors, scripts, tab IDs, or API simulation.

For `collector_bilibili_account_inventory`, choose `collector_work_tab` normally. Choose
`user_selected_tab` only when the current MCP binding has a valid user-created short lease; never
provide or infer a tab identity.

## Sequence explicit operations

For search-to-video research:

1. Run one search Tool with a new request ID.
2. Read its terminal Artifact and rank results in caller-owned reasoning.
3. Select only relevant canonical BV URLs.
4. Run video detail for selected results with one new request ID per video.
5. Add discussion or danmaku only when requested or when a stated evidence gap requires it.

For account research, run profile, inventory, dynamics, and series overview as separate visible
operations according to the user's requested breadth. Run series detail only for selected overview
items. Do not hide a loop, pagination policy, or account-wide archive inside the Skill.

## Preserve platform facts

- Treat charge-only, unavailable, login, risk, partial, empty, and failed outcomes as distinct facts.
- Do not infer subtitle or article capability: neither is present in the current direct Tool catalog.
- Do not call every Tool merely because it exists.
- Keep result provenance through Operation and Artifact identities and hashes.
- Stop when the requested coverage is met, the explicit budget is exhausted, or Core reports a safety
  terminal.

All Tools perform public reads through the user's paired browser. Do not like, follow, favorite,
comment, message, publish, delete, bypass paid content, or evade platform controls.

