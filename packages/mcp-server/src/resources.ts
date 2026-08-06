import {
  ARTIFACT_RESOURCE_WINDOW_BYTES,
  BINDING_ALIAS_PATTERN,
  DIGEST_PATTERN,
  SAFE_CODE_PATTERN,
  UUID_PATTERN
} from './constants.js';
import type { VerifiedCoreCompatibility, RawBrowserBinding } from './compatibility.js';
import { verifyBindings } from './compatibility.js';
import type { CollectorCoreApi } from './core-client.js';
import { CollectorMcpError, stableErrorCode } from './errors.js';
import type { SafeLogger } from './logger.js';
import {
  artifactChunkResourceUri,
  artifactResourceUri,
  operationResourceUri,
  parseCollectorResourceUri
} from './resource-uri.js';

export interface CollectorResourceDocument {
  uri: string;
  mimeType: 'application/json';
  text: string;
}

export interface SafeBrowserBinding {
  bindingAlias: string;
  state: RawBrowserBinding['state'];
  pairedAt: string;
  lastSeenAt: string | null;
}

export class BindingAliasRegistry {
  readonly #aliases = new Map<string, string>();
  readonly #bindingIds = new Map<string, string>();
  readonly #states = new Map<string, RawBrowserBinding['state']>();
  #next = 1;

  project(bindings: RawBrowserBinding[]): SafeBrowserBinding[] {
    const seen = new Set<string>();
    for (const binding of [...bindings].sort((left, right) =>
      left.browserBindingId.localeCompare(right.browserBindingId))) {
      seen.add(binding.browserBindingId);
      if (!this.#aliases.has(binding.browserBindingId)) {
        const alias = `binding-${this.#next}`;
        this.#aliases.set(binding.browserBindingId, alias);
        this.#bindingIds.set(alias, binding.browserBindingId);
        this.#next += 1;
      }
      this.#states.set(binding.browserBindingId, binding.state);
    }
    for (const browserBindingId of this.#states.keys()) {
      if (!seen.has(browserBindingId)) this.#states.delete(browserBindingId);
    }
    return bindings.map((binding) => ({
      bindingAlias: this.#aliases.get(binding.browserBindingId)!,
      state: binding.state,
      pairedAt: binding.pairedAt,
      lastSeenAt: binding.lastSeenAt
    }));
  }

  resolve(bindingAlias: string): string {
    if (!BINDING_ALIAS_PATTERN.test(bindingAlias)) {
      throw new CollectorMcpError('binding_alias_not_found');
    }
    const browserBindingId = this.#bindingIds.get(bindingAlias);
    if (browserBindingId === undefined) throw new CollectorMcpError('binding_alias_not_found');
    return browserBindingId;
  }

  /**
   * Resolve the normal single-session case without forcing an Agent to turn
   * a read-only binding inventory into workflow state. Multiple online
   * bindings remain an explicit choice because silently selecting one could
   * send a public read to the wrong browser session.
   */
  resolveOnline(): { bindingAlias: string; browserBindingId: string } {
    const online = [...this.#states.entries()].filter(([, state]) => state === 'online');
    if (online.length === 0) throw new CollectorMcpError('binding_unavailable');
    if (online.length > 1) throw new CollectorMcpError('binding_selection_required');
    const [browserBindingId] = online[0]!;
    const bindingAlias = this.#aliases.get(browserBindingId);
    if (bindingAlias === undefined) throw new CollectorMcpError('binding_unavailable');
    return { bindingAlias, browserBindingId };
  }
}

export class CollectorResourceService {
  readonly #core: CollectorCoreApi;
  readonly #compatibility: VerifiedCoreCompatibility;
  readonly #aliases: BindingAliasRegistry;
  readonly #logger: SafeLogger;

  constructor(input: {
    core: CollectorCoreApi;
    compatibility: VerifiedCoreCompatibility;
    aliases: BindingAliasRegistry;
    logger: SafeLogger;
  }) {
    this.#core = input.core;
    this.#compatibility = input.compatibility;
    this.#aliases = input.aliases;
    this.#logger = input.logger;
  }

