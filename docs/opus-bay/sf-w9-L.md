# Wave 9 · lane L · language & search

Lane L of wave 9 (plan `docs/opus-bay/sf-w9-lead.md` §3 L; review `docs/opus-bay/review-2026-10-01-first-use.md` R§5 #11,
R§6 语言与本地化). Worktree `C:/Users/willy/wt/w9-l` (branch `w9-l`), dev port 5906, scratch `C:/Users/willy/opus-qa/w9/l/`.
Times PDT, 2026-10-01 → 10-02.

## 给主人的摘要

1. **繁體搜索修好了**：地图搜索里输入「金門大橋、博物館、漁人碼頭、N 線」等繁体字，以前全部「沒找到」（评测里 19 个词只有 1 个能搜到），现在 19 个全都能搜到，和简体搜索结果完全一样；输入框里的示例词和 4 个建议词也都能用。
2. **搜索能找到小游戏和节日活动**：搜「螃蟹 / 抓娃娃 / 雾笛 / 风筝 / 酸面包 / 算命 / 街头艺人」等（中、繁、英都行）会直接列出对应的小游戏，点一下就带你去（或在原地直接开始）；搜「万圣 / Halloween / 讨糖」会列出 6 条讨糖街和 10 月 31 日唐人街万圣节庆典。搜「claw」不再出现「法学院」。
3. **繁體文字更自然**：修好了「馬里納區 → 馬裡納區」「小傢伙 → 小傢夥」「花崗岩 → 花崗巖」这类二次转换的错字（全游戏 5,080 句中文逐句验证）；游戏页里用台湾惯用词：設定、資訊、義大利、帶小孩、滑鼠、選單、搜尋，「旅行本裡」「海裡」，长度写「公尺」。网站其他页面不受影响。
4. **小字修正**：一日游路标「Welcome Center」改成「金门大桥游客中心」；英文小游戏标题「What’ s that?」中间的空隙去掉；65 岁以上免费 Muni 的来源改为 SFMTA 英文官网（2026-10-01 核对）；Exploratorium 和 Gott’s 两条网站目录在英文页不再出现中文。

## Part a — the map search (R§5 #11, lane L (1))

### What was built

