# Wave 9 · lane R — real-world value (report)

Lane R of wave 9 (sf-w9-lead.md §3 R), worktree `C:/Users/willy/wt/w9-r`, port 5904, scratch `C:/Users/willy/opus-qa/w9/r/`.
Times are PDT (America/Los_Angeles), 2026-10-01 → 10-02.

## 给主人的摘要

1. 免费福利能「提前看到」了：这周去哪顶上有「这周免费」7 天条，地点卡写「近 7 天免费」（例：动物园卡在 10/1 就显示 10/7 旧金山居民免费日），活动卡和免费日都能「加到日历」（前一天提醒）。
2. 「这周去哪」在城市模式先放宽「感觉」、再放宽「和谁」，最后才放宽地区；第三问改成旧金山的几片区域，新增「带长辈」；「带娃 · 户外 · 旧金山」不再推到圣罗莎和瓦卡维尔。答案会被记住，每日三件小事也按它挑。
3. 卡片上不再出现编辑的内部备注（如「售票详情页本次触发等待页」），中英文都过滤；被空格粘在一起的两句话补上标点（全目录 113 处）。
4. 迪扬博物馆和荣勋宫的卡写上「湾区九县居民每周六免费」（官网 2026-10-02 核对）；动物园小火车改成「11–16 点开，下雨或维护时停」；活动卡的公交班次按活动当天分工作日 / 周末。
5. 四场有截止日期的旧金山图书馆活动（10/7、10/8、10/17、10/24）已进游戏；`todayHeadline()` 和出行档案接口按时交付。
6. 需要网站那边做的：把「迪扬 / 荣勋宫周六免费」加进 BAYLINK 优惠库（游戏的免费条才能显示）、唐人街万圣节（10/31）录入活动库、修 First Thursdays 的 8 月旧链接、源头删掉内部备注。

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

## Part c (02:14 → 04:45) — the resume after the usage limit, correctness (W9-R3b, R5, R6, R7)

The first lane-R agent stopped at ≈ 00:35 at an account usage limit. At 02:14 the worktree held W9-R3 and W9-R4
committed but not pushed and three uncommitted files (`ui/EventCardBody.tsx`, new `data/publicText.ts`, new
`tests/opus-bay-w9-r-words.test.ts`), 35 commits behind origin. What happened to them:

- **W9-R3 / W9-R4**: kept as they were, rebased onto origin (no conflict), checked (tsc 0, eslint . 0 errors, the
  opus-bay suite on the rebased tree: 2012 tests, 2010 pass, 1 todo, 1 fail = W8-Q3, caused by the uncommitted W9-R5
  work, not by R3 / R4) and pushed at 02:52 (`9348e21f`, `d461bbd6`).
- **W9-R3b** (`2bda2d03`): the event card's 「加到日历」 button — W9-R3's message and this report already named it, but
  it was still in the uncommitted diff; split out and pushed with R3 / R4.
- **The uncommitted publicText work was broken in English** (kept and fixed, not discarded): it filtered the zh string
  before the site's runtime translated the text node, and the runtime's dictionary is keyed by the catalog's exact
  text — so every changed SF card showed Chinese in English (W8-Q3 red, 20+ cards). Rewritten as W9-R5 below.

### W9-R5 · the editors' working notes never reach a card (`0fb3cb6d`; review R§6 现实出行价值 row 4)

