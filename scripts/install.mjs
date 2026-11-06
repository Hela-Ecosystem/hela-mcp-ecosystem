#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { probeMcp } from './mcp-probe.mjs';
import { provisionNeedle } from './provision-needle.mjs';
import { modes, clients, parseOptions, installationPlan, readInstallation, run, atomicJson, isolatedBuildEnvironment,
  artifactDigest, composeConfiguration } from './installation.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const help = `Usage: ./setup.sh [doctor] [OPTIONS]
  --mode individual|runtime|docker|docker-runtime|nix
  --profile ID          Any of the eight canonical profiles (default dev-workspace)
  --prefix PATH         Managed installation directory; existing unmanaged directories are refused
  --snapshot TAG|FILE   Exact snapshot (default latest-stable)
  --client NAME         Generate a client fragment, never overwrite live client settings (default skip)
  --out FILE            Explicit generated fragment destination; refuses existing files
  --workspace PATH      Workspace exposed to installed tools (default PREFIX/workspace)
  --runtime             Alias for runtime, or docker-runtime with --mode docker
  --with-runtime        Also build runtime with an individual installation
  --without-model       Explicitly omit the local Needle engine/model (core MCP only)
  --transport stdio|http Runtime transport (HTTP is loopback-only; listener started explicitly)
  --port PORT           HTTP listener port (default 8080)
  --dev                 Explicitly follow each snapshot's branch instead of its pin
  --reconfigure         Generate a new fragment from a verified existing installation
  --non-interactive     No prompts; missing/invalid arguments fail immediately
  --image NAME          Docker image tag override
  --root PATH           Metadata source checkout (default this checkout)
  --help                Show help

