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
4. 真实日子：11/1 夏令时结束（“今天”页写明凌晨 2 点拨回 1 点、当天日落 17:11，BAYBAY 会提醒天黑得早）；亡灵节改到 11/2 晚 7 点 22 街 & Bryant 出发（按 2025 惯例，写“通常 · 以官网为准”，祭坛在 Potrero del Sol，不再是加菲尔德广场）；10/31 唐人街 Waverly Place 万圣节庆典 11:00–15:00；10/12 恶魔岛原住民日日出聚会（安静地纪念）；10/9 舰队周舰船游行；蓝天使“通常下午三点左右 · 以官网为准”。地图上 11/1 凌晨的“明天”也修正了（夏令时那天会算错）。
5. 网站的新店规则同步：Raising Cane's（渔人码头）、La Boulangerie（Marina Chestnut 街）、Mess Hall（要塞公园 Tunnel Tops 旁）立了金色“新店”牌子，都在真实地址 3 格以内；65 岁以上老人免费 Muni 进了“今天”页的长期福利；大通中心的活动卡写上“持活动票当天可坐 Muni”。

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

Push of part a: rebased over lanes G, Q, W2, R; `npx tsc` 0 and the lane's test files 39 / 39 before the push
(`3915153a`, report `f9f7b7e5`, 21:37 PDT); the full run on the tree before that rebase: tsc 0 · eslint 0 errors ·
**1509 / 1509** (the deadlock test passed alone as well: 9 / 9).

## Part b · real dates, BAYBAY's calendar lines, Fleet Week, the map's 明天 (W7-S2)

Written 2026-09-29 ≈ 23:10 PDT. Code pushed 22:25 (`1242bc5b`), before lane X's 23:30 line fetch.

### What was built

