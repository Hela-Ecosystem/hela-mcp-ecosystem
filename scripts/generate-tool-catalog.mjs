#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadInventory, resolveServerDir, selectProfile, featureVariants } from './inventory.mjs';
import { probeMcp } from './mcp-probe.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = loadInventory(root);

async function main() {
  let profile = 'all';
  let check = false;
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--profile') {
      profile = process.argv[++i];
      if (!profile || profile.startsWith('--')) throw new Error('Missing catalog profile');
    }
    else if (process.argv[i] === '--check') check = true;
    else throw new Error(`Unknown argument: ${process.argv[i]}`);
  }
  const selected = selectProfile(data, profile);
  const runtimeDirectory = resolveServerDir(data.inventory['hela-runtime'], root);
  const { buildDigest, repositoryRevision } = await import(pathToFileURL(path.join(runtimeDirectory, 'dist/manifest.js')).href);
  const catalogPath = path.join(root, 'config/tool-catalog.json');
  const existing = fs.existsSync(catalogPath) ? JSON.parse(fs.readFileSync(catalogPath, 'utf8')) : { format: 1, cells: {} };
  const catalog = { format: 1, cells: { ...existing.cells } };
  for (const id of selected.servers) {
    const spec = data.inventory[id];
    const directory = resolveServerDir(spec, root);
    if (repositoryRevision(directory) !== spec.revision) throw new Error(`Revision mismatch: ${id}`);
    const digest = buildDigest(root, spec);
    const entry = { revision: spec.revision, version: spec.version, digests: [digest], variants: [] };
    for (const features of featureVariants(spec)) {
      const result = await probeMcp(path.join(directory, spec.entry), { ecosystemRoot: root, featureFlags: features });
      if (result.serverInfo.version !== spec.version) throw new Error(`Version mismatch: ${id}`);
      entry.variants.push({ features, tools: result.tools });
    }
    const prior = existing.cells[id];
    const sameSchemas = prior?.revision === entry.revision && prior?.version === entry.version
      && JSON.stringify(prior.variants) === JSON.stringify(entry.variants);
    if (sameSchemas) entry.digests = [...new Set([...(prior.digests ?? [prior.digest]).filter(Boolean), digest])].sort();
    if (check && (!sameSchemas || !(prior.digests ?? [prior.digest]).includes(digest))) throw new Error(`Stale tool catalog: ${id}`);
    catalog.cells[id] = entry;
    console.log(`${check ? 'CHECK' : 'GENERATED'} ${id}: ${entry.variants.length} schema variant(s)`);
  }
  if (!check) {
    const temporary = `${catalogPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(catalog, null, 2) + '\n');
    fs.renameSync(temporary, catalogPath);
  }
  const counts = { generatedFrom: 'config/inventory.json + config/tool-catalog.json', profiles: {} };
  for (const selected of data.profiles) {
    if (!selected.servers.every(id => catalog.cells[id]?.revision === data.inventory[id].revision)) continue;
    let min = 1, max = 1;
    for (const id of selected.servers) {
      const sizes = catalog.cells[id].variants.map(variant => variant.tools.length + (variant.tools.some(tool => tool.name === 'agent_run') ? 1 : 0));
      min += Math.min(...sizes);
      max += Math.max(...sizes);
    }
    counts.profiles[selected.id] = { cells: selected.servers.length, runtimeTools: { min, max } };
  }
  const countsPath = path.join(root, 'docs/site/data/tool-counts.json');
  const markdown = Object.entries(counts.profiles).map(([id, count]) => `- \`${id}\`: ${count.cells} cells, ${count.runtimeTools.min}–${count.runtimeTools.max} runtime tools.`).join('\n');
  const documents = [
    [countsPath, JSON.stringify(counts, null, 2) + '\n'],
    [path.join(root, 'docs/generated-profile-counts.md'), '# Generated profile counts\n\nRegenerate with `npm run catalog:generate`; includes `hela.pipe` and the agent alias where enabled.\n\n' + markdown + '\n'],
  ];
  for (const [file, content] of documents) {
    if (check) {
      if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) throw new Error('Stale generated profile counts');
    } else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
