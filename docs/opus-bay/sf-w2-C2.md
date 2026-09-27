# Wave 2 · lane C2 (city look, atmosphere, performance, bundle split)

Branch `opus-bay`, worktree `/home/user/wt/C2`. Budgets and rules: `docs/opus-bay/sf-w2-contracts.md`,
checkpoint §5.4. Numbers are SwiftShader `renderer.info` at 960 × 600 (calls and triangles are valid there, fps is not).

## Part a-look

Tasks: C2-1 breakdown tool, C2-2 SF look remap (CS-1), C2-3 green hills (CS-5), C2-4 haze (CS-2), C2-6 drawn ground =
walked ground, plus the art-direction ledger. The part was stopped mid-way at the 02:53 UTC pause; part
b-lookfinish-budget finished its last uncommitted palette step (commit `a9c1d84`) and wrote this section.

### What changed (files, API)

| task | commit | files | what |
|---|---|---|---|
| C2-1 | `4e7c32a` | `world/sf/stats.ts`, `scripts/opus-sf/qa/budget-views.mjs` | `breakdown(scene, camera)` attributes draw calls and triangles of the main pass (frustum-culled; BatchedMesh from its last multi-draw list) and of the sun's shadow pass to groups (`city.l0.toy`, `city.l0.ground`, `city.pool.*`, `city.props`, `hero.ground`, `hero.backdrop`, `life`, `actors` ...). DEV: `__opusBay.city.breakdown()`. The QA script drives 11 fixed views (ferry, tp-walk, tp-high, tp-high250, coit-high, glide-mission, painted, mission, sunset, marina, ocean) through `opus-shot` and writes `views.json`, `views.md` and one JPEG per view. |
| C2-4 | `ba42cf3` | `world/sf/fog.ts`, `world/environment.ts` | `cityFogK(camY, groundY, tod)`: pure multiplier of the time preset's FogExp2 density (a uniform, nothing recompiles). Altitude above the water 20 → 70 u (× 1 → × 0.45), height above the ground 30 → 150 u (× 0.4), per-time city scale blended in from y 15 to 45 (morning 0.85, golden 0.9, night 0.45). A walking camera below y 15 keeps today's fog exactly; district mode is never scaled. Downtown seen from the Twin Peaks summit: fog factor 69 % → ≈ 26 % at golden hour. |
| C2-2/3/6 | `d98cbe0` | `world/sf/look.ts` (new, worker-safe), `build.ts`, `far.ts`, `worker.ts`, `stream.ts`, `recipes/city.ts` | **Roofs:** flat is the norm (86.6 % flat, 5.1 % gable, 8.3 % hip over 57,480 buildings; was 20 % flat). Pitched roofs only for the Sunset / Richmond / Lakeshore / Oceanview tile minority, Marina / Seacliff hips, West of Twin Peaks, single cottages in Noe / Bernal / Glen Park / Excelsior / Portola, and sheds / civic halls. **Walls:** Painted-Lady pastels kept (L ≥ 0.79), Edwardian / residential / stucco pools ≈ 35 % white plus light pastels and creams, SoMa brick stays. **Flat tops** (membrane, light grey, gravel, grey, a little tar) are always darker than their walls. `specOf` feeds L0 and L1 from `look.ts`; far prisms use `farPrismColors` (no × 1.22 saturation); the DataSF zones reach both workers as a `zones` message. Cheap flat tops in `recipes/city.ts` keep the densest L0 cell at 18,239 triangles (cap 18,500). **Hills (C2-3):** land above 30 u mixes to hill grass, earth only on slopes > 0.95; same rules on the far tier. **Ground (C2-6):** L0 / L1 ground = `core/sfTerrain groundRaster` − landmark sink (except within 2 u of bridges and deck-only roads); `dropSeamBuildings` removes the two seam buildings in the hero water at decode time, so their invisible walls in chunk −2_0 are gone. |
| C2-2 finish | `a9c1d84` | `world/sf/look.ts` | Flat tops one step lighter (white membrane `#e2ddd4`, light grey `#d5d0c7`, gravel `#c9c3b8` ...): the first remap read grey from above. Terracotta deck kept; far prism tops mix 0.10–0.18 toward the neutral rim tint so orange far tops stay ≤ 5 %. |
| ledger | `214fad6` | `docs/opus-bay/ledger/w2-C2.md` | 4 art-direction reference images (8 credits, balance 519.48 → 511.48); reference only, nothing in `public/`. |

