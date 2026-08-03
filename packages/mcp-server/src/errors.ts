import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { SAFE_CODE_PATTERN } from './constants.js';

export type CollectorMcpErrorCode =
  | 'artifact_read_out_of_bounds'
  | 'authentication_failed'
  | 'compatibility_unmet'
  | 'core_response_invalid'
  | 'core_response_too_large'
  | 'core_unavailable'
  | 'permission_denied'
  | 'resource_not_found'
  | 'resource_uri_invalid';

export class CollectorMcpError extends Error {
  readonly code: CollectorMcpErrorCode;
  readonly status: number | null;

  constructor(code: CollectorMcpErrorCode, status: number | null = null) {
    super(code);
    this.name = 'CollectorMcpError';
    this.code = code;
    this.status = status;
  }
}

export function stableErrorCode(error: unknown): CollectorMcpErrorCode {
  if (error instanceof CollectorMcpError) return error.code;
  return 'core_unavailable';
}

export function toProtocolError(error: unknown): McpError {
  const code = stableErrorCode(error);
  const protocolCode = code === 'resource_uri_invalid' || code === 'resource_not_found' ||
    code === 'artifact_read_out_of_bounds'
    ? ErrorCode.InvalidParams
    : ErrorCode.InternalError;
  return new McpError(protocolCode, code);
}

export function safeCoreErrorCode(value: unknown): string | null {
  return typeof value === 'string' && SAFE_CODE_PATTERN.test(value) ? value : null;
}
