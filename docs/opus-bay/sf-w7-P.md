# Wave 7 · lane P · first-load size & loading

Worktree `C:/Users/willy/wt/w7-p` (branch `w7-p`), port 5704, scratch `C:/Users/willy/opus-qa/w7/p/`. Brief: `sf-w7-lead.md` §3
row P (GameRoot 279.19 → ≤ 265 KB gzip with `sf-w6-P.md` Requests 1, 2, 4, 5 — not 3; an import-with-retry helper for lazy
chunks; what the bigger `/planner-catalog.json` costs a phone's first load; district unchanged).

## 给主人的摘要

1. 游戏首屏主包（GameRoot，压缩后）从 **279.21 KB 降到 267.14 KB**（第一部分，同一棵树上量的）。挪走的都是"开始玩以后才用得到"或"只有城市才用得到"的东西：地标卡片的正文（打开卡片时才下载）、BAYBAY 对话泡泡的排版、自动画质监测、"发现地点"和地点索引、金门大桥桥面行走和城市取景。
2. 行为不变：街区模式和城市模式（电脑 + 手机 390×844）都实玩过——卡片正文、BAYBAY 的泡泡位置、开场都和以前一样；1493 个测试全绿。
3. 接下来：再挪 2–4 KB 到 265 以下并留余量（其他线这一波也会加东西），给所有"按需下载的小包"加"下载失败自动重试"（手机信号一抖，骑车导航等功能不会整局失效），再量一下新的活动目录（125 KB）是否拖慢手机首屏。

## Measuring

`npx vite build --config vite.opus.config.ts --outDir C:/Users/willy/opus-qa/w7/p/<dir> --sourcemap` (no PERF-LOCK seen at
any build; `public/*.json` came out unchanged each time), gzip as vite reports it. Per-module parts:
`C:/Users/willy/opus-qa/w7/p/modsize.cjs` (the sourcemap walk of W6-P; "gzip of parts" sums to ≈ 1.08 × the real chunk
gzip), the static graph: `C:/Users/willy/opus-qa/w7/p/graph.cjs` (the P7 walk of `tests/opus-bay-sf-budget.test.ts`).

**Before** (`315704c1`, the wave-7 base): GameRoot **279.21 KB** gzip (734.34 KB raw). Biggest parts: `game/flow` 15.7 ·
`world/life` 13.9 · `data/script` 13.6 · `actors/moveSystem` 13.6 · `data/district` 13.1 · `data/pois` 12.1 · `actors/camera`
11.6 · `actors/system` 9.2 · … (109 sources).

## Part a · W7-P1 five moves out of GameRoot

### What was built

- **hudLayout into the play layer** (Request 4). `ui/playParts.tsx` re-exports `game/hudLayout` (`export * as hudLayout`);
  `game/hudLayoutSlot.ts` (new, main graph, ≈ 0.3 KB) has the same-named functions (`scanHudBoxes`, `placeBubble`,
  `placeWaypoint`, `hudBoxesVersion`, `releaseHudLayout`, `hudScanCount`, `hudBoxes`): each calls the real one once the
  play layer is in, and answers what an empty HUD answers before (no boxes, the anchor clamped, the waypoint shown). The
  bubble and the waypoint the ticker places are play-layer parts themselves and GameRoot holds Start until that chunk is in,
  so the fallback is never reached in play. `game/Systems.tsx`: the import line only.
- **drei's PerformanceMonitor lazy** (Request 5a). `world/perfMonitor.tsx` (new, its own 0.79 KB chunk); `world/WorldScene.tsx`
  fetches it when play begins and mounts it 9 s later (as before) in its own `Suspense`; a lost fetch resolves to "no monitor
  this visit" (the quality stays where it started), never an error in the world.
- **discovery + the place index** (Request 5b). Nothing in them runs before play in either mode (the save sampler is
  city-only, the place index loads on idle in the city), so `ui/Overlay.tsx`'s boot imports `game/discovery` lazily — in
  both modes, as before (its `initG1` also sets the boarding dialogue's 看线路图 opener and the `place:` resolver) — and
  `game/resume.ts` (the resume's quiet discovery, `?at=` place lookup) and the QA map export in `game/Systems.tsx` import
  discovery / places lazily. New chunks `discovery` 2.43 + `places` 2.88 KB.
- **The GGB deck steer and the city view field** (Request 1, the city-only half). `actors/citySlots.ts` (new, main graph):
  stand-ins for `deckSteer` (`deckAt`, `onDeck`, `heroRelaxed`, `deckDip`, `deckWish`, `deckCameraYaw`) and `viewField`
  (`heroView`, `preferredViewDir`, `preferredCameraYaw`). Until a module registers itself (one line at the end of
  `deckSteer.ts` / `viewField.ts`) they answer exactly what the module answers in district mode: no deck (only
  `actors/cityViews.ts` ever registers one, and it imports deckSteer, so deckSteer is in whenever a deck exists), and the
  hero view rule (`frameAt(stationOf(…))`: what viewField answers while `cityTerrain()` is null). The city chunk
  (`world/sf/cityMode.ts`) imports viewField, so it registers before the city terrain exists. Import lines only in
  `actors/camera.ts`, `CameraRig.tsx`, `controller.ts`, `feet.ts`. District mode never fetches either module.
- **The district POI cards' texts** (Request 2). `data/poiTexts.ts` (new chunk, 7.29 KB): summary / hours / cost / tips of
  the 15 district cards keyed by POI id (the three F-line stops share one text). `data/pois.ts` keeps each card's source,
  date, spot and photo; its `realInfo` starts with empty texts, and `fillPoiTexts()` fills them in place — the district
  POIs as written, their city copies (`CITY_DISTRICT_POIS`) in the city's words (the same `cityDistrictZh` rule
  `cityDistrictPoi` applies). `ui/PoiCardBody.tsx` (the card body, already a lazy chunk) calls it when its module loads, so
  the texts are in before any card body renders; node (tests, scripts: no `import.meta.env`) fills them when
  `data/pois.ts` loads. The only readers of those texts are the card body and tests (grep over `src/opus-bay`: `realInfo`
  elsewhere reads `lat` / `lng` / presence only; the city card refresh touches `sf:` cards only).

### Evidence

| chunk (gzip, as vite reports) | before `315704c1` | after W7-P1 |
|---|---|---|
| **GameRoot** | **279.21 KB** | **267.14 KB** (−12.07) |
| playParts (+ hudLayout) | 15.42 | 16.99 |
| poiTexts (new, with the card body) | — | 7.29 |
| PoiCardBody | 3.33 | 3.38 |
| discovery (new) · places (new) | — | 2.43 · 2.88 |
| deckSteer (new, with cityViews) | — | 1.16 |
| perfMonitor (new, when play begins) | — | 0.79 |
| cityMode (+ viewField) | 55.54 | 56.36 |

- The one-off equality check (scratch `cmp-pois.test.ts`: the pre-move `data/pois.ts` copied beside the new one): the
  district POIs, their city copies and `POIS` **deep-equal** the originals (16 POIs, 43 tips).
- Played on the dev server (5704): district desktop `?world=district&start=local` → the Coit Tower card: summary, hours,
  cost, 3 tips (`docs/opus-bay/qa/w7/P/p1-district-card-texts-desktop.jpg`); city phone 390 × 844 dpr 3
  `?world=city&start=local`: BAYBAY's bubble placed above the coach mark (the HUD scanned 4 times, 6 boxes, through the
  play layer's hudLayout: `docs/opus-bay/qa/w7/P/p1-city-phone-bubble-placed.jpg`), the Coit Tower card with its texts. No
  console error (the old THREE.Clock deprecation warning only).
- Tests: `tests/opus-bay-sf-budget.test.ts` "W7-P1 / P2" (the P7 walk: the eight modules out of GameRoot's graph, no static
  drei import in it, the registrations, the card body's fill, the Overlay's lazy discovery); `tests/opus-bay-w7-p.test.ts`
  (the stand-ins answer the district values before the modules load and delegate after; the texts: one per card, filled
  once, the city copies in the city's words, `Coit Tower` never in the city's zh).
- Checks: on the lane tree `e7c072f8` suite **1493 / 1493**; rebased on origin (`4fdca8a1`, lane Q's part a) as `3f7e0a9d`:
  `tsc` 0 · `eslint .` 0 errors (43 old warnings; the new `export *` in playParts carries a disable line for
  react-refresh) · suite **1510 / 1510**. Pushed as **`404a7752`** after three more rebases that brought only other
  lanes' disjoint commits (W2 Alcatraz, R scorecard, S venues, H Halloween world): `tsc` 0 and the budget / w7-p /
  hero-regression / contracts files 55 / 55 before the push.

### Decisions

1. **A stand-in, not a rewrite, in other lanes' files.** Lane K edits behaviour in `actors/` this wave: the call sites keep
   their names and only their import line changes; each moved module registers itself with one line at its end.
2. **Request 1 is only half city-only.** `feet.corridorAt` (the corridor slide), `stuckHelper` (BAYBAY's pull), `faceOpen`
   (the open-ground turn) and the glide's hero towers (`glideTall.heroTall`) run in district mode too since wave 5, so they
   cannot sit behind the city chunk with a "district value": they are part b (a play-time chunk under the Start gate).
   Only `deckSteer` and `viewField` are truly city-only (the district answers are constants / the hero rule).
3. **The card texts fill in place** (not a new field or type): `core/types.ts` is frozen, and every reader keeps reading
   `poi.realInfo` exactly as before.
4. **Discovery is still fetched in the district** (at the Overlay's boot): its `initG1` sets two hooks the district uses
   (看线路图's opener, the `place:` resolver); the bytes are off GameRoot and in long before Start.

### Known gaps

- A `?start=` / `?solo=` deep link (QA only) that skips the title can reach play before the play layer: the bubble /
  waypoint appear once it lands (as the HUD already did since W6-P1).
- The perf monitor now starts 9 s into play only if its 0.79 KB chunk arrived by then (a phone on a very slow network
  starts it later; offline: never).
