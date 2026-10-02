# Wave 7 · summary and hand-off

Written 2026-09-30 ≈ 03:40 PDT by the hand-off agent in `C:/Users/willy/wt/w7-handoff`. Sources: the plan / lead note
`sf-w7-lead.md` (incl. §7 the addendum lanes V M R, §7.1 the Higgsfield reserve for the promo videos, §7.2 the site sync),
the thirteen lane reports `sf-w7-{K,Q,B,P,H,G,S,W1,W2,X,V,M,R}.md` (each with its `## Review`), the realism scorecard
`sf-w7-R-realism.md`, the integration playtest `sf-w7-integration.md` (W7-I), the final verify `sf-w7-final-verify.md`
(W7-Z), the ledgers `ledger/w7-X.md` and `ledger/w7-V.md`, and Higgsfield's `balance` / `transactions` (read only,
2026-09-30 ≈ 10:30 UTC). Two workflow runs: `wf_24420585-505` (the ten lanes → a reviewer per lane → W7-I → W7-Z) and
`wf_b9e6ab11-810` (the addendum: lanes V, M, R → a reviewer per lane), 2026-09-29 20:25 → 2026-09-30 03:16 PDT.

**Go-live:** on W7-Z's GO the lead fast-forwarded `main` to **`1d5d0d00`** (W7-Z) at **03:25 PDT, 2026-09-30**
(`origin/main` had nothing new since day 0, so no second merge was needed). The lead's automated check of baylink.us was
refused by a permission check (the auto-mode classifier treats a curl of the live site as a production deploy check), so
**the Vercel deploy is not yet confirmed**: the owner was asked to open https://www.baylink.us/opus-bay?halloween=1.

## 给主人的摘要

