# Wave 4 · lane G · Guidance, HUD & ride feel

## Early phase

Written 2026-09-27 by lane G (worktree `C:/Users/willy/wt/w4-g`, branch `w4-g`, pushed to `opus-bay`). Early-phase rule
respected: only new files; nothing existing was edited, nothing is mounted, so the game runs exactly as before.

### 给主人的摘要

1. "怎么去"的算时间核心做好了：选一个景点，会算出步行、跑过去、骑车、开车、坐车（观光巴士 / N 线 / M 线 / 叮当车）、飞过去各要多久，全部按游戏里真实的速度和等车时间算，并标出"推荐"。用真实地图数据试过：从渡轮大厦去州立大学和石镇，推荐的是"M 线 约 3 分钟"。
2. 景点小旗子做好了：金色旗杆 + 类别颜色的小三角旗 + 图标，会随风飘，远处也保持看得清（手机上至少约 25 像素），手机最多 3 面、电脑最多 6 面；整套旗子只多 1 次绘制、1 个着色程序（实测）。
3. 屏幕上的"行程胶囊"、行程卡、"抵达"金色提示和 6 秒小卡片、双峰等观景点的地标名字标签都做好了，手机 390×844 和 375×667 上检查过互不遮挡。
4. 屏幕边上的目标箭头规则重写好了：再也不会被 BAYBAY 的对话气泡挡住（被挡时会挪位置、改到旁边、或只显示时间），手机上 99% 的情况能显示完整的"名字 · 约 N 分钟"。
5. 这些都还没接进游戏：等第三波验收后，按下面"Integration plan"一步步接上。

Status: early phase complete (7 commits pushed; the last one carries this report).

### What was built (files, API)

| file | what | API |
|---|---|---|
| `src/opus-bay/game/tripPlan.ts` | W4-G1 the trip planner (pure, injected providers) | `planTrips(from, dest, providers) → TripOption[]` (sorted, ≤ 4, one `recommended`); `TripRouteCache` (async routers → sync lookups, queue ≤ 2, LRU 96, subscribe); goal rules `cableCarGoalRule()`, `arriveYourselfGoalRule(goal, places, note)`, `lineRideGoalRule(goal, lines, note, {minLength, minStops, alightAt})`; helpers `optionSummary`, `optionPending`, `tripTimeLabel`, `tripRemainingSeconds`, `lineDisplayName`, `modelRideSeconds`, `linePathSlice`, `flySeconds`; constants `TRIP_SPEED`, `LINE_MODELS`, `FLY_TIMING`, `LINE_WALK_MAX` / `LINE_WALK_CAP`, `GOAL_SLACK` |
| `src/opus-bay/game/tripProviders.ts` | the live providers for the running game | `tripProviders()`, `tripRouteCache()` (routeTo / driveRoute), `cableTripLines(data)`, `transitTripLine(line)` (transit.json → planner), `rideablesFrom(list, near)`, registries `registerTripLines(key, fn)` (T), `registerLineEstimator({lineWait, lineRide})` (T), `registerTripGoals(key, fn)` (C) |
| `src/opus-bay/game/flags.ts` | W4-G7 which flags stand (pure) + panorama picks / layout | `pickFlags({player, yaw, attractions, discovered, target, max, showDiscovered, panorama}) → FlagPick[]`, `flagMax({phone, quality, panorama})`, `inViewCone`, `viewDir`, `FLAG_RULES`, `FLAG_GLYPHS`, `pickPanoramaTags(eye, yaw, attractions, max 8)`, `layoutPanoramaTags(tags, area, fixed, max)`, `tagWidth`, `isPanoramaViewpoint`, `PANORAMA` |
| `src/opus-bay/world/sf/flags.ts` | W4-G7 the flag mesh | `new FlagLayer({ground, capacity})` → `.mesh` (one InstancedMesh), `.setPicks(picks, now)`, `.update(camera, now, viewportH, dim)`, `.dispose()`; `flagWarmupSet()` registered as `'g-flags'` at module load; pure `flagScaleDistance`, `pennantScale`, `flagGeometry`, `FlagSlots` (0.4 s fades on stable slots), `drawGlyphAtlas` / `makeGlyphAtlasTexture` (256² canvas) |
| `src/opus-bay/world/sf/flagGlyphs.ts` + `scripts/opus-sf/flag-glyphs.mjs` | the 16 lucide glyph node lists (ISC notice), baked by the script (`--check` in sf-flags) | `FLAG_GLYPH_NODES` |
| `src/opus-bay/game/waypoint.ts` | W4-G2 (pure) + W4-G6 math | `waypointSeconds`, `routeRemaining`, `waypointSafeArea`, `placeEdge`, `layoutWaypoint(input) → {x, y, edge, angle, label: {mode: full/short/none, box}, pin, opacity, notch, hidden}`, `turnYawToward`, `YawTurn` (0.6 s), `occludedByTerrain`, `freeHintSuppressed`, `chevronPoses` |
| `src/opus-bay/actors/reveal.ts` | W4-G10 the arrival reveal camera path (pure) | `photoPose(siteFrame, photo)`, `revealAllowed(…)`, `planReveal(start, photo, player, ground)`, `revealPose(plan, t)`, `RevealClock` (step / skip / done / pose), `revealShots(plan)` (game/cinema.ts Shot[] fallback), `REVEAL` |
| `src/opus-bay/ui/TripPill.tsx` | W4-G3 trip pill (objective slot) + trip card (phone sheet 40 %, desktop card) | `<TripPill text dots onOpen open />`, `<TripCard trip title left lines onSkip onChange onEnd onClose />` |
| `src/opus-bay/ui/ArrivalCard.tsx` | W4-G10 arrival toast + 6 s peek card | `<ArrivalToast arrival text? />`, `<ArrivalCard arrival onInfo onPhoto onNext onClose ms? />` |
| `src/opus-bay/ui/PanoramaTags.tsx` + `ui/panoramaPlace.ts` | W4-G8 projected name tags | `<PanoramaTags tags onPick register />`, `placePanoramaTags(root, placed, anchors)` |
| `src/opus-bay/ui/guideText.ts` | the words (pure) | `tripPillText(trip, secondsLeft, {lines, phase, compact})`, `tripLegRows`, `legLabel`, `legIcon`, `arrivalToastText`, `fitText`, `textUnits`, `ARRIVAL_CARD_MS` |
| `src/opus-bay/ui/guide-ui.css` | all styles above + waypoint additions (`data-label`, `data-notch`, `--ob-label-dy`, the tappable arrow) | imported by the three components |
| `src/opus-bay/game/guidePrefs.ts` | Settings › 显示地标旗 (localStorage, try / catch) | `landmarkFlagsPref`, `setLandmarkFlagsPref`, `useLandmarkFlagsPref`, `subscribeLandmarkFlags` |
| `scripts/opus-sf/guide/solo.{html,tsx}` | dev-only QA harness (not in any bundle) | `/scripts/opus-sf/guide/solo.html?view=hud|flags&card=1&pano=1&quiet=1&wp=x,y` |
| tests | `opus-bay-sf-trip` (16), `-sf-flags` (12), `-sf-waypoint` (12), `-sf-guide` (10) | — |

