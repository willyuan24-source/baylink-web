/**
 * Wave 6 · lane H (W6-H3) · Día de los Muertos in the Mission (1–2 November), placed on our own published city:
 *
 *   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/muertos-place.mts     # place, check, write muertosSpots.ts
 *
 * Sources (checked on the web 2026-09-29; the 2025 edition, 2026's is not published yet):
 * - SFMTA "Dia de Los Muertos Procession: Sunday, November 2, 2025": 7 p.m.; the route "South on Bryant, West onto 24th,
 *   North onto Mission, East onto 22nd, Ending at Bryant & 22nd" —
 *   https://www.sfmta.com/travel-updates/dia-de-los-muertos-procession-sunday-november-2-2025
 * - Mission Local (Oct 2025) and El Tecolote (2025-10-28): the Festival of Altars (the Marigold Project) on 2 November,
 *   8 a.m. – 9 p.m., at Potrero del Sol Park, 2827 Cesar Chavez St; a community altar at Acción Latina, 2958 24th St —
 *   https://missionlocal.org/2025/10/celebrate-day-of-the-dead-sf/ · https://eltecolote.org/content/en/dia-de-los-muertos-sf-events-2/
 *
 * What it places (all standable, never the roadway):
 * - PICADO: strings of papel picado across 24th Street from Bryant to Mission and across Bryant from 22nd to 24th (the
 *   procession's first legs), every ~11 u, curb to curb.
 * - MARIGOLDS: marigold pots along both sidewalks of 24th St (every ~9 u, the side alternating).
 * - ALTARS: six at Potrero del Sol Park (the Festival of Altars), one at Acción Latina's door on 24th St, and the
 *   procession's gathering point at 22nd & Bryant (a marigold arch) — the muertos:n finds.
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

type P = { x: number; z: number };
const sf = sfDisk();
const far = await sf.far();
const names = far.names as unknown as string[];
const lms = landmarkWalkInputs(SF_SITES);
const city = createCityTerrain(sf.manifest, { landmarks: lms });
city.setFar(far);
const AREA = { x0: 280, x1: 640, z0: 460, z1: 780 };
for (const c of sf.manifest.chunks) {
  const x0 = c.cx * 128, z0 = c.cz * 128;
  if (x0 > AREA.x1 || x0 + 128 < AREA.x0 || z0 > AREA.z1 || z0 + 128 < AREA.z0) continue;
  const r = await sf.rasters(c.cx, c.cz, lms);
  if (r) city.attach(r);
}
setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });

const roadsNamed = async (name: string) => {
  const out: { pts: P[]; w: number }[] = [];
  for (const c of sf.manifest.chunks) {
    const x0 = c.cx * 128, z0 = c.cz * 128;
    if (x0 > AREA.x1 || x0 + 128 < AREA.x0 || z0 > AREA.z1 || z0 + 128 < AREA.z0) continue;
    const ch = await sf.chunk(c.cx, c.cz);
    if (!ch) continue;
    const r = ch.roads;
    for (let i = 0; i < r.count; i++) {
      if (r.nameIdx[i] === 0xffff || names[r.nameIdx[i]] !== name || r.cls[i] > 5) continue;
      const pts: P[] = [];
      for (let p = r.pStart[i]; p < r.pStart[i + 1]; p++) pts.push({ x: r.xyz[p * 3], z: r.xyz[p * 3 + 2] });
      out.push({ pts, w: r.width[i] });
    }
  }
  if (!out.length) throw new Error(`no ${name}`);
  return out;
};
const segX = (a: P, b: P, c: P, d: P): P | null => {
  const r = { x: b.x - a.x, z: b.z - a.z }, s = { x: d.x - c.x, z: d.z - c.z };
  const den = r.x * s.z - r.z * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * s.z - (c.z - a.z) * s.x) / den, u = ((c.x - a.x) * r.z - (c.z - a.z) * r.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + t * r.x, z: a.z + t * r.z } : null;
};
const crossing = (A: { pts: P[] }[], B: { pts: P[] }[]): P => {
  for (const a of A) for (let i = 1; i < a.pts.length; i++) for (const b of B) for (let j = 1; j < b.pts.length; j++) { const hit = segX(a.pts[i - 1], a.pts[i], b.pts[j - 1], b.pts[j]); if (hit) return hit; }
  throw new Error('no crossing');
};
const r24 = await roadsNamed('24th Street'), bryant = await roadsNamed('Bryant Street'), mission = await roadsNamed('Mission Street'), r22 = await roadsNamed('22nd Street');
const x24m = crossing(r24, mission), x24b = crossing(r24, bryant), x22b = crossing(r22, bryant);
console.error(`24th × Mission ${x24m.x.toFixed(1)},${x24m.z.toFixed(1)} · 24th × Bryant ${x24b.x.toFixed(1)},${x24b.z.toFixed(1)} · 22nd × Bryant ${x22b.x.toFixed(1)},${x22b.z.toFixed(1)}`);

/** Stations every `step` u along the named road's segments between two crossings: point, unit direction, width. */
const stations = (roads: { pts: P[]; w: number }[], a: P, b: P, step: number, inset = 3) => {
  const ax = { x: b.x - a.x, z: b.z - a.z }, len = Math.hypot(ax.x, ax.z), u = { x: ax.x / len, z: ax.z / len };
  const out: { p: P; d: P; w: number }[] = [];
  for (let t = inset; t <= len - inset; t += step) {
    const q = { x: a.x + u.x * t, z: a.z + u.z * t };
    // the nearest segment of the road to q (its direction and width)
    let best: { p: P; d: P; w: number; dist: number } | null = null;
    for (const r of roads) for (let i = 1; i < r.pts.length; i++) {
      const s0 = r.pts[i - 1], s1 = r.pts[i], dx = s1.x - s0.x, dz = s1.z - s0.z, l2 = dx * dx + dz * dz || 1;
      const k = Math.max(0, Math.min(1, ((q.x - s0.x) * dx + (q.z - s0.z) * dz) / l2));
      const p = { x: s0.x + dx * k, z: s0.z + dz * k }, dist = Math.hypot(p.x - q.x, p.z - q.z);
      if (!best || dist < best.dist) { const l = Math.sqrt(l2); best = { p, d: { x: dx / l, z: dz / l }, w: r.w, dist }; }
    }
    if (best && best.dist < 4) out.push(best);
  }
  return out;
};
const off = (p: P) => canStand(p.x, p.z, 0.3) && surfaceAt(p.x, p.z) !== 'road' && !isWater(p.x, p.z);
const r2 = (v: number) => +v.toFixed(2);

