import type { Bilingual, Vec2 } from '../core/types';
import type { TransitLineJson } from './transit';

/**
 * The F-line in city mode (lane F, checkpoint F7), pure (no three.js, no DOM): the hero loop's track (DISTRICT.streetcar)
 * spliced into the published OSM route (transit.json 'f-line', ODbL), so the vintage cars run from the Pier 39 end along
 * the hero Embarcadero, round the foot of Market and up Market Street to the balloon loop at 17th & Castro.
 *
 * Physical centre line C, arc s: s = 0 at J2 (Market & Noe, where the Castro loop leaves Market) … `clen` at the hero
 * track's Pier 39 end. Along it:
 *   - the hero side (s ≥ sJoin): the district's double track, C = hero track A shifted LANE landward (track A toward
 *     Pier 39 and track B toward Castro are C ∓ LANE, as the district draws them);
 *   - the foot of Market inside the slab: a constructed single track that clears the district's trees and lots (the
 *     published route via Steuart St / Don Chee Way turns corners an 8.4 u toy car cannot): up Market on its east side,
 *     a left curve onto the plaza and a right U-turn onto the hero track just east of the Ferry Building stop (the
 *     switch, sJoin);
 *   - Market Street (the published route): single track on the city's drawn rails (the street is 4.4–5.6 u wide, two
 *     2.1 u cars side by side only fit at a stop), with passing places at the stations: each direction steps PASS to
 *     its own side there, the same side as on the double track (the district runs left-hand); world/flineSystem.ts
 *     keeps one car per block between passing places.
 * The cars run round one closed cycle (like the district's loop): leg 1 toward Castro (s falling, lane +), leg 2 the
 * Castro balloon loop (Noe St, 17th St, the Castro terminal, back down Market to J2), leg 3 toward Pier 39 (s rising,
 * lane −), leg 4 the Pier 39 turnaround half loop. `sOf` maps the stem legs back to s for the block rules.
 * Stations: the four hero stops keep their district ids (ferry, green, bay, pier39), Market Street stops of the published
 * route merge by name into `f-<slug>` stations, and 17th & Castro (`f-17th-castro`) is the terminal on the loop.
 */

export const FL = {
  /** body length / half length / width (world/streetcar.ts carGeometry) */
  length: 8.4,
  half: 4.2,
  width: 2.1,
  /** bogie centres ± this along the track */
  bogie: 3.2,
  /** top speed on the hero Embarcadero (the district's VMAX) and on Market Street (u/s) */
  vHero: 11,
  vCity: 14,
  acc: 3,
  dec: 3,
  /** lateral acceleration on curves (u/s²) and the slowest a curve limit goes */
  aLat: 2.4,
  vCurveMin: 3,
  /** dwell at a hero stop (the district's), a Market Street dwell stop, a terminus, a request stop (s) */
  dwell: 6,
  dwellCity: 4,
  terminus: 9,
  request: 3,
  /** Market Street: cars always stop at every third station (the others on request) */
  dwellEvery: 3,
  /** bumper gap to the car ahead (u) */
  gap: 3,
  /** half the district's track spacing (2.8 u) */
  lane: 1.4,
  /** passing place: lateral step, fully open ± passHalf around its centre, ramps over passRamp */
  pass: 1.1,
  passHalf: 4.8,
  passRamp: 6,
  /** the double track merges into the single track over this length before sJoin */
  switchRamp: 6,
  /** passing places at least this far apart (and from J2) */
  minBlock: 22,
  /** a car leaving the loop waits with its front this far before J2 (the loop's way in diverges there) */
  loopHold: 8,
  /** a car entering the loop frees the stem once its tail is this far into the loop */
  loopClear: 10,
  /** body origin above the rail head (district CAR_Y) */
  carY: 0.12,
} as const;

export interface FLineStation {
  /** hero stop id (ferry, green, bay, pier39) or `f-<slug>` */
  id: string;
  name: Bilingual;
  x: number;
  z: number;
  /** one of the district's four stops (it has its own interactable) */
  hero: boolean;
  terminus: boolean;
}

export interface FLineStop {
  station: string;
  /** cycle position (car centre) */
  u: number;
  leg: 1 | 2 | 3 | 4;
  /** cars always stop here (else only for a rider) */
  dwell: boolean;
  terminus: boolean;
  /** seconds a car stands here when it stops */
  wait: number;
}

