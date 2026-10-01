# Wave 8 · lane W2 · the west side & neighbourhood looks

Lane W2 of wave 8 (`docs/opus-bay/sf-w8-lead.md` §3 row W2, run inside the Ultra workflow `wf_66c65596-f6a`, §7),
worktree `C:/Users/willy/wt/w8-w2`, dev port 5808, scratch `C:/Users/willy/opus-qa/w8/w2/`. Higgsfield cap 60 credits.

## 给主人的摘要

1. **海洋海滩有冲浪的人了**：白天海里有 11 个玩具冲浪手（凯利湾 4 个、Judah 街 N 线终点站前 7 个），坐在板上随浪起伏等浪、划水、站起来冲一段、再划回去；前面一道道白浪滚上沙滩。天黑他们就回家了。只是风景，不是玩家能玩的项目（游戏从不建议下海）。
2. **悬崖屋外的海豹岩**：按 OpenStreetMap 的真实位置摆了两座礁石（大的一座约 5 米高的玩具尺寸），顶上被鸬鹚鸟粪染白，下面平台上躺着海狮、水里有海狮探头、顶上站着鸬鹚、海鸥绕着飞。第一版的礁石像"企鹅脸"（圆白顶 + 两只鸟像眼睛），已经改成尖尖的岩峰。
3. 整个海边只多 **1 次绘制**、约 1.2 万三角形，离开海边 420 米就不画。BAYBAY 在海滩 / 悬崖屋边会说 5 句新台词（中英固定句，可配音）。

## Part a · W8-W2a Ocean Beach's surfers and Seal Rocks

Started 19:24 PDT (`date`; the first agent of this lane had worked 19:00–19:20 and left the work uncommitted: kept,
finished and tested here). Pushed ≈ 20:30 (see the push line below).

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