1. **第七波已经推上线**（凌晨 3:25，main 快进到 `1d5d0d00`），但**自动检查网站被权限拦住了，部署还没确认**——请你打开 https://www.baylink.us/opus-bay?halloween=1 看一眼：标题是万圣节版（南瓜灯、蝙蝠、BAYBAY 戴巫师帽）就说明新版已经上去了。10/1 起不加参数也会自动进入万圣节。
2. **万圣节补完整了**：四张万圣节明信片真的会发到玩家手上（第一次讨到糖、10/31 大夜晚、找齐 40 个南瓜灯、亡灵节看遍 8 处），手帐里 11/2 以后还在；鹈鹕的**蝙蝠翅膀**上架（小铺「坐骑」，100 金币，飞的时候跟着扑扇）；十月黄昏带南瓜色；讨糖的小孩和门廊小幽灵会轻轻摇晃；夜里蝙蝠有月光描边看得见；没找到的南瓜灯上方飘着小鬼火，BAYBAY 会说在左边还是右边；**亡灵节 11/2** 傍晚 6 点在 Bryant 街（22 街北边）集合、7 点起 40 个戴万寿菊花冠捧蜡烛的小人沿 Bryant → 24 街 → Mission → 22 街游行（2026 年官方还没公布，台词都写「通常……以官网为准」）。
3. **画面更有质感**：主角、BAYBAY、居民、鹈鹕变成毛毡玩偶的绒毛质感；闪光、彩带、金币、水花、脚步烟尘、渡轮浪花都换成 Higgsfield 画的手绘水粉风；金门大桥下飘薄雾；市中心老楼变成奶油色石头立面、唐人街有红绿铁艺小阳台和消防梯；白天城市天空更蓝、有圆滚滚的玩具云；海鸥像真海鸥；迪扬美术馆的扭转铜塔换成 Higgsfield 生成的 3D 模型；艺术宫柱廊变通透；渔人码头船舵、市政厅铅灰圆顶、荷兰风车、恩典大教堂、九曲花街绣球花都按真实照片改得更像。
4. **iPhone 专线**：点一次「开始」就应该有声音（以前要点第二下）；语音缓存有上限，长时间玩不会撑爆内存；画面丢失时先存档、再弹「画面需要重新加载 · 重新载入」；相册「保存」只发图片（iPhone 的「存储图像」会出现），微信里改成「长按图片保存到相册」，不再假装已保存；后台很久回来照片还在；双指捏合不会放大整个游戏；横屏和小屏手机的按钮、面板都放得下；切后台或转屏时摇杆自动松开；手机上「放弃」等按钮都够 44 像素。
5. **新地方**：**恶魔岛第一次有真模型**（白色监狱主楼、高脚水塔、码头和 64 号楼、典狱长住宅废墟，灯塔挪回真实位置）；开局渡轮大厦对面金融区南边补上 39 栋楼；Salesforce 屋顶公园、丘比特之箭、红杉林、铜绿色哨兵大厦；45 号码头停着二战潜艇潘帕尼托号；联合广场四角有爱心雕塑和红伞咖啡座；杰斐逊街左上角写「渔人码头」，华盛顿广场写「北滩」。
6. **新小游戏**：和 BAYBAY 在码头绿地**放风筝**；**「那是什么？」**认远处的地标（三选一，每题一句真实小知识）；机械博物馆门口的**抓娃娃机**（8 种旧金山小纪念品）和**算命婆婆**；7 号码头**捞螃蟹**（按真实规定：珍宝蟹一只都不能带走，石蟹满 4 英寸才可以留）；渔人码头**捏酸面包**（圆面包、螃蟹、乌龟）。捉迷藏开始时不再卡一下。交通：停在轨道上的空车会被"蹦"到路边、BAYBAY 站在轨道上会先让开；坐地下 Muni 时打开设置车会停住；三个转车台名字全中文。
7. **网站联动**（你 23:20 交代的）：GPT 9/29 新加的 6 个旧金山活动进了 3D 城市（金门公园音乐台 Bay Beats、Marina 图书馆开放日、梅森堡秋季展、Inner Sunset 跳蚤市集、Potrero Hill 街区节、Excelsior Sunday Streets）；修好一个纪念章存不上的老 bug；3 家新店立牌（Raising Cane's、La Boulangerie、Mess Hall）；65 岁以上免费 Muni、大通中心持票坐 Muni；真实日子：11/1 夏令时结束、10/31 唐人街万圣节庆典、10/12 恶魔岛日出聚会、10/9 舰船游行、蓝天使。上线前总验收逐项核对过，全部和网站最新数据对得上（main 从 day 0 以后没有新内容）。
8. **检查数字**：13 条线、13 位审查员（找到 24 个问题、修好 24 个，0 个挡上线），再加一轮新玩家整合试玩（又修好 2 个小屏问题）；游戏自己的测试 1660 个全过；首屏主包 279.2 → **262.0 KB**，第一次低于 265 KB 的目标；电脑全部 60 帧（最多 123 次绘制 / 36 万三角形）；手机模拟（4 倍降速）最低 58.4 帧，**没有一帧超过 100 毫秒**；全城 694 个点巡检 0 卡住；正式版安全策略 0 拦截、0 失败请求；街区模式完全没变。
9. **Higgsfield**：本波只花 **33.63 分**（V 线 30.00：10 张特效小图、毛毡贴图、迪扬塔 3D；X 线 3.63：176 条配音），余额 2247.50 → **2213.87**，每笔都在账本里；给两个宣传片预留的 1800 分一分没动（余额是只读查的）。
10. **请你有空时用真 iPhone 玩 5 分钟**：先在电脑上启动预览 `opus-bay-phone`，手机连同一个 Wi-Fi 打开 http://10.0.0.85:4174/opus-bay ，照 `docs/opus-bay/iphone-checklist.md` 的 10 步做（也可以直接用正式网站加 `?debug=1`）。**最重要的是第 1 步**：点一次「开始」后，渡轮开场时雾笛要直接响。
11. **请你听一下配音**：第七波 `docs/opus-bay/qa/w7/X/voice/listening.md`（88 句、176 条，其中 8 条机器检查没过、等你批准才会播放）；第六波的 80 条万圣节语音 `docs/opus-bay/qa/w6/X/voice/listening.md` 如果还没听，也一起。不满意的写 ✗ 或「重录」。
12. **网站那边（GPT 的，不是游戏）有两件事要转给 GPT**：(a) GPT 9/29 18:05 的提交 `b4f71de8` 让网站 4 个测试变红（main 上现在也是红的，上线前后一样，游戏测试全绿）：水灯节宣传图是 AVIF 要改成 WebP（2010 宽 + 480 宽小图，改 `src/data/september-refresh-media.json`，这一处修好两个测试）；Woodside 艺术徒步和 Fremont 排灯节两条活动的行程写成了 4 步，要合并成 3 步；圣何塞周末筛选多了一场新活动（hellflowers 免费音乐会），要把它加进测试的预期名单。(b) 网站 `src/lib/named-event-search.ts` 第 2 行的正则用了「向后查找」`(?<!…)`，在 iOS 16.0–16.3 的 Safari 上会让**整个网站白屏**（包括 3D 世界），请 GPT 改成不用向后查找的写法，或者晚一点再加载这个搜索模块。

