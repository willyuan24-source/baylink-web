// Step 9a: transit.json — the three cable-car lines and the F-line (Wharf → Castro) from their OSM route relations,
// with terrain-following track heights, stops, turntables and the spans that run inside the hero slab.
import type { TransitFile, TransitLine } from '../../../src/opus-bay/world/sf/format';
import { elements, type OsmElement } from './io';
import { type Terrain, heightAt } from './terrain';
import { inSlab, projPt } from './world';

interface LineSpec { id: string; rel: number; kind: TransitLine['kind']; name: { zh: string; en: string }; color: string; doubleEnded: boolean }
const LINES: LineSpec[] = [
  { id: 'powell-hyde', rel: 1959009, kind: 'cable-car', name: { zh: '鲍威尔-海德线缆车', en: 'Powell–Hyde cable car' }, color: '#d8744a', doubleEnded: false },
  { id: 'powell-mason', rel: 1959010, kind: 'cable-car', name: { zh: '鲍威尔-梅森线缆车', en: 'Powell–Mason cable car' }, color: '#c9a14a', doubleEnded: false },
  { id: 'california', rel: 2852264, kind: 'cable-car', name: { zh: '加州街线缆车', en: 'California St cable car' }, color: '#7a5a8c', doubleEnded: true },
  { id: 'f-line', rel: 2007934, kind: 'streetcar', name: { zh: 'F 线复古电车', en: 'F Market & Wharves streetcar' }, color: '#2f8f88', doubleEnded: false },
];

