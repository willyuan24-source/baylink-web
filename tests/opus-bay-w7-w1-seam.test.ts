import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { project } from '../src/opus-bay/core/geo';
import { createCityTerrain, landmarkWalkInputs } from '../src/opus-bay/core/sfTerrain';
import { STAND_RADIUS, canStand, setCityTerrain } from '../src/opus-bay/core/terrain';
import { DISTRICT } from '../src/opus-bay/data/district';
import { ATTRACTIONS } from '../src/opus-bay/data/sf/attractions';
import { SF_ROUTES as ROUTES } from '../src/opus-bay/data/sf/routes';
import { SEAM_REGIONS, seamRegionAt } from '../src/opus-bay/world/sf/cornersNB';
import { SEAM_FILL } from '../src/opus-bay/world/sf/cornersSeamData';
import { cityDropLots } from '../src/opus-bay/world/sf/hero';
import { SF_LANDMARKS } from '../src/opus-bay/world/sf/landmarks/index';
import { sfDisk } from './opus-bay-sf-disk';

/**
 * Wave 7 · lane W1 · W7-W1 the Financial District's south-edge seam (world/sf/cornersNB.ts SEAM_REGIONS 'fidi-south',
 * scripts/opus-sf/seam-fill.mts → world/sf/cornersSeamData.ts). The start view: hero-owned city blocks the district
 * leaves empty between Kearny St and the Embarcadero get their OSM buildings back in city mode (the city's pools: no
 * draw call of their own), clear of the district's streets, lots, walk areas, props, the hero exclusions and the
 * walking graph. District mode is untouched (the fill only reaches the city worker's chunks).
 */

type P = { x: number; z: number };
const ring = (xz: readonly number[]): P[] => { const o: P[] = []; for (let k = 0; k < xz.length; k += 2) o.push({ x: xz[k], z: xz[k + 1] }); return o; };
function inPoly(x: number, z: number, p: readonly P[]) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c; }
  return c;
}
function segD(x: number, z: number, a: P, b: P) {
  const dx = b.x - a.x, dz = b.z - a.z, l = dx * dx + dz * dz, t = l ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l)) : 0;
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}
function ringDist(x: number, z: number, r: readonly P[]) {
  let d = Infinity;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) d = Math.min(d, segD(x, z, r[j], r[i]));
  return d;
}
const centroid = (r: readonly P[]) => r.reduce((s, p) => ({ x: s.x + p.x / r.length, z: s.z + p.z / r.length }), { x: 0, z: 0 });
const inFidi = (p: P) => inPoly(p.x, p.z, DISTRICT.slab) && seamRegionAt(p.x, p.z)?.id === 'fidi-south';
const FIDI = SEAM_FILL.filter(r => seamRegionAt(centroid(ring(r[7])).x, centroid(ring(r[7])).z)?.id === 'fidi-south');
const FIDI_RINGS = FIDI.map(r => ring(r[7]));
const inFidiFill = (x: number, z: number, pad = 0) => FIDI_RINGS.some(r => inPoly(x, z, r) || (pad > 0 && ringDist(x, z, r) < pad));

test('W7-W1 the seam regions: North Beach (W6) and the Financial District south edge, every row in one of them', () => {
  assert.deepEqual(SEAM_REGIONS.map(r => r.id), ['north-beach', 'fidi-south']);
  assert.equal(seamRegionAt(-64, 109)?.id, 'north-beach', 'Washington Square');
  assert.equal(seamRegionAt(120, 60)?.id, 'fidi-south', 'the start view');
  assert.equal(seamRegionAt(134, -12), null, 'the Ferry Building is not a seam');
  for (const r of SEAM_FILL) { const c = centroid(ring(r[7])); assert.ok(seamRegionAt(c.x, c.z), `${r[0]} in a region`); }
  assert.ok(FIDI.length >= 35, `${FIDI.length} buildings in the Financial District band`);
  assert.equal(new Set(SEAM_FILL.map(r => r[0])).size, SEAM_FILL.length, 'osm ids unique');
});

