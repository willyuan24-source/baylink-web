# Wave 5 · lane T · Transit & crowds (+ audio internals)

## Part a

Written 2026-09-28 by lane T's implementer (worktree `wt/w5-t` → `opus-bay`), part a = W5-T1 (the hooks), W5-T2 (the bus
stalls), W5-T3 (the tour bus boards without the driver question). Commits: `d0bcb32` (W5-T1), `069a8a4` (W5-T2 / W5-T3),
`04eb15a` (W5-T2: the ETA / stall / beat code moved into the lazy city chunk) and the one carrying this section.

### 给主人的摘要

1. **观光巴士"停在路上不动"找到原因并修好了。** 路口的玩具小车在等后面的巴士，巴士又在等前面的小车，两边互相等了将近 40 秒（马里纳区 Mason 街、要塞公园 Lincoln 大道都是这样）；坐在巴士上层的你和 BAYBAY 还被小车当成了"站在马路上的行人"。现在小车不会再等身后的巴士，真挡住巴士 5 秒就自己缩小消失。整圈 16 站实测：最长只停 5 秒，每一段都在报出时间的 1.1 倍以内。
2. **在渡轮大厦等车**以前可能等 2 分半，现在最多约 45 秒一定有车来。
3. **车停住 10 秒以上，"直接到站"会变成最大的按钮**，旁边写"车停住了"；"直接到站"黑屏等待时按"提前下车"或飞走，都会立刻生效，不会再被拉回站台。
4. **一日游坐观光巴士不再每站问一遍"上车 · 坐到…"**，走到站牌就直接等车上车（手机上实测）。
5. 给别的组的接口都已上线：活动 / 街角的人群站位（中间留 3 米通道）、路人会向你挥手、按真实进度算的乘车剩余时间（提示条已经在用）、叮当车摇铃面板的位置、转车台"嘿—咻"节拍。全部 1086 个测试通过；Higgsfield 花费 0。

### What was built (files, API)

