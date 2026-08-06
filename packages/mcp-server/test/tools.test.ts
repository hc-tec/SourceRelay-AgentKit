import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyCollectorCoreCompatibility } from '../src/compatibility.js';
import { CollectorMcpError } from '../src/errors.js';
import { SafeLogger } from '../src/logger.js';
import { BindingAliasRegistry } from '../src/resources.js';
import {
  buildCollectorToolCatalog,
  collectorToolMappings,
  TOOL_CATALOG_VERSION
} from '../src/tool-catalog.js';
import { CollectorToolService } from '../src/tools.js';
import { StubCoreReader, OPERATION_ID } from './support/stub-core-reader.js';
import {
  DIRECT_CAPABILITY_IDS,
  fixtureCompatibilityPolicy
} from './support/core-contract-fixture.js';

const CLIENT_REQUEST_ID = '44444444-4444-4444-8444-444444444444';
const VIDEO_URL = 'https://www.bilibili.com/video/BV1qZSLBYEpa';

test('Tool catalog has exact Core parity and mechanically flattened schemas', () => {
  const { compatibility } = setup();
  const catalog = buildCollectorToolCatalog(compatibility);
  assert.equal(TOOL_CATALOG_VERSION, 'collector.mcp.tools/v1');
  assert.equal(catalog.length, 18);
  assert.deepEqual(
    new Set(catalog.map((definition) => definition.capabilityId)),
    new Set(DIRECT_CAPABILITY_IDS)
  );
  assert.deepEqual(
    catalog.map((definition) => definition.toolId),
    collectorToolMappings().map((mapping) => mapping.toolId)
  );
  assert.equal(catalog.every((definition) =>
    /^sha256:[a-f0-9]{64}$/.test(definition.inputSchemaDigest)), true);

  const fixed = catalog.find((definition) => definition.capabilityId === 'bilibili.video_detail')!;
  const fixedProperties = fixed.inputSchema.properties as Record<string, unknown>;
  assert.deepEqual(Object.keys(fixedProperties), [
    'bindingAlias', 'clientRequestId', 'canonicalVideoUrl'
  ]);
  assert.deepEqual(fixed.inputSchema.required, [
    'clientRequestId', 'canonicalVideoUrl'
  ]);
  assert.equal(fixed.inputSchema.additionalProperties, false);
  for (const hidden of [
    'schemaVersion', 'browserBindingId', 'platform', 'capability', 'executionTarget', 'input'
  ]) {
    assert.equal(Object.hasOwn(fixedProperties, hidden), false);
  }

  const selectable = catalog.find((definition) =>
    definition.capabilityId === 'bilibili.account_inventory')!;
  const selectableProperties = selectable.inputSchema.properties as Record<string, unknown>;
  assert.deepEqual(
    (selectableProperties.executionTarget as Record<string, unknown>).enum,
    ['collector_work_tab', 'user_selected_tab']
  );
  assert.ok((selectable.inputSchema.required as string[]).includes('executionTarget'));

  const conditional = catalog.find((definition) =>
    definition.capabilityId === 'xiaohongshu.account.public_notes.v1')!;
  assert.equal(Array.isArray(conditional.inputSchema.allOf), true);
  const firstThen = ((conditional.inputSchema.allOf as Array<Record<string, unknown>>)[0]!
    .then as Record<string, unknown>);
  assert.equal(Object.hasOwn(firstThen, 'properties'), true);
  assert.equal(Object.hasOwn(
    firstThen.properties as Record<string, unknown>,
    'maximumScrolls'
  ), true);
  assert.equal(Object.hasOwn(firstThen.properties as Record<string, unknown>, 'input'), false);

  const official = catalog.find((definition) =>
    definition.capabilityId === 'zhihu.search.public_content.v1')!;
  const officialProperties = official.inputSchema.properties as Record<string, unknown>;
  assert.deepEqual(Object.keys(officialProperties), ['clientRequestId', 'query', 'count']);
  assert.deepEqual(official.inputSchema.required, ['clientRequestId', 'query']);
  assert.equal(Object.hasOwn(officialProperties, 'bindingAlias'), false);
  assert.equal(Object.hasOwn(officialProperties, 'executionTarget'), false);
});

