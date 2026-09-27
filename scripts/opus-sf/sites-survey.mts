// Site survey (lane L, wave 4): the published city around a point, as numbers and as a top-down map, for authoring a
// landmark site against the real streets. Reads public/opus-bay/sf/<current> through tests/opus-bay-sf-disk.ts.
//
//   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/sites-survey.mts --out C:/Users/willy/opus-qa/w4/w4-l/survey \
//       [--site <w4 site id> | --x <x> --z <z> [--name <label>]] [--r 60] [--px 8] [--json 1]
//
// Writes <out>/<name>.png (roads by class with names, buildings by height with OSM ids, parks / water / plazas, props,
// walk-graph nodes, places.json rows, the ground height field as shading + 1 u contours, the existing landmark
// exclusions in red and, for a wave-4 site, its model seen from above (every lod-0 triangle, vertex colours), its
// exclusion, blockers, ground polygons, arrival and flag) and <out>/<name>.json (everything listed, world units).
// World frame: +x right, +z down on the image; the arrow marks map north.
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import * as THREE from 'three';
import { groundRaster, rasterHeight } from '../../src/opus-bay/core/sfTerrain';
import { AREA_CLASSES, AREA_FLAG, BUILDING_FLAG, NO_NAME, PROP_KINDS, ROAD_CLASSES, STYLES, type ChunkData } from '../../src/opus-bay/world/sf/format';
import { SF_LANDMARKS, buildLandmark, landmarkToWorld, type SfLandmark } from '../../src/opus-bay/world/sf/landmarks/index';
import { sfDisk } from '../../tests/opus-bay-sf-disk';

const args = Object.fromEntries(process.argv.slice(2).reduce<[string, string][]>((acc, cur, i, arr) => {
  if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1']);
  return acc;
}, []));
const out = args.out ?? 'C:/Users/willy/opus-qa/w4/w4-l/survey';
fs.mkdirSync(out, { recursive: true });

type Site = SfLandmark & { placeId?: string; w4?: { arrival: { x: number; z: number }; flag?: { x: number; z: number; h: number } } };
let sites: Site[] = [];
try {
  const m = await import('../../src/opus-bay/world/sf/landmarks/w4sites');
  sites = m.W4_SITES as Site[];
} catch { /* no wave-4 sites yet */ }
const site = args.site ? sites.find(s => s.id === args.site) : undefined;
if (args.site && !site) throw new Error(`unknown site ${args.site}; known: ${sites.map(s => s.id).join(', ')}`);
const X = site ? site.x : Number(args.x), Z = site ? site.z : Number(args.z), R = Number(args.r ?? 60), PX = Number(args.px ?? 8);
if (!Number.isFinite(X) || !Number.isFinite(Z)) throw new Error('need --site or --x/--z');
const name = args.name ?? args.site ?? `xz_${X.toFixed(0)}_${Z.toFixed(0)}`;

const sf = sfDisk();
const far = await sf.far();
const x0 = X - R, z0 = Z - R, x1 = X + R, z1 = Z + R;
const chunks: ChunkData[] = [];
for (let cz = Math.floor(z0 / 128); cz <= Math.floor(z1 / 128); cz++) for (let cx = Math.floor(x0 / 128); cx <= Math.floor(x1 / 128); cx++) {
  const c = await sf.chunk(cx, cz);
  if (c) chunks.push(c);
}
const rasters = chunks.map(c => groundRaster(c));
const groundAt = (x: number, z: number) => {
  const r = rasters.find(q => Math.floor(x / 128) === q.cx && Math.floor(z / 128) === q.cz);
  return r ? rasterHeight(r, x, z) : NaN;
};
const inBox = (x: number, z: number, m = 0) => x >= x0 - m && x <= x1 + m && z >= z0 - m && z <= z1 + m;

