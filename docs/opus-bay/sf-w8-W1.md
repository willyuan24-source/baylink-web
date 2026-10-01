# Wave 8 · lane W1 · Chinatown & the Wharf

Lane W1 of wave 8 (`docs/opus-bay/sf-w8-lead.md` §3 row W1), run as an Ultra workflow; worktree `C:/Users/willy/wt/w8-w1`
(branch `w8-w1`), dev port 5807, scratch `C:/Users/willy/opus-qa/w8/w1/`. A first agent of this lane worked 19:00–19:20
PDT and was stopped when the lead switched the wave to the workflow: it committed nothing; its four scratch probes under
`scripts/opus-sf/qa/_w1*.mts` were moved to `C:/Users/willy/opus-qa/w8/w1/probes/` (never committed) and its findings
(the OSM ids of the four corner buildings, the Grant Ave frame, the lots' ground, the Pier 35 walk map, the reference
photos in scratch `ref/`, the "before" budget views in `bv-before/`) were used. Nothing of it was broken or discarded.

## 给主人的摘要

1. **唐人街的宝塔楼群做好了**：都板街和加州街路口四个角——西北角 Sing Chong（米黄砖楼，绿瓦红檐的宝塔角楼）、西南角
   Sing Fat（四层砖楼，三层黄色宝塔顶加金色尖顶，绿色栏杆）、东北角老圣玛利亚教堂（红砖教堂、灰石板屋顶、带钟面的钟楼、
   四个尖塔和十字架）；往北两个路口，华盛顿街上的华人电话局（三层绿瓦红墙宝塔，门口四根红柱）。原来这些位置上只是普通方盒子，
   现在换成了这些楼。没有增加绘制次数（画在龙门这个景点自己的网格里），唐人街最忙的那个视角三角形只多了约 2 千。
2. 这些楼都是实心的（不能穿墙），路口四边的人行道照样能走；电话局的到达点挪到了华盛顿街的人行道上，正对红柱。
3. 唐人街原来有几块招牌和逛街的人站在老圣玛利亚教堂的墙前，已经挪到旁边的店铺门口。
4. **自由轮「奥布莱恩号」停进了 35 号码头**（灰色船身、船中间的驾驶楼和黑顶烟囱、三根桅杆），和潘帕尼托号潜艇画在同一个网格里，
   不多绘制次数。它的到达点改到 35 号码头西边的海堤步道上，正对着船——全城扫描最后一个“走不到”的景点没有了（0 个走不到）。
5. BAYBAY 新说三句固定台词（中英文，等 X 线配音）：走上都板街时认宝塔楼、走到老圣玛利亚钟楼门口讲 1906 年大火、走到船尾讲 1994 年开回诺曼底。

## Part a · W8-W1 Chinatown's pagoda cluster (Sing Chong, Sing Fat, Old St. Mary's, the Telephone Exchange)

Started 19:24 PDT (`date`), on `origin/opus-bay` = `889cc614` + the two K commits fast-forwarded at the start.

### What was built

