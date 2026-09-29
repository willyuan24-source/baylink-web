import assert from 'node:assert/strict';
import test from 'node:test';

// Wave 6 · lane H: the Halloween world — the stoops dressed across the residential city, BAYBAY's fixed lines, the
// pumpkin hunt (spots on the published city's walking network, finds paid by lane E's real ledger), the phases.

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const zhLen = (s: string) => [...s].length;
const hasZh = (s: string) => /[一-鿿]/.test(s);

const { onEvent } = await import('../src/opus-bay/core/events');
type GameEvent = import('../src/opus-bay/core/events').GameEvent;
const { runtime } = await import('../src/opus-bay/core/runtime');
const { clearSave } = await import('../src/opus-bay/data/save');
const ledger = await import('../src/opus-bay/economy/ledger');
const { Batch } = await import('../src/opus-bay/world/builder');
const { HALLOWEEN_REWARD_IDS, halloweenSource, registerHalloweenRewards } = await import('../src/opus-bay/halloween/rewards');
const WL = await import('../src/opus-bay/halloween/worldLines');
const WS = await import('../src/opus-bay/halloween/worldSpots');
const WD = await import('../src/opus-bay/halloween/worldDress');
const HP = await import('../src/opus-bay/halloween/huntPlaces');
const HS = await import('../src/opus-bay/halloween/huntSpots');
const HU = await import('../src/opus-bay/halloween/hunt');
const { phaseWants } = await import('../src/opus-bay/halloween/world');
const { HALLOWEEN_SPOTS } = await import('../src/opus-bay/realsf/dressing');
const { PEBBLES } = await import('../src/opus-bay/eggs/pebbleSpots');

