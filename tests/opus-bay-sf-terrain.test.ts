import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CITY_MAX_GROUND_Y, KIND, MAX_GROUND_Y, STAND_RADIUS, SURFACE_CODES, blockersNear, canStand, groundAt, heightAt, inSlab, inWorld,
  isLand, isWater, nearestWalkable, pointInPolygon, pushOutOfBlockers, setCityTerrain, standAt, surfaceAt, zoneAt,
} from '../src/opus-bay/core/terrain';
import {
  BLOCK_BIT, CITY_MAX_GROUND_Y as SF_MAX_Y, MAX_GRADE, ROAD_BLEND, SF_KIND, SF_STAND_RADIUS, SF_SURFACES, STAND_BIT, type ChunkRasters,
  PIER_DECK_Y, cornerHeight, createCityTerrain, deferredLandmark, groundRaster, landmarkWalkInputs, rasterHeight, rasterizeChunk, transferables,
} from '../src/opus-bay/core/sfTerrain';
import { COIT_POS, DISTRICT, SECTION, STATIONS, at, centroid } from '../src/opus-bay/data/district';
import { AREA_CLASSES, AREA_FLAG, type ChunkData, ROAD_CLASSES, ROAD_FLAG, demSample } from '../src/opus-bay/world/sf/format';
import { SF_LANDMARKS, landmarkToWorld, sfLandmark } from '../src/opus-bay/world/sf/landmarks/index';
import { sfDisk } from './opus-bay-sf-disk';

// City terrain (lane B, plan §5.6 / §5.1): rasteriser vs the published v1 data, the provider, and core/terrain's
// city-mode dispatch around the hero. Everything reads the real files under public/opus-bay/sf/.

const sf = sfDisk();
const LMS = landmarkWalkInputs(SF_LANDMARKS);
const code = (s: (typeof SURFACE_CODES)[number]) => SURFACE_CODES.indexOf(s) + 1;
const cellOf = (r: ChunkRasters, x: number, z: number) => Math.floor((z - r.cz * 128) / r.cell) * r.n + Math.floor((x - r.cx * 128) / r.cell);

/** Fingerprint of district-mode answers over the slab (heights, surfaces, standing, classes, nearest walkable, zones, blockers). */
function districtFingerprint(): string {
  let h = 0x811c9dc5;
  const feed = (v: string | number) => { const s = String(v); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } };
  for (let z = -110; z <= 120; z += 3.7) {
    for (let x = -250; x <= 250; x += 3.3) {
      feed(heightAt(x, z).toFixed(4)); feed(surfaceAt(x, z) ?? '-'); feed(canStand(x, z, 0.4) ? 1 : 0); feed(isLand(x, z) ? 1 : 0);
      feed(isWater(x, z) ? 1 : 0); feed(inWorld(x, z) ? 1 : 0); feed(zoneAt(x, z)?.id ?? '-'); feed(blockersNear(x, z, 0.6).length); feed(standAt(x, z));
    }
  }
  for (const p of Object.values(DISTRICT.anchors)) { const q = nearestWalkable({ x: p.x + 3, z: p.z - 2 }); feed(q ? `${q.x},${q.z}` : '-'); const o = pushOutOfBlockers(p.x + 1, p.z, 0.5); feed(`${o.x.toFixed(3)},${o.z.toFixed(3)}`); }
  return h.toString(16);
}

test('sfTerrain codes match core/terrain (surfaces incl. road, kinds, stand radius, ground ceiling)', () => {
  assert.deepEqual([...SF_SURFACES], SURFACE_CODES);
  assert.equal(SURFACE_CODES.length, 8);
  assert.equal(SURFACE_CODES[7], 'road');
  assert.deepEqual({ ...SF_KIND }, { ...KIND });
  assert.equal(SF_STAND_RADIUS, STAND_RADIUS);
  assert.equal(SF_MAX_Y, CITY_MAX_GROUND_Y);
});

test('district queries are unchanged, and registering then clearing a city provider restores them exactly', async () => {
  assert.equal(MAX_GROUND_Y, 28);
  const before = districtFingerprint();
  const city = createCityTerrain(sf.manifest);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  assert.equal(MAX_GROUND_Y, 120, 'city mode raises the ground-picker ceiling');
  setCityTerrain(null);
  assert.equal(MAX_GROUND_Y, 28);
  assert.equal(districtFingerprint(), before);
});

