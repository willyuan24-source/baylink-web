// W5-L1 / W5-L3 (lane L): judges every site-backed attraction's trip end and the sites' own arrivals, then
// writes src/opus-bay/data/sf/siteArrivals.ts and src/opus-bay/data/sf/sewardSlides.ts. Run from the repo root after a
// site's arrival, blockers or the Seward record change:
//
//   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/site-arrivals.mts
//
// tests/opus-bay-w5-landmarks.test.ts runs the same sweep and pins both tables.
import fs from 'node:fs';
import { createCityTerrain } from '../../src/opus-bay/core/sfTerrain';
import { canStand, setCityTerrain, surfaceAt, heightAt } from '../../src/opus-bay/core/terrain';
import { CURB_BAND } from '../../src/opus-bay/core/geo';
import { CitySites } from '../../src/opus-bay/world/sf/sites';
import { landmarkToWorld, worldToLandmark, type SfLandmark } from '../../src/opus-bay/world/sf/landmarks/index';
import { sfLandmarkAnchor } from '../../src/opus-bay/world/sf/landmarks/context';
import { W4_ALL_SITES } from '../../src/opus-bay/world/sf/landmarks/w4sites';
import { W4_SITES_T3 } from '../../src/opus-bay/world/sf/landmarks/w4list3';
import { SEWARD_SLIDES, sewardStreetSlides } from '../../src/opus-bay/world/sf/landmarks/seward-street-slides';
import { ATTRACTIONS, tripDestination } from '../../src/opus-bay/data/sf/attractions';
import { arrivalSpot, findPath } from '../../src/opus-bay/actors/nav';
import { ROAD_CLASSES, demSample } from '../../src/opus-bay/world/sf/format';
import { sfDisk } from '../../tests/opus-bay-sf-disk';
import type { Vec2 } from '../../src/opus-bay/core/types';

