import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readInstallation, run, containerArgs, artifactDigest } from './installation.mjs';
import { probeMcp } from './mcp-probe.mjs';

function inspectTmux() {
  const probe = spawnSync('tmux', ['-V'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000 });
  const match = `${probe.stdout ?? ''} ${probe.stderr ?? ''}`.match(/(?:^|\s)tmux\s+(\d+)\.(\d+)(?:\.(\d+))?/i);
  const version = match ? `${match[1]}.${match[2]}${match[3] ? `.${match[3]}` : ''}` : null;
  const ready = !probe.error && probe.status === 0 && Boolean(match)
    && (Number(match[1]) > 1 || Number(match[1]) === 1 && Number(match[2]) >= 8);
  return { ready, version };
}

/**
 * Every cell tool the probe discovered must be reachable through the runtime, as the
 * runtime's own namespaced name (`hela_<cell>_<tool>`) or, when a client opts out of
 * namespacing, the bare name. Comparing only bare names reported DEGRADED as soon as
 * namespacing became the default, without saying why.
 */
export function missingFromRuntimeCatalog(servers, discoveries, actual) {
  const missing = [];
  for (const server of servers) {
    if (server.id === 'hela-runtime') continue;
    const short = server.id.replace(/^hela-/, '');
    for (const name of discoveries.get(server.id) ?? []) {
      if (!actual.has(name) && !actual.has(`hela_${short}_${name}`)) missing.push(`${server.id}/${name}`);
    }
  }
  if (!actual.has('hela.pipe')) missing.push('hela.pipe');
  return missing;
}

export async function checkContainerInstallation(manifest) {
  const report = { mode: manifest.mode, profile: manifest.profile, status: 'READY', isolated: true, servers: [],
    dependencies: { tmux: { ready: manifest.systemDeps?.status === 'present', version: manifest.systemDeps?.version ?? null,
      severity: 'warn', installStatus: manifest.systemDeps?.status ?? 'unknown', drift: false } },
    integrations: 'Browser engines, Android/Blender bridges, providers and workspace mounts require separate verification.' };
  try {
    const actualId = run('docker', ['image', 'inspect', '--format', '{{.Id}}', manifest.imageId]);
    if (actualId !== manifest.imageId) throw new Error('Docker image identity mismatch');
    const embedded = JSON.parse(run('docker', ['run', '--rm', '--network', 'none', '--entrypoint', 'node', manifest.imageId, '-e',
      'process.stdout.write(require("fs").readFileSync("/opt/hela/.hela-install.json","utf8"))']));
    for (const server of manifest.servers) {
      const actual = embedded.servers?.find(candidate => candidate.id === server.id);
      if (!actual || actual.revision !== server.revision || actual.version !== server.version) throw new Error(`Image source provenance mismatch: ${server.id}`);
    }
  } catch (error) { report.status = 'DEGRADED'; report.error = error.message; return report; }
  const discoveries = new Map();
  for (const spec of manifest.servers) {
    const name = `hela-doctor-${randomUUID()}`;
    try {
      const entry = `/opt/hela/${spec.dir}/${spec.entry}`;
      const args = containerArgs(manifest.imageId, entry, { profile: manifest.profile, name, isolated: true });
      const result = await probeMcp(entry, { runtime: spec.id === 'hela-runtime', profile: manifest.profile,
        launch: { command: 'docker', args }, timeoutMs: 30000 });
      if (result.serverInfo.version !== spec.version) throw new Error('Image MCP/snapshot version mismatch');
      if (spec.id === 'hela-runtime' && result.discoveryBootedCells.length) throw new Error('Runtime discovery started cells');
      discoveries.set(spec.id, result.tools.map(tool => tool.name));
      let httpReady;
      if (spec.id === 'hela-runtime') {
        const http = await probeMcp(entry, { runtime: true, transport: 'http', httpHost: '0.0.0.0', profile: manifest.profile, timeoutMs: 30000,
          launchForPort(port) {
            const httpArgs = containerArgs(manifest.imageId, entry, { profile: manifest.profile, name: name + '-http', isolated: true });
            httpArgs[httpArgs.indexOf('none')] = 'bridge';
            httpArgs.splice(1, 0, '--publish', `127.0.0.1:${port}:${port}`);
            return { command: 'docker', args: httpArgs };
          } });
        httpReady = http.serverInfo.version === spec.version && http.tools.length === result.tools.length && !http.discoveryBootedCells.length;
        if (!httpReady) throw new Error('HTTP runtime discovery/version mismatch');
      }
      report.servers.push({ id: spec.id, version: result.serverInfo.version, tools: result.tools.length, httpReady, status: 'READY' });
    } catch (error) { report.status = 'DEGRADED'; report.servers.push({ id: spec.id, status: 'ERROR', error: error.message }); }
    finally {
      for (const container of spec.id === 'hela-runtime' ? [name, name + '-http'] : [name]) {
        const removed = spawnSync('docker', ['rm', '--force', container], { encoding: 'utf8', timeout: 15000 });
        if (removed.error || removed.status && !removed.stderr?.includes('No such container')) {
          report.status = 'DEGRADED'; report.cleanupError = 'Failed to remove isolated doctor container';
        }
      }
    }
  }
  if (discoveries.has('hela-runtime')) {
    const actual = new Set(discoveries.get('hela-runtime'));
    const missing = missingFromRuntimeCatalog(manifest.servers, discoveries, actual);
    // Runtime may expose native capabilities (for example Needle agent and
    // catalog tools) in addition to the delegated cell catalog.
    report.catalogMatch = missing.length === 0;
    if (!report.catalogMatch) {
      report.status = 'DEGRADED';
      // Name what is missing: a bare `[]` told an operator nothing.
      report.error = `Runtime catalog is missing ${missing.length} cell tool(s): ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''}`;
    }
  }
  return report;
}

