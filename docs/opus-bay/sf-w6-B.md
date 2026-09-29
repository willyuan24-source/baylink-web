# Wave 6 · lane B — the skipped W5-bus review, and transit

Lane B of wave 6 (`docs/opus-bay/sf-w6-lead.md` §3): worktree `C:/Users/willy/wt/w6-b` (branch `w6-b`), dev port 5603,
scratch `C:/Users/willy/opus-qa/w6/b/`. Owns `world/busSystem.ts`, `world/flineSystem.ts`,
`world/sf/{lineInterlocks,traffic,tourBus,lineFleet,stations}.ts`, `data/transit.ts`, `data/fline.ts`, `data/ferry.ts`,
`tests/opus-bay-w5-deadlock.test.ts`.

## 给主人的摘要

1. 补做了 W5 "车辆卡死修复" 那 5 个没审查就上线的提交的对抗审查：逐行读完、在桌面和手机 390×844 实际坐车跑了一遍。
2. 找到并修好一个真问题：公交、电车、叮当车、轻轨只会给**走路的**你让路——你骑单车或开小车停在它们路上时，它们会直接穿过你的车。现在都会停下来等。
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

