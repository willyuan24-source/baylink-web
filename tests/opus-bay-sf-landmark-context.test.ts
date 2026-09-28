import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { terrainGlideWorld } from '../src/opus-bay/actors/glide';
import { type LandmarkWalkInput, createCityTerrain, landmarkWalkInputs } from '../src/opus-bay/core/sfTerrain';
import { ASSETS } from '../src/opus-bay/data/assets';
import { sfLandmarkInfo } from '../src/opus-bay/data/sf/landmarks';
import type { SfManifest } from '../src/opus-bay/world/sf/format';
import { TALL_MARGIN, landmarkTallStructures } from '../src/opus-bay/world/sf/landmarks/context';
import { TURNTABLE, setTurntableSpinner, turntableSpinner } from '../src/opus-bay/world/sf/landmarks/cable-car-turntable';
import { GGB } from '../src/opus-bay/world/sf/landmarks/golden-gate-bridge';
import { SF_LANDMARKS, SF_SITES, type SfLandmark, blockerTops, buildLandmark, landmarkToWorld, landmarkWalkWorld, sfLandmark, tallParts, usesAi, worldToLandmark } from '../src/opus-bay/world/sf/landmarks/index';
import { LANDMARK_TOPS } from '../src/opus-bay/world/sf/landmarks/tops';
import { w4Site } from '../src/opus-bay/world/sf/landmarks/w4sites';
import { U } from '../src/opus-bay/world/materials';
import { CitySites, LOD0, LOD0_HIGH, SITE_CAM_H, siteLod0Radius } from '../src/opus-bay/world/sf/sites';
import { type GlbMesh, readGlbMesh } from '../scripts/opus-sf/assets/glbNode';
import { measureTops } from '../scripts/opus-sf/assets/topsMeasure';

/**
 * Lane D2, wave 3: landmarks in their city context. D2-10 = blocker tops and tall structures (the pelican glide's
 * obstacles, E2's moveSystem reads landmarkTallStructures; the terrain provider's Blocker.top).
 */

const PUBLIC = path.resolve(import.meta.dirname, '../public');
const glbCache = new Map<string, Promise<GlbMesh>>();
async function modelsFor(l: SfLandmark): Promise<Map<string, GlbMesh>> {
  const out = new Map<string, GlbMesh>();
  if (!usesAi(l)) return out;
  for (const p of l.swap!.parts) {
    if (!glbCache.has(p.model)) glbCache.set(p.model, readGlbMesh(ASSETS.models[p.model].url, PUBLIC));
    out.set(p.model, await glbCache.get(p.model)!);
  }
  return out;
}
const byId = (id: string) => sfLandmark(id)!;
const tallOf = (id: string) => tallParts(byId(id));

test('D2-10: landmarks/tops.ts is the measurement of the drawn lod 0 of every site (re-run scripts/opus-sf/assets/landmark-tops.ts)', async () => {
  for (const l of SF_SITES) {
    const row = LANDMARK_TOPS[l.id];
    assert.ok(row, `${l.id}: a row in tops.ts (a new site: re-run npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/assets/landmark-tops.ts)`);
    const m = measureTops(l, await modelsFor(l));
    assert.deepEqual([...row.blockers], m.blockers, `${l.id}: blocker tops`);
    assert.deepEqual([...row.tall], m.tall, `${l.id}: tall-part tops`);
    assert.equal(blockerTops(l).length, l.walk?.blockers.length ?? 0);
    assert.ok(blockerTops(l).every(t => t !== undefined && Number.isFinite(t) && t > 0), `${l.id}: every blocker has a top`);
  }
});

