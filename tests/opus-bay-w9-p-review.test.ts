import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

/**
 * Wave 9 · lane P · the adversarial review's fixes (docs/opus-bay/sf-w9-P.md "Review (Ultra)"), in a DOM:
 *   P-RP-1          a press on Start while it reads 准备中… was thrown away: it is kept now, the button says 好了就自动开始…,
 *                   and the game starts by itself once warm-ready (Enter too)
 *   P-RC-2 / P-RP-6 a returning player's 从头开始 · 渡轮大厦 looked live while preparing: dimmed like Start, its press kept too
 *   P-RC-3          the district's Start probes WebGL inside the press (a press before the idle probe mounted GameRoot
 *                   unprobed); software GL changes nothing in the district (no Low, no note)
 *   P-RP-5          the no-WebGL explanation borrowed .ob-title-hint, which the title hides in short windows
 */

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/opus-bay?save=off&world=city', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Image: dom.window.Image,
  KeyboardEvent: dom.window.KeyboardEvent, performance: globalThis.performance, IS_REACT_ACT_ENVIRONMENT: true,
  localStorage: dom.window.localStorage,
});
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, cleanup, act, fireEvent, waitFor } = await import('@testing-library/react');
const { TitleScreen } = await import('../src/opus-bay/ui/TitleScreen');
styles.deregister();
const { game, initialGameState } = await import('../src/opus-bay/core/store');
const W = await import('../src/opus-bay/game/warmReady');
afterEach(() => { cleanup(); W.resetWarmReadyForTests(); game.set({ ...initialGameState() }); });
after(() => { dom.window.close(); });

const h = React.createElement;
const src = (p: string) => fs.readFileSync(`src/opus-bay/${p}`, 'utf8');

test('P-RP-1: a click on Start during 准备中… is kept (好了就自动开始…, still busy) and starts the game once warm-ready — once', async () => {
  W.resetWarmReadyForTests();
  W.setGlSupport('ok');
  await act(async () => { game.set({ ...initialGameState(), phase: 'title', worldMode: 'city' }); });
  let starts = 0;
  const c = render(h(TitleScreen, { onStart: () => { starts++; } })).container;
  const start = c.querySelector<HTMLButtonElement>('.ob-title-start')!;
  assert.equal(start.textContent, '准备中…');
  await act(async () => { fireEvent.click(start); });
  assert.equal(starts, 0, 'not before the world is warm');
  assert.equal(start.querySelector('span')!.textContent, '好了就自动开始…', 'the press is acknowledged');
  assert.equal(start.getAttribute('aria-busy'), 'true');
  await act(async () => { fireEvent.click(start); });
  await act(async () => { W.setWarmReady(); });
  await waitFor(() => assert.equal(starts, 1, 'started by itself once ready'), { timeout: 2000 });
  await new Promise(r => setTimeout(r, 30));
  assert.equal(starts, 1, 'a second press while waiting does not start twice');
});

test('P-RP-1: Enter during 准备中… is kept as well; without a press nothing starts on warm-ready', async () => {
  W.resetWarmReadyForTests();
  W.setGlSupport('ok');
  await act(async () => { game.set({ ...initialGameState(), phase: 'title', worldMode: 'city' }); });
  let starts = 0;
  render(h(TitleScreen, { onStart: () => { starts++; } }));
  await act(async () => { W.setWarmReady(); });
  await new Promise(r => setTimeout(r, 30));
  assert.equal(starts, 0, 'warm-ready alone never starts the game');
  cleanup();
  W.resetWarmReadyForTests();
  W.setGlSupport('ok');
  render(h(TitleScreen, { onStart: () => { starts++; } }));
  await act(async () => { fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' }); });
  assert.equal(starts, 0);
  await act(async () => { W.setWarmReady(); });
  await waitFor(() => assert.equal(starts, 1), { timeout: 2000 });
});

test('P-RP-1: no WebGL never queues (no Start; Enter does nothing, ever)', async () => {
  W.resetWarmReadyForTests();
  W.setGlSupport('none');
  await act(async () => { game.set({ ...initialGameState(), phase: 'title', worldMode: 'city' }); });
  let starts = 0;
  render(h(TitleScreen, { onStart: () => { starts++; } }));
  await act(async () => { fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' }); });
  assert.equal(W.startQueued(), false);
  assert.equal(starts, 0);
});

test('P-RC-2 / P-RP-6: 从头开始 · 渡轮大厦 is dimmed like Start while preparing and its press is kept (it starts over, not resumes)', () => {
  const t = src('ui/TitleScreen.tsx');
  assert.match(t, /className="ob-btn ob-btn-ghost ob-btn-xl ob-title-resume" onClick=\{preparing \? \(\) => hold\(onStart\) : onStart\} aria-disabled=\{preparing \|\| undefined\} style=\{preparing \? WAIT_STYLE : undefined\}/);
  assert.match(t, /ob-title-start" onClick=\{primary\}[^>]*style=\{preparing \? WAIT_STYLE : undefined\}/);
});

test('P-RC-3: the page probes WebGL inside the press too (the district\'s Start is live at once); software GL leaves the district as it was', async () => {
  assert.match(src('OpusBayPage.tsx'), /const start = useCallback\(\(\) => \{ if \(!glOk\(\)\) return; primeAudio\(\{ starting: true \}\); setLoad\(true\); setWantStart\(true\); \}, \[\]\);/);
  assert.match(src('world/quality.ts'), /software: glSupport\(\) === 'software' && game\.get\(\)\.worldMode === 'city'/);
  W.resetWarmReadyForTests();
  W.setGlSupport('software');
  await act(async () => { game.set({ ...initialGameState(), phase: 'title', worldMode: 'district' }); });
  const c = render(h(TitleScreen, { onStart: () => undefined })).container;
  assert.doesNotMatch(c.textContent ?? '', /软件模式/, 'no software note on the district title');
  cleanup();
  await act(async () => { game.set({ ...initialGameState(), phase: 'title', worldMode: 'city' }); });
  assert.match(render(h(TitleScreen, { onStart: () => undefined })).container.textContent ?? '', /软件模式/, 'the city keeps it');
});

test('P-RP-5: the no-WebGL explanation is its own line, not .ob-title-hint (hidden by the title in short windows and short landscape phones)', async () => {
  W.resetWarmReadyForTests();
  W.setGlSupport('none');
  await act(async () => { game.set({ ...initialGameState(), phase: 'title', worldMode: 'city' }); });
  const c = render(h(TitleScreen, { onStart: () => undefined })).container;
  const note = c.querySelector('.ob-title-nogl')!;
  const why = [...note.querySelectorAll('p')].find(p => /硬件加速/.test(p.textContent ?? ''));
  assert.ok(why, 'the explanation is there');
  assert.ok(!why!.classList.contains('ob-title-hint'), 'not the controls hint the title hides');
  assert.ok(/\.ob-title-hint \{ display: none; \}/.test(src('opus-bay.css')), 'the reason: the title still hides .ob-title-hint somewhere');
});
