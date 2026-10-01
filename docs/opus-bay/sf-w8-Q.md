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
