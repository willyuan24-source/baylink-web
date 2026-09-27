// Offline build of the whole-San-Francisco data for Opus Bay (plan §4, formats §5.2).
//
//   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/build.ts [--out <dir>] [--version v1]
//
// Reads C:/Users/willy/opus-qa/sf-data (raw OSM / DataSF / DEM snapshots + landmarks.json) and writes a candidate to
// C:/Users/willy/opus-qa/sf-build/<UTC>/ (or --out): manifest.json, far.obc, graph.obc, c/<cx>_<cz>.obc, transit.json,
// places.json, report.json, ATTRIBUTION.md. Budget asserts fail the build (exit 1) after the candidate is written.
// Publishing is a separate step: scripts/opus-sf/publish.ts <candidate> v1.
import fs from 'node:fs';
import path from 'node:path';
import * as geo from '../../src/opus-bay/core/geo';
import { unproject } from '../../src/opus-bay/core/geo';
import { DISTRICT } from '../../src/opus-bay/data/district';
import {
  AREA_CLASSES, FORMAT_VERSION, GRAPH_EDGE, PROP_KINDS, ROAD_CLASSES, ROOFS, STYLES, type SfManifest, computeDistrictHash, encodeChunk, encodeFar, encodeGraph,
} from '../../src/opus-bay/world/sf/format';
import { inLake, loadAreas, onPier } from './lib/areas';
import { carve, finishBuildings, heroSeam, landmarkOsmIds, loadBuildings, mergeLots } from './lib/buildings';
import { assembleChunks, dropWaterDecks, fitL0Budget } from './lib/chunks';
import { buildFar } from './lib/far';
import { buildGraph, nearestNode } from './lib/graph';
import { RAW, SF_DATA, gzipBytes, layerHeader, loadDem, sha256, sha256File, writeFile } from './lib/io';
import { buildLand, checkPinnedWarp, loadBoundaryRings, loadCoast, measureWarp, warpMaxGradient } from './lib/land';
import { buildPlaces } from './lib/places';
import { FootprintIndex, buildProps } from './lib/props';
import { buildBlocks, buildChains, loadWays, segIndex } from './lib/roads';
import { PALETTES } from './lib/styles';
import { buildTerrain } from './lib/terrain';
import { buildTransit } from './lib/transit';
import { loadZones } from './lib/zones';
import { DOMAIN } from './lib/world';

const REPO = path.resolve(import.meta.dirname, '../..');
const arg = (name: string, def: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def; };
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT = path.resolve(arg('out', `C:/Users/willy/opus-qa/sf-build/${stamp}`));
const VERSION = arg('version', 'v1');

const t0 = Date.now();
const lines: string[] = [];
const log = (s: string) => { const l = `[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`; console.log(l); lines.push(l); };
const timings: Record<string, number> = {};
let tStep = Date.now();
const step = (name: string) => { const now = Date.now(); timings[name] = (now - tStep) / 1000; tStep = now; };

log(`opus-sf build → ${OUT} (version ${VERSION})`);
if (fs.existsSync(path.join(OUT, 'manifest.json'))) throw new Error(`${OUT} already holds a build`);

