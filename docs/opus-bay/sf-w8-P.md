# Wave 8 · lane P · first load & lazy chunks

Worktree `C:/Users/willy/wt/w8-p` (branch `w8-p`), port 5803, scratch `C:/Users/willy/opus-qa/w8/p/`. Brief: `sf-w8-lead.md`
§3 row P (GameRoot 261.96 → ≤ 255 KB gzip with the city-only parts of `world/fx.ts`, `materials.ts`, `environment.ts`,
`actors/models.ts` behind the city chunk; `importRetry` on the other lazy imports where a retry is safe; a resume after a
lost discovery chunk; a lost shared chunk dependency; wave 8's new chunks outside GameRoot; district unchanged).

## 给主人的摘要

1. 游戏首屏主包（GameRoot，压缩后）从 **262.00 KB 降到 255.87 KB**（中途其他线又往里加了约 0.9 KB，按同一棵树算一共挪走约 7 KB）。挪走的都是“只有城市才用得到”或“按开始以后才用得到”的东西：城市专用的着色器（天空云朵、唐人街外墙、夜间街灯光带）、24 张地标卡片的表格、缆车线路的搭建代码、8 张街区明信片的文字。
2. 行为不变：城市和街区都实际玩过——地标卡片、缆车站名、明信片标题都和以前一样；城市画面的着色器逐字节不变，街区本来就用不到被挪走的部分。
3. （进行中）下一步：所有按需下载的小包都加上“丢了自动重试”，并且真丢了会弹出“重新载入”小卡片；“继续旅程”不再因为丢包干等 12 秒。

## Measuring

`npx vite build --config vite.opus.config.ts --outDir C:/Users/willy/opus-qa/w8/p/<dir> --sourcemap` (no PERF-LOCK at any
build; `public/*.json` unchanged after every build: `git status` clean), gzip as vite reports it. Per-module parts:
`C:/Users/willy/opus-qa/w8/p/modsize.cjs` (the W7-P sourcemap walk), the static graph: `graph.cjs` (the P7 walk).

## Part a · W8-P1 the city-only GLSL behind the city data chunk

Resumed at 19:25 PDT from the first lane-P agent's uncommitted work (19:00–19:20, stopped only for the Ultra relaunch).
Kept all of it: it was complete and correct (checked below); nothing discarded.

### What was built

- `data/sf/cityShaders.ts` (new, in the city data chunk: `data/sf/cityDataChunk.ts` re-exports `CITY_SHADERS`): five GLSL
  blocks moved verbatim (by line range, scratch `shader/move.cjs`) out of GameRoot's modules — `groundTown` (GROUND
  pattern 9, the satellite boards' far town), `groundStreetGlow` (the city main streets' night glow, aInfo.w > 1.05),
  `toyFacades` (TOY window styles 9 / 10: the pre-war downtown and Chinatown façades, W7-X), `skyPuffs` (the city day
  sky's cloud puffs, W7-X) and `skyCityDay` (the city day-sky blend, `uCityDay`). No imports.
- `world/cityShaderSlot.ts` (new, main graph, 0.1 KB): `CITY_SHADERS = CITY_DATA?.CITY_SHADERS ?? NONE` (every block
  empty). `data/sf/cityData.ts` awaits the data chunk at its top level in city mode (and always in node), so the slot —
  and `world/materials.ts` / `world/environment.ts`, which import it — evaluate after it: the shader strings built at
  module load splice the blocks back where they were. District mode never fetches the chunk: the blocks are empty there.
- `world/materials.ts`, `world/environment.ts`: one import line each, `${CITY_SHADERS.<block>}` where each block was.

### Evidence

- **The city's programs are byte for byte the same**: the patched TOY / TOY_INST / TOY_DYN / GROUND / hero / sky shader
  texts dumped before the move (scratch `shader/before/`, origin `889cc614`) and on the pushed tree (`shader/after2/`):
  all 11 files identical (`cmp`).
- **The district never takes the moved branches**: `tests/opus-bay-w8-p.test.ts` builds the district world in node and
  walks every TOY / GROUND vertex (> 100 k / > 50 k): no window style 9 / 10, no ground pattern 9, no street glow level
  (aInfo.w > 1.05); `uCityDay` is 0 outside city mode (`environment.ts` sets `cityDayTarget` from the mode). So the
  district's programs without the blocks draw the same pixels. The same test checks each block is spliced in exactly
  once at its old place and that the district's program (all blocks empty) keeps balanced braces.
- In the production chunk the data chunk's top-level `await` (offset 8.7 k) precedes every shader string (≥ 22 k).
- `tests/opus-bay-sf-budget.test.ts` "W8-P1": `data/sf/cityShaders.ts` outside GameRoot's static graph, the slot inside,
  the re-export, the two import lines, and no main-graph module carrying the moved GLSL again (marker strings).
- GameRoot gzip: **262.00 → 259.10 KB** on `889cc614` (the first agent's builds `dist-before` / `dist-a1`); **259.51 KB**
  on origin `9f024954` (lane K's two commits added ≈ 0.4 KB) + this move.

### Decisions

1. **Strings, not a second program.** The blocks are spliced into the same template strings, so the city keeps one
   program per material exactly as before (no new program, no warm-up change); only the district's text shrinks.
2. **The look stays its owners'**: lane X (the sky puffs' AA line is on X's list) and the materials' owners now edit
   these five blocks in `data/sf/cityShaders.ts`; the file's header says so.

## Part a (cont.) · W8-P2 – P4 three more moves out of GameRoot

Started 19:40 PDT. Request 1's four files hold less city-only code than the brief assumed: after P1 the rest of
`world/materials.ts` / `environment.ts` runs in both modes; `actors/models.ts`'s wave-7 growth is the felt (both modes)
and its shadow proxies are built in both modes (only cast in the city); `world/fx.ts`'s new presets fire in both modes
(only the Golden Gate wisps are city-only, ≈ 0.4 KB). So the other bytes came from three places that are read only in
the city or only once play has begun:

### What was built

- **W8-P2 · the landmark cards' tables with the city data chunk.** `data/sf/cityPoisData.ts` (new; `cityDataChunk.ts`
  re-exports it as `CITY_POI_TABLES`): the 24 landmark PoiDefs, the zh glossaries (`ZH_GLOSSARY`, `ZH_TEXT_NAMES`,
  `glossZh`, `glossZhText`), zones, official sites, extra sources, photo pages, subject facts, `PLACE_KIND_NAMES` and
  `placeCardName`, moved verbatim (scratch `est/mkpois.cjs`). `data/sf/cityPois.ts` keeps **every export name** and
  hands out the chunk's own objects (`CITY_DATA` is awaited before it evaluates); in district mode — which never read
  them (`data/pois.ts` `byMode`; place cards are city places; before the move the district's copies were already empty
  tables, since `SF_LANDMARK_INFO` is empty there) — empty tables and identity glossaries. The four helpers both sides
  need (`cityPoiId`, the prefix, `SF_GUIDE_SLUG`, `isMonthTagged`) are copies in the data module (the data chunk may not
  import GameRoot's graph: the W5-V3 rule); a test checks they agree. Importers unchanged.
- **W8-P3 · the cable-car network builder is a lazy chunk.** `data/transitBuild.ts` (new): `buildTransit` and its
  geometry helpers (`pointsOf`, `stubPoints`, `cumulative`, `TURNTABLE_NAMES`) moved verbatim out of `data/transit.ts`.
  It ran once per page in city mode after `loadTransit()` fetched transit.json, yet sat in GameRoot for every player.
  `loadTransit` now fetches the chunk (through `importRetry`) in parallel with the JSON; `data/transit.ts` keeps the
  `buildTransit(file)` export (bound once the chunk is in; node binds it at the module's top level, so the 21 tests and
  the QA scripts that call it are unchanged). The builder takes `data/transit.ts`'s own helpers as an argument and
  imports types only — a runtime import back would make the node-side `await` wait on itself (the W5 deadlock).
- **W8-P4 · the district postcards' words with the play layer.** `data/postcardTexts.ts` (new): the 8 cards' title /
  fact / hint, verbatim. `data/postcards.ts` builds each card with empty words; `fillPostcardTexts` fills them **in
  place** (the same objects: an interactable built before Start keeps the card's title object as its name), called by
  `data/scriptLoad.ts` — lane P's W7 module the play layer (`ui/playParts.tsx`) already imports, so GameRoot's existing
  Start gate guarantees the words are in before anything can read them (the E prompt, the collected line, the journal,
  the album, the map); node fills them when `data/postcards.ts` loads. Sources stay in `data/postcards.ts`.

### Evidence

| chunk (gzip, vite) | day 0 `889cc614` | P1 | P1 on `9f024954` | + P2 (`64cdf803`) | + P3 | **+ P4** |
|---|---|---|---|---|---|---|
| **GameRoot** | **262.00** | 259.10 | 259.51 | 258.50 | 257.05 | **255.87** |
| cityDataChunk (city only) | 4.54 | 8.28 | 8.28 | 10.36 | 10.36 | 10.36 |
| transitBuild (new, city, with transit.json) | — | — | — | — | 2.11 | 2.11 |
| postcardTexts (new, with the play layer) | — | — | — | — | — | 2.02 |
| playParts · script | 17.28 · 13.64 | = | = | = | = | 17.35 · 13.64 |
| cityMode | 63.37 | = | = | = | = | 63.37 |

(Each column is a production build of the lane tree at that point; origin moved under it: lane K's and Q's commits added
≈ 0.9 KB to GameRoot between the first and the last column. Per module, P2 = −1.46, P3 = −1.45, P4 = −1.65 KB of
"gzip of parts", ≈ 0.93 × that in the chunk.)

- Played on the dev server (5803), new player (`save=off`): **city** desktop — play began, the postcards' words filled
  (`清晨的渡轮大厦 / Ferry Building at Dawn`), 24 landmark cards, the Golden Gate card's eyebrow glossed through the
  moved glossary (`金门海峡 · 要塞公园` / "The Golden Gate · Presidio"), and the cable cars built through the lazy builder:
  3 lines, 56 stations (`鲍威尔街 · 市场街`), the three turntables' zh names; the Golden Gate card renders whole (photo,
  credit, summary, hours, cost: `qa/w8/P/a5-city-card.jpg`). **District** desktop — play began, the 8 postcards' titles in
  English, the Coit Tower card whole (`qa/w8/P/a5-district-card.jpg`). Console: the old THREE.Clock warning only.
- Tests: `tests/opus-bay-sf-budget.test.ts` "W8-P2" (the tables out of the graph, every old export name still exported,
  the slot's values are the chunk's own objects, the glossaries agree, the copied helpers agree), "W8-P3" (the builder
  out of the graph, type imports only, the export bound in node and equal to a direct build), "W8-P4" (the words out of
  the graph, the play layer fills them, in place, once); the existing cityPois / transit / postcard suites unchanged.
