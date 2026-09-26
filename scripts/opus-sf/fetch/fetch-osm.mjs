// Opus Bay SF data acquisition — Overpass fetcher (sequential, polite, retries with backoff).
// Usage: node fetch-osm.mjs [jobName ...]   (no args = all jobs)
// Output: ../raw/osm-<job>.json (merged, de-duplicated elements), log to ../raw/fetch-log.jsonl
// Data © OpenStreetMap contributors, ODbL 1.0.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.resolve(HERE, '../raw');
fs.mkdirSync(RAW, { recursive: true });
const LOG = path.join(RAW, 'fetch-log.jsonl');

const ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const UA = 'OpusBay-research/1.0 (BAYLINK diorama prototype; one-off download)';

// SF core bbox (task spec) and wider Bay backdrop bbox
const S = 37.700, N = 37.835, W = -122.520, E = -122.350;
const WIDE = { s: 37.45, w: -122.75, n: 38.05, e: -122.10 };

function tiles(rows, cols, box = { s: S, w: W, n: N, e: E }) {
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const s = box.s + ((box.n - box.s) * r) / rows, n = box.s + ((box.n - box.s) * (r + 1)) / rows;
    const w = box.w + ((box.e - box.w) * c) / cols, e = box.w + ((box.e - box.w) * (c + 1)) / cols;
    out.push(`${s.toFixed(5)},${w.toFixed(5)},${n.toFixed(5)},${e.toFixed(5)}`);
  }
  return out;
}
const HDR = '[out:json][timeout:180];';
const BB = `${S},${W},${N},${E}`;
const WB = `${WIDE.s},${WIDE.w},${WIDE.n},${WIDE.e}`;

