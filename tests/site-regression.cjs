// Dependency-free logic/static regression checks; not a browser or visual test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pages = ['home.html', 'index.html', 'biographies.html', 'image_archive.html', 'family_customs.html', 'revisions.html', 'source_migration.html'];
const allPages = [...pages, ...pages.map(p => 'ink-archive/' + ({ 'home.html': 'index.html', 'index.html': 'tree.html' }[p] || p))];

class Element {
  constructor(tag = 'div') {
    this.tag = tag; this.children = []; this.dataset = {}; this.attrs = {}; this.events = {}; this.style = {}; this.textContent = '';
    this.classes = new Set();
    this.classList = {
      add: value => this.classes.add(value), remove: value => this.classes.delete(value),
      contains: value => this.classes.has(value),
      toggle: (value, active) => active ? this.classes.add(value) : this.classes.delete(value)
    };
  }
  append(...items) { items.forEach(item => { if (typeof item !== 'string') { item.remove(); item.parent = this; } this.children.push(item); }); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); this.parent = null; }
  replaceChildren(...items) { this.children = []; this.append(...items); }
  setAttribute(key, value) { this.attrs[key] = value; }
  getAttribute(key) { return this.attrs[key]; }
  removeAttribute(key) { delete this.attrs[key]; }
  addEventListener(type, fn) { this.events[type] = fn; }
  focus() { this.focused = true; }
  select() {}
  scrollIntoView() { this.scrolled = true; }
  querySelector(selector) { return selector.includes('pager') ? this.pager : this.children.find(x => x.tag === selector); }
  set innerHTML(value) { this.html = value; if (value.includes('<input')) this.append(new Element('input')); if (value.includes('<span')) this.append(new Element('span')); }
}

function environment(href = 'https://example.test/zongpu/home.html', mobile = false) {
  const body = new Element('body'), head = new Element('head'), header = new Element('header');
  body.append(header);
  const events = {}, media = { matches: mobile, callbacks: [], addEventListener(_, fn) { this.callbacks.push(fn); } };
  const storage = new Map(), location = new URL(href), redirects = [];
  location.assign = url => redirects.push(url); location.replace = location.assign;
  const document = {
    body, head, events, activeElement: new Element('button'), currentScript: { src: new URL('../assets/site-tools.js', href).href },
    createElement: tag => new Element(tag), execCommand: () => true,
    addEventListener(type, fn) { (events[type] ||= []).push(fn); },
    querySelector(selector) {
      if (selector.includes('header-inner')) return header;
      return [...header.children, ...body.children].find(x => x.className === selector.slice(1)) || null;
    },
    querySelectorAll() { return []; }
  };
  const context = {
    URL, URLSearchParams, document, location, navigator: {}, matchMedia: () => media,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    setTimeout: () => 1, clearTimeout() {}, addEventListener(type, fn) { (events[type] ||= []).push(fn); }
  };
  context.window = context;
  context.history = { pushState(_, __, value) { location.href = new URL(value, location).href; }, replaceState(_, __, value) { location.href = new URL(value, location).href; } };
  vm.createContext(context);
  vm.runInContext(read('assets/site-tools.js'), context);
  return { context, document, body, header, events, media, storage, location, redirects, site: context.ZongpuSite };
}

