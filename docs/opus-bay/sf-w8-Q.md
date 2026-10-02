# Wave 8 · lane Q · phone UI & words

Worktree `C:/Users/willy/wt/w8-q` (branch `w8-q`), dev port 5802, scratch `C:/Users/willy/opus-qa/w8/q/`, QA images
`docs/opus-bay/qa/w8/Q/`. Brief: `sf-w8-lead.md` §3 row Q (run as the Ultra workflow, §7). A first agent of this lane
worked 18:55–19:20 PDT and was stopped only by the switch to the workflow; this agent resumed its work (below).

## 给主人的摘要

1. **英文版不再夹中文**：之前英文「带去 BAYLINK 安排」那句会夹着中文站名（宣传片里拍到的），现在名字都是英文；顺带又找到并修好三处：旅行本「今天」页的活动地点（"2nd Street（Market 至 Howard 段）"）、活动卡片「地点」一栏（"Ferry Building 外"）、手帐「城市之声」页的 "Tap 听一听"。
2. 做了一个**自动语言检查脚本**（`scripts/opus-sf/qa/lang-scan.mjs`）：用无头浏览器把标题、HUD、地图、搜索、地点卡、活动卡、这周去哪、问 BAYBAY、旅行本每一页（含手帐的五个小页、万圣节页）、小铺、相册、设置、小游戏结果卡、万圣节明信片、缆车卡、地铁、到达卡都打开一遍，英文里找中文、繁体里找简体字。现在英文 54 个画面 0 处、繁体 54 个画面 0 处。之后的整合测试和最终验收可以直接再跑。
3. **手机坐地铁（地下）时也能打开设置了**：地铁画面盖住了设置按钮，手机又没有 Esc 键；现在地铁卡片右上角有一个齿轮按钮。地铁里打开相册、居民来信、目标卡也会显示在隧道画面上面（以前被盖在下面看不见）。
4. **手机按钮变大**：地图右边的放大/缩小/回到我这/全城/图例和指北针，在手机上从 36 像素变成 44 像素（手指好按）；自由逛时提示条上的「×」也好按了。
5. **横屏小手机（带地址栏的 844×340、667×320）**：新玩家第一次看到的目标卡，「我自己逛」按钮以前掉到屏幕外面、金色按钮被切掉一半，现在改成左右两栏，两个按钮都完整在屏幕里。「那是什么？」看风景小游戏的三个答案按钮不再和右边的跳/飞按钮叠在一起。
6. 横屏时小游戏顶部的条不再盖住左上角地点和右上角明信片。新增**手机遮挡检查脚本**（`scripts/opus-sf/qa/overlap-scan.mjs`），在 4 种 iPhone 尺寸下检查了第八波新加的恶魔岛渡轮卡、地铁、看风景小游戏等，除下面一条外都没有遮挡；请 K 线处理：等渡轮时，指向目标的「转过去」小箭头有时被顶部的乘车卡盖住。

## Resume (19:24 PDT)

The first agent left: **W8-Q1 `8bf7865c`** committed, not pushed (the Journal's 带去 BAYLINK line; `i18n.ts catalogText`,
`planStopTitles(…, locale)`, the Journal / DistrictRecap labels; 3 tests) — kept as is (read, its tests re-run green, red
on the old code per its message); uncommitted `realsf/TodayTab.tsx` (one line: the week row's venue through
`catalogText`) — kept, given a test, committed as W8-Q2; the uncommitted `scripts/opus-sf/qa/lang-scan.mjs` — kept and
finished (W8-Q4). Its scratch runs `scan1`–`scan5` (en 390 × 844 and 1440 × 900, zh-Hant 390 × 844) were read: they found
only the 今天 venue and the bilingual-by-design strings now on the scan's ALLOW list. Nothing was discarded.

## Part a (19:24–20:00 PDT): English never shows Chinese · the language scan

### What was built

