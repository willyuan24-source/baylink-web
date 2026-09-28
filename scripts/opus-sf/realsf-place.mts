/**
 * Wave 5 · lane R (W5-R7) · where the Halloween pumpkins sit (realsf/dressing.ts HALLOWEEN_SPOTS), placed on our own
 * published city, never by hand-typed coordinates alone:
 *
 *   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/realsf-place.mts          # place, check, print the rows
 *
 * - The Painted Ladies (lane L's landmark, world/sf/landmarks/painted-ladies.ts): one pumpkin on the middle step of each
 *   of the seven stoops and a bigger jack-o'-lantern on the sidewalk at its foot, in the landmark's own frame (x, z, yaw, base + the house's grade).
 * - Waller Street from Scott St to Steiner St (Lower Haight / Duboce Triangle: "several Halloween-decorated houses",
 *   Local News Matters 2025-10-27): the street face of each building within 9 u of the centreline, a pair every lot
 *   (≥ 2.6 u apart), 0.45 u out from the wall, on standable ground that is not the roadway.
 *
 * The rows are printed as TypeScript to paste into realsf/dressing.ts; tests/opus-bay-w5-calendar.test.ts re-checks every
 * spot on the published city (standable, off the roadway, near its wall / stoop).
 */
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
const { canStand, heightAt, setCityTerrain, surfaceAt } = await import('../../src/opus-bay/core/terrain');
const { SF_SITES } = await import('../../src/opus-bay/world/sf/landmarks/index');
const { paintedLadies, PAINTED_LADIES } = await import('../../src/opus-bay/world/sf/landmarks/painted-ladies');
const { rot } = await import('../../src/opus-bay/world/sf/landmarks/kit');

type P = { x: number; z: number };
const sf = sfDisk();
const far = await sf.far();
const names = far.names as unknown as string[];
const lms = landmarkWalkInputs(SF_SITES);
const city = createCityTerrain(sf.manifest, { landmarks: lms });
city.setFar(far);

// --- the Painted Ladies' stoops (the landmark's frame: world = (x, z) + rot(local, yaw), y = base + local y) ---
const D = 3.4, zf = D / 2 - 0.4;
const lw = (lx: number, lz: number): P => { const r = rot({ x: lx, z: lz }, paintedLadies.yaw); return { x: +(paintedLadies.x + r.x).toFixed(2), z: +(paintedLadies.z + r.z).toFixed(2) }; };
const stoops: string[] = [];
PAINTED_LADIES.forEach((h, i) => {
  const hx = (3 - i) * 1.6;
  // the middle step (s = 1): centre z = zf + 0.42, top = y0 − 0.3 + 0.24 + 0.24; the pumpkin on its downhill half
  const step = lw(hx - 0.38 - 0.13, zf + 0.42);
  // the foot: on the sidewalk strip (its top = base + y0 + 0.02) just in front of the bottom step
  const foot = lw(hx - 0.26, zf + 1.02);
  // they face the street (the landmark's local +z = world (sin yaw, cos yaw))
  const f = paintedLadies.yaw.toFixed(3);
  stoops.push(`  { x: ${step.x}, z: ${step.z}, y: ${(paintedLadies.base + h.y + 0.18).toFixed(2)}, r: 0.15, f: ${f}, face: false },`);
  stoops.push(`  { x: ${foot.x}, z: ${foot.z}, y: ${(paintedLadies.base + h.y + 0.02).toFixed(2)}, r: 0.26, f: ${f}, face: true },`);
});

// --- Waller Street between Scott and Steiner ---
const roadsNamed = async (name: string, box: { x0: number; x1: number; z0: number; z1: number }) => {
  const out: P[][] = [];
  for (const c of sf.manifest.chunks) {
    const x0 = c.cx * 128, z0 = c.cz * 128;
    if (x0 > box.x1 || x0 + 128 < box.x0 || z0 > box.z1 || z0 + 128 < box.z0) continue;
    const ch = await sf.chunk(c.cx, c.cz);
    if (!ch) continue;
    const r = ch.roads;
    for (let i = 0; i < r.count; i++) {
      if (r.nameIdx[i] === 0xffff || names[r.nameIdx[i]] !== name || r.cls[i] !== 5) continue;
      const pts: P[] = [];
      for (let p = r.pStart[i]; p < r.pStart[i + 1]; p++) pts.push({ x: r.xyz[p * 3], z: r.xyz[p * 3 + 2] });
      out.push(pts);
    }
  }
  return out;
};
const AREA = { x0: -260, x1: 140, z0: 520, z1: 900 };
const waller = await roadsNamed('Waller Street', AREA);
const scott = await roadsNamed('Scott Street', AREA);
const steiner = await roadsNamed('Steiner Street', AREA);

