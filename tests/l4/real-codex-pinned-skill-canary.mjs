import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  installPackagedMcp,
  minimalCodexEnvironment,
  readJson,
  resolveCodexExecutable,
  runProcess,
  snapshotPinnedSkills,
  tomlLiteral,
  tomlStringArray
} from './canary-runtime.mjs';

const repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const argumentsList = process.argv.slice(2);
const reconcileLive = argumentsList.includes('--reconcile-live');
const unknownArguments = argumentsList.filter((argument) => argument !== '--reconcile-live');
const coreOrigin = process.env.COLLECTOR_CORE_ORIGIN ?? 'http://127.0.0.1:43127';
const coreToken = process.env.COLLECTOR_CORE_TOKEN ?? '';
const query = process.env.COLLECTOR_L4_BILIBILI_QUERY ?? '人工智能';
const clientRequestId = process.env.COLLECTOR_L4_CLIENT_REQUEST_ID ?? '';
const expectedOperationId = process.env.COLLECTOR_L4_EXPECTED_OPERATION_ID ?? '';
const expectedArtifactId = process.env.COLLECTOR_L4_EXPECTED_ARTIFACT_ID ?? '';
const expectedArtifactSha256 = process.env.COLLECTOR_L4_EXPECTED_ARTIFACT_SHA256 ?? '';
const expectedArtifactByteLength = Number(process.env.COLLECTOR_L4_EXPECTED_ARTIFACT_BYTES);
const expectedTerminalReason = process.env.COLLECTOR_L4_EXPECTED_TERMINAL_REASON ?? 'search_ready';
const toolId = 'collector_bilibili_native_search';
const capabilityId = 'bilibili.native_search';
const skillIds = ['use-collector-mcp', 'collect-bilibili'];

class L4CanaryError extends Error {
  constructor(code, details) {
    super(code);
    this.name = 'L4CanaryError';
    this.code = code;
    this.details = details;
  }
}

const run = {
  runId: randomUUID(),
  objective: 'Prove a real Agent uses exact pinned Skills and Collector MCP provenance correctly.',
  agentHost: 'codex-cli',
  platform: 'bilibili',
  canaryMode: 'idempotent_reconciliation',
  clientRequestId,
  expectedOperationId,
  expectedArtifactId,
  codexStarted: false,
  startedAt: new Date().toISOString()
};

let temporaryRoot;

