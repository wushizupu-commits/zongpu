const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'assets/site-analytics.js'), 'utf8');
const host = 'https://wushizupu-commits.github.io/zongpu/';
const pages = ['home.html', 'index.html', 'biographies.html', 'image_archive.html', 'family_customs.html', 'revisions.html', 'source_migration.html'];
const collector = 'https://genealogy-events.example.workers.dev';
class Element {
  constructor() { this.children = []; this.events = {}; this.textContent = ''; this.disabled = false; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  addEventListener(name, fn) { this.events[name] = fn; }
}
function environment(page, options = {}) {
  const calls = [], storage = new Map(), timers = new Map(), elements = new Map();
  const listeners = new Map(), observers = [], panels = options.panels || [];
  let timerId = 0, eventId = 0, resolveConfig;
  for (const id of ['analytics-status', 'analytics-refresh', 'analytics-pages', 'analytics-site-pv', 'analytics-site-uv']) elements.set(id, new Element());
  const location = new URL(page, host), head = new Element(), body = new Element(), sidebar = new Element();
  const context = {
    URL, URLSearchParams, AbortController, location,
    DATA: { nodes: [{ id: 'G01-001', name: 'public name is not transmitted' }, { id: 'G26-005' }] },
    crypto: { randomUUID: () => '00000000-0000-4000-8000-' + String(++eventId).padStart(12, '0') },
    MutationObserver: class {
      constructor(fn) { this.callback = fn; observers.push(this); }
      observe(target, config) { assert.deepEqual(Object.keys(config), ['attributes', 'attributeFilter']); assert.equal(config.attributeFilter[0], 'class'); }
    },
    navigator: { doNotTrack: options.dnt ? '1' : null, globalPrivacyControl: options.gpc || false },
    matchMedia: () => ({ matches: options.mobile || false }),
    document: {
      readyState: 'complete', currentScript: { src: host + 'assets/site-analytics.js' }, head, body,
      createElement: () => new Element(),
      getElementById: id => elements.get(id),
      querySelector: () => options.sidebar ? sidebar : null,
      querySelectorAll: () => panels,
      addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); },
      dispatchEvent(event) { (listeners.get(event.type) || []).forEach(fn => fn(event)); }
    },
    ZongpuSite: { readSkin: () => options.skin || 'paper' },
    localStorage: {
      getItem(key) { if (options.storageDenied) throw Error('denied'); return storage.get(key); },
      setItem(key, value) { if (options.storageDenied) throw Error('denied'); storage.set(key, value); }
    },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    fetch: async (url, init) => {
      calls.push({ url, ...init });
      if (url.includes('/analytics-config.json')) {
        if (options.configFailure) throw Error('missing config');
        if (options.configHang) return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Error('timeout'))));
        const response = { ok: !options.configHttpFailure, json: async () => options.config || { endpoint: '' } };
        if (options.delayedConfig) return new Promise(resolve => { resolveConfig = () => resolve(response); });
        return response;
      }
      if (url.endsWith('/collect')) {
        if (options.collectFailure) throw Error('collector offline');
        if (options.collectHang) return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Error('timeout'))));
        return { ok: !options.collectHttpFailure, status: options.collectHttpFailure ? 400 : 204 };
      }
      if (options.failure) throw Error('offline');
      if (options.hang) return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Error('timeout'))));
      return {
        ok: true, headers: { get: () => 'visitor.signature' },
        json: async () => ({ success: true, data: { site_pv: options.invalid ? -1 : 12, site_uv: 4, page_pv: 3, page_uv: 2 } })
      };
    }
  };
  context.window = context;
  vm.createContext(context);
  const run = () => vm.runInContext(code, context);
  run();
  return { context, calls, storage, timers, elements, head, body, sidebar, run,
    resolveConfig: () => resolveConfig(),
    selectSearch: (nodeId, extra = {}) => context.document.dispatchEvent({ type: 'zongpu:search-select', detail: { nodeId, ...extra } }),
    mutate: () => observers.forEach(observer => observer.callback([])) };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
