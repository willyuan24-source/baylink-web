# Wave 4 · lane L · Landmarks & streets (the new sites around the city)

## Early phase

Written 2026-09-27 by the lane-L agent (worktree `C:/Users/willy/wt/w4-l`, branch `w4-l` → `opus-bay`). Early-phase rule
(`sf-w4-lead.md` §2): new files only. Every file lane L touched is a file it created in wave 4 (`git show --name-status`
over the `W4-L*` commits lists only `A` entries plus later edits of those same files); nothing imports the new
modules yet, so the game runs exactly as before. Higgsfield: lane L spent **0 credits** (no ledger file).

### 给主人的摘要

1. 新地点做好了 **24 个**：主人点名的全部 8 个（石镇购物中心、旧金山州立大学、UCSF 帕纳萨斯和 Mission Bay 两个校区、USF 孤山 + 圣依纳爵堂、城市学院和它的里维拉艺术中心工地），一级景点 13 个（加州科学院、音乐广场、日本茶园、联合广场、SFMOMA、芳草地花园、海特-阿什伯里路口、多洛雷斯公园、天涯海角、海洋海滩、动物园非洲草原、墨菲风车、海滩小屋），还多做了三个 P3 的（金门公园野牛围场、蓝鹭湖中国亭、吉里大道的圣母大教堂）。
2. 每个地点都有：按真实坡度铺的广场和小路、长椅路灯树、能走的范围和到达点、地图旗杆、照片机位；三角形都在预算内（最多 1.9k / 2.5k），市中心的三个按"瘦身"预算做（联合广场 0.6k）。
3. 测试 8 项、全套 opus-bay 测试全部通过；每个地点都在预览页面里截图看过（`docs/opus-bay/qa/w4/L/`）。
4. 还没接进游戏（等第三波验收），接线步骤写在下面。圣依纳爵堂、加州科学院、中国亭、圣母大教堂的 AI 模型 V 组已经做好，接线时换上（圣母大教堂的模型比它的地块宽，请 V 组按地块重新缩放）。
5. 发现一个老问题：城市把蓝鹭湖中间的草莓山岛画成了水（岛上的小路浮在湖面上），需要做城市数据的组修。

Progress (2026-09-27): W4-L1, W4-L2 and W4-L3 done (P1 and P2 except the Botanical Garden gate), W4-L5 started (3 of
the P3 list), W4-L7 walk data for every site, W4-L8 `sites-qa.mjs` and the preview page, W4-L10 tests and this report.
W4-L4 prepared (the AI slots name lane V's models, both ways checked, and the pavilion is built to lane V's bounds); waiting for the
integration phase: registration, draped ground in the renderer, lod rings, the AI swaps through the SoloView gate.

### What was built (files, API)

