# Wave 2 · Lane D2 report (landmarks in context, AI mesh swaps, house kit, routes)

Lane plan: `sf-w1-checkpoint.md` §5.9. File ownership: `sf-w2-contracts.md` (D2 row).

## Part a-models

This part was resumed after the 02:53 UTC pause. The previous agent's uncommitted work (loader, material, sites
mounting, SoloView gate, four landmark swaps, `sf-models` test) was reviewed and kept. On top of it, this part fixed the
warm-up program leak, rewrote the hero fade test, completed the collision blockers and ran the decision gates.

### What is built

| file | what |
|---|---|
| `src/opus-bay/world/models.ts` (D2-02) | One `GLTFLoader` and one `DRACOLoader` (decoder from `SF_DRACO_DECODER_PATH`, 2 workers), created on first use. `preloadDraco()`, `loadModel(id)` for any `ASSETS.models` id (shared promise per id; a failure is remembered), `peekModel`, `modelState`, `retainModel` / `releaseModel`, an LRU of up to `KEEP_UNUSED` = 6 unreferenced models, `loadMask(url)` (flipY false, linear), `modelStats()`, `disposeModels()`. It is node-safe: importing it touches no DOM, and outside a browser every load resolves `null`. |
| `src/opus-bay/world/modelMaterial.ts` (D2-03) | `makeModelMaterial({ map, mask, variant, fade, tintKey, tint, inst, glass })`. It is C2's `patchToyShader` applied once, so every TOY feature reaches the models (contact AO, occlusion dither, hero fade, and Karl the Fog once C2 adds it there). On top of that: map × diffuse, mask.g wall tint (luminance × tint relative to `tintKey`), mask.r night glass (per-storey windows with occupancy, or one steady `glass` colour), a synthesized `vInfo` (base height for AO, seed, glow code), and per-instance `aObTint` / `aObInst` (tint, occupancy, fade, seed, glow). Two programs: `ob-model-hero` (plain Mesh, `OB_HERO`) and `ob-model-inst` (InstancedMesh). Both are registered with `registerWarmup('d2-models')` in city mode, together with the `ob-toy-hero` program. The warm-up materials live for the whole session (see "Decisions"). Helpers: `modelInstanceGeometry`, `setModelInstance`, `modelWarmupSet`, `keyLuminance`. |
| `src/opus-bay/world/sf/sites.ts` (D2-05) | A landmark whose `swap.ship` is set draws its lod 0 as `swap.build` (the procedural remainder) plus its AI parts. GLB loads start 150 u before the lod-0 ring, and the Draco decoder is preloaded when the far city attaches. `models.ts` is imported lazily, so district mode never loads DRACOLoader. Until the GLBs are decoded (or if they fail) the full procedural model stands in, then the site is rebuilt (still at most one lod-0 build per frame). Models are retained while mounted and released into the LRU when dropped; `dispose()` also calls `disposeModels()`. Each landmark with `fade` gets its own hero material and uniform (`ob-toy-hero`, shared with the AI parts), so it thins as one instead of getting dither holes. `fadeOccludes()` clips the camera → player segment against the fade footprint (a box or a circle, in the landmark frame) and the height band. `ground` polygons are drawn with city GROUND. `counts().ai` = { on, pending, failed, triangles, draws }. `?ai=0` in the URL keeps every landmark procedural (QA A/B). Exports: `buildSwapObjects`, `disposeSwapObjects`, `buildGroundMesh`, `fadeOccludes`. |
| `src/opus-bay/world/sf/landmarks/index.ts` | Registry fields (declarative, no loader imports): `LandmarkSwap { parts, build, ship, note }`, `LandmarkSwapPart { model, x, y, z, yaw, scale, tint, occupancy, glass, glow, castShadow }`, `LandmarkFade { r, y1, box?, procedural? }`, `LandmarkGround`, `usesAi(l, ai?)`. |
| `src/opus-bay/world/sf/landmarks/SoloView.tsx` | `?solo=<id>&ai=0\|1` is the decision gate: the same framing either way, the city's model material, stats `ai` / `aiTris` / `aiNote`. `?solo=kit` shows the house-kit sheet (11 houses × authored + 5 pastel tints). The kit sheet was not QA'd in this part. |
| `palace-of-fine-arts.ts`, `dragon-gate.ts`, `conservatory-of-flowers.ts`, `painted-ladies.ts` (D2-06/07) | The swaps and their walk data. Details below. |
| `tests/opus-bay-sf-models.test.ts` | 10 tests (see Evidence). |

