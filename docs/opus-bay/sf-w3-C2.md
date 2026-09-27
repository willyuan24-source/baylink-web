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

## Part b

### 给主人的摘要

- 城市四周不再是"桌子边缘"：北边有了马林岬角（萨萨利托山坡小镇、鹰山、Fort Baker，金门大桥北端正好落在 15.2 高的桥面上），东边有了东湾（奥克兰高楼、港口吊车和集装箱、伯克利平原的街格、东湾山丘）；海湾大桥东段从耶尔巴布埃纳岛的独塔一直连到奥克兰落地点。全部并进已有的合批，没有新增 draw call；远处的马林和东湾自动换成粗一档的地形（近 1.1 公里以内才用细的），雾里看不见的远景不再画，远裁剪面也不会切出硬边。
- 雾神 Karl 现在是一整片"雾墙"而不是薄霾：早上从双峰往西看，日落区埋在白色雾海里，只有山头和 Sutro 塔露出来，金门也被遮住；黄昏时雾从外日落区和金门海峡涌进来；市中心始终清楚。走进雾里，身边 15 单位内保持清晰，玩家和 BAYBAY 不会被糊掉；萨萨利托不再被雾盖住；夜里的雾团不再发白发亮。
- 街区模式完全不变：Karl 在街区模式下恒为 0，前后截图一致。
- 预算：绝大多数视角 ≤ 150 draw call、≤ 40 万三角形；两个最密的走路视角压在线上：渡轮大厦面朝市中心 39.6–41.5 万、唐人街 39.5–40.4 万（主要是别的 lane 新加的人群影子、地标 AI 模型和叮当车），已写成具体请求。GameRoot 主包现在 309 KB（gzip），地标库已经搬出主包（G2 做了我的请求），守护测试已收紧。
- 顺手发现：各 lane 的截图脚本会随机撞同一个 Chrome 调试端口，互相把对方的页面导航走（我这边有两次截图被别的 lane 的页面顶掉），已写成给主管的请求。本部分没有花 Higgsfield 额度（全 lane 0 / 20）。

### What was built

