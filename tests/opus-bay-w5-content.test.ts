import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { mock } from 'node:test';
import type { Bilingual } from '../src/opus-bay/core/types';

/**
 * Wave 5 · lane C · part a (plan sf-w5-plan.md §4.6): W5-C1 the public hooks (rumours, photo frames, the welcome, the
 * documented bubble / markGoalsDone), W5-C2 the pelican first, W5-C3 the welcome back and the goals step once, W5-C4 the
 * reward events. This file runs the CITY content (the page's `?world=city`, read at import time), like the game.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.location = { search: '?world=city&save=off', href: 'http://localhost/opus-bay?world=city&save=off', pathname: '/opus-bay', hostname: 'localhost' };
g.window ??= globalThis;
// headless canvas (world modules make label atlases at import time; the photo card is composed on one)
const noop = () => undefined;
const drawn: string[] = [];
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : k === 'fillText' ? (s: string) => { drawn.push(s); } : noop),
  set: () => true,
});
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d, toBlob: (cb: (b: null) => void) => cb(null) }) };
let clock = 500_000;
mock.method(performance, 'now', () => clock);
const tick = (ms: number) => { clock += ms; };

const store = await import('../src/opus-bay/core/store');
const { game } = store;
const { onEvent, REWARD_SOURCE } = await import('../src/opus-bay/core/events');
const { runtime } = await import('../src/opus-bay/core/runtime');
const flowMod = await import('../src/opus-bay/game/flow');
const { flow, initialFlowState } = await import('../src/opus-bay/game/flowStore');
const inter = await import('../src/opus-bay/game/interactables');
const brain = await import('../src/opus-bay/game/brain');
const save = await import('../src/opus-bay/data/save');
const { setStorageForTests } = await import('../src/opus-bay/data/wishlist');
const goals = await import('../src/opus-bay/data/sf/goals');
const { FREE_GOALS } = await import('../src/opus-bay/data/script');
const rumours = await import('../src/opus-bay/game/rumours');
const frames = await import('../src/opus-bay/game/photoFrames');
const photo = await import('../src/opus-bay/game/photo');
const welcome = await import('../src/opus-bay/game/welcome');
const rewards = await import('../src/opus-bay/game/rewards');
const pelican = await import('../src/opus-bay/game/pelicanFirst');
const moments = await import('../src/opus-bay/game/cityMoments');
const slots = await import('../src/opus-bay/ui/slots');
const moveApi = await import('../src/opus-bay/actors/moveApi');
const { lockHeld } = await import('../src/opus-bay/game/playerLock');
const { ATTRACTIONS } = await import('../src/opus-bay/data/sf/attractions');
const { arrivalAnchors } = await import('../src/opus-bay/game/arrival');
const { CITY_POSTCARDS } = await import('../src/opus-bay/data/sf/postcards');
const { POSTCARDS } = await import('../src/opus-bay/data/postcards');
const { RESIDENTS } = await import('../src/opus-bay/data/sf/residents');
setStorageForTests(null);

const src = (path: string) => readFileSync(new URL(`../src/opus-bay/${path}`, import.meta.url), 'utf8');
const zhLen = (s: string) => [...s].length;
const events: { type: string; [k: string]: unknown }[] = [];
onEvent(e => { events.push(e as unknown as { type: string }); });
const rewardsSeen = () => events.filter(e => e.type === 'reward') as unknown as { source: string; coins: number; stamp?: string }[];

function reset(world: 'city' | 'district' = 'city') {
  if (flow.get().trip) flowMod.endTrip();
  if (game.get().dialogue.nodeId) flowMod.closeDialogue();
  for (const o of [...slots.openOverlays()]) slots.closeOverlay(o.id);
  store.game.set({ ...store.initialGameState(), phase: 'playing', worldMode: world, mode: 'free' });
  flow.set(initialFlowState());
  Object.assign(runtime.player, { x: 0, y: 0, z: 0, heading: 0, moving: false, running: false, locked: false, pendingInteract: null, pathTarget: null });
  Object.assign(runtime.guide, { x: 1, y: 0, z: 0, state: 'follow', target: null, run: false, emote: 'none', arrived: false });
  brain.resetBrain();
  inter.setInteractables(inter.buildInteractables());
  save.resetSaveCache();
  moveApi.setGlideUnlocked(false);
  pelican.resetPelicanForTests();
  welcome.resetWelcome();
  moments.clearLines();
  events.length = 0;
  tick(5000);
}

// ---------------------------------------------------------------------------
// W5-C1 · the public hooks
// ---------------------------------------------------------------------------

test('W5-C1 rumours: sources in order, the first answer wins, told once, a throwing or oversized source is skipped; frames fit a bubble', async () => {
  const ctx = { x: 0, z: 0, zone: 'north-beach', now: new Date(), told: new Set<string>() };
  assert.equal(rumours.pickRumour(ctx), null, 'no source: nothing');
  const offBad = rumours.registerRumourSource(() => { throw new Error('boom'); });
  const offLong = rumours.registerRumourSource(() => ({ id: 'long', text: { zh: '长'.repeat(rumours.RUMOUR_TEXT_ZH_MAX + 1), en: 'too long' } }));
  const offA = rumours.registerRumourSource(c => (c.zone === 'north-beach' ? { id: 'egg:telegraph-hill-parrots', text: { zh: '电报山的台阶上，早上常有一群绿鹦鹉', en: 'A flock of green parrots often visits the Telegraph Hill steps in the morning.' } } : null));
  const offB = rumours.registerRumourSource(() => ({ id: 'egg:b', text: { zh: '别处也有小秘密', en: 'There are small secrets elsewhere too.' } }));
  try {
    assert.equal(rumours.pickRumour(ctx)?.id, 'egg:telegraph-hill-parrots', 'the first valid answer, in registration order');
    assert.equal(rumours.pickRumour({ ...ctx, told: new Set(['egg:telegraph-hill-parrots']) })?.id, 'egg:b', 'a told rumour is skipped');
    assert.equal(rumours.pickRumour({ ...ctx, zone: 'mission' })?.id, 'egg:b');
    for (let n = 0; n < 3; n++) {
      const f = rumours.frameRumour({ text: { zh: '长'.repeat(rumours.RUMOUR_TEXT_ZH_MAX), en: 'The parrots are back.' } }, n);
      assert.ok(zhLen(f.zh) <= 45, `frame ${n}: ${zhLen(f.zh)} ≤ 45`);
      assert.ok(f.en.endsWith('The parrots are back.'), 'the source sentence keeps its own capital');
    }
    assert.match(rumours.frameRumour({ text: { zh: '电报山有鹦鹉', en: 'x' } }).zh, /^听说，电报山有鹦鹉$/);
    // lane D's rumours bring their own frame (听说… / They say …): said as they are, never 听说，听说
    const own = { zh: '听说电报山台阶的花园里，早上常有一群吵吵闹闹的绿鹦鹉。', en: 'They say a noisy green flock visits the Telegraph Hill stair gardens in the mornings.' };
    assert.deepEqual(rumours.frameRumour({ text: own }, 1), own);
    const offOwn = rumours.registerRumourSource(() => ({ id: 'egg:own', text: own }));
    assert.equal(rumours.pickRumour({ ...ctx, zone: 'mission', told: new Set(['egg:b']) })?.id, 'egg:own', 'a framed text up to 45 is valid');
    offOwn();
  } finally { offBad(); offLong(); offA(); offB(); }
  assert.equal(rumours.rumourSourceCount(), 0, 'unregistered');
  // lane D's 24 egg rumours (eggs/registry.ts) fit the hook as they are
  const { EGGS } = await import('../src/opus-bay/eggs/registry');
  for (const e of EGGS) {
    const said = rumours.frameRumour({ text: e.rumour });
    assert.ok(zhLen(said.zh) <= 45 && !/听说，?听说/.test(said.zh), `${e.id}: ${said.zh}`);
    const off = rumours.registerRumourSource(() => ({ id: `egg:${e.id}`, text: e.rumour }));
    assert.equal(rumours.pickRumour(ctx)?.id, `egg:${e.id}`, `${e.id} is accepted`);
    off();
  }
  // the timing rule: none in the first 90 s, then one per 5 min
  assert.equal(rumours.rumourDue({ startedAt: 0, lastAt: null, now: rumours.RUMOUR_FIRST_MS - 1 }), false);
  assert.equal(rumours.rumourDue({ startedAt: 0, lastAt: null, now: rumours.RUMOUR_FIRST_MS }), true);
  assert.equal(rumours.rumourDue({ startedAt: 0, lastAt: 200_000, now: 200_000 + rumours.RUMOUR_GAP_MS - 1 }), false);
  assert.equal(rumours.rumourDue({ startedAt: 0, lastAt: 200_000, now: 200_000 + rumours.RUMOUR_GAP_MS }), true);
});

test('W5-C1 rumours: BAYBAY tells one in free roam beside you, ≤ 1 per 5 min, never during a tour or a trip, never far away', () => {
  reset();
  const asked: string[] = [];
  const off = rumours.registerRumourSource(c => { asked.push(c.zone ?? ''); return { id: `egg:${asked.length}`, text: { zh: '这附近藏着一个小发现', en: 'Something small hides near here.' } }; });
  const R = moments.rumours;
  try {
    Object.assign(R, { start: 0, last: null, askAt: 0, n: 0 }); R.told.clear();
    let now = 1_000_000;
    assert.equal(moments.stepRumours(now), false, 'the first call starts the clock');
    now += rumours.RUMOUR_FIRST_MS - 1000;
    assert.equal(moments.stepRumours(now), false, 'not in the first 90 s');
    now += 2000;
    assert.equal(moments.stepRumours(now), true, 'then one');
    assert.equal(moments.linesBusy(now / 1000), true, 'queued on BAYBAY’s pacer');
    moments.clearLines();
    now += 60_000;
    assert.equal(moments.stepRumours(now), false, 'not again within 5 min');
    now += rumours.RUMOUR_GAP_MS;
    game.set({ tour: { ...game.get().tour, active: true } });
    assert.equal(moments.stepRumours(now), false, 'never during a tour');
    game.set({ tour: { ...game.get().tour, active: false } });
    Object.assign(runtime.guide, { x: 40, z: 0 });
    now += moments.RUMOUR_ASK_MS;
    assert.equal(moments.stepRumours(now), false, 'BAYBAY far away: not shouted');
    Object.assign(runtime.guide, { x: 1, z: 0 });
    now += moments.RUMOUR_ASK_MS;
    assert.equal(moments.stepRumours(now), true, 'beside you again: the next one');
    assert.equal(R.told.size, 2);
  } finally { off(); moments.clearLines(); }
});

test('W5-C1 photo frames: decorators paint on the finished card in order (the photo and band rects), a throwing one is skipped, same id replaces', async () => {
  const seen: string[] = [];
  let rect: import('../src/opus-bay/game/photoFrames').FrameCanvas | null = null;
  const offB = frames.registerFrameDecorator('frame-b', () => { seen.push('b'); }, 5);
  const offA = frames.registerFrameDecorator('frame-a', f => { seen.push('a'); rect = f; }, 1);
  const offBad = frames.registerFrameDecorator('bad', () => { throw new Error('boom'); }, 2);
  frames.registerFrameDecorator('frame-b', () => { seen.push('b2'); }, 5);
  try {
    assert.deepEqual(frames.frameDecorators(), ['frame-a', 'bad', 'frame-b']);
    photo.requestShutter('湾区小旅 · 旧金山', 'BAYLINK');
    photo.consumeShutter({ width: 1000, height: 600 } as unknown as HTMLCanvasElement);
    await Promise.resolve();
    assert.deepEqual(seen, ['a', 'b2'], 'in order; the replaced one paints; the throwing one did not stop the rest');
    const f = rect as unknown as import('../src/opus-bay/game/photoFrames').FrameCanvas;
    assert.ok(f.pad >= 18 && f.photo.x === f.pad && f.photo.y === f.pad && f.photo.w === 1000 && f.photo.h === 600);
    assert.equal(f.band.y, f.pad + 600);
    assert.equal(f.width, 1000 + f.pad * 2);
    assert.equal(f.caption, '湾区小旅 · 旧金山');
    assert.ok(drawn.includes('湾区小旅 · 旧金山') && drawn.includes('BAYLINK'), 'the caption and stamp were drawn before the decorators');
  } finally { offA(); offBad(); offB(); frames.registerFrameDecorator('frame-b', noop)(); }
  assert.deepEqual(frames.frameDecorators(), []);
});

test('W5-C1 welcome: the city welcome choice tells listeners (new), a restart forgets it; a throwing listener is skipped', () => {
  reset();
  const heard: { kind: string; choice?: string }[] = [];
  const offBad = welcome.onWelcome(() => { throw new Error('boom'); });
  const off = welcome.onWelcome((kind, info) => { heard.push({ kind, choice: info.choice }); return { zh: '今天旧金山日落 18:58', en: 'Sunset today 18:58' }; });
  try {
    game.set({ mode: 'onboarding' });
    flowMod.runAction({ type: 'free-roam' });
    assert.deepEqual(heard, [{ kind: 'new', choice: 'free' }]);
    assert.equal(welcome.lastWelcome()?.kind, 'new');
    // a new player's line is not said (the first minute is the goals step's)
    assert.ok(!JSON.stringify(flow.get().bubble ?? '').includes('18:58'));
    // not twice on one page; the mode is free now anyway
    flowMod.runAction({ type: 'free-roam' });
    assert.equal(heard.length, 1);
    // district: never
    reset('district');
    game.set({ mode: 'onboarding' });
    flowMod.runAction({ type: 'skip-intro' });
    assert.equal(heard.length, 1, 'district mode welcomes nobody through the hook');
  } finally { off(); offBad(); }
});

test('W5-C1 the documented API: markGoalsDone ticks once, toasts a FREE_GOALS goal (not with quiet), marks stay silent', () => {
  reset();
  flowMod.markGoalsDone([goals.CITY_GOAL.metro]);
  assert.ok(game.get().goalsDone.includes('metro'));
  assert.ok(game.get().toasts.some(t => t.text.includes('目标完成') || t.text.includes('Goal complete')), 'the toast');
  assert.equal(events.filter(e => e.type === 'goal').length, 1);
  flowMod.markGoalsDone([goals.CITY_GOAL.metro]);
  assert.equal(events.filter(e => e.type === 'goal').length, 1, 'once');
  reset();
  flowMod.markGoalsDone([goals.CITY_GOAL.twinPeaks], { quiet: true });
  assert.equal(game.get().toasts.length, 0, 'quiet: no toast');
  assert.equal(events.filter(e => e.type === 'goal').length, 1, 'the goal event still fires');
  flowMod.markGoalsDone(['hood:mission']);
  assert.equal(events.filter(e => e.type === 'goal').length, 1, 'a mark is not a goal');
  // bubble(): paused while the goals step is open
  const off = slots.registerOverlay({ id: goals.GOALS_STEP_ID, Component: () => null });
  slots.openOverlay(goals.GOALS_STEP_ID);
  flowMod.bubble({ zh: '嗨', en: 'Hi' });
  assert.equal(flow.get().bubble, null, 'no bubble over the goals step');
  slots.closeOverlay(goals.GOALS_STEP_ID);
  flowMod.bubble({ zh: '嗨', en: 'Hi' });
  assert.equal(flow.get().bubble?.text.zh, '嗨');
  off();
  // the public API is written down where the lanes look
  const doc = src('game/flow.ts');
  for (const w of ['PUBLIC content API', 'bubble(text, ms = 3200', 'markGoalsDone(ids, { quiet }?)', 'onWelcome(fn)', 'registerRumourSource(fn)', 'registerFrameDecorator(id, draw)', 'baybayLine(text']) assert.ok(doc.includes(w), w);
});

// ---------------------------------------------------------------------------
// W5-C2 · the pelican first
// ---------------------------------------------------------------------------

const anchors = arrivalAnchors(ATTRACTIONS);
const hitAt = (attraction: string, first = true) => {
  const anchor = anchors.find(a => a.attraction === attraction && !a.spot)!;
  return { anchor, first, via: 'foot' as const, event: { type: 'arrival' as const, place: anchor.place, tier: anchor.rank, first, attraction } };
};

test('W5-C2 goal #1 is the pelican (label, hint, reward text), no GoalKey completes it, its waypoint is the Coit summit', () => {
  assert.equal(FREE_GOALS, goals.CITY_FREE_GOALS, 'this file runs the city content');
  const first = FREE_GOALS[0];
  assert.equal(first.id, 'pelican');
  assert.equal(first.label.zh, '先去科伊特塔找鹈鹕朋友');
  assert.equal(first.label.en, 'Meet the pelican at Coit Tower');
  assert.ok(zhLen(first.hint.zh) <= 45 && !/[A-Z]/.test(first.hint.zh));
  assert.deepEqual(goals.GOAL_REWARDS.pelican, { zh: '解锁：随时飞', en: 'Unlocks flying' });
  assert.equal(flowMod.goalKeyOf('pelican'), null);
  assert.equal(FREE_GOALS.length, 10);
  assert.deepEqual([...pelican.PELICAN_VIEWPOINTS].sort(), ['bernal-heights-park', 'coit-tower', 'corona-heights-randall-museum', 'de-young-tower', 'grand-view-park', 'twin-peaks']);
  for (const line of [pelican.PELICAN_LINES.ask, pelican.PELICAN_LINES.go, pelican.PELICAN_LINES.tour, pelican.PELICAN_LINES.toast(pelican.takeOffKey('touch')), pelican.PELICAN_LINES.laterBubble(pelican.takeOffKey('keyboard')), flowMod.PELICAN_NUDGE, flowMod.FREE_AGAIN]) {
    assert.ok(zhLen(line.zh) <= 45 && line.en.trim(), line.zh);
  }
});

test('W5-C2 BAYBAY recommends the pelican first: nextFreeGoal leads to Coit before a nearer goal; a favour you said yes to still comes first', () => {
  reset();
  // stand right next to the cable-car turntable goal: the pelican (Coit, ≈ 250 u away) still comes first
  Object.assign(runtime.player, { x: 150, z: 262 });
  assert.equal(flowMod.nextFreeGoal()?.id, 'pelican:coit');
  game.set({ goalsDone: ['pelican'] });
  assert.notEqual(flowMod.nextFreeGoal()?.id, 'pelican:coit', 'met: the nearest goal again');
  game.set({ goalsDone: ['task-on:baker'] });
  const first = flowMod.nextFreeGoal()!;
  assert.ok(first.name.zh.startsWith('小忙'), `an accepted favour leads: ${first.name.zh}`);
});

test('W5-C2 arriving at Coit or any panorama viewpoint unlocks the glide, ticks goal #1 quietly and pays goal:pelican once; the moment then asks to fly', async () => {
  reset();
  assert.equal(moveApi.glideUnlocked(), false);
  const plain = anchors.find(a => a.rank === 1 && !a.spot && !pelican.PELICAN_VIEWPOINTS.has(a.attraction))!;
  moments.applyArrival(hitAt(plain.attraction), clock);
  assert.equal(moveApi.glideUnlocked(), false, `not a viewpoint (${plain.attraction})`);
  moments.applyArrival(hitAt('twin-peaks'), clock);
  assert.equal(moveApi.glideUnlocked(), true, 'Twin Peaks, a panorama viewpoint, unlocks it');
  assert.ok(game.get().goalsDone.includes('pelican'));
  assert.ok(!game.get().toasts.some(t => t.text.includes('目标完成')), 'quiet: the moment is the toast');
  assert.deepEqual(rewardsSeen().filter(r => r.source === 'goal:pelican'), [{ type: 'reward', source: 'goal:pelican', coins: 20, stamp: 'goal:pelican' }]);
  assert.ok(pelican.pelicanPending(), 'the moment waits');
  // a second viewpoint changes nothing
  moments.applyArrival(hitAt('coit-tower'), clock);
  assert.equal(rewardsSeen().filter(r => r.source === 'goal:pelican').length, 1);
  // the moment waits for the arrival card and a dialogue, then plays
  const offer = (line: Bilingual) => { offered.push(line.zh); return true; };
  const offered: string[] = [];
  tick(pelican.MOMENT_MIN_MS + 100);
  assert.ok(flow.get().arrival, 'the arrival card is up');
  pelican.stepPelican(clock, offer);
  assert.ok(pelican.pelicanPending(), 'not over the arrival card');
  flow.set({ arrival: null });
  pelican.stepPelican(clock, offer);
  assert.equal(pelican.pelicanPending(), null);
  assert.ok(game.get().toasts.some(t => t.text.startsWith('解锁：随时飞！') || t.text.startsWith('Unlocked: fly anytime!')), 'the gold toast with the take-off key');
  assert.equal(game.get().dialogue.nodeId, 'pelican.moment');
  const node = flowMod.nodeById('pelican.moment')!;
  assert.equal(node.text.zh, '以后想去哪都能飞啦！先试试起飞？');
  assert.deepEqual(node.choices!.map(c => c.label.zh), ['试试起飞', '以后再说']);
  // 试试起飞 → lane A's first flight (when its chunk exports startFirstFlight)
  let flights = 0;
  pelican.resetPelicanForTests(() => { flights++; });
  flowMod.chooseDialogue(0);
  assert.equal(game.get().dialogue.nodeId, 'pelican.go');
  flowMod.advanceDialogue();
  assert.equal(game.get().dialogue.nodeId, null);
  assert.equal(flights, 1, 'handed to startFirstFlight()');
  assert.equal(runtime.player.locked, false, 'free to fly: nothing holds the feet');
});

test('W5-C2 以后再说 leaves a take-off hint; without lane A the take-off itself is pressed; the tour gets a line, not a dialogue', async () => {
  reset();
  pelican.unlockPelican('viewpoint', clock);
  tick(pelican.MOMENT_MIN_MS + 1);
  pelican.stepPelican(clock, () => true);
  flowMod.chooseDialogue(1);
  assert.equal(game.get().dialogue.nodeId, null);
  assert.match(flow.get().bubble?.text.zh ?? '', /^想飞的时候.+就行～$/);
  // no lane-A export (the day-0 stub): 试试起飞 presses 起飞
  reset();
  const { input } = await import('../src/opus-bay/core/input');
  pelican.unlockPelican('viewpoint', clock);
  tick(pelican.MOMENT_MIN_MS + 1);
  pelican.stepPelican(clock, () => true);
  const before = input.glideCount;
  flowMod.chooseDialogue(0);
  flowMod.advanceDialogue();
  for (let i = 0; i < 100 && input.glideCount === before; i++) await new Promise(r => setTimeout(r, 20));
  assert.equal(input.glideCount, before + 1, 'the 起飞 press (play/index.ts has no startFirstFlight yet)');
  // the Grand Tour: a paced line, no dialogue, no route change
  reset();
  game.set({ tour: { active: true, id: 'sf-grand', stop: 0, completed: [] } });
  const offered: string[] = [];
  const said = (line: string | Bilingual) => { offered.push(typeof line === 'string' ? line : line.zh); return true; };
  pelican.resetPelicanForTests(null, said);
  pelican.unlockPelican('tour', clock);
  // at once, queued right behind the stop's own line on BAYBAY's pacer (the QA run lost a line that waited behind
  // the tour's next lead line and the bus boarding), with the toast; by its frozen id (W5-C6: the voice once recorded)
  assert.deepEqual(offered, ['w5c-pelican-tour']);
  assert.ok(game.get().toasts.some(t => t.text.startsWith('解锁：随时飞！')));
  assert.equal(pelican.pelicanPending(), null, 'nothing waits');
  tick(pelican.MOMENT_MIN_MS + 1);
  pelican.stepPelican(clock, said);
  assert.equal(offered.length, 1, 'said once');
  assert.equal(game.get().dialogue.nodeId, null, 'the tour goes on');
  // a viewpoint unlock that happens while a tour runs is the tour's kind of moment too
  reset();
  game.set({ tour: { active: true, id: 'sf-grand', stop: 0, completed: [] } });
  pelican.unlockPelican('viewpoint', clock);
  assert.equal(pelican.pelicanPending(), null);
  assert.equal(flow.get().bubble?.text.zh, '送你一位鹈鹕朋友！以后想去哪都能飞～', 'no pacer yet: a bubble');
});

test('W5-C2 a save that already had the glide: goal #1 ticked quietly on load, no reward, no moment; district mode never unlocks', () => {
  reset();
  moveApi.setGlideUnlocked(true);
  pelican.syncPelicanGoal();
  assert.ok(game.get().goalsDone.includes('pelican'));
  assert.equal(rewardsSeen().length, 0);
  assert.equal(pelican.unlockPelican('viewpoint'), false);
  assert.equal(pelican.pelicanPending(), null);
  reset('district');
  assert.equal(pelican.unlockPelican('viewpoint'), false);
  assert.equal(moveApi.glideUnlocked(), false);
});

// ---------------------------------------------------------------------------
// W5-C3 · welcome back and the goals step once
// ---------------------------------------------------------------------------

test('W5-C3 a returning city player resumes: 欢迎回来 + the area they got to, then one welcome listener line (never 第一次来吗)', () => {
  reset();
  assert.equal(flowMod.hasProgress(), false, 'a fresh player');
  save.patchSave(s => { s.lastSafe = { world: 'city', x: 80, z: 170, heading: 0, zone: 'chinatown' }; });
  assert.equal(flowMod.hasProgress(), true);
  const heard: string[] = [];
  const off = welcome.onWelcome(kind => { heard.push(kind); return { zh: '今天旧金山日落 18:58，找个坡坐下来看吧。', en: 'Sunset today is 18:58.' }; });
  try {
    game.set({ mode: 'onboarding', phase: 'arrival' });
    flowMod.beginPlaying('local');
    assert.equal(flow.get().bubble?.text.zh, '欢迎回来！上次我们走到唐人街了。');
    assert.deepEqual(heard, ['returning']);
    assert.equal(flow.get().goalsCard, false, 'no card on a resume');
    // the listener's line waits for the welcome bubble (no pacer in this test: after it, never over it)
    tick(4700);
    return new Promise<void>(resolve => setTimeout(() => {
      assert.ok(!JSON.stringify(flow.get()).includes('第一次来'), 'never 第一次来吗');
      resolve();
    }, 0));
  } finally { off(); }
});

test('W5-C3 the goals step: once per player, pelican first, bubbles paused, the lock held while open, the old card only as a fallback', async () => {
  reset();
  // not registered (its chunk not loaded): the old card stands in
  flowMod.startFree();
  assert.equal(flow.get().goalsCard, true);
  assert.ok(!game.get().goalsDone.includes(goals.GOALS_STEP_SEEN));
  // registered: the step opens once and is marked seen; no card
  reset();
  const { initGoalsStep, afterGoalsStep } = await import('../src/opus-bay/game/goalsStep');
  const off = initGoalsStep();
  try {
    flowMod.startFree();
    assert.ok(flowMod.goalsStepOpen());
    assert.equal(flow.get().goalsCard, false);
    assert.ok(game.get().goalsDone.includes(goals.GOALS_STEP_SEEN));
    assert.equal(flow.get().bubble, null, 'BAYBAY waits: the step carries her intro');
    slots.closeOverlay(goals.GOALS_STEP_ID);
    // after it: 我自己逛 → her pelican line and the soft waypoint on Coit
    afterGoalsStep('self', 'pelican:coit');
    assert.equal(flow.get().bubble?.text.zh, flowMod.PELICAN_NUDGE.zh);
    assert.equal(flow.get().freeHint?.id, 'pelican:coit');
    // the big button → BAYBAY leads there
    afterGoalsStep('lead', 'pelican:coit');
    assert.equal(flow.get().freeLead, 'pelican:coit');
    // a second free roam: no step, no card, and no "here are some goals" again
    flowMod.startFree();
    assert.equal(flowMod.goalsStepOpen(), false);
    assert.equal(flow.get().goalsCard, false);
    assert.equal(flow.get().bubble?.text.zh, flowMod.PELICAN_NUDGE.zh);
    game.set({ goalsDone: [...game.get().goalsDone, 'pelican'] });
    flowMod.startFree();
    assert.equal(flow.get().bubble?.text.zh, flowMod.FREE_AGAIN.zh);
    // district: the old card, as before
    reset('district');
    flowMod.startFree();
    assert.equal(flow.get().goalsCard, true);
    assert.equal(flowMod.goalsStepOpen(), false);
  } finally { off(); }
});

test('W5-C3 the goals step body: BAYBAY’s line, the pelican with 解锁：随时飞 and one big button with the honest time, then the other nine goals', async () => {
  reset();
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { registerHooks } = await import('node:module');
  const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
  const { default: GoalsStep } = await import('../src/opus-bay/ui/GoalsStep');
  styles.deregister();
  Object.assign(runtime.player, { x: 131.5, z: 15.1 }); // the Ferry Building
  const html = renderToStaticMarkup(h(GoalsStep, { close: noop }));
  assert.match(html, /好嘞，整座旧金山都给你逛！/);
  assert.match(html, /class="ob-gstep-hero ">[\s\S]*先去科伊特塔找鹈鹕朋友[\s\S]*解锁：随时飞/);
  assert.match(html, /跟 BAYBAY 去找鹈鹕<small> · 约 \d+ (秒|分钟)<\/small>/);
  assert.match(html, /我自己逛/);
  assert.equal([...html.matchAll(/<li class="[^"]*"><span class="ob-check">/g)].length, 9, 'the nine other goals');
  assert.ok(html.indexOf('鹈鹕') < html.indexOf('明信片'), 'the pelican first');
  game.set({ goalsDone: ['pelican'] });
  const after = renderToStaticMarkup(h(GoalsStep, { close: noop }));
  assert.match(after, /ob-gstep-hero is-done/);
  assert.match(after, /出发！/);
  assert.doesNotMatch(after, /跟 BAYBAY 去找鹈鹕/);
  assert.equal(lockHeld(), false, 'rendering to a string mounts no effect');
});

// ---------------------------------------------------------------------------
// W5-C4 · rewards
// ---------------------------------------------------------------------------

test('W5-C4 every source lane C can emit follows the frozen grammar (all attractions, postcards, residents, goals)', () => {
  for (const a of ATTRACTIONS) assert.match(`arrive:${a.id}`, REWARD_SOURCE, a.id);
  for (const c of [...POSTCARDS, ...CITY_POSTCARDS]) assert.match(`postcard:${c.id}`, REWARD_SOURCE, c.id);
  for (const r of RESIDENTS) assert.match(`favour:${r.key}`, REWARD_SOURCE, r.key);
  for (const goal of goals.CITY_FREE_GOALS) assert.match(`goal:${goal.id}`, REWARD_SOURCE, goal.id);
  assert.deepEqual(rewards.REWARD_COINS.arrive, { 1: 10, 2: 5, 3: 3 });
});

test('W5-C4 arrivals, postcards and goals emit `reward` once, on the live first event, in the city only', () => {
  reset();
  const t1 = anchors.find(a => a.rank === 1 && !a.spot && !pelican.PELICAN_VIEWPOINTS.has(a.attraction))!;
  const t2 = anchors.find(a => a.rank === 2 && !a.spot && !pelican.PELICAN_VIEWPOINTS.has(a.attraction))!;
  const t3 = anchors.find(a => a.rank === 3 && !a.spot && !pelican.PELICAN_VIEWPOINTS.has(a.attraction))!;
  moments.applyArrival(hitAt(t1.attraction), clock);
  moments.applyArrival(hitAt(t1.attraction, false), clock);
  moments.applyArrival(hitAt(t2.attraction), clock);
  moments.applyArrival(hitAt(t3.attraction), clock);
  assert.deepEqual(rewardsSeen().map(r => [r.source, r.coins, r.stamp]), [
    [`arrive:${t1.attraction}`, 10, `arrive:${t1.attraction}`], [`arrive:${t2.attraction}`, 5, `arrive:${t2.attraction}`], [`arrive:${t3.attraction}`, 3, `arrive:${t3.attraction}`],
  ], 'first arrivals only, by tier');
  events.length = 0;
  const card = CITY_POSTCARDS[0];
  flowMod.collectPostcard(card.id);
  flowMod.collectPostcard(card.id);
  assert.deepEqual(rewardsSeen().map(r => [r.source, r.coins]), [[`postcard:${card.id}`, 10]]);
  events.length = 0;
  flowMod.completeGoal('cable-car');
  flowMod.markGoalsDone(['golden-gate', 'hood:mission', 'loop:loop-ferry-building']);
  flowMod.markGoalsDone(['golden-gate']);
  assert.deepEqual(rewardsSeen().map(r => [r.source, r.coins, r.stamp]), [['goal:cable-car', 20, undefined], ['goal:golden-gate', 20, 'goal:golden-gate']], 'goals only (never marks), once; the bridge is a stamp');
  // district: nothing
  reset('district');
  flowMod.collectPostcard(POSTCARDS[0].id);
  flowMod.completeGoal('taste');
  assert.equal(rewardsSeen().length, 0);
  assert.equal(rewards.emitReward('goal:x', 5), false);
  reset();
  assert.equal(rewards.emitReward('nope:x', 5), false, 'outside the grammar: never emitted');
  assert.equal(rewards.emitReward('goal:x', -1), false);
});

test('W5-C4 a finished favour emits favour:<key> once (25)', async () => {
  reset();
  const { initResidentTasks } = await import('../src/opus-bay/game/residentTasks');
  const off = initResidentTasks();
  try {
    // Luz's favour is a postcard: with the card already in the journal, saying yes finishes it at once
    game.set({ postcards: ['sf-mission-murals'] });
    const { emit } = await import('../src/opus-bay/core/events');
    emit({ type: 'dialogue', speaker: 'npc', nodeId: 'npc.muralist.yes' });
    assert.deepEqual(rewardsSeen().map(r => [r.source, r.coins]), [['favour:muralist', 25]]);
    emit({ type: 'dialogue', speaker: 'npc', nodeId: 'npc.muralist.yes' });
    assert.equal(rewardsSeen().length, 1);
  } finally { off(); }
});

test('W5-C3 a resume is not an arrival: settle() marks the anchors around the spot entered (no moment) until the player leaves and comes back', async () => {
  const { ArrivalWatcher } = await import('../src/opus-bay/game/arrival');
  const w = new ArrivalWatcher(anchors);
  const dragon = anchors.find(a => a.attraction === 'chinatown-dragon-gate' && !a.spot)!;
  const at = (x: number, z: number, now: number) => w.step({ x, z, now, onFoot: true, busy: false, travelling: false });
  assert.ok(w.settle(dragon.x, dragon.z) >= 1);
  assert.equal(at(dragon.x, dragon.z, 1000), null, 'standing where they left off: no moment');
  assert.equal(w.hasSeen('chinatown-dragon-gate'), false, 'nothing marked seen');
  at(dragon.x + 200, dragon.z, 2000);
  assert.equal(at(dragon.x, dragon.z, 3000)?.anchor.attraction, 'chinatown-dragon-gate', 'walking back in is the first arrival');
  assert.match(src('game/flow.ts').replace(/\r\n/g, '\n'), /export function welcomeBack\(\): void \{\n[^\n]*\n {2}settleArrivals\(\);/, 'the welcome back settles first');
});

test('W5-C2 lane A’s first flight refusing (it resolves false: not unlocked yet, riding …) falls back to the plain take-off', async () => {
  reset();
  const { input } = await import('../src/opus-bay/core/input');
  let asked = 0;
  pelican.unlockPelican('viewpoint', clock);
  tick(pelican.MOMENT_MIN_MS + 1);
  pelican.stepPelican(clock, () => true);
  pelican.resetPelicanForTests(async () => { asked++; return false; });
  const before = input.glideCount;
  flowMod.chooseDialogue(0);
  flowMod.advanceDialogue();
  for (let i = 0; i < 50 && input.glideCount === before; i++) await new Promise(r => setTimeout(r, 10));
  assert.equal(asked, 1);
  assert.equal(input.glideCount, before + 1);
});

test('lane N’s requests: a flight’s landing arrives like a hop-off (no on-foot reveal); the call menu times a carried trip', async () => {
  reset();
  const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
  const { emit } = await import('../src/opus-bay/core/events');
  const frames = (n: number, ms = 250) => { for (let i = 0; i < n; i++) { tick(ms); stepFrameSystems(ms / 1000, clock); } };
  const off = moments.initCityMoments();
  try {
    const t1 = anchors.filter(a => a.rank === 1 && !a.spot && !a.quiet && !pelican.PELICAN_VIEWPOINTS.has(a.attraction));
    // walked in: the full moment with the reveal
    Object.assign(runtime.player, { x: t1[0].x, z: t1[0].z });
    frames(2);
    assert.equal(flow.get().arrival?.attraction, t1[0].attraction);
    assert.equal(flow.get().arrival?.reveal, true, 'on foot: the reveal');
    // flown in: the landing is a hop-off (N's descent beat is the moment)
    flow.set({ arrival: null });
    emit({ type: 'travel', what: 'land', to: t1[1].place });
    Object.assign(runtime.player, { x: t1[1].x, z: t1[1].z });
    frames(2);
    assert.equal(flow.get().arrival?.attraction, t1[1].attraction);
    assert.equal(flow.get().arrival?.reveal, false, 'after a landing: no on-foot reveal');
  } finally { off(); }
  // the carried time: the auto-travel pace over the street factor (faster than the straight walk's label for a long way)
  const { autoTravelSeconds, STREET_FACTOR } = await import('../src/opus-bay/game/tripPlan');
  const { timeLabel } = await import('../src/opus-bay/game/tripText');
  assert.deepEqual(moments.carriedTime(400), timeLabel(autoTravelSeconds(400 * STREET_FACTOR)));
});
