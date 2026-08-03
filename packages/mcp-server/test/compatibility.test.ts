import test from 'node:test';
import assert from 'node:assert/strict';
import { CollectorMcpError } from '../src/errors.js';
import { verifyCollectorCoreCompatibility } from '../src/compatibility.js';
import {
  DIRECT_CAPABILITY_IDS,
  coreContractFixture,
  fixtureCompatibilityPolicy
} from './support/core-contract-fixture.js';

test('verifies release, OpenAPI, catalog and all direct contracts as one identity', () => {
  const fixture = coreContractFixture();
  const verified = verifyCollectorCoreCompatibility(
    fixture,
    new Date('2026-08-03T01:00:00.000Z'),
    fixtureCompatibilityPolicy(fixture)
  );
  assert.equal(verified.releaseVersion, '0.7.17');
  assert.equal(verified.serviceSchemaVersion, 3);
  assert.deepEqual(new Set(verified.directCapabilityIds), new Set(DIRECT_CAPABILITY_IDS));
  assert.equal(verified.rawBindings.length, 1);
  assert.equal(verified.verifiedAt, '2026-08-03T01:00:00.000Z');
});

test('fails closed before MCP startup on digest, feature or direct-ready mismatch', () => {
  const cases = [
    () => {
      const fixture = coreContractFixture();
      fixture.release.compatibility.openApiSchemaDigest = `sha256:${'0'.repeat(64)}`;
      return fixture;
    },
    () => {
      const fixture = coreContractFixture();
      fixture.release.compatibility.features = [];
      return fixture;
    },
    () => {
      const fixture = coreContractFixture();
      fixture.catalog.capabilities[0]!.dispatchState = 'catalog_only';
      fixture.catalog.catalogDigest = fixture.release.compatibility.capabilityCatalogDigest;
      return fixture;
    }
  ];
  for (const create of cases) {
    assert.throws(
      () => {
        const fixture = create();
        return verifyCollectorCoreCompatibility(fixture, new Date(), fixtureCompatibilityPolicy(fixture));
      },
      (error) => error instanceof CollectorMcpError && error.code === 'compatibility_unmet'
    );
  }
});

test('rejects browser binding records that could bypass the safe alias boundary', () => {
  const fixture = coreContractFixture();
  fixture.bindings.bindings[0]!.extensionId = 'chrome-profile-path';
  assert.throws(
    () => verifyCollectorCoreCompatibility(fixture, new Date(), fixtureCompatibilityPolicy(fixture)),
    (error) => error instanceof CollectorMcpError && error.code === 'compatibility_unmet'
  );
});

test('production policy rejects a mutually consistent but unpublished Core identity', () => {
  const fixture = coreContractFixture();
  assert.throws(
    () => verifyCollectorCoreCompatibility(fixture),
    (error) => error instanceof CollectorMcpError && error.code === 'compatibility_unmet'
  );
});