// 1. land + warp
const coast = loadCoast();
const warp = measureWarp(coast);
warp.notes.forEach(n => log(`warp ${n}`));
const stale = checkPinnedWarp(warp);
if (stale) throw new Error(stale);
const grad = warpMaxGradient();
if (grad >= 0.9) throw new Error(`waterfront warp folds (max gradient ${grad.toFixed(2)})`);
const dem = loadDem();
const land = buildLand(coast, loadBoundaryRings(), dem, log);
const insideSf = (x: number, z: number) => { if (land.inside.at(x, z) !== 1) return false; const ll = unproject({ x, z }); return !(ll.lat > 37.815 && ll.lng < -122.44); };
if (Math.abs(land.areaKm2 - 121.4) > 121.4 * 0.05) throw new Error(`land area ${land.areaKm2.toFixed(1)} km² is off the official 121.4 km²`);
step('land');
// 2. terrain
const terrain = buildTerrain(dem, log);
step('terrain');
// 3. roads, blocks
const { ways, plazas } = loadWays(log, insideSf);
const chainsAll = buildChains(ways, terrain, log, insideSf);
const { kept: chains, dropped: waterDecks } = dropWaterDecks(chainsAll, land);
log(`roads: ${waterDecks} deck chains over open water dropped (bridges are landmarks)`);
const blocks = buildBlocks(ways, land, log);
step('roads');
// 4/5. buildings + hero seam
const areas = loadAreas(land, plazas, log);
const zones = loadZones(log);
const rawB = loadBuildings(land, areas, blocks, landmarkOsmIds(), log);
const streetIx = segIndex(ways, w => ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'pedestrian'].includes(w.cls) && !(w.flags & 64));
const merged = mergeLots(rawB, streetIx, log);
const carveIx = segIndex(ways, w => (w.walk || !!(w.flags & 128)) && !['footway', 'path', 'cycleway', 'track'].includes(w.cls));
const carved = carve(merged, carveIx, log);
const seam = heroSeam(carved, blocks, log);
const buildings = finishBuildings(seam.kept, zones, terrain, seam.seamBlocks, log);
fitL0Budget(buildings, log);
step('buildings');
// 9a. transit (stops feed props)
const transit = buildTransit(terrain, VERSION, log);
// 7. graph
const gb = buildGraph(ways, terrain, log);
step('graph+transit');
// 9b. places
const plannerDoc = JSON.parse(fs.readFileSync(path.join(REPO, 'public/planner-catalog.json'), 'utf8')) as { places: { id: string; guideSlug?: string }[] };
const plannerGuides = new Map(plannerDoc.places.map(p => [p.id, p.guideSlug ?? '']));
const osmBase = layerHeader('buildings').osm_base ?? '';
const verifiedAt = osmBase.slice(0, 10) || new Date().toISOString().slice(0, 10);
const placesFile = buildPlaces({ terrain, land, zones, version: VERSION, verifiedAt, plannerGuides, onDeck: (x, z) => onPier(areas, x, z), inLake: (x, z) => inLake(areas, x, z), log });
let snapped = 0;
for (const p of placesFile.places) { p.graphNode = nearestNode(gb, p.x, p.z, 60, gb.largest); if (p.graphNode >= 0) snapped++; }
log(`places: ${snapped}/${placesFile.places.length} snapped to the largest graph component (≤ 60 u)`);
// 6. props
const fp = new FootprintIndex();
for (const b of buildings) fp.add(b.ring);
const props = buildProps({
  land, streets: carveIx, footprints: fp, chains, areas: areas.list, anchors: placesFile.places.filter(p => p.curated && !p.hero), stops: transit.stopPoints, log,
});
step('places+props');
// names table (street names referenced by chunk roads)
const nameCount = new Map<string, number>();
for (const c of chains) if (c.name) nameCount.set(c.name, (nameCount.get(c.name) ?? 0) + 1);
const names = [...nameCount.keys()].sort();
const nameIndex = new Map(names.map((n, i) => [n, i]));
// 10. chunks
const asm = assembleChunks({ land, terrain, buildings, chains, areas: areas.list, props, places: placesFile.places, nameIndex, log });
const chunkEntries: SfManifest['chunks'] = [];
let chunkBytes = 0, chunkMax = 0, chunkMaxKey = '';
for (const c of asm.chunks) {
  const raw = encodeChunk(c.data), gz = gzipBytes(raw);
  const k = geo.chunkKey(c.data.cx, c.data.cz);
  writeFile(path.join(OUT, 'c', `${k}.obc`), gz);
  chunkBytes += gz.length;
  if (gz.length > chunkMax) { chunkMax = gz.length; chunkMaxKey = k; }
  chunkEntries.push({ k, cx: c.data.cx, cz: c.data.cz, bytes: gz.length, raw: raw.length, sha256: sha256(gz), land: c.land, shore: c.shore, water: c.water, hero: c.hero, buildings: c.data.buildings.count, roads: c.data.roads.count });
}
step('chunks');
// 8. far
const far = buildFar({ terrain, land, blocks, buildings, areas: areas.list, chains, zones, names, nameIndex, log });
const farRaw = encodeFar(far.data), farGz = gzipBytes(farRaw);
writeFile(path.join(OUT, 'far.obc'), farGz);
const graphRaw = encodeGraph(gb.graph), graphGz = gzipBytes(graphRaw);
writeFile(path.join(OUT, 'graph.obc'), graphGz);
writeFile(path.join(OUT, 'transit.json'), JSON.stringify(transit.file));
writeFile(path.join(OUT, 'places.json'), JSON.stringify(placesFile));
step('far+graph');

// manifest
const inputs = ['osm-buildings.json', 'osm-highways.json', 'osm-landcover.json', 'osm-railways.json', 'osm-pois.json', 'osm-backdrop.json', 'osm-boundary.json',
  'osm-datasf-height-join.json', 'dem-sf-z14.f32', 'datasf-neighborhoods-j2bu-swwd.geojson', 'datasf-street-trees.json'].map(f => ({ file: `sf-data/raw/${f}`, abs: path.join(RAW, f) }));
