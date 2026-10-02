import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { mock } from 'node:test';

/**
 * Wave 8 · lane K · W8-K4 — the rest of the BAYBAY-under-a-panel gap, found by W8-K1's live proof (the claw panel open
 * 60 s at the Musée, phone): her small talk in game/brain.ts (the once-a-visit light line 金色时刻！, the idle lines, the
 * pass-by barks) waited only for the claw's own 60 s `quietUntil` and was said under the still-open panel; the zone
 * invites and sayWhenQuiet (play/zones.ts) knew the activity but not a card; the emote coach (play/index.ts) was voiced
 * under the claw panel (the second live run) and the sea-otter float (play/pet.ts) cut the bubble on screen. And the game's own
 * lines (差一点点！, 新的纪念品！) sat under the panel (bubble z 8 under the panel's z 43): the play panels are now fixed
 * HUD boxes the bubble is placed round. The district is unchanged.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
let clock = 700_000;
mock.method(performance, 'now', () => clock);
const tick = (ms: number) => { clock += ms; };

const store = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const flowMod = await import('../src/opus-bay/game/flow');
const { flow, initialFlowState } = await import('../src/opus-bay/game/flowStore');
const inter = await import('../src/opus-bay/game/interactables');
const brain = await import('../src/opus-bay/game/brain');
const slots = await import('../src/opus-bay/ui/slots');
const hold = await import('../src/opus-bay/game/baybayHold');
const zones = await import('../src/opus-bay/play/zones');
const { HUD_BOX_SELECTOR, placeBubble, overlaps } = await import('../src/opus-bay/game/hudLayout');

const src = (p: string) => readFileSync(new URL(`../src/opus-bay/${p}`, import.meta.url), 'utf8');
const Nothing = () => null;
for (const id of ['play-claw', 'egg-card', 'h-postcard', 'c-album', 'play-chip']) slots.registerOverlay({ id, Component: Nothing });

function reset(world: 'city' | 'district' = 'city') {
  for (const o of [...slots.openOverlays()]) slots.closeOverlay(o.id);
  if (flow.get().trip) flowMod.endTrip();
  store.game.set({ ...store.initialGameState(), phase: 'playing', worldMode: world, mode: 'free', timeOfDay: 'golden' });
  flow.set(initialFlowState());
  Object.assign(runtime.player, { x: 0, y: 0, z: 0, heading: 0, moving: false, running: false, locked: false, pendingInteract: null, pathTarget: null });
  Object.assign(runtime.guide, { x: 1.5, y: 0, z: 0, state: 'follow', target: null, run: false, emote: 'none', arrived: true });
  brain.resetBrain();
  inter.setInteractables([]);
  tick(5000);
}
const said = () => flow.get().bubble?.text.zh ?? null;
/** `s` seconds of the 10 Hz brain; every BAYBAY bubble seen */
function think(s: number): string[] {
  const seen: string[] = [];
  for (let i = 0; i < s * 10; i++) {
    tick(100);
    brain.updateGuide(clock);
    const b = said();
    if (b && seen[seen.length - 1] !== b) seen.push(b);
  }
  return seen;
}

test('W8-K4 her small talk (the light line) waits under a play panel / a card in the city, and is said once it closes', () => {
  for (const panel of ['play-claw', 'egg-card', 'h-postcard', 'c-album']) {
    reset('city');
    slots.openOverlay(panel);
    assert.equal(hold.baybayHeld(), true, panel);
    const under = think(40);
    assert.deepEqual(under, [], `nothing under ${panel}: ${JSON.stringify(under)}`);
    slots.closeOverlay(panel);
    const after = think(3);
    assert.ok(after.some(t => /金色时刻/.test(t)), `said once ${panel} closed: ${JSON.stringify(after)}`);
  }
  // the play chip (a stairs race, a glide) is not a panel: her small talk goes on as before
  reset('city');
  slots.openOverlay('play-chip');
  assert.ok(think(40).length > 0, 'the play chip does not hold her (the light line or an idle line)');
});

test('W8-K4 the district keeps its small talk timing (the gate is city-only)', () => {
  reset('district');
  slots.openOverlay('egg-card');
  assert.equal(hold.baybayHeld(), false, 'district: nothing is held (a city rule)');
  // (the light line or an idle line: the brain's own dice) — said under the card as before wave 8
  assert.ok(think(40).length > 0, 'the district talks as before');
});

