const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'assets/site-analytics.js'), 'utf8');
const host = 'https://wushizupu-commits.github.io/zongpu/';
const pages = ['home.html', 'index.html', 'biographies.html', 'image_archive.html', 'family_customs.html', 'revisions.html', 'source_migration.html'];
class Element {
  constructor() { this.children = []; this.events = {}; this.textContent = ''; this.disabled = false; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  addEventListener(name, fn) { this.events[name] = fn; }
}
function environment(page, options = {}) {
  const calls = [], storage = new Map(), timers = new Map(), elements = new Map();
  let timerId = 0;
  for (const id of ['analytics-status', 'analytics-refresh', 'analytics-pages', 'analytics-site-pv', 'analytics-site-uv']) elements.set(id, new Element());
  const location = new URL(page, host), head = new Element(), body = new Element(), sidebar = new Element();
  const context = {
    URL, URLSearchParams, AbortController, location,
    navigator: { doNotTrack: options.dnt ? '1' : null, globalPrivacyControl: options.gpc || false },
    matchMedia: () => ({ matches: options.mobile || false }),
    document: {
      readyState: 'complete', currentScript: { src: host + 'assets/site-analytics.js' }, head, body,
      createElement: () => new Element(),
      getElementById: id => elements.get(id),
      querySelector: () => options.sidebar ? sidebar : null
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
  return { context, calls, storage, timers, elements, head, body, sidebar, run };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('all 14 content pages share one entry and map both skins to seven safe paths', async () => {
  for (const page of pages) {
    for (const ink of [false, true]) {
      const file = ink ? 'ink-archive/' + ({ 'home.html': 'index.html', 'index.html': 'tree.html' }[page] || page) : page;
      const html = fs.readFileSync(path.join(root, file), 'utf8');
      assert.equal((html.match(/src="assets\/site-tools\.js\?v=20261004-analytics"/g) || []).length, 1);
      const e = environment(file + '?view=tree&person=G32-001&utm_source=x#person=G32-001', { sidebar: page === 'index.html' });
      await settle();
      assert.equal(e.calls.length, 1);
      assert.equal(e.calls[0].method, 'POST');
      assert.equal(e.calls[0].headers['x-bsz-referer'], host + page);
      assert.equal(e.calls[0].referrerPolicy, 'no-referrer');
      assert.equal(e.calls[0].credentials, 'omit');
      assert.equal((page === 'index.html' ? e.sidebar : e.body).children[0].children[0].href, host + 'analytics.html');
      assert.equal(e.storage.get('zongpu-analytics-id'), 'visitor.signature');
      e.run();
      assert.equal(e.calls.length, 1, 'duplicate script must not count again');
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
  assert.equal(environment('home.html?skin=paper', { skin: 'ink-archive' }).calls.length, 1);
  assert.equal(environment('home.html', { skin: 'ink-archive', mobile: true }).calls.length, 1);
});

test('storage restrictions, unavailable service and timeouts do not retry or break page UI', async () => {
  for (const options of [{ storageDenied: true }, { failure: true }, { invalid: true }, { hang: true }]) {
    const e = environment('home.html', options);
    if (options.hang) [...e.timers.values()].forEach(fn => fn());
    await settle();
    assert.equal(e.calls.length, 1);
    assert.equal(e.body.children.length, 1);
    assert.equal(e.timers.size, 0);
  }
});

test('dashboard loads and refreshes all rows with GET only; UV is not summed', async () => {
  const e = environment('analytics.html');
  await settle();
  assert.equal(e.calls.length, 7);
  assert.ok(e.calls.every(call => call.method === 'GET' && !call.headers.Authorization));
  assert.equal(e.elements.get('analytics-pages').children.length, 7);
  assert.equal(e.elements.get('analytics-site-pv').textContent, '12');
  assert.equal(e.elements.get('analytics-site-uv').textContent, '4');
  assert.equal(e.storage.size, 0, 'read-only dashboard does not persist visitor identity');
  await e.elements.get('analytics-refresh').events.click();
  assert.equal(e.calls.length, 14);
  assert.ok(e.calls.every(call => call.method === 'GET'));
});

test('dashboard distinguishes failure from zero and local preview makes no requests', async () => {
  for (const options of [{ failure: true }, { invalid: true }]) {
    const e = environment('analytics.html', options);
    await settle();
    assert.equal(e.elements.get('analytics-site-pv').textContent, '—');
    assert.match(e.elements.get('analytics-status').textContent, /暂时不可用/);
    assert.equal(e.elements.get('analytics-refresh').disabled, false);
  }
  const e = environment('http://localhost/zongpu/analytics.html');
  assert.equal(e.calls.length, 0);
  assert.equal(e.elements.get('analytics-refresh').disabled, true);
});
