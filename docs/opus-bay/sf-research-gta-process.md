# SF research: GTA_SZ design intent and production process (KEY=gta-process)

Research only. Nothing under `C:/Users/willy/baylink-opus` was edited. Citation prefixes: **GTA:** = `C:/Users/willy/opus-qa/ref/GTA_SZ/` (main @ 73603f3), **OB:** = `C:/Users/willy/baylink-opus/`. GTA_SZ code is MIT. Its assets, data and media are not reusable, so everything below is about ideas and process.

## 0. Summary

1. **GTA_SZ did not model all of Shenzhen.** It took one continuous skyline belt, about 22.6 × 8.7 km (bbox 113.915–114.135 E, 22.497–22.575 N). It imported *every* OpenStreetMap (OSM) building and road inside that box at one uniform scale of 0.60 (16,076 buildings, 12,202 roads). Ordinary buildings are cheap extrusions dressed with 8 facade "families". Real modelling effort went only into about 44 named landmarks, each built by one small parametric Blender module. The big-city feeling comes mostly from city-to-the-horizon coverage plus a few instantly readable silhouettes.
2. **The strongest thing to borrow is the process, not the renderer.** It has:
   - an evidence ladder for each object (`planned → evidence-ready → modelled → verified`);
   - one object = one module = one owner, with a single integrator who merges shared files one at a time;
   - candidate folders that can never overwrite the shipped assets;
   - "1 build + at most 2 targeted fixes, then escalate";
   - 8 named review checks per landmark;
   - a standing rule that a green build proves nothing about the picture or the frame rate.
3. **Its own audits say it grew too wide.** It added tanks, planes, missiles and a combat lab, and perfected towers, while the street level stayed empty and dense areas ran at 30–55 fps on an M1 Max. Opus Bay is the opposite: great street-level feel, a guide, real info and 60 fps on phones, but only about 4 % of SF, with a void past the slab.
4. **Plan for Opus Bay:**
   - Keep 0.14 u/m and the −46° projection.
   - Build a data-driven "skeleton SF" first: elevation model (DEM), coastline slab, streets, block typologies, a far city shell and tile streaming.
   - Then Tier-1 silhouettes as parallel per-landmark modules, then ways to travel, then three finished routes that match existing BAYLINK guides.
   - Adopt GTA_SZ's landmark registry, evidence rules and QA scripts almost as-is, scaled down.

## 1. What GTA_SZ actually is (numbers)

**Stack**
- Babylon.js 8.56.2 / WebGL2, TypeScript, Vite; Blender Python for assets; OSM + Copernicus data (GTA:README.zh-CN.md:66-71).
- Work ran from 2026-09-05 (GTA:progress.md:3) to the last verified build on 2026-09-17, which had 257 automated tests (GTA:README.zh-CN.md:190). I count 277 `test(` calls across 57 TS test files.

**Base city** (`GTA:public/city/city.json` → `.meta`)
- origin [114.025, 22.536]; `horizontalScale` = `verticalScale` = 0.6; extent ±6,788 × ±2,605 u.
- 16,076 buildings, 12,202 roads, 1,703 green areas, 312 water bodies, 10 named landmarks.
- Building height sources: the meta says 508 OSM height / 5,445 estimated from floor counts / 9,603 estimated by building type. Recounting `buildings[].heightSource` gives 516 / 6,019 / 9,541. Their manifests drift, which their own audit warns about (GTA:docs/benchmark/current-game-audit.md:38).

**Weight**
- `buildings.glb` 49.8 MB / 3.31 M triangles; `roads.glb` 16.8 MB / 2.02 M triangles; all of `public/city` ≈ 339 MB (current-game-audit.md:28-36).

**Movement**
- Walk 1.6 u/s, run 4.2 u/s (GTA:src/city-walk.ts:2-3).
- Car top speed 53 u/s (GTA:src/driving.ts:13).
- Drone (G), plane (B), tank, and a map click that teleports you to the nearest lane (GTA:README.zh-CN.md:160-171; GTA:docs/质量审查与改进-v0.3.md:35).

## 2. How they scoped the city

- **Research box vs play box.** `config/regions.json` keeps a whole-Shenzhen research bbox [113.75, 22.43, 114.65, 22.87] and 6 sub-regions. They are explicitly "not the final map" (GTA:config/regions.json:4-12; GTA:docs/城市制作路线.md:87). Longhua and Longgang were deferred.
- **Stated intent: curate and compress, not a 1:1 twin** (GTA:task_plan.md:6). Keep internal scale, landmark orientation and sight lines inside key districts; shorten repetitive stretches between them (城市制作路线.md:89).
- **What shipped: one uniform scale.** It is a 0.60 equirectangular projection for horizontal *and* vertical (GTA:AGENTS.md:12). The between-district compression was never built.
  - One scale lets map, navigation and 3D read one coordinate source (GTA:docs/案例筛选与技术决策-v0.2.md:21).
  - That is what made "M → click → teleport to lane" trivial.