const JOBS = {
  boundary: [
    `${HDR}rel(111968);out geom;`, // San Francisco (admin_level 6 = city and county)
  ],
  // ways: "out tags geom" (no node-id lists); relations need "out geom" (members carry the geometry)
  buildings: tiles(4, 4).map(b => `${HDR}(way["building"](${b});way["building:part"](${b}););out tags geom;(rel["building"](${b});rel["building:part"](${b}););out geom;`),
  highways: tiles(2, 2).map(b => `${HDR}(way["highway"](${b}););out tags geom;`),
  railways: [
    `${HDR}(way["railway"](${BB}););out tags geom;(node["railway"~"^(station|halt|tram_stop|stop|subway_entrance|platform)$"](${BB});node["public_transport"~"^(stop_position|platform|station)$"]["tram"="yes"](${BB});node["public_transport"~"^(stop_position|platform|station)$"]["cable_car"="yes"](${BB}););out body;` +
      `(rel["route"~"^(cable_car|tram|light_rail|subway|train|funicular|monorail)$"](${BB}););out geom;`,
  ],
  landcover: tiles(2, 2).map(b => `${HDR}(way["landuse"](${b});way["leisure"](${b});way["natural"](${b});way["water"](${b});way["waterway"](${b});way["amenity"~"^(grave_yard|parking)$"](${b});way["man_made"~"^(pier|breakwater|groyne|bridge|quay)$"](${b});way["area:highway"](${b});way["place"~"^(island|islet)$"](${b}););out tags geom;` +
    `(rel["landuse"](${b});rel["leisure"](${b});rel["natural"](${b});rel["water"](${b});rel["man_made"~"^(pier|bridge)$"](${b});rel["place"~"^(island|islet)$"](${b}););out geom;`),
  pois: [
    `${HDR}(nwr["tourism"](${BB});nwr["historic"](${BB});nwr["man_made"~"^(tower|lighthouse|windmill|obelisk|observatory|flagpole|mast|water_tower|crane)$"](${BB});nwr["amenity"~"^(place_of_worship|theatre|cinema|arts_centre|library|marketplace|ferry_terminal|townhall|university|college|fountain|clock)$"]["name"](${BB});nwr["leisure"~"^(park|garden|stadium|sports_centre|marina|golf_course|playground|nature_reserve)$"]["name"](${BB});nwr["place"~"^(neighbourhood|suburb|quarter|locality|island|islet|square)$"](${BB});nwr["natural"~"^(peak|hill|beach|cape|bay|cliff|rock|spring|saddle)$"](${BB});nwr["building"]["name"]["height"](${BB});nwr["building"]["wikidata"](${BB});nwr["wikidata"]["name"](${BB}););out center;`,
  ],
  backdrop: [
    // coarse wider-Bay backdrop: coastline, bridges (motorway/trunk), city/town labels, peaks, parks, big water, islands
    `${HDR}(way["natural"="coastline"](${WB}););out tags geom;` +
      `(way["highway"~"^(motorway|trunk)$"]["bridge"](${WB});way["man_made"="bridge"](${WB}););out tags geom;` +
      `(node["place"~"^(city|town|island)$"](${WB});nwr["natural"="peak"]["name"](${WB});rel["boundary"~"^(national_park|protected_area)$"]["name"](${WB});way["boundary"~"^(national_park|protected_area)$"]["name"](${WB}););out center;` +
      `(way["natural"="water"]["name"](${WB});way["place"~"^(island|islet)$"](${WB}););out tags geom;(rel["natural"="water"]["name"](${WB});rel["place"~"^(island|islet)$"](${WB}););out geom;`,
  ],
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function post(endpoint, query, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: 'data=' + encodeURIComponent(query),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200).replace(/\s+/g, ' ')}`);
    const json = JSON.parse(text);
    if (json.remark && /error|timed out|runtime/i.test(json.remark)) throw new Error('remark: ' + json.remark.slice(0, 200));
    return { json, bytes: text.length };
  } finally { clearTimeout(t); }
}

let healthy = null;
async function pickEndpoint() {
  for (const ep of ENDPOINTS) {
    const t0 = Date.now();
    try {
      await post(ep, '[out:json][timeout:25];node(37.8023,-122.4059,37.8024,-122.4058);out ids;', 40000);
      console.log(`health ok ${ep} ${Date.now() - t0} ms`);
      return ep;
    } catch (e) { console.log(`health FAIL ${ep}: ${e.message}`); }
  }
  return ENDPOINTS[1];
}

async function runQuery(query, label) {
  // overpass-api.de answers 429 (rate limit) / 504 (busy) when its slots are taken: wait and retry it, fall back to the mirrors in between
  const de = ENDPOINTS[1];
  const order = [healthy ?? de, de, ENDPOINTS[2], de, ENDPOINTS[0], de, de, ENDPOINTS[2]];
  const waits = [0, 60000, 30000, 90000, 30000, 120000, 180000, 60000];
  for (let attempt = 0; attempt < waits.length; attempt++) {
    if (waits[attempt]) { console.log(`  retry ${attempt} in ${waits[attempt] / 1000}s`); await sleep(waits[attempt]); }
    const ep = order[attempt % order.length];
    const t0 = Date.now();
    try {
      const { json, bytes } = await post(ep, query, 330000);
      const ms = Date.now() - t0;
      console.log(`  ok ${label} via ${new URL(ep).host}: ${json.elements.length} el, ${(bytes / 1e6).toFixed(1)} MB, ${(ms / 1000).toFixed(1)} s`);
      fs.appendFileSync(LOG, JSON.stringify({ label, endpoint: ep, elements: json.elements.length, bytes, ms, osmBase: json.osm3s?.timestamp_osm_base, at: new Date().toISOString() }) + '\n');
      return json;
    } catch (e) {
      console.log(`  fail ${label} via ${new URL(ep).host} after ${((Date.now() - t0) / 1000).toFixed(1)} s: ${e.message}`);
      fs.appendFileSync(LOG, JSON.stringify({ label, endpoint: ep, error: e.message, ms: Date.now() - t0, at: new Date().toISOString() }) + '\n');
    }
  }
  throw new Error('giving up on ' + label);
}

// REFRESH="buildings:12,15;highways:3;pois:1" re-runs only those 1-based tiles on overpass-api.de and merges them
// into the existing raw/osm-<job>.json (fresh elements overwrite by type/id). Used to replace tiles a stale mirror served.
if (process.env.REFRESH) {
  healthy = ENDPOINTS[1];
  for (const part of process.env.REFRESH.split(';')) {
    const [name, list] = part.split(':');
    const out = path.join(RAW, `osm-${name}.json`);
    const NL = String.fromCharCode(10);
    const lines = fs.readFileSync(out, 'utf8').split(NL);
    const head = lines[0];
    const els = new Map();
    for (const l of lines) if (l.startsWith('{"type"')) { const e = JSON.parse(l.replace(/,\s*$/, '')); els.set(`${e.type}/${e.id}`, e); }
    let base = null;
    const TILEBOX = { buildings: tiles(4, 4), highways: tiles(2, 2), landcover: tiles(2, 2), pois: [BB], railways: [BB], backdrop: [WB] };
    const vertices = el => el.geometry ?? (el.members ? el.members.flatMap(m => m.geometry ?? (m.lat !== undefined ? [{ lat: m.lat, lon: m.lon }] : [])) : el.center ? [el.center] : el.lat !== undefined ? [{ lat: el.lat, lon: el.lon }] : []);
    for (const t of list.split(',').map(Number)) {
      const json = await runQuery(JOBS[name][t - 1], `${name}[${t}/${JOBS[name].length}] refresh`);
      base = json.osm3s?.timestamp_osm_base ?? base;
      // replace semantics: anything with a vertex inside this tile that the fresh answer no longer contains was deleted/changed upstream
      const [s0, w0, n0, e0] = TILEBOX[name][t - 1].split(',').map(Number);
      const fresh = new Set(json.elements.map(el => `${el.type}/${el.id}`));
      let removed = 0;
      for (const [k, el] of els) if (!fresh.has(k) && vertices(el).some(p => p.lat >= s0 && p.lat <= n0 && p.lon >= w0 && p.lon <= e0)) { els.delete(k); removed++; }
      for (const el of json.elements) els.set(`${el.type}/${el.id}`, el);
      console.log(`  tile ${t}: ${json.elements.length} fresh, ${removed} stale removed`);
      await sleep(15000);
    }
    const arr = [...els.values()];
    const fd = fs.openSync(out + '.tmp', 'w');
    fs.writeSync(fd, head.replace(/"osm_base":"[^"]*"/, `"osm_base":"${base}","refreshed":"${process.env.REFRESH}"`) + NL);
    arr.forEach((el, i) => fs.writeSync(fd, JSON.stringify(el) + (i < arr.length - 1 ? ',' + NL : NL)));
    fs.writeSync(fd, ']}' + NL); fs.closeSync(fd); fs.renameSync(out + '.tmp', out);
    console.log(`REFRESHED ${name} tiles ${list}: ${arr.length} elements`);
  }
  console.log('ALL DONE'); process.exit(0);
}
const want = process.argv.slice(2);
const names = want.length ? want : Object.keys(JOBS);
healthy = process.env.OVERPASS_EP || await pickEndpoint();
for (const name of names) {
  const out = path.join(RAW, `osm-${name}.json`);
  if (fs.existsSync(out)) { console.log(`skip ${name} (exists)`); continue; }
  const t0 = Date.now();
  const seen = new Map();
  let base = null;
  const qs = JOBS[name];
  for (let i = 0; i < qs.length; i++) {
    const json = await runQuery(qs[i], `${name}[${i + 1}/${qs.length}]`);
    base = json.osm3s?.timestamp_osm_base ?? base;
    for (const el of json.elements) seen.set(`${el.type}/${el.id}`, el);
    if (i < qs.length - 1) await sleep(15000);
  }
  const elements = [...seen.values()];
  // compact JSON (one element per line) to keep files greppable but not pretty-printed
  const fd = fs.openSync(out + '.tmp', 'w');
  fs.writeSync(fd, `{"generator":"Overpass API via opus-bay fetch-osm.mjs","license":"Data (c) OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright","osm_base":${JSON.stringify(base)},"job":${JSON.stringify(name)},"fetched":${JSON.stringify(new Date().toISOString())},"elements":[\n`);
  elements.forEach((el, i) => fs.writeSync(fd, JSON.stringify(el) + (i < elements.length - 1 ? ',\n' : '\n')));
  fs.writeSync(fd, ']}\n');
  fs.closeSync(fd);
  fs.renameSync(out + '.tmp', out);
  console.log(`DONE ${name}: ${elements.length} unique elements, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await sleep(15000);
}
console.log('ALL DONE');
