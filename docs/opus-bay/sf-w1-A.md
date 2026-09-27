# Lane A report: SF data pipeline, v1 published (2026-09-26)

**Status.** v1 is published and all budgets pass.
- `public/opus-bay/sf/current.json` → `{"version":"v1"}`.
- The data is in `public/opus-bay/sf/v1/`: 194 chunk files, `far.obc`, `graph.obc`, `transit.json`, `places.json`, `manifest.json`, `report.json`, `ATTRIBUTION.md`.
- The candidate it came from is `C:/Users/willy/opus-qa/sf-build/20260926T114537Z/` (`LATEST` names it).
- Build command: `npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/build.ts [--out dir] [--version v1]`. It runs in **41–49 s** and is deterministic: a rerun produced byte-identical chunks, far and graph.
- Publish command: `npx tsx … scripts/opus-sf/publish.ts <candidate> vN`. It refuses to overwrite an existing version.
- Checks:
  - `npx tsc -p tsconfig.app.json --noEmit`: 0 errors for the whole project.
  - `eslint` on all lane files: 0 problems.
  - `tests/opus-bay-*.test.ts`: 165/165 pass. That is the 104 existing tests, my 17, and other lanes' tests.

## 1. Files

| file | what |
|---|---|
| `src/opus-bay/core/geo.ts` (new) | Frame, terrain curve, building height, street widths, chunk grid, waterfront warp. Pure; no three.js. |
| `src/opus-bay/world/sf/format.ts` (new) | OBC1 / OBF1 / OBG1 reader and writer, JSON types, gzip helpers, loaders, `computeDistrictHash`. Pure and worker-safe. |
| `scripts/opus-sf/build.ts`, `publish.ts` (new) | The offline build (plan §4 steps 1–11) and the publish step. |
| `scripts/opus-sf/lib/*.ts` (new) | `io`, `geom`, `raster`, `world`, `land`, `terrain`, `roads`, `areas`, `zones`, `styles`, `buildings`, `props`, `graph`, `far`, `transit`, `places`, `chunks`. |
| `tests/opus-bay-sf-geo.test.ts` (new) | 5 tests. |
| `tests/opus-bay-sf-format.test.ts` (new) | 5 tests. |
| `tests/opus-bay-sf-data.test.ts` (new) | 7 tests. |
| `vite.opus.config.ts` | Adds only `server.watch.ignored: ['**/public/opus-bay/sf/**']`. |
| `public/opus-bay/sf/current.json`, `public/opus-bay/sf/v1/**` (new) | The published data. |
| `opus-qa/sf-build/preview.py` | QA renderer. It decodes the built files itself (an independent Python OBC1/OBF1 decoder), not the raw data. |
| `opus-qa/sf-data/raw/datasf-street-trees.json` (new input) | DataSF `tkzw-k3nq`, fetched in 3 pages of 50k: 144,455 rows, 138,701 with coordinates. Logged in `fetch-log.jsonl`. |

**Vite note.** Vite caches the public-file list at startup and updates it only through the watcher. Because of the ignore rule, a newly published version returns index.html until Vite restarts. After publishing, re-save (`touch`) `vite.opus.config.ts`: Vite then restarts itself and serves the new files. I did this once; `/opus-bay/sf/v1/c/-1_1.obc` now serves 35,229 gzip bytes.

## 2. API: `core/geo.ts`

