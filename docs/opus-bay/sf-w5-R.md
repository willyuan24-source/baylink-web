# Wave 5 · lane R · Real San Francisco — report

Lane R owns `src/opus-bay/realsf/**`, `data/{catalog,links}.ts`, `ui/{EventCard,EventCardBody,WeekPanel}.tsx`,
`game/qa.ts` (plan `sf-w5-plan.md` §3.3, §4.13; lead note `sf-w5-lead.md`). Worktree `C:/Users/willy/wt/w5-r`, dev port 5510,
scratch `C:/Users/willy/opus-qa/w5/w5-r/`, QA images `docs/opus-bay/qa/w5/R/`.

## Part a

Written 2026-09-28 (PDT). Tasks: W5-R1, W5-R2, W5-R3 (plan §4.13).

### 给主人的摘要

1. 旧金山模式的天色现在跟着真实的日出日落走：例如 12 月 21 日下午 5:10 还是金色，5:30 就入夜；街区模式完全不变。
2. 这周 BAYLINK 上的旧金山活动会出现在真实场地：10/2–4 金门公园蓝草音乐节有小舞台、彩旗、野餐垫、听众和班卓琴声；10/3 芳草地花园有小舞台和摊位；10/4 卡斯特罗街 18 街口搭起节日拱门（车照样从下面过）。走近按 E 看活动卡；活动卡和"这周去哪"传单上都有"带我去"。
3. 第一次走到活动现场会拿到活动纪念章 +15 金币；BAYBAY 每天提醒一次今天的日落时间，走近活动时说一句"出发前查官网确认哦"。
4. 海滩篝火只在 3–10 月、晚上 9:30 前亮（开关已给 L 线）；月相、每月雾气也算好了。所有日期、时间、地点都在 9/28 查过官网、美国海军天文台和 OpenStreetMap。
5. 远处能看到活动的珊瑚色小旗；走近时 BAYBAY 会说"今天金门公园有免费的蓝草音乐节，9:00–19:00，出发前查官网确认哦。"（中途发现的彩旗着色器问题，总负责已修好。）

### What was built

**W5-R1 · the real sun, the fire-ring season, the §4.3 hooks** (pushed first: `ac1a5b1`)

- `game/qa.ts` (main graph, ≈ 1 KB as plan D16 allows): NOAA's solar calculator (`solarAt`, `sunCrossing`, `sunDay`
  cached per Bay date), `realSunBand`, `fixedHourBand`, and `bayTimeOfDay(now = bayNow(), world = store's worldMode)`:
  **city mode** follows the real sun — night until civil dawn · morning to sunrise + 3 h · day to the afternoon 6° mark ·
  golden to civil dusk; **district mode** keeps its 6/10/16/19 bands (unchanged). Both writers of `store.timeOfDay`
  (Overlay `useTimeOfDay`, flow `offerRealTime`) read it; Settings' fixed time, `?time=` and the first-visit golden rule
  still win (they are applied by the callers). The clock is `bayNow()`, so `?date=` moves it in DEV / QA builds.
- `realsf/sun.ts`: `sunBandAt(date)`, `sunTimes(date)` (dawn / sunrise / golden / sunset / dusk as Dates),
  `sunPosition(date)` (elevation, azimuth — for D's sundial and V's light), `bayHm`, `sunsetLine` (今天旧金山日落 18:57，找个坡坐下来看吧。).
- `realsf/seasons.ts`: `isFireRingLit(date)` (1 Mar – 31 Oct and 06:00 – 21:30), `fireRingSeason(date)`, `FIRE_RINGS`
  (source row), `karlMonthFactor(date)` + `KARL_BY_MONTH` (July 1.0 … October 0.35; "usually"), `FIRE_SEASON_LAST_DAY`.
- `realsf/moon.ts`: `moonPhase(date)` → `{ phase, age, illumination, waxing, name }`, `MOON_LABELS`. The mean synodic month
  of the plan drifted 1.1 days at a quarter, so it uses the elongation with Meeus' seven largest terms (a dozen lines).

