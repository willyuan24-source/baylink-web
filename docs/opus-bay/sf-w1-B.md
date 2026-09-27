# Lane B report: city terrain, collision and navigation (2026-09-26, resumed run)

**Status.** Done against the brief, plus the requests addressed to lane B in the reports of lanes A (§10), E and D (§7).
- `npx tsc -p tsconfig.app.json --noEmit`: 0 errors, whole project.
- eslint on all 7 lane B files: 0 problems.
- `tests/opus-bay-*.test.ts`: **200/200 pass**. That includes the 104 original tests and lane B's 20: 13 in terrain, 7 in nav.
- The district 200k-query test still runs in about 15 ms (the limit is 1.5 s).
- The terrain grid and the hero meshes are byte-identical (hero-regression test).
- Nothing is committed.

The previous run had already done most of the core work: the rasteriser, the provider, dispatch in `core/terrain`, the nav window, the graph and time-sliced A*. This run added:
- landmark decks on a `'terrain'` base, resolved and re-stamped by the provider (`setLandmarkBase`);
- `groundRaster`, so the renderer can draw the same ground the player walks on;
- pier decks at y 0.06;
- the renderer's sink inside landmark exclusions (`sink`);
- landmark decks exempt from the steepness rule (Lombard);
- component-aware routing (backyard pockets, isolated trail networks) and `arrivalSpot`;
- 6 new tests, a whole-city scan and two live checks.

## 1. Files

| file | status |
|---|---|
| `src/opus-bay/core/sfTerrain.ts` | New. Rasteriser, `groundRaster`, and the provider (`createCityTerrain`). Pure and worker-safe: no three.js, no DOM. |
| `src/opus-bay/core/terrain.ts` | Additions only: `CityTerrain`, `setCityTerrain`, city dispatch in every query, `standAt`, `fillCityNavGrid`, `cityTerrain`/`cityEpoch`/`cityChunkEpoch`, and `Blocker.top`. District mode is one `CITY !== null` check. |
| `src/opus-bay/core/walkGraph.ts` | New. `WalkGraphIndex` (32 u buckets, connected components), `RouteSearch` (resumable A*), sync and async search, `splitLegs`, `loadWalkGraph`. |
| `src/opus-bay/actors/nav.ts` | City window A* (384 u), component snapping, `arrivalSpot`, `routeTo`, `RouteWalker`. The district path is unchanged. |
| `tests/opus-bay-sf-terrain.test.ts` | 13 tests. |
| `tests/opus-bay-sf-nav.test.ts` | 7 tests. |
| `tests/opus-bay-sf-disk.ts` | Node helper that loads the published data from disk, for tests and QA. |

## 2. How it works

