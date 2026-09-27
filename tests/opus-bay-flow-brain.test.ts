import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

// Flow code runs in the browser; give it the globals it touches and a controllable clock.
const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
let clock = 100_000;
mock.method(performance, 'now', () => clock);
const tick = (ms: number) => { clock += ms; };

const { game, initialGameState } = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { onEvent } = await import('../src/opus-bay/core/events');
const flowMod = await import('../src/opus-bay/game/flow');
const { flow, initialFlowState } = await import('../src/opus-bay/game/flowStore');
const { buildInteractables, setInteractables, interactables, postcardIdOf } = await import('../src/opus-bay/game/interactables');
const { updateFocus, updateGuide, resetBrain } = await import('../src/opus-bay/game/brain');
const { cinemaActive, stepCinema } = await import('../src/opus-bay/game/cinema');
const { readQa, bayTimeOfDay } = await import('../src/opus-bay/game/qa');
const { POIS } = await import('../src/opus-bay/data/pois');
const { POSTCARDS } = await import('../src/opus-bay/data/postcards');
const { FIRST_TOUR } = await import('../src/opus-bay/data/tours');
const { START_NODE } = await import('../src/opus-bay/data/script');
const { setStorageForTests } = await import('../src/opus-bay/data/wishlist');
const { placeLabels, textWidth } = await import('../src/opus-bay/ui/mapLabels');
const { postcardArt, postcardForPoi } = await import('../src/opus-bay/ui/format');
const { portraitSrc } = await import('../src/opus-bay/ui/hooks');

setStorageForTests(null);

function place(who: { x: number; z: number }, x: number, z: number) { who.x = x; who.z = z; }

function reset() {
  flowMod.closeFishing();
  if (cinemaActive()) flowMod.skipArrival();
  game.set({ ...initialGameState(), phase: 'playing' });
  flow.set(initialFlowState());
  Object.assign(runtime.player, { x: 0, y: 0, z: 0, heading: 0, moving: false, running: false, locked: false, pendingInteract: null, pathTarget: null });
  Object.assign(runtime.guide, { x: 0, y: 0, z: 0, state: 'follow', target: null, run: false, emote: 'none', arrived: false });
  runtime.camera.shot = null;
  resetBrain();
  setInteractables(buildInteractables());
  tick(5000); // clear every debounce window
}

function drain(max = 20) {
  for (let i = 0; i < max && game.get().dialogue.nodeId; i++) {
    const node = flowMod.nodeById(game.get().dialogue.nodeId);
    if (node?.choices?.length) return;
    flowMod.advanceDialogue();
  }
}

test('focus picks the nearest usable thing in range and clears while a dialogue is open', () => {
  reset();
  const poi = POIS.find(item => item.interaction.kind === 'info' || item.interaction.kind === 'bell')!;
  place(runtime.player, poi.position.x, poi.position.z);
  updateFocus();
  const focus = game.get().focus;
  assert.ok(focus, 'something is focused next to a POI');
  const it = interactables().find(item => item.id === focus)!;
  assert.ok(Math.hypot(it.x - poi.position.x, it.z - poi.position.z) <= it.radius + 1e-6, 'focused thing is in range');
  flowMod.playDialogue(START_NODE);
  updateFocus();
  assert.equal(game.get().focus, null);
  flowMod.closeDialogue();
  place(runtime.player, 9999, 9999);
  updateFocus();
  assert.equal(game.get().focus, null, 'nothing in range far away');
});

test('click-to-interact fires once the auto-walk reaches the target', () => {
  reset();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const card = interactables().find(item => item.source === 'postcard');
    if (!card) return;
    runtime.player.pendingInteract = card.id;
    runtime.player.pathTarget = { x: card.x, z: card.z };
    place(runtime.player, card.x + 30, card.z);
    updateFocus();
    assert.equal(game.get().postcards.length, 0, 'not yet: still walking');
    place(runtime.player, card.x, card.z);
    updateFocus();
    assert.deepEqual(game.get().postcards, [postcardIdOf(card)]);
    assert.equal(runtime.player.pendingInteract, null);
    // F12: the card flies to the player first (0.6 s beat), then the reward opens
    assert.equal(flow.get().postcardFly?.id, postcardIdOf(card));
    mock.timers.tick(700);
    assert.equal(flow.get().postcardFly, null);
    assert.equal(flow.get().postcardReward, postcardIdOf(card));
  } finally { mock.timers.reset(); }
});