test('all 14 pages: local assets, native links, favicons and script syntax', () => {
  for (const file of allPages) {
    const html = read(file);
    assert.match(html, /rel="icon"/);
    assert.ok(html.indexOf('site-tools.js') < html.search(/(?:skin-switcher|ink-archive-bridge)\.js/));
    const base = path.resolve(root, path.dirname(file), html.match(/<base\s+href="([^"]+)"/)?.[1] || '.');
    for (const [, value] of html.matchAll(/<(?:a|img|script|link)\b[^>]*?\b(?:href|src)="([^"]+)"/g)) {
      if (/^(?:[a-z]+:|#|\/\/)/i.test(value) || value.includes('${')) continue;
      const local = value.split(/[?#]/)[0];
      assert.ok(!local || fs.existsSync(path.resolve(base, decodeURIComponent(local))), `${file}: ${value}`);
    }
    for (const [, attrs, code] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (!attrs.includes('src=')) new vm.Script(code, { filename: file });
    }
  }
  for (const file of ['site-tools', 'skin-switcher', 'ink-archive-bridge', 'zongpu-app']) new vm.Script(read(`assets/${file}.js`));
});

test('skin round trips preserve person, article and query across file/subpath/root deployments', () => {
  const { site } = environment();
  for (const base of ['https://example.test/', 'https://example.test/zongpu/', 'file:///Users/example/New%20project/']) {
    for (const page of pages) {
      const url = new URL(page + '?person=G32-001&test=a%20b#bingwu-2026-2', base);
      const ink = new URL(site.inkUrl(url.href));
      assert.ok(ink.pathname.includes('/ink-archive/'));
      const paper = new URL(site.paperUrl(ink.href));
      assert.equal(paper.pathname, url.pathname);
      assert.equal(paper.searchParams.get('person'), 'G32-001');
      assert.equal(paper.searchParams.get('test'), 'a b');
      assert.equal(paper.hash, url.hash);
      if (page === 'index.html') assert.equal(paper.searchParams.get('view'), 'tree');
    }
  }
  assert.equal(site.inkUrl('https://example.test/zongpu/'), 'https://example.test/zongpu/ink-archive/index.html');
  assert.equal(site.paperUrl('https://example.test/zongpu/ink-archive/'), 'https://example.test/zongpu/home.html');
});

test('ink dynamic links retain both query and hash; person links go to tree, not homepage', () => {
  const { site } = environment();
  const base = 'https://example.test/zongpu/ink-archive/biographies.html';
  assert.equal(site.inkLink('./tree.html?person=G32-001#person=G32-001', base), 'https://example.test/zongpu/ink-archive/tree.html?person=G32-001#person=G32-001');
  assert.equal(site.inkLink('index.html?person=G32-001', base), 'https://example.test/zongpu/ink-archive/tree.html?person=G32-001');
  assert.equal(site.inkLink('index.html', base), 'https://example.test/zongpu/ink-archive/index.html');
  assert.equal(site.inkLink('#bio-9', base), base + '#bio-9');
  for (const value of ['https://external.test/', 'mailto:test@example.test', '../home.html', 'assets/photo.png', 'ink-archive/tree.html']) assert.equal(site.inkLink(value, base), null);
});

test('storage restrictions do not break switching', () => {
  const e = environment();
  e.context.localStorage = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } };
  assert.equal(e.site.readSkin(), null);
  assert.equal(e.site.writeSkin('paper'), false);
});

test('paper mobile defaults, resize recovery, and desktop preference', () => {
  const e = environment(undefined, true);
  e.storage.set('zongpu-ui-skin', 'ink-archive');
  vm.runInContext(read('assets/skin-switcher.js'), e.context);
  e.events.DOMContentLoaded.forEach(fn => fn());
  assert.equal(e.redirects.length, 0);
  const toggle = e.document.querySelector('.skin-toggle'), share = e.document.querySelector('.share-link');
  assert.equal(toggle.hidden, true);
  assert.equal(share.parent, e.body);
  e.media.matches = false; e.media.callbacks.forEach(fn => fn({ matches: false }));
  assert.equal(toggle.hidden, false);
  assert.equal(share.parent, e.header);
  toggle.querySelector('input').events.change();
  assert.equal(e.redirects.at(-1), 'https://example.test/zongpu/ink-archive/index.html');
  const d = environment(); d.storage.set('zongpu-ui-skin', 'ink-archive');
  vm.runInContext(read('assets/skin-switcher.js'), d.context);
  d.events.DOMContentLoaded.forEach(fn => fn());
  assert.equal(d.redirects.at(-1), 'https://example.test/zongpu/ink-archive/index.html');
});

test('ink mobile entry and desktop-to-mobile resize retain the selected person', () => {
  for (const mobile of [true, false]) {
    const e = environment('https://example.test/zongpu/ink-archive/tree.html?person=G32-001#person=G32-001', mobile);
    vm.runInContext(read('assets/ink-archive-bridge.js'), e.context);
    if (!mobile) e.media.callbacks.forEach(fn => fn({ matches: true }));
    const target = new URL(e.redirects.at(-1));
    assert.equal(target.pathname, '/zongpu/index.html');
    assert.equal(target.searchParams.get('person'), 'G32-001');
    assert.equal(target.searchParams.get('view'), 'tree');
    assert.equal(target.hash, '#person=G32-001');
  }
});

for (const mode of ['modern', 'denied', 'legacy', 'failure', 'file']) {
  test(`copy feedback and cleanup: ${mode}`, async () => {
    const e = environment(mode === 'file' ? 'file:///tmp/home.html' : undefined), button = new Element('button');
    let copied;
    if (mode === 'modern') e.context.navigator.clipboard = { async writeText(value) { copied = value; } };
    if (mode === 'denied' || mode === 'failure') e.context.navigator.clipboard = { async writeText() { throw Error('denied'); } };
    e.document.execCommand = () => mode !== 'failure';
    await e.site.copyLink(button);
    assert.equal(button.disabled, false);
    assert.ok(!e.body.children.some(x => x.tag === 'textarea'));
    const message = e.body.children.find(x => x.className === 'share-status');
    assert.equal(message.attrs.role, 'status');
    assert.match(message.textContent, mode === 'failure' ? /未能复制/ : mode === 'file' ? /仅本机可用/ : /链接已复制/);
    if (mode === 'modern') assert.equal(copied, e.location.href);
    else assert.equal(e.document.activeElement.focused, true);
  });
}

for (const dir of ['', 'ink-archive/']) {
  for (const name of ['revisions.html', 'biographies.html', 'image_archive.html']) {
    test(`${dir}${name}: catalogue, pagination and back navigation`, () => {
      const html = read(dir + name), e = environment();
      const tocClass = name === 'biographies.html' ? 'bio-toc-item' : 'toc-doc';
      const panelClass = { 'revisions.html': 'revision-page', 'biographies.html': 'bio-page', 'image_archive.html': 'archive-section' }[name];
      const toc = [...html.matchAll(new RegExp(`<button[^>]*class="${tocClass}[^\"]*"[^>]*data-target="([^\"]+)"[^>]*>([\\s\\S]*?)</button>`, 'g'))].map(([, id, title]) => { const el = new Element('button'); el.dataset.target = id; el.textContent = title.trim(); return el; });
      assert.ok(toc.length > 1);
      const panels = toc.map(item => { const el = new Element('article'); el.dataset = { article: item.dataset.target, section: item.dataset.target }; el.pager = new Element('div'); return el; });
      e.document.querySelectorAll = selector => selector === '.' + tocClass ? toc : selector === '.' + panelClass ? panels : selector === '.article-nav-button' ? panels.flatMap(p => p.pager.children.filter(c => c.tag === 'button')) : [];
      let code = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(c => c.includes('const tocItems'));
      if (name === 'revisions.html') code = code.split('    const revisionImageTriggers')[0];
      if (name === 'image_archive.html') code = code.split('    const aiPortraits')[0];
      vm.runInContext(code, e.context);
      if (name === 'revisions.html') panels.forEach((p, index) => {
        const expected = [toc[index - 1]?.dataset.target, toc[index + 1]?.dataset.target].filter(Boolean);
        assert.deepEqual(p.pager.children.filter(c => c.tag === 'button').map(c => c.dataset.target), expected);
      });
      toc[1].events.click();
      assert.equal(e.location.hash, '#' + toc[1].dataset.target);
      assert.ok(panels[1].classList.contains('active'));
      e.location.hash = ''; e.events.popstate.forEach(fn => fn());
      assert.ok(panels[0].classList.contains('active'));
      e.location.hash = '#%ZZ'; e.events.popstate.forEach(fn => fn());
      assert.ok(panels[0].classList.contains('active'));
    });
  }
}

test('tree selection updates share URL without adding a history entry', () => {
  const code = read('assets/zongpu-app.js').split('      // Sharing or changing skins')[1].split('      showDetailPanel();')[0];
  const route = code.slice(code.indexOf('      const personUrl'));
  for (const page of ['index.html?view=tree', 'ink-archive/tree.html']) {
    const e = environment('https://example.test/zongpu/' + page + '#person=G21-008');
    e.context.node = { id: 'G32-001' }; e.context.key = 'row-500';
    vm.runInContext(`(() => { ${route} })()`, e.context);
    assert.equal(e.location.searchParams.get('person'), 'G32-001');
    assert.equal(e.location.hash, '');
    e.context.key = '__root__';
    vm.runInContext(`(() => { ${route} })()`, e.context);
    assert.equal(e.location.searchParams.has('person'), false);
  }
});

test('genealogy identity and parent relations remain structurally consistent', () => {
  const context = {}; vm.runInNewContext(read('assets/zongpu-data.js'), context);
  const d = context.DATA, nodes = new Map(d.nodes.map(n => [n.key, n]));
  assert.equal(d.nodes.length, 939);
  assert.equal(new Set(d.nodes.map(n => n.id)).size, d.nodes.length);
  for (const link of d.links) assert.equal(nodes.get(link.target).fatherId, nodes.get(link.source).id);
  // Adoption links use the adoptee as source and adoptive father as target.
  for (const link of d.adoptionLinks) assert.equal(nodes.get(link.source).adpFatherId, nodes.get(link.target).id);
  for (const n of d.nodes) {
    const visited = new Set(); let current = n;
    while (current) { assert.ok(!visited.has(current.key), `cycle: ${n.id}`); visited.add(current.key); current = d.nodes.find(p => p.id === current.fatherId); }
  }
});
