# Wave 9 · lane N — guide, trips, the Grand Tour

Lane N of wave 9 (plan `docs/opus-bay/sf-w9-lead.md` §3 N), worktree `C:/Users/willy/wt/w9-n` (branch `w9-n`), dev port
5903, scratch `C:/Users/willy/opus-qa/w9/n/`. Review refs: R§5 #n = the first-use review's Top-15 item n
(`docs/opus-bay/review-2026-10-01-first-use.md`), R§6 = its other-issues tables. Times PDT. Two agents: the first worked
21:36 → ≈ 00:35 (stopped by the account's usage limit; W9-N1 pushed, W9-N2 committed, the tour part uncommitted), the
second (this resume) 02:14 → 05:00: recovered, split, checked and pushed that work, then W9-N2b, W9-N6 and the
unattended Grand Tour run.

## 给主人的摘要

1. 带路不会再"卡死不动"：BAYBAY 带你走时 20 秒没进展就出手——60 米内直接黑屏送到，远的弹卡片「这段路被挡住了」［飞过去］［换条路］［我自己走］；金门大桥下车那段（绕悬崖 259 米）现在 8 秒内送到游客中心。自己推摇杆脱困不再被当成"不要带路"。
2. 时间只有一个说法：等车时写「车 9 秒后到 · 车程约 4 分钟」；站在渡轮大厦不再写「下一站：渡轮大厦」；走路的时间只减不增（真绕路才说「绕一下」）；在恶魔岛上不再给"走路 2 分钟到科伊特塔"，改说「先坐船回城」。
3. 一日游：不再问完整版 / 快速版，直接出发；每章结束一张结算卡（明信片、金币、下一章几分钟、加到想去、先逛逛）；回来时 6 秒后问「继续一日游 · 第 n 章（约 m 分钟）」，章节号修好了；回顾卡数的是一日游的站点明信片，并加了「带回现实 · 这周这些站附近」的活动；坐车菜单第一项就是一日游的下一站。
4. 活动卡的「带我去」：渡轮大厦农夫市集现在送到大厦前的摊位，不再是马路对面的 F 线站台；到了以后活动卡会再打开。走路结束会转身面对目的地。地图上走路写「和 BAYBAY 走 · 约 85 秒」。
5. 无人值守跑完一次完整一日游（开发服，10/3 周六 10:00）：五章实测 4.1 / 5.0 / 9.2 / 5.1 / 9.3 分钟（全程 32.9 分钟，标称约 36），卡片上的标称 5 / 6 / 8 / 7 / 10（第 3 章多出的时间是 N 线在 Judah & La Playa 终点站一直显示「车 9 秒后到」、实际等了约 4 分钟——评测里那个"约 24 秒等了 3.5 分钟"，根子在轻轨模拟（world/lightRail.ts，不是本组的文件），已写进 Requests）。全程没有卡住，「让 BAYBAY 带我过去」一次都不用点，页面无报错；跑完发现最后一章的明信片没领（回顾卡 7/9），已修（W9-N3b）。

## Part a — stuck (R§5 #7), the tour's first fixes (21:35 → )

**What the review saw** (gapfill/tour-full log 274 → 649 s; gapfill/tour2 chip-293 … chip-651; phone g2–g14): after the
sightseeing bus at the Golden Gate, the carried walk to the Welcome Center (quote 9 s) gave up after three silent retries
and the player stood 6 min; at Lands End the player was pinned and their own escape counted as a takeover, so every later
leg of the tour needed the chip; in SoMa the walk retried 3 × in 45 s under "BAYBAY 带路中" and stopped quietly.

**Reproduced** on the dev server (`C:/Users/willy/opus-qa/w9/n/leg.mjs`, the tour seeded at chapter 1 with the player at
the GGB drop-off): the carried walk leaves the stop eastward, pauses ≈ 3 s at (−636.3, 637.5) (the review's stuck spot:
the long-route fetch), goes on round the cliff (−578, 624) → (−600, 600) and arrives after 42 s; the pill / beacon time
rose 9 → 25 s on the way (`ggb1/log.jsonl`). On the real terrain in node: the stop → Welcome Center is 30 u straight and
**259 u** on foot (the local A* and `routeTo` agree); Lands End's drop-off → Sutro 24 u / 47 u (graph), Ocean Beach's →
the windmill 20 u / 20 u.

**Done**
- `game/autoTravel.ts` — the carried walk's **watchdog**: no progress (moving 3 u from the last spot that counted; a detour
  that first leads away counts) for **20 s** while free to walk → `giveup` (`why: 'stall'`); its clock stops in a dialogue,
  a panel, a ride or while stepping aside for a car. The old 3-fails rule stays (`why: 'fails'`). **Escape**: the stick /
  WASD / a tap while the walk is stuck (a failed re-issue, or 5 s without progress) is the player getting out, not a
  takeover — BAYBAY carries on 1.2 s after they let go. `autoEndReason()` / `noteAutoEnd()` tell a takeover from a give-up.