export async function checkInstallation(prefix) {
  const manifest = readInstallation(prefix);
  if (fs.existsSync(path.join(prefix, '.hela-install.pending.json'))) return {
    mode: manifest.mode, profile: manifest.profile, status: 'DEGRADED', servers: [], error: 'An incomplete installation is pending; rerun installer.' };
  if (manifest.mode.startsWith('docker')) return checkContainerInstallation(manifest);
  const report = { mode: manifest.mode, profile: manifest.profile, status: 'READY', isolated: true, servers: [], needle: manifest.needle, mirage: manifest.mirage,
    integrations: 'MCP readiness only. Browser executables, devices/Blender bridges and providers require separate checks.' };
  const tmuxSelected = manifest.servers.some(server => ['hela-nucleus', 'hela-ribosome'].includes(server.id));
  if (tmuxSelected && manifest.systemDeps?.method !== 'nix-devshell') {
    const current = inspectTmux(), recorded = manifest.systemDeps ?? { status: 'unknown', version: null };
    const drift = recorded.version ? recorded.version !== current.version
      : ['skipped', 'declined'].includes(recorded.status) && current.ready;
    report.dependencies = { tmux: { ...current, severity: 'warn', installStatus: recorded.status, drift } };
  }
  if (manifest.needle?.ready) {
    for (const kind of ['engine', 'model']) {
      try {
        const digest = createHash('sha256').update(fs.readFileSync(manifest.needle[`${kind}Path`])).digest('hex');
        if (digest !== manifest.needle[`${kind}Hash`]) throw new Error('Checksum mismatch');
      } catch { report.status = 'DEGRADED'; report.needle = { ready: false, error: `Needle ${kind} missing or changed` }; }
    }
  }
  if (manifest.mirage?.ready) {
    try {
      if (!fs.existsSync(manifest.mirage.pythonPath) || !fs.existsSync(manifest.mirage.workerPath)) throw new Error('Mirage Python worker is missing');
      const imported = spawnSync(manifest.mirage.pythonPath, ['-c', 'import cactus'], { stdio: 'ignore', timeout: 30000 });
      if (imported.error || imported.status !== 0) throw new Error('cactus-compute[vision] is not importable');
    } catch (error) {
      report.status = 'DEGRADED';
      report.mirage = { ready: false, error: error.message };
    }
  }
  const discoveries = new Map();
  for (const spec of manifest.servers) {
    const directory = path.join(prefix, spec.dir);
    try {
      const revision = run('git', ['rev-parse', 'HEAD'], { cwd: directory });
      if (revision !== spec.revision) throw new Error('Installed revision differs from verified manifest');
      if (run('git', ['status', '--porcelain'], { cwd: directory })) throw new Error('Installed source has uncommitted changes');
      const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
      if (pkg.version !== spec.version) throw new Error('Installed package version differs from manifest');
      if (artifactDigest(directory, spec.entry) !== spec.digest) throw new Error('Installed build differs from verified manifest');
      const runtime = spec.id === 'hela-runtime';
      const launch = runtime && manifest.runtimeExecutable ? { command: manifest.runtimeExecutable, args: [] }
        : { command: manifest.node, args: [path.join(directory, spec.entry)] };
      const result = await probeMcp(path.join(directory, spec.entry), { ecosystemRoot: manifest.ecosystemRoot,
        profile: manifest.profile, runtime, launch });
      if (result.serverInfo.version !== spec.version) throw new Error('MCP/manifest version mismatch');
      if (runtime && result.discoveryBootedCells.length) throw new Error('Runtime discovery started cells');
      discoveries.set(spec.id, result.tools.map(tool => tool.name));
      let httpReady;
      if (runtime) {
        const http = await probeMcp(path.join(directory, spec.entry), { ecosystemRoot: manifest.ecosystemRoot, profile: manifest.profile, runtime: true, transport: 'http',
          launch });
        httpReady = http.serverInfo.version === spec.version && http.tools.length === result.tools.length && !http.discoveryBootedCells.length;
        if (!httpReady) throw new Error('HTTP runtime discovery/version mismatch');
      }
      report.servers.push({ id: spec.id, version: result.serverInfo.version, tools: result.tools.length, httpReady, revision, status: 'READY' });
    } catch (error) { report.status = 'DEGRADED'; report.servers.push({ id: spec.id, status: 'ERROR', error: error.message }); }
  }
  if (discoveries.has('hela-runtime')) {
    const expected = new Set(manifest.servers.filter(s => s.id !== 'hela-runtime').flatMap(s => discoveries.get(s.id) ?? []));
    expected.add('hela.pipe');
    const actual = new Set(discoveries.get('hela-runtime'));
    report.catalogMatch = [...expected].every(name => actual.has(name));
    if (!report.catalogMatch) report.status = 'DEGRADED';
  }
  return report;
}
