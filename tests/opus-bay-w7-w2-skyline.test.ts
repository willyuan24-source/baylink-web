import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 7 · lane W2 · 那是什么？ the skyline quiz (play/skyline.ts, play/skylineLines.ts): the aim points match their
 * sources (the landmarks' measured tall parts, the hero towers, the Bay Bridge), the line of sight (a hill or a roof in
 * the way hides a landmark; its own radius does not), a round of three through the frame systems (the card's three names,
 * a fact after each answer, medal:skyline:n through the kit), nothing in sight → her line and no round, the words fixed.
 */

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : noop), set: () => true });
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const S = await import('../src/opus-bay/play/skyline');
const { SKYLINE_SPOTS, SKYLINE_LINES, SKYLINE_ID } = await import('../src/opus-bay/play/skylineLines');
const chip = await import('../src/opus-bay/play/chip');
const kit = await import('../src/opus-bay/play/kit');
const { onEvent } = await import('../src/opus-bay/core/events');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { game } = await import('../src/opus-bay/core/store');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const { openOverlays } = await import('../src/opus-bay/ui/slots');
const { BEST_ROWS } = await import('../src/opus-bay/economy/records');

const seeded = (s: number) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

test('W7-W2 skyline: the aim points are the landmarks’ measured tops (sites, hero towers, the Bay Bridge)', async () => {
  const { landmarkTallStructures } = await import('../src/opus-bay/world/sf/landmarks/context');
  const { heroTall, bayBridgeTall } = await import('../src/opus-bay/actors/glideTall');
  const { sfLandmark } = await import('../src/opus-bay/world/sf/landmarks/index');
  const tall = landmarkTallStructures(l => (typeof l.base === 'number' ? l.base : 0));
  const hero = heroTall(), bay = bayBridgeTall();
  for (const s of SKYLINE_SPOTS) {
    let src: { x: number; z: number; top: number } | undefined;
    if (s.id === 'alcatraz') { const l = sfLandmark('alcatraz')!; src = { x: l.x, z: l.z, top: Math.max(...tall.filter(t => t.id === 'alcatraz').map(t => t.top)) }; }
    else if (s.id === 'bay-bridge') src = bay[0];
    else if (['coit-tower', 'transamerica-pyramid', 'salesforce-tower', 'ferry-building'].includes(s.id)) src = hero.reduce((a, b) => (Math.hypot(b.x - s.x, b.z - s.z) < Math.hypot(a.x - s.x, a.z - s.z) ? b : a));
    else src = tall.find(t => t.id === s.id);
    assert.ok(src, s.id);
    assert.ok(Math.hypot(src.x - s.x, src.z - s.z) < 1, `${s.id}: at its source (${src.x.toFixed(1)}, ${src.z.toFixed(1)})`);
    assert.ok(s.y < s.top && s.top <= src.top + 0.1 && s.top >= src.top - 2.6, `${s.id}: aim ${s.y} under the top ${s.top} (source ${src.top.toFixed(1)})`);
    assert.ok(s.fact.zh.includes(s.name.zh.slice(0, 2)) && s.fact.en.length < 110, `${s.id}: the fact names it, short`);
  }
});

test('W7-W2 skyline: line of sight over the height field and the roofs', () => {
  const s = SKYLINE_SPOTS.find(q => q.id === 'coit-tower')!;
  const flat = () => 0;
  assert.ok(S.inSight({ x: s.x + 200, y: 1.6, z: s.z }, s, flat), 'open ground: in sight');
  // a 20 u roof half way: hidden; the landmark's own footprint (within r + 4) never hides it
  const roof = (x: number, z: number) => (Math.hypot(x - (s.x + 100), z - s.z) < 5 ? 40 : 0);
  assert.ok(!S.inSight({ x: s.x + 200, y: 1.6, z: s.z }, s, roof));
  const own = (x: number, z: number) => (Math.hypot(x - s.x, z - s.z) < s.r + 3 ? 100 : 0);
  assert.ok(S.inSight({ x: s.x + 200, y: 1.6, z: s.z }, s, own));
  // too near, too far
  assert.ok(!S.inSight({ x: s.x + 10, y: 1.6, z: s.z }, s, flat));
  assert.ok(!S.inSight({ x: s.x + 2000, y: 1.6, z: s.z }, s, flat));
  // three names: the right one and two others, all different
  const c = S.choicesFor(s, seeded(3));
  assert.equal(c.length, 3);
  assert.equal(new Set(c.map(q => q.id)).size, 3);
  assert.ok(c.some(q => q.id === s.id));
});

