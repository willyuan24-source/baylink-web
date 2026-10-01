# Wave 8 · lane W2 · the west side & neighbourhood looks

Lane W2 of wave 8 (`docs/opus-bay/sf-w8-lead.md` §3 row W2, run inside the Ultra workflow `wf_66c65596-f6a`, §7),
worktree `C:/Users/willy/wt/w8-w2`, dev port 5808, scratch `C:/Users/willy/opus-qa/w8/w2/`. Higgsfield cap 60 credits.

## 给主人的摘要

1. **海洋海滩有冲浪的人了**：白天海里有 11 个玩具冲浪手（凯利湾 4 个、Judah 街 N 线终点站前 7 个），坐在板上随浪起伏等浪、划水、站起来冲一段、再划回去；前面一道道白浪滚上沙滩。天黑他们就回家了。只是风景，不是玩家能玩的项目（游戏从不建议下海）。
2. **悬崖屋外的海豹岩**：按 OpenStreetMap 的真实位置摆了两座礁石（大的一座约 5 米高的玩具尺寸），顶上被鸬鹚鸟粪染白，下面平台上躺着海狮、水里有海狮探头、顶上站着鸬鹚、海鸥绕着飞。第一版的礁石像"企鹅脸"（圆白顶 + 两只鸟像眼睛），已经改成尖尖的岩峰。
3. 整个海边只多 **1 次绘制**、约 1.2 万三角形，离开海边 420 米就不画。BAYBAY 在海滩 / 悬崖屋边会说 5 句新台词（中英固定句，可配音）。
4. **金门公园蓝鹭湖（原斯托湖）**：白天湖上有 9 条玩具脚踏船和划艇在宽的湖湾里慢慢绕圈（划艇的桨会摆），船屋码头停着 3 条船，还有鸭子和一只站在岛边的大蓝鹭。原来船屋那里是一栋普通红顶两层楼，现在换成了真实样子的长条木屋（大斜屋顶、临湖的入口山墙、木平台、台阶下到水边的浮码头）。可以租船自己划：没做（成本高、湖道太窄容易撞岸），BAYBAY 有 3 句新台词。
5. **圣依纳爵教堂**：照着真实照片，把两座塔顶的小圆顶和中间的大穹顶改成深铅灰色（以前是奶油色），十字架和塔身不变，不多绘制。
6. 没做完：海特街壁画/彩绘房子（时间不够，留给下一波）、大通中心升级、de Young 塔的扭转方向核对；Higgsfield 一分没花。

## Part a · W8-W2a Ocean Beach's surfers and Seal Rocks

Started 19:24 PDT (`date`; the first agent of this lane had worked 19:00–19:20 and left the work uncommitted: kept,
finished and tested here). Pushed 20:34 PDT (`4242a07a` on `origin/opus-bay`).

### What was built