export interface FLine {
  /** physical centre line: x, y, z triples, J2 (s = 0) → the hero track's Pier 39 end */
  cxyz: Float32Array;
  cs: Float32Array;
  clen: number;
  /** the switch: double track (the hero) from here on, single track below */
  sJoin: number;
  /** C enters the hero slab here (F draws the rails from sSlab to sJoin; the city draws Market below it) */
  sSlab: number;
  /** block boundaries on C: [0 (J2), …passing places…, sJoin] */
  bounds: number[];
  /** the cars' closed cycle: x, y, z triples; cum has n + 1 entries (the last closes back to vertex 0) */
  xyz: Float32Array;
  cum: Float32Array;
  length: number;
  /** physical s of each cycle vertex on the stem legs (1, 3), NaN on the loop and the turnaround */
  sOf: Float32Array;
  leg: Uint8Array;
  /** speed limit at each vertex (curves, hero / city top speed) */
  vlim: Float32Array;
  /** cycle u where legs 1, 2, 3, 4 start */
  legU: [number, number, number, number];
  /** the loop exit's hold point (car centre u on leg 2) */
  uLoopHold: number;
  stations: FLineStation[];
  /** sorted by u */
  stops: FLineStop[];
}

/** The hero loop's track as the district gives it (DISTRICT.streetcar). */
export interface HeroTrack { path: Vec2[]; stops: { id: string; at: number; name: Bilingual }[] }

type P3 = [number, number, number];

/** v1 data: J2 and the Castro loop's corners, and the in-slab route (the district's lots and trees fix it). */
export const FLINE_V1 = {
  /** J2 on the Market line, and the Market / Noe corner just north of it */
  j2z: 700,
  noeZ: 703.6,
  /** the published return leg down Market from the Castro terminal (the Muni F way, OSM): x at z = 690 and z = 735 */
  marketX690: 141.5,
  marketX735: 141.9,
  /** Noe St × 17th St, and the hairpin where 17th St meets the Market return (lines through the OSM route) */
  noe17: { x: 159.29, z: 718.68 },
  hairpin: { x: 141.9, z: 739.1 },
  /** fillet radii at the Market / Noe corner, Noe / 17th and the hairpin */
  loopR: [6.5, 6.5, 3] as readonly number[],
  /** in-slab Market: x north of lot 5, the east-side x past lot 5, then a little further east past the two trees at the
   *  foot of Market (south of lot 5's corner) */
  slabX: 133.0,
  eastX: 135.15,
  easeFrom: 54.5,
  easeTo: 47.5,
  treeX: 135.4,
  treeEaseFrom: 40,
  treeEaseTo: 36.5,
  /** the left curve (Market → east) starts at this z, radius turnR; the U-turn follows (radius ≈ 5 to the hero track).
   *  The whole foot of Market clears lot 5 and the trees' main canopy by a few centimetres (a sweep of the car body in
   *  tests/opus-bay-sf-fline.test.ts; the tightest fit found for the 8.4 u car) */
  turnZ: 35,
  turnR: 4,
} as const;

const smooth = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

function cumulative(pts: P3[]): Float32Array {
  const cum = new Float32Array(pts.length);
  for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
  return cum;
}

/** Subdivide segments longer than `step` (lane ramps, curvature and ground heights need the vertices). */
function densify(pts: P3[], step: number): P3[] {
  const out: P3[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / step);
    for (let k = 1; k <= n; k++) { const t = k / n; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
  }
  return out;
}

/** Drop vertices closer than `min` to the previous kept one (the published path has many near-duplicates). */
function dedupe(pts: P3[], min: number): P3[] {
  const out: P3[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = out[out.length - 1], b = pts[i];
    if (Math.hypot(b[0] - a[0], b[2] - a[2]) >= min) out.push(b);
    else if (i === pts.length - 1) out[out.length - 1] = b;
  }
  return out;
}