test('fixed-target Tool resolves a safe alias, submits once, and returns only Operation identity', async () => {
  const { core, service, logs } = setup();
  const result = await service.submit('collector_bilibili_video_detail', {
    bindingAlias: 'binding-1',
    clientRequestId: CLIENT_REQUEST_ID,
    canonicalVideoUrl: VIDEO_URL
  });
  assert.deepEqual(result, {
    accepted: true,
    clientRequestId: CLIENT_REQUEST_ID,
    idempotentReplay: false,
    operationId: OPERATION_ID,
    capabilityId: 'bilibili.video_detail',
    coreState: 'queued',
    operationResourceUri: `collector://operations/${OPERATION_ID}`
  });
  assert.equal(core.submissions.length, 1);
  assert.deepEqual(core.submissions[0], {
    schemaVersion: 3,
    clientRequestId: CLIENT_REQUEST_ID,
    browserBindingId: core.fixture.bindings.bindings[0]!.browserBindingId,
    platform: 'bilibili',
    capability: 'bilibili.video_detail',
    executionTarget: 'collector_work_tab',
    input: { canonicalVideoUrl: VIDEO_URL }
  });
  const logText = logs.join('');
  assert.ok(logText.includes('collector.mcp.tool_submitted'));
  assert.ok(logText.includes(OPERATION_ID));
  assert.ok(!logText.includes(VIDEO_URL));
  assert.ok(!logText.includes(core.fixture.bindings.bindings[0]!.browserBindingId));
});

test('fixed-target Tool auto-selects the only online binding when alias is omitted', async () => {
  const { core, service } = setup();
  const result = await service.submit('collector_bilibili_video_detail', {
    clientRequestId: CLIENT_REQUEST_ID,
    canonicalVideoUrl: VIDEO_URL
  });
  assert.equal(result.accepted, true);
  assert.equal(core.submissions.length, 1);
  assert.equal(core.submissions[0]!.browserBindingId, core.fixture.bindings.bindings[0]!.browserBindingId);
});

test('automatic binding selection fails closed when there is no unique online session', async () => {
  const unavailable = setup();
  unavailable.core.fixture.bindings.bindings[0]!.state = 'paired';
  await assert.rejects(
    unavailable.service.submit('collector_bilibili_video_detail', {
      clientRequestId: CLIENT_REQUEST_ID,
      canonicalVideoUrl: VIDEO_URL
    }),
    (error: unknown) => error instanceof CollectorMcpError && error.code === 'binding_unavailable'
  );
  assert.equal(unavailable.core.submissions.length, 0);

  const ambiguous = setup();
  ambiguous.core.fixture.bindings.bindings.push({
    ...ambiguous.core.fixture.bindings.bindings[0]!,
    browserBindingId: '33333333-3333-4333-8333-333333333333',
    extensionId: 'b'.repeat(32)
  });
  await assert.rejects(
    ambiguous.service.submit('collector_bilibili_video_detail', {
      clientRequestId: CLIENT_REQUEST_ID,
      canonicalVideoUrl: VIDEO_URL
    }),
    (error: unknown) => error instanceof CollectorMcpError && error.code === 'binding_selection_required'
  );
  assert.equal(ambiguous.core.submissions.length, 0);
});

