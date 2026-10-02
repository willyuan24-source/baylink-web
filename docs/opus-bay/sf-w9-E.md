# Wave 9 · lane E — entry, site shell, the /play switch

Lane E of wave 9 (sf-w9-lead.md §3 E), worktree `C:/Users/willy/wt/w9-e`, branch `w9-e` → `origin/opus-bay`, port 5901,
scratch `C:/Users/willy/opus-qa/w9/e/`. Started 2026-10-01 21:35 PDT from `f1460b0c`. The first agent was stopped by an account
usage limit at ≈ 00:35 with W9-E4 … E7 committed but not pushed; a second agent resumed at 02:14 PDT (2026-10-02), checked them
(below), pushed them unchanged at 02:44 and did part c (the /play switch).

## 给主人的摘要

1. 旧 iPhone（iOS 15、16.0–16.3，以及这些手机里的微信）整站打不开的风险已修：站点代码里仅有的两处 lookbehind 正则改写成等价写法（3 万条随机查询逐条对照旧正则，结果完全一致），构建目标加上 Safari 15；打包产物里 lookbehind 从 2 处变为 0 处，体积几乎不变（+0.18 KB gzip）。用 Chrome 模拟旧引擎：修之前 /opus-bay 白屏报错，修之后标题页和首页都正常。
2. 加了一个守护测试：以后谁再在 src/ 里写 lookbehind，测试直接失败；另有 `dist-syntax.mjs` 给最终验收扫描构建产物。
3. /opus-bay 有了自己的页面：打开时先显示和游戏标题页一样的静态首屏（不再先闪 BAYLINK 首页，限速 4G 实测从未出现首页内容），分享到微信/iMessage 时显示游戏自己的标题和主视觉卡片，sitemap 已收录。旧手机如果连脚本都跑不起来，会看到一条友好提示和「直接看攻略」链接，而不是点不动的页面。
4. **/play 已切换到 3D 旧金山（单独一个提交 W9-E-switch1，最终验收不通过时可单独撤回）**：首页卡片改为「逛一圈 3D 旧金山」，侧栏「小小湾区」也进入游戏；/play 自动跳到游戏（保留简体/繁體/English）；以前分享出去的周末车票链接会打开 /plan 里的同一份计划。旧的 /play 页面代码保留在仓库里，没有删除。
5. 顺手避免了一个副作用：/play 下线后，3D 引擎库会被打进游戏主包（主包变大将近一倍、每次更新都要重新下载），已让它保持独立缓存，体积和之前一致。
6. 用户能看到的「Opus Bay」已全部去掉：标题页左上角眉标改为「小小湾区 · BAYLINK」（英文 Little Bay · BAYLINK，繁體 小小灣區），和首屏一致。还需要主人或最终验收确认的：旧 iPhone 真机、微信里的分享卡片预览。

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

## Part b — /opus-bay's own page and first paint (review R§5 #3) + the boot check · 22:10 → 00:35 PDT

**What was wrong.** `vercel.json` sent `/opus-bay` to the homepage's prerendered `index.html` (after the filesystem): the
first paint was the BAYLINK homepage (clickable, in Chinese for everyone) for 1–5 s, its ~480 KB of homepage images were
downloaded for nothing, and every crawler that does not run script (iMessage, Slack, WhatsApp, WeChat) saw the homepage's
title / description / canonical `/` and the app icon. After the script ran, App.tsx's `/opus-bay` route had
`<Suspense fallback={null}>`: a blank screen until the route chunk arrived.

**What changed.**
- `scripts/prerender.tsx` writes `dist/opus-bay.html` from the built `index.html` (so the same module script, modulepreloads
  and css link): `<title>湾区小旅 · 跟 BAYBAY 逛旧金山｜BAYLINK</title>`, the game's own description, canonical
  `https://www.baylink.us/opus-bay`, hreflang zh-Hans / zh-Hant (`?lang=zh-Hant`) / en (`?lang=en`) / x-default, og + twitter
  `summary_large_image` with `og:image:width/height/alt`, and in `#root` the static first paint `OpusBayShell`. The sitemap
  (prerender and the tracked `public/sitemap.xml`) lists `/opus-bay`. `PRERENDER_OUT_DIR` lets QA prerender a scratch build.
