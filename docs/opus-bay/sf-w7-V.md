# Wave 7 · lane V · models, characters, vehicles, effects (Higgsfield)

Worktree `C:/Users/willy/wt/w7-v` (branch `w7-v`, from `origin/opus-bay` `76de8820`), dev port 5711, scratch
`C:/Users/willy/opus-qa/w7/v/`, ledger `docs/opus-bay/ledger/w7-V.md`, QA images `docs/opus-bay/qa/w7/V/`. Brief:
`sf-w7-lead.md` §7 (row V). The owner (2026-09-29 ≈ 20:30 PDT): "如果游戏内的建模，画面，人物，特效可以有所提升质感等，尽情用
higgsfield 上能用的工具，分数随便用 …".

## 给主人的摘要

1. **人物更有质感了**：主角和 BAYBAY、城里的居民、鹈鹕现在看起来像真的**毛毡/绒布玩偶**——近看有细细的绒毛纹理，边缘有一圈毛茸茸的光；远处自动变平滑，不会闪。骨骼、名字、挂点全都没动（G 线的蝙蝠翅膀和服装照挂）。玩具车和自行车保持原来的"硬玩具"质感。
2. **特效全部换成手绘水粉风格**（用 Higgsfield 画了 10 个小图案）：金色四角星闪光、奖励时的彩带纸屑、金币弹出、爱心、音符、泥土/沙子上的脚步小烟尘、落水时的水花（水滴 + 泡沫圈）、渡轮开动时船尾的白色浪花；拿到明信片、小游戏拿到 ★、第一次到达知名景点都会撒彩带。还是同一次绘制，不多占性能。
3. **金门大桥有雾了**：走近金门大桥时，会有几缕薄雾从太平洋那边慢慢飘过桥下和桥塔之间（手机中画质也有，低画质关闭）。
4. **地标更像真的**：按 R 线的"像不像"评分表，金门公园里 de Young 美术馆的观景塔换成了 Higgsfield 生成的 3D 模型——深色、带凹点和小孔的铜板、会扭转的塔身、顶上一圈玻璃观景层（以前是一根浅棕色的方盒子）；艺术宫的柱廊柱子加粗、加了柱头，不再像一堵墙。
5. 顺手修了一个老问题：手机（中/低画质）上所有粒子的半透明边缘会变成发白的硬块，现在是柔和的。所有改动都在性能预算内（最多多 2 次绘制）。
6. Higgsfield 一共花了 30 分（14 张图 + 2 次成功的 3D，失败的一次已退款），和交易记录逐笔对过；账本 `docs/opus-bay/ledger/w7-V.md`。

## Part a · close-ups, ranking, and the first two upgrades (2026-09-29 20:34–21:40 PDT)

### Close-ups and the ranking (a)

Shot with `node scripts/opus-shot.mjs` (my wrapper `C:/Users/willy/opus-qa/w7/v/shoot.mjs`: teleport, QA camera, HUD
hidden, `renderer.info` read at each shot), desktop 1440 × 900 high and 390 × 844 mid (dpr 3), golden hour. What looks
cheapest, worst first:

| rank | what | seen | verdict / owner |
|---|---|---|---|
| 1 | **the particles** — dust = flat grey discs, splash = white dots, sparkle = thin canvas stars, hearts / notes flat | every jump, coin, postcard, sea lion | **mine → W7-V2 (done)** |
| 2 | **the player's body** — smooth plastic next to BAYBAY's painted GLB fur | always on screen | **mine → W7-V3 (done)** |
| 3 | on phones (mid / low) every soft particle edge turned into a hard white blob (premultiplied colour pushed through the sRGB conversion) | phone | **mine → fixed in W7-V2** |
| 4 | the transit vehicles (cable car, F-line, loop bus): one BatchedMesh `w4-vehicles` — my finder did not locate instances in part a | rides | part b |
| 5 | de Young's Hamon tower reads as a brown box from the Music Concourse side (the twisted OSM loft only reads from the narrow side) | Golden Gate Park | wait for lane R's scorecard (part d) |
| 6 | Coit Tower, the Transamerica Pyramid, the Ferry Building, Salesforce Tower | skyline | district heroes (`world/landmarks.ts`, pinned by the hero regression): not changed |
| — | the sea lions (AI GLBs), BAYBAY (AI GLB), the Golden Gate, Sutro Tower, Oracle Park, the Tea Garden pagoda | | fine at the distance a player sees them |

