# Opus Bay · wave 9 · W9-I — the integration fix pass

Branch opus-bay, base 5250ffce (the tree the three integration lenses played). Fixer start 07:46 PDT (after the usage-limit
stop of the first W9-I attempt, which had left no worktree, branch or commit), last push by 08:15 PDT. Worktree
C:/Users/willy/wt/w9-int, scratch C:/Users/willy/opus-qa/w9/int/.

## 给主人的摘要

- 唯一的阻断项已修：F 线的改动不再影响小区模式（?world=district）。小区恢复 W9-F 之前的样子：首访黄金时段和「看此刻」提示、最多三条同时显示的提示、明信片自动翻面、旧的教学条、标题页旧文字。城市模式保留 F 线的新体验。
- 三条主要问题顺手修好：面板或对话里点「想去」「已保存」「链接已复制」、地图指南针，提示现在立刻出现，不再 10 秒后丢掉；只点地面走路或坐一日游的手机玩家，教学条 8 秒后自己收起；从活动卡点「带我去」，首次到达时到站卡显示 4 秒后，活动卡会回来。
- 另修一条小问题：英文日历文件的说明不再以中文开头。
- 仍然开着的两条主要问题：一日游第一章的两张到站卡各只停约 2 秒（自动上车把卡关掉）；第一章在金门大桥结束时，镜头对着游客中心的米色墙，大桥只露一条边。都要真玩验证，留给下一轮。
- 没有挡住上线或 /play 切换的问题了；请 W9-Z 在最终树上用 ?world=district 再看一次标题页和首分钟。

## Routes and what the three lenses saw

Three integration lenses played 5250ffce on a production build + prerender (GameRoot 257.33 KB gzip, three-vendor 233.60 KB):

- **NEW-PLAYER PHONE** (390x844 touch, 简体, :5961, 07:03–07:43): homepage card → /opus-bay (full page load), title fits at
  390x664 / 375x553 / 844x340, lane F's first-minute gate 4/4 on phone zh (≤ 3 messages at once), 这周有什么 end to end with
  the 这周免费 strip, share card with QR, 繁體 map search for 金門大橋 works, Back closes the map first. 1 major (W9I-P-1) +
  8 minors.
- **NEW-PLAYER DESKTOP** (1440x900, English, :5962): the Grand Tour chapter 1 to the Golden Gate (≈ 4 min), the week flow,
  Take me there to the Ferry Plaza market, the district title. 1 blocker (W9I-D10), 2 majors (D1, D2), 7 minors.
- **WORDS, FACTS & SITE** (:5963, curl + CDP): the static shell, metrics `from=`, .ics language, the QA server. 4 minors.

Shots (copied from the lenses' scratch): [d10-district-title-before.jpg](qa/w9/int/d10-district-title-before.jpg) (the
district title on 5250ffce with lane F's new link), [p1-arrived-yb.jpg](qa/w9/int/p1-arrived-yb.jpg) (the first-visit
arrival card that held the slot the event card needed), [d2-ggb-chapter-card.jpg](qa/w9/int/d2-ggb-chapter-card.jpg)
(chapter 1's finale: the Welcome Center's wall, the bridge a red sliver at the left edge).

## What W9-I changed

