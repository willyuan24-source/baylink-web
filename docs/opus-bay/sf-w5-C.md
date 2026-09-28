# Wave 5 · lane C · Content, flow & tours

## Part a

Implementer of lane C, part a (W5-C1 → W5-C4), 2026-09-28, worktree `C:/Users/willy/wt/w5-c` (branch `w5-c`), dev port
5503, scratch `C:/Users/willy/opus-qa/w5/w5-c/` (QA action scripts `qa-*.json`, shots `shots/`, suite logs
`suite*.log`). Commits on `opus-bay`: `9a17500` (W5-C1 hooks, pushed first), `d65a0ef` (W5-C2 / C3 / C4), `90a30eb`
(W5-C1 rumour frames), `e8df7c9` (W5-C2 / C3 QA fixes), `d634102` + `efc73c3` (W5-C2 first-flight hand-off, the 起飞
pulse), `8884095` (lane N's two requests) and this report.

### 给主人的摘要

1. **鹈鹕放在第一个目标**：城市模式的目标清单第一条就是「先去科伊特塔找鹈鹕朋友 · 解锁：随时飞」，BAYBAY 第一句推荐也是它，还有路标带你去（从渡轮大厦约 50 秒）。科伊特塔或者双峰等六个观景台随便到一个就解锁；跟「一日游」的人到第一站就送鹈鹕，不改路线。
2. **解锁是一个小时刻**：金色提示「解锁：随时飞！」，BAYBAY 问「以后想去哪都能飞啦！先试试起飞？」——选「试试起飞」直接进 A 线的第一次飞行（穿金圈拿金币）；选「以后再说」她会提醒你点「起飞」，手机上的起飞按钮会闪一下。
3. **目标只弹一次**：新玩家选「我自己逛逛」后，目标以一张卡片的形式出现一次（鹈鹕在最上面，一个大按钮「跟 BAYBAY 去找鹈鹕 · 约 50 秒」），这时 BAYBAY 不插话、角色不乱走；以后不再弹。
4. **老玩家回来**：从上次的位置继续时 BAYBAY 说「欢迎回来！上次我们走到唐人街了。」，接着一句 R 线的"今天旧金山"（R 接上之前先提醒去找鹈鹕）；不会再在原地重播"抵达"动画。
5. **金币**：到达景点、明信片、邻居的小忙、每个目标都会发"奖励"给 E 线的账本（一次性，只在城市模式）；实测在科伊特塔解锁鹈鹕后右上角显示 🪙 30。
6. 检查：tsc 0、eslint 0 错误、全套测试 1099/1099 通过；桌面 1440×900 和手机 390×844 都实际玩过、截图看过；街区模式不变；Higgsfield 0 分。

### What was built

| file | what | API for other lanes |
|---|---|---|
| `game/rumours.ts` (**new**, W5-C1, dependency-free) | the 听说… hook: sources in registration order, the first valid answer wins, told once per visit, a throwing / oversized source skipped; lane C's frames (听说，… / 悄悄说：… / 据说…; "I heard something: …" / "Psst — …" / "Word is: …"); a text that brings its own frame (lane D's 听说… / They say …) is said as it is | `registerRumourSource(fn) → off`, `Rumour { id, text, at? }`, `RumourContext { x, z, zone, now, told }`, `RUMOUR_GAP_MS` 5 min, `RUMOUR_FIRST_MS` 90 s, zh ≤ 40 unframed / ≤ 45 framed |
| `game/photoFrames.ts` (**new**, W5-C1) + `game/photo.ts` | decorators paint on the finished polaroid (after the caption and stamp), lowest `order` first, a throwing one skipped, the same id replaces | `registerFrameDecorator(id, draw, order?) → off`, `FrameCanvas { ctx, width, height, photo, band, pad, caption, stamp, at }` |
| `game/welcome.ts` (**new**, W5-C1) | 'new' after the city welcome choice (`info.choice`: tour / week / free / local), 'returning' on a resume (lane N's title 继续旅程 → `beginPlaying('local')`); one listener line is said for 'returning' (through BAYBAY's pacer); once per kind per page; Settings → reset welcomes again | `onWelcome(fn) → off` (fn may return a `Bilingual` ≤ 45 zh), `lastWelcome()` |
| `game/flow.ts` (W5-C1 doc + C2 / C3 / C4 wiring) | the public content API written down in the module header; `markGoalsDone(ids, { quiet })`; the welcome kinds (`hasProgress()` read at the title's Start); `welcomeBack()`; `openGoalsStep()` / `goalsStepOpen()` (bubbles, E, Q, the night-view offer and the pelican moment wait while it is open); city `startFree` shows the step once, then no card; `nextFreeGoal` puts the pelican first (after an accepted favour); the Coit sweep meets the pelican in the city; rewards for goals and postcards; the call menu's 带我去下一个目标 times a carried trip in the city (lane N's request) | `bubble`, `markGoalsDone`, `completeGoal` (documented), `PELICAN_NUDGE`, `FREE_AGAIN`, `hasProgress()`, `welcomeBack()` |
| `game/cityContent.ts` | the goals step chunk loaded in city mode; main-graph forwards to the lazy city chunk | `baybayLine(text, { ttl })` (BAYBAY's pacer; a plain bubble after the current one before the chunk lands), `unlockPelican(reason)`, `settleArrivals()`, `carriedTimeLabel(d)` |
| `game/pelicanFirst.ts` (**new**, lazy with the city moments) | W5-C2: `PELICAN_VIEWPOINTS` (the six panorama attractions), `unlockPelican('viewpoint' \| 'sweep' \| 'tour')` → `moveApi.setGlideUnlocked(true)`, goal #1 ticked quietly (its `goal` event + `reward goal:pelican`); the moment on the next quiet frame: the gold toast 解锁：随时飞！ + the device's take-off key, BAYBAY's dialogue [试试起飞 · 以后再说] in a two-shot; 试试起飞 → lane A's live `startFirstFlight` export (falls back to the 起飞 press when absent or when it resolves false); 以后再说 → the hint bubble + `pulseGlideButton()`; the tour: the toast and one paced line at once, ahead of the stop's own line; an old save with the glide: goal #1 ticked, no reward, no moment | `unlocksAt(hit)`, `PELICAN_LINES`, `takeOffKey()` |
| `game/cityMoments.ts` | first arrivals pay `arrive:<attraction>`; a viewpoint arrival unlocks the pelican; the rumour teller (1 Hz: free roam, on foot, BAYBAY ≤ 10 u, nothing else on screen, ≤ 1 per 5 min, sources asked at most every 20 s); a flight's landing counts as a hop-off (lane N's request); `settleArrivals()`; the pacer holds while the goals step is open; `__opusBay.c.pelican` / `.rumours` in DEV | `stepRumours`, `carriedTime(d)` |
| `game/arrival.ts` | `ArrivalWatcher.settle(x, z)`: the anchors round a resumed spot count as entered (no moment until you leave and come back) | — |
| `game/cityGoals.ts` | goal #1's waypoint `pelican:coit` (a prefix resolver at the Coit summit anchor, named 科伊特塔; the district card keeps "Coit Tower 观景点") | `PELICAN_TARGET` |
| `game/cityTour.ts` | the first stop reached meets the pelican (before the stop's own line) | — |
| `game/residentTasks.ts` | a finished favour pays `favour:<key>` | — |
| `game/rewards.ts` (**new**, W5-C4) | the reward emitter: city only, grammar-checked, coins ≥ 0 | `emitReward`, `rewardArrival` (T1 10 · T2 5 · T3 3, stamp = source), `rewardPostcard` (10), `rewardFavour` (25), `rewardGoal` (20; stamp for `pelican`, `golden-gate`), `REWARD_COINS` |
| `game/goalsStep.ts` (**new**) + `ui/GoalsStep.tsx` (**new**, its own chunk) + `ui/goals-step.css` | W5-C3: the goals step through the frozen overlay slot (prefetched at the city boot while unseen): BAYBAY's line, goal #1 with 解锁：随时飞 and the big button 跟 BAYBAY 去找鹈鹕 · 约 N (the honest time), the nine others compact, 我自己逛; holds `holdLock('panel', 'goals-step')`; closing any way starts free roam (`afterGoalsStep`: the lead, or her pelican line + the soft waypoint) | `initGoalsStep()`, `afterGoalsStep(how, target)` |
| `data/sf/goals.ts` | goal #1 `pelican` (先去科伊特塔找鹈鹕朋友 / Meet the pelican at Coit Tower; it takes the old 登上科伊特塔观景点 goal's place: 10 goals), `GOAL_REWARDS` (解锁：随时飞), `GOALS_STEP_SEEN`, `GOALS_STEP_ID` | — |
| `ui/Journal.tsx` · `ui/content-ui.css` | the 目标 tab: goal #1's reward text and 带我去; in the city the explorer goals come first (the district's order is unchanged) | — |
| `tests/opus-bay-w5-content.test.ts` (**new**, 19) | the hooks, the pelican (goal, viewpoints, the moment, both answers, the tour, the fallback, old saves, district), the welcome back, the goals step (once, fallback, body markup), the rewards (grammar over every attraction / postcard / resident / goal, once, city only, favours), the resume settle, lane N's two requests | — |
| `tests/opus-bay-sf-content.test.ts` · `tests/opus-bay-sf-verify-c.test.ts` | changed on purpose: the goal list (pelican first, 10 goals), the waypoints (the pelican target first), the Coit goal's text | — |

### Evidence

- **Checks** on the pushed code (`8884095`, rebased over `9cf554e`): `npx tsc -p tsconfig.app.json --noEmit` 0 ·
  `npx eslint .` 0 errors (43 old warnings outside lane C) · full opus-bay suite **1099 / 1099** on the pushed tree
  (`suite9.log`; 1098 / 1098 before the last rebase, which brought lanes E / A reports and E's `recordBest`). Earlier
  runs: 934, 971 (one audio "P1 sliced jobs" wall-clock failure, green alone), 997 (the same, green alone), 1051, 1054,
  1089.
- **In the game** (dev 5503, RTX flag, zh; every shot read). Desktop 1440 × 900:
  - the welcome → 我自己逛逛 → the goals step (`qa/w5/C/pa-goals-step-desk.jpg`): BAYBAY's line, the pelican card with
    解锁：随时飞, nine goals, 跟 BAYBAY 去找鹈鹕 · 约 50 秒 focused; E behind it does not board the ferry (checked:
    `riding: null`); the big button → `freeLead` Coit, "跟我来！去科伊特塔" after the zh-name fix.
  - teleported to the Coit summit: the moment (`pa-pelican-moment-desk.jpg`: toast 解锁：随时飞！按 G 起飞, the dialogue);
    试试起飞 → lane A's first flight (`pa-first-flight-desk.jpg`: the chip 第一次飞行 · 按 G 起飞, rings, BAYBAY 按 G 起飞，
    穿过金圈拿金币！); before lane A landed, the plain take-off glided off the summit (`shots/d3-takeoff.jpg`); the pill
    read 🪙 30 (lane E paid `goal:pelican` 20 + `arrive:coit-tower` 10).
  - the Grand Tour (完整版) at its first stop: the toast and 送你一位鹈鹕朋友！以后想去哪都能飞～ right after the Ferry
    Building line (`pa-tour-unlock-desk.jpg`; a pacer trace showed the line queued behind the tour's next lead and the
    loop boarding dialogue in the first try — fixed in `e8df7c9`).
  - a saved player (lastSafe at the Dragon Gate, zone `chinatown`) → title 继续旅程: 欢迎回来！上次我们走到唐人街了。, then
    the pelican nudge; no reveal or 抵达 toast after the settle fix (`pa-welcome-back-desk.jpg`).
- Phone 390 × 844 dpr 3 (touch, `--mobile`): the goals step fits (card 141–703 px of 844; `pa-goals-step-390.jpg`);
  我自己逛 → BAYBAY 先去科伊特塔找鹈鹕朋友吧！… + the waypoint chip 找鹈鹕朋友 · 科伊特塔 · 约 50 秒, the night-view offer only
  after the step (`pa-after-step-390.jpg`); the moment (`pa-pelican-moment-390.jpg`: 解锁：随时飞！点「起飞」); 以后再说 →
  想飞的时候点「起飞」就行～ with lane F's 起飞 visible (`pa-pelican-later-390.jpg`); the resume
  (`pa-welcome-back-390.jpg`); the journal's 目标 tab with the pelican first, 解锁：随时飞 and 带我去
  (`pa-journal-goals-390.jpg`).
- **District**: every change is city-gated (rewards, the step, the welcome hook, the pelican, the journal order); the
  district tests, the hero regression and `opus-bay-contracts` are green; the four feature folders stay out of GameRoot
  (goalsStep / pelicanFirst are lazy; the main graph gains `welcome.ts`, `rewards.ts`, `photoFrames.ts` — a few hundred
  bytes).
- **Rendering**: nothing new is drawn in the 3D scene (0 calls, 0 triangles, no material).
- **Real-world facts**: none added in this part (the Alcatraz name line is lane D's egg 11). Higgsfield: 0 credits.

### Decisions

1. **The pelican goal replaces the Coit viewpoint goal** (the same place, now with a reason to go): 10 goals. The Coit
   sweep still marks the `viewpoint` key, sets `viewpointUnlocked` and, in the city, meets the pelican first so the move
   system's own "解锁：鹈鹕滑翔" toast never doubles lane C's moment.
2. **The unlock goes through `moveApi.setGlideUnlocked(true)`**, not `viewpointUnlocked` (the district map's state stays
   the district's); lane N's sampler writes `unlocked.glide` to the save.
3. **Rewards on live first events only** (an arrival with `first`, a newly collected card, a newly ticked FREE_GOALS
   goal, a finished favour), city only; goals an old save already had are not paid on load. Amounts per plan §3.4; every
   other goal asks 20 (lane E caps `goal` at 20). `stamp` = the source for first arrivals, `goal:pelican`,
   `goal:golden-gate`. `pelican:unlock` (in lane E's FIXED_SOURCES) is never emitted: the pelican pays once, as its goal.
4. **The goals step is once per player** (goalsDone `seen:goals-step`, marked when it opens; reset clears it): shown for
   我自己逛逛 (and the first later free roam of a player who never saw it), not for 本地人 or the tour. Afterwards free
   roam starts without a card and BAYBAY says goal #1 while it is open, else "你带路，我跟着". If the step's chunk is not
   there, the old card stands in.
5. **The welcome**: 'returning' = any progress at the title's Start (progress v1 visited / cards / goals / tour, save v2
   city lastSafe / arrivals / glide / play); a listener's line is said only for 'returning', after 欢迎回来.
6. **Rumours**: BAYBAY only in part a (residents in part b), ≤ 1 per 5 min, never in the first 90 s, never during a tour /
   trip / free lead / dialogue / panel / cinematic / arrival card, only beside her.
7. **The tour's moment** is a toast and one line at once (no dialogue, no first flight: the tour goes on).
8. **A resume is not an arrival** (settle), but `?at=` teleports still arrive (QA uses them).
9. **The city journal lists the explorer goals first**; the district keeps Bay 101 on top.

### Known gaps

- The pelican does not visibly land beside the player (plan MF3 "a brown pelican lands beside the player"): the moment is
  the toast, the dialogue two-shot and lane F's 起飞 pulse. Request to F below.
- No rumour is told in the game yet: no source is registered until lane D's W5-D5 (part b); the teller is tested.
- The top-right pill still toggles the old goals card in the city (plan MF6: the pill opens the journal on 今天) — lane F's
  Hud with lane R's 今天 tab.
- After 试试起飞 lane A's first flight asks for the G / 起飞 press itself (BAYBAY says 抓稳啦，我们出发！ first): one more
  press than "take off now" (Request to A, optional).
- The QA harness does not activate a focused button on Enter (its key events carry no `\r`); focus is on the big button
  (checked) and the real browser activates it.

### Not done (part b)

- W5-C5 tours (the deck-crossing progress line within 10 u of both towers, re-timing the Grand Tour after MF2, the express
  run timed; the tour's own bus boards without the question: lane T did it in `069a8a4`).
- W5-C6 lines: the VOICE.md rows for this part's words, C's new lines frozen with a tag for lane V (pelican moment,
  welcome back, the goals step, the rumour frames), the routed items (`goalsDone` cap in `wishlist.ts readProgress`,
  `start-tour` with `tourId`); rumours from residents' chats.
- W5-C7 shoulds (favour step 2 + letters, the photo album); W5-C8 the rest of the shots.

### Requests

- **F** (`actors/moveApi.ts` / the pelican model): a `pelicanGreet(x, z)` beat for the unlock — the brown pelican lands
  beside the player for the moment (2–3 s) and flies off or waits for 起飞; lane C would call it from
  `game/pelicanFirst.ts stepPelican` right before the dialogue.
- **F / R** (`ui/Hud.tsx`, plan MF6): in the city the objective pill opens the journal (on 今天 once lane R registers it,
  else 目标) instead of toggling `flow.goalsCard`; lane C no longer sets that card in the city after the step.
- **A** (optional): `startFirstFlight({ takeOff: true })` (or the like) so 试试起飞 lifts off at once; C passes it when it
  exists.
- **D**: the rumour texts are accepted as they are (tested over all 24). Two names in them differ from `data/VOICE.md`:
  Lands End is 天涯海角 (the egg-14 rumour says 地之角), the Marina is 马里纳区 (the egg-7 rumour says 码头区防波堤; 码头区
  is the Embarcadero piers). The Alcatraz name line stays yours (egg 11); lane C does not say it.
- **E**: `pelican:unlock` is not emitted (the pelican pays `goal:pelican` once); `stamp` = the source for first arrivals,
  `goal:pelican`, `goal:golden-gate`, for the 印章 page.
- **R**: `onWelcome((kind) => kind === 'returning' ? todayLine : null)` gives BAYBAY's SF Today line after 欢迎回来 (zh ≤ 45;
  said through her pacer, 60 s to live).
- **N**: both requests done (`8884095`); tour legs in `AUTO_SOURCES`: not now (the tour's lines are paced for walking;
  lane C looks at it with W5-C5).
- **V** (voice, H5-3, with C6's frozen list in part b): 以后想去哪都能飞啦！先试试起飞？ · 抓稳啦，我们出发！ · 送你一位鹈鹕朋友！以后想去哪都能飞～
  · 先去科伊特塔找鹈鹕朋友吧！之后想去哪都能飞～ · 好嘞，你带路，我跟着！想去哪儿就叫我～ · 好嘞，整座旧金山都给你逛！先看看这几个小目标～ (the welcome
  back names an area: text only).

No relayed owner message arrived during this part. Higgsfield: 0 credits (no ledger rows).

## Part b

Implementer of lane C, part b (W5-C5 → W5-C6), 2026-09-28, worktree `C:/Users/willy/wt/w5-c`, dev port 5503, scratch
`C:/Users/willy/opus-qa/w5/w5-c/` (tour logs `tour-full.log` / `tour-express.log`, the watcher `tour-watch.js`, the
model check `retime.mts`, QA actions `qa-*.json`, shots `shots/b/`, suite logs `suite-b*.log`). Commits on `opus-bay`:
`0143dab` (W5-C5 / W5-C6 code + tests; tagged **`w5-c-lines-frozen`**, pushed) and this report.

### 给主人的摘要

1. **走过金门大桥**：在桥面上走到一座桥塔附近（10 u 以内）就算过了这座塔，BAYBAY 会说「南塔到啦！走到北塔，就算走过金门大桥～」，走到一半说「走到一半啦！脚下就是金门海峡。」，到另一座塔就完成目标：「走过金门大桥啦！两座塔之间有 1280 米！」（金门大桥官网的数字）。配合 F 线的桥面手感，按住 W 一路走过去，第一次就完成了。
2. **一日游 BAYBAY 全程带你走**：和地图上"一键出发"一样，每一站她都自动带着你走，你只管看；碰摇杆或按方向键就换成你自己走，问 BAYBAY「继续：带我去…」又交还给她。观光巴士和地铁到站直接上车（T 线做的），只有最后的叮当车还要点一下「上车」（已请 N 线改掉）。
3. **实际计时**：完整版从头到尾实测 36.1 分钟（其中约 1 分钟卡在金门大桥游客中心附近），快速版 28.5 分钟（没点「直接到站」；点了约 24 分钟）。游戏里的车比原来估的慢（观光巴士慢约三成，每条地铁线只有两列车，最长等了 3 分钟），所以欢迎页的时间改成真实的"约 34 分钟"，快速版"约 25 分钟"。
4. **BAYBAY 的新台词定稿**：鹈鹕、欢迎回来、目标卡、金门大桥共 11 句，已打标签交给 V 线录音；录好后自动配上声音，没录之前照常显示文字。还修了一个小毛病：同一句景点介绍不会在十几秒内说两遍。
5. 检查：tsc 0、eslint 0 错误、全部 1179 个测试通过；电脑 1440×900 和手机 390×844 都实际玩过、截图看过；街区模式不变；Higgsfield 0 分。

### What was built

| file | what | API for other lanes |
|---|---|---|
| `game/cityDetectors.ts` | W5-C5 (plan MF2 "走过金门大桥 counts passing within 10 u of both towers and says its progress on the deck"): `createDeckCrossing({ tower, near = 10, deckY, halfWidth })` counts a tower within 10 u of it on the deck (the distance to the tower's centre), then the other one; each step returns a `DeckStep` (`tower` −1 / +1, `half`, `done`) or null; off the deck, gliding or a fast travel start it over; both ways; the bike and the toy car count; at 5 Hz no 20 u window is skipped at ≤ 8.5 u/s | `DeckStep`, `DECK_TOWER_NEAR` |
| `game/cityLive.ts` | the live detector on the real bridge frame (`GGB.TOWER` 89.29) says each step through BAYBAY's pacer (`hooks.say`, 12 s to live) and marks the goal once; no line once the goal is done | `deckLine(step)` (pure), `CityGoalHooks.say?` |
| `game/cityContent.ts` | `baybayLine(text, { ttl, id })` (a frozen line id: the pacer carries its voice), `speakRecorded(id)`, the `say` hook for cityLive | `speakRecorded` |
| `game/cityTour.ts` | W5-C5: every stop's trip is carried like a map trip (lane N's auto-travel through `resumeAutoTravel`: to the stop, to the station, on from the ride); a takeover (stick, WASD, a tap) lasts for the rest of the tour (`subscribeAuto`); the call menu's 继续：带我去… (now `tour-next`) and 继续一日游 hand the walking back; 跳过这一站 is not a takeover; `cityTourRun().carry` for QA | — |
| `data/sf/tours.ts` | W5-C5 re-timing: `TOUR_MODEL` from the measured runs (bus 6.85 u/s, Metro 7 u/s surface / 14.5 u/s under ground and a 60 s wait, cable × 2.15, carried walks at `autoTravelSeconds`, a 6 s `settle` for a stop without a moment); every stop's `minutes` / `expressMinutes` re-written from it: **full 33.7 min (约 34 分钟), express 25.2 min (约 25 分钟)** (were 25.9 / 18.3); the first bus ride has no lead line (lane T's 上车！坐到金门大桥 and the bus's own boarding line say it) | — |
| `data/sf/copy.ts` | the main-graph copy of the subtitle and the call row (约 34 分钟), tested equal to the tour data | — |
| `game/brain.ts` | the same bark under two POIs (a landmark's card and its arrival spot) counts as one for its 120 s: the full tour heard Sutro Baths, the windmill, the Painted Ladies and Twin Peaks twice within 16 s | — |
| `data/sf/linesW5.ts` (**new**, data only) | W5-C6: `W5_C_LINES` — lane C's 11 recorded wave-5 lines, **FROZEN 2026-09-28** (git tag `w5-c-lines-frozen`, snapshot `bc31006f4f618eeb`): `w5c-pelican-ask` 以后想去哪都能飞啦！先试试起飞？ · `w5c-pelican-go` 抓稳啦，我们出发！ · `w5c-pelican-tour` 送你一位鹈鹕朋友！以后想去哪都能飞～ · `w5c-pelican-nudge` 先去科伊特塔找鹈鹕朋友吧！之后想去哪都能飞～ · `w5c-welcome-back` 欢迎回来！我们接着逛吧。 · `w5c-free-again` 好嘞，你带路，我跟着！想去哪儿就叫我～ · `w5c-goals-intro` 好嘞，整座旧金山都给你逛！先看看这几个小目标～ · `w5c-deck-south` 南塔到啦！走到北塔，就算走过金门大桥～ · `w5c-deck-north` 北塔到啦！走到南塔，就算走过金门大桥～ · `w5c-deck-half` 走到一半啦！脚下就是金门海峡。 · `w5c-deck-done` 走过金门大桥啦！两座塔之间有 1280 米！ (each with its en) | `W5_PELICAN`, `W5_WELCOME`, `W5_DECK`, `W5_C_LINES`, `w5Text` |
| `data/sf/tourLines.ts` | its id lookup resolves the wave-5 lines too: `sayLine('w5c-…')` gives the voice id (clip `<lang>-<id>`) | — |
| `game/cityMoments.ts` | `offerLineOr(id, text, ttl)`, `lineRecorded(id)`, `speakRecorded(id)` (a `voice-line` event only when lane V's clip exists: never a stray chirp); the pelican moment gets `speakRecorded` | — |
| `game/pelicanFirst.ts` · `game/flow.ts` · `game/goalsStep.ts` · `ui/GoalsStep.tsx` | the texts are the frozen ones (the lazy modules import them; flow keeps its constants, tested equal, with `W5_LINE_IDS` and `WELCOME_BACK`); the tour's pelican line is offered by id; the dialogue lines and the bubbles play a recorded clip with them once it exists (`sayFreeLine`) | `W5_LINE_IDS`, `WELCOME_BACK`, `sayFreeLine` |
| `data/VOICE.md` | "Wave 5 additions (lane C …)": the frozen set and what stays text only; 鹈鹕朋友 · 随时飞 · 起飞 / 降落 · 小目标 · 欢迎回来！上次我们走到<area>了。 · 南塔 / 北塔 · 金门海峡 · the rumour frames | — |
| `tests/opus-bay-w5-tours.test.ts` (**new**, 9) | the deck crossing (10 u windows, both ways, resets, bike / car, the 5 Hz sweep), the live detector over the real bridge (lines in order, the goal once, silence after), the carried tour (each stop, takeover, 继续：带我去, skip, end), the first ride's lines, the frozen set (ids, snapshot, sizes, no control named, the fact's source, `sayLine` voice ids), the texts equal to it, clips only when recorded, the routed items | — |
| tests changed on purpose | `sf-content` (the deck rule), `sf-tours` (the re-timed model: ≈ 34 / ≈ 25 min, the lap ≈ 18 min, the literals), `sf-int-review-c` (继续 is `tour-next`), `w5-content` (the tour's pelican line by id); **`sf-tripflow` (lane N's file)**: its two tour-minute literals (约 26 / 约 18) now read `minutesLabel(SF_GRAND.…)` — a one-line derivation, nothing else touched | — |

### Evidence

- **Checks** on the pushed tree `0143dab` (after the last rebase over lanes R4–R6): `npx tsc -p tsconfig.app.json --noEmit`
  0 · `npx eslint .` 0 errors (43 old warnings outside lane C) · full opus-bay suite **1179 / 1179** (`suite-b4.log`;
  1108 / 1108 and 1166 / 1166 before the two rebases). No wall-clock flake this time. `npx` worked everywhere.
- **The Grand Tour timed end to end** (dev 5503, desktop 1440 × 900 high, RTX flag, zh; the tour carried by BAYBAY, no
  steering; the only inputs: one tap on the version's reply and one 上车 on the cable car's board question; game time =
  wall time, 83 / 74 frames over 50 ms out of ≈ 130k / 100k):

  | stop | full: model s · measured s | express: model s · measured s |
  |---|---|---|
  | bay-start (walk to the stop, lines) | 9 · 28 | 9 · 28 |
  | bay-ride-ggb (bus, Ferry → GGB) | 246 · 250 | 246 · 217 |
  | bay-vista (Welcome Center) | 27 · **61** | 27 · **74** |
  | coast-ride-lands-end (walk back + bus) | 167 · **249** | 202 · **276** |
  | coast-sutro · coast-ride-windmill · coast-windmill · coast-walk-n | 26 · 29 · 54 · 37 · 31 · 35 · 35 · 32 | — · — · — · 34 · 25 |
  | n-ride-9th-irving (N from La Playa) | 152 · **278** (a 187 s wait) | — |
  | n-tea-garden · n-ride-duboce · n-painted-ladies · n-walk-church | 43 · 39 · 162 · 118 · 48 · 50 · 34 · 35 | — · 78 · **170** (no 直接到站 tapped) · — · 16 · 11 |
  | m-ride-winston · m-stonestown · m-sfsu · m-ride-castro | 161 · 108 · 27 · 27 · 38 · 40 · 182 · 174 | 177 · 124 · — · 34 · 40 · 92 · **143** (no 直接到站) |
  | peaks-ride-twin-peaks · peaks-overlook · peaks-ride-chinatown | 123 · 125 · 58 · 58 · 262 · 240 | 123 · 140 · 58 · 58 · 262 · 262 |
  | peaks-cable-hill · peaks-cable-ride · peaks-ferry | 39 · 39 · 81 · 86 · 30 · 28 | 39 · 39 · 81 · 75 · 30 · 27 |
  | **total** | **33.9 min model · 36.1 min measured** | **25.1 min model · 28.5 min measured** (≈ 24.4 with 直接到站 on its two long Metro legs, as the express offers) |

  Before the re-timing the model said 25.9 / 18.3 min for the same runs. Where the wave-4 model went wrong: the bus rides
  at ≈ 6.85 u/s between its stops in the running game (traffic holds included; the model had 9.45), the Metro at ≈ 7 u/s
  on the surface and ≈ 14.5 under ground (10 / 25), a line runs two trains so the waits were 187 · 13 · 9 · 44 s (10),
  the cable car × 2.15 (1.25). What is left over is not the tour's: ≈ 1 min lost at the GGB Welcome Center both times
  (29 u in 40 s there and 28 u in 39 s back to the stop — the auto-walk snags round the building; Requests F / L / N) and
  ≈ 20 s of lines at the first stop. The express's merged N ride and its Castro ride ran in real time because the script
  did not tap 直接到站 (BAYBAY's hint was shown).
- Every line of both runs (BAYBAY's 145 bubbles of the full tour are in `tour-full.log`): in order, the chapter intros,
  the stop lines, the loop / Metro narration, the pelican line at the first stop; lane T's boarding 上车！坐到… on every
  bus / Metro leg (no driver question); the only dialogue on the way: the cable car's 上车 · 坐到 加州街 & Drumm 街.
  The run found the doubled card barks (fixed in `brain.ts`) and the doubled first-ride line (removed).
- **In the game, shots read** (key JPEGs in `docs/opus-bay/qa/w5/C/`):
  - desktop: the deck walk south → north — `pb-deck-tower-desk.jpg` (南塔到啦！… on the deck, 发现新地点：金门大桥 · 南塔),
    `pb-deck-done-desk.jpg` (走过金门大桥啦！两座塔之间有 1280 米！, the toast 目标完成：走过金门大桥, 🪙 20 from lane E);
    **holding W + Shift** with lane F's deck steering from the south approach (`pb-deck-holdw-desk.jpg`): the tower at
    6.8 s, half-way at 20 s, done at 30.8 s — the goal on the first crossing, the area chip 金门大桥;
    the tour at its first stop (`pb-tour-stop-desk.jpg`, 一日游 · 海湾 1/5); the express recap in a clean page
    (`pb-recap-express-desk.jpg`: 快速版 · 约 25 分钟, 1 / 16 站, the express chapters).
  - phone 390 × 844 dpr 3 (touch): `pb-deck-half-390.jpg` (走到一半啦！脚下就是金门海峡。 on the deck),
    `pb-tour-carried-390.jpg` (BAYBAY leads, the player walks by itself, the pill 下一站 渡轮大厦 · 约 4 秒, the 看夜景 offer),
    `pb-tour-boards-390.jpg` (lane T's banner 等观光巴士进站…约 1 秒 · 不坐了, no dialogue).
- **District**: nothing here runs in district mode (the tour, the detectors, the lines are city-only; `brain.ts`'s bark
  rule only stops a repeat of the same words); the district tests, the hero regression and `opus-bay-contracts` are
  green. Rendering: nothing new drawn (0 calls, 0 triangles). Bundle: `linesW5.ts` stays out of GameRoot (with the tour
  data in the city chunks; checked with the static-graph walk); flow gains a few lines of constants.
- **Real-world fact** (the only one): the Golden Gate Bridge's main span is 4,200 ft (1,280 m) between the towers —
  goldengate.org, "Design & Construction Stats",
  https://www.goldengate.org/bridge/history-research/statistics-data/design-construction-stats/ (checked 2026-09-28). The
  line's `source` carries it. Higgsfield: 0 credits.
- QA note: a dev-server hot update of `tours.ts` in the middle of the express run left that page's recap reading a fresh
  module (it showed the full version's counts); the same recap in a clean page is right (`pb-recap-express-desk.jpg`).

### Decisions

1. **The tour carries the player** (plan MF4's rule "on every device" applied to the tour; my part-a note to N): the
   tour's lines are short bubbles and fit a carried pace, and getting stuck on the way (the owner's F2, "sightseeing
   就过不了") was the tour's worst failure. Through lane N's public `resumeAutoTravel` from `cityTour.ts`, not by adding
   `'tour'` to N's `AUTO_SOURCES`. A takeover lasts for the tour (a player who wants to walk it is not grabbed again at
   every stop).
2. **"Within 10 u of both towers"** is the distance to each tower's centre on the deck (the balconies round the legs
   included); a start on the main span counts from the first tower reached. The lines are said only while the goal is
   open; the mid-span line once per attempt.
3. **The quote is the model, the model is the measurement**: the declared minutes stay computed (never typed), with the
   vehicle paces and waits measured in the game. The Welcome Center snag and the first-stop lines are not folded into
   the quote (a bug being fixed, a one-off): once the snag is gone the full tour should run ≈ 35 min against 约 34 分钟.
   The express keeps its promise with 直接到站 tapped (≈ 24.4 min against 约 25 分钟).
4. **The frozen set** lives in its own data module (a type import only) that the tour's id lookup reads: the pacer's
   existing voice path (`TOUR_VOICE_CLIPS`, `<lang>-<id>`) plays them once lane V adds the clips, like `TOUR_LINES_2`.
   Lines naming a control, lines with a place filled in, rumours and labels stay text (VOICE.md rule 5 and H5-3's
   "dynamic lines stay text"). The main graph keeps its own copies (tested equal) so GameRoot does not grow.
5. **The routed items were already done** (checked, now tested again): `readProgress` keeps 128 goalsDone ids
   (`GOALS_DONE_MAX`), and the city welcome's first choice is `{ type: 'start-tour', tourId: 'sf-grand' }`.
6. **Auto-boarding**: lane T boards every bus / Metro leg of the tour without the driver (verified in both runs); I
   removed the tour's own first-ride lead line instead of asking T to drop its bubble (T's report offered either).

### Known gaps

- On a tour trip the HUD shows lane N's old lead chip, not its `GoChip` (BAYBAY 带路中 · 碰摇杆接管 / 自动跟上 BAYBAY):
  `ui/GuideLayer.tsx` leaves tour trips out. Carrying works; the status words are missing (Request to N).
- The cable-car leg still asks 上车 · 坐到 加州街 & Drumm 街 (lane N's `flow.trip.board` in `tripRun.ts`; Request to N).
- The GGB Welcome Center snag (≈ 1 min per tour) is not lane C's to fix (F / L / N, the MF2 sweep).
- The first tour stop waits ≈ 20 s for its lines (the chapter intro, the pelican line, the Ferry Building's two lines):
  it reads well, but it is the slowest start of any chapter.

### Not done

- W5-C7 (should): favour step 2 + letters, the photo album. W5-C8: the plan's shot list is covered (the phone goals step,
  the pelican moment, 欢迎回来 and the tour's unlock line in part a; the deck goal progress line here), but no real-iPhone
  pass (the lead's W5-Z).
- Rumours from the residents' chats (part-a decision 6 kept them BAYBAY's); lane D's source landed in `7f0d8c7` and is
  told through lane C's teller — not re-checked in the game in this part.

### Requests

- **N** (`ui/GuideLayer.tsx` l.203): let tour trips show the `GoChip` too (drop `s.trip.source !== 'tour'` from
  `tripLive`): BAYBAY now carries the tour, so 碰摇杆接管 / 自动跟上 BAYBAY should read as on a map trip
  (`resumeAutoTravel` works for tour trips; the tour listens to `subscribeAuto`). The ask item `n-take-me` can stay
  hidden for tours (the tour's own 继续：带我去… is there).
- **N** (`game/tripRun.ts`, the board offer ≈ l.287): a tour trip's cable-car (and F-line / ferry) leg opens its ride
  node at once (`openNode(rideNodeFor(leg))` or the like) instead of `flow.trip.board`'s question, as lane T did for the
  bus and the Metro; lane C's timing watcher answered it once per run.
- **N**: FYI `tests/opus-bay-sf-tripflow.test.ts` l.270–271 now derive the tour's minutes from `SF_GRAND` (they pinned
  约 26 / 约 18, lane C's data); nothing else in your file changed.
- **F / L / N** (MF2 sweep): the GGB Welcome Center — BAYBAY's auto-walk from the loop stop (−680, 625) to the Welcome
  Center arrival (−700.9, 604.6) took 40 s for 29 u, and back to the stop (−682, 626) 39 s for 28 u, in both runs (the
  owner's own reproduction spot); the tour loses ≈ 1 min there.
- **T** (FYI): the loop bus in the running game averaged ≈ 6.85 u/s between stops over five tour legs (Ferry → GGB 228 s
  aboard against your 193 s quote; GGB → Lands End 157 s against 124 s), with 7 DEV "held 12 s by box:f-line /
  california / powell-hyde" lines per run; lane C's tour model now uses the measured pace, your `rideEta` stays the live
  ETA.
- **V** (H5-3 voice): record `W5_C_LINES` (`src/opus-bay/data/sf/linesW5.ts`, tag `w5-c-lines-frozen`, 11 lines × zh + en,
  the Pixie preset) into the tour clip table (`data/sf/voiceTour.ts`, clip `<lang>-<id>`) like `TOUR_LINES_2`; they play
  through BAYBAY's pacer and with the pelican dialogue, the goals step and flow's bubbles as soon as the clips are
  registered (no code change needed).
- **Lead** (W5-Z): the Grand Tour's quote is now 约 34 分钟 (full) / 约 25 分钟 (express); please re-time both on the quiet
  machine after MF2 (the Welcome Center fix should bring the full run to ≈ 35 min). Welcome choice 1 now promises a
  longer tour than wave 4 said (26); if that is too long for a first welcome, the express could become the default there
  (not done: a product call).

No relayed owner message arrived during this part. Higgsfield: 0 credits (no ledger rows).

## Part c

Implementer of lane C, part c (the mid-wave checkpoint's CP-14, then W5-C7 → W5-C8), 2026-09-28, worktree
`C:/Users/willy/wt/w5-c`, dev port 5503, scratch `C:/Users/willy/opus-qa/w5/w5-c/c/` (QA action scripts `qa-*.json`,
shots, suite logs `suite-c*.log`, the edit scripts). Commits on `opus-bay`: `6f50f975` (CP-14), `d8324715` (W5-C7: the
album, the second favours, the letters, the otter), `7d06b800` (CP-14: the pair on your level, lane F's pelican),
`e828ab31` (lanes A / F / N's requests), `3bcb30ac` (lane R's request 1a), `1472801a` (VOICE.md), `1e6ddb35` (this report) and its hash fix.

### 给主人的摘要

1. **检查点的问题修好了**：城市里科伊特塔一带的名字都换成了中文（提示读「看看壁画 · 科伊特塔壁画」，线索读「科伊特塔壁画附近」）；从华盛顿广场那边爬台阶上来遇到鹈鹕时，镜头不再对着地砖——BAYBAY 先站到你身边、和你面对面，再开口问「先试试起飞？」。F 线做好的「鹈鹕落在身边」也接上了，只在它不会挡住 BAYBAY 的时候才落下。
2. **相册**：城市里每拍一张照片都存进这台设备的「相册」，不再每张都弹出下载；在「更多 › 相册」或拍照时点右下角缩略图就能看，手机上点「保存」会打开系统的分享面板（iPhone 可以「存储图像」到照片）。长竖屏照片底下的文字也不会再压到一起了。
3. **六位邻居的第二个小忙**：给 Rosa 拍渡轮大厦钟楼、帮 Luz 拍三处壁画、给 Hank 拍荷兰风车、替 Marcus 拍嬉皮山、陪 Ray 在叮当车上摇一段铃、在克里西场海滩陪 Dana 坐下看大桥。做完会留下小变化：Balmy 巷围栏边多一块 Luz 画的小海獭，路过 Ray 他会摇你教的那段铃，Rosa 周六、Hank 春天、Marcus 周末说的话跟着真实的日子变。
4. **来信**：做完第二个小忙过一会儿，那位邻居会寄来一封信（金色提示 + BAYBAY「有你的信！」），在旅行本「目标」里点「读信」（有小红点）。信和对话里的真实小知识都在官网上查过（2026-09-28）。
5. 顺手做了别的线请我做的小事：地点卡片加上 R 线的「现实中怎么去」（最近的真实 Muni 站）；城市旅行本不再一上来就列旧版「湾区第一课」；西沃德街滑梯的提示按官网改对了。检查：tsc 0、eslint 0 错误、全部 1295 个测试通过；电脑和手机都实际玩过、截图看过；街区模式不变；Higgsfield 0 分。

### What was built

| file | what | API for other lanes |
|---|---|---|
| `data/sf/cityPois.ts` · `data/pois.ts` · `game/cityContent.ts` · `game/arrival.ts` | **CP-14 names**: the district's waterfront POIs join the city named the city's way (`CITY_DISTRICT_POI_NAMES`: 科伊特塔观景点 · 科伊特塔壁画 · 菲尔伯特台阶 · 探索馆 · 李维斯广场 · 14 号码头 · 7 号钓鱼码头 · 恶魔岛渡轮码头 · 39 号码头旋转木马 / 海狮观景处 · F 线 · 39 号码头站 · 渡轮大厦农夫市集) and their zh card text / bark / verb with the English place names swapped (`CITY_DISTRICT_TEXT_NAMES`: Coit Tower, Filbert Steps, Exploratorium, Pier 33, PIER 39, Embarcadero); `POIS` in the city = `CITY_DISTRICT_POIS` + the 24 landmark cards; `contentFor('city')` and the arrival line's fallback read them; the district's `DISTRICT_POIS` untouched | `CITY_DISTRICT_POIS`, `cityDistrictPoi(poi)`, `cityDistrictZh(text)` |
| `game/pelicanFirst.ts` · `game/flow.ts` | **CP-14 two-shot**: the moment's dialogue waits until BAYBAY is within `PAIR_NEAR` 4 u (at most `PAIR_WAIT_MS` 9 s after the unlock); `pelicanMark` (pure) picks her spot `PAIR_GAP` 1.7 u beside you where the conversation camera's six candidate spots (8 u back, 2.3 u up, 25–57° either side: `actors/camera.ts twoShotPose`) see your chest over the ground, never below your feet (the camera stands over the lower of the two); within `PAIR_SNAP` 5 u she is placed on it as the dialogue opens, the two of you turned face to face (the two-shot keeps the side it picks at the first frame); flow's new `setTalkMarkSource` keeps her there while it plays. **Lane F's `pelicanGreet`** (1c27890) is called `GREET_AFTER_MS` 1.5 s in, only when `greetBehind()` says the bird lands behind the pair (see Decisions 3) | `setTalkMarkSource(fn)` (flow), `pelicanMark`, `greetBehind`, `pelicanMarkNow` (QA) |
| `game/album.ts` (**new**, lazy) · `ui/Album.tsx` + `ui/album.css` (**new**, their own chunk) · `game/photo.ts` · `game/photoFrames.ts` · `game/flowStore.ts` · `ui/Moments.tsx` | **W5-C7 photo album**: in the city the shutter's card goes to the album (a JPEG q .92 and a 360 px thumbnail) instead of a download; IndexedDB `opus-bay-album` (stores `meta` with the thumbnail bytes, `full`), else an in-memory album for the page; `ALBUM_MAX` 60 (the oldest leaves); the More item 相册 (order 20: phones 拍照 · 相册 · 小铺 · 设置) and photo mode's thumbnail (now 看看相册) open the overlay `c-album`: a grid (4 / 3 / 2 columns), a photo large with ‹ › and arrow keys, 保存 (phones that share files: the system sheet — iOS 存储图像; else a download), 分享 (the sheet with the file, else the download + the game's link copied), 删除 with 删掉 / 留着; the note says where the photos live. The first shot says 已存进相册 · 点缩略图就能看, later ones 已存进相册. Over photo mode, Escape closes the album first. `fitCaption` shrinks (then cuts with …) a caption that would run into the stamp on a narrow portrait card (a caption that fits is drawn as before); the city caption names the area in the city's words. District mode still downloads the PNG | `addPhoto`, `listPhotos`, `photoFile`, `deletePhoto`, `photosTagged(tag)`, `subscribeAlbum`, `openAlbum(id?)`, `ALBUM_ID`; **`registerPhotoTagger(id, fn)`** / `photoTags(ctx)` (photoFrames: lanes A's view cards and D's nature page tag their shots) |
| `data/sf/residents.ts` · `data/sf/dialogue.ts` · `game/residentTasks.ts` · `game/cityContent.ts` | **W5-C7 second favours**: `task2` for each resident with two new goal kinds — `photo` (a shutter within a spot's radius; Rosa: the Ferry Building clock tower, r 45; Luz: Balmy Alley, Clarion Alley, the Women's Building, 3 of 3, r 16–18; Hank: the Dutch Windmill, r 40; Marcus: Hippie Hill, r 30) and `play` (Ray: lane A's bell riff ends; Dana: lane A's look from the `crissy-beach` view spot, `find view`). The chat: the first favour's thanks → fact, then ask2 [接受 · 下次吧]; declined → a later chat asks at once; on → remind2 [带我去 · 好的]; done → thanks2 → fact2 in the words of the real day (`fact2For`: Rosa on a Saturday market morning, Hank's tulips Feb–Apr / the rest of the year, Marcus on a weekend). Marks in goalsDone `task2-on:` / `task2:` / `task2-p:<key>:<spot>` (dropped when done); the reward `favour:<key>:2` (25); the toasts 新的小忙 / 拍到啦 1/3 · Balmy 巷 / 小忙完成; the waypoint (`favour2:<key>`, a prefix resolver: the nearest spot not photographed yet) leads first. ≈ 60 new bilingual lines | `task2State`, `acceptTask2`, `finishTask2`, `photoHits`, `nextPhotoSpot`, `task2Progress`, `fact2For`, `nodeIds2`, `entryNode(r, done, met, asked2)`, `playGoalMet`, `favour2Spot` |
| `data/sf/letters.ts` (**new**, data) · `ui/Letter.tsx` + `ui/letter.css` (**new**, their own chunk) · `ui/Journal.tsx` · `ui/content-ui.css` | **W5-C7 letters**: `LETTER_DELAY_MS` 150 s after a second favour (`LETTER_RESUME_MS` 25 s into a later visit), on a quiet frame, one per 20 s: `letter:<key>`, the gold toast 收到一封信 · 来自 Rosa and BAYBAY 有你的信！在旅行本的「目标」里～ (all six: 六个邻居都给你写了信——你是大家的好朋友啦！). The Journal's 邻居的小忙 follows the second favour (去找 TA · 带我去 · 已拍 1/3 · TA 说会给你写信～ · 读信 with a dot → 再读一遍) and counts 信 n; the letter (overlay `c-letter`) is a ruled paper card: 亲爱的朋友： · two lines · the signature · 收好; opening it marks `letter-read:<key>` | `letterState`, `deliverLetter`, `readLetter`, `lettersArrived`, `LETTERS` |
| `game/otterMark.ts` (**new**, lazy, city) | **the mark**: once Luz's second favour is done, a 0.72 u painted board with the otter (an original canvas drawing of BAYBAY: warm mural fields, her teal scarf, a heart) leans on Balmy Alley's fence 1.2 u from where Luz paints; one plain Mesh, 12 triangles, 1 draw call only within 140 u, no shadow cast, its own instance of D2's model material, warm-up `c-otter` (checked: the late pass 90 → 90 programs); it goes with Settings → reset. Ray rings your riff (`play-riff-1`, lane A's sound, and his bubble 叮叮——叮叮叮！你教我的那段～) when you pass within 6 u, at most every 4 min | `initOtterMark`, `otterSpot` |
| `ui/PoiCardBody.tsx` · `ui/PlaceCard.tsx` | lane R's request 1a: 现实中怎么去 (`realsf/HowToGo`, lazy) on the city's landmark / POI / place cards | — |
| `ui/Journal.tsx` · `ui/goals-step.css` · `data/sf/placeCards2.ts` | lane N's request: the city journal shows the district's 湾区第一课 only once that lesson was started (the call menu still offers it); lane F's: the goals step `place-items: safe center`; lane A's: the Seward slides' tip — 官网写的是“大人要有小朋友陪着”！带块纸板、穿结实的裤子。 | — |
| `data/VOICE.md` | part-c rows: 小忙 · 信 / 读信 / 收好 · 相册 / 保存 / 分享 · 嬉皮山 · 克里西场海滩 · 威廉明娜女王郁金香花园 · 渡轮大厦的农夫市集 · 小海獭 (not 小水獭: BAYBAY is a sea otter) | — |
| tests (**new**) `opus-bay-w5-favours.test.ts` (10) · `opus-bay-w5-album.test.ts` (5) | CP-14 names (city vs district, no English place name left in the city's zh), the pelican mark on a plateau / rim / level ground, the moment waiting for BAYBAY then opening after 9 s; the second favours (kinds, texts, spots on the real mural places, lane A's view spot), the state machine and its marks, the chat entry, the runtime (accept, a shutter far / near, Luz 1/3 · 2/3 · done, Ray's cancel vs end, Dana's own spot, rewards once), the letters' timing (resume, photo mode, the gap), the words (graph, sizes, sources, fact2 by the day); the album (memory store, File, delete, tags, the 60 cap, the Bay-time file name, the More item and overlay), the taggers, `fitCaption` | — |

### Evidence

- **Checks** on the final tree (after the last rebase over lanes D / T / R): `npx tsc -p tsconfig.app.json --noEmit` 0 ·
  `npx eslint .` 0 errors (43 old warnings outside lane C) · the full opus-bay suite **1295 / 1295** on the pushed tree `1e6ddb35` (`suite-c8.log`, after the rebases over lanes E, V, D and T; 1288, 1291 and 1293 on the trees before them).
  Earlier full runs this part: 1236 / 1236 (`suite-c1.log`), 1277 / 1277 (`c2`), 1284 / 1284 (`c3`, the head pushed as
  `e828ab31`). No wall-clock flake. `npx tsc` / `eslint` / `tsx` all worked (no node_modules workaround).
- **CP-14 in the game** (dev 5503, desktop 1440 × 900 and phone 390 × 844 dpr 3, zh; every shot read):
  - the checkpoint's walker path (Peter-Paul → Coit, BAYBAY left 17 u behind): before the fix the probe showed the player
    on the slope at y 17.2, the camera at y 20.9 on the plaza (paving 20.0) — the wall of paving the checkpoint saw
    (`c/pel1-moment.jpg` first run); after: the moment waits for her, she stands uphill beside you, the camera looks up
    the steps at both (`pc-pelican-slope-desk.jpg`, phone `pc-pelican-390.jpg`, pair 1.4 u apart).
  - on the plaza rim (the part-a teleport spot): a mark down the slope had dropped the camera to 0.8 u over the paving;
    now face to face on the plaza with the city behind (`pc-pelican-rim-desk.jpg`); on the open plaza by the tower the
    two-shot frames both with Alcatraz behind (`pc-pelican-plaza-desk.jpg`).
  - lane F's pelican: seen landing behind the pair in the plaza run before the view guard; in the rim runs it landed
    between the lens and BAYBAY (the follow camera's yaw −0.60 while the two-shot looked the other way: traced 10 frames)
    — the guard now skips that landing (Decisions 3).
  - names: the E prompt reads 看看壁画 · 科伊特塔壁画, the card 科伊特塔壁画 with its tip 官方特别说明：科伊特塔不是照着消防水枪
    喷嘴设计的。(`pc-coit-murals-desk.jpg`, `pc-card-howto-desk.jpg`, which also shows lane R's 现实中怎么去: F 线 The
    Embarcadero & Sansome · 步行约 5 分钟 · 7:00–24:00, Powell–Mason at Mason & Greenwich).
- **The album**: desktop — the shutter toast 已存进相册 · 点缩略图就能看, the thumbnail opens the viewer (保存 · 分享 · 删除,
  ‹ ›), the grid with the note (`pc-album-grid-desk.jpg`), IndexedDB used
  (`albumKind` idb, 2 photos kept); over photo mode the first Escape closes the album and the second leaves photo mode (checked; in the first run photo mode had swallowed it); a photo kept before a page reload is listed after it (IndexedDB: 1 → 1, its caption 湾区小旅 · 渡轮大厦 · 2026年9月28日); phone — 更多 lists 拍照 · 相册 · 小铺 · 设置 (`pc-more-390.jpg`), the viewer on a
  1170 × 2532 card: the caption used to run into BAYLINK (`c/ph-viewer.jpg`), now fitted and cut with …
  (`pc-album-viewer-390.jpg`). The real share sheet / 存储图像 needs a real iPhone (the lead's W5-Z).
- **The second favours**, desktop: Rosa (a saved first favour) — thanks → fact → ask2 in one chat
  (`pc-rosa-ask2-desk.jpg`), 我去拍 → 新的小忙 toast, the waypoint 小忙 · 渡轮大厦钟楼 · 约 55 秒, the journal row with 带我去;
  a photo by the Ferry Building → 小忙完成：给 Rosa 拍渡轮大厦钟楼 + 已存进相册 (`pc-rosa-photo-desk.jpg`), the pill
  🪙 25 (lane E paid `favour:baker:2`); Luz — 拍到啦 1/3 · Balmy 巷 in the alley, then Clarion and the Women's Building →
  done; the otter board beside Luz (`pc-otter-desk.jpg`); Dana — sitting at lane A's Crissy Field beach spot, her
  favour done at the end of the look; Ray — walking past him after his: his bubble and riff (`pc-ray-riff-desk.jpg`; his
  own favour was finished by the bell's `play … end` event in the page, the riff itself on a moving car was not played
  in QA). A letter due from an earlier visit arrived 25 s in: 收到一封信 · 来自 Hank + BAYBAY's line
  (`pc-letter-arrives-desk.jpg`); 读信 with its dot → the letter → 再读一遍, `letter-read:gardener`. Phone: the
  journal's rows (去找 Ray · 读信 with a dot · 已拍 1/3 · 去找 Hank: `pc-journal-390.jpg`) and Rosa's letter
  (`pc-letter-390.jpg`).
- **Rendering / bundle**: the otter board adds 1 draw call and 12 triangles in Balmy Alley only (the Mission, not
  downtown), after the favour, within 140 u; 0 new programs (the late warm-up pass 90 → 90). The album, the letter, the
  otter and the dialogue data are lazy chunks; the main graph grows by the second favours' titles / hints / spots
  (`data/sf/residents.ts`, read by the Journal) and `photo.ts`'s album hand-off and `fitCaption` (a few KB raw).
- **Real-world facts** (checked on the web 2026-09-28; each carries its source in `RESIDENT_SOURCES` / `LETTERS`):
  the Ferry Plaza Farmers Market is on Saturdays 8 am–2 pm, Tue & Thu 10 am–2 pm (foodwise.org,
  https://foodwise.org/markets/ferry-plaza-farmers-market/); the Queen Wilhelmina tulips "are usually in full bloom in
  March", the garden is closed for re-planting in May and October (https://sfrecpark.org/908/Golden-Gate-Park---Queen-Wilhelmina-Gard);
  the SFMTA's 55th Cable Car Bell Ringing Contest was held in Union Square on 10 Oct 2019 (so 已经比了五十多届; no later
  one found: https://www.sfmta.com/press-releases/sfmta-announces-winners-55th-cable-car-bell-ringing-contest); Crissy
  Field's marsh was reconnected to the tides in November 1999 after the 1998–2000 restoration of the old airfield
  (https://home.nps.gov/articles/crissy-field-restoration.htm); Hippie Hill lies between the Conservatory of Flowers and
  Haight Street, was a focal point of the 1967 Summer of Love, and "a drum circle that anyone can join has formed at
  Hippie Hill on weekend days" (https://en.wikipedia.org/wiki/Hippie_Hill). Higgsfield: 0 credits.

### Decisions

1. **CP-14's names are a city layer over the district's POIs** (same ids, spots and facts; zh names and card text in
   the city's words), so the district's frozen texts never change and lane N's zone names (`CITY_HERO_ZONE_NAMES`,
   df53478) and the POI names agree (李维斯广场, 14 号码头, 探索馆 …). Pier 33 is 恶魔岛渡轮码头 per the glossary.
2. **The two-shot fix is lane C's staging, not the camera**: `actors/camera.ts twoShotPose` weighs buildings, not the
   hill, and keeps the side it picks at the first frame, so BAYBAY is put on a terrain-clear, level mark before the
   dialogue opens (a step of ≤ 5 u under the cut to the two-shot, the pair turned face to face). A terrain line of
   sight in the camera itself would be the general fix (Request to F).
3. **Lane F's pelican lands only when it lands behind the pair**: `pelicanGreet` places the bird by
   `runtime.camera.yaw`, the follow camera's yaw, which a dialogue framing does not move; when that view and the
   two-shot's (≈ you → BAYBAY) differ by more than 60°, or the spot it would pick is not ≥ 1.2 u beyond the pair along
   the two-shot's view, the moment keeps no landing — a bird between the lens and BAYBAY was worse than none. In the
   runs above it landed in the plaza run before the guard and was skipped on the rim; it will land more often once F
   reads the rendered camera (Request).
4. **The album is on this device**: bytes (not Blobs) in IndexedDB for older iOS Safari, a memory album when storage is
   blocked (the note then says the photos go with the window); 60 photos, the oldest leaves; 保存 on a phone opens the
   share sheet because that is how iOS saves to Photos, 分享 without file sharing downloads and copies the game's link
   (the plan's fallback). District mode keeps its download (unchanged).
5. **Second favours use `goalsDone` marks** like the first (≤ 15 more ids at most: 6 done, 3 photo marks while Luz's
   is on, 6 letters with `letter-read:` replacing `letter:`), inside the progress save's 128.
6. **The marks**: one thing in the world (Luz's otter board, where she paints — not on a real mural, not on lane H2b's
   boards), one sound (Ray's riff) and words that follow the real day (fact2For); Rosa is not moved to the market on
   Saturdays (the residents' spots are tested and lane V's actors place them) — she tells you when it is on.
7. **Letters live in the Journal's 目标 tab** (the six-tab bar is full at 375 px): lane E's 手帐 could list them later
   through `LETTERS` / `letterState` (Request).
8. **Dana's and Ray's favours listen to lane A's events** (`find view crissy-beach`, `play bell end`), so they need A's
   feature loaded — the only way to do them is A's activity anyway.

### Known gaps

- lane F's pelican rarely lands in the moment now (Decisions 3); the rim / stairs moments have none.
- The share sheet and 存储图像 are not checked on a real iPhone (headless Chrome has no share target), nor Safari's
  IndexedDB (a reload keeps the album in Chrome; Safari may clear a site's storage after 7 days without a visit — the
  album's note tells players to 保存 the ones they love).
- Ray's riff played on a real cable-car ride was not QA'd end to end (the favour's event path and the pass-by riff were).
- The letters' 150 s delay was shortened by a saved state in QA (the 25 s resume path); the 150 s path is tested.
- The otter board is a flat painted board: it reads grey-cream in the alley's shade.

### Not done

- Lane R's request 1 (b) 今天免费 offer chips and (c) the coast cards' tide row (only (a) 现实中怎么去 is in).
- Voice for part c's lines (≈ 60, text only; not frozen for lane V in this part).
- No real-iPhone pass (the lead's W5-Z).

### Requests

- **F** (`actors/moveSystem.ts pelicanGreet`): place the bird by the rendered camera's direction (the camera rig's pose;
  during a dialogue framing `runtime.camera.yaw` stays the follow yaw) — lane C's `greetBehind` guard can then go, and
  the pelican lands in every moment. Optional (`actors/camera.ts twoShotPose`): weigh the ground between the camera and
  the pair (a terrain line of sight) as it weighs buildings.
- **E**: `favour:<key>:2` (six sources, 25 each) go to `play.e`; append them to `economy/sources.ts FIXED_SOURCES` when you
  next append. Optional: a 信 page in the 手帐 from `data/sf/letters.ts LETTERS` + `letterState` (the Journal's 目标 tab
  has them today); the album's `photosTagged` for a photo page.
- **A** / **D**: `registerPhotoTagger(id, fn)` (game/photoFrames.ts) tags a shot taken at a view spot / a nature find
  (`view:<id>`, `nature:<id>`); `photosTagged(tag)` (game/album.ts, lazy) gives the photos for the view cards / the
  nature page.
- **V** (H5-3, optional): part c's resident lines stay text; if they are wanted as voice, lane C freezes them next
  (they are in `data/sf/dialogue.ts SCRIPTS2` and `data/sf/letters.ts`).
- **Lead** (W5-Z): on the real iPhone — 保存 in the album opens the share sheet and 存储图像 lands in Photos; the album
  keeps its photos after closing and reopening the tab.

Status (no relayed owner message arrived): 进度——检查点的鹈鹕镜头和中文名字已修好，相册、六位邻居的第二个小忙和来信都做完并推送，报告已写。
