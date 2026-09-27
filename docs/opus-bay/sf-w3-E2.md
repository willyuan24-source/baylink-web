# Wave 3 · lane E2 (movement, camera, vehicles, pelican, touch and gamepad input)

Worktree `C:/Users/willy/wt/e2` (branch `w3-e2`), dev port 5203. Brief: `sf-w3-lead.md`, `sf-w1-checkpoint.md` §5.5,
the E2 requests in `sf-w2-C2.md`, `sf-w2-F.md`, `sf-w2-G1.md`, and C2's wave-3 request 3 (`sf-w3-C2.md`).

## Part a

### 给主人的摘要

- 手机上点一栋楼，小人会走到那栋楼前面最近的街上（带落点光圈）；隔着一排矮楼点后面的高楼，也会走到你这一侧的街，不会绕到楼背后。
- 手机右下多了一个「跳」按钮（56 像素，在行动按钮上方，不挡任何 HUD）：轻点是小跳，按住是大跳；骑车时是单车小跳。
- 手柄：A 同时算 E（缆车上坐下/站起、长椅起身），View 键开关地图，跑步猛推摇杆误按 L3 不再起飞，撞墙/鹈鹕落地有轻微震动。
- 爬坡喘气改成按爬升高度：爬 6 u 以上、到坡顶才喘一次，45 秒内不重复；从 Filbert Steps 一路爬到 Coit Tower 只在山顶喘一次。
- BAYBAY 换成正式模型的那一帧不再临时编译着色器（原来 +4 个程序，现在 0 个）。之前被打断的那次已经推上去的：存档恢复滑翔、车辆给行人让路、主包瘦身、等车提示、缆车刹车下车。
- 检查：tsc 0、eslint 0、opus-bay 测试全过（最后一次 534/534）；手机 390×844、375×667 和平板 768×1024 实机截图都看过。

### What was built

All on `origin/opus-bay` (hashes as pushed; a rebase may have changed the last one).

