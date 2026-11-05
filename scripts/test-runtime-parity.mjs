#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { probeMcp } from './mcp-probe.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'config/inventory.json'), 'utf8')).inventory;
const probes = [
  { cell: 'hela-nucleus', name: 'terminal_session_list', arguments: {} },
  { cell: 'hela-genome', name: 'get_session_context', arguments: { limit: 3 } },
  { cell: 'hela-membrane', name: 'list_directory', arguments: workspace => ({ path: path.join(workspace, 'parity') }) },
];
const runtimeOnly = process.argv.includes('--runtime-only');
const crashTest = process.argv.includes('--crash-test') || process.argv.length === 2;
const resolveDirectory = spec => {
  const candidates = [path.join(root, '..', spec.dir), path.join(root, spec.dir)];
  const directory = candidates.find(candidate => fs.existsSync(candidate));
  if (!directory) throw new Error(`Missing verification cell: ${spec.id}`);
  return directory;
};
function prepareWorkspace(workspace) {
  fs.mkdirSync(path.join(workspace, 'parity'));
  fs.writeFileSync(path.join(workspace, 'parity', 'fixture.txt'), 'isolated routing fixture');
}
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/time|created|modified|accessed/i.test(key)).map(([key, item]) => [key, normalize(item)]));
  if (typeof value === 'string') {
    try { return normalize(JSON.parse(value)); } catch { return value; }
  }
  return value;
}

try {
  const runtimeSpec = inventory['hela-runtime'];
  const runtimeDirectory = resolveDirectory(runtimeSpec);
  const runtime = await probeMcp(path.join(runtimeDirectory, runtimeSpec.entry), {
    ecosystemRoot: root, runtime: true, profile: 'dev-workspace', calls: probes, prepareWorkspace,
  });
  let checked = 0;
  for (const probe of probes) {
    if (!runtimeOnly) {
      const spec = inventory[probe.cell];
      const direct = await probeMcp(path.join(resolveDirectory(spec), spec.entry), { calls: [probe], prepareWorkspace });
      const routed = runtime.calls.find(call => call.name === probe.name);
      assert.deepEqual(normalize(routed.result), normalize(direct.calls[0].result), `Parity mismatch: ${probe.name}`);
    }
    checked++;
    console.log(`PASS isolated ${runtimeOnly ? 'runtime call' : 'direct/runtime parity'}: ${probe.name}`);
  }
  if (crashTest) {
    const tested = spawnSync(process.execPath, ['scripts/test.mjs'], { cwd: runtimeDirectory, stdio: 'inherit' });
    if (tested.error) throw tested.error;
    if (tested.status !== 0) throw new Error('Isolated runtime fault/recovery suite failed');
  }
  console.log(`PASS: ${checked} isolated read-only probes${crashTest ? ' plus fixture-only crash/timeout recovery' : ''}; no process-name matching or live memory access.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
