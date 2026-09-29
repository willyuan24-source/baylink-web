# Wave 6 · lane B — the skipped W5-bus review, and transit

Lane B of wave 6 (`docs/opus-bay/sf-w6-lead.md` §3): worktree `C:/Users/willy/wt/w6-b` (branch `w6-b`), dev port 5603,
scratch `C:/Users/willy/opus-qa/w6/b/`. Owns `world/busSystem.ts`, `world/flineSystem.ts`,
`world/sf/{lineInterlocks,traffic,tourBus,lineFleet,stations}.ts`, `data/transit.ts`, `data/fline.ts`, `data/ferry.ts`,
`tests/opus-bay-w5-deadlock.test.ts`.

## 给主人的摘要

1. 补做了 W5 "车辆卡死修复" 那 5 个没审查就上线的提交的对抗审查：逐行读完、在桌面和手机 390×844 实际坐车跑了一遍。
2. 找到并修好一个真问题：公交、电车、叮当车、轻轨只会给**走路的**你让路——你骑单车或开小车停在它们路上时，它们会直接穿过你的车。现在都会停下来等（游戏里实测：叮当车在你的小车前约 3 个单位停住）。
3. 上一位审查员留下的未提交修改逐段判断后全部保留并补了测试：市场街那段公交和 F 线电车共用的单轨路段，公交最长要等 47 秒，现在 ≤ 7 秒；每帧的小垃圾也清掉了。
4. M 线已取消的 San Jose & Mt Vernon 站（SFMTA 2024-09-28 永久取消）从游戏里拿掉了。
5. 叮当车各站在中文里有了中文名（地图上原来写 "California & Van Ness"，现在是 "加州街 · 范尼斯大道"）；你坐叮当车下海德街时，停在渔人码头站的观光巴士会马上关门开走，不再让你干等 8 秒；索萨利托渡轮码头（还没开通的航线）正式豁免，不再算巡检缺陷。

## Part a — the review, the defects, the M stop (02:00–02:30 PDT)

### What was built

- `src/opus-bay/world/sf/roadViewer.ts` (new): `roadViewer()` — who a transit vehicle stops short of: the player on foot,
  or sitting in their bike / toy car (at the vehicle's pose). `world/transitLayer.ts` (cable cars, the fleet: loop bus
  and Metro) and `world/flineLayer.ts` (F-line) use it (both outside my table: surgical, one line each, named here).
- The previous reviewer's edits (`w5-bus-uncommitted.diff`), every hunk kept on the current tree (see the table below):
  `world/flineSystem.ts` (no single-track block taken past where the road stops a car; scratch `Need` records),
  `world/sf/lineInterlocks.ts` (`holdBefore`: a car leaving a Market St part to a bus waits at the passing place before
  it; plain loops), `world/busSystem.ts` (plain loops), `world/sf/traffic.ts` (`measureZones` apart, no closures).
- `data/transit.ts` `RETIRED_STOPS` (+ `buildTransitW4` drops them), `scripts/opus-sf/lib/metro.ts` (makes no stop for
  one), `public/opus-bay/sf/v1/transit.json` + `transit-w4.json` (the stop and its pole removed).
