import test from 'node:test';
import assert from 'node:assert/strict';
import { CollectorMcpError } from '../src/errors.js';
import {
  artifactChunkResourceUri,
  artifactResourceUri,
  operationResourceUri,
  parseCollectorResourceUri
} from '../src/resource-uri.js';

const operationId = '11111111-1111-4111-8111-111111111111';
const artifactId = '22222222-2222-4222-8222-222222222222';

test('parses only the six approved Collector Resource shapes', () => {
  assert.deepEqual(parseCollectorResourceUri('collector://release'), {
    kind: 'release',
    uri: 'collector://release'
  });
  assert.equal(parseCollectorResourceUri(operationResourceUri(operationId)).kind, 'operation');
  assert.equal(parseCollectorResourceUri(artifactResourceUri(artifactId)).kind, 'artifact_metadata');
  assert.deepEqual(parseCollectorResourceUri(artifactChunkResourceUri(artifactId, 16384)), {
    kind: 'artifact_chunk',
    uri: `collector://artifacts/${artifactId}/chunks/16384`,
    artifactId,
    cursor: 16384
  });
});

test('rejects queries, paths, traversal, percent encoding and unsafe cursors', () => {
  const invalid = [
    'collector://release/',
    'collector://release?token=secret',
    `collector://operations/${operationId}/extra`,
    `collector://operations/%2e%2e`,
    `collector://artifacts/${artifactId}/chunks/-1`,
    `collector://artifacts/${artifactId}/chunks/01`,
    `collector://artifacts/${artifactId}/chunks/9007199254740992`,
    `file:///tmp/${artifactId}`,
    `collector://artifacts/bilibili.discussion/${artifactId}`
  ];
  for (const uri of invalid) {
    assert.throws(
      () => parseCollectorResourceUri(uri),
      (error) => error instanceof CollectorMcpError && error.code === 'resource_uri_invalid'
    );
  }
});
