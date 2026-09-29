# Wave 6 · lane S · site sync (GPT's autumn release) — report

Lane S owns `realsf/{eventVenues,eventKit,events,calendar,live,daily,todayRows,todayLine}.ts`, `realsf/TodayTab.tsx`,
`scripts/opus-sf/export-live.ts`, `public/opus-bay/sf/v1/live.json` (lead note `sf-w6-lead.md` §3). Worktree
`C:/Users/willy/wt/w6-s` (branch `w6-s`), dev port 5607, scratch `C:/Users/willy/opus-qa/w6/s/`, QA images
`docs/opus-bay/qa/w6/S/`.

## 给主人的摘要

1. 网站秋季新活动已接进 3D 城市：9/29–11/30 旧金山共 57 个活动，游戏里能看到的从 18 个增加到 38 个（其余 18 个是 18+ 或行业会议，按规矩不进游戏；1 个街区派对没有单一可核对的地点，不放旗）。
2. 万圣节优先：大通中心 Thrive City 广场 10/24 的免费万圣节亲子庆典有了舞台、摊位和人群；Sunnydale 南瓜节（10/17）、Portola 万圣节手工（10/23）、芳草地花园儿童装扮游行（10/31）都在原地，时间和新目录一致。
3. 新增场地：大通中心（勇士季前赛、演唱会，门口立小广告牌）、战争纪念歌剧院、戴维斯交响音乐厅、探索馆家庭科学日、Arc 画廊文学夜；每个点都在 9/29 查过 OpenStreetMap，并确认在游戏步行网络上。
4. 修好了新目录带来的小问题：渡轮大厦农夫市集现在也是目录活动，周六按 8:00–14:00 显示（原来会错成 10:00），“今天”页不再重复出现两行市集、今日三件小事也不会同时出现“去市集”和“去看市集活动”。
5. 主人的日期都还正常：10/2–4 蓝草音乐节和卡斯特罗街区节、10/9–11 舰队周、10/31 儿童游行；11/1 起目录里没有旧金山活动（网站目录只到 10/31）。

## Part a · the autumn catalog's San Francisco events in the world (W6-S1)

Written 2026-09-29 02:20 PDT.

### What was built

- **The list** (the catalog `public/planner-catalog.json`, `checkedAt` of GPT's release, 267 events; San Francisco events
  of 29 Sep – 30 Nov: **57**). Before this part **18** of them showed in the world (the 17 rows lane R listed in wave 5, and
  the Ferry Plaza market, which the autumn catalog adds as an event and the Ferry Building row caught by its venue text).
  After: **38**. The other 19: 13 professional / tech meetups and 5 Exploratorium *After Dark* nights (18+) — never in the
  world by `worldEvent` (the rule of wave 5) — and one not placed (below).

  | date | event (catalog id) | venue row | kit |
  |---|---|---|---|
  | Oct 17 | `sf-sunnydale-pumpkin-fest-2026` (Halloween) | `sunnydale-hub` (wave 5, still right) | fair |
  | Oct 23 | `sf-family-connections-halloween-2026` (Halloween) | `portola-family-connections` (wave 5, still right) | board |
  | **Oct 24** | **`sf-thrive-thrill-o-ween-2026`** (Halloween, new) | **`thrive-city`** (new) | festival |
  | Oct 31 | `sf-halloween-hoopla-2026` (Halloween) | `yerba-buena-gardens` (wave 5) | festival |
  | Sep 29 – Oct 4, Oct 15–30, Oct 31 | `sf-opera-mary-queen-scots-2026`, `sf-opera-manon-2026`, `sf-opera-figaro-opening-2026` | `war-memorial-opera-house` (new) | board |
  | Oct 1–4, Oct 20, Oct 22–24 | `sf-symphony-fleming-strauss-2026`, `sf-symphony-ring-film-2026`, `sf-symphony-hisaishi-2026` | `davies-symphony-hall` (new) | board |
  | Oct 3 – Oct 27 (10 nights) | Disney *Worlds Collide*, Warriors v Lakers / Kings / Blazers / Grizzlies, Rod Wave, Chayanne, Young Miko, Doja Cat, Phoebe Bridgers | `chase-center` (new) | board |
  | Oct 25 | `sf-thrive-football-sunday-2026` | `thrive-city` (new) | festival |
  | Oct 24 | `sf-exploratorium-family-science-oct24-2026` | `exploratorium` (new, downtown: pennant + crowd only) | — |
  | Oct 21 | `sf-apature-literary-2026` | `arc-gallery` (new) | board |
  | Tue / Thu / Sat to Oct 31 | `ferry-plaza-farmers-market-2026-autumn` | `ferry-building` (listed now; downtown) | — |

  Not placed: `sf-downtown-first-thursday-oct-2026` (Oct 1, 17:00–22:00, a street party along 2nd St between Market and
  Howard, billed to adults): a street segment, no single point to verify — no pin (the rule: never a guessed point).
  The catalog has **no San Francisco event in November** (the SF rows end on Oct 31).
