#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readInstallation, run, atomicJson } from './installation.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_REPOSITORY = 'https://github.com/Hela-Ecosystem/hela-mcp-ecosystem.git';
const DEFAULT_SOURCE = 'https://raw.githubusercontent.com/Hela-Ecosystem/hela-mcp-ecosystem/master';
const CHECK_TIMEOUT_MS = 15000;

function usage() {
  return `Usage: node scripts/update-controller.mjs [apply|check|auto-check] [OPTIONS]
  --prefix PATH          Managed installation prefix
  --profile ID           Require this installed profile
  --source-url URL       Raw metadata base URL (HTTPS only)
  --repository URL       Metadata repository URL (HTTPS or file URL)
  --interval-hours N     Automatic check interval, 1-168 hours (default 24)
  --confirm              Confirm a mutating apply operation
  --json                 Emit machine-readable output
  --quiet                Suppress normal check output
  --help                 Show this help

Commands:
  check                  Compare the installation with latest-stable without changing it
  apply --confirm        Update the managed installation and verify it with doctor
  auto-check enable      Install an opt-in check-only scheduler
  auto-check disable     Remove the scheduler
  auto-check status      Show scheduler state`;
}

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const args = [...argv];
  let command = 'apply';
  if (args[0] && !args[0].startsWith('--')) command = args.shift();
  const options = {
    command,
    prefix: null,
    profile: null,
    sourceUrl: process.env.HELA_UPDATE_SOURCE_URL || DEFAULT_SOURCE,
    repository: process.env.HELA_UPDATE_REPOSITORY || DEFAULT_REPOSITORY,
    intervalHours: 24,
    confirm: false,
    json: false,
    quiet: false,
    help: false,
    autoAction: null,
  };
  if (command === 'auto-check') options.autoAction = args.shift() || 'status';
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--confirm' || arg === '--yes') options.confirm = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--quiet') options.quiet = true;
    else if (['--prefix', '--profile', '--source-url', '--repository', '--interval-hours'].includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) fail(`Missing value for ${arg}`);
      if (arg === '--prefix') options.prefix = value;
      if (arg === '--profile') options.profile = value;
      if (arg === '--source-url') options.sourceUrl = value;
      if (arg === '--repository') options.repository = value;
      if (arg === '--interval-hours') options.intervalHours = Number(value);
    } else fail(`Unknown option: ${arg}`);
  }
  if (!['apply', 'check', 'auto-check'].includes(options.command)) fail(`Unknown update command: ${options.command}`);
  if (options.command === 'auto-check' && !['enable', 'disable', 'status'].includes(options.autoAction)) {
    fail(`Unknown auto-check action: ${options.autoAction}`);
  }
  if (!Number.isInteger(options.intervalHours) || options.intervalHours < 1 || options.intervalHours > 168) {
    fail('--interval-hours must be an integer from 1 to 168');
  }
  return options;
}

function defaultPrefix() {
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'hela', 'installations', 'minimal-individual');
}

function resolvePrefix(options) {
  const prefix = path.resolve(options.prefix || process.env.HELA_INSTALL_PREFIX || defaultPrefix());
  if (!fs.existsSync(path.join(prefix, '.hela-install.json'))) fail(`Managed installation not found: ${prefix}`);
  return prefix;
}

function assertUrl(value, label, { allowFile = false } = {}) {
  let url;
  try { url = new URL(value); } catch { fail(`${label} must be a valid URL`); }
  if (url.protocol !== 'https:' && !(allowFile && url.protocol === 'file:')) fail(`${label} must use HTTPS`);
  if (url.username || url.password) fail(`${label} must not contain credentials`);
  return url;
}

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || typeof snapshot.snapshot_version !== 'string'
    || !snapshot.servers || typeof snapshot.servers !== 'object') fail('Remote snapshot metadata is invalid');
  for (const [id, server] of Object.entries(snapshot.servers)) {
    if (!server || typeof server !== 'object' || !/^[a-f0-9]{40}$/.test(server.commit)
      || typeof server.serverVersion !== 'string' || !server.repo) fail(`Invalid snapshot pin: ${id}`);
    assertUrl(server.repo, `Snapshot repository for ${id}`, { allowFile: true });
  }
  return snapshot;
}

