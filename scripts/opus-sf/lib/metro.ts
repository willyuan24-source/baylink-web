// Wave 4 · lane T (W4-T1): the Muni Metro N Judah and M Ocean View for transit.json, from their OSM route relations
// (3435877 / 3433314, outbound; the inbound relations only duplicate the stops), same inputs as lib/transit.ts.
//
// - Path: the relation's track ways chained in relation order (the transit.ts rule). The N is cut at Embarcadero
//   (its King St part and the Embarcadero portal sit in the frozen hero slab, plan R6) and re-based to arc 0.
// - Tunnels: arc spans of ways tagged tunnel=* / layer<0 / location=underground, merged across < 6 u gaps; each gets its
//   two portals (null where the span starts at the line start: Embarcadero is underground), the scouted portal names
//   (Duboce, Sunset Tunnel east / west, West Portal) and the stations inside.
// - Heights: surface = the terrain smoothed ±3 u along the track (transit.ts). Underground is NOT sampled from the
//   terrain (it would run the cars over the hills): 4 u under the street, never above a 0.12 ramp down from each portal
//   mouth (the mouth itself = the surface height there), floored at −20 u, smoothed.
// - Stops: route-relation stop members mapped onto the stable station ids of data/sf/stationNames.ts (an unknown OSM
//   name fails the build), platform pairs of one station merged (termini keep the path end), `major` + `attractions`
//   from the same file. Underground stations are boarded at their street kiosk: their x, z is the kiosk (Market St
//   sidewalk, north-west side), `at` stays the platform's arc position. A surface stop within a train half-length of a
//   portal moves out of the mouth so a dwelling train stands in daylight.
import type { TransitLine, TransitPortal, TransitStop, TransitTunnel } from '../../../src/opus-bay/world/sf/format';
import { METRO_STATIONS, PORTAL_NAMES, type PortalId, STOP_ATTRACTIONS, TUNNELS, W4_LINES, metroStationForOsm } from '../../../src/opus-bay/data/sf/stationNames';
import { elements, type OsmElement } from './io';
import { type P2, cumulative, densify, pointAtArc, projectOnto, round, simplifyIdx, smoothAlong, surfaceHeights } from './lineGeom';
import type { Terrain } from './terrain';
import { inSlab, projPt } from './world';

interface MetroSpec { id: 'n-judah' | 'm-ocean-view'; rel: number; startAt: string; tunnels: string[] }
export const METRO_SPECS: readonly MetroSpec[] = [
  { id: 'n-judah', rel: 3435877, startAt: 'Embarcadero', tunnels: ['market-street-subway', 'sunset-tunnel'] },
  { id: 'm-ocean-view', rel: 3433314, startAt: 'Embarcadero', tunnels: ['market-street-subway+twin-peaks-tunnel'] },
];

/** The scouted mouths (geo/lines-muni.json spans, 2026-09-27); a span end within 25 u takes the name. */
export const PORTAL_SPOTS: readonly { id: PortalId; x: number; z: number }[] = [
  { id: 'duboce', x: 132.21, z: 592.74 },
  { id: 'sunset-east', x: 73.0, z: 661.05 },
  { id: 'sunset-west', x: -17.07, z: 817.15 },
  { id: 'west-portal', x: 118.79, z: 1235.04 },
];

/** Half a two-car LRV plus a margin (u): a surface stop keeps a dwelling train out of the portal mouth. */
export const TRAIN_CLEAR = 7.4;
/** Kiosk: this far from the track centreline, on the right of the outbound direction (Market St's north-west sidewalk). */
export const KIOSK_OFFSET = 5.2;
/** Hand-placed kiosks (plan §3.3): Castro at Harvey Milk Plaza. */
const KIOSK_AT: Record<string, { x: number; z: number }> = {
  'muni-castro': { x: 141.9, z: 748.2 },
};
const UG_DEPTH = 4;
const UG_RAMP = 0.12;
const UG_FLOOR = -20;
const UG_CEIL = 55;

export interface MetroBuild { lines: TransitLine[]; report: string[] }

export function buildMetroLines(t: Terrain, log: (s: string) => void): MetroBuild {
  const rels = new Map<number, OsmElement>();
  const ways = new Map<number, OsmElement>();
  const nodes = new Map<number, OsmElement>();
  const want = new Set(METRO_SPECS.map(s => s.rel));
  for (const e of elements('railways')) {
    if (e.type === 'relation' && want.has(e.id)) rels.set(e.id, e);
    else if (e.type === 'way') ways.set(e.id, e);
    else if (e.type === 'node' && e.tags?.name) nodes.set(e.id, e);
  }
  const report: string[] = [];
  const lines = METRO_SPECS.map(spec => {
    const rel = rels.get(spec.rel);
    if (!rel?.members) throw new Error(`metro: relation ${spec.rel} missing`);
    const line = buildOne(t, spec, rel, ways, nodes, report);
    log(`metro: ${line.id} ${line.length} u, ${line.stops.length} stations, tunnels ${JSON.stringify(line.tunnels!.map(u => [u.fromAt, u.toAt]))}`);
    return line;
  });
  return { lines, report };
}