test('rasteriser vs decoded chunk: roads walkable as road, steps are stairs, buildings blocked, water never standable, heights follow DEM and roads', async () => {
  const keys = ['-1_1', '0_2', '-2_3', '1_4', '-3_8'];
  let roadHits = 0, roadN = 0, stairHits = 0, stairN = 0, bIn = 0, bN = 0, hErr = 0, hN = 0, yErr = 0, yN = 0;
  for (const k of keys) {
    const [cx, cz] = k.split('_').map(Number);
    const d = (await sf.chunk(cx, cz)) as ChunkData;
    const r = rasterizeChunk(d);
    const W = r.n + 1;
    assert.equal(r.n, 256); assert.equal(r.cell, 0.5); assert.equal(r.h.length, W * W);
    assert.ok(transferables(r).every(b => b instanceof ArrayBuffer));
    const inside = (x: number, z: number) => x > cx * 128 + 1 && x < cx * 128 + 127 && z > cz * 128 + 1 && z < cz * 128 + 127;
    // road / steps centrelines (interior of each segment, away from buildings and other roads' plateaus)
    for (let i = 0; i < d.roads.count; i++) {
      const cls = ROAD_CLASSES[d.roads.cls[i]], f = d.roads.flags[i];
      if (f & (ROAD_FLAG.deckOnly | ROAD_FLAG.noWalk) || cls === 'tram' || cls === 'rail') continue;
      for (let p = d.roads.pStart[i] + 1; p < d.roads.pStart[i + 1]; p++) {
        const x = (d.roads.xyz[3 * p - 3] + d.roads.xyz[3 * p]) / 2, y = (d.roads.xyz[3 * p - 2] + d.roads.xyz[3 * p + 1]) / 2, z = (d.roads.xyz[3 * p - 1] + d.roads.xyz[3 * p + 2]) / 2;
        if (!inside(x, z)) continue;
        const s = r.surf[cellOf(r, x, z)];
        if (cls === 'steps' || f & ROAD_FLAG.steps) {
          // steps win their own corridor; where OSM draws them inside a street (nearest centreline wins) or into a
          // building entrance the cell is that street / solid
          stairN++;
          if (s === code('stairs')) stairHits++;
          else assert.ok(s === code('road') || s === code('pavement') || s === code('plaza') || r.stand[cellOf(r, x, z)] & BLOCK_BIT, `${k}: steps cell is ${s}`);
        }
        else if (['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'service'].includes(cls)) {
          roadN++; if (s === code('road')) roadHits++;
          if (!(f & ROAD_FLAG.bridge)) { yN++; yErr += Math.abs(rasterHeight(r, x, z) - y); }
        }
      }
    }
    // buildings: interior cells are not walkable and carry the blocker bit
    for (let b = 0; b < d.buildings.count; b++) {
      const s = d.buildings.vStart[b], e = d.buildings.vStart[b + 1];
      const poly = []; for (let p = s; p < e; p++) poly.push({ x: d.buildings.xz[2 * p], z: d.buildings.xz[2 * p + 1] });
      const c0 = centroid(poly), c = { x: (Math.floor(c0.x / 0.5) + 0.5) * 0.5, z: (Math.floor(c0.z / 0.5) + 0.5) * 0.5 };
      if (!inside(c.x, c.z) || !pointInPolygon(c, poly)) continue;
      bN++;
      const i = cellOf(r, c.x, c.z);
      if (r.surf[i] === 0 && r.stand[i] & BLOCK_BIT && !(r.stand[i] & STAND_BIT)) bIn++;
    }
    // water is never walkable; standable cells are walkable land or deck; ground away from roads = DEM
    for (let i = 0; i < r.n * r.n; i++) {
      if (r.kind[i] === SF_KIND.water) assert.equal(r.surf[i], 0, `${k}: water cell ${i} walkable`);
      if (r.stand[i] & STAND_BIT) assert.ok(r.surf[i] && (r.kind[i] === SF_KIND.land || r.kind[i] === SF_KIND.deck), `${k}: stand on ${r.kind[i]}`);
    }
    for (let j = 4; j < W; j += 8) for (let i = 4; i < W; i += 8) {
      const x = cx * 128 + i * 0.5, z = cz * 128 + j * 0.5;
      let nearRoad = false;
      for (let q = 0; q < d.roads.count && !nearRoad; q++) {
        if (d.roads.flags[q] & ROAD_FLAG.deckOnly) continue;
        const reach = d.roads.width[q] / 2 + ROAD_BLEND + 0.05;
        for (let p = d.roads.pStart[q] + 1; p < d.roads.pStart[q + 1]; p++) {
          const ax = d.roads.xyz[3 * p - 3], az = d.roads.xyz[3 * p - 1], bx = d.roads.xyz[3 * p], bz = d.roads.xyz[3 * p + 2];
          const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
          if (Math.hypot(x - ax - dx * t, z - az - dz * t) < reach) { nearRoad = true; break; }
        }
      }
      if (nearRoad) continue;
      hN++; hErr = Math.max(hErr, Math.abs(cornerHeight(r, i, j) - demSample(d.dem, x, z)));
    }
  }
  assert.ok(roadN > 500 && roadHits / roadN > 0.97, `road centrelines walkable as road: ${roadHits}/${roadN}`);
  assert.ok(stairN > 50 && stairHits / stairN > 0.78, `steps are stairs: ${stairHits}/${stairN}`);
  assert.ok(bN > 800 && bIn / bN > 0.99, `building interiors blocked: ${bIn}/${bN}`);
  assert.ok(hN > 500 && hErr < 0.005, `ground away from roads = DEM (max err ${hErr.toFixed(4)} over ${hN})`);
  assert.ok(yN > 200 && yErr / yN < 0.12, `road surface follows the centreline y (mean err ${(yErr / yN).toFixed(3)})`);
});

test('steep ground (grade > 0.9, not stairs) is not walkable; the share of such land stays small', async () => {
  let land = 0, steep = 0, checked = 0;
  for (const k of ['1_-4', '-6_5', '0_7', '-2_4']) {
    const [cx, cz] = k.split('_').map(Number);
    const r = rasterizeChunk((await sf.chunk(cx, cz)) as ChunkData);
    const W = r.n + 1;
    for (let j = 0; j < r.n; j++) for (let i = 0; i < r.n; i++) {
      const c = j * r.n + i;
      if (r.kind[c] !== SF_KIND.land) continue;
      land++;
      const h00 = r.h[j * W + i], h10 = r.h[j * W + i + 1], h01 = r.h[(j + 1) * W + i], h11 = r.h[(j + 1) * W + i + 1];
      const gx = (h10 + h11 - h00 - h01) / 2 / 500 / 0.5, gz = (h01 + h11 - h00 - h10) / 2 / 500 / 0.5;
      if (Math.hypot(gx, gz) > MAX_GRADE + 0.01) {
        steep++;
        if (r.surf[c] !== code('stairs')) { checked++; assert.equal(r.surf[c], 0, `${k} cell ${i},${j} steep but walkable`); }
      }
    }
  }
  assert.ok(checked > 100, `found steep cells (${checked})`);
  assert.ok(steep / land < 0.2, `steep share in the hilliest sample chunks ${(steep / land * 100).toFixed(1)} %`);
});

test('provider: not resident → blocked (standAt −1), far DEM height; attach → standable; detach → blocked again', async () => {
  const city = createCityTerrain(sf.manifest);
  const far = await sf.far();
  city.setFar(far);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    const p = { x: 170, z: 150 }; // Market St, south of the slab
    assert.equal(standAt(p.x, p.z), -1);
    assert.equal(canStand(p.x, p.z, 0.4), false);
    assert.equal(surfaceAt(p.x, p.z), null);
    assert.ok(Math.abs(heightAt(p.x, p.z) - demSample(far.dem, p.x, p.z)) < 1e-6, 'far DEM height');
    assert.equal(isLand(p.x, p.z), true, 'far land mask');
    assert.equal(inWorld(p.x, p.z), true);
    assert.equal(inWorld(-3000, 0), false, 'beyond the model');
    const r = (await sf.rasters(1, 1)) as ChunkRasters;
    city.attach(r);
    assert.equal(city.resident(1, 1), true);
    assert.equal(surfaceAt(p.x, p.z), 'road');
    assert.equal(canStand(p.x, p.z, 0.4), true);
    assert.equal(standAt(p.x, p.z), 1);
    assert.ok(Math.abs(heightAt(p.x, p.z) - rasterHeight(r, p.x, p.z)) < 1e-9);
    city.detach(1, 1);
    assert.equal(standAt(p.x, p.z), -1);
    assert.equal(canStand(p.x, p.z, 0.4), false);
    assert.equal(nearestWalkable(p, 6), null, 'nothing walkable while unloaded');
    // open-water slots without a file are water, not "unloaded"
    assert.equal(standAt(-600, -300), 0);
    assert.equal(isWater(-600, -300), true);
  } finally { setCityTerrain(null); }
});

