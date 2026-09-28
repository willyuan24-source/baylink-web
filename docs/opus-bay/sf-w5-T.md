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
