# Wave 7 · lane P · first-load size & loading

Worktree `C:/Users/willy/wt/w7-p` (branch `w7-p`), port 5704, scratch `C:/Users/willy/opus-qa/w7/p/`. Brief: `sf-w7-lead.md` §3
row P (GameRoot 279.19 → ≤ 265 KB gzip with `sf-w6-P.md` Requests 1, 2, 4, 5 — not 3; an import-with-retry helper for lazy
chunks; what the bigger `/planner-catalog.json` costs a phone's first load; district unchanged).

## 给主人的摘要

1. **目标达成**：游戏首屏主包（GameRoot，压缩后）从 **279.21 KB 降到 254.45 KB**（在同一棵树上量）。挪走的都是"按开始以后才用得到"或"只有城市才用得到"的东西：BAYBAY 的全部对话台词、地标卡片正文、对话泡泡排版、自动画质监测、"发现地点"、金门大桥桥面行走和城市取景。之后其他线（新特效、外墙、天空、毛毡质感）又往主包里加了约 6 KB，最新的树上是 **260.82 KB**，仍低于 265。
2. 行为不变：街区和城市（电脑 + 手机 390×844，生产构建，从标题页按"开始"进入）都实玩过：开场对话、选项、目标卡片、卡片正文都和以前一样。
3. **手机信号一抖不再"整局失效"**：以前某个按需下载的小包（骑车/开车自动导航、城市数据等）只要丢一次，Chrome 就一直记着失败、整局都用不了；现在会自动重试（1 秒、3 秒、8 秒），已在 Chrome 实测这个办法有效。
4. 新的活动目录（125 KB）以前在手机加载城市时就开始下载（首屏前 10–15 秒，占带宽并解析约 0.1 秒）；现在改成画面出来之后再下，不再和首屏抢。
5. 没做：负责人说的"街区车辆"（改变首帧，需要你决定）；"脚下辅助/拉一把"等四个模块试过又撤回（会让夜间自动检查误报），原因写在报告里。

## Measuring

`npx vite build --config vite.opus.config.ts --outDir C:/Users/willy/opus-qa/w7/p/<dir> --sourcemap` (no PERF-LOCK seen at
any build; `public/*.json` came out unchanged each time), gzip as vite reports it. Per-module parts:
`C:/Users/willy/opus-qa/w7/p/modsize.cjs` (the sourcemap walk of W6-P; "gzip of parts" sums to ≈ 1.08 × the real chunk
gzip), the static graph: `C:/Users/willy/opus-qa/w7/p/graph.cjs` (the P7 walk of `tests/opus-bay-sf-budget.test.ts`).

**Before** (`315704c1`, the wave-7 base): GameRoot **279.21 KB** gzip (734.34 KB raw). Biggest parts: `game/flow` 15.7 ·
`world/life` 13.9 · `data/script` 13.6 · `actors/moveSystem` 13.6 · `data/district` 13.1 · `data/pois` 12.1 · `actors/camera`
11.6 · `actors/system` 9.2 · … (109 sources).

## Part a · W7-P1 five moves out of GameRoot

### What was built

- **hudLayout into the play layer** (Request 4). `ui/playParts.tsx` re-exports `game/hudLayout` (`export * as hudLayout`);
  `game/hudLayoutSlot.ts` (new, main graph, ≈ 0.3 KB) has the same-named functions (`scanHudBoxes`, `placeBubble`,
  `placeWaypoint`, `hudBoxesVersion`, `releaseHudLayout`, `hudScanCount`, `hudBoxes`): each calls the real one once the
  play layer is in, and answers what an empty HUD answers before (no boxes, the anchor clamped, the waypoint shown). The
  bubble and the waypoint the ticker places are play-layer parts themselves and GameRoot holds Start until that chunk is in,
  so the fallback is never reached in play. `game/Systems.tsx`: the import line only.
- **drei's PerformanceMonitor lazy** (Request 5a). `world/perfMonitor.tsx` (new, its own 0.79 KB chunk); `world/WorldScene.tsx`
  fetches it when play begins and mounts it 9 s later (as before) in its own `Suspense`; a lost fetch resolves to "no monitor
  this visit" (the quality stays where it started), never an error in the world.
- **discovery + the place index** (Request 5b). Nothing in them runs before play in either mode (the save sampler is
  city-only, the place index loads on idle in the city), so `ui/Overlay.tsx`'s boot imports `game/discovery` lazily — in
  both modes, as before (its `initG1` also sets the boarding dialogue's 看线路图 opener and the `place:` resolver) — and
  `game/resume.ts` (the resume's quiet discovery, `?at=` place lookup) and the QA map export in `game/Systems.tsx` import
  discovery / places lazily. New chunks `discovery` 2.43 + `places` 2.88 KB.
- **The GGB deck steer and the city view field** (Request 1, the city-only half). `actors/citySlots.ts` (new, main graph):
  stand-ins for `deckSteer` (`deckAt`, `onDeck`, `heroRelaxed`, `deckDip`, `deckWish`, `deckCameraYaw`) and `viewField`
  (`heroView`, `preferredViewDir`, `preferredCameraYaw`). Until a module registers itself (one line at the end of
  `deckSteer.ts` / `viewField.ts`) they answer exactly what the module answers in district mode: no deck (only
  `actors/cityViews.ts` ever registers one, and it imports deckSteer, so deckSteer is in whenever a deck exists), and the
  hero view rule (`frameAt(stationOf(…))`: what viewField answers while `cityTerrain()` is null). The city chunk
  (`world/sf/cityMode.ts`) imports viewField, so it registers before the city terrain exists. Import lines only in
  `actors/camera.ts`, `CameraRig.tsx`, `controller.ts`, `feet.ts`. District mode never fetches either module.
- **The district POI cards' texts** (Request 2). `data/poiTexts.ts` (new chunk, 7.29 KB): summary / hours / cost / tips of
  the 15 district cards keyed by POI id (the three F-line stops share one text). `data/pois.ts` keeps each card's source,
  date, spot and photo; its `realInfo` starts with empty texts, and `fillPoiTexts()` fills them in place — the district
  POIs as written, their city copies (`CITY_DISTRICT_POIS`) in the city's words (the same `cityDistrictZh` rule
  `cityDistrictPoi` applies). `ui/PoiCardBody.tsx` (the card body, already a lazy chunk) calls it when its module loads, so
  the texts are in before any card body renders; node (tests, scripts: no `import.meta.env`) fills them when
  `data/pois.ts` loads. The only readers of those texts are the card body and tests (grep over `src/opus-bay`: `realInfo`
  elsewhere reads `lat` / `lng` / presence only; the city card refresh touches `sf:` cards only).

### Evidence

| chunk (gzip, as vite reports) | before `315704c1` | after W7-P1 |
|---|---|---|
| **GameRoot** | **279.21 KB** | **267.14 KB** (−12.07) |
| playParts (+ hudLayout) | 15.42 | 16.99 |
| poiTexts (new, with the card body) | — | 7.29 |
| PoiCardBody | 3.33 | 3.38 |
| discovery (new) · places (new) | — | 2.43 · 2.88 |
| deckSteer (new, with cityViews) | — | 1.16 |
| perfMonitor (new, when play begins) | — | 0.79 |
| cityMode (+ viewField) | 55.54 | 56.36 |

- The one-off equality check (scratch `cmp-pois.test.ts`: the pre-move `data/pois.ts` copied beside the new one): the
  district POIs, their city copies and `POIS` **deep-equal** the originals (16 POIs, 43 tips).
- Played on the dev server (5704): district desktop `?world=district&start=local` → the Coit Tower card: summary, hours,
  cost, 3 tips (`docs/opus-bay/qa/w7/P/p1-district-card-texts-desktop.jpg`); city phone 390 × 844 dpr 3
  `?world=city&start=local`: BAYBAY's bubble placed above the coach mark (the HUD scanned 4 times, 6 boxes, through the
  play layer's hudLayout: `docs/opus-bay/qa/w7/P/p1-city-phone-bubble-placed.jpg`), the Coit Tower card with its texts. No
  console error (the old THREE.Clock deprecation warning only).
- Tests: `tests/opus-bay-sf-budget.test.ts` "W7-P1 / P2" (the P7 walk: the eight modules out of GameRoot's graph, no static
  drei import in it, the registrations, the card body's fill, the Overlay's lazy discovery); `tests/opus-bay-w7-p.test.ts`
  (the stand-ins answer the district values before the modules load and delegate after; the texts: one per card, filled
  once, the city copies in the city's words, `Coit Tower` never in the city's zh).
- Checks: on the lane tree `e7c072f8` suite **1493 / 1493**; rebased on origin (`4fdca8a1`, lane Q's part a) as `3f7e0a9d`:
  `tsc` 0 · `eslint .` 0 errors (43 old warnings; the new `export *` in playParts carries a disable line for
  react-refresh) · suite **1510 / 1510**. Pushed as **`404a7752`** after three more rebases that brought only other
  lanes' disjoint commits (W2 Alcatraz, R scorecard, S venues, H Halloween world): `tsc` 0 and the budget / w7-p /
  hero-regression / contracts files 55 / 55 before the push.

### Decisions

1. **A stand-in, not a rewrite, in other lanes' files.** Lane K edits behaviour in `actors/` this wave: the call sites keep
   their names and only their import line changes; each moved module registers itself with one line at its end.
2. **Request 1 is only half city-only.** `feet.corridorAt` (the corridor slide), `stuckHelper` (BAYBAY's pull), `faceOpen`
   (the open-ground turn) and the glide's hero towers (`glideTall.heroTall`) run in district mode too since wave 5, so they
   cannot sit behind the city chunk with a "district value": they are part b (a play-time chunk under the Start gate).
   Only `deckSteer` and `viewField` are truly city-only (the district answers are constants / the hero rule).
3. **The card texts fill in place** (not a new field or type): `core/types.ts` is frozen, and every reader keeps reading
   `poi.realInfo` exactly as before.
4. **Discovery is still fetched in the district** (at the Overlay's boot): its `initG1` sets two hooks the district uses
   (看线路图's opener, the `place:` resolver); the bytes are off GameRoot and in long before Start.

### Known gaps

- A `?start=` / `?solo=` deep link (QA only) that skips the title can reach play before the play layer: the bubble /
  waypoint appear once it lands (as the HUD already did since W6-P1).
- The perf monitor now starts 9 s into play only if its 0.79 KB chunk arrived by then (a phone on a very slow network
  starts it later; offline: never).

## Part b · W7-P3 import-with-retry, the dialogue script with the play layer

Started 21:55 PDT, on origin `d64dc400` (part a pushed). GameRoot **267.14 → 254.45 KB** gzip.

### What was built

- **`game/importRetry.ts`** (new, dependency-free, 0.5 KB). `importRetry(() => import('./x'))`: on a *loading* failure
  (the Chrome / Firefox / Safari / Vite-preload messages; an error the module's own code throws is never retried) it
  waits 1 s, 3 s, 8 s and asks again — the URL the browser names in its message with `?retry=n` (a new module-map
  entry: Chrome keeps the old one failed for the page's life), or, with no URL in the message (Safari), the same import.
  Then the caller's own fallback applies, as before. Applied (import sites only) to: **tap-to-drive**
  (`actors/moveSystem.ts` `loadDrive`: driveRoute + autopilot, W6-P-review's finding), the city camera data
  (`actors/camera.ts`), **the city chunk** (`world/cityLoader.ts`), **the city data chunk** (`data/sf/cityData.ts`'s
  top-level await), the post pass and the perf monitor (`world/WorldScene.tsx`), discovery / places (`ui/Overlay.tsx`,
  `game/resume.ts`), the HUD's own chunks (`ui/lazyParts.ts`: ride banner, move chip, guide layer) and **the play layer**
  (`ui/playLayer.tsx`: two quick retries, 0.5 s and 2 s, then, as before, one reload at the title).
- **The dialogue script with the play layer.** `data/script.ts` (every dialogue node, the goals' texts, the barks and
  hooks: 13.6 KB gzip) is read only once play has begun, so it comes with the play layer's chunk (`ui/playParts.tsx` →
  `data/scriptLoad.ts` → `registerScript`), and GameRoot already holds Start until that chunk is in (W6-P1's gate): the
  first line of play has every node exactly as before. `data/scriptSlot.ts` (new, main graph) exports the same names as
  live `let` bindings (`NODES`, `START_NODE`, `FREE_GOALS`, `STOP_PROMPTS`, `SCRIPT_HOOKS`, `GUIDE_BARKS`, `NPC_LINES`
  and the `DISTRICT_*` / `CITY_*` tables); `game/flow.ts`, `brain.ts`, `content.ts` (its namespace import) and
  `cityContent.ts` import them instead — import lines only; every read is inside a function that runs after Start
  (checked: no module-scope use; before the chunk a lookup finds no node / hook / bark, and every caller already has
  its fallback). Node (tests, scripts) loads the script at the slot's top level: the script's own graph (9 modules)
  never reaches the slot, so the wait cannot come back to itself. The lazy UI (Dialogue, Moments, Hud, the week panel,
  voice) keeps importing `data/script.ts`: the same module instance.
- **A `?start=` deep link** (QA) now begins once the play layer is in (`ui/Overlay.tsx`), as the title's Start does —
  this also closes W6-P1's known gap (the HUD a moment late on deep links).
- `game/GameRoot.tsx`: `performance.mark('opus-bay:first-frame')` at the world's first frame (part c's measurements).

### Evidence

| chunk (gzip, as vite reports) | before `315704c1` | part a | **part b** |
|---|---|---|---|
| **GameRoot** | **279.21 KB** | 267.14 | **254.45** (−24.76) |
| playParts (+ hudLayout) | 15.42 | 16.99 | 17.11 |
| script (new: the dialogue, with the play layer) | — | — | 13.64 |
| poiTexts · PoiCardBody | — · 3.33 | 7.29 · 3.38 | 7.29 · 3.37 |
| discovery · places | — | 2.43 · 2.88 | 2.49 · 2.96 |
| deckSteer · perfMonitor | — | 1.16 · 0.79 | 1.16 · 0.79 |
| cityMode (+ viewField) | 55.54 | 56.36 | 56.52 |

- What a phone downloads before it can press Start is the same set of bytes as before plus the stand-ins (≈ 1.2 KB):
  they left GameRoot (the one chunk on the path to the first frame) for chunks fetched in parallel with it.
- **Production build played from the title** (vite preview on 5704, the Start button pressed — not a deep link):
  district desktop — BAYBAY's welcome with its four choices
  (`docs/opus-bay/qa/w7/P/p3-district-prod-title-start-welcome.jpg`); chunks before Start: GameRoot, playParts, script,
  discovery, places, post, photo … and **no** cityMode, cityDataChunk, cityViews or deckSteer. City phone 390 × 844
  dpr 3 — the city welcome (5 chapters), 我自己逛逛 → the goals step with the pelican goal and the ten goals
  (`docs/opus-bay/qa/w7/P/p3-city-phone-prod-title-start-goals.jpg`). No console error (the old THREE.Clock warning).
  (The district run was on the tree that still had the dropped actor move, Decision 3; the city run was repeated on
  the final build — first frame at 8.5 s on this loaded machine, the same welcome and goals step.)
- **The retry's premise, in Chrome on the production build** (the perfMonitor chunk moved away, then back):
  1. `import(chunk)` → "Failed to fetch dynamically imported module: http://localhost:5704/assets/perfMonitor-B8Lc0Fao.js";
  2. file back, `fetch` → 200 text/javascript; 3. the same `import` again → **still failed**; 4. `import(chunk +
  '?retry=1')` → loaded (`PerformanceMonitor`) — the URL importRetry reads from that message and asks for.
- Tests: `tests/opus-bay-sf-budget.test.ts` "W7-P3" ×2 (every retried import site; the helper imports nothing; the
  script out of GameRoot's graph, its graph never reaching the slot, the four importers on the slot, the deep-link
  wait) and the W6-P2 walk updated for `loadDrive`; `tests/opus-bay-w7-p-retry.test.ts` (Chrome / Firefox / Safari
  messages; a lost chunk fetched again as `?retry=1` after 1 s; lost for good → the last error after 1 + 3 + 8 s;
  Safari: the same import again; an error the module threw: never retried, evaluated once; the play layer's quick
  retries); `tests/opus-bay-w7-p.test.ts` (the slot's bindings are the script's own tables; a rebinding is seen at
  once by flow's `nodeById` and content's `hook`).
- Checks on the lane tree (origin `d64dc400` + part b): `tsc` 0 · `eslint .` 0 errors (43 old warnings) · suite
  **1530 / 1530**.

### Decisions

1. **Retry, not reload, in play.** A reload loses the player's state, so in play a lost chunk is asked for again under
   a new URL, three times over 12 s; at the title the play layer keeps its one reload after two quick retries.
2. **Retried sites** are those whose failure used to stick for the page's life and where a second load is harmless (the
   module never ran). The ≈ 170 other `import()` sites (feature chunks, panels, city sub-chunks) keep their own error
   paths; `importRetry` is there for their owners.
3. **Request 1's second half (the forgiving feet, BAYBAY's pull, the open-ground turn, the glide's tall structures) is
   not moved.** Built and measured (−2 KB; GameRoot 265.14 at that point), then reverted: those four run in both world
   modes, and node harnesses drive the real controller without the play layer — `scripts/opus-sf/qa/sweep-static.mts`
   (W7-Z's static sweep), `coins-place.mts`, `economy-run.mts`, `transit-sidecar.ts` — and two suite tests (W5-E2 coin
   spots, W5-T poles) silently lost the corridor slide and reported snags / boxed spots. A node-side eager load would
   deadlock (stuckHelper imports the controller that would await it). The dialogue script gives six times the bytes
   with none of that.
4. **The script moved although 265 was in reach without it**: at ≈ 265 the next push of any lane would have put
   GameRoot over the target again; the dialogue is the largest block read only after Start.

### Known gaps

- A retried chunk whose *shared dependency* chunk was the one lost still fails (the dependency's URL stays failed in
  the module map): the caller's fallback applies, as before.
- Firefox / Safari were not run (no such browsers on this machine); their messages are unit-tested from their formats.
- A `?start=` deep link on a very slow network now waits for the play layer (≈ 30 KB) before play begins (QA only).
- Checks when pushed: the rebase brought 13 other-lane commits (tsc 0 and my six test files 75 / 75 on the pushed head
  `0f03c125`); the full suite before that, on origin `90dc7798` + part b: 1583 / 1584 — the one failure
  is `W5-bus 20+ simulated minutes` ("bus at an interlock stood 29.2 s (box:f-line@5661:750)"): **red on origin itself**
  (checked in a clean worktree of origin `4bc614be` without my commits: the same 29.2 s; lane H reported it too). Not
  lane P's.

## Part c · W7-P5 the planner catalog off the phone's first-frame path

Started ≈ 23:20 PDT (measured while the suite ran: numbers are indicative, the machine was loaded by 13 lanes).

### What was measured

`C:/Users/willy/opus-qa/w7/p/loadperf.mjs`: one headless Chrome (CDP), 390 × 844 dpr 3 touch, **slow 4G** (Lighthouse's
mobile profile: 150 ms RTT, 1.6 Mbps down, 750 kbps up), **CPU 4×**, cache off; city mode from the title (no Start);
the world's first frame read from GameRoot's new `performance.mark('opus-bay:first-frame')`; the catalog request from
resource timing / CDP; long tasks from a PerformanceObserver. Production build, vite preview on 5704.

| run | first frame | `/planner-catalog.json` (126.5 KB on the wire) | long task right after it |
|---|---|---|---|
| before, A1 | 39.2 s | 24.9 → 26.4 s (**before** the first frame) | — |
| before, A2 | 34.2 s | 23.1 → 24.1 s (**before** the first frame) | 128 ms at 24.08 s (the parse + sanitize) |
| before, catalog blocked, B1 | 40.7 s | blocked | (the world's own 1.8 s / 9.8 s tasks come here in every run) |
| **after W7-P5**, C3 | 34.0 s | starts at **52.6 s** (after the first frame) | — |

So on a phone the old 1.5 s timer from the Overlay's boot put the whole catalog download (≈ 0.65 s of a slow-4G link)
and its ≈ 0.13 s parse (4× CPU) into the window where the city chunk, the data chunk and the first city cells stream —
10–15 s before the first frame. The first-frame times themselves are within this loaded machine's noise (A 34–39 s, B
41 s): no first-frame gain is claimed; the change removes the contention by construction.

### What was built

- `game/firstFrame.ts` (new, main graph, 0.2 KB): `markFirstFrame()` (GameRoot's `FirstFrame` calls it on the world's
  first frame; it also sets the performance mark) and `afterFirstFrame(fn)` (at once once drawn; returns an unsubscribe).
- `ui/Overlay.tsx` (Q's file; the boot's one call site): the catalog prefetch starts 1.5 s **after the world's first
  frame** instead of 1.5 s after the Overlay mounted. Start (`beginPlaying`) and every panel that needs it still call
  `loadCatalog()` themselves, as before, so nothing waits longer for it once play begins.
- Tests: `tests/opus-bay-w7-p.test.ts` (afterFirstFrame: nothing before, once, can be called off, at once after);
  `tests/opus-bay-sf-budget.test.ts` "W7-P5" (the Overlay waits for the first frame, no blind timer — red on the old
  boot; GameRoot marks it).

### Evidence

- Chunks on the latest tree (origin `89940c6d` + part c, built 00:00 PDT): **GameRoot 260.82 KB** gzip — the other
  lanes' pushes since part b's build added ≈ 6 KB to GameRoot's own modules (gzip of parts: `world/fx.ts` +1.98,
  `world/materials.ts` +1.43, `world/environment.ts` +0.96, `actors/models.ts` +0.84, `actors/cameraModes.ts` +0.39,
  `world/life.ts` +0.30), part c +0.2.
- Checks on the lane tree: `tsc` 0 · `eslint .` 0 errors (43 old warnings) · suite **1605 / 1606** (the one failure:
  `W5-bus 20+ simulated minutes`, red on origin itself, above).

### Decisions

1. The catalog stays a prefetch (the week board, event and POI cards read it); only its start moves. No change to the
   catalog file (the site's, GPT's) or to `loadCatalog`.

## Not done

- **Request 3** (the district vehicles on first need): the owner's call (`sf-w7-lead.md` §6).
- **Request 1's second half** (the forgiving feet, BAYBAY's pull, the open-ground turn, the glide's tall structures): built
  and reverted (part b, Decision 3).
- `importRetry` is not applied to the ≈ 170 other lazy `import()` sites (feature chunks, panels, city sub-chunks).
- No real-phone measurement (CDP emulation only); no Firefox / Safari run.

## Requests

1. **Lead / W7-Z**: read the chunk table on the final tree (`GameRoot`, `playParts`, `script`, `poiTexts`); play the
   district's first minute once from the title (Start, the welcome, a tour stop's card) and a city phone start. GameRoot
   was 260.82 KB at 00:00 PDT with ≈ 4 KB left under 265.
2. **Lanes V / X (or the lead)**: GameRoot grew ≈ 6 KB tonight in `world/fx.ts`, `world/materials.ts`,
   `world/environment.ts`, `actors/models.ts`. City-only parts of those (the city day sky, the façade window styles,
   the painted-particle presets only the city fires) can sit behind the city chunk (`world/cityLoader.ts` /
   `world/sf/cityMode.ts`) or a registration like `actors/citySlots.ts`; the P7 walk (`tests/opus-bay-sf-budget.test.ts`)
   shows the static graph.
3. **Lane B / the lead**: `W5-bus 20+ simulated minutes` is red on origin (a bus 29.2 s at `box:f-line@5661:750`, the
   Castro hairpin); lane B's hardening landed before it went red.
4. **Lane R (or whoever edits the district cards' facts)**: the summary / hours / cost / tips of the 15 district POI cards
   now live in `data/poiTexts.ts` (keyed by POI id); sources and dates stay in `data/pois.ts`.
5. **Lead (housekeeping)**: `.git/worktrees/w7-p-chk` (a check worktree I removed) could not be deleted (the OneDrive
   lock, as in wave 6); remove it with OneDrive paused, then `git worktree prune`. Its `node_modules` junction was
   removed first (`rmdir`), the main checkout's `node_modules` is intact.

## Final checks

On the pushed head `90929b94` (00:27 PDT, rebased over 32 other-lane commits): `tsc` 0 · `eslint .` 0 errors (43 old
warnings) · suite **1630 / 1631** — the one failure is `W5-bus 20+ simulated minutes`, red on origin itself (part b).
Dev / preview server on 5704 stopped at the end; one headless Chrome at a time; no
PERF-LOCK seen at any build or Chrome run; no Higgsfield spend.

