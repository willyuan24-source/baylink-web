# Wave 6 · lane K2 · flow, UI & content fixes

Worktree `C:/Users/willy/wt/w6-k2` (branch `w6-k2`), dev port 5602, scratch `C:/Users/willy/opus-qa/w6/k2/`, QA images
`docs/opus-bay/qa/w6/K2/`. Owns `game/**` (except `GameRoot.tsx`, `voiceW5.ts`, `w5Features.ts`), `ui/**`, `economy/**`.

## 给主人的摘要

1. 打开「设置」现在真的是暂停：等车时车会停在站台等你，不会自己把你拉上车开走；坐车时车会停下来等你关掉设置再走（观光巴士、地铁、叮当车、F 线、渡轮都一样）。
2. 手机上「更多」菜单打开时，「抵达」卡片会先让开、倒计时也暂停；关掉菜单卡片再回来，不会再挡住「拍照 / 小铺」。
3. 小铺里的"国际橘"全部改成"国际橙"（围巾、背包、单车；繁體自动变成「國際橙」，英文是 International Orange），存档里的物品不受影响。
4. 开局跟 BAYBAY 去找鹈鹕时，不会再先送一张飞行券、40 秒后又"退你 10 金币"；刚进游戏那一秒拿到的金币不会再丢；"继续旅程"回来时只有"欢迎回来"，不再同时弹"发现 N 个新地点"；新存档的目标卡不会再盖住唐人街响铃的老电话。
5. 一日游的时间改成实测的"约 36 分钟 / 快速版约 29 分钟"；金门大桥桥面南段也显示"金门大桥"；等叮当车时也能点"直接到站"；某个小游戏或小铺如果忘了"放开"你，最多 90 秒后自动放开并记下来。
6. `STATUS.md` 重写成现在的样子（整座城市默认、怎么运行、数字、代码地图）。三部分都已推送，测试全绿。

## Part a (2026-09-29 01:53–02:25 PDT): Settings holds the ride · the More menu wins over the ARRIVED card · 国际橙

### What was built

