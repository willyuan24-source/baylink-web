import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

/**
 * Lane G review (wave 4, early phase): the guidance components in a DOM. The trip card keeps the keyboard focus while
 * the Overlay re-renders it every second with a fresh inline onClose (Esc reaches the latest one); the panorama tags are
 * placed without rewriting unchanged styles; the waypoint label rule of guide-ui.css wins over opus-bay.css whatever
 * order the two sheets load in.
 */

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  KeyboardEvent: dom.window.KeyboardEvent, performance: globalThis.performance, IS_REACT_ACT_ENVIRONMENT: true,
});
// the components import their CSS: an empty module in node
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { TripCard } = await import('../src/opus-bay/ui/TripPill');
const { PanoramaTags } = await import('../src/opus-bay/ui/PanoramaTags');
const { placePanoramaTags } = await import('../src/opus-bay/ui/panoramaPlace');
const { ArrivalCard } = await import('../src/opus-bay/ui/ArrivalCard');
const { clearAttention } = await import('../src/opus-bay/game/attention');
styles.deregister();
afterEach(cleanup);

const h = React.createElement;

const legs = [
  { via: 'walk' as const, from: { x: 0, z: 0 }, to: { x: 10, z: 0, station: 'a', name: { zh: '海特区', en: 'Haight' } }, seconds: 20, length: 84 },
  { via: 'walk' as const, from: { x: 10, z: 0 }, to: { x: 90, z: 0, place: 'ocean-beach', name: { zh: '海洋海滩', en: 'Ocean Beach' } }, seconds: 60, length: 252 },
];
const trip = { legs, leg: 0 };

test('trip card: the focus stays where the player put it when the card re-renders with a new inline onClose; Esc calls the latest', () => {
  const calls: string[] = [];
  const props = (tag: string, left: string) => ({
    trip, title: { zh: '去海洋海滩', en: 'To Ocean Beach' }, left: { zh: left, en: left },
    onSkip: () => {}, onChange: () => {}, onEnd: () => {}, onClose: () => { calls.push(tag); },
  });
  const view = render(h(TripCard, props('a', '还要约 2 分钟')));
  const buttons = [...view.container.querySelectorAll<HTMLButtonElement>('.ob-trip-card-actions button')];
  assert.equal(buttons.length, 3);
  assert.equal(document.activeElement, buttons[0], 'the first action has the focus on open');
  // the player tabs to 结束
  act(() => { buttons[2].focus(); });
  assert.equal(document.activeElement, buttons[2]);
  // the Overlay's 1 Hz re-render (time left) with a new onClose: the focus stays on 结束
  view.rerender(h(TripCard, props('b', '还要约 1 分钟')));
  view.rerender(h(TripCard, props('c', '还要约 1 分钟')));
  assert.equal(document.activeElement, buttons[2], 'the focus was not pulled back to 跳过这一站');
  fireEvent.keyDown(window, { key: 'Escape' });
  assert.deepEqual(calls, ['c'], 'Esc closes through the latest callback, once');
});

test('panorama tags: placed by the layout, hidden when dropped; an unchanged frame writes no style', () => {
  const tags = [
    { id: 'coit-tower', name: { zh: '科伊特塔', en: 'Coit Tower' }, x: 0, z: 0, h: 28, rank: 1 as const, d: 900, color: '#d8744a', glyph: 'Landmark' as const },
    { id: 'city-hall', name: { zh: '市政厅', en: 'City Hall' }, x: 0, z: 0, h: 28, rank: 1 as const, d: 700, color: '#d8744a', glyph: 'Landmark' as const },
    { id: 'sutro-tower', name: { zh: '苏特罗塔', en: 'Sutro Tower' }, x: 0, z: 0, h: 30, rank: 2 as const, d: 300, color: '#d8744a', glyph: 'Landmark' as const },
  ];
  const picked: string[] = [];
  const view = render(h(PanoramaTags, { tags, onPick: (id: string) => { picked.push(id); } }));
  const root = view.container.querySelector<HTMLElement>('.ob-pano')!;
  const placed = [
    { id: 'coit-tower', x: 100, y: 200, box: { l: 60, t: 174, r: 140, b: 200 }, lead: false },
    { id: 'city-hall', x: 220, y: 160, box: { l: 185, t: 134, r: 255, b: 160 }, lead: true },
  ];
  const anchors = new Map([['coit-tower', { x: 100, y: 210 }], ['city-hall', { x: 222, y: 230 }]]);
  placePanoramaTags(root, placed, anchors);
  const el = (id: string) => root.querySelector<HTMLElement>(`[data-id="${id}"]`)!;
  assert.equal(el('coit-tower').dataset.show, '1');
  assert.equal(el('coit-tower').style.transform, 'translate3d(60.0px, 174.0px, 0)');
  assert.equal(el('city-hall').style.getPropertyValue('--ob-lead'), '70px', 'the leader line reaches down to the anchor');
  assert.equal(el('city-hall').style.getPropertyValue('--ob-lead-x'), '37px');
  assert.equal(el('sutro-tower').dataset.show, '0', 'dropped by the layout: hidden');
  // the same frame again: no style write at all
  let writes = 0;
  for (const t of tags) {
    const s = el(t.id).style;
    const set = s.setProperty.bind(s);
    s.setProperty = (...args: Parameters<CSSStyleDeclaration['setProperty']>) => { writes++; set(...args); };
  }
  placePanoramaTags(root, placed, anchors);
  assert.equal(writes, 0);
  fireEvent.click(el('city-hall'));
  assert.deepEqual(picked, ['city-hall']);
});