inputs.push({ file: 'sf-data/landmarks.json', abs: path.join(SF_DATA, 'landmarks.json') });
const inputHashes = inputs.map(i => ({ file: i.file, bytes: fs.statSync(i.abs).size, sha256: sha256File(i.abs) }));
const districtHash = computeDistrictHash(DISTRICT);
const ATTRIBUTION = [
  'Map data © OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright',
  'Building heights: DataSF Building Footprints (2010 LiDAR, ynuv-fyni), PDDL',
  'Neighbourhoods: DataSF Analysis Neighborhoods (j2bu-swwd), PDDL; street trees: DataSF Street Tree List (tkzw-k3nq), PDDL',
  'Terrain: AWS Terrain Tiles (Mapzen terrarium z14) — USGS 3DEP, NOAA, GMRT; see https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
];
const counts: Record<string, number> = {
  chunks: chunkEntries.length, landChunks: chunkEntries.filter(c => c.land).length, buildings: buildings.length, osmBuildingsKept: rawB.length,
  chains: chains.length, chunkRoadRuns: chunkEntries.reduce((s, c) => s + c.roads, 0), areas: areas.list.length, props: props.length,
  graphNodes: gb.graph.nodeCount, graphEdges: gb.graph.edgeCount, places: placesFile.places.length, transitLines: transit.file.lines.length,
  names: names.length, farPrisms: far.data.prisms.count, zones: zones.list.length,
};
const manifest: SfManifest = {
  format: 'opus-sf', formatVersion: FORMAT_VERSION, version: VERSION, built: new Date().toISOString(), osmBase,
  geo: {
    K: geo.K, ROT_DEG: geo.ROT_DEG, LAT0: geo.LAT0, LNG0: geo.LNG0, curve: { ...geo.TERRAIN_CURVE }, buildingH: { ...geo.BUILDING_H },
    warp: { ends: geo.WATERFRONT_WARP.map(e => ({ ...e })), along: geo.WARP_ALONG, inside: geo.WARP_INSIDE, in0: geo.WARP_IN0, in1: geo.WARP_IN1 },
  },
  chunk: geo.CHUNK, cell: geo.CELL,
  bbox: { minX: DOMAIN.x0, minZ: DOMAIN.z0, maxX: DOMAIN.x1, maxZ: DOMAIN.z1 },
  chunks: chunkEntries, maxOverhang: Math.ceil(asm.maxOverhang * 10) / 10,
  districtHash, heroDropLots: seam.heroDropLots,
  far: { file: 'far.obc', bytes: farGz.length, raw: farRaw.length, sha256: sha256(farGz) },
  graph: { file: 'graph.obc', bytes: graphGz.length, raw: graphRaw.length, sha256: sha256(graphGz), nodes: gb.graph.nodeCount, edges: gb.graph.edgeCount },
  transit: 'transit.json', places: 'places.json',
  palettes: PALETTES,
  enums: { styles: STYLES, roofs: ROOFS, roadClasses: ROAD_CLASSES, areaClasses: AREA_CLASSES, propKinds: PROP_KINDS, graphEdges: GRAPH_EDGE },
  counts, attribution: ATTRIBUTION,
};
const manifestJson = JSON.stringify(manifest);
writeFile(path.join(OUT, 'manifest.json'), manifestJson);

// budgets (§4.10)
const transitBytes = fs.statSync(path.join(OUT, 'transit.json')).size, placesBytes = fs.statSync(path.join(OUT, 'places.json')).size;
const placesGz = gzipBytes(fs.readFileSync(path.join(OUT, 'places.json'))).length, transitGz = gzipBytes(fs.readFileSync(path.join(OUT, 'transit.json'))).length;
const total = chunkBytes + farGz.length + graphGz.length + gzipBytes(Buffer.from(manifestJson)).length + placesGz + transitGz;
const mean = chunkBytes / chunkEntries.length;
const KB = 1024;
const budgets = [
  { name: 'chunk ≤ 40 KB gzip', value: chunkMax, limit: 40 * KB, detail: chunkMaxKey },
  { name: 'chunk mean ≤ 22 KB gzip', value: Math.round(mean), limit: 22 * KB },
  { name: 'total ≤ 5 MB gzip', value: total, limit: 5 * 1024 * KB },
  { name: 'far.obc ≤ 400 KB gzip', value: farGz.length, limit: 400 * KB },
  { name: 'far L2 triangles ≤ 70k', value: far.l2Triangles, limit: 70000 },
  { name: 'graph.obc ≤ 800 KB gzip', value: graphGz.length, limit: 800 * KB },
  { name: 'toy buildings ≤ 60k', value: buildings.length, limit: 60000 },
  { name: 'L0 cell estimate ≤ 14k triangles', value: asm.l0.max, limit: 14000, detail: asm.l0.maxCell },
].map(b => ({ ...b, pass: b.value <= b.limit }));
for (const b of budgets) log(`budget ${b.pass ? 'ok  ' : 'FAIL'} ${b.name}: ${b.value}${b.detail ? ` (${b.detail})` : ''}`);

