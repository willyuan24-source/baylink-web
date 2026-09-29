# Wave 6 · lane P · first-load size (GameRoot ≤ 265 KB gzip, MF9 / D16)

Worktree `C:/Users/willy/wt/w6-p` (branch `w6-p`), port 5604, scratch `C:/Users/willy/opus-qa/w6/p/`.

## 给主人的摘要

1. 游戏首屏要下载的主包（GameRoot）原来 300.4 KB（压缩后），目标 265 KB。
2. 第一步（P1）：把"开始玩以后才出现"的界面（对话框、HUD、目标卡、明信片弹窗、拍照模式、手机摇杆、气泡等）拆成单独一个小包，游戏一加载就在后台同时下载；按"开始"时如果它还没到会等它（实际测下来 GameRoot 到了 0.1–0.2 秒后它就到了，远早于世界画出第一帧）。主包降到 **285.4 KB**（−15 KB）。
3. 街区模式和城市模式实玩过（电脑 + 手机 390×844，生产构建）：开场对话、导览、HUD、目标卡、摇杆都和以前一样。

## Measuring

`npx vite build --config vite.opus.config.ts --outDir C:/Users/willy/opus-qa/w6/p/dist --sourcemap` (the build left
`public/*.json` unchanged this time), gzip as vite reports it. Per-module sizes: `C:/Users/willy/opus-qa/w6/p/modsize.cjs`
(walks the chunk's sourcemap, gzip -9 of each source's generated slices = "gzip of parts"; the parts sum to ≈ 1.10× the
real chunk gzip), the static graph and its importers: `C:/Users/willy/opus-qa/w6/p/graph.cjs` (the P7 walk of
`tests/opus-bay-sf-budget.test.ts`, with every importer listed).

**Before** (`294746bc`, the wave-6 day-0 head): GameRoot **300.40 KB** gzip (797.66 KB raw; W5-Z measured 298.62 on
its tree, the autumn merge and day 0 added ≈ 1.8 KB). Biggest parts (gzip of parts, KB): `game/flow` 15.6 · `data/script`
13.6 · `actors/moveSystem` 13.5 · `world/life` 13.4 · `data/district` 13.1 · `data/pois` 12.1 · `actors/camera` 11.6 ·
`actors/system` 9.2 · `world/materials` 7.6 · `game/Systems` 7.2 · `game/transit` 7.1 · `actors/models` 6.8 ·
`actors/controller` 6.3 · `world/backdrop` 6.2 · `world/props` 6.2 · `core/terrain` 6.0 · `world/ground` 6.0 ·
`world/landmarks` 5.5 · `world/environment` 4.8 · `actors/anim` 4.6 · `world/water` 4.5 · `world/streetcar` 4.2 ·
`actors/nav` 4.1 · `ui/Hud` 3.9 · `ui/Moments` 3.9 · `data/sf/residents` 3.7 · … (146 sources).

## Part a · W6-P1 the play layer out of GameRoot

### What was built

- `src/opus-bay/ui/playParts.tsx` (new, a chunk): re-exports the DOM parts the Overlay renders once play has begun —
  `Dialogue`, `EventCard`, `CoachMark`, `TapHint`, `Hud`, `RideBanner`, `FishGame`, `GoalsCard`, `PhotoMode`,
  `PostcardReward`, `Recap`, `PoiCard`, `TouchControls`, and `ui/Floating.tsx`'s `SpeechBubble`, `Waypoint`,
  `CinematicLayer`, `TimeOffer`, `LeadChip`, `Toasts`, `LiveRegion`, `DebugOverlay`. No file moved or renamed.
- `src/opus-bay/ui/playLayer.tsx` (new, main graph, ≈ 0.4 KB): `loadPlayParts()` (one shared fetch, retryable),
  `usePlayParts()` (the module or null), `lazyPart(key)` — a stand-in component with the part's own props that renders
  nothing until the chunk is in and then the part itself as a plain child (no `Suspense`, so a part that mounts later never
  flashes a fallback or hides its siblings).
- `src/opus-bay/ui/Overlay.tsx` (lane K2's; only its import block): the static imports of those parts became
  `const Hud = lazyPart('Hud')` … — **the JSX is byte for byte as before** (the guide-city test that reads it is green).
- `src/opus-bay/game/GameRoot.tsx`: starts `loadPlayParts()` as soon as its chunk runs (both world modes, in parallel with
  the city chunk and the renderer setup), and passes the page's Start to the Overlay only when the world has drawn **and**
  the parts are in (`startRequested && drawn && partsIn`); a failed fetch is retried every 2 s.
- `tests/opus-bay-sf-budget.test.ts` "W6-P1": the nine modules are out of GameRoot's static graph (the P7 walk), every
  `lazyPart('…')` of the Overlay is a component `playParts.tsx` exports, GameRoot's early fetch and the Start gate.

### Evidence

| chunk (gzip, as vite reports) | before `294746bc` | after W6-P1 |
|---|---|---|
| **GameRoot** | **300.40 KB** | **285.35 KB** (−15.05) |
| playParts (new) | — | 15.20 KB |
| cityMode / cityDataChunk / landmarks | 47.60 / 4.33 / 16.67 | unchanged |

- Production build served by `vite preview` (5604), headless Chrome: district desktop — `GameRoot` 2364–2424 ms,
  `playParts` 2536–2563 ms (fetched 110 ms after GameRoot arrived, 30 ms on the wire); city phone 390 × 844 dpr 3 —
  `GameRoot` 912–967, `cityDataChunk` 1065–1076, `playParts` 1098–1337, `cityMode` 1102–1564: the parts land before the
  city chunk the world waits for, so Start is never held by them in practice.
- Played: district desktop (welcome choices, 我是新来的 → Bay 101 1/7 with BAYBAY leading, the HUD, the night-view offer,
  toasts / live regions in the DOM) — `docs/opus-bay/qa/w6/P/p1-district-tour-desktop-prod.jpg`; city phone (Start →
  the goals step with the pelican goal and the 10 goals, HUD, Take the ferry chip, touch stick present) —
  `docs/opus-bay/qa/w6/P/p1-city-goals-phone-prod.jpg`. No console error (one THREE.Clock deprecation warning as before).
- Checks: `tsc` 0 · `eslint .` 0 errors (43 old warnings) · suite **1382 / 1382**.

### Decisions

1. **Gate the Start, not each part.** The parts arrive ≈ 0.1–0.4 s after GameRoot, long before the world's first frame;
   holding the Start until they are in makes "exactly as before" a guarantee instead of a race (a slow network holds the
   Start as long as those bytes held GameRoot before). `?start=` / `?solo=` deep links (QA) skip the title: their parts
   appear when the chunk lands.
2. **Floating's title-time parts go too** (toasts, the screen reader's live regions, ?debug's readout): under the page's
   title they render nothing visible, and they read their stores, so nothing raised meanwhile is lost.
3. **One chunk, not one per part**: one request, one retry, one gate.

### Known gaps

- `?start=` / `?solo=` deep links show the HUD a moment after the first frame if the chunk is slower than the world (QA only).
