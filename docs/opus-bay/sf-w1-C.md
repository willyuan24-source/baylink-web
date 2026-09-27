# Lane C report: city streaming and rendering (sf-w1, 2026-09-26)

**Status.** `?world=city` now shows all of San Francisco around the unchanged hero district. The city streams in with two module workers and three LOD tiers per 64 u cell. The Bay and the Pacific are covered by one water surface. The islands are at their real positions, the Bay Bridge runs its full west crossing, all 24 landmarks are placed, and the streets have instanced trees and lamps.

District mode is byte-identical: the hero regression test is green.

| check | result |
|---|---|
| `tsc -p tsconfig.app.json` | 0 errors in the whole project |
| eslint on every file I own | 0 problems |
| `tests/opus-bay-*.test.ts` | **200 / 200** pass, including my 15 new tests in `tests/opus-bay-sf-stream.test.ts` |

This run resumed the interrupted one: nothing was restarted or discarded. Nothing is committed.

## 1. Files

**New in `src/opus-bay/world/sf/`:**
- `stream.ts`: CityStreamer (workers, tiers, attach, drop, hero near/far, whenReady, stats).
- `cell.ts`: the pure tier / job / attach / drop state machine, and the LRU.
- `worker.ts`: the module worker.
- `build.ts`: chunk → L0 / L1 geometry.
- `far.ts`: L2 far city, lakes and the shore texture.
- `mesh.ts`: CityBatch, marching-squares ground, ribbons, clipping.
- `raster.ts`: fills, signed distance, sampling, `pushOutOf`.
- `pools.ts`: BatchedMesh pool and the tile fallback.
- `props.ts`: instanced trees and lamps.
- `sites.ts`: landmark placement and LOD.
- `water.ts`: city water and the board edge.
- `hero.ts` (added this run): the hero's L1 stand-in and its land raster.
- `stats.ts`: `window.__opusBay.city` and the `?debug=1` overlay.

**Changed:**
- `world/world.ts`: city path, `enableCity` / `disableCity`, backdrop in its own chunks, hero lot drop, west seawall.
- `world/WorldScene.tsx`: calls enableCity; the QA camera sets the stream focus.
- `world/environment.ts`: city table (radius 3400, centred at (240, 660)); fog density thinned by camera height through the uniform.
- `world/palette.ts`: `CITY_PAL`.
- `world/backdrop.ts`, city mode only:
  - the islands at their real positions;
  - the Bay Bridge's full crossing, with towers at the real pier stations (added this run);
  - the Alcatraz lighthouse;
  - no skyline board.
- `world/ground.ts`: `buildGround(…, { slab })` skips the slab edge in city mode; `slabEdge(…, column = 1.6)` gains an optional column width, default unchanged.

**Tests:** `tests/opus-bay-sf-stream.test.ts` is new.

**Unchanged:** `world/warmup.ts` needed no change (see §4). `game/GameRoot.tsx` is untouched.

## 2. How it works

**Boot.**
1. `World('city')` builds the hero exactly as in district mode, minus its slab edges and district water.
2. `WorldScene` calls `world.enableCity(gl, quality, { pool })`.
3. `CityStreamer.start()` loads the manifest and registers lane B's provider with `setCityTerrain(createCityTerrain(manifest, { landmarks }), { heroDropLots })`. It then spawns two module workers.
4. Worker 0 builds the far city first. It lands during the arrival cinematic (worker time 320–347 ms).
5. The rest streams by priority. Each frame attaches at most 1 L0 cell and 2 L1 cells.

**Tiers per 64 u cell.** Exactly one tier shows at a time, with hysteresis between the in and out radii.

| tier | high (in / out) | mid | low | what it draws |
|---|---|---|---|---|
| L0 | 125 / 165 | 105 / 145 | 85 / 125 | M0's `toyBuildingL0` with street-facing fronts; 2 u road-flattened ground (marching-squares coasts, lakes and the slab cut); every street with sidewalks, curbs, dashes, rails and freeway decks; pier decks; street furniture |
| L1 | 300 / 350 | 260 / 310 | 220 / 270 | M0's `toyBuildingL1` boxes; 4 u ground; main streets |
| L2 | always | always | always | far block prisms and towers, 16 u ground, main lines |