API for other lanes: `look.ts` exports `roofFor`, `wallFor`, `flatTopColor`, `pitchedRoofColor`, `farPrismColors`,
`zoneAt`, `LOOK_MEANS`, `HILL` / `hillMix` / `slopeEarth` (worker-safe, no three import: G1 may use it for the map).
`fog.ts` exports `cityFogK`.

### Evidence

- Tests: `tests/opus-bay-sf-look.test.ts` (7: roof shares and zones, wall lightness, tops darker than walls, ≤ 5 % orange
  far tops (5.3 % with the lighter tops before the far-tint step, under 5 % after it), L0 / L1 / L2 top and wall agreement per
  cell, hills, zones), `tests/opus-bay-sf-atmos.test.ts` (`cityFogK` table, walk = 1), three new `sf-stream` tests
  (every L0 cell ≤ 18,500, ground = rasterHeight − sink within 0.02 u off bridges, seam walls dropped).
- Contact sheet, golden, high quality, 960 × 600: [`qa/w2/C2/look-before-after-golden.jpg`](qa/w2/C2/look-before-after-golden.jpg)
  (before = `4e7c32a`, after = `a9c1d84`; Twin Peaks high view, Alamo Square walking, Sunset at 60 u, Marina at 40 u).
  The orange carpet is gone: from Twin Peaks the city reads as pale flat tops with a light warm haze and the bay and
  downtown are visible; Alamo Square keeps its pastel Victorians with light parapets; the Sunset keeps a red-tile
  minority; the Marina keeps its tile hips (about 40 %, as in the Mediterranean-revival Marina).
- Numbers (golden, high, 960 × 600; `renderer.info`, whole frame incl. shadows):

| view | before (`4e7c32a`) calls / tris | after (`a9c1d84`) calls / tris |
|---|---|---|
| tp-walk | 70 / 270,618 | 71 / 250,249 |
| tp-high | 125 / 451,812 | 142 / 458,063 (*) |
| glide-mission | 82 / 379,562 | 72 / 358,947 |
| painted | 109 / 396,310 | 116 / 381,922 |
| sunset | 79 / 271,629 | 69 / 248,383 |
| marina | 89 / 244,700 | 77 / 224,033 |

(*) the after run measured tp-high first, with the player still at the Ferry gate: its shadow pass covers the hero
district (14 calls / 39k) and the actors are drawn; the before run had walked the player to Twin Peaks first. The
remap itself lowers L0 / L1 triangles (flat tops are cheaper): tp-high L1 180k → 98k.

### Known gaps (part a-look)

- The raw OSM build cannot run in the cloud, so the remap is a runtime remap in `look.ts` (lane A can move it into a
  data v2 later).
- Owner taste review of the palette on the owner's GPU is pending (SwiftShader colours are close but not exact).

## Part b-lookfinish-budget

Tasks: finish part a-look (the uncommitted `look.ts` step, contact sheet, the section above), C2-5 high-view budget,
HC-1 / HC-2 bundle split. Commits: `a9c1d84` (look), `946e448` (a-look report), `c20886c` (C2-5 + lazy city chunk),
this report. C2-10 (tier fade) and CS-7 were skipped as the task asked.

### What was built (files, API)

**C2-5 high-view budget** (plan §5.10: ≤ 150 calls, ≤ 400k triangles incl. shadows):

- `world/sf/cell.ts` `radiiFor(q, { heroNear, camH, glideH })` (pure) and `HIGH_VIEW`: the camera height above the
  ground (far DEM under the camera) shrinks L0 from the quality radius to 60 / 90 u as camH goes 25 → 60 u, and L1 to
  240 / 290 u from 80 → 120 u; radii step by 5 u (a bobbing camera never re-selects every frame); the old glide rule
  (L0 60 / 90 above 40 u) and the hero-near quality step moved in. A walking camera (camH ≤ 25) keeps exactly today's
  radii.