test('guide brain: leads to the tour stop, waits and waves for a lagging player, then plays the arrival', () => {
  reset();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    flowMod.startTour();
    drain();
    assert.equal(flow.get().tourPhase, 'leading');
    const cur = flowMod.currentStop()!;
    const dest = cur.poi.position;

    place(runtime.player, dest.x + 30, dest.z);
    place(runtime.guide, dest.x + 28, dest.z);
    tick(100); updateGuide(clock);
    assert.equal(runtime.guide.state, 'lead');
    assert.ok(runtime.guide.target, 'has a target');
    assert.ok(Math.hypot(runtime.guide.target!.x - dest.x, runtime.guide.target!.z - dest.z) <= 2.01, 'target is beside the stop');

    // BAYBAY got ahead; the player stopped 20 u behind
    place(runtime.guide, dest.x + 3, dest.z);
    place(runtime.player, dest.x + 23, dest.z);
    tick(5000); updateGuide(clock);
    assert.equal(runtime.guide.state, 'wait');
    assert.equal(runtime.guide.target, null);
    assert.equal(runtime.guide.emote, 'wave');
    assert.equal(flow.get().bubble?.tone, 'call');

    // both arrive
    place(runtime.player, dest.x + 1, dest.z);
    runtime.guide.arrived = true;
    tick(100); updateGuide(clock);
    assert.equal(flow.get().tourPhase, 'arrived');
    assert.equal(game.get().dialogue.nodeId, FIRST_TOUR.stops[0].arriveNode);
    tick(100); updateGuide(clock);
    assert.equal(runtime.guide.state, 'talk', 'faces the player while talking');
  } finally { mock.timers.reset(); }
});

test('guide brain: follows behind in free roam and comes running when called (Q counted once)', () => {
  reset();
  mock.timers.enable({ apis: ['setTimeout'] });
  const calls: string[] = [];
  const off = onEvent(event => { if (event.type === 'guide-call') calls.push(event.type); });
  try {
    flowMod.startFree({ quiet: true });
    // F15: a camera-space side slot — 2u beside the player and 0.6u beyond, as the camera sees it
    const spot = POIS.find(item => item.id === 'ferry-building')!.position; // open promenade: both sides standable
    Object.assign(runtime.player, { x: spot.x, z: spot.z, heading: 0, moving: true });
    runtime.camera.yaw = 0; // camera south of the player (+z), looking north
    place(runtime.guide, spot.x + 6, spot.z - 12);
    tick(100); updateGuide(clock);
    assert.equal(runtime.guide.state, 'follow');
    const t = runtime.guide.target!;
    assert.ok(t, 'has a follow target');
    const lateral = t.x - spot.x, beyond = spot.z - t.z; // camera right = +x, away from the camera = −z
    assert.ok(Math.abs(Math.abs(lateral) - 2) < 1e-6 && Math.abs(beyond - 0.6) < 1e-6, `side slot, got ${lateral.toFixed(2)}, ${beyond.toFixed(2)}`);
    assert.ok(lateral > 0, 'keeps the side she is already on');
    assert.equal(runtime.guide.run, true, 'runs to catch up');
    Object.assign(runtime.player, { x: 0, z: 0 });

    runtime.player.moving = false;
    place(runtime.guide, 20, 0);
    flowMod.callBaybay();
    flowMod.callBaybay(); // the same Q seen by the DOM shortcut and by runtime.input.call
    assert.equal(calls.length, 1);
    assert.equal(flow.get().callPending, true);
    tick(100); updateGuide(clock);
    assert.equal(runtime.guide.run, true);
    assert.ok(runtime.guide.target && Math.hypot(runtime.guide.target.x, runtime.guide.target.z) < 2.5, 'runs up to the player');
    place(runtime.guide, 1.5, 0);
    tick(100); updateGuide(clock);
    assert.equal(game.get().dialogue.nodeId, 'flow.call');
    assert.equal(flow.get().callPending, false);
  } finally { off(); mock.timers.reset(); }
});

test('welcome waits for BAYBAY to walk up (or a timeout), then opens the four choices', () => {
  reset();
  game.set({ mode: 'onboarding' });
  flowMod.beginPlaying();
  assert.ok(flowMod.introPending());
  place(runtime.guide, 30, 0);
  tick(100); updateGuide(clock);
  assert.equal(game.get().dialogue.nodeId, null, 'not while BAYBAY is still far away');
  // F1: she walks to her welcome mark (toward the clock tower when at the ferry gate), waves, then the welcome opens
  const mark = flowMod.welcomeMark();
  assert.ok(runtime.guide.target && Math.hypot(runtime.guide.target.x - mark.x, runtime.guide.target.z - mark.z) < 0.6, 'targets the welcome mark');
  place(runtime.guide, mark.x, mark.z);
  tick(600); updateGuide(clock);
  assert.equal(game.get().dialogue.nodeId, START_NODE);
  flowMod.closeDialogue();
});

