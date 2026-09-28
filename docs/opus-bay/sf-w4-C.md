# Wave 4 · lane C · Content & tours

Lane C of wave 4 (plan `sf-w4-plan.md` §5.6, lead note `sf-w4-lead.md`). Worktree `C:/Users/willy/wt/w4-c`, branch
`w4-c`, scratch `C:/Users/willy/opus-qa/w4/w4-c/`.

## Early phase

### 给主人的摘要

1. 124 个新景点的介绍卡全部写好：64 张完整卡（你点名的大学、石镇，加上金门公园、联合广场、现代艺术博物馆、动物园等）+ 60 张简卡。每条事实今天（9 月 27 日）都重新上网核对过，带出处和核对日期；开放时间一律写"约 / 出发前查官网确认"，关门或施工的都写明了（海德街码头、花园角、悬崖屋、双峰步道、城市学院的里维拉壁画要到 2028 年才展出、加州艺术学院明年停办……），不提熊猫。
2. BAYBAY 在观光巴士、N 线 M 线和一日游里说的话已经定稿并"冻结"（107 句：16 站 × 进站前 / 到站 / 下车提示，地铁 14 句，5 章开场和收尾，31 个新景点的抵达台词，4 句纪念地的轻声台词），打了标签 `w4-tourlines-frozen`，V 线可以直接录音。
3. "环游旧金山 · 一日游"的数据做好了：5 章 23 站，按游戏里真实的车速和步行速度算，完整版约 26 分钟，快速版约 17 分钟（只在金门大桥、双峰、州立大学下车，地铁长段"直接到站"，观光巴士照常讲解）。路上顺便诚实完成金门大桥、双峰（最后一段走上去）、叮当车、彩绘女士，以及新的观光巴士、地铁、校园目标。
4. "抵达时刻"、行程状态机、一日游结束的回顾面板都已做成独立模块并有测试；现在还没接进游戏（第三波还在收尾），接线步骤写在下面。
5. 另外给恶魔岛、金门公园、要塞公园、克里西场、39 号码头这 5 个没有介绍卡的著名地点补了完整卡。检查全部通过：tsc 0、eslint 0、opus-bay 全套测试通过（新增 3 个测试文件 32 项）。Higgsfield 本线一分没花。

### What was built

