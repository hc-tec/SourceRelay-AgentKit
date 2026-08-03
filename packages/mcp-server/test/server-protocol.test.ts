import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { verifyCollectorCoreCompatibility } from '../src/compatibility.js';
import { SafeLogger } from '../src/logger.js';
import { BindingAliasRegistry, CollectorResourceService } from '../src/resources.js';
import { buildCollectorMcpServer } from '../src/server.js';
import { CollectorToolService } from '../src/tools.js';
import { StubCoreReader } from './support/stub-core-reader.js';
import { fixtureCompatibilityPolicy } from './support/core-contract-fixture.js';

test('official MCP transport exposes Resources and all 15 strongly typed Tools', async () => {
  const core = new StubCoreReader();
  const compatibility = verifyCollectorCoreCompatibility(
    core.fixture,
    new Date(),
    fixtureCompatibilityPolicy(core.fixture)
  );
  const aliases = new BindingAliasRegistry();
  aliases.project(compatibility.rawBindings);
  const logger = new SafeLogger(() => undefined, '44444444-4444-4444-8444-444444444444');
  const resources = new CollectorResourceService({
    core,
    compatibility,
    aliases,
    logger
  });
  const tools = new CollectorToolService({ core, compatibility, aliases, logger });
  const server = buildCollectorMcpServer(resources, tools);
  const client = new Client({ name: 'collector-mcp-l1-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const listed = await client.listResources();
    const templates = await client.listResourceTemplates();
    const listedTools = await client.listTools();
    assert.deepEqual(listed.resources.map((resource) => resource.uri).sort(), [
      'collector://bindings',
      'collector://capabilities',
      'collector://release'
    ]);
    assert.deepEqual(templates.resourceTemplates.map((resource) => resource.uriTemplate).sort(), [
      'collector://artifacts/{artifactId}',
      'collector://artifacts/{artifactId}/chunks/{cursor}',
      'collector://operations/{operationId}'
    ]);
    assert.equal(listedTools.tools.length, 15);
    assert.ok(client.getServerCapabilities()?.tools);
    assert.ok(client.getServerCapabilities()?.resources);

    const release = await client.readResource({ uri: 'collector://release' });
    assert.equal(release.contents.length, 1);
    assert.equal(release.contents[0]!.mimeType, 'application/json');

    const call = await client.callTool({
      name: 'collector_bilibili_native_search',
      arguments: {
        bindingAlias: 'binding-1',
        clientRequestId: '55555555-5555-4555-8555-555555555555',
        query: '公开情报'
      }
    });
    assert.deepEqual(call.structuredContent, {
      accepted: true,
      clientRequestId: '55555555-5555-4555-8555-555555555555',
      idempotentReplay: false,
      operationId: '11111111-1111-4111-8111-111111111111',
      capabilityId: 'bilibili.native_search',
      coreState: 'queued',
      operationResourceUri: 'collector://operations/11111111-1111-4111-8111-111111111111'
    });
    assert.equal(core.submissions.length, 1);
  } finally {
    await client.close();
    await server.close();
  }
});
