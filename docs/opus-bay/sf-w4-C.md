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

On the tree rebased over `b41e95c` (lane T's wiring W4-T3 … W4-T13 on top): `npx tsc -p tsconfig.app.json --noEmit` 0 ·
`npx eslint .` 0 errors (43 warnings, none in lane C's files) · full opus-bay suite **746 / 746** green (and 745 / 745 over `e753cb5`). (Earlier rebases:
over `fc27bff` lane L's two site-tops tests failed until its `ebdc3a7`; over `ebdc3a7` 743 / 744 with the E2-5 "view
field in the city" wall-clock test under load, green alone 24 / 24.) Lane C's four files: 61 / 61. No relayed owner
message arrived. Higgsfield: 0 credits.

## Integration part a

Integration implementer of lane C, 2026-09-27 (16:30–19:45 PDT), worktree `C:/Users/willy/wt/i4-c` (branch `i4-c`), dev
port 5405, scratch `C:/Users/willy/opus-qa/w4i/i4-c/`. Commits on `opus-bay`: `ae3d577` (W4-IC1), `95dfa46` (W4-IC1b),
`2efc5b9` (W4-IC2), `344bbc2` (W4-IC3), `fbd13df` (W4-IC4) and this report.

### 给主人的摘要

1. **进度（回复"现在进度如何"）**：C 线接线的第一部分完成并已推上去——"行程"、"抵达时刻"、BAYBAY 的导游台词、三个新目标、132 张新介绍卡和"环游旧金山 · 一日游"现在都在真实游戏里跑起来了；剩下的细节（见 Not done）放在第二部分。
2. 城市模式欢迎时选"刚来湾区，带我认识一下"就开始一日游：先选完整版（约 26 分钟）或快速版（约 18 分钟）；每一站都是一段"跟 BAYBAY 走"的行程——她带路到车站，上车时直接弹出"上车 · 坐到 金门大桥 · 游客中心（约 3 分钟）"，坐车时 BAYBAY 讲解，到站说一句，停一会儿再带你去下一站；中途可以跳过一站或结束，下次从"继续一日游 · 第 N 章"接着走，结束有回顾面板（路线画在 P 线的纸地图上）。
3. 走到一个景点（比如州立大学）会触发"抵达时刻"：金色提示"抵达 · 旧金山州立大学"、BAYBAY 说一句介绍、盖章、这个地方以后可以飞过去。新增三个目标：坐观光巴士逛 8 站、坐地铁去海边或州立大学、走到 3 所大学。明信片从 20 张变成 24 张（V 线画的州大草坪、音乐广场、天涯海角、西门）。
4. 124 个新景点加 8 个著名地点的介绍卡能在地图和抵达卡里打开，带授权照片和出处；10 个老地标卡补上了最新状态（比如双峰步道施工）。
5. 游戏主包没有因为这些功能变大：把活动卡、普通地点卡、第一课结业小结和目标检测改成用到时才加载，接线后主包反而比接线前小（830.20 kB / 309.63 kB gzip，接线前 835.45 / 310.82）。检查：tsc 0、eslint 0 错误、全套 802 个测试全部通过；Higgsfield 0 分。

### What was wired (files, API)

| file | what | API for other lanes |
|---|---|---|
| `game/flow.ts` (main graph) | thin trip / city-tour entry points; objective priority freeLead > trip > tour > week > mapTarget > freeHint; a city free lead is a one-leg trip; `startTour(tourId)`; the first lesson's `currentStop()` is null while a city tour owns `game.tour`; the city call menu (一日游, or 继续一日游 · 第 N 章; 海边 7 站（湾区第一课）); 附近有什么 names the nearest loop stop / Metro station | `startTrip(option, { placeId, attraction?, name? }, source)` · `skipTripLeg()` · `replanTrip(option)` · `endTrip()` · `tripGuide(now)` · `tourPill()` (the objective pill's words for both tours) · `dismissArrival()` · `lastArrivalAt()` / `noteArrivalMoment()` · `setTripRunner` / `setCityTourApi` · `cityTourActive()` |
| `game/tripRun.ts` (**new**, city chunk) | the trip runner on `flow.trip`: walk (the brain's lead), line (lead to the stop → lane T's `boardLine(stop, { to, line })` for the loop / Metro, lane C's own pre-filled dialogue for the cable cars / F-line / ferry; a ride that ends ≤ 40 u from its stop ends the leg, anywhere else the rest becomes one walk), bike / car (lead to it, `moveApi.driveTo` once mounted), fly (`startTravel`); events start / leg / end / cancel in order; an arrived trip clears after 4 s | `dispatchTrip(action)`, `rideNodeFor(leg)`, `lineRunning(leg)`, `tripStage()` (QA) |
| `game/brain.ts` | a trip leads before the first lesson and the week; the soft hint waits during trips and 60 s after an arrival (lane G's step 11) | `leadTo(now, dest, r, onArrive)` |
| `game/cityMoments.ts` (**new**, city chunk) | arrival moments (ArrivalWatcher over lane P's ATTRACTIONS, 4 Hz) → the `arrival` event, `flow.arrival` (cleared after the card's 6 s), the line through BAYBAY's pacer, the stamp sound, the place discovered, save v2 `arrivals`, campus marks; the pacer with early review 2's rules (`clipSecondsFrom(TOUR_VOICE_CLIPS, voiceLang)`, G2's silent gate, held by another bubble); transit narration via `transitSay`; the ride goals from lane T's events; the wave-4 goal waypoints; lane G's planner goal rules (`registerTripGoals('c-goals', …)`); `__opusBay.c` in DEV | `offerLine`, `offerPaced`, `sayTunnel`, `noteLoopRide(from, to)`, `arrivalSeen(id)`, `openGoalRules()`, `rideGoalTargets()` |
| `game/cityContent.ts` | loads tripRun / cityMoments / cityCards in city mode; `registerGoalTargets` | `arrivalSeen(id)`, `sayTunnel(line, fromAt, toAt)`, `noteLoopRide(from, to)` (main-graph forwards, safe before the chunk lands) |
| `game/cityTour.ts` (**new**, lazy on the first tour) | the Grand Tour engine: 完整版 / 快速版 on a fresh tour; every stop a `tour` trip (`tourStopOption`; the express version's merged rides, `playedStop`); chapter intro / stop lead / arrive (express `expressArrive`) / chapter outro through the pacer; dwell by moment (arrive 20 s, photo 25 s, panorama 45 s, a ride 3 s; ends early once the player walks 18 u away); the call-menu rows; save v2 `tours`; the recap | `initCityTour()`, `skipCityTourStop()`, `playedStop()`, `savedProgress(id)`, `cityTourRun()` (QA) |
| `game/cityCards.ts` (**new**, city chunk) | the 132 cards in PoiCard (POI resolver, `CardLookup`), photos from `src/data/sf-landmark-photo-assets.json` (480 w, credit / licence / page), 官网 / 更多来源 / zone eyebrow; CARD_REFRESHES patch the 10 built landmark cards (the status first among the tips) | `cardLookup(set)`, `cardPoi(card)`, `refreshedPoi(poi, r)` |
| `data/sf/cityPois.ts` | `placeCardTarget` order: landmark card → district POI card → wave-4 card → generic place card | `attractionCardId(a)` (the card an attraction opens), `setCardLookup` |
| `game/interactables.ts` | POI resolvers (cards that are not in POIS) | `registerPoiResolver(fn)` |
| `data/sf/goals.ts` · `data/sf/goalMarks.ts` (**new**, lazy) | goals 7 → 10: sightseeing (a `loop:<stop>` mark per stop reached on real rides; 8), metro (a ride ≥ 150 u that gets off at La Playa / Winston / Holloway), campuses (arrival moments at 3 of SF State, USF, UCSF ×2, CCSF); progress "3/8", "1/3" | `loopStopReached`, `campusArrived`, `metroRideCounts` |
| `data/save.ts` · `data/wishlist.ts` | save v2 `tours` (≤ 8 ids, clamped) and `arrivals` (≤ 512 keys) decoded as untrusted input; goalsDone keeps 128 ids (G2 w3 b2, routed); the progress save keeps the first lesson's stops apart while a city tour holds `game.tour` | `decodeTours`, `decodeArrivals`, `districtTourProgress()`, `GOALS_DONE_MAX` |
| `data/script.ts` · `data/sf/copy.ts` | the city welcome's choice 1 = `{ type: 'start-tour', tourId: 'sf-grand' }` with the sub "全城 5 章 · 约 26 分钟 · 随时下车" (routed); the city title greeting (G1 w3 a4, routed); the `streetcarBoard` hook (F w3 a, routed; `ferryBoard` / `ferryOff` existed); 24 postcards in BAYBAY's lines | `GRAND_TOUR` (tested equal to `SF_GRAND`) |
| `data/sf/postcards.ts` | W4-C9: lane V's four postcards join (16 city + 8 = 24) | `CITY_POSTCARD_IDS` |
| `ui/Moments.tsx` · `ui/CityTourRecap.tsx` (**new**) · `ui/DistrictRecap.tsx` (**new**) | the recap panel: the Grand Tour's (TourRecap with lane P's `RecapMap` as `mapSlot`; stamps = arrivals of the tour's attractions) or the first lesson's, both lazy | — |
| `ui/PoiCard.tsx` · `ui/PlaceCard.tsx` (**new**) · `ui/EventCard.tsx` · `ui/EventCardBody.tsx` (renamed) | the generic place card and the event card load on first use (GameRoot) | `GuideRow`, `NearEvents` exported |
| `game/cityGoals.ts` · `game/cityDetectors.ts` (**new**) | the goal detectors moved out of the main graph (cityLive imports them) | — |
| `data/VOICE.md` | the wave-4 glossary (Stonestown, SF State, USF, UCSF, CCSF, Blue Heron Lake, 克莱门街 vs 企李街, Bay Bridge / Marina Green / Treasure Island, the island piers, Corona Heights, the lines and stations, 日落隧道 / 双峰隧道, the Grand Tour) and R11 | — |
| `tests/opus-bay-sf-tripflow.test.ts` (**new**, 12) | trips (start / waypoint / lead / end / clear; a new trip cancels; endTrip; the week; the city free lead; line legs through lane T's boarding and lane C's ferry dialogue; a ride that ends early walks on; the soft hint), the goals, save v2 fuzz, the progress guard, the Grand Tour copy, the Grand Tour engine end to end (welcome → version → stops → dwell → next → call menu → end → recap → resume → Bay 101 after it; `tourPill`), arrival moments (flow.arrival, the paced line, campus marks, transit narration, 直接到站 marks, goal rules), place cards (resolver, row lookup, `attractionCardId`, refresh) | — |
| `tests/opus-bay-sf-content.test.ts` | changed on purpose: 10 goals, the welcome's choice 1 = the Grand Tour, 24 postcards (16 city cards: the four's facts, cards, anchors), the detectors' module | — |

### Evidence

- **Checks** on the pushed tree `fbd13df` (rebased over `bdac04e`; the final rebase over `248eb60` brought one lane-V
  world-light commit, tsc re-run): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 warnings, none
  in lane C's files) · full opus-bay suite **802 / 802** (790 / 790 and 792 / 792 on the earlier pushes; one run over
  `fd57e45` had lane L's two geary-west tests red on origin itself, green after L's `94badf8`).
- **GameRoot** (vite build, `vite.opus.config.ts`): origin `786c93e` 835.45 kB / 310.82 kB gzip → with lane C's wiring
  **830.20 kB / 309.63 kB** (W4-IC1b). On the pushed tree (lanes G / P / T / V wired too) GameRoot is **790.95 kB /
  298.51 kB**; lane C's own chunks there: tripRun 8.64 kB, cityMoments 11.20 kB, cityTour 9.77 kB, CityTourRecap 8.65 kB,
  cityCards 2.70 kB, PlaceCard 3.29 kB, EventCardBody 4.57 kB, DistrictRecap 4.60 kB (raw).
- **In-game** (dev server 5405, RTX; every screenshot read): desktop 1440 × 900 — the city welcome with "全城 5 章 · 约 26
  分钟 · 随时下车" (`docs/opus-bay/qa/w4/C/ia-welcome-desk.jpg`); the 完整版 / 快速版 question; BAYBAY's chapter intro
  bubble and the waypoint "渡轮大厦 · 约 9 秒" on the first stop; lane T's pre-filled boarding "上车 · 坐到 ★ 金门大桥 · 游客
  中心（约 3 分钟）" at the loop pole (`ia-tour-bus-board-desk.jpg`); the bus ride with the RideBanner and the waypoint
  "金门大桥 · 游客中心 · 约 4 分钟" (`ia-tour-bus-ride-desk.jpg`); an arrival at SF State (`?at=sf-state-university`):
  `flow.arrival` toast "抵达 · 旧金山州立大学", peek + reveal, BAYBAY's line "到州立大学啦！1899 年建校…" 0.25 s later,
  `campus:sf-state-university` marked, the next-goal row "坐地铁 · 19th & Holloway · 州立大学 · 约 14 秒". Phone 390 × 844
  dpr 3 (quality mid) — the version question (`ia-tour-choose-phone.jpg`); an express run stepped through 9 stops then
  结束 → the recap (9 / 16 stops, chapters 3/3 · 2/2 · 2/2 · 2/3 · 0/6, 快速版 · 约 18 分钟; `ia-recap-phone.jpg`); the SF
  State card with its licensed photo, credit and BAYLINK guide (`ia-card-sfsu-phone.jpg`); the goals card with the ten
  goals (`ia-goals-phone.jpg`); the city call menu (7 rows in two columns).
- **Routed requests** (lead-merge §8.4): done — `goalsDone: strings(raw.goalsDone, 128)`; the welcome choice →
  `start-tour` with `tourId: 'sf-grand'`; `flow.arrival` for the beats; `SfPlaceKindAll` needs no change (it is
  `SfPlaceKind`); `greet` in copy.ts; the `streetcarBoard` hook (`ferryBoard` / `ferryOff` were there). Not done: the
  optional ZH_GLOSSARY / PLANNER_DROP clean-up (Not done below).

### Decisions

- **The main graph stays thin**: flow.ts holds registries and one-line entry points; the trip runner, the moments, the
  cards and the tour are their own chunks (city only, or the first tour). The district never loads them: district mode is
  unchanged (hero regression and the district tests green).
- **One trip at a time**: a new trip cancels the running one (events cancel → start); 带我去 (`navigateTo`), the week and a
  district tour end it; a fast travel the player starts (not a fly leg) ends it.
- **Pre-filled boarding**: lane T's `boardLine(stop, { to, line })` for the loop / Metro (its dialogue, its `ln:` ride);
  lane C's small dialogue ("上车 · 坐到 …（约 N）" / "先不坐") for the cable cars, the F-line and the ferry. A wave-4 line
  counts as running once lane T's `transit-<stop>` interactable exists; otherwise BAYBAY says "这条线今天没开，我们走过去
  吧！" and the trip walks.
- **A ride that ends early** (提前下车, another destination) turns the rest into one walk from where you are: honest, no
  teleport; within 40 u of the alight stop counts as arrived.
- **Grand Tour pacing**: every line goes through the pacer; a stop's dwell waits only for the line being spoken (lines
  held by another bubble keep their order and ttl), so a G2 city line cannot stall the tour.
- **The first lesson's progress** stays in progress v1; `game.tour.id` says whose stops `game.tour` holds, and the progress
  save keeps the first lesson's last state while the Grand Tour runs (the Grand Tour's progress is save v2 `tours`).
- **GameRoot offset**: the event card, the generic place card, the first lesson's recap and the goal detectors became lazy
  (each opens once: a short Suspense on first use), so the wiring made GameRoot smaller, not larger.

### Known gaps

- Lane G's objective pill says "湾区第一课 N/7" while the Grand Tour dwells at a stop (between two trips); during each trip
  lane G's trip pill is right. Request below (`tourPill()` is ready and tested).
- The arrival card's 看介绍 opens `sf:<place>`: for the two cards that share a row (Japan Center on the Peace Pagoda row,
  the Ferry Building marketplace) that is the row's card, not theirs. Request below (`attractionCardId(a)`).
