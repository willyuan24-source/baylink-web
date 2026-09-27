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
    内河码头站, 叮当车 (unchanged), 都板街 (Grant Ave), 企李街 (Clement St), 尔文街 (Irving St); and R11: SFMTA's own
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
