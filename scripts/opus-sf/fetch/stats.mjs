// Stats over the downloaded layers. Usage: node stats.mjs [prefix]   (prefix "osm" = Overpass files, "bbbike-osm" = BBBike)
// Writes ../raw/<prefix>-stats.json and prints a summary.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectRaw } from './proj.mjs';
const RAW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../raw');
const prefix = process.argv[2] || 'osm';
const RAD = Math.PI / 180;

function load(layer) {
  const f = path.join(RAW, `${prefix}-${layer}.json`);
  if (!fs.existsSync(f)) return null;
  const els = [];
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!line.startsWith('{"type"')) continue;
    els.push(JSON.parse(line.replace(/,\s*$/, '')));
  }
  return els;
}
const lenM = g => { let L = 0; for (let i = 1; i < g.length; i++) { const dy = (g[i].lat - g[i - 1].lat) * 110540, dx = (g[i].lon - g[i - 1].lon) * 111320 * Math.cos(g[i].lat * RAD); L += Math.hypot(dx, dy); } return L; };
const areaM2 = g => { let A = 0; const c = Math.cos(g[0].lat * RAD); for (let i = 0, j = g.length - 1; i < g.length; j = i++) { A += (g[j].lon * 111320 * c) * (g[i].lat * 110540) - (g[i].lon * 111320 * c) * (g[j].lat * 110540); } return Math.abs(A) / 2; };
const inc = (o, k, v = 1) => { o[k] = (o[k] || 0) + v; };
const top = (o, n = 25) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, Math.round(v * 10) / 10]));
const S = {};

// ---------- buildings
const B = load('buildings');
if (B) {
  const s = { total: B.length, ways: 0, relations: 0, building: 0, buildingPart: 0, withHeight: 0, withLevels: 0, withHeightOrLevels: 0, withMinHeight: 0, withRoofShape: 0, withName: 0, withRoofHeight: 0, footprintAreaKm2: 0, buildingValues: {}, roofShapes: {}, heightBins: {}, levelsBins: {}, tallest: [] };
  const hb = [[0, 6], [6, 10], [10, 15], [15, 25], [25, 50], [50, 100], [100, 1e9]];
  let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
  for (const el of B) {
    const t = el.tags || {};
    el.type === 'way' ? s.ways++ : s.relations++;
    if (t.building) { s.building++; inc(s.buildingValues, t.building); } else s.buildingPart++;
    const h = parseFloat(t.height), lv = parseFloat(t['building:levels']);
    if (!isNaN(h)) { s.withHeight++; const b = hb.find(([a, c]) => h >= a && h < c); inc(s.heightBins, `${b[0]}-${b[1] > 1e8 ? '+' : b[1]}`); s.tallest.push([h, t.name || '', `${el.type}/${el.id}`]); }
    if (!isNaN(lv)) { s.withLevels++; inc(s.levelsBins, lv <= 2 ? '1-2' : lv <= 4 ? '3-4' : lv <= 8 ? '5-8' : lv <= 20 ? '9-20' : '21+'); }
    if (!isNaN(h) || !isNaN(lv)) s.withHeightOrLevels++;
    if (t.min_height || t['building:min_level']) s.withMinHeight++;
    if (t['roof:shape']) { s.withRoofShape++; inc(s.roofShapes, t['roof:shape']); }
    if (t['roof:height']) s.withRoofHeight++;
    if (t.name) s.withName++;
    if (el.type === 'way' && el.geometry && t.building) {
      s.footprintAreaKm2 += areaM2(el.geometry) / 1e6;
      for (const p of el.geometry) { const w = projectRaw(p.lat, p.lon); if (w.x < minx) minx = w.x; if (w.x > maxx) maxx = w.x; if (w.z < minz) minz = w.z; if (w.z > maxz) maxz = w.z; }
    }
  }
  s.tallest = s.tallest.sort((a, b) => b[0] - a[0]).slice(0, 25);
  s.buildingValues = top(s.buildingValues, 20); s.roofShapes = top(s.roofShapes, 12);
  s.footprintAreaKm2 = Math.round(s.footprintAreaKm2 * 100) / 100;
  s.worldExtentOfBuildings = { minX: Math.round(minx), maxX: Math.round(maxx), minZ: Math.round(minz), maxZ: Math.round(maxz) };
  S.buildings = s;
}

// ---------- highways
const H = load('highways');
if (H) {
  const s = { total: H.length, byClassCount: {}, byClassKm: {}, bridges: 0, tunnels: 0, oneway: 0, withLanes: 0, withName: 0, withMaxspeed: 0, withSurface: 0, withWidth: 0, withSidewalk: 0, steps: { count: 0, km: 0 }, totalKm: 0, streetNames: 0, inclineTagged: 0 };
  const names = new Set();
  for (const el of H) {
    const t = el.tags || {}; const k = t.highway; const L = el.geometry ? lenM(el.geometry) / 1000 : 0;
    inc(s.byClassCount, k); inc(s.byClassKm, k, L); s.totalKm += L;
    if (t.bridge && t.bridge !== 'no') s.bridges++;
    if (t.tunnel && t.tunnel !== 'no') s.tunnels++;
    if (t.oneway === 'yes' || t.oneway === '-1') s.oneway++;
    if (t.lanes) s.withLanes++;
    if (t.name) { s.withName++; names.add(t.name); }
    if (t.maxspeed) s.withMaxspeed++;
    if (t.surface) s.withSurface++;
    if (t.width) s.withWidth++;
    if (t.sidewalk || t['sidewalk:both'] || t['sidewalk:left'] || t['sidewalk:right']) s.withSidewalk++;
    if (t.incline) s.inclineTagged++;
    if (k === 'steps') { s.steps.count++; s.steps.km += L; }
  }
  s.streetNames = names.size; s.totalKm = Math.round(s.totalKm);
  s.byClassCount = top(s.byClassCount, 40); s.byClassKm = top(s.byClassKm, 40); s.steps.km = Math.round(s.steps.km * 10) / 10;
  S.highways = s;
}

