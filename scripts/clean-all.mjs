#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './installation.mjs';
import { parseScopeArgs, selectedServers, packageScripts } from './scope.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const full = argv.includes('--full');
const scopeArgs = argv.filter((arg) => arg !== '--full');
const scope = parseScopeArgs(scopeArgs.length ? scopeArgs : ['--all'], 'Usage: node scripts/clean-all.mjs [--all | --profile ID | SERVER_KEY ...] [--full]');
if (scope.help) process.exit(0);
const servers = await selectedServers(root, scope);
if (!servers.length) throw new Error('No servers selected');

for (const server of servers) {
  for (const name of ['dist', 'build', 'coverage', '.tmp']) {
    fs.rmSync(path.join(server.dir, name), { recursive: true, force: true });
  }
  const scripts = packageScripts(server.dir);
  if (scripts.clean) {
    try {
      run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'clean', '--silent'], { cwd: server.dir, stdio: 'inherit' });
    } catch (error) {
      if (full) throw error;
      console.warn(`[hela-clean] ${server.key} clean script failed: ${error.message}`);
    }
  }
  console.log(`[hela-clean] Cleaned ${server.alias}`);
}
