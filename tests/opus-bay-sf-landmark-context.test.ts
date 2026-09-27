import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { terrainGlideWorld } from '../src/opus-bay/actors/glide';
import { type LandmarkWalkInput, createCityTerrain, landmarkWalkInputs } from '../src/opus-bay/core/sfTerrain';
import { ASSETS } from '../src/opus-bay/data/assets';
import { sfLandmarkInfo } from '../src/opus-bay/data/sf/landmarks';
import type { SfManifest } from '../src/opus-bay/world/sf/format';
import { TALL_MARGIN, landmarkTallStructures } from '../src/opus-bay/world/sf/landmarks/context';
import { GGB } from '../src/opus-bay/world/sf/landmarks/golden-gate-bridge';
import { SF_LANDMARKS, type SfLandmark, blockerTops, landmarkToWorld, landmarkWalkWorld, sfLandmark, tallParts, usesAi } from '../src/opus-bay/world/sf/landmarks/index';
import { LANDMARK_TOPS } from '../src/opus-bay/world/sf/landmarks/tops';
import { CitySites } from '../src/opus-bay/world/sf/sites';
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
