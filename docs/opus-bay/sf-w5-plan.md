# Opus Bay wave 5 · plan: fix the five, then a San Francisco you can play with, on the same day as the real one

Written 2026-09-28 by the wave-5 judge and planner (read-only for the product; code read at `origin/opus-bay` **1d2cd76**,
site data compared with `origin/main` **b252853**). Inputs: the three proposals (`proposal-cozy.md`,
`proposal-action.md`, `proposal-real.md`), the five scouts (real-world, gameplay, eggs, gaps, capacity; their notes are
under `C:/Users/willy/opus-qa/w5/`), `docs/opus-bay/owner-feedback-2026-09-27.md` (F1–F5), `sf-w4-plan.md` §5.1 and
`sf-w4-lead.md` §8 (ownership after wave 4). The lead commits this file as `docs/opus-bay/sf-w5-plan.md`.

**The owner's request** (2026-09-27, relayed): 需要完善整个旧金山，然后需要联动现实信息，更好完善游戏的开放，探索，游戏性，彩蛋等，
动作或者趣味性可以考虑增加 — polish the whole of San Francisco, link real-world information, improve openness,
exploration, gameplay and easter eggs, add actions and fun; keep going; schedule it yourself. Players are on desktop
and iPhone. The owner does not want to be asked: every open question has a default in §6.