- `world/sf/props.ts` `propCaps(camH)` (pure) and `PROP_HIGH`: full trees 200 → 50 (within 70 → 40 u), lollipops
  600 → 350, lamps 48 → 12 (within 120 → 60 u) from 25 to 80 u, in four steps. `CityProps.update(fx, fz, now, camH)`.
- `world/sf/heroGround.ts` (new, in the city chunk): `TopSampler` (topmost up-facing surface of some meshes, bucketed)
  and `heroGroundJob(meshes, { box, step = 4, cell = 64 })`, a generator that resamples the hero's 8 ground chunks
  (47.2k triangles) into a 4 u height-and-colour grid through `mesh.ts buildGround` (marching-squares coast, 0.8 u
  lip) → city ground-pool arrays of ≤ 10k triangles; `heroGroundProxy()` runs it at once (tests).
- `world/sf/stream.ts`: `camH` per frame (also in `stats().camH`), radii via `radiiFor`, props via `propCaps`;
  `StreamOptions.hero.ground = { meshes, job }`: the job runs in ≈ 2 ms frame slices from the first streaming frame,
  its result goes into the ground pool (item 9,000,003, no draw call of its own) and swaps with the hand-made ground
  whenever `heroFar` flips (until it is done, the hand-made ground stays). `dispose()` restores every hidden mesh.
- `world/world.ts` (city mode only): the hero ground chunks (bbox meets the slab), the district labels and contact
  blobs hide with the hero buildings when far; the backdrop (Bay Bridge, lighthouse, Angel Island, clouds) is chunked
  at 512 u instead of 150 u (20 → 6 calls). District mode builds exactly as before (hero regression green).
