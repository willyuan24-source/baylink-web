# Wave 9 · lane E — entry, site shell, the /play switch

Lane E of wave 9 (sf-w9-lead.md §3 E), worktree `C:/Users/willy/wt/w9-e`, branch `w9-e` → `origin/opus-bay`, port 5901,
scratch `C:/Users/willy/opus-qa/w9/e/`. Started 2026-10-01 21:35 PDT from `f1460b0c`.

## 给主人的摘要

1. 旧 iPhone（iOS 15、16.0–16.3，以及这些手机里的微信）整站打不开的风险已修：站点代码里仅有的两处 lookbehind 正则改写成等价写法（3 万条随机查询逐条对照旧正则，结果完全一致），构建目标加上 Safari 15；打包产物里 lookbehind 从 2 处变为 0 处，体积几乎不变（+0.18 KB gzip）。用 Chrome 模拟旧引擎：修之前 /opus-bay 白屏报错，修之后标题页和首页都正常。
2. 加了一个守护测试：以后谁再在 src/ 里写 lookbehind，测试直接失败；另有 `dist-syntax.mjs` 给最终验收扫描构建产物。
3. （进行中）/opus-bay 自己的首屏与分享卡、/play 切换到小小湾区游戏，见下文各部分。

## Part a — the look-behind P0 (review R§5 #2) · 21:35 → 22:10 PDT

**What was wrong.** The 2026-10-01 bundle's entry chunk `index-CBvX8zQb.js` evaluated `new RegExp("(?<![a-z0-9])…")` at its
top level (esbuild turns a look-behind literal into `new RegExp` for a target that lacks it; the call still throws on an
engine without look-behind). Source: `src/lib/named-event-search.ts:2` (reached through `quick-search.ts` → QuickExplore),
plus `src/lib/guide-search.ts:58` (`split(/(?<=[。！？；\n])/)`, inside `searchGuides`). Safari / WKWebView < 16.4 cannot
parse either, so on iOS 15 / 16.0–16.3 (and WeChat there) the whole site stayed on the prerendered HTML.

**What changed.**
- `src/lib/named-event-search.ts`: the water-lantern regex is split into the English / "SF" alternative and the Chinese
  one (both sticky, same flags `iu`); `replaceWaterLanternNames` walks the query as the old global regex did — at each
  position the English / "SF" name first, only when the character before is not `[a-z0-9]` under `/iu` (so `K` Kelvin and
  `ſ` long s count, as before), else the Chinese name; after a match it goes on from the match's end; it steps by code point.
- `src/lib/guide-search.ts`: `splitAfterSentenceEnds(text)` (exported) cuts after each 。！？； / line break exactly as the
  look-behind split did ('' → [''], a mark at the end makes no empty piece).
- `vite.config.ts`: `build.target: ['chrome107', 'edge107', 'firefox104', 'safari15', 'ios15']` (Vite 7's default
  `baseline-widely-available` with Safari / iOS 15 instead of 16), so esbuild lowers any syntax iOS 15 cannot parse.
- `scripts/opus-sf/qa/dist-syntax.mjs` (for W9-Z): scans `dist/assets/*.js` for `(?<=` / `(?<!` (exit 1 on any) and counts
  class static blocks (`static{`, Safari 16.4+; a warning).
- `tests/opus-bay-w9-e-lookbehind.test.ts`: the old regexes are the oracle (in tests/, where Node parses them):
  `recognizeNamedEvent` = old on 80 listed cases (the site test's cases, negations zh / en, `only in` / 仅限 constraints,
  letters / digits / Kelvin / long s / an emoji right before "sf", a name right after a match, look-ahead edges) and on
  30 000 seeded generated queries (> 3000 of them contain a name); `splitAfterSentenceEnds` = old split on 17 cases + 20 000
  generated strings; **the guard**: any `(?<=` / `(?<!` under `src/**` (all .js/.jsx/.ts/.tsx/.mjs/.cjs) or `public/*.js`
  fails (it would have listed `named-event-search.ts:2` and `guide-search.ts:58` on `f1460b0c`); `build.target` names
  safari15 + ios15.

**Verified.**
- Production builds to scratch (`npx vite build --config vite.opus.config.ts --outDir …`): before (`f1460b0c`) `dist-syntax`
  = **look-behind 2** (`index-CBvX8zQb.js` @848194 the guide split, @916695 `Dp=new RegExp("(?<![a-z0-9])…")`), class static
  blocks 0; after = **look-behind 0**, static blocks 0, 412 chunks. Cost of the target + rewrite: only the site's `index-*`
  chunks changed, **+376 B raw / +182 B gzip** in all; every other chunk byte-identical (CSS too); GameRoot 258.03 → 258.04 KB
  gzip as vite prints it (same 682.94 KB raw). Build time 2 m 46 s → 2 m 58 s (machine shared with ~15 agents).
- Old-engine simulation (the review's `gapfill/ios-sim.mjs` method: a `RegExp` proxy that throws on a look-behind, iPhone
  WeChat iOS 15.8 UA, 390 × 844) on `vite preview` of each build, port 5901: before → `SyntaxError: Invalid regular
  expression … at index-CBvX8zQb.js:116:55820`, no title, nothing rendered; after → 0 throws, 0 errors, `/opus-bay` shows the
  title screen (开始 + the language pills) and `/` the full homepage (`C:/Users/willy/opus-qa/w9/e/ios/*.json|jpg`).
- Site tests: `tests/named-event-search.test.ts` 4/4, `tests/guide-search.test.tsx` 4/4 unchanged and green.
- Not done here: a real iPhone on iOS 15 / 16.2 (BrowserStack) — the owner's or W9-Z's call; runtime APIs newer than Safari
  15.0 (`Object.hasOwn`, `Array.prototype.at`, 15.4) are not polyfilled: iOS 15 devices that can update are on 15.8.

## Contract · `ui/entrySource.ts` (sf-w9-lead.md §4)

`entrySource(): 'home' | 'nav' | 'play' | 'photo' | 'family' | 'share' | 'guide' | 'promo' | 'direct'` — reads `?from=` once
(case / spaces ignored; an unknown word = `direct`; none = `direct`), keeps it for the tab in sessionStorage
(`opus-bay:from`, so GameRoot's one reload after a lost chunk keeps it), removes it from the address bar with
`history.replaceState(history.state, …)` (other parameters, the hash and the router's state kept); a later entry with a new
`from=` in the same tab wins. Helpers: `parseEntrySource(search)`, `searchWithoutFrom(search)`,
`withEntrySource(href, source)` (for S's share links), `ENTRY_SOURCES`. No game import (title-chunk safe); never throws
(no window, storage or replaceState refused). Tests: `tests/opus-bay-w9-e-entry.test.ts` (5).
