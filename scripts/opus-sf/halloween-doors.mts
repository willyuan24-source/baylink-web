/**
 * Wave 6 · lane G (W6-G2) · where the trick-or-treat doors stand (halloween/treatDoors.ts TREAT_DOORS), placed on our
 * own published city, never by hand-typed coordinates:
 *
 *   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/halloween-doors.mts     # place, check, print the rows
 *
 * For each street of TREAT_STREETS (the blocks San Francisco closes or crowds for trick-or-treating, sources in
 * treatDoors.ts): the street face of each building within 7 u of the street's centreline and roughly parallel to it,
 * inside the named block first (between the two cross streets' crossings; the block is widened step by step only when
 * it has too few houses), one door per face (≥ 2.8 u apart), on the wall's middle; the knock spot 0.9 u out from the
 * wall must be standable and not the roadway. Doors alternate the two sides where they can.
 *
 * The rows are printed as TypeScript to paste into halloween/treatDoors.ts; tests/opus-bay-w6-g-doors.test.ts re-checks
 * every door on the published city.
 *
 *   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/halloween-doors.mts --fix   # W8-H: move the doors that fail
 *
 * W8-H `--fix`: the doors already in treatDoors.ts keep their numbers (the ledger's `halloween:door:<n>`); every live door
 * that fails the door-to-street rule (tests/opus-bay-w8-h-doorcheck.ts doorProblem: its knock spot reaches its own street
 * on foot, it faces that street, it does not front another one) moves to the nearest candidate face of the same street
 * that passes the rule and stands ≥ 2.8 u from every other door; only the replacement rows are printed.
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
const { TREAT_STREETS, DOORS_PER_STREET, KNOCK_OUT } = await import('../../src/opus-bay/halloween/treatStreets');

type P = { x: number; z: number };
const sf = sfDisk();
const far = await sf.far();
const names = far.names as unknown as string[];
const lms = landmarkWalkInputs(SF_SITES);
const city = createCityTerrain(sf.manifest, { landmarks: lms });
city.setFar(far);

const roadsNamed = async (name: string) => {
  const out: P[][] = [];
  for (const c of sf.manifest.chunks) {
    const ch = await sf.chunk(c.cx, c.cz);
    if (!ch) continue;
    const r = ch.roads;
    for (let i = 0; i < r.count; i++) {
      if (r.nameIdx[i] === 0xffff || names[r.nameIdx[i]] !== name) continue;
      const pts: P[] = [];
      for (let p = r.pStart[i]; p < r.pStart[i + 1]; p++) pts.push({ x: r.xyz[p * 3], z: r.xyz[p * 3 + 2] });
      out.push(pts);
    }
  }
  return out;
};
const segDist = (p: P, a: P, b: P) => { const dx = b.x - a.x, dz = b.z - a.z; const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz); };
const segX = (a: P, b: P, c: P, d: P): P | null => {
  const r = { x: b.x - a.x, z: b.z - a.z }, s = { x: d.x - c.x, z: d.z - c.z };
  const den = r.x * s.z - r.z * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * s.z - (c.z - a.z) * s.x) / den, u = ((c.x - a.x) * r.z - (c.z - a.z) * r.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + t * r.x, z: a.z + t * r.z } : null;
};
const crossing = (A: P[][], B: P[][]): P | null => {
  for (const a of A) for (let i = 1; i < a.length; i++) for (const b of B) for (let j = 1; j < b.length; j++) { const hit = segX(a[i - 1], a[i], b[j - 1], b[j]); if (hit) return hit; }
  // the two streets meet at a node the data splits (or a T that stops short): their nearest points within 3 u
  let best: { d: number; p: P } | null = null;
  for (const a of A) for (const p of a) for (const b of B) for (let j = 1; j < b.length; j++) { const d = segDist(p, b[j - 1], b[j]); if (d < 3 && (!best || d < best.d)) best = { d, p }; }
  return best?.p ?? null;
};

// every chunk round every street first (a neighbour chunk's roads paint over a street's edge: the test sees them all)
for (const st of TREAT_STREETS) {
  const all = (await roadsNamed(st.osm)).flat();
  const cx = all.reduce((s, p) => s + p.x, 0) / all.length, cz = all.reduce((s, p) => s + p.z, 0) / all.length;
  await sf.attachAround(city, cx, cz, 150, lms);
}
setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });

const rows: string[] = [];
let n = 0;
const FIX = process.argv.includes('--fix');
const { TREAT_DOORS } = await import('../../src/opus-bay/halloween/treatDoors');
const { doorProblem, roadsOf } = await import('../../tests/opus-bay-w8-h-doorcheck');
const fixRoads = FIX ? roadsOf((await Promise.all(sf.manifest.chunks.map(c => sf.chunk(c.cx, c.cz)))).filter(c => c !== null), names) : [];
const moved = new Map<number, P & { f: number; y: number }>();
/** a failing door moves at most this far along its street (u); with no candidate that near it goes (`gone: true`) */
const MOVE_MAX = 30;
for (const st of TREAT_STREETS) {
  const road = await roadsNamed(st.osm);
  if (!road.length) throw new Error(`no road ${st.osm}`);
  const all = road.flat();
  const box = { x0: Math.min(...all.map(p => p.x)) - 12, x1: Math.max(...all.map(p => p.x)) + 12, z0: Math.min(...all.map(p => p.z)) - 12, z1: Math.max(...all.map(p => p.z)) + 12 };
  // the block: between the cross streets' crossings (or the street's two ends)
  let A: P | null = null, B: P | null = null;
  if (st.from && st.to) { A = crossing(road, await roadsNamed(st.from)); B = crossing(road, await roadsNamed(st.to)); }
  if (!A || !B) {
    // the two points of the street farthest apart
    let best = 0;
    for (const p of all) for (const q of all) { const d = Math.hypot(p.x - q.x, p.z - q.z); if (d > best) { best = d; A = p; B = q; } }
    if (st.from) console.error(`${st.osm}: no crossing with ${st.from} / ${st.to}; the whole street`);
  }
  const ax = { x: B!.x - A!.x, z: B!.z - A!.z }, len = Math.hypot(ax.x, ax.z), u = { x: ax.x / len, z: ax.z / len };
  const along = (p: P) => (p.x - A!.x) * u.x + (p.z - A!.z) * u.z;
  const toRoad = (p: P) => Math.min(...road.flatMap(l => l.slice(1).map((q, i) => segDist(p, l[i], q))));
  const localDir = (p: P) => {
    // the street's direction near p (its nearest segment)
    let best = { d: 1e9, x: u.x, z: u.z };
    for (const l of road) for (let i = 1; i < l.length; i++) { const d = segDist(p, l[i - 1], l[i]); if (d < best.d) { const ex = l[i].x - l[i - 1].x, ez = l[i].z - l[i - 1].z, e = Math.hypot(ex, ez) || 1; best = { d, x: ex / e, z: ez / e }; } }
    return best;
  };
  const cands: (P & { f: number; y: number; t: number; side: number; kx: number; kz: number })[] = [];
  for (const c of sf.manifest.chunks) {
    const x0 = c.cx * 128, z0 = c.cz * 128;
    if (x0 > box.x1 || x0 + 128 < box.x0 || z0 > box.z1 || z0 + 128 < box.z0) continue;
    const ch = await sf.chunk(c.cx, c.cz);
    if (!ch) continue;
    const b = ch.buildings;
    for (let i = 0; i < b.count; i++) {
      const poly: P[] = [];
      for (let v = b.vStart[i]; v < b.vStart[i + 1]; v++) poly.push({ x: b.xz[v * 2], z: b.xz[v * 2 + 1] });
      let best: { a: P; b: P; d: number } | null = null;
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k], q = poly[(k + 1) % poly.length];
        const m = { x: (a.x + q.x) / 2, z: (a.z + q.z) / 2 };
        const d = toRoad(m);
        const e = Math.hypot(q.x - a.x, q.z - a.z);
        const dir = localDir(m);
        const par = Math.abs(((q.x - a.x) * dir.x + (q.z - a.z) * dir.z) / (e || 1));
        if (e < 0.8 || par < 0.85 || d > 7) continue;
        if (!best || d < best.d) best = { a, b: q, d };
      }
      if (!best) continue;
      const m = { x: (best.a.x + best.b.x) / 2, z: (best.a.z + best.b.z) / 2 };
      const ex = best.b.x - best.a.x, ez = best.b.z - best.a.z, el = Math.hypot(ex, ez);
      let nn = { x: -ez / el, z: ex / el };
      if (toRoad({ x: m.x + nn.x, z: m.z + nn.z }) > best.d) nn = { x: -nn.x, z: -nn.z };
      const door = { x: +(m.x + nn.x * 0.02).toFixed(2), z: +(m.z + nn.z * 0.02).toFixed(2) };
      // the knock spot exactly as the game puts it (from the rounded door), and a little margin toward the street
      const knock = { x: door.x + Math.sin(Math.atan2(nn.x, nn.z)) * KNOCK_OUT, z: door.z + Math.cos(Math.atan2(nn.x, nn.z)) * KNOCK_OUT };
      if (!canStand(knock.x, knock.z, 0.3) || surfaceAt(knock.x, knock.z) === 'road' || surfaceAt(knock.x + nn.x * 0.15, knock.z + nn.z * 0.15) === 'road') continue;
      const foot = { x: m.x + nn.x * 0.3, z: m.z + nn.z * 0.3 };
      if (!canStand(foot.x, foot.z, 0.1)) continue;
      // the house blocks walking right behind the door (a lot the walk grid dropped would leave a door on nothing)
      if (canStand(door.x - nn.x * 0.25, door.z - nn.z * 0.25, 0.05)) continue;
      const dir = localDir(m);
      const side = Math.sign(dir.x * nn.z - dir.z * nn.x);
      cands.push({ ...door, f: +Math.atan2(nn.x, nn.z).toFixed(3), y: +heightAt(foot.x, foot.z).toFixed(2), t: along(m), side, kx: knock.x, kz: knock.z });
    }
  }
  if (FIX) {
    const ground = { canStand, surfaceAt };
    const spot = (d: { n: number; x: number; z: number }) => moved.get(d.n) ?? d;
    for (const d of TREAT_DOORS.filter(q => q.street === st.id && !q.gone)) {
      const why = doorProblem(d, KNOCK_OUT, st.osm, fixRoads, ground);
      if (!why) continue;
      // ≥ 2.8 u from every other door, a gone one too (W7-G7's door 8 went for a reason); at most MOVE_MAX from the old spot
      const free = (c: P) => TREAT_DOORS.every(o => o.n === d.n || Math.hypot(spot(o).x - c.x, spot(o).z - c.z) >= 2.8);
      const pick = cands
        .filter(c => Math.hypot(c.x - d.x, c.z - d.z) <= MOVE_MAX && free(c) && !doorProblem(c, KNOCK_OUT, st.osm, fixRoads, ground))
        .sort((a, b) => Math.hypot(a.x - d.x, a.z - d.z) - Math.hypot(b.x - d.x, b.z - d.z))[0];
      if (!pick) {
        console.error(`door ${d.n} (${st.id}): ${why} — no candidate within ${MOVE_MAX} u: gone`);
        rows.push(`  { n: ${d.n}, street: '${st.id}', x: ${d.x}, z: ${d.z}, y: ${d.y}, f: ${d.f}, gone: true }, // ${why}`);
        continue;
      }
      moved.set(d.n, { x: pick.x, z: pick.z, f: pick.f, y: pick.y });
      console.error(`door ${d.n} (${st.id}): ${why} → moves ${Math.hypot(pick.x - d.x, pick.z - d.z).toFixed(1)} u`);
      rows.push(`  { n: ${d.n}, street: '${st.id}', x: ${pick.x}, z: ${pick.z}, y: ${pick.y}, f: ${pick.f} }, // was (${d.x}, ${d.z}, f ${d.f})`);
    }
    continue;
  }
  // inside the block first, then the nearest outside it; alternate the two sides; ≥ 2.8 u apart
  const outside = (t: number) => (t < 0 ? -t : t > len ? t - len : 0);
  cands.sort((a, b) => outside(a.t) - outside(b.t) || a.t - b.t);
  const picked: typeof cands = [];
  const room = (p: P) => picked.every(s => Math.hypot(s.x - p.x, s.z - p.z) >= 2.8);
  // spread: take every k-th inside the block so the ten reach from one end to the other
  const inside = cands.filter(c => outside(c.t) === 0);
  const stride = Math.max(1, Math.floor(inside.length / DOORS_PER_STREET));
  for (let pass = 0; pass < 4 && picked.length < DOORS_PER_STREET; pass++) {
    const pool = pass === 0 ? inside.filter((_, i) => i % stride === 0) : pass === 1 ? inside : cands.filter(c => outside(c.t) < (pass === 2 ? 60 : 140));
    for (const c of pool) { if (picked.length >= DOORS_PER_STREET) break; if (!picked.includes(c) && room(c)) picked.push(c); }
  }
  picked.sort((a, b) => a.t - b.t);
  console.error(`${st.id}: ${picked.length} doors (${inside.length} faces in the block, ${cands.length} near the street), block ${len.toFixed(0)} u`);
  rows.push(`  // ${st.osm}${st.from ? ` (${st.from} → ${st.to})` : ''}`);
  for (const p of picked) rows.push(`  { n: ${++n}, street: '${st.id}', x: ${p.x}, z: ${p.z}, y: ${p.y}, f: ${p.f} },`);
}
console.log(rows.join('\n'));
setCityTerrain(null);
