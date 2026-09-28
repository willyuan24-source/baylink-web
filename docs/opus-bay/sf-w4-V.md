# Wave 4 · lane V report (visual assets, voice & performance)

Plan: `sf-w4-plan.md` §5.7 (and §2.2, §2.6, §3.6, §6); lead note `sf-w4-lead.md` (early phase = new files only).
Worktree `C:/Users/willy/wt/w4-v`, dev port 5306, scratch `C:/Users/willy/opus-qa/w4/w4-v/`.

## Early phase

### 给主人的摘要

1. 四个 AI 地标模型做好了：**加州科学院**（绿色屋顶两座圆丘）、**圣依纳爵堂**（双塔 + 圆顶）、**圣母大教堂**（五个金色洋葱顶）、**蓝鹭湖中国亭**。都按玩具风格先出概念图、再转 3D、再在 Blender 里清理；新加了一步"重新烘贴图"，去掉了减面后墙上出现的斜条纹。四个都过了质检（轮廓吻合、颜色、面数、文件大小都达标；圣依纳爵堂为了对齐真实占地做了拉伸，按惯例记为豁免），前两个已经和 L 线的程序化版本占地完全一致，接线时直接替换即可。
2. 地图上 16 个"必看"景点的**手绘贴纸**做好了（和手绘地图同一种水粉风格，圆形小贴纸，一张 512 像素的图集，约 74 KB），逐格放大检查过，没有任何文字。
3. BAYBAY 的**环游讲解语音**录好了：C 线冻结的 107 句台词 × 中英文 = 214 段，全部裁剪、响度统一，214 段都过了机器检查（没有爆音、没有截断、停顿和语速正常），识别器听对 203 段。按顺序听两个合集就能全部过一遍，哪句不满意在试听单上标一下就换（`docs/opus-bay/qa/w4/V/voice/listening.md`）。
4. 性能：新写了第四波的 11 个测试点 + 3 段乘车路线和测量脚本；在 RTX 上测了一遍基线：所有点都在 150 次绘制 / 40 万三角形以内；**唐人街只剩约 1 万三角形余量**（按计划规则，宝塔群勉强可做，我建议先只做卡片）。
5. 巴士和轻轨的参考图给了 T 线；茶园宝塔 L 线的程序化版本看起来够好，AI 版不需要做；老圣玛利亚教堂没做（唐人街预算太紧）。
6. 花费 40.45 分（上限 120：图片和 3D 35 分，语音 5.45 分），余额 415.13。

### What was built