### Evidence

- **Checks** (on the last rebase before the final push): `tsc -p tsconfig.app.json` 0 errors; `eslint src/opus-bay tests/opus-bay-*` 0
  problems; the full suite **531 / 531** green on the final tree (earlier runs under the machine's load failed the known
  wall-clock flakes `opus-bay-audio` "P1 …" and once `opus-bay-sf-nav` "city mode: local A* window …"; both pass alone).
- **Real data, 16 T1 from the Ferry Building** (the published walking graph `graph.obc`, `transit-w4.json` loop / N / M,
  the cable cars; scratch `C:/Users/willy/opus-qa/w4/w4-g/real.mts`): SF State → **M 线 13 站 约 3 分钟【推荐】** · 跑过去 约
  4 分钟 · 骑车 约 5 分钟 · 飞过去 约 9 秒; Stonestown → M 线 约 3 分钟【推荐】; Palace → 跑过去 约 2 分钟【推荐】 · 观光巴士 3 站 约
  2 分钟 · 骑车 约 3 分钟; City Hall → N 线 3 站 约 2 分钟 (N and M on the shared Market St track merged into one row). Every
  plan ≤ 37 ms in node with real A* peeks; in the game the peeks never search (the cache), only the kept legs do.
- **Flags: with vs without** (the harness, RTX, one render of the same scene): programs 1 → 2, draw calls 61 → 62,
  triangles +96 (3 flags, phone) / +192 (6 flags, desktop): **1 call, 1 program, 32 tris a flag** (capacity 16 → ≤ 512).
  Pennant ≥ 25 CSS px at every distance 200–2,800 u on 390 × 844 (scale distance 197 u) and 1440 × 900 (328 u), tested.
