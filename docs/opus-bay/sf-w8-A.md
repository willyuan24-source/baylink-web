# Wave 8 · lane A · Alcatraz by ferry

Lane A of wave 8 (worktree `C:/Users/willy/wt/w8-a`, branch `w8-a`, dev port 5804, scratch `C:/Users/willy/opus-qa/w8/a/`).
A first agent worked 19:00–19:20 PDT (uncommitted: the route data, the pure shuttle, the game/transit hooks); this agent
resumed at 19:25 PDT, kept that work (reviewed, re-routed the crossing, made the give-way predictive, calibrated the
times) and finished it. Nothing of it was discarded.

## 给主人的摘要

1. **可以坐船去恶魔岛了**：在 33 号码头（恶魔岛渡轮码头）按 E，水手问去哪儿，坐上海军蓝条纹的小渡轮——倒出船位、掉头、让开海湾里的其他船，约 90 秒到岛上码头；BAYBAY 一起上船，设置打开时船会停住。
2. **班次照真实时刻表**：早上 8:40 第一班出发、下午 3:50 最后一班去岛上、傍晚 6:30 最后一班回来（感恩节、圣诞、元旦闭岛）；晚上小渡轮在码头休息，水手会提一句夜游团，"以官网为准"，不写票价。人在岛上时，任何时候船都会来接，不会被困。
3. **岛上能走了**：从码头沿 64 号楼走到台阶，爬上去就是监狱楼正门和灯塔平台；第一次走到正门有到达时刻（提示、镜头、印章 +10 金币、地点卡），BAYBAY 的台词轻松但尊重（联邦监狱 1934–63、1969–71 年"所有部落的印第安人"占领，均出自国家公园管理局官网）。
4. 船上有海鸥跟着飞，船的引擎声也有了。**性能**：33 号码头、船上、岛上桌面最多 91 次绘制 / 34 万三角形（上限 150 / 40 万），手机（390×844）最多 60 / 19 万；全城静态巡检 699 个点 0 卡住。
5. 10 月 9 日舰队周"舰船巡游"那一小时（11:00–12:00），小渡轮让军舰先过，在码头等到中午再开。

## Part a · W8-A1 the toy ferry and the island on foot (19:25–20:24 PDT, pushed `f80e8a2d`)

### What was built

- **The route** (`data/ferry.ts`): a second running ferry route `ferry-alcatraz` (shuttle) after the unchanged Ferry
  Building ⇄ Pier 41 boat. Terminals: `pier-33` — the quay on the pier33-front plaza east of the telescope, the berth in
  the slip between PIER 31 and PIER 33 (OSM: the floating pier "San Francisco Pier 33", way 740486822, and the stop
  "Ferry Alcatraz", node 3202359193, 37.8069704 −122.4041590, https://www.openstreetmap.org/node/3202359193, read
  2026-09-30) — and `alcatraz-dock` — the quay on the island's jetty, the berth 0.25 u off the ferry float (Alcatraz
  Ferry Terminal, OSM way 27999864; `FLOAT` in `alcatraz.ts`).