| # | what | files |
|---|---|---|
| Q1 | (first agent) the Journal's **带去 BAYLINK** line joined the catalog's zh-only titles into the English sentence ("Take Ferry Plaza 农夫市集… to BAYLINK as a plan"): `catalogText(text, locale)` (the site's editorial dictionary through `translateText`; in English a title the dictionary lacks keeps its Latin parts, never an empty name), `planStopTitles(stops, catalog, locale)`, the Journal's titles / later / names, the district recap's plan label (text only) | `i18n.ts`, `data/links.ts`, `ui/Journal.tsx`, `ui/DistrictRecap.tsx` |
| Q2 | the **今天** tab's week row joined the catalog's venue into "Tomorrow · Thu · 2nd Street（Market 至 Howard 段） · …" (the site translates the venue alone, an exact dictionary entry, but not inside the longer joined line): the venue goes through `catalogText` first. The Notebook's **城市之声** page said "Tap 听一听" while the button reads Listen | `realsf/TodayTab.tsx` (lane S's file, one line), `economy/Notebook.tsx` (one string) |
| Q3 | the **event card's Where row** ("Ferry Building 外 · Ferry Plaza · San Francisco" on the Ferry Plaza market's card): the same join, the same fix | `ui/EventCardBody.tsx` |
| Q4 | **`scripts/opus-sf/qa/lang-scan.mjs`** — the reusable wrong-script scan (header: usage, screens, what was found). One headless Chrome, respects the PERF-LOCK; `--lang en|zh-Hant`, `--mobile`, `--w/--h`, `--only`, `--events`, `--query`, `--shots`; canvas text recorded from page start; an ALLOW list for the bilingual-by-design strings (the language switch's label, the weekly board's painted sign, the shop-sign atlas). | new |

### Evidence

- Tests (red on the old code, green now): `tests/opus-bay-w8-q-lang.test.ts` (5: Q1's three; Q2's TodayTab rendered in
  English at Bay 2026-09-30 10:00 with the real catalog — every `.ob-today-row` free of Han; the Notebook's Sounds page —
  "Tap Listen", no Han) · new `tests/opus-bay-w8-q-cards.test.ts` (2: **every San Francisco event card (70)** and **every
  city place card (24, two Bay days)** rendered in English, no Han in any text node or aria-label / title / alt /
  placeholder — the event test was red on exactly the one Ferry Plaza leak).
- Scratch measurements: the site dictionary translates every displayed field of the 70 SF events alone (title, venue,
  city, dateLabel, summary, costLabel, plan, audience); 2 SF places' summaries and 1 title it does not
  (`restaurant-gotts-ferry-building`, `venue-exploratorium-daytime`) — the game shows neither (no city POI links them).
  Every `{ zh, en }` pair exported by the 604 importable `src/opus-bay/**/*.ts` modules (4480 pairs): no English side with
  Han. No `t('中文')` without an English twin in the game's sources.
- The scan on dev 5802 (city, save=off, halloween=1): **English 390 × 844 touch: 54 screens, 0 leaks, 0 page errors**;
  **繁體 390 × 844: 54 screens, 0 leaks** (16 painted canvas strings, all Traditional). Shots read: the event cards, 问
  BAYBAY, the metro, the arrival (scratch `scan6/`, `scan7/`).
- Checks before the push (the tree rebased on `origin/opus-bay` 592136b6): tsc 0 · eslint 0 errors (50 old warnings) ·
  suite **1681 / 1681** (run on the tree one origin commit earlier; after the rebase onto W8-X1: tsc 0, my tests + the
  voice tests 13 / 13). Pushed **64cdf803** (W8-Q1…Q4).

### Decisions

- Catalog strings are translated **before** they are joined (`catalogText`), wherever the game builds a line from them;
  a lone catalog string stays a JSX text child (the site runtime translates it, and keeps a later dictionary update).
- `DistrictRecap.tsx` got the same one-word change as the Journal (its plan label is English text built from the catalog's
  titles): district mode's look and behaviour are unchanged; only its English label stops carrying Chinese.
- The shop-sign atlas paints 面包 / 点心 / 书店 … on the city's plaques in every language (with the English line on the same
  plaque): bilingual signs, as the real streets are signed — allowed, not a leak.

### Not done (part a)

