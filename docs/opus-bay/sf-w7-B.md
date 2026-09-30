# Wave 7 · lane B — transit

Lane B of wave 7 (`docs/opus-bay/sf-w7-lead.md` §3): worktree `C:/Users/willy/wt/w7-b` (branch `w7-b`), dev port 5703,
scratch `C:/Users/willy/opus-qa/w7/b/`. Owns `world/busSystem.ts`, `world/flineSystem.ts`, `world/lightRail.ts`,
`world/transitLine.ts`, `world/sf/{lineInterlocks,traffic,tourBus,lineFleet,stations}.ts`, `data/transit.ts`,
`data/fline.ts`, `data/ferry.ts`, `tests/opus-bay-w5-deadlock.test.ts`, the zh wording fixes in `data/sf/*.ts`.

## 给主人的摘要

1. 那个时好时坏的"车辆卡死"测试（每条线每次推送前都要跑）找到了真正原因：不是机器忙，而是前一个测试把玩家的朝向留了下来，镜头朝向一变，小汽车刷出来的位置就全变了（整个文件跑是 29 次，单独跑是 31 次，门槛 30）。现在每次测试前都把状态复位，结果在任何顺序下都完全一样；同时让测试多制造"拦路车"（31 → 47 次），门槛没降，反而更严。
2. 坐 Muni 地铁在地下时打开设置（暂停），列车以前会继续开到地面才停；现在会在隧道里立刻停住，关掉设置再继续开。电脑上实测：列车停在鲍威尔站和市政中心站之间整整 20 秒，关掉后照常开到 Carl & Cole。
3. 顺手修了一个真问题：在地下时按 Esc 打开的设置面板以前被隧道画面盖住、根本看不见；现在显示在隧道画面上面。

## Part a — the flaky deadlock proof, the Metro pause (20:25–21:50 PDT)

### What was built