```ts
// projection — identical to district.ts (test: 240 points incl. DEM + SF corners, bit-equal)
export const K = 0.14, ROT_DEG = 46, LAT0 = 37.802338, LNG0 = -122.40001, MX: number, MZ = 110540;
export function projectRaw(lat: number, lng: number): Vec2;          // unrounded
export function project(lat: number, lng: number): Vec2;             // rounded 0.01 u, = district.project
export function unproject(p: Vec2): { lat: number; lng: number };    // = district.unproject (ignores the warp)
export const metresToU: (m: number) => number;
// terrain (§2.2)
export const TERRAIN_CURVE = { datum: 3, a: 0.238, knee: 90, s: 0.65 };
export function terrainY(dem: number): number;      // DEM m → y u; ≤ 3 m / NaN → 0
export function demFromY(y: number): number;        // inverse; y ≤ 0 → 3
export function structureY(groundDem: number, heightM: number): number; // bridges / towers on the curve
// buildings (§2.3)
export const BUILDING_H = { min: 3.6, a: 3.2, b: 0.155 };
export function buildingH(heightM: number): number;  // max(3.6, 3.2 + 0.155 h)
export function buildingHeightM(h: number): number;  // inverse
export const WALL_SINK = 1.2;
// streets (§2.4)
export type StreetClass = 'motorway'|'trunk'|'primary'|'secondary'|'tertiary'|'residential'|'service'|'pedestrian'|'footway'|'path'|'cycleway'|'steps'|'track';
export const STREET_ROW: Record<StreetClass, number>; // 6 / 5.6 / 5.6 / 4.4 / 4.4 / 3.6 / 2 / 2.4 / 1.2 / 1.2 / 1.2 / 1.4 / 1.2
export const CURB_BAND = 0.6;
// grid
export const CHUNK = 128, CELL = 64;
export const chunkOf: (x, z) => { cx, cz };  export const cellOf: (x, z) => { ix, iz };
export const chunkKey: (cx, cz) => string /* "cx_cz" */;  export function parseChunkKey(k): { cx, cz };
// waterfront warp (§5.1 rule 3); the published data is in the warped "city frame"
export interface WarpEnd { id; ox; oz; dx; dz; tx; tz; mx; mz }
export const WATERFRONT_WARP: readonly WarpEnd[];   // east end only (see decisions)
export const WARP_ALONG = 160, WARP_INSIDE = 40, WARP_IN0 = 25, WARP_IN1 = 85;
export function smoothstep(e0, e1, x): number;
export function warpOffset(x, z, ends?): Vec2;
export function warpCity(p: Vec2, ends?): Vec2;    export function unwarpCity(q: Vec2, ends?): Vec2;
export function projectCity(lat, lng): Vec2;       // what every sf file uses
export function unprojectCity(p: Vec2): { lat, lng };
```

## 3. API: `world/sf/format.ts`

**Constants.**
- `FORMAT_VERSION = 1`; `MAGIC = { chunk: 'OBC1', far: 'OBF1', graph: 'OBG1' }` (stored as u32 LE); `HEADER_BYTES = 32`; `SECTION`.
- `DEM_N = 65`, `DEM_STEP = 2`; `NO_NAME = 0xffff`; `SfFormatError`.

**Enums** (code = array index; the manifest repeats them):
- `ROAD_CLASSES` = motorway, trunk, primary, secondary, tertiary, residential, service, pedestrian, footway, path, cycleway, steps, track, **tram**, **rail**. `STREET_CLASS_CODE` maps each `StreetClass` to its code.
- `ROAD_FLAG`:
  - bridge 1 (the y is the deck);
  - tunnel 2 (never written);
  - steps 4;
  - oneway 8;
  - rail 16;
  - cable 32;
  - deckOnly 64: a visual viaduct, not walkable;
  - noWalk 128: an at-grade motorway.
- `AREA_CLASSES` = land, water, park, grass, forest, sand, pier, plaza, parking, golf, pitch, scrub, rock. `AREA_FLAG` = { hole 1, deck 2 }.
- `PROP_KINDS` = tree, pine, palm, lamp, bench, bike-rack, stop. Variants: tree 0 round / 1 tall / 2 small; pine 0 cypress / 1 pine.
- `STYLES` = victorian, edwardian, sunset, marina, chinatown, brick, deco, office, tower, industrial, civic, pier, residential. Mapping to today's recipes:
  - victorian → victorian;
  - edwardian, sunset, marina → residential;
  - chinatown → shop;
  - brick, industrial, pier → warehouse;
  - deco, civic → deco;
  - office → office;
  - tower → tower.
- `ROOFS` = flat, gable, hip.
- `BUILDING_FLAG`:
  - bits 0–1: height source (0 OSM, 1 LiDAR, 2 levels, 3 default);
  - merged 4;
  - relation 8;
  - onPier 16;
  - landmark 32: the OSM feature of a `landmarks.json` entry;
  - tall 64: ≥ 60 m real;
  - seam 128: a city-owned block that straddles the slab;
  - carved 256.
