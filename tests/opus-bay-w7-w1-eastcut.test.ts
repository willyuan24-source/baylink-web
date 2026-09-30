import assert from 'node:assert/strict';
import test from 'node:test';
import { createCityTerrain, landmarkWalkInputs } from '../src/opus-bay/core/sfTerrain';
import { STAND_RADIUS, canStand, setCityTerrain } from '../src/opus-bay/core/terrain';
import { DISTRICT } from '../src/opus-bay/data/district';
import { ATTRACTION_INDEX } from '../src/opus-bay/data/sf/attractions';
import { SENTINEL_H, SENTINEL_OSM, SENTINEL_RING, nbDropLots } from '../src/opus-bay/world/sf/cornersNB';
import {
  CUPID, EC_BUDGET, EC_CENTER, EC_CULL, FROG_FOUNTAIN, REDWOOD_C, TC_RING, TC_ROOF, buildEastCut, deckHidden, deckTrees, ecObstacles, onDeck, redwoods,
} from '../src/opus-bay/world/sf/cornersEastCut';
import { SEAM_FILL } from '../src/opus-bay/world/sf/cornersSeamData';
import { cityDropLots } from '../src/opus-bay/world/sf/hero';
import { SF_LANDMARKS } from '../src/opus-bay/world/sf/landmarks/index';
import { sfDisk } from './opus-bay-sf-disk';

/**
 * Wave 7 · lane W1 · W7-W12 the East Cut / Embarcadero corner (world/sf/cornersEastCut.ts): Salesforce Park's deck on
 * the Transit Center, Cupid's Span, Redwood Park's grove and frog fountain, the Sentinel's copper shell over its seam
 * fill row. City mode only; the district is untouched (lot-117 is hidden in city mode only, like lot-211).
 */

type P = { x: number; z: number };
function segD(x: number, z: number, a: P, b: P) {
  const dx = b.x - a.x, dz = b.z - a.z, l = dx * dx + dz * dz, t = l ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l)) : 0;
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}
function inPoly(x: number, z: number, p: readonly P[]) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c; }
  return c;
}

test('W7-W12 the East Cut corner: 2 meshes within budget, every piece within the LOD\'s reach, the deck at 70 ft', () => {
  const ec = buildEastCut();
  assert.ok(ec.triangles <= EC_BUDGET.triangles, `${ec.triangles} triangles`);
  for (const m of [ec.deck, ec.toy]) { m.geometry.computeBoundingBox(); assert.equal(m.material, ec.toy.material, 'one material (TOY)'); }
  const d = ec.deck.geometry.boundingBox!, t = ec.toy.geometry.boundingBox!;
  // the deck: on the Transit Center's footprint, its roof (lawn) at TC_ROOF with the trees above it
  assert.ok(d.min.x > 169.5 && d.max.x < 178.8 && d.min.z > 83 && d.max.z < 145.5, 'the deck on its footprint');
  assert.ok(d.max.y > TC_ROOF + 1 && d.max.y < TC_ROOF + 3.5, `roof trees top at ${d.max.y.toFixed(2)}`);
  // everything within EC_CULL − 60 u of the LOD's centre (visible from 60 u beyond the piece at least)
  for (const [x, z] of [[d.min.x, d.min.z], [d.max.x, d.max.z], [t.min.x, t.min.z], [t.max.x, t.max.z]]) assert.ok(Math.hypot(x - EC_CENTER.x, z - EC_CENTER.z) < EC_CULL - 60, `(${x.toFixed(0)}, ${z.toFixed(0)}) near enough`);
  assert.ok(deckTrees().length >= 30, `${deckTrees().length} trees on the roof`);
  for (const p of deckTrees()) assert.ok(onDeck(p.x, p.z), 'roof trees on the roof');
  // Cupid's Span 64 ft → 6.2 u (the bow's top), the Sentinel's dome over its 7.7 u prism
  assert.ok(t.max.y > CUPID.top - 0.4 && t.max.y < 10.2, `the corner's top ${t.max.y.toFixed(2)}`);
  ec.deck.geometry.dispose();
  ec.toy.geometry.dispose();
});

test('W7-W12 the deck hides while the player or the camera is on or under it, and shows from the Ferry Building', () => {
  const ferry = { x: 133, z: 15 }, cam = { x: 140, y: 9, z: 5 };
  assert.equal(deckHidden(ferry, cam), false);
  assert.equal(deckHidden({ x: 174, z: 120 }, cam), true, 'the player in the ground-level park under the deck');
  assert.equal(deckHidden({ x: 179.5, z: 100 }, cam), true, 'the player at the deck\'s edge (2.5 u)');
  assert.equal(deckHidden(ferry, { x: 173, y: 4, z: 110 }), true, 'the camera under the deck');
  assert.equal(deckHidden(ferry, { x: 173, y: 60, z: 110 }), false, 'a camera high above it');
});

