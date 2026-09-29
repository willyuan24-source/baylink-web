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
5. 网站新开的店：旧金山有 4 家，3 家已开业的（Sergeant Ma、Kaiyō 手卷吧、Athanor）在真实地址旁立了金色“新店”小牌子，走近按 E 看卡片、一键打开 BAYLINK 新店页；另外 28 家不在旧金山或还没开业，没放。“今天”页的优惠多了非洲侨民博物馆 10/1 免费夜场和 10/10 免费日。
6. 主人的日期都还正常：10/2–4 蓝草音乐节和卡斯特罗街区节、10/9–11 舰队周、10/31 儿童游行；11/1 起目录里没有旧金山活动（网站目录只到 10/31）。

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
- `tests/opus-bay-w5-jets.test.ts`: the jets' souvenir is asserted at index 17 (its bit in saves), not as the last id.
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
- Checks (the tree of the part-a push, before the rebase): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors
  (43 old warnings) · the suite 1380 + 4 new: all green after two fixes of my own tests (the wave-5 jets test pinned the
  jets' souvenir as the *last* id — it keeps bit 17, now asserted by index; the live.json test raced my part-b edit and
  passes alone). Re-run on the rebased head: see the push line in part b.

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

## Part b · the refreshed offers, the 今天 tab, the owner's dates (W6-S2)

Written 2026-09-29 ≈ 02:40 PDT.

### What was built