**W5-R2 · the venue table, events in their window, the catalog hooks, the week board** (`26ac903` + this part's commit)

- `realsf/eventVenues.ts`: 12 venues (Hellman Hollow, Yerba Buena Gardens, Castro St at 18th, Marina Green, Jefferson &
  Powell, Fisherman's Wharf, Ferry Building, UCSF Koret Quad, Main Library, Roxie, the Sunnydale Hub, Family Connections
  Portola), each with its OSM source + check date, the catalog ids it holds, a kit kind, `kitAt` (spot + facing chosen by
  a probe over the published city: open ground, off the car lanes, clear of the streamed trees / lamps / benches),
  `downtown` (the Ferry Building: pennant + crowd only), and organiser hours where the catalog label has none (HSB,
  Fleet Week's air-show days). `eventVenue(id)`, `venueForEvent(e)` (listed id first, else the SF venue text; unmapped →
  no pin), `venueLatLng`, `SOUVENIR_IDS` (append-only), `VENUE_SAY` / `EVENT_SAY` (short names for lines).
- `realsf/events.ts`: `worldEvent(e)` (SF + mapped + never adult-only / professional), `labelHours`, `eventHours`,
  `eventWindow`, `activeEventsAt(date)`, `weekEvents(date, days)`.
- `data/catalog.ts`: every "now" default is `bayNow()` (`todayInBay`, `nextShowing`, `bayHour`); `setEventVenueHooks`
  (city mode only, from `realsf/index.ts`) → `eventSpot(e)` / `goToEvent(e)`; `eventsNear` uses an event's own location,
  else its mapped venue (so "附近这周" on SF place cards finally lists events); `recommendEvents({ cityFirst })` (default:
  city mode) ranks San Francisco first (+2.5 with a venue in the world, +1.5 without) unless the player asked for another
  region. District mode registers nothing: its cards and board are unchanged.
- `ui/WeekPanel.tsx` + `ui/event-go.css`: a teal 带我去 chip under the date block of every flyer with a venue in the world.
- `ui/EventCardBody.tsx`: 带我去 in the date row when the event is upcoming and mapped.
- 带我去 = `realsf/index.ts goToVenue` → lane N's `goTo({ placeId } | { point, name }, { source: 'realsf:event' })`
  (the planner's best way); only if goTo answers `unknown` / `no-way`: fly (pelican unlocked) or walk with BAYBAY to
  `event:<id>`, which `registerPrefixResolver('event:')` resolves to the venue (waypoint, navigateTo).

**W5-R3 · events in the world during their real window** (this part's commit)

- `realsf/presence.ts` (a 2 Hz frame system): on window open / close emits `realsf` `window-open` / `window-close`;
  - the pennant: `registerFlagSource('realsf')` (coral `#e8705a`, glyph Music / Sparkles / ShoppingBag / CalendarDays,
    priority 2 near the player or the waypoint, far 1,600 u) — lane N's layer, no draw call of mine;
  - the crowd: `addCrowdSpots('event:<id>', …, { face, count })` (lane T; 18 music, 14 festival / parade, 12 fair);
  - the kit: the nearest 2 open events within 450 u (never `downtown`), built once the ground under it has streamed;
  - the loop: `realsf-banjo` / `realsf-brass` / `realsf-market` gains by the distance to the nearest open event of the kind;
  - the E prompt 看看活动 (source `event`, `act` → the EventCard) in front of the kit;
  - at the event (≤ 25 u) the first time: `reward` `event:<id>` 15 coins with its stamp, `find` souvenir, `realsf`
    `event-enter` (and `event-leave` beyond 60 u); `registerRewardIds('event', SOUVENIR_IDS)` for E's ledger.
- `realsf/eventKit.ts`: `buildKitGeometry(kind, at, ground)` — music (stage, roof with bulbs, speakers, mic stands, a toy
  upright bass, bunting to two poles, 7 picnic blankets), fair (3 stall tents + bunting), festival (low stage with drums,
  2 tents, bunting), parade (a bunting arch with balloon bunches), street (a festival arch over a narrow street: poles at
  the curbs, banner and bunting ≥ 4 u over the roadway so traffic passes under, balloons, pennants on the sidewalk side —
  the Castro fair), board (a sandwich board with blank posters). One merged
  geometry per kit on its own plain-Mesh toy material (`makeKitMaterial`: `patchToyShader`, no sway, program key
  `ob-toy-dyn` → no new program), warmed through `registerWarmup('r-event-kit', meshWarmup(…))`. `kitCrowd`, `kitPrompt`,
  `KIT_FOOTPRINT`, `KIT_TRIS_MAX` 1,500.
- `realsf/eventSounds.ts`: three original synthesized loops through `audio/hooks.ts` `registerLoop` (a banjo forward
  roll over G · C · D with an upright-bass root; a small brass march with tuba and snare; a marimba over a hand drum),
  `hearGain(d)` (full ≤ 30 u, silent ≥ 150 u).
- `realsf/lines.ts` + `realsf/index.ts`: one scheduler for BAYBAY's real-SF lines, at most once per key per Bay day
  (`opus-bay:realsf:v1`), gated like her city lines (dialogue, cinematics, travel, panels, photo mode, quiet start,
  bubbles), 20 s apart: the souvenir line, the event line (今天金门公园有免费的蓝草音乐节，9:00–19:00，出发前查官网确认哦。
  — hours from the window), the sunset line (2.5 h before sunset), and on 31 October near the fire rings
  海滩篝火季到 10 月底，11 月起就不能生火啦。
- DEV: `window.__opusRealSF.presence()` → `{ open, kits: [{ id, tris }], crowds, near }`.

### Evidence

- **Checks** (on the rebased head before each push): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors
  (43 old warnings outside `src/opus-bay`) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts`:
  970 / 970 at `26ac903`; **1089 / 1089** on the W5-R2 UI + W5-R3 commits rebased on `9238198` (tsc 0, eslint 0 errors).
- **New tests** `tests/opus-bay-w5-sun.test.ts` (8) and `tests/opus-bay-w5-events.test.ts` (10): the 14-date USNO table
  (every dawn, sunrise, sunset, dusk within 1 min), the bands at both DST edges and both solstices, district unchanged,
  the `?date=` path (`__setBayNowForTests`), the fire-ring edges (Oct 31 21:29 lit / 21:30 not, Mar 1 05:59 / 06:00),
  16 USNO moon phases within 6 h, Karl; the venue table, mapping (unmapped → no pin; 21+, professional, East Bay never),
  the windows (HSB Fri from 11, Sat from 9, ends 19; Castro 11–18; Fleet Week only Oct 9–11 12–16), `?date=2026-10-03T10:30`
  week + YBG's "附近这周" lists the African Arts Festival, `2026-11-05` shows nothing, city-first ranking (and the East Bay
  still wins when asked), every venue / kit / crowd spot standable and on ferry-gate's walking network in the published
  city, kits ≥ 75 % on open ground and ≤ 25 % on a road (the Castro arch spans its street on purpose, see Decisions), kits ≤ 1.5k triangles
  (music 520 in game, festival 468, street arch 364), the arch ≥ 4 u over the roadway and 20 u+ from every transit line, lines ≤ 45 zh characters, the loops registered and undone, and no runtime
  fetch in `realsf/` leaves the site.
- **Real game** (dev server 5510, headless Chrome `--force_high_performance_gpu`, every image read):
  - `?date=2026-10-03T10:30` Hellman Hollow: `presence()` = HSB open, kit 520 tris, crowd, near; the band `day`; the stage,
    bunting, blankets and 18 standers facing the stage (desktop `r3-hsb-2026-10-03-desktop.jpg`, phone 390 × 844 dpr 3
    `r3-hsb-2026-10-03-phone.jpg`); the prompt "E 看看活动 · 蓝草音乐节" (`r3-hsb-prompt-desktop.jpg`) opens the EventCard with
    带我去 (phone `r2-eventcard-go-phone.jpg`); standing at the stage paid the souvenir: the ledger read
    `{ c: 15, g: { souvenir: 'AQ' } }`, the day memory `souvenir-hardly-strictly-bluegrass-2026`.
  - After the rebase on the lead's flag fix (`4fb3e6e`), walking to `event:hardly-strictly-bluegrass-2026` from ≈ 120 u
    east: the flag picks read `target`, `extra:realsf:hardly-strictly-bluegrass-2026`, then the T1 flags; the coral
    pennant stands over Hellman Hollow and BAYBAY says the event line 今天金门公园有免费的蓝草音乐节，9:00–19:00，出发前查官网确认哦。
    (`r3-hsb-pennant-line-desktop.jpg`).
  - `?date=2026-10-03T12:00` YBG: African Arts Festival + HSB open, festival kit 468 tris (`r3-ybg-2026-10-03-desktop.jpg`).
  - `?date=2026-10-04T13:00` Castro: Litquake, the Castro fair and HSB open; the street arch (364 tris) over Castro St at
    18th, the rainbow crosswalks under it, a toy car driving through below the banner, the prompt 看看活动 · 街区节
    (`r3-castro-2026-10-04-desktop.jpg`).
  - Calls / triangles read in those views (desktop high, not a gate run): Hellman Hollow 69 / 234.5k, YBG 80 / 250.6k,
    Castro (the first, tent version in front of the Castro Theatre) 90 / 331.6k; programs 57 / 75 / 57 (the 75 at YBG is
    the downtown edge, not the kit: the kit's program is TOY_DYN's).
  - The week board on `?date=2026-10-01T15:00` (friends · any · any): HSB, the Castro fair, the African Arts Festival,
    Litquake, Quinteto Latino — every flyer with 带我去 (`r2-week-board-desktop.jpg`, `r2-week-board-phone.jpg`).
  - The real sun at Marina Green on `?date=2026-12-21`: 17:10 `golden`, 17:30 `night`
    (`r1-sun-2026-12-21-1710.jpg`, `r1-sun-2026-12-21-1730.jpg`).
- **Facts checked on the web, 2026-09-28** (each also in the code next to its row):
  - Sun: US Naval Observatory one-day API (https://aa.usno.navy.mil/api/rstt/oneday, 37.7749,-122.4194) on 14 dates —
    the plan's examples were 1–2 min early (Sep 28 sunset is 18:57, Dec 21 dusk 17:24, Jun 27 2027 sunset 20:36);
    sunrise-sunset.org is ≈ 1.5 min off USNO at the horizon (its twilight matches), so USNO is the reference.
  - Moon: USNO phases (https://aa.usno.navy.mil/api/moon/phases/date?date=2026-09-01&nump=16): new moon 2026-10-10 15:50 UT,
    full moon 2026-10-26 04:12 UT (= the evening of Oct 25 in SF).
  - Fire rings: NPS "Ocean Beach Fire Program" (https://www.nps.gov/articles/ocean-beach-fire-program.htm): March 1 –
    October 31, 6:00 am – 9:30 pm, 16 rings, water only.
  - Karl: https://www.sfbayweather.com/learn/when-does-sf-fog-peak (July foggiest; September – October clearest).
  - Hardly Strictly: https://hardlystrictlybluegrass.com/info-faq-2026/ (Oct 2–4; gates 11:00 Fri, 9:00 Sat–Sun;
    performances end 19:00; Hellman Hollow, Lindley & Marx meadows; free; no bikes / scooters / skateboards inside).
  - Castro Street Fair: https://www.castrostreetfair.org/ (Sun Oct 4, 11:00 – 18:00; Market, Castro and 18th Streets).
  - Fleet Week: https://fleetweeksf.org/air-show/ (air show Oct 9–11, 12:00 – 16:00, between the Golden Gate Bridge and
    Alcatraz; Marina Green Festival Center; free general admission).
  - Venue coordinates: OpenStreetMap (Nominatim / Overpass) — Hellman Hollow way 417407488, Castro Street & 18th Street
    node 6376930275 (the arch stands ≈ 20 m south of it; Jane Warner Plaza way 188964530 and Harvey Milk Plaza way
    225526801 were checked for the first spot), Main Library way 24446086, Roxie node 2042397283, 1530 Sunnydale Ave way
    254299137, 2565 San Bruno Ave way 254299130, Jefferson & Powell node 6371296695; the rest from
    `public/opus-bay/sf/v1/places.json` (OSM ids in the rows).

### Decisions

1. **The real sun is city-only.** The brief says district mode never changes, and `tests/opus-bay-flow-brain` pins the
   district's 16–19 golden band; the district keeps it. Plan D7's "the sky follows SF's real sun by default" holds in
   the city, where the owner plays.
2. **The sun maths sits in `game/qa.ts`, not `realsf/sun.ts`.** `bayTimeOfDay` is in the main graph (Overlay, flow, even
   the title's route chunk reads `qa.ts`) and the contracts test forbids `realsf/` there; the ≈ 1 KB of maths is what D16
   allows. `realsf/sun.ts` is the lanes' door (no extra cost: it re-uses `qa.ts`).
3. **The moon is better than the plan's mean month** (elongation + Meeus' 7 terms, within 6 h of USNO; the mean month was
   1.1 days off at the Dec 17 quarter).
4. **Venue points from OSM, not the planner's table**, where they differ: the Main Library board stands beside the
   building (its doors face Larkin St, a car street in the toy city), Roxie / Portola boards on the sidewalk, Sunnydale
   at the OSM address point (≈ 26 u from the planner's). HSB's point is between Hellman Hollow's centroid and the
   Lindley / Marx meadows; the stage faces its meadow.
5. **Organiser hours in the venue table** (HSB per day; Fleet Week only its air-show days at Marina Green): the catalog's
   labels have none for these, and 08:00–21:00 would have shown a stage at 8 am on a 9 am / 11 am gate day. The dates
   still come from the catalog.
6. **The Castro fair is an arch over Castro St at 18th** (`kit: 'street'`, no standers of its own). The first version put
   three tents on Castro St at Market; the probe found no open off-road ground there, and Castro & Market carries the
   F-line terminal and the sightseeing loop. The arch design came from an accidental duplicate run of this lane in the
   same worktree (≈ 03:00–03:22 PDT; stopped by the lead): I kept it, moved its pole pennants off the roadway (its own
   test caught them 2.2 u over the road) and checked it in the game — cars pass under, the city's walkers fill the street.
7. **Kits have no walk blockers** (the player can walk through a tent; nothing to get stuck on — the owner's F2 point).
8. **带我去 goes through N's `goTo`** (landed today) with the old fly / walk as the fallback only for `unknown` / `no-way`.
9. **The cut rule** (HSB and Castro presence green by Oct 1 18:00): green on Sep 28 — nothing is cut.

### Not done (part a) / known gaps

- The loops were not heard (headless); their registration, gains and teardown are tested, the recipes are unheard by a
  person — first ear check on the owner's phone build.
- "这周去哪" in city mode still walks you to the district's weekly board after the three questions (flow.ts, C's:
  Requests 2); the flyers themselves are right.
- The map's 这周 filter (N's map files: Requests 4). The Presidio Parade Lawn row is not in the table (no Presidio event in
  the catalog now; add it with an OSM check when one appears). Fisherman's Wharf (Oct 24) and Marina Green (Oct 9–11) kits
  touch a road edge (21 % / 16 %, under the test's 25 %).
- R4–R8 (the 今天 tab, 今日三件小事, Fleet Week jets, the shoulds) are part b.

### Requests

1. ~~**The flag shader**~~ (`e276fe0` broke every city flag: an inner `float col` shadowed the flag colour) — **done by
   the lead in `4fb3e6e`**; after the rebase the event pennant stands (see Evidence).
2. **C · `game/flow.ts`**: (a) `showWeekResults`: in city mode open the board at once —
   `if (!inWeekMode || !board || dist(playerPos(), board) < 9 || game.get().worldMode === 'city') {` (the district's
   weekly board is kilometres away in the city); (b) `offerRealTime(now = bayNow())`, `marketDay(day = todayInBay())` is
   already Bay-clock through `todayInBay`, `marketOpenNow(now = bayNow())`, and `recommendEvents(…, { now: bayNow() })`
   so `?date=` moves them too (import from `./bayNow`); (c) `ui/PlaceCard.tsx` / `ui/PoiCardBody.tsx`: pass `bayNow()`
   instead of `new Date()` to `eventsNear` (the evening rule then follows `?date=`).
3. **V · `world/clock.ts`**: default `now` to `bayNow()` in `bayClock` / `isMarketDay` / `isMarketOpen` (the Ferry clock
   hands and the market stalls then follow `?date=` like everything else). **V · gate spots**: Hellman Hollow / Castro /
   Marina Green need `&date=2026-10-03T10:30` / `2026-10-04T13:00` / `2026-10-09T12:40` for the kits to stand.
4. **N**: the map's 这周 filter (DOM badges) can read `realsf/events.ts weekEvents(bayNow(), 7)` (venue `x`, `z`, event id);
   R's flag source key is `realsf`.
5. **T** (could, later): a street-closure hook for event windows, e.g. `closeStreetBox(key, poly | null)`, would let the
   Castro fair put stalls and a crowd on Castro St (today it is an arch cars drive under) and the parade close its start.
6. ~~**L**: wire the fire rings' glow to `isFireRingLit`~~ — done by lane L in `561e24d` (W5-L2).
7. **E**: the souvenirs are `event:<catalog id>` with the id list `SOUVENIR_IDS` (append-only, in `realsf/eventVenues.ts`);
   `EVENT_SAY[id]` has a short bilingual name for the notebook's 印章 page.
8. **Site editors (via the lead)**: add `location { lat, lng }` to SF events and November SF events (plan D10).

## Part b

Written 2026-09-28 (PDT). Tasks: W5-R4 (the 今天 tab), W5-R5 (今日三件小事), W5-R6 (Fleet Week jets) (plan §4.13, §3.3 items
5–6). Pushed `d2b7bce` (W5-R4 / W5-R5) and `5eee52e` (W5-R6) — the cut rule for the jets (in the owner's build by Wed
Oct 7 20:00 PT) is met on the code side.

### 给主人的摘要

1. 旅行本最前面多了"今天"页：旧金山现在几点、日出日落、月相、这个月雾多不多；下一个目标；今日三件小事；今天旧金山有什么（活动、渡轮大厦农夫市集、今天哪里免费、海滩篝火、温室灯光秀，过了时间的自动隐藏）；还有这周的旧金山活动。每一行都有"带我去"和官网来源、查证日期。问 BAYBAY 菜单里也有"今天旧金山有什么？"。
2. 今日三件小事：每天按真实的旧金山给三件小事（去今天的活动、在真实日落时到海边或山顶、开集时在市集尝一口、坐一站车、去今天免费的地方、看海滩篝火……），每件 +10 金币，三件都做完再 +20；没做也不会少什么，明天可能不一样。
3. 舰队周飞行表演：10 月 9–11 日中午 12 点到下午 4 点（官网时间），6 架蓝金色玩具喷气机（手机上 4 架）贴着水面从码头绿地前编队飞过，拉着白烟、带轰鸣声；当天早上 BAYBAY 会提醒并标出去码头绿地的路；在码头绿地拍到飞机编队可得舰队周纪念章 +15 金币；骑鹈鹕飞近表演区会被温柔地带回来。
4. 所有日期、时间都在 9/28 查过官网（金门公园花园、Foodwise 市集、舰队周官网）。右上角小药丸点一下直接打开"今天"，需要 F 线改一行（已写在需求里）。

### What was built

**W5-R4 · 今天 · SF Today** (`d2b7bce`)

- `realsf/TodayTab.tsx` + `realsf/realsf.css` (a lazy chunk; `registerJournalTab({ id: 'today', order: 5, label 今天 / Today,
  count 'n/3' })` from `realsf/index.ts`, city mode only; the first tab in the row, before 明信片):
  - the Bay clock card: `HH:mm`, the date · 旧金山时间; 日出 / 日落 (realsf/sun.ts); 约<moon phase> (realsf/moon.ts); the sun
    band; Karl's usual month (通常晴朗少雾 …, realsf/seasons.ts `karlMonthFactor`); the sources line (NOAA / USNO, moon, fog,
    查证于 2026-09-28);
  - **下一个目标**: the first open explorer goal of the city list (the pelican first) with 带我去 (the nearest goal target);
  - **今日三件小事** (below): each task with its real window (`11:00 起`, `现在开放`, `今天已过`), done ticks, 带我去 (the sunset
    task goes to the nearest sunset spot), the rule line (+10 each, +20 for all three, nothing lost);
  - **今天在旧金山**: the world events still on today (catalog title, venue, hours, cost, 以官网为准, the event's own source
    link and check date; the title opens the EventCard), then the hand rows of `realsf/todayRows.ts` whose hours are not
    over (past rows are hidden, later ones say when);
  - **这周**: the San Francisco catalog events of the next 7 days (never 21+ or professional), 带我去 when the venue is in the
    world, else 看看 (the EventCard); a mapped event shows its window at the venue (Fleet Week → 10月9日 · 码头绿地 ·
    12:00–16:00, not the catalog's first programme); the footer 活动来自 BAYLINK 编辑整理，出发前以官网为准 · 这周去哪.
  - Every 带我去 is lane N's `goTo(…, { source: 'realsf:today' })` (events through the catalog hook → `goToVenue`).
- `realsf/todayRows.ts`: `rowsOn(dateKey, sunsetMin)` → the market, free places, fire rings, light show rows
  (`{ id, kind, place, what, hours, note (…以官网为准), placeId?, at, source { label, url, verifiedAt } }`); `freePlacesOn`,
  `marketHours`, `isMarketDayKey`, `botanicalLastEntry`, `botanicalFreeAllDay`, `conservatoryFree`, `teaGardenLastEntry`,
  `fireSeasonKey`, `rowState(hours, nowMin)` ('open' | 'later' | 'over'), `atMinute`, `hm`, `PLACES`.
- **问 BAYBAY → 今天旧金山有什么？** (`registerAskItem`, order 40, after BAYBAY's own choices) opens the Journal on 今天 — one tap
  on phones until the pill does it (Requests 1–2).
- `realsf/todayLine.ts` `todayLine(now?, catalog?)`: one SF Today line ≤ 45 zh — today's event in the world
  (今天金门公园有蓝草音乐节，旅行本「今天」里有～), else the sunset (今天旧金山日落 18:40，旅行本「今天」里有三件小事～), else the
  daily three. Lane C's welcome back gets it (`onWelcome('returning')`); when this chunk loads after the welcome (≤ 60 s),
  R's scheduler says it once. Lane E can use it for the notebook header (plan §3.5).

**W5-R5 · 今日三件小事** (`d2b7bce`)

- `realsf/daily.ts`: `daySignals(dateKey, catalog)` (date-level facts only: the day's world events, market hours, free
  places, fire season) → `dailyThree(dateKey, signals)`: a seeded shuffle (mulberry32 over the Bay date) of the kinds the
  day really offers — `event` (always first when there is one), `sunset`, `market`, `ride`, `free`, `fire`, `new` — three
  different kinds, at most two tied to a time (event / sunset / market), stable all day. Each task: `source`
  `daily:<date>:1..3`, title, hint (hours are the real ones), `window`, `go`.
- `initDaily()` (city mode): pays through lane E's ledger by the real signals — `event` at the venue in its window
  (presence's `realsf` event-enter or ≤ 25 u), `sunset` at a sunset spot (Ocean Beach, Twin Peaks, Baker Beach, Lands End,
  Marina Green) while the **real** sun is in its golden band (Settings' fixed time and the first visit's golden sky never
  count), `market` a 尝一口 at the Ferry Building market while it is open, `ride` one real stop on any line, `free` at the
  place (any time in the game; the hint says the real free hours), `fire` at the rings while they may burn, `new` a first
  arrival. +10 each (`reward` `daily:<date>:n`), +20 with the third (`daily:<date>:all`) → `play.d { d, m }`; a toast
  今日小事 ✓ 看日落 · 2/3; BAYBAY's once-a-day line after 75 s of play (今日三件小事：…，旅行本里有～) and 今天的三件小事都做完啦！明天可能不一样哦～.
  Skipping a day loses nothing (no streak). `activeDaily()` for the tab; DEV `__opusRealSF.daily()` / `.complete(kind)`.

**W5-R6 · Fleet Week over the Bay** (`5eee52e`)

- `realsf/jets.ts`: the window is the Marina Green row of the venue table (Oct 9–11, 12:00–16:00; the practice Thursday is
  not shown): `jetWindows()`, `jetWindowOn(date)`, `jetsUp(date)`.
- The loop: `AIR_BOX` (the show frame 600 m off Marina Green's seawall), `LOOP_POINTS` → `pathTable()` (a closed centripetal
  Catmull-Rom sampled every 2 u, 1,121 u, 37 s a lap at 30 u/s): the low pass ≈ 45 u off the seawall at 7–12 u over the
  water, a wingover off Aquatic Park, the far line and a banked turn home off Crissy Field. Each jet banks by its felt lift
  (the path's acceleration + gravity, smoothed), wingmen bank with the lead; the lead's place is a function of the Bay
  clock (`leadArc(ms)`), so everyone sees the same pass at the same minute.
- The look: six toy jets (`FORMATION` delta; four in a diamond at quality mid / low = phones), navy fuselage, gold swept
  wings and tailplanes, twin fins, a cream belly stripe, no insignia or lettering (`buildJetGeometry`, 224 triangles,
  ×1.9 toy scale ≈ 12.5 u long); a white tapering smoke ribbon behind each (`writeSmoke`, 50 triangles a jet, facing the
  camera). **2 draw calls, 1,644 triangles at high (1,096 on phones)**: one InstancedMesh on `makeJetMaterial()` (its own
  instance, program key `ob-toy-inst` = TOY_INST's: no new program) + one Mesh on `makeSmokeMaterial()` (own transparent
  basic material: the one new program), both warmed (`r-jets`, `r-jets-smoke`); fixed bounding spheres; built only in the
  window within 1,500 u of the box, dropped after.
- The roar: `registerLoop('realsf-jets')` — a brown rumble under a pink whoosh whose band rises as they come (original
  synthesis), gain full ≤ 120 u, silent ≥ 600 u; `duck('music', 0.45, 800)` while it is loud.
- BAYBAY: `今天中午到下午四点，湾上有飞行表演，去码头绿地看！` (before noon; `飞行表演正在湾上，四点结束，去码头绿地看！` during) once on a
  show day when the player is > 300 u from Marina Green, then the waypoint (`flow.mapTarget` = the Marina Green spot,
  named 飞行表演 · 码头绿地, only when the player is free: no trip, tour or target); near the show
  `飞机编队来啦！打开拍照，把它们拍下来吧～`.
- The photo subject `realsf:jets-watch` at Marina Green's seawall (E 看看飞行表演 before noon → the Fleet Week EventCard;
  拍飞机编队 during → photo mode, the camera turned to where the formation will be in 1.8 s). Any shutter with a jet in the
  frame within 520 u pays once: `reward` `event:fleet-week-2026-jets` (15 coins, stamp; the id appended to `SOUVENIR_IDS`,
  `EVENT_SAY` 舰队周飞机编队), `find` souvenir, and BAYBAY `飞机编队拍到啦，舰队周纪念章收好！`. The Marina Green venue keeps its
  own 看看活动 prompt, pennant, festival kit and crowd from part a.
- The pelican: `softBoxes()` — 15 small axis-aligned boxes along the loop (every 80 u of arc, the formation + 12 u, from
  the lowest jet − 12 u up) through lane F's `charApi().glideSoftBox('realsf-jets-<i>', box, 我们在旁边看就好～)` while the
  jets fly; none covers the Marina Green lawn or the photo spot.
- DEV `window.__opusRealSF.jets()` → `{ up, built, count, tris, lead, dist, boxes }`.

### Evidence

- **Checks** — on `3f74a67` (before the last rebase): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors
  (43 old warnings outside `src/opus-bay`) · the suite **1157 / 1160** on the real clock (06:30 PDT): lane L's two fire-ring
  tests (the table measured cold, red 06:00–21:30 PDT on `origin/opus-bay` itself: I ran them in a scratch checkout of
  `da331c9` — same 2 failures) and the known `sf-move2` "E2-5 view field" wall-clock assert (passes alone); **1160 / 1160**
  with the Bay clock pinned to 05:30 (lane T's `--import` preload calling `__setBayNowForTests`). The last rebase brought
  lane L's fix `e889335`, F8 and L4; I pushed right after that rebase and ran the checks on the pushed head `5eee52e`
  immediately after: tsc 0 · eslint 0 errors · **1170 / 1170 on the real clock**.
- **New tests** `tests/opus-bay-w5-today.test.ts` (5) and `tests/opus-bay-w5-jets.test.ts` (5): every hand row over 400 days
  has an https source, a check date and 以官网为准; the garden rules by date (Oct 6 first Tuesday, Oct 13 second Tuesday,
  the Tea Garden Mon / Wed / Fri, the Saturday market 8–14, the fire season edges, Thanksgiving / Christmas / New Year,
  the Botanical Garden's last entry at 11 season edges, the light show sunset + 30 … + 60); the daily three over 150 days
  (stable, three kinds, ≤ 2 timed, event first, only what the day offers, sources match the reward grammar, lines ≤ 45);
  paid once through lane E's real ledger by the real triggers (another event does not count, not at noon, 50 coins,
  `play.d` = { '2026-10-03', 0b10000111 }, never twice, the next day fresh); the SF Today line ≤ 45 over 60 days × 3 hours;
  the tab rendered at 10:30 (sources, 带我去 ×6+, no 21+ / professional events, the 7:30–9 free hour hidden) and at 07:45
  (shown); the jets window (Oct 8 practice, 11:59, 16:00, Oct 12, 2027 off), 6 / 4 jets, ≤ 2.5k triangles, ≤ 5 flat
  colours, the TOY_INST key; on the published city every jet of a lap over open water, ≥ 5 u over it, ≥ 12 u over the
  running ferry's loop, the loop ≥ 150 u from both bridge towers and Alcatraz, jets ≥ 12 u apart; the photo spot standable
  and on ferry-gate's walking network, < 80 u from the low pass; the soft boxes hold every jet and never the lawn; lines.
- **Real game** (dev server 5510, headless Chrome `--force_high_performance_gpu`, every image read; QA JPEGs in
  `docs/opus-bay/qa/w5/R/`):
  - `?date=2026-10-03T10:30` at Marina Green: the 今天 tab first in the row (`今天 0/3`), 10:30 · 10月3日 周六, 日出 7:07 ·
    日落 18:49 · 约下弦月; the pelican goal with 带我去; the daily three 去看看非洲艺术节 (11:00 起) · 在海边或山顶看日落
    (18:14 起) · 去海洋海滩看篝火 (现在开放); HSB (现在开放) and the African Arts Festival (11:00 起) with their sources; the
    market 8:00–14:00 (foodwise.org), the fire rings (nps.gov), the light show 19:19–19:49 (gggp.org); 这周: Castro,
    Litquake, Quinteto, Fleet Week at 码头绿地 10月9日 12:00–16:00 — phone 390 × 844 dpr 3 (`r4-today-2026-10-03-phone.jpg`,
    `r4-today-rows-2026-10-03-phone.jpg`) and desktop (English, `r4-today-2026-10-03-desktop-en.jpg`).
  - `?date=2026-10-09T12:40` desktop zh (`r4-today-2026-10-09-desktop.jpg`, `r4-today-rows-2026-10-09-desktop.jpg`): 今天 1/3
    after walking onto Marina Green (the event task paid: the ledger read `c: 25`, `play.d { 2026-10-09, m 1 }`, the Fleet
    Week souvenir bit), 约新月, Fleet Week 现在开放 with its cost line.
  - 问 BAYBAY on desktop: 8 · 今天旧金山有什么？ in the menu (`r4-ask-menu-desktop.jpg`); choosing it on the phone opens the
    Journal on 今天 (`r4-today-from-ask-phone.jpg`, `?date=2026-10-09T09:00`: 去看看舰队周飞行表演 12:00 起).
  - `?date=2026-10-09T09:00` at the Ferry Building (phone): BAYBAY 今天中午到下午四点，湾上有飞行表演，去码头绿地看！ and the waypoint
    飞行表演 · 码头绿地 (`r6-morning-line-waypoint-phone.jpg`; `mapTarget` = `realsf:jets-watch`).
  - `?date=2026-10-09T12:40` at Marina Green: `jets()` = up, built, 6 jets, 1,644 triangles (desktop) / 4 and 1,096 (phone,
    quality mid); the formation passing low in front of the lawn with its smoke (`r6-jets-pass-2026-10-09-desktop.jpg`,
    `r6-jets-pass-2026-10-09-phone.jpg`); renderer 76 calls / 174k triangles in that view (desktop high, not a gate run).
    The jets' material linked no program of its own (the programs list has none named `ob-realsf-jets`: it shares
    TOY_INST's); the smoke's program is linked by its late warm-up (`ob-realsf-smoke`), and the program count stayed at 96
    between two reads 20 s apart while the jets flew (built, drawn each frame). Not a gate check: lane V's gate decides.
  - Photo: the E prompt reads 拍飞机编队; photo mode turned to the formation (`r6-jets-photo-mode-desktop.jpg`), one shutter →
    `isPaid('event:fleet-week-2026-jets')` true, coins 25 → 40, `play.g.souvenir` 'EAAC' (bits 4 and 17), BAYBAY
    飞机编队拍到啦，舰队周纪念章收好！.
- **Facts checked on the web, 2026-09-28**:
  - Gardens of Golden Gate Park, Hours & Admission (https://gggp.org/visit/admissions-hours/): Conservatory of Flowers open
    six days, closed Wednesdays, 10–4:30 (last entry 4), free the first Tuesday of the month, light art "Photosynthesis"
    from 30 minutes after sunset every night, free, about 30 minutes long (also https://gggp.org/event/conservatory-light-show/;
    a secondary listing, sf.funcheap.com, says it loops until midnight: not used); Japanese Tea Garden opens 9, last entry
    5:30 (March–October) / 4:30 (November–February), free Monday, Wednesday, Friday 9–10 for everyone; SF Botanical Garden
    opens 7:30, free daily 7:30–9, the second Tuesday of every month and Thanksgiving, Christmas, New Year's Day; last entry
    6 (2nd Sunday in March – September), 5 (February – 2nd Saturday in March; October – 1st Saturday in November), 4 (1st
    Sunday in November – January).
  - Foodwise, Ferry Plaza Farmers Market (https://foodwise.org/markets/ferry-plaza-farmers-market/): Saturday 8–2, Tuesday
    10–2, Thursday 10–2, year round.
  - San Francisco Fleet Week, Air Show (https://fleetweeksf.org/air-show/): October 9, 10, 11, 2026, 12:00–4:00 PM, flown
    between the Golden Gate Bridge and Alcatraz; Marina Green is home to the festival centre (general admission free).
    The page names the headline team; the game shows only generic toy jets (no insignia, no names).

### Decisions

1. **The jets fly low and big.** The game camera looks down at the player: at 35–60 u the formation stayed above the top
   edge of the frame from Marina Green (checked in the game), so the near pass runs 7–12 u over the water ≈ 45 u off the
   seawall, under the camera's eye line, and the toy jets are ×1.9 (≈ 12.5 u). The wingover and the far line give the
   show its shape; the pass in front of the lawn is what you see.
2. **Wingmen bank with the lead** (as a real formation does); the turns are raised (26–34 u) so the outer jets keep ≥ 5 u
   over the water, and every stretch near the running ferry's loop is ≥ 12 u up (tested).
3. **The photo stamp counts any shutter with a jet in frame** within 520 u (not only through the prompt): the jets pass
   quickly; the prompt aims the camera where they will be. Lane F's `faceCameraToward` sets yaw only, so the jets sit near
   the top of the photo frame until the player drags the view (Requests 3).
4. **The daily three's sunset needs the real sun** (not Settings' fixed time or the first visit's golden sky); the free-
   place task counts any time in the game (the hint says the real free hours) — nothing in the game is ever locked.
5. **The 今天 tab is order 5** (the first tab); the Journal's default tab and the top-right pill are lanes C / F's files:
   the ask item 今天旧金山有什么？ gives one-tap access now; the pill and the default tab are Requests 1–2.
6. **The light show's hours are the organiser's** (from sunset + 30 min, about 30 min), not the secondary "until midnight".
7. **A mapped event in 这周 shows its window at the venue** (Fleet Week's air show at Marina Green) rather than the catalog's
   first programme date (Oct 6): 带我去 goes where the thing will be.
8. **The market row reads 渡轮大厦 · 农夫市集** (the place's name is not repeated), and the pre-show waypoint 飞行表演 · 码头绿地
   (not 飞机编队 before any jet is up).

### Not done (part b) / known gaps

- W5-R7 (the shoulds: `calendar.ts` with Halloween / king tides, baked tides, `live.json` badges, 现实中怎么去, 我的周末, the
  guide links) — not started (plan: shoulds after the mid-wave checkpoint).
- The roar and the event loops were not heard by a person (headless): registration, gains, ducking and teardown only.
- The smoke is a flat camera-facing ribbon with one opacity (tapering in width, not fading): readable, but a softer puff
  look would need a vertex-alpha variant (one more program) — left as is.
- The pill → 今天 and the Journal opening on 今天 need lanes F / C (Requests 1–2). No fps numbers (lane V's gate).
- The jets are only in the window; lane V's gate table has no spot for them yet (Requests 5).
- A scratch worktree I used to prove the fire-ring failures were upstream (`C:/Users/willy/wt/w5-r-scratch`, its
  node_modules junction removed first) left its metadata folder `C:/Users/willy/OneDrive/Desktop/baylink-web/.git/worktrees/w5-r-scratch`
  (Windows said "Permission denied"; git no longer lists it). Harmless; `git worktree prune` removes it (I did not run
  prune, which also touches other lanes' stale entries).

### Requests

1. **F · `ui/Hud.tsx`** (plan MF6, §3.3 item 5): in city mode the objective pill opens the Journal on 今天 when it is
   registered — `onClick={() => (game.get().worldMode === 'city' && journalTabs.get('today') ? openJournal('today') : flow.set(s => ({ goalsCard: !s.goalsCard })))}`
   (`journalTabs`, `openJournal` from `ui/slots.ts`; lane C asked for the same).
2. **C · `ui/Journal.tsx`**: with no tab asked, open on the first registered tab when it sorts before the built-ins (今天 is
   order 5) in city mode — `known(asked) ? asked : slots[0] && slots[0].order < JOURNAL_BUILTIN_ORDER.cards && city ? slots[0].id : …`
   — so J and the 旅行本 button land on 今天 too.
3. **F · `game/cinema.ts` / the photo camera**: an optional pitch in `faceCameraToward(x, z, { pitch })` so a subject above
   the horizon (the jets) comes to the middle of the photo frame.
4. **E**: the notebook header can read `todayLine()` (`realsf/todayLine.ts`); the jets' stamp is `event:fleet-week-2026-jets`
   (`SOUVENIR_IDS` bit 17, `EVENT_SAY` 舰队周飞机编队); the daily three pay `daily:<date>:1..3` and `:all` as agreed.
5. **V**: a gate spot for the show — Marina Green, `&date=2026-10-09T12:40&at=marina-green` (the jets' 2 calls and 1,644
   triangles at high only in the window); the smoke's program is warmed as `r-jets-smoke`. Voice (H5-3), R's new fixed
   lines: 今天中午到下午四点，湾上有飞行表演，去码头绿地看！ · 飞行表演正在湾上，四点结束，去码头绿地看！ · 飞机编队来啦！打开拍照，把它们拍下来吧～ ·
   飞机编队拍到啦，舰队周纪念章收好！ · 我们在旁边看就好～ · 今天的三件小事都做完啦！明天可能不一样哦～ (dynamic lines with times stay text).
6. **Lead**: the leftover worktree metadata above; the jets' live check on Fri Oct 9 at 12:30 PT (plan §4.14).

## Part c

Written 2026-09-28 (PDT). Tasks: W5-R7 (the shoulds) and W5-R8 (tests, shots, report) (plan §4.13 items 7–8, §3.3 "Should").
The mid-wave checkpoint listed no findings for lane R, so the shoulds started right away. Pushed as three commits
(`W5-R7: San Francisco's real tides and BAYLINK's own offers…`, `W5-R7: the verified calendar and its dressings…`,
`W5-R7 / W5-R8: the 今天 tab's new rows…`) and this report (hashes in the structured report: they were rebased on the way).

### 给主人的摘要

1. 万圣节（10/31）那天，彩绘女士的台阶上和 Waller 街老房子门口会摆满南瓜，晚上南瓜脸会发光；BAYBAY 会说"今天万圣节！老房子的台阶上摆满了南瓜灯～"。
2. 游戏里有了真实潮汐（美国海洋大气局的预报，打包进游戏，不连外网）：低潮时天涯海角海里会露出两艘老沉船的发动机；涨潮时海浪风琴更响；11/24–26 等特大潮日，渡轮大厦后面的海堤会溅起浪花。
3. "今天"页新增：今天的潮汐和海边安全提醒、今天免费的博物馆和花园（来自 BAYLINK 自己的优惠，点开就是 BAYLINK 优惠页）、这周的日历（万圣节、特大潮）、"我的周末"（把想去的活动带去 BAYLINK 排计划）和三条 BAYLINK 散步攻略。
4. 活动卡上多了"现实中怎么去"：最近的真实电车/缆车站、步行几分钟、几分钟一班（9/28 查过 SFMTA 官网），并提醒出发前查 SFMTA / 511。
5. 满月前后的晚上，在双峰或海洋海滩 BAYBAY 会说"今晚差不多满月"。所有日期、时间都在 9/28 查过官网；查不到 2026 日期的亡灵节先不显示。

### What was built

**Baked at build time, read same-site** (plan D13: no third-party call from the player's browser)

- `scripts/opus-sf/export-tides.ts` → `public/opus-bay/sf/v1/tides.json`: NOAA CO-OPS predictions for station 9414290
  San Francisco (Golden Gate), `interval=hilo`, feet above MLLW, UTC, fetched in ≤ 1-year pieces with the `application=`
  parameter. 1,762 extremes from 2026-09-01 to 2027-11-30, 16 KB raw, **6.1 KB gzip** (`t0` + minute deltas + heights in
  hundredths of a foot + an `HL…` string).
- `scripts/opus-sf/export-live.ts` → `public/opus-bay/sf/v1/live.json`: the 11 San Francisco offers of plan §3.3 read from
  the site's own `src/data` (the `export-planner-catalog.ts` pattern, read-only) — museums, parks and transit only, never a
  shop — each with the offer's own title, conditions, source and check date, a short "who", its place in the world, the day
  rule and hours of a standing offer (read on the organiser's page on 2026-09-28) and `href: /offers/<id>`. The export fails
  if an offer disappears or turns into a purchase deal. 3.7 KB gzip.
- `realsf/sameSite.ts` `fetchSfJson('tides.json' | 'live.json')`: the only fetches, `/opus-bay/sf/current.json` →
  `/opus-bay/sf/<version>/<name>`, at idle (4 s after the feature starts).
- `realsf/tides.ts`: `parseTides` (untrusted input), `loadTides`, `tideAt(ms)` (a half cosine between the neighbouring
  extremes; null past the file's end), `tidesOnDay(dateKey)`, `nextTide`, `tideLoudness` (0.25 … 1; the neutral 0.7 without a
  table), `COAST_SAFETY`, the sources.
- `realsf/live.ts`: `parseLive`, `loadLive`, `offersOn(dateKey)` (a dated offer on its dates, a standing one on its weekdays /
  n-th weekdays, with that day's hours; a closed weekday never applies), `standingOffers()`, `offersForPlace(placeId, dateKey)`
  for lanes C / N.

**The verified calendar and what it dresses** (DESIGN §8's carve-out: dressing and lines only, never an event card)

- `realsf/calendar.ts` `CALENDAR` `{ id, title, from, to, at?, where, placeId?, xz?, note, grade, source, catalogId?, dress?,
  line?, hidden?, later? }`: Halloween (Oct 31, `usually`, dresses `pumpkins`); Día de los Muertos **hidden** (the organiser's
  page still shows 2025); the king tides Nov 24–26 and Dec 23–25, 2026 and Jan 21–22, 2027 (`official`, dress `king-tide`);
  data-only rows kept with their sources for later waves (Lunar New Year Feb 6, 2027 `secondary`, the parade Feb 20, Cherry
  Blossom Apr 10–11 / 17–18, the 1906 remembrance Apr 18 05:12 `usually`, Pride Jun 26–27). `calendarOn`, `calendarAhead`,
  `dressingOn`, `GRADE_SAY`.
- `realsf/dressing.ts` (a 2 Hz frame system, one group added to the city world):
  - **Halloween pumpkins** — 33 pumpkins: on the middle step of each of the Painted Ladies' seven stoops plus a
    jack-o'-lantern on the sidewalk at each foot (in lane L's landmark frame), and 19 along Waller St between Scott and
    Steiner (0.45 u out from the street face of each building, standable, never the roadway), placed on the published city by
    `scripts/opus-sf/realsf-place.mts`. The carved faces glow at night (the toy shader's night light). **1 call, 1,524
    triangles**, own kit material `ob-realsf-pumpkins` (TOY_DYN's program key: no new program), warmed `r-pumpkins`; built on
    the Bay date Oct 31 within 420 u.
  - **King-tide spray** — crossed fans bursting over the seawall behind the Ferry Building at six edge points (the water found
    at build time), CPU-animated, within 100 minutes of the day's highest tide on a king-tide day, within 400 u. **1 call, 36
    triangles** (the Ferry gate's published allowance is 1 call and 2k), own instance of the jets' smoke material (the same
    program), warmed `r-tide-spray`.
  - **The Lands End wrecks** — the Lyman Stewart's engine and the Frank Buck's stern post and engine as toy shapes (no names)
    in the surf off Mile Rock Beach, shown at a real low tide of +1 ft or less and lifted by how low it is (`wreckExposure`).
    **1 call, 212 triangles**, own kit material, warmed `r-wrecks`, within 400 u.
  - Lines, once a Bay day through part a's scheduler: 今天万圣节！老房子的台阶上摆满了南瓜灯～ (within 220 u of the Painted Ladies);
    今天是特大潮，海水快漫上堤岸了，离水边远一点哦。 (at the seawall while the water is high); 低潮啦！看，老沉船的发动机露出水面了。 (within 150 u of the
    wrecks).
- `realsf/index.ts`: `initDressing()`; the idle fetches; **lane D's Wave Organ follows the real tide** through D's published
  `setOrganTide(() => tideLoudness())` (dynamic import, undone on teardown); **今晚差不多满月，在这儿看月亮正好～** when the moon is
  ≥ 96 % lit, the real sky is golden or night, within 250 u of the Twin Peaks overlook or Ocean Beach (`fullMoonNear`). DEV
  `__opusRealSF.dressing()` and `.organWired()`.

**现实中怎么去** (`realsf/transitReal.ts`, `realsf/HowToGo.tsx`)

- `REAL_LINES`: N Judah, M Ocean View, the F line, the Powell–Hyde, Powell–Mason and California cable cars, each with its
  service hours and daytime headways from its sfmta.com route page (checked 2026-09-28); the game's sightseeing loop is never
  listed. `realStopsOf`, `loadedRealStops` (the game's loaded transit data), `nearestRealStops(point)` (the nearest stop of each
  line within 1.2 km, real distance through `unprojectCity`, walking minutes by the catalog's own 80 m/min rule),
  `serviceLabel` (全天 24 小时 · 白天约 10 分钟一班 / 现在不开 · 运营 6:00–24:00), `CHECK_511`.
- `HowToGo` (lazy) under the summary of every event card with a venue in the world (`ui/EventCardBody.tsx`, city mode only):
  up to two lines, then 出发前查 SFMTA / 511 确认 with the route pages and 511.

**The 今天 tab** (`realsf/TodayTab.tsx`, `realsf/todayRows.ts`, `data/links.ts` `offerUrl`)

- 今天在旧金山: today's calendar row (with its grade 通常如此 / 以官网为准); BAYLINK's offers today (缆车博物馆 · 免费 · 10:00–16:00 ·
  所有人, the organiser's page and **BAYLINK 优惠详情** → `/offers/<id>`; an offer that belongs to an existing hand row — the Tea
  Garden hour, the Conservatory's and the Botanical Garden's free Tuesdays — adds its link to that row instead of a second
  row); the tides (潮汐 · 低 3:25 · 高 9:57 …, then either the Lands End wrecks at a daylight low of ≤ 1 ft still ahead with
  带我去 天涯海角, or the Wave Organ before a high with 带我去 海浪风琴, and 海水冰冷、水流危险：别下水，别爬礁石, with NOAA, the wreck / organ
  source and nps.gov); the standing offers with their conditions in one line (探索馆（持福利卡加证件，$5）· 旧金山现代艺术博物馆（SF 居民持福利卡）·
  Muni（18 岁及以下））.
- 这周: the calendar rows starting in the next 7 days (Halloween from Oct 24, the king tides from Nov 17).
- **我的周末**: the wishlist's events on the coming weekend (today and tomorrow on a Saturday) with their days and 带我去, the saved
  catalog places, **去 BAYLINK 排周末** (`planUrl` with the weekend day) and **我的一周** (`/my-week`).
- **走走看 · BAYLINK 攻略**: the three guides the game did not use yet, each by its place with 带我去 — the Sunset Dunes October walk
  (October only), Lands End and the Sutro Baths, Dolores Park and the Mission murals — shown only when the loaded catalog has
  them (`guideTitle`).

### Evidence

- **Checks** on the rebased head: `npx tsc -p tsconfig.app.json --noEmit` 0 errors · `npx eslint .` 0 errors (43 old warnings
  outside `src/opus-bay`) · the full suite `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts`: 1207 / 1207
  before the first rebase, **1245 / 1245** after it (lane A's marshmallow, lane N's and F's checkpoint fixes), **1251 / 1251**
  after lane D's 城市之声; lane V's W5-V10 / W5-V3 then landed and the final numbers are in the structured report.
- **New tests** `tests/opus-bay-w5-calendar.test.ts` (10): the tides file (≤ 8 KB gzip, 9414290, MLLW, the `application`
  parameter, alternating highs and lows, two predictions matched to NOAA's API, the cosine exact at the extremes and monotone
  between, the Bay-date grouping, nothing past the end, loudness, garbage rejected); the king tides (the three official spans,
  the spray only near the day's highest tide and never on an ordinary day, the spray points on land next to water by the Ferry
  Building in the published city); the calendar (sources and dates, Día hidden, later rows data only, Halloween only on Oct 31,
  这周 a week ahead, notes ≤ 40 and lines ≤ 45 zh characters, no event card); Halloween (the stoop spots recomputed from lane L's
  landmark, every Waller St spot standable, off the road and against a wall, ≤ 1.6k triangles with glowing faces); live.json
  (11 offers, each still a BAYLINK offer with the same title and source, a free row never a purchase deal, the day rules on
  Oct 1 / 4 / 5 / 6 / 8 / 25 and Nov 4, the standing three, `offersForPlace`, the hand rows they join); 现实中怎么去 (six real
  lines and never the loop, sfmta.com sources, HSB → the N, the Castro fair → the F and the M, the Ferry Building → the F,
  nothing far from a line, the service labels); the moon line (the evening of Oct 25 yes; by day, downtown or at the new moon
  no); the 今天 tab rendered with the real catalog (tides, offers with `/offers/…`, the standing line, 我的周末's plan link
  `/plan?date=2026-10-03&stops=event:hardly-strictly-bluegrass-2026`, `/my-week`, the guides, Halloween a week ahead and on the
  day, the October walk gone in November); same-site only; the wrecks (in the water off Mile Rock Beach, land within 12 u, the
  sea surface equal to `world/sf/water.ts`, shown at the Nov 25 −1.65 ft low and hidden at that morning's king tide).
- **Real game** (dev server 5510, headless Chrome `--force_high_performance_gpu`, every image read; QA JPEGs in
  `docs/opus-bay/qa/w5/R/`):
  - `?date=2026-10-31T19:30&time=night` at the Painted Ladies: `dressing()` = `{ rows: ['halloween-2026'], pumpkins: 33,
    pumpkinTris: 1524 }`; the jack-o'-lanterns glowing at the foot of each stoop and BAYBAY 今天万圣节！老房子的台阶上摆满了南瓜灯～
    (`r7-halloween-painted-ladies-night-desktop.jpg`); phone 390 × 844 dpr 3 (`r7-halloween-painted-ladies-night-phone.jpg`);
    Waller St by day with the same line (`r7-halloween-waller-st-day-desktop.jpg`).
  - `?date=2026-11-25T10:45` behind the Ferry Building: `spray: true, sprayTris: 36`, the fans bursting over the railing
    (`r7-king-tide-spray-2026-11-25-desktop.jpg`).
  - `?date=2026-11-25T17:40` at Mile Rock Beach (−1.65 ft): `wrecks: 1, wreckTris: 212` (`r7-lands-end-wrecks-low-tide-desktop.jpg`);
    BAYBAY 低潮啦！看，老沉船的发动机露出水面了。 at 22 s (`r7-lands-end-wrecks-line-desktop.jpg`, taken while the shore chunks were still
    streaming in).
  - `?date=2026-10-25T20:00` at Ocean Beach: `fullMoonNear` true and BAYBAY 今晚差不多满月，在这儿看月亮正好～ at 14 s
    (`r7-full-moon-line-ocean-beach-desktop.jpg`).
  - The Wave Organ at `?date=2026-10-31T15:40` (5.84 ft, near the 15:44 high): lane D's `organTide()` read **1.0** through the
    game's own module instance (0.7 is its default).
  - The 今天 tab on the phone, `?date=2026-10-01T10:30` with HSB wished: the market, fire rings, light show, 缆车博物馆 · 免费 and
    兰德尔博物馆 · 免费 with their sources and BAYLINK 优惠详情 (`r7-today-offers-phone.jpg`); the tides row (14:58 高潮 6.2 英尺：涨潮时海浪风琴唱得最响)
    and the standing offers (`r7-today-tides-standing-phone.jpg`); 我的周末 (10月3日 周六、10月4日 周日 · HSB · 去 BAYLINK 排周末 · 我的一周)
    and 走走看 (`r7-today-weekend-walks-phone.jpg`). Desktop on Oct 31 10:00: the Halloween Hoopla, 万圣节 · 维多利亚老房子的台阶
    (通常如此, localnewsmatters.org), the offers (`r7-today-halloween-desktop.jpg`), the tides, the honest "no new events this week"
    (the catalog ends Oct 31) and an empty 我的周末 with 我的一周 (`r7-today-tides-weekend-desktop.jpg`).
  - Event cards: HSB on desktop — 现实中怎么去 · N 线 · Judah & 28th Ave · 步行约 10 分钟 · 全天 24 小时 · 白天约 10 分钟一班
    (`r7-eventcard-howtogo-desktop.jpg`); the Castro fair on the phone — M 线 · 卡斯特罗站 · 步行约 5 分钟 and F 线复古电车 · 17th Street &
    Castro Street · 步行约 5 分钟 (`r7-eventcard-howtogo-castro-phone.jpg`; the card's own tip also says to take Muni Metro to Castro).
  - Calls / triangles added (read in the game, not a gate run): pumpkins +1 / +1,524 (Oct 31 only, Alamo Square – Lower Haight,
    not downtown), spray +1 / +36 (king-tide hours only, inside the Ferry gate's allowance), wrecks +1 / +212 (low tides only,
    Lands End). No new program: the three materials use existing program keys (TOY_DYN; the smoke's basic program). No fps
    numbers (lane V's gate).
- **Facts checked on the web, 2026-09-28** (each also next to its row in the code):
  - NOAA CO-OPS station 9414290 "San Francisco CA" (https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/9414290.json);
    predictions (https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=9414290).
  - King tides 2026–27: November 24–26, 2026; December 23–25, 2026; January 21–22, 2027 (https://www.coastal.ca.gov/kingtides/).
  - The wrecks: "Their engines are still visible at low tide." — the Frank H. Buck (1937) and the Lyman Stewart (1922)
    (https://oceanservice.noaa.gov/news/oct14/shipwrecks.html); seen "as you walk the Coastal Trail between the vista point and
    the Palace of the Legion of Honor" (https://www.parksconservancy.org/parks/lands-end); Mile Rock Beach is OSM way 195638010.
  - The Wave Organ "is best heard at high tide" (https://en.wikipedia.org/wiki/Wave_Organ); Ocean Beach: "the water is frigid
    and the currents hazardous" (https://www.nps.gov/goga/planyourvisit/oceanbeach.htm).
  - Halloween decorations on Waller St from Scott to Steiner (Local News Matters, 2025-10-27,
    https://localnewsmatters.org/2025/10/27/skeletons-fangs-lost-souls-heres-where-to-find-sfs-best-halloween-decorated-homes/).
  - Día de los Muertos: https://www.dayofthedeadsf.org/ still shows only November 2nd, 2025 → hidden.
  - 2027: the Chinese New Year parade on February 20, 2027 (https://www.chineseparade.com/); Lunar New Year on February 6, 2027
    (https://www.si.edu/spotlight/lunar-year-goat, secondary); the Cherry Blossom Festival April 10–11 and 17–18, 2027
    (https://www.sfcherryblossom.org/); SF Pride June 26–27, 2027 (https://www.sfpride.org/); the 1906 remembrance at Lotta's
    Fountain at 5:12 am on April 18 (https://downtownsf.org/do/1906-earthquake-and-fire-anniversary-commemoration, the 2026
    ceremony; 2027 "usually").
  - Muni route pages (https://www.sfmta.com/routes/…): N Judah 24 hours daily, weekday 10 10 10 20 30, weekend 12 12 12 20 30
    (the N bus between subway hours and Owl service); M Ocean View 6 a.m. – 12 a.m., weekday 10 10 10 20, weekend 15 12 10 20;
    F Market & Wharves 7 a.m. – 12 a.m., 20 12 12 20; Powell–Hyde 7 a.m. – 11 p.m., weekday 20 10 7 20, weekend 20 9 12 20;
    Powell–Mason 7 a.m. – 11 p.m., weekday 10 – 12 20, weekend 10 10 10 20; California 7 a.m. – 9 p.m., 20 10 10.
  - Offer day rules: the Cable Car Museum Tue–Thu 10–4, Fri–Sun 10–5, closed Monday, free (https://www.cablecarmuseum.org/info.html);
    the Randall Museum 10–5 Tuesday–Saturday, no admission fee (https://randallmuseum.org/faqs/); the Museo Italo Americano free on
    Thursdays (Tue–Sat 12–4) and the first Sunday (Sun 10–2) (https://sfmuseo.org/); the Asian Art Museum free on the first
    Sunday, Fri–Mon 10–5 (https://about.asianart.org/ticketing/); SFMOMA Sunday 10–5 (https://www.sfmoma.org/visit/); the
    Exploratorium's hours page answered 403, so its row shows no hours.

### Decisions

1. **The calendar never makes an event card.** Rows dress the world and give BAYBAY a line; `catalogId` is empty for all of
   them (the Halloween Hoopla comes from the catalog as before). Halloween's pumpkins are graded 通常 (a custom, sourced to the
   street Local News Matters names); the date itself is fixed.
2. **Only BAYLINK's own 11 offers**, and only what the offer or the organiser's page says: a standing offer applies on the
   organiser's days and hours, a dated one on its dates; eligibility offers (a benefits card, an age) are one 长期福利 line with
   their conditions, never 今天免费. An offer that matches an existing hand row adds its link there (no duplicate row).
3. **Tides in UTC from NOAA, grouped by the Bay date**; a half cosine between extremes (the usual rule); +1 ft MLLW is the
   practical "low enough to see the wrecks" mark (said as 低潮时, never a promise).
4. **The king-tide spray sits behind the Ferry Building** on the water edge (1 call, 36 triangles, inside the Ferry gate's
   published 1 call / 2k) and only near the high water.
5. **The wrecks are toy shapes off Mile Rock Beach** (OSM), in the water, visible from the Coastal Trail. No authoritative wreck
   coordinates were found (Overpass timed out, Nominatim has none), so the spot follows the organisers' "from the Coastal Trail
   between the vista point and the Legion of Honor".
6. **The Wave Organ is wired through lane D's published setter** from lane R's chunk (a dynamic import resolves to the game's
   module instance): no edit to D's files.
7. **现实中怎么去 on event cards only** (lane R's file); place cards are lane C's (Requests 1). Up to two lines within 1.2 km; the
   game's own sightseeing loop is never offered as a real route.
8. **Bigger pumpkins after the first look in the game**: at 0.13 / 0.18 u they read as orange dots; the step pumpkins are
   0.15 u and the jack-o'-lanterns 0.26–0.28 u now.
9. **The Sunset Dunes walk shows only in October** (its guide is month-tagged); the other two guides show all year.

### Not done / known gaps

- **Place cards and the map** do not show 今天免费, the tide row or 现实中怎么去 yet (lanes C / N; Requests 1–2). The 今天 tab and
  the event cards carry them.
- **The sky's moon disc and Karl by month** landed in lane V's W5-V10 while this part was being checked (`cef43f9`, reading
  lane R's `moonPhase` and `karlMonthFactor`); BAYBAY's full-moon line is lane R's and works now. I have not looked at V10's
  moon in the game myself.
- The spray is flat crossed fans with one opacity; the wrecks are simple toy shapes. The King Philip ribs in the Ocean Beach
  sand (very rare, below −1 ft) are not built.
- `tides.json` ends on 2027-11-30, and `live.json` is a snapshot of today's `src/data`: both need their export script re-run
  (Requests 6).
- The 2027 calendar rows are data only (not shown in this build), as the plan says.
- No live weather, Muni or AQI (plan: not this wave).
- Process note: my four Nominatim look-ups for the wreck site carried a contact e-mail in their User-Agent header. No other
  request did, and none will.

### Requests

1. **C · `ui/PlaceCard.tsx` / `ui/PoiCardBody.tsx`** (city mode): (a) 现实中怎么去 — `const HowToGo = lazy(() => import('../realsf/HowToGo'))`
   and `<Suspense fallback={null}><HowToGo point={{ x, z }} /></Suspense>` with the card's world point; (b) a 今天免费 chip —
   `import('../realsf/live').then(m => m.offersForPlace(placeId, bayParts().dateKey))` (`today[].offer.title / who / href`,
   `standing[]`), linking `offerUrl(id, locale)` from `data/links.ts`; (c) on the coast cards (Ocean Beach, Lands End, Baker Beach,
   China Beach, the Sutro Baths) a tide row from `realsf/tides.ts` `tidesOnDay(dateKey)` with `COAST_SAFETY`.
2. **N · the map**: gold 今天免费 badges from `realsf/live.ts offersOn(dateKey)` (`offer.place.x / z`, DOM badges like the 这周 pins),
   and the calendar's dressed days from `realsf/calendar.ts dressingOn(dateKey)` if a pin is wanted.
3. **L · `data/sf/landmarks.ts`**: `sutro-baths` → `guideSlug: 'sf-lands-end-sutro-baths-walk-guide'`, `mission-dolores` →
   `'sf-mission-dolores-murals-walk-guide'` (both in `/baybay-guides.json` since W5-0c; today they point at the general SF guide).
4. **V**: (W5-V10 with the moon and Karl by month has landed.) Gate spots if wanted: Halloween at the Painted Ladies `&date=2026-10-31T19:30&at=xz:6.5,575` (+1 call, +1,524), the king-tide
   spray `&date=2026-11-25T10:45&at=xz:131,-17` (+1 / +36 at the Ferry gate), the wrecks `&date=2026-11-25T17:40&at=xz:-738,1103`
   (+1 / +212). Voice (H5-3), R's new fixed lines: 今天万圣节！老房子的台阶上摆满了南瓜灯～ · 今天是特大潮，海水快漫上堤岸了，离水边远一点哦。 ·
   低潮啦！看，老沉船的发动机露出水面了。 · 今晚差不多满月，在这儿看月亮正好～.
5. **E**: the notebook's 季节 page can list the calendar's dressed days (`CALENDAR.filter(r => r.dress)`) as seasonal moments.
6. **Lead**: re-run `npx tsx scripts/opus-sf/export-live.ts` after any merge that changes the site's offers, and
   `npx tsx scripts/opus-sf/export-tides.ts 2027-09-01 2028-11-30` before the file runs out (both write only
   `public/opus-bay/sf/v1/`); live checks: Sat Oct 31 (the pumpkins, the fire-season line), Wed Nov 25 at 10:49 PST (the king
   tide's spray) and any low tide at Lands End (the wrecks).
7. **Site editors (via the lead)**: the 2026 Día de los Muertos date when the organisers post it (the row then unhides with its
   date and source).

## Review

Adversarial review of lane R's wave-5 work (W5-R1 … R8, parts a–c), written 2026-09-28 (PDT) in the lane's worktree after
rebasing on `origin/opus-bay`. Read: the twelve W5-R commits, every file under `realsf/`, the lane's changes to
`game/qa.ts`, `data/{catalog,links}.ts`, `ui/{WeekPanel,EventCardBody}.tsx`, `ui/event-go.css`, the export scripts, the five
test files, plan §1, §2, §3.3, §4.1–4.3, §4.13, §4.14, §6, the lead note and the owner's feedback.

### 给主人的摘要

1. 旧金山"联动现实"这条线整体可用：活动出现在真实场地、"今天"页、今日三件小事、舰队周飞机、潮汐和万圣节，我都在真实游戏里试过，桌面和手机都正常；重新上网核对了 20 多条事实，基本都对。
2. 修了 7 个问题：日出日落时间原来会早 1 分钟（现在和美国海军天文台一致，例如万圣节日落 18:12）；过了午夜 BAYBAY 会念昨天的三件小事、重复说"都做完啦"和"纪念章收好啦"；你走远后她还会说"飞机编队来啦"；拍飞机时镜头太低，飞机总被切在画面最上沿（现在在画面上方三分之一）；万圣节那行写了来源里没有的话；手机上传单的"带我去"太小不好点。
3. 还有几件在别的线的文件里，写在下面的请求里（例如右上角的目标胶囊还不能直接打开"今天"页）。

### What I did in the real game (dev server 5510, headless Chrome `--force_high_performance_gpu`, every image read)

- **HSB, desktop, `?date=2026-10-03T10:30`, Hellman Hollow**: `presence()` = HSB open, the music kit (520 triangles) built,
  the crowd pinned, BAYBAY's line on screen (Golden Gate Park has the bluegrass festival today (free), 9:00–19:00 …), the
  souvenir paid on arrival (coins 0 → 15). Calls 72, triangles 195k, programs 91 on that view.
- **Jets, phone 390 × 844 dpr 3, quality mid, `?date=2026-10-09T12:40`, Marina Green**: `jets()` = up, built, 4 jets,
  1,096 triangles, 15 soft boxes; the daily three's event task paid by walking onto the lawn; the formation and its smoke
  in the sky over the water.
- **Warm-up**: loaded at 11:59 at Marina Green; the jets came up at 12:00 in place and the program count stayed
  **92 → 92** (6 jets, 1,644 triangles). The smoke and toy programs were linked before the show.
- **Jets photo, desktop**: 拍飞机编队 (the interactable's `act`) opened photo mode facing the formation; one Space shot paid
  `event:fleet-week-2026-jets` (coins 25 → 40). Before the fix the formation sat clipped at the top edge
  (`r6-jets-photo-mode-desktop.jpg`); after it, the formation flies across the frame's upper third
  (`review-jets-photo-pitch-desktop.jpg`).
- **今天 tab**: desktop zh at YBG on 10-03 10:30 (19 带我去 buttons: the goal, the daily three, today's rows, the week, the
  guides); tapping the Hellman Hollow row's 带我去 closed the Journal and started lane N's trip (`flow.trip` set,
  BAYBAY 带路中, 下一站 金门公园 Hellman Hollow). Phone zh on 10-31 17:20 at the Painted Ladies: 日落 18:12 (was 18:11),
  the fixed Halloween note, the renamed fire-ring task (`review-today-sunset-1812-phone.jpg`,
  `review-today-halloween-phone.jpg`). The tab bar fits on a phone in Chinese; in English it overlaps (see Open).
- **District mode** is not changed by lane R: `bayTimeOfDay` keeps the fixed bands there, the venue hooks are never
  registered (no 带我去, no HowToGo, `eventsNear` unchanged), and `event-go.css`'s `.ob-flyer { position: relative }` moves
  nothing (the flyer's only positioned children sit inside its button). The contracts and district tests pass.

### Facts re-checked on the web (2026-09-28)

| fact in the game | source | result |
|---|---|---|
| Japanese Tea Garden free Mon / Wed / Fri 9–10 am; last entry 5:30 pm Mar–Oct, 4:30 pm Nov–Feb | https://gggp.org/visit/admissions-hours/ | correct |
| Conservatory of Flowers free on the first Tuesday, closed Wednesdays, 10–4:30 (last entry 4) | same | correct |
| the Conservatory's light show "Photosynthesis" 30 min after sunset, about 30 min, free | same | correct |
| Botanical Garden free daily 7:30–9, the 2nd Tuesday, Thanksgiving, Christmas, New Year's Day | same | correct |
| Ferry Plaza Farmers Market Tue & Thu 10–2, Sat 8–2 | https://foodwise.org/markets/ferry-plaza-farmers-market/ | correct |
| Ocean Beach fires March–October, curfew 9:30 pm | https://www.nps.gov/articles/ocean-beach-fire-program.htm | correct |
| Hardly Strictly 2026: Oct 2–4, gates 11 am Fri / 9 am Sat–Sun, music ends 7 pm, Hellman Hollow, Lindley & Marx meadows | https://hardlystrictlybluegrass.com/info-faq-2026/ | correct |
| Fleet Week air show Oct 9–11, 12–4 pm, between the Golden Gate Bridge and Alcatraz; Marina Green festival centre, free | https://fleetweeksf.org/air-show/ | correct |
| Castro Street Fair Sun Oct 4, 11 am–6 pm | https://www.sfmta.com/travel-updates/castro-street-fair-sunday-october-4-2026 | correct |
| King tides Nov 24–26, Dec 23–25, 2026, Jan 21–22, 2027 | https://www.coastal.ca.gov/kingtides/ | correct |
| tides.json on Nov 24–26 (all eleven highs and lows) | NOAA CO-OPS API, station 9414290, MLLW | identical (times to the minute, heights to 0.01 ft) |
| new moon Oct 10 15:50 UT; full moon Oct 26 04:12 UT (the evening of Oct 25 in SF) | https://aa.usno.navy.mil/api/moon/phases/date?date=2026-09-01&nump=12 | correct |
| Nov 2: sunrise 06:36, sunset 17:10, civil 06:09 / 17:37 | https://aa.usno.navy.mil/api/rstt/oneday (37.7749, −122.4194) | the maths is right; the **display truncated** (17:09, 06:08, 17:36): fixed |
| N Judah 24 h; 10 min weekday, 12 weekend, late night 20 | https://www.sfmta.com/routes/n-judah | correct |
| F Market & Wharves 7 am–12 am; 20 / 12 / 12 | https://www.sfmta.com/routes/f-market-wharves | correct |
| M Ocean View 6 am–12 am; weekday 10, weekend 15 / 12 / 10 | https://www.sfmta.com/routes/m-ocean-view | correct |
| Powell–Hyde 7 am–11 pm; weekday 20 / 10 / 7 / 20, weekend 20 / 9 / 12 / 20 | https://www.sfmta.com/routes/powell-hyde-cable-car | correct |
| Powell–Mason weekday 10 / – / 12 / 20, weekend 10 / 10 / 10 / 20 | https://www.sfmta.com/routes/powell-mason-cable-car | correct (a first summary of the page misread its columns; the table read again matches the code) |
| California cable car 7 am–9 pm; 20 / 10 / 10 | https://www.sfmta.com/routes/california-cable-car | correct |
| Cable Car Museum free; Tue–Thu 10–4, Fri–Sun 10–5, closed Monday | https://www.cablecarmuseum.org/info.html | correct (live.json) |
| Randall Museum free, Tue–Sat 10–5 | https://randallmuseum.org/faqs/ | correct |
| Museo Italo Americano free on Thursdays (12–4) and the first Sunday (10–2) | https://sfmuseo.org/ | correct |
| Asian Art Museum free on the first Sunday, open 10–5 | https://about.asianart.org/ticketing/ | correct |
| the Frank H. Buck (1937) and Lyman Stewart (1922): engines visible at low tide | https://oceanservice.noaa.gov/news/oct14/shipwrecks.html | correct |
| Halloween: Waller St, Scott to Steiner, decorated houses | https://localnewsmatters.org/2025/10/27/skeletons-fangs-lost-souls-heres-where-to-find-sfs-best-halloween-decorated-homes/ | the source names Waller St's decorations, **not** the pumpkins on the Painted Ladies' stoops the note claimed: fixed |

### Defects found and fixed (pushed: `99eb2585`, `1ed4462f`; the comment fix with this report)

1. **Sun times a minute early** (`realsf/sun.ts`). `bayHm` truncates seconds; of the 56 USNO times in the lane's own test
   table only 29 matched to the minute (Halloween's sunset showed 18:11 for USNO's 18:12, Dec 21 dusk 17:23 for 17:24).
   New `sunHm` / `roundMinute` round as the almanacs do: 55 of 56 match, and every sunrise and sunset does. Used by BAYBAY's
   sunset line, the SF Today line, the tab's 日出 / 日落, the light show's start and the daily sunset task's hours.
2. **Lines that outlived their day.** The daily three kept its lines for the whole session: after midnight BAYBAY named
   *yesterday's* three (the intro was never rebuilt) and said 今天的三件小事都做完啦！ again on a day with nothing done (the
   scheduler's memory had rolled over). The event souvenir line (…纪念章收好啦！) waited across midnight the same way and was
   said the next day with no stamp. Both now drop their waiting lines on a new Bay day.
3. **飞机编队来啦！打开拍照… latched** (`realsf/jets.ts`). `nearLine` was set once within 400 u and never cleared: if a panel
   or photo mode held the line back and the player then flew away, BAYBAY said it across the city; on the next show day it
   was offered at the first tick wherever the player stood. It is now offered only while the formation is within 400 u, and
   the photo line forgets a past day.
4. **The jets photo framed** (`realsf/jets.ts`). Lane F landed `faceCameraToward(x, z, { pitch })` (W5-F6, this lane's
   request 3); 拍飞机编队 now passes a nearly level pitch, so the formation is in the frame instead of clipped at its top
   edge. The stamp still pays on the first shot (checked in the game).
5. **Per-frame garbage.** `poseAt` built a closure per call (≈ 160 calls a frame during the show: 6 jets and 156 smoke
   samples); the king-tide spray built ≈ 100 small arrays a frame. Both now write straight into their buffers.
6. **The once-a-day memory dropped a malformed key** (`realsf/lines.ts`): an event id the catalog spelled with `_` or `.`
   would never be remembered, and the scheduler would say that line every 20 s. It is now remembered for the page (only
   well-formed keys are saved). Today's 104 catalog ids are all well formed, so this was latent.
7. **Words.** The Halloween note says only what its source says (Waller 街（Scott 到 Steiner）有很多人家做万圣节装饰 ·
   通常如此); the fire-ring task reads 去海洋海滩的篝火圈看看 (the toy rings glow only after dusk, and "看篝火" promised flames
   at 10 am); 现在不开 → 现在停运 on 现实中怎么去; the jets' header comment said the loop flies ≥ 20 u above everything (the
   low pass flies at 7–12 u; the tests hold ≥ 5 u over the water and ≥ 12 u over the ferry).

Also: a teardown while the eggs chunk loads no longer wires the Wave Organ afterwards; the flyer's 带我去 chip keeps its
look and gets a ≈ 40 px tap area (it drew ≈ 21 px tall on a phone); DEV `__opusRealSF.offered()` lists the line keys on
offer. Tests: `tests/opus-bay-w5-r-review.test.ts` (5), all five red on the previous code and green now;
`tests/opus-bay-w5-calendar.test.ts` follows the 现在停运 wording.

### Checked and sound

- Budgets as reported: kits ≤ 520 triangles, at most 2, none downtown; jets 2 calls, 1,644 / 1,096 triangles; pumpkins,
  spray and wrecks one call each. Every new material is its own instance with a warm-up (`r-event-kit`, `r-jets`,
  `r-jets-smoke`, `r-pumpkins`, `r-tide-spray`, `r-wrecks`), and the jets appearing linked no program (92 → 92).
- Teardown: every `init*` returns an `off` that removes its frame system, sources, flags, crowds, meshes, loops, warm-ups
  and materials.
- Economy: every reward goes through lane E's ledger by source (`event:<id>`, `event:fleet-week-2026-jets`,
  `daily:<date>:1..3`, `:all`); a second visit, a second shutter or a second completion pays nothing; nothing spends coins.
  `?date=` (which could farm the daily three date by date) works only in DEV / QA builds.
- No third-party fetch: the game reads only `/opus-bay/sf/<version>/{tides,live}.json` and the catalog (test and grep).
- zh lines ≤ 45 characters (tests over every event, the daily lines, the jets, the calendar).

### Open (other lanes' files, or not worth the risk now)

- **E · `economy/today.ts`** prints the notebook's sunset with `bayHm(sunTimes(now).sunset)`: use `sunHm` from
  `realsf/sun.ts` (one word), or it stays a minute early.
- **F · `ui/Hud.tsx`**: the E prompt resolves the focused interactable only when the focus changes, so a label that changes
  in place goes stale: standing at Marina Green at 12:00 the prompt still read 看看飞行表演 after the jets were up (pressing
  E did the right thing: photo mode). Re-read it on `interactablesEpoch`. Still open from part b: the objective pill →
  `openJournal('today')` in city mode.
- **C · `ui/Journal.tsx`**: still open from part b, J / 旅行本 opening on 今天 in city mode. In English on a 390 px phone the
  six tab labels run into each other (Today 1/3Notebook, Postcards 0/24Goals); Chinese fits.
- **F · `ui/Overlay.tsx` `useTimeOfDay`** does not re-run when `worldMode` changes: after a switch to the city the sky can
  keep the district band for up to a minute.
- Unchanged from the lane's own list: kits have no walk blockers; no person has heard the loops or the roar; the jets are
  not in lane V's gate table; if the catalog arrives after a failed load the daily three are dealt again (sources go by
  index, so a done slot may show a different task — never more than the three payments and `:all`).

### Process

- **I broke the PERF-LOCK rule once**: at about 13:57 PDT one phone screenshot (≈ 45 s of headless Chrome) ran while lane
  V's W5-V11 part-c gate held `PERF-LOCK` (my check printed the lock but did not stop the command). I told the lead at once;
  any fps lane V measured in that minute should be re-run. No Chrome ran after that.
- No third-party call carried any personal data; web checks went only through the search and fetch tools.
- npx tsc, tsx and eslint all worked; nothing in `node_modules` was touched. The dev server on 5510 is stopped.

### Checks

- Code head `1ed4462f` (after three rebases onto a moving upstream): `npx tsc -p tsconfig.app.json --noEmit` 0 errors;
  `npx eslint .` 0 errors (43 old warnings outside `src/opus-bay`); the full suite
  `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1300 / 1300** on that exact tree before its push
  (earlier runs: 1267 / 1267 and 1298 / 1298 on the previous bases).