- `CHUNK_FLAG` = { land 1, shore 2, water 4, hero 8 }; `GRAPH_EDGE` = street, steps, path, pedestrian, service; `GRAPH_NODE_FLAG` = { hero 1, junction 2 }.

**Functions:**
```ts
encodeChunk(d: ChunkData): Uint8Array;      decodeChunk(bytes: Uint8Array): ChunkData;
encodeFar(d: FarData): Uint8Array;          decodeFar(bytes): FarData;
encodeGraph(g: WalkGraph): Uint8Array;      decodeGraph(bytes): WalkGraph;
gunzip(bytes): Promise<Uint8Array>   // DecompressionStream('gzip'); non-gzip bytes pass through
gzip(bytes): Promise<Uint8Array>     // CompressionStream (tests)
decodeChunkFile / decodeFarFile / decodeGraphFile (bytes) → Promise<…>   // gunzip + decode
SF_ROOT = '/opus-bay/sf'; versionBase(version, root?); chunkPath(cx, cz) → 'c/cx_cz.obc'
loadManifest(root = SF_ROOT, fetchImpl?): Promise<{ base: string; manifest: SfManifest }>   // current.json → manifest
fetchChunk(base, cx, cz, fetchImpl?): Promise<ChunkData>
demSample(d: DemGrid, x, z): number        // bilinear, clamped
computeDistrictHash({ slab, blocks }): string   // FNV-1a hex; compare with manifest.districtHash
emptyBuildings() / emptyRoads() / emptyAreas() / emptyProps() / emptyPlaces()
```

**Container.** 32 B header: magic u32, version u16, flags u16, cx i16, cz i16, nSections u16, reserved u16, totalBytes u32, then zeros. After it comes a table of 12 B entries `{id u16, pad u16, offset u32, len u32}`. Decoders throw `SfFormatError` on:
- bad magic;
- a version mismatch;
- a totalBytes mismatch;
- a section running past the end;
- unread or overrun bytes in any section.

**On-disk section encoding** (my decision, not in the plan). Each per-item field is its own array. Coordinates and heights are quantised integers stored as zigzag deltas from the previous point, continuing across items, then split into byte planes. Result: the densest chunk dropped from 57 KB to 35 KB and the graph from 766 KB to 340 KB. Readers only see typed arrays.

Quantisation:

| value | step |
|---|---|
| chunk x/z | 1/128 u from (cx·128, cz·128) |
| far and graph x/z | 1/8 u, world |
| y | 1/500 u |
| building and prism H | 1/100 u |
| road width | 1/10 u |
| graph cost | 1/100 u, ≤ 655 per edge |
| rotation | 256 steps |

## 4. Schemas

All decoded coordinates are **world units in the city frame**. y is world height ≥ 0; water level is −0.6.

**ChunkData** (`c/<cx>_<cz>.obc`):
- `cx`, `cz`, `flags` (CHUNK_FLAG).
- `dem: DemGrid`: 65×65, 2 u apart, origin (cx·128, cz·128); `y[j·65+i]`. Shared edges equal the neighbour's (tested). Inside the hero slab it holds the hero `hillHeight`. Outside, it blends from the hero edge height over 40 u.
- `buildings: BuildingSet`, one struct-of-arrays entry per building:
  - `style`, `roof`, `palette`: an index into `manifest.palettes`, `{family, wall, trim, roof}` hex, 55 entries;
  - `flags`;
  - `height`: toy wall height in u above `baseY`;
  - `baseY`: the lowest ground under the footprint, in u; walls start `WALL_SINK` below it;
  - `osmId`: the largest merged part;
  - `vStart[count+1]` and `xz`: 3–8 vertices, CCW from above.

  Buildings belong to the chunk that holds their centroid. They may overhang up to `manifest.maxOverhang` = **20.7 u**.
- `roads: RoadSet`, per road `cls`, `width` (right-of-way, u), `nameIdx` (into `far.names`), `flags`, then `pStart` and `xyz` (x, centreline y, z).
  - Runs are clipped to the chunk square ±8 u. Draw or rasterise only inside your own square.
  - y is terrain smoothed ±3 u along the line; the corridor is meant to be flattened to it with a 1.5 u blend.
  - Bridges: a straight deck between the approaches.
  - `deckOnly`: ground plus 3.4 u (+1.8 per layer above 1), ramping over 24 u where the deck meets at-grade roads.
