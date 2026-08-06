# Zhihu Official Provider developer-readiness L3 matrix

Date: 2026-08-05  
Status: the three typed Official Provider Tools have each completed a real packaged-MCP → released
Core → `developer.zhihu.com` → Operation → Artifact path under bounded inputs. This is an acceptance
record for the registered contracts, not a claim that every upstream query or quota state is always
available.

## Scope and execution contract

The matrix used the packaged stdio MCP and the regenerated Core `0.7.17` release bundle. The bundle
was started in a temporary loopback Core on an isolated port; the default `43127` Gateway was not
stopped, attached to, or restarted. The run explicitly enabled the harness's loopback-only isolated
Core mode. No browser process, tab, Profile, extension, or browser binding was used because these are
Official Provider capabilities.

The release compatibility identity was:

```text
openApiSchemaDigest:       sha256:c1f9b713f7e5ae1bd7d5d4294f08d5bda52b4352f6b30665d4c1b9b168b56cea
capabilityCatalogDigest:   sha256:3c05da851fff32fecf4da4b36ccfcec24a6630118ccd4b2e3552d17caa5b3ab4
feature:                   capabilities.catalog_digest_excludes_runtime_state.v1
```

The same catalog identity was observed with and without the Gateway-only Zhihu credential. The
public `runtimeState` (`ready` or `credential_required`) remains visible to callers but is explicitly
excluded from the static catalog digest.

Each process received a newly issued least-privilege local Core client with only:

```text
browser-bindings:read
collect:execute
operations:read
artifacts:read
```

Each process submitted one typed Tool at most once, polled only its returned Operation, read Artifact
metadata first, followed every advertised bounded chunk Resource, and reconstructed the full Artifact
SHA-256. It did not expose query text, Artifact content, the Official Provider credential, browser
identity, Profile data, or tab identity.

## Completed capability matrix

| Case | Tool | Bounded input | Terminal | Reason | Artifact bytes | Chunks | Artifact SHA-256 |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| `zhihu.public-content-search` | `collector_zhihu_search_public_content` | `count=10`, query retained only as `sha256:161332dd5ba244f14566d9ccfc214dbbd620bcd401cded068fc230e3d4e2815b` | `completed` | `official_api_response_ready` | 34498 | 3 | `sha256:8c89dc74279331b0a662e6de8a60978ee9bf9767bc1da3ed1336246e8e5221ba` |
| `zhihu.hot-list` | `collector_zhihu_hot_list_public_content` | `limit=1` | `completed` | `official_api_response_ready` | 2093 | 1 | `sha256:93b261d7e073a9d1468b4878ce054121229f28f1fe15d87bb90ae8417b095f3f` |
| `web.global-search-via-zhihu` | `collector_web_search_global_zhihu_provider` | `count=10`, `searchDatabase=all`, query retained only as the hash above | `completed` | `official_api_response_ready` | 66384 | 5 | `sha256:2e0a715bc5f781bf40b69bebd2601ec2d17ce89952c6a2808110bf36ec1c058d` |

The hot-list proof intentionally uses `limit=1`, which is inside the Core contract's `1–30` bound.
This run does not claim that the current upstream accepts every larger limit. All successful runs
observed the exact terminal state:

```text
completed / official_api_response_ready / errorCode=null
```

`platformActionAttempted` remained `null`, as expected for an Official Provider. The MCP output
contained only metadata, ranges and digests; all reconstructed byte counts matched the advertised
Artifact metadata.

## Exact completed provenance

| Case | Client request | Operation | Artifact |
| --- | --- | --- | --- |
| `zhihu.public-content-search` | `4e9a7504-c298-43c8-be2a-26997dfc993a` | `d9cf3fd1-0e8c-4b16-b0b7-1550193ef1e6` | `bd23aa44-b7dd-4bba-8b84-dd2daa5357a5` |
| `zhihu.hot-list` | `ab223700-5620-4ca7-bf6f-a41ac63b1c0f` | `884f7574-03ae-4e6c-9182-78ebec7cf598` | `e27026c5-40c7-4e77-9334-75f3fa48f608` |
| `web.global-search-via-zhihu` | `bfd996fd-1ef8-4adf-9f35-ab82e8c4d278` | `c0de1d33-7138-4f21-b172-20b60599ae98` | `4a8897c8-9db5-4b7b-a00c-4327b79f23e3` |

## Contract defect found and fixed

Before this matrix, the Core catalog digest included the Official Provider's transient `runtimeState`.
The same Core build therefore exposed one digest when `ZHIHU_ACCESS_SECRET` was absent and another
when it was configured. AgentKit correctly rejected the credentialed process as
`compatibility_unmet`, even though the executable contracts were identical.

The Core fix adds the explicit
`capabilities.catalog_digest_excludes_runtime_state.v1` feature and computes catalog identity from a
stable projection. The AgentKit verifier applies the same projection. A Core unit test covers both
readiness values, and the L3 run above proves the credentialed path through the fixed identity.

No raw Artifact content, screenshots, browser Profile, browser identity, service credential, or
unbounded upstream response is committed with this document. No version was bumped.