test('Start swallows its own key press so the arrival cinematic is not skipped at once', () => {
  reset();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    game.set({ phase: 'title' });
    flowMod.startGame();
    assert.equal(game.get().phase, 'arrival');
    assert.equal(flow.get().cinematic, 'arrival');
    tick(16);
    assert.equal(flowMod.requestInteract('runtime'), false);
    assert.equal(flow.get().cinematic, 'arrival', 'still playing');
    for (let i = 0; i < 200 && cinemaActive(); i++) stepCinema(0.05);
    assert.equal(game.get().phase, 'playing');
    assert.ok(flowMod.introPending(), 'the welcome follows the arrival');
  } finally { mock.timers.reset(); }
});

test('viewpoint: camera sweep, then the map unlocks and the goal counts', () => {
  reset();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const vp = POIS.find(poi => poi.interaction.kind === 'viewpoint');
    if (!vp) return;
    place(runtime.player, vp.position.x, vp.position.z);
    flowMod.performInteraction(vp.id);
    assert.equal(flow.get().cinematic, 'viewpoint');
    assert.equal(runtime.player.locked, true);
    let shots = 0;
    for (let i = 0; i < 400 && cinemaActive(); i++) { stepCinema(0.1); if (runtime.camera.shot) shots++; }
    assert.ok(shots > 0, 'drove runtime.camera.shot');
    assert.equal(runtime.camera.shot, null, 'hands the camera back');
    assert.equal(game.get().viewpointUnlocked, true);
    assert.ok(game.get().goalsDone.includes('viewpoint'));
    assert.ok(game.get().dialogue.nodeId || game.get().panel.kind === 'poi', 'a reaction line or the real-info card follows');
  } finally { mock.timers.reset(); }
});

test('fishing: cast → wait → bite → reel in → catch, then the real-info card', () => {
  reset();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const pier = POIS.find(poi => poi.interaction.kind === 'fish');
    if (!pier) return;
    place(runtime.player, pier.position.x, pier.position.z);
    flowMod.performInteraction(pier.id);
    assert.equal(flow.get().fishing?.stage, 'cast');
    assert.equal(runtime.player.locked, true);
    mock.timers.tick(700);
    assert.equal(flow.get().fishing?.stage, 'wait');
    mock.timers.tick(2200);
    assert.equal(flow.get().fishing?.stage, 'bite');
    flowMod.reel();
    assert.equal(flow.get().fishing?.stage, 'caught');
    flowMod.closeFishing();
    assert.equal(flow.get().fishing, null);
    assert.equal(runtime.player.locked, false);
    if (pier.realInfo) assert.deepEqual(game.get().panel, { kind: 'poi', id: pier.id });
  } finally { mock.timers.reset(); }
});

test('telescope: zooms through its subjects with captions, then reacts', () => {
  reset();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const scope = POIS.find(poi => poi.interaction.kind === 'telescope');
    if (!scope) return;
    place(runtime.player, scope.position.x, scope.position.z);
    flowMod.performInteraction(scope.id);
    assert.equal(flow.get().cinematic, 'telescope');
    stepCinema(0.016);
    assert.ok(flow.get().caption, 'shows what you are looking at');
    for (let i = 0; i < 400 && cinemaActive(); i++) stepCinema(0.1);
    assert.equal(flow.get().cinematic, null);
    assert.ok(game.get().dialogue.nodeId || game.get().panel.kind === 'poi');
  } finally { mock.timers.reset(); }
});

test('QA URL hooks parse safely and the Bay clock picks the time of day', () => {
  assert.deepEqual(readQa('?start=tour&time=night&quality=low&debug=1&at=coit-view'), { start: 'tour', time: 'night', quality: 'low', debug: true, at: 'coit-view' });
  assert.deepEqual(readQa('?start=evil&time=noon&quality=ultra&at=../../x'), { start: undefined, time: undefined, quality: undefined, debug: false, at: undefined });
  // 2026-09-25 is PDT (UTC-7)
  assert.equal(bayTimeOfDay(new Date('2026-09-25T15:00:00Z')), 'morning'); // 08:00
  assert.equal(bayTimeOfDay(new Date('2026-09-25T20:00:00Z')), 'day'); // 13:00
  assert.equal(bayTimeOfDay(new Date('2026-09-26T01:00:00Z')), 'golden'); // 18:00
  assert.equal(bayTimeOfDay(new Date('2026-09-26T06:00:00Z')), 'night'); // 23:00
  assert.equal(bayTimeOfDay(new Date('2026-09-25T16:30:00Z')), 'morning', 'bands match the world: morning until 10'); // 09:30
  assert.equal(bayTimeOfDay(new Date('2026-09-25T23:30:00Z')), 'golden', 'golden from 16'); // 16:30
});