/** Point at arc s of a polyline (x, y, z), clamped. */
function atArc(pts: P3[], cum: ArrayLike<number>, s: number): P3 {
  const n = pts.length;
  if (s <= 0) return pts[0];
  if (s >= cum[n - 1]) return pts[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
  const t = (s - cum[lo]) / (cum[hi] - cum[lo] || 1), a = pts[lo], b = pts[hi];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Nearest arc position on a polyline to (x, z), within [from, to]. */
function nearestArc(pts: P3[], cum: ArrayLike<number>, x: number, z: number, from = 0, to = Infinity): { s: number; d: number } {
  let best = { s: from, d: Infinity };
  for (let i = 1; i < pts.length; i++) {
    if (cum[i] < from || cum[i - 1] > to) continue;
    const a = pts[i - 1], b = pts[i];
    const dx = b[0] - a[0], dz = b[2] - a[2], L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / L2));
    const d = Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t);
    if (d < best.d) best = { s: cum[i - 1] + (cum[i] - cum[i - 1]) * t, d };
  }
  return best;
}

/** The right-hand normal (dz, −dx) of a polyline at vertex i (central difference). */
function normalAt(pts: P3[], i: number): Vec2 {
  const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
  const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1;
  return { x: dz / L, z: -dx / L };
}

/**
 * Round the corners of a control polygon with circular fillets (radius `radii[i - 1]` at corner i). Where two corners
 * want more of a segment than it has, both tangents shrink in proportion. Returns the path sampled every `step`.
 */
export function filletPath(ctrl: P3[], radii: readonly number[], step = 0.8): P3[] {
  const n = ctrl.length;
  if (n < 3) return densify(ctrl, step);
  const len = (i: number) => Math.hypot(ctrl[i + 1][0] - ctrl[i][0], ctrl[i + 1][2] - ctrl[i][2]);
  const turn = new Array<number>(n).fill(0), want = new Array<number>(n).fill(0), scale = new Array<number>(n).fill(1);
  for (let i = 1; i < n - 1; i++) {
    const p = ctrl[i], a = ctrl[i - 1], b = ctrl[i + 1];
    const h1 = Math.atan2(p[0] - a[0], p[2] - a[2]), h2 = Math.atan2(b[0] - p[0], b[2] - p[2]);
    let dh = h2 - h1;
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    turn[i] = Math.abs(dh);
    want[i] = turn[i] > 0.02 ? (radii[i - 1] ?? radii[radii.length - 1]) * Math.tan(turn[i] / 2) : 0;
  }
  for (let sgi = 0; sgi < n - 1; sgi++) {
    const need = want[sgi] + want[sgi + 1];
    if (need > len(sgi)) { const k = len(sgi) / need; scale[sgi] = Math.min(scale[sgi], k); scale[sgi + 1] = Math.min(scale[sgi + 1], k); }
  }
  const out: P3[] = [ctrl[0]];
  for (let i = 1; i < n - 1; i++) {
    const p = ctrl[i], a = ctrl[i - 1], b = ctrl[i + 1];
    if (!want[i]) { out.push(p); continue; }
    const la = Math.hypot(a[0] - p[0], a[2] - p[2]) || 1, lb = Math.hypot(b[0] - p[0], b[2] - p[2]) || 1;
    const ux = (a[0] - p[0]) / la, uz = (a[2] - p[2]) / la, vx = (b[0] - p[0]) / lb, vz = (b[2] - p[2]) / lb;
    const tanLen = want[i] * scale[i];
    const rr = tanLen / Math.tan(turn[i] / 2);
    const t1: P3 = [p[0] + ux * tanLen, p[1] + (a[1] - p[1]) * (tanLen / la), p[2] + uz * tanLen];
    const t2: P3 = [p[0] + vx * tanLen, p[1] + (b[1] - p[1]) * (tanLen / lb), p[2] + vz * tanLen];
    const bx = ux + vx, bz = uz + vz, bl = Math.hypot(bx, bz) || 1;
    const dc = Math.hypot(rr, tanLen);
    const cx = p[0] + (bx / bl) * dc, cz = p[2] + (bz / bl) * dc;
    const a1 = Math.atan2(t1[2] - cz, t1[0] - cx), a2 = Math.atan2(t2[2] - cz, t2[0] - cx);
    let da = a2 - a1;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    const steps = Math.max(2, Math.ceil((Math.abs(da) * rr) / step));
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, ang = a1 + da * t;
      out.push([cx + Math.cos(ang) * rr, t1[1] + (t2[1] - t1[1]) * t, cz + Math.sin(ang) * rr]);
    }
  }
  out.push(ctrl[n - 1]);
  return densify(dedupe(out, 0.05), step);
}