test('W7-W2 skyline: a round of three — the card, a fact after each answer, the medal; nothing in sight: her line, no round', async () => {
  const { flow } = await import('../src/opus-bay/game/flowStore');
  kit.__setBestWriter(null);
  const events: { type: string; source?: string; activity?: string; what?: string }[] = [];
  const off = onEvent(e => { events.push(e as never); });
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false });
  runtime.move.mode = 'foot';
  const p = runtime.player;
  p.x = 60; p.z = 200;
  try {
    assert.ok(S.startSkyline({ occ: () => 0, rand: seeded(7) }));
    assert.equal(chip.chipState()?.id, SKYLINE_ID);
    for (let r = 0; r < 3; r++) {
      const live = S.skylineLive()!;
      const card = openOverlays().find(o => o.id === 'w2-skyline');
      assert.ok(card, `round ${r}: the card`);
      const props = card.props as { choices: { id: string }[]; right: string };
      assert.equal(props.choices.length, 3);
      assert.ok(runtime.camera.shot, 'the camera turns to it');
      const right = live.order[live.round].id;
      assert.ok(S.answerSkyline(r === 1 ? props.choices.find(c => c.id !== right)!.id : right));
      assert.deepEqual(flow.get().bubble?.text, r === 1 ? SKYLINE_LINES.wrong : SKYLINE_LINES.right);
      for (let i = 0; i < 50; i++) stepFrameSystems(0.1, r * 10 + i * 0.1);
    }
    assert.equal(kit.currentActivity(), null, 'three rounds, then the card');
    assert.ok(events.some(e => e.type === 'reward' && e.source === 'medal:skyline:2'), JSON.stringify(events.filter(e => e.type === 'reward')));
    assert.ok(!events.some(e => e.type === 'reward' && e.source === 'medal:skyline:3'));
    assert.equal(runtime.camera.shot, null, 'the camera is released');
    assert.equal(chip.chipState(), null);
    // nothing in sight: no round, her line
    flow.set({ bubble: null });
    assert.equal(S.startSkyline({ occ: () => 999 }), false);
    assert.deepEqual(flow.get().bubble?.text, SKYLINE_LINES.noView);
    assert.equal(kit.currentActivity(), null);
    assert.ok(S.nearestViewSpot(60, 200));
  } finally { S.__resetSkyline(); off(); flow.set({ bubble: null }); game.set({ phase: prev.phase, mode: prev.mode }); }
  for (const [k, v] of Object.entries(SKYLINE_LINES)) assert.ok(v.zh && v.en && !/\d|\$\{/.test(v.zh + v.en), `${k}: fixed`);
  const keys = BEST_ROWS.map(r => r.key);
  assert.ok(keys.includes(SKYLINE_ID) && keys.indexOf(SKYLINE_ID) > keys.indexOf('bell'), 'the records row is appended');
});

test('W7-W2-review skyline: with one landmark in sight the quiz asks it once (not the same question three times for a free ★)', async () => {
  const { flow } = await import('../src/opus-bay/game/flowStore');
  kit.__setBestWriter(null);
  const events: { type: string; source?: string; activity?: string; what?: string; tier?: number }[] = [];
  const off = onEvent(e => { events.push(e as never); });
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false });
  runtime.move.mode = 'foot';
  const p = runtime.player;
  p.x = 60; p.z = 200;
  const coit = SKYLINE_SPOTS.find(q => q.id === 'coit-tower')!;
  // only the ray to Coit Tower is open: everything off its line is a wall
  const occ = (x: number, z: number) => {
    const dx = coit.x - p.x, dz = coit.z - p.z, L = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - p.x) * dx + (z - p.z) * dz) / L));
    // (W9-G6: 1.5 u wide — the round's camera stands 0.9 u to the side of the player and must see it too)
    return Math.hypot(x - p.x - dx * t, z - p.z - dz * t) < 1.5 ? 0 : 999;
  };
  try {
    assert.deepEqual(S.spotsInSight({ x: p.x, y: 1.6, z: p.z }, occ).map(s => s.id), ['coit-tower']);
    assert.ok(S.startSkyline({ occ, rand: seeded(5) }));
    const live = S.skylineLive()!;
    assert.deepEqual(live.order.map(s => s.id), ['coit-tower'], 'one landmark in sight: one question');
    assert.equal(chip.chipState()?.big, '1 / 1');
    assert.ok(S.answerSkyline('coit-tower'));
    for (let i = 0; i < 50; i++) stepFrameSystems(0.1, i * 0.1);
    assert.equal(kit.currentActivity(), null, 'the quiz ends after its one question');
    // (the medals were paid once this session by the round above: the run's tier is on its end event)
    // (W9-G6, review 2026-10-01 R§6: medals by the share named — one right of one is ◆, still not ★)
    assert.deepEqual(events.filter(e => e.type === 'play' && e.activity === SKYLINE_ID && e.what === 'end').map(e => e.tier), [2], 'one right of one: ◆, not ★');
    assert.ok(!events.some(e => e.type === 'reward' && e.source === 'medal:skyline:3'), 'no ★ for one landmark');
  } finally { S.__resetSkyline(); off(); flow.set({ bubble: null }); game.set({ phase: prev.phase, mode: prev.mode }); }
});