| task | commit | what |
|---|---|---|
| G1 save v2 hook | `01f8241` | `moveApi.setGlideUnlocked(v)`: restores the glide unlock quietly (safe before the bind; `false` locks again). |
| E2-16 | `2572ca9` | `giveWay` consumes `registerObstacleSource` obstacles (own radius, any speed, the step that reached one is undone). |
| HC-1 / P7 | `87ba00b` | moveSystem reads `landmarkTallStructures` through `cityModule()`; `nav` / `driveRoute` load `core/walkGraph` lazily (per-frame helpers moved to `core/polyline`); no static city-module import left in E2's files. |
| DR-1 | `a35a85f` | MoveChip shows the waiting chip (Cancel) while `flow.ride.stage` is `'waiting'` / `'turning'`, "Stopping…" while `'braking'`; glyph per ride kind; the glide button reads `moveApi.subscribeGlide`. |
| E2-10 + F's platform consumers | `2cc188b` | Rider side of the hop-off handshake (`requestPlatformStop` → `'braking'` → `hopOffRide()` at speed < ALIGHT or 1.2 s → clear door slot → `releasePlatformStop`) for Space, pad B and `moveApi.requestHopOff`; rider / BAYBAY pitch with `plat.pitch`, running-board lean (`hangLean`, `railMirror`), walking kept on `plat.decks`, BAYBAY's cable-car bench, the ride camera on `platforms.get(move.line)`. Test `tests/opus-bay-sf-hopoff`. |
| M2 | `875a10b` | A tap / click on a city building wall walks to the open ground in front of it (below). |
| E2-9 | `71f2bff` | Touch 跳 / Hop button (below). |
| E2-11 | `5917f0c` | Gamepad (below). |
| E2-13 | `6c30416` | Crest pant by climb height (below). |
| P5 (C2 request 3) | `ee2b765` | The BAYBAY GLB swap links no shader program (below). |
| E2-16 follow-up (H2b's question) | `3dde7a2` | Only person kinds say "whoa" in `giveWay`; `'traffic'` and any other kind (e.g. `'static'` for a mural board) give the soft bump without a voice. |

**M2 — tap on a facade** (`actors/tapTarget.ts`, new; `actors/system.ts`):
- The ground picker's ray (`heightfieldRaycast`) now also stops at the first city building wall below its top
  (`Blocker.top`, polygon blockers of city buildings) within 320 u horizontally (`FACADE_REACH`). No triangles: a 0.5 u
  march through `blockersNear`, cached for the pointerdown / click pair. Walls inside the occlusion dither between the
  camera and the player (the `TOY_FRAG` cylinder) are seen through, as on screen.
- `frontSpot(x, z, ux, uz)`: back along the ray (≤ 24 u), the first standable point whose large open area
  (`nav.arrivalSpot`, ≤ 6 u) lies on the camera side of the wall; else a large area within 10 u of the wall; else the
  first standable point; else `nearestWalkable(8)`. The intersection carries `facade` (`FacadeIntersection`), and
  `onGroundClick` walks there with the usual ring marker (double tap = run) or drives there (tap-to-drive).
- District mode has no building tops: nothing changes there (hero regression green).

**E2-9 — touch hop** (`core/input.ts`, `actors/TouchControls.tsx`):
- `touchJump(down)`: the press is the same jump edge as Space / pad B; `input.touchJumpHeld` joins `jumpHeld` in
  `pollInput` (a finger tap of ~0.1 s is a short hop, a hold the full jump; a release before the 0.07 s take-off
  crouch keeps the full jump, as for clicks). `clearKeys` (blur) releases it.
- The button: 56 px cream, arrow icon, "跳 / Hop", always the lowest of the touch movement column (bell, 下车, 降落,
  起飞 above it), on foot and on the bike / in the car (bunny hop); hidden while sitting, gliding, in transit, in a
  dialogue, a panel, a cinematic, fishing and the postcard reward. Pointer capture keeps the release when the thumb
  slides off; `touch-action: none`. Phones (≤ 600 px): 14 px above the contextual action button. 601–1180 px touch
  screens: one column in (`right: 84px`), beside G1's round-button column. Safe-area insets in both. The column has the
  class `ob-move-buttons` (G1 request 1).

**E2-11 — gamepad** (`core/input.ts`, `actors/Actors.tsx`, `actors/system.ts`, `ui/MoveChip.tsx`):
- `pickGamepad(pads)`: the first connected pad with `mapping === 'standard'`, else the first connected one. The full
  mapping table is in the `input.ts` header.
- A: the flow's interact / confirm and `input.interactCount++` (E): switch seat on a cable car, stand up from a bench
  (the move chip says A there now). View / Back (8) toggles the map (`padActions.map`); Y's journal and the map wait for
  the same states as J / M (dialogue, photo mode, cinematic, fishing, reward). L3 is ignored while the left stick is
  pushed past 0.94 (`L3_STICK_MAX`). `rumble(weak, strong, ms)` on the pad in use (vibrationActuator): hard vehicle
  bumps and glide landings, nothing unless the pad is the input device.

**E2-13 — crest pant** (`actors/controller.ts`):
- `GradeTracker.update(dt, g, moving, y)` follows the climb: it starts on g > 0.2 (walking or running, steps
  included), survives gentle stretches (0.1–0.2) and short landings; the crest is 1 s on the flat, 1.5 s standing still
  or 1.5 u back down; a crest after a ≥ 6 u rise pants once, at most one per 45 s (`PANT`). A teleport
  (`controller.sync`) forgets the climb. The old rule (10 s running uphill) never fired on a click-to-walk.

**P5 — BAYBAY GLB swap** (`actors/Actors.tsx`, `actors/system.ts`, `actors/models.ts`):
- Late models (the BAYBAY GLB, the pelican) are precompiled for the render path the world uses (a 1×1 half-float
  target while the tilt-shift post is on, as `world/warmup` does), the swapped mesh keeps the skinned shadow-depth
  material C2's `kindSweep` gave the procedural BAYBAY, and its shadow pass drops the map (no alpha test; three hands
  the map to the depth material otherwise).

**API for other lanes**
- `core/input`: `touchJump(down)`, `input.touchJumpHeld`, `pickGamepad(pads)`, `rumble(weak, strong, ms)`,
  `L3_STICK_MAX`, `padActions.map`.
- `actors/tapTarget`: `facadeAlongRay(o, d, tMax, player?)`, `frontSpot(x, z, ux, uz)`, `FACADE_REACH`,
  `type FacadeIntersection`.