try {
  validateInvocation();
  const pinnedSkills = await loadPinnedSkillCatalog();
  temporaryRoot = await mkdtemp(join(tmpdir(), 'collector-agent-l4-'));
  const workspace = join(temporaryRoot, 'agent-workspace');
  await mkdir(workspace, { recursive: true });
  await writeFile(join(workspace, 'AGENTS.md'), runtimeAgentInstructions(), 'utf8');

  const skillPaths = await snapshotPinnedSkills(repositoryRoot, temporaryRoot, skillIds);
  await verifySnapshotManifests(skillPaths, pinnedSkills);
  const packagedMcp = await installPackagedMcp(repositoryRoot, temporaryRoot);
  const codexExecutable = await resolveCodexExecutable();
  const codexVersion = await readCodexVersion(codexExecutable, workspace);
  const userMcpServerNames = await discoverUserMcpServerNames(codexExecutable, workspace);
  const outputPath = join(temporaryRoot, 'agent-output.json');
  const schemaPath = join(repositoryRoot, 'tests', 'l4', 'agent-canary-output.schema.json');
  const codexArguments = buildCodexArguments({
    workspace,
    outputPath,
    schemaPath,
    mcpEntrypoint: packagedMcp.entrypoint,
    mcpCwd: packagedMcp.consumerDirectory,
    skillPaths,
    pinnedSkills,
    userMcpServerNames
  });

  run.codexStarted = true;
  const codexResult = await runProcess(codexExecutable, codexArguments, {
    cwd: workspace,
    env: minimalCodexEnvironment(coreOrigin, coreToken),
    timeoutMs: 300_000,
    maximumOutputBytes: 8 * 1024 * 1024
  });
  const trace = analyseCodexTrace(codexResult.stdout);
  if (codexResult.stdout.includes(coreToken) || codexResult.stderr.includes(coreToken)) {
    throw new L4CanaryError('collector_l4_secret_exposed_by_agent_host', { trace });
  }
  if (codexResult.code !== 0 || codexResult.timedOut || codexResult.outputLimitExceeded) {
    throw new L4CanaryError('collector_l4_codex_exec_failed', {
      codexExitCode: codexResult.code,
      codexSignal: codexResult.signal,
      timedOut: codexResult.timedOut,
      outputLimitExceeded: codexResult.outputLimitExceeded,
      stderrSummary: sanitiseCodexStderr(codexResult.stderr),
      trace
    });
  }

  const agentOutput = JSON.parse(await readFile(outputPath, 'utf8'));
  verifyAgentOutput(agentOutput, pinnedSkills);
  if (trace.targetToolCallCount !== 1) {
    throw new L4CanaryError('collector_l4_agent_tool_call_count_invalid', { trace });
  }

  run.finishedAt = new Date().toISOString();
  process.stdout.write(`${JSON.stringify({
    ok: true,
    gate: 'collector-real-codex-pinned-skill-l4',
    run: {
      ...run,
      outcome: 'proved',
      codexVersion,
      pinnedSkillCount: pinnedSkills.length,
      agentTurns: trace.turnCompletedCount,
      targetToolCallCount: trace.targetToolCallCount,
      automaticAgentReruns: 0,
      expectedNewPlatformActions: 0,
      browserAndGatewayRetained: true
    },
    pinnedSkills,
    trace,
    result: agentOutput,
    rawAgentTraceExposed: false,
    artifactContentExposed: false
  }, null, 2)}\n`);
} catch (error) {
  run.finishedAt = new Date().toISOString();
  process.stderr.write(`${JSON.stringify({
    ok: false,
    gate: 'collector-real-codex-pinned-skill-l4',
    error: safeErrorCode(error),
    run: {
      ...run,
      outcome: run.codexStarted ? 'inconclusive' : 'blocked',
      automaticAgentReruns: 0,
      expectedNewPlatformActions: 0,
      browserAndGatewayRetained: true
    },
    ...(error instanceof L4CanaryError && error.details !== undefined
      ? { details: error.details }
      : {})
  }, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
}

function validateInvocation() {
  if (!reconcileLive || unknownArguments.length > 0) {
    throw new L4CanaryError('collector_l4_explicit_reconciliation_flag_required');
  }
  if (coreOrigin !== 'http://127.0.0.1:43127') {
    throw new L4CanaryError('collector_l4_production_core_origin_required');
  }
  if (!/^cst_[A-Za-z0-9_-]{43}$/.test(coreToken)) {
    throw new L4CanaryError('collector_l4_core_token_required');
  }
  requiredUuid(clientRequestId, 'collector_l4_client_request_id_required');
  requiredUuid(expectedOperationId, 'collector_l4_expected_operation_id_required');
  requiredUuid(expectedArtifactId, 'collector_l4_expected_artifact_id_required');
  if (!/^sha256:[a-f0-9]{64}$/.test(expectedArtifactSha256)) {
    throw new L4CanaryError('collector_l4_expected_artifact_sha256_required');
  }
  if (!Number.isSafeInteger(expectedArtifactByteLength) || expectedArtifactByteLength < 1) {
    throw new L4CanaryError('collector_l4_expected_artifact_bytes_required');
  }
  if (Buffer.byteLength(query, 'utf8') < 1 || Buffer.byteLength(query, 'utf8') > 120) {
    throw new L4CanaryError('collector_l4_query_invalid');
  }
}

async function loadPinnedSkillCatalog() {
  const compatibility = await readJson(join(repositoryRoot, 'manifests', 'compatibility.json'));
  const official = new Map(compatibility.skills?.official?.map((entry) => [entry.skillId, entry]));
  return Promise.all(skillIds.map(async (skillId) => {
    const catalogEntry = official.get(skillId);
    const manifest = await readJson(join(repositoryRoot, 'skills', skillId, 'manifest.json'));
    if (!catalogEntry || manifest.skillId !== skillId ||
        manifest.skillVersion !== catalogEntry.skillVersion || manifest.digest !== catalogEntry.digest) {
      throw new L4CanaryError('collector_l4_skill_pin_catalog_mismatch');
    }
    return {
      skillId,
      skillVersion: manifest.skillVersion,
      digest: manifest.digest
    };
  }));
}

async function verifySnapshotManifests(skillPaths, pinnedSkills) {
  for (const expected of pinnedSkills) {
    const manifest = await readJson(join(skillPaths.get(expected.skillId), 'manifest.json'));
    if (manifest.skillVersion !== expected.skillVersion || manifest.digest !== expected.digest) {
      throw new L4CanaryError('collector_l4_skill_snapshot_pin_mismatch');
    }
  }
}

async function readCodexVersion(codexExecutable, workspace) {
  const result = await runProcess(codexExecutable, ['--version'], {
    cwd: workspace,
    env: minimalCodexEnvironment(coreOrigin, coreToken),
    timeoutMs: 10_000,
    maximumOutputBytes: 16 * 1024
  });
  const version = result.stdout.trim();
  if (result.code !== 0 || !/^codex-cli \d+\.\d+\.\d+$/.test(version)) {
    throw new L4CanaryError('collector_l4_codex_version_invalid');
  }
  return version;
}

async function discoverUserMcpServerNames(codexExecutable, workspace) {
  const result = await runProcess(codexExecutable, ['mcp', 'list', '--json'], {
    cwd: workspace,
    env: minimalCodexEnvironment(coreOrigin, coreToken),
    timeoutMs: 10_000,
    maximumOutputBytes: 256 * 1024
  });
  if (result.code !== 0 || result.timedOut || result.outputLimitExceeded) {
    throw new L4CanaryError('collector_l4_user_mcp_catalog_unavailable');
  }
  const servers = JSON.parse(result.stdout);
  if (!Array.isArray(servers)) throw new L4CanaryError('collector_l4_user_mcp_catalog_invalid');
  return servers.map((server) => {
    if (typeof server?.name !== 'string' || !/^[A-Za-z0-9_-]+$/.test(server.name)) {
      throw new L4CanaryError('collector_l4_user_mcp_name_invalid');
    }
    return server.name;
  });
}

function buildCodexArguments(input) {
  const skillsConfig = `[${pinnedSkillConfig(input.skillPaths, input.pinnedSkills).join(',')}]`;
  const config = [
    `approval_policy=${tomlLiteral('never')}`,
    `model_reasoning_effort=${tomlLiteral('low')}`,
    `model_verbosity=${tomlLiteral('low')}`,
    `web_search=${tomlLiteral('disabled')}`,
    'features.shell_tool=false',
    'features.multi_agent=false',
    'features.apps=false',
    'features.remote_plugin=false',
    'features.memories=false',
    'features.goals=false',
    'features.hooks=false',
    `skills.config=${skillsConfig}`,
    `mcp_servers.collector.command=${tomlLiteral(process.execPath)}`,
    `mcp_servers.collector.args=${tomlStringArray([input.mcpEntrypoint])}`,
    `mcp_servers.collector.cwd=${tomlLiteral(input.mcpCwd)}`,
    'mcp_servers.collector.enabled=true',
    `mcp_servers.collector.enabled_tools=${tomlStringArray([toolId])}`,
    `mcp_servers.collector.default_tools_approval_mode=${tomlLiteral('approve')}`,
    `mcp_servers.collector.env_vars=${tomlStringArray(['COLLECTOR_CORE_ORIGIN', 'COLLECTOR_CORE_TOKEN'])}`,
    'mcp_servers.collector.startup_timeout_sec=30',
    'mcp_servers.collector.tool_timeout_sec=30'
  ];
  for (const serverName of input.userMcpServerNames) {
    if (serverName !== 'collector') config.push(`mcp_servers.${serverName}.enabled=false`);
  }
  const result = [
    'exec',
    '--ephemeral',
    '--json',
    '--color',
    'never',
    '--ignore-rules',
    '--sandbox',
    'read-only',
    '--skip-git-repo-check',
    '--cd',
    input.workspace,
    '--output-schema',
    input.schemaPath,
    '--output-last-message',
    input.outputPath
  ];
  for (const entry of config) result.push('-c', entry);
  result.push(agentPrompt(input.pinnedSkills));
  return result;
}

function pinnedSkillConfig(skillPaths, pinnedSkills) {
  return pinnedSkills.map((skill) =>
    `{path=${tomlLiteral(skillPaths.get(skill.skillId))},enabled=true}`);
}

function agentPrompt(pinnedSkills) {
  const pins = pinnedSkills.map((skill) =>
    `${skill.skillId}@${skill.skillVersion} ${skill.digest}`).join('\n');
  return `Use $use-collector-mcp and $collect-bilibili to perform one read-only L4 canary.\n\n` +
    `The Agent session is pinned to these exact Skill snapshots:\n${pins}\n\n` +
    `Reconcile the existing Bilibili public native-search request for the query "${query}". ` +
    `Use clientRequestId ${clientRequestId}. The only acceptable Tool result has ` +
    `idempotentReplay=true and operationId ${expectedOperationId}. The terminal Operation must ` +
    `reference artifactId ${expectedArtifactId}.\n\n` +
    `Follow the pinned Skills. Use only Collector MCP Resources and the one enabled Collector Tool. ` +
    `Do not use shell, files, web search, subagents, or any browser-control surface. Read live release, ` +
    `capabilities and bindings before the Tool call. Invoke the Tool exactly once. Then interpret the ` +
    `exact terminal Operation, read Artifact metadata first, and read only its first bounded chunk. ` +
    `Do not quote or return Artifact content. Return only the required JSON provenance object.`;
}

function runtimeAgentInstructions() {
  return `# L4 canary workspace\n\n` +
    `This is an ephemeral read-only Agent validation workspace. Use only the explicitly pinned Skills ` +
    `and configured Collector MCP. Do not use shell commands, local files, web search, subagents, or ` +
    `browser-control tools. Never expose raw Artifact content or secrets.\n`;
}

function verifyAgentOutput(output, pinnedSkills) {
  if (output.schemaVersion !== 'collector.agent-canary/v1' || output.outcome !== 'proved' ||
      output.contentExposed !== false) {
    throw new L4CanaryError('collector_l4_agent_output_envelope_invalid', {
      schemaVersion: output.schemaVersion,
      outcome: output.outcome,
      contentExposed: output.contentExposed
    });
  }
  if (!Array.isArray(output.skills) || output.skills.length !== pinnedSkills.length ||
      pinnedSkills.some((expected) => !output.skills.some((actual) =>
        actual?.skillId === expected.skillId && actual?.skillVersion === expected.skillVersion &&
        actual?.digest === expected.digest))) {
    throw new L4CanaryError('collector_l4_agent_output_skill_pin_invalid', { skills: output.skills });
  }
  if (output.release?.coreRelease !== '0.7.17' || output.release?.serviceSchemaVersion !== 3 ||
      output.release?.toolCatalogVersion !== 'collector.mcp.tools/v1') {
    throw new L4CanaryError('collector_l4_agent_output_release_invalid', { release: output.release });
  }
  if (!/^binding-[1-9][0-9]*$/.test(output.binding?.selectedAlias) ||
      output.binding?.onlineBindingCount !== 1) {
    throw new L4CanaryError('collector_l4_agent_output_binding_invalid', { binding: output.binding });
  }
  if (output.tool?.toolId !== toolId || output.tool?.capabilityId !== capabilityId ||
      output.tool?.clientRequestId !== clientRequestId || output.tool?.idempotentReplay !== true ||
      output.tool?.operationId !== expectedOperationId) {
    throw new L4CanaryError('collector_l4_agent_output_tool_invalid', { tool: output.tool });
  }
  if (output.operation?.coreState !== 'completed' ||
      output.operation?.terminalReason !== expectedTerminalReason || output.operation?.errorCode !== null) {
    throw new L4CanaryError('collector_l4_agent_output_operation_invalid', { operation: output.operation });
  }
  const artifact = output.artifact;
  if (artifact?.artifactId !== expectedArtifactId || artifact?.byteLength !== expectedArtifactByteLength ||
      artifact?.sha256 !== expectedArtifactSha256 || artifact?.terminalStatus !== 'completed' ||
      typeof artifact?.capturedAt !== 'string' || !Number.isFinite(Date.parse(artifact.capturedAt))) {
    throw new L4CanaryError('collector_l4_agent_output_artifact_invalid', {
      artifact: {
        artifactId: artifact?.artifactId,
        byteLength: artifact?.byteLength,
        sha256: artifact?.sha256,
        capturedAt: artifact?.capturedAt,
        terminalStatus: artifact?.terminalStatus
      }
    });
  }
  if (artifact.chunk?.start !== 0 || artifact.chunk?.endExclusive !== expectedArtifactByteLength ||
      artifact.chunk?.totalBytes !== expectedArtifactByteLength ||
      artifact.chunk?.chunkSha256 !== expectedArtifactSha256 || artifact.chunk?.truncated !== false ||
      artifact.chunk?.nextCursor !== null) {
    throw new L4CanaryError('collector_l4_agent_output_chunk_invalid', { chunk: artifact.chunk });
  }
}

function analyseCodexTrace(jsonl) {
  const eventTypeCounts = {};
  const targetToolCallIds = new Set();
  const resourceUris = new Set();
  const errorCategories = new Set();
  const errorSummaries = new Set();
  let turnCompletedCount = 0;
  for (const line of jsonl.split(/\r?\n/).filter(Boolean)) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      throw new L4CanaryError('collector_l4_codex_trace_not_jsonl');
    }
    const eventType = typeof event.type === 'string' ? event.type : 'unknown';
    eventTypeCounts[eventType] = (eventTypeCounts[eventType] ?? 0) + 1;
    if (eventType === 'turn.completed') turnCompletedCount += 1;
    if (eventType === 'error' || eventType === 'turn.failed') {
      errorCategories.add(classifyCodexError(event));
      errorSummaries.add(sanitiseCodexErrorEvent(event));
    }
    const item = event.item;
    if (!item || typeof item !== 'object') continue;
    const itemType = typeof item.type === 'string' ? item.type : '';
    const serialised = JSON.stringify(item);
    if ((itemType.includes('mcp') || itemType.includes('tool')) && serialised.includes(toolId)) {
      const identity = item.id ?? item.call_id ?? item.tool_call_id;
      if (typeof identity === 'string') targetToolCallIds.add(identity);
    }
    for (const uri of serialised.match(/collector:\/\/[A-Za-z0-9_{}./-]+/g) ?? []) {
      resourceUris.add(uri);
    }
  }
  return {
    eventTypeCounts,
    turnCompletedCount,
    targetToolCallCount: targetToolCallIds.size,
    resourceUris: [...resourceUris].sort(),
    errorCategories: [...errorCategories].sort(),
    errorSummaries: [...errorSummaries].sort()
  };
}

