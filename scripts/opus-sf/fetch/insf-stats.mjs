// Counts restricted to the SF boundary (landmask raster != 0) — buildings and highways by class.
import fs from 'node:fs';
const RAW = 'C:/Users/willy/opus-qa/sf-data/raw';
const h = JSON.parse(fs.readFileSync(RAW + '/sf-landmask-z14.json', 'utf8'));
const m = fs.readFileSync(RAW + '/sf-landmask-z14.u8');
const inSF = (lat, lng) => { const c = Math.floor((lng - h.originLng) / h.dLng), r = Math.floor((h.originLat - lat) / h.dLat); return c >= 0 && r >= 0 && c < h.width && r < h.height && m[r * h.width + c] !== 0; };
const RAD = Math.PI / 180;
const lenM = g => { let L = 0; for (let i = 1; i < g.length; i++) L += Math.hypot((g[i].lat - g[i - 1].lat) * 110540, (g[i].lon - g[i - 1].lon) * 111320 * Math.cos(g[i].lat * RAD)); return L; };
const read = f => fs.readFileSync(RAW + '/' + f, 'utf8').split('\n').filter(l => l.startsWith('{"type"')).map(l => JSON.parse(l.replace(/,\s*$/, '')));
const B = { total: 0, withHeight: 0, withLevels: 0, parts: 0, heightOrLidar: 0 };
const join = JSON.parse(fs.readFileSync(RAW + '/osm-datasf-height-join.json', 'utf8')).join;
for (const e of read('bbbike-osm-buildings.json')) {
  const b = e.bounds, lat = (b.minlat + b.maxlat) / 2, lng = (b.minlon + b.maxlon) / 2;
  if (!inSF(lat, lng)) continue;
  const t = e.tags || {};
  if (!t.building) { B.parts++; continue; }
  B.total++; if (t.height) B.withHeight++; if (t['building:levels']) B.withLevels++;
  if (t.height || join[e.id]) B.heightOrLidar++;
}
const R = {}; let totalKm = 0;
for (const e of read('bbbike-osm-highways.json')) {
  const mid = e.geometry[e.geometry.length >> 1];
  if (!inSF(mid.lat, mid.lon)) continue;
  const k = e.tags.highway; const L = lenM(e.geometry) / 1000; totalKm += L;
  R[k] ??= { count: 0, km: 0 }; R[k].count++; R[k].km += L;
}
for (const k in R) R[k].km = Math.round(R[k].km * 10) / 10;
const sorted = Object.fromEntries(Object.entries(R).sort((a, b) => b[1].km - a[1].km));
console.log('buildings inside SF boundary:', B);
console.log('highways inside SF boundary, total km', Math.round(totalKm)); console.log(sorted);
fs.writeFileSync(RAW + '/insf-stats.json', JSON.stringify({ buildings: B, highwaysKm: Math.round(totalKm), highways: sorted }, null, 1));
