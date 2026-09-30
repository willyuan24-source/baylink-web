# Wave 7 · lane S · site sync & real dates — report

Lane S owns `realsf/{eventVenues,eventKit,eventSounds,events,calendar,live,daily,todayRows,todayLine,openings,openingSigns,jets,presence,lines,tides,moon,sun}.ts`,
`realsf/{TodayTab,HowToGo,OpeningCard}.tsx`, `scripts/opus-sf/export-live.ts`, `public/opus-bay/sf/v1/live.json`,
`tests/opus-bay-w6-s-*.test.ts` and the DST fix in `ui/mapEvents.ts` (lead note `sf-w7-lead.md` §3). Worktree
`C:/Users/willy/wt/w7-s` (branch `w7-s`), dev port 5707, scratch `C:/Users/willy/opus-qa/w7/s/`, QA images
`docs/opus-bay/qa/w7/S/`.

## 给主人的摘要

1. 网站 9/29 新增的旧金山活动进了 3D 城市：金门公园音乐台 Bay Beats 免费音乐会（10/24，用城里现成的音乐台当舞台，观众站在音乐广场）、Marina 图书馆开放日（10/17）、梅森堡秋季艺术古董展（10/15–18，按主办方每天的时间）、Inner Sunset 万圣节主题跳蚤市集（10/11，Irving 街拱门）、Potrero Hill 街区节（10/17，20 街拱门）、Excelsior 的 Sunday Streets（10/18，Mission 街拱门）。每个点都在 9/29 查过 OpenStreetMap，并确认在游戏步行网络上、离电车/公交线 20 格以上。
2. 修了一个真 bug：图书馆的儿童万圣节服装交换、万圣节活版印刷、渡轮大厦拉丁裔创作者市集这几个活动名字太长，纪念章一直存不上（每天都会重复说“纪念章收好啦”，也不给 15 金币）。现在都能存，并加了一个守门测试：以后网站再加活动，只要进了游戏世界却没有纪念章或名字，测试就会红。
3. 我做的决定：成人理财讲座日（10/24 总图书馆）不放进玩具城（是税务/遗产讲座和一对一理财咨询，不是出游活动），网站和“这周”列表照常显示；YBCA 的 NEXUS 夜间派对（20:00–23:30）按规矩不进游戏。
4. 进度会在下面按部分更新（夏令时、亡灵节、唐人街万圣节、新店牌子、老人免费 Muni、主人的日期实测）。

## Part a · the Sep 29 website refresh's San Francisco events in the world (W7-S1)

Written 2026-09-29 ≈ 21:05 PDT.

### What was built

- **The list** (`public/planner-catalog.json` at `315704c1`, 305 events). San Francisco events of 29 Sep – 30 Nov: **68**.
  Before this part the world showed **42** (the four regex matches included, three of them with no souvenir). After:
  **47** — the six new venue rows below, minus the adults' finance day. Out: 12 professional, 6 adult-only (18+ / 21+),
  and 3 not placed for a stated reason (`sf-downtown-first-thursday-oct-2026`, street party billed to adults, as in wave 6;
  `sf-nexus-party-oct1-2026`, a 20:00–23:30 YBCA dance party, nightlife, the lead's decision §6;
  `sf-financial-planning-day-oct24-2026`, below).

  | date | event (catalog id) | venue row (new) | kit | OSM point (checked 2026-09-29) |
  |---|---|---|---|---|
  | Oct 24 14:00–18:00 | `sf-bay-beats-bandshell-oct24-2026` | `golden-gate-bandshell` | music, **own stage** (no toy kit: the city's Spreckels bandshell model is the stage; the crowd in the Music Concourse bowl, the banjo loop) | https://www.openstreetmap.org/way/30896932 (Spreckels Temple of Music, 37.7698795, −122.4685913) |
  | Oct 17 11:00–15:00 | `sf-marina-library-open-house-oct17-2026` | `marina-library` | board on the Chestnut St pavement | https://www.openstreetmap.org/way/288394771 (Marina Branch Library, 1890 Chestnut St, 37.8014046, −122.4341905) |
  | Oct 15–17 10:30–19:00, Oct 18 11:00–17:00 | `sf-fall-show-oct15-18-2026` | `fort-mason-festival-pavilion` (organiser hours in the table) | board at the pier's landward door | https://www.openstreetmap.org/way/288387753 ("Pier 3 – Festival Pavillion", 37.8083606, −122.430222) |
  | Oct 11 10:00–16:00 | `sf-inner-sunset-flea-oct11-2026` | `irving-11th` | street arch over Irving at 11th Ave | https://www.openstreetmap.org/node/65355419 (Irving & 11th, 37.7639549, −122.4684732) |
  | Oct 17 10:00 起 | `sf-potrero-hill-festival-oct17-2026` | `potrero-20th` | street arch over 20th St west of Arkansas | https://www.openstreetmap.org/node/65357028 (20th & Connecticut, 37.7599683, −122.3972491) |
  | Oct 18 11:00–16:00 | `sf-sunday-streets-excelsior-oct18-2026` | `mission-excelsior` | street arch over Mission St north of Persia | https://www.openstreetmap.org/node/65363029 (Mission & Persia, 37.723147, −122.4359864) |

- **Souvenirs** (`realsf/eventVenues.ts` `SOUVENIR_IDS`, append-only after the farmers market): the three regex matches
  (`sf-main-halloween-costume-swap-oct15-2026`, `sf-halloween-broadside-printing-oct17-2026`,
  `sf-foodwise-latine-makers-oct3-2026` — their `event:<id>` sources are 44–48 characters, over the ledger's
  `MAX_ONE_OFF_CHARS` 40, so `pay()` returned 0: no coins, no stamp, the souvenir line offered again every day) and the six
  new rows' events. `EVENT_SAY` names for all nine (儿童万圣节服装交换 · 万圣节活版印刷 · 拉丁裔创作者市集 · Bay Beats 音乐会 · 图书馆开放日
  · 秋季艺术古董展 · 秋日跳蚤市集 · 街区节 · 街区运动日) and `VENUE_SAY` for the six rows. The Main Library and Ferry Building rows now list
  the events their venue text caught.