Doctor accepts --prefix/--mode/--profile/--runtime/--json, or --url URL for a running HTTP endpoint.
Hardware/providers are separate checks.
Node 22+ required; --mode nix bootstraps the pinned Nix development environment.
Optional provider keys are read from environment, never CLI arguments. Client settings are merged manually.`;

function log(message) { console.error(`[hela-install] ${message}`); }

function copyMetadata(destination, plan) {
  fs.mkdirSync(path.join(destination, 'config/snapshots'), { recursive: true });
  fs.mkdirSync(path.join(destination, 'scripts'), { recursive: true });
  for (const name of fs.readdirSync(path.join(sourceRoot, 'scripts')).filter(name => /\.(mjs|sh)$/.test(name))) {
    fs.copyFileSync(path.join(sourceRoot, 'scripts', name), path.join(destination, 'scripts', name));
  }
  fs.copyFileSync(path.join(sourceRoot, 'package.json'), path.join(destination, 'package.json'));
  fs.copyFileSync(path.join(plan.metadataRoot, 'config/profiles.json'), path.join(destination, 'config/profiles.json'));
  atomicJson(path.join(destination, 'config/inventory.json'), plan.data);
  atomicJson(path.join(destination, 'config/snapshots/latest-stable.json'), plan.snapshot);
}

function assertPrefix(prefix) {
  if (!fs.existsSync(prefix)) { fs.mkdirSync(prefix, { recursive: true, mode: 0o700 }); return; }
  if (fs.lstatSync(prefix).isSymbolicLink()) throw new Error('Installation prefix must not be a symlink');
  if (!fs.readdirSync(prefix).length) return;
  for (const name of ['.hela-install.json', '.hela-install.pending.json']) {
    try {
      const marker = JSON.parse(fs.readFileSync(path.join(prefix, name), 'utf8'));
      if (marker.managedBy === 'hela-installer' && marker.format === 1) return;
    } catch {}
  }
  throw new Error(`Refusing unmanaged nonempty installation directory: ${prefix}`);
}

async function installSources(options, plan) {
  const home = path.join(options.prefix, '.build-home');
  fs.mkdirSync(home, { recursive: true, mode: 0o700 });
  const env = isolatedBuildEnvironment(home), verified = [];
  let needle;
  for (const id of plan.keys) {
    const spec = plan.data.inventory[id], repository = path.join(options.prefix, spec.dir.split('/')[0]);
    const directory = path.join(options.prefix, spec.dir), pin = plan.snapshot.servers[id];
    log(`Source/build ${id}`);
    if (!fs.existsSync(repository)) run('git', ['clone', '--quiet', '--filter=blob:none', spec.repo, repository], { env });
    else {
      if (fs.lstatSync(repository).isSymbolicLink()) throw new Error(`Refusing symlinked repository: ${id}`);
      if (!fs.existsSync(path.join(repository, '.git'))) throw new Error(`Not a Git repository: ${id}`);
      if (run('git', ['status', '--porcelain'], { cwd: repository, env })) throw new Error(`Refusing dirty repository: ${id}`);
    }
    if (run('git', ['remote', 'get-url', 'origin'], { cwd: repository, env }) !== spec.repo) throw new Error(`Repository origin mismatch: ${id}`);
    const target = options.dev ? pin.branch : spec.revision;
    run('git', ['fetch', '--quiet', 'origin', target], { cwd: repository, env });
    const revision = run('git', ['rev-parse', 'FETCH_HEAD'], { cwd: repository, env });
    if (!options.dev && revision !== spec.revision) throw new Error(`Fetched revision mismatch: ${id}`);
    run('git', ['checkout', '--quiet', '--detach', revision], { cwd: repository, env });
    if (!fs.realpathSync(directory).startsWith(fs.realpathSync(repository) + path.sep) && fs.realpathSync(directory) !== fs.realpathSync(repository)) throw new Error(`Package escapes repository: ${id}`);
    spec.revision = revision;
    const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    if (options.dev) spec.version = pkg.version;
    if (typeof pkg.version !== 'string' || pkg.version !== spec.version) throw new Error(`Package/snapshot version mismatch: ${id}`);
    if (id === 'hela-mitosis') {
      needle = await provisionNeedle(directory, options.withoutModel);
      if (needle?.ready) Object.assign(env, { NEEDLE_ENGINE_PATH: needle.enginePath, NEEDLE_MODEL_PATH: needle.modelPath });
    }
    if (!fs.existsSync(path.join(directory, 'package-lock.json'))) throw new Error(`Locked dependencies required: ${id}`);
    const cellEnvironment = { ...env };
    if (options.withoutModel && id === 'hela-mitosis') cellEnvironment.npm_config_ignore_scripts = 'true';
    const glibc = process.report?.getReport().header.glibcVersionRuntime?.split('.').map(Number);
    if (id === 'hela-genome' && glibc && (glibc[0] < 2 || glibc[0] === 2 && glibc[1] < 38)) {
      log(`Building native dependencies from source for glibc ${glibc.join('.')}`);
      cellEnvironment.npm_config_build_from_source = 'true';
      const nodeRoot = path.resolve(path.dirname(process.execPath), '..');
      if (fs.existsSync(path.join(nodeRoot, 'include/node/node.h'))) cellEnvironment.npm_config_nodedir = nodeRoot;
    }
    run('npm', ['ci', '--no-audit', '--no-fund'], { cwd: directory, env: cellEnvironment, stdio: ['ignore', 'inherit', 'inherit'] });
    if (spec.build) {
      if (!pkg.scripts?.[spec.build]) throw new Error(`Missing declared build script: ${id}`);
      run('npm', ['run', spec.build], { cwd: directory, env: cellEnvironment, stdio: ['ignore', 'inherit', 'inherit'] });
    }
    verified.push({ id, revision, version: pkg.version, dir: spec.dir, entry: spec.entry, env: spec.env ?? [], digest: artifactDigest(directory, spec.entry) });
  }
  if (options.dev) {
    for (const server of verified) Object.assign(plan.snapshot.servers[server.id], { commit: server.revision, serverVersion: server.version });
    plan.snapshot.snapshot_version += '-dev';
  }
  copyMetadata(plan.ecosystemRoot, plan);
  let runtimeExecutable;
  if (options.mode === 'nix') {
    const link = path.join(options.prefix, 'nix-runtime');
    run('nix', ['build', `${path.join(options.prefix, 'hela-runtime')}#default`, '--out-link', link], { stdio: ['ignore', 'inherit', 'inherit'] });
    runtimeExecutable = path.join(link, 'bin/hela-runtime');
    if (!fs.existsSync(runtimeExecutable)) throw new Error('Nix runtime executable missing');
  }
  if (plan.keys.includes('hela-runtime')) run(process.execPath, [path.join(plan.ecosystemRoot, 'scripts/generate-tool-catalog.mjs'), '--profile', options.profile],
    { env, stdio: ['ignore', 'inherit', 'inherit'] });
  for (const server of verified) {
    const result = await probeMcp(path.join(options.prefix, server.dir, server.entry), {
      ecosystemRoot: plan.ecosystemRoot, profile: options.profile, runtime: server.id === 'hela-runtime',
      ...(runtimeExecutable && server.id === 'hela-runtime' ? { launch: { command: runtimeExecutable, args: [] } } : {}),
    });
    if (result.serverInfo.version !== server.version) throw new Error(`MCP version mismatch: ${server.id}`);
    if (server.id === 'hela-runtime' && result.discoveryBootedCells.length) throw new Error('Runtime eagerly started cells during discovery');
    if (server.id === 'hela-runtime') {
      const http = await probeMcp(path.join(options.prefix, server.dir, server.entry), { ecosystemRoot: plan.ecosystemRoot, profile: options.profile,
        runtime: true, transport: 'http', ...(runtimeExecutable ? { launch: { command: runtimeExecutable, args: [] } } : {}) });
      if (http.serverInfo.version !== server.version || http.tools.length !== result.tools.length || http.discoveryBootedCells.length) throw new Error('Runtime HTTP discovery failed parity');
      server.httpReady = true;
    }
    server.tools = result.tools.length;
    log(`Verified ${server.id}: ${server.tools} tools`);
  }
  return { servers: verified, runtimeExecutable, needle };
}