test('arrival card: (not sticky) goes by itself after its time, waits while the pointer is on it; (W9-F2) a first visit\'s card stays; Esc and every button close it', async () => {
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
  const arrival = { place: 'sf-state', name: { zh: '旧金山州立大学', en: 'San Francisco State University' }, tier: 1 as const, next: { zh: '石镇', en: 'Stonestown' } };
  let closed = 0, info = 0;
  const onClose = () => { closed++; };
  // (each card holds game/attention.ts' title level: a fresh arbiter per card, as two arrivals seconds apart are 2.5 s apart)
  clearAttention();
  const a = render(h(ArrivalCard, { arrival, onInfo: () => { info++; }, onPhoto: () => {}, onNext: () => {}, onClose, ms: 60, sticky: false }));
  await act(() => wait(150));
  assert.equal(closed, 1, 'closed after its time');
  a.unmount();
  // W9-F2 (review R§5 #5: "真正有价值的地点卡 6 秒就消失了"): the default card (an arrival moment = a first visit) has no timer
  clearAttention();
  const s = render(h(ArrivalCard, { arrival, onInfo: () => {}, onPhoto: () => {}, onClose, ms: 60 }));
  await act(() => wait(200));
  assert.equal(closed, 1, 'still up after 3× its old time');
  assert.equal(s.container.querySelector('.ob-arrival-timer'), null, 'no timer bar');
  s.unmount();
  // held while the pointer is on it
  closed = 0;
  clearAttention();
  const b = render(h(ArrivalCard, { arrival, onInfo: () => {}, onPhoto: () => {}, onClose, ms: 60, sticky: false }));
  const card = b.container.querySelector<HTMLElement>('.ob-arrival-card')!;
  fireEvent.pointerEnter(card);
  await act(() => wait(150));
  assert.equal(closed, 0, 'held');
  assert.equal(b.container.querySelector('.ob-arrival-timer')!.classList.contains('is-held'), true);
  assert.equal(b.queryByText('下一站'), null, 'no [下一站] without a next stop');
  b.unmount();
  // a button acts and closes; Esc closes
  closed = 0;
  clearAttention();
  const c = render(h(ArrivalCard, { arrival, onInfo: () => { info++; }, onPhoto: () => {}, onNext: () => {}, onClose }));
  fireEvent.click(c.getByText('看介绍'));
  assert.deepEqual([info, closed], [1, 1]);
  fireEvent.keyDown(window, { key: 'Escape' });
  assert.equal(closed, 2);
  assert.ok(c.getByText('下一站'));
});

/** Specificity of one simple CSS selector: [ids, classes + attributes + pseudo-classes, elements]. */
function specificity(sel: string): [number, number, number] {
  const s = sel.replace(/\[[^\]]*\]/g, () => ' .attr ').replace(/::[a-z-]+/g, ' el ');
  const ids = (s.match(/#[\w-]+/g) ?? []).length;
  const cls = (s.match(/\.[\w-]+|:[a-z-]+/g) ?? []).length;
  const els = (s.replace(/[#.:][\w-]+/g, ' ').match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length;
  return [ids, cls, els];
}
const beats = (a: [number, number, number], b: [number, number, number]) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** The selectors of every rule in `css` that sets `prop` on an element matched by a selector ending in `target`. */
function rulesSetting(css: string, target: string, prop: string): string[] {
  const out: string[] = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!new RegExp(`(^|;|\\s)${prop}\\s*:`).test(m[2])) continue;
    for (const sel of m[1].split(',').map(x => x.trim())) if (sel.endsWith(target) && sel.includes('.ob-waypoint[')) out.push(sel);
  }
  return out;
}

test('css: the laid-out waypoint label (guide-ui.css, top = --ob-label-dy) wins over opus-bay.css in either load order', () => {
  const guide = readFileSync(new URL('../src/opus-bay/ui/guide-ui.css', import.meta.url), 'utf8');
  const base = readFileSync(new URL('../src/opus-bay/opus-bay.css', import.meta.url), 'utf8');
  const ours = rulesSetting(guide, '.ob-waypoint-label', 'top');
  assert.equal(ours.length, 1, ours.join(' | '));
  assert.ok(ours[0].includes('[data-label]'));
  const theirs = rulesSetting(base, '.ob-waypoint-label', 'top');
  assert.ok(theirs.some(s => s.includes("[data-edge='1']")), 'the edge rule this guards against is still there');
  for (const sel of theirs) assert.ok(beats(specificity(ours[0]), specificity(sel)) > 0, `${ours[0]} must beat ${sel}`);
});