- **`src/opus-bay/world/sf/westSeaPose.ts`** (new, pure data + the pose writer, node-tested):
  - `OB_SHORE` — Ocean Beach's waterline from Point Lobos south past Lawton St (16 world points, the first water along
    the beach's seaward normal on the published far map, sampled every 0.0015° of latitude; the first agent's scratch
    `osm/shoreline.mts`), `shoreAt(s)` / `seaPoint(s, d)` (arc length along it, the seaward normal).
  - **Seal Rocks** on OSM ways 969197372 / 969197373 (`place=islet`, `ele` 23; the project's snapshot
    `opus-qa/sf-data/raw/osm-landcover.json`): the published map has no land there, so the stacks are drawn at sea.
    Each islet is a tall leaning crag on flat ledges with shoulders and loose boulders (16 ellipsoids), the big stack's
    crag 5.4 u over the sea, the inshore one 3.6 u (OSM's 23 m by the landmark rule H = 3.2 + 0.155·h ≈ 6.8 u, a bit
    under it so the Cliff House's block still leads the terrace view). **Guano** = five "skins": the crag's own
    ellipsoid a little narrower, raised and nudged to one side, so only its upper slopes show white with an uneven lower
    edge. `rockTop(x, z)` is an exact vertical ray against every tilted ellipsoid (precomputed inverse matrices); the
    7 hauled-out sea lions (body + a head that lifts now and then), 10 cormorants (offsets from the summits, on slopes
    < 0.9), 3 swimming heads and 4 wheeling gulls stand on it; their heights are measured once (`SEA_LION_Y`,
    `CORMORANT_Y`).
  - **Surfers** — 11 (4 at Kelly's Cove, 7 off Judah / Lawton St), a 36 s cycle (wait 18 s sitting on the swell facing
    the sea, catch 3 s, ride 5 s standing in ≈ 6.5 u with a spray puff behind, paddle back 10 s), phased; the board
    bobs and pitches on `swellY`. **The break**: 3 breaks × 3 crests of 5 long thin overlapping white-water clumps that
    roll in from 10 u and thin out on the wash at 2.5 u, plus a pulsing wash on the sand.
  - `poseWestSea(sink, t, night)` writes every moving instance with no allocation (indexed loops, `surfState(f, t,
    out)` into a scratch object) and returns the count: the surfers are the last block, left out when the sky's night
    factor > 0.35.
- **`src/opus-bay/world/sf/westSea.ts`** (new): the city `WorldSystem` `attachWestSea()` — ONE `InstancedMesh`
  (`sf:west-sea`, capacity 150) of `rockBall()` (the toy unit ball with a fixed sideways vertex jitter of ± 9 % and flat
  facets: lumpy rock faces; the poles stay put, so `rockTop` is where the summits are) on the instanced toy program
  (`ob-toy-inst`: no new program).
- **`src/opus-bay/world/sf/westToy.ts`** (new): `play/toyMesh`'s instanced-toy recipe for world systems
  (`westToyMaterial(kind)`, `registerWestWarmup(kind)`, `westBall(jitter)`): nothing outside `play/` may import `play/`
  statically (the W5-A1 chunk guard; the first draft did and went red in the full suite). Built the first
  time the camera comes within `WEST_RANGE` 420 u of the waterline or the rocks, drawn only within it (a coarse range
  test every 0.2 s), no shadows, no collision.
- **`src/opus-bay/world/sf/westLines.ts`** (new): BAYBAY's five fixed lines (below) and three spots (Kelly's Cove, Judah,
  Seal Rocks); `westLineDue()` says the first unsaid line of a spot on entering it (15 u hysteresis), on foot / cycling /
  sitting (not on a ride), the surf spots by day only; through `game/cityContent baybayLine` (her pacer: it holds while
  a panel is open — lane K's W8-K1), each line once a session.
- **`src/opus-bay/world/sf/cityWorld.ts`** (registration, 3 lines): `host.addSystem(attachWestSea())` and its detach.
- **`tests/opus-bay-w8-w2-westsea.test.ts`** (new, 6 tests): capacity / count by day and night, every instance painted,
  finite matrices; the rock ball keeps its poles and stays closed; the stacks on the two OSM islets 15–45 u off the
  Cliff House, birds high on near-flat tops, sea lions low on near-flat ledges, no two birds side by side; the surf cycle
  continuous (no pop at the wrap) and never inside the wash; **every surfer's waiting / ride-end point and the wash are
  water and the sand behind it is land on the published city** (`sfDisk`); the lines (fixed zh ≤ 45 + en, no template,
  no Han in English) and the spot logic (on foot, once, hysteresis, quiet surf at night, the rocks still speak).

### Evidence

- Shots (desktop 1440 × 900 high, day; `scripts/opus-sf/qa/budget-views.mjs --add`): `qa/w8/W2/a-kelly-walk.jpg` (on the
  sand at Kelly's Cove: the surfers on the break, the crest lines, Seal Rocks white-topped off the Cliff House),
  `qa/w8/W2/a-seal-close.jpg` (the stacks close: crags, white tops, sea lions on the ledges, cormorants on the summits).
  The first try (`opus-qa/w8/w2/sea3/seal-close.jpg`, the first agent's) read as two penguin faces: a round white dome
  with two dark birds as eyes and a sea lion as a beak — fixed by the crag shapes, the skins and the bird placement.
- Calls / triangles (desktop high, day; main + shadow): Judah walk 47 / 113.9k · Kelly's Cove walk 62 / 101.1k · the
  Cliff House terrace 52 / 96.5k · Seal Rocks close 38 / 67.1k — `sf:west-sea` is 1 call / ≈ 12k triangles in each
  (budget ≤ 150 / 400k). The Ocean Beach perf spot before / after: part c's perf table.
- Quality mid at dpr 3 (960 × 600 CSS px; the 390 × 844 portrait pass is in part c's perf table): Kelly's Cove 55 /
  95.2k, the terrace 48 / 85.9k; the surfers, the crest lines and the white-topped rocks read at that size too.
- Checks (20:25 PDT, on `origin/opus-bay` 64cdf803 + this part): `tsc` 0 · `eslint .` 0 errors (50 old warnings) ·
  the opus-bay suite **1688 / 1689** with the first draft — the 1 red was W5-A1's "nothing of play/ statically outside
  play/" (the draft imported `play/toyMesh`) → `westToy.ts`; W5-A1 and the six W8-W2 tests re-run green.

### Decisions

- The surfers are scenery only (the brief): no prompt, no card, no line that invites the player into the water.
- BAYBAY speaks while walking, cycling or sitting (the Great Highway is a bike route), not on a ride; the rocks' lines
  also at night (the rocks are drawn at night; the surfers are not).
- The rocks are a little under the landmark height rule (5.4 / 3.6 u for 6.8 u): at the rule's height the big stack
  out-tops the Cliff House's block from the terrace.
- One shared rock geometry for everything (heads, boards, foam are jittered too, invisibly at their size): one call.

### Facts (checked on the web 2026-09-30)

- Seal Rocks: "a group of small rock formation islands" off the Cliff House; Steller's and California sea lions —
  https://en.wikipedia.org/wiki/Seal_Rocks_(San_Francisco)
- Brandt's cormorants "nest at Lobos Rocks and Seal Rocks along Land's End … turning the rocks bright white with their
  strong-smelling guano" — https://www.nps.gov/goga/learn/nature/birds.htm
- Ocean Beach: "strong, dangerous currents and powerful waves"; "In the 1940s, surfing first began at Kelly's Cove (a
  section of the beach that is south of the Cliff House)"; cold water (upwelling) —
  https://en.wikipedia.org/wiki/Ocean_Beach,_San_Francisco
- OSM ways 969197372 / 969197373 ("Seal Rocks", `place=islet`, `ele` 23) — https://www.openstreetmap.org/way/969197373
  (the project's snapshot of 2026-09-26)

### BAYBAY's new fixed lines (for lane X · voice), zh / en — exact text

| id | zh | en |
|---|---|---|
| `w8-w2-kelly` | 旧金山的冲浪，上世纪四十年代就是从这片凯利湾开始的。 | San Francisco surfing began right here at Kelly's Cove, back in the 1940s. |
| `w8-w2-surf-1` | 看海里！冲浪的人坐在板上等浪呢。 | Look out there — surfers sitting on their boards, waiting for a wave! |
| `w8-w2-surf-2` | 海洋海滩浪大水冷，只有老练的冲浪手才下水。 | Ocean Beach has big waves and cold water — only experienced surfers go out. |
| `w8-w2-seal-1` | 那几块礁石叫海豹岩，海狮会爬上去休息。 | Those rocks are Seal Rocks — sea lions climb up there to rest. |
| `w8-w2-seal-2` | 礁石顶上白白的，是鸬鹚留下的鸟粪！ | See the white on top? That's cormorant guano! |

### Known gaps

- The rocks have no collision (they are at sea; a glider can pass through them).
- The surfers do not react to the player's glider or a boat (none sail there).

## Part b · W8-W2b Blue Heron Lake (Stow Lake): boats, the boathouse

Started 20:35 PDT (`date` 20:34:59 after part a's push); pushed 22:16 PDT (`b5239e3c` on `origin/opus-bay`, after
three rebases onto other lanes' pushes; one conflict in `world/sf/cityWorld.ts`'s registration lines with lane W1's
`attachSights` (W8-W12): resolved keeping both systems, imports and detaches).

### What was built

- **`src/opus-bay/world/sf/westLakePose.ts`** (new, pure data + the pose writer): **9 boats** (5 pedal boats with two
  riders side by side, 4 rowboats with a rower facing aft whose oars sweep on a 2.6 s stroke and a passenger in the
  stern) potter round small circles inside the lake's **six wide basins** — found on the published city's water raster
  (the clearance from each 0.5 u water cell to the nearest non-water cell, scratch `opus-qa/w8/w2/lake/basins.mts`):
  the narrow channels stay empty, so no boat ever meets the vertical banks; two boats sharing a basin sail half a
  turn apart. **3 boats moored** bows-in at the boathouse's landing, **3 ducks** paddling small circles, a **great blue
  heron** on the island's south shore dipping its head now and then. `LAKE_Y` 18.29 = the drawn lake surface (`far.ts`:
  the far ring's lowest shore point − 0.2; read on the `city-lakes` mesh in the browser). The boats are out while the
  sky's night factor ≤ 0.35; the moored boats, the ducks and the heron stay. No allocation per frame.
- **`src/opus-bay/world/sf/westLake.ts`** (new): `attachWestLake()` — ONE `InstancedMesh` (`sf:west-lake`, capacity 93,
  the smooth toy ball, ≤ 7.4k triangles) drawn within 200 u of the lake's centre.
- **`src/opus-bay/world/sf/westBoathouse.ts`** (new): **the Blue Heron Lake Boathouse** as a plain site
  (`blue-heron-boathouse`, T3, like Alcatraz in `W7_SITES`): the city drew a generic two-storey house with a red roof on
  OSM way 120479803; the site's exclusion drops it and draws a long low log lodge (4.0 × 1.5 u on the OSM footprint,
  1.5 u walls under a broad dark green roof, the entrance gable on the lake side with a white gable end, trimmed café
  windows lit at night, plank bands and log-end corner posts), the deck along the bank with its rail, steps down the
  1.6 u bank to a floating landing at the water with mooring posts — where the three moored boats lie. 2 walk blockers
  (the lodge, the entrance bay). No lettering.
- **`src/opus-bay/world/sf/landmarks/index.ts`** (registration, surgical: `W8_SITES = [blueHeronBoathouse]` appended to
  `SF_SITES`); **`landmarks/tops.ts`** regenerated (`scripts/opus-sf/assets/landmark-tops.ts`: one new row);
  **`tests/opus-bay-sf-landmarks.test.ts`** (W4-IL1's expected list gains `W8_SITES`, one line).
- **`world/sf/westToy.ts`**: `attachWestInstanced()` — the lazy-build / range / pose / BAYBAY-spot system now shared by
  the sea and the lake (`westSea.ts` uses it, same behaviour). **`world/sf/westLines.ts`**: the lake's 3 lines and 2
  spots (the lake by day r 48 · the boathouse any time r 14).
- **`tests/opus-bay-w8-w2-lake.test.ts`** (new, 5 tests): counts by day / night; boats sharing a basin > 2.2 u apart,
  bow first, 0.1–0.6 u/s; **every boat's hull outline + 0.3 u is water over its whole circle**, the moored hulls and the
  ducks too, the heron on land with water ahead at its measured ground (sfDisk); `LAKE_Y` = far.ts's rule on the
  published far data; the lines; the boathouse: the OSM outline inside its exclusion, the moored boats outside it,
  lod 0 within T3's 800 triangles, lod 2 ≤ 15 %, the landing's posts down to the water, the ridge 2.2–3.0 u.

### Evidence

- Shots (desktop 1440 × 900 high, day): `qa/w8/W2/b-lake-boats.jpg` (over the lake: pedal boats and rowboats in the
  basins, the heron by the south footbridge, the pavilion), `qa/w8/W2/b-boathouse.jpg` (the lodge's lake side from the
  north shore: the entrance gable, windows, rail, the steps to the landing, three moored boats). Before:
  `opus-qa/w8/w2/lake1/boathouse-cam.jpg` (the generic two-storey house with a red roof).
- Calls / triangles (main + shadow): over the lake 60 / 167.7k (before 59 / 160.5k), the pavilion arrival 70 / 184.0k
  (before 73 / 194.9k: a different moment of the crowd), the boathouse from the north shore 77 / 191.3k, the lake path
  at the boathouse 72 / 198.8k. `sf:west-lake` = 1 call; the boathouse rides the sites' TOY batch.
- Checks: the opus-bay suite on the part-b1 tree (21:00–21:13 PDT): **1711 / 1712** — the 1 red was
  `A* reaches the hill … string-pulled legs` (`opus-bay-actors`, a wall-clock "planned in 414 ms" under load), green
  alone (220 ms). Then the boathouse: sf-landmarks 20/20, the landmark-context tops test, sites-w4 / w4t3, budget,
  models, W8-P: 88 / 88 after the W4-IL1 list fix; the lake test 5 / 5; tsc 0; eslint 0 errors.

### Decisions

- **No rentable boat ride** (the brief: only if cheap and safe): a boat the player steers needs its own controls,
  water collision against vertical banks, the ride card, Settings' pause and a way out at any point — not cheap, and
  the lake's narrow channels would make a toy boat hit the banks often. The boats are scenery; the boathouse is a place
  to look at them from. Not done, recorded.
- Boats circle inside the basins instead of touring the lake: the published lake is a ring ≈ 3–10 u wide with vertical
  banks 1.7 u high; a loop round the island would have to squeeze through 2 u channels.
- The boats' colours are the toy's own (the boathouse's page names "American-Made row and pedal boats", no colours).
- The boathouse is a W8 plain site (no card, no arrival): the lake's card stays the pavilion's (`blue-heron-lake`).

### Facts (checked on the web 2026-09-30)

- The boathouse: "American-Made row and pedal boats" for hourly rentals, "In operation since 1893" —
  https://blueheronboathouse.com/ (stowlakeboathouse.com redirects there); OSM way 120479803 (amenity=boat_rental,
  pedalboat_rental=yes, rowboat_rental=yes, height 6).
- The building: built 1946–1949 by Warren C. Perry, "an alpine chalet style look"; "the first building constructed in
  Golden Gate Park after the end of World War II" — https://en.wikipedia.org/wiki/Blue_Heron_Lake_Boathouse ; a photo
  (Commons File:Stow_Lake_Boathouse.jpg, scratch only): a long low lodge, plank walls, a broad roof with a gable over
  the lake-side entrance, a deck at the water.
- The lake: OSM relation 12908 "Blue Heron Lake", old_name Stow Lake, name:etymology Great Blue Heron.

### BAYBAY's new fixed lines (part b, for lane X), zh / en — exact text

| id | zh | en |
|---|---|---|
| `w8-w2-lake-boats` | 湖上有人踩脚踏船、有人划船，好悠闲。 | People are out on the lake in pedal boats and rowboats — so peaceful. |
| `w8-w2-lake-heron` | 这片湖叫蓝鹭湖。看，岸边就站着一只大蓝鹭！ | It's called Blue Heron Lake — look, there's a great blue heron on the shore! |
| `w8-w2-lake-1893` | 从1893年起，这座船屋就一直租船给游客。 | This boathouse has been renting out boats since 1893. |

### Known gaps

- The lake's banks are vertical 1.7 u walls (the city's lake cut, not this lane's): the landing's steps make the
  boathouse read, the rest of the shore stays as it was.
- The heron and the ducks have no collision; the moored boats are not walkable.

## Part c · W8-W2c St Ignatius's lead cupolas, the perf table

Started 22:16 PDT after part b's push. Last push ≈ 23:30 (see "Final checks").

### What was built

- **St Ignatius's cupolas and dome in lead grey** (`world/sf/landmarks/st-ignatius.ts`; R's realism scorecard #45,
  "maybe", left open by wave 7's lane V because the colour could not be confirmed). A photo from the de Young's Hamon
  tower confirms it: both towers' domed cupolas with their spirelets and the crossing dome are dark lead-grey over the
  cream stone. The shipped AI church (the `sf-st-ignatius` GLB) has them cream, so the swap's remainder now draws
  **`IGN_SHELLS`**: a shell over each tower's domed cupola (from the open lantern's cornice to the cross's foot), one
  over the crossing dome (from the drum's cornice to the lantern's foot) and one over the lantern's cap — 12-sided
  lathes in `LEAD #7b8186` (a mid-dark grey; W7-R-review found a near-black read too dark on City Hall), their profiles
  measured on the GLB's vertices (`glbNode`, scratch `opus-qa/w8/w2/ign.mts`) with ≥ 4 % + 0.03 u clearance. The cream
  crosses, the lanterns' columns and the towers stay the model's. The procedural church (`?ai=0`, the fallback) gets
  lead cupolas above its lantern stage and a lead dome; lod 2 a lead cap on each tower. `landmarks/tops.ts`
  regenerated (the tower blockers 13 → 13.1, the crossing 11.8 → 12.1).
- **`tests/opus-bay-w8-w2-looks.test.ts`** (new): no vertex of the AI model pokes through a shell (> 200 vertices in the
  shells' spans checked against the 12-gon's inner radius).
- The first try (16-sided shells with a vertical lip) took the swap's remainder to 1252 triangles: red on
  `opus-bay-sf-models` W4-IL5 (≤ 1200) → 12 sides, no lip: green.

### Evidence

- `qa/w8/W2/c-ignatius-before.jpg` / `c-ignatius-after.jpg` (desktop day, the tower tops close from the front: cream
  cupolas and dome → lead grey, the crosses cream). From Fulton & Parker 79 calls / 244.0k, the tower close-up 72 /
  218.7k (+ 0 calls: the shells ride the site's TOY batch).
- **The perf table** (desktop 1440 × 900, golden, quality high, the walking camera at each spot; main + shadow; before =
  the first agent's run on the day-0 tree 18:58 PDT, after = 22:37 PDT on this lane's tree rebased on `origin`, so it
  includes every lane pushed by then):

  | spot | before calls / tris | after calls / tris | this lane's groups in view |
  |---|---|---|---|
  | haight-usf | 95 / 278.3k | 94 / 295.0k | St Ignatius in the distance (+0 calls) |
  | ocean-beach | 50 / 98.3k | 50 / 104.2k | `sf:west-sea` 1 / 12k (the surfers, the break) |
  | music-concourse | 92 / 244.6k | 93 / 250.0k | `sf:west-lake` within 200 u of the lake (1 call) |
  | civic-center | 74 / 218.6k | 104 / 296.8k | none (see below) |

  All within 150 / 400k. Civic Center's +30 calls are not this lane's: the same spot (108.4, 394.9) but the walking
  camera came up facing east into the hero district (`hero.ground` 6 / 45k, `city.landmarks` 15 / 49k) where the
  day-0 run faced City Hall (`opus-qa/w8/w2/perf-before/civic-center.jpg` vs `perf-after/civic-center.jpg`); nothing of
  this lane is drawn there. Phone 390 × 844 (dpr 3, quality mid, golden): haight-usf 70 / 206.3k, ocean-beach
  40 / 96.9k (the surfers and the crest lines read in portrait).
- Night (`--time night`, read 22:47): the boathouse's café windows and entrance glow, the three moored boats stay, no
  boat out on the lake (83 / 183.1k); Kelly's Cove: no surfers, the crest lines faint on the dark sea (56 / 89.0k).
- The far view from the south-west (97 / 308.4k): the church's grey domes read over the Richmond's roofs like the photo.

### Decisions

- Shells, not a recoloured texture: the GLB's texture has no separate cream for the cupolas (a hue rule like W7-R's
  `recolour-glb.py` would grey the whole church); a UV-space mask would need the Draco UVs decoded and rasterised —
  the shells are measured, tested against every vertex and cost 0 calls.
- No new BAYBAY lines in part c (lane X records from 22:45).

### Not done (part c and the lane)

- **The Haight Victorian / mural kit** (2–3 generic mural walls, painted façades along Haight St): tried at 22:50 and
  backed out. Two generic toy murals (a sunrise over green hills with flowers; a rainbow over scalloped waves with
  clouds — flat colour layers in the corner site's own mesh, 0 calls, +1.2k triangles) on the corner model's two side
  walls (the corner building's back wall facing down Haight St, the row's east end wall facing along Ashbury): the shots
  (`opus-qa/w8/w2/mural1`, `mural2`) showed both walls hidden behind the city's abutting generic buildings (their
  footprints come from the DataSF join, not in the OSM list I checked), so the murals were invisible from the streets —
  reverted (nothing pushed). Next wave: put the panels where the city's own building heights (the chunk data, not OSM)
  leave a wall exposed above a lower neighbour, or on the generic buildings' street fronts at ground floor; no
  lettering, no real artist's work. Higgsfield mural textures were not needed for what shipped: **0 credits spent**.
- **Chase Center to T2**, **the de Young tower's twist** (the AI tower's twist direction is still unchecked against
  the real one), **the far City Hall dome** (lane R's W7 recolour already gives the far lod 2 a grey dome with the gold
  lantern; the gold ribs are lod 0 only): not done.
- A rentable boat ride on Blue Heron Lake (part b, Decisions).

## Requests

- **Lane X (voice)**: the 8 new fixed lines of parts a and b (the tables above; ids `w8-w2-*`), said through
  `game/cityContent baybayLine` with exactly that text (sf-w8-lead §4: voice is matched by exact zh + en text).
- **The lead / W8-Z**: the Civic Center perf spot's walking camera now comes up facing east (hero district) instead of
  City Hall — an arrival / camera change of another lane, not W2's; compare like for like before reading a delta.
- **The next wave**: the Haight mural kit and Chase Center T2 (Not done above).
