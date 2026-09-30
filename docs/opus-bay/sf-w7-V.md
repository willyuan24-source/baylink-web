# Wave 7 · lane V · models, characters, vehicles, effects (Higgsfield)

Worktree `C:/Users/willy/wt/w7-v` (branch `w7-v`, from `origin/opus-bay` `76de8820`), dev port 5711, scratch
`C:/Users/willy/opus-qa/w7/v/`, ledger `docs/opus-bay/ledger/w7-V.md`, QA images `docs/opus-bay/qa/w7/V/`. Brief:
`sf-w7-lead.md` §7 (row V). The owner (2026-09-29 ≈ 20:30 PDT): "如果游戏内的建模，画面，人物，特效可以有所提升质感等，尽情用
higgsfield 上能用的工具，分数随便用 …".

## 给主人的摘要

1. **人物更有质感了**：主角和 BAYBAY、城里的居民、鹈鹕现在看起来像真的**毛毡/绒布玩偶**——近看有细细的绒毛纹理，边缘有一圈毛茸茸的光；远处自动变平滑，不会闪。骨骼、名字、挂点全都没动（G 线的蝙蝠翅膀和服装照挂）。玩具车和自行车保持原来的"硬玩具"质感。
2. **特效全部换成手绘水粉风格**（用 Higgsfield 画了 10 个小图案）：金色四角星闪光、奖励时的彩带纸屑、金币弹出、爱心、音符、泥土/沙子上的脚步小烟尘、落水时的水花（水滴 + 泡沫圈）、渡轮开动时船尾的白色浪花；拿到明信片、小游戏拿到 ★、第一次到达知名景点都会撒彩带。还是同一次绘制，不多占性能。
3. **金门大桥有雾了**：走近金门大桥时，会有几缕薄雾从太平洋那边慢慢飘过桥下和桥塔之间（手机中画质也有，低画质关闭）。
4. 顺手修了一个老问题：手机（中/低画质）上所有粒子的半透明边缘会变成发白的硬块，现在是柔和的。
5. Higgsfield 这部分花了 24 分（12 张图），余额 2247.5 → 2223.5；账本 `docs/opus-bay/ledger/w7-V.md`。

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
