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

## Early review

Written 2026-09-27 by lane G's adversarial reviewer (same worktree, branch `w4-g`). Scope: every file of the seven W4-G
commits (`7777cc6` … `a4b9557`), the report above, the plan (§4.2, §5.5) and the lead note; the existing files the
integration plan names (`game/Systems.tsx` project(), `game/hudLayout.ts`, `game/cinema.ts`, `actors/camera.ts`,
`core/runtime.ts`, `game/flowStore.ts`, `opus-bay.css`), lane C's `game/arrival.ts` / `game/trips.ts` and lane P's
`ui/tripRows.ts` / `TripOptions.tsx`.

### 给主人的摘要

1. G 线早期做的东西（算路线时间、景点小旗、屏幕边的目标箭头、行程胶囊和卡片、抵达卡片、观景台地名标签）我逐个查过，还上网核对了 18 条事实和坐标，全部对得上。
2. 修了 12 个问题并补了测试：坐车时胶囊写"下一站 海洋海滩"，和乘车横幅的"下一站 9th & Irving"打架，改成"坐到 海洋海滩"；手机上长名字被切成"彩绘女士（…"；行程卡片每秒把键盘焦点抢回第一个按钮；"飞过去"的提示"骑行成就"用词不对；目标箭头和小旗每一帧都在产生垃圾对象（手机上会卡）。
3. 还要别的线或接线阶段处理：金门大桥没设"到达点"，所以从不推荐观光巴士；"步行到恶魔岛 约 1 分钟"其实是走到 33 号码头；三套"约 N 分钟"的写法要统一成一套。

### What I checked

- **Early-phase rule**: `git show --stat` of all seven W4-G commits and of the three review commits: only lane G's new
  files (and the new test, report and QA files) are touched; no existing tracked file was edited.
- **Checks re-run**: the four lane test files (50 / 50 before the review), `flag-glyphs.mjs --check` (up to date),
  tsc, eslint, the full suite; the lane's real-data outputs (`real-trips.txt`, `flags-real.txt`) re-read against the
  published `transit-w4.json` and lane P's `attractions.ts` (world points unprojected with `core/geo.ts`).
- **Budgets**: flags 1 draw call, 1 program, 32 tris a flag × capacity 16 = 512 tris (plan: ≈ 60 × ≤ 16, 1 call,
  1 program), one 256² atlas: within budget. Nothing else of lane G draws yet.
