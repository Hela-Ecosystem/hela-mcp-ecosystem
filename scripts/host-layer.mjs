#!/usr/bin/env node
/**
 * HeLa MCP Ecosystem — host-layer diagnostics (the layer doctor.mjs does not cover)
 *
 * `doctor.mjs` inspects the *installation*: builds, revisions, snapshots, isolated
 * probes, optional runtimes. This module inspects the *host wiring* between the
 * client applications and the runtime:
 *
 *   1. interpreter: version floor derived from cell engines, apt-mark state,
 *      the gate file the launcher reads, PATH shadowing
 *   2. credentials: file/dir modes, required keys, blank values
 *   3. launcher: present, executable, single entry point
 *   4. hosts: all client configs point at the launcher, carry no secrets, are
 *      enabled, and reference binaries that exist
 *   5. backups: credential-bearing or world-readable *.bak* files
 *   6. live: launcher -> runtime -> initialize/tools/list
 *
 * Invoked as `doctor.mjs --hosts`. Exit codes: 0 healthy, 1 failures, 2 internal.
 * Never prints a credential value — only key names, counts and file modes.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const HOME = process.env.HOME || os.homedir();
const PREFIX = path.resolve(process.env.HELA_PREFIX || path.join(HOME, '.local/share/hela/installations/all-runtime'));
const MANIFEST = path.join(PREFIX, '.hela-install.json');
const SECRETS = process.env.HELA_SECRETS_FILE || path.join(HOME, '.config/hela/mcp.env');
const LAUNCHER = path.join(HOME, '.local/bin/hela-runtime-mcp');
const STATE = path.join(HOME, '.local/state/hela');
const NODE_PIN = path.join(STATE, 'node-pin');
const GATE = path.join(STATE, 'node-min-major');
const SECRET_MARKERS = ['TOKEN', 'API_KEY', 'CSE_ID', 'SECRET', 'PASSWORD'];

const HOSTS = {
  opencode: { file: path.join(HOME, '.config/opencode/opencode.json'), select: [['mcp', 'hela-runtime'], ['mcp', 'servers', 'hela-runtime']] },
  claude: { file: path.join(HOME, '.claude.json'), select: ['mcpServers', 'hela-runtime'] },
  gemini: { file: path.join(HOME, '.gemini/settings.json'), select: ['mcpServers', 'hela-runtime'] },
  'gemini-config': { file: path.join(HOME, '.gemini/config/mcp_config.json'), select: ['mcpServers', 'hela-runtime'] },
  copilot: { file: path.join(HOME, '.copilot/mcp-config.json'), select: ['mcpServers', 'hela-runtime'] },
  codex: { file: path.join(HOME, '.codex/config.toml'), select: ['mcp_servers', 'hela-runtime'] },
};

const OK = 'OK';
const WARN = 'WARN';
const FAIL = 'FAIL';

const results = [];
const record = (status, check, detail, fix = '') => results.push({ status, check, detail, fix });

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  } catch {
    return null;
  }
}

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match) env[match[1]] = match[2].trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
  }
  return env;
}

const credentialValues = (env) => Object.entries(env)
  .filter(([key, value]) => SECRET_MARKERS.some(marker => key.includes(marker)) && value.length > 8)
  .map(([, value]) => value);

function nodeVersion() {
  const out = spawnSync('node', ['-v'], { encoding: 'utf8' });
  const match = out.status === 0 ? /^v(\d+)\.(\d+)\.(\d+)/.exec(out.stdout.trim()) : null;
  return match ? { raw: out.stdout.trim(), major: Number(match[1]) } : null;
}

function requiredMajor(manifest) {
  let floor = 0;
  let owner = 'no declared floor';
  for (const cell of manifest?.servers ?? []) {
    try {
      const spec = JSON.parse(fs.readFileSync(path.join(PREFIX, cell.dir, 'package.json'), 'utf8')).engines?.node;
      const major = Number(/(\d+)/.exec(spec ?? '')?.[1] ?? 0);
      if (major > floor) {
        floor = major;
        owner = cell.id;
      }
    } catch { /* cell without a readable manifest */ }
  }
  return { floor: Math.max(floor, 18), owner };
}

