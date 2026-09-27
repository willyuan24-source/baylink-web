# Wave 3 · lane H2b report (Higgsfield part 2b: painted map, voice lines, murals)

## Part a

### 给主人的摘要

- 全城手绘地图做好了：先用我们自己的城市数据画出一张俯视"底图"（海岸、公园、街道、房子、两座大桥，没有任何文字），再请 AI 按底图重画成水彩/水粉风格，一共试了 7 张，选中第 4 张。
- 选中的那张和真实海岸线对得很准：95% 的海岸误差 12 像素（上限 31）。AI 在市中心几块空地上"乱写"了一点像字母的涂鸦，已经逐块放大检查并擦掉。
- 地图面板里已经能看到这张画（`?paper=0` 可关掉）。手机最多只加载 2048 版（约 345 KB，解码 16 MB），4096 版只在电脑上放大时才加载。
- 目前陆地上还被 G1 的矢量街区盖住了大半；我写好了给 G1 的改动补丁（陆地让给手绘图、只在上面描海岸线、放大时再淡入街道），截图里对比了两种效果。
- 花费 20.5 分（本 lane 上限 150），余额 498.28 → 477.78。语音和壁画留给 Part b（G2 的台词表还没上主线）。

### What was built

| file | what |
|---|---|
| `scripts/opus-sf/map/raster2d.ts` | A small 4 × 4 supersampled mask rasteriser: even-odd fills, capsule strokes (round joins), union layers (overlaps never darken twice), coverage compositing, 2 × downsample, chamfer distance. Pure, tested. |
| `scripts/opus-sf/map/render-base.ts` | The whole board top-down in `MAP_FRAME`, from our own data, **no text**: cream table and the board's soft shadow → board water tinted by the distance from the shore (the cooler Pacific west of the Gate, as `world/sf/water.ts`) → far land (+ the hero slab's seawall land, Angel Island as `world/backdrop.ts` draws it) → the chunks' 12 area classes in file order → relief from the far DEM (smooth gradients, clamped) → 27k streets by class → block pads → 57,480 buildings with `world/sf/look.ts` roof colours, fronts and shadows (+ the 239 hero lots, sheds, Ferry Building) → 38,901 trees → the Golden Gate (international orange) and the Bay Bridge (silver) on the frames the 3D landmarks use → the board's glass rim. Writes `base-4096/2048.png`, `land-4096/2048.png` (the coast the check uses), `board-2048.png`, `bridges-2048.png`, `hero-4096.png`, `base.json`. ≈ 10 s. |
| `scripts/opus-sf/map/paper_post.py` | Register and check a candidate (needs the scratch venv): land / water segmentation (teal hue incl. pale shore bands, lakes filled back, piers / bridges / rims removed by a 6 px open-close on both masks), similarity fit (coarse-to-fine Powell on a truncated-Huber chamfer cost), coast p95 both ways inside the board and away from the bridge corridors, then a second segmentation in the base frame, grade toward the palette (table median → `#f3ecdf` ±3 %, water and land halfway to the base means in Lab), retouch (`--smooth-hero`, `--declutter "x0,y0,x1,y1;…"`: a 9 px grey closing that wipes thin dark strokes), WebP 1024 / 2048 / 4096 + `report.json`, overlay and crops. Verified on the base itself (p95 9.4 / 3.6 px) and on a synthetically warped base (scale 1.025, 1.2°, (30, −22) px shift → recovered to 0.1 %, p95 9.8 / 4.2 px). |
| `public/opus-bay/map/paper-v1-{1024,2048,4096}.webp` | The paper: 110,694 / 344,736 / 668,100 B. |
| `src/opus-bay/data/mapPaper.ts` | `MAP_PAPER_V1` (sizes, bounds = `MAP_FRAME`, version, sha256 of the 2048, bytes), `MAP_PAPER` = v1 or null under `?paper=0`, `mapPaperUrls()` (always lists v1), `PaperWidth`. Still dependency-free. |
| `src/opus-bay/ui/mapPaper.ts` | `isPhoneLike()` (phone / tablet UA, touch-only pointer, or a touch screen ≤ 1024), `paperWidthFor(req, phone)` (phones stop at 2048; pure), `paperUrl`, `preloadPaper` / `paperLoaded` / `bestLoadedPaper` (fetch + `decode()` once, cached), `loadMapPaper(width)`, `drawMapPaper(ctx, img, toPx)` for a canvas map. |
| `src/opus-bay/ui/MapPaperLayer.tsx` | Progressive SVG layer: the sharpest decoded paper stays underneath while the requested one loads, then it fades in (0.3 s) and the smaller one leaves the DOM; a cream table rect fills the view past the square paper (no more teal strips beside it). G1's existing mount (`<MapPaperLayer width={zoom > 4 ? 4096 : 2048} />`) works unchanged. |
| `tests/opus-bay-h2b-assets.test.ts` | 7 tests: rasteriser coverage, shared edges, holes, capsule unions, compositing, halve, chamfer; paper files exist with the right WebP size, bytes and caps, sha256; phones stop at 2048; the committed check report passed the gate and matches the files. |
| `docs/opus-bay/h2b/paper-v1-check.json` | The registration / grading / export report of v1 (fit, coast numbers, gains, retouch rects, sha256 of every file, how the text check was done). |
| `docs/opus-bay/h2b/request-G1-cityMapDraw-paper.patch` | The exact change requested from G1 (below). |
| `docs/opus-bay/ledger/w3-H2b.md` | Preflight notes and the 7 T2 rows. |

