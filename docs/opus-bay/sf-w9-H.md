# Wave 9 · lane H · Halloween night, Muertos, seasons

Lane H of wave 9 (`docs/opus-bay/sf-w9-lead.md` §3 H, run inside the Ultra workflow): worktree `C:/Users/willy/wt/w9-h`
(branch `w9-h`), dev port 5912, scratch `C:/Users/willy/opus-qa/w9/h/`, QA images `docs/opus-bay/qa/w9/H/`. Owns
`halloween/**` except `index.ts`, `season.ts`, `rewards.ts` (frozen), `realsf/dressing.ts`, `realsf/seasons.ts`, and the
big-night greeting in `realsf/todayLine.ts` (lane R's file, surgical).

## 给主人的摘要

1. 万圣夜（10/31 晚）老玩家回来时，BAYBAY 第一句就说「万圣节快乐！今天讨糖街家家都开门，糖果加倍……」，不再是通用的"三件小事"；10/31 中午说唐人街庆典，11/2 傍晚说亡灵节游行（X 线已配音）。第一次来的新玩家玩过第一分钟后（约 90 秒）也会听到这句。
2. 万圣节页面不再写「10 月 1–30 日」，改成"整个 10 月都能讨糖，31 日万圣夜每家都开门、糖果加倍——还有 n 天！"。
3. 讨糖的门全部在游戏里实际走了一遍：44 扇门里有 4 扇按不到「敲门」、1 扇点地面走不到。修好后 42 扇门全部能敲（2 扇夹在房子缝里的门撤掉，编号不变；已敲过这 2 扇门的存档，糖和「敲开 5 户」目标由评审 W9-H-review 保住；3 扇「敲门」范围放大）。
4. 11/2 亡灵节游行第一次真正玩了一遍：原来玩具车在游行的四条街上照常开，还有一辆停在队伍中间。现在游行期间（18:00–21:00，游戏里队伍在场的时间；SFMTA 2025 年通告写的是 18:45–22:00，评审更正）这四条街不走车，横街的车在路口等队伍过去。
5. 10/31 唐人街庆典、?halloween=night / muertos 预览、11/3 撤装都看过了：庆典在手机上只多 1 个绘制调用；11/3 所有万圣节 / 亡灵节装饰和封街都干净撤掉。
6. 拥挤点（10/31 Waverly 巷、10/9 水上公园）数过了：活动本身几乎不加负担（≤ 1 个调用、≤ 8.5k 三角形），负担来自那里平常的人群和车，没有乱砍——留给 W9-Z 测帧率后决定（见 Requests）。

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
| `28a4e9ad` W9-H1 | the 万圣节 page's season line: the whole of October + the countdown (was 「1–30 October」) |
| `103b917a` W9-H2 | the big days' greeting (welcome back + a first visit's invitation), 3 new fixed lines, `festivalDate.ts` |
| `8d627111` W9-H3 | every door can be knocked: doors 10 / 43 gone, reach for 4 / 52 / 54 |

## Part b · the resume, the festival, the procession, the previews, 3 November, the crowd counts (02:14 – 04:55 PDT)

A second agent of the lane resumed at 02:14 after the first one was stopped by an account usage limit. Kept as it was:
W9-H3 (committed, not pushed), the part-a report draft and its two shots. Nothing was discarded.

### What the resume found and fixed

