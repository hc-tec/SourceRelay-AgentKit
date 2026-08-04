# Zhihu Official Provider capability reference

## Tool matrix

| Tool | Capability | Required fields | Bounds | Browser binding |
| --- | --- | --- | --- | --- |
| `collector_zhihu_search_public_content` | `zhihu.search.public_content.v1` | `clientRequestId`, `query` | `count`: 1–10 | forbidden |
| `collector_zhihu_hot_list_public_content` | `zhihu.hot_list.public_content.v1` | `clientRequestId` | `limit`: 1–30 | forbidden |
| `collector_web_search_global_zhihu_provider` | `web.search.global.zhihu_provider.v1` | `clientRequestId`, `query` | `count`: 1–20 | forbidden |

Every Tool uses `executionTarget=official_api` internally. The AI-visible schema does not expose
`schemaVersion`, `platform`, `capability`, `executionTarget`, `browserBindingId`, `bindingAlias`,
or any caller-supplied credential.

## Input examples

Public Zhihu search:

```json
{
  "clientRequestId": "<new UUID>",
  "query": "人工智能",
  "count": 10
}
```

Public hot list:

```json
{
  "clientRequestId": "<new UUID>",
  "limit": 30
}
```

Global search through the official Zhihu provider:

```json
{
  "clientRequestId": "<new UUID>",
  "query": "具身智能",
  "count": 10,
  "searchDatabase": "all"
}
```

`site` is optional and must be a non-Zhihu hostname. `publishedAfter` is optional and must be an
RFC 3339 date-time. Do not pass the provider's raw `Filter` object or a Zhihu hostname to the global
search Tool.

## Exact limitations

- These Tools expose one bounded result page/list, not unlimited pagination.
- They do not provide all answers, all comments, private account surfaces, favorites, messages, or
  arbitrary author archives.
- `runtimeState=credential_required` is a Core configuration fact; it is not a reason to request a
  secret from the caller or to fall back to browser collection.
- Official Provider operations normally complete synchronously in Core, but the MCP contract still
  exposes an Operation Resource and requires the same idempotent reconciliation rules.
- Keep `terminalReason`, `errorCode`, quota/rate-limit state, and Artifact hashes exact.
