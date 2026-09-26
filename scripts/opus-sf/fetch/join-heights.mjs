// OSM buildings x DataSF LiDAR footprints: coverage + agreement. Writes ../raw/osm-datasf-height-join.json (osm id -> lidar max/median).
import fs from 'node:fs';
const RAW = 'C:/Users/willy/opus-qa/sf-data/raw';
const GRID = 0.002, idx = new Map(), fps = [];
for (const line of fs.readFileSync(RAW + '/datasf-buildings.json', 'utf8').split('\n')) {
  if (!line.startsWith('{"sf16')) continue;
  const r = JSON.parse(line.replace(/,\s*$/, ''));
  const rings = r.shape.coordinates.flat(1);
  let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
  for (const ring of rings) for (const [lo, la] of ring) { a = Math.min(a, lo); b = Math.max(b, lo); c = Math.min(c, la); d = Math.max(d, la); }
  const k = fps.push({ id: r.sf16_bldgid, hmax: +r.hgt_maxcm / 100, hmed: +r.hgt_median_m, rings }) - 1;
  for (let x = Math.floor(a / GRID); x <= Math.floor(b / GRID); x++) for (let y = Math.floor(c / GRID); y <= Math.floor(d / GRID); y++) { const key = x + ',' + y; (idx.get(key) ?? idx.set(key, []).get(key)).push(k); }
}
const pip = (x, y, ring) => { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins; } return ins; };
const find = (lng, lat) => { for (const k of idx.get(Math.floor(lng / GRID) + ',' + Math.floor(lat / GRID)) ?? []) if (fps[k].rings.some(r => pip(lng, lat, r))) return fps[k]; return null; };
let n = 0, noH = 0, noHwithLidar = 0, both = 0; const diffs = []; const join = {};
for (const line of fs.readFileSync(RAW + '/bbbike-osm-buildings.json', 'utf8').split('\n')) {
  if (!line.startsWith('{"type":"way"')) continue;
  const e = JSON.parse(line.replace(/,\s*$/, '')); const t = e.tags || {};
  if (!t.building) continue; n++;
  // area-weighted centroid of the outer ring
  const g = e.geometry, ox = g[0].lon, oy = g[0].lat; let A = 0, cx = 0, cy = 0; // local origin avoids cancellation
  for (let i = 0, j = g.length - 1; i < g.length; j = i++) { const xj = g[j].lon - ox, yj = g[j].lat - oy, xi = g[i].lon - ox, yi = g[i].lat - oy, f = xj * yi - xi * yj; A += f; cx += (xj + xi) * f; cy += (yj + yi) * f; }
  const lng = A ? ox + cx / (3 * A) : ox, lat = A ? oy + cy / (3 * A) : oy;
  const fp = find(lng, lat); const h = parseFloat(t.height);
  if (fp) join[e.id] = [Math.round(fp.hmax * 10) / 10, fp.hmed];
  if (isNaN(h)) { noH++; if (fp) noHwithLidar++; }
  else if (fp) { both++; diffs.push(h - fp.hmed); }
}
diffs.sort((a, b) => a - b);
const q = p => Math.round(diffs[Math.floor(diffs.length * p)] * 100) / 100;
const absd = diffs.map(Math.abs).sort((a, b) => a - b);
const res = { osmBuildingWays: n, withoutHeight: noH, withoutHeightButLidar: noHwithLidar, withHeightAndLidar: both, osmMinusLidarMedian: { p10: q(0.1), p50: q(0.5), p90: q(0.9) }, absDiffMedian: Math.round(absd[absd.length >> 1] * 100) / 100, absDiffP90: Math.round(absd[Math.floor(absd.length * 0.9)] * 100) / 100, withinHalfMetre: Math.round(100 * absd.filter(v => v <= 0.5).length / absd.length) + '%' };
console.log(res);
fs.writeFileSync(RAW + '/osm-datasf-height-join.json', JSON.stringify({ note: 'OSM building way id -> [DataSF LiDAR max height m, median height m] for the DataSF footprint containing the OSM footprint centroid (2010 LiDAR)', stats: res, join }));
