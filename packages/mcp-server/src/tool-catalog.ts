import { sha256Digest } from './canonical-json.js';
import {
  BINDING_ALIAS_JSON_PATTERN,
  SAFE_CODE_PATTERN
} from './constants.js';
import type {
  VerifiedCoreCompatibility,
  VerifiedDirectCapabilityContract
} from './compatibility.js';
import { CollectorMcpError } from './errors.js';

export const TOOL_CATALOG_VERSION = 'collector.mcp.tools/v1';

const TOOL_MAPPINGS = Object.freeze([
  tool('collector_bilibili_video_detail', 'bilibili.video_detail',
    'Collect Bilibili video detail',
    'Queue the registered Bilibili public video-detail capability for one canonical BV URL.'),
  tool('collector_bilibili_native_search', 'bilibili.native_search',
    'Search Bilibili',
    'Queue one bounded native Bilibili search for a human query.'),
  tool('collector_bilibili_native_search_batch', 'bilibili.native_search_batch',
    'Search multiple Bilibili result pages',
    'Queue the registered bounded multi-page native Bilibili search for a human query.'),
  tool('collector_bilibili_account_profile', 'bilibili.account_profile',
    'Collect a Bilibili account profile',
    'Queue collection of one public Bilibili account profile.'),
  tool('collector_bilibili_account_inventory', 'bilibili.account_inventory',
    'Collect a Bilibili account video inventory',
    'Queue collection of the public video inventory for one Bilibili account.'),
  tool('collector_bilibili_dynamic', 'bilibili.dynamic',
    'Collect Bilibili account dynamics',
    'Queue the registered bounded public dynamic-feed capability for one Bilibili account.'),
  tool('collector_bilibili_collection_series_overview', 'bilibili.collection_series.overview',
    'Collect Bilibili series overview',
    'Queue discovery of public series and seasons for one Bilibili account.'),
  tool('collector_bilibili_collection_series_detail', 'bilibili.collection_series.detail',
    'Collect Bilibili series detail',
    'Queue detail collection for one stable public Bilibili series or season discovered by the overview capability.'),
  tool('collector_bilibili_danmaku', 'bilibili.danmaku',
    'Collect Bilibili danmaku',
    'Queue the registered public danmaku capability for one canonical BV URL.'),
  tool('collector_bilibili_discussion', 'bilibili.discussion',
    'Collect Bilibili discussion',
    'Queue the registered bounded public discussion capability for one canonical BV URL.'),
  tool('collector_xiaohongshu_public_notes_search', 'xiaohongshu.search.public_notes.v1',
    'Search public Xiaohongshu notes',
    'Queue one trusted in-page public-note search using an already-open public Xiaohongshu context; Core handles context admission and bounded detail or discussion depth.'),
  tool('collector_xiaohongshu_account_public_notes', 'xiaohongshu.account.public_notes.v1',
    'Collect public Xiaohongshu account notes',
    'Queue bounded public-note inventory collection from an admitted Xiaohongshu account context.'),
  tool('collector_xiaohongshu_note_public_detail', 'xiaohongshu.note.public_detail.v1',
    'Collect Xiaohongshu public note detail',
    'Queue detail collection for one visible ranked note in an existing public search or profile page.'),
  tool('collector_xiaohongshu_note_public_comments', 'xiaohongshu.note.public_comments.v1',
    'Collect Xiaohongshu public note comments',
    'Queue bounded public comment collection from the already-open same-document note overlay.'),
  tool('collector_xiaohongshu_note_public_comment_replies', 'xiaohongshu.note.public_comment_replies.v1',
    'Collect Xiaohongshu public comment replies',
    'Queue bounded public reply-thread collection from the already-open same-document note overlay.'),
  tool('collector_zhihu_search_public_content', 'zhihu.search.public_content.v1',
    'Search public Zhihu content',
    'Submit one bounded public-content search through the registered Zhihu official provider. Requires live runtimeState=ready; credential_required is a Gateway configuration condition.'),
  tool('collector_zhihu_hot_list_public_content', 'zhihu.hot_list.public_content.v1',
    'Read the public Zhihu hot list',
    'Submit one bounded hot-list read through the registered Zhihu official provider. Requires live runtimeState=ready; credential_required is a Gateway configuration condition.'),
  tool('collector_web_search_global_zhihu_provider', 'web.search.global.zhihu_provider.v1',
    'Search the public web through the Zhihu provider',
    'Submit one bounded global public-web search through the registered Zhihu official provider. Requires live runtimeState=ready; credential_required is a Gateway configuration condition.')
]);

export interface CollectorToolDefinition {
  toolId: string;
  capabilityId: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  inputSchemaDigest: string;
  outputSchema: Record<string, unknown>;
  contract: VerifiedDirectCapabilityContract;
}

export function collectorToolMappings(): ReadonlyArray<{
  toolId: string;
  capabilityId: string;
  title: string;
  description: string;
}> {
  return structuredClone(TOOL_MAPPINGS);
}

