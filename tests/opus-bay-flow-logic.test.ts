import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

// flow code runs in the browser; give it the few globals it touches.
const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;

const { game, initialGameState } = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const flowMod = await import('../src/opus-bay/game/flow');
const { flow, initialFlowState } = await import('../src/opus-bay/game/flowStore');
const { buildInteractables, setInteractables, interactables } = await import('../src/opus-bay/game/interactables');
const { setCatalogForTests } = await import('../src/opus-bay/data/catalog');
const { FIRST_TOUR } = await import('../src/opus-bay/data/tours');
const { NODES, START_NODE } = await import('../src/opus-bay/data/script');
const { POSTCARDS } = await import('../src/opus-bay/data/postcards');
const { setStorageForTests } = await import('../src/opus-bay/data/wishlist');
const { stepCinema, cinemaActive } = await import('../src/opus-bay/game/cinema');

setStorageForTests(null);

function reset() {
  game.set({ ...initialGameState(), phase: 'playing' });
  flow.set(initialFlowState());
  runtime.player.locked = false;
  runtime.player.pendingInteract = null;
  runtime.player.pathTarget = null;
  setInteractables(buildInteractables());
}

/** Advance the open dialogue until it closes (choices are not auto-picked). */
function drain(max = 20) {
  for (let i = 0; i < max && game.get().dialogue.nodeId; i++) {
    const node = flowMod.nodeById(game.get().dialogue.nodeId);
    if (node?.choices?.length) return;
    flowMod.advanceDialogue();
  }
}

test('dialogue runner opens the welcome, locks movement and hands over to the chosen mode', () => {
  reset();
  flowMod.playDialogue(START_NODE);
  assert.equal(game.get().dialogue.nodeId, START_NODE);
  assert.equal(runtime.player.locked, true);
  const node = NODES[START_NODE];
  const freeIndex = node.choices?.findIndex(choice => choice.action?.type === 'free-roam') ?? -1;
  assert.ok(freeIndex >= 0, 'welcome offers free roam');
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    flowMod.chooseDialogue(freeIndex);
    assert.equal(game.get().mode, 'free');
    assert.equal(game.get().dialogue.nodeId, null);
    assert.equal(runtime.player.locked, false);
  } finally { mock.timers.reset(); }
});

test('tour: intro → lead → arrive → micro interaction → done → card → next stop', () => {
  reset();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    flowMod.startTour();
    assert.equal(game.get().mode, 'tour');
    assert.equal(flow.get().tourPhase, 'intro');
    assert.equal(game.get().dialogue.nodeId, FIRST_TOUR.introNode);
    drain();
    assert.equal(flow.get().tourPhase, 'leading');
    const cur = flowMod.currentStop()!;
    assert.ok(cur, 'first stop resolves to a POI');

    flowMod.tourArrived();
    assert.equal(flow.get().tourPhase, 'arrived');
    drain();
    assert.equal(flow.get().tourPhase, 'await');
    assert.equal(flow.get().awaitingPoi, cur.poi.id);

    runtime.player.x = cur.poi.position.x;
    runtime.player.z = cur.poi.position.z;
    flowMod.performInteraction(cur.poi.id);
    // a second press during the feedback must not double-trigger
    flowMod.performInteraction(cur.poi.id);
    if (flow.get().fishing) { flowMod.reel(); mock.timers.tick(3000); flowMod.reel(); flowMod.closeFishing(); }
    if (game.get().photoMode) flowMod.notePhotoTaken();
    // camera moments (the bell's look-up shot, telescopes) are stepped by the frame loop in the game
    for (let i = 0; i < 200 && cinemaActive(); i++) stepCinema(0.25);
    mock.timers.tick(20000);
    for (let i = 0; i < 5 && !game.get().dialogue.nodeId && flow.get().tourPhase === 'await'; i++) mock.timers.tick(2000);
    drain();
    const completed = game.get().tour.completed;
    assert.deepEqual(completed, [cur.poi.id]);
    if (cur.poi.realInfo) {
      assert.equal(flow.get().tourPhase, 'card');
      assert.deepEqual(game.get().panel, { kind: 'poi', id: cur.poi.id });
      flowMod.closePanel();
    }
    const stops = flowMod.tourStops();
    if (stops.length > 1) {
      assert.equal(flow.get().tourPhase, 'leading');
      assert.equal(game.get().tour.stop, 1);
    }
  } finally { mock.timers.reset(); }
});

test('tour: skipping from the call menu moves on; ending opens the recap', () => {
  reset();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    flowMod.startTour();
    drain();
    const first = game.get().tour.stop;
    flowMod.tourNext();
    assert.equal(game.get().tour.stop, first + 1);
    game.set(s => ({ tour: { ...s.tour, completed: [flowMod.tourStops()[0].poiId] } }));
    flowMod.endTour();
    assert.equal(game.get().tour.active, false);
    assert.equal(game.get().panel.kind, 'recap');
    assert.equal(game.get().mode, 'free');
  } finally { mock.timers.reset(); }
});