export function buildTransit(t: Terrain, version: string, log: (s: string) => void): { file: TransitFile; stopPoints: { x: number; z: number; rot: number }[] } {
  const rels = new Map<number, OsmElement>();
  const nodes = new Map<number, OsmElement>();
  const namedNodes: OsmElement[] = [];
  const turntables: { x: number; z: number; id: number; name: string }[] = [];
  for (const e of elements('railways')) {
    if (e.type === 'relation') rels.set(e.id, e);
    else if (e.type === 'node') { nodes.set(e.id, e); if (e.tags?.name) namedNodes.push(e); }
    else if (e.type === 'way' && e.tags?.railway === 'turntable' && e.geometry) {
      let sx = 0, sz = 0;
      for (const g of e.geometry) { const [x, z] = projPt(g.lat, g.lon); sx += x; sz += z; }
      turntables.push({ x: sx / e.geometry.length, z: sz / e.geometry.length, id: e.id, name: e.tags.name ?? 'turntable' });
    }
  }
  const lines: TransitLine[] = [];
  const stopPoints: { x: number; z: number; rot: number }[] = [];
  for (const spec of LINES) {
    const rel = rels.get(spec.rel);
    if (!rel?.members) throw new Error(`transit: relation ${spec.rel} missing`);
    // chain the track ways in relation order
    const ways = rel.members.filter(m => m.type === 'way' && m.role === '' && m.geometry && m.geometry.length >= 2).map(m => m.geometry!.map(g => projPt(g.lat, g.lon)));
    let path: [number, number][] = [];
    let maxGap = 0;
    for (const w of ways) {
      if (!path.length) {
        // orient the first way toward the second
        const next = ways[1];
        if (next) {
          const d = (p: [number, number]) => Math.min(Math.hypot(p[0] - next[0][0], p[1] - next[0][1]), Math.hypot(p[0] - next[next.length - 1][0], p[1] - next[next.length - 1][1]));
          path = d(w[w.length - 1]) <= d(w[0]) ? w.slice() : w.slice().reverse();
        } else path = w.slice();
        continue;
      }
      const end = path[path.length - 1];
      const dStart = Math.hypot(w[0][0] - end[0], w[0][1] - end[1]), dEnd = Math.hypot(w[w.length - 1][0] - end[0], w[w.length - 1][1] - end[1]);
      const seg = dStart <= dEnd ? w : w.slice().reverse();
      maxGap = Math.max(maxGap, Math.min(dStart, dEnd));
      path = path.concat(Math.min(dStart, dEnd) < 0.05 ? seg.slice(1) : seg);
    }
    // arc length, heights (street surface: terrain smoothed along the track over ±3 u)
    const cum = [0];
    for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    const ground = path.map(([x, z]) => heightAt(t, x, z));
    const y = ground.map((_, i) => {
      let s = 0, n = 0;
      for (let k = i; k >= 0 && cum[i] - cum[k] <= 3; k--) { s += ground[k]; n++; }
      for (let k = i + 1; k < path.length && cum[k] - cum[i] <= 3; k++) { s += ground[k]; n++; }
      return s / n;
    });
    const flat: number[] = [];
    path.forEach(([x, z], i) => flat.push(round(x), round(y[i], 1000), round(z)));
    const project = (x: number, z: number) => {
      let best = 0, bd = Infinity;
      for (let i = 1; i < path.length; i++) {
        const [ax, az] = path[i - 1], [bx, bz] = path[i];
        const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
        const tt = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
        const d = Math.hypot(x - ax - dx * tt, z - az - dz * tt);
        if (d < bd) { bd = d; best = cum[i - 1] + tt * Math.sqrt(L2); }
      }
      return { at: best, d: bd };
    };
    const stops: TransitLine['stops'] = [];
    for (const m of rel.members) {
      if (m.type !== 'node' || !m.role.startsWith('stop') || m.lat === undefined) continue;
      const [x, z] = projPt(m.lat, m.lon!);
      const node = nodes.get(m.ref);
      let name = node?.tags?.name ?? '';
      let zh = node?.tags?.['name:zh'] ?? '';
      if (!name) {
        let bd = 3; // nearest named railway node within 3 u (≈ 20 m)
        for (const n of namedNodes) { const [nx, nz] = projPt(n.lat!, n.lon!); const d = Math.hypot(nx - x, nz - z); if (d < bd) { bd = d; name = n.tags!.name; zh = n.tags!['name:zh'] ?? ''; } }
      }
      const p = project(x, z);
      if (p.d > 12) continue;
      if (stops.some(s => Math.abs(s.at - p.at) < 2)) continue;
      stops.push({ id: `${spec.id}-${stops.length + 1}`, name: { zh: zh || name, en: name || `${spec.name.en} stop` }, at: round(p.at), x: round(x), z: round(z), osmId: m.ref });
    }
    stops.sort((a, b) => a.at - b.at);
    stops.forEach((s, i) => { s.id = `${spec.id}-${i + 1}`; });
    for (const s of stops) {
      const i = Math.max(1, cum.findIndex(c => c >= s.at));
      const [ax, az] = path[i - 1], [bx, bz] = path[Math.min(path.length - 1, i)];
      stopPoints.push({ x: s.x, z: s.z, rot: Math.atan2(bx - ax, bz - az) });
    }
    const ends = [path[0], path[path.length - 1]];
    const tts = turntables.filter(tt => ends.some(e => Math.hypot(e[0] - tt.x, e[1] - tt.z) < 15)).map(tt => ({ x: round(tt.x), z: round(tt.z), osmId: tt.id, name: tt.name }));
    const heroSpans: [number, number][] = [];
    let spanStart = -1;
    path.forEach(([x, z], i) => {
      const inside = inSlab(x, z);
      if (inside && spanStart < 0) spanStart = cum[i];
      if ((!inside || i === path.length - 1) && spanStart >= 0) { heroSpans.push([round(spanStart), round(cum[i])]); spanStart = -1; }
    });
    lines.push({
      id: spec.id, kind: spec.kind, name: spec.name, osmRelation: spec.rel, sourceUrl: `https://www.openstreetmap.org/relation/${spec.rel}`, color: spec.color,
      path: flat, length: round(cum[cum.length - 1]), stops, turntables: tts, doubleEnded: spec.doubleEnded, heroSpans,
    });
    log(`transit: ${spec.id} ${cum[cum.length - 1].toFixed(0)} u, ${stops.length} stops, ${tts.length} turntables, max joint gap ${maxGap.toFixed(2)} u, hero spans ${JSON.stringify(heroSpans)}`);
  }
  return { file: { version, source: 'OpenStreetMap route relations (ODbL); track heights from the Opus Bay terrain curve', lines }, stopPoints };
}

const round = (v: number, q = 100) => Math.round(v * q) / q;