- **Human scale is decoupled from city scale.**
  - Characters are 1.72 u (GTA:docs/characters/local-mmd.md:71) on a 0.6-scaled city, so people read about 2.9 m tall against buildings.
  - The real compression is arcade speed: 53 u/s crosses the 13.58 km world in about 256 s.
- **The first playable was tiny.**
  - Targets: an 80–120 m street (GTA:docs/游戏策划与美术方向-v1.md:78); a 300–600 m route with a 60–100 m hero zone (城市制作路线.md:94).
  - v0.1 shipped a ~100 m street with 18 buildings. It measured 60.00 fps, p95 17.5 ms, p99 18.1 ms over 17,880 frames (GTA:docs/开发记录-v0.1.md:32,55-64).
  - Within days they pivoted to the whole-bbox OSM city. The later audits (§6) are the bill for that jump.

## 3. Landmarks vs ordinary blocks

**The three tiers are explicit** (GTA:docs/landmarks/external-agent-handbook.md:18-24):
- hero landmarks, researched and modelled one by one;
- common buildings as reusable prototypes with constrained variants: "4 types pass first, then 8–12" (:22);
- distant groups merged and simplified.

**Ordinary buildings: what went wrong and the fix**
- Problems:
  - OSM footprint extrusion used a naive rule (`h>48 → office`). It dressed 2,005 residential towers as offices.
  - Wall UVs restarted at 0 on every wall, so every building repeated the same windows and lit-window pattern (GTA:docs/建筑重复审计-本轮.md:9-10).
- Fix:
  - 8 hand-drawn "wall grammars" in one 1024² atlas.
  - A per-building seed and UV phase carried in a `TEXCOORD_1` float2 (family, seed).
  - Result: 0 extra draw calls, 0 extra lights (建筑重复审计-本轮.md:20-21, 42-47).
- The reference city they benchmarked against gets most of its variety "from shared geometry + shared material parameters", not per-building meshes (GTA:docs/benchmark/reference-runtime-audit.md:43).

**Landmarks: lists, modules, costs**
- Lists:
  - a production queue of 16 (GTA:docs/landmarks/shenzhen-landmark-roadmap.md:17-34);
  - a top-50 selection table with a coverage flag; off-map objects get no invented coordinates (GTA:docs/landmarks/shenzhen-top50.md:5-7).
- Modules:
  - 52 modules in `scripts/landmarks/`, 36–264 lines each, 4,392 lines total.
  - Each is `build(b, lm, spec, scale=0.6)` over a shared primitive API (`box/loft/tube/footprint`) (GTA:docs/landmarks/agent-workflow.md:89; GTA:scripts/landmarks/pingan.py:7-33).
- Costs:
  - 37 massing candidates total 33,686 triangles / 313 meshes / 1.27 MB, about **910 triangles each** (`GTA:public/city/landmark-candidates.json` → `.assetStats`).
  - The 5 detailed hero objects total 103,564 triangles / 1.38 MB, about **20.7k each** (GTA:docs/landmarks/delivery.md:29).
  - Ceiling per object: 25k triangles / 12 materials / 8 MiB / 2048 px textures. Added per screen: ≤150k triangles and ≤60 draw calls (agent-workflow.md:150-155).

**How they prioritized**
- Order by existing evidence, reusable tooling, visual payoff and map coverage (roadmap.md:9).
- Every landmark record carries: arrival point, arrival road, yaw, `excludeRadius` (cuts the base blocks underneath) and its own photo camera. Example for Ping An: `photoDistance 720`, `photoTargetHeight 162`, `photoElevation 0.16` (landmark-candidates.json `landmarks[0]`).

**Late lesson (their words, paraphrased):** finish one landmark plus 150–300 m of believable street around it before starting the next. Never leave a detailed tower standing on empty ground (roadmap.md:7, :81-86).

## 4. The landmark workflow (reference → script → candidate → verify → promote)

The one-line summary is "public sources → source record → parametric model → incremental integration → in-game check" (delivery.md:3). The stages:

1. **Evidence**
   - Identity, a WGS84 centre, and at least 2 photo directions.
   - Every observation is tagged `reported` / `measured` / `estimated`; `unknown` fails (agent-workflow.md:66-81).
   - Photo downloads are Wikimedia Commons CC/PD only, and photos never become textures (shenzhen-top50.md:22-28).
   - Research is capped at 3 named gaps and 6–10 references (external-agent-handbook.md:62).
2. **Frozen spec.** Massing list, ≥3 identifying features, material zones, budget and fixed review views, signed off by the integrator (handbook §3, :47ff).
3. **Module.** Only `scripts/landmarks/<id>.py` plus the job folder. Anything shared goes into `integration-notes.md` for the integrator (agent-workflow.md:95).
4. **Candidate export.**
   - `landmark_candidate.py export` writes an isolated `artifacts/landmark-candidates/run-<UTC>/` folder.
   - It contains the GLB, 6 views (front/back/left/right/top/street ¾) in both clay and material, and triangle/mesh/material counts read from the real GLB.
   - It also records before/after hashes of `public/` to prove nothing shipped was touched (GTA:docs/landmarks/candidate-preview.md:40-52).
   - The top view is fitted with `ortho_scale = max(size.x, size.y·aspect)·1.32` (:52).
