import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { stdin as processStdin, stdout as processStdout } from 'node:process';
import {
  configuredCoreEntrypoint,
  isValidCoreEntrypoint,
  readStoredCredentialSync,
  type StoredCollectorCoreCredential
} from './local-credential.js';
import {
  TOKEN_PATTERN
} from './constants.js';
import { loadCollectorCoreRuntimeConfig } from './credential.js';
import { stableErrorCode } from './errors.js';
import { CollectorCoreClient } from './core-client.js';
import { preflightCollectorCore } from './server.js';

export const MCP_SERVER_NAME = 'collector';
export const CORE_START_WAIT_MS = 15_000;
const CORE_POLL_INTERVAL_MS = 250;

export interface CoreProbeResult {
  reachable: boolean;
  authenticated: boolean | null;
  releaseVersion: string | null;
}

export interface AgentStatusDocument {
  schemaVersion: 1;
  ok: boolean;
  core: {
    reachable: boolean;
    authenticated: boolean | null;
    origin: string;
    release: string | null;
  };
  compatibility: {
    verified: boolean;
    errorCode: string | null;
  };
  credential: {
    present: boolean;
    validFormat: boolean;
    file: string;
  };
  mcp: {
    launcher: string;
    configuredCoreEntrypoint: boolean;
  };
  nextAction: string | null;
}

export async function readSetupToken(environment: NodeJS.ProcessEnv): Promise<string> {
  const supplied = environment.COLLECTOR_AGENT_SETUP_TOKEN?.trim();
  if (supplied) return supplied;
  if (!processStdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of processStdin) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString('utf8').trim().split(/\r?\n/u)[0] ?? '';
  }
  return await readHiddenLine('SourceRelay Core token (input is not logged): ');
}