/** Lane offset (along C's right-hand normal) of a car travelling `dir` (+1 toward Pier 39, −1 toward Castro) at s. */
export function laneOffset(line: Pick<FLine, 'sJoin' | 'bounds'>, s: number, dir: 1 | -1): number {
  let m: number;
  if (s >= line.sJoin) m = FL.lane;
  else if (s >= line.sJoin - FL.switchRamp) m = FL.lane * smooth(line.sJoin - FL.switchRamp, line.sJoin, s);
  else {
    m = 0;
    for (let k = 1; k < line.bounds.length - 1; k++) {
      const d = Math.abs(s - line.bounds[k]);
      if (d < FL.passHalf + FL.passRamp) m = Math.max(m, FL.pass * (1 - smooth(FL.passHalf, FL.passHalf + FL.passRamp, d)));
    }
  }
  return -dir * m;
}

const STREET_WORDS = /\b(street|st|avenue|ave|boulevard|blvd|place|pl)\b\.?/gi;
const shortName = (name: string) => name.replace(STREET_WORDS, '').replace(/\s+/g, ' ').replace(/\s*&\s*/g, ' & ').trim();
const slug = (name: string) => shortName(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 58) || 'stop';
/** zh names where the place has a common Chinese form (G2's glossary: 卡斯特罗) */
const ZH_NAMES: Record<string, string> = { 'f-17th-castro': '卡斯特罗 · 17th & Castro' };

