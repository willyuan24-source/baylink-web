# Opus Bay: whole San Francisco, technical plan (research synthesis)

This is the implementer document from the research lead, dated 2026-09-26. Nothing under `C:/Users/willy/baylink-opus` was edited.

**Inputs.** Seven research reports, each spot-checked against the code:
- `C:/Users/willy/opus-qa/reports/sf-research-gta-pipeline.md`
- `sf-research-gta-mechanics.md`
- `sf-research-gta-visuals.md`
- `sf-research-gta-process.md`
- `sf-research-opus-arch.md`
- `sf-research-sf-data.md`
- `sf-research-asset-scout.md`

The owner-facing summary, in Chinese, is `sf-research-synthesis.md` in the same folder.

**Path prefixes used in citations.**

| prefix | location |
|---|---|
| `OB:` | `C:/Users/willy/baylink-opus/src/opus-bay/` |
| `repo:` | `C:/Users/willy/baylink-opus/` |
| `GTA:` | `C:/Users/willy/opus-qa/ref/GTA_SZ/` (main @ 73603f3). Its code is MIT, so ideas and small snippets may be reused with attribution. Its assets, models, data and media may not be reused. |
| `sfd:` | `C:/Users/willy/opus-qa/sf-data/` |

---

## 0. Decisions at a glance

| # | Topic | Decision | Rejected alternative (source) | Why |
|---|---|---|---|---|
| D1 | Horizontal frame | Keep K = 0.14 u/m, ROT = 46° and the origin (37.802338, −122.40001) (`OB:data/district.ts:43-48`). Move `project`/`unproject` into a pure `OB:core/geo.ts` that the runtime and the build scripts both import. | K = 0.20 (mechanics option B); compressing the Sunset (process §11.1) | Every anchor, polygon and test depends on K. With rides added, crossing SF on foot (3.4 min running) is fine. |
| D2 | Terrain height | `terrainY(dem) = 0.238·k(max(0, dem − 3))`, where `k(h) = h` for h ≤ 90 and `90 + 0.65·(h − 90)` above | 0.2375 linear (sf-data); V = 0.20 linear (opus-arch); quadratic (pipeline); knee slope 0.12 (mechanics) | Measured on the DEM (§2.2): Telegraph Hill 19.9 u (matches SUMMIT_HEIGHT 20), Twin Peaks 50.0 u, p99 grade 0.89, 0.96 % of land steeper than 0.9. Linear 0.2375 gives Twin Peaks 65.3 u and 1.73 % over 0.9. V = 0.20 puts Telegraph Hill at 17.3 u, which breaks the hero seam. |
| D3 | Building height | `H = max(3.6, 3.2 + 0.155·h_m)`. Heroes use explicit heights. Structures joined to terrain (bridge decks and towers) use `terrainY`. | `2.2·√h` (sf-data); `0.16·H` for landmarks (process) | The linear rule reproduces all four hand-tuned anchors (§2.3). √h gives Transamerica 35.5 u against 41 today. `0.16·H` makes the GGB towers too short above a terrain-matched deck. |
| D4 | Lot aggregation | Merge footprints along a block face to 3.5–6 u of frontage, giving about 45k toy buildings (assert ≤ 60k). | Keep all 161k (sf-data) | A real 25 ft lot is 1.07 u wide, a sliver. Today's toy lot is 4.6 u (`district.ts:894`). |
| D5 | Street widths | Right-of-way in toy units: residential 3.6, secondary 4.4, primary 5.6, service 2.0, footway/steps ≥ 1.2. The whole corridor is walkable. | 5.8 u right-of-way (mechanics) | 5.8 u leaves 3.6 u-deep lots in the Sunset (the real block is 73 m = 10.2 u deep). 3.6 u equals `HALF_STREET·2` (`district.ts:882`). |
| D6 | Data unit | Per 128 u chunk: vectors plus a 2 u DEM, rasterised in workers. `far.obc` is always loaded; `graph.obc` loads lazily. | Pre-baked rasters (pipeline: 128 KB surface texture per 64 u chunk); 512 u region packs (opus-arch) | About 20 KB gzip per chunk and about 4–5 MB for the whole city. Reuses today's rasteriser (`OB:core/terrain.ts:118-191`). Per-chunk files keep caching and hysteresis simple over HTTP/2. |
| D7 | LOD | Exactly one tier visible per 64 u cell. L0 within 150/120/90 u (high/mid/low); L1 within 520/420/320 u; L2 always. L0 uses merged meshes; L1 and L2 use `BatchedMesh`. | Instanced archetype houses with a painted facade atlas (visuals) | OSM footprints are unique polygons, and the TOY shader already paints windows from world position (`OB:world/materials.ts:248-280`). This keeps one proven code path. |
| D8 | Budgets | Keep DESIGN §9: ≤ 150 draw calls, ≤ 400k triangles including shadows, ≤ 500 objects, ≥ 45 fps at 4× CPU throttle, including 390×844 (`OB:DESIGN.md:87-89`). | 230 draw calls / 520k triangles (pipeline) | Phones are a pillar; GTA_SZ is desktop-only. |
| D9 | Movement | Explicit `MoveMode` state machine. Walk 4.2 / run 7.5 unchanged, plus a grade model. Add bike, cable cars, F-line to the Castro, pelican glide, discovery-gated fast travel, kiddie toy car and ferry. | Stamina, combat, knockdowns | Cozy tone. |
| D10 | Higgsfield | Hard cap 450 of the 500-credit allowance. AI 3D only for ornamental silhouettes, after a 57-credit bake-off. Vehicles, bridges and towers are procedural. No facade atlas and no horizon panoramas this round. | Visuals' AI facade atlas and horizon strips; asset-scout's AI cable car and toy car | Rides need exact anchors. AI meshes melt thin parts (`OB:ASSETS-LEDGER.md:115`). Panoramas contradict the floating-slab look. |
| D11 | Hero | `DISTRICT` is never edited. `settings.worldMode: 'district' | 'city'` plus the URL flag `?world=city`. Four seam rules (§5.1). District stays the default until gate G2. | Folding the hero into generated data | Keeps all 104 existing tests meaningful. |

**Smaller disagreements, resolved:**

| Topic | Chosen | Rejected | Why |
|---|---|---|---|
| Cable-car speed | constant cable at 9 u/s | 8 (mechanics); 11–13 (sf-data) | Faster than running on the flat and about 2× running uphill. Powell–Hyde (456 u) takes about 51 s of motion. |
| Seam blend width | 40 u | 8 u (pipeline); 12 u (sf-data) | The hero edge is at y ≈ 0 while the DEM just outside reaches 2–5 u. 40 u keeps the ramp under about 15 %. |
| Camera far plane | 3,000 | keep 1,600 (pipeline); 3,500 (visuals) | Enough to see all of SF from Twin Peaks and the satellite boards. Fog hides what is beyond. |
| Table radius | 3,400 | 6,000 (visuals) | 3,400 contains every satellite board. |
| DEM resolution | 2 u, plus per-vertex road centreline heights | 1 u (pipeline, sf-data) | The source is 7.5 m (1.05 u), but streets are flattened anyway. A 2 u grid is 4× smaller. |
| Nav graph source | street centrelines + steps + park paths, about 20–40k nodes | sidewalk footways, 50–80k nodes (pipeline) | The whole corridor is walkable, so sidewalks add nothing. |
| Toy car size | 1.8 × 1.0 u kiddie car | 3.2 × 1.4 u (asset-scout) | It must fit a 3.6 u right-of-way. |

---

## 1. Corrections found while verifying

1. **Transamerica height.** The top is 41 u (`OB:world/landmarks.ts:203`), not 47.5 (opus-arch §2). Salesforce is 56.5 u (`:255`).
2. **Golden Gate Bridge tower coordinates.**
   - opus-arch gives (−759, 597) / (−942, 435). Those points are 244 u = 1,746 m apart.
   - `sfd:landmarks.json` gives (−796.1, 564.4) / (−935.5, 452.7): 178.6 u = 1,276 m apart. The real main span is 1,280 m.
   - **`landmarks.json` is the only source for positions** (69 landmarks plus 11 backdrop points).
3. **Player size.** The player is 1.725 u tall (1.5 × `CHAR_SCALE` 1.15, `OB:actors/dims.ts`) and BAYBAY is 1.495 u. The "1.5 u" in the brief is the height before scaling.
4. **Test count.** There are 104 opus-bay tests (`it(`/`test(` in `repo:tests/opus-bay-*.test.ts`), not 120 as the process report says.
5. **A DEM > 0.5 m test is not a land mask.**
   - `sfd:raw/sf-bounds-world.json` reports a "mainland" minimum z of −206. That comes from false land at (232, −206), i.e. 37.8008, −122.3749, which is a Bay Bridge pier.
   - Build land from the OSM coastline intersected with boundary relation 111968. Use the DEM mask for statistics only.
6. **Normal bug with instancing.** `vWN` ignores `instanceMatrix` and the batching matrix (`OB:world/materials.ts:69`: `vWN = normalize(mat3(modelMatrix) * objectNormal)`). This must be fixed before any rotated instanced or batched TOY geometry ships.
7. **`BatchedMesh` without multi-draw.** In three 0.186.1, `BatchedMesh` loops one draw per geometry when `WEBGL_multi_draw` is missing (`repo:node_modules/three/src/renderers/WebGLRenderer.js:1315-1336`). It also compiles a separate `batching` program variant (`:2436-2448`). Both must be warmed at boot, and the extension must be checked on iPhone Safari (§12).
8. **Values checked.**
   - Fog densities: morning .0022, day .0011, golden .0012, night .0018 (`OB:world/palette.ts:89,97,106,115`).
   - Table: radius 2,600 at (0, 0), darkening over 220–700 u (`OB:world/environment.ts:16,158-160`).
   - Camera: far 1,600, near 0.5 (`OB:game/GameRoot.tsx:29`).
   - Shadow box: ±24 / ±19 (`environment.ts:248`).
   - Streetcar: VMAX 11 / ride 13 / ACC 2.6 / CAR_LEN 8.4 (`OB:world/streetcar.ts:17-22`).
   - Bay Bridge backdrop: DECK 10 / TOP 30 (`OB:world/backdrop.ts:51`).