export function compareRelease(manifest, latest) {
  const installed = new Map((manifest.servers || []).map((server) => [server.id, server]));
  const changes = [];
  for (const [id, remote] of Object.entries(latest.snapshot.servers)) {
    const local = installed.get(id);
    if (!local) changes.push({ id, kind: 'added', from: null, to: remote.serverVersion, revision: remote.commit });
    else if (local.revision !== remote.commit || local.version !== remote.serverVersion) {
      changes.push({ id, kind: 'updated', from: { version: local.version, revision: local.revision }, to: { version: remote.serverVersion, revision: remote.commit } });
    }
  }
  for (const local of manifest.servers || []) {
    if (!latest.snapshot.servers[local.id]) changes.push({ id: local.id, kind: 'removed', from: local.version, to: null });
  }
  return {
    available: manifest.snapshot !== latest.snapshot.snapshot_version || changes.length > 0,
    installedSnapshot: manifest.snapshot,
    latestSnapshot: latest.snapshot.snapshot_version,
    installedProfile: manifest.profile,
    latestEcosystemVersion: latest.package.version,
    changes,
  };
}

async function fetchJson(url, timeoutMs = CHECK_TIMEOUT_MS) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`metadata request failed with HTTP ${response.status}`);
  return response.json();
}

export async function fetchLatest(sourceUrl = DEFAULT_SOURCE) {
  const base = assertUrl(sourceUrl, 'source URL');
  const packageUrl = new URL('package.json', base.href.endsWith('/') ? base.href : `${base.href}/`);
  const snapshotUrl = new URL('config/snapshots/latest-stable.json', packageUrl);
  const [pkg, snapshot] = await Promise.all([fetchJson(packageUrl.href), fetchJson(snapshotUrl.href)]);
  if (!pkg || typeof pkg.version !== 'string') fail('Remote package metadata is invalid');
  return { package: { version: pkg.version }, snapshot: validateSnapshot(snapshot), source: base.href };
}

function cachePath(prefix) { return path.join(prefix, '.hela-update-check.json'); }

function writeCheckCache(prefix, result) {
  atomicJson(cachePath(prefix), { checkedAt: new Date().toISOString(), ...result });
}

export async function checkInstallationForUpdate(options) {
  const prefix = resolvePrefix(options);
  const manifest = readInstallation(prefix);
  if (options.profile && options.profile !== manifest.profile) fail(`Installed profile is ${manifest.profile}, not ${options.profile}`);
  let latest;
  try {
    latest = await fetchLatest(options.sourceUrl);
  } catch (error) {
    const cached = fs.existsSync(cachePath(prefix)) ? JSON.parse(fs.readFileSync(cachePath(prefix), 'utf8')) : null;
    return { ok: false, status: 'unknown', prefix, error: error instanceof Error ? error.message : String(error), cached };
  }
  const comparison = compareRelease(manifest, latest);
  const result = { ok: true, status: comparison.available ? 'update-available' : 'current', prefix, ...comparison, source: latest.source };
  writeCheckCache(prefix, result);
  return result;
}

function updateId(prefix) {
  return `hela-update-${createHash('sha256').update(prefix).digest('hex').slice(0, 12)}`;
}

function shellQuote(value) { return `'${String(value).replaceAll("'", "'\\''")}'`; }
function windowsQuote(value) { return `"${String(value).replaceAll('"', '\\"')}"`; }

function schedulePaths(prefix) {
  const id = updateId(prefix);
  if (process.platform === 'linux') {
    const dir = path.join(os.homedir(), '.config', 'systemd', 'user');
    return { id, dir, service: path.join(dir, `${id}.service`), timer: path.join(dir, `${id}.timer`) };
  }
  if (process.platform === 'darwin') {
    const dir = path.join(os.homedir(), 'Library', 'LaunchAgents');
    return { id, dir, plist: path.join(dir, `${id}.plist`) };
  }
  return { id };
}