### What was built

| task | files |
|---|---|
| **W7-V1** Higgsfield batch 1: 10 painted particle sprites + 2 tileable plush textures (24 credits) | `docs/opus-bay/ledger/w7-V.md` |
| **W7-V2** the painted fx atlas and the richer pool | `scripts/opus-sf/assets/w7v/fx_atlas.py` (new), `public/opus-bay/w7v/fx-atlas.webp` (new, 512², 40 KB), `src/opus-bay/world/fx.ts`, `src/opus-bay/world/ferry.ts` (surgical: the wake, 8 lines) |
| **W7-V3** felt on the characters | `scripts/opus-sf/assets/w7v/felt.py` (new), `public/opus-bay/w7v/felt.webp` (new, 256², 24 KB), `src/opus-bay/actors/models.ts`, `src/opus-bay/actors/vehicles/models.ts` (two `{ hard: true }`) |
| tests | `tests/opus-bay-w7-v.test.ts` (new, 6 tests) |

**W7-V2 · fx** (`world/fx.ts`, still ONE instanced draw of ≤ 256 quads while anything is alive, none otherwise):
- The atlas is a 4 × 4 grid of 128 px cells: A = coverage, R = the paint's shading (the shader tints with the particle
  colour and keeps the brush strokes: `vCol * (0.62 + 0.5 * R)`). Cells: dot, ring (procedural), star, heart, note,
  puff, drop, confetti, flare, leaf, foam, cloud, wisp (painted). Soft sprites get an elliptical vignette so no disc
  edge shows. A canvas atlas with the same layout draws plain shapes until the WebP is in (or if it fails).
- Code packing is now `shape + 16·additive + 32·flat`; per particle a twinkle frequency and a fade-in share (CPU only).
- Old presets are richer (every existing `spawnFx` caller gets it for free): `sparkle` = an additive flash + twinkling
  painted stars + rising specks; `splash` = two foam rings on the water + spray + painted drops; `dust` = painted puffs
  that turn; `hearts` / `notes` painted. New presets: `coin`, `confetti`, `wake`, `wisp`, `leaves`
  (`FxPreset` widened; the union only grew).
- The pool now also listens to: `footstep` on sand / dirt (a small puff at the feet, coloured by the ground),
  `coins` paid (a coin pop at the player's head — not for `trail:` / `cache:` / `ring:` coins, which already sparkle
  where they lie, nor purchases), a postcard (+ confetti), `play` end ★ (confetti) / ◆ (a bigger sparkle), a first
  tier-1 `arrival` (confetti), `glide:land` (a dust ring).
- City only, quality mid / high: **fog wisps through the Golden Gate** — while the player is within 420 u of mid-span,
  at most 16 wisps (8 with reduced motion) start on the ocean side, clear of the tower legs, the water and the deck,
  drift 1.1–1.9 u/s toward the Bay and fade in / out over 20–28 s; one thins out as the player walks into it.
