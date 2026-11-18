import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, after } from 'node:test';
import { tmpdir } from 'node:os';
import { buildSite } from './build-site.mjs';
import { loadInventory } from './inventory.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = fs.mkdtempSync(path.join(tmpdir(), 'hela-docs-tests-'));
const site = buildSite({ root, output: temporary }).output;
after(() => fs.rmSync(temporary, { recursive: true, force: true }));
const data = loadInventory(root);
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'config/tool-catalog.json'), 'utf8'));
const context = vm.createContext({ document: { documentElement: { lang: 'en' }, addEventListener() {} }, window: { location: { pathname: '/' } } });
vm.runInContext(fs.readFileSync(path.join(site, 'release-data.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(site, 'app.js'), 'utf8'), context);

test('generated documentation matches canonical versions, schemas, and profile membership', () => {
  execFileSync(process.execPath, ['scripts/generate-docs.mjs', '--check'], { cwd: root, stdio: 'pipe' });
  const actual = JSON.parse(JSON.stringify(context.HELA_DOCS_DATA));
  assert.equal(actual.release.ecosystem, version);
  assert.equal(actual.release.runtime, data.inventory['hela-runtime'].version);
  for (const [id, entry] of Object.entries(actual.inventory)) {
    const spec = data.inventory[id];
    assert.equal(entry.version, spec.version);
    assert.equal(entry.dir, spec.dir);
    assert.deepEqual(entry.tools, [...new Set(catalog.cells[id].variants.flatMap(variant => variant.tools.map(tool => tool.name)))].sort());
  }
  for (const profile of data.profiles) assert.deepEqual(actual.profiles[profile.id].servers, profile.servers);
});

test('every advertised single-search tool takes query, never q', () => {
  const singleQueryTools = ['google_search', 'wikipedia_search', 'academic_search', 'multi_site_search', 'research_brief'];
  const batchTools = ['search_analytics'];
  const verified = new Set();
  const seen = new Set();
  for (const entry of Object.values(catalog.cells)) {
    for (const variant of entry.variants) {
      for (const tool of variant.tools) {
        const properties = tool.inputSchema?.properties ?? {};
        seen.add(tool.name);
        assert.ok(!Object.hasOwn(properties, 'q'), `${tool.name} must not expose the short query alias`);
        if (Object.hasOwn(properties, 'query')) {
          assert.equal(properties.query.type, 'string', `${tool.name} query type`);
          verified.add(tool.name);
        }
      }
    }
  }
  for (const name of singleQueryTools) {
    assert.ok(seen.has(name), `missing advertised tool: ${name}`);
    assert.ok(verified.has(name), `${name} must accept query`);
  }
  for (const name of batchTools) {
    assert.ok(Object.hasOwn(catalog.cells['hela-enzyme'].variants[0].tools.find(tool => tool.name === name)?.inputSchema.properties ?? {}, 'queries'), `${name} must keep the plural queries field`);
  }
  const googleSearch = catalog.cells['hela-enzyme'].variants
    .flatMap(variant => variant.tools)
    .find(tool => tool.name === 'google_search');
  assert.deepEqual(googleSearch.inputSchema.required, ['query']);
  assert.equal(googleSearch.inputSchema.additionalProperties, false);
  assert.deepEqual(googleSearch.inputSchema.properties.num, {
    type: 'integer', minimum: 1, maximum: 10, default: 5, description: 'Number of results (1-10)',
  });
  assert.ok(!Object.hasOwn(googleSearch.inputSchema.properties, 'q'));
});

test('all EN/ID pages display current versions and load generated data before the app', () => {
  for (const dir of [site, path.join(site, 'id')]) for (const name of fs.readdirSync(dir).filter(name => name.endsWith('.html'))) {
    const text = fs.readFileSync(path.join(dir, name), 'utf8');
    assert.ok(text.includes(`v${version} · Runtime ${data.inventory['hela-runtime'].version}`), `${name} version banner`);
    assert.ok(text.indexOf('release-data.js') >= 0 && text.indexOf('release-data.js') < text.indexOf('app.js'), `${name} script ordering`);
    assert.ok(text.includes(`release-data.js?v=${version}`) && text.includes(`app.js?v=${version}`), `${name} cache-busted release assets`);
    assert.ok(!/placeholder="[^"\n]*(?:292|293|347)/.test(text), `${name} stale search count`);
    const ids = [...text.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(ids.length, new Set(ids).size, `${dir}/${name} duplicate IDs`);
    for (const [, ref] of text.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(?:https?:|mailto:|data:|\/\/)/.test(ref)) continue;
      const [relative, fragment] = ref.split('#');
      const target = relative ? path.resolve(dir, relative.split('?')[0]) : path.join(dir, name);
      const asset = path.relative(path.join(site, 'assets'), target);
      const sourceAsset = !asset.startsWith('..') && !path.isAbsolute(asset) ? path.join(root, 'assets', asset) : target;
      assert.ok(fs.existsSync(target) || fs.existsSync(sourceAsset), `${dir}/${name}: missing ${ref}`);
      if (fragment && target.endsWith('.html')) {
        const targetText = fs.readFileSync(target, 'utf8');
        assert.ok(targetText.includes(`id="${decodeURIComponent(fragment)}"`), `${dir}/${name}: missing anchor ${ref}`);
      }
    }
    for (const [, json] of text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(json);
    if (name === 'architecture.html') {
      for (const [id, spec] of Object.entries(context.HELA_DOCS_DATA.inventory)) {
        assert.ok(text.includes(`· v${spec.version} ·`), `${id} visible server version`);
        assert.ok(text.includes(`<p class="tool-list">${spec.tools.join(', ')}</p>`), `${id} canonical tools`);
      }
    }
  }
});

test('current Cytosol site copy describes browser and image perception', () => {
  for (const file of [path.join(site, 'architecture.html'), path.join(site, 'id', 'architecture.html')]) {
    const text = fs.readFileSync(file, 'utf8');
    assert.match(text, /browser_image_analyze/);
    assert.match(text, /Mirage/);
    assert.match(text, /75 (?:tools|alat)/);
  }
  const machineGuide = fs.readFileSync(path.join(site, 'llms.txt'), 'utf8');
  assert.match(machineGuide, /HeLa Cytosol \(browser automation, DOM\/accessibility perception, OCR, visual analysis, detection, segmentation, standalone-image analysis, 75 tools\)/);
});

test('workflow pages keep the canonical E/F capability order in both languages', () => {
  for (const file of [path.join(site, 'workflows.html'), path.join(site, 'id', 'workflows.html')]) {
    const text = fs.readFileSync(file, 'utf8');
    const e = text.indexOf('id="workflow-e"');
    const f = text.indexOf('id="workflow-f"');
    assert.ok(e >= 0 && f > e, `${file}: workflow E must precede workflow F`);
    const eSection = text.slice(e, f);
    const fSection = text.slice(f);
    assert.match(eSection, /hela-plastid:generate_modeling_plan/, `${file}: workflow E must describe Blender modeling`);
    assert.match(fSection, /hela-ribosome:agent_spawn/, `${file}: workflow F must describe PTY orchestration`);
  }
});

test('index install prompts require profile confirmation and link the profile catalog', () => {
  for (const file of [path.join(site, 'index.html'), path.join(site, 'id', 'index.html')]) {
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(text.includes('https://hela.my.id/profiles.html'), `${file}: profile catalog link`);
    assert.ok(text.includes('https://hela.my.id/library/docs/profiles.html'), `${file}: detailed profile library link`);
    assert.ok(/confirmed_profile|profil.*dikonfirmasi/i.test(text), `${file}: profile confirmation instruction`);
    assert.ok(text.includes('minimal'), `${file}: minimal fallback`);
  }
});

for (const profile of data.profiles) for (const client of ['cursor', 'claude', 'gemini', 'antigravity', 'opencode', 'kilo', 'zed', 'codex', 'docker']) {
  test(`browser configuration: ${profile.id}/${client}`, () => {
    const output = vm.runInContext(`renderConfig(${JSON.stringify(profile.id)},${JSON.stringify(client)})`, context);
    if (client === 'codex') {
      assert.ok(!output.includes('[mcpServers.'));
      assert.equal((output.match(/^\[mcp_servers\./gm) ?? []).length, 2);
    } else {
      const parsed = JSON.parse(output);
      const servers = parsed.mcpServers ?? parsed.context_servers ?? parsed.mcp ?? parsed.services;
      assert.deepEqual(Object.keys(servers), ['hela-runtime']);
    }
    assert.ok(output.includes('hela-runtime'));
    assert.ok(output.includes('HELA_PROFILE'));
    assert.ok(output.includes('HELA_ECOSYSTEM_ROOT'));
  });
}

test('browser configuration and install prompt default to minimal without a selection', () => {
  const config = vm.runInContext('renderConfig(undefined, "cursor")', context);
  assert.match(config, /"HELA_PROFILE": "minimal"/);
  const prompt = vm.runInContext('renderAgentPrompt(undefined, "cursor")', context);
  assert.match(prompt, /https:\/\/hela\.my\.id\/profiles\.html/);
  assert.match(prompt, /https:\/\/hela\.my\.id\/library\/docs\/profiles\.html/);
  assert.match(prompt, /Ask which profile best fits/);
  assert.match(prompt, /--profile <confirmed_profile>/);
  assert.match(prompt, /If the user does not choose, use minimal/);
});

test('video players are click-to-load facades, never eager embeds', () => {
  const pages = ['index.html', 'architecture.html', 'profiles.html', 'showcase.html'];
  let facades = 0;
  for (const prefix of ['', 'id/']) {
    for (const page of pages) {
      const file = path.join(site, prefix + page);
      if (!fs.existsSync(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      assert.ok(!text.includes('youtube-nocookie.com/embed'), `${file}: eager YouTube embed must not ship`);
      for (const match of text.matchAll(/<div class="video-frame video-facade"([^>]*)>/g)) {
        const attributes = match[1];
        assert.match(attributes, /data-video-id="[A-Za-z0-9_-]{11}"/, `${file}: facade needs an 11-character video id`);
        assert.match(attributes, /data-video-title="[^"]+"/, `${file}: facade needs a title for the player`);
        facades++;
      }
    }
  }
  assert.equal(facades, 42, 'overview 2 + architecture 20 + profiles 16 + showcase 4');
});

test('runtime prose follows the inventory version in both languages', () => {
  const runtimeVersion = data.inventory['hela-runtime'].version;
  const pages = [
    path.join(site, 'architecture.html'),
    path.join(site, 'id/architecture.html'),
    path.join(site, 'library/docs/on-demand-runtime.html'),
  ].filter((file) => fs.existsSync(file));

  for (const file of pages) {
    const text = fs.readFileSync(file, 'utf8');
    // Dated rollout records keep the version that was actually deployed; only the
    // current description must track the inventory.
    const historicalAt = text.search(/Historical Servy rollout/i);
    const current = historicalAt >= 0 ? text.slice(0, historicalAt) : text;
    const mentions = [...current.matchAll(/runtime(?:\s+opsional)?\s+(\d+\.\d+\.\d+)/gi)].map((match) => match[1]);
    assert.ok(mentions.length > 0, `${file}: expected a runtime version mention`);
    for (const mentioned of mentions) {
      assert.equal(mentioned, runtimeVersion, `${file}: stale runtime version ${mentioned} (inventory ${runtimeVersion})`);
    }
    if (historicalAt >= 0) {
      assert.match(text.slice(historicalAt), /runtime[\s\S]{0,60}1\.2\.0/, `${file}: the historical rollout record must keep its deployed version`);
    }
  }
});

test('every cell declares a licence and the pages follow it', () => {
  const cells = Object.entries(data.inventory).filter(([id]) => id !== 'hela-runtime');
  for (const [id, cell] of cells) {
    assert.ok(cell.license, `${id}: inventory entry has no licence`);
  }

  // The suite is MIT; the cells are not all MIT. A footer that says only "MIT LICENSE"
  // misreports what an install puts on disk, so no published page may carry that claim
  // on its own, and every page must show the blend the inventory actually describes.
  const blend = [...new Set(cells.map(([, cell]) => cell.license))]
    .sort().map(value => value.replace(/-or-later$/, '')).join(' + ');

  const pages = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.html')) pages.push(full);
    }
  };
  walk(site);
  assert.ok(pages.length > 0, 'expected generated pages');

  for (const file of pages) {
    const footer = fs.readFileSync(file, 'utf8').match(/<footer class="doc-footer">[\s\S]*?<\/footer>/)?.[0];
    if (!footer) continue;
    assert.ok(!/(?:MIT LICENSE|LISENSI MIT)\s*·/.test(footer), `${file}: footer claims the whole suite is MIT`);
    assert.ok(footer.includes(blend), `${file}: footer does not state the inventory licence blend (${blend})`);
  }

  // Each architecture card states its own cell's licence, in both languages.
  for (const page of ['architecture.html', 'id/architecture.html']) {
    const text = fs.readFileSync(path.join(site, page), 'utf8');
    for (const [id, cell] of cells) {
      const card = text.match(new RegExp(`<section class="server-card" aria-labelledby="srv-${id.slice(5)}">[\\s\\S]*?</section>`))?.[0];
      assert.ok(card, `${page}: no card for ${id}`);
      assert.match(card, new RegExp(`(?:license|lisensi) <code>${cell.license}</code>`), `${page}: ${id} card omits its licence`);
    }
    assert.match(text, /id="licensing"[^>]*>[\s\S]*?GPL-3\.0-or-later/, `${page}: missing the licensing note`);
  }
});

test('legal copy names the copyleft cells instead of claiming MIT for everything', () => {
  const runtimeVersion = data.inventory['hela-runtime'].version;
  const gpl = Object.entries(data.inventory)
    .filter(([id, spec]) => id !== 'hela-runtime' && spec.license?.startsWith('GPL'))
    .map(([, spec]) => spec.alias.replace(/^HeLa /, ''));
  for (const file of [path.join(site, 'terms.html'), path.join(site, 'id', 'terms.html')]) {
    const text = fs.readFileSync(file, 'utf8');
    assert.match(text, /GPL-3\.0-or-later/, `${file}: must name the copyleft licence`);
    for (const cell of gpl) assert.ok(text.includes(cell), `${file}: must name ${cell} as copyleft`);
    assert.ok(!/Seluruh perangkat lunak[^.]*Lisensi MIT/.test(text), `${file}: no blanket MIT claim over all software`);
  }
  const llms = fs.readFileSync(path.join(site, 'llms.txt'), 'utf8');
  assert.match(llms, /GPL-3\.0-or-later/, 'llms.txt must state the per-cell licence split');
  assert.match(llms, /hela\.update\.check/, 'llms.txt should name the runtime update tools');
  const index = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
  assert.match(index, /"license":\s*\[/, 'index JSON-LD must carry licence metadata');
  assert.ok(index.includes(runtimeVersion), 'index should reference the current runtime version somewhere');
});
