import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';

export const TERMINAL_STATES = new Set(['completed', 'partial', 'stopped', 'failed']);
export const ARTIFACT_WINDOW_BYTES = 16_384;
const MAXIMUM_ARTIFACT_BYTES = 32 * 1024 * 1024;

export class LiveMatrixError extends Error {
  constructor(code, details) {
    super(code);
    this.name = 'LiveMatrixError';
    this.code = code;
    this.details = details;
  }
}

export class OneShotToolSubmission {
  attempted = false;

  async call(client, request) {
    if (this.attempted) throw new LiveMatrixError('collector_l3_multiple_tool_submissions_blocked');
    this.attempted = true;
    return client.callTool(request);
  }
}

export function parseLiveMatrixArguments(argumentsList) {
  if (argumentsList.length === 1 && argumentsList[0] === '--list') {
    return { mode: 'list', caseId: null };
  }
  let caseId;
  let execute = false;
  let reconcile = false;
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--case' && caseId === undefined) {
      caseId = argumentsList[index + 1];
      index += 1;
    } else if (argument === '--execute-live' && !execute) {
      execute = true;
    } else if (argument === '--reconcile-live' && !reconcile) {
      reconcile = true;
    } else {
      throw new LiveMatrixError('collector_l3_invocation_invalid');
    }
  }
  if (typeof caseId !== 'string' || caseId.length === 0 || execute === reconcile) {
    throw new LiveMatrixError('collector_l3_explicit_case_and_mode_required');
  }
  return { mode: reconcile ? 'reconcile' : 'execute', caseId };
}

export function selectUniqueOnlineBinding(document, requestedAlias) {
  if (document?.schemaVersion !== 'collector.mcp.bindings/v1' || !Array.isArray(document.bindings)) {
    throw new LiveMatrixError('collector_l3_bindings_resource_invalid');
  }
  const online = document.bindings.filter((binding) => binding?.state === 'online');
  if (requestedAlias !== undefined) {
    if (!/^binding-[1-9][0-9]*$/.test(requestedAlias) ||
      !online.some((binding) => binding.bindingAlias === requestedAlias)) {
      throw new LiveMatrixError('collector_l3_requested_binding_not_online');
    }
    return requestedAlias;
  }
  if (online.length !== 1) {
    throw new LiveMatrixError(online.length === 0
      ? 'collector_l3_online_binding_missing'
      : 'collector_l3_online_binding_ambiguous');
  }
  return requiredString(online[0].bindingAlias, 'collector_l3_binding_alias_invalid');
}

export function verifyCaseAgainstLiveCatalog(caseDefinition, capabilities, tools, argumentsRecord) {
  if (capabilities?.schemaVersion !== 'collector.mcp.capabilities/v1' ||
    !Array.isArray(capabilities.catalog?.directContracts) ||
    !capabilities.catalog.directContracts.some((contract) =>
      contract.capability === caseDefinition.capabilityId)) {
    throw new LiveMatrixError('collector_l3_capability_preflight_invalid');
  }
  const tool = tools.find((candidate) => candidate.name === caseDefinition.toolId);
  if (!tool || tool._meta?.['collector/capabilityId'] !== caseDefinition.capabilityId ||
    tool._meta?.['collector/toolCatalogVersion'] !== 'collector.mcp.tools/v1' ||
    typeof tool._meta?.['collector/inputSchemaDigest'] !== 'string') {
    throw new LiveMatrixError('collector_l3_tool_preflight_invalid');
  }
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  ajv.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  const validate = ajv.compile(tool.inputSchema);
  if (!validate(argumentsRecord)) {
    throw new LiveMatrixError('collector_l3_case_does_not_match_live_tool_schema', {
      schemaErrors: (validate.errors ?? []).map((error) => ({
        instancePath: error.instancePath,
        keyword: error.keyword,
        schemaPath: error.schemaPath
      }))
    });
  }
  return {
    inputSchemaDigest: tool._meta['collector/inputSchemaDigest'],
    requiredFields: [...tool.inputSchema.required]
  };
}