- **Real flags from the Ferry looking toward Chinatown** (phone max 3): Dragon Gate 169 u, Coit 182 u, Lombard 325 u;
  desktop adds the Wharf, Alcatraz, the Palace; with a trip to SF State the gold target flag (1,545 u) comes first.
  **Twin Peaks panorama** toward downtown: 彩绘女士★ 市政厅★ 联合广场★ 艺术宫★ 唐人街★ 九曲花街★ 科伊特塔★ 渔人码头★; toward the
  south: 金门公园★ 石镇★ 州立大学★ 苏特罗浴场★ 苏特罗塔 … (`flags-real.txt`).
- **Waypoint layout sweep** (3,040–3,496 target positions × on / behind, the phone HUD boxes): full label 99.0–100 %, the
  pin alone 0–0.1 %, hidden ≤ 1.0 % (a pin on its target right under the bubble waits a frame), with the bubble docked or
  over BAYBAY, at 390 × 844 and 375 × 667; never under the bubble or the HUD (asserted for every position).
- **HUD no-overlap check** in the harness (area pill, trip pill, ride banner, arrival toast, arrival card, bubble, phone
  bar, touch action, 跳 column, waypoint, panorama tags): 0 overlapping pairs at 390 × 844, 375 × 667 (+ trip card, +
  panorama, quiet), 960 × 600 (+ card) and 1440 × 900.
- **Shots** (`docs/opus-bay/qa/w4/G/`, read before describing): `early-hud-390.jpg`, `early-hud-375.jpg`,
  `early-hud-375-card.jpg`, `early-hud-375-pano.jpg`, `early-hud-1440.jpg`, `early-flags-390.jpg` (the terracotta
  Landmark flag at 224 u, swallowtail, cream disc, glyph readable), `early-flags-1440.jpg` (six flags incl. the navy
  GraduationCap and the far rose ShoppingBag). They are the harness with the real CSS and components over a plain backdrop
  (not the game world yet).

### Decisions

- **Honest speeds are pinned to the code that moves the player** (the sf-trip test imports controller WALK / RUN,
  fastTravel phases, travel RIDEABLE_R, CABLE, the autopilot cruises): bike 6.5 / car 8.5 u/s averages sit under the
  autopilot cruises 7 / 10. Consequence, measured: **running (7.5) beats the toy bike's autopilot (6.5)** on most city
  trips, so 跑过去 is often 推荐. That is the honest answer with today's autopilot; if the owner wants the bike to win, E2's
  BIKE_PURSUIT cruise has to rise (not a planner change).
- **Line eligibility on the straight line × 1.25 ≤ 150 u** (not on the A* length): the rows do not appear or vanish when
  the routes land; a real route over 300 u still rules a stop out; the times always use the real route. Without it the
  Ferry → Embarcadero kiosk walk (67 u straight, 155 u on the graph round the hero roadway) hid the M from every trip.
- **One row per mode family, merged shared tracks**: lines on the same board / alight stations (N and M under Market St)
  give one row; the fly row is never 推荐 while anything else reaches the place; a goal option wins 推荐 when it costs ≤
  fastest × 1.5 + 60 s.
- **Planner never floods the A***: candidates are compared with cache peeks, routes are requested only for the legs kept.
- **Flags in their own ShaderMaterial** (fog off, tone mapping off, transparent, no shadow, frustum culling off because the
  vertex shader places everything): one program that no other material shares, registered for warm-up at module load.
  The pennant is a cylindrical billboard (always readable from the side) and its scale distance comes from the viewport
  (`flagScaleDistance`) instead of the plan's fixed d / 300, which gave only ≈ 16 CSS px at 1,200 u on a 390 phone.
- **Glyphs baked from lucide-react** into `flagGlyphs.ts` (0.460 exports no raw nodes; importing React icons into world
  code is not wanted); the script's `--check` keeps it honest.
- **The arrival card on phones stops 84 px from the right edge**: the plan's "72 px above the PhoneBar" put it on the 跳
  button column (actors/TouchControls: right 18 px from 150 px up); desktop keeps bottom-left and stands above the
  prompt band on 721–900 px windows.
- **The arrival toast** shows "抵达 · 名称" with the English name on its own small line in the Chinese locales (a long name
  no longer doubles the toast); it accepts lane C's `arrivalBeats().toast` as its text.
- **Waypoint retreat order**: label under the pin → an edge arrow slides along its edge, then round the nearer corner,
  its label under or beside it → the label drops below the bubble (≤ 90 px) → time only → the pin alone; a pin that itself
  sits under the bubble waits (hidden) rather than overlapping.
- **Reveal as pure math with two outlets**: `RevealClock` for an exact arc in the camera rig, `revealShots` for
  game/cinema.ts as it is today (linear eases between 4 poses). Same rule as C's `arrivalBeats().reveal`.