- **`realsf/calendar.ts`** — five rows, each with its own source checked on 2026-09-29 (`src29`; the wave-5 rows keep
  2026-09-28):

  | row | Bay date / time | where (带我去) | grade | source |
  |---|---|---|---|---|
  | `dst-end-2026` 夏令时结束 | Sun 1 Nov, 02:00 → 01:00 | all of SF (no 带我去) | official | https://www.nist.gov/pml/time-and-frequency-division/popular-links/daylight-saving-time-dst |
  | `dia-de-los-muertos-2026` 亡灵节 (was hidden, at Garfield Square) | Mon 2 Nov, 19:00 | 22nd & Bryant (`BRYANT_22`, lane H's corner) · Potrero del Sol | usually · 以官网为准 | https://www.sfmta.com/travel-updates/dia-de-los-muertos-procession-sunday-november-2-2025 |
  | `chinatown-halloween-festival-2026` 唐人街万圣节庆典 | Sat 31 Oct, 11:00–15:00 | Waverly Place (`WAVERLY_PLACE`, pavement on the walking network) | official | https://www.cycsf.org/chinatown-halloween-festival/ |
  | `alcatraz-sunrise-2026-10` 原住民日 · 恶魔岛日出聚会 | Mon 12 Oct, boats from 04:15 | Pier 33 (`PIER_33`) | secondary · 以官网为准 | https://sf.funcheap.com/event-series/sunrise-gathering-alcatraz-indigenous-peoples-day/ |
  | `fleet-week-parade-of-ships-2026` 舰队周 · 舰船游行 | Fri 9 Oct, 11:00–12:00 | Marina Green | official | https://fleetweeksf.org/events/parade-of-ships/ |

  Facts read on 2026-09-29: DST — "Sunday, November 1, 2026, 2:00:00 am clocks are turned backward 1 hour"
  (https://www.timeanddate.com/time/change/usa/los-angeles, via web search; NIST states the rule); the 2025 procession
  "will begin at 7 p.m. … from Bryant & 22nd", route Bryant → 24th → Mission → 22nd (SFMTA, above), and
  https://www.dayofthedeadsf.org/festival-of-altars shows only "November 2, 2025 @ Potrero Del Sol Park" (no 2026 date);
  the Chinatown festival "Saturday, October 31, 2026, from 11am-3pm on Waverly Place" (arts & crafts, games, a pumpkin
  patch, a costume contest); the Sunrise Gathering "October 12 and November 26, 2026", boats 4:15–5:15 am from Pier 33,
  organised by the International Indian Treaty Council; the Parade of Ships "Friday 10/9 11:00 am - 12:00 pm", under the
  Golden Gate Bridge, the reviewing stand at Marina Green; the Blue Angels "often around 3 p.m." for about 45 minutes
  (https://www.navyweek.org/fleetweek/san-francisco/, secondary).

  The 今天 tab shows each on its day, 这周 a week ahead (on Oct 25: Halloween, the Chinatown festival, the DST change).
  `sunsetNote` adds today's sunset to the DST row, read from `realsf/sun.ts` at runtime ("今天日落 17:11").
- **`calendarLines(now, player)`** (`realsf/calendar.ts`): BAYBAY's lines of rows without a dressing (`line` + `lineAt`:
  near a point within r, between two Bay times, or anywhere). Offered to the realsf scheduler through **one line in
  `realsf/index.ts`** (surgical, not in my table; plus the DEV `__opusRealSF.offered().calendar`). The dressing rows
  (Halloween's pumpkins, the king tides) keep their lines in `realsf/dressing.ts` (lane H's) — never twice.
- **`realsf/jets.ts`**: `JETS_BLUE_LINE` + `blueLineOn(date)` — on a show day from 6 h before the show until 15:00 the
  jets' lines add "蓝天使飞行队通常下午三点左右上场，以官网为准哦。" (the existing lines keep their exact text: they are
  pinned by the wave-5 test).
- **`ui/mapEvents.ts` `whenLabel`** (surgical, named in the plan): 明天 is `addDays(today, 1)` on the Bay calendar. **Red
  before** (the old function run on this tree): at `2026-11-01T00:30` a Nov 2 19:00 event read `11/2 周一 19:00–21:00`, and
  at `2027-03-13T23:30` a Mar 14 event read `3/14 周日 10:00–12:00`; now both read 明天.
- Tests: new `tests/opus-bay-w7-s-dates.test.ts` (4): the five rows (source, date, shown, fixed lines), 这周 a week ahead,
  the muertos row's corner / 19:00 / 以官网为准, the DST row and the sunsets (17:11 on Nov 1, 18:12 on Oct 31);
  `calendarLines` (DST anywhere on Nov 1 only; Chinatown near Waverly 11:00–15:00 only; Alcatraz near Pier 33 in the
  morning; no line twice for the dressing rows; none for muertos — lane H's world has the procession lines); the Blue
  Angels window; the map's 明天 on both DST days. `tests/opus-bay-w5-calendar.test.ts` (lane R's wave-5 test of my
  module): muertos shown, the new rows on Oct 31 / Nov 1 / 这周.

### New fixed BAYBAY lines for lane X (zh + en exactly as in the code; no template)

| key (voice id `realsf-<key>`) | zh | en |
|---|---|---|
| `calendar-dst-end-2026` | 今天凌晨两点，钟拨回了一小时，天会黑得早一点哦。 | The clocks went back an hour at 2 this morning — it gets dark earlier now. |
| `calendar-chinatown-halloween-festival-2026` | 唐人街的万圣节庆典在 Waverly 巷，有手工、游戏和南瓜，去看看吧！ | Chinatown’s Halloween Festival is on Waverly Place — crafts, games and pumpkins. Let’s go see! |
| `calendar-alcatraz-sunrise-2026-10` | 今天是原住民日。恶魔岛上通常有一场日出聚会，大家安静地纪念。 | It’s Indigenous Peoples’ Day. There is usually a sunrise gathering on Alcatraz — a quiet remembrance. |
| `jets-blue` | 蓝天使飞行队通常下午三点左右上场，以官网为准哦。 | The Blue Angels usually fly around 3 pm — check the official schedule. |

(The event lines "今天<地点>有<活动>…" and the souvenir lines "<活动>纪念章收好啦！" stay templated, as in waves 5–6.)

### Evidence

- The 今天 tab in the game (dev server 5707, phone 390 × 844 dpr 3, zh, `?date=2026-11-01T10:00`): the clock 11月1日 周日,
  日出 6:35 · 日落 17:11; 今天在旧金山 "夏令时结束 · 整个旧金山 · 凌晨 2:00 钟拨回 1:00 · 天黑得更早 · 今天日落 17:11 · 官网日期 ·
  来源 nist.gov · 查证于 2026-09-29"; 这周 "亡灵节 · 22 街 & Bryant · Potrero del Sol · 明天 · 周一 · 通常晚 7 点从 22 街 & Bryant
  出发游行 · 以官网为准 · 带我去" (`qa/w7/S/s2-today-dst-2026-11-01-phone.jpg`).
- Oct 31 12:00 at Waverly Place (desktop, the DEV `placePlayer`): the area chip reads 唐人街 · Waverly Place and
  `__opusRealSF.offered().calendar` = `['calendar-chinatown-halloween-festival-2026']` (on offer to the scheduler; the
  bubble itself did not come in the 45 s of a fresh `start=free` save — the scheduler's gates and its 20 s spacing).

### Decisions

1. **Día de los Muertos is shown** as grade *usually* on the 2025 pattern (the lead's §6): 2 Nov, 19:00, 22nd & Bryant;
   the note says 以官网为准; the where names Potrero del Sol (the Festival of Altars since 2025), not Garfield Square. No
   calendar line: lane H's world says the procession's lines.
2. **DST is an official row** (US law; NIST states it): no place, a city-wide line on Nov 1 only, the sunset from sun.ts.
3. **The Chinatown festival is a calendar row**, not an event (the catalog lacks it): no pennant, crowd or souvenir; the
   Request below asks the site's editors to add it — then it can get a venue row (`downtown`, pennant + crowd).
4. **The Alcatraz gathering is quiet**: secondary grade, a morning line near Pier 33 only, no dressing, no reward.
5. **The Parade of Ships has no toy ships** this wave (not cheap: a new fleet on a path under the bridge); the row tells
   the player where to watch. No line (it would send players to see nothing).

## Part c · the site's openings rule, the seniors' Muni, the Chase Center Muni line (W7-S3)

Written 2026-09-29 ≈ 23:10 PDT.

### What was built

- **`realsf/openings.ts`** follows the site's own list and rule — `currentOpenings` (`src/data/local-discoveries.ts`),
  status open / soft_open, region sf (the filter of `src/data/planner-local-stops.ts`): 9 SF openings, **6 open → 6
  signs**, 3 announced → none (Handroll Hawker, Florecita Panadería, Woods Beer & Wine). Three new signs:

  | opening (BAYLINK id) | the site's address, check | OSM point (checked 2026-09-29) | sign (world u) |
  |---|---|---|---|
  | Raising Cane’s · Fisherman’s Wharf (`raising-canes-jefferson-sf`), opened 2026-09-21 | 211 Jefferson Street · site 2026-09-27 | https://www.openstreetmap.org/way/91185861 (211 Jefferson St, 37.8080974, −122.4160763) | −204.6, 79.4 (3.2 u; 6.8 u from the Crab Wheel) |
  | La Boulangerie at ERIA Marina (`boulangerie-eria-celebration`) | 2300 Chestnut Street · site 2026-09-15 | https://www.openstreetmap.org/way/272700939 (2300–2320 Chestnut St, 37.8003427, −122.4415071) | −331.8, 387.0 (2.2 u) |
  | The Mess Hall · Breadwinner (`mess-hall-presidio-breadwinner`) | 201 Halleck Street · site 2026-09-15 | https://www.openstreetmap.org/way/30130770 (Building 201, 37.8026073, −122.454658) | −471.5, 482.2 (1.5 u) |

  Hours notes (the card's line, from the shop's own page, read 2026-09-29): Raising Cane's store page — daily from
  10:00, to 01:00 (Fri–Sat 02:00) (https://locations.raisingcanes.com/ca/san-francisco/211-jefferson-st); La Boulangerie —
  "7 am to 2:30pm Daily", weekend brunch (https://www.laboulangeriesf.com/locations-hours); the Mess Hall — opened Aug 15,
  2026, Breadwinner open (https://sfstandard.com/2026/08/10/mess-hall-presidio-food-open/; the site's note "Breadwinner 从
  11:00 供应").
- **`live.json`** re-exported through `scripts/opus-sf/export-live.ts` (14 offers): **`sfmta-free-muni-seniors`** — a
  standing transit offer like the youth one (place none, who "65 岁以上 SF 居民，收入符合，须先申请"), its rule read from
  SFMTA's English page https://www.sfmta.com/fares/free-muni-seniors-ages-65 (2026-09-29: "All San Francisco seniors, ages
  65+, with a gross annual family income at or below 100 percent of Bay Area Median Income"; apply first; cable cars
  included with Clipper). The 今天 tab's 长期福利 lists it next to the youth Muni. (The export writes its UTC date:
  `exported` reads 2026-09-30.)
- **The Chase Center cards** (`realsf/HowToGo.tsx` + the new `realsf/chaseMuni.ts`): a card whose point is at Chase Center
  (its events' board, its place card; not Thrive City's free plaza events) says "持大通中心活动票，当天可坐 Muni 公交和轻轨
  （不含缆车） · BAYLINK 优惠详情" → `/offers/chase-center-ticket-muni-included` (a purchase deal: never a live.json row).
  Source: https://www.sfmta.com/fares/your-chase-center-event-ticket-your-muni-fare (the site's; checked 2026-09-29).
- Tests: `tests/opus-bay-w6-s-openings.test.ts` follows `currentOpenings` (every open SF opening has a sign and only those,
  the announced ones none, each ≤ 5 u from its OSM point, **≥ 6 u from the Crab Wheel**, standable, off the road, on the
  walking network); new `tests/opus-bay-w7-s-site.test.ts` (2): the seniors' row (standing, English rule, never dated), the
  Chase Center line at the arena and its place card, not at Thrive City, the offer link in the rendered card.

### Evidence

- Raising Cane's in the game (desktop, zh, `?date=2026-10-03T12:00`): `openings()` = `{ built: 'raising-canes-jefferson-sf',
  tris: 180 }`. **Found in play**: at the first spot (2.4 u from the Crab Wheel) the E prompt was the Crab Wheel's card
  even at the sign's front; moved 3.2 u west along Jefferson St (6.8 u from the wheel) the prompt is "E · 看看新店 · Raising
  Cane’s · Fisherman’s Wharf" and the card opens: 新店 · 已开业 · 炸鸡柳快餐 · 旧金山首店 · 211 Jefferson Street … · 门店页：每天
  10:00 起，营业到深夜 · BAYLINK 新店页 · BAYLINK 编辑 2026-09-27 核对 (`qa/w7/S/s3-opening-raising-canes-card-desktop.jpg`).
- The Warriors v Lakers card at Chase Center (desktop, zh, `?date=2026-10-06T19:15`): `presence()` open
  `sf-warriors-lakers-preseason-2026`, board 128 triangles; E · 看看活动 · 勇士对湖人季前赛; the card shows the Muni line with
  BAYLINK 优惠详情 (`qa/w7/S/s3-chase-center-card-muni-desktop.jpg`).
- Checks of the parts b + c push (`68037235`, rebased over lanes Q, W2, R, W1, P, H, G, K, B): `npx tsc -p tsconfig.app.json
  --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings; HowToGo.tsx's constants had added 3 fast-refresh warnings, fixed
  by moving them to `chaseMuni.ts` before the push) · the suite on the pushed tree **1548 / 1548** (before it, the part
  b + c tree: 1518 / 1518).

### Decisions

1. **The site's rule decides the signs** (the lead's plan): open or soft_open, region sf, from the list the site
   publishes; announced shops wait until the site flips them.
2. **Raising Cane's sign stands 3.2 u west of its address point** (the brief's ≤ 5 u), because the Crab Wheel landmark is
   2.4 u from the first spot and took the E prompt; the openings test now keeps every sign ≥ 6 u from the wheel.
