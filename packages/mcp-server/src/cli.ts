#!/usr/bin/env node
import { loadCollectorCoreRuntimeConfig } from './credential.js';
import { stableErrorCode } from './errors.js';
import { SafeLogger } from './logger.js';
import { startCollectorMcpServer } from './server.js';

const logger = new SafeLogger();

try {
  const runtime = await startCollectorMcpServer(loadCollectorCoreRuntimeConfig(), { logger });
  const stop = async () => {
    await runtime.close();
    process.exitCode = 0;
  };
  process.once('SIGINT', () => { void stop(); });
  process.once('SIGTERM', () => { void stop(); });
} catch (error) {
  logger.record('error', 'collector.mcp.start_failed', {
    outcome: 'failed',
    errorCode: stableErrorCode(error)
  });
  process.exitCode = 1;
}
