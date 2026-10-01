import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { mock } from 'node:test';

/**
 * Wave 8 · lane K · W8-K1 — BAYBAY's ambient lines hold while a play panel, an egg card or the Halloween postcard is
 * open (W7-I: the claw panel and the 螃蟹方向盘 line, voiced with its bubble hidden; the neighbourhood greeting under the
 * Halloween postcard), and game/flow.ts bubble() waits behind the Halloween postcard. The play chip is an overlay too
 * and never holds them.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
let clock = 500_000;
mock.method(performance, 'now', () => clock);

const store = await import('../src/opus-bay/core/store');
const { emit, onEvent } = await import('../src/opus-bay/core/events');
const { runtime } = await import('../src/opus-bay/core/runtime');
const flowMod = await import('../src/opus-bay/game/flow');
const { flow, initialFlowState } = await import('../src/opus-bay/game/flowStore');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const slots = await import('../src/opus-bay/ui/slots');
const moments = await import('../src/opus-bay/game/cityMoments');
const lines = await import('../src/opus-bay/game/baybayLines');

const Nothing = () => null;
for (const id of ['play-claw', 'play-crab', 'play-dough', 'play-fortune', 'w2-skyline', 'h-postcard', 'egg-card', 'egg-note', 'egg-operator', 'egg-listen', 'play-chip', 'play-flight']) {
  slots.registerOverlay({ id, Component: Nothing });
}

/** every voice line, with what was on screen when it played */
const voices: { id: string; bubble: string | null; overlays: string[] }[] = [];
onEvent(e => {
  if (e.type === 'voice-line') voices.push({ id: e.id, bubble: flow.get().bubble?.text.zh ?? null, overlays: slots.openOverlays().map(o => o.id) });
});

const offMoments = moments.initCityMoments();
const offLines = lines.initBaybayLines();

function reset() {
  for (const o of [...slots.openOverlays()]) slots.closeOverlay(o.id);
  store.game.set({ ...store.initialGameState(), phase: 'playing', worldMode: 'city', mode: 'free' });
  flow.set(initialFlowState());
  Object.assign(runtime.player, { x: 0, y: 0, z: 0, heading: 0, moving: false, running: false, locked: false, pendingInteract: null, pathTarget: null });
  moments.clearLines();
  // well past every gap / cooldown of the schedulers
  run(30);
  flow.set({ bubble: null });
  voices.length = 0;
}

/** play `s` seconds at 10 Hz; returns BAYBAY's bubbles (zh) seen on screen in that time */
function run(s: number): string[] {
  const seen: string[] = [];
  for (let i = 0; i < s * 10; i++) {
    clock += 100;
    stepFrameSystems(0.1, clock);
    (flowMod as { flushWaitingBubble?: () => void }).flushWaitingBubble?.();
    const b = flow.get().bubble?.text.zh;
    if (b && seen[seen.length - 1] !== b) seen.push(b);
  }
  return seen;
}

const LOOP = 'loop-ferry-building-approach';
const LOOP_ZH = '前面就是渡轮大厦';

test('W8-K1 the pacer (arrival / tour / transit lines) holds while a play panel is open; the voice never plays without its bubble', () => {
  for (const panel of ['play-claw', 'play-crab', 'play-dough', 'play-fortune', 'w2-skyline', 'egg-card', 'egg-listen']) {
    reset();
    slots.openOverlay(panel);
    assert.ok(moments.offerLine(LOOP, 30), 'the line is queued');
    const under = run(8);
    assert.deepEqual(under.filter(t => t.startsWith(LOOP_ZH)), [], `no tour line under ${panel}`);
    assert.equal(voices.length, 0, `no voice under ${panel}: ${JSON.stringify(voices)}`);
    slots.closeOverlay(panel);
    const after = run(3);
    assert.ok(after.some(t => t.startsWith(LOOP_ZH)), `said once ${panel} closed: ${JSON.stringify(after)}`);
    assert.deepEqual(voices.map(v => v.id), [LOOP], 'with its voice');
    assert.ok(voices.every(v => v.bubble?.startsWith(LOOP_ZH) && v.overlays.length === 0), 'the voice played with its bubble up');
  }
});

test('W8-K1 the event / neighbourhood lines (game/baybayLines.ts) hold under an egg card and the Halloween postcard', () => {
  reset();
  slots.openOverlay('egg-card');
  emit({ type: 'hill' });
  assert.deepEqual(run(8), [], 'nothing said under the egg card');
  assert.equal(voices.length, 0);
  slots.closeOverlay('egg-card');
  assert.ok(run(3).some(t => t.startsWith('呼…这坡好陡')), 'the first-hill line once the card closed');
  assert.deepEqual(voices.map(v => v.id), ['first-hill']);

  reset();
  slots.openOverlay('h-postcard');
  emit({ type: 'vehicle:enter', vehicle: 'bike' } as Parameters<typeof emit>[0]);
  assert.deepEqual(run(8), [], 'nothing said under the Halloween postcard');
  assert.equal(voices.length, 0);
  slots.closeOverlay('h-postcard');
  assert.ok(run(3).some(t => t.startsWith('骑车出发')), 'the bike line after the card');
});

