# SF research · opus-arch — scaling audit of Opus Bay for a whole-San-Francisco world

Scope: our code in `C:/Users/willy/baylink-opus/src/opus-bay/**` (read-only audit, 2026-09-26). Paths below are relative to `src/opus-bay/` unless they start with `tests/` or `GTA_SZ/`. Numbers marked "measured" come from tsx probes run on this machine (Node 24, no GPU, DOM canvas stubbed); "est." marks estimates.

## 0. Summary

- Today everything is sized for **one 490 × 218 u slab** (not ±400 u: `data/district.ts:409-412` spans x −246…244, z −104…114). Five structures are **one global array over the slab bbox**: the 0.5 u terrain rasters, the 0.75 u nav grid, the two R8 distance textures, the blocker list and the merged world batches. At whole-SF size (≈ 2,860 × 2,860 u bbox under our −46° rotation), each of them grows 60–75×. None of them can stay global.
- **Keep the hero unchanged.** Put it behind a world-mode flag (`district` | `city`). Every existing test keeps checking district mode. The city is a separate, lazily streamed layer that registers with `core/terrain.ts` through a provider interface. `terrain.ts` must never import city code.
- **Streaming unit: 128 u data chunks.** Each chunk is split into 64 u render cells with three LOD tiers: L0 toy detail ≤ 150 u, L1 massing ≤ 520 u, L2 whole-city silhouettes always on. Geometry is built in a Web Worker from compact binary data into typed arrays. No per-lot geometry is ever downloaded.
- **Navigation:** windowed A* (a 384 u window at 0.75 u cells) for short trips, plus a street graph for long trips. `findPath()` keeps its signature.
- **The seam** between hero and city is handled by four rules: street-block ownership, a 40 u terrain blend outside the slab, a tapered waterfront warp that continues the hero's 18.4 u seaward shift, and surface precedence (hero first, city streets as fallback). The Embarcadero roadway stays a barrier; you cross it at crosswalks.
- **Diorama at city scale:** SF is one model on the table. Straight strata cut at the Daly City line, glassy water cuts in the Pacific and the Bay, satellite boards for Marin and the East Bay, and a fog bank rolling through the Golden Gate.

## 1. Measured baseline

