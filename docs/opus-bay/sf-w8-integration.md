# Opus Bay wave 8 · W8-I · the integration pass (Ultra)

## 给主人的摘要

1. 三位整合检查员（手机试玩、电脑试玩、文字和网站同步）一共报了 21 个问题：1 个较严重，其余都是小问题，没有阻碍上线的。我逐条核对，21 条都属实；只有「按钮太小」那条里的地图筛选按钮不成立，它们本来就有 44 像素的点击范围。
2. 较严重的那条已修好并实测：叮当车「拉闸」小游戏一开始，BAYBAY 会在同一瞬间连说两句配音，第一句教玩法的话根本来不及看。现在第一句先停留约 2.8 秒，「叮叮！过路口记得摇铃！」排在后面再说。
3. 另外修好 15 条：恶魔岛岛上地名显示「恶魔岛」；鲍威尔街缆车掉头处显示「联合广场」，BAYBAY 不再在那里讲一公里外的金字塔；玩过拉闸不再被邀请；万圣节晚上第一次来的玩家直接看到夜景；打开面板时 BAYBAY 不再插话；街头合奏和雾笛游戏里不再显示没用的「E 和 BAYBAY 聊聊」；手机横屏时「看实时」提示不再盖住商店，「问我」小标签不再被按钮压住；几个按钮的点击范围加大到 44 像素；英文开场句首字母大写；英文周末日期不再看成一个日期。
4. 留到第九波（都不挡上线）：坐车时打开地图有三处遮挡（电脑）、坐车时 BAYBAY 话偏密、岛上路线提示仍按走路估时间、宝塔楼颜色那句缺来源、10 月 7 日动物园免费日要等主分支合并后再导出。
5. 检查全部通过：类型检查 0 错误，整库 eslint 0 错误，全部测试 1870 个：1869 通过、0 失败、1 个登记在案的待办。最后推送 02:28 之后只加了本文档。

## English

**Who / when.** W8-I fixer, 02:05–02:45 PDT, worktree `C:/Users/willy/wt/w8-int` on `origin/opus-bay` 03ee7dfd, dev server on
port 5864, one headless Chrome at a time. Pushed: fa3e7bc4, 466b8b35, 9fd20bdd, cab78eef, then this report.

### The route and what the three lenses saw

- **PHONE PLAYTEST** (390×844 dpr 3 touch, iPhone UA; two runs through 390×664, 375×553 and 844×340; scratch
  `C:/Users/willy/opus-qa/w8/int-5861/`). A new player: title → welcome → explore on my own → goals step → I'll wander. Then
  the Powell–Hyde ride with the grip game, the map during a ride, the Alcatraz ferry both ways with the island walk, Fleet
  Week ships on 9 Oct, the Chinatown festival and the pelican's pumpkin bow on 31 Oct, the 24th St busker, Settings in
  the Metro, and the Journal. No crash, 0 console errors in 7 runs. Max 103 calls / 281k tris (Chinatown) and 85 / 341k
  (busk, landscape). Eight minor findings.
