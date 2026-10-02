import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import type { Bilingual } from '../src/opus-bay/core/types';

/**
 * Wave 9 · lane F · part a — the first minute of each entry (sf-w9-lead.md §3 F (2)–(3), (7); review R§5 #5 / #6, R§6
 * 上手与引导 rows). City content, like tests/opus-bay-w5-content.test.ts (the page's `?world=city`, read at import time).
 *
 *   W9-F3  golden hour for the intro only (tests/opus-bay-flow-brain.test.ts F11 / W9-F3)
 *   W9-F4  我自己逛逛: no goals step, no pelican nudge, no soft hint for 3 min; 我是本地人: 3 quiet minutes for real
 *          (every unprompted source that asks game/baybayHold.ts baybayHeld(), and the 飞行券 gift)
 *   W9-F5  the pelican: on screen before 送你一位鹈鹕朋友！ / 解锁：随时飞; a new 我自己逛逛 player meets it at 36 s
 *   W9-F6  BAYBAY's pacer: a breath after a hold (P-7), and it tells the caller when it drops a line (W1)
 */

const g = globalThis as unknown as Record<string, unknown>;
g.location = { search: '?world=city&save=off', href: 'http://localhost/opus-bay?world=city&save=off', pathname: '/opus-bay', hostname: 'localhost' };
g.window ??= globalThis;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d, toBlob: (cb: (b: null) => void) => cb(null) }) };
let clock = 700_000;
mock.method(performance, 'now', () => clock);
const tick = (ms: number) => { clock += ms; };

const store = await import('../src/opus-bay/core/store');
const { game } = store;
const { runtime } = await import('../src/opus-bay/core/runtime');
const flowMod = await import('../src/opus-bay/game/flow');
const { flow, initialFlowState } = await import('../src/opus-bay/game/flowStore');
const inter = await import('../src/opus-bay/game/interactables');
const brain = await import('../src/opus-bay/game/brain');
const save = await import('../src/opus-bay/data/save');
const { setStorageForTests } = await import('../src/opus-bay/data/wishlist');
const goals = await import('../src/opus-bay/data/sf/goals');
const welcome = await import('../src/opus-bay/game/welcome');
const pelican = await import('../src/opus-bay/game/pelicanFirst');
const slots = await import('../src/opus-bay/ui/slots');
const moveApi = await import('../src/opus-bay/actors/moveApi');
const hold = await import('../src/opus-bay/game/baybayHold');
const shop = await import('../src/opus-bay/economy/shopRun');
const { LinePacer, HELD_GAP, PACER_MAX } = await import('../src/opus-bay/game/linePacer');
setStorageForTests(null);

function reset() {
  if (flow.get().trip) flowMod.endTrip();
  if (game.get().dialogue.nodeId) flowMod.closeDialogue();
  for (const o of [...slots.openOverlays()]) slots.closeOverlay(o.id);
  store.game.set({ ...store.initialGameState(), phase: 'playing', worldMode: 'city', mode: 'free' });
  flow.set(initialFlowState());
  Object.assign(runtime.player, { x: 0, y: 0, z: 0, heading: 0, moving: false, running: false, locked: false, pendingInteract: null, pathTarget: null });
  Object.assign(runtime.guide, { x: 1, y: 0, z: 0, state: 'follow', target: null, run: false, emote: 'none', arrived: false });
  brain.resetBrain();
  inter.setInteractables(inter.buildInteractables());
  save.resetSaveCache();
  moveApi.setGlideUnlocked(false);
  pelican.resetPelicanForTests();
  welcome.resetWelcome();
}
const bubbleZh = () => flow.get().bubble?.text.zh ?? null;

