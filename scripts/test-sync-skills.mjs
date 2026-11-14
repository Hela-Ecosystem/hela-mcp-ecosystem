import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

test('skill sync preserves installed mema-vault runtime data', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hela-skill-sync-'));
  const target = path.join(tmp, 'skills');
  const runtimeData = path.join(target, 'mema-vault', 'data');
  try {
    fs.mkdirSync(runtimeData, { recursive: true });
    fs.writeFileSync(path.join(runtimeData, 'keep.db'), 'runtime-state', 'utf8');

    const result = spawnSync(process.execPath, [
      path.join(root, 'scripts', 'sync-skills.mjs'),
      'hela-mitosis',
      '--target',
      target,
      '--json',
    ], { cwd: root, encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.readFileSync(path.join(runtimeData, 'keep.db'), 'utf8'), 'runtime-state');
    assert.ok(fs.existsSync(path.join(target, 'pcb', 'SKILL.md')));
    assert.ok(!fs.existsSync(path.join(runtimeData, 'vault.db')));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