- **繁體 search** (`data/sf/placeSearch.ts`): every name, alias and query goes through NFKC, then the site's
  `simplifySearch()` (`src/i18n/locale.ts`: opencc's TS dictionaries, already in the site's entry chunk), then lower
  case. The word-start rule (`wordsOf`) and the category words use the same fold, so 博物館 is the museum category.
  The chips set the displayed text (金門大橋 in 繁體): it is folded like a typed query, so no back-fill to Simplified was
  needed (decision: the input keeps the reader's script).
- **No more cross-word Latin substrings**: the old normaliser removed spaces, so "claw" matched "uc law" in "UC Law San
  Francisco". A Latin query's substring now has to sit inside the names' word gaps (`spacedSearch`); "law" still finds
  UC Law; prefix matches without spaces ("goldengate") still work through the prefix rule.
- **Games and events** (new `data/sf/searchSpots.ts`, pure data): 20 game spots — 抓娃娃机, 算命婆婆, 捞螃蟹 (Pier 7),
  捏酸面包, 雾笛对答 (Fort Point), the two buskers (Haight, 24th St), 放风筝 (Marina Green), 纸板滑梯, the three stair races,
  数海狮, 烤棉花糖, 叮当车摇铃 · 拉闸, 嘿咻推转盘, 飞盘, 沙滩球, 那是什么？, 捉迷藏 — each with zh and en aliases (繁體 is folded:
  釣螃蟹 = 钓螃蟹), the point copied from its play module (pinned to the source constants by the test, so the map chunk
  does not import the play modules), and goTo's id (the registered `play:…` interactable, else an attraction). The
  six trick-or-treat streets while the Halloween season runs (1–31 Oct; each point = the street's first standing
  door's knock spot), and the realsf calendar rows ahead (visible, with a place, starting within 60 days: the Chinatown
  Halloween Festival 10 月 31 日 · Waverly Place, Fleet Week …).
- **Two new result groups** 小游戏 / Games and 节日活动 / Events (bonus −1.5); they come before 景点 only when their best
  hit beats the sights' best (螃蟹 → 捞螃蟹 first, then 渔人码头; 金门大桥 → the bridge first). Ties: the calendar's dated
  rows before the streets.
- **The map list** (`ui/CityMapList.tsx`, lane G's file: surgical, the search rows only): a row per spot (game pad /
  party icon, name, where) with the usual go button; a tap runs the game's 问 BAYBAY item when it is offered where the
  player stands (kite on the lawn, frisbee, hide & seek …), else goes there.

### Evidence

- `tests/opus-bay-w9-l-search.test.ts` (4 tests). Before / after on the same index: the planner's 繁體 list + the
  placeholder words + the chips found **1 / 19 → 19 / 19** and each ranks exactly as its Simplified spelling; "claw" →
  `uc-law-sf` before, never after. Every game alias (zh, 繁體, en) puts the games group first with the right game; 万圣 /
  萬聖 / Halloween / 讨糖 / trick or treat → the 6 streets (+ the festival); on 10 Nov none.
- Played on the dev server (5906, `?world=city&save=off&lang=zh-Hant`, 1440 × 900, `C:/Users/willy/opus-qa/w9/l/probe1.log`):
  金門大橋 → 金門大橋 (景點), 金門大橋 · 遊客中心 (車站); 螃蟹 → 小遊戲 撈螃蟹 · 7 號碼頭 then 漁人碼頭; claw → 抓娃娃機 · 機械博物館 only;
  霧笛 → 霧笛對答; 萬聖 → 萬聖節 and 唐人街萬聖節慶典 (10 月 31 日), then the six 討糖 streets, each with its go button.
  ![萬聖 in the map search](qa/w9/L/search-hant-halloween.jpg)
- `tests/opus-bay-sf-attractions.test.ts` + `sf-places` 32 / 32 (the old search tests, the group order for "castro").

### Decisions

- `data/sf/places.ts normalizeQuery` / `PlaceIndex.search` left as they were: nothing in the game calls them (only two
  old tests); folding there would add bytes to GameRoot (≈ 0.2 KB of room) for no player.
- Anywhere-games (frisbee, beach ball, 那是什么？) carry a default place (Dolores Park, Ocean Beach, Twin Peaks) for the go
  button; hide & seek has none (its row only starts it when 问 BAYBAY offers it).

## Part b — 繁體 quality and words (lane L (2) + (3))

### What was built

- **The site's cn → tw converter is safe to run twice** (`src/i18n/locale.ts taiwanConverter`, surgical). opencc keeps
  a phrase it knows (马里纳区 → 馬里納區), but a second pass over its own output goes character by character (馬裡納區,
  小傢夥, 花崗巖, 裡維拉, 裡士滿區) — and the site does convert twice: the game's `pick()` output is a JSX child that
  `i18n/host.ts` converts again. Each conversion now checks its output; when a second pass would change it, the text's
  phrases are added to the trie as themselves, so the JSX pass leaves them alone. One extra pass per string (a full scan
  of opencc's 49k phrases at load measured 120–1,370 ms here: rejected).
- **Taiwan words on the game page** (`TAIWAN_WORDS`, applied when `location.pathname` is `/opus-bay`): 設定, 資訊, 義大利,
  影片, 網路, 帶小孩, 滑鼠, 選單, 搜尋, 記憶體, 資料, 公車 / 轉運中心, 帳號, 低音管, 史特勞斯 …; 裡 where 里 means "in" and
  opencc keeps 里 (旅行本裡, 遊戲裡約, 隧道裡, 放回海裡 / 掉進海裡 / 看海裡 — w8 W2-P2's lines); 阿什伯里; metres as 公尺
  (227 米 → 227 公尺; never 米飯 / 米色 / 米其林). The rest of the site reads as before (its own tests pin 收起設置).
- **Words**: the Welcome Center's place name 金门大桥游客中心 / Golden Gate Bridge Welcome Center (`PLACE_NAME_FIXES`,
  surgical: the Grand Tour's beacon read "Welcome Center · 约 12 秒" in Chinese); English in the Noto-first font stacks
  of the play chips / cards / panels (`opus-bay.css`, surgical, next to W7's D9 line: "What’ s that?" had Noto Sans
  SC's full-width ’); the seniors' free Muni cites https://www.sfmta.com/fares/free-muni-seniors-ages-65 (the site row's
  sourceUrl; re-read 2026-10-01: "All San Francisco seniors, ages 65+, with a gross annual family income at or below
  100 percent of Bay Area Median Income level are eligible", apply first, cable cars included) and `export-live.ts`'s
  `sourceEn` override is gone (lane R's file, surgical; `live.json` and `public/baybay-guides(.en).json` re-exported:
  the URL / that row's date only); `src/data/planner-en.json`: venue-exploratorium-daytime's title ("Exploratorium ·
  Daytime science museum", as `src/lib/planner-copy.ts` words it) and summary, restaurant-gotts-ferry-building's summary.

### Evidence

- `tests/opus-bay-w9-l-hant.test.ts` (4): the stock converter is non-idempotent on the 6 review cases (kept as an
  assertion) and the new one stable; all **5,080** Chinese literals of `src/opus-bay` convert once and stay, with and
  without the words (stock: 26 moved on a second pass); the words, 裡, 公尺; `translateText(pick(x)) === pick(x)`; the
  words only on /opus-bay.
- `tests/opus-bay-w9-l-words.test.ts` (4): every Noto-first selector has its English line (7 were missing); the
  Welcome Center; the seniors' source in the site row, live.json and the guides with no override; the two catalog rows
  have no Han in English.
- Site tests green: search-cold, regional-landmark-photos, attractions-expanded, coverage-audit-sf-north,
  editorial-media-coverage, september-refresh-content, browser-locale, profile-personal-space, home-discovery,
  local-discovery, outings-ui, planner-copy + opus-bay w5-lang, w5-lang-review, w6-k2-content, w8-q-lang, w8-p-review,
  w5-calendar.

### Not done / handed on

- **Time-of-day words** (review: 黄昏 / "Golden hour" at 8 am): the time bark (`game/brain.ts`) and the Halloween dusk
  line follow the *rendered* light, which a first visit forces to golden hour; lane F's item (3) gives the real Bay
  time after the 4-way choice, which fixes both. Re-checked in part c.
- 「1–30 October」 on the Halloween page: done by lane H (W9-H1 `28a4e9ad`, its item (2)).
- The photo frame's caption font (`game/photo.ts` lines 65 / 119, lane S's file) is Noto-first too: an English caption
  with ’ has the same gap. Left to part c / lane S (S is changing that file tonight).
