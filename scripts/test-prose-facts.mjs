import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const script = new URL('./check-prose-facts.mjs', import.meta.url).pathname;

function fixture(docText, { cells = { 'hela-one': { source: 'one-mcp', version: '1.0.0', license: 'MIT' } }, profiles = [{ id: 'minimal', servers: ['hela-one'] }] } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'prose-facts-'));
  mkdirSync(path.join(root, 'config'), { recursive: true });
  mkdirSync(path.join(root, 'docs'), { recursive: true });
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '2.0.0' }));
  writeFileSync(path.join(root, 'config', 'inventory.json'), JSON.stringify({ inventory: cells }));
  writeFileSync(path.join(root, 'config', 'profiles.json'), JSON.stringify({ profiles }));
  writeFileSync(path.join(root, 'docs', 'guide.md'), docText);
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [script, '--root', root], { encoding: 'utf8' });
}

test('clean prose passes', () => {
  const root = fixture('# Guide\n\nRun the runtime and read the inventory.\n');
  const result = run(root);
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /Prose facts consistent/);
});

test('a live version literal in prose is a failure', () => {
  const root = fixture('# Guide\n\nThis ships in runtime 1.0.0 today.\n');
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /guide\.md:3 states live version 1\.0\.0/);
});

test('an unknown repository name is a failure', () => {
  const root = fixture('# Guide\n\nSee https://github.com/Hela-Ecosystem/ghost-repo for details.\n');
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /unknown repository "ghost-repo"/);
});

test('a roster claim that disagrees with the inventory is a failure', () => {
  const root = fixture('# Guide\n\nAll eight cells are supported.\n');
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /claims all 8 cells but the inventory and profile set define 1/);
});

test('a matching roster claim passes, per-profile counts are not roster claims', () => {
  const root = fixture('# Guide\n\nAll one cells are supported. The minimal profile installs 3 cells.\n');
  const result = run(root);
  assert.equal(result.status, 0, result.stdout);
});

test('generated regions are not treated as prose', () => {
  const root = fixture('# Guide\n\n<!-- hela:version:start -->\nRuntime **1.0.0**\n<!-- hela:version:end -->\n');
  const result = run(root);
  assert.equal(result.status, 0, result.stdout);
});

test('the derived README sentence is recognised as generated, not hand-written', () => {
  const root = fixture('# Guide\n\nCurrent source snapshot: **v2.0.0**, with runtime **1.0.0**.\n');
  const result = run(root);
  assert.equal(result.status, 0, result.stdout);
});

test('a licence no cell uses is a failure', () => {
  const root = fixture('# Guide\n\nEverything here is BSD-2-Clause.\n');
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /names licence BSD-2-Clause/);
});

test('a per-profile roster claim that disagrees with profiles.json is a failure', () => {
  const root = fixture('# Guide\n\nNothing to see.\n', {
    profiles: [{ id: 'dev-workspace', servers: ['hela-one', 'hela-two'] }],
  });
  writeFileSync(path.join(root, 'docs', 'profiles.md'), '### 1. `dev-workspace` — Fixture\n\n* **Included Servers (4 Servers):**\n');
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /profile "dev-workspace" claims 4 servers, config\/profiles\.json defines 2/);
});

test('a worded per-profile roster claim is checked too', () => {
  const root = fixture('# Guide\n\nNothing to see.\n', {
    profiles: [{ id: 'minimal', servers: ['hela-one', 'hela-two', 'hela-three'] }],
  });
  writeFileSync(path.join(root, 'docs', 'profiles.md'), '### `minimal` — Fixture\n\nThree servers: `hela-one`.\n');
  const clean = run(root);
  assert.equal(clean.status, 0, clean.stdout);
  writeFileSync(path.join(root, 'docs', 'profiles.md'), '### `minimal` — Fixture\n\nFive servers: `hela-one`.\n');
  const drifted = run(root);
  assert.equal(drifted.status, 1);
  assert.match(drifted.stdout, /claims five servers/);
});
