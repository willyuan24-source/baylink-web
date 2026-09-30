# Wave 7 · W7-I · integration playtest (all lanes together)

Written 2026-09-30 01:44–02:15 PDT by W7-I in `C:/Users/willy/wt/w7-int` (branch `w7-int` from `origin/opus-bay` `11b51f72`,
dev port 5719, one headless Chrome at a time, PERF-LOCK absent at every start). Scratch and every raw log:
`C:/Users/willy/opus-qa/w7/int/` (`play.mjs`, `hw.mjs`, `size.mjs`, `games.mjs`, `dist.mjs`, `snap.js` = the overlap /
touch-target probe, `*.log`). Shots kept here: `docs/opus-bay/qa/w7/int/`.

## 给主人的摘要

1. 我把第七波十三条线合在一起，按「第一次来的新玩家」完整玩了一遍：手机 390×844 和电脑 1440×900 各一遍（标题页 → 开始 → 到达 → 第一个目标 → 目标卡 → 叮当车 → 地图 → 带路 → 小铺 → 旅行本的万圣节页和明信片 → 敲门要糖 → 南瓜灯 → 设置 → 相册），再加万圣节夜（6 户人家连敲，明信片弹出）、亡灵节 11/2 19:10 教会区、iPhone 小屏 390×664 / 375×553、抓娃娃小游戏，以及街区模式。
2. 没有发现卡死、报错或两条线互相打架的大问题：整个流程控制台 0 个错误；每一步都检测了「卡片盖卡片」「两个提示抢一次点击」，点「开始」「我自己逛」「抓娃娃」等按钮时，手指下面都是按钮本身。
3. 修好两个问题：**(a) 小屏 iPhone（375×553，也就是 iPhone SE 大小的 Safari）上，新玩家的目标卡两个按钮都在屏幕外面**，只看到目标清单，找不到「出发」。现在清单在卡片里面滚动，按钮一直看得见（前后截图都有）。**(b) 万圣节页的「带我去」（32 px）和「去小铺试穿」（36 px）在手机上太小**，现在触屏上都是 44 px。
4. 检查结果：tsc 0，eslint 0 个错误（43 个旧警告），测试 1660/1660 全过。
5. 没有阻挡上线的问题。有几件小事留给下一波（BAYBAY 在小游戏面板打开时还在说话、明信片卡片弹着时 BAYBAY 的街区问候照样出、地图按钮 36 px 等），写在「Open items」。

## The script and what I saw

Every step: a shot plus `__int.snap()` (the fixed layers, every pair of visible cards that overlap by more than 6 px,
BAYBAY's bubble, the dialogue node, every visible control under 44 px) and, for each tap, `document.elementFromPoint` at
the control's centre (what the finger really hits). Console errors / exceptions: **0 in every run** (city phone, city
desktop, Halloween night, muertos, the two iPhone sizes ×2, the games, district).

