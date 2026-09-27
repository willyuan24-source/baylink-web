# Wave 2 · lane C2 (city look, atmosphere, performance, bundle split)

Branch `opus-bay`, worktree `/home/user/wt/C2`. Budgets and rules: `docs/opus-bay/sf-w2-contracts.md`,
checkpoint §5.4. Numbers are SwiftShader `renderer.info` at 960 × 600 (calls and triangles are valid there, fps is not).

## Part a-look

Tasks: C2-1 breakdown tool, C2-2 SF look remap (CS-1), C2-3 green hills (CS-5), C2-4 haze (CS-2), C2-6 drawn ground =
walked ground, plus the art-direction ledger. The part was stopped mid-way at the 02:53 UTC pause; part
b-lookfinish-budget finished its last uncommitted palette step (commit `e295d1d`) and wrote this section.

### What changed (files, API)

| task | commit | files | what |
|---|---|---|---|
| C2-1 | `4e7c32a` | `world/sf/stats.ts`, `scripts/opus-sf/qa/budget-views.mjs` | `breakdown(scene, camera)` attributes draw calls and triangles of the main pass (frustum-culled; BatchedMesh from its last multi-draw list) and of the sun's shadow pass to groups (`city.l0.toy`, `city.l0.ground`, `city.pool.*`, `city.props`, `hero.ground`, `hero.backdrop`, `life`, `actors` ...). DEV: `__opusBay.city.breakdown()`. The QA script drives 11 fixed views (ferry, tp-walk, tp-high, tp-high250, coit-high, glide-mission, painted, mission, sunset, marina, ocean) through `opus-shot` and writes `views.json`, `views.md` and one JPEG per view. |
| C2-4 | `ba42cf3` | `world/sf/fog.ts`, `world/environment.ts` | `cityFogK(camY, groundY, tod)`: pure multiplier of the time preset's FogExp2 density (a uniform, nothing recompiles). Altitude above the water 20 → 70 u (× 1 → × 0.45), height above the ground 30 → 150 u (× 0.4), per-time city scale blended in from y 15 to 45 (morning 0.85, golden 0.9, night 0.45). A walking camera below y 15 keeps today's fog exactly; district mode is never scaled. Downtown seen from the Twin Peaks summit: fog factor 69 % → ≈ 26 % at golden hour. |
| C2-2/3/6 | `d98cbe0` | `world/sf/look.ts` (new, worker-safe), `build.ts`, `far.ts`, `worker.ts`, `stream.ts`, `recipes/city.ts` | **Roofs:** flat is the norm (86.6 % flat, 5.1 % gable, 8.3 % hip over 57,480 buildings; was 20 % flat). Pitched roofs only for the Sunset / Richmond / Lakeshore / Oceanview tile minority, Marina / Seacliff hips, West of Twin Peaks, single cottages in Noe / Bernal / Glen Park / Excelsior / Portola, and sheds / civic halls. **Walls:** Painted-Lady pastels kept (L ≥ 0.79), Edwardian / residential / stucco pools ≈ 35 % white plus light pastels and creams, SoMa brick stays. **Flat tops** (membrane, light grey, gravel, grey, a little tar) are always darker than their walls. `specOf` feeds L0 and L1 from `look.ts`; far prisms use `farPrismColors` (no × 1.22 saturation); the DataSF zones reach both workers as a `zones` message. Cheap flat tops in `recipes/city.ts` keep the densest L0 cell at 18,239 triangles (cap 18,500). **Hills (C2-3):** land above 30 u mixes to hill grass, earth only on slopes > 0.95; same rules on the far tier. **Ground (C2-6):** L0 / L1 ground = `core/sfTerrain groundRaster` − landmark sink (except within 2 u of bridges and deck-only roads); `dropSeamBuildings` removes the two seam buildings in the hero water at decode time, so their invisible walls in chunk −2_0 are gone. |
| C2-2 finish | `e295d1d` | `world/sf/look.ts` | Flat tops one step lighter (white membrane `#e2ddd4`, light grey `#d5d0c7`, gravel `#c9c3b8` ...): the first remap read grey from above. Terracotta deck kept; far prism tops mix 0.10–0.18 toward the neutral rim tint so orange far tops stay ≤ 5 %. |
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
  (before = `4e7c32a`, after = `e295d1d`; Twin Peaks high view, Alamo Square walking, Sunset at 60 u, Marina at 40 u).
  The orange carpet is gone: from Twin Peaks the city reads as pale flat tops with a light warm haze and the bay and
  downtown are visible; Alamo Square keeps its pastel Victorians with light parapets; the Sunset keeps a red-tile
  minority; the Marina keeps its tile hips (about 40 %, as in the Mediterranean-revival Marina).
- Numbers (golden, high, 960 × 600; `renderer.info`, whole frame incl. shadows):

| view | before (`4e7c32a`) calls / tris | after (`e295d1d`) calls / tris |
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