export function buildCollectorToolCatalog(
  compatibility: VerifiedCoreCompatibility
): CollectorToolDefinition[] {
  const contracts = new Map(
    compatibility.directContracts.map((contract) => [contract.capabilityId, contract])
  );
  requireValue(contracts.size === TOOL_MAPPINGS.length);
  requireValue(compatibility.directCapabilityIds.length === TOOL_MAPPINGS.length);
  requireValue(TOOL_MAPPINGS.every((mapping) => contracts.has(mapping.capabilityId)));
  requireValue(compatibility.directCapabilityIds.every((capabilityId) =>
    TOOL_MAPPINGS.some((mapping) => mapping.capabilityId === capabilityId)));

  const toolIds = TOOL_MAPPINGS.map((mapping) => mapping.toolId);
  requireValue(new Set(toolIds).size === toolIds.length);
  requireValue(toolIds.every((toolId) => SAFE_CODE_PATTERN.test(toolId)));

  return TOOL_MAPPINGS.map((mapping) => {
    const contract = contracts.get(mapping.capabilityId)!;
    const inputSchema = deriveToolInputSchema(contract);
    return {
      ...mapping,
      inputSchema,
      inputSchemaDigest: sha256Digest(inputSchema),
      outputSchema: toolOutputSchema(mapping.capabilityId),
      contract
    };
  });
}

export function deriveToolInputSchema(
  contract: VerifiedDirectCapabilityContract
): Record<string, unknown> {
  const envelope = contract.requestSchema;
  const envelopeProperties = record(envelope.properties);
  const capabilityInput = record(envelopeProperties.input);
  const inputProperties = record(capabilityInput.properties);
  const reserved = new Set(['bindingAlias', 'clientRequestId', 'executionTarget']);
  requireValue(Object.keys(inputProperties).every((field) => !reserved.has(field)));

  const properties: Record<string, unknown> = {
    ...(contract.executionProvider === 'browser_extension'
      ? {
          bindingAlias: {
            type: 'string',
            pattern: BINDING_ALIAS_JSON_PATTERN,
            description: 'Optional session-local alias from collector://bindings. Omit it when the session has one online binding; never a browser or extension ID.'
          }
        }
      : {}),
    clientRequestId: structuredClone(record(envelopeProperties.clientRequestId))
  };
  if (contract.executionTargetMode === 'enum') {
    properties.executionTarget = structuredClone(record(envelopeProperties.executionTarget));
  }
  for (const [field, schema] of Object.entries(inputProperties)) {
    properties[field] = structuredClone(schema);
  }

  const required = [
    'clientRequestId',
    ...(contract.executionTargetMode === 'enum' ? ['executionTarget'] : []),
    ...requiredStrings(capabilityInput.required)
  ];
  const result: Record<string, unknown> = {
    type: 'object',
    additionalProperties: false,
    ...(typeof envelope.description === 'string' ? { description: envelope.description } : {}),
    required,
    properties
  };

  if (envelope.allOf !== undefined) {
    result.allOf = array(envelope.allOf).map(transformEnvelopeConditional);
  }
  return result;
}

function transformEnvelopeConditional(value: unknown): Record<string, unknown> {
  const conditional = record(value);
  requireValue(Object.keys(conditional).every((key) => key === 'if' || key === 'then'));
  const ifSchema = record(conditional.if);
  const thenSchema = record(conditional.then);
  const thenProperties = record(thenSchema.properties);
  requireValue(Object.keys(thenSchema).length === 1 && Object.keys(thenProperties).length === 1);
  const inputConstraint = record(thenProperties.input);
  return {
    if: structuredClone(ifSchema),
    then: structuredClone(inputConstraint)
  };
}

function toolOutputSchema(capabilityId: string): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'accepted', 'clientRequestId', 'idempotentReplay', 'operationId', 'capabilityId',
      'coreState', 'operationResourceUri'
    ],
    properties: {
      accepted: { type: 'boolean', const: true },
      clientRequestId: { type: 'string', format: 'uuid' },
      idempotentReplay: { type: 'boolean' },
      operationId: { type: 'string', format: 'uuid' },
      capabilityId: { type: 'string', const: capabilityId },
      coreState: {
        type: 'string',
        enum: ['queued', 'claimed', 'completed', 'partial', 'stopped', 'failed']
      },
      operationResourceUri: {
        type: 'string',
        pattern: '^collector://operations/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      }
    }
  };
}

function tool(
  toolId: string,
  capabilityId: string,
  title: string,
  description: string
): { toolId: string; capabilityId: string; title: string; description: string } {
  return { toolId, capabilityId, title, description };
}

function requiredStrings(value: unknown): string[] {
  if (value === undefined) return [];
  return array(value).map((item) => {
    requireValue(typeof item === 'string' && item.length > 0);
    return item;
  });
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new CollectorMcpError('compatibility_unmet');
  return value;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CollectorMcpError('compatibility_unmet');
  }
  return value as Record<string, unknown>;
}

function requireValue(condition: boolean): asserts condition {
  if (!condition) throw new CollectorMcpError('compatibility_unmet');
}