const countCalls = e => e.calls.filter(call => call.url === 'https://busuanzi.9420.ltd/api');
const eventCalls = e => e.calls.filter(call => call.url.endsWith('/collect'));
const events = e => eventCalls(e).map(call => JSON.parse(call.body));
function panel(id, active = false, section = false) {
  const target = { active, dataset: section ? { section: id } : { article: id } };
  target.classList = { contains: value => value === 'active' && target.active };
  return target;
}

test('all 14 content pages count silently and map both skins to seven safe paths', async () => {
  for (const page of pages) {
    for (const ink of [false, true]) {
      const file = ink ? 'ink-archive/' + ({ 'home.html': 'index.html', 'index.html': 'tree.html' }[page] || page) : page;
      const html = fs.readFileSync(path.join(root, file), 'utf8');
      assert.equal((html.match(/src="assets\/site-tools\.js\?v=(?:20261004-events|20261009-video-stats)"/g) || []).length, 1);
      const e = environment(file + '?view=tree&person=G32-001&utm_source=x#person=G32-001', { sidebar: page === 'index.html' });
      await settle();
      assert.equal(e.calls.length, 2);
      assert.equal(countCalls(e).length, 1);
      assert.equal(eventCalls(e).length, 0, 'empty endpoint keeps event collection disabled');
      assert.equal(e.calls[1].url, host + 'assets/analytics-config.json?v=20261004-events');
      assert.equal(e.calls[1].method, 'GET');
      assert.equal(e.calls[0].method, 'POST');
      assert.equal(e.calls[0].headers['x-bsz-referer'], host + page);
      assert.equal(e.calls[0].referrerPolicy, 'no-referrer');
      assert.equal(e.calls[0].credentials, 'omit');
      assert.equal(e.body.children.length, 0, 'no public dashboard entry');
      assert.equal(e.sidebar.children.length, 0, 'no sidebar dashboard entry');
      assert.equal(e.storage.get('zongpu-analytics-id'), 'visitor.signature');
      e.run();
      assert.equal(e.calls.length, 2, 'duplicate script must not count or query config again');
    }
  }
});

test('automatic redirects, non-production sites and privacy opt-outs never count', () => {
  for (const [page, options] of [
    ['index.html', {}], ['', {}], ['home.html', { skin: 'ink-archive' }],
    ['biographies.html', { skin: 'ink-archive' }], ['ink-archive/tree.html', { mobile: true }],
    ['http://localhost/zongpu/home.html', {}], ['file:///tmp/home.html', {}],
    ['https://example.com/zongpu/home.html', {}], ['home.html', { dnt: true }], ['home.html', { gpc: true }]
  ]) assert.equal(environment(page, options).calls.length, 0, page + JSON.stringify(options));
  assert.equal(environment('home.html?skin=paper', { skin: 'ink-archive' }).calls.length, 2);
  assert.equal(environment('home.html', { skin: 'ink-archive', mobile: true }).calls.length, 2);
});

test('storage restrictions, unavailable service and timeouts do not retry or break page UI', async () => {
  for (const options of [{ storageDenied: true }, { failure: true }, { invalid: true }, { hang: true }]) {
    const e = environment('home.html', options);
    if (options.hang) [...e.timers.values()].forEach(fn => fn());
    await settle();
    assert.equal(e.calls.length, 2);
    assert.equal(e.body.children.length, 0);
    assert.equal(e.timers.size, 0);
  }
});

test('main website does not publish a dashboard or expose a viewer URL', () => {
  assert.equal(fs.existsSync(path.join(root, 'analytics.html')), false);
  assert.equal(fs.existsSync(path.join(root, 'assets/site-analytics.css')), false);
  assert.ok(!code.includes('mountLink') && !code.includes('mountDashboard'));
  assert.ok(!code.includes('viewer-') && !code.includes('analytics.html'));
  assert.equal(environment('analytics.html').calls.length, 0);
});

