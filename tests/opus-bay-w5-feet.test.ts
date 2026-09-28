import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 5 · lane F's feet (plan sf-w5-plan.md §2 MF2, §4.4): arrivals face open ground (W5-F7, actors/faceOpen.ts);
 * the forgiving-feet guards (W5-F5) join this file.
 */

const { runtime } = await import('../src/opus-bay/core/runtime');
const { canStand } = await import('../src/opus-bay/core/terrain');
const { DISTRICT } = await import('../src/opus-bay/data/district');
const { FACE_OPEN, faceOpen, openHeading, openRuns } = await import('../src/opus-bay/actors/faceOpen');
const { takeFaceRequest } = await import('../src/opus-bay/game/cinema');

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

test('faceOpen: the heading faces the longest run of standable ground (a wide opening over a narrow gap), never the water or a wall', () => {
  let checked = 0;
  for (const [name, p] of Object.entries(DISTRICT.anchors)) {
    if (!canStand(p.x, p.z, 0.45)) continue;
    const runs = openRuns(p.x, p.z);
    assert.equal(runs.length, FACE_OPEN.dirs);
    const { heading, run } = openHeading(p.x, p.z);
    const max = Math.max(...runs);
    if (max === 0) continue;
    // the chosen ray is open for at least half of the longest one (a wide opening may beat a slightly longer slit)
    assert.ok(run >= max * 0.5, `${name}: run ${run} vs longest ${max}`);
    // and it really is walkable a few metres ahead
    for (const d of [1.4, 2.8].filter(d => d <= run)) assert.ok(canStand(p.x + Math.sin(heading) * d, p.z + Math.cos(heading) * d, FACE_OPEN.radius), `${name}: ${d} u ahead`);
    checked++;
  }
  assert.ok(checked > 20, `${checked} district anchors checked`);
});

test('faceOpen: at a pier end (water on three sides) the player turns back along the pier; ties go to the current heading', () => {
  const end = DISTRICT.anchors['pier7-end'];
  assert.ok(end && canStand(end.x, end.z, 0.45));
  const { heading, run } = openHeading(end.x, end.z);
  assert.ok(run >= 8, `back along the pier (${run} u)`);
  // the pier's axis: back toward its entrance on the Embarcadero
  const entrance = DISTRICT.anchors['pier7-entrance'];
  const toShore = Math.atan2(entrance.x - end.x, entrance.z - end.z);
  assert.ok(Math.abs(wrap(heading - toShore)) < 0.4, `faces back along the pier (${heading.toFixed(2)} vs ${toShore.toFixed(2)})`);
  // nowhere to go (unstandable everywhere): the preferred heading stays
  assert.deepEqual(openHeading(1e5, 1e5, 1.25), { heading: 1.25, run: 0 });
});

test('faceOpen: turns the player standing there and asks the camera to swing behind them (an `open` request that outranks the arrival yaw)', () => {
  const p = runtime.player, a = DISTRICT.anchors['pier7-end'];
  p.x = a.x; p.z = a.z; p.heading = 0;
  takeFaceRequest();
  const h = faceOpen(a.x, a.z);
  assert.equal(p.heading, h);
  const req = takeFaceRequest();
  assert.ok(req && req.open && req.uncapped, 'an open, uncapped camera turn');
  assert.ok(Math.abs(wrap(Math.atan2(req.x - a.x, req.z - a.z) - h)) < 1e-6, 'toward the open side');
  // a player elsewhere is not turned (the caller places them first)
  p.x = a.x + 50; p.heading = 0.3;
  faceOpen(a.x, a.z);
  assert.equal(p.heading, 0.3);
  takeFaceRequest();
});