5. **Integrator review.** Same camera angle, baseline vs candidate. Reject a worse silhouette, white or black glass, unmotivated glow, or overlap with the old building (roadmap.md:95).
6. **Promotion.** Serial and done by the integrator only. Old base buildings are removed via `baseBuildingIds`; manifests are bound to SHA-256 (agent-workflow.md:109-118).
7. **Verify.**
   - 8 named checks: `scale, orientation, silhouette, context, collision, browser, performance, provenance`. Each has evidence paths, a reviewer and a date (agent-workflow.md:132-144).
   - `status` recomputes the stage from hashes, so editing a GLB or its evidence demotes it (agent-workflow.md:33-42).
   - Stop rule: 1 version + ≤2 targeted fixes (roadmap.md:110).
   - Real case: a Grok-built Tencent candidate (11,702 triangles) stayed "partial" because the grid was too coarse and the entrance weak. It was not shipped (roadmap.md:107,114).

## 5. Quality gates they enforce in writing

- **A green build is not proof.** Never claim appearance or performance from a successful build (GTA:AGENTS.md:33; README.zh-CN.md:60).
- **Candidate-ready is not a pass.** It proves nothing about visuals, fidelity or fps (GTA:docs/资产重建与交付保护.md:35).
- **"Verified" is not survey-grade** (agent-workflow.md:40).
- **Minimum views:** eye height, skyline and top-down (GTA:skills/landmark-reconstruction/SKILL.md:93). Day, dusk and night are compared from the *same* camera (README.zh-CN.md:93).
- **Performance numbers are bound to the bundle SHA** and always state their scope (e.g. GTA:docs/性能修复-2026-09-05.md:30).
- **Landscape objects** (parks, hills) are judged by the ground experience, not by triangle counts or six views (roadmap.md:56).
- **Each gap names what it blocks.** Example: the v0.3 review says the next step is characters and a continuous story on one block, "not expanding the map indiscriminately" (GTA:docs/质量审查与改进-v0.3.md:31).

## 6. What went wrong and how it was fixed

| Failure | Cause | Fix | Cite |
|---|---|---|---|
| Rebuild silently reverted cars, buildings and plants | The rebuild script overwrote `public/city` stage by stage | Rebuild into `artifacts/rebuilds/<time>/`; never replace the reviewed `public/city`; status `candidate-ready`/`failed` | 资产重建与交付保护.md:5,35 |
| Looked fixed but old assets were loading | Several build entry points overwrote each other | Record bytes + SHA-256; test on the production build | 质量审查…v0.3.md:12 |
| Far land rendered as sea; flicker | One sea sheet under the city; near plane too small; coplanar roads | Cut sea and land against each other; per-mode near plane; depth bias | …v0.3.md:9 |
| Trees in car lanes | Trees placed per source road; only trunks checked | Offline clearance: full crown radius + 1 m; runtime check | …v0.3.md:10 |
| 1–2 s freezes, blank sky when switching vehicles | Light-set changes → PBR shader recompiles; unready meshes skipped | Lights always enabled, only intensity changes; streaming loader patched so it can't raise light budgets; post-processing chain rebuilt in one pass | 性能修复-2026-09-09…md:7-19,44 |
| Idle dev server at 40–55 % CPU | Vite file polling | Polling off; big data folders ignored | 性能修复-2026-09-05.md:7 |
| 30 MB of facades resident | Whole-city fine-facade GLB | 150 tiles of 640 m; prefetch 1,050 m / show 700 m / unload 1,500 m; shadows ≤520 m | same :10; src/city-facade-stream.ts:10-34 |
| Every building looked the same | Type rule + UV phase | 8 facade families + per-building seed | 建筑重复审计-本轮.md:9-21 |
| "Untextured blockout" look | Post-processing order wrong, 8-bit targets, flat sun/fill ratio (sunset sun/hemi ≈1.4:1) | Lighting presets as data: sunset sun 1.4 / hemi 0.12 / env 0.40; day 3.0 / 0.28 / 0.78; night 0.30 / 0.08 / 0.55 | graphics/cinematic-finish-lookdev…md:17 |
| Towers fine, street empty; about 30 fps | Effort went to breadth and towers | Audit re-scoped: one finished 1–1.5 km route before expanding | benchmark/current-game-audit.md:7,50,68; gta6-benchmark.md:48-54 |
| Parallel agents clobbered each other | Shared checkout, no isolation | File-ownership tables; checkpoints; "separate worktree per worker" | gameplay/first-playable-goal.md:17-25,56-59 |

## 7. Performance methodology

