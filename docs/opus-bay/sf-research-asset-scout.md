# SF research — asset scout: Higgsfield asset plan for a whole-SF Opus Bay

Role: asset-scout (research phase). No paid jobs were run: I only ran `get_cost:true` preflights, checked the balance and read earlier work. **Balance before and after: 748.48 credits.** The preflights used earlier job ids as the media inputs, and nothing was submitted.
Worktree read-only. GTA_SZ read at `C:/Users/willy/opus-qa/ref/GTA_SZ` (main @ 73603f3). Its code is MIT, so ideas are cited with attribution. Its assets are not reused.

---

## 0. TL;DR

1. **Generate only what procedural code can't do well.** That means sculpted, ornamental or organic silhouettes: Victorian "Painted Lady" houses, the Palace of Fine Arts rotunda, the Chinatown Dragon Gate, the cable car, the Conservatory of Flowers, and a few props and creatures. Build these procedurally: bridges, towers, City Hall, colonnades, forts, stadiums, ground, generic facades and horizon hills. Opus Bay already builds every building with vertex colours and shader windows (`world/materials.ts:3-13`, `:247-280`). GTA_SZ also builds all 50 of its landmarks procedurally in Blender, not with AI 3D (`scripts/city_mesh.py:1-4`, `scripts/landmarks/coco_park.py:5-30`).
2. **The 3D model choice comes down to price, so do a bake-off first.** Preflights: Tripo H3.1 costs **9–12** credits, Hunyuan3D v3 LowPoly **14**, SAM 3 3D **1**, Meshy image_to_3d **30** (the same at 8k or 15k target) and Meshy v7 **38–44**. Meshy is the only model with a track record here: 5 of 6 meshes usable (`ASSETS-LEDGER.md:31`, `:105-119`). Spend 57 credits running all four on one Victorian house, then use the cheapest model that passes the QA gate for everything else.
3. **Plan total ≤ 450 credits.** Expected case (Tripo wins): **355.5**. Worst case (only Meshy passes): **375.5**. That leaves a reserve of **≥ 74.5**. A ranked order with stop rules lets the run end early (§8).
4. **Compress every GLB with Draco + WebP.** I measured this with Blender 5.2 re-exports of the shipped GLBs: pelican 223.8 → **89.7 KB** (−60 %), sailboat 178.2 → **76.0 KB** (−57 %), baybay 595.3 → **197.1 KB** (−67 %). The decoder (250,876 B) already ships inside `node_modules/three/examples/jsm/libs/draco/gltf/`, so it adds no npm dependency.
5. **Don't generate horizon panoramas, ground textures or a general facade atlas.** They would break the floating-slab look (DESIGN.md:23, 57) and the vertex-colour toy material. AI 2D goes to things only a painter can make: 12 new postcards, an illustrated SF map repainted image-to-image from our own geometry, neighborhood badges, original murals, shopfront strips, and 6 resident portraits.

---

## 1. What exists and what earlier passes taught us

**Shipped GLBs** (measured with a GLB header parser, scratch `glbinfo.mjs`):

| file | tris | verts | texture | bytes | bbox (u) |
|---|---|---|---|---|---|
| baybay.glb (skinned, 5 clips) | 8,326 | 7,395 | JPEG 1024² (105 KB) | 599,156 | 0.85 × 1.30 × 0.79 |
| pelican.glb | 2,909 | 4,438 | JPEG 512² (61 KB) | 223,224 | 0.48 × 1.00 × 0.76 |
| sailboat.glb | 1,939 | 3,254 | JPEG 512² (59 KB) | 177,796 | 1.04 × 4.96 × 4.00 |
| sea-lion-bark.glb | 2,907 | 3,685 | JPEG 512² (47 KB) | 185,328 | 0.78 × 1.05 × 1.16 |
| sea-lion.glb | 2,909 | 3,457 | JPEG 512² (45 KB) | 175,584 | 1.18 × 0.75 × 1.60 |

- **Geometry, not texture, dominates file size.** baybay's texture is 105 KB of 585 KB, and each creature's is 45–61 KB of 171–218 KB. That is why Draco saves 57–67 % while WebP alone saves only 7–9 % (§5).
- **Meshy overshoots its triangle target slightly, and the raw output is heavy.** Targets of 5000 gave 5117–5182 tris, and target 8000 gave 8181–8326 (raw files in `assets-work/creatures/raw-*.glb` and `char3d/raw/*.glb`). Every raw file carried a 2048² JPEG of 2.2–3.5 MB inside a 2.5–3.7 MB GLB.
- **Cleanup pipeline.** Previous passes used Blender (`assets-work/creatures/cleanup.py`, flags `--yaw --measure --size --max-tris --tex --vcol`, lines 1–25) to join, weld and collapse-decimate (line 93). They also recentred to bottom-centre with front at +Z, set metallic 0 / roughness 0.9, and exported a 512 JPEG q82 with no Draco (`ASSETS-LEDGER.md:34`).
- **Comment drift.** `data/assets.ts:185` says baybay has a "512 px JPEG", but the measured texture is 1024².