| # | step | phone 390×844 (touch, mid) | desktop 1440×900 |
|---|---|---|---|
| 1 | title (`?halloween=1`, key art) | Start hit = the Start button; no overlaps | Start hit = the button (its ENTER key cap) |
| 2 | Start → arrival → 你好 dialogue | `intro.hello.city`, the choices in view | same |
| 3 | free-roam choice → goals card | card up; only overlap = the 坐渡轮 touch hint's corner under the modal (behind its scrim: fine) | clean |
| 4 | goal #1 / 我自己逛 → 8 s | BAYBAY's pelican lead chip + the flight-ticket bubble; no stacking | the 湾区现在是夜里 night prompt beside the lead chip, no overlap |
| 5 | Powell–Hyde ride 14 s | ride banner, the lead chip, BAYBAY's 小南瓜光 line; no overlap | ride card buttons (坐下 / 下车 / 跳到站 / 响铃) in one row, no overlap |
| 6 | the map | opens over the bar; map tool buttons 36 × 36 (wave 4, see Open) | same |
| 7 | a trip (Coit Tower) | 带路 chip + ETA pill + 爬坡 bubble; clean | clean |
| 8 | the shop | the sheet covers the bar and the 带路 chip (sheet on top, as designed) | same |
| 9 | journal → 万圣节 page | goals, the six streets with 带我去, the 4 postcard slots, costumes incl. **蝙蝠翅膀** (bat wings, G); **带我去 32 px / 去小铺试穿 36 px** (fixed, below) | fine (fine pointer) |
| 10 | trick-or-treat (`?halloween=night`, 6 doors) | every knock `treat`; toast 双倍糖果… + BAYBAY's 谢谢！万圣节快乐！; on the 3rd door **the 万圣节明信片 card** (2/4 = trick-or-treat + the big night earned together; the second waits behind it) — BAYBAY's bubble sits under the card's scrim | — |
| 11 | a jack-o'-lantern | `pickPumpkin` true, BAYBAY's 藏起来的南瓜灯 line | — |
| 12 | Settings (+ bottom) | last row 重置进度 hittable | fine |
| 13 | muertos `?halloween=muertos&date=2026-11-02T19:10` | — | altars built (8.9k tris), procession `walk` with 40 walkers, papel picado on 24th; no UI stacking |
| 14 | iPhone 390×664 | title / goals (buttons 488–596 of 664) / shop / Settings last row: all fine | |
| 15 | iPhone 375×553 | **goals card: both buttons below the fold** (fixed, below); shop fine; Settings last row hittable | |
| 16 | M's claw at the Musée (phone) | at the prompt spot the touch action reads Try the claw (抓娃娃) and opens the claw panel (the machine, the 8 toy prizes); a first teleport 1.8 u off landed on the toy machine and the button read Talk to BAYBAY (BAYBAY nearer than the prompt) | |
| 17 | district `?world=district` | — | the 你好 dialogue at the Ferry Building; `sfgames` / `halloween` absent (city-only as required); 0 errors |

## Defects fixed

1. **Goals card unreachable on a short iPhone** (lane C's `ui/goals-step.css`, lane Q's area; surgical). At 375 × 553 the
   card was 700+ px tall: 出发 at y 533–587 and 我自己逛 at 595–641 of 553 — a new player saw the list and no button (the
   wrap scrolled, but nothing said so). Now, under 700 px of height, the card is capped to the screen and the goals list
   scrolls inside it; under 600 px the footnote hides. After: 出发 416–470, 我自己逛 478–524 of 553, tapped through;
   390 × 664 unchanged (488–596). Shots `goals-375x553-before.jpg` / `goals-375x553-after.jpg`. CSS only (no node test can
   measure it; verified live at both sizes).
2. **万圣节 page touch targets** (lane G's `halloween/halloween.css`, wave-6 code; surgical): 带我去 32 px and 去小铺试穿
   36 px tall on phones → `@media (pointer: coarse)` min-height 44 px. Shot `halloween-page-before.jpg`.

Checks on the pushed tree: `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings) ·
`npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1660 / 1660**.

## Open items (not blocking)

- **BAYBAY talks while a mini-game panel is up**: with the claw panel open, the crab-wheel 螃蟹方向盘 line (another
  system's landmark bark) fired; its bubble sits under the panel, so the voice plays with no visible text. A shared
  "a play panel is open → hold ambient barks" gate (flow / baybayLines) is the fix; next wave.
- **The neighbourhood greeting during the 万圣节明信片 card**: 你好，海特-阿什伯里！ bubbled under the card's scrim. Same gate.
- **Map tool buttons 36 × 36** (zoom, find me, whole city, legend, compass) and the waypoint 隐藏 × 24 × 24 on desktop:
  wave-4 code, under 44 px on a phone. Not changed tonight (the map layout is dense; lane Q's area next wave).
- **The teleport QA shows**: `placePlayer` next to M's claw can land on the toy machine's roof (a QA artefact, a walking
  player cannot get there); the Belvedere door bubble says Belvedere while the area pill reads 内日落 · Carmel St (the
  coarse area grid K fixed is per-neighbourhood; Belvedere below Parnassus is Cole Valley by most maps).
- Not played by me tonight (time): the pelican flight wearing the bat wings (G's review covers it), the kite activity and
  the skyline quiz (W2 / its review), hide & seek, the album viewer's photo (Q's review covers it), a real iPhone
  (`iphone-checklist.md`).

## Blocking the go-live

None.
