# GTA_SZ city pipeline → a whole-San-Francisco plan for Opus Bay

KEY = `gta-pipeline` · research phase, nothing edited · 2026-09-26 · GTA_SZ `main` @ 73603f3 (code MIT; its assets, models and data are **not** reused).

**How to read the citations.** Bare paths (`scripts/…`, `src/…`, `public/city/…`) are in the GTA_SZ clone at `C:/Users/willy/opus-qa/ref/GTA_SZ`. Paths starting `opus:` are in `C:/Users/willy/baylink-opus`. Counts and sizes come from node/python one-liners run today. Big files were only read through their headers or with aggregate queries.

---

## 0. Summary

- **GTA_SZ bakes everything.** An OSM PBF becomes one 8.4 MB `city.json`. Shapely union and constrained Delaunay turn that into road triangles, Blender builds about 9.5 M triangles into meshopt-compressed GLBs split into 640 u tiles. The browser loads **all** of `buildings.glb` (49.8 MB) and `roads.glb` (16.8 MB) at boot and switches tiles on or off by distance. Only the near facades stream. The result is dense, but it costs 108.7 MB of GLBs.
- **Worth copying:**
  - one set of projection constants;
  - meshes named by tile, switched on by distance ring with hysteresis, and streamed one tile at a time;
  - heightfields shipped as raw typed `.bin` plus a JSON manifest, with budget asserts in the loader;
  - one composed `heightAt` chain;
  - offline clearance checks for trees and lamps;
  - landmark overrides by OSM id plus an exclusion list;
  - staged rebuilds checked by hash;
  - a rule that streaming never changes a material's shader.
- **Not worth copying:**
  - flattened roads;
  - 59 % of building heights picked at random;
  - 36.6 MB of JSON triangle lists;
  - loading whole-city GLBs at boot;
  - collision and navigation queries that scan every polygon or node.
- **For us.** At our 0.14 u/m, San Francisco is about **1,990 × 1,910 u**, or about 650 land chunks of 64 u. Ship compact binary **data** (footprints, heights, class rasters) and **generate geometry in a worker** with our existing builder style. Use 3 LOD tiers and BatchedMesh, falling back to merged meshes. Estimates:
  - boot download about 2.5 MB;
  - about 350k triangles in view (worst case about 520k);
  - about 125 draw calls with multi-draw, about 230 without.

## 1. GTA_SZ by the numbers

| item | value | source |
|---|---|---|
| projection | origin [114.025, 22.536]; x = Δlon·102850·0.6, z = Δlat·111320·0.6; same 0.6 horizontally and vertically | `scripts/prepare_driving_city.py:12-14`, `AGENTS.md` |
| play extent | x ±6,788 u, z ±2,605 u (22.6 × 8.7 km real) | `city.json` meta.extent |
| `city.json` (8.37 MB) | 12,202 roads (48,374 points), 16,076 buildings (11.3 ring points on average), 1,703 green, 312 water, 17 coast lines, 1 land polygon, 10 landmarks | inspection |
| height provenance | `osm_height` 516 · `osm_levels_estimated` 6,019 · `typology_estimate` 9,541 (**59 %**) | `city.json`; `prepare_driving_city.py:79-84` |
| building height (u) | p10 10.8 · p50 23.4 · p90 57.6 · max 232.9 | inspection |
| `buildings.glb` | 3,309,839 triangles · 882 meshes (150 tiles × 6 materials) · 49.8 MB | `asset-manifest.json`, GLB header |
| `facades.glb` → 150 facade tiles | 3,648,000 triangles; tiles 5.9 KB–704 KB, 32.1 MB total | `facade-tiles.json` |
| `roads.glb` | 2,018,043 triangles · 765 meshes (5 materials) · 16.8 MB; median 14.3k triangles per tile | GLB header |
| `terrain.glb` | 56,597 triangles · 0.6 MB | `asset-manifest.json` |
| `street-surfaces.json` | **36.6 MB** of JSON triangles: 99,621 asphalt, 140,327 pavement, 302,941 road-line | inspection |
| `navigation.json` | 42,829 nodes / 47,218 edges · 1.32 MB | inspection |
| `pedestrian-paths.json` | 36,969 segments `[x0,z0,x1,z1]` · 1.27 MB | inspection |
| `lamps.json` | 20,189 `[x,z,nx,nz]` · 0.70 MB | inspection |
| vegetation | 10,843 trees in `trees.json`; `landscape/planting.json` holds 7,933 trees, 64,010 details and 16,971 road details; 40,927 canopy trees | inspection |
| totals | 108.7 MB of GLB (`asset-manifest.totalBytes`); about 160 MB in `public/city` | `ls` |

Each building costs about 206 triangles in `buildings.glb` plus about 227 in `facades.glb`. After meshopt, that is about 15 bytes per triangle.

## 2. The offline pipeline