test('this week: three answers compute results from the live catalog, then lead to the board', async () => {
  reset();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  setCatalogForTests({
    events: [
      { id: 'a', title: 'A', startDate: today, region: 'sf', category: 'family', cost: 'free' },
      { id: 'b', title: 'B', startDate: today, region: 'sf', category: 'food', cost: 'paid' },
      { id: 'c', title: 'C', startDate: today, region: 'east-bay', category: 'culture', cost: 'free' },
      { id: 'old', title: 'Old', startDate: '2020-01-01', endDate: '2020-01-02', region: 'sf', category: 'family', cost: 'free' },
    ],
    places: [], guides: [],
  });
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    runtime.player.x = 9999; runtime.player.z = 9999; // far from the board
    flowMod.startWeek();
    assert.equal(game.get().mode, 'week');
    assert.equal(game.get().panel.kind, 'week');
    flowMod.setWeekPref('companions', 'kids');
    flowMod.setWeekPref('vibe', 'free');
    flowMod.setWeekPref('region', 'sf');
    await new Promise(resolve => setImmediate(resolve));
    const result = flow.get().weekResult!;
    assert.ok(result, 'results computed');
    assert.equal(result.events[0].event.id, 'a');
    assert.ok(!result.events.some(item => item.event.id === 'old'), 'expired events never shown');
    assert.deepEqual(game.get().week.results, result.events.map(item => item.event.id));
    if (flowMod.boardPosition()) {
      assert.equal(flow.get().weekStage, 'walking');
      assert.equal(game.get().panel.kind, null);
      flowMod.weekArrived();
      flowMod.finishBoardLook(); // F17: the camera looks at the board for ~1.2 s before the sheet opens
    }
    assert.equal(flow.get().weekStage, 'board');
    assert.equal(game.get().panel.kind, 'week');
  } finally { mock.timers.reset(); setCatalogForTests(null); }
});

test('postcards: collect once, reward moment, all found completes the goal', () => {
  reset();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    if (!POSTCARDS.length) return;
    flowMod.collectPostcard(POSTCARDS[0].id);
    flowMod.collectPostcard(POSTCARDS[0].id);
    assert.deepEqual(game.get().postcards, [POSTCARDS[0].id]);
    // F12: a 0.6 s in-world beat (the card flies to you; nothing talks over it), then the reward card
    assert.equal(flow.get().postcardFly?.id, POSTCARDS[0].id);
    flowMod.bubble({ zh: '测试', en: 'test' });
    assert.equal(flow.get().bubble, null, 'no bubbles over the postcard beat');
    flowMod.revealPostcard(); // (the 0.6 s timer does the same)
    assert.equal(flow.get().postcardReward, POSTCARDS[0].id);
    flowMod.closePostcardReward();
    assert.equal(flow.get().postcardReward, null);
    for (const card of POSTCARDS) { flowMod.collectPostcard(card.id); flowMod.revealPostcard(); flowMod.closePostcardReward(); }
    assert.equal(game.get().postcards.length, POSTCARDS.length);
    assert.ok(game.get().goalsDone.includes('postcards'));
  } finally { mock.timers.reset(); }
});

test('interactables cover POIs, postcards and BAYBAY with unique ids', () => {
  reset();
  const list = interactables();
  const ids = list.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length, 'unique ids');
  assert.ok(ids.includes('baybay'));
  for (const card of POSTCARDS) assert.ok(ids.includes(`postcard:${card.id}`), card.id);
  for (const item of list) assert.ok(item.radius > 0 && Number.isFinite(item.x) && Number.isFinite(item.z), item.id);
});

test('streetcar: pick a destination, ride (virtual car when the world car is idle), arrive and count the goal', async () => {
  reset();
  const { stepRide, sortedStops } = await import('../src/opus-bay/game/ride');
  const stops = sortedStops();
  if (stops.length < 2) return;
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    flowMod.boardStreetcar(stops[0].id);
    const node = flowMod.nodeById(game.get().dialogue.nodeId);
    assert.ok(node?.choices && node.choices.length >= 2, 'destination picker');
    const last = stops[stops.length - 1];
    const pick = node!.choices!.findIndex(choice => choice.next?.endsWith(`>${last.id}`));
    assert.ok(pick >= 0);
    flowMod.chooseDialogue(pick);
    assert.equal(game.get().dialogue.nodeId, null);
    assert.equal(game.get().riding, 'streetcar');
    assert.equal(runtime.player.locked, true);
    let done = false;
    for (let i = 0; i < 2000 && !done; i++) done = !!stepRide(0.05)?.done;
    assert.ok(done, 'ride finishes');
    flowMod.finishRide();
    assert.equal(game.get().riding, null);
    assert.equal(runtime.player.locked, false);
    assert.ok(game.get().goalsDone.includes('streetcar'));
  } finally { mock.timers.reset(); }
});