- (Closed while this report was written: lane T's `3b3235c` sends the subway tunnel line and the loop hop-off tip through
  BAYBAY's pacer (`sayTunnel` / `offerLine`), drops its own Metro boarding bubble, and reports the loop stops a counted
  直接到站 skips (`noteLoopRide`), which were this part's three requests to lane T.)
- In one `?start=free&at=…` run the free-roam intro bubble left after ≈ 1 s instead of 4.2 s; nothing in lane C's code
  clears bubbles (only flow.ts' own timers and `playDialogue`) and no dialogue opened. To trace in part b.

### Not done (part b)

- Tour polish: the optional side stops (Fort Point, the deck walk) as a choice at the Welcome Center; the photo moment
  waiting for the shutter; the express version's 直接到站 hint on the long Metro legs; the stops' two-shot framing
  (`stageMark` / `stopSubject` from `SfLandmarkInfo.photo`); the four new postcards on their tour stops; the express run
  timed end to end (18 ± 3 min, scripted with `?qa`).
- The journal's list of arrival stamps; the plan's remaining shots (a hop-off moment at the Palace, the Stonestown
  arrival, the SF State campus moment with lane G's card on the phone).
- Optional: drop the landmark part of `ZH_GLOSSARY` / `PLANNER_DROP` (D2 w3 a); R2-O1 (Marina Green 码头绿地 → 马里纳绿地,
  with lane P); the time-sensitive cards re-checked in the final verify.

### Requests

- **Lane G** (`ui/Hud.tsx` Objective): when `tourPill()` (game/flow.ts) belongs to a city tour (`id !== 'first-lesson'`),
  show its `name` ("一日游 · 海湾"), `step / total` (chapters, 5 dots) and `next`, not the hard-coded 湾区第一课 and
  `tourStops().length`; the first lesson can read the same function. (`ui/GuideLayer.tsx` ArrivalCard): `onInfo` →
  `openPanel('poi', attractionCardId(ATTRACTION_INDEX.get(card.attraction) ?? { id: card.attraction, placeId: card.place }))`
  (data/sf/cityPois.ts), so Japan Center and the Ferry Building marketplace open their own cards.
- **Lane T**: none open (the three of this part landed in `3b3235c`).
- **Lane P**: `arrivalSeen(attraction)` (game/cityContent.ts) for the map's "arrived" tick; `attractionCardId(a)` for the ⓘ.

Relayed owner message during this part: "现在进度如何" (answered in the summary's first line). Higgsfield: 0 credits.

## Integration part b

Integration implementer of lane C, 2026-09-27 (20:00–22:40 PDT), worktree `C:/Users/willy/wt/i4-c` (branch `i4-c`), dev
port 5405, scratch `C:/Users/willy/opus-qa/w4i/i4-c/` (QA action scripts `qa/b-*.json`, shots `shots/b/`, builds
`dist-b0…b2`, suite logs `suite-b1…b5.log`). Commits on `opus-bay`: `3641b5b` (W4-IC6), `5697ca7` (W4-IC7), `38f2847`
(W4-IC8), `3600806` (W4-IC9) and this report.

### 给主人的摘要

1. **进度（回复"现在进度如何"）**：C 线接线第二部分完成并已推上去——六组验证里落在 C 线文件上的问题全部修好（内容核查 2 个较重要 + 9 个小问题，桌面试玩 1 个重要 + 5 个小问题，手机试玩 2 个小问题，代码复查 1 个），每个都有测试或截图；其余问题属于别的线，已确认都在它们各自的清单里。
2. 介绍卡：「官网」只指向地标自己的官网（没有官网就不显示，比如龙门）；10 张老地标卡不再重复说同一件事（卡斯特罗剧院重开、苏特罗塔在双峰看最好等只说一次），悬崖屋写成"经营方目标 2026 年底重开，日期未定"；卡片里的英文地名换成游戏里的中文名（都板街、北滩、华盛顿广场、天涯海角……），街区名跟 HUD 一致（湖岸区、维西塔西翁谷、英格尔赛德）；过期的状态会自动消失（MoAD 换展已结束）；两条失效来源换掉。
3. 试玩问题：明信片就在脚边时，按 E 一定是"捡起明信片"（不再被 BAYBAY 或停着的单车抢走，Luz 的委托不会卡住）；带去金门大桥南塔时先走到桥头上桥，不再绕到桥下 Fort Point 再折回；"明信片线索"带你走到离明信片 8 米左右，而不是 40–60 米外的地标；坐车时目标小标签不再压在角色脸上；"Karl 请假了"只在白天说；设置里"重置进度"会同时清掉抵达印章和正在进行的一日游。
4. 一日游打磨：拍照站会等你按快门（拍完 3 秒后说"拍得真好！"再走）；快速版在长地铁段提醒"可以点「直接到站」"；下车后 BAYBAY 先说站点介绍和下车提示，不再被"金色时刻！"抢话；V 线新画的三张明信片挂到了对应的站。
5. 游戏主包比接线前还小：把介绍卡正文拆成空闲时预加载的小包，GameRoot 778.94 kB / 294.17 kB gzip（本部分改动前 782.39 / 295.16）。检查：tsc 0、eslint 0 错误、全套 838 个测试全部通过；Higgsfield 0 分。

### Findings fixed (lane C's files)

| id | finding | fix | evidence |
|---|---|---|---|
| C1 (major) | 官网 on 7 of 24 landmark cards opened the planner place's page | `cityPois.cardOfficialUrl`: a city card (`sf:…`) links only its own official site, none when the landmark has none; district cards keep the planner link first | `sf-verify-c` "C1 / D7"; in game: Fort Point → nps.gov/fopo, Dragon Gate has no 官网 (`ib-card-dragon-en-desk.jpg`) |
| C3 (major) | 6 of 10 CARD_REFRESHES repeated or contradicted their built cards; the Cliff House status | dropped the Castro / Sutro Tower / Sutro Baths / Camera Obscura repeats; one tulip window (the built "约 2–4 月"); `CardRefresh.replaceTips` merges the two car-free tips into one ("东侧一段（2020 年起）和北边 Burnett 大道那头（2021 年起）"); Cliff House status "经营方目标 2026 年底重开，日期未定" (no `until`) | `sf-verify-c` "C3" (each repeat once on the merged card; every replace matches a built tip; a stale match appends) |
| C2 (C's part) | OSM zh names on place cards (中国城 …) | ZH_GLOSSARY: 中国城 → 唐人街, 西索玛 → 西南市场, 索玛区 → 南市场, 普雷西迪奥高地 → 要塞高地 (card titles; lane P's `59fb14b` fixed the map's own names) | `sf-verify-c` "C2 / C6 / C7" |
| C4 | Union Square's cable cars "one block west" | "广场西边的鲍威尔街上就有叮当车经过 / … right along the square's west side" | `sf-verify-c` "C4 / C5 / C10 / C11" |
| C5 | card zones 湖滨区 / 访谷 / 英格塞德台地 vs the HUD | 湖岸区 (5 cards), 维西塔西翁谷 (2), 英格尔赛德 · 台地住宅区; VOICE.md row | same test (checked against `scripts/opus-sf/lib/zones.ts`) |
| C6 (C's part) | two zh names for Lands End / Marina Green | VOICE.md rows (Lands End = 天涯海角; Marina Green stays 码头绿地, never 码头区 — R2-O1 closed); the landmark zone labels read 天涯海角 at runtime (`ZH_TEXT_NAMES`) | same test (`林肯公园 · 天涯海角`, `天涯海角 · 海洋海滩北端`) |
| C7 | English place names inside zh card text; the city goal's "Coit Tower" | `cityPois.ZH_TEXT_NAMES` + `glossZhText`: the game's zh names in the landmark cards' sentences (双峰, 都板街, 北滩, 华盛顿广场, 海洋海滩, 多洛雷斯公园, 苏特罗浴场, 码头绿地, 克里西场, 阿拉莫广场, 威廉明娜女王郁金香花园, 渡轮大厦, 水上公园, 音乐广场); the space an English word kept goes with it; names are never rewritten. The city goal: "登上科伊特塔观景点 · 从 Levi's Plaza 旁的菲尔伯特台阶往上爬" | same test; in game "从龙门沿都板街一路走到北滩的华盛顿广场。" (`ib-card-dragon-zh-375.jpg`) |
| C9 | time-limited statuses never expire | MoAD's closure removed; `statusLive` + `indexPlaceCards(…, now)` drop a status past its `until` month (Bay time) | `sf-verify-c` "C9" (Sunset Dunes' vote note gone after Nov 2026, Twin Peaks' works kept to 2027); `sf-cards` MoAD has no status |
| C10 (C's part) | dead sources (Koret, the Maritime Museum) | Koret → en.wikipedia Golden Gate Park (the first public playground and the 1914 Herschell-Spillman carousel checked there); the dead maritime.org link dropped (nps.gov basicinfo stays) | same test |
| C11 | "the city's biggest park" (the Presidio is bigger) | "…是全城最大的市立公园 / the city's biggest city-run park" (after the recorded phrase: no new recording) | same test |
| C14 (C's part) | 叮 / 当车 in a choice's second line at 375 px | `ui/content-ui.css`: `word-break: keep-all; overflow-wrap: anywhere` on `.ob-choice-sub`; the first line keeps the default CJK breaking (keep-all there pushed a lone "？" onto its own line) | `ib-welcome-375.jpg` ("全城 24 张明信片 · / 叮当车 · 双峰"), `ib-district-welcome-375.jpg` |
| D5 (major) | the parked bike and BAYBAY beat the Clarion postcard in the E prompt | brain `updateFocus` (city): a postcard in reach −0.6 (was −0.25), a parked ride +0.15; the district keeps its weights | `sf-verify-c` "D5"; in game `E 捡起明信片` with BAYBAY 1.5 u away (`ib-clarion-postcard-desk.jpg`) |
| D7 | "Put 唐人街与 North Beach in a BAYLINK p…" | English names the card's own place; the label wraps (content-ui.css) | test; "Put Chinatown Dragon Gate in a BAYLINK plan" on two lines, 59 px (`ib-card-dragon-en-desk.jpg`) |
| D8 | Karl's "called in sick" at golden hour | the city's line moved from `idle` to the `day` pool | `sf-verify-c` "D8" |
| D12 | the lead to the south tower doubled back under the bridge | brain `leadStep` / `ELEVATED_WALKS`: a target on the Golden Gate deck (bridge-local x −100…+100) is led through the deck's south end while you are below it; Fort Point's apron under the deck's south end stays a ground target | `sf-verify-c` "D12" (numbers checked against the bridge model); in game from Crissy Field BAYBAY heads up the lawn to the deck end (−688, 649) and, at the deck end, on to the tower (`ib-deck-lead-desk.jpg`) |
| D13 | journal tabs clipped at 1440 | `.ob-journal` with four tabs: icon over label, each as wide as its words (lane P's `60c239d` added the same stacking in city-ui.css; the two agree) | scrollWidth 364 = clientWidth 364 in English (`ib-journal-tabs-en-desk.jpg`) |
| D14 | postcard clues ended 44–63 u from the card | city: the clue is `clue:<postcardId>` (interactables `registerPrefixResolver`), a walkable spot 8 u from the card toward the place it is named after (`flow.clueSpot`); the district keeps its clue | `sf-verify-c` "D14"; in game the Powell & California clue ends 8.1 u from the card (`ib-clue-lead-desk.jpg`) |
| m2 (C's part) | the photo credit and postcard source links under 44 px | vertical padding on the inline credit links (44 px measured), a 44 px hit box on the postcard source link (the ellipsis moved to an inner span) | measured 44 / 44 in game |
| m4 | the goal chip on the rider's face while riding | city: `objectiveTarget` drops the soft hint while riding (`move.mode === 'transit'`) and within 5 u of it | `sf-verify-c` "m4" |
| F5 (C's part) | reset progress kept memory state | `save.onSaveCleared`: the arrival watcher starts over (the next arrival is a first one), the pacer empties, a running Grand Tour stops without writing its progress back (it did, through its 2 Hz tick); lane G's Settings already clears the line memory, lane P's `59fb14b` resets discovery | `sf-verify-c` "F5" (both parts fail without the listeners) |

Also from the QA runs (not in the findings): at the Palace loop stop "金色时刻！" (the brain's once-per-visit time line)
took the bubble the moment you stepped off the bus, and the stop's hop-off tip (8 s to live) expired behind it — in the
city BAYBAY's own small talk now waits 15 s after a ride or an arrival moment (`SMALL_TALK_QUIET_MS`, test "QA (the
Palace loop stop)"). A lead from the Welcome Center to Fort Point went up to the deck end (the first D12 fix treated the
apron under the deck as a deck target); fixed in `38f2847`.

Findings on other lanes' files were checked against their owners' lists and skipped: F1, D1, D4, D6, C8, C10's
sfexaminer URL, C6's zone data (lane L); F2, D10, B1's HUD part, M1, m1, m2's HUD targets, C14's objective chip,
district F1 / F2, visual F5 / F6 camera (lane G); F3, F4's kit / world parts, visual F1–F4 and F7–F10 (lane V); D2, D3's
car, D11, M2, m5, m6, C13, F4's crowd / traffic (lane T); B1, M3, m3, C12, C2's map names, m2's map tools (lane P,
already pushed: `ddb2b5f`, `f566fcd`, `59fb14b`); F6 eslint (lead, applied in §8.2).

### Part a's list

- **Done**: the photo moment waits for the shutter (photo mode holds the dwell up to 90 s, a shot ends it 3 s later with
  "拍得真好！"; the prompt names the camera where the device has it: phones 更多 → 拍照); the express version's 直接到站
  hint once your own train leaves on a Metro leg > 400 u (`dwellOver` / `wantsSkipHint`, pure, tested); the express
  intro's English says "Skip to stop" like the ride banner; lane V's SF State quad, Music Concourse and Lands End
  postcards on the m-sfsu, n-tea-garden and coast-ride-lands-end stops (sf-tours: every stop postcard is a city card
  within 75 u); the time-sensitive cards expire by themselves (C9); Marina Green decided (stays 码头绿地).
- **The free-roam intro bubble that left after ≈ 1 s** (part a gap), traced with a hook on `flow.set`: with `?start=free`
  the bubble is set about 4 s after load while the city is still streaming and lives its full 4.2 s; the world and the
  page's QA hooks appear only for its last second. The normal start (welcome → 我自己逛逛) shows it after the world is
  up. No product change.
- **The plan's shots** (§5.6), read: the tour intro and version question, the recap, the goals card and the SF State
  card on the phone (part a); the **Stonestown arrival** (desktop golden: 抵达 · 石镇购物中心, 发现新地点, BAYBAY "石镇到啦！
  1952 年就开业了…", lane G's arrival card, `ib-stonestown-arrival-desk.jpg`); the **SF State campus moment on the
  phone** (390 × 844 dpr 3: the toast, "发现 2 个新地点", the line, lane G's ArrivalCard 看介绍 · 拍照,
  `campus:sf-state-university` marked, `ib-sfsu-arrival-390.jpg`); a **hop-off at the Palace** on a real loop ride
  (boarded at Wharf Hyde through lane T's pre-filled row "上车 · 坐到 ★ 艺术宫（约 41 秒）", the upper deck with the
  RideBanner, off at the Palace, `loop:loop-palace-of-fine-arts` counted, BAYBAY "艺术宫到了！绕着湖边的柱廊走一圈吧。",
  `ib-palace-hop-off-desk.jpg`).
- **Not done**: the optional side stops at the Welcome Center (Fort Point, the deck walk) stay pointed out by its lines —
  a probe lead from the Welcome Center to Fort Point runs east round the bluff for over a minute, and the deck walk meets
  D1's wall (lane L) short of the south tower: offer them once D1 and that path are fixed; the stops' two-shot framing
  (`stageMark` / `stopSubject`; lane G's arrival reveal frames the attraction today); the express run timed end to end
  (the plan leaves it to the lead's scripted run); the journal's list of arrival stamps (lane P's 足迹 tab shows the
  arrivals since `60c239d`); the optional ZH_GLOSSARY / PLANNER_DROP clean-up (harmless, kept).

### Evidence

- **Checks** on the pushed tree `3600806` (no commit landed between the last rebase and the push): `npx tsc -p
  tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 warnings, none in lane C's files) · full opus-bay suite
  **838 / 838** (829 / 829, 836 / 836 and 837 / 837 on the earlier pushes). `node_modules/.bin` was empty for a while
  this evening (lane G restored it, `cc2e38f`): the checks ran through `node node_modules/typescript/bin/tsc`,
  `node_modules/eslint/bin/eslint.js` and `node_modules/tsx/dist/cli.mjs`, the same programs.
- **GameRoot** (vite build, `vite.opus.config.ts`): HEAD with part b's first three commits 785.30 kB / 296.45 kB gzip;
  the same tree with lane C's part b reverted 782.39 / 295.16; after W4-IC9 **778.94 / 294.17** (PoiCardBody 6.74 /
  2.99 kB, fetched at idle; a district card rendered 114 ms after `openPanel` on the dev server). `content-ui.css` adds
  1.22 kB / 0.51 kB of CSS.
- **Rendering**: nothing lane C changed draws in the 3D scene (no calls, tris or programs change).
- **District**: every behaviour change is city-gated (focus weights, the soft chip, the clue, small talk); the deck lead
  matches deck targets only. The district welcome at 375 keeps its layout (`ib-district-welcome-375.jpg`) and its Ferry
  Building card opens as before. The English plan button now names the district card's place too (a wording fix).
- **Tests**: new `tests/opus-bay-sf-verify-c.test.ts` (13); changed on purpose: `sf-cards` (MoAD has no status),
  `sf-tours` (stop postcards are city cards within 75 u; the three new ones are on stops).

### Decisions

- **Runtime glossing of lane L's card text**: the landmark cards' zh sentences and zone labels pass through
  `ZH_TEXT_NAMES` in lane C's `cityPois.ts` (the module that already glosses them), so the live cards are right today;
  when lane L rewrites landmarks.ts the rules stop matching (a label L already fixed is never doubled, tested).
- **The clue spot** is 8 u from the card, walkable (`nearestWalkable`), cached once the ground there answered; its name
  keeps "near <the closest real place>". The district keeps the old clue (its cards sit by their POIs).
- **Postcards over company**: in the city a postcard in reach wins the E prompt over BAYBAY at your side and a parked
  ride. Where the map's Ride parks the bike is lane G's.
- **Deck targets** are named by span, not by a height lookup: bridge-local x −100…+100 (the south tower in, Fort Point's
  apron out); a walker counts as up when above 12.2 u on the deck's span.
- **Statuses expire by month** (Bay time, the whole `until` month included); a status without `until` (the Cliff House)
  stays until someone re-checks it — never a closed place shown as open by a guess.

### Known gaps

- D3's data part: the turntable card, Ray's favour target and the fly-there landing are the landmark's arrival spot
  (134.9, 261.0) on the track stub; the card follows lane L's LANDMARK_ARRIVALS (Request below with a spot).
- The loop ride from Wharf Hyde to the Palace was offered as "约 41 秒" and took ≈ 92 s on board (lane T's estimate; the
  same class as D11 / m5).
- Lane G's ArrivalCard 看介绍 still opens `sf:<place>` (Japan Center and the Ferry Building marketplace open their row's
  card): part a's request stands.

### Requests

- **Lane L** (D3): move the cable-car-turntable arrival off the track stub, e.g. to (130.5, 254.0) — standable, 3.1 u from
  the Powell & Market station stop (inside its 4.2 u boarding radius), 3 u beside the track (the car's check is 1.3 u);
  the card, Ray's target and the fly-there landing follow (`sf-tasks` / `sf-content` compare them with the card, no edit
  needed). (C3) the Cliff House summary's ending "计划 2026 年先开街面咖啡馆、年底全部开放" → "2020 年底停业，正在修复，
  经营方目标 2026 年底重开" to match the card's status. (C7) the English names in landmarks.ts' zh sentences may become zh
  at the source (the runtime gloss covers them meanwhile).
- **Lane T**: the loop's ride estimate in the pre-filled row (Wharf Hyde → Palace "约 41 秒", ≈ 92 s on board); the
  `transit-powell-market` stop spot (128.24, 256) sits on the track start (D3).
- **Lane G**: part a's ArrivalCard `onInfo` request (`attractionCardId`); `.ob-postcard-fact`'s English font (D9) is in
  opus-bay.css.
- **Lane P** (optional): `save.onSaveCleared(fn)` is there if discovery wants to follow a reset without a Settings edit.

Relayed owner message during this part: "现在进度如何" (answered in the summary's first line). Higgsfield: 0 credits.

## Integration review

Adversarial reviewer of lane C's integration (parts a and b), 2026-09-27 (21:00–23:10 PDT), worktree
`C:/Users/willy/wt/i4-c` (branch `i4-c`), dev port 5405, scratch `C:/Users/willy/opus-qa/w4i/i4-c/rv/` (QA action
scripts `*.json`, shots `shots/`, `suite1/2.log`, `checks2.log`, `build.log`). Commits on `opus-bay`: `8a99429`, `b196f15`
(W4-C-int-review) and this report.

### 给主人的摘要

1. **进度（回复"现在进度如何"）**：C 线接线的复查做完并已推上去——找到 2 个真问题，都修好了（有测试、有截图），其余检查都通过。
2. **一日游不会再"卡住"**：以前一日游途中，如果在行程卡里点「换个方式」、在地图上让 BAYBAY 带你去别处、点「结束」或者飞过去，一日游就停在原地不再带路，叫 BAYBAY 点「继续」也没反应。现在：换个方式去同一站，仍然算一日游这一站；去别处时提示"一日游先暂停～想接着逛就叫 BAYBAY"，叫她选「继续一日游：带我去 …」就接着带路；自己走到那一站也算到站；一日游也不会再把你自己的行程抢掉或一起结束。
3. **旅行本**里"湾区第一课"以前把一日游走过的站也算进去（显示 3/7 但一站都没勾，按钮还写"继续导览"），现在只算第一课自己的进度。
4. 检查：tsc 0、eslint 0 错误、全套 863 个测试全部通过；主包 GameRoot 没有变大（改动都在按需加载的小包里）；Higgsfield 0 分。

### What was checked

- **Every lane C commit of parts a and b** (`ae3d577` `95dfa46` `2efc5b9` `344bbc2` `fbd13df` `3641b5b` `5697ca7` `38f2847`
  `3600806`, the two reports) and the code around them: `game/{tripRun,cityMoments,cityTour,cityCards,cityDetectors}.ts`,
  lane C's wiring in `game/{flow,brain,cityContent,interactables}.ts`, `data/{save,wishlist}.ts`, `data/sf/{cityPois,goals,
  goalMarks}.ts`, `ui/{PoiCard,PoiCardBody,PlaceCard,EventCard,Moments,CityTourRecap,DistrictRecap,Journal}.tsx`,
  `ui/content-ui.css`, and the other lanes' callers of lane C's entry points (lane G's GuideLayer / Hud / TripCard, lane
  P's placeTrips / CityMap / PlaceActions).
- **In game** (dev 5405, RTX; every shot read). Desktop 1440 × 900: welcome → 一日游 → 完整版 → the first stop; the trip
  card's 换个方式 path (the map opened with the tour trip's id, a map trip to the same stop); a map trip elsewhere; the
  trip card's 结束; the call menu while paused and the resume (lane T's pre-filled "Board · ride to ★ Golden Gate Bridge"
  opened again); the cable-car leg of chapter 5 (`peaks-cable-ride`: BAYBAY's pre-filled row "上车 · 坐到 加州街 & Drumm
  街（约 40 秒）", boarding, `flow.ride` california, the trip in its `ride` stage); the Grand Tour recap (3 of 23 stops,
  lane P's map); the journal's Goals tab. Phone 375 × 667 dpr 3 (touch, quality mid): the paused toast under the
  real-time toast, the paused call menu (5 rows in two columns, scrollWidth = clientWidth on every row), the journal
  after the fix.
- **Card texts after lane L's `a14658e`** (landmarks.ts' zh text rewritten in the game's zh names): a scan of every city
  landmark card's zh summary / tips / bark / hours / cost / zone finds no name doubled by lane C's `glossZhText`; the
  English left is people's names and names the game keeps (Fort Point 炮台, Camera Obscura).
- **Budgets** (vite build of this review over `d118962`, before lane V's `f54e4a3` moved more out of GameRoot): GameRoot 781.19 kB / 295.15 kB gzip (part b measured 778.94 / 294.17 on
  its own tree; the difference is other lanes' commits since). This review's code is all in lazy chunks: `cityTour`
  12.34 kB, `tripRun` 8.90 kB, `Journal` 16.04 kB. Rendering untouched.
- **District**: the journal reads the same field there (the district's tour is always the first lesson); trips and the
  Grand Tour are city-only; the district and hero-regression tests are green.

### Defects found and fixed

| id | defect | fix | evidence |
|---|---|---|---|
| R1 (major) | **The Grand Tour got stuck** whenever another trip replaced or ended its stop's trip: the trip card's 换个方式 (it opens the map; lane P's options start a `'map'` trip), 跟 BAYBAY 去 elsewhere, the trip card's 结束, the map's 带我去 or a fast travel. The tour stayed "leading" with no trip, no waypoint and a pill saying "下一站 渡轮大厦" while you stood there; the call menu's "继续：带我去 …" only closed the menu. Also: a dwell's end replaced a trip the player had started at the stop, and 结束一日游 ended the player's own trip. | `tripRun.start`: a trip to the running tour stop (same place, or an end ≤ 15 u from it: `sameDestination`) is a replan of the tour's trip (its dots, lines, arrival). `cityTour.watchTrip` (2 Hz): the stop's trip missing ≥ 1.5 s or the player's own trip under way pauses the tour with one toast ("一日游先暂停～想接着逛就叫 BAYBAY"); reaching the stop (≤ 12 u of the trip's end, no trip running) counts as arriving; the call menu's first row becomes "继续一日游：带我去 …" / "继续一日游 · 去下一站" (`tour-next` leads again); the tour only ends its own trips (`endTourTrip`) | `tests/opus-bay-sf-int-review-c.test.ts` (4 tests, all red on the old code); in game before: `stuck1` (`qa/w4/C/ir-tour-stuck-before-desk.jpg`: at the Ferry Building stop, the pill still "Next · Ferry Building", no trip 30 s later); after: 换个方式 stays `source: 'tour'`, arrives, dwells, leads to the bus; 结束 → the toast; the menu (`ir-tour-paused-menu-desk.jpg`, `ir-tour-paused-toast-375.jpg`); resume → the tour's trip and lane T's boarding again |
| R2 (minor) | **The journal's Bay 101** read `game.tour.completed`, which holds the Grand Tour's stops while or after it runs: "Bay 101 · 3/7" with no stop ticked and "继续导览" for a lesson never started (it could read 12/7 after a longer tour) | `ui/Journal.tsx` Goals reads the first lesson's own progress (`districtTourProgress`) when `game.tour` is a city tour, as the call menu already did | same test file (the journal test); `ir-journal-before-desk.jpg` (3/7) → `ir-journal-after-375.jpg` (0/7, "Start the tour") |

### Checked, not changed

- `cityCards.applyCards` refreshes the landmark cards in `POIS` in place, so a second apply would add the status twice;
  it runs once per page (the Overlay's `useBoot` guard, never disposed), so it is not a live defect.
- The arrival moment and the tour's arrive line at the same attraction share the frozen line id, so the pacer says it
  once (`arrivalPaced` key = the voice id).
- Part b's requests to lane L are closed by `a14658e`: the turntable arrival moved off the track (131.58, 254.17) and the
  landmark texts use the game's zh names.

### Open (other lanes' files)

- **Lane P / G**: the trip card's 换个方式 opens the map with the trip's `placeId`; for a Grand Tour trip that is the
  stop's interactable id (`transit-loop-ferry-building`, `sf:<landmark>`), which the map does not select (it opens on
  the list with "Now: to Ferry Building", `shots/change-map.jpg`). Picking the stop again now works (R1); selecting it
  for the player would save the search.
- **Lane G**: the real-time toast ("It's night in the Bay right now … See the night view") sits over the recap's stamp
  at 1440 and above the trip toasts on phones; part a's ArrivalCard 看介绍 request (`attractionCardId`) is still open.
- Part b's own gaps stand: the optional side stops, the two-shot framing, the express run timed end to end, the loop's
  ride estimate (lane T).

### Checks

Pushed tree (rebased over `f54e4a3`): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 warnings,
none in lane C's files) · full opus-bay suite **863 / 863** (843 / 843, 854 / 854 and 860 / 860 over the earlier bases). Run through `node
node_modules/{typescript/bin/tsc, eslint/bin/eslint.js, tsx/dist/cli.mjs}` like part b. Dev server on 5405 stopped.

Relayed owner message during this review: "现在进度如何" (answered in the summary's first line). Higgsfield: 0 credits.