- **`src/opus-bay/world/sf/cornersChinatown.ts`** (new): the cluster, in the Dragon Gate site's LOCAL frame, laid out in
  Grant Ave's own frame (`ctPoint(along, across)`, the same axis as `dragon-gate.ts grant()`: along u north from the
  gate, across u east of the street's middle; Grant & California = along 26.43, checked against OSM in the test):
  - `CT_LOTS` (9 buildings on the published city's lots, squared to Grant Ave: the street fronts at across ±1.8,
    California St's at along 24.1 / 28.5, Washington St's at along 66.65), `CT_GROUND` (per building the lowest walked
    ground under it and the ground at its street reference point, WORLD y, re-measured by the test), `CT_EXCLUDES` (four
    WORLD polygons: the lots whose city boxes go), `CT_BLOCKERS` (one walk blocker per building), `chinatownCluster(b,
    lod, base)` (lod 0 ≈ 2.3k triangles; lod 2 ≈ 140 triangles: one box per lot at its roof line, the two towers as caps).
  - **Sing Chong** (NW corner): buff brick, the city's Chinatown façade (TOY window style 10, seeded), green-tiled pagoda
    eaves with red fascia along both street fronts, shop windows lit at night, red awnings, and the corner tower — a buff
    stage, a gold band, three green pagoda roofs with red stages, upturned tips, a gold finial.
  - **Sing Fat** (SW corner): tan brick, green piers on both fronts, a green-and-cream cornice, shop windows, a red
    corner awning, and the big tower — four yellow pagoda roofs on cream stages with green railings, a gold spire.
  - **Old St. Mary's** (NE corner): the red-brick nave along Grant Ave with a slate gable roof, five buttresses and four
    tall pointed windows (lit at night) on the Grant side, two side doors on California St; the square tower on the south
    front with a stone band, clocks on the south and west faces (lit at night), the blank panel where the inscription is
    (no lettering), paired belfry openings, a parapet with four pinnacles and the cross (7.3 u over the door ≈
    `buildingH(27)`); 660 California (a red-brick walk-up) and the parish hall east of it.
  - **The Chinese Telephone Exchange** (Washington St, east of Grant): the ground floor's shop glass behind four red
    columns and a red lintel, three tiers of green-tiled roofs with red ridges and upturned tips over red walls, a green
    balcony rail, a small red ridge lantern.
  - The plain walk-ups that shared the merged city boxes: 615 Grant (cream, green parapet, green awning) and 505–545 Grant
    (stone, red parapet, gold awning).
- **`src/opus-bay/world/sf/landmarks/dragon-gate.ts`**: `build` (lod 0 / 2) and the AI remainder call
  `chinatownCluster` (the gate's procedural mesh: **no new mesh**); the walk blockers append `CT_BLOCKERS`;
  `excludeMore: CT_EXCLUDES`; `fade.procedural: false` (the AI gate still thins as one; the procedural mesh — lanterns,
  lions and now the cluster — keeps the city's per-fragment dither, so a pagoda building melts only where it stands
  between the camera and the player, like any city building; the D2-15 swaps do the same). The Chinatown corner's dressing
  that stood on Old St. Mary's wall moved off it: the `bakery` blade and the `noodles` plaque are gone, the green awning
  moved to along 38.0 (the shop north of the Canton Building), the window shoppers stand at 35.9 / 37.7 / 43.6 / 45.0 /
  52.5 (were 30.9 / 34.5 / 37.0 / 45.0 / 52.5).
- **Surgical, outside the row** (named): `world/sf/landmarks/index.ts` — `SfLandmark.excludeMore?: Vec2[][]` (more WORLD
  polygons dropped like `exclude`, no sink, no say in the base) and `BUDGET_OVERRIDE['dragon-gate'] = 4500` (T2 is 2500;
  the gate + cluster is ≈ 3.1k procedural / 2.5k AI remainder); `world/sf/sites.ts` — `excludes()` and `walkInputs()`
  append one row per `excludeMore` polygon (`<site>+<k>`) **after** every site's own row (indices of the site rows
  unchanged), the walk rows with no walk data and a numeric base 0 (nothing of theirs reads it), so the stream workers,
  the far city and collision drop the same buildings; `world/sf/landmarks/tops.ts` regenerated
  (`scripts/opus-sf/assets/landmark-tops.ts`: only the `dragon-gate` row changed, 4 → 13 blocker tops);
  `tests/opus-bay-sf-landmarks.test.ts` — the "every site excludes its footprint" check expects the `+k` rows after the
  sites' (one line).
- **`data/sf/attractions.ts`** (my row): `ARRIVAL_OVERRIDES['chinese-telephone-exchange']` (27.11, 133.46) heading 0.96 —
  Washington St's sidewalk facing the red columns (the old end, OSM's tiny footprint's middle, stood 0.1 u in front of
  the new front wall: not standable); 2.8 u from the walking graph's nearest node (P2 ≤ 3 u).
- **Tests** — new `tests/opus-bay-w8-w1-chinatown.test.ts` (4): the gate's frame and Grant & California; the cluster ≤ 2.6k
  triangles, lod 2 ≤ 200, the gate within its budget and lod 2 ≤ 10 %, the AI remainder carries the cluster, the
  procedural mesh keeps the dither, every vertex on its lots (+ 0.75 u of eaves); the heights (the tower ≈ buildingH(27)
  ± 0.3, Sing Chong's tower over a 16 m roof, Sing Fat's the tallest, the exchange 4–5.2 u); exactly the five merged
  city boxes inside the exclusions (256080511, 260208813, 260519113, 260520154, 260520161) and no far prism, the extra
  rows after the sites' in `excludes()` / `walkInputs()`; in city mode `CT_GROUND` = the measured ground (± 0.02), every
  building solid (middle and two inner corners), nine sidewalk points round them standable, the three cluster
  attractions' trip ends standable. (The last one went red on the exchange's old trip end → the arrival override.)