- `areas: AreaSet`: `cls`, `flags`, `pStart`, `xz`, **painted in file order**, clipped to the square ±2 u.
  - Land and water rings come first, from the 0.5 u coastline raster, sorted by area descending (outer = land, holes = water), extending up to 1.5 u beyond the square.
  - Then landcover in the order park, golf, forest, scrub, grass, pitch, sand, rock, parking, plaza, water (lakes), pier. A ring with `AREA_FLAG.hole` cuts the preceding outer ring of the same class (even-odd). Piers carry `deck`; the deck y is 0, like hero decks.
  - Anything no ring covers is sea.
- `props: PropSet`: `kind`, `variant`, `xz`, `rot` (three.js rotation.y). y = ground.
- `places: PlaceRefSet`: `place` (an index into `places.json`) and `xz` (the anchor).

**FarData** (`far.obc`, always loaded):
- `dem`: 16 u, 157×185, origin (−1000, −800).
- `prisms: PrismSet`: `kind` (0 block, 1 tower), `roof`, `wallRgb`/`roofRgb` (sRGB bytes), `height`, `baseY`, `vStart`, `xz` (4–8 vertices). There are 4,692 block prisms at the area-weighted median roof line, 151 towers (≥ 60 m) and 847 boxes in sparse blocks and superblocks: ≈ 67.4k triangles.
- `areas`: land/sea at 2 u, then parks, golf, woods, sand, lakes.
- `lines`: motorway…tertiary and tram, at 0.8 u.
- `zones: SfZone[41]`: `{id, zh, en, rings[{hole, xz}]}` from DataSF Analysis Neighborhoods. The zh names are authored.
- `names`: 2,558 street names; zone and landmark strings are appended after them.
- `landmarks: LandmarkProxy[69]`: `{id, x, z, baseY, height, radius}`.
- `zoneGrid`: 16 u cells centred on the DEM samples; `idx` = zone index + 1.

**WalkGraph** (`graph.obc`, load lazily):
- 32,569 nodes and 86,248 directed edges, stored both ways as CSR.
- `xyz` (1/8 u), `nodeFlags` (hero, junction), `offsets[n+1]`, `targets`, `cost`, `kind`.
- Cost = length × (1 + 2·max(0, |grade| − 0.25)) × (1.3 on steps).
- Nodes are street, step and path vertices shared between OSM ways, plus one every ≤ 24 u. Sidewalk and crossing footways, motorways, viaducts and tunnels are excluded. Components under 50 nodes are dropped; 8 components remain, the largest with 31,658 nodes.
- Nodes are Morton-ordered in 16 u cells.
- It includes real OSM streets inside the hero slab (flag `hero`), which the hero does not treat as walkable.

**SfManifest** (`manifest.json`, 46 KB):
- `format`, `formatVersion`, `version`, `built`, `osmBase` (2026-09-26T10:09:51Z).
- `geo {K, ROT_DEG, LAT0, LNG0, curve, buildingH, warp {ends, along, inside, in0, in1}}`.
- `chunk 128`, `cell 64`, `bbox {−1024, −896, 1536, 2176}`.
- `chunks[{k, cx, cz, bytes, raw, sha256, land, shore, water, hero, buildings, roads}]`.
- `maxOverhang`, `districtHash` (`f4fd5f7e`), `heroDropLots` (`[232]`).
- `far` and `graph` `{file, bytes, raw, sha256 (+nodes, edges)}`, `transit`, `places`, `palettes[55]`.
- `enums`, `counts`, `attribution[]`.

**TransitFile** (`transit.json`, 35 KB):
- `lines[]` of `{id, kind, name{zh,en}, osmRelation, sourceUrl, color, path, length, stops, turntables, doubleEnded, heroSpans}`:
  - `path` is flat [x, y, z …], with y from the terrain smoothed ±3 u;
  - each stop is `{id, name, at (arc length u), x, z, osmId}`;
  - each turntable is `{x, z, osmId, name}`;
  - `heroSpans` are arc-length spans inside the slab.
- The four lines:

