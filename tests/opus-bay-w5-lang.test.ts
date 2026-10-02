import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test, { after, afterEach } from 'node:test';
import { JSDOM } from 'jsdom';

/**
 * Wave 5 · the language switch (the owner, 2026-09-28: 在游戏里切换中英文，或者一开始选中英文来开始): 简体 · 繁體 · English
 * on the title (before Start) and in Settings, switching live through the site's setLocale (saved for all of BAYLINK).
 *   ui/langChoice   GAME_LANGS, langSearch (the site's ?lang rule), chooseGameLocale (setLocale + the address bar)
 *   ui/LangPills    the pills (title capsule, Settings row)
 *   core/store      toast({ zh, en }) keeps both languages; flow.announce too — they follow a switch
 */

// a DOM (the pills are clicked, the title re-renders; a server render would always read the default locale)
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/opus-bay?world=city', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  KeyboardEvent: dom.window.KeyboardEvent, Image: dom.window.Image, localStorage: dom.window.localStorage, performance: globalThis.performance, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
Object.defineProperty(dom.window, 'matchMedia', { value: (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
// the UI modules import their CSS: an empty module in node (as tests/opus-bay-sf-guide-city.test.ts)
registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const stored = { get: (k: string) => dom.window.localStorage.getItem(k) };

const L = await import('../src/i18n/locale');
const { GAME_LANGS, chooseGameLocale, langSearch } = await import('../src/opus-bay/ui/langChoice');
type Env = import('../src/opus-bay/ui/langChoice').LangEnv;
const { pick } = await import('../src/opus-bay/i18n');
const { createElement: h } = await import('react');
const { render, cleanup, act, fireEvent, waitFor } = await import('@testing-library/react');
afterEach(() => { cleanup(); });
// the toasts' timers run on the DOM window: closing it lets the process end
after(() => { dom.window.close(); });

/** a fake address bar and site switch: records what chooseGameLocale did */
function fakeEnv(search: string, set: Env['set'] = async () => true) {
  const calls: { set: [string, boolean][]; replaced: string[] } = { set: [], replaced: [] };
  const env: Env = {
    set: (l, p) => { calls.set.push([l, p]); return set(l, p); },
    location: { pathname: '/opus-bay', search, hash: '' },
    replace: url => { calls.replaced.push(url); },
  };
  return { env, calls };
}

test('lang: the three editions, each named in its own script, in the order 简体 · 繁體 · English', () => {
  assert.deepEqual(GAME_LANGS.map(o => o.value), ['zh-Hans', 'zh-Hant', 'en']);
  assert.deepEqual(GAME_LANGS.map(o => o.label), ['简体', '繁體', 'English']);
  for (const o of GAME_LANGS) assert.ok(L.isLocale(o.value));
});

test('lang: langSearch follows the site\'s ?lang rule (简体 has none) and keeps every other parameter', () => {
  assert.equal(langSearch('?world=city', 'en'), '?world=city&lang=en');
  assert.equal(langSearch('?world=city&lang=en', 'zh-Hant'), '?world=city&lang=zh-Hant');
  assert.equal(langSearch('?world=city&lang=en', 'zh-Hans'), '?world=city');
  assert.equal(langSearch('?lang=zh-Hant', 'zh-Hans'), '');
  assert.equal(langSearch('', 'zh-Hans'), '');
  assert.equal(langSearch('', 'zh-Hant'), '?lang=zh-Hant');
  const kept = new URLSearchParams(langSearch('?at=ll:37.8024,-122.4058&start=free', 'en'));
  assert.deepEqual([kept.get('at'), kept.get('start'), kept.get('lang')], ['ll:37.8024,-122.4058', 'free', 'en']);
});

test('lang: chooseGameLocale saves the choice (persist) and keeps the address bar in step — only when it took effect', async () => {
  // a link opened as ?lang=en, then 简体 chosen: the parameter goes (a reload would bring English back over the saved choice)
  let f = fakeEnv('?world=city&lang=en');
  assert.equal(await chooseGameLocale('zh-Hans', f.env), true);
  assert.deepEqual(f.calls.set, [['zh-Hans', true]], 'the site\'s setLocale, persisted');
  assert.deepEqual(f.calls.replaced, ['/opus-bay?world=city']);
  // English from a plain link: named, like the site's own switcher does
  f = fakeEnv('?world=city');
  await chooseGameLocale('en', f.env);
  assert.deepEqual(f.calls.replaced, ['/opus-bay?world=city&lang=en']);
  // nothing to change in the address: no history write
  f = fakeEnv('');
  await chooseGameLocale('zh-Hans', f.env);
  assert.deepEqual(f.calls.replaced, []);
  // overtaken by a later choice (setLocale's own sequence says false): the address stays
  f = fakeEnv('?lang=en', async () => false);
  assert.equal(await chooseGameLocale('zh-Hant', f.env), false);
  assert.deepEqual(f.calls.replaced, []);
  // the edition's text did not load (offline): the error reaches the pills, the old language and address stay
  f = fakeEnv('?lang=en', async () => { throw new Error('offline'); });
  await assert.rejects(chooseGameLocale('zh-Hant', f.env), /offline/);
  assert.deepEqual(f.calls.replaced, []);
  // not an edition: ignored
  f = fakeEnv('');
  assert.equal(await chooseGameLocale('fr' as never, f.env), false);
  assert.deepEqual(f.calls.set, []);
});

test('lang: the real switch — the site\'s locale, saved, every listener told; the game\'s words follow in all three', async () => {
  const bar = fakeEnv('?world=city');
  const env: Env = { ...bar.env, set: L.setLocale };
  let told = 0;
  const off = L.subscribeLocale(() => { told++; });
  try {
    const title = { zh: '湾区小旅', en: 'Little Bay Trip' };
    assert.equal(await chooseGameLocale('en', env), true);
    assert.equal(L.getLocale(), 'en');
    assert.equal(stored.get(L.LOCALE_KEY), 'en', 'saved for the whole site');
    assert.equal(pick(title, L.getLocale()), 'Little Bay Trip');
    assert.equal(await chooseGameLocale('zh-Hant', env), true);
    assert.equal(stored.get(L.LOCALE_KEY), 'zh-Hant');
    assert.equal(pick(title, L.getLocale()), '灣區小旅', 'Traditional from the site\'s conversion layer');
    assert.equal(await chooseGameLocale('zh-Hans', env), true);
    assert.equal(stored.get(L.LOCALE_KEY), 'zh-Hans');
    assert.equal(pick(title, L.getLocale()), '湾区小旅');
    assert.ok(told >= 3, `listeners told on each switch (${told})`);
    // two quick taps: the last one wins, the first reports it was overtaken
    const [a, b] = await Promise.all([chooseGameLocale('en', env), chooseGameLocale('zh-Hant', env)]);
    assert.deepEqual([a, b, L.getLocale()], [false, true, 'zh-Hant']);
  } finally {
    off();
    await L.setLocale('zh-Hans', false);
  }
});

test('lang: a toast or an announcement given { zh, en } follows a switch while it is on screen (a plain string stays)', async () => {
  const { game, toast, initialGameState } = await import('../src/opus-bay/core/store');
  const { say, announce } = await import('../src/opus-bay/game/flow');
  const { flow } = await import('../src/opus-bay/game/flowStore');
  const { Toasts, LiveRegion } = await import('../src/opus-bay/ui/Floating');
  try {
    await act(async () => { await L.setLocale('zh-Hans', false); game.set({ toasts: [] }); });
    act(() => {
      toast({ zh: '已存进相册', en: 'Saved to your album' }, 'info', 60_000);
      say('欢迎回来！我们接着逛吧。', "Welcome back! Let's keep exploring.", 'info', 60_000);
      toast('纯文字', 'info', 60_000);
      announce({ zh: '抵达渡轮大厦', en: 'Arrived at the Ferry Building' });
    });
    const items = game.get().toasts;
    assert.deepEqual(items.map(x => x.text), ['已存进相册', '欢迎回来！我们接着逛吧。', '纯文字'], '`text`: the words of the moment (what tests and logs read)');
    assert.deepEqual(items.map(x => x.bi?.en ?? null), ['Saved to your album', "Welcome back! Let's keep exploring.", null]);
    assert.deepEqual(flow.get().announce, { zh: '抵达渡轮大厦', en: 'Arrived at the Ferry Building' }, 'kept in both languages');
    const view = render(h('div', null, h(Toasts), h(LiveRegion)));
    const shown = () => [...view.container.querySelectorAll('.ob-toast, .ob-sr')].map(e => e.textContent).filter(Boolean);
    assert.deepEqual(shown(), ['已存进相册', '欢迎回来！我们接着逛吧。', '纯文字', '抵达渡轮大厦']);
    // the same toasts, still on screen, after a switch
    await act(async () => { await L.setLocale('en', false); });
    assert.deepEqual(shown(), ['Saved to your album', "Welcome back! Let's keep exploring.", '纯文字', 'Arrived at the Ferry Building']);
    await act(async () => { await L.setLocale('zh-Hant', false); });
    assert.deepEqual(shown(), ['已存進相冊', '歡迎回來！我們接著逛吧。', '純文字', '抵達渡輪大廈']);
  } finally {
    await act(async () => { await L.setLocale('zh-Hans', false); game.set({ ...initialGameState(), toasts: [] }); flow.set({ announce: '' }); });
  }
});

test('lang: the pills — on the title before Start and in Settings, the current one checked, names never converted; a tap switches at once', async () => {
  const { game, initialGameState } = await import('../src/opus-bay/core/store');
  const { TitleScreen } = await import('../src/opus-bay/ui/TitleScreen');
  const { SettingsPanel } = await import('../src/opus-bay/ui/Settings');
  // (W9-P1) the world is warm: Start reads 开始 / Start (before that it reads 准备中…: tests/opus-bay-w9-p.test.ts)
  (await import('../src/opus-bay/game/warmReady')).setWarmReady();
  const radios = (root: ParentNode) => [...root.querySelectorAll<HTMLButtonElement>('.ob-lang-pills [role="radio"]')].map(b => [b.lang, b.getAttribute('aria-checked'), b.textContent]);
  const expect = (locale: string) => GAME_LANGS.map(o => [o.value, String(o.value === locale), o.label]);
  try {
    dom.window.history.replaceState(null, '', '/opus-bay?world=city');
    await act(async () => { await L.setLocale('zh-Hans', false); game.set({ ...initialGameState(), phase: 'title', worldMode: 'city' }); });
    const title = render(h(TitleScreen, { onStart: () => undefined }));
    const c = title.container;
    const group = c.querySelector('.ob-lang-pills')!, start = c.querySelector('.ob-title-start')!;
    assert.ok(group && start && (group.compareDocumentPosition(start) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING), 'the language comes before Start');
    assert.equal(group.getAttribute('role'), 'radiogroup');
    assert.equal(group.getAttribute('translate'), 'no');
    assert.deepEqual(radios(c), expect('zh-Hans'));
    // a tap: the title in English at once, saved for the site, the address bar named
    fireEvent.click(c.querySelector('[role="radio"][lang="en"]')!);
    await waitFor(() => assert.equal(c.querySelector('.ob-title-h1')!.textContent, 'Little Bay Trip'));
    assert.deepEqual(radios(c), expect('en'));
    assert.equal(stored.get(L.LOCALE_KEY), 'en');
    assert.equal(dom.window.location.search, '?world=city&lang=en');
    assert.equal(c.querySelector('.ob-title-start span')!.textContent, 'Start');
    // 繁體: the site's conversion layer; the pills keep their own scripts (简体, never 簡體)
    fireEvent.click(c.querySelector('[role="radio"][lang="zh-Hant"]')!);
    await waitFor(() => assert.equal(c.querySelector('.ob-title-h1')!.textContent, '灣區小旅'));
    assert.deepEqual(radios(c), expect('zh-Hant'));
    assert.equal(dom.window.location.search, '?world=city&lang=zh-Hant');
    // Settings: the same three, first, with a legend in both words; switching live there too
    const settings = render(h(SettingsPanel));
    const sc = settings.container;
    assert.deepEqual(radios(sc), expect('zh-Hant'));
    const rows = [...sc.querySelectorAll('.ob-setting, .ob-setting-group')];
    assert.ok(rows[0]?.classList.contains('ob-setting-lang'), 'the language row first');
    assert.equal(sc.querySelector('.ob-setting-lang legend')!.textContent, '語言 · Language');
    fireEvent.click(sc.querySelector('[role="radio"][lang="en"]')!);
    await waitFor(() => assert.equal(sc.querySelector('.ob-setting-lang legend')!.textContent, 'Language · 语言', 'the site\'s English layer leaves 语言 alone'));
    assert.match(sc.textContent ?? '', /Sound effects/);
    assert.equal(c.querySelector('.ob-title-h1')!.textContent, 'Little Bay Trip', 'every mounted view follows');
    fireEvent.click(sc.querySelector('[role="radio"][lang="zh-Hans"]')!);
    await waitFor(() => assert.match(sc.textContent ?? '', /音效/));
    assert.equal(dom.window.location.search, '?world=city', 'Simplified: no ?lang');
    assert.equal(stored.get(L.LOCALE_KEY), 'zh-Hans');
    // the district's title has them too (only the new control: the rest as before)
    cleanup();
    act(() => { game.set({ ...initialGameState(), phase: 'title', worldMode: 'district' }); });
    assert.equal(radios(render(h(TitleScreen, { onStart: () => undefined })).container).length, 3);
  } finally {
    await act(async () => { await L.setLocale('zh-Hans', false); game.set({ ...initialGameState() }); });
  }
});

test('lang: the title chunk stays free of three and the game — the switch adds only the site locale and tiny modules', () => {
  const root = path.resolve('src');
  const spec = /^\s*(?:import|export)\s+(?!type\s)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
  const resolve = (from: string, s: string) => {
    const base = path.resolve(path.dirname(from), s);
    for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    return null;
  };
  const graph = (from: string) => {
    const start = path.join(root, from);
    const seen = new Set([start]), bare = new Set<string>(), queue = [start];
    while (queue.length) {
      const f = queue.shift()!;
      for (const m of fs.readFileSync(f, 'utf8').matchAll(spec)) {
        if (!m[1].startsWith('.')) { bare.add(m[1]); continue; }
        const r = resolve(f, m[1]);
        if (r && !seen.has(r)) { seen.add(r); queue.push(r); }
      }
    }
    return { modules: [...seen].map(p => path.relative(root, p).split(path.sep).join('/')), bare: [...bare] };
  };
  const page = graph('opus-bay/OpusBayPage.tsx');
  assert.ok(page.modules.includes('opus-bay/ui/LangPills.tsx') && page.modules.includes('opus-bay/ui/langChoice.ts'), 'the walk reaches the pills');
  assert.deepEqual(page.bare.filter(b => b === 'three' || b.startsWith('three/') || b.startsWith('@react-three/')), [], 'no three in the title chunk');
  // (W7-Q1) one exception: audio/unlock.ts, the iPhone unlock the Start tap calls inside the gesture — it imports nothing
  assert.deepEqual(page.modules.filter(m => /^opus-bay\/(world|actors|audio|economy|play|eggs|realsf)\//.test(m) && m !== 'opus-bay/audio/unlock.ts'), [], 'no world / actors / audio / feature module in the title chunk');
  assert.deepEqual(graph('opus-bay/audio/unlock.ts').modules, ['opus-bay/audio/unlock.ts'], 'the unlock module stays dependency-free');
  assert.deepEqual(graph('opus-bay/audio/unlock.ts').bare, []);
  const pills = graph('opus-bay/ui/LangPills.tsx');
  assert.deepEqual(pills.modules.sort(), ['i18n/browser-locale.ts', 'i18n/en-patterns.json', 'i18n/locale.ts', 'opus-bay/core/events.ts', 'opus-bay/i18n.ts', 'opus-bay/ui/LangPills.tsx', 'opus-bay/ui/langChoice.ts'].sort());
});

test('lang: the world\'s painted Chinese follows 简体 ↔ 繁體 — the shop signs and the district\'s 这周去哪 board, in their own cells', async () => {
  const { paintedWords, LabelAtlas } = await import('../src/opus-bay/world/labels');
  const S = await import('../src/opus-bay/world/sf/signsAtlas');
  // a canvas recorder: every fillText with the cell it was drawn in
  let tx = 0, ty = 0;
  const stack: [number, number][] = [];
  const drawn: { text: string; tx: number; ty: number }[] = [];
  const ctx = {
    save() { stack.push([tx, ty]); }, restore() { [tx, ty] = stack.pop()!; }, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, quadraticCurveTo() {},
    fill() {}, stroke() {}, fillRect() {}, strokeRect() {}, clearRect() {}, translate(x: number, y: number) { tx += x; ty += y; }, scale() {},
    fillText(text: string) { drawn.push({ text, tx, ty }); }, measureText: (t: string) => ({ width: t.length * 20 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    font: '', fillStyle: '' as unknown, strokeStyle: '' as unknown, lineWidth: 1, textAlign: 'left' as CanvasTextAlign, textBaseline: 'alphabetic' as CanvasTextBaseline, globalAlpha: 1,
  };
  try {
    await L.setLocale('zh-Hans', false);
    assert.equal(paintedWords('这周去哪 · THIS WEEK'), '这周去哪 · THIS WEEK');
    await L.setLocale('en', false);
    assert.equal(paintedWords('面包'), '面包', 'English keeps a bilingual sign as it is');
    await L.setLocale('zh-Hant', false);
    assert.equal(paintedWords('这周去哪 · THIS WEEK'), '這週去哪 · THIS WEEK');
    assert.equal(paintedWords('PIER 39'), 'PIER 39');
    // the signs atlas in 繁體: the Chinese lines converted; Japanese, Spanish and English lines as written
    drawn.length = 0;
    S.drawSignsAtlas(ctx, paintedWords);
    const words = drawn.map(d => d.text);
    for (const w of ['麵 包', '點 心', '書 店', '雜 貨', '麵 館', '洗 衣', 'Bakery', 'Dim Sum', 'Taquería', 'ラーメン', '和 菓 子']) assert.ok(words.includes(w), `${w} painted (${words.join(' | ')})`);
    for (const w of ['面 包', '点 心', '面 馆']) assert.ok(!words.includes(w), `${w} not painted in 繁體`);
    // the label atlas (the World's: pier numbers, plaques and the 这周去哪 board): a fake canvas under it
    await L.setLocale('zh-Hans', false);
    const create = document.createElement.bind(document);
    document.createElement = ((tag: string) => (tag === 'canvas' ? { width: 0, height: 0, getContext: () => ctx } : create(tag))) as typeof document.createElement;
    let atlas: InstanceType<typeof LabelAtlas>;
    try { atlas = new LabelAtlas(); } finally { document.createElement = create; }
    drawn.length = 0;
    const board = atlas.label('week-board', { text: '这周去哪 · THIS WEEK', w: 448, h: 64, bg: '#2f8f88', fg: '#fffaf1', font: 'cjk', size: 0.52 });
    atlas.label('pier7', { text: 'PIER 7', w: 256, h: 72, bg: '#f4ecd9', fg: '#3f5750' });
    const at = (text: string) => drawn.filter(d => d.text === text).map(d => [d.tx, d.ty]);
    const cell = at('这周去哪 · THIS WEEK')[0];
    assert.deepEqual(cell, [Math.round(board.u0 * 1024), Math.round((1 - board.v1) * 1024)], 'painted in its cell');
    const version = atlas.texture.version;
    await L.setLocale('zh-Hant', false);
    assert.deepEqual(at('這週去哪 · THIS WEEK'), [cell], '繁體: re-painted in the same cell, nothing re-laid out');
    assert.equal(at('PIER 7').length, 1, 'English plaques are not touched');
    assert.ok(atlas.texture.version > version, 'one texture upload');
    await L.setLocale('en', false);
    assert.deepEqual(at('这周去哪 · THIS WEEK'), [cell, cell], 'English: the bilingual board as written');
    assert.equal(atlas.repaintChinese(), 0, 'nothing more to paint');
  } finally {
    await L.setLocale('zh-Hans', false);
  }
});