9. **Chunk counts, computed this session.** Projecting the DEM land mask with our `project()` gives **195 land chunks at 128 u** and **683 at 64 u**.
10. **GTA_SZ spot-checks, all confirmed:**
    - walk/run 1.6 / 4.2 (`GTA:src/city-walk.ts:2-3`);
    - `stepCar` constants (`GTA:src/driving.ts:5-16`);
    - facade tiles show < 700, prefetch < 1,050, dispose > 1,500 and cast shadows < 520 (`GTA:src/city-facade-stream.ts:10-37`);
    - building culling at 3,300 / 2,500 (`GTA:src/city-world.ts:435`);
    - random typology heights (`GTA:scripts/prepare_driving_city.py:79-84`);
    - A* time-sliced every 2 ms (`GTA:src/city-autopilot.ts:106,122,220`);
    - `public/city` is 340 MB; `buildings.glb` 49.8 MB; `street-surfaces.json` 36.6 MB; 52 landmark modules; 347 `test(` calls.

---

## 2. World frame and scale

### 2.1 Extent and travel

**SF land** spans x −795…1,275 and z −597…1,921. That is 2,071 × 2,518 u, 2.38 M u², or 121.4 km², matching the official land area (`sfd:raw/sf-bounds-world.json`). The hero slab spans x −246…244 and z −104…114 (`district.ts:409-412`), which is 2.2 % of SF land.

**City data bbox:** x −1,000…1,500, z −800…2,150. As a chunk grid that is cx −8…11 by cz −7…16: 480 slots, of which 195 contain land. The −46° rotation makes SF a diamond, so about half of any axis-aligned grid is water or table.

Travel times below are from the Ferry Building (130, 17), in straight lines; street routes are about 1.3× longer.

| to | u | walk 4.2 | run 7.5 | bike 11.5 | toy car 14 | glide 20 |
|---|---|---|---|---|---|---|
| Twin Peaks (140, 947) | 930 | 3.7 min | 2.1 min | 81 s | 66 s | 47 s |
| GGB south tower (−796, 564) | 1,076 | 4.3 min | 2.4 min | 94 s | 77 s | 54 s |
| Ocean Beach (−431, 1475) | 1,540 | 6.1 min | 3.4 min | 134 s | 110 s | 77 s |

### 2.2 Terrain curve (D2)

`terrainY(dem) = 0.238·k(max(0, dem − 3))`, with `k(h) = h ≤ 90 ? h : 90 + 0.65·(h − 90)`.

- The 3 m datum puts the waterfront (DEM 1–4 m) at y 0–0.24, matching today's promenade at 0 and water at −0.6.
- The curve is piecewise linear, so it has a closed-form inverse.

Values from `sfd:raw/dem-sf-z14.f32`:

| place (DEM m) | y (u) |
|---|---|
| Chinatown gate (23.8) | 4.95 |
| median land (46.4) | 10.33 |
| Telegraph Hill node (86.7) | 19.92 (`SUMMIT_HEIGHT 20`, `district.ts:352`) |
| Coit base (91.5) | 21.06 |
| Nob Hill node (104.4) | 23.18 |
| Bernal (138.6) | 28.47 |
| Sutro base (255) | 46.48 |
| Twin Peaks (277.8) | 50.01 |
| Mt Davidson (284) | 50.96 |

**World grades on land:** p50 0.095, p90 0.37, p95 0.52, p99 0.89; 0.96 % of land is steeper than 0.9. That 0.96 % is mostly cliffs and quarries, which become non-walkable.

**Structures joined to the curve:**
- GGB: towers 227 m → 42.2 u; mid-span deck 67 m → 15.2 u.
- Bay Bridge west-span towers: 154 m → 30.9 u, which is today's TOP 30. The hero bridge therefore stays as it is.

### 2.3 Buildings (D3, D4)

**Height:** `H = max(3.6, 3.2 + 0.155·h)`. Checked against today's hand-tuned anchors:

| building | real height | H | today |
|---|---|---|---|
| Victorian | 10–12 m | 4.8–5.1 u | 4.2–6.4 (`district.ts:870`) |
| office | 60–120 m | 12.5–21.8 u | 10–22 (`:873`) |
| Transamerica | 260 m | 43.5 u | 41 |
| Salesforce | 326 m | 53.7 u | 56.5 (both heroes keep their explicit heights) |

Known weakness: 15–25 m mid-rise comes out at 5.5–7.1 u, against 5–8.5 u hand-picked. The TOY window cells are 2.2–3.1 u per storey (`materials.ts:252-258`), so these read as 2–3 storeys, which is acceptable.