- **W7-B1** `tests/opus-bay-w5-deadlock.test.ts` (the proof "W5-bus 20+ simulated minutes"):
  - **Why the count varied**: not load and not the wall clock — order. The proof places its camera 12 u behind
    `runtime.player.heading`; the tap-to-drive test before it (same file) leaves the player on a Union Square street
    heading (plus a height and a claimed bike). The camera decides where the toy traffic spawns (`CityLife` →
    `traffic.update(dt, cam)`) and which transit vehicles count as seen (`transitLayer.visibleFromCamera`), so the whole
    20 minutes ran differently: **29** forced blockers with the whole file (every full-suite run: day 0, GPT's release
    doc), **31** with the proof alone. Bisected by running the proof after each earlier test on its own: only the
    tap-to-drive one changes it; resetting the heading alone made both orders byte-identical (a per-400-frame trace of
    the rider's vehicle and the traffic stats, diffed).
  - **Load**: checked separately — an instrumented copy with a 30 ms real delay injected into every streaming await,
    run beside a second copy: the trace is identical. The proof reads no clock (`portalReady`'s `performance.now` needs a
    streamer, none in node; `setWalkGraph(null)`, so no time-sliced A*; the traffic RNG is seeded mulberry32).
  - **Fix**: `RUNTIME0` (a structured clone of the runtime's records before any test) and `freshRuntime()`: the proof
    starts from it and the drive test restores it when it ends.
  - **Hardened, bar not lowered**: a 22 s blocker slot whose own kind cannot be placed there (a train has no stop zone,
    a bus near its stop no room for one) now falls back to the next kind that fits instead of passing unforced: **47**
    forced blockers (lane 15, zone 10, crossing 22) where there were 31 (lane 11, zone 7, crossing 13). The bar stays
    `forced >= 30`, and every kind must now be forced **≥ 5** times (it was ≥ 1). All other asserts unchanged and green
    (the longest stand of a bus on the road 2.1 s, trains 0.2 s, a bus at an interlock 7.0 s, `gaveHeld` 12,
    `gaveOncoming` 65).
- **W7-B2** the Settings pause underground (`world/lightRail.ts`, `world/sf/lineFleet.ts`):
  - `RailOptions.paused?: () => boolean`; `LineFleet` wires it to `game.get().paused` (only `flow.openPanel('settings')`
    sets it). While paused, the rider's train honours the stop request (K2's `holdRideForPause` asks it with
    `PAUSE_BRAKE_S`; K's API unchanged) in a tunnel or under a hood too: it brakes to a stand in the subway (hidden), and a
    train dwelling at an underground station keeps dwelling (`leave()`), until the brake is released. Unpaused, a stop
    request under ground is still ignored (the hop-off rule: the rider cannot start one there, `moveSystem` checks
    `canHopOff` first).
  - `ui/transit-ui.css` (lane Q's css, **surgical, one rule**): `.ob-overlay:has(.ob-subway.is-on) .ob-sheet { z-index: 41 }`
    — the subway overlay (z 40) covered every sheet (z 20): Esc on an underground ride opened Settings unseen (and now
    that would have stood the train with nothing on screen).
  - Tests `tests/opus-bay-w7-b.test.ts` (5): the train stands in the subway within `PAUSE_BRAKE_S` and holds a minute,
    then arrives at Van Ness; it keeps dwelling at Montgomery while paused, and unpaused a request under ground is still
    ignored; paused under the Duboce hood inside the single-track stretch it stands there and the opposite train never
    enters the stretch (no violation), both go on after; the fleet wiring; the sheet over the subway overlay.

### Evidence

- B1 red → green: the whole file before the fix: `forced blockers 29` → ✖ `forced blockers of every kind (29)` (and the
  day-0 suite log `C:/Users/willy/opus-qa/w7/day0/suite.txt`); after: the whole file 9 / 9 and the proof alone 1 / 1, both
  `forced blockers 47: lane 15 …; zone 10 …; crossing 22 …` with identical longest stands (logs
  `C:/Users/willy/opus-qa/w7/b/fix2-{file,alone}.log`; the bisect, trace and probe in the same folder).
- B2 red → green: with the old `lightRail.ts` / `lineFleet.ts` 4 of the 4 behaviour tests fail ("within the pause brake
  (5.2 s)" — it ran on to Montgomery; "still at Montgomery after 20 s"; "stood in the stretch"; the fleet wiring), green
  after (`C:/Users/willy/opus-qa/w7/b/b2-red.log`).
- **Played** (dev 5703, zh, `?world=city&start=free&save=off`, harness `C:/Users/willy/opus-qa/w7/b/pause.mjs`: board the N
  at Powell by the game's own `rideLine`, Esc when the train runs in the Market St subway, sample every 0.5 s):
  - desktop 1440 × 900: the train braked from 8.6 u/s and stood at s 204.36 (`hold`, hidden, the HUD `braking`) for all
    40 samples (20 s) with Settings open; Esc again: 17.6 → 25 u/s at once, on to Carl & Cole (ride over 103 s). The
    Settings sheet shows over the tunnel with 已暂停, the strip dot between 鲍威尔站 and 市政中心站
    (`docs/opus-bay/qa/w7/B/desk-metro-paused-in-subway.jpg`). The first run, before the css rule: the train stood the
    same way but the sheet was invisible under the overlay.
  - phone 390 × 844 dpr 3: the underground ride as before (78 s, arrived); the overlay covers the HUD there, so a phone
    player cannot open Settings under ground at all (see Known gaps).
- Checks on the rebased head (`origin/opus-bay` 4fdca8a1 + B1 + B2): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx
  eslint .` 0 errors (43 old warnings) · the suite **1510 / 1510**; then the css rule and its test: w7-b 5 / 5 (push line
  below).

### Decisions

- The paused train stands **where it is** under ground (as every city line does on the surface), not at the next
  underground station: the next station can be far (the Sunset Tunnel has none inside; Castro → Forest Hill is 380 u), and a
  pause that keeps the ride moving is what was reported. It may stand inside a single-track stretch round a mouth; the
  opposite train then waits at its edge for the pause (as it does for a dwell at West Portal, Duboce & Church or
  Carl & Cole, which lie in those stretches) — tested: never two opposite trains in a stretch.
- The pause is read from `game.paused` in `LineFleet` (core/store is already in the main chunk; `lineFleet` is a city
  module) rather than importing `game/transit.ts` into the pure rail system.
- B1: the proof's blocker cadence and every bound kept; only the lost slots are filled. The drive test's cleanup now
  restores the whole runtime, not three fields.

### Known gaps

- Phone: the subway overlay (z 40) covers the HUD, so on an underground Metro ride a phone player has no Settings, map or
  journal button until the train surfaces (desktop has Esc / the keys). A Request to Q below.
- `game/transit.ts` (K's) still says in `holdRideForPause`'s comment "Known limit: a Metro train under ground ignores a
  brake" — stale now; K's file, not touched (Request).
- zh: the ride card says "N 线 · 开往 Carl & Cole" and the strip "Van Ness 站" — the Metro stations' zh names are English
  for some stops (part b looks at them with the turntables).

### Requests

- **Q** (`ui/**`): on the phone, underground, show the HUD's gear (or the More button) above the subway overlay (z > 40),
  or put a small 设置 button on the overlay's ride card; the css rule above only lifts sheets once they are open.
- **K** (`game/transit.ts`): drop the "Known limit: a Metro train under ground ignores a brake" sentence from
  `holdRideForPause`'s comment (W7-B2 honours the pause brake under ground).

Part a pushed 22:30 PDT: `8f485b12` W7-B1 · `798eeb4f` W7-B2 · `5db1ea1c` W7-B3 (+ report). Checks on the rebased head:
`npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings) · the suite **1527 / 1528** under load
— the one failure the wall-clock `W5-D-review the paid memo … 2000 counts in 357.4 ms` (`opus-bay-w5-eggs-review`), green
alone (149.9 ms); after the last rebases (W7-W11's seam fill, W7-R2, W7-G2) tsc 0 and the touched files' tests 48 / 48 and
24 / 24. **Note:** the seam fill (W7-W11) changed the published world, and the proof's count moved 47 → **46** with it
(lane 13, zone 11, crossing 22) — exactly why the margin over 30 matters: the count follows the world, never the clock.

## Part b — per-frame garbage, the courtesy waits, zh wording (22:30–00:05 PDT)

### What was built

- **W7-B4** `world/flineSystem.ts`: the streetcars' run step asks `nextNeed(car, NEED_S)` / `nextNeed(car, NEED_S2)` (two
  new module scratch records; the step's own, apart from `pendingHold`'s / `firstInLine`'s): it made two new `Need`
  objects per car per frame (`:573` / `:588`, pre-wave). Test W7-B4 spies on `nextNeed`: red on the old code ("16181 of
  16181 asks made a new Need"), green after; the deadlock file's numbers are byte-identical before / after (interlocks
  2 × 1 h: bus box waits longest 6.9 s, cable car 48.1 / 42.4 s, streetcar 31.2 / 32.1 s; the proof 46 forced blockers,
  the same longest stands).
- **W7-B5** the long courtesy waits, **bounded by tests where they stand** (no behaviour change pushed):
  - `tests/opus-bay-w5-deadlock.test.ts` interlocks: a cable car's longest stand ≤ **50 s** (was ≤ 60). Where the long
    ones are (a probe of the same 2 × 1 h run, `C:/Users/willy/opus-qa/w7/b/hyde/interlock.mts`): **48.1 s** Powell–Hyde at
    Hyde & Chestnut (its 4 s stop, ≈ 24 s leaving the Hyde St box to the loop bus 21 s away, then the bus inside the box
    ≈ 14 s — it dwells 8 s at its Wharf & Hyde stop there) and **43.3 s** California at s 101 near Drumm (the bus due 27 s
    away, then ≈ 10 s driving the 70 u of shared California St).
  - `tests/opus-bay-w7-b.test.ts` W7-B5: the rider rides the F-line Ferry Building ⇄ 17th & Castro for 20 simulated
    minutes (9 rides; their streetcar never yields): no loop bus waits at a shared box > **35 s**; measured **28.6 s** at
    `f-line@5661:750` (149, 601) — Market St's single-track stem, two streetcars through it in a row (the second one needed
    by the first: it may not leave the part to the bus, the W5-bus deadlock rule), not the Castro hairpin (10.5 s here).
- **W7-B6** zh wording (text only, ids and English unchanged): `data/transit.ts` `TURNTABLE_NAMES` zh →
  **鲍威尔街 · 市场街转车台**, **海德街 · 海滩街转车台**, **泰勒街 · 湾街转车台**, and `turntableZh()` for any other
  turntable (the W6-B5 street names; a station without them keeps "X & Y 转车台"); every zh text the scout listed that
  named the Powell & Market turntable: `data/sf/attractions.ts:200`, `extraPlaces.ts:180`, `landmarks.ts:621`
  (鲍威尔街 · 市场街叮当车转车台), `dialogue.ts:85 / :89`, `goals.ts:56`, `residents.ts:71 (comment) / 107 / 113 / 114 /
  121 / 133`, `game/cityGoals.ts:43`, and `tests/opus-bay-sf-verify-c.test.ts`'s hint. Test W7-B6 (the three names, the
  fallback, a scan of the zh side of those files) red on the old `data/transit.ts`, green after.

### Evidence

- Live, phone 390 × 844 dpr 3, zh (dev 5703): `__opusBay.transit.data().turntables` →
  `["鲍威尔街 · 市场街转车台","海德街 · 海滩街转车台","泰勒街 · 湾街转车台"]`; a Powell–Hyde ride from Hyde & Beach:
  the banner "鲍威尔-海德线叮当车 · 开往 鲍威尔街 · 市场街" (the station, W6-B5), no Latin in the banner.
- Tests: w7-b 7 / 7 (B2 ×4, B2 css, B4, B5, B6 — 9 with the css and bound tests), the deadlock file 9 / 9, and the 11
  test files that name these texts (landmark context, places, transit review / verify, verify-c, corners, w5 transit,
  w6-b, w6-b-review) 122 / 122.
- The dropped attempt (see Decisions): `C:/Users/willy/opus-qa/w7/b/b5-attempt/` (the diff and the files), logs
  `hyde/cap-*.log`, `hyde/cap45-*.log`, `b5.log` (the proof failing with it: "bus at an interlock stood 29.2 s
  (box:f-line@5661:750)").

### Decisions

- **The shorter courtesy was built, measured and not pushed.** `CableSystem.yieldingTo` + `lineInterlocks.boxWantedByCable`
  (the bus cuts its stop inside a box a cable car stands for, as W6-B7 does for the rider's car) took Hyde & Chestnut
  48.1 → 41.5 s with no bus cost; a courtesy cap (`BusSystem.boxClearIn`, `COURTESY_MAX`) at 40 s moved the wait onto the
  buses (12–15 s at Drumm: a car's trip down and back takes ≈ 40 s, not the 25 s `partClearSeconds` reckons), at 45 s it
  changed nothing. But the stop cut shifts the loop's timing, and in the 20-minute proof the **rider's bus** then met
  the Market St convoy above: 29.2 s at `f-line@5661:750` against the proof's 25 s bound (7.0 s before, by timing). A
  change that makes the proof red is not pushed, and the bound is not lowered; the convoy is the real problem (Known gaps).
- The Muni Metro's station names keep the wave-4 glossary rule (`src/opus-bay/data/VOICE.md`: "English stays primary on
  the real signs … Van Ness stays 'Van Ness 站'", plan R11): "Van Ness 站" and "N 线 · 开往 Carl & Cole" stay. I had changed
  them (范尼斯站, 科尔谷) and reverted before committing.
- Turntables read "鲍威尔街 · 市场街转车台" (no space before 转车台 after a Chinese name; the W6-B5 " · " between streets).

### Known gaps

- **Market St's single-track stem can hold a loop bus ~29 s** when two streetcars run through it in a row (the second
  one is "needed" by the first, so it may not leave the part to the bus — the W5-bus deadlock rule): measured 28.6 s for a
  non-rider bus (W7-B5 bounds it at 35 s), and 29.2 s for the **rider's** bus in the proof once the loop's timing shifts.
  The proof passes today by timing (7.0 s). A fix belongs in `world/sf/lineInterlocks.ts busAheadOfFCar` /
  `flineSystem` (e.g. reserve the stem earlier for the rider's bus, so the second car never takes a block into it).
- The Hyde & Chestnut courtesy wait stays ≤ 48 s (non-rider cars only; the rider's car and the one fetching the rider
  never yield).

### Not done

- Part c — the toy Alcatraz ferry Pier 33 ⇄ the island dock: no time left before the 00:30 stop (W2's Alcatraz with its
  dock and ferry float landed on origin tonight, `3727a49c`, so the next wave can board it).

### Requests

- **Next wave / the reviewer** (transit): the Market St convoy (Known gaps) — with it fixed, W7-B5's attempt
  (`C:/Users/willy/opus-qa/w7/b/b5-attempt/b5.diff`) can go in: Hyde & Chestnut 48 → 41.5 s.
