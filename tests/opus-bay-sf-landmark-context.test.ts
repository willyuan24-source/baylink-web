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
import { SF_LANDMARKS, type SfLandmark, blockerTops, buildLandmark, landmarkToWorld, landmarkWalkWorld, sfLandmark, tallParts, usesAi } from '../src/opus-bay/world/sf/landmarks/index';
import { LANDMARK_TOPS } from '../src/opus-bay/world/sf/landmarks/tops';
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

test('D2-10: landmarks/tops.ts is the measurement of the drawn lod 0 (re-run scripts/opus-sf/assets/landmark-tops.ts)', async () => {
  for (const l of SF_LANDMARKS) {
    const row = LANDMARK_TOPS[l.id];
    assert.ok(row, `${l.id}: a row in tops.ts`);
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

test('D2-10: landmarkTallStructures = the measured tall parts in world space; every landmark ≥ 10 u tall is covered', () => {
  const base = (l: SfLandmark) => (typeof l.base === 'number' ? l.base : 3);
  const tall = landmarkTallStructures(base);
  for (const l of SF_LANDMARKS) {
    const mine = tall.filter(t => t.id === l.id), parts = tallParts(l);
    const h = sfLandmarkInfo(l.id)?.height;
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
  // a 'terrain' landmark: City Hall moves with setLandmarkBase (the far estimate, then its chunk)
  const hall = byId('city-hall');
  const top0 = blockerTops(hall)[0]!;
  city.setLandmarkBase('city-hall', 7.25);
  assert.ok(near(hall.x, hall.z).some(b => Math.abs((b.top ?? NaN) - (7.25 + top0)) < 1e-9), 'City Hall block top follows its base');
  city.setLandmarkBase('city-hall', 8);
  assert.ok(near(hall.x, hall.z).some(b => Math.abs((b.top ?? NaN) - (8 + top0)) < 1e-9));
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
