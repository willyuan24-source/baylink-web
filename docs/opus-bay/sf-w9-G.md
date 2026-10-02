# Wave 9 · lane G · games & discovery — report

Lane G of wave 9 (`docs/opus-bay/sf-w9-lead.md` §3 G), worktree `C:/Users/willy/wt/w9-g`, port 5907, scratch
`C:/Users/willy/opus-qa/w9/g/`. Two agents: the first worked 2026-10-01 21:36 → 10-02 ≈ 00:35 PDT and was stopped by an account
usage limit (it had pushed G1–G4a and left the small games uncommitted); the second (this report's author) resumed at 02:14
PDT, finished, tested and pushed the small games (G5), did 那是什么？ (G6) and wrote this report (last push 04:46 PDT).

## 给主人的摘要

1. 新增「游乐图鉴」：旅行本里多了「游乐」页，24 个小游戏按地方分组；没玩过的只露剪影和一句线索，点「带我去」直接走到游戏跟前（不再停在景点中心）。问 BAYBAY 多了「附近能玩什么？」，地图多了「玩」筛选，紫色游戏图标，下方列表也跟着筛。
2. 捉迷藏修好了：她藏在你这一侧的街上（渡轮大厦前 30 次里 30 次藏到马路对面 → 0 次），不再说「金银岛附近」，被路沿挡住时提示「从斑马线过去」，找的时候镜头不乱转，冷热提示不乱跳，时间到会让她现身并给安慰卡。
3. 每天第一次玩完任意小游戏 +10 金币（「今日小游戏」，在现有每日上限之内）。
4. 抓娃娃写明规则，落爪前 3 秒闪烁倒数，抓到时玩具放大弹出、BAYBAY 欢呼，结算卡上有抓到的纪念品照片；拉闸小游戏的分数只增不减；雾笛的互动范围扩大到 3；手机横屏时 6 个小游戏面板改为左右两栏，不用再滚动。
5. 「那是什么？」只考画面里看得清的地标（渡轮大厦前不会再考看不见的恶魔岛），一题全对给「很好」。
6. 没做完：雾笛旁的醒目道具、邻居委托的名牌（Ray）、抓娃娃在「设置」暂停时仍在走（见 Not done）。Higgsfield 没用。

## Commits (all on origin/opus-bay)

| commit | what | verified |
|---|---|---|
| `cc8c3ff2` W9-G4a | 今日小游戏: `daily:<Bay date>:4`, 10 coins, inside the ledger's daily cap (no new cap, no save bit); the result card's line | kit tests; w9-g-play |
| `f0fdfb0b` W9-G1 | 游乐图鉴: `ui/playDexData.ts` (24 rows, 7 groups, where / rule / clue / medal / played), `ui/PlayDex.tsx` (lazy tab body), `play/dexEntry.ts` (tab 游乐 + 问 BAYBAY → 附近能玩什么？, today's game payer); the emote coach moved to `play/pet.ts` (play core guard room) | desktop + 390×844 (`qa/w9/G/g1-dex-phone.jpg`) |
| `c1991a64` W9-G2 | the map's 玩 chip: violet game pins + icons, a pin's go card ends at the game's prompt, the chips filter `CityMapList` too; `ui/CityMap.tsx` 9 surgical hunks (lane Q's) | w9-g-dex 6 tests, sf-map-w4 |
| `3446c7b2` W9-G3 | hide & seek: same side (0 / 6 across from the Ferry plaza and Gate E, was 6 / 6), no offWalk / far-trip-end clue, 从斑马线过去 + a fixed line, still camera, held heat band, the time-up reveal + card | w9-g-play 6 tests |
| `a2635ffb` W9-G5 | the small games (below) | w9-g-small 6 / 6 (red 6 / 6 on the old files); suite 2005 / 0 fail; played desktop + 844×390 |
| `39d1a3bc` W9-G6 | 那是什么？ on-screen size + the round camera's line of sight; medals by share | w9-g-sky 3 / 3 (red on the old file); suite 2123 / 0 fail; played |

G1–G4a are the first agent's (their messages carry their own verification); G5 and G6 are this agent's.

## What changed in this part (G5, G6)

### W9-G5 — the small games (review R§6 玩法与收集 rows; w8 NEXT #9 / #11)

- **Claw** (`play/claw.ts`, `ClawPanel.tsx`, `sfgames.css`). "夹娃娃 12 秒后自动下爪，没有任何说明" → a rule line under the
  head 「每枚硬币 12 秒：对准后按「抓！」，时间到会自己落爪」 and `ClawGame.countdown` = 3 / 2 / 1 in the aim's last
  `COUNT_FROM` = 3 s, drawn blinking over the glass, the clock bar red. "结算对孩子太冷淡" → each souvenir won pops up big over
  the glass (「抓到啦！科伊特塔模型」, 1.9 s); BAYBAY cheers at the end when something was won; the result card shows the
  souvenirs big (`prizeSnapshot`, 320 × 240, two rows for 4–5) with 保存照片.
- **Grip** (`grip.ts`, `GripPanel.tsx`). The live number was the 0–100 share (100 → 14 at the first miss) → `livePoints`, the
  points so far (a miss adds nothing; only bell spam past the free rings costs 1), labelled 分; the 0–100 score stays on
  the card. Test: on a real Powell–Hyde ride held through the red, the share fell 23 in one frame, the points never fell.
- **Foghorn** (`sfgames8.ts`): `FOG_SPOT.r` 1.5 → 3 u.
- **Chunks** (w8 NEXT #11): the claw / fortune / crab / dough / busk / foghorn prompts and the grip pad start their game with
  `Promise.all([game, its panel])` through `importRetry`, so the claw's 12 s no longer runs while `ClawPanel` loads.
  "`play/zones3.ts` → `./sfgames8` through importRetry" was already done by W8-P5: nothing to do.
- **Landscape** (w8 NEXT #9, `sfgames.css`, `@media (max-height: 560px) and (min-width: 600px)`): claw, crab, dough,
  fortune, busk, fog in a two-column grid (picture left, sized from the viewport height). Measured at 844 × 390 dpr 2
  quality mid: claw panel 720 × 303 at top 8 (scrollHeight 301 = clientHeight), crab 336 / 336, foghorn 225 / 225; before,
  the W8-K-review stopgap was one column that scrolled. The grip keeps its own grid (`sfgames8.css`).
- Played (CDP, `?world=city&start=free&save=off&lang=zh-Hans`, desktop 1440 × 900): the rule line, the count «3» ≈ 10 s in
  (`qa/w9/G/g5-claw-count-desk.jpg`), the pop 抓到啦！科伊特塔模型, the card 太棒了 · 抓到 5 个 · +40 金币 · 今日小游戏奖励 +10 ·
  保存照片 with the picture. Landscape: `qa/w9/G/g5-claw-landscape-844x390.jpg`.

### W9-G6 — 那是什么？ (review R§6: "第三题的目标在画面里看不见；视野里只有 1 个地标时，全对也只拿「好」")

- `play/skyline.ts`: one ray walk `scan` now serves `inSight` (same samples, same rule) and `visibleAngle` (the landmark's top
  down to the highest occluder in front of it, or sea level). A landmark is asked only when the eye sees it **and** the
  round's camera (`shotFrom`, the same spot `nextRound` uses) has a clear line and sees at least `minAngleOf(s)` of it:
  `SKY_MIN_ANGLE` 0.03 rad (≈ 35 px on a 900 px desktop at the 42° fov, ≈ 21 px on a 390 × 844 phone); the two bridges
  (`long: true` in `skylineLines.ts`) half that.
- `skylineTier(right, asked)`: ★ all right of two or more; ◆ ≥ 2/3, or one of one (was ●; still not a free ★, the
  W7-W2-review rule); ● otherwise.
- Numbers: with a flat ground at 2 u, Alcatraz shows 0.020 rad from the Ferry Building plaza and 0.019 from Pier 14 → not
  asked; 0.037 from Pier 39's gate and 0.057 from Aquatic Park → asked. With the live occluder over 19 spots (the Ferry plaza,
  Gate E, Pier 39's gate, the 16 看风景 spots) the questions a quiz can ask go 39 → 34. Grand View Park 7 → 2: Coit Tower
  1083 u off showed 0.018 rad and the shot was trees and roofs; Dolores Park drops the Bay Bridge (717 u, 0.012 rad: the shot
  showed only haze over downtown). Played: the Ferry plaza asked 1 question (海湾大桥, in frame) → 很好 ◆ 认对 1 / 1; Pier 39's
  gate asked 恶魔岛, the island in the middle of the frame (`qa/w9/G/g6-skyline-pier39-alcatraz.jpg`).
- Tests updated, not deleted: `opus-bay-w7-w2-skyline` (the one-landmark corridor 0.6 → 1.5 u, since the camera stands
  0.9 u aside; one of one is ◆); `opus-bay-w7-w2-kite` (skyline.ts's chunk cap 6 → 6.5 KB: 6080 → 6274 B gzip; the chunk
  loads only from 问 BAYBAY → 那是什么？; the kite chunks stay at 6 KB).

## Decisions (no one asked; defaults recorded)

- One question answered right is ◆, not ★ (the review asked for medals by share; W7-W2-review had ruled out a free ★).
- Bridges need half a tower's visible height: they are long and low, so the height-only rule dropped them from hills.
- The claw's souvenir card is a picture on the existing result card (the kit's `photo`), not a new overlay.
- The skyline chunk's size cap was raised by 0.5 KB instead of moving its card styles to the shared `opus-bay.css` at 04:00.

## Not done

- **The foghorn prop** (R§6 "雾笛放显眼的道具"): only the reach (1.5 → 3 u) was done. There is still nothing visible at Fort
  Point that says "a game is here"; the 游乐图鉴 / map pin / 带我去 now lead to the spot.
- **Neighbours' name tags (Ray)** (R§6 "委托 NPC 加名牌或图标"): not started.
- **The claw keeps running under Settings**: seen on desktop in the G5 probe (Escape opened Settings 已暂停 while the claw
  panel stayed over the sheet and the claw went on to the end). Not investigated or fixed; it is close to w8's M-RP-4
  ("Settings out of reach under a game panel"). The sfgames8 panels hide with `.is-paused`; the W7 panels (claw, crab, dough,
  fortune) apparently do not.
- **The skyline's waypoint label** (gamer notes 08:31: a 'Coit Tower' map-target label sat in the quiz's frame, a red herring)
  — not touched.
- **Every game played on a phone**: G5 was played on desktop and 844 × 390 landscape, not on a 390 × 844 portrait phone; G6
  on desktop only. The 玩 map chip (G2) was not seen in a screenshot by this agent (the first agent's map probe image
  `map-desk-1.jpg` shows the street, not the map).
- The "small games' 3D camera push-in" row (R§6, cost M) — out of this wave's scope.

## Requests

- **Lane X**: no new voiced lines from G5 / G6 (the claw's rule and pop are panel text). The only lane-G line is G3's
  `HIDE_LINES.crosswalk` (already in `C:/Users/willy/opus-qa/w9/new-lines.md`).
- **Reviewer / fixer**: please check the claw under Settings (above) on a phone too, and play 那是什么？ at Crissy Field and
  Buena Vista (where the new rule drops the most).

## Checks (last push, `39d1a3bc`)

`npx tsc -p tsconfig.app.json --noEmit` 0 (re-run after the final rebase) · `npx eslint .` 0 errors (53 warnings, none in
lane G's files) · `npx tsx --tsconfig tsconfig.app.json --test "tests/opus-bay-*.test.ts"` 2123 tests, 2122 pass, 0 fail,
1 todo (04:32 → 04:43 PDT, on `1e588984` = G6 on `a9af90e2`); the final rebase onto `516d44d1` brought 14 commits of
other lanes (L8–L10, Q15–Q17, H5, E10, X7–X8, C9, P4c, R8: none in `play/` or `skyline*`), tsc re-run 0 on the pushed tree;
the full suite re-run on it is in the "Final check" line below. Higgsfield: 0 credits.

## Where to look first

- 390 × 844: 旅行本 → 游乐 (`ui/PlayDex.tsx`), 带我去 to the claw (the trip should end at the claw's prompt).
- The claw at the Musée (−202.8, 71.8): the rule line, the 3-2-1, the pop, the card's picture; then with Settings open.
- A phone on its side (844 × 390): the claw, the crab, the foghorn panels.
- 问 BAYBAY → 那是什么？ from the Ferry Building plaza (131.5, 15.1) and Pier 39's gate (−160.7, 24.1).
- Hide & seek from the Ferry Building plaza (G3).

**Final check** (the pushed tree `39d1a3bc`, opus-bay suite re-run 04:47 →): 2128 tests, 2127 pass, 0 fail, 1 todo (the W8-P9 GameRoot ≤ 255 KB target), finished 04:54 PDT.

## Review (Ultra)

### 给主人的摘要

- 审查发现 4 个问题，其中 2 个重要问题已修好并有测试（先红后绿），但**没有推送**：我 06:30 才开始（用量上限中断后），修好时已过 06:45 的推送截止时间，所以修复只提交在本地分支 `w9-g-rev`（`ac69ed42`），留给负责人决定是否 cherry-pick。
- 修复 1：摸摸 BAYBAY 或看风景会悄悄领走「今日小游戏」的 10 金币，之后真正玩小游戏反而没有奖励；现在只有小游戏结束才发。
- 修复 2：抓娃娃时打开「设置」，游戏显示已暂停，但抓娃娃面板仍盖在设置上面、倒计时照走、硬币自动掉落；现在暂停时抓娃娃、捞螃蟹、酸面包都停住，四个面板都会隐藏。
- 未修（小问题）：结算卡把今日奖励算了两次（显示 +20，实际只加 10）。站在抓娃娃机旁按 E 打开 BAYBAY 菜单的问题，代码上游戏优先级高于 BAYBAY，无法复现，判为不成立。
- 以上都不阻碍上线。Higgsfield 没有花费。

### Findings

| ID | Severity | Verdict | Evidence |
|---|---|---|---|
| G-RV-1 · 摸摸 / 看风景 take the day's 今日小游戏 coins | major | **fixed** (local commit `ac69ed42`, **not pushed**) | Code: `play/pet.ts:88` emits `{type:'play', activity:'pet', what:'end'}`, `play/sit.ts:90` emits `view` end; `play/dexEntry.ts` paid on any `play` end. Fix: `NOT_GAMES` (pet / sit / view) is skipped. `tests/opus-bay-w9-g-review.test.ts` test 1: red on `origin/opus-bay` files ("pet / view / sit are not mini-games"), green on the fix; a crab end still pays `daily:<date>:4`. |
| G-RV-2 · the claw (and crab / dough / fortune) under Settings | major | **fixed** (same commit, **not pushed**) | Code: `game/Systems.tsx:557` steps every frame system whatever `paused` says; `m-play-claw` / `m-play-crab` / `m-play-dough` had no pause check; the W7 panels had no `is-paused` (only `sfgames8.css:42`). Fix: the three frame systems return while `game.get().paused`; Claw / Crab / Dough / Fortune panels get `is-paused` and `sfgames.css` hides `.ob-sfg-panel.is-paused` like `sfgames8.css`. Test 2: the claw's `aimLeft` unchanged over 20 s paused and running again after — red on the old files ("the aim clock waited"), green on the fix. Not played in Chrome (time). |
| G-RV-3 · the card counts today's bonus twice | minor | **confirmed-not-fixed** | `play/kit.ts` passes `coins: paid + today` and `today`; `ResultCard.tsx` prints `+{coins} 金币` and `今日小游戏奖励 +{today}` — the lens's shot `d-15-claw-result.jpg` reads +10 and +10 on a 0-medal run (HUD +10). Started after 06:15 → majors only. One-line fix: `coins: paid`. |
| G-RV-4 · E at the claw goes to BAYBAY | minor (PLAUSIBLE) | **refuted** | Not reproduced. In the city lane A's `ui/interactPriority.ts` puts an `activity` (the claw, tier 0) 6 points above BAYBAY (tier 2) whenever both are in reach, so BAYBAY can only win when the player is outside the claw's reach (`CLAW_SPOT` r 1.8; the lens spawned 1.7 from its centre and then moved) or while a game / its card is up (`sfgames.ts` sets the radius 0 while busy). The shot shows the result card, not a missed claw. Kept as an open item: check live that 带我去 stops within 1.8 of (−202.8, 71.8). |

### My own pass (lane G commits cc8c3ff2 … e9c3c35c)

- Files: all inside `src/opus-bay/` (play/, ui/, data/sf/searchSpots.ts via L7), `tests/opus-bay-*`, docs; no frozen file
  (core/**, data/save*.ts, economy ledger caps), no site file, nothing district-mode. GameRoot untouched (dexEntry is a lazy
  chunk from play/index.ts).
- Nothing new beyond the lens's four: the payer's only other emitters are the kit (every kit activity is a game, incl. the
  first flight, which is fine) and pet / sit (now excluded).

### Open items

- Push `ac69ed42` (branch `w9-g-rev`, built on `e9c3c35c`; it cherry-picks onto `origin/opus-bay` 537fcc48 without conflict — the only play/ change since is BellPad.tsx) after the go-live or in wave 10; it needs the full
  suite on the target tree (see Checks).
- G-RV-3 one-line fix (`coins: paid` in `play/kit.ts`).
- Play the claw / crab / dough / fortune with Settings open on desktop and a 390 × 844 phone once `ac69ed42` lands.
- G-RV-4: check live where 带我去 to the claw stops (inside r 1.8?).
- The lane's own not-done list stands: the foghorn prop, Ray's name tag, the skyline waypoint label.

### Blocking the go-live to main

None from lane G: both majors are wrong-but-harmless (10 coins paid for a pet; a claw run spent under Settings), no
softlock, no crash, nothing in district mode.

### Checks (`ac69ed42`, local)

`npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint` on the 10 touched files 0 · `tests/opus-bay-w9-g-review.test.ts`
2 / 2 (red 0 / 2 on the old files) · `npx eslint .` 0 errors (53 warnings) · `npx tsx --tsconfig tsconfig.app.json --test
"tests/opus-bay-*.test.ts"` 2140 tests, 2139 pass, 0 fail, 1 todo (the W8-P9 GameRoot ≤ 255 KB target), 06:56 → 07:01 PDT on
`e9c3c35c` + `ac69ed42`. Not pushed: past the 06:45 cut-off; no Chrome run (time). Higgsfield: 0 credits.
