/**
 * Wave 6 · lane H (W6-H1 / W6-H2) · where Halloween sits in the toy city, placed on our own published city (never by
 * hand-typed coordinates alone):
 *
 *   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/halloween-place.mts          # place, check, write the files
 *
 * - STOOPS (src/opus-bay/halloween/worldSpots.ts, generated): the doorsteps of the residential city's Victorians and
 *   Edwardians (building styles victorian / edwardian; one in three houses by a hash of the OSM id, one in six for the
 *   plain 'residential' style) in the neighbourhoods the season dresses — Western Addition (Alamo Square), Hayes Valley,
 *   Haight-Ashbury, Castro / Upper Market, Noe Valley, Pacific Heights, the Mission (the DataSF analysis neighbourhoods
 *   of far.zones). The street face = the footprint edge whose middle is nearest a street centreline (≤ 9 u), a pumpkin
 *   0.45 u out from it on standable ground that is not the roadway, ≥ 2.6 u from the next one, and never on the Painted
 *   Ladies / Waller St spots lane R placed (realsf/dressing.ts HALLOWEEN_SPOTS).
 * - HUNT (src/opus-bay/halloween/huntSpots.ts, generated): the 40 hidden jack-o'-lanterns, each by a named place of
 *   places.json (lane G1's index), moved to the nearest spot within 26 u that a walker reaches (standable with a 0.4 u
 *   body, not water, not the roadway, a walking-graph node of the graph's main component within 14 u), ≥ 12 u from every
 *   pebble (eggs/pebbleSpots.ts) and ≥ 30 u from each other.
 *
 * tests/opus-bay-w6-h.test.ts re-checks every spot on the published city.
 */
import fs from 'node:fs';
import { sfDisk } from '../../tests/opus-bay-sf-disk';

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { createCityTerrain, landmarkWalkInputs } = await import('../../src/opus-bay/core/sfTerrain');
const { canStand, heightAt, isWater, setCityTerrain, surfaceAt } = await import('../../src/opus-bay/core/terrain');
const { SF_SITES } = await import('../../src/opus-bay/world/sf/landmarks/index');
const { STYLES } = await import('../../src/opus-bay/world/sf/format');
const { HALLOWEEN_SPOTS } = await import('../../src/opus-bay/realsf/dressing');
const { PEBBLES } = await import('../../src/opus-bay/eggs/pebbleSpots');
const { HUNT_PLACES } = await import('../../src/opus-bay/halloween/huntPlaces');

type P = { x: number; z: number };
const sf = sfDisk();
const far = await sf.far();
const lms = landmarkWalkInputs(SF_SITES);
const city = createCityTerrain(sf.manifest, { landmarks: lms });
city.setFar(far);
const root = 'C:/Users/willy/wt/w6-h/src/opus-bay/halloween';

// --- the zones -------------------------------------------------------------------------------------------------
export const DRESS_ZONES = ['western-addition', 'hayes-valley', 'haight-ashbury', 'castro-upper-market', 'noe-valley', 'pacific-heights', 'mission'] as const;
const zones = far.zones.filter(z => (DRESS_ZONES as readonly string[]).includes(z.id));
if (zones.length !== DRESS_ZONES.length) throw new Error(`zones: ${zones.map(z => z.id).join(', ')}`);
const inRing = (p: P, xz: Float32Array) => {
  let inside = false;
  for (let i = 0, j = xz.length - 2; i < xz.length; j = i, i += 2) {
    const xi = xz[i], zi = xz[i + 1], xj = xz[j], zj = xz[j + 1];
    if ((zi > p.z) !== (zj > p.z) && p.x < ((xj - xi) * (p.z - zi)) / (zj - zi || 1e-9) + xi) inside = !inside;
  }
  return inside;
};
const zoneOf = (p: P): number => {
  for (let k = 0; k < zones.length; k++) {
    let inside = false;
    for (const r of zones[k].rings) if (inRing(p, r.xz)) inside = r.hole ? false : true;
    if (inside) return DRESS_ZONES.indexOf(zones[k].id as (typeof DRESS_ZONES)[number]);
  }
  return -1;
};
let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
for (const z of zones) for (const r of z.rings) for (let i = 0; i < r.xz.length; i += 2) { bx0 = Math.min(bx0, r.xz[i]); bx1 = Math.max(bx1, r.xz[i]); bz0 = Math.min(bz0, r.xz[i + 1]); bz1 = Math.max(bz1, r.xz[i + 1]); }
console.error(`zones box x ${bx0.toFixed(0)}…${bx1.toFixed(0)} z ${bz0.toFixed(0)}…${bz1.toFixed(0)}`);

// attach everything the stoops and the hunt need
await sf.attachAll(city, lms);
setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });

const hash = (n: number) => { let h = n | 0; h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); return (h ^ (h >>> 16)) >>> 0; };
const segDist = (p: P, a: P, b: P) => { const dx = b.x - a.x, dz = b.z - a.z; const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz); };