API for other lanes: G1 keeps `<MapPaperLayer width={…} />` (or `loadMapPaper` + `drawMapPaper` on a canvas);
`MAP_PAPER` is non-null → pass `paper: true` to `drawCityMap` (already the case). Nothing new in the GameRoot graph; no
3D material, program or draw call.

### Evidence

- **H2b-1 preflight:** balance 498.28; CDN GET of K6 → 200 (6,390,343 B); `media_upload` → S3 PUT 200 → `media_confirm`
  "uploaded" (1 × 1 PNG); venv `C:/Users/willy/opus-qa/w3/h2b/venv` with imageio-ffmpeg (ffmpeg 7.1), Pillow 12.3 (WebP),
  numpy, scipy, opencv-headless. `get_cost`: nano_banana_pro 4k = 4, seedream_v4_5 high = 1, seedream_v5_pro 2k inpaint = 2.5.
- **H2b-3 candidates** (one batch, 07:54:55 UTC, transactions show exactly these 7 spends; subtotal 20.5; balance
  477.78 after, confirmed by `balance`):

  | # | model / variant | coast p95 cand→base / base→cand (px at 2048, gate 30.7) | verdict |
  |---|---|---|---|
  | c1 | nano_banana_pro, diorama A | 15.0 / 9.8 | passes; 3D towers lean over the streets, GGB runs to the board edge → runner-up |
  | c2 | nano_banana_pro, diorama A | 293.5 / 4.1 | invented a Marin headland |
  | c3 | nano_banana_pro, gouache B | 33.3 / 5.1 | two invented piers off Ocean Beach |
  | **c4** | **nano_banana_pro, gouache B** | **12.0 / 6.4** | **shipped as v1** |
  | c5 | seedream_v4_5 high, A | 317 / 740 | perspective diorama, layout ignored |
  | c6 | seedream_v4_5 high, B | 237 / 541 | re-imagined city |
  | c7 | seedream_v5_pro inpaint | 24.3 / 22.0 | passes; blobby clay at 2048 |

  v1 fit: scale 0.9972, rotation −0.03°, shift (1.9, −1.0) px; median coast error 2.0 px (≈ 3 u). Contact sheet
  `docs/opus-bay/qa/w3/H2b/candidates-c1-c7-and-v1.jpg`, coast overlay (red = our coast) `v1-coast-overlay.jpg`, base
  `base-render.jpg`.
