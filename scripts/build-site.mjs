#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { categories, describeDocument, escapeHtml, isDocument, ORIGIN, publishedDocumentPath, readPublicFile, relativeUrl, renderDocument, renderLibraryIndex, renderShell, renderSidebar, rewriteLink, trackedFiles } from './document-library.mjs';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function buildSite({ root = defaultRoot, output = path.join(root, '_site') } = {}) {
  root = fs.realpathSync(root);
  output = path.resolve(output);
  if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) throw new Error('Build output cannot be a symlink');
  let ancestor = output;
  const suffix = [];
  while (!fs.existsSync(ancestor)) { suffix.unshift(path.basename(ancestor)); ancestor = path.dirname(ancestor); }
  output = path.join(fs.realpathSync(ancestor), ...suffix);
  if (output === root || root.startsWith(output + path.sep) || ['docs', 'assets', 'scripts', 'config', 'conductor', 'node_modules', '.git'].some(name => output === path.join(root, name) || output.startsWith(path.join(root, name) + path.sep))) {
    throw new Error('Build output must not overwrite source directories');
  }
  const owner = path.join(output, '.hela-docs-build.json');
  if (fs.existsSync(owner) && fs.lstatSync(owner).isSymbolicLink()) throw new Error('Build manifest cannot be a symlink');
  if (fs.existsSync(output) && fs.readdirSync(output).length && !fs.existsSync(owner)) throw new Error('Refusing an unowned, non-empty build directory');
  if (fs.existsSync(owner)) {
    const previous = JSON.parse(fs.readFileSync(owner, 'utf8'));
    const owned = new Set([...(previous.files ?? []), '.hela-docs-build.json']);
    const inspect = directory => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) throw new Error('Build output contains a symlink');
        if (entry.isDirectory()) inspect(file);
        else if (!owned.has(path.relative(output, file).split(path.sep).join('/'))) throw new Error('Build output contains an unowned file; refusing publication');
      }
    };
    inspect(output);
  }
  const tracked = new Set(trackedFiles(root));
  const documents = [...tracked].filter(isDocument).map(source => {
    const text = readPublicFile(root, source).toString('utf8');
    return { ...describeDocument(source, text), text };
  });
  const bySource = new Map(documents.map(document => [document.source, document]));
  const resources = new Set([...tracked].filter(source => /^config\/[^\0]+\.(?:json|toml|ya?ml)$/.test(source) || /^conductor\/tracks\/[^/]+\/metadata\.json$/.test(source)));
  const pkg = JSON.parse(readPublicFile(root, 'package.json'));
  const inventory = JSON.parse(readPublicFile(root, 'config/inventory.json'));
  const release = { ecosystem: pkg.version, runtime: inventory.inventory['hela-runtime'].version };
  const outputs = new Map();
  const sourceSite = path.join(root, 'docs/site');
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name), relative = path.relative(sourceSite, full).split(path.sep).join('/');
      if (entry.isSymbolicLink()) throw new Error('Website sources cannot contain symlinks');
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) visit(full);
      else if (/\.(?:html|css|js|json|txt|xml|svg|png|jpe?g|webp|ico|woff2?)$/.test(entry.name) || entry.name === 'CNAME') outputs.set(relative, fs.readFileSync(full));
    }
  };
  visit(sourceSite);
  for (const source of tracked) {
    if (source.startsWith('assets/')) outputs.set(source, readPublicFile(root, source));
  }
  for (const source of resources) outputs.set(`library/source/${source}`, readPublicFile(root, source));
  for (const document of documents) {
    outputs.set(`library/source/${document.source}`, readPublicFile(root, document.source));
    for (const language of ['en', 'id']) {
      const page = publishedDocumentPath(document, language);
      const rendered = renderDocument(document.text, document, { language, page, documents: bySource, resources, tracked });
      const archive = document.archived ? `<p class="admonition library-history">${language === 'id' ? 'Catatan historis: versi dan hasil verifikasi menggambarkan kondisi pada saat dokumen ditulis.' : 'Historical record: versions and verification results describe the state when this document was written.'}</p>` : '';
      const firstHeading = rendered.html.match(/^<h1\b[\s\S]*?<\/h1>\s*/)?.[0] ?? '';
      const content = `<article class="library-article" lang="en">${firstHeading}<header class="library-document-meta" lang="${language}"><p class="library-kicker">${categories[document.category][language]}</p><p class="library-source">${escapeHtml(document.source)}</p><p>${language === 'id' ? 'Isi dalam bahasa sumber.' : 'Original source language.'} <a href="${relativeUrl(page, `library/source/${document.source}`)}" download>${language === 'id' ? 'Unduh sumber' : 'Download source'}</a> · <a href="${relativeUrl(page, (language === 'id' ? 'id/' : '') + 'library.html')}">${language === 'id' ? 'Semua dokumen' : 'All documents'}</a></p></header>${archive}${rendered.html.slice(firstHeading.length)}</article>`;
      const toc = rendered.headings.filter(heading => heading.level === 2).map(heading => `<li><a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.title)}</a></li>`).join('');
      outputs.set(page, renderShell({ language, page, title: document.title, description: document.summary || document.title, content, toc, version: release.ecosystem, runtime: release.runtime }));
    }
  }
  for (const language of ['en', 'id']) outputs.set((language === 'id' ? 'id/' : '') + 'library.html', renderLibraryIndex(documents, language, release));
  const entries = documents.map(({ source, title, summary, category, archived, link, text }) => ({ source, title, summary, category, archived, link, text }));
  outputs.set('library-data.js', '// Generated public documentation index.\nglobalThis.HELA_LIBRARY = ' + JSON.stringify(entries).replace(/</g, '\\u003c') + ';\n');
  for (const [page, value] of outputs) {
    if (!page.endsWith('.html') || page.startsWith('library/') || page.startsWith('id/library/') || page === 'library.html' || page === 'id/library.html') continue;
    const language = page.startsWith('id/') ? 'id' : 'en';
    const assetPrefix = language === 'id' ? '../' : '';
    let html = value.toString();
    if (!/<aside class="doc-sidebar"[^>]*>[\s\S]*?<\/aside>/.test(html)) throw new Error(`Missing documentation sidebar: ${page}`);
    html = html.replace(/<aside class="doc-sidebar"[^>]*>[\s\S]*?<\/aside>/, () => renderSidebar({ language, page, version: release.ecosystem, runtime: release.runtime }));
    html = html.replace(/(<link rel="stylesheet" href="(?:\.\.\/)?style\.css">)/, `$1\n  <link rel="stylesheet" href="${assetPrefix}library.css">`);
    html = html.replace(/(<script src="(?:\.\.\/)?app\.js[^"<>]*"><\/script>)/, `<script src="${assetPrefix}library-data.js?v=${release.ecosystem}"></script>\n  <script src="${assetPrefix}library.js?v=${release.ecosystem}"></script>\n  $1`);
    html = html.replace(/href="(https:\/\/github\.com\/Hela-Ecosystem\/hela-mcp-ecosystem\/blob\/master\/[^"<>]+)"/g, (full, href) => {
      const source = href.split('/blob/master/')[1].split('#')[0];
      return bySource.has(source) ? `href="${escapeHtml(rewriteLink(href, 'README.md', page, language, bySource, resources, tracked))}"` : full;
    });
    outputs.set(page, html);
  }
  for (const [page, value] of outputs) {
    if (!page.endsWith('.html')) continue;
    outputs.set(page, value.toString().replace(/((?:src|href)="(?:\.\.\/)*(app\.js|library-data\.js|library\.js|library\.css))(?:\?[^"<>]*)?"/g, (_, start, asset) => {
      const revision = createHash('sha256').update(outputs.get(asset)).digest('hex').slice(0, 12);
      return `${start}?v=${release.ecosystem}&amp;rev=${revision}"`;
    }));
  }
  const sitemap = outputs.get('sitemap.xml')?.toString() ?? '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';
  const libraryUrls = [...outputs.keys()].filter(file => file.endsWith('.html') && /(?:^|\/)library(?:\/|\.html)/.test(file));
  outputs.set('sitemap.xml', sitemap.replace('</urlset>', libraryUrls.map(file => `<url><loc>${ORIGIN}/${escapeHtml(file)}</loc></url>`).join('\n') + '\n</urlset>'));
  outputs.set('llms.txt', (outputs.get('llms.txt')?.toString() ?? '') + '\n## Complete documentation\n\n- [Document library](' + ORIGIN + '/library.html)\n- [Full documentation text](' + ORIGIN + '/llms-full.txt)\n\n' + documents.map(document => `- [${document.title}](${ORIGIN}/${document.link}): ${document.source}`).join('\n') + '\n');
  outputs.set('llms-full.txt', documents.map(document => `# Source: ${document.source}\nURL: ${ORIGIN}/${document.link}\n\n${document.text}`).join('\n\n---\n\n'));
  outputs.set('.nojekyll', '');
  fs.mkdirSync(output, { recursive: true });
  if (fs.existsSync(owner)) {
    const previous = JSON.parse(fs.readFileSync(owner, 'utf8'));
    for (const file of previous.files ?? []) {
      if (typeof file !== 'string' || file.startsWith('/') || file.split('/').some(part => part === '..' || !part)) throw new Error('Unsafe previous build manifest');
      const target = path.join(output, file);
      if (!outputs.has(file) && fs.existsSync(target) && fs.lstatSync(target).isFile()) fs.unlinkSync(target);
    }
  }
  for (const [file, content] of outputs) {
    const target = path.join(output, file);
    let directory = output;
    for (const part of file.split('/').slice(0, -1)) {
      directory = path.join(directory, part);
      if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) throw new Error('Build path cannot traverse symlinks');
    }
    if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error('Build file cannot be a symlink');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  fs.writeFileSync(owner, JSON.stringify({ format: 1, documents: documents.map(({ source, link }) => ({ source, link })), files: [...outputs.keys()].sort() }, null, 2) + '\n');
  return { output, documents, files: [...outputs.keys()] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--output')) throw new Error('Usage: build-site.mjs [--output DIRECTORY]');
  const result = buildSite(args.length ? { output: args[1] } : {});
  console.log(`Built ${result.documents.length} public documents in EN/ID navigation, ${result.files.length} files: ${result.output}`);
}
