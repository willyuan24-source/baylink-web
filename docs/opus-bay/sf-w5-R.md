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
