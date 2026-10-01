// Audio-state regression checks with a small DOM/media double (not a visual browser test).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

class Element {
  constructor(tag) {
    this.tag = tag; this.children = []; this.attrs = {}; this.events = {}; this.textContent = '';
    this.style = { setProperty: (key, value) => { this.style[key] = value; } };
  }
  append(child) { this.children.push(child); }
  replaceChildren() { this.children = []; }
  setAttribute(key, value) { this.attrs[key] = value; }
  addEventListener(type, callback) { (this.events[type] ||= []).push(callback); }
  emit(type, detail) { (this.events[type] || []).forEach(fn => fn({ type, detail })); }
  querySelector(selector) { return this.parts?.[selector]; }
  querySelectorAll(tag) { return this.children.filter(child => child.tag === tag); }
  get options() { return this.children; }
  after(child) { child.host = this; }
}

function setup(initialArticle = 'bio-1', scriptUrl = 'https://example.test/zongpu/assets/biography-audio.js?v=20261001') {
  const audio = new Element('audio');
  Object.assign(audio, { readyState: 0, duration: NaN, currentTime: 0, paused: true, ended: false, playbackRate: 1, playCount: 0,
    muted: false,
    pause() { this.paused = true; this.emit('pause'); },
    load() { this.readyState = 0; this.currentTime = 0; this.ended = false; },
    play() { this.playCount++; this.paused = false; this.emit('play'); return Promise.resolve(); }
  });
  const choices = new Element('div'), speed = new Element('select'), current = new Element('span'), error = new Element('p');
  const articleLabel = new Element('span');
  const toggle = new Element('button'), progress = new Element('input'), elapsed = new Element('span');
  const duration = new Element('span'), mute = new Element('button');
  error.parts = { span: new Element('span'), button: new Element('button') };
  for (const value of ['0.75', '1', '1.25', '1.5', '2']) {
    const option = new Element('option'); option.value = value; speed.append(option);
  }
  const player = new Element('section');
  player.parts = { audio, '.bio-audio-choices': choices, '.bio-audio-current': current, '.bio-audio-article-title': articleLabel, select: speed,
    '.bio-audio-error': error, '.bio-audio-toggle': toggle, '.bio-audio-progress': progress,
    '.bio-audio-elapsed': elapsed, '.bio-audio-duration': duration, '.bio-audio-mute': mute };
  const panels = {};
  for (const [, id, title] of read('biographies.html').matchAll(/<article class="bio-page[^>]*id="([^"]+)"[\s\S]*?<h2>([^<]+)<\/h2>/g)) {
    const head = new Element('div'); head.parts = { h2: { textContent: title } };
    panels[id] = { id, querySelector: () => head };
  }
  const document = new Element('document');
  Object.assign(document, {
    currentScript: { src: scriptUrl },
    createElement: tag => tag === 'section' ? player : new Element(tag),
    getElementById: id => panels[id],
    querySelector: () => panels[initialArticle]
  });
  const window = new Element('window'), context = { window, document, URL };
  vm.createContext(context);
  vm.runInContext(read('assets/biography-audio-data.js'), context);
  vm.runInContext(read('assets/biography-audio.js'), context);
  return { audio, choices, speed, current, error, toggle, progress, elapsed, duration, mute,
    player, panels, window, library: window.BiographyAudioTracks,
    navigate: id => document.emit('biography:change', { article: id }),
    loaded: (duration = 100) => { audio.readyState = 1; audio.duration = duration; audio.emit('loadedmetadata'); }
  };
}

test('all 9 biographies map to 17 distinct, nonempty MP3 recordings, including the four praises', () => {
  const e = setup(), entries = Object.entries(e.library);
  assert.equal(entries.length, 9);
  assert.deepEqual(Object.keys(e.library).sort(), Object.keys(e.panels).sort());
  const files = entries.flatMap(([, tracks]) => tracks.map(track => track.file));
  assert.equal(files.length, 17);
  assert.equal(new Set(files).size, 17);
  assert.equal(e.library['bio-5'].length, 4);
  assert.equal(entries.filter(([, tracks]) => tracks.length === 2).length, 5);
  for (const file of files) assert.ok(fs.statSync(path.join(root, 'assets/audio/biographies', file)).size > 1000, file);
});

test('custom controls play, pause, seek, mute, and expose readable progress', () => {
  const e = setup();
  assert.equal(e.toggle.attrs['aria-label'], '播放朗读');
  assert.equal(e.progress.disabled, true);
  e.loaded(130);
  assert.equal(e.duration.textContent, '2:10');
  e.toggle.emit('click');
  assert.equal(e.audio.playCount, 1);
  assert.equal(e.toggle.attrs['aria-label'], '暂停朗读');
  e.progress.value = '75'; e.progress.emit('input');
  assert.equal(e.audio.currentTime, 75);
  assert.equal(e.elapsed.textContent, '1:15');
  assert.equal(e.progress.attrs['aria-valuetext'], '1:15 / 2:10');
  e.mute.emit('click');
  assert.equal(e.audio.muted, true);
  assert.equal(e.mute.attrs['aria-label'], '取消静音');
  e.toggle.emit('click');
  assert.equal(e.audio.paused, true);
  assert.equal(e.toggle.attrs['aria-label'], '播放朗读');
});

test('deep-linked article mounts correctly without autoplay; asset URLs work in file and hosted subpaths', () => {
  for (const base of ['https://example.test/zongpu/', 'https://example.test/', 'file:///Users/example/New%20project/']) {
    const e = setup('bio-9', new URL('assets/biography-audio.js?v=20261001', base).href);
    assert.equal(e.player.host, e.panels['bio-9'].querySelector());
    assert.equal(e.audio.src, new URL('assets/audio/biographies/' + encodeURIComponent(e.library['bio-9'][0].file), base).href);
    assert.equal(e.audio.playCount, 0);
    assert.equal(e.choices.children[0].attrs['aria-pressed'], 'true');
  }
});

test('switching versions preserves individual progress and speed, and continues only when already playing', () => {
  const e = setup();
  e.loaded(); e.audio.currentTime = 21;
  e.speed.value = '1.5'; e.speed.emit('change');
  e.audio.play();
  e.choices.children[1].emit('click');
  assert.equal(e.audio.playCount, 2);
  assert.equal(e.audio.currentTime, 0);
  assert.equal(e.audio.playbackRate, 1.5);
  e.loaded(); e.audio.currentTime = 8; e.audio.pause();
  e.choices.children[0].emit('click'); e.loaded();
  assert.equal(e.audio.currentTime, 21);
  assert.equal(e.audio.paused, true);
  e.choices.children[1].emit('click'); e.loaded();
  assert.equal(e.audio.currentTime, 8);
  assert.equal(e.choices.children[1].attrs['aria-pressed'], 'true');
  assert.equal(e.choices.children[0].attrs['aria-pressed'], 'false');
});

test('navigation stops old audio, returns to the selected version, and handles fast switches before metadata', () => {
  const e = setup();
  e.choices.children[1].emit('click'); e.loaded(); e.audio.currentTime = 19; e.audio.play();
  e.navigate('bio-5');
  assert.equal(e.audio.paused, true);
  assert.equal(e.player.host, e.panels['bio-5'].querySelector());
  assert.equal(e.choices.children.length, 4);
  for (let i = 0; i < 4; i++) {
    e.choices.children[i].emit('click');
    assert.ok(decodeURIComponent(e.audio.src).endsWith(e.library['bio-5'][i].file));
  }
  e.navigate('bio-1'); // Saved position must survive leaving before metadata arrives.
  e.navigate('bio-3');
  assert.equal(e.choices.hidden, true);
  e.navigate('bio-1'); e.loaded();
  assert.equal(e.audio.currentTime, 19);
  assert.equal(e.current.textContent, '原文朗读');
  assert.equal(e.current.hidden, true);
  assert.equal(e.audio.playCount, 1);
});

test('ended recordings restart at zero, same-article navigation does not interrupt, and pagehide pauses', () => {
  const e = setup(); e.loaded(); e.audio.currentTime = 99; e.audio.play();
  e.navigate('bio-1');
  assert.equal(e.audio.paused, false);
  e.audio.ended = true; e.audio.emit('ended');
  e.navigate('bio-2'); e.navigate('bio-1'); e.loaded();
  assert.equal(e.audio.currentTime, 0);
  e.audio.play(); e.window.emit('pagehide');
  assert.equal(e.audio.paused, true);
});

test('loading errors offer a working retry and stale play rejections cannot affect another article', async () => {
  const e = setup();
  e.audio.emit('error'); assert.equal(e.error.hidden, false);
  e.error.parts.button.emit('click');
  assert.equal(e.audio.playCount, 1);
  e.audio.emit('playing'); assert.equal(e.error.hidden, true);
  e.audio.play = () => Promise.reject({ name: 'NotAllowedError' });
  e.choices.children[1].emit('click');
  e.navigate('bio-2');
  await Promise.resolve();
  assert.equal(e.error.hidden, true);
});
