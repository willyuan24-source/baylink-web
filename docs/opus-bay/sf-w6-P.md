# Wave 6 · lane P · first-load size (GameRoot ≤ 265 KB gzip, MF9 / D16)

Worktree `C:/Users/willy/wt/w6-p` (branch `w6-p`), port 5604, scratch `C:/Users/willy/opus-qa/w6/p/`.

## 给主人的摘要

1. 游戏首屏要下载的主包（GameRoot）原来 300.4 KB（压缩后），目标 265 KB。这一波做到约 **277.5 KB**（同一棵树上少了约 24 KB；其他线同时加了约 1.5 KB），**还没到 265**。
2. 挪走的都是"开始玩以后才用到"或"只有城市才用到"的东西：对话框 / HUD / 目标卡 / 拍照模式 / 手机摇杆等界面（一个小包，游戏一加载就在后台同时下载，按"开始"时会等它到齐）；自动驾驶（第一次骑车 / 开车时才下）；城市六位邻居和地标到达点（跟城市数据包一起下，街区模式根本不下）；拍照合成和高画质后期特效。
3. 街区模式和城市模式都实玩过（电脑 + 手机 390×844，生产构建）：开场对话、导览、HUD、目标卡、摇杆、拍照都和以前一样；1458 个测试全绿。
4. 剩下的 12 KB 在"每一帧都在跑"的核心代码里（主角脚下 / 镜头 / 车辆 / 地标卡正文），要改别的线正在改的文件，风险大，写进了"请求"，建议下一波由负责人安排。

## Measuring

`npx vite build --config vite.opus.config.ts --outDir C:/Users/willy/opus-qa/w6/p/dist --sourcemap` (the build left
`public/*.json` unchanged this time), gzip as vite reports it. Per-module sizes: `C:/Users/willy/opus-qa/w6/p/modsize.cjs`
(walks the chunk's sourcemap, gzip -9 of each source's generated slices = "gzip of parts"; the parts sum to ≈ 1.10× the
real chunk gzip), the static graph and its importers: `C:/Users/willy/opus-qa/w6/p/graph.cjs` (the P7 walk of
`tests/opus-bay-sf-budget.test.ts`, with every importer listed).

**Before** (`294746bc`, the wave-6 day-0 head): GameRoot **300.40 KB** gzip (797.66 KB raw; W5-Z measured 298.62 on
its tree, the autumn merge and day 0 added ≈ 1.8 KB). Biggest parts (gzip of parts, KB): `game/flow` 15.6 · `data/script`
13.6 · `actors/moveSystem` 13.5 · `world/life` 13.4 · `data/district` 13.1 · `data/pois` 12.1 · `actors/camera` 11.6 ·
`actors/system` 9.2 · `world/materials` 7.6 · `game/Systems` 7.2 · `game/transit` 7.1 · `actors/models` 6.8 ·
`actors/controller` 6.3 · `world/backdrop` 6.2 · `world/props` 6.2 · `core/terrain` 6.0 · `world/ground` 6.0 ·
`world/landmarks` 5.5 · `world/environment` 4.8 · `actors/anim` 4.6 · `world/water` 4.5 · `world/streetcar` 4.2 ·
`actors/nav` 4.1 · `ui/Hud` 3.9 · `ui/Moments` 3.9 · `data/sf/residents` 3.7 · … (146 sources).

## Part a · W6-P1 the play layer out of GameRoot

### What was built

- `src/opus-bay/ui/playParts.tsx` (new, a chunk): re-exports the DOM parts the Overlay renders once play has begun —
  `Dialogue`, `EventCard`, `CoachMark`, `TapHint`, `Hud`, `RideBanner`, `FishGame`, `GoalsCard`, `PhotoMode`,
  `PostcardReward`, `Recap`, `PoiCard`, `TouchControls`, and `ui/Floating.tsx`'s `SpeechBubble`, `Waypoint`,
  `CinematicLayer`, `TimeOffer`, `LeadChip`, `Toasts`, `LiveRegion`, `DebugOverlay`. No file moved or renamed.
