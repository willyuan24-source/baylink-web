# Wave 9 · lane H · Halloween night, Muertos, seasons

Lane H of wave 9 (`docs/opus-bay/sf-w9-lead.md` §3 H, run inside the Ultra workflow): worktree `C:/Users/willy/wt/w9-h`
(branch `w9-h`), dev port 5912, scratch `C:/Users/willy/opus-qa/w9/h/`, QA images `docs/opus-bay/qa/w9/H/`. Owns
`halloween/**` except `index.ts`, `season.ts`, `rewards.ts` (frozen), `realsf/dressing.ts`, `realsf/seasons.ts`, and the
big-night greeting in `realsf/todayLine.ts` (lane R's file, surgical).

## 给主人的摘要

1. 万圣夜（10/31 晚）老玩家回来时，BAYBAY 第一句就说「万圣节快乐！今天讨糖街家家都开门，糖果加倍……」，不再是通用的"日落 / 三件小事"；10/31 中午说唐人街庆典，11/2 傍晚说亡灵节游行。第一次来的新玩家玩过第一分钟后（约 90 秒）也会听到这句。
2. 万圣节页面不再写「10 月 1–30 日」，改成"整个 10 月都能讨糖，31 日万圣夜每家都开门、糖果加倍——还有 n 天！"。
3. 讨糖的门全部在游戏里实际走了一遍（电脑，10/31 晚 19:30）：从街上用摇杆走过去，44 扇门里有 4 扇按不到「敲门」，点地面自动走有 1 扇走不到。修好后 42 扇门全部能敲（2 扇夹在房子缝里、人物身体进不去的门撤掉，编号不变、存档不受影响；3 扇把「敲门」的范围放大一点）。
4. 新台词 3 句已交给 X 线配音（01:45 前已推送）。

## Part a · the big night played, the greeting, the page's words, every door walked up to (21:35 – 01:30 PDT)

### The big night as a player (31 Oct 19:30, dev 5912, `?world=city&date=2026-10-31T19:30`)

| what | desktop 1440 × 900 high | phone 390 × 844 dpr 3 mid | verdict / change |
|---|---|---|---|
| title | the Halloween key art (bats, pumpkins, the witch hat), greeting 嗨～这次我们逛整座旧金山！ (`ret/a-title.jpg`, read) | — | nothing says it is Halloween night today: the title's 「今天在旧金山」 strip is lane F's / R's `todayHeadline` (its calendar rows include the festival and the dressing day) |
| a returning player (a save at Alamo Square) | 欢迎回来！我们接着逛吧。 then **万圣节快乐！今天讨糖街家家都开门，糖果加倍，旅行本「万圣节」页能带你去～** at 7.1 s (`qa/w9/H/a-welcome-back-big-night.jpg`, read) | — | **fixed (W9-H2)**: before, the welcome line was the generic 旅行本「今天」里有今日三件小事 (the review's gap row; the test is red on the old `todayLine`) |
| a new player (save=off) at the Ferry Building | 0–85 s: 先去科伊特塔找鹈鹕朋友吧 / 城里的灯一盏盏亮起来了 / 送你一张飞行券 / idle lines — nothing about Halloween; **at 85.8 s the big-night line** (`inv/log`) | same | **fixed (W9-H2)**: a first visit is invited once after 90 s of play, ≥ 60 u from the place, never after a welcome back |
| the 万圣节 page → 带我去 Belvedere | 跟我来！我带你过去～, BAYBAY leads on foot (~2 min shown), a lantern found on the way (南瓜灯 1 / 40 · 渡轮大厦) | same | ok (the trip planner's choice is lane N's) |
| first time near Belvedere St | 今晚是万圣节！每家都开门，糖果还加倍！ then 贝尔维德街是城里最有名的万圣节讨糖街之一… (phone log 30.4 / 34.0 s) | same | ok |
| the knock (E / the 敲门 button) | 不给糖就捣蛋！, the door opens, candies fly into the bag, 新门 + 万圣夜加倍：巧克力 ×3！+10 金币 · 糖果袋 3 颗, 谢谢您！万圣节快乐！ | the 敲门 contextual button (`qa/w9/H/a-phone-knock-big-night.jpg`, read) | ok; on the phone the toast wraps with 颗 alone on its second line (minor, not changed: the toast's text is pinned by `tests/opus-bay-w7-g-polish.test.ts`); behind the player the follow camera does not show the door itself (lane C's camera) |
| the trick-or-treat postcard | 不给糖就捣蛋 2 / 4 opens after the first treat (`sweep/d-top2.jpg`, read) | — | ok (its illustration area is empty in a QA camera shot; F owns 'the postcard illustration stays until a tap') |

Not Halloween (other lanes', seen on the way): the idle pool said 要是我有口袋，一定装满酸面包。 at 30.2 s and again at 39.2 s
(`inv/log`: w8 NEXT #8, lane F's `brain.ts`).

### Every door walked up to (W9-H3)

Nobody had knocked the doors as a player: W8's door check walks a **0.3 u** disc on the published city, the player's
body is **0.45 u** (`actors/controller.ts PLAYER_RADIUS`). Three in-game sweeps over every live door (scratch
`sweep.js`, `sweep3.js`, `bfs.js`; 7 u straight out of the door = the start on the street / sidewalk):

| sweep | before (44 live doors) | after (42) |
|---|---|---|
| click-to-walk + the pending knock (`walkTo(knock, door)`; brain.ts knocks within radius + 3 once the path ends) | 43 / 44 answered — door 52's walk ended 4.56 u away | 40 / 42 in one full run; the two misses (12, 19) re-run alone 2 / 2 |
| joystick walk-up (the stick aimed at the knock spot every 150 ms after the click-to-walk ends) → the 敲门 prompt | 40 / 44 — door 4 1.33 u, 54 2.18 u, 10 2.56 u, 43 2.33 u | 41 / 42; the miss (50, 0.28 u the run before) re-run alone 1 / 1 |
| a BFS of the 0.45 u disc in the game from the knock spot to a roadway | door 43: none; door 10: a 39.5 u walk round the block | — |

Changes: doors **10** (Chenery) and **43** (Sea Cliff) `gone` (pockets; numbers kept, Chenery 9, Sea Cliff 7 live);
`TreatDoor.reach` (the prompt's radius) **4: 1.8, 52: 1.8, 54: 2.6** (behind a porch corner); `treat.ts knockRadius`.
w8 P2 **doors 22 / 26** (face a neighbour's wall straight out): both knocked in every sweep (click 2.6 s, joystick to
0.03 / 0.11 u) — no change needed. **Belvedere 4–7** (nearer a cross street's centreline): all four knocked; door 4 needed
the wider prompt; the place chip at door 5 still reads Alma Street (the place chip names the nearest centreline; the
prompt says 敲门 · 贝尔维德街的人家) — left as W7-G / W8-H accepted it.

### Words

- **「1–30 October」** (review R§6 language row): the 万圣节 page's season line is now `halloween/pageText.ts phaseLine` —
  整个 10 月都能敲门讨糖、找南瓜灯，天黑后门廊灯更亮。万圣夜（10 月 31 日）每家都开门、糖果加倍——还有 n 天！ / "All October: …
  On Halloween night (31 October) every door answers with double treats — n days to go!" (明天就是！ on the 30th; no
  countdown for a `?halloween=1` preview outside October). Page text, not voiced. Lane L's row also names this item: done
  here (H owns the file).
- **The big days' greeting** (`halloween/today.ts`, pure): 31 Oct 11:00–15:00 the festival, else the big night; 1–2 Nov
  the recorded `w6-h-muertos-hello`; 2 Nov 16:00–21:00 the procession. `realsf/todayLine.ts` (lane R's): 1 import + 3 lines
  at the top of `todayLine` (rebased onto R's `todayHeadline`, both kept). R's `todayHeadline` already covers 31 Oct with
  the calendar's festival row and the dressing day: not touched.

### New fixed lines (pushed 23:2x PDT in W9-H2; appended to `C:/Users/willy/opus-qa/w9/new-lines.md`)

| id | zh | en |
|---|---|---|
| `w9-h-today-festival` | 万圣节快乐！今天唐人街的 Waverly 巷有万圣节庆典，下午三点结束～ | Happy Halloween! Chinatown’s Halloween Festival is on Waverly Place today, until three o’clock. |
| `w9-h-today-big-night` | 万圣节快乐！今天讨糖街家家都开门，糖果加倍，旅行本「万圣节」页能带你去～ | Happy Halloween! Every treat-street door answers today, treats doubled — the Halloween page takes us there. |
| `w9-h-today-procession` | 今晚教会区有亡灵节游行，通常七点从 22 街和布莱恩特街口出发，以官网为准。 | The Día de los Muertos procession usually leaves 22nd & Bryant at seven tonight — check the official site. |

### Real-world facts (checked 2026-10-01)

- Chinatown Halloween Festival: https://www.cycsf.org/chinatown-halloween-festival/ — "Saturday, October 31, 2026, from
  11am-3pm", Waverly Place; arts & crafts, games, a pumpkin patch, a costume contest (children 0–11, teens 12–17, adults
  18+, families & groups). Unchanged since wave 8's read.
- The procession: wave 7's sources (SFMTA's 2025 route and time, 7 p.m. from Bryant & 22nd); 2026's times not published —
  the line says 通常 / usually and 以官网为准 / check the official site.

### Checks (part a)

- tsc 0 · `npx eslint .` 0 errors (50 warnings, the baseline) · the opus-bay suite on the W9-H1/H2 tree: 1874 pass, 1 fail
  (`E2-5 view field in the city`, the wall-clock "a cached cell is cheap": re-run alone 2 / 2), 1 todo (W8-P9's GameRoot
  ≤ 255 target) · after each rebase tsc 0 and the incoming lanes' test files (72 / 72, then 13 / 13) · W9-H3: the
  Halloween / treat files 85 / 85.

### Commits (part a)

| commit | what |
|---|---|
| `dbdb276d` W9-H1 | the 万圣节 page's season line: the whole of October + the countdown (was 「1–30 October」) |
| `716ecdec` W9-H2 | the big days' greeting (welcome back + a first visit's invitation), 3 new fixed lines, `festivalDate.ts` |
| W9-H3 | every door can be knocked: doors 10 / 43 gone, reach for 4 / 52 / 54 (this push) |
