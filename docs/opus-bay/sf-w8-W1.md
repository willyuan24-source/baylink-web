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
6. 北滩的哥伦布大道终于有了柏油路面和中间的白色虚线（以前那一段是一片人行道，看不出是条街）；步行路线 1 的两个拐点挪到路口，
   全城扫描里又少了两个“窄道”。渔人码头的舵轮招牌看过，颜色是对的，没改。

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
  (`File:Sing_Chong_Building.jpg`: the three-storey buff building with the green-and-red tower, Old St. Mary's to its
  right; `File:601_Grant_Avenue_at_California_Street.jpg`: the four-storey yellow-brick building with green bands and the
  yellow three-tier tower — despite its file name the four storeys and the green bands are Sing Fat's), reference only,
  in scratch. A web search on 2026-09-30 (re-checked at 23:05, a search summary, its page not pinned) describes Sing
  Fat's façades as yellow pressed brick with green glazed terra-cotta strips at the corners and cornices, which the toy
  follows; Sing Fat's 1908 date and architect (T. Paterson Ross of Ross & Burgren, 573 Grant Ave) —
  https://www.flickr.com/photos/mateox/35052646581 .
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

- The towers' proportions and tier counts are read off a few photos (toy approximations, not measured drawings).
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

### Checks at the push (part b)

- This tree before the rebase: tsc 0 · `npx eslint .` 0 errors (50 old warnings) · suite **1728 / 1730**: `E2-5 view
  field in the city` (sf-move2) and `city mode: local A* window leaves the hero through the Ferry crosswalk` (sf-nav, its
  window-build wall clock) failed under the machine's load and pass alone (32 / 32). After the rebases (lanes A, X, H,
  S, K, then H, P, A): tsc 0 and the incoming lanes' test files with this lane's 114 / 114, 26 / 26, 11 / 11. Pushed
  `fefd7b46`.

## Part c · W8-W13 North Beach leftovers (Columbus Ave's asphalt, r1's corridors), the Wharf wheel, Beach St

Started 21:50 PDT (`date`), on `fefd7b46`.

### What was built

- **`src/opus-bay/world/sf/cornersNorthBeach.ts`**: `NB_ROAD` / `nbColumbusRoad()` / `columbusRoad()` — Columbus Ave's
  carriageway painted inside the hero slab (the district has no Columbus: its ground there was pavement, so the street
  the café fronts line read as a plaza; sf-w6-W.md Known gaps): a toy asphalt ribbon (the district's own road colour) on
  `NB_COLUMBUS`, sampled every 1 u, draped on the walked ground (+0.04 u), half-width 1.05 u, a dashed centre line; only
  inside `DISTRICT.slab` (the city draws Columbus outside it: one run from the slab's edge at (−79, 113) to Kearny St at
  (29.3, 104)); where Columbus cuts Washington Square's corner the lawn side narrows (≥ 0.45 u) so no asphalt lies on the
  lawn. In the corner's existing TOY mesh (no new mesh); the corner is 8,568 triangles (budget 9,000). Paint only:
  walking, the walk raster and traffic are unchanged.
- **`data/sf/routes.ts`** (surgical, named): route r1's `r1-washington-sq` via 1 (4.3, 120.6) → **(2, 119)** and via 3
  (−31.3, 95.8) → **(−34.1, 93.8)**: both stood mid-street since the W6-W1 seam fill (two ways open); they now stand on
  the junctions the generated walk already turns at — `scripts/opus-sf/assets/routes-build.ts` re-run:
  `data/sf/routePaths.ts` comes out byte-identical. `tests/opus-bay-w5-landmarks.test.ts` (surgical): the two entries
  leave `ROUTE_CORRIDORS` (the route sweep now asks 3 ways of them, and they have them).
- **Tests** — new `tests/opus-bay-w8-w1-northbeach.test.ts` (2): one continuous run of ≥ 100 samples, every edge point
  inside the slab and off the lawn, half-widths 0.45–1.05, every café cluster ≥ 0.4 u and every pole ≥ 0.5 u off the
  asphalt's edge, the corner within its budget; r1's via points on corners of the generated walk (< 0.25 u).

### Evidence

- Static sweep on this tree: 699 targets · **ok 551** · CORRIDOR 148 · BOXED 0 · SNAG 0 · UNREACHABLE 0 —
  `route:r1-washington-sq:via1` and `:via3` CORRIDOR → **ok**.
- Calls / triangles (read, not fps): over Columbus Ave 107 / 335.6k, walking down it 99 / 343.7k (desktop high golden);
  phone dpr 3 mid walking down it **80 / 245.6k**; the square's corner 73 / 241.6k.
- Shots (read): `qa/w8/W1/c-columbus-desk.jpg` (the diagonal street with its dashed centre line between the café fronts,
  umbrellas on the sidewalk), `c-columbus-phone.jpg` (390 × 844 dpr 3: walking down Columbus past a café table and the
  tricolour poles, the dashes ahead), `c-wharf-wheel-desk.jpg` (the wheel from Jefferson St).

### Decisions

- **The church steps stay a corridor** (`route:r1-peter-paul`, `trip:saints-peter-and-paul-church`, (−76.1, 100.1)):
  the nave is behind and the towers' feet beside, by design (W6); 1.7 u out — where 3 ways would open — is the middle of
  the district's Filbert St roadway (`street-filbert-0`, 3.2 u wide, 0.16 u from its centreline), a driven lane. Not moved.
- **The asphalt is paint**: the district's walk / drive data are frozen (district mode never changes) and the city's
  traffic does not enter the slab; a narrower 2.1 u carriageway keeps the café tables (their nearest edge ≥ 1.15 u off
  the centreline) on the sidewalk without moving them.
- **The Wharf wheel's cream band reads right** (dark varnished rim, the cream lettering band and face with two thin dark
  rings, the red crab, the pilings with rope above the rim — wave 7's lane R fix): no change.
- **Ghirardelli Square / Beach St west of Hyde stay outside 渔人码头**: the zone names are lane K's `data/cityZones.ts`,
  and wave 7's call (Wikipedia's first definition ends at Hyde St; sf-w7-K.md) stands; nothing of this lane's models
  depends on it. No change.