Contents: [1 摘要](#1-给主人的摘要) · [2 Must-fix first](#2-must-fix-first-the-owners-five-points-and-the-blocking-fun-gaps) ·
[3 Features by theme](#3-features-by-theme) · [4 Lanes](#4-lanes-for-wave-5) · [5 Higgsfield](#5-higgsfield-plan) ·
[6 Risks and defaults](#6-risks-and-defaults) · [7 Appendix A: how the proposals were scored](#7-appendix-a-how-the-proposals-were-scored) ·
[8 Appendix B: facts and sources](#8-appendix-b-facts-and-sources)

---

## 1. 给主人的摘要

1. 这一波叫"完善"：先把你试玩遇到的 5 个问题彻底修好，再让旧金山**好逛、好玩、和现实"同一天"**。
2. **落地卡住**：原因已在代码里确认——第一次走到大景点时有 2.4 秒的镜头，镜头结束后没有解锁，要等下一次开关对话才解开。第 0 天先修好、马上重打手机包；之后改成"每帧自动判断能不能动"，再加 1 秒看门狗，每一种落地/到达方式都有测试。
3. **走不动**：机器人自动走遍全城（每个景点到达点、每个车站、三条步道、金门大桥桥面），卡住的点逐个修；贴着栏杆会顺着走，矮墙长椅会自动翻过去，卡住 1 秒 BAYBAY 会跑来"嘿咻"把你拉出来；观光巴士不再停在路上不动；桥上镜头不再横过来。
4. **鹈鹕**：开局第一个目标就是"去科伊特塔找鹈鹕朋友"（约 1 分钟），任何一个观景台都能解锁，一日游第一站也会解锁；解锁后有一段约 90 秒的"第一次飞行"（穿圈、圈里有金币）；手机上只要在走路，"起飞"按钮一直在。
5. **一键导航**：地图上点一下（或长按任意位置）→ 一个大按钮直接出发；有鹈鹕后，远的地方默认飞过去，没去过的地方也能飞；碰一下摇杆就自己接手。老玩家打开游戏直接回到上次的位置，BAYBAY 说"欢迎回来"。
6. **金币和小铺**：金币沿台阶、码头尽头、观景小路摆（每天刷新），屋顶和天上的金币圈要飞过去才拿得到；小铺在"更多"里和渡轮大厦后面的摊位，卖 BAYBAY 围巾帽子、车漆、鹈鹕丝带、相框、寻宝罗盘。不卖速度，不用真钱，不用刷。
7. **旅行手帐**：盖章、彩蛋、看过的风景都收进一本手帐，集满一页有奖励；手帐开头写"明天可能不一样"，没有连续签到。
8. **24 个真实彩蛋**，分布全城：电报山野鹦鹉、中国海滩的华人渔民、唐人街老电话局、雾里金门大桥的雾笛二重唱、市花大丽花 100 岁、要塞 250 岁生日小路、会报真实时间的大日晷……每个都有出处和核对日期。
9. **能玩的事**：挥手、跳舞、和 BAYBAY 自拍；摸摸 BAYBAY；随地坐下看风景；Seward 街纸板滑梯和 BAYBAY 比赛；缆车摇铃；和 BAYBAY 比赛爬台阶。
10. **联动现实**：天色按旧金山真实日出日落变化；这周 BAYLINK 上的真实活动出现在真实场地（10/2–4 金门公园免费蓝草音乐节、10/4 卡斯特罗街集 11–18 点；10/9–11 中午 12 点到下午 4 点舰队周飞行表演——游戏里同一时间有玩具飞机编队），点一下能"带我去"、加入想去、打开 BAYLINK 活动页；"今天"页一眼看完今天的旧金山，还有每天三件小事；海滩篝火只在真实季节（3–10 月）亮。
11. **完善整个旧金山**：外围街区（Irving、Clement、24 街、Bayview 第三街起，最多 8 处）各有一个有特色的街角，晚上外围不再一片黑；市中心先"减负"再加东西，保证手机流畅。
12. **10 条线同时做**（手感、导航、内容、交通、地标、画面性能、金币手帐、玩法、彩蛋、现实联动），每条都有测试、手机 390×844 截图和报告。
13. **时间**：10/1 晚出第一版手机包（不卡住、先拿鹈鹕、老玩家继续、真实日落、这周活动上地图），10/7 晚第二版（走路修完、一键导航、金币、舰队周），10/14 第三版（小铺、玩法、彩蛋），10/16 总验收；10/31 和 11/1（篝火季结束、夏令时结束）再做一次实地检查。
14. **Higgsfield** 预计用约 100 分（上限 130；余额约 400，至少留 80）：小铺图标、6 张"彩蛋明信片"、约 300 句新语音、几张参考图。
15. **不做**：浏览器里直连第三方实时数据（正式站的安全策略会拦，本地却不会，容易"本地好好的，上线就坏"）、倒计时/连续签到/失败惩罚/抽奖、在市中心加大模型。没定的事都按第 6 节默认做法推进，不用你拍板。

---

## 2. Must-fix first: the owner's five points and the blocking fun gaps

These ship before any feature in §3 is allowed to slip them. Each has an acceptance test that fails on `1d2cd76` and
must pass in the build named. "Phone profile" = 390 × 844, dpr 3, touch, quality mid (and 375 × 667 for layout);
"desktop" = 1440 × 900, quality high, RTX flag.

| id | what | owner lane(s) | build |
|---|---|---|---|
| MF1 | F1 · never stuck after a landing or arrival | lead (day-0 hotfix) → F | 1 (hotfix: day 0) |
| MF2 | F2 · forgiving movement, rides that arrive, the GGB deck, arrivals facing open ground | F, T, L, N, C | 2 |
| MF3 | F3 · the pelican first | C, F, A | 1 (goal + button), 2 (moment + first flight) |
| MF4 | F4 · one tap to go anywhere | N (+ F, T) | 2 |
| MF5 | F5 · coins, the ledger, the shop (and a save that cannot wipe progress) | lead (save, day 0), E | 2 (coins), 3 (shop) |
| MF6 | Returning players resume; goals shown once; a quiet HUD (gaps S12, S13, S19) | N, C, F | 1 |
| MF7 | The real city is visible in the world (gaps S14) | lead (data merge), R | 1 (venues, sun), 2 (SF Today) |
| MF8 | Something to do in every part of the city (gaps S15) | A, D | 3 |
| MF9 | Downtown room and bundle room before anything is added there (capacity) | V, F, T | 1 (first levers), 2 (all) |
| MF10 | The whole city looks finished at street level, day and night (gaps S16) | L, V | 3 |

### MF1 · F1: never stuck after a landing (root cause confirmed in code)

**Cause** (all three proposals found it independently; I re-read it at `1d2cd76`):
- `game/cinema.ts` `playShots()` sets `runtime.player.locked = true` (l.34); `finish()` (l.40–46) clears the sequence
  and the caption but never recomputes the lock.
- `game/guideCity.ts` `reveal()` (l.605) calls `playShots('arrival', revealShots(plan), done)`; `done` shows the
  ArrivalCard and schedules the panorama and never calls `game/flow.ts refreshLock()` (l.61).
- The reveal plays on the first arrival at a tier-1 attraction **on foot** with motion allowed and quality not low
  (`game/arrival.ts` l.316): every Grand Tour stop, and every walk into a big landmark right after a glide landing or a
  飞过去 — "often, not always", the owner's words.
- Closing any dialogue runs `refreshLock()` (`flow.ts` l.209): the owner's workaround 需要对话后，才能移动, and the gaps
  scout's 问 BAYBAY → 没事，继续逛.
- `game/fastTravel.ts` writes the lock directly as well (l.195 true, l.252 false): a second writer outside the rule.

**Fix, in two steps.**
1. **Day-0 hotfix (lead, W5-0b):** `cinema.finish()` calls a lock refresher registered by flow (`setLockRefresher`,
   no import cycle); fastTravel goes through `holdLock('travel')`; a 1 s watchdog frame system (phase playing, no
   dialogue / panel / cinematic / ride / fishing / travel / activity, yet locked > 1 s → unlock + a `stuck` event with
   `what: 'watchdog'` + a DEV warning); R (unstuck) also clears a stale lock. A failing test first. The phone package is
   rebuilt the same day.
2. **W5-F1 (lane F):** the lock becomes derived. `game/playerLock.ts` (API frozen at day 0) keeps the held sources;
   one frame system writes `runtime.player.locked = dialogue || fishing || cinema || riding || phase ≠ playing ||
   lockHeld()`; no module writes `runtime.player.locked` directly any more (a grep test); new activities (lane A), the
   shop try-on (E) and camera beats (D) lock only through `holdLock`.

**Acceptance.**
- Unit, red on `1d2cd76`: `playShots(...)` → step to the end → `runtime.player.locked === false` when no other source holds.
- Integration (`tests/opus-bay-w5-lock.test.ts`), one case per path, each asserting the player's controller moves
  ≥ 1 u within 1 s of the path ending: tour-stop reveal; trip end (walk); 飞过去 to a first-visit tier-1 site; glide
  landing then walking into a tier-1 zone; ride hop-off on bus, LRV, cable car, F-line and ferry; ArrivalCard close;
  viewpoint panorama; telescope; resident chat close; photo-mode exit; map close; shop try-on close; a PlayKit activity
  end; an egg camera beat end.
- Grep test: no `runtime.player.locked =` outside `playerLock.ts`.
- Phone e2e (lead / V, W5-Z): the gaps scout's two reproductions (GGB Welcome Center, Sutro Baths) and the 14 paths above
  scripted: stick moves ≥ 3 u in 1.5 s after each; 0 watchdog releases logged on the scripted run (a watchdog release is
  a bug with a source, not a fix).

### MF2 · F2: forgiving movement, rides that arrive, the GGB deck, arrivals facing open ground

**The sweep (lane F owns the tools; each lane fixes what is in its files).**
- `scripts/opus-sf/qa/sweep-static.mts` (node, deterministic, minutes): on the published chunks (the `sf-disk` loader),
  for every target run `canStand` + nav reachability + a 5 u walk in 4 directions. Targets: all 134 attraction
  arrivals, every loop / N / M / F-line / cable-car / ferry stop's platform exit, the three routes' waypoints, every
  event venue point (R), coin trail and cache spot (E), egg spot (D), view spot and activity start (A), postcard.
  Output `C:/Users/willy/opus-qa/w5/sweep/static.json`.
- `scripts/opus-sf/qa/walker-sweep.mjs` (headless, the real controller through the `__opusBay` QA hooks): teleport to each
  target, drive the stick 1.5 s in 4 directions, then walk the three routes and the GGB deck end to end (both ways)
  holding forward with the follow camera; plan and auto-run a trip from the Ferry Building to every T1 / T2 attraction in
  walk mode with a limit of 1.3 × its quote. Output JSON + a contact sheet of every failure.
- Triage by owner: controller / slopes / deck steering → F; landmark blockers, exclusions over paths, tier-3 arrival
  points → L; `arrivalSpot` / fastTravel landings → N (+ F's `faceOpen` helper); bus and crowd → T; the deck-crossing
  goal → C.

**Forgiving feet (lane F; walk speed, jump and stair rules unchanged).**

| move | when | guard rails |
|---|---|---|
| slide along | pushing into a wall or rail within 35° of a deck / narrow-path / stair-landing direction: keep walking along it (lower `SLIDE_MIN` there, steer the wish direction onto the walk-graph heading) | decks, piers and paths only; open ground unchanged |
| auto-vault | running or jumping into a blocker whose known `top` ≤ feet + 1.1 u with standable ground ≤ 1.6 u beyond: a 0.35 s hands-on hop | only blockers with a measured `Blocker.top`; unknown top = wall; never when the far side is > 0.75 u lower; `noVault` on cliffs, bridge rails, pier ends; never onto a roof |
| BAYBAY pull | ≥ 1.2 s of pushing with < 0.3 u progress: BAYBAY runs over, 嘿咻！, pulls the player ≤ 4 u to `nearestWalkable` in the input direction | never across water or a building; every pull emits `stuck {what:'pull'}` with x/z (DEV log → sweep list) |
| mantle (should) | Hop against a ledge 0.55–1.6 u high with standable ground on top | `canStand` inside `inWorld`; never onto roofs |

**Arrivals face open ground (F + N + L).** Every arrival and landing snaps to `actors/nav arrivalSpot` with free ground
in front (the lead's §8.4 fastTravel item), and player + camera turn to the longest free direction (F's new
`faceOpen(x, z)` helper). Lane L3's tier-3 arrival points are fixed in their site records (Seward inside its blocker,
Vermont in a shrub, McLaren 100 u off, Mountain Lake 26 u off, the sundial 10 u off, the Wave Organ across the harbour).
A walk that starts inside a landmark footprint steps to the nearest walkable exit and retries (lane G's open item).

**The sightseeing bus moves (lane T).** Instrument the loop buses (position, speed, reason when stopped); fix the Mason
St (Marina) and Lincoln Blvd (Presidio) stalls (road-vehicle collision, a stuck kerb stop, a stream wait); cap dwell
and wait; ETA from real progress along the path; after 10 s without progress 直接到站 becomes the big button; during the
直接到站 veil a hop-off or fly-to is honoured (lane T's open item); the tour's own bus boards without the driver
question.

**The GGB deck (F + T + C + N).** On bridge decks the follow camera stays behind along the deck axis and the hero-point
tower rule (`actors/cityViews.ts cityHeroPoints`) is relaxed there; forward input follows the deck; the crowd keeps a
3 u lane down the deck centre (T); 走过金门大桥 counts passing within 10 u of both towers and says its progress on the deck
(C, `cityDetectors`); the area chip says 金门大桥 on the deck (N).

**Acceptance.**
- `static.json` and the live sweep: **0 stuck targets** (a target is stuck when fewer than 3 of 4 directions move
  ≥ 3 u); any exception is a named waiver in lane F's report, and no T1 / T2 attraction, station or event venue may be
  waived.
- Trips: every Ferry → T1 / T2 walk trip arrives within 1.3 × its quote; 0 BAYBAY pulls on the three routes by W5-Z.
- Bus (quiet machine, lead): the loop's Ferry → GGB leg within 1.3 × its quote; no ETA frozen > 15 s; 直接到站 is the big
  button after 10 s without progress.
- GGB: holding W (desktop) or the stick up (phone) from the south anchorage to the north end: speed never under 3 u/s
  over any 3 s window, camera yaw within 25° of the deck axis, the goal completes on the first crossing.
- Guards: synthetic-world tests that vault never crosses a `noVault` edge or a drop > 0.75 u and never lands on a roof;
  pull never crosses water.

### MF3 · F3: the pelican first

- **Goal #1** (C): in city mode `data/sf/goals.ts CITY_FREE_GOALS` starts with the pelican: 先去科伊特塔找鹈鹕朋友 / Meet
  the pelican at Coit Tower, reward text 解锁：随时飞 / Unlocks flying (+20 coins, E), a pelican icon, the waypoint; BAYBAY's
  first free-roam suggestion says it. Coit is ≈ 70 s from spawn.
- **Any viewpoint unlocks it** (C): Coit or any of the six panorama viewpoints, whichever comes first.
- **Tour players fly too** (C): the Grand Tour unlocks the pelican at the first tour stop reached, with a line, no route
  change (a Coit detour would add minutes to a tour already quoted too short).
- **The unlock is a moment** (C + A): a brown pelican lands beside the player, BAYBAY: 以后想去哪都能飞啦！先试试起飞？; then
  the **first flight** (A, skippable, ≈ 90 s): 8 big rings from Coit over the Ferry Building along the Embarcadero to
  PIER 39, coins in each ring; phone: 起飞 pulses once; desktop: the G keycap hint once.
- **起飞 always visible on phones** (F): `actors/TouchControls.tsx` l.114 renders 起飞 only when `!focus`, and BAYBAY in
  talk range is usually the focus (visible in 7 of 23 samples). Give it a fixed slot in the move column; hide it only
  in a dialogue, panel, cinematic or ride; BAYBAY in talk range stops counting as focus for it (talk through 问 BAYBAY).
  Also the routed `HUD_BOX_SELECTOR` item (`'.ob-move-buttons > *'`) and the 667 × 375 landscape column.
- **Acceptance:** a scripted new player on the phone profile is gliding within 2 min of the welcome choice; 起飞 visible
  in 23 / 23 on-foot samples after the unlock; a tour player is unlocked by the end of chapter 1; the Alcatraz name line
  plays on the first loop round the island (D's egg).

### MF4 · F4: one tap to go anywhere

- **The big button travels** (N). Tapping 🐦 飞过去 · 8 秒 / 🚶 BAYBAY 带路 · 3 分钟 / 🚲 骑车 · 2 分钟 closes the map and moves at
  once: auto-walk / auto-run the whole route with BAYBAY leading (the keyboard-only `GuideLeadChip` becomes the rule on
  every device), auto-follow persists across legs, and any stick, WASD, click or tap takes over. A chip in the trip-pill
  slot says BAYBAY 带路中 · 碰摇杆接管 (desktop: 按方向键接管). The 问 BAYBAY sheet gets 带我去 (当前目的地).
- **Best mode** (N, `game/tripPlan.ts` l.533 rule): after the pelican unlock, 推荐 = 飞过去 for any trip over ≈ 60 s,
  **including places not yet discovered** (the landing is the discovery: an arrival with `first: true`, a descent beat
  instead of the on-foot reveal). Before the unlock: the fastest honest ground mode. Goal options (bus, climb, ride) stay
  under 其他方式 with their goal / coin badge, so the lines keep a reason to be ridden; flying never completes a ride or
  climb goal (`FLY_NOTE`, tested).
- **Phone map** (N): a badge tap opens a compact card pinned over the map with the go button in view; a cluster tap
  opens a small chooser; **long-press any map point → 去这里** (the nearest walkable arrival spot); search results carry
  the same button.
- **One ETA source** (N + T): the map label, the card, the list and the pill show the same time, at the pace actually used
  (7.5 u/s auto-run, the ride's progress-based ETA from T).
- **Every real-world row can go** (R, D, E use N's `goTo()`): event pennants, SF Today rows, EventCards for SF venues,
  rumours, the treasure compass.
- **Acceptance:** from the phone map any place in ≤ 2 taps to moving; desktop reaches the GGB from the Ferry Building with
  0 steering; `sf-trip`: 推荐 = fly for d > 60 s once unlocked, fly offered for undiscovered places, never before the
  unlock; the four ETA displays agree within 10 %.

### MF5 · F5: coins, the ledger, the shop, and a save that cannot wipe progress

- **Save first (lead, day 0):** `data/save.ts encodeSave` today falls back to `{version, lastSafe}` when over 64 KB,
  which would wipe the glide unlock, tours, arrivals and coins. New order: trim `discovered` to 500, then `arrivals` to
  128, never drop `play`, `unlocked`, `tours` or `lastSafe`. `SaveV2.play` (frozen format `data/playSave.ts`, §4.2) is
  learned by `decodeSave` (it drops unknown fields today) with a fuzz test like `decodeTours`, and a size test at every
  cap (2,000 discovered + 512 arrivals + 8 tours + a full `play`) stays under 64 KB.
- **Coins, the ledger, the shop:** lane E, specified in §3.4.
- **Acceptance:** each reward source pays once (fuzzed ledger); save round trip; the size test; the coin pill shows on
  both devices; a scripted 60-minute "typical play" run (arrivals, a stair trail, two eggs, a postcard, the daily three)
  earns enough for 3–5 cosmetics; nothing in the shop changes speed, access or places.

### MF6 · Calm first minutes: resume, goals once, a quiet HUD

- **Resume** (N): with a save, the title's primary button is 继续旅程 and resumes at `lastSafe` (snapped to a standable
  spot); 从头开始 is secondary. BAYBAY (C): 欢迎回来！上次我们走到金门公园了。 plus one SF Today line (R), never 第一次来吗？.
- **Goals once** (C + F): after the welcome choice the goals appear once as a modal step with bubbles paused, the pelican
  first. Afterwards the top-right pill always opens the Journal (on 今天, whose first row is the next goal; the full list
  is the 目标 tab) and never toggles a hidden card.
- **Quiet HUD** (N): minor discoveries batch into one `+N 个地点` chip; only attractions toast (12 toasts in 50 s today);
  one waypoint owner (the running trip, else the chosen goal); the district's 湾区第一课 0/7 list is hidden in city mode.
- **Acceptance:** a returning save resumes where it was (phone and desktop); the goals step shows exactly once per new
  player; walking Ferry → Coit fires ≤ 2 toasts.

### MF7 · The real city is visible in the world

- **Site data current** (lead, W5-0c): merge `origin/main` (104 events / 28 places / 97 guides, checkedAt 2026-09-27;
  adds `sf-castro-street-fair-2026`, `sf-fishermans-wharf-chowder-fest-2026`, the Lands End / Mission Dolores places and
  guides). Resolve `vercel.json` by taking main's routes and keeping `git.deploymentEnabled.opus-bay: false`; keep the
  `.vite-opus` ignore in `eslint.config.js`. Rebuild both local servers.
- **Events at their venues, real sun, SF Today:** lane R, specified in §3.3.
- **Acceptance:** with `?date=2026-10-03T10:30` the Yerba Buena Gardens card lists the African Arts Festival and a pennant +
  crowd stand at Hellman Hollow; with `?date=2026-11-05T10:30` nothing expired shows and the honest "none this week"
  line appears; the sky's golden → night boundary on `?date=2026-12-21` falls at 17:23 (civil dusk), not 19:00.

### MF8 · Something to do everywhere

- At least one small verb or find in each of 8 areas (North Beach / Telegraph Hill, the Wharf, Chinatown / downtown,
  Marina / Presidio, Golden Gate Park, the west coast, the Mission / Castro / Twin Peaks, Bayview / the south-east), from
  lane A (activities) and lane D (eggs). **Acceptance:** the notebook's pages list ≥ 1 find or activity per area; the gaps
  scout's 20-minute phone script finds ≥ 5 things to do that are not cards.

### MF9 · Room first (downtown triangles, phone CPU, bundle)

- Levers, each in its owner's lane, all city-mode only (district mode unchanged): district NPCs hidden beyond 250 u (V:
  −33k tris, −6 calls at Twin Peaks); district bikes / car hidden beyond 250 u (F: −15.6k, −10 calls); low-poly shadow
  proxies for the player and BAYBAY (F: −17.1k shadow tris in every view); per-instance distance cull for district life
  (T: −33k at Civic Center / Chinatown); a far stand-in for the hand-made district buildings (V: −81–97k); a cable-car /
  F-line far LOD with shadows only near the camera (T: ≈ −22k).
- Bundle (V): move the city-only data (≈ 28 KB gzip: `data/sf/landmarks.ts`, cityPois, postcards, places, residents,
  goals, arrivals) out of the GameRoot graph; every wave-5 module is a lazy city chunk (type imports only; the P7 guard).
- Label atlas overflow guard (V).
- **Acceptance (V, re-run by the lead on a quiet machine):** ≤ 150 calls and ≤ 400k tris (shadows included) at quality
  high in every spot of lane V's gate table (§4.9); phone profile at 4× CPU ≥ 45 fps walking at the Ferry gate, Chinatown and Twin
  Peaks (it is 23–44 today) and ≥ 45 in the outer spots; programs equal at 1× idle and 4× walk; GameRoot ≤ 265 KB gzip
  (≤ 250 stretch; 292.4 today); district contact sheet unchanged. **Nothing new is added downtown (the Ferry gate,
  Chinatown, the Financial District, Union Square) until V publishes the measured headroom after the levers.**

### MF10 · The whole city looks finished

- Signature corners in the outer districts and lit outer streets at night: lanes L and V, §3.6. **Acceptance:** each
  corner has a golden-hour and a night shot at street height on the phone; the 12-neighbourhood night pass of the gaps
  scout shows lit windows and lamps at player level in every one.

---

## 3. Features by theme

Budget columns everywhere: extra draw calls / triangles in the worst view where the item shows, lazy chunk KB gzip,
save bytes, credits. Rules for all themes: no new permanent phone buttons; at most one toast at a time; everything
lazy in city mode; instanced hosts or DOM; every real fact carries `sourceUrl` + `verifiedAt` and cautious wording; no
logos, marks, film stills, copied murals or artworks; nothing pressures the player (no timers that take anything away,
no streaks, no fail states, no speed rewards downhill, no loot boxes, no real money).

### 3.1 Exploration and easter eggs (lane D; notebook page by E)

**小发现 batch 1: 24 real San Francisco easter eggs** (must). Facts, lines (zh ≤ 45 characters), triggers and
coordinates are in `C:/Users/willy/opus-qa/w5/eggs-out.json` (checked 2026-09-27). Coordinates marked approx there are
snapped from OSM before placing and every spot is in the sweep. Each find: a reveal (sound / animation / one BAYBAY
line), a stamp on the notebook's 小发现 page, 10 coins (`reward egg:<id>`), a fact card with its source.

| # | id | area · city x, z | trigger → reveal | source (checked 2026-09-27 unless noted) | host / cost |
|---|---|---|---|---|---|
| 1 | telegraph-hill-parrots | North Beach · −27, 37 | random fly-over mornings / late afternoons; standing still 4 s on the Greenwich / Filbert steps → 2–3 perch; the 2023 official-animal line | en.wikipedia.org/wiki/The_Wild_Parrots_of_Telegraph_Hill; sfchronicle (official animal 2023) | gull pool recoloured, +1 call only while flying (after MF9) |
| 2 | pier39-sea-lion-season | Wharf · −158, 22 | dock density and bark volume follow the real month, "usually" words, never a count; BAYBAY 看就好，别喂 | pier39.com/sealions (09-28: numbers rise and fall with the seasons; record 2,100+ in May–June 2024; feeding unlawful) | existing instanced sea lions, 0 |
| 3 | musee-laughing-lady | Wharf · −212, 66 | at the Pier 45 arcade door: our own synthesized cackle + BAYBAY giggle (no figure, no historic laugh) | atlasobscura.com (Laffing Sal); en.wikipedia.org/wiki/Musée_Mécanique (09-28) | audio + line, 0 |
| 4 | chinatown-telephone-exchange | Chinatown · 27, 134 | an old phone rings by the pagoda door once a real day; a fictional operator asks 你找谁？ → pick BAYBAY / a resident / 草药店 | kqed.org/arts/13960573 | DOM bubble + sfx, 0 |
| 5 | fortune-cookie-trail | Tea Garden −243, 964 + Ross Alley ≈ 11, 136 | one cookie per Bay day; the fortune is a real free thing to do (from the place index), 据说 wording for the origin | en.wikipedia.org/wiki/Makoto_Hagiwara; atlasobscura (Ross Alley since 1962) | DOM, 0 |
| 6 | emperor-norton-bridge-decree | Bay Bridge anchorage · 278, 72 (approx) | a rolled "proclamation" on a lamppost (our paraphrase, crown icon, affectionate) | emperornortontrust.org/bridge/proclamations | 1 prop < 200 tris in D's pool |
| 7 | wave-organ-high-tide | Marina · −412, 290 | ear to a pipe → 25 procedural pipe voices (louder near high tide once the tide table ships, else mid level) | exploratorium.edu/visit/wave-organ | audio, 0 |
| 8 | crissy-field-dusk-landing | Presidio · −576, 546 | land the pelican on the lawn in the dusk band → windsock + the 1924 dawn-to-dusk flight line | en.wikipedia.org/wiki/Dawn-to-dusk_transcontinental_flight_across_the_United_States | fx pool, 0 |
| 9 | baybay-otter-roots | Fort Point · −750, 590 | first time at the water there: BAYBAY floats on her back and tells of her Bay cousins (gentle about the fur trade) | marinemammalcenter.org (sea otters and SF); montereybayaquarium.org sea-otter page (09-28) | BAYBAY `float` emote, 0 |
| 10 | octagon-house-time-capsule | Cow Hollow · −184, 292 | a tin by the steps → an 1861-style note (our words) and **the player's own time-capsule page** (places, stamps, days played) | nscda-ca.org/octagon-house/…/history-uncovered | DOM, 0 |
| 11 | alcatraz-pelican-island | the Bay · −468, −58 | close a pelican loop round Alcatraz → wing-waggle, 5 pelicans join, "Alcatraz" = old Spanish for pelican; a second loop gives the respectful water-tower (1969–71) line | parksconservancy.org/our-work/alcatraz-glance; nps.gov/goga (occupation) | pelican pool, 0 |
| 12 | ggb-foghorn-duet | GGB · −866, 509 | in fog: the real two-voice pattern (south pier 2 s on / 18 s off; mid-span two tones 1 s–2 s–1 s, 36 s pause) replaces the single foghorn; hearing both on the deck = stamp; the hum stays rare (fix completion unconfirmed) | goldengate.org/bridge/history-research/bridge-features/foghorns-beacons/ | audio, 0 |
| 13 | golden-gate-humpback | the Gate · −817, 564 | ≈ 1 in 6 crossings (ferry, pelican, deck) in real April–November: spout, back, fluke; the ferry slows, never chases | baynature.org (2018-11-13); onlinelibrary.wiley.com/doi/10.1002/aqc.4107 | fx pool + 1 small mesh < 500 tris, transient |
| 14 | lands-end-labyrinth | Lands End · −743, 1102 (approx) | present on ≈ 70 % of real days (date seed); walk the path to the centre → the camera frames the bridge | atlasobscura.com/places/labyrinth-lands-end; nps.gov lands-end point | stones in D's pool, outer city |
| 15 | china-beach-fishermen | Seacliff · −622, 961 | golden hour on the sand → 3 translucent junk-sail silhouettes for 6 s, 据说 wording | nps.gov/goga/learn/historyculture/the-history-of-china-beach.htm | +1 call transient, outer |
| 16 | dahlia-dell-100 | GGP · −174, 845 | bloom June–October (in bloom now); a small "100" sign all of 2026 | abc7news.com (100th anniversary); dahliadell.org/history | instanced flower +1 call, outer |
| 17 | tiled-steps-sea-to-stars | Inner Sunset · −113, 1143 | climb the 163 steps in one go: ambience crossfades bubbles → birds → star chimes | 16thavenuetiledsteps.com | audio, 0 |
| 18 | karl-the-fog-diary | Twin Peaks · 126, 938 | fog + summit: Sutro Tower's tips above Karl; lines by real month (Sep–Oct "Karl often takes time off"); the Twain quote myth | kqed.org/news/11682057; quoteinvestigator.com/2011/11/30/coldest-winter/ | lines, 0 |
| 19 | ingleside-sundial-real-time | SW · 284, 1438 | the giant dial's shadow points at the **real** SF solar time now (R's sun math); no shadow at real night, BAYBAY yawns | noehill.com/sf/landmarks/sf293.asp; outsidelands.org/sundial.php | 1 decal quad, 0 new program |
| 20 | golden-hydrant-1906 | Mission · 248, 727 (approx, 20th & Church) | glints gold; on 18 April 05:00–09:00 Bay time a brush repaints it | en.wikipedia.org/wiki/Golden_Fire_Hydrant | 1 prop in D's pool |
| 21 | castro-rainbow-steps | Castro · 162, 755 (approx) | cross the rainbow crosswalk → 12 rainbow footprints fading over 6 s (plaques unreadable, no names) | en.wikipedia.org/wiki/Rainbow_Honor_Walk | fx decals, 0 |
| 22 | herons-head-from-above | Bayview · 924, 457 | the pelican over the park → a 2 s top-down beat, the outline glows, marsh calls | en.wikipedia.org/wiki/Heron%27s_Head_Park; sfport.com/heronsheadpark | camera beat, 0 |
| 23 | sf-250-birthday-trail | Presidio −451, 576 · Mountain Lake · Mission Dolores | three 1776 stops in any order; a "250" banner all of 2026 and every 17 Sep; **always paired with the Ohlone line** | presidio.gov (2026 press); missiondolores.org/old-mission; hmdb.org 155202 | a flag with an existing glyph |
| 24 | alta-plaza-chipped-steps | Pacific Heights · −192, 460 (approx) | drive the toy car to the top of the south steps → it stops politely, zoom on a chipped edge, the 1972 movie-chase line (no title stills, no actors) | sfchronicle.com (What's Up, Doc? Alta Plaza); en.wikipedia.org/wiki/Alta_Plaza_Park | camera beat, 0 |

Not in batch 1 on purpose: the Portsmouth Square galleon (the square is closed to 2028, wave-4 R9), the Salesforce Park
bus fountain (the park deck is in the frozen hero slab, no host), Bummer & Lazarus (new skinned dogs downtown), the free
Sunday band (the Golden Gate Park Band season is April–September and **ended Sep 27, 2026**, goldengateparkband.org,
checked 2026-09-28: corrects the eggs scout's April–October).

- **Finding without pins:** silhouettes with one-line riddles (≤ 20 zh characters) on the notebook page; residents and
  BAYBAY drop 听说… rumours about an unfound egg in the current zone, at most one per 5 minutes (C's rumour hook); the
  shop's 寻宝罗盘 points toward the nearest one for one outing.
- **UI.** Phone: the reveal plays in the world, the fact card is a small DOM card above the bottom bar (tap to open, auto
  closes in 6 s); desktop: the same card, E to open. The one-toast rule holds (a find replaces the toast, never stacks).
- **Budget:** 0 calls for 16 of 24; ≤ +1 transient call each for parrots, junks, humpback, flowers; ≤ 3k tris total;
  ≈ 12 KB lazy; save: the `egg` bitset (24 bits now, room for 1,536); credits ≈ 2 (lines, in H5-3).

**Should (after the musts):** batch 2 (12): Mount Davidson top of SF, the Telegraph Hill semaphore raising its arms when
the ferry passes the Gate, the Sutro Baths sea cave (closed in big surf), the Lands End low-tide wrecks (needs the tide
table), Spreckels Lake model yachts (afternoons, March–October), Fort Funston hang gliders with the pelican, the Castro
Theatre organ at dusk (reopened 6 Feb 2026), Hyde St Pier ships lighting up at dusk, the Presidio pet cemetery (quiet, a
flower), Grace Cathedral's outdoor labyrinth (pairs with Lands End), the Bay Lights line (with V's shimmer), the King
Philip clipper in the Ocean Beach sand (rarest; tides). **BAYBAY's pebbles** (48, 6 per area; tail wiggle at 25 u, point
at 8 u; tricks at 10 / 25 / 40; a golden pebble at 48; 3 coins each; the pebble pouch is her personal trait, the fact card
only says what the Monterey Bay Aquarium says). **城市之声** (12 sounds collected by holding 听 for 3 s: foghorn duet,
cable-car bell, the Ferry Building's hourly chime (据说, secondary source), sea lions, parrots, the Wave Organ, the
laughing lady, the sea cave, the Tiled Steps crossfade, festival banjos on HSB days, taiko in April, Karl's wind).

### 3.2 Actions and fun (lane A; hooks from F, T, C)

**PlayKit** (must, the enabler): start from the contextual action (phone) / E (desktop) inside a zone (the verb is the
button label: 滑下去 · 比赛？ · 摇铃); one input the player already knows; judged on `audioNow()` (AudioContext time, iOS
latency) with ±150 ms windows and auto-offset from the first four taps; a warm result card 好 / 很好 / 太棒了 (shape +
text, colour-blind safe), coins and a stamp the first time per tier, the best remembered (上次你 18 秒！), 再来一次; moving
cancels at no cost; locks only through `holdLock('activity')`; each activity is its own chunk (2–5 KB) loaded within 60 u
of its zone; the core ≤ 6 KB.

| id | activity | where (city x, z) | phone · desktop | reuses | fact (checked) | priority |
|---|---|---|---|---|---|---|
| A-emote | **Emotes**: wave · dance · lie on the grass · selfie with BAYBAY | anywhere | phone: tap your own character → a 4-slot wheel (one coach mark), and the same row at the top of the 问 BAYBAY sheet; desktop: T then 1–4 | `anim.ts` emote channel (wave, cheer, clap, pose exist; dance, lie are new via `charApi`), photo two-shot; crowd within 6 u waves back (T), BAYBAY dances along | — | must |
| A-pet | **Pet BAYBAY**: heart, squeak, happy wiggle; near water she sometimes floats on her back (idle, not a button) | anywhere | phone: double-tap BAYBAY or 问 BAYBAY → 摸摸 (single tap unchanged); desktop: E twice | guide emotes, BAYBAY rig | sea otters float on their backs using the chest as a table; loose skin pockets under each forearm (montereybayaquarium.org, 09-28) | must |
| A-sit | **Sit anywhere + 16 view spots**: sit on grass, steps, rims; 5 s at a view spot → a slow 20 s look (camera drifts out, Karl moves, lights come on at dusk, music thins), +5 coins, a 看风景 stamp; the painted view card image comes with the album (should) | view spots: Twin Peaks, Bernal summit, Grand View Park, Ina Coolbrith, Alta Plaza, Dolores Park top, Lands End overlook, Sutro Heights, Wave Organ tip, Crissy beach, Coit, Buena Vista, Mount Davidson, Corona Heights, Marina Green, Hyde St Pier end | phone: the contextual 坐下; desktop: E | `modes.ts` sit + a ground anchor (`charApi.sitGround`), the 43 `CITY_BENCHES`, the sit camera | — | must |
| A-flight | **First flight** (MF3) and later ring courses | Coit (−50, 51) → Ferry → PIER 39 | glide stick / G | `actors/glide.ts` (soft floor 6 u over roofs), instanced torus, coins inside | — | must (first flight); should (GGB-towers course) |
| A-slides | **Seward Street slides**: cardboard, whoosh down one chute while BAYBAY races the other; hold Hop to tuck | Seward mini park ≈ 155, 832 | action 滑下去 / E | `SEWARD_SLIDES` chute lines (lane L3 built them for this), cinema spline, dust fx | open 10–5 Tue–Sun, bring cardboard, adults must accompany children, closes at sunset (sfrecpark.org, 09-28; the card's "closed when wet" is not on the official page: drop it); BAYBAY: BAYBAY 算小朋友吧？ | must |
| A-bell | **Cable-car bell riff**: three call-and-response rounds, then 10 s of freestyle, never failed, only "more or less jazzy"; hold Hop at the rail to lean out for the classic photo | any cable car, at the rail spot | the bell pad in the ride banner (T's hook) / H | H bell input, `cableBell` sfx | the annual contest is hedged, no date (the 53rd was 7 July 2016, sfmta.com, 09-28) | must |
| A-stairs | **Stair races with BAYBAY** + a lifetime step counter (今天 412 级) | Filbert / Greenwich steps (−42, 49), Lyon Street Steps (−292, 514), 16th Ave Tiled Steps (−113, 1143) | BAYBAY asks 比赛？ at the foot; stick / tap-to-walk, auto-run during the race | walk-graph stairs, stair stride, guide run | Filbert Steps ≈ 400 steps; Filbert St's 31.5 % is its maximum, tied sixth — never "the steepest street" (en.wikipedia.org, 09-28) | must |
| A-fire | **Marshmallow at the Ocean Beach fire rings**: sit at a glowing ring at dusk, hold to toast, release at golden; burnt = "extra crispy", BAYBAY eats it | the 16 rings, Ocean Beach | hold the action / hold E | `ocean-beach-fire-rings.ts` embers, sit | fires March–October only, out by 21:30 (nps.gov, 09-28): shows only in season (R's `isFireRingLit`); ship by Oct 14 or it waits for March 1, 2027 | should (first) |
| A-turn | Turntable heave-ho on BAYBAY's 嘿—咻 beat; a stamp after all three turntables | Powell & Market (≈ 129, 258), Hyde & Beach, Taylor & Bay | action on the beat / E | `transit.ts pushTurntable` (presentation only, T's hook) | turned by hand (en.wikipedia.org, 09-28) | should |
| A-crest | 12 bike / toy-car crest hops with pennants, a 0.5 s slow-mo (off with reduced motion) and an auto snapshot; style, never speed | crests picked from a drive-sweep log of `vehicle:hop {crest:true}` | Hop | crest detection, photo compose, instanced pennant (no glyph) | — | should |
| A-sealion | Sea-lion count at PIER 39: tap each new one to count it (it barks) | ≈ −158, 22 | tap / E | instanced sea lions, `sea-lion` sfx | never a live number; no feeding | should |
| A-toys | Fetch / frisbee with BAYBAY, beach-ball keepy-uppy, cardboard sled on steep grass (> 0.25 grade), Lombard gentle descent (brake held, medals for zero bumps and staying slow; sign recommends 5 mph) + "which is crookeder?" vs Vermont St | lawns, beaches, Dolores / Alamo / Bernal, Lombard (Hyde → Leavenworth) | tap a spot to throw; tap on the shadow; hold Hop | guide run, blob shadow, a sled variant in the lazy vehicle code | Lombard: 8 hairpins, one-way, 5 mph sign (en.wikipedia.org, 09-28); Vermont sinuosity 1.56 vs 1.2 (eggs scout) | should |
| A-seek | Hide & seek with BAYBAY (warmer / colder) | within 40 u | tap her when you spot her | guide lead, `canStand` | — | could |
| A-glide+ | Scenic auto-glide: for mid distances (≤ ≈ 900 u, destination streamed) the pelican flies the route itself; touch the stick to take over (N + F) | — | — | glide autopilot | — | should |

**Budget:** PlayKit + activities lazy (≤ 6 KB core, 2–5 KB each); calls: rings +1 while gliding, pennants +1
(`TOY_INST_TINT`, no new program), cardboard / ball / frisbee +1 near the player; tris ≤ 1k rings, ≤ 0.5k pennants; one
new animation (dance) + a lie pose on the GLB rig; save: bests ≤ 32 numbers in `play.b`; credits ≈ 2 (lines).

**Not this wave:** the cable-car grip shift (touches fragile interlocks), swimming (water is blocked; an Aquatic Park dip
is a later scripted beat, never at Ocean Beach), the Musée arcade (could, IP care), skateboard, street performers.

### 3.3 Real-world linkage (lane R; hooks from N, T, V, L, C)

**Rules.** Events come only from the BAYLINK catalog (DESIGN §8); the venue table only *positions* catalog events.
Fixed civic and natural dates may dress the world only from the checked calendar (the DESIGN.md carve-out the lead
writes at day 0: exact dates only from organisers; secondary dates say 以官网为准; climatology says 通常; unverified or
past rows show nothing). **No third-party fetch from the player's browser**: production `vercel.json` allows
`connect-src 'self'`, the Render API and openfreemap only, while the local 5174 / 4174 send no policy (a live call would
pass local QA and fail in production). Everything is computed, same-site, or baked at build time. Adult-only and
professional / tech events never appear in the world. All times are Bay time (`America/Los_Angeles`) through the frozen
`bayNow()` (DEV / QA: `?date=YYYY-MM-DDTHH:mm`).

**Must:**

1. **Venue table** `realsf/eventVenues.ts` (≈ 15 rows; an event's own `location` wins; unmapped venues get no pin,
   never a guess; every row is walker-swept):

   | venue text (catalog) | world point (x, z) | events (catalog ids; dates from the catalog at runtime) |
   |---|---|---|
   | Yerba Buena Gardens / Great Lawn | 176.9, 210.8 | `sf-african-arts-festival-2026`, `litquake-out-loud-2026`, `sf-ybg-dance-day-2026`, `sf-halloween-hoopla-2026` |
   | Hellman Hollow · Lindley & Marx meadows, GGP | −378.2, 1118.8 | `hardly-strictly-bluegrass-2026` (Oct 2–4; gates 11:00 Fri, 9:00 Sat–Sun, music ends 19:00; free; no bikes, scooters or skateboards inside — checked 2026-09-28) |
   | Castro & Market / 18th St | 143.3, 739.1 | `sf-castro-street-fair-2026` (Sun Oct 4, 11:00–18:00 — checked 2026-09-28) |
   | Marina Green (festival centre) / Pier 27 | −382.1, 300.7 / −60.8, −7.5 | `san-francisco-fleet-week-2026` (Oct 4–12; air show Oct 9–11 12:00–16:00 — checked 2026-09-28) |
   | Jefferson & Powell → Washington Square | route start ≈ −168, 46 | `sf-italian-heritage-parade-2026` |
   | Fisherman's Wharf (Little Embarcadero) | −206.3, 84.6 | `sf-fishermans-wharf-chowder-fest-2026` |
   | Ferry Building | 131.5, 15.1 | `sf-world-of-dumplings-2026` (downtown: pennant + crowd only until MF9's headroom) |
   | UCSF Mission Bay (Koret Quad) | 440.6, 292.1 | `sf-bay-area-science-festival-2026` |
   | Main Library | 124.7, 390.8 | `sf-filbookfest-2026` (indoor: a sandwich board only) |
   | Roxie Theater | 225.5, 602.8 | `sf-apature-film-2026` (indoor: board only) |
   | Sunnydale (the Hub) | 837.3, 1116.5 | `sf-sunnydale-pumpkin-fest-2026` |
   | Portola (Family Connections) | 789.0, 830.2 | `sf-family-connections-halloween-2026` |
   | Presidio Main Parade Lawn | −484.4, 489.1 | Presidio catalog events when present |

   `eventsNear()` uses the mapped point (the "附近这周" row on SF place cards is always empty today: only 5 of 25 SF events
   carry a location and all 5 are professional); 这周去哪 ranks the playable city first and shows the flyers right after
   the three questions, each with 带我去 its venue.
2. **Event presence** during an event's real window (its days; hours from its start / end labels, else 08:00–21:00):
   a coral pennant (N's flag source; an event near the player or the waypoint takes one of the phone's 3 flag slots ahead
   of panorama flags); a small kit by category (music → toy stage + speakers; fair / market → 3 stall tents from the
   farmers-market recipe; festival → bunting + tents; parade → bunting at the route start; indoor → a board at the door),
   ≤ 1.5k tris and +1 call per kit on `TOY_INST_TINT`, at most 2 kits built (nearest the player); 12–20 toy visitors on
   T's crowd spots with a 3 u clear lane; an original loop through `audio/hooks.ts` (banjo-ish for bluegrass, brass for a
   parade; never a real song) audible within ≈ 150 u; one BAYBAY line on zone entry per event per Bay day (今天金门公园有免费的蓝草音乐节，
   出发前查官网确认哦); first entry in the window → an event souvenir stamp + 15 coins (never for sale). Tap anything →
   the existing EventCard (official link, `/events/:id`, 加入想去, plan) + 带我去 (N's `goTo`). Map: a 这周 filter, on by
   default while an SF event is live (DOM badges, no sticker atlas). At the Ferry gate and Chinatown only pennant + crowd
   until V publishes the headroom.
3. **Real sun** (`realsf/sun.ts`, NOAA general solar equations, ≈ 40 lines, cross-checked with sunrise-sunset.org within
   2 min by the real proposal). `game/qa.ts bayTimeOfDay` bands become: night until civil dawn; morning to sunrise + 3 h;
   day until the sun is 6° up (≈ 35 min before sunset); golden until civil dusk. Both writers of `store.timeOfDay` use it.
   Examples (computed): sunset Sep 28 18:58 (civil dusk 19:24), Oct 4 18:48, Oct 31 18:12, Nov 2 17:10 (after DST ends
   Nov 1, dusk 17:37), Dec 21 16:54 (dusk 17:23), Jun 27 2027 20:35. The Settings fixed-time choice, `?time=` and the
   first-visit golden rule (`Overlay.tsx`) still win. BAYBAY once a Bay day: 今天旧金山日落 18:58，找个坡坐下来看吧。
4. **Hours and seasons already sourced:** the Ocean Beach fire rings glow only March 1–October 31 and until 21:30
   (`isFireRingLit`, wired by L; fixes lane L's "glow every night of the year"; on Oct 31 BAYBAY: 海滩篝火季到 10 月底，11 月起就不能生火啦。);
   the Ferry Plaza market on its real days (exists in `world/clock.ts`: Tue & Thu 10–14, Sat 8–14, foodwise.org).
5. **今天 · SF Today** (a Journal tab through the slots registry; the top-right pill opens the Journal on it; desktop J):
   Bay time; sunrise / sunset; (the moon when V ships it); **下一个目标** (the next goal, the pelican first); **今天**:
   live SF events, the market if open, free today (hand rows with source and conditions: Japanese Tea Garden free
   Mon / Wed / Fri 9–10, the Conservatory of Flowers first Tuesday (closed Wednesdays), the Botanical Garden second
   Tuesday — gggp.org, checked 2026-09-28 by the real proposal), fire rings in season; **这周**: the next 7 days of SF catalog
   events; **今日三件小事**: three small goals seeded by the Bay date from the real signals (be at a sunset spot between
   golden and dusk — Ocean Beach, Twin Peaks, Baker Beach, Lands End, Marina Green; visit today's event venue; taste at the
   market while it is open; ride a line; visit a place that is free today), +10 coins each and +20 for 3 / 3, no streaks,
   nothing lost for skipping a day. Every row: 带我去 + its source.
6. **Fleet Week over the Bay** (time-boxed): Oct 9–11, 12:00–16:00 Bay time (practice Thu Oct 8 is secondary: not
   shown). Six toy jets (four on phones) in blue-and-gold toy paint, **no insignia or logos**, on spline loops in an air
   box over the water north of the Marina, Crissy Field and Aquatic Park between the GGB and Alcatraz; one smoke-ribbon
   mesh; a synthesized roar that ducks the music within 600 u; ≤ 2.5k tris, ≤ 2 calls, built only in the window and
   within ≈ 1,500 u (one warmed program). BAYBAY's morning line on those days: 今天中午到下午四点，湾上有飞行表演，去码头绿地看！
   (waypoint to Marina Green). A photo subject "飞机编队" near Marina Green → a Fleet Week 2026 stamp + coins; the
   EventCard links `san-francisco-fleet-week-2026`. The pelican is turned back gently at the air box (F's glide soft box:
   我们在旁边看就好); the jets never collide with anything. **Cut rule:** in the owner's build by Wed Oct 7 20:00 PT, or it
   moves to 2027 as calendar config and nothing half-done ships.

**Should:** the real moon (phase from the mean synodic month, "约", a uniform on the existing sky moon disc; new moon
Oct 10 → more stars; full moon evening of Oct 25 → 今晚差不多满月 on Twin Peaks / Ocean Beach); **the verified calendar**
`realsf/calendar.ts` `{id, days, hours, where, xz, source, verifiedAt, grade, catalogId?}` with Halloween (Sat Oct 31:
generic pumpkins on Victorian stoops), Día de los Muertos (**hidden: the 2026 date is not posted**), king tides
Nov 24–26, Dec 23–25, 2026 and Jan 21–22, 2027 (coastal.ca.gov: spray over the Embarcadero seawall) and data-only rows
for later (Lunar New Year Feb 6, 2027 and the parade Feb 20, 2027, chineseparade.com; the 1906 remembrance Apr 18 05:12 at
Lotta's Fountain; Cherry Blossom and Pride 2027 marked secondary); **tides baked** (`scripts/opus-sf/export-tides.ts` →
`public/opus-bay/sf/v1/tides.json`, NOAA CO-OPS 9414290 hi / lo MLLW, 15 months, ≈ 8 KB gzip, `application=` parameter,
≤ 1 year per request; coast cards 今天低潮 18:43 with safety wording; the Wave Organ louder near high tide; the Lands End
wrecks at low tide); **Karl and nature by month** (`karlMonthFactor`: June–August foggiest, September–October clearest,
"通常"); **今天免费 badges** from BAYLINK's own offers (`scripts/opus-sf/export-live.ts` reading `src/data` read-only →
`public/opus-bay/sf/v1/live.json`: `asian-art-free-oct4`, `conservatory-free-oct6`, `botanical-free-oct13`,
`japanese-tea-garden-free-hour`, `sfmoma-family-oct25`, `cable-car-museum-free`, `randall-museum-free`,
`exploratorium-for-all-five`, `sfmoma-museums-for-all`, `muni-youth-free`, `museo-italo-free-days`; museums, parks and
transit only, eligibility always shown, links `/offers/:id`); **现实中怎么去** rows (nearest real stop on the game's
lines, walking minutes, the real headway from sfmta.com route pages — N Judah 24 h, weekday ≈ 10 min; M 06–24; F 07–24;
Powell–Hyde 07–23 — and 出发前查 SFMTA / 511 确认; after 23:00 an idle cable car rolls to the barn but rides stay available);
**我的周末** (wishlisted events and places → BAYLINK `/plan` via `planUrl()` and `/my-week`); guide links the game does
not use yet (`sf-sunset-dunes-october-coastal-walk-2026`, and after the merge `sf-lands-end-sutro-baths-walk-guide`,
`sf-mission-dolores-murals-walk-guide`, only when `hasGuide()`).

**Could / not this wave:** live weather through a same-site function (NWS needs a User-Agent; a proxy and the owner's
approval), parade walkers, City Hall's monthly colours, new-openings stickers; **skip** live Muni (511 key, 60 requests
per hour, a proxy), sports schedules (tentative 2027, proprietary), earthquake / AQI / incident feeds.

**UI.** Phone: the pill → Journal / 今天; pennants and the 这周 map filter; EventCard as today plus 带我去; no new chip.
Desktop: J; the same card. **Budget:** DOM ≈ 5 KB (today tab), ≈ 5 KB (events + kit), ≈ 4 KB (jets), ≈ 1 KB sun (may sit
in the main graph after V's bundle move); 0 calls except kits (+1 each, ≤ 2) and jets (≤ 2, window only); save:
`play.d {day, mask}`; credits ≈ 1 (lines).

### 3.4 Coins and the shop (lane E; hooks from F, C, V)

**Where coins are** (placement script `scripts/opus-sf/coins-place.mts` + tests with the postcard rules: standable,
reachable on the nav graph, ≥ 6.5 u from card prompts, never in water or inside a blocker; the append-only registry
`economy/coinSpots.ts`):

| kind | count | rule | save |
|---|---|---|---|
| trails | ≈ 60 trails × 5–8 | stairs (Filbert, Greenwich, Lyon, 16th Ave, Hidden Garden, Macondray), pier ends, park loops (Blue Heron Lake, the Lands End trail, the Crissy promenade), crests and viewpoint paths, loop and Metro stops; **refill each Bay day** | `play.t {d, b}` today's bitset |
| caches | 40 × ≈ 10 | odd corners, once per save: roofs reachable by glide (Palace of Fine Arts rotunda rim, a Painted Ladies roof), pier ends (Pier 7, Hyde St Pier), the Wave Organ tip, hilltops (Bernal, Mount Davidson), the Sutro Baths ruins, the Seward slide top; downtown caches only after MF9 | `play.g.cache` |
| air rings | ≈ 15 rings × 8 | above Coit, Transamerica, Sutro Tower, the Painted Ladies row, the City Hall dome, the GGB towers: flown *through* (the glide's soft floor is 6 u over roofs), once per save | `play.g.ring` |
| rewards | — | T1 arrival 10, T2 5, T3 3 · postcard 10 · egg 10 · view / sound 5 · favour 25 · pelican goal 20 · event souvenir 15 · 今日小事 10 (3 / 3 +20) · notebook page 30 · activity medal 5 / 10 / 15 (first time per tier) · pebble 3 | `play.e` + bitsets |

- **Feel:** one gold-disc InstancedMesh (≈ 48 tris, spin and bob in the vertex stage of an already-warmed instanced
  material, #e0a94a, a small otter-paw emboss), ≤ 32 near the player (+1 call, ≤ 1.5k tris), matrices ≤ 30 Hz from
  per-chunk lists; auto-pickup at 1.2 u on foot, 2 u on the bike, a small magnet while gliding low; a chime rising in
  pitch along a trail; sparkles from the fx pool (0 / 256 used); at night coin glints as light-field points (V, 0 calls).
- **Counter:** inside the existing top-right pill: `明信片 3/24 · 🪙 42` (a pill badge slot); no toast per coin.
- **BAYBAY 小铺:** phone: More → 小铺 (bottom sheet at 35 % height, big tiles, the live BAYBAY in the world turns round to
  show the item — the camera frames her, no second render pass); desktop: More → 小铺, or the stall. In the world: one
  farmers-market stall on the Ferry Building back plaza, open as "BAYBAY 小铺" on non-market days (the stall kit
  `world/clock.ts` already tarps: 0 new geometry); on market days the sheet says 今天集市，小铺在"更多"里。

  | shelf | items (zh / en) | price |
  |---|---|---|
  | BAYBAY scarves (material tint) | 海湾青 teal · 雾灰 Karl fog-grey · 缆车栗红 cable-car maroon · 国际橘 International Orange · 酸面包奶油 sourdough cream · 大丽花粉 dahlia pink | 40 each |
  | BAYBAY hats (head attach, procedural) | 毛线帽 beanie · 遮阳帽 sun hat · 水手帽 sailor cap | 80 each |
  | you | hat colours, backpack colours | 30 each |
  | rides | bike liveries (`BIKE_LIVERIES`), toy-car paints | 60 each |
  | pelican | 鹈鹕丝带 pelican ribbon | 50 |
  | photos | frames: 雾 fog · 金色时刻 golden hour · 夜 night (C's frame hook) | 30 each |
  | conveniences | 寻宝罗盘 treasure compass (one outing: BAYBAY sniffs toward the nearest unfound cache / egg / pebble) · 明信片放大镜 postcard magnifier (one outing: postcard hints on the map) | 20 each |
  | owner's ticket | 飞行券 one 飞过去 **before** the pelican unlock (BAYBAY gives the first one free); hidden after the unlock and any unused ticket refunds 10 coins | 10 |
  | toys (should, with lane A) | beach ball, frisbee, cardboard sled: BAYBAY lends each one free the first time | 15–25 |
  | never for sale | event souvenirs (earned only at the venue in the real window) | — |

- **Economy:** ≈ 27 items, ≈ 1,400 coins in all; about one item per 15 minutes of ordinary play (≈ 50–80 coins), all
  bought after about 6–8 h. Coins never buy speed, access or places (fast travel, transit, places and flying stay free).
  No real money, no ads, no loot boxes, no streaks. Prices are tuned by the scripted 60-minute run (MF5) before build 3.
- **Budget:** +1 call, ≤ 1.5k tris; ≈ 10–14 KB lazy (ledger ≤ 3 KB loads first); save ≤ 1.5 KB worst case; credits
  ≈ 24 (shop tiles, H5-1).

### 3.5 Progression and replay (lanes E, R, C, A, D)

- **旅行手帐 · Notebook** (must, E): a Journal tab through the slots registry with pages: **印章** (every first arrival —
  `arrival.ts` already emits `stamp` —, each line ridden, the pelican, the bridge crossing, the neighbourhoods, event
  souvenirs), **小发现** (D's registry as silhouettes + riddles), **看风景** (A's 16 view spots), then the existing 足迹 list
  (N's `FootprintsTab` embedded as the last page). **城市之声** and **自然** pages arrive with their should items. A full page
  → 30 coins + one cosmetic (the full 看风景 page → the golden-hour frame). The header: today's real SF line (R) and
  **明天可能不一样**, never a streak. Phone: a visual stamp thud (iOS Safari has no `navigator.vibrate`); desktop: J.
  Journal tabs after wave 5: 今天 · 手帐 · 目标 · 明信片 · 想去 (five; fits 375 px with icon + short label).
- **Daily rhythm, no guilt:** trails refill each Bay day (E), the fortune cookie and its lucky spot (D egg 5), 今日三件小事
  (R + E), BAYBAY's once-a-day real-SF greeting (R + C); nothing is lost for skipping a day.
- **Personal bests** (A): remembered and brought up by BAYBAY (上次你 18 秒！).
- **Unlock ladder** (E + A, should): toys are lent free the first time, then sold; notebook pages unlock cosmetics; no
  street, line or place is ever locked.
- **Resident letters** (C, should): each of the six residents gets a second favour step that leaves a mark (Luz paints a
  tiny otter decal in Balmy Alley after you photograph 3 mural colours; Hank's tulips bloom in real spring; Rosa's
  Saturday stall; Ray asks for the bell riff) with two new TaskGoal kinds (`photo`, `play`); a finished favour arrives
  later as a letter in the notebook. ≈ 60 bilingual lines.
- **Photo album** (C, should): replaces the forced PNG download on every shutter; IndexedDB thumbnails (≈ 40 KB each,
  in-memory fallback in private mode), Save / Share per photo (Web Share with files on iOS 15+, else download + copied
  link); the view cards (A) and the nature page (D) use it.

### 3.6 Whole-city polish: 完善整个旧金山 (lanes L, V; C for greetings)

- **Signature corners** in the outer city (100–290k tris of headroom there), each ≤ 2.5k tris and ≤ 2 calls from the kit
  and instanced pools, extending the existing site modules where they exist (`irving-street`, `clement-street`,
  `calle-24`, `haight-ashbury`, `noe-valley-town-square`, `harvey-milk-plaza`, `peace-pagoda`): bilingual painted shop
  signs (generic words only: 面包 Bakery, 点心 Dim sum, 书店 Books, 花店 Flowers, 咖啡 Coffee, 杂货 Grocery, Taquería — never a
  brand) from V's new signs atlas; one ambient "someone doing something" on T's crowd spots (an early queue, a busker spot,
  a Saturday stall row); one coin cache (E); BAYBAY's existing neighbourhood greeting.

  | order | neighbourhood | corner | ambient |
  |---|---|---|---|
  | 1 (must) | Irving St, Sunset | bakery and dim-sum windows | an early-morning queue |
  | 2 (must) | Clement St, Richmond | bookshop + dim-sum windows | shoppers with bags |
  | 3 (must) | 24th St, Mission | papel-picado strings, taquería awnings (abstract colour, never a mural copy) | a guitarist |
  | 4 (must) | 3rd St, Bayview (by the T line) | colourful storefronts | neighbours at a bus stop |
  | 5 | Haight | colourful shopfronts | a busker spot |
  | 6 | Japantown (Post St / Buchanan Mall) | lanterns | shoppers |
  | 7 | Noe Valley Town Square | benches | a Saturday stall row |
  | 8 | Castro | the rainbow crosswalk (egg 21) | fair-day crowds from R |

  Chinatown and North Beach corners wait for V's measured downtown headroom (≥ 20k after the levers).
- **Lit nights** (V): brighter windows and street lamps in the outer districts as extra points in the existing night
  light field (13,150 points today, one Points draw: 0 calls).
- **Should** (V): the Bay Lights — a slow generic shimmer on the Bay Bridge west span's necklace halos (the installation
  returned on 20 Mar 2026; our own patterns only, never its sequences) — and the Salesforce crown's slow colour drift,
  both inside the single Points draw.
- **Budget:** +1 texture (the 1024² signs atlas, ≈ 1.3 MB GPU); ≤ 2 calls and ≤ 2.5k tris per corner, outer only;
  ≈ 6 KB; credits ≈ 8 (plaque / awning textures; the text is drawn in canvas with real fonts, never by an image model).

---

## 4. Lanes for wave 5

Ten lanes plus the lead. Ownership starts from `sf-w4-plan.md` §5.1 as amended by `sf-w4-lead.md` §8 and the wave-4
integration (files wave 4 created belong to the lane whose subject they are). Four lanes are new and own **new folders
only**; they plug into the game through the day-0 hooks (§4.2) and the owners' early pushes (§4.3), never by editing
another lane's file.

### 4.1 Ownership in wave 5 (OB = `src/opus-bay`; every lane also owns `docs/opus-bay/sf-w5-<LANE>.md`, `docs/opus-bay/ledger/w5-<LANE>.md` and `docs/opus-bay/qa/w5/<LANE>/`)

| lane | inherits | owns (existing files) | new files it creates |
|---|---|---|---|
| **F · Feel & feet** | G (movement + HUD shell) | OB/actors/** except platform.ts (T), npcs.ts (V), residentLooks.ts (C), reveal.ts (N); OB/core/{input,terrain,walkGraph}.ts (additive); OB/data/vehicles.ts, OB/data/sf/rideSpots.ts; OB/game/{Systems.tsx,cinema.ts}, the internals of OB/game/playerLock.ts (API frozen); OB/ui/{Hud,Floating,Overlay,CoachMark,CoachMarkBody,Settings,icons,MoveChip,coachSeen,lazyParts}.ts(x), OB/opus-bay.css, OB/OpusBayPage.tsx; tests actors, sf-move2, sf-move3, sf-modes, sf-vehicles, sf-nav, sf-hud, sf-device | OB/actors/{charImpl,feet,stuckHelper,deckSteer,faceOpen}.ts, scripts/opus-sf/qa/{sweep-static.mts,walker-sweep.mjs}, tests/opus-bay-w5-{lock,feet,char}.test.ts |
| **N · Navigation, map & travel** | P + G (guidance) + C (trips) | OB/data/sf/{places,extraPlaces,attractions,placeSearch,stationPlaces,mapStickers,mapTransit}.ts, OB/data/cityZones.ts; OB/ui/{CityMap,CityMapList,cityMapDraw,cityMapModel,MapPanel,MapBadge,MapFilters,MapLegend,mapBadges,mapData,mapFilterRules,mapIcons,mapLabels,mapLayout,mapLines,mapListData,mapTrips,map-w4.css,PlaceActions,TripOptions,StationActions,Footprints,footprintsData,TitleScreen,common,hooks,city-ui.css,GuideLayer,TripPill,ArrivalCard,PanoramaTags,guide-ui.css,guideText,tripRows,panoramaPlace,spotLabel}.ts(x); OB/game/{discovery,fastTravel,placeTrips,travel,resume,streets,mapPanel,mapRoute,tripPlan,tripProviders,tripText,trips,tripRun,flags,guideCity,guidePrefs,waypoint,hudLayout}.ts; OB/world/sf/{flags,flagGlyphs}.ts (V delivers the atlas art); OB/actors/reveal.ts; scripts/opus-sf/{lib/places.ts,places-sidecar.ts}; public/opus-bay/sf/v1/places.json; tests sf-{citymap,discovery,places,travel,attractions,trip,tripflow,triptext,flags,waypoint,guide,guide-city,guide-review,guide-ui,map-fixes,map-int,map-w4,verify-g} | OB/game/goTo.ts, OB/ui/{MapGoCard,GoChip}.tsx, tests/opus-bay-w5-nav.test.ts |
| **C · Content, flow & tours** | C | as wave 4 **minus** data/{catalog,links}.ts and ui/{EventCard,EventCardBody}.tsx (→ R), actors/npcs.ts (→ V), game/{trips,tripRun}.ts (→ N); **plus** game/{cityTour,tourTrips,cityMoments,cityCards,cityDetectors,cityLive,linePacer,interactables}.ts, data/sf/{placeCards,placeCards2,placeCardTypes,tours,tourLines,voiceTour,arrivals,goalMarks}.ts, ui/{CityTourRecap,TourRecap,tourRecapModel,RecapMap,DistrictRecap,PlaceCard,PoiCardBody,content-ui.css}.ts(x); data/save.ts after day 0 | OB/game/{rumours,goalsStep,photoFrames}.ts, tests/opus-bay-w5-content.test.ts |
| **T · Transit & crowds** | T | as wave 4 + OB/world/sf/{cityLife,lineFleet,lineInterlocks,streetNet,crowd,traffic}.ts, OB/world/{flineLayer,flineSystem,lineTrack}.ts, OB/game/{lineRides,lineChoices}.ts, OB/ui/{RideBanner,LineRideLayer,StationPanel,rideHop,subwayStrip,transitGlyph}.ts(x), OB/audio/** (the internals of audio/hooks.ts; API frozen) | OB/world/sf/crowdSpots.ts, OB/game/busWatch.ts, tests/opus-bay-w5-transit.test.ts |
| **L · Landmarks & streets** | L + L3 | as wave 4 (OB/world/sf/landmarks/** incl. the tier-3 kit and lists, OB/world/sf/{sites,kitSwap,l0index,dress,swap}.ts, OB/data/sf/{landmarks,routes}.ts, OB/world/{models,modelMaterial}.ts, scripts/opus-sf/{routes-qa,sites-qa,sites3-*}, the landmark tests) | OB/world/sf/landmarks/{cornerKit,corners}.ts (+ one module per new corner if a site module does not exist), tests/opus-bay-w5-corners.test.ts |
| **V · Visuals, performance, voice & assets** | V | as wave 4 (C2's world files, GameRoot.tsx, H2b's asset files, D2's pipeline, vite.opus.config.ts, scripts/opus-sf/qa/**) + OB/actors/npcs.ts | OB/world/sf/{signsAtlas,farHero}.ts, public/opus-bay/w5/** (postcards, shop tiles, signs), scripts/opus-sf/qa/{csp-serve.mjs,perf/w5-spots.json}, tests/opus-bay-w5-perf.test.ts |
| **E · Economy & notebook** | — | — (reads the frozen `data/playSave.ts`) | OB/economy/** (index.ts, ledger.ts, coinSpots.ts, coins.ts, CoinBadge.tsx, items.ts, Shop.tsx, wear.ts, stamps.ts, Notebook.tsx, economy.css), scripts/opus-sf/coins-place.mts, tests/opus-bay-w5-{ledger,coins,shop,notebook}.test.ts |
| **A · Activities & actions** | — | — | OB/play/** (index.ts, kit.ts, ResultCard.tsx, EmoteWheel.tsx, pet.ts, sit.ts, viewSpots.ts, firstFlight.ts, rings.ts, slides.ts, bell.ts, stairs.ts, then the should activities, play.css), tests/opus-bay-w5-play{,-acts}.test.ts |
| **D · Discoveries & easter eggs** | — | — | OB/eggs/** (index.ts, registry.ts, hosts.ts, props.ts, sounds.ts, FactCard.tsx, rumourSource.ts, one module per area, eggs.css), tests/opus-bay-w5-eggs.test.ts |
| **R · Real San Francisco** | C (catalog, links, EventCard) + P (WeekPanel, qa.ts) | OB/data/{catalog,links}.ts, OB/ui/{EventCard,EventCardBody,WeekPanel}.tsx, OB/game/qa.ts; the tests that pin the catalog's SF behaviour (`sf-cards` rows about events stay C's: write Requests) | OB/realsf/** (index.ts, sun.ts, moon.ts, seasons.ts, eventVenues.ts, events.ts, eventKit.ts, TodayTab.tsx, daily.ts, jets.ts, calendar.ts, tides.ts, HowToGo.tsx, realsf.css), scripts/opus-sf/{export-tides.ts,export-live.ts}, public/opus-bay/sf/v1/{tides,live}.json, tests/opus-bay-w5-{sun,events,today,jets}.test.ts |
| **frozen** (lead only) | — | OB/core/{types,store,events,runtime,geo}.ts, OB/world/sf/format.ts, OB/data/district.ts, OB/game/{systemsRegistry,tripTypes,bayNow,w5Features}.ts, the API of OB/game/playerLock.ts and OB/audio/hooks.ts, OB/data/playSave.ts, OB/data/sf/attractionTypes.ts, OB/ui/slots.ts, OB/actors/charApi.ts, tests/opus-bay-sf-disk.ts, tests/opus-bay-{contracts,district}.test.ts, tests/opus-bay-sf-{format,data,geo,terrain}.test.ts, OB/ASSETS-LEDGER.md, OB/{DESIGN,STATUS,RESUME}.md, package*.json, vite.config.ts, vercel.json, eslint.config.js | — |

A file not listed: the lane whose subject it is; if unclear, frozen (write the change under Requests). Tests that pin
another lane's module: do not edit them; write the change under Requests (`sf-w2-contracts.md` §2). Counts wave 5 changes
on purpose (the owning lane updates its own test): goals order and count (C), Journal tabs (C via the slots), the flag
glyph set (N + V), the event rows in cards (R + C).

### 4.2 Day 0 (the lead, before the lanes start) — the frozen type and event changes

- **W5-0a Quiet-machine baseline** (closes the owed W4-Z part): alone on the machine, the perf table (the 11 wave-4 spots
  + bus deck, N at Duboce, M at West Portal) on the RTX and the iGPU, the phone profile at 4× CPU downtown, GameRoot and
  worker sizes; published in `sf-w5-lead.md` before any lane starts a Chrome.
- **W5-0b F1 hotfix** (MF1 step 1) with its red-then-green test; rebuild the phone package on 4174 the same day.
- **W5-0c Site data:** `git merge origin/main` into opus-bay (lead only); `vercel.json` = main's routes +
  `git.deploymentEnabled.opus-bay: false`; `eslint.config.js` keeps `.vite-opus`; site checks and the full opus-bay suite;
  rebuild 5174 / 4174 so `/planner-catalog.json` is the 2026-09-27 data.
- **W5-0d Frozen contracts** (exact signatures; pinned by `opus-bay-contracts`):

```ts
// core/events.ts — new GameEvent members
| { type: 'reward'; source: string; coins: number; stamp?: string }            // any lane → E's ledger; paid once per source
| { type: 'coins'; total: number; delta: number; source: string }             // E, after paying (pill, sfx)
| { type: 'find'; kind: FindKind; id: string; first: boolean }                // D eggs / pebbles / sounds, A views, E caches, R souvenirs
| { type: 'play'; activity: string; what: 'start' | 'end' | 'cancel'; tier?: 1 | 2 | 3 }   // A
| { type: 'shop'; what: 'open' | 'buy' | 'wear' | 'close'; item?: string }    // E
| { type: 'realsf'; what: 'event-enter' | 'event-leave' | 'window-open' | 'window-close'; id: string }   // R
| { type: 'stuck'; x: number; z: number; what: 'pull' | 'watchdog' | 'sweep'; source?: string }         // F (DEV log)
| { type: 'self-tap'; who: 'player' | 'baybay'; double: boolean }             // F → A (emote wheel, pet)
export const FIND_KINDS = ['egg', 'view', 'sound', 'pebble', 'cache', 'souvenir', 'nature'] as const;
// reward source grammar: /^(arrive|postcard|favour|goal|egg|view|sound|pebble|cache|trail|ring|event|daily|page|medal|pelican):[a-z0-9:@-]{1,80}$/

// game/playerLock.ts (API frozen; lane F owns the internals from W5-F1)
export type LockSource = 'dialogue' | 'fishing' | 'cinema' | 'ride' | 'phase' | 'travel' | 'panel' | 'activity' | 'shop';
export function holdLock(source: LockSource, key?: string): () => void;   // the returned function releases
export function lockHeld(): boolean;
export function lockReport(): { source: LockSource; key?: string; since: number }[];
export function setLockRefresher(fn: () => void): void;                     // flow registers refreshLock (cinema.finish calls it)

// game/bayNow.ts (frozen)
export function bayNow(): Date;             // real time; DEV/QA builds: ?date=YYYY-MM-DDTHH:mm (Bay time) shifts it
export function bayParts(d?: Date): { year: number; month: number; day: number; hour: number; minute: number; weekday: number; dateKey: string };

// data/playSave.ts (frozen format; decode clamps untrusted input; fuzz-tested)
export const PLAY_BIT_KINDS = ['coin', 'cache', 'ring', 'egg', 'view', 'sound', 'pebble', 'stamp', 'own', 'souvenir', 'page'] as const;
export const WEAR_SLOTS = ['baybay-scarf', 'baybay-hat', 'player-hat', 'player-pack', 'bike', 'car', 'pelican', 'frame'] as const;
export interface PlaySaveV1 {
  v: 1; c: number;                                   // coins, 0..999999
  g: Partial<Record<(typeof PLAY_BIT_KINDS)[number], string>>;   // base64 bitsets over each kind's append-only registry, ≤ 256 chars each
  t?: { d: string; b: string };                      // today's trail bitset + its Bay date
  w?: Partial<Record<(typeof WEAR_SLOTS)[number], number>>;      // worn item index per slot
  b?: Record<string, number>;                        // activity bests, ≤ 32 finite numbers
  d?: { d: string; m: number };                      // 今日三件小事: Bay date + done mask
  e?: string[];                                      // one-off reward sources not covered by a bitset, ≤ 128 ids ≤ 40 chars
}
export function decodePlay(raw: unknown): PlaySaveV1 | undefined;
export function bitGet(b64: string | undefined, i: number): boolean;
export function bitSet(b64: string | undefined, i: number): string;
// data/save.ts: SaveV2.play?: PlaySaveV1; decodeSave learns it; encodeSave trims discovered (→ 500) then arrivals (→ 128)
// and never drops play / unlocked / tours / lastSafe; the size test at every cap < SAVE_MAX_BYTES.

// ui/slots.ts (frozen; the lead wires the render points on day 0 in Hud, Journal, the More menu, Overlay, the call menu)
export function registerJournalTab(t: { id: string; order: number; label: Bilingual; icon: ComponentType; count?: () => string | undefined; load: () => Promise<{ default: ComponentType }> }): () => void;
export function registerMoreItem(m: { id: string; order: number; label: Bilingual; icon: ComponentType; onSelect: () => void }): () => void;
export function registerPillBadge(p: { id: string; order: number; Component: ComponentType }): () => void;
export function registerOverlay(o: { id: string; Component: ComponentType<{ props?: unknown; close: () => void }> }): () => void;
export function registerAskItem(a: { id: string; order: number; label: Bilingual; icon: ComponentType; onSelect: () => void; visible?: () => boolean }): () => void;
export function openJournal(tab?: string): void;
export function openOverlay(id: string, props?: unknown): void;
export function closeOverlay(id: string): void;

// game/interactables.ts (type change by the lead; the file stays lane C's)
// Interactable gains  act?: () => void;  verb?: Bilingual;   InteractableSource adds 'activity' | 'find' | 'shop' | 'event';
// flow's interact dispatch calls it.act() first for those sources.

// actors/charApi.ts (frozen interface; lane F implements it by W5-F2)
export const EMOTES = ['wave', 'cheer', 'clap', 'point', 'pose', 'dance', 'lie', 'sit', 'float', 'pet'] as const;
export interface CharApi {
  emote(who: 'player' | 'baybay', name: (typeof EMOTES)[number], opts?: { loop?: boolean; seconds?: number }): void;
  sitGround(pose: { x: number; z: number; heading: number }): boolean;
  stand(): void;
  attach(who: 'player' | 'baybay', slot: 'head' | 'neck' | 'back', obj: import('three').Object3D | null): void;
  tint(who: 'player' | 'baybay', part: 'scarf' | 'hat' | 'pack', color: number | null): void;
  vehiclePaint(kind: 'bike' | 'car' | 'pelican', id: string | null): void;
  glideSoftBox(key: string, box: { minX: number; minZ: number; maxX: number; maxZ: number; minY?: number } | null, line?: Bilingual): void;
}
export function setCharApi(impl: CharApi | null): void;
export function charApi(): CharApi | null;

// audio/hooks.ts (API frozen; lane T owns the internals; the lead wires it into audio.ts on day 0)
export function registerSound(id: string, recipe: (e: AudioEngine, opts?: { gain?: number; pan?: number; pitch?: number }) => void): () => void;
export function playSound(id: string, opts?: { gain?: number; pan?: number; pitch?: number }): void;
export function registerLoop(id: string, recipe: (e: AudioEngine) => { setGain(g: number): void; stop(): void }): () => void;
export function setLoop(id: string, gain: number, fadeMs?: number): void;
export function audioNow(): number;                  // AudioContext.currentTime (s); performance-clock fallback before unlock
export function duck(bus: 'music' | 'ambience', amount: number, ms: number): void;

// game/w5Features.ts (frozen list; the lead adds one call in game/cityContent.ts on day 0)
// in city mode, after the city starts: economy/index.ts (E; its ledger listener first) · play/index.ts (A) ·
// eggs/index.ts (D) · realsf/index.ts (R); each exports  init(): () => void.  The lead creates the four stubs.
```

- **W5-0e Protocol:** worktrees `C:/Users/willy/wt/w5-<lane>` (branch `w5-<lane>` from `origin/opus-bay`, `node_modules`
  as a junction; **never delete through a junction**: `cmd //c rmdir <wt>\node_modules` first); ports **F 5501 · N 5502 ·
  C 5503 · T 5504 · L 5505 · V 5506 · E 5507 · A 5508 · D 5509 · R 5510 · verify 5520** (5174 / 4174 stay the lead's);
  scratch `C:/Users/willy/opus-qa/w5/<lane>/`; checks, commits (`W5-<LANE><n>: …`, the Co-Authored-By line), fetch +
  rebase + push exactly as `sf-w4-lead.md` §5; never stash, never force-push, never merge (the lead's W5-0c merge is the
  only one). **Ten lanes on one machine:** at most **one** headless Chrome per lane at a time; while V or the lead runs a
  perf gate, the file `C:/Users/willy/opus-qa/w5/PERF-LOCK` exists and lanes start no Chrome until it is gone; fps
  numbers only from V's gate runs and the lead's verify.
- **W5-0f Docs:** `sf-w5-lead.md` (this ownership, the ports, the hooks); DESIGN.md §8 carve-out for the verified
  calendar and the "no pressure mechanics / coins never buy speed or access" rules; VOICE.md glossary: 金币 (never 硬币),
  小铺, 手帐, 小发现, 看风景, 今日三件小事, 飞行券.
- **W5-0g Higgsfield:** `balance` + `transactions` (≈ 400 on 2026-09-28 01:28 UTC); wave-5 cap 130, lane V only (§5).

### 4.3 Cross-lane hooks to land first (each lane's first push, day 1)

| from | what | used by |
|---|---|---|
| F | `charApi` implementation (dance loop, lie, sit ground, float, pet; attach / tint for BAYBAY and the player; vehicle paints via `BIKE_LIVERIES`; `glideSoftBox`); `self-tap` events; `faceOpen(x, z)`; 起飞 always visible | A, E, R, N, D |
| N | `goTo(target: { placeId?: string; point?: Vec2; name?: Bilingual }, opts?: { prefer?: 'fly' \| 'ground'; source?: string })`; `registerFlagSource(key, fn)` in `game/flags.ts`; `FootprintsTab` exported for embedding | R, D, E, C |
| C | `bubble()` / `markGoalsDone()` documented as the public line and goal API; `registerRumourSource(fn)`; `registerFrameDecorator(id, draw)` in photo; the welcome / resume hook `onWelcome(kind: 'new' \| 'returning')` | D, E, R, N |
| T | `addCrowdSpots(key, spots, { face?, count? })` / `removeCrowdSpots(key)` with the 3 u clear-lane rule; `rideEta()` from real progress; the turntable push beat + boost hook; the ride banner's bell pad slot; crowd walkers answer `emote` wave within 6 u | R, L, A, N |
| E | the ledger listener live (pays `reward`, emits `coins`); `coinsTotal()`; `hintTarget(kind)` for the compass / magnifier | everyone who emits `reward` |
| D | `eggs/registry.ts` ids + riddles | E (notebook), C (rumours) |
| A | `play/viewSpots.ts` ids; the first-flight entry `startFirstFlight()` | E (notebook), C (unlock moment) |
| R | `sunBandAt(date)`, `isFireRingLit(date)`, `activeEventsAt(date)`, `eventVenue(id)`, `moonPhase(date)`, `karlMonthFactor(date)` | N (qa.ts is R's), L, V, C, E, D |
| V | the warm-up registration recipe for new instanced materials (documented, one example); the flag glyph atlas at 512² with coin / calendar / sparkle / music glyphs (day 2) | E, R, A, D, N |

### 4.4 Lane F · Feel & feet

1. **W5-F1** Derived lock (MF1 step 2): `playerLock.ts` internals, the per-frame derive, every writer migrated, the
   watchdog kept as a DEV-logged safety net; `tests/opus-bay-w5-lock.test.ts` (all 14 paths) + the grep test.
2. **W5-F2** `charApi` implementation (push first): dance loop and lie pose on the GLB rig, sit on the ground, BAYBAY
   `float` and `pet` wiggle, attach / tint slots (BAYBAY scarf region, head bone; player hat and backpack), vehicle paints,
   `glideSoftBox`; `self-tap` from the pointer (a player capsule hit test before the ground ray; a double-tap on BAYBAY;
   single taps unchanged).
3. **W5-F3** 起飞 always visible (MF3), the `HUD_BOX_SELECTOR` item, the 667 × 375 column, the routed §8.4 G items
   (FocusMarker `forceSinglePass`, `twoShotPose`, Settings reset clears line memory **and** the `play` block, the BAYBAY
   GLB via `heroGltfLoader()`).
4. **W5-F4** The sweep tools (static + live) and run 1 by the end of day 2; triage table to the owners in the report.
5. **W5-F5** Forgiving feet: slide along, auto-vault (guarded), BAYBAY pull, R clears a stale lock (MF2 table).
6. **W5-F6** The GGB deck camera and deck steering (`cityViews` relaxed on the deck; forward follows the deck).
7. **W5-F7** `faceOpen` for every landing and arrival (with N's fastTravel and the glide landing).
8. **W5-F8** Levers: low-poly shadow proxies for the player and BAYBAY; district bikes / car hidden beyond 250 u in city mode.
9. **W5-F9** Overlay: the goals step modal (C's flow state), the discovery batch chip (N), the slot render points kept
   laid out at 390 × 844 and 375 × 667 with no overlaps (trip pill, toasts, waypoint, bubble, arrival card, ride banner,
   bottom bar, the new overlays).
10. **W5-F10** (should) Mantle; a designed ride camera on the bus deck and the LRV (higher, further back, riders small in
    the lower third; gaps S18); the scenic auto-glide autopilot with N.
11. **W5-F11** Sweep run 2 (after all fixes) → 0 stuck; tests, shots, report.

**Tests:** `w5-lock`, `w5-feet` (synthetic worlds: vault never over `noVault`, never a drop > 0.75 u, never onto a roof;
pull never across water; slide keeps ≥ 60 % speed along a rail at 30°), `w5-char` (charApi contract with a stub rig);
`actors`, `sf-move2/3`, `sf-modes`, `sf-nav` green. **Shots** (`docs/opus-bay/qa/w5/F/`): phone after the Sutro 飞过去
facing open ground; GGB mid-deck holding forward with the camera behind (phone + desktop); the BAYBAY pull moment; 起飞
with BAYBAY in talk range (phone); a dance two-shot; BAYBAY in the teal scarf; 375 × 667 HUD with a trip, a toast and the
ride banner.

### 4.5 Lane N · Navigation, map & travel

1. **W5-N1** `goTo()` + `registerFlagSource()` + the exported `FootprintsTab` (push first).
2. **W5-N2** Planner (MF4): fly 推荐 over 60 s after the unlock, fly to undiscovered places (discovery + arrival
   `first: true` on landing, a descent beat), fastest honest ground mode before the unlock, goal options under 其他方式
   with badges, the `FLY_NOTE` goal test; one ETA source (T's `rideEta()`; 7.5 u/s auto-run).
3. **W5-N3** Auto-travel: the button moves at once; persistent auto-follow; the 带路中 chip; the footprint step-out;
   带我去 in the 问 BAYBAY sheet (an ask-item slot).
4. **W5-N4** Phone map: compact pinned card, cluster chooser, long-press → 去这里, search results with the go button.
5. **W5-N5** fastTravel: city `arrivalSpot` through nav (routed §8.4) + F's `faceOpen`; the descent as a first-sight
   moment.
6. **W5-N6** Title resume (MF6) with C's `onWelcome('returning')`.
7. **W5-N7** Quiet HUD: the discovery batch, toast only attractions, one waypoint owner, the district lesson list hidden
   in city mode, the 金门大桥 area chip on the deck, the routed P items (the Queen Wilhelmina zh name; `SF_ROUTES` on the
   map).
8. **W5-N8** Flags: event pennants first on phones near the player / waypoint; the new glyphs from V; the Settings toggle
   unchanged.
9. **W5-N9** (should) Scenic auto-glide with F; (could) 陪 BAYBAY 散步过去, a strolling option along the day's coin trail.
10. **W5-N10** Tests, shots, report.

**Tests:** `sf-trip` (the new 推荐 rule, undiscovered fly, never before the unlock, fly never completes a goal),
`w5-nav` (`goTo` resolution, the four ETA displays equal within 10 %, long-press → a standable spot, the persistent-follow
reducer, discovery batching); `sf-citymap` (the card never hides the go button at 352 × 388). **Shots:** the phone map's
compact card with 🐦 飞过去 · 8 秒; long-press 去这里; the 带路中 chip mid-walk; the resumed title (phone + desktop); the
desktop 问 BAYBAY → 带我去; the map with the 这周 filter on Oct 3.

### 4.6 Lane C · Content, flow & tours

1. **W5-C1** Public hooks (push first): `registerRumourSource`, `registerFrameDecorator`, `onWelcome`, the documented
   `bubble` / `markGoalsDone` usage.
2. **W5-C2** The pelican first (MF3): goal #1 with reward text, any-viewpoint unlock, the tour's first-stop unlock line,
   the unlock moment handing off to A's `startFirstFlight()`, the Alcatraz name line to D.
3. **W5-C3** Welcome: 欢迎回来 + the zone from `lastSafe` + one SF Today line (R); the goals step once (MF6).
4. **W5-C4** Rewards: `arrival.ts`, postcards, favours, goals and the pelican emit `reward` with the source grammar; stamps
   keep emitting `stamp`.
5. **W5-C5** Tours: auto-board the tour's own bus with T; the deck-crossing goal within 10 u of both towers + progress on
   the deck; re-time the Grand Tour end to end after MF2 and quote the measured time; the express run timed (lane C's open
   item).
6. **W5-C6** Lines: VOICE.md glossary; C's own new lines (pelican moment, welcome back, goals step, rumour framing) frozen
   with a tag for V; the routed C items (`goalsDone` cap 128 in `wishlist.ts readProgress`; `start-tour` with `tourId`).
7. **W5-C7** (should) Favour step 2 + letters; the photo album (§3.5).
8. **W5-C8** Tests, shots, report.

**Tests:** `sf-tasks`, `sf-content`, `flow-logic` updated on purpose (goal order, any-viewpoint unlock, the tour unlock),
`w5-content` (each reward source emitted once per first event; the welcome branch; the goals step shown once).
**Shots:** the phone goals step; the pelican landing moment; 欢迎回来 on a resumed save; the tour's first-stop unlock line;
the GGB deck goal progress line.

### 4.7 Lane T · Transit & crowds

1. **W5-T1** Hooks (push first): `addCrowdSpots`, `rideEta()`, the turntable beat / boost, the bell pad slot in the ride
   banner, crowd waves back to `emote`.
2. **W5-T2** The bus stalls (MF2): `busWatch.ts` instrumentation, the Mason St and Lincoln Blvd fixes, dwell / wait caps,
   progress-based ETA, 10 s → 直接到站, hop-off / fly-to honoured during the veil.
3. **W5-T3** The tour bus boards without the driver question (with C).
4. **W5-T4** Levers: per-instance distance cull of district life (`world/life.ts`); cable-car / F-line far LOD with shadows
   near the camera only.
5. **W5-T5** Crowds: the 3 u clear lane on the GGB deck and through event crowds; step round the six residents (routed);
   the M rows fit on the phone.
6. **W5-T6** `audio/hooks.ts` internals (with the lead's wiring): sounds, loops, `audioNow()`, `duck()`.
7. **W5-T7** (should) Honest service rows on station cards (source + verifiedAt); the idle cable car to the barn after
   23:00 with rides still available; plaza pigeons that scatter when you run (the existing flock, 0 new calls).
8. **W5-T8** Tests, shots, report.

**Tests:** `sf-bus`, `sf-metro`, `sf-transit` green; `w5-transit` (ETA from progress never frozen > 15 s in a scripted
sim, 直接到站 raised after 10 s without progress, the clear lane kept with 20 visitors). **Shots:** the loop bus passing
Lincoln Blvd; the ride banner with 直接到站 raised (phone); the GGB deck crowd with the centre lane; Hellman Hollow crowd
on Oct 3 (with R).

### 4.8 Lane L · Landmarks & streets

1. **W5-L1** Sweep fixes in landmark walk data (blockers vs drawn, exclusions over paths) and the tier-3 arrival points
   (MF2); the routed §8.4 L items (the four arrivals, the `pyramid` kit turn, the remaining T2 settings).
2. **W5-L2** The fire-ring season through R's `isFireRingLit` (cold rings out of season).
3. **W5-L3** Seward slides: the top deck walkable, the chute lines reachable from it (for A).
4. **W5-L4** Signature corners 1–4 (Irving, Clement, 24th St, 3rd St Bayview), each with golden and night shots.
5. **W5-L5** Corners 5–8 (Haight, Japantown, Noe Valley, Castro).
6. **W5-L6** (should) Chinatown / North Beach corners only with V's measured headroom ≥ 20k.
7. **W5-L7** Tests, shots, report.

**Tests:** `w5-corners` (≤ 2.5k tris, ≤ 2 calls each, outer-city bbox only, no text meshes, a coin cache spot standable,
the crowd spots inside the plaza); `sf-landmarks`, `sf-sites-w4`, `sf-sites-w4t3` green. **Shots:** each corner at golden
hour and at night from street height (phone); the fire rings cold on `?date=2026-11-05T19:00`; the Seward top deck.

### 4.9 Lane V · Visuals, performance, voice & assets

1. **W5-V1** The baseline on the day-0 head (with the lead's quiet numbers) and the downtown headroom published in the
   first push.
2. **W5-V2** Levers: district NPCs hidden beyond 250 u in city mode (`npcs.ts`); the far stand-in for the district
   hand-made buildings; the label atlas overflow guard.
3. **W5-V3** Bundle: the city-only data out of GameRoot (≈ −28 KB); the P7 guard extended to the four new folders.
4. **W5-V4** Atlases: flag glyphs 256² → 512² (same draw call) with coin / calendar / sparkle / music; the 1024² signs
   atlas (canvas-painted bilingual words on plaque textures).
5. **W5-V5** Nights: outer-district windows and lamps as light-field points; coin glints (E's positions).
6. **W5-V6** Warm-up registration for every new material (coins, rings, jets, event kits, egg props, pennants); the perf
   gate after each lane batch (table below).
7. **W5-V7** Voice: record the lanes' frozen line sets (C, D, A, R, E, N) with the Pixie preset, the owner listening
   sheet, `MUTED_CLIPS` fallback.
8. **W5-V8** Higgsfield assets (§5) with the ledger.
9. **W5-V9** The production-header check: `scripts/opus-sf/qa/csp-serve.mjs` serves `dist` with `vercel.json`'s headers;
   the city runs 5 minutes with 0 blocked requests (tides / live JSON same-site).
10. **W5-V10** (should) The Bay Lights shimmer, the Salesforce crown drift, the moon phase uniform (R's math), Karl by
    month (R's factor in `world/sf/fog.ts`); the routed V items (Strawberry Hill water holes, mural boards at 0.06 u,
    `opus-prof.mjs` port, the `?debug` panel on phones, warm-up drift along routes).
11. **W5-V11** Shots, report, ledger.

**The gate** (V after each batch; the lead re-runs at W5-Z on a quiet machine): ≤ 150 calls and ≤ 400k tris (shadows
included) at quality high, 1440 × 900, RTX, in: the Ferry gate, Chinatown, Twin Peaks, Civic Center, Union Square, the
Music Concourse, Stonestown / SF State, Haight / USF, the GGB deck, Ocean Beach, **Hellman Hollow with the event kit,
Marina Green with the jets, Castro on fair day, the Filbert Steps with a coin trail, Irving St corner at night**, the bus
deck at the Palace approach; phone 390 × 844, dpr 3, mid, 4× CPU ≥ 45 fps walking at the Ferry gate, Chinatown, Twin
Peaks, the Music Concourse and Ocean Beach, and riding the bus; `programs` equal at 1× idle and 4× walk; no frame
> 100 ms on the first touch, at portal cuts or when a kit builds; GameRoot ≤ 265 KB gzip; tsc 0, eslint 0, every opus-bay
test green, hero regression green, district contact sheet unchanged. **Shots:** before / after levers at Chinatown and
Twin Peaks (desktop); the outer city at night (Sunset, Bayview, Richmond); the Bay Lights shimmer (should).

### 4.10 Lane E · Economy & notebook

1. **W5-E1** Ledger (push first): listens to `reward`, validates the source grammar, pays once (bitsets / `play.e`),
   writes `play`, emits `coins`; the Settings reset clears it.
2. **W5-E2** `coinSpots.ts` + `coins-place.mts`: ≈ 60 trails, 40 caches, 15 air rings, placed with the postcard rules and
   tested against the published city; downtown spots flagged and held until V's headroom.
3. **W5-E3** Coins in the world: the instanced disc, per-chunk pickup at ≤ 30 Hz, radii, chime, sparkles; the daily
   refill by Bay date.
4. **W5-E4** The pill badge `🪙 n` (slot).
5. **W5-E5** Notebook tab 手帐 (slot): 印章, 小发现 (D), 看风景 (A), 足迹 (N's component); page rewards; the header line (R).
6. **W5-E6** Shop: the sheet (More item slot), the stall interactable (`act`), tiles, buy / wear, the try-on framing through
   `holdLock('shop')`, conveniences (compass, magnifier with `hintTarget`), the 飞行券 rule, toys shelf (should).
7. **W5-E7** Wearables through `charApi` (scarves first, then hats), paints, pelican ribbon, frames (C's decorator).
8. **W5-E8** The economy run (scripted 60 minutes) → prices locked before build 3.
9. **W5-E9** (should) 城市之声 and 自然 pages when D / C deliver; the unlock ladder.
10. **W5-E10** Tests, shots, report.

**Tests:** `w5-ledger` (fuzz: each source pays once, bad sources ignored, the balance never negative, round trip through
`encodeSave` / `decodeSave`, the size test at caps), `w5-coins` (registry snapshot: indices never move; every spot
standable, reachable, ≥ 6.5 u from cards, not in water; air rings between the glide soft floor and the ceiling),
`w5-shop` (prices, wear slots, the 飞行券 refund, nothing sells speed / access), `w5-notebook` (page completion pays once).
**Shots:** the Filbert Steps coin trail (phone); the pill with coins (phone + desktop); the shop sheet with BAYBAY trying
the Karl-grey scarf (phone + desktop); the notebook's 小发现 page with silhouettes; an air-coin ring over Coit from the
glide.

### 4.11 Lane A · Activities & actions

1. **W5-A1** PlayKit core + result card; `viewSpots.ts` ids and `startFirstFlight()` exported (push first).
2. **W5-A2** Emote wheel (the `self-tap` event, T 1–4, the 问 BAYBAY row), the selfie two-shot through C's photo mode.
3. **W5-A3** Pet BAYBAY and her shoreline float.
4. **W5-A4** Sit anywhere + the 16 view spots and the slow look.
5. **W5-A5** The first flight (MF3) with rings and coins.
6. **W5-A6** Seward slides.
7. **W5-A7** The cable-car bell riff and the lean-out photo.
8. **W5-A8** Stair races with the step counter.
9. **W5-A9** (should, in this order) Marshmallow (by Oct 14 or it waits for March), turntable heave-ho, crest hops, the
   sea-lion count, fetch / frisbee, beach ball, cardboard sled, the Lombard descent + Vermont, the GGB-towers ring course;
   (could) hide & seek.
10. **W5-A10** Tests, shots, report.

**Tests:** `w5-play` (the judge on `audioNow()` with a stub clock and ±150 ms, auto-offset, cancel pays nothing, pays
once per tier, bests saved, `holdLock('activity')` released on every exit), `w5-play-acts` (view spots standable and
facing their view, rings inside the glide envelope, each activity chunk ≤ 5 KB and absent from the GameRoot graph).
**Shots:** the emote wheel (phone); dancing with BAYBAY and the crowd waving back; the slides mid-ride; the bell riff on
the running board; the stair-race result card; the first-flight ring over the Ferry Building; the slow look at Twin Peaks.

### 4.12 Lane D · Discoveries & easter eggs

1. **W5-D1** `registry.ts` (ids, riddles, facts with `sourceUrl` + `verifiedAt`, lines ≤ 45 zh characters) (push first).
2. **W5-D2** Hosts: fact card, sound recipes through `audio/hooks.ts`, the fx pool, one instanced prop pool (≤ 1 call,
   props ≤ 200 tris, no walk blockers: props sit off the walk line), camera beats through `playShots`, date and month gates
   through `bayNow()`.
3. **W5-D3** Eggs 1–12 (north and waterfront), OSM snaps for the approx coordinates.
4. **W5-D4** Eggs 13–24 (west, south, east).
5. **W5-D5** Rumours through C's source (≤ 1 per 5 min, only unfound eggs in the zone); the compass target for E.
6. **W5-D6** (should) Batch 2, the pebbles, 城市之声.
7. **W5-D7** Tests, shots, report.

**Tests:** `w5-eggs` (registry snapshot; every egg has ≥ 1 source + verifiedAt; zh lines ≤ 45; every spot inside the city
bbox and standable; gates with stubbed dates: the humpback only April–November, the dahlia sign only in 2026, the hydrant
brush only on 18 April 05:00–09:00, the labyrinth present on ≈ 70 % of 365 seeded days, the sundial shadow angle matches
R's sun azimuth within 2°). **Shots:** the parrots on the Filbert Steps; China Beach junks at golden hour; the Chinatown
phone bubble; the foghorn-duet caption on the deck in fog; the dahlia "100" sign; the Heron's Head top-down beat; rainbow
footprints in the Castro; the sundial at 15:00 real time.

### 4.13 Lane R · Real San Francisco

1. **W5-R1** `sun.ts` into `qa.ts bayTimeOfDay`; `isFireRingLit`; the `?date=` flag through `bayNow()`; the other §4.3
   functions (push first; build 1).
2. **W5-R2** `eventVenues.ts`, `eventsNear()` on mapped points, the week board SF-first with flyers right after the three
   questions (build 1).
3. **W5-R3** Event presence: pennants (N's source), crowds (T's spots), kits, loops, the zone line, souvenir stamps,
   EventCard + 带我去 (HSB, YBG and Castro rows in build 1 or cut; the rest by build 2).
4. **W5-R4** The 今天 tab (slot) with its rows and sources (build 2).
5. **W5-R5** 今日三件小事: the seeded generator (E pays) (build 2).
6. **W5-R6** Fleet Week jets, the morning line, the photo subject, the glide soft box (by Oct 7 20:00 or cut).
7. **W5-R7** (should) `moon.ts` for V; `calendar.ts` with the Halloween, Día de los Muertos (hidden) and king-tide rows;
   `export-tides.ts` + `tides.json`; `export-live.ts` + `live.json` badges; 现实中怎么去 with T's headway table; 我的周末;
   the guide links; `karlMonthFactor`.
8. **W5-R8** Tests, shots, report.

**Tests:** `w5-sun` (sunrise / sunset within 2 min of the computed table for 12 dates; bands at the DST edges 2026-11-01 and
2027-03-14 and at both solstices), `w5-events` (venue mapping; `?date=2026-10-03` YBG lists the African Arts Festival;
`?date=2026-11-05` shows nothing expired; adult-only and professional events never in the world; unmapped venues get no
pin), `w5-today` (rows carry sources; the daily three seeded and stable for a Bay date), `w5-jets` (visible only Oct 9–11
12:00–16:00 Pacific with a clock stub; 4 jets on phones), a grep test that no runtime fetch leaves the site (only
same-site paths and the catalog). **Shots:** Hellman Hollow on `?date=2026-10-03T10:30` (phone + desktop); YBG tents;
the Castro fair on `?date=2026-10-04T13:00`; the 今天 tab (phone); the jets from Marina Green on `?date=2026-10-09T12:40`;
the golden → night sky on `?date=2026-12-21T17:10`.

### 4.14 Order, builds and the final verify

- **Day 0, Mon Sep 28 (lead):** W5-0a → 0g; the hotfix phone package the same evening. Lanes start as soon as W5-0d is
  pushed (each rebases on it).
- **Day 1:** every lane's §4.3 hooks first; V publishes the baseline and the downtown headroom; F starts the sweep.
- **Build 1 — by Thu Oct 1, 20:00 PT** (Hardly Strictly opens Fri Oct 2): MF1 (lead + F1), 起飞 always visible + the
  pelican goal first (F3, C2), resume + welcome back (N6, C3), real sun + fire-ring season + `?date=` (R1, L2), the venue
  table + HSB / YBG / Castro presence (R2, R3; **cut rule:** if R3 is not green by Oct 1 18:00, HSB and Castro wait for
  2027 as calendar config and only the venue table and the flyers ship), the first levers (V2, F8, T4 first parts).
- **Build 2 — by Wed Oct 7, 20:00 PT** (Fleet Week air show Fri Oct 9): MF2 sweep 0 stuck, the bus, the GGB deck (F, T,
  L, N, C); MF4 one-tap (N); coins + ledger + pill + notebook (E1–E5); the pelican moment + first flight (C2, A5); the 今天
  tab + the daily three (R4, R5); **Fleet Week jets (R6, cut rule)**; all levers + the bundle move (V2, V3); emotes, pet,
  sit (A2–A4).
- **Mid-wave checkpoint (lead, after build 2):** the gaps scout's 20-minute phone script and the sweep again; **the five
  owner points must pass before any should item starts.**
- **Build 3 — by Wed Oct 14:** the shop and wearables (E6, E7, prices from E8), slides / bell / stairs (A6–A8), eggs 1–24
  and rumours (D3–D5), corners 1–4 (+ 5–8 as ready) and lit nights (L4, L5, V5), shoulds that are green (marshmallow
  first: the fire season ends Oct 31).
- **W5-Z verify — by Fri Oct 16 (lead):** tsc, eslint, the full suite; the sweep (0 stuck); the lock paths on the phone
  profile; the save size test at the caps; the perf gate alone on the machine (RTX + iGPU) and the phone profile; a real
  iPhone pass after 5 minutes of walking (memory, `WEBGL_multi_draw`); the production-header check; the Grand Tour timed
  end to end (full + express) and its quote updated; three read-throughs of every lane report against this plan;
  `docs/opus-bay/sf-w5-summary.md`; ledgers merged into ASSETS-LEDGER; STATUS / RESUME updated.
- **Live checks (lead, scheduled):** Sat Oct 31 (Halloween dressing if built, the last day of the fire season and of the
  catalog's events) and Sun Nov 1 (DST end: the sun bands); Oct 9 12:30 PT (the jets are up).

---

## 5. Higgsfield plan

Balance **≈ 400** (400.07 at 2026-09-28 01:28 UTC after wave 4; the task brief says ≈ 410: the lead confirms with `balance`
+ `transactions` at day 0). **Wave-5 cap 130, expected ≈ 99; the balance never goes under 250** (the owner's floor is 80;
we keep far more for later polish). Only lane V spends; other lanes send requests through their report. Every batch:
`balance` before, `transactions` after, attribution by job id and time, the CDN check, a row in `ledger/w5-V.md`.

| # | asset | model / settings | credits (expected / worst) | fallback |
|---|---|---|---|---|
| H5-1 | **Shop item icons**: 27 tiles as 3 sheets of 9 (3 × 3 grid, gouache toy style matching the stickers, no text, no logos, plain cream ground) → cut to 256 px WebP tiles | nano_banana_pro 1:1 4k, 2 draws per sheet (4 each), style refs = the T1 sticker sheet + BAYBAY's portrait | **24** / 32 | the live try-on preview + lucide glyph tiles |
| H5-2 | **Six 彩蛋明信片 (secret postcards)** found with their eggs: China Beach junk silhouettes at golden hour; parrots over the Filbert Steps gardens; the Wave Organ at high tide; the Lands End labyrinth framing the Gate; the Dahlia Dell "100"; the GGB towers in Karl with the foghorns | nano_banana_pro 4:3 2k, refs P5 + P13, the wave-4 1.75 × retake factor, "no text, no logos, no people's faces" | **21** / 24 | the egg's fact card only (the city keeps 24 postcards) |
| H5-3 | **Voice**: ≈ 300 new lines (C ≈ 40, D ≈ 80, A ≈ 60, R ≈ 60 fixed lines — dynamic lines such as times stay text —, E ≈ 30, N ≈ 20) × zh + en, 2 takes | qwen_audio_tts, Pixie preset, trim, loudnorm −18 LUFS / TP −1.5, m4a + ogg | **9** / 15 | the text bubble + chirp |
| H5-4 | **Reference sheets** (art targets, not shipped): toy jet formation (no insignia), event kits (stage, tents, bunting), the shop stall, 4 signature corners, the coin + ring style | nano_banana_pro 2k × 8 | **16** / 16 | the procedural builds from the scouts' descriptions |
| H5-5 | **Textures**: sign plaque / awning sheet for the signs atlas (the words are drawn in canvas with real fonts, never by the model); the notebook paper and page-corner art | nano_banana_pro 4k × 2 | **8** / 8 | flat painted canvas plaques |
| H5-6 | **Conditional models** (outer city only): up to 2 AI GLBs where lane L's SoloView review says a procedural site reads poorly (candidates: the Dutch Windmill, the Beach Chalet); the wave-4 QA gate and Draco + WebP ≤ 250 KB | 2 concepts each (nano_banana_pro 2) + SAM 3D (1–1.5) | **11** / 14 | the procedural site (always shippable) |
| H5-7 | Optional generated SFX (jet roar, crowd murmur) only if the synthesized ones sound cheap | generate_audio | **0** / 6 | synthesis |
| H5-8 | Retake reserve | any of the above | **10** / 15 | — |
| | **total** | | **≈ 99 / 130 (capped)** | |

Stop rules: reject any draw with text, logos, a base or clipped edges before paying for the next step; two failed models
in a row → no more models; spend passes 100 → only H5-1, H5-3 and H5-8 continue. No image of a real person, real
insignia, a real mural or artwork, or a brand.

---

## 6. Risks and defaults

The owner does not want to be asked: each item is the default the lanes follow; the lead records any change in
`sf-w5-lead.md`.

| # | question / risk | default |
|---|---|---|
| D1 | Is flying to undiscovered places free after the pelican? | Yes; the descent is the discovery moment. |
| D2 | The owner's "free 飞过去 ticket" | Kept as 飞行券, usable only before the pelican unlock (the first one free); hidden after the unlock, unused tickets refund 10 coins. Hint tickets (compass, magnifier) are the post-unlock conveniences. |
| D3 | Coins or shells? | 金币, as the owner wrote: toy gold discs with an otter-paw emboss. |
| D4 | Where is the shop? | More → 小铺 anywhere, plus the Ferry Building back-plaza stall on non-market days. |
| D5 | Emotes on the phone | Tap your own character (one coach mark) and a row in the 问 BAYBAY sheet; desktop T then 1–4. No new button. |
| D6 | Petting BAYBAY | Double-tap her or 问 BAYBAY → 摸摸; her single tap is unchanged. |
| D7 | Real sun for players outside Pacific time | The sky follows SF's real sun by default; Settings keeps the fixed-time choice; the first-visit golden rule wins. |
| D8 | Hardly Strictly (Oct 2–4) and the Castro Street Fair (Oct 4) are 4–6 days away | Build 1 tries (venue table + pennant + crowd + line + card); cut rule at Oct 1 18:00; if cut, they become 2027 calendar config. |
| D9 | Fleet Week jets | Must be in the owner's build by Wed Oct 7 20:00 PT; otherwise 2027 via config, nothing half-done. Practice day (Oct 8, secondary source) not shown. |
| D10 | The catalog ends on 2026-10-31 | The computed signals (sun, fire season, eggs by month, daily three) carry the world; the honest "none this week" line stays; a request to the site editors for November SF events and `location {lat, lng}` on SF events. |
| D11 | Día de los Muertos 2026 date not posted | Hidden until an organiser date is verified. |
| D12 | The DESIGN.md "events only from the catalog" rule | The venue table only positions catalog events; the verified calendar gets the day-0 carve-out (dressing only, never an event card). |
| D13 | Live weather / Muni / tides at runtime | Not this wave: production CSP blocks third-party calls; tides are baked at build time; live weather would need a same-site function and the owner's go-ahead later. |
| D14 | Merging `origin/main` into opus-bay | The lead merges at day 0 and keeps `git.deploymentEnabled.opus-bay: false`; opus-bay previews stay off; the public site sees wave 5 only after a later merge to main. |
| D15 | Downtown budget (phone 4× at 23–44 fps today) | Levers first; nothing new downtown until V publishes the measured headroom; downtown event kits = pennant + crowd only until then; Chinatown / North Beach corners need ≥ 20k headroom. |
| D16 | Bundle over budget (292 KB vs 250) | All wave-5 code lazy; V moves ≈ 28 KB of city data out; W5-Z target ≤ 265 KB, 250 stretch; the sun math (≈ 1 KB) may sit in the main graph. |
| D17 | Save wipe over 64 KB | Day-0 encoder fix (trim discovered, then arrivals, never play / unlocked / tours / lastSafe) + bitsets + the size test at every cap. |
| D18 | The F1 cause is read from code | The day-0 red test proves it first; the watchdog stays as a DEV-logged net; any watchdog release in QA is a bug with its source named. The tour runner's own wait is checked by the tour-stop path test. |
| D19 | Vault / pull could reach roofs, cliffs or bridge sides | Only blockers with a known top; `noVault` edges; drop ≤ 0.75 u; never onto roofs; pull never across water; synthetic tests. |
| D20 | Ten lanes on one machine | One headless Chrome per lane; the PERF-LOCK file during gates; fps only from V / the lead; the full suite's two wall-clock tests may flake under load: re-run before blaming a change. |
| D21 | Economy tuning | About one cosmetic per 15 min; prices locked from E's scripted 60-minute run before build 3; nothing buys speed, access or places; no real money, loot boxes or streaks. |
| D22 | Wildlife and safety tone | Watch only, never feed (sea lions: unlawful); "usually" wording; never a live-looking count; no swimming prompts at Ocean Beach; never onto rocks or cliff edges; the sea cave closes in big surf. |
| D23 | Sensitive places | Colonial history always with the Ohlone line; a respectful tone at Alcatraz (the 1969–71 occupation), the pet cemetery, Lotta's Fountain, Día de los Muertos, active churches; Emperor Norton affectionate, never "crazy". |
| D24 | Copyright and marks | No logos, insignia, team or brand names in the world, no film stills, actors or character names, no Yoda model, no copied murals, mosaics, the Bay Lights sequences or the crown imagery; generic bilingual sign words only. |
| D25 | Fact drift | Every calendar, season and hours row carries `sourceUrl` + `verifiedAt` and hides after its window; the lead re-checks the time-sensitive rows at W5-Z; corrections carried: the GGP Band season ended Sep 27; the 53rd bell contest was 2016; Filbert St is not "the steepest"; PIER 39's page gives no leave / return months. |
| D26 | Tour players and the pelican | Unlock at the first tour stop reached, with a line; no route change. |
| D27 | Should the city become the default world (`DEFAULT_WORLD_MODE` is still `'district'`)? | Unchanged this wave; the lead decides after W5-Z's phone gate and records it. |
| D28 | Scope slips | Cut order: corners 5–8 → eggs 17–24 (keep 16, at least one per area) → the view card image (keep sitting) → the should list. MF1–MF7 and MF9 are never cut. |
| D29 | iOS specifics | No `navigator.vibrate` (visual thud); rhythm judged on AudioContext time; IndexedDB may fail in private mode (in-memory fallback); gyro off. |
| D30 | Relayed owner messages during the wave | Not a new task; a status line (in Chinese when asked in Chinese) in the lane report or reply, and keep working. |

---

## 7. Appendix A: how the proposals were scored

Each merged item was scored 1–5 on **delight** (a player notices and smiles), **fit** (the owner's request and five
feedback points), **feasibility** (within the budgets and the wave), **risk** (5 = low) and **cost** (5 = cheap). Σ ≥ 19
→ must; 15–18 → should; ≤ 14 → could / not now. The owner's five points and the enablers (the lock, the save, the ledger,
PlayKit, the levers, the site data) are must regardless. Sources: **Co** = cozy, **Ac** = action, **Re** = real.

| item (proposal ids) | delight | fit | feas. | risk | cost | Σ | verdict · whose version |
|---|---|---|---|---|---|---|---|
| F1 lock fix (Co M0, Ac A1, Re M1) | 5 | 5 | 5 | 4 | 5 | 24 | must · Ac's derived lock + Co's day-0 hotfix + Re's red test and tour check |
| F2 sweep, bus, GGB deck, arrivals (Co M1, Re M2) | 4 | 5 | 3 | 3 | 2 | 17 | must (owner) · Re's acceptance numbers, Co's scope |
| Slide along + BAYBAY pull (Ac A2) | 4 | 5 | 4 | 3 | 4 | 20 | must |
| Auto-vault, guarded (Ac A2) | 4 | 4 | 3 | 2 | 3 | 16 | must-lite (owner F2) with Ac's guard rails |
| Mantle (Ac A2) | 4 | 3 | 3 | 2 | 3 | 15 | should (after the sweep) |
| F3 pelican first (Co M2, Ac A3, Re M4) | 5 | 5 | 5 | 4 | 4 | 23 | must · Co's any-viewpoint unlock, Ac's first-stop tour unlock |
| Guided first flight with rings (Ac A3/G5) | 5 | 4 | 4 | 4 | 3 | 20 | must |
| Coin trail to Coit (Ac A3) | 4 | 4 | 5 | 4 | 5 | 22 | must (part of E's trails) |
| F4 one tap (Co M3, Ac A4, Re M3) | 5 | 5 | 4 | 3 | 3 | 20 | must · Re's ≤ 2 taps test, Ac's persistent auto-travel |
| Fly to undiscovered places (all) | 5 | 5 | 4 | 3 | 4 | 21 | must |
| Stroll with BAYBAY option (Co M3) | 3 | 2 | 3 | 4 | 2 | 14 | could |
| Scenic auto-glide (Ac A4) | 5 | 4 | 2 | 2 | 2 | 15 | should |
| F5 coins + trails + caches (Co M5, Ac A5, Re M6) | 5 | 5 | 4 | 3 | 3 | 20 | must · Co's scenic placement + Ac's air rings |
| Shop with live try-on (Co M5, Ac A5) | 5 | 5 | 3 | 3 | 2 | 18 | must (owner) · Co's stall reuse, Re's SF-flavoured names |
| Hint tickets vs 飞行券 (Re M6 vs Ac A5) | 3 | 4 | 5 | 5 | 5 | 22 | must · both: 飞行券 before the unlock only (D2) |
| Event souvenirs never for sale (Re M6) | 3 | 4 | 5 | 5 | 5 | 22 | must |
| Save play block + fallback fix (all) | 1 | 5 | 5 | 5 | 5 | 21 | must (enabler, day 0) |
| Notebook 手帐 (Co M6) / stamp book (Ac S-P2, Re S7) | 4 | 4 | 4 | 4 | 3 | 19 | must · Co's notebook with Ac / Re's stamp page inside |
| Returning players resume (all) | 4 | 4 | 5 | 4 | 5 | 22 | must |
| Goals once, quiet HUD, toast batch (Co M11, Re M5) | 3 | 5 | 5 | 4 | 5 | 22 | must |
| Budget levers + bundle move (Co M4, Ac B1, Re M0) | 2 | 4 | 4 | 3 | 3 | 16 | must (enabler) · split by file owner |
| PlayKit (Ac P1) | 3 | 4 | 4 | 4 | 4 | 19 | must (enabler) |
| Emotes (Co M9, Ac M1, Re M12) | 4 | 4 | 4 | 4 | 4 | 20 | must · Ac's tap-self + Co's sheet row |
| Pet BAYBAY + float (Co M9, Ac M1) | 5 | 3 | 5 | 4 | 5 | 22 | must (double-tap, D6) |
| Sit anywhere + view spots (Co M9) | 4 | 4 | 4 | 4 | 4 | 20 | must (card image with the album: should) |
| Seward slides (all) | 5 | 4 | 4 | 4 | 4 | 21 | must |
| Cable-car bell riff (Ac G2, Re M12, Co S8) | 4 | 4 | 4 | 3 | 4 | 19 | must |
| Stair races (Ac G4, Co S8) | 4 | 4 | 4 | 4 | 4 | 20 | must |
| Turntable heave-ho (Ac G3) | 3 | 3 | 5 | 3 | 5 | 19 | should (exception: it touches lane T's fragile turntable; presentation only, after T's musts) |
| Crest hops (Ac G6, Co S8) | 3 | 3 | 4 | 3 | 4 | 17 | should |
| Marshmallow (Ac S-G8, Re M12, Co C2) | 4 | 4 | 5 | 4 | 5 | 22 | should-first (exception: the fire season ends Oct 31, so ≈ 2 weeks of value this year; built once, it returns every March) |
| Sea-lion count (Ac S-G10, Re M12) | 3 | 4 | 4 | 3 | 3 | 17 | should |
| Sled, fetch, ball, Lombard descent (Ac S-M2/3, S-G7/9) | 4 | 3 | 3 | 3 | 3 | 16 | should |
| Pigeons scatter (Ac S-M4) | 3 | 3 | 4 | 3 | 4 | 17 | should (T, after the levers) |
| Hide & seek, arcade, performers (Ac S-G12, S-G11, C-PACK) | 3 | 3 | 3 | 3 | 2 | 14 | could |
| Grip shift (Ac C-PACK) | 4 | 3 | 2 | 1 | 2 | 12 | not now |
| Eggs batch 1 (Co M7, Ac S-E1, Re S6) | 5 | 5 | 4 | 3 | 3 | 20 | must · Co's 24 by area, swapped for closures and hosts (§3.1) |
| Rumours / riddles (Co M7) | 4 | 4 | 4 | 4 | 4 | 20 | must |
| Eggs batch 2 (Co S10) | 4 | 4 | 3 | 3 | 2 | 16 | should |
| Pebbles (Co S1, Ac S-P3) | 4 | 3 | 4 | 4 | 3 | 18 | should |
| Sounds page (Co S3) | 3 | 3 | 4 | 3 | 3 | 16 | should |
| Nature log + album (Co S4, Ac S-R2, Re C5) | 4 | 3 | 3 | 3 | 3 | 16 | should |
| Site data merge (Re M7, Co M8) | 2 | 5 | 5 | 4 | 5 | 21 | must (lead, day 0) |
| Venue table + eventsNear + week board (Re M7) | 4 | 5 | 4 | 4 | 4 | 21 | must |
| Event presence kits (Re M8, Co M8) | 5 | 5 | 4 | 3 | 3 | 20 | must |
| Real sun (all) | 4 | 5 | 5 | 4 | 5 | 23 | must |
| Fire-ring season (Co M8, Re M9) | 3 | 4 | 5 | 5 | 5 | 22 | must |
| SF Today + daily three (Re M10, Ac S-R1) | 4 | 5 | 4 | 4 | 4 | 21 | must |
| Fleet Week jets (Co S2, Ac C1, Re M11) | 5 | 5 | 3 | 2 | 3 | 18 | must, time-boxed (the owner's 联动现实信息 showcase) |
| Moon (Re M9, Co S5) | 3 | 4 | 4 | 3 | 4 | 18 | should |
| Verified calendar + dressings (Re S1, Co S6) | 3 | 4 | 4 | 3 | 3 | 17 | should |
| Tides baked (Re S2, Co S5) | 3 | 4 | 3 | 3 | 3 | 16 | should |
| Free-today badges (Re S4) | 3 | 5 | 4 | 3 | 3 | 18 | should (hand rows in the 今天 tab are must) |
| Honest transit + how to go (Re S5) | 3 | 4 | 4 | 3 | 4 | 18 | should |
| Weekend handoff + guide links (Re S10) | 2 | 5 | 4 | 4 | 4 | 19 | should (exception: a site feature more than a game one; low delight in play) |
| Karl and nature by month (Re S3) | 3 | 4 | 4 | 3 | 4 | 18 | should |
| Signature corners (Co M10, Re S8) | 4 | 5 | 3 | 3 | 2 | 17 | must (owner's 完善整个旧金山): 4 must, 8 target |
| Outer night lights (Co M10, Re S8) | 3 | 5 | 5 | 4 | 5 | 22 | must |
| Bay Lights + crown (Co S9, Re S9) | 4 | 4 | 4 | 3 | 4 | 19 | should-first (exception: lane V's time goes to the levers and gates first) |
| Two-step favours + letters (Co S7) | 3 | 3 | 3 | 3 | 2 | 14 | should-late (exception: only if lane C has slack; it deepens the six residents) |
| Live weather, parade walkers, City Hall colours, openings, share card (Re C1–C6) | 3 | 3 | 2 | 2 | 2 | 12 | could / later |
| Live Muni, sports, disaster feeds (Re SKIP) | 1 | 2 | 1 | 1 | 1 | 6 | no |

What each proposal contributed: **cozy** gave the notebook, the sit-and-look, the rumours, the lit nights, the corners and
the calmest wording rules; **action** gave the derived lock, the forgiving feet, the first flight, the air coins,
PlayKit and most of the activities; **real** gave the build dates, the venue table, the SF Today tab, the save-fallback
fix, the souvenir rule and the production-CSP discipline. All three agree on the F1 cause, which is why the day-0 hotfix
needs no further scouting.

---

## 8. Appendix B: facts and sources

Checked by this planner on **2026-09-28** (direct page fetch):

| fact | source |
|---|---|
| Fleet Week 4–12 Oct 2026; air show 9, 10, 11 Oct, 12:00–4:00 PM; between the Golden Gate Bridge and Alcatraz; Marina Green festival centre, free general admission | https://fleetweeksf.org/air-show/ |
| Hardly Strictly Bluegrass Fri Oct 2 – Sun Oct 4, 2026; entrances 11:00 Fri, 9:00 Sat–Sun; performances end 19:00; Hellman Hollow, Lindley & Marx meadows, GGP; free, no tickets; no bicycles, scooters, skateboards or motorized devices inside (bike parking on the event map) | https://hardlystrictlybluegrass.com/info-faq-2026/ |
| Castro Street Fair Sun Oct 4, 2026, 11:00–18:00; Market St, Castro St and 18th St | https://www.castrostreetfair.org/ |

Checked by the proposals on 2026-09-28 (their notes cite the pages): the NPS Ocean Beach fire program (March–October,
out by 21:30, water only); the Seward Mini Park page (10–5 Tue–Sun, bring cardboard, adults must accompany children,
closes at sunset); the Monterey Bay Aquarium sea-otter page (back floating, forearm pockets, rock tools); PIER 39 sea
lions (seasonal numbers, 2,100+ in May–June 2024, feeding unlawful, no leave / return months); the Golden Gate Park Band
calendar (April–September, the 2026 season ended Sep 27); gggp.org admissions (Tea Garden free Mon / Wed / Fri 9–10,
Conservatory first Tuesday, Botanical second Tuesday); foodwise.org (the Ferry Plaza market Tue & Thu 10–14, Sat 8–14);
Wikipedia pages for Lombard St (8 hairpins, 5 mph sign), Filbert St (31.5 % maximum, tied sixth), the cable-car system
(9.5 mph cable, the Powell & Market turntable by hand), the Musée Mécanique; SFMTA's release for the 53rd bell contest
(7 July 2016); the SF sun and moon times (computed with the NOAA equations: `cozy/sun-cozy.mjs`, `rw/sun.mjs`,
cross-checked with sunrise-sunset.org within 2 min). Not verified: the Día de los Muertos 2026 date (hidden).

The 24 eggs' facts and sources: `C:/Users/willy/opus-qa/w5/eggs-out.json` (checked 2026-09-27; one correction carried
above). The venue table, the catalog freshness (opus-bay 93 events of 2026-09-23 vs main 104 of 2026-09-27; both end
2026-10-31), the CSP rules, king tides and Muni headways: `C:/Users/willy/opus-qa/w5/rw/real-world-scout.json`
(checked 2026-09-27). Capacity numbers: `C:/Users/willy/opus-qa/w5/capacity/` (measured 2026-09-27 under load: calls,
triangles and memory exact, fps indicative).

---

Status 2026-09-28: plan written from the three proposals and five scouts against `origin/opus-bay` 1d2cd76 (F1 cause
re-read in `game/cinema.ts`, `game/guideCity.ts`, `game/arrival.ts`, `game/flow.ts`, `game/fastTravel.ts`); three
time-sensitive dates re-checked on the organisers' pages today. No product files touched; no relayed owner messages
received during this task.
