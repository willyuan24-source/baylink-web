import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 8 · lane A · Alcatraz on foot: the island's arrival (an anchor of its own at the cellhouse front, never at the
 * Pier 33 telescope), its fixed line, the reveal's photo pose, the stamp source; BAYBAY's fixed lines (no templates, NPS
 * facts) and when the island watcher says them (gliding in: the way back; the stair; the occupation), the deckhand's
 * boarding / ashore lines through game/transit's ferry hooks.
 */

// --- headless canvas stub (world modules create label atlases at import time) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { ATTRACTIONS, ISLAND_LANDINGS, tripDestination } = await import('../src/opus-bay/data/sf/attractions');
const { ArrivalWatcher, arrivalAnchors, arrivalBeats, defaultArrivalLine } = await import('../src/opus-bay/game/arrival');
const W = await import('../src/opus-bay/world/sf/alcatrazWalk');
const { ALCA_LINES } = await import('../src/opus-bay/world/sf/alcatrazLines');
const A = await import('../src/opus-bay/world/sf/alcatrazFerrySystem');
const D = await import('../src/opus-bay/data/ferry');

test('W8-A island arrival: Alcatraz arrives at the cellhouse front (its own anchor and line), never at the Pier 33 telescope; trips still end at the pier', () => {
  const land = ISLAND_LANDINGS.alcatraz;
  assert.deepEqual({ x: land.x, z: land.z }, W.ALCA_ARRIVAL, 'the landing = the walk\'s arrival spot');
  const alca = ATTRACTIONS.find(a => a.id === 'alcatraz')!;
  assert.ok(alca.offWalk && alca.siteId === 'alcatraz');
  assert.equal(tripDestination(alca).placeId, 'alcatraz-landing', 'trips still end at Pier 33');
  const anchors = arrivalAnchors(ATTRACTIONS);
  const a = anchors.filter(x => x.attraction === 'alcatraz');
  assert.equal(a.length, 1);
  assert.deepEqual({ x: a[0].x, z: a[0].z }, W.ALCA_ARRIVAL);
  assert.equal(a[0].rank, 1);
  // walking up to the front fires the first (tier-1) moment: its own line, the stamp, the reveal
  const w = new ArrivalWatcher(anchors);
  const sample = (x: number, z: number, now: number) => ({ x, z, now, onFoot: true, busy: false, travelling: false });
  assert.notEqual(w.step(sample(alca.arrival!.x, alca.arrival!.z, 0))?.anchor.attraction, 'alcatraz', 'not at the pier');
  const q = D.ALCA_TERMINALS.island.quay;
  assert.equal(w.step(sample(q.x, q.z, 1000))?.anchor.attraction === 'alcatraz', false, 'not yet at the dock (14 u below)');
  const hit = w.step(sample(W.ALCA_ARRIVAL.x, W.ALCA_ARRIVAL.z, 2000));
  assert.equal(hit?.anchor.attraction, 'alcatraz');
  assert.equal(hit?.first, true);
  const beats = arrivalBeats(hit!, {});
  assert.deepEqual(beats.line, ALCA_LINES.arrive);
  assert.ok(beats.stamp && beats.reveal && beats.peek && beats.toast, 'toast, stamp, reveal, peek');
  assert.deepEqual(defaultArrivalLine('alcatraz')!.text, ALCA_LINES.arrive);
});

test('W8-A island reveal: the site\'s photo pose (world/sf/landmarks/context sitePhoto) frames the cellhouse from above the water', async () => {
  const ctx = await import('../src/opus-bay/world/sf/landmarks/context');
  const { photoPose } = await import('../src/opus-bay/actors/reveal');
  const photo = ctx.sitePhoto('alcatraz')!;
  assert.deepEqual(photo, { target: [...W.ALCA_PHOTO.target], distance: W.ALCA_PHOTO.distance, elevation: W.ALCA_PHOTO.elevation, bearing: W.ALCA_PHOTO.bearing });
  const frame = ctx.siteFrame('alcatraz', () => 0)!;
  const cam = photoPose(frame, photo);
  const target = { x: frame.x + W.ALCA_PHOTO.target[0], z: frame.z + W.ALCA_PHOTO.target[2] };
  const d = Math.hypot(cam.pos.x - target.x, cam.pos.z - target.z);
  assert.ok(d > 30 && d < 50, `the camera ${d.toFixed(0)} u from the cellhouse`);
  assert.ok(cam.pos.y > 15, `above the island (${cam.pos.y.toFixed(1)})`);
  assert.ok(!W.onAlcatraz(cam.pos.x, cam.pos.z) || cam.pos.y > 20, 'out over the water, or high above the island');
});

