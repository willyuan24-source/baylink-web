import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test, { mock } from 'node:test';

/**
 * Wave 5 · lane C · part b (plan sf-w5-plan.md §4.6): W5-C5 the tours (the Golden Gate deck crossing within 10 u of both
 * towers and its progress lines; BAYBAY carries the Grand Tour like any trip; the first ride's lines) and W5-C6 the lines
 * (lane C's frozen wave-5 set for lane V, the texts said from the main graph equal to it, the routed items). City content.
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
const { setStorageForTests, readProgress, GOALS_DONE_MAX } = await import('../src/opus-bay/data/wishlist');
const save = await import('../src/opus-bay/data/save');
const detectors = await import('../src/opus-bay/game/cityDetectors');
const lines = await import('../src/opus-bay/data/sf/linesW5');
const tourLines = await import('../src/opus-bay/data/sf/tourLines');
const { SF_GRAND, tourStops } = await import('../src/opus-bay/data/sf/tours');
const { GRAND_TOUR } = await import('../src/opus-bay/data/sf/copy');
const tripRun = await import('../src/opus-bay/game/tripRun');
const auto = await import('../src/opus-bay/game/autoTravel');
const pelican = await import('../src/opus-bay/game/pelicanFirst');
setStorageForTests(null);
const offTrips = tripRun.initTripRun();

const src = (path: string) => readFileSync(new URL(`../src/opus-bay/${path}`, import.meta.url), 'utf8');
const zhWidth = (s: string) => [...s].length;

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
const frames = (n = 1, ms = 120) => { for (let i = 0; i < n; i++) { tick(ms); stepFrameSystems(ms / 1000, clock); } };

// ---------------------------------------------------------------------------------------------------------------
// W5-C5 · the Golden Gate deck crossing
// ---------------------------------------------------------------------------------------------------------------

const ON = { y: 15.2, mode: 'foot' as const, epoch: 0, travelling: false };
const TOWER = 89.29;

test('W5-C5 the deck crossing counts within 10 u of both towers, says the first tower, mid-span and done; both ways', () => {
  assert.equal(detectors.DECK_TOWER_NEAR, 10);
  let d = detectors.createDeckCrossing({ tower: TOWER });
  assert.equal(d.step({ x: -150, z: 0 }, ON), null, 'on the south approach: nothing yet');
  assert.equal(d.step({ x: -TOWER - 10.5, z: 0 }, ON), null, '10.5 u short of the tower');
  assert.deepEqual(d.step({ x: -TOWER - 9.5, z: 2.2 }, ON), { what: 'tower', tower: -1 }, 'within 10 u (on the east sidewalk)');
  assert.equal(d.step({ x: -TOWER + 5, z: 3.5 }, ON), null, 'round the tower on its balcony');
  assert.equal(d.step({ x: -1, z: 2 }, ON), null);
  assert.deepEqual(d.step({ x: 0.5, z: 2 }, ON), { what: 'half' }, 'mid-span once');
  assert.equal(d.step({ x: 40, z: 2 }, ON), null);
  assert.equal(d.step({ x: TOWER - 10.5, z: 2 }, ON), null);
  assert.deepEqual(d.step({ x: TOWER - 9.5, z: 2 }, ON), { what: 'done' }, 'within 10 u of the north tower: crossed');
  assert.equal(d.from, 0, 'done starts it over');
  // north → south
  d = detectors.createDeckCrossing({ tower: TOWER });
  assert.deepEqual(d.step({ x: TOWER + 3, z: -2 }, ON), { what: 'tower', tower: 1 });
  assert.deepEqual(d.step({ x: -3, z: -2 }, ON), { what: 'half' });
  assert.deepEqual(d.step({ x: -TOWER + 8, z: -2 }, ON), { what: 'done' });
  // starting on the main span (a landing) counts from the first tower reached
  d = detectors.createDeckCrossing({ tower: TOWER });
  assert.equal(d.step({ x: 20, z: 0 }, ON), null);
  assert.deepEqual(d.step({ x: TOWER - 9, z: 0 }, ON), { what: 'tower', tower: 1 });
  // turning back at the first tower never completes
  assert.equal(d.step({ x: TOWER + 5, z: 0 }, ON), null);
  assert.equal(d.step({ x: TOWER - 5, z: 0 }, ON), null);
});

test('W5-C5 the deck crossing starts over off the deck, after a fast travel and while gliding; the bike and the toy car count', () => {
  let d = detectors.createDeckCrossing({ tower: TOWER });
  d.step({ x: -TOWER, z: 0 }, ON);
  d.step({ x: 0, z: 0 }, { ...ON, y: 2 });
  assert.equal(d.from, 0, 'below the deck');
  assert.deepEqual(d.step({ x: TOWER, z: 0 }, ON), { what: 'tower', tower: 1 }, 'a new attempt, not done');
  d = detectors.createDeckCrossing({ tower: TOWER });
  d.step({ x: -TOWER, z: 0 }, ON);
  assert.deepEqual(d.step({ x: TOWER, z: 0 }, { ...ON, epoch: 1 }), { what: 'tower', tower: 1 }, 'fast travel starts it over');
  d = detectors.createDeckCrossing({ tower: TOWER });
  d.step({ x: -TOWER, z: 0 }, ON);
  assert.equal(d.step({ x: TOWER, z: 0 }, { ...ON, mode: 'glide' as never }), null, 'gliding over does not count');
  d = detectors.createDeckCrossing({ tower: TOWER });
  d.step({ x: -TOWER, z: 0 }, ON);
  assert.equal(d.step({ x: 0, z: 12 }, ON), null, 'off the side (the water, 12 u across)');
  assert.equal(d.from, 0);
  for (const mode of ['bike', 'car'] as const) {
    d = detectors.createDeckCrossing({ tower: TOWER });
    d.step({ x: -TOWER, z: 0 }, { ...ON, mode });
    assert.deepEqual(d.step({ x: TOWER, z: 0 }, { ...ON, mode }), { what: 'done' }, mode);
  }
  // 5 Hz at the fastest own pace (the toy car, 8.5 u/s) never skips a tower's 20 u window
  d = detectors.createDeckCrossing({ tower: TOWER });
  const got: string[] = [];
  for (let x = -200; x <= 200 && got[got.length - 1] !== 'done'; x += 8.5 / 5) { const s = d.step({ x, z: 2.2 }, ON); if (s) got.push(s.what); }
  assert.deepEqual(got, ['tower', 'half', 'done']);
});

test('W5-C5 the deck progress lines: lane C’s frozen lines, one per step, zh ≤ 45; the goal completes once in the running city', async () => {
  const live = await import('../src/opus-bay/game/cityLive');
  assert.deepEqual(live.deckLine({ what: 'tower', tower: -1 }), { text: { zh: '南塔到啦！走到北塔，就算走过金门大桥～', en: 'The south tower! Walk on to the north tower to cross the bridge.' }, id: 'w5c-deck-south' });
  assert.equal(live.deckLine({ what: 'tower', tower: 1 }).id, 'w5c-deck-north');
  assert.equal(live.deckLine({ what: 'half' }).id, 'w5c-deck-half');
  assert.equal(live.deckLine({ what: 'done' }).text.zh, '走过金门大桥啦！两座塔之间有 1280 米！');
  // the live detector over the real bridge frame: walk the east sidewalk south → north at 4.2 u/s, 5 Hz
  reset();
  const { sfLandmark, landmarkToWorld } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { GGB } = await import('../src/opus-bay/world/sf/landmarks/golden-gate-bridge');
  const bridge = sfLandmark('golden-gate-bridge')!;
  const done: string[][] = [], said: string[] = [];
  const off = live.initCityGoals({ done: ids => { done.push(ids); game.set({ goalsDone: [...game.get().goalsDone, ...ids] }); }, heightAt: () => 0, say: (_t, id) => { said.push(id ?? '?'); } });
  try {
    for (let x = GGB.END_S + 20; x <= GGB.END_N - 20; x += 4.2 * 0.2) {
      const w = landmarkToWorld(bridge, { x, z: 2.2 });
      Object.assign(runtime.player, { x: w.x, z: w.z, y: GGB.DECK });
      frames(1, 200);
    }
    assert.deepEqual(said, ['w5c-deck-south', 'w5c-deck-half', 'w5c-deck-done']);
    assert.deepEqual(done, [['golden-gate']], 'the goal once');
    // back again: the goal is done, BAYBAY says nothing more
    for (let x = GGB.END_N - 20; x >= GGB.END_S + 20; x -= 4.2 * 0.2) {
      const w = landmarkToWorld(bridge, { x, z: -2.2 });
      Object.assign(runtime.player, { x: w.x, z: w.z, y: GGB.DECK });
      frames(1, 200);
    }
    assert.equal(said.length, 3);
  } finally { off(); }
});

// ---------------------------------------------------------------------------------------------------------------
// W5-C5 · the Grand Tour carries the player
// ---------------------------------------------------------------------------------------------------------------

test('W5-C5 the Grand Tour carries the player on every stop (like a map trip); a takeover lasts for the tour; 继续：带我去 hands it back', async () => {
  reset();
  pelican.resetPelicanForTests(null, () => true);
  const cityTour = await import('../src/opus-bay/game/cityTour');
  cityTour.initCityTour();
  Object.assign(runtime.player, { x: 150, z: -20 });
  flowMod.startTour(GRAND_TOUR.id);
  flowMod.chooseDialogue(0);
  flowMod.closeDialogue();
  assert.equal(flow.get().trip?.source, 'tour');
  assert.equal(auto.autoOn(), true, 'BAYBAY carries the player to the first stop');
  assert.equal(cityTour.cityTourRun()?.carry, true);
  frames(2);
  assert.ok(runtime.player.pathTarget, 'auto-travel set the walk');
  // the stop is reached: the trip ends (auto-travel off with it), the next stop carries again
  tripRun.dispatchTrip({ type: 'leg-arrived' });
  auto.autoEnd();
  assert.equal(cityTour.cityTourRun()?.phase, 'dwell');
  flowMod.tourNext();
  assert.equal(cityTour.cityTourRun()?.stop, 'bay-ride-ggb');
  assert.equal(auto.autoOn(), true, 'the next stop carries too');
  // a takeover (auto-travel off while the stop's trip runs): the tour remembers it
  auto.autoEnd();
  assert.equal(cityTour.cityTourRun()?.carry, false);
  // the call menu: 继续：带我去… (a tour-next) carries again
  flowMod.openCallMenu();
  const keep = flowMod.nodeById('flow.call')!.choices!.find(c => c.label.zh.startsWith('继续'))!;
  assert.match(keep.label.zh, /^继续(：带我去|跟你走)/, 'the stop’s name when the station is registered (the game), else 继续跟你走');
  assert.deepEqual(keep.action, { type: 'tour-next' }, 'no longer a plain close: it hands the walking back');
  flowMod.closeDialogue();
  flowMod.tourNext();
  assert.equal(auto.autoOn(), true, '继续：带我去 → BAYBAY carries again');
  assert.equal(cityTour.cityTourRun()?.carry, true);
  // 跳过这一站 ends the stop's trip (and its walk): not a takeover, the next stop carries on
  const before = cityTour.cityTourRun()?.stop;
  cityTour.skipCityTourStop();
  assert.notEqual(cityTour.cityTourRun()?.stop, before);
  assert.equal(cityTour.cityTourRun()?.carry, true);
  assert.equal(auto.autoOn(), true);
  flowMod.endTour();
  flowMod.closePanel();
  assert.equal(auto.autoOn(), false, 'the tour ended: nothing carries');
});

test('W5-C5 the tour’s first bus ride has no lead line of its own (lane T’s boarding and the bus say it); every other stop keeps its lines', () => {
  const ggb = tourStops(SF_GRAND).find(f => f.stop.id === 'bay-ride-ggb')!.stop;
  assert.equal(ggb.lines.lead, undefined);
  assert.equal(ggb.lines.arrive, 'loop-golden-gate-bridge-arrive');
  assert.match(src('game/lineRides.ts'), /上车！坐到/, 'lane T’s auto-boarding line');
  assert.deepEqual(GRAND_TOUR.subtitle, SF_GRAND.subtitle, 'the main-graph copy follows the tour data');
});

// ---------------------------------------------------------------------------------------------------------------
// W5-C6 · lane C's frozen wave-5 lines
// ---------------------------------------------------------------------------------------------------------------

test('W5-C6 lane C’s wave-5 lines are FROZEN for lane V (a new wording needs a new id): ids, texts, sizes, sources', () => {
  assert.equal(lines.W5_C_LINES_FROZEN, '2026-09-28');
  const all = lines.W5_C_LINES;
  assert.deepEqual(all.map(l => l.id), [
    'w5c-pelican-ask', 'w5c-pelican-go', 'w5c-pelican-tour', 'w5c-pelican-nudge',
    'w5c-welcome-back', 'w5c-free-again', 'w5c-goals-intro',
    'w5c-deck-south', 'w5c-deck-north', 'w5c-deck-half', 'w5c-deck-done',
  ]);
  const snapshot = createHash('sha256').update(all.map(l => `${l.id}\u0001${l.zh}\u0001${l.en}`).join('\u0002')).digest('hex').slice(0, 16);
  assert.equal(snapshot, W5C_SNAPSHOT, 'the frozen wave-5 lines changed: add new ids instead of editing recorded ones');
  const tourIds = new Set([...tourLines.TOUR_LINES, ...tourLines.TOUR_LINES_2].map(l => l.id));
  for (const l of all) {
    assert.match(l.id, /^w5c-[a-z0-9-]+$/);
    assert.ok(!tourIds.has(l.id), `${l.id} is new`);
    assert.ok(zhWidth(l.zh) <= 45, `${l.id} zh ≤ 45`);
    assert.ok(l.en.length <= 110 && !/[一-鿿]/.test(l.en), `${l.id} en`);
    assert.ok(!/按 ?[A-Z]|点「|press [A-Z]|tap /i.test(l.zh + l.en), `${l.id}: no control named (text-only lines never enter the set)`);
    if (/\d{3,}/.test(l.zh)) assert.ok(l.source?.url.startsWith('https://') && l.source.verifiedAt === lines.W5_C_LINES_FROZEN, `${l.id}: a number is a fact with its source`);
    // the pacer resolves them: the voice id is the line id (clip `<lang>-<id>` once lane V records it)
    const said = tourLines.sayLine(l.id, 10);
    assert.equal(said?.voice, l.id);
    assert.deepEqual(said?.text, { zh: l.zh, en: l.en });
  }
  assert.equal(new Set(all.map(l => l.id)).size, all.length);
});

test('W5-C6 the texts said from the main graph and the lazy modules are the frozen texts (the ids travel with them)', async () => {
  const w = lines.w5Text;
  assert.deepEqual(flowMod.PELICAN_NUDGE, w(lines.W5_PELICAN.nudge));
  assert.deepEqual(flowMod.FREE_AGAIN, w(lines.W5_WELCOME.freeAgain));
  assert.deepEqual(flowMod.WELCOME_BACK, w(lines.W5_WELCOME.back));
  assert.deepEqual(flowMod.W5_LINE_IDS, { nudge: lines.W5_PELICAN.nudge.id, freeAgain: lines.W5_WELCOME.freeAgain.id, welcomeBack: lines.W5_WELCOME.back.id });
  assert.deepEqual(pelican.PELICAN_LINES.ask, w(lines.W5_PELICAN.ask));
  assert.deepEqual(pelican.PELICAN_LINES.go, w(lines.W5_PELICAN.go));
  assert.deepEqual(pelican.PELICAN_LINES.tour, w(lines.W5_PELICAN.tour));
  assert.match(src('ui/GoalsStep.tsx'), /const INTRO = w5Text\(W5_WELCOME\.goalsIntro\)/);
  // the main graph never loads the frozen table (it lives with the tour data in the city chunks)
  assert.ok(!src('game/flow.ts').includes("from '../data/sf/linesW5'"), 'flow.ts keeps its texts (tested equal) and the ids as strings');
});

test('W5-C6 a frozen line shown as text plays its clip only once lane V has recorded it (never a stray chirp)', async () => {
  const moments = await import('../src/opus-bay/game/cityMoments');
  const { onEvent } = await import('../src/opus-bay/core/events');
  const voices: string[] = [];
  const off = onEvent(e => { if (e.type === 'voice-line') voices.push(e.id); });
  try {
    assert.equal(moments.lineRecorded('w5c-pelican-ask'), false, 'not recorded yet');
    assert.equal(moments.speakRecorded('w5c-pelican-ask'), false);
    assert.deepEqual(voices, []);
    assert.equal(moments.lineRecorded('loop-pier-39-arrive'), true, 'a recorded wave-4 line');
    assert.equal(moments.speakRecorded('loop-pier-39-arrive'), true);
    assert.deepEqual(voices, ['loop-pier-39-arrive']);
    // offered by id: the frozen line; an unknown id falls back to the text
    moments.clearLines();
    assert.equal(moments.offerLineOr('w5c-deck-half', { zh: 'x', en: 'x' }, 10), true);
    moments.clearLines();
    assert.equal(moments.offerLineOr('nope-not-a-line', { zh: '别的话', en: 'Other words' }, 10), true);
    moments.clearLines();
  } finally { off(); }
});

test('W5-C6 the routed items stand: goalsDone keeps 128 ids on load; the welcome’s tour choice starts the Grand Tour by id', async () => {
  const store = new Map<string, string>();
  setStorageForTests({ getItem: k => store.get(k) ?? null, setItem: (k, v) => { store.set(k, v); }, removeItem: k => { store.delete(k); } } as unknown as Storage);
  try {
    const ids = Array.from({ length: 200 }, (_, i) => `hood:zone-${i}`);
    store.set('opus-bay:progress:v1', JSON.stringify({ v: 1, postcards: [], goalsDone: ids, tour: { stop: 0, completed: [] } }));
    assert.equal(GOALS_DONE_MAX, 128);
    assert.equal(readProgress()?.goalsDone.length, 128);
  } finally { setStorageForTests(null); }
  const { CITY_START_NODE, NODES } = await import('../src/opus-bay/data/script');
  assert.deepEqual(NODES[CITY_START_NODE].choices?.[0].action, { type: 'start-tour', tourId: 'sf-grand' });
});

const W5C_SNAPSHOT = 'bc31006f4f618eeb';

test.after(() => { offTrips(); });
