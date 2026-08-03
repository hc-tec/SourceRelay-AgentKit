import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StdioClientTransport,
  getDefaultEnvironment
} from '@modelcontextprotocol/sdk/client/stdio.js';
import { listLiveMatrixCases, resolveLiveMatrixCase } from './live-matrix-cases.mjs';
import {
  LiveMatrixError,
  OneShotToolSubmission,
  TERMINAL_STATES,
  inputEvidence,
  parseLiveMatrixArguments,
  parseResource,
  parseSubmission,
  protocolCoreErrorCode,
  projectOperationEvidence,
  readAndVerifyArtifact,
  requiredUuid,
  safeErrorCode,
  selectUniqueOnlineBinding,
  verifyCaseAgainstLiveCatalog,
  verifyOperation
} from './live-matrix-contract.mjs';

const repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const invocation = parseLiveMatrixArguments(process.argv.slice(2));
if (invocation.mode === 'list') {
  process.stdout.write(`${JSON.stringify({
    ok: true,
    gate: 'collector-mcp-live-capability-matrix',
    livePlatformActions: 0,
    cases: listLiveMatrixCases()
  }, null, 2)}\n`);
  process.exit(0);
}

const caseDefinition = resolveLiveMatrixCase(invocation.caseId);
const coreOrigin = process.env.COLLECTOR_CORE_ORIGIN ?? 'http://127.0.0.1:43127';
const coreToken = process.env.COLLECTOR_CORE_TOKEN ?? '';
const requestedBindingAlias = process.env.COLLECTOR_L3_BINDING_ALIAS;
const suppliedClientRequestId = process.env.COLLECTOR_L3_CLIENT_REQUEST_ID;
const clientRequestId = suppliedClientRequestId ?? randomUUID();
const expectedOperationId = process.env.COLLECTOR_L3_EXPECTED_OPERATION_ID;
const expectedArtifactId = process.env.COLLECTOR_L3_EXPECTED_ARTIFACT_ID;
const operationDeadlineMs = 180_000;
const pollIntervalMs = 1_000;
const submissionGate = new OneShotToolSubmission();