test('W8-A lines: fixed zh + en (no templates, no prices), NPS facts; the boat says board / ashore / back at Pier 33', () => {
  for (const [k, l] of Object.entries(ALCA_LINES)) {
    assert.ok(l.zh.length > 6 && l.en.length > 10, k);
    assert.ok(!/\$\{|\{\w+\}|%s/.test(l.zh + l.en), `${k}: no template`);
    assert.ok(!/\$|美元|票价|ticket/i.test(l.zh + l.en), `${k}: no prices`);
    assert.ok(l.zh.length <= 48, `${k}: fits a bubble (${l.zh.length})`);
  }
  assert.match(ALCA_LINES.arrive.zh, /1934.*1963/);
  assert.match(ALCA_LINES.occupation.en, /1969.*Indians of All Tribes.*19 months/);
  assert.match(ALCA_LINES.stair.en, /13 storeys/);
  const sys = new A.AlcaFerrySystem({ clock: () => ({ year: 2026, month: 10, day: 2, hour: 11, minute: 0, weekday: 5 }), brake: () => false });
  assert.deepEqual(sys.boardLine(), ALCA_LINES.board);
  assert.deepEqual(sys.offLine(D.ALCA_TERMINALS.island.id), ALCA_LINES.ashore);
  assert.deepEqual(sys.offLine(D.ALCA_TERMINALS.pier33.id), ALCA_LINES.backAt33);
});

test('W8-A the island watcher: gliding in gets the way back, the stair its line, the cellhouse front the occupation after a while; a ferry rider skips the way back', async () => {
  const { AlcaFerryLayer } = await import('../src/opus-bay/world/sf/alcatrazFerry');
  const { game } = await import('../src/opus-bay/core/store');
  const { flow } = await import('../src/opus-bay/game/flowStore');
  const { runtime } = await import('../src/opus-bay/core/runtime');
  const { __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
  __setBayNowForTests('2026-10-02T11:00');
  const layer = new AlcaFerryLayer();
  const p = runtime.player;
  const said: string[] = [];
  const tick = (secs: number) => {
    for (let t = 0; t < secs; t += 0.25) {
      layer.update(0.25);
      const b = flow.get().bubble;
      if (b) { said.push(b.text.en); flow.set({ bubble: null }); }
    }
  };
  try {
    game.set({ phase: 'playing', worldMode: 'city', move: { mode: 'foot' } });
    const put = (q: { x: number; z: number }) => { p.x = q.x; p.z = q.z; };
    // landing on the plateau from the air: the way back first
    put(W.ALCA_WALK_GRAPH.nodes[5]);
    tick(1.5);
    assert.deepEqual(said, [ALCA_LINES.wayBack.en]);
    // down to the stair's foot: the climb line, once
    put(W.ALCA_WALK_GRAPH.nodes[4]);
    tick(1.5);
    put(W.ALCA_WALK_GRAPH.nodes[3]); tick(1); put(W.ALCA_WALK_GRAPH.nodes[4]); tick(1);
    assert.deepEqual(said.slice(1), [ALCA_LINES.stair.en]);
    // a while at the cellhouse front: the occupation, once a page
    put(W.ALCA_ARRIVAL);
    tick(8);
    assert.equal(said.length, 2, 'not yet');
    tick(6);
    assert.deepEqual(said.slice(2), [ALCA_LINES.occupation.en]);
    // a dialogue open holds a line: leave the island, come back by "ferry" later — no way-back line then
    put(D.ALCA_TERMINALS.pier33.quay); tick(1);
    (layer as unknown as { ferriedIn: boolean }).ferriedIn = true;
    put(D.ALCA_TERMINALS.island.quay); tick(3);
    assert.equal(said.length, 3, 'a ferry rider is not told the way back');
  } finally {
    layer.dispose();
    __setBayNowForTests(null);
    game.set({ worldMode: 'district' });
    flow.set({ bubble: null });
  }
});

test('W8-A the player walks it: the real controller goes quay → dock road → up the stair → the cellhouse front (published city)', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { heightAt, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const { runtime } = await import('../src/opus-bay/core/runtime');
  const { PlayerController } = await import('../src/opus-bay/actors/controller');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  const N = W.ALCA_WALK_GRAPH.nodes;
  await sf.attachAround(city, N[0].x, N[0].z, 70, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  const c = new PlayerController(), p = runtime.player, DT = 1 / 30;
  try {
    p.x = N[0].x; p.z = N[0].z; p.y = heightAt(p.x, p.z); p.pathTarget = null; p.locked = false; c.sync();
    let t = 0;
    for (let k = 1; k <= W.ALCA_WALK_GRAPH.arrival; k++) {
      const goal = N[k];
      let s = 0;
      while (Math.hypot(goal.x - p.x, goal.z - p.z) > 0.6 && s < 15) {
        runtime.input.moveX = 0; runtime.input.moveY = 1; runtime.input.run = false; runtime.input.jump = false;
        c.step({ dt: DT, now: t, cameraYaw: Math.atan2(-(goal.x - p.x), -(goal.z - p.z)), frozen: false, riding: false });
        s += DT; t += DT;
      }
      assert.ok(Math.hypot(goal.x - p.x, goal.z - p.z) <= 0.6, `reached node ${k} (stopped at ${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
    }
    assert.ok(p.y > 8, `up on the plateau (y ${p.y.toFixed(2)})`);
    assert.ok(t < 20, `the climb takes ${t.toFixed(1)} s`);
  } finally {
    runtime.input.moveY = 0;
    setCityTerrain(null);
  }
});