test('D2-10: the tall parts the brief names (GGB legs, Sutro r ≈ 6, City Hall dome, rotunda, Grace, de Young, Oracle, Legion, windmill)', () => {
  // the Golden Gate Bridge: four legs up to the tower crown (42.2 u + the aviation light), the cables anchorage to
  // anchorage at the drawn heights (saddles ≈ 42, mid-span ≈ 16.3)
  const ggb = tallOf('golden-gate-bridge');
  const legs = ggb.filter(t => Math.abs(Math.abs(t.x) - GGB.TOWER) < 0.01 && t.z !== 0);
  assert.equal(legs.length, 4);
  for (const t of legs) assert.ok(t.top >= GGB.TOP && t.top <= GGB.TOP + 0.5 && t.r >= 1.2, `leg ${t.x}, ${t.z}: top ${t.top}`);
  const cables = ggb.filter(t => t.z === 0);
  assert.ok(cables[0].x <= GGB.ANCH_S + 0.01 && cables[cables.length - 1].x >= GGB.ANCH_N - 0.01, 'cables from anchorage to anchorage');
  for (let i = 1; i < cables.length; i++) assert.ok(cables[i].x - cables[i - 1].x <= 5.01, 'a cable circle every ≤ 5 u');
  for (const t of cables) {
    // over the main span nothing but the cables rises above the deck (the anchorages and their pylons stand taller)
    const want = Math.max(...[-2.5, 0, 2.5].map(d => GGB.cableY(Math.max(GGB.ANCH_S, Math.min(GGB.ANCH_N, t.x + d)))));
    assert.ok(t.top >= GGB.cableY(t.x), `cable at ${t.x}: top ${t.top} vs cable ${GGB.cableY(t.x).toFixed(2)}`);
    if (Math.abs(t.x) < GGB.TOWER - 3) assert.ok(t.top <= want + 1.2, `cable at ${t.x}: top ${t.top} hugs the cable`);
  }
  const mid = cables.reduce((a, b) => (Math.abs(b.x) < Math.abs(a.x) ? b : a));
  assert.ok(mid.top < 18, `the pelican may cross the span low (mid-span cables at ${mid.top})`);
  // Sutro Tower: one circle of r ≈ 6 up to the antenna tops (base 46.4 + 49.7)
  const [sutro] = tallOf('sutro-tower');
  assert.ok(Math.abs(sutro.r - 6) < 0.5 && sutro.top >= 49.4, `Sutro r ${sutro.r}, top ${sutro.top}`);
  // City Hall: the dome and lantern (17.65 u, the AI hall) over a block whose roof is far lower
  const [dome] = tallOf('city-hall');
  assert.ok(dome.top >= 17.6 && dome.r >= 3 && dome.r <= 4.5, `City Hall dome ${dome.top} r ${dome.r}`);
  assert.ok(Math.max(...blockerTops(byId('city-hall')).map(Number)) < 7, 'the block reads as its roof, not its dome');
  // the rotunda, Grace's flèche and west towers, the de Young tower, Oracle's four light standards, the Legion dome
  assert.ok(tallOf('palace-of-fine-arts')[0].top >= 10.8, 'rotunda');
  const grace = tallOf('grace-cathedral');
  assert.ok(grace[0].top >= 12.9 && grace[1].top >= 9.5 && grace[2].top >= 9.5, `Grace ${grace.map(t => t.top)}`);
  assert.ok(Math.max(...blockerTops(byId('grace-cathedral')).map(Number)) < grace[1].top, 'the nave is below the towers');
  assert.ok(tallOf('de-young-tower')[0].top >= 11.2, 'de Young tower');
  assert.equal(blockerTops(byId('de-young-tower'))[0]! < 4, true, 'the museum wings stay low');
  assert.deepEqual(tallOf('oracle-park').map(t => t.top), [12.4, 12.4, 12.4, 12.4]);
  assert.ok(tallOf('legion-of-honor')[0].top >= 5.5, 'Legion dome');
  // the windmill: the disc its sails sweep (hub ≈ 5.85 + sail 4.15), centred on the windshaft
  const [mill] = tallOf('dutch-windmill');
  assert.ok(mill.r >= 4.15 && mill.top >= 9.9 && mill.top <= 10.8, `windmill r ${mill.r} top ${mill.top}`);
});

