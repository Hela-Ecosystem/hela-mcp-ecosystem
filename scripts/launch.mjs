#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readInstallation, containerArgs } from './installation.mjs';

try {
  const prefix = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const manifest = readInstallation(prefix);
  const id = process.argv[2];
  const server = manifest.servers.find(candidate => candidate.id === id);
  const extra = process.argv.slice(3);
  if (!server || extra.some((arg, i) => !['--http', '--port'].includes(arg) && extra[i - 1] !== '--port')) throw new Error('Unknown installed server/launch option');
  const http = manifest.transport === 'http' || extra.includes('--http');
  const port = extra.includes('--port') ? Number(extra[extra.indexOf('--port') + 1]) : manifest.port ?? 8080;
  if (!Number.isInteger(port) || port < 1 || port > 65535 || http && id !== 'hela-runtime') throw new Error('Invalid runtime HTTP selection');
  if (fs.existsSync(path.join(prefix, '.hela-install.pending.json'))) throw new Error('Installation is incomplete; run installer/doctor');
  const data = path.join(prefix, 'data', id);
  fs.mkdirSync(data, { recursive: true, mode: 0o700 });
  fs.mkdirSync(manifest.workspace, { recursive: true });
  const env = { ...process.env, HOME: data, XDG_DATA_HOME: data, XDG_CACHE_HOME: path.join(data, 'cache'),
    XDG_CONFIG_HOME: path.join(data, 'config'), GUARDIAN_CENTRAL_DB: path.join(data, 'memory.db'),
    GUARDIAN_PROJECT_ROOT: manifest.workspace, MEMORY_FILE_PATH: path.join(data, 'memory.json'),
    HELA_PROFILE: manifest.profile, HELA_ECOSYSTEM_ROOT: manifest.ecosystemRoot };
  env.PATH = path.dirname(manifest.node) + path.delimiter + (process.env.PATH || '');
  const needleRoot = path.join(prefix, 'chaining-mcp/assets/needle');
  if (fs.existsSync(path.join(needleRoot, 'needle3'))) {
    env.NEEDLE_ENGINE_PATH ||= path.join(needleRoot, 'needle3');
    env.NEEDLE_MODEL_PATH ||= path.join(needleRoot, 'needle3.cact');
    env.NEEDLE_TOOL_INDEX_PATH ||= path.join(data, 'needle-tools.idx');
    env.NEEDLE_SYSTEM_PATH ||= path.join(needleRoot, 'profiles', `${manifest.profile}.txt`);
  }
  let command = manifest.node, args = [path.join(prefix, server.dir, server.entry)];
  if (manifest.mode.startsWith('docker')) {
    command = 'docker';
    args = containerArgs(manifest.imageId, `/opt/hela/${server.dir}/${server.entry}`, {
      profile: manifest.profile, workspace: manifest.workspace, data });
    if (process.platform === 'linux') args.splice(1, 0, '--user', `${process.getuid()}:${process.getgid()}`);
    const keys = id === 'hela-runtime' ? manifest.servers.flatMap(server => server.env ?? []) : server.env ?? [];
    for (const key of new Set([...keys, 'OPENROUTER_API_KEY', 'GITHUB_TOKEN', 'GOOGLE_API_KEY', 'GOOGLE_CSE_ID'])) {
      if (/^(?:HOME|XDG_|GUARDIAN_|MEMORY_FILE_PATH$|HELA_ECOSYSTEM_ROOT$|HELA_PROFILE$)/.test(key)) continue;
      if (process.env[key]) args.splice(1, 0, '--env', key);
    }
  } else if (id === 'hela-runtime' && manifest.runtimeExecutable) { command = manifest.runtimeExecutable; args = []; }
  if (http) {
    if (manifest.mode.startsWith('docker')) args.splice(1, 0, '--publish', `127.0.0.1:${port}:${port}`);
    args.push('--transport', 'http', '--host', manifest.mode.startsWith('docker') ? '0.0.0.0' : '127.0.0.1', '--port', String(port));
  }
  const child = spawn(command, args, { env, cwd: manifest.workspace, stdio: 'inherit' });
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => child.kill(signal));
  child.on('error', error => { console.error(`HeLa launch failed: ${error.code}`); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1); });
} catch (error) { console.error(`HeLa launch failed: ${error.message}`); process.exitCode = 1; }
