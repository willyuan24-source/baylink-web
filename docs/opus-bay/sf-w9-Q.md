# Wave 9 · lane Q · phone & layout

Worktree `C:/Users/willy/wt/w9-q` (branch `w9-q`), dev port 5911, scratch `C:/Users/willy/opus-qa/w9/q/`, QA images
`docs/opus-bay/qa/w9/Q/`. Brief: `sf-w9-lead.md` §3 row Q; the first-use review's 界面与交互 rows (R§6), `sf-w8-summary.md`
§6 #9, the phone reviewer's notes (`C:/Users/willy/opus-qa/review-1001/phone/`, `verify-phone/`).

## 给主人的摘要

1. **电脑上打开地图/旅行本时，右下角的按钮不再“跳位置”**：以前一打开侧边面板，横排的按钮会变成竖排挤到面板旁边；现在仍是同样的横排，只是跟着面板平滑地往左挪。坐叮当车时打开地图，底部“车厢里 · 下车”提示条不再钻到面板下面、也不再盖住 BAYBAY 按钮。
2. **旅行本标签不再被截断**：七八个标签（今天、手帐、万圣节、明信片、目标、想去、足迹，再加上这一波的「游乐」）改成两行排好，手机英文版也全部看得见。
3. **手机上的小按钮和小字**：这周传单上的「带我去」从 51×25 变成 56×44 的真按钮；手机上描述性的小字（目标说明、明信片提示、今天页说明、设置说明、传单地点等）统一不小于 13 像素；小铺里「国际橙」等长名字可以换行，不再被截。
4. **手机横过来（带地址栏的 844×340 / 667×320）**：问 BAYBAY 的菜单以前会长出屏幕顶端（前两项点不到），现在框住在屏幕里、选项在框内滚动；小手机横屏打开地点卡，以前底部两个大按钮占掉三分之二，现在并成一行，卡片内容能看到。
5. 坐车时横幅上的三个小按钮（铃声对答 / 探出身 / 拉闸）在窄屏会自动换行；地铁（地下）时不再弹出“看看此刻”的时间提示盖住地铁卡。

## Part a (21:36–23:05 PDT): w8 NEXT #9 and the review's UI rows

### What was built

Rows Q1–Q10 are the fixes (the tests in `tests/opus-bay-w9-q.test.ts` carry these numbers); the commits: **W9-Q1** = rows
Q1–Q3, **W9-Q2** = Q4, **W9-Q3** = Q5, **W9-Q4** = Q6, **W9-Q5** = Q7, **W9-Q6** = Q8, **W9-Q7** = Q9 + Q10, **W9-Q8** = the
tests, this report and the shots.

