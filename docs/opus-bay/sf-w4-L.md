# Wave 4 · lane L · Landmarks & streets (the new sites around the city)

## Early phase

Written 2026-09-27 by the lane-L agent (worktree `C:/Users/willy/wt/w4-l`, branch `w4-l` → `opus-bay`). Early-phase rule
(`sf-w4-lead.md` §2): new files only. Every file lane L touched is a file it created in wave 4 (`git show --name-status`
over the `W4-L*` commits lists only `A` entries plus later edits of those same files); nothing imports the new
modules yet, so the game runs exactly as before. Higgsfield: lane L spent **0 credits** (no ledger file).

### 给主人的摘要

1. 新地点做好了 **23 个**：主人点名的全部 8 个（石镇购物中心、旧金山州立大学、UCSF 帕纳萨斯和 Mission Bay 两个校区、USF 孤山 + 圣依纳爵堂、城市学院和它的里维拉艺术中心工地），一级景点 13 个（加州科学院、音乐广场、日本茶园、联合广场、SFMOMA、芳草地花园、海特-阿什伯里路口、多洛雷斯公园、林角、海洋海滩、动物园非洲草原、墨菲风车、海滩小屋），还多做了两个三级的（金门公园野牛围场、蓝鹭湖中国亭）。
2. 每个地点都有：按真实坡度铺的广场和小路、长椅路灯树、能走的范围和到达点、地图旗杆、照片机位；三角形都在预算内（最多 1.9k / 2.5k），市中心的三个按"瘦身"预算做（联合广场 0.6k）。
3. 测试 8 项、全套 opus-bay 测试全部通过；每个地点都在预览页面里截图看过（`docs/opus-bay/qa/w4/L/`）。
4. 还没接进游戏（等第三波验收），接线步骤写在下面。圣依纳爵堂、加州科学院、中国亭的 AI 模型 V 组已经做好，我这边的尺寸和它们对齐了，接线时换上。
5. 发现一个老问题：城市把蓝鹭湖中间的草莓山岛画成了水（岛上的小路浮在湖面上），需要做城市数据的组修。

Progress (2026-09-27): W4-L1, W4-L2 and W4-L3 done (P1 and P2 except the Botanical Garden gate), W4-L5 started (2 of
the P3 list), W4-L7 walk data for every site, W4-L8 `sites-qa.mjs` and the preview page, W4-L10 tests and this report.
W4-L4 prepared (the AI slots name lane V's models, both ways checked, and the pavilion is built to lane V's bounds); waiting for the
integration phase: registration, draped ground in the renderer, lod rings, the AI swaps through the SoloView gate.

### What was built (files, API)

| file | what | API |
|---|---|---|
| `src/opus-bay/world/sf/landmarks/siteKit.ts` | the wave-4 site record (`W4Site` = `SfLandmark & SiteHooks & { base: number; ground?: SiteGroundPoly[]; w4: W4SiteMeta }`), the baked terrain lookup, draped ground helpers (fill / strip / rect / clip / crosswalk with per-vertex `ys` and the `lift` used), street furniture (bench, lamp, bollard, bin, planter, hedge, fence, flagpole, trees, palm, conifer), crane parts (mast, jib, swing), hoarding, `hipRoof` (a true hip roof over w × d), `plazaOf`, `polyArea`, `along` | `siteGround(id, fallback)` → `{ base, grid, at(x, z) }`; `gfill`, `gstrip`, `grect`, `clipRect`, `crosswalk`, `GC`, `PAT`, `FC`, `LIFT`, `LIFT_STRIPE`, the helpers above |
| `src/opus-bay/world/sf/landmarks/siteTerrain.ts` | generated: per site `base` (world y: the lowest walked city ground inside the exclusion) and the local ground heights on its grid (2 u; 1 u at Dolores Park and Lands End) | `SITE_TERRAIN[id]` |
| `src/opus-bay/world/sf/landmarks/w4sites.ts` | the ordered list (plan §2.3 build order), lookups, the flag tops of every site, existing landmark and T1 hero (plan §4.2), per-site lod ring and budget accessors | `W4_SITES`, `W4_SITE_IDS`, `w4Site(id)`, `w4SiteOf(id or attraction or place id)`, `flagHeight(skyline)`, `LANDMARK_FLAGS`, `HERO_FLAGS`, `siteFlagTop(ref)`, `siteLod0R(l)`, `siteBudget(l)` |
| 23 site modules in `src/opus-bay/world/sf/landmarks/` (below) | one declarative record each: `build(b, lod)`, exclusion, walk blockers and decks, draped ground, lights, plazas, animate part where it moves, `w4` metadata (placeId, attractions, lod ring, budget, arrival, photo pose, flag, height policy, OSM ids, terrain box, AI slot, notes) | `stonestown`, `sfState`, `ucsfParnassus`, `usfLoneMountain`, `stIgnatius`, `ccsfOcean`, `ccsfDrpac`, `ucsfMissionBay`, `calAcademy`, `musicConcourse`, `japaneseTeaGarden`, `unionSquare`, `sfmoma`, `yerbaBuenaGardens`, `haightAshbury`, `doloresPark`, `landsEnd`, `oceanBeach`, `sfZoo`, `murphyWindmill`, `beachChalet`, `bisonPaddock`, `blueHeronLake` |
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