| line | length | stops | turntables | hero span |
|---|---|---|---|---|
| powell-hyde | 456.3 u | 28 | (130.4, 257.6), (−234.0, 137.5) | none |
| powell-mason | 345.5 u | 23 | (130.4, 257.6), (−162.5, 103.8) | 335–345.5 |
| california | 319.9 u | 18 | none (double-ended) | 0–71.8 |
| f-line (Jones & Beach → 17th & Castro) | 1,135.8 u | 45 | none | 24.4–503.2 |

**PlacesFile** (`places.json`, 323 KB raw / 55 KB gzip):
- `places[]` of `{id, name{zh,en}, kind, x, z, y, zone, osmType, osmId, sourceUrl (OSM element), verifiedAt (2026-09-26), curated, graphNode, plannerId?, guideSlug?, hero?}`.
- There are 1,027 places: 69 curated from `landmarks.json` and 958 named OSM POIs (viewpoints, attractions, museums, peaks, parks, gardens, historic sites, neighbourhoods, squares).
- 28 anchors were moved onto solid land (a 1.2 u disc, not in a lake).
- 990 places snap to the main graph component within 60 u.
- `plannerId` is set only for ids that exist in the catalog:
  - golden-gate
  - pier39
  - alcatraz
  - chinatown
  - golden-gate-park
  - presidio
  - palace
- 71 places carry `hero: true` (inside the slab).

## 5. How to load

Node (tests, tools):
```ts
import fs from 'node:fs';
import { decodeChunkFile, decodeFarFile, type SfManifest } from '../src/opus-bay/world/sf/format';
const root = 'public/opus-bay/sf', { version } = JSON.parse(fs.readFileSync(`${root}/current.json`, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(`${root}/${version}/manifest.json`, 'utf8')) as SfManifest;
const chunk = await decodeChunkFile(new Uint8Array(fs.readFileSync(`${root}/${version}/c/-1_1.obc`)));
```

Module worker (`new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`):
```ts
import { fetchChunk, loadManifest } from './format';
const { base, manifest } = await loadManifest();             // '/opus-bay/sf/current.json' → '/opus-bay/sf/v1'
const c = await fetchChunk(base, cx, cz);                    // fetch → DecompressionStream('gzip') → decodeChunk
postMessage(c, [c.buildings.xz.buffer, c.roads.xyz.buffer, c.dem.y.buffer /* … all typed arrays */]);
```
In a **blob** worker, pass an absolute root (`loadManifest('http://host/opus-bay/sf')`), because relative URLs do not resolve against `blob:` URLs.

Verified in headless Chrome: a module worker imported `format.ts` from the dev server and decoded the densest chunk (`-1_1`, 35 KB, 788 buildings) in **9.2 ms**, including fetch and inflate. manifest, chunk, far and graph together took 48.9 ms. Output: `opus-qa/sf-build/worker-check.js` / `.png`.

## 6. How the build works (and the decisions I made)

1. **Land.** OSM coastline (412 ways; no open ends in the domain) is drawn as walls on a 0.5 u raster.
   - Water is flood-filled from 5 fixed open-water seeds. Deep-DEM seeds are unsafe: Lake Merced's bathymetry flooded the city.
   - The result is intersected with boundary relation 111968, applying the landmask.py rule that drops Marin cells.
   - Specks under 150 u² are dropped, and so are county-line slivers: a component keeping < 30 % of its landmass, such as the parts of Angel Island and the Alameda shore inside the county line.
   - Result: **120.88 km²** against the official 121.4 km².
2. **Waterfront warp** (measured, not assumed).
   - **East:** the hero seawall leaves the slab at (244, 12.6) and the real shore at (244, 28.2). The translation is (0, −15.6), fading over 160 u along the coast and 25→85 u inland. The max displacement gradient is 0.585, so it never folds, and `unwarpCity` inverts it (tested).
   - **West: no warp.** There the hero seawall is extrapolated past Pier 39 and lies *landward* of the real shore. The real shore meets the slab's diagonal edge 16.4 u further along it, at (−218.7, 63.9) against the hero's (−205.4, 73.6). A warp there would have to squash Fisherman's Wharf. Instead, a 16 u straight "quay" remains where city land meets hero water along that edge.
   - The plan's single 18.4 u figure does not hold at both ends.
