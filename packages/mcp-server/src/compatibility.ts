import {
  DIGEST_PATTERN,
  REQUIRED_CORE_FEATURES,
  SUPPORTED_CORE_OPENAPI_VERSION,
  SUPPORTED_CORE_CATALOG_DIGEST,
  SUPPORTED_CORE_OPENAPI_DIGEST,
  SUPPORTED_CORE_RELEASE,
  SUPPORTED_CORE_SERVICE_SCHEMA,
  SAFE_CODE_PATTERN,
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
  directContracts: VerifiedDirectCapabilityContract[];
}

export type LiveCapabilityRuntimeState = 'ready' | 'credential_required' | 'unknown';

export type VerifiedExecutionTargetMode = 'fixed' | 'enum';
export type VerifiedExecutionProvider = 'browser_extension' | 'official_api';
export type VerifiedBudgetPolicy =
  | 'fixed_queue_budget'
  | 'input_bounded_queue_budget'
  | 'fixed_observation_budget'
  | 'official_api_fixed_count';

export interface VerifiedDirectCapabilityContract {
  capabilityId: string;
  platform: 'bilibili' | 'xiaohongshu' | 'zhihu' | 'web';
  executionProvider: VerifiedExecutionProvider;
  requestSchemaName: string;
  requestSchemaDigest: string;
  requestSchema: Record<string, unknown>;
  executionTargets: string[];
  defaultExecutionTarget: string;
  executionTargetMode: VerifiedExecutionTargetMode;
  budgetPolicy: VerifiedBudgetPolicy;
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
  directCapabilityCount: 18
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
  requireValue(sha256Digest({
    capabilities: stableCapabilityCatalogProjection(capabilities),
    directContracts
  }) === catalogDigest);

  const directReadyIds = capabilities
    .filter((capability) => capability.dispatchState === 'direct_ready')
    .map((capability) => requiredString(capability.capability));
  requireValue(new Set(directReadyIds).size === directReadyIds.length);
  requireValue(directReadyIds.length === policy.directCapabilityCount);

  const schemas = requiredRecord(requiredRecord(openApi.components).schemas);
  const contractIds: string[] = [];
  const verifiedDirectContracts: VerifiedDirectCapabilityContract[] = [];
  for (const contract of directContracts) {
    const capability = requiredString(contract.capability);
    requireValue(SAFE_CODE_PATTERN.test(capability));
    contractIds.push(capability);
    const executionProvider = verifiedExecutionProvider(contract.executionProvider);
    const schemaName = requestSchemaName(requiredString(contract.requestSchemaRef));
    const schema = requiredRecord(schemas[schemaName]);
    const requestSchemaDigest = digestString(contract.requestSchemaDigest);
    requireValue(requestSchemaDigest === sha256Digest(schema));
    const targets = uniqueStrings(contract.executionTargets);
    requireValue(targets.length > 0);
    requireValue(targets.every((target) => SAFE_CODE_PATTERN.test(target)));
    const defaultTarget = requiredString(contract.defaultExecutionTarget);
    requireValue(targets.includes(defaultTarget));
    const executionTargetMode = verifiedExecutionTargetMode(contract.executionTargetMode);
    requireValue(executionTargetMode === (targets.length === 1 ? 'fixed' : 'enum'));
    requireValue(
      contract.budgetPolicy === 'fixed_queue_budget' ||
      contract.budgetPolicy === 'input_bounded_queue_budget' ||
      contract.budgetPolicy === 'fixed_observation_budget' ||
      contract.budgetPolicy === 'official_api_fixed_count'
    );
    requireValue(executionProvider === 'official_api'
      ? contract.budgetPolicy === 'official_api_fixed_count'
      : contract.budgetPolicy !== 'official_api_fixed_count');
    const platform = verifyDirectRequestEnvelope(
      schema,
      capability,
      targets,
      executionTargetMode,
      policy.serviceSchemaVersion,
      executionProvider
    );
    verifiedDirectContracts.push({
      capabilityId: capability,
      platform,
      executionProvider,
      requestSchemaName: schemaName,
      requestSchemaDigest,
      requestSchema: structuredClone(schema),
      executionTargets: [...targets],
      defaultExecutionTarget: defaultTarget,
      executionTargetMode,
      budgetPolicy: contract.budgetPolicy
    });
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
    directCapabilityIds: [...contractIds],
    directContracts: verifiedDirectContracts
  };
}

/**
 * Refresh only the operational readiness fields from a live Core catalog.
 *
 * The catalog digest deliberately excludes runtimeState, so a Gateway can be
 * configured after MCP startup without changing the released compatibility
 * identity. All stable fields still have to reproduce the verified digest;
 * only the live capability projections are allowed to differ.
 */