- New `src/components/OpusBayShell.tsx`: the title screen's look without its script — the key art (`<picture>`: tall art
  on portrait phones), `小小湾区 · BAYLINK`, `湾区小旅`, `Little Bay Trip`, a `准备中… Loading…` pill where Start will be, and
  `先不玩，直接看攻略 · Read the guides →` (a plain link: works without script). It copies the title's own layout formulas
  (`.ob-title.has-art`: card column, art box, the `(max-width: 820px) and (max-aspect-ratio: 5/4)` phone rule), so the
  swap to the real title is in place. Bilingual and `translate="no"` (the static HTML cannot know the language and the
  React copy must not differ); one inline `<style>` (the CSP allows inline styles, not inline scripts); no animation under
  reduced motion; the Halloween art in October (the title's rule, restated: no game module in the site bundle).
- `src/App.tsx`: `/opus-bay`'s Suspense fallback is the same `OpusBayShell` (was `null`), so the page goes static shell →
  the same shell → the title, with nothing in between, and an SPA visit from the homepage shows it too.
- New `src/lib/opus-bay-metadata.ts`: the page copy (the game's own words from OpusBayPage), the share images, the art
  URLs, `opusBayInHalloween`, `opusBayMetadata`, the alternates and the extra head tags.
- New `public/opus-bay/og-key.jpg` (57.8 KB) and `og-halloween.jpg` (59.3 KB): 1200 × 630 crops (rows 40–1048 of the
  1920 × 1080 key art, Lanczos, JPEG q84) — the share card is the key art, not the app icon. OpusBayPage's client-side
  metadata sets the same image (it used to reset og:image to the icon after hydration).
- `vercel.json`: `/opus-bay` joins the plain prerendered pages (`/$1.html`) and leaves the index.html fallback.
- `public/boot-check.js` (review R§5 #2 suggestion 3; "only if cheap and proven harmless": 4.2 KB, one deferred
  same-origin request): a classic ES5 script `index.html` loads with `defer` before the module (every prerendered page has
  it). No ES modules → a bilingual notice at once; a SyntaxError before the app starts → "这台设备的浏览器版本较旧 … 生活攻略
  可以直接看" + `/guides`; the entry module failing to load → "页面没能加载完 … 刷新一下试试" + `/guides`; on `/opus-bay` the
  shell's 准备中 line says the same. App.tsx sets `<html data-app="ready">` on its first render: from then on nothing shows
  (and an early notice is taken away).

**Verified** (production build + prerender to `C:/Users/willy/opus-qa/w9/e/build-c/dist`, `vite preview` on 5901; probe
`C:/Users/willy/opus-qa/w9/e/probe/shell-probe.mjs`: a MutationObserver injected before any page script records any
homepage / site-shell DOM (`.home-discovery`, `.site-sidebar`, `.site-nav`, `.home-start-paths`, `.site-mobile-nav`, the
homepage's texts), the shell's and the title's first appearance and any moment with neither; DevTools throttling presets,
cache off; then it presses Start and waits for a canvas with the title gone; results `C:/Users/willy/opus-qa/w9/e/shell/*.json|jpg`):

| run | homepage DOM | shell at | title at | blank gaps | Start → game |
|---|---|---|---|---|---|
| desktop 1440 × 900, Fast 4G, zh | never | 246 ms | 2.6 s | 0 | 0.8 s, canvas |
| phone 390 × 844, Slow 4G + 4× CPU, `?lang=en` | never | 1.2 s | 23.9 s ¹ | 0 | English intro (Skip) |
| phone 390 × 844, Fast 4G, `?lang=zh-Hant` | never | 238 ms | 10.8 s ¹ | 0 | 1.1 s, 開始 → canvas |

¹ the site renders only after `initializeLocale()` has loaded the edition's dictionaries (English / OpenCC); the shell
holds the screen meanwhile (before: the homepage, in Chinese). The very first desktop run after the preview server started
saw the HTML only at 9.3 s (a cold server / Chrome on a loaded machine; still no homepage DOM); the re-run is in the table.
Before (the review, the live build): homepage painted at 0.3 s, the title at 2.5–6 s. On every run: document title, `<html
lang>`, h1 (湾区小旅 / Little Bay Trip / 灣區小旅), canonical and og:image as expected; no old-browser notice; `data-app="ready"`.
Boot check in Chrome (`probe/boot-probe.mjs`): the entry module blocked → the notice on `/` and on `/opus-bay` (phone), the
shell line "没能加载完 · Did not finish loading"; normal loads → none. `dist-syntax` on this build: look-behind 0.
Tests: `tests/opus-bay-w9-e-shell.test.ts` 5, `tests/opus-bay-w9-e-boot.test.ts` 4, `tests/seo.test.ts` 7/7 with two added
checks (none removed).
Screens to look at first: `docs/opus-bay/qa/w9/E/shell-desktop.jpg`, `shell-phone.jpg` (the static first paint) and
`boot-notice-phone.jpg`.

**Not done / notes.** The share card in a real iMessage / Slack / WeChat preview is unverified (no access); the
`og:image` is absolute and public. The hreflang links and `og:image:*` tags are static in `opus-bay.html` (client
navigation to another page leaves them in the head: harmless for crawlers, which load each URL fresh). No fixed BAYBAY
line is new or changed in this lane (the shell and the notice are static page text, not voiced) — nothing for
`new-lines.md`.

## Resume check of the first agent's commits · 02:14 → 02:44 PDT

W9-E4 (the page), E5 (boot-check.js), E6 (the eslint fix), E7 (report b) were committed, not pushed, on top of `3446c7b2`
(already the latest origin then). Checked before pushing: `tsc -p tsconfig.app.json` 0; `npx eslint .` 0 errors / 50 warnings
(the first agent's last run: 51; none in lane-E files); `tests/opus-bay-w9-e*.test.ts` + `seo`, `named-event-search`,
`guide-search` 34 / 34; the opus-bay suite 2008 tests: 2007 pass, 0 fail, 1 todo (the known W8-P9 todo "GameRoot ≤ 255 KB").
Rebased twice (W9-S2 / S3, W9-F2 … F7, W9-L: no file in common), tsc again 0, the S tests the rebase brought in green; pushed
unchanged: E4 `3c43ad3e`, E5 `6c673dee`, E6 `6ce479ba`, E7 `72d7cf95`. Nothing was discarded. The first agent's scratch had
the switch prepared but not applied (`switch/apply.py`, `switch/PlayRedirect.tsx`, `switch.test.tsx.hold`): part c started
from it, fixed two bugs in its test (several renders without unmount; `renderToStaticMarkup` always reads the server locale
snapshot, so the English card was never really rendered) and moved `playRedirectTarget` out of the component file (the
react-refresh lint rule).

## Part c — the /play switch (sf-w9-lead.md §3 E (3), §6; review R§5 #1) · 02:45 → 03:45 PDT

One commit, **`W9-E-switch1`** (`d57e8a1c`), so W9-Z can revert it alone if the switch gate fails (§6); nothing else in the
wave depends on it.

**What was wrong.** No link on the site reached the game (review R§5 #1): the homepage card 逛一圈 3D 湾区 and the sidebar's
小小湾区 · Little Bay opened `/play` (GPT's other 3D world). The owner (2026-10-01): "当OPUS-BAY没问题的时候，就可以替代PLAY了".

**What changed.**
- Homepage card (`src/components/HomeDiscovery.tsx`) → `/opus-bay?from=home`, label 「逛一圈 3D 旧金山」 / "Explore 3D San
  Francisco" (the game is San Francisco, not the Bay; the subline kept).
- Sidebar (`src/components/SiteNavigation.tsx`) 小小湾区 · Little Bay → `/opus-bay?from=nav`; current on `/opus-bay` and
  `/play` (the sidebar is not drawn on either — both are full-screen — but the state is right if that changes).
- `/play` (`src/App.tsx` + new `src/components/PlayRedirect.tsx`, outside the site layout like `/opus-bay`): a replace
  redirect (no history entry) to `/opus-bay?from=play`, keeping `?lang` and the hash, with the game's static first paint
  meanwhile. An old shared weekend ticket (`/play?date=&stops=&places=`, LittleBayPage's 分享车票) → `/plan` with the same
  `date` / `stops` / `places` (+ `lang`): the planner reads exactly those (`lib/planner.ts parseSharedPlan`; the test checks
  the parsed plan is equal). Other parameters of the old page (`view=`) are dropped. Where it sends whom:
  `src/lib/opus-bay-metadata.ts playRedirectTarget()` (pure).
- `scripts/prerender.tsx`: `dist/play.html` is the game's page (the same document as `opus-bay.html`: canonical
  `https://www.baylink.us/opus-bay`, the game's title / share card / static shell) instead of LittleBayPage's text; `/play`
  leaves the sitemap (and `public/sitemap.xml`); `vercel.json` keeps `/play → /play.html`.
- `LittleBayPage` is no longer imported: its route chunk, `LittleBayScene` and the `sf-landmark-events` chunk leave the
  build. `src/pages/LittleBayPage.tsx` and `src/features/little-bay/**` stay in the repo, unrouted; `tests/little-bay-ui`
  renders the page directly and stays green.
- `vite.config.ts` manualChunks (outside "build.target only" — named here; needed because of the switch, so inside its
  commit): three.js + react-three-fiber (+ react-reconciler, its-fine, suspend-react, react-use-measure) → `three-vendor`.
  They had been the chunk the game shared with LittleBayScene; with LittleBay gone Rollup inlined them into GameRoot.

| scratch build | GameRoot raw / gzip | the three.js + r3f chunk |
|---|---|---|
| build-c (before the switch, 00:00) | 682.94 / 258.05 KB | `react-three-fiber.esm` 874.40 / 233.63 KB |
| build-d (the switch, no rule) | **1,564.76 / 493.77 KB** | — (inside GameRoot) |
| build-e (the switch + the rule) | 687.56 / 259.30 KB ¹ | `three-vendor` 874.36 / 233.60 KB |

¹ The +1.25 KB gzip against build-c comes from the other lanes' commits rebased in between (F / S / L), not from the switch:
build-d's GameRoot = build-e's GameRoot + three-vendor + ≈ 2.8 KB of chunk glue. The site's entry and the game's title
chunk (`OpusBayPage-*.js`: copy, the site index, locale, react-vendor, `import(GameRoot)`) do not import `three-vendor`
(checked in build-e: the same imports as build-c). `dist-syntax` on build-e: look-behind 0, class static blocks 0 (406
chunks); vite build exit 0, prerender 589 pages, no tracked file churned.

**Tests.** New `tests/opus-bay-w9-e-switch.test.tsx` (7): the targets (lang kept, `view=` dropped, tickets → `/plan` with an
equal parsed plan, a date-only ticket), the route in a MemoryRouter (zh / zh-Hant / en / hash / ticket), the shell meanwhile
and nothing for a ticket, the homepage card (server HTML + client render, zh and en), the sidebar link and its current
state, the wiring (App / prerender / sitemap; `LittleBayPage.tsx` kept), the manualChunks rule. Site tests whose expectation
changed (none deleted): `tests/home-discovery.test.tsx` (the card's href is `/opus-bay?from=home`; its message "Little Bay is
discoverable from the homepage" still holds — 小小湾区 is the game now), `tests/seo.test.ts` (`/play` must NOT be in the
sitemap: it only redirects). Unchanged and green: `routing` (`/play` stays a known path), `unified-bay-navigation`,
`little-bay-ui`, `seo` (`/play → /play.html`).

**Verified in Chrome** (production build + prerender `C:/Users/willy/opus-qa/w9/e/build-e/dist`, `vite preview` :5901,
`probe/switch-probe.mjs`: a MutationObserver before any page script records homepage / site-shell DOM (`.home-discovery`,
`.site-sidebar`, `.home-start-paths`, `.site-mobile-nav`), LittleBayPage DOM (`.lb-page`), the shell and the title; results
`C:/Users/willy/opus-qa/w9/e/switch/*.json|jpg`):

| start | desktop 1440 × 900, Fast 4G | phone 390 × 844 |
|---|---|---|
| `/play` | `/opus-bay`, 湾区小旅, from = play | same |
| `/play?lang=zh-Hant` | `/opus-bay?lang=zh-Hant`, 灣區小旅 | same |
| `/play?lang=en` | `/opus-bay?lang=en`, Little Bay Trip | same |
| `/play?date=2026-10-10&stops=place:golden-gate,place:coit-tower&lang=en` | `/plan?…` in English with the Golden Gate stop | same |
| the homepage card (click / tap) | `/opus-bay`, from = home | same |
| the sidebar's 小小湾区 from `/guides` (click) | `/opus-bay`, from = nav | (no sidebar on phones) |

On every `/play` run no homepage, site-shell or LittleBayPage DOM ever appeared; the game's shell came first (38–564 ms),
canonical `/opus-bay`, `from=` gone from the address bar and kept in sessionStorage. `/play`, desktop, Fast 4G
(`probe/shell-probe.mjs`): shell 215 ms, title 2.65 s, no blank gap, Start → the game's canvas in 1.3 s (the intro at the
Ferry Building; `shell/e-d-play-fast4g-*.jpg`). The homepage card read in the browser: 「逛一圈 3D 旧金山」 (phone, zh),
"Explore 3D San Francisco" (desktop, `?lang=en`).
Screens: `docs/opus-bay/qa/w9/E/switch-home-card-phone.jpg`, `switch-play-hant-phone.jpg`, `switch-old-ticket-plan.jpg`.

**Notes / not done.**
- An old ticket link paints the game's shell (`play.html`) for a moment before `/plan` (the static page cannot read the
  query and the CSP allows no inline script); its link preview is the game's card, not the ticket. A server-side redirect
  (`vercel.json` with a query condition) would avoid both but cannot be tested here; left as is.
- `src/app/AppLayout.tsx` still tests `/^\/play\/?$/` (`playingLittleBay`: skip the feed fetch on /play) — dead now (the
  layout no longer renders on /play), harmless, not my file; it is live again if the switch is reverted.
- The game's title eyebrow still said 「Opus Bay · BAYLINK」 (`ui/TitleScreen.tsx:95`, lane F's file; §6 names: 「小小湾区 ·
  BAYLINK」) — done surgically in W9-E9 (below).
- Not verified: a real iPhone (iOS 15 / 16.2), WeChat's in-app browser and link card, Vercel's own routing of `/play` and
  `/opus-bay` (vite preview resolves `/x` → `x.html` like the `vercel.json` rule; the rules are pinned by `tests/seo.test.ts`
  and `tests/opus-bay-w9-e-shell.test.ts`).
- No fixed BAYBAY line is new or changed in lane E: nothing for `new-lines.md`.

## Decisions (no one asked)

- The switch is one commit (simplest to revert). `/play` redirects on the client (a tested `<Navigate replace>`), not with a
  Vercel 308: the client path handles `?lang`, the hash and the ticket rule and is proven here; a server redirect is not
  testable locally.
- Old tickets go to `/plan` (it reads the same parameters), not to the game.
- The three.js chunk rule went into the switch commit (it only matters because of the switch; a revert removes both).

## W9-E9 — no user-visible "Opus Bay" (sf-w9-lead.md §3 E (5), §6 names; review §10.1) · 04:05 → 04:35 PDT

The title's eyebrow was the last user-visible "Opus Bay" in `src/` (grep outside comments). Lane F owns
`ui/TitleScreen.tsx`; F's branch and report had not touched it by 04:05 and the switch gate wants no "Opus Bay", so a
surgical one-line fix (named in the commit): `Opus Bay · BAYLINK` → `{t('小小湾区 · BAYLINK', 'Little Bay · BAYLINK')}` — the
same words as the static first paint, so the swap from the shell to the title keeps them. Red-then-green: a new check in
`tests/opus-bay-w9-e-shell.test.ts` (5 / 6 before, 6 / 6 after); the title's other tests (w5-lang-review, w5-lang, w5-nav,
w9-a-settings, w9-p) 98 / 98. In Chrome on the dev server (`probe/mark-shot.mjs`, `?world=city&save=off`): desktop zh
「小小湾区 · BAYLINK | 湾区小旅」, phone `?lang=en` "LITTLE BAY · BAYLINK | Little Bay Trip" (the CSS upper-cases it), desktop
`?lang=zh-Hant` 「小小灣區 · BAYLINK | 灣區小旅」 (`C:/Users/willy/opus-qa/w9/e/switch/title-mark-*.jpg`). Static text, not voiced.

## Final checks (04:35 PDT, the tree of W9-E9 `17442508`)

- `npm test` once (the whole site + game suite, `--test-concurrency=4`, 38.7 min on the shared machine): 3168 tests, 3166
  pass, 1 todo (W8-P9), 1 fail = `opus-bay-sf-move2` "E2-5 view field in the city … a cached cell is cheap" (a wall-clock
  check; it failed the same way in the first agent's run under load) → re-run alone: pass. (A rebase onto other lanes' docs /
  game files happened while it ran; no lane-E file changed under it.)
- The build the way `npm run build` does it, to scratch (`vite build --outDir …/build-e/dist` + `PRERENDER_OUT_DIR=… tsx
  scripts/prerender.tsx`; the export scripts write tracked data and were not re-run): exit 0, 589 pages, `dist-syntax` PASS
  (look-behind 0), no tracked file churned. Built from the switch tree; W9-E9 (one string in the title chunk) came after.
- `tsc -p tsconfig.app.json` 0 and `-p tsconfig.node.json` 0; `npx eslint .` 0 errors, 53 warnings (50 before part c; the 3
  new ones are in `src/opus-bay/ui/CityTourRecap.tsx`, lane N's, rebased in; none in lane-E files).

## Requests

- **W9-Z**: run `node scripts/opus-sf/qa/dist-syntax.mjs --dist <dist>` on the go-live build; read GameRoot **and**
  `three-vendor` from the build output (the old `react-three-fiber.esm` chunk's successor); the switch rows above at zh /
  zh-Hant / en; if the switch gate fails, `git revert d57e8a1c` alone.
- **The owner**: open https://www.baylink.us/opus-bay and /play on an iPhone with iOS 15 or 16.0–16.3 if one is at hand, and
  paste https://www.baylink.us/opus-bay into a WeChat chat to see the card (the key art, 湾区小旅).

## Review (Ultra) · fixer, 05:50 → 07:00 PDT (lenses: code `e-rc`, player `e-rp`)

### 给主人的摘要

1. 审查发现的唯一重大问题已修好：iOS 15 到 16.3 的 iPhone（以及 Firefox 113 以前）没有解压接口，以前能进标题页但城市永远加载不出来；现在游戏自带一个小解压器，城市照常出现（所有城市数据文件逐字节验证）。
2. 首页卡片和侧栏「小小湾区」改为整页打开游戏：以前按返回再进，会跳过标题直接卡在对话里、声音也不响。
3. 旧的周末车票链接 /play?stops=… 现在服务器直接给出行计划页，不再先闪 9 秒游戏加载页；分享预览也是计划页。
4. 去掉了互相矛盾的 hreflang 标签；GameRoot 多出的 1.25 KB 是切换造成的（不是别的线），已放回独立小 chunk。
5. 两个小的视觉问题没来得及修：静态首屏到标题页文字会跳一下；万圣节画面按构建日期而不是访问日期选。都不影响上线。
6. 代码推送 06:54，比 06:45 的期限晚了 9 分钟（机器负载高，测试慢）；之后的生产构建发现我的解压器写法让构建失败，07:01 修好并推送（构建通过，GameRoot 257.33 KB，低于 258.5 KB 上限）。

### Verdicts

| id | sev | verdict | evidence / fix |
|---|---|---|---|
| E-RC-1 | major | **fixed** `b7ff7016` + `f673bbda` | Re-checked MDN browser-compat-data api/DecompressionStream.json on 2026-10-02: safari 16.4, safari_ios mirror, firefox 113, chrome 80. Reproduced red in node: the new test with `DecompressionStream` deleted threw `ReferenceError: DecompressionStream is not defined` on the old `gunzip`. Fix: `src/opus-bay/world/sf/inflate.ts`, a small RFC 1951 / 1952 inflate with no dependency, used only when the stream is missing. It was first loaded through a dynamic `importRetry` import, and the production build failed on that: Vite builds the city worker as iife, which cannot code-split. `f673bbda` makes it a static import of `format.ts`, so it now sits in the worker chunk and in format's own main-thread chunk `format-*.js`, not in GameRoot. That broken tree was on origin from 06:54 to 07:01. `tests/opus-bay-w9-e-review.test.ts`: every published `.obc` / `.obb` (194 chunks + far + graph + 2 boards, 4.4 MB) inflates byte for byte as zlib without the stream (686 ms), and the inflate matches zlib on stored / fixed / dynamic blocks, every header flag, two members and truncated data. |
| E-RC-2 | minor | **fixed** `35acffe2` | Confirmed from the lens's two builds (BufferGeometryUtils chunk only in build-c, its code in build-e's GameRoot, +4,626 B raw ≈ the chunk). A manualChunks rule `BufferGeometryUtils` restores the pre-switch chunk. The switch test pinned that id to "no chunk"; its expectation changed and the reason is written beside it. Footnote ¹ above is wrong: the growth came from the switch, not from F / S / L. |
| E-RC-3 | minor | **fixed** `a363149e` | Confirmed in the code: OpusBayPage never resets the zustand store's `phase` on unmount. The player lens also saw it on its own ("a second card click remounts the game straight into the world"). Fix: `<Link reloadDocument>` on the home card and on the sidebar's `/opus-bay` link, so the href stays the same and the browser does the navigation. Test in `tests/opus-bay-w9-e-switch.test.tsx`: red before (the router moved to `/opus-bay`), green after; control: `/calendar` still navigates client-side. |
| E-RC-4 | minor | **fixed** `18a109ea` | (a) Confirmed in the code: one file serves every `?lang`, with canonical `/opus-bay` both static and on the client. The hreflang links are dropped, and the shell test's expectation now says why. (b) Confirmed in the code: `seo.ts` never removes these tags. Fixed twice over: the vercel ticket route below serves `/plan.html`, and PlayRedirect removes `og:image:width/height/alt` and `og:locale:alternate` before it leaves for `/plan`. jsdom test. |
| E-RP-1 | minor | **fixed** `18a109ea`, `76834363` | Confirmed in the code: the vercel route sends `/play` to `play.html`, the game shell, and only the bundle's PlayRedirect moves a ticket on. Fix: three routes ahead of the plain-pages rule, `^/play/?$` with `has: [{type:'query', key: stops / places / date}]` → `/plan.html`. Vercel docs, read 2026-10-02: the `routes` objects take `has` with `type: query` (https://vercel.com/docs/project-configuration/vercel-json#routes). The test runs the routes table on its own matcher. `tests/seo.test.ts`'s `routeFor` now skips `has` routes (the reason is written beside it; its expectations are unchanged). **Cannot be tested locally** (vite preview has no vercel routes): W9-Z should open `https://www.baylink.us/play?date=2026-10-10&stops=place:golden-gate` after the deploy and see the planner as the first paint. |
| E-RP-2 | minor | **confirmed-not-fixed** | The lens's `sv.json`: at 1440×900 the shell card is 353 px tall and the title card 561 px. The title card has grown since the shell was drawn: lane F's W9-F8–F11 added 先不玩, a controls line and 今天在旧金山. Both cards are placed the same way (`.obs-card` / `.ob-title-card` share `--card-x/--card-w`), so h1 moves −104 px. Not fixed: there was no time to verify a CSS fix at five viewports. Open for wave 10: give `.obs-card` the title card's rows as invisible placeholders, or a matching min-height. |
| E-RP-3 | minor | **confirmed-not-fixed** | Code: `scripts/prerender.tsx:91` passes `opusBayInHalloween(buildDate)`, while `src/App.tsx:56` and PlayRedirect pass `new Date()` plus `location.search`. Open: the static HTML cannot know the visit date. Options are a neutral art in the shell, or letting `public/boot-check.js` (classic, `'self'`) toggle the art class early. Today's deploys fall in October, so the visible mismatch is `?world=district` / `?halloween=off`, plus any visit after 1 Nov until the next deploy. |

### Own pass

- `git log origin/opus-bay --grep "W9-E[0-9:-]"` was read for the switch and the shell only. There was no time for a full second play-through, and that is said here rather than claimed.
- Found by this fix: the site's `tests/seo.test.ts` route matcher ignores `has`. Fixed in `76834363`, as above.
- `build.target` keeps `firefox104`, and Firefox 104–112 also lack DecompressionStream. The E-RC-1 fallback covers them too.

### Checks

- `npx tsc -p tsconfig.app.json --noEmit` 0 (06:46 and 06:54, after the last rebase).
- `npx eslint .` on the tree of `18a109ea` gave 1 error, mine: react-hooks/globals in the new E-RC-3 test. Fixed in `3b6ee7d0`, and eslint on every touched file now gives 0 errors. The rest of the repo is unchanged since that run.
- The opus-bay suite `tests/opus-bay-*.test.ts` was run on the tree of E-RC-1..3: **2140 tests, 2139 pass, 0 fail, 1 todo**. The lane files were re-run after the later commits: switch + shell + review 15 / 15, `seo.test.ts` 7 / 7, home-discovery + unified-bay-navigation green.
- Production build to scratch (`vite.opus.config.ts`, outDir `C:/Users/willy/opus-qa/w9/e-rev/dist`). The first run, on `76834363`, failed (the worker iife code-split above). After `f673bbda` it exits 0 in 2 min 4 s: GameRoot 681.29 KB / **257.33 KB gzip** (guard 258.5; it was 259.30 in the lane's build-e), BufferGeometryUtils 4.84 / 1.45 KB, three-vendor 874.36 / 233.60 KB, and the inflate code is only in `worker-*.js` and `format-*.js`. `node scripts/opus-sf/qa/dist-syntax.mjs` gives 433 chunks, look-behind 0, class static blocks 0: PASS. No tracked public file changed.
- Pushes: `76834363` at 06:54 PDT and `f673bbda` at 07:01 PDT, both after the 06:45 deadline (the machine was loaded: the opus-bay suite took about 30 min).

### Blocking the go-live

- Nothing from lane E's review. E-RP-1's vercel route needs a check on the live deploy, since it cannot be tested locally.
- The go-live tree must include `f673bbda`. `76834363` alone fails `vite build`, and a revert of only `b7ff7016` would need `f673bbda` reverted with it.
