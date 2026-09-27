# Wave 3 · Lane D2 report (landmarks in context, AI meshes, house kit, three routes)

Lane plan: `sf-w1-checkpoint.md` §5.9 and the wave-3 brief. File ownership: `sf-w2-contracts.md` §1.1 (D2 row).

## Part a

### 给主人的摘要

- 八个 AI 地标模型（荣勋宫、吉尔德利、要塞点、多洛雷斯传教站、卡斯特罗剧院、风车塔身、恩典大教堂、市政厅）都在本机清理、压缩并放进游戏了。
- 逐个和原来的手工模型对比（单独看、64 像素缩略图、黄昏和夜晚、城市里、手机上）：**六个换成 AI 版**，要塞点和吉尔德利 AI 版反而更丑，**保留手工版**。
- 顺手修了两处：多洛雷斯的教堂 AI 贴图偏黄，已调成奶油色；恩典大教堂的蓝色玫瑰窗原来贴歪到左边塔上，现在按实测位置放回正中。
- 这一段没有花 Higgsfield 积分（0/80），检查全绿（400 个测试通过）。
- 发现卡斯特罗剧院在城市里被楼房围住、正面对着一个小角落，要在后面“地标周边布置”（D2-09）一起修。

### What was built

| task | files | what |
|---|---|---|
| 0 · P2 | `world/sf/sites.ts` (checked, unchanged) | C2's split (69de4be) keeps `TOY` / `GROUND` for plain meshes and moves the pools to `TOY_BATCH` / `GROUND_BATCH`; sites.ts draws only plain Meshes (lod 0 on `TOY` or the landmark's hero material, `buildGroundMesh` on `GROUND`, sails on `TOY_DYN`), so nothing to switch (C2's report, request 5). Verified in the city: the program **set** at Mission Dolores is identical with `?ai=0` and `?ai=1` (37 = 37 names and cache-key hashes, stable 6 s later; `ob-model-hero` / `ob-model-inst` / `ob-toy-hero` come from the warm-up). |
| D2-12 | (pushed earlier: 9691bc2) | `placeId` on every `SfLandmarkInfo`, plaza names, the zh glossary at the source (双峰, 马里纳区, 要塞公园, 叮当车), the turntable guide → `san-francisco-guide`, Ghirardelli's `plannerPlaceId` dropped, `SF_MODELS.landmarkId` = registry ids. G2's overrides in `data/sf/cityPois.ts` are now no-ops for landmarks (harmless). |
| D2-15 | `public/opus-bay/models/sf/{legion-of-honor, ghirardelli-clock-tower, fort-point, mission-dolores, castro-theatre, windmill-body, grace-cathedral, city-hall}.glb` | The eight part-2a SAM meshes, cleaned in Blender 5.2: 5,879–6,860 triangles, Draco + WebP 1024 px, origin at the ground centre, 87–163 KB. |
| D2-15 | `src/opus-bay/data/assets.ts` | `SF_MODEL_IDS` / `SF_MODELS` + 8 entries (url, landmarkId, kind `hero`, triangles, bytes, size; the Legion's gateway `passage`). |
| D2-15 | `world/sf/landmarks/{legion-of-honor, mission-dolores, castro-theatre, dutch-windmill, grace-cathedral, city-hall, fort-point, ghirardelli-square}.ts` | A `swap` per landmark through the D2-06 path (sites.ts / modelMaterial.ts): the AI part (offset, per-axis scale, glow, City Hall casts shadows), a procedural remainder (skirts under the mesh, The Thinker, the cemetery garden, the tulip beds and the windmill's sails on the AI stub, Castro's blade-sign bulbs, Grace's lit rose pane and stairs), walk blockers and exclusions authored to the measured meshes, and a whole-landmark hero fade (`procedural: false`). `ship` follows the decision gate (below); the procedural `build` stays the fallback while the GLB decodes or after a load failure. |
| D2-15 | `docs/opus-bay/kit-jobs/kit_cleanup.py`, `grade.py`, `iou.py`, `regrade_glb.py` | Cleanup on Windows (Python from `$OB_PYTHON` / PATH, helpers next to the script), `--grader hero`, `--exposure`, `--gate` (widen a gateway in a front screen); the grade and silhouette-IoU helpers; `regrade_glb.py` re-grades a published GLB's texture in place (geometry buffer untouched). |
| D2-15 | `docs/opus-bay/ledger/w3-D2.md` | The eight processing rows (0 credits, source job ids, raw files, status). |
| tests | `tests/opus-bay-sf-models.test.ts` | Registry vs files for 24 GLBs (bytes, triangles, bounds within 2 %, origin, Draco + WebP, size caps, **new: texture ≤ 1024 px for heroes / 512 px for houses**); the D2-15 gates (six ship, two say why); every AI footprint inside its exclusion; AI centres solid; the Legion gateway and Court of Honor free, museum / wings / screen solid; City Hall's AI block inside its (frozen) blockers; the windmill hub on the AI stub; Castro's marquee inside the widened exclusion; AI budget per lod-0 view ≤ 60k tris / 12 draws (sites.ts now exports `LOD0`). |

**API for other lanes:** nothing new to call. `SF_MODELS` has 8 more hero ids; `LOD0` (lod-0 radius per tier) is exported
from `world/sf/sites.ts`.

### Decision gates (D2-15)

Gate = SoloView `?solo=<id>&ai=0|1` at golden hour, at night and the 64 px thumbnail, then the city at golden hour and
night (desktop 1440×900) and on the phone (390×844, dpr 3). The plan's §8 asset QA gate: silhouette IoU against the
concept the mesh was made from (variant b; the earlier run had compared with variant a), non-manifold edges < 1 %,
≤ 3 islands, ≥ 80 % of texels within ΔE 12 of the palette.

| landmark | IoU (b) | non-manifold | islands | palette ≤ ΔE 12 | AI setup | decision |
|---|---|---|---|---|---|---|
| Legion of Honor | 0.779 (0.867 before the stretch) | 0 % | 2 | 99.9 % | y × 1.12, 0.5 u toward the gate; court stretched in depth, gateway 1.6 u | **ships**: colonnade screen, arched gateway, wings and dome read as the real court; the procedural reads as boxes. The IoU drop is the deliberate stretch. |
| Mission Dolores | 0.835 | 0.07 % | 1 | 94 % → **98 %** after the re-grade | [1, 1.4, 1.45] over both buildings; cemetery procedural | **ships**: the chapel's tile gable and bell niches, the basilica's towers and portal. Its butter-yellow basilica read ochre at golden hour: re-graded to cream (hue 30–70°, saturation × 0.55). |
| Castro Theatre | 0.815 | 0 % | 2 | 79.6 % | [1, 1.35, 1.3], 0.5 u toward Castro St | **ships**: the baroque facade, arched window, blade sign and marquee read far better than the procedural boxes. IoU and palette are just under the gate (the concept's stepped auditorium became one rounded block, hardly seen from the street; palette 0.4 points short). Bulbs moved onto the sign's measured edges. |
| Dutch windmill body | 0.890 | 0.01 % | 1 | 83 % | scale 1; procedural sails on the AI windshaft stub (hub y 5.85, z 2.0) | **ships**: the octagonal tower, reefing stage and cap read cleaner, with the animated sails kept. |
| Grace Cathedral | 0.875 | 0 % | 1 | 85 % | [0.75, 1.35, 1] (flèche 12.9 u) | **ships**: twin towers, buttresses and flèche read Gothic; the procedural is a block with two stubs. The lit rose pane now sits on the measured recessed facade (z 5.79, centre x 0.07, y 4.82, 1.2 × 1.44 u ellipse); it drifted onto the left tower before. |
| City Hall | 0.902 | 0.01 % | 1 | 98 % | [1, 1.24, 1.08] = the OSM block, lantern 17.65 u; casts shadows | **ships**: porticos, pavilions, colonnaded drum and gold-trimmed dome; floodlit at night. |
| Fort Point | 0.868 | 0.51 % | 2 | **30 %** | (prototype) y × 1.1, chamfered outline | **stays procedural**: a hot-orange rounded box whose gun ports lost their arches in the 65k → 6k reduction; the procedural keeps the true outline, arched ports, lighthouse and stair tower. |
| Ghirardelli clock tower | 0.856 | 0.03 % | 1 | **59 %** | (prototype) in place of the Clock Tower block | **stays procedural**: the slim AI tower is weak among the ten brick blocks and its clocks are dark at night; the procedural clock stage has four lit faces. |

### Evidence

- Checks on the pushed tree (rebased on `92419d8`): `tsc` 0 errors, `eslint src/opus-bay tests/opus-bay-*` 0 problems,
  **400 / 400** opus-bay tests (hero regression and contracts included).
- City counts, `?quality=high`, desktop, RTX (`window.__opusBay.city.stats()`; triangles include shadows):

| view | `?ai=0` calls / tris | AI calls / tris | AI drawn |
|---|---|---|---|
| Legion of Honor | 67 / 168k | 69 / 178k | 2 landmarks, 11,760 tris, 2 draws |
| Mission Dolores | 65 / 283k | 67 / 298k | 3, 18,620 tris, 4 draws |
| Castro Theatre | 64 / 253k | 65 / 259k | 3, 18,620 tris, 4 draws |
| Dutch windmill | 110 / 324k | 111 / 330k | 2, 11,760 tris, 2 draws |
| Grace Cathedral | 79 / 332k | 80 / 334k | 4, 24,494 tris, 6 draws |
| City Hall | 75 / 282k | 78 / 298k | 6, **36,254 tris, 8 draws** (the worst view) |

  All views ≤ 150 calls and ≤ 400k triangles; the AI budget per view (≤ 60k tris, ≤ 12 draws) holds with 36k / 8 at
  worst. Phone (390×844 dpr 3): 53–97 calls, 138k–301k triangles in the same views. Program counts moved between runs
  (36–60) with what else was on screen; the same-spot `ai=0` / `ai=1` program sets are identical (see task 0).
- Shots (`docs/opus-bay/qa/w3/D2/`): `d2-15-solo-ab-1.jpg` and `d2-15-solo-ab-2.jpg` (per landmark: procedural golden
  | AI golden | AI night | 64 px procedural and AI), `d2-15-city-ab.jpg` (six shipped swaps in the city, `?ai=0` left,
  AI right), `d2-15-city-night.jpg`, `d2-15-phone-390.jpg` (the Legion procedural / AI, then the other five AI on the
  phone). Scratch (all takes, logs, the measurement renders): `C:/Users/willy/opus-qa/w3/d2/`.
- Measurements for the attachments: Blender ortho renders and BVH ray casts on the published GLBs
  (`C:/Users/willy/opus-qa/w3/d2/measure/{front,ray}.py`).
- Credits: **0** (balance 455.58 before and after; `docs/opus-bay/ledger/w3-D2.md`).

### Decisions

- **IoU against the right concept.** The earlier run scored the meshes against concept variant a; all eight were made
  from variant b (ledger Part 2a). Rescored against b; the two landmarks under 0.85 that ship (Castro 0.815, Mission
  0.835) differ in massing that is hidden in the city (Castro's auditorium) or in the concept's perspective, and both
  read better than the procedural models at every gate. The Legion's 0.779 is the deliberate court stretch (0.867
  for the take without it).
- **Re-grade in place rather than re-running the cleanup** for Mission Dolores: the exact cleanup options of the chosen
  take were not recorded, and a texture-only re-grade keeps the measured geometry (and so the walk data) identical.
- **No retakes bought.** The two rejected meshes fail on the texture palette and the gun-port detail, which a SAM
  retake of the same concept would not fix reliably; the procedural models are good there. The cap stays for part b's
  kit swap.
- **Unshipped prototypes stay published** (Fort Point, Ghirardelli, like the Painted Ladies houses): SoloView keeps
  the A/B, nothing in the city loads them (`usesAi` needs `ship`).

### Known gaps

- **Castro Theatre setting (D2-09):** in the city the facade faces a small pocket enclosed by city buildings and the
  arrival spot is in it; from the street the theatre is mostly hidden and the follow camera faces away from it. This is
  the same with the procedural model. To check in D2-09: the exclusion on the Castro St side, a sidewalk / plaza strip in
  front, the arrival spot.
- Texture memory: each shipped hero is a 1024 px texture (≈ 5.3 MB with mips on the GPU). At City Hall six AI
  landmarks are resident (≈ 30 MB with the LRU); fine on desktop, to watch on the phone. A 512 px variant for phones is
  an option if the owner's iPhone shows pressure.
- While a GLB decodes (or after a failure) the procedural fallback does not match the AI blockers exactly (Legion court,
  Mission footprint, Grace's transept); brief and rare, as in wave 2.
- The QA shots use scripted camera poses (`r.camera.shot`); a few takes loaded before the city settled and were
  retaken with a longer wait.

### Not done (next parts)

- Part b: tall structures (D2-10), the "Sites" LOD by camera height (C2 request / P6), the turntable disc flag (F),
  the near-player kit swap (D2-08).
- Part c: landmark settings (D2-09, incl. the Castro pocket above and `landmarkPlazaSpots()` for F's crowd), the three
  routes (D2-11) and route QA (D2-14), hero GLB compression / preload (HC-4; the pelican with E2).

### Requests

- **Lead** (`src/opus-bay/ASSETS-LEDGER.md`, lead-only): merge `docs/opus-bay/ledger/w3-D2.md` (0 credits; the eight
  LM*-3D rows change from "raw only" to published / shipped or prototype).
- **G2** (optional, `data/sf/cityPois.ts`): the landmark part of `ZH_GLOSSARY` and `PLANNER_DROP` is now redundant (the
  source strings changed in D2-12); keep or drop as you like.

## Part b

### 给主人的摘要

- 地标的“高度”这次量准了：金门大桥的塔腿（42 米级）和整条主缆、Sutro 电视塔（半径约 6）、市政厅穹顶、艺术宫圆顶、恩典大教堂尖顶、风车叶片等都登记好了，鹈鹕滑翔会从上面越过去，不再穿模；矮的地标也不再被当成 24 米高的墙。
- 镜头升高（滑翔、快速旅行）时，远处地标改用简化版，唐人街高空视角省下约 5 千三角形；平时走路的画面完全不变。
- 缆车转盘：F 线路的转动圆盘出现时，地标自己的静态盘面会让位（F 已经接好）；顺手修了一个老问题——转盘原来整个埋在地面下 0.8 米，现在露出来了。
- 新增“近处房屋换精模”：玩家 40 米内最多 12 栋普通小楼换成 AI 精细房屋（维多利亚、爱德华、马里纳等），颜色跟原楼一致，淡入不闪；手机中画质最多 8 栋；画面三角形已经超预算的地方（如马里纳这个视角）会自动不换。
- 这一段没花 Higgsfield 积分（0/80）；检查全绿。

### What was built

| task | files | what |
|---|---|---|
| D2-10 | `world/sf/landmarks/index.ts` | `WalkBlocker.top?` (LOCAL y), `SfLandmark.tall?: LandmarkTallPart[]` (glide circles), `blockerTops(l)` (own `top`, else the measured row), `tallParts(l)` (with measured tops); `landmarkWalkWorld` returns world tops. |
| D2-10 | `world/sf/landmarks/tops.ts` (generated) · `scripts/opus-sf/assets/{landmark-tops,topsMeasure,glbNode}.ts` | Every blocker's and tall part's top measured on the drawn lod 0 (the shipped AI swaps decoded in node with `draco3d`, the windmill's sails swept over their turn): a 0.25 u top-surface grid (triangle areas + edges, so walls count). A blocker's top is its roof: cells inside the landmark's tall parts do not count unless the blocker lies ≥ half inside them (a tower leg, a rotunda pier). Re-run `npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/assets/landmark-tops.ts` after changing a landmark (the test fails until you do). |
| D2-10 | 9 landmark modules | `tall` parts: GGB 4 legs (r 1.4, 42.5 u) + the main cables anchorage to anchorage every ≤ 5 u (16.7 u at mid-span, 42.5 at the saddles); Sutro r 6 (49.7 above base 46.4); City Hall drum + dome r 3.6 (17.7; the block's roof is 6.2); the rotunda r 4.6 (11.1); Grace flèche + twin towers (13.0 / 9.9 / 9.8; nave 7.9); de Young tower r 3.6 (11.2; museum 2.9); Oracle's 4 light standards (12.4; bowl 7.5); the Legion dome (5.7); the windmill sail disc r 4.45 (10.3); Ghirardelli clock tower (14.2). Explicit tops: GGB railings (deck + 0.8), the Sutro transmitter hut (1.8). |
| D2-10 | `world/sf/landmarks/context.ts` | `landmarkTallStructures(baseOf)` = every landmark's tall parts in world space (top = base + measured + `TALL_MARGIN` 0.5); a landmark ≥ 10 u tall without tall parts keeps the day-0 circle. Signature unchanged: E2's glide gets them without an edit. |
| D2-10 | `core/sfTerrain.ts` (additive) · `world/sf/sites.ts` `walkInputs` | Blocker tops travel with the walk data: the provider's `Blocker.top = base + top`, moved by `setLandmarkBase` (the renderer's base pins it). Low landmarks no longer read as 20–24 u walls to the glide (`glide.ts blockerTop` defaults), and a tap on a landmark wall now walks to its front like a city building (E2's `tapTarget` reads polygon tops). |
| C2-5 Sites | `world/sf/sites.ts` | `siteLod0Radius(tier, camH)`: 520 / 340 / 220 u while the camera is ≤ 30 u above the ground (`U.uCam` − `heightAt`), down to `LOD0_HIGH` 260 / 170 / 110 u at 120 u and above (10 u steps). `counts()` adds `camH`, `lod0`. |
| F's request | `world/sf/landmarks/cable-car-turntable.ts` · `sites.ts` | `setTurntableSpinner(on)` / `turntableSpinner()`: with F's spinning disc on, the lod 0 drops its deck, planks, rails across and pivot for a plain deck 0.1 u lower (no z-fight, nothing standing still through the turning disc). New `SfLandmark.buildKey()`: sites.ts rebuilds a mounted lod 0 when it changes. The far silhouette and SoloView keep the static disc. **F wired it** (`world/transitLayer.ts`, F's a9b87cb). Hyde & Beach and Taylor & Bay stay F's own aprons (F draws those sites; no landmark is needed there). |
| (bug) | `cable-car-turntable.ts` · `index.ts` · `sites.ts` | The turntable was **buried 0.8 u under the plaza** (and F's disc and the turning car with it): its 'terrain' base (the lowest ground within 10.7 u) found a gutter at 0.94 u while the drawn ground under the apron is 1.63–1.96 u. New `SfLandmark.baseLift` (sites.ts adds it to the far estimate and to the chunk's base, and pins the provider): the turntable stands 1.0 u above that point (base 1.94), flush uphill, ≤ 0.35 u proud on its skirt downhill. |
| D2-08 | `world/sf/kitSwap.ts` (new) · `sites.ts` | The near-player house-kit swap, below. API: `new KitSwap(src: L0Source, models: KitModels, { frameTriangles })`, `update(fx, fz, t, camH)`, `counts()`, `list()`, `dispose()`; pure `kitFit(b)`, `kitChoices(style)`, `lotFrame(b)`, `KIT_SWAP` constants. CitySites starts it lazily once the streamer is up (`cityStreamerLazy`, dynamic import with world/models.ts); `?kit=0` for A/B; `counts().kit`. |
| D2-13 | `world/sf/landmarks/SoloView.tsx` (unchanged) | The `?solo=kit` sheet (11 houses × authored + 5 pastel tints, `&time=night`, `&kit=<id>`) QA'd: the mask.g tint is strong on the kit (walls ≈ 0.9 G on 32–77 % of the texels); the weak tint noted in wave 2 was on the Painted Ladies' SAM textures, not the kit. No fix needed. |
| tests | `tests/opus-bay-sf-landmark-context.test.ts` (new, 7) · `tests/opus-bay-sf-kit-swap.test.ts` (new, 5) | tops.ts = the measurement (procedural and AI); the brief's tall parts; world placement; tops reach the provider and follow `setLandmarkBase`; the glide's roof over the GGB tower / mid-span; Sites LOD monotone + CitySites drops far lod 0s under a high camera; the turntable spinner (disc top, far disc, rebuild, baseLift). Kit: filters, cap / models / tris / no shadows / warmed program, quality mid / low, camH off, hysteresis and fades (join after 1.5 s, hide after 0.3 s, hold to 48 u, restore first), byte-exact index restore, cell drop, instance packing, the frame-budget room. |

**D2-08 in short.** Within 40 u of the player up to 12 toy L0 houses (8 at quality mid, none at low) become kit houses:
the recipe style picks the models; the facade (width : wall height + 0.35) must match the kit's within ±25 %; the depth
scales freely within 0.3–1.25 × the facade scale; slope ≤ 0.8 u; the street edge (l0index `frontYaw`) within 15° of
the lot's box. The kit faces the street, stands on the lot's lowest ground (like the recipe's walls) and is tinted with
the L0 wall colour. A join needs 1.5 s of being chosen, fades in over 0.3 s a hair larger than the toy house (× 1.02, no
z-fight), then the toy range is hidden; leaving restores the range first and fades out; a swap holds until 48 u; a
dropped cell releases at once. ≤ 6 models (one InstancedMesh each, 'ob-model-inst', `receiveShadow` only), ≤ 35k
triangles, off with the camera above 40 u, and never beyond the frame's room: the view stays ≤ 400k − 4k triangles
(the renderer's whole-frame count, sampled after the frame because WorldScene resets `info` before the world updates).

### Evidence

- Checks on the pushed code (D2-08 rebased on `fa44e6b`): `tsc` 0 errors, `eslint src/opus-bay tests/opus-bay-*` 0 problems,
  **606 / 606** opus-bay tests (hero regression and contracts included). After the lead's whole-repo lint note
  (`167fa38`): `npx eslint .` 0 errors, 42 warnings (all outside D2's files; the local `.vite-opus/` cache is
  excluded, it is not in git).
- **Tops in the city** (`streamer.terrain.forEachBlockerNear`, quality high): City Hall block 9.47 (= base 3.27 + 6.2),
  GGB legs 42.5 and rails 15.9, Oracle bowl 7.65, windmill 12.1 (base 1.8 + 10.3 of the sails), the Legion 25.7–28.8
  (base 23.8 + 1.9–5.1).
- **Sites LOD** (the perf table's `__perf.go` spot, quality high, golden, RTX; `qa/w3/D2/c2-5-sites-chinatown-120-ab.jpg`):

| view | before | after |
|---|---|---|
| Chinatown (Dragon Gate) street, camH 8 (P6) | 124 calls, 397.1k | 123 calls, 396.7k (unchanged by design) |
| Chinatown, camH 62 | 94 / 357.8k | 93 / 357.8k |
| Chinatown, camH 123 | 115 / 400.3k, 9 lod-0 landmarks | 111 / **394.8k**, 4 lod-0 landmarks |
| Twin Peaks, camH 133 | — | 62 / 264.1k, 3 lod-0 landmarks |

  P6: the street view's landmarks are 9.5k triangles in view (26k of lod 0 in all); its excess is elsewhere (hero
  buildings 97k, hero ground 47k, life 37k, actors 34k).
- **Turntable**: base 0.94 → 1.94 in the city; the lod 0 goes 586 → 486 triangles with the spinner on
  (`qa/w3/D2/d2-turntable-spinner-ab.jpg`: left the static disc under F's, right F's disc alone).
- **Kit swap** (`qa/w3/D2/d2-08-kit-city-ab.jpg`, each row toy | kit at the same pose: Mission day, Mission night,
  Marina before the budget guard, Haight golden; `d2-08-kit-phone-mid.jpg`; the sheet `d2-13-kit-sheet.jpg` golden /
  one column by day / night):

| spot (quality) | frame without kit | with kit | kit |
|---|---|---|---|
| Haight / Alamo Sq (high) | 66 calls, 287k | 67–69 calls, 316–322k | 12 on, 3 models, 34,678 tris, 3 draws |
| Mission, Abbey St (high) | — | 67–73 calls, 304–326k | 12 on, 4 models, 34,685 tris, 4 draws |
| Chinatown (high) | 123, 404.7k | 124, 407.6k | 2 on (only 2 lots fit) |
| Marina, Cervantes Blvd (high) | 101, **421k** | 101, 421k | 0: already over budget (before the guard: 12 houses, 456k) |
| Mission (phone 390×844 dpr 3, mid) | — | 49 calls, 221k | 8 on (the mid cap), 23,121 tris |

  Programs: the same with and without the kit (Haight 39 = 39): the kit reuses the warmed `ob-model-inst`.
  Candidates on the L0 index within 40 u at five spots: Haight 18, Marina 41, Mission 20, North Beach 4 (toy lots are
  wider than deep: facade width median 3.7 u, depth 2.7 u; the plan's footprint-aspect filter passes only 1–8 per spot).
- Credits: **0** (`docs/opus-bay/ledger/w3-D2.md`).

### Decisions

- **Measured tops, generated.** Hand-authored tops for ≈ 150 blockers would drift with the next model change; the
  table is re-measured by a script and pinned by a test that decodes the shipped GLBs, so an AI swap or a walk change
  cannot silently leave the glide with stale heights.
- **A blocker's top is its roof; domes, masts and spires are tall parts.** Otherwise City Hall's whole block would read
  17.7 u (its dome) to the glide and to E2's tap-to-facade. The ≥ half-inside rule keeps legs and piers at their
  tower's height.
- **The GGB cables as a row of circles** (≤ 5 u apart, r = cable plane + 0.45): the glide's search radius (≥ 1 u)
  closes the gaps; the pelican can still cross the span low (16.7 u at mid-span) but climbs over the saddles.
- **Sites LOD band 30 → 120 u** of camera height: a walking or driving camera never changes (the P6 street view does
  not move); at 120 u the far landmarks show their silhouettes, which read the same at that distance (the before /
  after shot differs only in far corners).
- **Turntable: `baseLift`, not a numeric base.** A numeric base (1.94) broke the frozen `sf-terrain` test, which uses
  the turntable as its 'terrain'-deck example; the lift keeps the 'terrain' rule and its deferral, and the renderer's
  lifted base is pinned in the provider.
- **Kit "aspect ±25 %" read as the facade's aspect** (width : height), with the depth free within 0.3–1.25. With the
  footprint aspect (the kit's 0.55) almost no toy lot qualifies (their median is 1.38); the facade is what the player
  sees, and a row house's party walls are rarely seen. The kits meant for corner or shop lots (Queen Anne, North Beach
  corner, mission mural) are chosen by fit + a lot hash: the city data carries no `CITY_FLAG.corner` / `shop` hints.
- **The kit fills only the frame's room** (≤ 400k − 4k): the budget is a hard gate, and the hidden toy ranges still
  count (degenerate triangles, not removed). Where the base view is already over budget, the toy houses stay.

### Known gaps

- **Marina (Cervantes Blvd) is 421k at quality high without the kit** (C2's budget): the kit stays off there; the
  Marina kit house shows only in lighter views. Chinatown takes only 2 kit houses (few lots fit the shophouse).
- **Night glass on three kit houses is sparse**: marina-mediterranean, sunset-doelger and edwardian-flats have almost
  no mask.r (0–1 % of texels), so at night they show few lit windows among lit toy houses. A mask pass from their
  textures (the dark-glass rule of `grade.py`) would fix it; not done here.
- Kit houses squash their depth (0.3–0.6 of the facade scale on typical lots): side walls and bay windows seen from a
  corner are compressed. The QA framing script sometimes put the camera inside the next building (toy streets are
  narrow): the city shots show the swaps, not a hero framing.
- The glide over the tall parts is verified with the node glide world (E2's `terrainGlideWorld` + the tall list), not by
  flying the pelican in the app. E2's `moveSystem` passes `heightAt(l.x, l.z)` as a 'terrain' landmark's base, which
  can read a deck or a roof rather than the base (see Requests).
- `CityTerrainProvider.landmarkBase(id)` still answers the walkInputs hint (0) for non-deferred 'terrain' landmarks
  (their blockers use the pinned base; nothing else reads it in the city).

### Not done (part c)

D2-09 landmark settings (incl. the Castro pocket and `landmarkPlazaSpots()` for F's crowd), D2-11 three routes, D2-14
route QA, HC-4 hero GLB compression / preload (the pelican with E2); the kit night-glass masks above.

### Requests

- **E2** (optional, `actors/moveSystem.ts cityTallStructures`): pass the renderer's base for 'terrain' landmarks (e.g.
  `cityTerrain()?.landmarkBase(l.id)` for deferred ones) instead of `heightAt(l.x, l.z)` (a deck or a roof under the
  centre reads high). Note: landmark polygon walls now carry `Blocker.top`, so `tapTarget` treats them as facades (tap
  City Hall → walk to its front), as M2 intends.
- **C2** (budget): the Marina view (`__perf.go(-360, 330, -340, 320)`, quality high) is 421k triangles without the kit;
  the kit swap stays off wherever the view is over 396k.
- **Lead** (`ASSETS-LEDGER.md`): nothing new from part b (0 credits).

## Part c

### 给主人的摘要

- 十个主要地标的"周边"都做好了：龙门下的 Grant Ave 接上了，头顶挂了一串串红灯笼（晚上会亮）；艺术宫的湖不再像一块凸起的板子，湖边有步道、长椅、路灯、柳树和两只天鹅；金门大桥南端终于有路接上城市的 Merchant Road，旁边还有观景平台；Fort Point、花卉温室、迪扬博物馆、荷兰风车、市政厅、双峰、卡斯特罗剧院也都加了广场、花园、路灯和长椅。卡斯特罗剧院原来整栋"朝反了"（正门对着背后 Hartford 街的房子，所以像被困在小角落里），现在转过来正对 Castro St（按 OpenStreetMap 核对过）；到达点暂时还在剧院背后，要主管连同 G2 的对照表一起挪（见 Requests 1）。
- 被地标"切断"的街道都自动补回来了（例如市政厅旁的 Van Ness 大道、棒球场旁的 King St 和轻轨轨道）。F 线的游客已经站到这些广场上了。
- 三条完整路线做好了：唐人街→北滩→科伊特塔（长 396）、码头绿地→艺术宫→克里西场→Fort Point→金门大桥南塔（1,051）、金门公园→海洋海滩（1,403），每两个有名字的地点之间都不超过 225。
- 五个老的主角模型（BAYBAY、鹈鹕、帆船、两只海狮）文件从 1.36 MB 压到 0.91 MB，游戏里看起来一样。
- 没花 Higgsfield 积分（整条线 0/80）；检查全绿（674 个测试通过）。还没达标的一项：路线上"屏幕里总能看到一个大地标"的比例实测 72–82%（目标 90%），金门公园那段要等第四波把公园里的新地标接进来。

### What was built

| task | files | what |
|---|---|---|
| D2-09 infra | `scripts/opus-sf/assets/{landmark-settings,settingsMeasure}.ts` → `world/sf/landmarks/settingData.ts` (generated) | For each landmark whose module reads it (15): its base exactly as the renderer computes it (numeric, or the chunk's `buildL1` 'terrain' base + baseLift), the **drawn** city ground on a local 2 u grid over the exclusion's box (+1 u; max-pooled ±0.5 u so draped ground never sinks into a kerb), and the city streets its exclusion clips (class, right-of-way, local centreline; y at the street's own height at the exclusion edge and on the sunk ground 2 u inside, never under the ground across the street's width). 30.9 KB raw, 9.2 KB gzip, city chunk only. |
| D2-09 infra | `world/sf/landmarks/setting.ts` (new) | `settingGround(id)` (a lane-L `SiteGround`, so `siteKit`'s gfill / gstrip / crosswalk / benches / lamps / trees drape on it), `streetStrips(id, keep)` (the clipped streets drawn the city's way: sidewalk band, asphalt, kerbs, centre dashes, footways, rails; `keep` drops the segments under the landmark and a piece splits into the runs that stay), `streetGround(cls, w, pts, …, drape?)`, `ringBand(poly, d0, d1, y)` (a coping / bank round a polygon), `clearOf(blockers)`, `plazaSpots(polys)`. |
| D2-09 infra | `world/sf/landmarks/index.ts`, `world/sf/sites.ts` | `LandmarkGround.ys` (draped polygons: one height per vertex) and `.angle` (pattern angle); `SfLandmark.sink` (the city ground's sink inside the exclusion, default 0.2; 0 where a setting restores streets at their own height); `buildGroundMesh` drapes (lane L's `SiteGroundPoly` draws draped too); `landmarkSink(l)`. |
| D2-09 | `world/sf/landmarks/context.ts` | `landmarkPlazaSpots()` = each landmark's SiteHooks `plaza` polygons sampled on a 2.5 u grid (at least one row / column on a thin strip), ≤ 8 per landmark, spread, never within 0.25 u of the landmark's own blockers; computed once. 44 spots on 10 landmarks. **F consumes it** (F11, `09eee9a`: sightseers facing the landmark). |
| D2-09 | 10 route / T1 landmarks | **Dragon Gate**: the frame 0.55 u south (its side bays cut 0.4 u into the north-west corner building), Grant Ave restored under the arch (sink 0), three red lantern strings over Grant Ave (lit, with light points), the Bush St sidewalk as its plaza. **Palace** (CS-13): water 0.18 u over the sunk lawn inside a pale stone coping and a bank down to the lawn (no rim wall); the shore walks, Palace Drive and the Presidio Parkway corner restored outside the lagoon and the buildings; 5 benches facing the rotunda, 5 lamps, 5 willows, 3 cypresses, 2 swans. **GGB** (CS-11): the deck end runs on as a street draped on the bluff into Merchant Road at its Lincoln Blvd junction; a paved viewing terrace west of the deck end (benches, lamps); the clipped Coastal Trail pieces. **Fort Point**: Marine Drive's end loop, a granite apron and a sea-wall walk, 4 lamps, 2 benches, bollards, 3 cannons on the barbette; the sea wall's top pinned (0.35). **Conservatory**: the exclusion takes in the parterre and the two park sheds the city drew as houses; lawn, 4 flower beds, the entrance walk, lamps, benches, 2 palms; base pinned 16.61. **de Young**: a forecourt under the tower (the exclusion 4 u further north), benches, lamps, 2 sculptures, a basin, trees. **Windmill**: the tulip garden (lawn, 6 beds, hedges, a gravel ring and walk, lamps, benches), the service drive restored; base pinned 1.22. **City Hall**: the exclusion is the block (Van Ness Ave and Goodlett Pl are no longer cut), 2 flagpoles, 4 lamps, 2 planters; base pinned 3.27. **Twin Peaks**: Christmas Tree Point Road's loop restored with a striped car park and 2 lamps. **Castro** (the "pocket"): the model faced EAST, its facade looking at the backs of the Hartford St houses across its own block; the theatre stands on the east side of Castro St (OSM way 1206216224 spans lng −122.43504…−122.43445, Castro St's centreline −122.4352), so it is turned half round (yaw 140.3° → −39.7°) and moved 1 u east so the facade stands on Castro St's sidewalk with the marquee over it; its plaza is the sidewalk under the marquee. (A first fix this part made a forecourt on the Hartford side; replaced.) |
| D2-09 | 5 more T2 | Clipped streets restored outside their blockers: **Oracle Park** (King St + the Muni Metro tracks, 26 u), **Mission Dolores** (Chula Lane), **Painted Ladies** (Grove St), **Chase Center** (plaza walks), **Peace Pagoda** (the Peace Plaza walk). |
| D2-11 | `data/sf/routes.ts` (new), `data/sf/routePaths.ts` (generated), `scripts/opus-sf/assets/routes-build.ts` | `SF_ROUTES`: R1 Chinatown → Coit (6 stops), R2 Marina Green → the GGB south tower (10), R3 Golden Gate Park → Ocean Beach (11). Stops: landmark stops at their arrival (sfLandmarkAnchor, written out), places on their places.json rows, the wave-4 extra places through lane P's attraction ids (their arrival); `via` waypoints steer a leg (R1 walks up Grant Ave toward Coit). BAYLINK per route: planner `chinatown` · `palace`, `presidio`, `golden-gate` · `golden-gate-park`; guides `sf-chinatown-north-beach-walk-guide` · `sf-palace-fine-arts-marina-guide`, `sf-golden-gate-bridge-fort-point-guide`, `presidio-picnic-day-guide` · `golden-gate-park-free-car-free-day-guide` (no month-tagged guide). The walks are the walk graph's A* from stop to stop (the game's own routing), 1 u simplified. |
| D2-14 | `scripts/opus-sf/routes-qa.mjs` (new) | Walks each route in the app every 25 u (the city focused and ready, the player teleported onto the walk, the camera facing the walking direction) and records calls / triangles / programs, the AI parts in view (triangles, draws, shadow casters) and the landmarks on screen through the real camera (projected bounding boxes: the SF registry's T1 / T2 and the district's Coit / Transamerica / Salesforce / Ferry Building); JPEGs at every stop; a JSON per route and a gate summary. |
| C2 request 2 | `world/sf/sites.ts` | `AI_R` = 220 u (+30 to leave): a shipped swap draws its GLB parts only that close to the focus and the procedural lod 0 beyond (it reads the same at that distance); crossing rebuilds the lod 0, the models stay retained. |
| HC-4 | `docs/opus-bay/kit-jobs/hero_glb_pack.py`, `public/opus-bay/models/{baybay,pelican,sailboat,sea-lion,sea-lion-bark}.glb`, `data/assets.ts`, `world/models.ts` | The five district heroes packed for the **bare** GLTFLoader E2 and F use (no loader change): int8 normals, uint16 UVs (KHR_mesh_quantization), uint8 skin weights and int16 animation rotations (core glTF), WebP base colours (EXT_texture_webp); positions stay float (life.ts bakes the node matrix into a clone of the geometry, BAYBAY is skinned). **1,361,088 → 908,300 B** (BAYBAY 599,156 → 368,516). `heroGltfLoader()` = the shared Draco-capable loader for the Draco step (Requests 2). |
| tests | `tests/opus-bay-sf-landmark-context.test.ts` (+5), `tests/opus-bay-sf-routes.test.ts` (new, 5), `tests/opus-bay-sf-models.test.ts` (+1) | settingData = a fresh measurement (5 landmarks) with exactly the 15 rows; every draped vertex of the 10 settings on the drawn ground (not buried, not floating > 0.8 u); City Hall clips no avenue, Grant Ave asphalt under the gate (sink 0), the Palace walks never cross the lagoon, King St restored, the GGB approach from the deck to Merchant Road; CS-13 water ≤ 0.25 u over the ground and no rim wall; the city's Castro St centreline runs 4–7 u in front of the Castro's facade and none behind it (and `sf-landmarks` now asserts the theatre faces west); plaza spots clear of blockers. Routes: ids exist (places.json, attractions, landmarks, planner, guides), stops on their anchors, the walks fresh and passing each stop ≤ 12 u, gaps ≤ 225 u, lengths within the plan's; the on-screen proxy. AI_R and its hysteresis. |

**API for other lanes.** `landmarkPlazaSpots()` (F: in use). `SF_ROUTES`, `sfRoute(id)`, `routePath(id)`, `routeGaps(id)`,
`routePointAt(id, s)`, `ROUTE_GAP_MAX` from `data/sf/routes.ts` (data only: GameRoot may import it) for G1 (discovery,
map route lines), G2 (stop slots / lines) and F (crowds along a route). `heroGltfLoader()` from `world/models.ts`
(import it dynamically). For lane L (wave 4, inherits these files): `LandmarkGround.ys` draws draped now,
`SfLandmark.sink`, and `setting.ts` builds on `siteKit`.

### Evidence

- **Checks** on the pushed head `503fa8f` (rebased on `b87326e`): `tsc` 0 errors; `npx eslint . --ignore-pattern
  ".vite-opus/**"` 0 errors (42 warnings, none in D2 files; `.vite-opus/` is the local dev cache, not in git);
  **674 / 674** opus-bay tests (hero regression and contracts included).
- **Settings, before / after** (golden, desktop 1440×900, quality high): `qa/w3/D2/d2-09-before-after-1.jpg` (Dragon
  Gate, Palace lagoon, GGB south end, Conservatory) and `-2.jpg` (windmill, Castro — the Hartford-side forecourt shown there was replaced by the turn, see `d2-09-castro-turned.jpg` —, Twin Peaks, City Hall); **night**
  (after): `d2-09-night-1.jpg`, `-2.jpg` (lanterns over Grant Ave, lamps round the lagoon, City Hall's flags and lamps,
  the Conservatory lit); the Castro turned to Castro St (top view, aerial, street view golden / night): `d2-09-castro-turned.jpg`; **phone** 390×844 dpr 3, quality mid: `d2-09-phone-390.jpg`; the T2
  streets (Oracle Park's King St): `d2-09-t2-streets.jpg`. Scratch (every take, the plan views of each setting, the QA
  scripts `c/{set,plan,lmposes,…}`): `C:/Users/willy/opus-qa/w3/d2/c/`.
- **Budget** (`window.__opusBay.city.stats()`, quality high): Chinatown at the gate 124 calls / 395.7k (before 121–124 /
  395–400k at the same poses: the lanterns and the street strip cost < 1k), the Palace 67–72 / 183–190k, City Hall 80 /
  316k, Castro 68 / 261k (phone, mid). Programs unchanged at every spot (the setting ground is the city's GROUND program,
  the furniture the lod 0's TOY). Lod-0 triangles within every tier budget (Palace 5,374 / 6,000, Fort Point 2,188 /
  2,500, Conservatory 2,088 / 2,500).
- **AI parts within 220 u** (C2's request): Ocean Beach walk — AI parts 1 (the windmill), `city.landmarks` 17.3k (C2
  measured 23–43k there); Alamo Square walk — AI 2 (City Hall, Mission Dolores), 12.7k AI triangles, 333.6k in all.
- **Routes** (`routes-qa.mjs`, desktop, golden, quality high, RTX; `qa/w3/D2/d2-11-routes.jpg` = the stops):

| route | length | stops | longest gap | samples | landmark on screen (in app) | max calls | max tris | programs | AI tris / draws / casters |
|---|---|---|---|---|---|---|---|---|---|
| R1 Chinatown → Coit | 396 u | 6 | 173 u | 17 | **76.5 %** | 116 | 365k | 41–42 | 11.8k / 2 / 0 |
| R2 Marina Green → GGB | 1,051 u | 10 | 210 u | 44 | **81.8 %** | 93 | 251k | 41–42 | 5.9k / 2 / 1 |
| R3 GGP → Ocean Beach | 1,403 u | 11 | 219 u | 58 | **72.4 %** | 103 | 297k | 40–42 | 11.8k / 2 / 0 |

  Every budget gate passes (≤ 150 calls, ≤ 400k triangles, AI ≤ 60k / 12 / 6); the G5 on-screen gate (≥ 90 %) does not
  in the app. The node proxy (a follow camera looking along the walk) gives ≥ 90 % on R1 and R2 and 60–70 % on R3
  (≥ 90 % once lane L's park sites are counted). The app's camera does not always face the walking direction and sits
  low among the roofs in narrow streets (CS-10); R1 turns away from Coit round Washington Square; R3's last 250 u run
  south along Ocean Beach with no landmark ahead.
- **HC-4** (district, `?at=sea-lion-viewpoint`, BAYBAY swapped in): the sea lions, the pelican and BAYBAY render as
  before, no console error (`qa/w3/D2/hc4-district.jpg`). Bytes above; `ledger/w3-D2.md` part c.
- Credits: **0** (lane total 0 / 80).

### Decisions

- **Measure the ground, do not guess it.** Settings drape on the renderer's own drawn ground (`chunkContext.height`,
  the sink included) sampled offline, with the exact base the renderer will compute; a test re-measures five
  landmarks, so a changed exclusion or published city fails loudly instead of burying a plaza.
- **Restore clipped streets generically** instead of shrinking exclusions: the exclusion keeps its job (dropping city
  buildings, props and street furniture under the landmark), the streets run on the city's way at their own heights,
  and pieces under the landmark's own blockers stay out. By hand: City Hall's exclusion became the block (the circle cut
  two avenues); Lombard, Ghirardelli, the turntable, the Legion, the Cliff House and Sutro Baths keep their own streets
  and terraces (a restored city street there would fight them).
- **Pinned numeric bases** where a setting widened an exclusion (Conservatory 16.61, windmill 1.22, City Hall 3.27,
  Castro 8.9): the 'terrain' base is the lowest ground in the exclusion's circle, and the wider circle reached 0.1–1.3 u
  lower ground, which would have sunk the buildings.
- **The Dragon Gate moves 0.55 u** rather than shrinking: its 2.2 u walk-through passage needs the toy width, and the
  shift clears the corner facades; its arrival moved 0.55 u back so its world spot (and G2's `arrivals.ts`) stays.
- **Arrivals stay** where others would read better (Palace, Fort Point, de Young): `data/sf/arrivals.ts` (G2's P7
  mirror, checked by G2's test) must change in the same commit — Requests 1, with the values.
- **Routes as data + generated walks**: the stops are authored (BAYLINK ids, lines), the walks come from the game's own
  A* on the published graph and the test re-checks them, so a re-baked graph shows up.
- **HC-4 without Draco**: Draco needs a DRACOLoader in E2's and F's loaders; the packing above needs none and is safe
  for district mode today. Draco would take the five to roughly 250–300 KB (Requests 2).
- **AI parts within 220 u**: beyond it a 6k-triangle GLB is a few pixels tall and the procedural lod 0 (1–2k) reads the
  same; the rebuild at the ring is one lod-0 build (already rate-limited to one a frame).

### Known gaps

- **G5 on-screen gate in the app: 72–82 % (target 90 %)** — see the routes table.
- **Castro arrival**: its arrival keeps its old world spot (now behind the theatre, on Hartford St) until the lead moves
  it together with G2's `arrivals.ts` (Requests 1); the Castro is on no route.
- Restored street edges can step by up to the sink (0.2 u) within 1–2 u of an exclusion edge (the drawn ground ramps
  over one raster cell there).
- Twin Peaks' terrace still reads as a raised block from downhill (its retaining wall is by design); only its setting
  changed. Sutro Tower got no setting (its compound already reads; a fence would cut its arrival path).
- Kit night-glass masks for marina-mediterranean / sunset-doelger / edwardian-flats (part b's finding): not done; their
  SAM atlases have no bluish glass for the stencil, and a darkness rule needs a night pass on the `?solo=kit` sheet.
- The route QA teleports along the walk; a real walk-through (click-to-walk, E2's RouteWalker) was not timed.

### Not done (for the lead)

1. The G5 on-screen gate for the three routes: re-run `routes-qa.mjs` after lane L's park sites are integrated (R3)
   and after the CS-10 camera work (R1 / R2); if still short, add a T2 landmark near R1's Washington Square (Saints
   Peter and Paul, W4 "defer") or re-route R1.
2. The three arrival moves (Requests 1).
3. Draco for the district heroes (Requests 2).
4. Kit night-glass masks (three houses).
5. The remaining T2 settings beyond street restoration: Grace Cathedral (Huntington Park steps), the Legion (the court's
   approach), Ghirardelli, Fisherman's Wharf, Sutro Baths / Cliff House, Lombard, the turntable (F's aprons).

### Requests

1. **Lead** (`data/sf/landmarks.ts` is D2's, `data/sf/arrivals.ts` is G2's: change them in one commit; G2's `sf-content`
   test prints the arrivals table to paste, and `tests/opus-bay-sf-routes` then asks for
   `npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/assets/routes-build.ts`, since R2 / R3 stop on these):
   - `palace-of-fine-arts` arrival `{ x: 1.5, z: 16.6, heading: Math.PI }` (world −409.64, 409.63, heading 5.498): on
     the lagoon's south shore walk in front of the rotunda — E2's part-b request 2 (the old spot is a gap between the
     Baker St houses); R2's `r2-palace` stop → x −409.64, z 409.63.
   - `fort-point` arrival `{ x: 2.4, z: -4.9, heading: 0 }` (world −747.66, 598.89, heading −2.147): on the new apron at
     the landward wall instead of 3.2 u up the bluff; R2's `r2-fort-point` stop → x −747.66, z 598.89.
   - `de-young-tower` arrival `{ x: 3.2, z: -2.0, heading: -1.01 }` (world −243.90, 928.60, heading −1.010): in the
     forecourt facing the tower instead of Music Concourse Drive; R3's `r3-de-young` stop → x −243.9, z 928.6.
   - `castro-theatre` arrival `{ x: 0, z: 7.3, heading: Math.PI }` (world 147.76, 746.15, heading 2.449): across Castro
     St from the (turned) facade; today `{ x: 0, z: -7.5, heading: 2 * Math.PI }` keeps the old world spot (157.21,
     734.76, heading 5.59) so `arrivals.ts` and lane P's `LANDMARK_ARRIVALS` stay valid (both tests print the table).
2. **E2** (`actors/system.ts` `loadGuideGlb`) and **F** (`world/life.ts` `loadModel`): load with
   `(await import('../world/models')).heroGltfLoader()` instead of `new GLTFLoader()` (keeps DRACOLoader out of the
   district's first load; the heroes load after Start anyway); then D2 or the lead can publish Draco + WebP versions of
   the five heroes (≈ −70 % more). Until then the packed files work with the bare loader.
3. **C2** (P5): programs drift from 40–41 to 42 along each route (`routes-qa.mjs` JSON in
   `C:/Users/willy/opus-qa/w3/d2/routes/`): one or two programs link after the warm-up on the first route stop in city
   mode.
4. **Lane L (wave 4)**: `sites.ts` now drapes your `SiteGroundPoly.ys`; R3's on-screen gate counts on your Golden Gate
   Park sites (their `w4.height` is what `tests/opus-bay-sf-routes` uses); `setting.ts` imports your `siteKit` (keep
   `gfill`, `bench`, `lamp`, `tree`, `palm`, `conifer`, `planter`, `hedge`, `bollard`, `flagpole`, `GC`, `PAT` and
   `SiteGround` stable, or update D2's callers when you inherit them).
5. **G1 / G2**: the routes are ready to show (map lines, discovery chips, stop lines): `SF_ROUTES` in `data/sf/routes.ts`.
6. **Lead** (`ASSETS-LEDGER.md`): merge `ledger/w3-D2.md` part c (0 credits; the HC-4 re-pack note).
