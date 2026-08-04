import type { CollectorCoreApi } from '../../src/core-client.js';
import { CollectorMcpError } from '../../src/errors.js';
import { coreContractFixture } from './core-contract-fixture.js';

export const OPERATION_ID = '11111111-1111-4111-8111-111111111111';
export const ARTIFACT_ID = '22222222-2222-4222-8222-222222222222';
export const ARTIFACT_DIGEST = `sha256:${'a'.repeat(64)}`;

export class StubCoreReader implements CollectorCoreApi {
  readonly fixture = coreContractFixture();
  readonly submissions: Array<Record<string, unknown>> = [];
  submissionError: unknown = null;
  submissionResponse: unknown = null;

  async readRelease(): Promise<unknown> {
    return structuredClone(this.fixture.release);
  }

  async readCapabilities(): Promise<unknown> {
    return structuredClone(this.fixture.catalog);
  }

  async readOpenApi(): Promise<unknown> {
    return structuredClone(this.fixture.openApi);
  }

  async readBindings(): Promise<unknown> {
    return structuredClone(this.fixture.bindings);
  }

  async readOperation(operationId: string): Promise<unknown> {
    if (operationId !== OPERATION_ID) throw new CollectorMcpError('resource_not_found', 404);
    return {
      schemaVersion: 1,
      operationId,
      browserBindingId: this.fixture.bindings.bindings[0]!.browserBindingId,
      platform: 'bilibili',
      capability: 'bilibili.video_detail',
      executionTarget: 'collector_work_tab',
      state: 'completed',
      queuedAt: '2026-08-03T00:00:00.000Z',
      claimedAt: '2026-08-03T00:00:01.000Z',
      completedAt: '2026-08-03T00:00:02.000Z',
      errorCode: null,
      terminalReason: 'detail_ready',
      artifact: {
        artifactId: ARTIFACT_ID,
        retrievalPath: `/v1/collect/artifacts/bilibili.video_detail/${ARTIFACT_ID}`,
        summary: { itemCount: 1, query: 'must-not-leak' }
      }
    };
  }

  async readArtifactMetadata(artifactId: string): Promise<unknown> {
    if (artifactId !== ARTIFACT_ID) throw new CollectorMcpError('resource_not_found', 404);
    return {
      schemaVersion: 1,
      artifactId,
      operationId: OPERATION_ID,
      capability: 'bilibili.video_detail',
      mediaType: 'application/json',
      representation: 'canonical_json_utf8',
      byteLength: 8,
      sha256: ARTIFACT_DIGEST,
      capturedAt: '2026-08-03T00:00:02.000Z',
      terminalStatus: 'completed',
      retentionClass: 'core_managed_local',
      retainedUntil: null,
      deletionState: 'retained',
      available: true
    };
  }

  async readArtifactWindow(artifactId: string, offset: number, maximumBytes = 16_384): Promise<unknown> {
    if (artifactId !== ARTIFACT_ID) throw new CollectorMcpError('resource_not_found', 404);
    if (offset === 0) {
      return {
        schemaVersion: 1,
        artifactId,
        capability: 'bilibili.video_detail',
        representation: 'canonical_json_utf8',
        encoding: 'utf-8',
        offset: 0,
        endExclusive: 6,
        byteLength: 8,
        maximumBytes,
        nextOffset: 6,
        truncated: true,
        sha256: ARTIFACT_DIGEST,
        chunkSha256: `sha256:${'b'.repeat(64)}`,
        text: '中文'
      };
    }
    if (offset === 6) {
      return {
        schemaVersion: 1,
        artifactId,
        capability: 'bilibili.video_detail',
        representation: 'canonical_json_utf8',
        encoding: 'utf-8',
        offset: 6,
        endExclusive: 8,
        byteLength: 8,
        maximumBytes,
        nextOffset: null,
        truncated: false,
        sha256: ARTIFACT_DIGEST,
        chunkSha256: `sha256:${'c'.repeat(64)}`,
        text: '{}'
      };
    }
    throw new CollectorMcpError('artifact_read_out_of_bounds', 416);
  }

  async submitCollection(request: Record<string, unknown>): Promise<unknown> {
    this.submissions.push(structuredClone(request));
    if (this.submissionError !== null) throw this.submissionError;
    if (this.submissionResponse !== null) return structuredClone(this.submissionResponse);
    return {
      schemaVersion: 3,
      clientRequestId: request.clientRequestId,
      idempotentReplay: false,
      result: {
        schemaVersion: 1,
        operationId: OPERATION_ID,
        browserBindingId: request.browserBindingId ?? null,
        platform: request.platform,
        capability: request.capability,
        executionTarget: request.executionTarget,
        state: request.executionTarget === 'official_api' ? 'completed' : 'queued',
        queuedAt: '2026-08-03T00:00:00.000Z',
        claimedAt: request.executionTarget === 'official_api' ? '2026-08-03T00:00:00.000Z' : null,
        completedAt: request.executionTarget === 'official_api' ? '2026-08-03T00:00:01.000Z' : null,
        errorCode: null,
        terminalReason: null,
        artifact: null
      }
    };
  }
}