3. **The Chase Center Muni line is a card line, not an offer row**: the offer is a purchase (a ticket), and a live.json row
   would read like a discount; the line goes where the ticket matters (the arena's events and its place card).

### Known gaps

- The Waverly Place line was seen on offer, not heard in the bubble in the shot's 45 s (fresh save).
- The Chase Center line's external-link icon wraps to its own line on the desktop card (cosmetic).

### Requests

- **The site's editors (via the lead / owner)**: (1) add the **Chinatown Halloween Festival** (Sat 31 Oct 2026, 11:00–15:00,
  Waverly Place, free, family; https://www.cycsf.org/chinatown-halloween-festival/, checked 2026-09-29) to the catalog —
  the game then gives it a venue row; (2) `sfmta-free-muni-seniors`' `sourceUrl` is SFMTA's Vietnamese page
  (https://www.sfmta.com/vi/node/12193): the English page is https://www.sfmta.com/fares/free-muni-seniors-ages-65;
  (3) Handroll Hawker (2360 Polk St) was announced for Sep 29: when the site marks it open, the game adds a sign.
- **Lane X**: the four fixed lines of part b (table above) are on origin since 22:25 (`1242bc5b`, `realsf/calendar.ts`,
  `realsf/jets.ts`); the voice id is `realsf-<key>`.
- **Lane H**: Día de los Muertos' calendar row now points at 22nd & Bryant (your `ROUTE_CORNERS.bryant22`) at 19:00, grade
  usually; the Chinatown festival (Oct 31 11–15, Waverly Place `{ x: 36.0, z: 149.0 }`) has a pumpkin patch — pumpkins
  there would fit if you dress it.
- **Lane K**: the area chip at Raising Cane's reads 北滩 · Jefferson Street (your `cityAreaAt` item 4, the Wharf area).

## Part d · the owner's live dates end to end (W7-S4)

Written 2026-09-29 ≈ 23:25 PDT. The world's own functions over the real catalog on this tree (`activeEventsAt`,
`calendarOn`, `jetsUp`, `blueLineOn`, `halloweenPhase`, `sunTimes`; scratch `C:/Users/willy/opus-qa/w7/s/dates.mts`), then
the moments marked ▶ played in the game on the dev server with `?date=`.

| Bay time | world events open (event @ venue row) | calendar rows | jets | Halloween phase | sunset |
|---|---|---|---|---|---|
| Fri Oct 2 12:00 | Hardly Strictly @ hellman-hollow | — | — | season | 18:51 |
| Sat Oct 3 10:30 | the market + **Foodwise Latine Makers** @ ferry-building, Hardly Strictly | — | — | season | 18:49 |
| Sun Oct 4 13:00 | Litquake @ YBG, **Castro Street Fair** @ castro-market, Hardly Strictly | — | — | season | 18:48 |
| Fri Oct 9 11:30 | — | **Parade of Ships** | not yet (+ the Blue Angels line) | season | 18:40 |
| Fri Oct 9 12:40 | Fleet Week @ marina-green | Parade of Ships | up (+ blue line) | season | 18:40 |
| Sat Oct 10 12:30 | the market, Fleet Week | — | up (+ blue line) | season | 18:39 |
| ▶ Sun Oct 11 12:40 | Fleet Week, **Inner Sunset Flea** @ irving-11th, YBG Dance Day, Italian Heritage Parade @ jefferson-powell | — | up (+ blue line) | season | 18:38 |
| Sat Oct 24 12:30 | the market, Exploratorium family day, Chowder Fest, Thrill-O-Ween @ thrive-city | — | — | season | 18:20 |
| ▶ Sat Oct 24 15:00 | Exploratorium, Chowder Fest, Thrill-O-Ween, **Bay Beats** @ golden-gate-bandshell | — | — | season | 18:20 |
| ▶ Sat Oct 31 12:30 | the market, the Halloween Hoopla @ YBG | Halloween, **Chinatown Halloween Festival** | — | night | 18:12 |
| Sat Oct 31 19:30 | Figaro opening @ the Opera House | Halloween, Chinatown festival | — | night | 18:12 |
| ▶ Sun Nov 1 10:00 | — | **DST ends** | — | muertos | **17:11** |
| Mon Nov 2 12:00 / 19:30 | — | **Día de los Muertos** (19:00, 22nd & Bryant) | — | muertos | 17:10 |

Played (dev server 5707, headless Chrome `--force_high_performance_gpu`):

- **Oct 11 12:40**, phone 390 × 844 dpr 3, zh, `?at=marina-green`: `presence()` open = Fleet Week, the Inner Sunset Flea, YBG
  Dance Day, the Italian Heritage Parade; kits built = the parade (250 tris) and Fleet Week (468) — the two nearest, the
  flea's arch (364 tris, seen built at Irving in part a) is 700 u away; `jets()` = up, built, 4 jets, 1,096 triangles, 15
  soft boxes; BAYBAY's offered lines: the Fleet Week souvenir and event lines, `jets-up`
  (`qa/w7/S/s4-fleet-week-2026-10-11-marina-phone.jpg`: Marina Green by the water, lane W2's new Alcatraz on the horizon).
- **Oct 17 12:00**, desktop, zh, on 20th St east of Arkansas facing west (the DEV `placePlayer`): `presence()` open = the
  market, **Potrero Hill Festival**, **the Marina library open house**, the Pumpkin Fest, the Science Festival, FilBookFest,
  **the Fall Show**; kits = the Science Festival (368) and the festival's arch (364); the arch spans 20th St with its coral
  banner and balloons, the area chip 波特雷罗山 · 20th Street, and BAYBAY says "今天Potrero Hill有街区节，10:00起，出发前查官网确认哦。"
  — the start-only rule, no invented end (`qa/w7/S/s4-potrero-hill-arch-2026-10-17-desktop.jpg`).
- **Oct 18 12:00**, desktop, zh, on Mission St south of the arch facing north: `presence()` open = **Sunday Streets**, the
  Fall Show (Sunday 11–17), FilBookFest; kit = the arch (364 tris) over Mission St with its pennants and balloons, the area
  chip 精益区 · Mission Street (`qa/w7/S/s4-sunday-streets-arch-2026-10-18-desktop.jpg`). The toy traffic still drives
  under it (the real street is closed to cars that day: a known gap, like the Castro).
- **Oct 24 15:00** (part a): Bay Beats with its concourse crowd, no toy stage.
- **Oct 31 12:00** at Waverly Place (part b): the Chinatown line on offer.
- **Nov 1 10:00** (part b): the 今天 tab's DST row with today's sunset 17:11, 这周 Día de los Muertos 明天 with 以官网为准.
- Oct 2–4 are unchanged from wave 6 (the same catalog rows and venue rows; the table above from the world's functions),
  plus the Foodwise market on Oct 3 at the Ferry Building.

### Known gaps

- Toy cars still drive through the closed streets of the three street fairs (the arch lets them pass under, as at the
  Castro); the Nov 2 procession is lane H's, not shot here.
- The table's times are the Bay clock's; on 1 Nov the repeated 01:00–01:59 hour reads its first (PDT) copy (bayNow's rule).

### Requests

- **Lane H**: the Inner Sunset Flea (Oct 11 10–16, "Tricks, Treats & Treasures") has its arch at `{ x: -158.0, z: 1017.9 }`
  on Irving at 11th Ave — pumpkins there would fit, like Thrive City and Sunnydale.
- **W7-Z**: Oct 11 13:00 at Jefferson & Powell / Aquatic Park is the heaviest overlap (the parade kit, the Fleet Week kit
  and crowd, six jets on high; the day-0 scout's suggestion) — worth a dated perf spot.

## Not done

- Toy ships for the Parade of Ships (Oct 9 11:00–12:00): a calendar row only (part b, decision 5).
- A venue row for the Chinatown Halloween Festival: it waits for the site's catalog (Request above).