// ---------- railways
const R = load('railways');
if (R) {
  const s = { total: R.length, waysByRailway: {}, kmByRailway: {}, cableCarWays: { count: 0, km: 0 }, nodesByType: {}, routes: [] };
  for (const el of R) {
    const t = el.tags || {};
    if (el.type === 'way') {
      const L = lenM(el.geometry) / 1000; inc(s.waysByRailway, t.railway); inc(s.kmByRailway, t.railway, L);
      const cc = /cable/i.test(JSON.stringify(t));
      if (cc) { s.cableCarWays.count++; s.cableCarWays.km += L; }
    } else if (el.type === 'node') inc(s.nodesByType, t.railway || t.public_transport);
    else if (el.type === 'relation') s.routes.push(`${t.route}: ${t.ref ?? ''} ${t.name ?? ''} (rel/${el.id}, ${el.members?.length ?? 0} members)`);
  }
  s.kmByRailway = top(s.kmByRailway); s.cableCarWays.km = Math.round(s.cableCarWays.km * 10) / 10;
  s.routes.sort();
  S.railways = s;
}

// ---------- landcover
const L = load('landcover');
if (L) {
  const s = { total: L.length, byClass: {}, areaKm2ByClass: {} };
  const want = ['leisure=park', 'leisure=garden', 'landuse=grass', 'natural=wood', 'landuse=forest', 'natural=scrub', 'natural=beach', 'natural=sand', 'natural=water', 'water=reservoir', 'landuse=reservoir', 'leisure=golf_course', 'landuse=cemetery', 'amenity=grave_yard', 'leisure=pitch', 'natural=coastline', 'natural=grassland', 'natural=heath', 'natural=wetland', 'natural=bare_rock', 'natural=cliff', 'landuse=residential', 'landuse=commercial', 'landuse=industrial', 'landuse=retail', 'landuse=railway', 'leisure=playground', 'leisure=nature_reserve', 'landuse=meadow', 'landuse=recreation_ground', 'man_made=pier', 'man_made=breakwater', 'natural=tree_row', 'natural=tree', 'leisure=marina', 'leisure=stadium', 'amenity=parking', 'waterway=stream', 'area:highway=*'];
  for (const el of L) {
    const t = el.tags || {};
    const keys = [];
    for (const k of ['leisure', 'landuse', 'natural', 'water', 'waterway', 'amenity', 'man_made']) if (t[k]) keys.push(`${k}=${t[k]}`);
    if (t['area:highway']) keys.push('area:highway=*');
    for (const k of keys) {
      if (!want.includes(k)) continue;
      inc(s.byClass, k);
      if (el.type === 'way' && el.geometry && el.geometry.length > 3 && el.geometry[0].lat === el.geometry.at(-1).lat && el.geometry[0].lon === el.geometry.at(-1).lon) inc(s.areaKm2ByClass, k, areaM2(el.geometry) / 1e6);
      else if (el.type === 'relation') for (const m of el.members || []) if (m.geometry && m.role === 'outer' && m.geometry.length > 3) inc(s.areaKm2ByClass, k, areaM2(m.geometry) / 1e6);
      else if (el.type === 'way' && k === 'natural=coastline') inc(s.areaKm2ByClass, 'coastline_km', lenM(el.geometry) / 1000);
    }
  }
  s.byClass = top(s.byClass, 60); s.areaKm2ByClass = top(s.areaKm2ByClass, 60);
  S.landcover = s;
}

// ---------- pois
const P = load('pois');
if (P) {
  const s = { total: P.length, named: 0, byCategory: {} };
  for (const el of P) {
    const t = el.tags || {};
    if (t.name) s.named++;
    for (const k of ['tourism', 'historic', 'man_made', 'amenity', 'leisure', 'place', 'natural']) if (t[k]) { inc(s.byCategory, `${k}=${t[k]}`); break; }
  }
  s.byCategory = top(s.byCategory, 45);
  S.pois = s;
}

// ---------- backdrop
const D = load('backdrop');
if (D) {
  const s = { total: D.length, coastlineWays: 0, coastlineKm: 0, bridges: [], places: [], peaks: [], protected: [] };
  for (const el of D) {
    const t = el.tags || {};
    if (t.natural === 'coastline') { s.coastlineWays++; s.coastlineKm += lenM(el.geometry) / 1000; }
    else if ((t.highway && t.bridge) || t.man_made === 'bridge') { if (t.name || t['bridge:name']) s.bridges.push(t['bridge:name'] || t.name); }
    else if (t.place) s.places.push(t.name);
    else if (t.natural === 'peak') s.peaks.push(`${t.name} ${t.ele ?? ''}`);
    else if (t.boundary) s.protected.push(t.name);
  }
  s.coastlineKm = Math.round(s.coastlineKm);
  s.bridges = [...new Set(s.bridges)].slice(0, 40); s.places = [...new Set(s.places)].slice(0, 80); s.peaks = [...new Set(s.peaks)].slice(0, 60); s.protected = [...new Set(s.protected)].slice(0, 40);
  S.backdrop = s;
}
fs.writeFileSync(path.join(RAW, `${prefix}-stats.json`), JSON.stringify(S, null, 1));
console.log(JSON.stringify(S, null, 1).slice(0, 12000));
