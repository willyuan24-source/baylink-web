# Lane D report: San Francisco landmarks as procedural toy models (wave 1)

Worktree: `C:/Users/willy/baylink-opus` (branch `opus-bay`). Nothing is committed.

**Result.** All 24 landmarks in the brief are built, including every T1 and T2 and one T3 (Chase Center):

| tier | ids |
|---|---|
| T1 | golden-gate-bridge, sutro-tower, city-hall, de-young-tower, palace-of-fine-arts, twin-peaks |
| T2 | painted-ladies, dragon-gate, conservatory-of-flowers, dutch-windmill, mission-dolores, grace-cathedral, legion-of-honor, fort-point, castro-theatre, oracle-park, peace-pagoda, ghirardelli-square, fishermans-wharf, sutro-baths, cliff-house, cable-car-turntable, lombard-crooked-street |
| T3 | chase-center |

- The registry API has the exact shape the brief asked for. It was published first, with stub builders.
- Each landmark also has an info record, its own validation, and appears on the contact sheet.
- Every landmark is within its triangle budget. Each LOD2 is at most 10 % of its LOD0.
- Checks pass: `tsc` reports 0 errors for the whole project, eslint is clean on my files, and the opus-bay tests pass 165/165. My new file adds 10 of those tests.

---

## 1. Files

All files are new and sit inside lane D's paths.

| path | what |
|---|---|
| `src/opus-bay/world/sf/landmarks/index.ts` | The registry: `SfLandmark`, `SF_LANDMARKS` and the placement, build and walk helpers (§2). |
| `src/opus-bay/world/sf/landmarks/kit.ts` | Shared toy kit on `BatchLike`: `box`, `cbox`, `cyl`, `tube`, `arch`/`archGeo`, `lathe`, `gable`, `pyramid`, `vault`, `disc`, `loftRings`, `prismXZ`, `sweepX`, `flowerBed`, `rect`, `ngon`, `rot`, `worldPoly`; the aInfo helpers `NONE`, `GLOW`, `SELF`, `LIT`, `WIN`, `SWAY`; the palette `SF`. |
| `src/opus-bay/world/sf/landmarks/<id>.ts` × 24 | One module per landmark. Each exports its `SfLandmark` record. |
| `src/opus-bay/world/sf/landmarks/SoloView.tsx` | The `?solo=<id>` / `?solo=all` QA turntable. It replaces the stub. |
| `src/opus-bay/data/sf/landmarks.ts` | The info side: `SF_LANDMARK_INFO`, `sfLandmarkInfo(id)`, `SF_VERIFIED_AT`, `SfLandmarkInfo`. |
| `tests/opus-bay-sf-landmarks.test.ts` | 10 tests (§4). |
| `C:/Users/willy/opus-qa/landmarks/<id>/` | Per landmark: `validation.json`, `photo-{golden,day,night}.png`, `three-golden.png`, `thumb-64.png`, `silhouette-64.png`. |
| `C:/Users/willy/opus-qa/landmarks/_tools/` | Offline tools: `footprints.mjs`, `near.mjs`, `localpoly.mjs` (OSM → local polygons and circle fits), `dem.mjs`, `sample.mjs` (DEM → terrainY), `validate.ts`, `tris.ts`, `mosaic.py`, `compare.py`. |
| `C:/Users/willy/opus-qa/sf-w1-landmarks-sheet.png` | Contact sheet: one ¾ tile per landmark, with its 64 px thumbnail and triangle counts. |
| `C:/Users/willy/opus-qa/landmarks/_reference-compare.png` | Our photo pose next to the licensed reference photos BAYLINK already ships (`public/guides/**`), for 15 landmarks. |
| `C:/Users/willy/opus-qa/landmarks/_photo-{golden,day,night}-sheet.png`, `_thumbs-64.png`, `_silhouettes-64.png`, `validation-summary.json` | Review mosaics and the validation summary. |

---

## 2. API for the other lanes

### 2.1 `world/sf/landmarks/index.ts`