- **Invented text:** read by eye — 9 tiles at 1.33 : 1, 9 tiles at 1 : 1 over the whole city, 11 crops at 2 : 1 over the
  big-lot east side (SoMa, Mission Bay, Dogpatch, Bayview, Hunters Point, Treasure Island, the Embarcadero), zooms on each
  suspect. Found: pseudo-letters ("MBIP"-like) on one Bayview lot and scribbles on the hero lots / the Ferry shed (the
  base drew those as big blank rectangles). Wiped (`--smooth-hero --declutter "3030,2172,3122,2210"`), zooms re-read:
  faint smudges remain, no letters. One red building reads a bit like an "h" at 2 : 1 — a footprint, left as is.
- **In the real app** (`?start=free&world=city&discover=all`, dev server 5207, RTX): desktop 1440 × 900 and phones
  390 × 844 / 375 × 667 `--mobile --dpr 3`, map opened, whole-city fit and ×10 zoom. The paper registers with the vector
  coast, fog, labels and markers; desktop switches to the 4096 at zoom > 4, phones stay on the 2048 (DOM checked each
  time); `?paper=0` gives the old vector map. Shots: `desktop-map-fit-asis.jpg`, `desktop-map-open-asis.jpg`,
  `phone-390-map-fit-asis.jpg`, `phone-375-map-open-asis.jpg`, and with the G1 request applied locally (not committed):
  `desktop-map-open-with-G1-request.jpg`, `desktop-map-zoom10-with-G1-request.jpg`, `phone-390-map-open-with-G1-request.jpg`.
- **Load and memory, phone profile** (390 × 844, DPR 3, touch, CPU 4×; fetch with `no-store` + `createImageBitmap`): 1024 =
  108 KB, decode 26 ms, 4 MB; 2048 = 337 KB, decode 84 ms, 16 MB; the 4096 (652 KB, 208 ms, 64 MB) is never requested on
  a phone (`isPhoneLike` = true there: coarse pointer, no fine pointer, 5 touch points). On a 4G link (≈ 10 Mbit/s) the
  1024 + 2048 are ≈ 0.35 s; the decode is off the main thread (`img.decode()`). Desktop decode: 11 / 38 / 138 ms.
- **Checks** on the final push: `tsc` 0 errors, `eslint src/opus-bay tests/opus-bay-*` 0 problems, **313 / 313**
  opus-bay tests (hero regression and contracts green; district mode untouched: nothing here runs there).

### Decisions

- **Style: the flat gouache map (c4), not the 3D diorama (c1).** Both pass the coast gate; c1's extruded towers lean
  over their own streets and would fight the vector streets and markers drawn on top, c4 reads as a map at every zoom.
- **Checker scale:** coasts are compared after a 6 px (≈ 9 u) open-close on both masks, inside the board (40 px in from
  the rim: the county-line cut is not a coast) and outside 24 px corridors around the two bridges (extended past their
  ends: a painting may carry a deck on). The gate stays the plan's 1.5 % of the width, both directions.
- **Retouch instead of a retake:** the only failures of c4 were small pseudo-letters on big blank lots; a grey closing
  there costs nothing and keeps the fit. No retake round was needed.
- **Progressive loading and the phone cap live in H2b's layer**, so G1's mount did not have to change.
- The base render keeps Angel Island (city mode draws it) and leaves the Marin / East Bay boards out (not on origin
  yet); if C2 adds them, re-render the base and repaint the edge (Part b or later).

### Known gaps

- **On land the paper is mostly hidden** until G1 applies the request below: `drawCityMap` with `paper: true` still
  fills parks, woods, sand, lakes and every block opaquely and draws the streets at full strength (water, islands and
  bridges already show the painting). With the request the painted city shows at the whole-city and default views and
  the streets fade in from 0.8 px/u.
- The unvisited neighbourhoods' paper fog (G1, 0.82 alpha) hides the painting as intended until you explore.
- At the maximum desktop zoom (18×) the 4096 paper is magnified ≈ 2.3× (soft but clean); phones at 18× see the 2048
  magnified ≈ 3.2×.
- Faint smudges remain where the pseudo-letters were wiped (visible only at 2 : 1 and closer).