const run = {
  runId: randomUUID(),
  objective: `Verify one packaged MCP live capability case: ${caseDefinition.caseId}.`,
  platform: caseDefinition.platform,
  targetRole: caseDefinition.targetRole,
  browserMode: 'production user-owned browser with paired MV3',
  browserLifecycle: 'managed_profile_session',
  extensionInteractionLoaded: true,
  existingPlatformRunnerUsed: true,
  caseId: caseDefinition.caseId,
  mode: invocation.mode,
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
let operationEvidence;
let artifactEvidence;
let observedCoreStates = [];

try {
  validateRuntimeInvocation();
  temporaryRoot = await mkdtemp(join(tmpdir(), 'collector-mcp-l3-matrix-'));
  const mcpEntrypoint = await installPackagedMcp(temporaryRoot);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [mcpEntrypoint],
    cwd: join(temporaryRoot, 'consumer'),
    env: {
      ...getDefaultEnvironment(),
      COLLECTOR_CORE_ORIGIN: coreOrigin,
      COLLECTOR_CORE_TOKEN: coreToken
    },
    stderr: 'pipe'
  });
  transport.stderr?.on('data', (chunk) => { mcpStderr += String(chunk); });
  client = new Client({ name: 'collector-mcp-live-capability-matrix', version: '1.0.0' });
  await client.connect(transport);

  const release = parseResource(await client.readResource({ uri: 'collector://release' }));
  const capabilities = parseResource(await client.readResource({ uri: 'collector://capabilities' }));
  const bindings = parseResource(await client.readResource({ uri: 'collector://bindings' }));
  const toolCatalog = await client.listTools();
  verifyRelease(release);
  const bindingAlias = selectUniqueOnlineBinding(bindings, requestedBindingAlias);
  const toolArguments = {
    bindingAlias,
    clientRequestId,
    ...caseDefinition.capabilityFields
  };
  const liveToolContract = verifyCaseAgainstLiveCatalog(
    caseDefinition,
    capabilities,
    toolCatalog.tools,
    toolArguments
  );

  process.stdout.write(`${JSON.stringify({
    event: 'collector_l3_submission_planned',
    runId: run.runId,
    caseId: caseDefinition.caseId,
    toolId: caseDefinition.toolId,
    capabilityId: caseDefinition.capabilityId,
    bindingAlias,
    clientRequestId,
    inputEvidence: inputEvidence(toolArguments),
    liveInputSchemaDigest: liveToolContract.inputSchemaDigest,
    maximumToolSubmissions: 1,
    expectedIdempotentReplay: invocation.mode === 'reconcile'
  })}\n`);

  run.toolCallAttempted = true;
  const toolResult = await submissionGate.call(client, {
    name: caseDefinition.toolId,
    arguments: toolArguments
  });
  const submission = parseSubmission(toolResult, {
    clientRequestId,
    capabilityId: caseDefinition.capabilityId,
    idempotentReplay: invocation.mode === 'reconcile',
    operationId: expectedOperationId
  });
  run.operationAccepted = true;
  run.operationId = submission.operationId;

  const terminal = await waitForTerminalOperation(submission.operationResourceUri);
  operationEvidence = projectOperationEvidence(terminal);
  if (terminal.artifact !== null) {
    if (!terminal.artifact || typeof terminal.artifact !== 'object') {
      throw new LiveMatrixError('collector_l3_terminal_artifact_reference_invalid');
    }
    const artifactId = requiredUuid(
      terminal.artifact.artifactId,
      'collector_l3_artifact_id_invalid'
    );
    if (expectedArtifactId !== undefined && artifactId !== expectedArtifactId) {
      throw new LiveMatrixError('collector_l3_reconciled_artifact_mismatch');
    }
    run.artifactId = artifactId;
    artifactEvidence = await readAndVerifyArtifact(
      (uri) => client.readResource({ uri }),
      requiredString(terminal.artifact.metadataResourceUri, 'collector_l3_artifact_uri_invalid'),
      {
        artifactId,
        operationId: submission.operationId,
        capabilityId: caseDefinition.capabilityId
      }
    );
  } else if (terminal.coreState === 'completed' || terminal.coreState === 'partial') {
    throw new LiveMatrixError('collector_l3_terminal_artifact_missing', operationEvidence);
  } else if (expectedArtifactId !== undefined) {
    throw new LiveMatrixError('collector_l3_reconciled_artifact_missing');
  }

  await closeMcpAndVerifyLogs();
  client = undefined;
  run.finishedAt = new Date().toISOString();
  const passed = terminal.coreState === 'completed';
  const result = {
    ok: passed,
    evidenceCaptured: true,
    gate: 'collector-mcp-live-capability-matrix',
    run: {
      ...run,
      outcome: terminalOutcome(terminal.coreState),
      toolId: caseDefinition.toolId,
      capabilityId: caseDefinition.capabilityId,
      liveInputSchemaDigest: liveToolContract.inputSchemaDigest,
      maximumToolSubmissions: 1,
      toolCallAttempts: 1,
      acceptedOperations: 1,
      idempotentReplay: submission.idempotentReplay,
      newPlatformActionsExpected: invocation.mode === 'reconcile' ? 0 : 1,
      automaticSubmissionRetries: 0,
      observedCoreStates,
      browserAndGatewayRetained: true
    },
    operation: operationEvidence,
    artifact: artifactEvidence ?? null,
    contentExposedInMatrixOutput: false
  };
  const output = `${JSON.stringify(result, null, 2)}\n`;
  (passed ? process.stdout : process.stderr).write(output);
  if (!passed) process.exitCode = 1;
} catch (error) {
  run.finishedAt = new Date().toISOString();
  const coreErrorCode = protocolCoreErrorCode(error);
  process.stderr.write(`${JSON.stringify({
    ok: false,
    evidenceCaptured: run.operationAccepted,
    gate: 'collector-mcp-live-capability-matrix',
    error: safeErrorCode(error),
    ...(coreErrorCode === null ? {} : { coreErrorCode }),
    run: {
      ...run,
      outcome: run.operationAccepted ? 'inconclusive' : 'blocked',
      maximumToolSubmissions: 1,
      toolCallAttempts: submissionGate.attempted ? 1 : 0,
      acceptedOperations: run.operationAccepted ? 1 : 0,
      automaticSubmissionRetries: 0,
      observedCoreStates,
      browserAndGatewayRetained: true
    },
    ...(operationEvidence === undefined ? {} : { operation: operationEvidence }),
    ...(artifactEvidence === undefined ? {} : { artifact: artifactEvidence }),
    ...(error instanceof LiveMatrixError && error.details !== undefined
      ? { details: error.details }
      : {})
  }, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  if (client) await client.close().catch(() => undefined);
  if (coreToken.length > 0 && mcpStderr.includes(coreToken)) {
    process.stderr.write(`${JSON.stringify({
      ok: false,
      gate: 'collector-mcp-live-capability-matrix',
      error: 'collector_l3_secret_in_mcp_log'
    })}\n`);
    process.exitCode = 1;
  }
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
}

function validateRuntimeInvocation() {
  if (coreOrigin !== 'http://127.0.0.1:43127') {
    throw new LiveMatrixError('collector_l3_production_core_origin_required');
  }
  if (!/^cst_[A-Za-z0-9_-]{43}$/.test(coreToken)) {
    throw new LiveMatrixError('collector_l3_core_token_required');
  }
  requiredUuid(clientRequestId, 'collector_l3_client_request_id_invalid');
  if (invocation.mode === 'reconcile') {
    if (suppliedClientRequestId === undefined || expectedOperationId === undefined ||
      expectedArtifactId === undefined) {
      throw new LiveMatrixError('collector_l3_reconciliation_identity_required');
    }
    requiredUuid(expectedOperationId, 'collector_l3_expected_operation_id_invalid');
    requiredUuid(expectedArtifactId, 'collector_l3_expected_artifact_id_invalid');
  } else if (expectedOperationId !== undefined || expectedArtifactId !== undefined) {
    throw new LiveMatrixError('collector_l3_unexpected_reconciliation_identity');
  }
}

function verifyRelease(release) {
  if (release?.schemaVersion !== 'collector.mcp.release/v1' ||
    release.release?.releaseVersion !== '0.7.17' ||
    release.release?.service?.schemaVersion !== 3) {
    throw new LiveMatrixError('collector_l3_release_preflight_invalid');
  }
}

async function waitForTerminalOperation(operationResourceUri) {
  const deadline = Date.now() + operationDeadlineMs;
  let previousState = null;
  while (Date.now() < deadline) {
    const operation = verifyOperation(
      parseResource(await client.readResource({ uri: operationResourceUri })),
      { operationId: run.operationId, capabilityId: caseDefinition.capabilityId }
    );
    if (previousState === 'claimed' && operation.coreState === 'queued') {
      throw new LiveMatrixError('collector_l3_operation_state_regressed');
    }
    if (observedCoreStates.at(-1) !== operation.coreState) observedCoreStates.push(operation.coreState);
    previousState = operation.coreState;
    if (TERMINAL_STATES.has(operation.coreState)) return operation;
    await delay(pollIntervalMs);
  }
  throw new LiveMatrixError('collector_l3_operation_deadline_exceeded', {
    operationId: run.operationId,
    lastCoreState: previousState
  });
}

async function installPackagedMcp(root) {
  const packageDirectory = join(root, 'packages');
  const consumerDirectory = join(root, 'consumer');
  await mkdir(packageDirectory, { recursive: true });
  await runNpm([
    'pack', '--workspace', '@collector-ai-integration/mcp-server', '--pack-destination', packageDirectory
  ], repositoryRoot);
  const packages = (await readdir(packageDirectory)).filter((name) => name.endsWith('.tgz'));
  if (packages.length !== 1) throw new LiveMatrixError('collector_l3_mcp_package_missing');
  await runNpm([
    'install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', consumerDirectory,
    join(packageDirectory, packages[0])
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

async function closeMcpAndVerifyLogs() {
  const activeClient = client;
  client = undefined;
  await activeClient.close();
  if (mcpStderr.includes(coreToken)) throw new LiveMatrixError('collector_l3_secret_in_mcp_log');
  for (const [field, value] of Object.entries(caseDefinition.capabilityFields)) {
    if ((field === 'query' || field.endsWith('Url')) && typeof value === 'string' &&
      mcpStderr.includes(value)) {
      throw new LiveMatrixError('collector_l3_input_content_in_mcp_log');
    }
  }
  let events;
  try {
    events = mcpStderr.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    throw new LiveMatrixError('collector_l3_structured_log_invalid');
  }
  const eventNames = new Set(events.map((event) => event.eventType));
  for (const requiredEvent of [
    'collector.mcp.preflight_completed',
    'collector.mcp.started',
    'collector.mcp.tool_submitted',
    'collector.mcp.resource_read'
  ]) {
    if (!eventNames.has(requiredEvent)) {
      throw new LiveMatrixError('collector_l3_structured_log_missing', { requiredEvent });
    }
  }
}

function terminalOutcome(state) {
  if (state === 'completed') return 'proved';
  if (state === 'partial') return 'partial';
  if (state === 'stopped') return 'blocked';
  return 'failed';
}

function requiredString(value, code) {
  if (typeof value !== 'string' || value.length === 0) throw new LiveMatrixError(code);
  return value;
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
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
    child.stdout.resume();
    child.stderr.resume();
    child.once('error', rejectRun);
    child.once('exit', (code, signal) => code === 0
      ? resolveRun()
      : rejectRun(new LiveMatrixError('collector_l3_npm_failed', { code: code ?? signal })));
  });
}
