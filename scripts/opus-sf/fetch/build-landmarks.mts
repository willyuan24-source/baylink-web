// Build C:/Users/willy/opus-qa/sf-data/landmarks.json from the seed list + downloaded OSM / DataSF / DEM data.
// Run: cd C:/Users/willy/baylink-opus && npx tsx --tsconfig tsconfig.app.json C:/Users/willy/opus-qa/sf-data/tools/build-landmarks.mts [osmPrefix]
// Uses the real district.ts project() so world x/z match Opus Bay exactly.
import fs from 'node:fs';
import path from 'node:path';
import { project, DISTRICT } from '../../../baylink-opus/src/opus-bay/data/district.ts';
import { pointInPolygon } from '../../../baylink-opus/src/opus-bay/core/terrain.ts';
import { SEED, BACKDROP } from './landmark-seed.mjs';

const ROOT = 'C:/Users/willy/opus-qa/sf-data';
const RAW = path.join(ROOT, 'raw');
const PREFIX = process.argv[2] || 'bbbike-osm';
const RAD = Math.PI / 180;
const distM = (a: number, b: number, c: number, d: number) => Math.hypot((b - d) * 111320 * Math.cos(a * RAD), (a - c) * 110540);

function load(layer: string): any[] {
  const f = path.join(RAW, `${PREFIX}-${layer}.json`);
  if (!fs.existsSync(f)) return [];
  const out: any[] = [];
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) if (line.startsWith('{"type"')) out.push(JSON.parse(line.replace(/,\s*$/, '')));
  return out;
}
function centerOf(el: any): { lat: number; lng: number } | null {
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  if (el.lat !== undefined) return { lat: el.lat, lng: el.lon };
  if (el.bounds) return { lat: (el.bounds.minlat + el.bounds.maxlat) / 2, lng: (el.bounds.minlon + el.bounds.maxlon) / 2 };
  return null;
}
// ---- candidates: every named element in pois / buildings / landcover / highways (bridges + Lombard) / backdrop
type Cand = { type: string; id: number; name: string; names: string; nameList: string[]; lat: number; lng: number; tags: any; layer: string; areaDeg: number };
const cands: Cand[] = [];
for (const layer of ['pois', 'buildings', 'landcover', 'highways', 'backdrop', 'railways']) {
  for (const el of load(layer)) {
    const t = el.tags || {};
    const nameList: string[] = [t.name, t['name:en'], t.alt_name, t.official_name, t.old_name, t['bridge:name']].filter(Boolean);
    if (layer === 'railways' && t.railway === 'turntable' && !nameList.length) nameList.push('turntable');
    const names = nameList.join(' | ');
    if (!names) continue;
    if (layer === 'highways' && !(t.bridge || /lombard/i.test(names))) continue;
    const c = centerOf(el); if (!c) continue;
    const b = el.bounds; const areaDeg = b ? (b.maxlat - b.minlat) * (b.maxlon - b.minlon) : 0;
    cands.push({ type: el.type, id: el.id, name: t.name || names, names, nameList, lat: c.lat, lng: c.lng, tags: t, layer, areaDeg });
  }
}
console.log('named candidates:', cands.length);