test('faceOpen at a glide landing (W5-F7): the pelican sets the player down facing the open ground, and the camera is asked to swing behind them', async () => {
  const THREE = await import('three');
  const { game } = await import('../src/opus-bay/core/store');
  const { input } = await import('../src/opus-bay/core/input');
  const { heightAt } = await import('../src/opus-bay/core/terrain');
  const { PlayerController } = await import('../src/opus-bay/actors/controller');
  const { MoveSystem } = await import('../src/opus-bay/actors/moveSystem');
  const moveApi = await import('../src/opus-bay/actors/moveApi');
  const g = globalThis as unknown as Record<string, unknown>;
  g.window ??= globalThis;
  game.set({ phase: 'playing', worldMode: 'district', move: { mode: 'foot' }, riding: null, dialogue: { nodeId: null }, panel: { kind: null } });
  const ms = new MoveSystem(), c = new PlayerController();
  moveApi.bindMoveApi(ms);
  try {
    const gate = DISTRICT.anchors['ferry-gate'], p = runtime.player;
    p.x = gate.x; p.z = gate.z; p.y = heightAt(gate.x, gate.z); p.heading = 0; p.locked = false;
    c.sync();
    ms.setGlideUnlocked(true);
    // fly inland (west, over the Embarcadero) for 2.5 s, then land
    runtime.camera.yaw = Math.PI / 2;
    const yaw = runtime.camera.yaw;
    let t = 0;
    const step = (s: number, until?: () => boolean) => {
      for (let i = 0; i < s * 30; i++) {
        t += 1 / 30;
        ms.update(1 / 30, t, { cameraYaw: yaw, frozen: false, playing: true, controller: c, frustum: new THREE.Frustum() });
        c.step({ dt: 1 / 30, now: t, cameraYaw: yaw, frozen: p.locked, riding: ms.carried });
        ms.finishPlayer();
        if (until?.()) return true;
      }
      return false;
    };
    input.glideCount++;
    step(2.5);
    assert.equal(ms.mode, 'glide');
    takeFaceRequest();
    input.glideCount++;
    assert.ok(step(12, () => ms.mode === 'foot'), 'landed');
    const req = takeFaceRequest();
    assert.ok(req?.open, 'the camera is asked to face the open ground');
    const { heading, run } = openHeading(p.x, p.z, p.heading);
    assert.ok(Math.abs(wrap(p.heading - heading)) < 1e-6 && run > 0, `facing the open ground (${p.heading.toFixed(2)} vs ${heading.toFixed(2)}, run ${run})`);
    for (const d of [1.4, 2.8].filter(d => d <= run)) assert.ok(canStand(p.x + Math.sin(p.heading) * d, p.z + Math.cos(p.heading) * d, FACE_OPEN.radius), `walkable ${d} u ahead`);
  } finally { moveApi.bindMoveApi(null); ms.dispose(); game.set({ phase: 'title', move: { mode: 'foot' } }); }
});

test('faceOpen at a transit hop-off (W5-F7): actors/moveSystem faces the open pavement once the rider has stepped down', async () => {
  const { readFileSync } = await import('node:fs');
  const path = await import('node:path');
  const src = readFileSync(path.resolve(import.meta.dirname, '../src/opus-bay/actors/moveSystem.ts'), 'utf8');
  assert.match(src, /case 'transit-alighted':[\s\S]{0,260}faceOpen\(o\.slot\.x, o\.slot\.z\);/);
  assert.match(src, /c\.sync\(\);\s*\/\/ W5-F7: face the open ground[^\n]*\n\s*faceOpen\(spot\.x, spot\.z\);/);
});

// ---------------------------------------------------------------------------
// W5-F5 forgiving feet: synthetic worlds (plan §4.4 tests: vault never over noVault, never a drop > 0.75 u, never onto
// a roof; pull never across water; slide keeps ≥ 60 % speed along a rail at 30°)
// ---------------------------------------------------------------------------

type TerrainMod = typeof import('../src/opus-bay/core/terrain');
type Blk = import('../src/opus-bay/core/terrain').Blocker;

/** a small made-up city far from the hero slab: flat unless `ground` says otherwise, `land` walkable, `water` wet */
const SX = 5000, SZ = 5000, SR = 60;
interface Synth { ground?: (x: number, z: number) => number; land?: (x: number, z: number) => boolean; water?: (x: number, z: number) => boolean; blockers?: Blk[] }