3. **Terrain.**
   - The DEM is sampled at `unwarpCity` of a 1 u lattice and passed through `terrainY`.
   - The hero seam: inside the slab, `hillHeight`; outside, a lerp to the terrain with smoothstep over 40 u.
   - Then a 3×3 blur. Chunks sample at 2 u; far takes a box average over 16 u.
   - Grades in the 40 u seam band: p50 0, p99 0.44, max 1.08 at (−68, 148), which is the real Telegraph/Russian Hill slope.
4. **Roads.** Highways plus surface rail.
   - Dropped: tunnels, layer < 0, driveways, parking aisles, private service roads, service roads < 30 m, sidewalks and crossings (as geometry), and ways outside the county.
   - Ways are merged into chains by class, name and flags, densified to 2 u, given heights, cut where they leave SF, and simplified in 3D (0.15 u horizontal, 0.06 u vertical).
   - 55 freeway or bridge deck chains over open water are dropped; the landmarks lane owns the GGB and the Bay Bridge.
   - Result: 18,402 chains, 27,844 chunk runs.
5. **Buildings.** 158,881 kept from 169,836. Heights: OSM 138,520, LiDAR 17,036, levels 322, default 3,003.
   - **Merge** (my rules):
     - shared walls, plus side gaps ≤ 3.2 m real and a second pass to 5.6 m for stranded small groups;
     - never back-to-back: the wall must be ⟂ to the street;
     - same street block and class; toy heights within ×1.35;
     - merging stops when frontage reaches **4.6 u (the hero toy lot)**; hard cap 7 u.
     - The union is taken by raster closing at 0.08 u, because exact shared-edge cancellation failed on about 25 % of pairs.
     - 906 rear-yard accessory structures (< 90 m², more than 4 u behind the street) are dropped.
   - **Carve:** 47,780 footprints are cut by toy street corridors; 3,596 remainders are dropped.
   - **Simplify:** ≤ **8** vertices (the plan says ≤ 12). The 5,610 footprints in the densest cells go down to 6/5/4 so that no L0 cell estimate exceeds 14k.
   - **Style:** from the 41 neighbourhoods plus lot area, use tags and height; roof by rule.
   - Towers and bridges that the landmarks lane builds are removed: Sutro Tower, the GGB, Bay Bridge piers, and any pier structure over 30 m.
   - **Result: 57,480 toy buildings** (≤ 60k):

| style | count |
|---|---|
| edwardian | 22,451 |
| sunset | 11,326 |
| victorian | 10,607 |
| residential | 4,718 |
| marina | 1,995 |
| deco | 1,898 |
| civic | 1,618 |
| brick | 1,421 |
| industrial | 474 |
| office | 464 |
| chinatown | 352 |
| tower | 151 |
| pier | 5 |

