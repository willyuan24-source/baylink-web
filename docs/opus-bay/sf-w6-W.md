# Wave 6 · lane W · more San Francisco and more play

Lane W of wave 6 (`docs/opus-bay/sf-w6-lead.md` §3 row W), worktree `C:/Users/willy/wt/w6-w`, dev port 5608, scratch
`C:/Users/willy/opus-qa/w6/w/`. Higgsfield: 0 credits (not this lane's).

## 给主人的摘要

1. **北滩的"空地"补好了**：城市模式里华盛顿广场一带原来是两条街深的一整片空铺地（老数据把那几块街区交给了手工区，手工区却没盖房子）。现在把那几个街区真实的 OSM 房子（92 栋）按城市自己的样式补回来，能看见、也会挡路；城里的步行路网、路线站点都测过还能走。
2. **北滩街角**：华盛顿广场有了草坪、边上一圈树和长椅、中间的富兰克林像和六棵钻天杨；对面圣彼得圣保罗教堂的白色双塔（191 英尺，按游戏的高度规则 12.2 格）、玫瑰窗、门上的金色马赛克带和台阶；哥伦布大道上有咖啡桌和意大利三色遮阳伞、有人坐着、招牌（Café / 面包 / Books）、三色灯杆，晚上桌子上方的一串串灯泡会亮。
3. 整个街角只多 2 次绘制（约 7.3k 三角形，离镜头 190 格外不画）；手机 390×844 上看过。
4. **里昂街台阶赛跑**：从绿街那头的台阶脚下喊一声「比赛？」，和 BAYBAY 比谁先跑上百老汇街的顶，顶上正对艺术宫的圆顶。原来中间平台的花坛把路堵死了，现在花坛靠边、下面几段台阶也能走通，路网测过。
5. **和 BAYBAY 玩捉迷藏**：点「问 BAYBAY」→「捉迷藏」，她数三下就藏到 60 格内某个地标旁边（一定是走得到的地方），屏幕上方提示「暖了！/冷了…」和冷热程度，每 15 秒她会在藏身处挥挥手；找到她就拿奖牌金币（45 秒内最高），手机和电脑都实际玩过；新玩家安静站一会儿后，BAYBAY 会（每台设备一次）提醒可以玩捉迷藏。

## Part a · W6-W1 the North Beach seam gap, W6-W2 the North Beach corner

Started 01:53 PDT (the brief said lanes start 02:40; the worktree was ready, so I started).

### What was built

- **The cause** (NEXT #15, `sf-w5-L.md` Known gaps): the offline build (`scripts/opus-sf/lib/buildings.ts` `heroSeam`)
  drops every OSM building of a city block that lies ≥ 60 % inside the hero slab, because the district is supposed to
  draw those blocks. The district's lot generator (`data/district.ts` §12) leaves the slab's south band empty — its grid
  lots there fail `inSlab(p, 1.2)` / the building-line clip — so city mode showed bare fallback pavement two blocks deep
  (Washington Square, Columbus Ave, upper Grant, the Saints Peter and Paul block). The district itself must not change.
- **`scripts/opus-sf/seam-fill.mts`** (new): re-runs the build's building steps on the same raw snapshots
  (`C:/Users/willy/opus-qa/sf-data/raw`, osm_base 2026-09-26: land, terrain, roads + blocks, load / merge / carve, the
  seam rule) and keeps the buildings of the **hero-owned blocks where no district lot stands**, in the North Beach region
  (x ≤ 60, z ≥ 60), finished exactly as the build finishes them (style, roof, palette, toy height); base = the hero ground
  (seam rule 2). Left out: anything within 0.05 u of a district street ribbon (the city carves footprints 1.8 u off a
  residential centreline, the district ribbon is 1.6 u half-wide), a kept district lot, a hero exclusion, Washington
  Square, or crossed by / within 0.5 u of an edge of the published walking graph (two service alleys). Result: 129
  candidates in 27 empty blocks → **92 buildings** (graph 8, street 13, lot 15, exclusion 1 left out); the church's nave
  (OSM way 29902626) is set back 1.6 u behind its front so the steps (the attraction's arrival and route r1's stop, which
  lie on the OSM front line) stay open.
- **`src/opus-bay/world/sf/cornersSeamData.ts`** (generated, 92 rows, 13.8 KB source) and **`world/sf/build.ts`
  `addSeamFill(chunk, rows)`**: appends the rows to the chunk holding their centroid right after `dropSeamBuildings` in
  the stream worker (**`world/sf/worker.ts`**, one call — surgical, named here): the city's own L0 / L1 recipes draw them
  in its pools (no draw call of their own) and `rasterizeChunk` gives them collision like every city building. Idempotent
  (skips osm ids already there).
- **`src/opus-bay/world/sf/cornersNB.ts`** (new, plain data): `NB_SQUARE` (OSM way 18583270), `NB_CHURCH_OSM_RING`,
  `NB_FRONT`, `NB_CHURCH_SETBACK`, `NB_CHURCH_ARRIVAL`, `SEAM_REGION`, `nbDropLots(blocks)`: the district's plain
  residential box `lot-211` stood on the church's site; city mode now hides it like `manifest.heroDropLots`:
  **`world/sf/hero.ts` `cityDropLots()`** (manifest ∪ North Beach lots; `heroProxy` leaves it out),
  **`world/sf/stream.ts`** passes it to `setCityTerrain` (one line), **`world/sf/cityWorld.ts`** cuts its triangles (one
  line). District mode keeps `lot-211`.
- **`src/opus-bay/world/sf/cornersNorthBeach.ts`** (new): `attachNorthBeach()` — a WorldSystem added in `cityWorld.ts`
  like the murals (city mode only): ONE TOY mesh + ONE signs-atlas mesh in a `THREE.LOD` drawn within `NB_CULL` = 190 u,
  built the first time the camera comes within 260 u; soft obstacles for the statue, poplars, trunks, tables and poles.
  - the square: the lawn (1 u quads on the hero ground, 1.1 u in from the edge: the path ring), 13 trees and 4 benches
    round the edge, Franklin's statue on its pedestal in the middle with six Lombardy poplars;
  - the church: two white towers at the front's ends (shaft, cornice, belfry with arches, octagonal drum, spire, gold
    cross; tips at `NB_SPIRE_TOP` = 12.2 u = `buildingH(58 m)`), the white front with its gable, the rose window, the gold
    mosaic band, three arched doors, two steps; the nave is the fill's building;
  - Columbus Ave: `nbCafes()` finds a fill building's front 1.9–3.6 u off the centreline every 7 u (5 clusters): café
    tables with green / white / red umbrellas, a sitter at each, a string of 6 bulbs (glow at night) along the front, a
    plaque (Café, Café, Bakery, Café, Books — trade words only); `nbPoles()`: 8 light poles banded green / white / red.
- **Tests** `tests/opus-bay-w6-w-seam.test.ts` (4): the data (inside the slab's band, clear of every lot city mode keeps
  and of the square, the church set back, `lot-211` the only drop); `addSeamFill` (right chunk, published buildings
  untouched, idempotent); the band walks in city mode (the nave is solid; **no walking-graph edge through the band runs
  into a fill building**, 0.5 u samples; the church steps and every route stop in the band standable; the towers leave
  the steps open); the corner (2 meshes, ≤ 8,000 triangles, spire tips 12.2 u, cafés / poles on open sidewalk off the
  centreline, the square's things inside it).
- Test helpers kept truthful to the game: `tests/opus-bay-sf-disk.ts` appends the fill like the worker;
  `tests/opus-bay-sf-look.test.ts` counts it (`manifest.counts.buildings + SEAM_FILL.length`);
  `tests/opus-bay-w5-landmarks.test.ts` uses the game's drop set and names three new route corridors (below).

### Evidence

- Before / after from above (same camera, desktop, day): `qa/w6/W/w1-nb-seam-top-before.jpg` (the empty band),
  `qa/w6/W/w1-nb-seam-top-after.jpg` (blocks filled, the square's lawn and trees, the church). Desktop golden hour from
  the square: `qa/w6/W/w1-nb-church-desk.jpg` (the twin towers, rose window, band, doors; the lawn, poplars, statue,
  benches). Phone 390 × 844 dpr 3 quality mid, player at (−64, 109): `qa/w6/W/w2-nb-square-phone.jpg`. Night on
  Columbus Ave (added in part c): the café tables under their umbrellas, a sitter, a tricolour pole with its lantern lit
  and the bulb strings glowing (`qa/w6/W/w2-nb-columbus-night-desk.jpg`).
- Draw calls / triangles (renderer.info, budget-views, not fps): above the band 57 calls / 199k → 57 / 204k (fill only)
  → 68 / 230k with the corner in view (another camera); the low view toward Columbus 80 / 289k → 81 / 306k. The corner
  itself: 2 meshes, 7,254 triangles (the test measures it).
- Checks (pushed as `daedbdc4`, `4fcc39ce` after a rebase): tsc 0 · eslint 0 errors (43 old warnings) · suite
  1407 / 1407.

### Decisions

- **Fill, don't rebuild.** Re-publishing the chunks would touch the whole city's data; the worker-side fill changes
  nothing outside the band and reuses the build's own finishing code (the script imports `scripts/opus-sf/lib`).
- **Region = North Beach and upper Chinatown only (x ≤ 60).** The same bug leaves ~30 empty hero-owned blocks in the
  Financial District's south edge (x 60–240, z 15–110: 46 more buildings); filling them sits in the Ferry-gate perf view
  and was not asked for — Known gaps / Requests.
- **Three route points become corridors** (`ROUTE_CORRIDORS` in `tests/opus-bay-w5-landmarks.test.ts`): r1's via 1
  (Grant by Columbus) and via 3 were "3 of 4 ways" only because the band beside them was open pavement; r1-peter-paul is
  the church steps (the nave behind). The judge accepts 2 ways there, with the reason written down.
- **The church's nave is the city's building** (civic style, its own palette: a pale body with a slate gable), the
  towers / front are the corner's; the steps stay open (set back 1.6 u).
- **Corner budget 8,000 triangles** (the wave-5 corners keep 2.5k): this one carries the church's towers and the lawn;
  still 2 draw calls, culled at 190 u.

### Facts (checked on the web 2026-09-29)

- Saints Peter and Paul: twin spires 191 ft, 666 Filbert St facing Washington Square, completed 1924 —
  https://www.gpsmycity.com/attractions/saints-peter-and-paul-church-6824.html ; a Dante line in mosaic on the front —
  https://www.oreilly.com/library/view/photographing-san-francisco/9780470586846/ch23.html ; the parish history
  https://www.salesiansspp.org/our-history .
- Washington Square: 1849 plan, 2.8 acres; the 1958 Halprin / Baylis lawn with curving edge paths, trees and benches;
  Franklin's statue (Cogswell's temperance fountain, there since 1904) with six Lombardy poplars —
  https://www.tclf.org/landscapes/washington-square-ca , https://en.wikipedia.org/wiki/Washington_Square_(San_Francisco)
- North Beach light poles painted in the Italian flag's colours ("Little Italy of the West", 1990s) —
  https://www.kqed.org/news/12074121/ciao-bella-do-italians-still-live-in-san-franciscos-north-beach
- Columbus Ave: sidewalk café tables, string lights in the evening —
  https://lucky-tuk-tuk.com/attractions/little-italy-and-north-beach/ ,
  https://www.thebolditalic.com/my-favorite-places-to-eat-outside-in-san-franciscos-north-beach-and-nearby/
- Geometry: OSM (the raw snapshot 2026-09-26): way 18583270 (the square), way 29902626 (the church, height 23 m on the
  nave), Columbus Ave ways 148874364, 148874363, 254756518, 48211487, 87376669, 30030101, 416878315, 254971056.

### Known gaps

- The Financial District's south band has the same empty hero-owned blocks (46 buildings would come back with
  `SEAM_REGION` widened); not done (perf view, not in the brief).
- Columbus Ave itself is not painted as asphalt inside the slab (the district has no Columbus; the band's ground is
  the district's pavement); its buildings and café fronts now line it.
- The nave's palette is the build's civic pick (pale walls, slate gable), not pure white.
- Places whose point is a building now stand inside one (`osm-w32946083` Fugazi Bank Building, the Boudin Bakery card's
  point): trips there end at the nearest walkable spot, like any building place in the city.

### Not done (this part)

- Nothing of W6-W1 / W6-W2's scope.

### Requests

- **Lead** (a later wave): widen `SEAM_REGION` (world/sf/cornersNB.ts) to the Financial District's south edge and re-run
  `scripts/opus-sf/seam-fill.mts` after a perf gate at the Ferry gate (46 buildings, same pools).

## Part b · W6-W4 捉迷藏 hide & seek with BAYBAY

Started 02:55 PDT (part a pushed at 03:03 as `daedbdc4`, `4fcc39ce`; its checks: tsc 0 · eslint 0 errors (43 old warnings) ·
suite 1407 / 1407 on the rebased tree).

### What was built

- **`src/opus-bay/play/hideSeek.ts`** (new, its own lazy chunk, 1 frame system while a round runs):
  - `pickHideSpot(p, { stand, reach, rand?, list? })`: a landmark whose trip end (data/sf/attractions: `arrival`, else
    the anchor) is 18–60 u away, tried in a random order (≤ 6): a point 3.5 / 2.5 u behind it (away from you, five
    turns), else the trip end itself, **standable and walked to by the nav grid** (`liveOpts`: `canStand(…,
    STAND_RADIUS)` and `actors/nav findPath` ending within 1.1 u); where none is, a walkable spot 20–45 u away (8
    directions × 3 radii, the same two checks: "就在附近"); else no game (she says so).
  - `startHideSeek(opts?)`: through the PlayKit (`startActivity('hide-seek', better 'lower')`, no lock: you walk and run
    freely): the chip counts 3 · 2 · 1 (她数到三), she is pinned where she hides from 0.8 s (partc `pinBaybay`: feet and
    drawn body); then the chip says 找 BAYBAY！她藏在 <landmark>附近, the seconds, and `heatStep` / `heatWord`: 暖了！ /
    冷了… for 2.5 s each time you are 2.5 u closer / farther than at the last word, else how warm it is (好烫！≤ 8 u ·
    暖暖的 ≤ 20 · 有点凉 ≤ 40 · 冷冰冰), a tick on 暖了; every 15 s she waves where she hides (a squeak when you are within
    20 u). Within `FOUND_R` = 2.6 u: 被你找到啦！N 秒！, the kit's card with **`medal:hide-seek:<tier>`** (the existing
    `medal:` prefix: 5 / 10 / 15 coins once per tier; ≤ 45 s 太棒了 · ≤ 90 s 很好 · found 好), the best time kept, 再来一次.
    放弃 on the chip or 180 s: she calls out and comes back, nothing paid. Leaving play (phase ≠ playing) cancels.
- **`src/opus-bay/play/hideSeekEntry.ts`** (new): `registerHideSeek()` — BAYBAY's menu item 捉迷藏 / Hide & seek (问
  BAYBAY → 捉迷藏: the Ask button, then one tap; phones and keyboards), visible while a round may start (free roam, on
  foot, nothing modal, no other activity). **`play/index.ts`** (lane K1's file, surgical, named): one import + one
  `offs.push(registerHideSeek())` beside the other ask items.
- **Tests** `tests/opus-bay-w6-w-hideseek.test.ts` (5): the words; where she hides (range, behind the landmark, the
  nearby fallback, none); **on the published city from Washington Square, Union Square, the Painted Ladies and Ocean
  Beach (two seeds each): standable, 14–64 u away, the nav path reaches it**; a whole round through `stepFrameSystems`
  (count, pinned, 暖了！ on the chip after 5 u, found → `medal:hide-seek:3`; 放弃 → cancel, no reward); the chunk ≤ 5 KB
  gzip, loaded lazily from the entry, nowhere in GameRoot.

### Evidence

- Played in the game (dev server 5608, `?world=city`): phone 390 × 844 dpr 2 at Washington Square — the Ask button,
  then 捉迷藏 (clicked through the DOM like a tap): the chip "Hide & seek · 1 · Cold · Give up · Find BAYBAY! She's
  hiding near City Lights", BAYBAY 63 u away on Columbus (`qa/w6/W/w4-hide-seek-phone.jpg`). Desktop: walking toward her
  "Warmer!" (`qa/w6/W/w4-hide-seek-warmer-desk.jpg`, she hid by Coit Tower); standing by her: "You found me! 4 seconds!"
  and the card "Brilliant · Found BAYBAY in 4 s · +30 coins" (the three tiers the first time;
  `qa/w6/W/w4-hide-seek-found-desk.jpg`). (The last step moved the player next to her by script: walking 60 u up
  Telegraph Hill takes a headless run longer than its budget.)
- Checks (pushed as `b5154a01`, after two rebases, from a check worktree `C:/Users/willy/wt/w6-w-check`): tsc 0 ·
  eslint 0 errors (43 old warnings) · suite 1431 / 1432 — the one failure, "E2-5 view field in the city" (a wall-clock
  case in tests/opus-bay-sf-move2), passes alone (24 / 24); after the second rebase (lanes S and P only, no shared
  file) tsc 0 and the play / contracts / notebook / lane-W tests 87 / 87.

### Decisions

- **The way in is BAYBAY's menu** (问 BAYBAY → 捉迷藏), like 做个动作 / 摸摸: the emote wheel (lane K1's
  `EmoteWheel.tsx`) keeps its four emotes; one Ask tap + one item tap on phones.
