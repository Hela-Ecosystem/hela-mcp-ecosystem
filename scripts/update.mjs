#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './installation.mjs';
import { parseScopeArgs, selectedServers, packageScripts } from './scope.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const runTests = argv.includes('--test');
const syncSkills = argv.includes('--skills');
let client = null;
const filtered = [];
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--test' || argv[i] === '--skills') continue;
  if (argv[i] === '--client') {
    client = argv[++i];
    if (!client || client.startsWith('--')) throw new Error('Missing value for --client');
    continue;
  }
  filtered.push(argv[i]);
}
const scope = parseScopeArgs(filtered, 'Usage: node scripts/update.mjs [--all | --profile ID | SERVER_KEY ...] [--client CLIENT] [--skills] [--test]');
if (scope.help) process.exit(0);
const servers = await selectedServers(root, scope);
if (!servers.length) throw new Error('No servers selected');

let failed = 0;
for (const server of servers) {
  if (!fs.existsSync(server.dir)) {
    console.warn(`[hela-update] ${server.key} not found. Skipping.`);
    continue;
  }
  console.log(`[hela-update] Updating ${server.alias} (${server.key}) ...`);
  try {
    try {
      run('git', ['pull', '--quiet', 'origin', 'main'], { cwd: server.dir, stdio: 'inherit' });
    } catch {
      run('git', ['pull', '--quiet', 'origin', 'master'], { cwd: server.dir, stdio: 'inherit' });
    }
    if (fs.existsSync(path.join(server.dir, 'package.json'))) {
      run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--silent'], { cwd: server.dir, stdio: 'inherit' });
      const build = server.spec.build;
      if (build && packageScripts(server.dir)[build]) {
        run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', build], { cwd: server.dir, stdio: 'inherit' });
      }
    }
    console.log(`[hela-update] Updated ${server.alias}`);
  } catch (error) {
    console.error(`[hela-update] Failed ${server.alias}: ${error.message}`);
    failed += 1;
  }
}

if (syncSkills) {
  const args = scope.profile ? ['--profile', scope.profile] : scope.all ? ['--all'] : scope.keys;
  try { run(process.execPath, [path.join(root, 'scripts', 'sync-skills.mjs'), ...args], { cwd: root, stdio: 'inherit' }); }
  catch (error) { console.error(`[hela-update] Skill sync failed: ${error.message}`); failed += 1; }
}
if (runTests) {
  const args = scope.profile ? ['--profile', scope.profile] : scope.all ? ['--all'] : scope.keys;
  try { run(process.execPath, [path.join(root, 'scripts', 'test-all.mjs'), ...args], { cwd: root, stdio: 'inherit' }); }
  catch (error) { console.error(`[hela-update] Test suite failed: ${error.message}`); failed += 1; }
}
if (client) {
  const args = ['--reconfigure', '--client', client];
  if (scope.profile) args.push('--profile', scope.profile);
  try { run(process.execPath, [path.join(root, 'setup.mjs'), ...args], { cwd: root, stdio: 'inherit' }); }
  catch (error) { console.error(`[hela-update] Client reconfiguration failed: ${error.message}`); failed += 1; }
}
if (failed) process.exitCode = 1;
