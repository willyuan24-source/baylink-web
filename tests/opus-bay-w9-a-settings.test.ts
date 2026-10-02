import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, afterEach } from 'node:test';
import { JSDOM } from 'jsdom';

/**
 * Wave 9 · lane A, part b: contrast (review R§6 技术 + C:/Users/willy/opus-qa/review-1001/tech/notes.md: "title hint
 * 2.60:1 (13px), OPUS BAY mark 2.82:1, white on teal buttons 3.89:1, focus ring rgba(teal,.55) ~1.7-1.9:1"; "BAYBAY bubble
 * teal on white 3.89:1; coin/postcard count gold 3.87:1; English area name 12px 3.4:1") and Settings (R§6 技术: "设置里缺音量
 * 滑块、「只关语音」和字号调节；镜头距离滑块没有可访问名称"). The colours are CSS: these tests read opus-bay.css and compute the
 * WCAG ratios of its tokens (each was below 4.5:1 on f1460b0c); the Settings rows render the real panel in jsdom.
 */

const CSS = fs.readFileSync(new URL('../src/opus-bay/opus-bay.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
const token = (name: string) => { const m = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(CSS); assert.ok(m, name); return m[1]; };
/** the declarations of one exact selector (the first rule that has it alone) */
const rule = (sel: string) => { const m = new RegExp(`(?:^|\\n|\\})\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(CSS); assert.ok(m, sel); return m[1]; };

type RGB = [number, number, number];
const rgb = (hex: string): RGB => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const lum = (c: RGB) => { const [r, g, b] = c.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a: RGB, b: RGB) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const over = (top: RGB, alpha: number, under: RGB): RGB => top.map((v, i) => v * alpha + under[i] * (1 - alpha)) as RGB;
const WHITE: RGB = [255, 255, 255];

test('W9-A4: white on the primary teal ≥ 4.5:1 (3.89 before: #2f8f88); the teal as text on white too (the BAYBAY bubble name, links)', () => {
  const teal = rgb(token('ob-teal'));
  assert.ok(ratio(WHITE, teal) >= 4.5, `white on --ob-teal ${ratio(WHITE, teal).toFixed(2)}`);
  assert.ok(ratio(rgb('#2f8f88'), WHITE) < 4.5, 'the old teal failed (the review\'s 3.89)');
  // the darker teal stays darker than the teal (hover / pressed keep their order)
  assert.ok(lum(rgb(token('ob-teal-d'))) < lum(teal));
});

test('W9-A4: the muted text (--ob-ink-3, 12–13 px) and the gold counts (--ob-gold-d) ≥ 4.5:1 on white and cream (3.58 / 3.45 and 4.05 before)', () => {
  for (const bg of ['#ffffff', token('ob-cream')]) {
    assert.ok(ratio(rgb(token('ob-ink-3')), rgb(bg)) >= 4.5, `ink-3 on ${bg}`);
    assert.ok(ratio(rgb(token('ob-gold-d')), rgb(bg)) >= 4.5, `gold-d on ${bg}`);
  }
  assert.ok(ratio(rgb(token('ob-gold-d')), rgb(token('ob-gold-l'))) >= 4.5, 'gold-d on its light chip');
  assert.ok(ratio(rgb('#7e8a85'), WHITE) < 4.5 && ratio(rgb('#a8741f'), WHITE) < 4.5, 'the old tokens failed');
});

test('W9-A4: the focus ring is an opaque 2 px line (was 3 px of teal at 55 %, ≈ 1.8:1) of ≥ 3:1 against white and cream', () => {
  const body = rule(".ob-overlay :where(button, a, input, summary, [tabindex]):focus-visible");
  const m = /outline:\s*2px solid var\(--(ob-[a-z0-9-]+)\)/.exec(body);
  assert.ok(m, body);
  assert.doesNotMatch(body, /rgba/);
  for (const bg of ['#ffffff', token('ob-cream'), token('ob-table')]) assert.ok(ratio(rgb(token(m[1])), rgb(bg)) >= 3, `ring on ${bg}`);
});

test('W9-A4: the title\'s key hints — the hint line on a cream capsule (2.60:1 over the art before), the Enter key on the teal Start ≥ 4.5:1; the body text of the choices ≥ 13 px', () => {
  const hint = rule('.ob-title-hint');
  const fg = /color:\s*var\(--(ob-[a-z0-9-]+)\)/.exec(hint)![1];
  const bg = /background:\s*rgba\((\d+),\s*(\d+),\s*(\d+),\s*([.\d]+)\)/.exec(hint);
  assert.ok(bg, 'the hint sits on its own background');
  // the worst case under the capsule: the darkest spot of the key art the review sampled is still light; take mid-grey
  const capsule = over([+bg[1], +bg[2], +bg[3]], +bg[4], [128, 128, 128]);
  assert.ok(ratio(rgb(token(fg)), capsule) >= 4.5, `hint ${ratio(rgb(token(fg)), capsule).toFixed(2)}`);
  const key = rule('.ob-key.on-dark');
  const kb = /background:\s*rgba\(0,\s*0,\s*0,\s*([.\d]+)\)/.exec(key);
  assert.ok(kb, key);
  assert.ok(ratio(WHITE, over([0, 0, 0], +kb[1], rgb(token('ob-teal')))) >= 4.5, 'white on the key over the teal button');
  for (const sel of ['.ob-choice-sub', '.ob-dialogue-foot']) assert.ok(Number(/font-size:\s*([\d.]+)px/.exec(rule(sel))![1]) >= 13, sel);
});

// ---- Settings (jsdom) --------------------------------------------------------------------------------------------------

const dom = new JSDOM('<!doctype html><html><head></head><body><main class="ob-page"></main></body></html>', { url: 'http://localhost/opus-bay?world=city', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  KeyboardEvent: dom.window.KeyboardEvent, Image: dom.window.Image, localStorage: dom.window.localStorage, performance: globalThis.performance, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { createElement: h } = await import('react');
const { render, cleanup, fireEvent, act } = await import('@testing-library/react');
const { SettingsPanel } = await import('../src/opus-bay/ui/Settings');
styles.deregister();
const TS = await import('../src/opus-bay/ui/textSize');
const AL = await import('../src/opus-bay/audio/levels');
const { game, initialGameState } = await import('../src/opus-bay/core/store');

afterEach(() => { cleanup(); });
after(() => { dom.window.close(); });

/** the accessible name of a form control: aria-label, else its <label for>, else the wrapping <label> */
const nameOf = (el: HTMLElement) => el.getAttribute('aria-label') ?? (el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent : null) ?? el.closest('label')?.textContent ?? '';

test('W9-A5: Settings has music / effects / voice sliders with their own names, 只关语音, and the camera slider is named (before: one unnamed slider, no volume)', () => {
  AL.setAudioLevelsStorageForTests(null);
  game.set({ ...initialGameState(), phase: 'playing', worldMode: 'city' });
  const { container } = render(h(SettingsPanel));
  const sliders = [...container.querySelectorAll<HTMLInputElement>('input[type="range"]')];
  assert.deepEqual(sliders.map(s => nameOf(s)), ['音乐音量', '音效音量', 'BAYBAY 的语音音量', '镜头距离']);
  for (const s of sliders) assert.ok(nameOf(s).trim().length > 1, 'every slider has a name');
  // music at its default 60 %, a change goes to lane X's levels (audio/levels.ts)
  assert.equal(sliders[0].value, '60');
  fireEvent.change(sliders[0], { target: { value: '35' } });
  assert.equal(AL.getAudioLevels().music, 0.35);
  fireEvent.change(sliders[2], { target: { value: '80' } });
  assert.equal(AL.getAudioLevels().voice, 0.8);
  // 只关语音: a switch; on → the voice slider dims, music / effects keep playing
  const mute = [...container.querySelectorAll<HTMLButtonElement>('[role="switch"]')].find(b => b.textContent?.includes('只关语音'))!;
  assert.ok(mute, '只关语音');
  assert.equal(mute.getAttribute('aria-checked'), 'false');
  fireEvent.click(mute);
  assert.equal(AL.getAudioLevels().voiceMuted, true);
  assert.equal(mute.getAttribute('aria-checked'), 'true');
  const voiceRow = sliders[2].closest('.ob-level')!;
  assert.ok(voiceRow.classList.contains('is-off') && !sliders[0].closest('.ob-level')!.classList.contains('is-off'));
  fireEvent.click(mute);
  assert.equal(AL.getAudioLevels().voiceMuted, false);
  // the master switch reads 声音 (it silences music and voice too); 音效 is the effects slider
  const master = [...container.querySelectorAll<HTMLButtonElement>('[role="switch"]')][0];
  assert.match(master.textContent ?? '', /^声音/);
  act(() => { AL.resetAudioLevels(); });
});

test('W9-A5: 文字大小 100 / 115 / 130 % — a radio group; the choice is put on .ob-page (the CSS scales the reading surfaces) and kept on this device', () => {
  TS.resetTextSizeForTests();
  localStorage.removeItem(TS.TEXT_SIZE_KEY);
  const page = document.querySelector('main.ob-page')!;
  const { container } = render(h(SettingsPanel));
  const group = container.querySelector('.ob-setting-text [role="radiogroup"]')!;
  const radios = [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
  assert.deepEqual(radios.map(r => r.textContent), ['标准 100%', '大 115%', '特大 130%']);
  assert.equal(radios[0].getAttribute('aria-checked'), 'true');
  fireEvent.click(radios[2]);
  assert.equal(page.getAttribute('data-ob-text'), '130');
  assert.equal(localStorage.getItem(TS.TEXT_SIZE_KEY), '130');
  assert.equal(radios[2].getAttribute('aria-checked'), 'true');
  // a new page load reads it back; a stored nonsense value is 100
  TS.resetTextSizeForTests();
  assert.equal(TS.textSize(), 130);
  assert.equal(TS.parseTextSize('999'), 100);
  assert.equal(TS.parseTextSize(null), 100);
  fireEvent.click(radios[0]);
  assert.equal(page.hasAttribute('data-ob-text'), false, '100 % removes it');
  // the CSS scales the dialogue box, the sheets' bodies (not the map's), toasts and bubbles at both sizes
  for (const n of ['115', '130']) assert.match(CSS, new RegExp(`\\.ob-page\\[data-ob-text='${n}'\\] :where\\(\\.ob-dialogue-box, \\.ob-sheet:not\\(\\.ob-map\\) > \\.ob-sheet-body, \\.ob-toast`));
});

test('W9-A5: ?save=off keeps the text size for the page only (nothing written)', () => {
  TS.resetTextSizeForTests();
  localStorage.removeItem(TS.TEXT_SIZE_KEY);
  dom.window.history.replaceState(null, '', '/opus-bay?world=city&save=off');
  try {
    TS.setTextSize(115);
    assert.equal(TS.textSize(), 115);
    assert.equal(localStorage.getItem(TS.TEXT_SIZE_KEY), null);
  } finally {
    dom.window.history.replaceState(null, '', '/opus-bay?world=city');
    TS.setTextSize(100);
  }
});
