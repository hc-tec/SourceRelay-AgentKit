import { randomUUID } from 'node:crypto';
import { REQUIRED_CORE_FEATURES } from '../../src/constants.js';
import { sha256Digest } from '../../src/canonical-json.js';
import type { CollectorCoreCompatibilityPolicy } from '../../src/compatibility.js';

export const DIRECT_CAPABILITY_IDS = [
  'bilibili.video_detail',
  'bilibili.native_search',
  'bilibili.native_search_batch',
  'bilibili.account_profile',
  'bilibili.account_inventory',
  'bilibili.dynamic',
  'bilibili.collection_series.overview',
  'bilibili.collection_series.detail',
  'bilibili.danmaku',
  'bilibili.discussion',
  'xiaohongshu.search.public_notes.v1',
  'xiaohongshu.account.public_notes.v1',
  'xiaohongshu.note.public_detail.v1',
  'xiaohongshu.note.public_comments.v1',
  'xiaohongshu.note.public_comment_replies.v1',
  'zhihu.search.public_content.v1',
  'zhihu.hot_list.public_content.v1',
  'web.search.global.zhihu_provider.v1'
];

export function coreContractFixture() {
  const schemas: Record<string, unknown> = {};
  const capabilities: Array<Record<string, unknown>> = [];
  const directContracts: Array<Record<string, unknown>> = [];
  DIRECT_CAPABILITY_IDS.forEach((capability, index) => {
    const schemaName = `Request${index + 1}`;
    const targets = executionTargets(capability);
    const schema = requestSchema(capability, targets);
    schemas[schemaName] = schema;
    capabilities.push({
      capability,
      dispatchState: 'direct_ready',
      ...(isOfficialCapability(capability)
        ? { runtimeState: 'ready', credentialLocation: 'gateway_only', browserBindingRequired: false }
        : {})
    });
    directContracts.push({
      capability,
      executionProvider: isOfficialCapability(capability) ? 'official_api' : 'browser_extension',
      requestSchemaRef: `#/components/schemas/${schemaName}`,
      requestSchemaDigest: sha256Digest(schema),
      executionTargets: targets,
      defaultExecutionTarget: targets[0],
      executionTargetMode: targets.length === 1 ? 'fixed' : 'enum',
      budgetPolicy: isOfficialCapability(capability)
        ? 'official_api_fixed_count'
        : capability === 'bilibili.account_inventory'
        ? 'fixed_observation_budget'
        : capability.endsWith('public_comments.v1') || capability.endsWith('public_comment_replies.v1')
          ? 'input_bounded_queue_budget'
          : 'fixed_queue_budget'
    });
  });
  capabilities.push(
    { capability: 'bilibili.transcript', dispatchState: 'catalog_only' },
    { capability: 'xiaohongshu.current_page.network_metadata', dispatchState: 'migration_required' },
    { capability: 'xiaohongshu.note.public_media', dispatchState: 'migration_required' }
  );
  const stableCapabilities = capabilities.map(({ runtimeState: _runtimeState, ...stable }) => stable);
  const catalog = {
    schemaVersion: 3,
    catalogDigest: sha256Digest({ capabilities: stableCapabilities, directContracts }),
    capabilities,
    directContracts
  };
  const openApiWithoutServers = {
    openapi: '3.1.0',
    info: { title: 'Collector Core', version: '3.0.0-experimental' },
    paths: {},
    components: { schemas }
  };
  const openApi = {
    ...openApiWithoutServers,
    servers: [{ url: 'http://127.0.0.1:43127' }]
  };
  const release = {
    schemaVersion: 1,
    releaseVersion: '0.7.17',
    product: 'collector-core',
    service: { schemaVersion: 3, openApiVersion: '3.0.0-experimental' },
    compatibility: {
      schemaVersion: 1,
      digestAlgorithm: 'sha256-canonical-json-v1',
      openApiSchemaDigest: sha256Digest(openApiWithoutServers),
      capabilityCatalogDigest: catalog.catalogDigest,
      features: [...REQUIRED_CORE_FEATURES]
    }
  };
  const bindings = {
    schemaVersion: 3,
    bindings: [
      {
        schemaVersion: 1,
        browserBindingId: randomUUID(),
        extensionId: 'a'.repeat(32),
        state: 'online',
        pairedAt: '2026-08-03T00:00:00.000Z',
        lastSeenAt: '2026-08-03T00:00:01.000Z'
      }
    ]
  };
  return { release, catalog, openApi, bindings };
}