**API for other lanes.** Nothing changed in the `CitySites` API that `stream.ts` calls. `streamer.stats().sites` now also
carries `ai` (structurally). Other lanes can load GLBs with `loadModel` / `retainModel` from `world/models.ts`, and make
a TOY-look material for them with `makeModelMaterial` (the programs are already warmed).

### The swaps (decision gates)

| landmark | gate | AI setup | walk data |
|---|---|---|---|
| Palace of Fine Arts rotunda | **AI ships.** Richer piers and entablature, open walk-in arches, floodlit at night. | SAM mesh at xz 0.65 (radius 4.1, the procedural platform), 10.8 u tall, on a 0.2 u deck of radius 4.6; lagoon and wings stay procedural. It casts shadows. Only the rotunda fades as one (`procedural: false`, circle r 4.8). | 8 pier blockers at r 3.7 (r 0.72), 8 walk-in arches (the centre can be reached), deck surface y 0.2 |
| Dragon Gate | **AI ships.** Curved jade roofs and proper proportions, where the procedural gate reads as boxes. | SAM gate at scale 1 (9.6 × 5.85 u, central passage 2.24 u × 2.57 u clear). Procedural lions and red lanterns kept. It fades as one (box 4.8 × 1.3). | 4 pillar blockers matching the measured pillars (inner \|x\| 1.14–2.05, outer 3.21–4.01, ±0.48 deep). The inner ones reach over the lion plinths to z 1.17. Central passage \|x\| ≤ 1.1 is free (≥ 2.2 u clear), side openings are free. |
| Conservatory of Flowers | **AI ships.** The glass house reads as glass. At night the mask glass glows warm, like a lantern in the park. | [0.9, 1, 0.8] = the OSM footprint 10.6 × 4.9 u, on a low white plinth for the sloped lawn; the flower beds stay procedural. It fades as one (box 5.5 × 2.6). | Wings, porch and rear house blockers cover the scaled footprint (tested) |
| Painted Ladies | **Stays procedural** (`ship: false`; the prototype stays in SoloView). At 64 px the AI row is a beige mass, and the mask.g tint (mean G ≈ 0.5) does not bring the pastel bodies back. It also costs 20.6k triangles against 1.6k for the procedural row. | 7 parts (4 × victorian-a, 3 × victorian-b) as 2 InstancedMeshes. | unchanged |

### Evidence

- Tests: `tests/opus-bay-sf-models.test.ts`, 10 of 10 pass:
  - `models.ts` is node-safe;
  - the registry matches the files for 16 GLBs (bytes, triangles, bounds within 2 %, origin, Draco + WebP, masks, size caps, Draco decoder listed);
  - the material shader text: TOY patch applied once, mask after the map, `vInfo` synthesized after the TOY vertex patch, shared programs;
  - instance attributes;
  - the warm-up set, and its materials are never disposed;
  - `buildSwapObjects` (scale baked into the geometry, shared fade, InstancedMesh per repeated model);
  - `sites` counts;
  - the walk data of the swaps against the measured meshes, exclusions and the AI budget;
  - the fade logic (`updateFade`) and `fadeOccludes` cases.
- Full suite (opus-heavy): **299 / 299 pass**, including `opus-bay-hero-regression` and `opus-bay-contracts`. `tsc` 0 errors; eslint 0 on the touched files.
- Programs (city, `?quality=high`, Dragon Gate, program list dumped):
  - Before the fix: 38 with `?ai=0`, and 2 more once the AI gate was drawn.
  - After the fix: **40 either way**, with the same set. The real gate reuses the warmed `ob-model-hero` program, and the count stays the same after the camera move.
- Calls / triangles (SwiftShader, 960 × 600, `?quality=high`, QA camera; triangles include shadows):