Every module's header comment carries its facts and sources and its local frame (origin, yaw, what lies where).

### Evidence

- **Checks** on the pushed tree: `npx tsc -p tsconfig.app.json --noEmit` 0; `npx eslint src/opus-bay tests/opus-bay-*
  scripts/opus-sf/sites-*` 0 errors; whole-repo `npx eslint . --ignore-pattern .vite-opus` 0 errors (the Vite dep
  cache is not source); the full opus-bay suite green on the pushed tree (659 / 659).
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
  house, pagoda, bridge), the bison behind the fence, and the Chinese Pavilion on its stone base in the lake with the
  island paths floating around it (the Strawberry Hill problem below).
- **Facts**: each site's header names its sources (sfsu.edu, ucsf.edu / UCSF Real Estate, USF, CCSF news and The
  Guardsman, calacademy.org, gggp.org, sfmoma.org, yerbabuenagardens.org, nps.gov, sfzoo.org, sfrecpark.org, the
  Richmond Review, Wikipedia, OSM ids). Checked this session: Murphy Windmill completed 1908, reopened 2012, 114 ft
  sails (Wikipedia); the Chinese Pavilion is Taipei's 1981 gift with red columns and a grey-green tiled roof
  (sfrecpark.org; Richmond Review 2021).

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
     `-places`, `-terrain`, `-cards`, `-content`, `-attractions`, `sf-world`, `sf-place-arrival` …): expect +23
     records; any rule written for `base: 'terrain'` records must accept numeric bases; per-tier budgets must read
     `siteBudget(l)` first (the diet caps).
7. AI swaps (W4-L4), after lane V spreads `W4_MODELS` into `SF_MODELS`: a `swap` on each record — `cal-academy` part
   `sf-cal-academy` at the origin (y = the block's ground), `st-ignatius-church` part `sf-st-ignatius` at (0.35, ground,
   −0.18), `blue-heron-lake` part `sf-chinese-pavilion` at (0, 0.45, 0), all yaw 0, scale 1 (lane V's report §3) —
   with `build` reduced to the setting, decided per site in SoloView (`?solo=<id>&ai=0|1`); walk data already matches.

### Not done (early phase)

- **Botanical Garden gate** (T3 plaza, plan: MLK Dr & 9th Ave): the place row `osm-w120480164` is the garden's centre
  (−223.4, 1010.3), 58 u from the main gate (−178.3, 970.9; OSM node 7838369891, `entrance=main`), so the site test's
  "place near the site" fails; waiting for lane P's re-anchor (Requests).
- **P3 sites** after the first two: `park-east` (Kezar, Koret carousel, Hippie Hill), `geary-west` (Holy Virgin, AI),
  `clement` / `irving` strips, `golden-gate-heights`, `mount-davidson`, `stern-grove`, `lake-merced`, `fort-funston`,
  `castro`, `presidio`, `fort-mason`, `baker-beach`, `corona-heights`, `bernal`, `cathedral-hill`, the `civic-center`
  and `japantown` extensions, `cable-car-museum`, `wharf-west`, `chinatown-pagodas` (gated, W4-L6); P4 (W4-L9).
- **The Blue Heron bridges'** walk strips (W4-L7): they wait for the island fix below (today the whole island is water
  in the walk raster, so a bridge strip would lead onto water).
- **W4-L4 AI swaps**: lane V's four meshes are published but not in `SF_MODELS` yet, so the swaps and the SoloView
  verdicts wait for the integration; the Holy Virgin slot waits for its `geary-west` site (P3).
- Integration items above (existing files).

### Requests

- **City data (lead / the lane that owns the chunk build):** Strawberry Hill is drawn and walked as lake water. The
  published chunks carry the island as `hole` rings of the Blue Heron Lake water areas (visible in
  `sites-survey --x -262 --z 1030`), but the render shows the island's paths floating on water and the walk raster
  answers surface 0 at the Chinese Pavilion (OSM way 120479810) and on the island paths next to it. Shot:
  `docs/opus-bay/qa/w4/L/blue-heron-lake-ring1-golden.jpg`.
- **Lane P:** re-anchor `osm-w120480164` (San Francisco Botanical Garden) to its main gate (−178.3, 970.9) — the card
  and the arrival belong at the gate on MLK Dr — then lane L builds the gate plaza.
- **Lane V:** the slots keep your GLB stems (your test's rule; your report asks for the registry ids — at the integration
  the swap parts use `sf-*` and the slot strings can follow); the pavilion follows your measured bounds (please keep
  them if you re-export). The Tea Garden pagoda stays procedural (no AI pagoda needed from lane L's side).
- **Lane C:** cards for `murphy-windmill`, `beach-chalet`, `bison-paddock`, `blue-heron-lake` can quote the facts in
  the module headers; Ocean Beach's card keeps "no swimming"; Lands End never promises the labyrinth.
- **Lane D2 / the kit owner at integration:** `kit.pyramid` should apply its 45° turn before the scale (or call
  `siteKit.hipRoof`); the six existing `w ≠ d` calls listed under Decisions change shape when it is fixed.