- **The rebase at 02:20 (≈ 45 commits of other lanes)**: W9-X4 had switched `realsf/index.ts`'s welcome back to
  `todaySpoken()` (a fixed, voiced line + a toast), which skipped W9-H2's big-day branch in `todayLine()` — on Halloween
  night the welcome back would again say 旅行本「今天」里有今日三件小事. Lane H's 2-line fix in `todaySpoken()` collided on
  the push with lane X's identical W9-X5 (`25c2847a`): **X's code kept**; H's commit (W9-H4 `be99aab3`) keeps only the
  test that pins all four big-day moments through `todaySpoken()` (red on the W9-X4 tree, green now). The conflict in
  `realsf/todayLine.ts` (lane R's file) was resolved by taking origin's side.
- **The full suite before the push (02:38)**: 2000 / 2001 — `tests/opus-bay-w9-l-search.test.ts` "every game's point is
  its play module's own": lane L's search point for Chenery St still sat on door 10 (gone in W9-H3). W9-H3 follow-up
  `9e77ea05`: `data/sf/searchSpots.ts` (lane L's file, 1 line) → door 11's knock spot 427.72, 1049.82. No other copy of
  doors 10 / 43 in src / tests / public.
- Lane X has since recorded the three part-a lines (`public/opus-bay/w9/voice/{zh,en}-w9-h-today-*.{m4a,ogg}` on origin).

### Played (dev 5912, `?world=city`, desktop 1440 × 900 high and phone 390 × 844 dpr 3 mid; scratch `drive.mjs` + `v-*.json`)

| moment | what the player sees / hears | numbers (renderer.info; breakdown) | verdict / change |
|---|---|---|---|
| **31 Oct 12:00 · Waverly Place** (the Chinatown Halloween Festival) | lanterns strung across the alley, the line-up of toy kids (ghost, witch, pumpkin) queueing to the red stage; BAYBAY 唐人街的万圣节庆典在 Waverly 巷，有手工、游戏和南瓜，去看看吧！ (24.7 s) and 小朋友们排队上台比变装啦！大家都好可爱～ near the stage (38.5 s); no toy car in the alley (lane C's W9-C2) | desktop 94–102 calls / 314–346k tris; phone 75–92 calls / 198–256k; the kit 1 call / 5,426 tris, `halloween-world` 2 calls / 7.0k | ok. The player and the kids overlap when the player stands in the queue (the kids are not colliders: the alley stays walkable, W8's design). On the phone the two festival lines had not come within 35 s (the pacer gave the slots to the Chinatown hello, Karl, the cable car) — not changed |
| **2 Nov 19:10 · 24th & Bryant** (the procession) | the robed walkers with candles and marigold crowns walk the curb lane and part round the player (队伍从我们身边绕过去了。我们站到路边吧～ / 游行的队伍过来了。我们在路边安静地看，好吗？); the legs swing; papel picado over 24th; **a toy car standing in the column on Bryant** (`qa/w9/H/b-procession-car-before.jpg`) | desktop 71–81 calls / 277–307k; `halloween-world` 6 calls / 52k (stoops 23.7k, the kit 8.9k, 40 walkers); halos 690 | **fixed (W9-H5)**: the route's streets are closed to the toy traffic 18:00–21:00 — 60 one-second samples: **73 car-samples on the route's own streets (34 moving) → 0**; within 4 u of its line 136 → 39 (29 turning through a junction on a cross street, 10 waiting at a cross street's mouth for the walkers). Phone after: `qa/w9/H/b-procession-phone-after.jpg` |
| the procession on the phone | the column reads at night by its candles; the aside line came 22 s after the player stepped into the column (the pacer's queue) | — | ok. At 19:10 the head is on its second lap (the toy procession loops the 319 u route ≈ every 8.8 min until 21:00, W7's design) |
| `?halloween=night` (2 Oct, 04:00) | Belvedere: 今晚是万圣节！每家都开门，糖果还加倍！ then the street's line; stoops with figures, bats over Twin Peaks | 100 calls / 331k; dress 16 cells / 217 stoops / 23k; halos 658 | ok |
| `?halloween=muertos` | the Mission: 今天是亡灵节！教会区挂满了彩色剪纸旗，还有万寿菊。; the altars at any hour (a preview shows 2 November's altars), no procession (it follows the clock) | 107 calls / 338k; the kit 8.9k | ok |
| **3 Nov 19:30** · the Mission, Belvedere, Waverly | nothing of the season: no stoops, figures, pumpkins, picado, altars, festival; no 敲门 button; the toy traffic back on 24th (17 cars) | `halloween` stats all 0 (phase off, halos 0); no Halloween group in the breakdown | ok — the decor comes off cleanly |
| 1–30 Oct day decor | unchanged by this wave's commits: W9-H1–H5 touch the page text, the greeting, two gone doors and three prompt radii, the procession's road closure | — | ok |

### Crowd trims (w8 NEXT #12: Aquatic Park on 9 Oct and Waverly Place on 31 Oct read 44–54 fps at 4× on both trees)

Counted on the phone (390 × 844 dpr 3, mid) at W8-Z's spots (`scripts/opus-sf/qa/perf/w8-spots.json`), each on its event
day and on a plain day (one run per date, both spots; `__opusCityLife.stats()`, `city.breakdown()`):

| spot | event day | plain day | the event's own share |
|---|---|---|---|
| waverly-festival | 31 Oct 12:00: 92 calls / 256k; crowd 44 walkers (13 walking, 15 standing, 16 crossing, 5 pinned), traffic 16 cars, 26 vehicles | 9 Oct 11:20: 91 / 248k; crowd 44 (5 pinned), traffic 16, 26 vehicles | the festival kit: +1 call, +5.4k tris (`halloween-world` 2 / 7.0k with the lantern hunt) |
| aquatic-park | 9 Oct 11:20 (Fleet Week): 91 / 271k; crowd 44, traffic 16, 21 vehicles | 31 Oct 12:00: 92 / 273k; crowd 44, traffic 16, 21 vehicles | none measurable |

Decision: **no trim this wave**. The events add ≤ 1 call and ≤ 8.5k triangles; the load at both spots is the place's
everyday city life (44 walkers at mid, 16 cars, 8 cable-car calls in Chinatown, 12 landmark calls at Aquatic Park), the
same on the plain day — and "both trees" read low there, the wave-7 tree without the festival kit included. The only
lever that would act is the crowd's count (`world/sf/crowd.ts CROWD.count.mid` 44, lane F's file) for the whole phone
city, which needs an fps measurement this lane may not make — see Requests.

### Checks (part b)

- tsc 0 · `npx eslint .` 0 errors (53 warnings: the baseline grew with other lanes' commits; none in lane H's files) ·
  the full opus-bay suite before the W9-H5 push (03:55–04:04): **2066 tests, 2063 pass, 2 fail, 1 todo** — the two
  wall-clock tests named in the rules (`E2-5 view field in the city` in sf-move2, `P1: preparation runs in slices` in
  audio) re-run alone 2 / 2 and 1 / 1 · after the last rebase tsc 0 and the incoming lanes' test files 30 / 30 (incl.
  W9-L search with the Chenery point, W9-C lanterns, W9-X voice).

### Commits (part b)

| commit | what |
|---|---|
| `be99aab3` W9-H4 | a test pins what BAYBAY says on the big days' welcome back through `todaySpoken()` (lane X's identical code fix W9-X5 kept) |
| `9e77ea05` W9-H3 follow-up | lane L's search point for Chenery St follows the first standing door (door 11) |
| `77fd1bba` W9-H5 | the procession's streets closed to the toy traffic 18:00–21:00 (SFMTA's 2025 closures): 73 → 0 car-samples on its streets |

