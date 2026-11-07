import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import MarkdownIt from 'markdown-it';

export const ORIGIN = 'https://hela.my.id';
const repository = 'https://github.com/Hela-Ecosystem/hela-mcp-ecosystem/blob/master/';
const rootDocuments = new Set(['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'RELEASE_NOTES.md', 'LICENSE']);
export const categories = {
  gettingStarted: { en: 'Getting started', id: 'Memulai' },
  reference: { en: 'Reference', id: 'Referensi' },
  operations: { en: 'Operations & verification', id: 'Operasional & verifikasi' },
  releases: { en: 'Release history', id: 'Riwayat rilis' },
  project: { en: 'Project & contribution', id: 'Proyek & kontribusi' },
  archive: { en: 'Historical records', id: 'Arsip historis' },
};

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function trackedFiles(root) {
  return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean).sort();
}

export function isDocument(file) {
  return rootDocuments.has(file) || /^(?:docs\/(?!site\/)|conductor\/)[^\0]*\.md$/.test(file);
}

export function readPublicFile(root, relative) {
  if (!relative || path.posix.isAbsolute(relative) || relative.split('/').some(part => !part || part.startsWith('.') || part.includes('\\'))) {
    throw new Error(`Unsafe publication path: ${relative}`);
  }
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Publication refuses symlinks: ${relative}`);
  }
  if (!fs.statSync(current).isFile()) throw new Error(`Not a public file: ${relative}`);
  return fs.readFileSync(current);
}

function categoryFor(source) {
  if (/\d{4}-\d{2}-\d{2}/.test(source) || source.startsWith('conductor/tracks/')) return 'archive';
  if (/^(?:CHANGELOG|RELEASE_NOTES)\.md$/.test(source)) return 'releases';
  if (source.startsWith('conductor/') || rootDocuments.has(source) && source !== 'README.md') return 'project';
  if (/README|beginner-guide|installation\.md|integration\.md|keys-and-secrets/.test(source)) return 'gettingStarted';
  if (/troubleshooting|security-audit|installation-acceptance/.test(source)) return 'operations';
  return 'reference';
}

function inlineText(token) {
  return token?.children?.map(child => ['text', 'code_inline', 'image'].includes(child.type) ? child.content : child.type === 'softbreak' ? ' ' : '').join('') ?? token?.content ?? '';
}

export function describeDocument(source, text) {
  const tokens = new MarkdownIt({ html: false }).parse(text, {});
  const heading = tokens.findIndex(token => token.type === 'heading_open');
  const title = source === 'LICENSE' ? 'MIT License' : heading >= 0 ? inlineText(tokens[heading + 1]) : path.posix.basename(source, '.md');
  let summary = '';
  for (let index = 0; index < tokens.length; index++) {
    if (tokens[index].type !== 'paragraph_open') continue;
    const candidate = inlineText(tokens[index + 1]).replace(/\s+/g, ' ').trim();
    if (candidate.length >= 40) { summary = candidate; break; }
  }
  if (summary.length > 180) summary = summary.slice(0, 177).replace(/\s+\S*$/, '') + '…';
  const category = categoryFor(source);
  return { source, title, summary, category, archived: category === 'archive', link: `library/${source.replace(/\.md$/, '')}.html` };
}

export function relativeUrl(from, to) {
  return path.posix.relative(path.posix.dirname(from), to) || path.posix.basename(to);
}

export function publishedDocumentPath(document, language) {
  return (language === 'id' ? 'id/' : '') + document.link;
}

export function rewriteLink(value, source, page, language, documents, resources, tracked) {
  let href = value;
  if (href.startsWith(repository)) href = '/' + href.slice(repository.length);
  else if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) return href;
  const match = href.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  if (!match) throw new Error(`Invalid documentation link: ${source}`);
  let decoded;
  try { decoded = decodeURIComponent(match[1]); } catch { throw new Error(`Invalid URL encoding: ${source}`); }
  const target = path.posix.normalize(decoded.startsWith('/') ? decoded.slice(1) : path.posix.join(path.posix.dirname(source), decoded)).replace(/\/$/, '');
  if (target.startsWith('../') || target === '..' || target.includes('\\')) throw new Error(`Link escapes public sources: ${source}`);
  const suffix = (match[2] ?? '') + (match[3] ?? '');
  if (documents.has(target)) return relativeUrl(page, publishedDocumentPath(documents.get(target), language)) + suffix;
  if (target.startsWith('assets/') && tracked.has(target)) return relativeUrl(page, target) + suffix;
  if (resources.has(target)) return relativeUrl(page, `library/source/${target}`) + suffix;
  if (decoded.endsWith('/') && [...documents.keys()].some(name => name.startsWith(target + '/'))) {
    return relativeUrl(page, (language === 'id' ? 'id/' : '') + 'library.html') + '?path=' + encodeURIComponent(target + '/');
  }
  if (tracked.has(target)) return repository + target.split('/').map(encodeURIComponent).join('/') + suffix;
  throw new Error(`Unresolved source link in ${source}: ${value}`);
}

export function renderDocument(text, document, context) {
  const markdown = new MarkdownIt({ html: false, linkify: false });
  markdown.inline.ruler.before('html_inline', 'safe_break', (state, silent) => {
    const match = state.src.slice(state.pos).match(/^<br\s*\/?>/i);
    if (!match) return false;
    if (!silent) state.push('html_inline', '', 0).content = '<br>';
    state.pos += match[0].length;
    return true;
  });
  const env = {};
  const tokens = markdown.parse(text, env);
  const used = new Set();
  const headings = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type !== 'heading_open') continue;
    const label = inlineText(tokens[index + 1]);
    const base = label.toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\s-]/gu, '').replace(/\s/g, '-') || 'section';
    let slug = base, duplicate = 0;
    while (used.has(slug)) slug = `${base}-${++duplicate}`;
    used.add(slug);
    token.attrSet('id', slug);
    if (token.tag === 'h1') token.attrSet('class', 'doc-title');
    headings.push({ id: slug, title: label, level: Number(token.tag.slice(1)) });
  }
  const fence = markdown.renderer.rules.fence;
  markdown.renderer.rules.fence = (...args) => `<div class="code-dossier library-code"><button class="copy-btn library-copy" type="button">${context.language === 'id' ? 'Salin kode' : 'Copy code'}</button>${fence(...args)}</div>\n`;
  let tableNumber = 0;
  markdown.renderer.rules.table_open = () => `<div class="doc-table-wrap"><table class="doc-table"><caption class="visually-hidden">${escapeHtml(document.title)} — ${context.language === 'id' ? 'tabel' : 'table'} ${++tableNumber}</caption>\n`;
  markdown.renderer.rules.table_close = () => '</table></div>\n';
  markdown.renderer.rules.th_open = (items, index, options, environment, renderer) => {
    items[index].attrSet('scope', 'col');
    return renderer.renderToken(items, index, options);
  };
  const rewrite = value => rewriteLink(value, document.source, context.page, context.language, context.documents, context.resources, context.tracked);
  markdown.renderer.rules.link_open = (items, index, options, environment, renderer) => {
    items[index].attrSet('href', rewrite(items[index].attrGet('href')));
    return renderer.renderToken(items, index, options);
  };
  const image = markdown.renderer.rules.image;
  markdown.renderer.rules.image = (items, index, ...args) => {
    items[index].attrSet('src', rewrite(items[index].attrGet('src')));
    items[index].attrSet('loading', 'lazy');
    return image(items, index, ...args);
  };
  const html = markdown.renderer.render(tokens, markdown.options, env);
  return { html: headings.some(heading => heading.level === 1) ? html : `<h1 class="doc-title">${escapeHtml(document.title)}</h1>\n${html}`, headings };
}

export function documentNavigation(language, prefix, current = 'library.html') {
  const labels = language === 'id'
    ? ['Pustaka dokumentasi', 'Ikhtisar', 'Instalasi', 'Verifikasi', 'Arsitektur', 'Alur Kerja', 'Profil & Konfigurasi', 'Pameran & Demo', 'Diagnostik', 'Privasi', 'Ketentuan']
    : ['Document library', 'Overview', 'Installation', 'Verify', 'Architecture', 'Workflows', 'Profiles & Config', 'Showcase', 'Diagnostics', 'Privacy', 'Terms'];
  const links = ['library.html', 'index.html', 'index.html#installation', 'index.html#verify', 'architecture.html', 'workflows.html', 'profiles.html', 'showcase.html', 'troubleshooting.html', 'privacy.html', 'terms.html'];
  const sections = language === 'id' ? ['MEMULAI', 'REFERENSI', 'PENGOPERASIAN', 'LEGAL & HUKUM'] : ['GETTING STARTED', 'REFERENCE', 'OPERATE', 'LEGAL'];
  const item = index => `<li><a href="${prefix}${links[index]}"${links[index] === current ? ' aria-current="page"' : ''}><span class="doc-nav-num">${String(index).padStart(2, '0')}</span> <span>${escapeHtml(labels[index])}</span></a></li>`;
  return `<ol class="doc-nav" start="0">${item(0)}</ol>\n` + [[1, 4], [4, 7], [7, 9], [9, 11]].map(([start, end], index) => `<div class="doc-nav-section">${escapeHtml(sections[index])}</div><ol class="doc-nav" start="${start}">${links.slice(start, end).map((_, offset) => item(start + offset)).join('\n')}</ol>`).join('\n');
}

export function renderSidebar({ language, page, version, runtime }) {
  const languageRoot = language === 'id' ? 'id/' : '';
  const relative = path.posix.relative(path.posix.dirname(page), languageRoot || '.');
  const prefix = relative ? relative + '/' : '';
  const current = /(?:^|\/)library(?:\/|\.html)/.test(page) ? 'library.html' : path.posix.basename(page);
  return `<aside class="doc-sidebar" aria-label="${language === 'id' ? 'Bagian dokumentasi' : 'Documentation sections'}">
      <div class="doc-brand"><a href="${prefix}index.html" class="doc-brand-title">${language === 'id' ? 'Ekosistem HeLa MCP' : 'HeLa MCP Ecosystem'}</a><div class="doc-brand-meta">v${version} · Runtime ${runtime} · 10 ${language === 'id' ? 'SEL' : 'CELLS'}</div></div>
      <nav aria-label="${language === 'id' ? 'Dokumentasi' : 'Documentation'}"><details class="doc-mobile-nav" open><summary>${language === 'id' ? 'Jelajahi dokumentasi' : 'Browse documentation'}</summary>${documentNavigation(language, prefix, current)}</details></nav>
    </aside>`;
}

export function renderShell({ language, page, title, description, content, toc = '', version, runtime }) {
  const languageRoot = language === 'id' ? 'id/' : '';
  const prefix = path.posix.relative(path.posix.dirname(page), languageRoot || '.');
  const pagePrefix = prefix ? prefix + '/' : '';
  const assetPrefix = path.posix.relative(path.posix.dirname(page), '.');
  const assets = assetPrefix ? assetPrefix + '/' : '';
  const enPage = page.replace(/^id\//, '');
  const en = relativeUrl(page, enPage), id = relativeUrl(page, 'id/' + enPage);
  const label = language === 'id' ? 'Pustaka dokumentasi' : 'Document library';
  const search = language === 'id' ? 'Cari dokumentasi dan alat' : 'Search documentation and tools';
  const encodedTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${encodedTitle} — HeLa MCP Ecosystem</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${ORIGIN}/${page}">
  <link rel="alternate" hreflang="en" href="${ORIGIN}/${enPage}">
  <link rel="alternate" hreflang="id" href="${ORIGIN}/id/${enPage}">
  <link rel="icon" type="image/svg+xml" href="${assets}assets/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${assets}style.css">
  <link rel="stylesheet" href="${assets}library.css">
</head>
<body class="library-page" data-page-prefix="${pagePrefix}">
  <a href="#main-content" class="skip-link">${language === 'id' ? 'Langsung ke isi' : 'Skip to main content'}</a>
  <div class="doc-shell">
    ${renderSidebar({ language, page, version, runtime })}
    <div class="doc-main">
      <div class="doc-topbar"><a class="doc-topbar-title" href="${pagePrefix}library.html">${label}</a><div class="topbar-actions"><div class="lang-switcher" aria-label="Language"><a class="lang-btn${language === 'en' ? ' active' : ''}" data-lang="en" href="${en}">EN</a><a class="lang-btn${language === 'id' ? ' active' : ''}" data-lang="id" href="${id}">ID</a></div><button class="btn open-cmd-palette" type="button">${language === 'id' ? 'Cari' : 'Search'} <kbd>Ctrl K</kbd></button><a class="btn" href="https://github.com/Hela-Ecosystem/hela-mcp-ecosystem">GitHub</a></div></div>
      <main id="main-content" class="doc-content library-content">${content}<footer class="doc-footer"><span>MIT LICENSE · HELA ECOSYSTEM</span><a href="${pagePrefix}library.html">${label}</a></footer></main>
      <nav class="doc-toc" aria-label="${language === 'id' ? 'Di halaman ini' : 'On this page'}"><div class="doc-toc-title">${language === 'id' ? 'DI HALAMAN INI' : 'ON THIS PAGE'}</div><ol id="tocList">${toc}</ol></nav>
    </div>
  </div>
  <div class="cmd-backdrop" id="cmdPalette" role="dialog" aria-label="${search}" aria-modal="true"><div class="cmd-modal"><div class="cmd-input-row"><label class="visually-hidden" for="cmdInput">${search}</label><input class="cmd-input" id="cmdInput" placeholder="${search}" type="search"><button class="btn cmd-close" type="button">${language === 'id' ? 'Tutup' : 'Close'}</button></div><div class="cmd-results" id="cmdResults"></div></div></div>
  <script src="${assets}release-data.js?v=${version}"></script>
  <script src="${assets}library-data.js?v=${version}"></script>
  <script src="${assets}library.js?v=${version}"></script>
  <script src="${assets}app.js?v=${version}"></script>
</body>
</html>
`;
}

export function renderLibraryIndex(documents, language, release) {
  const isId = language === 'id';
  const page = (isId ? 'id/' : '') + 'library.html';
  const title = isId ? 'Pustaka dokumentasi lengkap' : 'Complete documentation library';
  const intro = isId ? 'Semua panduan, referensi, riwayat rilis, dan catatan proyek publik dari repositori ini. Isi dipertahankan dalam bahasa sumbernya.' : 'Every public guide, reference, release note, and project record from this repository. Documents retain their source language.';
  const groups = Object.entries(categories).map(([key, label]) => {
    const entries = documents.filter(document => document.category === key);
    return `<section class="library-group" data-library-group><h2 id="${key}">${label[language]}</h2><ul class="library-list">${entries.map(document => `<li class="library-entry" data-document="${escapeHtml(document.source)}"><a class="library-entry-link" href="${document.link}"><span class="library-entry-title">${escapeHtml(document.title)}</span>${document.archived ? `<span class="library-badge">${isId ? 'Historis' : 'Historical'}</span>` : ''}</a><p>${escapeHtml(document.summary)}</p><code class="library-source">${escapeHtml(document.source)}</code></li>`).join('\n')}</ul></section>`;
  }).join('\n');
  const content = `<header><p class="library-kicker">${isId ? 'BACA DI SITUS INI' : 'READ ON THIS SITE'}</p><h1 class="doc-title">${title}</h1><p class="doc-lead">${intro}</p></header>
<form class="library-filters" role="search"><div><label for="librarySearch">${isId ? 'Cari di seluruh isi' : 'Search full document text'}</label><input type="search" id="librarySearch" placeholder="${isId ? 'Topik, perintah, atau nama berkas…' : 'Topic, command, or filename…'}" autocomplete="off"></div><div><label for="libraryCategory">${isId ? 'Bagian' : 'Section'}</label><select id="libraryCategory"><option value="">${isId ? 'Semua bagian' : 'All sections'}</option>${Object.entries(categories).map(([key, label]) => `<option value="${key}">${label[language]}</option>`).join('')}</select></div><button class="btn" type="reset">${isId ? 'Atur ulang' : 'Reset'}</button></form>
<p id="libraryCount" class="library-count" role="status" aria-live="polite">${documents.length} ${isId ? 'dokumen' : 'documents'}</p><p id="libraryEmpty" hidden>${isId ? 'Tidak ada dokumen yang cocok. Coba kata lain atau atur ulang filter.' : 'No documents match. Try another term or reset the filters.'}</p><noscript><p>${isId ? 'Pencarian memerlukan JavaScript; semua tautan dan dokumen di bawah tetap dapat dibaca.' : 'Search needs JavaScript; every document below remains readable without it.'}</p></noscript>${groups}`;
  return renderShell({ language, page, title, description: intro, content, version: release.ecosystem, runtime: release.runtime });
}
