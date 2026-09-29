# Wave 6 · summary and hand-off

Written 2026-09-29 ≈ 06:55 PDT by the lead in `C:/Users/willy/wt/w6-day0`. Sources: the plan / lead note
`sf-w6-lead.md`, the nine lane reports `sf-w6-{K1,K2,B,P,H,G,S,W,X}.md` (each with its `## Review`), the final verify
`sf-w6-final-verify.md` (W6-Z), the ledger `ledger/w6-X.md`. Workflow run `wf_c4d5fd74-83c` (lanes → per-lane adversarial
review → W6-Z), 01:53–07:00 PDT.

## 给主人的摘要

1. **万圣节来了（10/1–11/2）**：旧金山住宅区约 2000 户维多利亚老房门口摆满南瓜灯、门廊小灯、蜘蛛网和小幽灵，扮成小幽灵 / 小女巫的孩子在人行道上，黄昏阿拉莫广场、双峰上空有蝙蝠，苏特罗浴场遗址夜里飘着发光小幽灵，十月晚上海雾更浓一点。
2. **南瓜灯寻宝**：全城 40 个好玩的地方各藏一个发光南瓜灯（九曲花街、波因特堡、双峰……），找到 10 / 20 / 40 个有额外奖励；找齐送万圣节明信片。
3. **不给糖就捣蛋**：6 条真实的万圣节讨糖街（Belvedere、Chenery、Fair Oaks、Jordan、Sea Cliff、Hearst）54 户人家门口可以「敲门」，BAYBAY 喊「不给糖就捣蛋！」、门吱呀打开、糖果飞进糖果袋、给金币；**10/31 大夜晚**每家都开门、糖果加倍，远处钟楼敲一下。
4. **万圣节服装**：小铺新增 BAYBAY 的女巫帽、南瓜头（晚上发光），你的猫耳朵、小幽灵披风；手帐多了「万圣节」页（三个目标、糖果袋、讨糖街一键带我去）。标题画面在万圣节期间换成万圣节版（南瓜灯、蝙蝠、BAYBAY 戴巫师帽）。BAYBAY 新录 80 条万圣节语音（Pixie 的声音）。
5. **亡灵节（11/1–2）**：教会区 24 街彩色剪纸旗和万寿菊，波特雷罗德尔索尔公园 6 座祭坛，游行集合处的万寿菊拱门。
6. **今天就能看**：正式网站 https://www.baylink.us/opus-bay?halloween=1 （十月）、`?halloween=night`（万圣夜）、`?halloween=muertos`（亡灵节）。
7. **网站新资讯同步进 3D 世界**：GPT 更新的秋季活动里，游戏中显示的旧金山活动从 18 个增加到 38 个（万圣节活动优先：大通中心万圣节庆典、Sunnydale 南瓜节、Portola 万圣节手工、芳草地儿童装扮游行）；3 家新开的店在真实地址旁立了"新店"小牌子；今天页多了非洲侨民博物馆免费夜场/免费日。
8. **新玩法和新街区**：北滩的空地补好了，还有华盛顿广场、圣彼得圣保罗教堂白色双塔、哥伦布大道咖啡桌和串灯；和 BAYBAY **捉迷藏**（暖了 / 冷了提示）；**里昂街台阶赛跑**（跑到顶正对艺术宫）。路人变可爱了（有眼睛、腮红、小手，肤色发色各不同）。
9. **小问题都补了**：手机摇杆不会再突然反向；打开设置时车会等你；更多菜单不再被到站卡片挡住；统一叫"国际橙"；开局不乱送飞行券；桥面不再误触海獭彩蛋；坐海德街缆车镜头不钻进房子；车辆卡死审查补做完，修好"电车穿过你的小车"；M 线已取消的车站拿掉；叮当车站名有中文。
10. **检查**：9 条线、9 位审查员（找到 27 个问题、修好 26 个），总验收全站 2246 个测试全过、全城 688 个点巡检 0 卡住；首屏包 300 → 约 279 KB（目标 265，下一波继续）。Higgsfield 只花 **15.7 分**（上限 1000，余额 2359.3），每笔都在账本里。
11. **请你有空时**：听一下 80 条万圣节语音和音效（试听单 `docs/opus-bay/qa/w6/X/voice/listening.md`），用真 iPhone 玩 5 分钟。