### 2.1 Source data and projection
- **Download.** `download_osm.py` fetches the Geofabrik Guangdong PBF with a 250 MiB cap. It checks md5 and sha256 and writes an ODbL manifest (`download_osm.py:11-13, 33-59`).
- **Extraction.** `extract_city.py` runs libosmium with a native `KeyFilter` (`:115-117`). It writes 7 layers (`:22`) and never infers a height; it tags `height_status` instead (`:42-45`). Regions are clipped per `config/regions.json`.
- **Projection is re-declared everywhere.** The runtime copy is `src/city-map-geometry.ts:19-21`. `scripts/prepare_coastal_infrastructure.py:73` hard-codes the already-multiplied factors 61710 and 66792. Lesson: export one projection module and import it everywhere.
- **Not everything is scaled.** Footprints are ×0.6, but road widths are lanes × 3.0 **unscaled** (`prepare_driving_city.py:39-42`). Cars and people are 1:1, so streets end up about 1.67× wider relative to the city. This is GTA_SZ's version of our height exaggeration.

### 2.2 Land and coast
- **Land polygon.** Polygonize the bbox boundary plus the coastlines and keep the largest face (`prepare_driving_city.py:23-25`). Clip it with a hand-drawn "mainland" polygon that excludes Hong Kong (`:28-29`).
- **Ground surfaces.** Land, park, water and sea are disjoint polygons, each triangulated with constrained Delaunay: 16,835 / 16,129 / 6,801 / 464 triangles (`prepare_city_ground.py:8-15`). Heights (`build_city_ground.py:9-17`):
  - sea at −0.25, inland water at +0.035;
  - a 4 u pavement strip and a concrete curb tube along every coast segment.
- **Seawall.** A seawall face from −1.5 to 0.16, with a rock every 9 u, but only inside one sub-rectangle (`build_coastal_infrastructure.py:59-72`).
- **Shore distance.** `coastal/shore-distance.png` is 2048×1536 over x ∈ [−10000, 10000], z ∈ [−13000, 3000], about 9.8 u/px. R is distance to the shore capped at 120; G is the water mask. It is built by iterative erosion (`prepare_coastal_infrastructure.py:49-63`).
- **Far shore.** The Copernicus 30 m DSM is sampled on a 70 u grid ×0.6, kept only outside land, giving 25,326 vertices and 48,868 triangles (`:73-89`). At runtime, `buildCoastalHorizonGeometry` welds the open outline and drops a skirt to water −1 (`src/city-coastal-horizon.ts:15`).

### 2.3 Roads
- **Filter.** Only 11 motor classes are kept (`prepare_driving_city.py:31`); `access=private/no` is dropped (`:35`). **Every grade separation, tunnels included, is flattened** (`:36-38`). Lines are simplified at 0.8 u and pieces under 3 u are dropped (`:44-45`).
- **Width.** `max(5.8, min(16, lanes·3))`, and 4.5 for `service` (`:39-42`). In the data, 4,253 service ways are 4.5 u and a 6 u width dominates.
- **Surfaces.** Each segment is buffered with flat caps and joins, and the buffers are **unioned** into asphalt. Walks are buffers of `w/2 + 2.4` on main roads or `+1.2` on minor roads, minus the asphalt (`prepare_city_streets.py:11-14`). Intersections are simply part of the union; nothing models them.
- **Markings.** Edge lines sit at ±(w/2 − .35). Lane dashes are 3.5 long every 10 u. All are unioned and clipped to asphalt "so repeated OSM ways cannot make flickering stripes" (`:23-29, 52-53`).
- **Output.** Everything is triangulated with `constrained_delaunay_triangles` and written as JSON triangles (`:54-64`).
- **Meshing.** Triangles are binned by centroid into 640 u tiles. Heights are asphalt .10, pavement .06, road-line .122, with UV = world/14 (`build_city_detail_assets.py:126-133`). Lamp poles are baked into the same tile meshes (`:134-135`). An earlier version emitted one quad per segment (`build_driving_assets.py:24-39`).
- **Lamps.** One every 42 u on both sides of main roads, if clear of the lanes (`prepare_city_streets.py:30-34`).
- **Bridges.**
  - Every non-tunnel road that crosses water for at least 8 u becomes a crossing with height 2.8 and a 70 u ramp (`prepare_coastal_infrastructure.py:20-26`).
  - The ramp is a smoothstep (`build_coastal_infrastructure.py:13-17`; at runtime `bridgeRamp`, `src/city-coastal-infrastructure.ts:6`).
  - Road triangles near a crossing are split recursively until no edge exceeds 18 u, then lifted (`build_coastal_infrastructure.py:20-29`).
  - Parapets get rails with a post every 6 u, and there is a pier every 35 u (`:38-51`).
  - `heightAt = max(base, bridge)`, but only on a road (`city-coastal-infrastructure.ts:13`).

### 2.4 Buildings
- **Filters** (`prepare_driving_city.py:71-78`):
  - centroid on land and outside any landmark exclusion radius;
  - skip roof, garage, shed, construction and `building:part`;
  - drop anything under 22 u²;
  - dedupe by rounded centroid.