function checkInterpreter(manifest) {
  const { floor, owner } = requiredMajor(manifest);
  const version = nodeVersion();
  if (!version) {
    record(FAIL, 'node', 'node not resolvable on PATH', `install nodejs >= ${floor}`);
  } else if (version.major < floor) {
    record(FAIL, 'node', `${version.raw} below requirement >=${floor} (set by ${owner})`, 'install a newer nodejs');
  } else {
    record(OK, 'node', `${version.raw} satisfies >=${floor} (set by ${owner})`);
  }

  const auto = spawnSync('apt-mark', ['showauto'], { encoding: 'utf8' });
  if (auto.status === 0) {
    if (auto.stdout.split(/\s+/).includes('nodejs')) {
      record(FAIL, 'node-mark', 'nodejs is marked auto; autoremove can purge it', 'sudo apt-mark manual nodejs');
    } else {
      record(OK, 'node-mark', 'nodejs marked manual (survives autoremove)');
    }
  }

  const expected = `${floor}\n`;
  try {
    fs.mkdirSync(STATE, { recursive: true });
    const previous = fs.existsSync(GATE) ? fs.readFileSync(GATE, 'utf8') : null;
    if (previous !== expected) {
      fs.writeFileSync(GATE, expected);
      if (previous && previous.trim() !== String(floor)) {
        record(WARN, 'node-floor', `launcher gate was ${previous.trim()}, manifest requires ${floor}`, 'corrected; a stale gate locks out every host');
      } else {
        record(OK, 'node-floor', `launcher gate = ${floor}`);
      }
    } else {
      record(OK, 'node-floor', `launcher gate = ${floor}`);
    }
  } catch (error) {
    record(WARN, 'node-floor', `cannot publish gate (${error.code ?? error.message})`, 'launcher falls back to 22');
  }

  if (version && version.major >= floor) {
    const pkg = spawnSync('dpkg-query', ['-W', '-f=${Version}', 'nodejs'], { encoding: 'utf8' });
    const pin = pkg.status === 0 ? pkg.stdout.trim() : '';
    if (pin) {
      try {
        fs.mkdirSync(path.dirname(NODE_PIN), { recursive: true });
        if (!fs.existsSync(NODE_PIN) || fs.readFileSync(NODE_PIN, 'utf8').trim() !== pin) {
          fs.writeFileSync(NODE_PIN, `${pin}\n`);
        }
      } catch { /* pin is an optimisation, not a requirement */ }
    }
  }
  return { floor };
}

function checkCredentials() {
  if (!fs.existsSync(SECRETS)) {
    record(FAIL, 'env-file', `missing ${SECRETS}`, 'recreate from the vault (hela-* entries)');
    return {};
  }
  const mode = fs.statSync(SECRETS).mode & 0o777;
  if (mode === 0o600) record(OK, 'env-file', `${path.basename(SECRETS)} mode 0600`);
  else record(FAIL, 'env-file', `mode 0${mode.toString(8)} exposes credentials`, 'chmod 600');

  const dirMode = fs.statSync(path.dirname(SECRETS)).mode & 0o777;
  if (dirMode & 0o077) record(WARN, 'env-dir', `${path.basename(path.dirname(SECRETS))} mode 0${dirMode.toString(8)}`, 'chmod 700');

  const env = parseEnvFile(SECRETS);
  const credentials = Object.keys(env).filter(key => SECRET_MARKERS.some(marker => key.includes(marker)));
  const blank = credentials.filter(key => env[key].length <= 8);
  const missing = ['HELA_PROFILE', 'HELA_ECOSYSTEM_ROOT', 'HELA_ALLOWED_ROOTS'].filter(key => !(key in env));
  if (missing.length) {
    record(WARN, 'env-keys', `missing ${missing.join(', ')}; runtime uses defaults`, 'restore from the vault');
  } else if (credentials.length) {
    record(OK, 'env-keys', `${Object.keys(env).length} keys, ${credentials.length} credential-bearing`);
  }
  if (blank.length) {
    record(FAIL, 'env-credentials', `blank or truncated: ${blank.join(', ')}`, 'restore the value; a provider 401 starts here');
  }
  return env;
}

function checkLauncher() {
  if (!fs.existsSync(LAUNCHER)) {
    record(FAIL, 'launcher', `missing ${LAUNCHER}`, 'install scripts/host-entry.sh');
    return;
  }
  try {
    fs.accessSync(LAUNCHER, fs.constants.X_OK);
    record(OK, 'launcher', path.relative(HOME, LAUNCHER));
  } catch {
    record(FAIL, 'launcher', 'not executable', 'chmod +x');
  }
}