### Real-world facts (part b)

- SFMTA, "Dia de los Muertos Procession — Street Closures and Muni Reroutes" (2025):
  https://www.sfmta.com/travel-updates/dia-de-los-muertos-procession-sunday-november-2-2025 (read 2026-10-02) — "Bryant
  from 19th to 24th", "24th from Bryant to Mission", "Mission from 24th to 22nd", "22nd from Mission to Bryant", listed
  after "The procession will begin staging at approximately 6 p.m. on Bryant, between 19th and 22nd streets"; the notice
  runs "Temporary, from 6:45 to 10 p.m." (Muni reroutes 6:45 to 10 p.m., the 27 from 5 p.m.); the procession "will begin
  at 7 p.m." from Bryant & 22nd. *(Corrected by the review, H-RV-3: this line quoted "during staging at 6 p.m.", which is
  not on the page; re-read 2026-10-02 ≈ 06:05 PDT.)* The game closes the four streets while its own walkers are out
  (18:00–21:00: its staging to the procession's end), a game choice, not the notice's 18:45–22:00. 2026's notice is not
  published yet; the game follows 2025's pattern (like W7-H6's times).

## Not done

- **The crowd trim** at Waverly Place / Aquatic Park (counts above; no change without an fps reading).
- **The festival's two lines on the phone** compete with the place's other lines in the pacer (lane F's); not re-ordered.
  The player can stand among the line-up's kids (no colliders, W8's design).
