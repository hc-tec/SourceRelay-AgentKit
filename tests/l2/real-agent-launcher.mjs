import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { writeStoredCredential } from '../../packages/mcp-server/dist/src/local-credential.js';

const repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const coreEntrypoint = process.env.COLLECTOR_L2_CORE_ENTRYPOINT;
if (!coreEntrypoint) throw new Error('collector_l2_launcher_core_entrypoint_required');

const port = await availablePort();
const origin = `http://127.0.0.1:${port}`;
const temporaryRoot = await mkdtemp(join(tmpdir(), 'collector-agent-launcher-l2-'));
const credentialFile = join(temporaryRoot, 'agent-credential.json');
const coreHome = join(temporaryRoot, 'core-home');
const coreState = join(coreHome, 'gateway');
let core;
let agent;
let stderr = '';

try {
  core = spawn(process.execPath, [resolve(coreEntrypoint)], {
    cwd: dirname(resolve(coreEntrypoint)),
    env: {
      ...process.env,
      COLLECTOR_GATEWAY_PORT: String(port),
      COLLECTOR_USER_BROWSER_HOME: coreHome,
      COLLECTOR_USER_BROWSER_STATE_DIR: coreState
    },
    stdio: 'ignore',
    windowsHide: true
  });
  await waitForCore(origin);
  const issued = await issueToken(origin);
  await writeStoredCredential({ origin, token: issued.token }, { filePath: credentialFile, environment: {} });

  agent = spawn(process.execPath, [
    join(repositoryRoot, 'packages', 'mcp-server', 'dist', 'src', 'agent-cli.js'),
    'mcp'
  ], {
    cwd: repositoryRoot,
    env: { ...process.env, COLLECTOR_AGENT_CREDENTIAL_FILE: credentialFile },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true
  });
  agent.stderr.setEncoding('utf8');
  agent.stderr.on('data', (chunk) => { stderr += chunk; });
  const initialized = await initializeMcp(agent);
  if (!initialized) throw new Error('collector_l2_launcher_mcp_initialize_failed');
  if (stderr.includes(issued.token)) throw new Error('collector_l2_launcher_secret_in_stderr');

  process.stdout.write(`${JSON.stringify({
    ok: true,
    gate: 'collector-agent-launcher-real-core-l2',
    realCoreProcess: true,
    realMcpLauncher: true,
    coreRelease: (await fetch(`${origin}/v2/release`)).ok,
    scopedCoreToken: true,
    mcpInitialized: true,
    secretInStderr: false
  })}\n`);
} finally {
  if (agent && agent.exitCode === null) agent.kill('SIGTERM');
  if (agent) await waitForExit(agent);
  if (core && core.exitCode === null) core.kill('SIGTERM');
  if (core) await waitForExit(core);
  await rm(temporaryRoot, { recursive: true, force: true });
}

async function issueToken(serviceOrigin) {
  const response = await fetch(`${serviceOrigin}/v2/collector-service/clients`, {
    method: 'POST',
    headers: {
      origin: serviceOrigin,
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      label: `Agent launcher L2 ${randomUUID()}`,
      scopes: ['browser-bindings:read', 'collect:execute', 'operations:read', 'artifacts:read']
    })
  });
  if (!response.ok) throw new Error('collector_l2_launcher_token_issue_failed');
  const payload = await response.json();
  if (typeof payload.token !== 'string' || !/^cst_[A-Za-z0-9_-]{43}$/.test(payload.token)) {
    throw new Error('collector_l2_launcher_token_invalid');
  }
  return payload;
}

async function initializeMcp(child) {
  let buffer = '';
  return await new Promise((resolveResult, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolveResult(false);
    }, 20_000);
    const onData = (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/u);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const message = JSON.parse(line);
          if (message.id === 1) {
            cleanup();
            resolveResult(message.result?.serverInfo?.name === 'collector-mcp');
            return;
          }
        } catch {
          cleanup();
          reject(new Error('collector_l2_launcher_stdout_not_json'));
          return;
        }
      }
    };
    const onError = () => {
      cleanup();
      reject(new Error('collector_l2_launcher_process_error'));
    };
    const cleanup = () => {
      clearTimeout(timer);
      child.stdout.off('data', onData);
      child.off('error', onError);
    };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', onData);
    child.once('error', onError);
    child.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'collector-agent-launcher-l2', version: '1.0.0' }
      }
    }) + '\n');
  });
}

async function waitForCore(serviceOrigin) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${serviceOrigin}/v2/release`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The real local Core is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error('collector_l2_launcher_core_start_timeout');
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('collector_l2_launcher_port_invalid');
  const port = address.port;
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
}

async function waitForExit(child) {
  if (child.exitCode !== null) return;
  await Promise.race([
    new Promise((resolveExit) => child.once('close', resolveExit)),
    new Promise((resolveTimeout) => setTimeout(resolveTimeout, 3_000))
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}
