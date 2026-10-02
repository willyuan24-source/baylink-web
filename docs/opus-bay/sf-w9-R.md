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