- **Height** (`:79-84`):
  - the `height` tag ×0.6;
  - otherwise `levels` × 3.3 × 0.6;
  - otherwise a **random** pick from {18, 24, 30, 39, 54, 72, 96} × 0.6;
  - finally clamped to 5–290.

  Style is `office` if h > 48 or the tag is commercial or office (`:92`).
- **Pavement clearance.** Each footprint has the buffers of nearby roads (`w/2 + 2`) subtracted (`:87-88`). Anything under 20 u² is dropped and the rest simplified at 0.4 (`:89-91`).
- **Massing** (`build_driving_assets.py:8-18`, `city_mesh.py:65-69`). Each footprint gets:
  - walls with UV (length/24, h/24) and a triangulated flat roof;
  - a cornice at h…h+0.6, scaled ×1.035;
  - a setback crown up to h + max(2, .04h), scaled ×0.70;
  - a dark-glass shopfront from 0 to min(4, .25h);
  - a rooftop plant box if h > 25;
  - floor ledges every 6 u on residential buildings under 60.

  There is one mesh per tile per material, which gives the 882 meshes.
- **Facade pass** (`build_city_facades.py:25-70`):
  - a vertex-colour tint from a 3–4-colour palette per style, seeded by OSM id;
  - canopies on edges under 50 u;
  - mullions every 4 u on offices taller than 40 u;
  - balconies on 22 % of residential buildings that are 10–55 u tall.

  The near-detail meshes go to `facades.glb`, which is split into one file per tile (`split_city_facades.mjs:9-21`).
- **Compression.** gltf-transform `dedup`, `weld`, `prune` and meshopt at level high, quantizing positions to 16 bits, normals to 10 and UVs to 14 (`optimize_city.mjs:16`).

### 2.5 Terrain relief (the rest of the city is flat)
- **Lianhua Mountain** (`prepare_landmark_terrain.py`):
  - Copernicus 30 m DSM, bilinear-sampled at 15 m × 0.6 (`:92, 112-120`);
  - datum = the 25th percentile of the park-edge band (`:125-126`);
  - relief = (DSM − datum) × 0.6 × edge × road × lake smoothstep weights, using 55 m, 30 m and 20 m bands (`:139-147`);
  - interior service roads and paths are draped onto it (`:159-185`).
- **Mountains** (`prepare_city_mountains.py`):
  - the DSM is reprojected onto local grids of **36 u** (379×324) and **12 u** (1135×439) (`:22, 37-42`);
  - a 3×3 grey opening plus a σ .8 gaussian removes roofs and trees (`:43-44`);
  - relief = max(0, h − 20) × .6, blended over 180 / 90 u from reserved corridors (`:47-49`);
  - output is a raw little-endian **Float32 `.bin`** plus a manifest with 48- or 96-cell tiles and a hard assert of fewer than 260k triangles (`:72-80`).

  At runtime the mesh is built from the heights and coloured by vertex colours ("no texture, light or draw call is added", `src/city-mountains.ts:25-55`). `heightAt` interpolates on the **same triangle diagonal as the render mesh** (`:9-15`), and roads are draped by displacing their vertices (`:64-74`).
- **Lawn relief.** 419 authored mounds, with positions, normals and indices packed in one `.bin` with offsets per tile (`prepare_city_ground_relief.py:206-217`). The runtime looks up triangles in 32 u cells (`src/city-ground-relief.ts:14-35`).
- **The height chain.** Landmark detail → mountains → relief → bridges → café floor (`src/city-world.ts:250, 259-261`).

### 2.6 Vegetation and props
- **Offline clearance.** Trees closer than (4.4 for palms / 4.1 for broadleaf) × scale + 1 to any lane are removed, which cut 22,875 trees to 10,843 (`prepare_city_streets.py:67`, `street-validation.json`).
- **Runtime placement** (`src/city-landscape.ts`):
  - a 100 u spatial hash, with instance buffers rebuilt only after 22 u of movement (`:117-119`);
  - near models within 150 u, up to a per-quality cap (`:125`);
  - detail props with a 150k-triangle cap (`:135`);
  - thin instances with a colour per instance (`:141`).
- **Quality presets.** On `medium`: near trees 36, far trees 200, radius 440 (`src/city-graphics-quality.ts:6`).
- **Canopy.** 3 LODs: full under 170 u, mid under 650 (`src/city-canopy.ts:15`); radius 1,100 (`:18`). When a budget runs out, trees drop to the next LOD instead of being culled (`:102-104`).

### 2.7 Landmarks, overrides and build hygiene
- **Landmark specs.** Each spec lists its sources and uncertainty (`data/landmarks/*.json`).
- **Overrides.** Blender landmark meshes replace base meshes by name prefix and by OSM id: `landmark-detail.json` lists 8 `baseBuildingIds`, and `building-exclusions.json` lists the ids plus the hashes of the GLBs they were cut from.
- **Arrival points.** They snap to the **largest connected component** of the road graph, found with union-find (`scripts/build_landmark_details.py:32-56`).
- **Staged rebuilds.** `rebuild_city_assets.mjs` runs about 30 stages inside an isolated, timestamped copy. It writes `build-status.json`, checks source hashes, and never overwrites the live `public/city` (`:1-5, 10-25, 33-61`).
- **Loader asserts.** Loaders check budgets and byte lengths (`src/city-mountains.ts:20-22`; `src/city-coastal-infrastructure.ts:15`).