- **显示地标旗 in localStorage** (`guidePrefs.ts`), because `settings` lives in the frozen store (see Requests).

### Integration plan (after "wave 3 verified"; G owns every file named here unless said)

1. **Trip options (lane P, `ui/TripOptions.tsx` / `PlaceActions.tsx`)**: `planTrips(game.get().playerPos, { placeId, x:
   arrival.x, z: arrival.z, name, attraction }, tripProviders())`; re-plan on `tripRouteCache().subscribe(…)` while open;
   row text `optionSummary(o, lineMap)`, 计算中… when `optionPending(o)`, 推荐 on `o.recommended`, `o.note` under the row;
   跟 BAYBAY 去 = the recommended option.
2. **Lines and estimates (lane T)**: in `data/transit.ts` (or its transit layer) `registerTripLines('t-w4', () =>
   w4Lines.map(transitTripLine))` once transit-w4 loads; `registerLineEstimator({ lineWait: (line, stop, dir) => system ETA,
   lineRide: (line, a, b, dir) => system estimate })` from BusSystem / LightRailSystem.
3. **Goals (lane C)**: `registerTripGoals('c-goals', () => [cableCarGoalRule(), arriveYourselfGoalRule('twin-peaks',
   ['twin-peaks'], …), lineRideGoalRule('metro', ['n-judah', 'm-ocean-view'], …, { alightAt: [la-playa, 19th-winston,
   19th-holloway ids] }), lineRideGoalRule('sightseeing', ['sf-loop'], …, { minStops: 8 })].filter(r => !done(r.goal)))`.
4. **Trip pill + card (`ui/Hud.tsx` Objective, `ui/Overlay.tsx`)**: when `flow.trip` → `<TripPill text={tripPillText(trip,
   tripRemaining(trip, progress), { lines, phase: ride stage, compact: narrow })} dots={tour chapter dots} onOpen={toggle} />`
   (1 Hz selector for the seconds); `<TripCard>` in the Overlay when open: `onSkip` → C's skip-leg action, `onChange` → P's
   TripOptions from here, `onEnd` → C's end; add `.ob-trip-card` to `HUD_BOX_SELECTOR` (game/hudLayout.ts).
5. **Waypoint (`game/Systems.tsx` project(), `ui/Floating.tsx`, `game/hudLayout.ts`)**: replace the edge projection + the
   `placeWaypoint` call with `layoutWaypoint({ x, y, behind, area: waypointSafeArea({ w, h, phone: mobile, dockLeft }),
   labelW: labelHalf * 2, shortW, bubble: bubbleRect, boxes, occluded })`; write `data-label`, `data-notch`, the transform,
   `--ob-label-dx` (label box centre − x) and `--ob-label-dy` (label box top − y); label text = `name · tripTimeLabel(
   waypointSeconds({ pos, target, path: current leg path / RouteFollower route, tripLeft }))`, time only when `short`;
   `occludedByTerrain(camera, target + 3.2, heightAt)` at ≤ 4 Hz. Floating's arrow `<span>` becomes a `<button>` (转过去)
   calling `faceCameraToward(target.x, target.z)`; `cinema.ts` faceCameraToward gets an optional duration (0.6 s) that
   `actors/camera.ts` passes to `startAssist` (today 1.0 s). `HUD_BOX_SELECTOR` += `.ob-arrival-card`, `IGNORE` += `.ob-pano`.