- `realsf/eventVenues.ts`: six new rows (`thrive-city`, `chase-center`, `war-memorial-opera-house`, `davies-symphony-hall`,
  `exploratorium`, `arc-gallery`), each with its OpenStreetMap source and check date, the board or kit on the published
  city's pavement next to the real point (a probe over the walking network, `C:/Users/willy/opus-qa/w6/s/probe.mts`); the
  Ferry Building row lists the market; 21 ids appended to `SOUVENIR_IDS` (append-only), short names in `EVENT_SAY` and
  `VENUE_SAY` for BAYBAY's lines (every line ≤ 45 zh characters, tested).
- `realsf/events.ts`: **`labelHoursOn(label, dateKey)`** — the autumn catalog writes hours per date or weekday
  (`9/29、10/2 19:30；10/4 14:00`, `10/18 14:00；其余所列日期 19:30`, `周二、四10:00–14:00；周六08:00–14:00`,
  `10/23 · 19:00；17:30 开门`). The part naming the Bay date or its weekday wins, then a `其余` part, then the parts naming no
  day; ranges are joined (earliest start – latest end), a start runs 4 h (≤ 21:00, the wave-5 rule) and opens at its doors.
  `eventHours` uses it (the organiser table still wins). Before, the Saturday market read 10:00–14:00 (the first range), the
  opera's Sunday matinee 19:30, and a Warriors game "10/6 · 19:00" fell back to 08:00–21:00.
  **`handRowOf(event)`**: the Ferry Plaza farmers market is the 今天 tab's hand row `market` and the daily `market` task.
- `realsf/daily.ts` `daySignals`: an event that is a hand row is not also an `event` task. `realsf/TodayTab.tsx`: it is not a
  second row in 今天在旧金山 (and not listed again in 这周 on its own day).
- `tests/opus-bay-w5-events.test.ts` (lane R's wave-5 test of my modules): APAture now maps to Arc Gallery, so the "unmapped
  → no pin" examples use a new fixture event whose venue the organiser has not published (`sf-unplaced-dinner-2026`).
- New `tests/opus-bay-w6-s-venues.test.ts` (4 tests): the label rules on the real autumn labels (and every wave-5 label
  reads as before); on the real catalog every SF event of 29 Sep – 30 Nov is shown, 18+ / professional, or in the
  not-placed list, **exactly 38 shown**, all four family Halloween events at their venues, every listed id in the catalog
  with a souvenir id and a short name; the windows (Pumpkin Fest ends 15:00, the Grizzlies doors 17:30, Thrill-O-Ween and
  the Exploratorium on Oct 24 at noon, the Saturday market 8–14 and closed on Monday, the opera matinee on Oct 4 but not
  Friday afternoon, nothing in November); the market is one row and one task.
- The wave-5 test that walks every row on the published city (standable, a walking-graph node within 16 u, reachable from
  ferry-gate; kits ≥ 75 % on open ground, ≤ 25 % on a road; the crowd centre) now covers the six new rows and passes.

### Evidence

- Real game, dev server 5607, headless Chrome `--force_high_performance_gpu`, desktop 1440 × 900,
  `?world=city&date=2026-10-24T12:30&at=xz:501,236`: `presence()` = open `ferry-plaza-farmers-market-2026-autumn`,
  `sf-exploratorium-family-science-oct24-2026`, `sf-fishermans-wharf-chowder-fest-2026`, `sf-thrive-thrill-o-ween-2026`;
  kit `sf-thrive-thrill-o-ween-2026` 468 triangles; the festival stage, two tents and the crowd on the grass beside Chase
  Center's grey drum, the prompt "E · See the event · Thrill-O-Ween" (`qa/w6/S/s1-thrill-o-ween-2026-10-24-desktop.jpg`;
  the first try at 6 s showed only water: the far chunks were still streaming — the kit waits for the ground, as designed).