**Acceptance line**
- Mean ≥59 fps, p95 ≤18 ms, p99 ≤25 ms, no repeated >50 ms frames. Never mix this up with "every frame ≤16.67 ms" (游戏策划与美术方向-v1.md:135).
- Starting budget: 0.5–0.9 M visible triangles and 150–250 draw calls (:124).

**Instrumentation**
- `world.performance()` drops the first 120 samples, then reports mean, p50/p95/p99, count over 50 ms, active meshes and triangles (GTA:src/city-world.ts:567).
- `diagnostics()` sits on `window.__SHENCHENGJI_CITY__` (:566).

**Scripted runs with real input**
- `city-benchmark.mjs` drives with the keyboard along a road-graph route: 3 windows of 100 s, R-recoveries counted, transition warm-ups excluded (GTA:scripts/city-benchmark.mjs:9-23).
- `city-tour.mjs` loops over every landmark: map → fast travel → drive 0.8 s → photo view → screenshot. It asserts moved > 0.2 and that photo mode exited (GTA:scripts/city-tour.mjs:4-5).

**A/B against a baseline build**
- A separate worktree of the old commit gets the same counters. Over the same sequence (性能修复-2026-09-09…md:25-33):
  - shader compiles 650 → 198;
  - frames over 80 ms 31 → 3;
  - long tasks 49 → 12.
- Regressions show up in hitch and compile counts, not in average fps.

**Budget tools**
- Distant-city shell: 16,070 buildings merged into 150 meshes / 462,533 triangles, switched at 3,300 m (graphics/distant-city…md:9).
- Quality tiers as a data table with a URL override that is never saved (graphics/quality-presets.md:5-25).
- Data-defined cinematic shots (`orbit(center, yaw, elevation, distance)`) used for both trailers and repeatable screenshots (GTA:src/trailer-shots.ts:17-28).

**Honesty:** 30 fps reports are recorded as *failures*, and one-off numbers are labelled as such (current-game-audit.md:50).

## 8. How the AI agents worked

**Roles** (README.zh-CN.md:40-44)
- GPT-6 Astra: city breakdown, Blender Python, materials, browser checks.
- Fable 5.1: code and performance fixes.
- Human author: picks priorities, supplies references, spots in-game problems, decides trade-offs.
- Later, Cursor Grok 4.6 did evidence gathering, filled in parameters and wrote per-landmark modules. The strongest model was used only at gates: spec sign-off, silhouette gate, conflicts, final integration (external-agent-handbook.md §2, §7).

**The loop:** name one problem → find the owning file → change it → reproduce in the browser → keep the evidence (README.zh-CN.md:48). Their brief template is Goal / Read first / Keep / Deliver / Check (:52-58).

**Concurrency limits**
- ≤4 executors at once (gameplay/first-playable-goal.md:3).
- ≤1 Blender render and 1 heavy browser at a time on the dev machine (:34).
- An exclusive-file table for each executor (:17-25).
- Loops that can be scripted (renders, hashes, counts) become scripts, so no model spends a turn per image (handbook §3).
- A qualification trial compares two executors on one frozen spec before assigning a task class (handbook §7).

## 9. What made the result feel good (from their images and docs)

I viewed `docs/media/readme/{futian-axis-day, tencent-binhai-day, luohu-night, lianhua-hill-sunset, street-walk-sunset}.jpg`.

1. **No edge in view.** In every aerial shot, city fills the frame to the horizon, closed off by hills from the Copernicus 30 m elevation data and by sea. Density sells scale even though ordinary buildings are plain extrusions.
2. **5–10 readable silhouettes per view.** Ping An's diagonal bracing, the Civic Center roof with its red/yellow/blue accents, KK100, the Tencent bridges. All are cheap massing (§3).
3. **Strong lighting ratios and atmosphere.** Sunset key/fill 1.4 vs 0.12, blue-grey haze, varied night windows (8 families; per-window occupancy and colour temperature).
4. **Freedom of viewpoint.** Walk → car at 53 u/s → drone → plane, plus map-teleport. The player can always get to "the shot".
5. **A camera pose for every landmark.** Each landmark has a photo pose and a scripted orbit, so every place has a flattering shot.
6. **Real names.** Road names on signs and map (7,354 display names; graphics/city-usability…md:10).

At street level it is actually sparse: flat road, puddles, a sign (`street-walk-sunset.jpg`). Their own audit agrees (current-game-audit.md:7).

## 10. Honest gap analysis vs Opus Bay

Images compared: `opus-qa/sf0-baseline.png`, `int-62-coit-view.png`, `p1-fix-actors-A2-coit-view.png`, `pol1/A1-pier39-entrance-golden.png`, `district-3d-wide.png`.

