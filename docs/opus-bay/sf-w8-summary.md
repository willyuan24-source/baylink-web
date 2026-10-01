# Wave 8 · summary and hand-off

Written 2026-10-01 ≈ 05:05 PDT by the hand-off agent in `C:/Users/willy/wt/w8-handoff`. Sources: the plan / lead note
`sf-w8-lead.md` (incl. §7, the switch to one Ultra workflow), the ten lane reports `sf-w8-{K,Q,P,A,H,S,W1,W2,M,X}.md` (each
with its `## Review (Ultra)`), `sf-w8-integration.md` (W8-I and `## Completeness pass`, W8-C), `sf-w8-final-verify.md`
(W8-Z), the ledger `ledger/w8-X.md`, the workflow journal of run `wf_66c65596-f6a` (47 agents: every lane, lens, fixer,
W8-I lens and fixer, the critic, W8-C and W8-Z, with their structured results; start / end times from the agents'
transcripts beside it), `git log 889cc614..90c6859e`, the lead's go-live check logs
`C:/Users/willy/opus-qa/w8/golive-check{,2,3}.txt`, and Higgsfield's `balance` / `transactions` (read only, 2026-10-01
≈ 05:00 PDT).

**Go-live:** on W8-Z's GO (`8e3e8e72`, 04:52 PDT) the lead merged `origin/main` (**W8-0g** `0d9093f5`, GPT's six site
commits), mapped the 7 Oct SF Zoo resident free day (**W8-0s** `a1cc3f60`: `live.json` re-exported, 15 SF offers), ran the
full `npm run check` on that tree — red on one test, W5-R7 counting the SF offers (15 ≠ 14) — made the test follow the zoo
row (**W8-0t** `90c6859e`), ran the check again (**EXIT 0**: eslint 0 errors, 2933 tests, 2932 pass, 0 fail, 1 todo;
prerender 589 pages; 564 share cards verified) and fast-forwarded `main` to **`90c6859e`** (= `opus-bay` before this
hand-off) at ≈ 05:15 PDT (`origin/main` read `90c6859e` at 05:17). **The deploy is to be confirmed by the owner**: the
lead's curl of the live site is refused by a permission check.

## 给主人的摘要

1. **第八波已经上线**（凌晨约 5:15，main 快进到 `90c6859e`，上线前的全站检查全绿）。自动检查网站被权限拦住，请你打开 https://www.baylink.us/opus-bay?start=free&at=xz:-94,-21.8 看一眼：人站在 33 号码头、旁边有坐渡轮去恶魔岛的提示，就说明新版已经上去了。
2. **坐船去恶魔岛**：33 号码头上小渡轮（约 90 秒，BAYBAY 一起上船），岛上从码头走台阶到监狱楼正门和灯塔平台，到达有印章和金币，再坐船回来。班次照官网时刻表，晚上船在码头休息；人在岛上时船随时来接，不会被困。
3. **三个新小游戏**（都有 BAYBAY 配音）：鲍威尔街叮当车「拉闸」、海特街和 24 街跟街头艺人合奏、Fort Point 旁的金门大桥雾笛对答。
4. **更多旧金山**：唐人街宝塔楼群（Sing Chong、Sing Fat、老圣玛利亚教堂、华人电话局）；35 号码头的自由轮奥布莱恩号（全城最后一个走不到的地方，现在能走到）；西边海洋海滩的冲浪小人和海豹岩、蓝鹭湖的小船和船屋、圣依纳爵教堂的铅灰圆顶；电车、缆车、观光巴士更精致，金门大桥的塔夜里亮着。
5. **真实日子和万圣节**：10/9 舰队周「舰船巡游」（11:00–12:00，红色消防船领头，灰色玩具军舰从金门大桥下开到海湾大桥，拍到有纪念章）；10/31 唐人街万圣节庆典（Waverly 巷挂满红灯笼、小朋友变装比赛）；亡灵节游行的小人会迈腿、会让路；讨糖的小孩会跳；六条讨糖街的门都检查过；鹈鹕新衣服南瓜领结；10/7 动物园 SF 居民免费日上线时也补进去了。
6. **上一波留下的大问题都修好了**：小游戏面板、明信片打开时 BAYBAY 不再插话；英文版不再夹中文；手机坐地铁时能打开设置，地图按钮够大；坐海德街缆车时路边树冠不挡人；万圣节 10/1 已自动开始。
7. **检查结果**：审查员一共提了 93 条意见，修好 83 条，8 条留到第九波（都不挡上线），2 条不成立；整合试玩又提了 21 条，修好 16 条。全站检查自第六波以来第一次全绿；电脑全部 60 帧，手机没有超过 100 毫秒的卡顿；全城 699 个点 0 个走不到；首屏主包 258.04 KB。Higgsfield 只花了 5.44 分（全是配音），余额 357.27。
8. **请你有空时做**：① 确认上线（第 1 条）；② 用真 iPhone 玩 5 分钟：电脑上先开预览 `opus-bay-phone`，手机连同一个 Wi-Fi 打开 http://10.0.0.85:4174/opus-bay，照 `docs/opus-bay/iphone-checklist.md` 做，顺便试试三个新小游戏和恶魔岛渡轮；③ 听配音：第八波 `docs/opus-bay/qa/w8/X/voice/listening.md`（两条静音的等你批准），第七、六波的试听单如果还没听也一起；④ 把网站的问题转给 GPT（§6 P0 第 4 条：iOS 16 老 Safari 白屏的正则、繁体转换把「馬里納區」写成「馬裡納區」等）。
9. 下一波说「继续 Opus Bay，做第九波」，先看本文 §6。

## 1. Wave 8 at a glance

