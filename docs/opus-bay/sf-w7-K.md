# Wave 7 · lane K · feel, camera, safety

Worktree `C:/Users/willy/wt/w7-k` (branch `w7-k`), dev port 5701, scratch `C:/Users/willy/opus-qa/w7/k/`, QA images
`docs/opus-bay/qa/w7/K/`. Owns `actors/**` (G's pelican slot and P's import-site moves excepted), `eggs/**`, `game/**`
except `GameRoot.tsx`, `voiceW5.ts`, `w5Features.ts`, `album.ts`, `photo.ts`; `data/cityZones.ts`; `play/PlayChip.tsx`,
`play/chip.ts`; a `treesNear` query in `world/sf/props.ts`.

## 给主人的摘要

1. 镜头和行道树：跟随镜头如果会站进一棵行道树的树冠里（B 线审查员在鲍威尔街·萨克拉门托街等车时看到的），现在会自动抬高到树冠上方；坐叮当车时，镜头会避开挡在镜头和你之间的树冠（站着坐都算）。但海德街很窄，路边的树冠几乎贴着车的踏板，坐在长椅上时镜头离你只有 4 格，树叶还是会占掉大半个画面——这需要让"贴着你的树冠"变半透明，已经写进请求里，留给下一波。
2. 停在叮当车/电车/公交/地铁轨道上的空玩具车或单车，车来之前会"蹦"一下跳到路边（和路上小汽车让路的动作一样），不再被穿过去；BAYBAY 自己站在轨道上时，车来了她会先跳到一边。
3. 杰斐逊街（渔人码头）左上角地名现在写「渔人码头」，不再是「北滩」，BAYBAY 也不会在那里说"你好，北滩！"；华盛顿广场写「北滩」，不再误写「唐人街」（原因是地图格子太粗，全城边界上 28 处同类错误一起修好）。
4. 上一波手机上"新存档的目标卡片让地铁坐到一半就结束"的问题，我按同样路线在手机上完整重演了两次（坐车时卡片弹出、关掉），车都一直开到终点；没能复现，已写测试锁住"卡片和它的暂停永远不会结束行程"。
5. 手机上活动小条里的「放弃」按钮加大到 50×44（手指好按）；手机切到后台/锁屏或者转屏时，摇杆会自动松开，回来后人物不会自己往前走；飞行时每帧不再新建一个小对象。

## Part a (2026-09-29, 20:24–21:55 PDT): the street trees in the cameras' ray tests

### What was built

