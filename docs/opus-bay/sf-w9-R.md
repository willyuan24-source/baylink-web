# Wave 9 · lane R — real-world value (report)

Lane R of wave 9 (sf-w9-lead.md §3 R), worktree `C:/Users/willy/wt/w9-r`, port 5904, scratch `C:/Users/willy/opus-qa/w9/r/`.
Times are PDT (America/Los_Angeles), 2026-10-01 → 10-02.

## 给主人的摘要

1. 「今天在旧金山」一句话接口 `todayHeadline()` 已上线（舰队周 10/9–10/11、日落前 30 分钟「日落还有 n 分钟 · 飞去双峰」、当天免费福利、当天活动、三天内的大日子），标题页那条由 F 线接上。
2. 「出行档案」`realsf/prefs.ts`：这周去哪的三个答案（带娃 / 带长辈 / 自己 / 两个人）会被记住，下次推荐、每日三件小事和卡片重点都能用。
3. 有截止日期的四场旧金山图书馆亲子 / 社区活动（10/7 乐高、10/8 儿童科学游戏、10/17 社区历史日、10/24 开放日）已经进游戏：每场都在官网重新核对过（2026-10-01），门口有活动牌，有纪念章。

## Part a (21:35 → ) — the contract APIs and the time-bound library events

### W9-R1 · `todayHeadline(now, locale)` and `realsf/prefs.ts` (sf-w9-lead.md §4)

