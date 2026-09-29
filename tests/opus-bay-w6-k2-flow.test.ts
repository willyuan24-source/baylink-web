import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

/**
 * W6-K2 part b: the C / E / N review items (sf-w5-summary.md NEXT #8) and the long hold timeout.
 */

const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const run = await import('../src/opus-bay/economy/shopRun');
styles.deregister();
const save = await import('../src/opus-bay/data/save');
const { game } = await import('../src/opus-bay/core/store');
const { flow } = await import('../src/opus-bay/game/flowStore');
const { setGlideUnlocked } = await import('../src/opus-bay/actors/moveApi');
const { openOverlay, closeOverlay, registerOverlay } = await import('../src/opus-bay/ui/slots');
const { GOALS_STEP_ID } = await import('../src/opus-bay/data/sf/goals');
const { PELICAN_TARGET } = await import('../src/opus-bay/game/cityGoals');
const L = await import('../src/opus-bay/economy/ledger');
const W = await import('../src/opus-bay/economy/wallet');

function fresh() {
  save.resetSaveCache();
  save.clearSave();
  L.__resetLedgerForTests();
}

test('W6-K2: no 飞行券 while goal #1 is led (the welcome, the goals step, BAYBAY\'s lead to the pelican); it comes TICKET_QUIET_MS after', () => {
  game.set({ phase: 'playing', mode: 'free', dialogue: { nodeId: null } }); // (W6-K2-review: the welcome over — onboarding waits too)
  flow.set({ freeLead: null });
  run.ticketGate.quietSince = -Infinity;
  assert.equal(run.ticketGiftReady(1000), true, 'a resumed player with nothing on: at once');
  game.set({ dialogue: { nodeId: 'flow.welcome' } });
  assert.equal(run.ticketGiftReady(1100), false, 'the welcome');
  game.set({ dialogue: { nodeId: null } });
  const offStep = registerOverlay({ id: GOALS_STEP_ID, Component: () => null });
  openOverlay(GOALS_STEP_ID);
  assert.equal(run.ticketGiftWaits(), true, 'the goals step');
  assert.equal(run.ticketGiftReady(1200), false);
  closeOverlay(GOALS_STEP_ID);
  offStep();
  flow.set({ freeLead: PELICAN_TARGET });
  assert.equal(run.ticketGiftReady(1300), false, 'BAYBAY leads to the pelican');
  flow.set({ freeLead: null });
  assert.equal(run.ticketGiftReady(2000), false, 'the lead just ended');
  assert.equal(run.ticketGiftReady(2000 + run.TICKET_QUIET_MS - 1), false);
  assert.equal(run.ticketGiftReady(2000 + run.TICKET_QUIET_MS), true, 'quiet long enough');
  game.set({ phase: 'title' });
  assert.equal(run.ticketGiftWaits(), true, 'not playing yet');
  game.set({ phase: 'playing' });
});

test('W6-K2: a new player who follows 跟 BAYBAY 去找鹈鹕 meets the pelican with no 飞行券 given and none refunded', async () => {
  fresh();
  setGlideUnlocked(false);
  game.set({ phase: 'playing', dialogue: { nodeId: null } });
  flow.set({ freeLead: PELICAN_TARGET });
  const off = run.initShop(() => null);
  try {
    assert.equal(W.owns('fly-gift'), false, 'no gift during the lead');
    // the lead reaches Coit: the pelican moment unlocks the glide (the lead ends with it)
    setGlideUnlocked(true);
    flow.set({ freeLead: null });
    await new Promise(r => setTimeout(r, 1100));
    assert.equal(W.owns('fly-gift'), false, 'the pelican is out: never a gift');
    assert.equal(W.holds('fly-ticket'), false);
    assert.equal(L.coinsTotal(), 0, 'no refund of a ticket never given');
  } finally { off(); setGlideUnlocked(false); flow.set({ freeLead: null }); }
});

test('W6-K2: a reward emitted before the ledger is live waits and is paid when the ledger starts (once)', async () => {
  const R = await import('../src/opus-bay/game/rewards');
  const { emit } = await import('../src/opus-bay/core/events');
  fresh();
  game.set({ worldMode: 'city', phase: 'playing' });
  R.ledgerListening(false);
  R.dropPendingRewards();
  assert.equal(R.rewardGoal('pelican'), true, 'emitted');
  assert.equal(R.pendingRewards().length, 1, 'waiting for a ledger');
  assert.equal(L.coinsTotal(), 0);
  const off = L.initLedger();
  try {
    assert.equal(L.coinsTotal(), R.REWARD_COINS.goal, 'paid when the ledger started');
    assert.equal(R.pendingRewards().length, 0);
    emit({ type: 'reward', source: 'goal:pelican', coins: 20, stamp: 'goal:pelican' });
    assert.equal(L.coinsTotal(), R.REWARD_COINS.goal, 'a source is paid once');
  } finally { off(); }
  // after the off (a world switch) rewards wait again; a new save drops them
  R.rewardGoal('golden-gate');
  assert.equal(R.pendingRewards().length, 1);
  save.clearSave();
  assert.equal(R.pendingRewards().length, 0, 'a reset drops what waited');
  // the district never queues (the economy is a city feature)
  game.set({ worldMode: 'district' });
  emit({ type: 'reward', source: 'goal:x', coins: 1 });
  assert.equal(R.pendingRewards().length, 0);
});