- **The shuttle** (`world/sf/alcatrazFerrySystem.ts`, pure): one boat. It lies in Pier 33's slip bow toward the shore,
  backs out past the pier heads (13 s), pivots on the slip's axis (7 s), crosses the waterfront's ferry tracks on that axis
  (west of life.ts's sailboat loop off Pier 35), runs west in a lane north of the other boats, rounds the island's
  south-west and lies alongside the float heading east: **91 s out, 55 s back, 20 s at each end** (a boat every ≈ 3
  minutes, toy time). The crossing **gives way**: no moving boat within 10 u of the crossing now or on its straight course
  for the next 16 s (life.ts's wake list = every ferry and sailboat it moves); it never stops once on it. The rider
  protocol of `data/transit` (request / board / cancel / rideStatus / rideLeft), the hop-off and Settings brake
  (`platformStop('ferry-alcatraz')`).
- **The timetable** (the official Day Tour summer schedule, 8 Mar – 1 Nov 2026,
  https://statue-static-content.s3.us-east-1.amazonaws.com/Alcatraz+City+Cruises+-+Schedule.pdf, read 2026-09-30):
  departures 8:40 … 3:50 p.m., return boats until 6:30 p.m.; closed Thanksgiving, Christmas Day, New Year's Day
  (https://alcatrazcitycruises.com/faq/, read 2026-09-30). The toy shuttles inside those hours. Out of hours Pier 33's
  deckhand says a fixed line instead of a ride (the first boat at 8:40; the last one out has gone; the night tour exists,
  Tuesday–Saturday; closed today) — every one ends 以官网为准 / "check the official site", **no prices**. The boat rests
  in its slip at night, **but a rider waiting on the island is always fetched** (no softlock).
- **The city layer** (`world/sf/alcatrazFerry.ts`, installed by `world/transitLayer.ts`): the boat = life.ts's ferry
  hull with the open sun deck and a navy stripe (1 TOY_DYN mesh, its shadow near the player), the platform
  `ferry-alcatraz` (the Ferry Building boat's deck plan: BAYBAY boards with you through the shared platform code), two
  quay signs (a navy board with a white toy boat over blue waves; no lettering), the horn / board / depart / arrive
  events, wake foam and bow spray near the player.
- **game/transit.ts** (lane K's, surgical, named in the commit): a terminal rides its own route's line; `boardFerry`
  shows the system's `serviceNote` as a deckhand dialogue; `ferryRideSeconds` / `ferryWaitSeconds` ask the line's own
  system; the quays' prompts refresh when a ferry line's system comes. `data/transit.ts`: `setFerrySystemFor`,
  `ferrySystemsEpoch`, `rideSystemFor('ferry-*')`. `world/world.ts`: `builtWorld()` (never builds a World: the W5
  deadlock test's transit layer built one through `getWorld()`).
- **The island on foot** (`world/sf/alcatrazWalk.ts`, registered by `world/sf/landmarks/alcatraz.ts`): the published
  ground rises ≈ 0.9–1.0 u per u from the dock to the plateau (the controller's wall grade), and the OSM switchback's
  legs lie 1.5–2 u apart (walk strips there would merge into a hillside you walk straight up), so the toy walk is: **the
  dock** (one deck at y 0.3 over the apron, the jetty and the float), **the dock road** along Building 64's water side,
  **a stairway** (drawn: 26 concrete steps on the slope, kerbs, a pipe rail) up between Building 64's west end and the
  Sally Port, and **the plateau** — the cellhouse front by the Administration Block's door and the lighthouse's terrace
  by the Warden's House ruin. New blockers: the lighthouse's base, the three small buildings by it, the Warden's House.
  Its **own walking graph** (quay → dock road → stair → cellhouse front → terrace); `onAlcatraz(x, z)`.
- **The sweep** (`scripts/opus-sf/qa/sweep-static.mts`): island targets are reached from the island graph's dock node
  (the city graph's main component is 400 u away); the graph's spots (stair top, cellhouse front, terrace) are targets.
- `world/sf/landmarks/tops.ts`: the alcatraz row re-measured (only that row changed).

### Evidence

- `tests/opus-bay-w8-a-ferry.test.ts` 9 / 9: the timetable on pinned clocks; the route and the unchanged district ferry;
  **every path sample's hull (11.8 × 4.2 u) over open water**, 1.5 u clear of land and the district's pier decks (0.4 u in
  the slip, alongside the float at the island), the pivot's swept circle clear (published city); the give-way crossing
  (held at the pivot while a boat sits on it, under way once clear, never stopping on it); leg times within 10 % of the
  ETAs; the night rest + the island fetch; **the ride through game/transit** (the deckhand, the open deck, the brake holds
  the boat mid-Bay, it counts once, the rider ends on the island's quay; the night line at Pier 33 starts no ride); the
  island walk (every graph edge walks with `actors/nav findPath`); Pier 33's quay on the city graph.
- Existing tests touched by the change 72 / 72 (alcatraz, ferry, jets, landmarks, w6-b, transit-verify, audio,
  transit-review). Full opus-bay suite on the rebased tree: 1689 / 1692 → the three red ones (the tops row, the air-coin
  ring reading it, the deadlock test's `getWorld`) fixed in the same commit → 29 / 29 in those files. tsc 0, eslint . 0
  errors.
- Static sweep (`--only arrival,station`): `ferry:pier-33` and `ferry:alcatraz-dock` CORRIDOR (reported, not a failure:
  a quay between the canopy and the slip / on the jetty), the island spots ok / CORRIDOR; 0 OFF / BOXED / SNAG /
  UNREACHABLE among lane A's targets (after the first run boxed the float and the east-of-lighthouse waypoints, which
  left the graph).

### Decisions

- **A shuttle of its own, not a loop**: Pier 33's slip is 8–18 u wide, too narrow to turn in; the boat backs out and
  pivots like a real ferry.
- **The crossing gives way, the ambient boats do not**: life.ts (lane X's) moves its ferries and sailboats on fixed
  loops; the toy ferry reads their wake list (position + heading) and waits north / south of the tracks.
- **A stair instead of the switchback**: the published DEM has no road benches; a 'stairs' strip is exempt from the
  wall grade and reads as a toy shortcut ("the walk up is like 13 storeys" — NPS).
- The district's ferry route, Gate E and life.ts are unchanged; district mode never builds the layer.

## Part b · W8-A2 the island's arrival, BAYBAY's lines, the visitors (20:25–21:14 PDT, pushed `42d0c654`)

### What was built

- **The island's arrival** (`data/sf/attractions.ts` `ISLAND_LANDINGS`, `game/arrival.ts` surgical): Alcatraz stays
  `offWalk` (the trips still end at Pier 33: `ARRIVAL_PLACES`; standing at the telescope is still not arriving), but its
  arrival anchor is the island landing — **the cellhouse front** (`ALCA_ARRIVAL`). The first time there: the tier-1
  moment (toast, BAYBAY's own fixed line instead of the card's pier bark, **the reveal from the island's photo pose**,
  the peek card, **the stamp** `arrive:alcatraz` = 10 coins, discovery).
- **The photo pose** (`ALCA_PHOTO`, `world/sf/landmarks/context.ts sitePhoto` surgical; the row's `siteId: 'alcatraz'`):
  from the south-east over the dock: the cellhouse with the lighthouse at its east end, the water tower beyond.
- **BAYBAY's fixed lines** (`world/sf/alcatrazLines.ts`, below): boarding the Alcatraz boat, stepping ashore on the
  island / back at Pier 33 (game/transit asks the line's own system: `boardLine` / `offLine`, so the text stays in the
  lazy chunk), and the island watcher (2 Hz in the layer): the stair's foot (once a page), the occupation after ≈ 12 s at
  the cellhouse front (once a page), the way back when you glide onto the island (once a visit). A line waits while
  BAYBAY is held (lane K's `baybayHeld()`), a dialogue / panel is open, an arrival or cinematic plays, or a bubble shows.
- **A handful of visitors** (`world/sf/cityLife.ts`, surgical): on Alcatraz the crowd's target is 8, not the city's
  whole crowd (the first shots packed ≈ 30 sightseers on the plateau).
- The place card's tip (`data/sf/placeCards2.ts`, lane S's text, surgical): "游戏里上不了岛…" → the toy ferry from Pier
  33 takes you to the island; BAYBAY's trips go to the pier first.
- **No new overlay / panel**: the deckhand is a dialogue; nothing to add to lane K's `BAYBAY_HOLD_OVERLAYS`.

### Fixed lines for lane X (zh + en, exact text; `world/sf/alcatrazLines.ts` `ALCA_LINES`)

| key | zh | en |
|---|---|---|
| board | 开往恶魔岛！往西看是金门大桥，回头看是海湾大桥。 | Off to Alcatraz! The Golden Gate is to the west, the Bay Bridge back east. |
| ashore | 上岛啦。这里以前是联邦监狱，现在是国家公园，我们轻声走、慢慢看。 | We’re on the island. It was a federal prison; now it’s a national park. Let’s walk quietly and take our time. |
| backAt33 | 回到 33 号码头啦。恶魔岛，去过咯！ | Back at Pier 33. Alcatraz: been there! |
| stair | 监狱楼在坡顶上。真的岛上，从码头走上去差不多等于爬 13 层楼！ | The cellhouse is up the hill. On the real island, the walk up from the dock is like climbing 13 storeys! |
| arrive | 这就是恶魔岛的监狱楼。1934 到 1963 年，这里是联邦监狱。 | This is Alcatraz’s cellhouse. From 1934 to 1963 it was a federal prison. |
| occupation | 1969 年，“所有部落的印第安人”来到岛上，守了将近 19 个月，为原住民的权利发声。 | In 1969, Indians of All Tribes came to the island and held it for almost 19 months, speaking up for Native rights. |
| wayBack | 想回城里？去岛上的码头叫船，小渡轮随时来接我们。 | Ready to head back? Call the boat at the island’s dock: the little ferry always comes for us. |

The deckhand's four out-of-hours notes (`alcatrazFerrySystem.ts alcaServiceNote`) are an NPC's dialogue lines, not
BAYBAY's.

### Facts (read 2026-09-30)

- The walk from the dock to the cellhouse: ≈ 1⁄4 mile, 130 ft up, "roughly equivalent to climbing a 13 story building"
  — https://www.nps.gov/alca/planyourvisit/accessibility.htm
- The occupation: Indians of All Tribes arrived on 20 November 1969 and held the island for almost 19 months, to 11 June
  1971 — https://www.nps.gov/places/19-indian-occupation.htm, https://www.nps.gov/goga/learn/historyculture/alcatraz-occupation.htm
- The federal penitentiary 1934–1963; a national park today — https://www.nps.gov/alca/index.htm
- The departures, returns and closed days — see part a (the schedule PDF and the FAQ).

### Evidence

- `tests/opus-bay-w8-a-island.test.ts` 4 / 4: the island anchor (never the Pier 33 telescope; the trips still end at
  the pier), the moment's beats (its own line, stamp, reveal, peek, toast), the photo pose (the camera 30–50 u out, above
  the island), the lines (fixed, no templates, no prices, fit a bubble, the NPS facts), the island watcher's three lines
  and when they are not said. `tests/opus-bay-sf-arrival.test.ts` updated (lane K / C's, named): off-walk islands get no
  anchor at their pier; one with a landing has it on the island.
- Chrome (dev 5804, desktop 1280 × 800 / 960 × 600, `time=day`, quality high; draw calls / triangles, no fps):

  | spot | calls | triangles |
  |---|---|---|
  | Pier 33's quay, walking, facing the boat | 65 | 188,652 |
  | over Pier 33's slip | 65 | 192,934 |
  | mid-Bay at deck height | 49 | 70,740 |
  | on board at the crossing (a real ride) | 83 | 319,691 |
  | on board mid-Bay (a real ride) | 91 | 339,417 |
  | the island's quay, walking | 45 | 84,129 |
  | the cellhouse front, walking | 68 | 247,009 |
  | over the island's dock | 41 | 72,316 |

- A real ride in Chrome (`?date=2026-10-02T11:00`): boarded at once, held 8 s at the crossing for a boat, 9.5 u/s in
  the lane, alongside the float ≈ 107 s after the request. Shots: `qa/w8/A/a-p33-quay.jpg` (the navy-striped boat in the
  slip, bow to the quay, the quay sign), `qa/w8/A/a-island-air.jpg` (the dock, the sign, the stairway up past Building
  64 to the cellhouse), `qa/w8/A/a-island-dock.jpg` (the player and BAYBAY on the island's quay).

## Part c · W8-A3 the parade hour, the return ferry, the checks (21:15–21:45 PDT)

### What was built

- **Fleet Week** (`alcatrazFerrySystem.ts`, lane S's `world/sf/fleetWeekDay.ts` read-only): lane S's Parade of Ships
  (9 Oct 2026, 11:00–12:00 Bay time, https://fleetweeksf.org/events/parade-of-ships/ as lane S read it 2026-09-30)
  sails within 15 u of the boat's outbound lane north of the Wharf. In that hour the service state is `parade`: nothing
  leaves the slip (a boat already out comes back first, ≈ 11:02, while the ships are still out by the Golden Gate);
  Pier 33's deckhand says 舰船巡游正从海湾里经过，小渡轮等巡游过去再开，大约中午 12 点。; a rider calling from the island
  is fetched at noon (the ETA says so, the island's deckhand says why and that 直接到站 works).
- **Gulls and the engine** (W8-A4): three gulls glide along over the stern while the boat makes way within 140 u of the
  player (life.ts's city gull figure, one TOY_INST InstancedMesh: +1 call, ≈ 700 triangles, only then); aboard the
  Alcatraz boat the ferry engine plays (`audio/city.ts`, lane X's, surgical: the engine follows the ferry line you ride,
  `move.line` starting with `ferry`; it followed only the Ferry Building boat). Shot: `qa/w8/A/a-ride-midbay.jpg` (the
  player and BAYBAY at the rail, a gull alongside, the city behind; 90 calls / 342k triangles there, desktop high).
- **Lane S's answer** (`W8-S4` b36b5906, 21:28): lane S moved the parade's path so it crosses the ferry's lanes once,
  steeply, and runs ≈ 40 u outside them (their test checks it against `ALCA_OUT` / `ALCA_BACK`). The ferry still keeps
  out of the way for that hour (the one crossing lies on its outbound lane); `tests/opus-bay-w8-a-ferry` checks the path
  still meets the lane (< 15 u), so the hold is not left guarding nothing.
- **The player walks it** (W8-A5): `tests/opus-bay-w8-a-island` drives the real `PlayerController` from the quay along
  the graph's nodes, up the stair, to the cellhouse front (y > 8, ≈ 6 s of walking).
- **One name for the pier**: the ferry's Pier 33 terminal reads 恶魔岛渡轮码头 · 33 号码头 / Pier 33 · Alcatraz Landing (the
  trips' `ARRIVAL_PLACES` name; it said 33 号码头 · 恶魔岛渡轮).
- **The return ferry** is the same shuttle (tested through game/transit: the island → Pier 33 after the last boat out,
  BAYBAY's boarding line and 回到 33 号码头啦… ashore, the rider set down on Pier 33's quay).

### Evidence

- `tests/opus-bay-w8-a-ferry.test.ts` 11 / 11 (+ the parade hour, + the return ride).
- **Static sweep, whole city** (`scripts/opus-sf/qa/sweep-static.mts`, 64 s): **699 targets, 0 OFF / 0 BOXED / 0 SNAG**,
  1 UNREACHABLE (`trip:ss-jeremiah-obrien`, lane W1's, as before), 150 CORRIDOR (reported, not failures) — among them
  lane A's `ferry:pier-33`, `ferry:alcatraz-dock`, `island:alcatraz:6` (the cellhouse front) and `:7` (the terrace).
- **Phone** (budget-views `--mobile --dpr 3 --w 390 --h 844`, quality mid, day; calls / triangles, no fps):

  | spot | calls | triangles |
  |---|---|---|
  | Pier 33's quay | 60 | 186,414 |
  | mid-Bay at deck height | 39 | 55,523 |
  | the island's quay | 36 | 56,465 |
  | the cellhouse front | 48 | 170,537 |

- The island's arrival played in Chrome (`?date=2026-10-02T11:00`): walking up from the quay, "Arrived · Alcatraz
  Island" + the stamp coins + the peek card fired at the stair's foot (8.8 u from the anchor, inside its 12 u ring: you
  see the cellhouse at the top of the stair), then BAYBAY's 这就是恶魔岛的监狱楼… at the front (`qa/w8/A/a-island-arrival.jpg`);
  gliding / teleporting onto the island first said the way-back line.

### Known gaps

- The reveal camera itself was not caught in a frame (the photo pose is unit-tested: 30–50 u out, above the island).
- The arrival fires at the stair's foot rather than at its top (the anchor's 12 u ring reaches down the stair).
- The island's own walk is the dock, the dock road, the stair and the cellhouse front / terrace; the rest of the island
  (the parade ground, West Road, the Agave Trail) is the city's walkable fragments, not joined to it (a glide can land
  there; the way-back line and the quay's boat are offered).
- Night: the toy boat rests; the lighthouse beam is unchanged (world/backdrop.ts).

### Requests

- **Lane X**: voice the 7 lines of `world/sf/alcatrazLines.ts` (table in part b; exact text) and, if wanted, the parade
  note (an NPC deckhand's line, `ALCA_PARADE_NOTE`).
- **Lane Q** (part c overlap scans): the ferry's ride card / move chip at Pier 33 and on the island use the existing
  ferry UI (no new overlay); worth one 390 × 844 look with the goals step open on the first ride (the goals card covers
  the deck view until the player answers it).
- **Lane S**: thank you for W8-S4; if the parade's hour changes, `alcatrazFerrySystem.ts` reads `PARADE_DAY /
  PARADE_FROM / PARADE_TO` from `fleetWeekDay.ts`, and `tests/opus-bay-w8-a-ferry` checks the path still meets the lane.

## Wrap-up (22:34–22:50 PDT)

- **W8-A6** (last): the island watcher's lines also wait behind the goals step, a postcard reward and lane K's waiting
  overlays (`bubbleWaits()`), so a line is never dropped by `bubble()` and marked as said; the night check in Chrome
  (`?date=2026-10-02T21:30`, `time=night`): the boat rests in its slip, E at the quay opens the deckhand's 小渡轮收工休息啦…
  dialogue, no ride starts.

### Commits (origin/opus-bay)

| commit | what |
|---|---|
| `f80e8a2d` W8-A1 | the toy ferry Pier 33 ⇄ the island (route, shuttle, timetable, layer, game/transit hooks), the island on foot (dock, dock road, stair, cellhouse front), the sweep's island graph, tests |
| `42d0c654` W8-A2 | the island's arrival (anchor, own line, photo pose, stamp), BAYBAY's 7 fixed lines, 8 visitors on the island, the card tip, report a + b |
| `65478b6d` W8-A3 | the parade hour (Fleet Week), the return-ferry test, report c |
| `1eddee39` W8-A4 | gulls over the stern, the engine aboard (audio/city.ts) |
| `c4a67d3e` W8-A5 | the controller walks the island, one pier name |
| `fff82f23` W8-A6 | the island lines wait instead of being dropped; this wrap-up |

### Not done

- A switchback road you walk (the toy has a stair; the DEM has no benches for the road).
- The rest of the island (the parade ground, West Road, the Agave Trail, the recreation yard) joined to the walk.
- The reveal camera caught in a frame (unit-tested only); the arrival fires at the stair's foot (inside the 12 u ring).
- The ferry's own wake strip in the water shader (life.ts's wake list is lane X's; the boat has fx foam only).
