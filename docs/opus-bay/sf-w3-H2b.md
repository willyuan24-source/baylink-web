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