**Height source, in order:**
1. OSM `height` (86.6 % in SF);
2. the DataSF LiDAR join in `sfd:raw/osm-datasf-height-join.json`, which lifts coverage to 97.9 % (skip it for post-2010 sites: Salesforce's LiDAR reads 110.8 m against 326 m real);
3. `building:levels·3.2`;
4. 6.6 m.

**Base** is the lowest ground under the footprint. Walls start at base − 1.2, as in `OB:world/city.ts:102`.

**Merging (offline).**
- Merge footprints that share a wall (≥ 0.5 m of shared edge) along one block face while frontage is under 3.5 u (25 m). Cap at 6 u (43 m).
- Merge only within one class (house / flat / commercial).
- Height is area-weighted, and the osmId kept is that of the largest part.
- Expected result: 161,463 in SF, merged down to about 45k. The build fails above 60k.
- Chunk density: the mean chunk goes from 892 to about 255 toy buildings; the p90 chunk from 1,888 to about 540 (sfd report §2.1).

**Style** comes from a table of 41 DataSF neighbourhoods plus height, tag and footprint area. Year built is not in the inventory (§3). The families:

| family | where | notes |
|---|---|---|
| Victorian | Western Addition / Haight / Mission / Noe / Castro | footprint < 250 m², LiDAR median 6–12 m |
| Edwardian | — | — |
| Sunset stucco | Sunset / Parkside / Richmond | — |
| Marina | Marina | — |
| Chinatown | Chinatown | — |
| SoMa brick | SoMa + industrial | — |
| Deco | Nob / Russian Hill / North Beach multi-unit | — |
| office / tower | FiDi, SoMa, Mission Bay | h ≥ 25 m |

Palettes are in visuals §3.2 (only Victorian, Sunset and Mission are high-chroma). **Roofs** are rule-based: gable for 1–4 storey houses outside the downtown wedge, flat for h ≥ 15 m or commercial use.

### 2.4 Streets (D5)

Right-of-way (curb to curb plus sidewalks) in toy units, applied to OSM centrelines:

| class | u |
|---|---|
| residential / unclassified / living_street | 3.6 |
| tertiary / secondary | 4.4 |
| primary / trunk (Market, Van Ness, Geary, 19th Ave) | 5.6 |
| service ≥ 30 m long (drop private) | 2.0 |
| pedestrian | 2.4 |
| footway / path in parks and off-street | 1.2 |
| steps | max(1.4, real width) |

Where a toy right-of-way is wider than the real gap, carve it out of footprints and drop remainders under 0.4 u² (the idea of `GTA:scripts/prepare_driving_city.py:87-88`).

**Sidewalks:** sidewalk footway ways (38k) are not used as geometry. They are drawn as a 0.6 u curb band inside the corridor.

**Freeways** (I-80, US-101, the Central Freeway, I-280) are visual-only decks on pillars wherever `bridge=yes` or `layer ≥ 1`. At grade they are fenced strips that cannot be walked. Grade separation is never flattened into walkable ground; GTA_SZ does flatten it (`prepare_driving_city.py:36-38`).

**Steps:** the 2,618 `steps` ways (35.3 km real) become ramps with the `stairs` surface. This is SF's signature verb, and Filbert Steps already works this way.

---

## 3. Data inventory (`sfd:`)

| layer | file | contents | licence | use |
|---|---|---|---|---|
| buildings | `raw/osm-buildings.json` (Overpass, osm_base 2026-09-26, 120 MB); BBBike copy `raw/bbbike-osm-buildings.json` | 171,514 in the bbox; 161,463 in SF; 139,846 with `height`; 3,194 with levels; 421 with roof shape; 1,650 `building:part` | ODbL | footprints, heights, hero parts (GGB towers, Salesforce) |
| LiDAR | `raw/datasf-buildings.json` (150 MB, 177,023 rows), `raw/osm-datasf-height-join.json` | 2010 LiDAR max/median/ground | PDDL | fills heights → 157,996 (97.9 %) |
| highways | `raw/osm-highways.json` | 67,874 ways (4,817 km); in SF 2,618 steps, 38,019 footways; names 16,160; incline 1,801; 764 bridges; 400 tunnels | ODbL | streets, steps, names, freeway decks |
| rail | `raw/osm-railways.json` | cable cars (tagged `cable_tram=cable`, 14.1 km); Powell–Hyde rel 1959009/3433158, Powell–Mason 1959010/3433157, California 2852264/2852265; F-line 2007934/2007933; turntables; Muni Metro and N-Judah 63223; 292 tram stops | ODbL | transit lines |
| landcover | `raw/osm-landcover.json` | 11,636 polygons: parks 19.1 km², beach, piers 1,195, water, golf | ODbL | ground classes, parks, piers |
| POIs | `raw/osm-pois.json` | 7,785 (5,819 named): viewpoints 144, attractions 139, peaks 43, neighbourhoods 56 | ODbL | discoveries, BAYBAY stops |
| boundary | `raw/osm-boundary-rel111968-full.json` | SF city and county | ODbL | land mask (with the coastline) |
| backdrop | `raw/osm-backdrop.json` | wide Bay box, 804 km of coastline, bridges, towns, peaks | ODbL | satellite boards |
| DEM | `raw/dem-sf-z14.f32` + `.json` | 1981 × 1990 float32, 7.55 × 7.50 m, row 0 = north, cell-centre registration, origin 37.835 / −122.52, dLat 6.78494e-5, dLng 8.58307e-5 | AWS Terrain Tiles (USGS 3DEP + NOAA/GMRT): attribution required | terrain |
| DEM (Bay) | `raw/dem-bay-z11.f32` | 947 × 1106, 60 m cells | same | Marin and East Bay boards |
| neighbourhoods | `raw/datasf-neighborhoods-j2bu-swwd.geojson` | 41 polygons | PDDL | zones, style table, map reveal |
| landmarks | `landmarks.json` | 69 + 11 backdrop points: lat/lng, world x/z, OSM id, height and its source, DEM ground | derived | all positions |
| preview | `sf-world-preview.png` | world-unit map at 0.8 px/u | derived | QA reference |
| tools | `tools/*.mjs/.py/.mts` | fetch, stats, join, landmask, preview, `proj.mjs` (checked to within 0.005 u against `district.ts`) | — | re-runnable (sfd report §9) |

**Gaps:**
- The DataSF Street Tree List (`tkzw-k3nq`, PDDL) is not downloaded; OSM has only 10,779 tree nodes.
- There is no year-built data. Assessor rolls would be optional.
- Roof shapes are sparse.
- The 2010 LiDAR is stale for post-2010 towers.
- The Bay Bridge east span and Oakland exist only in the backdrop layer and the z11 DEM.
- 2 m DEM water/pier false positives (§1.5).

**Build from `osm-*.json`**, which is fresher; keep the BBBike PBF as the frozen snapshot. Credits: "© OpenStreetMap contributors" (ODbL; share-alike applies to the derived database), DataSF (PDDL, optional credit), and the terrain-tiles attribution list. Confirm that list before shipping.

---

## 4. Offline build (`repo:scripts/opus-sf/`, Node 24 + tsx, no new dependencies)

`build.ts` imports `OB:core/geo.ts` and `OB:world/sf/format.ts`, so the reader and writer cannot drift. It also imports `OB:data/district.ts`, as `sfd:tools/build-landmarks.mts` already does.

1. **Land.** Coastline ∩ boundary 111968 gives the land polygons. Water and pier polygons come from landcover.
2. **Terrain.** Resample the DEM to a world-aligned 1 u grid (bilinear), apply `terrainY`, blur 3×3, then downsample to 2 u per chunk.
3. **Roads.** Merge ways by name and class, simplify at 0.15 u, clip per chunk with 8 u of overhang. Give each vertex a centreline height from the 1 u grid, smoothed along the line (window 6 u). The worker flattens the cross-section, blending into the ground over 1.5 u with a smoothstep.
4. **Buildings.** Filter (skip roof/shed/garage and parts, except where a hero uses parts; drop < 0.4 u²), merge lots (§2.3), apply H, simplify to ≤ 12 vertices (Douglas–Peucker 0.056 u), carve streets, assign style/roof/palette, and set flags.
5. **Hero seam.**
   - A block belongs to the hero if ≥ 60 % of its area is inside `SLAB`.
   - Drop city buildings inside hero-owned blocks, or within 0.8 u of the hero exclusion shapes (`district.ts:778-788`).
   - Compute `heroDropLots` (indices of hero lots whose centroid falls in a city-owned block) and `districtHash`.
   - Apply the waterfront warp (§5.1).
6. **Props.** Trees (OSM now; DataSF later, downsampled 1:4, with a crown-clearance veto against lanes, doors and junctions, the idea of `GTA:scripts/prepare_city_streets.py:67`); lamps every 9 u on primary and secondary streets; benches, hydrants, bike racks at stops and landmarks.
7. **Walking graph.** Nodes at street intersections, steps, park paths and footway crossings, plus every ≤ 24 u. Edge cost = length × (1 + 2·max(0, grade − 0.25)) × (1.3 for steps). Stored as CSR. Drop components smaller than 50 nodes; snap places to the largest component (the idea of `GTA:scripts/build_landmark_details.py:32-56`).
8. **Far city.** Blocks come from street faces: one prism per block at the median H, with the average tint and a roof code. Towers ≥ 60 m real get their own boxes. Add the 16 u DEM, parks, coast, main streets, 41 zone polygons and a strings table (2,864 street names).
9. **Transit, places, report.**
   - `transit.json`: polylines with y, stops, turntables.
   - `places.json`: from `landmarks.json` plus curated POIs, BAYLINK planner ids and guide slugs, with `sourceUrl` and `verifiedAt`, following DESIGN §8.
   - `report.json`: counts, bytes, triangle estimates, input sha256, osm_base.
   - `ATTRIBUTION.md`.
10. **Budget asserts (fail the build):**
    - chunk ≤ 40 KB gzip, mean ≤ 22 KB;
    - total ≤ 5 MB;
    - `far.obc` ≤ 400 KB gzip and ≤ 70k L2 triangles;
    - `graph.obc` ≤ 800 KB gzip;
    - toy buildings ≤ 60k;
    - the estimated L0 cell ≤ 14k triangles.
11. **Output.** Write to `C:/Users/willy/opus-qa/sf-build/<UTC>/` (the candidate). The integrator copies it to `repo:public/opus-bay/sf/v1/` and never overwrites a previous version. This is the lesson from `GTA:scripts/rebuild_city_assets.mjs:1-5`. Add `server.watch.ignored: ['**/public/opus-bay/sf/**']` to `repo:vite.opus.config.ts:6`.

---

## 5. Runtime architecture

### 5.1 Modes and the hero seam

- **District mode is today's world, bit for bit.**
- **City mode:**
  - Build the hero first, so the first minute of play is unchanged.
  - Skip `buildSlab` (`OB:world/ground.ts:565`), the water skirt, the district water and the `skyline` board.
  - Move the islands to their real positions:
    - Alcatraz (−468.2, −58.5), shown at 1.3× so it still reads from the Pier 33 telescope;
    - Yerba Buena Island (193.3, −397.7);
    - Treasure Island (9.7, −487.4);
    - Angel Island (−939, −340).
  - The Bay Bridge keeps its hero anchorage at `BRIDGE_SF` (234, 36) (`district.ts:1062`). It runs through the real piers W2 (250.4, −1.1), W3, W5, W6 to the YBI tunnel (215.1, −360.7).
  - Hide the hero lots listed in `heroDropLots`, check `districtHash`, then call `world.enableCity(streamer)`.

**Seam rules:**
1. **Blocks are owned by one side** (≥ 60 % inside `SLAB` → hero). Nothing is ever cut diagonally.
2. **Height.** Inside `SLAB` the hero `heightAt` wins. Outside, `h = lerp(hHeroEdge, terrainY, smoothstep(0, 40, dOutside))`.
3. **Waterfront warp.** The hero's promenade is shifted 18.4 u toward the Bay (`SHIFT`, `district.ts:84`). Beyond the hero's two ends, city points seaward of a line 25 u inland of the coast move by `18.4·(1 − smoothstep(0, 160, s))`, where s is the distance along the coast. This is done offline; `unprojectCity()` inverts it for labels (`OB:game/travel.ts` currently ignores `SHIFT`).
4. **Surfaces.** Hero surfaces first, city surfaces as fallback. City surfaces are suppressed inside a hero-core mask: the waterfront strip seaward of the building line, the Telegraph Hill park and Levi's Plaza. The Embarcadero roadway stays a barrier with crosswalks.

**Ground watertightness.** City ground triangles are clipped to outside `SLAB`. Edge vertices take the hero's `heightAt`, and a 0.3 u skirt drops below. When the player is more than 300 u from the hero bbox, the hero's 150 u chunks (`OB:world/world.ts:31`) are hidden and replaced by L1 boxes of its lots; landmarks stay visible.

### 5.2 Files (`repo:public/opus-bay/sf/v1/`)

| file | size | loaded | contents |
|---|---|---|---|
| `manifest.json` | ~30 KB | after the title screen | format, version, osm_base, input hashes; geo `{K, ROT, LAT0, LNG0, curve: {datum 3, a .238, knee 90, s .65}}`; chunk 128, cell 64, bbox; `chunks[{k, bytes, sha256, land, shore, water, hero}]`; `districtHash`, `heroDropLots`; far/graph entries; attribution |
| `far.obc` | ≤ 400 KB gzip | during the arrival cinematic | L2 blocks and towers, 16 u DEM (157 × 185 uint16), land/water/park/forest polygons, primary and secondary polylines, 41 zones, names table, landmark proxies |
| `c/<cx>_<cz>.obc` | ≤ 40 KB gzip (mean ~20), about 230 files | streamed | see below |
| `graph.obc` | ≤ 800 KB gzip | lazily, on the first long route or map use | CSR: nodes f32 x, y, z; offsets u32; targets u32; cost u16 (1/100 u) |
| `transit.json`, `places.json` | ~40 / ~60 KB | with the manifest | lines, stops, turntables; places with links |

**Chunk format `OBC1`** (little-endian, gzipped offline; the worker inflates with `DecompressionStream('gzip')`). The custom extension stops Vite and Vercel from re-encoding it.

**Header (32 B):** magic u32, version u16, flags u16 (land / shore / water / hero), cx i16, cz i16, nSections u16. It is followed by a section table of `{id u16, pad u16, offset u32, len u32}`.

| section | encoding | size |
|---|---|---|
| S1 DEM | 65 × 65 u16 at 2 u, y = v/500 (0–131 u), origin (cx·128, cz·128) | 8,450 B |
| S2 buildings | u16 n; per building: nv u8 (3–12), style u8, roof u8, palette u8, H u16 (1/100 u), baseY u16 (1/500 u), flags u16, osmId u32, then nv × (x, z) i16 at 1/128 u, chunk-local | ~44 B each, ~11 KB raw typical |
| S3 roads | u16 n; per road: class u8, width u8 (1/10 u), nameIdx u16, flags u8 (bridge, tunnel, steps, oneway, rail, cable, deckOnly), np u16, then np × (x i16, z i16, y u16) | ~2–4 KB |
| S4 areas | class u8 (park, grass, forest, sand, water, pier, plaza, parking, golf), np u16, points i16 | ~2–3 KB |
| S5 props | per kind: n u16, then (x i16, z i16, rot u8, variant u8) | ~2 KB |
| S6 places | u16 index into `places.json` + anchor offset | <0.2 KB |

The shared reader and writer live in `OB:world/sf/format.ts`. A test covers the round trip, a version mismatch and a byte-length mismatch (the loader-assert habit of `GTA:src/city-mountains.ts:20-22`).

### 5.3 Cells and LOD (D7)

All render geometry is keyed by 64 u cell (683 land cells). Each cell shows exactly one tier, cross-faded over 0.3 s with the existing dither (`OB:world/materials.ts:211-229`).

| tier | built from | radius in / out (high / mid / low) | content | triangles |
|---|---|---|---|---|
| L0 | chunk file, one cell | 150/190, 120/160, 90/130 | Toy buildings from today's recipes (`OB:world/city.ts:95+`) through `TypedBatch`. Ground: 1 u verts, road-flattened, simplified with `meshopt_simplifier` (in `three/examples/jsm/libs`, 0.02 u absolute error, locked borders), vertex-coloured by class, with vertex AO from distance to footprints. Curbs. Instanced props. | ≤ 14k per cell (about 4k typical); about 17 cells built, about 75–110k visible |
| L1 | chunk file | 520/584, 420/484, 320/384 | One oriented box per toy building with a flat or gable cap (≈ 12 triangles, same palette and roof colour); 8 u ground with vertex colours; no props | ≈ 3–4k per chunk; ≈ 60–80k visible |
| L2 | `far.obc` | always | Block prisms, tower boxes, 16 u terrain, parks as canopy blobs, coast | ≤ 70k total, ≈ 30k visible |

- **Re-selection** runs when the focus moves more than 16 u or the camera yaws more than 20°. Focus = player + 20 u along the camera's forward direction; in glide, the ground point 60 u ahead.
- **Far tiers keep colour and roofs** (GTA_SZ dropped grey shells: `GTA:docs/graphics/distant-city-2026-09-06.md`).
- **Quality `high`** is today's default (`OB:core/store.ts:81`). Drei's `PerformanceMonitor` steps down to mid and then low.

### 5.4 Streaming

- **Workers.** `OB:world/sf/stream.ts` runs `CityStreamer` with two module workers: `new Worker(new URL('./worker.ts', import.meta.url), {type: 'module'})`.
- **API:** `update(focus, cam, dt)`, `whenReady(p, r): Promise<void>`, `stats()`, `dispose()`.
- **Worker job:** inflate the file, decode it, rasterise the chunk (collision rasters, §5.6), build L0/L1 typed arrays and transfer them without copying.
- **Priority** = distance(cell centre, focus + 1.5 s · velocity), with in-frustum cells first.
- **Main-thread cost.** Attach at most 1 L0 cell and 2 L1 cells per frame, each at most 2 ms (wrap into `BufferGeometry`, upload on first draw). Geometry arrays are dropped after upload.
- **Caches.** An LRU of compressed bytes up to 8 MB, so walking back never re-downloads.
- **Unloaded chunks.** A chunk that is not resident reports `standAt = −1`, which counts as blocked; vehicles slow to 30 % near it.
- **Teleports and fast travel** await `whenReady(dest, 150)`; after 8 s they cut in anyway.
- **Bandwidth.** Running crosses a chunk in 17 s. The 520 u L1 ring pulls about 8 new chunks per crossing, about 10 KB/s.
- **Memory:**
  - L0 GPU ≈ 3 MB (at ≤ 36 B/vertex);
  - L1 + L2 pools ≈ 8 MB;
  - collision rasters ≤ 16 chunks × 327 KB = 5.2 MB of JS heap;
  - nav window ≈ 5.5 MB.

### 5.5 Rendering

- **Shared materials.** Keep the shared TOY and GROUND material instances (`OB:world/materials.ts:98, 296-311`) and add no new material per chunk.
- **Compact vertices.** A new `TypedBatch implements BatchLike` uses ≤ 36 B/vertex: position f32×3, normal i8×4 (normalized), colour u8×4 (normalized), aInfo f32×4. Today's `Batch` uses `number[]` arrays at 52 B/vertex (`OB:world/builder.ts:117-121, 315-322`), and the heap peaks at about 220 MB during the World build (opus-arch §1).
- **Move the recipes.** Building recipes move into `OB:world/recipes/*.ts` with byte-identical output. The hero regression test proves this.
- **Pools.** L1 and L2 live in two `BatchedMesh` pools (TOY and GROUND-far), with one geometry per cell per tier, identity instance matrices and `setVisibleAt` for selection. Reserve about 700k vertices and 1.4M indices for the TOY pool.
- **Props.** One `InstancedMesh` per kind on `TOY_INST`, reselected after 12 u of movement. Caps:
  - trees: full 400 (≤ 120 triangles; palm LOD cut from 540 to 180), lollipop 1,200 (20 triangles);
  - lamps with halos and pools: the nearest 64 (today every lamp gets them, `OB:world/world.ts:181-220`);
  - benches 24;
  - others 32 each.

  Instances grow in rather than pop (the fade idea of `GTA:src/city-meadow.ts:117-127`).
- **Fixes before city content:**
  1. `vWN` includes `instanceMatrix` and `batchingMatrix` (`materials.ts:69`).
  2. Windows fade to their mean when too small to resolve: `unres = smoothstep(.35, 1.2, max(fwidth(g).x, fwidth(g).y))`, then mask → mix(mask, meanCoverage, unres) (the idea of `GTA:src/city-facade-diversity.ts:341-346`).
  3. Water ripple and glitter get Nyquist fades: `1 − smoothstep(.35, 1.8, fwidth(phase))` (the idea of `GTA:src/city-bay-water.ts:81`).
  4. City vertices set an aInfo flag that skips the hero-only `uBDist` and shore lookups, in the same program.
- **Shadows.** Unchanged: actors plus hero landmarks, box ±24 / ±19 u. City geometry never casts.
- **Shader-stable contract** (`GTA:docs/性能修复-2026-09-09-着色器重编译.md`):
  - never toggle lights or defines while walking;
  - fog density is a uniform;
  - `renderer.compileAsync` at boot on a dummy cell for TOY, TOY-batched, GROUND and TOY_INST;
  - QA asserts that `renderer.info.programs.length` stays constant after warm-up.

### 5.6 Terrain and collision provider (`OB:core/terrain.ts`, additions only; it never imports city code)

```ts
export interface CityTerrain {
  heightAt(x: number, z: number): number | null;       // null → far 16 u DEM
  surfaceCode(x: number, z: number): number;            // 0 = not walkable
  kindAt(x: number, z: number): number;                 // KIND codes (terrain.ts:61)
  standAt(x: number, z: number): 0 | 1 | -1;            // -1 = chunk not resident
  forEachBlockerNear(x: number, z: number, r: number, fn: (b: Blocker) => void): void;
}
export function setCityTerrain(t: CityTerrain | null, o?: { heroDropLots?: Set<number>; heroCore?: (x: number, z: number) => boolean }): void;
export function inWorld(x: number, z: number): boolean;  // replaces inSlab at the controller, camera and picker call sites
export let MAX_GROUND_Y: number;                         // 28 district / 120 city; used by the ground picker (OB:actors/system.ts:80)
```

- **Dispatch:** "inside the hero grid bbox and not off-model" is one pair of comparisons, so the 200k-query test stays under 1.5 s.
- **Chunk rasters:** `OB:core/sfTerrain.ts`, `rasterizeChunk(data, mask) → {h u16, surf u8, kind u8, stand u8}` at 0.5 u (256², 327 KB). It is pure and runs in the worker. Standing uses radius 0.45 (`STAND_RADIUS`, `terrain.ts:63`). Ground steeper than 0.9 (non-stairs) is marked not standable.
- **Residency:** within 192 u, drop beyond 256 u.
- **Blockers:** per-chunk typed hashes (offsets u32 at 4 u cells, items u16, polygon coordinates f32). A footprint is listed in every chunk it overlaps. There is never a scan over every polygon (GTA_SZ does this at `GTA:src/driving.ts:34`).

### 5.7 Navigation (two levels)

- **Local.** Today's grid A*: 0.75 u cells with a 90k expansion cap (`OB:actors/nav.ts:12-13`). In city mode it runs on a 384 u window (512², ≈ 5.5 MB of grid plus search buffers), re-centred when the player is more than 96 u off-centre (3–5 ms). `findPath()` keeps its signature.
- **Global.** `OB:core/walkGraph.ts` runs A* on `graph.obc`. The nearest node comes from 32 u buckets, never a linear scan (GTA_SZ scans linearly at `GTA:src/navigation.ts:5`). A* is time-sliced at 2 ms per frame (`GTA:src/city-autopilot.ts:106`).
- **When each is used.** Routes longer than 150 u, or leaving the window, become legs of ≤ 60 u. Each leg is refined by local A* as the walker approaches it.
- **Map.** "带我去" and tap-to-walk use this, and BAYBAY follows the local paths. She already hops back when more than 60 u away (`OB:actors/guide.ts:144`).

### 5.8 Environment

- **Camera** (`OB:game/GameRoot.tsx:29`): far 3,000; near `clamp(0.5 + 0.02·(camY − ground), 0.5, 8)`. This is GTA_SZ's fix for land and sea flickering through each other.
- **Table** (`OB:world/environment.ts:16, 158-160`): radius 3,400 centred at (240, 660), darkening from 1,600 to 3,000.
- **Fog.** Density = preset × `lerp(1, 0.4, smoothstep(30, 150, camera height above ground))`. This is a uniform change only; walking keeps today's densities.
- **Model edges.**
  - A straight layered-earth cut along the county line, reusing `slabEdge` (`OB:world/ground.ts:487`).
  - A glassy water edge about 180 u off Ocean Beach and Lands End. On the Bay side, the water runs to the East Bay board.
  - **Satellite boards** from `dem-bay-z11`, using the same curve and floating like mini-slabs (≤ 40k triangles, ≤ 3 draw calls in total):
    - Marin Headlands with the GGB north end, Hawk Hill (43.4 u) and Sausalito;
    - East Bay from the Oakland waterfront to the hill crest.
- **Water.** A camera-following 2 u wave grid (±200 u) plus flat 64 u far tiles, all on one material. The Pacific gets a deeper colour and surf bands via a mask. A global shore-distance R8 texture at 2 u covers the city bbox (1,250 × 1,475, 1.8 MB).
- **Karl the Fog (M5).** A height-limited western fog term injected into GROUND, TOY, water and sky by a `patchFog()` helper. Never patch `THREE.ShaderChunk`: the site's Little Bay shares the same three. Add 40–80 instanced cotton cloud clusters from the cloud builder (`OB:world/backdrop.ts:412-422`), sliding in at morning and golden hour.

### 5.9 UI, zones, map, info

- **Zones.** Hero zones first, then the 41 DataSF neighbourhoods (via a 64 u grid index), then `san-francisco`. Never fall back to "The Embarcadero" (`OB:ui/Hud.tsx:34` today). The HUD shows neighbourhood and nearest street name.
- **Map.** `OB:ui/CityMap.tsx` draws `far.obc` to a canvas in about 10–20 ms. The existing SVG point-of-interest layer sits on top. It carries an ODbL credit line, and neighbourhoods reveal on first visit.
- **Labels.** A second, paged 2048² label atlas, because `OB:world/labels.ts` never checks for overflow.
- **Travel labels.** `OB:game/travel.ts:12` duplicates the walk speed as `GAME_WALK = 4.2`; import `WALK_SPEED` instead.
- **Real info rules unchanged** (`OB:DESIGN.md:80-83`): `sourceUrl` + `verifiedAt`, and planner or guide links only for ids that exist.

### 5.10 Budgets per view

| group | draw calls | triangles |
|---|---|---|
| hero (when within 300 u) | 52–64 (`OB:STATUS.md:38-45`) | 144–223k |
| city L0 (visible cells × 2) | ≤ 24 | ≤ 110k |
| L1 + L2 pools | 2–4 | ≤ 110k |
| props and trees (instanced) | ≤ 12 | ≤ 40k |
| vehicles, transit, BAYBAY rides | ≤ 8 | ≤ 20k |
| satellites, fog bank, water | ≤ 8 | ≤ 60k |
| **walk-mode limit** | **≤ 150** | **≤ 400k including shadows** |

When the hero is near, the L1 radius drops one quality step, so hero plus city stays at or under 400k. Other limits:
- first-load assets ≤ 3 MB (`DESIGN.md:89`);
- the city code is a lazy chunk ≤ 40 KB gzip and the worker ≤ 70 KB gzip;
- split `GameRoot` first (198.6 KB gzip against a 250 KB page budget, `OB:STATUS.md` bundle table).

---

## 6. Movement and vehicle spec

### 6.1 State machine (`OB:actors/modes.ts`, pure and unit-tested)

`MoveMode = 'foot' | 'sit' | 'bike' | 'car' | 'transit' | 'glide' | 'travel' | 'photo'`

Contract change (owned by the integrator): `OB:core/store.ts:42`, `riding: 'streetcar' | null`, becomes `move: { mode: MoveMode; line?: string; spot?: 'rail' | 'seat' | 'deck' }`.

| from | trigger | guard | transition | to |
|---|---|---|---|---|
| foot | F | a door slot is within 2.4 u; player |v| < 0.8; the vehicle is stopped | board (0.45 s) | bike / car |
| bike / car | F | a slot is clear: `canStand(slot, 0.45)`, Δh ≤ 0.55, straight clear line sampled every 0.15 u | auto-brake at 24 u/s² until |v| < 1.2 (≤ 0.7 s), then alight (0.4 s); if no slot is clear, toast "这里下不了车" | foot |
| foot | hold F 0.6 s | own vehicle > 25 u away | the vehicle drives up via autopilot in ≤ 4 s | — |
| foot | E at a stop | — | wait ≤ 5 s (`OB:game/ride.ts:72`), board (0.5 s) | transit |
| transit | E | — | switch spot (rail ↔ seat) | transit |
| transit | Space | — | car brakes 1.2 s, alight (0.4 s) | foot |
| foot | G | grounded; glide unlocked | take-off swoop (1.0 s) | glide |
| glide | G, or tap/long-press 650 ms | — | landing (≤ 3 s) at the resolved spot | foot |
| any free mode | map "飞过去" | place discovered | travel (2.5–8 s) | foot |
| foot | E at a bench, step or seat | — | 0.35 s snap to the seat | sit (any move → foot) |
| any mode | dialogue, photo or cinematic | — | freeze; a moving vehicle auto-brakes first (≤ 1.5 s) | — |

**Door slots** follow `GTA:src/city-walk.ts:15-35`, adapted: 4 slots at ±(W/2 + 0.9) to the side and ±(L/2 + 0.6) fore and aft.

**Integration.** Vehicles sub-step at 120 Hz, at most 12 sub-steps per frame, with at most 0.3 u per step. `OB:actors/system.ts:388` already clamps dt to 0.1.

### 6.2 On foot (`OB:actors/controller.ts`)

- **Keep** walk 4.2 / run 7.5, accel 24 / decel 30, turn 13, and the jump: 8.2 up, gravity 24 up / 40 down, coyote 0.1 s, buffer 0.12 s, cut 0.55 (`:18-33`).
- **Grade** is g = Δh/Δs over 0.6 u along the motion.
  - Uphill: × `max(0.55, 1 − 0.45·g)`.
  - Downhill: × `1 + 0.12·min(1, |g|/0.5)`.
  - Stairs: ×0.8 up and ×0.9 down, stride 0.5 (`:31`).
  - **g > 0.9 on a non-stairs surface is a wall.** It feeds `moveDisc`; today `MAX_RISE 0.55` per 0.18 u sub-step (`:37-39`) has no steepness limit.
- **No stamina.** After 10 s of running uphill at g > 0.25, play a 2 s pant animation at the crest. BAYBAY's line about it has a 60 s cooldown.
- **Sit.** E at bench, step and seat anchors.
- **Moving platforms** (`OB:actors/platform.ts`): `{toLocal, toWorld, deckPolygon, heightLocal, v}`. On a deck, the controller steps in local space. This replaces pinning the player to the car's side step (`OB:actors/system.ts:396-446`).

### 6.3 Bike (`OB:actors/vehicles/bike.ts`)

| property | value |
|---|---|
| size | length 1.3 u, wheelbase 0.95 |
| speed | cruise 9 u/s, sprint 11.5 (Shift / RB) |
| accel / brake / coast | 8 / 18 / 1.5 u/s² |
| uphill | vmax × `max(0.45, 1 − 0.9·g)`; stand-pedal animation when g > 0.3 |
| steering | δmax = `0.7/(1 + 0.12·v)`; ω = `v/0.95·tan δ` |
| lean | `0.8·atan(v·ω/9.8)` |
| hop | Space: vy 5, g 24 → apex 0.52 u |
| surfaces | roads, plazas, paths; grass ×0.7 |
| blocked by | stairs, water, buildings; hint "楼梯要走上去 · F 下车" |

Bikes come from the existing `bike-rack` props (`district.ts:941`) and new racks at stops and landmarks. A bike left more than 80 u away returns to the nearest rack.

### 6.4 Kiddie toy car (`OB:actors/vehicles/toyCar.ts`)

| property | value |
|---|---|
| size | L 1.8, W 1.0, wheelbase 1.1; hitbox half-extents 0.95 × 0.55; open top, with the newcomer's torso and hat above the rim |
| top speed | 14 u/s; reverse 4.5 |
| drive | `a = 10·t·(1 − v/vmax_eff)` |
| brake / coast | 24 / 3 (no drag term) |
| uphill | `vmax_eff = vmax·max(0.35, 1 − 0.9·g)` → about 7.2 u/s at g = 0.54 |
| downhill | `−9·g`, capped at 1.25·vmax; hill hold when coasting keeps ≤ 6 u/s |
| keyboard steering | `u·(0.85 − 0.25·min(1, v/vmax))` (the shape of `GTA:src/driving.ts:5`) |
| wheel angle | δmax = `0.6/(1 + 0.09·v)`, rate 9 |
| turning | ω = `v/1.1·tan δ`; full-lock radius 2.7 u at 6 u/s, so a 3.6 u street corner is taken at ≤ 6 u/s |
| crest hop | grade drops by more than 0.25 within 2 u at v > 9 → vy = 0.12·v, squash on landing |
| hop | Space: vy 4.5, cooldown 0.6 s |
| body pose | pitch from terrain front/rear (the idea of `GTA:src/city-world.ts:513`) − 0.006·a; roll `clamp(−0.012·v·ω, ±0.12)` |
| surfaces | roadway, plaza, parking; grass and sand ×0.5 |
| blocked by | steps, footway-only paths, buildings, water |

**Collision** (`OB:actors/vehicles/collide.ts`, shared with the bike):
- 3 nose probes and 2 tail probes; the wall normal comes from the 32-sample ring of `moveDisc`.
- **Slide, don't stick:** tangential velocity ×0.85, normal velocity bounces at −0.3·v_n, yaw eases toward the tangent at rate 6. GTA_SZ instead reverts the pose (`GTA:src/city-world.ts:509`).
- A `bump` event fires with strength |v_n|/vmax. Above |v_n| = 5 the car squashes and BAYBAY says "哎呀".
- R puts the car back on the nearest roadway centreline. R is already the reset key (`OB:core/input.ts:74`).

**Tap-to-drive** uses pure pursuit on the graph: look-ahead `clamp(3 + 0.4·v, 4, 8)`; corner caps of 1.9 / 3.3 / 6 u/s (GTA_SZ's 3.5 / 6 / 11 from `city-autopilot.ts` scaled ×0.55); arrival radius 1.5 u.

### 6.5 Transit (`OB:game/transit.ts` + `OB:data/transit.ts`, with a generalised `OB:game/ride.ts`)

A line is `{id, kind, path (x, z, y), stops[{id, at}], vmax, acc, dwell, spots}`. Today's `world/streetcar.ts` (VMAX 11, VMAX_RIDE 13, ACC 2.6, DWELL 6) becomes the F-line instance.

| line | route (source) | length | ride |
|---|---|---|---|
| Powell–Hyde cable car | rel 1959009: Powell & Market (129, 258) → Hyde turnaround (−222, 136) | 456 u | cable 9 u/s constant; grip accel 3 u/s²; dwell 4 s at every second block; ≈ 51 s of motion |
| Powell–Mason / California | rel 1959010 / 2852264 | 346 / 320 u | same; California cars are double-ended, with no turntable |
| F-line | rel 2007934, Wharf → Castro (≈150, 740) | 1,136 u | VMAX 11/13 as today, ≈ 90 s |
| Ferry v1 | Ferry Building ↔ Pier 41 | ≈ 350 u | 9 u/s, walkable deck platform, roll `0.02·sin(0.9t)` |
| Ferry v2 | Pier 33 ↔ Alcatraz | ≈ 370 u | only once the island is walkable |

**Cable-car details:**
- **Turntables** at Powell & Market (node 8641952045), Hyde & Beach and Taylor & Bay, each with an E-mash "help push it round" moment.
- **Spots.** Rail: the running board at local (±1.25, 0.45, z ∈ [−1.5, 1.5]), with a pole-hang lean of 12°. Seat: bench anchors. On the rail, E plays the bell rhythm.
- **Track height** is sampled from `terrainY`, so car pitch equals track grade. Hyde St at about 20 % real becomes about 34 % in the world.
- **Body:** a procedural 5.6 × 2.0 × 2.6 u model, sized to match the streetcar family (CAR_LEN 8.4).

**Goals** count only after at least one real stop-to-stop segment (GTA_SZ's ≥ 150 u odometer rule, `GTA:src/city-life.ts:8`). Fast travel never counts.

### 6.6 Pelican glide (`OB:actors/glide.ts`)

The glide reuses `public/opus-bay/models/pelican.glb` (2,909 triangles; "for glide use the same mesh tilted", `OB:ASSETS-LEDGER.md:40`). The newcomer rides on its back with BAYBAY in front. Gulls stay ambient. It unlocks at the Coit viewpoint, where the map unlocks today.

| aspect | value |
|---|---|
| speed | cruise 14 u/s; boost 20 (Shift / RT); slow 9 (S / LT) |
| attitude | pitch → 0.45·input at rate 1.8; roll → 0.7·steer at rate 2.5 |
| turning | yaw rate `tan(roll)·0.9`; wings level themselves with no input |
| crashes and stalls | none |
| soft floor | max(terrain, roofs within 6 u) + 6; a spring with k = 4 pitches up below it |
| ceiling | 260 u |
| model edge | within 30 u of the edge the pelican turns back at 0.8 rad/s |
| buildings | swept-prism look-ahead of 2 s as a repulsor (the idea of `GTA:src/city-flight-collision.ts:8-24`) |
| landing | nearest `canStand` point within 40 u, never water (the resolver idea of `GTA:src/city-observer-destination.ts`); 2–3 s descent, then a hop and squash |
| world | keeps running |
| streaming | above 40 u above ground, the L0 radius drops to 60 u |

### 6.7 Discovery and fast travel (`OB:game/discovery.ts`, `OB:game/fastTravel.ts`)

A place is discovered when you come within 12 u of its anchor. Map actions (`OB:ui/MapPanel.tsx` offers only "带我去" today):
- **"飞过去"**, for discovered places only. The sequence:
  1. pelican pickup, 0.8 s;
  2. rise to a top view (pitch 1.1, distance 90);
  3. pan at ≤ 400 u/s for ≤ 3.5 s;
  4. hold in "cloud" until `whenReady(dest, 150)` resolves, cutting after 8 s;
  5. 1.2 s descent to the arrival anchor, facing its zone view.
- **"带我去"**: walks along the graph route.
- **"骑车 / 开车去"**: when your vehicle is within 60 u, draws breadcrumbs and can autopilot.

Travel sets an anti-cheat flag so it never completes ride goals (the idea of `GTA:src/main.ts:105`).

### 6.8 Camera per mode (`OB:actors/cameraModes.ts`; `OB:actors/camera.ts` delegates)

| mode | distance / height | pitch | FOV (°) | follow and re-centre | occlusion |
|---|---|---|---|---|---|
| foot | 7–30 (15) as today (`camera.ts:23-28`) | zoom keys | 42 (+3 when running) | today's rig | dither + swing |
| bike | 9 + 0.25v (≤ 12) | 0.24 (+0.2 when the road ahead drops) | 44 + 0.4v (≤ 50) | moved with the vehicle's delta, then exp 8; behind the heading 1.0 s after a drag | dither + pull-in (≥ 4 u) |
| car | 10 + 0.25v (≤ 13), height 3.2 | 0.26 + 0.25·max(0, −g ahead at 8 u) | 44 + 0.6v (≤ 52) | moved with the vehicle's delta (`GTA:src/city-world.ts:516-519`); 2 s hold after a drag, then rate 3 | pull-in (≥ 4 u) |
| cable car | rail 7 / seat 11 | 0.2 | 46 | fixed to the car frame, on the downhill side | fixes the "car body between camera and rider" issue |
| ferry | foot rig in the deck frame | — | — | auto-orbit at 24 u after 4 s idle | — |
| glide | eye `p − f·16 + (0, 5, 0)` | — | 50 + 0.4(v − 14) | exp 6 | pull-in to the hit − 1.2 |
| sit | zone view, or 12 u from the bench | 0.22 | 42 | — | — |

Camera logic tied to the Embarcadero line (`camera.ts:186, 777`) is replaced by `preferredViewDir(x, z)`: the hero keeps today's rule; the city uses a precomputed 16 u field that points toward open ground, low ground or water. The GGB towers, Sutro Tower and Salesforce Tower are registered for `heroClear` (`camera.ts:64-78`).

### 6.9 BAYBAY per mode (`OB:actors/guide.ts`, `OB:actors/system.ts`)

- **Bike:** sits in the front basket.
- **Car:** passenger seat.
- **Cable car:** running board beside you.
- **Ferry:** walks the deck (platform-local follow).
- **Glide and travel:** carried along.
- **Boarding:** if she is within 25 u, she runs over and hops in using the existing 0.4 s `hopIn` arc (`guide.ts:102-117`), and the throttle is gated until she is seated (≤ 1.5 s). If she is farther away, she pops in with a puff.
- **Alighting:** she hops to your side slot.
- **Lines** fire on firsts: first hill with g > 0.4, crest hop, cable-car bell, each new neighbourhood. Each has a 60 s cooldown.

### 6.10 Input (`OB:core/input.ts`)

E/Enter (`:63`) and R (`:74`) are taken today. F, G, H and C are free.

| action | keyboard | gamepad | touch |
|---|---|---|---|
| move / steer | WASD / arrows | left stick | floating stick |
| throttle / brake | W / S | RT(7) / LT(6), analog | stick y |
| run / sprint | Shift | RB(5) | stick > 0.92 |
| jump / hop / get off transit | Space | B(1) | action button |
| interact / board / sit | E, Enter | A(0) | contextual action button |
| enter / exit (hold = call vehicle) | F | Y(3) | "上车 / 下车" pill |
| horn / bell | H | LB(4) | 56 px button while riding |
| glide | G | L3(10) | "起飞 / 降落" button |
| map | M | View(8) | HUD |
| camera near / far preset | C | D-pad up / down | pinch |
| reset / unstick | R | R3(11) | — |

Never call `preventDefault` (`input.ts:58-60`). Tap-to-walk becomes tap-to-drive while in the car.

### 6.11 Save v2 (`OB:data/save.ts`)

The key is `opus-bay:save:v2`:

```ts
{ version: 2, discovered: string[], vehicles: { bike?, car?: { x, z, heading } },
  lastSafe: { x, z, heading }, unlocked: { glide: boolean }, rides: Record<lineId, number> }
```

Decode it as untrusted input: drop bad rows, clamp positions to the model, snap `lastSafe` with `nearestWalkable` (the idea of `GTA:src/city-observer-beacon-state.ts:23-37`). The title screen offers "继续上次的位置". The existing wishlist key `opus-bay:wishlist:v1` is unchanged.

### 6.12 Ambient life (M5)

- **Crowd:** 64 instanced walkers on sidewalk bands within 90 u.
- **Toy traffic:** 24 cars on graph lanes within 220 u at 5–9 u/s, with a 4 u queue gap. The 31 s signal cycle is optional.
- **Pedestrians hop aside:** they predict the player's vehicle 1.5 s ahead, and if it will pass within 1.2 u they hop 1 u sideways with a "!". Otherwise the car stops with a bump. There are no knockdowns; GTA_SZ has them in `GTA:src/pedestrian-impact.ts`.
- **Hero life** (`OB:world/life.ts`) pauses when the player is more than 300 u from the hero.

---

## 7. Landmarks

Positions come from `sfd:landmarks.json`. Heights come from §2.2 and §2.3. Every landmark is one module, `OB:world/sf/landmarks/<id>.ts`, exporting `build(b: BatchLike, lod: 0 | 2): HeroSpec`, plus a registry record in `OB:data/sf/landmarks.ts` with:
- id, lat/lng, tier, height policy;
- arrival anchor, photo pose (distance, target height, elevation);
- exclude radius and the osmIds it replaces;
- `sourceUrl`, `verifiedAt`, BAYLINK link.

**T1: visible from several districts.** ≤ 6k triangles and ≤ 2 draw calls each (GGB ≤ 12k).

| id | world (x, z) | method | notes |
|---|---|---|---|
| Golden Gate Bridge | towers (−796.1, 564.4) / (−935.5, 452.7) | procedural | towers 42.2 u, deck 15.2 u, span 178.6 u; cables as thin boxes |
| Sutro Tower | (73.2, 973.7) | procedural lattice | mast 49.4 u on 46.5 u ground: the highest point in the world, a compass |
| Twin Peaks | (140.1, 946.9) | terrain + overlook plaza | the city-reveal viewpoint |
| City Hall | (92.3, 418.2) | procedural lathe dome | H 17.8 u on 3.5 u ground |
| Palace of Fine Arts | (−420.3, 422.3) | AI rotunda + procedural colonnade and lagoon | 10.8 u |
| Golden Gate Park set | centre (−334.8, 1080.6) | terrain, canopy, paths | de Young tower procedural (10 u) |
| Bay Bridge at real piers | W2…W6, YBI | existing builder | TOP 30 kept |
| Salesforce, Transamerica, Coit, Ferry Building | — | existing | re-verified against the 8 checks |
| Alcatraz | (−468.2, −58.5) | existing model, ×1.3 | — |

**T2: neighbourhood anchors with a plaza and an info card.** ≤ 2.5k triangles each (AI meshes ≤ 6k).
- Painted Ladies row: 7 instances of AI houses A and B, tinted.
- Chinatown Dragon Gate (81.9, 174.7): AI.
- Lombard crooked block (−157.6, 168.0): terrain hairpins.
- Fisherman's Wharf, Hyde St Pier, Ghirardelli: no trademark signage.
- Conservatory of Flowers (−184.2, 852.9): AI.
- Dutch windmill (−580.7, 1311.9): AI body with procedural rotating sails.
- Mission Dolores (195.5, 647.6) with Dolores Park.
- Castro Theatre marquee: generic, no text.
- Union Square with the Powell turntable.
- Grace Cathedral.
- Oracle Park: no logos.
- Legion of Honor.
- Cliff House and Sutro Baths.
- Crissy Field, Fort Point, Presidio Tunnel Tops.
- Ocean Beach / Sunset Dunes.
- Japantown Peace Pagoda.

**T3: flavour.** ≤ 800 triangles each: Wave Organ, Baker Beach, Bernal Hill, the Mt Davidson cross, Stow Lake, Yerba Buena Gardens, Chase Center, 16th Ave Tiled Steps, Balmy Alley (original murals only), the bison paddock, Telegraph Hill parrots.

**Rule** (`GTA:docs/landmarks/shenzhen-landmark-roadmap.md:7`): finish a landmark *and 150–300 m (21–42 u) of believable street around it* before starting the next.

**Finished routes gate expansion.** Three routes, each tied to BAYLINK content that already exists:
1. Chinatown → North Beach → Coit (`chinatown`; guide `sf-chinatown-north-beach-walk-guide`).
2. Marina → Palace of Fine Arts → Crissy Field → Fort Point / GGB (`palace`, `golden-gate`, `presidio`).
3. Golden Gate Park JFK Promenade → Ocean Beach (`golden-gate-park`; guides `golden-gate-park-free-car-free-day-guide`, `sf-sunset-dunes-october-coastal-walk-2026`).

The integrator re-checks these ids against `repo:public/planner-catalog.json` and `baybay-guides.json` (process §11.2).

---

## 8. Asset plan (Higgsfield)

**Cap and reserve.** Balance is 748.48; the owner's allowance is 500; the **hard cap is 450**, leaving a floor of 298.48 after this round. Log every job in `OB:ASSETS-LEDGER.md` (append-only) and check `transactions` after every batch.

**Unit costs** (`get_cost` preflights in asset-scout §4): nano_banana_pro 2k 2 credits; gpt_image_2_5 high 1k 1.5; Tripo H3.1 12 (detailed texture); Hunyuan3D LowPoly 14; SAM 3 3D 1; Meshy image_to_3d 30; Meshy multi-image 30. W is the per-mesh cost of the bake-off winner: 12 if Tripo wins (expected), 30 if only Meshy passes (worst case).

| # | item | model and params | expected | worst |
|---|---|---|---|---|
| S0 | 2 Victorian concepts (Queen Anne with turret; Italianate with bay) | nano_banana_pro 1:1 2k ×2 each, style ref K6 `3617006b-…` | 8 | 8 |
| S1 | **3D bake-off on house A** | sam_3_3d (1) + tripo_h3_1 {face_limit 6000, texture detailed} (12) + hunyuan3d_v3 LowPoly (14) + Meshy target 6000 (30) | 57 | 57 |
| S2 | 8 neighbourhood style targets (art direction, not shipped) | nano_banana_pro 1:1 2k ×2 | 16 | 16 |
| L1 | Victorian house B mesh | W | 12 | 30 |
| L2 | Palace of Fine Arts rotunda | concept ×2 + W | 16 | 34 |
| L3 | Chinatown Dragon Gate (walk-through, opening ≥ 2.2 u, no text) | concept ×2 + W | 16 | 34 |
| L4 | Conservatory of Flowers | concept ×2 + W | 16 | 34 |
| L5–L7 | windmill body, Mission Dolores, bison (skipped in the worst case) | concept ×2 + W each | 48 | 0 |
| LR | 3D retake reserve | 3 × 12, or 1 × 30 | 36 | 30 |
| V1 | reference sheets for the procedural cable car, toy car and bike | nano_banana_pro 2k ×3 | 6 | 6 |
| T1 | 12 postcards (GGB in fog, Painted Ladies, Palace, cable car on a hill, Chinatown lanterns, Lombard, murals, Dolores Park, windmill, City Hall, Twin Peaks view, Ocean Beach) | nano_banana_pro 4:3 2k, refs P5 + P13, 1.75× retake factor | 42 | 42 |
| T2 | illustrated SF map, repainted from our own geometry render | nano_banana_pro 1:1 4k img2img ×2 + seedream alternative | 10.5 | 10.5 |
| T3 | neighbourhood badges (2 sheets of 3×3) | nano_banana_pro 2k | 6 | 6 |
| T4 | 8 original murals (not copies of real ones) | gpt_image_2_5 high 1k + 4 retakes | 18 | 18 |
| T5 | shopfront strips, only if T6 wins | nano_banana_pro 16:9 2k ×4 + 2 | 12 | 12 |
| T6 | textured-vs-shader facade A/B test | gpt_image_2_5 medium ×4 | 2 | 2 |
| T7 | 6 resident portraits (gripman, bakery, muralist, gardener, ranger, record store) | nano_banana_pro 1k + background removal + retakes | 24 | 24 |
| A1 | ~20 BAYBAY barks (mode firsts, neighbourhood arrivals) | TTS | ≤ 10 | ≤ 10 |
| | **total** | | **355.5** | **373.5** |

**Order:**
1. S0 + S1;
2. 6 postcards;
3. L2, L1, L3;
4. T2 (needs the whole-SF render);
5. the other 6 postcards;
6. T3, L4, T6 → T5, T4, L5, T7, L6, L7.

**Stop rules:**
- If no model passes the QA gate on house A, stop all 3D.
- If two landmarks in a row fail after one retake each, stop 3D.
- Reject a concept that has text, a base or plinth, or clipped edges before paying for 3D.
- Once spend passes 400, only items 1–10 continue.

**3D QA gate:**
- silhouette IoU ≥ 0.85 against the concept;
- < 1 % non-manifold edges and ≤ 3 islands after cleanup;
- ≥ 80 % of texels within ΔE 12 of the palette after grading;
- recognisable at 64 px in an in-game `opus-shot`.

**Post-processing** extends `C:/Users/willy/opus-qa/assets-work/creatures/cleanup.py`:
1. weld;
2. flatten the base;
3. planar-dissolve at 3° for architecture;
4. grade the palette;
5. a 256² mask WebP (R = night glass by the stencil `(B−R ≥ 28) & (G−R ≥ 18)`, from `GTA:scripts/make_facade_diversity_atlas.py:57`; G = tint region);
6. export GLB with Draco (level 6, positions 14 / normals 10 / UVs 12) and WebP q82. Measured saving: 57–67 %, e.g. pelican 223.8 → 89.7 KB.

The Draco decoder (250,876 B) is copied from `repo:node_modules/three/examples/jsm/libs/draco/gltf/` into `public/opus-bay/draco/`.

**Runtime for AI assets:**
- One `OB:world/models.ts` loader, moved from `OB:world/life.ts:308`.
- `makeToy` gains `map`/`mask` options under an `OB_MAP` define, so AI meshes get night windows, tinting, contact AO and the dither fade. Enabling the define is a new program; warm it at boot.
- Near-player house swap: at most 12 instances within 40 u.
- Per view: ≤ 60k triangles, ≤ 12 draw calls, ≤ 6 shadow casters for AI assets.

**Size targets:** hero ≤ 250 KB (6–10k triangles, 1024² texture); house ≤ 90 KB (2.5–3.5k triangles, 512²). All new GLBs together ≤ 2.5 MB, loaded lazily per neighbourhood.

---

## 9. Module plan and lanes

**Day 0 — the lead or integrator publishes these contracts:**
- `OB:core/geo.ts`: `project`, `unproject`, `terrainY`, `demFromY`, `buildingH`, `STREET_ROW`.
- `OB:world/sf/format.ts`: types, `decodeChunk`, `decodeFar`, and the `CHUNK = 128` / `CELL = 64` constants.
- The `CityTerrain` and `CityStreamer` interfaces.
- `settings.worldMode`, `store.move`, `runtime.city` / `runtime.vehicle` / `runtime.glide`.
- The far and near camera planes.
- A hero regression test.
- The `GameRoot` bundle split.

| lane | owns (only this lane edits these files) |
|---|---|
| A data | `repo:scripts/opus-sf/**`; candidates in `opus-qa/sf-build/`; `repo:tests/opus-bay-sf-{format,data}.test.ts` |
| B terrain and nav | `OB:core/terrain.ts` (additions only), `OB:core/sfTerrain.ts`, `OB:core/walkGraph.ts`, `OB:actors/nav.ts` |
| C world | `OB:world/sf/{stream,worker,cell,far,pools,props,water,boards,fog}.ts`, `OB:world/recipes/*`, `OB:world/{world,environment,materials,palette,water,ground}.ts`, `OB:world/WorldScene.tsx` |
| D landmarks | `OB:world/sf/landmarks/<id>.ts`, `OB:data/sf/landmarks.ts`, `opus-qa/landmarks/<id>/` |
| E movement | `OB:actors/{modes,platform,glide,cameraModes,controller,camera,system,guide}.ts`, `OB:actors/vehicles/*`, `OB:core/input.ts`, `OB:ui/TouchControls.tsx` |
| F transit, life, audio | `OB:game/{transit,ride}.ts`, `OB:data/transit.ts`, `OB:world/{cablecar,streetcar}.ts`, `OB:world/sf/{crowd,traffic}.ts`, `OB:audio/*` (`buildShoreField` takes an `isLand` function; `OB:audio/logic.ts:146-200` assumes the Bay is to the north) |
| G flow and UI | `OB:game/{fastTravel,discovery,brain,qa,travel}.ts`, `OB:data/{save,cityZones}.ts`, `OB:data/sf/places.ts`, `OB:ui/{CityMap,MapPanel,Hud,CoachMark}.tsx` |
| H assets | Higgsfield jobs, `OB:world/models.ts`, `OB:data/assets.ts`, `repo:public/opus-bay/{models,postcards,portraits,draco}/` |

**Process rules**, following `GTA:docs/landmarks/agent-workflow.md` and the gameplay goal file:
- At most 4 builder agents plus 1 integrator.
- At most 1 Blender job and 2 headless Chromes at a time.
- Briefs use the Goal / Read first / Keep / Deliver / Check format.
- 1 build plus at most 2 targeted fixes, then an escalation note.
- "Build passes" is never reported as "looks right"; every fps number names viewport, throttle, route and duration.

---

## 10. QA gates and tests

- **G0 (M0).**
  - A hero regression test pins district-mode World geometry. opus-arch measured 375,899 vertices, 232,511 static triangles and 62 chunks; re-measure at M0 and pin that.
  - The terrain grid hash is unchanged.
  - 104/104 tests pass; tsc and eslint report 0 errors.
- **G1 (M1: all of SF visible).**
  - From Coit and from Twin Peaks, the owner can name Golden Gate Park, the Presidio, the Market diagonal, downtown and Sutro on a contact sheet.
  - The table colour `#f3ecdf` covers less than 5 % of the upper half of the frame at every T1/T2 arrival point at golden hour.
  - L2 adds ≤ 4 draw calls.
  - `far.obc` ≤ 400 KB.
- **G2 (M2: walk anywhere; the default flips to city mode).**
  - Height steps < 0.3 u per 0.5 u across the seam and across chunk borders.
  - No load/unload flapping when oscillating ±10 u on a border.
  - ≤ 1 L0 and 2 L1 attaches per frame.
  - 0 frames over 100 ms from streaming after the first lap.
  - `programs.length` stable.
  - Every place's arrival point stands and is reachable from `ferry-gate` on the graph.
  - Perf at 6 spots (Ferry gate, Chinatown, Twin Peaks, Ocean Beach, GGB south anchorage, Mission), at 1× and 4× throttle, on desktop and 390×844:
    - ≥ 45 fps mean at 4×;
    - desktop 1× p95 ≤ 18 ms and p99 ≤ 25 ms.
- **G3 (movement).** Node tests:
  - FSM guards: blocked slot, auto-brake exit, no glide before unlock;
  - car: top speed, uphill speed at g = 0.54, turn radius ≤ 3 u at 6 u/s, slides rather than sticks on walls;
  - bike: blocked by stairs;
  - glide: never below its floor;
  - fast travel: discovered places only;
  - transit: goals need a real ride.

  Plus `opus-shot` runs: car on Filbert, cable car on Hyde, glide over Coit, and mobile.
- **G4 (per landmark), 8 checks** (`GTA:docs/landmarks/agent-workflow.md:132-144`, adapted):
  1. silhouette at 64 px;
  2. height policy;
  3. orientation within ±10°;
  4. centroid within 3 u of `project()`;
  5. context: plaza present, no overlap;
  6. walk-around ring without sticking;
  7. triangle and draw budget;
  8. info card with `sourceUrl`, `verifiedAt` and a BAYLINK link, checked at day, golden hour and night from the same camera.

  Results go to `opus-qa/landmarks/<id>/validation.json`.
- **G5 (routes).** A named place or interactable at least every 225 u (≈ 30 s of running); a T1 or T2 landmark on screen in ≥ 90 % of benchmark frames.

**Tools:**
- `repo:scripts/opus-sf-tour.mjs` (after `GTA:scripts/city-tour.mjs`).
- `repo:scripts/opus-sf-bench.mjs`: drives real CDP key input along graph routes, drops the first 120 frames, and reports p50/p95/p99, frames over 50 ms, long tasks, calls, triangles, programs and chunk loads. It fails on a > 10 % p95 regression. Today's `opus-shot` fps is a frame-count mean (`repo:scripts/opus-shot.mjs:63`).
- `repo:scripts/opus-sf-shots.mjs`, with a shot list in `OB:data/sf/shots.ts`.
- URL flags: `?world=city`, `?at=ll:<lat>,<lng>`, `?solo=<landmarkId>` (turntable, 6 views).
- `__opusBay.city.stats()` returns `{l0, l1, l2, queued, inflight, workerMs, gpuMB}`, shown in the `?debug=1` overlay.

**New test files:** `opus-bay-sf-{format,data,terrain,nav,stream,landmarks,modes,vehicles}.test.ts`. City tests never register a provider inside district-mode suites.

---

## 11. Milestones

| M | content | gate |
|---|---|---|
| M0 | contracts, `core/geo.ts`, hero regression test, `GameRoot` split, `materials.ts:69` fix, window fade to mean, `TypedBatch` + recipes moved (output identical) | G0 |
| M1 | data build v1; `far.obc` + L2; city water, table and satellite boards; islands moved; far plane and near rule; canvas map | G1 |
| M2 | chunk files; workers; L0/L1; terrain provider; seam; nav window + graph; zones and HUD | G2 |
| M3 | FSM + grade + sit → bike → Powell–Hyde cable car (then Mason and California) + F-line to the Castro → discovery + fast travel + save v2 → pelican glide → toy car | G3 |
| M4 | T1 landmarks; 3 finished routes; S0–L4 assets; postcards; map repaint | G4, G5 |
| M5 | ferry; crowd and toy traffic; Karl fog; night light field; T2/T3; remaining assets | perf re-run |
| M6 | full benchmark; owner playtest on desktop and phone; STATUS/RESUME update | all |

---

## 12. Open questions

1. **iPhone Safari and `WEBGL_multi_draw`.** Without it, L1/L2 `BatchedMesh` falls back to one draw per geometry (`WebGLRenderer.js:1315-1336`). Measure on the owner's phone at M1. If it is missing, merge L1/L2 per 256 u tile (≤ 20 draws).
2. **How free should the car be?** The default is the kiddie car on roads and plazas only. Should it be unlocked from the start or earned (e.g. at the first garage)?
3. **Alcatraz scope.** Is it walkable (enabling ferry v2), or backdrop only?
4. **Telescope framing.** Moving the islands to their real positions changes the Pier 33 and Pier 14 telescope shots and the Coit sweep (`OB:game/flow.ts`, `OB:game/cinema.ts`). Re-shoot them at M1.
5. **Missing data.** Download the DataSF street-tree list. Do we want Assessor year-built data for building styles?
6. **Terrain attribution.** Confirm the terrain-tiles attribution text and where the ODbL credit shows (map panel plus credits).
7. **Karl's default.** Should Karl the Fog be on in the morning preset by default (it hides far edges, but some players want the view)?
8. **Ferry v1 destination.** Pier 41 (inside the hero) or Sausalito on the Marin board?

## 13. Top risks

| risk | mitigation |
|---|---|
| Phone frame spikes from streaming (uploads, GC) | Workers with transferables; ≤ 1 L0 attach per frame; typed batches (today's heap peaks at about 220 MB); G2 perf at 390×844 × 4× throttle |
| Hero/city seam: height steps, duplicate buildings, the 18.4 u waterfront jump | Block ownership, 40 u blend, tapered warp, `heroDropLots` + `districtHash`, seam tests |
| Far city reads as grey boxes (GTA_SZ's own lesson) | L1/L2 keep palette and roofs; neighbourhood palettes; landmark density gate G5 |
| Scope creep: breadth over street quality (`GTA:docs/benchmark/current-game-audit.md:7`) | Three finished routes before T2/T3; each landmark ships with its street |
| Shader recompile hitches | Shader-stable contract; `compileAsync` warm-up covering batching and `OB_MAP` variants; programs-count assert |
| Hills vs the controller: no steepness limit today | Grade model with a 0.9 wall; 0.96 % of land is affected (measured) |
| Data errors: DEM false land, stale LiDAR, bad heights | OSM coastline for land; OSM `height` first; hero overrides; the build report lists outliers (H > 30 u that is not a hero) |
| Credits wasted on AI 3D | 57-credit bake-off; stop rules; procedural fallbacks for every item |
| Regressions in the 104 tests | District mode is untouched; the city lives behind a flag and a provider; hero regression test |
| Bundle budget (`GameRoot` 198.6 KB gzip) | Split first; city code lazy; data never in the JS bundle |