| # | item | files | API |
|---|---|---|---|
| 1 | **Settings holds a city ride.** Settings is the game's pause (`flow.openPanel` sets `paused`; its sheet says 已暂停), but a waiting rider was boarded and the bus drove on. Now, while Settings is open in the city, a waiting rider is not boarded (every line system already keeps the car it sent at the stop while its rider has not stepped on: `leave()` holds on phase `here`), the ridden car brakes to a stand through its hop-off brake (`actors/platform requestPlatformStop`, honoured by the bus, the Metro, the cable cars, the city F-line and the ferry — the same hold as the QA `transit.hold(true)`), the rider does not step off at a stop, and the stall watch does not count the held time. Closing Settings lets the car go; only the brake the pause asked for is released (a rider's own hop-off brake stays theirs). The district's hero F-line is untouched (not a line ride). | `game/transit.ts` (`stepTransit`, new `ridePausedNow`, `holdRideForPause`, `PAUSE_BRAKE_S`), `game/busWatch.ts` (the rider's bus standing for the pause is not a stall: no false `[opus-bay bus] … held 12 s by hop-off` warning) | `ridePausedNow(r?)` |
| 2 | **The More menu wins over the ARRIVED card.** On 390 × 844 the card (72 px above the phone bar) covered the menu's upper rows (wave-4 lane V's `rev/set1.jpg`, the W5 hand-off). While any More menu is open (the phone bar's 更多 and the desktop 更多 button) the card steps back (hidden, untouchable, `aria-hidden`) and its 6 s timer and timer bar wait; it comes back with the time it had left when the menu closes. | new `ui/moreMenu.ts` (`holdMoreMenu()`, `moreMenuOpen()`, `useMoreMenuOpen()`), `ui/Hud.tsx` (PhoneBar, DeskMore), `ui/ArrivalCard.tsx`, `ui/guide-ui.css` (`.ob-arrival-card.is-waiting`) | `holdMoreMenu`, `useMoreMenuOpen` |
| 3 | **国际橘 → 国际橙.** The 小铺's 国际橙围巾 / 国际橙背包 / 国际橙单车 (short 国际橙, note 金门大桥的颜色就叫国际橙); English "International Orange scarf / backpack / bike" (short "Int’l Orange"; the backpack and bike said only "Orange"). Item ids unchanged (`scarf-orange`, `my-pack-orange`, `bike-orange`: saves keep them). 繁體 goes through the site's opencc conversion (國際橙圍巾, tested). `data/VOICE.md` has the glossary row (wave 6 additions). | `economy/items.ts`, `data/VOICE.md` | — |

### Evidence

- Tests (new): `tests/opus-bay-w6-k2-pause.test.ts` (2: on a city cable car stepped in node — Settings open while waiting: the car
  reaches the stop and stands there 20 s, the rider not boarded; closed: boarded; open while riding: the car stands within 4 s
  and holds 30 s (0.3 u), the banner says braking; closed: brake released, the car goes on, the ride finishes; the district
  hero ride never holds; a rider's own brake is never released by the pause). **Red first:** with the hold switched off
  the first test fails (`the car reached the stop`: the rider was boarded at once). `tests/opus-bay-w6-k2-ui-dom.test.ts`
  (2, jsdom: the menu store; the card steps back, `aria-hidden`, its timer bar held, no close in 700 ms against a 400 ms
  card, back after the menu closes, then closes with its time left). `tests/opus-bay-w6-k2-content.test.ts` (2: the three
  items 国际橙 / International Orange with their ids, 繁體 國際橙圍巾; no 国际橘 left in any player-read string of `src/opus-bay`).
- **Played on the phone** (390 × 844, dpr 3, touch, quality mid, `?world=city&start=free&save=off`, my dev server 5602, one
  Chrome; script `C:/Users/willy/opus-qa/w6/k2/qa-a.mjs`, log `a/phone.log`, every shot read):
  - Arrived at the Palace of Fine Arts → the 抵达 · 艺术宫 card; tapped 更多: the menu (拍照 · 相册 · 小铺 · 设置, tops 590–722 px)
    shows with the card gone (`is-waiting`), every row's centre hits its own button (`elementFromPoint`); 7 s later (past the
    card's 6 s) the card is still waiting; tapped 更多 again: the card is back with its bar where it stopped
    (`qa/w6/K2/a-phone-menu-wins-over-card.jpg`, `a-phone-card-back-after-menu.jpg`).
  - Loop bus at the Ferry Building, 去 39 号码头 (Wharf & Hyde): Settings opened while waiting (eta 11 s); the bus came, stood
    at the stop (`why: board`) and **moved 0.00 u in 15 s**, the ride still `waiting`; Settings closed → boarded 1 s later.
    Riding at 11 u/s, Settings opened: 4 s later v 0 (`why: hop-off`, banner stage `braking`), **0.00 u in the next 15 s**;
    Settings closed → 64.9 u in 8 s, v 11 (`qa/w6/K2/a-phone-settings-bus-stands.jpg`: 已暂停 · 设置 over the stood bus).
    The DEV console had one `[opus-bay bus] … held 12 s by hop-off` warning in that run: fixed in `busWatch.ts` after it.
- Checks: `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings) ·
  `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1387 / 1387**, fail 0.
- Fact: the Golden Gate Bridge's colour is named "International Orange" — https://www.goldengate.org/bridge/history-research/bridge-features/color-art-deco-styling/
  (checked 2026-09-29).
- Budgets: no draw call, material or triangle; `ui/moreMenu.ts` (≈ 0.4 KB) and a few lines in `Hud.tsx` join GameRoot's graph;
  `transit.ts` +≈ 1 KB raw (main graph); the rest is in lazy chunks (the guide layer, the economy, the line chunk).

### Decisions

- "Settings pauses like the other panels" read as: Settings is the pause (its sheet already says 已暂停 and `paused` mutes
  audio, coins and bubbles) — so the rider's vehicle holds too. Other vehicles (traffic, other buses) keep running: the
  world is not frozen (the player is not watching it, and freezing lane B's systems is outside this lane).
- The hold is city-only (district mode never changes); the desktop 更多 menu makes the card wait too (one rule; the
  desktop card is bottom-left, so it only matters on phones).
- 繁體 is not hand-written anywhere (opencc cn → tw gives 國際橙).

### Known gaps

- A Metro train under ground ignores a brake (lane T's tunnel rule): with Settings open it runs on under the subway
  overlay to its next surface stretch, where it stands.
- Not checked: the Grand Tour's own dwell timers with Settings open (its trip runner is already blocked by any open panel).

### Not done (part a)

- Nothing of part a's list.

### Requests

- None.

## Part b (2026-09-29 02:30–03:00 PDT): the C / E / N items · the 90 s hold timeout · STATUS.md

### What was built

| # | item (sf-w5-summary NEXT #8, #5, #14) | files | API |
|---|---|---|---|
| 1 | **No 飞行券 during goal #1's lead** (lane C's review: 送你一张飞行券！ a second after 跟 BAYBAY 去找鹈鹕, then 有鹈鹕啦，飞行券用不上了，还你 10 金币。 40 s later at Coit). BAYBAY's first ticket now waits while the game is not playing yet, a dialogue (the welcome) or the goals step is open, or she leads to the pelican (`freeLead` = `pelican:coit`), and `TICKET_QUIET_MS` (4 s) after; polled 1 Hz until given. A player who follows the lead meets the pelican first: no gift, no refund line. A resumed player with nothing on gets it at once, as before (and after Settings → reset). | `economy/shopRun.ts` | `ticketGiftWaits()`, `ticketGiftReady(now)`, `TICKET_QUIET_MS`, `ticketGate` |
| 2 | **Rewards emitted before the ledger is live are not lost** (lane E's review). Every `reward` emitted in the city while no ledger listens waits in `game/rewards.ts` (main graph, listening from the first frame; ≤ 64, the newest), and `initLedger` pays them the moment it starts (the ledger pays each source once: a replay never pays twice); the ledger's off (a world switch) queues again; a new save (Settings → reset) drops what waited; the district never queues. | `game/rewards.ts`, `economy/ledger.ts` | `ledgerListening(live)`, `pendingRewards()`, `dropPendingRewards()`, `PENDING_MAX` |
| 3 | **`cityAreaAt` with the walker's height** (lane N's review): the area pill passes `runtime.player.y`, so the first quarter of the Golden Gate deck (from the south anchorage) says 金门大桥, and the water / Fort Point under it does not. | `game/brain.ts` | — |
| 4 | **The new-save goals card waits** (lane D's review: 随便逛，顺便完成这些 opened over the ringing Chinatown phone and the operator's paper, 接电话 live under it): in the city the card also waits while a ui/slots overlay is up (an egg's paper or card, a letter, the album) or a find's prompt asks for the player (an egg's 接电话). The district as before. | `ui/Moments.tsx` | — |
| 5 | **A quiet first discovery batch on resume** (lane C's review: 发现 4 个新地点 above 欢迎回来): 继续旅程 calls `quietNextDiscovery()`; the first discovery tick with the place index (within 20 s) marks the finds round the resumed spot (saved, on the map and in 足迹) without the chip / toast; later finds are told as before. | `game/discovery.ts`, `game/resume.ts` | `quietNextDiscovery(now?)`, `QUIET_RESUME_MS` |
| 6 | **The Grand Tour quotes are the measured runs**: 约 36 分钟 (full, measured 36.1) and 约 29 分钟 (express, measured 28.5), not the model's 34 / 25 (the model leaves out the chapter intros / outros, BAYBAY's waits and a real run's snags). The stops keep the model's minutes; `modelMinutes` / `modelExpressMinutes` keep its sums (tested as before). The welcome subtitle, the call row, the full / express choice, the resume label and the recap follow. | `data/sf/tours.ts` (`MEASURED_TOUR_MINUTES`, `CityTourDef.modelMinutes?`), `data/sf/copy.ts`, `tests/opus-bay-sf-tours.test.ts` (updated) | `MEASURED_TOUR_MINUTES` |
| 7 | **Leaked `activity` / `shop` / `panel` holds: a 90 s timeout** (the lead's decision, §6). Such a hold explained the lock by itself, so a leak held the feet for good. Past `HOLD_TIMEOUT_S` = 90 it no longer explains the lock: the watchdog frees the player a second later and logs it (the `stuck` event's source names the hold and its age, e.g. `activity:leaky (held 91 s)`; DEV warns; `watchdogStats.timeouts`). The frozen playerLock API is unchanged. | `game/lockWatchdog.ts` | `HOLD_TIMEOUT_S`, `lockExplanation(now?)`, `stepLockWatchdog(dt, now?)` |
| 8 | **`src/opus-bay/STATUS.md` rewritten** for the live city default (short: what a player gets, how to run and check, the W5-Z numbers, the code map, where to read on). | `src/opus-bay/STATUS.md` | — |

### Evidence

- Tests: `tests/opus-bay-w6-k2-flow.test.ts` (6: the ticket gate step by step; a new player who follows the lead meets the
  pelican with no gift and no refund; a reward before the ledger paid once when it starts, queued again after its off,
  dropped by a reset, never in the district; the deck at y 16 → `golden-gate-bridge`, at y 1.5 → not; a resume's first
  batch quiet, a later find told; a leaked activity hold still explains at 60 s, freed a second after 90 s with its age in
  the log). **Red first:** all six fail on the old files (checked by reverting the six source files and re-running).
  `tests/opus-bay-w6-k2-ui-dom.test.ts` +1 (jsdom: the goals card hidden while an egg's 接电话 prompt is focused and while
  `egg-note` is open, shown after; the district unchanged). Updated: `tests/opus-bay-sf-tours.test.ts` (the quotes 36 / 29
  and the model 31–37 / 22–28), `tests/opus-bay-w5-e-review.test.ts` 4 (sets a playing game with nothing on first).
- **Played on the phone** (390 × 844 dpr 3, touch, `?world=city&save=off&quality=mid`, a new player; script
  `C:/Users/willy/opus-qa/w6/k2/qa-b.mjs`, log `b/phone.log`): 开始 → the welcome → 我自己逛逛 → the goals step → 跟 BAYBAY
  去找鹈鹕 · 约 40 秒 → carried to Coit; the pelican moment was open 40–50 s after the tap. An in-page recorder of every bubble,
  toast and dialogue from 开始 on (90 s): **飞行券 never mentioned**. Then on the Golden Gate deck a tenth of the way from
  the south anchorage (y 15.2): the pill reads **金门大桥** (`qa/w6/K2/b-phone-deck-area-pill.jpg`; the English line under it
  is the street name, which stays English by the VOICE.md rule).
- Checks on the pushed tree (`4303a9d0`, after rebasing over lanes S, B, X, P, W): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings) · the suite **1414 / 1414**, fail 0.

### Decisions

- The ticket's grace is 4 s after the last busy moment (the goals step's close → the lead's start is not a gap); a player
  whose game is quiet from the start (a resume) gets it at once.
- The reward queue keeps the newest 64 (the ledger's caps are per prefix anyway) and only in the city.
- The hold timeout frees the feet but does not close the UI that holds them (an activity, the shop, a panel): walking
  away is the player's choice; the log names it.
- The tour's quotes are the measured runs, typed once in `MEASURED_TOUR_MINUTES` with their source; the per-stop model
  stays (it paces the chapters and is tested against the timing model).

### Known gaps

- Not played live: the resume's quiet batch (needs a saved spot and a reload; the rule is tested in node with a place
  index) and the goals card at the ringing phone (jsdom only).
- The express quote (29) is the measured run that rode its two long Metro legs; with 直接到站 there it is ≈ 24 min.

### Requests

- None.

## Part c (2026-09-29 03:05–03:30 PDT): 直接到站 on a waiting cable car · the part-b items played live

### What was built

| # | item | files | API |
|---|---|---|---|
| 1 | **直接到站 while waiting for a cable car** (the lead's decision, sf-w6-lead.md §6; lane T's open question: a car can be 60–85 s away at a turntable). The cable-car banner offers 直接到站 in the waiting stage like the ferry's: the rider lands at the destination's kerb spot (lane T's finishRide, under the veil when the stop is not streamed in) and it never counts as a ride. Buses and the Metro unchanged (their banner offers 直接到站 once aboard). | `game/transit.ts` (`rideLabel`: `skipWhileWaiting` for cable cars) | — |

### Evidence

- Test: `tests/opus-bay-w6-k2-pause.test.ts` +1 (a waiting Powell–Hyde ride offers 直接到站; `finishRide` ends it, the rider
  within 20 u of Hyde & Beach, `rideLog` unchanged). Updated: `tests/opus-bay-sf-guide-review.test.ts` (W4-G-int-review pinned
  "no 直接到站 for a waiting cable car"; it now pins it offered, and the loop bus without it).
- **Played on the phone** (390 × 844 dpr 3, touch, quality mid, a normal save in a fresh profile; scripts
  `C:/Users/willy/opus-qa/w6/k2/qa-c.mjs`, `qa-c2.mjs`, logs `c/phone.log`, `c2/phone.log`):
  - Powell & Geary, 鲍威尔-海德线 to Hyde & Beach: the banner reads 等叮当车进站…约 4 秒 · 不坐了 · 直接到站
    (`qa/w6/K2/c-phone-cable-skip-while-waiting.jpg`); tapping 直接到站 put the rider on foot 3.7 u from Hyde & Beach, the
    ride over.
  - **The resume's quiet batch, live:** stood at Hyde & Beach (the sampler saved the spot), removed the 5 finds from the
    saved game, reloaded, tapped 继续旅程: in the next 20 s the page showed only 欢迎回来！上次我们走到俄罗斯山了。 — no
    “+N 个地点” chip, no 发现 toast — while the save's finds went 0 → 5 (marked quietly).
- Seen, not mine: the cable-car banner's destination reads "Hyde & Beach" in the zh HUD (lane B's NEXT #10, zh cable-car
  stop names).

### Not done

- Everything in lane K2's row is done (parts a–c). Not attempted: freezing the whole world (traffic, other vehicles)
  while Settings is open — only the rider's own ride holds.

### Requests

- None.

### Final checks (2026-09-29 04:05 PDT)

On the pushed head `5fc04310` (my part c over lanes S, W, H and G's latest): `npx tsc -p tsconfig.app.json --noEmit` 0 ·
`npx eslint .` 0 errors (43 old warnings) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts`
**1447 / 1447**, fail 0. The dev server on 5602 is stopped; no Chrome of mine is running. Higgsfield: 0.
