import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { listLiveMatrixCases, resolveLiveMatrixCase } from '../l3/live-matrix-cases.mjs';
import {
  LiveMatrixError,
  OneShotToolSubmission,
  inputEvidence,
  parseLiveMatrixArguments,
  readAndVerifyArtifact,
  selectUniqueOnlineBinding,
  sha256,
  verifyCaseAgainstLiveCatalog
} from '../l3/live-matrix-contract.mjs';

test('live matrix exposes ten unique explicit Bilibili cases', () => {
  const cases = listLiveMatrixCases();
  assert.equal(cases.length, 10);
  assert.equal(new Set(cases.map((entry) => entry.caseId)).size, cases.length);
  assert.equal(new Set(cases.map((entry) => entry.toolId)).size, cases.length);
  assert.ok(cases.every((entry) => entry.platform === 'bilibili'));
});

test('case resolution supplies safe defaults but never guesses a series identity', () => {
  const detail = resolveLiveMatrixCase('bilibili.video-detail', {});
  assert.equal(detail.capabilityFields.canonicalVideoUrl,
    'https://www.bilibili.com/video/BV1qZSLBYEpa');
  assert.throws(
    () => resolveLiveMatrixCase('bilibili.collection-series-detail', {}),
    /collector_l3_case_environment_required:COLLECTOR_L3_BILIBILI_SERIES_ID/
  );
  const series = resolveLiveMatrixCase('bilibili.collection-series-detail', {
    COLLECTOR_L3_BILIBILI_SERIES_ID: '123',
    COLLECTOR_L3_BILIBILI_SERIES_TYPE: 'season'
  });
  assert.deepEqual(series.capabilityFields, {
    canonicalProfileUrl: 'https://space.bilibili.com/7481602',
    stableSeriesId: '123',
    listType: 'season'
  });
});

test('live invocation requires one explicit case and exactly one live mode', () => {
  assert.deepEqual(
    parseLiveMatrixArguments(['--case', 'bilibili.video-detail', '--execute-live']),
    { mode: 'execute', caseId: 'bilibili.video-detail' }
  );
  assert.deepEqual(
    parseLiveMatrixArguments(['--case', 'bilibili.video-detail', '--reconcile-live']),
    { mode: 'reconcile', caseId: 'bilibili.video-detail' }
  );
  for (const invalid of [
    [],
    ['--execute-live'],
    ['--case', 'bilibili.video-detail'],
    ['--case', 'bilibili.video-detail', '--execute-live', '--reconcile-live'],
    ['--case', 'bilibili.video-detail', '--execute-live', '--unknown']
  ]) {
    assert.throws(() => parseLiveMatrixArguments(invalid), LiveMatrixError);
  }
});

test('one-shot Tool gate blocks a second submission in the same process', async () => {
  let calls = 0;
  const client = { callTool: async () => ({ calls: ++calls }) };
  const gate = new OneShotToolSubmission();
  assert.deepEqual(await gate.call(client, { name: 'first' }), { calls: 1 });
  await assert.rejects(
    gate.call(client, { name: 'second' }),
    /collector_l3_multiple_tool_submissions_blocked/
  );
  assert.equal(calls, 1);
});

test('binding selection rejects zero and ambiguous online bindings', () => {
  const document = (bindings) => ({ schemaVersion: 'collector.mcp.bindings/v1', bindings });
  assert.throws(() => selectUniqueOnlineBinding(document([])),
    /collector_l3_online_binding_missing/);
  assert.throws(() => selectUniqueOnlineBinding(document([
    { bindingAlias: 'binding-1', state: 'online' },
    { bindingAlias: 'binding-2', state: 'online' }
  ])), /collector_l3_online_binding_ambiguous/);
  assert.equal(selectUniqueOnlineBinding(document([
    { bindingAlias: 'binding-1', state: 'offline' },
    { bindingAlias: 'binding-2', state: 'online' }
  ])), 'binding-2');
});

