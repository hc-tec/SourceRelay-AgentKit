import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StdioClientTransport,
  getDefaultEnvironment
} from '@modelcontextprotocol/sdk/client/stdio.js';

const repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const argumentsList = process.argv.slice(2);
const executeLive = argumentsList.includes('--execute-live');
const reconcileLive = argumentsList.includes('--reconcile-live');
const unknownArguments = argumentsList.filter((argument) =>
  argument !== '--execute-live' && argument !== '--reconcile-live');
const coreOrigin = process.env.COLLECTOR_CORE_ORIGIN ?? 'http://127.0.0.1:43127';
const coreToken = process.env.COLLECTOR_CORE_TOKEN ?? '';
const query = process.env.COLLECTOR_L3_BILIBILI_QUERY ?? '人工智能';
const suppliedClientRequestId = process.env.COLLECTOR_L3_CLIENT_REQUEST_ID;
const clientRequestId = suppliedClientRequestId ?? randomUUID();
const requestedBindingAlias = process.env.COLLECTOR_L3_BINDING_ALIAS;
const expectedOperationId = process.env.COLLECTOR_L3_EXPECTED_OPERATION_ID;
const expectedArtifactId = process.env.COLLECTOR_L3_EXPECTED_ARTIFACT_ID;
const toolId = 'collector_bilibili_native_search';
const capabilityId = 'bilibili.native_search';
const terminalStates = new Set(['completed', 'partial', 'stopped', 'failed']);
const operationDeadlineMs = 120_000;
const pollIntervalMs = 1_000;

class L3CanaryError extends Error {
  constructor(code, details) {
    super(code);
    this.name = 'L3CanaryError';
    this.code = code;
    this.details = details;
  }
}

const run = {
  runId: randomUUID(),
  objective: 'Prove one packaged MCP Bilibili Tool to terminal Operation and bounded Artifact path.',
  platform: 'bilibili',
  targetRole: 'search',
  browserMode: 'production user-owned browser with paired MV3',
  browserLifecycle: 'managed_profile_session',
  extensionInteractionLoaded: true,
  existingPlatformRunnerUsed: true,
  canaryMode: reconcileLive ? 'idempotent_reconciliation' : 'new_live_submission',
  toolCallAttempted: false,
  operationAccepted: false,
  clientRequestId,
  operationId: null,
  artifactId: null,
  startedAt: new Date().toISOString()
};

let temporaryRoot;
let client;
let mcpStderr = '';