| file | what | API |
|---|---|---|
| `src/opus-bay/world/sf/landmarks/siteKit.ts` | the wave-4 site record (`W4Site` = `SfLandmark & SiteHooks & { base: number; ground?: SiteGroundPoly[]; w4: W4SiteMeta }`), the baked terrain lookup, draped ground helpers (fill / strip / rect / clip / crosswalk with per-vertex `ys` and the `lift` used), street furniture (bench, lamp, bollard, bin, planter, hedge, fence, flagpole, trees, palm, conifer), crane parts (mast, jib, swing), hoarding, `hipRoof` (a true hip roof over w × d), `plazaOf`, `polyArea`, `along` | `siteGround(id, fallback)` → `{ base, grid, at(x, z) }`; `gfill`, `gstrip`, `grect`, `clipRect`, `crosswalk`, `GC`, `PAT`, `FC`, `LIFT`, `LIFT_STRIPE`, the helpers above |
| `src/opus-bay/world/sf/landmarks/siteTerrain.ts` | generated: per site `base` (world y: the lowest walked city ground inside the exclusion) and the local ground heights on its grid (2 u; 1 u at Dolores Park and Lands End) | `SITE_TERRAIN[id]` |
| `src/opus-bay/world/sf/landmarks/w4sites.ts` | the ordered list (plan §2.3 build order), lookups, the flag tops of every site, existing landmark and T1 hero (plan §4.2), per-site lod ring and budget accessors | `W4_SITES`, `W4_SITE_IDS`, `w4Site(id)`, `w4SiteOf(id or attraction or place id)`, `flagHeight(skyline)`, `LANDMARK_FLAGS`, `HERO_FLAGS`, `siteFlagTop(ref)`, `siteLod0R(l)`, `siteBudget(l)` |
| 24 site modules in `src/opus-bay/world/sf/landmarks/` (below) | one declarative record each: `build(b, lod)`, exclusion, walk blockers and decks, draped ground, lights, plazas, animate part where it moves, `w4` metadata (placeId, attractions, lod ring, budget, arrival, photo pose, flag, height policy, OSM ids, terrain box, AI slot, notes) | `stonestown`, `sfState`, `ucsfParnassus`, `usfLoneMountain`, `stIgnatius`, `ccsfOcean`, `ccsfDrpac`, `ucsfMissionBay`, `calAcademy`, `musicConcourse`, `japaneseTeaGarden`, `unionSquare`, `sfmoma`, `yerbaBuenaGardens`, `haightAshbury`, `doloresPark`, `landsEnd`, `oceanBeach`, `sfZoo`, `murphyWindmill`, `beachChalet`, `bisonPaddock`, `blueHeronLake`, `gearyWest` |
| `tests/opus-bay-sf-sites-w4.test.ts` | 8 tests on the modules directly (see Evidence) | — |
| `scripts/opus-sf/sites-survey.mts` | authoring survey: the published city around a point (roads by class and name, buildings with OSM ids and heights, areas, props, walk nodes, places, ground contours, existing exclusions, and a wave-4 site's own model, exclusion, blockers, ground, arrival, flag) as PNG + JSON | `--site <id>` or `--x --z [--r --px --name]` |
| `scripts/opus-sf/sites-terrain.mts` | bakes `siteTerrain.ts` from the published chunks (walked ground, pooled max over the cell) | `--site <id>` (one) or all |
| `scripts/opus-sf/sites-qa.mjs` | QA through the dev server: ring samples, street and high views, renderer.info, the city's per-group breakdown, the site's own lod-0 state and on-screen share, JPEGs | `--sites a,b --views ring,street,high --preview 1 [--time --mobile --ring]` |
| `scripts/opus-sf/sites-preview.html`, `sites-preview.tsx` | dev-only page: `/opus-bay` with the not-yet-registered sites appended to the registry (drawn, excluded, colliding like registered landmarks; draped ground through a mount) | `/scripts/opus-sf/sites-preview.html?world=city[&sites=a,b]` |

The sites (T = map tier; lod-0 triangles / cap from the test; ring = the walk-around ring's open share):

| # | site id | what the toy shows | T | lod0 / cap | lod2 | ground tris | lod0R | ring |
|---|---|---|---|---|---|---|---|---|
| 1 | `stonestown` | the mall concourse under its glass skylight, north wings, the glass east atrium and canopy, the 20th Ave forecourt, crosswalk to the M stop (no store names) | 1 | 1272 / 6000 | 60 | 46 | 340 | 88 % |
| 2 | `sfsu` | the Quad lawn and walks, Malcolm X Plaza, the Cesar Chavez Student Center "iceberg", the library block, a plain purple-and-gold gateway (no marks) | 1 | 1858 / 6000 | 44 | 123 | 340 | 83 % |
| 3 | `ucsf-parnassus` | the new-hospital lot: steel frame, hoarding, a turning tower crane (animate) | 2 | 848 / 2500 | 36 | 14 | 190 | 72 % |
| 4 | `usf-lone-mountain` | the 1932 Main Building with its tower and cross, the garden stairway from Turk Blvd | 2 | 1563 / 2500 | 74 | 92 | — | 76 % |
| 5 | `st-ignatius-church` | twin towers, columned front, the dome; AI slot `w4-st-ignatius` | 2 | 1336 / 2500 | 96 | 44 | — | 75 % |
| 6 | `ccsf-ocean` | Science Hall on the hill, plain colour panels for the Volz mosaics | 2 | 1364 / 2500 | 72 | 102 | — | 100 % |
| 7 | `ccsf-drpac` | the Diego Rivera arts-center construction lot with a crane (no mural until it opens, ~2028) | 3 | 452 / 800 | 36 | 32 | 260 | 95 % |
| 8 | `ucsf-mission-bay` | Koret Quad: oval and west lawns, cross walk, trees, benches, lamps | 3 | 664 / 800 | 24 | 192 | 220 | 72 % |
| 9 | `cal-academy` | the living roof over the two domes, skylights, the thin glass canopy; AI slot `w4-cal-academy` | 2 | 1904 / 2500 | 136 | 24 | — | 100 % |
| 10 | `music-concourse` | the bowl: lawn squares, gravel walks, pollarded planes, fountain, benches, the bandshell (shared setting, no attraction of its own) | 2 | 1635 / 2500 | 42 | 487 | — | 100 % |
| 11 | `japanese-tea-garden` | gate, drum bridge over the pond, five-tier pagoda, tea house, lanterns, bamboo fence | 2 | 1832 / 2500 | 124 | 227 | — | 96 % |
| 12 | `union-square` | granite plaza, the Dewey Monument column, palms (downtown diet ≤ 0.6k) | 1 | 588 / 600 | 44 | 58 | 200 | 91 % |
| 13 | `sfmoma` | Botta's stepped block with the striped oculus, the white rippled expansion (diet ≤ 1.2k) | 2 | 724 / 1200 | 34 | 0 | 200 | 71 % |
| 14 | `yerba-buena-gardens` | the Esplanade, main-stage canopy, the MLK Memorial wall and water (no quotations; diet ≤ 0.4k) | 2 | 252 / 400 | 24 | 105 | 200 | 82 % |
| 15 | `haight-ashbury` | the painted Victorian corner with its turret, the row along Ashbury, blank green street-sign blades, a clock stuck at 4:20 | 2 | 496 / 2500 | 44 | 0 | 260 | 77 % |
| 16 | `dolores-park` | walks on the real slope, playground, tennis courts, the Hidalgo monument, palms along Dolores | 2 | 1880 / 2500 | 24 | 282 | — | 69 % |
| 17 | `lands-end` | the Lookout visitor center and forecourt, the trail to a railed overlook deck with a telescope | 2 | 530 / 2500 | 24 | 50 | — | 85 % |
| 18 | `ocean-beach` | at Lawton St below Sunset Dunes: plank path over the dunes, fire rings (warm glow at night), driftwood, dune grass, a blank surf-warning post | 2 | 824 / 2500 | 24 | 12 | 260 | 97 % |
| 19 | `sf-zoo` | the African Savanna: toy giraffes (necks animate), zebras, an ostrich, rails, shade trees, the viewpoint deck (never pandas) | 2 | 1068 / 2500 | 24 | 91 | 220 | 86 % |
| 20 | `murphy-windmill` | the Dutch recipe in its own colours, turning sails (animate) | 3 | 456 / 800 | 24 | 0 | — | 96 % |
| 21 | `beach-chalet` | the white Spanish Revival block, red hip roof, arched windows, door canopy (no murals, no names) | 3 | 426 / 800 | 18 | 0 | 220 | 100 % |
| 22 | `bison-paddock` | P3: post-and-rail fence on the viewing sides, 8 toy bison (heads animate), a hay feeder | 3 | 742 / 800 | 24 | 0 | — | 98 % |
| 23 | `blue-heron-lake` | P3: the Chinese Pavilion (8 red columns, grey-green upswept roof, built to lane V's model bounds) on a stone base with two causeways; AI slot `w4-chinese-pavilion` | 2 | 428 / 2500 | 24 | 0 | — | 77 % |
| 24 | `geary-west` | P3: Holy Virgin Cathedral on its OSM lot — white body with red trim, a rounded front gable, five gold onion domes with crosses (9.1 u); AI slot `w4-holy-virgin` | 3 | 726 / 800 | 36 | 0 | — | 84 % |

Every module's header comment carries its facts and sources and its local frame (origin, yaw, what lies where).

### Evidence

- **Checks** on the pushed tree: `npx tsc -p tsconfig.app.json --noEmit` 0; `npx eslint src/opus-bay tests/opus-bay-*
  scripts/opus-sf/sites-*` 0 errors; whole-repo `npx eslint . --ignore-pattern .vite-opus` 0 errors (the Vite dep
  cache is not source); the full opus-bay suite green on the pushed tree (660 / 660).
- **tests/opus-bay-sf-sites-w4.test.ts** (8 tests, all green): registry (unique ids, tiers, numeric bases equal to the
  baked terrain, attractions in `sf-w4-attractions.json` within 70 u, place rows — places.json with lane P's
  re-anchors or lane P's extra rows — within 45 u); budgets (lod 0 ≤ tier cap or the site's diet cap, lod 2 ≤ 10 % of
  lod 0, ground ≤ 900 triangles, ≤ 3 parts, finite positions); exclusions (contain the origin — the Haight corner says
  why not —, never overlap another landmark, another site or the hero slab, every toy vertex within 0.8 u); draped
  ground (every vertex `lift` over the live walked raster, walls exempt, piece centres never sink); walk data (valid
  blockers, arrivals clear, standable on the live city terrain with every landmark's walk input, reachable by
  `findPath` from the main walking graph within 40 u; walk-around ring ≥ 75 % or a stated reason ≥ 60 %); streets
  (every street the exclusion cuts is continued by site ground, the ones it passes keep their width); flags (28–70 u,
  foot inside the site, ≥ skyline + 8 or the 30 u pole; the existing landmark table matches the models); settings
  (plazas ≥ 30 u², valid lights, no text / logo / label parts; every AI slot names one of lane V's `W4_MODELS` files and
  that model's `landmarkId` is the site, as D2's swaps require — lane V's `opus-bay-w4-assets` test checks the same
  pairing from its side).
- **Preview QA** (`sites-qa.mjs --preview 1 --views street,high --time golden`, all 21 P1/P2 sites; table copied to
  `docs/opus-bay/qa/w4/L/sites-golden.md`): every site drawn at lod 0 in both views; programs 38–39 in every view (no
  new shader programs); the site's own triangles on screen 252–2,162 (ground and animate parts included); the worst
  frame totals are the downtown street views (UCSF Mission Bay 434k, Union Square 423k — both the city around them;
  the sites add 856 and 646).
- **Shots** (read before describing), in `docs/opus-bay/qa/w4/L/`: Stonestown and SF State from above (the forecourt
  with its trees, benches and lamps; the Quad walks and the gateway), St Ignatius' columned front between the towers,
  Dolores Park from above (walks, playground, courts, palms), the savanna with giraffes and zebras over the rail, the
  Lands End Lookout and forecourt, Ocean Beach's fire rings, logs and the blank warning board, the Beach Chalet front
  with the Dutch Windmill behind, the Murphy Windmill's stage and sails, the Tea Garden from above (hip-roofed tea
  house, pagoda, bridge), the bison behind the fence, the Holy Virgin domes over the Outer Richmond roofs, and the
  Chinese Pavilion on its stone base in the lake with the
  island paths floating around it (the Strawberry Hill problem below).
- **Facts**: each site's header names its sources (sfsu.edu, ucsf.edu / UCSF Real Estate, USF, CCSF news and The
  Guardsman, calacademy.org, gggp.org, sfmoma.org, yerbabuenagardens.org, nps.gov, sfzoo.org, sfrecpark.org, the
  Richmond Review, Wikipedia, OSM ids). Checked this session: Murphy Windmill completed 1908, reopened 2012, 114 ft
  sails (Wikipedia); the Chinese Pavilion is Taipei's 1981 gift with red columns and a grey-green tiled roof
  (sfrecpark.org; Richmond Review 2021); Holy Virgin Cathedral's five gold-leaf onion domes (Wikipedia), 125 ft (SFGate)
  and its 2015–16 red-and-white scheme (Orthodox Arts Journal), as lane V's review re-checked them.

### Decisions

- **Numeric bases, baked terrain, draped ground.** Every new site stands on a numeric base baked offline (the lowest
  walked city ground inside its exclusion) and its ground polygons carry per-vertex heights (`ys`) from a baked grid
  (max-pooled, so pieces never sink), with the lift recorded; the test re-checks them against the live rasters. The
  renderer draws `ys` only after the integration change below (until then the preview page drapes them).
- **Exclusions stay tight** around what each toy replaces or dresses; streets are cut only where the site continues
  them with its own strips. The origin is always inside the exclusion except the Haight corner, whose origin is the
  crossing (its record says so).
- **Walk-around ring below 75 %** only where a building or the shore closes a side, each with its reason in `notes`:
  UCSF Parnassus 70 %, UCSF Mission Bay 70 %, SFMOMA 60 %, Haight 60 %, Dolores Park 65 %.
- **Downtown diet** (plan §2.2): Union Square ≤ 0.6k, SFMOMA ≤ 1.2k, Yerba Buena ≤ 0.4k, lod-0 ring 200 u.
- **Shared settings.** The Music Concourse bowl models no attraction (the de Young, Cal Academy and Tea Garden records
  carry them); the CCSF site is two records (Science Hall, the arts-center lot); USF is two (Lone Mountain, St Ignatius).
- **What never appears**: store names, logos, sign text, murals or artwork copies (the Rivera mural, the Volz mosaics,
  the Beach Chalet frescoes, the MLK Memorial quotations, the pavilion's carvings); pandas; swimming prompts at Ocean
  Beach; the Lands End labyrinth (it comes and goes).
- **The zoo site is the African Savanna** (the path along it and its viewpoint), not the entry plaza: the zoo's houses
  and paths are already city data, and the savanna is what reads as "the zoo" from above.
- **Ocean Beach** sits at Lawton St (the attraction's point, 66 u from the N terminus); Beach Chalet and Murphy
  Windmill are their own T3 records (plan's `ocean-beach-west` group).
- **Murphy Windmill height**: the OSM tag (10 m) would give 4.75 u; the plan asks for the Dutch recipe, so it is drawn
  at that size (6.3 u to the cap top), and `notes` says so.
- **`hipRoof`**: kit.pyramid scales before its 45° turn, so any `w ≠ d` cap comes out as a skewed rhombus; the new
  sites use `siteKit.hipRoof` (the Tea Garden's tea house and the Beach Chalet). The existing landmarks that call
  `pyramid` with `w ≠ d` (City Hall 3.8 × 1.2, Conservatory of Flowers 1.9 × 3.2 and 1.35 × 0.7, Dragon Gate, Grace
  Cathedral 1.4 × 0.4, Legion of Honor 3.9 × 1.0) are left alone (not lane L's files in the early phase; see Requests).
- **The Chinese Pavilion** is built to lane V's AI model (origin (−251.5, 1017.0), floor r 2.4 at +0.3, columns r 0.25
  on a ring r 2.15 = the walk blockers, eaves r 2.8, 4.5 u) so the swap keeps footprint and walk data. It stands on a
  stone base at local y 0.45 with numeric decks (floor 0.75, causeways 0.65, the island path 0.49–0.62 at their ends),
  because the city's walk raster reports lake water under it (surface 0); the decks stay right once the island is fixed.
- **AI slots** keep lane V's GLB stems (`w4-cal-academy`, `w4-st-ignatius`, `w4-chinese-pavilion`) as lane V's test
  asks until the integration, with the registry id (`sf-*`) in the note; lane V's models name these sites as their
  `landmarkId`.

### Integration plan (after "wave 3 verified"; the files lane L owns then)

> **Corrected by the early review** (see "## Early review" → "Integration changes" at the end): step 1 imports
> `./w4list`, never `./w4sites` (a load-time cycle); step 2's draped ground and the sink are already done (D2-09 +
> `sink: 0` on every record); tops.ts must be regenerated; the height rule `'ground'` and the shared CCSF place row
> need a decision in step 4.

1. `src/opus-bay/world/sf/landmarks/index.ts` — `import { W4_SITES } from './w4sites';` and append the records to the
   registry: `export const SF_LANDMARKS: SfLandmark[] = [ …existing…, ...W4_SITES ];` (w4sites calls into index.ts
   only inside functions, so the import cycle is safe: W4_SITES is fully evaluated before the literal).
2. `src/opus-bay/world/sf/sites.ts`
   - `buildGroundMesh(l)`: draw per-vertex heights when a polygon has them — `const ys = (g as SiteGroundPoly).ys;
     b.polygon(g.poly, ys ? (x, z) => ys[g.poly.findIndex(p => p.x === x && p.z === z)] ?? g.y : g.y, …)` (as
     `scripts/opus-sf/sites-preview.tsx` `drapedGround` does); then delete the preview's mount.
   - `update()`: per-site lod ring — `r = radius[tier] * (siteLod0R(s.l) ?? LOD0[tier]) / LOD0[tier]` (`siteLod0R` from
     `./landmarks/w4sites`).
   - nothing else: exclusions, SINK, lights, plazas, mount and animate already work for the records (the preview runs
     them through the unchanged code).
3. `src/opus-bay/world/sf/landmarks/context.ts` — re-export `siteFlagTop`, `flagHeight`, `LANDMARK_FLAGS`, `HERO_FLAGS`
   from `./w4sites` (lane P's `withSiteFlags` already takes lane L's poles).
4. `src/opus-bay/data/sf/landmarks.ts` — `sfLandmarkInfo(id)` falls back to the record's `w4` block (arrival, photo,
   height, placeId) with lane C's card names, so photo mode, arrival reveals and the tall-part rule see the new sites.
5. `src/opus-bay/core/sfTerrain.ts` — nothing: numeric-base records with numeric decks are not deferred; check the
   first `landmarkWalkInputs(SF_LANDMARKS)` run after step 1 (the test already feeds the same inputs).
6. Tests that change on purpose:
   - `tests/opus-bay-sf-sites-w4.test.ts`: exclusions test compares against `SF_LANDMARKS.filter(l => !w4Site(l.id))`
     (after step 1 a site would meet itself); the walk test's `lms` becomes `landmarkWalkInputs(SF_LANDMARKS)` alone.
   - suites that enumerate `SF_LANDMARKS` (`opus-bay-sf-landmarks`, `-models`, `-landmark-context`, `-nav`,
     `-places`, `-terrain`, `-cards`, `-content`, `-attractions`, `sf-world`, `sf-place-arrival` …): expect +24
     records; any rule written for `base: 'terrain'` records must accept numeric bases; per-tier budgets must read
     `siteBudget(l)` first (the diet caps).
7. AI swaps (W4-L4), after lane V spreads `W4_MODELS` into `SF_MODELS`: a `swap` on each record — `cal-academy` part
   `sf-cal-academy` at the origin (y = the block's ground), `st-ignatius-church` part `sf-st-ignatius` at (0.35, ground,
   −0.18), `blue-heron-lake` part `sf-chinese-pavilion` at (0, 0.45, 0), `geary-west` part `sf-holy-virgin` at the origin
   (y = ground, after lane V's re-fit), all yaw 0, scale 1 (lane V's report §3) —
   with `build` reduced to the setting, decided per site in SoloView (`?solo=<id>&ai=0|1`); walk data already matches.

### Not done (early phase)

- **Botanical Garden gate** (T3 plaza, plan: MLK Dr & 9th Ave): the place row `osm-w120480164` is the garden's centre
  (−223.4, 1010.3), 58 u from the main gate (−178.3, 970.9; OSM node 7838369891, `entrance=main`), so the site test's
  "place near the site" fails; waiting for lane P's re-anchor (Requests).
- **P3 sites** after the first three: `park-east` (Kezar, Koret carousel, Hippie Hill), `clement` / `irving` strips, `golden-gate-heights`, `mount-davidson`, `stern-grove`, `lake-merced`, `fort-funston`,
  `castro`, `presidio`, `fort-mason`, `baker-beach`, `corona-heights`, `bernal`, `cathedral-hill`, the `civic-center`
  and `japantown` extensions, `cable-car-museum`, `wharf-west`, `chinatown-pagodas` (gated, W4-L6); P4 (W4-L9).
- **The Blue Heron bridges'** walk strips (W4-L7): they wait for the island fix below (today the whole island is water
  in the walk raster, so a bridge strip would lead onto water).
- **W4-L4 AI swaps**: lane V's four meshes are published but not in `SF_MODELS` yet, so the swaps and the SoloView
  verdicts wait for the integration.
- Integration items above (existing files).

### Requests

- **City data (lead / the lane that owns the chunk build):** Strawberry Hill is drawn and walked as lake water. The
  published chunks carry the island as `hole` rings of the Blue Heron Lake water areas (visible in
  `sites-survey --x -262 --z 1030`), but the render shows the island's paths floating on water and the walk raster
  answers surface 0 at the Chinese Pavilion (OSM way 120479810) and on the island paths next to it. Shot:
  `docs/opus-bay/qa/w4/L/blue-heron-lake-ring1-golden.jpg`.
- **Lane P:** re-anchor `osm-w120480164` (San Francisco Botanical Garden) to its main gate (−178.3, 970.9) — the card
  and the arrival belong at the gate on MLK Dr — then lane L builds the gate plaza.
- **Lane V:** please re-fit `w4-holy-virgin` to its lot: the OSM footprint (way 286435447) is 2.6 × 3.0 u between
  neighbours 0.1–0.2 u away on three sides, but the published mesh is 6.1 × 6.7 u; the procedural `geary-west` keeps
  9.1 u to the cross, front +Z on Geary Blvd (origin (−493.07, 1000.05), yaw 45°).
- **Lane V:** the slots keep your GLB stems (your test's rule; your report asks for the registry ids — at the integration
  the swap parts use `sf-*` and the slot strings can follow); the pavilion follows your measured bounds (please keep
  them if you re-export). The Tea Garden pagoda stays procedural (no AI pagoda needed from lane L's side).
- **Lane C:** cards for `murphy-windmill`, `beach-chalet`, `bison-paddock`, `blue-heron-lake` can quote the facts in
  the module headers; Ocean Beach's card keeps "no swimming"; Lands End never promises the labyrinth.
- **Lane D2 / the kit owner at integration:** `kit.pyramid` should apply its 45° turn before the scale (or call
  `siteKit.hipRoof`); the six existing `w ≠ d` calls listed under Decisions change shape when it is fixed.

## Early review

Written 2026-09-27 by the lane-L adversarial reviewer (worktree `C:/Users/willy/wt/w4-l`), on the lane's 13 commits
`2c34d91` … `208969c` plus D2-09 (`9a60ebd`, landed during the review). Commits: `W4-L-review:` (4 code commits and
this report). Higgsfield: 0 credits.

### 给主人的摘要

1. 复查了 L 线做的 24 个新地点，在网上核对了 23 条事实：4 条不对，都改好了（海洋海滩的篝火圈其实只在北段、林肯路以北，
   这里不该有；野牛 1891 年就来了；圣依纳爵堂的塔高 210 英尺；马丁·路德·金纪念瀑布高 20 英尺）。
2. 修好两个"接线那天才会爆"的问题：按原来的接线步骤，有的测试一加载就崩（模块互相引用）；新地点接进去后，人会陷进广场地面约
   0.3（小人的六分之一）。现在每个地点自带"地面不下沉"，都有测试盯着。
3. 另外 4 个地点把地面和会动的部分算进去后超了三角形预算，已瘦身到预算内；日本茶园里人脚陷进草地和石子路的问题也修了。

### What I checked

- **Every file the lane created** (24 site modules, `siteKit.ts`, `siteTerrain.ts`, `w4sites.ts`, the test, the four
  scripts, this report, the QA table) and the files its integration plan names (`landmarks/index.ts`, `world/sf/sites.ts`,
  `landmarks/context.ts`, `data/sf/landmarks.ts`, `core/sfTerrain.ts`, `landmarks/tops.ts` +
  `scripts/opus-sf/assets/topsMeasure.ts`, `world/sf/build.ts` for the exclusion sink).
- **Early-phase rule:** `git show --stat` over the 13 `W4-L*` commits lists only files lane L created (plus its report
  and QA folder). No existing tracked file was edited. Held.
- **Per-frame allocations:** the five `animate.update` functions (UCSF crane, CCSF crane, zoo necks, Murphy sails, bison
  heads) only call `position.set` / `rotation.set`; the `new THREE.*` calls are all in build paths. None.
- **Budgets** measured as the frame draws them (model + draped ground + animate part; the lane's own `sites-qa` reports
  it that way): four sites were over (below).
- **Walk height vs drawn ground** with the node terrain provider (`probe-sink.mts`, `probe-feet.mts` in
  `C:/Users/willy/opus-qa/w4/w4-l/`): with sites.ts's default 0.2 u sink, the draped ground pieces stood 0.25–0.46 u
  (mean per site) over the walk height; with sink 0, 0.08–0.25 (the Tea Garden 0.26, now 0.12).
- **The integration step 1 as written**, applied to a scratch edit of `landmarks/index.ts` (reverted at once, never
  committed): lane V's `opus-bay-w4-assets` test died at load with `ReferenceError: Cannot access 'W4_SITES' before
  initialization`.
- **zh text:** lane L's modules carry no player-facing text (cards are lane C's); the report's summary used 林角 and
  吉瑞大道 where the game's glossary (lane C's cards) says 天涯海角 and 吉里大道: fixed.
- **Preview shots** after the fixes (dev server 5303, `sites-qa.mjs --preview 1`, each read before describing): Ocean
  Beach street (driftwood logs, the blank warning board, the plank path, no rings; replaces
  `qa/w4/L/ocean-beach-street-golden.jpg`), Union Square street (column, palms without kerb boxes, 598 triangles on
  screen), Bison Paddock street (the herd without horn bars, posts 6.5 u apart, 790 on screen), Japanese Tea Garden high
  and street (lawn, pond and gravel on the new lifts, no z-fighting). Scratch: `C:/Users/willy/opus-qa/w4/w4-l/{qa,review}/`.

**Facts re-checked on the web (2026-09-27)** — ✓ right, ✗ fixed:

| # | fact (module) | source | |
|---|---|---|---|
| 1 | Stonestown opened 16 July 1952 (stonestown) | Wikipedia "Stonestown Galleria" | ✓ |
| 2 | enclosed / reopened as the Galleria in 1987 (stonestown) | Wikipedia; outsidelands.org | ✓ |
| 3 | SF State founded 1899, on the Lake Merced campus from 1953 (sf-state) | Wikipedia; outsidelands.org | ✓ |
| 4 | Helen Diller Hospital: 15 storeys, work through 2029, opening 2030 (ucsf-parnassus) | realestate.ucsf.edu | ✓ |
| 5 | its main steel erection under way in 2026 (ucsf-parnassus) | UCSF monthly updates (Apr–May 2026) | ✓ |
| 6 | Science Hall: 1940, 489 ft long, 90 ft high, 89 ft longer than City Hall (ccsf-ocean) | The Guardsman | ✓ |
| 7 | Diego Rivera PAC ground broken 22 Jan 2026, Pan American Unity in its lobby (ccsf-drpac) | ccsf.edu; LMN | ✓ |
| 8 | Lone Mountain Main Building 1932, Henry A. Minton, Spanish Gothic, "Spanish Steps" from Turk, USF's from 1978 (usf-lone-mountain) | usfca.edu; Wikipedia | ✓ |
| 9 | St Ignatius dedicated 1914, Charles Devlin, Fulton St & Parker Ave (st-ignatius) | Wikipedia | ✓ |
| 10 | St Ignatius towers "200 ft" → **210 ft** (st-ignatius; realM 61 → 64) | usfca.edu "9 facts" | ✗ |
| 11 | Dewey Monument 1903, 97 ft, Victory with trident and wreath (union-square) | Wikipedia "Dewey Monument" | ✓ |
| 12 | MLK Memorial restored in 2026 (yerba-buena-gardens) | yerbabuena.org | ✓ |
| 13 | its waterfall "≈ 22 ft" → **20 ft high, 50 ft wide** (yerba-buena-gardens; realM 7 → 6.1) | yerbabuena.org | ✗ |
| 14 | Lands End Lookout at 680 Point Lobos Ave (lands-end) | NPS; Parks Conservancy | ✓ |
| 15 | Ocean Beach **fire rings at Lawton St** → the 16 rings are only between Stairwells 15 and 20 (Stairwell 15 at JFK Dr, north of Lincoln Way) (ocean-beach) | nps.gov "Ocean Beach Fire Program"; Parks Conservancy | ✗ |
| 16 | the N Judah terminus "two blocks south" → **north** of Lawton St (Lincoln, Irving, Judah, Kirkham, Lawton) (ocean-beach) | the street order; the lane's own 66 u | ✗ |
| 17 | Sunset Dunes car-free since 12 April 2025; Prop G on 3 Nov 2026 (ocean-beach notes) | Wikipedia; KQED; CBS | ✓ |
| 18 | Murphy Windmill completed 1908, reopened 2012, 114 ft sails (murphy-windmill) | outsidelands.org; Wikipedia | ✓ |
| 19 | Beach Chalet: Willis Polk, 1925, Spanish Revival, the park visitor center downstairs, WPA frescoes (beach-chalet) | Wikipedia; SF Heritage | ✓ |
| 20 | bison in the park "since 1892" → **since 1891**; in this meadow since 1899 (bison-paddock) | sfzoo.org timeline; Local News Matters | ✗ |
| 21 | Stow Lake renamed Blue Heron Lake on 18 Jan 2024 (blue-heron-lake) | sfrecpark.org; SFist | ✓ |
| 22 | Chinese Pavilion: Taipei's gift, dedicated 1981, red pillars, green tiled roof, 28 ft (blue-heron-lake) | sfrecpark.org; noehill.com | ✓ |
| 23 | Holy Virgin Cathedral, 6210 Geary Blvd at 26th Ave, five gold-leaf onion domes (geary-west) | Wikipedia; Richmond Review | ✓ |
| — | UCSF Mission Bay "57.9 acres": ucsf.edu's page gives no acreage, UC's 2015 news says 60.2; the 1999 start and the 1 Feb 2015 hospitals ✓ | universityofcalifornia.edu | open (lane C's card) |

### Defects found (16): fixed 13, open 3

| # | defect | fix / state |
|---|---|---|
| 1 | Integration step 1 (`index.ts` imports `W4_SITES` from `w4sites.ts`, which imports `index.ts`) throws at load wherever `w4sites.ts` is the first to load (lane V's test; reproduced) | **fixed** `4ac8f4c`: `w4list.ts` holds the list and imports only the site modules; `w4sites.ts` re-exports it; the test walks `w4list`'s import graph (no runtime import of `./index`, `./w4sites`, `./context`, `../sites`) |
| 2 | Registered as planned, every site's exclusion sank the city ground 0.2 u (sites.ts) under ground draped on the unsunk ground: walkers ≈ 0.3 u under every plaza; the test hid it with a hand-made `sink: 0` | **fixed** `4ac8f4c` + `2ff3daf`: every record has `sink: 0` (D2-09's `SfLandmark.sink`, required by `W4Site`); the test uses sites.ts `landmarkSink` and checks the walk height under every standable ground piece (mean over the lift ≤ 0.15, worst ≤ 0.5; fails at every site with 0.2) |
| 3 | Budgets counted the model only; with ground and animate parts Union Square 646 / 600 (diet), UCSF Mission Bay 856 / 800, Murphy Windmill 804 / 800, Bison Paddock 934 / 800 | **fixed** `4ac8f4c`: 598, 712, 788, 790 (palm kerbs as ground squares and 4-sided trunks; one-blob row trees; an 8-sided cap; no horn bars, posts 6.5 u apart); the test counts all three parts |
| 4 | Ocean Beach fire rings (and their night glow) at Lawton St, where there are none | **fixed** `63b8407`: eight driftwood logs (walk blockers) and more dune grass; the rings belong on the Stairwell 15–20 stretch (defect 16) |
| 5 | Ocean Beach header: N Judah terminus "two blocks south" | **fixed** `63b8407`: north |
| 6 | Bison header "since 1892" (lane C quotes the headers) | **fixed** `4ac8f4c`: 1891 |
| 7 | St Ignatius "200-ft towers", realM 61 | **fixed** `63b8407`: 210 ft, realM 64 |
| 8 | MLK waterfall "≈ 22 ft", realM 7 | **fixed** `63b8407`: 20 ft × 50 ft, realM 6.1 |
| 9 | Japanese Tea Garden lawn / pond / gravel lifted 0.18 / 0.23 / 0.25 u: walkers 0.2–0.3 u under the lawn and gravel (drawn − walk mean 0.257, max 0.646 u) | **fixed** `4e655a2`: 1 u bake (`terrainStep 1`), one 1.5 u lattice, lifts 0.08 / 0.13 (mean 0.119, max 0.330); ground 369, site 2201 / 2500 |
| 10 | The integration plan never regenerates `tops.ts`: the landmark-context test fails on the first registered site, blockers have no tops (the glide treats them as walls) and Murphy's sails `tall` part is dropped | **fixed** (plan below) + test: `topsMeasure` measures every blocker and tall part of all 24 sites (finite, 0–30 u) |
| 11 | Integration step 2's draped-ground change to `buildGroundMesh` and the preview's mount | **done by D2-09** (`ys` drawn natively); the preview now appends the records as they are (`2ff3daf`) |
| 12 | `sites-terrain.mts` header said a 3 u grid (it is 2 u) | **fixed** `63b8407` |
| 13 | Report summary names 林角 / 吉瑞大道 vs the game's 天涯海角 / 吉里大道; the Ocean Beach QA shot showed the removed rings | **fixed** (this report commit) |
| 14 | `W4SiteMeta.height.rule` has `'ground'` (8 sites), which `SfLandmarkInfo.height.rule` does not accept; cityViews / cityLive read `height.u` over the base, but `u` is the height over the model's own ground (USF 12.8 vs 16.0 drawn over the base, Dolores Park 5.6 vs 9.5, Lands End 3.5 vs 7.4) | **open** (integration step 4, below) |
| 15 | `ccsf-ocean` and `ccsf-drpac` share `placeId` `ccsf-ocean-campus`: a `sfLandmarkInfoByPlace` fallback would keep whichever comes last (the construction lot) | **open** (integration step 4, below) |
| 16 | The fire rings have no record now (plan's Ocean Beach west group) | **open**: a small T3 record on the sand between Stairwell 15 (JFK Dr, the Beach Chalet) and Lincoln Way with a March–October glow; lane C's Ocean Beach card may mention them "at the north end" |

Not defects, noted: `siteKit.ts` is now imported by ten D2-09 landmark modules, so its baked `siteTerrain.ts` (29 KB,
9 KB gzip) loads with the registry; keep `siteKit`'s exported helpers stable (D2's settings use `gfill`, `lamp`,
`bench`, `planter`, `flagpole`, `hedge`, `palm`, `tree`, `conifer`, `bollard`, `GC`, `PAT`, `FC`).

### Integration changes (replace the plan's steps where they differ)

1. `landmarks/index.ts`: `import { W4_SITES } from './w4list';` and `SF_LANDMARKS = [ …existing…, ...W4_SITES ]`.
   **Never import `./w4sites` or `./context` from index.ts** (the opus-bay-sf-sites-w4 "integration safety" test keeps
   `w4list`'s side clean).
2. `world/sf/sites.ts`: only the per-site lod ring (`siteLod0R`, as planned). The draped ground is drawn already
   (D2-09 `buildGroundMesh`), and the sink needs no change: `landmarkSink(l)` reads each record's `sink: 0`.
3. `landmarks/context.ts`: re-export `siteFlagTop`, `flagHeight`, `LANDMARK_FLAGS`, `HERO_FLAGS` from `./w4sites` (as
   planned; context.ts → w4sites → index is not a cycle once index imports w4list).
4. `data/sf/landmarks.ts` fallback: map the rule `'ground'` onto `'overlook'` (no building to frame in cityViews) or widen
   the union; give the fallback `height.u` = the measured top over the base (tops.ts max) where cityViews / cityLive
   read it; key `sfLandmarkInfoByPlace` by the primary record only (`w4SiteOf(placeId)`, i.e. `ccsf-ocean`, not
   `ccsf-drpac`); lat / lng / zone / bark / realInfo from lane C's cards.
5. **Re-run `npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/assets/landmark-tops.ts`** in the registration
   commit: tops.ts gains the 24 rows the landmark-context test requires (blocker tops for the glide, Murphy's sails).
6. Tests that change on purpose: as the plan's step 6, plus `opus-bay-sf-landmark-context` (tops.ts rows).

### Checks

- On the pushed tree (`d6ce5c3`; the run was on the same code before a docs-only rebase over `86bf90e`): `npx tsc -p tsconfig.app.json --noEmit` 0 errors; `npx eslint src/opus-bay
  tests/opus-bay-*` 0 problems; whole-repo `npx eslint . --ignore-pattern .vite-opus` 0 errors (42 old warnings); the full
  opus-bay suite **674 / 674** (`opus-bay-sf-sites-w4` now 10 tests: + integration safety, + the re-checked facts;
  budgets count ground and animate parts; walk data checks the feet on the draped ground).
- Site numbers after the review (model + ground + animate / cap): Union Square 598 / 600, UCSF Mission Bay 712 / 800,
  Murphy Windmill 788 / 800, Bison Paddock 790 / 800, Ocean Beach 488 / 2500, Japanese Tea Garden 2201 / 2500; the
  preview measured the same on screen for the three it shot (Union Square 598, Bison Paddock 790, Ocean Beach 488).

Status (2026-09-27): 复查完成，4 个修复提交 + 本报告已推送到 opus-bay；剩下 3 个待办（高度规则 'ground' 的接线映射、城市学院两个记录共用一个地点、篝火圈要在北段另做一个小地点）写在上面。

## Early phase, part 2 (lane L2)

Written 2026-09-27 by the lane-L2 agent (worktree `C:/Users/willy/wt/w4-l`, branch `w4-l` → `opus-bay`). Rule: new files
only, plus lane L's own wave-4 files (`siteKit.ts`, `w4list.ts`, `w4sites.ts`, `siteTerrain.ts`, the site modules, the
sites test). One exception, forced by the integration that landed meanwhile (W4-IL1 registered `w4list.ts` in
`SF_SITES` at 17:09): every new record needs its row in the generated `landmarks/tops.ts`, so each site commit re-runs
`scripts/opus-sf/assets/landmark-tops.ts` (a generated file under lane L's `landmarks/**`). No other existing file and
no other lane's file was edited. Higgsfield: 0 credits.

### 给主人的摘要

1. 这一轮又做了 **24 个**新地点（外加北段篝火圈一组）（接线阶段已经把 L 线的地点表接进游戏，所以都已经在城市里画出来了）：基泽体育场、金门公园旋转木马和游乐场、嬉皮山鼓圈、克莱门街和尔文街两段商店街、第16大道马赛克阶梯、格兰维尤公园山顶、植物园正门、戴维森山十字架、斯特恩林音乐草坪、默塞德湖钓鱼栈桥、芬斯顿堡观景台（天上有一架绕圈的滑翔伞）、哈维·米尔克广场彩虹旗和 18 街彩虹斑马线、要塞隧道顶公园的游乐场、梅森堡艺术中心的红瓦仓库和市集、贝克海滩看金门大桥的位置、科罗娜高地山顶红岩、伯纳尔高地山顶信号塔、圣玛利亚大教堂（四片双曲抛物面屋顶按真实几何算）、叮当车博物馆（门口大轮子会转）、战争纪念歌剧院和退伍军人大楼、亚洲艺术博物馆、日本城韦伯斯特街天桥、海事博物馆。
2. 每个地点都在三角形预算内（最多 772 / 800），都有能走到的到达点、地图旗杆、照片机位；全套测试 807 个全部通过，每个地点都截图看过。
3. 上一轮复查留下的 3 件事都做了：高度规则（'ground' 改成 'overlook'，并记下实测高度）、一个地点只对应一个主记录（城市学院）、海洋海滩北段的 16 个篝火圈（晚上有火光）。
4. 圣母大教堂和中国亭的 AI 模型摆放数据补齐了（V 组已经用上）；草莓山岛现在画成陆地了（V 组修的），中国亭保留石台基（V 组的模型就放在上面）。
5. 渔人码头西做了海事博物馆（1939 年像邮轮的浴场大楼）；没做：潘帕尼托号潜艇（离手工码头区只有 3.7 单位，放不下）、唐人街宝塔群（主程序已定本波只做卡片）。

### What was built (files, API)

| file | what |
|---|---|
| `landmarks/siteKit.ts` | `W4SiteMeta.aiSlot` gains `id` (the `SF_MODELS` id the swap part names) and `at` (the part's local placement); `height` gains `top` (the lod-0 model's measured top over the base: what cityViews / cityLive add to the base) and its `rule` is SfLandmarkInfo's union (`'ground'` → `'overlook'`); `street?: { x0, x1, half }` for a street site |
| `landmarks/w4sites.ts` | `w4SiteByPlace(placeId)` (the MAIN record of a place row: the first in build order), `isMainSite(s)` |
| `landmarks/shopStreet.ts` (new) | a shopping block as a site: `shopExclude`, `shopGround` (carriageway, sidewalks, centre dashes, zebra corners), `shopFronts` (awnings, blank signboards, produce stands, kerb trees / palms / lamps), `shopBlockers`, `shopLights` |
| `landmarks/civicKit.ts` (new) | `civicBlock(b, k, y, lod)`: a Beaux-Arts civic block (rusticated base, colonnade on one front, entablature, parapet, lit arches) |
| 25 site modules (new) | below (24 sites and the fire rings); each a declarative `W4Site` record with its facts, sources and frame in the header |
| `landmarks/w4list.ts` | the 25 records appended (P3 order; the Botanical Garden gate with the Music Concourse group) |
| `landmarks/siteTerrain.ts`, `landmarks/tops.ts` | generated (`sites-terrain.mts --site`, `landmark-tops.ts`) |
| `tests/opus-bay-sf-sites-w4.test.ts` | + the AI slot's id and placement, the height rule and measured top, one main record per place, no overlap with the tier-3 lane's sites (`w4list3`), lane P's travel ends (`attractionArrivals`) in the place check, the street sites' walk check along the block |

The sites (T = map tier; the test's numbers: model + draped ground + animate part / cap; walk = the ring's open share,
or along the block for a street site):

| site id | what the toy shows | T | tris / cap | walk |
|---|---|---|---|---|
| `kezar-stadium` | the two stepped grandstands on their OSM footprints, the terracotta track with lane lines, the field markings (no team marks) | 3 | 550 / 800 | 93 % |
| `koret-carousel` | the carousel house opened up, the 1914 carousel turning inside (animate), a play mound with two slides, a climbing tower | 3 | 772 / 800 | 93 % |
| `hippie-hill` | a drum circle of seven toy drummers on the meadow (beating hands, animate), blankets, a guitar case; the drum-loop sound hook at `DRUM_CIRCLE` | 3 | 606 / 800 | 100 % |
| `clement-street` | the 5th–6th Ave block: carriageway and sidewalks re-laid, zebra corners, awnings, blank signboards, produce stands, trees, lamps | 3 | 702 / 800 | 90 % (street) |
| `irving-street` | the 21st–22nd Ave block, the same kit, a tree and two palms | 3 | 730 / 800 | 85 % (street) |
| `tiled-steps` | fourteen toy steps whose risers run sea → surf → sand → hills → sky → sun (abstract, never the mosaic), garden walls and planting | 3 | 464 / 800 | 78 % |
| `grand-view-park` | the summit: coin telescope, two benches, a rail, two cypresses (panorama) | 3 | 224 / 800 | 100 % |
| `botanical-garden-gate` | the main gate on MLK Dr (lane P's re-anchor): forecourt, stone piers under a timber lintel, kiosk, magnolias in flower | 3 | 504 / 800 | 97 % |
| `mount-davidson` | the 1934 concrete cross (31.4 m → 8.1 u), plinth, stone kerb, two benches at a distance, eucalyptus; a memorial | 2 | 288 / 2500 | 73 % (stated) |
| `stern-grove` | the concert meadow: timber stage with canopy and speakers, blankets, log benches on the terraces | 2 | 582 / 2500 | 79 % |
| `lake-merced` | the Harding Rd shore: a timber fishing pier over the water, a moored rowboat rocking (animate), a heron, benches, a path | 2 | 476 / 2500 | 91 % |
| `fort-funston` | the observation deck on the bluff, rail, bench, windsock, one hang-glider circling over the beach (animate, never flyable) | 3 | 254 / 800 | 96 % |
| `harvey-milk-plaza` | the tall pole with the six-stripe rainbow flag; the four rainbow crosswalks at Castro & 18th (ground) | 2 | 176 / 2500 | 94 % |
| `presidio-tunnel-tops` | the Outpost playground: timber lookout fort with a slide, a woven-branch nest, logs, boulders, sand, picnic tables | 2 | 428 / 2500 | 100 % |
| `fort-mason-center` | the four 1910–14 storehouses in white stucco under red tile (loading doors, awnings), a market courtyard | 3 | 732 / 800 | 90 % |
| `baker-beach` | the view spot on the sand: driftwood logs facing the Golden Gate, rocks, a blank post (no people) | 2 | 132 / 2500 | 96 % |
| `corona-heights` | the red chert outcrops of the summit (lane C's panorama spot), a survey post | 2 | 212 / 2500 | 73 % (stated) |
| `bernal-heights` | the summit relay: equipment building, the 50 ft lattice mast with horns and a red light, the fenced compound | 2 | 336 / 2500 | 92 % |
| `st-marys-cathedral` | four hyperbolic-paraboloid shells as exact bilinear patches from the pylons to the top, the glass cross, the gold cross, the wing | 3 | 276 / 800 | 81 % |
| `cable-car-museum` | the 1907–08 brick barn, the stack at the rear, arched openings on Mason St with a big sheave turning (animate); diet ≤ 1.0k, lod0R 200 | 2 | 251 / 1000 | 71 % (stated) |
| `war-memorial` | the Opera House and the Veterans Building (colonnades to Van Ness, the fly tower), the Memorial Court | 3 | 422 / 800 | 72 % (stated) |
| `asian-art-museum` | the 1917 library block with its colonnade on the Larkin St front | 3 | 256 / 800 | 93 % |
| `webster-bridge` | Japan Center's glazed bridge over Webster St (curved roof, mullions, lit), the street re-laid under it | 3 | 208 / 800 | 86 % |
| `aquatic-park-bathhouse` | wharf west: the 1939 Streamline Moderne bathhouse (the Maritime Museum) as an ocean liner — three white decks with rounded bow and stern, dark window bands lit at night, navy rails, a signal mast | 3 | 324 / 800 | 70 % (stated) |
| `ocean-beach-fire-rings` | the Early review's open item 16: the 16 NPS fire rings in a row on the sand between Stairwell 15 (JFK Dr) and Stairwell 20 (Lincoln Way), embers glowing in the evening; a shared setting (no attraction; the Murphy Windmill's place row) | 3 | 640 / 800 | 96 % |

Also: `geary-west` and `blue-heron-lake` (part 1's AI-slot sites) got `aiSlot.id` / `.at` first, as lane V asked.

### Evidence

- **Checks** before every push: `tsc -p tsconfig.app.json --noEmit` 0; eslint on lane L's files 0 (the whole repo had 0
  errors / 42–43 old warnings at the part's start); the full opus-bay suite green (last: **807 / 807**), re-run on the
  rebased tree before the push (a failing file re-run once on its own: `sf-nav` "A* is time-sliced" and `sf-move2`
  "E2-5 view field" flake under load and pass alone).
- **Incident, fixed:** `35df065` / `fc27bff` (Lake Merced, Fort Funston) reached origin without their `tops.ts` rows
  (the re-check filter missed `✖ D2-10 …` once W4-IL1 had registered the list): `D2-10` and `W4-IL1` were red on origin
  for about ten minutes until `ebdc3a7` re-ran `landmark-tops.ts`. The push helper now requires `tsc exit 0` and
  `ℹ fail 0` literally.
- **Shots** (read before describing), key ones in `docs/opus-bay/qa/w4/L/p2/`: the Tiled Steps' colour run between the
  houses; Kezar from above (track, stands, field lines); the carousel in its house; Lake Merced's pier and rowboat;
  Fort Mason's red roofs and the market; the rainbow crosswalks at Castro & 18th; the Golden Gate from Baker Beach;
  St Mary's shells and cross; Strawberry Hill drawn as land around the pavilion (after W4-V-I1); the Webster St bridge.
- **Facts checked on the web this part** (each module header names its sources): Kezar opened 2 May 1925 (59,942
  seats), rebuilt 1990 for 10,000 with an eight-lane track (Wikipedia); the carousel (Herschell-Spillman 1914, 62
  animals, in the park since 1940, restored 1984) and the playground (1888, the Sharon Quarters); Clement St as "New
  Chinatown" (SF Examiner); Mount Davidson's cross 103 ft, 1934, George Kelham, arms 39 ft, an Armenian memorial since
  1997, OSM node 633021134 (mtdavidson.org, noehill.com, KQED); Stern Grove given in 1931 by Rosalie Stern, the festival
  since 1938 (sterngrove.org); the Lake Merced piers and slipway (OSM); Fort Funston's Observation Deck (OSM node
  3101265351); Harvey Milk Plaza's 20 × 30 ft flag (1997, a landmark) and the rainbow crosswalks at Castro & 18th (Sept
  2014) (SF Chronicle, hoodline, SF Public Works); Tunnel Tops' Outpost and Field Station (presidio.gov); Fort Mason's
  1910–14 Mission Revival warehouses (NPS, TCLF); Bernal's 50 ft relay tower "Sutrito", 1962 (Wikipedia, Bernalwood);
  St Mary's by Belluschi and Nervi, 190 ft, 255 ft square (smcsf.org, Docomomo); the Cable Car barn 1907–08, electric
  since 1911, the stack at the rear (cablecarmuseum.org, Wikipedia); the Webster Street Bridge (OSM way 148481441).

### Decisions

- **One record per attraction** where the plan grouped several (park east = Kezar, carousel, Hippie Hill; Golden Gate
  Heights = Tiled Steps, Grand View; Civic Center = War Memorial, Asian Art): one flag and one arrival per attraction;
  the plan's group names stay in the headers.
- **Street sites** (Clement, Irving): the published residential ribbons include their sidewalks, so a block site
  re-lays the carriageway and sidewalks inside its exclusion (continued 1.6 u into the crossings) and dresses the
  shopfronts on both sides; its walk check samples the block's length (`w4.street`): a ring would cross the shops.
- **Stated rings** (≥ 60 %, the reason in `notes`): Mount Davidson (steep knoll), Corona Heights (rocky sides, the dog
  run), the Cable Car Museum (a corner building between row houses), the War Memorial (two big blocks).
- **The pavilion keeps its raised stone base (BASE 0.45).** Lowering it to the island ground (0.25) after W4-V-I1
  broke lane V's swap row (`data/sf/w4Swaps.ts` places the AI pavilion at y 0.45 and its test pins the fade): kept (the
  real pavilion stands a step up too); the header now says why.
- **Harvey Milk Plaza:** Market St's two carriageway ribbons cover the plaza and the OSM flag spot, so the pole stands
  at the plaza's south corner 2.4 u away and the flag flies over the corner house (the only side with room in the
  exclusion). **The Webster bridge** takes the Peace Plaza row as its place: the curated `japantown-peace-pagoda` row
  stays the pagoda's (else `w4SiteOf` / `siteFlagTop` would answer the pagoda's place with the bridge).
- **Lake Merced** is built where lane P ends the trips (the Harding Rd shore, `PLACE_REANCHORS`); the boat piers are
  85 u west. **Fort Funston's** OSM place row is 71 u from the bluff: the test takes lane P's travel end.
- **Chinatown pagoda cluster: not built** (lead §8.3: card-only in wave 4). **USS Pampanito: not built** (3.7 u from the
  hero slab's edge: a 13 u hull would cross it).

### Integration plan (the records are registered already, by W4-IL1)

1. `data/sf/landmarks.ts` `sfLandmarkInfo` fallback for a wave-4 record: `height: { realM, u: w4.height.top, rule:
   w4.height.rule }` (the rule is SfLandmarkInfo's union now; `top` is over the base, as cityViews / cityLive read it);
   key `sfLandmarkInfoByPlace` on `w4SiteByPlace(placeId)` (one main record per place).
2. Swaps: `w4.aiSlot.id` / `.at` are the swap part (`model = aiSlot.id`, `x, y, z = aiSlot.at`); the IL5 test checks
   the parts against them.
3. Lane T (city audio): a weekend drum loop at Hippie Hill's `DRUM_CIRCLE` (exported from `hippie-hill.ts`).
4. Adding or moving a site: `sites-terrain.mts --site <id>`, then `landmark-tops.ts` (D2-10 / W4-IL1 need the row),
   then the sites test.

### Not done

- `wharf-west`'s USS Pampanito (the hero-slab conflict above; the bathhouse is built).
- `chinatown-pagodas` (the lead's decision); P4 is the tier-3 lane's (`w4list3.ts`).
- The items routed to lane L in lead §8.4 (the `kit.pyramid` turn, D2's remaining T2 settings): existing files, left to
  the integration lane.

### Requests

- **Lane C:** cards for the 24 new sites (their place rows are each module's `w4.placeId`; the headers carry the
  facts); Mount Davidson, Harvey Milk Plaza and St Mary's are quiet cards; Baker Beach and Lake Merced never prompt a
  swim; Fort Funston's glider is never flyable.
- **Lane T:** the Hippie Hill drum loop (integration step 3).
- **Lead:** `C:/Users/willy/OneDrive/Desktop/baylink-web/node_modules/.bin` went empty at about 19:29 (another
  checkout's install?), so `npx tsx / tsc / eslint` fail with "not recognized"; lane L2 ran
  `node node_modules/tsx/dist/cli.mjs`, `node node_modules/typescript/bin/tsc` and
  `node node_modules/eslint/bin/eslint.js` instead (never an npm install).

Status (2026-09-27): 第二轮 25 个新记录（24 个地点 + 北段篝火圈）已推送；潘帕尼托号潜艇和唐人街宝塔群没做（原因见上）。

## Integration part a

Written 2026-09-27 by lane L's integration implementer (worktree `C:/Users/willy/wt/i4-l`, branch `i4-l` → `opus-bay`,
dev port 5403, scratch `C:/Users/willy/opus-qa/w4i/i4-l/`). Commits `W4-IL1` … `W4-IL9` on `opus-bay`. Higgsfield:
0 credits.

### 给主人的摘要

1. **新地点全部接进游戏了**：原来 24 个地标 + 第四波的新地点（写这份报告时共 80 个，L2 / L3 还在继续加，加了就自动出现）现在都在城市里画出来、能挡人能走、晚上有灯，人群会站到新广场上，滑翔会绕开高的部分，地图旗杆、到达点、拍照机位都能查到。
2. **四个 AI 地标换上了**：圣依纳爵堂、加州科学院（我这边对比后都比程序化的好看得多），圣母大教堂和中国亭（按 V 组的结论）。
3. **D2 留下的 7 个二级地标周边都做了**：恩典大教堂门前的平台、宽台阶和户外迷宫（教堂原来门口被地面盖住一米，已修正）；荣勋宫门前广场，中庭原来被草盖住，现在是石板；吉拉德利广场的砖铺庭院、橄榄树和通往 Beach St 的台阶；叮当车转盘周围的砖广场；渔人码头路牌旁两个卖螃蟹的小摊；九曲花街上下两端断掉的马路（包括叮当车轨道）接上了；苏特罗浴场的水池里终于看得见水。
4. **到达点挪到了该在的位置**：艺术宫湖边、Fort Point 平台、迪扬前庭、卡斯特罗对街，恩典大教堂从马路中间挪到人行道。**草莓山现在能走上去**：两座桥和环岛小路都能走，中国亭从湖边就能走到。
5. 顺手修了一个老 bug：地标的"金字塔屋顶"只要长宽不等就歪成菱形（市政厅、荣勋宫、龙门等），现在是正的。
6. 全部测试通过（最后一次 808 个）；电脑和手机截图都逐张看过。海洋海滩北段的篝火圈由第二轮的 L 线同时做好了（16 个火圈，已自动接进游戏）。还没做的：另外几个地标"半埋在地下"的问题（清单在下面），请 V 组重测性能表。

Status（回答主人"现在进度如何"）：接线 a 部分完成并已推送——登记、到达点、屋顶修正、7 个二级地标周边、4 个 AI 地标、草莓山步行都已在游戏里；几个地标的埋地问题留到 b 部分。

### What was built

| commit | files | what |
|---|---|---|
| `W4-IL1` | `landmarks/index.ts`, `w4sites.ts`, `sites.ts`, `context.ts`, `tops.ts`, `SoloView.tsx`, `scripts/opus-sf/{assets/landmark-tops.ts,routes-qa.mjs,sites-preview.tsx,sites3-preview.tsx,sites-qa.mjs}` | **Registration.** `SF_SITES = [...SF_LANDMARKS, ...W4_SITES, ...W4_SITES_T3]` (index.ts imports `w4list` / `w4list3` only: no cycle); `sfLandmark(id)` answers for every site. `SF_LANDMARKS` stays the 24 records with an info card (city cards, the written-out arrivals, the place-index landmark rows), so lanes C and P kept their counts. `CitySites` draws, excludes, walks and lights `SF_SITES`, each site on its `w4.lod0R` ring. `w4sites.ts` looks up over both lists (`W4_ALL_SITES`). `context.ts`: tall parts and plaza spots over every site (a wave-4 site's day-0 circle uses `w4.height.top`, overlooks skipped), `sfLandmarkAnchor` falls back to `w4.arrival`, new `siteFrame(id, baseOf)` and `sitePhoto(id)` (lane G's reveal), and it re-exports `siteFlagTop`, `flagHeight`, `LANDMARK_FLAGS`, `HERO_FLAGS`, `w4Site*`. `tops.ts` measures every site. SoloView lists every site and uses a site's `w4.photo`. |
| `W4-IL2` | `data/sf/landmarks.ts`, C's `data/sf/arrivals.ts`, P's `data/sf/attractions.ts` (`LANDMARK_ARRIVALS`), `data/sf/routes.ts` + `routePaths.ts` | D2's request 1: the Palace on the lagoon's south shore walk, Fort Point on the apron, the de Young in its forecourt, the Castro across Castro St (the exact values of `sf-w3-D2.md` part c; both tables pasted from their tests; the R2 / R3 stops moved, `routes-build.ts` re-run). |
| `W4-IL3` | `landmarks/kit.ts` | `pyramid` turns the 4-sided cone by 45° **before** the scale: a `w ≠ d` cap is the rectangle's hip, no longer a rhombus reaching max(w, d)/2 on both axes (City Hall, Conservatory, Dragon Gate, Grace, Legion, Mission Dolores, a hipped Painted Lady). Square caps and the measured tops unchanged. |
| `W4-IL4` | `grace-cathedral.ts`, `legion-of-honor.ts`, `settingData.ts`, `settingsMeasure.ts` | **Grace**: base pinned at the doors' sill (21.52; the old 'terrain' base 20.44 left the doors ≈ 1 u under the city ground), exclusion + the front terrace, the level granite terrace with a parapet on the fall, the wide Sky Steps to the Taylor St sidewalk, the outdoor labyrinth (six grey terrazzo rings, 40 ft ≈ 1.7 u) on the California St corner, lamps, benches, planters; the arrival moves off Taylor St's asphalt to the foot of the steps; the terrace keeps California St's sidewalk clear. **Legion**: base at the court floor (25.1; the city's grass stood 0.7 u over the Court of Honor), the paved forecourt to Legion of Honor Drive (centre walk, lawn panels, clipped cypresses, hedges, lamps, benches, the Lincoln Highway's plain end post), the court and gateway walkable at the paving. Both settings are drawn in the AI remainders too. |
| `W4-IL5` | `geary-west.ts`, `blue-heron-lake.ts`, `cal-academy.ts`, `st-ignatius.ts` | **AI swaps (W4-L4)**: Holy Virgin (lane V's row and review 2: at the Geary sidewalk before the porch, the plinth as remainder, a glide tall part for the domes) and the Chinese Pavilion (lane V's row: stone base and causeways, roof fade) from `data/sf/w4Swaps.ts`; Cal Academy and St Ignatius through lane L's SoloView gate — **both ship** (golden, ¾ view: the AI roof's porthole skylights and hills; the AI church's crosses, columned front, pediment, tile roofs and dome), with forecourt / lawn and a plinth as remainders. |
| `W4-IL6` | `ghirardelli-square.ts`, `cable-car-turntable.ts`, `fishermans-wharf.ts`, `lombard-crooked-street.ts`, `sutro-baths.ts` | **Ghirardelli**: the courtyards paved in warm brick on the measured ground, olive trees in round planters, lamps, benches, the passage and steps to Beach St. **Turntable** ("F's aprons"): the brick plaza of Powell St's foot over the exclusion, Market St's corner and the F-line restored clear of the apron, benches, lamps, queue crowd spots. **Wharf**: two crab stands (striped awnings, no lettering, crabs, a steaming cauldron) on Jefferson St, a lamp. **Lombard**: Hyde St with the Powell–Hyde rails and Leavenworth St restored across the lane's ends; crowd spots at the two classic views. **Sutro Baths**: base 0.9 (the hollow's drawn ground covered every basin): the water shows. The Cliff House keeps its own terraces (D2's note). |
| `W4-IL7` | `blue-heron-lake.ts` | **Strawberry Hill on foot (W4-L7)**: walk decks on both footbridges (2.6 u, flat steps) and along the island's shore loop ('terrain' decks, walkable at any grade): the raster had left each bridge one broken column and the steep DEM had cut the 1.2 u shore path into pieces. The pavilion's arrival moves onto its south causeway (the 1.1 u gaps between the columns are narrower than a walker's clearance). |
| `W4-IL8` | `scripts/opus-sf/sites-qa.mjs` | QA views for any registered landmark (the live base, a landmark's info poses). |
| `W4-IL9` | this report, `docs/opus-bay/qa/w4/L/i4-*.jpg` | — |

Tests (lane L's): `sf-landmarks` +5 (registration, CitySites and the lod rings; no wave-4 exclusion overlaps any other
site; the helpers answer for the sites; the pyramid's shape; the island paths), `sf-landmark-context` (tops for every
site, tall parts over every site, the D2-10 base check on Mission Dolores and on Grace's numeric base, D2-09's
draped-ground and plaza tests over the Legion, Grace, Ghirardelli, the turntable and Lombard), `sf-models` +1 (the four
wave-4 swaps: model ↔ site, slot placement, ≤ 6k, remainders ≤ 1.2k). The early-phase registry tests now read
"registered, not one of the 24 ids".

### Evidence

- **Checks** on the last pushed tree: `npx tsc -p tsconfig.app.json --noEmit` 0; `npx eslint .` 0 errors (43 old
  warnings); the full opus-bay suite **803 / 803** (one run between pushes had E2-5's "a cached cell is cheap"
  wall-clock assert red under load; green alone, 24 / 24).
- **In the game** (desktop 1440 × 900, golden, quality high, RTX; every image read): Stonestown at its arrival (69 calls,
  210k); Grace's terrace, steps and labyrinth from the Taylor St side and at night; the Legion's forecourt and paved court
  with The Thinker through the arch, and at night; Ghirardelli's courtyard; the turntable plaza; the crab stands; Lombard
  from its foot; Sutro's basins with water; the four AI landmarks in their streets. Sheets in `docs/opus-bay/qa/w4/L/`:
  `i4-t2-settings.jpg` (Grace · Legion · Ghirardelli / turntable · Sutro · Lombard), `i4-ai-swaps.jpg` (St Ignatius · Cal
  Academy / pavilion · Holy Virgin), `i4-wharf-crab-stands.jpg`. SoloView gate shots (ai 0 / 1) in scratch `gate/`.
- **Phone** (390 × 844, dpr 3, quality mid): Grace's arrival (72 calls, 280k), St Ignatius's arrival with the AI facade
  (80 calls, 272k; `i4-phone-st-ignatius.jpg`).
- **Budgets**: every site's lod 0 within its cap (the tests); the settings add 0.3–0.8k triangles per landmark (Grace
  +0.76k); no new program (TOY, GROUND, TOY_DYN; the AI parts use D2's warmed `ob-model-hero`). Frames at the QA poses:
  mostly 130–370k; **over 400k at two elevated QA poses downtown** (Grace "ring1" 448k / 113 calls looking over the
  Financial District; the turntable "street" pose 404k / 122 calls, measured before its setting; the sites add ≈ 6.8k
  and ≈ 1.6k there) — to be settled by lane V's perf gate at its spots (Requests).
- **GameRoot**: the site modules and the baked terrains live in the landmark chunk (build after W4-IL1: GameRoot
  835.08 kB / 310.71 kB gzip, no wave-4 site id in it; the later commits touched only the landmark chunk and data values).

### Decisions

- **Two lists, not one.** `SF_SITES` is what the city draws; `SF_LANDMARKS` stays the 24 with an info card. Growing
  `SF_LANDMARKS` would have broken lanes C's and P's count tests while they were editing them, and the wave-4 sites
  already have their cards (lane C's place cards) and place rows (lane P's). `sfLandmark()` answers for every site.
- **Landmark-info fallback → context helpers.** Instead of feeding `w4` blocks into `data/sf/landmarks.ts` (which builds
  the 24 city cards), `context.ts` answers anchors, frames and photos for any site.
- **Bases at the floor, not the lowest ground**, where a setting needs it (Grace, the Legion, Sutro): the 'terrain' rule
  (lowest ground in the exclusion) buries buildings on slopes. Walls reach 1.2 u under the base, so the low sides stay
  closed.
- **Settings drawn in the AI remainders too** (sites.ts builds `swap.build` instead of `build` when the AI ships).
- **Walk decks, not raster tweaks**, for Strawberry Hill: authored decks are walkable at any grade; the raster rules stay
  as they are for the rest of the city.

### Known gaps

- **Still buried** (the audit of the drawn ground over each landmark's footprint, above its base): Ghirardelli 2.65 u
  (its south row stands on its own grade; the courtyards are right now), Painted Ladies 1.22, Castro 0.96, Conservatory
  0.96, Dragon Gate 0.90, City Hall 0.67 at a corner, Grace 0.73 at the apse (accepted: the choir runs into Nob Hill).
  Each needs a look, not a formula (part b).
- St Ignatius's early-phase arrival is at Fulton St's kerb (the phone shot shows BAYBAY on it): move it onto the
  church's forecourt strip in part b.
- The pavilion's floor is looked into, not walked on (column gaps < walker clearance; lane V's row keeps the blockers).
- The two over-400k QA poses above.

### Not done

- ~~Fire rings~~ (early review open 16): built by the early-part-2 lane (`ff34f53`, 16 rings) while this part ran; a
  parallel version of mine (six rings) was dropped unpushed.
- The burial fixes above; P3 / P4 sites still arriving from lanes L2 / L3 (registered automatically; they re-run
  `landmark-tops.ts` as the tops test asks).
- The Cliff House setting (kept, D2's note).

### Requests

- **Lanes L2 / L3 (early part 2)**: sites are live now: every new site needs its `tops.ts` row (`npx tsx --tsconfig
  tsconfig.app.json scripts/opus-sf/assets/landmark-tops.ts`; the landmark-context test names it); your preview pages
  append nothing any more (`SF_SITES` draws everything).
- **Lane V**: re-run the perf gate (desktop high and the phone profile) after `W4-IL1` / `W4-IL5` / `W4-IL6`: 80 sites,
  four more AI parts within 220 u; add a downtown spot near Grace / Powell & Market (the two over-400k QA poses).
- **Lane G**: `siteFrame(id, landmarkBaseY)` and `sitePhoto(id)` in `world/sf/landmarks/context.ts` for the reveal.
- **Lane P**: `siteFlagTop` (re-exported by `context.ts`) answers for every registered site; `withSiteFlags` can take it.
- **Lanes C / P**: when I move an arrival, the two arrival tests print the lines to paste (done for five in this part).

### Checks

- `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors · `npx tsx --tsconfig tsconfig.app.json --test
  tests/opus-bay-*.test.ts` 803 / 803 on the pushed tree of `W4-IL9`; 808 / 808 on the tree with the fire rings.