All new files (early phase: no existing file edited). Commits on `opus-bay`: `eb3651c` (W4-C5 cards), `9d9dab9` (W4-C3 /
W4-C4 frozen lines + tour, **tag `w4-tourlines-frozen`**), `cce8d8c` (arrival, trips, recap), `abc1b29` (ids follow lane
P), `d63856f` (tour geometry = lane T's published lines), `c308d86` (curated cards, Metro narration), `e8dc50f` (this
report), `5fec3c4` (T's re-bake of the N / M termini, caught by the pin test and re-synced).

| file | what | API |
|---|---|---|
| `src/opus-bay/data/sf/placeCardTypes.ts` | eager, small: card types, limits, validator, card → PoiDef, **lazy loader** | `PlaceCard`, `CardStatus`, `CardRefresh`, `CARD_LIMITS` (bark 45, summary 100, tip 64, hours 72, cost 56, status 64 · zh bubble width), `zhWidth()`, `placeCardProblems(card)`, `cardPoiId(card)` (`sf:<place ?? id>`), `placeCardPoi(card, at, photo?)`, `indexPlaceCards()`, `loadPlaceCards()` (dynamic imports of the two chunks, once), `placeCardsNow()`, `placeCardNow(id)` |
| `src/opus-bay/data/sf/placeCards.ts` (lazy) | 64 full cards, priorities 1–3 in the plan's build order (Stonestown, SF State first) + `CARD_REFRESHES` for the 10 built landmarks that become stops | `PLACE_CARDS`, `CARD_REFRESHES` |
| `src/opus-bay/data/sf/placeCards2.ts` (lazy) | 60 short cards, priority 4 + 5 full cards for the famous curated places without one (Alcatraz, Golden Gate Park, Presidio, Crissy Field, PIER 39; lane P ids) | `PLACE_CARDS_2`, `CURATED_CARDS` |
| `src/opus-bay/data/sf/tourLines.ts` | **FROZEN 2026-09-27** texts (107 lines) + narration pickers | `LOOP_STOP_LINES` (T's `loop-*` ids → `{ look, side, approach, arrive, hopOffTip }`), `METRO_LINES` (14), `CHAPTER_LINES` (5 × intro / outro), `ARRIVAL_LINES` (31 new T1 / T2 = the card barks), `QUIET_LINES` (4), `TOUR_LINES` (recording order), `tourLine(id)`, `loopNarration(event)`, `loopHopOffTip(station)`, `metroNarration(event)` (board / approach / arrive by direction), `tunnelNarration(line, fromAt, toAt)` (subway overlay) |
| `src/opus-bay/data/sf/tours.ts` | the city tour engine's data + timing model + save decoder | `CityTourDef` / `CityTourChapter` / `CityTourStop` (target `sf:` / `place:` / `transit-`, leg walk / line, moment, goal, postcard, optional, express skip / expressTo, lines, minutes, expressMinutes), `SF_GRAND` (`sf-grand`), `CITY_TOURS`, `cityTour(id)`, `TOUR_GEO` (= lane T's `transit-w4.json` + today's California cable stations), `TOUR_TARGET_AT`, `TOUR_MODEL`, `targetAt`, `rideArc`, `rideSeconds`, `stopSeconds`, `tourStops(def, { express, optional })`, `chapterMinutes`, `expressRide`, `tourResumeLabel` ("继续一日游 · 第 3 章"), `TourProgress`, `decodeTourSaves(raw)` (save v2 `tours`, ≤ 8 ids, clamped, unknown stops dropped) |
| `src/opus-bay/game/arrival.ts` | arrival moments, pure (plan §4.2) | `ArrivalWatcher(anchors, seen)` `.step(sample) → ArrivalHit | null`, `.seen()`, `.hintSuppressed(now)` (60 s), `arrivalAnchors(ATTRACTIONS)`, `arrivalBeats(hit, ctx) → { toast, line, voice, mood, reveal, peek, stamp, stampSound, postcardHint, panorama, discover }`, `defaultArrivalLine(id)` |
| `src/opus-bay/game/trips.ts` | trip state machine on the frozen `TripState`, pure | `tripReducer(state, action)` (start / leg-arrived / skip-leg / replan / cancel / clear), `tripEvents(prev, next, action)` (`trip` start / leg / end / cancel), `currentLeg`, `isArrived`, `legTarget(leg, 'approach' \| 'underway')`, `tripRemaining`, `durationText` ("约 3 分钟"), `tripPillText(trip, name)` (≤ 16 CJK), `walkLeg`, `freeLeadTrip` (startFreeLead as a one-leg trip), `tourStopOption(stop, prev)` (a tour stop as a `TripOption`), `pickObjective` (freeLead > trip > tour > week > mapTarget > freeHint), `createTripStore()` |
| `src/opus-bay/ui/TourRecap.tsx` | the Grand Tour recap panel, prop-driven (reuses `.ob-recap*` CSS) | `<TourRecap tour completed postcards stamps express? stopName? onClose onOpenMap? onKeepExploring? mapSlot? />` |
| `src/opus-bay/ui/tourRecapModel.ts` | pure model of the recap's route sketch | `tourRecapModel(tour, completed, names?)`, `RECAP_COLORS` |
| `tests/opus-bay-sf-cards.test.ts` | 9 tests | cards ↔ attractions.json, validator, positions / place ids, guides / planner / photos exist, hedged hours, closures, quiet places, never-say list, refreshes, arrival lines = barks, loader laziness |
| `tests/opus-bay-sf-tours.test.ts` | 12 tests | tour lines limits / sources / **frozen snapshot**, loop side words vs measured side, Metro / chapters / arrivals, sf-grand targets resolve, legs reachable in order, TOUR_GEO = transit-w4.json, minutes = model, goals / postcards, stop lines, save decoder, Metro narration |
| `tests/opus-bay-sf-arrival.test.ts` | 11 tests | watcher (radius, re-arm, hop-off grace, fast travel, busy, overlaps, grid, hint quiet, seen), beats (T1 reveal, T2, T3, quiet), anchors from ATTRACTIONS, trip reducer / events / pill / free lead / priority / store / tour-stop options, recap model |
| `docs/opus-bay/qa/w4/C/w4-grand-recap-mock-phone.jpg` | the recap panel rendered server-side with the real CSS at 390 px (portrait image absent in the file:// mock) | — |

### Evidence

- Checks on the pushed head: `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint src/opus-bay tests/opus-bay-*` 0 ·
  full suite **547 / 547** at `5fec3c4` (an earlier run under load had the two known wall-clock flakes, `sf-citymap`
  "draw … fast" and `sf-nav` A*, both green alone). Lane C's 3 files: 32 tests, all green.
- **Facts re-checked on the web today** (about 110 fetches / searches of the primary pages: sfsu.edu, stonestowngalleria.com,
  ccsf / CCSF FAQ, realestate.ucsf.edu, calacademy.org, gggp.org (admissions page), sfzoo.org, sfmoma.org,
  yerbabuenagardens.org, ferrybuildingmarketplace.com, cablecarmuseum.org, asianart.org, maritime.org, randallmuseum.org,
  presidio.gov, fortmason.org, waltdisney.org, tjpa.org, missiondolores.org, sfpublicworks.org (Harvey Milk Plaza),
  sfrecpark.org (Portsmouth Square, Koret, Blue Heron Lake, bison, India Basin, Huntington, Ina Coolbrith, Seward), nps.gov
  (Lands End, Ocean Beach, Maritime / Hyde St Pier), moadsf.org, streetcar.org, tenderloinmuseum.org, chsa.org,
  creativity.org, aquariumofthebay.org, ssjeremiahobrien.org, goldengatefortunecookies.com, glide.org, sfpalace.com,
  growsf.org (Prop G), Wikipedia for history). **Where a primary page differed from the scouting, the page won:**
  - SF Zoo: "more than 1,500 animals" (JSON: > 1,000); the train is out of service; nothing about pandas anywhere.
  - Mission Dolores: open **daily** (Mon–Fri 10–4, weekends 10–5; JSON said closed Mondays) → refresh.
  - Harvey Milk Plaza rebuild: construction **spring 2027 → winter 2028, $22M** (JSON: late 2026, $25M) → card status.
  - SF State: its student centre "was named the Cesar Chavez Student Center until 2026 … awaiting a new name" → no
    building name in the card (Request to L below).
  - Blue Heron Lake pavilion: Rec & Park gives 1976 and 1981 → "given by Taipei", no year.
  - Bison: 1891 (SF Zoo) vs 1892 (Rec & Park) → "since the 1890s", paddock 1899; herd size not given.
  - National AIDS Memorial Grove: 7.5 acres (Wikipedia) vs 10 acres (the Grove's site) → no size.
  - Lyon St Steps (288 vs 332 steps), Chinese Telephone Exchange (800 phones vs 1,500 lines), Tadich's name year,
    the Opera House seat count, the Bowes Center storeys → left out.
  - Castro Theatre reopening: Feb 2026 (the day differs between summaries) → "2026 年 2 月".
  - MoAD: closed through 29 Sep 2026, reopens 30 Sep (status `changing`, until 2026-09 → re-check after).
- Cards: 124 / 124 + 5 curated, 0 validator problems; longest bark 32 zh, longest summary 79.5, longest tip 44. 10 cards carry a
  status (closed: Hyde Street Pier, Portsmouth Square; works: UCSF Parnassus hospital, CCSF mural centre, Harvey Milk
  Plaza, India Basin; changing: CCA closing, Sunset Dunes / Prop G, MoAD, Tenderloin Museum move) + Cliff House (closed)
  and Twin Peaks (Promenade works) in the refreshes.
- Tour: 5 chapters, 23 stops (+ 2 optional: Fort Point, the deck walk), **26.1 min** full (bay 3.6 · coast 4.6 · N 5.6 ·
  M 4.2 · peaks & downtown 8.1), **17.2 min** express (16 stops); a loop lap models at 13.5 min (plan: ≈ 14). Chapter
  intros / outros (10 bubbles) come on top.
- Loop side words measured on the plan's route 45 u before each stop (`C:/Users/willy/opus-qa/w4/w4-c/sides.mjs`):
  GGB tower right (+39°), windmill left (−86°), de Young left (−53°), Painted Ladies left (−47°), the rest ahead → "前面".
- Recap panel: `docs/opus-bay/qa/w4/C/w4-grand-recap-mock-phone.jpg` (390 px, dpr 2, the real `.ob-recap` CSS; I read
  it: title, route sketch in line colours, chapter chips 3/3 · 5/5 · 5/5 · 0/4 · 0/6, 4 stat tiles, two buttons, no
  overflow).

### Decisions

- **Cards are two lazy chunks** behind a 6 KB eager module: 124 cards of bilingual text never enter GameRoot or the city
  chunk until `loadPlaceCards()` runs (the city start). Keyed by the attraction id; `place` = the row attractions.json /
  lane P's ATTRACTIONS decorate (identical for all 124).
- **One recorded arrival line per new T1 / T2** = the card's `bark`, word for word (tested), so the bubble and the voice
  never disagree. The built landmarks keep their existing card barks as text bubbles (not recorded in wave 4: their
  text lives in lane L's `landmarks.ts`, and recording it would freeze another lane's file).
- **tourLines freeze = a snapshot test** (`sha256(id + zh + en)`), plus the git tag. A new wording must be a new id.
  Non-text fields (`look`, `side`, sources, pickers) may still change.
- **Express = skip the side hop-offs and 直接到站 on Metro legs > 400 u only**; the bus and the cable car ride in real
  time so BAYBAY's narration (the point of the tour) stays. This gives 17.2 min (plan ≈ 18). Veiling every leg > 400 u
  (the plan's literal rule) models at ≈ 9.5 min and skips all the narration.
- **Honest times:** the declared minutes are the timing model's (test within 0.15 min); the welcome subtitle is
  "全城 5 章 · 约 26 分钟 · 随时下车". Moments: arrive 20 s, photo 25 s, panorama 45 s (the reveal + toast + line take
  ≈ 15–20 s).
- **Tour route:** Ferry → bus → GGB (Welcome Center moment; Fort Point and the deck walk optional) → bus → Lands End
  (Sutro Baths) → bus → Ocean Beach windmill (photo) → walk to N La Playa → N → 9th & Irving (Tea Garden) → N through
  the Sunset Tunnel → Duboce & Church → Painted Ladies (photo goal) → Church station → M → 19th & Winston (Stonestown) →
  walk to SF State (campus moment) → M from Holloway → Castro → bus → Twin Peaks (BAYBAY leads the last 38 u on foot:
  the twin-peaks goal counts) → bus → Chinatown → walk up to California & Powell (cable-car postcard) → California
  cable car 161 u to Drumm (> 150 u: the cable-car goal) → Ferry Building.
- **Arrival rules:** max(12, r) trigger, re-arm beyond 1.6 r, nearest anchor wins and its overlapping neighbours count
  as visited-inside (no double moments at the Music Concourse), hop-off grace 8 s, fast travel never, busy holds (still
  inside → fires when free). T3 → event + stamp, no toast / line / peek; quiet places → plain name, soft mood, no stamp
  sound, no reveal; reveal only for T1 on foot (not right after hopping off).
- **Trips:** a new trip over an unfinished one emits `cancel` then `start`; `replan` emits `start` (same place, new
  mode); an arrived trip emits nothing on cancel and waits for `clear` after its arrival moment.
- **Metro narration by direction** (`dir`): inbound at Carl & Cole → "前面是日落隧道"; outbound → "钻出日落隧道"; the short
  Sunset Tunnel overlay itself says nothing (no double line).

### Integration plan (after "wave 3 verified"; lane C owns these files then: plan §5.1)

> **Corrected by the Early review below** (items 1, 3, 4, 5, 6, 10 and the request to lane G): read "Integration
> changes" there before wiring.

1. **`game/flow.ts` — trips** (after the lead adds `trip: TripState | null` to `FlowState`): `startTrip(option, placeId,
   { attraction, source })` = `const prev = flow.get().trip; const next = tripReducer(prev, { type: 'start', … now:
   performance.now() }); flow.set({ trip: next }); tripEvents(prev, next, action).forEach(emit)`; the same pattern for
   `tripLegArrived()` (`leg-arrived`), 跳过这一站 (`skip-leg`), 换个方式 (`replan` with lane G's `planTrips` result), 结束
   (`cancel`) and after the arrival moment (`clear`). `objectiveTarget()` = `pickObjective({ freeLead, trip, tour, week,
   mapTarget, freeHint })` and for `trip` the point `legTarget(currentLeg(trip), riding ? 'underway' : 'approach')`.
   `startFreeLead(id)` also sets `flow.trip = freeLeadTrip(player, { ...target, place: id }, now)`. Line legs board
   through lane T's pre-filled `boardLine(leg.board, { to: leg.alight })`. `flow-*` tests updated on purpose
   (objectiveTarget with a trip; the soft hint suppressed during trips).
2. **`game/brain.ts`** `lead()`: target from `legTarget(...)` of the current trip leg; the LeadChip for trips on touch
   (lane G's chip).
3. **Arrival moments** (`game/cityContent.ts` `initCityContent`, city only, lazy): `import('./arrival')` →
   `new ArrivalWatcher(arrivalAnchors(ATTRACTIONS), save.arrivals ?? [])`; step it at 4 Hz from a city system with
   `{ x, z, now, onFoot: move.mode === 'foot' || move.mode === 'photo', hoppedOffAt (vehicle:exit / transit alight),
   busy: dialogue || panel || cinematic, travelling: travelActive() }`. On a hit: `emit(hit.event)`,
   `beats = arrivalBeats(hit, { reducedMotion, qualityLow: quality === 'low', postcardNear })` → a new FlowState field
   `arrival: ArrivalBeats & { attraction, place } | null` for lane G's ArrivalCard / reveal; `bubble(beats.line)` + the
   `voice-line` event with `beats.voice`; discover the place; journal stamp. `flow.nextFreeGoal` / the soft hint check
   `watcher.hintSuppressed(now)`. Save v2 gains `arrivals: string[]` (`watcher.seen()`), decoded like `tours`.
4. **Cards** (`data/sf/cityPois.ts`): call `loadPlaceCards()` from `initCityContent`; `placeCardTarget()` first checks
   `placeCardsNow()?.byPlace.get(placeId)` and opens `sf:<placeId>` as `placeCardPoi(card, attraction.arrival ??
   attraction, photo)` (photo = the `-small.webp` + credit + license of `src/data/sf-landmark-photo-assets.json[photoKey]`,
   like `CITY_PHOTOS`); `interactables.poiById` resolves those ids through a registered resolver (as the subject
   resolver). Apply `CARD_REFRESHES` inside `cityPoi(info)`: `status.text` first among the tips, `hours` / `cost`
   replaced, `addTips` appended, sources appended to `CITY_POI_EXTRA_SOURCES`. `sf-content` counts updated on purpose
   (24 landmark cards unchanged; + a count of 124 place cards). Hero places merged with a district POI
   (`ferry-building`) keep the district card: add the marketplace card's farmers-market hours as a tip there.
5. **Tours** (`game/flow.ts` tour engine, `game.tour.id`): when `tourIdOf(game.get().tour) === 'sf-grand'`,
   `tourStops()` walks `tourStops(SF_GRAND, { express })`; each stop leads by `stop.leg` (walk → today's lead; line →
   lead to `leg.from`, pre-filled boarding, ride, `leg.to`); `stop.lines` are frozen ids (`tourLine(id)`, voice) or
   plain bubbles; `stop.moment` → the arrival beats / photo / panorama; chapter intro / outro from `CHAPTER_LINES`;
   progress saved per id in save v2 `tours` (`decodeTourSaves` on load); resume label `tourResumeLabel`. FIRST_TOUR stays
   byte-identical (district). Transit narration: on `transit` events `loopNarration(e) ?? metroNarration(e)` → bubble +
   voice; at the subway overlay start lane T calls `tunnelNarration(line, fromAt, toAt)`; the hop-off chip shows
   `loopHopOffTip(station)`.
6. **Recap** (`ui/Overlay.tsx` 'recap' panel): `tourIdOf(tour) === 'sf-grand'` → `<TourRecap tour={SF_GRAND}
   completed={tours['sf-grand'].completed} postcards={{ found: activePostcardCount, total: activePostcardTotal() }}
   stamps={…} express={…} onClose={closePanel} onOpenMap={() => openPanel('map')} mapSlot={lane P's recap map} />`,
   else the district `<Recap />`.
7. **Entry points** (W4-C7): city welcome choice 1 "刚来湾区，带我认识一下" → start `sf-grand` (subtitle from
   `SF_GRAND.subtitle`); call menu "带我环游旧金山（约 26 分钟）" / "坐观光巴士" / "坐地铁去海边 / 去石镇和州大"; Bay 101
   stays in the call menu as "海边 7 站".
8. **Goals** (W4-C8, `data/sf/goals.ts` + `game/cityGoals.ts`): `sightseeing`, `metro`, `campuses` (the ids the tour
   stops already carry); `sf-content` goal count 7 → 10 on purpose.
9. **Voice** (lane V): clips `<lang>-<id>` for `TOUR_LINES` registered in `data/voiceLinesSf.ts`.
10. **`data/VOICE.md`** gains the wave-4 glossary rows: 石镇购物中心 (石镇; alias 石头城), 旧金山州立大学 (州立大学 / 州大),
    旧金山大学, 加州大学旧金山分校 · 帕纳萨斯 / 米慎湾, 旧金山城市学院, 蓝鹭湖（原斯托湖）, 迪扬博物馆, 观光巴士, N 线 / M 线,
    内河码头站, 叮当车 (unchanged), 都板街 (Grant Ave), 克莱门街 (Clement St; 企李街 is Clay St, review R1), 尔文街 (Irving St); and R11: SFMTA's own
    Chinese station names could not be found on sfmta.com today (checked the zh-hant site); the local forms 卡斯楚 /
    雲尼斯 differ from our 卡斯特罗站 / "Van Ness 站", which stay.

### Not done (early phase)

- Everything that edits existing files (items 1–10 above).
- W4-C7 / W4-C8 / W4-C9 / W4-C10 shots (tour intro, hop-off at the Palace, Stonestown arrival, SF State campus moment,
  recap map in game, a card on the phone, the goals card) — they need the integration.

### Known gaps

- `TOUR_GEO` is a copy of `transit-w4.json` (the tour times are synchronous); the pin test fails on a re-bake. The
  tools are in `C:/Users/willy/opus-qa/w4/w4-c/`: `geo-sync.mts` copies positions / arcs from the published file,
  `tour-patch.mts` re-derives the declared minutes, `tour-times.mts` prints model vs declared (run them from a folder
  inside the worktree so the relative imports resolve).
- The recap route is a station-to-station sketch, not the exact track (lane P's map replaces it via `mapSlot`).
- `TripLineLeg.stops` from `tourStopOption` counts the TOUR_GEO stations (the majors), not every request stop.
- The MoAD card status ends 2026-09 (reopens 30 Sep): re-check in the final verify with the other time-sensitive cards
  (Sunset Dunes after 3 Nov 2026, Cliff House, Harvey Milk Plaza, CCA).

### Requests

- **Lead (frozen files):** (a) `core/events.ts` `transit` event: add `dir?: 1 | -1` (the ride's direction along the arc)
  so `metroNarration` can tell "entering" from "leaving" the Sunset Tunnel; (b) `core/types.ts` `DialogueAction`
  `{ type: 'start-tour'; tourId?: string }` so the welcome choice can start `sf-grand`; (c) with `flow.trip`, a
  `FlowState.arrival` field (lane C's after integration) for the arrival beats.
- **Lane V:** record `TOUR_LINES` (107 lines, tag `w4-tourlines-frozen`, `data/sf/tourLines.ts`) as `<lang>-<id>`; moods
  are in the data; `QUIET_LINES` and `arrive-mount-davidson` softly.
- **Lane T:** emit `transit` `board` / `approach` (≈ 60 u) / `arrive` for `sf-loop`, `n-judah`, `m-ocean-view` with the
  station id (and `dir` once added); call `tunnelNarration(line, fromAt, toAt)` when the subway overlay starts; the
  station ids and arcs are pinned by `tests/opus-bay-sf-tours.test.ts` (tell lane C on a re-bake).
- **Lane L:** SF State's student centre lost the Cesar Chavez name in 2026 and awaits a new one (Wikipedia, checked
  today): no name on the model or in props; the plan's build note "(Cesar Chavez)" is only a shape reference. CCSF: the
  Rivera mural is in storage until ≈ 2028 (no mural on any wall).
- **Lane G:** the ArrivalCard / reveal consume `arrivalBeats()`; the trip pill can use `tripPillText` / `durationText`.
- **Lane P:** nothing blocking; the card ids / `place` fields equal your ATTRACTIONS rows (except the built stops, which
  keep their landmark cards).

## Early review

Adversarial review of the early phase (2026-09-27), worktree `C:/Users/willy/wt/w4-c`, scratch
`C:/Users/willy/opus-qa/w4/w4-c/review/`. Four `W4-C-review:` commits (cards; Grand Tour; arrival, trips, recap; this
report); all on new lane-C files, no existing tracked file edited.

### 给主人的摘要

1. C 线早期的新文件全部复查了一遍，并上网抽查了 26 条事实、4 个坐标、2 个街名：事实基本都对，只有一处用错了——“企李街”其实是唐人街的 Clay 街，Clement 街应叫“克莱门街”，卡片已改（P 线的地图名称也要跟着改）。
2. 找到并修好 16 个问题，最要紧的几个：金门大桥、艺术宫等 28 个老地标“抵达”时 BAYBAY 一句话都不说；沿台阶走上科伊特塔时，旁边的小景点会把科伊特塔的抵达时刻和全景“抢走”；站在 33 号码头的望远镜旁会误报“抵达恶魔岛”；快速版把地铁那段“直接到站”，地铁目标就不算数了（现在这一段真坐，快速版约 18 分钟，正好是计划的时长）；快速版下车时 BAYBAY 会报错站名。
3. 另有 10 件事要别的线或接线时处理，写在下面。检查全部通过：tsc 0、eslint 0、全套 601 个测试通过，Higgsfield 0 分。

### What I checked

- Read `sf-w4-lead.md`, plan §3–§5.6, this report and every lane-C file: `placeCardTypes.ts`, `placeCards.ts` (64 cards
  + 10 refreshes), `placeCards2.ts` (60 + 5 curated), `tourLines.ts` (107 frozen lines + pickers), `tours.ts`,
  `game/arrival.ts`, `game/trips.ts`, `ui/TourRecap.tsx`, `ui/tourRecapModel.ts` and the three tests; and the files the
  integration plan names (`game/flow.ts` objectiveTarget / startFreeLead / goal words, `game/transit.ts` finishRide /
  leaveLineRide, `game/cityGoals.ts` + `cityLive.ts` detectors, `data/sf/cityPois.ts`, `data/sf/places.ts`
  buildPlaceIndex, `game/discovery.ts` place resolver, lane G's `game/tripPlan.ts` / `ui/guideText.ts` /
  `ui/ArrivalCard.tsx`, lane T's `stationNames.ts`, lane P's `attractions.ts` / `extraPlaces.ts`).
- Ran the runtime place index (landmarks + district POIs) against every card's `place`, every T1 / T2 attraction
  through the arrival-line resolver, the offWalk / overlapping anchors, the tour targets against the interactables they
  resolve to, and the timing model after each change (scratch scripts `places-check.mts`, `attr-check.mts`,
  `target-check.mts`, `tp-check.mts`, `tour-minutes.mts`).
- **Facts re-checked on the web today (26 facts, 4 coordinates, 2 names; one wrong):** Stern Grove festival from 1932
  (annual since 1938) and Pine Lake a natural lake (Wikipedia) ✓ · Lake Merced 650 acres (Wikipedia) ✓ · Fort Funston the
  only off-leash GGNRA park, Battery Davis 1936–39 (Wikipedia) ✓ · CHSA open Wed & Sat 10–5 (chsa.org) ✓ · Blue Heron
  Lake renamed 18 Jan 2024 (sfrecpark 1696) ✓ · Conservatory 10–4:30, closed Wed, Jan–Feb maintenance; Tea Garden last
  entry 5:30 / 4:30, free Mon / Wed / Fri 9–10; Botanical Garden free 7:30–9 and 2nd Tue (gggp.org) ✓ · Mission Dolores
  Mon–Fri 10–4, weekends 10–5 (missiondolores.org) ✓ · Cable Car Museum free, closed Mondays ✓ · Yerba Buena Gardens
  6am–10pm, MLK memorial vandalized Feb 2026 and restored ✓ · Hyde Street Pier closed (4 Nov 2024), ships at Mare
  Island, Vallejo (nps.gov) ✓ · Portsmouth Square closed 10 Jun 2026 → mid-2028 ✓ · Twin Peaks Promenade works from May
  2026, opening mid-2027 ✓ · Prop G (3 Nov 2026) reopens the Upper Great Highway most of the week ✓ · CCA ends after
  2026–27, Vanderbilt takes the campus ✓ · Helen Diller Hospital 15 storeys, 2030 ✓ · SF State 21,000 students ✓ · MoAD
  closed 17 Aug–29 Sep 2026, $15, Thu to 8pm ✓ · Koret carousel $2.50 / $1, 1888, 1914 Herschell-Spillman, 62 animals ✓ ·
  Harvey Milk Plaza spring 2027 → winter 2028, $22M ✓ · Salesforce Park hours, 5.4 acres, 600 trees, half-mile loop,
  gondola at Mission & Fremont ✓ · SS Jeremiah O'Brien Pier 35, daily 10–4, $20 ✓ · Academy of Art 5,498 students
  (fall 2024), 1929 ✓ · coordinates (Nominatim): Tin How Temple, Stonestown, Holy Virgin Cathedral, Musée Mécanique all
  within 0.0002° ✓ · street names: 企李街 = **Clay St** (Wikipedia's Chinatown street table) ✓ for the CHSA card, ✗ for
  Clement St, which is 克莱门街 / 新华埠 (zh.wikipedia 列治文區) → R1.

### Defects found and fixed (with tests)

| # | defect | fix |
|---|---|---|
| R1 | `clement-street` card named Clement St 企李街 — that is Clay Street (the lane's own CHSA card says 唐人街 · 企李街 = Clay St) | 克莱门街 in name + bark; test: 企李街 only with Clay St |
| R2 | `japan-center` decorated the Peace Pagoda **landmark's** place row, `ferry-building-marketplace` the Ferry Building **district-POI** row; integration step 4 ("placeCardTarget first checks byPlace") would replace those cards, and both `sf:<place>` POI ids collided with the place ids | `sharesPlace` (opens as `sf:<id>`, does not claim the row), `placeCardForPlace` (landmark → district POI → card → generic), `placeCardByPoiId`; test against the runtime place index |
| R3 | `loadPlaceCards` cached a rejected import forever (a failed chunk on a phone = no cards until reload) | `createCardLoader` retries after a failure; test |
| R4 | `goal: 'sightseeing'` on a 4-stop ride (the goal needs 8 loop stops); `goal: 'campuses'` on SF State although the goal needs 3 campus arrivals and the tour has 1 — the early report's "the tour completes … campuses" was not true | `goal` only where a goal completes (sightseeing on the Twin Peaks ride, where the loop stops reached sum to `SIGHTSEEING_STOPS` = 8 in both versions); new `advances` (campuses, the early sightseeing rides); tested by counting |
| R5 | express veiled the metro-goal ride (Church → Holloway, 直接到站): today's skip never counts a ride (`transit.ts` leaveLineRide), so the express never completed the metro goal | a ride that completes a goal is never veiled; express **17.2 → 18.3 min** (plan 18 ± 3), full 26.1 → **25.9** (subtitle still 约 26 分钟) |
| R6 | express riders got off at the windmill / Holloway but heard "天涯海角到了！" / "下一站 19th Ave & Winston…"; the full tour also said 下一站 on arriving at Winston | `lines.expressArrive` (the windmill's frozen arrival line; a Holloway bubble), a Winston arrival bubble; test: arrival lines never say 下一站, a loop line matches the station really reached |
| R7 | `TOUR_TARGET_AT` did not match what the engine leads to: `sf:golden-gate-bridge` 54 u from the card spot, Painted Ladies 15 u, Fort Point 7.5 u; Stonestown / SF State used the badge anchor, not the row's `arrival` (8.5 u) | `sf:` targets read `LANDMARK_ARRIVALS`; `place:` targets = the row's arrival (re-anchors honoured); pin test; minutes re-derived |
| R8 | `metroNarration` without `dir` (not in the frozen event yet) used the outbound words — on the tour's **inbound** N / M rides BAYBAY would say "钻出日落隧道！" before entering it and "出隧道啦！这里是西门" while going in | portal lines only with an explicit `dir`; silent otherwise; test |
| R9 | the nearest anchor won even when it was a T3: walking up the Greenwich Steps (8 u from Coit) fired the steps' T3 hit and marked Coit "inside" — Coit's T1 moment and panorama lost (also Musée / Pampanito vs the Wharf, Maiden Lane vs Union Square) | tier first, then distance; tests (synthetic + the real Coit / Greenwich pair) |
| R10 | 28 T1 / T2 built places (GGB, Palace, Painted Ladies, Twin Peaks, City Hall, Coit …) had no arrival line (`defaultArrivalLine` knew only frozen lines and wave-4 cards) | anchors carry `landmark`; fall back to the landmark card bark (glossed, `CITY_SUBJECT_FACTS`) and the district POI bark; only Bay Bridge and Marina Green stay silent (no card anywhere: O3); test |
| R11 | Alcatraz (T1) and Treasure Island (T2) are `offWalk`, anchored at the Pier 33 / Pier 14 telescopes: standing on the Embarcadero fired "抵达 · 恶魔岛", the T1 reveal and the fly unlock | offWalk places get no anchor; test |
| R12 | `game/trips.ts` imported `data/sf/tours` (+ the frozen lines): ≈ 23 KB gzip would enter the main graph with the reducer (flow.ts; GameRoot is already over its 250 KB budget) | `tourStopOption` moved to the new lazy `game/tourTrips.ts`; source-scan test that trips.ts has no runtime tour import |
| R13 | `tripPillText` / `durationText` duplicated lane G's shipped `ui/guideText.ts` tripPillText / `game/tripPlan.ts` tripTimeLabel with other rounding ("不到 10 秒" vs "约 8 秒") and a budget that counted spaces and digits as full CJK (旧金山州立大学 → 旧金…) | removed from trips.ts (one rule: lane G's); `tripRemaining` and the walk speed come from `tripPlan` |
| R14 | tour legs had no point names, so lane G's pill (it reads `leg.to.name`) would say "下一站 目的地" | `tourStopOption` names stations (`w4StationName`, the two California cable stops) and targets through a `nameOf` resolver; test |
| R15 | the recap ignored `express`: a finished express run showed 16 / 23 and never 全城都能飞了, and drew the skipped side trips | `tourRecapModel(…, express)` counts and draws the version played (merged rides to `expressTo`); test |
| R16 | `legTarget` dropped the point's name that `objectiveTarget()` needs for the waypoint label | name passed through; test |

Tests: lane C's three files 32 → **42** tests (cards 12, tours 14, arrival 16), all green. Frozen tour lines untouched
(snapshot `a799f903365d56e8` holds; the `metroNarration` change is a picker, not a text).

### Open (not fixed here)

- **O1 · lane P (and the lead for the plan / JSON):** `attractions.ts` `clement-street` (name, `short`, `aliases`) and the
  `extraPlaces.ts` row still say 企李街; the map label and search would show Clay Street's name. Use 克莱门街（列治文区“新华埠”）
  / short 克莱门街, and keep 企李街 out of the aliases. Same row 59 in `sf-w4-plan.md` §2.4 and `sf-w4-attractions.json`.
- **O2 · frozen line (lane V / owner):** `metro-sfsu-next` "下一站 Holloway，州立大学到了！" mixes 下一站 and 到了 (reads
  oddly). It is frozen; if V has not recorded it yet, add a new id (e.g. `metro-sfsu-next-2` "下一站 Holloway，州立大学就在路边！")
  and point `metroNarration` at it; otherwise keep it.
- **O3 · cards:** Bay Bridge and Marina Green (T2, lane P `treatment: 'card'`) and Treasure Island have no card anywhere,
  so their arrival moment has no line and the map shows the generic place card. Three short cards at integration.
- **O4 · lane T:** the plan says 直接到站 counts as a ride; today's `leaveLineRide` never counts a skip. The tour no longer
  depends on it for a goal (R5), but W4-C8's sightseeing goal ("直接到站 counts") needs T's generalisation. `dir` on the
  transit event (lead request (a)) stays needed: until then the portal lines are silent (R8).
- **O5 · integration budget:** `data/sf/tours.ts` + `tourLines.ts` ≈ 23 KB gzip. The city tour engine, `game/tourTrips.ts`
  and `ui/TourRecap.tsx` must load lazily (`import('../data/sf/tours')`, `React.lazy`), never statically from flow.ts /
  Overlay.tsx.
- **O6 · integration, no double lines:** a tour stop's `arrive` is often the same frozen line the transit narration picks
  for that stop (`loop-golden-gate-bridge-arrive` from `loopNarration` and from the stop; `metro-board-n` as the lead and
  from `metroNarration` on board). Say a line id once per stop (dedupe by id within the dwell).
- **O7 · CCA status:** "2027 年 6 月底停办" infers the month; cca.edu says "by the end of the 2026–27 academic year".
  Harmless; re-check with the other time-sensitive cards in the final verify.
- **O8 · lanes C / G:** quiet arrivals: C's toast is the plain name, G's fallback is "到了 · 名称" (G shows C's text when
  given). Pick one wording at integration.
- **O9 · note:** the Twin Peaks goal counts after the bus ride because `createSummitDetector` stays armed across a
  transit ride (armed on foot ≥ 150 u away at the Castro). That is plan R4's intent; if G / E ever disarm on transit, the
  tour must walk up from ≥ 150 u instead.
- **O10 · timing vs lane T (landed during this review, `0a86c3f`):** T's simulated subway brakes and pulls away at
  7 u/s² and measures Embarcadero → Church 42 s and Castro → West Portal 34 s; `TOUR_MODEL.rail` gives ≈ 35 s / 27 s, so
  each underground leg models ≈ 7 s short (≈ 0.3 min over the tour, inside the tests' tolerance). At integration take
  the ride seconds from T's `lightRail.rideSeconds` (or lane G's line model) and re-derive the declared minutes.

### Integration changes (supersede the early plan where they differ)

1. Trips: the pill and times are lane G's `guideText.tripPillText` / `tripPlan.tripTimeLabel`; `objectiveTarget()` labels
   the trip waypoint with `legTarget(…).name`.
2. Arrival: `defaultArrivalLine(attraction, anchor)` already resolves landmark and district barks (no `lineFor` needed);
   offWalk places have no anchor (Alcatraz / Treasure Island are "seen" through the telescopes).
3. Cards: `placeCardTarget` order = landmark card → district POI card → `placeCardForPlace(placeCardsNow(), place)` → the
   generic place card; `interactables.poiById` resolves card ids with `placeCardByPoiId(placeCardsNow(), id)` (shared-row
   cards open as `sf:japan-center`, `sf:ferry-building-marketplace`; the Ferry Building row keeps the district card).
4. Tours: load `data/sf/tours` + `game/tourTrips` lazily; in the express version a stop with `expressTo` says
   `lines.expressArrive` and rides `expressRide()`; `tourStopOption(stop, prev, t => interactableById(t)?.name ?? null)`;
   `goal` completes, `advances` only moves a counting goal; W4-C8 sightseeing = loop stops reached (passed or alighted
   at) summed over real rides, `SIGHTSEEING_STOPS` = 8.
5. Recap: mount `TourRecap` lazily and pass `express` (the model counts the version played).
6. VOICE.md glossary: 克莱门街 (Clement St); 企李街 is Clay St.
7. Request to lane G replaced: the trip pill uses lane G's own helpers (C's copies are gone); `ArrivalCard` / reveal still
   consume `arrivalBeats()`.

### Checks

On the rebased head (over `5f4afa6`: lane T's `0a86c3f`, lane L's `84c12e2` and lane G's review included): `npx tsc -p tsconfig.app.json --noEmit` 0 ·
`npx eslint src/opus-bay tests/opus-bay-*` 0 · full opus-bay suite **601 / 601** green. Higgsfield: 0 credits.

## Early phase · part 2 (lane C2 · content: the open card and line items)

Worktree `C:/Users/willy/wt/w4-c`, 2026-09-27. Scope: the content items left open by lane C's early review (O2, O3,
O6, O8, the R1 follow-up) and by the other reviews (lane G O2 / O3 / O4, lane V item 4). Only lane C's own wave-4
files and new files were edited; **no other lane's file was edited** (lane P landed its own island names and the
Corona Heights summit arrival while I worked; lane C follows them instead of duplicating them).

### 给主人的摘要

1. 补上了三张缺的介绍卡：海湾大桥、码头绿地、金银岛（事实今天都上网核对过，带出处）。现在所有能走到的一、二级景点"抵达"时 BAYBAY 都有话说，不再冷场。
2. 恶魔岛的说法统一成"恶魔岛渡轮码头 · 33 号码头"（卡片、39 号码头的提示都改了），和 P 线的行程终点同名；克莱门街全部核对过，卡片里的英文引号也改成了中文引号。
3. 旧台词"下一站 Holloway，州立大学到了！"已冻结、已录音，不改；另加一句新台词"下一站 Holloway，就是州立大学。"，请 V 线补录。
4. BAYBAY 的导游语音现在排队说：上一段录音没说完，下一句不会插进来；同一句在同一站只说一次；错过时机的句子直接跳过。整趟一日游模拟跑了一遍，没有一句重叠。
5. "约 N 分钟"只剩一种写法（新文件 game/tripText.ts），抵达提示也只剩一种写法，G 线、P 线接线时换过来即可；科罗娜高地的全景在山顶触发。检查全部通过：tsc 0、eslint 0 错误、全套 706 个测试通过；Higgsfield 0 分。

### What was built

Commits on `opus-bay`: `678edd8` (W4-C2-1), `7c6e6e2` (W4-C2-2), `86ba716` (W4-C2-3) and the commit of this report
(W4-C2-4, which also adds `stopSay` / `chapterSay` and the whole-tour pacing test).

| file | what | API |
|---|---|---|
| `src/opus-bay/game/tripText.ts` (**new**, light: types only) | the ONE time rule and the ONE arrival toast (lane G review O4, lane C review O8) | `timeLabel(seconds, style?)` → "约 6 秒 · ~6s", "约 40 秒", "约 1 分钟" (57.5–89 s), "约 4 分钟", "约 1 小时 5 分钟", NaN → "计算中…"; styles `compact` (~4 min), `prose` (about 4 min), `bare` (4 分钟 / 4 min); `timeParts`, `minutesLabel(min, style?)`, `PENDING_TIME`, `arrivalToast(name, quiet)` ("抵达 · 艺术宫"; quiet "到了 · 圣依纳爵堂") |
| `src/opus-bay/game/linePacer.ts` (**new**, pure, light) | BAYBAY's lines one at a time (lane V review item 4; lane C review O6) | `new LinePacer(clipSeconds, { gap, repeatGap, max })`; `.offer(line, now)` → false for a repeat within 25 s or a line already waiting; `.step(now, blocked?)` → `SaidLine` (`seconds`, `voiced`, `bubbleMs`) or null; `.busyUntil`, `.isBusy`, `.pending`, `.clear`; `readSeconds(text)` (= data/sf/lines.ts `lineMs` / 1000), `LINE_TTL` (approach 5, arrive 8, tip 8, board 8, portal 6, arrival 15, stop 20, chapter 30 s), `PACER_GAP` 0.6 s, `REPEAT_GAP` 25 s, `PACER_MAX` 4 |
| `src/opus-bay/data/sf/tourLines.ts` | lines added after the freeze (TOUR_LINES untouched: snapshot `a799f903365d56e8` holds) | `TOUR_LINES_2` = [`metro-sfsu-next-2` "下一站 Holloway，就是州立大学。" / "Next stop Holloway — that's SF State."], `TOUR_LINES_2_ADDED`, `RETIRED_LINES` (`metro-sfsu-next` → `metro-sfsu-next-2`); `metroNarration` picks the new id at the Holloway approach; `tourLine(id)` finds both sets; `sayLine(say, ttl?)` → a paced line (frozen / added ids keep their voice id, plain bubbles are text) |
| `src/opus-bay/data/sf/tours.ts` | tour times from the rule; tour lines ready for the pacer | `SF_GRAND.subtitle` built from `minutesLabel(model minutes)` (same text: "全城 5 章 · 约 26 分钟 · 随时下车"); `tourResumeLabel` via `minutesLabel`; `stopSay(stop, 'lead' / 'arrive' / 'done', express?)` (express: `expressArrive`), `chapterSay(chapter, 'intro' / 'outro')` |
| `src/opus-bay/ui/TourRecap.tsx` | "完整版 · 约 26 分钟" via `minutesLabel` | props unchanged |
| `src/opus-bay/game/arrival.ts` | the Corona Heights panorama at the summit; the toast from the rule; paced lines; save decoder | `PANORAMA_SPOTS` (a view spot used only when the arrival is more than 12 u from the view; today lane P's override puts Corona's arrival on the summit, so the arrival anchor carries the panorama), `ArrivalAnchor.spot` / `.key`, `ArrivalHit.panorama`, `arrivalPaced(beats, attraction)`, `decodeArrivalSeen(raw)` (≤ 512 keys, `<attraction>` or `<attraction>@<spot>`) |
| `src/opus-bay/data/sf/placeCards2.ts` | 3 new full cards + wording | `CURATED_CARDS` + `bay-bridge` (row `bay-bridge-sf-anchorage`), `marina-green`, `treasure-island`; the Alcatraz bark "船从恶魔岛渡轮码头 · 33 号码头开" + a telescope tip; the PIER 39 tip with the same pier name |
| `src/opus-bay/data/sf/placeCards.ts` | 克莱门街 re-checked; ASCII `"…"` inside Chinese → “…” in 21 texts of both card files | — |
| `src/opus-bay/game/trips.ts` | header only (the destination rule is lane P's `tripDestination`) | API unchanged |
| `tests/opus-bay-sf-triptext.test.ts` (**new**, 10 tests) | the time rule (table, styles, parity with lane G's and lane P's labels), the island trip ends through lane G's pill, the toast parity, the pacer (clip durations, every loop approach ends before its stop, once per stop, ttl, busy, cap, unrecorded lines), arrival lines through the pacer, **the whole Grand Tour through the pacer** (full + express × zh + en: every line said, in order, never over another clip) | |
| `tests/opus-bay-sf-{cards,tours,arrival}.test.ts` | updated on purpose + new tests | cards: the curated list + the 3 cards (row, position ≤ 0.001°, hedges, the pier names = lane P's), no silent T1 / T2, 克莱门街 and quotes; tours: the Holloway line, the TOUR_LINES_2 snapshot `a8b4566e2f65aa73`, `sayLine`, times from the rule; arrival: Corona (today's summit arrival and the old door variant, either order), the quiet toast, the anchor count |

### Evidence

- Checks on the pushed tree `86ba716` (on `81b5ae6`): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0
  errors (43 warnings, none in lane C's files) · full opus-bay suite **706 / 706**. (A first full run had the known
  `sf-nav` "local A* window" wall-clock flake under load, 272.8 ms; green alone, 7 / 7.) The report commit's checks are
  in "Checks (part 2)" below.
- **Honest note:** `7c6e6e2` was pushed right after a rebase that brought lane P's `564c68a` (Corona's arrival moved to
  the summit) without re-running the checks; on that tree my new Corona test failed (1 test). Fixed and pushed about 15
  minutes later in `86ba716`, after a full run. Every later push followed a full run on the rebased tree.
- **Facts re-checked on the web on 2026-09-27** (source → what the card or code says):
  - Bay Bridge — [Wikipedia](https://en.wikipedia.org/wiki/San_Francisco%E2%80%93Oakland_Bay_Bridge): opened 12 Nov
    1936, "six months before the Golden Gate Bridge"; 4.46 mi (7.18 km) excluding approaches; the west section a double
    suspension bridge (two spans, a centre anchorage); the new self-anchored east span opened 2 Sep 2013; the west
    section is closed to pedestrians and bicycles. The Bay Lights — [Wikipedia](https://en.wikipedia.org/wiki/The_Bay_Lights),
    [SFist, 19 Feb 2026](https://sfist.com/2026/02/19/the-wait-is-ending-bay-lights-will-officially-be-re-lit-on-friday-march-20/),
    [SF Chronicle](https://www.sfchronicle.com/sf/article/bay-bridge-lights-return-22084492.php): dark since 5 Mar 2023,
    relit 20 Mar 2026 on the north (Embarcadero) side, the south side a later phase → "2026 年 3 月起重新亮了，天黑后在内河
    码头看" (no LED count, no south side). The east span path runs Oakland → Yerba Buena Island since 23 Oct 2016
    ([MTC](https://mtc.ca.gov/news/san-francisco-oakland-bay-bridge-bike-path-opens-yerba-buena-island)).
  - Marina Green — [Wikipedia](https://en.wikipedia.org/wiki/Marina_Green): between Fort Mason and the Presidio; tidal
    marsh → 1906 rubble → prepared for the 1915 PPIE → Marina Airfield, the first terminus of the transcontinental air
    mail (1920s); [Hoodline](https://hoodline.com/2016/05/great-explorations-marina-green/): "the place to fly a kite";
    the Wave Organ ([Wikipedia](https://en.wikipedia.org/wiki/Wave_Organ)): May 1986, at the end of the spit from the
    Golden Gate Yacht Club, best at high tide; [SF Rec & Park, Marina project](https://sfrecpark.org/1160/Marina-Improvement-and-Remediation-Proje):
    design 2025–26, construction from 2027 (update March 2026) → a hedged tip. Wikipedia's 74 acres is left out.
  - Treasure Island — [Wikipedia](https://en.wikipedia.org/wiki/Treasure_Island,_San_Francisco): 393 acres, built
    1936–37 for the 1939 Golden Gate International Exposition, Naval Station 1941–1997, a causeway to Yerba Buena
    Island; [tisf.com/ferry](https://www.tisf.com/ferry): from the Ferry Building Gate B, about 8 min, $5 a ride,
    weekdays 7:30 am – 8 pm, weekends too → hedged ("大约", "出发前查官网确认").
  - Alcatraz departure — [Alcatraz City Cruises](https://www.alcatrazcitycruises.com/plan-your-visit/directions/):
    "Pier 33 Alcatraz Landing" → 恶魔岛渡轮码头 · 33 号码头 (= lane P's `ARRIVAL_PLACES.alcatraz`).
  - Corona Heights — [Wikipedia](https://en.wikipedia.org/wiki/Corona_Heights_Park): summit 37.7646522, −122.4391379,
    520 ft, red Franciscan chert, "an unobstructed panoramic view … from downtown to the Twin Peaks" → projectCity (84.8,
    751.7); the walking graph's highest node there is (81.0, 749.0), y 29.8 (the museum door's node: 23.6) — the same
    point lane P chose for the arrival.
  - Street names — [Wikipedia, streets of Chinatown](https://en.wikipedia.org/wiki/List_of_streets_and_alleys_in_Chinatown,_San_Francisco):
    Clay Street = 企李街, so never Clement St. A primary Chinese source for 克莱门街 was not found today (zh.wikipedia and
    Chinese-press searches returned nothing for Clement St); 克莱门街 stays as the plain transliteration, now also on
    lane P's map (`a09d859`). No lane-C text says 企李街 except the CHSA card (Clay St, tested).
- Pacer numbers (lane V's `TOUR_VOICE_CLIPS`): the longest loop approach clips are zh 6.48 s (Lands End) and en 6.35 s
  (Ferry Building); + 0.6 s gap = 7.08 s, under the 7.3 s from the approach event to the stop (lane V's review), so every
  stop's arrive line starts on time (tested for 16 stops × 2 languages). Chapter clips 3.49–6.86 s. The whole tour (full
  / express, zh / en) through the pacer: every offered chapter / stop line said, in order, 0 overlaps, 0 dropped.
- Lane G's phone pill for the island trips (compact): "下一站 恶魔岛渡轮…" + "约 4 分钟" (desktop: the full name), and
  "下一站 14 号码头". Passing `Attraction.short` would print "下一站 恶魔岛" (see Integration step 6).

### Decisions

- **One source per wording.** Time and toast: `game/tripText.ts` (lane C). Where an island trip ends and its name: lane
  P's `ARRIVAL_PLACES` / `tripDestination(a)`. I had first written an island table in `tripText.ts`; lane P pushed its
  own minutes later, so mine was removed (`86ba716`) and the cards use P's names (tested).
- **The time rule** keeps lane G's numbers below a minute (identical for 0–57.5 s, tested every 0.5 s) and takes the
  minutes from the real seconds: 88 s is "约 1 分钟" (1.47 min; G said 2 because it rounded 88 → 90 first). The only
  differences with G are the 2.5 s before each half minute (tested). Lane P's zh is identical below an hour; its
  English loses the space ("~6 s" → "~6s", as G and the rest of the game write it) and hours read "1 小时 2 分钟".
- **The pacer** holds a line for its clip (the current voice language's `TOUR_VOICE_CLIPS` duration) or, without a
  clip, for the bubble's reading time; it says `voiced: false` for lines lane V has not recorded
  (`metro-sfsu-next-2` today), so no chirp plays for them. Transit lines carry a ttl, so an approach is never said after
  its stop.
- **Corona Heights**: the panorama plays where the view is. With lane P's summit arrival the arrival anchor carries it;
  the `PANORAMA_SPOTS` mechanism (tested with the old door arrival, either order, once) stays for any viewpoint whose
  arrival is more than 12 u from its view.
- **New cards on lane P's rows**: `bay-bridge` decorates `bay-bridge-sf-anchorage` (POI id `sf:bay-bridge-sf-anchorage`);
  `marina-green` and `treasure-island` use their own ids. Their lat / lng = lane P's point unprojected. No BAYLINK guide
  fits the Bay Bridge or Treasure Island; Marina Green takes `sf-palace-fine-arts-marina-guide`.
- The frozen line `loop-palace-of-fine-arts-tip` says 海滨草地 for Marina Green (a description: "the bayside lawn"); the
  map name is lane P's 码头绿地. Not reworded (frozen); harmless.

### Integration plan (part 2 additions; the early plan and the review's "Integration changes" still hold)

1. **Lane G, `game/tripPlan.ts`**: `tripTimeLabel(seconds)` → `return timeLabel(seconds)` (import `timeLabel` from
   `./tripText`; keep the export, so `optionSummary`, `ui/guideText.ts` and `tests/opus-bay-sf-trip.test.ts` lines
   338–342 stay as they are: all five values are identical under the rule). **`ui/guideText.ts`**:
   `arrivalToastText(name, quiet)` → `return arrivalToast(name, quiet)` (identical output; `tests/opus-bay-sf-guide.test.ts`
   lines 184–185 unchanged).
2. **Lane P, `ui/tripRows.ts`**: `tripSecondsLabel(sec)` → `return timeLabel(sec)`; in `optionDetail` use
   `timeLabel(x, 'bare')` instead of `.zh.replace('约 ', '')` / `.en.replace('~', '')`. Tests changing on purpose:
   `tests/opus-bay-sf-map-w4.test.ts` line 313 `en: '~6 s'` → `'~6s'`, line 317 `'约 1 小时 2 分'` → `'约 1 小时 2 分钟'`.
   `StationActions.tsx` / `TripOptions.tsx` keep calling `tripSecondsLabel` (or import `timeLabel` directly).
3. Optional, same rule (not part of O4): lane T's `game/lineChoices.ts` `duration()` and `ui/SubwayOverlay.tsx`
   "约 N 秒", lane P's `game/travel.ts` time format → `timeLabel` (check their tests: the texts differ at ≥ 90 s).
4. **Pacer** (lane C, `game/cityContent.ts`, city only, lazy): one pacer, `new LinePacer(id =>
   TOUR_VOICE_CLIPS['<lang>-' + id]?.duration)` with `<lang>` = `VoicePlayer.lang()` (audio/voice.ts; lane V's
   `data/sf/voiceTour.ts` loads lazily with the tour); a city frame system at 5 Hz: `said = pacer.step(now / 1000,
   dialogueOpen() || cinemaActive() || !!flow.get().cinematic)`; on a line `bubble(said.text, said.bubbleMs, BAYBAY_ID,
   'bark')` and, when `said.voiced`, `emit({ type: 'voice-line', id: said.voice })`, the mood as today. Offers:
   `transit` events → `loopNarration(e) ?? metroNarration(e)` → `pacer.offer(sayLine(line.id, ttl), now)` with ttl =
   `LINE_TTL.approach` / `.board` / `.arrive` by `e.what`; the subway overlay start → `tunnelNarration(...)` with
   `LINE_TTL.portal`; the tour engine → `chapterSay(chapter, 'intro' | 'outro')`, `stopSay(stop, 'lead' | 'arrive' |
   'done', express)`; an arrival hit → `arrivalPaced(beats, hit.anchor.attraction)` offered in order (instead of
   bubbling `beats.line` / `beats.postcardHint` directly); a tour cancel / end → `pacer.clear()`. The hop-off chip keeps
   `loopHopOffTip(station)` as text (not paced). G2's `baybayLines` scheduler already waits while any bubble shows:
   unchanged. Voice preload stays lane V's step 3 (load the next stop's approach / arrive / tip clips).
5. **Save v2 `arrivals`**: `new ArrivalWatcher(arrivalAnchors(ATTRACTIONS), decodeArrivalSeen(save.arrivals))`; write
   `watcher.seen()` (it may hold `<attraction>@<spot>` keys).
6. **Trips to an attraction** (lane C `startFreeLead` / `startTrip`, lane P PlaceActions, lane G planTrips): the end
   point and its name come from lane P's `tripDestination(a)`; lane G's pill gets `destination: d.name` and
   `short: a.offWalk ? null : a.short` (never the island's own short for a pier; P's pier short once it exists).
7. **Lane V**: record `metro-sfsu-next-2` (zh + en) into `data/sf/voiceTour.ts`; `tests/opus-bay-w4-assets.test.ts`
   line 245 then counts `(TOUR_LINES.length + TOUR_LINES_2.length) * 2` and loops over both sets (lane V's test).
   `metro-sfsu-next` stays recorded but is never picked (`RETIRED_LINES`), so it can leave any preload list.
8. **Counts at integration** (`sf-content`): 124 place cards + **8** curated cards (was 5).
9. **`data/VOICE.md` glossary** (lane C at integration) adds: 海湾大桥 (Bay Bridge), 码头绿地 (Marina Green; the frozen
   loop tip says 海滨草地 as a description), 金银岛 (Treasure Island), 恶魔岛渡轮码头 · 33 号码头 (Pier 33 Alcatraz
   Landing), 14 号码头 (Pier 14), 科罗娜高地 (Corona Heights), Holloway (the M stop; no Chinese name).

### Not done (part 2)

- Everything that edits existing files (the steps above), the recording of `metro-sfsu-next-2` (lane V), and phone
  shots of the new cards (they need the integration's PoiCard path).
- Other lanes' time wordings outside O4 (lane T's "坐一圈（约 N 分钟）", the subway overlay, lane P's travel.ts):
  listed in Integration step 3 only.

### Requests

- **Lane V:** record `metro-sfsu-next-2` — zh "下一站 Holloway，就是州立大学。", en "Next stop Holloway — that's SF
  State.", mood `happy` (`TOUR_LINES_2` in `data/sf/tourLines.ts`, snapshot-tested and frozen from now on); then extend
  your count test as in Integration step 7. Keep the `metro-sfsu-next` files (retired, never picked).
- **Lane P:** an optional `short` on `ARRIVAL_PLACES` (alcatraz: 33 号码头 / Pier 33), so lane G's phone pill reads
  "下一站 33 号码头" instead of "下一站 恶魔岛渡轮…"; the Alcatraz / PIER 39 / Treasure Island cards already use your
  names (tested against `ARRIVAL_PLACES`).
- **Lane G:** the two one-line switches of Integration step 1 (output-identical for your tests).
- **Lead:** none new. The early report's requests (a) `dir` on `transit`, (b) `start-tour` `tourId`, (c)
  `flow.arrival` landed in `9c73e91` (W4-I0a) while this part ran; `metroNarration` already speaks the portal lines
  when `dir` is set (lane T emits it next, lead note §8).
- **Lane L (integration, lead note §8):** when the four D2 arrivals move (`data/sf/arrivals.ts` LANDMARK_ARRIVALS), the
  tour's `sf:` targets follow (read live); tell lane C, which re-derives the declared minutes
  (`C:/Users/willy/opus-qa/w4/w4-c/tour-patch.mts`; the tours test allows 0.15 min).

No relayed owner message arrived during this part. Higgsfield: 0 credits.

### Checks (part 2)

On the tree rebased over `32eda15` (the lead's W4-I0 merge: flow.trip / flow.arrival, transit `dir`, start-tour
`tourId`): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 warnings, none in lane C's files) ·
full opus-bay suite **714 / 714** green, hero regression and contracts included (`flow.arrival` is typed on lane C's
`ArrivalBeats`, which this part did not change). Re-run on the final rebase over `11b7413` (lane L): tsc 0, eslint 0
errors, 713 / 714 with the known `sf-nav` "local A* window" wall-clock flake under load (333.7 ms), which passes alone
(7 / 7). Lane C's four test files: 57 tests (the new `sf-triptext` 10). Scratch: `C:/Users/willy/opus-qa/w4/w4-c/p2/` (the geo scripts, suite logs).

## Early review 2

Adversarial review of lane C2 (part 2: the open card and line items, commits `678edd8` … `79cf5bb`), 2026-09-27,
worktree `C:/Users/willy/wt/w4-c`, scratch `C:/Users/willy/opus-qa/w4/w4-c/review2/`. Three `W4-C-review:` commits
(pacer, cards, this report), all on lane C's own wave-4 files; no other lane's file edited.

### 给主人的摘要

1. C2 这一轮新加的三张卡（海湾大桥、码头绿地、金银岛）、恶魔岛码头的说法、科罗娜高地山顶全景和 Holloway 新台词，我上网抽查了 24 条事实和 3 个坐标，全部属实。
2. 找到并修好 8 个问题，最要紧的是：一日游里 BAYBAY 会把“上 N 线咯！”“上 M 线咯！”和“下一站 19th Ave & Winston”各说两遍（原来的“同一句不重复”只管 25 秒）；接线说明里有两处会出错（从游戏代码直接引用音频模块会把音频打进主包；明信片奖励弹出时台词会“只有声音没有字幕”，也会和别的城市台词叠音）。现在把整趟一日游连同沿途每一站的报站一起模拟：没有一句说两遍、没有叠音、导游台词一句不丢。
3. 恶魔岛卡片上 BAYBAY 那句话改得更像人话（“上岛的船从 33 号码头开，不是 39 号。”），完整码头名放到望远镜提示里；马里纳的游艇港不再叫“码头港区”。检查：tsc 0、eslint 0 错误、全套测试通过；Higgsfield 0 分。

### What I checked

- Read `sf-w4-lead.md` (§2, §5, §8), lane C's plan rows, this report (early phase, early review, part 2), every file part 2
  created or changed (`game/tripText.ts`, `game/linePacer.ts`, `tests/opus-bay-sf-triptext.test.ts`, the part-2 diffs
  of `tourLines.ts`, `tours.ts`, `arrival.ts`, `trips.ts`, `TourRecap.tsx`, `placeCards.ts`, `placeCards2.ts` and the
  three lane-C tests), and the files the integration plan names: `game/tripPlan.ts` + `ui/guideText.ts` (lane G, already
  switched to `tripText` in `f553560`), `ui/tripRows.ts` + `tests/opus-bay-sf-map-w4.test.ts` (lane P), `game/flow.ts`
  `bubble()`, `game/cityContent.ts` (statically imported by `flow.ts`), `game/baybayLines.ts` (G2's city lines and their
  gates), `audio/voice.ts` (`VoicePlayer.lang`, `line()`, `SAME_CLIP_GAP`, `LINE_WAIT`), `audio/audio.ts` (`voice-line`),
  `data/sf/voiceTour.ts`, `world/lightRail.ts` (dispatch: a waiting rider's train within 20 + 15 s), `data/sf/attractions.ts`
  (`ARRIVAL_PLACES`, the Corona Heights arrival), `data/VOICE.md` (Marina = 马里纳区; 码头区 is the Embarcadero piers).
- Early-phase rule: part 2 edited only files lane C created in wave 4 (the first commit of each is a `W4-C…` commit);
  `TOUR_LINES` untouched (snapshot `a799f903365d56e8`), the `TOUR_LINES_2` snapshot `a8b4566e2f65aa73` holds.
- Budget / weight: `tripText.ts` and `linePacer.ts` import types only (the latter now pinned by a source scan);
  `tours.ts` / `arrival.ts` gain only these light imports. `decodeArrivalSeen` keeps all 158 attraction ids.
- Ran the pacer against the real clip lengths: reading time vs clip for all 214 recorded tour clips, and a **fuller Grand
  Tour simulation** (scratch `tour-sim.mts`, `tour-sim2.mts`, then a test): the tour's own lines **plus** the loop /
  Metro narration of every station passed, waits of 5, 20 and 40 s for the vehicle, full and express, zh and en.
- **Facts re-checked on the web today (24 facts, 3 coordinates, all correct):** Bay Bridge opened 12 Nov 1936, the Golden
  Gate Bridge 27 May 1937 (→ "早半年") · 4.46 mi excluding approaches (→ "约 4.5 英里") · the west crossing = two
  suspension spans joined at a centre anchorage · the new east span opened 2 Sep 2013 · the west section closed to
  pedestrians and bikes · the east span path Oakland ↔ Yerba Buena Island since Oct 2016 (en.wikipedia Bay Bridge) · the
  Bay Lights relit 20 Mar 2026 (illuminate.org, SF Chronicle, SFist) · Marina Green between Fort Mason and the Presidio,
  tidal marsh → 1906 rubble → filled for the 1915 PPIE, air-mail terminus from 9 Sep 1920 (en.wikipedia) · Wave Organ May
  1986, end of the spit from the Golden Gate Yacht Club, best at high tide (en.wikipedia) · the Marina harbours project:
  design 2025–26, construction 2027, parking and shoreline in the last phase (sfrecpark.org 1160, March 2026 update) ·
  Treasure Island 393 acres, built 1936–37 for the 1939 GGIE, NAVSTA 1941–1997, a causeway to Yerba Buena Island
  (en.wikipedia) · the TI ferry: Ferry Building Gate B, ≈ 8 min, $5, from the island 7:30 am – 8 pm, from SF 7:50 am –
  8:20 pm (tisf.com/ferry; the card's hedged "大约 7:30–20:00" is fine) · "Pier 33 Alcatraz Landing"
  (alcatrazcitycruises.com) · Alcatraz prison 1934–1963, the occupation 20 Nov 1969 – 11 Jun 1971 (19 months) · PIER 39
  opened 1978, sea lions from Sep 1989, a two-storey carousel (en.wikipedia) · Corona Heights summit 37.7646522,
  −122.4391379, 520 ft, Franciscan chert, the panoramic view (en.wikipedia) · 企李街 = Clay St, 都板街 = Grant Ave (the
  Chinatown street table; Clement St is not in it) · the M Ocean View outbound: Stonestown Galleria, then San Francisco
  State University at 19th Ave & Holloway (en.wikipedia) · coordinates (Nominatim): Marina Green 37.80660, −122.43912
  (card 37.8066, −122.43913) ✓, Treasure Island 37.82381, −122.37041 (card 37.82377, −122.37099, ≈ 50 m) ✓, the Corona
  summit ✓.

### Defects found and fixed (with tests)

| # | defect | fix |
|---|---|---|
| D1 | "Once per stop" (O6) was a 25 s window. In the Grand Tour BAYBAY said `metro-board-n` twice (La Playa, then 9th & Irving 135 s later), `metro-board-m` twice (Church, then Holloway 157 s later) and `metro-stonestown-next` twice (outbound, then passing Winston on the way back, 105 s); and a stop whose lead is the board line (`n-ride-9th-irving`: lead `metro-board-n`) says it again on board when the train takes more than 25 s (lane T's dispatch allows ≈ 35 s) | `PacedLine.repeatGap` (a line's own window); `NARRATION_REPEAT` = 300 s for the transit narration (a loop lap, 13.5 min, still narrates every lap); new `transitSay(e)` in `data/sf/tours.ts` = `loopNarration ?? metroNarration` with the ttl of its moment and that window (the integration's offer in one tested place) |
| D2 | A duplicate offered while the same key waits was refused and the waiting copy kept its own ttl: the stop's `arrive` (ttl 15) was lost with the transit copy's 8 s when a dialogue held the pacer | the waiting copy keeps the later deadline |
| D3 | `step()` built a new array on every call (`queue.filter`), 5–10 times a second for the whole city session | expired lines dropped in place (test: the same array) |
| D4 | Integration step 4 builds the pacer with `VoicePlayer.lang()` from `audio/voice.ts` inside `game/cityContent.ts`, which `flow.ts` imports statically: the voice player (and what it imports) would leave the lazy audio chunk (`GameRoot` loads `audio/audio` with `import()`) for the main graph, already over its 250 KB target | `clipSecondsFrom(clips, lang)` and `voiceLang(locale)` in `linePacer.ts` (= `VoicePlayer.lang()`: `getLocale()` `'en'` → en, else zh); the language is read per line (a switch mid-tour times the next line right) |
| D5 | Integration step 4 holds the pacer only for dialogue / cinema. `flow.ts bubble()` drops every bubble during a postcard reward, so a line stepped out then plays its voice with no text ("nothing talks over a postcard reward" broken); and a voiced G2 city line (`game/baybayLines.ts`) could be talked over, since the pacer did not look at bubbles | held by G2's own `silent` gate (dialogue, cinematics, fast travel, photo mode, fishing, pause, postcard reward / fly, open panel) and by a bubble that is not its own; G2's lines already wait for any bubble. In the `linePacer.ts` header and "Integration changes" below |
| D6 | The Alcatraz bark "那座岛就是恶魔岛！船从恶魔岛渡轮码头 · 33 号码头开，不是 39 号。" put the map label (with " · ") inside a spoken line and said 恶魔岛 twice | bark "那座岛就是恶魔岛！上岛的船从 33 号码头开，不是 39 号。"; the telescope tip carries the full name the trips end at ("…带你到恶魔岛渡轮码头 · 33 号码头，用望远镜看它。"); test: the bark says the number in a sentence, the tip the full name, no card names the pier any other way |
| D7 | The Marina Green tip called the yacht harbours "码头港区": 码头 for the Marina goes against `VOICE.md` (Marina = 马里纳区; 码头区 is the piers), and the project rebuilds the harbours | "马里纳游艇港改造预计 2027 年开工…" (sfrecpark: East Harbor docks, West Harbor breakwater, parking and shoreline last); test |
| D8 | The part-2 claim "the whole Grand Tour through the pacer: nothing overlaps, nothing dropped" simulated the tour's own lines only, not the loop / Metro narration that fills every ride | a test runs the tour with the approach / arrive / board narration of every station passed (waits 5 / 20 / 40 s, full + express, zh + en): no line said twice, no overlap, no chapter / stop line dropped. One transit line may drop by its ttl: in the express version with a 5 s wait at La Playa, the N's board line comes while the chapter change is still talking (by design: a late line is not said) |

Lane C's four test files: 57 → **61** tests (sf-triptext 10 → 14).

### Open (not fixed here)

- **R2-O1 · lane P (name) + lane C (card) + VOICE.md:** Marina Green is **码头绿地** on the map and the card, but the
  glossary keeps 码头 for the piers (Marina = 马里纳区; `ZH_GLOSSARY` rewrites 码头区 → 马里纳区). Suggest 马里纳绿地 for
  the map name, the card, the arrival toast and the glossary in one commit; the frozen loop tip's description 海滨草地 is
  fine.
- **R2-O2 · lane V:** when `metro-sfsu-next-2` is recorded, the sf-triptext test "a line without a clip …" (it offers
  `metro-sfsu-next-2` and expects `voiced: false`) switches to a plain bubble on purpose, with the w4-assets count of
  part 2's Integration step 7. Until then English players get text only where the retired clip ("Next stop Holloway —
  SF State!", a fine English line) exists.
- **R2-O3 · lane V (preload):** `voice.line()` waits `LINE_WAIT` 0.7 s for a clip still loading, then chirps and never
  plays it, while the pacer holds the full clip length: the next stop's tour clips must be warm before the stop (lane V's
  step 3), else a chirp and a silent bubble.
- **R2-O4 · note:** four recorded lines read longer than clip + gap (zh `loop-pier-39-tip` 0.40 s, zh
  `loop-golden-gate-park-tip` 0.27 s, en `loop-civic-center-approach` 0.26 s, zh `loop-golden-gate-park-arrive` 0.03 s):
  a following line replaces the bubble that much early. The tips are chip text (not paced); harmless.

### Integration changes (review 2; supersede part 2's step 4 where they differ)

1. **Pacer** (`game/cityContent.ts`, lazy with the tour): `new LinePacer(clipSecondsFrom(TOUR_VOICE_CLIPS, () =>
   voiceLang(getLocale())))` with `getLocale` from `../../i18n/locale` and `TOUR_VOICE_CLIPS` from lane V's
   `data/sf/voiceTour.ts` (dynamic import with the tour); never import `audio/voice.ts` into game code.
2. **Held:** `pacer.step(now, silent || (!!f.bubble && f.bubble.text !== last?.text))`, `silent` = the expression G2's
   `initBaybayLines` passes as `silent`; `last` = the line the pacer said last.
3. **Transit offers:** `const say = transitSay(e); if (say) pacer.offer(say, now)` for every `transit` event (replaces
   `loopNarration(e) ?? metroNarration(e)` + `sayLine(id, LINE_TTL[…])`); the subway overlay's `tunnelNarration` line
   goes as `{ ...sayLine(line.id, LINE_TTL.portal)!, repeatGap: NARRATION_REPEAT }`.

### Checks

On the tree rebased over `e753cb5` (lane L's tops fix; the rebase over `fc27bff` had lane L's two known site-tops failures, fixed upstream by `e753cb5`): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 warnings,
none in lane C's files) · full opus-bay suite **743 / 744**: the one failure is the E2-5 "view field in the city" wall-clock test under load (`opus-bay-sf-move2` passes alone, 24 / 24). Lane C's four files: 61 / 61. No relayed owner message arrived. Higgsfield: 0 credits.