test('W6-K2: the area pill reads the walker\'s height — the first quarter of the Golden Gate deck is 金门大桥, the water under it is not', async () => {
  const { updateFocus } = await import('../src/opus-bay/game/brain');
  const { runtime } = await import('../src/opus-bay/core/runtime');
  // a point a tenth of the way along the span from the south anchorage (data/cityZones LANDMARK_SPANS: from2d 0.25)
  const a = { x: -689.35, z: 649.76 }, b = { x: -1015.73, z: 388.59 };
  const at = { x: a.x + (b.x - a.x) * 0.1, z: a.z + (b.z - a.z) * 0.1 };
  const saved = { ...runtime.player };
  try {
    game.set({ worldMode: 'city', phase: 'playing' });
    Object.assign(runtime.player, { x: at.x, z: at.z, y: 16 });
    updateFocus();
    assert.equal(game.get().area, 'golden-gate-bridge', 'on the deck');
    Object.assign(runtime.player, { y: 1.5 });
    updateFocus();
    assert.notEqual(game.get().area, 'golden-gate-bridge', 'under the bridge');
  } finally { Object.assign(runtime.player, saved); game.set({ worldMode: 'district', area: null }); }
});


test('W6-K2: a leaked activity / shop / panel hold is freed after HOLD_TIMEOUT_S and logged; a younger one still holds', async () => {
  const { holdLock, lockReport, deriveLock } = await import('../src/opus-bay/game/playerLock');
  const W = await import('../src/opus-bay/game/lockWatchdog');
  const { onEvent } = await import('../src/opus-bay/core/events');
  const { runtime } = await import('../src/opus-bay/core/runtime');
  const stuck: { source?: string }[] = [];
  const off = onEvent(e => { if (e.type === 'stuck') stuck.push(e); });
  game.set({ phase: 'playing', dialogue: { nodeId: null }, panel: { kind: null }, riding: null });
  const release = holdLock('activity', 'leaky');
  try {
    deriveLock();
    const t0 = lockReport().find(h => h.key === 'leaky')!.since;
    assert.equal(runtime.player.locked, true);
    assert.equal(W.lockExplanation(t0 + 60_000), 'activity', 'a minute in: still its own explanation');
    for (let i = 0; i < 30; i++) assert.equal(W.stepLockWatchdog(0.1, t0 + 60_000 + i * 100), false);
    assert.equal(W.lockExplanation(t0 + W.HOLD_TIMEOUT_S * 1000), null, 'past the timeout it explains nothing');
    const before = W.watchdogStats.timeouts;
    let freed = false;
    for (let i = 0; i < 15 && !freed; i++) freed = W.stepLockWatchdog(0.1, t0 + W.HOLD_TIMEOUT_S * 1000 + i * 100);
    assert.ok(freed, 'freed a second after the timeout');
    assert.equal(runtime.player.locked, false);
    assert.equal(lockReport().length, 0, 'the leaked hold is gone');
    assert.equal(W.watchdogStats.timeouts, before + 1);
    assert.match(stuck.at(-1)?.source ?? '', /^activity:leaky \(held 9\d s\)$/, 'logged with its age');
  } finally { release(); off(); game.set({ phase: 'title' }); }
});

test('W6-K2: a resumed player\'s first finds are kept quietly (no 发现 N 个新地点 over 欢迎回来); later finds are told', async () => {
  const D = await import('../src/opus-bay/game/discovery');
  const P = await import('../src/opus-bay/data/sf/places');
  const bi = (zh: string) => ({ zh, en: zh });
  const here = [{ id: 'k2-here-a', name: bi('甲'), x: 0, z: 0 }, { id: 'k2-here-b', name: bi('乙'), x: 3, z: 0 }];
  const there = [{ id: 'k2-there', name: bi('丙'), x: 200, z: 0 }];
  const fake = { near: (x: number) => (Math.abs(x) < 12 ? here : Math.abs(x - 200) < 12 ? there : []), get: () => undefined, list: [] } as unknown as import('../src/opus-bay/data/sf/places').PlaceIndex;
  const told: string[][] = [];
  const t0 = performance.now() + 100_000;
  try {
    save.clearSave();
    D.resetDiscovery();
    D.setDiscoveryAnnouncer(list => { told.push(list.map(p => p.id)); });
    game.set({ worldMode: 'city', phase: 'playing' });
    P.setPlaceIndex(fake);
    D.quietNextDiscovery(t0);
    D.updateDiscovery({ x: 0, z: 0 }, t0 + 1000);
    assert.ok(D.isDiscovered('k2-here-a') && D.isDiscovered('k2-here-b'), 'marked (the 足迹 and the map know them)');
    assert.deepEqual(told, [], 'the resume\'s first batch is quiet');
    D.updateDiscovery({ x: 200, z: 0 }, t0 + 1000 + D.STAMP_GAP_MS + 500);
    assert.deepEqual(told, [['k2-there']], 'a later find is told');
  } finally { P.setPlaceIndex(null); D.setDiscoveryAnnouncer(null); D.resetDiscovery(); save.clearSave(); game.set({ worldMode: 'district' }); }
});
