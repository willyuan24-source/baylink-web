import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createCityTerrain, landmarkWalkInputs } from '../src/opus-bay/core/sfTerrain';
import { STAND_RADIUS, canStand, setCityTerrain } from '../src/opus-bay/core/terrain';
import { DISTRICT } from '../src/opus-bay/data/district';
import { SF_ROUTES as ROUTES } from '../src/opus-bay/data/sf/routes';
import { addSeamFill } from '../src/opus-bay/world/sf/build';
import { NB_CHURCH_ARRIVAL, NB_CHURCH_OSM, NB_CHURCH_SETBACK, NB_FRONT, NB_SQUARE, SEAM_REGION, nbDropLots } from '../src/opus-bay/world/sf/cornersNB';
import { NB_BUDGET, NB_COLUMBUS, NB_SPIRE_TOP, NB_TOWERS, buildNorthBeach, inFill, nbCafes, nbObstacles, nbPoles, nbSquareProps } from '../src/opus-bay/world/sf/cornersNorthBeach';
import { SEAM_FILL } from '../src/opus-bay/world/sf/cornersSeamData';
import { decodeChunkFile } from '../src/opus-bay/world/sf/format';
import { cityDropLots } from '../src/opus-bay/world/sf/hero';
import { SF_LANDMARKS } from '../src/opus-bay/world/sf/landmarks/index';
import { sfDisk } from './opus-bay-sf-disk';