- **Near the hero** (within 300 u of the slab), the radii drop one quality step.
- **Gliding high** (above 40 u), L0 shrinks to 60 / 90 u.
- **Walking rasters** follow their own rule, independent of the render tier: lane B's `rasterizeChunk` runs in the same workers, attaches within 192 u and detaches beyond 256 u.

**Focus and priorities.**
- The focus is the player plus 20 u along the camera's forward direction; while gliding, it is the ground 60 u ahead.
- Tiers are re-selected after 16 u of movement or a 20° turn.
- Job priority is distance from the focus plus 1.5 s of velocity. Rasters come first, then L0, then L1; cells in view go ahead of cells out of view.
- Each worker keeps a compressed-byte LRU of 4 MB and the last 10 decoded chunk contexts.

**Drops never leave a hole.**
- L0 is dropped only once the L1 for that cell is on screen.
- A cell's L1 arrays stay in memory while its chunk is still wanted, so a cell swinging L1 → L2 → L1 re-attaches without a new job. This fixes a stuck-L2 bug that made `whenReady` near Coit time out.

**Pools.** L1, L2, landmark LOD2 silhouettes and the hero stand-in share two `THREE.BatchedMesh` (TOY and GROUND): 2 draw calls for the whole middle and far city.
- Items sit in size-class slots (×1.25 steps) and freed slots are reused, so streaming never fragments the buffers.
- Reservation on high is 600k toy and 260k ground vertices; the pools grow if needed. Measured live peak: 459k and 168k.
- **No `WEBGL_multi_draw`, or `?pool=tile`:** a `TilePool` merges items per 512 u tile and rebuilds at most one tile per frame. Measured cost: +12 to +16 draw calls against the batched pools.

**Hero near / far.** Beyond 300 u from the hero (±24 u hysteresis):
- the hero's buildings and props (`city#` chunks) hide;
- `heroProxy()` shows instead: one L1 box per lot and shed in the district's own colours, 2,996 triangles;
- hero landmarks, ground, labels and the backdrop stay. The backdrop now has its own `backdrop#` chunks in city mode.

**Seam.**
- City ground, streets, piers and far prisms are cut at the slab. Ribbons and decks are clamped out of it with `CityBatch.clampXZ` / `pushOutOf`.
- Street ribbons are also clamped out of landmark footprints.
- Seam-block buildings that reach into the slab where the hero has water are dropped. There were two at the west end.
- The west seawall runs from (−218.7, 63.9) to (−205.4, 73.6).
- The hero lots listed in `heroDropLots` are removed from the hero chunks.

