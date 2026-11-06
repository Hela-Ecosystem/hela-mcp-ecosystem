#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { probeMcp } from './mcp-probe.mjs';
import { loadInventory, resolveServerDir, selectProfile } from './inventory.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = loadInventory(root);
const inventory = data.inventory;
const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'config/snapshots/latest-stable.json'), 'utf8'));
const profileIndex = process.argv.indexOf('--profile');
const profile = profileIndex === -1 ? null : process.argv[profileIndex + 1];
const selected = profile ? selectProfile(data, profile) : null;
if (profileIndex !== -1 && !selected) throw new Error('Unknown or missing verification profile');
const report = [];

for (const spec of Object.values(inventory)) {
  const runtime = spec.kind === 'runtime' || spec.id === 'hela-runtime';
  if (selected && !runtime && !selected.servers.includes(spec.id)) continue;
  const directory = resolveServerDir(spec, root);
  const result = { id: spec.id, ok: false, package: null, initialize: null, inventory: spec.version ?? null,
    snapshot: snapshot.servers?.[spec.id]?.serverVersion ?? null, tools: 0, commitMatch: false };
  try {
    const packagePath = [path.join(directory, 'package.json'), path.join(directory, 'brain/package.json')]
      .find(candidate => fs.existsSync(candidate));
    if (!packagePath) throw new Error('Package metadata missing');
    result.package = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version;
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    result.commitMatch = commit === spec.revision && commit === snapshot.servers?.[spec.id]?.commit;
    const probe = await probeMcp(path.join(directory, spec.entry), { ecosystemRoot: root, runtime, profile: profile || 'minimal' });
    result.initialize = probe.serverInfo.version;
    result.tools = probe.tools.length;
    result.ok = result.commitMatch && [result.package, result.initialize, result.inventory, result.snapshot]
      .every(version => typeof version === 'string' && version === result.package);
    if (spec.id === 'hela-genome' && !['create_mission', 'list_missions', 'update_mission'].every(name => probe.tools.some(tool => tool.name === name))) {
      result.ok = false;
      result.error = 'Genome mission tools missing';
    }
  } catch (error) { result.error = error.message; }
  report.push(result);
}

if (process.argv.includes('--json')) console.log(JSON.stringify({ profile: profile || 'all', isolated: true, servers: report }, null, 2));
else for (const result of report) console.log(`${result.id}: ${result.ok ? 'OK' : 'MISMATCH'} pkg=${result.package} init=${result.initialize} inventory=${result.inventory} snapshot=${result.snapshot} tools=${result.tools} pin=${result.commitMatch}${result.error ? ` (${result.error})` : ''}`);
process.exitCode = report.every(result => result.ok) ? 0 : 1;
