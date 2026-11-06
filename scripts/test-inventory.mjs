import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { featureVariants, loadInventory, selectProfile } from './inventory.mjs';

test('canonical inventory resolves profiles and feature variants without machine-specific branches', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const data = loadInventory(root);
  assert.equal(selectProfile(data).id, 'dev-workspace');
  assert.equal(selectProfile(data, 'all').servers.length, 10);
  assert.equal(selectProfile(data, 'dev-workspace').servers.length, 8);
  assert.throws(() => selectProfile(data, 'dev-workflow'), /Unknown profile/);
  assert.equal(featureVariants(data.inventory['hela-mitosis']).length, 4);
  assert.deepEqual(featureVariants(data.inventory['hela-genome']), [{}]);
});

for (const servers of [['hela-missing'], ['hela-runtime'], ['hela-genome', 'hela-genome']]) {
  test(`canonical inventory refuses invalid profile membership: ${servers.join(',')}`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hela-inventory-test-'));
    try {
      fs.mkdirSync(path.join(root, 'config'));
      fs.writeFileSync(path.join(root, 'config/inventory.json'), JSON.stringify({ inventory: {
        'hela-genome': { id: 'hela-genome', dir: 'genome', entry: 'index.js', version: '3.0.0' },
        'hela-runtime': { id: 'hela-runtime', kind: 'runtime', dir: 'runtime', entry: 'index.js', version: '1.2.0' },
      } }));
      fs.writeFileSync(path.join(root, 'config/profiles.json'), JSON.stringify({ profiles: [{ id: 'dev-workspace', servers }] }));
      assert.throws(() => loadInventory(root), /Invalid/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}