- **`world/sf/props.ts`** (the lane's `treesNear` query): `CityProps.treesNear(x, z, r, fn)` — every street tree of the
  resident chunks whose canopy meets the disc, as a `Canopy` `{ x, z, r, y0, y1 }` (a vertical cylinder round the trunk,
  from `CANOPY_SHAPE` per kind × the same per-instance scale `select()` draws: round tree r 1.45 over 1.3–3.45, cypress,
  pine, palm fronds). Per chunk a 16 u CSR grid built on the first query after the chunk arrives (dropped with it); one
  reused record, no allocation per call. On top: `segmentCanopy(a, b, skip, cone)` (the fraction where a segment first
  enters a canopy; a canopy entered within `skip` u of `a` is left out; `cone` > 0 also counts a canopy within
  atan(cone) of the line seen from `b`, answering how far out a camera may stand with it outside its view cone) and
  `canopyLift(a, b, from, clear)` (how far to raise `b` so the segment clears every canopy it crosses beyond the
  fraction `from`). None of this is in GameRoot: the cameras reach it through `cityStreamerLazy()?.props`.
- **`actors/cameraModes.ts`** `RideCamera` (the city lines' side-on shot, `occlude` subjects only; bus / LRV / F-line /
  car / bike / glide unchanged): `occluded()` also returns the first canopy on the line (with `CANOPY_SKIP` 1.5 u and
  `CANOPY_CONE` 0.22 ≈ 12°, and the same line `CANOPY_LEAD` 0.35 s on so the pull-in comes in before a kerb tree
  crosses it); the swing's step test looks ahead where the car will be in 0.5 / 1 / 1.5 s (`SWING_AHEAD`); a swing is
  held until the side has been clear for `SWING_HOLD` 2.5 s (it eased back at every gap between two trees or houses);
  the pull-in never comes in for a canopy it cannot get in front of (nearer the rider than `MIN_PULL`: closer, the
  leaves only filled more of the frame). New exports: `CanopySource`, `canopySource()`, `setCanopySourceForTests()`,
  `CANOPY_SKIP`, `CANOPY_CONE`, `SWING_HOLD`. The subject's `speed` for a city line is now the car's own along its
  heading (`actors/camera.ts` `rideSubject`, from the platform's velocity; it was 0 and unused for transit).
- **`actors/camera.ts`** (the follow camera, city only): `roofLiftStep` lifts over the street trees' canopies like
  over roofs — the far 65 % of the line and the camera itself (`CANOPY_CLEAR` 0.6 u, under the same `ROOF_LIFT_MAX`
  cap). District mode: no canopy source (null), nothing changes.
- Tests `tests/opus-bay-w7-k1-camera.test.ts` (4): the canopy queries (scale, band, cone, lift, a chunk leaving);
  riding past kerb trees every 8 u standing and seated, the camera → rider line meets a canopy (cone included) in < 8 %
  of the frames and the shot is side-on again past the trees; the swing held along a row of trees (min swing after the
  first swing > 0.5) and K1's open street still side-on; the follow camera rises over a canopy it would stand in.
  **Red on the old code**: the ride test "a canopy between the camera and the rider in 297 of 818 frames", the hold test
  "the trees swung the shot" (never), the follow test "over the canopy: y 6.64 vs top 8.02".

### Evidence

- Checks on the part-a tree (before the rebase): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors
  (43 old warnings) · suite **1493 tests, 1492 pass**; the one failure is the wall-clock assert of `opus-bay-actors`
  "A* reaches the hill … planned in < 400 ms" under the ten lanes' load — re-run alone: 20 / 20 pass (rule 9). W6-K1's
  camera tests (`w6-k1-feel`, `w6-k1-review`) green.
- Played (dev 5701, one headless Chrome, PERF-LOCK absent; scripts `C:/Users/willy/opus-qa/w7/k/{hyde,wait}.mjs`; every
  image read). The Powell–Hyde from Hyde & Beach, 5 spots up Hyde St, at each a shot with the trees in the camera's
  test ("on") and then with the canopy source switched off ("off", W6's camera for trees), 1.4 s apart:
  - **Standing, phone 390 × 844 dpr 3 mid**: the swing is 1.0 up the whole of Hyde St (the houses already did that);
    the probe "a canopy in the view cone between the camera and the rider" read on / off: −, 0.69 / 0.90, − / 0.96,
    − / −, 0.20 / −. At the same spot (spot 2, the car at a stop) on: the line clear, off: a canopy on it. Shot
    `docs/opus-bay/qa/w7/K/a-hyde-stand-phone-trees-on-off.jpg` (read): in both the rider on the running board is seen
    from above-behind with a kerb tree's canopy right over them (dithered in part) — the canopy stands at the rider.
  - **Seated, phone and desktop 1440 × 900 high**: the seated swing stops at 0.8 (K1 review), and the houses pull the
    bench shot in to 4 u (`pull` 4.0–5.3 with the trees off as well). Up Hyde St the kerb trees stand ≈ 1.1 u from the
    outward bench and their canopies (r 1.4–1.9) overhang the sitter: at bench height, 4 u off, the leaves fill most of
    the frame at 3–4 of 5 spots on both runs, on and off (`a-hyde-seat-phone-5-spots-on-off.jpg`,
    `a-hyde-seat-desktop-5-spots-on-off.jpg`, read). The rider and BAYBAY show at the Lombard crossing. **Not fixed:
    see Known gaps and Requests.**
  - **Lane B's waiting shot**, phone zh, waiting for the Powell–Hyde at Powell & Sacramento (`wait.mjs`): the camera
    stood 6 u above the player, no canopy round it (the probe: not inside any canopy), the player under a kerb tree's
    canopy, the near canopy at the frame's foot dithered (`a-wait-powell-sacramento-phone.jpg`, read). The camera
    inside a tree is covered by the lift (node test); the canopy over the player is the same gap as the seated ride.

### Decisions

- Canopies only for the city lines' side-on shot and the follow camera's lift: the car / bike / glide shots run along
  the road or over it, and a pull-in for every kerb tree on a turn would breathe.
- The view cone (≈ 12°, a portrait phone's half width) rather than the bare line: on Hyde St the line to the rider was
  clear while the camera stood right beside a canopy with half the frame leaves.
- No pull-in for a canopy the camera cannot pass (nearer the rider than 4 u): tested live, pulling in toward it made
  the leaves bigger.
- The swing hold (2.5 s) applies to walls too: at Hyde St's crossings the shot now stays behind the car instead of
  easing toward the side for the second the crossing is open.

### Known gaps

- **A canopy that overhangs the rider** (within 1.5 u, the seated bench on Hyde St, the Powell & Sacramento stop) is
  not something a camera position can clear at bench / street height: it needs the canopy thinned round the player.
  The TOY dither-fade (`world/materials.ts` TOY_FRAG) leaves out fragments within 1.2 u of the player and below
  `uPlayer.y + 0.35`, and its tube is 0.7 u at the camera end.
- The swing / pull-in were played on the Powell–Hyde only (Powell–Mason and California take the same code).

### Not done (this part)

- Nothing else of item 1.

### Requests

- **Lead / lane X (materials, not in any lane's table):** a tree-only dither round the rider — e.g. an `OB_CANOPY`
  define on `TOY_INST_TINT` (the street trees' material) whose fade tube keeps its 2.2 u radius all the way to the
  player and ignores the `L − 1.2` / `+0.35` cut-offs, or a per-instance fade the camera sets for the ≤ 3 canopies
  `CityProps.treesNear(player, 2)` returns while riding. The query is there; the shader is not lane K's.

## Part b (2026-09-29, 21:55–23:25 PDT): the parked ride and BAYBAY on the rails, the goals card, the area pill, 放弃

### What was built

- **The tow (item 2)**, new `actors/vehicles/transitClear.ts` (city only: statically imported by `cityBikes.ts`, the
  city's lazy ride module; nothing in GameRoot): `clearTransitPaths(fleet, dt)` at 5 Hz takes streetNet's road-vehicle
  list (`collectRoadVehicles`: the cable cars, the F-line, the loop buses, the Metro within 250 u of the player) and, for
  every parked ride that is `displaced` (driven off its spot), not `occupied`, not called and not already towing, asks
  `pathSide(q, x, z, r, reach)`: beside the vehicle's centre line within its half width + the ride's radius, from its
  tail to `TOW_REACH` 10 u + `LEAD_S` 1 s of its speed ahead of its nose. A hit tows it: `towSpot()` finds a pose beside
  the lane, parallel to the vehicle, the ride's half width + `TOW_GAP` 0.7 u past the vehicle's side, on the side the
  ride stood on first (up to +2.5 u out, either way round; `collide.poseCheck` must pass and the spot must be off every
  transit path; else `findFit` within 8 u). `actors/vehicles/fleet.ts`: `Fleet.tow(ride, x, z, heading)` and
  `Ride.tow` / `Ride.hopY`, stepped by `idle()` over 1 / `TOW_RATE` = 0.5 s with a smoothstep and a `TOW_HOP` 0.35 u hop
  (the toy traffic's give-way hop: `world/sf/traffic.ts` HOP_UP 0.35, LEAVE_RATE 2), a squash on landing; a player who
  gets in ends it where it is; `home()` clears it. `CityBikePool.update` runs it every frame and republishes the
  rideables after a tow.
- **BAYBAY steps off the rails (item 2)**, `actors/guide.ts`: `setTransitAside(fn)`; `GuideMover.step` asks it at 5 Hz
  while playing and not riding, and dashes to the answer (`dash(to, ≥ 0.25 s)`, running legs; `asides` counts it).
  `transitClear.guideAside(x, z)`: the same path test with `ASIDE_REACH` 12 u + 1 s of speed, the spot beside the
  vehicle on her side (`canStand`), else the other side, else the nearest walkable spot. Registered by `cityBikes.ts` at
  load (city mode), cleared on its dispose. The district never registers it.
- **The goals card and the ride (item 3)**: no code change (not reproduced, see Evidence); the invariant is pinned by
  `tests/opus-bay-w7-k3-goals.test.ts`.
- **The area pill (item 4)**, `data/cityZones.ts`: `WHARF_AREA` 渔人码头 / Fisherman's Wharf, a polygon on the street
  grid from Aquatic Park's east shore and the Hyde Street Pier east to Pier 35 / The Embarcadero & Bay St, south to Bay /
  North Point St. The extent is from https://en.wikipedia.org/wiki/Fisherman%27s_Wharf,_San_Francisco (checked
  2026-09-29: "from Pier 35 and the intersection of The Embarcadero and Bay Street westward to Hyde Street and Aquatic
  Park", north of Russian Hill / North Beach); the corner points are approximate lat / lng on the OSM street grid (a
  label's edge, not a surveyor's). `cityAreaAt` checks it after the hero's own places (39 号码头, 33 号码头 … keep their
  names) and before the hero's catch-all 内河码头 (it covered Jefferson St east of Taylor) and the DataSF zone;
  `zoneName('fishermans-wharf')`. The area id has no recorded greeting (`farZone` is null), so BAYBAY says nothing there
  instead of 你好，北滩！. **Washington Square**: the cause was not a hero-zone override. The provider answers from
  `far.zoneGrid` (16 u cells; `core/sfTerrain.ts` zoneAt, frozen) and the square's cell is Chinatown's although the point
  lies in North Beach's polygon. `exactZone()` checks the answer's polygon and takes the neighbouring cell's zone whose
  polygon holds the point (a landmark area still answers first inside its radius, by design: the Dragon Gate's 唐人街).
  The other hero-zone overrides were checked: they are exact district polygons, not the grid.
- **放弃 ≥ 44 px (item 5)**, `play/play.css` (surgical, lane A's file): `@media (pointer: coarse) { .ob-play-chip
  .ob-play-btn { min-height: 44px; min-width: 44px } }`, after the chip's 36 px and the quiet button's 34 px rules.
- Tests: `tests/opus-bay-w7-k2-transit.test.ts` (3: the published Powell–Hyde in node, a control run where the cable
  car's body goes over the parked toy car (gap −1.50 u), then with the tow: towed 2.7 s before the car arrives, moved
  2.20 u, the car's side passes 0.69 u from it, the landed pose fits and is parallel; occupied / at its spot / far / the
  traffic's or the player's own vehicle: no tow; BAYBAY steps aside from a car coming at her, not from one going away,
  the traffic, or while riding), `tests/opus-bay-w7-k3-goals.test.ts` (1), `tests/opus-bay-w7-k4-zones.test.ts` (2,
  **red on the old file**: "Jefferson & Hyde", and "28 of 1014 points named for the neighbouring cell's zone"),
  `tests/opus-bay-w7-k5-chip.test.ts` (1: the rule and its place in the cascade).

### Evidence

- Played, phone 390 × 844 dpr 3, zh (`C:/Users/willy/opus-qa/w7/k/partb.mjs`, images read):
  - the pill at Jefferson & Taylor and Jefferson & Hyde: **渔人码头 · Jefferson Street** (area `fishermans-wharf`; the
    arrival card 抵达 渔人码头); at Washington Square: **北滩 · Columbus Avenue**, BAYBAY greets 你好，北滩！这里是旧金山的
    「小意大利」 (`docs/opus-bay/qa/w7/K/b-wharf-washington-square-giveup-phone.jpg`, left and middle);
  - the tow (lane B's b1 setup: the empty toy car across the California St rails 75 u ahead of a running car, the player
    14 u off): the car stood at a stop 15 u short, set off, the tow started with the car's nose ≈ 10 u away, the toy car
    hopped 2.2 u aside and the car passed with 0.6 u between its side and the toy car
    (`b-toy-car-towed-california-phone.jpg`). After this run the reach grew by 1 s of the vehicle's speed (`LEAD_S`):
    in node the tow now starts 1 s earlier (9.3 s vs 10.3 s);
  - the activity chip (爬楼梯比赛 · 6.4 · 你领先！ · 放弃, shown through `play/chip.ts showChip`): 放弃 measures
    **50 × 44** CSS px, `(pointer: coarse)` true (74 × 36 in lane W's review) (the same image, right).
- **Item 3, the goals card and the N ride: not reproduced.** Played on the phone twice (`nride.mjs`): a new save
  (`save=off`), Start, the N from Duboce Park boarded while the welcome was open, the welcome's 我自己逛逛 chosen
  mid-ride: the goals step opened over the ride (the `panel` hold on the feet). Run 1, the step left open: the train ran
  through the Sunset Tunnel to **Judah & La Playa · Ocean Beach** (到达; the Metro goal ticked) with the step still up.
  Run 2, 我自己逛 tapped a few seconds after it opened: the ride went on (riding at 39 s and after). Node (the
  Powell–Hyde): the step opened by `startFree()` mid-ride, the `panel` lock held 40 s, closed with
  `afterGoalsStep('self')`, then the old goals card 10 s: the ride reached `hyde-beach`. Lane B's run
  (`C:/Users/willy/opus-qa/w6/b/live.mjs`) boarded through QA hooks with the harness clicking every "wander" button each
  second; its end state (the step open, the ride gone at 40 s) came back in none of these.
- Checks: part c (one run for both parts).

### Decisions

- Towed, not a blocker: an empty ride as an obstacle would hold a line for good (lane B's reasoning). Only a
  `displaced` ride is towed (driven off its spot): a ride at its own spot is never on the rails.
- The tow reach grows with the vehicle's speed (10 u + 1 s): at 9 u/s the fixed 10 u left 0.6 u of room.
- BAYBAY dashes aside (the pull's dash, running legs) rather than walking: a car at 9 u/s gives ≈ 2 s.
- The Wharf is a label area: no DataSF zone, no greeting line, no neighbourhood visit (visits stay DataSF's).
- The Wharf beats the hero's catch-all 内河码头 but not its named places (39 号码头, 33 号码头).

### Known gaps

- Beyond 250 u from the player the transit is not in the road-vehicle list: a ride left there is towed only once the
  player is back within 250 u (an "inside" hit tows at once then); nobody sees it meanwhile.
- BAYBAY stepping aside is node-tested only (not staged live: she rarely stands on the rails while the player is off
  them); the dash is the pull's (played in wave 5).
- A towed ride stays where it lands (`displaced`): bikes still roll home unseen after 80 u as before.

### Not done (this part)

- Nothing else of items 2–5.

### Requests

- None.

## Part c (2026-09-29, 23:05–23:30 PDT): the stick on hide and rotation, the glide's report

### What was built

- **`actors/pointer.ts` (item 6)**: every touch is let go (`onCancelAll`: the stick released; the touches, the pinch and
  the card pass-throughs forgotten) on `visibilitychange` → hidden (an app switch, the lock button, a call) and on
  `pagehide` (bfcache, the tab closing): the thumb's pointerup never comes then, and a stick held at the switch walked the
  player on after the return. A **width** change of the (visual) viewport while a finger is down is a rotation: the same
  release (the touch points are in the old frame). A height-only change (an iOS toolbar) keeps W6-K1's repaint and
  reading. Listeners removed on detach.
- **`actors/glide.ts` (item 7)**: `GlideSim` keeps one `GlideReport`, rewritten by every `step()` (every field reset,
  `softBox` too). Callers audited: `moveSystem.flyGlide` reads `bump` / `softBox` at once; the tests read `landed` /
  `edge` / `softBox` at once; nothing keeps it. A report is valid until the next step.
- Tests: `tests/opus-bay-w7-k6-stick.test.ts` (2: the W6-K1 harness with a document; **red on the old file**: "released
  when the page is hidden", "released on the rotation"), `tests/opus-bay-w7-k7-glide.test.ts` (1; **red on the old
  file**: "the same report object every step").

### Evidence

- Played, phone 390 × 844 dpr 3 (`stick.mjs`, CDP touch): the thumb pushed up → stick 1.00; `visibilitychange` hidden
  (the page's own listener, the state set to hidden) → stick 0, released, still 0 1.2 s after coming back with the old
  finger still down; pushed again, the viewport turned to 844 × 390 mid-touch → released (0), still 0 1.4 s later; the
  toolbar case (390 × 844 → 390 × 774 mid-touch) → still 1.00 (W6-K1 kept).

### Decisions

- A rotation drops the whole gesture, not only the stick: a look drag or a pinch in the old frame would jump too.

### Known gaps

- No real iPhone (as in W6-K1): hide, pagehide and rotation are CDP- and node-tested.

### Not done

- Of my row only the canopy over the rider is left (part a, Requests).
