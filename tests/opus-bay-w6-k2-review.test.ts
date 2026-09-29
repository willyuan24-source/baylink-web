import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

/**
 * W6-K2-review (the adversarial review of lane K2, docs/opus-bay/sf-w6-K2.md "## Review"): Settings holds the Grand Tour's
 * dwell as it holds the ride; the 90 s hold timeout leaves a panel / shop hold alone while its sheet is on screen.
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
let clock = 500_000;
mock.method(performance, 'now', () => clock);
const tick = (ms: number) => { clock += ms; };

const { game, initialGameState } = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const flowMod = await import('../src/opus-bay/game/flow');
const { flow, initialFlowState } = await import('../src/opus-bay/game/flowStore');
const { buildInteractables, setInteractables } = await import('../src/opus-bay/game/interactables');
const { resetBrain } = await import('../src/opus-bay/game/brain');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const { setStorageForTests } = await import('../src/opus-bay/data/wishlist');
const save = await import('../src/opus-bay/data/save');
const { GRAND_TOUR } = await import('../src/opus-bay/data/sf/copy');
const tripRun = await import('../src/opus-bay/game/tripRun');
const auto = await import('../src/opus-bay/game/autoTravel');
const pelican = await import('../src/opus-bay/game/pelicanFirst');
setStorageForTests(null);
tripRun.initTripRun();

const frames = (n = 1, ms = 120) => { for (let i = 0; i < n; i++) { tick(ms); stepFrameSystems(ms / 1000, clock); } };

function reset() {
  if (flow.get().trip) flowMod.endTrip();
  if (game.get().dialogue.nodeId) flowMod.closeDialogue();
  game.set({ ...initialGameState(), phase: 'playing', worldMode: 'city', mode: 'free' });
  flow.set(initialFlowState());
  Object.assign(runtime.player, { x: 0, y: 0, z: 0, heading: 0, moving: false, running: false, locked: false, pendingInteract: null, pathTarget: null });
  Object.assign(runtime.guide, { x: 1, y: 0, z: 0, state: 'follow', target: null, run: false, emote: 'none', arrived: false });
  resetBrain();
  setInteractables(buildInteractables());
  save.resetSaveCache();
  auto.autoEnd();
  tick(5000);
}

test('W6-K2-review: Settings (the pause) holds the Grand Tour stop\'s dwell — the tour does not move on under the sheet; it does once closed', async () => {
  reset();
  pelican.resetPelicanForTests(null, () => true);
  const cityTour = await import('../src/opus-bay/game/cityTour');
  cityTour.initCityTour();
  Object.assign(runtime.player, { x: 150, z: -20 });
  flowMod.startTour(GRAND_TOUR.id);
  flowMod.chooseDialogue(0);
  flowMod.closeDialogue();
  // the first stop is reached: its dwell starts
  tripRun.dispatchTrip({ type: 'leg-arrived' });
  auto.autoEnd();
  while (game.get().dialogue.nodeId) flowMod.closeDialogue();
  const first = cityTour.cityTourRun()?.stop;
  assert.equal(cityTour.cityTourRun()?.phase, 'dwell');
  // Settings open for 60 s (longer than any dwell, DWELL_S ≤ 45 s): the tour waits at this stop
  flowMod.openPanel('settings');
  assert.equal(game.get().paused, true);
  frames(500);
  assert.equal(cityTour.cityTourRun()?.stop, first, 'still the same stop after 60 s of Settings');
  assert.equal(cityTour.cityTourRun()?.phase, 'dwell', 'the dwell waited under the sheet');
  // Settings closed: the dwell runs out (its time left) and the tour leads on
  flowMod.closePanel();
  assert.equal(game.get().paused, false);
  for (let i = 0; i < 600 && cityTour.cityTourRun()?.stop === first; i++) { frames(1); while (game.get().dialogue.nodeId) flowMod.closeDialogue(); }
  assert.notEqual(cityTour.cityTourRun()?.stop, first, 'once closed the dwell ends and the tour goes on');
  flowMod.endTour();
  flowMod.closePanel();
});

test('W6-K2-review: the 90 s hold timeout leaves a panel / shop hold alone while its sheet is on screen (album, 小铺); a leaked one still goes', async () => {
  const { holdLock, lockReport, deriveLock } = await import('../src/opus-bay/game/playerLock');
  const W = await import('../src/opus-bay/game/lockWatchdog');
  const { openOverlay, closeOverlay, registerOverlay } = await import('../src/opus-bay/ui/slots');
  game.set({ ...initialGameState(), phase: 'playing', worldMode: 'city', mode: 'free' });
  flow.set(initialFlowState());
  const offSheet = registerOverlay({ id: 'k2-review-album', Component: () => null });
  openOverlay('k2-review-album');
  const release = holdLock('panel', 'album');
  const releaseShop = holdLock('shop', 'e-shop');
  try {
    deriveLock();
    const t0 = Math.max(...lockReport().map(h => h.since));
    const late = t0 + (W.HOLD_TIMEOUT_S + 30) * 1000;
    assert.equal(W.lockExplanation(late), 'panel', 'two minutes in the album: its sheet is up, the feet stay held');
    for (let i = 0; i < 30; i++) assert.equal(W.stepLockWatchdog(0.1, late + i * 100), false, 'never freed under the open sheet');
    assert.equal(runtime.player.locked, true);
    assert.equal(lockReport().length, 2);
    // the sheet closed but the holds were never given back (a leak): the timeout frees them
    closeOverlay('k2-review-album');
    assert.equal(W.lockExplanation(late), null, 'no sheet: a hold that old is a leak');
    let freed = false;
    for (let i = 0; i < 15 && !freed; i++) freed = W.stepLockWatchdog(0.1, late + 5000 + i * 100);
    assert.ok(freed);
    assert.equal(lockReport().length, 0);
  } finally { release(); releaseShop(); offSheet(); game.set({ phase: 'title' }); }
});

test('W6-K2-review: no 飞行券 while a city tour runs (the welcome\'s 刚来湾区 → the Grand Tour meets the pelican at its first stop); after a tour it comes TICKET_QUIET_MS later', async () => {
  const { registerHooks } = await import('node:module');
  const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
  const run = await import('../src/opus-bay/economy/shopRun');
  styles.deregister();
  game.set({ ...initialGameState(), phase: 'playing', worldMode: 'city', mode: 'free' });
  flow.set(initialFlowState());
  run.ticketGate.quietSince = -Infinity;
  assert.equal(run.ticketGiftWaits(), false, 'free roam, nothing on');
  // the Grand Tour picked from the welcome: its trip leads to the Ferry Building stop, where the pelican comes
  game.set({ mode: 'tour', tour: { active: true, stop: 0, completed: [], id: GRAND_TOUR.id } });
  assert.equal(run.ticketGiftWaits(), true, 'a tour runs: the gift waits (it would be refunded at the first stop)');
  assert.equal(run.ticketGiftReady(1_000), false);
  assert.equal(run.ticketGiftReady(60_000), false, 'still waiting a minute later');
  // the tour ended before any stop (结束): the gift comes TICKET_QUIET_MS after
  game.set({ mode: 'free', tour: { active: false, stop: 0, completed: [], id: GRAND_TOUR.id } });
  assert.equal(run.ticketGiftReady(61_000), false);
  assert.equal(run.ticketGiftReady(61_000 + run.TICKET_QUIET_MS), true);
  game.set({ phase: 'title' });
});

test('W6-K2-review: after Settings → reset progress the 飞行券 waits for the new welcome (flow restartOnboarding: mode onboarding, its dialogue a moment later)', async () => {
  const { registerHooks } = await import('node:module');
  const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
  const run = await import('../src/opus-bay/economy/shopRun');
  styles.deregister();
  flow.set(initialFlowState());
  // the reset: the gate says "at once" (shopRun's onSaveCleared) and the welcome is pending, not open yet
  game.set({ ...initialGameState(), phase: 'playing', worldMode: 'city', mode: 'onboarding' });
  run.ticketGate.quietSince = -Infinity;
  assert.equal(run.ticketGiftWaits(), true, 'onboarding: the welcome is coming');
  assert.equal(run.ticketGiftReady(2_000), false, 'no gift in the gap before the welcome opens');
  // 我是本地人，直接开始 (free roam, no lead): the gift comes TICKET_QUIET_MS later
  game.set({ mode: 'free' });
  assert.equal(run.ticketGiftReady(3_000), false);
  assert.equal(run.ticketGiftReady(3_000 + run.TICKET_QUIET_MS), true);
  game.set({ phase: 'title' });
});
