#!/usr/bin/env node
/**
 * Catch prose that restates a fact the build already knows.
 *
 * Two shipped bugs came from this class: a page claiming "runtime 1.2.1" after
 * the runtime moved, and footers asserting an "MIT LICENSE" for cells that are
 * GPL. Generated pages cannot drift because they are regenerated; hand-written
 * prose can, and nothing checked it.
 *
 * Rules, applied to current prose only (dated records and changelogs are history
 * and must keep their numbers):
 *   R1 repository names must be sources the inventory knows about
 *   R2 no literal version that is live today (state it in current-versions.md)
 *   R3 cell/profile counts must match the inventory and the profile set
 *   R4 licence identifiers must be ones the inventory actually uses
 *
 * Usage: node scripts/check-prose-facts.mjs [--json] [--root <dir>]
 */
import fs from 'node:fs';
import path from 'node:path';

const rootArg = process.argv.indexOf('--root');
const root = rootArg === -1 ? path.resolve(import.meta.dirname, '..') : path.resolve(process.argv[rootArg + 1]);
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'config', 'inventory.json'), 'utf8')).inventory;
const profiles = JSON.parse(fs.readFileSync(path.join(root, 'config', 'profiles.json'), 'utf8')).profiles;
const ecosystem = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const KNOWN_REPOS = new Set([
  ...Object.values(inventory).map((item) => item.source),
  'hela-runtime',
  'hela-mcp-ecosystem',
]);
const LIVE_VERSIONS = new Set([
  ecosystem.version,
  ...Object.values(inventory).map((item) => item.version),
]);
const LIVE_LICENCES = new Set([...Object.values(inventory).map((item) => item.license), 'MIT', 'Apache-2.0']);
const CELL_COUNT = Object.keys(inventory).filter((id) => id !== 'hela-runtime').length;
const PROFILE_COUNT = profiles.length;
const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
};

/** Dated records, generated pages and changelogs are history, not claims. */
function isHistorical(file) {
  return /(-|^)(20\d\d-\d\d-\d\d|deployment|verification|refresh|audit|acceptance)/i.test(file)
    || /current-versions\.md$/.test(file)
    || /CHANGELOG\.md$/.test(file)
    || /todo\.md$/.test(file);
}

function proseFiles() {
  const files = [];
  for (const dir of ['docs', 'docs/site']) {
    if (!fs.existsSync(path.join(root, dir))) continue;
    for (const name of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (!name.isFile() || !/\.(md|html|txt)$/.test(name.name)) continue;
      const rel = path.posix.join(dir, name.name);
      if (isHistorical(name.name) || isHistorical(rel)) continue;
      if (name.name === 'release-data.js') continue;
      files.push(rel);
    }
  }
  if (fs.existsSync(path.join(root, 'README.md'))) files.push('README.md');
  return files;
}