/** Right U-turn from S (heading +x) onto the hero centre line: its radius, the landing arc on the hero line, its points. */
function uTurnOnto(hero: P3[], heroCum: Float32Array, S: Vec2): { r: number; heroS: number; pts: P3[] } {
  const probe = nearestArc(hero, heroCum, S.x, S.z - 10);
  const a = atArc(hero, heroCum, probe.s - 1), b = atArc(hero, heroCum, probe.s + 1);
  const hH = Math.atan2(b[0] - a[0], b[2] - a[2]);
  // a right turn keeps its centre O = S + r·(0, −1); heading h sits at O − r·(cos h, −sin h)
  const E = (r: number) => ({ x: S.x - r * Math.cos(hH), z: S.z - r + r * Math.sin(hH) });
  const landward = (r: number) => {
    const e = E(r), nn = nearestArc(hero, heroCum, e.x, e.z);
    const p = atArc(hero, heroCum, nn.s), q = atArc(hero, heroCum, nn.s + 0.5);
    return ((q[0] - p[0]) * (e.z - p[2]) - (q[2] - p[2]) * (e.x - p[0])) < 0 ? nn.d : -nn.d;
  };
  let lo = 2.5, hi = 9;
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (landward(mid) > 0) lo = mid; else hi = mid; }
  const r = (lo + hi) / 2;
  const sweep = (((hH - Math.PI / 2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const steps = Math.ceil((sweep * r) / 0.6);
  const pts: P3[] = [];
  for (let k = 1; k <= steps; k++) {
    const h = Math.PI / 2 + (sweep * k) / steps;
    pts.push([S.x - r * Math.cos(h), 0, S.z - r + r * Math.sin(h)]);
  }
  const e = E(r);
  return { r, heroS: nearestArc(hero, heroCum, e.x, e.z).s, pts };
}

/** Build the city F-line from the published route and the hero track (null without a usable 'f-line' entry). */
export function buildFLine(j: TransitLineJson | undefined, hero: HeroTrack): FLine | null {
  if (!j || j.path.length < 30 || hero.path.length < 2) return null;
  const osm: P3[] = [];
  for (let i = 0; i + 2 < j.path.length; i += 3) osm.push([j.path[i], j.path[i + 1], j.path[i + 2]]);
  const osmCum = cumulative(osm), osmLen = osmCum[osmCum.length - 1];
  const heroEnd = j.heroSpans.reduce((m, [, b]) => Math.max(m, b), 0);
  const V = FLINE_V1;
  /** the Market line near J2 (the published return leg, straight) */
  const mx = (z: number) => V.marketX690 + ((z - 690) / 45) * (V.marketX735 - V.marketX690);
  const j2At = nearestArc(osm, osmCum, mx(V.j2z), V.j2z, osmLen * 0.8).s;
  const yJ2 = atArc(osm, osmCum, j2At)[1];

  // --- 1. C, city part: the published route from J2 back to the slab edge (Market St, s rising toward the Ferry); north
  //        of z 690 it follows the straight Market line (the loop leaves and rejoins it at J2)
  const city: P3[] = [[mx(V.j2z), yJ2, V.j2z]];
  for (let i = osm.length - 1; i >= 0; i--) {
    if (osmCum[i] >= j2At - 0.3) continue;
    if (osmCum[i] < heroEnd + 4) break;
    const p = osm[i], k = smooth(676, 692, p[2]);
    city.push([p[0] + (mx(p[2]) - p[0]) * k, p[1], p[2]]);
  }
  // --- 2. inside the slab: x = slabX between the lots, the east side of Market past lot 5 and the foot-of-Market trees,
  //        a left curve onto the plaza, then the right U-turn onto the hero track
  const slab: P3[] = [];
  for (let z = 112; z > V.easeFrom; z -= 1.5) slab.push([V.slabX, 0, z]);
  for (let z = V.easeFrom; z >= V.easeTo - 1e-6; z -= 0.5) slab.push([V.slabX + (V.eastX - V.slabX) * smooth(V.easeFrom, V.easeTo, z), 0, z]);
  for (let z = V.easeTo - 1.5; z > V.treeEaseFrom; z -= 1.5) slab.push([V.eastX, 0, z]);
  for (let z = V.treeEaseFrom; z >= V.treeEaseTo - 1e-6; z -= 0.4) slab.push([V.eastX + (V.treeX - V.eastX) * smooth(V.treeEaseFrom, V.treeEaseTo, z), 0, z]);
  for (let z = V.treeEaseTo - 1; z > V.turnZ; z -= 1) slab.push([V.treeX, 0, z]);
  const O1 = { x: V.treeX + V.turnR, z: V.turnZ };
  for (let k = 0; k <= 12; k++) {
    const h = Math.PI - (Math.PI / 2) * (k / 12);
    slab.push([O1.x + V.turnR * Math.cos(h), 0, O1.z - V.turnR * Math.sin(h)]);
  }
  // the hero centre line (C on the Embarcadero): track A + LANE landward
  const heroA: P3[] = hero.path.map(p => [p.x, 0, p.z]);
  const heroACum = cumulative(heroA), heroLenA = heroACum[heroA.length - 1];
  const heroC: P3[] = heroA.map((p, i) => { const nn = normalAt(heroA, i); return [p[0] + nn.x * FL.lane, 0, p[2] + nn.z * FL.lane]; });
  const heroCCum = cumulative(heroC);
  const turn = uTurnOnto(heroC, heroCCum, { x: O1.x, z: V.turnZ - V.turnR });
  const heroPart: P3[] = [];
  for (let i = 0; i < heroC.length; i++) if (heroCCum[i] > turn.heroS + 0.4) heroPart.push(heroC[i]);

  const C = densify(dedupe([...city, ...slab, ...turn.pts, ...heroPart], 0.3), 1.5);
  const cs = cumulative(C), clen = cs[cs.length - 1];
  const land = turn.pts[turn.pts.length - 1];
  const sJoin = nearestArc(C, cs, land[0], land[2], clen * 0.2).s;
  let sSlab = 0;
  for (let i = 0; i < C.length; i++) if (C[i][2] <= 120) { sSlab = cs[i]; break; }

  // --- 3. stations: Market Street stops beyond the slab (merged by name), the hero stops, 17th & Castro (on the loop)
  const stations: FLineStation[] = [];
  const onC: { id: string; s: number }[] = [];
  const cityStops = j.stops.filter(st => st.at > heroEnd + 2 && st.at < j2At - 1);
  const byName = new Map<string, typeof cityStops>();
  for (const st of cityStops) { const key = shortName(st.name.en); byName.set(key, [...(byName.get(key) ?? []), st]); }
  for (const [name, list] of byName) {
    const x = list.reduce((a, st) => a + st.x, 0) / list.length, z = list.reduce((a, st) => a + st.z, 0) / list.length;
    const s = nearestArc(C, cs, x, z, 0, sSlab).s;
    const p = atArc(C, cs, s);
    const id = `f-${slug(name)}`;
    stations.push({ id, name: { zh: ZH_NAMES[id] ?? name, en: name }, x: p[0], z: p[2], hero: false, terminus: false });
    onC.push({ id, s });
  }
  for (const st of hero.stops) {
    const a = atArc(heroA, heroACum, st.at * heroLenA);
    const s = nearestArc(C, cs, a[0], a[2], sJoin).s;
    if (s < sJoin + FL.half + 1) continue;
    const p = atArc(C, cs, s);
    stations.push({ id: st.id, name: st.name, x: p[0], z: p[2], hero: true, terminus: st.id === 'pier39' });
    onC.push({ id: st.id, s });
  }
  onC.sort((a, b) => a.s - b.s);
  const castroStops = j.stops.filter(st => st.at > j2At);

  // --- 4. passing places: Market stations at least minBlock apart (from J2 up), clear of the slab
  const bounds = [0];
  for (const st of onC) {
    if (st.s > sSlab - FL.passHalf - FL.passRamp - 2) break;
    if (st.s - bounds[bounds.length - 1] < FL.minBlock) continue;
    bounds.push(st.s);
  }
  bounds.push(sJoin);
  const lanes = { sJoin, bounds };

  // --- 5. the Castro balloon loop: J2 → the Market / Noe corner → Noe St → 17th St (the terminal) → the hairpin → back
  //        down Market to J2
  const castroEnd = osm[osm.length - 1];
  const yNoe = atArc(osm, osmCum, nearestArc(osm, osmCum, V.noe17.x, V.noe17.z, j2At).s)[1];
  const loop = filletPath([
    [mx(V.j2z), yJ2, V.j2z],
    [mx(V.noeZ), yJ2, V.noeZ],
    [V.noe17.x, yNoe, V.noe17.z],
    [V.hairpin.x, castroEnd[1], V.hairpin.z],
    [mx(V.j2z), yJ2, V.j2z],
  ], V.loopR, 0.8);

  // --- 6. the Pier 39 turnaround: the district's half loop bulging past the end of tracks A / B
  const n = C.length;
  const nEnd = normalAt(C, n - 1);
  const endA: Vec2 = { x: C[n - 1][0] - nEnd.x * FL.lane, z: C[n - 1][2] - nEnd.z * FL.lane };
  const endB: Vec2 = { x: C[n - 1][0] + nEnd.x * FL.lane, z: C[n - 1][2] + nEnd.z * FL.lane };
  const fx = C[n - 1][0] - C[n - 2][0], fz = C[n - 1][2] - C[n - 2][2], fl = Math.hypot(fx, fz) || 1;
  const turnaround: P3[] = [];
  {
    const cx = (endA.x + endB.x) / 2, cz = (endA.z + endB.z) / 2, r = FL.lane;
    const ax = (endA.x - cx) / r, az = (endA.z - cz) / r;
    for (let k = 1; k < 8; k++) {
      const t = (k / 8) * Math.PI;
      turnaround.push([cx + ax * Math.cos(t) * r + (fx / fl) * Math.sin(t) * r * 1.6, C[n - 1][1], cz + az * Math.cos(t) * r + (fz / fl) * Math.sin(t) * r * 1.6]);
    }
  }

  // --- 7. the cycle: leg 1 (toward Castro), leg 2 (the loop), leg 3 (toward Pier 39), leg 4 (the turnaround)
  const pts: P3[] = [], sOf: number[] = [], legs: number[] = [];
  const add = (p: P3, s: number, leg: number) => { pts.push(p); sOf.push(s); legs.push(leg); };
  const offset = (i: number, dir: 1 | -1): P3 => { const nn = normalAt(C, i), o = laneOffset(lanes, cs[i], dir); return [C[i][0] + nn.x * o, C[i][1], C[i][2] + nn.z * o]; };
  for (let i = n - 1; i >= 0; i--) add(offset(i, -1), cs[i], 1);
  for (let i = 1; i < loop.length - 1; i++) add(loop[i], NaN, 2);
  for (let i = 0; i < n; i++) add(offset(i, 1), cs[i], 3);
  for (const p of turnaround) add(p, NaN, 4);
  const N = pts.length;
  const xyz = new Float32Array(N * 3), cum = new Float32Array(N + 1), sArr = new Float32Array(N), legArr = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    xyz[i * 3] = pts[i][0]; xyz[i * 3 + 1] = pts[i][1]; xyz[i * 3 + 2] = pts[i][2];
    sArr[i] = sOf[i]; legArr[i] = legs[i];
    const b = pts[(i + 1) % N];
    cum[i + 1] = cum[i] + Math.hypot(b[0] - pts[i][0], b[2] - pts[i][2]);
  }
  const length = cum[N];
  const firstOf = (leg: number) => cum[legs.indexOf(leg)];
  const legU: [number, number, number, number] = [firstOf(1), firstOf(2), firstOf(3), firstOf(4)];

  // --- 8. speed limit per vertex: the mean curvature over the car's length around it (the heading change from 4 u
  //        behind to 4 u ahead, so the published path's jitter does not count), top speed by zone
  const vlim = new Float32Array(N);
  const P = (u: number) => cyclePoint({ xyz, cum, length }, u);
  for (let i = 0; i < N; i++) {
    const a = P(cum[i] - FL.half), p = P(cum[i]), b = P(cum[i] + FL.half);
    let dh = Math.atan2(b.x - p.x, b.z - p.z) - Math.atan2(p.x - a.x, p.z - a.z);
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    const k = Math.abs(dh) / FL.length;
    const top = legs[i] === 4 || sOf[i] >= sJoin ? FL.vHero : FL.vCity;
    vlim[i] = k > 1e-4 ? Math.max(FL.vCurveMin, Math.min(top, Math.sqrt(FL.aLat / k))) : top;
  }

  const line: FLine = {
    cxyz: new Float32Array(C.flat()), cs, clen, sJoin, sSlab, bounds,
    xyz, cum, length, sOf: sArr, leg: legArr, vlim, legU, uLoopHold: legU[2] - FL.loopHold - FL.half, stations, stops: [],
  };

  // --- 9. stops on the cycle: both legs of every stem station, the Castro terminal on the loop
  const stops: FLineStop[] = [];
  const cityIds = onC.filter(o => o.id.startsWith('f-')).map(o => o.id);
  for (const o of onC) {
    const st = stations.find(x => x.id === o.id)!;
    const dwell = st.hero || cityIds.indexOf(o.id) % FL.dwellEvery === 1;
    const wait = st.terminus ? FL.terminus : st.hero ? FL.dwell : dwell ? FL.dwellCity : FL.request;
    for (const leg of [1, 3] as const) stops.push({ station: o.id, u: uAtS(line, leg, o.s), leg, dwell, terminus: st.terminus, wait });
  }
  if (castroStops.length) {
    const cx = castroStops.reduce((a, st) => a + st.x, 0) / castroStops.length, cz = castroStops.reduce((a, st) => a + st.z, 0) / castroStops.length;
    let best = { u: legU[1], d: Infinity };
    for (let i = 0; i < N; i++) {
      if (legs[i] !== 2) continue;
      const d = Math.hypot(pts[i][0] - cx, pts[i][2] - cz);
      if (d < best.d) best = { u: cum[i], d };
    }
    const id = 'f-17th-castro', name = shortName(castroStops[0].name.en);
    const p = cyclePoint(line, best.u);
    stations.push({ id, name: { zh: ZH_NAMES[id] ?? name, en: name }, x: p.x, z: p.z, hero: false, terminus: true });
    stops.push({ station: id, u: best.u, leg: 2, dwell: true, terminus: true, wait: FL.terminus });
  }
  stops.sort((a, b) => a.u - b.u);
  line.stops = stops;
  return line;
}

// ---------------------------------------------------------------------------
// Cycle helpers (pure)
// ---------------------------------------------------------------------------

/** u wrapped into [0, length). */
export const wrapU = (line: Pick<FLine, 'length'>, u: number) => ((u % line.length) + line.length) % line.length;
/** How far ahead (u, along travel) `to` is from `from`: [0, length). */
export const aheadU = (line: Pick<FLine, 'length'>, from: number, to: number) => wrapU(line, to - from);

function segAt(cum: ArrayLike<number>, u: number): number {
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= u) lo = mid; else hi = mid; }
  return lo;
}