// --- the stoops -----------------------------------------------------------------------------------------------------
const VIC = STYLES.indexOf('victorian'), EDW = STYLES.indexOf('edwardian'), RES = STYLES.indexOf('residential');
const STREET_CLS = new Set([2, 3, 4, 5]); // primary, secondary, tertiary, residential
const stoops: { x: number; z: number; y: number; f: number; zone: number }[] = [];
const nearR = (p: P) => HALLOWEEN_SPOTS.some(s => Math.hypot(s.x - p.x, s.z - p.z) < 14);
const grid = new Map<string, P[]>();
const gkey = (x: number, z: number) => `${Math.floor(x / 8)}_${Math.floor(z / 8)}`;
const tooClose = (p: P, d: number) => {
  const gx = Math.floor(p.x / 8), gz = Math.floor(p.z / 8);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of grid.get(`${gx + i}_${gz + j}`) ?? []) if (Math.hypot(q.x - p.x, q.z - p.z) < d) return true;
  return false;
};
for (const c of sf.manifest.chunks) {
  const x0 = c.cx * 128, z0 = c.cz * 128;
  if (x0 > bx1 || x0 + 128 < bx0 || z0 > bz1 || z0 + 128 < bz0) continue;
  const ch = await sf.chunk(c.cx, c.cz);
  if (!ch) continue;
  // the streets of this chunk and its eight neighbours
  const lines: P[][] = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const nb = i === 0 && j === 0 ? ch : await sf.chunk(c.cx + i, c.cz + j);
    if (!nb) continue;
    const r = nb.roads;
    for (let k = 0; k < r.count; k++) {
      if (!STREET_CLS.has(r.cls[k])) continue;
      const pts: P[] = [];
      for (let p = r.pStart[k]; p < r.pStart[k + 1]; p++) pts.push({ x: r.xyz[p * 3], z: r.xyz[p * 3 + 2] });
      lines.push(pts);
    }
  }
  const toStreet = (p: P) => { let d = Infinity; for (const l of lines) for (let k = 1; k < l.length; k++) d = Math.min(d, segDist(p, l[k - 1], l[k])); return d; };
  const b = ch.buildings;
  for (let i = 0; i < b.count; i++) {
    const st = b.style[i];
    if (st !== VIC && st !== EDW && st !== RES) continue;
    if (hash(b.osmId[i] + 7) % (st === RES ? 6 : 3) !== 0) continue;
    const poly: P[] = [];
    for (let v = b.vStart[i]; v < b.vStart[i + 1]; v++) poly.push({ x: b.xz[v * 2], z: b.xz[v * 2 + 1] });
    const mid = { x: poly.reduce((s, q) => s + q.x, 0) / poly.length, z: poly.reduce((s, q) => s + q.z, 0) / poly.length };
    const zone = zoneOf(mid);
    if (zone < 0) continue;
    let best: { a: P; b: P; d: number } | null = null;
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k], q = poly[(k + 1) % poly.length];
      const e = Math.hypot(q.x - a.x, q.z - a.z);
      if (e < 1.4) continue;
      const d = toStreet({ x: (a.x + q.x) / 2, z: (a.z + q.z) / 2 });
      if (d > 9) continue;
      if (!best || d < best.d) best = { a, b: q, d };
    }
    if (!best) continue;
    const ex = best.b.x - best.a.x, ez = best.b.z - best.a.z, el = Math.hypot(ex, ez);
    const m = { x: (best.a.x + best.b.x) / 2, z: (best.a.z + best.b.z) / 2 };
    let n = { x: -ez / el, z: ex / el };
    if (toStreet({ x: m.x + n.x, z: m.z + n.z }) > best.d) n = { x: -n.x, z: -n.z };
    // the door side: a third of the way along (stoops sit to one side of a bay window), alternating by the hash
    const t = hash(b.osmId[i]) % 2 ? 0.3 : 0.7;
    const p = { x: +(best.a.x + ex * t + n.x * 0.45).toFixed(1), z: +(best.a.z + ez * t + n.z * 0.45).toFixed(1) };
    if (nearR(p) || tooClose(p, 2.6)) continue;
    if (!canStand(p.x, p.z, 0.25) || surfaceAt(p.x, p.z) === 'road' || isWater(p.x, p.z)) continue;
    const y = heightAt(p.x, p.z);
    if (!Number.isFinite(y)) continue;
    stoops.push({ x: p.x, z: p.z, y: +y.toFixed(2), f: +Math.atan2(n.x, n.z).toFixed(2), zone });
    const k = gkey(p.x, p.z);
    grid.set(k, [...(grid.get(k) ?? []), p]);
  }
}
stoops.sort((a, b) => a.z - b.z || a.x - b.x);
const perZone = DRESS_ZONES.map((z, k) => `${z} ${stoops.filter(s => s.zone === k).length}`).join(' · ');
console.error(`stoops ${stoops.length}: ${perZone}`);