  async read(uri: string): Promise<CollectorResourceDocument> {
    const startedAt = Date.now();
    const address = parseCollectorResourceUri(uri);
    try {
      let payload: unknown;
      if (address.kind === 'release') {
        payload = {
          schemaVersion: 'collector.mcp.release/v1',
          verifiedAt: this.#compatibility.verifiedAt,
          release: this.#compatibility.release
        };
      } else if (address.kind === 'capabilities') {
        payload = {
          schemaVersion: 'collector.mcp.capabilities/v1',
          verifiedAt: this.#compatibility.verifiedAt,
          catalog: this.#compatibility.catalog
        };
      } else if (address.kind === 'bindings') {
        const bindings = verifyBindings(await this.#core.readBindings());
        payload = {
          schemaVersion: 'collector.mcp.bindings/v1',
          bindings: this.#aliases.project(bindings)
        };
      } else if (address.kind === 'operation') {
        payload = operationProjection(await this.#core.readOperation(address.operationId), address.operationId);
      } else if (address.kind === 'artifact_metadata') {
        payload = artifactMetadataProjection(
          await this.#core.readArtifactMetadata(address.artifactId),
          address.artifactId
        );
      } else {
        payload = artifactChunkProjection(
          await this.#core.readArtifactWindow(
            address.artifactId,
            address.cursor,
            ARTIFACT_RESOURCE_WINDOW_BYTES
          ),
          address.artifactId,
          address.cursor
        );
      }
      this.#logger.record('info', 'collector.mcp.resource_read', {
        resourceKind: address.kind,
        ...(address.kind === 'operation' ? { coreOperationId: address.operationId } : {}),
        ...(address.kind === 'artifact_metadata' || address.kind === 'artifact_chunk'
          ? { artifactId: address.artifactId }
          : {}),
        durationMs: Math.max(0, Date.now() - startedAt),
        outcome: 'completed'
      });
      return { uri, mimeType: 'application/json', text: JSON.stringify(payload) };
    } catch (error) {
      this.#logger.record('warn', 'collector.mcp.resource_read', {
        resourceKind: address.kind,
        ...(address.kind === 'operation' ? { coreOperationId: address.operationId } : {}),
        ...(address.kind === 'artifact_metadata' || address.kind === 'artifact_chunk'
          ? { artifactId: address.artifactId }
          : {}),
        durationMs: Math.max(0, Date.now() - startedAt),
        outcome: 'failed',
        errorCode: stableErrorCode(error)
      });
      throw error;
    }
  }
}

function operationProjection(value: unknown, expectedOperationId: string): Record<string, unknown> {
  const operation = record(value);
  const operationId = uuid(operation.operationId);
  if (operationId !== expectedOperationId) throw new CollectorMcpError('core_response_invalid');
  const state = operationState(operation.state);
  const capabilityId = safeIdentifier(operation.capability);
  const artifact = operation.artifact === null ? null : artifactReference(operation.artifact);
  return {
    schemaVersion: 'collector.mcp.operation/v1',
    operationId,
    capabilityId,
    platform: platform(operation.platform),
    executionTarget: safeIdentifier(operation.executionTarget),
    coreState: state,
    statusClass: state === 'queued' ? 'accepted' : state === 'claimed' ? 'running' : state,
    terminalReason: nullableSafeCode(operation.terminalReason),
    errorCode: nullableSafeCode(operation.errorCode),
    queuedAt: timestamp(operation.queuedAt),
    claimedAt: nullableTimestamp(operation.claimedAt),
    completedAt: nullableTimestamp(operation.completedAt),
    platformActionAttempted: null,
    artifact
  };
}

function artifactReference(value: unknown): Record<string, unknown> {
  const reference = record(value);
  const artifactId = uuid(reference.artifactId);
  return {
    artifactId,
    metadataResourceUri: artifactResourceUri(artifactId),
    summary: reference.summary === undefined ? null : sanitiseArtifactSummary(reference.summary)
  };
}

function artifactMetadataProjection(value: unknown, expectedArtifactId: string): Record<string, unknown> {
  const metadata = record(value);
  const artifactId = uuid(metadata.artifactId);
  if (artifactId !== expectedArtifactId || metadata.schemaVersion !== 1 ||
    metadata.mediaType !== 'application/json' || metadata.representation !== 'canonical_json_utf8' ||
    !safeInteger(metadata.byteLength, 0) || !digest(metadata.sha256) ||
    metadata.retentionClass !== 'core_managed_local' || metadata.retainedUntil !== null ||
    metadata.deletionState !== 'retained' || metadata.available !== true) {
    throw new CollectorMcpError('core_response_invalid');
  }
  return {
    schemaVersion: 'collector.mcp.artifact-metadata/v1',
    artifactId,
    operationId: metadata.operationId === null ? null : uuid(metadata.operationId),
    capabilityId: safeIdentifier(metadata.capability),
    mediaType: metadata.mediaType,
    representation: metadata.representation,
    byteLength: metadata.byteLength,
    sha256: metadata.sha256,
    capturedAt: nullableTimestamp(metadata.capturedAt),
    terminalStatus: nullableSafeCode(metadata.terminalStatus),
    retentionClass: metadata.retentionClass,
    retainedUntil: metadata.retainedUntil,
    deletionState: metadata.deletionState,
    available: metadata.available,
    firstChunkResourceUri: artifactChunkResourceUri(artifactId, 0)
  };
}

