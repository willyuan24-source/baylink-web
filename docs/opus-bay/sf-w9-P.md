# Wave 9 · lane P · cold start, budgets, WebGL

Worktree `C:/Users/willy/wt/w9-p` (branch `w9-p`), port 5909, scratch `C:/Users/willy/opus-qa/w9/p/`. Brief:
`sf-w9-lead.md` §3 row P (R§5 #4 the cold start: every program before the first frame, a warm-up that yields, Start 准备中…
until ready, `scripts/opus-sf/qa/perf/cold-start.mjs`; no WebGL / software GL; GameRoot's guard and its 255 target; w8 NEXT
#11). The review: `docs/opus-bay/review-2026-10-01-first-use.md` §5 #4 and the §6 tech rows; its evidence
`C:/Users/willy/opus-qa/review-1001/gapfill/cold/`, `tech/trace1/`, `verify-tech/`.

## 给主人的摘要

1. **一看到标题就点"开始"不会再冻屏了。** 以前画面第一次出来时要当场编译几十个着色器，主线程卡住 4–12 秒（就是评测里"以为卡死了"）。现在先在后台分批把着色器全部编好，期间标题页照常能点语言、点"直接看攻略"；按钮显示「准备中…」，好了才变成「开始」。实测（机器满负荷时的开发版）：按下开始后画面冻住的时间从 11 秒降到 0，从按开始到出现四选一 = 6.7 秒（就是开场动画本身的长度）。
2. **打不开 3D 的电脑/浏览器不再看到网站的错误页**：标题页直接说"这台设备打不开 3D 画面"，并给出"这个月湾区有什么"、"活动日历"和"直接看攻略"三个入口。只能用软件模式显示 3D 的电脑会自动用「省电」画质，并有一行说明。
3. 画面丢失（图形内存被收回）的提示卡，电脑上不再说"手机把……"，改成"浏览器暂停了游戏的 3D 画面"。
4. 游戏主包（GameRoot）把渡轮的露天甲板和城市海鸥挪进了城市分包，腾出 0.43 KB，正好装下这次的冷启动改动（主包没有变大）。

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