test('hero seam (city mode): heights continuous across the slab edge, the waterfront connects to the city, hero core rules hold', async () => {
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  await sf.attachAround(city, 0, 0, 280, LMS);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    // 1. height steps across every land stretch of the slab edge (0.5 u apart)
    const slab = DISTRICT.slab;
    let worst = 0, n = 0;
    for (let i = 0, j = slab.length - 1; i < slab.length; j = i++) {
      const a = slab[j], b = slab[i], L = Math.hypot(b.x - a.x, b.z - a.z), tx = (b.x - a.x) / L, tz = (b.z - a.z) / L;
      let nx = tz, nz = -tx;
      if (inSlab((a.x + b.x) / 2 + nx, (a.z + b.z) / 2 + nz)) { nx = -nx; nz = -nz; }
      for (let s = 1; s < L - 1; s += 0.5) {
        const px = a.x + tx * s, pz = a.z + tz * s, ix = px - nx * 0.3, iz = pz - nz * 0.3, ox = px + nx * 0.2, oz = pz + nz * 0.2;
        if (!isLand(ix, iz) || !isLand(ox, oz)) continue;
        n++; worst = Math.max(worst, Math.abs(heightAt(ix, iz) - heightAt(ox, oz)));
      }
    }
    assert.ok(n > 800, `seam samples ${n}`);
    assert.ok(worst < 0.3, `height step across the hero seam ${worst.toFixed(3)} u per 0.5 u`);

    // 2. waterfront (district semantics kept) and the Embarcadero barrier with crosswalks
    for (const name of ['ferry-gate', 'pier7-end', 'sea-lion-viewpoint', 'levis-plaza', 'coit-summit', 'filbert-steps-mid']) {
      const p = DISTRICT.anchors[name];
      assert.ok(canStand(p.x, p.z, 0.4), `${name} standable in city mode`);
    }
    for (const st of [40, 100, 220, 320]) for (const d of [-7.2, -14.3, -19.35]) assert.equal(surfaceAt(at(st, d).x, at(st, d).z), null, `Embarcadero roadway st ${st} d ${d} stays a barrier`);
    for (const st of [STATIONS.stopFerry, STATIONS.stopGreen, STATIONS.stopBay, STATIONS.stopPier39]) {
      for (const d of [-7, -10.5, -14.3, -19.3, -23]) { const p = at(st, d); assert.ok(canStand(p.x, p.z, 0.4), `crosswalk at stop st ${st} d ${d}`); }
    }
    const walk = at(150, (SECTION.sidewalk[0] + SECTION.sidewalk[1]) / 2);
    assert.equal(surfaceAt(walk.x, walk.z), 'pavement', 'landward sidewalk');
    // 3. hero inland: streets walkable as road, kept lots solid, the dropped lot open to the city, Pioneer Park core
    const drumm = DISTRICT.roads.find(r => r.id === 'street-drumm-0')!;
    assert.equal(surfaceAt(drumm.points[1].x, drumm.points[1].z), 'road');
    let solid = 0;
    DISTRICT.blocks.forEach((b, i) => { if (i === 232) return; const c = centroid(b.footprint); if (pointInPolygon(c, b.footprint) && !canStand(c.x, c.z, 0.3)) solid++; });
    assert.ok(solid >= DISTRICT.blocks.length - 3, `kept hero lots solid (${solid}/${DISTRICT.blocks.length - 1})`);
    const dropC = centroid(DISTRICT.blocks[232].footprint);
    assert.equal(blockersNear(dropC.x, dropC.z, 0.3).filter(b => b.kind === 'polygon' && b.polygon === DISTRICT.blocks[232].footprint).length, 0, 'dropped hero lot is not a blocker');
    const park = { x: COIT_POS.x + 5, z: COIT_POS.z + 14.5 };
    assert.equal(surfaceAt(park.x, park.z), DISTRICT.walk.some(w => pointInPolygon(park, w.polygon)) ? surfaceAt(park.x, park.z) : null, 'Pioneer Park slope: only hero paths');
    // 4. a walker can leave the hero: standable path cells exist on both sides of the south edge along Drumm / Market
    assert.ok(nearestWalkable({ x: 170, z: 118 }, 3), 'city side of the south edge');
    assert.ok(nearestWalkable({ x: 170, z: 110 }, 3), 'hero side of the south edge');
    assert.equal(zoneAt(DISTRICT.anchors['ferry-gate'].x, DISTRICT.anchors['ferry-gate'].z)?.id, 'ferry', 'hero zones first');
    assert.equal(zoneAt(140, 946)?.id, 'twin-peaks', 'city neighbourhoods from far.zones');
  } finally { setCityTerrain(null); }
});