## 1. Wave 7 at a glance

- **Timeline (PDT):** day 0 20:00–20:35 on 2026-09-29 → ten lanes from 20:25, the addendum's three from ≈ 20:35 → last
  lane pushes 00:45 → thirteen reviews 23:40–01:45 → W7-I 01:44–02:15 → W7-Z 02:13–03:16 (GO) → go-live 03:25.
- **Day 0 (the lead):** **W7-0c** `66441a00` merged `origin/main` (GPT's September 29 refresh, 8 site commits: event gaps,
  35 local additions, BayBay outings / planner; catalog 267 → 305 events) — clean; **W7-0h** `e7044221` the venue test
  follows GPT's `b4f71de8` (68 SF events in the window, 42 shown); **W7-0g** `315704c1` the plan + lead note (ten lanes
  K Q B P H G S W1 W2 X, the charApi pelican widening, Higgsfield cap 800 / floor 1400); **W7-0i** `76de8820` §7, the
  owner's second message: three more lanes (V, M, R) in a second workflow, Higgsfield without a cap; **W7-0j** `52c8db21`
  §7.1, up to 1800 credits reserved for two promo videos (lanes X and V stop below a balance of 1900); **W7-0k** `5aab08f8`
  §7.2, everything linked to the site's newest information before the go-live (W7-Z's 网站联动 section).
- **145 commits** after the wave-6 hand-off `83e88511` up to `1d5d0d00`: GPT's 8 site commits + the W7-0c merge + 5 day-0
  commits, **103 lane commits** (V 11, K 10, Q 10, S 10, B 9, G 9, W2 9, P 7, H 7, M 6, R 6, X 5, W1 4), **25 review
  commits** (B 3, Q 3; G, K, M, P, R, S, V, W2 2 each; H, W1, X 1 each), W7-I 2, W7-Z 1.
- **Reviews: 24 defects found, 24 fixed, 0 blocking** — K 5 / 5, M 3 / 3, R 3 / 3, G 2 / 2, H 2 / 2, Q 2 / 2, S 2 / 2,
  V 2 / 2, P 1 / 1, W1 1 / 1, W2 1 / 1, B 0 (four pre-existing, non-blocking findings), X 0. **W7-I** fixed 2 more (the
  goals card's buttons below the fold at 375 × 553, the 万圣节 page's buttons under 44 px). W7-Z changed no product code.
- **The one red test of the night:** `W5-bus 20+ simulated minutes` went red for every lane from ≈ 23:00 PDT (a bus
  29.2 s at `box:f-line@5661:750`): the proof ran by the real Bay clock, and after the cable cars' service hours the
  rider's bus met the Market St streetcar convoy. **W7-B9** `fd2ff25b` pinned the proof to a day clock; green since.

## 2. Lanes (details in each `sf-w7-<ID>.md`)

