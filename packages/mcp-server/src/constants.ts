export const COLLECTOR_MCP_NAME = 'collector-mcp';
export const COLLECTOR_MCP_VERSION = '0.0.0-mcp-foundation';

export const SUPPORTED_CORE_RELEASE = '0.7.17';
export const SUPPORTED_CORE_SERVICE_SCHEMA = 3;
export const SUPPORTED_CORE_OPENAPI_VERSION = '3.0.0-experimental';
export const SUPPORTED_CORE_CATALOG_DIGEST =
  'sha256:5e4daee92310c3a3020d01bb5fbf83f95a949a2344cecae48692fe78824c2a96';
export const SUPPORTED_CORE_OPENAPI_DIGEST =
  'sha256:b11bb9c00133ecc70ad6f40159b9350de37a4f9339e0c981442b57bf78d28dee';

export const REQUIRED_CORE_FEATURES = Object.freeze([
  'artifacts.canonical_json_utf8_window.v1',
  'artifacts.metadata.v1',
  'capabilities.direct_contracts.v1',
  'collect.client_request_id.v1',
  'operations.exact_core_state.v1',
  'capabilities.catalog_digest_excludes_runtime_state.v1'
]);

export const DEFAULT_CORE_ORIGIN = 'http://127.0.0.1:43127';
export const DEFAULT_CORE_REQUEST_TIMEOUT_MS = 10_000;
export const ARTIFACT_RESOURCE_WINDOW_BYTES = 16_384;
export const MAX_CORE_JSON_BYTES = 8 * 1024 * 1024;

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
export const TOKEN_PATTERN = /^cst_[A-Za-z0-9_-]{43}$/;
export const SAFE_CODE_PATTERN = /^[a-z0-9_.-]{1,120}$/i;
export const BINDING_ALIAS_PATTERN = /^binding-[1-9][0-9]*$/;
export const BINDING_ALIAS_JSON_PATTERN = '^binding-[1-9][0-9]*$';

export const RESOURCE_URIS = Object.freeze({
  release: 'collector://release',
  capabilities: 'collector://capabilities',
  bindings: 'collector://bindings',
  operationTemplate: 'collector://operations/{operationId}',
  artifactTemplate: 'collector://artifacts/{artifactId}',
  artifactChunkTemplate: 'collector://artifacts/{artifactId}/chunks/{cursor}'
});