**Landmarks** (lane D's `SF_LANDMARKS`, 24 records):
- **Placement:** `landmarkMatrix`; numeric bases as given. `'terrain'` bases take the far-DEM estimate, then the lowest city ground inside the exclusion once the landmark's chunk arrives. That base is pinned for collision with `setLandmarkBase`.
- **LOD 0:** its own TOY mesh (T1 casts shadows) within 520 / 340 / 220 u for tiers 1 / 2 / 3, built at most once per frame. The animated part is a TOY_DYN child and moves only within 150 u.
- **LOD 2:** in the far pool.
- **Inside each exclusion:**
  - city buildings, props and streets drop;
  - lakes stay ground, so the Palace lagoon and the Sutro basins are not holes;
  - the city ground sinks by 0.2 u (not under the Golden Gate Bridge).

**Water** (`CityWater`, one material: the district shader with a deeper Pacific patch):
- a camera-following 4 u wave grid over 5×5 tiles of 64 u;
- flat 64 u far tiles clipped to the board; tiles that are all land are skipped;
- lake surfaces at their own level;
- a shore-distance texture (2 u, 1280×1536) built from the far land plus the hero's own land and piers, which gives the depth tint and foam.
- The board runs 180 u of Pacific out and past Angel Island, cut at the San Mateo county line. Its edge uses 6 u columns, split into 512 u pieces so it can be frustum-culled.

**Islands.**
- Alcatraz, Yerba Buena Island and Treasure Island come from the streamed data at their real places.
- Angel Island is a backdrop tile at its real position and size.
- The Alcatraz lighthouse beam is added.

**Props.** Nearest-N instancing on TOY_INST, re-selected after 12 u; instances grow in over 0.45 s.
- 200 full trees within 70 u (round, cypress, pine, palm);
- 600 lollipop trees within 140 u;
- 48 lamps within 120 u, with night halos and light pools.

**Colour.** Buildings use the manifest palettes with M0's per-osmId jitter.
- Flat roofs of the commercial and civic styles become cream or pale stone, with an occasional terracotta, garden or teal roof.
- Far prisms get their chroma back: HSL saturation ×1.1 on walls and ×1.22 on roofs; tower roofs are lifted toward cream.

## 3. API for other lanes

```ts
// world/sf/stream.ts
export function cityStreamer(): CityStreamer | null;          // the running streamer (city mode), else null
class CityStreamer {
  readonly group: THREE.Group;                                // add city-anchored things here (satellite boards, crowds…)
  manifest: SfManifest | null; far: FarData | null; terrain: CityTerrainProvider | null;
  status: 'idle' | 'loading' | 'far' | 'streaming' | 'error';
  focusOverride: Vec2 | null;                                 // QA / cinematics: stream around this point instead of the player
  whenReady(p: Vec2, r = 150): Promise<void>;                 // fast travel: await, cut in after 8 s yourself
  chunkAt(x: number, z: number): ChunkInfo | undefined;
  stats(): CityStats;                                         // l0/l1/l2 cells, want, queued, inflight, workerMs, attachMs/Max,
                                                              // l0/l1/l2Triangles, heroFar, pool, props, sites, farMs, focus
  setQuality(q: Quality): void; dispose(): void;
}
// world/world.ts
world.enableCity(renderer, quality, { pool?: 'batched' | 'tile' }); world.disableCity();
world.city: CityStreamer | null; world.cityWater: CityWater | null   // .board (Polygon), .material, setShore/setLakes/setEdge
// world/sf/hero.ts
export function heroProxy(): PoolArrays | null; export function heroLandRaster(step = 2): { x0, z0, step, cols, rows, data };
// world/sf/build.ts (worker-safe)
export interface Exclude { id; x; z; r?; poly?; base?; sink? }
export interface CityInit { palettes; slab; excludes; heroLand? }
export function chunkContext(chunk: ChunkData, init: CityInit): ChunkContext;   // .height(x,z) .dem(x,z) .excluded(x,z) .inSlab(x,z)
export function buildL1(ctx): L1Result; export function buildL0(ctx, sub: 0|1|2|3): L0Result; export function isGround(ctx, x, z);
// world/sf/cell.ts (pure)
RADII, LOWER_QUALITY, RESIDENCY {in 192, out 256}, ATTACH_BUDGET {l0 1, l1 2}, CellTable, Lru, desiredTier, squareDist
// world/sf/water.ts
boardPolygon(), southCut(), SOUTH_LAT, CityWater
// DEV: window.__opusBay.city = { streamer, stats(), focus(x|null, z, r), whenReady(x, z, r) }; ?debug=1 overlay; ?pool=tile
```

**Hooks for wave 2:**
- **Satellite boards:** add their polygons to `world.env.setBoards([...])` next to `cityWater.board`, and their meshes to `world.root`.
- **Karl the Fog:** `Environment.fog.density` is already driven per frame, and `env.groundAt` is the far DEM.
- **Crowd and traffic:** `cityStreamer()` exposes manifest, far, terrain and whenReady; add meshes to `streamer.group`.

## 4. Evidence

**Tests** (`tests/opus-bay-sf-stream.test.ts`, 15/15):
- tiers and hysteresis;
- a streaming walk from the Ferry Building to Ocean Beach: ≤ 1 L0 + 2 L1 attaches per frame, zero holes, drops follow the walker, `ready()`;
- the L1 → L2 → L1 re-attach regression;
- `whenReady` semantics;
- LRU eviction;
- L0 and L1 budgets on the four densest chunks;
- hero seam: no city ground, street or prop inside the slab, and the west seam building standing in hero water is dropped;
- landmark exclusions: buildings and streets drop, the ground sinks by exactly `sink`, the Palace lagoon is no hole;
- street clipping;
- far city: budget, clamped at the slab, shore texture, lakes;
- pool size classes;
- the city board and county-line cut;
- the hero stand-in;
- worker-safe imports;
- headless city-mode World next to district mode.

The hero regression test is green (district unchanged). Full suite: 200/200.

**Screenshots I viewed** (all in `C:/Users/willy/opus-qa/`):
- **Walk mode, golden:** `sf-w1-city-w3-{chinatown,painted,mission,twinPeaks}.png`
- **Walk mode, day:** `sf-w1-city-pool-painted.png`
- **Walk mode, night:** `sf-w1-city-night-{painted,mission,twinPeaks}.png`
- **Mobile 390×844:** `sf-w1-city-mobile-{painted,ocean}.png`
- **Coit viewpoint** (`?at=coit-view`): `sf-w1-city-coitview-{golden,day,golden2}.png`
- **Landmark arrival spots:** `sf-w1-city-lm-{ggbA,palaceA,cityhallA,lombardA,cliffA,wharfA}.png`
- **Overviews:** `sf-w1-city-r3-{over,bay,alcatraz,wharf}.png`, `sf-w1-city-r4-over.png`, and `sf-w1-city-r2-{coitHigh,twinPeaks}.png` with `sf-w1-city-r1day-*.png`
- **Seams:** `sf-w1-city-seam-{seamW,seamW2,seamE,seamS}.png`
- **Arrival flow:** `sf-w1-city-arrival-t11.png`
- **Tile fallback:** `sf-w1-city-tile-*.png`
- **Final checks:** `sf-w1-city-final-{mission,ocean}.png`

**What I fixed after looking:**

| problem seen | fix |
|---|---|
| city ground and streets overlapping the hero edge | seam clamping |
| a seam building standing in the Bay at the wharf | dropped over hero water |
| drab brown flat roofs downtown | light roof palette |
| washed-out far city | chroma boost on far prisms |
| props at 83k triangles | caps lowered |
| the board edge at 65k triangles | 6 u columns, split for culling |
| cells stuck at L2 near Coit | L1 arrays kept per cell |

The walk-mode city reads as the warm toy city of the key art: Painted Ladies, Mission rows, Ocean Beach, Twin Peaks, Chinatown balconies, and night windows.

## 5. Measured numbers

All at 1×, 1440×900, quality high, golden hour. The GPU was shared with other lanes, so fps is only indicative: vsync-capped at 60 in every walk view and during the arrival.

| view (walk mode) | draw calls | triangles (frame) | L0 in view | L1 + L2 pools | props |
|---|---|---|---|---|---|
| Chinatown (hero near) | 83 | 344k | 48k | 6k | 53k |
| Painted Ladies | 58 | 310k | 88k | 59k | 56k |
| Mission | 62–64 | 323–372k | 115k | 88k | 56k |
| Twin Peaks | 81 | 342k | 107k | 72k | 35k |
| Ocean Beach | 56–65 | 169–283k | — | — | — |
| Coit viewpoint | 77–82 | 313k | — | — | — |
| arrival (Ferry Building) | 65 | 239k | — | — | — |
| QA overview from 420 u up (not a play view) | 138 | 679k | — | — | — |

- **Budget:** walk mode is at or under about 400k triangles. The worst case I saw was 406k, in the day painted view.
- **Where the rest goes:** the hero adds about 95k when it is near; water adds 36k; life (other lanes) 38k; environment 18k.
- **Attach cost:** mean 0.08–0.11 ms, max 0.36 ms (budget 2 ms).
- **Worker:** 4.3 ms per job (moving average); far build 320–347 ms.
- **Programs:** steady at 46. Streaming across the whole city compiled no new program; the only new ones seen while walking were the character GLB and the FX pool, from other lanes.
- **Far city (L2):** 656 cells, 116k triangles (62k prisms, 54k ground), plus 4.3k for lakes.
- **L1 cells:** 2.2k toy vertices on average; indices per vertex are 1.42 for toy and 3.0 for ground.
- **Densest L0 cell:** 17.9k triangles. That is chunk 2_11, sub-cell 0: 214 Edwardian buildings at about 64 triangles each, plus 3.4k of ground.
- **Worker bundle:** 91 KB gzip with Rollup, against the plan's 70 KB target (see §7).

## 6. Decisions and known gaps

**Decisions I made:**
- **Alcatraz is not scaled ×1.3.** It is real streamed land at its real size; scaling would break the data's coastline. At 308 u from Pier 33 it still reads well (`r3-alcatraz`, `lm-wharfA`).
- **City water keeps `aDist = −1`** and samples a city-wide shore texture instead of per-vertex distances. It is the same program, so there is no new variant (M0 asked for `aDist ≥ 0`).
- **Bay Bridge.** It stays a straight crossing from the hero's anchorage at (234, 36) to the YBI tunnel. The towers and centre anchorage sit at the real piers' stations along it: W2 36 u, W3 134 u, CA 187 u, W5 240 u, W6 338 u. Because the hero anchorage is displaced, the deck passes 4–18 u west of the real piers.
- **Golden Gate Bridge deck ends.**
  - South end (local x −230): the ground measures 15.02 u against the 15.2 u deck, a 0.18 u curb, so no ramp.
  - North end: it is in Marin, which has no data yet (wave 2 board).
- **Fisherman's Wharf sign.** It stays at its OSM spot, 2 u inside the slab, on the hero's Jefferson St pavement. The west end has no warp (lane A), so nothing moves.
- **Radii are smaller than the plan's.** L0 is 125 u and L1 300 u on high, instead of 150 u and 520 u. The published data is denser than the plan assumed (L1 cells about 3.5k triangles, L0 cells up to 17.9k).

**Known gaps:**
- **Tiers switch without the planned 0.3 s dither cross-fade.** The shared TOY / GROUND materials have no per-object fade (request to M0 in §7). Hysteresis and matching L0 / L1 colours keep the pop small.
- The **worker bundle** is over its target, and `window.__opusBay.city` is DEV-only.
- The **city ground inside landmark footprints sits 0.2 u lower than lane B's walk heights** unless B mirrors the sink (request in §7).
- **Satellite boards, Karl the Fog, and crowd / traffic** are not built; they are wave 2. The hooks are in §3.
- **Higgsfield meshes** (`OB_MAP` / GLB loading, sf-w1-H §7) are left to wave 2 as briefed.

## 7. Requests for other lanes

**Lane A (data):**
- The densest L0 cells measure up to 17.9k triangles against the 14k budget: recipe cost is about 64 per Edwardian, not the estimate. For v2, consider a lower frontage cap for dense Edwardian and Sunset rows.
- Two seam-block buildings reach into the slab over hero water: osm 288472567 and 1092477935, in chunk −2_0. The renderer drops them; v2 could drop them offline.

**Lane B (terrain / nav):**
- Mirror `Exclude.sink` (0.2 u; 0 for `golden-gate-bridge`) in the chunk heights inside landmark footprints where no landmark surface covers. The values are in `CitySites.excludes()`.
- `walkInputs()` now pass `exclude` (world polygon or r).
- The renderer pins `'terrain'` bases with `setLandmarkBase`, using the lowest sunk city ground in the exclusion.
- Drop collision for the two seam buildings above.

**Lane M0 (renderer):** a per-object tier fade in the same program. For example, a `uTierFade` uniform set per draw in `onBeforeRender`, dithered like the occlusion fade. I would then cross-fade L0 ↔ L1 ↔ L2 over 0.3 s (plan §5.3).

**Lead / integrator:**
- The worker pulls in three's WebGL renderer: `import 'three'` is not tree-shaken, and alone it costs about 250 KB minified.
- Aliasing `three` to `three/src/Three.Core.js` for the worker build only would help. That means `worker.plugins` in `vite.opus.config.ts`, which is not my file. It brought the worker from 91 to 83 KB gzip with Rollup in my test; with esbuild, core-only imports tree-shake to about 35 KB.
- Add `?pool=tile` and `?debug=1` city lines to the STATUS QA list.

**Lane D (landmarks):**
- The Golden Gate Bridge south end and the Fisherman's Wharf sign need no change (§6).
- LOD0 radii are 520 / 340 / 220 u.
- The Palace lagoon sits on city ground at about y 0, with the landmark's water polygon at 0.14.

**Lane G (flow / UI):** the HUD place label still reads "The Embarcadero" all over the city.

**Wave 2 (C2):** satellite boards go beside `cityWater.board`, plus Karl the Fog and crowd / traffic, all through the §3 hooks.