- **`WORLD_SKIP`** (`realsf/eventVenues.ts`, read by `realsf/events.ts` `worldEvent`): catalog events a row's venue text
  would catch but the toy world leaves out, each with its reason — today only the finance day.
- **`ownStage`** on a venue row (`realsf/presence.ts`): no toy kit is built, the E prompt stands at the venue point, the
  crowd and loop as for its kit kind.
- Tests: new `tests/opus-bay-w7-s-venues.test.ts` (3): **the guard** — every SF event of the window that `worldEvent` shows
  has a souvenir id, an `EVENT_SAY` name, a `VENUE_SAY` venue name, is listed at its row, and its lines are ≤ 45 zh
  characters and named (not 活动 / "an event") on every day it is on; the ledger stores a long-id souvenir once
  (`pay` 15 then 0, `isPaid` true); the new rows' hours per day (Fall Show by the organiser, the flea, Sunday Streets,
  Bay Beats, the library; Potrero Hill "10:00起" with no invented end). `tests/opus-bay-w6-s-venues.test.ts` (GPT's
  W7-0h numbers): NOT_PLACED is the three stated reasons, **47 shown**, the nine refresh events at their rows, the finance
  day and the Fort Mason hackathon out. `tests/opus-bay-w5-events.test.ts`: the own-stage row checks its crowd and point
  (no kit spot), every street arch (not only the Castro) is > 20 u from every transit line and its pennant beside it.

### Evidence

- Probes over the published city (scratch `probe.mts`, `arch.mts`): each arch where the kit's footprint is ≥ 80 %
  standable — Irving at the 11th Ave flare (road 4 u, 25.2 u from the N-Judah, which leaves Irving at 9th), 20th St
  (100 %, 349 u from the loop bus), Mission (80 %, 154 u from the M); the Castro's own arch reads 80 % with the same probe.
  The bandshell crowd's centre (−225.1, 943.5) is open ground (the fountain at z 940 is not).
- The real game (dev server 5707, headless Chrome `--force_high_performance_gpu`):
  - desktop 1440 × 900, `?date=2026-10-11T11:00&at=xz:-163,1013`: `presence()` = open `sf-inner-sunset-flea-oct11-2026`,
    `sf-ybg-dance-day-2026`; kit `sf-inner-sunset-flea-oct11-2026` **364 triangles** (the arch).
  - phone 390 × 844 dpr 3, `?date=2026-10-24T15:00&at=xz:-222,946`: `presence()` = open Exploratorium, Chowder Fest,
    Thrill-O-Ween, **Bay Beats** — no kit for Bay Beats (own stage), its crowd in the concourse bowl
    (`qa/w7/S/s1-bay-beats-bandshell-2026-10-24-phone.jpg`: the visitors round the fountain and the benches, the de Young
    beyond).