try {
  validateInvocation();
  temporaryRoot = await mkdtemp(join(tmpdir(), 'collector-mcp-l3-'));
  const packageDirectory = join(temporaryRoot, 'packages');
  const consumerDirectory = join(temporaryRoot, 'consumer');
  const mcpEntrypoint = await installPackagedMcp(packageDirectory, consumerDirectory);

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [mcpEntrypoint],
    cwd: consumerDirectory,
    env: {
      ...getDefaultEnvironment(),
      COLLECTOR_CORE_ORIGIN: coreOrigin,
      COLLECTOR_CORE_TOKEN: coreToken
    },
    stderr: 'pipe'
  });
  transport.stderr?.on('data', (chunk) => { mcpStderr += String(chunk); });
  client = new Client({ name: 'collector-mcp-real-bilibili-l3', version: '1.0.0' });
  await client.connect(transport);

  const release = parseResource(await client.readResource({ uri: 'collector://release' }));
  const capabilities = parseResource(await client.readResource({ uri: 'collector://capabilities' }));
  const bindings = parseResource(await client.readResource({ uri: 'collector://bindings' }));
  const tools = await client.listTools();
  verifyLivePreflight(release, capabilities, tools.tools);
  const bindingAlias = selectOnlineBinding(bindings, requestedBindingAlias);

  process.stdout.write(`${JSON.stringify({
    event: 'collector_l3_submission_planned',
    runId: run.runId,
    toolId,
    capabilityId,
    bindingAlias,
    clientRequestId,
    querySha256: sha256(query),
    maximumToolSubmissions: 1,
    expectedIdempotentReplay: reconcileLive
  })}\n`);

  run.toolCallAttempted = true;
  const toolResult = await client.callTool({
    name: toolId,
    arguments: { bindingAlias, clientRequestId, query }
  });
  const submission = parseSubmission(toolResult);
  run.operationAccepted = true;
  run.operationId = submission.operationId;

  const operation = await waitForTerminalOperation(submission.operationResourceUri);
  const operationEvidence = projectOperationEvidence(operation);
  if (operation.coreState === 'stopped' || operation.coreState === 'failed') {
    throw new L3CanaryError('collector_l3_platform_terminal_failure', operationEvidence);
  }
  if (!operation.artifact || typeof operation.artifact !== 'object') {
    throw new L3CanaryError('collector_l3_terminal_artifact_missing', operationEvidence);
  }

  const artifactId = requiredUuid(operation.artifact.artifactId, 'collector_l3_artifact_id_invalid');
  if (expectedArtifactId !== undefined && artifactId !== expectedArtifactId) {
    throw new L3CanaryError('collector_l3_reconciled_artifact_mismatch');
  }
  run.artifactId = artifactId;
  const metadata = parseResource(await client.readResource({
    uri: requiredString(operation.artifact.metadataResourceUri, 'collector_l3_artifact_uri_invalid')
  }));
  verifyArtifactMetadata(metadata, artifactId, operation.operationId);
  const chunk = parseResource(await client.readResource({ uri: metadata.firstChunkResourceUri }));
  verifyArtifactChunk(chunk, metadata);

  await closeMcpAndVerifyLogs();
  client = undefined;
  run.finishedAt = new Date().toISOString();
  process.stdout.write(`${JSON.stringify({
    ok: true,
    gate: 'collector-mcp-real-bilibili-l3',
    run: {
      ...run,
      outcome: 'proved',
      toolId,
      capabilityId,
      maximumToolSubmissions: 1,
      toolCallAttempts: 1,
      acceptedOperations: 1,
      idempotentReplay: submission.idempotentReplay,
      newPlatformActionsExpected: reconcileLive ? 0 : 1,
      automaticSubmissionRetries: 0,
      browserAndGatewayRetained: true
    },
    operation: operationEvidence,
    artifact: {
      artifactId: metadata.artifactId,
      capabilityId: metadata.capabilityId,
      byteLength: metadata.byteLength,
      sha256: metadata.sha256,
      capturedAt: metadata.capturedAt,
      terminalStatus: metadata.terminalStatus,
      retentionClass: metadata.retentionClass,
      firstChunk: {
        range: chunk.range,
        chunkSha256: chunk.chunkSha256,
        truncated: chunk.truncated,
        nextCursor: chunk.nextCursor
      }
    },
    contentExposedInCanaryOutput: false
  }, null, 2)}\n`);
} catch (error) {
  const details = error instanceof L3CanaryError ? error.details : undefined;
  run.finishedAt = new Date().toISOString();
  process.stderr.write(`${JSON.stringify({
    ok: false,
    gate: 'collector-mcp-real-bilibili-l3',
    error: safeErrorCode(error),
    run: {
      ...run,
      outcome: run.operationAccepted ? 'inconclusive' : 'blocked',
      maximumToolSubmissions: 1,
      toolCallAttempts: run.toolCallAttempted ? 1 : 0,
      acceptedOperations: run.operationAccepted ? 1 : 0,
      automaticSubmissionRetries: 0,
      browserAndGatewayRetained: true
    },
    ...(details === undefined ? {} : { details })
  }, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  if (client) {
    await client.close().catch(() => undefined);
    client = undefined;
  }
  if (coreToken.length > 0 && mcpStderr.includes(coreToken)) {
    process.stderr.write(`${JSON.stringify({
      ok: false,
      gate: 'collector-mcp-real-bilibili-l3',
      error: 'collector_l3_secret_in_mcp_log'
    })}\n`);
    process.exitCode = 1;
  }
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
}

function validateInvocation() {
  if (executeLive === reconcileLive || unknownArguments.length > 0) {
    throw new L3CanaryError('collector_l3_explicit_execute_flag_required');
  }
  if (coreOrigin !== 'http://127.0.0.1:43127') {
    throw new L3CanaryError('collector_l3_production_core_origin_required');
  }
  if (!/^cst_[A-Za-z0-9_-]{43}$/.test(coreToken)) {
    throw new L3CanaryError('collector_l3_core_token_required');
  }
  requiredUuid(clientRequestId, 'collector_l3_client_request_id_invalid');
  if (reconcileLive) {
    if (suppliedClientRequestId === undefined || expectedOperationId === undefined ||
        expectedArtifactId === undefined) {
      throw new L3CanaryError('collector_l3_reconciliation_identity_required');
    }
    requiredUuid(expectedOperationId, 'collector_l3_expected_operation_id_invalid');
    requiredUuid(expectedArtifactId, 'collector_l3_expected_artifact_id_invalid');
  } else if (expectedOperationId !== undefined || expectedArtifactId !== undefined) {
    throw new L3CanaryError('collector_l3_unexpected_reconciliation_identity');
  }
  if (Buffer.byteLength(query, 'utf8') < 1 || Buffer.byteLength(query, 'utf8') > 120) {
    throw new L3CanaryError('collector_l3_query_invalid');
  }
  if (requestedBindingAlias !== undefined && !/^binding-[1-9][0-9]*$/.test(requestedBindingAlias)) {
    throw new L3CanaryError('collector_l3_binding_alias_invalid');
  }
}

async function installPackagedMcp(packageDirectory, consumerDirectory) {
  await mkdir(packageDirectory, { recursive: true });
  await runNpm([
    'pack', '--workspace', '@collector-ai-integration/mcp-server', '--pack-destination', packageDirectory
  ], repositoryRoot);
  const packageNames = (await readdir(packageDirectory)).filter((name) => name.endsWith('.tgz'));
  if (packageNames.length !== 1) throw new L3CanaryError('collector_l3_mcp_package_missing');
  const packagePath = join(packageDirectory, packageNames[0]);
  await runNpm([
    'install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', consumerDirectory, packagePath
  ], repositoryRoot);
  const entrypoint = join(
    consumerDirectory,
    'node_modules',
    '@collector-ai-integration',
    'mcp-server',
    'dist',
    'src',
    'cli.js'
  );
  await access(entrypoint);
  return entrypoint;
}

function verifyLivePreflight(release, capabilities, tools) {
  if (release.schemaVersion !== 'collector.mcp.release/v1' ||
      release.release?.releaseVersion !== '0.7.17' ||
      release.release?.service?.schemaVersion !== 3) {
    throw new L3CanaryError('collector_l3_release_preflight_invalid');
  }
  if (capabilities.schemaVersion !== 'collector.mcp.capabilities/v1' ||
      !Array.isArray(capabilities.catalog?.directContracts) ||
      !capabilities.catalog.directContracts.some((contract) => contract.capability === capabilityId)) {
    throw new L3CanaryError('collector_l3_capability_preflight_invalid');
  }
  const tool = tools.find((candidate) => candidate.name === toolId);
  if (!tool || tool._meta?.['collector/capabilityId'] !== capabilityId ||
      tool._meta?.['collector/toolCatalogVersion'] !== 'collector.mcp.tools/v1') {
    throw new L3CanaryError('collector_l3_tool_preflight_invalid');
  }
}

function selectOnlineBinding(document, requestedAlias) {
  if (document.schemaVersion !== 'collector.mcp.bindings/v1' || !Array.isArray(document.bindings)) {
    throw new L3CanaryError('collector_l3_bindings_resource_invalid');
  }
  const online = document.bindings.filter((binding) => binding?.state === 'online');
  if (requestedAlias !== undefined) {
    if (!online.some((binding) => binding.bindingAlias === requestedAlias)) {
      throw new L3CanaryError('collector_l3_requested_binding_not_online');
    }
    return requestedAlias;
  }
  if (online.length !== 1) {
    throw new L3CanaryError(
      online.length === 0 ? 'collector_l3_online_binding_missing' : 'collector_l3_online_binding_ambiguous'
    );
  }
  return requiredString(online[0].bindingAlias, 'collector_l3_binding_alias_invalid');
}

function parseSubmission(result) {
  const submission = result?.structuredContent;
  if (!submission || typeof submission !== 'object' || Array.isArray(submission) ||
      submission.accepted !== true || submission.clientRequestId !== clientRequestId ||
      submission.capabilityId !== capabilityId || submission.idempotentReplay !== reconcileLive) {
    throw new L3CanaryError('collector_l3_submission_response_invalid');
  }
  const operationId = requiredUuid(submission.operationId, 'collector_l3_operation_id_invalid');
  if (expectedOperationId !== undefined && operationId !== expectedOperationId) {
    throw new L3CanaryError('collector_l3_reconciled_operation_mismatch');
  }
  const operationResourceUri = requiredString(
    submission.operationResourceUri,
    'collector_l3_operation_uri_invalid'
  );
  if (operationResourceUri !== `collector://operations/${operationId}`) {
    throw new L3CanaryError('collector_l3_operation_uri_invalid');
  }
  return { operationId, operationResourceUri, idempotentReplay: submission.idempotentReplay };
}