- **Timeline (PDT, 2026-09-30 → 10-01):**

  | when | what | source |
  |---|---|---|
  | 18:40 | the owner's brief "继续 Opus Bay，做第八波" | lead note |
  | 18:41–18:50 | day 0: **W8-0c** `e5f375e6` merges `origin/main` (GPT's `f3fa187f`, `11ffcf60`, `f2f3f889`); the site's `npm test` 2634 / 2634 (GPT's "fix release checks" cleared wave 7's 4 red site tests); **W8-0d** `e869fb08` `MAX_BESTS` 32 → 64; **W8-0p** `889cc614` the plan; `balance` 363.44 | lead note §1, git |
  | 19:00–19:20 | ten lanes as background agents (W8-K1 `f1891399` 19:01, W8-K2 `76c237e6` 19:04 pushed; the others' work left in their worktrees) | lead note §7, git |
  | ≈ 19:25 | the owner: **"用ULTRA来运行哦"** — the background lanes stopped; **W8-0u** `9f024954` (§7) and the wave relaunched as one workflow **`wf_66c65596-f6a`**; every lane resumed its predecessor's worktree and kept its work | lead note §7, git |
  | 19:24 → 23:57 | the ten lanes (first done: S 22:13; last: X 23:57) | agent transcripts |
  | 22:13 → 00:51 | twenty read-only lenses (code & facts, player), two per lane as each lane ended | agent transcripts |
  | 22:55 → 01:29 | ten fixers (first S, last Q) | agent transcripts |
  | 01:29 → 02:31 | **W8-I**: three lenses (phone 5861, desktop 5862, words & site sync 5863) 01:29–02:05, the fixer 02:05–02:31 (its report says 02:05–02:45) | agent transcripts, `sf-w8-integration.md` |
  | 02:31 → 02:59 | the completeness critic (02:31–02:38), then **W8-C** (02:38–02:59; its report says to 03:05) | agent transcripts |
  | 02:59 → 04:53 | **W8-Z** alone under PERF-LOCK: **GO**, `8e3e8e72` at 04:52 | `sf-w8-final-verify.md`, git |
  | 04:54 → ≈ 05:15 | the lead: **W8-0g** `0d9093f5` (merge `origin/main`) 04:54, **W8-0s** `a1cc3f60` (the zoo row, 15 SF offers) 04:55; `npm run check` red on W5-R7 (15 ≠ 14; the first run also stopped on lint, the lead's untracked `.claude/*.js`) → **W8-0t** `90c6859e` 05:06 → the check EXIT 0 → `main` fast-forwarded to `90c6859e` | git, `golive-check{,2,3}.txt` |

  The workflow ran **19:24 → 04:53, ≈ 9.5 h, 47 agents**.
- **The workflow's shape (47 agents):** 10 lanes (K Q P A H S W1 W2 M X) → per lane, as soon as it ended, **two read-only
  lenses** in parallel (code & facts `wt/w8-<id>-rc`, player `wt/w8-<id>-rp`) = 20 → **one fixer per lane**
  (`wt/w8-<id>-rev`) that reproduced every finding before touching it (default: refuted) and appended `## Review (Ultra)`
  = 10 → **W8-I**: 3 lenses + 1 fixer (`wt/w8-int`) → the **completeness critic** (read-only: P0 status, unverified claims,
  go-live risks) → **W8-C**, a bounded fix pass (`wt/w8-cfix`) → **W8-Z** (`wt/w8-verify`). 10 + 20 + 10 + 4 + 1 + 1 + 1 =
  47.
- **Commits:** 154 from the wave-7 hand-off `94ae2ae4` to `90c6859e`: GPT's 3 day-0 site commits + W8-0c, W8-0d, W8-0p;
  then, in `889cc614..90c6859e` (148):

  | group | commits |
  |---|---|
  | lanes (90) | Q 15 · H 12 · K 11 · P 11 · W2 9 · M 9 · A 7 · X 7 · S 5 · W1 4 |
  | lane reviews, the fixers (39) | M 6 · Q 5 · H 5 · P 4 · A 4 · X 4 · K 3 · S 3 · W1 3 · W2 2 |
  | W8-I · W8-C · W8-Z | 5 · 3 · 1 |
  | the lead | W8-0u (§7) · W8-0g (the go-live merge) · W8-0s (the zoo row) · W8-0t (the W5-R7 test) |
  | GPT (site, merged by W8-0g) | 6: `263bfc43`, `25ab971a`, `b7b82ff4`, `2d9d9da9`, `f5b059ca`, `652a9975` |

- **The review:** 93 lens findings (24 major, 69 minor); the fixers received 89 (four were cut off in the relay) and
  judged 81 fixed, 6 confirmed-not-fixed, 2 refuted; W8-Z recovered the four lost ones from the journal (2 already fixed,
  2 open minors). **Nothing blocked the go-live** (every fixer's `blocking_for_go_live` is empty; W8-C's one "unknown"
  was resolved by W8-Z). W8-I: 21 findings, 16 fixed. W8-Z changed no product code, reverted nothing.

## 2. Lanes (details in each `sf-w8-<ID>.md`)

Verdicts: the lane's fixer from the journal (fixed / confirmed-not-fixed / refuted), "lost" = cut off in the relay.

| lane | built (incl. its fixer's own fixes) | review → verdicts | open |
|---|---|---|---|
| **K** BAYBAY, feel, safety | **P0** `game/baybayHold.ts` (overlay + activity hold list, city-only `baybayHeld()`) gating every unprompted line source (pacer, rumours, `baybayLines`, pelican, realsf, halloween, economy, brain, zones, pet, the emote coach); `bubble()` waits behind the Halloween postcard; no voice with a hidden bubble; the live 60 s claw proof; the bubble placed round play panels (`HUD_BOX_SELECTOR`, `placeBubble` fallback); **P0** the Hyde St canopy dither (`toyCanopy`, tagged leaves, 0 new calls); templated bubbles → fixed lines (`fixedLines.ts`, `noViewPin`, the trip's first line); `treesNear` without an iterator; the kite's hold button and 75 s quiet; fixer: one 去车站 per trip, a bubble never hidden under a panel or egg card (z 45 `data-over`), M's panels fit a rotated phone | 6 → 5 fixed, 1 confirmed-not-fixed (K-RC-3) | K-RC-3 the pelican's templated later-line (`game/pelicanFirst.ts`); a parked ride > 250 u towed only on return; the dither not played on Powell–Mason / California; play-core budget |
| **Q** phone UI & words | **P0** English never shows Chinese (`catalogText`, the Journal / DistrictRecap labels, the 今天 venue, the event card's Where row, the Notebook); `scripts/opus-sf/qa/lang-scan.mjs`; **P0** a 设置 button on the Metro card, album / letter / goals step above the tunnel; map tools 44 px on touch; the goals step in short landscape; the skyline quiz clear of the touch column and arrival card; the play chip under the pills at 601–1080 px; `scripts/opus-sf/qa/overlap-scan.mjs`; fixer: the HUD beside a side sheet in short landscape, the Metro card under the station strip, the chip / top stack band, wave 7's waypoint × area back, the tool column with a pinned card, the scan per size | 8 → 8 fixed | the waypoint edge arrow under the ride banner / play chip at 375 × 553 and 844 × 340 (lane K's `game/waypoint.ts`); `CityMap` `firstOpenView` framing; the 667 × 320 time offer over the Metro card |
| **P** first load | city-only GLSL (`data/sf/cityShaders.ts`), the landmark-card tables and district POI names (`cityPoisData.ts`), the cable-car builder (`data/transitBuild.ts`) and the district postcards' words out of GameRoot; every lazy import through `importRetry` (180 sites in 67 files, one instance per lost chunk) and the reload card `game/chunkLost.ts`; the resume waits ≤ 600 ms for discovery; wave 8's chunks named lazy; the size guard 258.5 KB (255 a `todo`); fixer: `game/lazyChunk.ts` (a lost part never becomes the site's error page), a fresh `?retry=n` per chain, quiet prefetches, GameRoot bare + one reload, the card's focus, tight chunk guards, BAYBAY held under the card | 12 → 10 fixed, 2 lost (P-RP-4 fixed by the fixer's own pass; P-RP-5 open) | GameRoot 255 target missed (258.04 production); P-RP-5 no loading state while a panel retries; a lost panel stays "open"; a game whose panel chunk is lost; `game/w5Features.ts` loaders (frozen) |
| **A** Alcatraz by ferry | the toy ferry Pier 33 ⇄ the island (`alcatrazFerrySystem.ts`: backs out, pivots, gives way, ≈ 91 s out / 55 s back, the official summer timetable, night rest, the island rider always fetched, the parade hour on 9 Oct); the island on foot (dock, dock road, a stair, the cellhouse front, the lighthouse terrace; its own graph); the arrival, photo pose, stamp, 7 fixed lines (NPS facts), 8 visitors, gulls, the engine; fixer: the return boat's own boarding line, the arrival up on the plateau, tap-to-walk up the stair, the crossing waits for a stopped ferry, no clock times outside the published sheet, sailboat holds ≤ 4 s, the boat waits for someone on the quay, the island sign off the walk, no per-frame garbage | 10 → 10 fixed (A-RC-3: the island sign fixed, Pier 33's sign left walk-through) | Pier 33's sign walk-through (needs a base-city blocker: `core/terrain`, the lead's); the ETA leaves out a crossing hold; no Alcatraz-specific return line; the rest of the island not joined; the phone quay-wait hitch (W8-Z) |
| **H** Halloween live | the season played on every live date (1 → 2 Nov, the midnight rollover); the door-to-street rule on all six streets; the big-night toast; the fallback goals card's row; the procession's legs and stepping aside; **the Chinatown Halloween Festival** kit on Waverly Place (31 Oct 11:00–15:00, +1 call that day); the pelican's pumpkin bow (60 coins); the dusk haze downtown; the trick-or-treaters' hop; the kit on streamed ground; fixer: a stricter door rule (doors 3 / 20 / 21 / 38 / 47 / 48 gone → 44 live doors), the row parts as a pair, no parting / sidewalk line while gliding, 'Bow tie', bounded hop upload ranges | 10 → 9 fixed, 1 lost (H-RP-5, open) | H-RP-5 a toy car parked mid-alley on Waverly Place during the festival; doors 22 / 26 and Belvedere 4–7 (H-rev-2 / 3); the line-up does not walk; a stronger dusk needs the sky shader |
| **S** site sync, dates, places | the re-sync after GPT's day-0 commits (no outings hook: `/together` is adults-only); the seniors' Muni English source (`sourceEn` override); the Blue Angels row; **Fleet Week · the Parade of Ships** (`world/sf/fleetWeek*.ts`: a red fireboat + six grey toy ships, 9 Oct 11:00–12:00, 2 calls, 4 fixed lines, a photo stamp + 15 coins), its path clear of the Alcatraz ferry's lanes; 50 place cards with hours / prices; the owner's live dates table; fixer: the stand's prompt follows the ships (photo only while they are in reach, then 跟上船队), BAYBAY's waypoint follows the line, no pop-in at 11:00, one name 舰船巡游, the morning prompt opens 今天, Mount Sutro's and Candlestick's sources, the report's site paragraph corrected | 10 → 9 fixed, 1 confirmed-not-fixed (S-P3) | S-P3 the ships at the photo's top edge at Marina Green (lane K's `actors/camera.ts`); the branch-library imports; 8 short cards without hours / price |
| **W1** Chinatown & the Wharf | Chinatown's pagoda cluster inside the Dragon Gate's meshes (`cornersChinatown.ts`, 0 new calls); **the SS Jeremiah O'Brien** at Pier 35 (one mesh with the Pampanito) and a reachable trip end — the sweep's last UNREACHABLE gone; 3 sight lines; Columbus Ave's asphalt to the slab's edge; r1's via points on junctions; fixer: the trip end and arrival by her stern, sight lines on foot only, the Normandy line at the shed corner facing the ship, the sweep judges from usable nodes | 6 → 4 fixed, 1 refuted (W1-RC-2), 1 confirmed-not-fixed (W1-RC-3) | W1-RC-3 lot-154 on Columbus Ave in city mode; the Pier 35 apron graph edge (waiver now 17 u); turn to `arrival.heading` at a walking trip's end; the pacer drops an accepted line silently after its TTL |
| **W2** the west side | Ocean Beach's 11 toy surfers and the break, Seal Rocks with sea lions / cormorants / gulls (1 call); Blue Heron Lake's 9 boats, ducks, the heron, the boathouse as a W8 site (1 call); St Ignatius's lead cupolas and dome; 8 fixed lines; fixer: lines never play at the wrong place and are not lost, the heron line where the heron is seen, St Ignatius lod 2 and the lead lantern, no pivoting rowboat, dusk one by one, birds on the drawn rock, surfers with arms | 13 → 10 fixed, 2 confirmed-not-fixed (W2-C6, W2-P2), 1 refuted (W2-C8) | the Haight mural kit (tried, reverted), Chase Center T2, the de Young twist, the far City Hall dome, St Ignatius's gilded crosses; W2-C6 the 1893 line's wording; W2-P2 繁體 海里 |
| **M** mini-games | **the cable-car grip** on Powell cars (read-only on the ride); **play along with the busker** (Haight St tambourine, 24th St maracas; BAYBAY practises off-hours); **the foghorns' call and answer** at Fort Point; 44 fixed lines; no per-frame allocations; fixer: horn keys let go on keyup, too slow ≠ wrong, the riff / grip pads exclusive, the hop-off hint without Space, panels hidden under Settings / left of a sheet / opaque, the grip's landscape grid, the busker on Safari < 16, Esc under Settings closes the sheet (every holdKeys game), no judging while paused | 11 → 10 fixed, 1 lost (M-RP-5 = M-C5, fixed) | the coaching bubble under the ride banner at 844 × 340; the grip's live score reads 100 before the first judgement; 721–999 px with a side sheet; `play/zones3.ts` → `sfgames8` without importRetry (the fixer's note); the Chinatown lantern game not built |
| **X** looks, voice | **voice: 132 lines / 264 clips** in 5 TTS batches (`data/sf/voiceW8.ts`), 7 of wave 7's 8 muted clips retaken; the F-line cab, cable-car dash, tour bus (one-side wheels fixed); one burst per reward; the ferry wake; fixer: the Golden Gate towers washed instead of beaded (source corrected), the F-line's dark cab glass and lit saloon, the gold line outside, the coin pop yields only to a reward-sized burst, BAYBAY's bubble held while her clip plays, the coin pop and wake city-only (the district changed: fixed), the voice inventory's blind spot | 7 → 6 fixed, 1 confirmed-not-fixed (X-RC-1) | X-RC-1 `GRIP_LINES.short` and `SLED_LINES.short` unrecorded; the bell 当——当——当！ and wave 7's "Ho! Spot on!" muted; Salesforce Tower's bands, lamp pools (other owners); no Higgsfield look asset |

## 3. The Ultra review in numbers

**Lens findings per lane** (code & facts / player; majors in brackets) and the fixers' verdicts:

| lane | code | player | total (major) | received | fixed | confirmed-not-fixed | refuted | lost in the relay |
|---|---|---|---|---|---|---|---|---|
| K | 3 | 3 | 6 (3) | 6 | 5 | 1 | 0 | — |
| Q | 4 | 4 | 8 (2) | 8 | 8 | 0 | 0 | — |
| P | 7 | 5 | 12 (2) | 10 | 10 | 0 | 0 | P-RP-4, P-RP-5 |
| A | 6 | 4 | 10 (4) | 10 | 10 | 0 | 0 | — |
| H | 5 | 5 | 10 (1) | 9 | 9 | 0 | 0 | H-RP-5 |
| S | 4 | 6 | 10 (4) | 10 | 9 | 1 | 0 | — |
| W1 | 3 | 3 | 6 (2) | 6 | 4 | 1 | 1 | — |
| W2 | 8 | 5 | 13 (1) | 13 | 10 | 2 | 1 | — |
| M | 6 | 5 | 11 (4) | 10 | 10 | 0 | 0 | M-RP-5 |
| X | 4 | 3 | 7 (1) | 7 | 6 | 1 | 0 | — |
| **all** | **50** | **43** | **93 (24)** | **89** | **81** | **6** | **2** | **4** |

- The six confirmed-not-fixed: K-RC-3 (the pelican's templated line), S-P3 (the parade photo framing), W1-RC-3 (lot-154 on
  Columbus Ave), W2-C6 (the 1893 line's zh wording; voiced), W2-P2 (the site converter's 海里), X-RC-1 (two unrecorded
  short lines). Refuted: W1-RC-2 (the Telephone Exchange stands on OSM's 743 Washington), W2-C8 (the surgical edits were
  allowed and named).
- **The four lost in the relay** (the relayed lists were cut off in lanes H, M and P; the fixers recorded "not
  received", W8-C could not find them on disk) were recovered by **W8-Z from this journal**: M-RP-5 = M-C5 (fixed,
  `e82f5863`), P-RP-4 (fixed by the P fixer's own pass, `d2f28146`), **H-RP-5 open** (a toy car in Waverly Place during
  the festival), **P-RP-5 open** (no loading state while a panel chunk retries). Final count of the 93: **83 fixed, 8 open,
  2 refuted**.
- Fixers' own passes (beyond the lenses), notable fixes: BAYBAY held under the chunk-lost card (P); unbounded hop upload
  ranges (H); Candlestick Point's two official hours lines (S); Esc under Settings giving up a running game, panels under
  a side sheet, input judged while paused (M); the coin pop and wake changing the district (X); the Kelly line lost
  behind the goals card (W2).

**W8-I** (three lenses → one fixer): phone 8 minors, desktop 6 (1 major), words & site sync 7 minors = **21**; **16
fixed, 5 confirmed-not-fixed** (D-2 the map sheet during a ride on desktop; D-4's half: the island's walking ETA; P-7
BAYBAY's density on a first Powell ride; WS-4 the pagoda colours' source; WS-6 the zoo row — done at the go-live by
W8-0s); the map-chip part of P-6 refuted. The major, **D-1** (the grip's start line cut by the bell line in the same
frame), was fixed and live-checked. Checks after its last code push `cab78eef`: tsc 0, eslint 0 errors, opus-bay 1870
tests (1869 pass, 0 fail, 1 todo).

**The completeness critic** (02:31–02:38, read-only, on `35a9edd8`): P0 table —

| P0 | status | evidence (short) |
|---|---|---|
| BAYBAY silent under play panels, egg cards, the Halloween postcard | done-verified | K's 60 s claw proof (run 3: 0 ambient lines, 0 voices), node tests, both lenses, K-rev bubble placement, P-rev card hold, W8-I D-6 |
| English never shows Chinese | done-verified | Q's scan 54 / 54 screens, W8-I 56 English / 55 繁體 screens, node tests over every SF event / place card |
| Settings during an underground Metro ride | done-verified | Q before / after, Q's player lens, W8-I phone playtest |
| Map tool and waypoint touch targets | done-verified | 44 × 44 on coarse pointers; Q-rev restored wave 7's × area; the edge arrow still open (Q → K) |
| The Hyde St canopy over the seated rider | done-verified | K's off / on shots, equal draw calls; not played on Powell–Mason / California |
| Halloween live on 1 Oct | done-verified | `season.ts` same on main and opus-bay, contracts test, H's dates, W8-I on the real date; the live site not observed |

Its go-live risks were the GameRoot guard headroom (0.2 KB), BAYBAY changes pushed 02:26–02:28 with little live play, the
four relay-cut findings, the merge of main + the zoo row, the OneDrive-locked admin folders, a district rule bend (Q's
touch-only rules), visible rough edges (S-P3, D-2, D-4, P-7, scrolling game panels in landscape) and nobody looking at
the live site after midnight. It proposed three "fixable now" items (15 + 12 + 10 minutes).

**W8-C** (02:38–02:59) finished all three: the screen-reader prompt re-reads an interactable renamed in place
(`ui/Floating.tsx` LiveRegion, `8fe3ff61`, test red → green); the pagoda line's source — Sing Chong's green roof sourced
(The Epoch Times, 13 Jul 2026), Sing Fat's yellow roofs in no source (`c3b4ec3b`, comment and data string only; the
voiced text untouched); live checks of W8-I's P-3 / D-5 (Halloween night first visit: night, no golden hour, no offer)
and D-6 (she talks with no panel open, silent 45 s under Settings, resumes after) — no revert. Checks after the push:
eslint 0 errors, opus-bay 1871 tests (1870 pass, 0 fail, 1 todo).

## 4. Final verify (W8-Z) numbers

See `sf-w8-final-verify.md` (W8-Z: **GO**, `8e3e8e72`; alone on the machine, PERF-LOCK 02:59 → the end, on `ca25fc7b`).

| gate | W8-Z | W7-Z |
|---|---|---|
| `npm run check` | **EXIT 0** — eslint 0 errors (50 old warnings) · tests **2845: 2844 pass, 0 fail, 1 todo** · build · prerender **566** · share cards **541** (every QR decoded) — the first fully green check since wave 6 | EXIT 1 · 2551 / 2555 · 566 · 541 |
| `tsc` · opus-bay suite | 0 · **1871 tests: 1870 pass, 0 fail, 1 todo** (lane P's 255 KB target) | 0 · 1660 / 1660 |
| GameRoot (gzip) | **258.04 KB** (682.94 KB raw): ≤ 265, 3.92 KB under W7-Z; the 255 target missed | 261.96 KB |
| perf desktop 1440 × 900 high | every spot and ride 60.1 fps, 0 frames > 100 ms; max **126 calls** (Chinatown) / **387k triangles** (on board the Alcatraz ferry; worst frame 17.6 ms of 15,717); highest standing spot Pier 45 366k | max 123 (Chinatown) / 360k (Pier 45) |
| perf phone 390 × 844 mid 4× CPU | **0 frames > 100 ms in every measured window**; every spot ≥ 45 fps after the paired runs — the chain's one reading under 45 (Aquatic Park on 9 Oct, 41.8 / 39.1) re-run at **53.1 / 53.2**, the live W7 tree 54.4 / 48.2 there; Waverly festival W8 57.1 / 51.9 vs W7 49.1 / 44.1; Metro rides and the pagodas within 1 fps of W7 | min 58.4, 0 frames > 100 ms |
| tile pool (`--pool tile`) | ferry-gate 93 · chinatown 105 · pier45 108 calls; 0 frames > 100 ms | +10 calls max |
| static sweep | **699** targets: 550 ok · 149 CORRIDOR · **0 boxed · 0 snag · 0 unreachable · 0 off** (the O'Brien reachable) | 694: 547 · 146 · 0 · 0 · 1 · 0 |
| production build + CSP (6 sessions: the Halloween title, a phone new player, Pier 33's deckhand, Alcatraz's quay, the busker jam, the district start) | **0 violations · 0 failed** of 1789 requests | 0 / 0 of 1514 (5 sessions) |
| district title | **71 calls / 225,070 tris / 262 objects** (identical) | identical |
| language scan | English 390 × 844: **56 screens, 0 leaks**; 繁體 1440 × 900: **55 screens, 0 Simplified-only characters** (the site converter's 馬裡納區 and 小傢夥: site editors) | — |
| 网站联动 | in sync on `ca25fc7b`: every guard green, `live.json` re-exports identically (14 SF offers, only the date changed); `origin/main`'s six commits merge clean (`git merge-tree`) | in sync |

- New perf spots `scripts/opus-sf/qa/perf/w8-spots.json`; the two real rides measured by a scratch driver
  (`C:/Users/willy/opus-qa/w8/final/ride-perf.mjs`): the Alcatraz ferry max 95 calls / 387k (desktop), 82 / 298k (phone);
  the Powell–Hyde grip ride max 89 / 318k (desktop), 93 / 276k (phone; windows 46.7 · 53.7 · 56.1 fps, worst 99.8 ms).
- One phone run of the whole ferry trip saw 2 frames over 100 ms (worst 333 ms) outside the measured windows; a re-run
  with a frame log saw none (worst 99.9 ms, while waiting on Pier 33's quay).
- The LAN phone package `C:/Users/willy/opus-qa/dist-phone` was rebuilt by W8-Z at 04:46 from its tree (GameRoot
  `GameRoot-BbJH-ms2.js`, the site build's file) — before the go-live merge; the preview `opus-bay-phone` (4174) was not
  running.
- **The go-live tree** (the lead, after W8-Z; logs `C:/Users/willy/opus-qa/w8/golive-check{,2,3}.txt`): the first
  `npm run check` stopped on lint (9 parse errors in the lead's untracked `.claude/*.js` workflow copies); the second, on
  the merged tree with the zoo row, ran 2933 tests — 2931 pass, **1 fail** (`tests/opus-bay-w5-calendar.test.ts` W5-R7: 15
  SF offers ≠ 14), 1 todo; after **W8-0t** the third: **EXIT 0** — eslint 0 errors (50 warnings), **2933 tests, 2932
  pass, 0 fail, 1 todo**, build, prerender **589** pages, **564** share cards verified (GPT's site commits added pages and
  cards since W8-Z's 566 / 541).

## 5. Higgsfield

The owner's rule: all of the remaining credits usable (363.44 at day 0); caps lane X ≤ 240, W2 ≤ 60, W1 ≤ 40, a floor of
20 on the shared account (lead note §6). The only Opus Bay spender was lane X; every other lane, lens, fixer, W8-I, W8-C
and W8-Z spent nothing (the journal's `higgsfield_spent` is 0 for every lane but X; `transactions` has no row after lane
X's last take at 2026-10-01 06:02:31 UTC = 23:02 PDT). Ledger `ledger/w8-X.md`, merged into `src/opus-bay/ASSETS-LEDGER.md`
§ "Wave 8 (local)".

| lane | what | credits |
|---|---|---|
| X | batch 1: 104 clips + 16 retake takes (Qwen Audio 3.0 TTS Flash, 02:01–02:19 UTC) | 1.92 |
| X | batch 2: 16 clips + 10 redo + 2 retake takes (03:28–03:34 UTC) | 0.34 |
| X | batch 3: 106 clips + 4 redo takes (04:30–04:48 UTC) | 2.08 |
| X | batch 4: 36 clips + redo takes (05:24–05:33 UTC) | 0.99 |
| X | batch 5: 6 clips + 1 redo (06:02 UTC) | 0.11 |
| **wave 8 (Opus Bay)** | all TTS; no image, texture or GLB shipped (no side-by-side win) | **5.44** |
| W1 · W2 · all others | nothing generated | 0 |

- **Balance trail:** **363.44** (day 0, 18:42 PDT) → **361.52** (19:22 PDT, after lane X's first takes) → 360.85 (20:27)
  → 360.51 → 358.43 → 357.38 → **357.27** (after 23:02 PDT; the lead's reading at 04:58 PDT, and again at this hand-off,
  ≈ 05:00 PDT, plan ultra). 363.44 − 357.27 = **6.17** = 5.44 lane X + **0.73 other TTS on the shared account not
  claimed by any lane**: 0.67 at 02:29:39–02:35:01 UTC (19:29–19:35 PDT; re-summed row by row at this hand-off) and 2 ×
  0.03 at 05:44:46 / 05:44:48 UTC.
- **Reconciled with `transactions`** (read at this hand-off, newest first, 630 rows): the 600 rows from 2026-10-01
  02:01:16 UTC to 06:02:31 UTC are all "Qwen Audio 3.0 TTS Flash"; the row before is "Seedance 2.5" at 2026-09-30 23:21:08
  UTC, before day 0. Lane X's per-batch sums (its ledger) and the balance trail agree.
- **Between the waves** (other work on the shared account, not Opus Bay): wave 7 ended at 2213.87, day 0 read 363.44 —
  1850.43 by the balances; the newest of those rows (30 Sep 23:09–23:21 UTC) are Seed Audio 1.0, GPT Image 2.5 Flare,
  Qwen TTS and Seedance 2.5. The RESUME's day-0 note puts the BAYLINK promo films at 766.43 and another project at
  ≈ 1,050 (not summed row by row here).
- **Whole-SF round:** 422.81 (waves 1–7) + 5.44 = **428.25 credits**.

## 6. NEXT (wave 9 candidates)

Deduplicated from every lane's Not done / Requests, every fixer's open items and confirmed-not-fixed findings, W8-I's open
items, the critic's `next_wave` and `go_live_risks`, W8-C's and W8-Z's open items. Paths are under `src/opus-bay/` unless
they start with `scripts/`, `tests/`, `public/`, `docs/` or `src/` (the site).

**P0**
1. **Confirm the deploy (owner):** open https://www.baylink.us/opus-bay?start=free&at=xz:-94,-21.8 (Pier 33 · Alcatraz
   Landing: the ferry prompt = wave 8 is live; W8-Z used this URL on the production build). Do not retry the lead's curl.
2. **A real iPhone pass (owner):** `docs/opus-bay/iphone-checklist.md` on the LAN package `C:/Users/willy/opus-qa/dist-phone`
   (start the `opus-bay-phone` preview, http://10.0.0.85:4174/opus-bay; it was built before the go-live merge — rebuild
   from `main` for the zoo row) or production + `?debug=1`. Add the wave-8 surfaces: the grip on a Powell car, the busker
   jam, the foghorns, the Alcatraz ferry both ways, the Metro 设置, the reload card. Every phone check tonight was headless
   Chrome with an iPhone UA (no iOS device; M-C3 was checked by deleting `roundRect`).
3. **The owner's ear:** `docs/opus-bay/qa/w8/X/voice/listening.md` (132 lines / 264 clips; muted until approved: the bell
   当——当——当！ and wave 7's "Ho! Spot on!"; the "未配音 · text-only lines" list), plus `qa/w7/X/voice/listening.md` (88
   lines / 176 clips) and `qa/w6/X/voice/listening.md` (80 Halloween clips) if not heard yet.
4. **The site (GPT, via the owner)** — checked on `a1cc3f60` (the go-live tree; W8-0t changed one test) where marked:
   - the lookbehind regex `(?<!…)` at `src/lib/named-event-search.ts:2` is **still there** (checked): it blanks the
     whole site, the game too, on Safari 16.0–16.3; `src/lib/guide-search.ts:58` also uses a lookbehind `(?<=…)`
     (seen while checking; whether it is on the first-load path was not checked);
   - the 繁體 converter (`translateText`): 馬里納區 → 馬裡納區, 小傢伙 → 小傢夥 (W8-Z), 海里 → 海裡 when it means "in the sea"
     (W2-P2: four opus-bay lines);
   - `sfmta-free-muni-seniors` `sourceUrl` is **still** SFMTA's Vietnamese page (`src/data/september-refresh-offers.json:100`,
     checked) → https://www.sfmta.com/fares/free-muni-seniors-ages-65 (then drop the `sourceEn` override in
     `scripts/opus-sf/export-live.ts`);
   - the Chinatown Halloween Festival (31 Oct 11:00–15:00, Waverly Place, https://www.cycsf.org/chinatown-halloween-festival/)
     is **still not** in `public/planner-catalog.json` (checked);
   - the English dictionary lacks `venue-exploratorium-daytime`'s title and summary and `restaurant-gotts-ferry-building`'s
     summary (lane Q);
   - from wave 7's promo notes, not re-checked tonight: the planner's HTTP 400 on 「10月17日周六」, free admission read as
     an unknown price. Wave 7's 4 red site tests are **closed** (GPT's `f3fa187f`; W8-Z's check green).
5. **Housekeeping (lead):** `git worktree prune` with OneDrive paused — 46 `w8-*` admin folders sit in
   `C:/Users/willy/OneDrive/Desktop/baylink-web/.git/worktrees/`, 11 of them the kept worktrees (lanes + this hand-off): the
   rest are the lenses' / fixers' / W8-I / critic / W8-C / W8-Z folders the OneDrive lock kept. The lead's untracked
   `.claude/*.js` workflow copies make `eslint .` in `C:/Users/willy/baylink-opus` report 9 parse errors (day 0, and the
   first go-live run `C:/Users/willy/opus-qa/w8/golive-check.txt`): run the check where they are not.

**P1**
6. **Time-bound:** before **9 Oct** S-P3 — the photo camera at Marina Green's seawall puts the parade (and the jets) in the
   frame's top ≈ 80 px (`actors/camera.ts`, lane K); before **17 / 24 Oct** import `sfpl-omi-history-day-oct17-2026` and
   `sfpl-western-addition-open-house-oct24-2026` (venue rows in `realsf/eventVenues.ts`, short names, `SOUVENIR_IDS`,
   replace main's "pending independent world import" assertion in `tests/opus-bay-w6-s-venues.test.ts`; lane S); before
   **31 Oct** H-RP-5 — keep parked cars off Waverly Place while the festival kit is up (the parked-car layer; lane H / K);
   a look on 7 Oct at the zoo row (W8-0s).
7. **GameRoot** 258.04 KB, static guard 258.5 (≈ 0.2 KB headroom), target 255 (lane P): the measured moves in
   `sf-w8-P.md` Not done — the Golden Gate wisps in `world/fx.ts` (≈ 0.4), the city gull / open-deck ferry in
   `world/life.ts` (≈ 0.4), the POI link tables in `data/pois.ts` (≈ 0.8), the district subject facts (≈ 0.4),
   `data/ferry.ts`'s line builder (≈ 0.6), `game/transit.ts`'s ride-UI helpers. The play core is 6204 of its 6246 B guard
   (`tests/opus-bay-w5-play-acts.test.ts`). The lead: wrap `game/w5Features.ts`'s five loaders in `importRetry` (frozen).
8. **BAYBAY and the camera (lane K):** the waypoint edge arrow below the ride banner / play chip at 375 × 553 and
   844 × 340 (`game/waypoint.ts waypointSafeArea`); D-4 a ferry-aware ETA from Alcatraz or no chip on the island
   (`game/waypoint.ts`); P-7 a pacing gap after a held line's release (`game/cityMoments.ts` / `game/linePacer.ts`); the
   pacer telling the caller when it drops an accepted line after its TTL (W1: sight lines spent unsaid); the ride banner as
   a HUD box so the coaching bubble clears it at 844 × 340 (`game/hudLayout.ts`, M); turn to `arrival.heading` at a
   walking trip's end (`game/tripRun.ts`, W1); the idle pool repeating a line 18 s apart (`game/brain.ts`, W8-C); a parked
   ride > 250 u away towed only on return; play the canopy dither on the Powell–Mason / California lines.
9. **Phone / desktop layout (lane Q, with M):** D-2 the map sheet during a ride on desktop (Ask BAYBAY and SPACE Hop off
   covered, the ride banner over the spark pill); a real landscape layout for the seven SF game panels
   (`play/sfgames.css`, `play/sfgames8.css`) instead of scrolling; `ui/RideBanner.tsx PAD_ROW` wrapping; the 667 × 320
   time offer over the Metro card; `CityMap` `firstOpenView` framing; the Int'l Orange shop tile label on phones; the
   lang-scan reporting Simplified-only characters apart from round-trip differences (W8-Z).
10. **Voice (lane X, with the line owners):** record `GRIP_LINES.short` (`play/sfgames8Lines.ts`) and `SLED_LINES.short`
    (`play/sled.ts`); fixed lines + a toast for the pelican's later line (K-RC-3, `game/pelicanFirst.ts`) and the today line
    (WS-1, `realsf/todayLine.ts`); W2-C6 `w8-w2-lake-1893` → 船屋从1893年起就租船给游客。 + a retake (`world/sf/westLines.ts`);
    WS-4 a source for Sing Fat's yellow roofs or a re-recording of `w8w1-pagodas-ahead` without "yellow"
    (`world/sf/cornersSights.ts`); an Alcatraz return-boarding line (`world/sf/alcatrazLines.ts`).
11. **Lazy chunks (lane P):** P-RP-5 a loading state for a panel being retried; a per-panel close-on-lost hook (a lost
    panel stays "open"); a game start that waits for its panel chunk (`play/sfgames.ts`); `play/zones3.ts` → `./sfgames8`
    through `importRetry` (M fixer's note).
12. **Perf watch:** the ferry crossing at 387k is 13k from the cap — measure anything new on the north waterfront from the
    boat; profile the phone's wait on Pier 33's quay at 4× (lane A); Aquatic Park on 9 Oct and Waverly Place on 31 Oct
    read 44–54 fps at 4× on both trees (trim the crowd there first).

**P2**
13. **Not built:** the Haight mural kit (find walls the city's own heights leave exposed), Chase Center T2, the de Young
    twist direction, the far City Hall dome's ribs, St Ignatius's gilded crosses and the lantern's openings (W2); the
    Chinatown lantern game, the guitarists strumming in time, the grip's pull curves (M); Salesforce Tower's city-only
    bands (`world/landmarks.ts salesforce()`, the lead's OK) and stronger city lamp pools (`world/sf/props.ts` +
    `world/materials.ts POOL`, K / lead) (X); a Higgsfield look asset only where a side-by-side wins.
14. **Places:** Pier 33's quay sign walk-through (a base-city blocker hook in `core/terrain`, the lead's); the rest of
    Alcatraz joined to the walk, a switchback road, the boat's own wake strip (A); W1-RC-3 lot-154 on Columbus Ave
    (`world/sf/cornersSeamData.ts`) and a Pier 35 apron graph edge so the O'Brien's waiver (17 u in
    `tests/opus-bay-sf-attractions.test.ts`) can go (`core/walkGraph.ts`, the lead's) (W1); doors 22 / 26 and Belvedere
    4–7 (H-rev-2 / 3), a walking festival line-up, a stronger downtown dusk via `world/environment.ts` (H); 8 short place
    cards without hours / price (S).
15. **Rules to decide (lead):** lane Q's mode-blind touch rules reach the district on touch screens (the 1440 × 900 hero
    unchanged, the hero test green); the M grip panel's live score before the first judgement; 721–999 px with a side
    sheet.
16. **Process:** pass lens results to fixers as files (or tell fixers to read the journal), not inline relayed text
    (rule 2 in the RESUME).

## 7. Where things are

- `src/opus-bay/RESUME.md` top section "WAVE 8 DONE · LIVE ON baylink.us — 2026-10-01 (≈ 05:15 PDT)": the state, the
  reading order, the rules learnt this wave, how to continue.
- Reports `docs/opus-bay/sf-w8-*.md`; QA images `docs/opus-bay/qa/w8/<LANE>/`, `qa/w8/int/`, `qa/w8/final/`; the voice
  sheet `docs/opus-bay/qa/w8/X/voice/listening.md`; the ledger `docs/opus-bay/ledger/w8-X.md` (merged); perf spots
  `scripts/opus-sf/qa/perf/w8-spots.json`; the reusable scans `scripts/opus-sf/qa/lang-scan.mjs` and
  `scripts/opus-sf/qa/overlap-scan.mjs`; the iPhone checklist `docs/opus-bay/iphone-checklist.md`.
- **Worktrees kept:** `C:/Users/willy/wt/w8-{k,q,p,a,h,s,w1,w2,m,x}` (branches `w8-*`, all pushed) with `node_modules`
  **junctions** to the main checkout's (remove a junction with `cmd //c rmdir` first, check it is gone, then `git worktree
  remove`, never `--force`); `wt/w8-handoff` (this hand-off). The lenses' (`-rc`, `-rp`), fixers' (`-rev`, `w8-s-revm`),
  `w8-int`, `w8-int-586{1,2,3}`, `w8-critic`, `w8-cfix`, `w8-verify`, `w8-verify-w7` worktree folders are removed; their
  admin folders under `.git/worktrees/` remain (OneDrive lock) → `git worktree prune` later (§6 item 5). Local branches
  of the removed worktrees (e.g. `w8-k-rev`, `w8-int`, `w8-cfix`, `w8-verify`) are kept.
- Scratch `C:/Users/willy/opus-qa/w8/` (`day0/`, lanes `<id>/`, lenses `<id>-rc/` / `<id>-rp/`, fixers `<id>-rev/`,
  `int-586{1,2,3}/`, `int/`, `critic/`, `cfix/`, `final/` = W8-Z's logs, perf tables, pairs, sweep, CSP, district, language
  scans; the go-live check logs `golive-check.txt`, `golive-check2.txt`).
- **The workflow:** run `wf_66c65596-f6a`, script
  `C:/Users/willy/.claude/projects/C--Users-willy-baylink-opus/f0bf32bb-00df-4c15-bf61-df7e5e6b5e50/workflows/scripts/opus-bay-wave8-ultra-wf_66c65596-f6a.js`;
  journal `C:/Users/willy/.claude/projects/C--Users-willy-baylink-opus/f0bf32bb-00df-4c15-bf61-df7e5e6b5e50/subagents/workflows/wf_66c65596-f6a/journal.jsonl`
  (rows `{type: 'started' | 'result', agentId, label, phase, result}`; read with a small script, UTF-8) and each agent's
  transcript `agent-<id>.jsonl` beside it. A run cannot be resumed across sessions.
- The lead's checkout `C:/Users/willy/baylink-opus` is on `opus-bay` at `90c6859e`.