export function fixtureCompatibilityPolicy(
  fixture: ReturnType<typeof coreContractFixture>
): CollectorCoreCompatibilityPolicy {
  return {
    releaseVersion: '0.7.17',
    serviceSchemaVersion: 3,
    openApiVersion: '3.0.0-experimental',
    openApiDigest: fixture.release.compatibility.openApiSchemaDigest,
    catalogDigest: fixture.catalog.catalogDigest,
    requiredFeatures: REQUIRED_CORE_FEATURES,
    directCapabilityCount: 18
  };
}

function requestSchema(capability: string, targets: string[]): Record<string, unknown> {
  const platform = capability.startsWith('bilibili.')
    ? 'bilibili'
    : capability.startsWith('xiaohongshu.')
      ? 'xiaohongshu'
      : capability.startsWith('zhihu.') ? 'zhihu' : 'web';
  const browserProvider = !isOfficialCapability(capability);
  const envelopeFields = [
    'schemaVersion', 'clientRequestId',
    ...(browserProvider ? ['browserBindingId'] : []),
    'platform', 'capability', 'executionTarget', 'input'
  ];
  const schema: Record<string, unknown> = {
    type: 'object',
    additionalProperties: false,
    required: envelopeFields,
    properties: {
      schemaVersion: { type: 'integer', const: 3 },
      clientRequestId: { type: 'string', format: 'uuid' },
      ...(browserProvider ? { browserBindingId: { type: 'string', format: 'uuid' } } : {}),
      platform: { type: 'string', const: platform },
      capability: { type: 'string', const: capability },
      executionTarget: targets.length === 1
        ? { type: 'string', const: targets[0] }
        : { type: 'string', enum: targets },
      input: capabilityInputSchema(capability)
    }
  };
  if (capability === 'xiaohongshu.account.public_notes.v1') {
    schema.allOf = [
      {
        if: { required: ['executionTarget'], properties: { executionTarget: { const: 'existing_public_profile_tab' } } },
        then: {
          properties: {
            input: {
              properties: { maximumScrolls: { type: 'integer', enum: [1, 2, 3] } },
              not: { required: ['profileUrl'] }
            }
          }
        }
      },
      {
        if: { required: ['executionTarget'], properties: { executionTarget: { const: 'ephemeral_public_profile_url' } } },
        then: { properties: { input: { required: ['maximumScrolls', 'profileUrl'] } } }
      },
      {
        if: { required: ['executionTarget'], properties: { executionTarget: { const: 'discover_public_profile_from_note' } } },
        then: { properties: { input: { not: { required: ['profileUrl'] } } } }
      }
    ];
  }
  return schema;
}

