# Wave 5 · lane A · Activities & actions

Lane A owns `src/opus-bay/play/**` and `tests/opus-bay-w5-play{,-acts}.test.ts` (plan `sf-w5-plan.md` §3.2, §4.11; lead
note `sf-w5-lead.md`). Worktree `C:/Users/willy/wt/w5-a` (branch `w5-a`), dev port 5508, scratch
`C:/Users/willy/opus-qa/w5/w5-a/`, QA images `docs/opus-bay/qa/w5/A/`.

## Part a

### 给主人的摘要

1. 新玩法的底座 PlayKit 上线：结算卡（好 / 很好 / 太棒了，形状加文字）、奖牌金币每档只给一次、记住最好成绩、一动就取消，什么都不扣。
2. 第一次飞行：解锁鹈鹕后从科伊特塔出发，8 个金圈飞过渡轮大厦，再沿码头飞到 39 号码头，圈里有金币；电脑和手机都实际飞完 8/8。C 线的"试试起飞"已经接上它。
3. 动作：点一下自己（电脑按 T）出现四格——挥手、跳舞（BAYBAY 一起跳）、躺草地、和 BAYBAY 自拍；双击 BAYBAY 或"问 BAYBAY → 摸摸"可以摸她（爱心 + 小叫声）；在水边发呆时她偶尔会仰面漂着。
4. 随地坐下，加 16 个"看风景"点（双峰、伯纳尔高地、龟山、多洛雷斯坡顶、天涯海角……）：坐 5 秒后镜头慢慢拉远看 20 秒，第一次给 5 金币并记进手帐。海德街码头现实里关着，这一格换成了水上公园。
5. 全部 1091 个测试通过，改动都已推送；接下来（第 b 部分）做滑梯、缆车摇铃和爬台阶比赛。

### What was built