// --- papel picado ---
const picado: number[][] = [];
for (const [roads, a, b, step] of [[r24, x24b, x24m, 11], [bryant, x22b, x24b, 12]] as const) {
  for (const s of stations(roads as { pts: P[]; w: number }[], a, b, step)) {
    const n = { x: -s.d.z, z: s.d.x }, half = s.w / 2 - 0.25;
    const y = heightAt(s.p.x, s.p.z) + 4.2;
    picado.push([r2(s.p.x - n.x * half), r2(s.p.z - n.z * half), r2(s.p.x + n.x * half), r2(s.p.z + n.z * half), r2(y)]);
  }
}
// --- marigold pots along 24th ---
const marigolds: number[][] = [];
{
  let side = 1;
  for (const s of stations(r24, x24b, x24m, 9, 5)) {
    side = -side;
    const n = { x: -s.d.z * side, z: s.d.x * side };
    // the first standable spot off the roadway walking out from the curb (the pavement band)
    for (let d = s.w / 2 - 1.5; d <= s.w / 2 + 1.5; d += 0.1) {
      // 0.2 u past the first spot off the roadway (a pot on the kerb line would round back onto it)
      const q = { x: r2(s.p.x + n.x * (d + 0.2)), z: r2(s.p.z + n.z * (d + 0.2)) };
      if (surfaceAt(s.p.x + n.x * d, s.p.z + n.z * d) === 'road' || !canStand(q.x, q.z, 0.12) || surfaceAt(q.x, q.z) === 'road' || isWater(q.x, q.z)) continue;
      marigolds.push([r2(q.x), r2(q.z), r2(heightAt(q.x, q.z))]);
      break;
    }
  }
}
// --- the altars and the gathering point ---
const places = JSON.parse(fs.readFileSync(`${sf.base}/places.json`, 'utf8')) as { places: { id: string; x: number; z: number }[] };
const at = (id: string) => { const p = places.places.find(q => q.id === id); if (!p) throw new Error(id); return p; };
const nearestOff = (c: P, max = 12, avoid: P[] = [], gap = 3.2): P | null => {
  for (let r = 0; r <= max; r += 0.5) {
    const steps = r === 0 ? 1 : Math.max(8, Math.round(r * 5));
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2, q = { x: r2(c.x + Math.sin(a) * r), z: r2(c.z + Math.cos(a) * r) };
      if (off(q) && canStand(q.x, q.z, 0.8) && avoid.every(o => Math.hypot(o.x - q.x, o.z - q.z) >= gap)) return q;
    }
  }
  return null;
};
const altars: { n: number; x: number; z: number; y: number; f: number; kind: 'altar' | 'arch'; where: string }[] = [];
const face = (q: P, to: P) => r2(Math.atan2(to.x - q.x, to.z - q.z));
const park = at('osm-w24445970'); // Potrero del Sol Park
for (let k = 0; k < 6; k++) {
  const a = (k / 6) * Math.PI * 2 + 0.3;
  const q = nearestOff({ x: park.x + Math.sin(a) * 7, z: park.z + Math.cos(a) * 7 }, 10, altars);
  if (!q) throw new Error(`park altar ${k}`);
  altars.push({ n: altars.length + 1, ...q, y: r2(heightAt(q.x, q.z)), f: face(q, park), kind: 'altar', where: 'potrero-del-sol' });
}
const accion = at('osm-n10653835784'); // Acción Latina, 2958 24th St
{
  const q = nearestOff(accion, 10, altars);
  if (!q) throw new Error('accion');
  // it faces 24th St: toward the nearest point of the street's centreline
  let best: P = accion, bd = Infinity;
  for (const r of r24) for (const p of r.pts) { const d = Math.hypot(p.x - q.x, p.z - q.z); if (d < bd) { bd = d; best = p; } }
  altars.push({ n: altars.length + 1, ...q, y: r2(heightAt(q.x, q.z)), f: face(q, best), kind: 'altar', where: 'accion-latina' });
}
{
  const q = nearestOff(x22b, 14, altars);
  if (!q) throw new Error('22nd & Bryant');
  altars.push({ n: altars.length + 1, ...q, y: r2(heightAt(q.x, q.z)), f: face(q, x22b), kind: 'arch', where: 'procession-start' });
}
console.error(`picado ${picado.length} strings · marigolds ${marigolds.length} · altars ${altars.map(a => `${a.n} ${a.where} ${a.x},${a.z}`).join(' | ')}`);

