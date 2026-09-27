// Wave 4 · places sidecar (lane P, W4-P3): rebuild places.json ONLY, from the same raw inputs as the build, without
// touching the chunks. Deterministic; every published row keeps its index, id, geometry and source (chunks reference
// rows by index), only kinds change (the wave-4 OSM rules: campus / shopping / zoo) and new OSM rows are appended.
//
//   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/places-sidecar.ts [--out <dir>] [--snaps] [--check]
//
//   --out <dir>   where places.json + places-diff.json go (default C:/Users/willy/opus-qa/w4/p/places-sidecar/).
//                 Publishing = copying places.json over public/opus-bay/sf/<version>/places.json (integration phase
//                 only, after SfPlaceKind absorbs the wave-4 kinds; the manifest names the file without a hash).
//   --snaps       also write <out>/extra-snaps.txt: the EXTRA_PLACE_SNAPS block of src/opus-bay/data/sf/extraPlaces.ts
//                 (ground y, zone, walking-graph node of each extra row, as the build computes them for places.json).
//   --check       exit 1 when extraPlaces.ts EXTRA_PLACE_SNAPS / hero flags differ from what this run computes, or an
//                 extra id collides with a published row.
//
// Reads C:/Users/willy/opus-qa/sf-data (OPUS_SF_DATA) and the published places.json + graph.obc (the walking-graph
// node ids must be the published graph's).
import fs from 'node:fs';
import path from 'node:path';
import * as OpenCC from 'opencc-js';
import { unproject } from '../../src/opus-bay/core/geo';
import { WalkGraphIndex } from '../../src/opus-bay/core/walkGraph';
import { EXTRA_PLACES, EXTRA_PLACE_SNAPS } from '../../src/opus-bay/data/sf/extraPlaces';
import { type PlacesFile, type SfCurrent, decodeGraphFile } from '../../src/opus-bay/world/sf/format';
import { inLake, loadAreas, onPier } from './lib/areas';
import { elements, layerHeader, loadDem, writeFile } from './lib/io';
import { buildLand, loadBoundaryRings, loadCoast } from './lib/land';
import { buildPlaces } from './lib/places';
import { type PlaceRowW4, W4_OSM_ZH, candidateSkip, poiKindW4, sameName, stableMerge } from './lib/placesW4';
import { loadWays } from './lib/roads';
import { buildTerrain, heightAt } from './lib/terrain';
import { inSlab, projPt } from './lib/world';
import { loadZones, zoneIndexAt } from './lib/zones';

const REPO = path.resolve(import.meta.dirname, '../..');
const arg = (name: string, def: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def; };
const flag = (name: string) => process.argv.includes(`--${name}`);
const OUT = path.resolve(arg('out', 'C:/Users/willy/opus-qa/w4/p/places-sidecar'));
const t0 = Date.now();
const log = (s: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);

// --- published data -------------------------------------------------------------------------------------------------
const SF = path.join(REPO, 'public/opus-bay/sf');
const cur = JSON.parse(fs.readFileSync(path.join(SF, 'current.json'), 'utf8')) as SfCurrent;
const BASE = path.join(SF, cur.version);
const published = JSON.parse(fs.readFileSync(path.join(BASE, 'places.json'), 'utf8')) as PlacesFile;
const graph = new WalkGraphIndex(await decodeGraphFile(new Uint8Array(fs.readFileSync(path.join(BASE, 'graph.obc')))));
const main = graph.mainComponent();
/** lib/graph.ts nearestNode: a linear scan of the main component, first minimum wins (the build's tie-break, so the
 * published graphNode values come out identical). */