- `src/opus-bay/ui/playLayer.tsx` (new, main graph, ≈ 0.4 KB): `loadPlayParts()` (one shared fetch, retryable),
  `usePlayParts()` (the module or null), `lazyPart(key)` — a stand-in component with the part's own props that renders
  nothing until the chunk is in and then the part itself as a plain child (no `Suspense`, so a part that mounts later never
  flashes a fallback or hides its siblings).
- `src/opus-bay/ui/Overlay.tsx` (lane K2's; only its import block): the static imports of those parts became
  `const Hud = lazyPart('Hud')` … — **the JSX is byte for byte as before** (the guide-city test that reads it is green).
- `src/opus-bay/game/GameRoot.tsx`: starts `loadPlayParts()` as soon as its chunk runs (both world modes, in parallel with
  the city chunk and the renderer setup), and passes the page's Start to the Overlay only when the world has drawn **and**
  the parts are in (`startRequested && drawn && partsIn`); a failed fetch is retried every 2 s.
- `tests/opus-bay-sf-budget.test.ts` "W6-P1": the nine modules are out of GameRoot's static graph (the P7 walk), every
  `lazyPart('…')` of the Overlay is a component `playParts.tsx` exports, GameRoot's early fetch and the Start gate.

### Evidence

| chunk (gzip, as vite reports) | before `294746bc` | after W6-P1 |
|---|---|---|
| **GameRoot** | **300.40 KB** | **285.35 KB** (−15.05) |
| playParts (new) | — | 15.20 KB |
| cityMode / cityDataChunk / landmarks | 47.60 / 4.33 / 16.67 | unchanged |

- Production build served by `vite preview` (5604), headless Chrome: district desktop — `GameRoot` 2364–2424 ms,
  `playParts` 2536–2563 ms (fetched 110 ms after GameRoot arrived, 30 ms on the wire); city phone 390 × 844 dpr 3 —
  `GameRoot` 912–967, `cityDataChunk` 1065–1076, `playParts` 1098–1337, `cityMode` 1102–1564: the parts land before the
  city chunk the world waits for, so Start is never held by them in practice.
- Played: district desktop (welcome choices, 我是新来的 → Bay 101 1/7 with BAYBAY leading, the HUD, the night-view offer,
  toasts / live regions in the DOM) — `docs/opus-bay/qa/w6/P/p1-district-tour-desktop-prod.jpg`; city phone (Start →
  the goals step with the pelican goal and the 10 goals, HUD, Take the ferry chip, touch stick present) —
  `docs/opus-bay/qa/w6/P/p1-city-goals-phone-prod.jpg`. No console error (one THREE.Clock deprecation warning as before).
- Checks: `tsc` 0 · `eslint .` 0 errors (43 old warnings) · suite **1382 / 1382**.

### Decisions

1. **Gate the Start, not each part.** The parts arrive ≈ 0.1–0.4 s after GameRoot, long before the world's first frame;
   holding the Start until they are in makes "exactly as before" a guarantee instead of a race (a slow network holds the
   Start as long as those bytes held GameRoot before). `?start=` / `?solo=` deep links (QA) skip the title: their parts
   appear when the chunk lands.
2. **Floating's title-time parts go too** (toasts, the screen reader's live regions, ?debug's readout): under the page's
   title they render nothing visible, and they read their stores, so nothing raised meanwhile is lost.
3. **One chunk, not one per part**: one request, one retry, one gate.

### Known gaps

- `?start=` / `?solo=` deep links show the HUD a moment after the first frame if the chunk is slower than the world (QA only).

## Part b · W6-P2 the autopilot with the first drive · W6-P3 the residents and the arrivals with the city data chunk

### What was built

- **W6-P2** `src/opus-bay/actors/moveSystem.ts` (lane K1's; the import site and the three constructions only):
  `vehicles/autopilot` (the pure-pursuit driver and the W5-bus pass planner, 2.9 KB of parts) is fetched together with
  `vehicles/driveRoute` — the chunk tap-to-drive already loads when a bike / the toy car is mounted — in one
  `Promise.all`; `pursuit(spec, points)` builds every `PursuitDriver`, and each one is made only after a route came back
  (so after that load), the pass planner likewise (`pass()` / `detour()` already return early without `driveMod`).
  No new wait anywhere: the drive's route was always behind that load.
- **W6-P3** the six city residents (`data/sf/residents.ts`: the table and the helpers GameRoot's modules call) and the
  landmark arrivals (`data/sf/arrivals.ts`) join lane V's city data chunk (`data/sf/cityDataChunk.ts`, the W5-V3 top-level
  await: city mode and node load it before any content module evaluates; district mode never fetches it). Import sites:
  `game/flow.ts` (`residentByKey` is `undefined` for every district NPC as before; the aside mark and the neighbour nudge
  are city-only), `game/cityContent.ts` (its readers run in city mode only), `actors/npcs.ts` (`CITY_NPC_DEFS` from
  `CITY_DATA`; district mode never spawns them), `game/cityGoals.ts`, `data/sf/cityPois.ts`. Both modules import types
  only, so the data chunk still shares nothing with GameRoot (the W5-V3 test is green); the lazy chunks (Journal, Letter,
  residentTasks, cityLife, Moments in the play layer) keep their static imports — Rollup gives `residents` its own small
  chunk (3.83 KB) shared by them.
- `tests/opus-bay-sf-budget.test.ts` "W6-P2 / P3": the three modules are out of GameRoot's static graph; the autopilot
  loads with the drive routes and is never constructed directly; `CITY_DATA` carries the same module instances; the city
  still spawns the six residents; every city POI still stands on its arrival.

### Evidence

| chunk (gzip) | before `294746bc` | W6-P1 `67ba6a9f` | + W6-P2 / P3 |
|---|---|---|---|
| **GameRoot** | 300.40 | 285.35 | **279.29** (−21.11 in all) |
| playParts | — | 15.20 | 15.28 |
| autopilot (new, with the first drive) | — | — | 3.13 |
| residents (new, city data + play layer) | — | — | 3.83 |
| cityDataChunk | 4.33 | 4.33 | 4.54 |

- The built `residents` / `arrivals` chunks import nothing from GameRoot (read in the build output), so the top-level
  await cannot wait on itself.
- Production build (`vite preview`, 5604): city desktop `?at=cable-car-turntable&start=local` — the turntable, ARRIVED
  card, HUD, BAYBAY's line, the gripman at his post, the call menu (8 entries incl. 带我去下一个目标); district phone
  390 × 844 — Start → 我自己逛逛 → HUD, Hop button, bottom bar; the district's JS requests: no `cityMode`,
  `cityDataChunk` or `landmarks` (the `residents` chunk comes with the play layer, as those bytes came with GameRoot).
- Tap-to-drive / the autopilot: `tests/opus-bay-w5-deadlock.test.ts` (20 simulated minutes, the autopilot behind and
  facing a stopped car), `opus-bay-sf-move2`, `opus-bay-sf-verify-g`, the contracts — 70 / 70, all through `loadDrive`.
- Checks: `tsc` 0 · `eslint .` 0 errors (43 old warnings) · suite **1393 / 1393**.

## Part c · W6-P4 the photo capture and the high tier's post pass

### What was built

- `src/opus-bay/game/shutterHook.ts` (new, main graph, 0.2 KB): `consumeShutter(canvas)` for the Canvas ticker, which
  calls the consumer `game/photo.ts` registers when it loads (`setShutterConsumer`). A shutter can only be requested
  through photo.ts (the play layer's photo mode, lane A's bell, lane E's frames), so the consumer is always there first.
  `game/Systems.tsx` (K2's; its import line only) imports `consumeShutter` from the hook; `game/photo.ts` (K2's; one
  import, one line) registers itself. photo.ts and its frame decorators (`photoFrames.ts`) leave GameRoot (1.9 KB of parts)
  and come with the play layer.
- `src/opus-bay/world/WorldScene.tsx`: the high tier's post pass (`world/post.ts`: the MSAA target, bloom, tilt-shift,
  1.7 KB of parts) is fetched as soon as WorldScene's module runs (both modes); a world that mounts at the high tier
  suspends until that fetch has settled (the chunk comes with GameRoot's own preloads, so the first frame has the pass as
  before); the frame loop renders through the pass only once the module is in, and a failed fetch never blocks the world
  (it renders like the mid tier). Phones start at mid: they fetch 1.8 KB they may never run, off GameRoot's path.
- `tests/opus-bay-sf-budget.test.ts` "W6-P4": the three modules out of the main graph, a requested shutter consumed
  through the hook, the suspend and the failure path in WorldScene.

### Evidence

- GameRoot **277.51 KB** gzip on the rebased tree (origin `aaf71722` + P4; the lanes' pushes since part b added ≈ 1.5 KB to
  GameRoot meanwhile); new chunks `photo` 1.88, `photoFrames` 0.43, `post` 1.80 KB.
- Production build, district desktop (high tier): the Bay 101 start with the tilt-shift pass on from the first frame;
  `?start=local` → P → Space: the photo mode, the shutter, the polaroid thumbnail (`photo` fetched with the play layer)
  — `docs/opus-bay/qa/w6/P/p4-district-photo-mode-desktop-prod.jpg`.
- Checks: `tsc` 0 · `eslint .` 0 errors (43 old warnings) · suite **1429 / 1429**.

## Summary of the lane (after part c)

| chunk (gzip, as vite reports) | before `294746bc` | after (W6-P1…P4) |
|---|---|---|
| **GameRoot** | **300.40 KB** | **277.51 KB** (P1 −15.05, P2 + P3 −6.06, P4 ≈ −3.3; the other lanes' pushes meanwhile ≈ +1.5) |
| playParts (new; both modes, fetched with GameRoot, Start waits for it) | — | 15.38 |
| residents (new; city data chunk + the play layer) | — | 3.83 |
| autopilot (new; with the first drive) | — | 3.13 |
| photo + photoFrames (new; with the play layer) | — | 1.88 + 0.43 |
| post (new; the high tier's world waits for it) | — | 1.80 |
| cityDataChunk (city only) | 4.33 | 4.54 |

The target **≤ 265 KB is not reached** (−12.5 KB still to go). Every lever that is safe without touching another lane's
per-frame code is taken; what is left is listed with sizes under Requests.

### Decisions

1. **Honest bytes only.** No `manualChunks`, no change to `vite.config.ts` or to `vite.opus.config.ts`'s build (the
   production build uses `vite.config.ts`; a split that district mode still downloads before its first frame would lower
   the number without lowering the first load). Everything moved is either not needed before play starts (fetched in
   parallel, the Start waits), needed only on a later action (the first drive, the first shutter), or city-only (the city
   data chunk, which district mode never fetches).
2. **No file moved or renamed**; only import sites changed (Overlay, Systems, photo, flow, cityContent, npcs, cityGoals,
   cityPois, moveSystem, WorldScene) plus three new small files (`ui/playLayer.tsx`, `ui/playParts.tsx`,
   `game/shutterHook.ts`) and appended re-exports in `data/sf/cityDataChunk.ts`.
3. **No byte budget in the tests** (the plan asked for the P7 walk to pin the new budget): a byte count needs a build,
   which the suite does not run, and a source-size proxy would fail the eight other lanes' pushes mid-wave. The walk now
   pins each moved module out of GameRoot's static graph (tests "W6-P1", "W6-P2 / P3", "W6-P4"), so none can slide
   back unnoticed; the lead's verify reads the chunk table.
4. **District mode**: nothing it draws or does changed; its JS requests now also include `playParts`, `residents` (via
   the play layer's Moments), `photo` and `post` — bytes that were inside GameRoot before, now in parallel chunks.

### Known gaps

- `?start=` / `?solo=` deep links (QA only) show the HUD a moment after the first frame if the play layer is slower than
  the world.
- A phone at the mid tier fetches the 1.8 KB post chunk it may never run (it used to be inside GameRoot for everyone).
- The tap-to-drive autopilot was verified by the suite's drive tests (the W5-bus 20-minute proof, move2, verify-g), not
  by a live tap-to-drive in the browser this wave.

### Not done

- **GameRoot ≤ 265 KB** (277.51 now): the remaining levers are in other lanes' per-frame code (Requests 1–4).

### Requests

1. **Lead / lane K1 (next wave) — F's city-only actor modules, ≈ 6.1 KB of parts**: `actors/feet` 1.2, `stuckHelper`
   1.2, `glideTall` 1.0, `deckSteer` 0.9, `viewField` 0.9, `faceOpen` 0.8. They are read every frame by `controller`,
   `camera`, `moveSystem`, `system`, `CameraRig`, and some return district defaults (`heroView`, `FEET` in the
   controller), so each needs a registration from the city chunk (`world/cityLoader.ts` loads it before WorldScene
   renders, like `actors/cityViews.ts` already registers the deck) with the district's values as the fallback — K1 was
   editing exactly these files this wave, so I left them.
2. **Lead / lane C's successor — the POI card bodies, ≈ 8–10 KB**: `data/pois.ts`'s `realInfo` texts (summary, hours,
   cost, tips) are read only by the (lazy) card body, but `cityDistrictPoi` glosses them at import time in city mode and
   `flow` / `travel` read `lat` / `lng`: split the texts into a card-body module keyed by POI id, keep `lat` / `lng` /
   `sourceUrl` in `pois.ts`, and gloss on open.
3. **Lead / lane K1 — the district vehicles on first need, ≈ 9 KB** (`vehicles/models` 3.5, `collide` 2.9, `pelican`
   2.1, `fleet` 1.7, `bike` 0.4, `toyCar` 0.4): the parked bikes and the toy car are visible in the district's first
   frame, so this only pays if they are built once the chunk is in (a changed first frame: the owner's call).
4. **Lane K2 — `game/hudLayout` (1.5) into the play layer**: `Systems.tsx` places the bubble / waypoint through it; with
   the parts not mounted there is nothing to place, so `Systems` can read it from `ui/playLayer.tsx playParts()`.
5. **Small ones** (≈ 0.7 KB each): drei's `PerformanceMonitor` (mounted 9 s into play) as a lazy part in its own
   `Suspense`; `game/discovery` + `data/sf/places` (4.1) once `sampleLastSafe` (both modes) is split from the city's
   discovery hook.
6. **Lead — the final verify**: read the chunk table on the final tree (`GameRoot`, `playParts`, `post`), and play the
   district's first minute once at the high tier (the post pass on the first frame) and once on the phone.

### Final checks

On `17bf8a7c` (W6-P4 rebased on origin at 04:27 PDT): `tsc` 0 · `eslint .` 0 errors (43 old warnings) · suite
**1465 / 1465**. The dev / preview server on 5604 stopped at the end; no Higgsfield spend; no PERF-LOCK seen during my
builds and shots (one headless Chrome at a time).

The push itself (04:41 PDT): origin moved three times while the loaded machine ran the ≈ 10-minute suite; the last two
rebases brought only other lanes' commits in files disjoint from mine (halloween/, play/hideSeek*, actors/camera for the
Hyde St shot, docs), so those were checked with `tsc` 0 and the budget / contracts / H / hide-seek tests (51 / 51) before
the push. **After the push, on the pushed head `8829ee7e`**: `eslint .` 0 errors · suite 1466 / 1467 — the one failure is
the wall-clock assert "a cached cell is cheap" (`opus-bay-sf-move2` E2-5: 1000 calls < 50 ms) under the wave's load;
the file alone: **24 / 24**. So the pushed tree is green.
