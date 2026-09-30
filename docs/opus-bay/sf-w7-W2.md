# Wave 7 · lane W2 · landmarks & play

Lane W2 of wave 7 (`docs/opus-bay/sf-w7-lead.md` §3 row W2), worktree `C:/Users/willy/wt/w7-w2`, dev port 5709,
scratch `C:/Users/willy/opus-qa/w7/w2/`. Higgsfield: 0 credits (not this lane's).

## 给主人的摘要

1. **恶魔岛第一次有了真正的模型**：以前岛上只是几个普通灰盒子。现在是按 OpenStreetMap 真实位置摆的：白色三层监狱主楼（一排排带铁栏的高窗、屋顶长条天窗）、东头的行政楼和西头的食堂、放风场的高墙和看台、踩着钢架高脚的水塔、码头边的 64 号楼、码头岗亭、渡轮浮码头、典狱长住宅和军官俱乐部的废墟（1970 年烧毁，只剩墙）、小教堂、发电厂和大烟囱、岛西北的工业楼、犯人开垦的花园和岛上的小路。灯塔挪回它真实的位置（原来偏了约 30 米），夜里的光束照旧。
2. 从科伊特塔、39 号码头海狮那边、空中都拍了前后对比图；整个岛只多 1 次绘制、约 4.5k 三角形（T1 上限 6k），离远了自动换成 144 个三角形的剪影。
3. **码头绿地终于有风筝了**：白天草坪上空飘着 4 只彩色风筝（带尾巴和线，下午风大时飞得更高更欢，晚上收起来）。还能和 BAYBAY 一起**放风筝**：在码头绿地或克里西场的草坪上「问 BAYBAY → 放风筝」，起风时按住「放线」，风小了松手让它往上爬，按太久风筝会往下栽；BAYBAY 在旁边放她自己的蓝风筝。飞起来、飞满 20 秒、把线全放完分别拿铜/银/金奖章。手机上用按钮玩，电脑用空格键。
4. **新小游戏「那是什么？」**：任何看得见远处的地方「问 BAYBAY → 那是什么？」，她指向一个真正看得见的地标（金门大桥、苏特罗塔、市政厅、科伊特塔、泛美金字塔、Salesforce 大楼、渡轮大厦、海湾大桥、恶魔岛），镜头转过去，三选一，每答一题她讲一句真实的小知识（都查过官方资料），三题拿奖章；看不到地标时她会推荐最近的观景点。
5. **捉迷藏修好 3 处**：点「捉迷藏」那一下不再卡顿（寻找藏身处分到后面几帧做）；「被你找到啦！」变成固定台词可以配音，秒数显示在顶部条上；提示玩捉迷藏的那句话不再等另一条提示先说完。所有新台词（中英）已整理好交给配音线。

## Part a · W7-W2a Alcatraz, a T1 model

Started 20:25 PDT (`date`), pushed ≈ 21:15 (see the push line below).

### What was built

- **`src/opus-bay/world/sf/landmarks/alcatraz.ts`** (new): the site record `alcatraz` (tier 1, local frame = the island's
  centre `projectCity(37.8267, −122.423)` = `CITY_BACKDROP.alcatraz`, yaw 0, base 0, `sink: 0`, one TOY mesh). Every
  footprint is an OSM way from the raw snapshot (2026-09-26), projected with `core/geo projectCity` and fitted with an
  oriented box; every part stands on its own measured ground:
  - **the cellhouse** (Main Prison 128245373): a 10.4 × 6.2 u white concrete block, 5.4 u to its parapet over its low
    corner (≈ 14 m, three storeys), two tiers of tall **barred window bays** on both long sides (a dark opening with two
    light bars, 13 bays; the lower tier drops where the hill rises), a plinth band, a cornice, the roof deck and the long
    **clerestory** (the skylight monitor over the cellblocks, barred glazing on both sides), barred windows high on the
    west end; the **Administration Block** (east end, office windows, the main door; kept 1.2 u under the cellhouse's
    parapet) and the **Dining Hall** (west end);
  - **the recreation yard** north of the dining hall: its floor on a retaining base, tall concrete walls, three bleacher
    steps, two corner guard boxes;
  - **the water tower** (660870452): four raked steel legs with two tiers of cross bracing, the tank with a rust band,
    the balcony ring and a conical cap, 7.6 u over its ground (94 ft on the height curve);
  - **the dock**: **Building 64** (24617219, three storeys, pale ochre, a darker casemate base course), the dock apron
    and the pier (27609572) on pilings, the ferry float (27999864) with its shelter, the **Guard Tower** (1056707180) on
    stilts with a white glazed cab and a pyramid cap;
  - **the ruins**: the **Warden's House** (27996789, a roofless three-storey shell with dark window holes and a sooty
    top) and the **Post Exchange & Officers' Club** (27996732, low broken walls);
  - the Sally Port, the Former Military Chapel (red tile gable), the Electric Shop, the Quartermaster (white, gabled),
    the **Powerhouse** with its tall chimney (1056707165), the Morgue, the restrooms / kiosks, the **New Industries
    Building** with its guard gallery along the roof, the **Model Industries Building** on the north-west cliff;
  - **the gardens** (inmate-terraced beds below the cellhouse and on the west side: shrubs with pink / yellow / red /
    violet blooms), scrub on the slopes, rubble slabs on the parade ground, and **the roads and paths** (37 OSM ways,
    the switchback up from the dock, West Road, the Agave Trail) draped on the ground as ribbons — the exclusion drops the
    city's own street ribbons on the island.
  - lod 2 (the far silhouette): the cellhouse with its wings, the water tower, Building 64, New Industries, the
    Powerhouse. Walk blockers for the cellhouse, its wings, the tower, Building 64, New Industries, the Powerhouse and
    Model Industries (the glide steers round them); the tower is a tall part.
  - **the exclusion** = the coastline's convex hull (OSM way 295140461) pushed 1.5 u out: every OSM box the city streamed
    on the island is dropped (their centroids are inside; the test checks the published chunk).