test('W9-F4: 我自己逛逛 (the welcome\'s choice 3) opens no goals step and sends nobody to Coit — BAYBAY follows, the goals wait in the journal, no soft hint for 3 min (before: the 10-goal step + 先去科伊特塔找鹈鹕朋友吧！)', () => {
  reset();
  game.set({ mode: 'onboarding' });
  flowMod.runAction({ type: 'free-roam' });
  assert.equal(game.get().mode, 'free');
  assert.equal(flowMod.goalsStepOpen(), false, 'no goals step');
  assert.equal(flow.get().goalsCard, false, 'no old goals card either');
  assert.ok(game.get().goalsDone.includes(goals.GOALS_STEP_SEEN), 'the step counts as shown: the goals are in the journal');
  assert.equal(bubbleZh(), flowMod.FREE_AGAIN.zh, '好嘞，你带路，我跟着！ (voiced: w5c-free-again)');
  assert.notEqual(bubbleZh(), flowMod.PELICAN_NUDGE.zh);
  assert.ok(flow.get().freeHintOffUntil >= clock + flowMod.QUIET_MS - 1, 'no soft waypoint hint for 3 min');
  assert.equal(flow.get().hushUntil, clock + 15_000, '15 s for the player\'s own first steps');
  // the same action later in the game (the call menu's free roam) is the old free roam
  reset();
  flowMod.runAction({ type: 'free-roam' });
  assert.equal(flow.get().hushUntil, 0);
});

test('W9-F4: 我是本地人 — 3 quiet minutes for real: every unprompted line source waits (baybayHeld), the 飞行券 gift too; one line, then nothing (before: 4 lines + a toast in 35 s)', () => {
  reset();
  game.set({ mode: 'onboarding' });
  flowMod.runAction({ type: 'skip-intro' });
  assert.equal(flow.get().hushUntil, clock + flowMod.QUIET_MS);
  assert.equal(flow.get().quietUntil, clock + flowMod.QUIET_MS, 'and the games\' own quiet rule (rumours, small talk) as before, 3 min');
  assert.ok(bubbleZh(), 'her one line');
  assert.equal(hold.baybayHeld(), true, 'held: the hunt hints, the hide & seek invite, the realsf / Halloween lines, rumours, the pacer');
  assert.equal(shop.ticketGiftWaits(), true, 'no 送你一张飞行券！');
  tick(flowMod.QUIET_MS - 1000);
  assert.equal(hold.baybayHeld(), true);
  tick(1001);
  assert.equal(hold.baybayHeld(), false, 'three minutes later she may talk');
  assert.equal(shop.ticketGiftWaits(), false);
  // the district is unchanged (the hold is a city rule)
  game.set({ worldMode: 'district' });
  flow.set({ hushUntil: clock + 60_000 });
  assert.equal(hold.baybayHeld(), false);
  // a game's own quiet (quietUntil: the claw, the frisbee…) does not hold the other sources (their invites, as before)
  game.set({ worldMode: 'city' });
  flow.set({ hushUntil: 0, quietUntil: clock + 60_000 });
  assert.equal(hold.baybayHeld(), false);
});

test('W9-F5: the 飞行券 gift waits through a new 我自己逛逛 player\'s first 90 s (the pelican lands at 36 s: before, 送你一张飞行券！ at 9.9 s, 还你 10 金币 at 36 s)', () => {
  reset();
  welcome.runWelcome({ kind: 'new', choice: 'free', zone: null, at: clock });
  flow.set({ hushUntil: 0 });
  assert.equal(shop.ticketGiftWaits(), true);
  tick(89_000);
  assert.equal(shop.ticketGiftWaits(), true);
  tick(1_500);
  assert.equal(shop.ticketGiftWaits(), false);
  // a tour or week player is not held by this rule
  reset();
  welcome.runWelcome({ kind: 'new', choice: 'week', zone: null, at: clock });
  assert.equal(shop.ticketGiftWaits(), false);
});

