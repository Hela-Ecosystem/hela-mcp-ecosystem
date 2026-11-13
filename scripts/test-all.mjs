#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './installation.mjs';
import { parseScopeArgs, selectedServers, packageScripts } from './scope.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const usage = 'Usage: node scripts/test-all.mjs [--all | --profile ID | SERVER_KEY ...]';
const inputArgs = process.argv.slice(2);
const scope = parseScopeArgs(inputArgs.length ? inputArgs : ['--all'], usage);
if (scope.help) process.exit(0);
const servers = await selectedServers(root, scope);
if (!servers.length) throw new Error('No servers selected');

let failed = 0;
for (const server of servers) {
  if (!fs.existsSync(server.dir)) {
    console.warn(`[hela-test] ${server.key} not found. Skipping.`);
    continue;
  }
  const scripts = packageScripts(server.dir);
  if (!scripts.test) {
    console.warn(`[hela-test] ${server.key} has no test script. Skipping.`);
    continue;
  }
  console.log(`[hela-test] Testing ${server.alias} (${server.key}) ...`);
  try {
    run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test'], { cwd: server.dir, stdio: 'inherit' });
    console.log(`[hela-test] Passed ${server.alias}`);
  } catch (error) {
    console.error(`[hela-test] Failed ${server.alias}: ${error.message}`);
    failed += 1;
  }
}
if (failed) process.exitCode = 1;
