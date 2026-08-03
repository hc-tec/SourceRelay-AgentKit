import { Buffer } from 'node:buffer';

const DEFAULT_VIDEO_URL = 'https://www.bilibili.com/video/BV1qZSLBYEpa';
const DEFAULT_PROFILE_URL = 'https://space.bilibili.com/7481602';
const DEFAULT_QUERY = '人工智能';

const CASES = Object.freeze([
  defineCase({
    caseId: 'bilibili.video-detail',
    toolId: 'collector_bilibili_video_detail',
    capabilityId: 'bilibili.video_detail',
    targetRole: 'detail',
    input: (environment) => ({
      canonicalVideoUrl: environment.COLLECTOR_L3_BILIBILI_VIDEO_URL ?? DEFAULT_VIDEO_URL
    })
  }),
  defineCase({
    caseId: 'bilibili.native-search',
    toolId: 'collector_bilibili_native_search',
    capabilityId: 'bilibili.native_search',
    targetRole: 'search',
    input: (environment) => ({
      query: environment.COLLECTOR_L3_BILIBILI_QUERY ?? DEFAULT_QUERY
    })
  }),
  defineCase({
    caseId: 'bilibili.native-search-batch',
    toolId: 'collector_bilibili_native_search_batch',
    capabilityId: 'bilibili.native_search_batch',
    targetRole: 'search',
    input: (environment) => ({
      query: environment.COLLECTOR_L3_BILIBILI_QUERY ?? DEFAULT_QUERY
    })
  }),
  defineCase({
    caseId: 'bilibili.account-profile',
    toolId: 'collector_bilibili_account_profile',
    capabilityId: 'bilibili.account_profile',
    targetRole: 'account',
    input: (environment) => ({
      canonicalProfileUrl: environment.COLLECTOR_L3_BILIBILI_PROFILE_URL ?? DEFAULT_PROFILE_URL
    })
  }),
  defineCase({
    caseId: 'bilibili.account-inventory',
    toolId: 'collector_bilibili_account_inventory',
    capabilityId: 'bilibili.account_inventory',
    targetRole: 'account',
    input: (environment) => ({
      executionTarget: environment.COLLECTOR_L3_EXECUTION_TARGET ?? 'collector_work_tab',
      canonicalProfileUrl: environment.COLLECTOR_L3_BILIBILI_PROFILE_URL ?? DEFAULT_PROFILE_URL
    })
  }),
  defineCase({
    caseId: 'bilibili.dynamic',
    toolId: 'collector_bilibili_dynamic',
    capabilityId: 'bilibili.dynamic',
    targetRole: 'account',
    input: (environment) => ({
      canonicalProfileUrl: environment.COLLECTOR_L3_BILIBILI_PROFILE_URL ?? DEFAULT_PROFILE_URL
    })
  }),
  defineCase({
    caseId: 'bilibili.collection-series-overview',
    toolId: 'collector_bilibili_collection_series_overview',
    capabilityId: 'bilibili.collection_series.overview',
    targetRole: 'account',
    input: (environment) => ({
      canonicalProfileUrl: environment.COLLECTOR_L3_BILIBILI_PROFILE_URL ?? DEFAULT_PROFILE_URL
    })
  }),
  defineCase({
    caseId: 'bilibili.collection-series-detail',
    toolId: 'collector_bilibili_collection_series_detail',
    capabilityId: 'bilibili.collection_series.detail',
    targetRole: 'detail',
    input: (environment) => ({
      canonicalProfileUrl: environment.COLLECTOR_L3_BILIBILI_PROFILE_URL ?? DEFAULT_PROFILE_URL,
      stableSeriesId: requiredEnvironment(environment, 'COLLECTOR_L3_BILIBILI_SERIES_ID'),
      listType: requiredEnvironment(environment, 'COLLECTOR_L3_BILIBILI_SERIES_TYPE')
    })
  }),
  defineCase({
    caseId: 'bilibili.discussion',
    toolId: 'collector_bilibili_discussion',
    capabilityId: 'bilibili.discussion',
    targetRole: 'discussion',
    input: (environment) => ({
      canonicalVideoUrl: environment.COLLECTOR_L3_BILIBILI_VIDEO_URL ?? DEFAULT_VIDEO_URL
    })
  }),
  defineCase({
    caseId: 'bilibili.danmaku',
    toolId: 'collector_bilibili_danmaku',
    capabilityId: 'bilibili.danmaku',
    targetRole: 'media',
    input: (environment) => ({
      canonicalVideoUrl: environment.COLLECTOR_L3_BILIBILI_VIDEO_URL ?? DEFAULT_VIDEO_URL
    })
  })
]);

export function listLiveMatrixCases() {
  return CASES.map(({ input: _input, ...summary }) => ({ ...summary }));
}

export function resolveLiveMatrixCase(caseId, environment = process.env) {
  const definition = CASES.find((candidate) => candidate.caseId === caseId);
  if (!definition) throw new Error('collector_l3_case_unknown');
  const capabilityFields = definition.input(environment);
  validateCapabilityFields(definition.caseId, capabilityFields);
  return Object.freeze({
    caseId: definition.caseId,
    platform: definition.platform,
    toolId: definition.toolId,
    capabilityId: definition.capabilityId,
    targetRole: definition.targetRole,
    capabilityFields: Object.freeze({ ...capabilityFields })
  });
}

function defineCase(value) {
  return Object.freeze({ platform: 'bilibili', ...value });
}

function requiredEnvironment(environment, name) {
  const value = environment[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`collector_l3_case_environment_required:${name}`);
  }
  return value;
}

function validateCapabilityFields(caseId, fields) {
  if (Object.hasOwn(fields, 'canonicalVideoUrl')) {
    const value = fields.canonicalVideoUrl;
    if (typeof value !== 'string' ||
      !/^https:\/\/www\.bilibili\.com\/video\/BV[A-Za-z0-9]+$/.test(value)) {
      throw new Error('collector_l3_case_video_url_invalid');
    }
  }
  if (Object.hasOwn(fields, 'canonicalProfileUrl')) {
    const value = fields.canonicalProfileUrl;
    if (typeof value !== 'string' || !/^https:\/\/space\.bilibili\.com\/[1-9][0-9]*$/.test(value)) {
      throw new Error('collector_l3_case_profile_url_invalid');
    }
  }
  if (Object.hasOwn(fields, 'query')) {
    const value = fields.query;
    const bytes = typeof value === 'string' ? Buffer.byteLength(value, 'utf8') : 0;
    if (bytes < 1 || bytes > 160) throw new Error('collector_l3_case_query_invalid');
  }
  if (caseId === 'bilibili.account-inventory' &&
    fields.executionTarget !== 'collector_work_tab' && fields.executionTarget !== 'user_selected_tab') {
    throw new Error('collector_l3_case_execution_target_invalid');
  }
  if (caseId === 'bilibili.collection-series-detail') {
    if (!/^[1-9][0-9]*$/.test(fields.stableSeriesId)) {
      throw new Error('collector_l3_case_series_id_invalid');
    }
    if (fields.listType !== 'series' && fields.listType !== 'season') {
      throw new Error('collector_l3_case_series_type_invalid');
    }
  }
}
