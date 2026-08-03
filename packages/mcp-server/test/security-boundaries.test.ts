import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCollectorCoreRuntimeConfig, validateCoreOrigin } from '../src/credential.js';
import { CollectorMcpError, toProtocolError } from '../src/errors.js';
import { SafeLogger } from '../src/logger.js';

const token = `cst_${'A'.repeat(43)}`;

test('loads only a dedicated loopback Core credential from the process boundary', () => {
  assert.deepEqual(loadCollectorCoreRuntimeConfig({
    COLLECTOR_CORE_TOKEN: token,
    COLLECTOR_CORE_ORIGIN: 'http://127.0.0.1:43127',
    DEEPSEEK_API_KEY: 'must-not-be-read'
  }), {
    origin: 'http://127.0.0.1:43127',
    token,
    requestTimeoutMs: 10_000
  });
  assert.equal(validateCoreOrigin('http://127.0.0.1:43128'), 'http://127.0.0.1:43128');
  for (const environment of [
    {},
    { COLLECTOR_CORE_TOKEN: 'not-a-token' },
    { COLLECTOR_CORE_TOKEN: token, COLLECTOR_CORE_ORIGIN: 'http://localhost:43127' },
    { COLLECTOR_CORE_TOKEN: token, COLLECTOR_CORE_ORIGIN: 'https://127.0.0.1:43127' }
  ]) {
    assert.throws(() => loadCollectorCoreRuntimeConfig(environment));
  }
});

test('structured stderr logging ignores secrets, prompt-like content and unknown fields', () => {
  let output = '';
  const logger = new SafeLogger((text) => { output += text; }, '11111111-1111-4111-8111-111111111111');
  logger.record('warn', 'collector.mcp.resource_read', {
    artifactId: '22222222-2222-4222-8222-222222222222',
    resourceKind: 'artifact_chunk',
    outcome: 'failed',
    errorCode: 'resource_not_found',
    token,
    query: '中文搜索词',
    prompt: 'private prompt',
    url: 'https://example.test/secret'
  });
  const event = JSON.parse(output) as Record<string, unknown>;
  assert.equal(event.artifactId, '22222222-2222-4222-8222-222222222222');
  assert.equal(event.errorCode, 'resource_not_found');
  assert.equal(event.token, undefined);
  assert.equal(event.query, undefined);
  assert.equal(event.prompt, undefined);
  assert.equal(event.url, undefined);
  assert.equal(output.includes(token), false);
  assert.equal(output.includes('中文搜索词'), false);
});

test('protocol errors expose stable codes and never an upstream exception message', () => {
  const upstream = new Error(`fetch failed with ${token}`);
  const protocol = toProtocolError(upstream);
  assert.match(protocol.message, /core_unavailable$/);
  assert.equal(protocol.message.includes(token), false);

  const invalid = toProtocolError(new CollectorMcpError('resource_uri_invalid'));
  assert.match(invalid.message, /resource_uri_invalid$/);

  const conflict = toProtocolError(new CollectorMcpError(
    'submission_conflict',
    409,
    'collector_service_idempotency_conflict'
  ));
  assert.deepEqual(conflict.data, {
    coreErrorCode: 'collector_service_idempotency_conflict'
  });
  const unsafe = toProtocolError(new CollectorMcpError('submission_conflict', 409, token));
  assert.equal(unsafe.data, undefined);
  const modelCredential = toProtocolError(new CollectorMcpError(
    'submission_conflict', 409, 'sk-must-not-escape'
  ));
  assert.equal(modelCredential.data, undefined);
});