| view | `?ai=0` | AI | AI parts |
|---|---|---|---|
| Dragon Gate, Grant Ave, 10 u in front | 114–115 calls, 402.8k–406.5k tris | 115–116 calls, 407.0k–411.1k tris | 5,880 tris, 1 draw (no shadow) |
| Palace, over the lagoon, 17 u | 60 calls, 193.0k tris | 62–63 calls, 201.9k tris | 5,874 tris, 2 draws (casts) |
| Conservatory at night, 13 u | — | 70 calls, 253k–265k tris | 11,753 tris, 3 draws (the Palace lod 0 is also in its 520 u ring) |

  AI budget per view ≤ 60k tris / ≤ 12 draws: held, with a maximum of 11.8k and 3. The Dragon Gate view is already over 400k with
  every landmark procedural; that baseline belongs to C2's high-view budget (see Requests).
- Shots in `docs/opus-bay/qa/w2/D2/`:
  - SoloView A/B at golden and night: `d2-dragon-gate-solo-ab.jpg`, `d2-palace-solo-ab.jpg`, `d2-palace-street-ab.jpg`, `d2-conservatory-solo-ab.jpg`, `d2-painted-ladies-solo-ab.jpg`;
  - the 64 px thumbnails: `d2-painted-ladies-64px.jpg`;
  - in the city: `d2-city-dragon-gate-ab.jpg`, `d2-city-palace-ab.jpg`, `d2-city-conservatory-night.jpg`.

### Decisions

- **Warm-up materials are never disposed.** three frees a program when its last material is disposed. The previous
  `modelWarmupSet().dispose()` threw the freshly compiled programs away, so the first AI landmark compiled again. One
  material per variant now lives for the session; the dummy geometry is still disposed.
- **Fade footprint instead of a radius around the origin.** With the old radius test, the gate thinned to 0.2 while the
  player stood 3 u in front of it with the camera behind the player. The segment is now stopped 0.6 u short of the
  player and clipped against a box (gate, Conservatory) or a circle (rotunda).
- **Walk data follows `ship`.** Walk data reaches the workers once at start. The blockers are therefore authored to the
  AI layout of every shipped swap, and the procedural fallback shows only while the GLB decodes or after a load failure.
- The Grant Ave strip through the Dragon Gate exclusion was not needed: in the city shot the street continues under the
  gate (`ground` support is there if a later setting needs it).

### Known gaps

- While a GLB is still loading, or after a failure, the procedural fallback does not match the AI blockers exactly. The rotunda clusters are at r 3.05 against the AI piers at 3.7, and the gate plinths are 0.3 u off. This is brief and rare.
- The Dragon Gate eaves (9.6 u) overhang the 9.0 u exclusion by 0.3 u on each side above about 4 u; the pillars are inside it. Widening the exclusion would drop more of the adjacent Grant Ave buildings, so it was left as is.
- The mask.g tint is weak on the SAM textures (mean G ≈ 0.5). D2-08 (kit swap) should check the tint strength on the `?solo=kit` sheet before it relies on it.
- `SF_MODELS.landmarkId` still uses sf-data ids (D2-04 leftover; nothing reads it yet).

### Not done (for the next part)

- D2-15: clean up and publish the 8 raw SAM landmark meshes.
- D2-08: the kit swap (`world/sf/kitSwap.ts`, L0 hide, `?solo=kit` QA).
- D2-11: the 3 routes with their gap fillers; D2-14 `routes-qa.mjs`.
- D2-09: the landmark settings (CS-11 GGB south approach, CS-13 Palace lagoon side).
- The C2-5 "Sites" landmark LOD by camera height.
- HC-4: re-encode or preload the 5 hero GLBs.
- The D2-04 `landmarkId` fix.

### Requests

- **C2** (`world/sf/stream.ts`, optional): type `CityStreamer.stats().sites` as `ReturnType<CitySites['counts']>` so the
  `ai` counts are typed in `?debug` and the budget QA (today they only pass through structurally).
- **C2** (budget): the Dragon Gate street view is already 403k–407k triangles at `?quality=high` with every landmark
  procedural. The AI gate adds about 4.5k on top. The baseline belongs to the C2-5 high-view budget.