test('optional endpoint accepts only HTTPS workers.dev origins', async () => {
  for (const endpoint of ['', 'http://safe.workers.dev', 'https://example.com', 'https://workers.dev', 'https://evilworkers.dev',
    'https://good.workers.dev.evil.example', 'https://user:pass@good.workers.dev', 'https://good.workers.dev:8443',
    'https://good.workers.dev/path', 'https://good.workers.dev/?token=x', 'https://good.workers.dev/#x']) {
    const e = environment('home.html', { config: { endpoint } });
    await settle();
    assert.equal(eventCalls(e).length, 0, endpoint);
    assert.equal(countCalls(e).length, 1);
  }
  const e = environment('home.html?utm_source=secret#arbitrary', { config: { endpoint: collector } });
  await settle();
  assert.deepEqual(events(e).map(({ kind, page, itemId }) => ({ kind, page, itemId })), [{ kind: 'page', page: 'home.html', itemId: '' }]);
  for (const call of eventCalls(e)) {
    assert.equal(call.url, collector + '/collect');
    assert.equal(call.method, 'POST');
    assert.equal(call.credentials, 'omit');
    assert.equal(call.referrerPolicy, 'no-referrer');
    assert.deepEqual(Object.keys(JSON.parse(call.body)).sort(), ['eventId', 'itemId', 'kind', 'page']);
    assert.deepEqual(Object.keys(call.headers), ['Content-Type']);
    assert.ok(!call.body.includes('secret') && !call.body.includes('arbitrary'));
  }
});

test('initial article and actual panel changes are counted independently of stale hashes', async () => {
  for (const [page, first, second, section] of [
    ['biographies.html', 'bio-1', 'bio-8', false],
    ['revisions.html', 'bingwu-2026-1', 'guangxu-1895-2', false],
    ['image_archive.html', 'ancestors', 'fuxi', true]
  ]) {
    for (const skin of ['', 'ink-archive/']) {
      const panels = [panel(first, true, section), panel(second, false, section), panel('not-whitelisted', false, section)];
      const e = environment(skin + page + '#stale', { panels, config: { endpoint: collector } });
      await settle();
      assert.deepEqual(events(e).map(event => [event.kind, event.page, event.itemId]), [['page', page, ''], ['article', page, first]]);
      e.context.location.hash = '#' + second;
      e.mutate();
      assert.equal(eventCalls(e).length, 2, 'hash alone is not an article open');
      panels[0].active = false; panels[1].active = true; e.mutate();
      e.mutate();
      assert.equal(eventCalls(e).length, 3, 'same active panel counts only once');
      panels[1].active = false; panels[0].active = true; e.mutate();
      assert.equal(events(e).at(-1).itemId, first, 'returning to a previous article is another open');
      panels[0].active = false; panels[2].active = true; e.mutate();
      assert.equal(eventCalls(e).length, 4, 'unknown article IDs never leave the browser');
      assert.equal(countCalls(e).length, 1, 'article events never pollute busuanzi page counts');
    }
  }
});

test('searches only send a real selected node ID, including while configuration loads', async () => {
  const e = environment('ink-archive/tree.html?person=G26-005', { delayedConfig: true, config: { endpoint: collector } });
  e.selectSearch('G01-001', { query: 'secret input', name: 'name' });
  e.selectSearch('G99-999');
  e.selectSearch('secret input');
  e.selectSearch(null);
  assert.equal(eventCalls(e).length, 0);
  e.resolveConfig(); await settle();
  assert.deepEqual(events(e).map(event => [event.kind, event.page, event.itemId]), [['page', 'index.html', ''], ['search', 'index.html', 'G01-001']]);
  assert.ok(eventCalls(e).every(call => !call.body.includes('secret input') && !call.body.includes('name')));
  const other = environment('biographies.html', { config: { endpoint: collector } });
  await settle(); other.selectSearch('G01-001');
  assert.equal(eventCalls(other).length, 1, 'only the genealogy page accepts node search events');
});

