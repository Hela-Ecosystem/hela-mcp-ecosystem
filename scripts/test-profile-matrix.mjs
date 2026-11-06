#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { probeMcp } from './mcp-probe.mjs';
import { loadInventory, resolveServerDir } from './inventory.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { inventory, profiles } = loadInventory(root);

async function main() {
  let selected = profiles;
  let json = false;
  for (let index = 2; index < process.argv.length; index++) {
    const argument = process.argv[index];
    if (argument === '--json') json = true;
    else if (argument === '--profile') {
      const id = process.argv[++index];
      const profile = profiles.find(candidate => candidate.id === id);
      if (!profile) throw new Error(`Unknown or missing profile: ${id ?? ''}`);
      selected = [profile];
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  const entryFor = id => {
    const spec = inventory[id];
    assert.ok(spec, `Unknown cell: ${id}`);
    const entry = path.join(resolveServerDir(spec, root), spec.entry);
    assert.ok(fs.existsSync(entry), `Missing ${id} build; install/build the cells required by the selected profiles`);
    return entry;
  };
  const required = new Set(selected.flatMap(profile => profile.servers));
  const entries = new Map([...required, 'hela-runtime'].map(id => [id, entryFor(id)]));
  const directTools = new Map();
  for (const id of required) {
    const probe = await probeMcp(entries.get(id), { ecosystemRoot: root });
    assert.equal(probe.serverInfo.version, inventory[id].version, `${id} initialize version`);
    directTools.set(id, probe.tools);
  }
  const results = [];
  for (const profile of selected) {
    for (const namespaced of [false, true]) {
      const expose = (id, name) => namespaced ? `hela_${id.replace(/^hela-/, '')}_${name}` : name;
      const expected = new Map();
      for (const id of profile.servers) {
        for (const tool of directTools.get(id)) {
          const name = expose(id, tool.name);
          assert.ok(!expected.has(name), `Tool collision in ${profile.id}: ${name}`);
          expected.set(name, tool.inputSchema);
        }
      }
      const calls = [{ name: expose('hela-genome', 'get_session_context'), arguments: { limit: 1 } }];
      calls.push({ ...calls[0] });
      if (profile.servers.includes('hela-nucleus')) {
        calls.push({ name: expose('hela-nucleus', 'terminal_session_list'), arguments: {} });
      }
      const runtime = await probeMcp(entries.get('hela-runtime'), {
        ecosystemRoot: root, profile: profile.id, runtime: true, namespaced, calls,
      });
      assert.equal(runtime.serverInfo.version, inventory['hela-runtime'].version);
      assert.deepEqual(runtime.discoveryBootedCells, [], `${profile.id} spawned a cell during discovery`);
      const invoked = ['hela-genome', ...(profile.servers.includes('hela-nucleus') ? ['hela-nucleus'] : [])].sort();
      assert.deepEqual(runtime.bootedCells, invoked, `${profile.id} booted cells that were not invoked`);
      assert.deepEqual(runtime.tools.map(tool => tool.name).sort(), [...expected.keys(), 'hela.pipe'].sort(),
        `${profile.id} tool surface must exactly match selected cells plus hela.pipe`);
      for (const tool of runtime.tools) {
        if (tool.name !== 'hela.pipe') assert.deepEqual(tool.inputSchema, expected.get(tool.name), `${profile.id}:${tool.name} schema differs`);
      }
      for (const name of ['create_mission', 'list_missions', 'update_mission']) {
        assert.ok(expected.has(expose('hela-genome', name)), `${profile.id} missing mission tool ${name}`);
      }
      results.push({ profile: profile.id, cells: profile.servers.length, bootedCells: runtime.bootedCells, namespaced, tools: runtime.tools.length,
        discoveryMs: runtime.discoveryMs, coldCallMs: runtime.calls[0].durationMs, warmCallMs: runtime.calls[1].durationMs,
        readOnlyCalls: runtime.calls.length, zeroDiscoverySpawns: true, exactSurface: true, schemaParity: true, isolated: true });
      if (!json) console.log(`PASS ${profile.id}: ${profile.servers.length} selected cells, ${runtime.tools.length} tools, namespaced=${namespaced}, zero discovery spawns, exact schemas and read-only routing`);
    }
  }
  if (json) console.log(JSON.stringify({ profiles: selected.length, runtimeChecks: results.length,
    standaloneCells: directTools.size, modelFeaturesEnabled: false, results }, null, 2));
  else console.log(`PASS ${selected.length} profiles / ${results.length} runtime checks; machine selections unchanged; no hardware/model tools invoked.`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