test('D2-10: landmarkTallStructures = the measured tall parts in world space; every site ≥ 10 u tall is covered', () => {
  const base = (l: SfLandmark) => (typeof l.base === 'number' ? l.base : 3);
  const tall = landmarkTallStructures(base);
  for (const l of SF_SITES) {
    const mine = tall.filter(t => t.id === l.id), parts = tallParts(l);
    // a wave-4 site answers with its measured top over the base (w4.height.top), a landmark with its info height
    const w = w4Site(l.id)?.w4.height;
    const h = w ? { rule: w.rule, u: w.top } : sfLandmarkInfo(l.id)?.height;
    if (parts.length) {
      assert.equal(mine.length, parts.length, l.id);
      parts.forEach((p, i) => {
        const w = landmarkToWorld(l, p);
        assert.ok(Math.hypot(mine[i].x - w.x, mine[i].z - w.z) < 1e-6 && mine[i].r === p.r, `${l.id} part ${i} placed`);
        assert.ok(Math.abs(mine[i].top - (base(l) + p.top + TALL_MARGIN)) < 1e-9, `${l.id} part ${i} top`);
      });
    } else if (h && h.rule !== 'overlook' && h.u >= 10) assert.equal(mine.length, 1, `${l.id}: the day-0 circle`);
    else assert.equal(mine.length, 0, `${l.id}: low, no tall part`);
  }
  for (const id of ['golden-gate-bridge', 'sutro-tower', 'city-hall', 'palace-of-fine-arts', 'grace-cathedral', 'de-young-tower', 'oracle-park', 'legion-of-honor', 'dutch-windmill']) {
    assert.ok(tall.some(t => t.id === id), `${id} listed`);
  }
  // the bridge's towers are world y (base 0): 42.2 u + margin
  assert.ok(tall.filter(t => t.id === 'golden-gate-bridge' && t.top >= GGB.TOP + TALL_MARGIN).length >= 4);
});

test('D2-10: blocker tops reach the terrain provider as world Blocker.top and follow the renderer\'s base', () => {
  const sites = new CitySites();
  const inputs: LandmarkWalkInput[] = landmarkWalkInputs(sites.walkInputs());
  const manifest = { bbox: { minX: -1024, minZ: -128, maxX: 640, maxZ: 1408 }, chunks: [], maxOverhang: 0 } as unknown as SfManifest;
  const city = createCityTerrain(manifest, { landmarks: inputs });
  const near = (x: number, z: number) => { const out: { top?: number }[] = []; city.forEachBlockerNear(x, z, 0.5, b => out.push(b)); return out; };
  // a numeric-base landmark: Oracle Park (base 0.1): its bowl's roof, world y
  const oracle = byId('oracle-park');
  const tops = near(oracle.x, oracle.z).map(b => b.top);
  assert.ok(tops.some(t => Math.abs(t! - ((oracle.base as number) + blockerTops(oracle)[0]!)) < 1e-9), `Oracle bowl top ${tops}`);
  // a 'terrain' landmark: Mission Dolores moves with setLandmarkBase (the far estimate, then its chunk; City Hall's
  // base is numeric since D2-09 pinned it when its exclusion became the block, Grace Cathedral's since lane L's terrace)
  const hall = byId('mission-dolores');
  assert.equal(hall.base, 'terrain');
  const top0 = blockerTops(hall)[0]!;
  city.setLandmarkBase('mission-dolores', 27.25);
  assert.ok(near(hall.x, hall.z).some(b => Math.abs((b.top ?? NaN) - (27.25 + top0)) < 1e-9), 'the Mission church top follows its base');
  city.setLandmarkBase('mission-dolores', 28);
  assert.ok(near(hall.x, hall.z).some(b => Math.abs((b.top ?? NaN) - (28 + top0)) < 1e-9));
  // D2-review: landmarkBase answers the pinned base too (it answered the walkInputs hint 0), so the glide's tall parts
  // (actors/glideTall landmarkBaseY reads the provider) stand on it: the flèche over the nave, not 20 u under it
  assert.equal(city.landmarkBase('mission-dolores'), 28);
  // Grace Cathedral (a numeric base since lane L's terrace): its flèche and towers stand on it, over the nave
  const grace = byId('grace-cathedral');
  assert.equal(city.landmarkBase('grace-cathedral'), grace.base);
  const nave = (grace.base as number) + blockerTops(grace)[0]!;
  const spire = landmarkTallStructures(l => city.landmarkBase(l.id) ?? NaN).filter(t => t.id === 'grace-cathedral');
  assert.ok(spire.length === tallParts(grace).length && spire.length > 0 && spire.every(t => t.top > nave), `Grace tall tops ${spire.map(t => t.top.toFixed(1))} over the nave ${nave}`);
  // landmarkWalkWorld agrees (world tops)
  assert.deepEqual(landmarkWalkWorld(hall, 8).blockers.map(b => b.top), blockerTops(hall).map(t => 8 + t!));
});