test('case arguments are validated against the discovered live Tool schema', () => {
  const caseDefinition = resolveLiveMatrixCase('bilibili.video-detail', {});
  const inputSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['bindingAlias', 'clientRequestId', 'canonicalVideoUrl'],
    properties: {
      bindingAlias: { type: 'string', pattern: '^binding-[1-9][0-9]*$' },
      clientRequestId: { type: 'string', format: 'uuid' },
      canonicalVideoUrl: { type: 'string', pattern: '^https://www\\.bilibili\\.com/video/BV' }
    }
  };
  const capabilities = {
    schemaVersion: 'collector.mcp.capabilities/v1',
    catalog: { directContracts: [{ capability: caseDefinition.capabilityId }] }
  };
  const tools = [{
    name: caseDefinition.toolId,
    inputSchema,
    _meta: {
      'collector/capabilityId': caseDefinition.capabilityId,
      'collector/toolCatalogVersion': 'collector.mcp.tools/v1',
      'collector/inputSchemaDigest': sha256(JSON.stringify(inputSchema))
    }
  }];
  const argumentsRecord = {
    bindingAlias: 'binding-1',
    clientRequestId: randomUUID(),
    ...caseDefinition.capabilityFields
  };
  assert.equal(
    verifyCaseAgainstLiveCatalog(caseDefinition, capabilities, tools, argumentsRecord)
      .requiredFields.length,
    3
  );
  assert.throws(
    () => verifyCaseAgainstLiveCatalog(caseDefinition, capabilities, tools, {
      ...argumentsRecord,
      arbitrarySelector: '#unsafe'
    }),
    /collector_l3_case_does_not_match_live_tool_schema/
  );
});

test('Artifact protocol verifier follows every advertised cursor and proves the full hash', async () => {
  const artifactId = randomUUID();
  const operationId = randomUUID();
  const capabilityId = 'bilibili.native_search_batch';
  const content = JSON.stringify({ payload: 'x'.repeat(20_000) });
  const firstText = content.slice(0, 16_384);
  const secondText = content.slice(16_384);
  const artifactSha256 = sha256(content);
  const metadataUri = `collector://artifacts/${artifactId}`;
  const firstUri = `${metadataUri}/chunks/0`;
  const secondUri = `${metadataUri}/chunks/16384`;
  const resources = new Map([
    [metadataUri, resource({
      schemaVersion: 'collector.mcp.artifact-metadata/v1',
      artifactId,
      operationId,
      capabilityId,
      mediaType: 'application/json',
      representation: 'canonical_json_utf8',
      byteLength: Buffer.byteLength(content),
      sha256: artifactSha256,
      capturedAt: new Date().toISOString(),
      terminalStatus: 'completed',
      retentionClass: 'core_managed_local',
      deletionState: 'retained',
      available: true,
      firstChunkResourceUri: firstUri
    })],
    [firstUri, resource(chunk({
      artifactId, capabilityId, artifactSha256, text: firstText,
      start: 0, totalBytes: Buffer.byteLength(content), nextCursor: 16_384
    }))],
    [secondUri, resource(chunk({
      artifactId, capabilityId, artifactSha256, text: secondText,
      start: 16_384, totalBytes: Buffer.byteLength(content), nextCursor: null
    }))]
  ]);
  const reads = [];
  const result = await readAndVerifyArtifact(async (uri) => {
    reads.push(uri);
    return resources.get(uri);
  }, metadataUri, { artifactId, operationId, capabilityId });
  assert.deepEqual(reads, [metadataUri, firstUri, secondUri]);
  assert.equal(result.chunks.count, 2);
  assert.equal(result.chunks.multiChunk, true);
  assert.equal(result.chunks.verifiedBytes, Buffer.byteLength(content));
  assert.equal(result.chunks.reconstructedSha256, artifactSha256);
  assert.equal(JSON.stringify(result).includes(content), false);
});

test('developer-visible input evidence hashes content while preserving only safe enums', () => {
  const evidence = inputEvidence({
    bindingAlias: 'binding-1',
    clientRequestId: randomUUID(),
    canonicalProfileUrl: 'https://space.bilibili.com/7481602',
    executionTarget: 'collector_work_tab'
  });
  assert.equal(evidence.executionTarget, 'collector_work_tab');
  assert.match(evidence.canonicalProfileUrl, /^sha256:[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(evidence).includes('space.bilibili.com'), false);
});

function resource(value) {
  return {
    contents: [{ uri: 'collector://test', mimeType: 'application/json', text: JSON.stringify(value) }]
  };
}

function chunk({ artifactId, capabilityId, artifactSha256, text, start, totalBytes, nextCursor }) {
  const byteLength = Buffer.byteLength(text);
  return {
    schemaVersion: 'collector.mcp.artifact-chunk/v1',
    artifactId,
    capabilityId,
    representation: 'canonical_json_utf8',
    encoding: 'utf-8',
    range: { start, endExclusive: start + byteLength, totalBytes },
    maximumBytes: 16_384,
    artifactSha256,
    chunkSha256: `sha256:${createHash('sha256').update(text).digest('hex')}`,
    truncated: nextCursor !== null,
    nextCursor,
    nextChunkResourceUri: nextCursor === null
      ? null
      : `collector://artifacts/${artifactId}/chunks/${nextCursor}`,
    text
  };
}