**Rasters (`rasterizeChunk`, run in lane C's worker).** Each 128 u chunk becomes 0.5 u rasters on the same lattice as the hero grid:
- `h`: corner heights, 257², u16 = (y + 4)·500;
- `surf`: surface code; `kind`: `KIND`; `stand`: `STAND_BIT` | `BLOCK_BIT`;
- a 4 u CSR blocker hash of the chunk's own footprints, carrying `top` (world y of the wall top).

The height model:
- the chunk DEM, bilinear;
- pier decks raised to `PIER_DECK_Y` (0.06), where lane C draws them;
- every walkable corridor pulls the ground to its centreline y. Nearby corridors are averaged, weighted by coverage, so junctions become small plateaus and never steps. The pull is full inside the half width and fades over 1.5 u.

Surfaces:
- vehicle roads are `road`, with a `CURB_BAND` of `pavement` on corridors 3 u or wider;
- steps are `stairs`, pedestrian ways `plaza`, footways `pavement`, paths `dirt`;
- park, grass, golf and pitches are `grass`; forest, scrub and rock are `dirt`; sand is `sand`; piers are `wood`;
- `deckOnly`, tram and rail are ignored;
- `noWalk` roads are barriers unless they are bridges.

Ground steeper than 0.9 is not walkable, except stairs and landmark decks. Water is never walkable.

**Landmarks.** Landmark walk data is transformed from local space with lane D's convention.
- Buildings whose centroid is inside `exclude` are dropped.
- Surfaces are painted last to first, so the first listed surface wins where they overlap. Blockers win over decks.
- Numeric decks on a numeric base are stamped in the worker.
- Numeric decks on a `'terrain'` base (`deferredLandmark`, currently only the cable-car turntable) are stamped by the provider.
- The provider takes the base, in priority order, from:
  1. `setLandmarkBase` (the renderer's value);
  2. the renderer's own rule once the centre chunk is resident: the lowest land ground within the exclusion radius, sampled every 2 u;
  3. the far-DEM estimate;
  4. the `baseY` hint.
- When the base changes, the decks are re-stamped from a snapshot of the untouched cells. The test shows the restore is exact.
- `sink` (optional) lowers the city ground inside an exclusion, as world/sf/build does for rendering.

**Provider (`createCityTerrain`).**
- It keeps the resident rasters, and on attach stamps footprints that overhang into neighbours, in either attach order.
- **Not resident:** `standAt` is −1, heights come from the far DEM, nothing is walkable.
- **Chunk slot with no file:** open water.
- Landmark blockers sit in one global hash and do not depend on residency.
- Open-water slots that carry landmark decks (the Golden Gate span) get synthesised rasters.
- `zoneAt` returns the DataSF neighbourhoods from `far.zoneGrid`.

**`core/terrain` dispatch (city mode).** On the hero slab the hero rasters answer; elsewhere the provider answers.
- Hero heights always win. The city DEM already blends from the hero edge over 40 u.
- Hero surfaces come first. Then:
  - the landward Embarcadero sidewalk;
  - crosswalks at the four stops, across the tracks and the south lanes;
  - the waterfront walk continued past both hero ends;
  - every other hero land cell outside the hero core, as `road` on street corridors and `pavement` elsewhere, unless steep or inside a kept lot.
- The Embarcadero roadway stays a barrier.
- `heroDropLots` are removed from the hero blockers.
- `setMaxGroundY(120)` is applied in city mode.

**Navigation.**
- **Local.** The district grid A* runs on a 384 u window (512² cells at 0.75 u), filled from the rasters plus the city-mode hero grid.
  - The window is rebuilt when the query leaves it, when the walker is more than 96 u off-centre, or when a chunk under it attaches or detaches (epochs).
  - Open cells are labelled into 4-connected areas lazily, once per window. A goal cut off from the start (a sealed backyard, a courtyard) moves to the nearest cell the start can reach, instead of exhausting 90k expansions.
- **Global.** `graph.obc` is indexed with 32 u nearest-node buckets and components.
  - A* is resumable (2 ms slices; the idea is credited to GTA_SZ).
  - `routeTo` snaps both ends onto one connected network: the start's own, or the main street network with a 180 u snap for trail networks.
  - Hero-flagged nodes are allowed only where a walker can stand; the Embarcadero roadway is costed ×4.
  - Routes are split into legs of at most 60 u, and `RouteWalker` refines each leg with `findPath`.
- **Arrival.** `arrivalSpot` gives the nearest standable spot within `maxDist` that belongs to an open area of at least 1,120 cells (about 630 u²).

## 3. API for other lanes (stable; this run only added names)

```ts
// core/sfTerrain.ts (worker-safe)
rasterizeChunk(chunk: ChunkData, opts?: { landmarks?: readonly LandmarkWalkInput[]; heroMask?: unknown /* ignored */ }): ChunkRasters
transferables(r: ChunkRasters): ArrayBuffer[]
groundRaster(chunk: ChunkData): GroundRaster            // NEW: heights only, identical to ChunkRasters.h without landmarks; 5.7 ms mean
rasterHeight(r: GroundRaster | ChunkRasters, x, z): number;  cornerHeight(r, i, j): number
landmarkWalkInputs(list, ground?): LandmarkWalkInput[]    // strip SfLandmark to cloneable data (keeps exclude, sink)
landmarkExcludes(list): (x, z) => boolean;  deferredLandmark(l): boolean
interface LandmarkWalkInput { id; x; z; yaw; base: 'terrain' | number; baseY?; exclude?: {r} | {poly}; sink?: number /* NEW */; walk? }
createCityTerrain(manifest: SfManifest, opts?: { landmarks?: readonly LandmarkWalkInput[] }): CityTerrainProvider
interface CityTerrainProvider extends CityTerrain {
  attach(r); detach(cx, cz); setFar(far); resident(cx, cz); hasChunk(cx, cz); rasters(cx, cz); zoneAt(x, z);
  onChange(fn): () => void; stats(): Record<string, number>;
  setLandmarkBase(id: string, y: number): boolean;   // NEW: pin a 'terrain' landmark's base to the renderer's
  landmarkBase(id: string): number | null;           // NEW
}
constants: SF_CELL 0.5, SF_N 256, SF_H_Q 500, SF_H_BIAS 4, SF_SURFACES (= SURFACE_CODES), SF_KIND (= KIND), STAND_BIT 1, BLOCK_BIT 2,
           MAX_GRADE 0.9, ROAD_BLEND 1.5, BLOCK_CELL 4, CITY_MAX_GROUND_Y 120, PIER_DECK_Y 0.06 (NEW)

// core/terrain.ts (additions)
interface CityTerrain { heightAt(x, z): number | null; surfaceCode(x, z): number; kindAt(x, z): number; standAt(x, z): 0 | 1 | -1;
  forEachBlockerNear(x, z, r, fn); hitsBlocker(x, z, r): boolean; blockedAt(x, z): boolean;
  fillGrid?(...); zoneAt?(x, z); onChange?(fn) }
setCityTerrain(t: CityTerrain | null, o?: { heroDropLots?: Set<number>; heroCore?: (x, z) => boolean }): void
cityTerrain(); cityEpoch(); cityChunkEpoch(cx, cz); standAt(x, z): 0 | 1 | -1; fillCityNavGrid(g: NavGrid)
type Blocker = { kind: 'circle'; …; top?: number } | { kind: 'polygon'; …; top?: number }   // top = wall-top world y (city buildings)
// every existing query dispatches: heightAt surfaceAt groundAt isLand isWater inWorld canStand blockersNear pushOutOfBlockers nearestWalkable zoneAt

// core/walkGraph.ts
class WalkGraphIndex { nodeCount; x(i); y(i); z(i); pos(i); isHero(i); forNodesNear(x, z, r, fn);
  nearestNode(x, z, maxDist = 60, accept?): number; component(i); componentSize(c); mainComponent() }   // components NEW
class RouteSearch { constructor(ix, from, to, { accept?, nodeCost?, maxExpansions? }); step(budgetMs = 2): boolean; nodes; cost; expanded; slices; maxSliceMs }
findGraphPath(ix, a, b, opts): GraphPath | null;  findGraphPathAsync(ix, a, b, { budgetMs?, schedule?, signal?, … }): Promise<GraphPath | null>
splitLegs(pts, legMax = 60): Vec2[][];  polylineLength(pts);  loadWalkGraph(root?, fetch?): Promise<WalkGraphIndex>
NODE_BUCKET 32, LEG_MAX 60, SLICE_MS 2

// actors/nav.ts
findPath(from, to, snapRadius = 8): PathResult | null   // unchanged signature; city: window + clamp + component snap
routeTo(from, to, opts?: AsyncRouteOptions & { graph? }): Promise<Route | null>   // Route { points, legs, length, via: 'local' | 'graph', snapped }
class RouteWalker { constructor(route); update(pos, reach = 3): Vec2[] | null; target(): Vec2 | null; leg }
arrivalSpot(p: Vec2, maxDist = 30): Vec2 | null          // NEW: never inside a sealed pocket (district: nearestWalkable)
setWalkGraph(g | promise | null); walkGraph(); graphNodeFilter(ix); graphNodeCost(ix); setNavFocus(p); navGrid(); navOpen(); lineOfSight()
NAV_CELL 0.75, NAV_WINDOW 384, NAV_RECENTRE 96, LOCAL_ROUTE 150, GRAPH_SNAP 60, HERO_BARRIER_COST 4, MIN_OPEN_AREA 1120, navWindowStats

// tests/opus-bay-sf-disk.ts (node)
sfDisk(root?) → { manifest, chunk(cx, cz), rasters(cx, cz, landmarks?), far(), graph(), graphIndex(), attachAround(city, x, z, r, lms?), attachAll(city, lms?) }
```

**One behaviour change that lane C should know about.** Numeric decks of `'terrain'`-based landmarks are no longer stamped in the worker; the provider stamps them. Lane C already calls `setLandmarkBase` through `sites.onBase` and passes `exclude`. I checked their current `sites.ts` and `stream.ts`.

## 4. Evidence

**Tests (all pass).**

`opus-bay-sf-terrain` (13 tests):
- the codes match `core/terrain`;
- district queries are unchanged after registering and then clearing a provider (fingerprint);
- rasteriser against the decoded data on 5 chunks:
  - road centrelines are `road` (> 97 %);
  - steps are `stairs` (> 78 %; the rest are inside streets or house entrances);
  - building interiors are blocked (> 99 %);
  - water is never walkable;
  - ground away from roads equals the DEM (< 0.005);
  - roads follow the centreline y (mean < 0.12);
- steep ground is not walkable;
- not resident → blocked, then attach → standable, then detach → blocked again; the far DEM gives the height meanwhile;
- the hero seam:
  - height step < 0.3 u per 0.5 u over more than 800 samples;
  - the Embarcadero is a barrier and the stop crosswalks are open;
  - kept hero lots are solid and lot 232 is open;
  - zones work on both sides;
- chunk borders: height C0 (< 0.01), no extra step (< 0.3), and overhangs stamped in either attach order;
- the Golden Gate deck at 15.2 over synthesised water slots;
- deferred turntable decks: one base across four chunks, identical rasters in both attach orders, re-pinning restores rasters exactly, the decks survive detach and re-attach;
- **every lane D deck:** 133 cells checked, 97 heights, 126 blockers solid; Lombard slices and stairs; the Twin Peaks and Cliff House terraces;
- the sink is followed by collision (City Hall, Ghirardelli);
- `groundRaster` equals the rasteriser's heights, and pier decks sit at 0.06;
- 200k city `canStand` + `heightAt` calls take **128–169 ms**.

`opus-bay-sf-nav` (7 tests):
- bucket nearest-node equals brute force (300 random points);
- Ferry → Twin Peaks, Ocean Beach and the GGB south anchorage: each route exists, stays in San Francisco, is ×1–1.5 of the straight line, uses only real edges;
- time-slicing:
  - with a 0.25 ms budget the search takes several slices and returns the same nodes as the one-shot search;
  - the async version works, and abort works;
  - the 2 ms default finishes in fewer than 30 frames with a slice under 5 ms;
- legs are at most 60 u;
- district `findPath` is unchanged;
- from the ferry gate to Market St the path goes through the crosswalk and every point on it is walkable; `routeTo` plus `RouteWalker` cross to Twin Peaks;
- **pockets:** a goal in a sealed backyard snaps out of it; `arrivalSpot` avoids pockets; a place on a trail network is routed through the street network.

**Whole-city scan** (all 194 chunks with landmarks, node):

| measure | result |
|---|---|
| attach all 194 chunks | 2.8 s |
| raster heap, all resident | 67.3 MB, about 347 KB per chunk (16 resident ≈ 5.5 MB) |
| provider patching on attach | 0.67 ms per attach |
| places that are not in the hero | 956 |
| anchor directly standable | 619 |
| anchor within 2 u of a standable spot | another 274 |
| anchor within 8 u | another 61 |
| no standable spot within 8 u | 2 (the Bay Bridge centre anchorage, Lake Merced: backdrop entries) |
| `arrivalSpot` found | **952/956**, mean 1.22 u from the anchor, max 29 u |
| `routeTo` from the ferry gate | **919 of the 952 that have a spot** |

The 33 unroutable places are all on Yerba Buena and Treasure Island: those islands are in the county, but no walkable link reaches them.

**Live checks** (`?world=city`, headless, one Chrome, screenshots viewed):
- `C:/Users/willy/opus-qa/b-city-market.png`: player and BAYBAY standing on a street at Market (170, 150), y 0.94, with streamed city around them.
- `C:/Users/willy/opus-qa/b-city-walked.png`: tap-to-walk to (210, 190) moved the player 45 u through the city by path in 9 s; W still moves the player afterwards.
- `C:/Users/willy/opus-qa/b-turntable.png`: at Powell & Market the collision base equals the render base (0.9426). The player stands at y 1.062, which is base + 0.12 on the disc deck. 13 deck stamps; no errors.
- Action files: `opus-qa/b-city-walk.json`, `opus-qa/b-turntable.json`.

## 5. Measured numbers (node 24, this machine; not browser performance)

| measure | value |
|---|---|
| `rasterizeChunk` | mean 12.7 ms, max 28.2 ms (`-1_-1`) |
| `groundRaster` | mean 5.7 ms |
| nav window build (512²) | 3.5–10.8 ms |
| area labelling (lazy, first query after a rebuild) | 1.6–7.6 ms |
| `findPath` after that | 0.3–5 ms, ≤ 5.5k expansions over about 110 u |
| cross-city `routeTo` (Ferry → Ocean Beach, 1,814 u, 31 legs) | 5–6 ms of A* in 1–2 frames at 2 ms slices |
| graph component labelling (once) | about 2 ms |

**Render ground vs collision ground.** Lane C's `ctx.height` (nearest-corridor rule) against `rasterHeight`, measured on 7 chunks:

| percentile | difference |
|---|---|
| p50 | 0.001–0.021 u |
| p90 | 0.04–0.15 u |
| p99 | 0.13–0.37 u |
| max | 1.87 u, at steep junctions |

1.2–1.9 % of land cells differ by more than 0.3 u. See the request to lane C below.

## 6. Known gaps

- **Render/collision ground mismatch** (§5) until lane C draws from `groundRaster`. Feet can sink or float up to about 0.4 u (p99) at junctions on hills.
- **Sink not wired.** Lane C does not pass `sink` in `walkInputs()` yet, so inside landmark exclusions the rendered ground is 0.2 u below the collision ground.
- **Landmark blockers have no `top`,** because lane D's walk data has no heights. The glide and camera fall back to lane E's `setTallStructures`. City building blockers do carry `top`.
- **Bridges over land.** The heightfield rises to the deck (569 bridge-flag road runs), so you cannot walk under a bridge.
- **Far-DEM fallback.** Heights from the far DEM are 16 u averages, so heights jump on attach. That ground is not standable before the attach, so only the camera or glide could notice.
- **Lombard.** 8 of 141 deck cells lie under OSM houses whose centroids are outside the exclusion; the visible houses win.
- **Window cost.** Rebuild plus labelling is about 5–18 ms in node, against the plan's 3–5 ms. Rebuilds happen at most every 96 u of travel, and labelling is lazy. If the browser checkpoint shows spikes, move labelling to idle time or a worker.
- **`nearestWalkable`** is still raster-only and can return a pocket. Use `arrivalSpot` for placement.
- **YBI/TI places** are unroutable, as expected.

## 7. Requests for other lanes

**Lane C (world/stream):**
1. **Draw the walked ground.** In `world/sf/build.ts` `chunkContext`, build `const g = groundRaster(chunk)` (about 6 ms per chunk in the worker). Use `(x, z) => rasterHeight(g, x, z) - sink` for `ctx.height`, i.e. ground vertices, props and building bases. This removes the mismatch in §5, including the up-to-1.9 u junction errors from the nearest-corridor rule. `rasterHeight` is exact at the 0.5 u corners, so a 1–2 u mesh sampled from it sits on the collision surface.
2. **Pass `sink` in `CitySites.walkInputs()`:** `sink: NO_SINK.has(s.l.id) ? 0 : SINK`. Collision already follows it; first match wins, as in build.ts.
3. **Keep calling `sites.onBase`** wherever a site's `baseY` changes. This is already done; thanks.

**Lane E (movement):**
- In `controller.ts`, `followPath`/`plan` use `findPath`, which clamps at the 384 u window edge and then stops there. For `pathTarget`s farther than `LOCAL_ROUTE` (150 u), use `routeTo(from, target)` and follow it with `RouteWalker.update(pos)`. It returns the current leg's local waypoints, or null when done.
- `Blocker.top` is set on city buildings only.

**Lane G (flow/UI):**
- Fast travel, "带我去" and `?at=` teleports should place the player with `arrivalSpot(place, 30)`, not `nearestWalkable`, then route with `routeTo`.
- Hide or disable "带我去" for places with no route: the 33 YBI/TI places.
- The HUD still showed "The Embarcadero" at Market & Powell in city mode. `core/terrain zoneAt` returns the DataSF neighbourhood there, if the HUD uses it.

**Lane D (landmarks):** optionally add a local `top` (y) to walk blockers. I will pass it through to `Blocker.top` for the glide and camera.

**Lead (STATUS):**
- Collision rasters take about 347 KB per resident chunk: 16 resident ≈ 5.5 MB of JS heap. The city nav window adds about 7.5 MB: 1.3 MB grid and heights, 2 MB area labels and stack, 4.2 MB A* buffers. The plan estimated 5.5 MB.
- The city tests never register a provider inside district suites; every test clears it in `finally`.