async function waitForTerminalOperation(operationResourceUri) {
  const deadline = Date.now() + operationDeadlineMs;
  let previousState = null;
  while (Date.now() < deadline) {
    const operation = parseResource(await client.readResource({ uri: operationResourceUri }));
    if (operation.schemaVersion !== 'collector.mcp.operation/v1' ||
        operation.operationId !== run.operationId || operation.capabilityId !== capabilityId) {
      throw new L3CanaryError('collector_l3_operation_resource_invalid');
    }
    if (previousState === 'claimed' && operation.coreState === 'queued') {
      throw new L3CanaryError('collector_l3_operation_state_regressed');
    }
    previousState = operation.coreState;
    if (terminalStates.has(operation.coreState)) return operation;
    if (operation.coreState !== 'queued' && operation.coreState !== 'claimed') {
      throw new L3CanaryError('collector_l3_operation_state_invalid');
    }
    await delay(pollIntervalMs);
  }
  throw new L3CanaryError('collector_l3_operation_deadline_exceeded', {
    operationId: run.operationId,
    lastCoreState: previousState
  });
}

function projectOperationEvidence(operation) {
  return {
    operationId: operation.operationId,
    capabilityId: operation.capabilityId,
    coreState: operation.coreState,
    statusClass: operation.statusClass,
    terminalReason: operation.terminalReason,
    errorCode: operation.errorCode,
    queuedAt: operation.queuedAt,
    claimedAt: operation.claimedAt,
    completedAt: operation.completedAt
  };
}

