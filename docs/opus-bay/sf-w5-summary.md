# Wave 5 · summary and hand-off

Written 2026-09-28 (PDT; 2026-09-29 ≈ 04:10 UTC) by the lead's summary writer in `C:/Users/willy/wt/w5-verify`, on
`origin/opus-bay` **`a45f5afd`** (W5-Z, the final verify). Sources: the plan `sf-w5-plan.md`, the lead note
`sf-w5-lead.md`, the ten lane reports `sf-w5-{F,N,C,T,L,V,E,A,D,R}.md` (parts a–c and each lane's `## Review`), the final
verify `sf-w5-final-verify.md`, the credit ledger `ledger/w5-V.md` and the Higgsfield `balance` / `transactions` tools
(read only). How to continue: `src/opus-bay/RESUME.md` (top section) and §6 below.

## 给主人的摘要

1. **现在直接打开 /opus-bay 就是整座旧金山**（加 `?world=district` 还是原来的渡轮大厦街区，一点没变）。第五波 10 条线全部做完、逐条复查、总验收通过；手机包已按最新版重打：http://10.0.0.85:4174/opus-bay 。
2. **不卡了**：落地、下车、到达、看完镜头以后，"能不能动"每一帧自动判断，不再要"对话一次才能走"；手机正式包实测四种落地 0.6–0.9 秒就能走。
3. **走得动**：贴着栏杆、码头边会顺着滑过去，矮墙矮篱自动翻过，稍高的台阶会扒住边爬上去；真被卡住，BAYBAY 会跑来"嘿咻"把你拉出来。
4. **走得动**：机器人把全城 684 个点逐个走了一遍，被围死 0、卡脚 0（中期检查时还有 14 个被围、19 个走不到）；金门大桥桥面按住"前"一路走到底，手机斜着推摇杆也不会再掉进栏杆边的小坑；观光巴士一圈 16 站约 16 分钟，一次没停住。
5. **鹈鹕**：开局第一个目标就是"去科伊特塔找鹈鹕"（BAYBAY 带路约 40 秒）；到山顶鹈鹕飞下来落在你们身边，点"试试起飞"就是第一次飞行（8 个金圈，圈里有金币）；之后手机上"起飞"按钮一直都在，还可以让鹈鹕自己"看风景飞过去"。
6. **一键导航**：地图上点地方、再点大按钮，两下就出发；长按地图任意位置可以"去这里"；碰摇杆自己走，点"自动跟上"又交还给 BAYBAY；老玩家打开游戏直接"继续旅程"，回到上次的位置；路上不再一个个弹提示。
7. **金币小铺**：全城 60 条金币小路（每天按旧金山日期刷新）、40 个金币小堆、15 个空中金币圈（要骑鹈鹕穿过去）；"更多 → 小铺"或渡轮大厦旁的摊位能买 BAYBAY 的围巾帽子、你的帽子背包、车漆、鹈鹕丝带、相框，先试穿、买下直接戴上。
8. **金币小铺**：普通玩家第一小时约攒 450 金币，5 分钟内就买得起第一件；只卖好看的，不卖速度，不用真钱，没有连续签到。旅行本里新增"手帐"（印章、小发现、看风景、城市之声、足迹）和"相册"（照片存在这台设备上，iPhone 可以存到照片）。
9. **动作小游戏**：点自己出动作轮（挥手、跳舞、躺草地、和 BAYBAY 自拍），双击 BAYBAY 摸摸她；随地坐下，16 个观景点慢慢看风景；西沃德街纸板滑梯、缆车摇铃对答、和 BAYBAY 比赛爬台阶。
10. **动作小游戏**：还有海滩篝火烤棉花糖、转盘"嘿咻推"、12 个坡顶飞车、数海狮、飞盘、沙滩球、草坡滑草、九曲花街慢慢开、金门大桥绕塔金圈；六位邻居各多了一个小忙，做完会给你寄信。
11. **彩蛋**：33 个真实旧金山小发现（电报山野鹦鹉、雾笛二重唱、大丽花 100 岁、跟着真太阳走的日晷……每条都有出处和核对日期）、12 种城市之声、BAYBAY 的 48 块小石子（攒够会学新把戏）、6 张彩蛋明信片；BAYBAY 偶尔悄悄说一句"听说……"给你线索。
12. **真实旧金山**：天色跟旧金山真实日出日落走；BAYLINK 上这周的活动出现在真实场地（10/2–4 金门公园免费蓝草音乐节、10/4 卡斯特罗街集），10/9–11 中午 12 点到下午 4 点有舰队周玩具飞机编队飞过码头绿地。
13. **真实旧金山**：旅行本"今天"页一眼看完今天的旧金山（时间、日落、月相、潮汐、今天免费的地方、今日三件小事）；海滩篝火只在 3–10 月亮；万圣节老房子台阶摆满南瓜灯；车站卡片写着真实班次和"现实中怎么去"。
14. **画面性能**：外围街区晚上有路灯，海湾大桥亮起 Bay Lights，Salesforce 塔顶慢慢变色，月亮是今晚真实的月相；9 个有特色的街角（尔文街面包店排队、24 街剪纸旗、唐人街红灯笼……）；BAYBAY 新录 194 句中英文语音。
15. **画面性能**：电脑 20 个测点全部 60 帧，最多 119 次绘制、35.2 万三角形（上限 150 / 40 万）；手机模拟（CPU 降速 4 倍）最低 52.8 帧、0 次卡顿；全站 2076 个测试、小游戏 1356 个测试全部通过。
16. **还没做完**：真 iPhone 实测、首屏包 299 KB（目标 265）、正式网站的安全设置和 /opus-bay 路由（正式站还没有这个游戏）、几个小问题（金门大桥下的海獭彩蛋会在桥面上触发、小铺写"国际橘"而大桥台词写"国际橙"等），都在最后的 NEXT 清单里。
17. Higgsfield 这一波只花了 **25.07 分**（上限 130），余额 **375.00**；需要你亲耳听一下的 3 条语速偏慢的录音先静音了（试听单 `docs/opus-bay/qa/w5/V/voice/listening.md`）。

---

## 上线（2026-09-29）

- 已合并到 `main` 并由 Vercel 部署：**https://www.baylink.us/opus-bay** 打开就是整个旧金山；`?world=district` 仍是原来的 Embarcadero 小街区。
- 上线前补上的：开始界面和设置里可以切换 **简体 · 繁體 · English**（立刻生效、全站记住）；**车辆卡死修复**（前车挡路 2 秒会让开，自动驾驶会绕过停着的车，叮当车 / 电车 / 巴士不会互相等；20 分钟模拟全程无卡死；审查按主人要求跳过，下一波补做）；正式网站的 `/opus-bay` 路由和让 3D 模型解码的安全设置（实测 0 拦截）。
- 新窗口继续：说"继续 Opus Bay"，先读 `src/opus-bay/RESUME.md` 顶部，再看本文件 §5 NEXT。

## 1. Wave 5 at a glance

- **One day, every step.** W5-0c merge of `origin/main` `27073fda` → the plan `26b8be4` → day 0 (W5-0b hotfix
  `826c6588`, W5-0d frozen contracts `436c888b`, W5-0f/0g lead note `1965e3c1`) → ten lanes in parts a / b / c → the mid-wave
  checkpoint (findings CP-1 … CP-14, fixed in the lanes' part c; the checkpoint has no report file of its own) → ten
  adversarial reviews (`## Review` in each lane report) → W5-Z. All of it on 2026-09-28 PDT; the plan's calendar
  (builds Oct 1 / 7 / 14, W5-Z Oct 16) was compressed, not skipped.
- **252 commits** on `opus-bay` after the plan, `26b8be4..a45f5afd` (A 36, N 31, V 30 with one lead fix, F 27, C 24,
  T 24, E 23, L 22, R 15, D 13, day 0 3, W5-Z 4). Opus-bay suite **918 → 1356** tests (32 new
  `tests/opus-bay-w5-*.test.ts` files); `npm run check` **2076 / 2076**.
- **Default world flipped to the city** (`a2ca9204`, `DEFAULT_WORLD_MODE = 'city'`); `?world=district` is the district
  exactly as before; node (tests, QA scripts without `location`) keeps the district (`NODE_WORLD_MODE`).
- **District mode unchanged** on every review (hero regression, `FIRST_TOUR`, the district title diorama 71 calls /
  225,070 triangles / 66 programs). Two known, deliberate-but-undecided district touches are in NEXT (the mantle, the
  photo caption fit).

| must-fix | status at W5-Z | evidence |
|---|---|---|
| MF1 never stuck after a landing | **done** | derived lock (F `b094085e`), watchdog; phone production 0.58–0.94 s |
| MF2 forgiving movement, rides, GGB deck, open arrivals | **done** | sweep 684: 0 boxed / 0 snag; deck both ways 4.16 u/s; bus lap 15.9 min, no stall |
| MF3 the pelican first | **done** | goal #1; moment 49.8 s after the goal tap; first flight 8 / 8; 起飞 24 / 24 |
| MF4 one tap to go anywhere | **done** | map → moving in 2 taps, 0.5 s |
| MF5 coins, ledger, shop, safe save | **done** | coins 0 → 119, scarf bought and worn, save `play.w.baybay-scarf = 2`; day-0 save trim |
| MF6 resume, goals once, quiet HUD | **done** | 继续旅程, the goals step card once, "+n 个地点" chip (N, C) |
| MF7 the real city visible | **done** | real sun, venues, events, 今天 tab, jets (R) |
| MF8 something to do everywhere | **done** | 16 view spots, 12 activities (A), 33 eggs, 12 sounds, 48 pebbles (D) |
| MF9 room first | **partly** | downtown levers (V, T, F): max 119 calls / 352k; phone min 52.8 fps; **GameRoot 298.62 KB vs ≤ 265 open** |
| MF10 the whole city looks finished | **mostly** | 9 corners, lit outer nights, Bay Lights; the North Beach corner waits for a seam gap fix |

## 2. Lanes

Each lane: what shipped · key commits · the review · what is still open (items a later commit closed are marked).

### F · Feel & feet (27 commits; `sf-w5-F.md`)

- **Shipped.** MF1 root fix: `game/playerLock.ts` `deriveLock` is the only writer of `runtime.player.locked`, re-derived
  every frame from the live holds, 14 landing / arrival paths tested; the `charApi` implementation (dance, lie, sit
  ground, float, pet, attach / tint, vehicle paints, glide soft boxes); 起飞 always on foot after the unlock (+ a pulse);
  `faceOpen` for landings and hop-offs; the sweep tools `scripts/opus-sf/qa/{sweep-static.mts,walker-sweep.mjs}` and
  runs 1–2d; forgiving feet (slide along rails, vault low blockers, BAYBAY's 嘿咻 pull, R); the GGB deck steering and
  camera (`actors/deckSteer.ts`); levers (low-poly shadow proxies, far parked rides not drawn); the phone overlay layout
  (the city pill opens the Journal on 今天); CP-12 (Twin Peaks alight, the arrival card shares the thumb); `pelicanGreet`;
  the mantle (0.45–1.6 u); the bus / LRV ride shot; the scenic auto-glide (`moveApi.autoGlide`).
- **Key commits.** `b094085e` derived lock · `b76a7177` charApi · `a3339730` 起飞 · `43f975d7` faceOpen · `362bdc6c`
  sweep tools · `6232123f` feet + deck · `877dc596` levers · `98a9d324` phone layout · `d56438d3` CP-12 · `755f55ab`
  mantle, ride shot, auto-glide · `f8ddb7fc` sweep run 2.
- **Review** (`f734abce`, 8 defects): the first push after a seawall landing walked into the rail; a pull could drag the
  player back; the far double-tap on BAYBAY opened the call menu on phones; district behaviour restored; `charImpl` moved
  to a lazy city chunk (−2.8 KB); 国际橘 → 国际橙 for the paint.
- **Open.** The mantle also runs in the district (lead decision); leaked `activity` / `shop` / `panel` holds are never
  dropped by the watchdog (a long timeout?); per-frame garbage on the deck (`deckAt` / `deckWish` / `laneClear`) and in
  the auto-glide; the floating stick keeps its base relative to the canvas rect (W5-Z: a mid-touch rect change reversed
  the walk; an iOS toolbar resize might too); deck feel at ≥ 60° into the rail (stops at the edge, not a trap); guard
  BAYBAY's far talk target (re-plans a 370 u path every ~4 s when a dialogue stays open across a teleport; with C); the
  E prompt label goes stale when an interactable renames in place (re-read on `interactablesEpoch`, lane R's review);
  `useTimeOfDay` does not re-run on a world switch; the ferry's move chip says 车厢里; the Hyde St ride camera clipped a
  wall once (lane T's review); the remaining city-only main-graph code (`deckSteer`, auto-glide, the pelican greeting).

### N · Navigation, map & travel (31 commits; `sf-w5-N.md`)

- **Shipped.** `game/goTo.ts` (one tap; BAYBAY carries you leg by leg; the pelican is 推荐 for trips over a minute, also
  to undiscovered places); `registerFlagSource`; `FootprintsTab`; title resume 继续旅程 at the saved spot; the phone map
  (pinned card, "+n" chooser, long-press 去这里, search rows with go buttons); a quiet HUD ("+3 个地点" chip, trip
  pass-bys silent, the GGB deck names itself); 这周 on the map (coral calendar pins); trip ends moved to open ground and
  lane L's site arrivals wired; CP-1 (step aside for a waiting car), CP-2 (no ghost OSM click), CP-7 (Fort Point, the
  bison paddock), CP-13 (no English in the zh HUD); 看风景飞过去 on lane F's auto-glide with 让 BAYBAY 接着飞.
- **Key commits.** `73dabe9c` goTo · `529f2381` resume · `3b00896e` one tap · `de13ff31` phone map · `e4c17c03` quiet
  HUD · `af8f50fb` 这周 · `55668a82` / `23424097` trip ends · `2fadc321` CP-1 · `c1b57fa8` CP-2 · `dd19cf15` scenic
  flight.
- **Review** (`992eb7b0`, `066c8432`, `fc4950ef`; 6 defects): 这周 pins off screen / under the tools; long-press names in
  English; iPhone text selection on long-press; a long-press firing after the map closed; two flight rows lit at once;
  让 BAYBAY 接着飞 dead near the goal. 14 facts re-checked (the SS Jeremiah O'Brien is at Pier 35, not 45).
- **Open.** The 39 CORRIDOR trip ends (4 T1: the Wharf, the Ferry Building marketplace, the Dragon Gate, Stonestown):
  W5-Z flipped on lane F's reading (CORRIDOR = two ways open, not stuck) — write the named waiver; `trip:ss-jeremiah-obrien`
  (the nav path ends 4.8 u short); a resumed player's first discovery batch should be quiet (lane C's request); Irving
  St's site arrival BOXED and Haight & Ashbury's SNAG stay parked in `SITE_ARRIVALS_WAITING` (with E's `stop-haight`
  coin); an arrival card can show while the pill still counts down; 陪 BAYBAY 散步过去 (could, needs E's trail API).

### C · Content, flow & tours (24 commits; `sf-w5-C.md`)

- **Shipped.** Public content hooks (`registerRumourSource`, `registerFrameDecorator`, `onWelcome`); the pelican first
  (goal #1, any of six viewpoints, the tour's first stop, the unlock moment → lane A's first flight, 以后再说 pulses 起飞);
  the goals step card shown once; welcome back; rewards emitted to lane E's ledger; the GGB deck goal (both towers,
  1280 m line); BAYBAY carries the Grand Tour; the tour quote re-timed to 约 34 / 约 25 分钟 (measured 36.1 / 28.5);
  11 frozen lines (tag `w5-c-lines-frozen`); CP-14 (city names on the waterfront POIs, the moment's pair on your level);
  the photo album (IndexedDB, share sheet on phones); six second favours and letters; 现实中怎么去 on the cards.
- **Key commits.** `9a17500f` hooks · `d65a0ef1` pelican first · `0143daba` deck goal + carried tour · `6f50f975` /
  `7d06b800` CP-14 · `d8324715` album, favours, letters · `3bcb30ac` HowToGo.
- **Review** (`d1d87374`, `447a4dd3`, `869b8e4c`, `b54b76f5`, `2584d172`; 9 defects): the goals card's time matches the
  carried trip (约 40 秒); **lane C's 11 recorded lines now play** (closes lane V's review item 4); J / 旅行本 open on 今天;
  the pelican moment waits for the summit (not halfway up the Filbert Steps); the English phone tabs no longer run
  together; Hank's bulbs, the Balmy / Clarion names.
- **Open.** Lane E gives the first 飞行券 while goal #1 is being led and refunds it 40 s later at Coit (still in
  `economy/shopRun.ts`); a `reward` emitted before the ledger listener is live is never paid (order the moments after
  `initW5Features().ready`, or re-check `isPaid`); `brain.ts updateFocus` ignores height (the deck's first quarter says
  要塞公园); the new-save goals card can open over lane D's ringing phone; the Grand Tour re-timed end to end at a
  verify; `fitCaption` also shrinks long district photo captions (a tiny district change); 今天免费 chips and the coast
  cards' tide row (R's request); part c's resident lines as voice; residents' texts still in GameRoot.

### T · Transit & crowds (+ audio internals) (24 commits; `sf-w5-T.md`)

- **Shipped.** Hooks (crowd spots with the 3 u clear lane, the crowd's wave back, `rideEta` from real progress, the bell
  pad slot, the turntable beat); the sightseeing bus never stalls (the toy traffic gives way; the bus watch; ≤ 45 s wait at
  the Ferry Building; 直接到站 grows after 10 s stopped); the tour bus boards without the driver question; levers (the
  district's ambient life culled per instance by distance, mid-LOD cable cars / F-line cars, near-only shadows);
  crowds keep clear lanes (the GGB deck's middle, event stages); `audio/hooks.ts` internals (rate limits, loop caps,
  stacked ducks); CP-3 (the poles and kiosks of 17 N / M stops re-stood on pavements), CP-11 (the loop bus at the cable-car boxes:
  max wait 46 → 14.7 s); real SFMTA service rows on station cards; spare cable cars to the barn at night; pigeons.
- **Key commits.** `d0bcb320` hooks · `069a8a47` bus stalls · `97c02814` audio · `5a0aae16` levers · `e1444763` clear
  lanes · `f1a8b71e` CP-3 · `26421691` CP-11 / T7.
- **Review** (`72d16787`, `c5e83e4a`, `40a0220a`, `b3b05326`, `3d113a97`, the cable-car dispatch commit `5f073b85`; 5
  defects): a false 车停住了 while boarding (ferry, turntables); Hyde St waits of 1.5–2 min (a car brought in at ≥ 110 u
  after 12 s); SFMTA midday headways by day column (N / M 12 min at weekends; the N is a bus early and late); the Harvey
  Milk Plaza pigeons.
- **Open.** Retire `muni-san-jose-mt-vernon` (the M no longer stops there since 2024-09-28; lane F's review, still in
  `data/sf/stationNames.ts` and `transit.json`); zh names for some cable-car stops (California & Van Ness); the loop bus
  and a cable car share Hyde St's box (a 16 s wait); lead: should cable cars offer 直接到站 while waiting (≈ 60–85 s at a
  turntable)?; `ferry:sausalito` is off the model (a waiver or a quay).

### L · Landmarks & streets (+ tier 3) (22 commits; `sf-w5-L.md`)

- **Shipped.** 13 tier-3 sites (McLaren Park's water tower, the Mountain Lake overlook, Alta Plaza, Buena Vista's top, …),
  then the Wave Organ and Ina Coolbrith Park in part c; 29 site arrivals judged and fixed (`data/sf/siteArrivals.ts`, wired by N); the Ocean Beach fire
  rings in the real season and hours (R's `isFireRingLit`); the Seward slides' top deck for lane A; signature corners 1–8
  (Irving, Clement, 24th St, 3rd St, Haight, Japantown, Noe Valley's Saturday market, Castro) on lane V's signs atlas,
  ≤ 2 calls / ≈ 1.5k triangles each, on Bay time; CP-8 (route stops at Fort Point and the Tea Garden gate); the Chinatown
  corner on Grant Ave (lanterns, 1925-style dragon lamps).
- **Key commits.** `e0d0b8eb` tier-3 + arrivals · `561e24d9` fire rings · `795cfccc` Seward · `861a2738` corners 1–4 ·
  `a119a596` corners 5–8 · `8000e8ae` CP-8 · `90291cbc` Chinatown.
- **Review** (`27acd967`, `f16a0ecd`, `64af9eee`; 3 defects + 1 fact): the Wave Organ jetty trapped the player (granite
  steps both sides); corner crowds invisible from their arrivals (pins ≥ 3 u); figures inside walls; the Wave Organ opened
  8 June 1986.
- **Open.** The North Beach corner: Washington Square → Columbus is an empty seam between the city and the old district
  (V + lead first); Fort Point's own site arrival; Irving / Haight arrivals (with N, E); Chinatown's five identical clear
  lanes (cheap); the Lyon St steps have a gap (lane A's stair course).

### V · Visuals, performance, voice & assets (30 commits; `sf-w5-V.md`)

- **Shipped.** The wave-5 gate table `scripts/opus-sf/qa/perf/w5-spots.json` (20 spots + 3 rides + night + event days)
  and a runner that splits long tables (`w4-perf.mjs`); levers (waterfront residents hidden beyond 250 u, the hero
  district's far detail tile by tile: Chinatown 393k → 334k); the warm-up recipe (`world/warmup.ts`); the flag glyph
  atlas 512²; the signs atlas (bilingual canvas plaques, + Japanese for Japantown); lit outer nights and coin glints; the
  city data chunk (CP-10: landmark cards, SF postcards, photos out of GameRoot, −21 KB); the Bay Lights, the Salesforce
  crown, the real moon phase, Karl by month; voice: 194 new BAYBAY lines × zh / en (388 Pixie clips, a text-matched
  binder); six secret postcards; the CSP finding and `scripts/opus-sf/qa/csp-serve.mjs`.
- **Key commits.** `eed45b46` gate table · `7ade613b` / `6112ba94` / `490022ff` levers · `1f7629b6` warm-up · `cf3dd821`
  signs atlas · `da331c96` lit nights · `82bf29b9` voice + postcards · `b0bf1e3f` / `2bda42fb` CP-10 · `cef43f9b` Bay
  Lights, crown, moon, Karl · `d8b2c26f` voice batch 4 · `af0c8e30` gate runner. Lead fix `4fb3e6ef` (the flag shader).
- **Review** (`5a3a29dd`, 1 defect): two notebook postcards shared a name (雾笛响起的时候 / 市花大丽花一百岁 now), with a test.
- **Open.** **GameRoot 298.62 KB vs ≤ 265** (the levers are other lanes' code: F city-only actors ≈ 8 KB + vehicles
  12.8 KB, C's POI bodies / script / residents ≈ 29 KB, N's city-only modules ≈ 7 KB); **`vercel.json`**: CSP
  `'wasm-unsafe-eval'` + `blob:` in `connect-src` (else every AI GLB falls back to its procedural build in production)
  and an `/opus-bay` route; the Marina Green gate spot is 18 u off lane R's venue; a failed city data chunk request fails
  the whole city page (no fallback, by design); re-record: egg 2's changed first line (`w5-d-6f8ba0b8`), the Spreckels
  line, lane A's Lombard line and 滑得真顺～, lane C's part-c resident lines, lines added after 21:00 UTC; the owner's ear
  for three muted clips (en "Me first! Again?", zh 好看！买下啦。, en "Golden! Crisp outside, gooey inside!"). Closed:
  the phone fps gate (W5-Z passed it), the silent pelican moment (C review `447a4dd3`).

### E · Economy & notebook (23 commits; `sf-w5-E.md`)

- **Shipped.** `economy/**`: the ledger (every reward source paid once, `coins` events, 5000-step random test); coin
  spots (60 daily trails / 366 coins, 40 caches, 15 air rings; placed by `scripts/opus-sf/coins-place.mts` with the
  sweep's judge); coins in the world (one instanced layer, chimes, glints) and the 🪙 pill badge; the 手帐 (印章 ·
  小发现 · 看风景 · 城市之声 · 足迹 + 我的记录, page rewards, "明天可能不一样", no streaks); the shop (More → 小铺, the
  Ferry Building stall on non-market days, try-on, 23 cosmetics), the compass and the magnifier, the 飞行券 rule;
  CP-5 (9 stuck coin spots); prices locked by `scripts/opus-sf/economy-run.mts` (≈ 450 coins in a typical first hour;
  scarf 70, hat 150, player hat / pack 50, paint 110, ribbon 90, frame 60, compass / magnifier 20, ticket 10).
- **Key commits.** `780018e3` ledger · `df85f5f0` coin spots · `f8eea2fc` coins + pill · `7d43e5bd` notebook, shop,
  ticket · `58d674d5` / `3a8f0860` CP-5 · `8d712077` prices · `08b5e1b9` / `9b21f1aa` notebook shoulds.
- **Review** (`b1749cbe`, `21f7ddba`; 8 defects): one sheet at a time (the shop closes under the Journal / map / photo);
  the 手帐 sunset as the almanac prints it (closes lane R's request); the ticket's 16th must-see (Alcatraz); the gift
  after a reset; 44 px touch targets; per-frame garbage; no pickups while paused; the compass arrow's full spin.
- **Open.** The shop's items still say **国际橘** while lane F's paint and the GGB lines say 国际橙 (pick one in
  `data/VOICE.md`); the first 飞行券 during goal #1 (C's request); prices: raise scarves / frames a notch if a live hour
  buys more than 5 cosmetics; a ring's eight coin chimes ring as one chord (a stagger needs a delay in the frozen
  `playSound`); the toys shelf / unlock ladder; H5-1 painted shop tiles (V chose the try-on previews).

### A · Activities & actions (36 commits; `sf-w5-A.md`)

- **Shipped.** `play/**`: PlayKit (result card 好 / 很好 / 太棒了, medals once, bests, cancel on any move); the first
  flight (8 rings Coit → Ferry → PIER 39, `startFirstFlight()` for C); the emote wheel, the selfie, petting and BAYBAY's
  float; sit anywhere + 16 view spots (a 20 s slow look, +5 coins, a 看风景 stamp); the Seward slides (real hours), the
  cable-car bell riff and lean-out photo, stair races (Filbert, 16th Ave) and the step counter; CP-9 (every view spot
  reachable); nine shoulds: marshmallow (real fire season), turntable heave-ho, 12 crest hops, sea-lion count, frisbee,
  beach ball, grass sled, the Lombard / Vermont gentle descent, the GGB-towers ring course.
- **Key commits.** `2fec2d01` PlayKit + first flight · `c76fd203` emotes, pet, sit, views · `375dfc1b` slides, bell,
  stairs · `809625dc` CP-9 · `fc36ecbf` … `6290e6bb` the nine shoulds.
- **Review** (`7048283e`, `34ed9d65`, `910e5e46`, `8befec09`, `13c32c5e`, `24337fe7`, `ebeeb480`; 8 defects): the GGB
  rings no longer hijack a scenic flight; leaving the city ends an activity and frees the feet; reset clears bests and
  counts; 滑草 only on ≥ 6 u slopes and never over a seat; metres, not u; the Lombard sign "recommends" 5 mph.
- **Open.** Bell mashing reaches ★ 爵士大师 (a design call); prefetch `play/rings` at the unlock (its material compiles
  at lane C's hand-off moment); the heave-ho prompt (12.5 u) takes E over Powell & Market's boarding prompt; small
  per-frame garbage (stair race, bell pad); not built: the painted view card, Karl / dusk lights in the slow look, the
  crowd's wave-back shot, hide & seek (could), the Lyon St course, the crooked descent by vehicle (the car cannot take
  Lombard's first hairpin).

### D · Discoveries & easter eggs (13 commits; `sf-w5-D.md`)

- **Shipped.** `eggs/**`: the append-only registry (24 + batch 2 = **33 eggs**, riddles, sources, check dates); hosts
  (reveal, the find card, props, the flock, camera beats and glances); 听说… rumours (one at a time, only findable
  today, ≤ 1 per 5 min) and the compass source; CP-6 (the humpback from the deck is a glance, the walk never stops);
  **城市之声** (12 real sounds, 听一听 for 3 s); **BAYBAY's 48 pebbles** (6 per area, tricks at 10 / 25 / 40, a gold one);
  lane V's six secret postcards on the cards.
- **Key commits.** `307c2098` registry · `92381989` hosts · `7f0d8c70` eggs 13–24 + rumours · `2bf31f72` CP-6 ·
  `7160f337` 城市之声 · `508d4f06` pebbles · `ead7e089` batch 2.
- **Review** (`1c710693`; 6 defects): reset mid-session starts lane D over; the Chinatown phone egg no longer lost for the
  day on a hang-up; the find card / 听一听 ring above the phone's arrival card; the sea lions "from the autumn of 1989";
  teardown timers; 10 Hz garbage. 36 facts re-checked.
- **Open.** The sea-otter egg (`baybay-otter-roots`, ground under the bridge) fires on the GGB deck 15 u above it (W5-Z);
  the Castro prints rebuild the prop pool at 10 Hz for ≈ 8 s; not built: the Hyde St Pier ships, the beach wreck.

### R · Real San Francisco (15 commits; `sf-w5-R.md`)

- **Shipped.** `realsf/**`: SF's real sun in city mode, the fire-ring season, the moon, Karl by month (the §4.3 hooks);
  the venue table and events in their real window (Hardly Strictly at Hellman Hollow Oct 2–4, Yerba Buena Gardens Oct 3,
  the Castro Street Fair arch Oct 4: pennant, crowd, kit, loop, 带我去); the **今天** tab and 今日三件小事 (+10 each, +20
  for all three, no streaks); **Fleet Week** toy jets Oct 9–11 12:00–16:00 (six, four on phones; the Marina Green
  souvenir); NOAA tides and BAYLINK's own offers baked at build time (`scripts/opus-sf/export-tides.ts`,
  `export-live.ts`); the verified calendar (Halloween pumpkins, king tides); 现实中怎么去; the full-moon line.
- **Key commits.** `ac1a5b1b` sun, season, moon, Karl · `26ac9035` venues · `12416d34` events in the world · `d2b7bce4`
  今天 + daily three · `5eee52e8` Fleet Week · `b4e85231` tides + offers · `02fcf708` calendar.
- **Review** (`99eb2585`, `1ed4462f`; 7 defects): sun times a minute early; yesterday's three after midnight; the jets'
  line after you left; the jets photo framing; the Halloween row said more than its source; 带我去 too small on phones.
- **Open.** Event kits have no walk blockers; nobody has listened to the loops or the jet roar; the daily three can be
  re-dealt if the catalog arrives after a failed load; Día de los Muertos stays hidden until a 2026 date is verified; the
  catalog ends on 2026-10-31 (ask the site editors for November SF events and `location {lat, lng}`). Closed since the
  review: the pill and J open on 今天 (F `98a9d324`, C `869b8e4c`), the phone tab overlap (C `2584d172`), the notebook
  sunset (E `b1749cbe`), the jets in the gate (W5-Z Marina Green event run).

### Lead (day 0 and W5-Z)

- Day 0: `826c6588` W5-0b hotfix (`game/playerLock.ts`, `game/lockWatchdog.ts`), `27073fda` W5-0c (the 2026-09-27 site
  data), `436c888b` W5-0d (events, `bayNow`, `playSave`, UI slots, `charApi`, audio hooks, the four feature stubs; 11
  contracts tests), `1965e3c1` W5-0f / 0g (lead note, DESIGN §8 carve-out, VOICE glossary, balance).
- W5-Z: `b61979f5` (the perf harness answers an open dialogue before each teleport), `78efcf32` (the GGB deck's ragged
  rail edge is a wall; the find card shares the thumb; `tests/opus-bay-w5-final.test.ts`), `a2ca9204` (the city is the
  default world), `a45f5afd` (the report + five phone QA sheets in `docs/opus-bay/qa/w5/final/`).

## 3. Final verify (W5-Z) numbers

| gate | result |
|---|---|
| `npm run check` (lint, all tests, build, prerender, share cards) | pass: 2073 / 2073 before W5-Z, **2076 / 2076** after; 0 lint errors (43 old warnings); 307 pages; 282 cards |
| `tsc -p tsconfig.app.json` | 0 errors |
| opus-bay suite | 1353 / 1353 → **1356 / 1356** (hero regression, district, contracts green) |
| perf desktop 1440 × 900 high RTX (≤ 150 calls, ≤ 400k) | pass: 20 spots, 3 rides, night, 3 event days; max **119 calls / 352k**; 60 fps; 0 frames > 100 ms; programs 60 → 60, 78 → 78 |
| perf phone 390 × 844 dpr 3 mid 4× CPU RTX (≥ 45 fps, 0 > 100 ms) | pass (run 2): min **52.8 fps** (FiDi walk), 0 frames > 100 ms; run 1 failed only on the harness's open dialogue |
| perf phone iGPU subset | pass: Ferry gate 53.4, Chinatown 56.5, Twin Peaks 60.1, Music Concourse 59.5, Ocean Beach 60.1, bus 59.2 |
| auto quality, phone profile | picks mid (pixel ratio 1.25; production `q mid (device)`) |
| static sweep, 684 targets | 547 ok · 135 CORRIDOR · **0 boxed · 0 snag** · 1 unreachable (T3 SS Jeremiah O'Brien) · 1 off-model (Sausalito quay); checkpoint was 14 boxed / 19 unreachable |
| flip-critical groups | T1 16: 12 ok + 4 corridor; loop / Metro stops **71 / 71 ok**; first-20-minutes path 49: 22 ok + 27 corridor; 0 stuck |
| live desktop | GGB deck both ways (slowest 3 s 4.16 u/s, camera ≤ 1°); 23 / 24 route legs (one slow winding leg, not stalled) |
| F1 (phone, production) | glide 0.62 s · Palace 0.91 s · Sutro 0.94 s · GGB 0.58 s; first-flight landing and bus hop-off walk |
| F2 | pass after `78efcf32`: deck end to end at 45° both ways; bus lap 16 stops ≈ 15.9 min (quote 15), no stall; Sutro, Fort Point, Irving & 2nd walk |
| F3 | pelican goal #1; moment 49.8 s after the goal tap; first flight 8 / 8; 起飞 24 / 24 |
| F4 | badge then go; moving 0.5 s later; stick takeover |
| F5 | pill 0 → 119; International Orange scarf bought (119 → 49) and worn |
| `?world=district` | unchanged (71 calls / 225,070 tris / 262 objects / 66 programs; hero regression green) |
| GameRoot (gzip) | **298.62 KB** vs ≤ 265 — open |

## 4. Higgsfield spend

Wave-5 cap 130 credits, lane V only; the lead's floor 250 (the owner's 80). Everything is in `docs/opus-bay/ledger/w5-V.md`,
merged verbatim into `src/opus-bay/ASSETS-LEDGER.md` § "Wave 5 (local)" with the balance trail.

| item (plan §5) | expected / worst | spent | what |
|---|---|---|---|
| H5-1 shop tiles | 24 / 32 | 0 | not made: the shop's live try-on previews show the exact colours |
| H5-2 six secret postcards | 21 / 24 | **16.00** | 8 draws (2 rejected for a base edge), nano_banana_pro 4:3 2k; `public/opus-bay/w5/postcards/` |
| H5-3 voice | 9 / 15 | **9.07** | 194 lines × zh / en, qwen_audio_tts Pixie, 6 batches with retakes; 3 clips muted for the owner's ear |
| H5-4 reference sheets · H5-5 textures · H5-6 models · H5-7 SFX · H5-8 reserve | 50 / 59 | 0 | canvas signs and procedural builds were enough |
| **total** | ≈ 99 / 130 | **25.07** | |

- `balance` **375.00** (plan `ultra`), read 2026-09-29 ≈ 04:07 UTC; newest transaction 2026-09-28 21:52:17.93 UTC (lane V's
  last retake). 400.07 − 25.07 = 375.00: nothing else spent in wave 5.
- Wave 4's last 15.06 credits (the Holy Virgin re-fit, four postcards, one tour line), pending at the wave-4 merge, are now
  copied into ASSETS-LEDGER too. Whole-SF round: 250.20 (to wave 2) + 42.70 (wave 3) + 55.51 (wave 4) + 25.07 (wave 5) =
  **373.48 credits**.

## 5. NEXT (prioritized; wave 6 candidates)

**P0 — before anyone outside plays it (or before a merge to `main`).**
1. **A real iPhone pass** (W5-Z had no device): 5 minutes walking (memory, `WEBGL_multi_draw`), the stick under an iOS
   toolbar resize, the album's share sheet, private-mode IndexedDB, the phone layout at 375 × 667.
2. **The floating stick's base in client coordinates** (F; W5-Z §7.2).
3. **`vercel.json`** (lead, frozen): CSP `'wasm-unsafe-eval'` + `blob:` in `connect-src`, the `/opus-bay` route; check with
   `scripts/opus-sf/qa/csp-serve.mjs`. Keep `git.deploymentEnabled.opus-bay: false`; a merge to `main` only on the
   owner's word.
4. **GameRoot 298.62 → ≤ 265 KB** (MF9 / D16): move F's city-only actor modules and vehicles, C's POI bodies / script /
   residents, N's city-only modules behind the city chunk (lane V's review lists sizes).
5. **Lead decisions to record** in the next lead note: the mantle in the district (gate it to the city, or accept it);
   a long timeout for leaked `activity` / `shop` / `panel` holds; the CORRIDOR waiver by name (N's review); 直接到站 on
   cable cars while waiting; 国际橙 vs 国际橘 in `data/VOICE.md` (then E renames the items); prices after one live hour.
6. **The owner's live dates** (the phone package serves them; `?date=` works only in DEV / QA builds):
   Oct 2–4 (Hardly Strictly, Yerba Buena Oct 3, the Castro Street Fair Oct 4: pennants, crowds, 带我去);
   **Fri Oct 9, 12:30 PT** (the jets are up over Marina Green; the souvenir photo); **Sat Oct 31** (Halloween pumpkins;
   the last day of the fire season and of the catalog's events); **Sun Nov 1** (DST ends: the sun bands, the 今天 tab's
   sunrise / sunset, the fire rings' hours); Nov 24–26 king tides (the seawall splash).

**P1 — the reviews' open items (small, each with an owner).**
7. F: deck and auto-glide per-frame garbage; BAYBAY's far talk-target guard (with C); the stale E prompt label
   (`interactablesEpoch`); `useTimeOfDay` on a world switch; the ferry's 车厢里 chip; the Hyde St ride camera.
8. C / E / N: no 飞行券 during goal #1's lead; rewards emitted before the ledger is live; `cityAreaAt` with height on the
   deck; the new-save goals card over the ringing phone; a quiet first discovery batch on resume; re-time the Grand Tour
   (quote 约 34 / 25 vs measured 36.1 / 28.5).
9. D: the sea-otter egg's height check (it fires on the GGB deck); the Castro prints' rebuild floor.
10. T: retire the M stop San Jose & Mt Vernon; zh cable-car stop names; the shared Hyde St box.
11. A: prefetch `play/rings` at the unlock; the heave-ho vs boarding prompt; bell mashing (design); stair-race and bell-pad
    garbage.
12. V: a voice batch 5 (egg 2's new line, Spreckels, Lombard, 滑得真顺～, C's resident lines, later lines) and the
    owner's ear for the three muted clips; the Marina Green gate spot on the venue.
13. Sweep leftovers: `trip:ss-jeremiah-obrien` (N), `ferry:sausalito` (T: a waiver or a quay on the model); Irving /
    Haight site arrivals (L, N, E); Fort Point's own arrival (C / L).
14. Docs: `src/opus-bay/STATUS.md` still describes v1 (2026-09-25): rewrite it for the city default (lead).

**P2 — the plan's should / could items not built.**
15. The North Beach seam gap (V + lead), then the North Beach corner (L).
16. A: the painted view card image, Karl / dusk lights in the slow look, the crowd's wave-back shot, the Lyon St stair
    course (L fixes the gap first), the crooked descent by car, hide & seek (could).
17. N: 陪 BAYBAY 散步过去 along the day's coin trail (could; needs E's trail API).
18. E: the toys shelf and the unlock ladder (lent free first, then sold); H5-1 tiles only if the owner wants painted icons.
19. D: the Hyde St Pier ships (the pier is not walkable), the beach wreck (tides).
20. R (could / later): live weather through a same-site function (needs the owner's go-ahead and a proxy), parade
    walkers, City Hall colours, openings, a share card; Día de los Muertos once dated; November events from the site.

## 6. Where things are

`src/opus-bay/RESUME.md` (the top section, "WAVE 5 DONE") has the state, the paths, the worktrees, the servers, the rules
learnt and the exact steps for a new session and for wave 6.
