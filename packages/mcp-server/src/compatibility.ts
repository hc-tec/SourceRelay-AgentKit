import {
  DIGEST_PATTERN,
  REQUIRED_CORE_FEATURES,
  SUPPORTED_CORE_OPENAPI_VERSION,
  SUPPORTED_CORE_CATALOG_DIGEST,
  SUPPORTED_CORE_OPENAPI_DIGEST,
  SUPPORTED_CORE_RELEASE,
  SUPPORTED_CORE_SERVICE_SCHEMA,
  UUID_PATTERN
} from './constants.js';
import { sha256Digest } from './canonical-json.js';
import { CollectorMcpError } from './errors.js';

export interface VerifiedCoreCompatibility {
  verifiedAt: string;
  release: Record<string, unknown>;
  catalog: Record<string, unknown>;
  rawBindings: RawBrowserBinding[];
  releaseVersion: string;
  serviceSchemaVersion: number;
  openApiDigest: string;
  catalogDigest: string;
  features: string[];
  directCapabilityIds: string[];
}

export interface RawBrowserBinding {
  browserBindingId: string;
  extensionId: string;
  state: 'paired' | 'online' | 'offline';
  pairedAt: string;
  lastSeenAt: string | null;
}

export interface CollectorCoreCompatibilityPolicy {
  releaseVersion: string;
  serviceSchemaVersion: number;
  openApiVersion: string;
  openApiDigest: string;
  catalogDigest: string;
  requiredFeatures: readonly string[];
  directCapabilityCount: number;
}

export const DEFAULT_CORE_COMPATIBILITY_POLICY: CollectorCoreCompatibilityPolicy = Object.freeze({
  releaseVersion: SUPPORTED_CORE_RELEASE,
  serviceSchemaVersion: SUPPORTED_CORE_SERVICE_SCHEMA,
  openApiVersion: SUPPORTED_CORE_OPENAPI_VERSION,
  openApiDigest: SUPPORTED_CORE_OPENAPI_DIGEST,
  catalogDigest: SUPPORTED_CORE_CATALOG_DIGEST,
  requiredFeatures: REQUIRED_CORE_FEATURES,
  directCapabilityCount: 15
});

