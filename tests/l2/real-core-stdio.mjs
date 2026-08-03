import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { access, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StdioClientTransport,
  getDefaultEnvironment
} from '@modelcontextprotocol/sdk/client/stdio.js';

const repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const coreEntrypoint = process.env.COLLECTOR_L2_CORE_ENTRYPOINT;
if (!coreEntrypoint) throw new Error('collector_l2_core_entrypoint_required');
await access(coreEntrypoint);

const temporaryRoot = await mkdtemp(join(tmpdir(), 'collector-mcp-l2-'));
const coreHome = join(temporaryRoot, 'core-home');
const coreState = join(coreHome, 'gateway');
const packageDirectory = join(temporaryRoot, 'packages');
const consumerDirectory = join(temporaryRoot, 'consumer');
const port = await availablePort();
const origin = `http://127.0.0.1:${port}`;
let coreProcess;
let client;
let stderr = '';

try {
  coreProcess = spawn(process.execPath, [resolve(coreEntrypoint)], {
    cwd: dirname(resolve(coreEntrypoint)),
    env: {
      ...process.env,
      COLLECTOR_GATEWAY_PORT: String(port),
      COLLECTOR_USER_BROWSER_HOME: coreHome,
      COLLECTOR_USER_BROWSER_STATE_DIR: coreState
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  let coreOutput = '';
  coreProcess.stdout.on('data', (chunk) => { coreOutput += String(chunk); });
  coreProcess.stderr.on('data', (chunk) => { coreOutput += String(chunk); });
  await waitForCore(coreProcess, origin, () => coreOutput);

  const issued = await requestJson(origin, '/v2/collector-service/clients', {
    method: 'POST',
    headers: {
      origin,
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      label: 'Collector MCP L2',
      scopes: ['browser-bindings:read', 'collect:execute', 'operations:read', 'artifacts:read']
    })
  }, 201);
  const token = issued.token;
  if (typeof token !== 'string' || !/^cst_[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new Error('collector_l2_token_issue_failed');
  }

  await mkdir(packageDirectory, { recursive: true });
  await runNpm(['pack', '--workspace', '@collector-ai-integration/mcp-server', '--pack-destination', packageDirectory], repositoryRoot);
  const packageName = (await readdir(packageDirectory)).find((name) => name.endsWith('.tgz'));
  if (!packageName) throw new Error('collector_l2_mcp_package_missing');
  const packagePath = join(packageDirectory, packageName);
  await runNpm([
    'install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', consumerDirectory, packagePath
  ], repositoryRoot);
  const mcpEntrypoint = join(
    consumerDirectory,
    'node_modules',
    '@collector-ai-integration',
    'mcp-server',
    'dist',
    'src',
    'cli.js'
  );
  await access(mcpEntrypoint);

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [mcpEntrypoint],
    cwd: consumerDirectory,
    env: {
      ...getDefaultEnvironment(),
      COLLECTOR_CORE_ORIGIN: origin,
      COLLECTOR_CORE_TOKEN: token
    },
    stderr: 'pipe'
  });
  transport.stderr?.on('data', (chunk) => { stderr += String(chunk); });
  client = new Client({ name: 'collector-mcp-real-core-l2', version: '1.0.0' });
  await client.connect(transport);

  const resources = await client.listResources();
  const templates = await client.listResourceTemplates();
  const toolCatalog = await client.listTools();
  if (client.getServerCapabilities()?.tools === undefined) throw new Error('collector_l2_tools_missing');
  if (resources.resources.length !== 3 || templates.resourceTemplates.length !== 3) {
    throw new Error('collector_l2_resource_catalog_invalid');
  }
  if (toolCatalog.tools.length !== 15) throw new Error('collector_l2_tool_catalog_invalid');
  const release = parseResource(await client.readResource({ uri: 'collector://release' }));
  const capabilities = parseResource(await client.readResource({ uri: 'collector://capabilities' }));
  const bindings = parseResource(await client.readResource({ uri: 'collector://bindings' }));
  if (release.release?.service?.schemaVersion !== 3 ||
      capabilities.catalog?.directContracts?.length !== 15 ||
      bindings.bindings?.length !== 0) {
    throw new Error('collector_l2_preflight_resource_invalid');
  }
  verifyToolCatalog(toolCatalog.tools, capabilities.catalog.directContracts);
  const compatibilityManifest = JSON.parse(
    await readFile(join(repositoryRoot, 'manifests', 'compatibility.json'), 'utf8')
  );
  verifyCompatibilityManifest(toolCatalog.tools, compatibilityManifest);

  await expectMcpError(
    () => client.callTool({
      name: 'collector_bilibili_video_detail',
      arguments: {
        bindingAlias: 'binding-1',
        clientRequestId: '33333333-3333-4333-8333-333333333333',
        canonicalVideoUrl: 'https://www.bilibili.com/video/BV1qZSLBYEpa',
        executionTarget: 'collector_work_tab'
      }
    }),
    'tool_input_invalid'
  );
  await expectMcpError(
    () => client.callTool({
      name: 'collector_bilibili_video_detail',
      arguments: {
        bindingAlias: 'binding-1',
        clientRequestId: '33333333-3333-4333-8333-333333333333',
        canonicalVideoUrl: 'https://www.bilibili.com/video/BV1qZSLBYEpa'
      }
    }),
    'binding_alias_not_found'
  );

  const missingOperationId = '11111111-1111-4111-8111-111111111111';
  const missingArtifactId = '22222222-2222-4222-8222-222222222222';
  await expectMcpError(
    () => client.readResource({ uri: `collector://operations/${missingOperationId}` }),
    'resource_not_found'
  );
  await expectMcpError(
    () => client.readResource({ uri: `collector://artifacts/${missingArtifactId}` }),
    'resource_not_found'
  );
  await expectMcpError(
    () => client.readResource({ uri: `collector://artifacts/${missingArtifactId}/chunks/0` }),
    'resource_not_found'
  );

  await client.close();
  client = undefined;
  if (stderr.includes(token)) throw new Error('collector_l2_secret_in_stderr');
  for (const line of stderr.split(/\r?\n/).filter(Boolean)) JSON.parse(line);
  if (!stderr.includes('collector.mcp.preflight_completed') || !stderr.includes('collector.mcp.started')) {
    throw new Error('collector_l2_structured_log_missing');
  }

  const operationCount = await persistedOperationCount(coreState);
  if (operationCount !== 0) throw new Error('collector_l2_platform_operation_created');
  process.stdout.write(`${JSON.stringify({
    ok: true,
    gate: 'collector-mcp-real-core-stdio-l2',
    packagedMcp: true,
    realCoreProcess: true,
    scopedCoreToken: true,
    staticResources: resources.resources.length,
    resourceTemplates: templates.resourceTemplates.length,
    directContracts: capabilities.catalog.directContracts.length,
    catalogDigest: capabilities.catalog.catalogDigest,
    openApiDigest: release.release.compatibility.openApiSchemaDigest,
    tools: toolCatalog.tools.length,
    toolCatalogVersion: toolCatalog.tools[0]?._meta?.['collector/toolCatalogVersion'],
    exactCapabilityParity: true,
    manifestParity: true,
    toolSchemaDigestsVerified: toolCatalog.tools.length,
    toolSchemas: toolCatalog.tools.map((tool) => ({
      toolId: tool.name,
      capabilityId: tool._meta['collector/capabilityId'],
      inputSchemaDigest: tool._meta['collector/inputSchemaDigest']
    })),
    platformOperationsCreated: operationCount,
    livePlatformRequests: 0
  }, null, 2)}\n`);
} finally {
  if (client) await client.close().catch(() => undefined);
  if (coreProcess && coreProcess.exitCode === null) {
    coreProcess.kill('SIGTERM');
    await Promise.race([
      new Promise((resolveExit) => coreProcess.once('exit', resolveExit)),
      new Promise((resolveTimeout) => setTimeout(resolveTimeout, 2_000))
    ]);
    if (coreProcess.exitCode === null) coreProcess.kill('SIGKILL');
  }
  await rm(temporaryRoot, { recursive: true, force: true });
}

function verifyToolCatalog(tools, directContracts) {
  const capabilityIds = new Set(directContracts.map((contract) => contract.capability));
  const contractsByCapability = new Map(directContracts.map((contract) => [contract.capability, contract]));
  const toolCapabilityIds = new Set();
  for (const tool of tools) {
    const capabilityId = tool._meta?.['collector/capabilityId'];
    const digest = tool._meta?.['collector/inputSchemaDigest'];
    const catalogVersion = tool._meta?.['collector/toolCatalogVersion'];
    if (typeof capabilityId !== 'string' || typeof digest !== 'string' ||
        catalogVersion !== 'collector.mcp.tools/v1') {
      throw new Error('collector_l2_tool_metadata_invalid');
    }
    if (toolCapabilityIds.has(capabilityId)) throw new Error('collector_l2_tool_capability_duplicate');
    toolCapabilityIds.add(capabilityId);
    if (digest !== sha256Digest(tool.inputSchema)) throw new Error('collector_l2_tool_schema_digest_invalid');
    if (tool.inputSchema?.additionalProperties !== false ||
        tool.inputSchema?.properties?.bindingAlias === undefined ||
        tool.inputSchema?.properties?.clientRequestId === undefined) {
      throw new Error('collector_l2_tool_schema_boundary_invalid');
    }
    for (const hidden of ['schemaVersion', 'browserBindingId', 'platform', 'capability', 'input']) {
      if (Object.hasOwn(tool.inputSchema.properties, hidden)) {
        throw new Error('collector_l2_tool_hidden_envelope_leaked');
      }
    }
    const contract = contractsByCapability.get(capabilityId);
    const targetSchema = tool.inputSchema.properties.executionTarget;
    if (contract.executionTargetMode === 'fixed' && targetSchema !== undefined) {
      throw new Error('collector_l2_fixed_execution_target_leaked');
    }
    if (contract.executionTargetMode === 'enum' &&
        (!targetSchema || !sameSet(targetSchema.enum, contract.executionTargets))) {
      throw new Error('collector_l2_enum_execution_target_invalid');
    }
  }
  if (toolCapabilityIds.size !== capabilityIds.size ||
      [...toolCapabilityIds].some((capabilityId) => !capabilityIds.has(capabilityId))) {
    throw new Error('collector_l2_tool_core_parity_invalid');
  }
}

function verifyCompatibilityManifest(tools, manifest) {
  if (manifest.product?.phase !== 'skills_canary' || manifest.checkpoint?.current !== null ||
      manifest.checkpoint?.next !== 6 || !manifest.checkpoint?.completed?.includes(5) ||
      manifest.mcp?.toolCatalogVersion !== 'collector.mcp.tools/v1' ||
      !Array.isArray(manifest.mcp?.tools) || manifest.mcp.tools.length !== tools.length) {
    throw new Error('collector_l2_compatibility_manifest_invalid');
  }
  const entries = new Map(manifest.mcp.tools.map((entry) => [entry.toolId, entry]));
  for (const tool of tools) {
    const entry = entries.get(tool.name);
    if (!entry || entry.capabilityId !== tool._meta?.['collector/capabilityId'] ||
        entry.inputSchemaDigest !== tool._meta?.['collector/inputSchemaDigest']) {
      throw new Error('collector_l2_compatibility_manifest_tool_mismatch');
    }
  }
}

function sameSet(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
    left.every((value) => right.includes(value));
}

function sha256Digest(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`;
}

function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' ||
      typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!value || typeof value !== 'object') throw new Error('collector_l2_canonical_json_invalid');
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function parseResource(result) {
  if (result.contents.length !== 1 || result.contents[0].mimeType !== 'application/json' ||
      typeof result.contents[0].text !== 'string') {
    throw new Error('collector_l2_resource_shape_invalid');
  }
  return JSON.parse(result.contents[0].text);
}

async function expectMcpError(action, code) {
  try {
    await action();
  } catch (error) {
    if (error instanceof Error && error.message.endsWith(code)) return;
    throw error;
  }
  throw new Error(`collector_l2_expected_error_missing:${code}`);
}

async function persistedOperationCount(stateDirectory) {
  try {
    const value = JSON.parse(await readFile(join(stateDirectory, 'extension-work-operations.json'), 'utf8'));
    return Array.isArray(value) ? value.length : -1;
  } catch (error) {
    if (error?.code === 'ENOENT') return 0;
    throw error;
  }
}

async function requestJson(origin, path, options, expectedStatus) {
  const response = await fetch(origin + path, { ...options, signal: AbortSignal.timeout(5_000) });
  const payload = await response.json();
  if (response.status !== expectedStatus) {
    throw new Error(`collector_l2_core_status_unexpected:${path}:${response.status}`);
  }
  return payload;
}

async function waitForCore(child, origin, output) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`collector_l2_core_exited:${output()}`);
    try {
      const response = await fetch(origin + '/v1/status', { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The real Core process is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`collector_l2_core_start_timeout:${output()}`);
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  await new Promise((resolveClose, rejectClose) => {
    server.close((error) => error ? rejectClose(error) : resolveClose());
  });
  if (!address || typeof address === 'string') throw new Error('collector_l2_port_unavailable');
  return address.port;
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
      : rejectRun(new Error(`collector_l2_npm_failed:${code ?? signal}:${output}`)));
  });
}
