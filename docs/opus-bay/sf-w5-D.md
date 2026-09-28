# Wave 5 · lane D · Discoveries & easter eggs

Worktree `C:/Users/willy/wt/w5-d` (branch `w5-d`, dev port 5509), plan `sf-w5-plan.md` §3.1 / §4.12, rules `sf-w5-lead.md`.

## Part a

### 给主人的摘要

1. 24 个真实旧金山"小发现"的清单已经推上去了（编号固定，手帐和传闻都用它）：每条都有出处网页和核对日期（2026-09-28 我逐条上网核对过），BAYBAY 的每句话中文不超过 45 个字。
2. 前 12 个已经能在游戏里玩：电报山的野鹦鹉、39 号码头按真实月份的海狮、游戏厅的大笑女士、唐人街老电话局会响的电话、茶园和罗斯巷的幸运饼干、诺顿皇帝的造桥"圣旨"、海浪风琴、黄昏在克里西场降落、BAYBAY 在炮台水边想起海獭亲戚、八角屋的时间胶囊（会写上你自己的旅行数字）、骑鹈鹕绕恶魔岛一圈（5 只鹈鹕来陪飞）、雾里金门大桥的真实雾笛二重唱。
3. 找到时：一声小铃、BAYBAY 说一句真事、左下角（手机在底栏上方）弹出小卡片"小发现 · +10 金币"，点开能看到出处和核对日期；第二次再来只是安静地再玩一次，不重复发金币。
4. 电脑 1440×900 和手机 390×844 都实际看过截图；市中心（唐人街、渡轮大厦一带）暂时不加任何新模型，等 V 线公布余量；着色器数量没有增加（电脑 58、手机 55，和基线一样）。
5. 后 12 个（西边、南边、东边）、"听说……"传闻和寻宝罗盘的完善在 part b。

### What was built

All files new, in lane D's folder (`src/opus-bay/eggs/**`, lazy city chunk behind `game/w5Features.ts`; nothing in the GameRoot graph).

