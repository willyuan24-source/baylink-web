// DataSF "Building Footprints" (dataset ynuv-fyni): 177k footprints with 2010 LiDAR-derived heights.
// Saves ../raw/datasf-buildings.json (compact: one feature per line) — license: ODC PDDL (DataSF open data terms).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const RAW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../raw');
const BASE = 'https://data.sf.gov/resource/ynuv-fyni.json';
const SELECT = 'sf16_bldgid,mblr,hgt_median_m,hgt_maxcm,hgt_mincm,gnd_min_m,gnd_mediancm,median_1st_m,peak_1st_m,shape';
const PAGE = 25000;
const out = path.join(RAW, 'datasf-buildings.json');
const fd = fs.openSync(out + '.tmp', 'w');
fs.writeSync(fd, `{"source":"DataSF Building Footprints (ynuv-fyni), https://data.sfgov.org/Housing-and-Buildings/Building-Footprints/ynuv-fyni","license":"ODC Public Domain Dedication and License (PDDL) per DataSF terms; heights from 2010 LiDAR (gnd = ground, 1st = first return, hgt = 1st - gnd)","fetched":"${new Date().toISOString()}","fields":"${SELECT}","features":[\n`);
let n = 0, first = true;
const t0 = Date.now();
for (let offset = 0; ; offset += PAGE) {
  const url = `${BASE}?$select=${SELECT}&$order=sf16_bldgid&$limit=${PAGE}&$offset=${offset}`;
  let rows;
  for (let a = 0; a < 5; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 OpusBay-research/1.0', Accept: 'application/json' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      rows = await r.json();
      break;
    } catch (e) { console.log('retry', offset, e.message); await new Promise(res => setTimeout(res, 5000 * (a + 1))); }
  }
  if (!rows) throw new Error('failed at offset ' + offset);
  for (const row of rows) { fs.writeSync(fd, (first ? '' : ',\n') + JSON.stringify(row)); first = false; }
  n += rows.length;
  console.log(`offset ${offset}: +${rows.length} (${n}) ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (rows.length < PAGE) break;
}
fs.writeSync(fd, '\n]}\n');
fs.closeSync(fd);
fs.renameSync(out + '.tmp', out);
console.log(`DONE datasf buildings: ${n} rows, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
