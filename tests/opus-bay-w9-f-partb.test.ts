import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { after, afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

/**
 * Wave 9 · lane F · part b, in a DOM (review 2026-10-01):
 *   W9-F8  R§5 #14 the touch coach — only the player's own push marks it learnt (BAYBAY carrying the player marked it in
 *          0.4–0.7 s: ui/CoachMarkBody.tsx's speed > 0.8), a 3 s ghost stick on touch, a title-level message that yields;
 *   W9-F9  R§6 语言 rows + §6 names: the title's eyebrow / greeting / guides link, one line of controls, 今天在旧金山;
 *   W9-F10 R§6 the postcard turned to its words after 1.1 s by itself: it stays on its illustration until a tap.
 */

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/opus-bay?save=off&world=city', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Image: dom.window.Image,
  KeyboardEvent: dom.window.KeyboardEvent, performance: globalThis.performance, IS_REACT_ACT_ENVIRONMENT: true,
  localStorage: dom.window.localStorage,
});
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, cleanup, act, fireEvent, waitFor } = await import('@testing-library/react');
const { default: CoachMarkBody } = await import('../src/opus-bay/ui/CoachMarkBody');
/** ui/CoachMarkBody.tsx's COACH_SEEN_MS / GHOST_MS (not exported: the file exports its component only) */
const COACH_SEEN_MS = 8000, GHOST_MS = 3000;
const { PostcardReward } = await import('../src/opus-bay/ui/Moments');
const { TitleScreen } = await import('../src/opus-bay/ui/TitleScreen');
styles.deregister();
const { game, initialGameState } = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { flow } = await import('../src/opus-bay/game/flowStore');
const { coachSeen } = await import('../src/opus-bay/ui/coachSeen');
const A = await import('../src/opus-bay/game/attention');
const { POSTCARDS } = await import('../src/opus-bay/data/postcards');
const { __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
const { titleToday } = await import('../src/opus-bay/ui/titleToday');
afterEach(() => { cleanup(); });
after(() => { dom.window.close(); });

const h = React.createElement;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const playing = () => act(() => { game.set({ ...initialGameState(), phase: 'playing', mode: 'free', worldMode: 'city' }); });
/** Real time in act-wrapped steps: React renders between the coach's 150 ms ticks, as in the browser. */
const wait = async (ms: number) => { for (let left = ms; left > 0; left -= 150) await act(async () => { await sleep(Math.min(150, left)); }); };
/** Polls (act-wrapped 150 ms steps) until `ok` or `ms` ran out: the machine may be loaded (≈ 15 agents share it). */
const until = async (ok: () => boolean, ms = 8000) => { for (let left = ms; left > 0 && !ok(); left -= 150) await wait(150); return ok(); };
const still = () => { runtime.player.moving = false; runtime.player.speed = 0; runtime.input.moveX = 0; runtime.input.moveY = 0; };

test('W9-F8: BAYBAY carrying the player (a tour / 带我去 walk: moving at 2.4 u/s, no stick, no keys) never marks the lesson learnt; the player\'s own push does (before: marked in 0.15 s)', async () => {
  localStorage.clear(); A.clearAttention(); still(); runtime.input.device = 'keyboard';
  await playing();
  const c = render(h(CoachMarkBody)).container;
  // carried: moving, but runtime.input says no push (core/input.ts pollInput: keys + stick + pad)
  runtime.player.moving = true; runtime.player.speed = 2.4;
  await wait(2200);
  assert.equal(coachSeen(), false, 'a carried walk is not the lesson');
  assert.ok(c.querySelector('[data-coach="move"]'), 'the coach is up while BAYBAY walks the player (1.5 s of a free screen)');
  assert.match(A.slotHolder('title') ?? '', /^coach/, 'a title-level message (game/attention.ts)');
  // the player's own push
  runtime.input.moveY = 1;
  await wait(400);
  assert.equal(coachSeen(), true);
  assert.equal(c.querySelector('[data-coach="move"]'), null, 'gone at once');
  assert.equal(A.slotHolder('title'), null, 'the level is free again');
  still();
});

test('W9-F8: on touch a ghost stick plays for 3 s at the first free control; the coach yields to a toast after 2.5 s and comes back after it; 8 s on screen = seen', async () => {
  localStorage.clear(); A.clearAttention(); still(); runtime.input.device = 'touch';
  await playing();
  const c = render(h(CoachMarkBody)).container;
  assert.ok(await until(() => !!c.querySelector('.ob-ghost-stick'), 6000), 'the coach and its ghost stick');
  assert.match(c.textContent ?? '', /左边拖动走路 · 右边拖动转视角/);
  assert.ok(c.querySelector('.ob-ghost-stick'), 'the ghost stick');
  await wait(GHOST_MS + 200);
  assert.equal(c.querySelector('.ob-ghost-stick'), null, 'once, for 3 s');
  assert.equal(coachSeen(), false, 'about 4 s on screen: not yet seen');
  // a toast wants the title level: the coach (priority -1) has had its 2.5 s, the toast takes over
  const toast = A.requestSlot('title', 'toast:test', { priority: A.ATTENTION_PRIORITY.toast });
  await wait(300);
  assert.equal(toast.granted, true, 'the toast is not kept waiting behind a hint');
  assert.equal(c.querySelector('[data-coach="move"]'), null);
  toast.release();
  assert.ok(await until(() => !!c.querySelector('[data-coach="move"]'), A.ATTENTION_GAP_MS + 5000), 'back after the toast');
  // on screen COACH_SEEN_MS in all (the act steps run a little slower than the clock: up to 3 s more)
  for (let i = 0; i < 40 && !coachSeen(); i++) await wait(150);
  assert.equal(coachSeen(), true, `${COACH_SEEN_MS / 1000} s on screen counts as seen`);
  assert.ok(c.querySelector('[data-coach="move"]'), 'seen, but up until the player moves or something covers it');
  runtime.input.device = 'keyboard';
});

test('W9-F10: a new postcard stays on its illustration until a tap (before: turned to its words after 1.1 s by itself)', async () => {
  const card = POSTCARDS[0]!;
  await act(async () => { flow.set({ postcardReward: card.id, rewardFresh: true }); });
  const c = render(h(PostcardReward)).container;
  const pc = c.querySelector('.ob-postcard')!;
  assert.ok(pc);
  await wait(1600);
  assert.equal(pc.classList.contains('is-flipped'), false, 'still the picture after 1.6 s');
  assert.match(c.textContent ?? '', /点一下翻面/);
  fireEvent.click(pc);
  assert.equal(pc.classList.contains('is-flipped'), true, 'a tap turns it');
  await act(async () => { flow.set({ postcardReward: null, rewardFresh: false }); });
});

test('W9-F9: the title — 小小湾区 · BAYLINK (no Opus Bay), 我是 BAYBAY…, 先不玩，直接看攻略, one line of controls, and 今天在旧金山 on Fleet Week\'s parade morning', async () => {
  (await import('../src/opus-bay/game/warmReady')).setWarmReady();
  __setBayNowForTests('2026-10-09T11:20');
  try {
    const line = await titleToday(50);
    assert.ok(line && /舰/.test(line.zh), `the Fleet Week line (${line?.zh})`);
    await act(async () => { game.set({ ...initialGameState(), phase: 'title', worldMode: 'city' }); });
    const c = render(h(TitleScreen, { onStart: () => undefined })).container;
    assert.equal(c.querySelector('.ob-title-mark')!.textContent, '小小湾区 · BAYLINK');
    assert.doesNotMatch(c.textContent ?? '', /Opus Bay/i);
    assert.match(c.querySelector('.ob-title-greet')!.textContent ?? '', /我是 BAYBAY，带你逛整座旧金山/);
    assert.match(c.querySelector('.ob-title-link')!.textContent ?? '', /先不玩，直接看攻略/);
    assert.equal(c.querySelectorAll('.ob-title-hint').length, 1);
    await waitFor(() => assert.ok(c.querySelector('.ob-title-today')), { timeout: 4000 });
    assert.equal(c.querySelector('.ob-title-today')!.textContent, `今天在旧金山 · ${line!.zh}`);
  } finally { __setBayNowForTests(null); }
});

test('W9-F9 / F11: a plain afternoon\'s line is the sunset time; 我是本地人 gets ONE 今天在旧金山 card ≈ 6 s after the choice (a gold toast through the title level)', async () => {
  const H = await import('../src/opus-bay/ui/titleHost');
  const W = await import('../src/opus-bay/game/welcome');
  __setBayNowForTests('2026-10-02T14:00');
  try {
    const line = await titleToday(50);
    assert.match(line?.zh ?? '', /^日落 18:\d\d$/, `a plain day: the sunset (${line?.zh})`);
    assert.match(line?.en ?? '', /^Sunset at 6:\d\d PM$|^Sunset at 18:\d\d$/);
    await act(async () => { game.set({ ...initialGameState(), phase: 'playing', mode: 'free', worldMode: 'city', toasts: [] }); });
    const off = H.initTitleHost();
    W.resetWelcome();
    W.runWelcome({ kind: 'new', choice: 'local', zone: null, at: performance.now() - H.LOCAL_TODAY_AFTER_MS });
    const card = () => game.get().toasts.filter(t => (t.bi?.zh ?? t.text).startsWith('今天在旧金山 · 日落 18:'));
    assert.ok(await until(() => card().length > 0, 4000), JSON.stringify(game.get().toasts));
    assert.equal(card()[0]!.tone, 'gold');
    assert.equal(card().length, 1, 'one card');
    off();
  } finally { __setBayNowForTests(null); W.resetWelcome(); }
});