const mainNodes = Array.from({ length: graph.graph.nodeCount }, (_, i) => i).filter(i => graph.component(i) === main);
function snapNode(x: number, z: number, maxD = 60): number {
  let best = -1, bd = maxD * maxD;
  const xyz = graph.graph.xyz;
  for (const i of mainNodes) { const dx = xyz[i * 3] - x, dz = xyz[i * 3 + 2] - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
  return best;
}
log(`published ${cur.version}: ${published.places.length} places, graph ${graph.graph.nodeCount} nodes (main component ${main})`);

// --- the build's inputs (land, terrain, areas, zones) ---------------------------------------------------------------
const dem = loadDem();
const land = buildLand(loadCoast(), loadBoundaryRings(), dem, log);
const insideSf = (x: number, z: number) => { if (land.inside.at(x, z) !== 1) return false; const ll = unproject({ x, z }); return !(ll.lat > 37.815 && ll.lng < -122.44); };
const terrain = buildTerrain(dem, log);
const { plazas } = loadWays(log, insideSf);
const areas = loadAreas(land, plazas, log);
const zones = loadZones(log);
const zoneAt = (x: number, z: number) => { const i = zoneIndexAt(zones, x, z); return i >= 0 ? zones.list[i].id : null; };
const onDeck = (x: number, z: number) => onPier(areas, x, z);
const lake = (x: number, z: number) => inLake(areas, x, z);
const plannerDoc = JSON.parse(fs.readFileSync(path.join(REPO, 'public/planner-catalog.json'), 'utf8')) as { places: { id: string; guideSlug?: string }[] };
const plannerGuides = new Map(plannerDoc.places.map(p => [p.id, p.guideSlug ?? '']));
const verifiedAt = (layerHeader('buildings').osm_base ?? '').slice(0, 10) || published.verifiedAt;
const r2 = (v: number) => Math.round(v * 100) / 100;

// --- 1. the plain rebuild (lib/places.ts as the build runs it), snapped to the published graph ------------------------
const rebuilt = buildPlaces({ terrain, land, zones, version: cur.version, verifiedAt, plannerGuides, onDeck, inLake: lake, log }).places as PlaceRowW4[];
for (const p of rebuilt) p.graphNode = snapNode(p.x, p.z);

// --- 2. wave-4 kinds for OSM rows, new OSM rows ------------------------------------------------------------------------
const tags = new Map<string, Record<string, string>>();
const candidates: { key: string; type: 'node' | 'way' | 'relation'; id: number; name: string; t: Record<string, string>; lat: number; lon: number }[] = [];
const rowKeys = new Set([...published.places, ...rebuilt].filter(p => p.osmType && p.osmId != null).map(p => `${p.osmType}/${p.osmId}`));
for (const e of elements('pois')) {
  const t = e.tags ?? {};
  if (!t.name) continue;
  const key = `${e.type}/${e.id}`;
  tags.set(key, t);
  if (!poiKindW4(t) || rowKeys.has(key)) continue;
  const c = e.center ?? (e.lat !== undefined ? { lat: e.lat, lon: e.lon! } : null);
  if (c) candidates.push({ key, type: e.type, id: e.id, name: t['name:en'] ?? t.name, t, lat: c.lat, lon: c.lon });
}
// curated rows keep landmarks.json's category (the Ferry Building is tagged shop=mall in OSM: still a landmark)
const kindOf = (r: PlaceRowW4) => (!r.curated && r.osmType && r.osmId != null ? poiKindW4(tags.get(`${r.osmType}/${r.osmId}`) ?? {}) ?? r.kind : r.kind);

/** lib/places.ts snapToLand (module-private there; folds back at the integration). */
function snapToLand(x: number, z: number): [number, number] {
  const at = (px: number, pz: number) => (land.grid.at(px, pz) === 1 && !lake(px, pz)) || onDeck(px, pz);
  const solid = (px: number, pz: number) => {
    if (!at(px, pz)) return false;
    for (let k = 0; k < 8; k++) if (!at(px + Math.cos(k * 0.785) * 1.2, pz + Math.sin(k * 0.785) * 1.2)) return false;
    return true;
  };
  if (solid(x, z)) return [x, z];
  for (let r = 0.5; r <= 20; r += 0.5) {
    const n = Math.ceil((2 * Math.PI * r) / 0.5);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (solid(px, pz)) return [px, pz];
    }
  }
  return [x, z];
}

const toHans = OpenCC.Converter({ from: 'hk', to: 'cn' });
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const skipped: { key: string; name: string; why: string }[] = [];
const additions: PlaceRowW4[] = [];
for (const c of candidates.sort((a, b) => (a.key < b.key ? -1 : 1))) {
  const [x, z] = projPt(c.lat, c.lon);
  // the build's SF-only filter: inside the county, on land or within 3 u of it
  if (land.inside.at(x, z) !== 1) { skipped.push({ key: c.key, name: c.name, why: 'outside SF' }); continue; }
  let nearLand = land.grid.at(x, z) === 1;
  for (let k = 0; k < 8 && !nearLand; k++) nearLand = land.grid.at(x + Math.cos(k * 0.785) * 3, z + Math.sin(k * 0.785) * 3) === 1;
  if (!nearLand) { skipped.push({ key: c.key, name: c.name, why: 'not on land' }); continue; }
  const [sx, sz] = snapToLand(x, z);
  const n = norm(c.name);
  const dupe = rebuilt.find(p => Math.hypot(p.x - x, p.z - z) < (p.curated ? 25 : 40) && (norm(p.name.en).includes(n) || n.includes(norm(p.name.en))));
  if (dupe) { skipped.push({ key: c.key, name: c.name, why: `duplicate of ${dupe.id}` }); continue; }
  const why = candidateSkip({ key: c.key, name: c.name }, EXTRA_PLACES, additions.map(a => ({ name: a.name.en })));
  if (why) { skipped.push({ key: c.key, name: c.name, why }); continue; }
  const zhRaw = c.t['name:zh-Hans'] ?? c.t['name:zh'] ?? c.t['name:zh-Hant'] ?? '';
  const row: PlaceRowW4 = {
    id: `osm-${c.type[0]}${c.id}`, name: { zh: W4_OSM_ZH[c.key] ?? (zhRaw ? toHans(zhRaw) : c.t.name), en: c.name }, kind: poiKindW4(c.t)!, x: r2(sx), z: r2(sz), y: r2(heightAt(terrain, sx, sz)),
    zone: zoneAt(sx, sz), osmType: c.type, osmId: c.id, sourceUrl: `https://www.openstreetmap.org/${c.type}/${c.id}`, verifiedAt, curated: false, graphNode: snapNode(sx, sz),
  };
  if (inSlab(sx, sz)) row.hero = true;
  additions.push(row);
}