test('W8-K1 the play chip and the first-flight chip are overlays that never hold BAYBAY (the glide / stairs lines go on)', () => {
  reset();
  slots.openOverlay('play-chip');
  slots.openOverlay('play-flight');
  assert.ok(moments.offerLine(LOOP, 30));
  assert.ok(run(3).some(t => t.startsWith(LOOP_ZH)), 'said with the chips up');
  assert.deepEqual(voices.map(v => v.id), [LOOP]);
});

test('W8-K1 flow.bubble() waits behind the Halloween postcard and shows after it closes (dropped when it waited too long)', () => {
  reset();
  slots.openOverlay('h-postcard');
  const text = { zh: '谢谢！万圣节快乐！', en: 'Thank you! Happy Halloween!' };
  flowMod.bubble(text, 3000);
  assert.equal(flow.get().bubble, null, 'not on screen under the card');
  run(4);
  assert.equal(flow.get().bubble, null, 'still waiting');
  slots.closeOverlay('h-postcard');
  const seen = run(1);
  assert.deepEqual(seen, [text.zh], 'shown once the card closed');
  // too long behind the card: dropped
  reset();
  slots.openOverlay('h-postcard');
  flowMod.bubble(text, 3000);
  run(30);
  slots.closeOverlay('h-postcard');
  assert.deepEqual(run(2), [], 'a bubble older than 15 s is not said late');
  // another overlay (a play panel) does not hold the game's own bubbles: the claw's catch line shows over its panel
  reset();
  slots.openOverlay('play-claw');
  flowMod.bubble({ zh: '新的纪念品！', en: 'A new souvenir!' }, 2000);
  assert.equal(flow.get().bubble?.text.zh, '新的纪念品！', 'a game says its own lines over its own panel');
});

test('W8-K1 the gate is one exported list of overlay ids (strings), the activities, and every ambient scheduler uses it', async () => {
  const hold = await import('../src/opus-bay/game/baybayHold');
  for (const id of ['play-claw', 'play-crab', 'play-dough', 'play-fortune', 'w2-skyline', 'h-postcard', 'egg-card', 'egg-note', 'egg-operator', 'egg-listen']) {
    assert.ok(hold.BAYBAY_HOLD_OVERLAYS.includes(id), id);
  }
  for (const id of ['play-chip', 'play-flight', 'e-shop']) assert.ok(!hold.BAYBAY_HOLD_OVERLAYS.includes(id), `${id} never holds`);
  for (const id of ['kite', 'hide-seek', 'claw']) assert.ok(hold.BAYBAY_HOLD_ACTIVITIES.includes(id), id);
  assert.deepEqual([...hold.BUBBLE_WAIT_OVERLAYS], ['h-postcard']);
  // the overlay ids are the modules' real ids
  const src = (p: string) => readFileSync(new URL(`../src/opus-bay/${p}`, import.meta.url), 'utf8');
  assert.match(src('halloween/playPostcardRun.ts'), /H_POSTCARD_OVERLAY = 'h-postcard'/);
  assert.match(src('play/claw.ts'), /CLAW_OVERLAY = 'play-claw'/);
  assert.match(src('play/skyline.ts'), /const CARD = 'w2-skyline'/);
  for (const id of ['egg-card', 'egg-note', 'egg-operator', 'egg-listen']) assert.ok(src('eggs/index.ts').includes(`id: '${id}'`), id);
  // the gate is in every ambient scheduler (no import of a game module: strings only)
  for (const f of ['game/cityMoments.ts', 'game/baybayLines.ts', 'game/pelicanFirst.ts', 'realsf/index.ts', 'halloween/world.ts', 'economy/lines.ts']) {
    assert.ok(/baybayHeld\(\)/.test(src(f)), `${f} asks baybayHeld()`);
  }
  assert.ok(!/from '\.\.\/(play|halloween|eggs)\//.test(src('game/baybayHold.ts')), 'the gate imports no lazy module');
});

test('W8-K1 a running hide & seek or kite holds the ambient lines; the stairs race does not', async () => {
  const kit = await import('../src/opus-bay/play/kit');
  for (const [id, holds] of [['hide-seek', true], ['kite', true], ['stairs-filbert', false]] as const) {
    reset();
    const r = kit.startActivity({ id, name: { zh: id, en: id } });
    assert.ok(r, id);
    assert.ok(moments.offerLine(LOOP, 30));
    const seen = run(4);
    assert.equal(seen.some(t => t.startsWith(LOOP_ZH)), !holds, `${id}: ${JSON.stringify(seen)}`);
    r!.cancel();
    if (holds) assert.ok(run(3).some(t => t.startsWith(LOOP_ZH)), `${id}: said after the activity`);
  }
  kit.__resetKit();
});

test.after(() => { offMoments(); offLines(); });