- **`live.json`** (GPT re-exported it on 2026-09-29: the same 11 San Francisco museum / park / transit offers as wave 5).
  The autumn release added 86 offers to the site data; the ones in San Francisco that belong to a place in the game and are
  free for a visit are **MoAD's two October days**, now in `scripts/opus-sf/export-live.ts` and re-exported through it (13
  offers, 4.6 KB gzip; the 11 old rows byte-identical):
  - `sf-moad-free-thursday-oct1-2026` — Thu Oct 1, 16:00–20:00, free (DJ 17–20), at the Museum of the African Diaspora
    (`places.json` `osm-n415567060`);
  - `sf-moad-thrive-second-saturday-oct2026` — Sat Oct 10, 11:00–17:00 (the Saturday hours), free.
  They appear in the 今天 tab's 今天在旧金山 on their day with the organiser's link and **BAYLINK 优惠详情** →
  `/offers/<id>`, and in `offersForPlace` for the MoAD place card (lane C's hook). `Spec.ruleCheckedAt` records that their
  hours were read on 2026-09-29 (the wave-5 rows keep 2026-09-28).
- Not taken (the export's wave-5 rule: museums, parks and transit only, never a purchase deal or a shop): the $10 opera
  tickets (`sf-opera-dolby-figaro-offer-2026`, a purchase), the trivia-night drink deal (a bar), SFPL Discover & Go and the
  radon-detector loan (library-card services, no single place).
- `tests/opus-bay-w5-calendar.test.ts`: 13 offers; the MoAD hours on Oct 1 / Oct 10 and not on Oct 8; a rule may be checked
  on 2026-09-28 or 29.

### Facts checked on the web (2026-09-29)

- MoAD visit page https://www.moadsf.org/visit: "temporarily closed … from August 17th through September 29th", reopens
  Sep 30; Tue–Wed and Fri–Sun 11am–5pm, Thu 12pm–8pm, closed Monday; "Every Second Saturday" free (THRIVE @ MoAD).
- MoAD First Thursday, Oct 1: https://www.moadsf.org/event/downtown-first-thursdays---october-1 — 4:00–8:00 PM, free
  admission, DJ 5–8 pm.

### Evidence (parts a + b, the push)

- On the head rebased onto `origin/opus-bay` (K1, G, K2, X, P landed): `npx tsc -p tsconfig.app.json --noEmit` 0 ·
  `npx eslint .` 0 errors (43 old warnings) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts`
  **1401 / 1401**. Pushed as `c9ae4fca` after one more rebase over lane B's five transit commits (files disjoint from mine;
  the part-c run covers that tree too).
- The 今天 tab in the game (phone 390 × 844 dpr 3, `?date=2026-10-01T15:30`, zh): the daily three's event task reads
  去看看弗莱明唱施特劳斯 · 交响音乐厅 · 今天 14:00–18:00 · 现在开放 — the new Davies row with the label's per-date hours (the
  label says 10/1 and 10/4 at 14:00, 10/3 at 19:30). That day has no free event, so a paid concert is the task; part c makes
  a free event win whenever the day has one.

## Part c · the new openings: a 新店 sign at the address (W6-S3)

Written 2026-09-29 ≈ 03:05 PDT.

### What was built

- The autumn release's openings (`src/data/autumn-release-openings.json`: 31 published; `docs/releases/autumn-content-2026-09-29.json`
  records 32 opening decisions): **4 in San Francisco, 3 open → 3 signs; 28 skipped** — 27 outside the city (South Bay,
  Peninsula, East Bay, North Bay) and Handroll Hawker (2360 Polk St), which the site lists as *announced* (planned for
  Sep 29, not confirmed open: a "new" sign for a shop that may not be open would mislead).

  | opening (BAYLINK id) | the site's address | OSM point (checked 2026-09-29) | sign (world u) |
  |---|---|---|---|
  | Sergeant Ma (`sergeant-ma`), waterfront restaurant | 185 Berry Street | https://www.openstreetmap.org/way/46264110 "China Basin – Berry Street Building", 185 Berry St (37.7764556, −122.3921108); the twin 185 Berry St building is way 46264108 "Wharfside" | 358.7, 208.3 (3 u from the point), on the China Basin walk |
  | Kaiyō Handroll Bar (`kaiyo-handroll-union`) | 1838 Union St | https://www.openstreetmap.org/node/693507981 "KAIYŌ", 1838 Union St (37.7979631, −122.4295323) | −205.8, 305.5 (3.6 u) |
  | Athanor (`sf-athanor-new-restaurant-2026`) | 2600 Sutter Street | https://www.openstreetmap.org/way/27054290, 2600 Sutter St (37.784889, −122.443353) | −178.5, 569.5 (2.8 u; the point falls on the toy corner of Sutter & Broderick) |

- `realsf/openings.ts` (data only): `OPENING_SIGNS` (the site's id, name, address and check date; what it is and the hours
  note, shortened from the site's text; the OSM point, URL and check date; the sign's spot and facing), `openingUrl(id,
  locale)` → `/openings/:id` (`?lang=` like every BAYLINK link), `signById`, `signFront`, `SIGN_NEAR` 260 u, `FLAG_FAR`
  320 u, `PROMPT_R` 5 u.
- `realsf/openingSigns.ts` `initOpenings()` (city mode): only the nearest sign within 260 u stands — one merged mesh
  (`eventKit.ts buildOpeningSignGeometry`: two white posts, a gold board with coral bands and a white badge that glows at
  night, a teal awning, three balloons; **180 triangles**, one geometry on the event kits' material, program key
  `ob-toy-dyn`: no new program; warmed `r-opening-sign`); a gold pennant with the shopping-bag glyph (lane N's flag layer, no
  draw call of mine) within 320 u; **E · 看看新店 · <name>** 1 u in front of the board opens the card. DEV
  `__opusRealSF.openings()` → `{ built, tris }`.
- `realsf/OpeningCard.tsx` + `realsf/openings.css` (the `realsf-opening` overlay): 新店 · 已开业, the name, what it is, the
  address, the hours note (it names the shop's own site), **BAYLINK 新店页** (the site's `/openings/:id`, new tab) and
  "BAYLINK 编辑 <date> 核对"; bottom-left like the find cards (phones: above the phone bar); ×, Esc or walking 10 u away closes
  it. Nothing is sold and no coin is paid: a pointer to the site, like the event cards.
- `realsf/index.ts` (**surgical, not in my table**: three lines): `initOpenings()` next to the dressings, `openings.off()` in
  the teardown, the DEV hook.
- `realsf/daily.ts`: the daily three's event task takes a **free** event of the day when there is one (the autumn catalog
  brings paid arena and opera nights; e.g. Oct 24 → a free event, not the Exploratorium's paid programme); a day with only
  paid nights keeps its event task (Oct 20: The Ring with the symphony).
- Tests: new `tests/opus-bay-w6-s-openings.test.ts` (3) — a sign for every open SF opening of the release and only those
  (the announced one has none), the site's address / name / check date, every sign ≤ 5 u from its OSM point; standable, off
  the road, on the walking network reachable from ferry-gate on the published city; the geometry ≤ 400 triangles, ≤ 4 u
  tall, the kit attributes; the card renders the name, the address, 新店 and `href="/openings/sergeant-ma"`, and nothing for
  an unknown id. `tests/opus-bay-w6-s-venues.test.ts` + 1: the daily event task is a free event on Oct 3, 4, 11, 17, 24, 31.

### Evidence

- Real game, dev server 5607, headless Chrome `--force_high_performance_gpu`:
  - desktop 1440 × 900, zh, `?date=2026-10-02T17:30&at=xz:357.3,209.6`: `openings()` = `{ built: 'sergeant-ma', tris: 180 }`;
    the gold board with its awning and balloons on the China Basin walk, the prompt **E · 看看新店 · Sergeant Ma**; E opens the
    card (新店 · 已开业 · Sergeant Ma · 水岸餐厅 · 185 Berry Street … · 官网：周一至周六 16:00–21:00，周日休息 · BAYLINK 新店页 ·
    BAYLINK 编辑 2026-09-28 核对) (`qa/w6/S/s3-opening-sergeant-ma-card-desktop.jpg`). A first try from 2.8 u beside the
    board gave the prompt to BAYBAY (she stands closer; the focus score is distance / radius): the prompt moved 1 u in front
    of the board with a 5 u radius, and the board turned to face the street.
  - phone 390 × 844 dpr 3, zh, Union St: `{ built: 'kaiyo-handroll-union', tris: 180 }`, the card above the phone bar, clear
    of the 跳 button (`qa/w6/S/s3-opening-kaiyo-card-phone.jpg`). Both shots still show the card's old "· 出发前以官网为准" suffix, since
    dropped because each hours note already names the shop's site.
- The card loads lazily (`React.lazy` in the overlay slot): the first full run with a static import failed two tests that
  start the realsf feature in node (`contracts` w5Features, `w5-calendar` moon) on `openings.css`; with the lazy card the
  Athanor card opens on E in the game (`qa/w6/S/s3-opening-athanor-card-desktop.jpg`, desktop, zh).
- The owner's dates in the game (dev server, `?date=`): **Oct 9 12:40** at Marina Green (phone): `jets()` = up, built, 4 jets,
  1,096 triangles, 15 soft boxes; `presence()` = Fleet Week open with its festival kit and crowd. **Nov 1 10:00** (phone, zh,
  DST over): the 今天 tab reads 11月1日 周日 · 日出 6:35 · 日落 17:11, the sunset task 16:34–17:38, and 这周 says honestly
  这周旧金山暂时没有新活动 (the catalog's SF events end Oct 31) (`qa/w6/S/s2-today-2026-11-01-dst-phone.jpg`).
- **这周去哪** in the game (phone, zh, `?date=2026-10-19T10:00`, 和朋友 · 免费就好 · 旧金山): the flyers read Thrive City 周日橄榄球观赛
  (10/25), Ferry Plaza 农夫市集 (10/20), Thrive City 免费万圣节亲子庆典 (10/24), 世界饺子节 (10/25), Portola 社区万圣节手工与游戏
  (10/23) — every one with 带我去 (`qa/w6/S/s2-week-board-2026-10-19-phone.jpg`).
- Checks on the head rebased onto `origin/opus-bay` (K2 part b, W1 / W2 the North Beach seam and corner landed): `npx tsc -p
  tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings) · the suite **1417 / 1418**, the one failure the
  known wall-clock `sf-move2` "E2-5 view field" (3.8 s under load), which passes alone (24 / 24). After the next rebase (H1 /
  H2 the Halloween city, G2 trick-or-treat, X5 faces): tsc 0 · eslint 0 errors · **1431 / 1431**.

### Decisions

1. **Signs only for open shops with an OSM-confirmed address**; the announced one waits (the site will flip its status).
2. **One sign built at a time** (the nearest within 260 u): the three are kilometres apart; at most +1 call / +180 triangles.
3. **The card is a pointer to BAYLINK** (its page, its check date) — no prices, no coins; the hours line repeats the site's
   note in a few words and names the shop's own site.
4. **Board facing and prompt**: the board faces the street; the prompt is 1 u in front of it with a 5 u radius so it wins over
   BAYBAY when the player walks up to it.

### Not done / known gaps

- Handroll Hawker (announced) has no sign; when the site marks it open, add a row (OSM: check 2360 Polk St).
- The sign has no lettering (the toy style has none; the pennant's glyph, the prompt and the card say 新店).
- Día de los Muertos: https://www.dayofthedeadsf.org/ still shows only "November 2nd, 2025" (checked 2026-09-29), and a web
  search found no 2026 date for the Mission procession (the 2025 one assembled at 22nd & Bryant on Sun Nov 2 at 7 pm, e.g.
  https://sf.funcheap.com/sf-dia-de-los-muertos-procession-mission/): `realsf/calendar.ts` keeps the row hidden. Lane H owns
  the Muertos dressing and does its own check.

### Requests

- **Lead / reviewer**: `realsf/index.ts` got three surgical lines (above); lane R's wave-5 tests of my modules
  (`tests/opus-bay-w5-jets.test.ts`, `-events.test.ts`, `-calendar.test.ts`) were updated as described in parts a / b.
- **H**: Día de los Muertos 2026 has no published date yet (above); if you dress 1–2 Nov, grade it "usually", as the
  calendar would.