- Tests: `tests/opus-bay-w6-b.test.ts` (W6-B1 the player's vehicle, W6-B3 the M stop), `tests/opus-bay-w5-deadlock.test.ts`
  (the proof's bus interlock bound 60 → 25 s).

### Review

The five W5-bus commits that went live unreviewed (`5a726a5a` traffic right of way / stop zones / crossings,
`1ad63d6a` the autopilot's pass, `ec4f3a10` interlocks, `ce073ce9` the proof, `52091013` the proof's interlock split):
every line read (`git show` of each, and the files as they stand now).

- **Played in the game** (dev server 5603, one headless Chrome at a time, no PERF-LOCK; the W5-bus live harness copied
  to `C:/Users/willy/opus-qa/w6/b/live.mjs`, every image read): the N from Duboce Park to Ocean Beach on desktop
  1440 × 900 (168 s, the trains' longest stand outside a dwell 0.2 s, a forced broken-down car across the rails gave way
  at 0.4 s — `oncoming`) and on the phone 390 × 844 dpr 3 (see "Known gaps": the harness's ride ended at 40 s there, and
  the new-save goals card covered the ride in both — lane K2's item).
- **Node, the published city** (the reviewer's adversarial harness `C:/Users/willy/opus-qa/w6/b/adv/adv.mts`, pointed at
  this worktree): `market` (8 loop rides Castro → Civic Center, 2600 s simulated) before / after W6-B2; the deadlock
  file's 2 × 1 h interlocks and 20-minute proof before / after.

| # | Defect | Evidence | Fix | Test |
|---|---|---|---|---|
| 1 | **The transit drove through the player's toy car and bike.** The cable cars, the F-line, the loop bus and the Metro stop for `viewer.onFoot` only (`runtime.move.mode === 'foot'`); W5-bus gave the player's vehicle right of way over the toy traffic, but the transit never saw it — a bus only when heading the same way (`lineFleet.roadAhead`, cos ≥ 0.5, the `player` road vehicle), the rail lines never. A player standing across the tracks on a bike, or the autopilot swinging round a parked car into a bus's lane: the bus / tram ran through the car and the rider | node, `TransitLayer` on the published data: a running bus, the player's toy car across its road 16 u ahead → the bus's nose came within 0.05 u (then past) | `world/sf/roadViewer.ts`: the viewer is the vehicle while the player sits in it (`transitLayer.ts`, `flineLayer.ts`) | `W6-B1` (bus, streetcar, cable car; red → green) |
| 2 | **The rider's bus stood 47 s at the Market St interlock** (the leftover W5-bus bounded at 60 s: the loop runs 148 u on the F-line's single-track stem). A streetcar leaving the part to the bus stood at the part's edge holding the single-track block beyond it; the car in the part coming the other way needed that block, so the waiting car was "needed" (`neededByAPart`) and went in after all, and the bus waited out its run | the deadlock proof (whole file): `bus at an interlock 47.0 s box:f-line@5661:1179 (149, 601)` | the previous reviewer's hunks: the car waits at the passing place *before* the part without the block (`holdBefore`, `flineSystem` takes no block past where the road stops it) | the proof's bus interlock bound 60 → 25 s: red before (47.0 s), green after (7.0 s, California & Drumm); `market` harness: the rider's bus 9.2 s → none over 3 s; the longest streetcar stand 36.8 → 30.5 s |
| 3 | **Per-frame garbage in the interlock questions** (asked for every streetcar and cable car every frame): `boxes.find(closure)`, `buses.some(closure)`, a module `Set` and its iterator in `neededByAPart` (which also kept the last city's cars alive after a world switch), `nextNeed` / `bodyS` records, and `zonesOn`'s closures making every cache hit allocate a context (the reviewer measured ≈ 80 B a call, 5–8 kB a frame) | code read; the reviewer's `ALLOC=prof` harness | the reviewer's hunks (plain loops, scratch records, `measureZones` apart) | equivalence: the node proof with only the `traffic.ts` hunk gives byte-identical output to the tree before it; the whole suite green |

Judged and left as they are (not defects, or not worth the risk now):

- **Toy traffic right of way** (`5a726a5a`): `waitsFor` / `inPathOf` / the 2 s `giveWay` / the hop to the kerb (the
  right of travel: `(-cos h, sin h)` = forward × up, checked) / keep-clear stop zones / crossing boxes
  (`nearTransitLine` samples the lines every 2 u, so a 4 u reach cannot miss a junction). A car that is `leaving` is
  nobody's obstacle and no longer a queue member — right. The `player` road vehicle is registered only while occupied,
  so a parked toy car never makes toy cars vanish. The shrink is visible (a toy pop) — lane T's known gap, kept.
- **The autopilot's pass** (`1ad63d6a`, `actors/**` = lane K1's): a pass into the oncoming lane checks only the discs
  seen when it plans; an oncoming toy car then stops and gives way after 2 s (the player's vehicle in its path), and
  since W6-B1 an oncoming bus / tram stops short of it too — while the autopilot, held by a vehicle, re-plans a pass
  round it after 0.8 s. No mutual wait for good: the autopilot gives up after 14 s at the latest, as before.
- **Interlocks** (`ec4f3a10`): can two vehicles wait on each other? A bus waits at a box only while a streetcar's
  centre is in the part (or moving within 14 u of it); a yielding streetcar stands 0.5 u short of the part (after
  W6-B2 at the passing place before it), so it never blocks the box it yields at; a streetcar another one in a part
  waits for never yields (`neededByAPart`, transitively), and one inside a part never yields; the cable cars' yield is
  capped (`YIELD_MAX` 34 s unless the bus is within 40 u — and a bus within 40 u is moving to the box or waiting at a
  box the car does not block). The 2 × 1 h node runs: nobody waits for good; a bus at a box ≤ 6.9 s.
- **World switch, save reload, a hidden tab, Settings open**: the per-car state (`fYield`, `holdOf`) is in WeakMaps
  keyed by the city's objects; nothing is saved; `WorldScene` clamps dt to 0.1 s and rAF stops in a hidden tab, and no
  transit code reads the wall clock — a tab hidden for minutes resumes where it was. Settings not pausing the world is
  lane K2's item (the tour bus boards and drives on).
- **`violations()` station-pass tolerance 14 → 15 u** (`ec4f3a10`): a check relaxed, but the geometry supports it (a
  car pulling out past one dwelling on the far side clears it 14.4 u from its stop).

### Evidence

- Checks on `afd164e1` (the three commits): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old
  warnings) · the suite: see the push line below.
- The deadlock file (whole, after W6-B2): 9 / 9; `bus at an interlock 7.0 s box:california@6294:0`, the lap 1009 → 976 s,
  the road's longest 2.1 s. Before (the tree at `294746bc`): `bus at an interlock 47.0 s box:f-line@5661:1179`.
- `market` harness (`C:/Users/willy/opus-qa/w6/b/adv/market-{base,full}.log`): 8 / 8 rides arrive both times; the rider's
  bus at the Market St box 9.2 s → no stand over 3 s.
- Live, desktop N ride: `C:/Users/willy/opus-qa/w6/b/live/desk-n.out` (168 s, trains ≤ 0.2 s, a forced car across the
  rails gave way in 0.4 s).

### Decisions

- The previous reviewer's diff: **all hunks kept** (none dropped) — the behaviour hunk measurably shortens the worst
  wait and deadlocks nothing in 2 × 1 h + the 20-minute proof + 8 Market St rides; the garbage hunks are equivalent.
- The M stop is removed from the published data directly (a JSON round trip of both files is byte-identical, so the
  edit touches only its two entries) plus a runtime guard and a pipeline skip, rather than a re-bake (no OSM inputs
  here; a re-bake keeps it out now).
- The player's vehicle counts as "someone on the roadway" for every transit line (the same stop distances as a person;
  BAYBAY's "…往路边站一站吧" line answers a long wait, as on foot).

### Known gaps

- BAYBAY on foot is not a `viewer`: a tram can still pass through her when she stands on the rails and the player does
  not (pre-wave-5; BAYBAY's movement is lane K1's).
- The live phone N ride of the harness ended after 40 s (desktop: 168 s, arrived) — looked at in part b.

### Not done (part a)

- The T items zh cable-car stop names, the shared Hyde St box, `ferry:sausalito` → part b.

Part a pushed 02:47 PDT: `f836663a` W6-B1 · `87f716be` W6-B2 · `d67b2ca3` + `c19249f3` W6-B3 · `f8c3615d` W6-B4 (report);
checks on the rebased head: tsc 0 · eslint 0 errors (43 old warnings) · the suite **1399 / 1399**.

## Part b — the T items: zh cable-car names, the Hyde St box, `ferry:sausalito` (02:50–03:25 PDT)

### What was built

- **zh cable-car station names** (`data/transit.ts`): `CABLE_STREET_ZH` (the 43 streets the cable cars stop at) and
  `stationZh()`; `buildTransit` names each cable-car station's zh "加州街 · 范尼斯大道" (it was the English short name).
  The game's own zh street names are reused where it had one (鲍威尔街, 加州街, 海德街, 市场街, 联合街, 伦巴底街,
  百老汇街, 菲尔伯特街, 蒙哥马利街, 邮政街, 湾街, 格林街, 哥伦布大道; Chinatown's 都板街 for Grant Ave and 企李街 for
  Clay St), else the common transliteration; a street without one keeps the whole short English name (never half and
  half). The turntables keep their names (Powell & Market 转车台 …: other lanes' attraction rows and tests use them).
  `tests/opus-bay-sf-transit-verify.test.ts` verify M2 now reads the arrival toast in either language (surgical, named).
- **The shared Hyde St box** (`world/busSystem.ts` `InterlockBox.wanted` + `BOX_HURRY_DWELL` 1.5 s,
  `world/sf/lineInterlocks.ts` `riderWantsBox`, `world/sf/lineFleet.ts` `busInterlocks(…, wantedBy)`, one line in
  `world/transitLayer.ts`): the loop's Wharf & Hyde stop lies inside the Powell–Hyde line's box (bus arc 449.9 in the
  box 437–480; the bus runs 1.5–1.8 u from the cable-car track there, bodies overlapping). A bus dwelling there cuts its
  stop to 1.5 s while the cable car **carrying the rider** comes down Hyde St to the box (≤ 70 u, heading in) — never the
  rider's own bus, never while boarding or hopping off.
- **`ferry:sausalito` waived by name** (`scripts/opus-sf/qa/sweep-static.mts`, surgical): the static sweep takes only the
  quays of a running ferry route. The Sausalito route is data for a later boat (`data/ferry.ts` `running: false`), its
  quay (−1262, 116) lies on C2's Marin board off the walkable model, and nothing sends a player there (the ferry
  interactables and `ferryTerminal()` already skip non-running routes).

### Evidence

- `tests/opus-bay-w6-b.test.ts`: **W6-B5** zh names (red before: every zh name was English; now none has a Latin letter,
  the English names unchanged); **W6-B6** the waiver (no Sausalito terminal offered, the sweep's `r.running`); **W6-B7**
  the Hyde St box (red with the cut disabled; no rider / a car past the box → the full 8 s stop).
- Measured before the Hyde St change (`C:/Users/willy/opus-qa/w6/b/hyde/wait.mts`, the loop and the cable cars, 2 h in
  node): since W5-bus a non-rider cable car leaves the box to the bus — it waits at its stop instead (≤ 46 s, once an
  hour, at Hyde & Chestnut, "LONG t 2169 powell-hyde#0 s 402/471 … occ true"); no car stood in the run for the bus. The
  rider's car never yields but still had to wait out the bus's whole stop in the box: the case W6-B7 removes.
- Played, phone 390 × 844 dpr 3, zh (`?lang=zh-Hans`): the map's California line terminus reads **加州街 · 范尼斯大道**
  (`docs/opus-bay/qa/w6/B/phone-map-zh-cable-station.jpg`). The N ride on the phone with the goals card dismissed:
  167 s, arrived, trains ≤ 0.2 s outside a dwell, a forced car across the rails gave way in 0.3 s
  (`docs/opus-bay/qa/w6/B/phone-n-ride-irving.jpg`: riding down Irving St, BAYBAY aboard, the rails clear ahead).

### Decisions

- zh intersection names use " · " between the two streets (as the game's other zh place pairs); Stockton St is
  士德顿街 (Chinatown's form, beside 都板街 / 企李街), Van Ness Ave 范尼斯大道, Geary St 吉里街 (the game's 吉里大道 is the
  boulevard), Jackson St 杰克逊街 (the Nob Hill stops, not Chinatown's 积臣街).
- The Hyde St box is eased from the bus side (a short stop for the rider's cable car), not by moving the loop's Wharf &
  Hyde stop off Hyde St: a stop move changes published data, the pole placement and the sweep targets, and the
  pipeline designs the loop's stops.
- `ferry:sausalito`: a waiver, not a quay on the model (the Marin board is a picture; a walkable Sausalito is a new area).

### Known gaps

- On the phone the harness's first N ride ended 40 s in, with the new-save goals card open over it (the end shot); a
  second run with the card dismissed rode the whole 167 s; a third, card open from the start, waited with the world
  paused (the ETA frozen at 11 s for 4 minutes — the card pauses the world, as designed). Not reproduced on desktop (the
  card opened mid-ride and the ride went on). See Requests (K2).
- A non-rider cable car can still wait up to ≈ 46 s at Hyde & Chestnut for the loop bus (once an hour in node): the
  W5-bus courtesy rule, harmless unless the player watches that car; the rider's car and the one fetching them never yield.

### Requests

- **K2** (the goals card, `game/**`): on the phone (390 × 844, `save=off`, a new save) the N ride from Duboce Park ended
  about 40 s in when the new-save goals card opened mid-ride (`C:/Users/willy/opus-qa/w6/b/live/phone-n-end.jpg`, log
  `phone-n.out`): please check that the card (or its pause hold) never ends or cancels a transit ride.


Part b: `W6-B5` zh names · `W6-B6` the waiver · `W6-B7` the Hyde St box · `W6-B8` this section. Checked at 03:58 on the
head rebased on the then `origin/opus-bay` (tsc 0 · eslint 0 errors, 43 old warnings · the suite **1449 / 1449**); that
push was in fact rejected (another lane had pushed a second earlier — my loop mistook the rejection line for a push), so
part b went up with part c at 04:18 (`e37b48e9` … `33d6f903`).

## Part c — played checks and wrap-up (04:00–04:45 PDT)

### What was built

- `world/flineSystem.ts`: `toHold`'s doc comment back above `toHold` (`ec4f3a10` had put `pendingHold`'s between them).
  Nothing else new: part c is evidence.

### Evidence

- **W6-B1 in the game** (desktop 1440 × 900, zh, dev 5603; `C:/Users/willy/opus-qa/w6/b/shots/b1acts.mjs`): the player sits
  in their toy car (`car-ferry-plaza`, boarded through the game's own `ride:` interaction) across the California St
  rails 75 u ahead of a cable car coming down to Drumm. The car ran, dwelt at its stops, came on at 8.5 u/s and **stopped
  2.9 u short of the toy car**, standing there 5.1 s and counting (`held`), where it used to run through. The same run
  before the player got in (the toy car empty on the rails): the cable car drove through it — see Known gaps.
- **The F-line rides after W6-B2** (the reviewer's harness, `fline` scenario: 6 rides Castro ⇄ Ferry Building, 1092 s):
  all 6 arrive, waits 1–23 s, rides 122–126 s — byte-identical to the tree before the wave (`adv/fline-{base,after}.log`;
  the base run in a temporary worktree of `294746bc`, removed junction first).
- **Phone** (390 × 844 dpr 3): the N from Duboce Park to Ocean Beach (167 s, arrived) and the zh map (part b).

### Known gaps

- **The player's toy car or bike left empty on the rails** (the player got out there): a cable car, streetcar or train
  drives through it. The transit stops only for the player (on foot or in the vehicle); an empty ride as an obstacle
  would hold a line for good once the player walks away. The fix is a tow (the parked ride moved to the kerb when a
  transit vehicle comes within a few units): the fleet is lane K1's — see Requests.
- **A non-rider loop bus waits up to 26 s at the Castro hairpin box** (`box:f-line@5476:1041`, (140, 745)) while the
  rider's streetcar turns at 17th & Castro (the rider's car never yields): the same number before this wave; the proof's
  25 s bus bound does not meet it (its rider is on the loop or the Metro, so every streetcar may yield). Harmless for the
  player (the rider is on that streetcar, the bus is only watched); left.
- The temporary worktree's admin folder `C:/Users/willy/OneDrive/Desktop/baylink-web/.git/worktrees/w6-b-base` could not
  be deleted (permission denied, like the older ones there): harmless, for the lead's `git worktree prune`.

### Requests

- **K1** (the fleet, `actors/vehicles/**`): tow the player's parked (unoccupied) toy car or bike off the rails / out of a
  transit lane when a cable car, streetcar, bus or train comes within ≈ 10 u of it (to the kerb beside it, with the
  toy-car hop the traffic uses) — today the transit drives through it.
- **K1** (BAYBAY's movement): BAYBAY on foot is not a transit `viewer`; a tram can pass through her when she stands on
  the rails and the player does not. Either she steps off the rails when a transit vehicle comes (preferred), or the
  lead widens the `viewer` contract to a list (four systems read it: `busSystem`, `flineSystem`, `lightRail`,
  `transitLine`).
- **K2**: the phone ride ended with the new-save goals card (part b's Requests).

### Checks (final)

On the pushed head `33d6f903` (parts b and c, rebased on `origin/opus-bay` at 04:16): `npx tsc -p tsconfig.app.json
--noEmit` 0 · `npx eslint .` 0 errors (the 43 old warnings) · `npx tsx --tsconfig tsconfig.app.json --test
tests/opus-bay-*.test.ts` **1464 / 1464**, fail 0. Dev server 5603 stopped; no Chrome of this lane left running; no
PERF-LOCK met; no Higgsfield credits used. District mode untouched (no district file changed; the hero regression green).
No relayed owner message arrived during the lane.

## Review (W6-B-review, adversarial, 04:30–05:40 PDT)

Reviewer's worktree `C:/Users/willy/wt/w6-b-rev` (branch `w6-b-rev`, from `origin/opus-bay` at `8ac629d3`), dev port 5623,
scratch `C:/Users/willy/opus-qa/w6/b-rev/`.

### 给主人的摘要

1. 逐行审了 B 线全部 11 个提交（W6-B1 … W6-B10），在电脑 1440×900 和手机 390×844 上实际玩了；B 线的改动基本扎实，没有会卡死或崩溃的问题，可以上线。
2. 修好一个真问题：B 线让电车、叮当车、公交、轻轨会停下来等你坐着的小车/单车——但 BAYBAY 只会提醒“走路的你”让路，所以你开车停在轨道上时，叮当车就一声不响地一直等下去。现在她会说“叮当车在等我们让路呢，把车挪到路边吧”（骑单车时是“把单车骑到路边吧”）。游戏里实测：叮当车在小车前 2.9 个单位停住，4 秒后气泡出现。
3. 顺手清掉每帧的小垃圾（每辆车每帧都新建一个对象），并把一段被挤错位置的代码注释放回原处。
4. 重新上网核对了 M 线 San Jose & Mt Vernon 站永久取消（SFMTA，2024-09-28 起），属实。叮当车中文站名在手机上显示正常（“鲍威尔-海德线叮当车 · 开往 杰克逊街 · 莱文沃斯街”一行放得下）。
5. 没有阻碍上线的问题。

### What was checked

- **Every lane commit read** (`git show`): `f836663a` W6-B1, `87f716be` W6-B2, `d67b2ca3` + `c19249f3` W6-B3, `f8c3615d`
  W6-B4, `e37b48e9` W6-B5, `2c5c0bdb` W6-B6, `5a04e280` W6-B7, `9494636c` W6-B8, `33d6f903` W6-B9, `8ac629d3` W6-B10.
- **W6-B1** (`roadViewer`): every use of `viewer` in `busSystem`, `flineSystem`, `transitLine`, `lightRail` (the
  stop-short checks and the dispatch's "near the player" checks — the vehicle's pose equals the player's there);
  `runtime.vehicle.occupied` mirrors `MoveSystem.ride` every frame (`publish()`), false while riding transit or gliding;
  a train wholly in a tunnel is `hidden` and skips the check, so the player driving along Market St above the subway
  stops no train. The stop distances measure to the vehicle's centre (bus 3 u, streetcar 2.5 u, cable car 3.2 u): a toy
  car across the track keeps ≈ 2 u of clearance, along it ≈ 1 u. **Found:** the step-aside ask (`game/lineRides.ts
  pollCity`) ran only when `move.mode === 'foot'` — the lane's Decisions said BAYBAY's line answers a long wait "as on
  foot"; it did not (fixed, R1).
- **W6-B2** (the previous reviewer's hunks): `neededByAPart`'s flag array is equivalent to the Set (same membership
  test, `j !== i` for `o !== c`, entries past `cars.length` never read); `holdBefore`'s WeakMap is keyed by the box's
  `other` record (rebuilt with the city); `measureZones`' scratch lists are cleared / copied (`Float32Array.from`);
  `flineSystem` asks `roadAhead` (only the bus interlock, `transitLayer.busAhead`) before taking a block, in the run and
  at `leave()` — a car stopped by the road short of its hold point waits there without the block; no path where it
  holds a block and waits for a bus that waits for it. No module state keeps a city object after a world switch.
- **W6-B3**: re-checked on the web (2026-09-29): https://www.sfmta.com/project-updates/stop-removal-san-jose-ave-mt-vernon-ave-starting-saturday-september-28
  ("permanent stop removal", M Ocean View, both directions; riders use San Jose & Geneva inbound, San Jose & Niagara
  outbound) and the year from https://www.sfmta.com/travel-updates/muni-service-changes-effective-saturday-september-28-2024.
  The stop is gone from both published files and their props; no other published file, voice line, tour chapter or
  goal names it (`METRO_STATIONS` is read only by the pipeline). The M's stop list keeps no parallel arrays.
- **W6-B5** zh names: all 56 cable-car stations print a Chinese name (node, `buildTransit` on the published file; none
  falls back to English); ids and English names unchanged (saves key stations by id). zh-Hant goes through the site's
  OpenCC converter. Played on the phone 390 × 844 dpr 3 (zh): a Powell–Hyde ride Powell & Sacramento → Jackson &
  Leavenworth — the banner "鲍威尔-海德线叮当车 · 开往 杰克逊街 · 莱文沃斯街" fits one line
  (`docs/opus-bay/qa/w6/B/review-phone-zh-cable-banner.jpg`).
- **W6-B6** (the `ferry:sausalito` waiver): only the sweep's target list changes; a terminal shared with a running route
  stays a target.
- **W6-B7** (the Hyde St box): the cut needs `why === 'dwell'` (never boarding / hop-off), not the rider's bus, not the
  bus fetching the rider; `riderWantsBox` only for the rider's car outside the part heading in within 70 u.
- **District mode** (`?world=district`, desktop): loads, no exception; no district file changed.
- **Per-frame allocations**: `roadViewer` made one object per call (≈ one per cable car, streetcar, bus and train per
  frame) — fixed (R2). The remaining `nextNeed(car)` records in the streetcar's run step are pre-wave, left.

### Defects found and fixed

| # | Defect | Before | After | Test |
|---|---|---|---|---|
| R1 | Since W6-B1 the transit stands short of the player sitting in their toy car / bike, but BAYBAY asked only a player **on foot** to step aside: in the car the vehicle waited in silence for good (the gripman's bell only) | node: a cable car standing short of the occupied toy car for 25 s, no bubble ("asked after -1 s") | the ask in the vehicle's words: "叮当车在等我们让路呢，把车挪到路边吧" / "…Let’s pull over to the side" (bike: "把单车骑到路边吧"). Played, desktop 1440 × 900 zh: a California St car stood 2.89 u short of the toy car, the bubble at 4.1 s held (`docs/opus-bay/qa/w6/B/review-desk-toycar-pull-over.jpg`) | `tests/opus-bay-w6-b-review.test.ts` R1, red → green |
| R2 | `roadViewer()` made a new record per call, asked by every transit vehicle every frame | a new object each call | one module record rewritten per call (the four systems read it at once, keep none) | R2, red → green |
| R3 | W6-B7 put `riderWantsBox` between `boxBlocked` and its doc comment (the same slip W6-B9 fixed for `toHold`) | `boxBlocked` undocumented | comment back above it | — (comment only) |

### Not fixed (reasons) and notes

- The parked, empty toy car / bike on the rails is still driven through; BAYBAY standing on the rails too — the lane's
  requests to K1 stand (a tow, BAYBAY stepping off). Not a go-live blocker: the player chooses to leave it there.
- zh text elsewhere still says "Powell & Market 转车台" (goals, dialogue, residents; other lanes' files) while the
  station reads "鲍威尔街 · 市场街" in zh — understandable (the turntable is a landmark name), a polish item for the
  content owner.
- The phone ride ended by the new-save goals card (lane K2's item) was not reproduced in my phone ride (save=off,
  `start=free`, the card not shown).
- The waiting shot on the phone had the camera inside a street tree at Powell & Sacramento (`phone-zh-1`,
  scratch only): the camera is lane K1's; noted, not a lane-B defect.

### Evidence

- Scratch `C:/Users/willy/opus-qa/w6/b-rev/`: `r-red.log` (R1, R2 red on the lane's head), `r-green.log`, `suite.log`,
  `tsc.log`, `eslint.log`, `shots/` (phone-zh-1…3, desk-b1-7 / -13, district), `b1acts.mjs`, `ride-acts.mjs`,
  `stations.mts` (the 56 zh names).

### Checks

On `58430559` (before the rebase): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old
warnings) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1466 / 1466**, fail 0.
On the head rebased on `origin/opus-bay` at `b3e83493` (05:05): tsc 0 · eslint 0 errors (43 old warnings) · the suite
**1469 / 1470** under load (eslint alongside) — the one failure the wall-clock `P1: the sliced jobs … 4x slower phone`
(`tests/opus-bay-audio.test.ts`), green alone 18 / 18.

### Blocking the go-live to main

Nothing from lane B.