## 1. Wave 6 at a glance

- Day 0 (the lead): **W6-0c** `b35995a6` merged `origin/main` (GPT's autumn release); **W6-0d** `3f34d681` froze the
  Halloween contracts (a fifth lazy feature `halloween/`, `season.ts`, `rewards.ts`, the `halloween` reward prefix / event /
  save bits); **W6-0g** `294746bc` the plan + lead note; **W6-0e** `89b16f37` merged `origin/main` again (GPT's 02:08
  discovery / planner commit, site only) so W6-Z verified the tree that goes live.
- **≈ 120 commits** after day 0 by nine lanes and nine reviewers (K1 17, K2 14, B 11, S 11, W 8, H 7, G 6, P 6, X 7;
  reviews 24). No mid-wave checkpoint (time): the reviews carried it.
- Reviews: **27 defects found, 26 fixed** (B 3/3, H 3/3, S 3→4 fixed, W 4→5, K1 1/1, K2 4/4, P 2→1, G 5→4, X 2/2);
  **0 blocking** for the go-live.

## 2. Lanes (details in each `sf-w6-<ID>.md`)

| lane | what shipped | left open (the lane's / reviewer's) |
|---|---|---|
| K1 feel & play | stick base in client coordinates (P0 #2); mantle city-only; F / D / A P1 items (garbage, talk-target guard, prompt label epoch, time of day on a world switch, ferry chip, otter egg off the deck, heave-ho vs boarding, rings prefetch); the Hyde St ride camera | real-iPhone pass; Hyde St tree canopies still dither over the rider; glide's per-frame report object |
| K2 flow & UI | Settings holds the ride and the tour dwell; More menu wins over ARRIVED; 国际橙; 飞行券 gating (welcome, goals step, lead, tour, onboarding reset); reward queue before the ledger; deck area; quiet resume; Grand Tour 36 / 29 min; 90 s leaked-hold timeout; STATUS.md rewritten | Settings does not freeze all traffic (decision); underground Metro ignores the pause brake; phone bottom bar over Settings' last row on open |
| B bus review & transit | the W5-bus adversarial review (3 defects: transit through the player's car / bike, the previous reviewer's edits kept with tests, Market St box waits 47 → ≤ 7 s); M stop San Jose & Mt Vernon retired (SFMTA, 2024-09-28); zh cable-car stop names; Sausalito quay waived | a parked empty car / bike and BAYBAY on foot are still driven through; Castro hairpin 26 s / Hyde & Chestnut 46 s waits; `Powell & Market 转车台` wording |
| P first-load size | play layer, autopilot, city residents / arrivals, photo capture, high-tier post behind chunks: GameRoot 300.4 → **279.1 KB** gzip | ≤ 265 not reached (≈ 14 KB in other lanes' per-frame code: sized Requests 1–5 in `sf-w6-P.md`); a failed-import retry for loadDrive |
| H Halloween world | 2062 dressed stoops, trick-or-treater figures, bats, Sutro haunt, low October fog; the 40-lantern hunt (+ milestones); Día de los Muertos in the Mission | orange dusk tint (fog.ts not H's), static figures, bats hard to see at full night, no procession walkers, one stoop overlaps a treat door, postcards not yet shown |
| G Halloween games | trick-or-treat on 6 real streets (54 doors, `door:n` / `night:n`), candy bag, 4 costumes (sold in season), the 万圣节 Journal page, 22 BAYBAY lines | pelican costume (needs a charApi slot); no goals-card row; seasonal items first on the shelf; 3-line phone pill near a street |
| S site sync | SF events shown 18 → 38 (Halloween first), 5 new venues, Ferry Building market hours, 3 new-shop signs, 2 new museum offers in live.json | November has no SF events in the catalog; board venues' pennant pole through the board; Handroll Hawker waits (announced only) |
| W more SF & play | North Beach seam (92 OSM buildings), the North Beach corner (+2 calls), Lyon St Steps race, hide & seek with BAYBAY (+ a coach line) | FiDi's south-edge empty blocks (46 buildings); the Give-up button 74 × 36 px on phones (shared PlayChip); North Beach area pill reads 唐人街 at Columbus |
| X visuals, sound, assets | 4 Halloween postcards, synthesized Halloween SFX + the 31 Oct toll, cuter city walkers (eyes, blush, hands, varied skin / hair), 80 Halloween voice clips, the Halloween title key art; **15.70 credits** | weakest items 2–4 of its city shoot (box blocks downtown / Chinatown, the flat day sky, the gulls), GLBs (procedural kept), V's voice batch 5, the owner's ear |

## 3. Final verify (W6-Z) numbers

See `sf-w6-final-verify.md` for the full tables. From W6-Z's runs (alone on the machine, PERF-LOCK 05:52–):

| gate | result |
|---|---|
| `npm run check` (lint, 2246 tests, build, prerender 519 pages, 494 share cards) | **pass**, EXIT 0 |
| perf desktop 1440 × 900 high (≤ 150 calls / ≤ 400k) | 23 / 23 spots pass, max **122 calls / 354k**, 60 fps |
| perf phone 390 × 844 mid 4× CPU (≥ 45 fps, 0 frames > 100 ms) | 21 / 23 pass; grace-nob-hill and filbert-steps had one frame > 100 ms each — W6-Z re-ran them on the W5 baseline tree, which fails filbert-steps the same way (machine noise, not a wave-6 regression) |
| Halloween night spots (`?halloween=night`) | desktop 101 calls / 328k, phone 66 calls / 229k, 55–60 fps: pass |
| static sweep, 688 targets | 545 ok · 142 CORRIDOR · **0 boxed · 0 snag** · 1 unreachable (T3 SS Jeremiah O'Brien, as W5-Z) · 0 off |

## 4. Higgsfield

Cap 1000 (owner), lane X only, floor 1375. Spent **15.70** (postcards 10.00 · voice 1.70 · key art 4.00); balance 2375 →
**2359.30**. `ledger/w6-X.md` is merged into `src/opus-bay/ASSETS-LEDGER.md` § "Wave 6 (local)". X shipped a generated
asset only where a side-by-side shot beat what was there, so most of the cap is unused: the next wave can spend it on the
weakest things X listed (downtown box blocks, the day sky, gulls) and on the owner's listening feedback.

## 5. NEXT (wave 7 candidates)

**P0**
1. The owner's ear: 80 Halloween clips + SFX (`docs/opus-bay/qa/w6/X/voice/listening.md`), the three W5 muted clips.
2. A real iPhone pass (stick under a toolbar resize, the album's share sheet, private mode, 375 × 667).
3. Show the 4 Halloween postcards (hunt end, big night, trick-or-treat, muertos) in H / G's reward flow before 10/31.
4. GameRoot 279 → ≤ 265 KB (P's Requests 1–5).

**P1**
5. Halloween polish before 10/31: the pelican costume (charApi attach slot), animated trick-or-treaters / ghosts, brighter
   bats at night, the orange dusk tint in `world/sf/fog.ts`, seasonal items first on the shop shelf, the phone pill height,
   the one overlapping stoop / door, Día de los Muertos walkers once the 2026 date is published.
6. Transit leftovers (B): parked empty car / bike and BAYBAY on foot as transit blockers; the long courtesy waits;
   `Powell & Market 转车台` wording.
7. X's weakest-things list with the unused Higgsfield cap; V's voice batch 5; voice for W's new lines.
8. Small UI: the shared PlayChip Give-up button ≥ 44 px; North Beach's area pill at Columbus; Jefferson St reads 北滩 on
   the loop bus; the Settings sheet's last row under the phone bottom bar.
9. The owner's live dates: Oct 2–4, Oct 9–11 (jets), Oct 31, Nov 1 (DST).

## 6. Where things are

`src/opus-bay/RESUME.md` (top section "WAVE 6 DONE / LIVE") has the state, the paths and how to continue.
