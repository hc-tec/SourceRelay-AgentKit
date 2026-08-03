import { randomUUID } from 'node:crypto';
import { DIGEST_PATTERN, SAFE_CODE_PATTERN, UUID_PATTERN } from './constants.js';

export type CollectorLogLevel = 'info' | 'warn' | 'error';

const ALLOWED_FIELDS = new Set([
  'artifactId',
  'bindingCount',
  'capabilityCount',
  'capabilityId',
  'catalogDigest',
  'coreOperationId',
  'coreState',
  'durationMs',
  'errorCode',
  'openApiDigest',
  'outcome',
  'resourceKind'
]);

export class SafeLogger {
  readonly sessionId: string;
  readonly #write: (text: string) => void;

  constructor(write: (text: string) => void = (text) => process.stderr.write(text), sessionId = randomUUID()) {
    this.#write = write;
    this.sessionId = UUID_PATTERN.test(sessionId) ? sessionId : randomUUID();
  }

  record(level: CollectorLogLevel, eventType: string, fields: Record<string, unknown> = {}): void {
    const event: Record<string, unknown> = {
      schemaVersion: 1,
      timestamp: new Date().toISOString(),
      level,
      eventType: safeEventType(eventType),
      mcpSessionId: this.sessionId
    };
    for (const [key, value] of Object.entries(fields)) {
      if (!ALLOWED_FIELDS.has(key)) continue;
      const safe = safeField(key, value);
      if (safe !== undefined) event[key] = safe;
    }
    this.#write(`${JSON.stringify(event)}\n`);
  }
}

function safeEventType(value: string): string {
  return SAFE_CODE_PATTERN.test(value) ? value : 'collector.mcp.event_invalid';
}

function safeField(key: string, value: unknown): unknown {
  if (key === 'durationMs' || key === 'bindingCount' || key === 'capabilityCount') {
    return Number.isSafeInteger(value) && (value as number) >= 0 ? value : undefined;
  }
  if (key === 'artifactId' || key === 'coreOperationId') {
    return typeof value === 'string' && UUID_PATTERN.test(value) ? value : undefined;
  }
  if (key === 'catalogDigest' || key === 'openApiDigest') {
    return typeof value === 'string' && DIGEST_PATTERN.test(value) ? value : undefined;
  }
  return typeof value === 'string' && SAFE_CODE_PATTERN.test(value) ? value : undefined;
}