### Known gaps

- Columbus Ave inside the slab carries no toy traffic (the district's traffic runs on its own streets).
- Where Columbus runs along the slab's edge (x −91 … −79) the city draws the street's outer half and this ribbon its
  inner half: from above, two dashed lines side by side for ≈ 12 u (`W8-W14`).

### Not done (this part)

- Nothing else of items (3)–(4).

### Checks at the push (part c)

- This tree before the rebase: tsc 0 (after typing the ribbon's lift parameter: `y: number = lift`; the `as const`
  literal had made it `0.04`) · `npx eslint .` 0 errors (50 old warnings) · suite **1755 / 1756**: sf-terrain's
  "city-mode queries stay O(1): 200k canStand + heightAt < 1.5 s" (wall clock) failed under load and passes alone. After
  the rebases (lanes A, H, W2, S, Q, K, M, then K, H, Q, A): tsc 0 and the incoming lanes' test files with this lane's
  104 / 104, 4 / 4, then lanes A / K / H 26 / 26. Pushed `5e1ff378`.

## Part d · W8-W14 Columbus Ave to the slab's edge; checks on the pushed tree

Started 22:50 PDT.

- **`world/sf/cornersNorthBeach.ts`**: the ribbon's outer side narrows to the slab's edge (down to 0) instead of the
  run stopping 12 u short of it: one run of 121 samples from (−90.9, 113.9) — where the city's own Columbus Ave begins
  — to Kearny St (8,602 triangles, budget 9,000). The lawn rule is unchanged (the lawn side narrows to ≥ 0.45 u and no
  edge point lies on the lawn). `tests/opus-bay-w8-w1-northbeach.test.ts`: ≥ 115 samples, the run starting within 1 u of
  the edge, half-widths 0 … 1.05 with ≥ 0.9 between them. Shot (read): the street continuing across the seam
  (`C:/Users/willy/opus-qa/w8/w1/nb-columbus-edge.jpg`, scratch).
- Checks (this tree, before the last rebase): `npx eslint .` 0 errors (50 old warnings) · suite **1788 / 1788** · tsc 0
  after typing `let w: number = h` (the `as const` half-width had made it the literal `1.05`).
- **Night** (budget-views `--time night`, read): Grant & California 109 calls / 230.8k — the shop windows and the
  walk-ups' windows lit, the clock face glowing, the lantern strings; the O'Brien from the promenade 70 / 172.6k (a
  dark hull against Pier 35's lit windows).
- **The perf spots on the pushed tree** (`5e1ff378` + lanes up to `fff82f23`; 1440 × 900 high golden; read, not fps):

  | spot | calls / triangles | this lane's share |
  |---|---|---|
  | perf-chinatown | 124 / 291.6k | city.landmarks 12 calls (the gate's meshes, no new one) |
  | fidi | 103 / 275.5k | — |
  | ferry · perf-ferry | 70 / 227.0k · 69 / 228.0k | — |
  | pier45 (the Musée Mécanique door, facing the berth) | **124 / 367.6k** | `sf:wharf-ships` 1 / 0.6k |
  | Pier 39's gate → Pier 35 | 90 / 261.5k | `sf:wharf-ships` 1 / 0.6k |

  pier45 was 81–91 / 180–191k in wave 7: the growth is `life` 11 / 86k, `hero.buildings` 5 / 65k, `actors` 13 / 32k,
  `streetcars` 11 / 23k — not this lane's (Requests).

## Wrap-up

### Commits on `origin/opus-bay`

- `814073eb` W8-W11 — Chinatown's pagoda cluster in the Dragon Gate's own meshes (+ `excludeMore`, the exchange's trip end).
- `fefd7b46` W8-W12 — the SS Jeremiah O'Brien at Pier 35, her reachable trip end, BAYBAY's three sight lines.
- `5e1ff378` W8-W13 — Columbus Ave's asphalt inside the slab; r1's via 1 / via 3 onto junctions.
- W8-W14 — Columbus Ave to the slab's edge; this wrap-up (the last push).

Higgsfield: **0 credits** spent (no texture or decal beat the procedural look at toy scale in the time; the cap was 40).

### Not done

- The church steps' corridor (`r1-peter-paul`, `trip:saints-peter-and-paul-church`): by design (part c Decisions).
- A walking-graph edge along the Pier 35 promenade (the graph is published data, `core/walkGraph.ts` frozen): the
  O'Brien's trip end uses a recorded 3 u waiver instead.
- `old-st-marys-cathedral`'s trip end stays on Grant Ave's roadway beside the church (CORRIDOR since wave 4).

### Requests

- **Lane X**: voice the three fixed lines of `world/sf/cornersSights.ts` `W8_W1_LINES` (`w8w1-pagodas-ahead`,
  `w8w1-st-marys-bells`, `w8w1-obrien-normandy`; zh + en in part b's table), said through `baybayLine` (matched by text).
- **W8-Z / the lead**: the pier45 perf spot reads 124 calls / 367.6k triangles on the pushed tree (wave 7: ≈ 91 / 191k);
  the wharf ships are 1 call / 0.6k of it — the rest is `life` (86k), `hero.buildings` (65k), actors and streetcars:
  please include pier45 in the final verify's phone walk.
- **The lead (a later wave)**: a runtime walking-graph extension (or a re-published graph) with an edge along the
  district's Pier 35 promenade apron, so the O'Brien's trip end can stand by her stern and the 3 u waiver can go.

### Where a reviewer should look first

1. Grant & California from the south-east and walking up Grant Ave from the Dragon Gate (the pagoda towers, Old St.
   Mary's clock tower, the sight line), phone and desktop; the Telephone Exchange on Washington St.
2. `world/sf/sites.ts` `excludes()` / `walkInputs()` (the `<site>+<k>` rows after the sites') and the gate's
   `fade.procedural: false`.
3. The O'Brien: her trip end on the promenade (−148, 1), the hull in the water along Pier 35, the sight line at her stern.
4. Columbus Ave in North Beach (the asphalt between the café fronts, the lawn corner, the slab's edge).


## Review (Ultra)

Fixer of the adversarial review (two read-only lenses: code & facts, player), 2026-10-01 00:24–01:20 PDT, worktree
`C:/Users/willy/wt/w8-w1-rev`, scratch `C:/Users/willy/opus-qa/w8/w1-rev/`.

### 给主人的摘要

1. 奥布莱恩号的终点挪到了船尾旁的码头步道上（离船身中部约 11 格，原来在 39 号码头大门口，离船 26 格）。走过去、跟 BAYBAY 去，现在都会停在船边，也会记下“到过”。原来走到船边也不算到达，这个问题已经修好。电脑上船就在画面右侧。手机竖屏画面窄，船刚好在右边缘，要转一下镜头才能看全（留给下一波）。
2. BAYBAY 的三句新台词现在只在步行、骑车或坐着时说，滑翔、开车、坐车时都不说。“1994 年开回诺曼底”这句挪到了 35 号码头仓库的拐角，而且要面朝船才说。实际玩了一遍：这句话在船尾说出，船就在画面右边。
3. 全城静态扫描的“走得到”判定原来比游戏本身更严，现在和游戏的寻路规则一致。699 个目标里有 0 个走不到、0 个卡住，其余结果和改之前完全一样。
4. 电话局的位置核对过了，就在 OSM 标的 743 号上，那条意见不成立。哥伦布大道柏油路有一小段压在一栋办公楼的墙角下面，但被楼挡住看不见，这次没有改，已经记下来留给以后。
5. 没有挡住上线（main）的问题。整套测试 1812 个通过，0 个失败（另有 1 个是早就记录的待办项）。

### Findings and verdicts

| id | sev | verdict | what I did / evidence |
|---|---|---|---|
| W1-RC-1 | major | **fixed** | Reproduced: `arrivalAnchors(ATTRACTIONS)` put the O'Brien at (−148, 1). Walking the apron from the east to her stern produced no hit, and the ship's middle was 26.2 u away. Root cause: the static sweep found the nearest graph node of any kind, an unstandable hero node under the Embarcadero roadway, while `actors/nav routeTo` snaps to the nearest *usable* node (`graphNodeFilter`). My script (`cand2.mts`) shows every game route from 6 starts (the Embarcadero, the Dragon Gate, the Wharf, Pier 39, North Beach, SoMa) reaches stern-side ends, and the usable-node reach is 0.00 u. Fix: `ARRIVAL_OVERRIDES['ss-jeremiah-obrien']` is now (−126, −10) with heading −2.61 (toward OBRIEN_MID, 10.9 u; 4.4 u from the stern). `sweep-static.mts` now judges from the nearest usable node. Full sweep: 699 targets, ok 551, CORRIDOR 148, BOXED 0, SNAG 0, UNREACHABLE 0. The totals are the same as before; `trip:ss-jeremiah-obrien` is ok, 3 of 4 ways. Red then green: with the old override the new asserts fail ("the ship 26.2 u away", "the anchor by her stern"). |
| W1-P1 | major | **fixed** (same change) | Reproduced in code: `placeTrips.ts` is the only place that applies `arrival.heading`, and only for fast travel. Played after the fix (dev server, golden hour, start (−100.9, −2.6), "go to SS Jeremiah O'Brien"): a 7.9 s walk ends at (−125.75, −9.99), and the ship lies broadside on the right with Alcatraz ahead (`docs/opus-bay/qa/w8/W1/review-obrien-arrived.jpg`, read). A walker from Pier 39's side arrives with the stern about 36° to the left, 4 u away (computed from the geometry, not played). Every approach now ends beside her, so no approach ends with the ship 26 u behind the player. |
| W1-P2 | minor | **fixed** | Reproduced with the lens's `glide.mts`: on the old tree the line was said while gliding and in a car. On mine both say `[]`. `cornersSights.ts` now speaks only on foot, on a bike or sitting (lane W2's `westPlayer` rule). If the pacer refuses a line (`baybayLine` returns false), the line is not spent and is offered again on the next poll inside the circle. A line the pacer accepts and later drops after its TTL is still spent (the pacer does not report the drop), as before. New test: glide / car / transit / travel say nothing; a refused line is said on the retry, once. |
| W1-P3 | minor | **fixed** | Confirmed from the lens's shot `a3b-t3.jpg` and from geometry: the old circle (−126.5, −9) lies on the walk west, and the bubble lands about 2 s later with Pier 39 ahead. The circle had to move anyway, because the test keeps the circles r+1 from every trip end. It is now at the Pier 35 shed corner (−120, −8.5), r 3, with `face` = OBRIEN_MID within 70° of the player's heading. Played twice. At (−116, −7.5) the line came while the hull was still behind the shed (`b1-walk.jpg`). At the shed corner it plays as the walk rounds it, and the bubble was on screen at the trip end with the ship in frame (`b2-arrived.jpg` = the committed shot). The texts are unchanged, so lane X's voice still matches. |
| W1-RC-2 | minor | **refuted** | OSM today (api.openstreetmap.org, 2026-10-01): way 251790077 is "East West Bank", 743 Washington Street, across 2.26–2.97 / along 66.46–67.17 in Grant's frame. 256080511 is "854;864 Grant Avenue", across 0.91–2.10. 256080517 is "731;733;735 Washington Street", across 4.36–5.65, so it is **not** 743's frontage. The toy exchange spans across 1.84–3.17 (centre 2.5), so it stands on OSM's 743 Washington footprint, within 0.1 u of its centre. The corner shop (854 Grant) is gone because the city's Grant carve puts its front at 1.8 u, which leaves a 0.3 u sliver; the lane recorded this. ReelSF (https://reelsf.com/reelsf/lady-from-shanghai-on-the-lam-chinese-telepho, checked 2026-10-01) says the exchange is "just around the corner from Grant at Washington", with a corner shop beside it. That is the real layout; at toy scale the exchange reads as the corner building. No change. |
| W1-RC-3 | minor | **confirmed, not fixed** | Reproduced (`nbroad.mts`): 5 of 605 ribbon samples, including one centre-line point, lie inside lot-154 (`DISTRICT.blocks[153]`, office h 18.15). City mode draws that block: the drop set is {232, 116, 210}. The ribbon runs *under* an opaque box, so trimming it would change nothing on screen. The visible point is that the district's block corner stands on real Columbus Ave's line, which predates wave 8 (the district never drew Columbus). Fixing that means hiding or cutting lot-154 in city mode and filling the seam (cornersSeamData), which is a wave-9 job. District mode must not change. Recorded as an open item. |

### Own pass (`git log origin/opus-bay --grep "W8-W1[0-9:]"`: 814073eb, fefd7b46, 5e1ff378, 71d09a17)

- **Softlocks**: none found. The new O'Brien end is "ok" (3 of 4 ways). The Telephone Exchange end, r1's two moved
  via points and the cluster's sidewalks pass the sweep (no BOXED / SNAG / UNREACHABLE among the 699 targets).
- **District mode**: the lane's files are city-only (the corners, `sites.ts` excludes / walk inputs, `wharfShips`,
  `cornersSights` registered in `cityWorld.ts`). The hero regression and the district tests pass in the suite.
- **Perf**: as the lane recorded, Chinatown is 123 calls / 299.4k (budget 150 / 400k). The O'Brien adds 0 calls
  (one mesh with the Pampanito). On my played spots the Pier 35 apron read 88–92 calls / 275–280k. I read only
  calls and triangles, no fps.
- **The blocker tops row** (`landmarks/tops.ts` dragon-gate: the exchange 2.4 u): this is LOCAL y above the gate's
  base. The exchange stands down the Washington St hill (ground 2.32), so its world top ≈ 6.8 matches the model. Not a bug.
- **Tonight's date** (Oct 1, Fleet Week ahead): nothing in lane W1 is date-gated. The O'Brien often sails during Fleet
  Week, and the toy keeps her at Pier 35. That is a known simplification, and lane S owns the ship line.
- **The sweep rule change** affects every lane's reading of `sweep-static.mts`: it now judges like the game. The totals
  are unchanged on today's tree (ok 551 / CORRIDOR 148 / 0 / 0 / 0).

### Commits (W8-W1-review)

- `d3459280` the O'Brien's trip end and arrival by her stern; sight lines on foot only, hers while facing the ship; the
  sweep's usable-node rule; tests (W1-RC-1, W1-P1, W1-P2, W1-P3).
- `bdaa6cde` the O'Brien's sight circle at Pier 35's shed corner (played; the committed shot).
- this report.

### Checks

`npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (50 old warnings) · `npx tsx --test
tests/opus-bay-*.test.ts` 1827 tests: 1826 pass, 0 fail, 1 todo (the known W8-P9 GameRoot target), on the pushed tree after the rebase · the tests the rebase brought in (A / H / K / S review, w7-g-polish…) plus
mine 69/69 · the static sweep as above.

### Open items

- W1-RC-3: lot-154's corner stands on Columbus Ave in city mode (a seam job: hide or cut the lot in city mode, fill
  from OSM). For lane W1 or the seam owner in wave 9.
- The pacer can still drop an accepted sight line after its 15 s TTL without telling the caller. It is then spent for
  the session. This is rare (it needs 15 s of other bubbles or panels); fixing it needs a pacer callback (game/cityMoments.ts).
- The P2 waiver in tests/opus-bay-sf-attractions for this row is now 17 u. The lane's request (a graph edge along the
  Pier 35 apron) would let it go back to 3 u.
- **Phone portrait (390×844 dpr 3, quality mid), played after the move**: the walk from the Embarcadero ends at the
  stern, and the Normandy bubble shows at the end. The hull is at the right edge of the narrow frame, with Pier 39 and
  Alcatraz ahead (`docs/opus-bay/qa/w8/W1/review-obrien-arrived-phone.jpg`, read). On desktop she fills the right
  third. A walk ends facing the way it walked, and a tier-3 arrival gets no reveal camera. Turning the camera to
  `arrival.heading` at the end of a walking trip would fix this, but that is a shared trip-end rule (game/tripRun.ts,
  lane G / N). Request for wave 9; not done here.

### Blocking the go-live to main

Nothing.