test('W6-H lines: one table of fixed zh + en lines (lane X records them by text), short, unique ids', () => {
  const ids = new Set<string>();
  for (const l of WL.ALL_WORLD_LINES) {
    assert.match(l.id, /^w6-h-[a-z0-9-]+$/, l.id);
    assert.ok(!ids.has(l.id), `${l.id} unique`);
    ids.add(l.id);
    assert.ok(hasZh(l.zh) && !hasZh(l.en) && l.en.trim().length > 0, `${l.id}: bilingual`);
    assert.ok(zhLen(l.zh) <= 45, `${l.id}: ≤ 45 zh characters`);
    assert.doesNotMatch(l.zh + l.en, /\$\{|undefined|NaN/, `${l.id}: fixed text`);
  }
  assert.ok(WL.ALL_WORLD_LINES.length >= 15);
  assert.deepEqual(WL.lineText('huntAll'), { zh: WL.HALLOWEEN_WORLD_LINES.huntAll.zh, en: WL.HALLOWEEN_WORLD_LINES.huntAll.en });
});

test('W6-H1 stoops: ≈ 2 000 doorsteps across the seven dressed neighbourhoods, spaced, decoded exactly', () => {
  const n = WD.stoopCount();
  assert.equal(WS.STOOPS.length % WS.STOOP_STRIDE, 0);
  assert.ok(n >= 1500 && n <= 2600, `${n} stoops`);
  const per: number[] = WS.DRESS_ZONES.map(() => 0);
  for (let i = 0; i < n; i++) {
    const s = WD.stoopAt(i);
    assert.ok(s.zone >= 0 && s.zone < WS.DRESS_ZONES.length);
    per[s.zone]++;
    assert.ok(Number.isFinite(s.x + s.z + s.y + s.f));
  }
  // every neighbourhood of the brief has its share (Alamo Square is Western Addition / Hayes Valley)
  for (const [k, z] of WS.DRESS_ZONES.entries()) assert.ok(per[k] >= 100, `${z}: ${per[k]}`);
  for (const z of ['western-addition', 'haight-ashbury', 'noe-valley', 'pacific-heights', 'mission', 'castro-upper-market']) assert.ok((WS.DRESS_ZONES as readonly string[]).includes(z), z);
  // spaced (a grid check over all pairs in a cell and its neighbours) and clear of lane R's Waller St / Painted Ladies
  const ix = WD.stoopIndex();
  for (const [, list] of ix) for (const i of list) {
    const s = WD.stoopAt(i);
    const near = WD.nearestStoop(s.x, s.z, 2.5, j => j !== i);
    assert.equal(near, null, `stoop ${i} has a neighbour within 2.5 u`);
    assert.ok(HALLOWEEN_SPOTS.every(r => Math.hypot(r.x - s.x, r.z - s.z) >= 10), `stoop ${i} clear of lane R's spots`);
  }
});

test('W6-H1 stoops: the decorations stay cheap — ≈ 100 triangles a stoop, halos for the faces and lanterns, a few trick-or-treaters', () => {
  let tris = 0, halos = 0, figs = 0;
  const n = WD.stoopCount();
  for (let i = 0; i < n; i++) {
    const b = new Batch();
    const h: import('../src/opus-bay/halloween/worldHalos').HaloSpot[] = [];
    WD.addStoop(b, WD.stoopAt(i), h, true);
    const t = b.idx.length / 3;
    assert.ok(t <= 460, `stoop ${i}: ${t} triangles`);
    tris += t; halos += h.length;
    if (WD.stoopFigure(i) >= 0) figs++;
    assert.ok(h.length >= 1 && h.length <= 2, `stoop ${i}: a face (and a lantern)`);
  }
  assert.ok(tris / n <= 115, `avg ${(tris / n).toFixed(1)} triangles a stoop`);
  assert.ok(figs >= 60 && figs <= 220, `${figs} trick-or-treaters`);
  // the variant of a stoop never changes between builds
  const a = new Batch(), b = new Batch();
  WD.addStoop(a, WD.stoopAt(42), [], true); WD.addStoop(b, WD.stoopAt(42), [], true);
  assert.deepEqual(a.pos, b.pos);
  // a whole cell: built as typed arrays, its halos equal the geometry-free halo pass
  const [key] = [...WD.stoopIndex().entries()].sort((x, y) => y[1].length - x[1].length)[0];
  const cell = WD.buildCell(key, true);
  assert.equal(cell.idx.length % 3, 0);
  assert.equal(WD.cellHalos(key).length, cell.halos.length);
  // the worst 100 u disc stays under the ceiling the runtime keeps anyway
  assert.ok(WD.DRESS_TRIS_MAX <= 24_000 && WD.DRESS_NEAR.high <= 100);
  assert.ok(halos / n >= 1);
});

test('W6-H phases: the season and the big night dress everything; Día de los Muertos keeps the pumpkins and the hunt; off builds nothing', () => {
  assert.deepEqual(phaseWants('season'), { stoops: true, figures: true, bats: true, hunt: true });
  assert.deepEqual(phaseWants('night'), { stoops: true, figures: true, bats: true, hunt: true });
  assert.deepEqual(phaseWants('muertos'), { stoops: true, figures: false, bats: false, hunt: true });
  assert.deepEqual(phaseWants('off'), { stoops: false, figures: false, bats: false, hunt: false });
});

test('W6-H2 hunt places: 40 lanterns, numbered 1…40 once each, named in both languages, every reward id exists', () => {
  assert.equal(HP.HUNT_PLACES.length, 40);
  assert.equal(HS.HUNT_XZ.length, 40);
  assert.deepEqual(HP.HUNT_PLACES.map(p => p.n).sort((a, b) => a - b), Array.from({ length: 40 }, (_, i) => i + 1));
  for (const p of HP.HUNT_PLACES) {
    assert.ok(hasZh(p.near.zh) && !hasZh(p.near.en) && zhLen(p.near.zh) <= 14, `${p.n} near`);
    assert.ok(HALLOWEEN_REWARD_IDS.includes(`pumpkin:${p.n}`));
    assert.equal(halloweenSource(`pumpkin:${p.n}`), `halloween:pumpkin:${p.n}`);
    assert.ok(HS.HUNT_XZ.some(s => s.n === p.n), `${p.n} placed`);
  }
  for (const m of HU.MILESTONES) assert.ok(HALLOWEEN_REWARD_IDS.includes(m.id), m.id);
  assert.equal(HU.pumpkinTotal(), 40);
  // spread out: ≥ 30 u from each other, ≥ 12 u from every pebble (two finds never share a step)
  for (const s of HS.HUNT_XZ) {
    for (const o of HS.HUNT_XZ) if (o !== s) assert.ok(Math.hypot(o.x - s.x, o.z - s.z) >= 30, `${s.n} / ${o.n}`);
    for (const q of PEBBLES) assert.ok(Math.hypot(q.x - s.x, q.z - s.z) >= 12, `${s.n} / pebble ${q.id}`);
  }
});

test('W6-H2 hunt spots on the published city: every lantern stands on walkable ground off the roadway, next to the walking graph\'s main component; the trick-or-treaters stand off the roadway', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { canStand, isWater, setCityTerrain, surfaceAt, heightAt } = await import('../src/opus-bay/core/terrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  for (const s of HS.HUNT_XZ) await sf.attachAround(city, s.x, s.z, 12, lms);
  // a sample of the stoops with a trick-or-treater (every 3rd), and every 25th stoop
  const figs: { x: number; z: number; i: number }[] = [];
  const stoops: number[] = [];
  for (let i = 0; i < WD.stoopCount(); i++) {
    if (i % 25 === 0) stoops.push(i);
    if (WD.stoopFigure(i) < 0 || figs.length > 60) continue;
    const s = WD.stoopAt(i);
    const fx = Math.sin(s.f), fz = Math.cos(s.f), sx = Math.cos(s.f), sz = -Math.sin(s.f);
    const k = s.fig === 2 ? 1 : -1;
    figs.push({ x: s.x + sx * k + fx * 0.05, z: s.z + sz * k + fz * 0.05, i });
  }
  for (const f of figs) await sf.attachAround(city, f.x, f.z, 4, lms);
  for (const i of stoops) { const s = WD.stoopAt(i); await sf.attachAround(city, s.x, s.z, 4, lms); }
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    const ix = await sf.graphIndex();
    const main = ix.mainComponent();
    for (const s of HS.HUNT_XZ) {
      assert.ok(canStand(s.x, s.z, 0.4), `lantern ${s.n}: (${s.x}, ${s.z}) standable`);
      assert.ok(!isWater(s.x, s.z) && surfaceAt(s.x, s.z) !== 'road', `lantern ${s.n}: off the water and the roadway`);
      assert.ok(ix.nearestNode(s.x, s.z, 14, i => ix.component(i) === main) >= 0, `lantern ${s.n}: the main walking graph within 14 u`);
      assert.ok(Math.abs(heightAt(s.x, s.z) - s.y) < 0.6, `lantern ${s.n}: its baked ground y`);
    }
    for (const i of stoops) {
      const s = WD.stoopAt(i);
      assert.ok(surfaceAt(s.x, s.z) !== 'road', `stoop ${i}: off the roadway`);
      assert.ok(Math.abs(heightAt(s.x, s.z) - s.y) < 0.6, `stoop ${i}: its baked ground y`);
    }
    const onRoad = figs.filter(f => surfaceAt(f.x, f.z) === 'road');
    assert.deepEqual(onRoad.map(f => f.i), [], 'no trick-or-treater on the roadway');
  } finally { setCityTerrain(null); }
});