test('all 18 Tool contracts accept representative typed input and submit their exact capability', async () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ['collector_bilibili_video_detail', { canonicalVideoUrl: VIDEO_URL }],
    ['collector_bilibili_native_search', { query: '公开情报' }],
    ['collector_bilibili_native_search_batch', { query: '人工智能' }],
    ['collector_bilibili_account_profile', { canonicalProfileUrl: 'https://space.bilibili.com/7481602' }],
    ['collector_bilibili_account_inventory', {
      executionTarget: 'collector_work_tab', canonicalProfileUrl: 'https://space.bilibili.com/7481602'
    }],
    ['collector_bilibili_dynamic', { canonicalProfileUrl: 'https://space.bilibili.com/7481602' }],
    ['collector_bilibili_collection_series_overview', {
      canonicalProfileUrl: 'https://space.bilibili.com/7481602'
    }],
    ['collector_bilibili_collection_series_detail', {
      canonicalProfileUrl: 'https://space.bilibili.com/7481602', stableSeriesId: '123', listType: 'series'
    }],
    ['collector_bilibili_danmaku', { canonicalVideoUrl: VIDEO_URL }],
    ['collector_bilibili_discussion', { canonicalVideoUrl: VIDEO_URL }],
    ['collector_xiaohongshu_public_notes_search', {
      query: '机器人', maximumDetails: 2,
      comments: { maximumScrolls: 1, replies: { maximumThreads: 1 } }
    }],
    ['collector_xiaohongshu_account_public_notes', {
      executionTarget: 'existing_public_profile_tab', maximumScrolls: 2
    }],
    ['collector_xiaohongshu_note_public_detail', {
      executionTarget: 'existing_public_search_tab', resultRank: 1
    }],
    ['collector_xiaohongshu_note_public_comments', { maximumScrolls: 2 }],
    ['collector_xiaohongshu_note_public_comment_replies', { maximumThreads: 2 }],
    ['collector_zhihu_search_public_content', { query: '大模型', count: 8 }],
    ['collector_zhihu_hot_list_public_content', { limit: 20 }],
    ['collector_web_search_global_zhihu_provider', {
      query: '具身智能', count: 10, searchDatabase: 'all', site: 'example.com'
    }]
  ];
  const { core, service } = setup();
  const mapping = new Map(collectorToolMappings().map((entry) => [entry.toolId, entry.capabilityId]));
  for (let index = 0; index < cases.length; index += 1) {
    const [toolId, capabilityFields] = cases[index]!;
    const clientRequestId = `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
    const definition = service.definitions.find((entry) => entry.toolId === toolId)!;
    const result = await service.submit(toolId, {
      ...(definition.contract.executionProvider === 'browser_extension'
        ? { bindingAlias: 'binding-1' }
        : {}),
      clientRequestId,
      ...capabilityFields
    });
    assert.equal(result.capabilityId, mapping.get(toolId));
    assert.equal(result.clientRequestId, clientRequestId);
    assert.equal(core.submissions[index]!.capability, mapping.get(toolId));
  }
  assert.equal(core.submissions.length, 18);
});

test('Official Provider Tool omits browser identity and preserves a completed Operation', async () => {
  const { core, service, logs } = setup();
  const result = await service.submit('collector_zhihu_search_public_content', {
    clientRequestId: CLIENT_REQUEST_ID,
    query: '公开数据',
    count: 6
  });
  assert.deepEqual(core.submissions, [{
    schemaVersion: 3,
    clientRequestId: CLIENT_REQUEST_ID,
    platform: 'zhihu',
    capability: 'zhihu.search.public_content.v1',
    executionTarget: 'official_api',
    input: { query: '公开数据', count: 6 }
  }]);
  assert.equal(result.coreState, 'completed');
  assert.equal(logs.join('').includes('bindingAlias'), false);
  assert.equal(logs.join('').includes('公开数据'), false);
});

test('enum-target Tool preserves only the admitted target and capability fields', async () => {
  const { core, service } = setup();
  const profileUrl = 'https://www.xiaohongshu.com/user/profile/public-author?xsec_token=short';
  await service.submit('collector_xiaohongshu_account_public_notes', {
    bindingAlias: 'binding-1',
    clientRequestId: CLIENT_REQUEST_ID,
    executionTarget: 'ephemeral_public_profile_url',
    maximumScrolls: 12,
    profileUrl
  });
  assert.equal(core.submissions.length, 1);
  assert.deepEqual(core.submissions[0]!.input, { maximumScrolls: 12, profileUrl });
  assert.equal(core.submissions[0]!.executionTarget, 'ephemeral_public_profile_url');
});

test('Tool schemas reject extra fields, hidden fixed targets and conditional violations before POST', async () => {
  const invalidCalls: Array<[string, Record<string, unknown>]> = [
    ['collector_bilibili_video_detail', {
      bindingAlias: 'binding-1', clientRequestId: CLIENT_REQUEST_ID,
      canonicalVideoUrl: VIDEO_URL, executionTarget: 'collector_work_tab'
    }],
    ['collector_bilibili_video_detail', {
      bindingAlias: 'binding-1', clientRequestId: CLIENT_REQUEST_ID,
      canonicalVideoUrl: VIDEO_URL, arbitrarySelector: '#unsafe'
    }],
    ['collector_xiaohongshu_account_public_notes', {
      bindingAlias: 'binding-1', clientRequestId: CLIENT_REQUEST_ID,
      executionTarget: 'existing_public_profile_tab', maximumScrolls: 4
    }],
    ['collector_xiaohongshu_account_public_notes', {
      bindingAlias: 'binding-1', clientRequestId: CLIENT_REQUEST_ID,
      executionTarget: 'ephemeral_public_profile_url', maximumScrolls: 4
    }],
    ['collector_xiaohongshu_account_public_notes', {
      bindingAlias: 'binding-1', clientRequestId: CLIENT_REQUEST_ID,
      executionTarget: 'discover_public_profile_from_note', maximumScrolls: 4,
      profileUrl: 'https://www.xiaohongshu.com/user/profile/unsafe'
    }],
    ['collector_zhihu_search_public_content', {
      bindingAlias: 'binding-1', clientRequestId: CLIENT_REQUEST_ID, query: '不允许浏览器身份'
    }],
    ['collector_zhihu_hot_list_public_content', {
      clientRequestId: CLIENT_REQUEST_ID, executionTarget: 'official_api'
    }]
  ];
  for (const [toolId, argumentsValue] of invalidCalls) {
    const { core, service } = setup();
    await assert.rejects(
      service.submit(toolId, argumentsValue),
      (error: unknown) => error instanceof CollectorMcpError && error.code === 'tool_input_invalid'
    );
    assert.equal(core.submissions.length, 0);
  }
});

test('unknown alias fails before POST and never reveals a Core browser identity', async () => {
  const { core, service } = setup();
  await assert.rejects(
    service.submit('collector_bilibili_video_detail', {
      bindingAlias: 'binding-999', clientRequestId: CLIENT_REQUEST_ID,
      canonicalVideoUrl: VIDEO_URL
    }),
    (error: unknown) => error instanceof CollectorMcpError && error.code === 'binding_alias_not_found'
  );
  assert.equal(core.submissions.length, 0);
});

test('idempotent replay preserves the exact current Core state', async () => {
  const { core, service } = setup();
  core.submissionResponse = {
    schemaVersion: 3,
    clientRequestId: CLIENT_REQUEST_ID,
    idempotentReplay: true,
    result: {
      schemaVersion: 1,
      operationId: OPERATION_ID,
      browserBindingId: core.fixture.bindings.bindings[0]!.browserBindingId,
      platform: 'bilibili',
      capability: 'bilibili.video_detail',
      executionTarget: 'collector_work_tab',
      state: 'partial'
    }
  };
  const result = await service.submit('collector_bilibili_video_detail', {
    bindingAlias: 'binding-1', clientRequestId: CLIENT_REQUEST_ID,
    canonicalVideoUrl: VIDEO_URL
  });
  assert.equal(result.idempotentReplay, true);
  assert.equal(result.coreState, 'partial');
  assert.equal(core.submissions.length, 1);
});

test('submission outcome unknown is stable and never triggers an automatic retry', async () => {
  const { core, service } = setup();
  core.submissionError = new CollectorMcpError('submission_outcome_unknown');
  await assert.rejects(
    service.submit('collector_bilibili_video_detail', {
      bindingAlias: 'binding-1', clientRequestId: CLIENT_REQUEST_ID,
      canonicalVideoUrl: VIDEO_URL
    }),
    (error: unknown) => error instanceof CollectorMcpError &&
      error.code === 'submission_outcome_unknown'
  );
  assert.equal(core.submissions.length, 1);
});

test('a semantically invalid successful Core response remains submission outcome unknown', async () => {
  const { core, service } = setup();
  core.submissionResponse = {
    schemaVersion: 3,
    clientRequestId: CLIENT_REQUEST_ID,
    idempotentReplay: false,
    result: {
      schemaVersion: 1,
      operationId: OPERATION_ID,
      browserBindingId: core.fixture.bindings.bindings[0]!.browserBindingId,
      platform: 'bilibili',
      capability: 'bilibili.account_profile',
      executionTarget: 'collector_work_tab',
      state: 'queued'
    }
  };
  await assert.rejects(
    service.submit('collector_bilibili_video_detail', {
      bindingAlias: 'binding-1', clientRequestId: CLIENT_REQUEST_ID,
      canonicalVideoUrl: VIDEO_URL
    }),
    (error: unknown) => error instanceof CollectorMcpError &&
      error.code === 'submission_outcome_unknown'
  );
  assert.equal(core.submissions.length, 1);
});

function setup() {
  const core = new StubCoreReader();
  const compatibility = verifyCollectorCoreCompatibility(
    core.fixture,
    new Date('2026-08-03T00:00:00.000Z'),
    fixtureCompatibilityPolicy(core.fixture)
  );
  const aliases = new BindingAliasRegistry();
  aliases.project(compatibility.rawBindings);
  const logs: string[] = [];
  const logger = new SafeLogger((text) => logs.push(text), '55555555-5555-4555-8555-555555555555');
  const service = new CollectorToolService({ core, compatibility, aliases, logger });
  return { core, compatibility, aliases, logs, logger, service };
}