### Not done (Part b)

- H2b-6..9 voice lines (G2's frozen `BARK_SCRIPT` and the voice-line emits are not on `origin/opus-bay` yet; no
  `docs/opus-bay/sf-w3-G2.md`), H2b-10 murals, H2b-12 README / final ledger merge. `docs/opus-bay/sf-w3-G1.md` did not
  exist either; G1's wave-2 mount was used.

### Requests

1. **G1 — `src/opus-bay/ui/cityMapDraw.ts`** (exact diff: `docs/opus-bay/h2b/request-G1-cityMapDraw-paper.patch`, 69
   lines, applies to `a57df3c`): with `input.paper`, skip the lake / park / forest / sand / block fills (the paper paints
   them) and stroke the far land rings instead (`MAP_PAINT.paperCoast = 'rgba(58, 116, 126, .6)'`, width
   `max(1, 0.9 · px/u)`) — the "vector coastline on top"; draw the three street passes at
   `globalAlpha = min(0.9, max(0, (px/u − 0.8) / 0.8))` (skipped when ≈ 0). Without `paper` nothing changes (G1's op-count
   test is unaffected). Shots with the patch are in `docs/opus-bay/qa/w3/H2b/*with-G1-request.jpg`.
2. **G1 (optional)** — with the painting underneath, the paper fog over unvisited neighbourhoods could drop from
   `.82` to about `.7` so the painting hints through; a design call for G1.

## Part b

### 给主人的摘要

- BAYBAY 在城市里会"说话"了：一共 38 句新台词，中英文各一版，每句不超过 2 秒——第一次骑车 / 开车 / 坐叮当车 / 坐老电车 / 坐渡轮 / 滑翔 / 爬陡坡 / 冲过坡顶，20 个街区的"你好，XX！"，还有"哎呀！""安全降落！""叮叮！叮当车来啦！"这类反应。G2 已经把台词和触发接好，我在游戏里确认过：事件一来，BAYBAY 就说对应的那句（电脑和手机都试了）。
- 三句以前被听错的旧语音（好耶、嗯…让我想想、到啦）重新录了，但**先保持静音，等你亲耳听过再打开**。试听单在 `docs/opus-bay/h2b/listening.md`，按顺序听两个合集 `voice-preview-zh.m4a` / `voice-preview-en.m4a` 就行。"好耶"最后选的是"好耶好耶！"，因为单说"好耶"的 8 个版本，识别器都听成"讨厌"。
- 教会区的两条壁画小巷（Clarion、Balmy）各立了 4 块原创壁画板：太阳与蜂鸟、花菱草与帝王蝶、水果摊、花园乐器、鹈鹕、开满花的叮当车、海湾之夜、海底巨藻林。没有人物、没有人脸、没有文字，也不抄任何真实壁画；白天鲜艳，晚上暗暗的，像被路灯照着。
- Part a 给 G1 的地图补丁 G1 已经合进去了（4002e25），手绘地图现在在陆地上也看得见。
- 这一部分花 22.20 分（语音 3.20、壁画 19）；本 lane 合计 42.70 分（上限 150），余额 455.58。

### What was built