test('chunk borders: heights are C0 and steps across a border are no bigger than beside it; overhangs are stamped in either attach order', async () => {
  const keys = ['-1_1', '0_1', '-1_2', '0_2', '1_1', '1_2'];
  const load = async (order: string[]) => {
    const city = createCityTerrain(sf.manifest);
    for (const k of order) { const [cx, cz] = k.split('_').map(Number); city.attach((await sf.rasters(cx, cz)) as ChunkRasters); }
    return city;
  };
  const a = await load(keys), b = await load([...keys].reverse());
  for (const k of keys) {
    const [cx, cz] = k.split('_').map(Number);
    const ra = a.rasters(cx, cz)!, rb = b.rasters(cx, cz)!;
    assert.deepEqual(ra.stand, rb.stand, `${k}: stand independent of attach order`);
    assert.deepEqual(ra.surf, rb.surf, `${k}: surf independent of attach order`);
  }
  // an overhanging footprint blocks the neighbour's cells
  let found = 0;
  for (const k of keys) {
    const [cx, cz] = k.split('_').map(Number);
    const r = a.rasters(cx, cz)!, B = r.blockers;
    for (let q = 0; q < B.overhang.length && found < 20; q++) {
      const i = B.overhang[q];
      for (let p = B.vStart[i]; p < B.vStart[i + 1]; p++) {
        const x = B.xz[2 * p], z = B.xz[2 * p + 1];
        const inset = { x: x + (B.bbox[4 * i] + B.bbox[4 * i + 2] - 2 * x) * 0.02, z: z + (B.bbox[4 * i + 1] + B.bbox[4 * i + 3] - 2 * z) * 0.02 };
        const nx = Math.floor(inset.x / 128), nz = Math.floor(inset.z / 128);
        if (nx === cx && nz === cz) continue;
        const nr = a.rasters(nx, nz);
        if (!nr) continue;
        assert.ok(nr.stand[cellOf(nr, inset.x, inset.z)] & BLOCK_BIT, `overhang of ${k} #${i} stamped into ${nx}_${nz}`);
        assert.equal(a.hitsBlocker(inset.x, inset.z, 0.1), true);
        found++;
        break;
      }
    }
  }
  assert.ok(found > 5, `overhanging buildings checked: ${found}`);
  // C0 and step size across shared edges
  let disc = 0, excess = 0, n = 0;
  const h = (x: number, z: number) => a.heightAt(x, z)!;
  for (const X of [0, 128]) for (let z = 128.25; z < 384; z += 0.5) {
    disc = Math.max(disc, Math.abs(h(X - 1e-4, z) - h(X + 1e-4, z)));
    const s = Math.abs(h(X + 0.25, z) - h(X - 0.25, z)), side = Math.max(Math.abs(h(X - 0.25, z) - h(X - 0.75, z)), Math.abs(h(X + 0.75, z) - h(X + 0.25, z)));
    excess = Math.max(excess, s - side); n++;
  }
  for (const Z of [256]) for (let x = -127.75; x < 256; x += 0.5) {
    disc = Math.max(disc, Math.abs(h(x, Z - 1e-4) - h(x, Z + 1e-4)));
    const s = Math.abs(h(x, Z + 0.25) - h(x, Z - 0.25)), side = Math.max(Math.abs(h(x, Z - 0.25) - h(x, Z - 0.75)), Math.abs(h(x, Z + 0.75) - h(x, Z + 0.25)));
    excess = Math.max(excess, s - side); n++;
  }
  assert.ok(n > 1000);
  assert.ok(disc < 0.01, `height discontinuity at chunk borders ${disc.toFixed(4)}`);
  assert.ok(excess < 0.3, `extra step across chunk borders ${excess.toFixed(3)} u per 0.5 u`);
});