const segX = (a: P, b: P, c: P, d: P): P | null => {
  const r = { x: b.x - a.x, z: b.z - a.z }, s = { x: d.x - c.x, z: d.z - c.z };
  const den = r.x * s.z - r.z * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * s.z - (c.z - a.z) * s.x) / den, u = ((c.x - a.x) * r.z - (c.z - a.z) * r.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + t * r.x, z: a.z + t * r.z } : null;
};
const crossing = (A: P[][], B: P[][]): P | null => {
  for (const a of A) for (let i = 1; i < a.length; i++) for (const b of B) for (let j = 1; j < b.length; j++) { const hit = segX(a[i - 1], a[i], b[j - 1], b[j]); if (hit) return hit; }
  return null;
};
const xScott = crossing(waller, scott), xSteiner = crossing(waller, steiner);
if (!xScott || !xSteiner) throw new Error(`Waller crossings: Scott ${JSON.stringify(xScott)}, Steiner ${JSON.stringify(xSteiner)}`);
console.error(`Waller × Scott ${xScott.x.toFixed(1)},${xScott.z.toFixed(1)} · Waller × Steiner ${xSteiner.x.toFixed(1)},${xSteiner.z.toFixed(1)}`);

// the stretch: points of Waller whose projection on Scott→Steiner lies inside it
const ax = { x: xSteiner.x - xScott.x, z: xSteiner.z - xScott.z };
const len = Math.hypot(ax.x, ax.z);
const u = { x: ax.x / len, z: ax.z / len };
const along = (p: P) => (p.x - xScott.x) * u.x + (p.z - xScott.z) * u.z;
const segDist = (p: P, a: P, b: P) => { const dx = b.x - a.x, dz = b.z - a.z; const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz); };
const toWaller = (p: P) => Math.min(...waller.flatMap(l => l.slice(1).map((q, i) => segDist(p, l[i], q))));

for (const c of sf.manifest.chunks) {
  const x0 = c.cx * 128, z0 = c.cz * 128;
  if (x0 > AREA.x1 || x0 + 128 < AREA.x0 || z0 > AREA.z1 || z0 + 128 < AREA.z0) continue;
  const r = await sf.rasters(c.cx, c.cz, lms);
  if (r) city.attach(r);
}
setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });

const spots: (P & { f: number })[] = [];
for (const c of sf.manifest.chunks) {
  const x0 = c.cx * 128, z0 = c.cz * 128;
  if (x0 > AREA.x1 || x0 + 128 < AREA.x0 || z0 > AREA.z1 || z0 + 128 < AREA.z0) continue;
  const ch = await sf.chunk(c.cx, c.cz);
  if (!ch) continue;
  const b = ch.buildings;
  for (let i = 0; i < b.count; i++) {
    const poly: P[] = [];
    for (let v = b.vStart[i]; v < b.vStart[i + 1]; v++) poly.push({ x: b.xz[v * 2], z: b.xz[v * 2 + 1] });
    // the edge facing Waller: its midpoint nearest the centreline, roughly parallel to the street
    let best: { a: P; b: P; d: number } | null = null;
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k], q = poly[(k + 1) % poly.length];
      const m = { x: (a.x + q.x) / 2, z: (a.z + q.z) / 2 };
      const d = toWaller(m);
      const e = Math.hypot(q.x - a.x, q.z - a.z);
      const par = Math.abs(((q.x - a.x) * u.x + (q.z - a.z) * u.z) / (e || 1));
      if (e < 1.2 || par < 0.8 || d > 9) continue;
      if (!best || d < best.d) best = { a, b: q, d };
    }
    if (!best) continue;
    const m = { x: (best.a.x + best.b.x) / 2, z: (best.a.z + best.b.z) / 2 };
    const t = along(m);
    if (t < 1.5 || t > len - 1.5) continue;
    // outward: from the wall toward the street
    const ex = best.b.x - best.a.x, ez = best.b.z - best.a.z, el = Math.hypot(ex, ez);
    let n = { x: -ez / el, z: ex / el };
    if (toWaller({ x: m.x + n.x, z: m.z + n.z }) > best.d) n = { x: -n.x, z: -n.z };
    for (const f of el > 3.2 ? [0.3, 0.7] : [0.5]) {
      const p = { x: +(best.a.x + ex * f + n.x * 0.45).toFixed(2), z: +(best.a.z + ez * f + n.z * 0.45).toFixed(2) };
      if (!canStand(p.x, p.z, 0.2) || surfaceAt(p.x, p.z) === 'road') continue;
      if (spots.some(s => Math.hypot(s.x - p.x, s.z - p.z) < 2.6)) continue;
      spots.push({ ...p, f: +Math.atan2(n.x, n.z).toFixed(3) });
    }
  }
}
spots.sort((a, b) => along(a) - along(b));
console.log('// the Painted Ladies\' stoops');
console.log(stoops.join('\n'));
console.log(`// Waller Street, Scott → Steiner (${spots.length})`);
for (const [k, s] of spots.entries()) console.log(`  { x: ${s.x}, z: ${s.z}, r: ${k % 3 === 1 ? 0.28 : 0.22}, f: ${s.f}, face: ${k % 3 === 1} },  // ground ${heightAt(s.x, s.z).toFixed(2)}`);
setCityTerrain(null);