// ---- DEM
const dh = JSON.parse(fs.readFileSync(path.join(RAW, 'dem-sf-z14.json'), 'utf8'));
const dem = new Float32Array(fs.readFileSync(path.join(RAW, 'dem-sf-z14.f32')).buffer.slice(0));
function demAt(lat: number, lng: number) {
  const c = (lng - dh.originLng) / dh.dLng - 0.5, r = (dh.originLat - lat) / dh.dLat - 0.5;
  const i = Math.floor(c), j = Math.floor(r); if (i < 0 || j < 0 || i >= dh.width - 1 || j >= dh.height - 1) return null;
  const fx = c - i, fy = r - j, g = (a: number, b: number) => dem[b * dh.width + a];
  return g(i, j) * (1 - fx) * (1 - fy) + g(i + 1, j) * fx * (1 - fy) + g(i, j + 1) * (1 - fx) * fy + g(i + 1, j + 1) * fx * fy;
}
// ---- DataSF LiDAR footprints (grid index on bbox)
type Fp = { id: string; hmax: number; hmed: number; gnd: number; rings: number[][][]; bb: number[] };
const fps: Fp[] = [];
const GRID = 0.002; const idx = new Map<string, number[]>();
for (const line of fs.readFileSync(path.join(RAW, 'datasf-buildings.json'), 'utf8').split('\n')) {
  if (!line.startsWith('{"sf16')) continue;
  const r = JSON.parse(line.replace(/,\s*$/, ''));
  const rings: number[][][] = r.shape.coordinates.flat(1);
  let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
  for (const ring of rings) for (const [lo, la] of ring) { if (lo < a) a = lo; if (lo > b) b = lo; if (la < c) c = la; if (la > d) d = la; }
  const k = fps.push({ id: r.sf16_bldgid, hmax: parseFloat(r.hgt_maxcm) / 100, hmed: parseFloat(r.hgt_median_m), gnd: parseFloat(r.gnd_min_m), rings, bb: [a, b, c, d] }) - 1;
  for (let x = Math.floor(a / GRID); x <= Math.floor(b / GRID); x++) for (let y = Math.floor(c / GRID); y <= Math.floor(d / GRID); y++) {
    const key = x + ',' + y; (idx.get(key) ?? idx.set(key, []).get(key)!).push(k);
  }
}
const pip = (lng: number, lat: number, ring: number[][]) => { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) ins = !ins; } return ins; };
function lidarAt(lat: number, lng: number, radiusM = 0) {
  const key = Math.floor(lng / GRID) + ',' + Math.floor(lat / GRID);
  let best: Fp | null = null;
  for (const k of idx.get(key) ?? []) { const f = fps[k]; if (f.rings.some(r => pip(lng, lat, r))) { if (!best || f.hmax > best.hmax) best = f; } }
  if (!best && radiusM > 0) {
    // tallest footprint whose bbox centre is within radius
    const dl = radiusM / 110540, dg = radiusM / (111320 * Math.cos(lat * RAD));
    for (let x = Math.floor((lng - dg) / GRID); x <= Math.floor((lng + dg) / GRID); x++) for (let y = Math.floor((lat - dl) / GRID); y <= Math.floor((lat + dl) / GRID); y++)
      for (const k of idx.get(x + ',' + y) ?? []) { const f = fps[k]; const cl = (f.bb[2] + f.bb[3]) / 2, cg = (f.bb[0] + f.bb[1]) / 2; if (distM(lat, lng, cl, cg) <= radiusM && (!best || f.hmax > best.hmax)) best = f; }
  }
  return best;
}
console.log('datasf footprints:', fps.length);