async function synthWorld(spec: Synth): Promise<TerrainMod> {
  const T = await import('../src/opus-bay/core/terrain');
  const blockers = spec.blockers ?? [];
  const inside = (x: number, z: number) => Math.abs(x - SX) < SR && Math.abs(z - SZ) < SR;
  const wet = (x: number, z: number) => !!spec.water?.(x, z);
  const code = (x: number, z: number) => (inside(x, z) && !wet(x, z) && (spec.land?.(x, z) ?? true) ? 1 : 0);
  const overlap = (b: Blk, x: number, z: number, r: number) => (b.kind === 'circle' ? Math.hypot(x - b.x, z - b.z) < r + b.r : T.distanceToPolygon(x, z, b.polygon) < r);
  const hits = (x: number, z: number, r: number) => blockers.some(b => overlap(b, x, z, r));
  const cellC = (v: number) => (Math.floor(v / 0.5) + 0.5) * 0.5;
  const standC = (x: number, z: number): 0 | 1 => {
    const r = 0.45, o = r * 0.7071;
    if (!code(x, z) || !code(x + r, z) || !code(x - r, z) || !code(x, z + r) || !code(x, z - r) || !code(x + o, z + o) || !code(x - o, z + o) || !code(x + o, z - o) || !code(x - o, z - o)) return 0;
    return hits(x, z, r) ? 0 : 1;
  };
  T.setCityTerrain({
    heightAt: (x, z) => (inside(x, z) ? spec.ground?.(x, z) ?? 0 : null),
    surfaceCode: code,
    kindAt: (x, z) => (!inside(x, z) ? T.KIND.outside : wet(x, z) ? T.KIND.water : T.KIND.land),
    standAt: (x, z) => standC(cellC(x), cellC(z)),
    forEachBlockerNear: (x, z, r, fn) => { for (const b of blockers) if (overlap(b, x, z, r + 0.5)) fn(b); },
    hitsBlocker: hits,
    blockedAt: (x, z) => hits(cellC(x), cellC(z), 0.45),
  });
  return T;
}

const rect = (x0: number, z0: number, x1: number, z1: number, top?: number): Blk => ({ kind: 'polygon', polygon: [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }], ...(top !== undefined ? { top } : {}) });
/** camera yaw that makes the stick's up run along +x */
const YAW_PX = -Math.PI / 2;

async function feetKit() {
  const { PlayerController, WALK_SPEED, RUN_SPEED } = await import('../src/opus-bay/actors/controller');
  const { input } = await import('../src/opus-bay/core/input');
  const feet = await import('../src/opus-bay/actors/feet');
  const deck = await import('../src/opus-bay/actors/deckSteer');
  const { StuckHelper } = await import('../src/opus-bay/actors/stuckHelper');
  const { onEvent } = await import('../src/opus-bay/core/events');
  type C = InstanceType<typeof PlayerController>;
  /** hold the stick (mx, my) for `s` seconds; the stuck helper watches like the actor system does */
  const hold = (c: C, s: number, o: { mx?: number; my?: number; run?: boolean; yaw?: number; helper?: InstanceType<typeof StuckHelper>; t0?: number; reset?: boolean } = {}) => {
    const p = runtime.player, dt = 1 / 60;
    let t = o.t0 ?? 0, reset = !!o.reset;
    let minSpeed = Infinity;
    for (let i = 0; i < s * 60; i++) {
      t += dt;
      runtime.input.moveX = o.mx ?? 0; runtime.input.moveY = o.my ?? 1; runtime.input.run = !!o.run;
      input.manualMove = Math.hypot(o.mx ?? 0, o.my ?? 1) > 0.05;
      const h = o.helper;
      if (h) h.update({ dt, now: t, free: c.grounded && !c.vault, pushing: c.manualWish && input.manualMove, dirX: c.wishX, dirZ: c.wishZ, reset });
      reset = false;
      c.step({ dt, now: t, cameraYaw: o.yaw ?? YAW_PX, frozen: !!h?.active, riding: false });
      if (h?.active) p.y += h.lift();
      minSpeed = Math.min(minSpeed, p.speed);
    }
    runtime.input.moveX = runtime.input.moveY = 0; runtime.input.run = false; input.manualMove = false;
    return { t, minSpeed };
  };
  const place = (c: C, x: number, z: number, heading = Math.PI / 2) => {
    const p = runtime.player;
    p.x = x; p.z = z; p.heading = heading; p.pathTarget = null; p.locked = false;
    c.sync();
  };
  return { PlayerController, WALK_SPEED, RUN_SPEED, feet, deck, StuckHelper, onEvent, hold, place };
}

