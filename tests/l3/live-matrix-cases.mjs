const DEFAULT_VIDEO_URL = 'https://www.bilibili.com/video/BV1qZSLBYEpa';
const DEFAULT_PROFILE_URL = 'https://space.bilibili.com/7481602';
const DEFAULT_BILIBILI_QUERY = '人工智能';
const DEFAULT_XIAOHONGSHU_QUERY = '人工智能';
const DEFAULT_ZHIHU_QUERY = '人工智能';

const CASES = Object.freeze([
  defineBilibiliCase({
    caseId: 'bilibili.video-detail',
    toolId: 'collector_bilibili_video_detail',
    capabilityId: 'bilibili.video_detail',
    targetRole: 'detail',
    input: (environment) => ({
      canonicalVideoUrl: environment.COLLECTOR_L3_BILIBILI_VIDEO_URL ?? DEFAULT_VIDEO_URL
    })
  }),
  defineBilibiliCase({
    caseId: 'bilibili.native-search',
    toolId: 'collector_bilibili_native_search',
    capabilityId: 'bilibili.native_search',
    targetRole: 'search',
    input: (environment) => ({
      query: environment.COLLECTOR_L3_BILIBILI_QUERY ?? DEFAULT_BILIBILI_QUERY
    })
  }),
  defineBilibiliCase({
    caseId: 'bilibili.native-search-batch',
    toolId: 'collector_bilibili_native_search_batch',
    capabilityId: 'bilibili.native_search_batch',
    targetRole: 'search',
    input: (environment) => ({
      query: environment.COLLECTOR_L3_BILIBILI_QUERY ?? DEFAULT_BILIBILI_QUERY
    })
  }),
  defineBilibiliCase({
    caseId: 'bilibili.account-profile',
    toolId: 'collector_bilibili_account_profile',
    capabilityId: 'bilibili.account_profile',
    targetRole: 'account',
    input: (environment) => ({
      canonicalProfileUrl: environment.COLLECTOR_L3_BILIBILI_PROFILE_URL ?? DEFAULT_PROFILE_URL
    })
  }),
  defineBilibiliCase({
    caseId: 'bilibili.account-inventory',
    toolId: 'collector_bilibili_account_inventory',
    capabilityId: 'bilibili.account_inventory',
    targetRole: 'account',
    input: (environment) => ({
      executionTarget: environment.COLLECTOR_L3_EXECUTION_TARGET ?? 'collector_work_tab',
      canonicalProfileUrl: environment.COLLECTOR_L3_BILIBILI_PROFILE_URL ?? DEFAULT_PROFILE_URL
    })
  }),
  defineBilibiliCase({
    caseId: 'bilibili.dynamic',
    toolId: 'collector_bilibili_dynamic',
    capabilityId: 'bilibili.dynamic',
    targetRole: 'account',
    input: (environment) => ({
      canonicalProfileUrl: environment.COLLECTOR_L3_BILIBILI_PROFILE_URL ?? DEFAULT_PROFILE_URL
    })
  }),
  defineBilibiliCase({
    caseId: 'bilibili.collection-series-overview',
    toolId: 'collector_bilibili_collection_series_overview',
    capabilityId: 'bilibili.collection_series.overview',
    targetRole: 'account',
    input: (environment) => ({
      canonicalProfileUrl: environment.COLLECTOR_L3_BILIBILI_PROFILE_URL ?? DEFAULT_PROFILE_URL
    })
  }),
  defineBilibiliCase({
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
  defineBilibiliCase({
    caseId: 'bilibili.discussion',
    toolId: 'collector_bilibili_discussion',
    capabilityId: 'bilibili.discussion',
    targetRole: 'discussion',
    input: (environment) => ({
      canonicalVideoUrl: environment.COLLECTOR_L3_BILIBILI_VIDEO_URL ?? DEFAULT_VIDEO_URL
    })
  }),
  defineBilibiliCase({
    caseId: 'bilibili.danmaku',
    toolId: 'collector_bilibili_danmaku',
    capabilityId: 'bilibili.danmaku',
    targetRole: 'media',
    input: (environment) => ({
      canonicalVideoUrl: environment.COLLECTOR_L3_BILIBILI_VIDEO_URL ?? DEFAULT_VIDEO_URL
    })
  }),
  defineXiaohongshuCase({
    caseId: 'xiaohongshu.public-notes-search',
    toolId: 'collector_xiaohongshu_public_notes_search',
    capabilityId: 'xiaohongshu.search.public_notes.v1',
    targetRole: 'search',
    input: (environment) => ({
      query: environment.COLLECTOR_L3_XIAOHONGSHU_QUERY ?? DEFAULT_XIAOHONGSHU_QUERY,
      maximumDetails: 0
    })
  }),
  defineXiaohongshuCase({
    caseId: 'xiaohongshu.note-public-detail',
    toolId: 'collector_xiaohongshu_note_public_detail',
    capabilityId: 'xiaohongshu.note.public_detail.v1',
    targetRole: 'detail',
    input: (environment) => ({
      executionTarget: 'existing_public_search_tab',
      resultRank: integerEnvironment(environment, 'COLLECTOR_L3_XIAOHONGSHU_RESULT_RANK', 1)
    })
  }),
  defineXiaohongshuCase({
    caseId: 'xiaohongshu.note-public-comments',
    toolId: 'collector_xiaohongshu_note_public_comments',
    capabilityId: 'xiaohongshu.note.public_comments.v1',
    targetRole: 'discussion',
    input: (environment) => ({
      maximumScrolls: integerEnvironment(environment, 'COLLECTOR_L3_XIAOHONGSHU_COMMENT_SCROLLS', 2)
    })
  }),
  defineXiaohongshuCase({
    caseId: 'xiaohongshu.note-public-comment-replies',
    toolId: 'collector_xiaohongshu_note_public_comment_replies',
    capabilityId: 'xiaohongshu.note.public_comment_replies.v1',
    targetRole: 'discussion',
    input: (environment) => ({
      maximumThreads: integerEnvironment(environment, 'COLLECTOR_L3_XIAOHONGSHU_REPLY_THREADS', 1)
    })
  }),
  defineXiaohongshuCase({
    caseId: 'xiaohongshu.account-public-notes',
    toolId: 'collector_xiaohongshu_account_public_notes',
    capabilityId: 'xiaohongshu.account.public_notes.v1',
    targetRole: 'account',
    input: (environment) => ({
      executionTarget: 'discover_public_profile_from_note',
      maximumScrolls: integerEnvironment(environment, 'COLLECTOR_L3_XIAOHONGSHU_ACCOUNT_SCROLLS', 3)
    })
  }),
  defineOfficialCase({
    caseId: 'zhihu.public-content-search',
    platform: 'zhihu',
    toolId: 'collector_zhihu_search_public_content',
    capabilityId: 'zhihu.search.public_content.v1',
    targetRole: 'search',
    input: (environment) => ({
      query: environment.COLLECTOR_L3_ZHIHU_QUERY ?? DEFAULT_ZHIHU_QUERY,
      count: integerEnvironment(environment, 'COLLECTOR_L3_ZHIHU_COUNT', 10)
    })
  }),
  defineOfficialCase({
    caseId: 'zhihu.hot-list',
    platform: 'zhihu',
    toolId: 'collector_zhihu_hot_list_public_content',
    capabilityId: 'zhihu.hot_list.public_content.v1',
    targetRole: 'breadth',
    input: (environment) => ({
      limit: integerEnvironment(environment, 'COLLECTOR_L3_ZHIHU_HOT_LIMIT', 30)
    })
  }),
  defineOfficialCase({
    caseId: 'web.global-search-via-zhihu',
    platform: 'web',
    toolId: 'collector_web_search_global_zhihu_provider',
    capabilityId: 'web.search.global.zhihu_provider.v1',
    targetRole: 'search',
    input: (environment) => ({
      query: environment.COLLECTOR_L3_WEB_QUERY ?? DEFAULT_ZHIHU_QUERY,
      count: integerEnvironment(environment, 'COLLECTOR_L3_WEB_COUNT', 10),
      searchDatabase: environment.COLLECTOR_L3_WEB_SEARCH_DATABASE ?? 'all',
      ...(environment.COLLECTOR_L3_WEB_SITE === undefined
        ? {}
        : { site: environment.COLLECTOR_L3_WEB_SITE }),
      ...(environment.COLLECTOR_L3_WEB_PUBLISHED_AFTER === undefined
        ? {}
        : { publishedAfter: environment.COLLECTOR_L3_WEB_PUBLISHED_AFTER })
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
    executionProvider: definition.executionProvider,
    requiresBinding: definition.requiresBinding,
    toolId: definition.toolId,
    capabilityId: definition.capabilityId,
    targetRole: definition.targetRole,
    capabilityFields: Object.freeze({ ...capabilityFields })
  });
}

function defineBilibiliCase(value) {
  return Object.freeze({
    platform: 'bilibili', executionProvider: 'browser_extension', requiresBinding: true, ...value
  });
}

function defineXiaohongshuCase(value) {
  return Object.freeze({
    platform: 'xiaohongshu', executionProvider: 'browser_extension', requiresBinding: true, ...value
  });
}

function defineOfficialCase(value) {
  return Object.freeze({ executionProvider: 'official_api', requiresBinding: false, ...value });
}

function requiredEnvironment(environment, name) {
  const value = environment[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`collector_l3_case_environment_required:${name}`);
  }
  return value;
}

function integerEnvironment(environment, name, fallback) {
  const value = environment[name];
  if (value === undefined) return fallback;
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error(`collector_l3_case_environment_invalid:${name}`);
  }
  return Number(value);
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
    const characters = typeof value === 'string' ? [...value].length : 0;
    const maximum = caseId.startsWith('xiaohongshu.') ? 80
      : caseId.startsWith('bilibili.') ? 160 : 100;
    if (characters < 1 || characters > maximum || value !== value.trim()) {
      throw new Error('collector_l3_case_query_invalid');
    }
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
  if (caseId === 'xiaohongshu.public-notes-search' && fields.maximumDetails !== 0) {
    throw new Error('collector_l3_case_xiaohongshu_search_depth_invalid');
  }
  if (caseId === 'xiaohongshu.note-public-detail' &&
    (fields.executionTarget !== 'existing_public_search_tab' || !integerBetween(fields.resultRank, 1, 20))) {
    throw new Error('collector_l3_case_xiaohongshu_detail_invalid');
  }
  if (caseId === 'xiaohongshu.note-public-comments' && !integerBetween(fields.maximumScrolls, 1, 3)) {
    throw new Error('collector_l3_case_xiaohongshu_comments_invalid');
  }
  if (caseId === 'xiaohongshu.note-public-comment-replies' && !integerBetween(fields.maximumThreads, 1, 3)) {
    throw new Error('collector_l3_case_xiaohongshu_replies_invalid');
  }
  if (caseId === 'xiaohongshu.account-public-notes' &&
    (fields.executionTarget !== 'discover_public_profile_from_note' ||
      !integerBetween(fields.maximumScrolls, 1, 20) || Object.hasOwn(fields, 'profileUrl'))) {
    throw new Error('collector_l3_case_xiaohongshu_account_invalid');
  }
  if (caseId === 'zhihu.public-content-search' && !integerBetween(fields.count, 1, 10)) {
    throw new Error('collector_l3_case_zhihu_search_invalid');
  }
  if (caseId === 'zhihu.hot-list' && !integerBetween(fields.limit, 1, 30)) {
    throw new Error('collector_l3_case_zhihu_hot_list_invalid');
  }
  if (caseId === 'web.global-search-via-zhihu') {
    if (!integerBetween(fields.count, 1, 20) ||
      !['all', 'realtime', 'static'].includes(fields.searchDatabase) ||
      (fields.site !== undefined &&
        (typeof fields.site !== 'string' || !/^[A-Za-z0-9.-]{1,253}$/.test(fields.site) ||
          /(^|\.)zhihu\.com$/i.test(fields.site))) ||
      (fields.publishedAfter !== undefined &&
        (typeof fields.publishedAfter !== 'string' || !Number.isFinite(Date.parse(fields.publishedAfter))))) {
      throw new Error('collector_l3_case_web_global_search_invalid');
    }
  }
}

function integerBetween(value, minimum, maximum) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}