test('map labels never overlap each other or the place markers', () => {
  const f = 10;
  const view = { x0: 0, z0: 0, x1: 400, z1: 200 };
  const markers = [{ x: 100, z: 100, r: 12 }];
  const out = placeLabels([
    { id: 'a', text: 'Ferry Building', at: { x: 100, z: 104 } },
    { id: 'b', text: 'Ferry Building', at: { x: 100, z: 104 } },
    { id: 'c', text: '渡轮大厦', at: { x: 300, z: 60 } },
    { id: 'edge', text: 'Near the edge', at: { x: 399, z: 100 } },
    { id: 'huge', text: 'x'.repeat(100), at: { x: 200, z: 100 } },
  ], { fontSize: f, view, markers });
  const ids = out.map(label => label.id);
  assert.ok(ids.includes('a') && ids.includes('c'));
  assert.ok(!ids.includes('huge'), 'labels that cannot fit are dropped');
  const boxes = out.map(label => { const w = textWidth(label.text, f) + f * 0.4; return { x0: label.x - w / 2, x1: label.x + w / 2, z0: label.y - f * 0.95, z1: label.y + f * 0.3 }; });
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    assert.ok(b.x0 >= view.x0 && b.x1 <= view.x1 && b.z0 >= view.z0 && b.z1 <= view.z1, `${out[i].id} stays on the map`);
    const dx = Math.max(b.x0 - 100, 0, 100 - b.x1), dz = Math.max(b.z0 - 100, 0, 100 - b.z1);
    assert.ok(dx * dx + dz * dz >= 144, `${out[i].id} clears the marker`);
    for (let j = i + 1; j < boxes.length; j++) {
      const o = boxes[j];
      assert.ok(!(b.x0 < o.x1 && o.x0 < b.x1 && b.z0 < o.z1 && o.z0 < b.z1), `${out[i].id} vs ${out[j].id}`);
    }
  }
  assert.ok(textWidth('渡轮', 10) > textWidth('ab', 10));
});

test('real assets: portraits by mood, postcard art with srcset, place cards borrow only real postcards', () => {
  assert.match(portraitSrc('baybay', 'thinking') ?? '', /baybay-thinking\.webp$/);
  assert.match(portraitSrc('baybay', 'proud') ?? '', /baybay-proud\.webp$/);
  assert.match(portraitSrc('baybay', 'wave') ?? '', /baybay-happy\.webp$/, 'the happy portrait is the waving pose');
  assert.match(portraitSrc('baybay', 'point') ?? '', /baybay-excited\.webp$/, 'the excited portrait is the pointing pose');
  assert.match(portraitSrc('player') ?? '', /newcomer-neutral\.webp$/);
  for (const card of POSTCARDS) {
    const art = postcardArt(card.id);
    assert.ok(art?.src, card.id);
    assert.match(art!.srcSet ?? '', /600w.*1200w/, `${card.id} has both sizes`);
  }
  const ids = new Set(POSTCARDS.map(card => card.id));
  for (const poi of POIS) {
    const card = postcardForPoi(poi.id);
    if (card) assert.ok(ids.has(card), `${poi.id} → ${card}`);
  }
  assert.equal(postcardForPoi('not-a-poi'), undefined);
});

test('F11: a first visit opens at golden hour; after the welcome choice the real Bay time is one tap away (not saved)', () => {
  reset();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    flow.set({ goldenFirstVisit: true, timeOffer: null });
    flowMod.offerRealTime(new Date('2026-09-26T04:50:00Z')); // 21:50 in San Francisco
    mock.timers.tick(2000);
    assert.equal(flow.get().timeOffer, 'night');
    flowMod.offerRealTime(new Date('2026-09-26T04:50:00Z'));
    flowMod.acceptRealTime();
    assert.equal(flow.get().goldenFirstVisit, false);
    assert.equal(flow.get().timeOffer, null);
    assert.equal(game.get().settings.timeOfDay, 'auto', 'nothing is persisted: the setting stays on the Bay clock');
  } finally { mock.timers.reset(); }
});
