import {
  DEFAULT_CORE_ORIGIN,
  DEFAULT_CORE_REQUEST_TIMEOUT_MS,
  TOKEN_PATTERN
} from './constants.js';
import { CollectorMcpError } from './errors.js';

export interface CollectorCoreRuntimeConfig {
  origin: string;
  token: string;
  requestTimeoutMs: number;
}

/**
 * Checkpoint 3 credential boundary.
 *
 * The Agent never receives this object. Credential issuance and child-process
 * environment injection belong to the Core/Agent Host deployment boundary;
 * this MCP package deliberately has no OS credential-store configurator.
 */
export function loadCollectorCoreRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env
): CollectorCoreRuntimeConfig {
  const token = environment.COLLECTOR_CORE_TOKEN;
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
    throw new CollectorMcpError('authentication_failed');
  }
  const origin = validateCoreOrigin(environment.COLLECTOR_CORE_ORIGIN ?? DEFAULT_CORE_ORIGIN);
  const requestTimeoutMs = parseTimeout(
    environment.COLLECTOR_CORE_REQUEST_TIMEOUT_MS,
    DEFAULT_CORE_REQUEST_TIMEOUT_MS
  );
  return { origin, token, requestTimeoutMs };
}

export function validateCoreOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CollectorMcpError('core_unavailable');
  }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port ||
    url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new CollectorMcpError('core_unavailable');
  }
  return url.origin;
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