test('landmarks: Golden Gate Bridge deck walkable over open water (synthesised slots), landmark blockers solid, excluded city buildings gone', async () => {
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  await sf.attachAround(city, -700, 500, 200, LMS);
  await sf.attachAround(city, 90, 420, 60, LMS);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    const ggb = sfLandmark('golden-gate-bridge')!;
    for (const s of [-100, -40, 0, 40, 100]) {
      const p = landmarkToWorld(ggb, { x: s, z: 0 });
      assert.ok(canStand(p.x, p.z, 0.4), `GGB deck s=${s}`);
      assert.ok(Math.abs(heightAt(p.x, p.z) - 15.2) < 0.05, `deck height at s=${s}: ${heightAt(p.x, p.z)}`);
      assert.equal(surfaceAt(p.x, p.z), 'road');
    }
    const off = landmarkToWorld(ggb, { x: 0, z: 8 });
    assert.equal(canStand(off.x, off.z, 0.4), false, 'beside the deck is the strait');
    assert.ok(city.stats().synthesised >= 2);
    // City Hall: its walk blockers are solid, and no OSM building inside its exclude is left as a blocker
    const hall = sfLandmark('city-hall')!;
    assert.equal(canStand(hall.x, hall.z, 0.4), false, 'inside City Hall');
    const osm = city.rasters(Math.floor(hall.x / 128), Math.floor(hall.z / 128))!;
    const ex = hall.exclude;
    let insideExclude = 0;
    for (let k = 0; k < osm.blockers.count; k++) {
      let mx = 0, mz = 0; const s = osm.blockers.vStart[k], e = osm.blockers.vStart[k + 1];
      for (let p = s; p < e; p++) { mx += osm.blockers.xz[2 * p]; mz += osm.blockers.xz[2 * p + 1]; }
      mx /= e - s; mz /= e - s;
      if ('r' in ex ? Math.hypot(mx - hall.x, mz - hall.z) < ex.r : pointInPolygon({ x: mx, z: mz }, ex.poly)) insideExclude++;
    }
    assert.equal(insideExclude, 0, 'city buildings inside the City Hall exclude are dropped');
    // city building blockers carry their wall top (world y) for the glide / camera
    const b0 = blockersNear(hall.x + 30, hall.z, 30).find(b => b.top !== undefined);
    assert.ok(b0 && b0.top! > 2, 'city blockers report top');
  } finally { setCityTerrain(null); }
});

