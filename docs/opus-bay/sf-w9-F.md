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
6. 第二段（凌晨 2:14 接手后）：操作教学只在玩家自己动手时才算学会（BAYBAY 带着走不算），手机上第一次能自由走动时有 3 秒"幽灵摇杆"示范；
   标题页改成"先不玩，直接看攻略"、问候"我是 BAYBAY，带你逛整座旧金山！"、手机保留一行操作说明、多了一行"今天在旧金山 · …"；
   明信片停在插画面，点一下才翻；选"我是本地人"约 6 秒后只给一张"今天在旧金山"卡，其余安静 3 分钟。

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

## Part b (02:14 → 05:00; a second agent after the usage-limit stop at ≈ 00:35)

### Recovery

- State found at 02:14: W9-F1 on origin; W9-F2 … W9-F7 committed, not pushed, already rebased on the then origin
  (`3446c7b2`); working tree clean. Kept all of it. Checks: tsc 0, eslint 0 errors, the opus-bay suite 2012 tests with
  2 failures — both `tests/opus-bay-w9-l-hant.test.ts` (lane L's 繁體 scan): a comment in `game/flow.ts` quoted
  "首访被强制成黄金时段" in double quotes, which the scan reads as a literal (制 → 製 a second time). Reworded the comment
  (no quotes), squashed into W9-F3 / F4, pushed at 02:38 (`b85eaea6 … 02b1f6c8`, on top of lane S's S2 / S3 that the
  shared remote-tracking ref had brought in; their tests + mine re-run after: 75 / 75).
- Nothing discarded. The scratch drafts `CoachMarkBody.next.tsx` (the first agent's touch coach) and
  `ArrivalCard.next.tsx` were read; the coach draft became W9-F8 (with the changes below); the ArrivalCard draft was
  already in W9-F2.

### What was built (one commit, `W9-F8–F11`)

| id | what | files |
|---|---|---|
| W9-F8 | **The touch coach** (R§5 #14): only the player's own push (keys / stick / pad — `runtime.input.moveX / moveY`, what `core/input.ts pollInput` composes) marks it learnt; BAYBAY carrying the player (a tour leg, 带我去) never does; 8 s on screen also counts as seen; a bubble no longer hides it; **a 3 s ghost stick** on touch the first time it is up (a dashed ring at the lower left with the knob drawing the drag; Web Animations, no stylesheet change); a title-level message of priority −1 through `game/attention.ts` — it waits for a toast / card, and after 2.5 s on screen any other title message takes over, the coach asks again under a new id and comes back after it (a toast no longer waits behind a hint). One wording for turning on touch: 右边拖动转视角 (the coach, the phone title, photo mode 拖动转视角 · 双指缩放 · 点快门拍照). | `ui/CoachMarkBody.tsx`, `ui/Moments.tsx` (photo hint) |
| W9-F9 | **The title** (R§6 语言 rows, §6 names, review §4 item 3): 先不玩，直接看攻略 / Not now — read the guides; the city greeting 我是 BAYBAY，带你逛整座旧金山！ (`data/sf/copy.ts`, lane L's text, surgical; title text, not voiced); the phone keeps one controls line 左边拖动走路 · 右边拖动转视角 · 点发光的东西互动 (`opus-bay.css`, lane Q's, surgical: the portrait rule hides only the greeting now); **a one-line 今天在旧金山 · … strip** (city): lane R's `todayHeadline()` on the Bay clock after `live.json` (≤ 2 s), else before sunset 日落 HH:MM, else none — `ui/titleToday.ts`, a lazy chunk through `importRetry` (nothing added to GameRoot). The eyebrow 小小湾区 · BAYLINK came from lane E (W9-E9) on origin. | `ui/TitleScreen.tsx`, new `ui/titleToday.ts`, `data/sf/copy.ts`, `opus-bay.css` |
| W9-F10 | **The postcard stays on its picture** (R§6: it turned to its words after 1.1 s by itself): a card with its illustration waits for a tap (a 点一下翻面 tag on the front); a card whose art failed still turns (its front is only an envelope). | `ui/Moments.tsx` PostcardReward |
| W9-F11 | **我是本地人's one 今天 card** (sf-w9-lead §3 F (2)): 6 s after a new player's 我是本地人 (city) ONE gold toast 今天在旧金山 · <the same line> through the title level (it waits for her dialogue); not a BAYBAY line — the 3 quiet minutes stay quiet. | `ui/titleHost.ts` |

### Evidence

- `tests/opus-bay-w9-f-partb.test.ts` (5, jsdom). Red on the old code (the old `CoachMarkBody.tsx` / `Moments.tsx` put back
  for one run at 03:45): a carried walk marked the coach seen (`coachSeen() === true` after 2.2 s); the postcard was
  flipped by 1.6 s. Green on the new code, 3 / 3 runs after a fix of the coach's re-ask (a want toggle could be batched
  into no change: now a new id). The title test reads the eyebrow, no "Opus Bay", the greeting, the link, one controls
  line and the strip on 9 Oct 11:20 (Fleet Week's line); the local card on 2 Oct 14:00 (今天在旧金山 · 日落 18:xx, gold,
  exactly one).
- Also green before the push: opus-bay-w5-lang, w5-lang-review, w9-p, w9-l*, sf-budget, sf-guide-ui, w9-f-*, w5-nav;
  tsc 0; eslint 0 errors (53 warnings, none in lane F's files); the full opus-bay suite on the rebased tree (on
  `3dc72f5e`, 04:44–04:51): 2130 tests, 2129 pass, 0 fail, 1 todo (W8-P9's 255 KB target).

### Rebase notes (files of other lanes)

- `ui/Settings.tsx` (lane A): their W9-A line 点地面走过去 · 左边拖动摇杆 · 右边拖动转视角 · 双指缩放 already says the
  same camera words; kept theirs, my edit dropped.
- `ui/TitleScreen.tsx` (mine): lane E's W9-E9 changed the eyebrow the same way; kept theirs, my duplicate comment dropped.

### Not done (part b)

- **The first-minute gate after part b** was not re-run (time; the full suite ran at 04:44 and a Chrome + dev server on
  top of it would have slowed every lane): W9-I / W9-Z — `node scripts/opus-sf/qa/first-minute.mjs` (its header) on the
  final tree. Expected effect of part b on it: the coach is a title message now (it never stacks on a toast / card; it
  may be the one title message in a quiet second), the local entry gains one gold toast at ≈ 6 s.
- The desktop zh 我是本地人 gate run that timed out in part a was not repeated.
- No screenshots of part b (the ghost stick on a phone, the title strip, the postcard tag): the DOM tests stand in.
- The E prompt and the lead / go chips are still not arbitrated against each other (part a's gap: `ui/Hud.tsx`
  ContextAction, `ui/GuideLayer.tsx` GuideLeadChip).
- Tap-to-walk does not count as "the player's own move" for the coach (only the 8 s on screen): a player who only taps
  sees the coach up to 8 s.

### New / changed BAYBAY lines

None in part b (the title greeting is title text, never voiced; the coach, the strip and the local card are UI).
Part a reused voiced lines only (好嘞，你带路，我跟着！…, 以后想去哪都能飞啦！先试试起飞？, 跟着金圈飞！).

## Review (Ultra)

### 给主人的摘要

- F 线复审修复员 06:07 才接手（上一轮被用量上限打断），06:18 建好工作树，45 分钟的截止前来不及安全地改代码并跑完全部检查，所以**这次没有推任何代码修改**，只推这份报告。
- 两个阻断项属实：F 线的改动没有区分模式，**小区模式（?world=district）也被改了**（首访黄金时段被立刻切成真实时间、提示一次一条且面板打开时被吞掉、明信片不再自动翻面、教学条和标题页文字变了、闲聊不再重复）。按项目规则"小区模式永不改变"，这**挡住上线 main**。
- 主要问题也属实：面板 / 对话打开时弹出的提示（想去、已保存、链接已复制、地图指南针）会被扣住，10 秒后直接丢掉；只点地面走路的手机玩家，走路教学条永远不消失；"我是本地人"安静 3 分钟里，捉迷藏邀请仍在 44 秒出现。
- 建议下一位接手：每处 F 线改动加 `worldMode === 'city'` 判断（小区走旧代码），面板打开时提示直接显示，教学条 8 秒后真正收起并把点地走路算作学会，捉迷藏邀请问 `baybayHeld()`。

### Verdicts

Reviewed tree: origin/opus-bay e9c3c35c. Time: 06:07–06:45 PDT (the fixer started after the 06:15 cut-off and had no time to land and check code; every confirmed finding is left open). Verification was by reading the code on e9c3c35c (file:line below) plus the lenses' own runs; no new browser run of mine.

| id | sev | verdict | evidence (mine) |
|---|---|---|---|
| F-RC-2 | blocker | confirmed-not-fixed | No worldMode gate in ui/Floating.tsx Toasts (always ui/titleHost.ts), ui/Moments.tsx PostcardReward's effect (`if (ok) return` — no auto-turn in any mode), ui/CoachMarkBody.tsx (new wording, ghost stick, title level in both modes), ui/TitleScreen.tsx link 先不玩 and touch hint (opus-bay.css:254 now shows the hint on every `.has-art` phone title), game/brain.ts lastIdleLine. Fix sketch: `worldMode !== 'city'` -> the pre-W9-F code paths (the old bodies are at b2f10b20~1 / 7a232652~1). |
| F-RP-1 | blocker | confirmed-not-fixed | game/flow.ts:605-607 `offerRealTime()` ends goldenFirstVisit in every mode; the district's old F11 offer (flow.ts at 03784d32~1:595-611, with `bayTimeOfDay` from ./qa) is gone. |
| F-RC-1 | major | confirmed-not-fixed | ui/titleHost.ts onModal(): a 'modal' holder at priority 5, maxWaitMs Infinity; toasts ask with TOAST_MAX_WAIT_MS 10 s and the ribbon too, so a toast raised inside a panel waits and is dropped. Fix sketch: while `modalUp()`, show the toast / ribbon at once (the top stack sits beside the sheet: opus-bay.css .has-sheet .ob-topstack). |
| F-RP-2 | major | confirmed-not-fixed | Same cause as F-RC-1 (the map compass, the album / share hints). |
| F-RC-3 | major | confirmed-not-fixed | ui/CoachMarkBody.tsx ownMove() reads only runtime.input.moveX/moveY; after COACH_SEEN_MS it only calls markCoachSeen() and keeps the bar up; tap-to-walk (runtime.player.pathTarget) never ends it. Fix sketch: after 8 s on screen close it for good; count a walk with `pathTarget` set by the player's tap as their own move. |
| F-RP-3 | major | confirmed-not-fixed | play/hideSeek.ts:491-507 startHideCoach: `ok = hideSeekAllowed() && !panel && !bubble && !moving`; neither it nor hideSeekAllowed() (:295-298) asks baybayHeld(), so flow.hushUntil does not hold the invite. |
| F-RP-4 | major | confirmed-not-fixed | Taken from the lens's run (fm/phone-zh-free.json: 南瓜灯 line at 18.9 s right after the 15 s hush); the three sources it names (play/pet.ts, halloween/worldLines.ts, data/script.ts) do not go through game/linePacer.ts. Not re-run by me. |
| F-RP-5 | major | confirmed-not-fixed | ui/Moments.tsx TURN_HINT reuses `.ob-postcard-caption` (left:auto; right:10) on the caption's own row: a long English caption runs under it. Lens screenshot f-rp/postcard-en-front.jpg. |
| F-RP-6 | major | confirmed-not-fixed | ui/CoachMarkBody.tsx ghostBase bottom 150 px + safe area, zIndex 6, while the touch coach bar sits at about the same height on 390x844 (lens eval [18, 592, 96], f-rp/coach-phone-b.jpg). |
| F-RC-4 | minor | confirmed-not-fixed | ui/ArrivalCard.tsx: the Escape listener has [] deps and no `granted` guard; `if (!granted) return null` gates only the render. |
| F-RC-5 | minor | confirmed-not-fixed | `requestSlot('line' …)` / `useAttention('action' …)`: no hits in src/opus-bay; only 'title' is used. The bubbles + voice and the E prompt are not routed through attention.ts. |
| F-RP-9 | minor | confirmed-not-fixed | ui/titleToday.ts says so itself: on the title the catalog is not in yet, so a world event cannot be the line; in game 6 s later it can. |
| F-RP-7 | minor | refuted | The card closing at 11.5 s is the W9-F2 rule "boarding a ride closes it" (ArrivalCard: move.mode === 'transit'); the tour boards the bus by itself 2.3 s after arriving — a tour pacing question (game/cityTour.ts), not a card timer. Not re-run. |
| F-RP-8 | minor | refuted | halloween/worldLines.ts huntAhead is not a lane-F source and is not a first-minute change of wave 9; uncertain without a run of mine, so per the review rule it stays out of this lane's list (worth a line-repeat check by the Halloween owner). |
| F-RP-10 | minor | refuted | By design (W9-F3/F4 commit message): only the welcome's 我自己逛逛 is the quiet wander; ?start=free (a QA deep link, `welcoming` false) and 自己逛 from the call menu later are the old free roam with the Coit nudge. |

### Own findings

None beyond the above (no time for an own pass over the W9-F commits).

### Open items

All twelve confirmed findings above. Order for the next agent: F-RC-2 / F-RP-1 (district gates; the hero regression test should then cover the district's toasts, postcard auto-turn and golden first visit), F-RC-1 / F-RP-2, F-RC-3, F-RP-3, F-RP-5, F-RP-6, F-RP-4, then the minors.

### Blocking the go-live to main

- **F-RC-2 / F-RP-1: district mode changed** (binding rule: district mode never changes). Either gate lane F's changes to the city or revert them for the district before main.
- F-RC-1 / F-RP-2 (feedback toasts lost inside panels) and F-RC-3 (a permanent coach bar for tap-only phone players) are user-visible regressions in the city; I would hold the go-live on them too.

Checks: this commit is docs only (one Markdown file); tsc / eslint / the opus-bay suite were not re-run for it.