function artifactChunkProjection(
  value: unknown,
  expectedArtifactId: string,
  expectedOffset: number
): Record<string, unknown> {
  const window = record(value);
  const artifactId = uuid(window.artifactId);
  if (window.schemaVersion !== 1 || artifactId !== expectedArtifactId ||
    window.representation !== 'canonical_json_utf8' || window.encoding !== 'utf-8' ||
    window.offset !== expectedOffset || window.maximumBytes !== ARTIFACT_RESOURCE_WINDOW_BYTES ||
    !safeInteger(window.endExclusive, expectedOffset) || !safeInteger(window.byteLength, window.endExclusive as number) ||
    typeof window.text !== 'string' || Buffer.byteLength(window.text, 'utf8') > ARTIFACT_RESOURCE_WINDOW_BYTES ||
    !digest(window.sha256) || !digest(window.chunkSha256) || typeof window.truncated !== 'boolean') {
    throw new CollectorMcpError('core_response_invalid');
  }
  const nextOffset = window.nextOffset;
  if (nextOffset !== null && (!safeInteger(nextOffset, window.endExclusive as number) ||
    nextOffset !== window.endExclusive || nextOffset <= expectedOffset)) {
    throw new CollectorMcpError('core_response_invalid');
  }
  if (window.truncated !== (nextOffset !== null)) throw new CollectorMcpError('core_response_invalid');
  return {
    schemaVersion: 'collector.mcp.artifact-chunk/v1',
    artifactId,
    capabilityId: safeIdentifier(window.capability),
    representation: window.representation,
    encoding: window.encoding,
    range: {
      start: window.offset,
      endExclusive: window.endExclusive,
      totalBytes: window.byteLength
    },
    maximumBytes: window.maximumBytes,
    artifactSha256: window.sha256,
    chunkSha256: window.chunkSha256,
    truncated: window.truncated,
    nextCursor: nextOffset,
    nextChunkResourceUri: nextOffset === null ? null : artifactChunkResourceUri(artifactId, nextOffset),
    text: window.text
  };
}

function sanitiseArtifactSummary(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitiseArtifactSummary);
  if (!value || typeof value !== 'object') {
    return typeof value === 'number' || typeof value === 'boolean' || value === null ? value : undefined;
  }
  const forbidden = new Set([
    'browserBindingId', 'documentId', 'extensionId', 'input', 'path', 'profileId', 'query',
    'retrievalPath', 'tabId', 'token', 'url', 'windowId'
  ]);
  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (forbidden.has(key)) continue;
    if (typeof nested === 'string') {
      if ((key.endsWith('Id') && UUID_PATTERN.test(nested)) ||
        (key.toLowerCase().includes('sha256') && DIGEST_PATTERN.test(nested)) ||
        (key.endsWith('At') && Number.isFinite(Date.parse(nested))) ||
        ((key.endsWith('State') || key.endsWith('Status') || key.endsWith('Reason')) &&
          SAFE_CODE_PATTERN.test(nested))) {
        result[key] = nested;
      }
      continue;
    }
    const safe = sanitiseArtifactSummary(nested);
    if (safe !== undefined) result[key] = safe;
  }
  return result;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CollectorMcpError('core_response_invalid');
  }
  return value as Record<string, unknown>;
}

function uuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new CollectorMcpError('core_response_invalid');
  }
  return value;
}

function digest(value: unknown): value is string {
  return typeof value === 'string' && DIGEST_PATTERN.test(value);
}

function safeInteger(value: unknown, minimum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum;
}

function safeIdentifier(value: unknown): string {
  if (typeof value !== 'string' || !SAFE_CODE_PATTERN.test(value)) {
    throw new CollectorMcpError('core_response_invalid');
  }
  return value;
}

function nullableSafeCode(value: unknown): string | null {
  return value === null ? null : safeIdentifier(value);
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new CollectorMcpError('core_response_invalid');
  }
  return value;
}

function nullableTimestamp(value: unknown): string | null {
  return value === null ? null : timestamp(value);
}

function platform(value: unknown): 'bilibili' | 'xiaohongshu' | 'zhihu' | 'web' {
  if (value !== 'bilibili' && value !== 'xiaohongshu' && value !== 'zhihu' && value !== 'web') {
    throw new CollectorMcpError('core_response_invalid');
  }
  return value;
}

function operationState(value: unknown): 'queued' | 'claimed' | 'completed' | 'partial' | 'stopped' | 'failed' {
  if (value !== 'queued' && value !== 'claimed' && value !== 'completed' && value !== 'partial' &&
    value !== 'stopped' && value !== 'failed') {
    throw new CollectorMcpError('core_response_invalid');
  }
  return value;
}