test('W6-H2 the hunt on lane E\'s real ledger: a find chimes, toasts, emits the halloween event and pays pumpkin:n once; 10 / 20 / 40 pay the milestones', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const events: GameEvent[] = [];
  const offEv = onEvent(e => { if (e.type === 'halloween' || e.type === 'reward' || e.type === 'coins') events.push(e); });
  const offs = [ledger.initLedger(), registerHalloweenRewards()];
  clearSave();
  HU.__resetHuntForTests();
  runtime.move.mode = 'foot';
  try {
    assert.equal(HU.pumpkinsFound(), 0);
    let changed = 0;
    const offCh = HU.onHuntChange(() => { changed++; });
    assert.equal(HU.pickPumpkin(7), true);
    assert.equal(HU.pickPumpkin(7), false, 'once');
    assert.equal(HU.pumpkinFound(7), true);
    assert.ok(events.some(e => e.type === 'halloween' && e.what === 'pumpkin' && e.id === 'pumpkin:7'));
    assert.ok(events.some(e => e.type === 'reward' && e.source === 'halloween:pumpkin:7' && e.coins === HU.HUNT_COINS));
    assert.ok(ledger.isPaid('halloween:pumpkin:7'), 'the ledger paid it');
    assert.equal(changed, 1);
    for (let n = 1; n <= 40; n++) HU.pickPumpkin(n);
    assert.equal(HU.pumpkinsFound(), 40);
    for (const id of ['hunt:10', 'hunt:20', 'hunt:all']) assert.ok(ledger.isPaid(`halloween:${id}`), id);
    assert.equal(events.filter(e => e.type === 'reward' && e.source.startsWith('halloween:hunt:')).length, 3, 'each milestone once');
    assert.ok(HU.huntList().every(h => h.found));
    offCh();
  } finally {
    offEv(); for (const o of offs) o();
    clearSave(); HU.__resetHuntForTests();
  }
});