### Evidence

- Tests while iterating: the new test + `sf-landmarks`, `sf-landmark-context` (tops), `sf-attractions`, `w5-corners`,
  `w5-corners-view`, `sf-models`, `sf-stream`, `sf-look`, `w5-landmarks`, `sf-sites-w4`: 135 / 135 after the tops re-run.
- Static sweep (`scripts/opus-sf/qa/sweep-static.mts`, this tree): 694 targets · ok 547 · CORRIDOR 146 · **BOXED 0 ·
  SNAG 0** · UNREACHABLE 1 (`trip:ss-jeremiah-obrien`: part b) — the same counts as W7's review. The cluster's targets:
  `trip:old-st-marys-cathedral` CORRIDOR (Grant Ave's roadway beside the church), `trip:chinese-telephone-exchange`
  CORRIDOR (the sidewalk between the columns and the kerb), `egg:chinatown-telephone-exchange` CORRIDOR; none BOXED.
- Calls / triangles (`scripts/opus-sf/qa/budget-views.mjs`, 1440 × 900 high, golden hour, read — not fps; actors and
  streetcars move between runs):

  | view | before (`bv-before`, the first agent) | after |
  |---|---|---|
  | perf-chinatown (the Dragon Gate) | 122 / 290.8k | 123 / 299.4k — city.landmarks 12 / 17.9k → **12 / 20.0k**; the rest actors (+1 call, +5.5k) and streetcars (+1.6k) |
  | ct-grant-south | 76 / 217.8k | 76 / 223.6k (city.landmarks 4 → 4 calls, +2.1k) |
  | ct-cal-east | 86 / 229.4k | 84 / 234.5k (city.landmarks 5 → 5 calls, +2.0k) |
  | ct-telex (Grant & Washington) | 117 / 309.9k | 118 / 311.7k (city.landmarks 6 → 7: the gate's mesh is now in view there because the exchange is in it — the same mesh, no new one) |
  | ct-corner-low / ct-ne-sw / ct-w-church / ct-exchange (new QA cameras) | — | 106 / 237.6k · 86 / 221.5k · 106 / 268.5k · 87 / 230.8k |
  | phone (dpr 3, quality mid): ct-corner-low · walking at Grant & California | — | 101 / 228.0k · 116 / 290.7k |

- Shots (every one read): `qa/w8/W1/a-cluster-desk.jpg` (low over Grant & California from the south-east: Sing Fat's
  yellow tiers and spire, Sing Chong's green-and-red tower behind it, Old St. Mary's brick nave, slate roof, clock tower
  with pinnacles and cross, the lantern strings up Grant Ave), `a-cluster-walk-dpr3.jpg` (dpr 3, quality mid: the
  player's own camera walking up Grant Ave at California St, the three corners in view), `a-exchange-desk.jpg` (the
  exchange's three green-tiled tiers, red walls and red columns on Washington St). Scratch: `bv-a1/`, `bv-a2/`, `bv-a3/`.

### Decisions

- **The cluster lives in the gate's site meshes, not in the corner's.** The corner mesh (`cornerKit`) is drawn only
  within `CORNER_CULL` 140 u, while the exclusions drop the city boxes everywhere: beyond 140 u the lots would stand
  empty. The site's lod 0 is drawn to 340 u (170 u from a high camera) and its lod 2 is in the far pool, so the
  buildings never vanish; both are meshes the gate already had (0 new meshes, 0 new programs).
- **Heights**: storeys count from each building's street point (`ref`), the walls start 1.2 u under its lowest ground
  (the city rule would start them from the lowest corner, which made Old St. Mary's 2.5 u high on its uphill corner).
  Sing Chong 16 m (OSM) → 5.0 u walls + a 3 u tower; Sing Fat 4 storeys → 5.4 u + its 3.4 u tower; Old St. Mary's ≈ 27 m
  → the tower top at buildingH(27); the exchange three tiers ≈ 4.6 u (its neighbours are taller, as in the photos).
- **Which corner is which**: Sing Fat SW (573 Grant), Sing Chong NW (601 Grant) — a Sing Fat Co. postcard says "S.W.
  corner California St. and Grant Ave."; the yellow three-tier tower is Sing Fat's (the photo taken from the NE corner
  with California St rising west on its right), the green-and-red one Sing Chong's (the photo with Old St. Mary's tower
  to its right). Old St. Mary's façade faces south (Wikipedia), so the tower stands on California St.
- **The exchange takes the whole merged lot** (854 Grant's corner and the exchange were one published box, its Grant
  front pushed back to across 1.8 by the city's carve): the pagoda stands at Grant & Washington's south-east corner, about
  one narrow lot west of where OSM puts 743 Washington.
- **No lettering anywhere** (the inscription panel is blank, the signs are the corner's generic atlas words).

### Facts (checked on the web 2026-09-30)

- Sing Fat SW / Sing Chong NW of Grant & California, 1907–08, Ross & Burgren, for Tong Bong and Look Tin Eli —
  https://en.wikipedia.org/wiki/Look_Tin_Eli , https://commons.wikimedia.org/wiki/File:SING_FAT_CO_LEADING_CHINESE_BAZAAR_S.W._CORNER_CALFORNIA_ST._AND_GRANT_AVE._CHINATOWN._SAN_FRANCISCO_CALIFORNIA_(23603860561).jpg ,
  https://www.gpsmycity.com/attractions/sing-chong-building-52276.html ; colours from Wikimedia Commons photos
  (`File:Sing_Chong_Building.jpg`, `File:601_Grant_Avenue_at_California_Street.jpg`), reference only, in scratch.
- Old St. Mary's: 660 California St at Grant Ave, 1854, red brick and granite, Gothic Revival, ≈ 27 m, the façade faces
  south, the clock and its inscription — https://en.wikipedia.org/wiki/Old_St._Mary%27s_Cathedral
- Chinese Telephone Exchange: 743 Washington St, 1909, a three-tiered pagoda, upturned corners, sturdy pillars in front,
  restored by the Bank of Canton from 1960 — https://www.kqed.org/arts/13960573/chinese-telephone-exchange-san-francisco-chinatown-history ,
  https://hoodline.com/2016/04/plugged-in-the-fascinating-history-of-the-chinese-telephone-exchange/ ; photo
  `File:Telephone_Exchange_(5402029672).jpg` (red columns, green tiles), reference only.
- Footprints / heights: OSM ways 260519113 (h 16), 260519114 (615–625 Grant, h 16), 260208816 (717 California, 4
  levels), 260208813 (505–545 Grant, h 7), 260520154 (Old Saint Mary's Cathedral, h 19), 260520161 (660 California,
  h 16), 251790077 (East West Bank, 743 Washington), node 2579643653 — the raw snapshot of 2026-09-26.

### Known gaps

- Sing Chong's real tower has two pagoda roofs over its stage; the toy has three (it reads better at toy scale).
- The church's east windows are behind the parish hall (not drawn); the inscription is a blank panel.
- The `old-st-marys-cathedral` trip end stays where the scouting put it (Grant Ave's roadway by the church; CORRIDOR).

### Not done (this part)

- Nothing of item (1)'s scope.

### Checks at the push (part a)

- This tree before the rebase: `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (50 old warnings) ·
  suite `tests/opus-bay-*.test.ts` **1670 / 1670**. After the rebases (lanes A, S, P, Q, K, X, then M, H, W2): tsc 0 and
  the incoming lanes' test files with this lane's 164 / 164, then 14 / 14. Pushed `814073eb`.

## Part b · W8-W12 the SS Jeremiah O'Brien at Pier 35, her arrival, and BAYBAY's sight lines

Started 20:42 PDT (`date`), on `814073eb`.

### What was built

- **`src/opus-bay/world/sf/wharfShips.ts`**: the Wharf's museum ships are now one TOY mesh with both hulls (the LOD at
  `SHIPS_MID`, halfway between them; `SHIP_CULL` 180 → 245, `SHIP_BUILD` 250 → 310: each ship is still drawn from ≥ 180 u
  of itself; 612 triangles in all, budget 1,500). **SS Jeremiah O'Brien** (`OBRIEN`, 408 triangles): in the water along
  the toy Pier 35's west face (`data/district.ts` pier35: the deck's root corner (−120.16, −13.17), the face running
  (−0.811, −0.585) out into the Bay), 0.4 u off it, the stern at the seawall end, 18.8 × 2.4 u (441 ft 6 in × 57 ft at
  K 0.14): the haze-grey hull with a dark-red boot topping, the raised forecastle and poop, five hatches, the midship
  house (two decks, the bridge with windows lit at night, lit side windows), the funnel with its black top, three masts
  with crosstrees and a cargo boom each, a masthead light; no guns, no lettering, no flags. `buildShipBatch(id)` for the
  tests; `PIER35_WEST`, `OBRIEN_MID`, `SHIPS_MID` exported.
- **`data/sf/attractions.ts`** (my row): `ARRIVAL_OVERRIDES['ss-jeremiah-obrien']` (−148, 1) heading 2.46 — the
  promenade by the seawall west of Pier 35, the ship 26 u ahead across the water.
- **`src/opus-bay/world/sf/cornersSights.ts`** (new, registered in `world/sf/cityWorld.ts`, 2 lines + detach): BAYBAY's
  three sight lines (`W8_W1_LINES`), each said once per session when the player walks into its circle, through her pacer
  (`game/cityContent.ts baybayLine`, ttl 15 s: it waits for the line she is saying and drops this one rather than say it
  late; lane K's overlay hold applies); the circles stand ≥ r + 1 u from every attraction's trip end, so an arrival bark
  and a sight line never meet at one spot. A world system (no mesh), one comparison every 0.4 s.
- **Surgical, outside the row** (named): `tests/opus-bay-sf-attractions.test.ts` P2 — the 3 u rule is waived for
  `ss-jeremiah-obrien` (10 u; the reason in a comment: the nodes beside the promenade run under the Embarcadero roadway
  and do not stand); `tests/opus-bay-w7-w1-ships.test.ts` (this lane's wave-7 test) — the Pampanito's box from its own
  batch, the pier45 spot against the LOD's new centre.
- **Tests** — new `tests/opus-bay-w8-w1-obrien.test.ts` (3): the O'Brien's length, ≤ 700 triangles, keel under the water
  and masts ≤ 5.4 u over it, both ships within budget, parallel to the pier's west face and ≥ 0.3 u off its deck at every
  sampled hull point, the LOD reaching both the ship and her promenade; in city mode every sampled hull point is water and
  not standable, the stern within 3 u of the promenade, the trip end standable, its nearest main-graph node standing and a
  nav path from it reaching the end (the sweep's own rule), the ship < 30 u ahead within 25° of the heading; the sight
  lines (fixed zh + en, ≤ 45 / 110 characters, no template, a source each, clear of every trip end, each said once and in
  order by the system).

### Evidence

- Static sweep on this tree (`sweep-static.mts`): **699 targets · ok 549 · CORRIDOR 150 · BOXED 0 · SNAG 0 ·
  UNREACHABLE 0 · OFF 0** — `trip:ss-jeremiah-obrien` is **ok** (4 ways). (A first spot at (−147.5, −2) by the seawall's
  corner was reachable but a CORRIDOR — water and the seawall on two sides; moved 3 u in.) The 5 targets more than
  part a's 694 are other lanes' (the rebase).
- Calls / triangles (budget-views, 1440 × 900 high golden; read, not fps): over the promenade at the ship 74 / 191.0k ·
  from the water west of Pier 35 97 / 318.2k · at the trip end 79 / 214.5k · the eye-level view from the trip end 70 /
  193.1k (the ships' mesh is one call where either ship is in view). perf-chinatown on the rebased tree 124 / 296.3k.
- Played (HUD on, the goals step answered "I'll wander"; every shot read): walking into the O'Brien circle — BAYBAY's
  bubble "In 1994 this Liberty ship steamed back to Normandy for D-Day's 50th anniversary!" with the ship along Pier 35
  behind it and the discovery toast "+1 · SS Jeremiah O'Brien" (`qa/w8/W1/b-obrien-sight-line.jpg`); from the trip end at
  eye height the whole ship broadside across the water against Pier 35's shed (`b-obrien-from-arrival.jpg`); from the
  water (`b-obrien-water.jpg`: house, funnel, masts, hatches, boot topping); walking up Grant Ave north of the Dragon
  Gate — "Look up the street! At the corner, the yellow roofs are Sing Fat and the green ones Sing Chong." with the
  yellow tiers up the street (`b-pagoda-sight-line.jpg`).

### New fixed BAYBAY lines (for lane X; `world/sf/cornersSights.ts` `W8_W1_LINES`, said through `baybayLine`, matched by text)

| id | zh | en | source (checked 2026-09-30) |
|---|---|---|---|
| `w8w1-pagodas-ahead` | 往上看！路口那两座宝塔楼，黄顶的是 Sing Fat，绿顶的是 Sing Chong。 | Look up the street! At the corner, the yellow roofs are Sing Fat and the green ones Sing Chong. | https://en.wikipedia.org/wiki/Look_Tin_Eli |
| `w8w1-st-marys-bells` | 1906 年的大火把教堂里的钟都烧化了，砖墙和钟楼却挺了过来。 | The 1906 fire melted the church bells, but the brick walls and the clock tower held. | https://en.wikipedia.org/wiki/Old_St._Mary%27s_Cathedral |
| `w8w1-obrien-normandy` | 这艘自由轮 1994 年还自己开回诺曼底，参加了登陆 50 周年纪念！ | In 1994 this Liberty ship steamed back to Normandy for D-Day's 50th anniversary! | https://en.wikipedia.org/wiki/SS_Jeremiah_O%27Brien |

### Decisions

- **The waiver, not a graph edge.** The walking graph is published data (core/walkGraph.ts is frozen; no runtime way to
  add an edge), and the apron by Pier 35 is reachable on foot — only the graph's own nodes there stand under the
  Embarcadero roadway (`nav.ts graphNodeFilter` already skips them in the game's own routing). So the trip ends where
  the game's router and the sweep both start from a standing node (992 at the Embarcadero / North Point crossing, the
  official page's "near the intersection of Kearny St, North Point St and The Embarcadero"), 9.8 u from it, with the 3 u
  rule waived for this row and the reason written in the test.
- **The ship along the toy pier, not on OSM's hull.** OSM's hull (way 1280748838) lies on the district's promenade (the
  hand-made seawall is wider than OSM's), so the toy keeps the berth's relation — alongside Pier 35's north-west face by
  its shore end — in the toy's own water.
- **One mesh for both museum ships**: where the Pampanito was drawn the O'Brien costs no call.
- **Sight lines say a fact the place card does not** (the bark and summary already say "a WWII Liberty ship, now at Pier
  35", "the first Chinatown buildings rebuilt"): Normandy 1994, the bells in the 1906 fire, which tower is which.

### Facts (checked on the web 2026-09-30)

- Berth: "Located on the North end of Pier 35, near the intersection of Kearny St, North Point St and The Embarcadero",
  open daily 10:00–16:00 — https://ssjeremiahobrien.org/visit-us/
- Liberty ship (EC2-S-C1), launched 19 June 1943, New England Shipbuilding Corp., South Portland, Maine; ≈ 441 ft × 57
  ft; returned to Normandy in 1994 for the 50th anniversary of D-Day — https://en.wikipedia.org/wiki/SS_Jeremiah_O%27Brien ,
  https://www.asme.org/about-asme/engineering-history/landmarks/98-ss-jeremiah-o-brien ,
  https://www.nps.gov/parkhistory/online_books/butowsky1/jeremiahobrien.htm
- Old St. Mary's: the fire after the 1906 quake "melted the church bells and marble altar"; the brick walls and the bell
  tower survived — https://en.wikipedia.org/wiki/Old_St._Mary%27s_Cathedral

### Known gaps

- The O'Brien is not boardable (a museum ship: the card links the official page).
- From the trip end the QA harness's `faceCameraToward` left the walking camera facing the Bay once; the arrival's
  heading faces the ship, and from there she is broadside in view (the eye-level shot).
- The ship's colours are a toy haze grey; no photo-matched paint scheme.

### Not done (this part)

- Nothing of item (2)'s scope.