test('D2-10: the glide climbs over the Golden Gate Bridge tower and cables instead of through them', () => {
  const l = byId('golden-gate-bridge');
  const tall = landmarkTallStructures(() => 0);
  // open water at y −0.6 around the bridge (no blockers resident: the tall list alone must hold the pelican up)
  const world = { ...terrainGlideWorld(tall), heightAt: () => -0.6, inWorld: () => true };
  for (const at of [-GGB.TOWER, 0]) {
    const target = landmarkToWorld(l, { x: at, z: 0 });
    // the floor the glide keeps right over the tower / mid-span (ground or roof + hard clearance)
    const roof = world.roofAt(target.x, target.z, 1);
    const want = at === 0 ? GGB.cableY(0) : GGB.TOP;
    assert.ok(roof >= want, `roof over ${at}: ${roof.toFixed(2)} ≥ ${want.toFixed(2)}`);
    if (at === 0) assert.ok(roof < 20, 'mid-span stays low enough to fly under the saddles');
  }
});

test('C2-5 "Sites": the lod-0 radius shrinks with the camera height (walking keeps LOD0; a high view LOD0_HIGH)', () => {
  for (const tier of [1, 2, 3] as const) {
    for (const h of [0, 8, 25, SITE_CAM_H[0]]) assert.equal(siteLod0Radius(tier, h), LOD0[tier], `tier ${tier} walking at ${h}`);
    for (const h of [SITE_CAM_H[1], 200, 400]) assert.equal(siteLod0Radius(tier, h), LOD0_HIGH[tier], `tier ${tier} high at ${h}`);
    let last = Infinity;
    for (let h = 0; h <= 150; h += 0.5) {
      const r = siteLod0Radius(tier, h);
      assert.ok(r <= last && r % 10 === 0, `tier ${tier} at ${h}: ${r} (monotone, 10 u steps)`);
      last = r;
    }
    assert.ok(LOD0_HIGH[tier] < LOD0[tier] && LOD0_HIGH[tier] >= 100, 'a high camera still sees the nearby landmarks in full');
  }
  // CitySites follows U.uCam: raise the camera over Chinatown and the far landmarks drop to their silhouettes
  const sites = new CitySites();
  const fx = 86.3, fz = 178.1;
  const run = (camY: number) => { U.uCam.value.set(fx, camY, fz + 10); for (let i = 0; i < 40; i++) sites.update(fx, fz, i * 0.05); return sites.counts(); };
  const low = run(8), high = run(400);
  assert.ok(low.camH < SITE_CAM_H[0] && high.camH >= SITE_CAM_H[1]);
  assert.ok(high.near < low.near, `near ${low.near} → ${high.near}`);
  assert.ok(high.triangles < low.triangles, `lod-0 triangles ${low.triangles} → ${high.triangles}`);
  for (const l of SF_LANDMARKS) {
    const d = Math.hypot(l.x - fx, l.z - fz);
    if (d > LOD0_HIGH[l.tier] + 40) assert.ok(!(sites as unknown as { sites: { l: SfLandmark; mesh: unknown }[] }).sites.find(q => q.l === l)!.mesh, `${l.id} (${d.toFixed(0)} u) dropped`);
  }
  const back = run(8);
  assert.equal(back.near, low.near, 'walking again brings them back');
  sites.dispose();
  U.uCam.value.set(0, 0, 0);
});