// report
const hist = (vals: number[], edges: number[]) => edges.map((e, i) => ({ from: e, to: edges[i + 1] ?? null, n: vals.filter(v => v >= e && (edges[i + 1] === undefined || v < edges[i + 1])).length }));
const tallest = buildings.slice().sort((a, b) => b.heightM - a.heightM).slice(0, 30).map(b => ({
  osmId: b.osmId, name: b.name, heightM: Math.round(b.heightM * 10) / 10, H: Math.round(b.H * 100) / 100, x: Math.round(b.cx), z: Math.round(b.cz), zone: b.zone, style: STYLES[b.style],
}));
const styleCounts: Record<string, number> = {};
for (const b of buildings) styleCounts[STYLES[b.style]] = (styleCounts[STYLES[b.style]] ?? 0) + 1;
const report = {
  version: VERSION, built: manifest.built, runtimeSeconds: (Date.now() - t0) / 1000, timings, osmBase, inputs: inputHashes,
  counts, styleCounts,
  bytes: { chunksGzip: chunkBytes, chunkMean: Math.round(mean), chunkMax, chunkMaxKey, far: farGz.length, farRaw: farRaw.length, graph: graphGz.length, graphRaw: graphRaw.length, transit: transitBytes, places: placesBytes, total },
  budgets, budgetsPass: budgets.every(b => b.pass),
  far: far.stats, l0: asm.l0, land: { areaKm2: land.areaKm2 },
  heights: {
    realM: hist(buildings.map(b => b.heightM), [0, 6, 10, 15, 25, 50, 100, 200]),
    toyH: hist(buildings.map(b => b.H), [3.6, 4.5, 5, 6, 8, 12, 20, 35, 60]),
  },
  tallestNonHero: tallest,
  heroSeam: { districtHash, heroDropLots: seam.heroDropLots, seamBlocks: seam.seamBlocks.size, warp: warp.notes, warpMaxGradient: grad, west: warp.west },
  graph: { nodes: gb.graph.nodeCount, edges: gb.graph.edgeCount, components: gb.components, droppedNodes: gb.dropped },
  log: lines,
};
writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
writeFile(path.join(OUT, 'ATTRIBUTION.md'), `# Opus Bay — San Francisco data ${VERSION}

Built ${manifest.built} by \`scripts/opus-sf/build.ts\` from snapshots in \`opus-qa/sf-data\` (OSM base ${osmBase}).

## Sources and licences

- **OpenStreetMap** — buildings, streets, steps, rail, landcover, coastline, county boundary (relation 111968), POIs.
  © OpenStreetMap contributors, licensed under the Open Database License 1.0 (https://www.openstreetmap.org/copyright).
  The chunk, far, graph, transit and places files are a *derived database* of OpenStreetMap and are therefore also
  available under the ODbL; show "© OpenStreetMap contributors" wherever the map or city is displayed.
- **DataSF** (City and County of San Francisco), Public Domain Dedication and License (PDDL):
  Building Footprints with 2010 LiDAR heights (ynuv-fyni) — fills OSM buildings without a height tag;
  Analysis Neighborhoods (j2bu-swwd) — the 41 zones; Street Tree List (tkzw-k3nq) — every 4th street tree.
- **Terrain**: AWS Open Data Terrain Tiles (Mapzen "terrarium", zoom 14), which include USGS 3DEP (public domain),
  NOAA ETOPO1 and GMRT bathymetry and SRTM. Attribution per https://github.com/tilezen/joerd/blob/master/docs/attribution.md.
- **landmarks.json** (opus-qa/sf-data) — positions from OSM; heights from published figures, OSM tags or DataSF LiDAR as noted per entry.
- Chinese neighbourhood names and transit line names are written for Opus Bay; POI Chinese names come from OSM \`name:zh*\` tags (converted to Simplified).

No GTA_SZ assets, models or data are used.
`);
log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s → ${OUT}`);
if (!report.budgetsPass) { console.error('BUDGET FAIL'); process.exit(1); }