| file | what |
|---|---|
| `play/index.ts` (the core chunk, 5.4 KB gzip) | `init()`: the sounds, the result card overlay, the emote wheel overlay, 问 BAYBAY items 做个动作 (order −20) and 摸摸 BAYBAY (−10), the 坐下 prompt + the 16 坐下看风景 prompts (`registerInteractables('a-play')`), `registerRewardIds('view', VIEW_SPOT_IDS)` with lane E's ledger, lane F's `self-tap` (you → the wheel; BAYBAY double → pet), keys (T, E E) at the capture phase, BAYBAY's float watcher, the one emote coach line, `__opusBay.play` in DEV. `export let startFirstFlight` — a live binding set by `init()` (lane C's 试试起飞 calls it). |
| `play/kit.ts` | PlayKit: `startActivity(spec, { lock, cancelOnMove, onStop })` → `run.end({ tier, score, detail, bestText, again })` / `run.cancel()`; one activity at a time; `holdLock('activity')` released on every exit; `medal:<id>:<tier>` 5 / 10 / 15 once per tier; `bestOf` / `recordBest` (session + lane E's `recordBest` when it exports one); `RhythmJudge` on `audioNow()` (±150 ms, offset = median of the first 4 plausible taps, clamped ±0.25 s); `tierFor`; `showResult` / `ensureResultOverlay`. |
| `play/ResultCard.tsx` | the card: ○ 再试试 · ● 好 · ◆ 很好 · ★ 太棒了 (shape + word), the activity, one detail line, 新纪录！ or the earlier best, the coins the ledger actually paid for this run, 再来一次 / 好的; closes itself after 8 s (not while a pointer rests on it). |
| `play/viewSpots.ts` | the append-only 看风景 registry (16 ids, name, a ≤ 20-character line, where to sit, what it faces, area, attraction, source + verifiedAt), `viewHeading`, `viewReward`, `VIEW_SIT_SECONDS 5 · VIEW_LOOK_SECONDS 20 · VIEW_COINS 5 · VIEW_RADIUS 3`. |
| `play/emotes.ts` + `EmoteWheel.tsx` | the four emotes; the wheel (four slots round the middle of the screen, keycaps 1–4 on a keyboard, ✕, a tap outside closes). |
| `play/pet.ts` | `pet()`; from afar the double tap walks you over and pets on arrival; `startFloatWatch()` (idle ≥ 9 s, water within 10 u of her, a coin flip, ≤ 1 per 3 min). |
| `play/sit.ts` | `sitHere()`, `sitAtSpot(spot)`, `standUp()`, `seated()`, the slow look `lookShots()` (three eased shots, 20 s, the pair in frame), the view find + reward. |
| `play/firstFlight.ts` + `rings.ts` + `FlightChip.tsx` | `startFirstFlight({ course? })`, `skipFirstFlight()`, `takeOffNow()`, `flightState()`, `COIT_COURSE` (8 rings, floors as the glide sees them), `localCourse()` (unlocked elsewhere), `ringY()` (a ring floats at the flying height inside its envelope: floor + 8 … + 45); the rings: ONE `InstancedMesh`, 8 × 124 = 992 triangles, on the `ob-toy-inst` program (warm-up key `a-play-rings`); the chip: 第一次飞行 · 金圈 n / 8 · an arrow to the next ring · 跳过 (phones: its own 起飞 before the take-off). |
| `play/sounds.ts`, `play/play.css` | synthesized `play-squeak`, `play-ring`, `play-medal`, `play-dance`; the styles (opus-bay.css tokens). |

Lines (zh ≤ 45, VOICE glossary): 按 G 起飞，穿过金圈拿金币！ / 点「起飞」，穿过金圈拿金币！ · 漂亮！下一个金圈在前面～ · 金圈在后面，我们掉个头～ · 全部穿过！按 G 降落吧～ / 点「降落」落地吧～ · 到终点啦！… · 一起跳！左一步，右一步～ · 找块草地再躺吧～ · 看，云在慢慢走～ · 来，一起拍一张！ · 嘿嘿，好痒！ · 再摸摸头～ · 你摸得最舒服啦！ · 海獭前臂下有小口袋，我也有哦！ · 好啦好啦，毛都摸乱啦～ · 海獭亲戚也这样仰面漂，肚子当桌子！ · 坐一会儿，看看<spot>的风景～ · 真美……这张风景记进手帐啦！ · 每次看都不一样呢。 · 点一下你自己 / 按 T 可以挥手、跳舞、和我自拍！

### Evidence

- **Checks** on `c76fd20` (A2–A4 pushed) and again before the report commit: `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings outside
  `src/opus-bay`) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1091 / 1091** (one run on the base before
  had `sf-move2` "E2-5 view field" fail under load; alone it passes, and the next full run was 0 fail).
- **Tests** (17 of lane A): `opus-bay-w5-play` — the judge (±150 ms on a stub clock, the offset learnt from four taps, clamped, nearest
  beat), tiers, one activity at a time with the lock held / released on end, cancel and a new start, cancel pays nothing, medals once
  per tier, moving cancels after the grace, bests, the result card (overlay, coins paid, 新纪录！, the four shapes rendered);
  `opus-bay-w5-play-acts` — the 16 ids (append-only snapshot), sources and short lines, the MF8 areas; every spot standable on the
  published city, an open view along its heading for 80 u, ≥ 4 u from every card / POI / postcard prompt; the Coit course inside the
  model, every floor ≥ the glide's (ground, roofs, tall structures), the envelope inside the soft floor and the ceiling, 40–120 u
  spacing, ≈ 43 s at cruise; a local course from each of the 6 panorama viewpoints × 4 headings; chunk sizes and the static graph;
  the emotes, the pet and the float watcher, sit offer / stand, the slow look (find + reward once, skipping keeps it), the flight
  run (rings in any order, missed ones, the card at the last ring, 跳过), the init wiring (ask items, self-tap, the live export).
- **Chunks** (esbuild, minified, gzip; other folders external): core 5,417 B · EmoteWheel 2,323 · firstFlight 3,166 · rings 1,789 ·
  FlightChip 1,381 · pet 1,627 · sit 1,565 · ResultCard 917 (targets: core ≤ 6 KB, each activity ≤ 5 KB).
- **In the game** (dev server 5508, one headless Chrome, `--force_high_performance_gpu`; zh unless noted; images read):
  - first flight, desktop 1440 × 900 high (en run): from the Coit summit, G, steered with A / D like a player → rings 1…8 caught in
    ≈ 45 s, the card ★ 太棒了 · 8 / 8 · +30 金币 (lane E's ledger paid the three medals); renderer during the flight: 72–95 calls,
    240–325k triangles (Ferry gate / Embarcadero from 43 u up). Phone 390 × 844 dpr 3 mid: the same run, 68–75 calls, 243–303k
    triangles, the chip on one line under the pill, the card at the top. The handoff: arriving at Coit with the glide locked → lane C's
    moment → 试试起飞 → the chip 第一次飞行 · 按 G 起飞 and the rings up (course 'coit').
  - emotes, desktop (Marina Green): T → the wheel (挥手 1 · 跳舞 2 · 躺草地 3 · 自拍 4); 跳舞 with BAYBAY and her line; 躺草地: both
    lying, BAYBAY on her back, 看，云在慢慢走～; 自拍: photo mode, both facing the camera, posing. Phone (Dolores Park): a tap on the
    character opens the wheel, 跳舞 with notes, a double tap on BAYBAY → hearts + 嘿嘿，好痒！, 自拍 in photo mode. 问 BAYBAY shows
    ① 做个动作 ② 摸摸 BAYBAY on top; ② pets her. E E at her side (on a street, BAYBAY the prompt): her menu opens and folds
    away, 嘿嘿，好痒！.
  - view spot, desktop golden hour (Twin Peaks): 坐下看风景 · 双峰 → seated facing downtown with BAYBAY → after 5 s the letterboxed
    look with 看风景 · 双峰 / 湾区风景尽收眼底, the pull-back with the pair in the lower third, 跳过 / Esc. 坐下 on the Dolores lawn
    (phone: the contextual 坐下 button).
  - Shots kept: `qa/w5/A/a5-first-flight-ring-ferry-desktop.jpg`, `a1-result-card-first-flight-phone.jpg`, `a2-emote-wheel-desktop.jpg`,
    `a2-emote-wheel-tap-yourself-phone.jpg`, `a2-lie-on-the-grass-desktop.jpg`, `a2-selfie-two-shot-desktop.jpg`,
    `a2-ask-baybay-emote-pet-desktop.jpg`, `a3-pet-baybay-double-tap-phone.jpg`, `a4-sit-at-twin-peaks-desktop.jpg`,
    `a4-slow-look-twin-peaks-golden-desktop.jpg`; the rest and the run logs in scratch.
- **Facts** (checked on the web 2026-09-28): Hyde Street Pier closed, its ships at Mare Island (https://www.nps.gov/safr/planyourvisit/basicinfo.htm);
  the Aquatic Park Municipal Pier closed indefinitely (https://www.sfgate.com/bayarea/article/san-francisco-municipal-pier-closed-17607420.php);
  Aquatic Park's bleachers and beach look at the Golden Gate Bridge, Alcatraz and Marin (https://www.sfgate.com/local/article/aquatic-park-17860469.php);
  sea otters float on their backs using the chest as a table, with a pocket of loose skin under each forearm
  (https://www.montereybayaquarium.org/animals/animals-a-to-z/sea-otter); each view spot's line has its page in `viewSpots.ts`
  (Twin Peaks sfrecpark 384 "spectacular views of the Bay Area"; Bernal Heights sfrecpark 151 360° panorama; Grand View sfgate; Ina
  Coolbrith sfrecpark 175 "views of the city and the bay"; Alta Plaza sfrecpark 147 Bay views from the north side; Dolores Park
  Wikipedia (skyline from the SW corner); Lands End NPS "spectacular views of … the Golden Gate"; Sutro Heights NPS places page;
  the Wave Organ Wikipedia; Crissy Field East Beach presidio.gov; Pioneer Park sfrecpark 381; Buena Vista Lonely Planet; Mount
  Davidson Wikipedia (highest natural point, 928 ft); Corona Heights Wikipedia; Marina Green goldengatepark.com).

### Decisions

1. **Aquatic Park instead of "Hyde St Pier end"** (view spot 16): the pier is closed and its ships moved (NPS), and the Municipal Pier
   next to it is closed too; the Aquatic Park lawn by the beach looks across the cove to Alcatraz and is open.
2. **No soft box on the first flight.** Lane F's `glideSoftBox` is a box the pelican is turned AWAY from (Fleet Week's air box); my
   first version held one round the course and it pushed the pelican off the rings. Instead: the camera turns to ring 1 before the
   take-off, the chip's arrow points to the next ring, BAYBAY says so when the take-off faced away, and each ring ahead floats to the
   flying height (so a first flight needs steering only).
3. **The card shows at the last ring** (not after a landing): the pelican otherwise flew on past PIER 39 and the card came at the Marina.
4. **`startFirstFlight` is a live export** of `play/index.ts`, set by `init()` and cleared by its teardown: lane C's code finds it in
   the game, and C's own test of the "no lane A" path (the plain take-off) still holds.
5. **Ring coins:** the flight asks 3 per ring (`ring:first-flight:<n>`, the same ids from any course). In the QA run lane E's ledger
   still capped `ring` at 1 (the card's +30 were the medals 5 / 10 / 15); E raised the cap to 3 in `675e123`.
6. **坐下 is offered** after 1 s still, on foot, on grass / sand / earth / steps / plaza / pavement / boardwalk, never with another prompt
   in reach and never while BAYBAY has news (her 跟我来 / called bubble): on a keyboard E sits then, and her menu is on Q (问 BAYBAY);
   E E at her side still pets when she is the prompt. The second word names where you sit (草地上 · 台阶上 · 沙滩上 …).
7. **躺草地 only on grass, sand or earth** (BAYBAY suggests a lawn elsewhere); 跳舞 and 躺草地 are dimmed in the wheel until lane F's
   body is registered (it is: `b76a717`).
8. **T and E E are read at the capture phase**; T is stopped there (the wheel a T opens used to receive that same T and close).
9. **The selfie waits** (≤ 2.5 s) for BAYBAY to stand at your side before photo mode opens; the follow distance comes back after.
10. **The coach line** (once per device, localStorage `opus-bay:play:emote-coach:v1`) waits for ≈ 50 s of quiet free roam and lane F's
    body, so the phone line (tap yourself) never promises a tap that does nothing.
11. **Bests** are kept for the session and written through lane E's `recordBest` (`economy/index.ts`, delivered in `675e123`, looked up
    lazily by `play/kit.ts`): `play.b` stays E's.

### Known gaps

- The crowd's wave back (lane T's hook on the `emote` wave event lane A emits) was not caught in a shot.
- The slow look thins the music (`duck`); "Karl moves, lights come on at dusk" from the plan are not done (they belong to the world's
  own fog and night, not to a camera beat).
- The phone's 坐下 button shows lane F's ⓘ icon (Requests); the wheel sits in the middle of the screen, not round the character.
- In the dev server the first flight's chip and rings take 2–4 s to appear on the very first use (cold lazy chunks); a build is small.

### Not done (part b)

W5-A6 Seward slides, W5-A7 the bell riff, W5-A8 stair races, W5-A9 the should list, the painted view card image (should).

### Requests

- **E**: (1) `recordBest` and (2) the ring cap were delivered in `675e123` (thank you: closed). (3) The notebook's 看风景 page:
  `VIEW_SPOTS` / `VIEW_SPOT_IDS` from `play/viewSpots.ts` — A's `init()` registers them (`registerRewardIds('view', VIEW_SPOT_IDS)`),
  `find view` carries `first`.
- **F**: (1) the 坐下 prompt's icon: `ui/Hud.tsx` ContextAction `ride = 'seat'` also for `it.id === 'play:sit'` (the Armchair); (2)
  optional: `emote('baybay', 'pose')` turning her to the camera in photo mode (the selfie shows her side-on when she stood facing the
  player); (3) optional: a one-time pulse of the move column's 起飞 while the first flight's intro runs (`firstFlightActive()`).
- **V**: the first flight adds 1 draw call and 992 triangles while it runs, downtown (Coit → the Ferry Building → PIER 39) at ≈ 43 u
  over the Embarcadero — measured 72–95 calls / ≤ 325k at high, 68–75 / ≤ 303k on the phone profile; the material shares the
  `ob-toy-inst` program (warm-up key `a-play-rings`). Voice (H5-3): the lines listed under What was built, tag `A`.
- **C**: nothing needed: 试试起飞 → `startFirstFlight()` works in the game (checked); the intro line no longer repeats 先试试起飞？.
