# Wave 6 · lane K2 · flow, UI & content fixes

Worktree `C:/Users/willy/wt/w6-k2` (branch `w6-k2`), dev port 5602, scratch `C:/Users/willy/opus-qa/w6/k2/`, QA images
`docs/opus-bay/qa/w6/K2/`. Owns `game/**` (except `GameRoot.tsx`, `voiceW5.ts`, `w5Features.ts`), `ui/**`, `economy/**`.

## 给主人的摘要

1. 打开「设置」现在真的是暂停：等车时车会停在站台等你，不会自己把你拉上车开走；坐车时车会停下来等你关掉设置再走（观光巴士、地铁、叮当车、F 线、渡轮都一样）。
2. 手机上「更多」菜单打开时，「抵达」卡片会先让开、倒计时也暂停；关掉菜单卡片再回来，不会再挡住「拍照 / 小铺」。
3. 小铺里的"国际橘"全部改成"国际橙"（围巾、背包、单车；繁體自动变成「國際橙」，英文是 International Orange），存档里的物品不受影响。

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