| commit | what | files (owner) |
|---|---|---|
| 8eb8b0c5 | **W9I-D10 = F-RC-2 / F-RP-1 (blocker)**: every lane-F first-minute change gated to the city; the district takes its pre-W9-F path: `offerRealTime` (golden first visit kept + the 看此刻 offer, the 03784d32~1 body as `offerRealTimeDistrict`), `startFree` (我是本地人: 60 s quiet, no hush, hints kept), `Toasts` (the old stack of up to three, no title host), `PostcardReward` (turns over by itself, no 点一下翻面 tag) and the photo-mode touch hint, the coach (the 7a232652~1 body as `DistrictCoach`), the title's 不玩了 link and touch hint + the phone-title CSS rule, the idle-line repeat guard | game/flow.ts, ui/Floating.tsx, ui/Moments.tsx, ui/CoachMarkBody.tsx, ui/TitleScreen.tsx, opus-bay.css, game/brain.ts (F; css Q, brain shared) |
| 8eb8b0c5 | **F-RC-1 / F-RP-2 (major)**: a toast or ribbon raised while a dialogue / panel / card is up shows at once (the panel's own feedback) instead of waiting behind the 'modal' holder and being dropped after 10 s | ui/titleHost.ts (F) |
| 8eb8b0c5 | **F-RC-3 (major)**: 8 s on screen marks the city coach seen AND closes it (tap-walkers, tour riders) | ui/CoachMarkBody.tsx (F) |
| 8eb8b0c5 | **W9I-P-1 (major)**: `whenArrived` asks at card + 0.5, so the event card the player asked for takes over the sticky first-visit arrival card after its CARD_MIN_MS (4 s) instead of expiring at 20 s; N's stuck card (4) still wins | game/goToRun.ts (N) |
| e81402ac | **W9I-D8 (minor)**: an English .ics DESCRIPTION starts with the English reminder; 繁體 through catalogText | realsf/ics.ts (R) |

Tests: tests/opus-bay-w9-int.test.ts (new, 4 cases: the district's golden first visit + 看此刻 offer, the district's
1-minute local quiet with no hush vs. the city's 3 minutes, the event card over a first-visit arrival card, the English
.ics) — red on 5250ffce (the first three checked by swapping the old flow.ts / goToRun.ts back in: 3 / 3 red), green after.
Lane F's and lane S's tests updated to the new behaviour (named here as their owners' files): opus-bay-w5-lang (worldMode 'city' for the one-toast case), opus-bay-w9-s-review S-RV-1 (the cause test now asserts the toast shows at once), opus-bay-w9-f-titlehost.test.ts (the two
"waits under a dialogue / dropped after 10 s" cases rewritten: red on the old titleHost, green now), opus-bay-w9-f-partb
(the coach closes after 8 s instead of "seen, but up"), opus-bay-flow-brain (the W9-F3 case pins worldMode 'city').

Decision: the title eyebrow 小小湾区 · BAYLINK / Little Bay · BAYLINK (W9-E9) stays in both modes. It is the §6 naming
change (the last user-visible internal code name "Opus Bay"), not a gameplay change; W9I-D10 listed it beside lane F's
link. W9-Z can revert that one line for the district if the owner reads the rule strictly.

## Every finding and its verdict

| id | sev | verdict | note |
|---|---|---|---|
| W9I-D10 | blocker | fixed | 8eb8b0c5; verified by code (each lane-F path now `worldMode === 'city'`-gated, the district bodies are the pre-W9-F ones), tests/opus-bay-w9-int.test.ts, the hero regression + district tests, and in Chrome on a production build of 231b202e (vite preview :5964, 08:03–08:05 PDT, ?world=district&save=off&lang=en, 1440x900): the title link reads "Skip the game — read the guides", no 今天 strip; after Start + 3 the golden light stays and "It's morning in the Bay right now (08:04). Want to see it? [See this morning]" shows ([d10-district-after-choice-fixed.jpg](qa/w9/int/d10-district-after-choice-fixed.jpg), read). |
| W9I-P-1 | major | fixed | Mechanism confirmed in code (goToRun.ts whenArrived at priority card, maxWaitMs 20 s vs. ArrivalCard's sticky first-visit holder at the same priority) and the lens's s11-goto.json; fixed in 8eb8b0c5 with a red / green test. |
| W9I-D1 | major | confirmed-not-fixed | Code: ArrivalCard closes on `move.mode === 'transit'` (W9-F2) and cityTour boards the bus 2.3 s after the Ferry Building arrival; the GGB card is replaced by the chapter card after 1.8 s (tour.jsonl). Needs a tour pacing change (game/cityTour.ts: wait for the card or board after it) and a play-through: open. |
| W9I-D2 | major | confirmed-not-fixed | The lens's shot (d2-ggb-chapter-card.jpg, read): the Welcome Center's beige wall fills the frame, the bridge is a sliver at the left edge, a dithered lamp post crosses the right third. Camera work (lanes C / N): open. |
| W9I-P-2 | minor | confirmed-not-fixed | The lens's gate log shows 我看到南瓜灯的光了 at 1.0 s and 52 s of the tour; halloween/worldLines.ts huntAhead does not ask whether a guided trip or the tour leads. Lane H. |
| W9I-P-3 | minor | confirmed-not-fixed | Three readings on one screen at the tour's first stop (the lens's frame and samples); lane N's c81dcf27 fix was never pushed. |
| W9I-P-4 | minor | confirmed-not-fixed | The ride banner's primary button is 下一站下车 on the tour bus (shot 28). Lanes N / Q. |
| W9I-P-5 | minor | confirmed-not-fixed | Measured sizes 77x32, 44x32, 36x36 (the lens's getBoundingClientRect). Lanes R / F. |
| W9I-P-6 | minor | confirmed-not-fixed | realsf/addCal.ts raises no toast (code). Lane R. |
| W9I-P-7 | minor | confirmed-not-fixed | SFMOMA's arrival card at 7.3 s of a guided walk and its line under the destination card (s11-goto.json). Lanes C / N. |
| W9I-P-8 | minor | confirmed-not-fixed | No how-to-start hint at 嘿咻推转盘 for 28 s (s17-dex-go.json). Lane G. |
| W9I-P-9 | minor | confirmed-not-fixed | Photo mode's buttons listed live under the album (the lens's button list). Lane S. |
| W9I-D3 | minor | confirmed-not-fixed | "Next: Golden Gate ~9s" after "Arrived: Golden Gate Bridge" (tour.jsonl). Lane N. |
| W9I-D4 | minor | confirmed-not-fixed | Three bus-wait times (tour.jsonl t 10.2 / 11.8). Lane N (c81dcf27 unpushed). |
| W9I-D5 | minor | confirmed-not-fixed | Same cause as P-2 (six pumpkin lines in chapter 1). Lane H. |
| W9I-D6 | minor | confirmed-not-fixed | The fly unlock line and toast while seated on the moving bus (tour.jsonl 52.6 / 55.8). Lanes F / N. |
| W9I-D7 | minor | confirmed-not-fixed | Bubble + note say the same thing; the note contradicts the 20-item strip (c01-week-after-3.jpg). Lane R. |
| W9I-D8 | minor | fixed | e81402ac, red / green test. |
| W9I-D9 | minor | confirmed-not-fixed | Two Cancel controls for one wait (desktop-en-tour-20s.jpg). Lanes N / Q. |
| W9I-WFS-1 | minor | confirmed-not-fixed | The prerendered shell is one zh-first body for every ?lang (curl). Lane E (public/boot-check.js could swap the texts). |
| W9I-WFS-2 | minor | confirmed-not-fixed | TitleScreen / TitleGl build their site hrefs without withGameFrom (code). Lane S. |
| W9I-WFS-3 | minor | confirmed-not-fixed | realsf/ics.ts offerIcs never passes title / who / requirement through catalogText (code). Lane R. |
| W9I-WFS-4 | minor | confirmed-not-fixed | scripts/opus-sf/qa/csp-serve.mjs ignores a route's `has` (code): W9-Z's switch rows through csp-serve see plan.html for every /play. QA tooling; W9-Z should use vite preview for the switch rows. |

Lane F's other confirmed-open items not covered above (from its review): F-RP-3 (hide & seek invite in 我是本地人's hush),
F-RP-4 (3 lines after the 自己逛 hush), F-RP-5 (the turn-over tag over an English caption), F-RP-6 (the ghost stick under
the coach bar), F-RC-4, F-RC-5, F-RP-9 — open.

