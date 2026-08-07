import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { UUID_PATTERN } from './constants.js';
import {
  liveCapabilityRuntimeState,
  verifyBindings,
  type VerifiedCoreCompatibility
} from './compatibility.js';
import type { CollectorCoreApi } from './core-client.js';
import { CollectorMcpError, stableErrorCode, toProtocolError } from './errors.js';
import type { SafeLogger } from './logger.js';
import { operationResourceUri } from './resource-uri.js';
import type { BindingAliasRegistry } from './resources.js';
import {
  buildCollectorToolCatalog,
  TOOL_CATALOG_VERSION,
  type CollectorToolDefinition
} from './tool-catalog.js';

export interface CollectorToolSubmissionResult {
  accepted: true;
  clientRequestId: string;
  idempotentReplay: boolean;
  operationId: string;
  capabilityId: string;
  coreState: 'queued' | 'claimed' | 'completed' | 'partial' | 'stopped' | 'failed';
  operationResourceUri: string;
}

interface CompiledTool {
  definition: CollectorToolDefinition;
  validate: ValidateFunction;
  inputFields: string[];
}

export class CollectorToolService {
  readonly definitions: readonly CollectorToolDefinition[];
  readonly #core: CollectorCoreApi;
  readonly #aliases: BindingAliasRegistry;
  readonly #logger: SafeLogger;
  readonly #compatibility: VerifiedCoreCompatibility;
  readonly #compiled = new Map<string, CompiledTool>();

  constructor(input: {
    core: CollectorCoreApi;
    compatibility: VerifiedCoreCompatibility;
    aliases: BindingAliasRegistry;
    logger: SafeLogger;
  }) {
    this.#core = input.core;
    this.#aliases = input.aliases;
    this.#logger = input.logger;
    this.#compatibility = input.compatibility;
    this.definitions = buildCollectorToolCatalog(input.compatibility);

    const ajv = new Ajv2020({
      allErrors: true,
      strictSchema: true,
      strictTypes: false,
      strictRequired: false,
      validateFormats: true
    });
    ajv.addFormat('uuid', { type: 'string', validate: (value: string) => UUID_PATTERN.test(value) });
    ajv.addFormat('uri', { type: 'string', validate: isUri });
    ajv.addFormat('date-time', {
      type: 'string',
      validate: (value: string) => Number.isFinite(Date.parse(value))
    });
    try {
      for (const definition of this.definitions) {
        const properties = record(definition.inputSchema.properties);
        const inputFields = Object.keys(properties).filter((field) =>
          field !== 'bindingAlias' && field !== 'clientRequestId' && field !== 'executionTarget');
        this.#compiled.set(definition.toolId, {
          definition,
          validate: ajv.compile(definition.inputSchema),
          inputFields
        });
      }
    } catch {
      throw new CollectorMcpError('compatibility_unmet');
    }
  }

  async submit(toolId: string, argumentsValue: unknown): Promise<CollectorToolSubmissionResult> {
    const startedAt = Date.now();
    const compiled = this.#compiled.get(toolId);
    if (compiled === undefined) throw new CollectorMcpError('tool_input_invalid');
    let bindingAlias: string | null = null;
    let clientRequestId: string | null = null;
    try {
      if (!compiled.validate(argumentsValue)) throw new CollectorMcpError('tool_input_invalid');
      const argumentsRecord = record(argumentsValue);
      clientRequestId = requiredUuid(argumentsRecord.clientRequestId);
      const contract = compiled.definition.contract;
      if (contract.executionProvider === 'official_api') {
        const runtimeState = liveCapabilityRuntimeState(
          this.#compatibility.catalog,
          await this.#core.readCapabilities(),
          contract.capabilityId
        );
        if (runtimeState === 'credential_required') {
          throw new CollectorMcpError(
            'official_provider_credential_required',
            null,
            'zhihu_official_api_credential_required'
          );
        }
        if (runtimeState !== 'ready') {
          // An Official Provider is only safe to submit when the live catalog
          // explicitly proves readiness. A missing/unknown readiness field is
          // a compatibility failure, never permission to send a Core POST.
          throw new CollectorMcpError('compatibility_unmet');
        }
      }
      let browserBindingId: string | null = null;
      if (contract.executionProvider === 'browser_extension') {
        // Refresh the safe projection at submission time. The MCP session can
        // outlive a browser reconnect, and an Agent should not need to poll
        // binding state merely to use the common single-online-session case.
        this.#aliases.project(verifyBindings(await this.#core.readBindings()));
        if (argumentsRecord.bindingAlias === undefined) {
          const selected = this.#aliases.resolveOnline();
          bindingAlias = selected.bindingAlias;
          browserBindingId = selected.browserBindingId;
        } else {
          bindingAlias = requiredString(argumentsRecord.bindingAlias);
          browserBindingId = this.#aliases.resolve(bindingAlias);
        }
      }
      const executionTarget = contract.executionTargetMode === 'fixed'
        ? contract.defaultExecutionTarget
        : requiredString(argumentsRecord.executionTarget);
      const capabilityInput: Record<string, unknown> = {};
      for (const field of compiled.inputFields) {
        if (Object.hasOwn(argumentsRecord, field)) capabilityInput[field] = argumentsRecord[field];
      }
      const request = {
        schemaVersion: this.#compatibility.serviceSchemaVersion,
        clientRequestId,
        ...(browserBindingId === null ? {} : { browserBindingId }),
        platform: contract.platform,
        capability: contract.capabilityId,
        executionTarget,
        input: capabilityInput
      };

      const submission = submissionProjection(
        await this.#core.submitCollection(request),
        {
          clientRequestId,
          browserBindingId,
          platform: contract.platform,
          capability: contract.capabilityId,
          executionTarget
        }
      );
      const result: CollectorToolSubmissionResult = {
        accepted: true,
        clientRequestId,
        idempotentReplay: submission.idempotentReplay,
        operationId: submission.operationId,
        capabilityId: contract.capabilityId,
        coreState: submission.coreState,
        operationResourceUri: operationResourceUri(submission.operationId)
      };
      this.#logger.record('info', 'collector.mcp.tool_submitted', {
        toolId,
        capabilityId: contract.capabilityId,
        bindingAlias,
        clientRequestId,
        coreOperationId: result.operationId,
        coreState: result.coreState,
        idempotentReplay: result.idempotentReplay,
        durationMs: Math.max(0, Date.now() - startedAt),
        outcome: 'completed'
      });
      return result;
    } catch (error) {
      this.#logger.record('warn', 'collector.mcp.tool_submission_failed', {
        toolId,
        capabilityId: compiled.definition.capabilityId,
        ...(bindingAlias === null ? {} : { bindingAlias }),
        ...(clientRequestId === null ? {} : { clientRequestId }),
        durationMs: Math.max(0, Date.now() - startedAt),
        outcome: 'failed',
        errorCode: stableErrorCode(error)
      });
      throw error;
    }
  }
}