## 3. Runtime: chunking, LOD and streaming

| layer | unit | rule | source |
|---|---|---|---|
| buildings | 640 u tile × 6 materials, **all loaded at boot** | enabled while d < 3,300 | `src/city-world.ts:252-253, 435` |
| roads | 640 u tile × 5 materials, all loaded at boot | d < 2,500 | `:435` |
| facade tiles | 150 GLBs | boot loads d < 700 before play; prefetch < 1,050, **one at a time**; show < 700; dispose > 1,500; shadows < 520 | `src/city-facade-stream.ts:10, 21, 33, 37` |
| shadow casters | tile meshes | < 520 (street) / < 1,650 (aerial) | `city-world.ts:435` |
| cull cadence | — | rerun after 100 u of focus motion | `city-world.ts:549` |
| trees | 100 u cells | rebuild after 22 u | `city-landscape.ts:117` |
| distant shells | 1 mesh per 640 u tile, 1 material, windows drawn in the shader | aerial view only, and only beyond 3,300 u | `src/city-distant-city.ts:6, 66` |
| fog / camera | EXP2 .000115; near .75, far 18,000 | — | `city-world.ts:145, 148` |

- **Distant shells are generated at runtime** from `city.json` footprints by ear clipping (`src/city-distant-geometry.ts:40, 89`). The build arrays are released after upload (`city-distant-city.ts:60`).
- **The streaming stalls were shader recompiles, not download size.**
  - Any glTF load raised the light budget of about 300 materials (`src/city-gltf-streaming.ts:7-21`).
  - Toggling lights forced 73–121 program recompiles, with 0.6–1.1 s stalls.
  - The fix: a "shader-stable contract". Lights are never disabled (only their intensity changes), and material define layouts never change (`docs/性能修复-2026-09-09-着色器重编译.md`).
- **Draw calls are high.** Up to about 80 of the 150 building tiles × 6 materials, plus the road tiles, can be enabled before frustum culling. That is hundreds of meshes. The measured result is about 60 fps at 1080p on a desktop Metal GPU (`docs/性能修复-2026-09-05.md`). This is a desktop-only budget.

## 4. Collision, walkability and navigation
- **`CityCollision`** (`src/driving.ts:20-35`). A 90 u hash holds road segments and building rings. `blocked()` works like this:
  - inside the road (d < w/2 − .65): free;
  - inside a ring, or within 1.15 of an edge: blocked;
  - within a landmark radius: blocked;
  - then it **scans every land and water polygon** (`:34`), which is O(312) per call.
- **Walking** (`src/city-walk.ts:2-4, 10-13, 39-55`). Walk 1.6 u/s, run 4.2 u/s. Radius .23, tested with 8 probes. It slides along one axis at a time and allows a maximum step of .48.
- **Navigation.**
  - The road graph is noded with shapely `unary_union` and nodes rounded to 0.1 (`scripts/node_city_roads.py:4-15`).
  - Routing is Dijkstra with a binary heap, and routes are densified every 20 u (`src/navigation.ts:7-17`).
  - `nearest()` and `nearestEdge()` are **linear scans** over 42k nodes (`:5-6`).
- **Pedestrians.**
  - Sidewalk seeds sit at `w/2 + 1.15`, are cut where they come within .45 of a lane, and must be longer than 8 u (`prepare_city_streets.py:36-44`). Coast promenades are added (`:46-51`).
  - At runtime, walkers are placed on segments within 330 u, at most 56, walking back and forth (`src/pedestrians.ts:28-33`).

## 5. Lessons to carry over
The copy / avoid lists in §0 are the lessons; §6 applies each of them.

---

## 6. Recommendations for Opus Bay (whole SF)

### 6.1 Scale, projection and size rules
- **Keep the projection.** Keep `K = 0.14`, `ROT = 46°` and the origin (`opus:src/opus-bay/data/district.ts:43-66`). Move them, with `project()`/`unproject()` and the height rules below, into a new `data/projection.ts` that both the runtime and the build scripts import.
- **Extents.** Projected with our `project()`:

  | place | world (x, z) |
  |---|---|
  | Lands End | (−714, 1243) |
  | Ocean Beach, south end | (168, 1925) |
  | SE county line | (1105, 955) |
  | Hunters Point | (1240, 461) |
  | Fort Point | (−751, 593) |
  | Ferry Building | (130, 18) |
  | Twin Peaks | (126, 938) |
  | Golden Gate mid-span | (−865, 505) |
  | Treasure Island | (16, −488) |

  The land bbox is x −751…1240, z 18…1925, about **1,990 × 1,910 u**, which is 32 × 30 chunks of 64 u. SF's 121.5 km² of land is about 2.38 M u², so about 580 chunks are fully land and about 650 including shore. A slab of about x −950…1350, z −550…2050 includes the Golden Gate, Alcatraz and Treasure Island. Today's slab is x −246…244, z −104…114 (`district.ts:409-412`).
