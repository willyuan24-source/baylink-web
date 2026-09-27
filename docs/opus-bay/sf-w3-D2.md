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