async function readHiddenLine(prompt: string): Promise<string> {
  processStdout.write(prompt);
  if (!processStdin.isTTY || typeof processStdin.setRawMode !== 'function') {
    processStdout.write('\n');
    return '';
  }
  return await new Promise<string>((resolveLine, reject) => {
    let value = '';
    const onData = (chunk: Buffer | string) => {
      const text = chunk.toString('utf8');
      for (const character of text) {
        if (character === '\u0003') {
          cleanup();
          reject(new Error('collector_agent_setup_cancelled'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          processStdout.write('\n');
          resolveLine(value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        if (character.length === 1) value += character;
      }
    };
    const cleanup = () => {
      processStdin.off('data', onData);
      processStdin.setRawMode?.(false);
      processStdin.pause();
    };
    processStdin.setRawMode(true);
    processStdin.resume();
    processStdin.on('data', onData);
  });
}

export async function installCodexMcp(): Promise<void> {
  const codex = resolveCodexInvoker();
  const listed = await runCodex(codex, ['mcp', 'list', '--json']);
  if (listed.code === 0) {
    try {
      const entries = JSON.parse(listed.stdout) as unknown;
      if (Array.isArray(entries) && entries.some((entry) =>
        isRecord(entry) && entry.name === MCP_SERVER_NAME)) {
        const removed = await runCodex(codex, ['mcp', 'remove', MCP_SERVER_NAME]);
        if (removed.code !== 0) throw new Error('collector_agent_codex_remove_failed');
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('collector_agent_')) throw error;
      throw new Error('collector_agent_codex_list_invalid');
    }
  } else if (listed.code !== 0 && listed.code !== 1) {
    throw new Error('collector_agent_codex_unavailable');
  }
  const agentEntrypoint = fileURLToPath(import.meta.url).replace(/agent-bootstrap\.js$/u, 'agent-cli.js');
  const added = await runCodex(codex, [
    'mcp', 'add', MCP_SERVER_NAME, '--', process.execPath, agentEntrypoint, 'mcp'
  ]);
  if (added.code !== 0) throw new Error('collector_agent_codex_install_failed');
}

interface CodexInvoker {
  command: string;
  prefix: string[];
  shell: boolean;
}

function resolveCodexInvoker(environment: NodeJS.ProcessEnv = process.env): CodexInvoker {
  const prefix = process.platform === 'win32'
    ? (environment.APPDATA ?? join(environment.USERPROFILE ?? homedir(), 'AppData', 'Roaming'))
    : (environment.npm_config_prefix ?? '/usr/local');
  const candidates = [
    join(prefix, 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js'),
    join(prefix, 'lib', 'node_modules', '@openai', 'codex', 'bin', 'codex.js'),
    join(prefix, 'node_modules', '@openai', 'codex', 'bin', 'codex.js')
  ];
  const script = candidates.find((candidate) => existsSync(candidate));
  if (script !== undefined) return { command: process.execPath, prefix: [script], shell: false };
  return {
    command: process.platform === 'win32' ? 'codex.cmd' : 'codex',
    prefix: [],
    shell: process.platform === 'win32'
  };
}

function runCodex(
  invoker: CodexInvoker,
  args: string[]
): Promise<{ code: number; stdout: string; stderr: string }> {
  return runCommand(invoker.command, [...invoker.prefix, ...args], { shell: invoker.shell });
}

export async function probeCore(origin: string, token: string | undefined, timeoutMs: number): Promise<CoreProbeResult> {
  let releaseVersion: string | null = null;
  try {
    const release = await fetchJson(`${origin}/v2/release`, timeoutMs);
    if (isRecord(release) && typeof release.releaseVersion === 'string') {
      releaseVersion = release.releaseVersion;
    }
  } catch {
    return { reachable: false, authenticated: token === undefined ? null : false, releaseVersion: null };
  }
  if (!validToken(token)) return { reachable: true, authenticated: null, releaseVersion };
  try {
    const response = await fetch(`${origin}/v2/collector-service/browser-bindings`, {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs)
    });
    return { reachable: true, authenticated: response.ok, releaseVersion };
  } catch {
    return { reachable: true, authenticated: false, releaseVersion };
  }
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error('collector_agent_core_probe_failed');
  return await response.json() as unknown;
}

export async function isCoreReachable(origin: string): Promise<boolean> {
  try {
    await fetchJson(`${origin}/v2/release`, 2_000);
    return true;
  } catch {
    return false;
  }
}

export async function waitForCore(origin: string, maximumMs: number): Promise<void> {
  const deadline = Date.now() + maximumMs;
  while (Date.now() < deadline) {
    if (await isCoreReachable(origin)) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, CORE_POLL_INTERVAL_MS));
  }
  throw new Error('collector_agent_core_start_timeout');
}

export async function startConfiguredCore(
  entrypoint: string,
  origin: string,
  environment: NodeJS.ProcessEnv
): Promise<void> {
  if (!isValidCoreEntrypoint(entrypoint) || !existsSync(entrypoint)) {
    throw new Error('collector_agent_core_entrypoint_invalid');
  }
  const childEnvironment: NodeJS.ProcessEnv = { ...environment };
  delete childEnvironment.COLLECTOR_CORE_TOKEN;
  delete childEnvironment.COLLECTOR_AGENT_SETUP_TOKEN;
  delete childEnvironment.COLLECTOR_AGENT_CREDENTIAL_FILE;
  delete childEnvironment['DEEP' + 'SEEK_API_KEY'];
  delete childEnvironment.OPENAI_API_KEY;
  delete childEnvironment.ANTHROPIC_API_KEY;
  childEnvironment.COLLECTOR_GATEWAY_PORT = new URL(origin).port;
  const child = spawn(process.execPath, [entrypoint], {
    env: childEnvironment,
    stdio: 'ignore',
    detached: true,
    windowsHide: true
  });
  child.unref();
}

export async function verifyCompatibilityForStatus(
  file: string,
  origin: string | undefined,
  environment: NodeJS.ProcessEnv
): Promise<{ verified: boolean; errorCode: string | null }> {
  try {
    const runtimeEnvironment: NodeJS.ProcessEnv = {
      ...environment,
      COLLECTOR_AGENT_CREDENTIAL_FILE: file,
      ...(origin === undefined ? {} : { COLLECTOR_CORE_ORIGIN: origin })
    };
    const runtime = loadCollectorCoreRuntimeConfig(runtimeEnvironment);
    await preflightCollectorCore(new CollectorCoreClient(runtime));
    return { verified: true, errorCode: null };
  } catch (error) {
    return { verified: false, errorCode: stableErrorCode(error) };
  }
}

export function readCredentialSafely(options: {
  environment: NodeJS.ProcessEnv;
  filePath: string;
}): { credential: StoredCollectorCoreCredential | null; present: boolean; valid: boolean } {
  try {
    const credential = readStoredCredentialSync(options);
    return { credential, present: credential !== null, valid: credential !== null };
  } catch {
    return { credential: null, present: true, valid: false };
  }
}

export function validToken(token: string | undefined): token is string {
  return typeof token === 'string' && TOKEN_PATTERN.test(token);
}

export function nextAction(
  credential: { present: boolean; valid: boolean },
  probe: CoreProbeResult,
  configuredEntrypoint: boolean,
  compatibility: { verified: boolean; errorCode: string | null }
): string {
  if (!credential.present || !credential.valid) return 'collector-agent setup';
  if (!probe.reachable) return configuredEntrypoint ? 'collector-agent mcp' : 'start SourceRelay Core Gateway';
  if (probe.authenticated === false) return 'collector-agent setup';
  if (!compatibility.verified) {
    return compatibility.errorCode === 'compatibility_unmet'
      ? 'install or restart the compatible SourceRelay Core release'
      : 'collector-agent doctor';
  }
  return 'collector-agent status';
}

export function printMcpConfig(): void {
  const agentEntrypoint = fileURLToPath(import.meta.url).replace(/agent-bootstrap\.js$/u, 'agent-cli.js');
  writeJson({
    mcpServers: {
      [MCP_SERVER_NAME]: {
        command: process.execPath,
        args: [agentEntrypoint, 'mcp']
      }
    }
  });
}

export function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function runCommand(
  command: string,
  args: string[],
  options: { shell?: boolean } = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolveCommand) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, args, {
        windowsHide: true,
        shell: options.shell ?? false,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch {
      resolveCommand({ code: 127, stdout: '', stderr: '' });
      return;
    }
    let stdout = '';
    let stderr = '';
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr?.on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', () => resolveCommand({ code: 127, stdout, stderr }));
    child.once('close', (code) => resolveCommand({ code: code ?? 1, stdout, stderr }));
  });
}

export function waitForChild(child: ReturnType<typeof spawn>): Promise<number> {
  return new Promise((resolveChild) => {
    child.once('error', () => resolveChild(1));
    child.once('close', (code) => resolveChild(code ?? 1));
  });
}

export function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
