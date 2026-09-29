# Wave 5 · final verify (W5-Z), 2026-09-28

The lead's final verify of wave 5 (plan `sf-w5-plan.md` §4.14), run alone on the owner's machine in the worktree
`C:/Users/willy/wt/w5-verify` (dev server 5520, phone package on the lead's preview 4174), on `origin/opus-bay`
`958dee58` (every lane and every review pushed; nothing new upstream during the run). Raw output:
`C:/Users/willy/opus-qa/w5z/` (perf tables, sweep JSON, logs, every shot).

## 给主人的摘要

1. **全部检查通过**：全站检查（代码规范、2076 个测试、构建、预渲染 307 页、282 张分享卡）和小游戏自己的 1356 个测试都是绿的。
2. **性能达标**：电脑版 20 个点位 + 3 段乘车 + 夜晚 + 活动日全部 60 帧，最多 119 次绘制、35.2 万三角形（上限 150 / 40 万），没有超过 100 毫秒的卡顿；手机模拟（390×844、中画质、CPU 降速 4 倍）23 项最低 52.8 帧，0 次卡顿；换成较弱的 AMD 集显也通过；手机自动选"中"画质。第一次手机测试有卡顿帧，查明是测试脚本没去点鹈鹕对话框、BAYBAY 在后台反复找路（真实玩家不会遇到），修好脚本重测全部通过。
3. **全城巡检**：684 个点，被围死 0、卡脚 0；只剩 2 个次要点（模型外的索萨利托码头、三级景点奥布莱恩号导航差 4.8 格）。中期检查时是 19 个走不到、14 个被围。一级景点、观光巴士和地铁站、开局 20 分钟的路线上全部能走。
4. **你的五点（手机正式包实测）**：① 四种落地后 0.6–0.9 秒就能走；② 金门大桥桥面从头走到尾、观光巴士整整一圈 16 站约 16 分钟没停过、以前卡住的 3 个地方都走得开；③ 开局第一个目标就是鹈鹕，约 1 分钟到科伊特塔解锁，第一次飞行 8/8 金圈，之后"起飞"按钮一直都在；④ 地图上点两下就出发；⑤ 捡金币、右上角金币数、小铺、给 BAYBAY 买国际橘围巾当场戴上。
5. **验收时新发现并修好 2 个手机问题**：金门大桥人行道靠栏杆的边上有一排小"坑"，手指斜着推摇杆会掉进去卡死（只能起飞出来），现在边缘当墙、顺着走；桥上弹出的"小发现"卡片挡住左手摇杆区，手指按上去走不动，现在拖动照样走、轻点才打开卡片。
6. **默认世界已切换成"全城"**：直接打开 /opus-bay 就是整个旧金山；加 `?world=district` 仍是原来的 Embarcadero 街区，完全没变。手机包已按新版本重打。

## Setup

- Machine: Ryzen 9 5900HX, RTX 3070 Laptop (`CHROME_FLAGS=--force_high_performance_gpu`), AMD Radeon iGPU (no flag) for
  the second phone run; Chrome 153 headless. Before anything ran, an **orphaned headless QA Chrome** (an `opus-shot`
  profile from 2026-09-27 06:32, restored after a restart) was still rendering `sites3-preview.html?quality=high` on
  :5307 at ≈ 0.4 core; it was stopped. Nothing else ran afterwards (other lanes idle; the lead's servers 5174 / 4174
  untouched but for the phone package rebuilds).
- PERF-LOCK `C:/Users/willy/opus-qa/w5/PERF-LOCK` held 00:02–00:53 UTC (the gate) and 00:55–01:32 UTC (the phone
  diagnosis and re-run); removed.
- Phone profile = 390 × 844, `--mobile --dpr 3`, touch, `--lang=zh-CN`. The five were played on the **production
  build** (`vite build --config vite.opus.config.ts --outDir C:/Users/willy/opus-qa/dist-phone`, served on 4174); a
  production bundle has no `__opusBay`, so positions came from the `?debug=1` panel (2 Hz) and the save; the new-player
  run (F3, F5) ran without `?debug` (debug unlocks the pelican).

## 1. Checks

| check | before the W5-Z changes (`958dee58`) | after (`a2ca9204`) |
|---|---|---|
| `npm run check` (eslint · all tests · build · prerender · share cards) | EXIT 0: 0 errors (43 old warnings) · **2073 / 2073** · built · 307 pages · 282 cards verified | EXIT 0: 0 errors (43) · **2076 / 2076** · built · 307 pages · 282 cards |
| `npx tsc -p tsconfig.app.json --noEmit` | 0 | 0 |
| opus-bay suite (`tests/opus-bay-*.test.ts`) | **1353 / 1353** | **1356 / 1356** (hero regression, district, contracts green) |
| GameRoot (phone package, gzip as vite reports) | 298.36 KB | 298.62 KB (target ≤ 265: open, §7) |

The build's exports rewrite `public/*.json` with CRLF line endings only (no content change); they were restored.

## 2. The perf gate (plan §4.9), `scripts/opus-sf/qa/perf/w4-perf.mjs --file w5-spots.json`

Tables: `C:/Users/willy/opus-qa/w5z/perf/{desk,night,fair,jets,phone,phone2,igpu,igpu2}/w4-perf.md`.

### Desktop 1440 × 900, quality high, RTX — all pass

| spot / ride | calls | triangles | fps idle / walk (ride) | > 100 ms |
|---|---|---|---|---|
| ferry-gate | 104 | **352k** | 60.1 / 60.1 | 0 |
| chinatown | **119** | 276k | 60.1 / 60.1 | 0 |
| twin-peaks | 110 | 301k | 60.1 / 60.1 | 0 |
| civic-center | 83 | 258k | 60.1 / 60.1 | 0 |
| union-square | 85 | 300k | 60.1 / 60.1 | 0 |
| music-concourse | 91 | 243k | 60.1 / 60.1 | 0 |
| stonestown-sfsu | 74 | 294k | 60.1 / 60.1 | 0 |
| haight-usf | 80 | 270k | 60.1 / 60.1 | 0 |
| ocean-beach | 63 | 173k | 60.1 / 60.1 | 0 |
| ggb-south | 64 | 195k | 60.1 / 60.1 | 0 |
| mission | 86 | 312k | 60.1 / 60.1 | 0 |
| grace-nob-hill | 101 | 319k | 60.1 / 60.1 | 0 |
| powell-market | 112 | 308k | 60.1 / 60.1 | 0 |
| fidi | 91 | 325k | 60.1 / 60.1 | 0 |
| ggb-deck | 47 | 96k | 60.1 / 60.1 | 0 |
| hellman-hollow | 86 | 222k | 60.1 / 60.1 | 0 |
| marina-green | 71 | 229k | 60.1 / 60.1 | 0 |
| castro | 74 | 294k | 60.1 / 60.1 | 0 |
| filbert-steps | 84 | 300k | 60.1 / 60.1 | 0 |
| pier45 | 106 | 329k | 60.1 / 60.1 | 0 |
| ride bus-palace | 71 | 217k | (60.1) | 0 |
| ride n-duboce | 78 | 254k | (60.1) | 0 |
| ride m-west-portal | 68 | 222k | (60.1) | 0 |
| **night** irving-night (`--time night`) | 96 | 296k | 60.1 / 60.1 | 0 |
| **event** hellman-hollow (`--date 2026-10-04T12:00`) | 68 | 211k | 60.1 / 60.1 | 0 |
| **event** castro (same) | 73 | 289k | 60.1 / 60.1 | 0 |
| **event** marina-green (`--date 2026-10-09T12:40`, jets) | 77 | 148k | 60.1 / 60.1 | 0 |

Programs first = last in every session: 60 → 60, 78 → 78 (the 78 is the warm-up's background pass for the next quality
level, lane V's note); p95 16.7–16.8 ms everywhere. Max 119 calls / 352k triangles: headroom 31 calls / 48k.

### Phone profile 390 × 844, dpr 3, quality mid, 4× CPU — all pass (run 2)

| spot / ride | calls · tris | RTX fps idle / walk (ride) | > 100 ms | iGPU fps idle / walk | > 100 ms |
|---|---|---|---|---|---|
| ferry-gate | 83 · 274k | 60.1 / **54.5** | 0 | 60.1 / **53.4** | 0 |
| chinatown | 96 · 231k | 60.1 / 58.2 | 0 | 60.1 / 56.5 | 0 |
| twin-peaks | 75 · 198k | 60.1 / 60.1 | 0 | 60.1 / 60.1 | 0 |
| civic-center | 67 · 205k | 60.1 / 58.3 | 0 | | |
| union-square | 68 · 167k | 60.1 / 58.5 | 0 | | |
| music-concourse | 73 · 157k | 60.1 / 59.5 | 0 | 60.1 / 59.5 | 0 |
| stonestown-sfsu | 62 · 175k | 60.1 / 60 | 0 | | |
| haight-usf | 80 · 200k | 60.1 / 59.9 | 0 | | |
| ocean-beach | 42 · 86k | 60.1 / 60 | 0 | 60.1 / 60.1 | 0 |
| ggb-south | 47 · 87k | 60.1 / 60.1 | 0 | | |
| mission | 70 · 240k | 60.1 / 59 | 0 | | |
| grace-nob-hill | 89 · 281k | 59.7 / 58.3 | 0 | | |
| powell-market | 83 · 235k | 60.1 / 58.7 | 0 | | |
| fidi | 80 · 227k | 60.1 / **52.8** | 0 | | |
| ggb-deck | 42 · 85k | 60.1 / 59.6 | 0 | | |
| hellman-hollow | 55 · 144k | 60.1 / 59.5 | 0 | | |
| marina-green | 58 · 119k | 60.1 / 59.6 | 0 | | |
| castro | 57 · 207k | 60.1 / 56.3 | 0 | | |
| filbert-steps | 78 · 252k | 60.1 / 54.8 | 0 | | |
| pier45 | 91 · 278k | 59.5 / 60.1 | 0 | | |
| ride bus-palace | 60 · 173k | (59) | 0 | (59.2) | 0 |
| ride n-duboce | 56 · 186k | (59.7) | 0 | | |
| ride m-west-portal | 55 · 173k | (60.1) | 0 | | |

Programs first = last per session (RTX 76 → 76 and 58 → 58; iGPU 58 → 58). Lowest 52.8 fps (≥ 45: pass).
**Auto quality on the phone profile** (no `?quality`): dev server `quality mid`, pixel ratio 1.25, canvas 487 × 1055;
production `?debug=1` panel `q mid (device)`.

**Run 1 failed on frames > 100 ms, and it was the harness.** The first phone run (same tree) passed every fps figure
(min 54.7) but 11 spots showed 3–5 frames over 100 ms, from the fourth spot of the session on (0 in the second session;
iGPU run 1: Ocean Beach 4). Diagnosis on the dev server, phone profile, 4× CPU: Long Animation Frame entries every
≈ 4.4 s of 145–197 ms, all inside R3F's frame loop; a CPU profile of the long runs: `actors/guide.ts plan` →
`actors/nav.ts findPath` 473 ms + `buildWindow`/`fillCityNavGrid` 80 ms over 4 long runs in 14 s. BAYBAY's state: `talk`,
target (130, 922) — the **Twin Peaks spot**, 370 u away: the pelican moment opens there (a viewpoint unlocks the pelican)
and the gate hides the HUD, so nobody answered it; after each teleport she hopped in and walked back to it, re-planning.
Closing the dialogue: 0 runs over 60 ms in the next 14 s profile. `w4-perf.mjs go()` now answers an open dialogue before
each teleport (`b61979f5`, a player cannot leave a dialogue open and travel); run 2 above is with it.

## 3. The walker sweep (lane F's tools)

**Static** (`sweep-static.mts`, node, the published city; re-run after the W5-Z changes: identical):

| | run 1 (lane F part a) | mid-wave checkpoint (part b) | lane F run 2d | **W5-Z** |
|---|---|---|---|---|
| targets | 672 | 673 | 684 | **684** |
| ok · CORRIDOR | 454 · 162 | 483 · 153 | 547 · 135 | **547 · 135** |
| BOXED · SNAG | 26 · 5 | **14** · 2 | 0 · 0 | **0 · 0** |
| UNREACHABLE · OFF | 21 · 4 | **19** · 2 | 1 · 1 | **1 · 1** |

- Left: `trip:ss-jeremiah-obrien` (T3, UNREACHABLE: moves 3 of 4 ways, the nav path ends 4.8 u short — a tap-to-walk
  stops short of it) and `ferry:sausalito` (OFF: the quay is off the model). Neither is flip-critical.
- **Flip-critical groups**: the 16 tier-1 trip ends — 12 ok, 4 CORRIDOR (the Wharf, the Ferry Building marketplace, the
  Dragon Gate, Stonestown: a street or arcade between buildings, two ways open), 0 stuck / unreachable; the 71 loop and
  Metro stops — **71 ok**; the first-20-minutes path (the Ferry gate, the pelican goal to Coit, the first flight's
  landings to PIER 39, the Grand Tour chapter 1: the Ferry and GGB loop stops, the Welcome Center, Fort Point, the deck,
  route r1, the Filbert / Coit coins and views: 49 targets) — 22 ok, 27 CORRIDOR (the deck's points, stairs, the steps),
  0 stuck / unreachable. CORRIDOR is lane F's "reported, not a failure" (the plan's strict STUCK counts it).
- **Live, desktop** (`walker-sweep.mjs`, the real game): the 113 flip-critical targets replayed (T1 trip ends, every
  loop / Metro stop, the first-20 path, the two left): under the plan's strict rule (3 of 4 camera-relative pushes of
  1.5 s ≥ 3 u) 23 flag, every one of them a street, sidewalk or stair corridor with at least one way ≥ 5 u, except
  `ferry:sausalito` (OFF) and `trip:golden-gate-bridge` pushed from its raw point (0 · 0 · 0 · 5.5: the walker teleports to
  the unsnapped point by a wall; the real 飞过去 landing there walked 13.9 u at once, §4 F1). List:
  `C:/Users/willy/opus-qa/w5z/sweep/live-desk/live.json` and `sheet.html`.
- **The deck** (walker `--deck`, desktop): south → north and back both reached, slowest 3 s **4.16 u/s** both ways,
  camera ≤ 1° off the axis, 0 pulls.
- **The three routes** stop to stop (tap-to-walk): 23 / 24 legs; r2 Welcome Center → the overlook ran past 2.5× its
  straight-line time on the winding path (not stalled, 18 u left) — the same leg lane F reported slow.

## 4. The owner's five on the phone (production package, 390 × 844, touch)

### F1 · walk within 1 s of a landing — pass

| landing | control back → first reading ≥ 1 u away (stick pushed at once) | afterwards |
|---|---|---|
| first flight's end (a new player, no debug) | walked on at once (the save's position moved 40 u in the next 3.5 s) | 起飞 visible 24 / 24 samples |
| pelican glide, 降落 (Embarcadero) | **0.62 s** (2.6 u) | 13.1 u in 2.7 s |
| 飞过去 → the Palace of Fine Arts (first visit, T1) | **0.91 s** (2.6 u) | faces the lagoon: forward stops at the water; back / left 12 u |
| 飞过去 → Sutro Baths (T1; the scout's F1 freeze and ledge) | **0.94 s** (1.1 u) | forward is the ruins' edge; right 10.6 · back 5.0 · left 6.2 u |
| 飞过去 → the Golden Gate Bridge (T1; the scout's Welcome Center freeze) | **0.58 s** (2.6 u) | 13.9 u in 2.7 s |
| the bus lap's hop-off at the Ferry Building | walked 10.8 u in a 1 s push | |

(The production bundle cannot read the lock watchdog; no landing needed a dialogue to move.)

### F2 · walking — pass after the W5-Z deck fix

- **The GGB deck end to end.** Before the fix the phone found a trap three times near the south tower: at
  (−778.2, 575.9) and (−778.8, 581.1), 0 u in 8 directions, no BAYBAY pull, only 起飞 got out. Cause: at the rails
  `heightAt` blends the deck's cells with the water under them (0.5 u cells across a deck at an angle), so both
  sidewalks' outer half carry hundreds of 0.25–0.5 u dips 0.4–1.8 u under the deck; a thumb held 30–45° off the axis
  (the deck steering keeps a third of it) walks the body to the rail, into a dip, and the ground round it is too steep to
  step out. Reproduced on the dev server (stick up-right 45° from s 60: stuck at s 106) and in node (stopped at s 119.6,
  y 14.77). Fix `78efcf32` (below). After it, production: **stick held up-right 45°, one touch: s 7.6 → 411 (the north
  end) in 60 s** along the east rail; **down-left 45°: 411 → 92 in 60 s** along the west rail, then off the south end;
  dev: all four diagonals past the tower; node: four held-off-axis walks both ways reach the far end, never under the deck.
  Also seen: a 小发现 card popping up on the deck (lane D's sea-otter egg) sat over the left thumb; a thumb that came down
  on it walked nowhere and kept it open — fixed too (a drag started on the card walked 12.9 u, a tap opened it).
- **A bus lap**: boarded the loop at the Ferry Building (坐一圈，约 15 分钟), all 16 stops round to the Ferry Building
  again in ≈ 15.9 min (1.06× the quote), never stood still 20 s, no 车停住了 (目标 2/10 → 3/10 on the way).
- **Three former stuck spots**: Sutro Baths (the scout: 3 of 4 directions < 1 u) → right 10.6 · back 5.0 · left 6.2;
  Fort Point (BOXED at the checkpoint) → 6.6 · 1.5 · 11.0 · 8.6; Irving & 2nd N stop (run 2b: no open ground within 6 u)
  → 7.0 · 0.95 · 13.1 · 0.45 (a sidewalk along Irving: both ways open). Plus the GGB Welcome Center (F1 above).

### F3 · the pelican first — pass

New player, no debug: 开始 → 我自己逛逛 → the goals step's first goal **先去科伊特塔找鹈鹕朋友 · 解锁：随时飞** with
**跟 BAYBAY 去找鹈鹕 · 约 40 秒** → carried → the pelican moment at Coit **49.8 s** later (≈ 62 s after 开始), 🪙 57 →
试试起飞 → 抓稳啦，我们出发！ → the chip's 起飞 → the first flight **8 / 8 rings** in ≈ 47 s (太棒了 · +30 金币), landing at
PIER 39 → walked on, and **起飞 visible in 24 / 24** on-foot samples (walking and standing, BAYBAY near).
(A scripted pilot that pushed "up" climbs over the rings — stick up is climb in the glide; steering only flew 8 / 8.)

### F4 · map to moving in ≤ 2 taps — pass

Open map → the 唐人街龙门 badge (tap 1) → the pinned card's **BAYBAY 带路 · 约 30 秒** (tap 2) → the map closed and the
player was moving **0.5 s** later (BAYBAY 带路中 · 碰摇杆接管); the stick took over (8.9 u) and 自动跟上 BAYBAY appeared. A
search row's go button is also one tap (艺术宫 · 飞过去 约 6 秒, 金门大桥 · 约 7 秒).

### F5 · coins, the pill, the shop, a wearable — pass

The pill 明信片 0/24 · 目标 1/10 · 🪙 n on the phone; coins 0 → 57 by the pelican moment → 119 after the first
flight's rings and medal; 更多 → 小铺 → 国际橘 围巾: BAYBAY turns to show it (try-on) → 买下 · 🪙 70 → 49, 穿着; the save
holds `play.w.baybay-scarf = 2`; BAYBAY wears the orange scarf in the world; a coin picked up on the walk after (49 → 52).

## 5. What W5-Z changed

| commit | what | files |
|---|---|---|
| `b61979f5` | the perf gate answers an open dialogue before each teleport | `scripts/opus-sf/qa/perf/w4-perf.mjs` |
| `78efcf32` | the GGB deck's ragged edge: `deckDip` (a step down into a dip between the rails is a wall the step slides off toward the axis; blocked where even that drops), `laneClear` treats a dip ahead as a blocked lane, a body past the rail clearance is eased back in (district mode: no deck registered, unchanged); the compact find card joins `THUMB_PASS` + the coarse-pointer CSS (a drag steers, a tap opens) | `actors/{deckSteer,controller,pointer}.ts`, `opus-bay.css`, `tests/opus-bay-w5-final.test.ts` (new: 2 tests, the deck one red before the fix) |
| `a2ca9204` | **the default world is the city** (below) | `core/store.ts`, `OpusBayPage.tsx`, `tests/opus-bay-contracts.test.ts` (+1 W5-Z test) |

## 6. The default-world decision: **flipped to the city**

The rule (the brief): every perf gate passes · F1 passes · `npm run check` green · the sweep has no stuck or unreachable
target among the tier-1 attractions, the loop / Metro stops and the first-20-minutes path. All four hold (§1–§4; the
static sweep's two left are a T3 and an off-model quay).

- `DEFAULT_WORLD_MODE = 'city'`: `/opus-bay` without `?world` opens San Francisco (title 跟 BAYBAY 逛整座旧金山…, welcome
  嗨！欢迎来到旧金山～, the page title 湾区小旅 · 跟 BAYBAY 逛旧金山｜BAYLINK). `?world=district` opens the Embarcadero district:
  title 跟 BAYBAY 从渡轮大厦走到 PIER 39…, 欢迎来到湾区, the 7-stop tour, `Postcards 0/8 · Goals 0/5`, the title
  diorama drawn with the same 71 calls / 225,070 triangles / 262 objects / 66 programs as before the flip, free roam the same
  framing and HUD (desktop), and the hero regression green.
- Node (tests and QA scripts, no `location`) keeps the district (`NODE_WORLD_MODE`), as `data/contentMode.ts` documents
  and the G2-0 test pins; no other test changed. The contracts test gains `W5-Z: a page without ?world opens the city…`.
- QA scripts that load the page already pass `?world=city` (perf, walker, budget views); a district check now needs
  `?world=district` (`scripts/opus-shot.mjs`'s default URL opens the city).
- The phone package (4174) was rebuilt after the flip and again after the deck fix (GameRoot 298.62 KB gzip).

## 7. Open (owners named)

1. **GameRoot 298.62 KB gzip vs ≤ 265** (plan MF9): lane V's review lists the levers (F's city-only actor modules, C's
   POI bodies / script / residents, N's city-only modules). Lead.
2. **The floating stick's base is kept relative to the canvas rect**: a CDP screenshot during a held touch shifted the rect
   for a frame, the base followed the finger, and the stick's reading flipped (moveY +1 → −0.99): the player turned back.
   Only seen with the harness, but an iOS toolbar resize mid-touch could do the same. Lane F: keep the base in client
   coordinates (or skip a move whose rect changed).
3. **Lane D**: the sea-otter egg (`baybay-otter-roots`, "the water by the fort under the bridge", kind ground) fires on the
   GGB deck 15 u above it (its 2D proximity), s ≈ 114–124.
4. **Deck feel**: a thumb held ≥ 60° into the rail stops against the edge (not a trap: straightening walks on); held at
   45° the slowest 3 s reads 2.0–2.4 u/s round the towers (MF2's 3 u/s is for holding forward: 4.16 walking, 7+ running).
5. **BAYBAY's far talk target**: with a dialogue left open across a teleport she re-plans a long `findPath` every ~4 s
   (≈ 30 ms at 1×). Harness-only today; a guard (drop the talk target on a far hop-in) would close it. Lanes F / C.
6. The static sweep's two: `ferry:sausalito` (T: a waiver or a quay on the model), `trip:ss-jeremiah-obrien` (N).
7. Wording: the shop's 国际橘 vs the GGB lines' 国际橙 (lane F's review) — one name in `data/VOICE.md`'s glossary.
8. Not done here: a real iPhone pass (no device), the Grand Tour timed end to end, `sf-w5-summary.md`, the ledgers into
   `ASSETS-LEDGER.md`, `STATUS.md` / `RESUME.md` (they still call the flip future work), `vercel.json` (CSP, `/opus-bay`
   route; the branch is not deployed) — the lead's wrap-up.

## Files

- QA images (`docs/opus-bay/qa/w5/final/`, every one read): `z-f3-pelican-first-phone.jpg` (the goals step, the pelican
  moment, a ring, 太棒了 8/8, 起飞 after landing), `z-f2-ggb-deck-phone.jpg` (the trap before the fix, the find card
  compact and opened, the north end reached with the stick at 45°), `z-f2-bus-lap-sutro-phone.jpg` (the night lap, 到站：渡轮大厦,
  the Sutro landing), `z-f4-f5-map-shop-phone.jpg` (two taps to moving; the scarf tried on, bought, worn),
  `z-flip-city-default-district-phone.jpg` (`/opus-bay` → the city; `?world=district` → the district).
- Scratch: `C:/Users/willy/opus-qa/w5z/` (perf, sweep, sweep-after, district, shots, tools, logs).