| # | what | files |
|---|---|---|
| Q1 | **W8I-D-2 · the map during a ride on a desktop.** The move chip (车厢里 · E 坐下 · WASD · Space 下车, centred on the window by an inline style) ran under the side sheet and over 问 BAYBAY at the foot of the HUD column. The chip gets a class and, with a sheet open, centres in the space left of the sheet as the prompt and the dialogue do. | `ui/MoveChip.tsx` (lane N's file, surgical: `className="ob-move-chip"`), `opus-bay.css` |
| Q2 | **The HUD never jumps** (R§6 "HUD 和这周去哪按钮会跳位置", planner/shots/008 vs 039). On a wide desktop (≥ 1181 px) the round buttons were a row at the bottom right and turned into a column beside a side sheet. In the city the row stays a row and slides left with the sheet (the objective pill slides the same distance: `right` is now in both transitions), so every button keeps its order and its height; the prompt and the move chip step up over the row. 721–1180 px already had a column in both states; the district keeps its column (the rule is scoped by the city's area pill `.ob-area-lines`). | `opus-bay.css` |
| Q3 | The one-time first-visit **time offer over the Metro card** (667 × 320, w8 Q-review open item): hidden while the underground layer is on (lane F removes the offer on a first visit this wave; the rule is harmless either way). | `opus-bay.css` |
| Q4 | **`RideBanner` `PAD_ROW` wraps** (lane M's wave-8 request): three pads on a Powell car could run into each other on a narrow phone. | `ui/RideBanner.tsx` (layout only) |
| Q5 | **The journal's tabs in two rows** (R§6 "旅行本标签栏溢出（足迹被截断）"): with five or more tabs the row was a sideways scroller with no hint — 足迹 cut at the right edge (390 px English: 575 px of tabs in 352). Now a grid: 3 columns up to six tabs, 4 up to eight (lane G's 游乐 makes eight), 5 beyond; icon over the words, a long label lets its count drop under it, 13 px labels. | `ui/content-ui.css` |
| Q6 | **The shop tile label** (w8 NEXT #9, lane H's note): 'Int’l Orange' was 3 px wider than its tile (72 / 75 px, ellipsed); a name may now take two lines; prices 13 px on phones. | `economy/economy.css` |
| Q7 | **The flyer's 带我去 ≥ 44 × 44** (R§6, verify-phone: 51 × 25): on touch screens it is a 56 × 44 button (13 px), the flyer 138 px tall so it stays under the date block and clear of the tags. | `ui/event-go.css` (lane R's file, surgical: an appended `pointer: coarse` block) |
| Q8 | **Running text ≥ 13 px on phones** (R§6): a census of every visible text node < 13 px on the HUD, the goals step, the journal's seven tabs, the map, a place card, Settings, the shop, Ask BAYBAY and the album at 390 × 844 found the goals' and 今天's sub-lines, the postcard hints, the 今天 note, the goals step's list and note, Settings' explanations, 足迹's sub-lines, the album's note and the flyers' place line at 12–12.5 px → 13 px; the 今天 source line 11.5 → 12. Labels on chips / badges / keycaps / counters and attribution keep their sizes (a decision, below). | `opus-bay.css` |
| Q9 | **Found here** — the Ask BAYBAY menu at **844 × 340**: 12 rows in two columns grew the dialogue box past the top of the screen (做个动作 / 捉迷藏 at y −47…3, BAYBAY's line above the screen). The box now stops 24 px under the top (safe area included) and its choices scroll inside it; in short landscape the text's reserved height shrinks and the phone's 30 vh cap on the choices is lifted (the box caps them). | `opus-bay.css` |
| Q10 | **Found here** — a place card at **667 × 320** (an iPhone SE on its side with Safari's bars): the footer (BAYBAY 攻略 over 加入想去, 136 px) and the head (100 px) left ≈ 44 px of the 280 px bottom sheet for the card. Under 460 px tall the bottom sheets' heads are compact and the place card's footer is one row (the guide link, two lines, beside the button). | `opus-bay.css` |

### Evidence

Probes on dev 5911 (`?world=city&start=free&save=off&quality=mid&date=2026-10-02T11:00`), one headless Chrome (a CDP daemon:
`C:/Users/willy/opus-qa/w9/q/daemon.mjs`, scripts `p-d2.mjs`, `p-phone.mjs`, `p-week.mjs`, `p-census.mjs`, `p-ride.mjs`,
`p-mapopen.mjs`); rects are CSS px; every image below was looked at.

| where | before | after |
|---|---|---|
| 1440 × 900, Powell–Hyde ride, map open (D-2) | move chip [493, 826, 947, 874] across the sheet's edge (868) and over 问 BAYBAY [792, 822, 852, 882] (covered); HUD a column | chip [207, 766, 661, 814]; the HUD row [462…852, 822…882]; 0 covered except the waypoint's 转过去 under the sheet (lane N/K's arrow, below) |
| 1440 × 900, journal open | HUD column x 912–968 from y 492 to 882; prompt [351, 822, 637, 874] | HUD row [582…972, 822…882] (the same row as without a sheet, 452 px to the left); prompt [351, 762, 637, 814] |
| 390 × 844 English journal | 7 tabs in one row, 575 px in 352 (足迹 cut, no hint) | two rows (4 + 3), 352 / 352, tabs 83 × 56 and 83 × 44; with an 8th (a registered dummy 游乐 tab) 4 + 4 |
| 390 × 844 shop, Rides | `Int’l Orange` 72 / 75 px | 0 overflowing labels |
| 390 × 844 week board (带娃 · 免费 · 都行) | 带我去 51 × 25 (the review) | 62 × 46 (56 × 44 tilted), 9 px under the date block, 2 px left of the tags; scan 0 covered / 0 off / 0 small |
| 844 × 340 Ask BAYBAY (12 rows) | 2 choices off the top (y −47…3) | 0 off; the box from y 24, choices scroll inside it |
| 667 × 320 Ask BAYBAY | 2 rows visible (the 30 vh cap) | 4 rows visible, the rest scroll |
| 667 × 320 Coit Tower card | footer 136 px of a 280 px sheet | footer one row (56 px); the photo and the facts scroll above |
| 390 × 844 English, Powell–Hyde ride | — | banner [12, 92, 378, 226]: Hop off · Skip / Bell riff · Lean out · Grip it on two rows, 0 covered |

Shots: `docs/opus-bay/qa/w9/Q/a-desk-ride-map-before|after.jpg`, `a-phone-en-journal-tabs-before.jpg` /
`-after-8.jpg`, `a-phone-flyer-go-after.jpg` (before: the review's `verify-phone/shots/s3-results.jpg`),
`a-land-844x340-ask-before|after.jpg`, `a-land-667x320-place-before|after.jpg`. The census rows (covered / off / small
controls, text < 13 px per surface) are `C:/Users/willy/opus-qa/w9/q/census-*.json`.

Tests: new `tests/opus-bay-w9-q.test.ts` (11: a small CSS rule reader + one test per fix Q1–Q10) — **10 / 10 red on
`f1460b0c`** (run on a `git archive` of that tree), green now; the touched files' older tests (`sf-guide-city`,
`sf-verify-c`, `w6-k1-dom`, `w8-p-review`, `w8-q-phone`, `w8-q-review`) 45 / 45.

### Decisions

- **The HUD row beside a sheet is city-only** (scoped by `.ob-area-lines`, the city area pill's own markup): the district
  keeps its column ("district mode never changes"); 721–1180 px windows were a column in both states already, so nothing
  jumps there.
- **"Body text ≥ 13 px"** = running text (descriptions, sub-lines, notes, hints). Labels on chips, tags, badges, keycaps and
  counters (11–12.5 px) and attribution / photo credits stay; fine print is ≥ 12 px. The phone bar's labels (11 px) are
  labels under icons and stay (they fit their 60 px buttons in English).
- **CityMap `firstOpenView` (w8 open item):** not changed. When the map opens on a target with a pinned card on a phone, the
  open target's `focusAt` replaces the first framing at once (`pickAttraction` / `pickPlace` / `pickStation`), so the
  first view's tool column is never what the player sees; at 390 × 844 the map opened on Coit Tower, the Painted Ladies and
  the Golden Gate Bridge put the selection above the pinned card and clear of the two-column tools
  (`C:/Users/willy/opus-qa/w9/q/shots/before-390x844-map-*.jpg`).
- The flyer's 带我去 grew its box (not only a pseudo hit area): the review measured the box, and a finger-sized visible
  button reads as a button.

### Not done (part a) / notes for other lanes

- The waypoint's edge arrow (转过去) sits under a desktop side sheet (1440 × 900, a ride with the map open) — the same
  family as wave 8's request to lane K (`game/waypoint.ts waypointSafeArea`, now lane N's file).
- At 390 × 844 the move column's 坐下 / Sit down label is wider than its round button (actors/TouchControls) — cosmetic.
- BAYBAY says 金色时刻 at 11:00 by day (lane F's golden-hour item).