- **Wiring**: every call of the integration plan against the real signatures (`runtime.camera.yaw`, `isDiscovered`,
  `heightAt` / `groundPending`, `registerWarmup`, cinema `Shot` / `playShots` / `faceCameraToward`, `hudLayout.Box` /
  `HUD_BOX_SELECTOR` / `IGNORE`, C's `arrivalBeats()` / `tripRemaining(trip, progress)`, `FlowRide.stage`).
- **Facts** (18, web-checked; world points unprojected to lat / lng; Δ = distance to the source's point):

| # | fact in lane G's inputs / outputs | source | result |
|---|---|---|---|
| 1 | Coit Tower 37.80238, −122.40583 (a panorama viewpoint) | [Wikipedia](https://en.wikipedia.org/wiki/Coit_Tower) 37.80250, −122.40583 | ✓ Δ 13 m |
| 2 | Twin Peaks overlook 37.75440, −122.44770 | [Wikipedia](https://en.wikipedia.org/wiki/Twin_Peaks_(San_Francisco)), Christmas Tree Point ≈ 37.7547, −122.4464 | ✓ ≈ 120 m, on the summit ridge |
| 3 | de Young Hamon Observation Tower as a panorama viewpoint (free, closed Mondays) | [SF Travel](https://www.sftravel.com/article/discover-san-francisco-de-young-museum), [guide](https://thebettervacation.com/de-young-museum/) | ✓ 9th floor, 360°, free |
| 4 | Grand View Park 37.75645, −122.47184 | [Wikipedia](https://en.wikipedia.org/wiki/Grandview_Park) 37.75646, −122.47180 | ✓ Δ 4 m |
| 5 | Corona Heights 37.76439, −122.43818 | [Wikipedia](https://en.wikipedia.org/wiki/Corona_Heights_Park): summit 37.76465, −122.43914; Randall Museum 37.76439, −122.43813 | ⚠ the point is the museum door; the summit (the view) is ≈ 90 m W (open O3) |
| 6 | Bernal Heights 37.74299, −122.41580 | [Wikipedia](https://en.wikipedia.org/wiki/Bernal_Heights_Summit) 37.74299, −122.41580 | ✓ Δ 0 |
| 7 | M stop 19th Ave & Holloway (SF State) 37.72144, −122.47525 | [Wikipedia](https://en.wikipedia.org/wiki/San_Francisco_State_University_station) 37.72167, −122.47514 | ✓ Δ 27 m |
| 8 | M stop 19th Ave & Winston (Stonestown) 37.72721, −122.47496 | [Wikipedia](https://en.wikipedia.org/wiki/Stonestown_Galleria_station) 37.72722, −122.47472 | ✓ Δ 21 m |
| 9 | Stonestown Galleria 37.72820, −122.47710 | [topozone](https://www.topozone.com/california/san-francisco-ca/locale/stonestown-galleria-shopping-center/) 37.72826, −122.47664 | ✓ Δ 41 m |
| 10 | M Ocean View runs Embarcadero ↔ Balboa Park, with the 19th Ave right of way and its two stations | [Wikipedia](https://en.wikipedia.org/wiki/M_Ocean_View), [SFMTA](https://www.sfmta.com/routes/m-ocean-view) | ✓ |
| 11 | N Judah: Sunset Tunnel west portal at Carl & Cole, east portal at Duboce & Noe; terminus loop at Judah / La Playa | [Sunset Tunnel](https://en.wikipedia.org/wiki/Sunset_Tunnel), [N Judah](https://en.wikipedia.org/wiki/N_Judah) | ✓ |
| 12 | Embarcadero station (the N / M start) 37.79293, −122.39750 | [Wikipedia](https://en.wikipedia.org/wiki/Embarcadero_station) 37.79306, −122.39722 | ✓ Δ 29 m |
| 13 | Alcatraz trips end at 37.80783, −122.40428 | [Alcatraz City Cruises](https://alcatrazcitycruises.com/plan-your-visit/directions): ferries only from Pier 33 Alcatraz Landing | ✓ it is Pier 33, but the row reads "步行到恶魔岛" (open O2) |
| 14 | loop stop Golden Gate Bridge 37.80621, −122.47511 | [Presidio](https://presidio.gov/explore/attractions/golden-gate-bridge-welcome-center): Welcome Center ≈ 37.80650, −122.47457 | ✓ Δ 58 m |
| 15 | Sutro Baths 37.78014, −122.51379 | [Wikipedia](https://en.wikipedia.org/wiki/Sutro_Baths) 37.78000, −122.51361 | ✓ Δ 22 m |
| 16 | City Hall 37.77928, −122.41923 (its flag "over the dome") | [Wikipedia](https://en.wikipedia.org/wiki/San_Francisco_City_Hall) 37.77919, −122.41914; dome 93.7 m | ✓ Δ 13 m |
| 17 | 叮当车 as the zh name of the cable car (`lineDisplayName`) | [新浪旅游](http://travel.sina.com/article/toutiao/2304184b91608a0102vk7c), [BringYou](https://www.bring-you.info/zh-hans/san-francisco-cable-car) | ✓ common usage |
| 18 | lucide-react 0.460.0 glyphs under ISC, the notice in `flagGlyphs.ts` | `node_modules/lucide-react/LICENSE` | ✓ same copyright and permission notice |

### Defects found and fixed (commits `W4-G-review:`)

| # | where | defect | fix (test) |
|---|---|---|---|
| 1 | `ui/TripPill.tsx` TripCard | the key / focus effect depended on `onClose`: the Overlay's 1 Hz re-render with an inline callback re-ran it and pulled the focus back to 跳过这一站 every second (结束 was unreachable by keyboard) | the callback lives in a ref, the first action is focused once on open (`sf-guide-ui`; fails on the lane's file) |
| 2 | `ui/guide-ui.css` | `.ob-waypoint[data-label] .ob-waypoint-label { top: var(--ob-label-dy) }` tied in specificity with opus-bay.css `[data-edge='1'] … { top: 24px }`: the load order decided whether a label beside an edge arrow fell 24 px under it | `[data-label][data-label]` (`sf-guide-ui` computes the specificity of both sheets' rules) |
| 3 | `ui/guideText.ts` pill, zh | on board the pill said "下一站 海洋海滩" right above the RideBanner's "下一站 9th & Irving" (`early-hud-390.jpg`): two different 下一站 on one screen | "坐到 海洋海滩" / "Ride to …" on a line leg (`sf-guide`) |
| 4 | same, phones | full names with a bracketed gloss were cut mid-bracket: "下一站 彩绘女士（…" (7 attractions have one) | `pillName` drops a trailing gloss; an optional `short` (Attraction.short) names the destination leg (`sf-guide`) |
| 5 | same, wiring | `phase: 'waiting' / 'riding'` would not accept `flow.ride.stage` (it is also 'braking' / 'turning'): the Hud step would not type-check | `PillPhase` = the ride stages; braking and turning read as on board (`sf-guide`) |
| 6 | `game/tripPlan.ts` FLY_NOTE, zh | "不算登顶 / 骑行成就": 骑行 means cycling (the goals are cable-car, metro and bus rides) and the game says 目标, not 成就 | "不算登顶和坐车目标" (`sf-trip`) |
| 7 | `game/waypoint.ts` layoutWaypoint, per frame | the search built 51–71 spot tuples on every call and a new box per candidate (up to ≈ 600 objects a call, on every projection change = every frame while the camera moves) | a precomputed slide table and scratch boxes, the results copied; identical to the lane's version on 80,000 fuzzed inputs covering every mode (`review/wpfuzz.mts` in scratch); a test pins that a result never changes after later calls (`sf-waypoint`) |
| 8 | `world/sf/flags.ts` FlagLayer.update, per frame | `forEach` closures in sweep, writeAlpha and the ground re-check every frame | plain loops |
| 9 | `ui/panoramaPlace.ts`, per frame for 10 s | a Map and a NodeList per call and two unconditional `setProperty` writes per tag | the root's children, compare before write (`sf-guide-ui`: an unchanged frame writes nothing) |
| 10 | `game/flags.ts` pickPanoramaTags, wiring | tags anchored at the attraction centre (up to ≈ 10 u off the flag pole, e.g. de Young) and carried no pole height, which the projector needs | `x, z` = the pole foot (as in pickFlags), `h` = the pole top (`sf-flags`) |
| 11 | `game/tripProviders.ts` rideablesFrom (latent) | `/car/.test(id)` made any bike id containing "car" a car (`ride:bike-carl-cole`) | `rideableKind`: only `car-…` ids (`sf-trip`) |
| 12 | tests (missing) | TripRouteCache capacity, LRU refresh, NaN or negative lengths and quantum keys, and the ArrivalCard timer were untested | `sf-trip` (the cache), `sf-guide-ui` (the card times out, holds while hovered, closes on Esc and on its buttons) |

### Open (not lane G's files, or for the integration phase)

- **O1 · lane P**: the Golden Gate Bridge attraction has no `arrival`, so trips aim at mid-span (`ggb-deck-mid`), 214 u
  past the loop's GGB stop (the line rule is ≤ 150 u of walking): the planner can never offer the bus to the bridge.
  An `arrival` at the south-end vista / Welcome Center (22 u from stop 5, plan §3.2) fixes it.
- **O2 · lane P / C**: Alcatraz's arrival is Pier 33 (correct), but every row and the pill say "步行到恶魔岛 约 1 分钟".
  Give the arrival point its own name ("恶魔岛渡轮码头 · 33 号码头") and pass it as the destination name, or add a note.
- **O3 · lane P / C**: Corona Heights' point is the Randall Museum door; the panorama should fire at the summit ≈ 90 m W.
- **O4 · G / C / P at integration**: three time wordings now exist (G `tripTimeLabel` "~6s", C `durationText`
  "不到 10 秒", P `tripSecondsLabel` "~6 s" / "约 1 小时 5 分") and two pill texts (G and C `tripPillText`): pick one each.
- **O5 · integration (TripOptions)**: plan from the position captured when the sheet opens; re-reading `playerPos` in
  every `tripRouteCache().subscribe` callback while the player moves (a bus ride, an auto-walk) starts new A* searches
  on every landing (the live cache keys on a 1 u grid).
- **O6 · integration (Systems.tsx)**: `layoutWaypoint` takes the raw projection plus `behind` (now documented): remove
  the NDC mirroring in the same change, or the arrow points backwards. `placeEdge` mirrors about the safe-area centre
  (≤ 26 px from the canvas centre on phones): only visible for targets just behind the camera plane.
- **O7 · integration (flags)**: the target flag is depth-tested and a far pennant tops out near 48 u, so the plan's shot
  "the gold target flag over the downtown towers" may lose it behind towers: check in game (depthTest off for the
  target role if so).
- **O8**: `YawTurn` / `turnYawToward` are not used by the integration plan (it uses cinema `faceCameraToward` with a
  0.6 s duration): use them or drop them at integration. Panorama tag widths: measure the displayed locale
  (`tagWidth(t(tag.name))`); rank-1 tags are 13 px (the estimate is 12.5 px a CJK character; the 4 px pad covers it).
- **O9 · lane T at integration (step 2)**: lane T's subway now brakes and pulls away at 7 u/s² underground
  (`0a86c3f`); until `registerLineEstimator` hands the planner T's own times (`world/lineTrack.ts` `runSeconds` + the
  stops), the planner's model reads short underground: Embarcadero → Church 38.6 s (T: 42 s), Castro → West Portal
  27.7 s (T: 34 s). The loop lap agrees (model 13.7 min stop 1 → 16, T "坐一圈 约 15 分钟").
- Unchanged from the lane's list: the bike-autopilot owner decision, FLAG_TOPS all `h 30` (lane L),
  `settings.landmarkFlags` (lead).

### Checks (review)

tsc 0, eslint 0 (`src/opus-bay tests/opus-bay-*`); the full opus-bay suite 555 / 555 before the first rebase, 589 / 589 on
`a9b87cb` + the review commits and 591 / 591 on `78b9094` + the review commits (the pushed tree); lane G's tests 50 → 54, plus 4 in the new
`tests/opus-bay-sf-guide-ui.test.ts` (58 / 58). No Higgsfield spend, no dev server. Scratch:
`C:/Users/willy/opus-qa/w4/w4-g/review/` (geo, fuzz and cache scripts, suite logs).

## Integration part a

Written 2026-09-27 by lane G's integration implementer (worktree `C:/Users/willy/wt/i4-g`, branch `i4-g`, dev port 5404,
scratch `C:/Users/willy/opus-qa/w4i/i4-g/`). Scope: the ten routed requests of lead note §8.4, this report's
Integration plan, the other wave-4 reports' steps that name lane G's files (lane T step 6 and its review open 1, lane C
part 2 steps 1 and 6, lane P's flags step, lane V's warm-up), then the plan §5.5 tasks the early phase could not do.

### 给主人的摘要

1. G 线做的"引导"已经真正接进游戏（只在城市模式；街区模式一点没变，街区根本不会下载这些代码）：景点小旗、屏幕边的目标箭头（点一下镜头就转过去）、右上角"下一站 · 约 N 分钟"的行程胶囊和行程卡片（跳过这一站 / 换个方式 / 结束）、"抵达"金色提示 + 6 秒小卡片 + 2.4 秒揭幕镜头、双峰等观景台的地名标签、手动走路时地上的三个金色小箭头、触屏上"自动跟上 BAYBAY"按钮和一次性提示。
2. 修好了第三波留给 G 线的 10 个请求：手机横屏最上面的按钮被切掉、自动带路时往东多走 20 格又折回（渡轮大厦去唐人街）、坐地铁在隧道里还能"提前下车"、渡轮开着时还显示"下车"、BAYBAY 站在渡轮上的玩家身上、F 线车站图标不对等。
3. 坐观光巴士时 BAYBAY 坐在你旁边；车快到景点时镜头会转过去看它；地铁出隧道时回头看隧道口；乘车横幅多了"下一站下车"（手机上是 下一站下车 · 直接到站 · ⋯）。
4. 主包 GameRoot 变小了：新东西都在按需加载的小包里，还把几个界面和"街道名"的计算挪出了主包；和当前线上版本比，791.94 → 781.71 KB（压缩后 298.95 → 294.78 KB，少了约 4 KB）。检查：tsc 0、eslint 0 错误、全套 824 个测试全过；没有花 Higgsfield 积分。
5. 进度（回复"现在进度如何"）：接线部分（part a）已完成，10 个提交（W4-IG1 至 W4-IG10）都已推送；留给 part b 的是 BAYBAY 骑车 / 开车带路时的指路和台词、长距离"直接到站"的过场、地铁出隧道更完整的取景，以及逐个检查每个一级景点的揭幕镜头。
6. 一次失误，已修好：我删除一个临时对照用的工作目录时（`git worktree remove --force`），命令顺着它的 node_modules 链接，把桌面上 baylink-web 共用的 `node_modules/.bin`（tsx、tsc、eslint、vite 等命令的启动文件）删空了。发现后我只重建了这 108 个启动文件（36 个命令，和另一份完好的副本逐字节一致），没有重新安装任何依赖，其它文件没动；现在这些命令都能正常用。

### What was wired (commits on `opus-bay`)

| commit | what |
|---|---|
| `4f5890a` W4-IG1 | the routed wave-3 requests: FocusMarker ring `forceSinglePass` (C2 a1 / b4); `HUD_BOX_SELECTOR` + `.ob-move-buttons > *` (E2 a1); 601–720 px short landscape (667 × 375): the round-button column on the bottom edge, the touch action one column in (E2 review 2: the column ran from y −17); the resident two-shot prefers BAYBAY's side (G2 request 5, as written); Settings reset clears BAYBAY's line memory (G2 review 8, dynamic import); BAYBAY's GLB through `world/models heroGltfLoader()` (D2 c2); `transitGlyph`: F-line stations `streetcar`, ferry terminals by `ferryTerminal` (Pier 41), lane T's `loop-` / `muni-` stops `bus` / `metro` (F a / b); the sf-nav wall clock < 600 ms (G1 a2); moveSystem refuses the hop-off while the ridden line says `canHopOff` false and says why (lane T review open 1, E2 review open); bus / metro glyphs; Settings › 显示地标旗 (city) |
| `f553560` W4-IG2 | one time rule and one arrival toast: `tripTimeLabel` → lane C's `timeLabel`, `arrivalToastText` → `arrivalToast` (lane C part 2 step 1; output-identical) |
| `7091428` W4-IG3 | the city guidance: `game/guideCity.ts` (lazy, city only) + `ui/GuideLayer.tsx` (lazy UI) — flags, the city waypoint, trip pill / card, arrival toast / card / reveal / panorama, chevrons, the touch lead chip + coach mark; the coach mark body, the ride banner and the move chip became their own chunks (`ui/lazyParts.ts`); 提前下车 and the move chip say why on a ferry under way (F review) and in a Metro tunnel; 走走甲板 on the ferry |
| `7287a6a` W4-IG4 | the ride banner's 下一站下车 (lane T's `label.nextStop` / `requestNextStop()`); phones: 下一站下车 · 直接到站 · ⋯ (提前下车 folded) |
| `42fe6f2` W4-IG5 | the trip card on lane C's `skipTripLeg` / `endTrip` / `dismissArrival`; the pill takes lane P's pier short name ("下一站 33 号码头"); ride-camera looks (W4-G9); BAYBAY beside the rider on the bus deck and aft of a rider at the ferry's bow rail (W4-G4 part, E2 review open); RouteWalker cuts to a later leg (G1 review observation, below); the reveal plans from the ground (not a stale `player.y`); the toast's 3.2 s from when it is on screen; flags wait for lane V's late warm-up |
| `cd7c141` W4-IG6 | 667 × 375: the coach mark keeps left of the touch action |
| `3056ede` W4-IG7 | the Grand Tour's pill and dots from lane C's `tourPill()`; the guide layer fetched with `guideCity`; two-line arrival names; a ride-look test |
| `37ef9b2` W4-IG8 (with this report's first version) | far flags stand on the far city's elevation (they waited hidden beyond the streamed chunks: City Hall's gold target flag never showed from the Ferry); the Grand Tour pill and the city area pill live in the lazy layer; the edge arrow's 转过去 is wired by `guideCity` (the district's arrow is back to exactly its old DOM) |
| `cc2e38f` W4-IG9 | this report: the shared `node_modules/.bin` incident (Evidence) |
| W4-IG10 (with this update) | the HUD street name (lane G1, G1-9) ticks from `guideCity` (focus hook `g-street`) instead of `game/discovery`: `game/streets` and `world/sf/format` leave GameRoot (−4.2 kB gzip); the report's final ids and counts |

New files: `game/guideCity.ts`, `ui/GuideLayer.tsx`, `ui/RideBanner.tsx`, `ui/rideHop.ts`, `ui/lazyParts.ts`,
`ui/CoachMarkBody.tsx`, `ui/coachSeen.ts`, `tests/opus-bay-sf-guide-city.test.ts`.

How it runs: `game/Systems.tsx` imports `game/guideCity` dynamically behind `cityMode()` at module load (again on mount
after a failed fetch) and prefetches `ui/GuideLayer`; `initGuideCity()` registers the scene system `g-guide` (FlagLayer,
the chevron InstancedMesh, the panorama projection) and the focus hook `g-street` (the HUD street name), watches
`flow.arrival` (lane C) and the ridden line's `approach` / `portal-out`. The projector calls `guide.cityWaypoint(...)` in city mode instead of the district rule and feeds
`noteObjective` (10 Hz) and `noteHudBoxes`. The Hud and the Overlay mount `TripPillSlot`, `CityTourPill`, `CityAreaLabel`,
`GuideToasts`, `GuideOverlay` (card, panorama tags, trip card) and `GuideLeadChip` through `React.lazy` in city mode only.
None of it is in GameRoot's static graph (tested); the district never fetches it.

### Evidence

- **Checks** (each push: tsc 0, whole-repo eslint 0 errors / 43 old warnings, the full suite): 715 / 715 (IG1), 722 / 722
  and 726 / 726 on the pushed tree (IG2), 748 / 748 and 775 / 775 (IG3–IG5 before the last rebases), **801 / 801 on the
  pushed tree `cd7c141`** (IG3–IG6), 802 / 802 for IG7 and for IG8, 808 / 808 on IG7 + IG8 over `4557809`, 822 / 822 on
  IG7–IG10 over `77c4f81`, **824 / 824 on the pushed tree `4d8d5f3`** (IG7–IG10 over `3b4e38a`). Two failures seen
  during the IG5 rebase (`D2-10 tops.ts`, `W4-IL5 swaps`) were lane L's and red on origin without lane G's commits
  (checked in a scratch worktree at `868b677`); lane L fixed them in `94badf8` before my push. **Honest notes:** the
  IG2 push went out right after a rebase that brought lane P's `W4-P-I1/I2` before the suite was re-run (re-run on the
  pushed tree: 726 / 726); the pushes after racing rebases (lane P, C, L, T commits touching none of lane G's files) were
  re-checked with tsc and the test files those commits touched, and the full suite ran on the pushed tree right after
  (801 / 801 on `cd7c141`, 824 / 824 on `4d8d5f3`). IG7 and IG8 were checked but not pushed before the incident below;
  they went out with IG9 and IG10. E2's timing assert "a cached cell is cheap" (`opus-bay-sf-move2` E2-5: 1000 cached
  `preferredViewDir` calls < 50 ms) failed twice in full runs under machine load (over `b2ea5b6` and on `4d8d5f3`); the
  file passed alone five times and each full re-run passed (809 / 809, 824 / 824).
- **Incident (fixed; honest note).** Late in the part I removed the scratch base worktree of the IG5 rebase check,
  `C:/Users/willy/wt/i4-g-base`, with `git worktree remove --force`. Its `node_modules` was a junction to the shared
  checkout's `C:/Users/willy/OneDrive/Desktop/baylink-web/node_modules`, and the removal followed the junction and
  emptied that checkout's `node_modules/.bin` (the npm command shims; package folders untouched — seen as "'tsx' is not
  recognized"). Fix: removed only the junction link and the scratch folder, then regenerated the 108 shims (36 bins, sh /
  `.cmd` / `.ps1`) from each top-level package's `bin` with scratch `restore-bin.cjs` — no install, no network —
  checked **byte for byte against an intact checkout's `.bin`: 108 / 108 identical**; `npx tsx`, `tsc`, `eslint` and
  `vite` work again and the suite ran from them (808 / 808). The other dot folders of that `node_modules` were
  unchanged. Left behind: the stale metadata folder `.git/worktrees/i4-g-base` (delete refused: permission denied;
  `git worktree prune` or the owner can clear it; it is not a listed worktree).
- **GameRoot** (`vite build`, gzip): the run began at 835.22 kB / 310.79 kB (`32eda15`); IG3 on `ebdc3a7`: 836.80 → 833.46
  kB; IG7 + IG8 on `cd7c141`: 790.68 → 790.51 kB / 298.39 → 298.37 kB; **IG7–IG10 over `a112d5d`: 791.94 → 781.71 kB /
  298.95 → 294.78 kB** (IG10: the street tick took `game/streets` and `world/sf/format` out). City-only chunks: `guideCity`
  38.7 kB (16.3 gzip) + its CSS 9.5 kB, `GuideLayer` 13.5 kB (5.6), `RideBanner` 1.8 kB, `MoveChip` 5.1 kB, `CoachMarkBody` 2.4 kB.
- **Programs / calls**: flags 1 InstancedMesh (1 call, 32 tris a flag, ≤ 6 on desktop / 3 on phones and quality mid) and
  1 program (`g-flags`: 47 → 48 in the city after lane V's boot warm-up; compiled by V's late warm-up ≈ 30 ms after the
  lazy chunk, and the first flag waits for it); chevrons 1 call, 12 tris, the TOY_INST program (own material instance,
  same cache key: no new program); the waypoint, the pill and the cards are DOM. The flags draw over the city (no depth
  test, the pole fading in from the skyline): with the depth test the downtown towers hid every flag from the Ferry.
- **In the game** (screens read; `docs/opus-bay/qa/w4/G/ia-*.jpg`):
  - `ia-flags-ferry-390.jpg`: the Dragon Gate's terracotta Landmark flag over the Embarcadero towers on a phone;
  - `ia-trip-lead-390.jpg`: a trip started through lane C's `startTrip` — pill "Next: The Palace ~2 min", the waypoint
    "Palace of Fine Arts · ~2 min" (the leg's own time), 自动跟上 BAYBAY and its one-time coach mark;
  - `ia-trip-hud-375.jpg`: 375 × 667 during a lead: pill, docked bubble, edge arrow + label, coach, lead chip, 跳, touch
    action, phone bar — no box over another (the HUD boxes read in the page);
  - `ia-trip-card-1440.jpg`: the trip card under the pill (legs, 换个方式, 结束);
  - `ia-reveal-twin-peaks-1440.jpg`, `ia-arrival-card-twin-peaks-390.jpg`, `ia-panorama-twin-peaks-1440.jpg`: the Twin
    Peaks arrival end to end — lane C's arrival beats → the gold toast, the 2.4 s reveal at lane L's photo pose, the peek
    card (photo, 看介绍, 拍照), the panorama tags over their flags;
  - `ia-chevrons-1440.jpg`: the gold chevrons on the pavement while walking by hand on a trip;
  - `ia-hud-667x375.jpg`: landscape: the whole button column on screen, the coach mark clear of the touch action;
  - `ia-district-unchanged-1440.jpg`: `?world=district`: no guide chunk fetched (the resource list has none), the old waypoint.
  - `ia-street-market-390.jpg` (IG10): at `?at=xz:140.9,730.5` the area pill reads Castro/Upper Market · Market Street (also
    at 1440 × 900); a street name set by hand in the page went back to the player's own (none) within one 2 Hz tick, so
    the hook runs from the guide chunk; the district still shows "Ferry Building" with no street and no guide chunk.
  - 转过去: a click on the edge arrow turned the camera from yaw 1.20 to 2.99 (target 2.995) in 1.2 s and brought the pin on
    screen (DOM and camera read in the page).
- **The auto-walk excursion** (G1 w3 review): reproduced in node with the real graph (scratch `walker/walk.mts`): the graph
  route Ferry gate → Dragon Gate crosses the Embarcadero at x ≈ 159 and comes back west to x ≈ 132, while the local path
  of leg 0 crossed at x ≈ 132, walked east to that leg's end (153.4, 30.4) and back. `RouteWalker.refine` now cuts to one
  of the next two leg ends the local grid reaches directly when the whole way gets ≥ 4 u shorter (graph routes only): the
  walker crosses at x ≈ 132 and goes on south. Test in `sf-nav` (max x at z 24–45: 153.4 before, < 140 now; every walked
  point standable).
- **New tests**: `tests/opus-bay-sf-guide-city.test.ts` (9: the city waypoint in a DOM — label under the pin, dropped below
  the bubble, an edge arrow in the phone safe area, hidden within 6 u; trip time from the player; the pier / short names;
  arrival beats → toast / card / panorama; the chevron program; the lazy-import rule; the hop-off notes; the ride look
  bias), `sf-hud` (+1 glyphs), `sf-hopoff` (+1 no hop-off in a tunnel), `sf-nav` (+1 the walker cut).

### Decisions

- **City only, lazy.** Everything new from plan §4.2 lives in two city-only chunks; the district keeps its waypoint rule,
  its lead chip and its HUD exactly (it never fetches the chunks). The early phase's `layoutWaypoint` therefore changes
  the city's waypoint only.
- **GameRoot room** came from moving city-only or later-needed UI out of the static graph (coach mark body, ride banner,
  move chip — prefetched 4 s into play — the city area pill, the Grand Tour pill, the arrow wiring) and the street-name
  tick with the chunk decoder it pulled in.
- **Flags over the city** (no depth test, the pole fading in) — see Evidence; far flags stand on the far city's height.
- **The waypoint's time** during a trip is the current leg's (to the point the waypoint shows: the stop, the place); the
  pill shows the whole trip. Outside trips the G1 rule stays (the map's route, the auto-walk pace).
- **The reveal** uses cinema shots (`revealShots`, no camera change) and the arrival kind's hand-back; it skips a city
  still streaming around the player and never plans from a stale `player.y`.
- **Trip card actions** are lane C's (`skipTripLeg`, `endTrip`); 换个方式 opens lane P's map on the destination (its
  TripOptions). A panorama tag opens the map on the tapped place.
- **The lead chip** on touch from the start of any lead (BAYBAY's state `lead` / `wait`, polled at 4 Hz), hidden while
  auto-walking; keyboard and pad keep the 20 s idle chip.

### Known gaps

- Panorama tags crowd at the horizon: at Twin Peaks 3 of the 8 picked tags find room at 1440 × 900 (the layout lifts a
  tag at most two rows; nothing goes below its anchor).
- The reveal is four eased poses, not the exact arc; at SF State lane L's photo pose looks past a near roof.
- Flags draw over near buildings too (a pole can show on a facade in front of it); the lower pole fades.
- The ferry sun-deck rule moves BAYBAY only when the rider stands at the bow rail; other deck spots keep the old rule.
- `qaTrip` and `__opusBay.guide` are DEV-only QA hooks.

### Not done (part b)

- W4-G4: BAYBAY leading by bike / car (上车吧, pointing 20 u before turns > 45°, the lines at 1/3 and 2/3, the last ≤ 30 u
  on foot; lane C's runner drives the legs, the lines and points are lane G's next step); her LRV spot beside the rider.
- W4-G9: the 直接到站 veil for legs > 400 u; a fuller portal-emergence framing than the look-back.
- E2 w3 review open: blocked zone arrivals swing (the chooser's fallback ignores the subject).
- In-game fps for the flags and chevrons (lane V's gate); a sweep of every T1 reveal pose.

### Requests

- **Lane V**: `g-flags` (and the chevrons on the TOY_INST program) in the perf gate's program check; the flags in the
  11-spot table (they now draw over the city); BAYBAY's GLB loads through `heroGltfLoader()` (IG1): Draco + WebP can ship.
- **Lane C**: `startPanorama()` is exported by `game/guideCity` (E at an overlook); `flow.arrival` is read once per object
  and the peek card's close calls `dismissArrival()`; a `[下一站]` on the card needs a tour "next" entry point.
- **Lane L**: `sitePhoto` of the wave-4 sites drives the reveal (SF State's pose looks over a near roof).
- **Lane E2 / lead**: `opus-bay-sf-move2` E2-5 "a cached cell is cheap" (< 50 ms for 1000 calls) flakes under machine
  load in full runs (passes alone): a looser bound or a relative measure would keep the suite green.
- **Lead**: warn every lane: never `git worktree remove --force` a worktree whose `node_modules` is a junction — remove
  the junction link first (`cmd /c rmdir <wt>\node_modules`), then the worktree (see the incident in Evidence).

Relayed owner message during this part: "现在进度如何" — answered in summary item 5.

## Integration part b

Written 2026-09-27 by lane G's integration implementer (worktree `C:/Users/willy/wt/i4-g`, branch `i4-g`, dev port 5404,
scratch `C:/Users/willy/opus-qa/w4i/i4-g/`). Scope: the wave-4 verify findings on lane G's files (all six finders),
what part a left open, and the plan §5.5 QA shots in the real game at 1440 × 900, 390 × 844 and 375 × 667.

### 给主人的摘要

1. 验收时发现、属于 G 线文件的问题都修好了：手机"更多"菜单被右下角大按钮挡住（点"设置"会打开渡轮）、过场字幕在手机上从词中间断行、几个按钮小于 44 px、坐叮当车 / 渡轮时手机上没法"坐下 / 站起来"、英文目标提示在窄屏上把时间截掉、桌面上目标标签被"问我"小牌挡住、英文明信片撇号后多一个空格。
2. 走路和骑车更可靠：自动走路如果一直走不近就会停下并说"这边走不过去了 · 打开地图换个方式吧"（以前在 41 号码头会来回走一分多钟）；自动骑车会停在明信片 / 居民 / 地点旁边约 3 u 处，不会停在明信片上；前面有人会先等人走开；卡住时会自己绕一下再继续。BAYBAY 坐在车篮里会在转弯前约 20 u 提醒"前面左转 / 右转"，长路程在 1/3、2/3 处各说一句。
3. 镜头：和居民聊天时不再让玩家的背挡住居民，路人站在镜头前会换角度；地标到达时如果正面被挡，镜头宁可留在地标这边也不转走；炮台（Fort Point）的到达镜头贴近、压低；地铁出隧道时镜头拉远一点，整列车和隧道口都看得到；双峰观景台的地名标签从 3 个增加到 7 个（手机 4 个）。
4. 主包 GameRoot 比 part b 开始前还小 3 KB（779.95 → 776.93 KB，压缩后 294.58 → 292.94 KB）：自动骑车的路线计算和 BAYBAY 的转弯提示改成用到时才下载。检查：tsc 0、eslint 0 错误、全套 881 个测试全过；没有花 Higgsfield 积分。
5. 进度（回复"现在进度如何"）：part b 已完成并推送（W4-IG12 至 W4-IG19）；桌面和手机的验收截图在 `docs/opus-bay/qa/w4/G/ib-*.jpg`。还剩下的主要是：几个地标的揭幕机位要 L 线调（唐人街龙门太低、萨特罗浴场被松树挡）、手机 4 倍降速的帧率要在机器空闲时由 V 线重测。

### What was fixed (commits on `opus-bay`)

| finding (verify report) | fix | evidence |
|---|---|---|
| **M1** phone · the 更多 menu under the action button (设置 opened the ferry) | `opus-bay.css`: the phone bar paints above the action (z 2); while the menu is open (`:has(.ob-bar-more)`) the action, its label and the touch move column step aside — `caaaff7` IG12 | real CDP taps at the ferry, 390 × 844: both rows hit-test to themselves, 设置 opens `panel: settings`; `ib-more-menu-390.jpg` |
| **m1** phone · captions broke mid-word (渡 / 轮大厦码头) | `.ob-cinema-caption { width: max-content; max-width: … }` — IG12 | 375 × 667: one line, 321 px; `ib-caption-375-en.jpg` |
| **m2** phone · targets under 44 px (lane G's four) | 跳过 44 px tall; the objective pill's hit area +3 px each way (`::before`); the camera slider 44 px; the hint's × a 44 px hit area mostly inside its label — IG12 | DOM: 跳过 56 × 44, slider 337 × 44, a hit-test 2 px over the pill and 8 px over the × land on them |
| **visual F5 / district F1** the waypoint on 跳 / Hop | (part a IG1: `.ob-move-buttons > *` are HUD boxes) + the touch move column now stands above the projected waypoint (z 9) — IG12 | district 375 × 667 free roam: arrow 316–354 × 322–360, label ≤ 390, Hop 461–517: no overlap; `ib-district-waypoint-375.jpg` |
| **district F2** desktop · the label under BAYBAY's "Ask me" badge | `.ob-ask-me` is a HUD box (`HUD_DECOR`: scanned although aria-hidden) — IG12 | sea-lion viewpoint 1440 × 900: label bottom 789, badge top 795; `ib-askme-waypoint-1440.jpg` |
| **code F2** touch could not sit / stand on a ride | `TouchControls`: 坐下 / 站起来 (56 px) in the move column while on board a moving line, the touch twin of E — IG12 | a real Powell–Hyde ride at 390 × 844: taps flip `move.spot` rail → seat → rail; `ib-sit-stand-390.jpg` |
| **content C14** the English waypoint label lost its time | the city label is two parts: the name gives way with an ellipsis, the time stays (`writeLabel`, guide-ui.css) — IG12 | 375 × 667 en: "Postcard clue · near Ferry Building clock to… · ~4s"; `ib-waypoint-time-375-en.jpg` |
| **desktop D9** a gap after ’ in English postcard facts | `html[lang='en'] .ob-postcard-fact, .ob-title-h1 { font-family: var(--ob-font) }` — IG12 | — |
| **desktop D2** (lane G part) Pier 41: Take me paced 60 s+ | `controller`: a long walk that has not come 2 u closer in 14 s gives up (`failPath`, `pathFailedFar`); the actor system says "这边走不过去了 · 打开地图换个方式吧" — `eb03878` IG13 (+ `e418669` IG13b: the test starts on the walled-in deck once lane T's W4-T16 moved the landing ashore) | node, the real chunks: from the old landing the walk paced (−238, 67) ↔ (−212, 69) for 64 s before, gives up at 19 s now (`sf-verify-g`) |
| **desktop D5** (lane G part) the map's Ride parked the bike on Luz's card | `driveRoute.stopShortOf`: a drive ends ≥ 3.2 u short of a card / resident / place at its end (`parkSpotsNear`) — IG13 (lane C ranks the card over a parked ride) | in game Dolores Park → Clarion Alley: parked at (258.7, 609.2), 4.0 u from the card; `ib-bike-parks-short-clarion-1440.jpg`; test |
| **desktop D6** the bike's Ride gave up 3× from Dolores Park | the autopilot waits ≤ 6 s for a person / traffic held in front (`giveWay` marks it) — IG13; a stuck drive takes a grid route round the spot to the route ≥ 14 u on (≤ 2 per drive) — `8ae3d83` IG14 | tests: a walker in front for 4.5 s → drives on (stuck without the wait); a blocked line → goes round (stuck without it). In game the same drive stuck once at the hairpin (266.5, 629.4) before IG14 and arrived in the runs after |
| **desktop D10** the player's back over the resident | `camera.twoShotPose`: `pairOverlap` (the two bodies' angular widths from the candidate) prices a hidden speaker; a 1.9 × candidate angle; the city's walkers in the lens count like residents — IG13 | test (at 2.4–2.9 u the 0.65 × angle hides the speaker, 1.5 × does not); in game Luz and Dana both in frame; `ib-two-shot-dana-1440.jpg` |
| **visual F6** (camera part) / **E2 w3 review open** blocked landmark zones | a landmark zone with no clear yaw within its width keeps the subject (search twice the width, each step past it priced) instead of the plain chooser — IG13; Fort Point's zone view close and low (9 u, pitch ≤ 0.1: under the bridge's arch) — IG14 | the five F6 arrivals by real fast travel at golden 1440: GGB, Castro (lane L moved the arrival), Chase Center, Grace frame their subject; Fort Point shows the fort's face (a steel column still dithered in front); `ib-arrival-ggb-1440.jpg`, `ib-arrival-fort-point-1440.jpg` |

Findings in files lane G does not own — checked, each is in its owner's list and fixed there: code F1 (lane L `e56e20e`),
F3 (lane V W4-V-I17), F4 (lane T W4-T19 pooled records; kitSwap / sites lane L), F5 (lane P W4-P-I13 and its review),
F6 (lead); desktop D1 (lane L W4-IL11), D3 / D11 (lane T W4-T17 / T18), D4 (lane L W4-IL12), D7 / D8 / D14 (lane C),
D12 (lane C: a lead to a deck goes through its entry), D13 (lane P); phone B1 (lane P W4-P-I11), M2 / m5 (lane T),
M3 / m3 (lane P), m4 (lane C: no soft hint while riding), m6 (lanes T / L); visual F1–F4, F7–F10 (lane V), F2 (V / P);
content C1–C13 (C / P / L / T) and C14's dialogue half (lane C).

### Part a's open items

| item | now |
|---|---|
| W4-G4 BAYBAY rides along by bike / car | `actors/vehicles/driveTalk.ts` (its own chunk): in the basket / front seat she points (`point`) ≈ 20 u before a turn over 45° ("前面左转！" / "前面右转！", the side as the rider sees it) and says a line at 1/3 and 2/3 of a drive ≥ 150 u; one cue every 6 s, none in the first 3 s, never over a line she is saying — IG13, `a0863c1` IG17, `b06a74a` IG18. In game Dolores → Clarion: 前面右转 · 前面右转 · 前面左转 · 前面右转 at the route's corners; `ib-bike-basket-turn-1440.jpg`. On the Metro LRV and every deck she stands 1.1 u aft of a standing rider (she stood on the rider behind the cab) — IG14 |
| W4-G9 直接到站 veil; portal framing | the veil is lane T's (W4-T18: 直接到站 waits under the veil for a far / unstreamed stop). The train out of a portal: the ride camera looks back 3.2 s, pulled back 5 u, a little higher and 6° wider (the whole train and the mouth) — IG14, test |
| E2 w3 review open: blocked zone arrivals swing | IG13 (above) |
| panorama tags crowd at the horizon | tags nudge sideways (the anchor stays under the tag), lift up to 5 rows, then hang under their flag with the leader going up — IG14, `498ace0` IG15. Twin Peaks at golden: 7 of 8 at 1440 × 900 (3 before), 4 at 390 × 844; `ib-panorama-twin-peaks-1440.jpg`, `-390.jpg`; tests |
| every T1 reveal pose | the photo pose of each T1 with a site, seen through the QA camera at golden: GGB, the Wharf, Lombard, the Painted Ladies, the Palace, Twin Peaks, City Hall good; SF State / Stonestown fair (Karl's fog); **Dragon Gate** too low and close (the gate's top leaves the frame), **Sutro Baths** two pines across the ruins, **Union Square** a building edge fills the left half → lane L. Alcatraz, the Ferry Building Marketplace, Golden Gate Park and Coit Tower have no site frame / photo, so no reveal (card only). `ib-reveal-pose-dragon-gate.jpg`, `-sutro-baths.jpg` |
| flags and chevrons in-game cost | below (Evidence) |

### Evidence

- **Checks** (each push: tsc 0, whole-repo eslint 0 errors / 43 old warnings, the full suite): 853 / 854 before the IG12–13
  push — the one failure was my new D2 test after lane T's W4-T16 moved the landing ashore (fixed in IG13b, the rest of
  that tree green); **869 / 869 on the pushed tree `8ae3d83`**; **881 / 881 on the pushed tree `b06a74a`**. One timing
  assert failed once under load (`sf-nav` "A* is time-sliced"); it passed alone.
- **New tests** `tests/opus-bay-sf-verify-g.test.ts` (10): D2 walker on the real chunks (paced 64 s without the watchdog),
  D5 park-short, D6 wait for a walker and D6 way round (each fails without its fix), D10 two-shot overlap, W4-G4 cues (side,
  lead distance, thirds, pace, the opening hold), panorama tags on a crowded horizon and under a high skyline, W4-G9 portal
  framing.
- **GameRoot** (`vite build`): the tree without part b (IG12–IG17 reverted in place) 779.95 kB / 294.58 kB gzip → with part
  b **776.93 kB / 292.94 kB gzip** (−3.0 kB): tap-to-drive's routing (`vehicles/driveRoute`, 9.14 kB) and BAYBAY's drive
  cues (`vehicles/driveTalk`, 2.15 kB) are their own chunks, fetched when a bike / the toy car is mounted.
- **Rendering** — part b adds no draw: the panorama tags, labels and menus are DOM. Measured on the RTX at golden:
  1440 × 900 high at the Embarcadero, 6 flags: 112 calls with the flag mesh, 111 without, programs 58 both; phone mid
  390 × 844: 3 flags picked (≤ 3), 73–81 calls, 283–305k tris. Phone profile at 4× CPU (Embarcadero, 390 × 844, mid):
  35–42 fps, flags hidden 42 vs shown 38 — **void as a gate**: the host CPU was at 57–90 % (other agents); 1×: 57–60 fps.
- **In the game** (screens read, `docs/opus-bay/qa/w4/G/ib-*.jpg`), the plan §5.5 shots:
  - flags from the Ferry toward downtown on phones (≤ 3): `ib-flags-ferry-downtown-390.jpg`, `-375.jpg`; desktop
    `ib-flags-embarcadero-west-1440.jpg`;
  - the gold target flag over the downtown towers from the Embarcadero (a City Hall trip, the flag drawn over the
    towers, the pin "San Francisco City Hall · ~2 min"): `ib-gold-target-city-hall-1440.jpg`;
  - Twin Peaks panorama tags: `ib-panorama-twin-peaks-1440.jpg`, `-390.jpg`;
  - edge arrow + BAYBAY's bubble: `ib-edge-arrow-bubble-390.jpg` (bubble docked under the top row), `-375.jpg` (label
    337–362, bubble ≤ 287: clear), with the trip pill, coach mark and 自动跟上 BAYBAY;
  - BAYBAY leading on foot with the chevrons: `ib-lead-chevrons-1440.jpg`;
  - in the bike basket at a turn: `ib-bike-basket-turn-1440.jpg`;
  - at a stop with the pre-filled boarding: `ib-line-stop-boarding-1440.jpg` (the California cable car to Union Square;
    see Known gaps for the bus);
  - the SF State arrival card on a phone: `ib-arrival-card-sfsu-390.jpg` (抵达 · photo · 看介绍 · 拍照, BAYBAY's line).

### Decisions

- The phone menu hides the action, its label and the move column while open (not only a z-index): a half-covered 跳
  beside the menu read as a second menu row.
- The walk watchdog is for long walks only (the graph route); short walks keep their re-plan-3×-then-give-up rule.
- A drive parks short only of things you walk up to (postcards, residents, cards, places); a plain ground tap drives to
  the point as before.
- The drive keeps going to the drivable point nearest the destination (then the planner's tail walk leg) rather than
  stopping 30 u short as the plan wrote: the player arrives sooner and BAYBAY still hops out for the last steps.
- Drive cues are text + the pointing gesture (no new recording); the words are lane G's (`driveCueLine`).
- A blocked landmark zone never falls back to the plain chooser (the subject stays in frame; the dither thins what is in
  between), after E2's note that narrowing the width alone made it worse.

### Known gaps

- Fort Point's arrival still has one of the bridge's steel columns (dithered) between the camera and the player.
- The sightseeing bus is never offered from downtown: with honest waits (up to a lap) and the loop's length, walking is
  faster from the Ferry to the Palace / the Wharf / the bridge, so the plan's example row "🚌 观光巴士 2 站 约 3 分钟"
  does not occur (the planner works as specified).
- BAYBAY's point is the generic gesture (it does not aim left / right); the words carry the side.
- The phone 4× gate could not be measured on a quiet machine.

### Not done

- Owner feedback of 2026-09-27 (`docs/opus-bay/owner-feedback-2026-09-27.md`, wave 5): F1 (stuck after landing) and F2
  (walking snags) touch lane G's files; the D2 watchdog and the D6 way round are partial answers, the sweep is wave 5's.

### Requests

- **Lane L**: reveal / photo poses — `chinatown-dragon-gate` (too low and close: the gate's top leaves a 16:10 frame),
  `sutro-baths` (two pines between the pose and the ruins), `union-square` (a building edge fills the left half); a
  site frame + photo for Coit Tower, the Ferry Building Marketplace, Golden Gate Park and Alcatraz if they should reveal.
- **Lane C**: the arrival card's [下一站] still needs the tour's "next stop" entry point (part a request); BAYBAY's drive
  cues now wait while any bubble shows (the trip's "骑车出发！" is not stepped on).
- **Lane V**: re-run the phone 4× gate on a quiet machine with the flags on (the 1-call mesh) and the chevrons.
- **Lead / wave 5**: owner feedback F1 / F2 (above) belong with lane G's actors in wave 5.

Relayed owner message during this part: "现在进度如何" — answered in summary item 5.