/**
 * Wave 6 · lane W · W6-W1 the North Beach seam fill (world/sf/cornersSeamData.ts via world/sf/build.ts addSeamFill in
 * the stream worker) and W6-W2 the North Beach corner (world/sf/cornersNorthBeach.ts). District mode is untouched: the
 * fill only reaches the city's chunks and the drop lots only city mode (tests/opus-bay-hero-regression keeps the rest).
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
const RINGS = SEAM_FILL.map(r => ring(r[7]));
const centroid = (r: readonly P[]) => r.reduce((s, p) => ({ x: s.x + p.x / r.length, z: s.z + p.z / r.length }), { x: 0, z: 0 });

test('W6-W1 the seam fill: North Beach blocks the district leaves empty, inside the slab, clear of every lot city mode keeps', () => {
  assert.ok(SEAM_FILL.length >= 80, `${SEAM_FILL.length} buildings`);
  assert.equal(new Set(SEAM_FILL.map(r => r[0])).size, SEAM_FILL.length, 'osm ids unique');
  const manifest = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1/manifest.json'), 'utf8')) as { heroDropLots: number[] };
  const hidden = new Set(cityDropLots(manifest.heroDropLots));
  const kept = DISTRICT.blocks.filter((_, i) => !hidden.has(i));
  for (const [k, r] of RINGS.entries()) {
    const c = centroid(r), id = SEAM_FILL[k][0];
    assert.ok(inPoly(c.x, c.z, DISTRICT.slab) && c.x <= SEAM_REGION.xMax && c.z >= SEAM_REGION.zMin, `${id} in the slab's North Beach band`);
    assert.ok(SEAM_FILL[k][5] >= 3.6 && SEAM_FILL[k][5] < 40, `${id} toy height ${SEAM_FILL[k][5]}`);
    for (const lot of kept) {
      for (const p of r) assert.ok(!inPoly(p.x, p.z, lot.footprint), `${id} reaches into ${lot.id}`);
      for (const p of lot.footprint) assert.ok(!inPoly(p.x, p.z, r), `${lot.id} reaches into ${id}`);
    }
    for (const p of r) assert.ok(!inPoly(p.x, p.z, NB_SQUARE), `${id} stands in Washington Square`);
  }
  // the church: kept (its nave), set back behind the front; the plain district box on its site is hidden in city mode
  const ch = SEAM_FILL.find(r => r[0] === NB_CHURCH_OSM);
  assert.ok(ch, 'Saints Peter and Paul in the fill');
  for (const p of ring(ch[7])) {
    const d = (p.x - NB_FRONT.a.x) * NB_FRONT.n.x + (p.z - NB_FRONT.a.z) * NB_FRONT.n.z;
    assert.ok(d <= -NB_CHURCH_SETBACK + 0.02, `nave vertex ${d.toFixed(2)} behind the front`);
  }
  assert.deepEqual(nbDropLots(DISTRICT.blocks).map(i => DISTRICT.blocks[i].id), ['lot-211']);
});

test('W6-W1 addSeamFill: appended once to the chunk holding the centroid, the published buildings untouched', async () => {
  const file = path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1/c/-1_0.obc');
  const raw = await decodeChunkFile(new Uint8Array(fs.readFileSync(file)));
  const before = { count: raw.buildings.count, first: [...raw.buildings.xz.slice(0, 8)], ids: [...raw.buildings.osmId] };
  const mine = SEAM_FILL.filter(r => { const c = centroid(ring(r[7])); return Math.floor(c.x / 128) === -1 && Math.floor(c.z / 128) === 0; });
  const n = addSeamFill(raw, SEAM_FILL);
  assert.equal(n, mine.length);
  assert.ok(n > 30, `${n} in chunk -1_0`);
  assert.equal(raw.buildings.count, before.count + n);
  assert.deepEqual([...raw.buildings.xz.slice(0, 8)], before.first);
  assert.deepEqual([...raw.buildings.osmId.slice(0, before.count)], before.ids);
  assert.equal(raw.buildings.vStart[raw.buildings.count], raw.buildings.xz.length / 2);
  const k = before.count, r0 = mine[0];
  assert.equal(raw.buildings.osmId[k], r0[0]);
  assert.equal(raw.buildings.height[k], Math.fround(r0[5]));
  assert.equal(addSeamFill(raw, SEAM_FILL), 0, 'idempotent');
});

test('W6-W1 the band still walks: graph streets clear of the fill, the church steps and route r1 standable in city mode', async () => {
  const sf = sfDisk();
  const LMS = landmarkWalkInputs(SF_LANDMARKS);
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  await sf.attachAround(city, -60, 100, 170, LMS);
  setCityTerrain(city, { heroDropLots: new Set(cityDropLots(sf.manifest.heroDropLots)) });
  try {
    // the fill's buildings collide (the rasteriser saw them): the middle of the nave is not standable
    const ch = ring(SEAM_FILL.find(r => r[0] === NB_CHURCH_OSM)![7]), cc = centroid(ch);
    assert.equal(canStand(cc.x, cc.z, STAND_RADIUS), false, 'the nave is solid');
    // every walking-graph street edge through the band keeps a walker's disc clear of the fill
    const g = await sf.graph();
    let edges = 0;
    for (let i = 0; i < g.nodeCount; i++) {
      const a = { x: g.xyz[3 * i], z: g.xyz[3 * i + 2] };
      for (let e = g.offsets[i]; e < g.offsets[i + 1]; e++) {
        const j = g.targets[e];
        if (j < i) continue;
        const b = { x: g.xyz[3 * j], z: g.xyz[3 * j + 2] };
        const inBand = (p: P) => inPoly(p.x, p.z, DISTRICT.slab) && p.x <= SEAM_REGION.xMax && p.z >= SEAM_REGION.zMin;
        if (!inBand(a) && !inBand(b)) continue;
        edges++;
        const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / 0.5));
        for (let k = 0; k <= n; k++) {
          const x = a.x + ((b.x - a.x) * k) / n, z = a.z + ((b.z - a.z) * k) / n;
          assert.ok(!inFill(x, z), `graph edge ${i}–${j} runs into a fill building at (${x.toFixed(1)}, ${z.toFixed(1)})`);
        }
      }
    }
    assert.ok(edges > 100, `${edges} graph edges in the band`);
    // the church steps (the attraction's arrival, route r1's stop) and every route stop in the band stand
    assert.ok(canStand(NB_CHURCH_ARRIVAL.x, NB_CHURCH_ARRIVAL.z, STAND_RADIUS), 'the church steps');
    for (const t of NB_TOWERS) assert.ok(Math.hypot(t.x - NB_CHURCH_ARRIVAL.x, t.z - NB_CHURCH_ARRIVAL.z) > 1.2, 'the towers leave the steps open');
    let stops = 0;
    for (const r of ROUTES) for (const s of r.stops) {
      if (!(inPoly(s.x, s.z, DISTRICT.slab) && s.x <= SEAM_REGION.xMax && s.z >= SEAM_REGION.zMin)) continue;
      stops++;
      assert.ok(canStand(s.x, s.z, STAND_RADIUS), `route stop ${s.id} standable`);
    }
    assert.ok(stops >= 2, `${stops} route stops in the band`);
  } finally { setCityTerrain(null); }
});

test('W6-W2 the North Beach corner: 2 meshes within budget, the spires 12.2 u, cafés and poles on open sidewalk, the square clear', () => {
  const nb = buildNorthBeach();
  assert.ok(nb.signs, 'the plaques');
  assert.ok(nb.triangles <= NB_BUDGET.triangles, `${nb.triangles} triangles`);
  nb.toy.geometry.computeBoundingBox();
  const bb = nb.toy.geometry.boundingBox!;
  assert.ok(Math.abs(bb.max.y - NB_SPIRE_TOP) < 0.4, `spire tips at ${bb.max.y.toFixed(2)}`);
  assert.ok(bb.min.x > -125 && bb.max.x < 45 && bb.min.z > 90 && bb.max.z < 122, 'inside North Beach');
  const cafes = nbCafes();
  assert.ok(cafes.length >= 4, `${cafes.length} café clusters`);
  const near = (p: P) => NB_COLUMBUS.some((a, i) => i > 0 && segD(p.x, p.z, NB_COLUMBUS[i - 1], a) < 3.4);
  for (const c of cafes) {
    assert.ok(!inFill(c.x, c.z, 0.5) && !inPoly(c.x, c.z, NB_SQUARE), `café at (${c.x.toFixed(1)}, ${c.z.toFixed(1)}) on the sidewalk`);
    assert.ok(near(c), 'on Columbus Ave');
    assert.ok(NB_COLUMBUS.every((a, i) => i === 0 || segD(c.x, c.z, NB_COLUMBUS[i - 1], a) > 1.1), 'off the centreline');
  }
  for (const p of nbPoles(cafes)) assert.ok(!inFill(p.x, p.z, 0.15) && near(p), 'pole on the sidewalk');
  const sq = nbSquareProps();
  assert.ok(sq.trees.length >= 10 && sq.poplars.length === 6 && sq.benches.length >= 3);
  for (const p of [...sq.trees, ...sq.poplars, sq.statue]) assert.ok(inPoly(p.x, p.z, NB_SQUARE), 'the square\'s things stand in it');
  for (const o of nbObstacles(cafes)) assert.ok(Number.isFinite(o.x) && o.r > 0 && o.r < 1);
  nb.toy.geometry.dispose();
  nb.signs?.geometry.dispose();
});