**Lessons from the ledger** (these shape the prompt rules in §9):
- **A single object on a plain cream background works for 3D.** The creatures used GPT Image 2.5 (high) concept images at 1.5 credits each, then Meshy at 30. All 4 were usable first try (`ASSETS-LEDGER.md:22-31`).
- **Thin parts fail.** The newcomer mesh M7 had "thin tattered shells that spike" for the pack straps (`:115`). A simplified, chunky reference (H5 → M8) fixed it (`:117-119`).
- **`pose_mode` can delete geometry.** Asking for an A-pose dropped the backpack (`:106`).
- **Image models add bases and frames nobody asked for.** One jogger was drawn standing on a diorama base (`:111`). Postcards came back as cards on mats and had to be cropped (`:71`, `:74`). A tiny painted car number had to be removed (`:79`).
- **Meshy auto-rigging failed twice** (refunded) on chibi proportions (`:114-116`).
- **Colours drift off-brand.** The sea lions came back "saturated orange", so runtime keeps only the luminance and tints per instance (`world/life.ts:174-186`). BAYBAY's fur and the newcomer's pack were re-graded to brand hex values in Blender (`ASSETS-LEDGER.md:127-128`). **Plan a colour-grade step for every asset.**
- **Rejection rate for 2D art is about 45 %.** 27 Nano Banana Pro images produced 10 shipped images (`public/opus-bay/README.md:163`). Budget about 1.75 generations per shipped postcard or illustration.
- **Spend so far: 337.23 credits** over two passes (`RESUME.md` update 2026-09-26). The balance now is 748.48.

## 2. How GTA_SZ handles assets (only what matters for this plan)

- **Landmarks are code, not AI meshes.** Each landmark is a Python module on a shared Blender builder API. `B.box / tube / loft` are at `scripts/city_mesh.py:40-60`, and an example landmark is `scripts/landmarks/coco_park.py:5-30`. Inputs are JSON evidence specs such as `data/landmarks/*.json`. The combined `landmarks.glb` is 38 meshes, **276,596 tris, 2.27 MB** with `EXT_meshopt_compression` + `KHR_mesh_quantization`. `landmark-detail.glb` is 210,204 tris, 2.16 MB.
- **Guiding rule.** "Recognizability over window count" (`docs/landmarks/agent-workflow.md:93`). Also: finish one landmark *and a believable street around it* before the next, and don't leave a detailed tower above empty ground (`docs/landmarks/shenzhen-landmark-roadmap.md:7`).
- **Budgets.** One building or compact group: ≤ 25,000 tris, ≤ 12 materials, ≤ 8 MiB. New on-screen content: ≤ 150,000 tris and ≤ 60 extra draw calls (`agent-workflow.md:150-155`). That is heavier than what our diorama can afford (§10).
- **Facade textures.** Only **3** base albedos were AI-generated ("image_gen"), then resized to 512² (`data/materials/architecture-textures.json:16-17`). The main facade atlas is **hand-authored procedural PIL art**: 8 families of 256×512 in a 1024² atlas (`scripts/make_facade_diversity_atlas.py:10`). It uses gutter padding so low mip levels don't bleed between families (`:51`). The glass stencil is `(B−R ≥ 28) & (G−R ≥ 18)`, and the roughness sits in alpha (`:57`). A relief atlas is derived from it (`scripts/make_facade_relief_atlas.py:1-20`).
- **Far shore and sky.** The opposite shore is real terrain: `opposite-shore.glb` has 48,868 tris in 177 KB, built from Copernicus DSM (`scripts/build_coastal_infrastructure.py:73`). It is not a painted panorama. Sky lighting uses CC0 Poly Haven HDRs of 6.5–20.7 MB each (`public/assets/ATTRIBUTION.md:7-10`, `public/city/environment/`). We can't afford those, and they don't fit our style.
- **Small props are code-built too.** Tree 5,156 tris, palm 2,356, traffic car 3,836, pedestrian 1,180, bicycle 1,412 (all measured). This shows that vehicles and bikes don't need AI.
- **What to borrow (MIT, with attribution):** the glass-stencil formula for night-window masks on AI textures, gutter padding for atlases, and per-object tri/material/byte budgets checked in a finalize script (`scripts/finalize_city_assets.mjs:15-21`).

## 3. Opus Bay constraints that decide generate-vs-procedural

