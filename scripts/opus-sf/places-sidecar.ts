// Wave 4 · places sidecar (lane P, W4-P3): rebuild places.json ONLY, from the same raw inputs as the build, without
// touching the chunks. Deterministic; every published row keeps its index, id, geometry and source (chunks reference
// rows by index), only kinds change (the wave-4 OSM rules: campus / shopping / zoo) and new OSM rows are appended.
//
//   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/places-sidecar.ts [--out <dir>] [--snaps] [--check]
//
//   --out <dir>   where places.json + places-diff.json go (default C:/Users/willy/opus-qa/w4/p/places-sidecar/).
//                 Publishing = copying places.json over public/opus-bay/sf/<version>/places.json (the manifest names
//                 the file without a hash). Published at the wave-4 integration (W4-P-I3): 1,033 rows; the kinds and
//                 the reviewed additions come from lib/places.ts (`poiKind`, `takesPoi`), as a full build makes them.
//   --snaps       also write <out>/extra-snaps.txt: the EXTRA_PLACE_SNAPS block of src/opus-bay/data/sf/extraPlaces.ts
//                 (ground y, zone, walking-graph node of each runtime row — the 47 extras and the named arrival places —
//                 as the build computes them for places.json).
//   --check       exit 1 when extraPlaces.ts EXTRA_PLACE_SNAPS / hero flags differ from what this run computes, or an
//                 extra id collides with a published row.
//
// Reads C:/Users/willy/opus-qa/sf-data (OPUS_SF_DATA) and the published places.json + graph.obc (the walking-graph
// node ids must be the published graph's).
import fs from 'node:fs';
import path from 'node:path';
import { unproject } from '../../src/opus-bay/core/geo';
import { WalkGraphIndex } from '../../src/opus-bay/core/walkGraph';
import { EXTRA_PLACE_SNAPS, RUNTIME_PLACES } from '../../src/opus-bay/data/sf/extraPlaces';
import { type PlacesFile, type SfCurrent, decodeGraphFile } from '../../src/opus-bay/world/sf/format';
import { inLake, loadAreas, onPier } from './lib/areas';
import { elements, layerHeader, loadDem, writeFile } from './lib/io';
import { buildLand, loadBoundaryRings, loadCoast } from './lib/land';
import { buildPlaces, takesPoi } from './lib/places';
import { type PlaceRowW4, W4_OSM_ADDS, candidateSkip, poiKindW4, sameName, stableMerge } from './lib/placesW4';
import { loadWays } from './lib/roads';
import { buildTerrain, heightAt } from './lib/terrain';
import { inSlab } from './lib/world';
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

// --- 2. what the wave-4 rules change ---------------------------------------------------------------------------------
// lib/places.ts `poiKind` gives the wave-4 kinds (campus / shopping / zoo) and `takesPoi` keeps only the reviewed new
// rows (`W4_OSM_ADDS`), so the rebuild already carries both: published rows take its kind, and the rebuild's reviewed
// rows that are not published yet are appended (in key order). The candidates the wave-4 rules found but the list does
// not keep are reported for a later review (places-diff.json `skipped`).
const pubIds = new Set(published.places.map(p => p.id));
const keyOf = (r: { osmType: string | null; osmId: number | null }) => `${r.osmType}/${r.osmId}`;
const skipped: { key: string; name: string; why: string }[] = [];
for (const e of elements('pois')) {
  const t = e.tags ?? {}, key = `${e.type}/${e.id}`;
  if (t.name && poiKindW4(t) && !takesPoi(t, key) && !published.places.some(p => keyOf(p) === key)) skipped.push({ key, name: t['name:en'] ?? t.name, why: 'not on the reviewed list (W4_OSM_ADDS)' });
}
const additions: PlaceRowW4[] = [];
for (const r of rebuilt.filter(q => !pubIds.has(q.id) && q.osmType && W4_OSM_ADDS[keyOf(q)]).sort((p, q) => (keyOf(p) < keyOf(q) ? -1 : 1))) {
  const why = candidateSkip({ key: keyOf(r), name: r.name.en }, RUNTIME_PLACES, additions.map(x => ({ name: x.name.en })), null);
  if (why) { skipped.push({ key: keyOf(r), name: r.name.en, why }); continue; }
  additions.push(r);
}
for (const k of Object.keys(W4_OSM_ADDS)) if (!additions.some(x => keyOf(x) === k) && !skipped.some(x => x.key === k)) skipped.push({ key: k, name: W4_OSM_ADDS[k], why: 'reviewed, but the build drops it (lib/places.ts: a row within 25–40 u whose name is part of its name, or off SF land)' });

// --- 3. stable merge, write ------------------------------------------------------------------------------------------
const { places, diff } = stableMerge(published.places, rebuilt, additions);
// the appended rows are not "rebuild-only"
diff.rebuildOnly = diff.rebuildOnly.filter(id => !additions.some(x => x.id === id));
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
const snaps = RUNTIME_PLACES.map(e => ({ id: e.id, y: r2(heightAt(terrain, e.x, e.z)), zone: zoneAt(e.x, e.z), graphNode: snapNode(e.arrival.x, e.arrival.z), hero: inSlab(e.x, e.z) }));
if (flag('snaps')) {
  const lines = snaps.map(s => `  '${s.id}': { y: ${s.y}, zone: ${s.zone === null ? 'null' : `'${s.zone}'`}, graphNode: ${s.graphNode} },`);
  writeFile(path.join(OUT, 'extra-snaps.txt'), `${lines.join('\n')}\n`);
  log(`extra snaps → ${path.join(OUT, 'extra-snaps.txt')} (${snaps.filter(s => s.graphNode < 0).length} of ${snaps.length} off the graph)`);
}
if (flag('check')) {
  const bad: string[] = [];
  for (const s of snaps) {
    const have = EXTRA_PLACE_SNAPS[s.id];
    const e = RUNTIME_PLACES.find(q => q.id === s.id)!;
    if (pubIds.has(s.id)) bad.push(`${s.id}: id is a published row`);
    if (!have) { bad.push(`${s.id}: no snap`); continue; }
    if (Math.abs(have.y - s.y) > 0.011 || have.zone !== s.zone || have.graphNode !== s.graphNode) bad.push(`${s.id}: snap ${JSON.stringify(have)} ≠ ${JSON.stringify({ y: s.y, zone: s.zone, graphNode: s.graphNode })}`);
    if (!!e.hero !== s.hero) bad.push(`${s.id}: hero ${!!e.hero} ≠ inSlab ${s.hero}`);
  }
  for (const a of additions) for (const e of RUNTIME_PLACES) if (sameName(a.name.en, e.name.en)) bad.push(`${a.id} duplicates extra ${e.id}`);
  if (bad.length) { console.error(`check FAILED:\n  ${bad.join('\n  ')}`); process.exit(1); }
  log('check: extra snaps, hero flags and ids OK');
}
