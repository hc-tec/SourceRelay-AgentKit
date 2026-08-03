import test from 'node:test';
import assert from 'node:assert/strict';
import { CollectorCoreClient } from '../src/core-client.js';
import { CollectorMcpError } from '../src/errors.js';

const TOKEN = `cst_${'A'.repeat(43)}`;
const CLIENT_REQUEST_ID = '44444444-4444-4444-8444-444444444444';
const BINDING_ID = '33333333-3333-4333-8333-333333333333';
const OPERATION_ID = '11111111-1111-4111-8111-111111111111';
const REQUEST = {
  schemaVersion: 3,
  clientRequestId: CLIENT_REQUEST_ID,
  browserBindingId: BINDING_ID,
  platform: 'bilibili',
  capability: 'bilibili.video_detail',
  executionTarget: 'collector_work_tab',
  input: { canonicalVideoUrl: 'https://www.bilibili.com/video/BV1qZSLBYEpa' }
};

test('Core client performs exactly one authenticated POST and preserves the caller request ID', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const client = coreClient(async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    return jsonResponse(201, queuedResponse());
  });
  const result = await client.submitCollection(REQUEST);
  assert.deepEqual(result, queuedResponse());
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, 'http://127.0.0.1:43127/v2/collect');
  assert.equal(calls[0]!.init.method, 'POST');
  const headers = new Headers(calls[0]!.init.headers);
  assert.equal(headers.get('authorization'), `Bearer ${TOKEN}`);
  assert.equal(headers.get('content-type'), 'application/json');
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), REQUEST);
});

test('Core client reports unknown POST outcome and never retries a failed transport', async () => {
  let calls = 0;
  const client = coreClient(async () => {
    calls += 1;
    throw new Error(`upstream detail must not escape ${TOKEN}`);
  });
  await assert.rejects(
    client.submitCollection(REQUEST),
    (error: unknown) => error instanceof CollectorMcpError &&
      error.code === 'submission_outcome_unknown' && !error.message.includes(TOKEN)
  );
  assert.equal(calls, 1);
});

test('Core client maps submission HTTP failures to stable safe categories', async () => {
  const cases: Array<[number, string, string]> = [
    [400, 'user_browser_collector_service_request_invalid', 'request_rejected'],
    [401, 'collector_service_token_invalid', 'authentication_failed'],
    [403, 'collector_service_scope_denied', 'permission_denied'],
    [409, 'collector_service_idempotency_conflict', 'submission_conflict'],
    [503, 'collector_service_temporarily_unavailable', 'core_unavailable']
  ];
  for (const [status, coreCode, expectedCode] of cases) {
    let calls = 0;
    const client = coreClient(async () => {
      calls += 1;
      return jsonResponse(status, { schemaVersion: 3, ok: false, error: coreCode });
    });
    await assert.rejects(
      client.submitCollection(REQUEST),
      (error: unknown) => error instanceof CollectorMcpError &&
        error.code === expectedCode && error.status === status && error.coreErrorCode === coreCode
    );
    assert.equal(calls, 1);
  }
});

test('an unreadable successful POST response is outcome unknown, while a 409 still proves conflict', async () => {
  const successful = coreClient(async () => new Response('{', { status: 201 }));
  await assert.rejects(
    successful.submitCollection(REQUEST),
    (error: unknown) => error instanceof CollectorMcpError &&
      error.code === 'submission_outcome_unknown'
  );

  const conflict = coreClient(async () => new Response('{', { status: 409 }));
  await assert.rejects(
    conflict.submitCollection(REQUEST),
    (error: unknown) => error instanceof CollectorMcpError &&
      error.code === 'submission_conflict' && error.status === 409
  );
});

function coreClient(fetchImpl: typeof fetch): CollectorCoreClient {
  return new CollectorCoreClient({
    origin: 'http://127.0.0.1:43127',
    token: TOKEN,
    requestTimeoutMs: 1_000,
    fetchImpl
  });
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function queuedResponse(): Record<string, unknown> {
  return {
    schemaVersion: 3,
    clientRequestId: CLIENT_REQUEST_ID,
    idempotentReplay: false,
    result: {
      schemaVersion: 1,
      operationId: OPERATION_ID,
      browserBindingId: BINDING_ID,
      platform: 'bilibili',
      capability: 'bilibili.video_detail',
      executionTarget: 'collector_work_tab',
      state: 'queued'
    }
  };
}