| task | commits | files | what |
|---|---|---|---|
| **C2-7a** offline boards | `7ee18c1` | `scripts/opus-sf/boards.ts` (new), `world/sf/boardData.ts` (new), `public/opus-bay/sf/v1/boards/{boards.json, marin.obb, eastbay.obb, ATTRIBUTION.md}` (new files only; no existing v1 file touched) | Terrarium z13 tiles (fetched once, cached outside the repo) resampled on world-aligned grids: **Marin at 4 u** (484 × 534, 58 KB), **East Bay at 8 u** (390 × 372, 49 KB), box-filtered; shores sharpened with the OSM coastline; the city's own land, the Golden Gate's south side, Treasure Island / Yerba Buena, Alcatraz and Angel Island kept off the boards; the sea flooded from real bathymetry (inland DEM voids become land). The ground within ≈ 25 u of the Golden Gate Bridge's north deck end (−1015.7, 388.6) ramps to exactly the 15.2 u deck (15.21 measured) and stays ≥ 1.4 u under the approach deck back to the north tower. `boards.json` also carries the freeways (OSM motorway / trunk) and the Bay Bridge east span's two decks. Format OBB1 (header + int16 DEM decimetres, `BOARD_NONE` outside): `encodeBoard` / `decodeBoard`, `boardDem`, `boardY`; the world polygon `WORLD_LL` / `worldPolygon()` (the San Mateo line, the far side of the East Bay ridge, the Marin Headlands). ATTRIBUTION.md: Terrain Tiles (USGS 3DEP / NED, ETOPO1 / CUDEM, GMRT, SRTM) and © OpenStreetMap contributors (ODbL). |
| **C2-7b** boards at runtime | `598631c`, `5eba6f0`, `cd2e8d3`, `a9ffa25` | `world/sf/boards.ts` (new, its own lazy chunk: 9.75 KB gzip), `world/sf/stream.ts`, `pools.ts`, `water.ts`, `mesh.ts`, `lights.ts`, `world/fogShader.ts`, `world/materials.ts`, `world/ground.ts`, `world/environment.ts`, `world/world.ts` | Loaded by the streamer once the far city is in, built as a generator in ≈ 2 ms frame slices. Ground: marching squares per 64 u cell at a step chosen by roughness (Marin 8–32 u, the GGB north end 8 u; East Bay 16–64 u), cut exactly along the world polygon, the C2-3 paint (hill grass by height, earth on steep slopes, plain land in the towns) plus woods and beaches; the East Bay flats get a far-town street-grid ground pattern (GROUND pattern 9, faintly lit at night). Toy-town dressing in the TOY half of the pool items: Sausalito's and Belvedere's hillsides, Marin City, Fort Baker, Point Bonita's lighthouse; downtown Oakland's towers, the port's cranes and container stacks, the flats' low blocks (kept off the freeways, the toll plaza, the Maze, the mole), trees in the hills, the Campanile, the Claremont; the OSM freeways as ribbons (US-101 carried on to the GGB deck end). **Near set 38,880 triangles** (ground 23,050 + dressing 15,830) + 2,324 the east span; **0 new draw calls**, 294 static pool items (ids ≡ 3 mod 4; the tile pool merges them into 3 bins); 2,263 light-field points. **Near / far LOD** (`a9ffa25`): every 256 u tile is three items — the dressing (always), the fine ground + trees (near), a coarse copy of the ground at `farStep` (steps doubled, ≥ 32 u; coast cells ≤ 32 u; the freeways on both) — switched per tile at `BOARD_LOD.near` = 1,100 u from the camera (hysteresis 80 u, a pass after 16 u of camera travel, setVisible only): the far set is 23.5k, so the city (Ferry Building, Twin Peaks, downtown: all > 1.1 km away) draws ≈ 15k less of the boards; Crissy Field and the GGB still see the Headlands near. The city water follows the world polygon (drops the far tiles under board land, cuts its far index to a widened view). **World-board edge** (`cd2e8d3`): no underside fan (split in 512 u pieces its few board-wide triangles had become one-triangle meshes drawn in almost every view: the water grew by 7–10 calls), 1,024 u pieces: 19 meshes, 13,950 triangles; `slabEdge(…, underside = true)` keeps district unchanged. **Soft world edge**: `FAR_FADE.uObFar` fades every patchFog material, the table and the light field to the fog colour from 2,350 to 2,940 u of view depth (city only), so the 3,000 u far plane never cuts the East Bay hills. |
| **C2-13** Bay Bridge east span | `598631c`, `5eba6f0` | `world/sf/boards.ts` (`SAS`, `chaikin`) | The self-anchored suspension span's single tower at (211.0, −506.6) with its cables, from the suspension span's west end on Yerba Buena's shore (a pier carries it down; the island's own viaduct streams with the city), then the skyway's twin decks on piers to the Oakland touchdown (low fill) and the toll plaza; the OSM decks Chaikin-smoothed. CS-11: the Marin / East Bay part (boards, the GGB north end on land, the soft edge) is done; the GGB **south** approach is D2's (D2-09). |
| **M3** Karl tuning | `fdef292`, `75e64ae`, `81ed9cb` | `world/fogShader.ts`, `world/sf/fog.ts`, `world/sf/cloudBank.ts`, `world/environment.ts` | Karl's amount is now `1 − exp(−(L − 15) / 80)`, **L = the length of the view ray inside the layer**: from above the fog top only the part below it counts (extinction 30 u), so from Twin Peaks the Sunset lies under an opaque sea with a lumpy top and the hills (Golden Gate Heights, Mt Sutro, the summit) stand out of it; inside the bank the whole ray counts, plus the bank over the camera's own ground (`uKarlCam`, written once a frame by `KarlState.update(dt, camera)`, not two noise lookups per fragment); the first 15 u stay clear (`KARL_GEO.clear`: the player and BAYBAY read in the fog). The west edge is a bank's edge (full 70 u behind the front, none 20 u past it; was a 180 u gradient), the gate lobe narrower (95 → 175 u); north of the strait the front is capped at 170 (`KARL_GEO.marin`: the fog tops the Headlands, Sausalito / Richardson Bay stay clear — the front is a line along true north and had run through all of Marin once the Marin board existed). Time table: morning front 560 → **680**, top 36 → **40**; golden 0.6 → **0.9**, front 150 → **380** (rolling in over the outer half of the Sunset, the inner Richmond still clear), top 31 → 35, a whiter lit colour `#f5e7dd`; night front 380 → 450. Cloud bank: three in five west clusters stand tall in a row on the rolling front, the rest lie low behind; a faint always-on glow so the side away from a low sun reads as lit fog; the night tint lowered to 0.6 so that glow stays dim. `karlAmount(p, cam, depth, t)` is the same model in TS (tested). No new programs (string changes; the `uKarl > 0` branch never runs in district). |
| **P6** budget after the boards | `a9ffa25`, `b1b2429` | `world/sf/pools.ts`, `stream.ts`, `water.ts`, `cloudBank.ts`, `world/world.ts` | **Haze cull**: pool items (city L1 / L2 and the boards) and Karl's cloud clusters wholly deeper than `hazeCullDepth(ρ)` = √(−ln 0.015) / ρ are ≥ 98.5 % FogExp2 haze and are not drawn (view depth, as three's fog measures it; the world passes the live density; quantised to 50 u): 1,750 u at golden hour, 950 in the morning, 1,150 at night at walking height; nothing high up (Twin Peaks, a glide: the city thins its haze). No visible change (ferry / painted / ocean side by side, scratch `c14/haze-cmp.jpg`). **Near water**: the near wave grid leaves out tiles that are all land (the far index already did). |
| **C2-14** contact sheets, budget table | this report | `scripts/opus-sf/qa/budget-views.mjs` (`--mobile [--dpr]`; views `tp-eye-west` / `tp-eye-gate` at eye height on the summit, `sunset-walk`, `crissy-walk`, `perf-ferry`, `perf-chinatown`; re-hides cards opened since the start before every shot; `hazeDepth` and the boards' near tiles in every measure) | Before / after with the same script on a baseline worktree at `4f7de5f` (the end of part a; removed afterwards) and the head, port 5201 in turn: city golden / night (23 views), Karl morning / golden / day / night (8 views), phone 390×844 dpr 3, district morning / golden / night. Sheets below. |
| **P5** (E2's request 3) | this commit | `world/warmup.ts` (`shadowDepthSet`), `tests/opus-bay-sf-perf.test.ts` | The first high glide linked one program in city mode: the shadow pass's depth program for a plain (non-instanced, non-skinned) caster, which three draws with its internal `MeshDepthMaterial`, side flipped, into the shadow map, without a scene. The warm-up now compiles plain meshes with `MeshDepthMaterial` BackSide and DoubleSide into a render target with the scene's fog lifted (the shadow pass's exact key: no fog, no tone mapping, linear output), and keeps those two materials alive (three drops a program with its last material: disposing the dummies had thrown the warmed programs away). In the app: a plain TOY caster and a DoubleSide copy added next to the player at the Marina link no depth program (before: +1). Boot +2 programs. |
| **P7** guard | `48808e5`, `278fccc` | `tests/opus-bay-sf-budget.test.ts` | Walks GameRoot's static import graph (type-only imports skipped): no `world/sf` module is reachable except the tile format (G1's streets); a failure prints the import chain. First with the five edges pending in G2's files, tightened after G2's `88ed44f` moved them (the landmark library is its own 25 KB chunk now). |