```ts
export interface SfLandmark {            // exact brief shape
  id; tier: 1|2|3; x; z; yaw; base: 'terrain' | number; exclude: { r } | { poly: Vec2[] /* world */ };
  build(b: BatchLike, lod: 0 | 2): void; castShadow?; animate?: { update(obj, t); build(b) }; walk?: { blockers; surfaces? };
}
export type LandmarkTier = 1 | 2 | 3; export type LandmarkLod = 0 | 2;
export type WalkBlocker = { x; z; r } | { poly: Vec2[] }; export interface WalkSurface { poly; y: number | 'terrain'; surface: SurfaceKind }
export const SF_LANDMARKS: SfLandmark[];                 // 24 records
export function sfLandmark(id: string): SfLandmark | undefined;
export const TIER_TRIANGLES; export const BUDGET_OVERRIDE; export const triangleBudget: (l) => number;   // 6000 / 2500 / 800, GGB 12000
export function landmarkMatrix(l, baseY: number): THREE.Matrix4;         // local → world: translate (x, baseY, z), rotate yaw about +y
export function landmarkToWorld(l, p: Vec2): Vec2; export function worldToLandmark(l, p: Vec2): Vec2;
export function buildLandmark(l, lod: 0|2, baseY = numeric base or 0): THREE.BufferGeometry;   // LOCAL geometry, aInfo.y already lifted by baseY
export function buildLandmarkAnimated(l, baseY?): THREE.BufferGeometry | null;                    // the moving part (windmill sails)
export function buildLandmarkWorld(l, lod, baseY): THREE.BufferGeometry;                         // baked to world space, for merging
export function landmarkWalkWorld(l, baseY): { blockers: WalkBlocker[]; surfaces: WalkSurface[] }; // world coordinates; numeric y + baseY
```

**Contract details** (also in the file header):

- **Base height.** `baseY = base` when `base` is a number. For `'terrain'`, it is the lowest city ground inside `exclude`. Walls go 1.2 u below local 0.
- **aInfo.y is local.** Always build through `buildLandmark` (or add baseY yourself), otherwise night windows and wall contact AO drift once the mesh is lifted.
- **Material and draw calls.** Every landmark uses the TOY material with vertex colours: 1 draw call per LOD, plus 1 for the windmill's animated sails.
- **Animated parts.** The animated mesh is a child of the placed landmark. `update(obj, t)` sets its local transform. Use TOY_DYN.
- **Walk surfaces.** They are listed most specific first, so the first match wins.

**Extra exports from the modules:**
- `GGB` (from `golden-gate-bridge.ts`): `{ DECK 15.2, TOWER 89.29, TOP 42.2, ANCH_S, ANCH_N, END_S −230, END_N 192, cableY(s) }`.
- `TURNTABLE` (from `cable-car-turntable.ts`): `{ r: 3.1, top: 0.12, rails: [−0.55, 0.55] }`.
- `LOMBARD` and `lombardGround(z)`.
- `PAINTED_LADIES` (house colours and steps).
- `PALACE_LAGOON`.

### 2.2 `data/sf/landmarks.ts`

`SfLandmarkInfo` has these fields:

| field | contents |
|---|---|
| `id`, `name`, `zone` | bilingual `{zh, en}` names |
| `lat`, `lng` | real coordinates |
| `arrival` | `{x, z, heading}` in the local frame, walkable and outside the blockers. Use `landmarkToWorld` to get world coordinates. |
| `photo` | `{target, distance, elevation, bearing}` in the local frame. Camera = target + d·(sin b·cos e, sin e, cos b·cos e). |
| `height` | `{realM, u, rule}` |
| `plannerPlaceId?`, `guideSlug?` | only ids that exist; the test checks this |
| `officialUrl?` | |
| `osm[]` | the OSM features the model replaces |
| `sources[]` | secondary sources |
| `bark` | a bilingual BAYBAY line |
| `realInfo` | the existing `RealInfo`, carrying `sourceUrl` and `verifiedAt` 2026-09-26 |

Facts were spot-checked on 2026-09-26 against:
- goldengate.org (statistics page, pedestrians page);
- sutrotower.com;
- sf.gov (City Hall);
- nps.gov (Fort Point hours);
- sfmta.com (cable-car fare, $9);
- Wikipedia: de Young, Legion of Honor, Palace, Conservatory, Dutch Windmill, Mission Dolores, Grace Cathedral, Fort Point, Castro Theatre, Oracle Park, Ghirardelli, Sutro Baths, Cliff House, Lombard, Chase Center, Twin Peaks, Painted Ladies, Dragon Gate.

famsf.org returned 403. The de Young and Legion cards therefore cite Wikipedia and still link the official site.