test('W5-F5 slide along: in a corridor a push 30° into the rail keeps full speed along it; 75° still slides there but stops on open ground', async () => {
  const k = await feetKit();
  // a 3 u corridor along +x (its edges are the walk's own boundary, like a pier's or a deck's)
  let T = await synthWorld({ land: (_x, z) => Math.abs(z - SZ) <= 1.5 });
  try {
    const c = new k.PlayerController();
    // 30° into the +z rail: stick up = +x, right = +z (camera yaw −π/2: right = (cos, −sin) = (0, 1))
    const a30 = (30 * Math.PI) / 180;
    k.place(c, SX - 20, SZ + 1.0);
    k.hold(c, 0.6, { mx: Math.sin(a30), my: Math.cos(a30) });
    const x0 = runtime.player.x;
    k.hold(c, 1.0, { mx: Math.sin(a30), my: Math.cos(a30) });
    const along = runtime.player.x - x0;
    assert.ok(along >= 0.6 * k.WALK_SPEED, `≥ 60 % of the walk speed along the rail at 30° (${along.toFixed(2)} u in 1 s)`);
    assert.ok(along >= 0.95 * k.WALK_SPEED, `in fact full speed (${along.toFixed(2)})`);
    assert.ok(k.feet.corridorAt(runtime.player.x, runtime.player.z, 0, 1), 'the corridor is recognised');
    // 75° into it: the corridor slides on (cos 75° ≈ 0.26 > corridorSlideMin)
    const a75 = (75 * Math.PI) / 180;
    k.place(c, SX - 20, SZ + 1.0);
    k.hold(c, 0.6, { mx: Math.sin(a75), my: Math.cos(a75) });
    const x1 = runtime.player.x;
    k.hold(c, 1.0, { mx: Math.sin(a75), my: Math.cos(a75) });
    assert.ok(runtime.player.x - x1 > 0.6, `a steep push still slides in a corridor (${(runtime.player.x - x1).toFixed(2)} u)`);
  } finally { T.setCityTerrain(null); }
  // open ground: the same wall with 50 u of ground on the other side — 75° presses (the old rule)
  T = await synthWorld({ land: (_x, z) => z <= SZ + 1.5 });
  try {
    const c = new k.PlayerController();
    const a75 = (75 * Math.PI) / 180;
    k.place(c, SX - 20, SZ + 1.0);
    k.hold(c, 0.6, { mx: Math.sin(a75), my: Math.cos(a75) });
    const x1 = runtime.player.x;
    k.hold(c, 1.0, { mx: Math.sin(a75), my: Math.cos(a75) });
    assert.ok(runtime.player.x - x1 < 0.3, `open ground: a 75° push leans on the wall (${(runtime.player.x - x1).toFixed(2)} u)`);
    assert.equal(k.feet.corridorAt(runtime.player.x, runtime.player.z, 0, 1), false);
  } finally { T.setCityTerrain(null); }
});

test('W5-F5 auto-vault: running into a low wall with a measured top hops over it (0.35 s); walking into it, an unknown top or a tall one does not', async () => {
  const k = await feetKit();
  const wall = (top?: number) => rect(SX + 3, SZ - 10, SX + 3.3, SZ + 10, top);
  let T = await synthWorld({ blockers: [wall(0.8)] });
  try {
    const c = new k.PlayerController();
    k.place(c, SX, SZ);
    k.hold(c, 1.6, { run: true });
    assert.equal(c.vaults, 1, 'one vault');
    assert.ok(runtime.player.x > SX + 4, `over the wall (${runtime.player.x.toFixed(2)})`);
    assert.ok(T.canStand(runtime.player.x, runtime.player.z, 0.45), 'standing on open ground beyond');
    // walking into it: no vault
    k.place(c, SX, SZ); c.vaults = 0;
    k.hold(c, 1.6, { run: false });
    assert.equal(c.vaults, 0);
    assert.ok(runtime.player.x < SX + 3, 'walking stops at the wall');
    // a jump into it vaults too
    k.place(c, SX + 1.5, SZ); c.vaults = 0;
    runtime.input.jump = true;
    k.hold(c, 1.2, { run: false });
    assert.equal(c.vaults, 1, 'a jump into it vaults');
  } finally { T.setCityTerrain(null); }
  for (const top of [undefined, 1.3]) {
    T = await synthWorld({ blockers: [wall(top)] });
    try {
      const c = new k.PlayerController();
      k.place(c, SX, SZ);
      k.hold(c, 1.6, { run: true });
      assert.equal(c.vaults, 0, `no vault over a wall with top ${top}`);
      assert.ok(runtime.player.x < SX + 3, 'stopped at the wall');
      assert.equal(k.feet.vaultPlan(SX + 2.5, SZ, 0, 1, 0), null);
    } finally { T.setCityTerrain(null); }
  }
});

