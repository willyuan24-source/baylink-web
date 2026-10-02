# Wave 9 · lane P · cold start, budgets, WebGL

Worktree `C:/Users/willy/wt/w9-p` (branch `w9-p`), port 5909, scratch `C:/Users/willy/opus-qa/w9/p/`. Brief:
`sf-w9-lead.md` §3 row P (R§5 #4 the cold start: every program before the first frame, a warm-up that yields, Start 准备中…
until ready, `scripts/opus-sf/qa/perf/cold-start.mjs`; no WebGL / software GL; GameRoot's guard and its 255 target; w8 NEXT
#11). The review: `docs/opus-bay/review-2026-10-01-first-use.md` §5 #4 and the §6 tech rows; its evidence
`C:/Users/willy/opus-qa/review-1001/gapfill/cold/`, `tech/trace1/`, `verify-tech/`.

## 给主人的摘要

1. **一看到标题就点"开始"不会再冻屏了。** 以前画面第一次出来时要当场编译几十个着色器，主线程卡住 8–14 秒（就是评测里"以为卡死了"）。现在先在后台分批把着色器全部编好；按钮显示「准备中…」，好了才变成「开始」。正式版实测（电脑）：按下开始后冻住的时间从最多 19 秒降到 0，从被接受的那一下「开始」到出现四选一 = 6.5 秒（就是开场动画本身）；手机（4 倍降速模拟）按下后的卡顿从最长 14 秒降到 0.8 秒。**（评审更正，见文末 Review：标题页上「搭建城市」那一下仍会卡住约 1 秒（电脑）/ 约 7 秒（慢手机），这期间语言和"直接看攻略"点不动；准备中时按的那一下原来会被丢掉，评审已改成记住、好了自动开始；手机按下后虽然最长只卡 0.8 秒，但开场里超过 0.25 秒的停顿加起来仍有约 4 秒。）**
2. **打不开 3D 的电脑/浏览器不再看到网站的错误页**：标题页直接说"这台设备打不开 3D 画面"，并给出"这个月湾区有什么"、"活动日历"和"直接看攻略"三个入口。只能用软件模式显示 3D 的电脑会自动用「省电」画质，并有一行说明。
3. 画面丢失（图形内存被收回）的提示卡，电脑上不再说"手机把……"，改成"浏览器暂停了游戏的 3D 画面"。
4. 游戏主包（GameRoot）没有变大：先把渡轮露天甲板和城市海鸥、再把渡轮航线的计算代码挪进分包（共腾出约 1.1 KB），装下冷启动改动后还比今晚最高时小 0.7 KB；并加了检查——这一波任何一条线把新代码放进主包，测试都会报出来（到现在没有）。
5. 地图、旅行本等面板如果网络断了加载失败：屏幕上方会显示「还在加载，稍等一下…」，实在加载不了就弹出"重新载入"卡片，空面板会自己关掉。还没做完的：标题页上"搭建城市"那一下（电脑约 1 秒、慢手机约 7 秒）还是一次性完成，下一步要拆开。

## Part a · W9-P0 / W9-P1 — the cold start, the warm-ready contract, the WebGL probe

Started 21:35 PDT (`date`), on origin `f1460b0c`; pushed 23:44 PDT (`84de70a4`, `ff101291`), before the 23:45 contract
deadline.

### What was built

- **Cause (re-read from the review's traces before changing anything):** every slow call in `verify-tech/stack-prod`
  is three's `getProgramInfoLog` on a program's *first draw* (`onFirstUse ← getUniforms ← setProgram ← renderBufferDirect
  ← post.render`): 46 programs, 8.5 s of main-thread waits, in two back-to-back rAF callbacks of 4.1 s and 4.2 s (the
  second is the warm-up's own links queuing ahead of the second frame's new programs — "time-locked ≈ 4 s after the first
  frame" in the review). `warmPrograms` ran 250 ms *after* the first frame, so it never protected that frame.
- **`world/warmup.ts` `prewarmPrograms`** (W9-P1): before the world's first frame — the shadow pass's depth set, the city-kind
  dummies + every registered set, one object per material of the *visible* scene — `PRE_BATCH` (6) objects per batch,
  each batch's links awaited with the non-blocking `KHR_parallel_shader_compile` poll, 4 ms between batches; then every
  program is first-used (`getUniforms`, cheap once linked) 8 per task, 1 per task without the extension (where each such
  call waits for its own link — spread out instead of one long freeze). The live-scene and next-level background passes
  follow as before (`scheduleNext`, shared with `warmPrograms`). `world/post.ts` `warmPost`: the post pass's bright / blur /
  final programs compiled in their own render states (a kept `PostFX` holds them; WorldScene's own instance takes the same
  programs by key).
- **`game/GameRoot.tsx`:** city mode mounts the Canvas with R3F `frameloop="never"` and turns it on only when the pre-pass
  (+ `warmPost` at high) resolves — capped at `PRE_MAX_MS` 30 s so a link that never reports (a lost context) cannot hold the
  title. District mode renders from the mount exactly as before. **Warm-ready** = the first frame drawn + the play layer in.
- **`game/warmReady.ts`** (new, in the page's chunk; the §4 contract): `warmReady()`, `setWarmReady()`, `useWarmReady()`;
  `probeGl()` (one throwaway WebGL 2 context: `'none'`; `'software'` when only possible without
  `failIfMajorPerformanceCaveat` or the renderer is SwiftShader / WARP's Basic Render Driver / llvmpipe; `'ok'`),
  `glSupport()` / `useGlSupport()`.
- **`ui/TitleScreen.tsx`** (lane F's file, surgical, named in the commit): in city mode Start / 继续旅程 / 从头开始 read
  **准备中… / Getting ready…** with `aria-busy` + `aria-disabled` (kept focusable: the initial focus still lands on Start)
  and do nothing until warm-ready, Enter / Space too; the language pills and 直接看攻略 are plain DOM and never wait. No
  WebGL: no Start, `ui/TitleGl.tsx`'s note; software GL: a one-line note.
- **`OpusBayPage.tsx`** (surgical): the probe runs once, in the idle callback before GameRoot mounts (first for a `?start=`
  link); `'none'` never loads GameRoot — its Canvas used to throw into the site's generic error page — and keeps the title.
  **`world/quality.ts`**: software GL starts the visit at low (session-only; only a `?quality=` link wins).
  **`ui/glHealth.ts`**: the GL-lost card's body by device (R§6 language row): 浏览器暂停了游戏的 3D 画面（显卡忙或驱动重置了）… on
  a computer, 手机把游戏的图形内存收回了… on a touch-first device.
- **W9-P0 · GameRoot room:** the rideable ferry's open sun deck and the city gull (both city-only) moved verbatim from
  `world/life.ts` to the new `world/sf/cityFigures.ts` in the city chunk (it fills a `cityFigures` slot in life.ts at load,
  before the city world is built; an empty slot = the district's figures). GameRoot static estimate **258.32 → 257.89 KB**;
  with W9-P1 on top **258.34** (the gate costs what the move freed).
- **`scripts/opus-sf/qa/perf/cold-start.mjs`** (new, for W9-Z): the review's `gapfill/cold.mjs` method made a tool — a fresh
  profile per run; marks for title, ready (Start enabled), first frame, the effective press, the 4-way choice; title freeze
  (longest rAF gap between title and press), Start → choice, first try → choice, freeze / longest gap after the press,
  longest task, dead clicks, the presses' event timing; `--mobile --cpu 4 --net fast4g` = phone 4×; `--mode eager|wait10`;
  `--glq` counts the GL link waits; `--runs n` prints the median / P75.

### Evidence

- Tests: `tests/opus-bay-w9-p.test.ts` **13 / 13** (red on origin: the modules / exports / gate did not exist) — the flag; the
  probe (none / ok / software by name and by caveat; the context released); software → low unless `?quality=`; the
  rendered title (准备中… + aria-busy + aria-disabled before warm-ready, 开始 after, the district never waits, no WebGL = no
  Start + this month + calendar links); GameRoot's gate (source); `prewarmPrograms` with a fake renderer (depth set, dummies,
  visible objects only, every link done and every program first-used before it resolves; at most one batch linking at a
  time; the main thread free between batches; one first-use per task without KHR); `warmPost`'s three render states; the
  GL-lost words by device; the city figures' slot. `opus-bay-w5-nav` / `opus-bay-w5-lang` set warm-ready before rendering
  the city title (surgical). Full suite on the lane tree before the rebase: 1883 tests, 1880 pass, 2 fail (those two, fixed
  and re-run), 1 todo; after the rebase onto `103b917a` every incoming lane test + mine + the budget test: 180 / 179 pass,
  1 todo, 0 fail; `tsc` 0; `eslint .` 0 errors (50 old warnings).
- **Dev server (5909), desktop 1440 × 900, a fresh profile, the machine at 100 % CPU (≈ 15 agents)** —
  `C:/Users/willy/opus-qa/w9/p/cold/*/result.json`:

  | | before (origin) | after (W9-P1) |
  |---|---|---|
  | programs first linked inside a rendered frame | 35 | 0 of 49 (all linked before the first frame) |
  | main-thread GL link waits, whole run | 11 877 ms | 286 ms (272 ms on the second run) |
  | frozen after the Start press (rAF gaps > 250 ms) | 16.6 s, longest 11.2 s | **0**, longest 183 ms (166 ms) |
  | Start → 4-way choice | 43.5 s | **6.7 s** (= the scripted intro) |
  | longest task before the press | 0.2 s | 1.8–2.2 s (the city chunk + world build, JS — see Known gaps) |

  The pre-pass took 9.3–10.3 s for 49 programs under that load. Production-build numbers (idle machine where possible):
  part b.
- `docs/opus-bay/qa/w9/P/a-nogl-en.jpg` (read): Chrome with `--disable-3d-apis --disable-webgl` on the dev server — the
  title, no Start, "This device can't show the 3D world", This month in the Bay · Event calendar · Skip the game — read the
  guides; no canvas, no site error page.

### Decisions

1. **Start disabled (aria-disabled, not `disabled`)** as §3 / W9-Z's gate ask: the button stays focusable, so the title's
   initial focus and Enter still land on it; a press before ready does nothing visible beyond 准备中… (no queued start — a
   queued start could fire after the player turned to the language pills).
2. **Only city mode waits** (frames and Start): district mode is untouched ("district never changes").
3. **The pre-pass compiles the visible scene only** (plus the dummies that cover every streamed city cell); hidden objects
   (night beams, a pool's spares) keep their background live pass 4 s after the first frame, as before.
4. **No-WebGL keeps the title's own 直接看攻略** and adds this month + calendar; the game chunk is never fetched.

### Known gaps (part a)

- The title still has 1.8–2.2 s long tasks on the loaded dev server *before* the warm-up: the city chunk's evaluation and
  the world build (JS, not GL). Production numbers in part b decide whether they need splitting.
- Under heavy load 准备中… lasts long (title → ready ≈ 23 s in dev at 100 % CPU); on an idle machine the review's own
  wait-10 runs suggest ≈ 5–7 s (part b measures it).

## Part b · W9-P3 – P6 — production numbers, the guard, the retried panels, software GL, one more move

Resumed 02:14 PDT (`date`) after the first agent of this lane stopped at ≈ 00:35 (an account usage limit). Its
uncommitted work (the lazy-chunk loading state / close-on-lost / `w5Features` wrap, the module guard, a production
before / after batch run at 01:23) was **kept whole**: nothing in it was broken. It was rebased onto origin (no conflict),
checked, split into W9-P3 and W9-P4, and pushed at 02:41 (`6b108848`, `c4713be2`); W9-P5 / P4b at 03:08 (`09f21c2f`);
W9-P6 with this part.

### What was built

- **W9-P3 · the GameRoot guard for wave 9** (`tests/opus-bay-sf-budget.test.ts`): besides the 258.5 KB byte guard, a
  module-set guard — GameRoot's static-only module set (the W8-P9 walk minus what `OpusBayPage` also imports) must stay
  inside the **112 modules of day 0** (`f1460b0c`), and the §4 contract modules (`game/attention.ts`, `ui/entrySource.ts`,
  `realsf/todayLine.ts`, `realsf/prefs.ts`, `game/metrics.ts`, `game/warmReady.ts`) must sit outside GameRoot's chunk. A
  new module fails with its name and the module that reaches it. Re-run after every rebase tonight (origin `3446c7b2`,
  `02b1f6c8`, `3e65cc9f` and the last one): **no lane has added a module to GameRoot's first-load chunk** — no violator
  to flag, no import line to fix.
- **W9-P4 · a retried part, a lost panel** (w8 NEXT #11, the W8 review's P-RP-5): `game/importRetry.ts` counts the
  retry chains somebody waits for (`retryingLoud()`, `onRetrying()`; a quiet prefetch counts only once a press of the same
  chunk joins it); the new `game/chunkPending.ts` (in the page's chunk) shows a pill **还在加载，稍等一下… / 還在載入，稍等
  一下… / Still loading — one moment…** (`role=status`) while one runs; `game/lazyChunk.ts` takes `{ onLost }`;
  `ui/Overlay.tsx` (lane F's file, surgical) closes Map / Journal / Week / Settings when lost for good — only if still the
  open panel (`closeLost(kind)`); `game/w5Features.ts` (unfrozen for this only) loads the five features through
  `importRetry`, and W8-P5's scan no longer exempts it. **W9-P4b** moved the pill under the HUD's top chips (68 px).
- **W9-P5 · `cold-start.mjs --cpuprofile`**: a 2 ms CPU profile of the run and, for its three longest rAF gaps, the top
  functions by self / inclusive time (page time mapped onto the profile clock) — so W9-Z (or the next wave) can say *what*
  a freeze is, not only how long.
- **W9-P6 · GameRoot −0.7 KB** (w8 NEXT #7's measured move): the ferry line builder (`buildFerryLine`, `ferryPoint`, the
  Catmull-Rom loop) moved verbatim from `data/ferry.ts` to the new `data/ferryLine.ts`, imported only by the lazy
  `world/ferry.ts`; `data/ferry.ts` keeps the table / boat / `ferryTerminal` and re-exports the two types type-only. Four
  other lanes' tests import the builder from its new module (surgical, named in the commit). Static estimate **258.5 →
  257.8 KB** (guard 258.5). Why now: wave 9's commits had brought it to 258.5 — the next 0.1 KB in any GameRoot module
  would have failed every lane's suite (per module since day 0, minified: `world/warmup.ts` +701 B and `GameRoot.tsx`
  +504 B are this lane's gate; `interactables` +171, `Overlay` +144, `quality` +115, `lazyChunk` +90, `w5Features` +79,
  `baybayHold` +72, `brain` +66; `life.ts` −1389 (W9-P0), `camera.ts` −328).

### Evidence

**Production cold starts, paired and interleaved** (`scripts/opus-sf/qa/perf/cold-start.mjs`, a fresh Chrome profile per
run, `vite preview` on 5909; *before* = origin `103b917a` (day 0 + lanes, before W9-P1), *after* = `c4713be2` + W9-P5/P4b;
desktop 1440 × 900; phone = 390 × 844 touch, CPU 4×, fast 4G; RTX 3070 laptop, ANGLE D3D11, KHR_parallel_shader_compile
on). Batch 2, 03:04 – 03:24 PDT, the machine shared with the other lanes (busy, not saturated) —
`C:/Users/willy/opus-qa/w9/p/coldprod2/` (each run's `result.json`; phone runs with `cpu-top.json`):

| ms (per run) | desktop eager · before | desktop eager · after | phone 4× · before | phone 4× · after |
|---|---|---|---|---|
| title shows → Start enabled | 0 / 0 / 0 (always enabled) | 11 135 / 12 079 / 13 003 | 0 / 0 | 31 747 / 33 373 |
| longest freeze on the title | 316 / **8 326** / 333 | 1 049 / 999 / 999 | 300 / **10 724** | **7 494 / 7 044** |
| frozen after the press (Σ gaps > 250 ms) | **18 916** / 283 / **14 105** | **0 / 0 / 0** | **41 147 / 10 689** | 3 829 / 4 746 |
| longest gap after the press | 8 459 / 283 / 9 142 | 167 / 0 / 0 | 14 154 / 1 782 | 683 / 783 |
| the press → 4-way choice | 26 957 / 7 115 / 23 207 | **6 541 / 6 683 / 6 449** | 51 640 / 20 691 | 14 528 / 14 235 |
| first try → choice (an eager player's wait) | 26 969 / 7 412 / 23 224 | 10 632 / 18 519 / 6 467 | 51 689 / 21 253 | 47 319 / 22 904 |
| main-thread GL link waits | 15 916 / 15 082 / 10 165 | 224 / 259 / 276 | 15 624 / 16 070 | 433 / 373 |
| longest task | 8 345 / 8 170 / 9 102 | 1 046 / 977 / 989 | 10 009 / 10 044 | 7 217 / 6 801 |

(When the before build's title freeze is small, the eager press came before the first frame and the freeze landed after
the press instead: the two rows trade places run by run, the sum does not.) wait-10 s (desktop, one pair): title freeze
8 659 → 1 082, frozen after the press 350 → 0, press → choice 6 899 → 6 500, GL waits 9 165 → 277. Batch 1 (01:23, the
machine saturated, `coldprod/`) said the same on desktop (frozen after the press 16.8 / 0.3 / 0 s → 0 / 0 / 0; press →
choice 26.1 / 9.2 / 6.6 → 6.7 / 6.6 / 6.6 s) while no phone run of either side reached the choice within 200 s (before:
176 / 164 s frozen after the press; after: title freezes of 39 / 47 s — every long task ≈ 5× batch 2's under that load);
batch 2 is the one to read.

**What the remaining freezes are** (`cpu-top.json` of the phone runs; the unminified build `prof/prodnomin-phone4x-1/`
for names):
- *before*, phone: the 10.7 s and 8.6 s freezes are `getUniforms` → the WebGL query (`proto.<computed>`: the program-link
  wait) inside `renderBufferDirect` — 8.65 + 6.07 s of it; the third (6.9 s) is the World's build. This is what W9-P1
  removed (GL waits 15.6 s → 0.4 s).
- *after*, phone: the 7.0 s title freeze is **the World's synchronous build**: `halloween/index.ts` init → `pushTint` →
  `getWorld()` → `new World` (unminified: 5.2 of 5.8 s — `addChunks` / `splitGeometryCells` 1.8, `buildProps` 0.6,
  `buildGround` 0.6, `heroFarChunks` 0.5, `buildCity` 0.4); the second (2.7 s) React's first render of the actors
  (`buildRig`, the bike fleet, NPCs); the third (1.7 s) the first frame (buffer uploads; no link). On desktop the same
  build is the ≈ 1.0 s title freeze. It was there before too (6.9 s phone) — W9-P1 neither added nor removed it.
- Start → enabled (11–13 s desktop, 32–33 s phone 4× on this busy machine) is the GPU process compiling ≈ 49 programs
  (ANGLE → HLSL): the time the old build spent frozen after the press, now spent on a live title.

**W9-Z gate items on this lane's numbers:** Start disabled (准备中… + `aria-busy` + `aria-disabled`) until ready ✔ (every
after run: 0–1 dead clicks before ready, then the press works); no freeze > 1 s after Start ✔ desktop (max 167 ms) and
phone 4× (max 783 ms).

**The retried panel, in a real run** (`C:/Users/willy/opus-qa/w9/p/p4.mjs`, the production build, 1440 × 900, the
MapPanel chunk blocked with CDP `Network.setBlockedURLs`, `?world=city&start=free&save=off`, M pressed in the city): at
+1.5 s the pill *Still loading — one moment…*; at +12.5 s the reload card (*Part of the game didn't load … Reload / Keep
playing*), the pill gone, the map panel closed (the goals chip back top-right) —
`docs/opus-bay/qa/w9/P/b-lost-map-closed-en.jpg` (read). The first shot showed the pill over the goals chip, which sits
top-centre while the map panel shifts the HUD → W9-P4b.
The same run on the phone (390 × 844, dpr 2, 04:05 PDT): the pill under the top chips at +1.5 s, the reload card at
+12.3 s, the map closed (the dock back) — `docs/opus-bay/qa/w9/P/b-lost-map-closed-phone-en.jpg` (read); the pill's text
wrapped to two lines in a 195 px box (a fixed box at `left: 50%` shrinks to the half width) → **W9-P4c** `white-space:
nowrap` + `max-width: calc(100vw - 32px)` (not re-shot: the dev-server phone re-run did not reach the city within its
5-minute limit at 04:20; the unit tests pass).

**Software GL, in a real run** (Chrome `--use-angle=swiftshader --enable-unsafe-swiftshader`, the production build):
renderer *SwiftShader Device (Subzero)*, no KHR; the title shows *This device draws the 3D world in software (no graphics
card), so it may run slowly — the quality is set to Low…* and *Getting ready…* —
`docs/opus-bay/qa/w9/P/b-swiftshader-title-en.jpg` (read). Its cold start (wait-10): title 1.6 s, ready 19.3 s, title
freeze 2.5 s; after the press every frame is slow (gaps up to 2.7 s, press → choice 44 s): software rendering, not
compiling — the note is the honest answer there.

**Tests / checks:** `tests/opus-bay-w9-p.test.ts` gained W9-P4 (4) and W9-P6 (1) — red on origin (the exports / module
did not exist), green now; the module guard W9-P3. Full opus-bay suite before the W9-P3/P4 push: **2004 tests, 2003 pass,
0 fail, 1 todo** (the 255 KB target); tsc 0; `eslint .` 0 errors (50 old warnings). On the W9-P6 tree (origin `3e65cc9f` + W9-P6): **2084 tests, 2083 pass, 0 fail, 1 todo**; tsc 0; `eslint .` 0 errors (53 warnings, none in this lane's files).

### Decisions (part b)

5. **The pill, not a spinner in each panel**: one plain-DOM status line in the page's chunk covers every lazy part
   (panels, cards, games) with no byte in GameRoot; a panel cannot show its own spinner before its chunk exists.
6. **A lost panel closes only itself** (`closeLost(kind)`): a Map lost 12 s after the press must not close the Journal
   the player opened meanwhile.
7. **The World's build stays one task tonight.** Splitting it (phased construction with yields between ground / city /
   props / landmarks / chunks) touches `world/world.ts` and the `getWorld()` callers (halloween's init among them) — too
   wide for the last hours of a wave with other lanes in those files. It is next (below), with its numbers.
8. **No user-visible words from this lane are BAYBAY lines** (the pill, the no-WebGL / software notes, the GL-lost card
   are UI text): nothing for `new-lines.md`.

### Not done / next

- **Split the World's build** (phone 4× ≈ 7 s, desktop ≈ 1 s title freeze; `addChunks` / `splitGeometryCells` the
  largest part): a `prebuildWorld()` that runs the build phases in tasks before `getWorld()` is first called, or a chunked
  `splitGeometryCells`. Then the actors' first render (2.7 s phone).
- **Start → ready** is the GPU's compile time for ≈ 49 programs: fewer program variants (the next real gain), or a
  measured `PRE_BATCH` (6 now) — more programs per batch may use ANGLE's compile pool better; not tuned blind tonight.
- **GameRoot 255**: 257.8 now; the remaining measured moves (sf-w8-P.md): the Golden Gate wisps in `world/fx.ts` (≈ 0.4),
  the POI link tables in `data/pois.ts` (≈ 0.8, the card body only — needs an async read in the card), the district
  subject facts (≈ 0.4), `game/transit.ts`'s ride-UI helpers.
- Software GL at Low still shows frame gaps up to 2.7 s on this machine: a lower render scale for software GL would help;
  not done.

## Review (Ultra)

Fixer of the adversarial review (lenses: code `C:/Users/willy/opus-qa/w9/p-rc/findings.json`, player
`C:/Users/willy/opus-qa/w9/p-rp/findings.json`). Worktree `C:/Users/willy/wt/w9-p-rev` (branch `w9-p-rev`, from
origin/opus-bay e9c3c35c), port 5949, scratch `C:/Users/willy/opus-qa/w9/p-rev/`. 05:43 – 06:45 PDT, 2 October.

### 给主人的摘要

1. 「准备中…」时按「开始」（或按回车）原来会被丢掉，要等它变成「开始」再按一次。现在这一下会被记住：按钮变成「好了就自动开始…」，准备好后游戏自己开始。实测（电脑）：标题出现 2.7 秒时按回车，22 秒时直接进入开场，没有再按。
2. 老玩家的「从头开始 · 渡轮大厦」在准备中时看起来能按、其实按不动；现在和「开始」一样变暗，按下也会被记住。
3. 打不开 3D 的设备：那句原因说明（"可能是浏览器关掉了硬件加速……"）在矮窗口和横屏手机上会被藏起来，现在一直显示。`?world=district` 旧场景保持原样：软件模式不再改画质，太早按开始也不会再跳到网站错误页。
4. 还没解决（报告里的说法已改正）：标题页上「搭建城市」那一下仍会卡住约 1 秒（电脑）/ 约 7 秒（慢手机），这期间语言按钮和"直接看攻略"点不动；「准备中」本身要 11–25 秒（电脑）/ 约 32 秒（慢手机），没有进度显示；软件模式（无显卡）按下后还有几个着色器在现编。都留给下一波，不影响上线。
5. 不阻塞上线到 main。

### The findings

| id | sev | verdict | evidence / what was done |
|---|---|---|---|
| P-RP-1 | major | **fixed** (W9-P-review d5133520) | Reproduced from `TitleScreen.tsx` (`primary = preparing ? () => {} : …`) and the lane's own batch (`coldprod2/summary.jsonl`: deadClicks 1 in every after-eager run). Red: `tests/opus-bay-w9-p-review.test.ts` 0 / 6 on the old code. Fix: `game/warmReady.ts` `queueStart()`. A press during 准备中… (Start, 继续旅程, Enter / Space, 从头开始) is kept (the first press wins) and the audio is primed inside the tap. The button reads 好了就自动开始… / Starting when ready… (still aria-busy + aria-disabled), and the kept action runs one task after `setWarmReady()`. No WebGL never queues. Live run (dev, 1440×900, en, save=off, busy machine): the title showed Getting ready… at 2652 ms. After Enter it read "Starting when ready…" with aria-busy at 3481 ms, and the 4-way choice came at 22014 ms with no second press (`p-rev/dk-1-kept.jpg`, `p-rev/dk-2-choice.jpg`, both read). |
| P-RC-2 | minor | **fixed** (d5133520) | Confirmed by code: only `.ob-title-start` had the inline dim, and no CSS targets `[aria-disabled]` on `.ob-btn`. 从头开始 now gets the same `WAIT_STYLE` (opacity .72, cursor progress), and its press is kept (it starts over, not resumes). Source test in the review file. |
| P-RP-6 | minor | **fixed** (d5133520) | Same defect as P-RC-2. |
| P-RC-3 | minor | **fixed** (d5133520) | Confirmed by code: `start()` set `load` without `glOk()`, and `startQuality` put software GL ahead of everything in both worlds. Now `start()` probes first (`if (!glOk()) return;`): no WebGL keeps the title's note, never the site's error page. Software GL → Low + the note now apply to the city only (`world/quality.ts`, `TitleScreen.tsx`). **Decision:** the district takes the no-WebGL title, because a crash page is not "the district as before". It does not take the software-GL path (Low / note): on a software rasteriser the district runs as before wave 9. Tests: a source check and a district render without the note. Not run in a real no-WebGL Chrome (no time). |
| P-RP-5 | minor | **fixed** (d5133520) | Partly stale. Lane F's W9-F9 (7a232652, after the lens's tree) changed the portrait-phone rule to hide only the greeting, so at 375×553 portrait the line now shows. `.ob-title-hint { display: none }` still hid it on windows ≥ 821 px wide and ≤ 620 px tall, and on landscape phones ≤ 460 px tall. The explanation now has its own class, `ob-title-nogl-why` (inline 13 px, ink-2), which no rule hides. DOM test in the review file. |
| P-RP-7 | minor | **fixed** (docs) | Confirmed from `coldprod2/summary.jsonl` (after-desk-eager firstTryToChoice 10632 / 18519; after-phone4x 47319 / 22904, freeze 3829 / 4746, titleFreeze 7494 / 7044). Line 1 of 给主人的摘要 above is corrected in place: the 标题页照常能点 claim is removed, the 6.5 s is now "from the accepted press", and the phone stutter total is added. The lane's final answer (summary_zh) cannot be changed, so this section supersedes it. With P-RP-1 fixed, an eager player's first press is now the press that counts. |
| P-RC-1 | major | **confirmed-not-fixed** | Confirmed from the lane's own production table: the longest title freeze is 7494 / 7044 ms on phone 4× and ≈ 1.0 s on desktop. The CPU attribution shows halloween init → `getWorld()` → `new World` (`addChunks` / `splitGeometryCells`) running synchronously on the GameRoot mount while Start reads 准备中…. The fix is a phased World build in `world/world.ts` (`prebuildWorld` in tasks, or a chunked `splitGeometryCells`), too large and too risky for this window. Desktop is still better than before (worst title freeze 8.3 → 1.0 s). On phone 4× the ≈ 7 s freeze moved from after the press onto the title. The claim is corrected (P-RP-7). Wave 10, P0 for lane P. |
| P-RP-2 | major | **confirmed-not-fixed** | Same root cause as P-RC-1 (the lens's own run: a rAF gap of 5678 ms on the title, a longTask of 5705 ms before the press, GL waits of only 231 ms). Not fixed, for the same reason. |
| P-RP-3 | major | **confirmed-not-fixed** | Confirmed from the lane's numbers: title → ready takes 11.1–14.1 s on desktop and 31.7 / 33.4 s on phone 4×. P-RP-1 removes the eager player's half: no second press is needed, and the label says the game will start by itself. The wait itself and the lack of progress remain. PRE_MAX_MS (30 s): when it trips, frames start while programs are still linking. On a slower phone that brings back the old freeze; it is not a softlock. Next: fewer program variants, a measured PRE_BATCH, a progress fraction from `prewarmPrograms` to the title. |
| P-RP-4 | major | **confirmed-not-fixed** | Confirmed in the lane's SwiftShader run (`p/prof/swiftshader-desk-wait10-1/result.json`). The pre-pass did not hit the cap (title 1603 → ready 19301 ms). After the press (22645 ms) there were 7 slow first uses (getProgramInfoLog / getShaderInfoLog, 215–2187 ms each, ≈ 6.8 s in total). These programs were first used after the press, so they were not in the warm set (most likely objects the intro shows that were hidden at the title). Most of the 57.5 s freeze after the press is software rendering at Low. Software GL is the degraded path with a note. Finding the missing programs needs a SwiftShader run that names the programs created after the press (not done). |

### Own pass (W9-P0 … P7, P4b / P4c)

- **OWN-1 (fixed, e1896a7b):** the P-RP-1 fix would have broken `scripts/opus-sf/qa/perf/cold-start.mjs --mode eager`.
  The script waited for an enabled Start to press again, but the title never shows one once the kept press starts the
  game, so a run would have hung to its 180 s limit and reported no choice. A kept press (好了就自[动動][开開]始… /
  Starting when ready…) is now marked `kept`, not counted as a dead click, and it counts as the press
  (`click = click ?? kept`). `clickToChoice` therefore includes the wait on the title, which is what the eager player
  waits. **For W9-Z:** measured from a kept press, "no freeze over 1 s after Start" now includes the title's World build
  (≈ 1 s desktop, ≈ 7 s phone 4×, P-RC-1). Measure the gate with `--mode wait10` (an accepted press on an enabled
  Start), as the lane did.
- Checked and fine:
  - The frame gate cannot deadlock. Warmup sits in the same Suspense as WorldScene, and its effect runs with
    `frameloop="never"`. `finally(onPre)` runs after the race with PRE_MAX_MS, an error or a lost context.
  - The district renders from the mount.
  - Neither the lane nor this review touched a frozen file.
  - With this review's changes the GameRoot static estimate is 257.9 KB (guard 258.5); warmReady.ts lives in the page's
    chunk.

### Open items (wave 10)

1. The World's synchronous build on the title (P-RC-1 / P-RP-2): ≈ 7 s on phone 4×, ≈ 1 s on desktop.
2. How long 准备中… lasts, with no progress shown (P-RP-3), and the PRE_MAX_MS cap on slow phones.
3. Software GL: some programs are first used after the press (P-RP-4); a lower render scale for software GL would help.
4. Not re-run by this review (no time, busy machine): production before / after cold-start numbers with the kept press.
   Also not run in a real Chrome: the no-WebGL and district press timing.

### Blocking the go-live to main

None. Nothing softlocks, and the open items are about speed, not breakage. The district is as before, except that a
no-WebGL device now gets the title's note instead of the site's error page.

### Commits and checks

- d5133520 W9-P-review: the kept press, 从头开始 dimmed, the probe in the press + the district's software path, the
  no-WebGL reason line (+ `tests/opus-bay-w9-p-review.test.ts`, lane P's regex tests updated)
- e1896a7b W9-P-review: cold-start.mjs understands a kept press
- `npx tsc -p tsconfig.app.json --noEmit`: 0 errors.
- `npx eslint .`: 0 errors (53 warnings, none in touched files).
- The title's other tests (w5-nav, w5-lang, w5-lang-review, w9-f-partb, w9-a-settings, w9-e-shell, sf-budget): 116 pass,
  0 fail, 1 todo.
- Full suite `tests/opus-bay-*.test.ts` on d5133520 + e1896a7b: 2144 tests, 2142 pass, 1 fail, 1 todo (the 255 KB target). The one fail is the wall-clock test `opus-bay-audio` "P1: preparation runs in slices…" (9.4 s under load); re-run alone: 18 / 18 pass.