API for other lanes:

- **F (F8 ferry data): Sausalito exists.** `SAUSALITO_FERRY` (`world/sf/boardData.ts`): the ferry float at
  (37.8559, −122.478) projected, on the water, with `toShore` (the shore is ≈ 16 u that way; tested). The boards are
  scenery only: no walking, no collision (`inWorld` is false there), so a ferry to Sausalito ends at the float; Karl
  keeps Sausalito clear at every time.
- `world/sf/boards.ts`: `boardsGroundAt(grids, x, z)` (board ground height or null for water / outside), `SAS`, `BoardItem.lod`,
  `farStep`; `world/sf/boardData.ts`: `GGB_NORTH`, `HAWK_HILL`, `WORLD_LL` / `worldPolygon()`, `BOARD_LOD`.
- `sf/pools.ts`: `hazeCullDepth(density, far?)`, `HAZE_CULL`; `CellPool.update(camera, maxDepth?)`; `ViewCull.from(camera, maxDepth?)`.
  `CityStreamer.haze` (the world sets it), `stats().hazeDepth`, `stats().boards.nearTiles`.
- `fogShader.ts`: `FAR_FADE` / `CITY_FAR_FADE`: a custom ShaderMaterial that shows far geometry in city mode should mix
  to the fog colour with `smoothstep(uObFar.x, uObFar.y, depth)` (patchFog materials already do); `KARL.uKarlCam`,
  `KARL_GEO.clear` / `depth` / `depthAbove` / `edge` / `marin`.
