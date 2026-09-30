# Wave 7 · lane H · Halloween world

Lane H of wave 7 (`docs/opus-bay/sf-w7-lead.md` §3): the Halloween season in the toy city, keyed off
`halloween/season.ts` (frozen). Worktree `C:/Users/willy/wt/w7-h`, dev port 5705, scratch `C:/Users/willy/opus-qa/w7/h/`,
QA images `docs/opus-bay/qa/w7/H/`.

## 给主人的摘要

1. 十月的黄昏变成「南瓜色」：万圣节期间傍晚的海雾带一点橘色（只是颜色，不增加手机负担），BAYBAY 早就录好的那句「南瓜色的黄昏……」现在终于会说了。
2. 门口讨糖的小朋友（小幽灵 / 小女巫 / 小南瓜）会轻轻摇晃，门廊下挂着的小幽灵会随风荡来荡去；夜里的蝙蝠翅膀边缘带淡淡的月光色，天黑后也看得见了。
3. 找南瓜灯更容易：每个还没找到的南瓜灯上方飘着一团橙色的「小鬼火」，BAYBAY 走近时会说「南瓜灯的光在左边 / 右边 / 前面 / 后面」。
4. 夜里门口灯光多的时候，优先点亮离你最近的那些。
5. 亡灵节更真实：11/1 只有剪纸旗、万寿菊和 24 街 Acción Latina 的社区祭坛；11/2 早上 8 点起公园里摆满祭坛；傍晚 6 点大家戴着万寿菊花冠、捧着蜡烛在 22 街和布莱恩特街口集合，晚上 7–9 点小人们排成两列沿布莱恩特街 → 24 街 → 教会街 → 22 街慢慢走，每到街角停一下（真实游行在街角有阿兹特克舞蹈），路上的玩具车会停下来等他们。2026 年官方还没公布，台词都说「通常……以官网为准」。
6. 10/17 Sunnydale 南瓜节、10/24 Thrive City 万圣节活动当天，活动摊位两边摆上干草垛和南瓜（时间跟网站活动数据走）；门口的南瓜不再和 G 线讨糖的门挤在一起。
7. 新台词 9 句（中英各一，固定文字，可配音），21:50 已推送给 X 线录音。

## Part a · W7-H1 the pumpkin dusk · W7-H2 figures that move · W7-H3 bats at night · W7-H4 the glow nearest first · W7-H8 the lantern guide (20:25 – 21:15 PDT)

### What was built

- **The pumpkin dusk (W7-H1).** `world/sf/fog.ts` (surgical, lane H's row): `KarlState.setGoldenTint(color | null,
  amount, instant)` — a feature PUSHES a warm tint that applies only at golden hour (in `retarget`, Karl's golden colour
  is lerped toward it) and slides with Karl's own 45 s slide; `goldenTint` reads it back. fog.ts imports nothing of the
  Halloween feature (a test checks the source). `halloween/world.ts` pushes `DUSK_TINT` `#f2a65a` × **0.35** while the
  phase is not `'off'` (`duskTintFor(phase)`): the first push into a world's Karl is instant (at load), a phase change
  slides, the teardown clears it. BAYBAY's already-recorded `w6-h-dusk` line ("南瓜色的黄昏，有一点点神秘，又很温柔～") is
  now offered at the season's golden hour (once a Bay day, the season's own scheduler and gates).
