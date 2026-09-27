# Wave 3 · lane C2 report (city look, atmosphere, performance, bundle split)

Worktree `C:/Users/willy/wt/c2`, branch `w3-c2` → `origin/opus-bay`. Dev server port 5201. Scratch (logs, raw shots,
perf scripts with port 5201): `C:/Users/willy/opus-qa/w3/c2/`. Key shots: `docs/opus-bay/qa/w3/C2/`.

## Part a

### 给主人的摘要

- 城市模式在 4 倍 CPU 降速下明显更流畅：三个最密的点（渡轮大厦、唐人街、双峰）走路时从 40–46 帧升到 45–60 帧（同一台机器、安静时段前后对比），全部达到 ≥ 45 的门槛。主要原因是修掉了 three.js 每帧重复查找着色程序的问题（每帧 12–15 次降到 2–4 次），以及每帧不再重算几百个静态物体的矩阵。
- 手机/触屏或高像素密度设备现在默认用"均衡"画质；帧率低于约 50 会自动降一档、这次访问不再升回；设置面板显示的就是实际画质，玩家自己选的画质会被记住。
- 没有 multi-draw 的手机路径在双峰从 51.6 万三角形降到 38 万；唐人街电脑版从 42 万降到 39.3–39.7 万（行道树只放在镜头看得到的地方）。
- 远近两层城市切换时加了 0.3 秒的抖动淡入淡出，不再"啪"地换模型；着色程序数量不变。
- 还剩的几次每帧查找和一次延迟编译属于别的 lane（G1 的地面光圈、F 的海鸥/鹈鹕材质、E2 的 BAYBAY 模型替换），已写成具体请求。

### What was built

The seven tasks touch the same few files, so the code went in as one commit (`69de4be`) plus two follow-ups (`8694832` stream walks, and the prop share 0.6 → 0.5 with this report);
the map below says which part of which file belongs to which task.