## Review re-check (review-2026-10-01-first-use.md §5, Top 15)

| # | item | now | evidence |
|---|---|---|---|
| 1 | no site link reaches /opus-bay | gone | phone lens: homepage card 逛一圈 3D 旧金山 → /opus-bay?from=home (full load), sidebar 小小湾区 → from=nav; /play redirects (lane E) |
| 2 | iOS < 16.4 lookbehind | better | dist look-behind 0 (lane E's build), build.target set; DecompressionStream replaced by an inflate (E-RC-1). Real iPhone untested |
| 3 | /opus-bay first paints the homepage | gone | own prerendered shell with its own title / canonical / og (curl); WFS-1: the shell is zh-first in every language |
| 4 | cold-start freeze after an early Start | not re-checked | no fps / freeze measurement in this pass (W9-Z measures); the phone lens's early Start was kept (好了就自动开始…) |
| 5 | 7–9 messages at once | better | first-minute gate 4/4 phone zh ≤ 3 at once; still: the tour's arrival cards last ≈ 2 s (D1); the district now as before (D10 fixed) |
| 6 | contradicting times / places | better, not gone | P-3, D3, D4 (three readings at one bus stop, "Next: Golden Gate" after arriving) |
| 7 | stuck legs, no rescue | not re-checked | no stuck leg came up in the lenses' runs; lane N's watchdog + stuck card are in the tree |
| 8 | share loop broken | better | share card with QR and a photo frame with QR and the date (phone lens) |
| 9 | zero metrics | better | the lazy metrics runner adds from=opus-bay once loaded; WFS-2: not on the title / no-WebGL links |
| 10 | free offers only on the day | better | 这周免费 7-day strip (20 items) and the SF Zoo resident day on 10/7 |
| 11 | 繁體 map search fails | gone | 金門大橋 finds results in 繁體 (phone lens) |
| 12 | week relaxing drops the region first | better | honest relaxed board kept the region (带娃 → 户外 → 金门公园·西边); D7: the note repeats the bubble and contradicts the strip |
| 13 | mini-games hard to find | better | 游乐图鉴 lists them and leads there; P-8: no how-to-start at the turntable |
| 14 | touch players never taught to walk | better | the coach + ghost stick on touch; F-RC-3 fixed here (it now goes after 8 s); F-RP-6 open |
| 15 | camera misses the landmark | unchanged (tour finale) | D2: chapter 1's finale faces the Welcome Center wall |

## Open items

1. W9I-D1 (major): the tour's chapter-1 arrival cards last ≈ 2 s — game/cityTour.ts should board after the card (or the
   card should survive a tour-driven boarding) and the GGB card should precede the chapter card by its CARD_MIN_MS.