test("F's request: with lane F's spinning disc on, the turntable's lod 0 drops its static disc top; sites.ts rebuilds it", () => {
  const l = byId('cable-car-turntable');
  /** highest vertex strictly inside the disc (r < R − 0.2), local */
  const discTop = () => {
    const g = buildLandmark(l, 0, 0), p = g.getAttribute('position');
    let top = -Infinity;
    for (let i = 0; i < p.count; i++) if (Math.hypot(p.getX(i), p.getZ(i)) < TURNTABLE.r - 0.2) top = Math.max(top, p.getY(i));
    return top;
  };
  assert.equal(turntableSpinner(), false, 'off by default (SoloView, no lane F)');
  const k0 = l.buildKey!();
  assert.ok(discTop() >= TURNTABLE.top, 'static disc: deck, rails and pivot at the top');
  setTurntableSpinner(true);
  try {
    assert.notEqual(l.buildKey!(), k0);
    assert.ok(discTop() <= TURNTABLE.top - 0.1 + 1e-6, `under F's disc nothing reaches its top (${discTop()})`);
    // the far silhouette keeps its disc (F's discs hide beyond 300 u)
    const far = buildLandmark(l, 2, 0).getAttribute('position');
    let farTop = -Infinity;
    for (let i = 0; i < far.count; i++) if (Math.hypot(far.getX(i), far.getZ(i)) < TURNTABLE.r + 0.05) farTop = Math.max(farTop, far.getY(i));
    assert.ok(farTop >= TURNTABLE.top - 1e-6);
    // the city rebuilds a mounted lod 0 when the key changes (one lod-0 build a frame)
    setTurntableSpinner(false);
    const sites = new CitySites();
    sites.setBase(l.id, 5); // a 'terrain' landmark builds once its base is known (its chunk in the city)
    // Powell & Market's gutter: the turntable stands its baseLift above the lowest ground the chunk reports
    assert.ok((l.baseLift ?? 0) > 0.5);
    assert.equal((sites as unknown as { sites: { l: SfLandmark; baseY: number }[] }).sites.find(q => q.l === l)!.baseY, 5 + l.baseLift!);
    const at = (t: number) => { U.uCam.value.set(l.x, 8, l.z + 10); sites.update(l.x, l.z, t); };
    for (let i = 0; i < 40; i++) at(i * 0.05);
    const site = (sites as unknown as { sites: { l: SfLandmark; mesh: { children: { geometry?: { getAttribute(n: string): { count: number } } }[] } | null }[] }).sites.find(q => q.l === l)!;
    const before = site.mesh;
    assert.ok(before, 'lod 0 mounted');
    setTurntableSpinner(true);
    for (let i = 40; i < 80; i++) at(i * 0.05);
    assert.ok(site.mesh && site.mesh !== before, 'rebuilt with the spinner on');
    sites.dispose();
    U.uCam.value.set(0, 0, 0);
  } finally {
    setTurntableSpinner(false);
  }
});

// ---------------------------------------------------------------------------
// D2-09: landmark settings (plazas, restored streets, furniture, plaza spots)
// ---------------------------------------------------------------------------

/** the landmarks D2-09 set (priority: the three routes', then City Hall, Twin Peaks, the Castro pocket) */
const SET = ['dragon-gate', 'palace-of-fine-arts', 'fort-point', 'golden-gate-bridge', 'conservatory-of-flowers', 'de-young-tower', 'dutch-windmill', 'city-hall', 'twin-peaks',
  // lane L, wave 4: D2's remaining T2 settings
  'legion-of-honor', 'grace-cathedral', 'ghirardelli-square', 'cable-car-turntable', 'lombard-crooked-street'];
const inPoly = (p: { x: number; z: number }, poly: readonly { x: number; z: number }[]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) c = !c; }
  return c;
};

