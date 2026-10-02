# Wave 9 · lane F · first minute & attention

Lane F of wave 9 (`docs/opus-bay/sf-w9-lead.md` §3 F; the review `docs/opus-bay/review-2026-10-01-first-use.md` §1, R§5 #5,
#6, #14, R§6 上手与引导 / 语言 rows, §8 idea 4). Worktree `C:/Users/willy/wt/w9-f`, port 5902, scratch
`C:/Users/willy/opus-qa/w9/f/`. Times PDT.

## 给主人的摘要

1. 新加了一个「注意力仲裁器」：屏幕上同一时间最多一条横幅/卡片、一个操作提示、一句 BAYBAY 的话，其余排队，间隔至少 2.5 秒。
   评测里渡轮大厦到站时同屏 7 条消息（我们自己复测也是 7 条），现在最多 3 条。
2. 到站的横幅、到站卡、"+1 地点"、今日小事 1/3、南瓜灯、金币合成**一张卡**（卡里一行进度），第一次到一个地方时卡片不再 6 秒自动消失，走开或点一下才关。
3. 首访的黄金时段只用在开场动画，选完四个入口后马上跟随真实湾区时间；"现在湾区是早上，看看此刻的样子？"这条提示删掉了。
4. 选「我自己逛逛」：不再弹 10 个目标、不再叫你去科伊特塔找鹈鹕；约 40 秒时鹈鹕落在你身边，点「试试起飞」直接起飞飞一小段（4 个金圈），落地后才提示"随时飞 · G"。
   选「我是本地人」：真正安静 3 分钟（飞行券、捉迷藏邀请、南瓜灯提示都等着）。一日游第一站：鹈鹕真的落在身边，BAYBAY 才说"送你一位鹈鹕朋友"。
5. 第一分钟自动检查脚本 `scripts/opus-sf/qa/first-minute.mjs`（四个入口 × 中英 × 桌面/手机），W9-I / W9-Z 可以复跑。

## Part a (21:35 → 00:40)

### What was built

| id | what | files |
|---|---|---|
| W9-F1 | **The attention arbiter** (the §4 contract, pushed 22:07): `requestSlot(level, id, { priority, minMs, firstVisit, absorb, maxWaitMs, onGrant, onDrop })` → `{ granted, waiting, release() }`, `onSlotFree(cb)`; one holder per level (`title` / `action` / `line`), the rest queue by priority then first come, two holders of `title` / `line` ≥ 2.5 s apart (a waiter above the one that just left skips the gap: a card after a toast), a higher priority takes over once the holder has been up its `minMs`, a first-visit holder has no timer, waiters give up after `maxWaitMs` (15 s default). `ATTENTION_PRIORITY` for the lanes. The ribbon: progress notes within 2.5 s share one line (a same-kind note replaces its older count). `useAttention` / `useRibbon` hooks. **Lazy**: only lazy chunks import it (a test walks GameRoot's static graph). | new `game/attention.ts` |
| W9-F2 | **The title level on screen**: `ui/titleHost.ts` (play-layer chunk) shows ONE toast at a time (core/store keeps three), each for its reading time, the next ≥ 2.5 s later, nothing shown after waiting 10 s; progress toasts (a count `1/3`, `1 / 40`, a tick, a `+N`) and the coins of a reward go into one ribbon line; a dialogue, a side panel, the postcard reward, the goals step and every card / play panel of BAYBAY's hold list hold the title level themselves (a toast waits under them). **The arrival**: the banner holds the title while the reveal plays, the card takes it over at once; the card is a first-visit card — no 6 s timer, it goes on ×, Esc, a button, 24 u walked, boarding a ride, or a card that matters more; while it is up every toast of the moment is its ribbon row (`+1 · 渡轮大厦 · 今日小事 ✓ 去新地方 · 1/3 · +40 金币`). The discovery chip's finds join the ribbon (lane N's `GuideLayer.tsx`, surgical). | new `ui/titleHost.ts`; `ui/Floating.tsx` (Toasts), `ui/ArrivalCard.tsx`, `ui/GuideLayer.tsx` (FoundChipView, surgical) |
| W9-F3 | **Golden hour for the intro only** (R§6 world row + 上手 row): the welcome choice hands over to the real Bay time at once; the 「现在湾区是早上 · 看看此刻的样子？」 toast is gone. | `game/flow.ts` `offerRealTime` |
| W9-F4 | **我自己逛逛** (R§6 "仍被派鹈鹕任务，10 个目标一次全摊开"): no goals step (the goals are in the journal; the step counts as shown), no 先去科伊特塔找鹈鹕 — BAYBAY's voiced 好嘞，你带路，我跟着！, no soft waypoint hint for 3 min, 15 s of quiet for the player's own first steps. **我是本地人** (R§6: 4 lines + a toast in 35 s): 3 quiet minutes for real — `game/baybayHold.ts baybayHeld()` (asked by every unprompted line source: the pacer, rumours, the realsf / Halloween lines, hide & seek's invite, the brain's small talk…) holds while `flow.quietUntil` runs, and the 飞行券 gift waits (`economy/shopRun.ts`, surgical). | `game/flow.ts` `startFree`, `game/baybayHold.ts`, `economy/shopRun.ts` |
| W9-F5 | **The pelican on screen first** (R§5 #6, R§6 flight row): the Grand Tour's first stop no longer says 送你一位鹈鹕朋友！ with no bird — the tour's moment waits for a quiet frame (the stop's card and line first), the pelican lands beside you (lane F's `pelicanGreet`), then BAYBAY's line, and 解锁：随时飞 only once it stands there (no landing spot → no 送你 line). **A short glide by ≈ 60 s** (§8 idea 4) for 我自己逛逛: 36 s after the choice the pelican is unlocked, it lands, 先试试起飞？ → 试试起飞 takes off at once (no second G) on a 4-ring course ahead of the player (`play/firstFlight.ts` `short` / `takeOff`, surgical); 解锁：随时飞 after the landing (or with 以后再说). The 飞行券 gift waits through that player's first 90 s (before: given at 9.9 s, refunded at 36 s). | `game/pelicanFirst.ts`, `play/firstFlight.ts` + `play/index.ts` (type, surgical), `economy/shopRun.ts` |
| W9-F6 | w8 NEXT #8: **a breath after a hold** in BAYBAY's pacer (P-7: lines came back to back once a dialogue / card / bubble let go: now `HELD_GAP` 2 s), **the pacer reports a dropped line** (`PacedLine.onDrop('expired' \| 'invalid' \| 'overflow' \| 'cleared')`, `LinePacer.dropped`), **the idle pool never repeats the line it said last** (要是我有口袋… twice 18 s apart). | `game/linePacer.ts`, `game/brain.ts` |
| W9-F7 | **The first-minute gate** `scripts/opus-sf/qa/first-minute.mjs`: a fresh Chrome profile per run, the 4 entries × zh / en × desktop 1440 × 900 / phone 390 × 844 (touch, dpr 2); Start, the welcome choice, then 60 s like a new player (answers later choices with option 1, reads a dialogue 2.5 s, walks once when free, taps BAYBAY's lead chip after 3 s); the visible messages counted 4× a second (title: toasts / banners / cards / the dialogue / a panel; action: the E prompt and the lead / go chips; line: the bubble; chip: the discovery chip) — pass = ≤ 3 at once in every second; plus the seconds to the first own move. The city DEV hooks gained `__opusBay.c.auto` (BAYBAY carrying the player) and `__opusBay.attention` (who holds what). | new `scripts/opus-sf/qa/first-minute.mjs`; `game/cityMoments.ts` (DEV hook) |

### Evidence

- **Before** (`f1460b0c` + the new script, dev server, 2026-10-01 22:15–22:41, the machine shared with the other lanes;
  `C:/Users/willy/opus-qa/w9/f/fm-before/`): desktop zh tour **max 7** (4 s over 3) at 14.7 s — the arrival card, the
  arrival banner, 解锁：随时飞！按 G 起飞, 今日小事 ✓ 去新地方 · 1/3, E, BAYBAY's bubble, the +1 chip (the review's picture,
  `fm-before/desktop-zh-tour-busiest.jpg`); phone en tour **max 7** (5 s over); week 2 / 1, free 3 / 3 (the time offer +
  E + 先去科伊特塔找鹈鹕朋友吧！), local 3 / 3 (the time offer + E + 送你一张飞行券！ at 5.8 s).
- **After part a** — see the table under "Part a — the gate" below (filled from `fm-a/`).
- Tests (red → green where they pin a fix): `tests/opus-bay-w9-f-attention.test.ts` (10), `tests/opus-bay-w9-f-titlehost.test.ts`
  (7), `tests/opus-bay-w9-f-first-minute.test.ts` (6); updated to the new behaviour (never deleted): F11 in
  `tests/opus-bay-flow-brain.test.ts` (no time offer), two W5-C2 cases in `tests/opus-bay-w5-content.test.ts` (解锁 after
  the landing / with 以后再说; the tour's moment waits and greets first), two pacer cases in
  `tests/opus-bay-sf-triptext.test.ts` (+ HELD_GAP after a hold; "the whole Grand Tour … no tour line dropped" still green).

### Decisions

- **What counts as a message** (the gate): transient things that pop — toasts, banners, cards, the dialogue box, an open
  side panel, the E prompt, BAYBAY's lead / go chips, bubbles, the discovery chip. The HUD bars that sit in the same
  place all the time (the area label, the objective / trip / tour pill, the ride banner with its buttons, the coin badge,
  the round buttons) are not counted; the script lists them as `hud` (the ride banner is in the `title` selector list
  of the probe — see the part-b note if it is reclassified).
- **The arrival card is sticky for every arrival moment** (a moment = the first arrival at a tier-1 / 2 place, i.e. a
  first visit of that place); it goes when the player walks 24 u, boards, taps, or a dialogue / panel / stuck card takes
  the title level. A toast during it is its ribbon row, not a banner on top.
- **Toasts never cut each other short** (first come, first shown); a card takes over a toast after 1.8 s; a toast that
  waited 10 s is dropped (a stale "已保存" is worse than none).
- **The Grand Tour gets no glide in its first minute**: its first stop is the sightseeing-bus stop and the bus comes
  within the minute; flying off there would leave the tour's leg (lane N's). The tour's first minute shows the pelican
  for real instead; 我自己逛逛 gets the short glide at ≈ 40–45 s.
- **15 s of quiet after 我自己逛逛** (the first run heard 4 lines in 20 s: the pumpkin hint, the 飞行券, an idle line, the
  light line).
- The line level of the arbiter is left to lane X (one voice at a time) and BAYBAY's pacer; the toasts / cards (title)
  and the bubbles (one `flow.bubble` slot) already make ≤ 1 line at once.

### Known gaps (part a)

- The E prompt and the lead / go chips are not yet arbitrated against each other (part b: `ui/Hud.tsx` ContextAction,
  `ui/GuideLayer.tsx` GuideLeadChip, both surgical).
- The touch coach, the title, the postcard illustration and 我是本地人's 今天 card are part b.

### Part a — the gate (dev server 5902, the machine shared with the other lanes; `C:/Users/willy/opus-qa/w9/f/fm-a*/`)

Max messages at once in any second of the first 60 s after the welcome choice (≤ 3 passes); seconds are after the choice.

| run | before (`f1460b0c`) | after part a | busiest moment after |
|---|---|---|---|
| desktop zh 带我逛 (Grand Tour) | **7** (4 s over) | **3** (`fm-a1`) | @19.8 s the card with its row `+1 · 渡轮大厦 · 今日小事 ✓ 去新地方 · 1/3 · +40 金币`, E, the bubble |
| desktop zh 这周有什么 | 2 | 2 | the week board (panel) + E |
| desktop zh 我自己逛逛 | 3 (看此刻的样子？ + E + 先去科伊特塔…) | 2 | E + 好嘞，你带路，我跟着！; the pelican's question @38.5 s, gliding @43.9 s |
| desktop zh 我是本地人 | 3 (看此刻… + E + 老湾区人你好) | — (the run timed out on the cold server; rerun in part b) | |
| phone en Grand Tour | **7** (5 s over) | **3** | @17.2 s the card (+ its row), Board the tour bus, the bubble |
| phone en week | 1 | 1 | the week board |
| phone en free | 3 (the time offer + Take the ferry + Let's meet the pelican…) | 2 | Take the ferry + Okay — you lead, I'll follow! |
| phone en local | 3 (the time offer + Sit down + Here's a flight ticket!) | 2 | Take the ferry + Hey, local! I'll keep it short… |

"First own move" (the bot walks 1 s after it is free): 1.8–2.1 s after the choice in every entry before and after
(the tour lets the player steer from the start; the week board opens at once). The tour run's bot takes over BAYBAY's
lead when it walks and taps 让 BAYBAY 带我过去 3 s later, as a cooperative player would.