async function installDocker(options, plan) {
  run('docker', ['info', '--format', '{{.ServerVersion}}']);
  run('docker', ['compose', 'version']);
  const context = fs.mkdtempSync(path.join(os.tmpdir(), 'hela-docker-build-'));
  try {
    const bootstrap = path.join(context, 'bootstrap');
    copyMetadata(bootstrap, plan);
    fs.copyFileSync(path.join(sourceRoot, 'Dockerfile'), path.join(context, 'Dockerfile'));
    const image = options.image || `hela-ecosystem:${options.profile}-${plan.snapshot.snapshot_version}`;
    if (!/^[a-z0-9][a-z0-9._/:-]*$/.test(image)) throw new Error('Invalid Docker image name');
    run('docker', ['build', '--tag', image, '--build-arg', `HELA_PROFILE=${options.profile}`, '--build-arg', `HELA_WITHOUT_MODEL=${options.withoutModel ? 1 : 0}`, context],
      { stdio: ['ignore', 'inherit', 'inherit'], timeout: 1800000 });
    const imageId = run('docker', ['image', 'inspect', '--format', '{{.Id}}', image]);
    if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) throw new Error('Invalid built Docker image ID');
    const { checkContainerInstallation } = await import('./doctor-installation.mjs');
    const manifest = { mode: options.mode, profile: options.profile, image, imageId, ecosystemRoot: plan.ecosystemRoot,
      servers: plan.keys.map(id => { const s = plan.data.inventory[id]; return { id, dir: s.dir, entry: s.entry, revision: s.revision, version: s.version, env: s.env ?? [] }; }) };
    const report = await checkContainerInstallation(manifest);
    if (report.status !== 'READY') throw new Error(`Docker MCP verification failed: ${report.error || report.cleanupError || JSON.stringify(report.servers.filter(s => s.status !== 'READY'))}`);
    const selected = (options.mode === 'docker-runtime' ? ['hela-runtime'] : plan.profile.servers).map(id => plan.data.inventory[id]);
    atomicJson(path.join(options.prefix, 'compose.json'), composeConfiguration(selected, imageId, options.profile, options));
    return { servers: manifest.servers, image, imageId };
  } finally { fs.rmSync(context, { recursive: true, force: true }); }
}