- **DESKTOP PLAYTEST** (1440×900; scratch `C:/Users/willy/opus-qa/w8/int-5862/`). The grip on Hyde St, the map during a
  ride and on the ferry, the island, the busk and foghorn games, and Halloween night at the Painted Ladies. One major
  (the grip's start line) and five minors.
- **WORDS & SITE-SYNC SCAN** (scratch `C:/Users/willy/opus-qa/w8/int-5863/`). Language scans: English 56 screens and
  繁體 55 screens, plus wave 8's own surfaces. The only leak was the scanner's own false positive. 449 voice inventory lines,
  2 without a clip. The site sync was simulated against `origin/main`: the merge-tree is clean, lane S's guards pass
  43/43 and live.json re-exports identically. Of 16 web-checked facts, 15 were confirmed. Seven minors.

**This pass** read every finding against the code, reproduced live what a short run could reach and wrote red-then-green
node tests where the behaviour is testable:
- `v1.mjs` (desktop): the grip started on Hyde St 3 s into the ride, the island, the Powell & Market turntable, the busk prompt.
- `v2.mjs` (desktop): the map during a ride.
- `ph/p1.mjs` (844×340 touch): the time offer over the shop, and the action button over Ask me, before and after.

The shots below are in `docs/opus-bay/qa/w8/int/`:
- `d1-grip-start-after.jpg`: 1.2 s into the grip, with the car in a bell window (the bell icon on the panel), the
  start line 'Grip the cable uphill, and let go at the red!' is still up. The bell line followed 2.8 s later.
- `p2-island-pill-after.jpg`: the island's cellhouse front, pill 'Alcatraz Island'. The waypoint chip still says
  'Meet the pelican · Coit Tower · ~2 min' (the D-4 rest, open).
- `p8-turntable-after-d6-before.jpg`: the Powell & Market turntable, pill 'Union Square · Cable Car Waiting Line'. This
  run was on the tree before the D-6 fix, and the shot also shows D-6 live: 'Golden hour! Everything looks good in this
  light.' beside the open, PAUSED Settings sheet.
- `p4-844x340-shop-offer-before.jpg` / `-after.jpg`: the 10 s time offer across the shop's tabs, then gone while the shop is up.
- `p5-844x340-askme-before.jpg` / `-after.jpg`: '…me' under 'Take the ferry', then the tag waits.

### Every finding and its verdict

| id | sev | verdict | what was done (file, test) |
|---|---|---|---|
| W8I-D-1 | major | **fixed** | Lane M `play/grip.ts`: the start line counts as said (`said = START_MS/1000 − SAY_GAP`), and `bell-first` / `hyde` are *kept* lines that wait for the 2.2 s gap (at most two wait) instead of cutting in or being lost. Red (old: bell line at +0.03 s) then green in `tests/opus-bay-w8-int.test.ts`. Live: start 40.9 s → bell 43.7 → hyde 50.4, each voiced alone. The forced crossing cue (lane M's 'important line') may still come early, never in the start's frame. |
| W8I-P-1 | minor | **fixed** | Lane M `play/sfgames8.ts`: the grip invite also needs `!played.has('grip')`, as busk / foghorn do. Red-then-green test. |
| W8I-P-2 | minor | **fixed** | `data/cityZones.ts` LANDMARK_AREAS `alcatraz` 恶魔岛 / Alcatraz Island on places.json's anchor (−468.22, −58.53), r 34 (it reaches the berth, nothing else is near). Test, plus live pill 'Alcatraz Island'. |
| W8I-D-4 | minor | confirmed-not-fixed | The area half is P-2, fixed. The other half stays open: the waypoint chip on the island offers a *walking* ETA to Coit Tower (game/waypoint.ts, lane K: it needs a ferry-aware route; wave 9). |
| W8I-P-8 | minor | **fixed** | LANDMARK_AREAS `union-square` 联合广场 (96.13, 221.34, r 52; after Chinatown, so the Dragon Gate stays Chinatown). The turntable and the square now say Union Square. The far-zone greeting (你好，金融区！…泛美金字塔) is no longer said there, because the landmark area is not a far zone. It is still said in the rest of the district. Test + live. |
| W8I-P-3 | minor | **fixed** | Lane H `halloween/world.ts`: on 31 Oct after dark (`halloweenPhase() === 'night'` and `bayTimeOfDay() === 'night'`), a first visit drops F11's golden hour and its time offer, and follows the Bay clock. 31 Oct by day keeps the golden first visit. Source test. Not replayed live (time). |
| W8I-D-5 | minor | **fixed** | The same fix as P-3: BAYBAY no longer says 今晚是万圣节 and then 金色时刻 in sunlight. The voiced Belvedere line cut 0.1 s later by the knock line is lane H's old W6 pacing and is left as is. |
| W8I-P-4 | minor | **fixed** | `ui/Floating.tsx` TimeOffer: hidden while any overlay or panel is up; its 10 s clock keeps running. 844×340 before/after shots. Test. |
| W8I-P-5 | minor | **fixed** | `opus-bay.css`: in short landscape (≤ 460 px tall), `.ob-ask-me` waits while a context action button shows. Before/after shots. Test. |
| W8I-P-6 | minor | **fixed** (in part refuted) | The map chips (`.mw-chip`) already have a `::before` hit area (32 + 2·6 = 44): refuted for them. Fixed with coarse-pointer hit areas: the Today tab's Go (`realsf/realsf.css`, 32 → 44) and the result card's buttons (`play/play.css`, 40 → 44). The Postcards pill (42 px) is left as is. Source test. |
| W8I-P-7 | minor | confirmed-not-fixed | Confirmed on a ride in my own `v1` log: lines at 8.4, 16.1, 35, 39.2, 40.9, 43.7 and 50.4 s. P-1 removes one of the six lines the lens counted. A real pacing gap after a held line's release (lane K's hold plus the zone greetings and hunt hints) is a feel change for wave 9. |
| W8I-D-2 | minor | confirmed-not-fixed | Reproduced at 1440×900 (`v2.mjs`): with the map open on a ride, 'Ask BAYBAY (Q)' at 792,822 is covered, and 'SPACE Hop off' is under `.mw-row`. A layout change across lanes Q and K's transit UI, for wave 9: shift the hint bar to the space left of the sheet, or hide it under the map. |
| W8I-D-3 | minor | **fixed** | `game/brain.ts`: no focus or E prompt while a play activity holds the feet (`playerLock.lockHeldBy('activity')`, new). Live: busk running → focus null, no 'Talk to BAYBAY'; after → 'play:busk-mission' again. Test. |
| W8I-D-6 | minor | **fixed** | `game/brain.ts` (city only): an open panel makes BAYBAY's small talk quiet (the light line, the idle lines, the pass-by barks), the pacer's rule. Reproduced live before the fix (the golden-hour line beside the PAUSED Settings, shot above). The district is unchanged. Test. |
| W8I-WS-1 | minor | **fixed** (the words) | `realsf/todayLine.ts`: the English line starts with a capital and says 'on the journal's Today page' (all three variants). The line stays templated and unvoiced: a fixed, voiced line with the names on a toast is for wave 9. lane R's `tests/opus-bay-w5-today.test.ts` checks 60 days × 3 times. |
| W8I-WS-2 | minor | **fixed** | Lane A `play/pet.ts`: the otter float waits for no panel (`s.panel.kind === null` in its idle). Lane E `economy/shopRun.ts` ticketGiftWaits: a panel holds the 飞行券 gift. Test (behaviour for the gift, source for the float). |
| W8I-WS-3 | minor | **fixed** | Lane Q `scripts/opus-sf/qa/lang-scan.mjs`: 繁體 is judged by a tw→cn→tw round trip. `馬里納區 · 海灣邊` is no leak; `马里纳区`, `馬里纳區`, `旧金山` and `恶魔岛` are still caught (checked with opencc-js). |
| W8I-WS-4 | minor | confirmed-not-fixed | The cited source (https://en.wikipedia.org/wiki/Look_Tin_Eli, fetched 2026-10-01) names no roof colours. The line is voiced, so the fix is either a Commons photo URL and date in `world/sf/cornersSights.ts`, or a wave-9 re-recording without the colour clause. No credits were spent tonight. |
| W8I-WS-5 | minor | **fixed** | `docs/opus-bay/qa/w8/X/voice/listening.md` gains '未配音 · text-only lines' with GRIP_LINES.short, SLED_LINES.short and the pelican's laterBubble template. |
| W8I-WS-6 | minor | confirmed-not-fixed | A go-live / lead item: after merging `origin/main`, map `sf-zoo-resident-free-oct7-2026` in `scripts/opus-sf/export-live.ts` SPECS and re-export live.json. It is site data that only lands with the main merge, so it cannot be mapped on opus-bay first. The day is 7 Oct. |
| W8I-WS-7 | minor | **fixed** | `realsf/TodayTab.tsx`: the English day lists (the weekend header and each wished event's days) are joined with '; '. 'Tomorrow · Sat; Sun, Oct 11' replaces 'Sat, Sun, Oct 11'. Source test. |

Summary: 21 findings. 16 fixed. 5 confirmed and left open (D-2, D-4's ETA, P-7, WS-4, WS-6). The map-chip part of P-6
was refuted. Every fix is a few lines in its lane's file.

### Checks (last code push cab78eef)

- `npx tsc -p tsconfig.app.json --noEmit`: 0 errors.
- `npx eslint .`: 0 errors (50 pre-existing warnings).
- `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts`: 1870 tests, 1869 pass, 0 fail, 1 todo. The todo is W8-P9's 255 KB GameRoot target. The guard test reads GameRoot ≈ 258.3 KB, under its 258.5 KB guard.
- New tests: `tests/opus-bay-w8-int.test.ts` (10 tests). `tests/opus-bay-w5-today.test.ts` gains 2 asserts.
- Draw calls on my runs: ≤ 118 calls / 355k tris (844×340, the Ferry Building, quality mid); 86 calls / 313k on the
  Hyde St grip (desktop).
- Console: one THREE.Clock deprecation warning, no errors.

### Open items (wave 9; none blocks the go-live)

1. D-2: the map sheet during a ride (desktop). The hint bar sits under the sheet, the HUD column under the hint bar, and the ride banner over the spark pill.
2. D-4: the waypoint's walking ETA from Alcatraz (game/waypoint.ts): it should be ferry-aware, or the chip should hide on the island.
3. P-7: BAYBAY's density on a first Powell ride, about one line every 5 s after a held release. Proposal: a pacing gap after `releaseHeld`.
4. WS-1: the today line stays templated and unvoiced: wave 9 makes it a fixed, voiced line with the names on a toast.
5. WS-4: the pagoda colours need a photo source, or a re-recording.
6. WS-6 (lead, at the go-live merge): map the SF Zoo resident free day (7 Oct) in export-live SPECS after merging main.
7. GameRoot is at ≈ 258.3 KB of its 258.5 KB guard: the next static addition to GameRoot needs a trim (W8-P9).
8. The W8-I worktree's git admin folder may refuse deletion (OneDrive lock), as on every lane tonight: a `git worktree prune` from the lead clears it.

### Blocking the go-live

Nothing. The one major (D-1) is fixed, live-checked and tested. The open items are minors or lead tasks for the merge.

## Completeness pass

W8-C, the completeness critic's three safe items, 02:38–03:05 PDT on 1 October, worktree w8-cfix from origin/opus-bay 35a9edd8, dev server 5865, one headless Chrome at a time.

### 给主人的摘要

- 三件事都做完了。读屏的「按 E …」提示现在会跟着改名的互动点一起更新（飞行表演 → 跟上船队），已推送。
- 宝塔颜色：Sing Chong的绿顶找到了来源。Sing Fat 的黄顶找不到任何来源。这一点已经写进代码注释，第九波补上来源或者重录。语音没动。
- 万圣节晚上第一次来，实机看过：直接是夜景，BAYBAY 说的是「城里的灯一盏盏亮起来了」，没有金色时刻，也没有时间提示。
- BAYBAY 实机看过：没开面板时她照常说话（35 秒说了 5 句）；打开设置后 45 秒一句没说；关掉设置马上恢复。D-6 不用回退。
- 检查全绿：tsc 0，eslint 0 个错误，测试 1871 项、0 失败。GameRoot 的估算是 258.3 KB，没变。
- 有四条审查结果在转发时被截断了：H 的第 10 条、M-RP-5、P-RP-4、P-RP-5。磁盘上找不到原文，只有手里有那几个 lens 输出的人能补上。现在看不出它们挡不挡上线。

### English

#### The items

| # | item | verdict | commit |
|---|---|---|---|
| 1 | W8I-WS-4: a source for the pagoda roof colours in `w8w1-pagodas-ahead` (world/sf/cornersSights.ts) | **Half sourced, recorded.** Sing Chong's green roof has a source: a photo caption in The Epoch Times, 13 Jul 2026, which reads "a green, multi-tiered pagoda-style roof" (https://cmsapi.theepochtimes.com/bright/defining-chinatown-architecture-and-cultural-identity-after-destruction-6055349, checked 2026-10-01). **No source found for Sing Fat's yellow roofs.** That article gives Sing Fat's palette only as "red, green, and yellow". Wikipedia (Look_Tin_Eli), theclio.com/entry/186932, virtourist.com/america/san-francisco/42.htm and the Commons file descriptions name no roof colour. I did not download Commons photos to look at them. The header comment and the `source` string now say this. Comment and data string only: the zh / en text and the voice match are untouched. Wave 9 needs one of two things: a source for Sing Fat's roof colour, or a re-recording that drops "yellow". | c3b4ec3b |
| 2 | Lane S's own finding 2: the screen-reader prompt kept a renamed interactable's old verb (飞行表演 … 按 E 看看飞行表演 was read while 跟上船队 showed) | **Fixed.** ui/Floating.tsx `LiveRegion` now re-reads the focus on the interactables epoch. It uses Hud.tsx's ContextAction pattern (W6-K1): `useSyncExternalStore(subscribeInteractables, interactablesEpoch, …)`, plus a `reread` effect on the epoch. No per-frame work. Floating.tsx is in the play layer's lazy chunk, so the GameRoot estimate stays ≈ 258.3 KB. The size guard passes (tests/opus-bay-sf-budget.test.ts 23/23, 1 todo). Test: tests/opus-bay-w8-c.test.ts, red before the fix and green after. | 8fe3ff61 |
| 3 | Live check of W8-I's fixes that only had source tests (P-3 / D-5 and D-6) | **Done, both hold; no revert.** Details below. | (no code) |

#### Claims verified, and how

- **W8I-P-3 / D-5 (first visit on Halloween night).** Run on the dev server: `?world=city&start=free&save=off&date=2026-10-31T19:30` at 1440×900. A recorder hooked on `flow.subscribe` / `game.subscribe` ran from the first frame of play through 45 s after the goals step closed. Every sample read `night | golden=false | offer=null`. BAYBAY's light line was the night one, 城里的灯一盏盏亮起来了，好温柔。, with no 金色时刻. Shot: docs/opus-bay/qa/w8/int/cfix-a2-halloween-night-first-visit.jpg (moonlit bay, lit lamp, no time pill).
  - Control, on a normal date (today, 02:5x): the first visit opens at golden hour and BAYBAY says 金色时刻！. So F11 still works off Halloween.
  - Gap: `?start=free` skips the welcome choice, so `offerRealTime()` was not called through the welcome. The offer's `show()` reads `goldenFirstVisit`, which was already false, so no offer can appear.
- **W8I-D-6 (an open panel quiets her city small talk).** Run on the dev server: `?world=city&start=free&save=off`, desktop.
  - With no panel open (the goals step closed by Esc), she said, with `panel=null`: the light line at 5.6 s, the 飞行券 gift at 9.9 s, and in a second run the today line, the bridge-lights news and the city idle line 每个街区都有自己的颜色，慢慢看。. So her small talk and idle lines still come.
  - Esc opened Settings (PAUSED) at 32.2 s. No line came for 45 s. Shot: docs/opus-bay/qa/w8/int/cfix-c1-settings-quiet.jpg.
  - After Esc closed Settings, lines resumed within 1–9 s (an idle line, the bridge news, the otter float).
  - Not played: a pinned place card on desktop.
  - The goals step (W5-C3) also keeps her quiet while it is open, as before.
- **WS-4.** Checked as described in item 1.
- **GameRoot.** I measured only the static estimate: 258.3 KB, under the 258.5 KB guard and unchanged by this pass. The production-build figure is still W8-Z's.
- **The four findings cut off in the relay (lane H's 10th item, M-RP-5, P-RP-4, P-RP-5).** I could not recover them. opus-qa/w8/{h,m,p}-rp hold only the player lenses' evidence (shots, logs, drivers), not their finding lists. The lane reports (sf-w8-H.md l.267, sf-w8-M.md l.362, sf-w8-P.md l.324) record them as "not received". Recovering them needs the original lens outputs from the wave-8 workflow (wf_66c65596-f6a). **Unverified.**

#### Not verified by this pass (for W8-Z or wave 9)

- WS-2 (the otter float and the 飞行券 gift under a panel), WS-7 (the TodayTab join) and P-6 (the 44 px hit areas) were not played after their fixes.
- D-3 was not played, and neither was D-6 with a pinned place card on desktop.
- The production GameRoot size, fps (W8-Z only), a real iOS device, lane K's fly trip and the canopy dither on the Powell–Mason / California lines were not checked.
- The final lang-scan and the overlap-scan `--shots` were not re-run on the final tree, and the merged tree's full `npm run check` was not run.

#### Observations

- In the Halloween run the idle line 要是我有口袋，一定装满酸面包。 came twice, 18 s apart (14.7 s and 32.9 s). A minor point for wave 9: the idle pool could skip the line it just said.
- QA lesson: my first opus-shot run hung. Its eval read `__opusBay.flow` 25 s after load on a cold dev server, before the game had mounted. The throw inside a `setInterval` meant the promise never resolved. A QA eval should poll until the hooks exist, as the later runs did.

#### Checks

- Before the first push: `npx tsc -p tsconfig.app.json --noEmit` returned 0, and the touched tests passed (w8-c, w8-w1-obrien, w8-w1-chinatown: 9/9; sf-budget 23/23, 1 todo).
- Right after the push, on the same tree: `npx eslint .` gave 0 errors (50 warnings), and `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` ran 1871 tests: 1870 pass, 0 fail, 1 todo (the W8-P9 255 KB target).
- This report and the two shots are docs only.