test('W5-F5 auto-vault guards: never a drop > 0.75 u, never up onto a roof or a terrace, never over water or to a cliff edge, never in a noVault area or on a deck', async () => {
  const k = await feetKit();
  const wall = rect(SX + 3, SZ - 10, SX + 3.3, SZ + 10, 0.8);
  const plan = () => k.feet.vaultPlan(SX + 2.5, SZ, 0, 1, 0);
  const cases: [string, Synth, boolean][] = [
    ['flat beyond', { blockers: [wall] }, true],
    ['0.5 u lower beyond', { blockers: [wall], ground: x => (x > SX + 3.15 ? -0.5 : 0) }, true],
    ['1 u lower beyond (a drop)', { blockers: [wall], ground: x => (x > SX + 3.15 ? -1 : 0) }, false],
    ['a building right behind it (a roof)', { blockers: [wall, rect(SX + 3.3, SZ - 10, SX + 12, SZ + 10, 6)] }, false],
    ['a terrace 1 u higher beyond', { blockers: [wall], ground: x => (x > SX + 3.15 ? 1 : 0) }, false],
    ['water beyond', { blockers: [wall], water: x => x > SX + 3.4 && x < SX + 8 }, false],
    ['a cliff 1.5 u beyond', { blockers: [wall], ground: x => (x > SX + 5 ? -3 : 0) }, false],
  ];
  for (const [name, spec, ok] of cases) {
    const T = await synthWorld(spec);
    try {
      const v = plan();
      assert.equal(!!v, ok, `${name}: ${v ? `vaults to ${v.x.toFixed(2)}` : 'no vault'}`);
      if (v) {
        assert.ok(T.canStand(v.x, v.z, 0.45), `${name}: lands on standable ground`);
        assert.ok(v.y >= -0.75 && v.y <= 0.6, `${name}: lands within the step limits`);
        assert.ok(v.x - (SX + 3.3) <= k.feet.FEET.vaultReach + 1e-6, `${name}: within 1.6 u beyond`);
      }
    } finally { T.setCityTerrain(null); }
  }
  // a noVault area, and a registered deck
  const T = await synthWorld({ blockers: [wall] });
  try {
    k.feet.registerNoVault('test-cliff-path', [[{ x: SX - 5, z: SZ - 5 }, { x: SX + 10, z: SZ - 5 }, { x: SX + 10, z: SZ + 5 }, { x: SX - 5, z: SZ + 5 }]]);
    assert.equal(plan(), null, 'noVault area');
    k.feet.registerNoVault('test-cliff-path', null);
    assert.ok(plan(), 'vaults again once the area is gone');
    k.deck.registerDeck('test-deck', { id: 'test-deck', x: SX - 10, z: SZ, heading: Math.PI / 2, length: 30, half: 2.6, y: 0 });
    assert.equal(plan(), null, 'a bridge deck: its rails are never vaulted');
    // and the controller running into it on the deck does not vault
    const c = new k.PlayerController();
    k.place(c, SX, SZ);
    k.hold(c, 1.6, { run: true });
    assert.equal(c.vaults, 0);
  } finally { k.deck.registerDeck('test-deck', null); T.setCityTerrain(null); }
});

test('W5-F5 BAYBAY pull: 1.2 s of pushing into a lip the feet refuse → pulled ≤ 4 u onto the ground beyond, a stuck { what: pull } event; never across water or a wall', async () => {
  const k = await feetKit();
  const seen: { what: string; x: number; z: number }[] = [];
  const off = k.onEvent(e => { if (e.type === 'stuck') seen.push({ what: e.what, x: e.x, z: e.z }); });
  // a 0.7 u lip (not a flight of stairs): higher than MAX_RISE, the walk refuses it
  let T = await synthWorld({ ground: x => (x >= SX + 3 ? 0.7 : 0) });
  try {
    const c = new k.PlayerController(), h = new k.StuckHelper();
    k.place(c, SX, SZ);
    k.hold(c, 1.0, { helper: h });
    assert.ok(runtime.player.x < SX + 3 && h.count === 0, 'stuck at the lip, no pull yet');
    k.hold(c, 2.2, { helper: h, t0: 1 });
    assert.equal(h.count, 1, 'one pull');
    assert.ok(runtime.player.x >= SX + 3.2 && Math.abs(runtime.player.y - 0.7) < 0.05, `up on the ground beyond (${runtime.player.x.toFixed(2)}, y ${runtime.player.y.toFixed(2)})`);
    const r = h.pulls[0];
    assert.ok(Math.hypot(r.tx - r.x, r.tz - r.z) <= k.feet.FEET.pullReach + 1e-6, 'at most 4 u');
    assert.ok(seen.some(e => e.what === 'pull'), 'stuck { what: pull } emitted');
  } finally { T.setCityTerrain(null); }
  // water between: pushing at the quay edge never pulls across
  T = await synthWorld({ water: x => x > SX + 3 && x < SX + 4.2 });
  try {
    const c = new k.PlayerController(), h = new k.StuckHelper();
    k.place(c, SX, SZ);
    k.hold(c, 4, { helper: h });
    assert.equal(h.count, 0, 'never across water');
    assert.equal(k.feet.pullTarget(SX + 2.5, SZ, 0, 1, 0), null);
  } finally { T.setCityTerrain(null); }
  // a wall (no measured top) with ground behind: never through it (and no vault)
  T = await synthWorld({ blockers: [rect(SX + 3, SZ - 10, SX + 3.2, SZ + 10)] });
  try {
    const c = new k.PlayerController(), h = new k.StuckHelper();
    k.place(c, SX, SZ);
    k.hold(c, 4, { helper: h, run: true });
    assert.equal(h.count, 0, 'never through a wall');
    assert.equal(c.vaults, 0);
    assert.ok(runtime.player.x < SX + 3);
  } finally { T.setCityTerrain(null); off(); }
});

