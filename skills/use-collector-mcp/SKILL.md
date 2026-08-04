---
name: use-collector-mcp
description: Operate the Collector MCP asynchronous collection protocol safely. Use whenever an Agent must inspect Collector compatibility or browser bindings, invoke a typed Collector Tool, preserve clientRequestId idempotency, monitor an Operation, interpret exact terminal states and errors, or read bounded Artifact metadata and chunks. Pair this Foundation Skill with a platform or intent Skill for capability-specific choices.
---

# Use Collector MCP

Treat Collector MCP as a thin asynchronous adapter over Collector Core. Keep planning, analysis,
working notes, and final outputs in the caller; never turn MCP into a workflow service.

## Establish the session

1. Read `collector://release` and `collector://capabilities` before the first platform action.
2. Confirm the required Tool and capability are present now. Do not infer availability from this Skill.
3. If the selected capability uses the Browser Provider, read `collector://bindings` and select an
   `online` session-local `binding-N` alias. Official Provider capabilities intentionally do not
   require a binding and their Tool schemas omit `bindingAlias`.
4. Stop before any Tool call when compatibility is unmet, a required browser binding is unavailable,
   or an Official Provider reports `runtimeState=credential_required`.

Never request or expose a Core token, browser binding ID, extension ID, Profile, Cookie, tab ID, URL
primitive, selector, script, CDP command, or Network body.

## Submit one operation

1. Select one strongly typed Tool with the relevant Platform Skill. Confirm its Provider and binding
   requirement from the live capability contract.
2. Generate one UUID `clientRequestId` for this exact canonical Tool call.
3. Preserve the complete Tool name and arguments until the outcome is known.
4. Call the Tool once. Do not poll inside the Tool call or issue a second capability implicitly.
5. Record the returned `operationId`, `operationResourceUri`, `capabilityId`, and
   `idempotentReplay` in caller-owned state.

For a genuinely new platform action, generate a new request ID. For the same action, never change
arguments while reusing an ID.

## Follow the operation

Read the returned Operation Resource until it reaches a terminal Core state or the caller's explicit
deadline. Use bounded local polling such as 2, 4, 8, then at most 15 seconds between reads; do not
busy-loop.

- Treat `queued` and `claimed` as nonterminal facts.
- Treat `completed`, `partial`, `stopped`, and `failed` as exact terminal facts.
- Preserve `coreState`, `terminalReason`, and `errorCode`; never rewrite failure as `no_results`.
- Use an Artifact attached to `partial`, but retain the partial status and coverage gaps.
- Stop on login, captcha, risk, rate-limit, permission, or safety terminals. Do not bypass them.

For `submission_outcome_unknown`, make no automatic retry. If reconciliation is necessary, explicitly
resubmit the exact same Tool arguments once with the same `clientRequestId`; then stop if uncertainty
remains. For `submission_conflict`, do not silently replace the ID.

## Read an artifact

1. Read `collector://artifacts/{artifactId}` before content.
2. Verify availability, media type, byte length, whole SHA-256, capability, and terminal status.
3. Start at `collector://artifacts/{artifactId}/chunks/0` only when content is needed.
4. Follow only the returned `nextChunkResourceUri`; stop at `null` or once enough evidence is read.
5. Preserve Artifact ID, hash, byte range, and truncation with any caller-owned quotation or summary.

Do not invent file paths, cursors, JSONPath, byte limits, or alternate Artifact identities. Do not ask
MCP to summarize content or call a model.

## Apply the contract reference

Read [references/protocol.md](references/protocol.md) when interpreting an error, designing polling,
or recording Resource provenance. Keep capability-specific decisions in the Bilibili or Xiaohongshu
Platform Skill.
