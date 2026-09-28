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

## Part b

### 给主人的摘要

1. 西沃德街纸板滑梯：在滑梯顶上点「滑下去」（电脑按 E），你和 BAYBAY 各坐一块纸板，3、2、1、冲！一起滑下去；按住空格（手机按住「躺下」）躺平滑得更快，躺到底就能赢她。只在真实开放时间开（周二到周日 10 点到 5 点、天黑前），其他时间 BAYBAY 会告诉你几点再来。
2. 缆车摇铃：坐上叮当车后，顶部横幅多了「铃声对答」——她摇一段你学一段，三轮之后 10 秒自由发挥，永远不会失败，只分「有点爵士 / 很爵士 / 爵士大师」。旁边的「探出身」按住不放，主角会从踏板上探出身子，镜头转到车外拍下经典缆车照。
3. 爬台阶比赛：菲尔伯特台阶（李维斯广场→科伊特塔）和 16 街马赛克阶梯（→龟山顶），走到台阶脚下 BAYBAY 会问「比赛？」；倒数后自动奔跑，赢她拿 ◆，跑得够干净拿 ★。还有台阶计数：今天爬了多少级，BAYBAY 到 100、200… 级会说一声。
4. 电脑 1440×900 和手机 390×844 都实际玩过、截图看过；全部 1186 个测试通过，已推送。里昂街台阶这次没做成赛道：游戏里中间有一段台阶接不上（已请地标线修）。

### What was built

