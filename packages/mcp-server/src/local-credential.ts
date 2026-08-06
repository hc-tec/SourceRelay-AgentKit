import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve, win32 } from 'node:path';
import { TOKEN_PATTERN } from './constants.js';

/**
 * The small amount of state the Agent Host needs to start SourceRelay MCP.
 *
 * This is deliberately not a browser profile, cookie jar, or Core state
 * directory. The Core token is a scoped application credential; the browser
 * remains owned by the Core + extension deployment.
 */
export interface StoredCollectorCoreCredential {
  schemaVersion: 1;
  origin: string;
  token: string;
  createdAt: string;
  /** Optional path to a released Core user-browser-server.js entrypoint. */
  coreEntrypoint?: string;
}

export interface CredentialStoreOptions {
  environment?: NodeJS.ProcessEnv;
  filePath?: string;
}

export const CREDENTIAL_SCHEMA_VERSION = 1 as const;

export function defaultCredentialFilePath(
  environment: NodeJS.ProcessEnv = process.env
): string {
  const configured = environment.COLLECTOR_AGENT_CREDENTIAL_FILE?.trim();
  if (configured) return resolveCredentialPath(configured);

  const base = process.platform === 'win32'
    ? (environment.LOCALAPPDATA ?? join(environment.USERPROFILE ?? homedir(), 'AppData', 'Local'))
    : (environment.XDG_CONFIG_HOME ?? join(environment.HOME ?? homedir(), '.config'));
  return join(base, 'SourceRelay', 'AgentKit', 'core-credential.json');
}

export function resolveCredentialPath(value: string): string {
  const path = resolve(value);
  // A credential file must be a file below a user-selected directory. Reject
  // filesystem roots and the current directory itself to avoid accidentally
  // overwriting a project or an entire profile directory.
  const root = resolve(path, '..');
  if (path === root || path.endsWith('\\') || path.endsWith('/')) {
    throw new Error('collector_agent_credential_path_invalid');
  }
  return path;
}

export function parseStoredCredential(value: unknown): StoredCollectorCoreCredential {
  if (!isRecord(value) || value.schemaVersion !== CREDENTIAL_SCHEMA_VERSION ||
    typeof value.origin !== 'string' || typeof value.token !== 'string' ||
    typeof value.createdAt !== 'string' || !TOKEN_PATTERN.test(value.token) ||
    !isValidTimestamp(value.createdAt) || !isValidLoopbackOrigin(value.origin)) {
    throw new Error('collector_agent_credential_invalid');
  }
  const coreEntrypoint = value.coreEntrypoint;
  if (coreEntrypoint !== undefined &&
    (typeof coreEntrypoint !== 'string' || !isValidCoreEntrypoint(coreEntrypoint))) {
    throw new Error('collector_agent_credential_invalid');
  }
  return {
    schemaVersion: 1,
    origin: value.origin,
    token: value.token,
    createdAt: value.createdAt,
    ...(coreEntrypoint === undefined ? {} : { coreEntrypoint: resolve(coreEntrypoint) })
  };
}

export async function readStoredCredential(
  options: CredentialStoreOptions = {}
): Promise<StoredCollectorCoreCredential | null> {
  const path = options.filePath === undefined
    ? defaultCredentialFilePath(options.environment)
    : resolveCredentialPath(options.filePath);
  let text: string;
  try {
    text = await readFile(path, { encoding: 'utf8' });
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw new Error('collector_agent_credential_unreadable');
  }
  try {
    return parseStoredCredential(JSON.parse(text) as unknown);
  } catch {
    throw new Error('collector_agent_credential_invalid');
  }
}