// ---------------------------------------------------------------------------
// W5-F6 the Golden Gate Bridge deck (the published city on disk)
// ---------------------------------------------------------------------------

async function ggbCity() {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { SF_LANDMARKS } = await import('../src/opus-bay/world/sf/landmarks/index');
  const T = await import('../src/opus-bay/core/terrain');
  const camera = await import('../src/opus-bay/actors/camera');
  const deck = await import('../src/opus-bay/actors/deckSteer');
  await camera.loadCityViews();
  const ggb = deck.decks().find(d => d.id === 'golden-gate-bridge');
  assert.ok(ggb, 'the city camera data registers the Golden Gate Bridge deck');
  const sf = sfDisk(), LMS = landmarkWalkInputs(SF_LANDMARKS);
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  for (let s = -40; s <= ggb.length + 40; s += 60) { const q = deck.deckPoint(ggb, s, 0); await sf.attachAround(city, q.x, q.z, 90, LMS); }
  T.setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  return { T, camera, deck, ggb };
}

test('W5-F6 the GGB deck: its footprint matches the walk (lanes standable between the rails, not beyond), the tower legs block the sidewalks, and it is never vaulted', async () => {
  const { T, deck, ggb } = await ggbCity();
  const { vaultPlan } = await import('../src/opus-bay/actors/feet');
  try {
    let lanes = 0, legs = 0;
    for (let s = 5; s < ggb.length - 5; s += 7) {
      // (the walk raster is 0.5 u cells across a deck that runs at an angle: its edge is ragged near the rails, so the
      // lanes checked here keep 1 u off them)
      for (const l of [-1.6, 0, 1.6]) {
        const q = deck.deckPoint(ggb, s, l);
        const at = deck.deckAt(q.x, q.z);
        assert.ok(at && Math.abs(at.s - s) < 1e-6 && Math.abs(at.l - l) < 1e-6, `deckAt round trip at s ${s}`);
        if (T.canStand(q.x, q.z, 0.45)) lanes++;
      }
      // (past the ends the Presidio bluff and the Marin side come back up to the deck: beside it there is ground)
      if (s > 30 && s < ggb.length - 30) for (const l of [-(ggb.half + 1.2), ggb.half + 1.2]) { const q = deck.deckPoint(ggb, s, l); assert.equal(T.canStand(q.x, q.z, 0.45) && Math.abs(T.heightAt(q.x, q.z) - ggb.y) < 1, false, `nothing to stand on beyond the rail at s ${s}`); }
    }
    const stations = Math.ceil((ggb.length - 10) / 7) * 3;
    assert.ok(lanes >= stations * 0.9, `the deck's lanes are standable (${lanes} of ${stations})`);
    // the towers' legs stand across the sidewalks: the lane at 2.1 is blocked there, the road between the legs is clear
    for (const sx of [-89.29, 89.29]) {
      const s = sx - -230;
      for (const l of [-1.6, 1.6]) { const q = deck.deckPoint(ggb, s, l); if (!T.canStand(q.x, q.z, 0.45)) legs++; }
      const mid = deck.deckPoint(ggb, s, 0);
      assert.ok(T.canStand(mid.x, mid.z, 0.45), 'the road passes between the legs');
    }
    assert.equal(legs, 4, 'four legs block the sidewalk lanes');
    // the rails (top 0.8 above the deck) are never vaulted
    const q = deck.deckPoint(ggb, 100, ggb.half - 0.5);
    const right = { x: Math.cos(ggb.heading), z: -Math.sin(ggb.heading) };
    assert.equal(vaultPlan(q.x, q.z, ggb.y, right.x, right.z), null);
  } finally { T.setCityTerrain(null); }
});