- Overlays wave 8 adds later (the Alcatraz ferry, M's games, S's Fleet Week card, H's festival) are not in the scan's
  screen list yet: part c re-runs the scan once they are on origin.

## Part b (20:00–22:10 PDT): Settings underground · touch targets · the short landscape · the skyline quiz

Pushed as **18fa17c6** (W8-Q5 … W8-Q9 on top of W8-A4; part a's push was 64cdf803: W8-Q1 `ec522179`, Q2 `610b977e`,
Q3 `a6b48dfa`, Q4 `64cdf803`).

### What was built

| # | what | files |
|---|---|---|
| Q5 | **设置 during an underground Metro ride.** The subway layer (z 40, the whole screen) covered the HUD's Settings button and the phone bar's 更多 → 设置, and a phone has no Esc: the layer's card now carries a 44 × 44 设置 button (top-right of the line row) that opens the same Settings panel (it pauses; W7-B3 already lifts sheets to z 41). The **album, a resident's letter and the goals step** (z 34–36) opened during the ride now show above the tunnel (z 42 while the layer is on). | `ui/SubwayOverlay.tsx` (`onSettings`), `ui/LineRideLayer.tsx`, `ui/transit-ui.css` |
| Q6 | **The map's tools at 44 px on touch.** Zoom in / out, find me, whole city, the route, the legend and the compass are 44 × 44 circles on a coarse pointer (they were 36 × 36 circles with a 44 px `::before`); `CityMap.tsx` reserves the column they need (one column from a 340 px frame, 56 / 106 px wide) so labels and framings keep clear; fine pointers keep 36 px. The waypoint's **隐藏 ×** (24 × 24) gets a 44 × 44 touch area. | `ui/map-w4.css`, `ui/CityMap.tsx`, `ui/guide-ui.css` |
| Q8 | **The goals step in short landscape.** At 844 × 340 the card needed ≈ 408 px: **我自己逛 sat below the screen** (y 358–404) and the gold button was cut. Under 460 px tall and ≥ 560 px wide it is two columns (BAYBAY's line + goal #1 left; the list scrolling above the two buttons right). | `ui/goals-step.css` |
| Q9 | **The skyline quiz on a phone** (W7-W2's open 390 × 844 shot): the three names lay over the right-hand touch column (跳 / 飞 / the action button peeked out round them and could not be pressed): the column steps aside while the names are up (a hop or a step ends the quiz anyway). | `opus-bay.css` (one `:has` rule) |

### Evidence

- Measured live on dev 5802 (touch, city, `?start=free&save=off`; scratch `sub.mjs`, `maptools.mjs`, `land.mjs`, `sky.mjs`:
  rects + `elementFromPoint` at each control's centre):

  | where | before | after |
  |---|---|---|
  | 390 × 844, M Ocean View under Market St | 更多 hit `.ob-subway-tunnel`; no way to Settings | 设置 44 × 44 on top → Settings opens over the tunnel (已暂停) |
  | same ride: album / letter / goals step | each hit `.ob-subway-tunnel` (rule switched off) | all three on top |
  | 390 × 844 map | tools 36 × 36 (W7-I) | compass + 5 tools 44 × 44, one column, in the frame, 0 overlaps, 0 of 14 labels under them |
  | 375 × 667 map (307 px frame) | — | two columns of 44, 0 overlaps, 0 labels under them |
  | 1440 × 900 map (mouse) | 36 × 36 | 36 × 36 (unchanged) |
  | the free-roam hint's × | 24 × 24 | hit 20 px right / up / down and 18 px left of its centre |
  | 844 × 340 goals step | gold 296–350, **我自己逛 358–404** of 340 | 211–259 and 267–311, both on top |
  | 667 × 320 goals step | — | 191–239 and 247–291, both on top |
  | 390 × 844 skyline names | the touch column peeking out round the names | the column hidden while they show; names 16–375 × 588–748 on top |
  | 390 × 844 Union Square | — | the arrival card 294 × 111 and the HUD: 0 covered; the place card fine |

  Shots read (scratch `C:/Users/willy/opus-qa/w8/q/b/`): `after-390x844-metro*.jpg`, `after-375x667-map.jpg`,
  `before|after-844x340-gstep.jpg`, `p-|after-390x844-skyline.jpg`, `after-390x844-union-*.jpg`. Key shots in
  `docs/opus-bay/qa/w8/Q/`: `b-phone-metro-settings-button.jpg`, `b-phone-metro-settings-open.jpg`,
  `b-land-844x340-goals-step-before.jpg` / `-after.jpg`, `b-phone-skyline-before.jpg` / `-after.jpg`, and part a's
  `a-phone-en-event-card-where.jpg` (Where: Outside the Ferry Building · Ferry Plaza · San Francisco).
- Tests: new `tests/opus-bay-w8-q-phone.test.ts` (5: the subway button renders / calls / English label; the layer's
  wiring and the z rules; the map's coarse sizes and the column arithmetic against `city-ui.css`; the goals step's
  landscape grid; the skyline rule and the classes it names). CSS-only fixes are pinned by these rule tests (no node test
  can lay CSS out); the live numbers above are the behaviour.
- Checks of the pushed tree: the full suite **1726 / 1726** on the part-b tree before the last two rebases (Q5–Q7 on
  W8-M2); after them tsc 0, `eslint . --quiet` exit 0 (0 errors), the incoming lanes' tests + mine 57 / 57, 71 / 71, the
  busk test 6 / 6; after the push the incoming W8-H7 / K5 / S4 / A tests + mine 57 / 57.

### Decisions

- **The free-roam goals card over the lead chip at 844 × 340 (W7's item) is not reachable in the city any more:** since
  W5-C3 the city shows the goals step once instead of the card (`flow.startFree`: the card only when the step's chunk
  failed to load), and BAYBAY's free lead is a one-leg trip, during which the card is folded (`Overlay.tsx goalsOn`
  requires no trip). The step itself was the real short-landscape problem (Q8). No guard added for the fallback.
- Hiding the touch column under the skyline names (visibility only) rather than moving the names: the quiz ends on a
  hop or a step (`cancelOnMove`), so nothing is lost, and lane W2's / M's card code stays untouched.
- The Metro button sits on the card (not a corner of the tunnel): the strip across the top is the ride's map, the card
  is already the layer's control surface (下车 / 直接到站).

### Not done (part b)

- The area pill at Union Square reads 金融区 · 南滩 · Geary Street while the card's eyebrow says 联合广场 · 市中心 (two
  naming schemes; SF's "Financial District/South Beach" analysis neighbourhood does contain Union Square) — lane K's
  data, noted under Requests, not changed.

## Part c (22:10–23:20 PDT): the iOS-size overlap scans on wave 8's new overlays

### What was built

| # | what | files |
|---|---|---|
| Q11 | The skyline quiz also hides the **arrival card** while its names are up (at 390 × 664 / 375 × 553 the Twin Peaks card's 看介绍 / 拍照 / 关闭 sat between the names). | `opus-bay.css` (the W8-Q9 rule) |
| Q12 | **The play chip in landscape**: between 601 and 1080 px wide (a phone in landscape, a small tablet) the chip centred at the top lay over the area pill and the objective pill (667 × 320: 打开旅行本 under its 不玩了) — it drops under them (top 64 px); in short landscape the skyline's names sit 12 px over the bottom so they clear it. | `opus-bay.css` (`!important` only for the names' inline box) |
| Q13 | **`scripts/opus-sf/qa/overlap-scan.mjs`** — the reusable phone overlap scan (header: usage, surfaces): iPhone UA + touch at 390 × 664, 375 × 553, 667 × 320, 844 × 340; the goals step, HUD, Settings, the skyline quiz, the busker jam, the Metro layer, the Alcatraz ride card, the grip game; covered / off controls at the top and with scrollers at their end. `lang-scan.mjs` gains the busk and ferry screens. | new / `lang-scan.mjs` |

### Evidence (dev 5802, `?date=2026-10-02T11:00&halloween=1`, scratch `ov1`–`ov4`, `scan8`)

| surface | 390 × 664 | 375 × 553 | 667 × 320 | 844 × 340 |
|---|---|---|---|---|
| goals step (fresh save) | 0 / 0 | — (W7-I's fix) | 0 / 0 after Q8 | 0 / 0 after Q8 |
| HUD · Settings (top + end) | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| skyline quiz | arrival card under the names → Q11 | same → Q11 | 打开旅行本 under the chip's 不玩了 → Q12 → **0** | 转过去 under the chip → Q12 → **0** |
| Metro layer (+ its 设置) | 0 | 0 | 0 | 0 |
| Alcatraz ride card (Pier 33, waiting) | 0 | 转过去 under the ride banner | 0 | 转过去 under 不坐了 |
| busker jam | panel not laid out (below) | | | |
| grip game | no car within 3 min (below) | | | |

(covered / off counts of controls; "0" = none.) The English language scan of the new overlays (390 × 844, by day):
hud, busk, ferry, canvas — **0 leaks**, 0 page errors; the ferry card reads "Waiting for the ferry… ~130s · Cancel · Skip
to stop".

### Not done (part c)

- **The busker jam's panel and the grip game's panel** were not laid out by my headless runs: the jam stops at once when
  the player is off its 1.5 u ring (a teleport lands beside it), and no Powell–Hyde car came within 3 minutes for the
  grip. Lane M's own phone shots (W8-M2, W8-M4) and its reviewer cover them; the scan script has both surfaces for W8-I.
- **The waypoint's edge arrow (转过去) under the ride banner / the play chip** at 375 × 553 and 844 × 340: the arrow is
  clamped to a fixed top inset (`game/waypoint.ts waypointSafeArea`, lane K) while the ride banner / chip reach lower —
  a request to lane K (below), not changed here.

## Requests

- **Lane K** (`game/waypoint.ts waypointSafeArea`): the waypoint's edge arrow 转过去 is clamped to a fixed top inset
  (`WAYPOINT.phone.top` / `desktop.top`) while the ride banner (a ferry / cable-car wait card in the top stack) and the play
  chip reach lower: the overlap scan found the arrow's centre under the Alcatraz wait card at 375 × 553 (`.ob-ride`) and
  under its 不坐了 at 844 × 340. Suggest: the safe area's top = the lowest bottom of the top stack / the play chip when
  they show (the label already hides when covered: `data-covered`), or the arrow skips a covered top edge.
- **Lane K** (`data/cityZones.ts`, optional): at Union Square the area pill reads 金融区 · 南滩 · Geary Street while the
  place card's eyebrow says 联合广场 · 市中心 — both right by their own schemes (SF's analysis neighbourhood
  "Financial District/South Beach" contains the square), but a player standing on the square may read the pill as wrong.
- **Site editors (GPT, via the owner)**: the site's English dictionary lacks `venue-exploratorium-daytime`'s title
  ("Exploratorium · 日间科学探索馆") and the summaries of `venue-exploratorium-daytime` and
  `restaurant-gotts-ferry-building` (`/planner-catalog.json`): the game no longer shows them in Chinese (catalogText keeps
  the Latin part; neither summary is on a game card), but the site's own English pages would.
- **W8-I / W8-Z**: re-run both scans once every lane has landed — `node scripts/opus-sf/qa/lang-scan.mjs --port <p> --lang
  en --mobile` and `--lang zh-Hant`, `--query '&halloween=1&date=2026-10-02T11:00'` for the ferry, and `node
  scripts/opus-sf/qa/overlap-scan.mjs --port <p> --shots`; read `leaks` / `covered` / `off`.

## Final state (23:25 PDT)

- Commits on `origin/opus-bay` (all pushed): W8-Q1 `ec522179`, Q2 `610b977e`, Q3 `a6b48dfa`, Q4 `64cdf803` (part a);
  Q5 `3397754f`, Q6 `243c9722`, Q7 `6a02bdae` (report a), Q8 `106d70fa`, Q9 `18fa17c6`, Q10 `05b15d80` (report b + shots);
  Q11–Q13 pushed as `64c32397` (the ids after the last rebase: see `git log origin/opus-bay --grep W8-Q`); this report's
  part c and final state is the last commit.
- The W7 iPhone work is untouched: `audio/unlock.ts`, the voice clip cache, `ui/glHealth.ts`, the album's in-app path
  (none of these files changed in wave 8 by this lane).
- District mode: one English label (`DistrictRecap.tsx`'s plan label, Q1); the city map's tools, the subway layer, the
  skyline quiz and the goals step are city surfaces. Two rules are mode-blind and reach the district only on a touch
  screen or a 601–1080 px window: the waypoint ×'s 44 px touch area (Q6, coarse pointers) and the play chip under the
  pills (Q12) — the same overlaps exist there; the hero view (1440 × 900, the regression test in the suite) is unchanged.
- **Final checks** (the tree of `64c32397`, W8-Q13 on origin; Q14 adds this report only): `npx tsc -p tsconfig.app.json
  --noEmit` 0 · `npx eslint . --quiet` exit 0 (0 errors; the 50 old warnings) · the full suite
  `tests/opus-bay-*.test.ts` **1802 / 1802 pass, 0 fail** (23:05–23:35 PDT, under the wave's load).
- Dev server 5802 stopped; no Chrome of this lane left running.

## Review (Ultra)

### 给主人的摘要

- Q 线的复查做完了（00:34–01:40 PDT）。两位检查员一共报了 8 个问题，我逐个在手机尺寸上重现：8 个全部属实，8 个都已修好。
- 手机横屏时：叮当车「拉闸」小游戏原来被乘车条盖住看不到（M 线的复查已经先修好，我确认了效果）；打开地图时左上角几个条叠在一起，现在会让开；地铁卡片不再盖住站名；小游戏顶部的条不再被提示消息压住。
- 地图上的「隐藏 ×」按钮恢复成第 7 波更大的触摸范围；手机上地图卡片打开时，右边工具按钮变两列，地名会自动让开。
- 给后面复查用的手机遮挡检查脚本也修好了：每个尺寸都会重新检查目标卡，叮当车会从车站出发，被盖住的游戏画面也会被发现。
- 全部检查通过：类型检查 0 错误，eslint 0 错误，测试 1834 个里 1832 个通过；唯一没过的是一个计时测试（机器忙时才会慢），单独重跑 24/24 全过。没有任何阻挡上线的问题。

### How the findings were checked

One headless Chrome at a time (touch emulation, an iPhone UA, `?world=city&start=free&save=off&quality=mid&date=2026-10-02T11:00`),
dev server 5842 on this worktree, a probe script in scratch (`C:/Users/willy/opus-qa/w8/q-rev/probe.mjs`: cases chip / grip / map /
metro / mapcard) that reproduces each lens's steps and reads the rects; shots `before-*.jpg` / `after-*.jpg` / `rebased-*.jpg` in
`C:/Users/willy/opus-qa/w8/q-rev/` (scratch, not shipped), every one looked at. Every fix has a test in
`tests/opus-bay-w8-q-review.test.ts` (7 tests: all 7 red on `origin/opus-bay` 017fe6ee, green after).

| id | sev | verdict | evidence (before → after) |
|---|---|---|---|
| Q-PL-1 grip game under the ride banner (short landscape) | major | **fixed** (by W8-M-review, already on origin when this review rebased; verified) | Before 844x340: banner [49,70,795,178] over the canvas [213,76,631,227] (`before-grip-844x340.jpg`: the game is blind). This review's own fix (hide the banner, a 34vh canvas) conflicted on rebase with W8-M-review's two-column panel (`sfgames8.css`: the canvas beside its controls, the banner kept in view); lane M's kept, mine dropped. Rebased probe: 844x340 banner to y 128, panel from 175, canvas [113,196,417,305], 放弃 / 摇铃 / 拉闸 all hit-tested ok; 667x320 banner to 146, panel from 155. Test Q-PL-1 pins lane M's layout and that nothing hides the banner. |
| Q-PL-2 HUD pile-up left of a side sheet (map, 844x340) | major | **fixed** `49c5c788` | Before: objective [10,16,256,67] over the area pill [16,17,202,53], the gear on its right end, the bubble at x −93 (`before-map-844x340.jpg`). `opus-bay.css` `@media (min-width: 721px) and (max-height: 500px)`: `.ob-overlay.has-sheet :is(.ob-area, .ob-objective, .ob-waypoint, .ob-bubble-anchor) { visibility: hidden }` (phones ≤ 720 px already hide the waypoint and bubble under a sheet). After: no pill, the gear clear, no clipped bubble (`after-map-844x340.jpg`). Pre-existing (the wave-4/5 side-sheet layout), not caused by W8-Q6; fixed since it is a phone held sideways. |
| Q-PL-3 Metro card over the station strip | minor | **fixed** `49c5c788` | Before: card [192,33,652,244] at 844x340 over 市政中心站 / Van Ness 站 / 教堂街站 / 卡斯特罗站 (4 of 9). `transit-ui.css` under 480 px tall: the card 6 px over the bottom, max-height `100% − 106px` (scrolls inside if ever needed). After: 844x340 [192,121,652,332], 667x320 [104,104,564,312], 0 labels under the card; 设置 still 44x44 (`after-metro-667x320.jpg`). |
| Q-RC-1 play chip in the top stack's band (601–1080 px) | minor | **fixed** `49c5c788` | Before 844x340: chip [225,64,619,118], toast [307,70,537,111] inside it, objective to 67. After: chip at 72 px [225,72,619,126]; `.ob-overlay:has(.ob-play-flight) .ob-topstack` at 134 px → toast [307,134,537,175]. The play-result rule (281 px, more specific) still wins when both show. |
| Q-RC-2 waypoint × touch area shrank | minor | **fixed** `a61297d1` | Code: wave 7's `.ob-waypoint-dismiss::before { inset: -10px -4px -10px -16px; border-radius: 12px }` (a 44x44 rounded rectangle, every pointer) was overridden on coarse pointers by W8-Q6's 44 px circle (≈ 1520 vs ≈ 1812 px², −16%). W8-Q6's rule removed (it was mode-blind too: the district gets wave 7's × back); the W8-Q6 test now asserts wave 7's rule and no override. |
| Q-RC-3 map tool column vs a pinned card | minor | **fixed** `a61297d1` | Before 390x844, Coit pinned: cap 248 px, five 44 px tools need 252 → the legend wrapped to a second column, no `is-two`, toolRight 56. `CityMap.tsx`: `toolsFitOneColumn(count, coarse, toolsMaxHeight(h, true))` → state `toolsWrapPinned` → `tallTools` false → `is-two` and toolRight 106 (fine pointers 90: also the older six-tool route case). After: tools [266,274,362,474], class `ob-citymap-tools is-two`. |
| Q-RC-4 overlap scan checks the goals step at the first size only | minor | **fixed** `c4311116` | Reproduced: `--sizes 390x664,844x340` gave gstep rows for 390x664 only. Now `Storage.clearDataForOrigin` before each size's load; a step that does not open is a `missing: true` row; the header names `overlap-<lang>.json`. Re-run: gstep:top / gstep:end at both sizes, 0 covered, 0 off. |
| Q-PL-4 overlap scan's grip surface | minor | **fixed** `c4311116` | The surface now stands at the line's first stop's station before riding (a car came in ≈ 20 s, as the lens said; a 90 s wait) and a `canvas` counts as a control, so a covered game board is reported. |

### Own pass (`git log --grep "W8-Q[0-9:]"`, 15 commits)

- **No softlock found.** The skyline rule hides the move column, but the stick and the chip's 不玩了 end the quiz
  (cancelOnMove); the Metro 设置 opens the same Settings sheet (z 41 over the tunnel) and closes back to the ride; the goals step
  in short landscape keeps both buttons on screen (overlap scan re-run at 844x340: 0 off).
- **District mode:** the hero view (1440 x 900) is untouched by every lane-Q and review rule (the hero regression test passes in
  the full suite). Mode-blind rules remain, as lane Q reported: W8-Q12's chip at 72 px and this review's top-stack companion
  (601–1080 px wide only), and the Q-PL-2 sheet rule (short landscape only). `.ob-overlay` carries no city class, and in the
  district they fix the same HUD collisions. Decision: left; Q-RC-2's removal gives the district its wave-7 × back.
- **Perf:** CSS plus one `useEffect` in CityMap that runs when the pinned-wrap state flips; no draw-call change.
- **Live date tonight (Oct 1):** nothing date-dependent in lane Q's work; the probes ran with `?date=2026-10-02T11:00`.
- **QA lesson (for W8-I / W8-Z):** after editing source with the dev server running, a probe that imports `/src/...` modules can
  get a second instance of an HMR-invalidated module (startGrip returned true and no panel ever showed). Restart the dev server
  before a probe run; both "no panel" runs here were that, not a defect.

### Open items (none blocking)

- `CityMap.tsx` `firstOpenView` still frames the first view with the frame-height column (`toolColumn`) when a card is pinned on
  open; labels and later framings use the corrected toolRight. Cosmetic.
- At 667 x 320 the one-time first-visit time offer (top stack, ≈ 70–120 px, 10 s once per session) can still touch the top
  ≈ 20 px of the Metro card if a ride starts within its 10 s.
- Lane Q's request to lane K (the waypoint edge arrow under the ride banner / play chip at 375 x 553 and 844 x 340) stands.

### Checks

- `npx tsc -p tsconfig.app.json --noEmit` 0 (after the last rebase) · `npx eslint . --quiet` 0 errors.
- Full suite `tests/opus-bay-*.test.ts` on the fixes (01:10 PDT, under the wave's load): **1832 / 1834 pass**, 1 fail = the
  wall-clock test "a cached cell is cheap" (`opus-bay-sf-move2.test.ts`), green alone (24 / 24); after the last rebase the
  brought-in and touched tests 80 / 80.
- Commits on origin: `49c5c788`, `a61297d1`, `c4311116`, `f7a0a6d5` (+ this report). Dev server 5842 stopped, worktree removed.

### Blocking the go-live to main

Nothing.
