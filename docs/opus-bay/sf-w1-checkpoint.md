# sf-w1 checkpoint: wave 1 of whole San Francisco (non-GPU parts)

Cloud session, 2026-09-26 (PDT), branch `opus-bay` at `db1d4de`. This is the checkpoint that was cut off twice on the owner's machine (RESUME.md "PAUSED 2026-09-26 ~09:55"). The cloud container has no GPU: WebGL runs in SwiftShader at about 3 fps, so **every fps number is left for the owner's machine**. `renderer.info` draw calls, triangles and programs are valid and are reported. Five parallel checks and seven wave-2 scoping readers fed this report. Their scratch output (logs, about 150 shots) is in `/tmp/claude-0/opus-w1/{health,district,city,scope-C2}/`, outside git. The 10 key shots are copied to [`qa/w1/`](qa/w1/).

## 给主人的摘要

- **通过：** tsc 0 错误，eslint 0 警告，测试 200/200。有一个 A* 分片计时测试会偶发失败，已修好（`db1d4de`），之后连跑 4 轮全过。构建成功。SF 数据 194 个区块的大小、哈希和内容全部与 manifest 一致。
- **旧区（district）没有退化：** 英雄回归测试 11/11 通过，标题、开场、对话、自由逛、地图、Coit、夜景、叮当车、手机竖屏截图都正常，0 报错。
- **整城（city）能跑：** 整座旧金山都能流式加载，走路、自行车、小车、鹈鹕滑翔都能用，新旧区接缝没有洞。
- **你看到的 4 个观感问题全部确认，原因都找到了：** 满城橙色坡屋顶、雾太重、双峰发棕、高处视角超预算（三角面最高 557k，预算是 400k；draw call 已降到 144，低于 150）。
- **新发现的真 bug：** 流式焦点离开玩家超过约 1 秒，玩家会被弹回渡轮大厦。另外包体超预算：GameRoot 293 KB gzip，预算 250 KB。
- **等本地 GPU 跑：** 6 个点位 ×（1×、4× 降速）×（桌面、390×844）的帧率表。本文留好了空表和完整步骤，另外还要在 iPhone 上检查 `WEBGL_multi_draw`。
- **Wave 2：** 7 条线的任务、依赖和需要先定的事都在最后一节。Higgsfield 下载通道现在能用。519 积分预计用 105–215（地图重绘、语音、壁画、8 个地标模型清理、鹈鹕备选），剩下的留给重做，质量优先。

---

## 1. Health

| check | result |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | **pass**, 0 errors (31 s). This covers `src/` only: `tsconfig.app.json` includes `["src"]`, so tests are never type-checked (defect HC-6). |
| `npx eslint src/opus-bay tests/opus-bay-*` | **pass**: 171 files, 0 errors, 0 warnings (20.7 s). |
| tests, first full run | **fail**: 199/200 (19.0 s). The failure was *"A\* is time-sliced"* in `tests/opus-bay-sf-nav.test.ts`, with a longest slice of 20.03 ms at a 0.25 ms budget (limit 3.25 ms). |
| tests after the fix | **pass**: 200/200 on 4 full runs (12.1 s, 11.9 s, 14.9 s with a vite build running alongside, 27.4 s at load average 5.4). The nav file alone passed 7/7 three times. |
| `npx vite build --config vite.opus.config.ts` | **pass**: 34.7 s, exit 0, with only the usual warning about chunks over 500 kB. |
| bundle budgets | **3 misses**: page JS, GameRoot split and the lazy city chunk. The worker is within budget. See 1.2. |
| first load ≤ 3 MB | **pass, with a caveat**: 2.18 MB at the title screen. Free roam is 3.50 MB if GLBs are counted; DESIGN §9 excludes them. |
| `public/opus-bay/sf/v1` integrity | **pass**, 0 problems. See 1.4. |
| console | 0 errors and 0 exceptions in every page load of the three smoke runs (14 district loads, 9 city runs). The only warnings are `THREE.Clock` deprecated (known) and `KHR_parallel_shader_compile not supported` (SwiftShader only). |

### 1.1 The flaky timing test and what was done

- **Symptom:** The full suite failed with a longest slice of 20.03 ms. The nav file alone failed 3 out of 3 times (4.45, 4.37 and 4.24 ms) while another lane's SwiftShader Chrome was using about 2.3 CPUs. Three solo runs a minute later passed.
- **Root cause, part 1:** the test asserted a wall-clock maximum over about 30 slices, so any OS pause of the test process showed up as a "long slice".
- **Root cause, part 2:** the slicer in `core/walkGraph.ts` read the clock only every 64 expansions. On the first search from the hero area, the per-node costs are computed on first use and take 12–20 µs per expansion. Cold slices measured 0.74–1.25 ms at a 0.25 ms budget.
- **Fix in `walkGraph.ts`:**
  - `SLICE_CHECK = 16`, down from 64.
  - An optional injectable `now` clock on `RouteSearchOptions` (default `performance.now`).
  - Result: the cold longest slice is 2.32 ms at the default 2 ms budget. Warm 0.25 ms slices have a median of 0.255 ms and a max of 0.27 ms.
- **Fix in `tests/opus-bay-sf-nav.test.ts`:**
  - (1) On a *work clock* (1 µs per relaxed edge), every full slice is at least its budget and at most budget + 16 × 8 µs, at 0.25 ms and at 2 ms, with the same path as the one-shot search.
  - (2) On a *read-count clock*, every full slice expands exactly 64 nodes.
  - (3) Robust real-clock statistics over 3 runs: at 0.25 ms, median < 0.75 ms and best-of-3 longest < 3.25 ms; at 2 ms, < 30 frames and best-of-3 longest < 5 ms.
  - (4) The async and abort checks are unchanged.
  - Deliberately broken slicers all fail: every-64 reports "256 256 …", `>` instead of `>=` reports "80 …", and a slicer that never breaks fails on the work clock.
- **Commit:** the lead committed both files as `db1d4de`. They are listed in this checkpoint's commit brief but have no further diff.

### 1.2 Bundle sizes vs budgets

Sizes are `gzip -c | wc -c` on the production build.

| chunk | gzip | min | budget | status |
|---|---|---|---|---|
| `GameRoot` | 293,086 | 789,018 | page JS ≤ 250 KB (plan §5.10, DESIGN §9) | **miss** (v1 was 198.6 KB; +94.5 KB) |
| city code (`world/sf/**` + `data/sf/landmarks.ts` + `core/sfTerrain.ts`) | 65.6 KB gzipped on its own; 75.2 KB with `actors/vehicles` and glide | 155,468 | lazy chunk ≤ 40 KB | **miss**: no separate chunk exists, so it sits inside GameRoot and district mode downloads it too |
| worker | 56,950 | 173,188 | ≤ 70 KB | pass (`three.core.js` is 105.6 KB of the minified worker) |
| `OpusBayPage` js / css | 16,250 / 16,168 | 39,998 / 79,007 | — | the title moved here in M0 |
| audio | 20,482 | 61,718 | — | lazy |
| MapPanel / Journal / WeekPanel / Settings / SoloView | 5,464 / 3,735 / 3,399 / 3,255 / 4,560 | — | — | lazy |
| shared `react-three-fiber` / site `index` / `react-vendor` | 232,462 / 330,127 / 61,292 | — | — | not Opus Bay's own |

The largest GameRoot contributors, from a sourcemap build (minified bytes):

| area | size | largest files |
|---|---|---|
| world | 181.6 KB | life.ts 28.4, materials 16.4, props 15.2, ground 14.1, backdrop 13.9, landmarks 13.4 |
| actors | 160.8 KB | camera 24.5, moveSystem 21.3, system 18.6, models 15.7 |
| data | 112 KB | district 32.3, sf/landmarks 31.0, pois 23.2, script 20.6 |
| world/sf | 99.1 KB | |
| game | 65.4 KB | |
| ui | 49.4 KB | |
| core | 44.7 KB | |
| three GLTFLoader | 43.9 KB | |

### 1.3 Assets and first load

- **`public/opus-bay`:** 9,968,025 B in 338 files. Other folders: postcards 1.97 MB, art 277 KB, badges 225 KB, portraits 178 KB, voice 150 KB.
- **`sf/v1`:** 4,301,204 B in 201 files.
  - Chunks: 194 files (the plan estimated about 230), 3,337,463 B. Min 165, median 20,933, mean 17,203, max 35,229; all ≤ 40 KB.
  - Within the plan: `far.obc` 202,356 (≤ 400 KB), `graph.obc` 339,864 (≤ 800 KB), `transit.json` 34,592 (about 40 KB).
  - Over the plan: `manifest.json` is 46,574 raw / 14,036 gzip (plan about 30 KB). `places.json` is 323,440 raw / 54,666 gzip (plan about 60 KB; the raw size is 5.4× that).
- **Models:** 2,860,012 B in 37 files. `models/sf` is 1.50 MB in 32 files; the kit is 715 KB in 22 files.
- **First load, measured on the built site** with a logging static server that gzips text, as a CDN would:
  - Title screen, `?world=city` without Start, 40 s: **2,182,862 B in 72 requests**.
    - JS is 1.56 MB: the site shell and locale chunks 882 KB, Opus Bay 448 KB, react-three-fiber 234 KB.
    - CSS 104 KB, key art 108 KB.
    - The city is already loading behind the title: manifest 13.5 KB, `far.obc` 202 KB and 14 chunks (120 KB). The plan puts the manifest after the title and `far.obc` during the arrival cinematic.
  - Free roam in city mode at the Ferry, about 20 s after load: **3,504,548 B in 87 requests**. Of that, 1,361,088 B is the five uncompressed hero GLBs: baybay 599 KB, pelican 223 KB, sea-lion-bark 185 KB, sailboat 178 KB, sea-lion 176 KB. None use Draco or WebP. The design doc's first-load definition excludes GLBs.

### 1.4 Data integrity (`public/opus-bay/sf/v1`)

- The manifest has 194 chunk entries for 194 `.obc` files: 0 orphans, 0 duplicate keys, and every key matches its `cx_cz`.
- For all 196 hashed files (194 chunks plus far and graph), byte size, sha256 and unzipped size match: 0 problems.
- All 194 chunks decode with `decodeChunkFile`. Header cx/cz, the land/shore/water/hero flags and the building counts match the manifest.
- `graph.obc` decodes to 32,569 nodes and 86,248 edges, matching the manifest.
- `transit.json` and `places.json` are listed by file name only, with no size or hash (defect HC-5).

### 1.5 Health defects

| id | severity | defect | route |
|---|---|---|---|
| HC-1 | major | GameRoot is not split: 293.1 KB gzip against the 250 KB page budget. The plan says to split first. | lead; every lane keeps city-only code lazy (F14, C2) |
| HC-2 | major | The city code is not a lazy chunk (65.6 KB gzip against ≤ 40 KB), so district mode pays for it. Suggestion: dynamic-import the streamer and landmarks only when `worldMode === 'city'`, and move the `SF_LANDMARK_INFO` text to JSON or a lazy chunk. | C2 + lead |
| HC-3 | major | About 1.56 MB of gzipped JS on `/opus-bay`, 882 KB of it from the site shell and locale chunks. Fixing it means files outside Opus Bay (a lighter shell or route-level locale split). | lead, **needs owner approval** |
| HC-4 | minor | The 5 hero GLBs are uncompressed (1.36 MB). Re-encode them with Draco + WebP like the kit (42–69 KB each), or preload them during the arrival cinematic. | H2b (the pelican may be replaced by E2-8) |
| HC-5 | minor | `places.json` and `manifest.json` are bigger than the plan §5.2 estimates, and transit/places have no size or hash in the manifest. | G1 (loads places on idle) + lead (format; lane A has no wave-2 lane) |
| HC-6 | minor | Tests are not type-checked. With the same settings, 8 TS errors show up in 2 files: `sf-modes.test.ts:86,120` (TS2367) and `sf-terrain.test.ts:397 ×4, 422–423` (`b.poly` possibly undefined). Add a tests tsconfig to the health commands. | lead |
| HC-7 | minor | **[fixed]** The flaky A* slice test (1.1). | done in `db1d4de` |
| HC-8 | minor | STATUS.md is stale: it still says 81 tests, GameRoot 198.6 KB and `public/opus-bay` 2.1 MB. The plan's budgets cite it. Update it after the perf run. | lead |

---

## 2. District regression

**Result: no district breakage found.**

- `tests/opus-bay-hero-regression.test.ts` passes 11/11. It ran at `8e7efd1` and again at `db1d4de`; the two lead commits in between touch no district code.
- It pins 375,899 vertices, 232,511 triangles and 62 chunks, the terrain grid bytes and the per-mesh hashes. It also checks determinism and `TypedBatch == Batch`.

| flow (STATUS.md "What works") | result |
|---|---|
| title screen | pass: key art, title, Start, sound toggle, "Skip the game" |
| Start, then the arrival cinematic | pass: letterboxed ferry approach, captions "Ferry Building terminal" and "clock tower · since 1898", Skip chip |
| intro dialogue | pass: BAYBAY portrait, "Hi! Welcome to the Bay", 4 choices with hotkeys 1–4 |
| free-roam spawn `?start=free` | pass: HUD, WASD hint, "Talk to BAYBAY", postcard clue. Lane E's parked bike is new and expected ([shot](qa/w1/district-ferry-gate-golden.jpg)). |
| walking (W) | pass: the player walks onto the gangway and BAYBAY follows with a bubble |
| map (M) | pass: numbered POIs, legend, All/Nearby, Coit lock note, walk times |
| Coit viewpoint, sweep, "Map unlocked" | pass: the sweep shots play, then the BAYBAY two-shot; Goals 1/5, `viewpointUnlocked` true |
| Pier 39 sea lions | pass |
| night `?time=night` (ferry clock) | pass: readable blue hour, lit arches, string lights |
| streetcar Green St → Ferry Building | pass with minor issues (DR-1, DR-5): waiting, then the car arrives, then riding by the open window with BAYBAY |
| mobile 390×844, Pier 39, day | pass: portrait layout, touch hint, bottom dock readable |
| console, 14 page loads | 0 errors, 0 exceptions |