export function parseResource(result) {
  if (!result || !Array.isArray(result.contents) || result.contents.length !== 1 ||
    result.contents[0].mimeType !== 'application/json' || typeof result.contents[0].text !== 'string') {
    throw new LiveMatrixError('collector_l3_resource_shape_invalid');
  }
  try {
    return JSON.parse(result.contents[0].text);
  } catch {
    throw new LiveMatrixError('collector_l3_resource_json_invalid');
  }
}

export function parseSubmission(result, expected) {
  const submission = result?.structuredContent;
  if (!submission || typeof submission !== 'object' || Array.isArray(submission) ||
    submission.accepted !== true || submission.clientRequestId !== expected.clientRequestId ||
    submission.capabilityId !== expected.capabilityId ||
    submission.idempotentReplay !== expected.idempotentReplay) {
    throw new LiveMatrixError('collector_l3_submission_response_invalid');
  }
  const operationId = requiredUuid(submission.operationId, 'collector_l3_operation_id_invalid');
  if (expected.operationId !== undefined && operationId !== expected.operationId) {
    throw new LiveMatrixError('collector_l3_reconciled_operation_mismatch');
  }
  const operationResourceUri = requiredString(
    submission.operationResourceUri,
    'collector_l3_operation_uri_invalid'
  );
  if (operationResourceUri !== `collector://operations/${operationId}`) {
    throw new LiveMatrixError('collector_l3_operation_uri_invalid');
  }
  return { operationId, operationResourceUri, idempotentReplay: submission.idempotentReplay };
}

export function verifyOperation(operation, expected) {
  if (operation?.schemaVersion !== 'collector.mcp.operation/v1' ||
    operation.operationId !== expected.operationId ||
    operation.capabilityId !== expected.capabilityId ||
    (operation.coreState !== 'queued' && operation.coreState !== 'claimed' &&
      !TERMINAL_STATES.has(operation.coreState))) {
    throw new LiveMatrixError('collector_l3_operation_resource_invalid');
  }
  return operation;
}

export function projectOperationEvidence(operation) {
  return {
    operationId: operation.operationId,
    capabilityId: operation.capabilityId,
    coreState: operation.coreState,
    statusClass: operation.statusClass,
    terminalReason: operation.terminalReason,
    errorCode: operation.errorCode,
    queuedAt: operation.queuedAt,
    claimedAt: operation.claimedAt,
    completedAt: operation.completedAt,
    platformActionAttempted: operation.platformActionAttempted
  };
}

export async function readAndVerifyArtifact(readResource, metadataUri, expected) {
  const metadata = parseResource(await readResource(metadataUri));
  verifyArtifactMetadata(metadata, expected);
  if (metadata.byteLength > MAXIMUM_ARTIFACT_BYTES) {
    throw new LiveMatrixError('collector_l3_artifact_exceeds_matrix_read_ceiling', {
      byteLength: metadata.byteLength,
      maximumBytes: MAXIMUM_ARTIFACT_BYTES
    });
  }

  const artifactHash = createHash('sha256');
  const seenUris = new Set();
  const chunks = [];
  let nextUri = metadata.firstChunkResourceUri;
  let expectedStart = 0;
  while (nextUri !== null) {
    if (seenUris.has(nextUri)) throw new LiveMatrixError('collector_l3_artifact_cursor_cycle');
    seenUris.add(nextUri);
    const chunk = parseResource(await readResource(nextUri));
    verifyArtifactChunk(chunk, metadata, expectedStart);
    const bytes = Buffer.from(chunk.text, 'utf8');
    artifactHash.update(bytes);
    chunks.push({
      range: chunk.range,
      chunkSha256: chunk.chunkSha256,
      truncated: chunk.truncated,
      nextCursor: chunk.nextCursor
    });
    expectedStart = chunk.range.endExclusive;
    nextUri = chunk.nextChunkResourceUri;
  }
  const reconstructedSha256 = `sha256:${artifactHash.digest('hex')}`;
  if (expectedStart !== metadata.byteLength || reconstructedSha256 !== metadata.sha256) {
    throw new LiveMatrixError('collector_l3_artifact_full_hash_invalid', {
      verifiedBytes: expectedStart,
      expectedBytes: metadata.byteLength,
      reconstructedSha256,
      expectedSha256: metadata.sha256
    });
  }
  return {
    metadata: {
      artifactId: metadata.artifactId,
      operationId: metadata.operationId,
      capabilityId: metadata.capabilityId,
      byteLength: metadata.byteLength,
      sha256: metadata.sha256,
      capturedAt: metadata.capturedAt,
      terminalStatus: metadata.terminalStatus,
      retentionClass: metadata.retentionClass,
      deletionState: metadata.deletionState,
      available: metadata.available
    },
    chunks: {
      count: chunks.length,
      verifiedBytes: expectedStart,
      reconstructedSha256,
      multiChunk: chunks.length > 1,
      first: chunks[0] ?? null,
      last: chunks.at(-1) ?? null
    }
  };
}