test('F5: a finished tour stop is saved to 想去 once; the toast only promises BAYLINK for plannable saves', () => {
  reset();
  game.set({ wishlist: [], toasts: [] });
  setCatalogForTests({ events: [], places: [{ id: 'pier39', title: 'PIER 39', region: 'sf' }], guides: [] });
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    flowMod.startTour();
    drain();
    const cur = flowMod.currentStop()!;
    flowMod.tourArrived();
    drain();
    runtime.player.x = cur.poi.position.x;
    runtime.player.z = cur.poi.position.z;
    flowMod.performInteraction(cur.poi.id);
    if (flow.get().fishing) { flowMod.reel(); mock.timers.tick(3000); flowMod.reel(); flowMod.closeFishing(); }
    for (let i = 0; i < 200 && cinemaActive(); i++) stepCinema(0.25);
    mock.timers.tick(20000);
    drain();
    assert.ok(game.get().wishlist.some(item => item.kind === 'poi' && item.id === cur.poi.id), 'stop saved to the journal');
    assert.ok(game.get().toasts.some(item => /旅行本|journal/.test(item.text)));
    const count = game.get().wishlist.length;
    flowMod.closePanel();
    assert.equal(game.get().wishlist.filter(item => item.id === cur.poi.id).length, 1, 'saved once');
    assert.ok(game.get().wishlist.length >= count);

    // toast gating: sea lions map to planner place pier39 → BAYLINK; Pier 7 has no planner place → walking route
    assert.equal(flowMod.wishPlannable({ kind: 'poi', id: 'sea-lions' }), true);
    assert.equal(flowMod.wishPlannable({ kind: 'poi', id: 'pier7' }), false);
    assert.equal(flowMod.wishPlannable({ kind: 'event', id: 'ghost' }), false);
    game.set({ toasts: [] });
    flowMod.toggleWish({ kind: 'poi', id: 'pier14', title: 'Pier 14' });
    assert.ok(game.get().toasts.some(item => /步行路线|walking route/.test(item.text)), JSON.stringify(game.get().toasts));
    assert.ok(!game.get().toasts.some(item => /一键带去/.test(item.text)));
    game.set({ toasts: [] });
    flowMod.toggleWish({ kind: 'place', id: 'pier39', title: 'PIER 39' });
    assert.ok(game.get().toasts.some(item => /BAYLINK/.test(item.text)));
  } finally { mock.timers.reset(); setCatalogForTests(null); game.set({ wishlist: [] }); }
});

test('integration: the world market stalls and BAYBAY agree on market hours (every half hour of a week)', async () => {
  const { isMarketOpen } = await import('../src/opus-bay/world/clock');
  const start = Date.parse('2026-09-27T07:00:00Z'); // Sunday 00:00 PDT
  for (let k = 0; k < 7 * 48; k++) {
    const now = new Date(start + k * 30 * 60 * 1000);
    assert.equal(isMarketOpen(now), flowMod.marketOpenNow(now), now.toISOString());
  }
});

test('integration: the jogger is talkable only while paused at a loop end, at their live position', async () => {
  const { joggerState } = await import('../src/opus-bay/actors/view');
  const { interactableById, JOGGER_ID } = await import('../src/opus-bay/game/interactables');
  const { updateFocus } = await import('../src/opus-bay/game/brain');
  game.set({ ...initialGameState(), phase: 'playing', mode: 'free' });
  flow.set(initialFlowState());
  setInteractables(buildInteractables());
  const it = interactableById(JOGGER_ID);
  assert.ok(it && it.source === 'npc' && it.npc === 'jogger');
  // somewhere quiet on the promenade, away from every other interactable
  const spot = { x: 40, z: -80 };
  assert.ok(!interactables().some(item => item.id !== JOGGER_ID && item.source !== 'baybay' && Math.hypot(item.x - spot.x, item.z - spot.z) < item.radius + 1));
  Object.assign(runtime.guide, { x: spot.x + 30, z: spot.z });
  Object.assign(runtime.player, { x: spot.x + 1, z: spot.z, pendingInteract: null });
  Object.assign(joggerState, { paused: false, x: spot.x, z: spot.z });
  updateFocus();
  assert.notEqual(game.get().focus, JOGGER_ID, 'running past: not offered');
  joggerState.paused = true;
  updateFocus();
  assert.equal(game.get().focus, JOGGER_ID, 'paused at a loop end: offered');
  assert.deepEqual([interactableById(JOGGER_ID)!.x, interactableById(JOGGER_ID)!.z], [spot.x, spot.z]);
  joggerState.paused = false;
  game.set({ focus: null });
});
