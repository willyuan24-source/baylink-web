# Wave 3 · lane G1 (map, discovery, fast travel, save v2, HUD)

## Part a

### 给主人的摘要

- 地图终于能看见地名了（以前的 bug 让地标名字一个都不显示）；手绘地图在陆地上也露出来了。
- 选中一个地方，地图上会画出走过去的路线，并标出"真实要走多久"（实测：地图说约 40 秒，实际 39.7 秒到达）；按"带我去"后路线变成金色，再打开地图会显示"正在去 X · 还要走约 N 秒"，可以随时"不去了"。地图上还显示 BAYBAY 的头像、附近的单车和小车。
- 旅行本新增"足迹"页：去过的地标（x/24）、景点、街区（x/41）、坐过的车，点一下就在地图上找到它。
- 手机上 HUD 各元素不再互相遮挡（夜景提示、目标卡、明信片线索、BAYBAY 对话、新的"跳"按钮、提示条都检查过 390×844 和 375×667）。
- 叮当车 / 渡轮站的按键图标按线路显示；坐车次数和滑翔解锁会存档并在下次恢复；调试行能看到着色器预热耗时和真实画质档位。
- 没用 Higgsfield 额度（0 分）。

### What was built (files, API for other lanes)

Commits on `opus-bay` for this part (the first three are from the run that was cut off at 03:40; they were checked
again on today's tree):

| commit | task | what |
|---|---|---|
| `4002e25` | 1 · H2b's paper patch | `ui/cityMapDraw.ts`: with `MAP_PAPER` the canvas skips the lake / park / wood / sand / block fills, strokes the far land rings as the coastline, fades streets in from 0.8 px/u; unvisited-neighbourhood fog over the paper .82 → .7. Without paper nothing changes. ODbL credit and `?paper=0` kept. Reviewed, not applied blindly. |
| `6bf5067` | 2 · M1 / DR-3 / DR-4, 3 · P8 | One **top stack** under the pills (night-view banner, ride banner, the goals card on phones, toasts) instead of four absolute boxes; `game/hudLayout.ts` reads the fixed HUD boxes (after a HUD mutation, a size change or every 4 s, only while a bubble / the waypoint is up) and places BAYBAY's bubble and the waypoint around them. DR-4: the goals card never shows during a cinematic or a trip. P8: `project()` runs only when the camera, the anchors, the bubble or the HUD boxes changed; the objective is refreshed at 10 Hz; style / data writes only on change. |
| `eea5179` | 4 · F's requests, 7 · glide | `ui/transitGlyph.ts` + `InteractIcon`: a `source: 'transit'` prompt shows a cable car or a ferry by the lines at that station (the district F-line stop keeps the tram). Save v2 `rides` reconciles `transit.rideLog()` in the 3 s sampler (never counted twice). `unlocked.glide` mirrored from E2's `moveApi.glideUnlocked()` and restored with `setGlideUnlocked(true)` at boot and once more when play begins; Settings reset locks it again. |
| `738abd4` | G1-13 | `game/travel.ts` reads the controller's `WALK_SPEED` (no copy) and shares one metres / km formatter. District labels unchanged. |
| `c048ed2` | G1-5 fix | **No place label ever rendered** on the city map (wave-4 scouts found it): each label box touched its own 10 px badge, which counted as an obstacle. `layoutLabels` now takes obstacles with ids, never tests a label against its own marker, tries four spots (above, right, left, below), keeps clear of the tool column and the ODbL line; labels draw in their own layer over the badges. Zone names are learned before the first render with `far.obc` (the list read "San Francisco" until then). |
| `92419d8` | G1-8 | **带我去 route on the map** (below). |
| `a7ab40f` | G1-11 | **足迹 tab** (below). |
| `0445f37` | CS-7 / M0, DEV export | The `?debug` line: `warm-up 1177 ms → 31, +4 since` and `q mid (device)` / `q mid (started high, default)`; `runtime.perf.tier` kept in step (it said `high` forever). `__opusBay.g1.exportMap({ px, fog, paper, download })`. |
| `637bc2f` | M1 follow-up | Re-ran the HUD sweep on today's tree: E2's new 跳 / Hop button and G2's longer city goals card (邻居的小忙) collided with the coach mark and the toasts. Fixed (below). |
| `dcd99c6` | G1-15 | The remaining shots; the HUD no longer says a place twice ("Pier 39 / Pier 39"); `?debug` wraps on phones. |
| last commit | report | this report; 足迹 names F-line / ferry rides; the title reads G2's optional `CITY_COPY.greet`. |

**G1-8 · 带我去 on the city map** (`game/mapRoute.ts` new, `game/travel.ts`, `ui/CityMap.tsx`, `ui/PlaceActions.tsx`, `ui/cityMapDraw.ts`, `game/Systems.tsx`)
- `game/mapRoute.ts` (new, G1): `planRoute(from, to, source?)` → `PlannedRoute { from, to, points, length, snapped } | null | undefined` from E2's `routeTo` (the same walking graph, snapping and local grid the auto-walk itself uses; time-sliced A*), one plan at a time (a newer request aborts the older), the last 6 kept (`cachedRoute(from, to)`: same goal, start within `REPLAN_U` = 20 u); `routeLeftTo(to, pos)` (what is left of a kept plan for someone within 25 u of it); `tripPlaceId()` (flow.mapTarget `place:<id>`); `endTrip(arrival?)` (drops the target, stops the auto-walk if it was heading there).
- `game/travel.ts`: `autoWalkSeconds(length)` — the auto-walk eases into a run (7.5 u/s) while more than 30 u are left and walks the last 30 u (4.2 u/s); `routeTravelLabel(points)` = that time + the real km along the route ("沿路走约 40 秒 · 现实约 2.0 公里"); `routeMeasure`, `routeAhead(points, pos)` (the polyline still ahead, and how far off it you are); `secondsLabel(s)` (the shared rounding: every old label reads the same).
- The map: the selected place gets a **teal dotted preview** with a time chip at its end; while 带我去 is on it is **gold dashed**; a "whole route" tool button; the map opens on a trip selected and framed, with a strip "正在去 唐人街龙门 · 还要走约 25 秒 [不去了]". PlaceActions: 找路中… → the route time; 走不过去 (带我去 hidden) when no route exists; 详情 for every place now (G2's `sf:<placeId>` card landed in `eafcef8`).
- Layers: BAYBAY as her face (22 px); parked bikes and the toy car from 2.5× (their spots, or E2's `fleetSnapshot()` where you left them; the one you ride is skipped); the selected place's name always reads (`LabelItem.over`).
- The in-world waypoint for a planned place says the same time as the map (auto-walk pace while 带我去 walks you, walking pace when you walk it yourself); other targets keep the straight-line estimate.
- `openPanel('map', '<placeId>')` opens the city map selected on that place (used by 足迹).

**G1-11 · 足迹** (`ui/Footprints.tsx`, `ui/footprintsData.ts` new, `ui/cityHooks.ts` new, `game/discovery.ts`)
- `FOOTPRINTS_TAB` is set in city mode only (the district journal keeps its three tabs; checked). Four counts (地标 x/24 · 景点 x/46 · 街区 x/41 · 去过的地点 n), 最近发现 (8, newest first), the 24 landmarks (found or not), the neighbourhoods as chips, 坐过的车 from save v2 `rides` (cable-car line names from `data/transit.ts`, F-line / ferry by kind). A find or a landmark opens the map on it.
- `footprintsSummary(...)` (pure, tested on the real place index); `discoveredIds()` / `visitedZoneIds()` in `game/discovery.ts`; `useFar()` / `usePlaceIndex()` shared by the map and the tab.
- Four tabs on a phone stand the icon over the label (`.ob-tabs:has(> button:nth-child(4))`, ≤ 480 px): "明信片" wrapped letter by letter at 390 px.

**M1 follow-up** (`game/hudLayout.ts`, `opus-bay.css`): the phone coach mark keeps to the left of the right-hand touch column (E2's Hop at 18 px from the edge); the phone goals card is capped (`100dvh − 380 px`, scrolls inside) so the top stack ends above that column with room for two toasts; a HUD box that is still animating (the goals card slides in over 0.5 s) is read again once it settles (looping pulses are ignored).

### Evidence

- **Checks** on the tree of this report commit (rebased on the other lanes' pushes): `tsc -p tsconfig.app.json` 0 errors; `eslint src/opus-bay tests/opus-bay-*` 0 problems; `tests/opus-bay-*.test.ts` **591 / 591** (incl. hero regression and contracts; 568 / 568 on `dcd99c6`). Every push ran tsc, eslint on the changed files and the tests touched by the incoming commits plus G1's, contracts and the hero regression after its last rebase (the other lanes push every few minutes); the full suite ran on each commit before it. Under six lanes' load two wall-clock asserts flaked once each (E2's `sf-nav` "window build < 200 ms", F's P1 audio slices) and passed on the re-run; my own citymap redraw assert was loosened for the same reason (the op count stays the real budget).
- **New tests**: `sf-citymap` (a label never collides with its own marker; four spots; the selection rides over dots; reserved boxes; `fitPoints`, `thinPx`), `sf-travel` (`autoWalkSeconds` monotonic and = 40.1 s for 280 u, old labels identical; `routeAhead`, `routeTravelLabel`; the planner aborts, caches, and `routeLeftTo`), `sf-places` (足迹 counts on the real index), plus the earlier `sf-hud` (M1 layout, transit glyph) and `sf-save` (rides reconcile) cases.
- **带我去 honesty**: Ferry gate → Dragon Gate, the map said "~40s / 2.0 km for real"; pressing 带我去 arrived in **39.7 s** (position log every 0.5 s).
- **P8** (from `6bf5067`, CPU profile at 4× throttling): the DOM projection 0.55 % → 0.26 % of the main thread standing, 0.64 % → 0.49 % walking (incl. the new layout work).
- **HUD sweep** (scripted, box-overlap check of every HUD element): 390×844 zh and 375×667 en, 8 free-roam states (bubble + clue, night banner + goals, toasts, coach, dialogue, map + toast, trip, landed) and 4 riding states, and 1440×900: no overlaps except the bottom bar under a modal map sheet (intended) and a < 300 ms moment while the goals card slides in over a waypoint that then waits.
- **Draw calls, map open vs closed** (alternating twice): 86 / 84 / 82 / 83 / 81 at 1440×900 high, 76 / 74 / 72 / 73 / 70 at 390×844 mid — the map adds none (DOM + 2D canvas).
- **Cloud-cut trip**: Ferry Building → Dutch Windmill, 1,527 u: pickup, rise, pan, cloud veil at 4.0 s, descent, on foot at 6.5 s.
- **Debug line** at the Ferry gate (quality high, desktop): `warm-up 1061–1177 ms → 31–33 programs, +4–6 since` — the P5 drift C2 is chasing, visible at a glance now.
- **Shots** (`docs/opus-bay/qa/w3/G1/`): `map-paper-before-after-desktop.jpg`, `map-paper-after-390.jpg` (task 1); `hud-390-before-after.jpg`, `hud-375-ride-goals-map.jpg`, `hud-960-desktop-after.jpg` (task 2); `prompt-cable-car-glyph.jpg` (task 4); `map-labels-before-after.jpg`; `route-take-me.jpg`, `route-waypoint-390.jpg` (G1-8); `footprints-tab.jpg` (G1-11); `hud-w3-recheck-phones.jpg` (M1 follow-up); `hud-sunset-waterfront.jpg`, `map-fog-before-after.jpg`, `debug-line.jpg`, `trip-cloud-cut-1527u.jpg` (G1-15). Scratch and the QA scripts (`route.sh`, `steps.sh`, `hud-states.mjs`, `calls.mjs`, `trip.sh`, `fog.sh`, `push2.sh`) are in `C:/Users/willy/opus-qa/w3/g1/`.

### Decisions

- **The route comes from E2's `routeTo`, not a copy.** The preview and the auto-walk share the graph, the snapping and the local grid, so what the map draws is what you walk. The planner lives in a new G1 file; E2's files are untouched.
- **The time is the auto-walk's, not walking pace.** 带我去 runs beyond 30 u (A11), so "route length / 4.2" would say twice the real time. The label says "沿路走" and the real distance next to it; measured within 1 s.
- **Route in the SVG overlay, not the canvas**: it changes as you walk while the base layer does not; one polyline thinned to 1.5 px steps.
- **The goals card, not the waypoint, gives way on small phones**: the card scrolls inside above the right-hand column; a waypoint with no free spot keeps waiting (the M1 rule).
- **The warm-up figures come from a probe in C2's warm-up set** (`registerWarmup` with no objects: `make` marks the start, `dispose` runs after `compileAsync`) instead of a change in C2's GameRoot.
- **详情 for every place**: G2's `sf:<placeId>` card exists now; the district POI card still wins for merged hero places.

### Known gaps

- The map labels only fit a few names in the dense north-east at city zoom (the fix makes them appear at all; the wave-4 plan's tiers and clusters are the real answer).
- The route preview is a walking route even while you ride (骑车去 / 开车去 use E2's drive route, which the map does not draw).
- A < 300 ms overlap while the goals card slides in over a waypoint (the scan runs at most 4 times a second).
- `exportMap` exports the vector layer only (H2b already renders its own base; the export is for registration / QA).
- On phones C2's city-streaming `?debug` panel (world/sf/stats.ts) sits over the coach mark and the Hop button (debug only; request below).
- The fast-travel avatar still stays at the start during the trip (E2's pelican carry from `travelPose()` is not in yet).

### Not done

Nothing from this part's list is left. For the lead / wave 4:
- W4-G1's `tripPlan.ts` (on origin) plans walk times with its own route cache; `game/mapRoute.ts` (`planRoute`, `routeLeftTo`) and `travel.ts` (`autoWalkSeconds`, `routeTravelLabel`, `routeAhead`) can serve it so the map, the trip options and the waypoint agree on one number.
- The `vercel.json` immutable cache header for `/opus-bay/sf/v1/**` (wave-2 request 5) is still open.

### Requests

1. **E2** (`actors/moveSystem.ts` / `actors/system.ts`, open since wave 2): in `move.mode === 'travel'` pose the pelican with the rider from `travelPose()` (`game/fastTravel.ts`: `{ phase, t, x, y, z, heading }`, y = ground + lift, cruising +48 u); hide or carry the walking avatar from `pickup` to the end of `descent`.
2. **E2** (`tests/opus-bay-sf-nav.test.ts` line 180): `navWindowStats.lastMs < 200` flakes when six lanes share the machine; allow ≈ 600 ms or drop the wall-clock part (the build count is the real check).
3. **C2** (`world/sf/stats.ts`, the `?debug` city-streaming panel): on ≤ 720 px screens it covers the coach mark and the Hop button; use `font-size: 10px; max-width: calc(100% - 12px); white-space: pre-wrap` and place it under G1's debug line (which now sits at `top: 116px + safe area` on phones), or show it only above 720 px.
4. **G2** (`data/sf/copy.ts`, optional): add `greet?: Bilingual` to `CityCopy` (a city first-visit greeting for the title, e.g. "嗨～这次我们逛整座旧金山！"); `ui/TitleScreen.tsx` already shows it when present and falls back to today's line.

## Review

Adversarial review of lane G1's wave-3 part, 2026-09-27, in the lane's worktree (`w3-g1`, dev server 5205, real GPU).

### 给主人的摘要

- 把 G1 这一波的 11 个提交都读了一遍，又在电脑、手机和平板上实际玩了地图、"带我去"、足迹页和 HUD，找到 7 个问题，都修好了。
- 最明显的三个：地图开着时"带我去"的剩余时间会跳（40→35→40→25 秒），现在地图、路线牌和头顶路牌说同一个数；搜出来还没去过的地方在地图上没有标记；平板和小窗口里目标卡盖住"坐渡轮"提示、大按钮压住"地图 / 问 BAYBAY"。
- 另外修了路牌文字刚出现时一半跑出屏幕、离开游戏后旧界面没被释放。剩下几个小问题（都不影响正常玩）写在下面。

### What was checked

- **Code**: the diffs of all 11 wave-3 commits (`4002e25` `6bf5067` `eea5179` `738abd4` `c048ed2` `92419d8` `a7ab40f` `0445f37` `637bc2f` `dcd99c6` `9c89412`) and the code around them: `game/{hudLayout,mapRoute,travel,Systems,discovery}.ts(x)`, `ui/{CityMap,cityMapDraw,PlaceActions,Footprints,footprintsData,cityHooks,transitGlyph,Hud,Overlay,TitleScreen,Settings,icons}.ts(x)`, `data/save.ts`, the G1 block of `opus-bay.css`. Looked for races (rapid selection, superseded plans), leaks on unmount, per-frame work, district changes, touch paths, overflow on phones, and report claims.
- **Checks**: `tsc -p tsconfig.app.json` 0 errors; `eslint .` 0 errors (the worktree's own `.vite-opus/deps` prebundle cache lints with 12 "rule not found" errors: a local artefact CI never sees, skipped with `--ignore-pattern`); `tests/opus-bay-*.test.ts` **601 / 601** before, **602 / 602** after the fixes, **642 / 642** after rebasing on `7ee36f1` **651 / 651** on the pushed tree (`330f63c` on `515fb30`) and **653 / 653** on the tree of the last report commit (on `f24d337`; hero regression + contracts green). The trip series and the tablet / 800×600 sweeps were run again on the rebased tree: same results.
- **Browser** (scripts in `C:/Users/willy/opus-qa/w3/g1/review/`: `run.mjs` scenarios, `hud.mjs` overlap sweep, `wpdebug.mjs`, `shot.mjs` = opus-shot + CDP touch tap / pinch / swipe):
  - 1440×900: map open (7 place labels at city zoom, 19 once 唐人街龙门 is selected), route preview "沿路走约 40 秒 · 现实约 2.0 公里"; 8 list rows clicked in 400 ms (the last one wins, no stale route); 带我去 → the map closes, auto-walk on; the map reopened mid-trip (strip, gold route, framing); 不去了 (mapTarget null, auto-walk stopped); a per-second series of strip / chip / place card / waypoint over the whole 40 s trip; an undiscovered place picked from the search.
  - 390×844 `--mobile --dpr 3`: the bar's 地图 by touch, pinch zoom, swipe pan, a tap on a landmark badge (selects 渔人码头 with route and time), Journal → 足迹 (four tabs 83×46 px, no text overflow in the sheet); 375×667 en: the trip strip truncates cleanly ("Heading to Chinatown Dragon…").
  - P8 counters: standing still with a bubble and a clue **0 projection runs in 300 frames**, 1 HUD scan in 5 s (the only overlay mutations are the `?debug` text); walking 292 runs in 292 frames, 0.22 ms / frame, 9 scans in 5 s. Same after the fixes.
  - `?debug` at the Ferry gate, 1440×900 mid: `82–93 calls · 270–274k tris · 37 prog · warm-up 825–1044 ms → 29–30, +7–8 since · q mid (url)` (the drift is other lanes' P5). G1 draws nothing new in 3D (its warm-up probe compiles no objects) and the map is DOM + 2D canvas, so the lane's "the map adds no draw calls" table was not re-measured.
  - HUD overlap sweep (goals card + two toasts + clue waypoint; + BAYBAY's bubble; riding Powell–Hyde + toasts): 800×600, 960×600, 1180×800, 1440×900 (city and district), 768×1024 and 1366×1024 touch, 390×844 (city and district), 375×667.

### Defects found

| # | what | where | status |
|---|---|---|---|
| 1 | With the map open during 带我去 the plan went stale every 20 u from its **start**, so the map re-planned all along the way; each new A* from mid-street snapped elsewhere and began with a loop back, and the time read 40 → 35 → 40 → 25 → 30 s while the waypoint said 35 s (the "one number" claim failed). | `ui/CityMap.tsx` useRoutePlan, `game/mapRoute.ts` | **fixed** `c132ca8`: a plan serves while you are near its start **or its polyline** (`offRoute`, `cachedRoute`); the strip, chip and place card count the way back onto the route like `routeLeftTo`. Series after: strip = card = waypoint every second, 40 → 5 s. |
| 2 | A place picked from the search that you had not found got **no marker and no label** (the marker filter skipped undiscovered places): the route and its time chip ended on nothing. The report's "the selected place's name always reads" did not hold for them. | `ui/CityMap.tsx` markers | **fixed** `c132ca8`: `markerShown()` (cityMapDraw, tested) keeps the selected place always. |
| 3 | The waypoint label's slide (`--ob-label-dx`) was written with the **previous** label's width and the new text set after it; with P8's skip nothing re-ran while the view stood still, so a new clue label sat half off screen (−59 px at 768×1024). A regression of `6bf5067` (the old code re-ran every frame). The last "约 N 秒" after you stop could also stay one throttle step stale. | `game/Systems.tsx` project() | **fixed** `82ef07a`: text and width first; a throttled or unmeasured label asks for one more run (`labelRecheck`). Idle still 0 runs. |
| 4 | `hudLayout` kept its MutationObserver and the **detached overlay** (and the React tree hanging off its nodes) after the Canvas unmounted (leaving /opus-bay). | `game/hudLayout.ts` | **fixed** `82ef07a`: `releaseHudLayout()` on Ticker unmount; a new Ticker projects on its first frame. |
| 5 | 800×600 desktop: the city goals card (≈ 500 px) ran off the bottom, **covered the 坐渡轮 prompt**, and the toasts slid under it (41 px). The M1 sweep never had the card and toasts together (its card state had the night banner up, which hides the card). | `opus-bay.css` | **fixed** `5c96ba6`: desktop card `max-height: 100dvh − 216 px` (scrolls inside); on 721–1180 px the top stack centres right of the card while it is up. |
| 6 | Touch tablets: the big touch action sat **on the 地图 / BAYBAY buttons** (768×1024: 52×76 px; 1366×1024: 76×58 px). | `opus-bay.css` | **fixed** `5c96ba6`: one column in under E2's Hop at 721–1180 px, left of the button row above 1180 px. |
| 7 | The narrow-desktop column (721–1180 px, DR-3): BAYBAY's **问我** hint hid under the 地图 button above her. | `opus-bay.css` | **fixed** `5c96ba6`: the column leaves room for it (clear of her Q keycap). |

Sweep after the fixes: no overlaps at any of the sizes above. Shots: `docs/opus-bay/qa/w3/G1/review-trip-375-before-after.jpg` (1), `review-map-selected-undiscovered-after.jpg` (2), `review-hud-800x600-before-after.jpg` (5), `review-tablet-768-after.jpg` (6, 7).

### Claims re-checked

- 带我去 honesty: the 40 s trip arrived at ≈ 37–38 s here (map closed or open); "measured within 1 s" is fair.
- P8 "the projection runs only when something moved": holds (0 / 300 idle).
- 足迹: the fourth tab only in city mode (FOOTPRINTS_TAB is read once at load; the world mode is fixed per page, so that is correct); F-line / ferry rides named; the district journal keeps three tabs.
- Save v2 rides: `reconcileRides` cannot double count (F's `countRide` bumps `rideLog` and calls `noteRide` in the same synchronous call).
- "0 overlaps at 390×844 / 375×667 / 960×600 / 1440×900": true for the lane's states; false at 800×600 and on touch tablets (defects 5–7).

### Open (minor)

1. After the goals card closes, a waypoint that was waiting for it sometimes takes up to ≈ 1.1 s to come back (1 of 4 runs at 768×1024; the 4 Hz scan + settle logic); it heals by itself.
2. `?discover=all` (QA only): the map shows every place found but 足迹 counts 0 (`discoveredIds()` does not include the flag). QA shots of 足迹 need a real walk or a save.
3. A place with no walking route (走不过去) is not planned again when you walk elsewhere with the map open (only a found route goes stale).
4. The touch action's spot above 1180 px assumes the five-button row (324 px); a sixth round button needs the offset changed (G1-review block of `opus-bay.css`).
5. 足迹's ride list is read when the tab opens or a place is found; a ride that ends while the tab is open shows next time.
6. Pre-existing (wave 2): the map list's 去过的 tab is in index order, not newest first.

### Requests

- **E2** (auto-walk, an observation): on Ferry gate → Dragon Gate the 带我去 auto-walk makes a ≈ 20 u excursion east and back near x 132–153, z 29–33 while its own `routeTo` plan goes straight south there (position log: `C:/Users/willy/opus-qa/w3/g1/review/tripseries-1440.log`); the map follows where you are, so its time reads 25 → 30 → 25 s at that spot. Worth a look at the give-way / local-grid steering there.
- The lane's requests above: E2's pelican carry landed in `3890755` (E2-8; not re-verified by this review); the E2 nav-test wall-clock, the C2 debug panel on phones, G2's `greet` and the lead's `vercel.json` header still stand.

### Commits (review)

`c132ca8` (defects 1, 2), `82ef07a` (3, 4), `5c96ba6` (5, 6, 7), and this report section with the shots.
