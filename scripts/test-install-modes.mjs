#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadInventory } from './inventory.mjs';
import { modes, readInstallation, atomicJson, run } from './installation.mjs';
import { checkInstallation } from './doctor-installation.mjs';
import { probeMcp } from './mcp-probe.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = {};
for (let i = 2; i < process.argv.length; i++) {
  const flag = process.argv[i], value = process.argv[++i];
  if (!['--source-prefix', '--nix-prefix', '--docker-prefix', '--out'].includes(flag) || !value || value.startsWith('--')) throw new Error('Expected --source-prefix, --nix-prefix, --docker-prefix and optional --out');
  options[flag.slice(2)] = path.resolve(value);
}
for (const key of ['source-prefix', 'nix-prefix', 'docker-prefix']) if (!options[key]) throw new Error(`Missing --${key}`);
const sources = readInstallation(options['source-prefix']);
const packaged = readInstallation(options['nix-prefix']);
const docker = readInstallation(options['docker-prefix']);
for (const key of ['source-prefix', 'nix-prefix', 'docker-prefix']) {
  if (fs.existsSync(path.join(options[key], '.hela-install.pending.json'))) throw new Error(`Incomplete acceptance fixture: ${key}`);
}
if (sources.servers.length !== 11 || !packaged.runtimeExecutable || !docker.imageId) throw new Error('Acceptance requires a fresh full source build, a Nix package, and a full Docker image');
const inventory = loadInventory(sources.ecosystemRoot);
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hela-modes-'));
const results = [];
try {
  for (const profile of inventory.profiles) for (const mode of modes) {
    const prefix = path.join(scratch, profile.id + '-' + mode);
    const ecosystemRoot = path.join(prefix, 'hela-mcp-ecosystem');
    fs.mkdirSync(prefix);
    fs.cpSync(sources.ecosystemRoot, ecosystemRoot, { recursive: true });
    for (const name of fs.readdirSync(path.join(root, 'scripts')).filter(name => name.endsWith('.mjs'))) {
      fs.copyFileSync(path.join(root, 'scripts', name), path.join(ecosystemRoot, 'scripts', name));
    }
    const keys = [...profile.servers, ...(mode === 'individual' || mode === 'docker' ? [] : ['hela-runtime'])];
    const servers = keys.map(id => {
      const server = (mode.startsWith('docker') ? docker : sources).servers.find(candidate => candidate.id === id);
      if (!server) throw new Error(`Missing fresh fixture: ${id}`);
      return server;
    });
    if (!mode.startsWith('docker')) {
      for (const server of servers) {
        const repository = server.dir.split('/')[0], target = path.join(prefix, repository);
        if (!fs.existsSync(target)) fs.symlinkSync(path.join(options['source-prefix'], repository), target, 'dir');
      }
    }
    const manifest = { ...sources, mode, profile: profile.id, prefix, ecosystemRoot, transport: 'stdio',
      workspace: path.join(prefix, 'workspace'), servers,
      ...(mode === 'nix' ? { runtimeExecutable: packaged.runtimeExecutable } : {}),
      ...(mode.startsWith('docker') ? { imageId: docker.imageId, image: docker.image, needle: undefined } : {}) };
    atomicJson(path.join(prefix, '.hela-install.json'), manifest);
    fs.mkdirSync(manifest.workspace, { recursive: true });
    for (const server of servers) fs.mkdirSync(path.join(prefix, 'data', server.id), { recursive: true, mode: 0o700 });
    const report = await checkInstallation(prefix);
    if (report.status !== 'READY') throw new Error(JSON.stringify({ profile: profile.id, mode, ...report }));
    let configurations = 0, clientConnections = 0, persistence = false;
    for (const client of ['cursor', 'claude', 'gemini', 'antigravity', 'opencode', 'kilo', 'zed', 'codex']) {
      const text = run(process.execPath, [path.join(root, 'scripts/generate-config.mjs'), profile.id, '--client', client,
        '--root', ecosystemRoot, '--mode', mode, '--prefix', prefix, '--stdout']);
      const count = mode === 'individual' || mode === 'docker' ? profile.servers.length : 1;
      if (client === 'codex') {
        if ((text.match(/^\[mcp_servers\.[^.\]]+\]/gm) ?? []).length !== count) throw new Error('Codex server count mismatch');
      } else {
        const json = JSON.parse(text), entries = json.mcp ?? json.mcpServers ?? json.context_servers;
        if (Object.keys(entries).length !== count) throw new Error('Client server count mismatch');
        for (const [id, server] of Object.entries(entries)) {
          const args = Array.isArray(server.command) ? server.command : [server.command, ...server.args];
          if (mode.startsWith('docker')) {
            if (args[0] !== 'docker' || !args.includes(docker.imageId)) throw new Error('Client bypasses immutable Docker image');
          } else if (!args.some(arg => arg.endsWith('scripts/launch.mjs'))) throw new Error('Client bypasses verified installed launcher');
          if (client === 'cursor') {
            const memory = id === 'hela-genome' || id === 'hela-runtime';
            const entity = `acceptance:${profile.id}:${mode}`;
            const result = await probeMcp('', { profile: profile.id, runtime: id === 'hela-runtime',
              launch: { command: server.command, args: server.args }, timeoutMs: 30000,
              calls: memory ? [{ name: 'memory_edit', arguments: { action: 'create_entities', entities: [
                { name: entity, entityType: 'task', observations: ['Isolated installer acceptance fixture.'] } ] } }] : [] });
            const verified = report.servers.find(candidate => candidate.id === id);
            if (result.serverInfo.version !== verified.version || result.tools.length < verified.tools
                || id === 'hela-runtime' && result.discoveryBootedCells.length) throw new Error(`Generated client connection mismatch: ${id}`);
            clientConnections++;
            if (memory) {
              if (id === 'hela-runtime' && JSON.stringify(result.bootedCells) !== JSON.stringify(['hela-genome'])) throw new Error('First memory call did not start only Genome');
              const reopened = await probeMcp('', { profile: profile.id, runtime: id === 'hela-runtime',
                launch: { command: server.command, args: server.args }, timeoutMs: 30000, calls: [{ name: 'read_graph' }] });
              if (!JSON.stringify(reopened.calls).includes(entity)) throw new Error(`Memory did not persist across client restarts: ${mode}`);
              persistence = true;
              clientConnections++;
            }
          }
        }
      }
      configurations++;
    }
    const row = { profile: profile.id, mode, status: report.status, servers: report.servers.length,
      httpReady: report.servers.some(server => server.httpReady === true), configurations, clientConnections, persistence };
    results.push(row);
    console.log(`PASS ${profile.id}/${mode}: ${row.servers} MCP endpoints; ${configurations} client formats${row.httpReady ? '; private HTTP verified' : ''}`);
  }
  if (options.out) atomicJson(options.out, { scope: '40 isolated mode/profile acceptance checks using freshly built shared artifacts, not 40 independent cold rebuilds; hardware/providers/GUI authentication excluded', results });
  console.log(`PASS ${results.length} mode/profile checks, ${results.reduce((sum, row) => sum + row.configurations, 0)} client configurations`);
} finally { fs.rmSync(scratch, { recursive: true, force: true }); }