| item | value | where |
|---|---|---|
| district module load (239 lots, 257 props, 38 anchors, 10 zones generated) | 38.7 ms | `data/district.ts` |
| terrain grid 984 × 440 = 432,960 cells @ 0.5 u (3.03 MB) | build 24.0 ms + stand 16.6 ms | `core/terrain.ts:118-191, 195-214` |
| blockers | 425 (list build 0.2 ms), 4 u hash | `core/terrain.ts:286-300, 303-354` |
| nav grid 656 × 294 = 192,864 cells @ 0.75 u, 11,435 open | 3.2 ms | `core/terrain.ts:458-473`, `actors/nav.ts:12-19` |
| A* ferry-gate → sea-lion-viewpoint / → coit-view / pier39 → coit-summit | 7.5 / 5.0 / 1.5 ms; 7,349 / 8,377 / 5,581 expansions; 374 / 285 / 252 u | `actors/nav.ts:141-200` |
| `zoneAt` ×1,000 · `blockersNear` ×10,000 | 0.46 ms · 2.7 ms | `core/terrain.ts:476`, `:367` |
| World constructor | 515–584 ms cold; 375,899 verts, 232,511 static tris, 62 chunks, 113 objects, 21.1 MB vertex/index buffers | `world/world.ts:75-177` |
| JS heap during World build | retained +11 MB after GC; sampled heapUsed peak 216–224 MB (includes garbage from `number[]` batches) | `world/builder.ts:117-123, 314-326, 333-372` |
| build parts (warm) | ground 46 ms (57.4k tris), city 11 ms (16.6k tris ≈ 69 tris/lot), props 39 ms (49.5k tris), backdrop 42 ms (41.4k), landmarks 3 ms, shore dist-tex 12 ms, building dist-tex 16 ms | `world/*.ts` |
| synthetic dense SF chunk (128 × 128 u, 384 lots, today's `building()` recipes) | 22,272 tris (58 tris/lot), 45,312 verts, 15–40 ms, 2.5 MB GPU | `world/city.ts:95-197` |
| live (STATUS.md) | 52–64 draw calls, 144–223k tris, 264 objects, 49–60 fps at 4× throttle; `GameRoot` chunk 198.6 kB gz | `STATUS.md` |

## 2. San Francisco in our projection

We keep `project()` exactly as it is: K = 0.14 u/m, rotation 46°, origin 37.802338, −122.40001 (`data/district.ts:43-57`). 1 km = 140 u; SF land ≈ 121 km² ≈ 2.37 M u².

| place | world (x, z) | place | world (x, z) |
|---|---|---|---|
| Ferry Building | 130, 18 | GGB south tower / north tower | −759, 597 / −942, 435 |
| Coit Tower | −50, 51 | Alcatraz (real) | −468, −58 (backdrop today: −292, −34) |
| Pier 39 (unshifted) | −155, 18 | Yerba Buena I. (real) | 203, −403 (backdrop today: 214, −236) |
| Chinatown gate / Union Sq | 80, 176 / 96, 220 | Treasure Island N | −57, −569 |
| Russian Hill summit | −98, 187 | Twin Peaks / Sutro Tower | 126, 938 / 73, 974 |
| City Hall / Painted Ladies | 91, 419 / 9, 570 | Lands End / Cliff House | −720, 1239 / −710, 1266 |
| Castro / Mission Dolores | 162, 755 / 242, 695 | SW city limit at coast | 169, 1926 |
| Oracle Park / Chase Center | 356, 160 / 488, 260 | Hunters Pt / Candlestick | 1207, 429 / 1213, 846 |

- **Extent.** The landmark bbox is x −942…1213, z −569…1926 (2,155 × 2,495 u). The lat/lng rectangle 37.705–37.835 × −122.52…−122.355 becomes a diamond spanning x −1,390…1,469 and z −750…2,109. Under the rotation, about half of any axis-aligned global grid would be empty table.
- **Vertical scale.** The hero already uses 0.17–0.24 u/m:
  - Salesforce: 56.5 u for 326 m (`world/landmarks.ts:255`)
  - Transamerica: 47.5 u for 260 m (`:203,232`)
  - Telegraph Hill: 20 u for 84 m (`data/district.ts:352`)

  A city DEM at **V = 0.20 u/m** puts Twin Peaks at ≈ 56 u and the top of Sutro Tower at ≈ 111 u. The steepest SF street (31.5 %) becomes 45 % (24°), which is still walkable under `MAX_RISE` 0.55 per 0.18 u substep (`actors/controller.ts:37,39`).
- **Walking times.** End-to-end across SF (≈ 1,600 u) takes 381 s walking and 213 s running (`actors/controller.ts:18-19`). The city is "small but whole".
- **Comparison.** GTA_SZ is at 0.6 scale: 16,076 buildings, 12,202 roads, a 42,829-node nav graph, extent ±6,788 × ±2,605 m (`GTA_SZ/public/city/city.json` meta, `navigation.json`), and it ships 340 MB of city assets. We must stay about 100× lighter (≤ 4 MB gz) by generating toy geometry from compact data.

## 3. What breaks at city scale (assumption audit)

| # | area | code | today's assumption | at whole-SF scale |
|---|---|---|---|---|
| 1 | terrain rasters | `core/terrain.ts:56,118-191` | one 0.5 u grid over the slab bbox; build temporaries `rampDist/rampH/rampHalf/rampSurf` (13 B/cell, `:153-156`) | 5,720² = 32.7 M cells → 229 MB + 425 MB temporaries, ≈ 3 s build. Must be per-chunk, resident-only. |
| 2 | height lookup | `core/terrain.ts:237-248` | clamps outside the grid to edge values (`:242-243`) | outside the hero it must route to a city provider before clamping |
| 3 | module singletons | `core/terrain.ts:112-114,193` | `GRID`/`HASH`/`BLOCKERS`/`STAND_READY` built lazily from `DISTRICT` | city mode needs a hero-lot filter set before the first query, and chunk grids with their own lifetimes |
| 4 | blockers | `core/terrain.ts:286-300,303-354` | global `Blocker[]` of `{x,z}` objects, `Map` buckets of 4 u (key range ±16k u, `:326`) | ≈ 43k toy lots (est.) as JS objects ≈ 15–20 MB; needs per-chunk typed CSR hashes |
| 5 | standable / nearest | `core/terrain.ts:195-214,423-443` | stand grid computed for the whole slab | per chunk; `nearestWalkable` must search across chunk borders |
| 6 | nav A* | `actors/nav.ts:12-19,88-95,141-200` | one grid over the whole slab; buffers sized n = cols·rows (16 B/cell) | 3,813² = 14.5 M cells → 233 MB of A* buffers; a 300 u city trip nears `MAX_EXPANSIONS` 90k (`:13`) |
| 7 | "inside the model" | `core/terrain.ts:274` `inSlab` | used by the edge bump (`actors/controller.ts:421-424`), camera floors (`actors/camera.ts:993,1004,1011`), ground picker (`actors/system.ts:87-88`) | must become `inWorld()` = hero slab ∪ city model |
| 8 | ground picking | `actors/system.ts:77-104` | ray march starts at y = 28 (`:80`), `tMax` +1,400, 900 steps | Twin Peaks is 56 u: clicks on upper slopes are lost. Use an exported `MAX_GROUND_Y`. |
| 9 | world build | `world/world.ts:75-177,305-311` | everything built once into 4 batches, split into 150 u chunks (`:31`) | ≈ 50× the geometry; must be streamed |
| 10 | batch memory | `world/builder.ts:117-123,314-326,333-372` | `number[]` attributes, 52 B/vertex, string-keyed split | peak heap ≈ 220 MB for 376k verts today; needs a typed, compact batch built in a worker |
| 11 | water | `world/world.ts:93-100`, `world/water.ts:372-373` | 3.5 u vertex-waved grid over the slab + skirt | ≈ 5.8 M u² of water → ≈ 470k verts. Needs a camera-centred clipmap + flat far tiles. |
| 12 | distance textures | `world/water.ts:59-71,87-112`; `world/materials.ts:26-28` | shore and building-contact R8 textures at terrain resolution, one global `uBDist` | 5,720² exceeds mobile `MAX_TEXTURE_SIZE` 4096. Use per-chunk ground AO plus a 2 u global shore texture. |
| 13 | table, sky, far plane, fog | `world/environment.ts:12,16,158,160`; `game/GameRoot.tsx:29`; `world/palette.ts:89-115` | table circle r 2,600 centred (0, 0), warm vignette 220–700 u; camera far 1,600; FogExp2 density 0.0011–0.0022 | the model reaches (57, 2109) and (1469, 648): move the table centre and radius, far 3,000, per-altitude fog |
| 14 | shadows | `world/environment.ts:170-171,248,278` | ±24 u (high) / ±19 u (mid) frustum follows the player; casters are actors + heroes | fine; city buildings stay non-casters with baked contact AO |
| 15 | slab edge / skirt / backdrop | `world/ground.ts:565-587,593`; `world/backdrop.ts:39-44,434-453`; `data/district.ts:1062-1075` | cut faces on every slab edge, bay-side water skirt, `skyline` board at (110, 170), compressed Alcatraz / YBI / Angel positions, Bay Bridge cut at the skirt | in city mode every hero edge is interior: skip them, move islands to real positions |
| 16 | "towards the Bay" | `actors/camera.ts:186,777`; `world/ground.ts:26-30`; `world/life.ts:921,935-936`; `actors/npcs.ts:48-53,125-140` | `stationOf`/`frameAt` along the Embarcadero spine; coarse table only for stations −60…440 (`data/district.ts:317`), extrapolated straight beyond | meaningless in the Sunset or the Mission. Needs a generic `preferredViewDir`. |
| 17 | zones | `core/terrain.ts:476-479`; `game/brain.ts:39-46`; `data/district.ts:1150-1161` | linear first match; default `embarcadero` = SLAB | outside the hero the area is `null` and `ui/Hud.tsx:34` shows "The Embarcadero". Needs neighbourhoods plus a grid index. |
| 18 | map | `ui/MapPanel.tsx:24-42,192-213` | bounds from hero walk / anchors; every lot is an SVG `<polygon>` (239) | ≈ 43k polygons. Switch to a canvas city map plus the SVG POI overlay. |
| 19 | labels | `world/labels.ts:24,62-71` | one 1024² atlas; `alloc()` never checks overflow | fills silently. Needs a second paged atlas for city signs. |
| 20 | halos / lamp pools | `world/world.ts:181-220` | one InstancedMesh each, `frustumCulled=false`, all lamps | thousands of lamps; instance them per chunk |
| 21 | ambient life | `world/life.ts:484,487-497,918-970` | 40 walkers on promenade stations 24–342, recycled within 75 u of `playerSt`; hard-coded seal spots | needs a sidewalk-lane crowd system per chunk |
| 22 | transit | `data/district.ts:1203-1206`; `world/streetcar.ts:36-37`; `game/ride.ts:49-82` | one F-line path, 3 stops, ride clamped 5–26 s | needs `TransitLine[]`: cable cars, F-line on Market, ferries |
| 23 | audio shore field | `audio/logic.ts:146-200` | "Bay north (−z), city south" column fill | SF has water on three sides; pass a land/water classifier instead |
| 24 | travel labels | `game/travel.ts:12,52` | `GAME_WALK` duplicated; `unproject` ignores `SHIFT` (18.4 u ≈ 130 m on the waterfront, `data/district.ts:84`) | use the inverse warp; import `WALK_SPEED` |
| 25 | QA / debug | `game/qa.ts:18`; `game/Systems.tsx:543-563`; `world/WorldScene.tsx:81-98` | `?at=<anchor>` only; stats have no chunk info | add `?world=city`, `?at=ll:lat,lng`, `__opusBay.city` |
| 26 | tests | `tests/opus-bay-district.test.ts:211,231,257,263`; `tests/opus-bay-world.test.ts:65`; `tests/opus-bay-actors.test.ts:48-70` | 120–260 lots, last zone `embarcadero`, `nearestWalkable({0,400},5) === null`, 200k queries < 1.5 s, A* < 400 ms | all hold only if `DISTRICT` stays unchanged and no provider is registered in tests |
| 27 | bundle | `STATUS.md` | GameRoot 198.6 kB gz against a 250 kB page budget | city data must never enter JS; city code goes in a lazy chunk |

## 4. Integration architecture

### 4.1 Two modes, hero untouched

Add `settings.worldMode: 'district' | 'city'` (`core/store.ts`) and URL `?world=city`.

In **district mode** the whole v1 behaves bit-for-bit as today. Add a regression test that pins 375,899 verts, 232,511 tris and 62 chunks.

In **city mode**, `World` still builds the hero first (the first minute is unchanged), with these differences:
- it skips `buildSlab` (`world/ground.ts:628`), the water skirt and the district water, and drops the `skyline` board;
- it moves Alcatraz, YBI and Angel Island to their real projected positions and builds the Bay Bridge from `BRIDGE_SF` (234, 36) to the real YBI;
- it filters hero lots by the block-ownership rule below;
- it then calls `world.enableCity(streamer)`.

`DISTRICT` data is never edited. City mode reads extra exports: `EXCLUDE_*` from `data/district.ts:778-788` and `SLAB`.

### 4.2 The seam (hero ⇄ generated city)

1. **Block ownership (lots).**
   - The build script splits OSM street faces into city blocks. A block is `heroKeep` when ≥ 60 % of its area lies inside `SLAB`.
   - In city mode the hero keeps only lots whose centroid lies in a `heroKeep` block. The city generator fills every other block, including the parts inside the slab, and avoids hero exclusion shapes (+0.8 u).
   - Outcome: no diagonal cut through buildings. At worst a straddling block has a garden strip, which gets trees.
2. **Terrain.**
   - Inside `SLAB` (hero `kind ≠ outside`) the hero height is authoritative: analytic Telegraph Hill, ramps, flat plazas.
   - Outside, `h = lerp(heroEdge = 0, V·dem, smoothstep(0, 40, distOutsideSlab))`.
   - The worst step is Rincon Hill / Nob Hill foothills: ≈ 6 u over 40 u (15 %).
3. **Waterfront warp.** Continue the hero's inflated waterfront. For coast features beyond the hero ends (Pier 39 west → Fisherman's Wharf; Rincon Point south → South Beach), shift points that lie seaward of a line 25 u inland of the coastline by `18.4 · (1 − smoothstep(0, 160, s))` along the local seaward normal, where `s` is the arc length along the real coastline from the hero end. This is applied offline only; runtime uses `unprojectCity()`, the inverse warp.
4. **Surfaces.**
   - `surface = hero surface if ≠ 0, else city surface` — except inside `HERO_CORE_MASK`, where the city is suppressed. The mask is the waterfront strip seaward of `SECTION.buildingLine` (−24.8, `data/district.ts:169-178`) for stations −80…460, plus the Telegraph Hill park and Levi's.
   - Hero streets become walkable through city sidewalk and street polygons. The Embarcadero roadway stays a barrier with crosswalks, exactly as today.
   - Blockers are the filtered hero list ∪ city chunk blockers.
