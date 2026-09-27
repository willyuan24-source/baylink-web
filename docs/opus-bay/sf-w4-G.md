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