test('W7-W12 the Sentinel: its seam fill row on the district\'s corner, clear of the ribbons; lot-117 hidden in city mode only', () => {
  const row = SEAM_FILL.find(r => r[0] === SENTINEL_OSM);
  assert.ok(row, 'the Sentinel\'s fill row');
  assert.ok(Math.abs(row[5] - (SENTINEL_H - 0.8)) < 0.05 && Math.abs(SENTINEL_H - 7.7) < 0.01, `toy height ${row[5]} under the shell's ${SENTINEL_H} (29 m)`);
  assert.equal(row[1], 9, 'a plain industrial prism under the shell (no façade remap, no crown)');
  for (let k = 0; k < row[7].length; k += 2) assert.ok(SENTINEL_RING.some(p => Math.hypot(p.x - row[7][k], p.z - row[7][k + 1]) < 0.02), 'the row is SENTINEL_RING');
  for (const r of DISTRICT.roads.filter(r => r.kind === 'roadway' || r.kind === 'path')) {
    for (const p of SENTINEL_RING) for (let i = 1; i < r.points.length; i++) assert.ok(segD(p.x, p.z, r.points[i - 1], r.points[i]) >= r.width / 2, `the Sentinel on ${r.id}`);
  }
  assert.ok(nbDropLots(DISTRICT.blocks).map(i => DISTRICT.blocks[i].id).includes('lot-117'));
  assert.ok(DISTRICT.blocks.some(b => b.id === 'lot-117'), 'the district keeps lot-117');
});

test('W7-W12 the corner walks in city mode: obstacles clear of the graph and the streets, the moved trip ends standable', async () => {
  const sf = sfDisk();
  const LMS = landmarkWalkInputs(SF_LANDMARKS);
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  for (const [x, z] of [[60, 96], [212, 10], [24, 108]]) await sf.attachAround(city, x, z, 40, LMS);
  setCityTerrain(city, { heroDropLots: new Set(cityDropLots(sf.manifest.heroDropLots)) });
  try {
    const ec = buildEastCut();
    const obs = ecObstacles(ec.cupidFeet.map(v => ({ x: v.x, z: v.z })));
    ec.deck.geometry.dispose(); ec.toy.geometry.dispose();
    const g = await sf.graph();
    const roads = DISTRICT.roads.filter(r => r.kind === 'roadway' || r.kind === 'track');
    for (const o of obs) {
      for (let i = 0; i < g.nodeCount; i++) for (let e = g.offsets[i]; e < g.offsets[i + 1]; e++) {
        const j = g.targets[e];
        if (j < i) continue;
        const a = { x: g.xyz[3 * i], z: g.xyz[3 * i + 2] }, b = { x: g.xyz[3 * j], z: g.xyz[3 * j + 2] };
        if (Math.min(a.x, b.x) > o.x + 5 || Math.max(a.x, b.x) < o.x - 5 || Math.min(a.z, b.z) > o.z + 5 || Math.max(a.z, b.z) < o.z - 5) continue;
        assert.ok(segD(o.x, o.z, a, b) > o.r + 0.3, `obstacle (${o.x.toFixed(1)}, ${o.z.toFixed(1)}) r ${o.r} on graph edge ${i}–${j}`);
      }
      for (const r of roads) for (let i = 1; i < r.points.length; i++) assert.ok(segD(o.x, o.z, r.points[i - 1], r.points[i]) > r.width / 2 + o.r, `obstacle (${o.x.toFixed(1)}, ${o.z.toFixed(1)}) on ${r.id}`);
      for (const lot of DISTRICT.blocks) assert.ok(!inPoly(o.x, o.z, lot.footprint), `obstacle inside ${lot.id}`);
    }
    assert.ok(redwoods().every(p => Math.hypot(p.x - REDWOOD_C.x, p.z - REDWOOD_C.z) < 4), 'the grove inside the district\'s Redwood Park circle');
    assert.ok(Math.hypot(FROG_FOUNTAIN.x - REDWOOD_C.x, FROG_FOUNTAIN.z - REDWOOD_C.z) < 4, 'the fountain in the park');
    // the moved trip ends (ARRIVAL_OVERRIDES) stand, and the Sentinel's toy is solid
    const e = ATTRACTION_INDEX.get('sentinel-building')!.arrival!;
    assert.ok(canStand(e.x, e.z, STAND_RADIUS), `the Sentinel's trip end (${e.x}, ${e.z}) standable`);
    // Cupid's Span stands on the district's Rincon Park lawn (walkable), its feet clear of the lawn's benches and trees
    const lawn = DISTRICT.walk.find(w => w.id === 'rincon-park')!.polygon;
    for (const f of ec.cupidFeet) assert.ok(inPoly(f.x, f.z, lawn), 'the sculpture on the lawn');
    for (const q of DISTRICT.props) for (const f of ec.cupidFeet) assert.ok(Math.hypot(q.x - f.x, q.z - f.z) > 1.5, `a district ${q.kind} at the sculpture's foot`);
    const c = SENTINEL_RING.reduce((s, p) => ({ x: s.x + p.x / SENTINEL_RING.length, z: s.z + p.z / SENTINEL_RING.length }), { x: 0, z: 0 });
    assert.equal(canStand(c.x, c.z, STAND_RADIUS), false, 'the Sentinel is solid');
    assert.ok(canStand(REDWOOD_C.x + 1, REDWOOD_C.z + 1.2, 0.3), 'you can walk into the grove');
    // the ground-level park under the deck still walks
    assert.ok(canStand(174, 120, STAND_RADIUS) && onDeck(174, 120), 'under the deck');
    assert.ok(TC_RING.length >= 10);
  } finally { setCityTerrain(null); }
});
