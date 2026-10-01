# Wave 8 · lane P · first load & lazy chunks

Worktree `C:/Users/willy/wt/w8-p` (branch `w8-p`), port 5803, scratch `C:/Users/willy/opus-qa/w8/p/`. Brief: `sf-w8-lead.md`
§3 row P (GameRoot 261.96 → ≤ 255 KB gzip with the city-only parts of `world/fx.ts`, `materials.ts`, `environment.ts`,
`actors/models.ts` behind the city chunk; `importRetry` on the other lazy imports where a retry is safe; a resume after a
lost discovery chunk; a lost shared chunk dependency; wave 8's new chunks outside GameRoot; district unchanged).

## 给主人的摘要

1. 游戏首屏主包（GameRoot，压缩后）：我这条线挪走了约 7.5 KB——城市专用的着色器、24 张地标卡片的表格、缆车线路的搭建代码、8 张街区明信片的文字、街区景点的“城市叫法”。在当时的树上从 **262.00 降到 255.87 KB**；但今晚其他线新加的内容（渡轮、电车、特效等约 1.9 KB）和我加的“重新载入”小卡片（0.9 KB）之后，最终树上是 **257.79 KB，没有达到 255 的目标**。已加一个自动检查：以后谁让主包超过 258.5 KB 测试就会报错；下一步还能挪的东西列在报告里。
2. 行为不变：城市和街区都实际玩过——地标卡片、缆车站名、明信片标题都和以前一样；城市画面的着色器逐字节不变，街区本来就用不到被挪走的部分。
3. 今晚新加的功能（恶魔岛渡轮、三个小游戏、舰队周、唐人街节庆、西边海浪和湖、新街角、新配音）全部是按需下载，不在首屏主包里（有测试点名）。
4. 手机信号一抖不再让某个功能整局失效：所有按需下载的小包（约 180 处：面板、小游戏、城市分块、万圣节、彩蛋……）都会自动重试；同一个包丢了只重下一次、不会出现两份。真的下不来时（断网、刚好在更新网站），会弹出“有一部分没加载好 · 重新载入 / 先继续玩”的小卡片（进度先存好）。已在 Chrome 里实测：断掉一个小游戏包会弹卡片；短暂断网 1.7 秒后自动恢复。
5. “继续旅程”不再因为丢包在到达画面干等最多 12 秒：最多等 0.6 秒就开始玩。

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

## Part b · W8-P5 – P6 every lazy chunk through importRetry, the chunk-lost card, the resume

Started 21:40 PDT (`date`), on origin `7d416d42`.

### What was built

- **W8-P5 · `game/importRetry.ts`: one instance per lost chunk, and a visible state.** Every caller that meets the same
  lost URL now shares one retry (in flight) and, once it landed, its module (a per-page table keyed by the URL the
  browser names): the Overlay's boot and a resume both load `game/discovery`; before, each ran its own `?retry=n` chain
  and two that landed on different `n` were two instances of one module (two states). A chunk still lost after every
  retry — the network down, a deploy that replaced the files, or a lost *shared dependency* (Chrome names the importing
  chunk and `?retry=n` of it imports the same failed dependency URL again: only a reload brings it back, W7-P review) —
  now tells `onChunkLost` listeners once per chunk; `quiet: true` (a prefetch nobody waits for) tells nobody, and a quiet
  prefetch and a press of the same chunk: the press wins. The helper still imports nothing.
- **`game/chunkLost.ts` (new, in GameRoot's chunk on purpose — a card in a chunk of its own could be lost too):** the
  card 有一部分没加载好 / Part of the game didn't load / 有一部分沒載入好 · "the connection dropped … your progress is
  saved — a reload brings it back" · 重新载入 (writes the save first, then reloads) · 先继续玩 (closes it). Once per page, in
  the reader's language, in the GL-lost card's style (`.ob-gl-lost*` of opus-bay.css, always loaded; no CSS change; 44 px
  buttons). `game/GameRoot.tsx` registers it on mount.
- **The ≈ 180 other lazy imports** (scratch codemod `est/codemod.cjs`, mechanical: `import('./x')` →
  `importRetry(() => import('./x'))` + one import line; type positions, comments, DEV-only `__opusBay` hooks and the
  node-only loads skipped) — 180 sites in 67 files: panels and cards (`ui/Overlay.tsx` map / journal / week / settings /
  ride layer, `PoiCard`, `PlaceCard`, `EventCard*`, `Floating`, `CoachMark`, `Moments`, `GuideLayer`, `Footprints`,
  `CityMap`, `MapPanel`, `Settings`, `mapEvents`), the page's own `GameRoot` chunk (`OpusBayPage.tsx` — the largest chunk
  on the first-load path had no retry and no fallback), GameRoot's audio / GL-health / solo view, the city chunks
  (`world/sf/{stream,sites,lights,cityWorld}.ts`, `world/{life,streetcar}.ts`, `data/sf/{places,placeCardTypes}.ts`,
  `actors/{Actors,moveSystem,nav,npcs,system}.tsx?`, `actors/vehicles/driveRoute.ts`, `audio/{audio,ambience}.ts`),
  the play chunks (`play/{index,zones,zones3,sfgames,sfgames8,kit,kiteEntry,kiteZone,firstFlight,hideSeekEntry,GripPad}`),
  Halloween (`halloween/{play,playPostcardRun,treatRun}.ts`), the eggs (`eggs/index.ts`), the economy
  (`economy/{index,coins,Shop}`), realsf (`realsf/{index,openingSigns}.ts`) and the game's own (`game/{album,cityContent,
  cityMoments,discovery,flow,goalsStep,guideCity,lineRides,pelicanFirst,photo,residentTasks,Systems,transit,tripRun}`).
  Import lines and the wrapped calls only; every file is named here (lanes K, Q, M, H, S, A, W1, W2, X own most of them).
  Not wrapped, on purpose: `game/w5Features.ts` (frozen — Requests), `game/goTo.ts` (the "tiny hook" contract of
  W5-N1: type imports only), the helper itself.
- **W8-P6 · the resume (`game/resume.ts`).** `resumeAt` no longer awaits the discovery chunk: `quietDiscoveryOrGo` makes
  the first finds quiet before play when discovery is in (as always in practice), else begins play after at most
  `DISCOVERY_GRACE_MS` (600 ms) and makes them quiet the moment the chunk lands (the Overlay's `initG1` and this run in
  the same turn, before discovery's first tick). Before, a lost discovery chunk held 继续旅程 on the arrival screen for
  the whole 1 + 3 + 8 s of retries with nothing to show; lost for good, play now goes on and the card says a reload
  brings it back (discovery also keeps the save's last safe spot).

### Evidence

- **In Chrome (dev server 5803, city, a playing new player; CDP `Network.setBlockedURLs`, scratch `est/p-shot.mjs`):**
  `play/claw.ts` blocked for good → `claw.ts?retry=1 … ?retry=3` all refused, the load rejects after ≈ 12 s, `chunksLost()`
  = 1 and the card shows over the game (desktop `qa/w8/P/b-lost-card-en.jpg`; 390 × 844 dpr 3
  `qa/w8/P/b-lost-card-phone.jpg`: the card centred, the HUD under the scrim). `play/crab.ts` blocked for 0.4 s then
  let through → loaded after 1 747 ms (the first retry), no card; a second `importRetry` of it → the same module at once
  (0 ms).
- Tests (red first on the old helper and resume: 4 / 4 failed, then green): `tests/opus-bay-w8-p-retry.test.ts` — two
  callers share one retry and one instance, a later caller takes the recovered module without a wait; lost for good →
  one listener call per chunk, none for quiet, loud wins, none for a module's own error, Safari's message too; the card
  (once, the locale's words, 重新载入 then reload, 先继续玩 closes, no Han in English); the resume (play after the
  grace while the chunk is pending, quiet once it lands, no throw when lost; the bare await gone); **a scan: every
  relative dynamic `import()` in `src/opus-bay` goes through importRetry** (except the three above) — a new bare one
  fails with the fix in the message.
- Tests adjusted for the wrappers (surgical, named): `tests/opus-bay-w7-p-retry.test.ts` (its "lost for good" case runs
  on a fresh page table), `tests/opus-bay-sf-hud.test.ts` (two source regexes accept the wrapper), and
  `tests/opus-bay-w5-play-acts.test.ts` — the play core budget 6 → 6.5 KB and zones3's 5 → 5.5 KB: with the wrappers the
  core is 6 193 B (≤ 6 144 B on origin) and zones3 5 153 B (lane M adds wave 8's games to both).

### Decisions

1. **Retry everywhere, quietly by default.** A retry only ever repeats a load whose module never ran, so it is safe at
   every site; the cost is a later fallback (up to 12 s) where a site had one, which the card now explains. Only a site
   that must not wait (the resume) was changed in behaviour.
2. **The card once per page, in every phase.** A second lost chunk does not show it again (the player chose); at the
   title the play layer's own one reload still applies.

## Part c · W8-P7 – P9 one more move, wave 8's chunks named, a size guard

Started 23:02 PDT (`date`), on origin `8ba22115` (every lane's wave-8 code in).

### What was built

- **W8-P7 · the district POIs in the city's words with the city data chunk.** `CITY_DISTRICT_POI_NAMES`,
  `CITY_DISTRICT_TEXT_NAMES`, `cityDistrictZh`, `cityDistrictPoi` moved verbatim from `data/sf/cityPois.ts` into
  `data/sf/cityPoisData.ts`; the slot keeps the names. `data/pois.ts` builds `CITY_DISTRICT_POIS` with `cityDistrictPoi`
  in both modes but only the city reads it; in district mode the copy is the POI as written with its own `realInfo`
  object (`fillPoiTexts` writes into it), `cityDistrictZh` the identity.
- **W8-P8 · wave 8's new features are lazy.** Every module the lanes added tonight is outside GameRoot's static graph:
  the Alcatraz ferry and island (`world/sf/alcatraz{Ferry,FerrySystem,Lines,Walk}.ts`), the three games
  (`play/{grip,GripPanel,GripPad,busk,BuskPanel,buskSounds,sfgames8,sfgames8Lines,sfgames8Sounds}`; the foghorn's own
  files load through `sfgames8.ts`), Fleet Week (`world/sf/fleetWeek{,Day}.ts`), the Chinatown festival
  (`halloween/worldFestival.ts`), the west (`world/sf/west{Sea,SeaPose,Toy,Lines,Lake,LakePose,Boathouse}.ts`), the
  corners (`world/sf/corners{Chinatown,Sights}.ts`) and BAYBAY's wave-8 voice (`data/sf/voiceW8.ts`): a test names them.
  Into GameRoot this wave went only `game/baybayHold.ts`, `game/fixedLines.ts` (lane K: BAYBAY's hold and her fixed
  lines, read every frame), `game/chunkLost.ts` (the card, on purpose) and `world/cityShaderSlot.ts` (0.1 KB) — plus the
  lanes' growth inside existing modules (below).
- **W8-P9 · a size guard.** `tests/opus-bay-sf-budget.test.ts` estimates GameRoot's chunk statically (esbuild-minified
  modules only GameRoot's walk reaches, gzip, one calibration on the production build: 257.79 / 277.909) — about 40 s in
  the suite. It fails when GameRoot would pass **258.5 KB**, with the fix in the message; the **255 KB** target is a
  `todo` test (reported, not failing) because the final tree is over it.

### Evidence

| GameRoot (gzip, vite) | KB |
|---|---|
| day 0 `889cc614` | 262.00 |
| part a on `64cdf803` (P1 – P4) | **255.87** |
| the lanes' wave-8 growth since, in GameRoot's own modules (gzip of parts): `data/ferry.ts` +0.45 (A), `world/streetcar.ts` +0.38, `game/transit.ts` +0.30, `game/cityContent.ts` +0.26, `world/fx.ts` +0.21 (X), `game/fixedLines.ts` +0.11 (K) … | ≈ +1.9 |
| part b: the reload card `game/chunkLost.ts` +0.88; `importRetry` left GameRoot for the page's chunk −0.68 (OpusBayPage imports it now) | ≈ +0.2 |
| **final tree `8ba22115` + W8-P7** (production build, own outDir, `public/` unchanged) | **257.79** |

Chunks on that build: cityDataChunk 11.63 (city only) · playParts 17.52 · transitBuild 2.11 · postcardTexts 2.02.

### Known gaps

- **GameRoot is 257.79 KB, not ≤ 255**, on the final wave-8 tree: part a reached 255.87 on its tree, the lanes' own
  wave-8 growth (+1.9) and the reload card (+0.9) came after. The guard stops further growth at 258.5; the 255 test is
  a `todo`.
- The budget estimate is approximate (tree-shaking differs from rollup's): W8-Z's production build is the number of
  record.
- Firefox / Safari not run (no such browsers here); their failure messages are unit-tested from their formats (W7).
- The card's 简体 / 繁體 words were checked in the test (not on a screenshot: headless Chrome here ran in English).

## Not done

- GameRoot ≤ 255 on the final tree (above). Candidates for the next wave, measured: the Golden Gate fog wisps in
  `world/fx.ts` (city only, ≈ 0.4 KB), the city gull / open-deck ferry in `world/life.ts` (≈ 0.4), the POI link tables
  in `data/pois.ts` (read only by the card body, ≈ 0.8), the district subject facts (≈ 0.4), `data/ferry.ts`'s line
  builder (only `world/ferry.ts` uses it, ≈ 0.6), `game/transit.ts`'s ride-UI helpers used only by lazy chunks.
- `game/w5Features.ts`'s five feature imports (economy, play, eggs, realsf, halloween) still load without a retry: the
  file is frozen (Requests 1).

## Requests

1. **Lead (frozen `game/w5Features.ts`):** wrap its five `import('../<feature>/index')` loaders as
   `importRetry(() => import('../<feature>/index'))` with `import { importRetry } from './importRetry';` — a lost feature
   chunk then retries and shows the reload card instead of the feature missing for the visit.
2. **Lead / W8-Z:** read GameRoot on the final build (257.79 KB here on `8ba22115` + W8-P7); decide whether 255 stays the
   target for wave 9 (the Not done list is the way there) or the guard's 258.5 becomes the line.
3. **Every lane (wave 9):** a new lazy import is `importRetry(() => import('./x'))` (the W8-P5 scan test says so); city-only
   or play-only code goes behind the city chunk / a lazy import — the W8-P9 guard fails above 258.5 KB.

## Rebase notes

- W8-P5's rebase onto `d3114585` conflicted in lane M's `play/sfgames8.ts` (M's busker lines beside the wrapped grip
  lines): resolved by taking origin's file and re-running the codemod on it (and on lane W1's new
  `world/sf/cornersSights.ts`); W8-P5b wrapped M's four foghorn imports that landed after.

## Commits

| commit on origin | what |
|---|---|
| `79326be9` W8-P1 | the city-only GLSL of the materials and the sky into the city data chunk |
| `ed358242` W8-P2 | the landmark cards' tables into the city data chunk |
| `88d43d02` W8-P3 | the cable-car network builder a lazy chunk |
| `2713ebf0` W8-P4 | the district postcards' words with the play layer; report part a |
| `313d6674` W8-P5 | every lazy import through importRetry (one instance per lost chunk), the reload card |
| `fd53f664` W8-P6 | the resume no longer waits on a lost discovery chunk; report part b |
| `5125566b` W8-P5b | lane M's four foghorn imports through importRetry |
| `b5b7f019` W8-P7 | the district POIs in the city's words into the city data chunk |
| `2979636f` W8-P8 | wave 8's new chunks named outside GameRoot; the size guard (258.5) and the 255 todo; report part c |

## Final checks

On the lane tree (origin `8ba22115` + W8-P7 / P8): `tsc` 0 · `eslint .` 0 errors (50 old warnings) · opus-bay suite
**1804 / 1804** (+ 1 todo: the 255 KB target), 23:27 PDT. Production builds to `C:/Users/willy/opus-qa/w8/p/dist-*`
(no PERF-LOCK seen at any build; `public/*.json` unchanged every time). Dev server on 5803 stopped at the end; one
headless Chrome at a time; no Higgsfield spend.

## Where a reviewer should look first

1. `src/opus-bay/game/importRetry.ts` (the shared per-URL table, the listeners) and `game/chunkLost.ts` + its call in
   `game/GameRoot.tsx`; the 180 wrapped sites are mechanical (the scan test lists any bare one).
2. `src/opus-bay/OpusBayPage.tsx` line 14: the page's `GameRoot` chunk now loads through importRetry (it had no retry).
3. The in-place fills: `data/postcards.ts` `fillPostcardTexts` via `data/scriptLoad.ts`; the slots `data/sf/cityPois.ts`
   and `world/cityShaderSlot.ts` (their district fallbacks).
4. `data/transit.ts`'s node-only top-level `await` (bindBuilder) and `data/transitBuild.ts`'s type-only imports.
5. Play: a city resume (继续旅程) with the discovery chunk blocked (it no longer waits); a blocked panel chunk on a phone
   (the card); the district's first minute (unchanged).