- **Reward = the kit's medal** (`medal:hide-seek:1..3`, 5 / 10 / 15 coins, each once): no new prefix, nothing frozen
  touched; later rounds pay nothing new (the best time still counts).
- **Where she hides must be walked to**: the nav check runs once at the start (≤ 6 landmarks + ≤ 24 nearby points); a
  place without any is refused with a line rather than a spot you cannot reach.
- **She waves every 15 s** where she hides (sharp eyes may see her), no arrow or map pin: the words are the hint.

### Known gaps

- No voice for the new lines (lane X records voice; the bubbles are text) — Requests.
- She stands where she hides (no crouch pose in lane F's emote list); the waves are her only movement there.
- The spot is picked once; she does not move while you seek.

### Not done (this part)

- Nothing of W6-W4's scope.

### Requests

- **Lane X** (voice, optional): BAYBAY's hide & seek lines, zh + en — 捉迷藏！你数到三，我去藏好～ / Hide and seek! You count
  to three, I'll hide! · 被你找到啦！ / You found me! · 我在这儿呢～下次再来找我！ / Here I am! Find me next time!

## Part c · W6-W3 the Lyon Street Steps stair course (+ a hide & seek guard)

Started 03:30 PDT (part b pushed 03:48 as `b5154a01`).

### What was built

- **Why there was no course** (`play/stairCourses.ts` header, wave 5): on the published city the middle landing did not
  join the flights below it. Two causes, measured with the stand raster (0.5 u cells, the walker's 0.45 u disc):
  1. the site's planted bed stood in the middle of the landing (1.2 u wide), leaving 0.76 u either side;
  2. below the landing the city's own steps (the OSM steps line to Vallejo and Green St) are narrower than the flights
     on steep ground either side: no cell there stood for a walker, so the nav went round through the Presidio's trees.
- **`world/sf/landmarks/lyon-street-steps.ts`** (lane L's site, surgical, named): the bed is gone from the middle; the
  clipped hedge carries on along the house side past the landing with two round topiaries on it (the third blocker is
  that hedge end, x −1.59…−0.99); the walk gains one `stairs` surface 3 u wide from the middle landing down to local
  z 20 (`walk.surfaces`, y 'terrain'). **`landmarks/tops.ts`**: the lyon row's third top 1.9 → 2 (the measured lod 0,
  the generator's rule; only that row edited).
- **`play/stairCourses.ts`**: course **`lyon`** 里昂街台阶 — 11 vertices from the foot of the flights by Green St (y 11.0)
  up the Lyon Street Steps between the hedges and the Presidio's wall to the top landing on Broadway (y 22.9, the view
  straight onto the Palace of Fine Arts' dome), 30 u; BAYBAY's line at the top: 里昂街台阶大约 300 级，一路修剪整齐的树篱，
  正对着艺术宫！ The stair race (`play/stairs.ts`), the 比赛？ prompt at the foot and the step counter take it from the
  data (nothing else changed).
- **`economy/records.ts`** (lane K2's, surgical, append): the notebook's best rows `stairs-lyon` and `hide-seek`.
- **`play/hideSeek.ts`**: 捉迷藏 is not offered while BAYBAY leads a trip or goal #1's walk (`flow.trip`, `freeLead`).
- **Tests**: `tests/opus-bay-w5-play-acts.test.ts` "W5-A8 stair courses" (lane A's, now three courses: every 0.5 u
  standable, every leg a nav walk ≤ 1.5 × + 2, foot and top open, climbs > 8 u, par 3.5–6.5 s, BAYBAY's time and the
  gold time, the step count for Lyon 100–400) passes for `lyon`; new `tests/opus-bay-w6-w-lyon.test.ts` (the finish on
  the top landing, the foot > 20 u down the axis, every vertex inside the corridor, the walk past the old bed stands,
  the nav from the top to the foot takes the steps — < 1.4 × the straight line, it was ≥ 42 u round through the trees —,
  the record rows).

### Evidence

- Played (desktop, golden hour): at the foot the prompt "Race? Race BAYBAY up the Lyon Street Steps"
  (`C:/Users/willy/opus-qa/w6/w/c1-foot.jpg`), E → the chip "Lyon Street Steps · 1.5 · BAYBAY leads · Give up"
  (`qa/w6/W/w3-lyon-race-start-desk.jpg`), BAYBAY runs the steps and calls from the top "I'm at the top! Come on up!"
  over the Palace of Fine Arts' dome and the Bay (`qa/w6/W/w3-lyon-top-palace-desk.jpg`).
- The corridor, stand raster before → after at the middle landing (local z 8.5–10, lx −2…2, `s` = stairs that stand,
  `:` = a 0.3 u disc only, `#` = blocked): `##########::#####` → `######..s.::#####`; the lower flights (z 15–17.5)
  `######:s::#######` → `######:sss:######`. Probe: foot → top legs 3.0 / 3.0 / 3.0 / 2.5 u walked for 3.0 / 3.0 / 3.0 /
  2.5 straight (the leg z 18 → 15 walked 41.5 u before).
- Checks: see the push line below.

### Decisions

- **The bed moves, the hedge stays**: the real steps' middle landing is hedged along the houses; a bed in the middle
  that a walker cannot pass is not worth a course that cannot be run.
- **A walk surface, not a new model** for the lower flights: the city's OSM steps line stays as drawn; the surface only
  makes the steep ground either side of it walkable for a 3 u strip (landscaped, like the upper run).
- **"About 300 steps"**: sources differ (288 Broadway → Green on inspiredimperfection.com; 332 Broadway → Vallejo on
  sftourismtips.com, both read 2026-09-29), so BAYBAY says 大约 300 级 and `steps` is 300.

### Facts (checked on the web 2026-09-29)

- 288 steps from Broadway down to Green St, gardens and flower beds, the view of the Palace of Fine Arts, the Marina, the
  islands — https://inspiredimperfection.com/adventures/lyon-street-steps/
- 332 steps Broadway to Vallejo, the Palace of Fine Arts from the top — https://www.sftourismtips.com/lyon-street-steps.html
- The steps connect Cow Hollow to Pacific Heights and the Presidio's Broadway gate — https://www.nps.gov/places/000/lyon-street-steps.htm

### Known gaps

- The course's foot is at the bottom of the modelled flights (≈ 25 u down the axis, by Green St's level), not a drawn
  Green St corner; the city's own steps below the site are OSM's line (no hedges drawn there).
- BAYBAY runs the course line; a player who leaves the corridor on the lower flights walks the steep landscaped strip.

### Not done

- (5) a separate new activity: not started (time). Instead (W6-W5, below) a new player is told that 捉迷藏 — which
  works anywhere through its nearby fallback — is there.

### Requests

- **Lead / lane X**: a voice line for the Lyon top (里昂街台阶大约 300 级，一路修剪整齐的树篱，正对着艺术宫！ / The Lyon
  Street Steps: about 300 of them, neat hedges, and the Palace of Fine Arts dead ahead!) if the stair lines get voices.

## Part c+ · W6-W5 BAYBAY tells a new player about 捉迷藏

Started 04:12 PDT (part c pushed 04:11 as `ff6e5ff9`, `92c284ab`, `3a055751`; its checks on the pushed tree: tsc 0 ·
eslint 0 errors (43 old warnings) · suite **1459 / 1459**; the rebase before the push brought one docs-only commit).

### What was built

- **`play/hideSeek.ts` `startHideCoach(store?)`**: once per device (`opus-bay:play:hide-coach:v1`), after the emote
  coach has spoken (`opus-bay:play:emote-coach:v1`, play/index.ts) and after 40 s of quiet free roam where a round may
  start (standing still, no bubble, no panel), BAYBAY says 想玩捉迷藏吗？点「问我」，再点「捉迷藏」！ (phones) / 按 Q 问我，
  再选「捉迷藏」！ (keyboards): the game is one Ask tap away wherever the player stands; the line makes it known.
- **`play/hideSeekEntry.ts`**: starts the coach when the hide & seek chunk has loaded; the unregister stops it.
- Test: `tests/opus-bay-w6-w-hideseek.test.ts` + "W6-W5 the coach line" (not before the emote coach, not before 40 s,
  said once, never on a second visit); the chunk stays ≤ 5 KB.

### Decisions

- A line, not another activity: at 04:12 with 38 minutes to the stop, a coach line that makes the new game findable is
  the safe "one more thing"; a separate activity would not have been played and reviewed in time.

### Evidence

- Played: a headless desktop run standing still at Washington Square for 110 s after the load — neither lane A's emote
  coach nor this line had spoken yet (both keys still unset: the first minutes' chatter, the onboarding hints and the
  pelican hint keep the quiet counters from filling), so the line comes later than two minutes in practice
  (`qa/w6/W/w5-coach-quiet-desk.jpg`: the square, BAYBAY, Rosa the baker). The rule itself is the test's.
- Checks: see the final line of this report.

### Known gaps

- The line waits for lane A's emote coach, which waits for a quiet stretch; a player who keeps moving hears neither.
  If the lead wants it sooner: drop the EMOTE_COACH_KEY condition in `startHideCoach` (one line).

## Final checks (04:29 PDT)

The pushed tree with W6-W5 (rebased on `fe329ae8`, in the check worktree): `npx tsc -p tsconfig.app.json --noEmit` 0 ·
`npx eslint .` 0 errors (43 old warnings) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts`
**1462 / 1462**. Lane W's own tests: `tests/opus-bay-w6-w-seam.test.ts` (4), `tests/opus-bay-w6-w-hideseek.test.ts` (6),
`tests/opus-bay-w6-w-lyon.test.ts` (2). District mode: untouched (the fill and the corner live in the city worker /
city chunk; `lot-211` stays in the district; the hero regression is in the green suite).