- `actors/controller`: `PANT`, `GradeTracker` (`update(dt, g, moving, y)`, `rise`, `reset()`).
- `actors/view` `registerObstacleSource`: kinds documented (people / `'traffic'` / anything else = static).
- `moveApi`: `setGlideUnlocked(v)`, `subscribeGlide`, `requestHopOff` (earlier in this part).
- DOM: the touch movement column is `.ob-move-buttons` (for G1's HUD box list).

### Evidence

- Checks on the last push: `tsc` 0, `eslint` 0, **534 / 534** opus-bay tests (hero regression and contracts
  included). Under the shared machine load the wall-clock assert in `opus-bay-sf-citymap` "draw … fast" failed twice
  (171–337 ms > 150 ms) and passes alone (36–77 ms), and one full run had 1 failure that did not repeat (the wave-4 note
  lists the same wall-clock flakes); my check script re-runs a failing file alone before it calls a run red.
- New tests (`tests/opus-bay-sf-move3.test.ts`): M2 (a Union Square tower wall, the thin building seen over a lower row,
  the see-through dither, open ground, district = null), E2-9 (tap 0.13 s < 1.0 u, hold > 1.3 u, Space + touch, blur),
  E2-11 (stubbed `navigator.getGamepads`: standard pad wins, A = interact + E once per press, View → map once, L3 with a
  hard / calm stick, B held, rumble clamp and device gate), E2-13 (the rule: landings, gentle stretch, 45 s cooldown,
  standing crest, 5 u = no pant; the Filbert Steps walk in district: one pant, at the top), E2-16 static kind.
  `tests/opus-bay-sf-vehicles` pant assert updated to the new signature.
- M2 in the app (city, `ll:37.7880,-122.4075`): a real touch tap on a tower at 390×844 walked to Post Street
  (`(100.1, 201.4)`); at 375×667 the thin building seen over a lower row sent the walker round the block before the
  camera-side rule (`(97.1, 190.9)`, still walking after 7 s) and to the near street after it (`(97.1, 205.1)`, arrived);
  a mouse click at 1440×900 walked to Maiden Lane at the tower's base. Plain ground taps with touch at both phone sizes:
  target set, arrived. Raycast cost 0.0–0.2 ms per cast (worst: a near-horizontal ray, 0.2 ms).
  Shots: [`qa/w3/E2/m2-phone375-tapped.jpg`](qa/w3/E2/m2-phone375-tapped.jpg), [`m2-phone375-arrived.jpg`](qa/w3/E2/m2-phone375-arrived.jpg).
- E2-9 with real touch (CDP touch events): 390×844 Hop at (316, 638)–(372, 694), 375×667 at (301, 461)–(357, 517),
  768×1024 (zh) at (628, 818)–(684, 874); **0 overlaps** with every fixed HUD box in the three sizes, with and without the
  contextual action button (at a cable-car station). Tap 0.64–0.65 u rise, hold 1.33 u. The floating touch stick walked
  16.0 u (390) and 17.3 u (375) in 1.4 s. Shots: [`e2-9-hop-phone390-action.jpg`](qa/w3/E2/e2-9-hop-phone390-action.jpg),
  [`e2-9-tablet768-zh.jpg`](qa/w3/E2/e2-9-tablet768-zh.jpg) (also shows G1's overlap, request 2).
- E2-11 in the app with a stubbed standard pad: View opened and closed the map; on a Powell-Hyde car A moved the rider
  rail → seat, the chip reads "A Stand · B Hop off". Shot: [`e2-11-pad-A-seat-cablecar.jpg`](qa/w3/E2/e2-11-pad-A-seat-cablecar.jpg).
- E2-13 in the app (city mode, click-to-walk Levi's Plaza → Coit summit): arrived at 15.8 s, one `pant` at 17.3 s at
  y 20 (the summit). Shot: [`e2-13-coit-summit-pant.jpg`](qa/w3/E2/e2-13-coit-summit-pant.jpg).
- P5: programs 30 frames before / after `swapGuideNow()` at the Ferry gate: before the fix 37 → 41 (quality high); after
  49 → 49 (high) and 36 → 36 (mid). (Two `basic` programs link at ≈ 11 s after load in every run, with the warm-up;
  not from the swap.)
- P7 / GameRoot gzip (`npx vite build --config vite.opus.config.ts --outDir C:/Users/willy/opus-qa/w3/e2/dist`):
  HC-1 312.26 → 310.72 KB (walkGraph + format became a 2.6 KB lazy chunk; 283.5 KB measured with G2's static landmark
  imports stubbed). 328.26 KB at `6c30416` (the growth came from other lanes' wave-3 / wave-4 work), **301.49 KB** at
  `fe4d427` after G2 moved the landmark library out (`88ed44f`). E2's part-a additions to the main graph are ≈ 1.5 KB
  (`tapTarget` 0.84 KB gzip).

### Decisions

- M2 uses the blocker tops, not a triangle raycast against the city batches: zero draw-side cost and the same answer the
  walker's collision uses. A tap goes to the camera side of the wall: a thin building seen over a lower row must not
  send the walker round the block. Hero district buildings and landmarks (no `top`) keep the old ground behaviour.
- The Hop button stays in one place (the column's bottom) in every mode that has it, so the thumb learns it; it never
  moves when the contextual action appears. A touch release before take-off keeps the full jump (same rule as clicks);
  a normal finger tap is past it and gives the short hop.
- Pad A does both (interact and the E count), exactly like the keyboard's E; the flow's own guards stop double actions.
- Pant thresholds (1 s flat, 1.5 s standing, 1.5 u drop) keep the 0.5 s near-flat stretch of the Pioneer Park path from
  ending the Filbert climb.
- H2b's question (sf-w3-H2b.md review request 3): a static obstacle source is fine now; register the mural boards with
  kind `'static'` (vehicles stop with a soft bump, no voice; the walker slides round them).

### Known gaps

- G1's bubble / waypoint placement does not know the touch movement column yet (request 1): BAYBAY's bubble can sit
  over the Hop button for a moment.
- A facade tap with no reachable ground in front shows the red ring at the wall base, which can be hidden inside the
  building.
- The hero F-line car does not honour stop requests yet, so its hop-off stays immediate (request 4).
- The seated cable-car camera frames the rider very close (part b's city camera).

### Not done

Nothing from part a's list. Part b: E2-5 view field, E2-6 city camera, E2-7 glide world, E2-8 flying pelican, E2-12 city
bike racks and benches.

### Requests

1. **G1, `src/opus-bay/game/hudLayout.ts` `HUD_BOX_SELECTOR`**: add `'.ob-move-buttons > *'` so BAYBAY's bubble and the
   waypoint keep off the touch movement buttons (Hop, bell, 下车, 起飞, 降落):
   `'.ob-hud > *', '.ob-touch-action > span', '.ob-topstack > *', '.ob-toast', '.ob-goals-card', '.ob-coach', '.ob-lead-chip', '.ob-move-buttons > *',`
2. **G1, `src/opus-bay/opus-bay.css`**: on 601–1180 px touch screens the contextual action button (`.ob-touch-action`,
   76 px at right 18 / bottom 20) sits on the round-button column (right 16, bottom 18, column-reverse) — see
   [`e2-9-tablet768-zh.jpg`](qa/w3/E2/e2-9-tablet768-zh.jpg) (坐叮当车 over the map / Ask buttons). Move it one column in,
   like the movement column:
   `@media (min-width: 601px) and (max-width: 1180px) { .ob-hud:not(.is-narrow) .ob-touch-action { right: calc(84px + var(--ob-sr)); } }`
3. ~~G2 (+ D2), P7: the static landmark imports in G2's files~~ — done by G2 in `88ed44f` (C2's request 4) while this
   report was being written: GameRoot's static graph reaches no `world/sf/landmarks` module now (301.49 KB at `fe4d427`).
4. **F, `src/opus-bay/world/streetcar.ts` + `game/transit.ts`**: the district / hero F-line ride has no `line`, so E2's
   rider hops off at once (as before). For the braked hop-off there too, give that ride `line: 'streetcar'` and honour
   `requestPlatformStop('streetcar', 1.2)` / `releasePlatformStop` in the hero streetcar (brake to 0 within 1.2 s, like the
   city cars); E2's side needs no change.

Relayed messages during part a: none.

## Part b

### 给主人的摘要

- 城市里到达地标时镜头会对准地标了：市政厅圆顶、九曲花街的弯道、金门大桥都在画面里（以前常常背对着）；在日落区、卡斯特罗这些窄街上，镜头会抬到屋顶上方往下看整条街，不再卡在房子中间。
- 鹈鹕换成了程序化的“正在飞的鹈鹕”：长身子、头缩在肩上、长嘴朝前、脚收在尾巴下、翅膀张开有“指尖”，只占 1 个绘制调用（原来 2 个，还要下载 1 MB 模型）；地图上“飞过去”时，小人和 BAYBAY 真的骑在鹈鹕背上飞过去。
- 滑翔会飞越/绕开金门大桥塔、湾区大桥（新加了桥塔和钢缆）、苏特罗塔等，城市加载进来以后也生效（以前只认第一次起飞时的名单）；在城市里降落会落在开阔的地方。
- 城市自行车架旁会停着小单车（身边最多 4 辆，走远了就挪到你附近的车架），城市里 126 张长椅都能坐。
- 检查：tsc 0、eslint 0、opus-bay 测试全过；桌面 1440×900 和手机 390×844 实机截图都看过。没有花 Higgsfield 额度（程序化鹈鹕效果够好）。

### What was built

| task | commit | what |
|---|---|---|
| E2-5 / E2-6 | `58922d2` | The view field and the city camera (below). |
| E2-7 | `5bafb91` | Glide world: a live tall list, the Bay Bridge, a 64 u hash, city landing (below). |
| E2-8 + G1 request 1 | `3890755` | The procedural flying pelican; fast travel rides it (below). |
| G2 request 1 | `23a31fc` | `sf-w3-G2.md` request 1: a hidden city resident draws no blob shadow (`if (npc.visible)`); the rider's blob also shrinks away high up in fast travel. |
| E2-12 | `4c996e9` | City bike racks and benches (below). |
| E2-6 / DR-5 | `3af4f27` | The seated cable-car camera looks level under the roof's overhang (the roof edge cut the sitter's head off). |
| G2 review request 7 | (after the report) | `sf-w3-G2.md` "## Review" request 7: `ActorSystem.dispose()` releases the residents first (a city body still loading never builds). |

(Hashes as pushed to `opus-bay`; the E2-12 / DR-5 / report commits were rebased a few times while other lanes pushed — find them by subject if these moved again.)

**E2-5 — the view field** (`actors/viewField.ts`, new):
- `preferredViewDir(x, z)` (the direction to look toward) and `preferredCameraYaw(x, z)` (the follow camera's yaw for
  it). Hero slab (district mode everywhere, city mode on the Embarcadero slab): exactly today's rule, the promenade
  frame's normal. City: a lazy openness field on a 16 u lattice — 16 directions sampled at 24 / 48 / 96 u (open water
  +0.5 / 0.8 / 1, lower ground up to +0.6, roofs above the 6 u eye line up to −1 / −0.7 / −0.4, outside the model
  −0.25), smoothed [¼ ½ ¼]; a cell is computed on first use and again when a chunk under its samples attaches / detaches.
- Used by `chooseYaw` (camera.ts), the side a city transit ride's camera takes (toward the view, as the F-line's water
  side) and the sit rig (a city bench's heading turns ≤ 0.6 rad toward the view).

**E2-6 — the city camera** (`actors/camera.ts`, `actors/cameraModes.ts`, `actors/cityViews.ts` new, `core/terrain.ts`
additive):
- `heroPoints()` in city mode adds Salesforce Tower (r 5), the Golden Gate Bridge's two towers (r 5) and Sutro (r 7);
  district keeps its 3 (test). `HeroPoint.r` is the keep-out radius.
- Landmark zone views (`cityViews.ts`, a dynamic import: the landmark library stays out of GameRoot, the P7 guard is
  green): one per landmark arrival spot (`sfLandmarkAnchor`), the camera behind the player on the line to D2's photo
  target, leaning ≤ 0.35 rad toward the photo's side; pitch / distance / look-up from a small solver (`zoneFrame`: the
  player's chest at 55–78 % of the frame, the feet in it, the photo target above the middle, the landmark's top in
  frame, as close as that allows), re-run from the ground heights when the camera enters the zone. None for overlooks
  (Twin Peaks) or the foot of a tower (Sutro). A blocked zone view may turn ≤ 0.7 rad to a clearer yaw instead of losing
  to the occlusion rule (CS-10); the occlusion auto-turn and the idle bias stay inside that width.
- Occlusion reads `Blocker.top`: a roof below the sight line (chest → camera at that zoom) hides nothing (`occlusion`,
  `occlusionBehind`, the ride rigs' pull-in). District blockers carry no tops: unchanged.
- Roof lift (city, on foot): the follow camera rises over the roofs the ray passes below (≥ 35 % of the way out) and out
  of a gap between two houses (≤ 0.6 × its distance) — the diorama view down a narrow Sunset / Castro street instead of
  a camera among the roofs. (A GTA-style pull-in was tried first: at 5 u behind BAYBAY's head it read worse.)
- Arrival look-again: after a city teleport (`?at=`, resume) the yaw was chosen before the chunks there were in; while
  they attach (≤ 8 s, the player standing, the camera untouched) it is chosen again and turned to. The fast-travel
  descent hands over at its own yaw (as the arrival cinematic does).
- Glide rig: 14 u at pitch 0.3 (was 16.8 / 0.4): the new pelican bigger in frame, the horizon in it. Seated on a city
  cable car: pitch 0.03 (`3af4f27`, DR-5).
- No per-frame allocation: `RideCamera.update` reuses its vectors; blocker queries go through the new allocation-free
  `core/terrain.forEachBlockerNear` (additive, re-entrant).

**E2-7 — the glide world** (`actors/glideTall.ts` new, `actors/glide.ts`, `actors/moveSystem.ts`):
- `LiveTall`: the hero towers; D2's landmark tall parts (through `cityModule()`) on the base collision uses
  (`provider.landmarkBase`, else the far city's proxy, else the ground); the Bay Bridge's west crossing as
  `world/backdrop.ts` draws it (4 towers r 5 top 31.5, the SF and centre anchorages, circles every 6 u along the deck
  whose tops follow the main cables, ≥ deck + 0.6); and `setTallStructures` extras. Rebuilt when the mode, the city
  chunk or the extras change and (≤ 1 / s) as the city streams — the old list was captured on the first glide, before
  the city module or the bases were in. `TallHash`: 64 u buckets (exactly the scan's answer, test).
  `terrainGlideWorld(array | getter)`, no allocation in `roofAt`. City landing: `nav.arrivalSpot` (a large open area);
  district: `nearestWalkable` as before.

**E2-8 — the flying pelican** (`actors/vehicles/models.ts buildPelicanRig`, `actors/vehicles/pelican.ts`):
- One SkinnedMesh on the characters' clay material, 2,348 triangles: a long body (grey-brown mantle, darker belly), the
  head drawn back onto the shoulders on an S-folded neck (white head, straw crown, chestnut hindneck, cream fore-neck),
  the long bill laid forward with a warm tip and the dark pouch, broad wings with a pale leading edge and four fingered
  primaries, the short tail with the feet tucked under it. Bones root / body / head / tail / wingL / wingR / tipL / tipR
  (the flap and bank code's names); `PELICAN_SEATS` for the rider and BAYBAY. The hands lag the arms, the head
  counter-nods, the tail follows the pitch; `registerWarmup('e2-pelican')`. It replaces the tilted standing pelican.glb +
  the separate wing rig (2 draws + 2 shadow draws, a textured program, a 1 MB fetch at the first glide).
- G1 request 1: in `move.mode === 'travel'` the pelican flies `travelPose()`: the seat `perch` over the sky path, the
  nose on the climb / descent, the wings beating at the pickup, the rise and the flare; the rider hops on over 0.3–0.9 of
  the pickup and off in the last quarter of the descent at the arrival spot; BAYBAY rides on its shoulders and hops out
  beside the player; the pelican flies off.
- The Higgsfield fallback was not used (0 credits): the contact sheet reads as a pelican in flight (side,
  three-quarter, chase, bank; `qa/w3/E2/e2-8-*`).

**E2-12 — city bike racks and benches** (`scripts/opus-sf/ride-spots.ts` new, `data/sf/rideSpots.ts` generated,
`actors/vehicles/cityBikes.ts` new, `actors/vehicles/fleet.ts`, `actors/moveSystem.ts`):
- The script reads the published chunk props the renderer draws (not on the hero slab, not in a landmark exclusion),
  attaches every chunk, and keeps a bike beside a rack only if `poseCheck` passes with a clear door slot, a bench only if
  its front is standable: **26 racks, 126 benches** (11 props in exclusions, 3 racks with no fit, 9 benches with a
  blocked front). `--check` compares the committed file.
- `CityBikePool` (loaded by a dynamic import in city mode): ≤ 4 pooled bikes at the racks nearest the player (within
  120 u, on resident ground), recycled once both the bike and its rack are beyond 160 u and it is out of view; never a
  ridden or called bike. A pooled bike takes its rack's id (`city-bike-<n>`): the interactables (source
  `e2-city-rides`), `rideables` (now keyed by id: `syncRideables` republishes when an id moved) and save v2 name the
  rack; a restore claims a pooled bike for its rack. The city benches (`seat:city-bench-<n>`) join the movement system's
  seats.

**API for other lanes**
- `actors/viewField`: `preferredViewDir`, `preferredCameraYaw`, `heroView`, `viewScores`, `bestDir`, `TERRAIN_VIEW`,
  `resetViewField`, `VIEW_*`.
- `actors/camera`: `HeroPoint.r`; `ZoneView.r / near / frame`; `loadCityViews()`; `yawCandidates()`.
- `actors/cityViews` (lazy): `cityHeroPoints`, `cityZoneViews`, `landmarkZoneView`, `zoneFrame`, `CITY_ZONE_R`.
- `core/terrain`: `forEachBlockerNear(x, z, r, fn)` (additive).
- `actors/glide`: `TallHash`, `TallSource`, `terrainGlideWorld(array | getter)`. `actors/glideTall`: `LiveTall`,
  `tallNow`, `heroTall`, `bayBridgeTall`, `landmarkBaseY`. `moveSystem`: `setTallStructures` (kept),
  `tallStructuresNow()`.
- `actors/vehicles/models`: `buildPelicanRig`, `PELICAN_SEATS`, `PELICAN_PAL` (`buildWingsRig` and `PELICAN_RIDE`
  removed). `Pelican.rig`, `Pelican.beating`.
- `actors/vehicles/cityBikes`: `CityBikePool`, `cityBenchSeats`, `POOL_SIZE` / `PARK_R` / `RECYCLE_R`;
  `data/sf/rideSpots`: `CITY_BIKE_SPOTS`, `CITY_BENCHES`; `Fleet.add` / `reassign`; `MoveSystem.cityBikes`.
- DEV QA: `__opusBay.cameraApi` (chooseYaw, yawCandidates, zoneViews, heroPoints, preferredViewDir) and
  `__opusBay.fastTravel` — the game's own module instances (a page script's own `import()` can load a second copy of a
  module under dev HMR; that cost an hour here).

### Evidence

- Checks on the local head before the last rebase: `tsc` 0, `eslint` 0, **635 / 636** opus-bay tests with
  `opus-bay-sf-nav` "window build < 200 ms" failing once under the shared machine load and green alone (the known
  wall-clock flake); hero regression and contracts green. The pushed tree's numbers are in the last line below.
- New tests in `tests/opus-bay-sf-move2.test.ts` (11): E2-5 on synthetic worlds + the hero rule exact at 4 anchors; E2-5
  in the city (Twin Peaks looks downhill, Ocean Beach and the Marina at the water, Russian Hill down toward the Bay;
  1,000 cached lookups < 50 ms); E2-6 hero points / zone views (district 3 + 7; city 7 hero points and a zone per
  landmark; none for Twin Peaks / Sutro; the framing solver); E2-6 `chooseYaw` faces City Hall's dome, low roofs hide
  less (every candidate's occlusion ≤ before, the total < ½); E2-6 the follow camera over the roofs on a Sunset street,
  no `clone()` per ride-rig frame; E2-7 the live list (the city chunk, extras and provider bases reach a world built
  before them) and the hash against a scan (3,000 queries); E2-7 the glide never passes through the GGB tower or a Bay
  Bridge tower and lands via `arrivalSpot`; E2-8 the rig (≤ 3.5k, one material, bones, the shape by bone, seats on the
  back) and fast travel (pickup → descent carried, BAYBAY seated, up at the cruise height, on foot at the destination);
  E2-12 every generated spot re-checked on the attached city; the pool (≤ 4 at the nearest racks, recycled, the ridden
  one kept, rideables follow the ids, a city bench to sit on). `tests/opus-bay-sf-vehicles` budget: the ride pelican
  ≤ 3,500 (was the wings ≤ 700).
- In the app (dev server 5203, RTX; 1440 × 900 and 390 × 844 `--mobile --dpr 3`; `?start=free&world=city`):
  - arrivals (`goToCitySpot`): City Hall — before, the camera faced the buildings behind the player; after, the dome and
    the steps are in frame on desktop and phone ([before](qa/w3/E2/e2-6-city-hall-before.jpg),
    [after](qa/w3/E2/e2-6-city-hall-after.jpg), [phone](qa/w3/E2/e2-6-city-hall-phone390.jpg)); Lombard's hairpins
    ([after](qa/w3/E2/e2-6-lombard-after.jpg)); the Golden Gate Bridge along its deck; Grace Cathedral's towers; the
    Palace rotunda at the frame's right edge (its arrival is in a gap between the Baker St houses: request 2).
  - narrow streets: at the Sunset (28th Ave) the camera sat among the roofs and a palm
    ([before](qa/w3/E2/e2-6-sunset-before.jpg)) and now looks down the street from over the roofs
    ([after](qa/w3/E2/e2-6-sunset-after.jpg)); the Castro ([roof lift](qa/w3/E2/e2-6-castro-roof-lift.jpg)).
  - glide: the pelican at 11 u, 25 u and 45 u, chase / side / three-quarter / bank
    ([chase](qa/w3/E2/e2-8-pelican-chase.jpg), [side](qa/w3/E2/e2-8-pelican-side.jpg),
    [three-quarter](qa/w3/E2/e2-8-pelican-front34.jpg)); across the Bay Bridge from 60 u west at 26 u: the closest it
    came to any roof or tall structure was 7.2 u, climbing to 39 u over the 31.5 u towers.
  - programs on the first take-off: district 43 → 43; city 38 → 39 — a plain depth program (no skinning, so not the
    pelican, whose shadow uses C2's skinned depth material) when a city object first enters the shadow map from the
    air (request 3).
  - fast travel Palace → Lombard: pickup 0.8 s → rise → pan → descent, the rider and BAYBAY on the pelican throughout,
    on foot at Lombard facing the hairpins ([pickup](qa/w3/E2/g1r1-travel-pickup.jpg)).
  - a city bike at the Union Square rack: parked beside the hoops, the "Ride the bike" prompt, F rides it, F gets off;
    the bench next to it: E sits ([rack](qa/w3/E2/e2-12-city-bike-rack.jpg), [bench](qa/w3/E2/e2-12-city-bench.jpg)).
  - seated on a Powell-Hyde car ([the level view](qa/w3/E2/dr5-seated-cable-car.jpg)).
- Bundle (`npx vite build --config vite.opus.config.ts --outDir C:/Users/willy/opus-qa/w3/e2/dist`): GameRoot
  **309.46 KB** gzip at `645e7f9` (`3af4f27` before its rebase; 301.49 KB at part a's end — the other lanes' wave-3 /
  wave-4 work landed in between). E2's city-only code went to lazy chunks: `cityViews` 1.43 KB, `cityBikes` (with the
  spot table) 3.31 KB gzip.

### Decisions

- The view field is coarse (16 u cells) on purpose: it says where the scenery is; the occlusion scoring picks the clear
  street next to it. The transit camera takes the view's side once per ride (a swing across the car mid-ride is worse
  than a fixed side). A swing toward the car's front on narrow streets was tried and dropped (BAYBAY hid the rider).
- Roof lift, not pull-in, for the on-foot camera: the toy diorama reads best from above; the lift is ≤ 0.6 × the
  distance.
- Zone views are solved from the heights when the camera enters them (the far DEM at boot is too rough) and have a
  ±0.7 rad search width, so a landmark stays in frame even with a house behind the player.
- The Bay Bridge's glide shape copies `world/backdrop.ts`'s constants and formula (C2's file): request 4 keeps them in
  step.
- The pelican stays procedural: it reads as flying, costs one draw and no download.
- Pooled bikes carry their rack's id, not a pool id, so every consumer (interactables, rideables, save v2) sees a stable
  name per place.

### Known gaps

- The Palace of Fine Arts arrival spot is in a narrow gap between the Baker St houses: the camera lifts over the roofs
  and the rotunda sits at the frame's edge (request 2). `?at=` / fast travel still place the player with G1's
  `canStand || nearestWalkable` rather than `nav.arrivalSpot` (CS-10's third point: request 1).
- Seated on a cable car in a canyon street (Powell) the camera is still 4 u out (the houses leave no room); the view is
  level now and the face visible.
- 4 pooled bikes add up to 4 skinned draws + 4 shadow draws when all are in view.
- Only 6 of the 24 landmark arrivals and 3 street spots were shot; 375 × 667 was not re-shot for the camera (no UI
  change in this part).
- Save v2 claiming a pooled bike for a saved rack is covered by the pool code and review, not by a test of its own.
- G1's review (`sf-w3-G1.md` "## Review", an observation): on Ferry gate → Dragon Gate the 带我去 auto-walk makes a
  ≈ 20 u excursion east and back near x 132–153, z 29–33 while its `routeTo` plan goes straight south there. Not looked
  at in this part (the give-way / local-grid steering of the RouteWalker legs there is the place to start).

### Not done

Nothing from part b's list (E2-5, E2-6, E2-7, E2-8, E2-12, plus G1 request 1 and G2 request 1). For the lead or a later
pass: a contact sheet of all 24 landmark arrivals on desktop and 375 × 667; the requests below and part a's still-open
ones (G1 1–2, F 4).

### Requests

1. **G1, `src/opus-bay/game/fastTravel.ts` `arrivalSpot`** (CS-10: "arrivalSpot puts the player in narrow slots between
   house rows"): in city mode use the movement system's large-open-area rule (never a backyard pocket or a slot
   between two houses):
   `import { arrivalSpot as openSpot } from '../actors/nav';` and
   `export function arrivalSpot(p: Vec2): Vec2 { const o = cityTerrain() ? openSpot(p, 30) : null; if (o) return o; if (canStand(p.x, p.z)) return { x: p.x, z: p.z }; return nearestWalkable(p, 40) ?? { x: p.x, z: p.z }; }`
   (`resume.ts` and `goToCitySpot` already go through it). Check with `?at=lm-palace-of-fine-arts` and
   `?at=ll:37.7536,-122.4862`.
2. **D2, `src/opus-bay/data/sf/landmarks.ts` palace-of-fine-arts `arrival` (3, 18.5)**: it lands in a gap between the
   Baker St houses (`?at=lm-palace-of-fine-arts`, world ≈ (−408.8, 407.5)); move it onto the open lagoon walk in front of
   the rotunda (the camera's zone view follows the arrival automatically).
3. **C2** (P5): in city mode one plain `MeshDepthMaterial` program links on the first high glide (38 → 39 at the Marina;
   district 43 → 43): a non-instanced, non-skinned city mesh with `castShadow` enters the shadow map from the air. Warm
   that variant (a plain `Mesh` with `castShadow = true` in `world/warmup.ts`'s dummy set) or give it a kind depth
   material in `kindSweep`.
4. **C2, `src/opus-bay/world/backdrop.ts` `bayBridge`**: the glide's copy of the west crossing is
   `actors/glideTall.ts bayBridgeTall()` (DECK 10, TOP 30, the piers of `CITY_BACKDROP['bay-bridge-piers']`, the cable
   curves). If the bridge changes, change both — or export the tower / cable stations from backdrop.ts and E2 reads them.
5. Still open from part a: **G1** requests 1 (`HUD_BOX_SELECTOR` + `'.ob-move-buttons > *'`) and 2 (the 601–1180 px
   `.ob-touch-action` one column in); **F** request 4 (the hero F-line's braked hop-off).

Relayed messages during part b: none.

Checks of the pushed tree, run before its last rebases: `tsc` 0, `eslint` 0, **644 / 644** opus-bay tests, hero
regression and contracts green; after the last rebase onto `515fb30` (lane T's wave-4 files only) `tsc`, `eslint` and
`opus-bay-sf-bus` / `-metro` were re-run green, and after G1's and G2's reviews (`af3715b`) plus E2's last fix `tsc`,
`eslint`, actors / content / hero regression / contracts (62 / 62).
