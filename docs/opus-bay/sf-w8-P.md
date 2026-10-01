# Wave 8 · lane P · first load & lazy chunks

Worktree `C:/Users/willy/wt/w8-p` (branch `w8-p`), port 5803, scratch `C:/Users/willy/opus-qa/w8/p/`. Brief: `sf-w8-lead.md`
§3 row P (GameRoot 261.96 → ≤ 255 KB gzip with the city-only parts of `world/fx.ts`, `materials.ts`, `environment.ts`,
`actors/models.ts` behind the city chunk; `importRetry` on the other lazy imports where a retry is safe; a resume after a
lost discovery chunk; a lost shared chunk dependency; wave 8's new chunks outside GameRoot; district unchanged).

## 给主人的摘要

1. （进行中）第一步已推送：城市专用的着色器代码（天空云朵、唐人街/老市中心外墙、远处小镇地面、夜间街灯光带）挪出了首屏主包，跟着城市数据包一起下载。城市画面逐字节不变，街区的画面也不变（被挪走的分支街区本来就用不到）。

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