| file | what |
|---|---|
| `src/opus-bay/data/voiceLinesSf.ts` | `SF_VOICE_LINES` (20 lines: 8 `first-*` mode firsts + 12 `zone-<far.zones id>` greetings; zh / en text, mood, chirp fallback — G2 froze these word for word as `BARK_SCRIPT_RECORDED`), `SF_VOICE_EXTRA` (G2's 18 later lines, `BARK_SCRIPT_TODO`, word for word: 7 reactions, 2 transit lines, the "新街区！" opener and 8 more greetings), `SF_VOICE_ZONES`, `SF_VOICE_CLIPS` (76 line clips + `SF_VOICE_REDOS`, the 3 re-records that override `zh-yay` / `zh-think` / `zh-arrived`), `SF_VOICE_UNMUTE` (empty: the re-records stay in `MUTED_CLIPS`). |
| `public/opus-bay/voice/sf/*.m4a, *.ogg` | 79 clips, AAC 64 k + Opus 48 k mono. |
| `scripts/opus-sf/voice/takes.ts` | The take list (text, language, instruction ≤ 128 characters — the service's cap — seed, speech rate; rounds 1–3). |
| `scripts/opus-sf/voice/voice_post.py` | Trim (−40 dB, 20 / 80 ms kept), fades, ≤ 1.12× atempo when a take is a little over 2 s, two-pass loudnorm −18 LUFS / TP −1.5, encode; gates (≤ 2.0 s, no clipped samples, not cut at the end, longest pause ≤ 0.45 s / 0.65 s with "…", median F0 180–450 Hz); an advisory closed-grammar Windows recogniser check (`asr-choice.ps1`); pick = recogniser right → duration nearest the median of the passing takes (150 ms steps) → confidence; `--keep-picks` keeps earlier picks and files byte for byte. Writes the files, `voice-report.json`, `voice-takes.json` and the two preview files. |
| `scripts/opus-sf/voice/listening.py` → `docs/opus-bay/h2b/listening.md` | The owner's listening sheet: all 79 clips in preview order with text, seconds, what the recogniser heard, file, the alternates (scratch copies) and an empty "你的判断" column. |
| `src/opus-bay/data/murals.ts` | `MURALS` (8: id, zh / en title, atlas rect, 512 px single, placement, site), `MURAL_SITES` (Clarion and Balmy centres), `MURAL_RANGE` 300, `MURAL_PANEL` (2.6 × 2.6 × 0.1 u, sunk 0.1), `MURAL_ATLAS`, `muralRect(k)`, `muralUrls()`. |
| `src/opus-bay/world/sf/murals.ts` | `attachMurals(streamer)` (the World system), `muralGeometry(defs, ys)` (pure), `boardGround(def, heightAt)`, `muralSiteDist2`, `MURAL_GLOW` 0.015, warm-up `'ob-murals'`. One mesh, 1 draw call (+ its shadow), 96 triangles, on D2's `makeModelMaterial` in the non-hero variant on a plain Mesh (TOY occlusion dither, Karl, night; no mask). The atlas is fetched only within 300 u of an alley; the mesh is built once the chunks under the boards are resident (`standAt ≠ −1`). |
| `public/opus-bay/murals/` | `atlas-v1.webp` (2048 × 1024, 256,124 B, WebP q48) + 8 × `<id>-512.webp` (44–76 KB). |
| `scripts/opus-sf/murals/place.ts` | Placements from our own chunks: the alley centreline by name, the wall gap on both sides every 0.25 u, four boards per alley alternating sides at the flattest wall near 20 / 40 / 62 / 84 % of the alley, 0.12 u in front of the nearest wall point, facing the centreline. |
| `scripts/opus-sf/murals/murals_post.py` | The atlas (480 px art + a 16 px self-repeating gutter per 512 tile, quality stepped down to ≤ 260 KB), the singles, `docs/opus-bay/h2b/murals-report.json`. |
| `tests/opus-bay-h2b-assets.test.ts` | + 5 voice tests (both clips of every line say the line, ≤ 2 s; G2's frozen blocks = `SF_VOICE_LINES` / `SF_VOICE_EXTRA` word for word; the re-records muted; the greetings on real `far.zones` ids; files = report by bytes / sha256 / duration) and 4 mural tests (atlas rects per tile; files = report; every board in its alley, facing the centreline, outside every building footprint; geometry / uv / ground). |
| `tests/opus-bay-asset-files.test.ts` | New: every `listAssetUrls()` file exists and is not empty; every `ASSETS.voice` pick is a listed file. |
| `public/opus-bay/README.md` | Wave-3 section (map, voice/sf, murals, credits). |

API for other lanes: `emit({ type: 'voice-line', id })` with a `SF_VOICE_LINES` or `SF_VOICE_EXTRA` id plays
`<lang>-<id>` (G2's `game/baybayLines.ts` already does, next to bubbles that start with the line). The murals need
nothing from anyone (World already attaches them).

### Evidence

- **Checks** on the final push: `tsc` 0 errors, `eslint src/opus-bay tests/opus-bay-*` 0 problems, **349 / 349** opus-bay
  tests green (hero regression and contracts included) after rebasing on E2's, D2's, G1's and G2's pushes.
- **Voice in the app** (dev server 5207, `?start=free&world=city`, `__opusAudio.stats().counts`): direct
  `__opusBay.emit({ type: 'voice-line', id })` — desktop en: `first-bike`, `zone-mission`, `first-cable-car`,
  `zone-twin-peaks`, `first-glide` → `voice-clip:en-<id>` = 1 each; desktop zh and phone 390 × 844 `--mobile --dpr 3`
  zh → `voice-clip:zh-<id>` = 1 each; a second `first-bike` within 25 s → `chirp:yay` (SAME_CLIP_GAP); `yay` (a muted
  re-record) → `chirp:hi`; `voice-clip:ready` 23 (zh: 3 district barks + 20 lines preloaded) / 24 (en); 0 dropped.
  **Through G2's scheduler** (after G2-4 landed): `emit({ type: 'glide:land' })` → G2's `glide-land` bubble →
  `voice-clip:zh-glide-land` = 1 (an `SF_VOICE_EXTRA` clip, loaded on demand within LINE_WAIT). Shot:
  `docs/opus-bay/qa/w3/H2b/voice-phone-390-zh.jpg`.
- **Voice measured** (`docs/opus-bay/h2b/voice-report.json`): 79 picks, 0.51–2.00 s; no clipped samples; true peak
  ≤ −2.3 dBTP; integrated loudness −18.1 … −16.7 LUFS (on sub-2-s clips the gated measure after the padded two-pass
  lands a little high); the advisory recogniser picked the right phrase among all lines of the language for 74 of 79
  picks (not `en-first-hill`, `en-zone-mission`, `zh-pant`, `zh-turntable-push`, `en-zone-south-of-market`: no take
  recognised), 7 of the 20 zh greetings only with low confidence (0.35–0.7).
- **Murals in the app**: Clarion and Balmy, desktop 1440 × 900 day and night, phone 390 × 844 `--mobile --dpr 3` day. The
  mural mesh is in the scene with 96 triangles and uses the program compiled at warm-up (`ob-murals:warmup`, usedTimes 2
  = warm-up + the real board): no compile during play. Clarion view: 56 draw calls, 258,527 triangles, 61 fps (RTX,
  shared machine: rough); Balmy view: 87 calls, 373,722 triangles. Shots in `docs/opus-bay/qa/w3/H2b/`:
  `murals-balmy-day-desktop.jpg`, `murals-balmy-night-desktop.jpg`, `murals-clarion-day-desktop.jpg` (+ `-b`),
  `murals-clarion-night-desktop.jpg`, `murals-clarion-phone-390.jpg`, `murals-ab-gpt-vs-nano.jpg`, `murals-atlas-v1.jpg`.
- **Credits**: voice 3.20 (rounds 1–2: 224 jobs, 191 completed, 33 failed and refunded, 2.06; round 3: 118 jobs, 108
  completed, 10 failed and refunded, 1.14), murals 19.00 (12 jobs); `transactions` show only this lane's jobs in every
  window. Lane total 42.70 / 150; balance 455.58.

### Decisions

- **The first line script was H2b's**: G2's frozen `BARK_SCRIPT` was not on the branch when this part started, so I wrote
  the plan's list (8 mode firsts + 12 greetings on real zone ids) as short phrases (≤ 2 s); G2 then froze exactly these
  and added 18 more, which I recorded word for word the same day (`SF_VOICE_EXTRA`). The greetings say "你好，X！ /
  Hello, X!" (not "X到啦", the very word listeners mis-heard).
- **`SF_VOICE_EXTRA` is a separate table** only because G2's test pins `SF_VOICE_LINES` to its recorded block; the clips
  play already (`voice.line` needs only the clip id in `ASSETS.voice`); merging the tables is Request 1.
- **zh-yay = 好耶好耶！**: all 8 single-"好耶！" takes (2 phrasings, 3 seeds, 2 speech rates) were heard as 讨厌 by the
  recogniser (0.93–0.99); "好耶好耶！" was heard as itself (0.98). The bark has no bubble, so the doubled word costs
  nothing; the owner can switch back from the listening sheet.
- **Speech rate, not seed, for variety**: the service ignores the seed for about a third of the texts (14 of 46 groups gave
  byte-identical files), so rounds 2–3 varied speech_rate.
- **Murals: gpt_image_2_5 over nano_banana_pro + K6**: nano's pastel matched the palette better, but its fine dot patterns
  turn to noise at 512 px from the walking camera; gpt's bold shapes read at a glance and its warm palette still sits in
  the city.
- **Boards, not walls**: freestanding boards 0.12 u in front of the facades (Clarion's chunk walls stand right on its 2 u
  road edge); both faces painted (the back faces the wall), the edges take the art's border strip. The non-hero model
  material lets a board between the camera and the player melt like a wall (the phone's portrait camera often stands
  behind one in these narrow alleys). It costs one program of its own, compiled at warm-up.
- **Night glow 0.015**: 0.12 and 0.04 made the boards look lit by daylight against the dark walls; 0 was murky.

### Known gaps

- `SF_VOICE_EXTRA` clips are not preloaded (`voice.preloadLines` reads `SF_VOICE_LINES`): the first one of each waits up
  to LINE_WAIT (0.7 s) and on a slow phone link may play its chirp once. Request 1 fixes it.
- `glide:start` already plays `voice.bark('wow')`; G2's `first-glide` line on the same moment can overlap it (Request 3).
- The loudness of the shortest clips sits up to about 1.3 LU above −18 (a measurement effect on sub-2-s clips); the owner
  should say if any sounds loud.
- In my G2 check, `vehicle:enter` and a hard `vehicle:bump` right after boot gave no line within 3.5 s (G2's own gates:
  the quiet start, the 8 s gap, a bubble on screen); `glide:land` 20 s later did. G2's scheduler, not the clips.
- The murals exist only in the two alleys; the Clarion boards are best seen walking the alley (edge-on from the street
  ends). G2's `sf-mission-murals` postcard pickup stands between two Clarion boards (good company, no overlap).
- The advisory recogniser is not the owner's ear (5 picks it could not recognise at all, listed above).

### Not done

- Nothing of part b is open on the H2b side. Waiting on others: the owner's listening verdict (then add the approved ids
  to `SF_VOICE_UNMUTE`; a clip swap is "take #N" in the listening sheet → re-run `voice_post.py` with that pick, commit),
  the `SF_VOICE_EXTRA` merge (Request 1) and the ledger merge (Request 2).

### Requests

1. **G2 + lead (one commit)**: when G2 moves its `BARK_SCRIPT_TODO` ids into `BARK_SCRIPT_RECORDED` (they are recorded
   now, word for word), change `data/voiceLinesSf.ts` in the same commit to
   `export const SF_VOICE_LINES: Record<string, SfVoiceLine> = { ...CORE_LINES, ...SF_VOICE_EXTRA };` (rename today's
   object literal to `const CORE_LINES`); then the 18 later lines preload with the others. G2's test
   (`BARK_SCRIPT_RECORDED` = `SF_VOICE_LINES`) and mine (`BARK_SCRIPT_TODO` = `SF_VOICE_EXTRA`) must be updated together
   (mine: compare the recorded block with `SF_VOICE_LINES` only).
2. **Lead**: merge `docs/opus-bay/ledger/w3-H2b.md` (part a map, part b voice rounds 1–3 + murals) into
   `src/opus-bay/ASSETS-LEDGER.md`; after the owner has listened, add the approved re-records to `SF_VOICE_UNMUTE` (H2b's
   file; a one-line change).
3. **F (optional)**: in `audio/audio.ts` `glide:start`, skip `voice.bark('wow')` when G2's `first-glide` / `glide-again`
   line is about to play (or G2 delays those lines ≈ 0.8 s).