| task | files | what |
|---|---|---|
| **P2** program lookups | `world/materials.ts`, `world/warmup.ts`, `world/WorldScene.tsx`, `world/sf/pools.ts`, `world/sf/props.ts`, `world/sf/cloudBank.ts` | three keeps one current program per material instance and re-looks it up (getParameters + cache key) every time the instance is drawn by another object kind. Measured (probe below): TOY and GROUND drawn by plain meshes **and** the BatchedMesh pools (4 lookups a frame), TOY_INST with and without instanceColor (2–4), the shadow pass's single internal depth material for plain / instanced / skinned casters (2–3). New twins with the **same onBeforeCompile and program cache key** (so the same programs, nothing new to compile): `TOY_BATCH`, `GROUND_BATCH` (the pools), `TOY_INST_TINT` (instanced with instanceColor: city trees / lamps, Karl's clouds). `kindSweep(root)` (WorldScene, once a second) puts any object that uses the wrong twin of these C2 materials on the right one (it is what fixes F's tinted dogs / floats today) and gives instanced / instanced-tinted / skinned shadow casters their own `MeshDepthMaterial` (skipped for alpha-tested maps, displacement, clipping, morphs: three clones its own there). |
| **P2** BatchedMesh cost | `world/sf/pools.ts` | `perObjectFrustumCulled = false`, `sortObjects = false` on both pool meshes; the pool culls per item itself (`ViewCull`: one sphere test per item, skipped while the view-projection matrix is unchanged; `setVisibleAt` only on a change). three's per-instance pass (every instance matrix + bounding sphere each frame, ≈ 1,300–1,400 items × 2) is gone: `onBeforeRender` now only rebuilds the draw list on a frame whose visibility changed. |
| **P2** static matrices | `world/builder.ts` `freezeStatic(o)`, applied in `world.ts` (hero chunks, labels, blobs, halos, lamp pools, clock hands, the world root), `sf/stream.ts` (city groups, L0 meshes, the sites group), `sf/pools.ts`, `sf/props.ts`, `sf/cloudBank.ts`, `sf/lights.ts`, `sf/water.ts` | The scene root recomposes its matrix every frame and so forces a matrixWorld multiply on **every** object (319–347 a frame at the spots). Identity-transform statics now have `matrixAutoUpdate = matrixWorldAutoUpdate = false` (only when matrix and matrixWorld are identity): 246–254 recomputes a frame remain (bones, life, actors: other lanes' moving objects). The scene root itself is left alone: F's streetcars / cable-car ring and D2's landmark groups write `matrix` directly and rely on the forced pass. |
| **P2** stream walks | `world/sf/stream.ts` (`8694832`) | `nextAttaches` / `drops` / `applyVisibility` (each a walk over all 776 cells) only run after a worker result, a re-selection, a far-cell drain or a frame that attached / dropped something. `World.update` at the spots 0.45–0.57 → 0.20–0.30 ms (1×). |
| **P3** tile pool culling | `world/sf/pools.ts` (`TilePool`, `mergePoolArrays`, `cullTilePart`) | Each tile keeps its full merged index and the item ranges + spheres; the geometry draws a compacted copy of the items in view (`setDrawRange` + an index-only partial upload, same draw calls). Both paths now draw the same items. |
| **P4 / CS-7** quality policy | `world/quality.ts` (new), `game/GameRoot.tsx`, `world/WorldScene.tsx` | `startQuality({ url, choice, saved, coarse, dpr })` (pure): `?quality=` wins; then the player's own pick (remembered in `localStorage['opus-bay:quality-choice:v1']` when the Settings panel changes the level: any store change that the policy / monitor did not make); a saved `mid` / `low` (automatic levels are session-only, so only a pick saves them); coarse pointer without a fine one, or `devicePixelRatio ≥ 2` → `mid`; else the saved level or `high` (the default `high` is saved on every visit, so a saved `high` proves nothing). `initQualityPolicy()` runs at GameRoot module load, before the canvas mounts, through `setSessionSettings` (the Settings panel shows the real level, nothing is overwritten in the save). The monitor: `MONITOR` (500 ms windows × 8, 75 %), `bounds` = `[50, ∞]` on high, `[30, ∞]` on mid, never on low: it steps down and never back up (the upper bound is unreachable). `declineQuality()`. |
| **P5 / CS-6** warm-up | `world/fx.ts`, `world/warmup.ts`, `world/sf/pools.ts` | The fx particles (`ob-fx`, compiled on the first dust puff = the first walk) are registered with `registerWarmup('c2-fx')`; the pools always carry a colour texture now (C2-10), so the warm-up dummies compile that variant. The Karl cloud bank, light field, props and water programs were already warmed. |
| **P6** Chinatown budget | `world/sf/props.ts`, `world/sf/stream.ts` | City props are chosen for the view: beyond `PROP_VIEW.near` (25 u) of the camera only props inside a copy of the frustum widened by 40° on every side, under half of the caps (`PROP_VIEW.k` 0.5); the selection is redone when the view turns by > 20° (yaw) / 12° (pitch), at most every 0.1 s, and props a turn brings in are placed full-grown (they come in out of sight). `widenedFrustum(camera, deg, out)`. Props at Chinatown 48.8k → 28.5k at k 0.6 (≈ 24k at 0.5), at Twin Peaks 40.6k → 30.4k (at 0.5: 76 round trees, 300 lollipops, 24 lamps in view). |
| **P7** fog split | `world/fogShader.ts` (new), `world/sf/fog.ts`, `world/environment.ts`, `world/world.ts`, `world/sf/cityMode.ts` | Only Karl's uniforms (`KARL`), `KARL_GEO`, `KARL_GLSL`, `patchFog`, `KarlFlag` / `parseKarlFlag` stay in the main graph (materials, the sky and the water need them in both modes). `KarlState`, the time table, `karlTarget` / `karlCover`, `cityFogK` are city-chunk only: `Environment(mode, city?: CityAtmos)` gets `{ KarlState, cityFogK }` from the city module in city mode (`env.karl` is `null` in district). `sf/fog.ts` re-exports the shader side, so existing imports keep working. |
| **C2-10** tier cross-fade | `world/materials.ts` (`TIER_FADE_FRAG`, `tierFadeIn` / `tierFadeOut`, `makeTierFadePair`, `uTierFade` in `COMMON_FRAG_PARS`), `world/sf/pools.ts` (`setFade`), `world/sf/stream.ts` | When a cell switches tier, the incoming tier dithers in over `TIER_FADE` = 0.3 s while the outgoing one stays under the complementary 8×8 Bayer mask (never both on a pixel, never a hole). Plain L0 meshes fade through one of 6 `TierFadePair`s (TOY / GROUND twins with their own `uTierFade`; same programs); pool items through their batching colour's alpha (the colour texture exists from the pool's creation: one `USE_BATCHING_COLOR` variant, warmed). Dropped L0 cells and L1 items that are on screen fade out before they go (`dropL0` / `dropL1`), an item that comes back mid-fade replaces its fading copy. Tile pool: no fade (tiers switch at once). A material that sets no `uTierFade` reads 0 = solid, so D2's model material and district mode are unchanged. |
| known defect | `world/sf/cloudBank.ts` | `tint()` compared the Float32 instance colours with the float64 tint (`===`), so it rewrote all 40 colours and re-uploaded them every frame; it now compares with the last written float64 tint (`tintWrites` counts real writes). |

API for other lanes:

- `materials.ts`: `TOY` / `GROUND` are for **plain meshes** (D2: `sites.ts` keeps exactly what it uses today, TOY and
  GROUND on plain Mesh — nothing to switch), `TOY_BATCH` / `GROUND_BATCH` for BatchedMesh, `TOY_INST` for
  InstancedMesh without instanceColor, `TOY_INST_TINT` with instanceColor. `kindSweep` corrects mistakes within a
  second, but pick the right one. `patchToyShader(shader, { sway, hero?, tier? })`: `tier` is optional (C2-10).
- `builder.ts`: `freezeStatic(o)` for your own world-space statics (identity transform only; it leaves moved objects alone).
- `quality.ts`: `startQuality`, `MONITOR`, `monitorBounds`, `declineFrom`, `declineQuality`, `qualityDecision()`,
  `QUALITY_CHOICE_KEY`.
- `fogShader.ts`: `patchFog(shader, { world? })` for your own non-TOY materials (was `sf/fog.ts`, still re-exported).
- `sf/pools.ts`: `CellPool.update(camera?)`, `setFade(id, v)`, `PoolStats.inView`; `sf/stream.ts`: `TIER_FADE`,
  `CityStreamer.fadingCells`.

### Evidence

**Checks** on the final head of the part (after rebasing on 20 commits of the other lanes): `tsc` 0 errors, `eslint` 0
problems, **371 / 371** opus-bay tests, hero regression and contracts green. New tests: `tests/opus-bay-sf-perf.test.ts`
(10: twins link the same shaders and keys; kindSweep incl. depth materials and the alpha-test exception; ViewCull;
batched pool per-item cull, switch-on re-test, turning; tile pool draws exactly the items the batched pool draws;
index compaction + update range; cloud tint writes only while sliding; view-aware props incl. a 180° turn;
complementary fade dithers at every level; pool fade alpha, solid on reuse, tiles cannot fade),
`tests/opus-bay-quality.test.ts` (6: the start policy table, drei's monitor rule on phone-like and hitchy-desktop
windows, never an incline, the step-down chain). Extended: `opus-bay-sf-atmos` (city Environment with the city
atmosphere, district has no Karl), `opus-bay-sf-budget` (the main-graph guard also forbids `sf/fog`, `sf/cloudBank`,
`sf/lights`). One E2 test (`opus-bay-sf-nav` "window build < 200 ms") failed once under full-machine load and passes
alone and in every later run: a timing assertion, not a regression.

**Program lookups and per-frame work** (`C:/Users/willy/opus-qa/w3/c2/perf/prog-probe.js`: wraps
`renderBufferDirect`, counts every `customProgramCacheKey()` call = one getProgram, program switches with the object
kind / reason, real matrixWorld recomputes, BatchedMesh per-item loops; 60 frames, desktop 1×, golden, `quality=high`):

| spot | program lookups / frame (before → after) | matrixWorld recomputes / frame | BatchedMesh item loops / frame | World.update ms |
|---|---|---|---|---|
| Ferry gate | 14 → 3.4–4 | 319 → 246 | 2 × 1,289 → 0 | 0.58 → 0.28–0.36 |
| Chinatown | 14–15 → 2.5–4 | 341 → 254 | 2 × 1,347 → 0 | 0.74 → 0.30–0.40 |
| Twin Peaks | 12 → 2 | 347 → 250 | 2 × 1,421 → 0 | 0.41 → 0.20–0.26 |

What is left per frame: 2 lookups on G1's focus ring (a transparent `DoubleSide` MeshBasicMaterial: three draws it in
two passes and flips `side` + `needsUpdate` each time) and 2 on F's `ob-flap` material (gulls have instanceColor, the
gliding pelicans do not). Both are requests below.