test('W8-K4 a zone invite waits under a card (the activity was already gated); sayWhenQuiet, the emote coach and the float ask the gate too', () => {
  reset('city');
  const line = { zh: '测试邀请', en: 'Test invite' };
  slots.openOverlay('egg-card');
  zones.zoneInvite('w8k4-test', line);
  assert.equal(said(), null, 'no invite under the egg card');
  slots.closeOverlay('egg-card');
  zones.zoneInvite('w8k4-test', line);
  assert.equal(said(), '测试邀请', 'the invite once the card is closed');
  assert.match(src('play/zones.ts'), /!!f\.bubble \|\| !!currentActivity\(\) \|\| baybayHeld\(\);/, 'sayWhenQuiet');
  assert.match(src('game/brain.ts'), /settling \|\| baybayHeld\(\)/, 'the brain');
  assert.match(src('play/index.ts'), /runtime\.move\.mode === 'foot' && !baybayHeld\(\);/, 'the emote coach (heard voiced under the claw panel in the live proof)');
  assert.match(src('play/pet.ts'), /if \(flow\.get\(\)\.bubble \|\| baybayHeld\(\)\) return;/, 'the sea-otter float waits for a bubble / a panel');
});

test('W8-K4 the play panels are fixed HUD boxes: a bubble over the claw panel on a phone is placed below it, on screen', () => {
  const sel = HUD_BOX_SELECTOR.split(', ');
  for (const c of ['.ob-sfg-panel', '.ob-play-sky', '.ob-play-snap', '.ob-play-lion-badges', '[data-ob-hud-box]']) assert.ok(sel.includes(c), c);
  for (const c of ['.ob-play-result', '.ob-play-flight', '.ob-go-chip', '.ob-found-chip']) assert.ok(sel.includes(c), `kept: ${c}`);
  // 390 × 844 (CSS px): the claw panel from the live proof (W8-K1, k1-claw-phone-60s.jpg: 12–378 × 114–595), the bottom
  // bar 64–326 × 780–836, BAYBAY's head projected in the middle of the panel
  const panel = { l: 12, t: 114, r: 378, b: 595 }, bar = { l: 64, t: 780, r: 326, b: 836 };
  const W = 200, H = 46, h = 844;
  const at = placeBubble(195, 420, W, H, [panel, bar], h, 58 + 10 + H + 10, h - 60);
  const box = { l: at.x - W / 2, r: at.x + W / 2, t: at.y - 10 - H, b: at.y - 10 };
  assert.ok(!overlaps(box, panel) && !overlaps(box, bar), `clear of the panel and the bar: ${JSON.stringify(box)}`);
  assert.ok(box.t > panel.b && box.b < bar.t, 'between them');
});

test('W8-K4b a bubble caught between a tall panel and a round button below it lands on a free spot (it swung between them, half under the panel)', () => {
  // 390 × 844: the claw panel, the Hop button under it on the right, the bottom bar (W8-K4 live run 3,
  // a-k4-claw-phone-own-bubble.jpg: 新的纪念品！ half under the panel); BAYBAY's head projected under the panel's right half
  const panel = { l: 12, t: 114, r: 378, b: 595 }, hop = { l: 315, t: 640, r: 370, b: 695 }, bar = { l: 64, t: 780, r: 326, b: 836 };
  const W = 230, H = 64, h = 844, half = W / 2 + 8;
  const at = placeBubble(267, 520, W, H, [panel, hop, bar], h, 58 + 10 + H + 10, h - 60, half, 390 - half);
  const box = { l: at.x - W / 2, r: at.x + W / 2, t: at.y - 10 - H, b: at.y - 10 };
  for (const o of [panel, hop, bar]) assert.ok(!overlaps(box, o), `clear of ${JSON.stringify(o)}: ${JSON.stringify(box)}`);
  assert.ok(box.l >= 0 && box.r <= 390, 'on screen');
  // the 3-pass answer was enough before: unchanged (no box in the way, one box above)
  assert.deepEqual(placeBubble(200, 420, 230, 60, [], h, 130, h - 60), { x: 200, y: 420 });
  assert.deepEqual(placeBubble(195, 420, 200, 46, [panel], h, 114, h - 60, 108, 282), { x: 195, y: 595 + 6 + 10 + 46 });
});