async function generateFragment(options, manifest) {
  if (options.client === 'skip') return;
  const suffix = options.client === 'codex' ? 'toml' : 'json';
  const out = path.resolve(options.out || path.join(options.prefix, `client-${options.client}-${Date.now()}.${suffix}`));
  if (fs.existsSync(out)) throw new Error('Refusing to overwrite an existing configuration fragment');
  fs.mkdirSync(path.dirname(out), { recursive: true, mode: 0o700 });
  const args = [path.join(sourceRoot, 'scripts/generate-config.mjs'), '--profile', options.profile, '--client', options.client,
    '--root', manifest.ecosystemRoot, '--mode', options.mode, '--prefix', options.prefix, '--out', out];
  if (options.transport === 'http') args.push('--url', `http://127.0.0.1:${options.port}/mcp`);
  run(process.execPath, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  fs.chmodSync(out, 0o600);
  log(`Client fragment: ${out}. Review and merge it; live client files were not changed.`);
}

async function main() {
  const options = parseOptions(process.argv.slice(2), sourceRoot);
  if (options.help) { console.log(help); return; }
  if (options.url) throw new Error('--url is for doctor; use --transport http to install an HTTP runtime');
  if (!options.nonInteractive && process.stdin.isTTY && process.argv.length === 2) {
    const input = createInterface({ input: process.stdin, output: process.stdout });
    try {
      options.profile = (await input.question('Profile [dev-workspace]: ')).trim() || options.profile;
      options.mode = (await input.question(`Mode (${modes.join(', ')}) [individual]: `)).trim() || options.mode;
      options.client = (await input.question(`Client (${clients.join(', ')}) [skip]: `)).trim() || options.client;
    } finally { input.close(); }
    Object.assign(options, parseOptions(['--profile', options.profile, '--mode', options.mode, '--client', options.client], sourceRoot));
  }
  if (options.mode === 'nix' && !process.env.IN_NIX_SHELL) {
    const args = [path.join(sourceRoot, 'scripts/install.mjs'), '--mode', 'nix', '--profile', options.profile,
      '--root', options.root, '--prefix', options.prefix, '--workspace', options.workspace, '--client', options.client,
      '--snapshot', options.snapshot, '--non-interactive'];
    args.push('--transport', options.transport, '--port', String(options.port));
    for (const flag of ['dev', 'reconfigure']) if (options[flag]) args.push(`--${flag}`);
    if (options.withoutModel) args.push('--without-model');
    if (options.out) args.push('--out', options.out);
    run('nix', ['develop', sourceRoot, '--command', 'node', ...args], { stdio: 'inherit', timeout: 3600000 });
    return;
  }
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node 22+ is required; use --mode nix for a pinned toolchain');
  const plan = installationPlan(options);
  if (options.out && fs.existsSync(path.resolve(options.out))) throw new Error('Refusing to overwrite an existing configuration fragment');
  if (fs.existsSync(path.join(options.prefix, '.hela-install.json'))) {
    const existing = readInstallation(options.prefix);
    if (existing.profile !== options.profile || existing.mode !== options.mode) throw new Error('Use a different prefix for a different installation mode/profile');
  }
  if (options.reconfigure) {
    const manifest = readInstallation(options.prefix);
    if (manifest.profile !== options.profile || manifest.mode !== options.mode) throw new Error('Existing installation mode/profile mismatch');
    if (options.transport !== (manifest.transport ?? 'stdio') || options.port !== (manifest.port ?? 8080)) throw new Error('Reconfiguration cannot change transport/port; rerun installation with the new settings');
    const { checkInstallation } = await import('./doctor-installation.mjs');
    if ((await checkInstallation(options.prefix)).status !== 'READY') throw new Error('Existing installation is not ready; run doctor');
    await generateFragment(options, manifest);
    return;
  }
  assertPrefix(options.prefix);
  const lock = path.join(options.prefix, '.hela-install.lock');
  const descriptor = fs.openSync(lock, 'wx', 0o600);
  try {
    atomicJson(path.join(options.prefix, '.hela-install.pending.json'), { managedBy: 'hela-installer', format: 1, profile: options.profile, mode: options.mode });
    fs.mkdirSync(options.workspace, { recursive: true });
    copyMetadata(plan.ecosystemRoot, plan);
    const installed = options.mode.startsWith('docker') ? await installDocker(options, plan) : await installSources(options, plan);
    for (const server of installed.servers) fs.mkdirSync(path.join(options.prefix, 'data', server.id), { recursive: true, mode: 0o700 });
    const manifest = { managedBy: 'hela-installer', format: 1, mode: options.mode, profile: options.profile,
      snapshot: plan.snapshot.snapshot_version, dev: options.dev, ecosystemRoot: plan.ecosystemRoot, prefix: options.prefix,
      workspace: options.workspace, transport: options.transport, port: options.port, createdAt: new Date().toISOString(), node: process.execPath, ...installed };
    atomicJson(path.join(options.prefix, '.hela-install.json'), manifest);
    await generateFragment(options, manifest);
    fs.unlinkSync(path.join(options.prefix, '.hela-install.pending.json'));
    log(`READY ${options.mode}/${options.profile}. Doctor: ./setup.sh doctor --prefix ${JSON.stringify(options.prefix)}`);
    if (options.transport === 'http') log(`HTTP listener is not auto-started. Start: ${JSON.stringify(process.execPath)} ${JSON.stringify(path.join(plan.ecosystemRoot, 'scripts/launch.mjs'))} hela-runtime`);
  } finally { fs.closeSync(descriptor); fs.unlinkSync(lock); }
}

main().catch(error => { console.error(`[hela-install] ERROR: ${error.message}`); process.exitCode = 1; });