- **`src/opus-bay/world/sf/landmarks/alcatrazGround.ts`** (new): the island's ground on a 2 u grid (the published DEM,
  local frame) with `alcaGround` / `alcaGroundSpan`, and `ALCA_PATHS` (the 37 roads / paths). Written by
  **`scripts/opus-sf/alcatraz-ground.mts`** (new; re-run after a city publish — the test re-samples the DEM).
- **`world/sf/landmarks/index.ts`**: `W7_SITES = [alcatraz]`, `SF_SITES = [...SF_LANDMARKS, ...W4_SITES,
  ...W4_SITES_T3, ...W7_SITES]` (no info card: the island's card and the Pier 33 trip stay in `data/sf/attractions`).
- **`world/sf/landmarks/tops.ts`**: the `alcatraz` row (re-generated by `scripts/opus-sf/assets/landmark-tops.ts`; the
  other 100+ rows unchanged).
- **`world/backdrop.ts`** (the Alcatraz part, surgical): the lighthouse moves to its OSM place (way 99202294,
  37.82625, −122.4223; it stood ≈ 30 m off, in the warden's garden) on the ground there (9.0 u), 7.7 u tall (95 ft), a
  slimmer shaft, a gallery ring, the lantern (glows) and the cap; the lamp at 15.7 clears the cellhouse's clerestory
  (13.7): the halo and the night beam follow it.
- **Tests**: `tests/opus-bay-w7-w2-alcatraz.test.ts` (3): registered T1 at the island, lod 0 ≤ 6k, lod 2 ≤ 10 %, a tops
  row, no sink; the ground grid = the published DEM (< 0.03 u), the cellhouse / tower / lighthouse heights, the
  lighthouse at its OSM place and over the clerestory; the exclusion covers the coast and every OSM building of the
  island in the published chunk. `tests/opus-bay-sf-landmarks.test.ts` W4-IL1: `SF_SITES` now ends with `W7_SITES`.

### Evidence

- Triangles (the test's measure): **lod 0 4,528**, **lod 2 144** (3.2 %). One TOY mesh = +1 draw call within the T1
  ring (520 u), the silhouette rides the far pool (0 calls).
- Draw calls / triangles (`scripts/opus-sf/qa/budget-views.mjs`, desktop 960 × 600 high, golden hour; not fps), before
  → after:

  | view | before | after |
  |---|---|---|
  | Coit Tower top → Alcatraz | 81 / 200,194 | 81 / 203,311 |
  | PIER 39's west edge (the sea lions) → Alcatraz | 66 / 178,926 | 69 / 184,008 |
  | the air, 45 u off the island | 47 / 62,669 | 44 / 65,941 |
  | close over the cellhouse | 45 / 64,951 | 42 / 68,257 |

  (Close to the island the city's own island boxes, streets and trees — several pooled calls — are gone; the model is one.)
- Shots (desktop, golden hour): the air before / after `qa/w7/W2/a1-alcatraz-air-before.jpg` (generic boxes, a round
  lighthouse beside them) → `a1-alcatraz-air-after.jpg` (the cellhouse with its window bays and clerestory, the
  lighthouse over its east end, the water tower on its legs, Building 64 and the guard tower at the dock, the chapel's
  red roof, the gardens, the roads); from PIER 39's sea-lion floats before / after `a1-alcatraz-pier39-before.jpg` →
  `a1-alcatraz-pier39-after.jpg` (the long white cellhouse, the lighthouse and the tower read at 310 u); close
  `a1-alcatraz-close-after.jpg`. From Coit Tower the island is small (415 u) and reads as the cellhouse on its rock
  (scratch `C:/Users/willy/opus-qa/w7/w2/alca-after/alca-coit.jpg`).
- Checks: see the push line.

### Decisions

- **A plain SfLandmark in a new `W7_SITES` list**, not one of the 24 info-card landmarks and not a wave-4 site: the
  island has no walkable arrival, flag or photo pose of its own (the ferries leave from Pier 33; the card, the stamp and
  the telescope keep working as before).
- **OSM footprints, not a drawing**: every building is where OSM has it; heights follow the plan's curve (cellhouse
  ≈ 14 m → 5.4 u, the tower 94 ft → 7.6 u, the lighthouse 95 ft → 7.7 u), so the lighthouse stays one step taller than
  the tower, as the NPS says.
- **The lighthouse stays in `backdrop.ts`** (the beam, the halo and life.ts's night animation are there); only its
  place and size changed.
- **No lettering**: the water tower's and Building 64's painted words (1969–71 occupation) are left out (the no-brand /
  no-lettering rule); the Warden's House and the Officers' Club are drawn as the ruins they are today.
- `castShadow` off: the island is never near the player (no shadow-pass cost).

### Facts (checked on the web 2026-09-29)

- The cellhouse: built 1910–1912, "a three-story cellhouse with four cellblocks" —
  https://www.nps.gov/places/000/alcatraz-cellhouse.htm
- The water tower: 1940, 94 ft, one foot short of the lighthouse — https://www.nps.gov/places/000/alcatraz-water-tower.htm
- The lighthouse: 95 ft, 1909 (the first, 1854, was too short to shine over the new cellhouse), over the Warden's House —
  https://www.nps.gov/places/000/alcatraz-lighthouse.htm
- Building 64 above the dock — https://www.nps.gov/places/000/alcatraz-building-64.htm ; the Guard Tower —
  https://www.nps.gov/places/000/alcatraz-guard-tower.htm ; the Officers' Club / Social Hall (burnt in 1970) —
  https://www.nps.gov/places/5-officers-club.htm ; the inmate gardens — https://www.nps.gov/places/25-west-side-gardens.htm
- Which buildings stand today (cellhouse, Building 64, guard tower, sally port, chapel, powerhouse, the industries
  buildings, the water tower; the Warden's House and the Officers' Club as ruins) —
  https://alcatrazguidedtours.com/blog/buildings-on-alcatraz-island-history-and-what-to-see-now/
- Footprints and names: OSM ways of the raw snapshot `C:/Users/willy/opus-qa/sf-data/raw` (osm_base 2026-09-26), ids in
  the file header.

### Known gaps

- The island's ground is the city's (a smoothed 2 u DEM): the real island's cliffs and terraces are softer here; the
  cellhouse stands on its low corner (the uphill side shows less wall).
- The Parade Ground is painted by the city as a paved area (its OSM way is a highway area); the rubble slabs sit on it.
- The ferry to the island (lane B's part c, watch-only) is not in this lane; the dock is not walkable.

### Not done (this part)

- Nothing of (1).

### Requests

- **Lane B** (the toy Alcatraz ferry, if you build it): the float is `FLOAT` in `alcatraz.ts` (local 18.98, −18.12, 3.37 ×
  1.71 u, 174°; world ≈ −448.9, −76.4), deck at y 0.25; the apron at local (9.5, −16.4) is not walkable.

## Part b · W7-W2b hide & seek fixes, Marina Green's kites and 放风筝

Started 21:20 PDT (part a pushed 21:44 as `3727a49c` + `f90e3bf3`; its checks: tsc 0 · eslint 0 errors · suite
**1492 / 1492** on the tree before the rebase; after the rebase (lanes Q, G, R, the lead's note: no shared file) tsc 0 and
the landmark / Alcatraz tests 36 / 36).

### What was built

- **Hide & seek** (`play/hideSeek.ts`, lane W's wave-6 activity, now this lane's):
  - **the ≈ 50 ms hitch at the tap** (W6-W-review): the spot search is a generator `hideSpotSearch` that yields after
    every nav query; the round runs it at most `SEARCH_MS` = 6 ms a frame over the count (the count waits if the search
    is not done at 3 s; nothing found → the round ends with her fixed line). `pickHideSpot` runs the same search to the
    end (tests, QA).
  - **被你找到啦！ / You found me!** is a fixed bubble (`HIDE_LINES.found`, voiceable); the seconds go on the chip
    (`N 秒找到！`, held `FOUND_HOLD` = 1.2 s) and on the card; the other bubbles are `HIDE_LINES` too (start, give up,
    nowhere).
  - **the coach line** (`startHideCoach`) no longer waits for lane A's emote coach: 40 s of quiet free roam where a round
    may start is enough (once per device; storage read once at the start).
- **Marina Green's kites** (the lawn BAYBAY's r2 line and her arrival call "the city's kite-flying lawn"):
  - `play/kiteKind.ts`: the **kite kind** — ONE InstancedMesh of a unit two-sided diamond on lane A's instanced toy
    program (`toyMaterial('kite')`, `ob-toy-inst`: no new program), 4 triangles an instance; `placeKite` writes a kite as
    5 instances (the sail leaning back into the wind, three tail bows waving, the string as a long thin diamond turned
    to the camera); `DOWNWIND` = the sea breeze from the west-north-west in the city frame.
  - `play/kites.ts`: **four ambient kites** staked along the lawn's midline (the city's park rings), red / blue / yellow
    / green sails, riding the breeze (`breeze(hour)`: stronger 12:00–19:00 on the Bay clock, a slow swell), **by day
    only** (`U.uNight` ≤ 0.35); +1 draw call, 80 triangles, mounted by `play/kiteZone.ts` within 240 u of the lawn by day
    (dropped beyond 280 u or at night; checked once a second).
- **放风筝 with BAYBAY** (`play/kite.ts`, a lazy chunk): 问 BAYBAY → 放风筝 on the Marina Green lawn or the Crissy Field
  lawn (`kiteZone.ts` `onKiteLawn`), on foot in free roam. The chip: the line out (%), the **wind gauge** (the chip's
  meter; its band is a gust), the status (起风了！放线！ / 风小了，松手让它爬 / 在往下栽！松手！), a **放线 hold button**
  (touch-first; Space or E held on a keyboard) and 不玩了. Physics (`stepKite`, pure): holding lets the line out fast in
  a gust (2.4 u/s, the kite holds its height) and slowly in a lull while it sinks; held longer than 2.6 s it **dives**
  (let go and it recovers, hold on and it comes down: a short line again); letting go it **climbs** with the wind. Tiers
  ● the kite up (3 u over your hand) · ◆ 20 s aloft · ★ all the line out at a high angle (the round ends 2 s after the ★
  or at 60 s) → **`medal:kite:1..3`** through the kit; points = seconds aloft + 10 for the top (the kit keeps the best;
  a records row). BAYBAY stands beside you across the wind and flies her own (blue) kite; the camera stands upwind
  behind you, low, looking up the line (a per-frame shot, released at the end); walking 14 u away ends it for free.
- **Registration** (`play/index.ts`, one line): `registerKites()` from `play/kiteEntry.ts` (the ask items; tiny, part of
  the play core). **Records** (`economy/records.ts`, appended): `kite` (points).
- **Tests**: `tests/opus-bay-w7-w2-hideseek.test.ts` (2: the tap runs one 10 ms nav query and the rest over the count —
  red on the old code, which ran all six in the tap; nothing found later → the fixed line), the W6 test file updated
  (the found bubble is the fixed line, the chip holds the seconds; the coach line without the emote coach);
  `tests/opus-bay-w7-w2-kite.test.ts` (5: the physics; a player who plays by the gauge reaches ★ inside the round for
  four seeds, doing nothing never does; a whole round through the frame systems → `medal:kite:3`, 不玩了 and walking off
  free, the camera released; where it is offered; the ambient kites (four, downwind of their stakes, 5–14 u up, none at
  night, the afternoon breeze stronger, one kind on `ob-toy-inst`); the words fixed; the records row; the chunks lazy
  and ≤ 6 KB, nothing in GameRoot).

### Evidence

- Played (dev 5709, `?world=city&time=day&at=xz:-380,300`), desktop 1440 × 900: the ambient kites over Marina Green
  (`qa/w7/W2/b2-marina-kites-desk.jpg`: a yellow kite with its red tail and the strings, Alcatraz beyond); 问 BAYBAY
  shows 放风筝 / Kite flying as item 4 (the menu's second row); after two held gusts (Space) the chip reads "Kite flying
  70% · Lull: let it climb" and the camera looks up the line at the player's red kite, BAYBAY's blue one and the
  ambient kites (`b2-kite-desk.jpg`). Phone 390 × 844 dpr 3 (touch, quality mid): the chip with the gauge, 起风 status and
  the 放线 / Let out button held by a touch (`b2-kite-phone.jpg`).
- Draw calls: the ambient layer is one InstancedMesh (+1 call, 80 triangles) only within 240 u of the lawn by day; a
  round adds one more (10 instances, 40 triangles).

### Decisions

- **Strings are staked, not held** for the ambient kites: a stake in the lawn instead of a toy flyer keeps the kind at
  one mesh (people would be a second kind); from the promenade the kites and their strings read as a kite lawn.
- **One kind for everything**: the sail, the bows and the string are the same diamond (a string is a 5 cm-wide diamond
  turned to the camera), so the ambient kites and the round cost one draw call each.
- **Touch-first**: the chip's own hold button (lane A's PlayChip `hold`) is the control; the keyboard mirrors it.
- **Wind from the WNW**: San Francisco's sea breeze; the kites always fly toward the east-south-east of their flyer.
- **Hide & seek's hitch**: spread over frames rather than made cheaper (the nav queries are what they are; 6 ms a frame
  is under the frame budget on a desktop, and the count hides it).

### Facts (checked on the web 2026-09-29)

- Marina Green: a waterfront lawn known for kite flying, with a steady bay breeze from the west, liveliest in the
  afternoon — https://goldengatepark.com/marina-green-park.html , https://sanfranciscojeeptours.com/attractions/marina-green/

### Known gaps

- The chip's hold button is 74 × 32 CSS px on the phone (lane A's PlayChip; lane K owns the chip's ≥ 44 px work).
- The view spot's 坐下 prompt (E) stays on screen during a round at Marina Green's lookout.
- Crissy Field has the activity but no ambient kites (the brief named Marina Green).

## Part c · W7-W2c 那是什么？ the skyline quiz

Started 22:05 PDT.

### What was built

- **`play/skyline.ts`** (a lazy chunk): 问 BAYBAY → 那是什么？ / What's that? anywhere in free roam on foot. At the tap the
  nine landmarks of `play/skylineLines.ts` are tested for a **real line of sight** from your eye: a ray over the ground's
  height field and every roof / tall part the glide knows (`terrainGlideWorld` + `LiveTall`: the streamed city's
  building tops, the landmark sites' measured tall parts, the hero towers, the Bay Bridge), 1.5 u samples near you
  growing to 12 u far off, 30–1500 u away, the landmark's own radius excepted. Three rounds from the ones in sight:
  BAYBAY turns and points, the **camera turns** from behind you to the landmark (a 1.1 s shot), a touch card offers
  **three names** (48 px buttons); an answer lights the right one, BAYBAY says 答对啦！ / 差一点！ and then the landmark's
  **one-line fact** (fixed text that names the landmark); ● one right · ◆ two · ★ three → **`medal:skyline:n`**,
  points = right answers (a records row). Nothing in sight → her fixed line and the nearest 看风景 spot's name; no round.
- **`play/skylineLines.ts`**: the words and the nine landmarks (Golden Gate Bridge, Sutro Tower, City Hall, Coit Tower,
  Transamerica Pyramid, Salesforce Tower, Ferry Building, Bay Bridge, Alcatraz) with their aim points (checked against
  their sources by the test) and facts.
- **`play/kiteEntry.ts`** (part of the play core): both ask items (放风筝, 那是什么？) and nothing else — the play core
  is at **6,110 B** of its 6,144 B budget (`tests/opus-bay-w5-play-acts` W5-A1; it was 6,740 B with the first kite
  entry, which pulled `partc.ts` and every kite line into the core); the kite zone and the ambient kites moved to
  `play/kiteZone.ts` (a small chunk loaded at init).
- Records row `skyline` (points), appended.
- **Tests** `tests/opus-bay-w7-w2-skyline.test.ts` (3): the aim points match the measured tops (landmark tall parts,
  `heroTall`, `bayBridgeTall`) and every fact names its landmark; the line of sight (a roof half way hides it, its own
  footprint does not, too near / too far); a round of three through the frame systems (the card, the camera shot,
  right / wrong lines, two right → `medal:skyline:2`, the camera released) and nothing in sight → no round, her line.

### Evidence

- Played at Marina Green (desktop): the camera turned to the Golden Gate Bridge, the card "Sutro Tower · Salesforce
  Tower · Golden Gate Bridge"; answering Sutro Tower struck it through, lit Golden Gate Bridge, and BAYBAY said "That's
  the Golden Gate Bridge! It opened in 1937; its towers rise 746 feet above the water." (`qa/w7/W2/c1-skyline-desk.jpg`).
  The first try stood the camera 5.5 u back, inside a street tree's canopy (a green wedge on the right); it now stands
  3.8 u back.

### Decisions

- **Nine landmarks, all tall and famous**, each with a fact from its official or a well-sourced page; names only on the
  card (no lettering in the world).
- **The ray test at the tap, not in the menu**: a menu that re-renders cannot afford nine rays, so the item is offered
  everywhere and she answers honestly when nothing is in sight.
- **Far buildings are not in the test** (only streamed chunks carry roofs; beyond them the far DEM's hills count): a
  landmark behind a far block may be asked about; near blocks, hills and the landmarks' own parts are tested.

### Facts (checked on the web 2026-09-29; also in `play/skylineLines.ts`)

- Golden Gate Bridge: towers 746 ft above the water, opened 27 May 1937 — https://presidio.gov/explore/blog/golden-gate-bridge-fun-facts
- Sutro Tower: 977 ft, finished 4 July 1973 — https://www.sutrotower.com/tower-history
- City Hall's dome: 307 ft, 42 ft taller than the US Capitol's — https://www.sf.gov/location--san-francisco-city-hall
- Coit Tower: 210 ft, 1933, murals inside — https://sfrecpark.org/facilities/facility/details/Coit-Tower-290
- Transamerica Pyramid: 853 ft, 1972, the tallest until 2017 — https://en.wikipedia.org/wiki/Transamerica_Pyramid
- Salesforce Tower: 1,070 ft, 2018, the tallest — https://en.wikipedia.org/wiki/List_of_tallest_buildings_in_San_Francisco
- Ferry Building: 1898, a 245 ft clock tower — https://en.wikipedia.org/wiki/San_Francisco_Ferry_Building
- Bay Bridge: opened 12 Nov 1936, six months before the Golden Gate — https://blog.bayareametro.gov/posts/happy-85th-bay-bridge
- Alcatraz's lighthouse (1854), the first on the US West Coast — https://www.nps.gov/places/000/alcatraz-lighthouse.htm

### Known gaps

- The quiz card and BAYBAY's fact bubble share the lower half of a phone screen with the HUD (not yet shot at 390 × 844).

## BAYBAY's new fixed lines (for lane X · voice), zh / en — exact text

Hide & seek (`play/hideSeek.ts` `HIDE_LINES` and the coach; wave 6's lines never got a voice, the found line is new):

| id | zh | en |
|---|---|---|
| hide.start | 捉迷藏！你数到三，我去藏好～ | Hide and seek! You count to three, I’ll hide! |
| hide.found | 被你找到啦！ | You found me! |
| hide.giveUp | 我在这儿呢～下次再来找我！ | Here I am! Find me next time! |
| hide.nowhere | 这里没地方藏～换个地方再玩吧！ | Nowhere to hide here. Let’s try somewhere else! |
| hide.coachTouch | 想玩捉迷藏吗？点「问 BAYBAY」，再点「捉迷藏」！ | Fancy hide and seek? Tap Ask, then Hide & seek! |
| hide.coachKeys | 想玩捉迷藏吗？按 Q 问我，再选「捉迷藏」！ | Fancy hide and seek? Press Q to ask me, then Hide & seek! |

放风筝 (`play/kiteLines.ts` `KITE_LINES`, BAYBAY's bubbles only; the chip's words are not spoken):

| id | zh | en |
|---|---|---|
| kite.start | 放风筝咯！起风的时候按住放线，一松手它就往上爬！ | Kite time! Hold to let the line out in a gust, let go and it climbs! |
| kite.up | 飞起来啦！ | It’s flying! |
| kite.dive | 放太久啦，它在往下栽！快松手！ | Too much line — it’s diving! Let go! |
| kite.crash | 哎呀，掉下来了！再放一次～ | Oops, it came down! Up it goes again! |
| kite.top | 线全放完啦，飞得好高！ | All the line out — look how high! |
| kite.done | 码头绿地的海风最适合放风筝了！ | The sea breeze on Marina Green is made for kites! |

那是什么？ (`play/skylineLines.ts` `SKYLINE_LINES` and each landmark's `fact`):

| id | zh | en |
|---|---|---|
| sky.start | 考考你！我指的那个是什么？ | Quiz time! What’s that I’m pointing at? |
| sky.next | 下一个！那个呢？ | Next one! And that? |
| sky.right | 答对啦！ | That’s right! |
| sky.wrong | 差一点！ | Not quite! |
| sky.allRight | 全答对了，你是旧金山通！ | All correct: you know your San Francisco! |
| sky.done | 又认识了几个地标！ | A few more landmarks you know now! |
| sky.noView | 从这儿看不到大地标呢，去附近的观景点看看吧！ | No big landmarks in sight from here. Let’s try a lookout nearby! |
| sky.ggb | 那是金门大桥！1937 年通车，桥塔高出水面 227 米。 | That’s the Golden Gate Bridge! It opened in 1937; its towers rise 746 feet above the water. |
| sky.sutro | 那是苏特罗塔！1973 年建成的电视塔，高 298 米。 | That’s Sutro Tower, the TV tower: 977 feet tall since 1973. |
| sky.cityHall | 那是市政厅的圆顶！比美国国会大厦的圆顶还高 13 米。 | That’s City Hall’s dome, 42 feet taller than the US Capitol’s! |
| sky.coit | 那是科伊特塔！1933 年建成，塔里画满了壁画。 | That’s Coit Tower! Built in 1933, with murals painted all around inside. |
| sky.transamerica | 那是泛美金字塔！1972 年建成，当了四十多年全城最高楼。 | That’s the Transamerica Pyramid! Built in 1972, the city’s tallest for over forty years. |
| sky.salesforce | 那是 Salesforce 大楼，现在旧金山最高的楼，326 米！ | That’s Salesforce Tower, the tallest in San Francisco: 1,070 feet! |
| sky.ferry | 那是渡轮大厦！1898 年建成，钟楼高 75 米。 | That’s the Ferry Building! Built in 1898, with a 245-foot clock tower. |
| sky.bayBridge | 那是海湾大桥！1936 年通车，比金门大桥还早半年。 | That’s the Bay Bridge! It opened in 1936, six months before the Golden Gate. |
| sky.alcatraz | 那是恶魔岛！岛上的灯塔是美国西海岸的第一座灯塔。 | That’s Alcatraz! Its lighthouse was the first on the US West Coast. |

(The one templated bubble left is the lookout's name after `sky.noView`: 最近的观景点：<name> — text only, not voiced.)

## Part d · W7-W2d Union Square to T2

Started 23:40 PDT (parts b and c pushed 22:57 as `f8512c0f`, `049762fc`, `3568e2b5`, `c3dd95cc`; checks on the rebased
tree before the push: tsc 0 · eslint 0 errors (43 old warnings) · suite **1558 / 1558**; the second rebase before the
push brought lanes H, V, X only (no shared file): tsc 0 on the pushed tree).

### What was built

- **`world/sf/landmarks/union-square.ts`** (T2 now, ≤ 2.5k triangles, still ONE TOY mesh, 0 new calls; `w4.budget`
  600 → 2500, lod0R 200 kept): the **four Hearts in San Francisco** at the square's corners (painted toy hearts on low
  granite plinths: two lobes and a point in two colours each, no lettering); the **café** in the Stockton / Post
  quarter (four tables under **red umbrellas**, chairs, a small kiosk with a green roof and shop windows); raised
  **planters** with hedges along Powell and Stockton; two granite **steps down to Geary St**; three more lamps (lit at
  night: the site's `lights`). Walk blockers for the hearts, the tables, the kiosk and the planters (the palms, the
  column and the benches as before); `tops.ts`: the union-square row re-measured (only that row changed).
- The measured cost (the w4 budget test): lod 0 **1,924** + ground 74 = 1,998 / 2,500; lod 2 44 (2.3 %).

### Evidence

- Desktop, golden hour, from Geary St low (`qa/w7/W2/d1-union-square-desk.jpg`): the Dewey column's base and a bench in
  front, the café's red umbrellas and tables, a pink-and-blue heart by the kiosk, a planter, the lamps. Draw calls /
  triangles there 102 / 265k (budget-views, not fps; the W6-Z union-square walking spot was 84 / 242k — a different
  camera, so not a before / after pair; the site's mesh count is unchanged).
- Tests: `tests/opus-bay-sf-sites-w4.test.ts`, `-sf-landmark-context`, `-sf-landmarks`, `-w6-w-hideseek` (Union
  Square's start and hiding spots) 54 / 54.

### Decisions

- **The café's corner is approximate**: the 2002 design has a café with open-air seating (source below), but which
  corner it stands on was not verified tonight; it sits in the Stockton / Post quarter, clear of the arrival spot, the
  benches and the palms.
- No stage (its place and size not verified); the terraces are two granite steps along Geary.

### Facts (checked on the web 2026-09-29)

- The 2002 redesign (April Philips Design Works with MD Fotheringham): a large central plaza, terraces and steps down to
  Geary St, four corner plazas with the signature palms, a café with open-air seating, a stage —
  https://www.unionsquarepark.us/HistoryPage.html , https://apdw.com/portfolio/urban/union-square/
- Four Hearts in San Francisco sculptures in Union Square, the newest (SŌL, by Dev Heyrana) at Powell & Geary —
  https://sfghf.org/news/new-union-square-heart-brightens-up-downtown/

### Not done

- (6) the busker play-along (Haight / Calle 24) and Chase Center to T2: not started (time; stopped at 00:30 as the
  brief says).
- A 390 × 844 shot of the skyline card and of Union Square.

## Requests

- **Lane X** (voice): the lines in the three tables above, exact text (zh + en), for `data/sf/voiceW7.ts`.
- **Lane K** (the chip's owner, `play/PlayChip.tsx`): the chip's **hold button** is 74 × 32 CSS px on a phone (measured
  on 放风筝's 放线 / Let out) — the same ≥ 44 px on a coarse pointer as your 放弃 fix, please.
- **Lanes M, K** (anyone adding to `play/index.ts`): the play core is at 6,110 / 6,144 B gzip (W5-A1): register through
  a dynamic import, as `play/kiteEntry.ts` does; a new static import of a `play/` module breaks the budget.
- **Lane B** (the toy Alcatraz ferry): see part a.

- **Lane B / the lead** (`tests/opus-bay-w5-deadlock.test.ts`): "W5-bus 20+ simulated minutes" fails when run alone
  (and failed once in a full run at 23:07) with `bus at an interlock stood 29.2 s (box:f-line@5661:750) at (149, 601)`
  (limit 25 s), at `c3dd95cc`, at `68037235` and with Alcatraz taken out of `W7_SITES` (same 29.2 s) — not this lane's
  change; before W7-B1 (`80ef896b`) it failed with the day-0 "forced blockers (29)". It passed in this lane's full run
  at 22:56 (1558 / 1558).