function capabilityInputSchema(capability: string): Record<string, unknown> {
  const object = (required: string[], properties: Record<string, unknown>) => ({
    type: 'object', additionalProperties: false, required, properties
  });
  if (capability === 'bilibili.native_search' || capability === 'bilibili.native_search_batch') {
    return object(['query'], { query: { type: 'string', minLength: 1, maxLength: 160 } });
  }
  if (capability === 'bilibili.collection_series.detail') {
    return object(['canonicalProfileUrl', 'stableSeriesId', 'listType'], {
      canonicalProfileUrl: { type: 'string', format: 'uri' },
      stableSeriesId: { type: 'string', pattern: '^[1-9]\\d{0,19}$' },
      listType: { type: 'string', enum: ['series', 'season'] }
    });
  }
  if (capability === 'xiaohongshu.search.public_notes.v1') {
    return object(['query'], {
      query: { type: 'string', minLength: 1, maxLength: 80 },
      maximumDetails: { type: 'integer', minimum: 0, maximum: 20 },
      comments: object(['maximumScrolls'], {
        maximumScrolls: { type: 'integer', enum: [1, 2, 3] },
        replies: object(['maximumThreads'], {
          maximumThreads: { type: 'integer', enum: [1, 2, 3] }
        })
      })
    });
  }
  if (capability === 'xiaohongshu.account.public_notes.v1') {
    return object(['maximumScrolls'], {
      maximumScrolls: { type: 'integer', enum: Array.from({ length: 20 }, (_, index) => index + 1) },
      profileUrl: { type: 'string', minLength: 1, maxLength: 4096, format: 'uri' }
    });
  }
  if (capability === 'xiaohongshu.note.public_detail.v1') {
    return object(['resultRank'], { resultRank: { type: 'integer', minimum: 1, maximum: 20 } });
  }
  if (capability === 'xiaohongshu.note.public_comments.v1') {
    return object(['maximumScrolls'], { maximumScrolls: { type: 'integer', enum: [1, 2, 3] } });
  }
  if (capability === 'xiaohongshu.note.public_comment_replies.v1') {
    return object(['maximumThreads'], { maximumThreads: { type: 'integer', enum: [1, 2, 3] } });
  }
  if (capability === 'zhihu.search.public_content.v1') {
    return object(['query'], {
      query: { type: 'string', minLength: 1, maxLength: 100 },
      count: { type: 'integer', minimum: 1, maximum: 10, default: 10 }
    });
  }
  if (capability === 'zhihu.hot_list.public_content.v1') {
    return {
      type: 'object', additionalProperties: false,
      properties: { limit: { type: 'integer', minimum: 1, maximum: 30, default: 30 } }
    };
  }
  if (capability === 'web.search.global.zhihu_provider.v1') {
    return object(['query'], {
      query: { type: 'string', minLength: 1, maxLength: 100 },
      count: { type: 'integer', minimum: 1, maximum: 20, default: 10 },
      searchDatabase: { type: 'string', enum: ['all', 'realtime', 'static'], default: 'all' },
      site: { type: 'string', minLength: 1, maxLength: 253, pattern: '^[A-Za-z0-9.-]+$' },
      publishedAfter: { type: 'string', format: 'date-time' }
    });
  }
  if (capability === 'bilibili.video_detail' || capability === 'bilibili.danmaku' ||
    capability === 'bilibili.discussion') {
    return object(['canonicalVideoUrl'], { canonicalVideoUrl: { type: 'string', format: 'uri' } });
  }
  return object(['canonicalProfileUrl'], {
    canonicalProfileUrl: { type: 'string', format: 'uri' }
  });
}

function executionTargets(capability: string): string[] {
  if (isOfficialCapability(capability)) return ['official_api'];
  if (capability === 'bilibili.account_inventory') {
    return ['collector_work_tab', 'user_selected_tab'];
  }
  if (capability === 'xiaohongshu.account.public_notes.v1') {
    return [
      'existing_public_profile_tab',
      'ephemeral_public_profile_url',
      'discover_public_profile_from_note'
    ];
  }
  if (capability === 'xiaohongshu.note.public_detail.v1') {
    return ['existing_public_search_tab', 'existing_public_profile_tab'];
  }
  if (capability === 'xiaohongshu.search.public_notes.v1') return ['existing_public_explore_tab'];
  if (capability.startsWith('xiaohongshu.note.')) return ['existing_public_note_overlay'];
  return ['collector_work_tab'];
}

function isOfficialCapability(capability: string): boolean {
  return capability.startsWith('zhihu.') || capability === 'web.search.global.zhihu_provider.v1';
}