- **Travel time.** Ferry Building → west end of Golden Gate Park is about 1,500 u: about 6 min walking at 4.2 u/s, 3.3 min running at 7.5 u/s. Running crosses a 64 u chunk in 8.5 s.
- **Terrain height.** Use
  `y = 0.245·h′ − 0.00017·max(0, h′ − 60)²`, where `h′ = max(0, DEM − 2.5 m)`.

  | place | real height | world height |
  |---|---|---|
  | Telegraph Hill | 84 m | 19.9 u (matches `SUMMIT_HEIGHT = 20`, `district.ts:352`) |
  | Nob Hill | 115 m | 27.1 u |
  | Twin Peaks (DEM) | 277.6 m | 59.5 u |

  Slopes are exaggerated about 1.75× near the water and about 1.23× at the peaks. A 31 % street grade becomes about 55 % (29°) and stays walkable, while Twin Peaks does not turn into a 67 u wall. The curve keeps rising until h′ ≈ 780 m.
- **Building height.** `H = 3.2 + 0.155·h` (h from the OSM `height` tag, in m). It reproduces today's hand-tuned values:

  | building | real height | H | today |
  |---|---|---|---|
  | Victorian | 10–12 m | 4.8–5.1 u | 4.2–6.4 (`district.ts:870`) |
  | office | 60–120 m | 12.5–21.8 u | 10–22 (`:873`) |
  | Transamerica | 260 m | 43.5 u | 41 (`world/landmarks.ts:203`) |
  | Salesforce | 326 m | 53.7 u | 56.5 (`:255`) |

  Base = the lowest ground under the footprint, with a 0.3 u skirt below.