test('D2-09: landmarks/settingData.ts is the measurement of the published city (re-run scripts/opus-sf/assets/landmark-settings.ts)', async () => {
  const { measureSetting } = await import('../scripts/opus-sf/assets/settingsMeasure');
  const { SETTING_DATA } = await import('../src/opus-bay/world/sf/landmarks/settingData');
  for (const id of ['dragon-gate', 'palace-of-fine-arts', 'city-hall', 'conservatory-of-flowers', 'dutch-windmill']) {
    assert.deepEqual(await measureSetting(byId(id)), SETTING_DATA[id], `${id}: settingData is stale`);
  }
  // every landmark whose module reads its setting has a row (and no other), its numeric base as declared, and the
  // sink sites.ts sends the workers
  const { SETTING_IDS } = await import('../scripts/opus-sf/assets/settingsMeasure');
  assert.deepEqual(Object.keys(SETTING_DATA).sort(), [...SETTING_IDS].sort());
  const ex = new CitySites().excludes();
  for (const l of SF_LANDMARKS.filter(q => SETTING_IDS.includes(q.id))) {
    const d = SETTING_DATA[l.id];
    assert.ok(d, `${l.id} row`);
    if (typeof l.base === 'number') assert.equal(d.base, Math.round(l.base * 100) / 100, `${l.id} base`);
    assert.equal(d.sink, ex.find(e => e.id === l.id)!.sink, `${l.id} sink`);
  }
});

test('D2-09: setting ground lies on the drawn city ground (never buried, never floating) and stays small', async () => {
  const { drawn } = await import('../scripts/opus-sf/assets/settingsMeasure');
  const { SETTING_DATA } = await import('../src/opus-bay/world/sf/landmarks/settingData');
  for (const id of SET) {
    const l = byId(id), base = SETTING_DATA[id].base, g = l.ground ?? [], sink = SETTING_DATA[id].sink;
    assert.ok(g.length > 0, `${id} has setting ground`);
    // within 1 u of the exclusion's edge the sampled ground steps by the sink (the drawn mesh ramps over a cell there)
    const ex = 'poly' in l.exclude ? l.exclude.poly : Array.from({ length: 32 }, (_, k) => ({ x: l.x + Math.sin((k / 32) * Math.PI * 2) * (l.exclude as { r: number }).r, z: l.z + Math.cos((k / 32) * Math.PI * 2) * (l.exclude as { r: number }).r }));
    const nearEdge = (x: number, z: number) => ex.some((a, i) => {
      const b = ex[(i + 1) % ex.length], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2));
      return Math.hypot(x - a.x - dx * t, z - a.z - dz * t) < 1;
    });
    let n = 0;
    for (const q of g) {
      assert.ok(q.poly.length >= 3 && q.poly.every(p => Number.isFinite(p.x) && Number.isFinite(p.z)), id);
      if (!q.ys) continue;
      assert.equal(q.ys.length, q.poly.length, `${id} ys`);
      for (let i = 0; i < q.poly.length; i += 2) {
        // the city's sampled ground within 0.35 u (it steps where the corridor model meets the raster by a bridge)
        const w = landmarkToWorld(l, q.poly[i]), y = base + q.ys[i];
        const around = await Promise.all([[0, 0], [0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]].map(([dx, dz]) => drawn(w.x + dx, w.z + dz)));
        const lo = Math.min(...around), hi = Math.max(...around);
        // never buried (the grid is max-pooled; the restored streets ride their centreline), never floating
        assert.ok(y > lo - 0.12 - (nearEdge(w.x, w.z) ? sink : 0), `${id} ground at (${q.poly[i].x}, ${q.poly[i].z}) is ${(lo - y).toFixed(3)} under the city ground`);
        assert.ok(y < hi + 0.8, `${id} ground at (${q.poly[i].x}, ${q.poly[i].z}) floats ${(y - hi).toFixed(2)} u`);
        n++;
      }
    }
    assert.ok(n > 0, `${id}: draped ground checked`);
    // one GROUND mesh in the lod 0: keep it small
    const tris = g.reduce((s, q) => s + q.poly.length - 2, 0);
    assert.ok(tris < 2600, `${id} setting ground ${tris} triangles`);
  }
});