// ---- collect
const roads: { cls: string; w: number; name: string; flags: number; pts: number[][] }[] = [];
const seenRoad = new Set<string>();
const buildings: { osm: number; style: string; h: number; baseY: number; flags: number; poly: number[][]; c: number[] }[] = [];
const seenB = new Set<string>();
const areas: { cls: string; hole: boolean; deck: boolean; poly: number[][] }[] = [];
const props: { kind: string; x: number; z: number }[] = [];
for (const c of chunks) {
  const rd = c.roads;
  for (let i = 0; i < rd.count; i++) {
    const pts: number[][] = [];
    for (let k = rd.pStart[i]; k < rd.pStart[i + 1]; k++) pts.push([+rd.xyz[k * 3].toFixed(2), +rd.xyz[k * 3 + 1].toFixed(2), +rd.xyz[k * 3 + 2].toFixed(2)]);
    if (!pts.some(p => inBox(p[0], p[2], 10))) continue;
    const key = pts.map(p => p.join(',')).join(';');
    if (seenRoad.has(key)) continue;
    seenRoad.add(key);
    roads.push({ cls: ROAD_CLASSES[rd.cls[i]], w: +rd.width[i].toFixed(2), name: rd.nameIdx[i] === NO_NAME ? '' : far.names[rd.nameIdx[i]], flags: rd.flags[i], pts });
  }
  const b = c.buildings;
  for (let i = 0; i < b.count; i++) {
    const poly: number[][] = [];
    for (let k = b.vStart[i]; k < b.vStart[i + 1]; k++) poly.push([+b.xz[k * 2].toFixed(2), +b.xz[k * 2 + 1].toFixed(2)]);
    const cxz = poly.reduce((s, p) => [s[0] + p[0] / poly.length, s[1] + p[1] / poly.length], [0, 0]);
    if (!poly.some(p => inBox(p[0], p[1], 2))) continue;
    const key = `${b.osmId[i]}:${cxz[0].toFixed(1)}:${cxz[1].toFixed(1)}`;
    if (seenB.has(key)) continue;
    seenB.add(key);
    buildings.push({ osm: b.osmId[i], style: STYLES[b.style[i]], h: +b.height[i].toFixed(2), baseY: +b.baseY[i].toFixed(2), flags: b.flags[i], poly, c: [+cxz[0].toFixed(2), +cxz[1].toFixed(2)] });
  }
  const a = c.areas;
  for (let i = 0; i < a.count; i++) {
    const poly: number[][] = [];
    for (let k = a.pStart[i]; k < a.pStart[i + 1]; k++) poly.push([+a.xz[k * 2].toFixed(2), +a.xz[k * 2 + 1].toFixed(2)]);
    const cls = AREA_CLASSES[a.cls[i]];
    if (cls === 'land' || !poly.some(p => inBox(p[0], p[1], 40))) continue;
    areas.push({ cls, hole: (a.flags[i] & AREA_FLAG.hole) !== 0, deck: (a.flags[i] & AREA_FLAG.deck) !== 0, poly });
  }
  const p = c.props;
  for (let i = 0; i < p.count; i++) { const x = p.xz[i * 2], z = p.xz[i * 2 + 1]; if (inBox(x, z)) props.push({ kind: PROP_KINDS[p.kind[i]], x: +x.toFixed(2), z: +z.toFixed(2) }); }
}
const places = (JSON.parse(fs.readFileSync(path.join(sf.base, 'places.json'), 'utf8')) as { places: { id: string; name: { zh: string; en: string }; kind: string; x: number; z: number }[] }).places
  .filter(p => inBox(p.x, p.z)).map(p => ({ id: p.id, zh: p.name.zh, en: p.name.en, kind: p.kind, x: p.x, z: p.z }));
const ix = await sf.graphIndex();
const nodes: number[][] = [];
ix.forNodesNear(X, Z, R * 1.5, i => { if (inBox(ix.x(i), ix.z(i))) nodes.push([+ix.x(i).toFixed(1), +ix.z(i).toFixed(1)]); });
const main = ix.mainComponent();
const mainNear = ix.nearestNode(X, Z, R, i => ix.component(i) === main);
const lms = SF_LANDMARKS.filter(l => Math.hypot(l.x - X, l.z - Z) < R + 60);
const nearSites = sites.filter(s => Math.hypot(s.x - X, s.z - Z) < R + 80);

// ground field
const G = 2, gh: number[][] = [];
let gmin = Infinity, gmax = -Infinity;
for (let z = z0; z <= z1; z += G) {
  const row: number[] = [];
  for (let x = x0; x <= x1; x += G) { const h = groundAt(x, z); row.push(h); if (Number.isFinite(h)) { gmin = Math.min(gmin, h); gmax = Math.max(gmax, h); } }
  gh.push(row);
}

