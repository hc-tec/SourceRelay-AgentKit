#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isAbsolute, resolve } from 'node:path';
import {
  configuredCoreEntrypoint,
  defaultCredentialFilePath,
  isValidCoreEntrypoint,
  isValidLoopbackOrigin,
  resolveCredentialPath,
  writeStoredCredential
} from './local-credential.js';
import { DEFAULT_CORE_ORIGIN, DEFAULT_CORE_REQUEST_TIMEOUT_MS, SAFE_CODE_PATTERN, TOKEN_PATTERN } from './constants.js';
import { validateCoreOrigin } from './credential.js';
import {
  CORE_START_WAIT_MS,
  MCP_SERVER_NAME,
  installCodexMcp,
  isCoreReachable,
  nextAction,
  printMcpConfig,
  probeCore,
  readCredentialSafely,
  readSetupToken,
  startConfiguredCore,
  validToken,
  verifyCompatibilityForStatus,
  waitForChild,
  waitForCore,
  writeJson,
  type AgentStatusDocument,
  type CoreProbeResult
} from './agent-bootstrap.js';

const AGENT_NAME = 'collector-agent';

export type AgentCliCommand = 'setup' | 'status' | 'doctor' | 'print-config' | 'install-codex' | 'mcp';

export interface ParsedAgentCliArguments {
  command: AgentCliCommand;
  origin?: string;
  credentialFile?: string;
  coreEntrypoint?: string;
  installCodex: boolean;
  skipCoreCheck: boolean;
}

export type { AgentStatusDocument, CoreProbeResult } from './agent-bootstrap.js';

export async function runAgentCli(
  argv: string[] = process.argv.slice(2),
  environment: NodeJS.ProcessEnv = process.env
): Promise<number> {
  try {
    const parsed = parseAgentCliArguments(argv);
    switch (parsed.command) {
      case 'setup':
        await runSetup(parsed, environment);
        return 0;
      case 'status':
      case 'doctor':
        return await runStatus(parsed, environment);
      case 'print-config':
        printMcpConfig();
        return 0;
      case 'install-codex':
        await installCodexMcp();
        writeJson({ ok: true, host: 'codex', server: MCP_SERVER_NAME });
        return 0;
      case 'mcp':
        return await runMcp(parsed, environment);
    }
  } catch (error) {
    process.stderr.write(`${AGENT_NAME}_failed:${safeCliError(error)}\n`);
    return 1;
  }
}

export function parseAgentCliArguments(argv: string[]): ParsedAgentCliArguments {
  const commandValue = argv[0];
  if (commandValue === undefined || commandValue === '--help' || commandValue === '-h') {
    throw new Error('collector_agent_usage');
  }
  if (!['setup', 'status', 'doctor', 'print-config', 'install-codex', 'mcp'].includes(commandValue)) {
    throw new Error('collector_agent_unknown_command');
  }
  const command = commandValue as AgentCliCommand;
  let origin: string | undefined;
  let credentialFile: string | undefined;
  let coreEntrypoint: string | undefined;
  let installCodex = false;
  let skipCoreCheck = false;
  for (let index = 1; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--install-codex') {
      installCodex = true;
      continue;
    }
    if (option === '--skip-core-check') {
      skipCoreCheck = true;
      continue;
    }
    if (option === '--origin' || option === '--credential-file' || option === '--core-entrypoint') {
      const value = argv[++index];
      if (value === undefined || value.startsWith('--')) throw new Error('collector_agent_option_value_missing');
      if (option === '--origin') origin = validateCoreOrigin(value);
      if (option === '--credential-file') credentialFile = resolveCredentialPath(value);
      if (option === '--core-entrypoint') {
        if (!isAbsolute(value) || !isValidCoreEntrypoint(value)) {
          throw new Error('collector_agent_core_entrypoint_invalid');
        }
        coreEntrypoint = resolve(value);
      }
      continue;
    }
    throw new Error('collector_agent_unknown_option');
  }
  if (installCodex && command !== 'setup') throw new Error('collector_agent_option_invalid');
  if (skipCoreCheck && command !== 'setup') throw new Error('collector_agent_option_invalid');
  return {
    command,
    ...(origin === undefined ? {} : { origin }),
    ...(credentialFile === undefined ? {} : { credentialFile }),
    ...(coreEntrypoint === undefined ? {} : { coreEntrypoint }),
    installCodex,
    skipCoreCheck
  };
}

