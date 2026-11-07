import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { test, after } from 'node:test';
import { buildSite } from './build-site.mjs';
import { describeDocument, isDocument, readPublicFile, renderDocument, rewriteLink, trackedFiles } from './document-library.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = fs.mkdtempSync(path.join(tmpdir(), 'hela-library-tests-'));
const output = path.join(temporary, 'site');
const result = buildSite({ root, output });
after(() => fs.rmSync(temporary, { recursive: true, force: true }));
const tracked = new Set(trackedFiles(root));
const documents = new Map(result.documents.map(document => [document.source, document]));
const context = vm.createContext({ document: { addEventListener() {} } });
vm.runInContext(fs.readFileSync(path.join(output, 'library-data.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(output, 'library.js'), 'utf8'), context);

test('every public source document has English and Indonesian navigation pages', () => {
  const expected = [...tracked].filter(isDocument);
  assert.deepEqual(result.documents.map(document => document.source), expected);
  assert.ok(expected.includes('LICENSE') && expected.includes('conductor/workflow.md'));
  for (const document of result.documents) {
    for (const prefix of ['', 'id/']) {
      const html = fs.readFileSync(path.join(output, prefix + document.link), 'utf8');
      assert.ok(html.includes('class="library-article" lang="en"'));
      assert.ok(html.includes(prefix ? 'Unduh sumber' : 'Download source'));
      if (document.archived) assert.ok(html.includes('library-history'));
    }
    assert.deepEqual(fs.readFileSync(path.join(output, 'library/source', document.source)), fs.readFileSync(path.join(root, document.source)));
  }
});

test('every generated HTML link, image, script and local heading resolves', () => {
  const pages = result.files.filter(file => file.endsWith('.html'));
  for (const page of pages) {
    const html = fs.readFileSync(path.join(output, page), 'utf8');
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(ids.length, new Set(ids).size, `${page}: duplicate IDs`);
    for (const [, raw] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const ref = raw.replace(/&amp;/g, '&');
      if (/^(?:https?:|mailto:|data:|\/\/)/.test(ref)) continue;
      const [relative, fragment] = ref.split('#');
      const target = relative ? path.resolve(output, path.dirname(page), relative.split('?')[0]) : path.join(output, page);
      assert.ok(target.startsWith(output + path.sep), `${page}: link escapes publication`);
      assert.ok(fs.existsSync(target), `${page}: missing ${ref}`);
      if (fragment && target.endsWith('.html')) assert.ok(fs.readFileSync(target, 'utf8').includes(`id="${decodeURIComponent(fragment)}"`), `${page}: missing anchor ${ref}`);
    }
  }
});

test('existing website pages link to the library and hosted guides instead of GitHub Markdown', () => {
  const overview = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  assert.ok(overview.includes('href="library.html"'));
  assert.ok(overview.includes('href="library/docs/installation.html"'));
  assert.ok(!overview.includes('/blob/master/docs/installation.md'));
  const nested = fs.readFileSync(path.join(output, 'id/library/conductor/tracks/m1-baseline-audit/spec.html'), 'utf8');
  assert.ok(nested.includes('href="../../../../library.html"'));
  assert.ok(nested.includes('href="../../../../../style.css"'));
});

test('full-text search finds commands, filenames, categories and project records', () => {
  const search = (query, category = '', prefix = '') => JSON.parse(vm.runInContext(`JSON.stringify(findLibraryDocuments(${JSON.stringify(query)},${JSON.stringify(category)},${JSON.stringify(prefix)}))`, context));
  assert.ok(search('--without-model').some(document => document.source === 'docs/installation.md'));
  assert.ok(search('keys-and-secrets.md').some(document => document.source === 'docs/keys-and-secrets.md'));
  assert.ok(search('', 'archive').every(document => document.archived));
  assert.ok(search('', '', 'conductor/code_styleguides/').length >= 4);
  assert.equal(search('a-token-that-does-not-exist-here-2026').length, 0);
  assert.equal(search('').length, result.documents.length);
});

test('rendering preserves code, tables, safe line breaks, Unicode and duplicate heading anchors', () => {
  const source = '# Example\n\n## Repeated\n\n## Repeated\n\n## 测试\n\n| A | B |\n|---|---|\n| one<br/>two | `value` |\n\n```sh\nprintf "<script>not executable</script>"\n```\n';
  const document = describeDocument('docs/example.md', source);
  const rendered = renderDocument(source, document, { language: 'en', page: document.link, documents, resources: new Set(), tracked });
  assert.deepEqual(rendered.headings.map(heading => heading.id), ['example', 'repeated', 'repeated-1', '测试']);
  assert.ok(rendered.html.includes('<table class="doc-table">'));
  assert.ok(rendered.html.includes('<caption class="visually-hidden">'));
  assert.ok(rendered.html.includes('<th scope="col">'));
  assert.ok(rendered.html.includes('one<br>two'));
  assert.ok(rendered.html.includes('&lt;script&gt;not executable&lt;/script&gt;'));
  assert.ok(!rendered.html.includes('<script>'));
});

test('unsafe HTML and script URLs never become executable document markup', () => {
  const source = '# <script>alert(1)</script>\n\n<script>alert(2)</script>\n\n[bad](javascript:alert%281%29)\n\n![bad](javascript:alert%281%29)\n';
  const document = describeDocument('docs/unsafe.md', source);
  const rendered = renderDocument(source, document, { language: 'en', page: document.link, documents, resources: new Set(), tracked });
  assert.ok(!/<script\b|href="javascript:|src="javascript:/i.test(rendered.html));
  assert.ok(rendered.html.includes('&lt;script&gt;'));
});

test('source traversal and symlinks are refused', () => {
  assert.throws(() => readPublicFile(root, '../private.md'), /Unsafe/);
  assert.throws(() => rewriteLink('../../../private.md', 'docs/test.md', 'library/docs/test.html', 'en', documents, new Set(), tracked), /escapes/);
  const fixture = path.join(temporary, 'sources');
  fs.mkdirSync(fixture);
  fs.symlinkSync(path.join(root, 'README.md'), path.join(fixture, 'README.md'));
  assert.throws(() => readPublicFile(fixture, 'README.md'), /symlinks/);
});

test('builds cannot overwrite source directories or unowned output directories', () => {
  assert.throws(() => buildSite({ root, output: root }), /overwrite/);
  assert.throws(() => buildSite({ root, output: path.join(root, 'docs/site') }), /overwrite/);
  const unowned = path.join(temporary, 'user-output');
  fs.mkdirSync(unowned);
  fs.writeFileSync(path.join(unowned, 'keep.txt'), 'user work');
  assert.throws(() => buildSite({ root, output: unowned }), /unowned/);
  assert.equal(fs.readFileSync(path.join(unowned, 'keep.txt'), 'utf8'), 'user work');
});

test('private directories, runtime databases, untracked notes and build dependencies are excluded', () => {
  assert.ok(result.files.every(file => !/(?:^|\/)(?:\.git|node_modules|\.env|memory\.db|brag-output)(?:\/|$)/.test(file)));
  assert.ok(!isDocument('.github/private.md'));
  assert.ok(!isDocument('private-notes.md'));
  assert.ok(!isDocument('docs/site/private.md'));
  assert.ok(fs.existsSync(path.join(output, 'library/source/config/codex-example.toml')));
});

test('symlink aliases cannot bypass source protection and unowned build files are not published', () => {
  const alias = path.join(temporary, 'source-alias');
  fs.symlinkSync(path.join(root, 'docs'), alias);
  assert.throws(() => buildSite({ root, output: path.join(alias, 'generated') }), /overwrite/);
  const isolated = path.join(temporary, 'isolated-site');
  buildSite({ root, output: isolated });
  fs.writeFileSync(path.join(isolated, '.env'), 'untracked-private-file');
  assert.throws(() => buildSite({ root, output: isolated }), /unowned/);
  assert.equal(fs.readFileSync(path.join(isolated, '.env'), 'utf8'), 'untracked-private-file');
});

test('sitemap and machine-readable exports cover the complete library without modifying sources', () => {
  const sitemap = fs.readFileSync(path.join(output, 'sitemap.xml'), 'utf8');
  const full = fs.readFileSync(path.join(output, 'llms-full.txt'), 'utf8');
  for (const document of result.documents) {
    assert.ok(sitemap.includes(`https://hela.my.id/${document.link}`));
    assert.ok(sitemap.includes(`https://hela.my.id/id/${document.link}`));
    assert.ok(full.includes(document.text));
  }
  assert.ok(fs.readFileSync(path.join(output, 'llms.txt'), 'utf8').includes('/llms-full.txt'));
});

test('repeated builds are deterministic', () => {
  const before = new Map(result.files.map(file => [file, fs.readFileSync(path.join(output, file))]));
  const repeated = buildSite({ root, output });
  assert.deepEqual(repeated.files, result.files);
  for (const [file, content] of before) assert.deepEqual(fs.readFileSync(path.join(output, file)), content, file);
});