function writeSystemdSchedule(prefix, intervalHours) {
  const paths = schedulePaths(prefix);
  const installedScript = path.join(prefix, 'hela-mcp-ecosystem', 'scripts', 'update-controller.mjs');
  const script = fs.existsSync(installedScript) ? installedScript : path.join(ROOT, 'scripts', 'update-controller.mjs');
  fs.mkdirSync(paths.dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(paths.service, `[Unit]\nDescription=HeLa update check\n\n[Service]\nType=oneshot\nExecStart=${shellQuote(process.execPath)} ${shellQuote(script)} check --prefix ${shellQuote(prefix)} --quiet\n`, { mode: 0o600 });
  fs.writeFileSync(paths.timer, `[Unit]\nDescription=Check HeLa for updates\n\n[Timer]\nOnBootSec=15min\nOnUnitActiveSec=${intervalHours}h\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n`, { mode: 0o600 });
  const daemon = spawnSync('systemctl', ['--user', 'daemon-reload'], { encoding: 'utf8' });
  const enable = spawnSync('systemctl', ['--user', 'enable', '--now', path.basename(paths.timer)], { encoding: 'utf8' });
  if (daemon.status !== 0 || enable.status !== 0) fail(`systemd user timer could not be enabled: ${(enable.stderr || daemon.stderr || '').trim()}`);
  return { platform: 'systemd', ...paths, intervalHours };
}

function writeLaunchdSchedule(prefix, intervalHours) {
  const paths = schedulePaths(prefix);
  const installedScript = path.join(prefix, 'hela-mcp-ecosystem', 'scripts', 'update-controller.mjs');
  const script = fs.existsSync(installedScript) ? installedScript : path.join(ROOT, 'scripts', 'update-controller.mjs');
  fs.mkdirSync(paths.dir, { recursive: true, mode: 0o700 });
  const plist = {
    Label: paths.id,
    ProgramArguments: [process.execPath, script, 'check', '--prefix', prefix, '--quiet'],
    StartInterval: intervalHours * 3600,
    RunAtLoad: false,
    StandardOutPath: path.join(prefix, 'update-check.log'),
    StandardErrorPath: path.join(prefix, 'update-check.log'),
  };
  const xml = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>${Object.entries(plist).map(([key, value]) => {
    if (Array.isArray(value)) return `<key>${key}</key><array>${value.map((item) => `<string>${String(item).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</string>`).join('')}</array>`;
    if (typeof value === 'boolean') return `<key>${key}</key><${value ? 'true' : 'false'}/>`;
    if (typeof value === 'number') return `<key>${key}</key><integer>${value}</integer>`;
    return `<key>${key}</key><string>${String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</string>`;
  }).join('')}</dict></plist>\n`;
  fs.writeFileSync(paths.plist, xml, { mode: 0o600 });
  const domain = `gui/${process.getuid?.() ?? ''}`;
  const loaded = spawnSync('launchctl', ['bootstrap', domain, paths.plist], { encoding: 'utf8' });
  if (loaded.status !== 0) fail(`launchd job could not be loaded: ${(loaded.stderr || '').trim()}`);
  return { platform: 'launchd', ...paths, intervalHours };
}

function writeTaskSchedule(prefix, intervalHours) {
  const paths = schedulePaths(prefix);
  const script = path.join(ROOT, 'scripts', 'update-controller.mjs');
  const task = `${paths.id}`;
  const command = `${windowsQuote(process.execPath)} ${windowsQuote(script)} check --prefix ${windowsQuote(prefix)} --quiet`;
  const result = spawnSync('schtasks.exe', ['/Create', '/SC', 'HOURLY', '/MO', String(intervalHours), '/TN', task, '/TR', command, '/F'], { encoding: 'utf8' });
  if (result.status !== 0) fail(`Task Scheduler job could not be created: ${(result.stderr || result.stdout || '').trim()}`);
  return { platform: 'task-scheduler', id: task, intervalHours };
}

function enableSchedule(prefix, intervalHours) {
  let schedule;
  if (process.platform === 'linux') schedule = writeSystemdSchedule(prefix, intervalHours);
  else if (process.platform === 'darwin') schedule = writeLaunchdSchedule(prefix, intervalHours);
  else if (process.platform === 'win32') schedule = writeTaskSchedule(prefix, intervalHours);
  else fail(`Automatic update checks are unsupported on ${process.platform}`);
  const config = { managedBy: 'hela-update-controller', format: 1, enabled: true, intervalHours, platform: schedule.platform, updatedAt: new Date().toISOString(), schedule };
  atomicJson(path.join(prefix, '.hela-update-config.json'), config);
  return config;
}

function disableSchedule(prefix) {
  const paths = schedulePaths(prefix);
  if (process.platform === 'linux') {
    spawnSync('systemctl', ['--user', 'disable', '--now', path.basename(paths.timer)], { encoding: 'utf8' });
    for (const file of [paths.service, paths.timer]) if (fs.existsSync(file)) fs.unlinkSync(file);
  } else if (process.platform === 'darwin') {
    spawnSync('launchctl', ['bootout', `gui/${process.getuid?.() ?? ''}`, paths.plist], { encoding: 'utf8' });
    if (fs.existsSync(paths.plist)) fs.unlinkSync(paths.plist);
  } else if (process.platform === 'win32') {
    spawnSync('schtasks.exe', ['/Delete', '/TN', paths.id, '/F'], { encoding: 'utf8' });
  }
  const config = path.join(prefix, '.hela-update-config.json');
  if (fs.existsSync(config)) fs.unlinkSync(config);
  return { enabled: false, prefix };
}

function schedulerStatus(prefix) {
  const config = path.join(prefix, '.hela-update-config.json');
  if (!fs.existsSync(config)) return { enabled: false, prefix };
  return JSON.parse(fs.readFileSync(config, 'utf8'));
}

function backupPath(prefix) {
  const dir = path.join(prefix, '.hela-update', `rollback-${new Date().toISOString().replaceAll(':', '-')}`);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function restoreSources(prefix, manifest) {
  if (manifest.mode.startsWith('docker')) return;
  for (const server of manifest.servers) {
    const repository = path.join(prefix, server.dir.split(/[\\/]/)[0]);
    const directory = path.join(prefix, server.dir);
    try {
      run('git', ['checkout', '--detach', server.revision], { cwd: repository, stdio: 'inherit' });
    } catch {
      run('git', ['fetch', '--quiet', 'origin', server.revision], { cwd: repository, stdio: 'inherit' });
      run('git', ['checkout', '--detach', server.revision], { cwd: repository, stdio: 'inherit' });
    }
    const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--no-audit', '--no-fund'], { cwd: directory, stdio: 'inherit' });
    if (pkg.scripts?.build) run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: directory, stdio: 'inherit' });
  }
}

async function applyUpdate(options) {
  if (!options.confirm) fail('Applying an update changes installed source and dependencies; pass --confirm after reviewing update check');
  assertUrl(options.repository, 'repository', { allowFile: true });
  const prefix = resolvePrefix(options);
  const manifest = readInstallation(prefix);
  if (options.profile && options.profile !== manifest.profile) fail(`Installed profile is ${manifest.profile}, not ${options.profile}`);
  const latest = await fetchLatest(options.sourceUrl);
  const comparison = compareRelease(manifest, latest);
  if (!comparison.available) return { ok: true, status: 'current', prefix, ...comparison };
  const backup = backupPath(prefix);
  const manifestFile = path.join(prefix, '.hela-install.json');
  fs.copyFileSync(manifestFile, path.join(backup, 'manifest.json'));
  fs.cpSync(path.join(prefix, 'hela-mcp-ecosystem'), path.join(backup, 'ecosystem'), { recursive: true });
  const composeFile = path.join(prefix, 'compose.json');
  if (fs.existsSync(composeFile)) fs.copyFileSync(composeFile, path.join(backup, 'compose.json'));
  atomicJson(path.join(backup, 'release.json'), { source: latest.source, package: latest.package, snapshot: latest.snapshot, comparison });
  const metadata = fs.mkdtempSync(path.join(os.tmpdir(), 'hela-update-source-'));
  const pending = path.join(prefix, '.hela-update.pending.json');
  try {
    run('git', ['clone', '--quiet', '--filter=blob:none', '--depth', '1', '--branch', 'master', options.repository, metadata], { stdio: ['ignore', 'inherit', 'inherit'] });
    const args = [path.join(metadata, 'setup.mjs'), '--mode', manifest.mode, '--profile', manifest.profile, '--prefix', prefix,
      '--root', metadata, '--snapshot', 'latest-stable', '--client', 'skip', '--transport', manifest.transport ?? 'stdio',
      '--port', String(manifest.port ?? 8080), '--workspace', manifest.workspace, '--non-interactive'];
    if (manifest.withoutModel) args.push('--without-model');
    if (manifest.image) args.push('--image', manifest.image);
    atomicJson(pending, { managedBy: 'hela-update-controller', format: 1, status: 'applying', startedAt: new Date().toISOString(), backup });
    run(process.execPath, args, { stdio: 'inherit', timeout: 3600000 });
    if (fs.existsSync(pending)) fs.unlinkSync(pending);
    return { ok: true, status: 'updated', prefix, backup, ...compareRelease(readInstallation(prefix), latest), restartRequired: true };
  } catch (error) {
    try {
      restoreSources(prefix, manifest);
      const ecosystemRoot = path.join(prefix, 'hela-mcp-ecosystem');
      fs.rmSync(ecosystemRoot, { recursive: true, force: true });
      fs.cpSync(path.join(backup, 'ecosystem'), ecosystemRoot, { recursive: true });
      if (fs.existsSync(path.join(backup, 'compose.json'))) fs.copyFileSync(path.join(backup, 'compose.json'), composeFile);
      else if (fs.existsSync(composeFile)) fs.unlinkSync(composeFile);
      atomicJson(manifestFile, manifest);
      if (fs.existsSync(pending)) fs.unlinkSync(pending);
      return { ok: false, status: 'rolled-back', prefix, backup, error: error instanceof Error ? error.message : String(error) };
    } catch (rollbackError) {
      atomicJson(pending, { managedBy: 'hela-update-controller', format: 1, status: 'rollback-failed', backup,
        error: error instanceof Error ? error.message : String(error), rollbackError: rollbackError instanceof Error ? rollbackError.message : String(rollbackError) });
      throw new Error(`Update failed and rollback failed; installation requires recovery from ${backup}`);
    }
  } finally {
    fs.rmSync(metadata, { recursive: true, force: true });
  }
}

function output(result, options) {
  // The runtime update tools read the last non-empty stdout line as JSON.
  // Emit one compact document so extra installer output cannot hide it.
  if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
  else if (!options.quiet || result.status === 'update-available' || result.status === 'updated' || result.status === 'rolled-back') {
    if (result.status === 'update-available') console.log(`Update available: ${result.installedSnapshot} -> ${result.latestSnapshot} (${result.changes.length} cell change(s))`);
    else if (result.status === 'current') console.log(`HeLa is current at snapshot ${result.installedSnapshot}`);
    else if (result.status === 'updated') console.log(`HeLa updated to ${result.latestSnapshot}; restart the runtime/client to load the new build`);
    else console.log(JSON.stringify(result, null, 2));
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { console.log(usage()); return; }
  if (options.command === 'check') {
    const result = await checkInstallationForUpdate(options);
    output(result, options);
    if (!result.ok && !result.cached) process.exitCode = 2;
    return;
  }
  const prefix = resolvePrefix(options);
  if (options.command === 'auto-check') {
    const result = options.autoAction === 'enable' ? enableSchedule(prefix, options.intervalHours)
      : options.autoAction === 'disable' ? disableSchedule(prefix) : schedulerStatus(prefix);
    output(result, options);
    return;
  }
  const result = await applyUpdate(options);
  output(result, options);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => {
  console.error(`[hela-update] ERROR: ${error.message}`);
  process.exitCode = 1;
});