- `world/ferry.ts` (surgical, named): while the city ferry makes way (> 1.2 u/s) and the player is within 160 u, foam
  puffs every 0.14 s behind the stern and a little bow spray (the water shader's existing wake stays).
- **Bug fixed** (old, all particles): the fragment premultiplied the colour *before* `colorspace_fragment`; on the
  canvas pass (quality mid / low: no post) the sRGB conversion then brightened every faint texel, so soft edges read as
  hard white blobs on phones (see the phone shots). Now the colour space first, then × alpha.

**W7-V3 · felt** (`actors/models.ts`): `patchCharacterShader` gains a felt layer — the felt photo (Higgsfield V11,
high-passed and made seamless by `felt.py`) is sampled tri-planar in the **bind-pose object space** (`position` /
`objectNormal` before skinning, so it rides each part with its bone and never swims), at two scales (fibres ×3.4, the
felted unevenness ×0.95), tints the colour ±, raises the fibres with a screen-space bump that fades out from 3 to 12 u
(no shimmer far away) and lets the rim light catch them. Uniform sets: `feltUniforms` (the procedural toys: 0.2),
`baybayFelt` (the GLB BAYBAY, whose painted fur already has strokes: 0.1), `noFelt`. `hardToyMaterial()` = the same
program (same cache key and source: no new program, no warm-up) with the felt off, used by `buildRig(…, { hard: true })`
for the toy car and the bikes. No bone, slot anchor, part, name or size changed (test).

### Evidence

- Shots (read before described): `qa/w7/V/v-a-player-baybay-felt.jpg` (before: the live wave-6 look, smooth; after:
  felt on the player and BAYBAY + the painted sparkle and coin pop), `qa/w7/V/v-a-fx-dust-splash.jpg` (before: grey
  disc dust / white dots; after: painted puffs, drops, foam, leaves, confetti), `qa/w7/V/v-a-ggb-wisps.jpg` (desktop
  high), `qa/w7/V/v-a-phone-felt-fx-wisps.jpg` (390 × 844 mid, after the premultiply fix; before it the wisps were white
  "ice floes" on the water — the reason for the fix).
- Calls / triangles (`renderer.info`, the view at the shot): Ferry plaza start, desktop high, with ≈ 60 particles
  alive: 95–96 calls / 344–347k (the same view without particles: 95 / 351k — the pool is the one draw it always was);
  the Golden Gate view from the Presidio shore, 16 wisps alive: desktop 35 calls / 67k, phone mid 31 / 60k (+1 call,
  +32 triangles while wisps live). Felt: 0 calls, 0 triangles, programs unchanged (60 desktop / 58 phone before and
  after).
- Checks: see the part-a commit (below).

### Decisions

- Order: the particles and the characters first (seen on every screen; the owner's "特效 … 人物 … 质感"), vehicles and
  AI landmark swaps next (the swap gate needs R's scorecard, 22:30).
- Felt applies in both world modes: the characters are actors (the hero regression pins static district meshes only;
  moving actors, fx and characters are other lanes' tests). The district's static meshes are unchanged.
- The pelican stays on the felt material (a plush toy); the toy car and the bikes are hard toys.
- Coin pops skip coins that already sparkle where they lie (no double burst).
- Wisps: never at quality low; never in the district.

### Known gaps

- Wisps are billboards without soft depth: one crossing a cable can show a faint cut line at close range (kept clear of
  the legs, the deck and the water).
- The felt bump is a derivative bump: on very low-res phones it fades out by 12 u anyway.

### Not done (part a)

- The vehicle close-ups (the fleet's BatchedMesh) → part b.

### Requests

- None.

**Part a checks** (pushed `9aa298aa`): `tsc` 0 · `eslint .` 0 errors (43 old warnings) · the full opus-bay suite 1535 / 1535
on the part-a tree after its first rebase (one earlier run: 1528 / 1529, the wall-clock `W5-D-review the paid memo`
test at 109 ms under load — green alone, 5 / 5); the two later rebases (lanes K, G, S, X: none of my files) were checked
with `tsc` 0 and the 62 tests of the contracts, the hero regression, G's pelican / costumes, K's camera and mine.

## Part b · a generated de Young tower, the Palace's columns (2026-09-29 22:05–23:40 PDT)

### What was built

| task | files |
|---|---|
| **W7-V4** the de Young's Hamon tower as an AI part (lane R's scorecard #22; Higgsfield batch 2) | `public/opus-bay/models/sf/w7v-de-young-tower.glb` (new, 3,920 tris, 101 KB, Draco + 1024² WebP), `src/opus-bay/data/sf/w7vModels.ts` (new: `W7V_MODELS`), `src/opus-bay/data/assets.ts` (surgical: spread into `SF_MODELS`, `SfModelId` += `W7VModelId`), `src/opus-bay/world/sf/landmarks/de-young-tower.ts` (the swap: build split into museum / tower / fins; `swap` ships the AI tower with the procedural remainder; the walk blocker follows the AI footprint), `scripts/opus-sf/assets/w7v/{build.py,specs.json}` (the wave-4 cleanup, `../w4/w4_cleanup.py`), `src/opus-bay/world/sf/landmarks/tops.ts` (regenerated) |
| **W7-V5** the Palace of Fine Arts peristyle (lane R's scorecard #8, in code) | `src/opus-bay/world/sf/landmarks/palace-of-fine-arts.ts` (the colonnade: thicker tapered 6-sided open shafts under square capitals, spaced 1.12 u instead of 0.95) |
| tests | `tests/opus-bay-w7-v.test.ts` (+1: the tower row = the file, registered, Draco + WebP ≤ 1024², ≤ 4k triangles, shipped by the site, the remainder draws less than the procedural site) |

**The de Young.** Lane R's scorecard (`sf-w7-R-realism.md`, #22, 21:00) said the twist is subtle at this size and the
copper too light and plain. The real Hamon Observation Tower is 144 ft tall, the tallest point in Golden Gate Park,
clad in "variably perforated and dimpled copper plates" whose patina slowly turns green (Herzog & de Meuron with Fong +
Chan, opened 15 Oct 2005 — https://en.wikipedia.org/wiki/De_Young_Museum, checked 2026-09-29). Two concepts in the
wave-4 landmark recipe (nano_banana_pro 2k, the K6 toy style), SAM 3 on each; concept a (a slab that twists, dimpled and
perforated dark copper, window slits, a glass observation floor under a thin overhanging roof) won. The wave-4 cleanup
(weld, flat base, dissolve + collapse to 4k, texel re-bake, grade to dark copper / teal glass, Draco + WebP) fitted it
to the procedural tower's box: v1 kept the mesh's own depth (3.45 u) and read as a fat block from the Music Concourse,
**v2 squeezes the depth to 2.6 u** (the OSM slab; IoU against the concept 0.841, 0 % non-manifold, 1 island). The part
stands at local (0.03, 0.05, 0.2) — its flat base just under the ground (0.13–0.57 under the footprint), its top at
11.2 like the procedural cap — so the glide tops, the tall part and the walk data barely move (tops regenerated: the
same row).

**The Palace.** R #8 said the peristyle "reads as a solid wall". The colonnade is a "1,100 ft pergola" with Ulric
Ellerhusen's weeping women on top of the flower boxes (https://en.wikipedia.org/wiki/Palace_of_Fine_Arts, checked
2026-09-29). A generated wing would lose the gaps (SAM fills them), so this one is code: every column a thicker, tapered
shaft under a capital, a little further apart. The flower boxes stay where they were.

### Evidence

- **Gate (SoloView, golden hour)**: procedural lod 0 1,920 triangles → the AI tower 3,920 + the remainder 1,238 =
  5,158 (T1 budget 6,000); SoloView frame 6 → 8 calls (the model and its shadow). Shots: `qa/w7/V/v-b-de-young-close-gate.jpg`
  (in the city close to the forecourt, and SoloView's street view procedural | AI), `qa/w7/V/v-b-de-young-before-after.jpg`
  (the same Music Concourse view before / after).
- **City, calls / triangles at the de Young (desktop 1440 × 900 high)**: Music Concourse view 79 / 234.1k → 80 / 235.5k;
  the ¾ view 76 / 241.7k → 78 / 246.2k; close to the forecourt 76 / 213.6k. Phone 390 × 844 mid (v1 file, same
  triangles): 72 / 148.8k, 64 / 162.6k, 61 / 125.3k. Well inside 150 / 400k.
- **Palace**: lod 0 3,932 → 3,996 triangles (budget 6,000; an 8-sided shaft with its own base first came to 6,302 and
  failed the landmark budget test: made lighter); `qa/w7/V/v-b-palace-columns.jpg`.
- Checks: in the part-b commit notes below.

### Decisions

- de Young: the AI part replaces only the tower; the museum, its fins, the canopy and the forecourt stay procedural (no
  generated mesh can hold the OSM outline of a 20 u building). District unchanged (a city site).
- Palace: code, not a GLB (see above).
- Not done from R's V list: **St Ignatius's grey cupolas** (#45, "maybe") — I could not confirm the cupola colour on the
  web tonight (the parish and USF pages speak of the 2023–25 renovation of the spires, not a colour), so no change; the
  **Haight Victorian / mural kit** (#17, "maybe") — no time left for a kit with masks and tints.
- Vehicles: the cable car, the F-line and the loop bus read as the intended toys up close (a close-up of a Powell car at
  Mason St: maroon panels, gold belt, cream posts, brass poles, the gripman); their material is the city's shared
  `ob-toy` program, so a texture there would change every building's program — not tonight.

### Known gaps

- The AI tower's twist direction is the concept's, not checked against the real one (the real tower turns from the
  museum's grid at its foot to the street grid at the top).
- The first cleanup (v1) rendered on the phone shots only; the phone was not re-shot after v2 (same triangles, same
  file size ± 1 KB).

- **The ferry's wake (W7-V2) was invisible in part a**: checked in the game at last (a camera behind the city ferry
  leaving Gate E): the foam spawned (18–39 particles alive) but at the district water datum −0.6 while the bay under the
  ferry is at ≈ 0 (its pose y −0.03), so it lay under the water. W7-V2b / V2c put it at the boat's own waterline
  (pose y + 0.06): the foam now shows as a faint white trail and bow spray (subtle on bright water; the water shader's own
  wake is still the main one). Shots in scratch `C:/Users/willy/opus-qa/w7/v/shots/wake4/`.

### Not done (part b)

- A night pass of the de Young (the glass floor has the model material's glass glow, not checked at night).

### Checks (part b)

- On the part-b tree rebased on `origin/opus-bay` (with lanes K, G, S, X, P, Q, M, R up to 23:48): `tsc` 0 · `eslint .`
  0 errors (43 old warnings) · the full suite 1559 / 1561: `AI swaps: the D2-06/07 decision gates` expected the old
  list of shipped swaps (fixed in the test: + `de-young-tower`, surgical, named in W7-V4) and **`W5-bus 20+ simulated
  minutes` fails deterministically — also on the pushed tree without any part-b change** (checked: my part-b edits set
  aside, the test alone: "bus at an interlock stood 29.2 s (box:f-line@5661:750) at (149, 601)"); lanes Q and M report
  the same on pristine origin: not lane V's (lane B owns the test). After the fixes: `tsc` 0; the sf-models, sf-landmarks,
  landmark-context, w4-assets and my tests green.
- **Final, on the pushed tree** (part b + the wake fix rebased on origin at 00:00): `tsc` 0 · `eslint .` 0 errors · the
  full suite **1614 / 1616**: the two failures are `W5-bus 20+ simulated minutes` (red on origin itself, above) and the
  wall-clock `W5-D-review the paid memo` (555 ms under load; alone 5 / 5 green).

### Requests

- Lane B / the lead: `W5-bus 20+ simulated minutes` is red on `origin/opus-bay` since ≈ 23:00 (a bus waits 29.2 s at the
  F-line box at (149, 601)); not caused by lane V (it fails with lane V's part b removed).

## Review

Adversarial review of lane V (W7-V-review), 2026-09-30 00:25–01:30 PDT, worktree `C:/Users/willy/wt/w7-v-rev` from
`origin/opus-bay` `1903d52f`, dev port 5731, scratch `C:/Users/willy/opus-qa/w7/v-rev/`.

### 给主人的摘要

1. V 线这一波是**真的变好看了**，我逐个近看、夜里看、手机看过：人物的毛毡质感自然不刺眼，特效（星光、金币、彩带、水花、烟尘）是手绘风、
   手机上边缘也柔和了；金门大桥的薄雾很淡、没有穿帮成硬块；de Young 美术馆的新塔比原来那根浅色方柱子更像真的（深色铜板、扭转、
   玻璃观景层），夜里也正常；艺术宫的柱廊更通透。
2. 找到并修好 1 个问题：毛毡"绒毛凹凸"的着色器在一个按像素分支里取屏幕导数，这在规范里是未定义行为，某些手机显卡上可能出现黑点/闪点
   （桌面上看不出来）。现在导数在分支外先算好，画面完全一样（有前后对比图），并加了测试。
3. 账本补全：两张毛毡素材图（V11 用上了、V12 没用上）原来写着"见 part b"，现已写明；Higgsfield 花费我自己再对了一遍交易记录：
   **V 线共 30.00 分，无误**。
4. 性能都在预算内（电脑最多约 100 次绘制 / 35 万三角形，手机约 81 / 27 万），地区模式（district）的建筑没有被改动。
5. **不阻挡上线**。检查全绿：tsc 0、eslint 0 错误、opus-bay 测试 1645/1645（之前红的 W5 公交测试已由 B 线修好）。

### What was checked

- **Every commit** of the lane (`git log --grep "W7-V"`: 7436af14, 252fd275, 52d166b5, b4389ef1, 9aa298aa, b9cb8774,
  7c0a76a1, d527a08e, 56c7361c, b548e463, 071b2666) read line by line.
- **Played / shot** with `node scripts/opus-shot.mjs` (lane V's shoot helper pointed at 5731), every image read:
  desktop 1440 × 900 high golden hour and night, phone 390 × 844 mid (dpr 3): the player's felt close up (felt on / off),
  the fx at night (sparkle, coin pop, confetti), phone fx (sparkle, coin, dust, splash — soft edges, no white blobs), the
  Golden Gate from the deck (follow cam, 12–16 wisps alive), from under the span, at both towers and at both ends (the
  wisps started past the towers hug the Marin hill as a soft cloud; no hard cut against the deck, the legs or the water
  was found), at night; the de Young at golden hour (phone) and at **night** (not shot by the lane: the AI tower reads,
  a little brighter than the dark museum because of its part glow 0.05, like the other AI landmarks); the Palace's
  columns (lane V's own before / after). QA: `qa/w7/V/v-rev-night-dy-ggb-wisp.jpg`, `qa/w7/V/v-rev-deck-felt.jpg`.
- **Calls / triangles** (`renderer.info`, the view at the shot) — Ferry Building start close-up desktop high 95–100 /
  348–353k, phone mid 77–81 / 270–273k; de Young desktop night 77–82 / 207–242k, phone 61–63 / 127–163k; Golden Gate deck
  desktop 37–44 / 84–147k, phone 29 / 70k. W6-Z's desktop maximum was 122 / 365k: every spot is inside 150 / 400k.
- **Assets**: `fx-atlas.webp` 512² 40 KB, `felt.webp` 256² 24 KB, `w7v-de-young-tower.glb` 101 KB (Draco + one 1024²
  WebP, 3,920 triangles, checked by the lane's test against the file) — small; iPhone texture memory +≈ 5.6 MB at most
  (1024² tower + mips), the others < 1.5 MB.
- **Shaders / programs**: `hardToyMaterial` shares the character program (same key, same source; three runs each
  material's own `onBeforeCompile`, so the toy car and bikes carry their own felt-off uniforms) — confirmed; the GLB
  BAYBAY's positions are in world units (0.85 × 1.3 × 0.79), so the tri-planar felt tiles at the intended scale; program
  counts unchanged between felt on / off (50–60 desktop, 51–58 phone).
- **Events and allocations**: the new hooks (`footstep` — only the player's controller emits it, `coins`, `play`,
  `arrival`, `glide:land`) spawn into the preallocated pool; no per-frame allocation added (the `for … of [aPos, aFx,
  aCol]` array is older than wave 7); wisps stop spawning at quality low / in the district / away from the bridge (test).
- **Higgsfield**: the `transactions` tool re-read to 2026-09-29 11:17 UTC — lane V's rows are exactly the 14 Nano Banana
  Pro and four 3D Objects rows: **30.00 credits** (ledger section "Review check").
- **Facts**: the lane's two sources (https://en.wikipedia.org/wiki/De_Young_Museum,
  https://en.wikipedia.org/wiki/Palace_of_Fine_Arts, checked by the lane 2026-09-29) were not re-fetched by the review
  (time); what shipped matches what they are cited for (a dark, perforated / dimpled copper tower that twists, a glass
  top; a colonnade of separate columns).
- **District / text / touch / saves**: no district mesh, save field, UI string (zh / en / 繁體) or touch target changed
  by the lane; the hero regression and the whole opus-bay suite ran (below).

### Defects fixed

| # | defect | before | after |
|---|---|---|---|
| R1 | **The felt bump took `dFdx` / `dFdy` inside `if (obNear > 0.001)`** (`actors/models.ts`, `FELT_BUMP`): `obNear` varies per pixel (the 3–12 u fade), and GLSL ES 3.00 §8.9 leaves derivatives in non-uniform control flow undefined — on some mobile GPUs that is garbage (black / sparkling pixels along the fade ring on every character). | the derivatives of the felt height and of the view position computed in the branch | taken before the branch (`obDF`, `obSX`, `obSY`), the branch only applies them; same look (shot before / after, desktop high and phone mid), same program count; test `W7-V-review · the felt bump takes its screen-space derivatives in uniform control flow` (red on the lane's tree, green after) |
| R2 | Ledger: V11 / V12 verdicts were "see part b" and never filled in | "see part b" | V11 kept (felt.webp), V12 not shipped (felt.py reads only V11) |

### Open items (not blocking)

- A painted atlas that loads after its pool was disposed (a world switch within the first second) is set on the dead
  material and never disposed — a CPU-side image only (it was never uploaded); harmless, noted.
- The coin pop also fires for rewards that already have their own sparkle (eggs, crests, the hunt): two bursts on one
  moment, by design of the lane (paid coins always pop); a taste call for the owner / lane E.
- The ferry's wake stays faint on bright water (the lane's own note); the de Young tower's twist direction is the
  concept's, not checked against the real one (lane's note).
- Lane V's Not-done list stands (vehicles unchanged, night glows, St Ignatius, the Haight kit).

### Checks (the review's tree)

- On the lane's tree (base `1903d52f`) with the fix: `tsc` 0 · `eslint .` 0 errors · opus-bay 1619 / 1620 (the W5-bus
  proof, red alone too: the base itself). **Rebased on `origin/opus-bay` `e10457b5`** (lane B's W7-B9 pins the proof's
  Bay clock): `tsc` 0 · `eslint .` 0 errors (43 old warnings) · the opus-bay suite **1645 / 1645**.

### Blocking the go-live

- **Nothing from lane V.** (`W5-bus 20+ simulated minutes` was red on the base `1903d52f` itself — lane B's; green
  after the rebase onto W7-B9.)