**BAYLINK links:**
- Planner ids: `golden-gate`, `palace`, `chinatown`, `golden-gate-park`, `pier39`.
- Guides:
  - `sf-golden-gate-bridge-fort-point-guide`
  - `sf-palace-fine-arts-marina-guide`
  - `sf-chinatown-north-beach-walk-guide`
  - `golden-gate-park-free-car-free-day-guide`
  - `sf-fishermans-wharf-pier39-guide`
  - `bay-area-october-muni-clipper-payment-update-2026` (for cable cars)
  - `san-francisco-guide` for the rest; it lists Lombard, the Painted Ladies, Twin Peaks and Lands End.

### 2.3 SoloView (`?solo=<id>` / `?solo=all`)

- **Flags:** `&time=morning|day|golden|night`, `&lod=2`, `&view=three|front|back|left|right|top|street|far|photo`, `&sheet=0`.
- **Scene:** the real `Environment` (sky, sun, hemisphere, table), the TOY and GROUND materials, a lawn disc or a sea disc, and OrbitControls.
- **Readout:** triangles, draw calls and model size.
- **Hooks** on `window.__opusSolo`: `ids`, `select(i)`, `view(v)`, `lod(n)`, `time(t)`, `cam(...)`, `stats()`, `thumb(64)`, `silhouette(64)` (a clean mask with its coverage and bounding box), `sheet()`.
- **`?solo=all`:** renders the contact sheet as a tiled image, one tile per landmark rather than a 3-D grid of all of them.

---

## 3. How the models are made

- **Positions** come from `sf-data/landmarks.json`, or from the OSM footprint when the model is built from it. OSM outlines were converted into each landmark's local frame with `localpoly.mjs`. Yaw comes from the OSM long axis or the street axis.
- **Heights** follow plan §2.3, H = 3.2 + 0.155·h. Internal proportions are scaled uniformly by H / h.
  - The Golden Gate Bridge uses terrainY: towers 42.2 u, deck 15.2 u. The test cross-checks these against lane A's `core/geo.ts` `terrainY(227)` and `terrainY(67)`.
  - Numeric bases and the Lombard, Painted Ladies and Ghirardelli ground steps were sampled from the DEM with the same curve.
- **Deliberate toy liberties** (the owner said to decide these myself):
  - Golden Gate Bridge deck is 5.3 u wide, 1.4× real, so the sidewalks are walkable. There is a balcony round each tower leg.
  - Painted Ladies lots are 1.6 u wide instead of 1.04 u.
  - Lombard's swing is 2.4× real, so the 1.0 u toy car fits the lane.
  - The turntable is sized for lane F's 5.6 u cable car.
  - Dragon Gate's central opening is 3.3 × 3.5 u.
  - Grace Cathedral's flèche is 14.8 u (the verified 247 ft).
- **No text or logos anywhere.** The Castro blade sign and marquee, Ghirardelli's rooftop panels, the wharf wheel's ring and the Oracle scoreboard are all blank. Oracle Park has no bottle.
- **Night lighting** uses the TOY conventions: floodlit Golden Gate towers, sodium deck lamps, lit windows (WIN), lit openings (LIT), glowing glass on the Conservatory and Chase Center, the Castro sign, and aviation lights on the Golden Gate and Sutro Tower.

---

## 4. Evidence

**Tests** (`tests/opus-bay-sf-landmarks.test.ts`, 10 of 10 pass; the full opus-bay suite is 165 of 165):

| test | what it checks |
|---|---|
| registry | ids, tiers, T1 shadows, one info record per landmark |
| budget | lod0 within budget, lod2 ≤ 10 %, finite geometry, attribute layout |
| positions | within 3 u of the reference; Golden Gate towers within 0.5 u of the landmarks.json points; anchorages within 1 u |
| height policy | `buildingH` / `terrainY` from core/geo.ts |
| orientation | round trips and matrix agreement; Dragon Gate faces south, Painted Ladies west, City Hall and Castro east, all within 15° |
| exclude / arrival / photo | exclude contains the origin; arrival not blocked |
| walk data | Dragon Gate and Legion gateway are walk-through; Golden Gate deck at 15.2 with tower legs blocking |
| Lombard | 8 hairpins; lane steps < 0.3 u; stair risers ≤ 0.55 u; Hyde end more than 6 u above Leavenworth |
| aInfo and animation | aInfo lift by baseY; windmill sails rotate |
| info | bilingual text, https sources, verifiedAt, planner and guide ids exist in `public/*.json`, lat/lng inside SF |