- **The procession** still loops its route every ≈ 8.8 min between 19:00 and 21:00 (W7's choice); cross-street cars wait
  at the procession's crossings; the staging closure covers 30 u of Bryant north of 22nd, not the three blocks to 19th.
- Not played this wave: the trick-or-treat postcards beyond 不给糖就捣蛋 2 / 4 (part a); `?halloween=night|muertos` on
  the phone (desktop only); Firefox / Safari.

## Requests

1. **W9-Z (fps)**: when you read Waverly Place (31 Oct 12:00) and Aquatic Park (9 Oct 11:20) at 4× on the phone, compare
   with a plain day (the counts above: the events add ≤ 1 call). If they read < 45 again, the lever is lane F's
   `world/sf/crowd.ts CROWD.count.mid` (44, e.g. 36) — a whole-phone change for lane F / the lead to decide.
2. **Lane X**: no new fixed line from part b (W9-H4 / H5 add none); the three part-a lines are recorded.
3. **Reviewers**: look first at `halloween/muertos.ts` `onProcessionStreets` (the 4 u threshold against the street graph
   round the route, the lead-in) with `tests/opus-bay-w9-h-procession.test.ts`, then `halloween/treatDoors.ts`'s `reach`
   values and the two gone doors (W9-H3).

## Review (Ultra)

### 给主人的摘要

1. 评审发现的最大问题已修好：老玩家在 10/31、11/1–2 点「继续」回来时，BAYBAY 说完「欢迎回来」后本该说当天的万圣节台词，但 F 线 W9-F4 加的 3 分钟「安静期」把这句话压住直到过期，玩家永远听不到（平时 R 线的「今天旧金山」那句也一样被吞掉）。现在这句作为欢迎的一部分，在「欢迎回来」之后说出来，安静期照旧。真机桌面版复测：继续后 2.3 秒「欢迎回来」，7.0 秒「Happy Halloween! Every treat-street door answers today…」（截图 `qa/w9/H/rev-welcome-back-big-night.jpg`）。
2. 撤掉的 10 号、43 号讨糖门：已经敲过这两扇门的存档原来会少糖、「敲开 5 户」目标会从完成退回 3/5。现在敲过的糖和目标都保住，页面上的「x/42 户」仍只数还能敲的门。
3. SFMTA 游行通告的引文原来写错了（页面上没有 "during staging at 6 p.m."），代码注释、测试和报告都已改成原文：6 点左右开始集结，通告时间 18:45–22:00。游戏里 18:00–21:00 封街是按游戏里队伍在场的时间定的，没改。
4. 三条评审意见都确认并修好；没有阻挡上线的问题。

### Findings

| id | severity | verdict | evidence |
|---|---|---|---|
| H-RV-1 · returning player never hears the big day's line (W9-F4 hush × welcomeBack's pacer line) | major | **fixed** (`W9-H-review` 954d5f0b, `game/flow.ts` surgical, lane F's file) | Reproduced twice: (a) new `tests/opus-bay-w9-h-review.test.ts` with the real pacer (`initCityContent`), 31 Oct 19:30, 继续 → before: only 欢迎回来 in 60 s (red), after: the big-night line follows it with the hush still running (green); (b) played on the dev server (desktop 1440×900, en, the lens's resume probe on port 5952): after the fix 2.3 s 欢迎回来, 7.0 s "Happy Halloween! Every treat-street door answers today, treats doubled…" (`qa/w9/H/rev-welcome-back-big-night.jpg`). Cause confirmed in code: `resume.ts` → `beginPlaying('local')` → `startFree({ local, back })` sets `hushUntil = now + 180 s`; `baybayHeld()` holds the pacer; `welcomeBack()` offered the line with ttl 60. Fix: while the hush runs, `welcomeBack` says its second line as the welcome's own bubble once 欢迎回来 is off the screen and play is free (no dialogue / panel / holding overlay / cinematic), dropped after 60 s or on a newer welcome back; otherwise the pacer as before. The same loss hit lane R's SF-today line and goal #1's nudge on every other day: fixed by the same change. |
| H-RV-2 · removing doors 10 / 43 shrinks saves | minor | **fixed** (954d5f0b, `halloween/treat.ts`, `HalloweenPage.tsx`) | Reproduced in the test: a save with doors 10, 11, 12, 13, 43 paid → doorsKnocked 3 / candy 3 / goal 3/5 on the old code (red). Now `doorsKnocked` / `candyCount` count every paid door (gone too: a treat once given stays given), `allDoorsKnocked` asks every live door (gone ones never stand in), the page's x / 42 passes the live doors (never 44 / 42). Green; `opus-bay-w6-g-treat` / `w7-g-polish` / `w9-h-doors` unchanged and green. The report's 「编号和存档不变」 line corrected. |
| H-RV-3 · SFMTA quote "during staging at 6 p.m." not on the page | minor | **fixed** (f172e850 comments; this report's facts line and 摘要 line 4) | Re-read https://www.sfmta.com/travel-updates/dia-de-los-muertos-procession-sunday-november-2-2025 on 2026-10-02 ≈ 06:03 PDT: "begin staging at approximately 6 p.m. on Bryant, between 19th and 22nd streets", then the four closures; the notice "Temporary, from 6:45 to 10 p.m."; Muni reroutes 6:45 to 10 p.m. (the 27 from 5 p.m.); "will begin at 7 p.m." from Bryant & 22nd. No "during staging". The game's 18:00–21:00 closure is kept and named as a game choice (while its walkers are out). W9-H5's commit message (77fd1bba) keeps the old words (no force-push). |

### Own pass (W9-H1 … H5, 9e77ea05, the reports)

- W9-H5's closure goes through `world/sf/roadClosures.ts` (traffic only; transit, the player's own vehicles and the
  district untouched: the procession is a city-only feature); `onProcessionStreets` is bbox-gated (cheap per edge). No
  softlock found in the code; the cross-street cars that wait at the crossings were reported by the lane.