test('W5-F6 the GGB deck walk: holding forward from the south end to the north end (the camera starting 83° across) never drops under 3 u/s over any 3 s, the camera stays within 25° of the axis, round both towers; back south running', async () => {
  const { T, camera, deck, ggb } = await ggbCity();
  const THREE = await import('three');
  const { game } = await import('../src/opus-bay/core/store');
  const { input } = await import('../src/opus-bay/core/input');
  const { view, moveBasis } = await import('../src/opus-bay/actors/view');
  const { PlayerController } = await import('../src/opus-bay/actors/controller');
  const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  game.set({ worldMode: 'city', phase: 'playing' });
  try {
    const walkDeck = (from: number, to: number, run: boolean, lane: number) => {
      const c = new PlayerController(), p = runtime.player;
      const dir = to > from ? 1 : -1;
      const q = deck.deckPoint(ggb, from, lane);
      p.x = q.x; p.z = q.z; p.heading = ggb.heading + (dir > 0 ? 0 : Math.PI); p.locked = false; p.pathTarget = null;
      c.sync();
      const cam = new THREE.PerspectiveCamera(42, 1440 / 900, 0.5, 4000);
      const rig = new camera.CameraController();
      const put = () => Object.assign(view, { x: p.x, y: p.y, z: p.z, ground: T.heightAt(p.x, p.z), vx: c.vx, vz: c.vz, heading: p.heading, ready: true });
      put();
      const dt = 1 / 30;
      let t = 0;
      for (let i = 0; i < 10; i++) { t += dt; rig.update(cam, dt, t, 900, 1440); }
      // the run-1 failure: the camera 83° across the deck at the start
      rig.yaw = deckCameraYaw(dir) + (83 * Math.PI) / 180;
      const trace: { t: number; s: number }[] = [];
      let worstYaw = 0, worst3 = Infinity;
      for (let i = 0; i < 200 / dt; i++) {
        t += dt;
        runtime.input.moveX = 0; runtime.input.moveY = 1; runtime.input.run = run; input.manualMove = true;
        c.step({ dt, now: t, cameraYaw: moveBasis.yaw, frozen: false, riding: false });
        put();
        rig.update(cam, dt, t, 900, 1440);
        const at = deck.deckAt(p.x, p.z);
        assert.ok(at, `still on the deck at t ${t.toFixed(1)}`);
        trace.push({ t, s: at.s });
        if (t > 1.5) worstYaw = Math.max(worstYaw, Math.abs(wrapA(runtime.camera.yaw - deckCameraYaw(dir))));
        const back = trace.find(e => e.t >= t - 3 - 1e-6);
        if (t >= 3 && back) worst3 = Math.min(worst3, ((at.s - back.s) * dir) / (t - back.t));
        if ((at.s - to) * dir >= 0) break;
      }
      runtime.input.moveY = 0; runtime.input.run = false; input.manualMove = false;
      rig.dispose();
      const end = trace[trace.length - 1];
      return { reached: (end.s - to) * dir >= 0, worstYaw, worst3, t, s: end.s };
    };
    const deckCameraYaw = (dir: number) => deck.deckCameraYaw(ggb, dir);
    // south → north on the east sidewalk (the lane the tower legs block), walking
    const sn = walkDeck(3, ggb.length - 3, false, 2.1);
    assert.ok(sn.reached, `reached the north end (s ${sn.s.toFixed(1)} of ${ggb.length.toFixed(1)} after ${sn.t.toFixed(0)} s)`);
    assert.ok(sn.worst3 >= 3, `never under 3 u/s over 3 s (worst ${sn.worst3.toFixed(2)})`);
    assert.ok(sn.worstYaw <= (25 * Math.PI) / 180, `camera within 25° of the axis (worst ${(sn.worstYaw * 180 / Math.PI).toFixed(1)}°)`);
    // north → south on the west sidewalk, running
    const ns = walkDeck(ggb.length - 3, 3, true, -2.1);
    assert.ok(ns.reached, `reached the south end (s ${ns.s.toFixed(1)})`);
    assert.ok(ns.worst3 >= 3, `never under 3 u/s over 3 s (worst ${ns.worst3.toFixed(2)})`);
    assert.ok(ns.worstYaw <= (25 * Math.PI) / 180, `camera within 25° (worst ${(ns.worstYaw * 180 / Math.PI).toFixed(1)}°)`);
  } finally { T.setCityTerrain(null); game.set({ worldMode: 'district', phase: 'title' }); }
});

