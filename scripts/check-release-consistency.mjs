#!/usr/bin/env node
/**
 * Release consistency check.
 *
 * A version bump has to land in seven places. The 1.10.0 release proved the
 * failure mode: package.json moved to 1.10.0, generate-docs rewrote README and
 * current-versions.md, and `--snapshot v1.10.0` resolved to nothing because the
 * snapshot pair was forgotten. Docs then advertised a snapshot that did not exist.
 *
 * This asserts the surfaces agree, and names every mismatch in one pass.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const json = relative => JSON.parse(read(relative));

const version = json('package.json').version;
const problems = [];
const expect = (label, actual) => {
  if (actual !== version) problems.push(`${label} is ${actual}, expected ${version}`);
};

// 1. README advertises the current snapshot
const readme = /Current source snapshot: \*\*v([\d.]+)\*\*/.exec(read('README.md'));
if (!readme) problems.push('README.md has no "Current source snapshot" line');
else expect('README.md snapshot', readme[1]);

// 2. latest-stable points at it
expect('config/snapshots/latest-stable.json', json('config/snapshots/latest-stable.json').snapshot_version);

// 3. the pinned snapshot exists and agrees
const snapshotPath = `config/snapshots/v${version}.json`;
if (!fs.existsSync(path.join(root, snapshotPath))) {
  problems.push(`${snapshotPath} is missing, so --snapshot v${version} resolves to nothing`);
} else {
  expect(snapshotPath, json(snapshotPath).snapshot_version);
}

// 4. the changelog leads with it
const changelog = /^## \[([\d.]+)\]/m.exec(read('CHANGELOG.md'));
if (!changelog) problems.push('CHANGELOG.md has no version heading');
else expect('CHANGELOG.md latest entry', changelog[1]);

// 5. release notes lead with it
if (fs.existsSync(path.join(root, 'RELEASE_NOTES.md'))) {
  const notes = /^## v([\d.]+)/m.exec(read('RELEASE_NOTES.md'));
  if (!notes) problems.push('RELEASE_NOTES.md has no version heading');
  else expect('RELEASE_NOTES.md latest entry', notes[1]);
}

// 6. generated version prose agrees
const currentVersions = /Ecosystem \*\*([\d.]+)\*\*/.exec(read('docs/current-versions.md'));
if (!currentVersions) problems.push('docs/current-versions.md has no ecosystem version');
else expect('docs/current-versions.md', currentVersions[1]);

// 7. the library shell footers are regenerated
const shell = read('docs/site/index.html');
if (!shell.includes(`v${version}`)) problems.push(`docs/site/index.html does not show v${version}; run npm run docs:generate`);

if (problems.length) {
  console.error(`Release consistency: ${problems.length} mismatch(es) for v${version}`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`Release consistency: v${version} agrees across package, README, snapshot pair, changelog, release notes and generated docs.`);