- Checks on this tree: `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings) · the suite
  **1491 / 1492**, the one failure the known `W5-bus 20+ simulated minutes` (lane B hardens it), re-run alone: see the push.

### Facts checked on the web (2026-09-29)

- Bay Beats: https://illuminate.org/event/bay-beats-at-the-bandshell-october-24/ — "October 24, 2026", "2:00 pm – 6:00 pm",
  Golden Gate Bandshell, 75 Hagiwara Tea Garden Dr.
- Marina open house: https://sfpl.org/events/2026/10/17/celebration-open-house — Saturday 10/17/2026 11:00–3:00, Marina
  Branch, 1890 Chestnut St (back courtyard, children's area, library exterior).
- Fall Show: https://sffallshow.org/about/ — Thu Oct 15 – Sat Oct 17 10:30am–7:00pm, Sun Oct 18 11:00am–5:00pm, Festival
  Pavilion, Fort Mason Center, 2 Marina Blvd (the Oct 14 gala is not in the catalog row).
- Inner Sunset Flea: https://sunsetmercantilesf.com/innersunsetflea/ — 2nd Sundays 10am–4pm, "Irving St between 9th & 11th
  Avenue", October 11th "Tricks, Treats, & Treasures".
- Potrero Hill Festival: https://potrerofestival.com/ — Saturday October 17, 2026, 10 a.m. – 5 p.m., four blocks of 20th St
  (the catalog cites the site's FAQ with 10–4: the end stays unconfirmed, the world says 10:00 起).
- Sunday Streets: https://sfrecpark.org/Calendar.aspx?EID=10817 — Sunday, October 18, 2026, 11 am to 4 pm, Mission Street
  between Avalon Avenue and Geneva Avenue.
- OSM points: Nominatim (way 30896932, way 288394771) and Overpass (way 288387753 by name at Fort Mason; the intersection
  nodes 65355419 Irving & 11th, 65355417 Irving & 10th, 65357028 20th & Connecticut, 65361139 Mission & Excelsior,
  65363029 Mission & Persia, 65317179 Chestnut & Webster — the library's board faces Chestnut St).

### Decisions

1. **The finance day is not in the toy world** (`WORLD_SKIP`): a Financial Planning Day of investment / tax / estate
   talks and one-on-one CFP consultations, audience 成人 · 实用生活 — not an outing for the toy city (a pennant, a crowd,
   "理财日纪念章" and BAYBAY sending players to it would be odd). The catalog, the 这周 list and BAYLINK still show it.
   GPT's test pinned it at the Main Library; the test now pins it out.
2. **NEXUS Party stays out** (nightlife 20:00–23:30, the lead's §6), with that reason in the test (it was "pending").
3. **The bandshell is its own stage**: the city already models the Spreckels Temple of Music, so no toy stage stands in
   front of it; Bay Beats gets the pennant, the concourse crowd and the music loop.
4. **Street fairs use the Castro arch** where the toy street and its pavement take it (≥ 75 % of the footprint on open
   ground), clear of transit by > 20 u: the flea's arch sits at its 11th Ave end because the N-Judah runs on Irving up to
   9th Ave; the Potrero arch west of Arkansas (inside Wisconsin–Missouri); Sunday Streets north of Persia (inside
   Avalon–Geneva). The pennant stands on the corner pavement beside each.
5. **The Fall Show's hours are the organiser's table** in the venue row: its label's first '·' hides the Oct 15–17 hours
   from the per-date reader (the scout's "right by accident").
6. **Foodwise on Oct 3** stays its own row at the Ferry Building (a special Latine makers event with cooking demos, not the
   market itself): the 今天 tab shows the market hand row and this event.

### Known gaps

- The arch shots are from the real game's `presence()` numbers; the Irving view (`irving-2.jpg`, scratch) looks down the
  street from overhead — a street-level look is part d's dated run.
- Potrero Hill's world window closes at 14:00 (start + 4 h), before the real 16:00/17:00 end: the organiser's end is not
  confirmed, and a table row would make the texts claim an end.

### Requests

- **Lead**: GPT's `tests/opus-bay-w6-s-venues.test.ts` counts moved again (42 → 47 shown, NOT_PLACED rewritten): when the
  site adds events, main's own suite will need the same rows — the guard test now names any shown event without a souvenir.