// the trick-or-treaters (halloween/worldDress.ts stoopHash: one stoop in ~17): beside the pumpkins, on whichever side
// is sidewalk (standable, not the roadway); none where neither is
const { stoopHash } = await import('../../src/opus-bay/halloween/worldDress');
let figs = 0, noRoom = 0;
const flat: number[] = [];
for (const [i, s] of stoops.entries()) {
  let side = 0;
  if (stoopHash(i) % 17 === 3) {
    const fx = Math.sin(s.f), fz = Math.cos(s.f), sx = Math.cos(s.f), sz = -Math.sin(s.f);
    for (const [code, k] of [[1, -1], [2, 1]] as const) {
      const q = { x: s.x + sx * k + fx * 0.05, z: s.z + sz * k + fz * 0.05 };
      if (canStand(q.x, q.z, 0.25) && surfaceAt(q.x, q.z) !== 'road' && !isWater(q.x, q.z)) { side = code; break; }
    }
    if (side) figs++; else noRoom++;
  }
  flat.push(Math.round(s.x * 10), Math.round(s.z * 10), Math.round(s.y * 100), Math.round(s.f * 100), s.zone | (side << 3));
}
console.error(`trick-or-treaters ${figs} (no room at ${noRoom})`);
const lines: string[] = [];
for (let i = 0; i < flat.length; i += 5 * 8) lines.push('  ' + flat.slice(i, i + 5 * 8).join(', ') + ',');
fs.writeFileSync(`${root}/worldSpots.ts`, `/**
 * Wave 6 · lane H (W6-H1) · GENERATED by scripts/opus-sf/halloween-place.mts on the published city (sf/v1) — do not
 * edit by hand; re-run the script. The doorsteps the season dresses: ${stoops.length} stoops of Victorians / Edwardians in
 * ${DRESS_ZONES.join(', ')}
 * (${perZone}).
 *
 * Five numbers per stoop: x·10, z·10, ground y·100, the facing f·100 (the stoop looks toward (sin f, cos f): the
 * street), zone | figure << 3 (the DRESS_ZONES index; the trick-or-treater's side: 0 none, 1 left, 2 right of the
 * pumpkins, where the sidewalk is). Sorted by z.
 */
export const DRESS_ZONES = ${JSON.stringify(DRESS_ZONES)} as const;
export const STOOP_STRIDE = 5;
export const STOOPS: readonly number[] = [
${lines.join('\n')}
];
`);

// --- the hunt -------------------------------------------------------------------------------------------------------
const ix = await sf.graphIndex();
const main = ix.mainComponent();
const placesJson = JSON.parse(fs.readFileSync(`${sf.base}/places.json`, 'utf8')) as { places: { id: string; x: number; z: number }[] };
const hunt: { n: number; place: string; x: number; z: number; y: number }[] = [];
for (const h of HUNT_PLACES) {
  const pl = placesJson.places.find(q => q.id === h.place);
  if (!pl) throw new Error(`no place ${h.place}`);
  const c0 = { x: pl.x + (h.dx ?? 0), z: pl.z + (h.dz ?? 0) };
  let best: (P & { d: number }) | null = null;
  for (let r = 0; r <= 26; r += 0.5) {
    const steps = r === 0 ? 1 : Math.max(8, Math.round(r * 4));
    for (let s = 0; s < steps; s++) {
      const a = (s / steps) * Math.PI * 2;
      const p = { x: +(c0.x + Math.sin(a) * r).toFixed(1), z: +(c0.z + Math.cos(a) * r).toFixed(1) };
      if (!canStand(p.x, p.z, 0.4) || isWater(p.x, p.z) || surfaceAt(p.x, p.z) === 'road') continue;
      if (PEBBLES.some(q => Math.hypot(q.x - p.x, q.z - p.z) < 12)) continue;
      if (hunt.some(q => Math.hypot(q.x - p.x, q.z - p.z) < 30)) continue;
      const node = ix.nearestNode(p.x, p.z, 14, i => ix.component(i) === main);
      if (node < 0) continue;
      best = { ...p, d: r };
      break;
    }
    if (best) break;
  }
  if (!best) throw new Error(`hunt ${h.n} ${h.place}: no reachable spot within 26 u`);
  hunt.push({ n: h.n, place: h.place, x: best.x, z: best.z, y: +heightAt(best.x, best.z).toFixed(2) });
  console.error(`hunt ${h.n} ${h.place}: moved ${best.d} u`);
}
fs.writeFileSync(`${root}/huntSpots.ts`, `/**
 * Wave 6 · lane H (W6-H2) · GENERATED by scripts/opus-sf/halloween-place.mts on the published city (sf/v1) — do not
 * edit by hand; re-run the script (the names and hints live in halloween/huntPlaces.ts). Where each hidden
 * jack-o'-lantern sits: by its place of places.json, moved to the nearest spot a walker reaches (standable with a
 * 0.4 u body, not water, not the roadway, a walking-graph node of the main component within 14 u), ≥ 12 u from every
 * pebble and ≥ 30 u from each other. n = its reward number (pumpkin:n), y = the ground.
 */
export const HUNT_XZ: readonly { n: number; x: number; z: number; y: number }[] = [
${hunt.map(h => `  { n: ${h.n}, x: ${h.x}, z: ${h.z}, y: ${h.y} }, // ${h.place}`).join('\n')}
];
`);
console.error(`hunt ${hunt.length} written`);
setCityTerrain(null);
