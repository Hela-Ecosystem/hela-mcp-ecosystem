import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { loadInventory } from './inventory.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'docs/site');
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

for (const profile of data.profiles) for (const client of ['cursor', 'claude', 'gemini', 'antigravity', 'opencode', 'kilo', 'zed', 'codex', 'docker']) {
  test(`browser configuration: ${profile.id}/${client}`, () => {
    const output = vm.runInContext(`renderConfig(${JSON.stringify(profile.id)},${JSON.stringify(client)})`, context);
    if (client === 'codex') {
      assert.ok(!output.includes('[mcpServers.'));
      assert.equal((output.match(/^\[mcp_servers\./gm) ?? []).length, profile.servers.length);
    } else {
      const parsed = JSON.parse(output);
      const servers = parsed.mcpServers ?? parsed.context_servers ?? parsed.mcp ?? parsed.services;
      assert.deepEqual(Object.keys(servers), profile.servers);
    }
    for (const id of profile.servers) {
      const spec = data.inventory[id];
      assert.ok(output.includes(spec.dir), `${id} repository path`);
      if (client !== 'docker') assert.ok(output.includes(spec.dir + '/' + spec.entry), `${id} entrypoint`);
    }
  });
}