test('D2-09: streets the exclusions clipped run on (City Hall, the Dragon Gate, the Palace, Oracle Park); the GGB meets Merchant Road', async () => {
  const { SETTING_DATA } = await import('../src/opus-bay/world/sf/landmarks/settingData');
  // City Hall's exclusion is the block: Van Ness Avenue and Goodlett Place no longer enter it
  assert.ok(!SETTING_DATA['city-hall'].streets.some(s => s.c === 'trunk' || s.c === 'secondary'), 'City Hall clips no avenue');
  // the Dragon Gate: Grant Ave's piece under the arch is restored as asphalt at the street's own height (sink 0)
  const gate = byId('dragon-gate');
  assert.equal(gate.sink, 0);
  assert.ok(SETTING_DATA['dragon-gate'].streets.some(s => s.c === 'residential'), 'Grant Ave clipped piece');
  assert.ok((gate.ground ?? []).some(q => q.pattern === 5 && q.poly.some(p => Math.abs(p.z) < 0.6)), 'asphalt under the gate');
  // the Palace: restored walks never run through the lagoon
  const palace = byId('palace-of-fine-arts');
  const { PALACE_LAGOON } = await import('../src/opus-bay/world/sf/landmarks/palace-of-fine-arts');
  const walks = (palace.ground ?? []).filter(q => q.pattern === 2 && q.poly.length === 4 && q.color !== '#e4d6bd');
  assert.ok(walks.length > 40, `Palace walks restored (${walks.length})`);
  for (const q of walks) {
    const c = { x: q.poly.reduce((s, p) => s + p.x, 0) / 4, z: q.poly.reduce((s, p) => s + p.z, 0) / 4 };
    assert.ok(!inPoly(c, PALACE_LAGOON), `a walk crosses the lagoon at (${c.x.toFixed(1)}, ${c.z.toFixed(1)})`);
  }
  // Oracle Park: King St (26 u clipped) is asphalt again
  assert.ok((byId('oracle-park').ground ?? []).filter(q => q.pattern === 5).length >= 10, 'King St restored');
  // CS-11: the approach street leaves the deck end at deck height and ends on Merchant Road
  const ggb = byId('golden-gate-bridge');
  const asphalt = (ggb.ground ?? []).filter(q => q.pattern === 5 && q.poly.every(p => p.x < GGB.END_S + 1));
  assert.ok(asphalt.length >= 4, 'approach asphalt');
  assert.ok(asphalt.some(q => q.ys!.some(y => Math.abs(y - (GGB.DECK + 0.055)) < 0.01)), 'the approach starts at the deck');
  const far = asphalt.flatMap(q => q.poly).reduce((a, p) => (p.z > a.z ? p : a));
  assert.ok(Math.hypot(far.x - -237.1, far.z - 8.2) < 2.6, `the approach reaches Merchant Road (${far.x.toFixed(1)}, ${far.z.toFixed(1)})`);
});