export function projectLiveCapabilityCatalog(
  verifiedCatalog: Record<string, unknown>,
  liveCatalogValue: unknown
): Record<string, unknown> {
  const liveCatalog = requiredRecord(liveCatalogValue);
  requireValue(liveCatalog.schemaVersion === verifiedCatalog.schemaVersion);
  const expectedDigest = digestString(verifiedCatalog.catalogDigest);
  requireValue(digestString(liveCatalog.catalogDigest) === expectedDigest);
  const capabilities = requiredArray(liveCatalog.capabilities).map(requiredRecord);
  const directContracts = requiredArray(liveCatalog.directContracts).map(requiredRecord);
  requireValue(sha256Digest({
    capabilities: stableCapabilityCatalogProjection(capabilities),
    directContracts
  }) === expectedDigest);

  const verifiedCapabilities = requiredArray(verifiedCatalog.capabilities).map(requiredRecord);
  const verifiedIds = verifiedCapabilities.map((capability) => requiredString(capability.capability));
  const liveIds = capabilities.map((capability) => requiredString(capability.capability));
  requireValue(sameSet(liveIds, verifiedIds));
  requireValue(new Set(liveIds).size === liveIds.length);
  for (const capability of capabilities) {
    if (capability.runtimeState !== undefined &&
      capability.runtimeState !== 'ready' && capability.runtimeState !== 'credential_required') {
      throw new CollectorMcpError('compatibility_unmet');
    }
  }

  const projected = structuredClone(verifiedCatalog);
  projected.capabilities = structuredClone(capabilities);
  return projected;
}

export function liveCapabilityRuntimeState(
  verifiedCatalog: Record<string, unknown>,
  liveCatalogValue: unknown,
  capabilityId: string
): LiveCapabilityRuntimeState {
  const projected = projectLiveCapabilityCatalog(verifiedCatalog, liveCatalogValue);
  const capabilities = requiredArray(projected.capabilities).map(requiredRecord);
  const capability = capabilities.find((entry) => entry.capability === capabilityId);
  if (capability === undefined) throw new CollectorMcpError('compatibility_unmet');
  if (capability.runtimeState === undefined) return 'unknown';
  return capability.runtimeState as LiveCapabilityRuntimeState;
}

/** Runtime readiness is operational state, not part of the released catalog identity. */
function stableCapabilityCatalogProjection(
  capabilities: Record<string, unknown>[]
): Record<string, unknown>[] {
  return capabilities.map((capability) => {
    if (Object.hasOwn(capability, 'runtimeState')) {
      const { runtimeState: _runtimeState, ...stable } = capability;
      return stable;
    }
    return { ...capability };
  });
}

function verifyDirectRequestEnvelope(
  schema: Record<string, unknown>,
  capability: string,
  executionTargets: string[],
  executionTargetMode: VerifiedExecutionTargetMode,
  serviceSchemaVersion: number,
  executionProvider: VerifiedExecutionProvider
): 'bilibili' | 'xiaohongshu' | 'zhihu' | 'web' {
  const envelopeFields = executionProvider === 'browser_extension'
    ? [
        'schemaVersion', 'clientRequestId', 'browserBindingId', 'platform', 'capability',
        'executionTarget', 'input'
      ]
    : ['schemaVersion', 'clientRequestId', 'platform', 'capability', 'executionTarget', 'input'];
  requireValue(schema.type === 'object' && schema.additionalProperties === false);
  const required = requiredArray(schema.required).map(requiredString);
  const properties = requiredRecord(schema.properties);
  requireValue(sameSet(required, envelopeFields));
  requireValue(sameSet(Object.keys(properties), envelopeFields));
  requireValue(requiredRecord(properties.schemaVersion).const === serviceSchemaVersion);
  requireValue(requiredRecord(properties.clientRequestId).format === 'uuid');
  if (executionProvider === 'browser_extension') {
    requireValue(requiredRecord(properties.browserBindingId).format === 'uuid');
  } else {
    requireValue(!Object.hasOwn(properties, 'browserBindingId'));
  }
  requireValue(requiredRecord(properties.capability).const === capability);

  const platform = requiredRecord(properties.platform).const;
  requireValue(executionProvider === 'browser_extension'
    ? platform === 'bilibili' || platform === 'xiaohongshu'
    : platform === 'zhihu' || platform === 'web');

  const targetSchema = requiredRecord(properties.executionTarget);
  if (executionTargetMode === 'fixed') {
    requireValue(targetSchema.const === executionTargets[0]);
  } else {
    requireValue(sameSet(uniqueStrings(targetSchema.enum), executionTargets));
  }
  if (executionProvider === 'official_api') {
    requireValue(executionTargetMode === 'fixed' && executionTargets[0] === 'official_api');
  }

  const input = requiredRecord(properties.input);
  requireValue(input.type === 'object' && input.additionalProperties === false);
  requiredRecord(input.properties);
  if (input.required !== undefined) requiredArray(input.required).map(requiredString);
  return platform as 'bilibili' | 'xiaohongshu' | 'zhihu' | 'web';
}

function verifiedExecutionProvider(value: unknown): VerifiedExecutionProvider {
  if (value !== 'browser_extension' && value !== 'official_api') {
    throw new CollectorMcpError('compatibility_unmet');
  }
  return value;
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

function verifiedExecutionTargetMode(value: unknown): VerifiedExecutionTargetMode {
  if (value !== 'fixed' && value !== 'enum') {
    throw new CollectorMcpError('compatibility_unmet');
  }
  return value;
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