| Dimension | GTA_SZ | Opus Bay now | Verdict |
|---|---|---|---|
| Coverage | 22.6 × 8.7 km real, 16k buildings | Slab x −246…244, z −104…114 u (OB:src/opus-bay/data/district.ts:409-412) = 490 × 218 u ≈ 3.5 × 1.56 km real; 239 lots (OB:src/opus-bay/world/city.ts:9-12) | **We cover ≈4 % of SF.** Biggest gap. |
| Horizon | City + hills + sea everywhere | Past the slab: cream fog. At Pier 39 the promenade runs into nothing (`A1-pier39-entrance-golden.png`); downtown behind is grey boxes (`district-3d-wide.png`) | **We lose.** |
| Landmarks | 10 base + 37 massing + 7 detailed | About 8 in-world (Ferry Building, Coit, Transamerica, Salesforce, Pier 39/33, cruise terminal, weekly board; OB:src/opus-bay/world/landmarks.ts:54-431) + backdrop Bay Bridge / Alcatraz | Ours are more charming; theirs are far more numerous. |
| Ordinary blocks | OSM footprints + 8 facade families | Grid blocks, 5–7 styles picked by zone and hill factor (district.ts:863-879); critic: "downtown is monotone" | Good kit; needs neighbourhood typologies for all of SF. |
| Terrain | 30 m elevation data + mountain relief | Two analytic hill shapes (district.ts:356-372) | Doesn't scale to SF's 40+ hills. |
| Movement | Walk/run/car/drone/plane/teleport | Walk 4.2 / run 7.5 u/s, jump, click-to-walk (OB:src/opus-bay/actors/controller.ts:18-32), streetcar ride | Fine for 300 u, too slow for about 1,500 u. |
| Guide / story / real info | None linked to live info | BAYBAY, tour / week / free; `sourceUrl` + `verifiedAt`; live events (OB:src/opus-bay/DESIGN.md:78-83) | **We win clearly.** |
| Mobile | Desktop only; the launch plan routes phones to a video (launch plan :59) | 390×844 at 60 fps (OB:src/opus-bay/STATUS.md:40-45) | **We win.** Must keep it. |
| Performance | Dense areas 30–55 fps on M1 Max, about 1,150 draws, 339 MB | 53–64 draws, 144–223k triangles, 49–60 fps at 4× CPU throttle, 2.1 MB (STATUS.md:40-47) | We win, but at 4 % of the area. |
| QA | 257 tests; landmark tour; percentile benchmark; compile counters; SHA manifests; 6-view previews | 120 tests; `opus-shot` fps is a frame-count mean (OB:scripts/opus-shot.mjs:63); `perf.mjs` uses 3–4 s windows; no landmark registry or regression shot list | Adopt theirs. |
| Process | Evidence ladder, per-object modules, one integrator | Module ownership (DESIGN.md:92-103), critic → fixer rounds | Similar, but no per-landmark state or budget yet. |

## 11. Recommendations for Opus Bay (whole SF)

### 11.1 Scale, projection, compression

**Horizontal: keep K = 0.14 u/m, rotation −46°, origin (37.802338, −122.40001)** (district.ts:43-46).
- Every anchor, test and the Embarcadero district stay valid.
- Move `project()` into `OB:src/opus-bay/core/geo.ts` so SF data and `district.ts` share it.
- Whole-SF extent: about **1,829 × 1,585 u** north-up, or **1,978 × 1,905 u** in the rotated frame. Computed with district.ts `project()` on Lands End, Ocean Beach S, Candlestick, Hunters Point, GGB south anchorage and the Ferry Building.

**Travel times at the current speeds (walk 4.2 / run 7.5 u/s)**

| Trip | Distance | Walk | Run |
|---|---|---|---|
| Ferry → Twin Peaks | 920 u | 219 s | 123 s |
| Ferry → Golden Gate Bridge | 1,054 u | 251 s | 141 s |
| Ferry → Ocean Beach | 1,494 u | 356 s | 199 s |

That is about GTA_SZ's full traverse by car (≈256 s), so the scale is right *if* we add faster travel (§11.2 P3). Keep a single uniform scale, as GTA_SZ ended up doing.

**Optional compression, only if the density metric fails** (see 11.4): compress the Richmond/Sunset band west of about 4 km real west of the origin.
- `e' = e` for `e ≥ −4000 m`, else `e' = −4000 + 0.7·(e + 4000)`.
- Saves about 1.6 km real (≈230 u) and stays one function in `geo.ts`.

**Vertical: soft knee on elevation-model heights.**
- `y = 0.238 · (h ≤ 90 ? h : 90 + 0.65·(h − 90))`.
- Telegraph Hill is unchanged (84 m → 20 u = `SUMMIT_HEIGHT`, district.ts:352).
- Nob Hill 115 m → 25 u; Bernal 132 m → 28 u; Twin Peaks / Mt Davidson ≈282 m → 51 u. Real values are reported figures; verify at the evidence stage.

**Landmark heights:** `toyH = max(0.16·H, 6 u)`. This matches today's Transamerica (41 u for 260 m, 0.158/m) and Salesforce (56.5 u for 326 m) (landmarks.ts:199-204, 250-255).
- Golden Gate Bridge towers ≈36 u; main span ≈179 u.
- Sutro Tower ≈48 u on a ≈47 u ridge: the highest point in the diorama, a natural compass like Ping An in Shenzhen.