const slab = DISTRICT.slab;
const out: any[] = [];
for (const s of SEED as any[]) {
  // match
  let best: Cand | null = null, bestScore = 1e9;
  for (const c of cands) {
    if (!c.nameList.some(n => s.match.test(n))) continue;
    const d = distM(s.lat, s.lng, c.lat, c.lng);
    if (d > s.r) continue;
    let score = d;
    if (c.tags.wikidata) score -= 60;
    if (c.tags.tourism || c.tags.historic) score -= 25;
    if (c.layer === 'buildings' && c.tags.building) score -= 15;
    if (['park', 'hill', 'beach', 'island', 'neighbourhood', 'water', 'garden', 'trail'].includes(s.cat) && (c.tags.leisure || c.tags.place || c.tags.natural || c.tags.boundary)) score -= 80;
    if (s.cat === 'hill' && c.tags.natural === 'peak') score -= 200;
    if (s.cat === 'bridge' && c.tags.highway) score -= 100;
    if (score < bestScore) { bestScore = score; best = c; }
  }
  const keepSeed = ['bridge'].includes(s.cat) || /tower$/.test(s.id) || s.id.startsWith('cable-car');
  const useOsm = best && !keepSeed && !['neighbourhood'].includes(s.cat);
  let lat = useOsm ? best!.lat : s.lat, lng = useOsm ? best!.lng : s.lng;
  // peaks: use the OSM peak node position
  if (best && best.tags.natural === 'peak') { lat = best.lat; lng = best.lng; }
  lat = Math.round(lat * 1e6) / 1e6; lng = Math.round(lng * 1e6) / 1e6;
  const w = project(lat, lng);
  const ground = demAt(lat, lng);
  // LiDAR only for built things, and only the footprint that contains the point (no neighbour grabbing)
  const lid = ['landmark', 'skyscraper', 'museum', 'civic', 'stadium', 'historic', 'tower', 'attraction'].includes(s.cat) ? lidarAt(lat, lng, 0) : null;
  const osmHraw = best?.tags?.height ? parseFloat(best.tags.height) : null;
  const osmH = osmHraw !== null && osmHraw >= 2 && !best?.tags?.natural ? osmHraw : null;
  const osmEle = best?.tags?.ele ? parseFloat(best.tags.ele) : null;
  const heightM = s.heightM ?? osmH ?? (lid ? Math.round(lid.hmax * 10) / 10 : null);
  out.push({
    id: s.id, name: { en: s.en, zh: s.zh }, category: s.cat,
    lat, lng,
    world: { x: w.x, z: w.z },
    inCurrentDistrict: pointInPolygon(w, slab),
    osm: best ? { type: best.type, id: best.id, name: best.name, url: `https://www.openstreetmap.org/${best.type}/${best.id}`, matchDistM: Math.round(distM(s.lat, s.lng, best.lat, best.lng)), wikidata: best.tags.wikidata ?? null, heightTag: osmH, eleTag: osmEle } : null,
    heightM, heightSource: s.heightM ? 'published' : osmH ? 'osm height tag' : lid ? 'DataSF LiDAR 2010 max' : null, heightNote: s.heightNote ?? null,
    groundElevM: ground === null ? null : Math.round(ground * 10) / 10,
    lidar: lid ? { sf16_bldgid: lid.id, maxM: Math.round(lid.hmax * 10) / 10, medianM: lid.hmed, groundM: lid.gnd } : null,
    trueScaleU: { height: heightM === null ? null : Math.round(heightM * 0.14 * 100) / 100, ground: ground === null ? null : Math.round(Math.max(0, ground) * 0.14 * 100) / 100 },
    ...(s.points ? { points: Object.fromEntries(Object.entries(s.points as Record<string, number[]>).map(([k, [la, lo]]) => [k, { lat: la, lng: lo, world: project(la, lo), groundElevM: (() => { const g = demAt(la, lo); return g === null ? null : Math.round(g * 10) / 10; })() }])) } : {}),
    note: s.note,
  });
}
// ---- backdrop (coarse; outside SF land or outside the z14 DEM) — elevation from the z11 Bay DEM
const bh = JSON.parse(fs.readFileSync(path.join(RAW, 'dem-bay-z11.json'), 'utf8'));
const bdem = new Float32Array(fs.readFileSync(path.join(RAW, 'dem-bay-z11.f32')).buffer.slice(0));
const bdemAt = (lat: number, lng: number) => { const c = Math.round((lng - bh.originLng) / bh.dLng - 0.5), r = Math.round((bh.originLat - lat) / bh.dLat - 0.5); let m = -1e9; for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const v = bdem[(r + dj) * bh.width + c + di]; if (v > m) m = v; } return Math.round(m); };
const backdrop = (BACKDROP as any[]).map(b => ({ id: b.id, name: { en: b.en, zh: b.zh }, lat: b.lat, lng: b.lng, world: project(b.lat, b.lng), groundElevM_z11max5x5: bdemAt(b.lat, b.lng), note: b.note }));
const doc = {
  generated: new Date().toISOString(),
  projection: 'baylink-opus/src/opus-bay/data/district.ts project(): K = 0.14 u/m, map rotated 46 deg, origin (37.802338, -122.40001); x = east-ish, z = south-ish; values rounded to 0.01 u',
  fields: {
    lat_lng: 'WGS84; OSM feature centre (bbox centre / node) unless the id is a specific structure point (bridge towers, cable car termini) where the hand seed is kept',
    world: 'Opus Bay world units at true horizontal scale (district.ts project)',
    heightM: 'structure height in metres (published figure where known, else OSM height tag, else DataSF 2010 LiDAR max above ground); for hills/peaks see groundElevM',
    groundElevM: 'bare-earth elevation (m) from AWS Terrain Tiles z14 (USGS 3DEP) at lat/lng',
    trueScaleU: 'height / ground in world units at the horizontal scale 0.14 u/m (before any vertical exaggeration)',
  },
  sources: {
    osm: PREFIX === 'osm' ? 'OpenStreetMap contributors (ODbL 1.0), Overpass API snapshot (osm_base 2026-09-26), raw/osm-*.json' : 'OpenStreetMap contributors (ODbL 1.0), BBBike SanFrancisco extract 2026-09-19/20, raw/bbbike-osm-*.json',
    lidar: 'DataSF Building Footprints ynuv-fyni (2010 LiDAR heights; PDDL)',
    dem: 'AWS Open Data Terrain Tiles (Mapzen terrarium, z14; USGS 3DEP)',
  },
  count: out.length,
  landmarks: out,
  backdrop,
};
fs.writeFileSync(path.join(ROOT, 'landmarks.json'), JSON.stringify(doc, null, 1));
for (const l of out) console.log(`${l.id.padEnd(30)} ${String(l.world.x).padStart(8)} ${String(l.world.z).padStart(8)}  h=${l.heightM ?? '-'} (${l.heightSource ?? '-'}) g=${l.groundElevM} osm=${l.osm ? l.osm.type + '/' + l.osm.id + ' "' + l.osm.name + '" d=' + l.osm.matchDistM : 'NONE'} lidar=${l.lidar?.maxM ?? '-'} ${l.inCurrentDistrict ? 'IN-DISTRICT' : ''}`);