test('landmark decks on a terrain base: deferred to the provider, one base on both sides of a chunk border, pinned / re-stamped exactly', async () => {
  const t = sfLandmark('cable-car-turntable')!;
  const far = await sf.far();
  // what lane C's streamer sends before its bases are refined: 'terrain' landmarks with baseY 0
  const lms = landmarkWalkInputs(SF_LANDMARKS).map(l => (l.base === 'terrain' ? { ...l, baseY: 0 } : l));
  const tIn = lms.find(l => l.id === t.id)!;
  assert.ok(deferredLandmark(tIn) && !deferredLandmark(lms.find(l => l.id === 'lombard-crooked-street')!), 'only terrain-based decks are deferred');
  const cx = Math.floor(t.x / 128), cz = Math.floor(t.z / 128);
  // the turntable sits on the corner of four chunks; the centre chunk is (cx, cz)
  const keys: [number, number][] = [[cx - 1, cz - 1], [cx, cz - 1], [cx - 1, cz], [cx, cz]];
  assert.ok(Math.floor((t.x - 2.55) / 128) === cx - 1 && Math.floor((t.z - 1.7) / 128) === cz - 1, 'the disc crosses both borders');
  // the worker leaves the deferred decks alone: the disc is plain street ground there
  const raw = (await sf.rasters(cx, cz, lms))!;
  const disc = landmarkToWorld(t, { x: 0, z: 1 });
  assert.notEqual(raw.surf[cellOf(raw, disc.x, disc.z)], code('wood'), 'worker: no deck');

  const snap = (city: ReturnType<typeof createCityTerrain>) => keys.map(([x, z]) => { const r = city.rasters(x, z)!; return [r.h.slice(), r.surf.slice(), r.stand.slice()]; });
  const check = (city: ReturnType<typeof createCityTerrain>, base: number) => {
    assert.equal(city.surfaceCode(disc.x, disc.z), code('wood'), 'disc');
    const apron = landmarkToWorld(t, { x: 0, z: -3.9 });
    assert.equal(city.surfaceCode(apron.x, apron.z), code('plaza'), 'apron ring');
    // ≥ 0.5 u inside the disc (heights are sampled at 0.5 u corners), in three of the four chunks
    for (const w of [{ x: t.x, z: t.z }, { x: t.x - 2.55, z: t.z }, { x: t.x, z: t.z - 1.7 }, { x: t.x + 1.5, z: t.z + 1.5 }]) {
      assert.ok(Math.abs(city.heightAt(w.x, w.z)! - (base + 0.12)) < 0.01, `disc at base + 0.12 at (${w.x.toFixed(1)}, ${w.z.toFixed(1)}): ${city.heightAt(w.x, w.z)} vs ${base + 0.12}`);
    }
    assert.ok(Math.abs(city.heightAt(apron.x, apron.z)! - (base + 0.04)) < 0.01, 'apron at base + 0.04');
    assert.ok(city.standAt(disc.x, disc.z) === 1, 'the disc is standable');
  };
  // neighbours first (far estimate), then the centre chunk (the renderer's refined base) → all re-stamped
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(far);
  for (const [x, z] of keys.slice(0, 3)) city.attach((await sf.rasters(x, z, lms))!);
  const est = city.landmarkBase(t.id)!;
  assert.ok(est > 0.5, `far estimate ${est}, not the hint 0`);
  city.attach((await sf.rasters(cx, cz, lms))!);
  const base = city.landmarkBase(t.id)!;
  assert.notEqual(base, est);
  check(city, base);
  // the other attach order gives identical rasters
  const city2 = createCityTerrain(sf.manifest, { landmarks: lms });
  city2.setFar(far);
  for (const [x, z] of [...keys].reverse()) city2.attach((await sf.rasters(x, z, lms))!);
  assert.equal(city2.landmarkBase(t.id), base);
  const before = snap(city);
  assert.deepEqual(before, snap(city2));
  // the renderer pins its base: decks move, and pinning back restores every raster exactly
  assert.equal(city.setLandmarkBase(t.id, base + 0.5), true);
  check(city, base + 0.5);
  city.setLandmarkBase(t.id, base);
  assert.deepEqual(snap(city), before);
  assert.equal(city.setLandmarkBase('no-such-landmark', 1), false);
  // through core/terrain, and after a detach / re-attach
  setCityTerrain(city);
  try {
    assert.equal(surfaceAt(disc.x, disc.z), 'wood');
    city.detach(cx, cz);
    city.attach((await sf.rasters(cx, cz, lms))!);
    check(city, base);
  } finally { setCityTerrain(null); }
});