function classifyCodexError(event) {
  const value = JSON.stringify(event).toLowerCase();
  if (value.includes('401') || value.includes('unauthorized') || value.includes('authentication')) {
    return 'authentication';
  }
  if (value.includes('403') || value.includes('forbidden')) return 'permission';
  if (value.includes('429') || value.includes('rate limit')) return 'rate_limit';
  if (value.includes('model') && (value.includes('not found') || value.includes('unsupported'))) {
    return 'model_unavailable';
  }
  if (value.includes('connect') || value.includes('stream') || value.includes('timeout')) {
    return 'transport';
  }
  if (value.includes('mcp')) return 'mcp';
  return 'agent_runtime';
}

function sanitiseCodexErrorEvent(event) {
  const candidate = event.message ?? event.error?.message ?? event.error ?? event;
  return JSON.stringify(candidate)
    .replace(/cst_[A-Za-z0-9_-]{43}/g, '<redacted-token>')
    .replace(/[A-Za-z]:\\[^\s"']+/g, '<local-path>')
    .replace(/https?:\/\/[^\s"']+/g, '<url>')
    .slice(0, 800);
}

function sanitiseCodexStderr(value) {
  return value.split(/\r?\n/).filter(Boolean).slice(0, 20).map((line) => line
    .replace(/cst_[A-Za-z0-9_-]{43}/g, '<redacted-token>')
    .replace(/[A-Za-z]:\\[^\s"']+/g, '<local-path>')
    .replace(/https?:\/\/[^\s"']+/g, '<url>')
    .slice(0, 300));
}

function requiredUuid(value, code) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new L4CanaryError(code);
  }
}

function safeErrorCode(error) {
  if (error instanceof L4CanaryError) return error.code;
  if (error instanceof Error && /^collector_l4_[a-z0-9_]+$/.test(error.message)) return error.message;
  return 'collector_l4_unexpected_failure';
}