- `sf/fog.ts`: `karlAmount(p, cam, depth, target)`; `KarlState.update(dt, cam?)`. `CloudBank(karl, groundAt?, haze?)`.
- `world/ground.ts`: `slabEdge(…, column, underside = true)`.
- QA: `node scripts/opus-sf/qa/budget-views.mjs --views tp-eye-west,tp-eye-gate --time morning [--w 390 --h 844 --mobile --dpr 3]`.

### Evidence

**Checks** on the pushed head `b1b2429` (and again before the report commit): `tsc -p tsconfig.app.json` 0 errors,
`eslint .` 0 errors (the whole repo, per the lead's new rule; the only errors it prints locally are in the
`.vite-opus/` dependency cache, which is not in the repo), **636 / 636** opus-bay tests, hero regression and contracts
green. One E2 timing test (`sf-nav` "local A* window … routeTo") failed once at 6.2 s under the full machine load and
passes alone (0.9 s). New / extended tests: `opus-bay-sf-atmos` (Karl as a bank: the in-layer model, the opaque sea
from Twin Peaks, 65 % at 100 u walking, the clear 15 u, the summit and downtown clear; `uKarlCam`; the Marin cap:
Sausalito / Tiburon clear at every time, Point Bonita covered; the rolling front row of clusters; the hazy bank),
`opus-bay-sf-boards` (13: round trip, GGB north end within 0.3 u of 15.2, Hawk Hill 43 ± 4, never over the city,
the world polygon, ≤ 40k triangles, the east span, the tile-pool bins, the soft edge, the edge pieces, the near /
far items, the dry near-water tiles), `opus-bay-sf-perf` (the haze cull), `opus-bay-sf-budget` (the P7 graph guard).