- **Most static geometry shares two vertex-coloured materials** (`world/materials.ts:3-13`). The **TOY** material gives six procedural window styles on vertical faces, lit at night by per-building occupancy (`:247-280`). It also provides pier-shed doors (`:231-246`), warm lit openings (`:282-286`), contact AO (`:288`) and the occlusion dither-fade (`:214-229`). Hero landmarks fade as a whole via `OB_HERO` (`:211-213`, `makeToy` at `:296-302`).
- **A textured GLB skips all of that today.** It keeps its own material, gets roughness 0.88 / metalness 0, and nothing else (`world/life.ts:309-322`). So every AI landmark needs a TOY-with-map material variant, or a bake to vertex colours, to get night windows and fade (§11).
- **Existing landmarks are already procedural, and cheaply.** In `world/landmarks.ts`: `ferryBuilding` 54–148, `coitTower` 163–198 (fluted column 149), `transamerica` 199, `salesforce` 250. In `world/backdrop.ts`: `bayBridge` 39–111, Marin and East Bay ridges 342–391. City Hall (lathe dome), Golden Gate Bridge, Legion of Honor, Fort Point, de Young (twisted tower) and Sutro Tower (lattice mast) are all the same kind of work.
- **Victorian houses are procedural already.** Pastel walls, trim bands, gable roof and a bay window (`world/city.ts:104-121`), at **4.2–6.4 u tall** (`data/district.ts:870, 878`).
- **Budgets.** Hard limits are ≤ 150 draw calls, ≤ 400k tris and ≤ 500 objects (DESIGN.md:87). Measured today: 52–64 calls and 144–223k tris (STATUS.md:161-166). That leaves about **85 calls and about 175k tris** for everything new, and whole-SF streaming has to share that.

## 4. Preflight costs (get_cost:true, measured 2026-09-26)

**3D**