| file | what |
|---|---|
| `play/zones.ts` (its own chunk, 4.2 KB gzip; `play/index.ts` loads it at init, city mode only) | `initZones()`: the activity chip overlay (`play-chip`), the 滑下去 / 几点开？ prompt on the slides' deck (`slidesIt`, the verb follows `slidesOpen()` on the Bay clock), 比赛？ at each stair course's foot (`stairsIts`), BAYBAY's one invite at each zone (≤ 1 per 3 min, only when quiet and she is near), the bell pad in lane T's ride banner (`registerRidePad('bell')`, a cable car under way), the step counter (`addStairRise`, `stepsToday`, `stepsTotal`: height gained on stairs × 29 steps/u, saved in `play.b` as `steps` / `steps-today` / `steps-day` through the kit), the activity chunks fetched within 60 u of their zone, `sayWhenQuiet(line, delay)` (a line after an activity, when no dialogue / cinematic / bubble / activity is up), the part-b sounds registered. |
| `play/chip.ts` + `PlayChip.tsx` | a one-line chip (title, a big number, a status, a quiet action, a press-and-hold button) — the slides' countdown and 按住躺下, the race clock, 你领先！/ BAYBAY 在前面 and 放弃. |
| `play/slides.ts` + `puppet.ts` + `cardboard.ts` (W5-A6, 5.0 KB) | `startSlides()`: PlayKit `slides` with the feet held; both hop onto the chute heads (lane L3's `SEWARD_SLIDES_WORLD`), 3 · 2 · 1 · 冲！, then ride their chute lines: a push, gravity less the cardboard's rub, lying back adds speed (`SLIDE_PHYS`; sitting ≈ 3.4 s, lying back all the way ≈ 2.5 s, BAYBAY 2.9–3.0 s); the bodies are drawn along the chutes (`puppet.ts`, a scene system after the actors) while the logical feet wait on the deck (the chutes are a blocker) and are put on the run-outs at the end; one InstancedMesh of two cardboard sheets (+1 draw call, 24 triangles, own material on the `ob-toy-inst` program, warm-up key `a-play-cardboard` registered as the chunk loads); two camera shots picked from shots of the published site (behind the pair on the deck, then in front of the foot looking up the chutes); the card ● 好 (down) · ◆ 很好 (before BAYBAY) · ★ 太棒了 (before her and within 0.12 s of lying back all the way); 不滑了 before 冲！ costs nothing; the prompt and BAYBAY's barks are quiet under the ride; 再来一次 walks back up to the deck. |
| `play/bell.ts` + `BellPad.tsx` (W5-A7, 4.8 KB together) | 铃声对答 (`startRiff`): three call-and-response rounds (two bars at 0.55 s a beat: the gripman's call with a tick on every beat, then your answer), judged on `audioNow()` by PlayKit's `RhythmJudge` (±150 ms, the offset learnt from the first taps), then `GROOVE_SECONDS` = 10 s of a synthesized swung groove where taps on a beat or its swung "and" are jazzy; score = answers (≤ 12) + jazzy taps (≤ 12), never failed: ● from finishing, ◆ from 10, ★ from 18, with 有点爵士 / 很爵士 / 爵士大师; the pad shows the round's two bars (gold call dots, dashed answer dots that fill when hit, a cursor), the big bell (H on a keyboard: captured while the riff runs, lane T's gripman bell otherwise) and 停; hopping off or the ride ending cancels at no cost. 探出身 (hold the pad's button or L, on the running board): the drawn rider rolls out 22° over lane F's 12° hang toward the ride camera's side, the camera goes outside the car ahead of it looking back (it moves in over the track where a building or wall stands at the spot, and stands further off on a portrait screen), the shutter after 1.1 s held (game/photo `requestShutter`, caption 湾区小旅 · 叮当车探身照 · date), letting go hands the camera back. |
| `play/stairs.ts` + `stairCourses.ts` (W5-A8, 3.6 KB) | two courses (world x, z polylines found on the published city): **filbert** — Levi's Plaza at the foot of the lower Filbert Steps (OSM way 30518788), up the flight, round Montgomery St and up the last flight to the plaza below Coit Tower (68 u, par 10.3 s); **tiled** — Moraga St at 16th Ave up the 16th Avenue Tiled Steps, along 15th Ave and up to the top of Grand View Park (31 u, par 4.4 s). `startStairRace(id)`: PlayKit `stairs-<course>`; the countdown holds the feet ≈ 2.5 s with BAYBAY at your side, then the race runs for you (Shift held); you run your own way (stick, WASD, tap-to-walk); BAYBAY runs her own walker (actors/guide) toward a point `LEAD` u ahead of her schedule (a scene system after the brain's 10 Hz update): `par` = a full run along the course at the player's run speed with the stairs' and slopes' factors (actors/controller `gradeFactor`) to the finish circle, BAYBAY = par × 1.12 + 0.8 s, ★ = par × 1.06 + 0.7 s; a dialogue, photo mode or a cinematic holds the clock and her; 放弃, getting on a bike / taking off, or wandering 26 u off the course cost nothing; the card, then the flight's fact the first time and today's steps. |
| `play/sounds2.ts` | synthesized `play-tick`, `play-go`, `play-whoosh` (cardboard on concrete), `play-bell` (one strike), `play-riff-1..3` (a round: the call + the ticks, sample-accurate), `play-groove` (walking bass, ride, brushes). |
| `play/kit.ts`, `ResultCard.tsx`, `play.css`, `index.ts` | `saveNumber(key, value)` (a counter into `play.b` through lane E's `recordBest`); the card sits under the ride banner on a ride; the chip, pad, bell and flash styles; `init()` loads `zones.ts`; `__opusBay.play.{zones,slides,stairs,bell}` in DEV. |

New BAYBAY lines (zh ≤ 45; VOICE glossary), for lane V's voice pass (tag `A`): 滑梯！坐块纸板，一起滑下去？ · 滑梯现在没开：周二到周日 10 点到 5 点再来！ · 规定大人要有小朋友陪——BAYBAY 算小朋友吧？ · 坐稳啦，一起滑！ · 你赢啦！躺下真的更快～ · 我先到啦！下次按住躺下试试～ · 嘿嘿，又是我先到！ · 真的去滑要自带纸板，穿结实的裤子哦！ · 我先摇，你学我！ · 随便摇！越有爵士味越好～ · 旧金山真有缆车摇铃比赛，司机们比谁摇得好听！ · 抓稳扶杆——咔嚓！经典缆车照！ · 比比谁先爬到顶？我可不会让你哦！ · 预备——看谁先到顶！ · 跑！ · 你赢啦！跑得真快！ · 我先到啦！再来一次？ · 我到顶啦！快上来～ · 菲尔伯特台阶大约 400 级，两边都是花园！ · 这 163 级台阶贴了 2000 多块手工瓷砖！ (and the dynamic 今天爬了 N 级台阶啦！).

### Evidence

- **Checks** on the rebased head `cc62864` (pushed): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings outside `src/opus-bay`) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1186 / 1186**. (Before the rebase two of lane L's tests failed on the wall clock — the fire rings' tops / flags between 06:00 and 21:30; lane L's `e889335` fixed them and the rebased suite is green.)
- **Tests** (7 new in `opus-bay-w5-play-acts`, 24 in lane A's two files): the slides (the chute lines, sitting loses to BAYBAY and lying back beats her at both ends of her random pace, the tiers, the hours: Tuesday 11:00 open, Monday / 09:59 / 17:00 closed, a Sunday 16:59 open, a December Sunday 16:55 closed by the sunset); the ride in node (closed → the line and nothing; the lock; the chip's 3 · 2 · 1 · 冲！; both bodies on the chutes; lying back → ★ and `medal:slides:1..3`; the run-out, the lock / puppets / camera / chip / prompt let go; sitting → ●; 不滑了 → start / cancel, nothing paid, never left the deck); the bell riff (only on a cable car under way; a player 0.2 s late all through hits 12 / 12 with the learnt offset; the freestyle's jazzy slots; 21 分 → ★, the medals, the best; hopping off → cancel; the thresholds); the lean-out (on a test platform: the head goes out 22° to the camera side, the camera outside and ahead, one shutter per hold, back on release, nothing when seated); the stair courses on the published city (every 0.5 u standable, each leg a nav-grid walk ≤ 1.5 × its length, the foot and the top open, climbs > 8 u, par 10.3 / 4.4 s, gold < BAYBAY, her schedule monotonic and at the circle on her time, the Filbert course counts 400 ± 40 steps); the race in node (the countdown lock, Shift held, 你领先！, a dialogue holds the clock, the card with BAYBAY's time and the medals, 放弃 and wandering off pay nothing); the zones (the prompts and their verbs by the Bay clock, the pad's visibility, the counter's milestone line, the save keys, a new Bay day).
- **Chunks** (esbuild, minified, gzip; what loads earlier is shared): core 5,477 B (≤ 6 KB) · zones 4,153 · PlayChip 723 · slides 4,993 · stairs 3,577 · BellPad + bell 4,826 · ResultCard 961; nothing of `play/` in GameRoot's static graph.
- **In the game** (dev server 5508, one headless Chrome, `--force_high_performance_gpu`, `?date=2026-09-29T11:00` = a Tuesday morning, zh; every image read):
  - slides, desktop 1440 × 900 high: E on the deck → the pair hop on, 3 · 2 · 1 · 冲！ (the first line 规定大人要有小朋友陪——BAYBAY 算小朋友吧？), both slide side by side, Space held ≈ 1.8 s → 你 2.7 秒 · BAYBAY 2.9 秒 ◆ 很好 +15 金币, both on the run-out; calls 61–78, 258–303k triangles during the ride. Phone 390 × 844 dpr 3 mid: the 滑下去 button, the chip's 按住躺下 held → 你 2.6 秒 · BAYBAY 3.0 秒 ★ 太棒了 +30; 58–59 calls, 212–215k.
  - stair race, Filbert: desktop, E at Levi's Plaza (比赛？ 和 BAYBAY 比爬菲尔伯特台阶), a tap-to-walk run started at 跑！ → 你 11.0 秒 · BAYBAY 12.2 秒 ★ (on the earlier tune); phone, the 比赛？ button → 你 10.6 秒 · BAYBAY 12.3 秒 ★ 太棒了 +30 (par 10.3, the final tune); the chip 菲尔伯特台阶 2.8 你领先！ 放弃 over the steps; at the top lane C's pelican moment follows (a new save), the fact line waits for it; 367 steps counted. Tiled (desktop, final tune): 你 5.4 秒 · BAYBAY 5.7 秒 ◆ 很好 +15, then 这 163 级台阶贴了 2000 多块手工瓷砖！. Calls 65–85, 245–355k along both.
  - bell riff, desktop: boarding the Powell–Hyde car at Powell & Market, the pad 铃声对答 · 探出身 L under the banner; three rounds answered on the beats 12 / 12, the freestyle 12 jazzy → 24 分 ★ 爵士大师 +30, the card under the banner; 探出身 → the lean from outside ahead of the car, the shutter and 抓稳扶杆——咔嚓！经典缆车照！ Phone: the pad on its own row (bars, the big bell, 停), a tap on the answer beat lit it teal; 探出身 held → the rider hanging out over Powell St, BAYBAY and the gripman behind. Calls 81–102, 285–326k on Powell.
  - Shots kept (`docs/opus-bay/qa/w5/A/`): `b6-slides-mid-ride-desktop.jpg`, `b6-slides-lie-back-hold-phone.jpg`, `b6-slides-result-card-desktop.jpg`, `b7-bell-riff-answer-desktop.jpg`, `b7-bell-riff-card-under-banner-desktop.jpg`, `b7-bell-pad-phone.jpg`, `b7-lean-out-desktop.jpg`, `b7-lean-out-phone.jpg`, `b8-stairs-filbert-prompt-desktop.jpg`, `b8-stairs-filbert-race-desktop.jpg`, `b8-stairs-result-card-phone.jpg`; the rest and the logs in scratch (`run-shot.mjs` scenarios slides, slidesphone, slidecam, filbert, tiled, bell, bellphone, lean).
- **Facts** (checked on the web 2026-09-28): the slides — "open 10 a.m. to 5 p.m. Tuesday through Sunday", "adults must be accompanied by children", "Bring a piece of cardboard and wear sturdy pants!", the park closes at sunset (https://sfrecpark.org/facilities/facility/details/sewardminipark-203); the Filbert Steps — "climbs Telegraph Hill over a series of 400 steps, with houses and public gardens on either side", Filbert St ties for the sixth steepest, never "the steepest" (https://en.wikipedia.org/wiki/Filbert_Street_(San_Francisco)); the 16th Avenue Tiled Steps — 163 steps, over 2,000 unique tiles, opened 27 August 2005 (https://en.wikipedia.org/wiki/16th_Avenue_Tiled_Steps); the cable-car bell ringing contest in Union Square with a division for the grips and conductors, the 53rd on 7 July 2016 — said without a date (https://www.sfmta.com/press-releases/sfmta-announces-winners-53rd-cable-car-bell-ringing-contest); the Lyon Street Steps' count differs by source, 288 (SFGate) or 332 (https://www.sftourismtips.com/lyon-street-steps.html), with the bay views (https://www.nps.gov/places/000/lyon-street-steps.htm) — for the course that waits.

### Decisions

1. **Two stair courses, not three.** The Lyon Street Steps on the published city do not join between the second landing and the third flight (not standable round (−301.5, 507); the nav grid goes round through the Presidio's trees), so neither the player nor BAYBAY can run them yet (Requests, L). Filbert runs from Levi's Plaza to Coit Tower (the lower flight, Montgomery St, the last flight); the tiled course continues from the tiled flight to the top of Grand View Park, where the 看风景 spot is.
2. **BAYBAY's pace comes from the course**, not from a fixed speed: par × 1.12 + 0.8 s, and ★ at par × 1.06 + 0.7 s. Measured with tap-to-walk runs that start 0.25 s after 跑！: ≈ par + 0.4 s on Filbert (★), ≈ par + 1.0 s on the short tiled course (◆); a straight run on the stick is what ★ asks for there.
3. **The race locks the feet only for the countdown**, runs for you (Shift held in `input.keys` while it runs) and **pauses** for a dialogue, photo mode or a cinematic (lane C's pelican moment at a first viewpoint fired mid-race at Grand View in a new save; cancelling there felt wrong).
4. **BAYBAY in the race runs her own walker.** The brain rewrites her target at 10 Hz; a scene system (mounted after the brain) sets her target to a point 1.6 u past her schedule every frame, so her legs, paths and stairs are the walker's own. Her displayed time is her schedule's; if her walker hops her back to you (out of sight), she is put back on her schedule.
5. **The slides draw the bodies, not the feet.** The chutes are a blocker, so the logical player waits on the deck and BAYBAY's feet are parked 3 u up the deck (out of her talk reach), while `puppet.ts` draws both along the chute lines after the actors; the deck prompt and BAYBAY's barks are quiet under the ride; at the end both are put on the run-outs.
6. **"Hold Hop to tuck" is 躺下 (lie back)**, what the kids really do on the cardboard; phones get the chip's 按住躺下 (the 跳 button works too).
7. **The lean-out is 探出身 on the pad (and L), not "hold Hop".** On a ride Space / 跳 is 提前下车; getting off must stay one press (the owner's F1).
8. **The riff never holds the lock** and walking the deck does not end it; hopping off or the ride ending does. H is the riff's while it runs (stopped at the capture phase so lane T's gripman bell does not ring over it).
9. **The lean photo uses photo mode's shutter** (`requestShutter`: the same framed PNG, saved the same way); the flash is the pad's own.
10. **The step counter** lives in `play.b` through lane E's `recordBest` (`steps`, `steps-today`, `steps-day`: 3 of the 32 keys), saved off the stairs or every 12 s; BAYBAY says today's count at 100, 200 … 3,000, at most every 90 s and only when quiet.
11. **Medals per course** (`medal:stairs-filbert:n`, `medal:stairs-tiled:n`), plus `medal:slides:n` and `medal:bell:n`: 12 one-off sources in `play.e`.
12. **The result card sits under the ride banner** during a ride (186 px) so the bell card is not hidden by the banner.

### Known gaps

- BAYBAY's body on the stairs runs 2–4 u behind her schedule (her walker), so she reaches the top a moment after the time on the card.
- The lean camera avoids buildings and walls (a standable check at its spot) but not street trees: on a few stretches of Powell St a tree can stand in the picture.
- The two chutes are 0.5 u apart (lane L3's site), so from some angles the riders overlap a little.
- During a race 和 BAYBAY 聊聊 stays on offer (her real body runs beside you); E there opens her menu and pauses the race.
- Lane N's discovery toasts share the top centre with the result card and the chip; they overlap for a second when a place is found at the same moment.
- A real Shift held at the moment a race ends needs pressing again (the race's held Shift is released then).

### Not done

- The Lyon Street Steps course (the walk gap, Requests L); the W5-A9 should list (marshmallow at the fire rings first — the fire season ends Oct 31 —, turntable heave-ho, crest hops, the sea-lion count, fetch / frisbee, beach ball, cardboard sled, the Lombard descent + Vermont, the GGB-towers ring course; hide & seek).
- From part a, still open: the painted view card image; "Karl moves / lights come on at dusk" in the slow look; a shot of the crowd waving back.

### Requests

- **L**: the Lyon Street Steps do not join between the second landing and the third flight on the published city (`canStand` false round (−301.5, 507); a stairs probe map is in scratch `probe-navopen.mts`): once they are walkable end to end (Vallejo → Broadway), lane A adds the third course (`play/stairCourses.ts` is append-only data).
- **C**: `data/sf/placeCards2.ts` `seward-street-slides` tip says 小朋友要有大人陪着; the official page says the reverse, "adults must be accompanied by children" (sfrecpark.org, checked 2026-09-28) — a tip that keeps the joke: 官网写的是"大人要有小朋友陪着"——带块纸板、穿结实的裤子。 Optional: hold an arrival / pelican moment while a PlayKit activity runs (`play` start → end / cancel events) — the stair race pauses for it today.
- **F**: (1) optional: a sanctioned way for an activity to hold BAYBAY's target (the race drives her walker from a scene system after the brain; a `holdGuide(target, run)` in the brain would be cleaner); (2) the lean-out rolls the drawn rider (`opus-player`) after the actors each frame: keep that name for the transit rider; (3) the discovery toasts and PlayKit's card / chip share the top centre (Overlay stacking), see Known gaps.
- **V**: budget: the slides add +1 draw call and 24 triangles while a ride runs at the Seward slides (Corona Heights, not downtown), own material on the `ob-toy-inst` program (warm-up key `a-play-cardboard`); the stair races and the bell add nothing to the scene. Voice (H5-3): the part-b lines above, tag `A`.
- **E**: the notebook may show the steps (`play.b.steps`, `steps-today` with `steps-day`) and the bests (`slides`, `bell`, `stairs-filbert`, `stairs-tiled`); 12 new medal sources go to `play.e`.
- **T**: nothing needed — the bell pad sits in the ride banner through `registerRidePad('bell')`; H is left to the gripman's bell except while the riff runs.
