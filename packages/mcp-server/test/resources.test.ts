import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyCollectorCoreCompatibility } from '../src/compatibility.js';
import { SafeLogger } from '../src/logger.js';
import { BindingAliasRegistry, CollectorResourceService } from '../src/resources.js';
import { ARTIFACT_ID, OPERATION_ID, StubCoreReader } from './support/stub-core-reader.js';
import { fixtureCompatibilityPolicy } from './support/core-contract-fixture.js';

function service(core = new StubCoreReader()): CollectorResourceService {
  const compatibility = verifyCollectorCoreCompatibility(
    core.fixture,
    new Date(),
    fixtureCompatibilityPolicy(core.fixture)
  );
  const aliases = new BindingAliasRegistry();
  aliases.project(compatibility.rawBindings);
  return new CollectorResourceService({
    core,
    compatibility,
    aliases,
    logger: new SafeLogger(() => undefined, '33333333-3333-4333-8333-333333333333')
  });
}

test('projects release, capabilities and session-safe binding aliases', async () => {
  const core = new StubCoreReader();
  const resources = service(core);
  const release = JSON.parse((await resources.read('collector://release')).text);
  const capabilities = JSON.parse((await resources.read('collector://capabilities')).text);
  const bindingsText = (await resources.read('collector://bindings')).text;
  const bindings = JSON.parse(bindingsText);
  assert.equal(release.release.product, 'collector-core');
  assert.equal(capabilities.catalog.directContracts.length, 18);
  assert.deepEqual(bindings.bindings, [{
    bindingAlias: 'binding-1',
    state: 'online',
    pairedAt: '2026-08-03T00:00:00.000Z',
    lastSeenAt: '2026-08-03T00:00:01.000Z'
  }]);
  assert.equal(bindingsText.includes(core.fixture.bindings.bindings[0]!.browserBindingId), false);
  assert.equal(bindingsText.includes(core.fixture.bindings.bindings[0]!.extensionId), false);
});

test('preserves exact Operation state while removing browser identity and Core retrieval path', async () => {
  const resources = service();
  const text = (await resources.read(`collector://operations/${OPERATION_ID}`)).text;
  const operation = JSON.parse(text);
  assert.deepEqual(operation, {
    schemaVersion: 'collector.mcp.operation/v1',
    operationId: OPERATION_ID,
    capabilityId: 'bilibili.video_detail',
    platform: 'bilibili',
    executionTarget: 'collector_work_tab',
    coreState: 'completed',
    statusClass: 'completed',
    recommendedAction: 'read_artifact',
    terminalReason: 'detail_ready',
    errorCode: null,
    queuedAt: '2026-08-03T00:00:00.000Z',
    claimedAt: '2026-08-03T00:00:01.000Z',
    completedAt: '2026-08-03T00:00:02.000Z',
    platformActionAttempted: null,
    artifact: {
      artifactId: ARTIFACT_ID,
      metadataResourceUri: `collector://artifacts/${ARTIFACT_ID}`,
      summary: { itemCount: 1 }
    }
  });
  assert.equal(text.includes('browserBindingId'), false);
  assert.equal(text.includes('retrievalPath'), false);
  assert.equal(text.includes('must-not-leak'), false);
});

test('reads Artifact metadata first and follows fixed-size UTF-8 chunk cursors', async () => {
  const resources = service();
  const metadata = JSON.parse((await resources.read(`collector://artifacts/${ARTIFACT_ID}`)).text);
  assert.equal(metadata.byteLength, 8);
  assert.equal(metadata.firstChunkResourceUri, `collector://artifacts/${ARTIFACT_ID}/chunks/0`);

  const first = JSON.parse((await resources.read(metadata.firstChunkResourceUri)).text);
  assert.equal(first.text, '中文');
  assert.deepEqual(first.range, { start: 0, endExclusive: 6, totalBytes: 8 });
  assert.equal(first.maximumBytes, 16_384);
  assert.equal(first.nextChunkResourceUri, `collector://artifacts/${ARTIFACT_ID}/chunks/6`);

  const second = JSON.parse((await resources.read(first.nextChunkResourceUri)).text);
  assert.equal(second.text, '{}');
  assert.equal(second.nextCursor, null);
  assert.equal(second.nextChunkResourceUri, null);
});