**Numbers vs the STATUS.md table.** All rows are at quality high locked with `?quality=high`, 960×600 (the same 1.6 aspect as STATUS's 1440×900).

| spot | calls | triangles | programs | STATUS (2026-09-25) | with lane E's vehicle groups hidden |
|---|---|---|---|---|---|
| Ferry gate, golden | 76 | 228,982 | 44 | 55–56 / 144k | 72 / 222,426 |
| Coit viewpoint, golden | 89 | 314,129 | 44 | 61 / 190–191k | ≈ 85 / 307.6k |
| Ferry clock, night | 81 | 245,651 | 45 | 63–64 / 220–223k | 76 / 237,591 |
| Sea-lion viewpoint, golden | 62 | 234,638 | 45 | 53–57 / 179–186k | 62 (none in view) |
| Pier 39 entrance, 390×844, day | 57 | 289,990 | 43 | 52–54 / 157k | 56 / 288,492 |
| intro two-shot at the ferry gate | 111 | 374,328 | 57 (auto quality) | — | the peak: 93 % of the 400k triangle budget |
| arrival cinematic | 103 | 364,152 | 33 | — | wide establishing shots |
| streetcar wait and ride | 53–55 | 235–257k | 45 | — | |

The numbers are well above STATUS, but wave 1 is only a small share:

- STATUS was measured before polish round 1 (lower camera so the skyline shows, rigged BAYBAY GLB), and the polish-1 perf table never ran.
- The static world is byte-identical (hero test).
- The only wave-1 geometry in view is lane E's vehicle group: 0–5 calls and 0–8k triangles.
- The rest, from a per-object tally, is:
  - skyline city chunks now in view (11–27k tris each);
  - the BAYBAY GLB (16.7–20.8k incl. shadow);
  - the player (17.6k);
  - sea lions (46.5k);
  - pedestrians (16.5k).
- Everything is inside 150 calls / 400k tris.
- Programs are 43–45 at quality high, matching M0's 44.

| id | severity | defect | route |
|---|---|---|---|
| DR-1 | minor, **new in wave 1** | The streetcar chip reads "On board · Sit down · Walk the aisle · Hop off" while you are still waiting at the stop ([shot](qa/w1/district-streetcar-onboard-chip-while-waiting.jpg)). Cause: `rideTo()` (`game/flow.ts` ≈1185) sets `riding:'streetcar'` at the start of the wait. `syncMovePatch` (`core/store.ts:138`) mirrors that to `move.mode 'transit'`, and `MoveChip` (`ui/Hud.tsx:98-104`) never checks `flow.ride.stage`. | E2 (MoveChip, after G1-0) + F (the ride section moves to `game/transit.ts`) |
| DR-2 | minor | The STATUS perf table is stale (see above). | lead: re-measure in §4 |
| DR-3 | minor | HUD crowding at 960×600. The prompt bar and the transit chip run under Ask/Map, and the waypoint chip hides behind the bottom-right dock at Pier 39. | G1 (+ E2 for the chip) |
| DR-4 | minor | The free-roam goals card stays over the Coit sweep cinematic. | G1 |
| DR-5 | minor | Mid-ride, the car body hides the rider (STATUS known issue 3, still present with lane E's RideCamera). | E2 (transit rig, E2-6) + F (car body) |

---

## 3. City smoke (`?world=city&start=free`)

Coverage: 9 runs, 93 JPEG shots at 960×600, all looked at. That is 27 spots by day, plus night, morning, seam/edge, pop-in and walk/vehicle runs. All numbers are at `?quality=high`, day.

**Streaming health:**
- `whenReady` resolved at every spot (0–24 s in SwiftShader).
- Queued and in-flight jobs reached 0 within about 20 s.
- 0 stream errors, 0 console errors, no WebGL context loss.
- L0 + L1 + L2 always add up to 776 cells.

| spot | calls | triangles | programs | L0 / L1 / L2 | what the image shows |
|---|---|---|---|---|---|
| Ferry gate | 75 | 217,427 | 46 | 3 / 16 / 757 | the zone view faces the bay |
| Chinatown Dragon Gate | 114 | 384,927 | 46 | 9 / 37 / 730 | the gate at the end of a narrow street; the HUD reads "Financial District/South Beach" |
| Chinatown seam (Grant & Washington) | 105 | 311,826 | 46 | 9 / 35 / 732 | the hero/city seam at walking height, no gaps |
| Coit viewpoint | 87 | 302,587 | 46 | 6 / 25 / 745 | |
| Alamo Square (hero far) | 116 | 398,214 | 46 | 14 / 42 / 720 | orange gable roofs |
| Painted Ladies row | **124** | **442,157** | 46 | 15 / 62 / 699 | the procedural row reads well; an orange carpet of gables behind it ([shot](qa/w1/city-painted-ladies-orange-gables.jpg)). Later runs: 80–87 / 316–345k. |
| Mission Dolores | 105 | **408,538** | 46 | 13 / 67 / 696 | 106 / 414k 3 s after arrival |
| Dolores Park | 110 | **435,989** | 46 | 15 / 64 / 697 | downtown washed out by haze |
| Twin Peaks, walking view | **136** | **454,213** | 46 | 15 / 66 / 695 | orange carpet, hazy downtown, olive-brown summit ([shot](qa/w1/city-twin-peaks-walk-haze.jpg)). Morning 136 / 437k, night 141 / 438k. |
| Twin Peaks, high view 120 u (QA camera) | **130** | **514,796** | 46 | — | morning 127 / 492k |
| Twin Peaks, high view 250 u (QA camera) | **142** | **557,041** | 46 | — | the whole city with park greens, soft-focused by the tilt-shift ([shot](qa/w1/city-twin-peaks-high250-over-budget.jpg)). Morning 139 / 531k, night 144 / 532k ([night shot](qa/w1/city-twin-peaks-high250-night.jpg)). |
| Golden Gate Park, Conservatory | 63 | 258,653 | 47 | 13 / 65 / 698 | reads well |
| Golden Gate Park, de Young | **138** | **431,744** | 47 | 15 / 65 / 696 | |
| Ocean Beach (Judah) | 59 | 153,385 | 47 | 11 / 37 / 728 | |
| Cliff House | 50 | 124,544 | 47 | 7 / 28 / 741 | |
| Palace of Fine Arts | 78 | 201,077 | 47 | 13 / 39 / 724 | the lagoon reads as a raised slab |
| GGB south anchorage | 50 | 124,950 | 47 | 7 / 24 / 745 | Fort Point; the south deck starts on a lawn |
| Lombard | 85 | 254,180 | 47 | 9 / 26 / 741 | the hairpins are out of frame |
| City Hall | 116 | **433,431** | 47 | 10 / 46 / 720 | City Hall is out of frame; the label reads "Tenderloin" |
| Sutro Tower | 87 | 336,144 | 47 | 14 / 38 / 724 | |
| high over the Presidio (150 u) | 133 | 368,181 | 47 | — | no East Bay |
| high over the Bay (140 u) | 128 | **450,436** | 47 | — | low cloud blobs sit on the waterfront; night 135 / 462k |
| Castro, 2 s after a teleport without `whenReady` | 93 | 242,109 | 46 | L0 0, L1 0, 42 queued | only L2 block prisms around the player ([shot](qa/w1/city-castro-popin-2s.jpg)); 104 / 396k at 45 s |
| toy car at the Ferry plaza (quality mid) | 112 | 374,991 | 43 | — | |

**Budget:**
- Calls stay ≤ 150 everywhere: the maximum is 142 by day and 144 at night, both at the 250 u high view.
- **Triangles are over 400k at 12 of the 27 day views**, peaking at 557k.
- The lead's "152 calls / 637k" at a high Twin Peaks view now measures 127–144 calls and 492–557k triangles.

**Programs** (plan §5.5, `programs.length` stable):
- With `?quality=high`, the count is 44 at 45 s and stays 44–46 across 26 moves. The streamed city compiled **0** new programs.
- Compiled late, on first use: `ob-labels` and `ob-hero:ferry-tower` (t 81–163 s), `ob-fx` (first FX), a pelican program (+2 at glide start) and, at night, `ob-beam` ×2.
- Without `?quality=`, the adaptive PerformanceMonitor steps high → mid → low in SwiftShader and compiles whole sets (42 → 67 → 92 in 65 s, later 26). **QA runs must lock `?quality=high`.**

**Movement** (quality mid, about 2 fps; [glide shot](qa/w1/city-glide-mission-debug.jpg) with the `?debug=1` overlay):

| mode | result |
|---|---|
| walk | 5 u in 20 s at the Ferry; 5.8 u in 25 s on streamed collision in the Mission |
| bike | 19.8 u in 20 s |
| toy car | 7.6 u/s, one wall bump |
| pelican glide | took off, climbed to 14.6 u, landed at (288.8, 581.3), back on foot |

All four work in the streamed city.

**Seam, landmarks, edges:**
- **Seam:** no holes or gaps in the south, west, east and Pier 39 seam views from 35–40 u ([south seam](qa/w1/city-hero-seam-south.jpg)), nor at walking height in Chinatown. No floating or sunken buildings.
- **Landmarks seen:** Ferry Building, Coit, Bay Bridge, Salesforce, Dragon Gate, Painted Ladies, Mission Dolores, Twin Peaks plaza, Sutro Tower, Conservatory, de Young, Dutch windmill, Cliff House, Sutro Baths / Lands End, Palace, GGB, Fort Point, Castro marquee, Alcatraz, Angel Island.
- **Edges:** no Marin and no East Bay. The GGB deck ends past the north tower over open water ([shot](qa/w1/city-ggb-north-end-no-marin.jpg)). The water board ends in hard straight edges, visible from 60–80 u to the north, east and west.
- **HUD place label:** fixed. It shows DataSF neighbourhoods, not "The Embarcadero". Naming nits are in CS-8.

### 3.1 The lead's four look issues: all confirmed

| # | issue | confirmed | root cause | route |
|---|---|---|---|---|
| 1 | roofs are almost all orange gables | **yes**, city-wide; the high views are an orange carpet | See the cause breakdown below the table. The build cannot be re-run in the cloud (raw OSM inputs are not here), so the fix is a runtime remap. | C2-2 (A for a data v2 later) |
| 2 | haze too strong, downtown washed out | **yes**; morning is worst (downtown nearly invisible from Twin Peaks) | FogExp2 densities are tuned for district scale: at 900 u, day .0011 gives a 62 % fog factor, golden .0012 gives 69 % and morning .0022 gives 98 %. The city thinning `FOG_HIGH` (y0 30, y1 150, k 0.4) measures height above the *local* ground, so a camera on the Twin Peaks summit is about 10 u "up" and gets none. The tilt-shift post also blurs the far city. | C2-4 |
| 3 | Twin Peaks ground brown, not grassy | **yes** | OSM `natural=scrub` → class `scrub`, `CITY_PAL.scrub` #b8b98a. `build.ts paintFor` (and `far.ts`) mixes scrub into all land above h 30 (up to 35 %), and slopes > 0.75 mix toward earth. | C2-3 (+ A for the scrub mapping) |
| 4 | 152 calls / 637k at a high view | **yes, partly improved**: calls 127–144 (under 150), triangles 492–557k (about 40 % over) | Measured by toggling each part at the 250 u view, morning, base 140 / 531k: see the table below. | C2-5 + F13 + lead |

**Cause of issue 1 (roofs):**
- `scripts/opus-sf/lib/styles.ts` `roofFor()` makes victorian always gable, edwardian 65 % gable, sunset 50 % and residential 60 %.
- The roof pools lead with terracotta.
- In decoded v1, 58 % of 57,480 buildings are gable and only 20 % are flat.
- Far prisms average the terracotta and grey roofs to brown, and then saturate them ×1.22.

**Breakdown for issue 4** (250 u view, morning; base 140 calls / 531k):

| part | calls | triangles | note |
|---|---|---|---|
| L0 | 21 | 138k | does not shrink for a high camera on foot |
| L1 + L2 pools | 3 | 130k | |
| props | 7 | 40k | |
| water | 13 | 26k | |
| environment | 6 | 18k | |
| shadow pass | 3 | 17k | |
| sites | 4 | 4k | |
| player group | 18 | 69k | the same cost in every walking view |
| district life | 9 | 38k | still drawn 900 u from the hero |
| 16 hero ground chunks | ≈ 25 | ≈ 50k | |
| 20 backdrop chunks | ≈ 30 | ≈ 17k | |
| floaters and streetcars | 9 | — | |

### 3.2 Other city defects

| id | severity | defect | route |
|---|---|---|---|
| CS-1, CS-2, CS-3 | major | Look issues 1, 2 and 4 from 3.1: CS-1 roofs, CS-2 haze, CS-3 triangle budget. Look issue 3 (brown Twin Peaks) is CS-5. | see 3.1 |
| CS-4 | **major (bug)** | **The player is thrown back to the Ferry gate** when the streaming focus moves away for more than about 1 s (QA camera here; cinematics or map previews could do the same). See the sequence below the table. Seen twice (Sutro Tower, Twin Peaks summit). Fix: treat `standAt −1` (not resident) as unknown (pause the stuck timer, no unstick), and keep the player's own chunk rasters resident whatever the focus. | E2 (`actors/controller.ts`, E2-14) + C2 (`stream.ts` residency) |
| CS-5 | minor | Twin Peaks is brown and houses run right up to the summit plaza (3.1 #3). | C2-3 |
| CS-6 | minor | Programs are compiled after warm-up, on first use: labels, the ferry tower, FX, the pelican, the night beam. Each is a potential hitch. | C2 (`warmup.ts`, `registerWarmup`); E2 registers the pelican material |
| CS-7 | minor | Adaptive quality downgrades recompile whole program sets, and the `?debug` overlay says "tier high" while `settings.quality` is mid (`runtime.perf.tier` is never written). | C2 (WorldScene monitor) + G1 (debug line in `Systems.tsx`) |
| CS-8 | minor | HUD neighbourhood names don't match the landmark you are at. Examples: "Financial District/South Beach" at the Dragon Gate, "Tenderloin" at City Hall, "Castro/Upper Market" in Dolores Park, "Hayes Valley" at the Painted Ladies. Suggestion: show the landmark or area name inside a landmark's radius. | G1 (G1-2, G1-9) + G2 (zh glossary) |
| CS-9 | minor | District barks and goals play everywhere in the city. "The sea lions are in a meeting again" plays in Dolores Park, GGP, Palace, Alamo and Ocean Beach, and goal chips such as "Coit murals · ~6 min" show from Ocean Beach. | G2 (G2-0 mode-resolved content) |
| CS-10 | minor | City camera: the face request loses to occlusion avoidance, so City Hall, the Palace rotunda and the Lombard hairpins are out of frame at arrival. On narrow Sunset, Mission and Castro streets the camera sits among the roofs. `arrivalSpot` puts the player in narrow slots between house rows. | E2 (E2-5, E2-6; `nav.ts arrivalSpot`) |
| CS-11 | minor | Hard world edges are visible from 60–80 u. The GGB north end is over open water, and the south deck starts on a lawn with a visible end face and no approach road. No Marin or East Bay. | C2-7a/b + D2 (GGB south approach, D2-09) |
| CS-12 | minor | Low cloud blobs rest on the waterfront in high views. At night the far city (L2) is nearly dark, and the distant GGB towers float as red bars. | C2-8, C2-9 |
| CS-13 | minor | The Palace lagoon (y 0.14 on ground ≈ 0) shows a dark side face and reads as a raised slab. | D2 |
| CS-14 | note | Pop-in: after a teleport without `whenReady`, only L2 prisms show for about 2 s. L0 houses appear by 8 s and everything is complete by 45 s (SwiftShader). The tier swap is a hard cut. With `whenReady` first, the 3 s shot equals the 20 s shot. | C2-10 (cross-fade); G1-7 and G1-10 must await `whenReady` |

**CS-4 sequence:**
1. The rasters under the player are evicted at 256 u.
2. `cityCanStand()` returns false for a non-resident chunk.
3. `actors/controller.ts` step 9 counts that as stuck for more than 1 s and calls `unstick()`.
4. `nearestWalkable(p, 60)` finds nothing resident, so it falls back to `nearestWalkable(DISTRICT.spawn)`.

A plain teleport did not trigger it, because the rasters arrived within 1.5 s.

Night and morning: at walking height, the lit windows, lamp halos and moon read well at night. From high up the far city is dark ([shot](qa/w1/city-twin-peaks-high250-night.jpg)). Morning has the heaviest haze.

---

## 4. Perf table: to be filled on the owner's machine

The plan's G2 gate (§10):
- 6 spots, 1× and 4× CPU throttle, desktop and 390×844.
- **≥ 45 fps mean at 4×**; **desktop 1× p95 ≤ 18 ms and p99 ≤ 25 ms**.
- Always ≤ 150 calls, ≤ 400k triangles incl. shadows, ≤ 500 objects.
- `programs.length` stable.
- 0 frames over 100 ms from streaming after the first lap.

Every fps number must name its viewport, throttle, spot and duration (plan §9).

### 4.1 Procedure

1. **Setup.**
   - Owner's Windows machine with a real GPU. Close other apps, keep the laptop plugged in, and record the GPU, Chrome version and display refresh rate. Headless Chrome is vsync-capped, so 60 fps is the ceiling.
   - `npm ci`, then `npx vite --config vite.opus.config.ts` (port 5174). The QA hooks (`window.__opusBay`) exist **only in dev**, as they did for the v1 table.
   - Open one page once to fill Vite's dependency cache.
   - Run **one** headless Chrome at a time. Use `scripts/opus-shot.mjs` without the SwiftShader flags (it finds the local Chrome).
2. **Save the two helper files below** into a scratch folder `$Q` (e.g. `C:/Users/willy/opus-qa/w1-perf/`). Run `node $Q/perf-gen.mjs`, which writes `perf-<spot>-<vp>.json` for 6 spots × 2 viewports.
3. **Run each spot and viewport** (URL: `http://localhost:5174/opus-bay?start=free&world=city&quality=high&time=golden`):
   ```bash
   U="http://localhost:5174/opus-bay?start=free&world=city&quality=high&time=golden"
   for s in ferry-gate chinatown twin-peaks ocean-beach ggb-south mission; do
     node scripts/opus-shot.mjs --url "$U" --w 1440 --h 900 --wait 30000 --out "$Q/perf-$s-desktop.png" --actions "$(cat $Q/perf-$s-desktop.json)" > "$Q/perf-$s-desktop.log"
     node scripts/opus-shot.mjs --url "$U" --mobile --wait 30000 --out "$Q/perf-$s-mobile.png" --actions "$(cat $Q/perf-$s-mobile.json)" > "$Q/perf-$s-mobile.log"
   done
   ```
   Each run does the following:
   - teleports with `whenReady` first (so CS-4 cannot trigger);
   - waits 20 s for streaming to settle and takes a shot;
   - measures 10 s idle and 10 s walking (W held) at 1×;
   - teleports back to the spot and waits 15 s;
   - sets the 4× throttle, waits 5 s, and measures idle and walking again.

   Each measurement prints one JSON line: `fps` (mean), `p50/p95/p99` ms, `over50`, `over100`, `calls`, `tris`, `programs`, `objects`, `l0/l1/l2`, `queued`, `errors`. Read every PNG before describing it.
4. **Fill the table** in 4.2. Mark a row **fail** if:
   - 4× mean fps < 45 (idle or walk);
   - desktop 1× p95 > 18 ms or p99 > 25 ms;
   - calls > 150, tris > 400k or objects > 500;
   - `programs` changes between the 1× and 4× readings, or `over100 > 0` after the first lap.
5. **Extras in the same session:**
   - one Twin Peaks desktop run with `&pool=tile` (the no-`WEBGL_multi_draw` fallback adds about 12–16 calls; the budget must hold in both paths);
   - the district re-measure in 4.3 (same helpers, district URL, no teleport);
   - the iPhone check in 4.4.

`perf-helpers.js`:
```js
window.__perf = {
  async go(x, z, fx, fz) {
    const ob = window.__opusBay;
    const flow = await import('/src/opus-bay/game/flow.ts');
    const nav = await import('/src/opus-bay/actors/nav.ts');
    const cinema = await import('/src/opus-bay/game/cinema.ts');
    ob.world.clearCam();
    await ob.city.focus(x, z, 150);                      // stream the target first (whenReady)
    const p = nav.arrivalSpot({ x, z }, 30) ?? { x, z };
    flow.teleportPlayer(p);
    ob.city.focus(null);                                  // follow the player again (see CS-4)
    cinema.faceCameraToward(fx, fz);
    return JSON.stringify({ x: +p.x.toFixed(1), z: +p.z.toFixed(1) });
  },
  frames(ms, walk) {
    return new Promise(done => {
      const key = type => window.dispatchEvent(new KeyboardEvent(type, { code: 'KeyW', key: 'w' }));
      const d = []; let t0 = 0, last = 0;
      if (walk) key('keydown');
      requestAnimationFrame(function f(now) {
        if (!t0) t0 = last = now; else { d.push(now - last); last = now; }
        if (now - t0 < ms) return requestAnimationFrame(f);
        if (walk) key('keyup');
        const s = [...d].sort((a, b) => a - b), q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))];
        const ob = window.__opusBay, i = ob.renderer.info, c = ob.city.stats();
        done(JSON.stringify({ walk, fps: +(1000 * d.length / (last - t0)).toFixed(1), p50: +q(0.5).toFixed(1),
          p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1), over50: d.filter(x => x > 50).length,
          over100: d.filter(x => x > 100).length, calls: i.render.calls, tris: i.render.triangles,
          programs: i.programs.length, objects: ob.world.stats().objects, l0: c.l0, l1: c.l1, l2: c.l2,
          queued: c.queued, errors: c.errors }));
      });
    });
  },
};
'ok';
```

`perf-gen.mjs` (spot coordinates are the same as the cloud city smoke run; `x, z` is where the player stands before `arrivalSpot`, and `fx, fz` is what the camera faces):
```js
import fs from 'node:fs';
const here = f => new URL(f, import.meta.url);
const helpers = fs.readFileSync(here('./perf-helpers.js'), 'utf8');
const spots = {
  'ferry-gate':  [null, null, 60, 120],          // DISTRICT.anchors['ferry-gate']
  chinatown:     [86.3, 178.1, 81.9, 174.7],     // Dragon Gate arrival
  'twin-peaks':  [128.9, 922.3, 125, 500],       // summit overlook, facing downtown
  'ocean-beach': [-478.1, 1416, -530, 1466],     // Judah
  'ggb-south':   [-714.3, 602.4, -866, 508],     // south anchorage, facing the bridge
  mission:       [198.7, 641.9, 194.1, 647.4],   // Mission Dolores
};
for (const [name, [x, z, fx, fz]] of Object.entries(spots)) {
  const go = x === null
    ? `(() => { const a = window.__opusBay.district.anchors['ferry-gate']; return window.__perf.go(a.x, a.z, ${fx}, ${fz}); })()`
    : `window.__perf.go(${x}, ${z}, ${fx}, ${fz})`;
  const measure = tag => [
    { do: 'eval', label: `${tag}-idle`, expr: 'window.__perf.frames(10000, false)' },
    { do: 'eval', label: `${tag}-walk`, expr: 'window.__perf.frames(10000, true)' },
  ];
  for (const vp of ['desktop', 'mobile']) {
    const acts = [
      { do: 'eval', label: 'helpers', expr: helpers },
      { do: 'eval', label: 'go', expr: go }, { do: 'wait', ms: 20000 },
      { do: 'shot', name: `perf-${name}-${vp}.png` },
      ...measure('1x'),
      { do: 'eval', label: 'go-again', expr: go }, { do: 'wait', ms: 15000 },
      { do: 'throttle', rate: 4 }, { do: 'wait', ms: 5000 }, ...measure('4x'), { do: 'throttle', rate: 1 },
    ];
    fs.writeFileSync(here(`./perf-${name}-${vp}.json`), JSON.stringify(acts));
  }
}
```

### 4.2 City table (G2 gate) — measured 2026-09-26 23:00–23:58 PDT on the owner's machine

Machine: Ryzen 9 5900HX (16 threads), RTX 3070 Laptop GPU (driver 610.60) + AMD Radeon Vega iGPU, Windows 11, Chrome
153.0.8010.54 headless (`--headless=new`, vsync-capped at 60), dev server (`vite.opus.config.ts`), branch `opus-bay` @
`4610ee2` (wave-2 head, **Karl / night light field not applied yet**), `?start=free&world=city&quality=high&time=golden`.
Runs are sequential (one Chrome at a time, nothing else running). Scripts (copies in `scripts/opus-sf/qa/perf/`) and raw logs: `C:/Users/willy/opus-qa/w2-perf/`
(`perf-helpers.js`, `perf-gen.mjs`, `run-all.sh`, `run-extra.sh`, `table.mjs`, `opus-prof.mjs`; logs in `nv/`, `amd/`,
`extra/`). The RTX runs pass `--force_high_performance_gpu` (without it headless Chrome picks the iGPU). "programs" is
1× idle → 4× walk. Idle and walk are 10 s each; p95 / p99 are for the walk window; a row fails on the rules in 4.1.

**RTX 3070 (the owner's GPU)**

| spot | viewport | throttle | calls | tris | programs | objects | fps idle | fps walk | p95 ms | p99 ms | frames > 50 / > 100 ms | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Ferry gate | desktop 1440×900 | 1x | 121 | 386k | 48→49 | 300 | 60.1 | 57.9 | 16.8 | 16.9 | 2 / 2 | fail: programs, >100ms |
| Ferry gate | desktop 1440×900 | 4x | 103 | 385k | 48→50 | 304 | 39.6 | 30 | 50 | 50.1 | 6 / 0 | fail: fps<45, programs |
| Ferry gate | 390×844 | 1x | 99 | 338k | 46→49 | 300 | 60.1 | 58.1 | 16.8 | 16.9 | 2 / 2 | fail: programs, >100ms |
| Ferry gate | 390×844 | 4x | 89 | 334k | 46→50 | 304 | 41.7 | 31.7 | 49.9 | 50.1 | 5 / 0 | fail: fps<45, programs |
| Chinatown (Dragon Gate) | desktop 1440×900 | 1x | 124 | 432k | 40→40 | 319 | 60.1 | 58.5 | 16.8 | 16.8 | 2 / 1 | fail: tris, >100ms |
| Chinatown (Dragon Gate) | desktop 1440×900 | 4x | 127 | 431k | 40→40 | 319 | 47.5 | 34.6 | 33.4 | 50 | 1 / 0 | fail: fps<45, tris |
| Chinatown (Dragon Gate) | 390×844 | 1x | 107 | 371k | 50→50 | 321 | 60.1 | 58.3 | 16.8 | 16.8 | 2 / 2 | fail: >100ms |
| Chinatown (Dragon Gate) | 390×844 | 4x | 109 | 365k | 50→50 | 321 | 39.7 | 35.4 | 33.4 | 50 | 1 / 0 | fail: fps<45 |
| Twin Peaks | desktop 1440×900 | 1x | 112 | 397k | 40→40 | 325 | 60.1 | 58.4 | 16.8 | 16.8 | 2 / 2 | fail: >100ms |
| Twin Peaks | desktop 1440×900 | 4x | 112 | 396k | 40→40 | 325 | 35.9 | 26.6 | 50.1 | 66.4 | 16 / 0 | fail: fps<45 |
| Twin Peaks | 390×844 | 1x | 102 | 330k | 50→50 | 325 | 60.1 | 56.7 | 16.8 | 16.8 | 2 / 2 | fail: >100ms |
| Twin Peaks | 390×844 | 4x | 97 | 322k | 50→50 | 325 | 53.2 | 52.1 | 33.3 | 33.4 | 0 / 0 | pass |
| Ocean Beach (Judah) | desktop 1440×900 | 1x | 58 | 148k | 50→50 | 309 | 60.1 | 56.9 | 16.7 | 16.8 | 2 / 2 | fail: >100ms |
| Ocean Beach (Judah) | desktop 1440×900 | 4x | 59 | 148k | 50→50 | 311 | 59.9 | 52.7 | 33.3 | 33.4 | 0 / 0 | pass |
| Ocean Beach (Judah) | 390×844 | 1x | 50 | 143k | 48→50 | 309 | 60.1 | 56.8 | 16.8 | 16.8 | 2 / 2 | fail: programs, >100ms |
| Ocean Beach (Judah) | 390×844 | 4x | 53 | 143k | 48→50 | 311 | 58.8 | 52.9 | 33.3 | 33.4 | 0 / 0 | fail: programs |
| GGB south anchorage | desktop 1440×900 | 1x | 52 | 125k | 50→50 | 302 | 60.1 | 56.7 | 16.7 | 16.8 | 2 / 2 | fail: >100ms |
| GGB south anchorage | desktop 1440×900 | 4x | 52 | 125k | 50→50 | 302 | 60.1 | 60.1 | 16.7 | 16.8 | 0 / 0 | pass |
| GGB south anchorage | 390×844 | 1x | 51 | 124k | 48→50 | 302 | 60.1 | 56.7 | 16.7 | 16.8 | 2 / 2 | fail: programs, >100ms |
| GGB south anchorage | 390×844 | 4x | 51 | 124k | 48→50 | 302 | 60 | 60.1 | 16.7 | 16.8 | 0 / 0 | fail: programs |
| Mission (Mission Dolores) | desktop 1440×900 | 1x | 87 | 346k | 50→50 | 326 | 60.1 | 57 | 16.8 | 16.8 | 2 / 2 | fail: >100ms |
| Mission (Mission Dolores) | desktop 1440×900 | 4x | 87 | 354k | 50→50 | 326 | 60 | 56.4 | 33.3 | 33.4 | 0 / 0 | pass |
| Mission (Mission Dolores) | 390×844 | 1x | 73 | 290k | 40→40 | 326 | 60.1 | 56.6 | 16.7 | 16.8 | 2 / 2 | fail: >100ms |
| Mission (Mission Dolores) | 390×844 | 4x | 75 | 305k | 40→40 | 326 | 60 | 56.8 | 33.2 | 33.4 | 1 / 0 | pass |
| extra: Twin Peaks `&pool=tile` | desktop 1440×900 | 1x | 130 | **519k** | 49→49 | 367 | 60.1 | 58.4 | 16.7 | 16.8 | 2 / 2 | fail: tris, >100ms |
| extra: Twin Peaks `&pool=tile` | desktop 1440×900 | 4x | 129 | **519k** | 49→49 | 367 | 37.2 | 33.5 | 49.9 | 66.7 | 7 / 1 | fail: fps<45, tris |

**AMD Radeon iGPU (a weak-GPU stand-in, closer to a phone GPU)**

| spot | viewport | throttle | calls | tris | programs | objects | fps idle | fps walk | p95 ms | p99 ms | frames > 50 / > 100 ms | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Ferry gate | desktop 1440×900 | 1x | 113 | 408k | 48→48 | 303 | 60.1 | 57.1 | 16.7 | 16.8 | 2 / 2 | fail: tris, programs, >100ms |
| Ferry gate | desktop 1440×900 | 4x | 102 | 386k | 48→50 | 304 | 57.9 | 47.9 | 33.4 | 33.4 | 0 / 0 | fail: programs |
| Ferry gate | 390×844 | 1x | 93 | 336k | 47→50 | 304 | 60.1 | 57.2 | 16.7 | 16.8 | 2 / 2 | fail: programs, >100ms |
| Ferry gate | 390×844 | 4x | 88 | 333k | 47→50 | 304 | 60.1 | 56.5 | 33.3 | 33.4 | 0 / 0 | fail: programs |
| Chinatown (Dragon Gate) | desktop 1440×900 | 1x | 124 | 433k | 40→40 | 319 | 60.1 | 57.1 | 16.7 | 16.8 | 2 / 2 | fail: tris, >100ms |
| Chinatown (Dragon Gate) | desktop 1440×900 | 4x | 127 | 432k | 40→40 | 319 | 50.2 | 47.3 | 33.3 | 33.4 | 0 / 0 | fail: tris |
| Chinatown (Dragon Gate) | 390×844 | 1x | 107 | 371k | 50→50 | 321 | 58.3 | 53.3 | 33.3 | 33.5 | 2 / 2 | fail: >100ms |
| Chinatown (Dragon Gate) | 390×844 | 4x | 105 | 361k | 50→50 | 321 | 32.1 | 22.6 | 66.6 | 83.2 | 37 / 1 | fail: fps<45, >100ms |
| Twin Peaks | desktop 1440×900 | 1x | 112 | 397k | 50→50 | 325 | 50.1 | 48.7 | 33.3 | 33.4 | 3 / 2 | fail: p95/p99, >100ms |
| Twin Peaks | desktop 1440×900 | 4x | 112 | 396k | 50→50 | 325 | 32.3 | 31.2 | 33.5 | 50 | 1 / 0 | fail: fps<45 |
| Twin Peaks | 390×844 | 1x | 102 | 330k | 49→49 | 325 | 60.1 | 58.3 | 16.7 | 16.8 | 2 / 2 | fail: >100ms |
| Twin Peaks | 390×844 | 4x | 97 | 322k | 49→49 | 325 | 42.3 | 40.5 | 33.4 | 33.4 | 0 / 0 | fail: fps<45 |
| Ocean Beach (Judah) | desktop 1440×900 | 1x | 58 | 148k | 40→40 | 309 | 60.1 | 55.9 | 16.8 | 33.5 | 2 / 2 | fail: p95/p99, >100ms |
| Ocean Beach (Judah) | desktop 1440×900 | 4x | 58 | 148k | 40→40 | 309 | 41.5 | 37.8 | 33.4 | 50 | 4 / 0 | fail: fps<45 |
| Ocean Beach (Judah) | 390×844 | 1x | 50 | 143k | 47→49 | 309 | 60.1 | 58.4 | 16.7 | 16.8 | 2 / 2 | fail: programs, >100ms |
| Ocean Beach (Judah) | 390×844 | 4x | 53 | 144k | 47→49 | 311 | 54.4 | 48.6 | 33.4 | 33.4 | 0 / 0 | fail: programs |
| GGB south anchorage | desktop 1440×900 | 1x | 52 | 125k | 50→50 | 302 | 60.1 | 58.5 | 16.7 | 16.8 | 2 / 2 | fail: >100ms |
| GGB south anchorage | desktop 1440×900 | 4x | 52 | 125k | 50→50 | 302 | 43.7 | 42.5 | 33.4 | 33.4 | 1 / 0 | fail: fps<45 |
| GGB south anchorage | 390×844 | 1x | 50 | 124k | 38→40 | 302 | 60.1 | 58.4 | 16.8 | 16.8 | 2 / 2 | fail: programs, >100ms |
| GGB south anchorage | 390×844 | 4x | 50 | 124k | 38→40 | 302 | 46.3 | 45.6 | 33.4 | 33.4 | 0 / 0 | fail: programs |
| Mission (Mission Dolores) | desktop 1440×900 | 1x | 86 | 347k | 40→40 | 326 | 53.5 | 46 | 33.4 | 49.9 | 2 / 2 | fail: p95/p99, >100ms |
| Mission (Mission Dolores) | desktop 1440×900 | 4x | 86 | 354k | 40→40 | 326 | 38 | 28.5 | 50.1 | 66.7 | 16 / 0 | fail: fps<45 |
| Mission (Mission Dolores) | 390×844 | 1x | 73 | 290k | 49→49 | 326 | 60.1 | 58.1 | 16.7 | 16.8 | 2 / 2 | fail: >100ms |
| Mission (Mission Dolores) | 390×844 | 4x | 76 | 305k | 49→49 | 326 | 40 | 41.5 | 33.4 | 33.4 | 1 / 0 | fail: fps<45 |

**What the table says (lead, 2026-09-27)**

1. **1× is 60 fps everywhere on the RTX**, calls ≤ 127 (130 with `pool=tile`), objects ≤ 367. The iGPU is GPU-bound at
   1440×900 in Twin Peaks (48.7 walk) and the Mission (46.0 walk); at 390×844 it holds 53+.
2. **Every run has exactly 2 frames > 100 ms in its first walk window, district included.** Cause (CPU profile,
   `extra/firstwalk.cpuprofile`): the first key / tap is the first user gesture, and the audio rig boots synchronously in
   it (`audio/audio.ts boot`: `new AudioContext` + the `AudioEngine` noise / impulse buffers ≈ 370 ms of main thread);
   900 ms later `ambience.setWorld(describeWorld(DISTRICT, true))` builds the shore distance field (`audio/logic.ts
   distToSegment` ≈ 135 ms). No shader compile is involved in city mode (the program list is identical before and after
   the first walk; district compiles 2 unnamed programs on its first walk). **Lane F owns the fix** (create the context
   suspended at load and only `resume()` + play the silent unlock sample in the gesture; noise / impulse / shore field in
   idle slices or a worker). On a phone this is a 1–2 s freeze on the first touch.
3. **4× CPU fails in the dense views** (Ferry gate, Chinatown, Twin Peaks desktop: 27–40 fps walking). The frame is
   main-thread bound (≈ 4–5 ms at 1× → 16–20 ms at 4×, which vsync quantises to 30). CPU profile at Twin Peaks, 4× walk
   (`extra/tp-4x-walk.cpuprofile`): 46 % inside three.js — `getParameters` + `getProgram` + `setProgram` ≈ 9 % (programs are
   re-looked-up every frame, the usual sign of one material instance shared between object kinds — mesh / instanced /
   batched / skinned, or different `receiveShadow` / fog — which flips `needsProgramChange` on each draw),
   `onBeforeRender` (BatchedMesh per-item culling and sorting) + `projectObject` + `updateMatrixWorld` ≈ 9 %, native GL ≈
   30 %. Ours: `game/Systems.tsx project` (click proxies, every frame) 2 %, `world/sf/stream.ts applyVisibility` 1.5 %,
   actors ≈ 2 %. Owners: C2 (materials, pools, stream), G1 (Systems), E2 (actors).
4. **Triangles:** Chinatown (Dragon Gate) desktop 432k and the iGPU Ferry gate 408k are over 400k. **`pool=tile` (the no-
   `WEBGL_multi_draw` fallback) draws 519k at Twin Peaks vs 396k batched for the same cells** (14 L0 / 61 L1): the tile
   path loses the per-item culling, and a phone without multi-draw would pay it (C2).
5. **`programs` drifts** by 1–3 between 1× idle and 4× walk at the Ferry gate, Ocean Beach and GGB (late compiles; C2's
   CS-6 warm-up registrations).
6. JS heap 166–341 MB (the high reading is right after load); `geometries` ≤ 159, `textures` ≤ 40, 0 streaming errors.

### 4.3 District re-measure (replaces the stale STATUS.md table, DR-2) — RTX 3070, 2026-09-26

`?start=free&quality=high&time=<time>&at=<anchor>`, 30 s after load, then 10 s each of 1× idle, 4× idle, 4× walk. The
4× walk window is the page's **first** walk, so it includes the audio-boot hitch of 4.2 item 2 (2 frames > 100 ms in
every row).

| spot (`at`, `time`) | viewport | calls | tris | objects | fps 1× | fps 4× idle | fps 4× walk | STATUS 2026-09-25 |
|---|---|---|---|---|---|---|---|---|
| `ferry-gate`, golden | 1440×900 | 77 | 250k | 264 | 60.1 | 60.1 | 47.5 | 55–56 / 144k; 60 / 59 / 59 |
| `sea-lion-viewpoint`, golden | 1440×900 | 63 | 235k | 264 | 60.1 | 59.2 | 46.3 | 53–57 / 179–186k; 60 / 60 / 58 |
| `coit-view`, golden | 1440×900 | 90 | 320k | 264 | 60.1 | 55.4 | 31.4 | 61 / 190–191k; 60 / 49 / 53 |
| `ferry-clock`, night | 1440×900 | 80 | 244k | 264 | 60.1 | 47.8 | 28.4 | 63–64 / 220–223k; 60 / 60 / 54 |
| `pier39-entrance`, day | 390×844 | 57 | 293k | 264 | 60.1 | 59.9 | 40.7 | 52–54 / 157k; 60 / 60 / 60 |
| `coit-view`, night | 390×844 | 76 | 293k | 264 | 60.1 | 59.8 | 38.0 | 57–58 / 155k; 60 / 60 / 60 |

The STATUS numbers were taken at auto quality (the monitor had lowered it); these are `quality=high`, so the triangle
counts are not comparable. District 1× is 60 fps everywhere.

### 4.4 Phone

**Emulated here** (the owner's iPhone is the real test): `--mobile --dpr 3` (390×844, touch; the game caps the pixel
ratio at 1.5 on high → a 585×1266 canvas), 4× CPU the whole run, auto quality (no `?quality`), city, golden.

| run | GPU | windows | quality | calls | tris | fps |
|---|---|---|---|---|---|---|
| Ferry gate, first minute | iGPU | idle / first walk / idle / walk | high (never lowered) | 71–75 | 221–227k | 51.2 / 33.6 / 39.9 / 40.5 |
| Twin Peaks, first minute | iGPU | same | high (never lowered) | 95–100 | 322–325k | 41.5 / 30.2 / 39.6 / 37.5 |
| Ferry gate, first minute | RTX | same | high (never lowered) | 95–102 | 317–337k | 51.6 / 28.7 / 46.7 / 43.1 |
| Twin Peaks, first minute | RTX | same | high (never lowered) | 95–100 | 322–325k | 45.3 / 33.3 / 51.9 / 59.3 |
| Ferry gate, after a warm-up walk | iGPU | idle – walk | `high` / `mid` / `low` | 97 / 86 / 85 | 314k / 279k / 294k | 51.7–51.8 / **60.1–60.1** / 59.7–59.1 |
| Twin Peaks, after a warm-up walk | iGPU | idle – walk | `high` / `mid` / `low` | 105 / 93 / 95 | 337k / 304k / 285k | 56.7–57.6 / **60.0–60.0** / 59.2–50.3 |

Findings:
- **The world runs on the phone profile**: it loads, streams, walks and renders at 390×844 with touch emulation, 0
  streaming errors, heap ≤ 218 MB, `WEBGL_multi_draw` present in Chrome (pool `batched`).
- **Auto quality never steps down** although the phone profile runs 30–45 fps on `high`: drei's `PerformanceMonitor`
  declines only when 7 of 8 half-second windows are < 40 fps (default `bounds` `[40, 60]`, `threshold` 0.75), and vsync
  holds the average at 35–45. `mid` is a solid 60 at both spots; `low` buys nothing over `mid`. → C2 (CS-7): start touch /
  high-DPR devices at `mid` unless `?quality` or a saved choice says otherwise, and decline at ≈ 50 fps.
- The first-touch audio boot (4.2 item 2) is the worst hitch on the phone profile (p99 117 ms in the first walk).
- **Still to check on the real iPhone** (Safari over the LAN, RESUME.md): the debug line's `pool` (`batched` or `tile`; if
  Safari lacks `WEBGL_multi_draw`, the tile path costs +30 % triangles, 4.2 item 4), fps / calls / tris at the Ferry gate
  and Twin Peaks, touch feel, the HUD at 390 wide, memory (no reload or crash after 5 minutes of walking).

---

## 5. Wave-2 list

Seven scoping readers read the code at `db1d4de`, read-only. This section keeps their concrete tasks, so wave-2 briefs can be written from it. `OB` = `src/opus-bay`. Sizes: S ≤ ½ day, M ≈ 1 day, L = several days.

### 5.1 Before the lanes start: day-0 contracts and ownership decisions (lead)

Several lanes asked for the same small hooks in shared files. Landing them first, in one commit, lets the lanes run on disjoint files.

**Day-0 edits, all additive:**

| file | change | asked by |
|---|---|---|
| `OB/core/events.ts` | One transit member, `{type:'transit'; what:'bell'\|'board'\|'depart'\|'arrive'\|'ride'\|'grip'\|'push'\|'turned'\|'horn'\|'hop-aside'; line; kind:'streetcar'\|'cable-car'\|'ferry'; real?: boolean}`. This covers F's events and G2's `transit:ride {real}` / `transit:bell`. Plus `{type:'voice-line'; id}` for H2b; G2's optional `line` event is the same thing. Keep `'streetcar-bell'`. | F, G2, H2b |
| `OB/core/store.ts` `syncMovePatch` (l.135-143) | Set `riding` whenever `move.mode === 'transit'`, whatever the line. Without this, cable-car and ferry rides leave the player unlocked. | F |
| `OB/game/flow.ts` | (a) Move the ride section (l.1163-1244) into F-owned `OB/game/transit.ts`, re-exported. (b) GoalKey `'cable-car' \| 'ferry'`. (c) `initFlowListeners` calls `initCityContent()` (G2). (d) Postcard counts go through `activePostcardCount` (G2-3). (e) Optional: a `nextFreeGoal` hook for city goal targets. | F, G2 |
| `OB/game/flowStore.ts` | `ride.line?`, `ride.kind?`, stages `'braking' \| 'turning'`. Optional `Cinematic 'travel'`. | F, G1 |
| `OB/game/interactables.ts` | `registerInteractables(key, fn)` (F stations, G2 residents); an extra id resolver for `place:<id>` (G1); `registerSubjectResolver(fn)` (G2 telescopes). | F, G1, G2 |
| `OB/actors/view.ts` | One obstacle mechanism for F's crowd and traffic: either F's `movers` array or E2-16's `registerObstacleSource(fn)`. Pick one. | F, E2 |
| `OB/ui/Hud.tsx` | G1-0: extract `MoveChip`, `Hint` and 3 style objects (l.35-114) verbatim into `OB/ui/MoveChip.tsx`, owned by E2 afterwards. | G1, E2 |
| `OB/ui/Overlay.tsx:41` | `startGame()` → `startOrResume()`, with a fallback to `startGame()`. | G1 |
| `OB/world/materials.ts`, `warmup.ts`, `world.ts`, `sf/stream.ts`, `sf/sites.ts` | C2-0 hooks: export `patchToyShader` (and the private `patchCommonVertex` / `COMMON_FRAG_PARS` / `TOY_FRAG` that D2 asks for), `registerWarmup`, `world.addSystem`, `streamer.heroFar` / `onHeroFar`, the `SiteHooks` type. | C2, D2, F |
| `OB/actors/platform.ts`, new `OB/actors/moveApi.ts`, `OB/core/input.ts` | E2-0: platform stop requests, `moveApi` (driveTo, requestHopOff, toFoot, fleetSnapshot / restoreFleet, glideUnlocked), `input.hopOffCount`. | E2, F, G1 |

**Ownership decisions** (the readers' proposals conflict here):

| file or topic | conflict | proposal |
|---|---|---|
| `OB/world/sf/sites.ts` | C2 (SiteHooks, LOD by camera height) vs D2 (swap/dress host, hero fade, kit-swap tick) | **D2 owns it** and keeps the API that `stream.ts` calls. C2 publishes the `SiteHooks` type and D2 implements the LOD-by-camH rule from C2-5.5. |
| AI GLB material | C2-11 `toyMapMaterial` in `materials.ts` vs D2-03 `world/modelMaterial.ts` on exported patch helpers | **D2-03**, with C2 exporting the helpers on day 0 and keeping them stable; C2 reviews. This saves one cross-lane wait. |
| near-player kit hide | C2-12 `uHide[12]` OBB discard (uniforms only) vs D2-08 per-building index ranges (`l0index.ts`, about 5 + 1 + 15 lines in C2's build/worker/stream) | Lead call. OBB discard is simpler; D2 notes it breaks on shared party walls in row houses. D2 needs per-building descriptors from the L0 build either way. |
| `OB/actors/platform.ts` | E2 (E2-0 stop requests, E2-10) vs F (F9 pitch, kind, mirrored rail, deck rects) | One owner. Proposal: **F owns it**, because it publishes every platform. F lands E2's stop-request API from the E2-0 spec on day 0. |
| `OB/actors/npcs.ts` | G2 (G2-7 city residents) vs E2 (`registerResidents` idea) | **G2 owns it.** E2 makes the 3-line `actors/system.ts` change (spawn defs with `at`, a talking set derived from ids, `nearestNpcId` within about 12 u). |
| `OB/game/Systems.tsx` | G1 (QaBridge, debug line) vs G2 (glint and click-proxy heights) vs F (stepRide) | **G1 owns it**; G2 and F hand over patches. |
| `OB/ui/Hud.tsx`, `TitleScreen.tsx` | G1 owns; G2 needs the count fix and city subtitle, F `rideLabel()`, E2 `Hud.tsx:349` hop-off request | G1 owns; the others hand over one-liners. |
| `OB/ui/Journal.tsx`, `Moments.tsx` | G1-11 (Footprints tab) vs G2-3 / G2-11 (counts, tasks list) | G2 owns both; G1 exports `<Footprints/>` for G2 to mount. |
| `OB/world/life.ts` | F (F8 ferry, F13 hero-life pause) vs C2-5 (hide `life.group` when hero far) | **F owns** the pause (F13). C2 does not also toggle it. |
| `OB/data/assets.ts`, `OB/ASSETS-LEDGER.md` | D2 (SF_KIT, D2-15) vs H2b (voice, map, murals); E2-8 and F append to the ledger too | D2 registers SF_KIT early, then H2b. The ledger is append-only with **one writer at a time** (proposal: H2b holds it; the others hand over rows). |
| `OB/core/walkGraph.ts` | E2-3 needs `edgeAccept?: (e) => boolean` in `RouteSearchOptions` (lane B has no wave-2 owner) | Grant E2 this 3-line additive edit, or E2 writes a private A* in `autopilot.ts`. |
| `OB/audio/voice.ts`, `audio.ts` | H2b needs `voice.line(id, fallback)` and a `voice-line` case in files F owns | F implements the 25-line spec from H2b-9, or H2b edits after F is done. |
| `tests/opus-bay-hero-regression.test.ts` | M0 has no wave-2 lane | **C2 owns it**. BASELINE rows must not change. |

**Owner questions:**
1. Ferry v1 destination: Pier 41 in the hero, or Sausalito on C2's Marin board (plan Q8).
2. The ≥ 150 u ride rule vs short hero hops. Adjacent hero stops are 104.8, 127.1 and 53.5 u apart, so no single-hop hero ride would count.
3. Karl the Fog on by default in the morning (plan Q7).
4. A taste review of the new roof and palette mix and the haze level.
5. The Painted Ladies AI row vs keeping the procedural row (D2-07 gate).
6. Approval for HC-3 (touches the site shell outside Opus Bay).

**Suggested order** (plan §9: at most 4 builders + 1 integrator):
1. Day 0: the lead lands the contracts and decisions above.
2. Batch 1: C2, E2, F, D2.
3. Batch 2: G1, G2, H2b.
   - H2b can start its independent parts early (preflight, base map render, voice line list), because `MAP_FRAME` decouples it from G1.
4. Then the perf run on the owner's machine (§4), verify + polish, and flipping `DEFAULT_WORLD_MODE` to `'city'` once G2 passes.

### 5.2 External blockers and environment (cloud, checked 2026-09-26/27)

| item | status |
|---|---|
| **Higgsfield result CDN** `d8j0ntlcm91z4.cloudfront.net` | **Reachable now**: HTTP 200 for a 1.2 MB GLB, 206 for a PNG and a WAV. The "cloud cannot download" premise in older briefs is stale, and `ASSETS-LEDGER.md:300` still says 403; append a dated correction. CLOUD.md warns the allow-list can be lost in a new container, so test with `curl -sS -o /dev/null -w '%{http_code}' <rawUrl>` before paying. |
| Higgsfield uploads | The `media_upload` presigned PUT host is unknown until called (generic S3 is reachable). Upload previews on `d2ol7oe51mr4n9.cloudfront.net` are blocked (403); generation does not need them. Fallback: `media_import_url` on a `raw.githubusercontent.com` URL of a committed image (the repo is public), which needs the lead's approval to commit and push. Style refs can use prior job ids (K6 `3617006b-…`). |
| MCP | `mcp-proxy.anthropic.com` works (balance, get_cost, show_generations, models_explore). Balance **519.48**. |
| raw OSM / Overpass | Not in the cloud and not reachable, so the SF data cannot be rebuilt. Roof and palette fixes are runtime remaps (C2-2). The published `sf/v1` is complete. |
| Terrarium tiles | `s3.amazonaws.com/elevation-tiles-prod/terrarium/` answers HTTP 200 (C2-7a). pngjs 7.0.0 is already a devDependency. |
| PyPI | Reachable. `bpy` 5.0.1, Pillow 12.3 and numpy are in `/tmp/claude-0/bpyenv`. Audio encoding needs `pip install imageio-ffmpeg`: the Playwright ffmpeg has no AAC, Opus or loudnorm. |
| ASR | Not reachable (huggingface.co, openaipublic.azureedge.net and alphacephei.com all return 403), so the owner judges voice takes by ear. |
| GPU, phone, gamepad | Owner's machine only: fps, the G2 perf gate, iPhone `WEBGL_multi_draw`, touch feel, real-pad mapping. |

### 5.3 Higgsfield credit plan (owner: all 519.48 may be used; quality first)

| use | lane | estimate (credits) |
|---|---|---|
| T2 painted whole-SF map: 7 candidates (4× nano_banana_pro 4k, 2× seedream_v4_5 high, 1× seedream_v5_pro inpaint) plus a retake round | H2b | 26.5 + 8–16 |
| A1 voice: about 20 new lines + 3 re-records, zh and en, 3 takes each (qwen_audio_tts, Pixie preset) | H2b | about 1.3 |
| G2's BAYBAY barks / resident hellos (TTS) | H2b for G2 | < 5 |
| T4 original Mission murals (optional) | H2b | 30–40 |
| 8 raw SAM landmark meshes (Legion, Ghirardelli, Fort Point, Mission Dolores, Castro, windmill body, Grace, City Hall): the download is free; retakes 1–5 each | D2-15 | 0 – about 40 |
| gliding pelican body, only if the procedural pelican reads weak (2 concepts 4 + Tripo 12 + retake reserve 12–30) | E2-8 fallback | 30–50 |
| generated SFX (bell, foghorn, surf, birds), only if synthesis sounds cheap | F via H2b | 10–20 |
| art-direction targets for roofs, night and Karl (optional) | C2 | ≤ 16 |
| **total** | | **about 105–215**, leaving at least about 300 for retakes |

Log every job in the ledger and check `transactions` after every batch; the account is shared by parallel lanes.

---

### 5.4 Lane C2: city look, atmosphere and performance

**State:**
- Decoded v1 has 57,480 buildings: 11,364 flat, 33,118 gable, 12,998 hip.
- `world/sf/build.ts:298-314 specOf` is the one place that feeds both L0 and L1.
- L2 prisms always draw a flat top in the averaged roof colour ×1.22 saturation (`far.ts:206-228`).
- Forcing all houses flat with today's recipe takes the densest cell 2_11 from 17,924 to 21,469 L0 triangles; the test cap is 18,500.
- Stream radii ignore camera height: L0 125/165, L1 300/350, and only glide above 40 u shrinks L0.
- `heroFar` hides only the city# chunks.
- The seam buildings osm 288472567 and 1092477935 are dropped only in the renderer, so their collision remains.

| id | task | size |
|---|---|---|
| C2-0 | Day-0 hooks (5.1): `patchToyShader` + `U` export, `registerWarmup(make)`, `world.addSystem({group, update, dispose})`, `streamer.heroFar` / `onHeroFar`, `SiteHooks {lights?, mount?, plaza?}`. Publish the API in the lane report. | S |
| C2-1 | Budget breakdown `stats.ts breakdown()` (per-group calls and tris with a frustum test) plus `scripts/opus-sf/qa/budget-views.mjs`. Record a **baseline before any change**. Views: Twin Peaks walk (128.9, 922.7), Twin Peaks high (≈ (140, 115, 1000) → Ferry Building), Coit high, an 80 u glide over the Mission (195, 648), Ferry gate, Painted Ladies, Ocean Beach. Times golden and night, quality high and mid, plus one `?pool=tile` run. | S |
| C2-2 | **SF look remap.** New worker-safe `world/sf/look.ts` (`roofFor`, `wallFor`, `flatTopColor`, `pitchedRoofColor`, `farPrismColors`). Details below the table. | L |
| C2-3 | **Green hills.** `CITY_PAL.scrub` → ≈ #a9bf7e, new `hillGrass` ≈ #a3c27c; land above 30 u mixes to hillGrass; slope → earth only above 0.95, capped at 0.35. The same rules in `far.ts` at 16 u. | S |
| C2-4 | **Haze.** Pure `cityFogK(camY, groundY, tod)` = altitude term (y above water, 20 → 70 u ⇒ ×1 → ×0.45) × above-ground term (30 → 150 u ⇒ ×0.4) × a city per-time scale (e.g. night ×0.45). Walking below y 15 stays exactly as today. It is a uniform, so no recompile. Optional: tilt-shift blur scaled by camera height. | M |
| C2-5 | **High-view budget ≤ 150 / ≤ 400k incl. shadows.** Details below the table. | L |
| C2-6 | Walked ground from `groundRaster(chunk)` − sink (keep DEM heights within about 2 u of bridge and deckOnly segments). A worker-side `dropSeamBuildings` removes the invisible walls in chunk −2_0. `sites.ts:96` already passes sink: test only. | M |
| C2-7a | Offline boards `scripts/opus-sf/boards.ts` (Terrarium z13): Marin (lat 37.81–37.885, lng −122.545…−122.465) at 4 u, East Bay (37.76–37.90, −122.33…−122.18) at 8 u. The ground within about 25 u of the GGB north deck end (−1015.7, 388.6) ramps to exactly 15.2. Writes **new** files `public/opus-bay/sf/v1/boards/{boards.json, marin.obb, eastbay.obb, ATTRIBUTION.md}`; never touch existing v1 files. Budget ≤ 40k tris. | M |
| C2-7b | Boards at runtime (`world/sf/boards.ts`): marching-squares ground with the C2-3 paint and slab edges. Procedural toy-town dressing (Sausalito hillside, Oakland towers, port cranes, Berkeley flats) goes into the pools as static items, **0 new calls**. Extend `BOARD_LL` water. Fade or cap the extent: the Berkeley hills are about 3,900 u from Ocean Beach, and the camera far plane is 3,000. | L |
| C2-8 | **Karl the Fog.** `world/sf/fog.ts`. Details below the table. | L |
| C2-9 | **Night light field.** Street glow in GROUND ribbons (lamp level primary 1 / secondary 0.7 / tertiary 0.5, dots every 9 u, fading near the camera). `world/sf/lights.ts`: one Points layer (≈ 12.8k points from `far.lines`, GGB deck and tower lights, `SiteHooks.lights`), 1 call. Props: 64 lamps with halos. | M |
| C2-10 | Tier cross-fade: `uTierFade` per L0 draw and BatchedMesh colour alpha (`USE_BATCHING_COLOR`, warmed). The outgoing tier stays visible for 0.3 s with complementary Bayer dither; `programs.length` stays constant. | M |
| C2-11 | OB_MAP material for AI GLBs. **Superseded if the lead picks D2-03** (5.1). | M |
| C2-12 | `uHide[12]` OBB discard API for D2's kit swap. **Only if the lead picks it over D2-08's index ranges.** | S |
| C2-13 | (optional, after C2-7b) Bay Bridge east span, from the SAS tower (211.0, −506.6) to the Oakland touchdown on the East Bay board. | S |
| C2-14 | Tests (see the Tests line), contact sheets (golden, day, night, mobile), before/after budget table, district before/after with Karl off, report `docs/opus-bay/sf-w2-C2.md`. | M |

**C2-2 SF look remap:**
- **Roof rule:** everything goes flat (parapet or cornice) except:
  - Sunset/Richmond/Lakeshore/Oceanview sunset style: 15–20 % gable/hip with tile;
  - small cottages (< about 45 u², H ≤ 5) in Noe Valley, Bernal Heights, Glen Park, Excelsior and Portola: about 35 %;
  - Marina/Seacliff: about 40 % hip;
  - industrial/pier sheds and churches keep their gables.
- **Targets:** ≥ 80 % flat and ≤ 10 % gable overall.
- **Walls:** remap the beige and tan pools toward white/off-white (about 35 %) and light pastels; keep the Painted-Lady chroma and SoMa brick. Flat tops are white, light grey, grey, gravel or a little tar.
- **Zones:** sent to both workers as a `{t:'zones'}` message in `onFar`.
- **Recipes:** a cheap SF flat-roof variant in `recipes/city.ts` (parapet + membrane, no clutter under about 20 u²), so the densest L0 cell stays ≤ 18,500 tris.
- **`far.ts`:** drop the ×1.22 roof saturation.
- **Hero:** the hero district is unchanged.

**C2-5 high-view budget:**
- **Radii:** pure `radiiFor(q, {heroNear, camH, gliding})` in `cell.ts`. L0 shrinks to 60/90 u as camH goes 25 → 60; L1 shrinks to 240/290 above camH 80; the glide rule moves in here.
- **Props:** capped by camH.
- **Hero far:** a `heroGroundProxy()` (6–8k tris) replaces the 16 ground# chunks, and labels, market and blob shadows are hidden.
- **Backdrop:** split at 512 u in city mode (20 → about 6 calls).
- **Sites:** LOD0 radius by camH.
- **Expected savings:** L0 −90…110k, hero ground −45k, props −30k, life −25k (F13), calls −40.
- **Order:** re-measure after C2-2, because flat roofs change the counts.

**C2-8 Karl the Fog** (`world/sf/fog.ts`):
- `patchFog(shader)` is a string replace of `#include <fog_fragment>` per material. **Never touch `THREE.ShaderChunk`**: Little Bay shares three.
- Uniforms `uKarl*`, blended as 1 − (1 − fog)(1 − karl).
- Time table: morning 1, day 0.15, golden 0.6, night 0.35.
- CloudBank: 40–80 cluster instances on one TOY_INST InstancedMesh (≈ 8–11k tris). They slide in over Ocean Beach → Sutro → Twin Peaks in the morning, and through the Golden Gate at golden hour.
- Apply to GROUND, TOY, TOY_DYN, TOY_INST, hero and water, plus a sky band.
- District keeps `uKarl = 0`.
- `?karl=` flag in `WorldScene.tsx`.

- **Depends on:** nothing hard. Soft: D2 (SiteHooks, AI material, hide), F (life pause), G1 (may import `look.ts` for the canvas map).
- **External:** Terrarium tiles (reachable); owner taste review; the owner's GPU and phone for perf; no Higgsfield needed.
- **Defects routed here:**
  - CS-1, CS-2, CS-3, CS-5, CS-11 (boards), CS-12, CS-14;
  - CS-6 (`warmup.ts`), CS-7 (WorldScene monitor);
  - CS-4 (keep the player's own chunk resident whatever the focus);
  - HC-2 (lazy city chunk).
- **Key risks:**
  - Flat roofs raise L0 triangles unless the cheap variant lands together with the remap.
  - A white/pastel city under haze loses contrast: tune fog and palette on the same contact sheet.
  - Shader edits also change district programs. The hero test pins geometry, not pixels, so district before/after shots with Karl 0 are mandatory.
  - New variants (OB_MAP, USE_BATCHING_COLOR, Points) need warm-up.
  - `groundRaster` rises to walkable bridge decks.
  - The high-view target needs F13 too.
- **Tests:**
  - `sf-look`: over all 194 chunks, flat ≥ 80 % and gable ≤ 10 % in allowed zones only; wall lightness ≥ 0.78 except brick/industrial; orange far roofs ≤ 5 %; L0, L1 and L2 colours agree.
  - `sf-atmos`: `cityFogK` table (walk = 1); `ShaderChunk.fog_fragment` byte-identical; CloudBank ≤ 12k tris; light field ≥ 10k points.
  - `sf-boards`: round trip; GGB north end within 0.3 u of 15.2; Hawk Hill ≈ 43 ± 4 u; ≤ 40k tris.
  - `sf-stream` extensions: densest cells ≤ 18,500 after the remap; `radiiFor` table; ground = rasterHeight − sink; seam pre-filter; estimated Twin Peaks high-view triangles ≤ 400k.
  - The worker-safe import test still passes.

### 5.5 Lane E2: movement follow-ups

**State:**
- `followPath()` plans with `findPath` (`controller.ts:551-593`), which clamps the goal to the 384 u window. `routeTo` and `RouteWalker` (`nav.ts:465-526`) are unused.
- BAYBAY uses `findPath` only.
- Tap-to-drive doesn't exist: `onGroundClick` returns when carried (`system.ts:378`).
- `RouteSearchOptions` has no edge filter.
- `chooseYaw` and the transit rig are tied to the Embarcadero frame and `platforms.get('streetcar')`.
- Occlusion ignores `Blocker.top`.
- Glide tall structures:
  - the list is captured once (`moveSystem.ts:499-502`), so later `setTallStructures` calls are ignored;
  - there is no Bay Bridge;
  - landing uses `nearestWalkable`, not `arrivalSpot`.
- Pelican: the standing GLB is tilted, so the legs dangle.
- Touch has no hop button.
- Transit hop-off teleports with no brake.
- Gamepad A never increments `interactCount`, and View is not mapped.
- City rides are district spots only; the city has 30 bike racks and 141 benches in chunk props.

| id | task | size |
|---|---|---|
| E2-0 | Day-0 contracts: `requestPlatformStop` / `platformStop` / `releasePlatformStop` (world cars brake to 0 within 1.2 s); optional cable-car running boards and `hangLean`; new `actors/moveApi.ts` (driveTo, cancelDrive, requestHopOff, toFoot, fleetSnapshot / restoreFleet, glideUnlocked), bound at mount so UI never imports the ActorSystem; `input.hopOffCount`. | S |
| E2-1 | Long click-to-walk: over LOCAL_ROUTE 150 u (or when `findPath` snaps), run `routeTo` with an abort token. Walk the clamped path while pending, then follow a `RouteWalker`. Re-route after 3 stalls. Breadcrumbs trace the route. District stays `findPath` only, byte-identical. | M |
| E2-2 | BAYBAY lead/follow over long routes (`guide.ts`), same pending/fallback/abort pattern; keep the > 60 u hop-in. | S |
| E2-3 | `driveRoute(from, to, 'car'\|'bike')`: graph A* with an edge filter (car: street + service; bike: + pedestrian + path, never steps). District: grid A* with a lazy drive mask (spec.surfaces, hull clearance 0.55 / 0.35). Needs `edgeAccept` in `walkGraph.ts` or a private A* (5.1). | M |
| E2-4 | Tap-to-drive: pure `actors/vehicles/autopilot.ts` PursuitDriver. Details below the table. | L |
| E2-5 | `actors/viewField.ts preferredViewDir(x, z)`. Hero slab: today's rule, unchanged. City: a lazy 16 u openness field (16 directions at 24/48/96 u, water +, lower ground +, roofs above the eye line −). Used by `chooseYaw`, the transit side and the sit rig. | M |
| E2-6 | City camera. Details below the table. | M |
| E2-7 | Glide world: a live tall-structures getter (fixes the stale capture); terrain bases from `landmarkBase` / `far.landmarks`; Bay Bridge 4 towers + deck circles; a 64 u bucket hash; city landing via `arrivalSpot`. | M |
| E2-8 | **Pelican that reads as flying**: procedural `buildPelicanRig()`, one skinned mesh ≤ 3.5k tris. Details below the table. | L |
| E2-9 | Touch 跳/Hop button (56 px) with a held jump; `touchJumpHeld` in `pollInput`. | S |
| E2-10 | Transit hop-off brakes first: `'braking'` until speed < ALIGHT or 1.2 s, then `'alighting'` 0.4 s; `requestPlatformStop`; alight at a clear door slot; a small camera lurch. The wait stays instantly cancellable. | M |
| E2-11 | Gamepad: A also does `interactCount++`; View → map; prefer `mapping === 'standard'`; ignore L3 while the stick is past 0.94; optional rumble; mapping table in the `input.ts` header; node test with a stubbed `getGamepads`. | S |
| E2-12 | City bike racks and benches. Details below the table. | M |
| E2-13 | Crest pant by climb height: ≥ 6 u rise at g > 0.2, fires at the crest, 45 s cooldown. The Filbert Steps fire once. | S |
| E2-14 | Vehicles near non-resident chunks: `pending(x, z)` (standAt −1) caps speed at 0.3·vmax, with no 'edge' bump. **Extend to the walker (CS-4):** treat standAt −1 as unknown in `controller.ts` step 9 (pause the stuck timer, no unstick). | S |
| E2-15 | Save v2 hooks for G1 (`fleetSnapshot` / `restoreFleet`, `isRiding()`). | S |
| E2-16 | (optional) `registerObstacleSource` for F's crowd and traffic (or F's `movers` array, 5.1). | S |

**E2-4 tap-to-drive** (PursuitDriver):
- Look-ahead Ld = clamp(3 + 0.4v, 4, 8).
- Corner speed caps: 1.9 / 3.3 / 6 u/s for the car; a bike table scaled to vmax 9.
- Arrival radius 1.5 u.
- Stuck handling: back up 1 s, retry once, then give up with a line.
- Any manual input cancels it.
- `onGroundClick` while riding → `move.driveTo`.

**E2-6 city camera:**
- `heroPoints()` in city mode adds the GGB towers, Sutro and Salesforce; district stays 3 points (test).
- `cityZoneViews()` from `SF_LANDMARK_INFO` photo poses.
- Occlusion reads `Blocker.top` (`camera.ts` and `cameraModes.ts:160`).
- Glide distance/pitch tuning.
- No per-frame allocations.
- The transit rig looks up `platforms.get(move.line)`.

**E2-8 pelican:**
- Long body, head drawn back, bill forward, feet tucked.
- Bones compatible with the flap and bank code.
- Rider and BAYBAY seats move with it.
- Fallback via Higgsfield (5.3) only if the owner or lead finds the procedural read weak.

**E2-12 city bike racks and benches:**
- Offline `scripts/opus-sf/ride-spots.ts` → generated `data/sf/rideSpots.ts`, each spot verified with `poseCheck`.
- A pool of ≤ 4 extra bikes within 120 u, recycled beyond 160 u.
- `syncRideables` keyed by id, not index.

- **Depends on:**
  - F honours the stop request in world cars; cable-car platform ids equal `move.line`.
  - G1 switches `Hud.tsx:349` to the hop-off request.
  - The lead decides on `walkGraph.ts`.
- **External:** SwiftShader shots with eval-staged runs; the owner's pad, phone and GPU; optional Higgsfield (E2-8 fallback, about 30–50 credits) and headless bpy.
- **Defects routed here:** DR-1 (MoveChip checks `flow.ride.stage`), DR-5, CS-4 (walker side), CS-10, and the pelican warm-up for CS-6.
- **Key risks:**
  - Async routes in a synchronous controller (races, stale legs).
  - Pure pursuit on 3.6 u streets.
  - District camera regressions: gate everything on `worldMode`.
  - `moveSystem.ts` (882 lines) is touched by 8 tasks: one implementer, or split it first.
- **Tests:** new `tests/opus-bay-sf-move2.test.ts`:
  - long walk 400–1,800 u with no stall over 3 s;
  - drive routes never use steps;
  - pursuit cross-track < 0.8 u at a 90° corner;
  - view field on Ocean Beach looks west;
  - city `heroPoints`;
  - glide stale-array regression;
  - transit brake FSM;
  - stubbed gamepad;
  - pant rule;
  - ride spots pass `poseCheck`;
  - pelican rig: 1 draw, ≤ 3.5k tris, feet tucked;
  - pending-chunk speed cap.

### 5.6 Lane F: transit, life and audio

**State:**
- `public/opus-bay/sf/v1/transit.json` has 4 lines:
  - powell-hyde: 456.3 u, 28 stops;
  - powell-mason: 345.5 u, 23 stops;
  - california: 319.9 u, 18 stops, double-ended;
  - f-line: 1135.8 u, 45 stops, most duplicated per direction.
- Stop names are English only.
- Measured:
  - cable paths lie on `road` 94–100 % of the way;
  - path y vs ground: p95 0.11–0.17 u, max 0.39 u;
  - max grade 0.43 (Mason);
  - the Powell lines share 0–160.8 u and cross California at Powell & California;
  - the Taylor & Bay turntable is inside the hero slab.
- `game/ride.ts` and `world/streetcar.ts` are district-only.
- `audio/logic.ts buildShoreField` assumes the Bay is north.
- `life.ts` has no distance gate.

| id | task | size |
|---|---|---|
| F0 | Verify the day-0 shims (5.1: store riding, events, flow ride section → `game/transit.ts`, flowStore, interactables hook, obstacles); tsc + 200 tests. No `world.ts` edit: `Streetcars` already has an entry point there. | S |
| F1 | Pure `data/transit.ts`. Details below the table. | M |
| F2 | Pure `world/transitLine.ts`. Details below the table. | L |
| F3 | Procedural toy cable car (`world/cablecar.ts`, TOY_INST): 5.6 × 2.0 × 2.6, open ends with outward benches, running boards at x ±1.25, baked gripman, night lamps, ≤ 3k tris. 2 cars on each of the 3 lines, hidden beyond 300 u. Reference: `postcards/sf-cable-car-hill-1200.webp`. | L |
| F4 | Turntables (`world/turntable.ts`) at Powell & Market, Hyde & Beach and Taylor & Bay. Details below the table. | M |
| F5 | Rails and cable slot (`world/rails.ts`): per resident chunk, `heightAt + 0.02`, ≤ 1 chunk rebuilt per frame; none at L1/L2. | M |
| F6 | Line-generic rides. Details below the table. | L |
| F7 | F-line to the Castro: `new Streetcars()` with no argument keeps today's loop (tests pin it). City mode splices the hero track to Market St → 17th & Castro with a turnaround loop and 4 cars. Keep platform id `'streetcar'` and the `runtime.streetcar` mirror. | L |
| F8 | Ferry v1 (`world/ferry.ts`). Details below the table. | M |
| F9 | Platform contract (if F owns `platform.ts`, 5.1): `pitch` (a 0.4 rad car otherwise puts the rider up to 1.1 u off), `kind`, `railMirror`, `railLean` 12°, deck rects. | S |
| F10 | City audio. Details below the table. | L |
| F11 | Crowd (`world/sf/crowd.ts`): 64 instanced walkers on sidewalks within 90 u, hopping aside when a vehicle is predicted within 1.2 u; people material exported from `life.ts`. | M |
| F12 | Toy traffic (`world/sf/traffic.ts`): ≤ 24 instanced cars within 220 u on road edges, 5–9 u/s, 4 u queue gap, yields to the player and to transit. | M |
| F13 | **Pause hero life** when more than 300 u from the slab in city mode (routed CS-3: about 38k tris and 9 calls at Twin Peaks). Keep the rideable ferry and the arrival cinematic. | S |
| F14 | `world/transitLayer.ts`, hosted by `Streetcars`: lazy-imports the city modules (keeps GameRoot small, HC-1); update order; budget ≤ 8 calls / 20k tris for vehicles and transit. | M |
| F15 | Tests `sf-transit`, `sf-life`, `audio` (see the Tests line). | M |
| F16 | QA shots (cable car on Hyde, rail and seat, turntable push, F-line on Market and at Castro, ferry deck, Union Square crowd, night, district regression) + report `docs/opus-bay/sf-w2-F.md`. | M |

**F1 `data/transit.ts`:**
- Arc-length tables.
- Stops within 8 u merge into stations with ids `[a-z0-9-]`.
- The shared Powell & Market station.
- Turntable stubs: 2.7 / 11.7 / 5.6 u.
- The Powell 0–160.8 u shared block.
- The Powell & California crossing interlock at 115.4 / 164.7 u.
- The F-line city spec: the hero track + a connector (159.6, 21.5) → OSM ≈ 410 u (146.3, 37.3) → 17th & Castro.
- The ferry route: Ferry Building ↔ Pier 41, fallback Pier 33.
- Constants: cable 9 u/s, grip 3 u/s², dwell 4 s, `RIDE_MIN_ODOMETER` 150.

**F2 `world/transitLine.ts`:**
- Cable mode and streetcar mode.
- Block signalling; passing at stops ±1.05 u.
- Double-ended reversal and turntable hand-off.
- The waiting-rider dispatch.
- Pose with pitch and roll.
- Ground snap to `heightAt` when resident.
- Platform publish and a `lineState` map.

**F4 turntables:**
- The disc is drawn 0.005 u above the static one, with r + 0.02.
- A 180° turn takes ≈ 9 s.
- "Help push it round" by mashing E on foot (+14°/s per press, about 3.5/s cap by the 280 ms debounce).
- A 3D progress ring, crew figures, BAYBAY cheer and bell.

**F6 line-generic rides:**
- `RideState {line, kind, odometer, counted}`.
- A ride counts only at another station with odometer ≥ 150 u (see owner question 2). Travel mode never counts.
- `boardAt`, `rideTo`, `requestHopOff` (1.2 s brake), `finishRide`.
- `transitInteractables()` in city mode only.
- `rideLabel()` for the HUD.
- The H bell.
- A DEV `__opusBay.transit` hook.

**F8 ferry v1:**
- A walkable open sun deck (about x ±1.5, z −3.5..1.5 at floor ≈ 2.6).
- 9 u/s; roll 0.02·sin(0.9t).
- Platform `'ferry'`, spot `'deck'`.
- Life ferry 0 becomes rideable after the arrival cinematic.
- Sausalito waits for C2's Marin board (owner question 1).

**F10 city audio:**
- `buildShoreField({bounds, cell, isLand})`; the district path keeps the old fill.
- A windowed field (± 256 u, rebuilt after 96 u of movement).
- Ocean Beach surf, park birds, a Mission street-music hint.
- Cable hum near cable streets.
- The foghorn from the real GGB direction.
- Cable-car bell, grip clank, turntable creak, ferry horn and engine.
- `audio/README.md`.

- **Depends on:**
  - the day-0 shims;
  - E2 consumes pitch, kind, mirrored rail, the ferry deck spot, the braked hop-off and the obstacles;
  - G1: `rideLabel` in the Hud, transit icons, map lines, save v2 `rides`, the `travelEpoch` anti-cheat;
  - G2: goal keys and gripman/deckhand/BAYBAY lines;
  - D2 (optional): the turntable disc flag;
  - C2 (soft): Karl level, the Marin board.
- **External:** all data is in git; synthesized audio by default; optional generated SFX (5.3); owner questions 1–2.
- **Defects routed here:**
  - DR-1 (set `move 'transit'` only when the car arrives; the ride section moves to `game/transit.ts`);
  - DR-5 (car body; with E2);
  - CS-3 (F13);
  - HC-1 (F14 lazy imports).
- **Key risks:**
  - Single track on 3.6 u streets vs a 2.0 u car.
  - Height mismatch up to 0.39 u.
  - Steep pitch without E2's consumer side.
  - The Taylor & Bay tail and California 0–71.8 inside the hero.
  - The Pier 41 berth near the K-dock floats.
  - The draw budget: everything instanced.
  - District tests pin `new Streetcars()`.
  - The shared-file contention is solved by F0.
- **Tests:**
  - 4 lines build; station dedupe; ids match `/^[a-z0-9-]{1,64}$/`; turntable stubs within 0.1 u.
  - Cable speed 9 ± 0.01; Powell–Hyde 51 ± 5 s; 10 simulated minutes with no block violations; dispatch within 5 s.
  - Turntable ≈ 9 s unpushed.
  - Platform pitch maths.
  - The odometer rule.
  - The splice connector clear of hero blockers.
  - Ferry route over water with 3 u clearance.
  - Crowd and traffic invariants; the hero-life pause.
  - The `isLand` shore field.
  - Existing world and flow tests unchanged.

### 5.7 Lane G1: map, discovery, fast travel, save v2, HUD

**State:**
- Lane E's requests #1, #3, #4 and #6 are already in the code.
- The HUD neighbourhood is wired (`brain.ts:40-51` → `zoneAt`), and the city check confirms it (no more "The Embarcadero").
- No street name exists yet. The data is in `RoadSet.nameIdx` and `far.lines` / `far.names`.
- `MapPanel.tsx` is district-only SVG, and `navigateTo` resolves only interactables.
- `places.json` has 1,027 places (69 curated, 71 hero, 37 with `graphNode −1`, 33 of them on YBI/TI). Nothing loads it yet.
- 7 of the 24 landmark registry ids differ from `places.json` ids.
- No discovery, fast-travel, save v2 or zone module exists.
- `qa.ts` limits `?at=` to `[a-z0-9-]`.

| id | task | size |
|---|---|---|
| G1-0 | Day-0: extract `MoveChip` into `ui/MoveChip.tsx` (→ E2 owns it). | S |
| G1-1 | `data/sf/places.ts`: load `places.json` on idle after `far`. Merge hero places into POIs (25 u, same kind/name). Match the 24 landmarks by OSM id, then nearest curated ≤ 40 u; synthetic otherwise. Arrival via `landmarkToWorld`. `walkable = graphNode ≥ 0 \|\| hero`. 64 u buckets; `placesNear`, `searchPlaces` (zh/en). | M |
| G1-2 | `data/cityZones.ts`: `AREA_NAMES` moves here (re-exported from `brain.ts`); `zoneName` (hero → 41 DataSF → 旧金山); label anchors; rings for the map fog. **Also CS-8:** inside a landmark radius, show the landmark or area name. | S |
| G1-3 | `data/save.ts`: save v2 `opus-bay:save:v2`, decoded as untrusted input. Details below the table. | M |
| G1-4 | `game/discovery.ts`: discovery at 12 u, at 4 Hz, skipped in travel mode; `stamp` event + gold toast (≤ 1 per 4 s); `visitZone`; `onDiscover` / `onZoneVisit` hooks for G2; `?discover=all`. | M |
| G1-5 | `ui/CityMap.tsx` + pure `ui/cityMapDraw.ts`. Details below the table. | L |
| G1-6 | `MapPanel` city branch (district SVG unchanged). The place list has search and a curated filter. `ui/PlaceActions.tsx`: 飞过去 / 带我去 (hidden when not walkable) / 骑车去·开车去 (a rideable within 60 u) / 详情 (`openPanel('poi','sf:<id>')`, G2's card) / Maps link. | M |
| G1-7 | `game/fastTravel.ts` 飞过去 (plan §6.7). Details below the table. | L |
| G1-8 | 带我去 over the graph: `takeMeTo` → `routeTo` polyline + honest time label; `mapTarget = place:<id>`. Until E2-1 lands, feed `pathTarget` leg by leg at 2 Hz, then drop that code. 骑车/开车去 → `moveApi.driveTo`. | M |
| G1-9 | HUD street name (`game/streets.ts`, 2 Hz): nearest named road within 6 u from the chunk RoadSet (main-thread `fetchChunk`, ≤ 1/s, LRU 6), `far.lines` fallback, 1.5 u hysteresis; district uses `DISTRICT.roads`. | M |
| G1-10 | 继续上次的位置: a title button (imports only `data/save.ts`, keeping the 15.7 KB title chunk) → `game/resume.ts` (focus, `whenReady`, `arrivalSpot`, teleport, `beginPlaying('local')`); Settings reset clears v2. | M |
| G1-11 | Journal 足迹 tab (`ui/Footprints.tsx`); counts 地标 x/69 · 地点 n · 街区 z/41. Mounted by the Journal owner (5.1). | S |
| G1-12 | `qa.ts ?at=` accepts place ids, SF landmark ids, `ll:<lat>,<lng>` and `xz:<x>,<z>`; city `QaBridge` path with `whenReady` + `arrivalSpot`; `?save=off`; the debug line adds warm-up ms and "+N programs since warm-up" (M0 request) and fixes the stale tier (CS-7). | S |
| G1-13 | `travel.ts` clean-ups: import `WALK_SPEED`, `unprojectCity`, labels for SF places. | S |
| G1-14 | Tests `sf-places`, `sf-save`, `sf-discovery`, `sf-travel`, `sf-citymap`; keep `flow-brain` green. | M |
| G1-15 | Screenshot QA: HUD at Market & Powell, Mission, Sunset, waterfront; the map at city and street zoom, fog before/after, mobile; a fast-travel contact sheet; resume; ?debug; calls with the map open vs closed. | M |

**G1-3 save v2:**
- ≤ 64 KB, version 2.
- Ids `/^[a-z0-9:-]{1,80}$/`, ≤ 2,000 discovered, ≤ 64 zones.
- Finite numbers only; positions clamped to the world bbox or dropped.
- Writers: the `lastSafe` sampler every 3 s, the vehicles snapshot, glide mirror, `noteRide(lineId)`.
- A debounced 1 s write plus a flush on pagehide.
- Progress v1 is untouched.

**G1-5 city map:**
- Canvas drawing of `far.obc`: sea, land, parks, 4,692 blocks, lines, zone borders, paper fog over unvisited zones; ≤ 20 ms at 1,536 px.
- Pan, wheel and pinch zoom from 0.8 to 18×.
- An SVG overlay: player, BAYBAY, rideables, discovered places, route, transit lines.
- The ODbL credit.
- An optional painted base layer from H2b (`MAP_FRAME`, 5.10).
- DEV `exportPng` for H2b.
- Styles in `ui/city-ui.css`.

**G1-7 fast travel:**
- Flow: move `'travel'` → `focusOverride = dest` → shots (pickup 0.8 s, rise 1.0 s, pan clamp(d/400, 0.6, 3.5) s with a cloud cut beyond 1,400 u, hold until `whenReady` or 8 s) → teleport to `arrivalSpot` → 1.2 s descent.
- Exports for other lanes: `travelActive`, `travelEpoch` (anti-cheat), `travelPose` for E2's pelican.
- Needs an additive `Shot.until` in `cinema.ts`.

- **Depends on:**
  - E2: long routes, `travelPose` carry, `driveTo`, fleet restore. Soft: G1 has fallbacks.
  - C2: a stable `CityStreamer` API and far v1 format.
  - F: `noteRide`, `travelEpoch`.
  - G2: the `sf:` card, lines on `onDiscover`.
  - The day-0 one-liners.
  - H2b needs G1's map frame and export.
- **External:** none beyond the dev server and SwiftShader; the owner's phone for map smoothness.
- **Defects routed here:**
  - DR-3, DR-4;
  - CS-7 (debug line), CS-8;
  - CS-14 (fast travel and resume must await `whenReady`);
  - HC-5 (places loader on idle).
- **Key risks:**
  - File ownership collisions (resolved in 5.1).
  - The title-chunk budget.
  - Main-thread chunk decode for street names (`/opus-bay/sf/**` has no immutable cache header, and `vercel.json` is not an Opus Bay file).
  - Forgetting to clear `focusOverride` (it triggers CS-4).
  - Canvas memory on iOS.
  - `DEFAULT_WORLD_MODE` is still district, so everything must degrade cleanly.
- **Tests:**
  - All 24 landmarks resolve; walkable false for exactly the 37.
  - A fuzz corpus never throws in the save decoder.
  - 11.9 u discovers, 12.1 u does not.
  - Fast-travel phase durations with a fake clock.
  - `?at=` parsing.
  - The canvas op budget with a recording context.

### 5.8 Lane G2: city content

**State:**
- `SF_LANDMARK_INFO` has 24 verified records, but nothing shows them: no POI, card or interactable.
- The 12 SF postcard artworks are shipped (`SF_POSTCARD_ART_IDS`) with no `PostcardDef`.
- Every "all postcards" check uses `s.postcards.length` vs `POSTCARDS.length`, so a save shared across modes would show 12/8.
- 6 resident portraits are shipped.
- `FREE_GOALS` completion matches substrings of `GOAL_WORDS`, so new ids must avoid 'ride', 'view', 'hill', 'card', 'photo', 'market'.
- zh names disagree between files: 双子峰 vs 双峰, 码头区 vs 马里纳区, 叮当车 vs 缆车, 卡斯特罗 vs 卡斯楚区.
- The cable-car guide link is month-tagged (October 2026), so it goes stale in November.

| id | task | size |
|---|---|---|
| G2-0 | `data/contentMode.ts` (`CONTENT_MODE = readWorldMode()`, `byMode`) plus explicit `DISTRICT_*` / `CITY_*` exports with resolved values that existing consumers keep importing. `contentFor(mode)` for tests. City map entries never merge in district mode. **Fixes CS-9.** | S |
| G2-1 | 24 landmark info cards (`data/sf/cityPois.ts`). Details below the table. | M |
| G2-2 | The 12 SF postcards (`data/sf/postcards.ts`), each with a sourced fact and a hint (zh ≤ 45), at city spots. Details below the table. | M |
| G2-3 | Count only the active mode's postcards (`activePostcardCount` / `allPostcardsFound`) in `flow.ts:728-746`, `Hud.tsx:146,183-190`, `Journal.tsx:25-28`, `Moments.tsx:79-80,225,258`. | S |
| G2-4 | BAYBAY event and neighbourhood lines. Details below the table. | L |
| G2-5 | City goals (`data/sf/goals.ts` + `game/cityGoals.ts`): postcards (20), cable-car (a real ride, never fast travel), twin-peaks (summit on foot, bike or car), golden-gate (deck crossing from local x ≤ −89 to ≥ +89 at y > 12; tower to tower until C2's Marin board), painted-ladies, neighbourhoods (8 of 41), plus Coit `viewpoint`. Waypoint targets via `content.goalTargets()`. | M |
| G2-6 | Six fictional residents with small tasks (`data/sf/residents.ts`, `dialogue.ts`, `game/residentTasks.ts`; state as `goalsDone` prefixes `task-on:` / `task:`). Details below the table. | L |
| G2-7 | Resident bodies (`actors/residentLooks.ts` from the exported primitives in `models.ts`); `npcs.ts` optional `at` / `build`; hidden beyond about 160 u. About 2–3k tris each. | M |
| G2-8 | City onboarding copy: dependency-free `data/sf/copy.ts` (title subtitle), `intro.hello.city` (same 4 choices), `CHOICE_SUBS` "全城 20 张明信片 · 叮当车 · 双峰", free/local intros, `guide.edge.city`. | M |
| G2-9 | `data/VOICE.md`: city voice, resident voices, event-line rules, zh glossary (双峰, 唐人街, 叮当车 in dialogue, 要塞公园, 码头区 vs 马里纳区 matched to the HUD). | S |
| G2-10 | Tests `sf-content`, `sf-lines`, `sf-tasks`; pin `opus-bay-content.test.ts` to `DISTRICT_*` before the default flips. | M |
| G2-11 | 邻居的小忙 list in GoalsCard and the Journal (if G2 owns them, 5.1). | S |
| G2-12 | Freeze `BARK_SCRIPT` for H2b; QA shots; calls and tris with residents in view; report `docs/opus-bay/sf-w2-G2.md`. | S |

**G2-1 landmark cards:**
- The world position comes from `landmarkToWorld(arrival)`, radius 4.
- Planner and guide ids are copied only if they exist. Month-tagged guides fall back to `san-francisco-guide`.
- Licensed site photos (`src/data/sf-landmark-photo-assets.json`, about 15 landmarks) are reused read-only.
- Kind `'info'`, never `'viewpoint'` (that runs the Coit-only sweep).
- `bark = info.bark`.
- zh glossary overrides (双峰…).
- The `subjectFact` fallback.

**G2-2 postcard spots:**

| card | spot |
|---|---|
| GGB overlook | (−684.8, 670.4) |
| Alamo Heights | (−2, 593.6) |
| Palace lagoon | ≈ (−405, 425) |
| California & Powell | (36, 191.8) |
| Grant Ave | (35, 142.8) |
| Lombard top | |
| Clarion Alley | (261.4, 606) |
| Dolores Park | (242, 698) |
| windmill garden | |
| Civic Center | ≈ (110, 418) |
| Twin Peaks summit | |
| Ocean Beach | (−431, 1475) |

City mode has 20 cards. `POSTCARD_FOR_POI` moves to `data/postcards.ts`.

**G2-4 BAYBAY lines:**
- `data/sf/lines.ts`:
  - `EVENT_LINES` (first bike/car, hard bump only, first hill, crest hop, glide start/land/no-landing, pant, stairs refuse, cable-car bell and first ride);
  - about 20 authored `NEIGHBOURHOOD_LINES` plus a name template;
  - `BARK_SCRIPT` for H2b.
- `game/baybayLines.ts`:
  - 60 s per key, a global gap of at least 8 s;
  - never over a visible bubble;
  - silent during dialogue, cinematics and travel;
  - zone lines held during glide.

**G2-6 residents:**

| resident | place | task |
|---|---|---|
| gripman | Powell & Market turntable | ride one real stop (needs F) |
| baker | Grant Ave inside the Dragon Gate | deliver egg tarts to the gripman |
| muralist | Clarion Alley | find the `sf-mission-murals` card |
| gardener | Conservatory Valley | check on the windmill garden |
| ranger | Crissy Field | walk out to the GGB south tower |
| record-store owner | Haight & Ashbury | climb Twin Peaks |

First names only, no business names.

- **Depends on:**
  - E2's 3-line resident hook in `actors/system.ts`;
  - F's `transit` ride/bell event;
  - G1 owns `flow.ts`, `Systems.tsx`, `qa.ts`, `Hud.tsx` and `TitleScreen.tsx`, so G2 hands over patches;
  - D2's final arrival poses (spots re-validated after D2);
  - C2's Marin board for the full GGB goal.
- **External:**
  - Web access to verify new facts: Dolores Park, the mural alleys, Ocean Beach, cable-car fare/bell, Haight history, tulip season, Crissy Field. Without it, only already-verified facts are used.
  - Higgsfield only through H2b (< 5 credits).
- **Defects routed here:** CS-9, CS-8 (glossary part), and the city glint heights in `Systems.tsx` (patch to G1: postcards on hills would float or sink).
- **Key risks:**
  - Mode resolution at import time vs tests.
  - Chatter pile-up.
  - Spots breaking if D2 moves landmarks: validate in node with `sfDisk` + `arrivalSpot` + graph reachability.
  - Stale month-tagged links.
  - The title chunk must not import `script.ts`.
- **Tests:**
  - 12 postcards with files on disk; 24 POIs with valid ids and no stale guides.
  - Every city spot stands and is reachable from `ferry-gate`.
  - The dialogue graph resolves (zh ≤ 45, no key hints).
  - `contentFor('district')` equals v1.
  - `goalKeyOf(id) === null` for the new goals.
  - Detectors with synthetic input.
  - Task state machines.
  - Line cooldowns with a fake clock.
  - Glossary vs `far.zones`.

### 5.9 Lane D2: landmarks in context, AI mesh swaps, house kit, three routes

**State:**
- `sites.ts` builds one merged TOY mesh per landmark with no hook for GLBs, plaza meshes or dressing.
- There is no DRACOLoader anywhere; `world/models.ts` does not exist.
- SF_KIT (11 GLBs + masks, all Draco + WebP, origin at the ground centre) is **not registered**.
- SF_MODELS `landmarkId`s use sf-data ids.
- Proportion mismatches:
  - rotunda GLB 12.66 u vs an 8.2 u platform (needs xz ≈ 0.65);
  - Dragon Gate GLB 9.6 u wide (scale 0.9–1.0 works);
  - Conservatory z ≈ 0.8;
  - Painted Ladies AI houses are 3.8–4.2 u wide vs 1.5 u toy lots (an x-squash of about 0.35, risky).
- Exclusions clip city streets; the Dragon Gate cuts Grant Ave.
- Plazas are 0 % of the area around 20 of 23 T1/T2 landmarks.
- Route gaps in curated places: R1 208 u, **R2 315 u** (Fort Point → deck), **R3 387 u** (Stow Lake → windmill); the G5 limit is 225 u.
- **The CDN and bpy both work in the cloud now**, so the 8 raw SAM landmark meshes can be processed.

| id | task | size |
|---|---|---|
| D2-01 | Day-0 registry contract (`landmarks/index.ts`): `swap?` (model parts with transform, tint, glow, fallback), `dress?` (ground polys, props, `plazaSpots`), `WalkBlocker.top?`, `tall?`; helpers `landmarkTallStructures`, `sfLandmarkAnchor`, `landmarkPlazaSpots`. Landmark modules stay declarative (no loader imports: `moveSystem.ts` and node tests import them). | S |
| D2-02 | `world/models.ts`: shared GLTFLoader + DRACOLoader (`SF_DRACO_DECODER_PATH`), `preloadDraco`, cached `loadModel` / `loadMask`, LRU dispose; node-safe. | M |
| D2-03 | `world/modelMaterial.ts`. Details below the table. | M |
| D2-04 | Register SF_KIT in `data/assets.ts` (size, tris, bytes, styles, tint key, fit); style map (victorian → stick-victorian or queen-anne-corner, edwardian → edwardian-flats / richmond-flats, sunset → sunset-doelger, …); fix `SF_MODELS.landmarkId` to registry ids; add to `listAssetUrls`. Before H2b edits the file. | S |
| D2-05 | Take over `sites.ts` (5.1): mount/unmount swap and dress, a per-landmark `makeHeroMaterial` fade (existing program; removes the dither holes under the gate and rotunda), Draco preload, AI counts, the kit-swap tick. | M |
| D2-06 | AI hero swaps: rotunda (xz ≈ 0.65, arches ≈ 1.6 u, pier blockers re-authored), Dragon Gate (0.9–1.0, blockers on 4 pillars keeping ≥ 2.2 u clear, procedural lanterns and lions kept, a Grant Ave strip through the exclusion), Conservatory ([0.9, 1, 0.8], mask glass at night). **Decision gate per landmark** in SoloView: keep procedural if the AI version reads worse. | L |
| D2-07 | Painted Ladies AI row prototype ([0.4, 1, 0.85] at 1.6 u or [0.5, 0.95, 0.85] at 1.9 u), shipped only if it beats the procedural row at 64 px and golden hour. Otherwise victorian-a/b become Alamo/Haight kit houses. | M |
| D2-08 | Near-player kit swap (`world/sf/kitSwap.ts`, `l0index.ts`). Details below the table. | L |
| D2-09 | Landmark settings: plaza GROUND meshes, street strips where exclusions clip streets, crosswalks, street furniture (new `kit.ts` helpers), exclusion tweaks. Before/after shots at golden and night; checks 5–6. Details below the table. | L |
| D2-10 | Blocker tops and tall structures (GGB legs 42.2 u, Sutro r ≈ 6, City Hall dome, rotunda, Grace, de Young, Oracle, Legion, windmill); E2 switches `moveSystem.ts:868-881` to the helper. | M |
| D2-11 | Three finished routes in `data/sf/routes.ts`. Details below the table. | M |
| D2-12 | `placeId` on every `SfLandmarkInfo` (7 mappings: golden-gate-bridge → ggb-south-tower, de-young-tower → de-young, painted-ladies → alamo-square-painted-ladies, dragon-gate → chinatown-dragon-gate, peace-pagoda → japantown-peace-pagoda, cable-car-turntable → cable-car-powell-market, lombard-crooked-street → lombard-crooked); plaza names; `sfLandmarkAnchor`. | S |
| D2-13 | SoloView `?solo=<id>&ai=0\|1` plus `?solo=kit` sheet (11 houses × 5 tints + night). | M |
| D2-14 | `scripts/opus-sf/routes-qa.mjs`: teleport every 25 u along each route; landmark-on-screen fraction, calls/tris/programs, JPEGs; AI budget per view ≤ 60k tris, ≤ 12 draws, ≤ 6 shadow casters. | M |
| D2-15 | **(recommended, owner allows credits)** Clean up and publish the 8 raw SAM landmark meshes. Details below the table. | L |

**D2-03 model material:**
- `map`, mask R = night glass, mask G = luminance × tint.
- Synthesized `vInfo`: AO, glow, seed.
- Instanced `aTint` / `aBase` / `aFade`.
- Program keys `ob-model` and `ob-model-inst`.
- `modelWarmupSet()` for `warmup.ts`.
- Requires C2's exported patch helpers (5.1).

**D2-08 kit swap:**
- ≤ 12 instances within 40 u, ≤ 6 distinct models.
- Style, aspect (± 25 %) and slope (≤ 0.8 u across the footprint) filters; 8 u / 1.5 s hysteresis.
- Tint = the L0 wall colour; 0.3 s dither fade.
- Hide the L0 range; release on cell drop.
- Budget ≤ 35k tris, no shadows.
- Needs per-building L0 descriptors (the C2/D2 decision in 5.1).

**D2-09 landmark settings, priority:**
1. Route landmarks: Dragon Gate, Palace, Fort Point, GGB south anchorage (CS-11; messy today), Conservatory, de Young, windmill.
2. The other T1: City Hall, Sutro Tower, Twin Peaks.
3. The remaining T2.

The Palace lagoon side face (CS-13) is part of this task.

**D2-11 routes:**

| route | stops | length now | gap fillers |
|---|---|---|---|
| R1 | Dragon Gate → Washington Sq → Coit | 327 u | Portsmouth Square, Waverly Place |
| R2 | Marina Green → Palace → Crissy → Fort Point → GGB south tower | 916 u | Battery East, Welcome Center / Round House, East Beach, Crissy Field Center |
| R3 | Conservatory → de Young → Stow Lake → windmill → Ocean Beach | 1,208 u | Spreckels Lake, bison paddock, Portals of the Past, Chain of Lakes, Beach Chalet |

- Every stop gets BAYLINK ids.
- Stops go to G1 (discovery), G2 (slots) and F (crowd).

**D2-15 steps:**
1. Get the result URLs with `show_generation_by_ids` (LM1-3D…LM8-3D, `ASSETS-LEDGER.md:282-294`).
2. Download with `docs/opus-bay/kit-jobs/dl.py`.
3. Fix `kit_cleanup.py:39` (Windows Python path) and replace the missing `iou.py` with a silhouette IoU.
4. Plan §8 QA gate.
5. Publish, register and add ledger rows, then swap like D2-06.

The meshes: Legion, Ghirardelli, Fort Point, Mission Dolores, Castro, windmill body (sails stay procedural), Grace, City Hall. Retakes cost 1–5 credits each.

- **Depends on:**
  - C2: exported shader helpers, the warm-up hook, the L0 per-building index or hide API, the `sites.ts` transfer.
  - E2: consumes `landmarkTallStructures`; long click-to-walk for route QA.
  - G1 and G2: consume routes and `placeId`.
  - F: plaza spots.
  - H2b: sequencing on `assets.ts` and the ledger.
- **External:** SwiftShader shots; D2-15 needs the CDN (reachable), the MCP, bpy (installed) and credits for retakes only; the owner's GPU and phone for texture memory (about 20–35 MB with mips).
- **Defects routed here:** CS-11 (GGB south approach), CS-13, and the gate/rotunda dither holes.
- **Key risks:**
  - The rotunda and Painted Ladies proportions.
  - Walk data reaches the workers once at start, so fallbacks must match the AI layouts.
  - Loader imports leaking into node tests.
  - Kit swap pops or stale index ranges; flat GLB bases on sloped lots.
  - New programs must be warmed.
  - About 23 hand-authored dressings: do the route landmarks and T1 first.
- **Tests:**
  - `sf-models`: files exist; GLB bounds within 2 %; Draco + WebP; size caps.
  - `sf-kit-swap`: cap, radius, hysteresis, hide/restore round trip.
  - `sf-landmarks` extensions: AI bounds inside exclusions, passages clear, `placeId`.
  - `sf-landmark-context`: plaza ≥ 30 u², arrival reachable, walk-around ring ≥ 75 %, street continuity.
  - `sf-routes`: gap ≤ 225 u; BAYLINK ids exist; landmark visible in ≥ 90 % of samples.

### 5.10 Lane H2b: Higgsfield part 2b (map repaint, voice barks, murals)

**State:**
- The CDN is reachable; the upload host is unknown until called.
- `voice.ts` refuses ids that are not in `ASSETS.voice`, plays a clip only once it is decoded, and keeps `zh-yay`, `zh-think` and `zh-arrived` muted (mis-heard).
- There is no city map yet (G1).
- The whole board fits a square frame of about 3,080 u.
- No murals exist.

| id | task | size |
|---|---|---|
| H2b-0 | Day-0 stubs: `data/mapPaper.ts` (`MAP_FRAME` = x −1575..1505, z −972..2108; `MAP_PAPER = null`), `data/voiceLinesSf.ts`, `data/murals.ts` (empty), the `voice-line` event (5.1). Consumers treat null or empty as vector map / chirp / no murals. | S |
| H2b-1 | Free preflight: CDN GET, media_upload + PUT + confirm of a 1×1 PNG (else the `media_import_url` fallback), `pip install imageio-ffmpeg`, start balance and transactions mark. | S |
| H2b-2 | Base render of the whole city from our own geometry (`scripts/opus-sf/map/render-base.ts` + `raster2d.ts`, pngjs, 4×4 supersampling): cream table, board water, land, parks, 5,690 prisms, lines, piers. **No text.** 2048 and 4096 PNGs + a land mask. Independent of G1. | M |
| H2b-3 | T2 generation: 4× nano_banana_pro 4k (base + K6 style ref, 2 prompt variants), 2× seedream_v4_5 high, 1× seedream_v5_pro inpaint; a retake round only if nothing passes. Ledger + transactions after each batch. | M |
| H2b-4 | Register and check (`paper_post.py`). Details below the table. | M |
| H2b-5 | `ui/mapPaper.ts` (`loadMapPaper`, `drawMapPaper` under the vector layers with the vector coastline on top, `?paper=0`) + `ui/MapPaperLayer.tsx`; G1 mounts it in 2–3 lines. | S |
| H2b-6 | Voice line list, about 20 lines + 3 re-records, each ≤ 2 s. Details below the table. | S |
| H2b-7 | Generate with qwen_audio_tts, Pixie preset `0178ef57-…`, the shipped settings, 3 seeds each: about 129 jobs ≈ 1.3 credits. | M |
| H2b-8 | Post-process: trim, two-pass loudnorm −18 LUFS / TP −1.5, AAC 64k .m4a + Opus 48k .ogg. **No ASR here**: an owner listening sheet; keep `MUTED_CLIPS` for rejects. | M |
| H2b-9 | Playback: `voice.line(id, fallback)` (waits up to 700 ms, bypasses CLIP_GAP), idle preload of the current language's lines in city mode, the `voice-line` case, `ASSETS.voice` merge (files owned by F and D2, 5.1). | M |
| H2b-10 | (optional) T4 original Mission murals. Details below the table. | L |
| H2b-11 | Tests `h2b-assets` (voice registry, clips on disk, ≤ 2.2 s; map bounds = `MAP_FRAME`, size caps, coast p95; mural rects) + `asset-files` (every `listAssetUrls()` file exists; nothing checks this today). | S |
| H2b-12 | Ledger part 2b section (plus the dated CDN correction for line 300), `public/opus-bay/README.md`, QA shots, report `docs/opus-bay/sf-w2-H2b.md`. | S |

**H2b-4 register and check** (`paper_post.py`), for each candidate:
- Similarity fit to the land mask.
- **Coast p95 ≤ 1.5 % of the width** (≤ 31 px at 2048).
- Crops read by eye for invented text.
- Grade toward the palette.
- WebP 1024 (≈ 150 KB), 2048 (400–600 KB) and 4096 (desktop zoom, lazy).
- Fill in `MAP_PAPER`.

**H2b-6 voice lines:**
- Mode firsts: bike, car, cable car, streetcar, ferry, glide, hill, crest hop.
- 12 neighbourhood arrivals, with real `far.zones` ids.
- 3 re-records: 好耶！, 嗯…让我想想, 到啦！
- G2's bubble text must *start with* the spoken phrase.

**H2b-10 murals:**
- 8 originals: never a copy of a real mural, no text, no faces.
- An A/B first: gpt_image_2_5 vs nano_banana_pro + K6.
- A 2048×1024 atlas (≈ 250 KB) plus 512 px singles.
- Freestanding Lambert panels along Balmy Alley (449, 641) and Clarion Alley (251, 614), within 300 u, 1 draw call, warmed.

- **Depends on:**
  - G1 for the final paper mount only;
  - G2 for voiced line text and triggers;
  - F for `audio/*`;
  - the lead for the `voice-line` event and the `assets.ts` owner;
  - C2 and D2 for mural mounting.
- **External:** Higgsfield about 60–75 credits (T2 ≈ 30, A1 ≈ 1.3, T4 30–40); the CDN (reachable); the upload host or the committed-image fallback (lead approval); imageio-ffmpeg; no ASR (the owner listens); SwiftShader shots.
- **Defects routed here:** HC-4 (re-encode the 5 hero GLBs with Draco + WebP, or preload them during the arrival cinematic).
- **Key risks:**
  - img2img drift breaks the geo-registration (mitigated by 7 candidates, the similarity fit, the inpaint variant and the vector coast stroke).
  - Invented labels.
  - 4096² is too big for phones.
  - First-time lines go unheard without a preload.
  - Mis-heard voices.
  - Shared files: sequenced in 5.1.

---

## 6. Discrepancies between the reports (resolved here)

- **Worker size.** Lane C's report and the C2 reader say 91 KB gzip; that was a Rollup experiment. The production build gives **56,950 B gzip**, within the 70 KB budget. The C2 risk "worker grows" still stands.
- **GameRoot size.** The F and G2 readers cite 198.6 / 200.09 KB (v1 and M0-era). The build now gives **293.1 KB** (HC-1).
- **Higgsfield CDN.** The old briefs and `ASSETS-LEDGER.md:300` say 403. It works now (CLOUD.md at `1fd93b3`, plus the D2 and H2b readers' checks). The ledger needs an appended correction (H2b-12).
- **HUD label.** Lanes B and C reported "The Embarcadero" everywhere. The code (`brain.ts` → `zoneAt`) and the city screenshots show DataSF neighbourhoods. Only naming nits remain (CS-8).
- **STATUS.md** is stale (HC-8, DR-2). Update it after the §4 perf run, together with the RESUME.md next steps.
