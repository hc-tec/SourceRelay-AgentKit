import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultCredentialFilePath,
  parseStoredCredential,
  readStoredCredentialSync,
  writeStoredCredential
} from '../src/local-credential.js';
import { loadCollectorCoreRuntimeConfig } from '../src/credential.js';
import { parseAgentCliArguments } from '../src/agent-cli.js';

const token = `cst_${'B'.repeat(43)}`;

test('local credential fallback supplies the MCP runtime without an environment token', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sourcerelay-agentkit-'));
  const file = join(directory, 'core-credential.json');
  try {
    await writeStoredCredential({
      origin: 'http://127.0.0.1:43127',
      token
    }, { filePath: file, environment: {} });
    assert.deepEqual(loadCollectorCoreRuntimeConfig({
      COLLECTOR_AGENT_CREDENTIAL_FILE: file
    }), {
      origin: 'http://127.0.0.1:43127',
      token,
      requestTimeoutMs: 10_000
    });
    const stored = readStoredCredentialSync({ filePath: file, environment: {} });
    assert.equal(stored?.token, token);
    const rotatedToken = `cst_${'D'.repeat(43)}`;
    await writeStoredCredential({
      origin: 'http://127.0.0.1:43127',
      token: rotatedToken
    }, { filePath: file, environment: {} });
    assert.equal(readStoredCredentialSync({ filePath: file, environment: {} })?.token, rotatedToken);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('an invalid local credential fails closed and does not fall back to another secret', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sourcerelay-agentkit-invalid-'));
  const file = join(directory, 'core-credential.json');
  try {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(file, '{"schemaVersion":1,"token":"not-a-token"}', 'utf8');
    assert.throws(() => loadCollectorCoreRuntimeConfig({
      COLLECTOR_AGENT_CREDENTIAL_FILE: file,
      DEEPSEEK_API_KEY: token
    }), /authentication_failed/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('credential paths default to the current user config directory', () => {
  const environment = process.platform === 'win32'
    ? { LOCALAPPDATA: 'C:\\Users\\test\\AppData\\Local' }
    : { XDG_CONFIG_HOME: '/tmp/test-config' };
  assert.equal(
    defaultCredentialFilePath(environment),
    join(process.platform === 'win32' ? 'C:\\Users\\test\\AppData\\Local' : '/tmp/test-config',
      'SourceRelay', 'AgentKit', 'core-credential.json')
  );
});

test('agent CLI never accepts a token as a command-line argument', () => {
  assert.deepEqual(parseAgentCliArguments(['setup', '--install-codex']), {
    command: 'setup',
    installCodex: true,
    skipCoreCheck: false
  });
  assert.throws(
    () => parseAgentCliArguments(['setup', '--token', token]),
    /collector_agent_unknown_option/
  );
  assert.throws(
    () => parseStoredCredential({
      schemaVersion: 1,
      origin: 'http://localhost:43127',
      token,
      createdAt: new Date().toISOString()
    }),
    /collector_agent_credential_invalid/
  );
});