test('W7-W1 the FiDi fill stays clear of the district: lots, streets, walk areas, props, the hero exclusion circles', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1/manifest.json'), 'utf8')) as { heroDropLots: number[] };
  const hidden = new Set(cityDropLots(manifest.heroDropLots));
  const kept = DISTRICT.blocks.filter((_, i) => !hidden.has(i));
  const pos = (id: string) => DISTRICT.landmarks.find(l => l.id === id)!.position;
  const circles: [P, number, string][] = [
    [pos('transamerica'), 8.5, 'Transamerica'], [pos('salesforce-tower'), 7.5, 'Salesforce Tower'],
    [project(37.7949, -122.39465), 11, 'Embarcadero Plaza'], [project(37.79524, -122.40224), 4, 'Redwood Park'],
  ];
  const streets = DISTRICT.roads.filter(r => r.kind === 'roadway' || r.kind === 'path' || r.kind === 'track' || r.kind === 'crosswalk');
  for (const [k, r] of FIDI_RINGS.entries()) {
    const id = FIDI[k][0], c = centroid(r);
    assert.ok(inFidi(c), `${id} in the slab's FiDi band`);
    assert.ok(FIDI[k][5] >= 3.6 && FIDI[k][5] < 40, `${id} toy height ${FIDI[k][5]}`);
    for (const lot of kept) {
      for (const p of r) assert.ok(!inPoly(p.x, p.z, lot.footprint), `${id} reaches into ${lot.id}`);
      for (const p of lot.footprint) assert.ok(!inPoly(p.x, p.z, r), `${lot.id} reaches into ${id}`);
    }
    for (const p of r) {
      for (const [o, rr, name] of circles) assert.ok(Math.hypot(p.x - o.x, p.z - o.z) > rr, `${id} inside ${name}'s circle`);
      for (const s of streets) for (let i = 1; i < s.points.length; i++) assert.ok(segD(p.x, p.z, s.points[i - 1], s.points[i]) >= s.width / 2, `${id} on ${s.id}`);
      for (const w of DISTRICT.walk) assert.ok(!inPoly(p.x, p.z, w.polygon), `${id} in the walk area ${w.id}`);
    }
    for (const q of DISTRICT.props) assert.ok(!inPoly(q.x, q.z, r), `a district ${q.kind} at (${q.x}, ${q.z}) inside ${id}`);
  }
  // the wave-4 board spots (poles / kiosks: the Muni Embarcadero kiosk on Market St) keep 2.5 u of open ground
  const transit = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1/transit.json'), 'utf8')) as { props?: Record<string, [number, number]> };
  let boards = 0;
  for (const [sid, [x, z]] of Object.entries(transit.props ?? {})) {
    if (!inFidi({ x, z })) continue;
    boards++;
    assert.ok(!inFidiFill(x, z, 2.5), `the board spot ${sid} (${x}, ${z}) walled in by the fill`);
  }
  assert.ok(boards >= 1, 'the Muni Embarcadero kiosk is in the band');
});

test('W7-W1 the FiDi band still walks in city mode: graph edges clear, route stops and trip ends standable', async () => {
  const sf = sfDisk();
  const LMS = landmarkWalkInputs(SF_LANDMARKS);
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  await sf.attachAround(city, 150, 60, 150, LMS);
  setCityTerrain(city, { heroDropLots: new Set(cityDropLots(sf.manifest.heroDropLots)) });
  try {
    // the fill collides: the middle of the tallest FiDi fill building is not standable
    const tall = FIDI.reduce((a, b) => (b[5] > a[5] ? b : a)), tc = centroid(ring(tall[7]));
    assert.equal(canStand(tc.x, tc.z, STAND_RADIUS), false, `${tall[0]} is solid`);
    const g = await sf.graph();
    let edges = 0;
    for (let i = 0; i < g.nodeCount; i++) {
      const a = { x: g.xyz[3 * i], z: g.xyz[3 * i + 2] };
      for (let e = g.offsets[i]; e < g.offsets[i + 1]; e++) {
        const j = g.targets[e];
        if (j < i) continue;
        const b = { x: g.xyz[3 * j], z: g.xyz[3 * j + 2] };
        if (!inFidi(a) && !inFidi(b)) continue;
        edges++;
        const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / 0.5));
        for (let k = 0; k <= n; k++) {
          const x = a.x + ((b.x - a.x) * k) / n, z = a.z + ((b.z - a.z) * k) / n;
          assert.ok(!inFidiFill(x, z, 0.3), `graph edge ${i}–${j} runs into a fill building at (${x.toFixed(1)}, ${z.toFixed(1)})`);
        }
      }
    }
    assert.ok(edges > 100, `${edges} graph edges in the band`);
    let stops = 0;
    for (const r of ROUTES) for (const s of r.stops) if (inFidi(s)) { stops++; assert.ok(canStand(s.x, s.z, STAND_RADIUS), `route stop ${s.id} standable`); }
    let ends = 0;
    for (const a of ATTRACTIONS) {
      const e = a.arrival ?? { x: a.x, z: a.z };
      if (!inFidi(e)) continue;
      ends++;
      assert.ok(!inFidiFill(e.x, e.z, 0.3), `the trip end of ${a.id} (${e.x}, ${e.z}) is inside a fill building`);
    }
    assert.ok(stops + ends >= 1, `${stops} route stops, ${ends} trip ends in the band`);
  } finally { setCityTerrain(null); }
});