| file | change |
|---|---|
| `world/sf/crowdSpots.ts` (new, pure, no three.js) | **W5-T1 hook for R / L**: `addCrowdSpots(key, spots: {x, z, r?}[], { face?, count?, lane? }) → remove` · `removeCrowdSpots(key)` · `crowdPins()` · `crowdLanes()` · `onCrowdSpots(fn)`; `count` people (≤ `CROWD_SPOT_MAX` 24 a group) sunflower-packed ≥ 0.95 u apart over the spots, each facing `face` (default: the group's centre); **the 3 u clear lane**: every group keeps a lane `CLEAR_LANE` = 3 u wide free of standers (default: from behind the group through its middle to what it faces — the aisle to the stage; facing nothing: across its long axis, a queue split in two; `lane` sets it, e.g. the GGB deck's centre line); a standing spot never lies in any group's lane. `crowdWave(x, z, r = 6)` for lane A (queued, the crowd drains it) |
| `world/sf/crowd.ts` | pinned sightseers: one on each registered spot within the crowd's 90 u (a free walker, else the farthest unseen one makes room; ≤ 4 placed a look, every 10 frames or on a change); never recycled while their spot is registered; spots on the roadway, unstandable or within 2.5 u of the player / BAYBAY wait; a removed spot's stander finishes and is recycled out of view. **Wave back**: `wave(x, z, r)` — walkers within r (not mid-crossing, not hopping) stop, turn to the player after a 0.08–0.53 s stagger and wave for `WAVE_TIME` 1.9 s; `waveAmount(w)` eases in and out; the near figure draws aWalk = −amount |
| `world/sf/cityLife.ts` | hands the crowd `crowdPins()` and `takeCrowdWaves()`; the game event `{ type: 'emote', who: 'player', emote: 'wave' }` → `crowdWave(player, 6)`; stale waves dropped while the crowd hides (a glide, fast travel). **W5-T2**: aboard transit (`move.mode === 'transit'`) the player and BAYBAY beside them are not pedestrians on the roadway for the toy traffic |
| `world/life.ts` | the people material's wave channel: the right hand (aInfo.z = 1) lifts 0.62 u and waves while aWalk < 0; the legs use max(aWalk, 0). Same material, same program; aWalk ≥ 0 draws exactly as before (the district promenade unchanged) |
| `game/transit.ts` (main graph, thin) | **W5-T1**: `rideEta(): RideEta \| null` (stub → the lazy chunk), `STALL_BIG` = 10, `TURN_BEAT` = 1.2, `turntableNear()`, `turntableBeat(id?, now = audioNow())`, `pushTurntable(id, strength = 1): boolean` (lane A: 2 on the beat). **W5-T2**: the 直接到站 veil's handle — a hop-off under the veil lifts it and gets off beside the vehicle (`dropVeil`), a flight started under it ends the ride where it is (`endLineRideQuietly`), `cancelRide` lifts it. DEV QA: `__opusBay.transit.busWatch()`, `.eta()`, `.hold(on)`. **W5-T3**: `boardLine(station, { to?, line?, auto? })` |
| `game/lineRides.ts` (lazy city chunk) | `rideEtaNow()` (bus / Metro: `LineRideSystem.rideLeft`; cable car, F-line, ferry: the boarding quote × the line still ahead; waiting: the vehicle's ETA + the quote), `watchStall(dt)` (the vehicle has moved when 0.5 u from where it last moved; a dwell counts), `noteTurning` / `turntableNear` / `turntableBeat`; `veiledSkip` returns `{ cancel() }`; `pollCity` runs the bus watch; `busWatchReport()`. **W5-T3**: a Grand Tour leg (`flow.trip.source === 'tour'`) or `auto: true` boards at once — BAYBAY: 上车！坐到… and `rideLine`, no dialogue; a map trip keeps its one pre-filled row |
| `game/ride.ts` | `RideState.quote` / `dist` (set by every ride start: the boarding row's seconds, the length along the line) |
| `data/transit.ts` | `LineRideSystem.rideLeft?()` (optional) |
| `world/busSystem.ts` | **W5-T2 instrumentation**: `Bus.why` (`BusWhy`: run · stop · dwell · board · stop-ahead · bus-ahead · box · road · person · hop-off) and `whyOf` (the box id, the road user's kind, `bus#i`, 'viewer'); `rideLeft()`; `eta()`: a running bus a hair short of its next stop is about to stop there (the ETA jumped by a lap / a dwell in the last frames). **The waiting rider's cap**: placements up to 31 s of running back (`DISPATCH_RUN`), never one that arrives later than the bus already coming (`dispatchMax` 33 s); after `waitRelax` 12 s of waiting a placement in view ≥ 100 u from the player is allowed (the far look); a coming bus that stands > 6 s counts its stand in its ETA (so another is brought in) |
| `world/lightRail.ts` | `rideLeft()` |
| `world/sf/lineFleet.ts` | `roadAhead(b, who)` names the road user's kind for the bus watch |
| `world/sf/traffic.ts` | **the stall fix**: `queuedBehind(car, q)` (from the car: behind it in its lane; or from q the way the bus looks ahead — a curve); a car never waits at its stop line for a vehicle queued behind it; never turns into an exit lane a transit body stands over; keeps a bus's pace with one within 12 u behind (`TRAFFIC.hurry` 11.5 u/s); a stopped car that holds a stopped transit vehicle up for `TRAFFIC.giveWay` 5 s — or finds itself inside a transit body — shrinks away (0.4 s) and is recycled, and is nobody's obstacle while it shrinks; `bodyDistance()` |
| `game/busWatch.ts` (new, lazy) | every loop bus 4 Hz: `watchBuses(dt)`, `busWatchNow()` (where, speed, why, how long still), `busStalls()` (the last 40 stalls: a bus standing ≥ `STALL_LOG_AFTER` 6 s other than at its stop, with its reason; DEV warning at 12 s) |
| `ui/rideSlots.ts` (new, tiny) | **W5-T1 hook for A**: `registerRidePad({ id, order, visible(ride), Component }) → remove`, `ridePads()`, `visibleRidePads(ride)`, `subscribeRidePads` |
| `ui/RideBanner.tsx` | the pads on a row of their own; **W5-T2**: after `STALL_BIG` s without the vehicle moving, 直接到站 is the big primary button, the bell steps back to a soft one and the line says · 车停住了 / · held up (inline styles: the banner's chunk carries no stylesheet, node tests import it) |
| `tests/opus-bay-w5-transit.test.ts` (new) | 16 tests, below |

### Evidence

**Checks** on the pushed tree `04eb15a` (rebased on `9238198`): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .`
0 errors (43 old warnings outside `src/opus-bay`) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts`
**1086 / 1086** (955 on `d0bcb32`, 1049 on `069a8a4`). No wall-clock flake this time.

**The cause, reproduced in node** (`C:/Users/willy/opus-qa/w5/w5-t/bus-repro.mts`: the published city streamed round the
rider, the game's `CityLife` crowd and toy traffic, the fleet's road users and viewer wired as `world/transitLayer.ts`
does, the rider on the deck; quality mid, the scout's legs):

| run | Ferry Building → Golden Gate Bridge (quote 193 s) | GGB → Lands End (quote 124 s) |
|---|---|---|
| wave-4 code | 258 s aboard; **38.8 s stall** at (−310.5, 310.2), Marina Blvd by Mason St: `road: traffic` — the car ahead at its stop line waited for "a transit vehicle in the box within 2 s" = the bus behind it (8.7 u from the node, the box 8.9) | 171 s; **38 s stall** at (−647.8, 711.2), Lincoln Blvd: the car waited for the player and BAYBAY on the deck (2.5 / 3.4 u from the node, counted as pedestrians) and the bus |
| after W5-T2 | 204–209 s (1.06–1.08 ×), longest hold 0 | 126 s (1.02 ×) |

The whole loop after the fixes (mid, warm-up 60 s, 7 legs round the 16 stops): 204 / 193 · 126 / 124 · 110 / 107 · 158 / 147
· 98 / 94 · 160 / 151 · 98 / 95 s — every leg ≤ **1.08 ×** its quote; the longest hold anywhere **5.1 s** (a toy car queued at
a junction another car holds, then giving way); the ETA never stood more than 5 s. Quality high, warm-ups 30 / 300 s: the
same two legs 209 / 194 s and 129 / 128 s, no hold over 2 s. (Before the curve rule a mid lap still showed one 39.7 s hold at
Ocean Beach, (−523, 1385): the car at its stop line 43° off the bus's heading; fixed by `queuedBehind` seen from the bus.)
The waiting rider at the Ferry Building (the camera looking up the approach): picked up after 155 s → **43 s** (the relaxed
dispatch after 12 s).

**Tests** (`tests/opus-bay-w5-transit.test.ts`, 16): the crowd-spot registry (count, spacing, facing, the lane toward the
sight and across a queue, capped, replaced, removed, an explicit deck lane); pinned standers on the published city (every
placeable spot filled, on its spot, facing the sight, 60 s later the same people, removed → gone, a far spot waits); the wave
back (walkers ≤ 6 u turn and lift a hand, the near figure's aWalk < 0, nobody farther, done after 1.9 s); the shader channel;
`rideEta` on a loop ride (waiting = the ETA + the quote; aboard the ETA never stood > 10 s, at boarding within 20 % of the
ride, progress → 1) and a cable car (only falls); the turntable beat (every 1.2 s on one clock) and the doubled push; the
ride pads; `queuedBehind` / `bodyDistance`; the toy car that no longer waits for the bus closing in behind it, gives way
after 5 s, and leaves a bus body at once; the rider aboard is not a pedestrian; the Ferry Building pickup ≤ 45 s with a
bus brought in; the bus watch (reason `road: traffic`, a stall logged and closed, no dwell ever a stall); **the loop on the
real streets with the crowd and the traffic: Ferry Building → GGB → Lands End, no stall ≥ 6 s, each leg ≤ 1.3 × its quote,
the ETA never frozen 15 s** (red on the old traffic code: 258 s aboard for a 193 s quote); a hop-off and a flight under the
veil; the banner's big 直接到站 after 10 s; the tour's auto-boarding vs a map trip's one question.

**In the real game** (dev server 5504, headless Chrome through `scripts/opus-shot.mjs`, `--force_high_performance_gpu`; every image read; key shots in
`docs/opus-bay/qa/w5/T/`):
- desktop 1440 × 900 high, en: boarded at the Palace of Fine Arts pole, the bus went Baker St → Mason St → McDowell Ave →
  Lincoln Blvd toward the bridge; `busWatch()` logged **0 stalls** on the rides before the forced hold (desktop and phone)
  (`t2-bus-lincoln-blvd.jpg`: the bus on Lincoln Blvd,
  the Bay and Alcatraz behind, "Sightseeing Loop · next Golden Gate Bridge"); held on Mason St with the QA hold: at 6 s the
  banner is unchanged, at 13 s "· held up" and **Skip to stop** as the big button (`t2-held-skip-big-desktop.jpg`), the watch
  warned `bus#0 (the rider’s) held 12 s by hop-off`; released, the ETA fell again (54 → 52 s) and the banner went back.
- phone 390 × 844 dpr 3 mid, zh: a tour-source trip at the Palace of Fine Arts boarded **without any dialogue** — "等观光巴士进站…约 8
  秒 · 不坐了", the pill "等观光巴士 · 艺术宫" (`t3-tour-boards-phone.jpg`); held on Mason St 13 s: "观光环线 · 下一站 金门大桥 · 车停住了"
  with 直接到站 as the big button and 下一站下车 soft (`t2-held-skip-big-phone.jpg`); released, "约 20 秒" on McDowell Ave with the
  normal banner.
- desktop zh: 直接到站 Palace of Fine Arts → Chinatown under the veil ("直接到站：唐人街龙门 · 联合广场 …", `t2-veil.jpg`), then
  提前下车 at once: off beside the bus at (−425.3, 400.3), still there 3 s later (`t2-veil-hopoff.jpg`).

**Rendering / budget**: no new material, draw call, geometry or program (the people material's shader gained two lines;
still one program). GameRoot on `04eb15a`: 803.13 kB / **302.73 kB gzip** (it was 303.33 on the tree before the move; the
rest of the growth since wave 4 is other lanes' and the day-0 glue); lazy `lineRides` 23.26 kB / 10.15 kB gzip, `RideBanner`
3.50 / 1.74. Lane T's main-graph share now is the thin stubs and the veil handle.

### Decisions

- **Fix the traffic, not the bus.** The bus already keeps behind toy cars; the deadlock was the car's side (waiting for the
  bus behind it, and for the rider on the deck). `queuedBehind` is judged both from the car and from the bus (a curve), and a
  car that still holds a stopped bus up gives way after 5 s (shrinks, like a toy popping out) — the one visible "cheat", kept
  rare by the other rules (1–14 give-ways per simulated run of 2–7 legs, most of them out of the rider's view).
- **Cars hurry ahead of a bus** (11.5 u/s with one within 12 u behind): a 5 u/s toy car held the loop to half speed down
  Marina Blvd (the ETA fell 0.48 s a second).
- **The waiting rider's cap is ≈ 45 s, not 15 s**, where the approach is in view: a bus is never popped in within 100 u of
  the player or in view before 12 s of waiting. Out of view (most stops) it stays ≈ 11–15 s.
- **"No progress" = the vehicle has not moved 0.5 u**; a normal stop (8 s dwell + braking) stays under the 10 s rule; a queue
  behind another bus's dwell may cross it, honestly.
- **The tour auto-boards any wave-4 line leg** (the loop and the Metro legs of the Grand Tour), not only the bus; a map trip
  keeps its pre-filled question (it is the player's choice), unless the caller passes `auto: true`.
- **Crowd pins count in the crowd's budget** (64 / 44 / 24 walkers at high / mid / low): an event of 16 on a phone at mid
  leaves 28 walkers for the streets round it.
- **The wave back is a raised hand**, drawn by the existing people shader (no new animation or program); the far figure has
  no hands (beyond 24 u nobody reads a wave anyway).
- **`rideEta` and the turntable beat live in the lazy city chunk** (city-only code): `null` in district mode.

### Known gaps

- A toy car that gives way shrinks in view (0.4 s); a car can still turn into the side of a moving bus (the bus's three
  sample points); such a car now leaves at once.
- The ETA while a bus follows a slower road user falls slower than real time until the car speeds up (≤ a few seconds now).
- The hop-off brake has no cap: a rider's hop-off request that the move system never completes would hold the bus (not seen;
  the QA hold uses it on purpose).
- The Hyde St terminus box wait (≤ 39 s an hour, wave-4 gap) remains; the big 直接到站 covers it after 10 s.

### Not done (part b)

W5-T4 (levers: per-instance distance cull of district life; cable-car / F-line far LOD with shadows near only), W5-T5
(the 3 u lane on the GGB deck and through event crowds for walkers, stepping round the residents, the M rows on the phone),
W5-T6 (`audio/hooks.ts` internals), W5-T7 (shoulds), W5-T8 (the rest of the shots). The crowd spots' lane already binds
standers; walkers crossing a lane are part b (T5).

### Requests

- **Lane A** (bell riff, emotes, heave-ho): the bell pad goes in with `registerRidePad({ id: 'bell', order: 10, visible: r =>
  r.kind === 'cable-car' && r.stage !== 'waiting', Component })` from your `init()` (`ui/rideSlots.ts`); for the crowd to
  wave back either emit `{ type: 'emote', who: 'player', emote: 'wave' }` or call `crowdWave(x, z)` (`world/sf/crowdSpots.ts`,
  pure); the heave-ho reads `turntableNear()` / `turntableBeat()` and pushes with `pushTurntable(id, 2)` on the beat
  (`game/transit.ts`; BAYBAY's 嘿—咻 bubble is yours).
- **Lanes R and L**: `addCrowdSpots('event:<id>', [{ x, z, r }], { face: stage, count: 16 })` for event crowds, `addCrowdSpots
  ('corner:<id>', queueSpots)` for a corner's "someone doing something"; keep the returned remover for the window's end.
  Spots on the roadway are skipped by the crowd.
- **Lane N**: thanks for reading `rideEta()` in the pill (`3ef3194`). A map trip's bus leg may pass `{ auto: true }` to
  `boardLine` if you want it to board without the question too (`game/tripRun.ts offerBoarding`).
- **Lane V**: the people material gained the wave lines (same program); please include a crowd wave in a gate run when A's
  emote wheel lands. GameRoot measured 302.73 kB gzip on `04eb15a` (for your bundle table).
- **Lane C**: nothing required; a tour bus leg now starts with BAYBAY's "上车！坐到<站名>" bubble (2.6 s) instead of the driver
  dialogue — if the tour wants its own boarding line there, say so and I will leave the bubble out.
- **Lead**: the day-0 lane-T note in `sf-w5-lead.md` §5 lists "the ride banner's bell pad slot" — it is `ui/rideSlots.ts`.

No relayed owner message arrived during this part. No Higgsfield credits used (no ledger rows).

## Part b

Written 2026-09-28 by lane T's implementer (worktree `wt/w5-t` → `opus-bay`), part b = W5-T4 (the levers), W5-T5 (the crowds:
the 3 u clear lanes, stepping round the residents, the M rows on phones), W5-T6 (`audio/hooks.ts` internals). Commits:
`97c0281` (W5-T6), `5a0aae1` (W5-T4), `e144476` (W5-T5 + the part-b tests), `a5b4b8e` (W5-T4: the F-line middle look in the
lazy chunk) and the one carrying this section.

### 给主人的摘要

1. **市中心更轻了。** 在唐人街、市政中心、联合广场、格蕾丝大教堂一带，远处渡轮大厦那边的行人、海鸥、帆船、旋转木马以前明明看不见也在画，现在只画镜头附近的：电脑上每帧少画 3–4 万个三角形、少 5–6 次绘制（唐人街 37.8 万 → 34.2 万），手机上也少约 3.5 万；站在渡轮大厦门口时，近处的人和鸟都还在。
2. **叮当车和 F 线电车离镜头稍远（约半个街区以外）就换"中等细节"版**，远看一样，三角形只有原来的 1/4 到 1/2；影子只画离镜头近的车。
3. **金门大桥上人群只走两边人行道，桥面中间留出一条通道**（游戏里 3 个单位宽，约占桥面一半），不会有人横穿车道挡路（以前桥面上约 1/4 的时间有人在中间）；活动现场（比如金门公园蓝草音乐节）的人群一定留出通往舞台的通道；路人会绕开六位居民。
4. **手机上在市场街地铁站上车**，6 个选项里一定有"M 线去石镇 / 州立大学"和"N 线去海洋海滩"（以前 M 线这两站被挤到第 7 行以后，看不到）。
5. **声音更稳**：同一个声音一秒最多响 16 次（一路捡金币不会炸音），坏掉的音效自动停用，环境循环声最多同时 6 个；"压低音乐"可以叠加，短的先结束、不会拖住长的。测试全部通过（关于海滩篝火测试的说明见下文）；Higgsfield 花费 0。

### What was built (files, API)

| file | change |
|---|---|
| `world/life.ts` (main graph) | **W5-T4 per-instance distance cull of the district life (city mode only)**: `LIFE_FAR` = walkers and their dogs 130 u, gulls / pigeons 130, the gliding pelicans 260, sailboats 260, the carousel 220, the perched GLB pelicans 110 each by its own distance (it was all four while any was near); a kind shrinks over the last 15–25 u (`LIFE_FADE`) and a kind with nothing in reach is not drawn (no call). `Packer` packs the instances in reach to the front of each InstancedMesh and copies a slot's colour / phase / walk / flap only when the instance behind it changes. **District mode unchanged**: `cullFar()` is false there, every instance is pushed in order (slot k = instance k: the same counts and matrices as before). QA: `life.drawn()`, `life.peopleSlot(k)` |
| `world/cablecar.ts` | `cableCarMidGeometry()`: the cable car's middle look, 576 triangles (full 2,124, far 156): the saloon stack with one warm window band and two posts a side, the benches, brass poles as thin boxes, dashes and lamps, roof, clerestory, fascia, lamp bars, the gripman in five pieces |
| `world/flineLayer.ts` (lazy) | `carMidGeometry(livery)`: the F-line car's middle look, 488 triangles (1,112 / 108): the open window band shows the light inside between six posts a side (the first draft's dark glass band read as another car at 50 u; shot below). It lives in the lazy F-line module rather than `world/streetcar.ts`, which the main graph carries (`CAR_LEN`, `CAR_Y` now exported there) |
| `world/sf/lineFleet.ts` | `ExtraVehicleKind.mid?` / `.shadowNear?`, `EXTRA_SHADOW_NEAR` = 45: a kind with a middle look draws the full car with its shadow within 45 u of the camera, the middle look (no shadow) to `FAR_LOD` 110, the far look to 300; the middle geometries join the far BatchedMesh (no new call, material or program); kinds without one (the buses, the LRVs) keep the old bands (60 / 110 / 300). `stats()` counts the middle look's triangles |
| `world/transitLayer.ts` | the cable cars and the F-line cars pass their middle looks |
| `world/sf/crowdSpots.ts` (pure) | **W5-T5**: `walkerLanes()` (every group's aisle and the clear lanes, with half widths; the same array until a change), `addClearLane(key, lane, width = 3, { noCross })` → remover (a lane without standers of its own; `noCross`: walkers never cross it); standers of every group keep out of the clear lanes too |
| `world/sf/crowd.ts` | `CrowdEnv.lanes?()`; `laneStep`: a walker going along a lane (within ~45° of its line) or a sightseer standing in one steps sideways until its body is out (its own side, else the other; onto ground a walker fits on, never from a sidewalk onto the roadway), eased in and out (`Walker.lx / lz`); `inLane`: no sightseer spawns in a lane; `alongLane`: no crossing runs down a lane, none at all across a `noCross` lane; a walker crossing an aisle square on keeps going |
| `world/sf/cityLife.ts` | hands the crowd `walkerLanes()`; `deckLanes()` = the Golden Gate Bridge deck's centre line (the landmark's local deck from END_S to END_N through `landmarkToWorld`), registered as a `noCross` clear lane while the city life runs. The six residents were already stepped round (wave 4, the routed G2 w3 review 9): kept, now tested |
| `game/lineChoices.ts` | `LineChoiceOptions.prefer`, `LineChoice.rank` (0 a next stop · 1 preferred · 2 the rest): a Metro station offers its next stops, then the preferred stops (nearest first), then the termini and ★ stops |
| `game/lineRides.ts` | `stationChoices` passes the Metro goal's ends (`METRO_ENDS`, lane C's `data/sf/goalMarks.ts`: the N to Judah & La Playa, the M to 19th & Winston / 19th & Holloway) as `prefer` and merges the lines rank by rank, each line in turn offering its next row not offered yet (a row both lines share no longer uses up a line's turn) |
| `audio/hooks.ts` (internals; the frozen API unchanged) | **W5-T6**: options reach the recipe with only the keys given, finite and clamped (gain 0..2, pan −1..1, pitch 0.25..4); token buckets — one id `SOUND_RATE` 16 a second (burst `SOUND_BURST` 6), all ids `ALL_RATE` 40 (burst 16), drops counted; a recipe that throws `RECIPE_STRIKES` 3 times is switched off until registered again; `setLoop` before `registerLoop` is remembered (≤ 32 ids); at most `MAX_LOOPS` 6 loops built, the loudest targets first, the others wait for a place; `duck` capped at `MAX_DUCK_MS` 60 s; `audioHooksStats()` adds waiting, plays per id, throttled, errors, off, pending |
| `audio/engine.ts` | `Bus.duck` keeps several ducks (≤ 8; the ones ending first make room): the lowest in force applies and each ends on its own. It used to keep the deepest amount until the latest end (a 3 s duck to 0.2 under a 12 s duck to 0.45 held the music at 0.2 for 12 s; the street layer's rolling ducks held their deepest level as long as they kept coming). `Bus.ducking` for QA |
| `audio/audio.ts` | DEV `__opusAudio.stats()` shows `hooks` and the music / ambience `ducks` |
| `tests/opus-bay-w5-transit.test.ts` | 8 new tests (24 in all), below; `tests/opus-bay-sf-transit-review.test.ts` R4 updated on purpose (the M to Stonestown / SF State on every device, Balboa Park on desktop) |

### Evidence

**Checks** on the pushed code tree `e144476` (rebased on `af8f50f`): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .`
0 errors (43 old warnings outside `src/opus-bay`) · `tests/opus-bay-*.test.ts` **1126 / 1126** (run at 05:50 PDT). On
`a5b4b8e` (the F-line middle look moved, 06:05 PDT): tsc 0, eslint 0 errors; the suite 1123 / 1126 — `sf-nav` "window build
906.9 ms" (a wall-clock assert while a phone Chrome ran; passes alone) and **two landmark tests that fail from 06:00 to 21:30
PDT in the fire season whatever the code**: `sf-landmark-context` "D2-10 tops" and `sf-sites-w4` "flags … the landmark table
matches the models" measure the Ocean Beach fire rings with their flames lit (W5-L2 draws them through lane R's
`isFireRingLit` on the real Bay clock: top 1.57 u against the table's 1.4). With the Bay clock pinned to 05:30 (a `--import`
preload calling `__setBayNowForTests`) both pass (25 / 25), and so does the whole suite (the numbers are in the commit that
carries this section). Request to lane L and the lead below.

**W5-T4 in the game** (dev server 5504, headless Chrome with `--force_high_performance_gpu`, the capacity scout's per-draw
attribution; "before" = the wave-4 behaviour switched back on in the page for the same view: the life cull off, the cable /
F-line middle instances given the full geometry and a 60 u shadow). Calls and triangles are the renderer's totals (shadow pass
included); no fps numbers (lane V and the lead):

| spot | desktop 1440 × 900 high: before → after (calls · triangles) | phone 390 × 844 dpr 3 mid |
|---|---|---|
| Chinatown | 123 · 378.5k → **117 · 341.6k** (pedestrians 16.5k, sailboats 9.7k, gulls 7.3k, carousel 1.1k, dogs 0.9k gone; cable cars 7.7k → 6.2k, their shadow 4.2k → 2.1k) | 101 · 281.0k → **96 · 245.7k** |
| Civic Center | 78 · 262.6k → **73 · 227.4k** | — |
| Union Square | 86 · 286.9k → **81 · 251.2k** | 70 · 215.1k → **65 · 180.4k** |
| Powell & Market | 77 · 274.2k → **72 · 240.5k** | — |
| Grace / Nob Hill | 93 · 385.2k → **88 · 343–353k** | — |
| Ferry gate | 103 · 385.8k → **102 · 371.6k** (35 of 51 walkers, 26 of 37 birds, 4 of 5 sailboats, 3 of 4 pelicans in reach) | 80 · 300.0k → **80 · 285.4k** |

- `qa/w5/T/b-t4-chinatown-no-far-life.jpg`: Chinatown as the player sees it — none of the culled life was in view there. At
  the Ferry gate the commuters, the stalls and the promenade's walkers still show (scratch `d-ferry-gate.jpg`).
- `b-t4-cable-full-vs-mid-50u.jpg`, `b-t4-fline-full-vs-mid-50u.jpg`: the full look (left) beside the middle look (right)
  50 u from the camera over the water off Marina Green (QA meshes placed in the page): the cable cars read the same; the
  F-line's first middle look (a dark window band) did not, so it shows the light inside between six posts now. At 100 u
  both pairs are indistinguishable (scratch `lod-*100.png`). On California St from a fixed street camera the cars at
  30–75 u look the same in both modes (scratch `st*.jpg`).

**W5-T5.**
- **GGB deck, node** (the published city, the game's crowd, the player walking the centre line end to end and back at
  4 u/s): a body in the 3 u lane in under 3 % of the deck samples (the test's bound; 0.8 % in a 60 s run round a fixed spot mid-span), **25 %** before (walkers
  on the left of the east footway's path and deck crossings); deep in it (< 1.2 u) under 0.5 %; **nobody within 0.9 u of the
  player** the whole way.
- **GGB deck, in the game**: desktop — 54 walkers on the deck, 0–1 of them in the lane over 14 s of walking
  (`b-t5-ggb-deck-desktop.jpg`: both sidewalks busy, the roadway clear); phone 390 × 844 — 36–37 on the deck, 0 in the lane
  (`b-t5-ggb-deck-phone.jpg`).
- **Event crowds**: with `?date=2026-10-03T12:30` the running game has three lanes — lane R's
  `event:hardly-strictly-bluegrass-2026` and `event:sf-african-arts-festival-2026` aisles and `deck:golden-gate-bridge` — and
  16 pinned visitors at Hellman Hollow (`b-t5-hellman-hollow-oct3.jpg`). Node test: a 20-visitor group near Union Square for
  60 s — nobody stands in its aisle (sightseers offered the aisle's own middle never take it), at most 2 samples of a walker
  going along it without stepping out.
- **Residents**: Ray at the Powell turntable, 60 s of the city crowd round him — ≥ 300 samples within 5 u, the closest
  **0.70 u** centre to centre (two bodies side by side; 0.39 u, inside his body, in the wave-3 review).
- **M rows on the phone**: Powell, zh, 390 × 844 (`b-t5-m-rows-phone.jpg`): N 线 · 去 ★ 市政中心站 · M 线 · 去 ★ 蒙哥马利站 ·
  N 线 · 去 ★ 海洋海滩 · **M 线 · 去 ★ 石镇** · **M 线 · 去 ★ 州立大学** · N 线 · 去 ★ 内河码头站 · 看线路图 · 先不坐了 — two
  columns, nothing cut. Every Market St station, Church, Castro and West Portal offer 石镇 and 州立大学 on a phone (test);
  desktop keeps Balboa Park too.

**W5-T6 in the game**: after the first key press the context runs; 22 sounds and 3 loops are registered (lanes E, D, A, R);
30 `playSound('e-coin', { gain: 7 })` in one frame → 6 played (the gain clamped to 2), 24 throttled; `duck('music', 0.3,
2000)` + `duck('music', 0.6, 6000)` → 0.3 with two ducks, 0.6 after 2.6 s, 1 after 7 s. The lead's frozen contract test
passes unchanged.

**Tests** (8 new in `tests/opus-bay-w5-transit.test.ts`): the life cull (district mode: every walker in its own slot;
Chinatown draws no walker, dog, gull or carousel and saves > 24k triangles in node; at the Ferry gate the walkers in reach,
each slot carrying its own walker's phase); the middle looks (≤ 600 / ≤ 500 triangles; 30 u full + shadow, 50 and 109 u the
middle look, 130 u the far one; a kind without a middle look unchanged); the GGB deck lane; the 20-visitor aisle; Ray; the
Metro rows on a phone; the hooks' internals (clean options, both rate limits, strikes, pending loops, the loop cap, the duck
cap); a bus's several ducks.

**Budget**: no new material, program, draw call or warm-up (the middle geometries join an existing BatchedMesh; the life
kinds draw fewer instances, sometimes no call). GameRoot on `a5b4b8e`: 805.67 kB / **303.96 kB gzip** (304.26 before the F-line
middle look moved to the lazy chunk; 302.73 on part a's `04eb15a` — the difference includes every lane's commits since; lane
T's part-b share in the main graph is the life cull and the hooks' guards); lazy `transitLayer` 48.91 kB gzip, `lineRides`
10.33.

### Decisions

- **Distance, not the frustum.** `Life.update` gets no camera (world/world.ts is lane V's), and the triangles the scout
  measured are hundreds of units away, not behind the camera. The reaches match what a player can read: a 1.3 u walker at
  130 u is ≈ 9 px on a 900 px screen at the 42° lens (the city crowd itself lives within 90 u of the player).
- **Sailboats keep 260 u**: they give the Bay views from Telegraph Hill and the Ferry gate their life (from Chinatown they
  are 265–370 u away).
- **The middle look starts at 45 u, not 60**: at 45 u a car is ≈ 70 px tall and the middle look still reads the same (shots);
  shadows beyond 45 u fall outside the 48 u shadow box round the player almost always anyway. Buses and LRVs keep their bands
  (the LRV car is already 396 triangles; the bus's full look is the rider's own vehicle).
- **The deck lane is `noCross`**: walkers keep to their own sidewalk the whole span (crossings were most of the lane's
  traffic); an event aisle may be crossed square on (people cross an aisle), never walked along.
- **The Metro goal's ends lead the phone rows** (after the next stops): on a phone Balboa Park gives way to Stonestown and SF
  State at the Market St stations; the station card follows the same list.
- **Hook limits sized for the real callers**: a coin trail picked up at a run is ≈ 7 chimes a second (E's pitch ladder),
  well under 16; the six-loop cap is R's three event loops plus room.

### Known gaps

- The per-instance cull is by distance only (a walker 100 u behind the camera at the Ferry gate is still drawn).
- Holding W on the GGB deck (desktop, the follow camera from the south tower) the player drifted onto the east sidewalk
  (1.9 u off the centre line) at 2.5 u/s in one run; the crowd is on the sidewalks by design, so the player meets it there.
  Lane F's deck steering (Requests).
- The fire-ring tests' time dependency (above) makes the whole suite red from 06:00 to 21:30 PDT until lane L pins the clock.

### Not done (part b)

W5-T7 (shoulds: honest service rows on station cards, the idle cable car to the barn after 23:00, plaza pigeons scattering
when you run — the existing flock already flees a running player) and W5-T8 (the remaining shots; the loop bus on Lincoln
Blvd and the 直接到站 phone banner are in part a; the phone 4× gate is lane V's). A frustum test for the district life.

### Requests

- **Lane L** (and the lead): `tests/opus-bay-sf-landmark-context.test.ts` "D2-10 tops" and `tests/opus-bay-sf-sites-w4.test.ts`
  "flags … the landmark table" read the fire rings on the real Bay clock; from 06:00 to 21:30 PDT (1 March – 31 October) the
  lit flames raise the drawn top to 1.57 u. Pin the clock in those tests (`__setBayNowForTests('2026-09-28T05:30')` from
  `game/bayNow.ts`, reset afterwards) or measure the unlit model; until then every lane's "fail 0" depends on the hour.
- **Lane F**: holding W on the GGB deck the player slid to the east sidewalk among the walkers (2.5 u/s over 10 s); the crowd
  keeps the centre 3 u clear (`deckLanes()` in `world/sf/cityLife.ts`, ±1.5 u of the deck line), so deck steering that keeps
  the player there makes the MF2 acceptance's 3 u/s easy.
- **Lane V**: for the gate table — the district-life cull and the middle looks change calls / triangles in the downtown
  spots (table above; the Ferry gate −14k). No material or program was added (nothing to warm). `LIFE_FAR` in
  `world/life.ts` and `EXTRA_SHADOW_NEAR` in `world/sf/lineFleet.ts` are the knobs if the gate wants more.
- **Lanes A, D, E, R** (audio hooks): nothing to change. The limits: one sound id 16 plays a second (bursts of 6), all together
  40; a recipe that throws three times is off until registered again; `setLoop` may come before `registerLoop`; at most 6
  loops sound at once (the loudest); a `duck` lasts ≤ 60 s and ducks stack (the lowest wins, each ends on its own).
  `__opusAudio.stats().hooks` (DEV) shows plays, drops and errors per id.
- **Lane R**: your event aisles are walker lanes now too (nothing to do). If a stage wants its aisle elsewhere, pass `lane` to
  `addCrowdSpots`; the width stays 3 u.

**Final checks** (the pushed tree `5e5cb20` + this report, rebased on `da331c9`: lane F's deck steering and lane V's lit nights came in): tsc 0 · eslint 0 errors · the suite **1139 / 1139** with the Bay clock pinned to 05:30 (the fire-ring tests above); the hashes after that rebase: W5-T4 follow-up `a5b4b8e`, W5-T5 follow-up `5e5cb20` (the lane step allocates nothing per frame).

No relayed owner message arrived during this part. No Higgsfield credits used (no ledger rows).