| file | what |
|---|---|
| `eggs/registry.ts` (W5-D1, pushed first as `307c209`) | The 24 eggs of plan §3.1, **append-only** (`EGG_IDS[i]` = bit `i` of `play.g.egg`): id, number, one of the eight MF8 areas (`EGG_AREAS`, `EGG_AREA_NAMES`), name, riddle (≤ 20 zh), a 听说… rumour (≤ 45), the spot (city frame, kind ground / water / air, `also` spots, `approx` for part b), how-to, BAYBAY's lines (≤ 45 zh), the card fact, `sources[] { url, verifiedAt, note? }`, the stamp label. Helpers `eggById`, `eggIndex`, `eggRewardSource` (`egg:<id>`), `eggsInArea`, `eggSpots`, `EGG_COINS` 10, `EGGS_VERIFIED_AT`; the cookie trail's `FORTUNES` + `FORTUNE_SOURCES`. Pure data, no game imports (E and C import it from their own chunks). |
| `eggs/gates.ts` (W5-D2) | Bay-time gates through `game/bayNow.ts`: `inMonths`, `onDay(month, day, fromH, toH)`, `inYear`, `dayRoll(salt, dateKey)` / `presentToday(salt, share)` (stable per Bay date: the labyrinth's ≈ 70 %), `bayHour`, `seaLionMonth` (away Jun–Jul / returning Aug / home), and a per-viewer once-a-Bay-day memory (`usedToday` / `markToday`, localStorage with a memory fallback). |
| `eggs/sounds.ts` (W5-D2) | 16 synthesized recipes registered through `audio/hooks.ts` (`registerEggSounds`): `egg:find` (the find chime), parrots, sea lions (the month's loudness), our own cackle (no historic record) and BAYBAY's giggle, an old desk phone, the switchboard plug, the cookie crack, a toy fanfare, the Wave Organ (≈ 8 s of pipe gurgles, tide-scaled), a toy propeller, a splash, the tin lid, the pelican whoosh, and the two Golden Gate foghorns (south pier low 2 s tone; mid-span 1 s blasts). Horns and the organ on the ambience bus, the rest on sfx. |
| `eggs/props.ts` (W5-D2) | **The prop pool**: ONE plain Mesh whose geometry is the props within 110 u of the player, merged, rebuilt only when that set changes (2 Hz check), hidden (0 calls) when none is near; recipes `decree` 140 tris · `tin` 92 · `windsock` 84 · `cookie` 56; props stand off the walk line, no colliders. **Downtown** (a box over the Ferry gate, FiDi, Chinatown, Union Square) is held: `DOWNTOWN_PROPS_HELD = true` keeps Norton's scroll out until V publishes the headroom (the egg still works). **The flock**: two small InstancedMeshes (parrots 72 tris × 12, pelicans 112 tris × 5), drawn only during a flight (+1 call transient). Materials are our own instances with TOY_DYN's / TOY_INST's exact patch, cache key and flags (so they link the same programs), registered with `world/warmup.ts` (`registerEggWarmup`). The hidden pool keeps a real TOY geometry (see Decisions). |
| `eggs/hosts.ts` (W5-D2) | The host runtime and kit. `EggHost { id, range, enter, update, leave, onEvent, interactables, qa, dispose }`; one frame system (`eggs`): the flock every frame, hosts at ≈ 10 Hz only within their range, the pool at 2 Hz; events fanned out; prompts through `registerInteractables('eggs')` (source `'find'`, `act`). Kit: `reveal(id, opts)` = the find (below), `say(lines)` (flow `bubble` in order), `sound(id, at?)` (gain by distance, pan by the camera yaw, `audio/logic`), `fx` (the shared particle pool, 0 calls), `beat(shots)` (a camera beat through `game/cinema.playShots`: the cinema holds and releases the lock however it ends; refused while gliding, riding, talking or in another cinematic), `note(p, onClosed)` / `operator(p)` (the paper overlays), `momentFree()`, `isFound(id)` (the ledger's bit via `economy/ledger isPaid`, or this session). |
| `eggs/FactCard.tsx` + `eggs/eggs.css` (W5-D2) | Overlays through `ui/slots`: `egg-card` (compact: 小发现 · +10 金币, the name, 看看故事; tap on phones / E on desktop — only when no other prompt is in focus, the E keycap hides otherwise — opens the fact, the sources' hosts as links and "2026-09-28 核对"; the compact card leaves after 6 s unless held; it stands above lane N's arrival card when that is up), `egg-note` (a scroll or a letter in our words, optional stats; closes on 收好 / × / Esc / E or when the player walks 8 u away), `egg-operator` (the fictional operator's 你找谁？ with three choices). Lazy: loaded on first show (prefetched 4 s after start), so the init chunk stays small and loads in node. |
| `eggs/scene.tsx` | Mounts the eggs' root group through `registerSceneSystem('eggs')`. |
| `eggs/north.ts` (W5-D3) | Egg 1 **parrots**: stand still 4 s in the Filbert steps' garden (OSM Grace Marchant Garden, snapped) by day → 12 conures circle, three perch beside you, the find; a pass-by fly-over on about half the visits by day (≤ 1 per 3 min); never at night. |
| `eggs/wharf.ts` (W5-D3) | Egg 2 **sea lions**: 1.5 s at the PIER 39 rail → the month line (away / returning / home) + barks at the month's loudness, then 1989 + "看就好，别喂" (no count ever). Egg 3 **laughing lady**: 听听笑声 at the Pier 45 arcade door → our cackle, BAYBAY giggles (always the first time, then 1 in 5). Egg 11 **Alcatraz**: `LoopCounter` winds the glide's angle round the island (22–230 u band, either direction); a full loop → whoosh, sparkle, 5 pelicans swoop in and fly a V ahead of you for 7 s, the name line (MF3: it plays on the first loop); the second loop brings the water-tower line (the 1969–71 occupation, respectful). |
| `eggs/downtown.ts` (W5-D3) | Egg 4 **the phone** at 743 Washington St: rings (every 4 s, up to 26 s) when you come within 14 u, once a Bay day until someone answers; 接电话 → the plug, 美玲 asks 你找谁？ → BAYBAY / 街坊 / 草药店 answer with a comic line, then the find. Egg 6 **Norton**: 读一读圣旨 at the Bay Bridge's Embarcadero foot → a fanfare and the scroll (our paraphrase: Oakland by Goat Island, "let the great ships pass beneath", 64 years later); the lines and the card after the scroll is put away. |
| `eggs/cookies.ts` (W5-D3) | Egg 5 **fortune cookies**: 拿一块幸运饼干 at the Tea Garden gate (a small stand in the pool) and 尝一块饼干 in Ross Alley (prompt only, downtown); one cookie per Bay day per spot (`fortuneFor(spot, date)` picks a slip, stable all day); later the same day: 今天的饼干拿过啦，明天可能不一样哦。 |
| `eggs/marina.ts` (W5-D3) | Egg 7 **Wave Organ**: 把耳朵凑近管口 → an ear-level camera beat (2.8 s) and the pipes (tide-scaled when R's table lands: `setOrganTide`), then the find. Egg 8 **Crissy Field**: a `glide:land` on the lawn (≤ 48 u, on land) in the golden band → a toy windsock appears (and stays), propeller + confetti, the 1924 dawn-to-dusk line (据说). Egg 9 **otter cousins**: at the Fort Point shore with BAYBAY within 12 u → `charApi().emote('baybay', 'float')` (skipped until F registers it), a splash, two gentle lines. Egg 10 **time capsule**: 打开小铁盒 by the Octagon House → the 1861-style note (marked 仿写) and "你的时间胶囊 · <Bay date>" with four numbers from the save (places reached, neighbourhoods, finds, lines ridden); the find after it is put away. Egg 12 **foghorn duet**: while Karl's gate lobe covers the span (`fogAtBridge() ≥ 0.4`: morning and golden hour, `?karl=1`), the two horns play the real pattern (`hornStarts`: south 2 s on / 18 s off; mid-span 9 s, 1-2-1, 36 s), placed at the south tower and mid-span; both heard within 45 s while standing on the deck (`onDeck`) → the find. |
| `eggs/index.ts` | `init()`: `registerRewardIds('egg', EGG_IDS)` (lane E's ledger), the sounds, the three overlays (lazy), the scene root + warm-up, the 12 hosts, `registerHintSource('egg', …)` (lane E's compass: unfound eggs that have a host); DEV / QA build: `__opusBay.d` (`qa(id)` plays an egg's moment now, gates ignored; `found`, `hosts`, `active`, `props`, `flock`). Returns the undo. |
| `tests/opus-bay-w5-eggs.test.ts` | 17 tests (below). |

**API for other lanes** (import from your own lazy chunk): `eggs/registry.ts` — `EGGS`, `EGG_IDS` (the egg bitset order), `eggById`, `eggIndex`, `eggRewardSource`, `eggsInArea`, `eggSpots`, `EGG_AREAS`, `EGG_AREA_NAMES`, `EGG_COINS`, each egg's `riddle` / `rumour` / `stamp` / `how`. Events: every find emits `{ type: 'find', kind: 'egg', id, first }`; the first also `{ type: 'reward', source: 'egg:<id>', coins: 10 }`.

### Evidence

- **Checks**: `tsc -p tsconfig.app.json --noEmit` 0 errors · `eslint .` 0 errors (43 old warnings outside `src/opus-bay`) · `tsx --test tests/opus-bay-*.test.ts` **1086 / 1086** on the pushed tree `9238198` (rebased on the other lanes' commits up to N part a). Before that push: 1062 / 1062 on the previous base; one full run under load had the wall-clock A* assert of `opus-bay-actors` at 409.7 ms (green alone and in the next full run); the last two rebases (F3, N part a: none of their files are mine) were checked with tsc + the eggs, contracts, lock and nav tests before pushing, and the full suite after. Commits: `307c209` W5-D1 (re-checked after its rebase brought E1 / N1: tsc 0, 943 / 943), `9238198` W5-D2 / W5-D3.
- **End to end with lane E**: a find in the browser pays through the live ledger — the pill read `🪙 13` after the laughing lady and `isPaid('egg:musee-laughing-lady')` was true (`d3-find-pays-coins-desktop.jpg`).
- **Chunks** (a production build to scratch with `vite.opus.config.ts`): the eggs init chunk **65.8 KB raw / 27.4 KB gzip** (the registry's bilingual facts and lines are ≈ 17 KB gzip of it); the cards chunk (`FactCard`) 5.6 KB raw / 2.3 KB gzip + 1.8 KB gzip CSS, loaded on first show; nothing in the GameRoot graph (the contracts walk). Above the plan's ≈ 12 KB estimate: Decisions 11.
- **Tests** (`tests/opus-bay-w5-eggs.test.ts`): registry (append-only order snapshot, reward grammar, text limits and wording rules, the Ohlone / occupation lines, 据说 / 看缘分 where the sources hedge, every source https with a wave-5 `verifiedAt`, the eight areas, the fortunes); every spot in the manifest bbox and every ground spot standable, not water and on the walking graph in the **published city with the landmarks registered**; gates on Bay time (DST-safe date key, the 70 % roll over 365 days, sea-lion months, once a Bay day); props ≤ 200 tris, the pool shows only what is in range and hides at 0, downtown held; materials (own instances, TOY_DYN / TOY_INST keys and flags, no instanceColor, aInfo, a real idle geometry); `reveal` pays once through lane E's real ledger (+10, `isPaid`), the card after the first line, quiet repeats; camera beats hold and always release the lock (end and Esc), refused while gliding / riding (MF1); every host's prompt is a `find`-source `egg:` id with an `act` within 3 u of its egg; month lines / operator / notes / slips ≤ 45; the Alcatraz loop counter; the foghorn pattern to the second, the deck test, Karl by time of day; simulated triggers on the real host code (parrots after 4 s still, sea lions, Fort Point with BAYBAY, the deck in fog, a loop round Alcatraz, a dusk-only Crissy landing), the prompts (lady, phone once a Bay day until answered and again the next day, cookies per spot per day, Norton and the tin after their papers close, the organ beat); props on open ground within 3 u of their egg; the three cards render (SSR).
- **In the real game** (dev server 5509, headless Chrome with the RTX flag, one Chrome at a time, zh locale; every image read): desktop 1440 × 900 quality high and phone 390 × 844 dpr 3 quality mid. Key images in `docs/opus-bay/qa/w5/D/`: `d3-parrots-desktop` (the flock perched, card, 看就好别喂), `d3-lady-card-open-desktop` (the opened card: fact, two sources, 2026-09-28 核对), `d3-phone-operator-desktop`, `d3-alcatraz-pelicans-desktop` (the V of pelicans ahead of the glide, the name line, the card), `d3-crissy-windsock-desktop`, `d3-wave-organ-beat-desktop`, `d3-octagon-capsule-desktop`, `d3-ggb-deck-fog-desktop` (the deck in golden-hour Karl, where the duet was found), phone `d3-card-phone`, `d3-card-open-phone`, `d3-operator-phone`, `d3-norton-scroll-phone`. The natural triggers were seen working too (the parrots found themselves after 4 s standing on the steps; the duet was found standing on the deck in fog).
- **Budgets** (read in the browser; fps are lane V's): programs **58 desktop / 55 phone**, the same with props shown, the flock flying and the cards open (first = last; an extra program seen once was fixed, Decisions 3). Calls: +1 only while props are within 110 u (none downtown) or a flight is on; triangles ≤ 140 a prop, ≤ 864 for the parrots' 13 s flight, 560 for the pelicans' 7 s. At the egg spots (desktop high): Telegraph Hill 79 calls / 312k, Chinatown 72 / 250k, the Embarcadero at the Bay Bridge 63 / 183k, Cow Hollow 69–85 / 260–306k, the Tea Garden 76 / 230k, the Wave Organ 57–66 / 117–281k, Crissy Field 95 / 237k, Fort Point 43 / 91k, the GGB deck 36 / 94k, PIER 39 rail 63 / 224k. Pier 45 read **113 calls / 430k** with nothing of mine there (see Requests, V).
- **Facts** — every line and card re-read on its page on **2026-09-28**: Wikipedia (Wild Parrots of Telegraph Hill; Pier 39; Laffing Sal; Musée Mécanique; Fortune cookie; Golden Gate Fortune Cookie Company; Wave Organ; Dawn-to-dusk flight; Alcatraz Island; Alcatraz water tower; 16th Avenue Tiled Steps; Golden Fire Hydrant; Rainbow Honor Walk; Heron's Head Park; Alta Plaza Park), pier39.com/sealions, kqed.org (Chinese Telephone Exchange; Karl), emperornortontrust.org/bridge/proclamations, marinemammalcenter.org (sea otters and SF), nscda-ca.org (Octagon House history uncovered), parksconservancy.org (Alcatraz at a glance), goldengate.org (foghorns; pedestrians free), baynature.org (humpbacks 2018-11-13), localwiki.org + richmondsfblog.com (Lands End labyrinth), nps.gov (China Beach), abc7news.com + sfdahlias.org (dahlia 100, the Dell), currentresults.com (SF normals) + quoteinvestigator.com (the Twain quip), outsidelands.org + noehill.com (Ingleside sundial), sfstandard.com (the hydrant's 18 April), sf.streetsblog.org (Castro crosswalks 2014), sfport.com (Heron's Head), presidio.gov (2026 press; Mountain Lake), missiondolores.org. Spots snapped from OSM (Nominatim) where named there (Grace Marchant Garden, Musée Mécanique, Rincon Park / the Embarcadero, Fort Point, the Wave Organ) and to standable ground in the published city.

### Decisions

1. **Corrections to the scout's wording** (the sources today say less or otherwise): the fortune cookie is "1900 年代初" and 据说 (Wikipedia gives "early 1900s", not 1914, and records the Los Angeles claim); Ross Alley is not called "the oldest alley" (not on the page I could read); Laffing Sal: the arcade bought one at auction after Playland closed in 1972 (not "the" original); the Chinese Telephone Exchange: operators memorised "hundreds, later thousands" of numbers in several dialects (the callers-by-name detail is not on KQED's page); Norton: 64 years (6 Jan 1872 decree → 12 Nov 1936); the Alcatraz name is "一般认为" pelican (Wikipedia: Ayala's name went first to Yerba Buena Island; the gannet reading); China Beach without "19th century" (the NPS page gives no century); the Golden Gate Bridge hum is left out entirely (whether the 2025 fix was finished is not confirmed); PIER 39 gives no months, so the June–July line cites Wikipedia's Pier 39 page and every other month says 通常.
2. **Found = the ledger's bit.** `isFound` reads lane E's `isPaid('egg:<id>')` (bit `EGG_IDS.indexOf(id)` of `play.g.egg`, registered at init) plus this session; lane D never writes the save. A repeat plays the moment quietly (`find` with `first: false`, no reward, no card).
3. **The hidden prop pool keeps a real geometry.** With an empty BufferGeometry, the world's live warm-up pass (it compiles hidden meshes) linked a flat-shaded program of its own (desktop 59 instead of 58). The idle pool now holds a tin 50 u below the origin (never drawn); a test pins the attributes; the browser reads 58 / 55 again.
4. **Papers first, then the find.** Norton's scroll and the capsule letter open first; BAYBAY's lines and the card follow when the paper goes (any way it goes), so nothing is read under it. Papers and the operator close when the player moves 8 u away (a teleport included).
5. **Downtown stays empty of geometry** (the Ferry gate, FiDi, Chinatown, Union Square box): the phone, Ross Alley and Norton are prompts, sound and paper; Norton's post + scroll (140 tris) waits behind `DOWNTOWN_PROPS_HELD` in `eggs/props.ts`.
6. **Dusk = the sky's golden band** (`game.timeOfDay === 'golden'`) until lane R's real sun band decides the sky; **fog = Karl's gate lobe** at the span from the live uniforms (`KARL.uKarl × gate`, no new state).
7. **The foghorn pattern runs from when the fog reaches you** (entering 700 u of the bridge in fog): arriving on the deck mid-cycle can mean up to ≈ 40 s for the mid-span pair — the real pattern, not shortened.
8. **The pelicans fly ahead**, in a V, swooping in from the sides: behind the glide they sat on the camera and read as planks (seen, fixed).
9. **Cards are lazy** (loaded on first show, prefetched after 4 s): the frozen contracts test starts every feature in node, where a stylesheet cannot load.
10. **The operator's replies are said in BAYBAY's bubble** with the speaker named (草药店：…): the bubble has no other anchor near the phone.
11. **The chunk is bigger than the plan's estimate (27 KB gzip, lazy, after the city starts)** because every egg carries its card fact, sources and lines in two languages. If lane V wants it smaller, part b can move `fact` / `sources` into the card chunk (the registry keeps ids, riddles, rumours, lines): an API change for E / C, so only on request.

### Not done (part a)

- Eggs 13–24 (W5-D4), the rumour source (W5-D5: the `rumour` texts are in the registry, framed 听说… ≤ 45 as lane C's `game/rumours.ts` accepts; C's `registerRumourSource` landed during part a and is wired in part b), batch 2 / pebbles / 城市之声 (D6).
- The foghorn-duet **caption** shot of plan §4.12 (the find on the deck was reached in the game; the card had closed by the timed shot); the PIER 39 **dock density by month** (the sea lions are lane T's life: see Requests).
- BAYBAY's float at Fort Point: lane F's `charApi` (with `float`) landed after my shots; the egg calls it (the shot `d3` set has the splash and the lines only) — re-shot in part b.
- Voice clips for the lines (lane V, H5-3).

Status: no relayed owner message reached this lane during part a.

### Requests

- **T (audio · life):** (1) while the duet plays (`fogAtBridge() ≥ 0.4` and the player within 700 u of the GGB mid-span), skip `ambience.foghorn()` so the single horn does not talk over the real two — a flag you read, e.g. a `setFoghornOwner('eggs' | null)` in `audio/cityHooks.ts` or a `duck`-like hook; tell me the name and I call it. (2) a hook to scale the PIER 39 K-Dock sea-lion density by a factor 0.2–1 (`setSeaLionDensity(k)`), which egg 2 would drive from `seaLionMonth()` (June–July 0.35, August 0.65, otherwise 1).
- **V:** (1) Pier 45 (the Musée Mécanique door, `(-212.7, 70.5)`, time day, desktop high) read 113 calls / 430k triangles with nothing of lane D there — above the 400k budget; worth a spot in the gate. (2) When the downtown headroom is published, flip `DOWNTOWN_PROPS_HELD` in `src/opus-bay/eggs/props.ts` (or tell me): Norton's scroll adds 140 tris / +1 call within 110 u. (3) Voice (H5-3): the part-a lines are `EGGS[0..11].lines` + `SEA_LION_MONTH_LINES` + `OPERATOR_REPLIES` + `FORTUNES` + `TOMORROW_LINE` (≈ 40 zh + en).
- **E:** the egg bitset order is `EGG_IDS` (registered by lane D's init); the notebook's 小发现 page can read `eggsInArea(area)`, `riddle`, `stamp`, `name` and `EGG_AREA_NAMES`; finds come as `find { kind: 'egg' }`.
- **C:** none now — the rumour texts are ready (`EGGS[i].rumour`, framed 听说… ≤ 45, with `eggSpots` for `at`) and D5 registers `eggs/rumourSource.ts` with your `registerRumourSource` in part b.
- **R:** egg 7 takes the tide through `setOrganTide(() => 0…1)` (`eggs/marina.ts`) once `tides.json` ships; egg 8's dusk will follow your sun band if you export one I can read (`sunBandAt(bayNow()) === 'golden' | 'dusk'`).
- **F:** none — egg 9 calls `charApi()?.emote('baybay', 'float', { seconds: 7 })`, which your W5-F2 now provides.

## Part b

### 给主人的摘要

1. 24 个"小发现"全部能玩了。新的 12 个：金门海峡的座头鲸（4–11 月，过海峡大约六次碰到一次）、天涯海角时有时无的石头迷宫（走到中心，镜头转向金门大桥）、中国海滩黄金时刻海面升起三艘旧帆船的影子、大丽花 100 岁（花圃和"100"小牌子）、第 16 大道马赛克台阶一口气爬到顶、双峰上看 Karl、英格塞德日晷的影子跟着旧金山真实的太阳走（晚上没有影子，BAYBAY 打哈欠）、金色消防栓（4 月 18 日清晨有刷子刷金漆）、卡斯特罗彩虹斑马线后的彩虹脚印、骑鹈鹕从天上看苍鹭头公园、旧金山 250 岁生日小路（三个 1776 年的地方，每次都说到奥隆尼人）、开玩具小车到阿尔塔广场台阶顶。
2. 不用地图针也能找：BAYBAY 会悄悄说一句"听说……"（只说你还没找到、今天真能找到的那个，5 分钟最多一句）；小铺的寻宝罗盘也会指向最近的一个。要骑鹈鹕才能找的三个，解锁飞行以后才提示。
3. 顺手修了：几个小发现的位置挪到了真正走得到的空地上；道具现在贴着真实地面（以前有的埋在地下看不见）；市中心的诺顿"圣旨"纸卷也立起来了（V 线公布了余量）。
4. 电脑和手机都实际看过截图；着色器数量没变（电脑 58、手机 55）；全部测试通过（1150 项，见下面关于火圈测试的说明）。

### What was built (W5-D4, W5-D5)

Pushed as `7f0d8c7` (W5-D4 / W5-D5) and the follow-up commit that carries this section (the downtown release, the whale kept
clear of the deck, the QA images). All in lane D's folder, lazy (`game/w5Features.ts` → `eggs/index.ts`); nothing enters the
GameRoot graph.

| file | what |
|---|---|
| `eggs/presidio.ts` | Egg 13 **humpback**: a crossing of the Gate (past mid-span on the deck, or through / across the Gate on the pelican, within 320 u of mid-span) rolls one in six (`WHALE_ODDS`) in April–November (`WHALE_MONTHS`), at most one roll a minute; `whaleSpot` finds open water 38–85 u ahead (or to the side), clear for its 10 u and ≥ 32 u from the deck's line (`DECK_CLEAR`); 9 s: the blow (spout sound, white puff), the back rolling, the dive with the fluke up; on foot a 6 s look from behind and above (a beat), on the pelican a glance that never holds the controls; the card after the look. Egg 23 **SF 250 trail**: three stops (the Officers' Club, Mountain Lake, Mission Dolores; any order, a per-viewer mark each), each with its 1776 line **and the Ohlone line**, "还差 n 个"; pennants at the unvisited stops through lane N's `registerFlagSource('eggs-250')` all of 2026 and every 17 September (`bannerDay`), gone once found. Egg 24 **Alta Plaza**: the toy car or the bike stopping (≤ 2.5 u/s) within 3.4 u of the south stairway's top → a squeak, a look down the stairs from uphill behind the car (`beat(…, { vehicle: true })`: only a vehicle that already stands), the 1972 line (the bike has its own 别骑下去); chipped-lip prop. |
| `eggs/west.ts` | Egg 14 **labyrinth**: laid out on ≈ 70 % of Bay days (`labyrinthToday`: the day roll), scattered stones and BAYBAY's line on the others; walking in from outside 2.8 u to within 0.6 u of the centre → a chime, sparkles and a look from inland over the rings to the Golden Gate. Egg 15 **China Beach**: at golden hour, on foot on the lawn above the cove (the site's benches) or on its sand → three junks rise from the water for 6.4 s (`JUNKS`, broadside to the lawn) with a 4.5 s look out over the cove; BAYBAY's 据说 line + "这些帆影只是我的想象哦". |
| `eggs/park.ts` | Egg 16 **Dahlia Dell**: three beds in bloom June–October (`DAHLIA_MONTHS`), the "100" sign all of 2026 (`dahliaSignUp`), both re-checked every minute; walking up (4.5 u) → the find (off season: "通常六到十月开" first). Egg 17 **Tiled Steps**: the climb from the foot (16th Ave) to the top (15th Ave) along the stair (≤ 2.6 u off it) in one go (a 25 s pause or dropping back 18 % starts over): bubbles at 12 %, birds at 45 %, star chimes at 76 %, the find at the top. |
| `eggs/mission.ts` | Egg 18 **Karl**: standing still 2.5 s within 16 u of the Twin Peaks summit; Karl in (`karlIn`: the bank's level ≥ 0.5 and its front ≥ 350 u — the morning and golden layouts) → a look over his bank to Sutro Tower, the lines (the tower line, the 2010 account, the July line only June–August, the Twain myth); away → the month's words (Sep–Oct "Karl often takes time off", else "come back morning or dusk"). Egg 20 **golden hydrant** (OSM node at 20th & Church): a prompt 看看小金栓, a gold glint every few seconds, on **18 April 05:00–09:00** a brush circling it with strokes (`paintMorning`). Egg 21 **Castro**: walking over the 18th & Castro crossing → 12 rainbow prints dropped every 0.7 u, each gone after 6 s (props), the find. |
| `eggs/south.ts` | Egg 19 **sundial**: a prompt 看看日晷; the dial's shadow wedge points away from lane R's real sun (`sunPosition`, azimuth + 180°, shorter when the sun is high), none when the sun is down; by day a look down on the dial and "现在旧金山是 15:04，影子指向东北" (the Bay clock); at night a yawn and "日晷也睡啦". The city frame's compass (`NORTH`, `EAST`, `azimuthDir`, `dirAzimuth`) from `core/geo project`. Egg 22 **Heron's Head**: on the pelican ≥ 10 u above the park within 70 u of its middle → a 2.4 s glance straight down (`hosts.glance`: `runtime.camera.shot` only, no lock), the OSM outline (20 points) glows, marsh birds; once per 40 s. |
| `eggs/rumourSource.ts` (W5-D5) | `eggRumour(ctx, found, { zone?, canFly? })` for lane C's `registerRumourSource`: an unfound egg of the player's zone first (`cityAreaAt`, the same ids as `store.area`), else the nearest within 260 u; never a found or told id; only what can happen today (`liveSpots`: no humpback outside April–November, the labyrinth only on its days, unvisited 1776 stops) and the pelican's three (Crissy landing, Alcatraz loop, Heron's Head) only once `glideUnlocked()`. The text is the registry's own 听说… (C says it as it is). `eggHintSpots(found, canFly?)` for lane E's `registerHintSource('egg')`: every live spot of every unfound egg (the compass picks the nearest). |
| `eggs/hosts.ts` | `vehicleStill`, `beat(…, { vehicle })`, `glance(shot, s)` / `glancing()` (a camera look without the lock, cleared only if still ours), `SEA_Y`; a host arriving gets one step's dt (not the time since it last woke: a still-timer must not jump on arrival). |
| `eggs/props.ts` | New recipes: `labyrinth` (three stone rings with openings, a cairn), `labyrinth-scattered`, `dahlias` (1.5×), `sign100` (digits on both faces), `hydrant` (1.3×), `brush`, `shadow`, `print`, `chips` — all ≤ 200 tris; flat pieces follow the slope. **The pool follows the ground as it streams in** (a prop placed at start stood on the coarse far terrain: the dahlia beds were under the lawn). New flock kinds `whale` (≈ 170 tris, 10 u) and `junk` (≈ 144 tris, two-sided battened sails), own InstancedMeshes on TOY_INST's program. **`DOWNTOWN_PROPS_HELD` = false** (lane V published the downtown headroom: "D's egg props … fit everywhere, the Ferry gate included"): Norton's scroll now stands at the Bay Bridge's foot. |
| `eggs/sounds.ts` | 11 more synthesized recipes: `egg:spout`, `marsh`, `bubbles`, `birds`, `stars`, `chime`, `ting`, `brush`, `yawn`, `squeak`, `sails`. |
| `eggs/gates.ts` | `mark` / `marked`: a per-viewer "been there" (the 1776 stops; localStorage with a memory fallback, like the daily memory). |
| `eggs/registry.ts` | Spots snapped / moved (below); Karl gains the sfbayweather.com source; the Lands End and Tiled Steps names in Chinese as the city uses them (天涯海角, 第 16 大道); `how` of China Beach says the lawn. |
| `eggs/index.ts` | 24 hosts in the registry's order; the rumour and hint sources; DEV / QA `__opusBay.d.rumour()`, `.hints()`, `.pool()` (the pool mesh as drawn). |

**Spots on open, reachable ground** (lane F's sweep run 1 listed five of mine; `scripts/opus-sf/qa/sweep-static.mts --only egg`
now: 26 targets, **0 BOXED, 0 SNAG, 1 UNREACHABLE** — the Wave Organ tip, lane L's jetty — 7 CORRIDOR, i.e. streets, the
deck, alleys): the laughing lady (−212.7, 69.3) → (−214.7, 71.3); the otter roots (−747.3, 598.5) → (−747.3, 595.5) on the
Fort Point apron; the labyrinth → (−743, 1093.7); **China Beach → the lawn above the cove (−614.8, 969)**: its sand strip is cut
off from the stairway in the published city (nav ends 3–6 u short and the controller stops at the road's edge, both checked),
so the lawn is where the egg is found (the sand still counts); **the Wave Organ → (−413, 289.8)** as lane L asked.

### Evidence

- **Checks** on the pushed code `7f0d8c7` (rebased on `c5c5462`): `tsc -p tsconfig.app.json --noEmit` 0 · `eslint .` 0 errors
  (43 old warnings outside `src/opus-bay`) · the suite **1150 / 1150** with the Bay clock pinned to 05:30 (lane T's `--import`
  preload calling `__setBayNowForTests`); on the real clock **1148 / 1150**: the two failures are lane L's fire-ring tests
  (`sf-landmark-context` "D2-10 tops", `sf-sites-w4` "flags … the landmark table matches the models"), which fail from 06:00 to
  21:30 PDT in the fire season whatever the code — **reproduced on a clean checkout of `origin/opus-bay` (`da331c9`) without
  my commit** (a scratch worktree, removed after; its empty admin folder `.git/worktrees/wt-origin` could not be deleted:
  "Permission denied", like several older ones there). I pushed with that known failure (C and E wait on D5's hooks); lane T
  reported the same thing, and lane L fixed it in `e889335` (the tables no longer follow the wall clock). **The follow-up
  commit (this section), rebased on `c45502a` (lane A part b): tsc 0 · eslint 0 errors · the suite 1186 / 1186 on the real
  clock** (1179 / 1179 on `0143dab` before lane A's commits came in).
- **Tests** (`tests/opus-bay-w5-eggs.test.ts`, 28): the plan's list — the humpback only April–November, the dahlia sign only
  in 2026 (and the beds June–October), the hydrant brush only 18 April 05:00–09:00, the labyrinth on ≈ 70 % of 365 seeded days,
  **the sundial's drawn shadow against lane R's `sunPosition` within 2°** (six dates, the prop's geometry itself), the 250
  pennants in 2026 and every 17 September; every new egg's trigger on the real host code (a Gate crossing on the pelican and
  on the deck, a failed roll and the one-minute wait, never under the span; walking into the labyrinth vs standing in it,
  the scattered day's line; golden hour on the lawn vs midday; the Dell's props by month / year; the Tiled Steps in one go vs
  a 26 s rest; Karl in / away with the September words; the hydrant prompt and its brush; the Castro prints that fade; the
  sundial by day and at night; Heron's Head from above vs too low; the 1776 stops in any order, twice at one stop, the
  pennants; Alta Plaza on foot vs the car rolling vs stopped); props ≤ 200 tris, the whale < 500, the junks ×3 < 500; props on
  open ground and the junks on open water in the published city; **the rumours through lane C's real `registerRumourSource`
  / `pickRumour` / `frameRumour`** (zone first, found / told / out of season / pelican-before-glide skipped, every egg's
  rumour said as it is, ≤ 45); **the compass through lane E's real `hintTarget`**.
- **In the real game** (dev server 5509, headless Chrome with the RTX flag, one Chrome at a time, zh; every image read):
  desktop 1440 × 900 quality high; phone 390 × 844 dpr 3 quality mid. Natural triggers seen working: China Beach on arrival
  at golden hour, Karl after standing still on the summit, the Tiled Steps climbed with W, the Castro crossing walked with W,
  Heron's Head after taking off (G) over the park, the 1776 stop at Mountain Lake, the sundial and hydrant prompts (E), the
  toy car boarded at Alta Plaza's top step, **BAYBAY's 听说 from lane C's teller** (the teller's start moved back through
  `__opusBay.c.rumours.state`: "听说花卉温室东边的大丽花圃，今年有个特别的生日。" 3.2 s later). Key images in
  `docs/opus-bay/qa/w5/D/`: `d4-china-beach-junks-desktop`, `d4-china-beach-junks-phone`, `d4-china-beach-card-phone`,
  `d4-humpback-from-deck-desktop`, `d4-humpback-fluke-desktop`, `d4-labyrinth-to-the-gate-desktop`,
  `d4-dahlia-dell-100-desktop`, `d4-tiled-steps-top-desktop`, `d4-karl-sutro-fog-desktop`, `d4-sundial-1500-desktop`
  (?date=2026-09-28T15:00: the wedge to the north-east), `d4-sundial-1500-phone`, `d4-hydrant-brush-0418-desktop`
  (?date=2027-04-18T06:10), `d4-castro-rainbow-prints-desktop`, `d4-herons-head-from-above-desktop` (the glowing outline,
  the pelican, the line), `d4-sf250-mountain-lake-desktop`, `d4-alta-plaza-steps-desktop`, `d4-norton-scroll-downtown-desktop`,
  `d5-rumour-dahlia-desktop`; the two part-a re-shoots `d3-foghorn-caption-deck-fog-desktop` (golden-hour Karl on the deck,
  the two-horn line) and `d3-otter-float-fort-point-desktop` (BAYBAY on her back through lane F's float).
- **Budgets** (read in the browser; fps are lane V's): programs **58 desktop / 55 phone** in every run with the whale, the
  junks, every new prop and the glance on screen (two runs out of ≈ 40 read 76 from their first state on, before any egg
  moment ran — the same kind of downtown-edge reading lane R noted; the next runs at the same spots read 58). Calls /
  triangles at the new spots, desktop high: the China Beach lawn 50–61 / 95–129k, the GGB deck with the whale 33–68 /
  93–178k, Lands End 44–53 / 77–101k, the Dahlia Dell 67–73 / 231–239k, Twin Peaks 67–83 / 218–251k, Heron's Head flying
  40–47 / 70–86k, the sundial 65–70 / 213–218k, the hydrant 76–80 / 310–320k, the Castro 60–63 / 292–295k, the Tiled Steps
  83–84 / 353–355k, Mountain Lake 61–62 / 227–233k, Alta Plaza 63–100 / 234–340k, Norton downtown 64 / 167k, the Ferry gate
  with the scroll in the pool 73 / 226k; phone mid: China Beach 45–55 / 87–106k, the sundial 43–50 / 149–163k. The flock adds
  one call only during a flight (whale 9 s, junks 6.4 s); the pool one call only within 110 u of a prop.
- **Chunk** (a production build to scratch): the eggs init chunk **93.4 KB raw / 38.3 KB gzip** (lazy, after the city starts;
  part a: 27.4), the cards 5.8 / 2.4 + 1.8 CSS; nothing in GameRoot.
- **Facts read on the web on 2026-09-28** (part b additions): sfbayweather.com "When does SF fog peak" (July statistically
  the foggiest month; September–October the clearest) → Karl's July line and a fourth source on egg 18; en.wikipedia.org
  Golden Fire Hydrant (repainted every 18 April, before sunrise; 1906) → the brush's morning. The other facts of eggs 13–24
  were read in part a (sources in the registry: baynature.org humpbacks 2018-11-13; localwiki + richmondsfblog labyrinth;
  nps.gov China Beach; abc7news + sfdahlias.org; Wikipedia Tiled Steps; kqed + currentresults + quoteinvestigator; outsidelands
  + noehill sundial; Wikipedia + sfstandard hydrant; sf.streetsblog + Wikipedia Rainbow Honor Walk; sfport + Wikipedia Heron's
  Head; presidio.gov ×2 + missiondolores.org; Wikipedia Alta Plaza Park).

### Decisions

1. **China Beach is found from the lawn above the cove** (the site's benches): the published city's sand is cut off from the
   stair; the sand still counts if a player gets there. The junks rise broadside to the lawn, with a short look out.
2. **Every sea / sky moment gets a look** (whale, junks, labyrinth, Karl, sundial, Alta Plaza): without it the thing happened
   off screen in most camera angles (seen: the first junks were behind the hill, the whale under the span). On the pelican
   the look is a *glance* (no lock, the controls stay yours); on foot a beat (the feet come back however it ends); cards wait
   for the letterbox to go.
3. **The sundial's shadow is the gnomon's vertical north edge's shadow**: away from the real sun's azimuth (what the plan's
   test pins). The toy fin is steeper than a true 37.7° style (lane L's note), so a style-edge shadow would not read true hours
   either; the line names the Bay clock time and the shadow's compass direction, both true.
4. **The Heron's Head look needs ≥ 10 u above the ground** (a landing in the park is not "from above"); once per 40 s.
5. **The whale is 10 u long (1.4×) and the junks 1.35×**, dahlias 1.5×, the hydrant 1.3×, the prints 0.3 u: toy sizes that read
   from the follow camera (each checked in a shot).
6. **The pelican's three eggs are hinted only after the glide unlocks**; the humpback is hinted (it is found from the deck too).
7. **Karl's line says what the view shows** ("Karl 从海那边漫过来了，苏特罗塔在前面站岗"): in the game his bank lies behind the
   tower, not round its legs (the first wording claimed the tips poked out of him).
8. **Downtown released** on lane V's published headroom (props.ts is lane D's file; V's request was addressed to the lead).
9. **Dusk stays the sky's golden band** (`game.timeOfDay`), which in city mode follows lane R's real sun under Settings › 自动 —
   so egg 8 and China Beach follow the real sun without a direct call to `sunBandAt`.

### Not done

- The Dahlia Dell and the labyrinth are toy-sized patches (three beds; three stone rings), not the full dell or the real
  stone pattern.
- The Castro prints are hidden behind BAYBAY when the camera follows directly behind; they show when you turn or stop.
- Lane A's `FLOAT_LINE` ("海獭亲戚也这样仰面漂…") plays over egg 9's first line when BAYBAY floats at Fort Point (both are
  otter-cousin lines; the fact card carries the story) — see Requests.
- W5-D6 (should: batch 2, the pebbles, 城市之声) not started.
- Voice clips for the part-b lines (lane V, H5-3).

Status: no relayed owner message reached this lane during part b.

### Requests

- **L:** (the fire-ring tests: done in your `e889335`.) The China Beach sand strip is not reachable from the site's stairway
  (nav ends 3–6 u short; the walker stops at the road's edge by the stair): if the stair should reach the sand, its last
  flight needs a walkable link. The Wave Organ spot is at your (−413, 289.8): register the site when you are ready.
- **A:** skip `FLOAT_LINE` when the float comes from `charApi().emote('baybay', 'float')` outside the pet flow (egg 9 says its
  own lines), e.g. only say it from `pet.ts`'s own trigger.
- **T:** still open from part a — skip `ambience.foghorn()` while the duet plays (a `setFoghornOwner`-like flag) and
  `setSeaLionDensity(k)` for the PIER 39 dock by month.
- **V:** voice (H5-3) for the part-b lines: `EGGS[12..23].lines`, `presidio.BIKE_LINE`, `west.SCATTERED_LINE` /
  `IMAGINED_LINE`, `park.OFF_SEASON_LINE`, `mission.SUTRO_LINE` / `SUMMER_LINE` / `AWAY_LINE` / `TODAY_18_LINE`,
  `south.NIGHT_LINE` (and `sundialNowLine` is built from the clock: text only). The eggs chunk is 38 KB gzip lazy: if you want it
  smaller, moving `fact` / `sources` into the card chunk is the lever (an API change for E / C, only on request).
- **E:** the compass list is live (`registerHintSource('egg')`: live spots of unfound eggs; the pelican's three after the glide).
- **C:** the rumour source is live; your teller told the dahlia rumour in the game.