function buildOne(t: Terrain, spec: MetroSpec, rel: OsmElement, ways: Map<number, OsmElement>, nodes: Map<number, OsmElement>, report: string[]): TransitLine {
  // --- chain the track ways in relation order, remembering which way brought each vertex
  const segs = rel.members!.filter(m => m.type === 'way' && m.role === '' && m.geometry && m.geometry.length >= 2)
    .map(m => ({ ref: m.ref, pts: m.geometry!.map(g => projPt(g.lat, g.lon)) as P2[] }));
  let path: P2[] = [];
  let wayOf: number[] = [];
  let maxGap = 0;
  segs.forEach((s, k) => {
    let pts = s.pts;
    if (k === 0) {
      const next = segs[1];
      if (next) {
        const d = (p: P2) => Math.min(Math.hypot(p[0] - next.pts[0][0], p[1] - next.pts[0][1]), Math.hypot(p[0] - next.pts[next.pts.length - 1][0], p[1] - next.pts[next.pts.length - 1][1]));
        if (d(pts[pts.length - 1]) > d(pts[0])) pts = pts.slice().reverse();
      }
      path = pts.slice(); wayOf = pts.map(() => s.ref);
      return;
    }
    const end = path[path.length - 1];
    const dS = Math.hypot(pts[0][0] - end[0], pts[0][1] - end[1]), dE = Math.hypot(pts[pts.length - 1][0] - end[0], pts[pts.length - 1][1] - end[1]);
    if (dE < dS) pts = pts.slice().reverse();
    const gap = Math.min(dS, dE);
    maxGap = Math.max(maxGap, gap);
    const add = gap < 0.05 ? pts.slice(1) : pts;
    path.push(...add); wayOf.push(...add.map(() => s.ref));
  });
  if (maxGap > 1) throw new Error(`metro ${spec.id}: joint gap ${maxGap.toFixed(2)} u`);
  let cum = cumulative(path);

  // --- stops (all OSM stop members), before the cut so the start station is found
  interface RawStop { name: string; osmId: number; x: number; z: number; at: number }
  const raw: RawStop[] = [];
  for (const m of rel.members!) {
    if (m.type !== 'node' || !m.role.startsWith('stop')) continue;
    const nd = nodes.get(m.ref);
    const lat = nd?.lat ?? m.lat, lon = nd?.lon ?? m.lon;
    if (lat === undefined || lon === undefined) continue;
    const [x, z] = projPt(lat, lon);
    const name = nd?.tags?.name ?? '';
    const p = projectOnto(path, cum, x, z);
    if (p.d > 12) continue;
    raw.push({ name, osmId: m.ref, x, z, at: p.at });
  }
  raw.sort((a, b) => a.at - b.at);
  const start = raw.find(r => r.name === spec.startAt);
  if (!start) throw new Error(`metro ${spec.id}: no start stop ${spec.startAt}`);

  // --- cut at the start station (the N's King St part) and re-base
  if (start.at > 0.01) {
    const cut = pointAtArc(path, cum, start.at);
    path = [cut.p, ...path.slice(cut.seg)];
    wayOf = [wayOf[cut.seg], ...wayOf.slice(cut.seg)];
    const shift = start.at;
    for (const r of raw) r.at -= shift;
    cum = cumulative(path);
  }
  const stopsRaw = raw.filter(r => r.at >= -0.5);
  const length = cum[cum.length - 1];

  // --- tunnel spans from the way tags (a vertex takes the tags of the way that brought it = the segment ending there)
  const under = (i: number) => {
    const tg = ways.get(wayOf[i])?.tags ?? {};
    return (!!tg.tunnel && tg.tunnel !== 'no') || (Number.parseInt(tg.layer ?? '0', 10) || 0) < 0 || tg.location === 'underground';
  };
  const spans: [number, number][] = [];
  for (let i = 1; i < path.length; i++) {
    if (!under(i)) continue;
    const a = cum[i - 1], b = cum[i];
    const last = spans[spans.length - 1];
    if (last && a - last[1] < 6) last[1] = b; else spans.push([a, b]);
  }
  // the line starts underground (the cut point takes its segment's tag)
  if (spans.length && spans[0][0] < 1) spans[0][0] = 0;
  const tunnelSpans = spans.filter(([a, b]) => b - a > 20);

  // --- heights on a densified copy (≤ 4 u steps: the underground ramps need vertices; arc positions are unchanged)
  path = densify(path, 4);
  cum = cumulative(path);
  const surf = surfaceHeights(t, path, cum);
  const inTunnel = (s: number) => tunnelSpans.some(([a, b]) => s > a + 0.01 && s < b - 0.01);
  const surfAt = (s: number) => surf[nearestIdx(cum, s)];
  const yRaw = path.map((_, i) => {
    const s = cum[i];
    if (!inTunnel(s)) return surf[i];
    let v = surf[i] - UG_DEPTH;
    for (const [a, b] of tunnelSpans) {
      if (s < a || s > b) continue;
      // below the street and never above the chord between the two ends (no riding over the hills) …
      const ya = a > 0.5 ? surfAt(a) : surfAt(a) - UG_DEPTH, yb = b < length - 0.5 ? surfAt(b) : surfAt(b) - UG_DEPTH;
      v = Math.min(v, ya + ((yb - ya) * (s - a)) / Math.max(1, b - a));
      // … and diving under each mouth: 0.12 down for the first 30 u, then climbing back at most 0.04
      const dip = (y0: number, d: number) => y0 - UG_RAMP * Math.min(d, 30) + 0.04 * Math.max(0, d - 30);
      if (a > 0.5) v = Math.min(v, dip(surfAt(a), s - a));
      if (b < length - 0.5) v = Math.min(v, dip(surfAt(b), b - s));
    }
    return Math.min(UG_CEIL, Math.max(UG_FLOOR, v));
  });
  // smooth the deep part only (the ramps at the mouths stay exact)
  const ySm = smoothAlong(yRaw, cum, 16);
  const nearMouth = (s: number) => tunnelSpans.some(([a, b]) => (a > 0.5 && Math.abs(s - a) < 18) || (b < length - 0.5 && Math.abs(s - b) < 18));
  const y = yRaw.map((v, i) => (inTunnel(cum[i]) && !nearMouth(cum[i]) ? Math.min(v, ySm[i]) : v));

  // --- stations: map, merge platform pairs, kiosks, portal clearance
  const byId = new Map<string, RawStop[]>();
  for (const r of stopsRaw) {
    const def = metroStationForOsm(r.name);
    if (!def) throw new Error(`metro ${spec.id}: OSM stop "${r.name}" (${r.osmId}) has no station in stationNames.ts`);
    (byId.get(def.id) ?? byId.set(def.id, []).get(def.id)!).push(r);
  }
  const firstId = metroStationForOsm(stopsRaw[0].name)!.id, lastId = metroStationForOsm(stopsRaw[stopsRaw.length - 1].name)!.id;
  const stops: TransitStop[] = [];
  for (const def of METRO_STATIONS) {
    const rs = byId.get(def.id);
    if (!rs) continue;
    let pick: { at: number; x: number; z: number; osmId: number };
    if (def.id === firstId) pick = rs.reduce((a, b) => (b.at < a.at ? b : a));
    else if (def.id === lastId) pick = rs.reduce((a, b) => (b.at > a.at ? b : a));
    else {
      const span = Math.max(...rs.map(r => r.at)) - Math.min(...rs.map(r => r.at));
      if (span > 20) throw new Error(`metro ${spec.id}: station ${def.id} platforms ${span.toFixed(1)} u apart`);
      pick = { at: avg(rs.map(r => r.at)), x: avg(rs.map(r => r.x)), z: avg(rs.map(r => r.z)), osmId: rs[0].osmId };
    }
    let at = Math.max(0, Math.min(length, pick.at));
    let x = pick.x, z = pick.z;
    if (def.underground) {
      const k = KIOSK_AT[def.id];
      if (k) { x = k.x; z = k.z; } else {
        const a = pointAtArc(path, cum, Math.max(0, at - 2)).p, b = pointAtArc(path, cum, Math.min(length, at + 2)).p;
        const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
        // right of the outbound direction (three.js frame: right = (−cos h, sin h) = (−dz, dx) / L)
        const c = pointAtArc(path, cum, at).p;
        x = c[0] - (dz / L) * KIOSK_OFFSET; z = c[1] + (dx / L) * KIOSK_OFFSET;
      }
    } else {
      for (const [a, b] of tunnelSpans) {
        if (at > b && at < b + TRAIN_CLEAR) at = b + TRAIN_CLEAR;
        if (at < a && at > a - TRAIN_CLEAR && a > 0.5) at = a - TRAIN_CLEAR;
      }
      at = Math.min(length, at);
      if (Math.abs(at - pick.at) > 0.01) { const c = pointAtArc(path, cum, at).p; report.push(`${spec.id} ${def.id}: moved ${round(at - pick.at)} u out of the portal`); x = c[0]; z = c[1]; }
    }
    stops.push({ id: def.id, name: { ...def.name }, at: round(at), x: round(x), z: round(z), osmId: pick.osmId, ...(def.major ? { major: true } : {}), ...(STOP_ATTRACTIONS[def.id]?.length ? { attractions: [...STOP_ATTRACTIONS[def.id]] } : {}) });
  }
  stops.sort((a, b) => a.at - b.at);
  // the termini sit exactly on the path ends (double-ended reversal)
  stops[0].at = 0;
  stops[stops.length - 1].at = round(length);

  // --- simplify the polyline (keep the tunnel ends and the stop anchors), then re-measure
  const keep = new Set<number>();
  for (const [a, b] of tunnelSpans) for (const s of [a, b]) keep.add(nearestIdx(cum, s));
  for (const s of stops) keep.add(nearestIdx(cum, s.at));
  const idx = simplifyIdx(path, 0.08, keep, y, 0.05);
  const pts = idx.map(i => path[i]);
  const ys = idx.map(i => y[i]);
  const cum2 = cumulative(pts);
  const scale = (s: number) => {
    // arc positions move slightly when collinear vertices go: map through the kept vertex nearest below
    let lo = 0;
    while (lo < idx.length - 1 && cum[idx[lo + 1]] <= s) lo++;
    const hi = Math.min(idx.length - 1, lo + 1);
    const a0 = cum[idx[lo]], a1 = cum[idx[hi]], b0 = cum2[lo], b1 = cum2[hi];
    return a1 > a0 ? b0 + ((s - a0) / (a1 - a0)) * (b1 - b0) : b0;
  };
  const length2 = cum2[cum2.length - 1];
  for (const s of stops) s.at = round(Math.min(length2, scale(s.at)));
  stops[stops.length - 1].at = round(length2);
  const tunnels: TransitTunnel[] = tunnelSpans.map(([a0, b0], k) => {
    const a = round(scale(a0)), b = round(scale(b0));
    const mouth = (s: number): TransitPortal | null => {
      if (s < 0.5 || s > length2 - 0.5) return null;
      const i = nearestIdx(cum2, s);
      const [x, z] = pts[i];
      const spot = PORTAL_SPOTS.slice().sort((p, q) => Math.hypot(p.x - x, p.z - z) - Math.hypot(q.x - x, q.z - z))[0];
      const named = spot && Math.hypot(spot.x - x, spot.z - z) < 25 ? PORTAL_NAMES[spot.id] : undefined;
      if (!named) report.push(`${spec.id}: unnamed portal at (${round(x)}, ${round(z)})`);
      return { x: round(x), y: round(ys[i], 1000), z: round(z), ...(named ? { name: { ...named } } : {}) };
    };
    const key = spec.tunnels[k] ?? '';
    const name = key.includes('+')
      ? { zh: key.split('+').map(p => TUNNELS[p].name.zh).join(' · '), en: key.split('+').map(p => TUNNELS[p].name.en).join(' · ') }
      : TUNNELS[key]?.name;
    return {
      fromAt: a === 0 ? 0 : a, toAt: b, portalA: mouth(a), portalB: mouth(b),
      stations: stops.filter(s => s.at >= a - 1 && s.at <= b + 1).map(s => s.id),
      ...(name ? { name: { ...name } } : {}),
    };
  });
  const flat: number[] = [];
  pts.forEach(([x, z], i) => flat.push(round(x), round(ys[i], 1000), round(z)));
  const heroSpans: [number, number][] = [];
  let hs = -1;
  pts.forEach(([x, z], i) => {
    const ins = inSlab(x, z);
    if (ins && hs < 0) hs = cum2[i];
    if ((!ins || i === pts.length - 1) && hs >= 0) { heroSpans.push([round(hs), round(cum2[i])]); hs = -1; }
  });
  const meta = W4_LINES[spec.id];
  report.push(`${spec.id}: ${round(length2)} u (${path.length} → ${pts.length} vertices), ${stops.length} stations, max joint gap ${round(maxGap)} u, hero ${JSON.stringify(heroSpans)}`);
  return {
    id: spec.id, kind: 'light-rail', name: { ...meta.name }, short: meta.short, tunnels,
    osmRelation: spec.rel, sourceUrl: meta.sourceUrl, color: meta.color,
    path: flat, length: round(length2), stops, turntables: [], doubleEnded: true, heroSpans,
  };
}

const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
function nearestIdx(cum: number[], s: number): number {
  let best = 0;
  for (let i = 1; i < cum.length; i++) if (Math.abs(cum[i] - s) < Math.abs(cum[best] - s)) best = i;
  return best;
}
