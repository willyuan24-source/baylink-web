# Wave 2 · lane G1 (map, discovery, fast travel, save v2, HUD)

## Part a-map-travel

Checkpoint §5.7 tasks G1-1, G1-2 (+ CS-8), G1-3, G1-4, G1-5, G1-6, G1-7, G1-9, G1-10, G1-12, plus HC-5 (places on idle)
and CS-14 (travel and resume wait for `whenReady`). Everything is city-mode only. The district map, HUD, title and flow
are unchanged, and the hero regression is green.

### What was built (files, API for other lanes)

| file | what |
|---|---|
| `data/sf/places.ts` (new) | `buildPlaceIndex(file, landmarks, pois)` (pure) and a runtime `loadPlaces()` / `loadPlacesOnIdle()` (HC-5: idle after 1.5 s, `requestIdleCallback`). It has 1,027 places, matches the **24 landmarks** by OSM id, then by the same id, then by the nearest curated place ≤ 40 u, and falls back to a synthetic place (none needed today). A landmark's arrival point is `sfLandmarkAnchor`. **Hero places merge with their district POI** (`poi`) when the ids match or the POI's full name is inside the place name, within 25 u. The 5 merges are Ferry Building, Coit Tower, Exploratorium, Levi's Plaza and Filbert Steps; PIER 39 is not merged into the carousel. `walkable` = graphNode ≥ 0 or hero, which leaves exactly 37 places off the network. It uses 64 u buckets. API: `placeIndex()`, `onPlaces(fn)`, `placeById`, `placesNear(x, z, r)`, `searchPlaces(q)` (zh/en; prefix, then word start, then substring; landmarks first), `ix.landmark(lmId)`. The landmark registry is imported lazily, so the recipes stay out of the main graph. |
| `data/cityZones.ts` | **CS-8**: `LANDMARK_AREAS` / `landmarkAreaAt` sit in front of `zoneAt`. They cover 唐人街 at the Dragon Gate (30 u), 市政中心 at City Hall (45 u), 多洛雷斯公园, 阿拉莫广场 at the Painted Ladies, and 双峰 at Sutro Tower and the summits. Other exports: `cityAreaAt`, `zoneName`, `learnZoneNames(far.zones)`, `farZoneIndexAt(far, x, z)` (zoneGrid) and `zoneLabelAnchor(zone)`. |
| `data/save.ts` | **Save v2**, dependency-free (the title imports it). `decodeSave` treats its input as untrusted. It checks ids against `/^[a-z0-9:-]{1,80}$/`, caps discoveries at 2,000, zones at 64 and ride lines at 32, and the whole save at 64 KB. It accepts finite numbers only; positions a little outside the manifest bbox are clamped, positions far outside are dropped, and headings are wrapped. It never throws. Also: `patchSave(fn)` (writes after 1 s of quiet, flushes on pagehide or a hidden tab, stays in memory when there is no storage), `flushSave`, `clearSave` (Settings → reset), `noteRide(lineId)` (live), `resumeSpot(world)`, `requestResume` / `takeResumeRequest`. `?save=off` turns every write off. Progress v1 is untouched. |
| `game/discovery.ts` (new) | Discovery at **12 u**, 4 Hz, city only, never during travel. Each find emits `discover` (kind `landmark` or `place`). At most **one gold stamp toast plus a `stamp` event per 4 s**; several finds in that window are told together ("发现 3 个新地点：… 等"). `visitZone` (DataSF zone under the player) lifts the map fog and emits `discover` with kind `zone`. `onDiscover(fn)` / `onZoneVisit(fn)` are **G2's hooks**; `?discover=all` is for QA. `initG1()` (Overlay boot) registers one brain focus hook: discovery, the street name, and the **lastSafe + fleet sampler every 3 s**, which saves only on foot on standable ground and only in city mode. It also sets the day-0 `setExtraResolver` for `place:<id>`, radius 12, so `navigateTo('place:<id>')`, the waypoint and `mapTarget` work. |
| `game/streets.ts` (new) | **HUD street name** (G1-9). At 2 Hz it finds the nearest named centreline within 6 u, skipping tram and rail. Sources: the chunk `RoadSet` (main-thread `fetchChunk`, ≤ 1 per s, LRU 6, the HTTP cache already holds it), or `far.lines` while that chunk is on its way. A 1.5 u hysteresis stops the name flickering between streets. `useStreetName()` for the HUD. |
| `game/fastTravel.ts` | **飞过去**. Phases: pickup 0.8 s, rise 1.0 s (top view, pitch 1.1, distance 90), pan `clamp(d/400, 0.6, 3.5)` s, hold, descent 1.2 s. Beyond 1,400 u the pan covers the first 45 % and a cloud veil closes before the cut. The hold waits for `whenReady(dest, 150)` in the cloud and cuts after 8 s; it is skipped when the city is ready. The player is then placed on `arrivalSpot` (standable, or `nearestWalkable` ≤ 40 u) and the camera comes down behind them. `move.mode` is `'travel'` for the whole trip. `focusOverride` is set from the pan onwards and **always cleared** at the end (CS-4). Esc and Skip jump into the hold. Exports for other lanes: `travelActive()`, `travelEpoch()` (bumped at every trip, `?at=` and resume), `travelPose()` (E2's pelican), `useTravelView()`, `arrivalSpot`, `placePlayer`, `bumpTravelEpoch`. The pure `planTrip`, `TripClock` (fake clock), `panPoint`, `tripPose`, `topShot` and `orbitShot` are tested. It is light on purpose (transit.ts imports it): no flow, no places, no three. |
| `game/placeTrips.ts` (new), `game/travel.ts` | `flyTo` (F's `requestHopOff` first when on transit), `takeMeTo` (`navigateTo('place:<id>')`), `driveOption` / `driveThere`: `moveApi.driveTo` while riding; otherwise it walks to the bike or car within 60 u and starts the autopilot once mounted. `cityTravelLabel` gives the game walking time plus the real distance (city `unproject`). `rideableNear`. |
| `game/resume.ts` | `startOrResume()`. A pending title request plus a saved city spot skips the arrival cinematic and places the player at the spot, then waits for the streamer, then `whenReady` (≤ 8 s). After that come `arrivalSpot`, `restoreFleet(save.vehicles)`, `beginPlaying('local')` and the toast "回到上次的位置啦". Anything else is exactly `startGame()`. Also `resolveCityAt` / `goToCitySpot` for `?at=`. |
| `game/qa.ts`, `game/Systems.tsx` | `?at=` also accepts `:`, `.` and `,` (`postcard:…`, `ll:37.79,-122.39`, `xz:120,-40`). `parseAt()`. The QaBridge city path, taken when no district anchor or interactable matches, handles place ids, landmark ids / `lm-<id>`, `ll:` and `xz:`, with whenReady plus arrivalSpot and a re-place when play begins. The Ticker runs `stepTravel(dt)` right after `stepCinema`. |
| `ui/cityMapDraw.ts` (new) | Pure canvas drawing of far.obc in this order: sea, land, lakes, parks and woods, sand, blocks, streets by class (widths grow with zoom), cable-car lines from `data/transit.ts`, neighbourhood borders, then the **paper fog over unvisited neighbourhoods**. That is **≤ 24 fill/stroke ops** per redraw, culled to the view. `paper: true` leaves out the sea and land fills for H2b's painted map. View maths: `toPx`, `toWorld`, `fitScale`, `clampView` (0.8–18×), `zoomAt`, `visibleBox`. Labels: `layoutLabels` (greedy, priority, markers as obstacles). |
| `ui/CityMap.tsx` + `ui/city-ui.css` (new) | `CityMapPanel`. H2b's `<MapPaperLayer/>` goes underneath in a world-space SVG (viewBox = the visible world rect). The canvas draws at DPR ≤ 2 and ≤ 1,800 px, redrawn once per rAF on change. A screen-space SVG on top holds landmark badges (terra = found), curated and found place dots, visited neighbourhood names, BAYBAY and you (heading arrow). Input: drag pan, wheel / pinch / ± zoom, 定位, 全城, and tap-select (22 px). The ODbL credit line links to openstreetmap.org/copyright. Below the map: search (zh/en) and the lists 地标 · 附近 · 去过的. |
| `ui/PlaceActions.tsx` (new) | Buttons: **飞过去** (discovered only, else "去过才能飞"), **带我去** (hidden when not walkable), **骑车去 / 开车去** (riding, or a rideable within 60 u), **详情** (POI-merged hero places; G2's `sf:` card for the rest is pending), and a Google Maps link by coordinates. |
| `ui/MapPanel.tsx` | `MapPanel` sends city mode to the lazy `CityMap` chunk. The district map is the same code, renamed `DistrictMapPanel`. |
| `ui/Hud.tsx` | City `AreaLabel`: the neighbourhood (landmark area first) with the **street on a second line**. The district branch is the old markup, byte for byte. |
| `ui/TitleScreen.tsx`, `ui/Settings.tsx`, `ui/Overlay.tsx`, `ui/Floating.tsx`, `opus-bay.css` | Title: **继续上次的位置** (city with a saved spot; imports `data/save.ts` only), on a row of its own. Reset also clears save v2. Boot calls `initG1()`. Esc and Skip end the travel shots. The cinematic layer has the cloud veil (cream clouds, a 0.45 s fade, reduced motion without drift). |

### Evidence

- **Tests** (node): `tests/opus-bay-sf-places.test.ts` (6), `opus-bay-sf-save.test.ts` (4, including a 3,000-case fuzz corpus), `opus-bay-sf-travel.test.ts` (5), `opus-bay-sf-citymap.test.ts` (5).
  - Places: all 24 landmarks resolve, each arriving at its anchor. Exactly 37 places are not walkable, and all 37 have graphNode −1. The POI merges are checked. Bucket `near()` returns the same places as a brute-force scan, and zh/en search works.
  - Discovery: **11.9 u finds a place, 12.1 u does not**; the 4 s stamp throttle holds.
  - CS-8: every area anchor is within 1 u of its places.json anchor.
  - Street names: Market Street is found near Powell & Market, and the hysteresis holds.
  - Save fuzz: it never throws and never returns an invalid save.
  - Travel phases on a fake clock: pickup 0.8 s, rise 1.0 s, pan = clamp; the hold ends on ready or after 8 s; skip works.
  - `?at=` parsing works, and the old `readQa` cases give identical results.
  - Canvas: ≤ 24 ops; a whole-city redraw at 1,536 px takes **≈ 21 ms in node** (39k path points); street zoom draws under 1/5 of the points; view maths and label layout are covered.
- **Checks**: tsc 0 errors; eslint clean on `src/opus-bay` and the new tests. The full suite ran twice: the first run found one failure, which is fixed (see below); the second run is under "Final run" at the end of this section. Hero regression, the HC-2 guard (`sf-budget`), flow-brain and the contracts test all pass.
- **Budget** (quality=high, 960×600, including shadows, taken from `renderer.info` during a trip from the Ferry Building to Dolores Park): pickup **82 calls / 241k triangles**, top view **78 / 270k**, landing 47–70 / 152–197k. The first version of the pickup shot, low and behind the player, looked at the horizon over downtown and hit **414k**. It now rises along the follow camera's own orbit at pitch 1.0 (`orbitShot`), which fixes it. The map is DOM and canvas: zero WebGL calls.
- **Shots** (`docs/opus-bay/qa/w2/G1/`, SwiftShader; the UI is in English because `?lang=zh` did not switch the headless locale):
  - `hud-market-powell.jpg`: "South of Market / Market Street".
  - `hud-mission.jpg`: "Mission / Folsom Street".
  - `citymap-whole-city.jpg`: whole-city zoom, fog over unvisited zones, landmark badges.
  - `citymap-street-zoom.jpg`: 14× in the Mission, streets by class, the 101 interchange, the Mission de-fogged.
  - `citymap-mobile.jpg`: 390×800 at the Dragon Gate, with the HUD reading "Chinatown / Grant Avenue" (CS-8).
  - `fasttravel-sheet.jpg`: pickup, top view, descent over the Marina, landed at the Palace lagoon (the player stood at (−409, 407), `move` = foot, no cinematic, not locked).
  - `fasttravel-pickup-high.jpg`: the new steep pickup at the Ferry Building.
  - `resume-title.jpg`: the title with "Back where I left off".
  - `resume-landed.jpg`: resumed at Alamo Square ((−7, 572), phase playing, mode free, and the HUD shows "Alamo Square", CS-8).

### Decisions

- **Lazy boundaries.** The landmark registry (recipes) is only imported dynamically, by `places.ts` and `resume.ts`. `fastTravel.ts` imports no flow and no places. `CityMap` is its own chunk behind `MapPanel`. The HC-2 guard stays green.
- **Fast-travel camera.** Every shot is a `runtime.camera.shot`: eased for pickup, rise and descent, and one frame long during the pan. There is no `Shot.until` in `cinema.ts` (not needed). The cloud veil is DOM, so it costs no draw calls. During the trip the avatar stays at the start until the teleport at the end of the hold (E2's pelican pose, see Requests).
- **Save and resume are city-only.** The sampler never writes in district mode, and the title offers resume only for a saved city spot, so the district title and flow stay exactly as they were. `lastSafe` is only taken on foot on standable ground, and resume still snaps with `arrivalSpot` after `whenReady`.
- **详情** only for POI-merged hero places until G2's PoiCard accepts `sf:` (contract §6); every place gets a Maps link by coordinates (DESIGN §8).
- **Street names are English** (OSM `name`) in both locales, marked `translate="no"`.
- **Save writes stay in memory when there is no storage.** The first full-suite run failed F's `sf-transit` test: F already calls `noteRide`, and `patchSave` hooked `window.addEventListener` on the node test's stub `window`. `patchSave` now stays in memory when there is no storage, and the test passes.

### Known gaps

- The avatar is not carried by the pelican during the trip. `travelPose()` is ready (Requests, E2).
- The map shows far.obc blocks and main streets only (tertiary and up; residential names are not in far.lines). Street zoom looks tidy but has no house-level detail.
- 骑车去 / 开车去 when not riding walks you to the rideable and starts the drive once you are on it. That `game.subscribe` path was not screenshot-tested; it depends on E2's `driveTo` accepting the target.
- Discovery toasts use the current locale. The discovery flow was verified by test and state reads, not by a toast screenshot.

### Not done (for the next part)

- G1-8: 带我去 route polyline on the map (`routeTo`) with an honest time label, and the 2 Hz leg feeding if E2-1 is not in.
- G1-11 Footprints tab. G1-13 `travel.ts` clean-ups (import `WALK_SPEED`).
- CS-7 / M0 debug line (warm-up ms, "+N programs since warm-up", the stale tier). DR-3 HUD crowding. DR-4 goals card over cinematics.
- DEV `exportPng` for H2b. BAYBAY / rideables / route layers on the map overlay beyond the current markers.
- G1-15 remaining shots: Sunset and waterfront HUD, fog before and after, `?debug`, calls with the map open vs closed, a cloud-cut trip (> 1,400 u) contact sheet.

### Requests

1. **E2** (`actors/moveSystem.ts` / `actors/system.ts`): in `move.mode === 'travel'`, pose the pelican with the rider (and optionally BAYBAY) from `travelPose()` in `game/fastTravel.ts`: `{ phase, t, x, y, z, heading }`, where y is the ground height plus lift, cruising at +48 u. Hide or carry the walking avatar from `phase === 'pickup'` until the end of `'descent'`; the flow places the player on the arrival spot when the descent starts.
2. **E2** (`actors/moveApi.ts`): an optional `setGlideUnlocked(v: boolean)` so save v2 `unlocked.glide` can be restored on resume. G1 would write it from `glideUnlocked()` in the sampler.
3. **G2** (`ui/PoiCard.tsx`): accept `openPanel('poi', 'sf:<placeId>')` and render the card from `sfLandmarkInfo(place.landmark)` or `placeById(id)` in `data/sf/places.ts` (read-only import). G1 then shows 详情 for every landmark and curated place. Contract §6 row G1 → G2.
4. **G2** (`ui/Journal.tsx`): nothing needed yet. `FOOTPRINTS_TAB` stays null until G1-11.
5. **Lead** (outside Opus paths, `vercel.json`): an immutable cache header for `/opus-bay/sf/v1/**`. The HUD street name re-fetches the chunk under the player on the main thread (≤ 1 per s, LRU 6) and relies on the HTTP cache.

### Final run

Before the final push: full suite **275 / 275 passed**, including the hero regression; tsc 0 errors; eslint 0 errors and 0 warnings.