export interface CyclePoint { x: number; y: number; z: number; heading: number; i: number; t: number }

/** Point on the cycle at u (wraps): position, published height, heading of travel, segment index and fraction. */
export function cyclePoint(line: Pick<FLine, 'xyz' | 'cum' | 'length'>, u: number, out?: CyclePoint): CyclePoint {
  const uu = wrapU(line, u);
  const i = segAt(line.cum, uu), n = line.xyz.length / 3, j = (i + 1) % n;
  const t = (uu - line.cum[i]) / (line.cum[i + 1] - line.cum[i] || 1);
  const x = line.xyz;
  const r = out ?? { x: 0, y: 0, z: 0, heading: 0, i: 0, t: 0 };
  r.x = x[i * 3] + (x[j * 3] - x[i * 3]) * t;
  r.y = x[i * 3 + 1] + (x[j * 3 + 1] - x[i * 3 + 1]) * t;
  r.z = x[i * 3 + 2] + (x[j * 3 + 2] - x[i * 3 + 2]) * t;
  r.heading = Math.atan2(x[j * 3] - x[i * 3], x[j * 3 + 2] - x[i * 3 + 2]);
  r.i = i; r.t = t;
  return r;
}

/** Which leg u is on. */
export function legAt(line: Pick<FLine, 'legU' | 'length'>, u: number): 1 | 2 | 3 | 4 {
  const uu = wrapU(line, u);
  const [, b, c, d] = line.legU;
  if (uu >= d) return 4;
  if (uu >= c) return 3;
  if (uu >= b) return 2;
  return 1;
}

