---
name: collect-xiaohongshu
description: Collect public Xiaohongshu information through the page-state-safe typed Collector MCP Tools. Use for public note search, bounded note details, a blogger's public note inventory, an already-visible note's public comments, or public comment replies. Use together with use-collector-mcp whenever an Agent must choose Xiaohongshu breadth versus depth, preserve an existing page or overlay, use a short-lived signed profile URL safely, or avoid refresh/new-tab risk while collecting enough information.
---

# Collect Xiaohongshu

Treat the current page state as part of every capability contract. Apply `$use-collector-mcp` for
compatibility, bindings, request identity, Operation state, and Artifact reads.

## Protect the page state

- Never refresh the page for collection.
- Never open a new document or tab unless a registered Tool explicitly owns that behavior.
- Never provide a tab ID, note ID, arbitrary URL, selector, coordinate, script, route, cursor, or raw
  Network request.
- Never navigate directly to a captured non-official or internal URL.
- Stop on login, captcha, risk, rate-limit, unexpected page replacement, or safety terminal. Do not
  repeat the action in a loop.

Use only a `profileUrl` accepted by the dedicated ephemeral-profile execution target. Treat it as a
short-lived one-operation input: pass it exactly, do not normalize its query, and do not persist it in
logs, reports, Skill state, or a long-term account profile.

## Choose breadth and depth deliberately

For public search, call `collector_xiaohongshu_public_notes_search` once. The Tool/Core owns the
managed work-tab lifecycle and trusted input boundary: it creates or reuses one Collector-owned tab,
and may navigate it at most once to the official `https://www.xiaohongshu.com/explore` surface. The
Agent does not open, refresh, manually prepare, or navigate an Explore tab. A managed tab is kept for
inspection and safe reuse after a successful run; an uncertain or risk-stopped run is retained but
removed from the reuse pool. If Core returns a context-unavailable terminal, preserve the exact gap
and continue the caller's other sources; do not repeat the operation.

- Set `maximumDetails: 0` or omit it for breadth-only card collection.
- Set `maximumDetails` from 1 through 20 when the user needs detail. Slow does not mean artificially
  small; choose enough ranked details for the stated evidence goal.
- `maximumDetails` alone is detail-only: it never collects comments. When the user asks for note
  details and comments, explicitly add `comments.maximumScrolls`; add
  `comments.replies.maximumThreads` only when replies are also requested.
- Add nested `comments.maximumScrolls` only when `maximumDetails` is positive.
- Add nested `comments.replies.maximumThreads` only when comments are enabled.

Prefer the combined search/detail/comments request when its depth budget is known before the search;
Core can keep the sequence bounded and close each same-document overlay. Do not expect an overlay to
remain open after that combined operation.

For staged selection, first run breadth search, read its Artifact, select visible result ranks, then
use `collector_xiaohongshu_note_public_detail` with the matching existing search or profile target.
While that detail overlay remains admitted, run comments and replies sequentially if requested.

## Collect a blogger's public notes

Choose exactly one account execution target:

- `existing_public_profile_tab`: require an already-open public profile; use 1–3 scrolls and omit
  `profileUrl`.
- `ephemeral_public_profile_url`: require the user- or page-derived short-lived official profile URL;
  use 1–20 scrolls and include that URL exactly once.
- `discover_public_profile_from_note`: require an admitted public note context whose visible author
  avatar can naturally discover the profile; use 1–20 scrolls and omit `profileUrl`.

Do not default to one scroll merely to appear cautious. Set a bounded value that can satisfy the
requested coverage, then rely on Core's fixed pacing and safety controls. Do not retry a failed or
uncertain account action with a different target or URL under the same request ID.

## Collect note discussion

Use `collector_xiaohongshu_note_public_comments` only when exactly one eligible same-document public
note overlay is already open. Zero eligible overlays returns `existing_public_note_overlay_required`;
multiple eligible overlays returns `existing_public_note_overlay_ambiguous`. Use
`collector_xiaohongshu_note_public_comment_replies` only after the relevant public reply threads are
available in that same overlay context. Keep both budgets within the Tool enum 1–3. When the comment
budget is known before search, prefer the combined search request so Core owns the overlay lifecycle.

Read [references/capabilities.md](references/capabilities.md) when constructing inputs or chaining
search, detail, comments, replies, or account collection. Do not use it as a manual page-setup
checklist.

All capabilities are public reads. Do not like, follow, favorite, comment, message, publish, delete,
read account-scoped surfaces, export credentials, or bypass platform controls.