**Validation** (`opus-qa/landmarks/<id>/validation.json`, standalone plan §10 G4):

| check | result |
|---|---|
| 1 silhouette at 64 px | 24 of 24 pass. Coverage runs from 0.033 (Golden Gate, thin) to 0.308. |
| 2 height policy | 24 of 24 pass. Composite sites (a sign, a tower among low wings, ruins) were checked by eye. |
| 3 orientation within 10° | 13 of 13 landmarks with an OSM axis show 0.0° error. The rest are square or world-aligned outlines. |
| 4 centroid within 3 u | 24 of 24 pass. |
| 5 context | Deferred to lane C. |
| 6 walk ring | Standalone check only: arrival is clear and the ring is not fully blocked, 24 of 24. |
| 7 budget | 24 of 24 pass. |
| 8 info card | 24 of 24 pass, with same-camera shots at golden hour, day and night. |

**Screenshots I viewed and judged:**
- `sf-w1-landmarks-sheet.png`
- `_photo-golden-sheet.png`, `_photo-night-sheet.png`, `_photo-day-sheet.png`
- `_thumbs-64.png`
- `_reference-compare.png`
- `_r1-mosaic.png` (de Young, Palace with its lagoon, Grace, Golden Gate at night)
- `_r2-mosaic.png` (Fort Point courtyard, City Hall dome, Sutro Baths, turntable)

**What I changed after comparing with the references:**
1. Fort Point now has its open parade ground, ringed by three tiers of arched casemates facing inward.
2. City Hall's drum and dome are raised and enlarged. Before, the dome sat too low compared with the photo.
3. Sutro Baths has one big flooded main basin, as seen from the Lands End trail.
4. The turntable apron is grey granite.
5. The Palace lagoon is lifted to ground level, so it reads like the reference photo.
6. The Golden Gate towers are now floodlit at night; they were too dark before.
7. The de Young tower was thickened by 0.2 u and its museum darkened and lowered, so the tower reads.
8. Grace Cathedral's flèche was raised to the verified 75 m.

**Remaining differences, stated honestly:**
- The de Young tower is still thin from its narrow side.
- The cable-car turntable and the Twin Peaks terrace are inherently weak at 64 px. They are flat sites.
- The Conservatory's dome is simplified.
- The Golden Gate suspenders are spaced 3 u apart; the real spacing is 2.1 u.

---

## 5. Measured numbers

**Triangles, lod0 / lod2:**

| landmark | lod0 | lod2 |
|---|---|---|
| golden-gate-bridge | 7,364 | 660 |
| sutro-tower | 894 | 72 |
| city-hall | 1,832 | 148 |
| de-young-tower | 1,140 | 22 |
| palace-of-fine-arts | 4,224 | 300 |
| twin-peaks | 360 | 24 |
| painted-ladies | 1,624 | 128 |
| dragon-gate | 672 | 60 |
| conservatory-of-flowers | 1,556 | 144 |
| dutch-windmill | 672 (+ 396 in the animated sails) | 48 |
| mission-dolores | 1,060 | 100 |
| grace-cathedral | 711 | 68 |
| legion-of-honor | 1,096 | 72 |
| fort-point | 1,616 | 83 |
| castro-theatre | 603 | 60 |
| oracle-park | 1,144 | 66 |
| peace-pagoda | 988 | 76 |
| ghirardelli-square | 1,012 | 44 |
| fishermans-wharf | 1,272 | 120 |
| sutro-baths | 657 | 60 |
| cliff-house | 928 | 36 |
| cable-car-turntable | 586 | 22 |
| lombard-crooked-street | 2,222 | 150 |
| chase-center | 474 | 38 |
| **all 24** | **34,707** | **2,601** |

- **Draw calls:** 1 per landmark per LOD, plus 1 for the windmill sails.
- **Solo frame** (one landmark, sky, table and disc): 5 draw calls.
- No performance conclusions were drawn: the GPU was shared with other lanes.

---

## 6. Known gaps