const sf = sfDisk(), far = await sf.far();
const sites = new CitySites(), lms = sites.walkInputs();
const city = createCityTerrain(sf.manifest, { landmarks: lms });
city.setFar(far);
sites.onBase = (id, y) => { city.setLandmarkBase(id, y); };
sites.attach(null as never, (x, z) => demSample(far.dem, x, z));
setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
const ix = await sf.graphIndex(); const main = ix.mainComponent();
const DRIVEN = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential']);
const chunks = new Map<string, Awaited<ReturnType<typeof sf.chunk>>>();
const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L)); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
async function inTraffic(p: Vec2): Promise<string | null> {
  await sf.attachAround(city, p.x, p.z, 8, lms);
  if (surfaceAt(p.x, p.z) !== 'road') return null;
  for (let cz = Math.floor((p.z - 8) / 128); cz <= Math.floor((p.z + 8) / 128); cz++) for (let cx = Math.floor((p.x - 8) / 128); cx <= Math.floor((p.x + 8) / 128); cx++) {
    const k = `${cx}_${cz}`; if (!chunks.has(k)) chunks.set(k, await sf.chunk(cx, cz));
    const rd = chunks.get(k)?.roads;
    for (let i = 0; rd && i < rd.count; i++) {
      if (!DRIVEN.has(ROAD_CLASSES[rd.cls[i]])) continue;
      const w = rd.width[i], asphalt = w >= 3 ? w / 2 - CURB_BAND : w / 2;
      for (let q = rd.pStart[i]; q + 1 < rd.pStart[i + 1]; q++) { const d = segDist(p.x, p.z, rd.xyz[q * 3], rd.xyz[q * 3 + 2], rd.xyz[q * 3 + 3], rd.xyz[q * 3 + 5]); if (d <= asphalt) return `${ROAD_CLASSES[rd.cls[i]]} ${d.toFixed(2)}`; }
    }
  }
  return null;
}
function pip(p: Vec2, poly: Vec2[]) { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) ins = !ins; } return ins; }
const inBlk = (l: SfLandmark, w: Vec2) => { const p = worldToLandmark(l, w); return (l.walk?.blockers ?? []).some(b => 'poly' in b ? pip(p, b.poly) : Math.hypot(p.x - b.x, p.z - b.z) < b.r); };
interface Judge { stand: boolean; traffic: string | null; blk: boolean; reach: number; land: number; landTraffic: string | null }
async function judge(l: SfLandmark, p: Vec2): Promise<Judge> {
  await sf.attachAround(city, p.x, p.z, 60, lms);
  const stand = canStand(p.x, p.z, 0.4), traffic = await inTraffic(p), blk = inBlk(l, p);
  const n = ix.nearestNode(p.x, p.z, 40, i => ix.component(i) === main);
  let reach = Infinity;
  if (n >= 0) { const path = findPath({ x: ix.x(n), z: ix.z(n) }, p, 8); const e = path?.points[path.points.length - 1]; if (path) reach = e ? Math.hypot(e.x - p.x, e.z - p.z) : 0; }
  const land = arrivalSpot(p, 30);
  return { stand, traffic, blk, reach, land: land ? Math.hypot(land.x - p.x, land.z - p.z) : Infinity, landTraffic: land ? await inTraffic(land) : 'none' };
}
const good = (j: Judge, landOk = false) => j.stand && !j.traffic && !j.blk && j.reach < 1.1 && (landOk || (!j.landTraffic && j.land < 3));
const bad = (j: Judge) => !j.stand || !!j.traffic || j.blk || j.reach >= 1.1;
/** street sites whose sidewalks are thinner than a nav cell: a fly-in snaps into the kerb lane (Requests: actors/nav arrivalSpot) */
const LANDING_OPEN = new Set(['irving-street', 'haight-ashbury']);
const rows: string[] = [];
const report: string[] = [];
for (const s of W4_ALL_SITES) {
  const sa = sfLandmarkAnchor(s.id)!;
  const js = await judge(s, sa);
  for (const aid of s.w4.attractions) {
    const a = ATTRACTIONS.find(q => q.id === aid);
    if (!a) continue;
    const d = tripDestination(a), dist = Math.hypot(d.x - sa.x, d.z - sa.z);
    const jt = dist < 0.05 ? js : await judge(s, d);
    const far = W4_SITES_T3.includes(s) && dist > 8;
    const want = bad(jt) || far;
    const siteOk = good(js, LANDING_OPEN.has(s.id));
    const verdict = !want ? 'keep' : siteOk ? 'TABLE' : 'OPEN';
    report.push(`${verdict.padEnd(5)} ${aid.padEnd(30)} site ${s.id.padEnd(28)} trip→site ${dist.toFixed(1).padStart(6)} u  trip ${JSON.stringify(jt)}  site ${JSON.stringify(js)}`);
    if (verdict === 'TABLE') rows.push(`  '${aid}': { x: ${+sa.x.toFixed(2)}, z: ${+sa.z.toFixed(2)}, heading: ${+sa.heading.toFixed(3)}, site: '${s.id}' },`);
  }
}
console.log(report.join('\n'));
const src = `/**
 * Trip ends for the attractions a wave-4 site models, where the attraction's own arrival fails the walk sweep (lane L,
 * W5-L1, plan MF2): exactly \`sfLandmarkAnchor(site)\` (world/sf/landmarks/context.ts: the site record's \`w4.arrival\`
 * placed with its x, z and yaw), written out like data/sf/arrivals.ts so data/sf/attractions.ts can use it without the
 * landmark library. Values in world units, heading in world yaw.
 *
 * An attraction is listed when its trip end (data/sf/attractions.ts \`tripDestination\`) stands inside a blocker, where no
 * walker can stand, in a driven street's lane (the toy traffic stops for the player there), or beyond the walking graph's
 * reach; or, for lane L3's tier-3 records (w4list3.ts), more than 8 u from the feature (the sundial, Mountain Lake's
 * overlook, McLaren's La Grande, Buena Vista's summit). Every listed spot is standable, clear of the site's blockers, off
 * the asphalt, reached by a path from the walking graph, and a fly-in (actors/nav arrivalSpot) lands on it within 3 u off
 * the asphalt, except Irving Street and Haight & Ashbury, whose sidewalks are thinner than a nav cell (the landing
 * snaps into the kerb lane: Requests to the nav; Clement Street keeps its own trip end, with the same landing).
 *
 * tests/opus-bay-w5-landmarks.test.ts checks every entry against \`sfLandmarkAnchor\` (±0.01 u) and runs the same sweep over
 * every site-backed attraction; it prints this table when a site moves: paste it here. Lane N wires it in
 * data/sf/attractions.ts (ARRIVAL_OVERRIDES win, then LANDMARK_ARRIVALS, then this table).
 */
export const SITE_ARRIVALS: Readonly<Record<string, { x: number; z: number; heading: number; site: string }>> = {
${rows.join('\n')}
};
`;
fs.writeFileSync('src/opus-bay/data/sf/siteArrivals.ts', src.replace(/\n/g, '\r\n'));
console.log('wrote siteArrivals.ts with', rows.length, 'rows');