- `realsf/todayLine.ts` **`todayHeadline(now, locale = 'zh', inputs?) → { id, zh, en, action? } | null`** (pure: `now` and the
  inputs; defaults = the loaded catalog, the loaded `live.json` offers, `realsf/calendar.ts CALENDAR`). One line at a time,
  in this order:
  1. a calendar day **on now** inside its organiser-stated hours (`CalendarRow.show`, new): the Parade of Ships 9 Oct
     11–12, the Fleet Week air show 9–11 Oct 12–16 (its own words: 「舰队周飞行表演正在进行 · 蓝天使通常 3 点左右」 — the
     Blue Angels' slot is not posted, navyweek.org is secondary), the Chinatown Halloween Festival 31 Oct 11–15;
  2. **the sunset within 30 min**: 「日落还有 12 分钟 · 飞去双峰」 (action: go to `twin-peaks`, `prefer: 'fly'`);
  3. a calendar day **later today** (「今天 11:00 舰队周 · 舰船巡游 · 码头绿地看台」; a 'secondary' / 'usually' bare start says 约);
  4. a **dressing day** without a time (「今天万圣节 · 维多利亚老房子的台阶」, the king tides);
  5. **today's free** from BAYLINK's offers — only dated or monthly-on-its-day offers (the zoo's resident day 10/7, Asian
     Art 10/4, Conservatory 10/6, Botanical Garden 10/13, MoAD 10/1 and 10/10, SFMOMA family 10/25, the Museo's first
     Sunday); weekly offers are not news; "who" shown when it is not everyone (「· SF 居民」);
  6. **today's event in the world** with a short name (`EVENT_SAY`): 「今天 19:30 大通中心有 Doja Cat 演唱会」 / 「渡轮大厦的农夫市集正在进行」;
  7. a calendar day in the **next 3 days** (「10月9日 舰队周 · 舰船巡游 · 码头绿地看台」).
  Every zh line ≤ 32 characters (the place / who / hours drop in that order when long); English never carries Chinese.
  `action` = `{ kind: 'go', placeId?, point?, name, prefer?, label }` (N's `goTo` target) | `{ kind: 'event', eventId }` |
  `{ kind: 'today' }` (the journal's 今天 page). `locale` is accepted for the contract; both languages are returned (zh-Hant
  through the caller's `t()`). Not voiced: it is a strip, not a BAYBAY line (nothing for new-lines.md).
- `realsf/prefs.ts` **`getPrefs() / setPrefs(patch) / subscribePrefs(fn) / profileOf(companions)`**, own key
  `opus-bay:prefs:v1` (`{ companions, vibe, region, at }`; no save bit), `?save=off` or a blocked storage = memory only;
  the profile is derived: 带娃 → `kids`, 带长辈 → `seniors`, 自己 → `solo`, 约会 → `pair`, 和朋友 → none. Values are checked
  (`/^[a-z][a-z-]{0,23}$/`), malformed JSON = defaults, never throws. `realsf/index.ts` (city mode, lazy) stores the
  three answers whenever 这周去哪 completes (a `game.subscribe` on `week`; no edit to F's `flow.ts`).
- Tests `tests/opus-bay-w9-r-today.test.ts` (5): Fleet Week by the hour (9 Oct 09:00 / 11:20 / 13:00, 10 Oct 10:00, 11 Oct
  15:59 / 16:00, the 7 Oct look-ahead), the sunset at 12 / 30 / 31 / −1 min, the free lines (7 Oct zoo with 「· SF 居民」, over
  at 16:05; 4 Oct Asian Art; a Friday with weekly offers only → no free line), the event line and a quiet December
  morning (null), every headline of Oct–Nov at 08:00 / 12:30 / 17:30 ≤ 32 zh characters with no Chinese in English;
  prefs (key, profile, no-change = no write, untrusted values, no storage, a throwing storage).
- A probe of every day 1 Oct – 4 Nov at 09:00 / 13:00 / 18:20 is in the scratch (`hl.mts`); read through: no wrong day,
  no stale event, the Museo's Thursdays no longer called news, 「Portola 有…」 / 「大通中心有 Doja Cat…」 spaced.

### W9-R2 · the four SFPL family / community events (time-bound: 7 / 8 / 17 / 24 Oct)

Each event page re-read on sfpl.org on **2026-10-01**:

| catalog id | sfpl.org (read 2026-10-01) | venue row | board spot (city frame) |
|---|---|---|---|
| `sfpl-richmond-lego-oct7-2026` | "Activity Lego Free Play", Wed 10/7/2026 4:00–5:30, Richmond Meeting Room, ages 5+, drop-in — https://sfpl.org/events/2026/10/07/activity-lego-free-play | `richmond-library` (351 9th Ave, OSM way 68876388; main entrance node 6483159794) | −352.3, 822.5 (9th Ave pavement) |
| `sfpl-ocean-view-stem-oct8-2026` | "Activity: STEM Free Play", Thu 10/8/2026 3:30–4:30, Ocean View Meeting Room, 3+ with a caregiver, drop-in — https://sfpl.org/events/2026/10/08/activity-stem-free-play | `ocean-view-library` (345 Randolph St, OSM way 277741614; main entrance node 11746456801) | 414.4, 1530.1 |
| `sfpl-omi-history-day-oct17-2026` | "Presentation: Ocean View, Merced Heights, and Ingleside History Day", Sat 10/17/2026 3:00–5:00, Ingleside Meeting Room, free — https://sfpl.org/events/2026/10/17/presentation-ocean-view-merced-heights-and-ingleside-history-day | `ingleside-library` (1298 Ocean Ave, OSM way 159024969) | 389.0, 1336.3 |
| `sfpl-western-addition-open-house-oct24-2026` | "Celebration: Western Addition Open House", Sat 10/24/2026 12:00–4:00, Back Courtyard + Children's Area, "FREE entertainment, snacks and fun for the whole family!" — https://sfpl.org/events/2026/10/24/celebration-western-addition-open-house | `western-addition-library` (1550 Scott St, OSM way 160833254) | −115.3, 526.2 (Scott St pavement) |

- `realsf/eventVenues.ts`: four `board` rows (the pavement outside each door, found by a probe over the published city —
  standable, pavement, a walk-graph node within 16 u in ferry-gate's component: `C:/Users/willy/opus-qa/w9/r/lib-probe.mts`),
  the four ids out of `WORLD_SKIP` (the three Main Library programmes stay: career coaching, the writing session, the
  green-bin talk), four souvenir ids **appended** to `SOUVENIR_IDS` (after `fleet-week-2026-parade`), `EVENT_SAY` (乐高自由搭建 ·
  儿童科学游戏 · 社区历史日 · 图书馆开放日) and `VENUE_SAY` (Western Addition = 西增区图书馆: the event line 「今天…有…，12:00–16:00，出发前查官网哦。」 must fit 45 characters — `tests/opus-bay-w7-s-venues.test.ts` W7-S1 guard read 50 with the Latin name). The catalog's dates rule (the rows only position them).
- `tests/opus-bay-w6-s-venues.test.ts` (R owns `tests/opus-bay-w6-s-*`): the main-side assertion now keeps only the three
  Main Library ids out and checks the four are in (not skipped, at their row, caught by the venue text alone, the souvenir
  appended, a short name); SF events shown 47 → **51**. `tests/opus-bay-w5-events.test.ts` walks the four new points
  (standable, a graph node within 16 u, reachable from ferry-gate): green.

### Part a checks (22:13–22:40 PDT, before the push)

`npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (50 warnings, the old ones) · opus-bay suite 1876 tests:
1872 pass, 3 fail, 1 todo → the W7-S1 guard (the Western Addition line at 50 > 45 characters: fixed with 西增区图书馆, re-run
green with the new tests: 7 / 0) and two wall-clock tests under load (`opus-bay-audio` P1 sliced jobs, `opus-bay-sf-move2`
E2-5 cached cell): both green alone (18 / 0, 24 / 0).

## Part b (22:50 → 01:30) — free days ahead (R§5 #10) and the recommendations (R§5 #12)

### W9-R3 · 这周免费 / free days ahead / 加到日历

- **`realsf/freeWeek.ts`** (pure): `freeWeek(today, 7, offers, catalog, companions?)` — each of the next 7 Bay days with
  its free things: BAYLINK's offers that apply that day (dated first, then monthly, then weekly; an offer free on ≥ 5 days
  of the week — the cable car museum, the Randall — is 常年免费, never a day's item) and the catalog's free San Francisco
  events (never 18+ / professional; with 带娃 / 带长辈 only the ones that fit them). `freeDaysAt(point, today, 7, offers,
  ids)` = a card's free days (by the card's place ids first, else within 8 u — SFMOMA and MoAD stand 12.5 u apart, a
  30 u ring showed MoAD's 10/10 on SFMOMA's card: red in the test before the change), `alwaysFreeAt` (one 常年免费 line),
  `eventDayHours` (the catalog schedule, else the date label).
- **`realsf/FreeWeekStrip.tsx`** (lazy chunk): 7 day chips with counts, the chosen day's rows with 带我去 (N's `goTo`), 看看
  (event card), 加到日历, the BAYLINK offer page, the official source and its check date. In `ui/WeekPanel.tsx` (city
  mode): under the first question (2 rows), on 「免费就好」's board **above** the flyers (6 rows: offers merged with the
  free events, "免费就好 · 这几天的免费福利和活动"), on any other board below the flyers (2 rows). English rows show the
  hours as numbers and the venue through `catalogText` (the catalog's Chinese date label leaked into English at first:
  「周二、四10:00–14:00」 on the Ferry Plaza row — read in the probe, fixed before the commit).
- **`realsf/FreeDays.tsx`** (lazy) on `ui/PoiCardBody.tsx` (city) and `ui/PlaceCard.tsx`: 「近 7 天免费」 — the zoo's card on
  1 Oct now says **Wed 10/7 · 10:00–16:00 · SF residents · with proof of address** + 加到日历 (before: 需要买票 only;
  `offersForPlace` had no caller).
- **`realsf/ics.ts`** (lazy, loaded on the tap through `realsf/addCal.ts`): an .ics with `VALARM` `TRIGGER:-P1D` (timed) /
  `-PT15H` (all day → 09:00 the day before), UTC times (no VTIMEZONE), RFC 5545 escaping and 75-octet folding, the same
  shape as the site's `src/lib/monthly.ts buildEventCalendar` (written here: the site builder pulls the site translator
  and edition data, has no VALARM and takes the site's event type). 「加到日历」 on the event card (`ui/EventCardBody.tsx`,
  the next showing day), the strip rows and the card rows.
- Played (dev server 5904, 1440×900, `?date=2026-10-01T10:00`, headless Chrome, read every image): the questions with
  带长辈 and the strip (today 4 · Fri 2 · Sat 4 · Sun 5 · Mon 1 · Tue 2 · Wed 2); 带娃 / 免费就好 / 旧金山哪儿都行 → the free
  strip above the flyers, the evening block party gone for kids; the zoo card's free day; the event card's buttons
  (… Plan it | **Add to calendar** | Official site …). Images: `docs/opus-bay/qa/w9/R/`.

### W9-R4 · 这周去哪 in city mode: relax order, 户外, the city's parts, 带长辈, honest notes, the profile in today's three

- `data/catalog.ts`: city mode relaxes **vibe → companions → region**, and a part of the city relaxes to all of San
  Francisco before the Bay (district mode keeps region → vibe → companions: `tests/opus-bay-flow-data.test.ts` green).
  **Before / after** on the 1 Oct catalog (probe `C:/Users/willy/opus-qa/w9/r/rec-probe.mts`, the old module side by side):
  带娃 / 户外 / 旧金山 — before: Santa Rosa pumpkins, Vacaville colour run, Fremont Ohlone gathering, note 「旧金山这几天不多，也放了
  别的地区的。」; after: the African Arts Festival, Foodwise Latine Makers, the Inner Sunset Flea, the Italian Heritage Parade
  (all SF), note 「7 天内合适的不多，我把时间放宽到了两周。」. 和朋友 / 吃喝 / 旧金山 — before: 2 SF + Clayton / Oakland
  Oktoberfest + Tiburon wine, 「旧金山这几天不多」; after: the market + Latine Makers first, then HSB / Castro / YBG,
  「…旧金山合适的吃喝类这两周只有 2 个，另外给你挑了免费户外。」 (once the vibe relaxes, every fitting pick comes first so the
  count is the board's).
- 户外 = `isOutdoor(event)`: category, the catalog's `planning.setting`, an open-air venue in the world (`EventSpot.outdoor`
  from `realsf/index.ts`: any kit but the door board), or a park / lawn / street / beach venue (not a library / hall /
  museum). Hardly Strictly Bluegrass (culture, Hellman Hollow) and the African Arts Festival (YBG's Great Lawn) are 户外 now.
- The third question in city mode (`ui/WeekPanel.tsx weekOptions`): 北岸 · 码头 · 唐人街 / 市中心 · SoMa / 金门公园 · 西边 /
  Mission · 南边 / 旧金山哪儿都行 / 湾区其他地方 (`sfAreaAt(lat, lng)`; the voiced question line is unchanged). The first
  question gains **带长辈** (daytime, for everyone: no start ≥ 19:00, no 18+ / tech; 「适合带长辈」 only from audience words
  长者 / 所有年龄 / 全龄). The board's calendar link maps a part of SF to `region=sf`.
- The notes count what the place had: 「旧金山这周合适的只有 2 个，也放了别的地区的。」, 「北岸一带这周没有完全合适的，放了旧金山
  别处和湾区其他地方的。」.
- **The profile**: the three answers → `realsf/prefs.ts`; 「用上次的：带娃 · 免费就好 · 旧金山哪儿都行」 on the first question;
  `realsf/daily.ts daySignals(…, profile)` — with 带娃 the event task is a kids event or a free open-air daytime one (never
  the symphony / opera / arena), with 带长辈 never a night start; a new profile re-picks today's three only while none is
  done (a paid `daily:<date>:<n>` never lands on another task).
- Tests: `tests/opus-bay-w9-r-recommend.test.ts` (6): the planner's case (all SF, no North Bay, kids never relaxed, no
  "SF is quiet"), 户外 by what it is, the parts (venues in the right part; a part → the city → the Bay; 湾区其他地方 never
  SF), the notes, 带长辈 + a sweep of 3 × 5 × 6 answers (no 18+ for kids, no tech outside solo + culture, a note whenever
  something relaxed), the profile in today's three over 61 days. `tests/opus-bay-w9-r-free.test.ts` (5).