2. W9I-D2 (major): the chapter-1 finale camera at the Golden Gate Welcome Center (actors/reveal.ts / cityViews.ts).
3. The minors in the table above, and lane F's open F-RP-3 / 4 / 5 / 6, F-RC-4 / 5, F-RP-9.
4. Not re-run in a browser after these fixes (time): the district's postcard turn and coach, a toast inside the map (the
   compass), the event card's return after 带我去 on a first visit. W9-Z: please include them. (The district title and its
   golden first visit + 看此刻 offer were checked in Chrome, see W9I-D10.)

## Blocking the go-live or the /play switch

Nothing left that blocks, provided the go-live tree includes 8eb8b0c5 (the district gate). W9-Z should confirm the
district in a browser (title link 不玩了，直接看攻略, golden hour after the welcome choice with the 看此刻 toast, the postcard
turning over by itself) and that the hero regression test passes on the final tree.

## Checks

tsc app 0 · eslint . 0 errors (53 warnings, none new) · the touched tests 56 / 56 + 17 / 17 · full opus-bay suite on
8eb8b0c5: 2183 tests, 2180 pass, 1 todo, 2 fail — both were tests pinning the behaviour this pass changed:
opus-bay-w5-lang (lane F's one-toast expectation now runs in the city; the district renders its old stack) and
opus-bay-w9-s-review S-RV-1 "the cause, reproduced" (a toast under an event card was held and dropped; now it shows at
once — rewritten, lane S's file). Both re-run green (13 / 13). Production build of 231b202e (scratch outDir, exit 0, 44 s,
no tracked churn): GameRoot 681.71 / 257.46 KB gzip (+0.13 KB for the district paths; guard 258.5), three-vendor 233.60 KB;
dist-syntax: 433 chunks, look-behind 0 → PASS.

## Completeness pass (W9-C, 08:15–08:45 PDT)

Worktree C:/Users/willy/wt/w9-cfix (branch w9-cfix from origin/opus-bay 33f0be76), pushed 08:30 PDT as 33f0be76..d523fd71.

### 给主人的摘要

- A、G、N 三条线评审后修好但没推上去的代码，现在都上线分支了：手机返回键在 BAYBAY 说话时不再直接退出游戏；菜单里按方向键后空格仍能取消；横屏手机对话框不再超出屏幕；摸摸 / 看风景不再抢走「今日小游戏」的金币；打开设置时夹娃娃、捞螃蟹、揉面团会暂停、面板收起；N 线的「车快到了」和同一段路只显示一个时间。
- 新修一条：选「我是本地人」后的 3 分钟安静时间里，BAYBAY 不会再在 40 秒时邀请你玩捉迷藏，安静时间过后才邀请（有先红后绿的测试）。
- 全部检查通过：类型检查 0 错、整个仓库 lint 0 错、游戏测试 2191 条全过、网站测试 1071 条全过；正式构建 GameRoot 257.45 KB（上限 258.5），旧 Safari 语法扫描通过。
- 回退开关要注意：只回退 d57e8a1c 一个提交现在会冲突（之后 E 线评审又改了 5 个文件）。正确做法是按顺序回退 5 个提交：`git revert 3b6ee7d0 18a109ea 35acffe2 a363149e d57e8a1c`。已经试过：不冲突，构建通过，GameRoot 257.55 KB，相关测试全过。
- 真机、微信、Vercel 线上路由、首分钟桌面和英文、冷启动这些只能在浏览器或真机上看，这次没做，仍交给 W9-Z。

### The items

| item | result | commits on origin | evidence |
|---|---|---|---|
| Land lanes A's and G's held review fixes (A-RV-1 / 2 / 3, G-RV-1 / 2) with their reports | done | 0ec8ca48 → 589ed14e, e9ae0e73 → 605a1968 (A); ac69ed42 → cf702617, cb582ff3 → bdeda0e7 (G) | cherry-picked clean onto 33f0be76; tests opus-bay-w9-a*, w9-g* (incl. a-review, g-review) green; sf-budget estimate 258.2 KB (≤ 258.5); hero-regression, district green |
| Land lane N's held review fix (N-RC-1, N-RP-2, N-RC-6) | done | c81dcf27 → 24c7e9c7 | clean pick; opus-bay-w9-n* (review, time, tour, stuck, venue, wp) green; opus-bay-sf-move2 alone 24 / 24 (its E2-5 case, the one that blocked lane N's push, green); sf-w9-N.md Review Checks gains the "landed as" line |
| F-RP-3: the 捉迷藏 invite respects 我是本地人's hush | done | d523fd71 | play/hideSeek.ts startHideCoach's `ok` gains `&& !baybayHeld()` (game/baybayHold.ts, already in GameRoot; city only, so the district is unchanged). New case in tests/opus-bay-w9-f-first-minute.test.ts: red on 24c7e9c7 ("no invite inside the hush": '1' !== undefined — the invite came at 40 s), green after (none in 60 quiet seconds inside the hush; once ≤ 42 s after it). hideSeek is a lazy chunk: GameRoot unchanged. No BAYBAY line changed (nothing for new-lines.md). |

