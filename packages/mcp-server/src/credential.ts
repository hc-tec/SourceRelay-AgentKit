import {
  DEFAULT_CORE_ORIGIN,
  DEFAULT_CORE_REQUEST_TIMEOUT_MS,
  TOKEN_PATTERN
} from './constants.js';
import { CollectorMcpError } from './errors.js';
import {
  defaultCredentialFilePath,
  readStoredCredentialSync,
  validateStoredCredentialOrigin
} from './local-credential.js';

export interface CollectorCoreRuntimeConfig {
  origin: string;
  token: string;
  requestTimeoutMs: number;
}

export function loadCollectorCoreRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env
): CollectorCoreRuntimeConfig {
  const explicitToken = environment.COLLECTOR_CORE_TOKEN;
  const credential = explicitToken === undefined && shouldReadLocalCredential(environment)
    ? readCredentialForRuntime(environment)
    : null;
  const token = explicitToken ?? credential?.token;
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
    throw new CollectorMcpError('authentication_failed');
  }
  const origin = validateCoreOrigin(
    environment.COLLECTOR_CORE_ORIGIN ?? credential?.origin ?? DEFAULT_CORE_ORIGIN
  );
  const requestTimeoutMs = parseTimeout(
    environment.COLLECTOR_CORE_REQUEST_TIMEOUT_MS,
    DEFAULT_CORE_REQUEST_TIMEOUT_MS
  );
  return { origin, token, requestTimeoutMs };
}

export function validateCoreOrigin(value: string): string {
  if (!validateStoredCredentialOrigin(value)) {
    throw new CollectorMcpError('core_unavailable');
  }
  return new URL(value).origin;
}

function readCredentialForRuntime(
  environment: NodeJS.ProcessEnv
): ReturnType<typeof readStoredCredentialSync> {
  try {
    return readStoredCredentialSync({
      environment,
      filePath: environment.COLLECTOR_AGENT_CREDENTIAL_FILE ?? defaultCredentialFilePath(environment)
    });
  } catch {
    // Missing and malformed local credentials are intentionally collapsed into
    // the stable authentication_failed MCP error below. The file contents and
    // parser details must never enter an Agent trace.
    return null;
  }
}

function shouldReadLocalCredential(environment: NodeJS.ProcessEnv): boolean {
  // Production CLI calls this function with process.env. Tests and embedded
  // callers commonly pass a deliberately isolated object; they must not
  // accidentally read a developer's real credential file from disk.
  return environment === process.env ||
    typeof environment.COLLECTOR_AGENT_CREDENTIAL_FILE === 'string';
}

function parseTimeout(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(value)) throw new CollectorMcpError('core_unavailable');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 100 || parsed > 120_000) {
    throw new CollectorMcpError('core_unavailable');
  }
  return parsed;
}
