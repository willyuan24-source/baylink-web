import assert from 'node:assert/strict';
import test from 'node:test';

// Wave 5 · lane D · the adversarial review (W5-D-review): what the lane's own tests did not pin —
//   a Settings reset in the middle of a session (the eggs, sounds and pebbles found this session, the pebbles picked up,
//   the 1776 marks and today's phone must all start over with the ledger), a phone call hung up (the find must not be lost
//   for the Bay day), a teardown with a laugh or a paper pending (nothing is found or paid after the eggs stop), the paid
//   memo following the ledger, and the facts re-read on 2026-09-28 (PIER 39's sea lions).

// --- headless canvas stub (world modules create label atlases at import time; same as the other egg tests) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { onEvent } = await import('../src/opus-bay/core/events');
type GameEvent = import('../src/opus-bay/core/events').GameEvent;
const { registerHooks } = await import('node:module');
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const eggsIndex = await import('../src/opus-bay/eggs/index');
styles.deregister();
const H = await import('../src/opus-bay/eggs/hosts');
const L = await import('../src/opus-bay/eggs/listen');
const P = await import('../src/opus-bay/eggs/pebbles');
const gates = await import('../src/opus-bay/eggs/gates');
const { eggById, EGGS } = await import('../src/opus-bay/eggs/registry');
const { PEBBLES } = await import('../src/opus-bay/eggs/pebbleSpots');
const { TRAIL_STOPS, trailMark } = await import('../src/opus-bay/eggs/presidio');
const { __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { game } = await import('../src/opus-bay/core/store');
const slots = await import('../src/opus-bay/ui/slots');
const ledger = await import('../src/opus-bay/economy/ledger');
const { clearSave } = await import('../src/opus-bay/data/save');

/** Step the hosts like the frame system for `seconds`. */
const run = (seconds: number) => { for (let t = 0; t < seconds; t += 1 / 30) H.stepHosts(1 / 30); };

function setup(t: import('node:test').TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const events: GameEvent[] = [];
  const offEv = onEvent(e => { if (e.type === 'find' || e.type === 'reward') events.push(e); });
  const phase = game.get().phase;
  clearSave();
  gates.__resetDailyForTests();
  H.__resetHostsForTests();
  L.__resetListenForTests();
  P.__resetPebblesForTests();
  __setBayNowForTests('2026-10-01T11:00');
  game.set({ phase: 'playing' });
  runtime.move.mode = 'foot';
  runtime.glide.active = false;
  runtime.camera.shot = null;
  const p = runtime.player;
  const put = (x: number, z: number) => { p.x = x; p.z = z; p.y = 0; p.speed = 0; p.pathTarget = null; };
  const offLedger = ledger.initLedger();
  const cleanup = () => {
    offEv(); offLedger();
    H.__resetHostsForTests(); L.__resetListenForTests(); P.__resetPebblesForTests(); gates.__resetDailyForTests(); clearSave(); __setBayNowForTests(null);
    game.set({ phase });
  };
  return { events, put, cleanup };
}

test('W5-D-review reset: Settings → reset progress in the middle of a session — eggs, sounds and pebbles found before can be found (and paid) again, the stones lie back in the world, the 1776 marks and today\'s phone go with the save', t => {
  const { events, put, cleanup } = setup(t);
  // the whole feature, as game/w5Features starts it (its reset listener is what is under test)
  const off = eggsIndex.init();
  try {
    const egg = 'mt-davidson-top-of-sf';
    assert.equal(H.reveal(egg), true, 'the first find');
    assert.ok(ledger.isPaid(`egg:${egg}`) && H.isFound(egg));
    const stone = PEBBLES.find(q => q.id === 'mp-1')!;
    put(stone.x, stone.z);
    run(0.3);
    assert.ok(P.pebbleFound('mp-1'), 'walking over the pebble picks it up');
    assert.ok(!H.props.has('pebble:mp-1'), 'gone from the world');
    assert.equal(P.pebbleCount(), 1);
    assert.equal(L.heard('parrots'), true);
    assert.ok(L.soundFound('parrots'));
    gates.mark(trailMark(TRAIL_STOPS[0]));
    gates.markToday('phone');
    const coins = ledger.coinsTotal();
    assert.ok(coins >= 10 + 3 + 5, `paid: ${coins}`);

    clearSave();   // what Settings → reset progress does to the save (ui/Settings.tsx)

    assert.equal(ledger.coinsTotal(), 0, 'the ledger starts over');
    assert.equal(H.isFound(egg), false, 'the egg is unfound again (it stayed "found" for the session, unpaid)');
    assert.equal(P.pebbleCount(), 0, 'the pouch is empty');
    assert.equal(P.pebbleFound('mp-1'), false);
    assert.ok(H.props.has('pebble:mp-1'), 'the stone lies where it lay');
    assert.equal(L.soundFound('parrots'), false);
    assert.equal(gates.marked(trailMark(TRAIL_STOPS[0])), false, 'the 1776 stop is unvisited (else the new save\'s first stop completed the trail)');
    assert.equal(gates.usedToday('phone'), false);

    // and they can be found — and paid — again in the new save
    const before = events.filter(e => e.type === 'reward').length;
    assert.equal(H.reveal(egg), true, 'found again');
    put(0, 0); run(0.3); put(stone.x, stone.z); run(0.3);
    assert.ok(P.pebbleFound('mp-1'));
    assert.equal(L.heard('parrots'), true);
    assert.equal(events.filter(e => e.type === 'reward').length - before, 3, 'egg, pebble and sound pay once each in the new save');
    assert.equal(ledger.coinsTotal(), 10 + 3 + 5);
    // a second reveal in the same save is still quiet (the ledger's bit)
    assert.equal(H.reveal(egg), false);
  } finally { off(); cleanup(); }
});

test('W5-D-review the phone (egg 4): hanging up does not use the Bay day — it rings again on the next visit, and the call that goes through is the find', t => {
  const { events, put, cleanup } = setup(t);
  const hosts = eggsIndex.makeHosts();
  const stop = H.startHosts(hosts);
  const offOverlays = ['egg-card', 'egg-note', 'egg-operator'].map(id => slots.registerOverlay({ id, Component: () => null }));
  const phone = eggById('chinatown-telephone-exchange')!;
  const prompt = () => hosts.flatMap(h => h.interactables?.() ?? []).find(i => i.id === 'egg:chinatown-telephone-exchange');
  const found = () => events.some(e => e.type === 'find' && e.id === phone.id && e.first);
  try {
    put(phone.at.x + 2, phone.at.z); run(0.3);
    assert.ok(prompt(), 'it rings when you come by');
    prompt()!.act!();
    assert.ok(slots.openOverlays().some(o => o.id === 'egg-operator'), '你找谁？');
    slots.closeOverlay('egg-operator');   // ×, Esc, walking off or the operator's 20 s: nobody is put through
    t.mock.timers.tick(5000);
    assert.equal(found(), false, 'no find without a call');
    assert.equal(gates.usedToday('phone'), false, 'a hung-up call does not use the day');
    run(0.3);
    assert.equal(prompt(), undefined, 'not again on this visit');
    put(0, 0); run(0.3); put(phone.at.x + 2, phone.at.z); run(0.3);
    assert.ok(prompt(), 'the next visit it rings again (before: not until tomorrow — the find was lost for the day)');
    prompt()!.act!();
    const op = slots.openOverlays().find(o => o.id === 'egg-operator')!;
    (op.props as { onPick: (i: number) => void }).onPick(1);
    assert.ok(gates.usedToday('phone'), 'a call that goes through uses the day');
    t.mock.timers.tick(4000);
    assert.ok(found(), 'the find');
  } finally { stop(); for (const o of offOverlays) o(); cleanup(); }
});

test('W5-D-review teardown: a laugh, a whale or a paper still pending when the eggs stop finds and pays nothing afterwards', t => {
  const { events, put, cleanup } = setup(t);
  const hosts = eggsIndex.makeHosts();
  let stop = H.startHosts(hosts);
  const offOverlays = ['egg-card', 'egg-note', 'egg-operator', 'egg-listen'].map(id => slots.registerOverlay({ id, Component: () => null }));
  const prompt = (id: string) => hosts.flatMap(h => h.interactables?.() ?? []).find(i => i.id === id);
  try {
    // the laughing lady: the egg now, the 城市之声 collection 2.6 s later (a timer)
    prompt('egg:musee-laughing-lady')!.act!();
    assert.ok(events.some(e => e.type === 'find' && e.id === 'musee-laughing-lady'));
    stop();
    t.mock.timers.tick(10000);
    assert.equal(events.some(e => e.type === 'find' && e.kind === 'sound'), false, 'the sound is not collected after the teardown');
    assert.equal(L.soundFound('laughing-lady'), false);
    // Norton's scroll open at the teardown: closing it then is not a read
    stop = H.startHosts(hosts);
    const norton = eggById('emperor-norton-bridge-decree')!;
    put(norton.at.x, norton.at.z); run(0.2);
    prompt('egg:emperor-norton-bridge-decree')!.act!();
    assert.ok(slots.openOverlays().some(o => o.id === 'egg-note'));
    stop();
    slots.closeOverlay('egg-note');
    t.mock.timers.tick(5000);
    assert.equal(events.some(e => e.type === 'find' && e.id === norton.id), false, 'no find from a paper closed by the teardown');
    assert.equal(ledger.isPaid(`egg:${norton.id}`), false);
  } finally { stop(); for (const o of offOverlays) o(); cleanup(); }
});

test('W5-D-review the paid memo follows the ledger at once (a pay from anywhere, a reset) and costs nothing while nothing changes', t => {
  const { cleanup } = setup(t);
  const off = eggsIndex.init();
  try {
    assert.equal(P.pebbleCount(), 0);
    // lane E pays a pebble directly (its own tests do): the count follows without any host step
    assert.equal(ledger.pay('pebble:nb-1', 3), 3);
    assert.equal(P.pebbleCount(), 1);
    assert.ok(P.pebbleFound('nb-1'));
    assert.equal(ledger.pay(`egg:${EGGS[0].id}`, 10), 10);
    assert.ok(H.isFound(EGGS[0].id), 'an egg paid elsewhere reads found');
    // many reads, one decode: the same set object comes back while the ledger has not changed
    const t0 = performance.now();
    for (let i = 0; i < 2000; i++) P.pebbleCount();
    const ms = performance.now() - t0;
    assert.ok(ms < 60, `2000 counts in ${ms.toFixed(1)} ms (was ≈ 135 ms: 48 bitset decodes each)`);
    clearSave();
    assert.equal(P.pebbleCount(), 0);
    assert.equal(H.isFound(EGGS[0].id), false);
  } finally { off(); cleanup(); }
});

test('W5-D-review facts re-read on 2026-09-28: PIER 39\'s sea lions are not said to have come because of the 1989 quake (Wikipedia: the first came in September, before it)', () => {
  const sea = eggById('pier39-sea-lion-season')!;
  for (const l of sea.lines) assert.doesNotMatch(l.zh, /地震后/, `the line claims only what both sources say: ${l.zh}`);
  assert.match(sea.lines[0].zh, /1989 年秋天/);
  assert.match(sea.fact.zh, /码头说/, 'the quake is PIER 39\'s own account');
  assert.ok(sea.sources.some(s => s.url.includes('wikipedia.org/wiki/Pier_39') && /September 1989/.test(s.note ?? '')));
  const cookie = eggById('fortune-cookie-trail')!;
  assert.ok(cookie.sources.some(s => /Ross Alley/.test(s.note ?? '') && /1962/.test(s.note ?? '')), 'the alley line has a source that names the alley');
});