// ---- draw
const S = (x: number) => ((x - x0) * PX).toFixed(1), T = (z: number) => ((z - z0) * PX).toFixed(1);
const W = Math.round(2 * R * PX), svg: string[] = [];
svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}" font-family="Arial" font-size="11">`);
svg.push(`<rect width="${W}" height="${W}" fill="#efe9dc"/>`);
// ground shading + contours (1 u)
for (let j = 0; j < gh.length; j++) for (let i = 0; i < gh[j].length; i++) {
  const h = gh[j][i];
  if (!Number.isFinite(h)) continue;
  const t = gmax > gmin ? (h - gmin) / (gmax - gmin) : 0.5;
  const c = Math.round(235 - t * 70);
  svg.push(`<rect x="${S(x0 + i * G - G / 2)}" y="${T(z0 + j * G - G / 2)}" width="${G * PX}" height="${G * PX}" fill="rgb(${c},${c - 4},${c - 16})"/>`);
}
const areaFill: Record<string, string> = { water: '#8fb8cf', park: '#b9d49a', grass: '#c6dca6', forest: '#94b87c', sand: '#eadbb0', pier: '#b9a58a', plaza: '#d9d2c4', parking: '#c9c5bd', golf: '#aacf8c', pitch: '#9fcf8a', scrub: '#b4c89a', rock: '#b0a898' };
for (const a of areas) svg.push(`<polygon points="${a.poly.map(p => `${S(p[0])},${T(p[1])}`).join(' ')}" fill="${a.hole ? '#efe9dc' : areaFill[a.cls] ?? '#ddd'}" fill-opacity="0.75" stroke="#7a8a6a" stroke-width="0.5"/>`);
// contours
for (let j = 0; j + 1 < gh.length; j++) for (let i = 0; i + 1 < gh[j].length; i++) {
  const a = gh[j][i], b = gh[j][i + 1], c = gh[j + 1][i];
  for (const [h2, dx, dz] of [[b, 1, 0], [c, 0, 1]] as [number, number, number][]) {
    if (!Number.isFinite(a) || !Number.isFinite(h2)) continue;
    if (Math.floor(a) !== Math.floor(h2)) {
      const xm = x0 + (i + dx / 2) * G, zm = z0 + (j + dz / 2) * G;
      svg.push(`<rect x="${(+S(xm) - 1).toFixed(1)}" y="${(+T(zm) - 1).toFixed(1)}" width="2" height="2" fill="#8a7a5a"/>`);
    }
  }
}
const roadCol: Record<string, string> = { motorway: '#c98a6a', trunk: '#c98a6a', primary: '#8d8983', secondary: '#8d8983', tertiary: '#9a958e', residential: '#a8a39b', service: '#b8b3aa', pedestrian: '#d4c9b4', footway: '#c9b48e', path: '#b89a6a', cycleway: '#7fa0b8', steps: '#a0522d', track: '#a88a5a', tram: '#5a3a8a', rail: '#555' };
for (const r of roads) {
  const d = r.pts.map((p, k) => `${k ? 'L' : 'M'}${S(p[0])},${T(p[2])}`).join(' ');
  const w = ['tram', 'rail'].includes(r.cls) ? 2 : Math.max(1.5, r.w * PX);
  svg.push(`<path d="${d}" stroke="${roadCol[r.cls] ?? '#999'}" stroke-width="${w.toFixed(1)}" fill="none" stroke-linecap="round" stroke-opacity="${r.w > 3 ? 0.8 : 1}"/>`);
}
for (const b of buildings) {
  const t = Math.min(1, b.h / 20);
  svg.push(`<polygon points="${b.poly.map(p => `${S(p[0])},${T(p[1])}`).join(' ')}" fill="rgb(${Math.round(200 - t * 90)},${Math.round(160 - t * 80)},${Math.round(140 - t * 60)})" fill-opacity="0.85" stroke="#4a3a2a" stroke-width="0.8"/>`);
}
for (const p of props) svg.push(`<circle cx="${S(p.x)}" cy="${T(p.z)}" r="${p.kind === 'tree' || p.kind === 'pine' || p.kind === 'palm' ? 3 : 2}" fill="${p.kind === 'lamp' ? '#e0b030' : p.kind === 'bench' ? '#7a4a2a' : p.kind === 'stop' ? '#d03030' : '#4a8a3a'}"/>`);
for (const n of nodes) svg.push(`<circle cx="${S(n[0])}" cy="${T(n[1])}" r="1.6" fill="#2060c0" fill-opacity="0.8"/>`);
// existing landmarks
for (const l of lms) {
  const poly = 'poly' in l.exclude ? l.exclude.poly : Array.from({ length: 24 }, (_, k) => ({ x: l.x + Math.cos((k / 24) * Math.PI * 2) * (l.exclude as { r: number }).r, z: l.z + Math.sin((k / 24) * Math.PI * 2) * (l.exclude as { r: number }).r }));
  svg.push(`<polygon points="${poly.map(p => `${S(p.x)},${T(p.z)}`).join(' ')}" fill="#d04040" fill-opacity="0.15" stroke="#c02020" stroke-width="2"/>`);
  svg.push(`<text x="${S(l.x)}" y="${T(l.z)}" fill="#a01010" font-size="13" font-weight="bold">${l.id}</text>`);
}
// wave-4 sites: the model from above, exclusion, blockers, ground, arrival, flag
for (const s of nearSites) {
  for (const g of s.ground ?? []) svg.push(`<polygon points="${g.poly.map(p => landmarkToWorld(s, p)).map(p => `${S(p.x)},${T(p.z)}`).join(' ')}" fill="${g.color}" fill-opacity="0.9" stroke="#555" stroke-width="0.4"/>`);
  const geo = buildLandmark(s, 0, 0).toNonIndexed();
  const pos = geo.getAttribute('position'), col = geo.getAttribute('color');
  const m = new THREE.Matrix4().makeRotationY(s.yaw), v = new THREE.Vector3();
  const tris: { y: number; d: string }[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    const pts: string[] = [];
    let ymax = -Infinity;
    for (let k = 0; k < 3; k++) { v.fromBufferAttribute(pos, i + k).applyMatrix4(m); ymax = Math.max(ymax, v.y); pts.push(`${S(s.x + v.x)},${T(s.z + v.z)}`); }
    const c = new THREE.Color(col.getX(i), col.getY(i), col.getZ(i));
    tris.push({ y: ymax, d: `<polygon points="${pts.join(' ')}" fill="#${c.getHexString(THREE.SRGBColorSpace)}"/>` });
  }
  tris.sort((a, b) => a.y - b.y);
  for (const t of tris) svg.push(t.d);
  const ex = 'poly' in s.exclude ? s.exclude.poly : Array.from({ length: 24 }, (_, k) => ({ x: s.x + Math.cos((k / 24) * Math.PI * 2) * (s.exclude as { r: number }).r, z: s.z + Math.sin((k / 24) * Math.PI * 2) * (s.exclude as { r: number }).r }));
  svg.push(`<polygon points="${ex.map(p => `${S(p.x)},${T(p.z)}`).join(' ')}" fill="none" stroke="#e03060" stroke-width="2" stroke-dasharray="8,4"/>`);
  for (const b of s.walk?.blockers ?? []) {
    if ('poly' in b) svg.push(`<polygon points="${b.poly.map(p => landmarkToWorld(s, p)).map(p => `${S(p.x)},${T(p.z)}`).join(' ')}" fill="none" stroke="#000" stroke-width="1.2" stroke-dasharray="3,2"/>`);
    else { const c = landmarkToWorld(s, b); svg.push(`<circle cx="${S(c.x)}" cy="${T(c.z)}" r="${b.r * PX}" fill="none" stroke="#000" stroke-width="1.2" stroke-dasharray="3,2"/>`); }
  }
  if (s.w4) {
    const a = landmarkToWorld(s, s.w4.arrival);
    svg.push(`<circle cx="${S(a.x)}" cy="${T(a.z)}" r="7" fill="#20c040" stroke="#fff" stroke-width="2"/>`);
    if (s.w4.flag) { const f = landmarkToWorld(s, s.w4.flag); svg.push(`<rect x="${+S(f.x) - 4}" y="${+T(f.z) - 12}" width="10" height="7" fill="#e0a020"/><line x1="${S(f.x)}" y1="${T(f.z)}" x2="${S(f.x)}" y2="${+T(f.z) - 12}" stroke="#806020" stroke-width="2"/>`); }
  }
  svg.push(`<text x="${S(s.x) }" y="${(+T(s.z) - 6).toFixed(1)}" fill="#c01060" font-size="14" font-weight="bold">${s.id}</text>`);
}
// labels: street names (once per road near its middle), building ids (tall ones / landmark-flagged), places
const named = new Set<string>();
for (const r of roads) {
  if (!r.name || !['primary', 'secondary', 'tertiary', 'residential', 'pedestrian', 'service', 'footway'].includes(r.cls)) continue;
  const inside = r.pts.filter(p => inBox(p[0], p[2], -4));
  if (!inside.length) continue;
  const p = inside[Math.floor(inside.length / 2)];
  const k = `${r.name}:${Math.round(p[0] / 30)}:${Math.round(p[2] / 30)}`;
  if (named.has(k)) continue;
  named.add(k);
  svg.push(`<text x="${S(p[0])}" y="${T(p[2])}" fill="#1a3a6a" font-size="12" stroke="#fff" stroke-width="3" paint-order="stroke">${r.name}</text>`);
}
for (const b of buildings) if (b.h > 6 || b.flags & BUILDING_FLAG.landmark) svg.push(`<text x="${S(b.c[0])}" y="${T(b.c[1])}" fill="#3a1a0a" font-size="9">${b.osm} ${b.h}u</text>`);
for (const p of places) svg.push(`<circle cx="${S(p.x)}" cy="${T(p.z)}" r="4" fill="#fff" stroke="#8030a0" stroke-width="2"/><text x="${+S(p.x) + 6}" y="${+T(p.z) + 4}" fill="#6020a0" font-size="11" stroke="#fff" stroke-width="2.5" paint-order="stroke">${p.id}</text>`);
// grid every 10 u + north arrow + scale
for (let g = Math.ceil(x0 / 10) * 10; g <= x1; g += 10) svg.push(`<line x1="${S(g)}" y1="0" x2="${S(g)}" y2="${W}" stroke="#000" stroke-opacity="${g % 50 === 0 ? 0.25 : 0.08}"/><text x="${+S(g) + 2}" y="12" font-size="9" fill="#555">${g}</text>`);
for (let g = Math.ceil(z0 / 10) * 10; g <= z1; g += 10) svg.push(`<line x1="0" y1="${T(g)}" x2="${W}" y2="${T(g)}" stroke="#000" stroke-opacity="${g % 50 === 0 ? 0.25 : 0.08}"/><text x="2" y="${+T(g) - 2}" font-size="9" fill="#555">${g}</text>`);
const nx = -0.719, nz = -0.695;
svg.push(`<line x1="60" y1="${W - 60}" x2="${60 + nx * 40}" y2="${W - 60 + nz * 40}" stroke="#000" stroke-width="3"/><text x="${60 + nx * 52}" y="${W - 60 + nz * 52}" font-size="16" font-weight="bold">N</text>`);
svg.push(`<text x="${W - 330}" y="${W - 10}" font-size="13" fill="#000">${name} · centre (${X}, ${Z}) · ground ${gmin.toFixed(2)}…${gmax.toFixed(2)} u</text>`);
svg.push('</svg>');
const png = new Resvg(svg.join('\n'), { fitTo: { mode: 'original' } }).render().asPng();
fs.writeFileSync(path.join(out, `${name}.png`), png);
const data = {
  name, centre: [X, Z], r: R, ground: { min: gmin, max: gmax }, mainGraphNodeNear: mainNear >= 0 ? [ix.x(mainNear), ix.z(mainNear), Math.hypot(ix.x(mainNear) - X, ix.z(mainNear) - Z)] : null,
  roads, buildings, areas: areas.map(a => ({ ...a, poly: a.poly.length > 40 ? `(${a.poly.length} pts)` : a.poly })), props, places, landmarks: lms.map(l => l.id), sites: nearSites.map(s => s.id),
};
if (args.json !== '0') fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(data, null, 1));
console.log(JSON.stringify({ png: path.join(out, `${name}.png`), roads: roads.length, buildings: buildings.length, areas: areas.length, props: props.length, places: places.length, nodes: nodes.length, ground: [+gmin.toFixed(2), +gmax.toFixed(2)], landmarks: lms.map(l => l.id), sites: nearSites.map(s => s.id) }));