/** Blank out generated regions so a derived sentence is never counted as prose. */
function maskGenerated(text) {
  return text
    .replace(/<!--\s*hela:[\w-]+:start\s*-->[\s\S]*?<!--\s*hela:[\w-]+:end\s*-->/g,
      (block) => block.replace(/[^\n]/g, ' '))
    // The site pages carry generated chrome: a version strip, JSON-LD
    // softwareVersion and cache-busted asset URLs. generate-docs rewrites all of
    // them, so their contents are derived even without marker comments.
    .replace(/<div class="doc-brand-meta">[^<]*<\/div>/g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/"softwareVersion":\s*"[^"]*"/g, (block) => ' '.repeat(block.length))
    // Sentences generate-docs rewrites in place from the inventory.
    .replace(/Current source snapshot: \*\*v[\d.]+\*\*, with runtime \*\*[\d.]+\*\*/g, (block) => ' '.repeat(block.length))
    .replace(/(?:Optional runtime|Runtime opsional) \d+\.\d+\.\d+/g, (block) => ' '.repeat(block.length))
    .replace(/Runtime\s+\*\*\d+\.\d+\.\d+\*\*/g, (block) => ' '.repeat(block.length))
    .replace(/\?v=[0-9][^"'\s&]*/g, (block) => ' '.repeat(block.length));
}

/**
 * Per-profile rosters are restated in docs/profiles.md ("Included Servers (8
 * Servers)", "Three servers:"). A profile that grows a cell leaves that sentence
 * lying, so check the claim against config/profiles.json section by section.
 */
function checkProfileRosters(rel) {
  if (!/profiles\.md$/.test(rel)) return [];
  const text = maskGenerated(fs.readFileSync(path.join(root, rel), 'utf8'));
  const problems = [];
  const sections = text.split(/^###\s+/m).slice(1);
  for (const section of sections) {
    const heading = section.split('\n')[0];
    const id = heading.match(/`([a-z0-9-]+)`/)?.[1];
    if (!id) continue;
    const profile = profiles.find((entry) => entry.id === id);
    if (!profile) continue;
    const expected = profile.servers.length;
    const numeric = section.match(/Included Servers \((\d+)\s+Servers?\)/i);
    const worded = section.match(/^\s*(one|two|three|four|five|six|seven|eight|nine|ten)\s+servers?:/im);
    if (numeric && Number(numeric[1]) !== expected) {
      problems.push(`${rel} profile "${id}" claims ${numeric[1]} servers, config/profiles.json defines ${expected}`);
    }
    if (worded && NUMBER_WORDS[worded[1].toLowerCase()] !== expected) {
      problems.push(`${rel} profile "${id}" claims ${worded[1].toLowerCase()} servers, config/profiles.json defines ${expected}`);
    }
  }
  return problems;
}

function checkFile(rel) {
  const raw = fs.readFileSync(path.join(root, rel), 'utf8');
  const text = maskGenerated(raw);
  const problems = [];
  const lines = text.split('\n');

  lines.forEach((line, index) => {
    const at = `${rel}:${index + 1}`;
    if (/https?:\/\/\S*github\.com\/Hela-Ecosystem\//.test(line)) {
      for (const match of line.matchAll(/github\.com\/Hela-Ecosystem\/([A-Za-z0-9._-]+)/g)) {
        const repo = match[1].replace(/\.git$/, '');
        if (!KNOWN_REPOS.has(repo)) problems.push(`${at} unknown repository "${repo}" — not a source in config/inventory.json`);
      }
    }
    if (!/https?:\/\//.test(line)) {
      for (const match of line.matchAll(/\b(\d+\.\d+\.\d+)\b/g)) {
        if (LIVE_VERSIONS.has(match[1])) {
          problems.push(`${at} states live version ${match[1]} in prose; link to docs/current-versions.md or put it in a generated block`);
        }
      }
    }
    // Only roster claims are checkable: "minimal installs 3 cells" describes one
    // profile and is data, while "all eight profiles" restates the whole set.
    for (const match of line.matchAll(/\ball\s+([a-z]+|\d{1,2})\s+(cells|profiles|servers)\b/gi)) {
      const word = match[1].toLowerCase();
      const value = NUMBER_WORDS[word] ?? (/^\d+$/.test(word) ? Number(word) : null);
      if (value === null) continue;
      const expected = match[2].toLowerCase() === 'profiles' ? PROFILE_COUNT : CELL_COUNT;
      if (value !== expected) {
        problems.push(`${at} claims all ${value} ${match[2]} but the inventory and profile set define ${expected}`);
      }
    }
    for (const match of line.matchAll(/\b(GPL-3\.0-or-later|Apache-2\.0|BSD-[23]-Clause|ISC|MIT)\b/g)) {
      if (!LIVE_LICENCES.has(match[1]) && match[1] !== 'MIT' && match[1] !== 'Apache-2.0') {
        problems.push(`${at} names licence ${match[1]}, which no cell in the inventory uses`);
      }
    }
  });
  return problems;
}

const problems = [];
const files = proseFiles();
for (const file of files) {
  problems.push(...checkFile(file));
  problems.push(...checkProfileRosters(file));
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ files: files.length, problems }, null, 2));
} else if (problems.length) {
  console.log(`Prose fact check failed across ${files.length} current files:`);
  for (const problem of problems) console.log(`  ${problem}`);
} else {
  console.log(`Prose facts consistent across ${files.length} current files (${CELL_COUNT} cells, ${PROFILE_COUNT} profiles, ${LIVE_VERSIONS.size} live versions).`);
}
process.exitCode = problems.length ? 1 : 0;