test('W5-F6 camera rules on the deck: chooseYaw lines up with the axis (behind the player), the towers\' hero points are relaxed there only', async () => {
  const { T, camera, deck, ggb } = await ggbCity();
  const { game } = await import('../src/opus-bay/core/store');
  const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  game.set({ worldMode: 'city', phase: 'playing' });
  try {
    const q = deck.deckPoint(ggb, 60, 0);
    // walking north (heading = the axis): behind = heading + π
    const yaw = camera.chooseYaw(q.x, q.z, ggb.heading + Math.PI, 15);
    assert.ok(Math.abs(wrapA(yaw - deck.deckCameraYaw(ggb, 1))) < 1e-6, 'behind the player, along the axis');
    const back = camera.chooseYaw(q.x, q.z, ggb.heading, 15);
    assert.ok(Math.abs(wrapA(back - deck.deckCameraYaw(ggb, -1))) < 1e-6, 'facing south: the other alignment');
    // the south tower sits on the line from a camera behind a player walking north just short of it: relaxed on the deck
    const near = deck.deckPoint(ggb, -89.29 + 230 + 6, 0);
    assert.ok(camera.heroPoints().some(h => h.id === 'ggb-tower-s'));
    assert.equal(camera.heroClear(near.x, near.z, deck.deckCameraYaw(ggb, 1), 15), true, 'on the deck the tower does not count');
    assert.equal(deck.heroRelaxed('ggb-tower-s', near.x, near.z), true);
    // off the deck (the beach below, Fort Point) it still does
    const below = deck.deckPoint(ggb, 80, 0);
    assert.equal(deck.heroRelaxed('ggb-tower-s', below.x, below.z + 0), deck.deckAt(below.x, below.z) !== null);
    assert.equal(deck.deckAt(q.x, q.z, 2), null, 'the ground far below the deck is not the deck');
  } finally { T.setCityTerrain(null); game.set({ worldMode: 'district', phase: 'title' }); }
});

test('W5-F5 the Ocean Beach fire rings are a noVault area once the city camera data loads (they burn in season: plan D22)', async () => {
  const camera = await import('../src/opus-bay/actors/camera');
  const { noVaultAt } = await import('../src/opus-bay/actors/feet');
  const { oceanBeachFireRings } = await import('../src/opus-bay/world/sf/landmarks/ocean-beach-fire-rings');
  await camera.loadCityViews();
  const ex = oceanBeachFireRings.exclude;
  assert.ok(ex && 'poly' in ex);
  const c = ex.poly.reduce((a, p) => ({ x: a.x + p.x / ex.poly.length, z: a.z + p.z / ex.poly.length }), { x: 0, z: 0 });
  assert.equal(noVaultAt(c.x, c.z), true);
  assert.equal(noVaultAt(c.x + 200, c.z + 200), false);
});

test('W5-F5 R: boxed in (a pit the feet cannot climb out of), R pulls the player out at once toward the open ground; standing free, R pulls nobody', async () => {
  const k = await feetKit();
  const T = await synthWorld({ ground: (x, z) => (Math.abs(x - SX) <= 0.6 && Math.abs(z - SZ) <= 0.6 ? 0 : 0.7) });
  try {
    const c = new k.PlayerController(), h = new k.StuckHelper();
    k.place(c, SX, SZ);
    k.hold(c, 0.2, { helper: h, mx: 0, my: 0, reset: true });
    assert.equal(h.count, 1, 'R pulled');
    assert.equal(h.pulls[0].reason, 'reset');
    k.hold(c, 1.2, { helper: h, mx: 0, my: 0, t0: 0.2 });
    assert.ok(Math.abs(runtime.player.y - 0.7) < 0.05, `out of the pit (y ${runtime.player.y.toFixed(2)})`);
    // free on flat ground: R is only the camera's reset
    const h2 = new k.StuckHelper();
    k.place(c, SX + 10, SZ);
    k.hold(c, 0.2, { helper: h2, mx: 0, my: 0, reset: true });
    assert.equal(h2.count, 0);
  } finally { T.setCityTerrain(null); }
});