| lane | what shipped (incl. the review's fixes) | left open (the lane's / reviewer's) |
|---|---|---|
| **K** feel, camera, safety | street-tree canopies in the ride and follow cameras' ray tests (`CityProps.treesNear`); a parked empty car / bike is towed off the transit's path and BAYBAY steps off the rails (`actors/vehicles/transitClear.ts`); a 渔人码头 area for Jefferson St, Washington Square reads 北滩 (28 border points fixed by `exactZone`); 放弃 50 × 44 on touch; the stick lets go on hide / pagehide / rotation; one GlideReport; the goals card never ends a ride (not reproduced; pinned by a test). Review: 5 fixes to the aside / tow (a waiting car, a slow car, two tracks, getting in mid-hop, a second pool) | the seated Hyde St rider under a kerb canopy (a tree-only dither in the TOY shader: lead / X); the aside / tow node-staged only (one phone look at a Powell St stop); a parked ride > 250 u away is towed only on return; `treesNear`'s iterator per chunk |
| **Q** iPhone & phones | the audio unlock inside the Start tap (`audio/unlock.ts`); a voice-clip LRU (≈ 32 MB / 64 clips); the context-loss card (`ui/glHealth.ts`); the album (share the file only, WeChat / in-app browsers get a `data:` image + 长按图片保存到相册, IndexedDB reopens after a background kill, 3 s timeout, `storage.persist()` once); touch guards, `text-size-adjust`, the map keyboard; the arrival subtitle on one line; the silent-switch hint; `?debug=1` iOS lines; sheets ≥ 320 px, landscape 667 × 320 / 844 × 340; `docs/opus-bay/iphone-checklist.md`; tile-pool numbers. Review: a sheet no longer drops under the finger at its floor; no Firefox persist popup | everything only a real iPhone shows (the checklist); the iOS 26 floating tab bar; a shader-compile split if the device stalls; the district shutter in WeChat; at 844 × 340 the free-roam goals card covers the lead chip (→ K) |
| **B** transit | the deadlock proof deterministic (state reset W7-B1; forced blockers 31 → 47 with the bar kept; the Bay clock pinned W7-B9); the Settings pause holds an underground Metro (W7-B2); sheets above the subway overlay (W7-B3); per-frame Need records in `flineSystem`; courtesy waits bounded by tests (cable car ≤ 50 s, bus ≤ 35 s); all-Chinese turntable names. Review: no code defect | the night Market St single-track convoy (≈ 29 s for the rider's loop bus), then W7-B5's shorter courtesy diff (Hyde & Chestnut 48 → 41.5 s); the toy Alcatraz ferry (part c); no Settings button underground on phones; album / letter / goals step under the subway overlay; a stale comment in `game/transit.ts` |
| **P** first load | GameRoot 279.21 → 254.45 KB on one tree (the dialogue script, POI card texts, bubble layout, the perf monitor, discovery, the deck walk / city framing out); `importRetry` (1 / 3 / 8 s) for lazy chunks; the planner catalog prefetch after the first frame. Review: a lost stylesheet no longer leaves a retried chunk unstyled | ≈ 3 KB headroom at W7-Z's 261.96 (city-only parts of `fx.ts` / `materials.ts` / `environment.ts` / `models.ts` behind the city chunk); ≈ 170 other lazy imports without retry; a lost shared dependency is not recovered; Request 3 (district vehicles) is the owner's call |
| **H** Halloween world | the pumpkin dusk (`fog.ts setGoldenTint`) + the recorded dusk line; swaying trick-or-treaters and porch ghosts; moon-rimmed bats; will-o'-wisps over unfound lanterns + direction lines; nearest halos first; Día de los Muertos truer (1 Nov papel picado + the Acción Latina altar; 2 Nov altars from 08:00; the 40-walker procession 19:00–21:00, toy cars wait); pumpkin patches at Sunnydale / Thrive City; no stoop by a treat door; 9 lines. Review: the procession gathers on Bryant north of 22nd (SFMTA's 2025 staging); per-frame garbage | walkers rigid and walk through a player in their lane; the sway is horizontal; the dusk tint shows only where Karl's bank is; `w7-h-muertos-eve` says 挂好 of potted marigolds (voiced: left); `fog.ts` comment says 0.18 (0.35 pushed) |
| **G** Halloween games | the 4 Halloween postcards at their moments (a lazy overlay; a Notebook block that stays after 2 Nov); the pelican's bat wings (`CharWho 'pelican'`, `wingL` / `wingR`, 100 coins); seasonal items first on the shelf; the phone pill on 2 lines; the big-night toast; a kit-swap skip near treat doors; a Belvedere door that was a Clayton St house removed; 万圣节目标 n/3 in the goals tab; 2 lines. Review: the postcard never opens over another overlay; the pill's dangling "·" out of season (it was on the live site on 9/30) | a BAYBAY bubble shows above the postcard's dim (`game/flow.ts`, K); the door-to-street check on the other five streets; a live A/B of the kit skip; the pelican's head / neck / back slots; the fallback goals card |
| **S** site sync | six OSM-checked venue rows for the Sep 29 SF events; souvenir ids + names for every shown event (long ids never saved: fixed) + a guard test; 新店 signs by the site's rule (Raising Cane's, La Boulangerie at ERIA, Mess Hall); seniors' free Muni in `live.json`; the Chase Center Muni line; calendar rows with sources (DST 1 Nov, muertos 2 Nov 19:00, Chinatown Halloween Festival 31 Oct, Alcatraz sunrise 12 Oct, Parade of Ships 9 Oct, Blue Angels ≈ 15:00); a DST-safe 明天; the owner's dates played with `?date=`; the 网站联动 link test. Review: the DST line only from 02:00; the Muni link's icon | toy ships for the Parade of Ships; the Chinatown Halloween Festival venue (waits for the site's catalog); Potrero Hill's window ends 14:00; toy cars pass under the three fair arches; the openings test goes red when GPT opens another SF shop (by design) |
| **W1** downtown | the FiDi south-edge seam (39 OSM buildings, 0 new calls); the East Cut corner (Salesforce Park's deck, Cupid's Span, Redwood Park, the Sentinel Building; +2 calls); USS Pampanito at Pier 45. Review: Cupid's Span is solid at a walker's height | Chinatown's pagoda cluster (Sing Chong / Sing Fat, Old St. Mary's, the Telephone Exchange); the SS Jeremiah O'Brien + its arrival (the Pier 35 promenade has no graph edge within 3 u: the sweep's one UNREACHABLE); North Beach leftovers; the Pampanito's bow direction |
| **W2** landmarks & play | Alcatraz as a T1 site (+1 call, 4.5k tris; the lighthouse at its real spot); Marina Green kites + 放风筝 with BAYBAY; 那是什么？ (9 landmarks in real line of sight, a fact per answer); hide & seek (no tap hitch, a voiced 被你找到啦！, the coach line); Union Square T2 (the four hearts, the café, planters; 0 new calls). Review: the quiz asks each landmark in sight once | the busker play-along and Chase Center T2; the templated 最近的观景点 line (not voiceable); the kite's Space key after a click, `quietUntil` 75 s after an early quit; no ambient kites at Crissy Field; `cable:powell-geary` ok → CORRIDOR |
| **X** visuals, voice | pre-war FiDi and Chinatown façades (window styles 9 / 10: piers, paired windows, painted balconies, fire escapes); a city-only day sky (bluer, toy cloud puffs); gulls; the crowd on `mid` (near figures 18 → 8); voice: **88 lines / 176 clips** (50 lines no batch had, 38 new wave-7 lines), 3 wave-6 retakes replace their clips. Review: no defect | Ocean Beach surfers and Seal Rocks; the hero district's office faces (a city-only pass needs the lead's OK); lane M's 34 lines (text only); the 8 muted clips for the owner; a sky-puff AA hardening |
| **V** models, effects | felt on the characters (`w7v/felt.webp`, tri-planar, a near fibre bump, fuzzy rim); painted gouache particles (a 4 × 4 Higgsfield atlas: sparkle, confetti, coins, hearts, notes, dust, splash, the ferry's wake); Golden Gate fog wisps; the de Young Hamon tower as a SAM 3D mesh (3,920 tris); the Palace peristyle's open shafts; soft particle edges on mid / low. Review: the felt bump's derivatives in uniform control flow; the ledger's verdicts | vehicles unchanged; night glows; St Ignatius's cupolas and a Haight Victorian / mural kit (R's scorecard); the de Young twist direction; the ferry wake faint on bright water; a double coin pop on some rewards (taste) |
| **M** mini-games | the Musée Mécanique claw machine (8 SF souvenirs) and fortune teller; crabbing off Pier 7 (the Bay's real rules); sourdough shaping at a Wharf bakery; the panel at the right on wide screens; props +1 call near them. Review: the fortune teller under React StrictMode; a stick push after 出炉！ no longer voids the game; crab per-frame arrays | the cable-car grip / foghorn / lantern games; the 34 BAYBAY lines unvoiced; `play.b` near its 32-key cap (`data/playSave.ts MAX_BESTS`, frozen: the lead); souvenirs as pictures in the notebook; BAYBAY's talk prompt during a game |
| **R** places | the realism scorecard of 48 famous places (`sf-w7-R-realism.md`); code fixes: the Wharf wheel, City Hall's dome, the Dutch Windmill, Grace Cathedral, Lombard's hydrangeas; 46 map positions checked against OSM; 25 famous cards with hours / prices / closures (sources dated). Review: City Hall's dome regenerated mid lead-grey; the Peace Plaza card claims no finish date; the ledger rows | ≈ 60 short cards without hours / price; Salesforce Tower's bands (a district landmark: the lead's call); Lombard at 2,478 / 2,500 tris; the far City Hall dome a little dark; the Wharf wheel's cream outer band |

## 3. Final verify (W7-Z) numbers

See `sf-w7-final-verify.md` for the full tables (W7-Z: **GO**, `1d5d0d00`; alone on the machine, PERF-LOCK 02:13–03:16,
on `90ce562f`).

| gate | W7-Z | W6-Z |
|---|---|---|
| `npm run check` | eslint 0 errors (43 old warnings) · tests **2551 / 2555** — the 4 failures are site tests on GPT's `b4f71de8`, identical on `origin/main` (§5 P0) · build + prerender **566** pages + **541** share cards green (run by hand after the test step) | EXIT 0 · 2246 / 2246 · 519 · 494 |
| `tsc` · opus-bay suite | 0 · **1660 / 1660** | 0 · 1489 / 1489 |
| GameRoot (gzip) | **261.96 KB** (≤ 265: met for the first time) | 279.19 KB |
| perf desktop 1440 × 900 high (≤ 150 calls / ≤ 400k) | 20 spots + 3 rides + 2 Halloween-night spots + 4 new W7 spots (Alcatraz from Coit and PIER 39, Jefferson & Powell on 11 Oct 13:00, the muertos procession on 2 Nov 19:10): all 60 fps, max **123 calls** (Chinatown) / **360k** (Pier 45), 0 long frames | max 122 / 365k |
| perf phone 390 × 844 mid 4× CPU (≥ 45 fps, 0 frames > 100 ms) | every spot ≥ **58.4** fps (fidi walking), **0 frames > 100 ms**; the tile pool +10 calls max (ferry-gate), fps unchanged; the city day sky 60 fps | min 45.0, 2 long frames |
| static sweep | **694** targets: 547 ok · 146 CORRIDOR · **0 boxed · 0 snag** · 1 unreachable (SS Jeremiah O'Brien) · 0 off | 688: 0 / 0 / 1 |
| production build + CSP (5 sessions incl. a phone new-player start and the district start) | **0 violations · 0 failed** of 1514 requests | 0 / 0 of 1793 |
| district (`?world=district`) title | **71 calls / 225,070 tris / 262 objects**; no city chunk loaded | identical |
| 网站联动 (§7.2) | in sync: every SF event placed or kept out for a reason, souvenirs + names, 新店 signs, `live.json` re-export unchanged, calendar sources, every game link resolves, the 今天 tab | — |

The LAN phone package `C:/Users/willy/opus-qa/dist-phone` was rebuilt from this tree at 03:15 (the same GameRoot hash as
the site build); the preview `opus-bay-phone` (port 4174) was not running.

## 4. Higgsfield

The owner's rules this wave: cap 800 for lane X (floor 1400) at day 0; from 20:35 no cap (lanes X and V, a reserve of 200);
from 23:15 **lanes X and V stop below a balance of 1900** (up to 1800 credits reserved for two BAYLINK promo videos after
the go-live). Every charge is in `ledger/w7-X.md` / `ledger/w7-V.md`, merged into `src/opus-bay/ASSETS-LEDGER.md`
§ "Wave 7 (local)".

| lane | what | credits |
|---|---|---|
| V | batch 1: 10 gouache particle sprites + 2 tileable plush textures (Nano Banana Pro, 12 × 2; 11 shipped in the atlas / `felt.webp`) | 24.00 |
| V | batch 2: the de Young tower (2 concepts, 3 SAM 3D jobs, one refunded; one GLB shipped) | 6.00 |
| X | batch 1: 100 clips of 50 lines + 22 retake takes (Qwen Audio 3.0 TTS Flash, 04:54–06:05 UTC; 27 failed jobs refunded) | 1.99 |
| X | batch 2: 76 clips of 38 new wave-7 lines (06:47:47–06:55:48 UTC, 76 spends, 0 refunds) | 1.64 |
| **wave 7** | | **33.63** |

- `balance` **2247.50** at day 0 (20:10 PDT) → **2213.87** now (`balance` read only at ≈ 10:30 UTC, plan ultra; the newest
  charge is lane X's last TTS take at 06:55:48 UTC, so nothing was spent after the lanes). Sum check: 2247.50 − 2213.87 =
  33.63 = 30.00 + 3.63. Lane X's exact TTS sum (its ledger said "≈ 3–4") is settled here from the balance trail and
  batch 2's 76 rows (see the ASSETS-LEDGER reconciliation).
- The promo reserve is untouched: 2213.87 − 1800 = 413.87 would be left after the two promo videos at their maximum; the
  game lanes' floor of 1900 leaves 313.87 for Opus Bay until the promos are made.
- Between wave 6 (2359.30) and day 0 (2247.50) 111.80 credits went to other work on the shared account (Seed Audio,
  Outpaint, Kling v3.0 — not Opus Bay). Whole-SF round: 389.18 (waves 1–6) + 33.63 = **422.81 credits**.

## 5. NEXT (wave 8 candidates)

Deduplicated from every lane's Known gaps / Not done / Requests, the thirteen reviews' open items, W7-I and W7-Z §10.

**P0**
1. **Confirm the deploy**: the owner opens https://www.baylink.us/opus-bay?halloween=1 (the Halloween key art on the title
   = wave 7 is live). The lead's automated check was refused (auto-mode classifier): ask the owner, do not retry curl.
2. **A real iPhone pass** (`docs/opus-bay/iphone-checklist.md`, LAN package http://10.0.0.85:4174/opus-bay after starting
   `opus-bay-phone`, or production + `?debug=1`): the audio unlock inside the Start tap (WebKit's gesture rule), 存储图像,
   WeChat's long-press save, iOS context loss, `svh` / safe areas, the iOS 26 tab bar; plus one look at a Powell St stop
   with a car waiting (K's review fixes were node-staged only).
3. **The owner's ear**: `docs/opus-bay/qa/w7/X/voice/listening.md` (88 lines / 176 clips, 8 muted until approved) and the
   wave-6 sheet `docs/opus-bay/qa/w6/X/voice/listening.md` (80 Halloween clips) if not heard yet.
4. **The site (GPT, via the owner)** — CI's `npm run check` is red on `main` and on every `opus-bay` push until it lands:
   the 4 red tests of `b4f71de8` (the water-lantern promo AVIF → WebP 2010 w + 480 w in
   `src/data/september-refresh-media.json`; the two 4-step plans `woodside-djerassi-free-art-hike-oct5-2026` and
   `fremont-fog-diwali-mela-2026` in `src/data/coverage-audit-regional-events.json` → 3 steps; the San Jose weekend list
   gains `san-jose-hellflowers-free-concert-oct2-2026`), and the lookbehind regex in `src/lib/named-event-search.ts:2`
   that blanks the whole site (the game too) on Safari 16.0–16.3 (in the entry chunk: rewrite without `(?<!…)`, or build
   it lazily). Game lanes never edit the site's files.
5. **BAYBAY talks under a lazy overlay** (W7-I; G's and W2's reviews): the claw / crab / dough / fortune / skyline panels,
   the Halloween postcard and the egg card do not hold `game/cityMoments.ts stepPacer` / `game/baybayLines.ts` — the
   voice plays with its bubble hidden, a neighbourhood greeting shows over the postcard's dim. One clause in both gates
   with the overlay ids as strings (never `openOverlays().length`: the play chip is an overlay too), `game/flow.ts
   bubble()` pausing while `h-postcard` is open, and a node test (lead / lane K).

**P1**
6. **Phone UI** (lane Q's area): a Settings button during an underground Metro ride (the subway overlay z 40 covers the
   HUD); the album / letter / goals step under the subway overlay; the map's tool buttons 36 × 36 and the waypoint ×
   24 × 24; at 844 × 340 the free-roam goals card over the lead chip; the skyline card and Union Square at 390 × 844.
7. **GameRoot headroom ≈ 3 KB**: city-only parts of `world/fx.ts`, `world/materials.ts`, `world/environment.ts`,
   `actors/models.ts` behind the city chunk (≈ 6 KB added in wave 7); `importRetry` for the other ≈ 170 lazy imports.
8. **Transit** (lane B): the night Market St single-track convoy (the rider's bus reserves the stem earlier; add a night run
   of the proof), then re-measure `C:/Users/willy/opus-qa/w7/b/b5-attempt/b5.diff` (Hyde & Chestnut 48 → 41.5 s) with the
   pinned clock; the toy Alcatraz ferry Pier 33 ↔ W2's `FLOAT`; the stale comment in `game/transit.ts holdRideForPause`.
9. **Time-bound before the dates pass**: toy ships for the Parade of Ships (9 Oct 11:00–12:00); the Chinatown Halloween
   Festival venue row once the site's catalog has it (31 Oct); a look on the owner's live dates (2–4, 9–11, 17, 18, 24,
   31 Oct; 1 Nov DST; 2 Nov the procession).
10. **Not built this wave**: Chinatown's pagoda cluster (0 new calls in the Dragon Gate corner); the SS Jeremiah O'Brien at
    Pier 35 + its arrival (a walking-graph edge along the promenade or a waiver of the 3 u rule) — ends the sweep's one
    UNREACHABLE; North Beach leftovers (Columbus Ave asphalt, the café clusters / 4 CORRIDOR targets); Ocean Beach surfers
    and Seal Rocks; the busker play-along; Chase Center T2; the cable-car grip game on a Powell ride.
11. **Voice**: lane M's 34 lines (`play/sfgamesLines.ts`), the templated 最近的观景点 line split into a fixed bubble + a
    toast / pin, the 7 muted batch-1 retakes (or the owner's approval).
12. **`play.b` near its 32-key cap** (`data/playSave.ts MAX_BESTS`, frozen: the lead): raise it or fold counters before
    wave 8 adds games, or a best / the claw collection is silently not saved.
13. **The seated Hyde St rider under a canopy**: a tree-only dither round the player (`OB_CANOPY` on `TOY_INST_TINT` in
    `world/materials.ts`, or a per-instance fade for ≤ 3 canopies from `treesNear`).

**P2**
14. Halloween polish: the procession walkers step aside and swing their legs; a vertical hop for the kids; the dusk tint
    downtown; the door-to-street check on the other five treat streets; a live A/B of the kit skip; a pelican `neck`
    costume (pumpkin bow); the fallback goals card's Halloween row; the big-night toast wording.
15. Looks (R's scorecard, V, X): St Ignatius's cupolas, a Haight Victorian / mural kit, Salesforce Tower's bands (district:
    the lead's call), the Wharf wheel's cream band, the far City Hall dome, Lombard's triangle budget, the hero district's
    office faces (city-only, the lead's OK), vehicles and night glows, the de Young twist, the ferry wake, the sky-puff AA
    line, the double coin pop (taste).
16. Places and words: ≈ 60 short cards without hours / price; the Belvedere doors' pill (内日落 · Carmel St vs Cole
    Valley); Ghirardelli / Beach St west of Hyde (a recorded call); `cable:powell-geary` ok → CORRIDOR at Union Square;
    `w7-h-muertos-eve`'s 挂好 (voiced: change only with a retake); the `fog.ts` comment.
17. Small tech: `treesNear`'s iterator allocation; a parked ride > 250 u towed only on return; resume after a lost
    discovery chunk waits up to 12 s silently; a lost shared chunk dependency; the district's WeChat shutter; the kite's
    Space key after a click and its 75 s `quietUntil` after an early quit; toy cars under the street-fair arches.
18. Site editors (via the owner): add the Chinatown Halloween Festival to the catalog; `sfmta-free-muni-seniors`'
    `sourceUrl` points at SFMTA's Vietnamese page (English: https://www.sfmta.com/fares/free-muni-seniors-ages-65);
    Handroll Hawker (2360 Polk St) once the site marks it open.
19. Housekeeping: `git worktree prune` with OneDrive paused (the `.git/worktrees/w7-*-rev`, `w7-int`, `w7-verify`,
    `w7-*-chk` / `-check`, `w7-h-origin`, `wt-origin`, `wt-origin1` admin folders); the empty folder
    `C:/Users/willy/wt/w7-p-rev`; `git pull --ff-only` in the lead's checkout `C:/Users/willy/baylink-opus` (still at
    `83e88511`) before using 5174 / rebuilding 4174.

## 6. Where things are

`src/opus-bay/RESUME.md` (top section "WAVE 7 DONE · LIVE ON baylink.us — 2026-09-30 03:25 PDT") has the state, the
paths, the rules learnt tonight and how to continue. Reports: `docs/opus-bay/sf-w7-*.md`; QA images
`docs/opus-bay/qa/w7/<LANE>/`, `qa/w7/int/`, `qa/w7/final/`; the iPhone checklist `docs/opus-bay/iphone-checklist.md`; the
voice sheet `docs/opus-bay/qa/w7/X/voice/listening.md`; ledgers `docs/opus-bay/ledger/w7-{X,V}.md` (merged); perf spots
`scripts/opus-sf/qa/perf/w7-spots.json`; scratch `C:/Users/willy/opus-qa/w7/` (day-0 scouts, lanes, reviews, `int/`,
`z/`); the workflow scripts `opus-bay-wave7-wf_24420585-505.js` and `opus-bay-wave7-addendum-wf_b9e6ab11-810.js` under the
lead session's `workflows/scripts/`.