- `data/publicText.ts` `publicText(s, locale)` / `publicLines(lines, locale)`. zh: a clause (or a ，part) that only
  describes the editors' checking goes (触发 / 等待页 / 被阻 / 核实日之后 / 未代预约 / 不补造); 「本次」 leaves the honest
  ones (「具体结束时间本次未复核」 → 「具体结束时间未复核」 — the honest uncertainty is the review's §4.2 strength, so it is kept,
  not dropped); 节目页时长 → 时长; two sentences joined by a space get a ；. en: the site's translation of the ORIGINAL, then
  the same in English ("during this check" goes, a "waiting screen" / "was blocked" / "verification date" / "on your
  behalf" / "has been invented" sentence goes; "Prices and availability have not been retrieved." → "Check the official
  ticket page for prices and availability."). zh-Hant: the zh result.
- Used by the event card (date label, cost, summary, 出发前), the 今天 tab's event rows (cost) and the .ics description.
  `scripts/opus-sf/export-live.ts` throws when an offer's title / requirement (zh or en) carries a working-note word.
- Before / after over the whole catalog (1916 shown texts, all regions): working-note words zh **46 → 0**, en **48 → 0**;
  zh sentences joined by a space **113 → 0**. Played (dev server 5904, 1440×900, `?date=2026-10-02T10:00`, English):
  Renée Fleming's card reads "Cost and eligibility: Ticket prices have not been verified; check the official ticket page.
  Purchase tickets for a specific performance." (the waiting-screen sentence gone) —
  `docs/opus-bay/qa/w9/R/fleming-card-en-weekend.jpg`.

### W9-R6 · de Young / Legion of Honor free Saturdays, the zoo's train (`1f098c09`; R§6 rows 6 + 11)

- famsf.org answers 403 / a Cloudflare challenge to plain fetches (the first agent's `deyoung.html` in the scratch is the
  challenge page); the ticket pages were read in headless Chrome on **2026-10-02**:
  https://ticketing.famsf.org/events/0191859e-ae61-6e35-b2cf-55f10d95ca3c (de Young) and
  https://ticketing.famsf.org/events/019185a9-f777-f93c-59fc-52de9182bc57 (Legion of Honor): residents of the nine Bay
  Area counties (Alameda, Contra Costa, Marin, Napa, San Francisco, San Mateo, Santa Clara, Solano, Sonoma) get free
  general admission every Saturday; ID on site (a driver's license or a postmarked envelope with the address); four per
  household; special exhibitions extra.
- `data/sf/placeCards.ts` CARD_REFRESHES: de Young cost 「观景塔免费；湾区九县居民每周六免费看常设展（带有地址的证件或信件，特展另付）。」,
  Legion cost the same + 「其他日子要买票」, both verifiedAt 2026-10-02. They are card text only: 这周免费 / 近 7 天免费 show
  BAYLINK's own offers (`live.json`), and the site has no Free Saturdays offer (Request 1).
- The zoo tip 「园里的小火车目前停运。」 → 「园里的 Little Puffer 蒸汽小火车 11:00–16:00 开，每人 9 美元；下雨或维护时停开，出发前确认。」
  (https://www.sfzoo.org/rides-more/, read 2026-10-02: "Train Hours of Operation: 11:00 a.m. to 4 p.m.", "$9 per
  person", "does not run in wet weather … periodically closed for maintenance").
- `tests/opus-bay-w9-r-cards.test.ts` 2/2 (red 0/2 on the previous placeCards.ts); `tests/opus-bay-sf-cards.test.ts`
  (surgical) accepts verifiedAt 2026-10-02.

### W9-R7 · transit by the event's day (`cc292f37`; R§6 "交通班次不分工作日和周末")

- `realsf/transitReal.ts serviceLabel(…, onDay)`: an event's row names 工作日 / 周末 (sfmta.com's two columns, checked
  2026-09-28) and says 「那时停运」 when the line is not running at the event's start; without `onDay` it is unchanged.
- `realsf/HowToGo.tsx` takes `day` / `event` (the event card passes its next day): the rows use that day and the
  event's start (`eventDayHours`), the heading adds the day when it is not today. Played: Fleming's next showing (Sat
  10/3 19:30) seen on Fri 10/2 — "Getting there for real · Tomorrow · Sat", N Judah "about every 12 min by day on
  weekends", M "every 10–15 min by day on weekends" (before: the weekday columns of the day you look).
- `tests/opus-bay-w9-r-transit.test.ts` 2/2 (red 1/2 on the previous transitReal.ts).

### Checked, nothing to change

- **The Chinatown Halloween Festival** (31 Oct): `realsf/calendar.ts` row `chinatown-halloween-festival-2026` (11:00–15:00,
  cycsf.org) and lane L's map search (W9-L1 / L1b: 万圣 → 唐人街万圣节庆典 first) already make it findable;
  https://www.cycsf.org/chinatown-halloween-festival/ re-read 2026-10-02: "Saturday, October 31, 2026, from 11am-3pm",
  "on Waverly Place" — the row is right. The site catalog still lacks it (Request 2).
- **live.json**: `npx tsx scripts/opus-sf/export-live.ts` re-run at ≈ 03:15 with the new guard: the same 15 SF offers
  (the latest dated row is SFMOMA's 25 Oct family day); only `exported` changed, so the file was restored, not committed.
- **New voiced lines**: none (C:/Users/willy/opus-qa/w9/new-lines.md has lane R's "none" row, 03:46).

### Not done (handed on)

- **The link-patrol script** (status + a month in the URL) was not written. Its one known find: the catalog's
  `sf-downtown-first-thursday-oct-2026` links `https://www.theeastcut.org/event/downtown-first-thursday-august-2-2-3-7/`
  (August) — the event day (1 Oct) has passed, so the game card shows 已结束; the source is the site's (Request 3).
- **Manual "how to get there" for the T1 cards without one** (Golden Gate Bridge, the zoo, Legion of Honor: 28 bus,
  PresidiGo, the L terminus) — not started; each needs an official source read (sfmta.com route pages, presidio.gov).
- **de Young / Legion Saturdays in 这周免费**: waits for the site offer (Request 1); a game-side offer would have no
  `/offers/:id` page to link.
- The zh-Hans event card was checked by the jsdom tests and the probe scripts, not in a zh screenshot (headless Chrome
  opened the game in English).

### Requests

1. **Site (offers)**: add BAYLINK offers for FAMSF's Free Saturdays (de Young and Legion of Honor; the two ticket pages
   above, read 2026-10-02; weekly, Saturday; Bay Area residents of the nine counties). Then lane R adds two SPECS rows in
   `scripts/opus-sf/export-live.ts` (weekdays [6], the museums' hours) and re-exports.
2. **Site (catalog)**: the Chinatown Halloween Festival, Sat 31 Oct 2026 11:00–15:00, Waverly Place,
   https://www.cycsf.org/chinatown-halloween-festival/ (checked 2026-10-02).
3. **Site (catalog editors)**: fix the First Thursdays official link (August page) and take the working notes out of the
   source rows (e.g. `sf-symphony-fleming-strauss-2026` cost 「售票详情页本次触发等待页」, `sf-opera-mary-queen-scots-2026`
   「收录核实日之后的三场」, `menlo-hana-baba-folktales-2026` 「单场详情点击本次被阻」); the game filters them now, the
   site's own pages still show them.

### Part c checks

tsc 0 after every rebase; `npx eslint .` 0 errors (50 old warnings) at 02:30, and on every changed file before each
commit; each commit's own tests are listed in its message.
The final opus-bay suite on `cc292f37` (W9-R7 on origin, 04:15–04:30): **2106 tests, 2105 pass, 0 fail, 1 todo** (W8-P9, the wave-8 GameRoot target). `npx eslint .` at 04:42: 0 errors (53 warnings, none in lane R's files).

## Review (Ultra) — W9-R-review (fixer, 05:43 → 06:45 PDT, 2026-10-02)

Worktree `C:/Users/willy/wt/w9-r-rev` from origin/opus-bay `e9c3c35c`, scratch `C:/Users/willy/opus-qa/w9/r-rev/`.
Lenses: code (`opus-qa/w9/r-rc/findings.json`, 6 findings) and player (`opus-qa/w9/r-rp/findings.json`, 7 findings).

### 给主人的摘要

1. 审查找到 13 个问题，全部复现确认，13 个都修好了（5 个重要，8 个次要），没有驳回的。
2. 英文模式下「加到日历」存下来的日历条目原来是中文，现在标题、地点、费用和提醒都是英文；地点不再重复写两遍「San Francisco」。
3. 「这周免费」和地点卡的「近 7 天免费」不再列出今天已经结束的时段（例如下午 3 点还显示早上 9–10 点的茶园免费时段）。
4. 每日三件小事：做完一件后改「和谁去」再刷新页面，原来会把完成标记挪到别的任务上、同一件事还能再领一次金币；现在当天一旦领过奖励，选题就不再变。
5. 区域模式（district）又和以前一样了：「户外」只按活动分类判断；「金门公园 · 西边」不再包含 Ocean View 和 Ingleside。
6. 自己又查出一个小问题并修好：网站词典里没有的中文费用说明，不会再写进英文日历。检查：tsc 0；eslint 0 错误；opus-bay 测试没有失败的。这次没有在浏览器里实际试玩，用的是 node 测试。没有阻碍上线到 main 的问题。

### Verdicts

| id | sev | verdict | evidence / fix |
|---|---|---|---|
| R-RC-1 | major | fixed | Reproduced red in `tests/opus-bay-w9-r-review.test.ts` ("the same three in the same slots": 10/9 no profile = event · ride · sunset, after paying the ride, 带娃 and a reload = ride · sunset · new). Fix: `realsf/prefs.ts` `dailyProfilePin` / `pinDailyProfile` (own key `opus-bay:daily-pick:v1`, memory only with `?save=off`); `realsf/daily.ts` keeps the recorded profile of the day once any `daily:<date>:<n>` is paid. The test now finds an October day whose pick changes with a profile (10/9 stopped changing once R-RC-5 was fixed) and asserts the same three in the same slots, only the ride done, and that the next day follows the new profile. |
| R-RC-2 | major | fixed | Same defect as R-RP-2. Red: `SUMMARY:芮妮·弗莱明演唱施特劳斯` with `setLocale('en')`. `realsf/ics.ts` `eventIcs(…, locale)`: the title and venue go through `catalogText`, the cost through `publicText(…, locale)`, and the reminder reads "Tomorrow: …". `offerIcs` gives an English title, who, requirement and reminder for an English reader. `addToCalendar` / `addEventToCalendar` take the locale from the event card, the strip and the place card. Test: Fleming, Richmond LEGO and African Arts in English have no Han in SUMMARY, LOCATION, the reminder or the description after its bilingual first line. |
| R-RP-2 | major | fixed | See R-RC-2 (the player lens captured the same .ics). |
| R-RC-3 | major | fixed | Red: `isOutdoor(HSB)` was true in district mode. `data/catalog.ts`: `isOutdoor` / `vibeFit` / `vibeCloseness` / `kindOf` / `relaxNote` take `city` (default true), and `recommendEvents` passes `cityFirst`. District mode reads 户外 as `category === 'outdoors'` again. The "fitting picks first" sort and the counted region note (`counts.inRegion`) now apply in city mode only, so district results and notes match pre-W9-R4. City mode is unchanged (`w9-r-recommend` 6/6). |
| R-RC-4 | minor | fixed | Same defect as R-RP-1. |
| R-RP-1 | major | fixed | Red: at 15:00 on 10/2, today's chip still listed `japanese-tea-garden-free-hour` (9:00–10:00). `realsf/freeWeek.ts` `notOver(item, now)`; `freeWeek(…, now)` and `freeDaysAt(…, now)` drop today's items whose end is ≤ the Bay minute (later days stay whole; an item without hours is all day). `FreeWeekStrip` / `FreeDays` pass `bayParts(bayNow())`. Test: at 8:00 the tea garden is listed, at 15:00 nothing listed has ended; the zoo card on 10/7 shows the zoo at 11:00 and not at 18:30. |
| R-RP-3 | major | fixed | Red: `sfAreaAt(37.7142, -122.4640)` (Ocean View) returned `sf-west`. Fix: the west covers lng < -122.447 north of 37.734 (Sloat Blvd), and south of Sloat only west of -122.475 (19th Ave: the zoo, Lake Merced, SF State). Test: Ocean View and Ingleside → south; the park, the Sunset, the zoo and Lake Merced → west; `eventArea(sfpl-ocean-view-stem-oct8-2026)` with the world's venue hooks → `sf-south`. |
| R-RC-5 | minor | fixed | Confirmed: on 10/9, kids profile = ride · sunset · new (Fleet Week has cost 'mixed'). `eventFitsProfile` kids now also accepts 'mixed' when the costLabel says 免费 (free general areas), still only open-air, by day and never 18+. The test also sweeps the whole catalog. |
| R-RC-6 | minor | fixed | Confirmed by reading `FreeWeekStrip.tsx` (the 今天 tab lists today only). For today the line keeps its wording (「今天还有 N 个…」). For another day it links the BAYLINK calendar on that day: `calendarUrl(locale, { date })`, text 「在 BAYLINK 日历里看这天」. |
| R-RP-4 | minor | fixed | Confirmed in `ui/WeekPanel.tsx` (the strip was rendered above `<ul className="ob-board">` for 免费就好). It now goes below the flyers for every answer. The 免费就好 title says it covers the whole city: 「免费就好 · 全城这几天的免费福利和活动」. The strip still ignores the third question (it is the city's list; flyers are filtered). |
| R-RP-5 | minor | fixed | Confirmed from the CSS (`min-height: 32px`, no min-width; the links had no hit area). Under `(pointer: coarse)`, `.ob-free-cal` gets `min-width: 44px`; with the existing `::before` it is 44 tall. The source links get `display: inline-block; padding: 13px 4px; margin: -13px 0` (a 44 px tall hit area; the layout does not change). Not re-measured in a browser. |
| R-RP-6 | minor | fixed | `icsLocation(venue, city)` adds the city only when the venue does not already name it (Fleming: one "San Francisco"). Tested. |
| R-RP-7 | minor | fixed | Confirmed: the footer's date is the card's `verifiedAt` and the primary source is Wikipedia (`landmarks.ts`). The de Young goes back to '2026-09-29' and the Legion to `CARD_VERIFIED_AT`. The comments say only the FAMSF Free Saturdays pages were read 2026-10-02. The `w9-r-cards` test now asserts the date is not 2026-10-02. |

Refuted: none. Confirmed-not-fixed: none.

### Own pass (`git log origin/opus-bay --grep "W9-R[0-9:-]"`: R1 … R8)

- **Own-1 (fixed, minor)**: a catalog cost line the site dictionary does not know falls back to the Chinese filter (`publicText` en → `publicZh`). That Chinese line would land in an English .ics, so `eventIcs` leaves it out in English (the official link stays).
- District: `?world=district` reaches none of the changed UI. WeekPanel's strip is `city &&`, and the region options and 带长辈 are city only. The catalog changes are now gated by `cityFirst`. The hero / district tests are in the suite run below.
- Size: no new module. `ics.ts` (a lazy chunk) now imports `../i18n`, which is already in the main bundle. `FreeWeekStrip` (lazy) imports `calendarUrl` from `data/links` (already in the bundle).
- Voice: no BAYBAY line changed. Only UI strings changed (the strip's more line and the 免费就好 title). There is nothing to add to new-lines.md.
- Not re-done (in the lane's not_done, unchanged): the link-patrol script, the manual 现实中怎么去 for the T1 cards without one, and de Young / Legion in 这周免费 (needs the site's offer).

### Checks

- `npx tsc -p tsconfig.app.json --noEmit`: 0, on 8304fc44 (own-1 only adds a local const).
- `npx eslint .`: 0 errors, 53 warnings (the same 53 as the lane's 04:42 run). own-1's two files: 0.
- Lane and neighbour tests: `w9-r-review` 8/8, `w9-r-recommend`, `w9-r-free`, `w9-r-today`, `w9-r-cards`, `flow-data` and `w5-today`: all green.
- Whole opus-bay suite, `tests/opus-bay-*.test.ts`, on 8304fc44 under the shared load (06:12 → 06:31): 1637 subtests passed and none failed before the 1100 s `timeout` stopped it in the w7 files. The ten file-level ✖ are the processes the timeout killed; every subtest they printed passed. The w7-r … w9 files (107) were then re-run alone (06:32 →). **535 tests, 535 pass, 0 fail** (06:32 → 06:41). Together with the first run, every opus-bay file passed with no failing test.

### Open items

1. Not played in a browser this pass: the strip's place under the flyers, the 44 px targets and an English .ics download were checked only by node tests and code reading. W9-Z or the next lane-R session should open `?world=city&save=off&date=2026-10-02T15:00&lang=en` once.
2. The strip still lists the whole city under a part-of-SF answer (R-RP-4's second half). Its title now says 全城. A per-area filter would need offer points → SF areas.
3. The lane's own not_done list and its three site Requests (de Young / Legion offers, the Chinatown Halloween Festival in the catalog, First Thursdays' link and working notes at the source).

### Blocking the go-live to main

Nothing from lane R. R-RC-1, which lets a coin reward be paid twice, was the one that mattered for the go-live, and it is fixed.