export function readStoredCredentialSync(
  options: CredentialStoreOptions = {}
): StoredCollectorCoreCredential | null {
  // The CLI only needs the async API at runtime. This synchronous helper is
  // intentionally implemented through the same parser for small unit tests
  // and diagnostics that must not expose the token.
  const path = options.filePath === undefined
    ? defaultCredentialFilePath(options.environment)
    : resolveCredentialPath(options.filePath);
  try {
    const text = requireReadFileSync(path);
    return parseStoredCredential(JSON.parse(text) as unknown);
  } catch (error) {
    if (isMissingFile(error)) return null;
    if (error instanceof Error && error.message.startsWith('collector_agent_credential_')) {
      throw error;
    }
    throw new Error('collector_agent_credential_invalid');
  }
}

export async function writeStoredCredential(
  credential: Omit<StoredCollectorCoreCredential, 'schemaVersion' | 'createdAt'> & {
    createdAt?: string;
  },
  options: CredentialStoreOptions = {}
): Promise<string> {
  const path = options.filePath === undefined
    ? defaultCredentialFilePath(options.environment)
    : resolveCredentialPath(options.filePath);
  const normalized: StoredCollectorCoreCredential = parseStoredCredential({
    schemaVersion: CREDENTIAL_SCHEMA_VERSION,
    origin: credential.origin,
    token: credential.token,
    createdAt: credential.createdAt ?? new Date().toISOString(),
    ...(credential.coreEntrypoint === undefined ? {} : {
      coreEntrypoint: credential.coreEntrypoint
    })
  });
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  const previous = `${path}.${process.pid}.${Date.now()}.previous`;
  const text = `${JSON.stringify(normalized, null, 2)}\n`;
  let movedPrevious = false;
  try {
    await writeFile(temporary, text, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await restrictFile(temporary);
    if (existsSync(path)) {
      await rename(path, previous);
      movedPrevious = true;
    }
    await rename(temporary, path);
    await restrictFile(path);
    if (movedPrevious) await unlink(previous).catch(() => undefined);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    if (movedPrevious && !existsSync(path)) await rename(previous, path).catch(() => undefined);
    if (movedPrevious && existsSync(path)) await unlink(previous).catch(() => undefined);
    if (error instanceof Error && error.message.startsWith('collector_agent_')) {
      throw error;
    }
    throw new Error('collector_agent_credential_write_failed');
  }
  return path;
}

export function credentialFilePath(options: CredentialStoreOptions = {}): string {
  return options.filePath === undefined
    ? defaultCredentialFilePath(options.environment)
    : resolveCredentialPath(options.filePath);
}

export function isValidLoopbackOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port !== '' &&
      url.username === '' && url.password === '' && url.pathname === '/' &&
      url.search === '' && url.hash === '';
  } catch {
    return false;
  }
}

export const validateStoredCredentialOrigin = isValidLoopbackOrigin;

export function isValidCoreEntrypoint(value: string): boolean {
  if (!isAbsolute(value)) return false;
  const normalized = resolve(value);
  return (basename(normalized).toLowerCase() === 'user-browser-server.js' ||
    win32.basename(normalized).toLowerCase() === 'user-browser-server.js');
}

export function configuredCoreEntrypoint(
  credential: StoredCollectorCoreCredential | null,
  environment: NodeJS.ProcessEnv = process.env
): string | null {
  const fromEnvironment = environment.COLLECTOR_CORE_ENTRYPOINT?.trim();
  if (fromEnvironment) {
    return isValidCoreEntrypoint(fromEnvironment) && existsSync(fromEnvironment)
      ? resolve(fromEnvironment)
      : null;
  }
  return credential?.coreEntrypoint !== undefined && existsSync(credential.coreEntrypoint)
    ? credential.coreEntrypoint
    : null;
}

async function restrictFile(path: string): Promise<void> {
  // chmod is meaningful on Unix and is the best portable Node-level boundary
  // on Windows. Windows installers can add a user-only ACL in a later adapter.
  await chmod(path, 0o600).catch(() => undefined);
}

function isValidTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && value.length <= 64;
}

function isMissingFile(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT';
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Kept in a tiny isolated helper so the public module remains ESM-only while
// still allowing tests/diagnostics to inspect a file without exposing content.
function requireReadFileSync(path: string): string {
  return readFileSync(path, { encoding: 'utf8' });
}