test('D2-09: CS-13 the Palace lagoon lies low (no raised slab, no dark rim wall); the Castro Theatre faces Castro Street', async () => {
  const { drawn } = await import('../scripts/opus-sf/assets/settingsMeasure');
  const { PALACE_LAGOON } = await import('../src/opus-bay/world/sf/landmarks/palace-of-fine-arts');
  const { Batch } = await import('../src/opus-bay/world/builder');
  const palace = byId('palace-of-fine-arts'), base = palace.base as number;
  // the water: at most 0.25 u over the drawn ground (it was 0.44 with a 0.54 u rim wall)
  const b = new Batch();
  palace.build(b, 0);
  const onRim = (x: number, z: number) => PALACE_LAGOON.some(p => Math.hypot(p.x - x, p.z - z) < 1e-3);
  let n = 0;
  for (let i = 0; i < b.pos.length; i += 3) {
    if (!onRim(b.pos[i], b.pos[i + 2]) || Math.abs(b.pos[i + 1]) > 0.3) continue;
    const w = landmarkToWorld(palace, { x: b.pos[i], z: b.pos[i + 2] }), gy = await drawn(w.x, w.z);
    assert.ok(base + b.pos[i + 1] - gy < 0.25, `water ${(base + b.pos[i + 1] - gy).toFixed(2)} u over the ground`);
    n++;
  }
  assert.ok(n >= PALACE_LAGOON.length, 'the water polygon');
  // no wall faces round the lagoon any more: its rim is ground (the coping and its bank)
  const rim = (palace.ground ?? []).filter(q => q.color === '#e4d6bd' || q.color === '#cfc1a3');
  assert.equal(rim.length, PALACE_LAGOON.length * 2);
  // Castro: the theatre faces Castro Street (the city's Castro St centreline runs 4–7 u in front of the facade, none
  // behind it) — it faced the Hartford St houses across its own block before (the "pocket")
  const castro = byId('castro-theatre');
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const sf = sfDisk(), far = await sf.far();
  const c = (await sf.chunk(Math.floor(castro.x / 128), Math.floor(castro.z / 128)))!;
  const zs: number[] = [];
  for (let i = 0; i < c.roads.count; i++) {
    if (far.names?.[c.roads.nameIdx[i]] !== 'Castro Street') continue;
    for (let k = c.roads.pStart[i]; k < c.roads.pStart[i + 1]; k++) {
      const p = worldToLandmark(castro, { x: c.roads.xyz[k * 3], z: c.roads.xyz[k * 3 + 2] });
      if (Math.abs(p.x) < 12) zs.push(p.z);
    }
  }
  assert.ok(zs.length >= 2 && zs.every(z => z > 4 && z < 7), `Castro St in front of the facade (local z ${zs.map(z => z.toFixed(1)).join(', ')})`);
});

test('D2-09: landmarkPlazaSpots — crowd spots on the settings, clear of every blocker, near their landmark', async () => {
  const { landmarkPlazaSpots, PLAZA_MAX } = await import('../src/opus-bay/world/sf/landmarks/context');
  const spots = landmarkPlazaSpots();
  for (const id of [...SET, 'castro-theatre']) {
    const mine = spots.filter(s => s.id === id), l = byId(id);
    // (W4-IL15: the windmill's plaza is the 1.1 u walk the arrival stands at the foot of, and its benches take the
    // tulip strip: no sightseer spot is left clear of the arrival, which is the point)
    const min = id === 'dutch-windmill' ? 0 : 2;
    assert.ok(mine.length >= min && mine.length <= PLAZA_MAX, `${id}: ${mine.length} spots`);
    const walk = landmarkWalkWorld(l, 0);
    for (const s of mine) {
      assert.ok(Math.hypot(s.x - l.x, s.z - l.z) < (id === 'golden-gate-bridge' ? 250 : 26), `${id} spot near`);
      for (const bl of walk.blockers) {
        if ('poly' in bl) assert.ok(!inPoly(s, bl.poly), `${id} spot (${s.x.toFixed(1)}, ${s.z.toFixed(1)}) inside a blocker`);
        else assert.ok(Math.hypot(s.x - bl.x, s.z - bl.z) >= bl.r, `${id} spot in a round blocker`);
      }
    }
  }
  assert.equal(landmarkPlazaSpots(), spots, 'computed once');
});

test('W4-IL15 (verify m6): no crowd plaza spot stands on a site\'s arrival spot (the ring travel puts the player in)', async () => {
  const { landmarkPlazaSpots, sfLandmarkAnchor, ARRIVAL_CLEAR } = await import('../src/opus-bay/world/sf/landmarks/context');
  const spots = landmarkPlazaSpots();
  let checked = 0;
  for (const s of spots) {
    const a = sfLandmarkAnchor(s.id);
    if (!a) continue;
    checked++;
    assert.ok(Math.hypot(s.x - a.x, s.z - a.z) >= ARRIVAL_CLEAR - 1e-6, `${s.id}: a plaza spot ${Math.hypot(s.x - a.x, s.z - a.z).toFixed(2)} u from the arrival`);
  }
  assert.ok(checked > 100, `${checked} spots checked`);
  assert.ok(ARRIVAL_CLEAR >= 2.5);
});