export function registerCollectorTools(server: McpServer, tools: CollectorToolService): void {
  const definitions = new Map(tools.definitions.map((definition) => [definition.toolId, definition]));
  server.server.registerCapabilities({ tools: { listChanged: false } });
  server.server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.definitions.map((definition) => ({
      name: definition.toolId,
      title: definition.title,
      description: definition.description,
      inputSchema: definition.inputSchema,
      outputSchema: definition.outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      },
      _meta: {
        'collector/capabilityId': definition.capabilityId,
        'collector/inputSchemaDigest': definition.inputSchemaDigest,
        'collector/toolCatalogVersion': TOOL_CATALOG_VERSION
      }
    }))
  }));
  server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!definitions.has(request.params.name)) {
      throw new McpError(ErrorCode.InvalidParams, 'tool_not_found');
    }
    try {
      const result = await tools.submit(request.params.name, request.params.arguments);
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result
      };
    } catch (error) {
      throw toProtocolError(error);
    }
  });
}

function submissionProjection(
  value: unknown,
  expected: {
    clientRequestId: string;
    browserBindingId: string | null;
    platform: 'bilibili' | 'xiaohongshu' | 'zhihu' | 'web';
    capability: string;
    executionTarget: string;
  }
): {
  idempotentReplay: boolean;
  operationId: string;
  coreState: CollectorToolSubmissionResult['coreState'];
} {
  const response = submissionRecord(value);
  if (response.schemaVersion !== 3 || response.clientRequestId !== expected.clientRequestId ||
    typeof response.idempotentReplay !== 'boolean') {
    throw new CollectorMcpError('submission_outcome_unknown');
  }
  const operation = submissionRecord(response.result);
  if (operation.schemaVersion !== 1 || operation.browserBindingId !== expected.browserBindingId ||
    operation.platform !== expected.platform || operation.capability !== expected.capability ||
    operation.executionTarget !== expected.executionTarget) {
    throw new CollectorMcpError('submission_outcome_unknown');
  }
  const operationId = submissionUuid(operation.operationId);
  const coreState = operationState(operation.state);
  return { idempotentReplay: response.idempotentReplay, operationId, coreState };
}

function operationState(value: unknown): CollectorToolSubmissionResult['coreState'] {
  if (value !== 'queued' && value !== 'claimed' && value !== 'completed' && value !== 'partial' &&
    value !== 'stopped' && value !== 'failed') {
    throw new CollectorMcpError('submission_outcome_unknown');
  }
  return value;
}

function requiredUuid(value: unknown): string {
  const result = requiredString(value);
  if (!UUID_PATTERN.test(result)) throw new CollectorMcpError('core_response_invalid');
  return result;
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new CollectorMcpError('core_response_invalid');
  }
  return value;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CollectorMcpError('core_response_invalid');
  }
  return value as Record<string, unknown>;
}

function submissionRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CollectorMcpError('submission_outcome_unknown');
  }
  return value as Record<string, unknown>;
}

function submissionUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new CollectorMcpError('submission_outcome_unknown');
  }
  return value;
}

function isUri(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
