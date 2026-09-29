import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * W6-K1 · feel & play fixes (docs/opus-bay/sf-w6-K1.md): the district keeps its feet, and the small per-frame and
 * guard fixes from the wave-5 reviews.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
const { runtime } = await import('../src/opus-bay/core/runtime');
const { input } = await import('../src/opus-bay/core/input');
const { game } = await import('../src/opus-bay/core/store');
const T = await import('../src/opus-bay/core/terrain');
const { PlayerController } = await import('../src/opus-bay/actors/controller');

test('W6-K1: no mantle in the district (the lead\'s decision) — the hop onto the 1 u ledge at the plaza by the Filbert Steps lands on it as before wave 5', () => {
  assert.equal(T.cityTerrain(), null, 'district terrain');
  const saved = game.get();
  game.set({ phase: 'playing', worldMode: 'district', move: { mode: 'foot' } } as never);
  try {
    // the stairs run up to (−55.25, 57.5) at y 19.0; the plaza stands at y 20.0 from x −54.75: a 1 u ledge. W5-F10's
    // mantle climbed it hands first here (a hop from x −56.5); the district's own hop pops onto it
    const c = new PlayerController(), p = runtime.player;
    assert.ok(Math.abs(T.heightAt(-55.25, 57.5) - 19.01) < 0.05 && Math.abs(T.heightAt(-54.5, 57.5) - 20) < 0.05, 'the ledge is there');
    p.x = -56.5; p.z = 57.5; p.y = T.heightAt(p.x, p.z); p.heading = Math.PI / 2; p.pathTarget = null; p.locked = false;
    c.sync();
    let sawMantle = false;
    for (let i = 0; i < 90; i++) {
      runtime.input.moveX = 0; runtime.input.moveY = 1; runtime.input.run = false; input.manualMove = true;
      runtime.input.jump = i === 20;
      c.step({ dt: 1 / 60, now: i / 60, cameraYaw: -Math.PI / 2, frozen: false, riding: false });
      if (c.mantle) sawMantle = true;
    }
    assert.equal(c.mantles, 0, 'no mantle');
    assert.ok(!sawMantle);
    assert.ok(p.x > -53.5 && Math.abs(p.y - 20) < 0.01 && c.grounded, `on the plaza (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
  } finally {
    runtime.input.moveY = 0; input.manualMove = false;
    game.set(saved);
  }
});

test('W6-K1: the deck queries write into the caller\'s object (no object per frame on the GGB deck), with the same answers', async () => {
  const deck = await import('../src/opus-bay/actors/deckSteer');
  const d = { id: 'k1-test', x: 9000, z: 9000, heading: 0.4, length: 200, half: 6, y: 0 };
  deck.registerDeck('k1-test', d);
  try {
    const q = deck.deckPoint(d, 50, 2);
    const fresh = deck.deckAt(q.x, q.z, 0)!;
    const out = { deck: null as unknown as typeof d, s: -1, l: -1 };
    const got = deck.deckAt(q.x, q.z, 0, out);
    assert.equal(got, out, 'the same object back');
    assert.ok(fresh !== out && fresh.deck === out.deck && Math.abs(fresh.s - out.s) < 1e-9 && Math.abs(fresh.l - out.l) < 1e-9);
    assert.equal(deck.onDeck(q.x, q.z, 0), true);
    assert.equal(deck.onDeck(q.x + 500, q.z, 0), false);
    const w = { x: 0, z: 0, steered: false };
    const wx = Math.sin(0.5), wz = Math.cos(0.5);
    const a = deck.deckWish(fresh, wx, wz), b = deck.deckWish(fresh, wx, wz, 0.45, w);
    assert.equal(b, w);
    assert.deepEqual({ ...a }, { ...w });
    const across = deck.deckWish(fresh, Math.cos(0.4), -Math.sin(0.4), 0.45, w);   // straight across: left alone
    assert.equal(across, w);
    assert.equal(w.steered, false);
  } finally { deck.registerDeck('k1-test', null); }
  // the controller, the camera and the feet pass their own objects (source): no bare per-frame deck queries left
  const { readFileSync } = await import('node:fs');
  const src = (f: string) => readFileSync(new URL(`../src/opus-bay/actors/${f}`, import.meta.url), 'utf8');
  assert.match(src('controller.ts'), /deckAt\(p\.x, p\.z, p\.y, this\.deckOut\)/);
  assert.match(src('controller.ts'), /deckWish\(dk, wx, wz, PLAYER_RADIUS, this\.wishOut\)/);
  assert.equal((src('controller.ts').match(/deckDip\([^)]*this\.dipOut2?\)/g) ?? []).length, 2);
  assert.match(src('camera.ts'), /deckAt\(view\.x, view\.z, view\.ground, this\.deckOut\)/);
  assert.doesNotMatch(src('feet.ts'), /deckAt\(/);
  assert.doesNotMatch(src('deckSteer.ts'), /const p = deckPoint\(/, 'laneClear probes inline');
});

test('W6-K1: the glide\'s floor probes and the auto-glide\'s stick reuse objects (the same answers)', async () => {
  const { GLIDE, GlideSim, autoGlideInput } = await import('../src/opus-bay/actors/glide');
  const world = { heightAt: (x: number) => x * 0.01, inWorld: () => true, roofAt: () => -Infinity, landingSpot: () => null };
  const g = new GlideSim();
  g.x = 10; g.z = 0; g.y = 20; g.heading = 0.3; g.speed = GLIDE.cruise;
  const f = { soft: 0, hard: 0 };
  assert.equal(g.floorAt(world, 40, 5, f), f);
  assert.deepEqual({ ...g.floorAt(world, 40, 5) }, { ...f });
  const o = { pitch: 9, steer: 9, boost: true, slow: true };
  for (const to of [{ x: 0, z: 500 }, { x: 300, z: 300 }, { x: 0, z: 40 }]) {
    const a = autoGlideInput(g, to, world), b = autoGlideInput(g, to, world, o);
    assert.equal(b, o);
    assert.deepEqual({ ...a }, { ...o });
  }
  const { readFileSync } = await import('node:fs');
  const ms = readFileSync(new URL('../src/opus-bay/actors/moveSystem.ts', import.meta.url), 'utf8');
  assert.match(ms, /autoGlideInput\(g, A, this\.world\(\), gi\)/);
  assert.doesNotMatch(ms, /inp = \{ \.\.\.inp/, 'the approach writes into the flight\'s input object');
  const gl = readFileSync(new URL('../src/opus-bay/actors/glide.ts', import.meta.url), 'utf8');
  assert.equal((gl.match(/this\.floorAt\(world, [^;]*this\.floor(Here|Ahead)\)/g) ?? []).length, 3, 'the flight\'s three probes');
});

test('W6-K1: the stair race\'s progress reads reuse objects; the bell pad re-renders only when its look changes', async () => {
  const { lineProgress } = await import('../src/opus-bay/play/stairs');
  const line = { pts: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }], cum: [0, 10, 20], len: 20 };
  const out = { s: -1, off: -1 };
  for (const [x, z] of [[3, 1], [11, 4], [-2, 0], [10, 30]]) {
    const a = lineProgress(line, x, z), b = lineProgress(line, x, z, out);
    assert.equal(b, out);
    assert.ok(Math.abs(a.s - b.s) < 1e-9 && Math.abs(a.off - b.off) < 1e-9);
  }
  assert.deepEqual({ ...lineProgress(line, 3, 1) }, { s: 3, off: 1 });
  const { readFileSync } = await import('node:fs');
  const st = readFileSync(new URL('../src/opus-bay/play/stairs.ts', import.meta.url), 'utf8');
  assert.match(st, /lineProgress\(r\.line, p\.x, p\.z, PROG_P\)/);
  assert.match(st, /lineProgress\(r\.line, g\.x, g\.z, PROG_G\)/);
  const bell = await import('../src/opus-bay/play/bell');
  assert.equal(bell.riffLook(0), -1, 'no riff');
  const pad = readFileSync(new URL('../src/opus-bay/play/BellPad.tsx', import.meta.url), 'utf8');
  assert.match(pad, /if \(k !== look\) \{ look = k; setTick/);
  assert.doesNotMatch(pad, /const tick = \(\) => \{ setTick/, 'no re-render every frame');
});

test('W6-K1 (W5-Z §7.5): a talk mark far from the player (a dialogue left open across a teleport) is dropped — BAYBAY stays by the player instead of re-planning toward it', async () => {
  const { GuideMover, TALK_FAR } = await import('../src/opus-bay/actors/guide');
  const { DISTRICT } = await import('../src/opus-bay/data/district');
  const far = DISTRICT.anchors['ferry-clock'], here = DISTRICT.anchors['pier39-entrance'];
  assert.ok(Math.hypot(far.x - here.x, far.z - here.z) > TALK_FAR * 3);
  const p = runtime.player, g = runtime.guide;
  p.x = here.x; p.z = here.z; p.y = T.heightAt(here.x, here.z); p.pathTarget = null; p.locked = false; p.moving = false;
  const m = new GuideMover();
  m.place();
  const by = T.nearestWalkable({ x: here.x + 1.8, z: here.z }, 4)!;
  g.x = by.x; g.z = by.z; g.y = T.heightAt(by.x, by.z);
  const d0 = Math.hypot(g.x - p.x, g.z - p.z);
  assert.ok(d0 < 6, `placed by the player (${d0.toFixed(1)} u)`);
  g.state = 'talk'; g.run = false; g.target = { x: far.x, z: far.z };
  let maxGap = 0;
  for (let t = 0; t < 6; t += 1 / 60) {
    m.step(1 / 60, t, { playing: true, riding: false, visible: true });
    maxGap = Math.max(maxGap, Math.hypot(g.x - p.x, g.z - p.z));
  }
  assert.ok(maxGap < 6, `stays by the player (max gap ${maxGap.toFixed(1)} u)`);
  assert.equal(m.hops, 0, 'no hop-in');
  // a live talk mark (beside the player) is still walked to
  const mark = { x: here.x + 3, z: here.z };
  if (T.canStand(mark.x, mark.z, 0.45)) {
    g.target = mark;
    for (let t = 6; t < 10; t += 1 / 60) m.step(1 / 60, t, { playing: true, riding: false, visible: true });
    assert.ok(Math.hypot(g.x - mark.x, g.z - mark.z) < 1, 'reached the near mark');
  }
  g.state = 'follow'; g.target = null;
});

test('W6-K1 (lane R\'s review): the sky\'s band is re-applied on a world switch (useTimeOfDay depends on the world)', async () => {
  const { readFileSync } = await import('node:fs');
  const ov = readFileSync(new URL('../src/opus-bay/ui/Overlay.tsx', import.meta.url), 'utf8');
  const body = /function useTimeOfDay\(\) \{[\s\S]*?\n\}/.exec(ov)?.[0] ?? '';
  assert.match(body, /const world = useGame\(s => s\.worldMode\)/);
  assert.match(body, /bayTimeOfDay\(undefined, world\)/);
  assert.match(body, /\[setting, firstGolden, world\]/);
  // and the band really differs by world at some hour (so the old world's band was wrong until the next minute)
  const { bayTimeOfDay } = await import('../src/opus-bay/game/qa');
  let differs = 0;
  for (let h = 0; h < 24; h++) for (const m of [0, 30]) {
    const d = new Date(Date.UTC(2026, 9, 1, h, m));
    if (bayTimeOfDay(d, 'city') !== bayTimeOfDay(d, 'district')) differs++;
  }
  assert.ok(differs > 0, 'the two worlds band some half-hours differently');
});

test('W6-K1 (lane A\'s review): the heave-ho never takes the tap from a boarding prompt in reach; the rings chunk is fetched at the pelican\'s unlock', async () => {
  const z3 = await import('../src/opus-bay/play/zones3');
  const I = await import('../src/opus-bay/game/interactables');
  const saved = I.interactables();
  const tt = { id: 'tt-k1', x: 5000, z: 5000 };
  // the queue at Powell & Market stands beside the turntable (a stop's 坐叮当车, radius 4.2), and lane T's 帮忙推 (12 u)
  I.setInteractables([
    { id: 'transit-k1-stop', source: 'transit', action: 'streetcar', verb: { zh: '坐叮当车', en: 'Ride the cable car' }, name: { zh: '站', en: 'Stop' }, x: 5006, z: 5000, radius: 4.2 },
    { id: 'transit-push-tt-k1', source: 'transit', action: 'streetcar', verb: { zh: '帮忙推', en: 'Help push' }, name: { zh: '转盘', en: 'Turntable' }, x: 5000, z: 5000, radius: 12 },
  ] as ReturnType<typeof I.interactables>);
  const p = runtime.player;
  try {
    p.x = 5007; p.z = 5000;                    // at the stop (1 u), 7 u from the turntable
    assert.equal(z3.boardingInReach(), true);
    assert.equal(z3.placeHeave(tt), false, 'the stop keeps the tap: 坐叮当车');
    assert.ok(z3.heaveIt.x > 1e6);
    p.x = 4992; p.z = 5003;                    // across the turntable, out of the stop's reach (lane T's 帮忙推 is no boarding prompt)
    assert.equal(z3.boardingInReach(), false);
    assert.equal(z3.placeHeave(tt), true, 'offered round it');
    assert.equal(z3.heaveIt.refId, 'tt-k1');
  } finally { I.setInteractables(saved as ReturnType<typeof I.interactables>); z3.placeHeave(null); }
  const { readFileSync } = await import('node:fs');
  const idx = readFileSync(new URL('../src/opus-bay/play/index.ts', import.meta.url), 'utf8');
  assert.match(idx, /import\('\.\/rings'\)/, 'play/index fetches the rings chunk');
  assert.match(idx, /offs\.push\(subscribeGlide\(prefetchRings\)\)/, 'when the glide unlocks');
  assert.match(idx, /if \(ringsAsked \|\| disposed \|\| !glideUnlocked\(\)\) return;/, 'only once the pelican is unlocked');
});

test('W6-K1 (lane T\'s review): on a narrow street the side-on cable-car shot swings round behind the car instead of sitting in the houses; an open street keeps the side-on shot', async () => {
  const THREE = await import('three');
  const { RideCamera } = await import('../src/opus-bay/actors/cameraModes');
  const SX = 7000, SZ = 7000, SR = 80;
  type Blk = import('../src/opus-bay/core/terrain').Blocker;
  const rect = (x0: number, z0: number, x1: number, z1: number, top: number): Blk => ({ kind: 'polygon', polygon: [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }], top });
  const world = (blockers: Blk[]) => {
    const inside = (x: number, z: number) => Math.abs(x - SX) < SR && Math.abs(z - SZ) < SR;
    const overlap = (b: Blk, x: number, z: number, r: number) => (b.kind === 'circle' ? Math.hypot(x - b.x, z - b.z) < r + b.r : T.distanceToPolygon(x, z, b.polygon) < r);
    const hits = (x: number, z: number, r: number) => blockers.some(b => overlap(b, x, z, r));
    T.setCityTerrain({
      heightAt: (x, z) => (inside(x, z) ? 0 : null), surfaceCode: (x, z) => (inside(x, z) ? 1 : 0),
      kindAt: (x, z) => (inside(x, z) ? T.KIND.land : T.KIND.outside), standAt: () => 1,
      forEachBlockerNear: (x, z, r, fn) => { for (const b of blockers) if (overlap(b, x, z, r + 0.5)) fn(b); },
      hitsBlocker: hits, blockedAt: (x, z) => hits(x, z, 0.45),
    });
  };
  // the car runs up the street's middle along +z (heading 0); the rider on its running board, 1.3 u to the side
  const sub = { mode: 'transit' as const, x: SX + 1.3, y: 1.4, z: SZ, heading: 0, speed: 4, gradeAhead: 0, side: 1 as const, seated: false, occlude: true, kind: 'cable-car' as const };
  const run = () => {
    const rc = new RideCamera(), pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 46 };
    for (let i = 0; i < 180; i++) rc.update({ ...sub, z: sub.z + i * 0.066 }, 1 / 60, i / 60, pose);
    return { rc, pose };
  };
  const inWall = (x: number) => x > SX + 3.6 || x < SX - 3.6;
  try {
    // Hyde St: houses wall to wall 3.6 u either side of the car's axis, 12 u tall
    world([rect(SX + 3.6, SZ - 70, SX + 30, SZ + 70, 12), rect(SX - 30, SZ - 70, SX - 3.6, SZ + 70, 12)]);
    const narrow = run();
    assert.ok(narrow.rc.swing > 0.7, `swung round toward behind the car (${narrow.rc.swing.toFixed(2)})`);
    assert.ok(!inWall(narrow.pose.pos.x), `the camera is in the street, not in a house (x ${(narrow.pose.pos.x - SX).toFixed(2)} from the axis)`);
    assert.ok(narrow.pose.pos.z < sub.z + 180 * 0.066 - 3, 'behind the car, along the street');
    // an open street: the side-on shot stays
    world([]);
    const open = run();
    assert.ok(open.rc.swing < 0.05, `side-on (${open.rc.swing.toFixed(2)})`);
    assert.ok(open.pose.pos.x - SX > 5, 'from the side');
  } finally { T.setCityTerrain(null); }
});
