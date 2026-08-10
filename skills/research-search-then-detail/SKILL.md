---
name: research-search-then-detail
description: Perform a minimal public-information search-then-detail method with Collector MCP. Use when a user wants broad Bilibili or Xiaohongshu discovery first and deeper collection only for selected relevant results, including bounded Xiaohongshu note comments when requested, and cross-platform topic research with explicit breadth/detail budgets. Combine with use-collector-mcp and the selected Platform Skill; do not use for monitoring, hidden workflows, arbitrary browsing, or automatic analysis services.
---

# Research Search Then Detail

Keep the research plan in the Agent or calling application. Use MCP only for visible typed collection
Operations, exact state, and raw Artifact access.

## Establish the research contract

1. Apply `$use-collector-mcp` and the relevant `$collect-bilibili` or
   `$collect-xiaohongshu` Platform Skill.
2. Restate the topic, platform scope, freshness need, and evidence threshold.
3. Set an explicit budget before the first Tool call:
   - search Operations per platform;
   - maximum results to inspect from each Artifact;
   - maximum selected details per platform;
   - stop condition and caller deadline.
4. Keep every platform action visible as its own Tool call and Core Operation.

Do not create a Task/Run/Step service, background monitor, hidden retry loop, or implicit swarm. Let the
caller coordinate any parallel reasoning; obey Core/MCP binding and platform concurrency.

## Collect breadth first

For Bilibili, choose one of:

- `collector_bilibili_native_search` for a bounded first search;
- `collector_bilibili_native_search_batch` when the approved breadth budget requires the registered
  multi-page surface.

For Xiaohongshu, use `collector_xiaohongshu_public_notes_search` with `maximumDetails: 0` or omitted
when selection must happen after breadth review. Do not prepare, refresh, or reopen a page for this
call; let Core return the exact context-unavailable terminal if no admitted public context exists.

Use a separate UUID request ID for each platform search. Follow each Operation to terminal, then read
Artifact metadata and only enough chunks to evaluate the bounded candidate set.

## Select before deepening

Rank candidates in caller-owned reasoning using explicit criteria such as topical relevance, source
identity, freshness, engagement context, and diversity. Deduplicate obvious repeats. Record why each
candidate was selected and why the detail budget is sufficient.

Do not deepen every result by default. Do not let the easiest platform consume another platform's
budget without an explicit plan change.

## Collect selected detail

For each selected Bilibili candidate, call `collector_bilibili_video_detail` with the canonical BV URL
from search evidence and a new request ID.

For each selected Xiaohongshu candidate, call `collector_xiaohongshu_note_public_detail` with its
visible `resultRank` and the exact existing search-page target. Keep calls sequential on that page and
stop if the page state is lost, replaced, challenged, or no longer admits the rank.

When the user requests comments or discussion evidence for a selected Xiaohongshu note, treat that
request as part of the declared detail budget. If the comment budget was known before search, prefer
the search Tool's nested `comments` request. Otherwise call
`collector_xiaohongshu_note_public_comments` immediately after detail while exactly one eligible
same-document note overlay remains open; zero or multiple matching overlays are terminal
prerequisites, not a reason to guess or reopen pages.

Follow each detail Operation independently. Preserve `completed`, `partial`, `stopped`, and `failed`
facts rather than collapsing them into one research status.

## Produce caller-owned evidence

For every used item, retain:

```text
platform and capabilityId
search Operation and Artifact identity
selection reason and source rank
detail Operation and Artifact identity
terminal coreState
Artifact SHA-256 and capture time
partial, truncation, or missing-detail gap
```

Summarize or compare content only in the caller. Do not ask MCP to generate a report, call a model,
or persist a shared knowledge workspace.

## Stop deliberately

Stop when the evidence threshold is met, the declared detail/comment budget is exhausted, no remaining
result can materially change the answer, or any safety terminal occurs. Report uncovered gaps instead
of automatically broadening queries, adding platforms, or reopening pages. Do not add comments unless
the caller requested discussion evidence; when requested, collect them only within the explicit bound
above.
