function findLibraryDocuments(query, category = '', sourcePrefix = '') {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return (globalThis.HELA_LIBRARY || []).filter(document => {
    if (category && document.category !== category) return false;
    if (sourcePrefix && !document.source.startsWith(sourcePrefix)) return false;
    const searchable = `${document.title}\n${document.source}\n${document.text}`.toLowerCase();
    return words.every(word => searchable.includes(word));
  }).sort((a, b) => {
    const score = document => words.filter(word => document.title.toLowerCase().includes(word)).length;
    return score(b) - score(a) || a.title.localeCompare(b.title) || a.source.localeCompare(b.source);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const navigation = document.querySelector('.library-mobile-nav');
  if (navigation) {
    const mobile = window.matchMedia('(max-width: 900px)');
    navigation.open = !mobile.matches;
    mobile.addEventListener('change', event => { navigation.open = !event.matches; });
  }
  const search = document.getElementById('librarySearch');
  const category = document.getElementById('libraryCategory');
  const count = document.getElementById('libraryCount');
  if (!search || !category || !count) return;
  const isId = document.documentElement.lang === 'id';
  const parameters = new URLSearchParams(window.location.search);
  let sourcePrefix = parameters.get('path') || '';
  search.value = parameters.get('q') || '';
  category.value = parameters.get('category') || '';
  function update() {
    const matches = new Set(findLibraryDocuments(search.value, category.value, sourcePrefix).map(document => document.source));
    document.querySelectorAll('[data-document]').forEach(entry => { entry.hidden = !matches.has(entry.dataset.document); });
    document.querySelectorAll('[data-library-group]').forEach(group => { group.hidden = !group.querySelector('[data-document]:not([hidden])'); });
    count.textContent = `${matches.size} ${isId ? 'dokumen' : matches.size === 1 ? 'document' : 'documents'}`;
    document.getElementById('libraryEmpty').hidden = matches.size !== 0;
  }
  search.addEventListener('input', update);
  category.addEventListener('change', update);
  const form = search.closest('form');
  form.addEventListener('submit', event => { event.preventDefault(); update(); });
  form.addEventListener('reset', event => {
    event.preventDefault();
    search.value = '';
    category.value = '';
    sourcePrefix = '';
    update();
    search.focus();
  });
  update();
});