- The owner's dates with the autumn catalog (`activeEventsAt`, real catalog, `C:/Users/willy/opus-qa/w6/s/dates.mts`):
  Oct 2 12:00 HSB · Oct 3 10:30 HSB + the market · Oct 4 13:00 Litquake, the Castro fair, HSB · Oct 9 12:30 Fleet Week ·
  Oct 10 12:30 Fleet Week + the market · Oct 11 12:40 Fleet Week, YBG Dance Day, the Italian Heritage Parade · Oct 31 12:30
  the Hoopla + the market · Oct 31 19:30 the Figaro opening · Nov 1 nothing (the catalog's SF events end Oct 31).
- Checks: see the push line below.

### Facts checked on the web (2026-09-29, OpenStreetMap API / Nominatim)

- Thrive City: https://www.openstreetmap.org/node/11149187371 ("Mission Bay Wine Bar at Thrive City", 640 Terry A. Francois
  Blvd, 37.7684244, −122.3864865); Chase Center https://www.openstreetmap.org/way/579646390 (1 Warriors Way; bounds 37.76717–
  37.76860, −122.38831 – −122.38653; its east entrance node 7101767122, the box office node 7101767044 at 37.7682516,
  −122.3881064).
- War Memorial Opera House https://www.openstreetmap.org/way/32865161 (301 Van Ness Ave; `entrance=main` node 10091282494 at
  37.7786463, −122.4203527).
- Louise M. Davies Symphony Hall https://www.openstreetmap.org/way/32865746 (201 Van Ness Ave; entrance node 7191732934 at
  37.7779807, −122.4211034).
- Exploratorium https://www.openstreetmap.org/node/621529017 (Pier 15; in `places.json` since wave 3).
- Arc Gallery & Studios https://www.openstreetmap.org/node/3789606760 (1246 Folsom St; in `places.json`).
- Event dates and hours are the catalog's (the site's editors verified them on 2026-09-28/29 with each event's official
  page); the world reads them at runtime. No organiser hours were added to the table this part.

### Decisions

1. **Sunnydale and Family Connections were already in** (wave-5 rows, OSM-checked 2026-09-28); the autumn catalog keeps
   their ids, venue text and hours (12:00–15:00, 16:30–18:00), so they needed no new row — checked, not re-placed.
2. **Thrill-O-Ween gets the festival kit** at Thrive City's north-east corner (the open ground by Terry A. Francois Blvd;
   the plaza's south / west sides are too narrow for a stage at 90 % open ground). The Football Sunday watch party shares it.
3. **Arena, opera, symphony and gallery nights get a sandwich board** at the door (the wave-5 rule for indoor events); their
   pennant flies only in the event's window (evening shows: from the doors, 4 h, at most to 21:00).
4. **The Exploratorium row is `downtown`** (pennant + crowd, no kit) — it sits on the Embarcadero by the Ferry gate like the
   Ferry Building. Its 18+ After Dark nights stay out (the catalog's own `isAdultOnly`).
5. **The Ferry Plaza market stays in the world** (pennant and crowd at the Ferry Building on market days, 看看活动 opens its
   card) but is the existing hand row / daily task in the 今天 tab — not a duplicate.
6. **First Thursday is not placed** (a street segment, adults; no single verified point).
7. **Souvenirs**: every new mapped event pays its once-only stamp like the wave-5 ones (15 coins, through lane E's ledger);
   the ids are appended, never reordered.

### Known gaps

- The board faces were set from the building's centre to the entrance (a sandwich board has no front the player notices);
  not every board was looked at in the game (the Thrive City kit was).
- `labelHoursOn` reads the labels of today's catalog; a label written in a new style falls back to the old first-range rule
  and then to 08:00–21:00 (as before).

### Requests

- **H** (Halloween world): Thrill-O-Ween (Oct 24, 12:00–17:00) at Thrive City now has a festival kit at
  `{ x: 496.2, z: 239.8 }` — pumpkins there would fit if you dress event venues; the Sunnydale Pumpkin Fest kit stands at
  `{ x: 857.9, z: 1109.8 }` (Oct 17, 12:00–15:00).