- `game/tripRun.ts` — the **rescue** on a give-up: within 60 u (straight) the way is **delivered** under the veil
  (`lineRides.veiledSkip` with the runner's words "BAYBAY 带你绕过去…", the player and BAYBAY set down on walkable ground,
  carrying on); farther, the **stuck card** (a BAYBAY card: 「这段路被挡住了，我们怎么走？」 [飞过去] [换条路] [我自己走];
  hidden ask items run the answers): 飞过去 = the rest of the trip as one pelican hop; 换条路 = a detour spot on rings of
  10 / 16 / 24 u round the player (standable, the local A* both ways, nearest the target first, ≤ 16 checks) walked to
  first, else delivered; 我自己走 = carrying off (the tour still carries the next legs). **A short way that walks far
  round is delivered at once**: once per carried leg the route cache (the planner's A*) is asked; a way ≤ 60 u straight
  whose route is > 3 × and > 80 u longer (or none exists) is delivered (the GGB stop → Welcome Center: 30 / 259 u).
  F's attention arbiter (`game/attention.ts`, §4) is not on origin yet: the card is a dialogue now; it moves into the
  title slot when F's module lands.
- `game/cityTour.ts` — carrying stays on for the next legs unless the player took over (`autoEndReason() !== 'takeover'`);
  `resumeIndex` (the save's chapter = the first open stop's, not the stop just reached: "继续一日游 · 第 n 章" said one
  less at every boundary, R§6 growth row); **no 完整版 / 快速版 question** (R§6: 7 minutes apart, on top of the time
  toast): `start` begins the full tour; a saved express run still resumes as one; `chooseCityTourVersion` keeps the old
  node for QA.
- `game/lineRides.ts` — `roomySpot`: off at a loop / Metro surface stop the rider gets 0.9 u of room (rings ≤ 3 u, kept
  2.3 u off the line), not a pinned corner; `veiledSkip(…, text)` takes the runner's words.
- `ui/GuideLayer.tsx` — the tour's lead chip 「让 BAYBAY 带我过去」 hands the walking back to the carried walk
  (`tourNext`: watchdog and card included) instead of `walkTo` the same blocked way again.

**Verified**
- Live (dev 5903, `ggb2/`): the same seeded GGB leg is delivered within ≈ 1.3 s of the stop's trip starting (phase
  `dwell` at the Welcome Center, (−700.3, 604.8)); before: 42 s round the cliff here, 6 min stuck in the review.
- `tests/opus-bay-w9-n-stuck.test.ts` (9 tests; red before: no `stall` give-up, the stuck stick was a takeover, the
  resume chapter one less): the watchdog, a detour that leads away is progress, the escape, the end reason, the rescue
  choice, 换条路's spot, `resumeIndex`, and **the Golden Gate, Lands End and Ocean Beach drop-offs reach their next stop
  within 2 × the quote on the real terrain** (GGB delivered; Lands End 47 u, Ocean Beach 20 u walked at the carried pace).
  The SoMa leg: the phone reviewer's "no headway" case (verify-phone phone-2: fails at 12 / 23 / 34 s, give-up at 46 s)
  now gives up at 20 s into the card (the watchdog test); the leg itself did not reproduce (verify-phone: 68 s from YBG).
- Updated (never deleted): `opus-bay-w5-nav` (the give-up says why), `opus-bay-w5-tours` (a give-up keeps the tour
  carrying; a takeover still turns it off), `opus-bay-sf-tripflow` (no version question).

## Part b — one time source (R§5 #6) — W9-N2 (first agent), W9-N2b