5. **Water and foam.** One city water material samples the hero 0.5 u shore texture inside the hero box and the 2 u global texture elsewhere, so the district water mesh is not built.

### 4.3 Chunks, cells, LOD

| tier | unit | built when (high / mid / low) | content | est. tris |
|---|---|---|---|---|
| data / stream | 128 u chunk (≈ 914 m), grouped 4 × 4 in 512 u region packs | region fetched when any chunk is within 700 u | blocks, roads, areas, trees, DEM, transit, POIs | — |
| raster | 128 u chunk | ≤ 192 u (≈ 3 × 3–4 × 4) | 0.5 u height/surface/kind/stand (459 KB) + blocker CSR | — |
| L0 | 64 u cell | ≤ 150 / 120 / 90 u, drop at +40 u | toy lots (today's recipes), 2 u DEM ground with a surface/AO texture, roads, instanced trees and street furniture, halos | ≈ 9k per cell; ≈ 17 cells ≈ 150k resident, ≈ 75k visible |
| L1 | 128 u chunk | ≤ 520 / 420 / 320 u | massing boxes + roof caps (≈ 12 tris/lot), 8 u ground, no props | ≈ 80k visible |
| L2 | 512 u tile, from `far.bin` | always | one prism per block (avg height), 16 u DEM, coastline, parks, main streets, landmark silhouettes | ≈ 70k total, ≈ 30k visible |

Grid slots: cx −11…11, cz −7…16 (552). Est. ≈ 160 land chunks and ≈ 180 water-only chunks; water-only chunks carry flags only.

When the player is ≥ 300 u from the hero, the hero's detail chunks are hidden and replaced by an L1 massing of `DISTRICT.blocks`. Hero landmarks stay on.

Budgets:
- city ≤ 60 draw calls (total ≤ 150);
- total ≤ 400k tris including shadows;
- ≤ 500 Object3D;
- per frame, attach at most 1 L0 cell + 2 L1 chunks (≈ 0.5 ms upload each).

Selection re-runs only when the focus moves > 16 u or the camera yaw moves > 20°. Focus = player + 20 u along the camera forward (the GTA_SZ `sceneFocus` idea; it re-culls after 100 m, `GTA_SZ/src/city-world.ts:303,549`).

### 4.4 Build pipeline

**Offline** — `scripts/opus-city/*.ts`, run with tsx, no new deps:
- OSM via Overpass JSON: streets, coastline, parks, water, `building:levels` and heights for towers. ODbL attribution as in `data/district.ts:9`.
- DEM from USGS 3DEP 1/3″ (≈ 10 m, public domain), read with Python/PIL; fallback SRTM 1″ `.hgt`, raw int16 parsed in Node.
- Outputs to `public/opus-bay/city/`:
  - `manifest.json`;
  - `r_<rx>_<rz>.bin` region packs (est. 60–100 KB gz each, ≈ 30 files);
  - `far.bin` (L2 + 16 u DEM + coast + water mask, ≤ 350 KB gz);
  - `zones.json` (≈ 41 neighbourhoods, bilingual);
  - `graph.bin` (street graph).
- Total ≤ 4 MB gz. Nothing goes in the JS bundle.

**Runtime:** two module workers (`new Worker(new URL('./chunkWorker.ts', import.meta.url), { type: 'module' })`, no shared-config change).
- A worker decodes a region pack, rasterizes chunk grids with the same `fillPolygon` logic as today, and builds L0/L1 buffers.
- It posts transferables:
  - positions `Float32Array`;
  - normals `Int8Array` ×4 normalized;
  - colors `Uint8Array` ×4 normalized;
  - aInfo `Float32Array`;
  - index `Uint16Array` / `Uint32Array`.

  That is 28 B/vertex against 52 B today.
- The main thread only wraps the buffers in `BufferGeometry`. The 384-lot synthetic chunk took 15–40 ms, so an L0 cell is ≈ 10 ms in the worker.
- A teleport needs ≈ 12 cells ≈ 150–250 ms with 2 workers, hidden behind a 0.6–1.0 s travel transition that awaits `streamer.whenReady(p, 150)`.

### 4.5 Terrain, walkability, blockers per chunk

`core/terrain.ts` stays the single query API. Add:

```ts
export interface CityTerrain {
  heightAt(x: number, z: number): number | null;          // null = not covered (fall back to the far DEM)
  surfaceCode(x: number, z: number): number;               // 0 = not walkable
  kindAt(x: number, z: number): number;                    // KIND codes
  standAt(x: number, z: number): 0 | 1 | -1;               // -1 = chunk not resident
  forEachBlockerNear(x: number, z: number, r: number, fn: (b: Blocker) => void): void;
}
export function setCityTerrain(t: CityTerrain | null, opts?: { heroLotFilter?: (lot: BuildingLot) => boolean; heroCoreMask?: (x: number, z: number) => boolean }): void;
export function inWorld(x: number, z: number): boolean;   // replaces inSlab at the 6 call sites of §3 row 7
export let MAX_GROUND_Y: number;                          // 28 (district) / 120 (city)
```

- **Dispatch.** Every query checks "inside the hero grid bbox and `kind ≠ outside`" first. That is one compare pair, so the 200k-query test stays < 1.5 s.
- **Chunk rasters** (`core/cityTerrain.ts`): `rasterizeChunk(d: ChunkData, mask: HeroMask): ChunkRaster` is pure and runs in the worker. `CityTerrainStore implements CityTerrain` handles `put`/`drop` by key.
- **Cliffs:** slopes > 1.0 (45°) rasterize to surface 0.
- **Blockers:** per chunk, as CSR (`offsets Uint32Array(33·33)`, `items Uint16Array`, polygon coords `Float32Array`). A footprint crossing chunks is stored in each chunk it overlaps.

### 4.6 Navigation at city scale

- **`navGrid()`** keeps its type. In district mode it is exactly today's grid.
- **In city mode** it is a 384 u window at 0.75 u (512² = 262k cells, ≈ 1.3 MB grid + 4.2 MB A* buffers), sampled from the unified `standAt`. `ensureNavWindow(center: Vec2): boolean` re-centres (≈ 3–5 ms) when the player is > 96 u from the window centre.
- **`findPath(from, to, snapRadius)`** keeps its signature and stays window-local.
- **Long trips** (straight line > 150 u, or goal outside the window) use `planRoute(from, to): RoutePlan | null`: A* on `core/roadGraph.ts` (est. 10–20k intersection nodes, bucketed `nearestNode` at 32 u, < 5 ms). This replaces GTA_SZ's linear-scan `nearest` in `GTA_SZ/src/navigation.ts:4`.
- **Legs:** each leg is ≤ 60 u, and its local A* runs lazily as the walker approaches.
- **BAYBAY:** follows window paths. Her hop-in when > 60 u away (`actors/guide.ts:144`) keeps her inside the window.

### 4.7 Water, sky, fog, table

- **Water:** a camera-centred clipmap at 2 u spacing (±200 u, ≈ 40k verts, snapped to 2 u) with waves, plus flat 64 u far tiles on the same shader with waves faded by distance. Wakes stay at 6 (`world/water.ts:15`).
- **Global shore distance:** R8 at 2 u over the model bbox (≈ 1,440², 2 MB).
- **Table:** r 3,400, centre (100, 700), vignette smoothstep(1,500, 3,000).
- **Camera:** far 3,000 (near 0.5 → ≈ 0.12 u depth step at 1,000 u; fine without roads in L2).
- **Fog:** density × 0.8 when camera y > 40 (Twin Peaks reveal).
- **Board shadow canvas** (`world/environment.ts:177-224`) scales as is.

### 4.8 Map, zones, labels, life, transit, audio

- **Map.** `ui/CityMap.tsx` draws `far.bin` (blocks, parks, water, main streets) to a `<canvas>` in ≈ 10–20 ms. The existing SVG POI layer and `placeLabels` stay on top. Reveal is per visited neighbourhood, replacing the single Coit unlock.
- **Zones.** `data/cityZones.ts` provides `zoneAtCity(x, z)`: 64 u grid index → candidate polygons. `brain.ts` tries hero zones first inside `SLAB`, then neighbourhoods, then `san-francisco`.
- **HUD.** Add the nearest street name, as in `GTA_SZ/src/city-world.ts:304`.
- **Labels.** A second paged 2048² atlas for about 60 main-street signs, LRU-freed on chunk unload.
- **Crowd.** `world/city/crowd.ts`: a 64-instance pool on sidewalk lanes within 90 u, respawned out of view.
- **Traffic.** `world/city/traffic.ts`: 24 toy cars on graph lanes that yield to the player.
- **Transit.** `world/city/transit.ts`: Powell–Hyde, Powell–Mason and California cable cars, the F-line on Market, ferry exits. `game/ride.ts` gains a `lineId`; the hero F-line ride stays as it is.
- **Audio.** `buildShoreField` takes an `isLand(x, z)` classifier.
- **Hero `Life`.** Updates are skipped when the player is > 300 u from the hero bbox.

### 4.9 The diorama at city scale

SF is one big model on the cream table:
- **Land cut:** a straight strata cut along the Daly City line (`slabEdge()` reused from `world/ground.ts:487`).
- **Water cuts:** glassy edges ≈ 180 u off Ocean Beach and past Treasure Island.
- **Bay Bridge:** the east span is cut at the water edge, like today's cut at the skirt.
- **Satellite boards:** a Marin Headlands board holds the GGB north anchorage and a Sausalito peek; East Bay boards at real bearings about 1,000 u out.
- **Fog bank:** Karl the Fog as ≈ 200 soft instanced sprites along the west edge and through the Gate (one draw call). It is heaviest in the morning preset and also hides the far table edge.
- **Signature shot:** from Twin Peaks the camera lifts into a top-down view of the whole board, echoing the brand key art.

## 5. Module / file plan and ownership lanes

**Day 0 — lead publishes the contracts:**
- `city/format.ts` (types + `decodeRegion(buf: ArrayBuffer): ChunkData[]`);
- `city/constants.ts` (`CHUNK = 128`, `CELL = 64`, `DEM_STEP = 2`, `V_SCALE = 0.2`, `chunkKey`, `chunkOf`);
- the `CityTerrain` and `CityStreamer` interfaces;
- `settings.worldMode`, `runtime.city`, and `GameRoot` camera `far`.

Lanes touch disjoint files:

| lane | owns | key signatures |
|---|---|---|
| A · city-data | `scripts/opus-city/**`, `public/opus-bay/city/**`, `city/format.ts` (after day 0), `tests/opus-bay-city-data.test.ts` | `buildCity(opts): Manifest` (script); warp `W(p)` + `unprojectCity(p)` in `city/warp.ts` |
| B · terrain-nav | `core/terrain.ts` (additions only), `core/cityTerrain.ts`, `core/roadGraph.ts`, `actors/nav.ts` | §4.5–4.6 APIs; `class RoadGraph { route(a: Vec2, b: Vec2): Vec2[] }` |
| C · world-stream | `world/city/{streamer,chunkWorker,geomKit,buildCell,buildMassing,far,cityWater,cityMaterials}.ts`, `world/world.ts`, `world/WorldScene.tsx`, `world/environment.ts`, recipe extraction `world/recipes/*.ts` (from `world/city.ts`, behaviour-neutral) | `class CityStreamer { group; update(focus: Vec2, cam: THREE.Camera, dt: number): void; whenReady(p: Vec2, r: number): Promise<void>; stats(): StreamStats; dispose(): void }`; `class TypedBatch implements BatchLike` |
| D · landmarks | `world/city/landmarks/*.ts` (GGB, full Bay Bridge + TI/YBI, Alcatraz island, Sutro Tower, City Hall, Palace of Fine Arts, Painted Ladies, Lombard, Oracle Park, GGP set, Cliff House) with L0/L2 builders | `build<Name>(b: BatchLike, lod: 0 \| 2): HeroSpec` |
| E · actors-mobility | `actors/controller.ts`, `actors/camera.ts` (`preferredViewDir(x, z): number`), `actors/system.ts` (picker, `planRoute` click-to-walk), `actors/guide.ts`, new `actors/mounts.ts` (scooter 16 u/s) | — |
| F · life-audio | `world/city/{crowd,traffic,transit,fogbank}.ts`, `audio/logic.ts`, `audio/ambience.ts` | — |
| G · flow-ui | `ui/MapPanel.tsx` → `ui/CityMap.tsx`, `ui/Hud.tsx`, `game/brain.ts`, `game/ride.ts`, `game/qa.ts`, new `game/cityPlaces.ts`, `data/cityZones.ts` | `cityPlaces.ts` projects catalog places/events via `project()` + warp; today that is 7 SF places with coordinates and 23 SF events |

Conflict rule: `world/world.ts`/`WorldScene.tsx` → C only; `actors/system.ts` → E only; `core/terrain.ts` → B only.

## 6. Tests

**Must keep passing (district mode, no provider registered):**
- all of `tests/opus-bay-*.test.ts` (104 at pause), `tsc` 0 and eslint 0;
- especially `tests/opus-bay-district.test.ts:156,194,211,231,257,263`, `tests/opus-bay-world.test.ts:65` and `tests/opus-bay-actors.test.ts:48-70`.

**New tests:**
- `opus-bay-hero-regression` — district-mode World: 375,899 verts, 232,511 tris, 62 chunks, byte-hash of the terrain grid.
- `opus-bay-city-format` — encode/decode round-trip, `chunkOf`/`chunkKey`.
- `opus-bay-city-terrain` — with a synthetic provider:
  - |Δh| < 0.3 u per 0.5 u step across the seam and across chunk borders;
  - per-chunk blocker queries equal brute force;
  - hero query results identical with and without the provider.
- `opus-bay-city-nav` — window re-centre, A* across chunk borders, road-graph route + leg stitching < 20 ms for 1,000 u.
- `opus-bay-city-stream` — no thrash when oscillating ±10 u on a border; ≤ 1 L0 + 2 L1 attaches per frame; unloads dispose geometry.
- `opus-bay-city-data` — skipped when files are absent:
  - GGB towers, Coit and Ferry Building within 5 u of `project()`;
  - no city lot overlaps hero lots, walk areas or ramps;
  - Twin Peaks 50–62 u;
  - zones cover every land chunk.

## 7. Recommendations for Opus Bay (whole SF)

1. **Projection and scale.** Keep the projection untouched (0.14 u/m, 46°, origin 37.802338, −122.40001; `data/district.ts:43-57`). City vertical scale **V = 0.20 u/m**. DEM land is clamped ≥ 0.05, water stays −0.6.
2. **Model extent.** SF city limits + 180 u of water west and north + Treasure Island/YBI + 60 u, giving a bbox of about x −1,400…1,500, z −800…2,150.
   - Table r 3,400 at (100, 700) (`world/environment.ts:16,158,160`).
   - Camera far 1,600 → 3,000 (`game/GameRoot.tsx:29`).
   - Ground picker from `MAX_GROUND_Y` = 120 (`actors/system.ts:80`).
3. **LOD numbers.** Chunk 128 u / cell 64 u.
   - L0 ≤ 150 / 120 / 90 u (high / mid / low), +40 u hysteresis.
   - L1 ≤ 520 / 420 / 320 u.
   - L2 always on.
   - City ≤ 60 draw calls and ≤ 190k visible tris.
   - Streaming ≤ 2 ms/frame on the main thread; worker ≤ 25 ms per L0 cell.
4. **Terrain.** Resident 0.5 u rasters only within 192 u (≤ 16 chunks × 459 KB ≈ 7.3 MB). DEM tiles 65 × 65 `Uint16` at 2 u per chunk, plus a global 16 u DEM in `far.bin`. `heightAt` falls back to the far DEM, never to edge clamping (`core/terrain.ts:242-243`).
5. **Navigation.** Nav window 384 u / 0.75 u. Keep `MAX_EXPANSIONS` 90k (`actors/nav.ts:13`). `planRoute()` handles trips > 150 u. Keep `findPath` signatures so tests stay stable.
6. **Seam.** `heroKeep` blocks (≥ 60 % inside `SLAB`), terrain blend 40 u outside `SLAB`, waterfront warp 18.4 u tapered over 160 u, hero-core surface mask.
   - Remove these in city mode: `buildSlab`, the skirt, the district water, the `skyline` board.
   - Use real positions for Alcatraz (−468, −58) and YBI (203, −403). This changes hero telescope framing: re-check the Pier 33 and Pier 14 telescope shots and the Coit sweep (`game/flow.ts`, `game/cinema.ts`). Consider a 1.3× Alcatraz model scale.
7. **Builder.** Port `Batch` to a typed `TypedBatch` (28 B/vertex) behind a `BatchLike` interface. Extract the recipes from `world/city.ts` without changing their output. Cap L0 lots at ≈ 40 tris by dropping trim bands beyond 60 u, down from 58 today.
8. **Data.** Region packs of 512 u, ≤ 4 MB gz total. `far.bin` ≤ 350 KB gz is fetched after the title so whole-SF silhouettes appear during the arrival cinematic. City code goes in a lazy chunk ≤ 40 kB gz, the worker ≤ 70 kB gz (three core math only, no DOM). To stay under 250 kB of page JS, do the STATUS #1 split first (title, audio, panels out of `GameRoot`).
9. **Movement.** Walking crosses SF in 381 s and running in 213 s. Add a toy scooter at 16 u/s. Prefetch L0 cells up to 2 s ahead along the velocity (32 u). All fast travel (cable car, ferry, map "take me") awaits `whenReady(p, 150)` under a 0.6–1.0 s transition.
10. **Camera.** Replace the spine logic (`actors/camera.ts:186,777`) with `preferredViewDir`: hero → today's rule; city → a precomputed 16 u field toward open or low terrain or the nearest water. Register city hero points (GGB towers, Sutro, Salesforce) for `heroClear` (`actors/camera.ts:64-78`).
11. **UI.** Canvas city map, neighbourhood + street-name HUD, per-neighbourhood reveal. Zones fall back to `san-francisco`, never "The Embarcadero".
12. **QA.**
    - URL: `?world=city`, `?at=ll:<lat>,<lng>`.
    - Debug: `__opusBay.city.stats()` → `{ l0, l1, l2, queued, inflight, workerMs, gpuMB }`; add them to the `?debug=1` overlay.
    - Perf table at Ferry gate, Chinatown, Twin Peaks, Ocean Beach, the GGB south anchorage and the Mission, at 1× and 4× throttle, desktop and 390 × 844. Target ≥ 45 fps at 4×.
13. **Milestones.**
    - M0: contracts + hero regression test.
    - M1: data pipeline + L2 far city + city water/table (all of SF visible from Coit).
    - M2: rasters + L0/L1 streaming (walk anywhere).
    - M3: road graph, guide, transit, scooter.
    - M4: landmarks, crowd, traffic, map, zones.
    - M5: perf + polish.
14. **Higgsfield.** Keep bridges, towers and city fabric procedural (cheap and exact). Spend credits on a few hero props (cable car, Painted Ladies facade trim, fog-bank sprite sheet) and on new neighbourhood postcards, not on city geometry.