function verifyArtifactMetadata(metadata, expectedArtifactId, expectedOperationId) {
  if (metadata.schemaVersion !== 'collector.mcp.artifact-metadata/v1' ||
      metadata.artifactId !== expectedArtifactId || metadata.operationId !== expectedOperationId ||
      metadata.capabilityId !== capabilityId || metadata.mediaType !== 'application/json' ||
      metadata.representation !== 'canonical_json_utf8' || metadata.available !== true ||
      !Number.isSafeInteger(metadata.byteLength) || metadata.byteLength < 1 ||
      !/^sha256:[a-f0-9]{64}$/.test(metadata.sha256) ||
      metadata.firstChunkResourceUri !== `collector://artifacts/${expectedArtifactId}/chunks/0`) {
    throw new L3CanaryError('collector_l3_artifact_metadata_invalid');
  }
}

function verifyArtifactChunk(chunk, metadata) {
  if (chunk.schemaVersion !== 'collector.mcp.artifact-chunk/v1' ||
      chunk.artifactId !== metadata.artifactId || chunk.capabilityId !== capabilityId ||
      chunk.representation !== 'canonical_json_utf8' || chunk.encoding !== 'utf-8' ||
      chunk.artifactSha256 !== metadata.sha256 || chunk.range?.start !== 0 ||
      chunk.range?.totalBytes !== metadata.byteLength || chunk.maximumBytes !== 16_384 ||
      typeof chunk.text !== 'string' || Buffer.byteLength(chunk.text, 'utf8') < 1 ||
      chunk.chunkSha256 !== sha256(chunk.text)) {
    throw new L3CanaryError('collector_l3_artifact_chunk_invalid');
  }
}

async function closeMcpAndVerifyLogs() {
  const activeClient = client;
  client = undefined;
  await activeClient.close();
  if (mcpStderr.includes(coreToken)) throw new L3CanaryError('collector_l3_secret_in_mcp_log');
  const lines = mcpStderr.split(/\r?\n/).filter(Boolean);
  const events = lines.map((line) => JSON.parse(line));
  const eventNames = new Set(events.map((event) => event.eventType));
  for (const requiredEvent of [
    'collector.mcp.preflight_completed',
    'collector.mcp.started',
    'collector.mcp.tool_submitted',
    'collector.mcp.resource_read'
  ]) {
    if (!eventNames.has(requiredEvent)) throw new L3CanaryError('collector_l3_structured_log_missing');
  }
}

function parseResource(result) {
  if (result.contents.length !== 1 || result.contents[0].mimeType !== 'application/json' ||
      typeof result.contents[0].text !== 'string') {
    throw new L3CanaryError('collector_l3_resource_shape_invalid');
  }
  return JSON.parse(result.contents[0].text);
}

function requiredUuid(value, code) {
  if (typeof value !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new L3CanaryError(code);
  }
  return value;
}

function requiredString(value, code) {
  if (typeof value !== 'string' || value.length === 0) throw new L3CanaryError(code);
  return value;
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function safeErrorCode(error) {
  if (error instanceof L3CanaryError) return error.code;
  const message = error instanceof Error ? error.message : '';
  for (const code of [
    'authentication_failed',
    'binding_alias_not_found',
    'compatibility_unmet',
    'core_unavailable',
    'permission_denied',
    'request_rejected',
    'submission_conflict',
    'submission_outcome_unknown',
    'tool_input_invalid'
  ]) {
    if (message.includes(code)) return code;
  }
  return 'collector_l3_unexpected_failure';
}

function runNpm(args, cwd) {
  const command = process.env.npm_execpath
    ? process.execPath
    : process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const commandArgs = process.env.npm_execpath ? [process.env.npm_execpath, ...args] : args;
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, commandArgs, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += String(chunk); });
    child.stderr.on('data', (chunk) => { output += String(chunk); });
    child.once('error', rejectRun);
    child.once('exit', (code, signal) => code === 0
      ? resolveRun(output)
      : rejectRun(new L3CanaryError('collector_l3_npm_failed', { code: code ?? signal })));
  });
}