test('every landmark deck of lane D is walkable with its surface and height (Lombard slices, terraces, GGB), every landmark blocker is solid', async () => {
  const far = await sf.far();
  const lms = landmarkWalkInputs(SF_LANDMARKS, (x, z) => demSample(far.dem, x, z));
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(far);
  const inPoly = (p: { x: number; z: number }, poly: { x: number; z: number }[]) => pointInPolygon(p, poly);
  let decks = 0, solid = 0, heights = 0, walled = 0;
  for (const l of SF_LANDMARKS) {
    if (!l.walk) continue;
    const pts = [...l.walk.blockers.flatMap(b => ('poly' in b ? b.poly : [b])), ...(l.walk.surfaces ?? []).flatMap(q => q.poly)].map(q => landmarkToWorld(l, q));
    const reach = Math.max(8, ...pts.map(q => Math.hypot(q.x - l.x, q.z - l.z)));
    await sf.attachAround(city, l.x, l.z, reach + 4, lms);
    const base = city.landmarkBase(l.id)!;
    const blockers = l.walk.blockers.map(b => ('poly' in b ? { poly: b.poly.map(q => landmarkToWorld(l, q)) } : { c: landmarkToWorld(l, b), r: b.r }));
    const nearBlocker = (p: { x: number; z: number }, m: number) => blockers.some(b => ('poly' in b ? inPoly(p, b.poly) || b.poly.some((q, i) => { const a = b.poly[(i + 1) % b.poly.length], dx = a.x - q.x, dz = a.z - q.z, t = Math.max(0, Math.min(1, ((p.x - q.x) * dx + (p.z - q.z) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(p.x - q.x - dx * t, p.z - q.z - dz * t) < m; }) : Math.hypot(p.x - b.c.x, p.z - b.c.z) < b.r + m));
    const surfaces = (l.walk.surfaces ?? []).map(q => ({ ...q, poly: q.poly.map(v => landmarkToWorld(l, v)) }));
    surfaces.forEach(q => {
      const c = centroid(q.poly);
      // the first listed surface containing the point wins; skip points under a blocker or at a deck's rim
      const first = surfaces.find(o => inPoly(c, o.poly))!;
      if (first !== q || nearBlocker(c, 0.3)) return;
      const cc = { x: (Math.floor(c.x / 0.5) + 0.5) * 0.5, z: (Math.floor(c.z / 0.5) + 0.5) * 0.5 };
      if (!inPoly(cc, q.poly) || surfaces.find(o => inPoly(cc, o.poly)) !== q) return;
      // a visible city house can overlap a deck's edge (Lombard's stairs): the house wins
      if (city.hitsBlocker(cc.x, cc.z, 0.001)) { walled++; return; }
      decks++;
      assert.equal(city.surfaceCode(cc.x, cc.z), code(q.surface), `${l.id}: ${q.surface} deck at (${cc.x}, ${cc.z})`);
      if (q.y !== 'terrain') {
        // heights are bilinear over the 0.5 u corners around the point: where every corner lies on a numeric deck,
        // the height is within their range (Lombard's 0.45 u slices climb ≤ 0.36 u each)
        const x0 = Math.floor(c.x / 0.5) * 0.5, z0 = Math.floor(c.z / 0.5) * 0.5;
        const ys = [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]].map(([dx, dz]) => surfaces.find(o => inPoly({ x: x0 + dx, z: z0 + dz }, o.poly))).map(o => (o && o.y !== 'terrain' ? base + o.y : NaN));
        if (ys.some(Number.isNaN)) return;
        const h = city.heightAt(c.x, c.z)!;
        heights++;
        assert.ok(h > Math.min(...ys) - 0.01 && h < Math.max(...ys) + 0.01, `${l.id}: deck y ${(base + q.y).toFixed(3)} vs ${h.toFixed(3)}`);
      }
    });
    for (const b of blockers) {
      const p = 'poly' in b ? centroid(b.poly) : b.c;
      if ('poly' in b && !inPoly(p, b.poly)) continue;
      solid++;
      assert.equal(city.hitsBlocker(p.x, p.z, 0.05), true, `${l.id}: blocker at (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
      const ra = city.rasters(Math.floor(p.x / 128), Math.floor(p.z / 128));
      if (ra) assert.ok(ra.stand[cellOf(ra, p.x, p.z)] & BLOCK_BIT, `${l.id}: blocker stamped`);
    }
  }
  assert.ok(decks > 120 && heights > 80 && solid > 90 && walled < decks * 0.1, `decks checked ${decks} (heights ${heights}, beside walls ${walled}), blockers ${solid}`);
  // Lombard: the crooked lane climbs (road slices) and the stairs are stairs, from Leavenworth up to Hyde
  const lom = sfLandmark('lombard-crooked-street')!;
  const ys = lom.walk!.surfaces!.filter(q => q.surface === 'road').map(q => q.y as number);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 5, 'the lane climbs');
  assert.ok(lom.walk!.surfaces!.filter(q => q.surface === 'stairs').length >= 40);
  // Twin Peaks terrace and the Cliff House terrace are plazas above their bases
  for (const id of ['twin-peaks', 'cliff-house']) {
    const l = sfLandmark(id)!, q = l.walk!.surfaces![0], c = landmarkToWorld(l, centroid(q.poly));
    assert.equal(city.surfaceCode(c.x, c.z), code(q.surface), `${id} terrace`);
    assert.ok(Math.abs(city.heightAt(c.x, c.z)! - ((l.base as number) + (q.y as number))) < 0.02, `${id} terrace height`);
  }
});

test('the renderer sink inside landmark exclusions is followed by collision (decks keep their y)', async () => {
  const far = await sf.far();
  const base = landmarkWalkInputs(SF_LANDMARKS, (x, z) => demSample(far.dem, x, z));
  const sunk = base.map(l => (l.id === 'golden-gate-bridge' ? l : { ...l, sink: 0.2 }));
  for (const id of ['city-hall', 'ghirardelli-square']) {
    const l = sfLandmark(id)!, cx = Math.floor(l.x / 128), cz = Math.floor(l.z / 128);
    const d = (await sf.chunk(cx, cz))!;
    const a = rasterizeChunk(d, { landmarks: base }), b = rasterizeChunk(d, { landmarks: sunk });
    const inEx = (x: number, z: number) => ('r' in l.exclude ? Math.hypot(x - l.x, z - l.z) < l.exclude.r : pointInPolygon({ x, z }, l.exclude.poly));
    const decks = (l.walk?.surfaces ?? []).filter(q => q.y !== 'terrain').map(q => q.poly.map(v => landmarkToWorld(l, v)));
    let lowered = 0, same = 0;
    for (let j = 0; j <= 256; j += 1) for (let i = 0; i <= 256; i += 1) {
      const x = cx * 128 + i * 0.5, z = cz * 128 + j * 0.5, dh = cornerHeight(a, i, j) - cornerHeight(b, i, j);
      if (decks.some(q => pointInPolygon({ x, z }, q))) { assert.ok(Math.abs(dh) < 1e-3, `${id}: deck corner kept`); continue; }
      if (inEx(x, z) && SF_LANDMARKS.findIndex(o => o.id !== 'golden-gate-bridge' && ('r' in o.exclude ? Math.hypot(x - o.x, z - o.z) < o.exclude.r : pointInPolygon({ x, z }, o.exclude.poly))) === SF_LANDMARKS.indexOf(l)) {
        assert.ok(Math.abs(dh - 0.2) < 0.003, `${id}: sunk corner (${x}, ${z}) by ${dh}`); lowered++;
      } else if (!SF_LANDMARKS.some(o => 'r' in o.exclude ? Math.hypot(x - o.x, z - o.z) < o.exclude.r + 0.01 : pointInPolygon({ x, z }, o.exclude.poly))) { assert.equal(dh, 0); same++; }
    }
    assert.ok(lowered > 200 && same > 10000, `${id}: lowered ${lowered}, unchanged ${same}`);
  }
});

test('groundRaster = the walked ground of rasterizeChunk (for the renderer); pier decks are flat wood at PIER_DECK_Y', async () => {
  let piers = 0;
  for (const k of ['-1_1', '2_0', '4_1', '4_2', '9_4']) {
    const [cx, cz] = k.split('_').map(Number);
    const d = await sf.chunk(cx, cz);
    if (!d) continue;
    const g = groundRaster(d), r = rasterizeChunk(d);
    assert.deepEqual(g.h, r.h, `${k}: same heights`);
    assert.equal(rasterHeight(g, cx * 128 + 40.3, cz * 128 + 71.9), rasterHeight(r, cx * 128 + 40.3, cz * 128 + 71.9));
    // pier decks over water: 'wood' deck cells at PIER_DECK_Y away from roads
    for (let i = 0; i < d.areas.count; i++) {
      if (AREA_CLASSES[d.areas.cls[i]] !== 'pier' || d.areas.flags[i] & AREA_FLAG.hole) continue;
      const poly = []; for (let p = d.areas.pStart[i]; p < d.areas.pStart[i + 1]; p++) poly.push({ x: d.areas.xz[2 * p], z: d.areas.xz[2 * p + 1] });
      const c = centroid(poly);
      if (!pointInPolygon(c, poly) || c.x < cx * 128 + 1 || c.z < cz * 128 + 1 || c.x > cx * 128 + 127 || c.z > cz * 128 + 127) continue;
      const cell = cellOf(r, c.x, c.z);
      if (r.kind[cell] !== SF_KIND.deck || r.surf[cell] !== code('wood')) continue;
      const nearRoad = Math.abs(rasterHeight(r, c.x, c.z) - PIER_DECK_Y) > 1e-3;
      if (!nearRoad) piers++;
      else assert.ok(rasterHeight(r, c.x, c.z) < 0.6, `${k}: pier road near deck level`);
    }
  }
  assert.ok(piers >= 3, `flat pier decks checked: ${piers}`);
});

test('city-mode queries stay O(1): 200k canStand + heightAt over hero and city < 1.5 s', async () => {
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  await sf.attachAround(city, 0, 60, 250, LMS);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    const t0 = performance.now();
    let n = 0;
    for (let i = 0; i < 200000; i++) {
      const x = -300 + (i % 600), z = -100 + ((i * 7) % 400);
      if (canStand(x, z, 0.4)) n++;
      heightAt(x + 0.3, z + 0.7);
    }
    const ms = performance.now() - t0;
    assert.ok(n > 20000, `standable samples ${n}`);
    assert.ok(ms < 1500, `200k city canStand+heightAt took ${ms.toFixed(0)} ms`);
    const g = groundAt(170, 150);
    assert.equal(g.surface, 'road');
    const pushed = pushOutOfBlockers(DISTRICT.anchors['ferry-gate'].x, DISTRICT.anchors['ferry-gate'].z, 0.4);
    assert.ok(Math.hypot(pushed.x - DISTRICT.anchors['ferry-gate'].x, pushed.z - DISTRICT.anchors['ferry-gate'].z) < 1e-9);
  } finally { setCityTerrain(null); }
});
