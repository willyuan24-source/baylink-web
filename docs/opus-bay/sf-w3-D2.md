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