test('search hook includes click and Enter but is not attached to each input or generic selection', () => {
  const app = fs.readFileSync(path.join(root, 'assets/zongpu-app.js'), 'utf8');
  const updateSearch = app.slice(app.indexOf('    function updateSearch()'), app.indexOf('    function downloadBlob('));
  assert.equal((app.match(/new CustomEvent\("zongpu:search-select"/g) || []).length, 1);
  assert.match(updateSearch, /button\.addEventListener\("click", \(\) => \{[\s\S]*nodeMap\.get\(button\.dataset\.key\)[\s\S]*revealNode\(button\.dataset\.key\)[\s\S]*new CustomEvent\("zongpu:search-select", \{ detail: \{ nodeId: node\.id \} \}\)/);
  assert.match(app, /searchInput\.addEventListener\("keydown", event => \{[\s\S]*event\.isComposing[\s\S]*event\.key === "Enter"[\s\S]*resultsEl\.querySelector\("\.result"\)\?\.click\(\)/);
});

test('pending configuration holds at most 30 events and disabled configuration discards them', async () => {
  const e = environment('index.html?view=tree', { delayedConfig: true, config: { endpoint: collector } });
  for (let i = 0; i < 50; i++) e.selectSearch('G01-001');
  e.resolveConfig(); await settle();
  assert.equal(eventCalls(e).length, 30);
  assert.equal(new Set(events(e).map(event => event.eventId)).size, 30);
  const disabled = environment('index.html?view=tree', { delayedConfig: true });
  disabled.selectSearch('G01-001');
  disabled.resolveConfig(); await settle();
  disabled.selectSearch('G26-005');
  assert.equal(eventCalls(disabled).length, 0);
});

test('config and collector failures, rejected events and timeouts remain silent and do not retry', async () => {
  for (const options of [{ configFailure: true }, { configHttpFailure: true }, { configHang: true },
    { collectFailure: true }, { collectHttpFailure: true }, { collectHang: true }]) {
    const e = environment('home.html', { config: { endpoint: collector }, ...options });
    await settle();
    [...e.timers.values()].forEach(fn => fn());
    await settle();
    assert.equal(countCalls(e).length, 1);
    assert.equal(eventCalls(e).length, Object.keys(options)[0].startsWith('config') ? 0 : 1);
    assert.equal(e.timers.size, 0);
    assert.equal(e.body.children.length, 0);
  }
});

test('configuration contains only an optional public Worker address and both genealogy pages refresh their app script', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'assets/analytics-config.json'), 'utf8'));
  assert.deepEqual(Object.keys(config), ['endpoint']);
  assert.equal(typeof config.endpoint, 'string');
  if (config.endpoint) {
    const url = new URL(config.endpoint);
    assert.equal(url.protocol, 'https:');
    assert.match(url.hostname, /\.(?:[a-z0-9-]+\.)?workers\.dev$/);
    assert.equal(url.origin, config.endpoint);
  }
  for (const page of ['index.html', 'ink-archive/tree.html']) {
    assert.match(fs.readFileSync(path.join(root, page), 'utf8'), /assets\/zongpu-app\.js\?v=20261004-events/);
  }
  assert.match(fs.readFileSync(path.join(root, 'assets/site-tools.js'), 'utf8'), /site-analytics\.js\?v=20261009-video-stats/);
});

 test('video events count only whitelisted homepage openings in both skins; local never sends', async () => {
   for (const page of ['home.html','ink-archive/index.html','index.html','http://127.0.0.1:3137/site/home.html']) {
     const e=environment(page,{config:{endpoint:collector}});await settle();
     for (const videoId of ['unknown','family-introduction']) e.context.document.dispatchEvent({type:'zongpu:video-open',detail:{videoId}});
     await settle();const videos=events(e).filter(event=>event.kind==='video');
     assert.equal(videos.length,['home.html','ink-archive/index.html'].includes(page)?1:0);
     if(videos.length)assert.deepEqual([videos[0].page,videos[0].itemId],['home.html','family-introduction']);
   }
 });