/** Physical s at cycle u on the stem legs (1, 3); NaN on the loop and the turnaround. */
export function sAtU(line: Pick<FLine, 'cum' | 'length' | 'sOf' | 'leg'>, u: number): number {
  const uu = wrapU(line, u);
  const i = segAt(line.cum, uu), n = line.sOf.length, j = (i + 1) % n;
  const a = line.sOf[i], b = line.sOf[j];
  if (Number.isNaN(a)) return NaN;
  if (Number.isNaN(b) || line.leg[i] !== line.leg[j]) return a;
  const t = (uu - line.cum[i]) / (line.cum[i + 1] - line.cum[i] || 1);
  return a + (b - a) * t;
}

/** Cycle u on leg 1 or 3 where the physical position is s (clamped to the leg's ends). */
export function uAtS(line: Pick<FLine, 'cum' | 'sOf' | 'leg'>, leg: 1 | 3, s: number): number {
  const { sOf, cum } = line;
  for (let i = 0; i + 1 < sOf.length; i++) {
    if (line.leg[i] !== leg || line.leg[i + 1] !== leg) continue;
    const a = sOf[i], b = sOf[i + 1];
    if ((s - a) * (s - b) <= 0 && a !== b) return cum[i] + ((s - a) / (b - a)) * (cum[i + 1] - cum[i]);
  }
  let best = 0, bd = Infinity;
  for (let i = 0; i < sOf.length; i++) if (line.leg[i] === leg && Math.abs(sOf[i] - s) < bd) { bd = Math.abs(sOf[i] - s); best = cum[i]; }
  return best;
}

/** The centre line C at s: position (published height) and heading of rising s. */
export function centreAt(line: Pick<FLine, 'cxyz' | 'cs' | 'clen'>, s: number): { x: number; y: number; z: number; heading: number } {
  const { cxyz, cs } = line;
  const ss = Math.max(0, Math.min(line.clen, s));
  const lo = Math.min(segAt(cs, ss), cs.length - 2), hi = lo + 1;
  const t = (ss - cs[lo]) / (cs[hi] - cs[lo] || 1);
  return {
    x: cxyz[lo * 3] + (cxyz[hi * 3] - cxyz[lo * 3]) * t,
    y: cxyz[lo * 3 + 1] + (cxyz[hi * 3 + 1] - cxyz[lo * 3 + 1]) * t,
    z: cxyz[lo * 3 + 2] + (cxyz[hi * 3 + 2] - cxyz[lo * 3 + 2]) * t,
    heading: Math.atan2(cxyz[hi * 3] - cxyz[lo * 3], cxyz[hi * 3 + 2] - cxyz[lo * 3 + 2]),
  };
}