Checks on d523fd71 before the push: tsc app 0 · `npx eslint .` 0 errors (53 warnings, none new) · the whole opus-bay suite
(`--test-concurrency=6 "tests/opus-bay-*.test.ts"`): 2192 tests, 2191 pass, 0 fail, 1 todo (W8-P9's 255 KB target) · after
the push, the site's tests (every tests/*.test.{ts,tsx,mjs} that is not opus-bay-*, plus tests/opus-bay-w9-e-switch.test.tsx,
concurrency 4): 1071 / 1071 pass · production build of d523fd71 (scratch outDir, 39 s, exit 0, no tracked churn): GameRoot
681.73 / 257.45 KB gzip, three-vendor 874.36 / 233.60, BufferGeometryUtils 1.45 · dist-syntax: 433 chunks, look-behind 0,
class static blocks 0 → PASS. Not run: the rest of `npm run check` (`npm run build`'s export / prerender steps and
verify:share-cards).

### The critic's claims, verified or not

| claim | verdict | how |
|---|---|---|
| W9-I's "nothing left blocks" was made without A / G's review results; their fixer commits and N's c81dcf27 never reached origin; five lens majors live | **verified, now fixed** | `git merge-base --is-ancestor <sha> origin/opus-bay` was false for all five on 33f0be76; they are on origin now (table above) |
| Old iPhones / WeChat: Safari 15.4 APIs unpolyfilled | **verified statically** | vite.config.ts build.target `['chrome107','edge107','firefox104','safari15','ios15']` lowers syntax only; package.json has no core-js / plugin-legacy. Uses: `Array.prototype.at` in 35 src/opus-bay files (40 in src), `Object.hasOwn` in 8 site files (src/App.tsx, src/routing.ts's category helpers, …), `structuredClone` in src/lib/planner-edit.ts / planner-library.ts, unguarded `crypto.randomUUID()` in ChatView.tsx, planner-library.ts, useImportedEvents.ts (three other uses are guarded). On iOS 15.0–15.3 these throw where they are called. Look-behind: 0 in src and 0 in the tip's dist (above); DecompressionStream has the E-RC-1 fallback (world/sf/format.ts). No real device tried. |
| Vercel routing (the /play redirect, /opus-bay, the has-query route for old tickets) | **not verifiable here** | vercel.json read: routes 12–14 send `/play` with `stops` / `places` / `date` to /plan.html before route 15's `/play → /play.html`; the redirect itself is the client's PlayRedirect (src/App.tsx). `git.deploymentEnabled.opus-bay: false`, so no preview: the live behaviour, first paint and link previews stay W9-Z's / the go-live's. |
| Revert path: `git revert d57e8a1c` never built after the E-review split | **verified: the one-commit revert does not apply** | `git merge-tree --write-tree --merge-base=d57e8a1c d523fd71 d57e8a1c^` conflicts in 5 files (HomeDiscovery.tsx, SiteNavigation.tsx, vite.config.ts; PlayRedirect.tsx and tests/opus-bay-w9-e-switch.test.tsx modify / delete), touched later by a363149e, 35acffe2, 18a109ea, 3b6ee7d0. The revert that works, newest first: `git revert 3b6ee7d0 18a109ea 35acffe2 a363149e d57e8a1c` — chained merge-tree dry run all clean (13 files, +25 / −270, incl. vercel.json's ticket routes and both chunk rules). A throwaway detached worktree of that tree: production build exit 0 (56 s): GameRoot 681.89 / 257.55 KB gzip (guard 258.5), three.js + r3f back in the shared react-three-fiber.esm chunk 874.40 / 233.63 KB gzip (not in GameRoot), BufferGeometryUtils 1.46 KB, LittleBayScene 7.91 KB; tests opus-bay-sf-budget, opus-bay-w9-e-shell, home-discovery, seo: 40 pass / 0 fail / 1 todo. Nothing of it was committed. |
| No full `npm run check` on the tip | **mostly done** | lint, the whole test set (opus-bay 2191 + site 1071 + the switch .tsx) and a vite production build + dist-syntax on d523fd71, all green; the export / prerender steps and verify:share-cards not run |
| 8 am time-of-day words (黄昏 at 8 am) | **partly verified** | a throwaway node test: `bayTimeOfDay` for 2026-10-02 06:45–09:00 PDT is `morning` in both the city and the district (golden from 18:45), so the band is right at 8 am. Where 黄昏 could still show at 8 am (the city intro's golden first visit, Settings' 黄昏 label for `golden`) was not replayed in a browser. |
| First-minute gate on desktop + English; W9-I's district fixes in a browser; cold start; lane N's Grand Tour on the review tree; lane R's browser pass; lane F part b screens; lane C's sea lions; voice; the title's dead second; metrics | **not verified** | browser / device / owner work, none of it cheap or safe in this pass (one Chrome at a time, no fps claims): W9-Z's and the owner's |

### Switch risks this pass changes

- "Unpushed A / G review fixes": closed — Back while a line types (A-RV-1) and Space in the menu (A-RV-2) are on origin.
- "Revert path": the one-commit revert is no longer the revert; the five-commit one above builds within the guard.
- The rest stand as the critic listed them (the §6 Top-15 acceptances, the desktop / en first-minute runs, phone cold
  start, old iPhones / WeChat, Vercel-only routes, what /play users lose, no metrics, sound on Start).

### Housekeeping

- The throwaway worktree C:/Users/willy/wt/w9-cfix-rev was removed (its node_modules link first); git could not delete its
  admin folder .git/worktrees/w9-cfix-rev in the main checkout (Permission denied, OneDrive) — it holds no gitdir file, so
  `git worktree prune` clears it later. The dry-run revert commits are unreferenced (no branch), nothing was pushed from them.