export function verifyCollectorCoreCompatibility(
  input: {
    release: unknown;
    catalog: unknown;
    openApi: unknown;
    bindings: unknown;
  },
  verifiedAt = new Date(),
  policy: CollectorCoreCompatibilityPolicy = DEFAULT_CORE_COMPATIBILITY_POLICY
): VerifiedCoreCompatibility {
  const release = requiredRecord(input.release);
  const catalog = requiredRecord(input.catalog);
  const openApi = requiredRecord(input.openApi);
  const service = requiredRecord(release.service);
  const compatibility = requiredRecord(release.compatibility);

  requireValue(release.schemaVersion === 1);
  requireValue(release.product === 'collector-core');
  requireValue(release.releaseVersion === policy.releaseVersion);
  requireValue(service.schemaVersion === policy.serviceSchemaVersion);
  requireValue(service.openApiVersion === policy.openApiVersion);
  requireValue(compatibility.schemaVersion === 1);
  requireValue(compatibility.digestAlgorithm === 'sha256-canonical-json-v1');

  const openApiDigest = digestString(compatibility.openApiSchemaDigest);
  const catalogDigest = digestString(compatibility.capabilityCatalogDigest);
  const features = uniqueStrings(compatibility.features);
  for (const required of policy.requiredFeatures) requireValue(features.includes(required));
  requireValue(openApiDigest === policy.openApiDigest);
  requireValue(catalogDigest === policy.catalogDigest);

  requireValue(openApi.openapi === '3.1.0');
  const { servers: _servers, ...originIndependentOpenApi } = openApi;
  requireValue(sha256Digest(originIndependentOpenApi) === openApiDigest);

  requireValue(catalog.schemaVersion === policy.serviceSchemaVersion);
  requireValue(digestString(catalog.catalogDigest) === catalogDigest);
  const capabilities = requiredArray(catalog.capabilities).map(requiredRecord);
  const directContracts = requiredArray(catalog.directContracts).map(requiredRecord);
  requireValue(directContracts.length === policy.directCapabilityCount);
  requireValue(sha256Digest({ capabilities, directContracts }) === catalogDigest);

  const directReadyIds = capabilities
    .filter((capability) => capability.dispatchState === 'direct_ready')
    .map((capability) => requiredString(capability.capability));
  requireValue(new Set(directReadyIds).size === directReadyIds.length);
  requireValue(directReadyIds.length === policy.directCapabilityCount);

  const schemas = requiredRecord(requiredRecord(openApi.components).schemas);
  const contractIds: string[] = [];
  for (const contract of directContracts) {
    const capability = requiredString(contract.capability);
    contractIds.push(capability);
    const schemaName = requestSchemaName(requiredString(contract.requestSchemaRef));
    const schema = requiredRecord(schemas[schemaName]);
    requireValue(digestString(contract.requestSchemaDigest) === sha256Digest(schema));
    const targets = uniqueStrings(contract.executionTargets);
    requireValue(targets.length > 0);
    const defaultTarget = requiredString(contract.defaultExecutionTarget);
    requireValue(targets.includes(defaultTarget));
    requireValue(contract.executionTargetMode === (targets.length === 1 ? 'fixed' : 'enum'));
    requireValue(
      contract.budgetPolicy === 'fixed_queue_budget' ||
      contract.budgetPolicy === 'input_bounded_queue_budget' ||
      contract.budgetPolicy === 'fixed_observation_budget'
    );
    const required = requiredArray(schema.required);
    const properties = requiredRecord(schema.properties);
    requireValue(required.includes('clientRequestId'));
    requireValue(requiredRecord(properties.clientRequestId).format === 'uuid');
  }
  requireValue(new Set(contractIds).size === contractIds.length);
  requireValue(sameSet(contractIds, directReadyIds));

  const rawBindings = verifyBindings(input.bindings);
  return {
    verifiedAt: verifiedAt.toISOString(),
    release: structuredClone(release),
    catalog: structuredClone(catalog),
    rawBindings,
    releaseVersion: policy.releaseVersion,
    serviceSchemaVersion: policy.serviceSchemaVersion,
    openApiDigest,
    catalogDigest,
    features: [...features],
    directCapabilityIds: [...contractIds]
  };
}

export function verifyBindings(value: unknown): RawBrowserBinding[] {
  const response = requiredRecord(value);
  requireValue(response.schemaVersion === SUPPORTED_CORE_SERVICE_SCHEMA);
  return requiredArray(response.bindings).map((entry) => {
    const binding = requiredRecord(entry);
    const browserBindingId = requiredString(binding.browserBindingId);
    const extensionId = requiredString(binding.extensionId);
    const state = binding.state;
    const pairedAt = requiredString(binding.pairedAt);
    requireValue(UUID_PATTERN.test(browserBindingId));
    requireValue(/^[a-p]{32}$/.test(extensionId));
    requireValue(state === 'paired' || state === 'online' || state === 'offline');
    requireValue(Number.isFinite(Date.parse(pairedAt)));
    requireValue(binding.lastSeenAt === null ||
      (typeof binding.lastSeenAt === 'string' && Number.isFinite(Date.parse(binding.lastSeenAt))));
    return {
      browserBindingId,
      extensionId,
      state,
      pairedAt,
      lastSeenAt: binding.lastSeenAt as string | null
    };
  });
}

function requestSchemaName(reference: string): string {
  const match = /^#\/components\/schemas\/([A-Za-z0-9_-]+)$/.exec(reference);
  if (!match) throw new CollectorMcpError('compatibility_unmet');
  return match[1]!;
}

function sameSet(left: string[], right: string[]): boolean {
  const expected = new Set(right);
  return left.length === expected.size && left.every((value) => expected.has(value));
}

function digestString(value: unknown): string {
  const result = requiredString(value);
  requireValue(DIGEST_PATTERN.test(result));
  return result;
}

function uniqueStrings(value: unknown): string[] {
  const values = requiredArray(value).map(requiredString);
  requireValue(new Set(values).size === values.length);
  return values;
}

function requiredArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new CollectorMcpError('compatibility_unmet');
  return value;
}

function requiredRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CollectorMcpError('compatibility_unmet');
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new CollectorMcpError('compatibility_unmet');
  }
  return value;
}

function requireValue(condition: boolean): asserts condition {
  if (!condition) throw new CollectorMcpError('compatibility_unmet');
}