test('W9-F5: a new 我自己逛逛 player meets the pelican FIRST_MINUTE_PELICAN_MS after the choice (the glide by ≈ 60 s); never a tour / week / local player, never twice', () => {
  reset();
  welcome.runWelcome({ kind: 'new', choice: 'free', zone: null, at: clock });
  const offer = () => true;
  tick(pelican.FIRST_MINUTE_PELICAN_MS - 100);
  pelican.stepPelican(clock, offer);
  assert.equal(moveApi.glideUnlocked(), false);
  tick(100);
  pelican.stepPelican(clock, offer);
  assert.equal(moveApi.glideUnlocked(), true);
  assert.equal(pelican.pelicanPending()?.reason, 'first-minute', 'the moment: the bird lands, 先试试起飞？');
  assert.ok(game.get().goalsDone.includes('pelican'));
  for (const choice of ['tour', 'week', 'local'] as const) {
    reset();
    welcome.runWelcome({ kind: 'new', choice, zone: null, at: clock });
    tick(pelican.FIRST_MINUTE_PELICAN_MS + 1000);
    pelican.stepPelican(clock, offer);
    assert.equal(moveApi.glideUnlocked(), false, choice);
  }
  reset();
  welcome.runWelcome({ kind: 'returning', zone: null, at: clock });
  tick(pelican.FIRST_MINUTE_PELICAN_MS + 1000);
  pelican.stepPelican(clock, offer);
  assert.equal(moveApi.glideUnlocked(), false, 'a returning player');
});

test('W9-F5: the first minute\'s 试试起飞 asks lane A for the short course and an immediate take-off (no second G); 解锁：随时飞 after the landing', async () => {
  reset();
  const { emit } = await import('../src/opus-bay/core/events');
  const asked: unknown[] = [];
  welcome.runWelcome({ kind: 'new', choice: 'free', zone: null, at: clock });
  tick(pelican.FIRST_MINUTE_PELICAN_MS);
  pelican.stepPelican(clock, () => true);
  pelican.resetPelicanForTests(opts => { asked.push(opts); return true; }, () => true);
  // (the reset above forgot the pending moment: unlock again the same way)
  moveApi.setGlideUnlocked(false);
  pelican.unlockPelican('first-minute', clock);
  tick(pelican.PAIR_WAIT_MS);
  pelican.stepPelican(clock, () => true);
  assert.equal(game.get().dialogue.nodeId, 'pelican.moment');
  const toasted = () => game.get().toasts.some(t => t.text.startsWith('解锁：随时飞！'));
  assert.equal(toasted(), false, 'not before the flight');
  flowMod.chooseDialogue(0);
  flowMod.advanceDialogue();
  assert.deepEqual(asked, [{ short: true, takeOff: true }]);
  emit({ type: 'glide:land', x: 0, z: 0 });
  assert.equal(toasted(), true);
});

test('W9-F6: the pacer waits HELD_GAP after a hold (P-7: "one line every 5 s after a held release") and reports every line it drops unsaid', () => {
  const dropped: string[] = [];
  const line = (zh: string, extra: Partial<Parameters<InstanceType<typeof LinePacer>['offer']>[0]> = {}) => ({ text: { zh, en: zh } as Bilingual, onDrop: (why: string) => dropped.push(`${zh}:${why}`), ...extra });
  const p = new LinePacer();
  p.offer(line('一'), 0);
  p.offer(line('二'), 0);
  assert.equal(p.step(1, true), null, 'held');
  assert.equal(p.step(1 + HELD_GAP - 0.1), null, 'a breath after the hold');
  assert.equal(p.step(1 + HELD_GAP)!.text.zh, '一');
  // expired, invalid, overflow, cleared
  const q = new LinePacer();
  q.offer(line('过期', { ttl: 1 }), 0);
  q.offer(line('换地方了', { valid: () => false }), 0);
  q.step(5);
  for (let i = 0; i < PACER_MAX + 1; i++) q.offer(line(`第${i}句`), 10);
  q.clear();
  assert.deepEqual(dropped, ['过期:expired', '换地方了:invalid', '第0句:overflow', '第1句:cleared', '第2句:cleared', '第3句:cleared', '第4句:cleared']);
  assert.equal(q.dropped, 7);
});