// Seward: the slide lines for lane A
const S = sewardStreetSlides, base = S.base;
const W = (p: { x: number; y?: number; z: number }) => { const w = landmarkToWorld(S, p); return { x: +w.x.toFixed(2), y: p.y === undefined ? undefined : +(base + p.y).toFixed(2), z: +w.z.toFixed(2) }; };
await sf.attachAround(city, S.x, S.z, 40, lms);
const deckY = (S.walk!.surfaces![0].y as number);
function nearestStand(cx: number, cz: number, z0: number, z1: number, y?: number) {
  let best: { x: number; z: number; d: number } | null = null;
  for (let z = z0; z <= z1 + 1e-9; z += 0.05) for (let x = cx - 0.3; x <= cx + 0.3 + 1e-9; x += 0.05) {
    const w = landmarkToWorld(S, { x, z });
    if (!canStand(w.x, w.z, 0.3)) continue;
    if (y !== undefined && Math.abs(heightAt(w.x, w.z) - y) > 0.03) continue;
    const d = Math.hypot(x - cx, z - cz);
    if (!best || d < best.d) best = { x: +x.toFixed(2), z: +z.toFixed(2), d };
  }
  return best;
}
const chutes = SEWARD_SLIDES.map((c, k) => {
  const start = nearestStand(c.to.x, c.to.z, c.to.z, c.to.z + 0.9, base + deckY), out = nearestStand(c.from.x, c.from.z, c.from.z - 1.2, c.from.z - 0.45);
  if (!start || !out) throw new Error('seward chute ' + k + ' start ' + JSON.stringify(start) + ' runout ' + JSON.stringify(out));
  return { id: k === 0 ? 'west' : 'east', top: W(c.to), bottom: W(c.from), start: { ...W({ x: start.x, z: start.z }), y: +(base + deckY).toFixed(2) }, runout: W({ x: out.x, z: out.z }), startLocal: start, runoutLocal: out };
});
console.log(JSON.stringify(chutes, null, 1));
const arrival = sfLandmarkAnchor(S.id)!, foot = W({ x: 0.2, z: -2.6 });
const fmt = (p: { x: number; y?: number; z: number }) => p.y === undefined ? `{ x: ${p.x}, z: ${p.z} }` : `{ x: ${p.x}, y: ${p.y}, z: ${p.z} }`;
const sew = `/**
 * Seward Street Slides for lane A's slide activity (W5-L3): the two chute lines, where a rider stands at each chute head
 * on the top deck, where they stand up at the foot, the site's arrival (on the deck) and the foot of the slides on the
 * Seward Street sidewalk, in WORLD coordinates (y = world height of the
 * chute bed / the deck), pasted from world/sf/landmarks/seward-street-slides.ts (\`SEWARD_SLIDES\`, the site's base
 * ${base}, origin (${S.x}, ${S.z}), yaw 0) so that lane A's chunk never pulls the landmark library.
 * tests/opus-bay-w5-landmarks.test.ts checks every number against the record (±0.01 u) and the walk data (the deck and
 * each \`start\` standable and reached on foot from the foot, each \`runout\` standable) and prints this table to paste
 * when the record moves.
 *
 * A chute runs from \`top\` (its head at the deck) down to \`bottom\` (its end on the slope above the sidewalk), facing
 * \`heading\` (world yaw, downhill toward Seward Street). The walls keep a rider inside; the site's blocker covers the chutes,
 * so a ride moves the rider along the line itself (lane A's cinema / PlayKit), then puts them on \`runout\`.
 *
 * Facts for BAYBAY's lines (sfrecpark.org "Seward Mini Park", https://sfrecpark.org/facilities/facility/details/sewardminipark-203,
 * checked 2026-09-28): the slides are open 10 am – 5 pm Tuesday to Sunday; bring a piece of cardboard; adults must come
 * with a child; the park closes at sunset. Visitors take the stairs beside the slides up to the top.
 */
export interface SlidePoint { x: number; y: number; z: number }
export interface SewardChute { id: 'west' | 'east'; top: SlidePoint; bottom: SlidePoint; start: SlidePoint; runout: { x: number; z: number }; heading: number }
export const SEWARD_SLIDES_WORLD: {
  site: 'seward-street-slides';
  attraction: 'seward-street-slides';
  arrival: { x: number; z: number; heading: number };
  foot: { x: number; z: number };
  deck: SlidePoint;
  chutes: readonly SewardChute[];
  hours: { days: readonly number[]; open: number; close: number; sourceUrl: string; verifiedAt: string };
} = {
  site: 'seward-street-slides',
  attraction: 'seward-street-slides',
  arrival: { x: ${+arrival.x.toFixed(2)}, z: ${+arrival.z.toFixed(2)}, heading: ${+arrival.heading.toFixed(3)} },
  foot: { x: ${foot.x}, z: ${foot.z} },
  deck: ${fmt({ ...W({ x: -0.13, z: 6.2 }), y: +(base + deckY).toFixed(2) })},
  chutes: [
${chutes.map(c => `    { id: '${c.id}', top: ${fmt(c.top)}, bottom: ${fmt(c.bottom)}, start: ${fmt(c.start)}, runout: ${fmt(c.runout)}, heading: ${+Math.PI.toFixed(3)} },`).join('\n')}
  ],
  /** Bay weekday numbers (0 = Sunday) and minutes after Bay midnight */
  hours: { days: [2, 3, 4, 5, 6, 0], open: 600, close: 1020, sourceUrl: 'https://sfrecpark.org/facilities/facility/details/sewardminipark-203', verifiedAt: '2026-09-28' },
};
`;
fs.writeFileSync('src/opus-bay/data/sf/sewardSlides.ts', sew.replace(/\n/g, '\r\n'));
console.log('wrote sewardSlides.ts');
setCityTerrain(null);
