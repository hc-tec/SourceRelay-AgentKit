import {
  ARTIFACT_RESOURCE_WINDOW_BYTES,
  MAX_CORE_JSON_BYTES,
  UUID_PATTERN
} from './constants.js';
import { CollectorMcpError, safeCoreErrorCode } from './errors.js';

export interface CollectorCoreApi {
  readRelease(): Promise<unknown>;
  readCapabilities(): Promise<unknown>;
  readOpenApi(): Promise<unknown>;
  readBindings(): Promise<unknown>;
  readOperation(operationId: string): Promise<unknown>;
  readArtifactMetadata(artifactId: string): Promise<unknown>;
  readArtifactWindow(artifactId: string, offset: number, maximumBytes?: number): Promise<unknown>;
  submitCollection(request: Record<string, unknown>): Promise<unknown>;
}

export interface CollectorCoreClientOptions {
  origin: string;
  token: string;
  requestTimeoutMs: number;
  fetchImpl?: typeof fetch;
}

export class CollectorCoreClient implements CollectorCoreApi {
  readonly #origin: string;
  readonly #token: string;
  readonly #requestTimeoutMs: number;
  readonly #fetch: typeof fetch;

  constructor(options: CollectorCoreClientOptions) {
    this.#origin = options.origin;
    this.#token = options.token;
    this.#requestTimeoutMs = options.requestTimeoutMs;
    this.#fetch = options.fetchImpl ?? globalThis.fetch;
    if (typeof this.#fetch !== 'function') throw new CollectorMcpError('core_unavailable');
  }

  async readRelease(): Promise<unknown> {
    return await this.#request('/v2/release', false, 256 * 1024);
  }

  async readCapabilities(): Promise<unknown> {
    return await this.#request('/v2/capabilities', false, 2 * 1024 * 1024);
  }

  async readOpenApi(): Promise<unknown> {
    return await this.#request('/v2/openapi.json', false, 4 * 1024 * 1024);
  }

  async readBindings(): Promise<unknown> {
    return await this.#request('/v2/collector-service/browser-bindings', true, 256 * 1024);
  }

  async readOperation(operationId: string): Promise<unknown> {
    requireUuid(operationId);
    const payload = await this.#request(`/v2/collect/operations/${operationId}`, true, 512 * 1024);
    return record(payload).result;
  }

  async readArtifactMetadata(artifactId: string): Promise<unknown> {
    requireUuid(artifactId);
    const payload = await this.#request(`/v2/collect/artifacts/${artifactId}`, true, 256 * 1024);
    return record(payload).metadata;
  }

  async readArtifactWindow(
    artifactId: string,
    offset: number,
    maximumBytes = ARTIFACT_RESOURCE_WINDOW_BYTES
  ): Promise<unknown> {
    requireUuid(artifactId);
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(maximumBytes) ||
      maximumBytes < 1 || maximumBytes > 65_536) {
      throw new CollectorMcpError('resource_uri_invalid');
    }
    const payload = await this.#request(
      `/v2/collect/artifacts/${artifactId}/content?offset=${offset}&maxBytes=${maximumBytes}`,
      true,
      Math.min(MAX_CORE_JSON_BYTES, maximumBytes * 3 + 64 * 1024)
    );
    return record(payload).window;
  }

  async submitCollection(request: Record<string, unknown>): Promise<unknown> {
    return await this.#request('/v2/collect', true, 512 * 1024, {
      method: 'POST',
      body: request,
      submission: true
    });
  }

  async #request(
    path: string,
    authenticated: boolean,
    maximumBytes: number,
    options: {
      method?: 'GET' | 'POST';
      body?: Record<string, unknown>;
      submission?: boolean;
    } = {}
  ): Promise<unknown> {
    const method = options.method ?? 'GET';
    let body: string | undefined;
    if (options.body !== undefined) {
      try {
        body = JSON.stringify(options.body);
      } catch {
        throw new CollectorMcpError('core_response_invalid');
      }
    }
    let response: Response;
    try {
      response = await this.#fetch(`${this.#origin}${path}`, {
        method,
        headers: {
          accept: 'application/json',
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(authenticated ? { authorization: `Bearer ${this.#token}` } : {})
        },
        ...(body === undefined ? {} : { body }),
        redirect: 'error',
        signal: AbortSignal.timeout(this.#requestTimeoutMs)
      });
    } catch {
      throw new CollectorMcpError(
        options.submission === true ? 'submission_outcome_unknown' : 'core_unavailable'
      );
    }

    const length = response.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximumBytes)) {
      throw unreadableResponseError(
        response,
        options.submission === true,
        'core_response_too_large'
      );
    }
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw unreadableResponseError(response, options.submission === true, 'core_unavailable');
    }
    if (bytes.byteLength > maximumBytes) {
      throw unreadableResponseError(
        response,
        options.submission === true,
        'core_response_too_large'
      );
    }
    let payload: unknown;
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      payload = JSON.parse(text);
    } catch {
      throw unreadableResponseError(response, options.submission === true, 'core_response_invalid');
    }
    if (!response.ok) throw coreHttpError(response.status, payload, options.submission === true);
    return payload;
  }
}

function unreadableResponseError(
  response: Response,
  submission: boolean,
  fallback: 'core_response_invalid' | 'core_response_too_large' | 'core_unavailable'
): CollectorMcpError {
  if (!submission) return new CollectorMcpError(fallback, response.status);
  if (!response.ok) return coreHttpError(response.status, null, true);
  return new CollectorMcpError('submission_outcome_unknown', response.status);
}

function coreHttpError(status: number, payload: unknown, submission: boolean): CollectorMcpError {
  const code = safeCoreErrorCode(isRecord(payload) ? payload.error : null);
  if (status === 401) return new CollectorMcpError('authentication_failed', status, code);
  if (status === 403) return new CollectorMcpError('permission_denied', status, code);
  if (status === 404) return new CollectorMcpError('resource_not_found', status, code);
  if (status === 416 || code === 'collector_service_artifact_read_out_of_bounds' ||
    code === 'collector_service_artifact_offset_not_utf8_boundary') {
    return new CollectorMcpError('artifact_read_out_of_bounds', status);
  }
  if (status === 400 && (code === 'collector_service_artifact_offset_invalid' ||
    code === 'collector_service_artifact_window_invalid')) {
    return new CollectorMcpError('resource_uri_invalid', status);
  }
  if (submission && status === 400) {
    return new CollectorMcpError('request_rejected', status, code);
  }
  if (submission && status === 409) {
    return new CollectorMcpError('submission_conflict', status, code);
  }
  return status >= 500
    ? new CollectorMcpError('core_unavailable', status, code)
    : new CollectorMcpError('core_response_invalid', status, code);
}

function requireUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) throw new CollectorMcpError('resource_uri_invalid');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new CollectorMcpError('core_response_invalid');
  return value;
}