- **Street context.** Checks 5 and 6 (plaza and context, a real walk-around ring) need the streamed city. None of the landmarks has its 150–300 m of street yet; that is lane C's work.
- **Other LODs.** Only LOD0 and LOD2 exist, as briefed. There is no LOD1 and no HALO sprites; night lights are emissive boxes.
- **T3.** Only Chase Center is done. The Wave Organ, Stow Lake and Bernal were not built.
- **AI assets.** These are procedural first passes; none of the plan's Higgsfield assets are used.
- **Palace lagoon.** Its water is a TOY polygon, not the water shader.
- **Height sampling.** Lombard, Painted Ladies and Ghirardelli heights come from the 7.5 m DEM. The 2 u city grid may differ by about 0.2 u, which is why the Lombard lane is lifted 0.2 u.
- **Fisherman's Wharf sign.** It sits 2 u inside the district `SLAB` west edge (OSM artwork node 5455630121). The seam decision belongs to lane C.

---

## 7. Requests for other lanes

**Lane C (world and stream)**
1. **Mount each landmark.** Resolve baseY: numeric `base` as given, or `'terrain'` as the minimum city ground inside `exclude`.
   - Build `new Mesh(buildLandmark(l, lod, baseY), TOY)`, then `mesh.applyMatrix4(landmarkMatrix(l, baseY))` (or set position and `rotation.y = yaw`).
   - Set `castShadow` for T1.
   - Suggested LOD switch: LOD0 inside the L1 ring (520/420/320 u); LOD2 beyond it. T1 LOD2 should always be visible.
2. **Windmill.** `buildLandmarkAnimated(l, baseY)` with TOY_DYN, as a child of the landmark. Call `l.animate.update(child, t)` only within about 150 u.
3. **Buildings.** Drop generated buildings inside `exclude`; the polygons are in world coordinates. `SfLandmarkInfo.osm` lists the OSM ids each model replaces.
4. **Water.** Suppress city water inside the palace-of-fine-arts exclude, because the landmark draws its own lagoon. The sutro-baths basins are drawn by the landmark too.
5. **Golden Gate deck ends.** At local x −230 and +192 (world `landmarkToWorld(ggb, {x: −230, z: 0})` and the `+192` equivalent), y is 15.2. Ramp the US-101 approach and the ground to meet it there. The exclude strip is ±5.5 u along the whole bridge.
6. **Numeric-base sites.** Under Lombard (base 11.8), Ghirardelli (1.3) and the Painted Ladies (13.4), keep the city ground at or below the landmark's ground. The Lombard lane sits 0.2 u above the plan §2.2 terrain.
7. **Fisherman's Wharf seam.** The wheel sign is 2 u inside `SLAB`. Decide which side owns that corner. If the waterfront warp (§5.1 rule 3) moves Jefferson St, apply the same warp to this landmark's x/z.

**Lane B (terrain and nav)**
- Read `landmarkWalkWorld(l, baseY)`. Blockers are polygons or circles. Surfaces carry world y, or `'terrain'`; where they overlap, the first match wins.
- Golden Gate: `road` and `pavement` decks at world y 15.2, tower-leg and railing blockers, and a balcony surface round each leg.
- Lombard: 101 `road` slices (about 0.55 u each) and 2 × 25 `stairs` slices, with the beds and side planters as blockers.
- Turntable: disc at +0.12 (`wood`) over the apron.
- Twin Peaks terrace, Cliff House terrace and the Sutro Baths slab are all surfaces.

**Lane F (transit)**
- `TURNTABLE` gives the Powell & Market disc in the landmark frame: centre (0, 0), r 3.1, deck y +0.12, rails at x ±0.55, running up Powell St toward local −z.
- The disc is static. If you want it to spin, draw your own disc there.

**Lane G (flow and UI)**
- `SF_LANDMARK_INFO` is ready for place cards and for `places.json` (plan §4 step 9).
- For each record, `arrival` goes through `landmarkToWorld` to give a world arrival point, and `photo` is the landmark's photo camera pose.
- `realInfo` renders with the existing card. Build links with `data/links.ts` (`planUrl`, `guideUrl`, `mapsUrl(lat, lng)`).

**Lane A (data)**
- The `exclude` polygons and `SfLandmarkInfo.osm` ids can drive `heroDropLots`-style removal when building chunks.

**Lead**
- No contract files changed. I used the new `core/geo.ts` (`buildingH`, `terrainY`) only in the tests.
