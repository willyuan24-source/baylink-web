# Wave 8 · lane Q · phone UI & words

Worktree `C:/Users/willy/wt/w8-q` (branch `w8-q`), dev port 5802, scratch `C:/Users/willy/opus-qa/w8/q/`, QA images
`docs/opus-bay/qa/w8/Q/`. Brief: `sf-w8-lead.md` §3 row Q (run as the Ultra workflow, §7). A first agent of this lane
worked 18:55–19:20 PDT and was stopped only by the switch to the workflow; this agent resumed its work (below).

## 给主人的摘要

1. **英文版不再夹中文**：之前英文「带去 BAYLINK 安排」那句会夹着中文站名（宣传片里拍到的），现在名字都是英文；顺带又找到并修好三处：旅行本「今天」页的活动地点（"2nd Street（Market 至 Howard 段）"）、活动卡片「地点」一栏（"Ferry Building 外"）、手帐「城市之声」页的 "Tap 听一听"。
2. 做了一个**自动语言检查脚本**（`scripts/opus-sf/qa/lang-scan.mjs`）：用无头浏览器把标题、HUD、地图、搜索、地点卡、活动卡、这周去哪、问 BAYBAY、旅行本每一页（含手帐的五个小页、万圣节页）、小铺、相册、设置、小游戏结果卡、万圣节明信片、缆车卡、地铁、到达卡都打开一遍，英文里找中文、繁体里找简体字。现在英文 54 个画面 0 处、繁体 54 个画面 0 处。之后的整合测试和最终验收可以直接再跑。
3. **手机坐地铁（地下）时也能打开设置了**：地铁画面盖住了设置按钮，手机又没有 Esc 键；现在地铁卡片右上角有一个齿轮按钮。地铁里打开相册、居民来信、目标卡也会显示在隧道画面上面（以前被盖在下面看不见）。

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
