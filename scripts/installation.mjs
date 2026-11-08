import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';
import { loadInventory, selectProfile } from './inventory.mjs';

export const modes = ['individual', 'runtime', 'docker', 'docker-runtime', 'nix'];
export const clients = ['cursor', 'claude', 'gemini', 'antigravity', 'opencode', 'kilo', 'zed', 'codex', 'docker', 'skip'];

export function modeNeedsRuntime(mode) { return mode !== 'individual'; }
export function modeFamily(mode) { return mode.startsWith('docker') ? 'docker' : mode === 'nix' ? 'nix' : 'host'; }

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 600000, ...options });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} failed${result.error ? `: ${result.error.code}` : ` (exit ${result.status})`}${result.stderr ? `\n${result.stderr.slice(-3000)}` : ''}`);
  }
  return result.stdout?.trim() ?? '';
}

export function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  try { fs.renameSync(temporary, file); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

export function parseOptions(argv, sourceRoot) {
  const options = { command: 'install', profile: process.env.HELA_PROFILE || 'dev-workspace', mode: 'individual', client: 'skip', root: sourceRoot,
    nonInteractive: false, runtime: false, withRuntime: false, dev: false, reconfigure: false, snapshot: 'latest-stable', transport: 'stdio', port: 8080 };
  const start = argv[0] === 'mode' ? 1 : 0;
  if (start) options.command = 'mode';
  options.transportProvided = argv.includes('--transport');
  options.portProvided = argv.includes('--port');
  const values = new Map([['--profile', 'profile'], ['--mode', 'mode'], ['--client', 'client'], ['--prefix', 'prefix'],
    ['--root', 'root'], ['--snapshot', 'snapshot'], ['--out', 'out'], ['--workspace', 'workspace'], ['--image', 'image'], ['--system', 'system'],
    ['--transport', 'transport'], ['--port', 'port'], ['--url', 'url']]);
  const booleans = new Map([['--non-interactive', 'nonInteractive'], ['--runtime', 'runtime'], ['--with-runtime', 'withRuntime'],
    ['--reconfigure', 'reconfigure'], ['--dev', 'dev'], ['--json', 'json'], ['--help', 'help'], ['-h', 'help']]);
  booleans.set('--without-model', 'withoutModel');
  for (let i = start; i < argv.length; i++) {
    const flag = argv[i];
    if (values.has(flag)) {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
      options[values.get(flag)] = value;
    } else if (booleans.has(flag)) options[booleans.get(flag)] = true;
    else if (flag === '--nix') options.mode = 'nix';
    else throw new Error(`Unknown option: ${flag}`);
  }
  if (options.reconfigure && options.prefix && fs.existsSync(path.join(path.resolve(options.prefix), '.hela-install.json'))) {
    const existing = readInstallation(path.resolve(options.prefix));
    for (const key of ['profile', 'mode', 'transport', 'port']) {
      if (!argv.includes(`--${key}`) && !(key === 'mode' && (options.runtime || argv.includes('--nix')))) options[key] = existing[key] ?? options[key];
    }
  }
  if (options.client === 'docker' && options.mode === 'individual') options.mode = 'docker';
  if (options.client === 'docker' && options.mode === 'runtime') options.mode = 'docker-runtime';
  if (options.runtime && options.mode === 'individual') options.mode = 'runtime';
  if (options.runtime && options.mode === 'docker') options.mode = 'docker-runtime';
  if (!modes.includes(options.mode)) throw new Error(`Unknown installation mode: ${options.mode}`);
  if (!clients.includes(options.client)) throw new Error(`Unknown client: ${options.client}`);
  if (options.mode === 'nix' && options.client === 'docker') throw new Error('Docker client output requires a Docker installation mode');
  if (options.mode.startsWith('docker') && options.dev) throw new Error('Docker installations require pinned snapshots; --dev is supported for host modes');
  if (!['stdio', 'http'].includes(options.transport)) throw new Error('Unknown transport');
  if (options.transport === 'http' && !['runtime', 'docker-runtime', 'nix'].includes(options.mode)) throw new Error('HTTP transport requires a runtime installation mode');
  options.port = Number(options.port);
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) throw new Error('Port must be an integer from 1 to 65535');
  if (options.transport === 'http' && !['skip', 'docker', 'opencode', 'kilo', 'codex', 'cursor'].includes(options.client)) throw new Error('This client backend has no verified HTTP configuration; use --client skip and configure its MCP URL manually');
  if (options.system && !['any', 'gui', 'headless'].includes(options.system)) throw new Error('Unknown target system');
  if (options.system === 'headless' && !argv.includes('--profile')) options.profile = 'headless-server';
  options.root = path.resolve(options.root);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.profile)) throw new Error('Invalid profile ID');
  options.prefix = path.resolve(options.prefix || path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local/share'), 'hela/installations', `${options.profile}-${options.mode}`));
  options.workspace = path.resolve(options.workspace || path.join(options.prefix, 'workspace'));
  return options;
}

export function installationPlan(options) {
  const data = loadInventory(options.root);
  const profile = selectProfile(data, options.profile);
  const snapshotFile = path.isAbsolute(options.snapshot) ? options.snapshot
    : path.join(options.root, 'config/snapshots', options.snapshot.replace(/\.json$/, '') + '.json');
  const snapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
  if (!snapshot.servers || typeof snapshot.snapshot_version !== 'string') throw new Error('Invalid snapshot');
  const runtime = options.mode !== 'individual' || options.withRuntime;
  const keys = [...profile.servers, ...(runtime ? ['hela-runtime'] : [])];
  const effective = structuredClone(data);
  delete effective.profiles;
  for (const id of keys) {
    const spec = effective.inventory[id], pin = snapshot.servers[id];
    if (!pin || !/^[a-f0-9]{40}$/.test(pin.commit) || !pin.serverVersion) throw new Error(`Invalid snapshot pin: ${id}`);
    if (path.isAbsolute(spec.dir) || spec.dir.split(/[\\/]/).some(part => !part || part === '.' || part === '..')) throw new Error(`Unsafe repository path: ${id}`);
    if (path.isAbsolute(spec.entry) || spec.entry.split(/[\\/]/).some(part => !part || part === '.' || part === '..')) throw new Error(`Unsafe entrypoint: ${id}`);
    if (options.dev && (!/^[a-zA-Z0-9][a-zA-Z0-9_./-]*$/.test(pin.branch ?? '') || pin.branch.includes('..'))) throw new Error(`Invalid development branch: ${id}`);
    if (!/^https:\/\//.test(pin.repo) && !/^file:\/\//.test(pin.repo)) throw new Error(`Unsupported repository URL: ${id}`);
    const url = new URL(pin.repo);
    if (url.username || url.password) throw new Error('Repository URLs must not embed credentials');
    Object.assign(spec, { revision: pin.commit, version: pin.serverVersion, repo: pin.repo });
  }
  return { data: effective, profile, snapshot, keys, metadataRoot: options.root, ecosystemRoot: path.join(options.prefix, 'hela-mcp-ecosystem') };
}

export function readInstallation(prefix) {
  const manifest = JSON.parse(fs.readFileSync(path.join(prefix, '.hela-install.json'), 'utf8'));
  if (manifest.format !== 1 || manifest.managedBy !== 'hela-installer' || !modes.includes(manifest.mode)
      || !Array.isArray(manifest.servers)) throw new Error('Invalid installation manifest');
  for (const server of manifest.servers) {
    if (!/^hela-[a-z-]+$/.test(server.id) || !/^[a-f0-9]{40}$/.test(server.revision) || typeof server.version !== 'string') throw new Error('Invalid installed server');
    for (const relative of [server.dir, server.entry]) {
      if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe installed server path');
    }
  }
  return manifest;
}

export function isolatedBuildEnvironment(home) {
  return { ...Object.fromEntries(['PATH', 'LANG', 'LC_ALL', 'TMPDIR', 'SystemRoot', 'SSL_CERT_FILE', 'NIX_SSL_CERT_FILE', 'IN_NIX_SHELL', 'HELA_PROBE_DEBUG']
    .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]])), HOME: home, USERPROFILE: home,
  NODE_ENV: 'development', npm_config_cache: path.join(home, '.npm'), npm_config_audit: 'false', npm_config_fund: 'false' };
}

export function artifactDigest(directory, entry) {
  const hash = createHash('sha256');
  function visit(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) visit(file);
      else if (item.isFile()) hash.update(path.relative(directory, file)).update('\0').update(fs.readFileSync(file));
    }
  }
  if (!fs.existsSync(path.join(directory, entry))) throw new Error('Missing build entrypoint');
  visit(path.dirname(path.join(directory, entry)));
  for (const name of ['package.json', 'package-lock.json']) hash.update(fs.readFileSync(path.join(directory, name)));
  return hash.digest('hex');
}

export function containerArgs(image, entry, { profile, name, isolated = false, workspace, data } = {}) {
  const args = ['run', '--rm', '-i', '--init'];
  if (name) args.push('--name', name);
  args.push('--workdir', '/workspace', '--env', `HELA_PROFILE=${profile}`, '--env', 'HELA_ECOSYSTEM_ROOT=/opt/hela/hela-mcp-ecosystem');
  if (isolated) args.push('--network', 'none', '--tmpfs', '/data:mode=1777', '--tmpfs', '/workspace:mode=1777',
    '--env', 'NODE_ENV=test', '--env', 'CHAINING_LLM_ENABLED=false', '--env', 'MITOSIS_AGENT_ENABLED=false', '--env', 'AGENT_ESCALATION_ENABLED=false');
  else {
    if (workspace) args.push('--volume', `${workspace}:/workspace`);
    if (data) args.push('--volume', `${data}:/data`);
  }
  args.push('--entrypoint', 'node', image, entry);
  return args;
}

export function composeConfiguration(servers, image, profile, { transport = 'stdio', port = 8080 } = {}) {
  const services = {}, volumes = { workspace: {} };
  for (const spec of servers) {
    const volume = `${spec.id}-data`;
    volumes[volume] = {};
    services[spec.id] = { image, init: true, stdin_open: true, tty: false, working_dir: '/workspace',
      command: ['node', `/opt/hela/${spec.dir}/${spec.entry}`],
      environment: { HELA_PROFILE: profile, HELA_ECOSYSTEM_ROOT: '/opt/hela/hela-mcp-ecosystem' },
      volumes: [`${volume}:/data`, 'workspace:/workspace'] };
    if (spec.id === 'hela-runtime' && transport === 'http') {
      services[spec.id].stdin_open = false;
      services[spec.id].command.push('--transport', 'http', '--host', '0.0.0.0', '--port', String(port));
      services[spec.id].ports = [`127.0.0.1:${port}:${port}`];
    }
  }
  return { services, volumes };
}
