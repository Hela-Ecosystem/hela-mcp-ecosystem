import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRelease } from './update-controller.mjs';

const manifest = (overrides = {}) => ({
  snapshot: '1.8.0',
  profile: 'minimal',
  servers: [{ id: 'hela-mitosis', version: '3.0.3', revision: 'a'.repeat(40) }],
  ...overrides,
});

const latest = (overrides = {}) => ({
  package: { version: '1.9.0' },
  snapshot: {
    snapshot_version: '1.9.0',
    servers: { 'hela-mitosis': { serverVersion: '3.0.3', commit: 'a'.repeat(40) } },
  },
  ...overrides,
});

test('release comparison reports a current installation', () => {
  const result = compareRelease(manifest({ snapshot: '1.9.0' }), latest());
  assert.equal(result.available, false);
  assert.deepEqual(result.changes, []);
});

test('release comparison reports changed revisions and versions', () => {
  const result = compareRelease(manifest(), latest({
    snapshot: { snapshot_version: '1.9.0', servers: {
      'hela-mitosis': { serverVersion: '3.0.4', commit: 'b'.repeat(40) },
    } },
  }));
  assert.equal(result.available, true);
  assert.deepEqual(result.changes, [{
    id: 'hela-mitosis',
    kind: 'updated',
    from: { version: '3.0.3', revision: 'a'.repeat(40) },
    to: { version: '3.0.4', revision: 'b'.repeat(40) },
  }]);
});

test('release comparison reports added and removed cells', () => {
  const result = compareRelease(manifest({ servers: [
    { id: 'hela-obsolete', version: '1.0.0', revision: 'c'.repeat(40) },
  ] }), latest({
    snapshot: { snapshot_version: '1.9.0', servers: {
      'hela-mitosis': { serverVersion: '3.0.3', commit: 'a'.repeat(40) },
    } },
  }));
  assert.deepEqual(result.changes, [
    { id: 'hela-mitosis', kind: 'added', from: null, to: '3.0.3', revision: 'a'.repeat(40) },
    { id: 'hela-obsolete', kind: 'removed', from: '1.0.0', to: null },
  ]);
});