export function inputEvidence(argumentsRecord) {
  const safeEnums = new Set(['executionTarget', 'listType']);
  return Object.fromEntries(Object.entries(argumentsRecord)
    .filter(([field]) => field !== 'bindingAlias' && field !== 'clientRequestId')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([field, value]) => [field, safeEnums.has(field)
      ? value
      : typeof value === 'string' ? sha256(value) : value]));
}

export function safeErrorCode(error) {
  if (error instanceof LiveMatrixError) return error.code;
  const message = error instanceof Error ? error.message : '';
  for (const code of [
    'authentication_failed', 'binding_alias_not_found', 'compatibility_unmet', 'core_unavailable',
    'permission_denied', 'request_rejected', 'submission_conflict', 'submission_outcome_unknown',
    'tool_input_invalid'
  ]) {
    if (message.includes(code)) return code;
  }
  return 'collector_l3_unexpected_failure';
}

export function requiredUuid(value, code) {
  if (typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new LiveMatrixError(code);
  }
  return value;
}

export function sha256(value) {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function verifyArtifactMetadata(metadata, expected) {
  if (metadata?.schemaVersion !== 'collector.mcp.artifact-metadata/v1' ||
    metadata.artifactId !== expected.artifactId || metadata.operationId !== expected.operationId ||
    metadata.capabilityId !== expected.capabilityId || metadata.mediaType !== 'application/json' ||
    metadata.representation !== 'canonical_json_utf8' || metadata.available !== true ||
    metadata.deletionState !== 'retained' || !Number.isSafeInteger(metadata.byteLength) ||
    metadata.byteLength < 1 || !/^sha256:[a-f0-9]{64}$/.test(metadata.sha256) ||
    metadata.firstChunkResourceUri !== `collector://artifacts/${expected.artifactId}/chunks/0`) {
    throw new LiveMatrixError('collector_l3_artifact_metadata_invalid');
  }
}

function verifyArtifactChunk(chunk, metadata, expectedStart) {
  const textBytes = typeof chunk?.text === 'string' ? Buffer.byteLength(chunk.text, 'utf8') : -1;
  const endExclusive = chunk?.range?.endExclusive;
  const expectedNextUri = chunk?.nextCursor === null
    ? null
    : `collector://artifacts/${metadata.artifactId}/chunks/${chunk?.nextCursor}`;
  if (chunk?.schemaVersion !== 'collector.mcp.artifact-chunk/v1' ||
    chunk.artifactId !== metadata.artifactId || chunk.capabilityId !== metadata.capabilityId ||
    chunk.representation !== 'canonical_json_utf8' || chunk.encoding !== 'utf-8' ||
    chunk.artifactSha256 !== metadata.sha256 || chunk.range?.start !== expectedStart ||
    chunk.range?.totalBytes !== metadata.byteLength || chunk.maximumBytes !== ARTIFACT_WINDOW_BYTES ||
    typeof chunk.text !== 'string' || !Number.isSafeInteger(endExclusive) ||
    endExclusive <= expectedStart ||
    endExclusive - expectedStart !== textBytes || textBytes > ARTIFACT_WINDOW_BYTES ||
    chunk.chunkSha256 !== sha256(chunk.text) ||
    chunk.truncated !== (chunk.nextCursor !== null) ||
    (chunk.nextCursor !== null && chunk.nextCursor !== endExclusive) ||
    chunk.nextChunkResourceUri !== expectedNextUri) {
    throw new LiveMatrixError('collector_l3_artifact_chunk_invalid', { expectedStart });
  }
}

function requiredString(value, code) {
  if (typeof value !== 'string' || value.length === 0) throw new LiveMatrixError(code);
  return value;
}