CPU profile, Twin Peaks, desktop, 4× walk, 8 s (`scripts/opus-sf/qa/perf/opus-prof.mjs --url …:5201…`; raw
`perf/base/tp-4x-walk.cpuprofile`, `perf/after/tp-4x-walk.cpuprofile`), self time: getParameters 253 → 88 ms,
getProgram 214 → 52 ms, getProgramCacheKey 89 ms → below the top 40 (< 58 ms), BatchedMesh `onBeforeRender` 272 ms → gone, while the
number of frames in the window roughly doubled (≈ 26 → ≈ 55 fps).

**Perf, before / after on a quiet machine** (RTX 3070, Chrome 153 headless, `--force_high_performance_gpu`, the
§4.1 helpers on port 5201, `?start=free&world=city&quality=high&time=golden`, 1440×900; before = the baseline
worktree at `a2dbfe4` measured 04:00 (CPU ≈ 13 %), after = this part measured 04:05–04:10; fps = mean of 10 s,
idle / walk):

| spot | before 4× idle / walk | after 4× idle / walk | before tris (1×) | after tris (1×) |
|---|---|---|---|---|
| Ferry gate | 48.3 / 40.2 | **56.9 / 46.5** | 395k | 401k (a tier fade in the frame; 391k at 4×) |
| Chinatown (Dragon Gate) | 47.8 / 41.9 | **59.5 / 52.4** | 420k | **398k** |
| Twin Peaks | 48.6 / 45.7 | **56.3 / 53.5** | 394k | 385k |