- **Lot merging (new; needed only at our scale).** A 25 × 100 ft SF lot is 1.07 × 4.3 u, a sliver. Today's toy houses are about 4.6 u wide (`district.ts:894`, `la/4.6`). Offline, merge footprints that share a wall along a block face until the frontage is at least 3.5 u (cap 6 u). Use the area-weighted height, remove the shared walls, and keep one colour band per original lot in `aInfo`. Expect 160k buildings to become about 45–55k toy buildings.
- **Street widths are in world units, not ×0.14.** This is the same trick as GTA_SZ's lane widths.

  | class | right-of-way (u) |
  |---|---|
  | residential | 3.6 (= today's `HALF_STREET` × 2, `district.ts:882`) |
  | secondary | 4.4 |
  | primary, Market, Van Ness | 5.6 |
  | alley / service | 2.0 |
  | footway / steps | ≥ 1.2 (2 × `STAND_RADIUS` 0.45 plus margin) |

  Where streets are wider than the real gap, carve building footprints by the right-of-way buffer, as `prepare_driving_city.py:87-88` does. The whole street corridor is walkable; toy cars yield. **Freeways** (I-80 / US-101 / I-280) are either visual-only elevated decks on pillars or left out. Never flatten grade separation into walkable ground.

### 6.2 Sources (checked today)
- **OpenStreetMap** via Overpass, `osm_base` 2026-09-26T08:54Z, San Francisco county area (Wikidata Q62). Licence ODbL, the same as the current district.
  - 160,648 building ways plus 939 relations. **139,816 building ways carry `height`** (87 %; GTA_SZ had 3 %). 3,108 have `building:levels`.
  - 65,728 highway ways:

    | class | ways |
    |---|---|
    | primary | 1,655 |
    | secondary | 2,470 |
    | tertiary | 2,225 |
    | residential | 5,983 |
    | service | 8,364 |
    | footway | 38,075 |
    | **steps** | **2,620** |
    | path | 925 |
    | cycleway | 593 |
    | pedestrian | 380 |
  - 791 rail ways (tram, light rail, subway, rail).
  - 321 parks.
  - 10,779 `natural=tree` nodes.
- **Elevation.** AWS Terrain Tiles, terrarium encoding, zoom 14, which is 7.55 m/px at SF. I decoded tile `14/2619/6333` with `h = R·256 + G + B/256 − 32768`: the maximum is 277.6 m at 37.7534, −122.4474 (Twin Peaks). About 36 tiles, about 3 MB. It needs attribution; confirm the dataset's attribution list before shipping.
- **DataSF Building Footprints** (PDDL) has LiDAR fields `gnd_min_m`, `hgt_median_m` and `peak_1st_m`, which are useful to cross-check heights and per-building ground level.
  - The CSV export `/api/views/ynuv-fyni/rows.csv?accessType=DOWNLOAD` works.
  - The SODA `/resource` endpoint returned 403 from this machine.
- **DataSF Street Tree Inventory** (`tkzw-k3nq`, PDDL) has lat/lng and species, for placing street trees.

### 6.3 Offline build: a node script, no new dependencies
This goes in `scripts/sf/`. The `.ts` file runs with `npx tsx`, as the tests already do.
1. **`fetch-osm.mjs`.** Run Overpass queries with `out geom` and write `data-src/sf/osm-{buildings,highways,landuse,water,rail,poi}.json`. Record `osm_base`.
2. **`fetch-dem.mjs`.** Download the terrarium tiles and write `data-src/sf/dem.f32` plus a small grid header. PNG decoding is `zlib.inflateSync` plus about 60 lines of row unfiltering; alternatively use Python with PIL, which is installed.
3. **`build-sf.ts`** imports `data/projection.ts` and a shared `world/sf/chunkFormat.ts`, so the reader and writer cannot drift apart. Steps:
   1. **Mask the handcrafted district.** Take a mask polygon around the handcrafted Embarcadero (the `DISTRICT.slab` area) and drop generated content inside it. Blend heights across an 8 u band, like the smoothstep edge blend in `prepare_landmark_terrain.py:139-147`.
   2. **Heights.** Sample the DEM onto a **1 u** grid, apply the datum and `y(h)`, and blur lightly (3×3). 3DEP-based terrain is already bare-earth, so the DSM "opening" step is not needed.
   3. **Road corridors.** Flatten each road across its width: height across the road equals the height of the smoothed centreline profile, with a 1.5 u smoothstep blend into the ground outside. Add +0.1 for curbs and sidewalks.
   4. **Class raster.** Rasterize by distance field at **0.25 u**: for each texel, find the nearest centreline in an 8 u hash and choose road, sidewalk, curb, crosswalk, rail or stairs from the distance and class. Unions and intersections come for free, which replaces Shapely union + constrained Delaunay (`prepare_city_streets.py:11-60`). Parks, water and sand use the scanline `fillPolygon` from `opus:core/terrain.ts:91`.
   5. **Buildings.** Filter, merge lots, apply `H(h)`, and pick a style from the OSM tag, the height and a per-neighbourhood table (DataSF Analysis Neighborhoods, PDDL, can also drive the zone labels). Add a colour index and a roof type.
   6. **Props.** Street trees (DataSF plus OSM), a lamp every ~9 u on main streets, benches and hydrants. Run the lane, door and step clearance checks offline, as `prepare_city_streets.py:67` does.
   7. **LOD1 and LOD2** derivation (§6.5). Simplify ground meshes with `MeshoptSimplifier` from `three/examples/jsm/libs/meshopt_simplifier.module.js`. I tested it in Node 24: a 1 u chunk grid went from 8,192 to 342 triangles in 6 ms, with `LockBorder` and a 0.02 u error. Note that the target error is **relative to the mesh extent** unless you divide it by the extent or pass `ErrorAbsolute`.
   8. **Navigation graph** in CSR form (§6.8).
   9. **Report and output.** Write the manifest and a report (counts, byte sizes, triangle estimates, input hashes, ODbL and DEM attribution). **Assert the budgets.** Write into a versioned folder, `public/opus-bay/sf/v1/`: a new version is added next to the old one, never over it, as `rebuild_city_assets.mjs` does.

### 6.4 File formats
All files are binary, little-endian, and gzipped offline. A worker decompresses them with the native `DecompressionStream('gzip')`. Give them a custom extension such as `.obc` so neither Vite nor Vercel re-encodes or content-negotiates them.

**Chunk file, one per 64 u chunk (LOD0):**

| section | encoding | raw size |
|---|---|---|
| header | magic `OBC1`, version, ix, iz, flags, section table | 64 B |
| heights | uint16, 65×65 samples, y = v/500 u (0–131 u) | 8.5 KB |
| collision raster | uint8, 128×128 at 0.5 u. Bits: class (4), kind (2), stand (1), steep (1). Same meaning as `TerrainGrid`, `opus:core/terrain.ts:56-83` | 16 KB |
| surface texture | RG8, 256×256 at 0.25 u: class, orientation (paver or stripe angle) | 128 KB |
| buildings | 16 B per building: vcount u8, style u8, roof u8, colour u8, H u16 (1/100 u), baseY u16 (1/500 u), flags, id u32. Footprints as int16 xy at 1/256 u, chunk-local (±128 u) | about 4 KB (about 80 buildings) |
| props | per kind: int16 x, z; u8 rotation; u8 scale/variant | about 2 KB |
| paths, curbs, rails, steps | int16 polylines | about 3 KB |

That is about **25–35 KB gzipped per chunk**, about 18–22 MB for the whole city on the server, and at most about 1.7 MB resident at once.

**Whole-city files:**
- `manifest.json`: the chunk index, about 25 KB.
- `lod1.obc`: one oriented box per toy building (int16 cx, cz; u8 hu, hv, angle, H, style) at about 10 B each, plus 4 u heights and a 2 u class raster. About 0.8 MB gzipped.
- `lod2.obc`: about 0.6–1 MB gzipped.
- `nav.obc`: about 0.7 MB gzipped, loaded lazily.

### 6.5 LOD tiers

| tier | cell | load / drop radius | content | triangles per cell | resident | in view (est.) |
|---|---|---|---|---|---|---|
| **LOD0** | 64 u | 160 / 224 u | full toy buildings (gable/hip roofs, bay windows, stoops, shader windows via `aInfo`); ground from 1 u heights, simplified, plus the RG8 class texture; curbs; instanced props; collision data | 8–12k | ≤ 49 (7×7) | about 150k |
| **LOD1** | 128 u | 512 / 640 u | box per building with a flat or gable cap and no shared walls; ground on a 4 u grid with vertex colours | 6–10k | ≤ 64 | about 90k |
| **LOD2** | 256 u | always loaded | city mass from a 4 u raster (max-pooled building height, quantized to 1 u) greedy-meshed into boxes; individual towers ≥ 25 u; 8 u terrain; hills and forests as vertex-coloured canopy (like `city-mountains.ts:42`) | ≤ 60k for the whole city | all | about 30k |

- **Switching.** Cross-fade 0.3 s with the toy material's existing dither. Update LOD state after every **16 u** of player movement; GTA_SZ uses 100 u with 640 u tiles.
- **Why LOD2 can be coarse.** Fog is about 90 % opaque at 1,380 u in the day preset (density .0011, `opus:world/palette.ts:97`) and at 960 u in the morning preset (.0022, `:89`).
- **Why LOD2 is still needed.** The default camera shows the horizon: pitch .28 rad with FOV 42 (`opus:actors/camera.ts:26-28, 55`).
- **Far plane.** The camera's far plane of 1,600 (`opus:game/GameRoot.tsx:29`) can stay. Use a 2D map, not a 3D render, for the whole-city overview.

### 6.6 Rendering and draw calls
- **Two materials, two batches.** Keep one TOY material and one GROUND material (`opus:world/materials.ts:98, 297`). Both are `MeshStandardMaterial` with `onBeforeCompile`, which works with BatchedMesh. I checked `node_modules`: three 0.186.1 has `BatchedMesh` with `addGeometry`, `addInstance`, `setGeometryAt`, `deleteGeometry`, `optimize` and `setVisibleAt`, and it supports `WEBGL_multi_draw`.
  - A **toy pool** holds the buildings of all LODs and swaps them with `setVisibleAt`. Reserve about 1 M vertices.
  - A **ground pool** holds the LOD0 ground. It samples a `DataArrayTexture` of 256×256×49 RG8 layers (6.4 MB), with the layer id stored per vertex.
- **Fallback.** When `renderer.extensions.has('WEBGL_multi_draw')` is false, merge each chunk per material into plain meshes (today's `splitGeometry` path, `opus:world/builder.ts:333`).
- **Quantize vertices.** Today each vertex is 52 B: f32 position, normal and colour plus f32×4 info (`builder.ts:315-322`). Use normalized Int16 positions (chunk-local, with scale in the matrix), Int8 normals, Uint8 colours and Uint8 info: about 20 B, or 2.6× smaller.
- **Keep shaders stable.**
  - A fixed light rig with no lights per chunk. Night lamps stay emissive plus sprites, as today; three's program key includes `numPointLights`.
  - Every chunk shares the same material instances.
  - Call `renderer.compileAsync` once at boot.
- **Static setup.** `matrixAutoUpdate = false`. Chunks never cast shadows; the sun frustum stays at 220 u (`opus:world/environment.ts:171`).

| group | draws (multi-draw / fallback) | triangles |
|---|---|---|
| toy pool (LOD0/1/2 buildings, curbs, rails, stairs) | 1 / ≤ 90 | ≤ 280k |
| ground pool (LOD0) | 1 / ≤ 25 | ≤ 50k |
| hero landmarks (existing plus new) | ≤ 25 | ≤ 60k |
| instanced props, trees, toy cars | ≤ 20 | ≤ 60k |
| actors, NPCs, wildlife | ≤ 35 | ≤ 40k |
| water, sky, slab, table, FX, labels | ≤ 20 | ≤ 20k |
| **total, typical / worst case** | **≈ 100–125 / ≈ 230** | **≈ 350k / 520k** (plus about 40k for actor and hero shadows) |

### 6.7 Streaming order and memory
1. **Boot.** Load `manifest`, `lod2` and `lod1` (≤ 1.8 MB gzipped) plus the current handcrafted district. During the 3 s arrival cinematic, load the **3×3 LOD0 chunks** around the spawn before revealing. This mirrors `facadeStream.init` waiting for everything within 700 u (`city-facade-stream.ts:10`).
2. **Priority.** Chunk distance minus 1.5 s × the player's velocity (so the look-ahead is along the walking direction), with chunks inside the frustum first.
   - 2 workers decompress and build geometry, and transfer the buffers.
   - At most **1 GPU upload per frame** (≤ 2 ms).
   - Geometry arrays are dropped after upload (like `city-distant-city.ts:60`).
3. **Hysteresis and cache.** Use the drop radii above. Keep an LRU cache of up to 8 MB of compressed chunk bytes, so walking back never re-downloads.
4. **Teleports** (map jump, streetcar, cable car, tour hop). Prefetch LOD0 within 160 u of the destination while a BAYBAY transition plays, and reveal only when the central 3×3 is ready.
5. **Bandwidth and memory.** Even running, that is at most about 7 new chunks per 8.5 s, about 30 KB/s. GPU memory is about 12 MB for LOD0, 4 MB for LOD1, 3 MB for LOD2 and 6.4 MB for the array texture, **about 26 MB** in total. The JS heap grows by about 10 MB: collision rasters for resident LOD0 chunks, plus the nav graph.

### 6.8 Collision, height and navigation
- **`heightAt`.** Bilinear on the resident chunk's 1 u uint16 grid; the rendered ground is simplified with at most 0.02 u error, which is invisible under the feet. Outside the resident chunks, fall back to the LOD1 4 u heights (camera, far NPCs).
- **Surface, kind and stand queries** read the 0.5 u byte raster in O(1), with the same API as today (`opus:core/terrain.ts:237-458`). Inside the handcrafted district, the current grid built at runtime still answers (`terrain.ts:118-190`); SF chunks answer everywhere else.
- **Blockers.** Build a 4 u hash from each chunk's footprints when it loads (same as `terrain.ts:304`), and keep the polygon push-out used today (`:374`). Never scan every polygon (GTA_SZ `driving.ts:34`).
- **Steep ground.** Set `stand = 0` where the exaggerated slope exceeds 38°. Turn the 2,620 OSM `steps` ways into `Ramp` corridors with the `stairs` surface.
- **Navigation graph.**
  - Build it offline from footways, generated sidewalks, crossings and steps. Simplify at 0.15 u and merge nodes within 0.3 u; expect about 50–80k nodes.
  - Store it as CSR: nodes f32 x, y, z; offsets u32; targets u32; cost u16 (1/100 u). About 1.7 MB raw.
  - Find the nearest node through 64 u buckets, not an O(N) scan (`navigation.ts:5`). Route with A*.
  - Snap route endpoints to the largest connected component, using the `build_landmark_details.py:32-56` trick.
  - For local avoidance, keep today's `buildNavGrid` (`terrain.ts:458`) inside the LOD0 area.
- **Ambient walkers.** Use each chunk's sidewalk polylines, capped at about 30 instanced walkers around the player (GTA_SZ: 56 within 330 u).

### 6.9 The handcrafted Embarcadero and hero landmarks
- **The district becomes an override zone**, following GTA_SZ's `baseBuildingIds` / `building-exclusions.json` pattern. The build mask removes generated content inside it, heights blend at the edge, and the zones and anchors keep working. This also absorbs the district's shifted waterfront and enlarged piers.
- **New hero landmarks** each become a `LandmarkDef` plus an optional GLB (Blender or Higgsfield), listed in `sf/overrides.json` with the OSM ids they replace, a footprint and a collider (the `landmark-detail.json` model). Candidates: Golden Gate Bridge, Palace of Fine Arts, City Hall, Painted Ladies, Sutro Tower, Lombard St, Conservatory of Flowers, the Golden Gate Park windmills, Chinatown gate.

### 6.10 File-level suggestions
New files:
- `src/opus-bay/data/projection.ts`: `K`, `ROT`, origin, `project`/`unproject`, `terrainY(h)`, `buildingH(h)`, street widths. `district.ts` re-exports it.
- `scripts/sf/fetch-osm.mjs`, `scripts/sf/fetch-dem.mjs`, `scripts/sf/build-sf.ts`, which write to `public/opus-bay/sf/v1/` (`manifest.json`, `lod1.obc`, `lod2.obc`, `c/<ix>_<iz>.obc`, `nav.obc`, `ATTRIBUTION.md`, `report.json`).
- `src/opus-bay/world/sf/chunkFormat.ts`: shared reader and writer.
- `src/opus-bay/world/sf/chunk.worker.ts`: decompress and generate geometry with the builder primitives.
- `src/opus-bay/world/sf/stream.ts`: rings, priority queue, hysteresis, upload budget.
- `src/opus-bay/world/sf/pools.ts`: BatchedMesh pools with the merged-mesh fallback.

Changes to existing files:
- `core/terrain.ts`: query resident chunks outside the district mask.
- The actors' routing: graph A* for long routes.

Tests:
- `tests/opus-bay-sf-format.test.ts`: write/read round trip plus budget asserts.

### 6.11 Budgets to assert
- **In the build:** per LOD0 chunk ≤ 14k triangles and ≤ 40 KB gzipped; LOD2 ≤ 60k triangles; `lod1` + `lod2` ≤ 2 MB gzipped; nav ≤ 1 MB gzipped.
- **In the loader:** check byte lengths and version, as GTA_SZ does in `city-mountains.ts:20-22`.
- **QA:** `?debug=1` screenshots at the Ferry Building, Twin Peaks, Ocean Beach, the Mission and Chinatown. Target at least 45 fps with 4× CPU throttle and the call and triangle budgets above. This replaces DESIGN §9's single-district 150-call / 400k limits (`opus:src/opus-bay/DESIGN.md:87-88`).