fs.writeFileSync('C:/Users/willy/wt/w6-h/src/opus-bay/halloween/muertosSpots.ts', `/**
 * Wave 6 · lane H (W6-H3) · GENERATED by scripts/opus-sf/muertos-place.mts on the published city (sf/v1) — do not edit
 * by hand; re-run the script (it carries the sources). Día de los Muertos in the Mission: the papel picado strings over
 * the procession's first legs (24th St Bryant → Mission, Bryant 22nd → 24th), the marigold pots along 24th St, the
 * altars (Potrero del Sol Park's Festival of Altars, Acción Latina on 24th St) and the procession's gathering point at
 * 22nd & Bryant. n = the reward number (muertos:n).
 */
/** x0, z0, x1, z1 (curb to curb), y (the string's height at the ends) */
export const PICADO: readonly (readonly number[])[] = ${JSON.stringify(picado)};
/** x, z, ground y */
export const MARIGOLDS: readonly (readonly number[])[] = ${JSON.stringify(marigolds)};
export const MUERTOS_SPOTS: readonly { n: number; x: number; z: number; y: number; f: number; kind: 'altar' | 'arch'; where: string }[] = ${JSON.stringify(altars, null, 1).replace(/\n\s*/g, ' ')};
/** 24th & Mission · 24th & Bryant · 22nd & Bryant (the route's corners) */
export const ROUTE_CORNERS = ${JSON.stringify({ mission24: { x: r2(x24m.x), z: r2(x24m.z) }, bryant24: { x: r2(x24b.x), z: r2(x24b.z) }, bryant22: { x: r2(x22b.x), z: r2(x22b.z) } })} as const;
`);
setCityTerrain(null);