6. **Flags (the city layer mount + Systems ticker)**: in the lazy city chunk (never GameRoot's static graph) `import
   { FlagLayer } from '../world/sf/flags'` before the first warm-up (the import registers 'g-flags'); on enableCity
   `flags = new FlagLayer({ ground: (x, z) => groundPending(x, z) ? null : heightAt(x, z) })`, add `flags.mesh` to the
   scene; at 4 Hz `flags.setPicks(pickFlags({ player: runtime.player, yaw: runtime.camera.yaw, attractions: ATTRACTIONS,
   discovered: a => isDiscovered(a.placeId ?? a.id), target: objective (+ attraction id from flow.trip), max: flagMax({
   phone, quality, panorama }), showDiscovered: landmarkFlagsPref(), panorama }), now)`; per frame `flags.update(camera,
   now, size.height, night ? 0.85 : 1)`; dispose on disableCity. Lane V adds the program to the gate.
7. **Settings (`ui/Settings.tsx`)**: a 显示地标旗 switch bound to `useLandmarkFlagsPref` / `setLandmarkFlagsPref`.
8. **Panorama (C triggers, G shows)**: when `arrivalBeats().panorama` (or E at an overlook), hold `{ eye, until: now + 10 s }`
   (a G module or flow field); Overlay renders `<PanoramaTags tags={pickPanoramaTags(eye, yaw, ATTRACTIONS)} onPick={id =>
   open TripOptions for id} register={…} />`; Systems projects each tag's anchor (x, ground + flag h, z) → `TagInput` →
   `layoutPanoramaTags(inputs, safe area, [...boxes, bubbleRect])` → `placePanoramaTags(el, placed, anchors)`; pickFlags gets
   `panorama: true` for the same 10 s.
9. **Arrival (Overlay + camera)**: on the `arrival` event take C's `arrivalBeats()`: toast → `<ArrivalToast arrival text=
   {beats.toast} />` in the top stack (3.2 s), `beats.peek` → `<ArrivalCard>` (6 s; photo = the -small.webp of
   `Attraction.photoKey`; onInfo → the place card, onPhoto → enterPhotoMode + faceCameraToward, onNext → C's next leg /
   stop); `beats.reveal` → `planReveal(current camera pose, photoPose(siteFrame(landmarkId), info.photo), player, heightAt)`
   then either a `RevealClock` path mode in `actors/camera.ts` checked before `cam.shot` (exact arc) or `playShots('arrival',
   revealShots(plan))` (no camera change).
10. **Chevrons (W4-G6)**: an instanced 3-chevron mesh (TOY_INST, 1 call) fed by `chevronPoses(leg path, player, seg)` while
    `flow.trip` runs and the player walks by hand; hidden while auto-walking.
11. **Hint quiet (lane C, `game/brain.ts` freeHint)**: `allowed &&= !freeHintSuppressed({ trip: !!f.trip, tour, panorama,
    lastArrivalMs, nowMs })` (C's `HINT_QUIET_MS` equals `WAYPOINT.quietAfterArrivalMs`).
12. Tests that change on purpose at integration: none of the existing ones for 1–3 and 6–11; `sf-hud` (G1's HUD tests, now
    G's) for 4–5 if they pin the old waypoint label position.

### Not done (early phase; waits for the integration phase or later G tasks)

- Every wiring step above (nothing is mounted: the early rule).
- W4-G4 BAYBAY riding along / leading by vehicle, W4-G5 LeadChip for every lead + coach mark, W4-G9 ride cameras (bus deck
  look-at bias on T's `approach`, LRV portal framing, the 直接到站 veil hook), W4-G11 the in-game HUD pass at 390 / 375,
  the chevron mesh (only its math exists), the in-game shots of plan §5.5.
- In-game perf numbers for the flags (the harness measured calls / programs / tris; fps only from lane V's gate).

### Requests

- **Lead (frozen `core/store.ts`)**: optionally `settings.landmarkFlags?: boolean` (default false) for 显示地标旗; until then
  `game/guidePrefs.ts` keeps it per device, which is enough for a display preference.
- **Lane C**: (a) one trip-time wording for pill / card / map / ETA chip: `trips.durationText` ("不到 10 秒", "about 3 min")
  and `tripPlan.tripTimeLabel` ("约 8 秒", "~3 min", the waypoint's existing style) differ under 10 s and in English — pick
  one at integration (G will follow C's if C prefers); likewise use `guideText.tripPillText` (icon per line kind, the
  waiting phase, the leg step) or C's `tripPillText` in the pill, not both. (b) `domAnchors.panorama` in `game/projector.ts`
  (else G keeps its own ref). (c) the goal rules of step 3 and the leg progress (0–1) for `tripRemaining`.
- **Lane T**: steps 2 (registries) and the `transit approach` event with `attraction` for the W4-G9 look-at bias.
- **Lane L**: a `siteFrame(landmarkOrSiteId) → { x, y: baseY, z, yaw }` getter (world/sf/sites.ts or landmarks/index.ts)
  for the reveal's photo pose; `siteFlagTop` heights into P's FLAG_TOPS (all T1 flags read `h 30` today; plan §4.2 wants GGB
  on the south tower + 8, City Hall over the dome, de Young over the Hamon tower).
- **Lane P**: TripOptions per step 1; keep `panorama: true` on the six viewpoints (G falls back to its list).
- **Lane V**: the 'g-flags' program in the warm-up / program-count gate; flags in the 11-spot perf table once mounted.
- **Owner decision (G owns actors/** from the integration phase)**: the toy-bike autopilot cruise (7 u/s,
  `actors/vehicles/autopilot.ts` BIKE_PURSUIT) makes running faster than riding on most trips; G can raise it if the bike
  should be the quick choice (default: leave it, the times stay honest either way).
