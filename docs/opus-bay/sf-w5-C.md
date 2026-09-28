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