- Observation, not changed: a returning player who presses Start (not 继续) and picks 我是本地人 in the welcome still
  gets the listener's line held by the hush (`welcomed('local')`) — that player asked for quiet, so it stays.
- Observation (lane D's, not H's): in the node harness with the player at (0, 0), the pebble egg's 「嗯？这附近好像有块好石头……」
  replaced 欢迎回来 within 0.1 s during the hush — a direct bubble that ignores `baybayHeld()`. Not seen in the game run
  above (the player resumed at Alamo Square); named for lane D / F.

### Checks (on 954d5f0b + f172e850)

- `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors · touched suites (w5-content, w9-f-first-minute,
  w8-k1-hold, w5-tours, flow-brain, w9-h-procession, w9-h-review, w6-g-treat, w7-g-polish, w9-h-doors) green · the full
  opus-bay suite: see the push commit.

### Open items

- Not played: the fixed welcome on the phone (390×844, zh-Hant) and on 1–2 Nov in the browser (the test covers the
  mechanism; the day's line is the same `todaySpoken()` path); `?halloween=night|muertos` on the phone; Firefox / Safari.
- The crowd trim at Waverly Place / Aquatic Park waits for W9-Z's fps reading (lane F's `CROWD.count.mid`).

### Blocking the go-live to main

- Nothing from lane H's review.