6. **Hero seam.**
   - Street blocks come from a 1 u raster of land minus public-street corridors: 5,955 blocks. A block ≥ 60 % inside SLAB is hero-owned.
   - 1,013 city buildings in hero blocks are dropped, plus 3 near the reconstructed exclusion shapes (Levi's, the Ferry Building footprint, the Coit/Transamerica/Salesforce/Embarcadero Plaza circles, the ramps, the Telegraph Hill boulevard) and any that touch a kept hero lot (none did).
   - `heroDropLots = [232]`. 16 city blocks straddle the slab; their buildings carry the `seam` flag.
7. **Props:** 39,831 in total.
   - 29,001 street trees, 3,963 conifers and 895 palms. DataSF is sampled 1 in 4; trees are moved to the curb band and dropped at junctions or inside footprints. Parks and woods are filled on a jittered grid.
   - 5,709 lamps every 9 u on primary and secondary streets.
   - 90 stop poles, 141 benches, 30 bike racks.
8. **Far city**, **graph**, **transit** and **places**: as in §4. Superblocks over 4,000 u² get per-building boxes; this fixed one giant prism across the Mission Bay waterfront.

## 7. Evidence

- **Tests.**
  - `opus-bay-sf-geo`:
    - project/unproject bit-identical to district.ts (240 points);
    - the terrain curve reproduces the §2.2 table and inverts;
    - building-height anchors;
    - grid helpers;
    - warp exact at the anchor, zero far away, invertible.
  - `opus-bay-sf-format`:
    - chunk round trip within quantisation, with byte-identical re-encode;
    - version mismatch, byte-length mismatch, truncation, bad magic, section-length lie and out-of-range writes all rejected;
    - gzip → DecompressionStream → decode in node;
    - far and graph round trip;
    - districtHash.
  - `opus-bay-sf-data`:
    - manifest geo, districtHash and heroDropLots valid;
    - 190 land chunks, sha256 and size budgets;
    - every chunk decodes, DEM seams equal, 57,480 buildings;
    - no city building in hero ground or touching a kept hero lot;
    - every non-hero, non-bridge, non-lake place stands on land or a pier in the published chunks; planner ids exist;
    - graph from the ferry gate reaches ≥ 90 % of nodes, including Twin Peaks, Ocean Beach, Fort Point, Mission Dolores, Coit and Bernal;
    - transit lengths, stops and turntables; far has 41 zones and street names.
- **Screenshots viewed** (from the Python decoder of the built files). All are in `opus-qa/sf-build/20260926T114537Z/` unless the path says otherwise:
  - `preview.png`: 0.6 px/u, buildings by style, roads by class, areas, slab outline and chunk grid.
  - Crops: `preview-downtown-chinatown.png`, `preview-alamo-square.png`, `preview-sunset-ggpark.png`, `preview-mission.png`, `preview-seam-east.png`, `preview-seam-west.png`, `preview-far.png`.
  - Merge debugging: `opus-qa/sf-build/merge-{sunset,noe,richmond}.png`.
- **What the previews showed and what I fixed.** Golden Gate Park's lakes and paths, Victorian rows, Chinatown, downtown towers, SoMa brick, the Sunset grid and the N/L/J/F lines all read correctly. The previews also caught problems, all fixed:
  - Daly City, Brisbane and Marin roads outside the county;
  - a Bay Bridge deck left in the chunks;
  - Angel Island and Alameda slivers;
  - Sutro Tower and the Bay Bridge piers as 49 u and 28 u boxes;
  - a giant far prism;
  - places standing in water or in the Sutro Baths pools.
- **Height histogram.**

| real height | buildings |
|---|---|
| < 6 m | 9,307 |
| 6–10 m | 36,417 |
| 10–15 m | 9,583 |
| 15–25 m | 1,387 |
| 25–50 m | 571 |
| 50–100 m | 164 |
| 100–200 m | 49 |
| ≥ 200 m | 2 |

| toy H | buildings |
|---|---|
| 3.6–4.5 u | 36,957 |
| 4.5–5 u | 14,419 |
| 5–6 u | 4,700 |
| 6–8 u | 887 |
| 8–12 u | 352 |
| 12–20 u | 128 |
| 20–35 u | 35 |
| 35–60 u | 2 |

- **Tallest non-hero buildings:**
  - 181 Fremont, 244 m → 41.1 u
  - 555 California, 226 m → 38.2 u
  - Millennium Tower, 197 m → 33.7 u
  - Chevron Tower, 175 m → 30.3 u
  - 44 Montgomery, 172 m → 29.9 u
  - One Sansome, 171 m → 29.7 u
  - First Market Tower, 169 m → 29.4 u
  - McKesson Plaza, 161 m → 28.2 u
  - 706 Mission, 160 m → 28.0 u
  - One Montgomery Tower, 152 m → 26.8 u
  - …Fox Plaza, 126 m → 22.7 u

  The full top 30 is in `report.json` → `tallestNonHero`.

## 8. Budgets (all pass, from `report.json`)

| budget | measured | limit |
|---|---|---|
| chunk gzip, max | 35,229 B (`-1_1`) | 40 KB |
| chunk gzip, mean | 17,203 B | 22 KB |
| total gzip | 3.96 MB: chunks 3.34 MB, far 202 KB, graph 340 KB, JSON ≈ 79 KB | 5 MB |
| far L2 | 67,403 triangles | 70k |
| toy buildings | 57,480 | 60k |
| L0 cell estimate | max 13,170 (cell 0_12), p95 12,274 | 14k |

- The L0 estimate uses today's recipe costs plus 3,500 for ground.
- Chunks: 194 files, of which 190 have land, 84 are shore and 8 touch the hero.
- Build time: land 3 s, terrain 1 s, roads 3 s, buildings 35 s (most of it the raster unions), the rest about 7 s.

## 9. Known gaps

- **West seam:** a 16 u straight edge where city land meets hero water (§6.2). The east seam is continuous; see `preview-seam-east.png`.
- **Chunk content inside the slab.** Chunks that touch the hero still carry city land rings, real OSM street runs and graph nodes there. The runtime must mask the city inside SLAB (plan §5.1). Buildings and props inside the slab are already filtered, except seam-block buildings.
- **Freeway decks:** ramps are approximate (24 u fades); joints between elevated and at-grade parts can still step. Deck heights come from a clearance rule, not from real deck elevations.
- **Pier sheds** that the OSM coastline includes as land (south waterfront) get zone or height styles, such as office, instead of `pier`.
- **More buildings than planned:** 57.5k against the plan's ~45k. About 28.7k are single lots (detached houses, offset lots) that the rules above do not merge.
- **places.json** is 323 KB raw (55 KB gzip) against the ~60 KB guess. POI zh names come only from OSM `name:zh*` (converted to Simplified); otherwise zh = en. Street names are English only.
- **Tree species mapping is coarse.** OSM `natural=tree` nodes are not in our layers, so all street trees come from DataSF.
- **v1 was republished during QA** (3 times, before this hand-off and before any consumer). From now on it is immutable: fixes go to v2 via publish.ts.

## 10. Requests for other lanes

- **Integrator / lead:**
  - `data/district.ts` could import `project`/`unproject` from `core/geo.ts` to remove the duplicate; the test guards equality meanwhile.
  - Add `public/opus-bay/sf` to the STATUS asset table: 4.6 MB on disk, 3.96 MB gzip, streamed.
  - After any new sf version is published, touch `vite.opus.config.ts` (see §1).
- **Lane B (terrain / nav):**
  - Rasterise `areas` in file order: sea by default, then land, then lakes. Hole rings apply to landcover only.
  - Flatten road corridors to the per-vertex y with half-width `width/2`. Treat `deckOnly`/`noWalk` roads as not walkable. tram and rail entries are not corridors; they lie inside streets.
  - Look `manifest.maxOverhang` (20.7 u) into neighbouring chunks for blockers.
  - Graph nodes flagged `hero` are real streets the hero treats as non-walkable: route inside the slab with the hero grid A*.
  - Pier decks are at y 0.
- **Lane C (world):**
  - Recipe hints are in `STYLES` (§3). Tint with `manifest.palettes[palette]` and jitter ×0.94–1.06 by osmId.
  - Far prisms carry averaged sRGB wall and roof colours.
  - Mask city ground, roads and land rings inside SLAB.
  - Draw a seawall along the west slab edge from (−218.7, 63.9) to (−205.4, 73.6).
  - The L0 estimate assumes today's recipe triangle counts; if TypedBatch recipes cost more, tell me and I will lower `MAX_VERTS` or the frontage.
- **Lane D (landmarks):**
  - These are removed from the building data; build them yourself: Sutro Tower, the GGB towers and deck, the Bay Bridge piers, freeway decks over water.
  - Other landmark buildings stay in with `BUILDING_FLAG.landmark` and their `osmId`; hide the ones you replace.
  - Hero landmarks (Transamerica, Salesforce, the Ferry Building, Coit, Embarcadero Center, the Exploratorium, Pier 39) are excluded.
  - `far.landmarks` has L2 proxies for all 69.
- **Lane F (transit):**
  - Splice `transit.json` paths with the hero inside `heroSpans`; the F-line runs in the hero from 24.4 to 503.2 u. The California line starts at Drumm inside the slab (0–71.8), and Powell–Mason ends inside it (335–345.5).
  - Stop names are OSM English (zh = en unless OSM has `name:zh`).
- **Lane G (flow / UI):**
  - Zones are `far.zones` plus `far.zoneGrid`, with zh names.
  - `places.json` entries with `hero` duplicate district content: merge or skip them.
  - Use `unprojectCity` for Maps links.
  - `plannerId`/`guideSlug` are set only for the 7 catalog ids above.