function loadHost({ file, select }) {
  if (!fs.existsSync(file)) return null;
  try {
    if (file.endsWith('.toml')) {
      // Node has no TOML parser on every supported release; the section this
      // check needs is narrow, so extract it textually.
      const text = fs.readFileSync(file, 'utf8');
      const match = /\[mcp_servers\.hela-runtime\]\n([\s\S]*?)(?=\n\[|$)/.exec(text);
      return match ? { _raw: match[1] } : {};
    }
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    // `select` is one path, or a list of candidate paths (opencode has shipped both layouts).
    const paths = Array.isArray(select[0]) ? select : [select];
    for (const candidate of paths) {
      const entry = candidate.reduce((node, key) => node?.[key], parsed);
      if (entry !== undefined) return entry;
    }
    return {};
  } catch {
    return {};
  }
}

function checkHosts(env) {
  const values = credentialValues(env);
  const drift = [];
  const leaking = [];
  const missing = [];
  for (const [name, spec] of Object.entries(HOSTS)) {
    const entry = loadHost(spec);
    if (entry === null) { missing.push(name); continue; }
    if (!Object.keys(entry).length) { drift.push(`${name} (unparsable)`); continue; }

    let command = entry.command;
    if (Array.isArray(command)) command = command[0] ?? '';
    const isToml = spec.file.endsWith('.toml');
    const commandOk = isToml
      ? new RegExp(`command\\s*=\\s*"${LAUNCHER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(entry._raw ?? '')
      : command === LAUNCHER;
    if (!commandOk) drift.push(`${name} -> ${command || 'not the launcher'}`);
    if (!isToml && (entry.disabled === true || entry.enabled === false)) drift.push(`${name} (disabled)`);

    try {
      const text = fs.readFileSync(spec.file, 'utf8');
      if (values.some(value => text.includes(value))) leaking.push(name);
      const mode = fs.statSync(spec.file).mode & 0o777;
      if (mode & 0o077) record(WARN, `host-mode:${name}`, `mode 0${mode.toString(8)}`, 'chmod 600');
    } catch { /* unreadable config is already reported above */ }
  }

  if (drift.length) record(FAIL, 'hosts', `${drift.length} not on the launcher: ${drift.join('; ')}`, 'point command at hela-runtime-mcp');
  else record(OK, 'hosts', `${Object.keys(HOSTS).length - missing.length} configured via launcher`);
  if (leaking.length) record(FAIL, 'host-secrets', `plaintext credentials in: ${leaking.join(', ')}`, 'keep them in mcp.env / the vault');
  if (missing.length) record(WARN, 'host-missing', missing.join(', '), 'client not installed; ignore if unused');
}

function checkHostBinaries() {
  const broken = [];
  let checked = 0;
  for (const [name, spec] of Object.entries(HOSTS)) {
    if (!fs.existsSync(spec.file)) continue;
    if (spec.file.endsWith('.toml')) continue;
    let servers;
    try {
      const data = JSON.parse(fs.readFileSync(spec.file, 'utf8'));
      servers = data.mcpServers ?? data.mcp?.servers ?? {};
    } catch { continue; }
    for (const [server, entry] of Object.entries(servers)) {
      if (server === 'hela-runtime' || typeof entry !== 'object' || !entry?.command) continue;
      const command = Array.isArray(entry.command) ? entry.command[0] : entry.command;
      if (!command) continue;
      checked += 1;
      const exists = command.startsWith('/') ? fs.existsSync(command) : spawnSync('sh', ['-c', `command -v "${command}"`]).status === 0;
      if (!exists) broken.push(`${name}:${server} -> ${command}`);
    }
  }
  if (broken.length) record(WARN, 'host-binaries', `missing: ${broken.join('; ')}`, 'reinstall the owning app or drop the server');
  else if (checked) record(OK, 'host-binaries', `${checked} other MCP server(s) resolve`);
}

function checkBackups(env) {
  const values = credentialValues(env);
  if (!values.length) return;
  const dirs = [...new Set(Object.values(HOSTS).map(spec => path.dirname(spec.file)))];
  const exposed = [];
  const holders = [];
  const large = [];
  const seen = new Set();
  for (const dir of dirs) {
    let names;
    try { names = fs.readdirSync(dir).filter(name => name.includes('.bak')); } catch { continue; }
    for (const name of names) {
      const file = path.join(dir, name);
      if (seen.has(file)) continue;
      seen.add(file);
      let stat;
      try { stat = fs.statSync(file); } catch { continue; }
      if (!stat.isFile()) continue;
      const permissive = Boolean(stat.mode & 0o077);
      if (stat.size > 2_000_000) {
        if (permissive) large.push(`${name} (${Math.round(stat.size / 1_000_000)} MB)`);
        continue;
      }
      let text;
      try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
      if (!values.some(value => text.includes(value))) continue;
      holders.push(name);
      if (permissive) exposed.push(name);
    }
  }
  if (exposed.length) record(FAIL, 'backups', `${exposed.length} credential backups readable by others`, 'chmod 600 or delete');
  else if (holders.length) record(WARN, 'backups', `${holders.length} backups still hold credentials`, 'delete after vaulting');
  else record(OK, 'backups', 'no credential-bearing backups');
  if (large.length) record(WARN, 'backups-large', `world-readable, unscanned: ${large.slice(0, 4).join(', ')}`, '--repair chmods these to 600');
}

function checkLive(timeoutSeconds, declared, namespaced) {
  return new Promise(resolve => {
    if (!fs.existsSync(LAUNCHER)) return resolve(null);
    const child = spawn(LAUNCHER, [], { stdio: ['pipe', 'pipe', 'ignore'], detached: true });
    const started = Date.now();
    let buffer = '';
    let settled = false;
    const finish = (count, error) => {
      if (settled) return;
      settled = true;
      try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill(); } catch { /* already gone */ } }
      const seconds = (Date.now() - started) / 1000;
      if (error) record(FAIL, 'live', `handshake error after ${seconds.toFixed(1)}s: ${error}`, 'run hela-runtime-mcp manually to see stderr');
      else if (count === null) record(FAIL, 'live', `no tools/list response within ${timeoutSeconds}s`, 'inspect the launcher log');
      else if (count === 0) record(FAIL, 'live', 'connected but exposed 0 tools', 'check HELA_PROFILE and the manifest');
      else if (declared && !namespaced && count < declared) {
        record(WARN, 'live', `${count} tools in ${seconds.toFixed(1)}s; ${declared - count} declared tools shadowed by bare-name collisions`, 'set HELA_NAMESPACE_TOOLS=1 to expose all of them');
      } else {
        record(OK, 'live', `${count} tools in ${seconds.toFixed(1)}s`);
      }
      resolve(count);
    };

    const timer = setTimeout(() => finish(null, null), timeoutSeconds * 1000);
    timer.unref?.();
    child.stdout.on('data', chunk => {
      buffer += chunk.toString();
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        let message;
        try { message = JSON.parse(line); } catch { continue; }
        if (message.id === 2) {
          clearTimeout(timer);
          if (message.error) finish(null, JSON.stringify(message.error).slice(0, 160));
          else finish(message.result?.tools?.length ?? 0, null);
        }
      }
    });
    child.on('error', error => { clearTimeout(timer); finish(null, error.message); });
    child.on('exit', () => { clearTimeout(timer); finish(null, 'launcher exited before responding'); });
    child.stdin.write([
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'hela-doctor', version: '1' } } }),
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    ].join('\n') + '\n');
  });
}

function sudo(args, timeout = 600_000) {
  return spawnSync('/usr/bin/sudo', args, { encoding: 'utf8', timeout });
}

function repair(env, floor) {
  const actions = [];
  const version = nodeVersion();
  if (!version || version.major < floor) {
    if (sudo(['-n', 'true']).status !== 0) {
      actions.push('skipped node repair: passwordless sudo unavailable');
    } else {
      const pinned = fs.existsSync(NODE_PIN) ? fs.readFileSync(NODE_PIN, 'utf8').trim() : '';
      const specs = [...(pinned ? [`nodejs=${pinned.replace(/^v/, '')}`] : []), 'nodejs'];
      let last = '';
      for (const spec of specs) {
        const out = sudo(['apt-get', 'install', '-y', '--allow-downgrades', spec]);
        if (out.status === 0) {
          sudo(['apt-mark', 'manual', 'nodejs'], 60_000);
          actions.push(`reinstalled ${spec}`);
          break;
        }
        last = (out.stderr || '').trim().split('\n').pop() ?? 'unknown error';
      }
      if (!actions.length) actions.push(`node repair failed: ${last}`);
    }
  } else if (sudo(['-n', 'true']).status === 0) {
    const auto = spawnSync('apt-mark', ['showauto'], { encoding: 'utf8' });
    if (auto.status === 0 && auto.stdout.split(/\s+/).includes('nodejs')) {
      if (sudo(['apt-mark', 'manual', 'nodejs'], 60_000).status === 0) actions.push('re-marked nodejs manual');
    }
  }

  try {
    if ((fs.statSync(SECRETS).mode & 0o777) !== 0o600) {
      fs.chmodSync(SECRETS, 0o600);
      actions.push(`chmod 600 ${path.basename(SECRETS)}`);
    }
    const dir = path.dirname(SECRETS);
    if (fs.statSync(dir).mode & 0o077) {
      fs.chmodSync(dir, 0o700);
      actions.push(`chmod 700 ${path.basename(dir)}`);
    }
  } catch { /* secrets file may be absent; reported by the checks */ }

  const values = credentialValues(env);
  let fixed = 0;
  const dirs = [...new Set(Object.values(HOSTS).map(spec => path.dirname(spec.file)))];
  for (const dir of dirs) {
    let names;
    try { names = fs.readdirSync(dir).filter(name => name.includes('.bak')); } catch { continue; }
    for (const name of names) {
      const file = path.join(dir, name);
      let stat;
      try { stat = fs.statSync(file); } catch { continue; }
      if (!stat.isFile() || !(stat.mode & 0o077)) continue;
      if (stat.size > 2_000_000) {
        try { fs.chmodSync(file, 0o600); fixed += 1; } catch { /* ignore */ }
        continue;
      }
      try {
        if (values.some(value => fs.readFileSync(file, 'utf8').includes(value))) {
          fs.chmodSync(file, 0o600);
          fixed += 1;
        }
      } catch { /* ignore */ }
    }
  }
  if (fixed) actions.push(`chmod 600 on ${fixed} credential backups`);
  return actions;
}

function notify(failures) {
  const notifier = spawnSync('sh', ['-c', 'command -v notify-send'], { encoding: 'utf8' }).stdout.trim();
  if (!notifier) return;
  const detail = failures.slice(0, 4).map(item => `${item.check}: ${item.detail}`).join('\n');
  spawnSync(notifier, ['-u', 'critical', 'HeLa MCP doctor', detail], { timeout: 10_000 });
}

export async function runHostDoctor(argv = []) {
  const flag = name => argv.includes(name);
  const value = name => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const asJson = flag('--json');
  const timeout = Number(value('--timeout') ?? 90);
  const noLive = flag('--no-live');
  const started = Date.now();

  if (flag('--help')) {
    console.log('Usage: node scripts/doctor.mjs --hosts [--json] [--repair] [--notify] [--no-live] [--timeout SECONDS]');
    return 0;
  }

  const manifest = readManifest();
  const { floor } = checkInterpreter(manifest);
  if (!manifest) record(FAIL, 'manifest', `missing or unreadable ${MANIFEST}`, 'reinstall or restore .hela-install.json');
  const env = checkCredentials();
  checkLauncher();
  if (Object.keys(env).length) {
    checkHosts(env);
    checkHostBinaries();
    checkBackups(env);
  }
  const declared = (manifest?.servers ?? []).reduce((sum, cell) => sum + (Number(cell.tools) || 0), 0);
  let live = null;
  if (!noLive) live = await checkLive(timeout, declared, env.HELA_NAMESPACE_TOOLS !== '0');

  const actions = flag('--repair') ? repair(env, floor) : [];
  if (actions.length) {
    results.length = 0;
    const second = readManifest();
    checkInterpreter(second);
    const env2 = checkCredentials();
    if (Object.keys(env2).length) checkBackups(env2);
    if (!noLive) live = await checkLive(timeout, declared, env2.HELA_NAMESPACE_TOOLS !== '0');
  }

  const failures = results.filter(item => item.status === FAIL);
  const warnings = results.filter(item => item.status === WARN);
  const seconds = (Date.now() - started) / 1000;
  const code = failures.length ? 1 : 0;

  if (asJson) {
    console.log(JSON.stringify({
      ok: !failures.length,
      checks: results,
      repairs: actions,
      tools_expected: declared,
      tools_reported: live,
      seconds: Number(seconds.toFixed(2)),
    }, null, 2));
  } else {
    console.log(`HeLa MCP host layer · ${new Date().toISOString().slice(0, 19).replace('T', ' ')} · ${seconds.toFixed(1)}s`);
    for (const item of results) {
      console.log(`[${item.status.padEnd(4)}] ${item.check.padEnd(16)} ${item.detail}`);
      if (item.fix && item.status !== OK) console.log(`${' '.repeat(7)}└─ fix: ${item.fix}`);
    }
    if (actions.length) {
      console.log('\nrepairs applied:');
      for (const action of actions) console.log(`  · ${action}`);
    }
    const summary = `\n${results.length - failures.length - warnings.length} ok, ${warnings.length} warn, ${failures.length} fail`;
    console.log(live === null ? summary : `${summary} · tools=${live}`);
  }

  if (code && flag('--notify') && !asJson) notify(failures);
  return code;
}