**M3, Karl** ([`qa/w3/C2/b-karl-morning-before-after.jpg`](qa/w3/C2/b-karl-morning-before-after.jpg),
[`b-karl-golden-before-after.jpg`](qa/w3/C2/b-karl-golden-before-after.jpg),
[`b-karl-times-after.jpg`](qa/w3/C2/b-karl-times-after.jpg), phone
[`b-karl-phone-after.jpg`](qa/w3/C2/b-karl-phone-after.jpg); desktop 960×600 unless noted, `quality=high`).
Before: at eye height on the summit the morning bank was a light haze with cotton blobs floating over the Sunset.
After: morning — the Sunset and the Richmond lie under a white sea west of the summit, Sutro Tower and the hills
stand out, the Gate is hidden (`tp-eye-west`, `tp-eye-gate`, `tp-west`, `tp-gate`); walking in the Outer Sunset the
street 20–40 u away reads, the far houses fade into the bank (`sunset-walk`); on Crissy Field the bridge is gone in the
fog, the lawn clear (`crissy-walk`). Golden — a whiter bank over the outer Sunset with a lumpy front and a tongue
through the Gate (the bridge's middle in it, the towers above). Day — it waits offshore. Night — a lower, dimmer bank,
the lit city reads. Downtown from the summit (`tp-walk`) is clear at every time. A note for QA: the rig's own summit
view faces downtown (E2's zone view wins over `faceCameraToward` there), so the west views use a camera at eye height
(`tp-eye-*`); the owner reaches them by dragging the camera round.

**District, Karl 0** ([`qa/w3/C2/b-district-before-after.jpg`](qa/w3/C2/b-district-before-after.jpg), 1440×900,
morning / golden / night): `KARL.uKarl` = 0, `uKarlCam` = 0 and `FAR_FADE.uObFar` = (1e9, 2e9) read in the page before
and after; the frames match in light, fog, water and sky (the arrival ferry, BAYBAY's bubble, the camera's idle drift
and G1's walk hint differ).

**Boards** ([`qa/w3/C2/b-boards-golden-before-after.jpg`](qa/w3/C2/b-boards-golden-before-after.jpg),
[`b-boards-night-after.jpg`](qa/w3/C2/b-boards-night-after.jpg)): the Marin Headlands and the Gate from above Crissy
(fog through the Gate, the Headlands clear above it), the GGB north end on Marin ground with Fort Baker below, Sausalito's
hillside town (clear), the east span from Yerba Buena (the SAS tower, the skyway) to the touchdown and the port's
cranes, Oakland's flats as a lit street grid at night, the East Bay hills fading into the far edge from high over the
Presidio. Node: GGB north end 15.21 u, Hawk Hill 39.4 u, near set 38,880 + east span 2,324, far set 23.5k, 294 items,
2,263 light points.

**Before / after budget** (the same 23 views, 960×600, `quality=high`, RTX; before = `4f7de5f`, after = the head;
"after" includes every lane's work since part a, not only C2's). All ≤ 150 calls; programs 39–41 (were 40–44).

| view | golden calls (before → after) | golden triangles (before → after) | night calls | night triangles | notes |
|---|---|---|---|---|---|
| ferry | 115 → 110 | 364k → 367k | 117 → 114 | 359k → 359k |  |
| perf-ferry | — → 100 | — → 405k | — → 103 | — → 396k | the perf table's spot (added this part: no before); facing downtown |
| perf-chinatown | — → 124 | — → 395k | — → 126 | — → 392k | the perf table's spot (added this part: no before) |
| tp-walk | 106 → 66 | 352k → 250k | 108 → 66 | 351k → 251k | `go` view: E2's new camera pose |
| tp-high | 89 → 86 | 284k → 294k | 91 → 88 | 283k → 293k |  |
| tp-high250 | 101 → 93 | 323k → 337k | 103 → 95 | 322k → 336k |  |
| coit-high | 75 → 73 | 371k → 357k | 76 → 74 | 372k → 357k |  |
| glide-mission | 50 → 49 | 194k → 186k | 50 → 49 | 193k → 185k |  |
| painted | 70 → 101 | 263k → 336k | 71 → 104 | 263k → 334k | `go` view: camera pose + D2's landmarks 45k |
| mission | 101 → 94 | 332k → 325k | 104 → 97 | 332k → 325k |  |
| sunset | 50 → 45 | 150k → 138k | 51 → 46 | 150k → 138k |  |
| marina | 71 → 70 | 180k → 212k | 74 → 72 | 181k → 212k | D2's landmarks 39k |
| ocean | 75 → 45 | 151k → 103k | 76 → 46 | 151k → 103k | `go` view: camera pose |
| hero-far | 91 → 83 | 246k → 248k | 92 → 84 | 246k → 248k |  |
| marin-gate | 43 → 41 | 79k → 82k | 44 → 42 | 80k → 81k |  |
| ggb-north | 35 → 33 | 59k → 66k | 36 → 34 | 59k → 66k |  |
| sausalito | 27 → 27 | 49k → 55k | 28 → 39 | 49k → 81k | night: a fresh page, the player at the Ferry gate (its crowd's shadows +9–20k) |
| ferry-east | 53 → 58 | 193k → 209k | 54 → 69 | 193k → 229k | night: a fresh page, the player at the Ferry gate (its crowd's shadows +9–20k) |
| tp-east | 81 → 75 | 245k → 251k | 82 → 90 | 245k → 280k | night: a fresh page, the player at the Ferry gate (its crowd's shadows +9–20k) |
| bridge-east | 32 → 34 | 51k → 68k | 33 → 44 | 51k → 83k | night: a fresh page, the player at the Ferry gate (its crowd's shadows +9–20k) |
| world-high | 73 → 66 | 160k → 174k | 76 → 83 | 160k → 199k | night: a fresh page, the player at the Ferry gate (its crowd's shadows +9–20k) |
| oakland | 29 → 33 | 69k → 96k | 30 → 44 | 69k → 111k | night: a fresh page, the player at the Ferry gate (its crowd's shadows +9–20k) |
| touchdown | 30 → 33 | 71k → 96k | 31 → 44 | 71k → 113k | night: a fresh page, the player at the Ferry gate (its crowd's shadows +9–20k) |

Reading it: the walking `go` views (`tp-walk`, `painted`, `ocean`, `marina`) moved mostly with E2's new city camera
(`0657917`: landmark arrival views, roof lift — a different pose, not a different city) and D2's landmark models
(`city.landmarks` at Ocean Beach 8k → 23–43k, Alamo Square 9k → 38–45k, Marina 39k; `sites.ai` 18.6–24.5k); the
high `cam` views are comparable: with the LOD and the haze cull the boards add 6–27k where they are in view (tp-high
+9k, tp-east +6k, ferry-east +16k, bridge-east +17k, the glide over the port +27k). The shadow pass moves with
where the player stands (a fresh page leaves the player at the Ferry gate with its crowd: 10–13 calls, 26–37k).

The two perf spots (`perf-ferry` / `perf-chinatown`: where the perf table stands): the Ferry gate walking view reads
**372k facing north along the waterfront and 396–415k facing downtown** (the rig picks the facing): hero buildings 81k +
ground 47k + backdrop 9k, city pools 73k, actors 35k + their shadows 35k (7 calls), life 47k, D2's sites 19k (AI 18.6k),
water 20k, streetcars 10k + 2k shadow, Karl's clouds 8.6k (the golden Gate tongue, 1.2–1.6 km off, in the haze depth);
Chinatown (Dragon Gate) **395–404k**: hero 97k + 47k, life 37k, actors 34k, streetcars 23k + 10k shadow, props 26k,
L0 53k, sites 13k. The C2 levers used: the boards' LOD and haze cull (−10k at the Ferry gate), the near-water skip
(−3k), the clouds' haze cull; what is left over the line is other lanes' growth since part a (requests below). Phone
(390×844 dpr 3, golden): Ferry gate 343k / 102 calls, Chinatown 332k / 106, Twin Peaks walk 168k, high 232k.

**fps**: the perf table (`scripts/opus-sf/qa/perf/run3.sh`, three dense spots, desktop + phone, 1× / 4×) ran while the
machine held 87 % CPU (six wave-3 lanes, the wave-4 lanes and their test suites): 1× 59–60 fps everywhere, 4× 8–33 fps —
not comparable with part a's quiet-machine numbers and not a regression signal. The lead's final verify should re-run
it on a quiet machine. Programs at 1× idle → 4× walk: desktop equal at all three spots (40 / 39 / 38); the phone rows
were disturbed by the load (Ferry gate 55 → 57, Chinatown 20 → 47 after a stall) — to re-check in the final verify.

**P7 / bundle** (`npx vite build --outDir <scratch>`, gzip): GameRoot 324.65 KB (`75e64ae`) → **301.59 KB** after G2's
`88ed44f` (the landmark library is its own 25.0 KB chunk) → **309.16 KB** at `b1b2429` (E2's glide world, camera and
pelican, G1 / G2 work since); `cityMode` 40.5 KB, `boards` 9.75 KB. The guard test fails on any new static path from
GameRoot into `world/sf` (the tile format excepted).

### Decisions

- **Karl as a layer, not a distance fog.** The whitening follows the length of the view ray inside the bank, so the
  same bank is an opaque sea from above and a thick fog from inside — one model for Twin Peaks, the Sunset streets and a
  glide, no camera-height special cases. The clear 15 u keep the characters readable; the camera's own ground is a
  per-frame uniform (the noise at its mean) instead of a per-fragment evaluation.
- **Golden 0.9, not 0.6**: a bank reads by its edge and its opacity; the extent (front 380) carries the "rolling in",
  the level only its density. Night stays 0.35 (the lit city is the night's subject).
- **Marin cap** instead of a second polygon: one smoothstep across the gate axis, the Gate lobe untouched.
- **Board LOD by distance to the tile's bounds** (1,100 u, hysteresis 80): the city never sees the boards near except
  from the Golden Gate / Crissy side; switching is a setVisible (no rebuild on the batched path; the tile pool rebuilds
  ≤ 1 bin a frame). No fade: at ≥ 1 km the haze already hides most of the difference.
- **Haze cull at 98.5 %** by view depth (what three's fog uses), quantised to 50 u so the pools re-test rarely; only
  items wholly past the depth (sphere depth − r).
- **Contact-sheet views use QA cameras at eye height** where the rig's own framing would not face the subject.

### Known gaps

- **Budget at the two dense walking spots** hovers at the line (Ferry gate facing downtown 396–415k, Chinatown
  395–404k; 960×600 and the perf table's 1440×900 differ by a few k). C2's own share there is the hero (frozen by the
  hero regression test), the city pools and the water; the growth since part a is E2's crowd shadows, D2's AI landmark
  models and F's streetcars (requests 1–3). The next C2 levers, not done: a lower-poly cloud cluster at walking height
  (−6k where the golden tongue is in view), `HAZE_CULL.fog` 0.985 → 0.97 (≈ −200 u of depth), `BOARD_LOD.near` 1,100 →
  900 (−2k at the Ferry gate).
- The walking `go` views of the budget script depend on E2's camera (arrival views, roof lift): their numbers move
  between runs; the `cam` views are the stable comparison.
- The board LOD switches without a fade (at ≥ 1.1 km; a glide along the boundary can see a coarse tile turn fine).
- Near / far board tiles meet without skirts across the LOD boundary (sub-pixel at that distance on the sheets; not
  measured).
- Karl's fog has one colour per time (no lighting inside the bank); the golden bank's sunward side reads through the
  cloud clusters' tint only.
- fps not re-measured on a quiet machine (see Evidence).

### Not done

- None of this part's tasks is open: C2-7a, C2-7b (+ Sausalito for F), C2-13, M3, C2-14, the P7 guard are done and
  pushed. Left for the lead / other lanes: the dense-spot budget (requests 1–3), the perf table on a quiet machine,
  GameRoot 309 KB vs the 250 KB target (the landmark library is out; what remains is mostly other lanes' main-graph
  code: a split of the HUD / game systems by mode is a lead decision).
- No Higgsfield credits used in part b (lane total 0 of 20).
- Housekeeping: the baseline worktree `C:/Users/willy/wt/c2-base` is removed (its `node_modules` junction was unlinked
  first), but its admin dir `C:/Users/willy/OneDrive/Desktop/baylink-web/.git/worktrees/c2-base` could not be deleted
  (Permission denied, OneDrive; like part a's `base-wt`): `git worktree prune` from any checkout clears both.

### Requests

1. **E2, crowd shadows** (`actors/` crowd / actor meshes): at the Ferry gate the actors cast 35k shadow triangles in
   7 calls (their main pass is 35k): cast shadows only within ≈ 40 u of the camera, or from a lower-poly shadow proxy.
   That alone brings the Ferry gate facing downtown under 400k.
2. **D2, `world/sf/sites.ts` AI landmark models**: `sites.ai` draws 18.6–24.5k triangles at walking height (Ferry gate
   facing downtown 19k, Alamo Square 45k `city.landmarks`, Ocean Beach 23–43k): give the AI models an LOD by distance
   (the procedural LOD0 or the L1 box past ≈ 250 u), or count them against a per-view site budget like the kit swap.
3. **F, streetcars / cable cars**: at Chinatown 23k main + 10k shadow (9 + 4 calls): a far LOD (car body only) past
   ≈ 120 u and shadows only near the camera.
4. **G1, `game/Systems.tsx` `FocusMarker`** (carried over from part a request 1, still open): add
   `forceSinglePass: true` to the ring material (2 program lookups every frame).
5. **Lead, `scripts/opus-shot.mjs`** (shared QA tool): parallel lanes' screenshot runs collide on the Chrome debugging
   port (`9400 + random(500)`): a second Chrome fails to bind, its script connects to the first lane's Chrome and
   navigates *that* page. Twice this part a C2 run was taken over (once to `…:5205/opus-bay?…lang=zh`, once most likely to
a `?solo=` landmark view),
   and a GPU context loss hit two C2 pages at once under the load. Fix: launch with `--remote-debugging-port=0` and read
   the port from `<profile>/DevToolsActivePort`, or probe the port before launching.
6. Part a's requests 2 (F, flap material / tinted dogs), 3 (E2, BAYBAY precompile), 4 (G2, landmark imports) and 5
   (D2, Sites LOD) are done (`life.ts`, `ee2b765`, `88ed44f`, `f525421`). Received from E2 (`sf-w3-E2.md` part b):
   request 3 (the plain depth program on the first glide) is done here (P5 row above); request 4 (the glide's copy of
   `backdrop.ts bayBridge` in `actors/glideTall.ts`) is noted: the west crossing did not change in wave 3; whoever changes
   it next changes both, or exports the tower / cable stations from `backdrop.ts` for E2 to read.

Relayed messages during part b: none.