**Slab:**
- The SF coastline buffered about 60–120 u into the water.
- A straight southern cut along the county line (≈37.708 N) that shows the layered-earth edge.
- Alcatraz, Treasure Island / Yerba Buena Island, Angel Island and the Marin Headlands as small satellite slabs whose edges do not float (the polish-1 art critic flagged floating islands).

### 11.2 Phasing (each phase = one workflow run ending in a named gate)

- **P1 Skeleton SF (data first, as in GTA_SZ).**
  - Offline `OB:scripts/opus-sf-prepare.mjs` reads:
    - an elevation model (USGS 3DEP 1/3″, public domain) resampled to a 4 u grid (≈500×480 samples, 16-bit, ≈250 KB gzip);
    - coastline, streets, parks and neighbourhood polygons (OSM, ODbL with attribution like GTA:data/ATTRIBUTION.md; or DataSF, licence to be checked);
    - building footprints *aggregated per block*, used only for height and building-type statistics.
  - It writes into `C:/Users/willy/opus-qa/sf-candidate/`, and the integrator promotes to `OB:public/opus-bay/sf/` together with a `manifest.json` (sha256, bytes, triangle counts, source versions, licences).
  - Runtime:
    - 128 u tiles (≈914 m real), about 150 land tiles;
    - detail radius 192 u, prefetch 256 u, unload 352 u, one tile load at a time (GTA's 1,050/700/1,500 pattern);
    - far shell (HLOD) always loaded: one prism per block with 1–2 height steps, **≤120k triangles, ≤16 draw calls**;
    - shadows only from actors and landmarks within 60 u.
  - Building-type kit v1: 4 types first (Victorian/Edwardian row, Sunset stucco row, downtown tower + podium, SoMa brick loft), then 8 (+ Marina stucco, Chinatown balcony mixed-use, Mission 3-flat with bay windows, civic/church). This is GTA's "4 types first, then 8–12".
- **P2 Tier-1 silhouettes.** Parallel `world/landmarks/<id>.ts` modules (list in 11.3), each 1 build + ≤2 fixes.
- **P3 Travel and movement.**
  - Toy bike/scooter at about 13 u/s (Ferry → Ocean Beach ≈115 s).
  - Cable car ride (Powell–Hyde); F-line extended to Castro.
  - "BAYBAY hop" fast travel to discovered viewpoints, extending `OB:src/opus-bay/game/travel.ts`. This is the equivalent of GTA's map teleport.
  - "Diorama overview" zoom that shows the whole SF slab on the cream table: the brand key-art moment, and our answer to GTA's drone.
- **P4 Three finished routes built to street-level quality**, each matching BAYLINK content that already exists:
  1. Chinatown → North Beach → Coit (planner id `chinatown`, guide `sf-chinatown-north-beach-walk-guide`);
  2. Marina → Palace of Fine Arts → Crissy Field → Fort Point / Golden Gate Bridge (`palace`, `golden-gate`, `presidio`);
  3. Golden Gate Park car-free JFK Promenade → Ocean Beach / Sunset Dunes (`golden-gate-park`; guides `golden-gate-park-free-car-free-day-guide`, `sf-sunset-dunes-october-coastal-walk-2026`).

  All ids exist in `OB:public/planner-catalog.json` and `baybay-guides.json`. This is GTA's "one finished 1–1.5 km route before expanding" lesson.
- **P5 Tier-2 anchors, new postcards and BAYBAY barks.** Tour v2 ("SF in a day").
- **P6 Verify.** Full benchmark, regression sheets, owner playtest on desktop and phone.

### 11.3 SF landmark list and priority tiers

Priority is skyline visibility × existing BAYLINK content × position on a finished route. Budgets are on the shared vertex-colour material (GTA reference: ≈910 triangles per massing candidate, ≈20.7k per hero).

**T1 — visible from several districts; ≤6k triangles each (Golden Gate Bridge ≤12k); +≤2 draw calls each.** Heights are reported values; verify at evidence stage.

| Landmark | Real height | Status / BAYLINK link |
|---|---|---|
| Golden Gate Bridge + Fort Point | 227 m towers | new; planner `golden-gate` |
| Sutro Tower | 298 m mast | new |
| Twin Peaks | terrain + viewpoint | new |
| City Hall dome | 94 m | new |
| Palace of Fine Arts rotunda | ≈49 m | new; planner `palace` |
| Golden Gate Park | 4.8 × 0.8 km outline; de Young tower 44 m | new; planner `golden-gate-park` |
| Bay Bridge west span | — | exists as backdrop; upgrade to in-world |
| Salesforce, Transamerica, Coit, Ferry Building | — | exist; re-verify under the 8 checks |
| Alcatraz | — | exists; planner `alcatraz` |

**T2 — neighbourhood anchors with a walkable plaza and an info card; ≤2.5k triangles each.**
- Chinatown Dragon Gate + Grant Ave
- Painted Ladies (Steiner 710–720) + Alamo Square
- Lombard Street crooked block
- Fisherman's Wharf / Hyde St Pier / Ghirardelli (guide `sf-fishermans-wharf-pier39-guide`)
- Presidio Tunnel Tops
- Crissy Field
- Ocean Beach / Sunset Dunes
- Lands End / Sutro Baths / Cliff House
- Conservatory of Flowers, California Academy of Sciences, Japanese Tea Garden, Dutch Windmill (inside Golden Gate Park)
- Mission Dolores + Dolores Park
- Castro Theatre marquee
- Union Square + Powell cable-car turnaround
- Grace Cathedral / Nob Hill
- Haight & Ashbury
- Oracle Park (plain-text name, no logos)
- Legion of Honor
- Existing: Pier 39, Exploratorium

**T3 — flavour and backdrop; ≤800 triangles each.**
Wave Organ, Baker Beach, Bernal Hill, Mt Davidson cross, Stow Lake, Yerba Buena Gardens / SFMOMA, Chase Center, St Mary's Cathedral, 16th Ave Tiled Steps, Balmy Alley murals, Marin Headlands and Angel Island as satellite backdrops. Suggested wildlife in the spirit of the sea lions: Golden Gate Park bison, Telegraph Hill parrots.

### 11.4 Acceptance checks

**Skeleton gate (P1)**
- **Recognizable from above.** From the overview and the `?at=twin-peaks` view, the owner can name Golden Gate Park, the Presidio, the Market St diagonal, the downtown cluster and Sutro/Twin Peaks on a contact sheet.
- **No void.** From every T1/T2 arrival point at golden hour, pixels near the table colour `#f3ecdf` make up **<5 % of the upper half of the frame** (automated).
- **Navigation.** Every landmark arrival point stands and is reachable from `ferry-gate` on the nav graph (the pattern of GTA:tests/city.test.ts:5-6).
- **Draw budget.** Walk mode stays inside DESIGN §9 (≤150 draw calls, ≤400k triangles; OB:src/opus-bay/DESIGN.md:87). New SF content adds ≤+40 draw calls and ≤+120k triangles per view over today's baseline.
- **Frame timing** (3 routes × 90 s):
  - desktop 1×: p95 ≤18 ms, p99 ≤25 ms;
  - 4× CPU throttle: mean ≥45 fps on desktop *and* 390×844;
  - 0 frames >100 ms from tile streaming after the first lap;
  - `renderer.info.programs.length` unchanged after warm-up. This is the shader-stable contract: never toggle lights or fog, change intensities only, share one material instance across tiles.
- **Bytes.** First load stays ≤3 MB (DESIGN.md:89); tiles ≤60 KB gzip each; shell ≤400 KB gzip.
- **Density.** On each finished route, a named place or interactable at least every 225 u (≈30 s of running), and a T1/T2 landmark on screen in ≥90 % of benchmark frames (automated by projecting landmark bounding boxes).

**Per-landmark gate** (GTA's 8 checks, adapted)
1. Silhouette readable at 64 px (DESIGN.md:66).
2. Scale follows the `toyH` policy.
3. Orientation within ±10° of the real bearing.
4. Centroid within 3 u of `project(lat, lng)`.
5. Context: ground/plaza present, no overlap; `excludeRadius` clears the lots.
6. Walk-around ring completes without sticking.
7. Triangles/draws within tier budget.
8. Info card has `sourceUrl` + `verifiedAt` + a BAYLINK link; checked day / golden / night from the same camera.

Record each as `pass/fail + evidence path + date` in `C:/Users/willy/opus-qa/landmarks/<id>/validation.json`. Evidence tags are `reported/estimated`, never `unknown`.

### 11.5 QA scripts and tests to add

**Scripts**
- `OB:scripts/opus-sf-tour.mjs` (from GTA city-tour). For each registry entry:
  - `?start=local&at=<arrival>&time=golden` → street screenshot → photo-pose screenshot → walk 1 s;
  - assert moved >0.2 u, the landmark is inside the camera view, 0 console errors;
  - output a contact sheet + JSON.
- `OB:scripts/opus-sf-bench.mjs` (from city-benchmark):
  - autopilot along A* paths (`actors/nav.ts`) using real key input over CDP;
  - drop the first 120 frames; report p50/p95/p99, count >50 ms, long tasks (`PerformanceObserver`), `gl.info.render.calls/triangles`, `programs`, tile loads;
  - 1× and 4× throttle, desktop and mobile;
  - fail on a >10 % p95 regression vs the saved baseline JSON.
- `OB:scripts/opus-sf-shots.mjs`: a fixed shot list in `data/sf/sf-shots.ts` (the equivalent of trailer-shots.ts; ≈24 shots = 8 T1 landmarks × day/golden/night) → before/after sheets. The same list feeds the trailer.
- `?solo=<id>` preview route: one landmark on a neutral turntable, 6 views (front/back/left/right/top/street ¾) in clay and in palette. This is GTA's candidate preview without Blender.
- Extend `window.__opusBay.world.stats()` (OB:src/opus-bay/world/WorldScene.tsx:91-94) with `perf()` percentiles and `programs`. Replace the mean-only fps in opus-shot (opus-shot.mjs:63) with frame-interval percentiles.

**Tests**
- `tests/opus-bay-sf-landmarks.test.ts`: unique ids; every record has lat/lng, tier, `toyH`, arrival anchor, photo pose, `sourceUrl`, `verifiedAt`; planner ids exist in the catalog; triangle count ≤ tier budget (built headless).
- `tests/opus-bay-sf-data.test.ts`: arrival points stand and are connected; no lots inside a landmark `excludeRadius`; no props on roads or crossings (the pattern of GTA:tests/city-roadside-planting.test.ts:25); building-type share per neighbourhood (e.g. Sunset ≥70 % stucco rows); `project`/`unproject` round-trip.
- `tests/opus-bay-sf-tiles.test.ts`: tile ownership is stable when input order changes (GTA:tests/city-distant-geometry.test.ts:46); load/unload hysteresis; shared material instances only.

**Dev server:** add `server.watch.ignored: ['**/public/opus-bay/sf/**']` to `OB:vite.opus.config.ts:6` if the generated data gets large. GTA's idle-CPU lesson.

### 11.6 File-level ownership (the integrator owns the bold items)

- **`core/geo.ts`** (new: projection, compression, soft knee), **`core/terrain.ts`** (elevation sampler behind `heightAt`; Telegraph Hill stays analytic), **`world/WorldScene.tsx`**, **`world/materials.ts`**, **`data/sf/index.ts`**, **`public/opus-bay/sf/manifest.json`**.
- Data agent: `scripts/opus-sf-prepare.mjs`, `data/sf/sf-neighborhoods.ts` (building-type weights and palette per neighbourhood).
- World agent: `world/sfTiles.ts`, `world/sfShell.ts`, `world/typologies.ts` (8 building types on the existing `Batch`/`BOX`/`extrudeXZ` primitives, OB:src/opus-bay/world/builder.ts:84-117).
- Landmark agents: one each for `world/landmarks/<id>.ts` exporting `build(b: Batch, f: Frame, spec)`, plus their own `opus-qa/landmarks/<id>/`. They never touch shared files; shared needs go in `integration-notes.md`.
- Content agent: `data/sf/sf-landmarks.ts` (info, links, copy), `data/script.ts` additions.
- Movement agent: `actors/controller.ts`, new `actors/vehicles.ts`, `game/travel.ts`, `game/ride.ts`, `actors/camera.ts` (far plane and fog for the overview mode).
- Keep `data/district.ts` as the hand-made Embarcadero hero district; SF tiles skip its polygon.

### 11.7 Process rules to adopt verbatim

- Briefs use Goal / Read first / Keep / Deliver / Check.
- At most 4 builder agents + 1 integrator; at most 1 Blender job and 2 headless Chrome instances at once.
- 1 build + ≤2 targeted fixes, then an escalation note.
- Candidates live in `opus-qa`; promotion is by the integrator only and bound to hashes.
- Screenshots name the manifest hash.
- "Build passes" is never reported as "looks right" or "runs at 60".
- Every fps number states viewport, throttle, route and duration.

### 11.8 Higgsfield (≤500 credits this round)

Ledger rates: Nano Banana Pro ≈2 credits per image; Meshy image→3D ≈30; multi-image→3D ≈120 (OB:src/opus-bay/ASSETS-LEDGER.md:31,48,139).

| Use | Amount | Credits |
|---|---|---|
| Style targets for 8 neighbourhoods + 12 T1/T2 "toy reference sheets" (targets only; GTA treats concept art as a target, never evidence, GTA:docs/游戏策划与美术方向-v1.md:13) | 20 images | ≈40 |
| New postcards | 16 | ≈40 |
| New BAYBAY barks | ≈20 | <10 |
| Creature GLBs (bison, parrots) | 2 × (30 + concept) | ≈64 |
| Qualification trial: one T2 landmark via image→3D vs a procedural module, judged on the same 8 checks | 1 | ≈32 |
| **Planned total** | | **≈190** |

- Keep at least 250 in reserve and log every job in the ledger.
- Do **not** generate hero landmarks as opaque 3D meshes. GTA's lesson: editable, reproducible parametric modules win on cost (≈910 triangles per massing candidate), style consistency and fixability.

### 11.9 What not to copy

- Photoreal PBR/HDR and planar reflections.
- 339 MB of assets.
- Cars, tanks and missiles.
- Desktop-only.
- Character models with no-redistribution licences (GTA:docs/characters/local-mmd.md:18-20).
- The "GTA" name; they themselves avoid it (游戏策划与美术方向-v1.md:13).

Our pillars stay: cozy toy diorama, BAYBAY, real info linked into BAYLINK, brand palette, phones first.
