#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { run } from './installation.mjs';
import { parseScopeArgs, selectedServers } from './scope.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const usage = 'Usage: node scripts/build-all.mjs [--all | --profile ID | SERVER_KEY ...]';
const inputArgs = process.argv.slice(2);
const scope = parseScopeArgs(inputArgs.length ? inputArgs : ['--all'], usage);
if (scope.help) process.exit(0);
const servers = await selectedServers(root, scope);
if (!servers.length) throw new Error('No servers selected');

let failed = 0;
for (const server of servers) {
  if (!fs.existsSync(server.dir)) {
    console.warn(`[hela-build] ${server.key} not found. Skipping.`);
    failed += 1;
    continue;
  }
  if (!fs.existsSync(path.join(server.dir, 'package.json'))) {
    console.warn(`[hela-build] ${server.key} has no package.json. Skipping.`);
    failed += 1;
    continue;
  }
  console.log(`[hela-build] Building ${server.alias} (${server.key}) ...`);
  try {
    run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: server.dir, stdio: 'inherit' });
    console.log(`[hela-build] Built ${server.alias}`);
  } catch (error) {
    console.error(`[hela-build] Failed ${server.alias}: ${error.message}`);
    failed += 1;
  }
}
if (failed) process.exitCode = 1;