async function runSetup(
  options: ParsedAgentCliArguments,
  environment: NodeJS.ProcessEnv
): Promise<void> {
  const origin = options.origin ?? validateCoreOrigin(
    environment.COLLECTOR_CORE_ORIGIN ?? DEFAULT_CORE_ORIGIN
  );
  const token = await readSetupToken(environment);
  if (!TOKEN_PATTERN.test(token)) throw new Error('collector_agent_token_format_invalid');

  const probe = options.skipCoreCheck
    ? { reachable: false, authenticated: null, releaseVersion: null }
    : await probeCore(origin, token, DEFAULT_CORE_REQUEST_TIMEOUT_MS);
  if (!options.skipCoreCheck && (!probe.reachable || probe.authenticated !== true)) {
    throw new Error(probe.reachable
      ? 'collector_agent_core_authentication_failed'
      : 'collector_agent_core_unreachable');
  }

  const credentialFile = options.credentialFile === undefined
    ? defaultCredentialFilePath(environment)
    : options.credentialFile;
  const existing = readCredentialSafely({ environment, filePath: credentialFile });
  const coreEntrypoint = options.coreEntrypoint ?? configuredCoreEntrypoint(existing.credential, environment);
  if (options.coreEntrypoint !== undefined && !existsSync(options.coreEntrypoint)) {
    throw new Error('collector_agent_core_entrypoint_missing');
  }
  const savedPath = await writeStoredCredential({
    origin,
    token,
    ...(coreEntrypoint === null || coreEntrypoint === undefined ? {} : { coreEntrypoint })
  }, { environment, filePath: credentialFile });

  let codex = false;
  if (options.installCodex) {
    await installCodexMcp();
    codex = true;
  }
  writeJson({
    ok: true,
    credential: { saved: true, file: savedPath },
    core: {
      reachable: probe.reachable,
      authenticated: probe.authenticated,
      release: probe.releaseVersion
    },
    codex: { configured: codex }
  });
}

async function runStatus(
  options: ParsedAgentCliArguments,
  environment: NodeJS.ProcessEnv
): Promise<number> {
  const file = options.credentialFile === undefined
    ? defaultCredentialFilePath(environment)
    : options.credentialFile;
  const credentialRead = readCredentialSafely({ environment, filePath: file });
  const credential = credentialRead.credential;
  const origin = options.origin ?? environment.COLLECTOR_CORE_ORIGIN ??
    credential?.origin ?? DEFAULT_CORE_ORIGIN;
  const validOrigin = isValidLoopbackOrigin(origin);
  const probe: CoreProbeResult = validOrigin
    ? await probeCore(origin, credential?.token ?? environment.COLLECTOR_CORE_TOKEN, DEFAULT_CORE_REQUEST_TIMEOUT_MS)
    : { reachable: false, authenticated: null, releaseVersion: null };
  const configuredEntrypoint = configuredCoreEntrypoint(credential, environment) !== null;
  const launcher = fileURLToPath(import.meta.url);
  const hasCredential = credentialRead.valid || validToken(environment.COLLECTOR_CORE_TOKEN);
  const compatibility = hasCredential && probe.authenticated === true
    ? await verifyCompatibilityForStatus(file, options.origin, environment)
    : { verified: false, errorCode: probe.reachable ? 'authentication_failed' : 'core_unavailable' };
  const ready = hasCredential && compatibility.verified && validOrigin && probe.reachable &&
    (credential?.token === undefined || probe.authenticated === true);
  const document: AgentStatusDocument = {
    schemaVersion: 1,
    ok: ready,
    core: {
      reachable: probe.reachable,
      authenticated: probe.authenticated,
      origin: validOrigin ? new URL(origin).origin : '<invalid-loopback-origin>',
      release: probe.releaseVersion
    },
    compatibility,
    credential: {
      present: credentialRead.present,
      validFormat: credentialRead.valid,
      file
    },
    mcp: { launcher, configuredCoreEntrypoint: configuredEntrypoint },
    nextAction: ready ? null : nextAction(credentialRead, probe, configuredEntrypoint, compatibility)
  };
  writeJson(document);
  return ready ? 0 : 1;
}

async function runMcp(
  options: ParsedAgentCliArguments,
  environment: NodeJS.ProcessEnv
): Promise<number> {
  const file = options.credentialFile ?? defaultCredentialFilePath(environment);
  const credentialRead = readCredentialSafely({ environment, filePath: file });
  const credential = credentialRead.credential;
  const origin = validateCoreOrigin(
    options.origin ?? environment.COLLECTOR_CORE_ORIGIN ?? credential?.origin ?? DEFAULT_CORE_ORIGIN
  );
  if (credential === null && !validToken(environment.COLLECTOR_CORE_TOKEN)) {
    throw new Error('collector_agent_credentials_missing');
  }
  if (!(await isCoreReachable(origin))) {
    const entrypoint = configuredCoreEntrypoint(credential, environment);
    if (entrypoint === null) throw new Error('collector_agent_core_unreachable');
    await startConfiguredCore(entrypoint, origin, environment);
    await waitForCore(origin, CORE_START_WAIT_MS);
  }

  const cliEntrypoint = fileURLToPath(new URL('./cli.js', import.meta.url));
  const childEnvironment: NodeJS.ProcessEnv = {
    ...environment,
    COLLECTOR_AGENT_CREDENTIAL_FILE: file,
    ...(options.origin === undefined ? {} : { COLLECTOR_CORE_ORIGIN: options.origin })
  };
  const child = spawn(process.execPath, [cliEntrypoint], {
    stdio: 'inherit',
    env: childEnvironment,
    windowsHide: true
  });
  return await waitForChild(child);
}

function safeCliError(error: unknown): string {
  const value = error instanceof Error ? error.message : 'unknown';
  return SAFE_CODE_PATTERN.test(value) ? value : 'unknown';
}

const isMainModule = process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMainModule) process.exitCode = await runAgentCli();