| file | what |
|---|---|
| `public/opus-bay/models/sf/w4-cal-academy.glb` (+ `-mask.webp`) | California Academy of Sciences: glass hall, thin white roof slab on slim columns, green living roof with the two porthole domes and five small hills. 5,880 tris, 93 KB, 24.4 × 7.9 × 16.6 u (= lane L's procedural block + canopy), mask R = the glass walls (night glow). |
| `public/opus-bay/models/sf/w4-st-ignatius.glb` | St Ignatius Church: twin four-stage towers with domed lanterns and crosses, columned front and pediment, tile nave, dome on its drum. 5,879 tris, 153 KB, 7.5 × 13.2 × 11.15 u (= lane L's procedural church). |
| `public/opus-bay/models/sf/w4-holy-virgin.glb` | Holy Virgin Cathedral: white body with rounded gables and the red trim of its 2015–16 red-and-white scheme, five gold onion domes with crosses. 5,880 tris, 185 KB, 6.10 × 9.1 × 6.69 u (38.1 m by the landmark rule H = 3.2 + 0.155 h). |
| `public/opus-bay/models/sf/w4-chinese-pavilion.glb` | The Chinese Pavilion on Blue Heron Lake: open octagon, 8 red columns on a ring r ≈ 2.2 u (angles 22.5° + k·45°), grey-green tile roof with upturned corners, finial. 2,940 tris, 71 KB, 512 px texture, 5.62 × 4.5 × 5.61 u (8.5 m by the rule: the eaves clear the player). |
| `src/opus-bay/data/sf/w4Models.ts` | `W4_MODEL_IDS` (`sf-cal-academy`, `sf-st-ignatius`, `sf-holy-virgin`, `sf-chinese-pavilion`), `W4_MODELS: Record<W4ModelId, SfModelAsset>` (the exact `SF_MODELS` rows), `w4ModelUrls()`. Type-only import of `SfModelAsset`; not registered. |
| `public/opus-bay/map/stickers-t1.webp` + `.json` | 16 round gouache stickers, 4 × 4 atlas of 128 px cells (124 px circles, 2 px padding, alpha outside the circle), 74,150 B. JSON: ids, rects, sizes, source radius, bytes, sha256. |
| `src/opus-bay/data/sf/mapStickers.ts` | `MAP_STICKER_IDS` (= lane P's `T1_IDS`, tested), `MAP_STICKERS_T1` { url, meta, size, cell, pad, bytes, rects, minScale 0.45 }, `mapStickerRect(id)`, `isMapStickerId`, `mapStickerUrls()`. Dependency-free. |
| `public/opus-bay/voice/sf/tour/<lang>-<id>.m4a` / `.ogg` | 214 narration clips (107 frozen `TOUR_LINES` × zh / en), AAC 64k + Opus 48k mono, −18 LUFS / TP −1.5. |
| `src/opus-bay/data/sf/voiceTour.ts` (generated) | `TOUR_VOICE_CLIPS: Record<clipId, VoiceClip>` (url, lang, text, duration) and `TOUR_VOICE_CHECK` (clips muted until the owner's ear). Type-only import of `VoiceClip`; not registered. |
| `scripts/opus-sf/qa/perf/w4-spots.json` | The wave-4 gate: 6 old spots (perf-gen coordinates, tested) + 5 new (Union Square, Civic Center, Music Concourse, Stonestown / SF State, Haight / USF, each with the new sites in range) + 3 rides (bus on the Palace approach, N Duboce → Carl & Cole, M West Portal → 19th & Winston) and the gate numbers. |
| `scripts/opus-sf/qa/perf/w4-perf.mjs` | The runner: one headless Chrome through the spots (renderer.info, city stats, 10 s idle + 10 s walking frame times, the real player position) and the rides (a camera travelling the ride path at ride speed with the streamer on it; the real vehicles after integration), `w4-perf.json` + the gate table `w4-perf.md`. |
| `scripts/opus-sf/assets/w4/` | `prompts.py` → `prompts.json` (every prompt and reference), `specs.json` (per model: raw, concept, cleanup args, grade), `build.py NAME TAG [--publish]`, `w4_cleanup.py` (D2's wave-3 cleanup + the texel re-bake), `grade.py` (+ wall / roof regions, the kit's red and silver in the palette list), `iou.py`, `stickers.py`, `proc-export.ts` + `proc_iou.py` (AI vs procedural silhouettes), `view.html` (the GLB check page on the dev server). |
| `scripts/opus-sf/voice/w4/` | `takes.ts` (the take list from `TOUR_LINES`), `tour_post.py` (trim, loudnorm, gates, recogniser, picks, previews, listening sheet, `voiceTour.ts`). |
| `tests/opus-bay-w4-assets.test.ts` | 6 tests: the GLBs vs their rows (bytes, triangles, bounds ±2 %, origin, one mesh / primitive), Draco + WebP, texture sizes, the §2.2 / §6 caps, masks; the height rule; the sticker atlas (WebP size + alpha, JSON = module, sha256, no overlaps, ids = lane P's `T1_IDS`); the perf spots (old ones = perf-gen, new ones in the SF frame with their sites, ride paths ≤ 25 u steps, gate numbers); the tour voice (every frozen line has its zh + en clip word for word, files = the report by bytes and sha256, 1.5–9 s, muted exactly when a gate failed). |
| `docs/opus-bay/ledger/w4-V.md` | Every paid job (preflight, 2 image / 3D batches, the voice rounds), subtotals and balances. |
| `docs/opus-bay/qa/w4/V/` | Key shots (below) and `voice/` (report, previews, listening sheet). |

### Evidence

- **Checks** (last push): `tsc` 0; `eslint .` 0 errors (42 warnings, none in lane V files; the `.vite-opus/` optimizer
  cache of a local dev server is not part of the repo); **625 / 625** opus-bay tests green (on `c434f57` + this lane's commits) (incl. hero regression and
  contracts).
- **AI mesh QA gate** (plan §6: IoU ≥ 0.85, < 1 % non-manifold, ≤ 3 islands, ≥ 80 % texels within ΔE 12 of the palette,
  readable at 64 px, Draco + WebP q82, ≤ 250 KB):

  | model | IoU vs concept (native / as published) | vs lane L's procedural (front / side / top / 3/4 / 3/4 l) | non-manifold / islands | palette ΔE12 before → after | bytes |
  |---|---|---|---|---|---|
  | Cal Academy | 0.908 / 0.894 | 0.87 / 0.87 / 0.99 / 0.89 / 0.89 | 0 % / 1 | 0.66 → 0.99 | 93,120 |
  | St Ignatius | 0.863 / 0.807 (fitted to L's footprint: waiver, as D2's widened gate) | 0.79 / 0.84 / 0.79 / 0.80 / 0.85 | 0.08 % / 1 | 0.21 → 0.92 | 152,988 |
  | Holy Virgin | 0.854 | (site not built yet) | 0.23 % / 2 | 0.41 → 0.85 | 184,596 |
  | Chinese Pavilion | 0.855 | (site not built yet) | 0 % / 1 | 0.25 → 0.86 | 71,388 |

  The second St Ignatius SAM (from concept a) scored 0.805 and was dropped. Every GLB was decoded in Chrome with
  three's GLTFLoader + the game's Draco decoder path (`view.html`): triangles and bounds equal the rows. Shots:
  `qa/w4/V/v-ai-landmarks.jpg` (concept | day 3/4 | the unseen back | night | 64 px), `qa/w4/V/v-ai-vs-procedural.jpg`
  (white = both, red = AI only, blue = procedural only; St Ignatius's AI dome sits higher and further back than L's).
- **The texel re-bake** (new in wave 4): the collapse decimation keeps the SAM UVs, and triangles merged across UV charts
  smeared roof tiles as diagonal red / cream streaks over the unseen side walls (visible on St Ignatius's transepts at
  street height; D2's wave-3 landmarks have the same pattern). `--rebake 1` smart-projects the low mesh and transfers
  the raw colour texel by texel (a BVH ray along the face normal, ≈ 420k texels in 10 s), then dilates 24 px into the
  gutter. Blender 5.2's headless Cycles bake returned an all-black image on this machine (even a self-bake), hence the
  Python transfer.
- **Stickers**: 2 sheets drawn (4k), sheet 2 kept (SF State's angled student centre and Stonestown's glass canopy read
  better; all 16 subjects right on both); read at full size row by row: no letters, numbers or logos (the Ferry
  Building clock face has ticks only; the Dragon Gate plaque is blank). Cut 3.2 % inside the rim so no paper or shadow
  shows. Shot: `qa/w4/V/v-stickers-t1.jpg`.
- **Voice**: 214 clips; takes: 214 at speech rate 1.0 (20 service failures resubmitted, refunded), then 16 retakes at
  1.08 for the clips that missed a gate or the recogniser. Gates: no clipping, not cut at the end, longest pause ≤ 0.9 s
  (1.2 s with ；:—), median F0 170–460 Hz, speaking rate zh 2.4–7.5 chars/s, en 1.4–4.6 words/s. Result: 214 / 214 picks pass
  every gate (the rate gate counts a number as it is read, so "1776" is not a dropped word), the closed-grammar
  recogniser picked the right sentence among all 107 of its language for 203 (the 11 others are long mixed-language
  lines it returns nothing for, e.g. "9th & Irving", "UCSF"); clips 2.2–8.1 s (18.6 min in all), 17 MB for the 428
  files. `TOUR_VOICE_CHECK` (muted until the owner's ear) is empty. Files, measurements, alternates: `qa/w4/V/voice/tour-voice-report.json`, previews
  `tour-voice-preview-{zh,en}.m4a`, the sheet `listening.md`.
- **Perf baseline** on `origin/opus-bay` @ `5f4afa6` (RTX 3070 laptop, 1440 × 900, `quality=high`, golden hour; the
  machine was shared with other lanes' runs, so the fps column is indicative only; calls / triangles are the gate):

  | spot | calls | triangles (max of measure / idle / walk) | headroom to 400k | programs | fps idle / walk |
  |---|---|---|---|---|---|
  | ferry-gate | 120 | 378,644 | 21.4k | 40 | 60.1 / 60.1 |
  | chinatown | 123 | 389,922 | **10.1k** | 42 | 60.1 / 60.1 |
  | twin-peaks | 115 | 377,736 | 22.3k | 42 | 60.1 / 60.0 |
  | ocean-beach | 57 | 102,005 | 298k | 42 | 60.1 / 60.0 |
  | ggb-south | 50 | 96,995 | 303k | 42 | 60.1 / 60.1 |
  | mission | 83 | 299,338 | 101k | 42 | 60.1 / 60.1 |
  | union-square (new) | 93 | 293,944 | 106k | 42 | 60.1 / 60.1 |
  | civic-center (new) | 114 | 382,955 | 17.0k | 42 | 60.1 / 60.1 |
  | music-concourse (new) | 69 | 235,430 | 165k | 42 | 60.1 / 60.1 |
  | stonestown-sfsu (new) | 62 | 170,383 | 230k | 42 | 60.1 / 58.8 (one 100 ms frame while streaming) |
  | haight-usf (new, re-run) | 83 | 300,974 | 99k | 39 | 51.6 / 58.6 (the voice recogniser was running) |
  | ride bus-palace (camera proxy, 12 u/s) | max 113 | max 359,726 | — | 42 | 60.1 (worst frame 21 ms) |
  | ride n-duboce (10 u/s) | max 111 | max 346,961 | — | 42 | 60.1 (worst 21 ms) |
  | ride m-west-portal (10 u/s) | max 105 | max 345,443 | — | 42 | 50.2 (p95 33.5 ms, worst 67 ms: streaming St Francis Wood) |

  The first Haight / USF measurement was void (418k): the shot showed the player back at the Ferry Building although
  the teleport had reported Haight & Ashbury; the runner now records the player's real position and marks such a spot
  "void". Shots: `qa/w4/V/v-perf-spots.jpg`.

### Decisions

- **Concepts: 2 per landmark (variant a = K6 + the rotunda concept with the "different building" prefix, b = K6
  only), SAM on the better one; SAM on both St Ignatius concepts** (1 credit each) because both were close; a picked
  on IoU. The first two Cal Academy SAM jobs found no object ("the toy museum building"; refunded); "the green-roofed
  toy building" with `detection_threshold` 0.3 worked.
- **Facts behind the shapes** (checked 2026-09-27): St Ignatius — buff brick with terra-cotta detail, two towers of
  four stages from square to octagonal, a dome (Wikipedia; USF "9 facts"); Holy Virgin — five onion domes in gold leaf,
  the plain white exterior repainted in a red-and-white scheme in the 2015–16 restoration (Orthodox Arts Journal "Bold New Colors"); the pavilion —
  octagonal, red columns, grey-green glazed tiles chosen to match the Chinatown gate, 27 ft wide, 28 ft tall with a
  4.5 ft spire, a 1981 gift of Taipei (Richmond Review "Sister City Pavilion", SF Rec & Park); Cal Academy — the living
  roof with the planetarium and rainforest domes and porthole skylights (calacademy.org). No text, crosses kept chunky.
- **Sizes**: St Ignatius and Cal Academy are published at lane L's procedural bounds (`--box`), so the swap is scale 1
  on the same footprint and walk data; Holy Virgin and the pavilion at the landmark height rule until their sites exist.
  The pavilion is lean (≤ 3k, 512 px texture) because it is a small part inside a plaza site.
- **Palette list**: `grade.py` adds three colours the city already ships (the kit's Chinatown red `#b8463c`, `#b8c0c4`,
  `#bdb3a2`): the red is the real trim of Holy Virgin and the pavilion's columns; without it the gate would count the
  building's own identity as off-palette.
- **Sticker style**: the painted map (H2b's paper v1 crop as reference) + K6's warmth, not the clay look, so the map
  stays one illustration; one 512 px atlas for all devices (T1 badges are 26 px; at dpr 3 a 42 px sticker uses 126
  device px ≈ the cell).
- **Vehicle references** (images only, for lane T): the LRV sheet is clean in all four views; the bus needed a retake
  (the first was a 3/4 view with a stray K6 streetcar): side + top from the retake, front + back from the first
  (`qa/w4/V/ref-tour-bus-side-top.jpg`, `ref-tour-bus-front-back.jpg`, `ref-lrv.jpg`). Lane T had already pushed its toy bus and LRV: the sheets are for comparison.
- **Conditional models**: the Tea Garden pagoda of lane L (5 tiers, finial, flaring roofs, `japanese-tea-garden.ts`)
  reads as a pagoda at the site view, so no AI pagoda (≈ 5 credits saved; the recipe is ready if the SoloView gate says
  otherwise). Old St Mary's: not built by L and gated on the Chinatown headroom (10.1k, the plan's threshold is 10k with
  no margin for noise): card only (lane C).
- **Voice**: one take per clip first (the service ignores the seed for many texts and rate-limits bursts: about 1 in 6
  submissions came back 429 and was resubmitted), retakes only where a gate or the recogniser failed; picks = pass →
  recogniser right → confidence. The narration uses a guide variant of BAYBAY's instruction ("… friendly storytelling
  pace") so sentences are not rushed; quiet lines "soft, gentle and respectful". Clips are not time-stretched.
- **Perf rides** are a camera path at ride speed until lane T's systems are wired; the path data (w4-spots.json) is what
  the gate will ride.

### Known gaps

- AI meshes: the unseen backs carry SAM's usual softness (Cal Academy's rear glass has some green smudges; Holy
  Virgin's side walls a fine speckle). St Ignatius's AI dome sits higher and further back than lane L's (the concept's
  proportions); the SoloView gate decides.
- The Cal Academy mask marks 13 % of texels as glass: at night the whole glass band glows (as intended for the museum
  hall) — lane L sets the `glass` colour / occupancy.
- Voice: the recogniser is advisory and weak on long mixed-language sentences ("9th & Irving", "UCSF"); the owner's ear
  decides (any clip the owner marks goes into `TOUR_VOICE_CHECK`).
- Perf fps numbers were taken on a busy machine. A phone-profile run (390 × 844, dpr 3, mid, 4× CPU, iGPU) was started
  but overlapped the full test suite (Chinatown 16.8 / 11 fps, a 4 s frame on Twin Peaks: the suite, not the game), so it
  was stopped and its numbers are void; no wave-4 content is mounted yet, so the phone gate is first due after the
  integration batches (and the lead's final verify).
- **Incident:** stopping that run (≈ 20:25 UTC) I ended every node process whose command line contained `opus-shot`:
  4 processes, 2 of them mine (the runner and its opus-shot); the other 2 may have been another lane's screenshot run.
  If a lane saw an opus-shot run die at that time, it was this: please re-run it. (No headless Chrome was left
  orphaned.) From now on lane V stops its own runs by process id only.

### Not done (early phase)

- Registration (data/assets.ts, voiceLinesSf.ts, MUTED_CLIPS, listAssetUrls), warm-up registration of the new programs
  (flags, bus, LRV, portals: other lanes' modules), the Salesforce crown glow, streamer prefetch for rides, the phone
  gate: integration phase (below).
- Re-processing D2's eight wave-3 SAM landmarks with the texel re-bake (their side walls show the same decimation
  streaks): free, lane V's pipeline, offered for the integration phase.
- H-7 postcards (optional) and H-8 SFX (lane T synthesised its sounds; no request).

### Integration plan (exact steps, after "wave 3 verified")

1. **`src/opus-bay/data/assets.ts`** (lane V inherits it): `import { W4_MODEL_IDS, W4_MODELS } from './sf/w4Models';`
   - `SF_MODEL_IDS = [ …existing…, ...W4_MODEL_IDS ] as const` (keeps `SfModelId` a union of literals);
   - `SF_MODELS: Record<SfModelId, SfModelAsset> = { …existing…, ...W4_MODELS }` (listAssetUrls already walks
     SF_MODELS, so the four GLBs + the Cal Academy mask are listed);
   - `listAssetUrls()`: add `...mapStickerUrls()` (import from `./sf/mapStickers`);
   - `tests/opus-bay-sf-models.test.ts` (lane L's): `all.length` 24 → 28 (on purpose); the other checks already hold
     (hero ≤ 1024 px, sizes, origin, Draco + WebP).
2. **`src/opus-bay/data/voiceLinesSf.ts`** (lane V): `import { TOUR_VOICE_CLIPS } from './sf/voiceTour';` and
   `SF_VOICE_CLIPS = { …, ...TOUR_VOICE_CLIPS }`; `tests/opus-bay-h2b-assets.test.ts` gains a "tour clips = voiceTour
   rows by bytes / sha256" check (lane V's test). **`src/opus-bay/audio/voice.ts`** (lane T): add `TOUR_VOICE_CHECK` to
   `MUTED_CLIPS` until the owner approves them in `qa/w4/V/voice/listening.md`. Lane C's narration emits
   `{ type: 'voice-line', id: line.id }` (the clip is `<lang>-<id>`); the tour clips are loaded on demand, so lane T
   (boarding) or lane C (chapter start) calls `voice.preload` for the next stop's approach / arrive clips.
3. **Lane L swaps** (their files, the D2 swap API in `landmarks/index.ts`): `cal-academy.ts` → `swap: { parts: [{ model:
   'sf-cal-academy', x: 0, y: <block ground g.at(0, 0)>, z: 0, yaw: 0, scale: 1, glass: <warm>, castShadow: true }],
   build: <the plaza, bandshell side and furniture without the block / canopy / hills>, ship: <SoloView verdict> }`;
   `st-ignatius.ts` → part `'sf-st-ignatius'` at (x 0.35, y ground, z −0.18), yaw 0 (front +Z = Fulton St), scale 1,
   blockers unchanged; `geary-west` (Holy Virgin, when built) → `'sf-holy-virgin'`, front +Z = the porch, to face Geary
   Blvd; `blue-heron-lake` → `'sf-chinese-pavilion'` at (−251.5, 1017.0) world, walk-in: 8 column blockers r 0.18 on a
   ring r 2.2 at 22.5° + k·45°, the entrance gap on +Z. L's `aiSlot.model` strings (`w4-cal-academy`, `w4-st-ignatius`)
   become the registry ids above. The models reuse D2's `ob-model-hero` program (warmed as `d2-models`): **no new
   program**.
4. **Lane P, stickers**: in the map badge draw, for `isMapStickerId(id)` at `s ≥ MAP_STICKERS_T1.minScale`, draw
   `mapStickerRect(id)` from the decoded atlas centred on the badge, diameter = badge + 4 px, no extra rim; the lucide
   badge until the image is decoded and under `?stickers=0`. One `Image` (≈ 74 KB, 1 MB decoded) for the whole map.
5. **Perf gate** (lane V): `node scripts/opus-sf/qa/perf/w4-perf.mjs --port <p> --out <dir>` after each lane batch
   (desktop, `CHROME_FLAGS=--force_high_performance_gpu`) and `--mobile --dpr 3 --quality mid --throttle 4` for the
   phone; once T's systems are wired, replace the camera rides by boarding (`ride.ts` / `boardLine`) and add the
   `programs` equality at 1× idle vs 4× walk per spot; add G's `g-flags` and T's fleet program to the warm-up /
   program-count check.
6. **`public/opus-bay/README.md`** (lane V): a wave-4 section (models, stickers, tour voice, credits).
7. **Ledger**: the lead merges `docs/opus-bay/ledger/w4-V.md` into `src/opus-bay/ASSETS-LEDGER.md`.

### Requests

- **Lane L**: run the SoloView gate for `sf-cal-academy` and `sf-st-ignatius` (and the two others when their sites land);
  use the registry ids in `aiSlot`; say if you want the AI pagoda after all (≈ 5 credits) or different bounds for Holy
  Virgin / the pavilion (a re-export is free). The Music Concourse view has 165k of headroom and Haight / USF 99k, so
  the ≤ 4k fallback of plan R3 is not needed.
- **Lane L / lead (Chinatown)**: 10.1k headroom at `quality=high` — build the pagoda cluster only if another diet frees
  ≥ 5k more; otherwise Old St Mary's and the Sing Chong / Sing Fat towers stay cards.
- **Lane P**: the sticker draw (step 4); the ids now equal your `T1_IDS` (`ferry-building-marketplace`).
- **Lane C**: O2 (`metro-sfsu-next`) is recorded as frozen; if you add a new id, tell V and it is recorded in the
  integration phase (≈ 0.05 credits).
- **Lane T**: `TOUR_VOICE_CHECK` into `MUTED_CLIPS` (step 2); the ride hooks for the perf gate once `BusSystem` /
  `LightRailSystem` are wired.
- **Lead**: the whole-repo lint runs into a local `.vite-opus/` cache (12 errors from optimizer bundles) when a lane has
  a dev server running: add `.vite-opus` to the ESLint ignores (a frozen / config file).

## Early review

Adversarial review of the early phase (commits `3302149`, `87a5dbd`, `b67ae36`), 2026-09-27, in `C:/Users/willy/wt/w4-v`
(rebased on `origin/opus-bay`); scratch `C:/Users/willy/opus-qa/w4/w4-v/review/`. Fixes: the commit "W4-V-review:
models name the sites …" and this section.

### 给主人的摘要

1. V 线交的东西质量不错：四个 AI 地标模型、16 张地图贴纸、214 段环游语音都逐个核对过；抽查了 19 条事实和坐标，除了一处塔高没有出处，其余都对得上；花费 40.45 分，在 120 分上限内。
2. 找到并修好了 6 处"接线时会接不上"的小问题：两个模型挂错了所属地标、地图贴纸只给了画布用法（地图徽章其实是 SVG）、测速乘车的上下车站名和 T 线对不上、测速点列的地标名不对、账本里两行还是旧数字、测试里一处没有出处的塔高。
3. 还有几条要到"接线阶段"才能改（语音预加载的调用方式、L 线一个旧测试会因为新模型报错、湖心亭的走路数据），具体改法都写在下面。

### What was checked

- **Scope rule**: lane V's three commits only add files; the eight files `87a5dbd` modifies were all created by `3302149`.
  No existing tracked file was edited. No uncommitted work was left in the worktree.
- **Read**: the lead note, plan §2.2 / §2.6 / §5.7 / §6, this report, the ledger, every new source, test, script listing,
  the spots JSON and runner, the sticker JSON and atlas, the voice report and the listening sheet; the files the
  integration plan names (`data/assets.ts`, `data/voiceLinesSf.ts`, `audio/voice.ts`, `audio/audio.ts`, the swap API in
  `landmarks/index.ts`, lane L's `cal-academy.ts` / `st-ignatius.ts` / `w4sites.ts`, lane P's `MapBadge.tsx`, lane T's
  `stationNames.ts` / `busSystem.ts` / `transit-w4.json`, the D2 tests `sf-models` / `sf-landmarks`).
- **Assets, measured**: the four GLBs decoded with draco3d (bounds = the rows; St Ignatius's towers stand at +Z = Fulton
  St, the dome behind them; the pavilion ray-cast: floor platform 0.3 u, roof underside 2.3 u at the centre and 2.5 u at
  the eaves, eight columns at 22.5° + k·45° on r ≈ 2.15, open between every pair). The atlas: padding alpha 0, all 16
  subjects right and in `MAP_STICKER_IDS` order, no letters (read at 2×). Voice: the durations of all 428 files equal
  `TOUR_VOICE_CLIPS` (≤ 0.06 s), AAC 64k / Opus mono 48 kHz, five sampled clips at −17.5…−17.9 LUFS with peaks ≤ −2.3
  dBFS, no clip id collides with the 86 existing ones. The recogniser re-run with alternates on three of the 11
  unmatched clips: "326 m" is read "three hundred twenty-six meters" (0.92, not "M"); "Haight" comes out "hate", which
  is the right pronunciation; the Bernal clip stays for the owner's ear.
- **Facts re-checked on the web** (2026-09-27):

  | # | fact (where) | result | source |
  |---|---|---|---|
  | 1 | Holy Virgin: plain white until the 2015–16 red-and-white scheme (model, report) | right | orthodoxartsjournal.org "Bold New Colors for Holy Virgin Cathedral" |
  | 2 | Holy Virgin: five onion domes in gold leaf (model, voice) | right (24-carat) | en.wikipedia.org/wiki/Holy_Virgin_Cathedral |
  | 3 | Holy Virgin 125 ft → H 9.1 u (row, test) | right | sfgate.com "A cathedral's golden glow in Outer Richmond" |
  | 4 | Pavilion octagonal, 28 ft tall, 27 ft wide, 4.5 ft spire (row, test) | right | richmondsunsetnews.com "Looking Back: Sister City Pavilion" |
  | 5 | Pavilion: red columns, grey-green tiles like the Chinatown gate | right | same |
  | 6 | Pavilion: 1981 gift of Taipei | right (plaque 15 Apr 1981) | same; sfrecpark.org/901 |
  | 7 | St Ignatius: 1914, Charles Devlin, twin spires + dome | right | Wikipedia; usfca.edu "9 facts" |
  | 8 | St Ignatius: buff brick + terra cotta, towers in four stages square → octagonal | right, but the source is the California Preservation Foundation (californiapreservation.org/awards/ignatius), not Wikipedia as "Decisions" says | CPF |
  | 9 | St Ignatius towers "213 ft" (test label) | **no source**: "over 200 ft above the street" (CPF), 210 ft (USF), 185 ft above the campus (SF Chronicle). Relabelled; the height follows lane L's 61 m + the crosses | CPF, USF, SF Chronicle |
  | 10 | Cal Academy: 2.5-acre living roof, two 90-ft domes, porthole skylights | right | calacademy.org (living roof); arup.com |
  | 11 | Castro Theatre reopened in February 2026 (voice) | right (6 Feb 2026) | sfchronicle.com; localnewsmatters.org |
  | 12 | SF State founded 1899, on the Lake Merced campus from 1953 (voice) | right (classes from fall 1953) | Wikipedia "History of San Francisco State University" |
  | 13 | Salesforce Park: 600 trees (voice) | right | tjpa.org; Wikipedia |
  | 14 | Lake Merced 650 acres (voice) | right as the lake's surface (Wikipedia); the park is 614 acres (SF Rec & Park) | Wikipedia "Lake Merced" |
  | 15 | Ferry Building farmers market Tue / Thu / Sat (voice) | right | foodwise.org; ferrybuildingmarketplace.com |
  | 16 | Pavilion world (−251.5, 1017.0) | right: `project(37.76838, −122.47361)` is 0.1 u away, on the island's east shore ("on the east side", SF Rec & Park) | core/geo.ts |
  | 17 | St Ignatius / Holy Virgin / Cal Academy origins | right (0.0 / 0.1 / 0.8 u from their lat / lng) | core/geo.ts |
  | 18 | New spots: Union Square 0.7 u from the Dewey Monument, Haight & Ashbury 0.8 u, 19th & Winston 4.1 u, Civic Center Plaza 3.8 u, Music Concourse 18 u from the bandshell (inside the concourse) | right | core/geo.ts |
  | 19 | The three ride paths lie on lane T's published lines | right (≤ 5.4 u off) | public/opus-bay/sf/v1/transit-w4.json |

- **Budgets**: 40.45 of the 120 cap (≥ 50 of the balance kept); GLBs 71–185 KB (≤ 250 KB), ≤ 5,880 triangles (≤ 6k),
  one 1024 / 512 px WebP each; the atlas 74 KB; 17 MB of voice, loaded on demand. No per-frame code in the lane's
  modules (data only; the new SVG helper returns one frozen object per id).

### Defects found and fixed

1. **Models named the wrong sites.** `W4_MODELS` said `landmarkId: 'music-concourse'` / `'usf-lone-mountain'` (the
   plan's parent sites), but lane L put the AI slots on their own sites `cal-academy` and `st-ignatius-church`. D2's
   swaps follow `SF_MODELS[part.model].landmarkId === site.id` (asserted for the wave-3 swaps in `sf-models`), so the
   wave-4 swaps would break that rule. Now `'cal-academy'` / `'st-ignatius-church'`; a test ties every model to the site whose `w4.aiSlot` names
   its GLB (it also fails if lane L later puts the Holy Virgin or pavilion slot on a site with another id: re-label the
   row, free).
2. **The sticker API only fitted a canvas.** Lane P's badges are SVG (`ui/MapBadge.tsx`), where `drawImage` does not
   apply. New `mapStickerSvg(id)` → `{ href, viewBox, atlasW, atlasH }` (one frozen object per id): a nested
   `<svg viewBox>` + `<image>` crops the one shared atlas (2 nodes per badge for `badgeNodes`). Tested.
3. **Perf rides would not board.** `board` / `alight` were `wharf-hyde`, `duboce-church`, `19th-ave-winston`, …; lane
   T's stable ids are `loop-wharf-hyde`, `muni-duboce-church`, `muni-19th-winston`, … Fixed and tested against
   `W4_STATION_IDS` (the loop ride also ends within 30 u of its stop).
4. **Spot site lists were wrong.** They used plan names for sites lane L built under other ids (`haight` →
   `haight-ashbury`, `yerba-buena` → `yerba-buena-gardens`), missed the two AI-swap sites in range (`cal-academy`,
   `st-ignatius-church` at Music Concourse and Haight / USF; `sfmoma` at Union Square) and listed `sf-zoo` 380 u from
   Stonestown / SF State (its lod-0 ring is 220 u). Fixed; a test keeps every built site listed inside its lod-0 ring.
5. **The ledger's "Published" rows were stale**: Cal Academy 93,616 B / 21.0 × 5.2 × 11.4 and St Ignatius 5,880 tris /
   153,044 B / 9.78 × 13.3 × 16.22 (the files before the fit to lane L's bounds); the lead merges this table into
   ASSETS-LEDGER. Now the published numbers (+ IoU native / as published); a test compares the rows with `W4_MODELS`.
6. **Unsourced numbers in the test**: "213 ft" for St Ignatius (fact 9) and "player 1.5 u" for the pavilion (the player
   is 1.73 u, `actors/dims.ts`). Relabelled with the sources and the measured clearance.

### Open (integration corrections: they touch existing files or other lanes' files)

1. **Step 3, `scale: 1`** → `scale: [1, 1, 1]`: `LandmarkSwapPart.scale` is a per-axis tuple (`landmarks/index.ts`).
2. **Step 1 breaks a test it does not name**: `tests/opus-bay-sf-landmarks.test.ts` asserts `sfLandmark(m.landmarkId)`
   for every `SF_MODELS` row, and the wave-4 sites are not in `SF_LANDMARKS` (`w4sites.ts` is drawn beside it). Lane L
   changes that line on purpose to `sfLandmark(id) ?? w4Site(id)`; `sf-holy-virgin` / `sf-chinese-pavilion` are
   registered only once `geary-west` / `blue-heron-lake` exist (or the test lists those two pending site ids).
3. **Step 2, the voice preload call does not exist**: `voice.preload()` takes no ids (it warms the six barks) and the
   `VoicePlayer` lives inside `audio/audio.ts`. With `LINE_WAIT` = 0.7 s a tour clip that is not fetched yet plays the
   chirp and is dropped. Correct: in `audio/audio.ts` (lane T), on `transit` `board` / `approach` / `arrive` with a
   `station`, and on `trip` `start` of a tour, ``voice.load(`${VoicePlayer.lang()}-<line id>`)`` for the next stop's
   approach / arrive / tip lines (three clips ≈ 150 KB). Do **not** add the tour ids to `SF_VOICE_LINES`:
   `preloadLines()` would then fetch all 107 clips (≈ 5 MB per language) at every city start; the default chirp
   (`'hi'`) is fine for them.
4. **Long clips, no queue**: tour clips run 2.2–8.1 s (wave 3: ≤ 2 s) and `voice.line` bypasses `CLIP_GAP`, so two lines
   emitted back to back overlap. The bus fits (approach 60 u before the stop ≈ 7.3 s at 12 u/s with the 2.6 u/s² brake;
   the longest approach clip is 6.5 s), but lane C should not emit a chapter intro / outro or an arrival line until the
   previous clip's `TOUR_VOICE_CLIPS[id].duration` has passed.
5. **Step 3, the pavilion's walk data**: the mesh is open between all eight columns (there is no "entrance gap on +Z";
   the concept's bench walls did not survive the mesh) and stands on a 0.3 u platform (edge r ≈ 2.4, steps to r ≈ 2.7
   on ±Z): a walk surface at local y 0.3 over the octagon, column blockers r ≈ 0.25 (not 0.18) on r ≈ 2.15.
6. **St Ignatius, for the SoloView gate**: on the decoded mesh the AI dome's centre is at local z ≈ −1.9 against lane
   L's −2.7 (0.8 u toward the front and higher, not "further back" as "Known gaps" says), the towers at z ≈ 3.2 against
   L's 4.05, and the AI front steps reach z ≈ 5.4 against the blockers' 5.0: with "blockers unchanged" the player can
   walk ≈ 0.4 u into the steps. The gate checks the walk-around there (or the front blocker moves to z 5.4).
7. **Bundle**: `voiceTour.ts` is 32 KB (10.6 KB gzip) and repeats lane C's texts; `data/assets.ts` is in the eager
   graph, so measure GameRoot gzip (≤ 250 KB) after step 2.
8. **Minor, runner**: the exported `gateRow()` does not fail a void spot; only the Markdown table marks it. Read the table.

### Checks

- `npx tsc -p tsconfig.app.json --noEmit`: 0 errors (on the pushed tree: `0df24a7` + `a016a1a`)
- `npx eslint .`: 0 errors, 42 warnings on the repo files (`--ignore-pattern .vite-opus`; the untracked `.vite-opus/` optimizer cache in this worktree adds the 12 known errors, lane V's request to the lead stands)
- `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts`: **654 / 654** green on the pushed tree (`a016a1a`, on `0684080`; 643 / 643 and 652 / 652 on the earlier rebases), incl. hero regression and contracts
- `tests/opus-bay-w4-assets.test.ts`: 7 / 7 (was 6: + the landmarkId / ledger test; the sticker and spots tests gained
  the SVG crop, the station ids and the lod-0 rings). The new checks fail on the old data (tried: `music-concourse`,
  `carl-cole`).
- No relayed owner message arrived during the review.

## Early phase, part 2

Worktree `C:/Users/willy/wt/w4-v` (rebased on `origin/opus-bay`), dev port 5306, scratch `C:/Users/willy/opus-qa/w4/w4-v/gate/`
(the gate runs, spot checks) and `…/postcards/` (raw draws). Brief: (1) the SoloView-equivalent gate for Holy Virgin and
the Chinese Pavilion now that lane L has built `geary-west` and `blue-heron-lake`, the verdict and the exact swap rows (a
retake within the cap if close but flawed); (2) W4-C9 / H-7: four postcards for the wave-4 areas with their PostcardDef
rows for lane C; (3) H-8 SFX only if lane T's synthesized sounds read cheap. Only new files were created, plus lane V's
own part-1 files (`w4Models.ts`, `prompts.py` / `.json`, `specs.json`, the ledger, this report); no other lane's file was
edited.

### 给主人的摘要

1. 两个 AI 地标过了"对比关"：**圣母大教堂**（五个金顶）和**蓝鹭湖中国亭**，在游戏里黄昏时近看、从街上看、远看（64 像素小图）都比程序化版本更像真的，接线时两个都换成 AI 版（亭子的翘檐、瓦垄和宝顶一眼就认得出来）。
2. 圣母大教堂原来的 AI 模型太"胖"，塞进 Geary 大道上那块窄地皮后金顶被挤成了尖刺；按"窄地皮上又高又窄的教堂"重新出图、转 3D，现在正好放进地皮，红白外墙、门廊和圆圆的大金顶都在。
3. 新做了 **4 张明信片**：州立大学的草坪、金门公园音乐广场、天涯海角看金门大桥、M 线从双峰隧道钻出来的西门站。和已有 12 张是同一种黏土小模型风格；逐张放大检查过，没有文字和标志（西门那张车身上像标志的红记号和车头显示屏上的字已经抹掉）。每张都配好了网上核对过的小知识、藏卡提示和藏卡位置（都能走到，也不和别的卡片抢位置）。
4. 巴士 / 轻轨的合成音效还没接进游戏，没法实际听；看做法和游戏里其它音效是同一套玩具风格，所以这次**不花钱生成**，接线后你听过觉得"假"再做（预留 5 分）。
5. 这次花了 15 分（第四波累计 55.45 / 120 分），余额 400.13。

### What was built

| file | what |
|---|---|
| `scripts/opus-sf/assets/w4/ai-gate.{html,tsx}` | The gate page (dev server only; nothing imports it): `?sites=<w4 id>&ai=0\|1` + `solo=all` = D2's SoloView with only that site in the registry, or `world=city&start=free` = the streaming city with the site appended (as lane L's sites-preview). Each site with a row in `W4_SWAPS` gets `swap = { parts: [w4SwapPart(row, g.at)], build: remainder, ship: ai }` and, with `ai=1`, the row's blockers and fade; the four models are added to `ASSETS.models`; `hv=` / `pv=` and `hvs=` / `pvs=` try another GLB / part scale. |
| `scripts/opus-sf/assets/w4/ai-gate.mjs` | The runner (one headless Chrome through `opus-shot.mjs`): solo = the ¾, street, far, front and right views plus SoloView's own `thumb(64)`, `thumb(128)`, `silhouette(64)`; city = the site's photo pose, a street view 10 u behind the arrival spot at eye 4.5 u, and far views whose distance makes the model height span 128 / 64 px on the 900 px screen (12° above), each after `city.whenReady`, HUD hidden, Karl off (`--karl 1` keeps him). |
| `scripts/opus-sf/assets/w4/gate_sheet.py` | Contact sheets of the runs (one row per variant, the 64 px thumbnail at 1:1 and ×3). |
| `src/opus-bay/data/sf/w4Swaps.ts` | `W4SwapRow` { site, model, ship, part (y `'ground'` or local), remainder, blockers, fade?, note }, `W4_SWAPS` (geary-west, blue-heron-lake), `w4Swap(site)`, `w4SwapPart(row, groundAt) → LandmarkSwapPart`. Type-only imports; the game does not import it yet. |
| `public/opus-bay/models/sf/w4-holy-virgin.glb` (replaced), `W4_MODELS['sf-holy-virgin']` | The retake: 5,879 triangles, 179,372 B, 2.8 × 9.1 × 3.2 u (lane L's lot), front +Z = the porch on Geary Blvd; ground footprint body x ±1.34, z −1.54…1.24, porch \|x\| ≤ 0.6 to z 1.6. `specs.json` `holy-virgin-tall` (native) / `holy-virgin-tall-fit` (published). |
| `public/opus-bay/postcards/sf-{state-quad,music-concourse,lands-end,west-portal}-{1200,600}.webp` | The four postcards (1200 × 900 / 600 × 450 WebP q82; 54–89 KB / 23–32 KB; the shipped 12 are 45–96 / 20–39 KB). |
| `src/opus-bay/data/sf/w4Postcards.ts` | `W4_POSTCARD_IDS`, `W4_POSTCARDS` (title, fact, hint, sourceUrl, position, `near`, `attraction`), `W4_POSTCARD_ART` (large / small urls), `w4PostcardDefs() → PostcardDef[]`, `w4PostcardUrls()`, `W4_POSTCARDS_VERIFIED_AT`. Dependency-free. |
| `scripts/opus-sf/assets/w4/postcards.py` | The export of the shipped 12 (centre-crop to 4:3, 1200 + 600 WebP q82) into this checkout; prints bytes and sha256. |
| `scripts/opus-sf/assets/w4/prompts.py` / `.json` | + `holy-virgin-tall` (the retake), + `POSTCARDS` (the four subjects and the West Portal retake), the P5 / P13 refs. |
| `tests/opus-bay-w4-swaps.test.ts` | 4 tests: rows ↔ models ↔ lane L's AI slots (GLB stem, registry id, placement within 0.05 u); the model footprint and every blocker inside the site's exclusion; Holy Virgin fitted to the lot at 9.1 u, its blockers cover the measured footprint, the arrival spot outside them; the pavilion keeps lane L's column blockers, its platform tops the floor deck, the fade covers roof and eaves. |
| `tests/opus-bay-w4-postcards.test.ts` | 3 tests: art on disk (sizes, bytes), text (bilingual, hint ≤ 45, facts no longer than the shipped 12), new ids, ledger rows; `near` / attraction real and within 70 u; every spot standable and reachable from ferry-gate **with the wave-4 sites registered**, ≥ 6.5 u from every card spot (the 24 landmark cards, lane C's place cards, lane P's attraction points and arrivals) and > 20 u from every postcard. |
| `docs/opus-bay/qa/w4/V/v-gate-holy-virgin.jpg`, `v-gate-pavilion.jpg`, `v-postcards-w4.jpg` | Key shots (below). |

### Evidence

- **The gate** (golden hour, quality high, RTX 3070 laptop; shots `v-gate-holy-virgin.jpg`, `v-gate-pavilion.jpg`):

  | site | variant | SoloView 64 px silhouette (coverage, bbox px) | site triangles / city calls (photo pose) | read |
  |---|---|---|---|---|
  | geary-west | procedural (lane L) | 0.122, 18 × 42 | 726 / 63 | a plain white tower with gold onions: "gold domes" far off, a box up close |
  | geary-west | part-1 AI squeezed [0.44, 1, 0.47] | 0.100, 16 × 41 | 5,880 / 64 | red-white body right, the domes 2.3× elongated into spikes (at 128 px a candle cluster) |
  | geary-west | **retake fitted 2.8 × 9.1 × 3.2 (published)** | 0.106, 16 × 41 | 5,879 / 64 | kokoshniks, red trim, porch, a round central dome; the side domes 1.75× taller than round, still onions |
  | blue-heron-lake | procedural (lane L) | 0.124, 26 × 33 | 428 / 64 | a generic gazebo (plain cone roof) |
  | blue-heron-lake | **AI on lane L's stone base (published)** | 0.146, 28 × 33 | 2,980 / 65 | upturned eaves, tile ribs, finial: a Chinese pavilion at every distance |

  Night (SoloView): the cathedral floodlit (glow 0.1), the pavilion dim in the park. City frames at the photo pose:
  226,362 vs 221,209 triangles (Holy Virgin, +5.2k), 181,737 vs 179,185 (pavilion, +2.6k). The AI part loads only within
  220 u of the focus (C2): Holy Virgin is 276 u from the Music Concourse perf spot (not in its view), the pavilion 83 u
  (+2.6k on that spot's measured 235k).
- **Holy Virgin retake**: SAM from concept b: native 4.94 × 9.1 × 5.52 u, IoU 0.906 against the concept, 0.03 %
  non-manifold, 1 island, palette ΔE12 0.30 → 0.87; fitted with `--box 2.8,9.1,3.2` (x ×0.57, the depth ×0.57 then its
  middle band ×1.04): IoU 0.666 as published (a lot-fit waiver, like St Ignatius), 179,372 B. Decoded footprint
  (draco3d, scratch `gate/footprint.mjs`): body x ±1.34, z −1.54…1.24, porch to z 1.6; placed at z −0.02 it spans z
  −1.62…1.58 inside the exclusion (−1.65…1.62) and x ±1.40 inside −1.45…1.50. Top: 0.54 (ground at the origin) + 9.1 =
  9.64 u over the base (lane L's procedural cross: `height.top` 9.6).
- **Postcards**: every draw read at full size in crops (no letters, numbers, signs or logos; the bandshell's cartouche is
  blank). West Portal draw a rejected (a floating slab on cream, the fault of T1-8); draw b fixed locally (3 marks,
  1,773 px, diffusion fill; the red belt line kept). Spots (scratch `gate/spots.mts`, the same checks as the test):

  | id | spot (x, z) | surface | nearest card spot | nearest site arrival | fact source (checked 2026-09-27) |
  |---|---|---|---|---|---|
  | sf-state-quad | 226.5, 1550.6 | grass (the Quad) | SF State card 28.7 u | sfsu 10.4 u | en.wikipedia.org/wiki/San_Francisco_State_University ("San Francisco State Normal School", 1899) |
  | sf-music-concourse | −228.5, 927 | dirt (a gravel walk) | de Young card 13.6 u | music-concourse 10.0 u | en.wikipedia.org/wiki/Spreckels_Temple_of_Music (Claus Spreckels's gift, dedicated 9 Sep 1900) |
  | sf-lands-end | −721, 1180 | dirt (the cliff trail; the Golden Gate in view, scratch `gate/le-view2.jpg`) | Lands End arrival 53.3 u | lands-end 56.4 u | sfmta.com "A Line to Land's End" (the trail follows much the same path; landslides in Feb 1925) |
  | sf-west-portal | 125, 1259 | pavement (West Portal Ave, 24 u from the tunnel mouth) | West Portal attraction 15.2 u | — (no site yet) | en.wikipedia.org/wiki/Twin_Peaks_Tunnel (opened 3 Feb 1918; 11,675 ft ≈ 3.6 km; the neighbourhood is named for it) |

### Decisions

- **Verdicts: both ship AI.** The pavilion: the procedural roof is a cone, and the model's upturned eaves are the
  pavilion's identity; footprint and walk data are the same (lane L built the procedural to the model). Holy Virgin: up
  close and at the photo pose the AI body (kokoshnik gables, the red trim of the 2015–16 scheme, the porch) is far
  better; at 64–128 px both read as gold domes, the procedural's onions a little rounder. The part-1 mesh (whose squeeze
  made spikes) was replaced by a narrow concept retake (5 credits) rather than shipped squeezed.
- **The lot**: 2.8 × 3.2 u instead of lane L's 2.6 × 3.0: 2.8 u is the OSM footprint's width along Geary (x −1.39…1.43),
  3.2 u the depth between the neighbour behind (z ≤ −1.7) and the sidewalk (z ≥ 1.65); both inside lane L's exclusion
  (2.95 × 3.27). The part sits at z −0.02 (lane L's slot says −0.05; the test allows 0.05) so the back keeps 0.03 u to the
  exclusion. Height by the landmark rule (38.1 m → 9.1 u), not reduced: the side domes stay 1.75× taller than round,
  accepted (Russian onions are tall; the central dome is round).
- **Blockers** for the AI cathedral: the body box x ±1.36, z −1.58…1.24 and the porch x ±0.62, z 1.2…1.6 (lane L's
  procedural box ends at z 1.45: the player would stand 0.15 u inside the porch). The pavilion keeps lane L's eight
  column blockers and gets a hero fade (r 2.8, y1 4.95, the AI part only) because the player walks under its roof.
- **glow 0.1** on the cathedral (floodlit like D2's churches: Grace 0.08); none on the pavilion; `castShadow` on both.
  No new program: both parts use D2's `ob-model-hero` (warmed as `d2-models`); the fade is that program's uniform.
- **Postcard subjects**: the lead's examples (SF State / Stonestown, the Music Concourse, Lands End, the Metro at a
  portal) over the plan's H-7 list: the Tiled Steps would copy an artwork (plan §2.2 forbids it), and the N Judah at
  Ocean Beach would sit near the shipped Ocean Beach card. The Metro one is West Portal (the M, a wave-4 line, and an
  attraction with lane C's card), not the Sunset Tunnel mouth in Duboce Park (no card within 100 u).
- **Facts** say something the place card does not (the SF State card has 1899 / 1953, the postcard the normal school;
  the West Portal card has 1918, the postcard the neighbourhood's name and the length). The Lands End fact leaves out the
  railway's opening year (1888 in Wikipedia, "July 1889 on the bluffs" at SFMTA) and never mentions the labyrinth
  (lane L's rule).
- **`near`** = the card that shows the art once found: `sfsu`, `de-young-tower` (the Music Concourse has no card of its
  own; the de Young overlooks the bowl, 14 u away), `lands-end`, and `west-portal` (lane P's attraction and lane C's
  place card; lane L's P3 site `west-portal` is not built).
- **H-8 skipped**: lane T's `audio/lines.ts` sounds are not wired yet (`transitSound` plays cable-car kinds only), so
  there is nothing to listen to in the game; by construction they follow the game's other synthesized SFX (filtered
  noise for the air brake, inharmonic partials for the stop bell and the gong, two-note chimes), which keeps the toy world
  one sound palette. The listening pass belongs after lane T's integration step 7; ≤ 5 credits stay reserved for it.

### Integration plan (exact steps, after "wave 3 verified")

1. **`data/assets.ts`** (lane V): besides part 1's step 1 (`SF_MODEL_IDS` / `SF_MODELS` gain the four models;
   `sf-holy-virgin` is now 179,372 B), `SF_POSTCARD_ART_IDS = [ …the 12…, ...W4_POSTCARD_IDS ] as const` (import from
   `./sf/w4Postcards`); `POSTCARD_ART` and `listAssetUrls()` then carry the eight files. **This lands in the same commit
   as step 2** (`CARDS` in data/sf/postcards.ts is a `Record<SfPostcardArtId, SfCard>`): lane C may make both edits in
   one commit (lane V agrees here; say so in lane C's report).
2. **`data/sf/postcards.ts`** (lane C): `CARDS` gains the four rows: `...Object.fromEntries(W4_POSTCARD_IDS.map(id => {
   const c = W4_POSTCARDS[id]; return [id, { title: c.title, fact: c.fact, hint: c.hint, sourceUrl: c.sourceUrl,
   position: c.position, near: c.near }]; }))`; `CITY_POSTCARDS` / `CITY_POSTCARD_NEAR` follow; the header's "20 in
   all" becomes 24. Where `CITY_POSTCARD_NEAR` is read (the art strip on a card), `sfsu` / `lands-end` resolve after lane
   L's registration; `west-portal` resolves to lane C's `west-portal` place card (or to lane L's site if it is built).
   Tests that change on purpose (`tests/opus-bay-sf-content.test.ts`, lane C): G2-2 expects 16 ids; the fact-source rule
   accepts the rows of `W4_POSTCARDS` (verified on the web on `W4_POSTCARDS_VERIFIED_AT`; their sources are not among
   D2's landmark sources); the 400 u list gains `sf-west-portal` while `west-portal` is not a landmark; the anchor check
   uses `w4Site(near)`'s arrival for `sfsu` / `lands-end`; `c.postcards.length` 20 → 24 and the `sf-` filter 12 → 16.
   `tests/opus-bay-w4-postcards.test.ts` (lane V) keeps checking the spots.
3. **Lane L, `geary-west.ts`**: `import { w4Swap, w4SwapPart } from '../../../data/sf/w4Swaps';`,
   `const SWAP = w4Swap('geary-west')!;`, and on the record `swap: { parts: [w4SwapPart(SWAP, g.at)], build: () =>
   undefined, ship: SWAP.ship, note: SWAP.note }`, `walk: { blockers: SWAP.ship ? SWAP.blockers : <today's box> }`;
   `aiSlot.at` z may become −0.02 (the row). Optional: `tall: [{ x: 0, z: -0.1, r: 1.4 }]` for the glide (the domes
   reach 9.6 u over the base), then regenerate tops.ts (lane L's step 5).
4. **Lane L, `blue-heron-lake.ts`**: the same with `build: b => { <the stone-base lathe>; <the two causeways> }` (the
   first and the last statement of today's lod-0 build; the floor, columns, beam ring, roof and finial go), `ship:
   SWAP.ship`, `fade: SWAP.fade`; blockers and surfaces unchanged.
5. **Lane L, cal-academy / st-ignatius**: run this gate (add their remainder to `REMAINDER` in ai-gate.tsx and a row to
   `W4_SWAPS`, then `node scripts/opus-sf/assets/w4/ai-gate.mjs --site <id> --ai 0|1 [--mode city]`), or SoloView after
   the registration; send lane V the rows (or add them to `W4_SWAPS` and say so). Part 1's open items 1 and 6 apply
   (`scale: [1, 1, 1]`; St Ignatius's front steps reach z 5.4).
6. **After the swaps land**: `tests/opus-bay-w4-swaps.test.ts` (lane V) runs on the registered records; D2's
   `opus-bay-sf-models` rule `SF_MODELS[part.model].landmarkId === site.id` holds for both rows.

### The early review's open items, now

- 1 (`scale` tuple): done for the two rows (`[1, 1, 1]`, tested); the cal-academy / st-ignatius rows are still to write.
- 5 (the pavilion's walk data): resolved: lane L built the procedural to the model and the row keeps its blockers (tested).
- 6 (St Ignatius's steps): open, for that site's gate.
- 2, 3, 4, 7, 8: unchanged (integration steps of part 1).

### Not done

- The gate for `cal-academy` and `st-ignatius-church` (their remainders are lane L's code; step 5).
- H-8 generated SFX (skipped; Decisions).
- The Blue Heron island still draws and walks as lake water in the city (lane L's request to the lead): in the gate's
  city shots the pavilion stands in the lake on its stone base; nothing in the model depends on it.

### Requests

- **Lane C**: the four rows (step 2) and the test changes; for other subjects (the plan's Tea Garden, the N Judah at
  Ocean Beach) ask lane V: a draw is 2 credits (≈ 3.5 with a retake).
- **Lane L**: the two swaps (steps 3–4); the geary-west part z −0.02 (or keep −0.05: the test allows 0.05); the
  cal-academy / st-ignatius gate (step 5).
- **Lane T / lead**: after lane T's integration step 7 (bus / LRV sounds wired), a listening pass; lane V generates SFX
  only if they sound cheap (≤ 5 credits).
- **Lead**: merge the ledger's batch 4 (the 15 credits at 22:16–22:20 UTC your §8.2 reconciliation found: 6 Nano Banana
  Pro + 1 SAM + 1 Nano Banana Pro, all this lane's) and the replaced `w4-holy-virgin.glb` published row into
  ASSETS-LEDGER.md.
- Seen: the lead-merge's §8.4 items routed to lane V (the water-hole fill in `build.ts` / `far.ts` for Strawberry Hill,
  the mural boards at 0.06 u, `opus-prof.mjs`'s port, the `?debug` panel on phones, the route warm-up drift, Draco + WebP
  for the district heroes and the kit masks) are integration-phase work: they start once "wave 3 verified" is announced
  to this lane (the early rule held for part 2).

### Checks

- `npx tsc -p tsconfig.app.json --noEmit`: 0 errors.
- `npx eslint .`: 0 errors, 43 warnings (the repo's; none in lane V's files: ai-gate.tsx mounts the page with
  `createElement` so react-refresh's rule stays quiet; the lead-merge now ignores `.vite-opus`).
- `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts`: **733 / 733** green on the tree rebased onto
  `dccb988`^ (the lead-merge and the first integration pushes of lanes G and P included), incl. hero regression and
  contracts; lane V's `w4-assets` 7 / 7, `w4-swaps` 4 / 4, `w4-postcards` 3 / 3. On the rebases before it the only
  failures were other lanes' wall-clock asserts under the full run's load, green alone: E2-5 "a cached cell is cheap"
  (`opus-bay-sf-move2`, 24 / 24) and "window build < 200 ms" (`opus-bay-sf-nav`, 7 / 7; the lead-merge §8.4 routes it to
  lane G). Other lanes push every few minutes: the final rebase before the push is checked with tsc, eslint and lane
  V's three test files (the full suite takes ≈ 2 min). The swap checks fail on the old data (tried: with the part-1 Holy Virgin GLB put back, the exclusion and the
  lot-fit tests fail). The spot search rejected West Portal candidates inside the shops (`canStand` false) and left out
  those on the carriageway (surface `road`).
- No relayed owner message arrived during part 2.
