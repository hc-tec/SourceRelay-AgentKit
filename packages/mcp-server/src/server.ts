import { randomUUID } from 'node:crypto';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import {
  COLLECTOR_MCP_NAME,
  COLLECTOR_MCP_VERSION,
  RESOURCE_URIS
} from './constants.js';
import {
  verifyCollectorCoreCompatibility,
  type VerifiedCoreCompatibility
} from './compatibility.js';
import {
  CollectorCoreClient,
  type CollectorCoreApi
} from './core-client.js';
import type { CollectorCoreRuntimeConfig } from './credential.js';
import { stableErrorCode, toProtocolError } from './errors.js';
import { SafeLogger } from './logger.js';
import { BindingAliasRegistry, CollectorResourceService } from './resources.js';
import { CollectorToolService, registerCollectorTools } from './tools.js';

export interface CollectorMcpRuntime {
  server: McpServer;
  compatibility: VerifiedCoreCompatibility;
  close(): Promise<void>;
}

export async function preflightCollectorCore(
  core: CollectorCoreApi,
  now = new Date()
): Promise<VerifiedCoreCompatibility> {
  const [release, catalog, openApi, bindings] = await Promise.all([
    core.readRelease(),
    core.readCapabilities(),
    core.readOpenApi(),
    core.readBindings()
  ]);
  return verifyCollectorCoreCompatibility({ release, catalog, openApi, bindings }, now);
}

export function buildCollectorMcpServer(
  resources: CollectorResourceService,
  tools: CollectorToolService
): McpServer {
  const server = new McpServer({
    name: COLLECTOR_MCP_NAME,
    version: COLLECTOR_MCP_VERSION
  });

  registerStaticResource(server, 'collector_release', RESOURCE_URIS.release,
    'Verified Collector Core release and compatibility identity.', resources);
  registerStaticResource(server, 'collector_capabilities', RESOURCE_URIS.capabilities,
    'Verified live Core capability catalog and direct contracts.', resources);
  registerStaticResource(server, 'collector_bindings', RESOURCE_URIS.bindings,
    'Current browser-binding states projected to session-local safe aliases.', resources);

  registerTemplateResource(
    server,
    'collector_operation',
    RESOURCE_URIS.operationTemplate,
    'Exact Core Operation state without browser-binding identity.',
    resources
  );
  registerTemplateResource(
    server,
    'collector_artifact_metadata',
    RESOURCE_URIS.artifactTemplate,
    'Core-owned Artifact metadata before any content read.',
    resources
  );
  registerTemplateResource(
    server,
    'collector_artifact_chunk',
    RESOURCE_URIS.artifactChunkTemplate,
    'Bounded canonical UTF-8 Artifact content window with hashes and next cursor.',
    resources
  );
  registerCollectorTools(server, tools);
  return server;
}

export async function startCollectorMcpServer(
  config: CollectorCoreRuntimeConfig,
  options: {
    logger?: SafeLogger;
    core?: CollectorCoreApi;
    transport?: StdioServerTransport;
  } = {}
): Promise<CollectorMcpRuntime> {
  const logger = options.logger ?? new SafeLogger(undefined, randomUUID());
  const core = options.core ?? new CollectorCoreClient(config);
  const startedAt = Date.now();
  let compatibility: VerifiedCoreCompatibility;
  try {
    compatibility = await preflightCollectorCore(core);
    logger.record('info', 'collector.mcp.preflight_completed', {
      durationMs: Math.max(0, Date.now() - startedAt),
      outcome: 'completed',
      capabilityCount: compatibility.directCapabilityIds.length,
      bindingCount: compatibility.rawBindings.length,
      openApiDigest: compatibility.openApiDigest,
      catalogDigest: compatibility.catalogDigest
    });
  } catch (error) {
    logger.record('error', 'collector.mcp.preflight_failed', {
      durationMs: Math.max(0, Date.now() - startedAt),
      outcome: 'failed',
      errorCode: stableErrorCode(error)
    });
    throw error;
  }

  const aliases = new BindingAliasRegistry();
  aliases.project(compatibility.rawBindings);
  const resources = new CollectorResourceService({ core, compatibility, aliases, logger });
  const tools = new CollectorToolService({ core, compatibility, aliases, logger });
  const server = buildCollectorMcpServer(resources, tools);
  const transport = options.transport ?? new StdioServerTransport();
  await server.connect(transport);
  logger.record('info', 'collector.mcp.started', {
    outcome: 'completed',
    capabilityCount: compatibility.directCapabilityIds.length,
    toolCount: tools.definitions.length
  });
  return {
    server,
    compatibility,
    close: async () => {
      await server.close();
      logger.record('info', 'collector.mcp.stopped', { outcome: 'completed' });
    }
  };
}

export function collectorMcpProtocolVersion(): string {
  return LATEST_PROTOCOL_VERSION;
}

function registerStaticResource(
  server: McpServer,
  name: string,
  uri: string,
  description: string,
  resources: CollectorResourceService
): void {
  server.registerResource(name, uri, {
    title: name,
    description,
    mimeType: 'application/json'
  }, async (requestedUri) => {
    try {
      const document = await resources.read(requestedUri.href);
      return { contents: [document] };
    } catch (error) {
      throw toProtocolError(error);
    }
  });
}

function registerTemplateResource(
  server: McpServer,
  name: string,
  template: string,
  description: string,
  resources: CollectorResourceService
): void {
  server.registerResource(name, new ResourceTemplate(template, { list: undefined }), {
    title: name,
    description,
    mimeType: 'application/json'
  }, async (requestedUri) => {
    try {
      const document = await resources.read(requestedUri.href);
      return { contents: [document] };
    } catch (error) {
      throw toProtocolError(error);
    }
  });
}
