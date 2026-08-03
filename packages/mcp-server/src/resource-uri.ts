import { RESOURCE_URIS, UUID_PATTERN } from './constants.js';
import { CollectorMcpError } from './errors.js';

export type CollectorResourceAddress =
  | { kind: 'release'; uri: typeof RESOURCE_URIS.release }
  | { kind: 'capabilities'; uri: typeof RESOURCE_URIS.capabilities }
  | { kind: 'bindings'; uri: typeof RESOURCE_URIS.bindings }
  | { kind: 'operation'; uri: string; operationId: string }
  | { kind: 'artifact_metadata'; uri: string; artifactId: string }
  | { kind: 'artifact_chunk'; uri: string; artifactId: string; cursor: number };

export function parseCollectorResourceUri(value: string): CollectorResourceAddress {
  if (value === RESOURCE_URIS.release) return { kind: 'release', uri: value };
  if (value === RESOURCE_URIS.capabilities) return { kind: 'capabilities', uri: value };
  if (value === RESOURCE_URIS.bindings) return { kind: 'bindings', uri: value };

  const operation = /^collector:\/\/operations\/([^/]+)$/.exec(value);
  if (operation && UUID_PATTERN.test(operation[1]!)) {
    return { kind: 'operation', uri: value, operationId: operation[1]! };
  }
  const artifact = /^collector:\/\/artifacts\/([^/]+)$/.exec(value);
  if (artifact && UUID_PATTERN.test(artifact[1]!)) {
    return { kind: 'artifact_metadata', uri: value, artifactId: artifact[1]! };
  }
  const chunk = /^collector:\/\/artifacts\/([^/]+)\/chunks\/(0|[1-9]\d*)$/.exec(value);
  if (chunk && UUID_PATTERN.test(chunk[1]!)) {
    const cursor = Number(chunk[2]);
    if (Number.isSafeInteger(cursor)) {
      return { kind: 'artifact_chunk', uri: value, artifactId: chunk[1]!, cursor };
    }
  }
  throw new CollectorMcpError('resource_uri_invalid');
}

export function operationResourceUri(operationId: string): string {
  if (!UUID_PATTERN.test(operationId)) throw new CollectorMcpError('resource_uri_invalid');
  return `collector://operations/${operationId}`;
}

export function artifactResourceUri(artifactId: string): string {
  if (!UUID_PATTERN.test(artifactId)) throw new CollectorMcpError('resource_uri_invalid');
  return `collector://artifacts/${artifactId}`;
}

export function artifactChunkResourceUri(artifactId: string, cursor: number): string {
  if (!UUID_PATTERN.test(artifactId) || !Number.isSafeInteger(cursor) || cursor < 0) {
    throw new CollectorMcpError('resource_uri_invalid');
  }
  return `collector://artifacts/${artifactId}/chunks/${cursor}`;
}
