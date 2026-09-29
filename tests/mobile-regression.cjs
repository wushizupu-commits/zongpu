const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function element() {
  const classes = new Set();
  return {
    events: {}, style: {}, dataset: {}, attrs: {},
    classList: {
      add: value => classes.add(value), remove: value => classes.delete(value),
      contains: value => classes.has(value),
      toggle: (value, active) => active ? classes.add(value) : classes.delete(value)
    },
    setAttribute(key, value) { this.attrs[key] = value; },
    removeAttribute(key) { delete this[key]; },
    addEventListener(name, fn) { this.events[name] = fn; },
    focus(options) { this.focusOptions = options; },
    blur() { this.blurred = true; }
  };
}

test('mobile layout breakpoints agree across navigation, chart and skins', () => {
  const query = '(max-width: 820px), (max-width: 1024px) and (max-height: 500px)';
  for (const file of ['mobile-nav.css', 'zongpu.css', 'paper-brand.css', 'skin-toggle.css', 'site-tools.css', 'zongpu-app.js', 'skin-switcher.js', 'ink-archive-bridge.js']) {
    assert.ok(read('assets/' + file).includes(query), file);
  }
});

test('opening mobile search returns to the search field and closes details', () => {
  const code = read('assets/zongpu-app.js').split('    function setSearchPanel(open) {')[1].split('\n    function initializeCollapse')[0];
  const appEl = element(), sidebarOpenBtn = element(), searchInput = element();
  let detailsHidden = false, scroll;
  const context = { appEl, sidebarOpenBtn, searchInput, isTouchOptimized: () => true,
    hideDetailPanel() { detailsHidden = true; }, window: { scrollTo(value) { scroll = value; } } };
  vm.createContext(context);
  vm.runInContext('function setSearchPanel(open) {' + code, context);
  context.setSearchPanel(true);
  assert.equal(detailsHidden, true);
  assert.equal(scroll.top, 0);
  assert.equal(searchInput.focusOptions.preventScroll, true);
  assert.equal(sidebarOpenBtn.attrs['aria-expanded'], 'true');
  context.setSearchPanel(false);
  assert.equal(searchInput.blurred, true);
  assert.equal(appEl.classList.contains('sidebar-hidden'), true);
  assert.equal(sidebarOpenBtn.attrs['aria-expanded'], 'false');
});

for (const source of ['src', 'full']) {
  test(`image preview (${source}) locks the page and restores its position/focus`, () => {
    const dialog = element(), image = element(), title = element(), close = element(), trigger = element();
    const body = element(), html = element();
    body.style.top = '2px';
    trigger.dataset = { [source]: 'assets/original.png', title: 'Original' };
    dialog.querySelector = selector => ({ img: image, strong: title, button: close })[selector];
    dialog.showModal = () => { dialog.open = true; };
    dialog.close = () => { dialog.open = false; dialog.events.close(); };
    let scroll;
    vm.runInNewContext(read('assets/image-preview.js'), {
      document: { body, documentElement: html, querySelector: () => dialog, querySelectorAll: () => [trigger] },
      window: { scrollX: 0, scrollY: 870, scrollTo(value) { scroll = value; } }
    });
    trigger.events.click();
    assert.equal(dialog.open, true);
    assert.equal(image.src, 'assets/original.png');
    assert.equal(title.textContent, 'Original');
    assert.equal(body.style.top, '-870px');
    assert.equal(body.classList.contains('image-preview-open'), true);
    assert.equal(close.focusOptions.preventScroll, true);
    dialog.events.click({ target: image });
    assert.equal(dialog.open, true);
    close.events.click();
    assert.equal(dialog.open, false);
    assert.equal(body.style.top, '2px');
    assert.equal(scroll.top, 870);
    assert.equal(body.classList.contains('image-preview-open'), false);
    assert.equal(html.classList.contains('image-preview-open'), false);
    assert.equal(image.src, undefined);
    assert.equal(trigger.focusOptions.preventScroll, true);
  });
}

test('both skins use the shared native image dialog and retain safe-area support', () => {
  for (const prefix of ['', 'ink-archive/']) {
    for (const file of ['image_archive.html', 'revisions.html']) {
      const html = read(prefix + file);
      assert.match(html, /<dialog class="[^"]*image-preview"/);
      assert.match(html, /assets\/image-preview\.js\?v=20260929-mobile/);
      assert.match(html, /assets\/image-preview\.css\?v=20260929-mobile/);
      assert.match(html, /viewport-fit=cover/);
    }
  }
});
