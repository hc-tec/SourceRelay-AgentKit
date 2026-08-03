import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { verifyCollectorCoreCompatibility } from '../src/compatibility.js';
import { SafeLogger } from '../src/logger.js';
import { BindingAliasRegistry, CollectorResourceService } from '../src/resources.js';
import { buildCollectorMcpServer } from '../src/server.js';
import { StubCoreReader } from './support/stub-core-reader.js';
import { fixtureCompatibilityPolicy } from './support/core-contract-fixture.js';

test('official MCP transport exposes three static and three templated Resources with no Tools', async () => {
  const core = new StubCoreReader();
  const compatibility = verifyCollectorCoreCompatibility(
    core.fixture,
    new Date(),
    fixtureCompatibilityPolicy(core.fixture)
  );
  const resources = new CollectorResourceService({
    core,
    compatibility,
    aliases: new BindingAliasRegistry(),
    logger: new SafeLogger(() => undefined, '44444444-4444-4444-8444-444444444444')
  });
  const server = buildCollectorMcpServer(resources);
  const client = new Client({ name: 'collector-mcp-l1-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const listed = await client.listResources();
    const templates = await client.listResourceTemplates();
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
    assert.equal(client.getServerCapabilities()?.tools, undefined);
    assert.ok(client.getServerCapabilities()?.resources);

    const release = await client.readResource({ uri: 'collector://release' });
    assert.equal(release.contents.length, 1);
    assert.equal(release.contents[0]!.mimeType, 'application/json');
  } finally {
    await client.close();
    await server.close();
  }
});