**Final table** on the pushed code (04:35–04:52, CPU ≈ 17 % from the other lanes; same helpers; Chinatown re-run
after the prop share went from 0.6 to 0.5, the other rows at 0.6; `programs` = 1× idle → 4× walk; the first-walk
audio hitch is gone since F's P1 fix landed):

| spot | viewport | CPU | calls | tris | programs | objects | fps idle | fps walk | p95 / p99 walk (ms) | frames > 50 / > 100 ms |
|---|---|---|---|---|---|---|---|---|---|---|
| Ferry gate | 1440×900 | 1× | 118 | 385k | 50→50 | 305 | 60.1 | 60.1 | 16.7 / 16.8 | 0 / 0 |
| Ferry gate | 1440×900 | 4× | 101 | 393k | 50→52 | 309 | 59.9 | 45.5 | 33.4 / 49.9 | 1 / 0 |
| Ferry gate | 390×844 dpr 3 | 1× | 93 | 338k | 40→42 | 309 | 60.1 | 60.1 | 16.8 / 16.8 | 0 / 0 |
| Ferry gate | 390×844 dpr 3 | 4× | 88 | 335k | 40→42 | 309 | 60.0 | 49.2 | 33.3 / 33.4 | 1 / 0 |
| Chinatown | 1440×900 | 1× | 122 | 397k | 42→42 | 324 | 60.1 | 60.1 | 16.7 / 16.8 | 0 / 0 |
| Chinatown | 1440×900 | 4× | 123 | 393k | 42→42 | 324 | 59.3 | 48.0 | 33.4 / 33.4 | 2 / 1 |
| Chinatown | 390×844 dpr 3 | 1× | 104 | 341k | 52→52 | 326 | 60.1 | 60.1 | 16.8 / 16.8 | 0 / 0 |
| Chinatown | 390×844 dpr 3 | 4× | 109 | 334k | 52→52 | 324 | 60.0 | 53.6 | 33.3 / 33.4 | 0 / 0 |
| Twin Peaks | 1440×900 | 1× | 104 | 345k | 42→42 | 330 | 60.1 | 60.1 | 16.7 / 16.8 | 0 / 0 |
| Twin Peaks | 1440×900 | 4× | 103 | 344k | 42→42 | 330 | 60.0 | 59.7 | 16.7 / 16.8 | 0 / 0 |
| Twin Peaks | 390×844 dpr 3 | 1× | 91 | 273k | 51→51 | 330 | 60.1 | 60.1 | 16.7 / 16.8 | 0 / 0 |
| Twin Peaks | 390×844 dpr 3 | 4× | 89 | 270k | 51→51 | 330 | 60.1 | 60.1 | 16.7 / 16.8 | 0 / 0 |
| Twin Peaks `&pool=tile` | 1440×900 | 1× / 4× | 119 | 346k / 345k | 41→41 | 372 | 60.1 / 54.6 | 60.1 / 52.8 | 33.3 / 33.4 (4×) | 0 / 0 |
| Twin Peaks `&pool=tile` | 390×844 dpr 3 | 1× / 4× | 105 / 103 | 270k / 267k | 50→50 | 372 | 60.1 / 60.1 | 60.1 / 60.1 | 16.7 / 16.8 | 0 / 0 |

Every row: ≤ 150 calls, ≤ 400k triangles, ≤ 500 objects, ≥ 45 fps at 4×. Twin Peaks also dropped because F13 now
pauses the hero life there (life was 37.8k). The Ferry gate +2 programs are E2's BAYBAY swap (P5 below).

(The first baseline of the day, 02:35–02:57, ran while other lanes' test suites held the CPU at 72–100 %: 4× walk
10–38 fps. Those numbers are in `perf/base/` and are not comparable; every A/B above was taken back to back.)

**P3**, Twin Peaks `&pool=tile`: 516k / 129 calls (desktop, before) → **377–382k / 127–130 calls** (after), phone
474k → 307–315k; the shot shows the full far city, no holes
([`qa/w3/C2/twinpeaks-tile-after.jpg`](qa/w3/C2/twinpeaks-tile-after.jpg)).

**P4** in the app: phone profile (`--mobile --dpr 3`, no `?quality`) → `{ quality: 'mid', reason: 'device' }`, pixel
ratio 1.25; the Settings panel shows 均衡 / Balanced selected
([`qa/w3/C2/phone-settings-mid.jpg`](qa/w3/C2/phone-settings-mid.jpg)); tapping High writes the choice, and after a
reload the visit starts at `high` with reason `choice`. Desktop → `high` (`default`). Desktop with a 6× CPU throttle
(≈ 36 fps): `high` → `mid` within 25 s, and after the throttle is lifted (60 fps for 20 s) it stays `mid`.

**P5**: programs at 1× idle, after a 1× walk and after a 4× walk are equal at all six spots (Ferry gate 39/39/39,
Chinatown 51, Twin Peaks 41, Ocean Beach 41, GGB south 41, Mission 42; `perf/p5/`). The perf script still sees +2
at the Ferry gate: E2's BAYBAY GLB swap ≈ 35 s after load links a skinned `MeshStandardMaterial` with a map and its
depth variant (request below).

**P6**: Chinatown desktop 420k → 397k (1×) / 393k (4×) with the prop share at 0.5 (398–401k at 0.6: too close). Where it goes now (breakdown at the probe's view): hero
buildings 97k, hero ground 47k, life 37k, actors 32k, L0 toy 30k, props 28.5k (was 48.8k), L0 ground 23k, water 20k;
shadow pass 29k (actors 17k, streetcars 10k).

**P7**, `npx vite build --config vite.opus.config.ts --outDir C:/Users/willy/opus-qa/w3/c2/dist*` (gzip):

| build | GameRoot | city chunk |
|---|---|---|
| `a2dbfe4` (wave-3 start) | 311.68 KB | 32.13 KB |
| `6447b1a` (parent of this part, after E2's HC-1 and the other lanes' wave-3 work) | 317.69 KB | 34.12 KB |
| `8694832` (this part) | 318.49 KB (+0.80) | 37.40 KB |

Karl's city-only half (the time table, KarlState, coverage, cityFogK) left GameRoot (the morning colour string is now
only in the city chunk); what this part added to the main graph is the quality policy, the material twins / sweep /
depth materials, `freezeStatic` and the fx warm-up (+0.8 KB net). GameRoot is not near 250 KB because
`world/sf/landmarks/context.ts` (the landmark data and recipes, ≈ 42 KB) is still imported statically by G2's
`data/sf/cityPois.ts` and `game/cityGoals.ts` (Rollup: "dynamically imported by places.ts / resume.ts but also
statically imported by cityPois.ts, cityGoals.ts … will not move module into another chunk"): request below.

**C2-10** in the app: running 12 s through the Mission / Duboce, 4 cells fade at most at once (mean 0.68), programs
42 → 42, and the shot at the end of the run (scratch `fade-walk2.jpg`) shows the streamed street with no hole; the
dither coverage is complementary at all 64 levels (test).

District: `?start=free&quality=high&time=golden` renders as before
([`qa/w3/C2/district-before-after.jpg`](qa/w3/C2/district-before-after.jpg); the frames differ only by the moving ferry
and the camera's idle drift); hero regression and contracts green. Chinatown before / after:
[`qa/w3/C2/chinatown-before-after.jpg`](qa/w3/C2/chinatown-before-after.jpg).

### Decisions

- **Twins, not per-object materials.** Each kind gets one more instance of the same material (same program key), so
  the program count and the warm-up set do not change; `kindSweep` enforces it for C2's own materials instead of
  editing other lanes' files. Other lanes' own materials (G1's ring, F's flap material, E2's actors) are requests.
- **Depth materials by kind** are assigned by the sweep (a renderer concern: three's single internal depth material is
  the cause), only where three itself would not clone a special variant.
- **The scene root keeps recomposing.** Freezing it would save ≈ 250 more multiplies a frame but break every object
  that writes `matrix` directly (F's streetcars and turntable ring, D2's landmark groups, life); only identity statics
  are frozen.
- **Pool culling in JS, not three's.** Same result (one sphere per item), but skipped when the view does not move and
  applied with `setVisibleAt` only on a change; the tile pool gets the same items through index compaction instead of
  more tiles (the draw-call budget stays).
- **Props follow the view** with a 40° margin and a 20° / 0.1 s re-selection, and the caps drop to 0.5 (fewer props
  in total, about as many on screen as before: the in-view lollipop cap of 300 binds at Twin Peaks).
- **Quality:** a saved `high` is treated as "no choice" (it is the default and is saved on every visit); a real choice
  is recorded by C2 from the store (no G1 change needed). `mid → low` only under 30 fps (low buys little over mid).
- **Tier fade:** 0.3 s, Bayer 8×8 (the same mask as the occlusion fade), the batched path only; fading-out tiers stay
  in the budget for those 0.3 s (+1 cell of triangles at walking speed).

### Known gaps

- Walking fps at 4× is ≥ 45 at the three dense spots, but the margin at the Ferry gate desktop is small (45.5–46.5)
  and every fps number here moves ±10 with the other lanes' load; the final verify should re-measure.
- Chinatown desktop is 3–7k under 400k: any new always-on geometry in the hero / Chinatown view needs its own saving
  (D2's Sites LOD, a finer hero chunking in city mode, or the hero buildings' shadow casters are the next levers).
- A tier fade doubles one cell's triangles for 0.3 s (one quick-A/B frame read 401k at the Ferry gate mid-fade).
- The phone rows below are at `quality=high` (the table's URL); the phone profile's own start level (`mid`) was checked
  for the policy, not re-measured at 4×.
- The first-touch audio hitch (P1, lane F) still shows as 2 frames > 100 ms in every first walk window.
- C2-10 is not exercised by a stream-level test (the table-driven stream has no headless GPU path): the fade rule, the
  pool alpha and the pairs are unit-tested; the switching itself was checked in the app.

### Not done

- Part b: C2-7a/b Marin / East Bay boards, C2-13 Bay Bridge east span, C2-14 / M3 Karl tuning and contact sheets.
- No Higgsfield credits used in part a (0 of 20).

### Requests

1. **G1, `src/opus-bay/game/Systems.tsx` `FocusMarker`** (P2, 2 program lookups every frame): the ring material is
   transparent and `DoubleSide`, which three draws in two passes (back, then front) flipping `side` and
   `needsUpdate` each time. Add `forceSinglePass: true`:
   `ring: new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, forceSinglePass: true }),`
2. **F, `src/opus-bay/world/life.ts`** (P2, 2 lookups every frame): `gullMesh` and `pelicanGlide` share `this.flapMat`
   but only the gulls have instanceColor. After `this.pelicanGlide.frustumCulled = false;` add
   `for (let i = 0; i < 4; i++) this.pelicanGlide.setColorAt(i, new THREE.Color(1, 1, 1));` (same program as the gulls'
   tinted variant). Also use `TOY_INST_TINT` (materials.ts) for `this.dogs` and `this.floats` (they call `setColorAt`;
   C2's `kindSweep` already moves them at runtime, this makes it explicit).
3. **E2, `src/opus-bay/actors/system.ts` `swapGuideNow` / the BAYBAY GLB swap** (P5: +2 programs linked ≈ 35 s after
   load, on the frame the swap happens): compile the loaded model before it goes on screen, e.g.
   `await renderer.compileAsync(model, camera, scene)` before adding it, or a `registerWarmup('e2-baybay', …)` with a
   `SkinnedMesh` using the GLB's material (map, castShadow) — the depth variant with the map comes with it.
4. **G2, `src/opus-bay/data/sf/cityPois.ts` and `src/opus-bay/game/cityGoals.ts`** (P7: ≈ 42 KB gzip of GameRoot):
   they import `world/sf/landmarks/context` statically, which keeps the landmark data and recipes in the main chunk even
   after E2's HC-1. Read the landmark data through `cityModule()` (world/cityLoader.ts; `landmarkTallStructures`,
   `sfLandmarkAnchor` … are re-exported by `world/sf/cityMode.ts` — ask C2 to add any other export you need there) or a
   dynamic import inside the city-only code path.
5. **D2, `world/sf/sites.ts`**: nothing to switch for P2 — plain meshes keep `TOY` / `GROUND` (the pools moved to
   `TOY_BATCH` / `GROUND_BATCH`). The C2-5 "Sites" LOD by camera height (`U.uCam.value`) is still the lever for the
   landmarks in the P6 budget.

Relayed messages during part a: none.
