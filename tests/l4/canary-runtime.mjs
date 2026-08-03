import { spawn } from 'node:child_process';
import { access, cp, mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function installPackagedMcp(repositoryRoot, temporaryRoot) {
  const packageDirectory = join(temporaryRoot, 'packages');
  const consumerDirectory = join(temporaryRoot, 'consumer');
  await mkdir(packageDirectory, { recursive: true });
  await requireSuccessfulProcess(runNpm([
    'pack', '--workspace', '@collector-ai-integration/mcp-server', '--pack-destination', packageDirectory
  ], repositoryRoot), 'collector_l4_mcp_pack_failed');
  const packageNames = (await readdir(packageDirectory)).filter((name) => name.endsWith('.tgz'));
  if (packageNames.length !== 1) throw new Error('collector_l4_mcp_package_missing');
  await requireSuccessfulProcess(runNpm([
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--prefix',
    consumerDirectory,
    join(packageDirectory, packageNames[0])
  ], repositoryRoot), 'collector_l4_mcp_install_failed');
  const entrypoint = join(
    consumerDirectory,
    'node_modules',
    '@collector-ai-integration',
    'mcp-server',
    'dist',
    'src',
    'cli.js'
  );
  await access(entrypoint);
  return { consumerDirectory, entrypoint };
}

export async function snapshotPinnedSkills(repositoryRoot, temporaryRoot, skillIds) {
  const snapshotRoot = join(temporaryRoot, 'skills');
  await mkdir(snapshotRoot, { recursive: true });
  for (const skillId of skillIds) {
    await cp(join(repositoryRoot, 'skills', skillId), join(snapshotRoot, skillId), {
      recursive: true,
      errorOnExist: true
    });
  }
  const verification = await runProcess(process.platform === 'win32' ? 'python.exe' : 'python', [
    '-X',
    'utf8',
    join(repositoryRoot, 'scripts', 'skill_package.py'),
    'verify',
    snapshotRoot
  ], { cwd: repositoryRoot, timeoutMs: 30_000, maximumOutputBytes: 64 * 1024 });
  if (verification.code !== 0 || verification.timedOut || verification.outputLimitExceeded) {
    throw new Error('collector_l4_pinned_skill_snapshot_invalid');
  }
  return new Map(skillIds.map((skillId) => [skillId, join(snapshotRoot, skillId)]));
}

export async function resolveCodexExecutable() {
  const appData = process.env.APPDATA;
  if (!appData) throw new Error('collector_l4_codex_home_unavailable');
  const executable = join(
    appData,
    'npm',
    'node_modules',
    '@openai',
    'codex',
    'node_modules',
    '@openai',
    process.arch === 'arm64' ? 'codex-win32-arm64' : 'codex-win32-x64',
    'vendor',
    process.arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc',
    'bin',
    'codex.exe'
  );
  await access(executable);
  return executable;
}

export function minimalCodexEnvironment(coreOrigin, coreToken) {
  const result = {};
  for (const key of [
    'APPDATA',
    'CODEX_HOME',
    'HOMEDRIVE',
    'HOMEPATH',
    'LOCALAPPDATA',
    'PATH',
    'PATHEXT',
    'SYSTEMDRIVE',
    'SYSTEMROOT',
    'TEMP',
    'TMP',
    'USERDOMAIN',
    'USERNAME',
    'USERPROFILE',
    'WINDIR'
  ]) {
    if (process.env[key] !== undefined) result[key] = process.env[key];
  }
  result.COLLECTOR_CORE_ORIGIN = coreOrigin;
  result.COLLECTOR_CORE_TOKEN = coreToken;
  return result;
}

export function tomlLiteral(value) {
  if (typeof value !== 'string' || value.includes("'") || /[\r\n]/.test(value)) {
    throw new Error('collector_l4_toml_literal_invalid');
  }
  return `'${value}'`;
}

export function tomlStringArray(values) {
  return `[${values.map(tomlLiteral).join(',')}]`;
}

export function runProcess(command, args, options) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let outputLimitExceeded = false;
    let settled = false;
    const maximumOutputBytes = options.maximumOutputBytes ?? 8 * 1024 * 1024;
    const append = (current, chunk) => {
      const next = current + String(chunk);
      if (Buffer.byteLength(next, 'utf8') > maximumOutputBytes) {
        outputLimitExceeded = true;
        child.kill('SIGTERM');
      }
      return next;
    };
    child.stdout.on('data', (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on('data', (chunk) => { stderr = append(stderr, chunk); });
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rejectRun(error);
    });
    child.once('exit', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveRun({ code, signal, stdout, stderr, timedOut, outputLimitExceeded });
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, options.timeoutMs);
  });
}

function runNpm(args, cwd) {
  const command = process.env.npm_execpath
    ? process.execPath
    : process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const commandArgs = process.env.npm_execpath ? [process.env.npm_execpath, ...args] : args;
  return runProcess(command, commandArgs, { cwd, timeoutMs: 120_000, maximumOutputBytes: 2 * 1024 * 1024 });
}

async function requireSuccessfulProcess(processPromise, code) {
  const result = await processPromise;
  if (result.code !== 0 || result.timedOut || result.outputLimitExceeded) throw new Error(code);
  return result;
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
