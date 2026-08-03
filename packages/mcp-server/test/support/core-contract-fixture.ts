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
  'xiaohongshu.note.public_comment_replies.v1'
];

export function coreContractFixture() {
  const schemas: Record<string, unknown> = {};
  const capabilities: Array<Record<string, unknown>> = [];
  const directContracts: Array<Record<string, unknown>> = [];
  DIRECT_CAPABILITY_IDS.forEach((capability, index) => {
    const schemaName = `Request${index + 1}`;
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['schemaVersion', 'clientRequestId'],
      properties: {
        schemaVersion: { type: 'integer', const: 3 },
        clientRequestId: { type: 'string', format: 'uuid' }
      }
    };
    schemas[schemaName] = schema;
    capabilities.push({ capability, dispatchState: 'direct_ready' });
    directContracts.push({
      capability,
      requestSchemaRef: `#/components/schemas/${schemaName}`,
      requestSchemaDigest: sha256Digest(schema),
      executionTargets: ['collector_work_tab'],
      defaultExecutionTarget: 'collector_work_tab',
      executionTargetMode: 'fixed',
      budgetPolicy: 'fixed_queue_budget'
    });
  });
  capabilities.push(
    { capability: 'bilibili.transcript', dispatchState: 'catalog_only' },
    { capability: 'xiaohongshu.current_page.network_metadata', dispatchState: 'migration_required' },
    { capability: 'xiaohongshu.note.public_media', dispatchState: 'migration_required' }
  );
  const catalog = {
    schemaVersion: 3,
    catalogDigest: sha256Digest({ capabilities, directContracts }),
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
    directCapabilityCount: 15
  };
}
