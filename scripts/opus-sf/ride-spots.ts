// Lane E2, wave 3 (E2-12): city bike racks and benches → src/opus-bay/data/sf/rideSpots.ts (generated).
//
//   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/ride-spots.ts [--check]
//
// Reads the published city (public/opus-bay/sf/<current>: chunk props 'bike-rack' and 'bench'), keeps what the
// renderer draws (world/sf/build.ts furniture(): not on the hero slab, not inside a landmark's exclusion), attaches
// every chunk to a city terrain provider (with the landmarks' walk inputs, as the streamer does) and verifies each
// spot the way the district spots are checked (tests/opus-bay-sf-modes):
//   - a bike: parked beside its rack (1 u to the rack's left, parallel to it, as data/vehicles.ts bikeSpots; else the
//     right side, else 1.4 u out), the hull fits (actors/vehicles/collide poseCheck) and a door slot is clear
//     (actors/modes pickExitSlot);
//   - a bench: the seat on the drawn bench (seat top 0.46 u, facing its rotation), the spot to stand up at 1.1 u in
//     front of it is standable, the sit prompt 0.9 u in front is on walkable ground.
// --check: exit 1 when the committed file differs from what this run computes.
import fs from 'node:fs';
import path from 'node:path';
import { canStand, heightAt, inSlab, setCityTerrain, surfaceAt } from '../../src/opus-bay/core/terrain';
import { createCityTerrain, landmarkWalkInputs } from '../../src/opus-bay/core/sfTerrain';
import { PROP_KINDS } from '../../src/opus-bay/world/sf/format';
import { CitySites } from '../../src/opus-bay/world/sf/sites';
import { pickExitSlot } from '../../src/opus-bay/actors/modes';
import { BIKE_LENGTH, BIKE_SPEC, BIKE_WIDTH } from '../../src/opus-bay/actors/vehicles/bike';
import { TERRAIN_WORLD, poseCheck } from '../../src/opus-bay/actors/vehicles/collide';
import { sfDisk } from '../../tests/opus-bay-sf-disk';

const REPO = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(REPO, 'src/opus-bay/data/sf/rideSpots.ts');
const t0 = Date.now();
const log = (s: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const PK = Object.fromEntries(PROP_KINDS.map((c, i) => [c, i])) as Record<(typeof PROP_KINDS)[number], number>;

const sf = sfDisk();
const sites = new CitySites();
const LMS = landmarkWalkInputs(sites.walkInputs());
const city = createCityTerrain(sf.manifest, { landmarks: LMS });
city.setFar(await sf.far());
await sf.attachAll(city, LMS);
setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
log(`city attached (${sf.manifest.chunks.length} chunks)`);

// the renderer's exclusions (world/sf/build.ts chunkContext: circles as circumscribed 16-gons)
const R16 = 1 / Math.cos(Math.PI / 16);
const excl = sites.excludes();
const inPoly = (x: number, z: number, poly: readonly { x: number; z: number }[]) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};
const excluded = (x: number, z: number) => excl.some(e => (e.poly ? inPoly(x, z, e.poly) : Math.hypot(x - (e.x ?? 0), z - (e.z ?? 0)) < (e.r ?? 0) * R16));

interface Bike { id: string; x: number; z: number; heading: number; livery: number }
interface Bench { id: string; x: number; z: number; heading: number; y: number }
const bikes: Bike[] = [], benches: Bench[] = [];
const skipped = { slab: 0, excluded: 0, bikeFit: 0, benchFront: 0 };
const SLOTS = { canStand, heightAt };

for (const c of [...sf.manifest.chunks].sort((a, b) => a.cz - b.cz || a.cx - b.cx)) {
  const chunk = await sf.chunk(c.cx, c.cz);
  if (!chunk) continue;
  const p = chunk.props;
  for (let i = 0; i < p.count; i++) {
    const k = p.kind[i];
    if (k !== PK.bench && k !== PK['bike-rack']) continue;
    const x = p.xz[i * 2], z = p.xz[i * 2 + 1], rot = p.rot[i];
    if (inSlab(x, z)) { skipped.slab++; continue; }
    if (excluded(x, z)) { skipped.excluded++; continue; }
    if (k === PK['bike-rack']) {
      let ok: Bike | null = null;
      for (const side of [1, -1, 1.4, -1.4]) {
        const bx = x + Math.cos(rot) * side, bz = z - Math.sin(rot) * side;
        if (!poseCheck(TERRAIN_WORLD, BIKE_SPEC, bx, bz, rot).ok) continue;
        if (!pickExitSlot(SLOTS, { x: bx, z: bz, y: heightAt(bx, bz), heading: rot }, BIKE_WIDTH, BIKE_LENGTH)) continue;
        ok = { id: `city-bike-${bikes.length}`, x: r2(bx), z: r2(bz), heading: r3(rot), livery: bikes.length % 3 };
        break;
      }
      if (ok) bikes.push(ok); else skipped.bikeFit++;
    } else {
      const sx = x + Math.sin(rot) * 0.08, sz = z + Math.cos(rot) * 0.08;
      const fx = x + Math.sin(rot) * 1.1, fz = z + Math.cos(rot) * 1.1, px = x + Math.sin(rot) * 0.9, pz = z + Math.cos(rot) * 0.9;
      if (!canStand(fx, fz, 0.45) || !surfaceAt(px, pz)) { skipped.benchFront++; continue; }
      benches.push({ id: `seat:city-bench-${benches.length}`, x: r2(sx), z: r2(sz), heading: r3(rot), y: 0.46 });
    }
  }
}
log(`${bikes.length} bike spots, ${benches.length} benches; skipped ${JSON.stringify(skipped)}`);

const row = (o: object) => `  { ${Object.entries(o).map(([k, v]) => `${k}: ${typeof v === 'string' ? `'${v}'` : v}`).join(', ')} },`;
const text = `/**
 * City rideables (lane E2, wave 3, E2-12). GENERATED by scripts/opus-sf/ride-spots.ts from the published city
 * (${sf.version}: chunk props 'bike-rack' and 'bench' the renderer draws — not on the hero slab, not inside a landmark's
 * exclusion); do not edit by hand, run the script again when the city is republished (\`--check\` compares).
 *
 * - CITY_BIKE_SPOTS: where a toy bike waits beside a city bike rack (1 u to the rack's side, parallel to it); each pose
 *   passed collide.poseCheck with a clear door slot. actors/vehicles/cityBikes.ts parks at most 4 pooled bikes at the
 *   spots near the player.
 * - CITY_BENCHES: seats on the city benches (seat top 0.46 u, facing \`heading\`), standable in front; merged into the
 *   movement system's seats in city mode.
 */

export interface CityBikeSpot { id: string; x: number; z: number; heading: number; livery: number }
export interface CityBench { id: string; x: number; z: number; heading: number; y: number }

export const RIDE_SPOTS_CITY = '${sf.version}';

export const CITY_BIKE_SPOTS: readonly CityBikeSpot[] = [
${bikes.map(row).join('\n')}
];

export const CITY_BENCHES: readonly CityBench[] = [
${benches.map(row).join('\n')}
];
`;
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
  if (cur !== text) { console.error(`${path.relative(REPO, OUT)} differs from this run`); process.exit(1); }
  log('rideSpots.ts is up to date');
} else {
  fs.writeFileSync(OUT, text);
  log(`wrote ${path.relative(REPO, OUT)}`);
}
setCityTerrain(null);