- Not done by C2 on purpose: hero life (F13, lane F reads `onHeroFar`), landmark LOD by camH (D2's `sites.ts`), the
  player group (E2). The hero landmark meshes (12 calls / 6k) stay: the budget holds without touching them.

**HC-1 / HC-2 lazy city chunk:**

- `world/cityLoader.ts` (new, main graph, tiny): `loadCity(): Promise<CityModule>` (idempotent, retry after a failure),
  `cityModule(): CityModule | null`, `suspendForCity()` (throws the promise for Suspense or the error for a boundary),
  `cityStreamerLazy()` (the running streamer without importing the chunk).
- `world/sf/cityMode.ts` (new): the chunk entry, re-exporting `CityStreamer`, `cityStreamer`, `CitySites`,
  `CityWater`, `heroLandRaster`, `heroProxy`, `heroGroundJob`, `heroGroundProxy`, `attachMurals`, `mountCityDebug`,
  `demSample`, `landmarkTallStructures`.
- `world/world.ts` imports only types from the city modules; `World` reads the loaded module (`CityWater` in the
  constructor, the rest in `enableCity`). `WorldScene.tsx` calls `suspendForCity()` in city mode before `getWorld()`;
  `GameRoot.tsx` starts `loadCity()` at module load in city mode (parallel with the renderer setup). District mode never
  fetches it (checked in the browser: no `cityMode` / `stream` / `sites` / `water` / `sfTerrain` resource at
  `?start=free`, the district renders as before).
- **API for other lanes:** main-graph code (anything outside `world/sf/`) must not import `world/sf/{stream, sites,
  water, pools, hero, heroGround, stats, cityMode, far, build, worker, raster, cell}` or `core/sfTerrain` statically:
  use `cityStreamerLazy()` / `cityModule()` from `world/cityLoader.ts`, or a dynamic import (as F14's transit layer
  does). `import type` is fine. The guard test in `tests/opus-bay-sf-budget.test.ts` names any offender.

### Evidence

- Tests: `tests/opus-bay-sf-budget.test.ts` (5: radii table incl. walk = today, glide, low quality, 5 u steps,
  monotone; prop caps and steps; hero ground stand-in ≤ 10k triangles for 47.2k, ≥ 96 % of ground points covered,
  ≤ 5 % off by > 0.6 u, mean colour shift < 0.03, ≥ 20 job slices; the import guard). `opus-bay-sf-stream` city-mode
  World test loads the chunk first. Full suite **254 / 254** (opus-heavy, after rebase on F2 / F14); hero regression
  green; `tsc` 0; eslint 0 on every touched file.
- Budget views, golden, `?quality=high`, 960 × 600, `renderer.info` of the whole frame incl. the shadow pass (before =
  `4e7c32a` run of part a-look, after = `c20886c`; same 11-view sequence; `scripts/opus-sf/qa/budget-views.mjs`):

| view | before calls / tris | after calls / tris | after shadow pass | after L0 / L1 cells |
|---|---|---|---|---|
| ferry | 81 / 239,613 | 89 / 303,425 | 16 / 54k | 3 / 16 |
| tp-walk | 70 / 270,618 | 70 / 265,870 | 3 / 18k | 14 / 38 |
| tp-high (≈ 70 u over the summit) | 125 / 451,812 | **96 / 326,707** | 3 / 18k | 6 / 69 |
| tp-high250 (wave-1 worst) | 144 / 534,019 | **108 / 369,701** | 3 / 18k | 4 / 60 |
| coit-high | 90 / 398,524 | 76 / 398,768 | 4 / 32k | 1 / 29 |
| glide-mission (80 u) | 82 / 379,562 | 56 / 218,283 | 3 / 18k | 4 / 33 |
| painted (walking) | 109 / 396,310 | 66 / 304,223 | 2 / 17k | 14 / 66 |
| mission (40 u) | 136 / 486,366 | **107 / 392,036** | 2 / 17k | 7 / 47 |
| sunset (60 u) | 79 / 271,629 | 54 / 179,819 | 2 / 17k | 3 / 37 |
| marina (40 u) | 89 / 244,700 | 70 / 208,181 | 3 / 20k | 6 / 32 |
| ocean (walking) | 61 / 153,729 | 62 / 153,453 | 2 / 17k | 11 / 31 |

  Every view is ≤ 150 calls and ≤ 400k triangles. Where the savings come from at tp-high250: L0 toy 10 / 100.5k →
  4 / 34.6k, L0 ground 10 / 37.1k → 4 / 16.2k, props 43.1k → 16.5k, hero ground 16 / 51.9k → the stand-in in the
  ground pool (the 8 / 4.8k left are Angel Island's chunks), backdrop 20 → 6 calls, labels and blobs 2 calls; L1 / L2
  pools grow by ≈ 4k. The ferry and coit-high rises are other lanes' new content since the baseline (streetcars /
  cable cars 3 / 19k + 16k shadow at the ferry, 2 / 15k + 15k shadow at Coit; hero buildings 50k → 73k in the ferry
  frame, while the district meshes are byte-identical per the hero regression test), not C2's; coit-high is the tightest view (398.8k).
- Hero far view (Nob Hill → the hero, ≈ 400 u, heroFar): 126 / 409,610 with the hand-made ground → 117 / 361,988 with
  the stand-in; the two frames are indistinguishable at that distance:
  [`qa/w2/C2/herofar-ground-standin.jpg`](qa/w2/C2/herofar-ground-standin.jpg) (top: hand-made, bottom: stand-in).
- Contact sheet [`qa/w2/C2/budget-before-after-golden.jpg`](qa/w2/C2/budget-before-after-golden.jpg): tp-high250,
  tp-high, mission, sunset before / after. No holes or ring at the smaller L0 disc; from 40–70 u the L1 boxes past
  60–90 u read like the L0 houses (flat tops), the near trees thin out.
- Bundle, real `vite build --config vite.opus.config.ts` (opus-heavy), gzip:

| build | GameRoot | city chunk (`cityMode`, city mode only) |
|---|---|---|
| parent commit `8241516` (before the split, like for like) | 319.05 KB | — (in GameRoot) |
| `c20886c` (this part) | **291.59 KB** | 31.45 KB |
| `c20886c` + E2's one-line request below (built in a scratch worktree, not committed) | **251.20 KB** | 31.56 KB (+ the landmarks move to their own lazy chunk, shared with `?solo`) |

  Composition of what is left (source-map attribution of the GameRoot chunk): the landmark data + recipes (≈ 42 KB)
  come in only through `actors/moveSystem.ts → world/sf/landmarks/context.ts` (E2 → D2); `core/walkGraph` +
  `world/sf/format` (≈ 4.3 KB) through `actors/nav.ts` (E2); GLTFLoader (11.8 KB) through `actors/system.ts`,
  `vehicles/pelican.ts` and `world/life.ts`.

### Decisions

- camH is measured under the **camera** (far DEM), not under the focus: the high-view cost comes from what the camera
  sees. A walking camera on a steep slope may read 25–35 u and trim L0 slightly; the player's own surroundings stay
  L0 (≥ 60 u).
- The hero ground stand-in lives in the city ground pool (0 calls) instead of its own mesh, and is built in 2 ms slices
  (≈ 0.3–0.8 s of work on this CPU in one piece would be a visible hitch).
- The city chunk is awaited before the world is built (Suspense in WorldScene) rather than making `World` async: the
  constructor's city branch needs `CityWater`, and the fetch starts as soon as GameRoot runs, so the wait is
  normally hidden behind the renderer setup.
- The budget table keeps the part-a baseline and the same view order (the view order decides where the player
  stands, which moves the shadow pass: see the part-a note).

### Known gaps

- GameRoot is **291.6 KB**, not ≤ 250 KB, until E2 applies request 1 (→ 251.2 KB measured) and request 2 (→ ≈ 247 KB,
  estimated from the source map). Everything C2 owns that is city-only is already out.
- The high-view budget holds without F13 (hero-life pause: `life` 38k at tp-high250) and without touching the player
  group (`actors` 52k + 17k shadow in QA-camera views, where the player stays at the Ferry gate): both are headroom.
- `coit-high` is at 398.8k after other lanes' cable cars; any new always-on geometry near Coit needs its own saving.
- fps / phone checks wait for the owner's machine (SwiftShader here).
- Dev-only: editing `world/sf/cityMode.ts` while a page is open can leave HMR with a stale loader; a reload fixes it.

### Not done (for the next part)

- C2-7a/b boards (Marin, East Bay), C2-8 Karl the Fog, C2-9 night light field, C2-10 tier cross-fade, C2-13,
  CS-6 warm-up registrations, CS-7 (quality monitor), C2-14 mobile / night / district-with-Karl contact sheets.
- After E2's requests land: re-run the build and tighten the guard test to also forbid `world/sf/landmarks/context`
  in the main graph.

### Requests

1. **E2, `src/opus-bay/actors/moveSystem.ts`** (HC-1, −40 KB gzip measured): replace
   `import { landmarkTallStructures } from '../world/sf/landmarks/context';` with
   `import { cityModule } from '../world/cityLoader';` and in `cityTallStructures()` return
   `cityModule()?.landmarkTallStructures(l => (typeof l.base === 'number' ? l.base : heightAt(l.x, l.z))) ?? [];`
   (city mode always has the module before the world is built; `cityMode.ts` already re-exports the function).
2. **E2, `src/opus-bay/actors/nav.ts`** (≈ −4 KB): load `core/walkGraph` with a dynamic import inside `walkGraph()`
   (keep only `import type` statically), so `walkGraph.ts` and `world/sf/format.ts` leave GameRoot.
3. **All lanes:** from main-graph code, read the streamer with `cityStreamerLazy()` (or `cityModule()`) from
   `world/cityLoader.ts`, never a static import of `world/sf/stream` (the guard test fails otherwise).
4. **D2, `world/sf/sites.ts`**: the C2-5 "Sites" rule (landmark LOD0 radius by camera height, `U.uCam.value` minus
   `heightAt`) is still open on D2's side; C2's views pass without it.
5. **F, `world/life.ts`** (F13): pause the hero life on `cityStreamer()?.onHeroFar` (≈ −38k triangles in every
   high view) — headroom, not needed for the numbers above.