// --- 3. stable merge, write ------------------------------------------------------------------------------------------
const { places, diff } = stableMerge(published.places, rebuilt, additions, kindOf);
const file = { version: published.version, verifiedAt: published.verifiedAt, places };
writeFile(path.join(OUT, 'places.json'), JSON.stringify(file));
const report = {
  base: path.relative(REPO, BASE).replace(/\\/g, '/'), published: published.places.length, out: places.length, ...diff,
  addedRows: additions.map(a => ({ id: a.id, kind: a.kind, name: a.name.en, x: a.x, z: a.z, graphNode: a.graphNode, verify: 'check it still operates before publishing' })),
  skipped,
};
writeFile(path.join(OUT, 'places-diff.json'), JSON.stringify(report, null, 1));
log(`places.json → ${OUT}: ${places.length} rows (${diff.added.length} added, ${diff.kindChanges.length} kind changes, ${diff.lost.length} lost, ${diff.rebuildOnly.length} rebuild-only, ${diff.drift.length} drift fields)`);
for (const k of diff.kindChanges) log(`  kind ${k.id}: ${k.from} → ${k.to}`);
for (const a of additions) log(`  + ${a.id} ${a.kind} "${a.name.en}" (${a.x}, ${a.z}) node ${a.graphNode}`);

// --- 4. the extra rows' snaps ----------------------------------------------------------------------------------------
const pubIds = new Set(published.places.map(p => p.id));
const snaps = EXTRA_PLACES.map(e => ({ id: e.id, y: r2(heightAt(terrain, e.x, e.z)), zone: zoneAt(e.x, e.z), graphNode: snapNode(e.arrival.x, e.arrival.z), hero: inSlab(e.x, e.z) }));
if (flag('snaps')) {
  const lines = snaps.map(s => `  '${s.id}': { y: ${s.y}, zone: ${s.zone === null ? 'null' : `'${s.zone}'`}, graphNode: ${s.graphNode} },`);
  writeFile(path.join(OUT, 'extra-snaps.txt'), `${lines.join('\n')}\n`);
  log(`extra snaps → ${path.join(OUT, 'extra-snaps.txt')} (${snaps.filter(s => s.graphNode < 0).length} of ${snaps.length} off the graph)`);
}
if (flag('check')) {
  const bad: string[] = [];
  for (const s of snaps) {
    const have = EXTRA_PLACE_SNAPS[s.id];
    const e = EXTRA_PLACES.find(q => q.id === s.id)!;
    if (pubIds.has(s.id)) bad.push(`${s.id}: id is a published row`);
    if (!have) { bad.push(`${s.id}: no snap`); continue; }
    if (Math.abs(have.y - s.y) > 0.011 || have.zone !== s.zone || have.graphNode !== s.graphNode) bad.push(`${s.id}: snap ${JSON.stringify(have)} ≠ ${JSON.stringify({ y: s.y, zone: s.zone, graphNode: s.graphNode })}`);
    if (!!e.hero !== s.hero) bad.push(`${s.id}: hero ${!!e.hero} ≠ inSlab ${s.hero}`);
  }
  for (const a of additions) for (const e of EXTRA_PLACES) if (sameName(a.name.en, e.name.en)) bad.push(`${a.id} duplicates extra ${e.id}`);
  if (bad.length) { console.error(`check FAILED:\n  ${bad.join('\n  ')}`); process.exit(1); }
  log('check: extra snaps, hero flags and ids OK');
}