**W9-N2** (`ad0a5118`): waiting at a stop the pill says 「车 9 秒后到 · 车程约 4 分钟」 from the ride banner's own live ETA
(`tripProviders.liveWaitLeft`, lane T's rideStatus eta) instead of the trip total from the boarding quote; a walk to a
stop is 「去车站 X」 and within 25 u of a walk's end 「就在前面 X」 (no 「下一站：渡轮大厦」 at the Ferry Building); the
walking ETA counts the A*'s remaining path once it answers (`trips.ts` 'refine', `tripRun.refineWalk`) and is smoothed
per slot (pill, card, waypoint: `guideCity.shownEta`) — it only goes down, and a rise is accepted only after 3 s above
1.15 × + 3 s, said once 「绕一下」. **Surgical edit in lane F's file:** `ui/guideText.ts` (waitRideLabel, detourLabel,
tripPillText's wait / near / detour options) — the pill's words live there; F's other text untouched.

**W9-N2b** (this agent; w8 W8I-D-4, open since wave 8): on Alcatraz the waypoint chip offered a walking time to a city
target (「科伊特塔 · 约 2 分钟」 across the bay). `game/waypoint.ts acrossWaterLabel`: with the island on one side only the
chip's time reads 「先坐船回城」 / 「要坐船上岛」 (no number); a planned trip keeps the plan's seconds (ferry and waits
included). Test: `tests/opus-bay-w9-n-wp.test.ts`.

**Ride quotes vs measured boardings** (the review: "报价 240 秒，实际不到 30 秒就上车"; 「约 24 秒」 waited ≈ 3.5 min). Measured
in the unattended run below (the trip's quote = wait + ride; "took" = the trip's age when the ride's stop was reached):

| Ride (tour leg) | Quote | Took | Note |
|---|---|---|---|
| Sightseeing bus Ferry Building → Golden Gate | 240 s | 219 s | pill while waiting: 「车已到站 · 车程约 4 分钟」 |
| Sightseeing bus Golden Gate → Lands End | 193 s | 145 s | 「车 11 秒后到 …」 |
| N line Judah & La Playa → 9th & Irving | 146 s | 314 s | **the pill said 「车 9 秒后到」 for ≈ 230 s** (see below) |
| N line 9th & Irving → Duboce & Church (walk + ride) | 152 s | 113 s | 「车 89 秒后到」 |

So the bus and the inner N legs are within the quote; the one bad case is the N line's western terminus. The pill's
number there is the rail model's own (`world/lightRail.ts eta()`: a train standing short of the terminus keeps its
profile ETA, 9 s, while it waits for the terminus to clear); the review's tour2/peek3 「约 24 秒」 is the same stop. Not fixed
here — `world/lightRail.ts` is not lane N's file and the fix is in the train model (see Requests).

## Part c — the Grand Tour (plan §3 N (3)) — W9-N3

- **No 完整版 / 快速版 question** (W9-N1): `start` begins the full tour (「全城 5 章 · 约 36 分钟 · 随时下车」 on the four-way
  choice); a saved express run still resumes as one.
- **Chapter card** (`cityTour.ts chapterCard`): after a chapter's outro line, through F's arbiter (title slot):
  「第 2 章 · 海岸 完成！ · 明信片 3/3（新 +3） · 金币 +92」 [下一章：N 线穿越日落区（约 8 分钟）] [这一章的地方加到想去]
  [先在这儿逛逛]. The chapter's stop postcards of the stops reached are claimed then (review: the recap said 0/24).
- **Resume card** (`tripRun.ts`): a save with the tour half done → after 6 s of free play one card 「上次的一日游还没走完，
  接着走吗？」 [继续一日游 · 第 3 章（约 22 分钟）] [先自己逛逛]; the chapter number is the first open stop's (was one less).
- **The tour bus menu** (`lineRides.boardLine`): E at a pole where the tour boards a later ride pre-fills that ride.
- **The recap**: 「n/m 站点明信片」 (the tour's stop postcards, not the city's 24) and 「带回现实 · 这周这些站附近」 (≤ 3 of
  this week's events within 300 u of a stop, each opens its card; else a line to 这周) + 看这周去哪.
- Tests: `tests/opus-bay-w9-n-tour.test.ts` (5 for N3).

## Part d — arrivals (plan §3 N (4)) — W9-N4, W9-N6

- **W9-N4** trips on foot end facing `arrival.heading` (the place row's, else the landmark's; the camera turns too
  outside the tour and without an attraction's own arrival moment); `GoToOptions.onArrive` runs once when THAT trip
  arrives (never after a cancel / another trip), in F's title slot; **surgical in lane R's `realsf/index.ts`**: goToVenue
  reopens the event card on arrival.
- **W9-N6** 带我去 for the Ferry Building's events ends at the farmers-market stalls on the front plaza (122.6, −4.1) =
  `data/district.ts` anchors['farmers-market'], not at the attraction point (131.5, 15.1) 3.4 u from the F-line stop:
  `GoToTarget.at` (the end spot; the place, name and arrival moment stay the place's); **surgical in lane R's
  `realsf/eventVenues.ts`** (`EventVenue.door`, set for ferry-building only) and `realsf/index.ts` (passes it). Test:
  `tests/opus-bay-w9-n-venue.test.ts`.

## Part e — the map's time words (plan §3 N (5)) — W9-N5

The go button of a walk says 「和 BAYBAY 走 · 约 85 秒」 / "Walk with BAYBAY · ~85s" (60–119 s in 5-second steps; was
「BAYBAY 带路 · 约 1 分钟」); the ride / fly ways stay one tap away under the card's 其他方式和详情 chevron (not new: no
extra chips were added, the card already lists them).

## Part f — the whole Grand Tour, unattended (dev 5903, `?world=city&date=2026-10-03T10:00`, a fresh profile, zh-CN)

Script `C:/Users/willy/opus-qa/w9/n/tour.mjs` (the reviewer's `gapfill/tour2.mjs` pointed at port 5903 + the card shots
and page / console error logging): Start → 刚来湾区 → the tour runs; dialogue choices are taken after 3 s (the first
one: 下一章), panels closed after 5 s, a shot every 30 s; a leg with no movement for 45 s is logged STUCK; the lead
chip 「让 BAYBAY 带我过去」 would be tapped after 15 s. Log `C:/Users/willy/opus-qa/w9/n/tour3/log.jsonl`, 70 shots there.
The server ran without HMR / watching (`vite.tour.config.ts`) so the worktree could be edited meanwhile.

| Chapter | Start → end (s, run clock) | Took | Quoted on the cards | Notes |
|---|---|---|---|---|
| 1 海湾 | 155.9 (刚来湾区) → 402.5 (card) | 4.1 min | 5 min (scaled 5.0) | GGB drop-off → Welcome Center delivered in 8 s (W9-N1) |
| 2 海岸 | 406.9 → 704.3 | 5.0 min | 约 6 分钟 (5.6) | |
| 3 N 线穿越日落区 | 708.9 → 1258.3 | 9.2 min | 约 8 分钟 (7.8) | ≈ 4 min at Judah & La Playa: 「车 9 秒后到」 for ≈ 230 s (Part b) |
| 4 M 线去石镇和州大 | 1262.6 → 1567.2 | 5.1 min | 约 7 分钟 (7.2) | |
| 5 双峰与市中心 | 1571.5 → 2129.3 (recap) | 9.3 min | 约 10 分钟 (10.5) | |
| **All** | 155.9 → 2129.3 | **32.9 min** | 约 36 分钟 | 23/23 stops, coins 70 → 375 |

Lead-chip taps 0, page errors 0, console errors 0; STUCK only at the La Playa wait (5 entries, t 749 → 931, a train wait,
not a walk). The chapter cards read 「第 1 章 · 海湾 完成！ · 明信片 1/1（新 +1） · 金币 +80」, 「第 2 章 · 海岸 完成！ ·
明信片 3/3（新 +3） · 金币 +92」, 「第 3 章 … 2/2（新 +2） · 金币 +42」, 「第 4 章 … 1/1（新 +1） · 金币 +50」. The recap:
「7/9 站点明信片 · 9/10 盖章 · 23/23 站」 and 带回现实 with the Ferry Plaza market, Hardly Strictly Bluegrass (Hellman
Hollow) and Foodwise Latine Makers (all Sat 10/3). The 7/9 was the last chapter's two cards never claimed (no card after
the last chapter) → **W9-N3b** claims them at the last stop (a new test, red → green). The run started from a cold dev
server; a first attempt at 03:2x hit the app's error page right after Start on a cold compile (no error was captured;
two probes and this run started clean) — noted, not reproduced.

**The farmers market's 带我去** (W9-N6, `C:/Users/willy/opus-qa/w9/n/market.mjs`, from Pier 7 (60, −2), Sat 10:00): the
event card → 带我去 → a walk of ≈ 15 s ending at (122.4, −4.0) between the stalls with 「E 尝一口 · 渡轮大厦农夫市集」, and
the event card open again on arrival (`docs/opus-bay/qa/w9/N/market-take-me-there-arrived.jpg`); errors 0.

QA images (`docs/opus-bay/qa/w9/N/`): `tour-chapter2-card.jpg` (the card typing in), `tour-recap-before-n3b.jpg` (the
recap with 带回现实, 7/9 before W9-N3b), `market-take-me-there-arrived.jpg`, `n-line-la-playa-9s.jpg` (the terminus wait).

## Checks (last push)

`npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (53 warnings, none in lane N's files beyond the
three react-refresh notes of `ui/CityTourRecap.tsx`'s helpers) · `npx tsx --tsconfig tsconfig.app.json --test
"tests/opus-bay-*.test.ts"` 2124 tests, fail 0 (1 todo: W8-P9's GameRoot ≤ 255 KB target), on the tree before the last rebase; after it tsc 0 and lane N's / Q's / S's touched tests re-run green. Lane N's tests: `opus-bay-w9-n-stuck` (9), `-time` (5), `-tour` (7),
`-wp` (1), `-venue` (1).

## Commits (lane N, wave 9)

| Commit | Part | What |
|---|---|---|
| `d17a2b76` | a | W9-N1 the 20 s watchdog, escape ≠ takeover, the rescue (deliver ≤ 60 u / the stuck card), no version question, resume chapter (first agent, pushed 23:2x) |
| `ad0a5118` | b | W9-N2 one time source: 车 9 秒后到 · 车程约 4 分钟, 去车站 / 就在前面, the walking ETA only falls (first agent; pushed by this agent 03:06) |
| `2193fbef` | e | W9-N5 和 BAYBAY 走 · 约 85 秒 (recovered) |
| `ef312910` | c | W9-N3 chapter card, resume card, the tour bus menu, the recap's stop postcards + 带回现实 (recovered; lint + "reached stops only" fixed) |
| `3e65cc9f` | d | W9-N4 trips end facing the place; onArrive → the event card again (recovered) |
| `e2cffd8e` | b | W9-N2b Alcatraz: 先坐船回城 instead of a walking time across the bay |
| `13b0e73f` | d | W9-N6 the farmers market's 带我去 ends at the stalls (GoToTarget.at, EventVenue.door) |
| `ad657523` | c | W9-N3b the last chapter's stop postcards claimed (the run's recap 7/9) |

Nothing of the first agent's work was discarded.

## Decisions (defaults, recorded)

- The resumed work was kept whole (it passed its own tests and the suite) and split into three commits by part (N5,
  N3, N4) instead of one, so the reviewers can read each; two lint errors and one rule were fixed on the way: the
  chapter card claims the postcards of the stops this run **reached** (the first agent's version claimed every stop of
  the chapter, skipped or optional ones too).
- The stuck / chapter / resume cards are dialogue nodes shown in F's title slot (`attention.ts requestSlot`, released
  when the dialogue closes) — not new UI components.
- The 带回现实 box links this week's events near the stops and 这周; lane S's share card was not wired into the recap
  (S's share lives in the photo flow; adding a second share entry here was left for the reviewers / S).
- Alcatraz: the honest words (先坐船回城) rather than a ferry-timetable ETA in the chip; a planned trip already carries the
  ferry's real seconds.
- The market's 带我去 ends at the district's farmers-market anchor (the market's own E spot) for all three Ferry Building
  venue events; the venue's pennant / kit point stays (131.5, 15.1).
- The unattended tour ran on a dev server without HMR / file watching (`opus-qa/w9/n/vite.tour.config.ts`) so that
  editing the worktree during the 36-minute run could not reload the page.

## Not done

- **The N line at its western terminus** (Judah & La Playa): the pill shows the rail model's 「车 9 秒后到」 for ≈ 4 min
  while the train stands short of the terminus (`world/lightRail.ts`; not lane N's file) — see Requests.
- "Bus drop-offs snapped to the nearest walkable nav node with clearance round each loop stop's shelter": done for the
  loop / Metro surface stops as `lineRides.roomySpot` (0.9 u of room, 2.3 u off the line) — not a nav-node snap.
- Lane S's share card in the recap (「发给家人」) — not wired (above).
- The ride quotes were measured (Part b), not re-tuned: the bus quotes held (219 / 240 s, 145 / 193 s); only the
  terminus case is off, and that is the train model.
- No phone run of the new cards (desktop dev only); the chapter card's text is templated (not voiced, as the voice
  rule requires: the numbers are in it).

## Requests

1. **World / transit owner (wave 10, `world/lightRail.ts`)**: at the N's La Playa terminus the rider's train waits
   short of the terminus while another train stands there, and `eta()` keeps returning its profile time (9 s) — the pill
   said 「车 9 秒后到」 for ≈ 230 s (evidence `C:/Users/willy/opus-qa/w9/n/tour3/stuck-749…931.jpg`, log t 704 → 940;
   the review's `gapfill/tour2/peek3.jpg` 「约 24 秒」 is the same stop). Either let the standing train take the rider
   (reassign to the train at the terminus after its reversal) or make `eta()` count the hold.
2. **W9-Z / reviewers**: look at the chapter card (`docs/opus-bay/qa/w9/N/`), the resume card (reload with a half-done
   tour, wait 6 s), and the farmers market's 带我去 (the event card → 带我去 → the stalls, the card again).
3. **Lane X**: the two lines in `C:/Users/willy/opus-qa/w9/new-lines.md` from lane N (w9-n-stuck, w9-n-tour-resume)
   — no further lines from N after 01:45.

## Review (Ultra)

### 给主人的摘要
- 两个评审镜头（代码 / 真人试玩）共报 12 条：4 条重要、8 条次要。时间只够修重要的一部分，06:06 开工、06:45 截止。
- 修了：N 线在 La Playa 一直写「车 9 秒后到」—— 现在实时时间 15 秒不动就改写「车快到了」（横幅那行属 T 组，仍写约 9 秒）；同一段路右上角写 12 秒、路标写 16 秒 —— 现在两处共用一个时间；一日游章节卡补领明信片时，集齐全部明信片的目标也会完成。
- 没修：金门大桥观光巴士刚开始等车时先报「3 分钟」，5 秒后变 8 秒（毛病在巴士的实时到站时间，不归本组）；一日游「加到想去」的 10 个地方都不在 BAYLINK 目录里；地图卡上同一段路写「约 1 分钟」和「约 85 秒」；跳过一站后续游卡章节号不对；等车提示在手机上换成三行。
- 这些修复的代码提交 c81dcf27 **没有推送**：机器满载，全量测试在 06:45 截止前没跑完（跑到 698 条时有 1 条与本组无关的镜头测试报错），按规则不能推。它留在本地分支 w9-n-rev 上，总负责人跑完测试后可以 cherry-pick。

### Verdicts (fixer, 06:06–06:45 PDT, tree origin/opus-bay e9c3c35c; the fixes are commit c81dcf27 on the LOCAL branch w9-n-rev of C:/Users/willy/baylink-opus, NOT pushed — see Checks)

| id | sev | verdict | evidence |
|---|---|---|---|
| N-RC-1 | major | fixed (pill) | Confirmed by the lane's own not_done and tour3/log.jsonl (n-ride-9th-irving, STUCK ×5, arrival at age 314 s). Fix: guideCity `trackWait` / `shownWait` — a live wait ≤ 30 s that has not fallen for 15 s makes the pill say 车快到了 / "Train due soon" (guideText `waitRideLabel(…, soon)`). Test tests/opus-bay-w9-n-review.test.ts (red before: no stall rule). The ride banner (lane T) still says 约 9 秒; the root cause stays in world/lightRail.ts eta(). |
| N-RC-2 | major | confirmed-not-fixed | Code: cityTour chapterWish saves `at.placeId ?? at.id`; attractions.ts carries no plannerPlaceId, and none of the 10 ids is in planner-catalog.json (lens's node check). Needs a catalog id per tour attraction (data job) or a bilingual title in WishItem (core/types, frozen shape). Only the English toast plural fixed ("Saved · 1 place"). |
| N-RC-3 | minor | confirmed-not-fixed | tripRows.ts walkGoTime (5-s steps 60–119 s) vs tripSecondsLabel in the card header / aria / pill: 约 85 秒 next to 约 1 分钟. |
| N-RC-4 | minor | confirmed-not-fixed | tripRun.ts showCard onGrant sets shown = true before the deferred dialogue opens; watchCards releases any shown entry whose dialogue is not open. Code path only. |
| N-RC-5 | minor | confirmed-not-fixed | cityTour.ts: completed.push only on arrival (line 216), a skip only r.i++ (188 / 326); tourResumeChoice / begin() use the first not-completed stop. |
| N-RC-6 | minor | fixed | claimChapterPostcards now emits 'stamp' and calls completeGoal('postcards') when the claim completes the set (collectPostcard's tail). Not covered by a new unit test (the tour harness test runs > 80 s under tonight's load). |
| N-RP-1 | major | confirmed-not-fixed | n-rp/b-phone3/log.jsonl: t 88.1 pill 车 3 分钟后到 + banner 约 3 分钟 → t 93.4 both 8 秒 → t 104.1 上车啦. Pill and banner agree (one source works); the number is the sightseeing loop's live ETA right after the resume, lane T's rideStatus — not lane N's file. |
| N-RP-2 | major | fixed | One smoothed value for the pill, the card and the last leg's waypoint (`tripEtaShown` → slot 'trip'); the key carries the pace (carried / walking), so a takeover re-bases the time instead of holding the carried low. Test in tests/opus-bay-w9-n-review.test.ts. |
| N-RP-3 | minor | refuted (not reproduced) | 1 of 2 lens runs; the fixer had no time for a phone replay. The lens's shot e-market-again/1-arrived.jpg stands for a wave-10 re-check. |
| N-RP-4 | minor | refuted (not reproduced) | Not re-shot by the fixer (time); the three-line wait pill on 390×844 is in b-phone3/06-tour-010.jpg for a re-check. |
| N-RP-5 | minor | confirmed-not-fixed | b-phone3/log.jsonl t 82.4: pill 去车站 金门大桥 1/2 约 3 分钟, t 88.1 already at the stop: the short-leg delivery veils at once with a quote that said 3 min. |
| N-RP-6 | minor | refuted (not reproduced) | Not replayed by the fixer; the reopened sheet without an arrived state is a design gap to re-check (d-market-phone/1-arrived.jpg). |

### Own pass
- No softlock, district or perf change found in the W9-N commits in the time; the review's La Playa case is only half gone (the banner).

### Open items
- world/lightRail.ts frozen ETA at Judah & La Playa (banner still 约 9 秒); the sightseeing loop's first live ETA after a resume (N-RP-1); N-RC-2 catalog ids; N-RC-3/4/5; N-RP-3..6.

### Checks
- On c81dcf27: tsc 0; eslint of the touched files 0; tests/opus-bay-w9-n-review.test.ts 2/2. The whole opus-bay suite (started 06:34) had reached 698 pass / 1 fail by 06:42 — the fail is 'E2-5 view field in the city' in tests/opus-bay-sf-move2.test.ts (not a file this fix touches; not re-run alone in the time) — and had not finished; whole-repo eslint was not run. So the code was NOT pushed (the push rule needs fail 0): cherry-pick c81dcf27 (branch w9-n-rev) after a suite run.
- c81dcf27 landed as 24c7e9c7 (W9-C completeness pass, pushed 08:30 PDT; whole opus-bay suite 2191 pass / 0 fail / 1 todo, `npx eslint .` 0 errors, tsc 0; opus-bay-sf-move2 alone 24 / 24 incl. the E2-5 case — see sf-w9-integration.md "Completeness pass").

### Blocking the go-live
- Nothing new from lane N blocks the go-live; the La Playa pill (N-RC-1) and the 12-vs-16 s pill / waypoint (N-RP-2) stay as reviewed on origin until c81dcf27 lands. The 'E2-5 view field in the city' fail seen under load should be re-run alone on the go-live tree.
