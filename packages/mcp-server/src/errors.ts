import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { SAFE_CODE_PATTERN, TOKEN_PATTERN } from './constants.js';

export type CollectorMcpErrorCode =
  | 'artifact_read_out_of_bounds'
  | 'authentication_failed'
  | 'binding_alias_not_found'
  | 'binding_selection_required'
  | 'binding_unavailable'
  | 'compatibility_unmet'
  | 'core_response_invalid'
  | 'core_response_too_large'
  | 'core_unavailable'
  | 'official_provider_credential_required'
  | 'permission_denied'
  | 'request_rejected'
  | 'resource_not_found'
  | 'resource_uri_invalid'
  | 'submission_conflict'
  | 'submission_outcome_unknown'
  | 'tool_input_invalid';

export class CollectorMcpError extends Error {
  readonly code: CollectorMcpErrorCode;
  readonly status: number | null;
  readonly coreErrorCode: string | null;

  constructor(
    code: CollectorMcpErrorCode,
    status: number | null = null,
    coreErrorCode: string | null = null
  ) {
    super(code);
    this.name = 'CollectorMcpError';
    this.code = code;
    this.status = status;
    this.coreErrorCode = safeCoreErrorCode(coreErrorCode);
  }
}

export function stableErrorCode(error: unknown): CollectorMcpErrorCode {
  if (error instanceof CollectorMcpError) return error.code;
  return 'core_unavailable';
}

export function toProtocolError(error: unknown): McpError {
  const code = stableErrorCode(error);
  const protocolCode = code === 'resource_uri_invalid' || code === 'resource_not_found' ||
    code === 'artifact_read_out_of_bounds' || code === 'binding_alias_not_found' ||
    code === 'binding_selection_required' || code === 'binding_unavailable' ||
    code === 'tool_input_invalid'
    ? ErrorCode.InvalidParams
    : ErrorCode.InternalError;
  const coreErrorCode = error instanceof CollectorMcpError ? error.coreErrorCode : null;
  return new McpError(
    protocolCode,
    code,
    coreErrorCode === null ? undefined : { coreErrorCode }
  );
}

export function safeCoreErrorCode(value: unknown): string | null {
  return typeof value === 'string' && SAFE_CODE_PATTERN.test(value) && !TOKEN_PATTERN.test(value) &&
    !/^(?:sk[-_]|cst_)/i.test(value)
    ? value
    : null;
}