- **Trick-or-treaters and hanging ghosts move (W7-H2).** `halloween/worldDress.ts`: the stoop mesh is drawn with the static
  `TOY` material (the city L0 cells' program `ob-toy`, a plain Mesh with receiveShadow: nothing new to link) instead of
  `TOY_DYN`, and its **wind sway** (vertex shader: xz += (0.16 sin + 0.025 sin) · aInfo.z², `uWind` 1) is the life:
  `swayInfo(y0, h, k)` writes aInfo.z = k·√t per vertex, so a trick-or-treater rocks from the feet (0) to the head
  (`FIGURE_SWAY` 0.75 → ≈ 0.09 u) and a hanging ghost swings from its hook (0) down to its hem (`GHOST_SWAY` 0.87 → ≈ 0.12
  u; the string bends with it). No new call, no per-frame CPU work. Pumpkins, lanterns and webs keep z = 0.
- **Bats readable at full night (W7-H3).** `createBats()`: the wing tips carry a pale lavender rim `#b3a6dc` with the toy
  shader's night glow (`BAT_GLOW` tip 0.55, shoulder 0.2, body 0.12; (0, 1] = night only), the body stays dark, the
  bats are ≈ 15 % bigger (`BAT_SIZE` 0.3; the flight band test still clears the hills). Against the dark-blue night sky
  they read as dark bodies with moonlit wing edges.
- **The glow nearest first (W7-H4).** `nearestHalos(cells, px, pz, cap)`: every stoop halo of the cells in reach sorted by
  its distance to the player, the first `DRESS_HALOS_BY_QUALITY[q]` kept (W6 kept whole cells in cell order, so a far
  corner of a near cell could win over the house next door); re-sorted when the player has moved `HALO_RESORT` 8 u or
  the quality changes. The pool's priorities (hunt 2, muertos / haunt 1, stoops 0) unchanged.
- **The lantern guide (W7-H8)** (the hunt postcard waits at all 40; `economy/hints.ts` `HINT_KINDS` untouched):
  - `halloween/huntGuide.ts` (new): `sniffSide(px, pz, yaw, lx, lz)` → 前面 / 左边 / 右边 / 后面 from the camera's view
    (the camera sits at the player + (sin yaw, cos yaw) · d); `createHuntGuide()` says one of four fixed lines the first
    time the player comes within `HUNT_RADAR` 60 u of an unfound lantern (once a lantern a session, ≥ `SNIFF_GAP` 40 s
    apart, not closer than 12 u, only when BAYBAY may speak — the season's gates).
  - `halloween/hunt.ts`: a **wisp** over every unfound lantern — a glowing orange orb (always lit: aInfo.w 1.9) with a
    little tail, `WISP_UP` 2.3 u above it, drifting on the same TOY sway — built into the lanterns' own merged mesh (now
    on `TOY`, receiveShadow like the cells): no new call; a halo each at night (hunt priority). BAYBAY points one out
    once a Bay day (`huntWisp`, within 35 u). The `collect()` / milestone code is untouched (lane G's postcard hook goes
    there).
- **Día de los Muertos by the hour (W7-H6, first half).** `halloween/muertos.ts`: `muertosSchedule(date)` (pure) — 1
  November: the papel picado, the marigolds and Acción Latina's community altar; 2 November 08:00–21:00: the six
  Festival of Altars ofrendas at Potrero del Sol and the marigold arch at 22nd & Bryant; `procession` 'gather' 18:00–19:00,
  'walk' 19:00–21:00 with `walkS`; a `?halloween=muertos` preview on another date = 2 November with the altars at any
  hour. `buildMuertos(halos, altars)` leaves the park and the arch out; `spotShown()` gates the finds; the mesh rebuilds
  when the altars come or go. `near()` now returns the lines on offer in order (the gathering line near 22nd & Bryant
  18:00–19:00, the eve line on 1 November).
- **BAYBAY's new fixed lines** (`halloween/worldLines.ts`, pushed with this part for lane X): `W7_WORLD_LINES`, ids
  `w7-h-*` — hunt-ahead / hunt-left / hunt-right / hunt-behind / hunt-wisp, muertos-eve, procession-gather,
  procession-walk, venue-pumpkins (zh ≤ 33 characters; every dated one says 通常 and 以官网为准 / "check the official
  site"). `ALL_WORLD_LINES` stays wave 6's recorded list (lane X's W6-X4 test keeps passing); `EVERY_WORLD_LINE` = both.
- Tests: `tests/opus-bay-w7-h.test.ts` (7): the dusk tint (the colour at golden only, the slide, the dedupe, the phases,
  fog.ts free of the feature); the sway weights (feet 0, head > 0.6, offset 0.06–0.12 u, the ghost's hem, pumpkins 0, the
  TOY program key); the bats' rim; `nearestHalos`; the guide (the four sides, once a lantern, the gap, the radius); the
  muertos schedule (1 Nov, 2 Nov 07:59 / 08:00 / 18:00 / 19:30 / 21:00, the preview, the finds, the altar-less build);
  the new lines. `tests/opus-bay-w6-h.test.ts`: ids `w6-h-` or `w7-h-`.

### Evidence

- Checks on this tree: `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings) · the suite
  (see the push line) · the lane's files alone (w7-h, w6-h, w6-h-muertos, w6-h-review) 20 / 20.
- Dev server 5705, headless Chrome 1440 × 900 'high' (scratch driver `C:/Users/willy/opus-qa/w7/h/shots.mjs`):
  - Alamo Square walking view, `?halloween=night&time=night`: **93 calls / 321k triangles** (the stoops 23.8k, 227 stoops
    in 16 cells, 12 trick-or-treaters, bats at alamo-square). The W6 review measured 98 / 315k there. Golden hour, the same
    spot: 80 / 317k (halloween-world 2 calls / 26.0k). The Western Addition stoop street: 73 / 280k.
  - `qa/w7/H/h3-bats-night-alamo.jpg` (read): looking up at the Alamo Square colony at night — the bats show as pale
    lavender wing shapes against the dark-blue sky (W6: invisible there).
  - `qa/w7/H/h2-ghost-swings-two-frames.jpg` (read): the same hanging ghost 2.4 s apart — it has swung to the side, the
    string bent. `h2-witch-trick-or-treater.jpg` (read): a witch kid with her broom and pail by a carved jack-o'-lantern.
  - `qa/w7/H/h8-wisp-over-lantern-alamo.jpg` (read): the orange wisp floating over the hidden lantern on Alamo Square's
    lawn; BAYBAY said the wisp line there on her own ("See that little orange wisp? A lantern is hiding right under
    it!").
  - The dusk: Twin Peaks → the west at golden hour, `?halloween=1` vs `?halloween=0`, mean colour of the fog band
    (x 900–1440, y 380–460): at 0.18 (214, 191, 168) vs (208, 187, 166) — hard to see; at **0.35** (214, 188, 163). Walking
    in the Outer Sunset inside the golden bank (`qa/w7/H/h1-pumpkin-dusk-sunset.jpg`, read): a soft apricot haze.

### Decisions

- The dusk tint is **0.35**, not the ≈ 0.18 of the request: measured, 0.18 moved the fog band by ≤ 6 / 255 (not visible);
  0.35 reads as a warm apricot haze inside the bank and is still soft. It runs in every season phase (1 Oct – 2 Nov,
  muertos included: marigold dusk); the dusk LINE only in 'season' / 'night'.
- Movement through the shared TOY sway (xz only), not a new material: a sway / rock instead of a vertical bob, but zero new
  programs and zero calls — the safest on a phone.
- The guide speaks per lantern per session (not once a Bay day): 40 lanterns across the city need more than one hint a
  day; the gap (40 s) and the gates keep it quiet.
- The wisps float over every unfound lantern in draw reach (240 u): generous on purpose (the postcard needs all 40); a
  0.2 u orb is only visible within ≈ 80 u.

### Known gaps

- The sway is horizontal (the kids rock, they do not hop).
- The dusk tint colours Karl's bank (the west side, the Gate); downtown at golden hour barely changes (no bank there).

### Requests

- **Lane X**: record `W7_WORLD_LINES` in `src/opus-bay/halloween/worldLines.ts` (9 lines, ids `w7-h-*`) into
  `data/sf/voiceW7.ts`. `w6-h-dusk` (already recorded) now plays: take it off any "never plays" list.

Push: `4c8ff682` (part a) on origin/opus-bay, 21:48 PDT, after rebasing onto W2 / R / S: tsc 0 · eslint 0 errors · the
suite 1517 / 1519 on the tree before the last rebases (the two: the wall-clock "A* is time-sliced", green alone, and a
part-b test file not in that push); after the rebases tsc 0 and the lane's and the incoming lanes' test files 81 / 81.

## Part b · W7-H6 the procession · W7-H7 pumpkins at the pumpkin events · W7-H5 no stoop by a treat door (21:50 – 22:40 PDT)

### What was built

- **The Día de los Muertos procession (W7-H6).**
  - `scripts/opus-sf/muertos-place.mts` (owned): also computes 22nd & Mission and writes `PROCESSION` — the closed route
    in the curb lane on the loop's inside (each street's centreline moved w / 2 − 0.8 u toward the middle of the loop,
    the corners where those lines meet), x / z / ground y every ≈ 2 u — `PROCESSION_LENGTH` 318.8 u,
    `PROCESSION_CORNERS`, `ROUTE_CORNERS.mission22` (361.6, 670.32). Every other output of the script is identical (the
    altars, picado, marigolds; `muertos:n` unchanged). The script's hard-coded wave-6 worktree path is gone (it writes
    into the repo it lives in; the same fix in `halloween-place.mts`).
  - `src/opus-bay/halloween/muertosWalkers.ts` (new): `processionRoute()`, `routeAt(s)`, `processionCorners()` (the four
    sharpest turns: within 4 u of the street crossings), `headAt(walkS, count)` — the head leaves the gathering at 19:00
    at `WALK.speed` 0.7 u/s and stands `WALK.pause` 18 s at each corner (the real procession pauses at the main corners
    for the Aztec dancers), lap after lap until 21:00; `createWalkers()` — `WALKERS_BY_QUALITY` low 14 / mid 26 / high 40
    toy walkers in two files: a long robe (TOY_INST_TINT, the instance colour: black, cream, purple, magenta, marigold,
    teal, deep red, indigo), a calavera-white face with painted eye sockets, a crown of five marigolds, a hand holding a
    lit candle (the flame always glows) on TOY_INST — **two instanced meshes, 2 calls, ≈ 330 triangles a walker**,
    receiveShadow like the city's instanced props (warmed programs), one bounding sphere over the route. 18:00–19:00
    they stand about on Bryant just south of 22nd (candles with halos); 19:00–21:00 they walk (a step bob and a small
    sway; at the corner pauses a gentle bob), no halos while walking (the flames glow).
  - `halloween/muertos.ts`: the walkers come with the schedule (`muertosSchedule().procession`), are stepped every frame
    (walkS runs on between the schedule's reads) and go at 21:00; their gathering halos join the altar candles in the
    pool; BAYBAY offers `processionWalk` ("游行的队伍过来了。我们在路边安静地看，好吗？") within 22 u of a walker and
    `processionGather` near 22nd & Bryant 18:00–19:00. Nothing to collect, no sound of their own.
  - **The toy traffic stops for them**: `src/opus-bay/world/sf/roadPeople.ts` (new, 20 lines) — `addRoadPeople(provider)`
    / `eachRoadPerson(put)`; `world/sf/cityLife.ts` (surgical, one line in `TrafficEnv.people`, named here: not lane H's
    file) adds them after the player, BAYBAY and the crossing walkers. With no provider the traffic is exactly as before.
- **Pumpkins at the season's pumpkin events (W7-H7).** `src/opus-bay/halloween/worldVenues.ts` (new): the catalog events
  `sf-sunnydale-pumpkin-fest-2026` (10/17 · 12:00–15:00, The Hub, 1530 Sunnydale Ave) and `sf-thrive-thrill-o-ween-2026`
  (10/24 · 12:00–17:00, Thrive City) get a pumpkin patch either side of lane S's kit — hay bales with pumpkins, pumpkins
  on the ground, four carved ones that glow at night — **exactly while the event's window is on** (`realsf/events.ts`
  `activeEventsAt`: the dates and hours are the catalog's, DESIGN §8), past the kit's own footprint (`KIT_FOOTPRINT` +
  0.8 u), each spot kept only on standable ground off the roadway; one mesh on TOY (1 call there, then); BAYBAY's
  `venuePumpkins` line within 30 u. `halloween/world.ts` wires it ('season' / 'night' only) and its halos.
- **No stoop by a treat door (W7-H5).** `scripts/opus-sf/halloween-place.mts` leaves out a stoop within `DOOR_CLEAR` 3.5 u
  of one of lane G's treat doors or its knock spot (`TREAT_DOORS`, `KNOCK_OUT`); `worldSpots.ts` regenerated: **2 062 →
  2 057 stoops** (5 left out; 108 trick-or-treaters as before; `huntSpots.ts` identical). `worldDress.ts`
  `stoopsByDoors()` also skips any stoop near a door G appends later (treatDoors.ts is append-only) — empty today.
- Tests: `tests/opus-bay-w7-h-muertos.test.ts` (7): the route (closed, corners at the crossings, south on Bryant first);
  `headAt` (starts at the gathering, pauses at 24th & Bryant, never goes back, one lap later one route further, 5–30
  laps in two hours); the walkers (two meshes on TOY_INST / TOY_INST_TINT, < 420 triangles each, the flame glows, on
  the route, halos only while gathering); the road-people registry and cityLife's hook; muertos on 2 November on the Bay
  clock (none at 17:30, gathering 18:20 with its line, walking 19:05 with BAYBAY's line and every walker in the
  traffic's people, gone at 21:00); the pumpkin patches (S's venue rows exist, past the fair's footprint, 14 spots, 4
  halos, only in the window / near / in season / for a pumpkin event); no stoop within 3.5 u of a door.

### Evidence

- Lane H's test files: 30 / 30 (w7-h, w7-h-muertos, w6-h, w6-h-muertos, w6-h-review). Full checks: see the push line.
- In the game (dev 5705, 1440 × 900 'high'): `?date=2026-11-02T18:30&time=night` — `qa/w7/H/h6-procession-gathers-bryant.jpg`
  (read): the walkers lined up on Bryant with candles lit; BAYBAY said the gathering line on her own.
  `?date=2026-11-02T19:02&time=night` — `qa/w7/H/h6-procession-24th-st-night.jpg` (read): two files of walkers coming up
  24th St under the papel picado, marigold crowns, white calavera faces, candle flames; 40 walkers, 79 calls / 289k
  triangles there (halloween-world 6 calls / 47k: the stoops 23k, the Mission's dressing 8.9k, the walkers ≈ 13k, the
  pool). `?date=2026-10-24T13:00` — `qa/w7/H/h7-thrive-city-pumpkins.jpg` (read): hay bales and pumpkins either side of
  the Thrill-O-Ween kit (13 of 14 spots placed); `?date=2026-10-17T13:00` Sunnydale: 10 of 14 placed (on the grass by
  the tents; the kit's other side is a house). `?date=2026-11-01T12:00` (read, scratch `m1/`): Potrero del Sol's lawn
  empty, the papel picado over 24th St, the Mission's dressing 3.5k triangles (no altars, no arch); BAYBAY's hello there.
  The phone (390 × 844, dpr 3, 'mid') at the procession on 24th St: 26 walkers, 61 calls / 177k triangles
  (halloween-world 6 / 31.7k).
- **Calls / triangles (the perf budget)**, `?halloween=night&time=night`, walking views:

  | spot | desktop 1440 × 900 'high' | Halloween share | phone 390 × 844 dpr 3 'mid' | Halloween share |
  |---|---|---|---|---|
  | Alamo Square (W6 review, before) | 98 / 315k | 24.0k tris | 74 / 225k | 12.7k tris |
  | Alamo Square (now) | 99 / 326k | 4 calls / 27.5k | 77 / 237k | 4 calls / 15.9k |
  | Belvedere St, a treat street (now) | 99 / 334k | 3 calls / 26.2k | 62 / 231k | 3 calls / 15.4k |

  The Halloween share grew ≈ 3k triangles (the wisps, ≈ 100 a lantern, the hunt's lanterns in reach); no new call at
  either spot (the wisps and the sway ride existing meshes). The procession adds 2 calls and ≈ 13k (high) / 8.6k (mid)
  triangles, only on 2 November 18:00–21:00 in the Mission. All inside ≤ 150 calls / 400k.

### Real-world facts (checked on the web 2026-09-29)

- 2026 not posted: https://www.dayofthedeadsf.org/festival-of-altars shows only "November 2, 2025 @ Potrero Del Sol
  Park" (installation from 8 a.m., entertainment 5–9 p.m.); https://www.calle24sf.org (home page) shows no Día de los
  Muertos 2026 date.
- The procession (2025): 2 November, 7 p.m., from 22nd & Bryant, south on Bryant, west on 24th, north on Mission, east
  on 22nd back to Bryant — https://www.sfmta.com/travel-updates/dia-de-los-muertos-procession-sunday-november-2-2025; led
  by Aztec dancers who pause for a ritual dance at each main corner —
  https://www.nbcbayarea.com/news/local/san-francisco/dia-de-los-muertos-procession-san-francisco/3697854/ and
  https://sf.funcheap.com/sf-dia-de-los-muertos-procession-mission/ (gather ≈ 6 p.m.).
- The two pumpkin events: the BAYLINK catalog (`public/planner-catalog.json`, verified by the site 2026-09-28 / 29); the
  game reads their dates and hours from it at runtime.

### Decisions

- The walkers circle the route from 19:00 to 21:00 (a toy procession of 14–40 cannot be a two-hour column): one group,
  slow, pausing at every corner; they stand about from 18:00. Respectful: no reward, no sound, no costume play; BAYBAY
  asks to watch quietly.
- They walk the curb lane on the loop's inside (the streets are 3.6–4.4 u wide in the toy city), and the toy traffic
  stops short of them (a surgical line in cityLife, a registry of our own): cars behind them wait or are recycled by the
  traffic's own stuck rule. Candle halos only while they stand (a moving halo would lag its flame).
- Pumpkins at the events follow the catalog's window exactly (no set-up / tear-down hours invented).
- The runtime door guard stays although the placement already keeps clear: G may append doors.

### Known gaps

- The walkers are rigid toy figures (a bob and a sway, no swinging legs); robe colours read dark at night (the faces,
  crowns and candles carry them).
- Where the route's corners cut the kerb, 17 of 160 samples lie just off the roadway.
- A player standing in the procession's lane is walked through (the walkers do not steer).

### Requests

- **Lane X**: `W7_WORLD_LINES` (9, pushed 21:50) — `processionGather`, `processionWalk`, `venuePumpkins`, `muertosEve`
  are live with this part.
- **Lane B** (traffic, FYI): `world/sf/cityLife.ts` `TrafficEnv.people` now also calls `eachRoadPerson(put)`
  (`world/sf/roadPeople.ts`); nothing registers outside 2 November 18:00–21:00 in the Mission.

Checks before the part-b push (22:28 PDT, the tree on origin 4c8ff682 + part b): `npx tsc -p tsconfig.app.json --noEmit`
0 · `npx eslint .` 0 errors (43 old warnings) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts`
**1526 / 1526**.
Then rebased onto K / G / R / W1 / P (1544 / 1544 on that tree, tsc 0, eslint 0 errors) and once more onto V / X / S / B:
tsc 0 and their test files with lane H's 80 / 80. Pushed `ccebe232` (22:54 PDT).

## Part c · small costs and checks (22:55 – 23:25 PDT)

### What was built

- `halloween/worldVenues.ts`: `PUMPKIN_KITS` (lane S's venue rows that list a pumpkin event: Sunnydale, Thrive City) —
  the catalog is scanned (`activeEventsAt`, ≈ 300 events, twice a second) only when the player is within `VENUE_NEAR` of
  one of them; anywhere else the step is two distance checks (it scanned everywhere in part b).
- `halloween/worldDress.ts` `stoopsByDoors()`: a cheap x reject before the distance (≈ 220k pairs once, at the first
  stoop index).
- Tests: the kits (two), no catalog scan far from them, one near.

### Evidence

- District mode unchanged: `?world=district&halloween=night&time=night` (dev 5705) — the Ferry Building district at
  night, 0 / 8 postcards, no `__opusBay.halloween` (the feature is city-only; `world/sf/fog.ts`' KarlState is null in the
  district) — scratch `C:/Users/willy/opus-qa/w7/h/district.jpg` (read). The hero regression is in the suite.

### Not done (lane H's row)

- Nothing of the row is left undone; see each part's Known gaps (the sway is horizontal, the walkers are rigid figures
  and walk through a player in their lane, the dusk tint shows where Karl's bank is).

### Requests

- **Lane B / the lead — `W5-bus 20+ simulated minutes` is red on origin itself**: on `90dc7798` (origin/opus-bay at
  23:18, a clean temporary worktree, lane H's cityLife line or not) it fails every run, deterministically: "bus at an
  interlock stood 29.2 s (box:f-line@5661:750) at (149, 601)" (> the test's bound). It passed in lane H's full run on
  the tree before the rebase onto B / X / V / S (22:30, 1544 / 1544). Not lane H's files; not touched here.
- The lead: a leftover `.git/worktrees/w7-h-origin` admin entry in the main checkout (the temporary worktree above is
  gone and its `node_modules` junction was removed first; `git worktree prune` said "Permission denied" on the folder,
  as for an older `wt-origin`): prune it when the checkout is idle.

Checks before the part-c push (23:25 PDT): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old
warnings) · the suite **1566 / 1567** — the one is the deadlock test above (red on origin without lane H's change).

## Review (W7-H-review, 23:40 – 01:40 PDT, worktree `C:/Users/willy/wt/w7-h-rev`, dev port 5725)

### 给主人的摘要

1. H 线的万圣节世界可以上线：南瓜色黄昏、会摇晃的讨糖小孩和门廊小幽灵、夜里带月光边的蝙蝠、南瓜灯上方的小鬼火和 BAYBAY 指方向、亡灵节按真实时间、南瓜活动当天的南瓜堆，都逐条读过代码、在游戏里看过；街区模式（?world=district）完全不受影响。
2. 修好 1 个真问题：**亡灵节游行的集合地点**。旧金山交通局（SFMTA）2025 年游行公告写的是「傍晚 6 点起在 Bryant 街 19 街到 22 街之间集合，7 点出发」——在 22 街口的**北边**；H 线把小人们排在了 22 街口**南边**（游行路线第一段上）。现在 18:00–19:00 他们站在 22 街口北边的 Bryant 街上，19:00 从原地出发、向南穿过 22 街口再走原路线（不会瞬移）。顺手去掉了游行时每帧新建小数组的浪费。
3. 事实 9/30 重新上网核对：2026 年亡灵节官方仍未公布（dayofthedeadsf.org 只有 2025 年的祭坛节，calle24sf.org 首页没有），台词都写「通常……以官网为准」，与游戏一致。
4. 性能在预算内：手机阿拉莫广场万圣夜 77 次绘制 / 22.8 万三角形，讨糖街 Belvedere 电脑 101 / 33.1 万（W6 总验收同处 101 / 32.8 万）、手机 63 / 22.7 万；亡灵节游行集合时（22 街 & Bryant，40 个小人）电脑 104 / 34.3 万。
5. 没有阻止上线的问题。遗留：W5-bus 公交死锁测试在干净的 origin 上也失败（不是 H 线的改动，H 线和 R 线都已报告给 lead / B 线）。

### What was checked

- Every commit of the lane (`git log --grep "W7-H[0-9:]"`: 45c9d6f3, 4c8ff682, fa188ec0, a023a10e, ccebe232, 0b8a660d, 4bc614be) read in full:
  `world/sf/fog.ts` (setGoldenTint: surgical, imports nothing of the feature), `halloween/world.ts`, `worldDress.ts`,
  `hunt.ts`, `huntGuide.ts`, `muertos.ts`, `muertosWalkers.ts`, `muertosSpots.ts`, `worldVenues.ts`, `worldLines.ts`,
  `world/sf/roadPeople.ts`, the one line in `world/sf/cityLife.ts`, both placement scripts, the lane's tests.
- Correctness probes: the sniff side against the camera convention (`actors/camera.ts`: the camera at the player +
  (sin yaw, cos yaw) · d, so right = (cos yaw, −sin yaw): the lane's formula is right); the TOY switch (receiveShadow is a
  uniform in three's renderer, not a program key: no new program; TOY's `aInfo.x` 0 keeps the window pattern off, z > 0
  is the sway); `headAt` over two hours (monotonic, laps, corner pauses); the schedule's Bay-clock minutes and seconds;
  the catalog rows of the two pumpkin events (`public/planner-catalog.json`, verified by the site 2026-09-29).
- Teardown / world switch: stoops, hunt (wisps in its mesh), muertos (walkers: InstancedMesh.dispose, the road-people
  provider removed), venues, the pool and the Karl tint cleared — every owner disposes; the guide holds nothing.
- Per-frame work: the walkers (40 matrices a frame, only 2 Nov 18:00–21:00 within 260 u) — `headAt` built up to ~20
  two-element arrays and two result objects a frame (fixed below); the halo re-sort runs ≤ 1 Hz (the stoops' refresh).
- Save compatibility: no new save key (the guide's "told" set is per session; the finds unchanged).
- Text: the 9 `w7-h-*` lines zh + en fixed (no templates), the dated ones hedge (通常 · 以官网为准 / "check the official
  site"); 繁體 by the site's conversion as every lane; no new UI, so no touch targets.
- District: `?world=district&halloween=night&time=night` — the Ferry Building district at night, 0 / 8 postcards, no
  `__opusBay.halloween` (scratch `C:/Users/willy/opus-qa/w7/h-rev/district.jpg`, read).
- Perf (dev 5725; headless Chrome, `CHROME_FLAGS=--force_high_performance_gpu`):
  - desktop 1440 × 900 'high', W6-Z's runner (`w4-perf.mjs --file w6-halloween-spots.json --time night --halloween
    night --rides 0`): Belvedere St **101 calls / 331k**, 60.1 / 60.1 fps (W6-Z: 101 / 328k); the Alamo Square row was
    measured while the first session was still warming (programs 24 → 60, the walking camera turned away: 79 / 223k, one
    frame > 100 ms at the warm-up) — the lane's own 99 / 326k there stands.
  - phone 390 × 844 dpr 3 'mid' (the lane's views): Alamo Square night **77 / 228k** (Halloween 12.9k stoop tris, 342
    halos), Belvedere **63 / 227k** (W6-Z: 63 / 222k and 66 / 229k).
  - 2 November 18:40 at 22nd & Bryant (the gathering, 40 walkers, desktop 'high'): **104 / 343k** (halloween-world 6
    calls / 48k). All inside ≤ 150 / 400k.
- Real-world facts, re-checked 2026-09-30: https://www.dayofthedeadsf.org/festival-of-altars still shows only "November
  2, 2025 @ Potrero Del Sol Park" (installation 8 a.m., entertainment 5–9 p.m.); https://www.calle24sf.org has no
  Día de los Muertos 2026 date; SFMTA's 2025 notice
  (https://www.sfmta.com/travel-updates/dia-de-los-muertos-procession-sunday-november-2-2025): "begin staging at
  approximately 6 p.m. on Bryant, between 19th and 22nd streets", begins 7 p.m., south on Bryant / west on 24th / north
  on Mission / east on 22nd, closures 6:45–10 p.m. — the staging side is the defect below.

### Defects fixed (tests/opus-bay-w7-h-review.test.ts, red then green)

1. **The procession gathered on the wrong side of 22nd St.** SFMTA stages it on Bryant between 19th and 22nd (north of
   the crossing); `gatherHead()` put the head 24.75 u down the route's first leg, so 18:00–19:00 the 40 walkers stood on
   Bryant between 22nd and 23rd. Before: "a walker stands 24.4 u along the first leg (south of 22nd & Bryant is > 0)".
   After: the head waits `GATHER_BACK` 6 u before the route's start and the rows stand up Bryant north of 22nd
   (`placeAt(s < 0)`: the first heading extended backwards, ground sampled once from the city's terrain); at 19:00 they
   set off from where they stood (no jump), walk south through 22nd & Bryant without a stop there and then the lane's
   route, pauses and laps unchanged (the lane's tests still pass; its "gathering south of 22nd" line now reads the
   gathering radius). In the game: `qa/w7/H/rev-procession-gathers-north-of-22nd.jpg` (read; 2 Nov 18:40, looking north
   up Bryant under the papel picado: robes and candles in the curb lane beyond the crossing). (`halloween/muertosWalkers.ts`)
2. Per-frame garbage while the procession walks: `headAt` allocated a `[base, base + L]` array per corner per step
   (up to ~20 a frame) and a result object, and the step another; now a counted loop and one reused `out` object.

### Open items (not blocking)

- **W5-bus 20+ simulated minutes** (`tests/opus-bay-w5-deadlock.test.ts`) is red in the full suite and alone on this tree
  ("bus at an interlock stood 29.2 s (box:f-line@5661:750) at (149, 601)" — on Market St, far from anything of lane H's;
  nothing registers road people outside 2 November): lane H's and lane R's reports found it red on origin itself —
  for lane B / the lead.
- `E2-5 view field in the city` (the wall-clock "a cached cell is cheap" < 50 ms) failed once in a full run and once
  alone while other lanes' Chromes ran on the machine; not lane H's file.
- Dev servers share `node_modules/.vite` through the junction: another lane's server re-optimised the deps under mine
  (headless runs died with "Invalid hook call" / "Failed to fetch dynamically imported module"). I ran vite with a
  scratch config (`cacheDir` in `C:/Users/willy/opus-qa/w7/h-rev/vite-cache`) — a note for the lead's protocol.
- `w7-h-muertos-eve` zh "剪纸旗和万寿菊都挂好啦" — the marigolds stand in pots (not hung); left as pushed for lane X's
  recording (a text change would unmatch the voice).
- `world/sf/fog.ts` setGoldenTint's comment still says × 0.18 (the feature pushes 0.35, measured by the lane): comment only.
- The walker geometry is a module cache and stays after the procession (≈ 10 KB of GPU buffers; reused next time).
- The lane's known gaps stand: the sway is horizontal, the walkers are rigid and walk through a player in their lane,
  the dusk tint shows where Karl's bank is.

### Blocking the go-live to main

None from lane H.