| model | params | credits |
|---|---|---|
| `image_to_3d` (Meshy) | textured, remesh, triangle, target 8,000 | **30** |
| same | target 15,000 | **30** (polycount doesn't change price) |
| same | untextured | 20 |
| `multi_image_to_3d` (Meshy) | 3 views, textured, target 10,000 | **30** |
| `meshy_v7_image_to_3d` | lowpoly or standard 10k, textured | 38 |
| same | `ultra_mode` | 44 |
| same | lowpoly untextured | 25 |
| `tripo_h3_1_image_to_3d` | face_limit 10k (or 15k), texture std, geometry std, with or without pbr | **9** |
| same | texture detailed, geometry std | **12** |
| same | texture + geometry detailed | 18 |
| same | untextured, face_limit 5k | 6 |
| `tripo_h3_1_multiview_to_3d` | 2 views std | 9 |
| same | 4 views, texture detailed | **12** |
| `hunyuan3d_v3_image_to_3d` | LowPoly, triangle, 1 view | **14** |
| same | LowPoly, 2 views | 18 |
| same | Normal, face_count 40k | 15 |
| `sam_3_3d` | textured or untextured | **1** |
| `meshy_v6_text_to_3d` | lowpoly, full or preview | 25 |

**2D**

| model | params | credits |
|---|---|---|
| `nano_banana_pro` | 1k or 2k, any aspect, with or without ref | **2** |
| `nano_banana_pro` | 4k (1:1 or 21:9) | 4 |
| `gpt_image_2_5` | low / medium / high 1k | 0.25 / **0.5** / **1.5** |
| `gpt_image_2_5` | high 2k / xhigh 2k / high 1k transparent | 2.75 / 4.5 / 1.5 |
| `nano_banana_2` | 1k / 2k | 1.5 / 2 |
| `seedream_v5_pro` 2k / `seedream_5_0_flash` 2k | | 2.5 / 0.5 |
| `flux_2` pro 1k / `z_image` | | 1 / 0.15 |
| `recraft_v4_1` | standard / utility_vector | 1.25 / 2.5 |
| `image_background_remover` | | 1 |

What the numbers mean:
- **Tripo H3.1 is 2.5× cheaper than Meshy.** At the same price as one Meshy job we can try three Tripo meshes.
- **Meshy v7 isn't worth it.** It costs more than Meshy and has no track record with our style.
- **SAM 3 3D is almost free.** Always include it in tests.
- **Hunyuan LowPoly outputs faceted, flat-shaded geometry.** That clashes with the soft-clay brand, though smooth shading in Blender may rescue it. Its face count and whether it's textured are unconfirmed. Treat it as an experiment.

## 5. Measured: Draco and WebP on our own GLBs

I re-exported the shipped GLBs with Blender 5.2 into scratch only, WebP/JPEG quality 82. The exporter options exist in 5.2: `export_image_format` AUTO/JPEG/WEBP/NONE and `export_draco_mesh_compression_*` with defaults level 6 and quantization pos 14 / normal 10 / uv 12 / color 10.

| model | raw+JPEG | raw+WebP | Draco+JPEG | **Draco+WebP** |
|---|---|---|---|---|
| pelican (2,909 tris) | 223,800 | 207,520 | 105,984 | **89,660** |
| sailboat (1,939) | 178,212 | 161,376 | 92,884 | **76,008** |
| baybay (8,326, skinned + 5 clips) | 595,336 | 546,108 | 246,352 | **197,080** |

**Decoder cost.** `draco_decoder.wasm` (192,420 B) + `draco_wasm_wrapper.js` (58,456 B) = **250,876 B**. It is fetched once, only when the first Draco GLB loads. It pays for itself from about the third GLB, and whole SF will have 10–15.

**Meshopt alternative.** `meshopt_decoder.module.js` is only 29,256 B and also ships with three. But encoding needs gltfpack, a download that needs the owner's approval, so **Draco is the default**. The skinned baybay exported fine with Draco, but the skin still needs an in-game check.

## 6. Generate or build procedurally? The candidate list

| candidate | decision | reason |
|---|---|---|
| Painted Ladies Victorian (2 variants) | **AI 3D**, instanced and wall-tinted | The #1 SF signifier citywide (Alamo Sq, Haight, Mission, Castro). Carved trim and turrets are exactly where the procedural `victorian` case (`city.ts:104-121`) looks like boxes. |
| Palace of Fine Arts rotunda | **AI 3D** (rotunda only) | Sculpted dome, drum and planter boxes. The colonnade arcs and lagoon stay procedural, because AI melts repeated columns. |
| Chinatown Dragon Gate | **AI 3D** | Ornamental curved tile roofs and dragons, small footprint, walk-through. The gate text must be omitted. |
| Cable car | **AI 3D**, multiview | Rideable icon with 3–6 instances visible, one instanced draw call. Fallback: extend the procedural `world/streetcar.ts` (CAR_LEN 8.4 at `:22`, W 2.1 at `:44`). |
| Conservatory of Flowers | **AI 3D** | White greenhouse with a dome and lattice. At toy scale a painted lattice beats procedural bars. |
| Dutch windmill (Golden Gate Park) | **AI body** + procedural rotating sails | Sails must animate. Thin sails would fail anyway. |
| Toy car (traffic) | **AI 3D**, tinted per instance | One mesh with the luminance-tint trick (`life.ts:174-186`) gives any number of colours. |
| Mission Dolores | AI 3D (low priority) | The basilica towers are ornate. The adobe mission front is simple enough to do procedurally. |
| Bison (Golden Gate Park paddock) | AI 3D (optional) | Creatures are where AI 3D has worked 4/4 here. |
| Golden Gate Bridge | procedural | Thin cables, a 1,280 m span that must match nav. Same technique as `bayBridge` (`backdrop.ts:39`). |
| City Hall | procedural | Lathe-profile dome plus a Beaux-Arts box, like `ferryBuilding` (`landmarks.ts:54`). |
| Legion of Honor, Fort Point, Ghirardelli, de Young, Sutro Tower, Sutro Baths, Oracle Park, Peace Pagoda | procedural | Colonnades, brick boxes, twisted extrusions, lattice masts, low ruins. AI melts repetition. Ghirardelli's sign is a trademark. |
| Muni bus, bicycle, ferry | procedural | Box-and-window shaders. Bikes are thin tubes, and GTA_SZ's code-built bike is only 1,412 tris. A ferry already exists. |
| Horizon panoramas (Marin, East Bay) | **no** | They contradict the floating slab on a cream table (DESIGN.md:23, 57). Use low-poly DEM ridges instead (`backdrop.ts:342-391`, GTA_SZ DSM shore). |
| Ground textures | **no** | The procedural GROUND patterns (`materials.ts:6-8`) never tile visibly and need no texture fetch. |
| General facade atlas (row houses, stucco, FiDi, SoMa brick) | **mostly no**; 2-credit A/B only | Add window styles to `materials.ts:247-280` instead: SoMa arched warehouse windows, Chinatown balcony band, Sunset stucco garage band. |
| Mission murals | **AI 2D** (atlas) | Art is the one thing the shader can't make. Murals must be *original*, not copies of real ones. |
| Shopfront strips | **AI 2D**, gated by an A/B | Ground floors are what the 38° camera sees most (DESIGN.md:74). |
| Illustrated SF map | **AI img2img** from our own geometry | Text-to-image maps are wrong geographically. Repainting a render of our own geometry keeps the coordinates. |
| Neighborhood icons | **AI 2D** sheet | One grid image gives a consistent set. |
| New postcards and portraits | **AI 2D** | Proven pipeline, cheap. Postcards drive the collectible loop. |

## 7. Costed plan (cap 450 credits)

W = cost of the bake-off winner per single-image mesh: Tripo 12 (expected) or Meshy 30 (worst). Concept images are `nano_banana_pro` 1:1 2k at 2 credits, count 2, with style reference **K6 `3617006b-483d-4ea7-9e72-39b681f8264f`** (the shipped key art source).

| # | asset | purpose | model and params | exp. credits | worst credits | fallback |
|---|---|---|---|---|---|---|
| S0-1 | Victorian house A concept (Queen Anne with corner turret) | bake-off input | nano_banana_pro 1:1 2k ×2, ref K6 | 4 | 4 | gpt_image_2_5 high 1k (1.5) |
| S0-2 | Victorian house B concept (Italianate, flat front, bay window) | second house type | same | 4 | 4 | same |
| S0-3 | **3D bake-off** on S0-1 | pick the model | sam_3_3d textured (1); tripo_h3_1_image_to_3d {face_limit 6000, texture true, pbr false, texture_quality detailed, geometry_quality standard, orientation align_image} (12); hunyuan3d_v3 {LowPoly, triangle} (14); image_to_3d Meshy {should_texture, should_remesh, triangle, target 6000} (30) | 57 | 57 | procedural `victorian` (`city.ts:104`) |
| L1 | Painted Lady house B mesh | instanced hero row, wall tint | W on S0-2 | 12 | 30 | house A with a different tint |
| L2 | Palace of Fine Arts rotunda | Marina hero | concept ×2 (4) + W | 16 | 34 | procedural lathe dome on 8 box piers |
| L3 | Cable car | rideable, Powell/Hyde/California lines | turnaround sheet nano_banana_pro 16:9 2k ×2 (4), cropped to 3–4 views; tripo_h3_1_multiview_to_3d {face_limit 5000, texture detailed} (12) or Meshy multi_image_to_3d target 5000 (30) | 16 | 34 | procedural from `world/streetcar.ts` |
| L4 | Chinatown Dragon Gate | Chinatown entrance, walk-through | concept ×2 + W | 16 | 34 | procedural posts plus 3 curved roofs |
| L5 | Conservatory of Flowers | Golden Gate Park hero | concept ×2 + W | 16 | 34 | procedural lathe dome plus wings with window style 6 |
| L6 | Toy car | traffic, tinted per instance | concept ×2 + W | 16 | skip | procedural rounded box |
| L7 | Dutch windmill body | Golden Gate Park west | concept ×2 + W | 16 | skip | procedural octagonal tower |
| L8 | Mission Dolores | Mission | concept ×2 + W | 16 | skip | procedural adobe front |
| L9 | Bison (optional) | Golden Gate Park paddock wildlife | concept ×2 + W | 16 | skip | none |
| L-R | 3D retake reserve | failed QA | 3 × 12 or 1 × 30 | 36 | 30 | — |
| T1 | 12 new postcards | collectibles | nano_banana_pro 4:3 2k, refs P5 `df659275-cf2a-4352-8166-1934f9945e0f` + P13 `d756b0c4-46f1-4761-9e58-0d5d78bc2433`, 1.75× retake factor | 42 | 42 | fewer postcards |
| T2 | Illustrated SF map | map panel background | nano_banana_pro 1:1 **4k** img2img ×2 (8) + seedream_v5_pro 2k alt (2.5) | 10.5 | 10.5 | SVG paper filter (feTurbulence), 0 credits |
| T3 | Neighborhood icon sheets | map, HUD place pill, journal | nano_banana_pro 1:1 2k, 3×3 grid ×2 sheets (4) + 1 retake (2) | 6 | 6 | lucide icons (existing) |
| T4 | Mural atlas (8 original murals) | Mission / Clarion / Balmy walls | gpt_image_2_5 high 1k ×8 (12) + 4 retakes (6) | 18 | 18 | none (plain pastel walls) |
| T5 | Shopfront strips (4 styles) | ground floors on walkable streets | nano_banana_pro 16:9 2k ×4 (8) + 2 retakes (4) | 12 | 12 | procedural awnings (`city.ts:122+`) |
| T6 | Facade tile A/B | test textured vs shader facades | gpt_image_2_5 medium 1k ×4 | 2 | 2 | — |
| T7 | 6 resident portraits | new NPCs (gripman, bakery, muralist, gardener, ranger, record store) | nano_banana_pro 1:1 1k, style ref A3 `ec4b4fb3-3ba9-4e10-a320-0c62807394c9` (2) + background removal (1), + 2 retakes | 24 | 24 | icon badges |
| | **Total** | | | **355.5** | **375.5** | |
| | **Reserve to the 450 cap** | | | **94.5** | **74.5** | |

In the worst case, L6–L9 are skipped and Stage 1 stops after L5. The reserve is only spent on a second attempt at a shipped hero (for example the rotunda through Meshy multi-view, 30), 6 more postcards (21), or a map retake (4). The account is shared, so check `transactions` after each batch and keep a running tally in `ASSETS-LEDGER.md`, append-only. After 450 the balance will be at least **298.48**.

## 8. Priority order and stop rules

1. **S0 calibration: 65 credits.** Two house concepts, then the 4-model bake-off.
2. **T1a: 6 postcards** (Golden Gate Bridge in fog, Painted Ladies, Palace of Fine Arts, cable car on a hill, Chinatown lanterns, Lombard Street), about 21 credits. This pipeline is proven and immediately useful.
3. **L2** Palace of Fine Arts rotunda.
4. **L1** Painted Lady house B.
5. **L3** Cable car.
6. **L4** Dragon Gate.
7. **T2** Illustrated map. Starts once the whole-SF base render exists.
8. **T1b: 6 more postcards** (Mission murals, Dolores Park, Golden Gate Park windmill, City Hall, Twin Peaks view, Ocean Beach).
9. **T3** Neighborhood icons.
10. **L5** Conservatory of Flowers.
11. **T6** facade A/B, then **T5** shopfronts, but only if the A/B beats shader windows in an in-game screenshot.
12. **T4** Murals.
13. **L6** Toy car.
14. **L7** Windmill.
15. **T7** Portraits.
16. **L8** Mission Dolores.
17. **L9** Bison.

Stop rules:
- **No model passes the QA gate on house A:** stop all 3D. Everything goes procedural, and 2D items continue.
- **Two landmarks in a row fail after one retake each:** stop 3D.
- **A concept image has text, logos, a base or a plinth, or clipped edges:** reject it *before* paying for 3D.
- **The running spend crosses 400:** only items 1–10 continue.

**QA gate for each 3D asset.** The asset passes only if all of these hold:
- Ortho renders from front, side, back and top (reuse `char3d/sheet.py` and `preview.py`) match the concept's silhouette. Target IoU ≥ 0.85 in the concept's own view.
- After welding: non-manifold edges < 1 %, and ≤ 3 islands after cleanup.
- After the colour grade, ≥ 80 % of texels are within ΔE 12 of the DESIGN palette (DESIGN.md:61).
- An in-game `opus-shot` at the default camera (pitch about 38°, distance about 15 u) is recognizable as a 64 px thumbnail (DESIGN.md:66).

## 9. Prompt style guide

**Base contract.** Append this verbatim, as every earlier pass did (`ASSETS-LEDGER.md:6`):
> Soft handcrafted miniature diorama, tilt-shift toy photography feel, matte clay and painted wood materials, warm golden-hour light, gentle soft shadows, clean warm cream background (#f3ecdf) where background is visible, palette of cream, sand, sage green, terracotta, teal water, silver-grey; cozy, charming, calm; no text, no letters, no logos, no watermarks.

The key art sets the look: pale-sand stone buildings with arched arcades, clay characters, a teal glassy water edge, a layered earth cut edge, and a warm cream void around everything.

**3D concept add-on** (for S0 and L1–L9):
> A single [SUBJECT] as a chunky handmade clay-and-painted-wood toy model, centered on a plain flat warm cream background (#f3ecdf), three-quarter view from about 25° above, the whole object in frame with generous margin, soft even studio light, only a faint contact shadow. Simplified toy proportions: thick walls, rounded edges, few large windows and openings, bold readable silhouette. Walls in one flat pastel, crisp cream-white trim, [terracotta #d07a55 | slate #8c9aa6] roof. No base, no plinth, no ground patch, no people, no thin wires, poles, railings, antennas or cables, no text, numbers, signs or logos.

Subject lines:
- **House A:** "three-storey San Francisco Queen Anne Victorian row house with a round corner turret, gabled roof, carved trim, bay windows, front stoop".
- **House B:** "three-storey San Francisco Italianate Victorian row house with a flat false-front cornice, a two-storey angled bay window, tall narrow windows, front stoop".
  - **Walls on both houses:** sage `#cfe0d0`. This is the tint-mask key: walls get recoloured at runtime to `#f2c9b1 #cfe0d0 #f4e2a8 #c9d6e8 #e8c6cf`.
- **Rotunda:** "domed open classical rotunda on eight arched piers, with weeping-figure planter boxes as simple rounded blocks, warm peach-sand stone".
- **Dragon Gate:** "Chinese-style ceremonial gateway with three green-tiled curved roofs, one wide central opening and two small side openings, two small guardian lion statues, jade green and cream".
- **Cable car:** "San Francisco cable car, open end benches and closed centre cabin, cream and maroon-red body, wooden roof, no number, no lettering". For the turnaround sheet, add: "front, side and three-quarter views side by side, identical design".
- **Conservatory:** "white Victorian glass greenhouse with a central onion dome and two long wings, white-painted lattice".
- **Windmill:** "Dutch windmill tower, octagonal tapered body, cap roof, NO sails, only the hub".
- **Toy car:** "small rounded toy compact car, pale neutral grey body, cream windows".
  - **Why grey:** the car gets luminance-tinted per instance, so its colour must be neutral.
- **Mission Dolores:** "small white adobe mission church with four columns and a red tile roof, beside an ornate cream basilica with two bell towers".
- **Bison:** "American bison standing, warm brown clay".

**Postcards** (4:3 2k, refs P5 + P13). Use the subject plus: "full-bleed illustration, the whole subject in frame, NOT a card, NOT on a mat, no border, no stamp, no writing". This avoids the P1/P6/P9 problems.

**Map** (img2img, 1:1 4k, input = our base render):
> Repaint this exact map as a hand-painted watercolor-and-gouache illustrated diorama map in the style above: warm cream land, teal bay, sage parks, tiny clay rooftops. Keep every coastline, park, street, pier and hill exactly where it is; do not add, move, rotate or label anything; no text.

**Icons.** 3×3 grid of nine separate round clay sticker badges, equal size and spacing on plain cream. Each is one tiny symbolic object: cable car, dragon gate, Victorian, windmill, Golden Gate tower, mural sun, rainbow flag stripes, Coit Tower, Twin Peaks. No text.

**Murals** (1:1, gpt_image_2_5 high):
> Original mural artwork in the spirit of San Francisco Mission District community murals, painted flat on a wall seen straight on: [marigolds and hummingbirds | fog rolling over hills with sea otters | cable cars and sun rays | …], bold flat colours limited to terracotta, teal, sage, gold #e0a94a, cream; no text, no real people's faces, not a copy of any existing mural.

**Shopfronts** (16:9 2k):
> Orthographic straight-on elevation of a row of four toy shopfronts at ground-floor height, [Victorian storefronts | Chinatown shops with lanterns | Mission corner shops with papel picado | cafés with awnings], blank signboards with no letters, flat even light, no perspective.

**Tileable textures:**
> seamless tileable texture, orthographic, flat even light, pattern continues across all four edges

Afterwards, verify with a 3×3 tiling preview and heal seams by offsetting 50 % and cross-fading 32 px.

## 10. Post-processing pipeline

Extend `assets-work/creatures/cleanup.py`. Everything below is local and free.

1. **Import, join and weld.** Merge by distance of 5e-4 × the bbox diagonal. Delete islands under 0.3 % of tris (precedent: `char3d/islands.py`).
2. **Orient.** Front goes to Blender −Y, which becomes three +Z. Buildings: align the footprint's main axis to X. **Flatten the base:** bisect at min z + 1 % of height, then fill, so the model sits flush on the terrain. Origin at bottom-centre.
3. **Scale** with `--measure height --size <u>` to the targets below.
4. **Decimate.** Architecture: planar dissolve at 3° first, which keeps walls crisp, then collapse to `--max-tris`. Organic shapes: collapse only. Smooth shading, and for Hunyuan output use weighted normals.
5. **Texture.**
   - Resize to 1024² for heroes and 512² for instanced props.
   - Colour-grade to the palette: saturation ≤ 0.5, whites lifted to `#f6ecd9`, then per-asset hue remaps as in the BAYBAY pass.
   - No normal, ORM or PBR maps. Metallic 0, roughness 0.9.
6. **Masks.** Put these in a separate `<id>-mask.webp` at 256², about 3–8 KB. That avoids exporter alpha issues.
   - **R = night windows:** glass pixels by the GTA_SZ stencil `(B−R ≥ 28) & (G−R ≥ 18)`, adapted from `make_facade_diversity_atlas.py:57`.
   - **G = tint region:** the wall hue key.
   - **Atlases:** 8 px gutter edge-repeat (`:51`).
7. **Export.** GLB with `export_image_format='WEBP'`, `export_image_quality=82`, `export_draco_mesh_compression_enable=True` (level 6, pos 14, normal 10, uv 12).
8. **QA.** Run the gate in §8. Record tris, bytes, bbox and sha256 in `data/assets.ts` and the ledger.
9. **2D assets.**
   - Postcards: 1200/600 WebP q82.
   - Map: 2048² WebP q80, about 400–600 KB. Lazy-load it when the map opens.
   - Icons: one 1536² sheet WebP q85, used as a CSS sprite.
   - Murals: 2048×1024 atlas WebP q80, 8 × 512², about 250 KB.
   - Shopfronts: 1024² atlas of 4 × 1024×256 strips, about 150 KB.

**Size targets** (Draco + WebP):

| class | tris | texture | GLB |
|---|---|---|---|
| hero landmark (rotunda, gate, conservatory, dolores) | 6–10k | 1024² | ≤ 250 KB |
| instanced house | 2.5–3.5k | 512² | ≤ 90 KB |
| vehicle (cable car, toy car) | 3–5k / 1.5–2.5k | 512² | ≤ 110 / ≤ 60 KB |
| creature / windmill body | ≤ 3k | 512² | ≤ 90 KB |

For reference, the measured Draco+WebP sizes are pelican 2,909 tris = 89.7 KB and baybay 8,326 tris = 197.1 KB. All new GLBs together should stay ≤ 2.5 MB, loaded lazily per neighborhood.

**World-unit sizes.** Formula: `size_u = real_m × K × E`, where K = 0.14 (`district.ts:43`). The E values below are what the current world uses:
- **Houses: E ≈ 3.** Victorians are 4.2–6.4 u.
  - **Painted Lady:** 5.6 u tall, 3.0 u wide, 4.5 u deep.
- **Landmarks: E ≈ 1.6–1.8.** Coit is 16 u for 64 m (DESIGN.md:56).
  - **Rotunda:** about 11 u tall, 8 u across (real about 49 m).
  - **City Hall (procedural):** dome top about 20 u.
  - **Conservatory:** 14 × 6 u.
  - **Mission Dolores:** 8 u.
  - **Windmill body:** 9 u.
- **Vehicles: E ≈ 4.** The streetcar is 8.4 u.
  - **Cable car:** 5.6 × 2.0 × 2.6 u. Its running board sits about 0.45 u up.
  - **Toy car:** 3.2 × 1.4 × 1.2 u.
- **Dragon Gate:** about 5 u tall, 6 u wide, central opening ≥ 2.2 u, so the 1.5 u player and 1.3 u BAYBAY pass through.
- **Bison:** 2.2 u long.

If the whole-SF team lowers K, keep these sizes as they are relative to the player and change only `MODELS[id].scale`. **No regeneration is needed.**

## 11. Recommendations for Opus Bay (whole SF)

1. **Run the bake-off first (65 credits) and let it choose the model.** If Tripo H3.1 passes at 12 credits, the eight-landmark programme costs about 176 instead of about 330.
2. **Share one loader and one material** in a new `src/opus-bay/world/models.ts`:
   - Move `loadModel` there from `world/life.ts:309-322`.
   - Add a cached `GLTFLoader` with `DRACOLoader.setDecoderPath('/opus-bay/draco/')`.
   - Copy the 2 decoder files (250,876 B) from `node_modules/three/examples/jsm/libs/draco/gltf/` into `public/opus-bay/draco/`.
   - Add an `instanced(id, matrices, tints)` helper: one draw call per model id.
3. **Give GLBs the TOY features.** In `world/materials.ts:296` `makeToy`, add `map` and `mask` options under an `OB_MAP` define:
   - The map multiplies `diffuseColor`.
   - `mask.r` adds night emission like the style-7 block (`:282-286`), with per-instance occupancy from `obHash`.
   - `mask.g` mixes the luminance × tint colour, generalizing `life.ts:174-186`.
   - At load time, synthesize a constant `aInfo = [0, baseY, −seed, 0]` attribute so AI meshes get contact AO (`:288`) and the dither-fade (`:214-229`).
   - Hero landmarks use `OB_HERO` (`:211`).
   - Result: every AI asset lights up at night and fades like the procedural city, at +1 draw call per model id.
4. **Extend the manifest.** In `data/assets.ts:159-187`, add `mask?: string`, `tint?: 'walls' | 'body'`, `draco: boolean` and `lod?: { far: number }` to `ModelAsset`. Add the new ids to `MODEL_IDS` (`:169`). Fix the baybay comment (1024², not 512) at `:185`.
5. **Swap houses near the player.** Painted Ladies: a row of 7 instances of houses A and B with tints. Elsewhere, swap procedural `victorian` lots (`city.ts:104`) to GLB houses **only within about 40 u of the player**, at most 12 instances. That's ≤ 42k tris and 2 draw calls. Farther lots stay procedural.
6. **Per-view budget for AI assets:** ≤ 60k tris, ≤ 12 draw calls, ≤ 6 shadow casters. The whole scene must stay ≤ 150 calls / 400k tris (DESIGN.md:87). Today it uses 52–64 calls and 144–223k tris (STATUS.md:161-166).
7. **Map.** Have the code team export a 2048² PNG of the whole-SF SVG, using the same `bounds()` / viewBox as `ui/MapPanel.tsx:25-40, 93` with labels off. Repaint it with img2img (T2). Then add it as `<image>` under the vector layers at `MapPanel.tsx:93`. Reject any output whose coastline edge map deviates by more than 1.5 % of the width.
8. **Postcards and portraits.** Add the ids to `data/postcards.ts` (loader path at `:15`) and `POSTCARD_ART`. Portraits go in `public/opus-bay/portraits/npc-*.webp`.
9. **Record everything.** Append each paid job to `src/opus-bay/ASSETS-LEDGER.md` and update `public/opus-bay/README.md`. Credit GTA_SZ (MIT) in code comments where its stencil or gutter ideas are used.
10. **Don't spend credits on** bridges, City Hall, the Legion of Honor, Fort Point, Ghirardelli, the de Young, Sutro Tower or Baths, buses, bikes, ferries, horizon panoramas, ground textures or a general facade atlas. Build them as procedural modules, following GTA_SZ's one-module-per-landmark contract. Finish each landmark with its street around it before starting the next (`shenzhen-landmark-roadmap.md:7`).
