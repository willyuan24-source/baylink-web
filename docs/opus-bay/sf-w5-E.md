# Wave 5 · lane E · Economy & notebook

Worktree `C:/Users/willy/wt/w5-e` (branch `w5-e`), dev port 5507, scratch `C:/Users/willy/opus-qa/w5/w5-e/`.
Plan `sf-w5-plan.md` §3.4, §3.5, §4.10; lead note `sf-w5-lead.md` (§4.4 the play save, §4.5 the slots, §5 the hooks).

## Part a

### 给主人的摘要

1. 金币账本上线了：到达景点、明信片、帮邻居、完成目标、彩蛋等，每一样只发一次金币，存进存档，重置进度时一起清零（已做 5000 步随机测试，从不重复发、余额从不为负）。
2. 城里现在有 60 条金币小路（台阶、码头尽头、公园小径、观光巴士和地铁站旁，共 366 枚，每天按旧金山日期刷新）、40 个"金币小堆"（山顶、码头尽头、小角落，每份存档一次）和 15 个空中金币圈（科伊特塔、苏特罗塔、市政厅穹顶、金门大桥等上空，要骑鹈鹕穿过去）。
3. 走过去就自动捡，叮的一声，同一条小路越捡音越高；骑车范围大一点，低飞时有"磁铁"。
4. 右上角小药丸显示 `明信片 0/24 · 🪙 4`，捡到时闪一下；电脑和手机（390×844）都实际打开看过。
5. 市中心（金融区、唐人街）的金币先藏着，等 V 线公布市中心性能余量后再打开；画面只多 1 次绘制、不到 1600 个三角形，没有新增着色程序。

### What was built

| task | commit | files |
|---|---|---|
| **W5-E1** the ledger (pushed first, the hook others wait for) | `780018e` | `src/opus-bay/economy/{ledger,sources,hints,index}.ts`, `tests/opus-bay-w5-ledger.test.ts` |
| **W5-E2** coin spots + the placement script | `df85f5f` | `scripts/opus-sf/coins-place.mts`, `src/opus-bay/economy/coinSpots.ts` (generated) |
| **W5-E3** coins in the world, pickup, daily refill | `f8eea2f`, `b80ae63` | `src/opus-bay/economy/{coins.ts,coinMesh.ts,CoinLayer.tsx}`, `tests/opus-bay-w5-coins.test.ts` |
| **W5-E4** the pill badge | `f8eea2f` | `src/opus-bay/economy/{CoinBadge.tsx,format.ts,economy.css}`, registration in `economy/index.ts` |

**The public API** (import from your own lazy chunk; never from a module GameRoot loads):

```ts
// economy/ledger.ts
export function initLedger(): () => void;                 // economy/index.ts init() calls it first
export function pay(source: string, coins: number): number; // what the `reward` listener runs; 0 = refused / already paid
export function isPaid(source: string): boolean;          // paid, or no longer payable (a past day's daily / trail)
export function coinsTotal(): number;
export function spend(item: string, price: number): boolean;   // the 小铺 (W5-E6); emits coins with source `shop:<item>`
export function recordBest(key: string, value: number): boolean;  // lane A's bests into play.b (≤ 32 keys); economy/index.ts re-exports it for play/kit.ts
export function registerRewardIds(prefix: RewardPrefix, ids: readonly string[]): () => void;  // APPEND-ONLY id lists
export function subscribeLedger(fn: () => void): () => void;  export const ledgerVersion: () => number;
export function playState(): Readonly<PlaySaveV1>;        export const todayKey: () => string;   // Bay date
export const REWARD_CAPS: Record<RewardPrefix, number>;   export const PREFIX_KIND: Partial<Record<RewardPrefix, PlayBitKind>>;
// economy/hints.ts (dependency-free)
export function registerHintSource(kind: 'cache' | 'egg' | 'pebble' | 'postcard', fn: () => readonly { id: string; x: number; z: number }[], key?: string): () => void;
export function hintTarget(kind: HintKind | 'any', from: { x: number; z: number }): (HintSpot & { kind: HintKind; dist: number }) | null;
```

**Where "paid" is kept** (`play` in save v2, frozen format; the ledger is its only writer):

| source | kept in | registry (append-only) |
|---|---|---|
| `arrive:*` `postcard:*` `favour:*` `goal:*` `pelican:unlock` | `play.g.coin` bit i | `economy/sources.ts` FIXED_SOURCES (200 at W5-E1: the pelican, 11 goals incl. `goal:pelican`, 6 favours, 24 postcards, 158 arrivals); `coins-place.mts --sources` appends new ones |
| `trail:<trail>:<n>` | `play.t` (today's bits; a new Bay day starts empty = the refill) | coinSpots: trail i owns bits 8i … 8i + 7 |
| `cache:<id>` · `ring:<ring>:<n>` | `play.g.cache` · `play.g.ring` | coinSpots (cache i bit i; ring i bits 8i … 8i + 7; ring 0 = lane A's first flight) |
| `egg:` `sound:` `pebble:` (D) · `view:` (A) · `event:` → `souvenir` (R) · `page:` (E5) | the kind's own bitset | the owning lane's `registerRewardIds(prefix, ids)` |
| `daily:<YYYY-MM-DD>:<1-7 \| all>` | `play.d` (n → bit n − 1, `all` → bit 7); a date before the saved one is never paid | — |
| anything else (`medal:*`, an unregistered id) | `play.e` (≤ 128 sources of ≤ 40 characters); moved into the bitset when its registry arrives | — |

Coins paid = min(asked, `REWARD_CAPS[prefix]`) (arrive 10 · postcard 10 · favour 25 · goal 20 · egg 10 · view 5 · sound 5 ·
pebble 3 · cache 12 · trail 1 · ring 3 (the air-ring coins ask 1, lane A's first-flight rings 3) · event 15 · daily 20 · page 30 · medal 15 · pelican 20), whole, ≥ 0, balance ≤
999,999. A source that cannot be kept (bad daily, unregistered trail id, `play.e` full, > 40 characters) is **not paid**
(DEV warning): never paid twice, never silently lost.

**The coin spots** (placed by `coins-place.mts` on the published city v1 with SF_SITES registered, 29 s): 60 trails ×
5–8 = 366 coins (kinds: steps 4, climb 14, pier 7, path 24, stop 12 — stairways, crests, pier ends and the Wave Organ jetty,
park loops and promenades, loop / Metro stops), 40 caches (hilltops, pier ends, nooks, the eight signature-corner streets
of lane L, two hanging over the Palace rotunda and the Painted Ladies' roofs), 15 air rings (Coit, Transamerica,
Salesforce, the Ferry clock, Sutro Tower, the Painted Ladies, City Hall, the GGB south tower and mid-span, the Palace,
Alcatraz, the de Young tower, Lombard, Twin Peaks, St. Ignatius). **Shown now: 490 coins** (354 trail, 40 caches, 96 ring
coins); **held downtown**: Pier 14, Yerba Buena Gardens, the Transamerica / Salesforce / Ferry-clock rings (36 coins).

**In the world:** `CoinWorld` (64 u buckets; taken flags re-read lazily after a ledger change, a reset or a new Bay
day), pickup ≤ 30 Hz (foot 1.2 u and ≤ 1.8 u of height, bike / car 2 u, gliding < 6 u high a 2.5 u magnet, air coins
3.6 u in 3D only while gliding — flying through a ring's middle takes all eight; never while travelling, riding a line, in
photo mode or outside `playing`), one `reward` per coin (+ `find {kind:'cache'}` for a cache), fx sparkles, a chime that
climbs a major-pentatonic ladder along a trail / ring (a chord for a cache, `audio/hooks`), the draw list ≤ 5 Hz. One
InstancedMesh (48-triangle disc, ≤ 32 instances + 8 pops; a cache is a stack of 4 + one coin turning over it; ring
coins 1.6 ×, facing the flight), our own material instance on the **TOY_INST program** (world/warmup recipe W5-V6:
one shared instance, `instancedWarmup` registered from `initCoins`).

**The badge:** `🪙 n` in the pill slot (≤ 4-character number: 42 · 999 · 1.2k · 12k), a pulse per pickup (none with
reduced motion), `aria-label` 金币 n / n coins; styles load with the chunk (`import('./economy.css')` at init: node — the
contracts test loads economy/index — cannot load .css). `economy/index.ts` stays small (the ledger + the badge); the coins
(spots, pickup, layer) are a chunk loaded right after.

### Evidence

- **Checks** on `b80ae63` (after rebasing on `561e24d`): `npx tsc -p tsconfig.app.json --noEmit` 0 errors ·
  `npx eslint .` 0 errors (the 43 old warnings outside `src/opus-bay`) ·
  `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1010 / 1010** (18 new: 11 ledger, 7 coins).
- **Tests.** `w5-ledger`: once per source, caps, the four places a mark lives, registration moving `play.e` entries into
  the bitset, trails refill per Bay day, daily masks, a seeded 5,000-step fuzz of rewards and purchases (each source paid
  once, balance = sum paid − spent, 0 … 999,999), the 999,999 and `play.e` = 128 caps, the size test (a full play block
  with every save cap: < 64 KB and round-trips untrimmed), Settings reset, hints. `w5-coins`: the W5-E2 order pinned
  (append-only), counts, **every spot re-checked against the published city with the script's own rules** (standable,
  dry, reachable on foot, prompt clearance, 3 u apart, air coins between the soft floor + 1.5 u and 250, downtown flags
  equal the zones), pickup radii, air coins only gliding, refill / reset, ≤ 32 instances, the 48-triangle disc on the
  `ob-toy-inst` program.
- **In the game** (dev 5507, headless Chrome `--force_high_performance_gpu`, `?start=free&world=city&time=golden&save=off`,
  PERF-LOCK respected — I waited for lane V's 09:29Z gate to end):
  - desktop 1440 × 900 high: the Filbert Steps trail drawn (16 instances); 4 coins walked → pill `🪙 4`, `aria-label`
    "4 coins"; the Coit ring hangs over the tower; the Blue Heron Lake path trail; Bernal Heights trail + summit cache.
    **programs 58 before and after** (= the wave-4 baseline); the late warm-up `e-coins` compiled 44 → 44 (no new
    program). Instances 12–18 near the player (≤ 0.9k tris) in one draw call.
  - phone 390 × 844 dpr 3 mid: the same trail and pickup; the badge takes its own line in the pill (day-0 rule) —
    `明信片 0/24 · 🪙 4`; **programs 55 before and after**.
  - Shots (read): `docs/opus-bay/qa/w5/E/` — `e3-filbert-trail-desktop.jpg`, `e4-pill-4-coins-desktop.jpg`,
    `e3-coit-air-ring-desktop.jpg`, `e3-blue-heron-lake-desktop.jpg`, `e3-filbert-trail-phone.jpg`,
    `e4-pill-4-coins-phone.jpg`; the rest in `C:/Users/willy/opus-qa/w5/w5-e/shots/`. No fps numbers (lane V / the lead).
- Sizes: `coinSpots.ts` 15.3 KB raw / 5.6 KB gzip (in the coins chunk, not the first one).

### Decisions

1. **The `coin` bitset holds the fixed reward sources** (arrivals, postcards, goals, favours, the pelican): 158 arrivals do
   not fit `play.e` (128, and `arrive:` + the longest id is 44 > 40 characters). Its registry is a generated, append-only
   literal (`economy/sources.ts`); an id not listed yet is paid through `play.e` and never twice.
2. **Trail coins keep 3.5 u from card prompts, caches 6.5 u** (the postcard rule, plan §3.4). Coins have no prompt
   (walk-through pickup), and at 0.14 u per metre the stairways the plan names are 7–20 u long with their card standing
   on them (the Tiled Steps lie entirely inside 7 u of theirs): 6.5 u would have left them bare.
3. **Reachable** = a walking-graph node of the Ferry gate network within 12 u, *or* ≤ 90 one-unit steps over standable
   ground to one (the municipal pier, the Wave Organ jetty and PIER 39's deck have no graph edges but are walkable).
4. **Explicit lines** for PIER 39, the Aquatic Park municipal pier and the Wave Organ jetty (read off top-down debug maps
   of the published city); every other trail is found on the graph by kind. Hyde Street Pier (not standable in the
   model), Pier 45, Fort Mason's shed piers, the Greenwich Steps (they share Coit's summit with the Filbert trail) and a
   Legion stop (all inside the prompt) were dropped.
5. **A cache is one pickup of 10 coins** (a stack of five discs) and a `find {kind:'cache', first: true}`; the two air
   caches float over the roof at the glide's soft floor + 2.5 u. **Ring slot 0 is reserved** for lane A's first flight
   (`ring:first-flight:1…8`).
6. **Downtown held** (`DOWNTOWN_OPEN = false`, zones Financial District / South Beach and Chinatown) until lane V
   publishes the measured headroom (plan MF9 / D15); flipping the constant shows 36 more coins.
7. **No new program**: CPU turn / bob at ≤ 30 Hz on the TOY_INST program instead of a vertex-stage spin (which would be a
   new program to warm). The otter-paw emboss needs ≈ 40 more triangles per coin: left out (bright centre → gold rim →
   dark edge instead).
8. **Daily source format** (for R): `daily:<Bay date>:<1…7>` and `daily:<Bay date>:all` (the 3 / 3 bonus).

### Not done (part b and later)

- W5-E5 notebook (the `stamp` field of `reward` is not stored yet: the 印章 page will register its stamp ids), W5-E6
  shop (`spend` is in and tested), W5-E7 wearables, W5-E8 the economy run, W5-E9.
- The glide pickup of a ring was exercised in node (all eight through the middle), not flown in the browser (no scripted
  glide path yet); the chime was not listened to (headless).
- Tuning: the refill gives up to 354 trail coins a day if every trail is walked — the scripted 60-minute run (W5-E8)
  sets the prices against what an ordinary hour really picks up.

### Requests

- **Lane D**: in `eggs/index.ts` init, `registerRewardIds('egg', EGG_IDS)` (and the same for `sound` / `pebble` when they
  exist) before the first emit; read `isPaid('egg:<id>')` for `find.first`; the compass: `registerHintSource('egg', …)`
  with the unfound eggs' ground spots (economy/hints.ts).
- **Lane A**: `registerRewardIds('view', VIEW_SPOT_IDS)` in `play/index.ts` init. Done on my side after reading your
  push: `ring:first-flight:1…8` is registered (bits 0–7 of `play.g.ring`) and the ring cap is 3 (your `RING_COINS`);
  `recordBest` is exported from `economy/index.ts` as `play/kit.ts` looks for it (commit `W5-E1: recordBest …`).
- **Lane R**: `registerRewardIds('event', <souvenir event ids, append-only>)`; the daily three pay
  `daily:<dateKey>:1` … `:3` and `daily:<dateKey>:all`.
- **Lane V**: the coin glints at night can read `coinItems()` (economy/coins.ts) positions; the gate spot "the Filbert
  Steps with a coin trail" now has its trail (16 instances ≈ 0.8k tris, +1 call); tell the lead when downtown has room
  for `DOWNTOWN_OPEN`.
- **Lane F** (W5-F9): the phone pill now wraps to three lines with the badge (`明信片 0/24` · `🪙 n` · `目标`); the final look is
  yours.
- **Lead**: nothing frozen needs changing. `npx` resolved everywhere (no fallback to `node node_modules/...` needed).

## Part b

### 给主人的摘要

1. 旅行本里多了「手帐」（第一个页签）：印章（16 个必看地标 + 鹈鹕、走过金门大桥、叮当车、F 线、观光巴士、地铁）、小发现（24 个彩蛋，没找到的是剪影 + 一句谜语）、看风景（16 个观景点，没去过的有「带我去」）、足迹。每集满一页给 30 金币和一件只能靠集章拿到的装扮。页头写今天旧金山的真实日落和月相，再加一句「明天可能不一样」，没有连续签到。
2. BAYBAY 小铺开张：手机点「更多 → 小铺」，电脑点「更多」按钮，或者走到渡轮大厦南侧没开集市的摊位按「逛逛小铺」。点一件就在 BAYBAY（或你）身上试穿，镜头拍你们俩，买下直接穿上。
3. 能买的：BAYBAY 围巾 5 色、帽子 3 顶（毛线帽、遮阳帽、水手帽）、你的帽子和背包颜色、单车和小车的漆、鹈鹕丝带、雾 / 夜相框（拍照自动加框）；寻宝罗盘（右上角箭头指向最近的小发现）和明信片放大镜（最近的明信片插金色小旗），各管一趟。
4. 飞行券：还没有鹈鹕时 BAYBAY 先送一张，「问 BAYBAY → 用飞行券飞一次」选一个必看地标就飞过去；有了鹈鹕后飞行券自动收起，没用的退 10 金币。
5. 电脑和手机上都实际点过、买过、试戴过、飞过；新装扮不增加着色程序；全部测试通过。

### What was built

| task | commits | files |
|---|---|---|
| **W5-E5** the 手帐 tab | `8d4e3a4` | `src/opus-bay/economy/{stamps,notebookRun,today}.ts`, `Notebook.tsx`; the tab registered in `economy/index.ts` |
| **W5-E6** the 小铺 | `8d4e3a4`, `975e0f2`, the report commit | `economy/{items,wallet,bits,shopRun,compass,lines,extras}.ts`, `Shop.tsx`, `CompassBadge.tsx`, `economy.css`; `ledger.commitPlay` |
| **W5-E7** wearables | `8d4e3a4` | `economy/{wear,hats,frames}.ts` |
| tests | `8d4e3a4` | `tests/opus-bay-w5-shop.test.ts` (15), `tests/opus-bay-w5-notebook.test.ts` (9) |

**How it loads.** `economy/index.ts` (the first wave-5 chunk) now also registers the Journal tab `notebook` (order 7:
after R's 今天, before 明信片 10) and the overlays `e-shop` / `e-ticket` (lazy bodies), then loads `extras.ts` right after
the coins: `initWear()` (the looks), `initShop()` (More → 小铺, the stall, the ticket rule, the conveniences) and
`initNotebook()` (stamps, page rewards). Chunks (vite build to scratch, gzip): extras 1.3 KB · notebookRun 2.6 · wear 2.8 ·
shopRun 6.0 · Shop 5.5 and Notebook 6.0 (first open only) · economy.css 2.7; shared with lanes D / A: eggs `registry` 14.9,
`viewSpots` 2.1. Nothing of it is in GameRoot (checked in that build: no economy string in the GameRoot chunk).

**The play save** (frozen format; the ledger stays its only writer — `commitPlay` is lane-E-internal):

| what | where | registry (append-only) |
|---|---|---|
| owned items; a held convenience (compass / magnifier / 飞行券: one held) | `play.g.own` bit i | `economy/items.ts` ITEMS (30: 26 for sale, 3 earned, 1 hidden gift marker) |
| the worn item per slot | `play.w[slot] = i` (the 8 frozen slots) | the same ITEMS index |
| the 印章 page's stamps, once seen | `play.g.stamp` bit i | `economy/stamps.ts` STAMPS (16 `t1:<attraction>` + 6 journeys) |
| a full page paid (30 金币) | `play.g.page` (`page:<id>`) | PAGE_IDS `stamps · finds · views` |

**The shop API** (`economy/wallet.ts`): `owns · wornItem · wornAll · holds · canBuy · buy · wear · takeOff · grant ·
consume · giveFirstTicket · ticketRule`. `buy` takes the price once (`coins` event, source `shop:<id>`, delta < 0) and wears
a wearable at once; `shop` events `open / buy / wear / close` are emitted. Prices (plan §3.4): scarves 40, BAYBAY hats 80,
your hat / backpack 30, bike / toy-car paints 60, the pelican ribbon 50, frames 30, compass / magnifier 20, 飞行券 10 —
26 items, 1,140 coins in all (1,090 for the 23 wearables). W5-E8 (the scripted hour) still has to set them.

**Wearables** (`economy/wear.ts`, through lane F's `charApi`): scarf → `tint('baybay','scarf')` · BAYBAY hat →
`attach('baybay','head', mesh)` · your hat / backpack → `tint('player', …)` · bike / car / pelican → `vehiclePaint(kind,
PAINTS id)` · frame → lane C's `registerFrameDecorator('e-frame')`. Only looks that changed are sent; a new implementation
(the actors remount) gets every worn look again; the shop's try-on is a preview dropped on close. The hats (`hats.ts`):
beanie 342, sun hat 304, sailor cap 308 triangles, plain Meshes on our own instance of the **TOY_DYN program** (key
`ob-toy-dyn`, no shadow), warm-up key `e-hats`; +1 draw call while BAYBAY wears one. The frames (`frames.ts`): 雾 (Karl's
puffs), 夜 (stars and a crescent), 金色时刻 (earned: rays and a low sun), 邮戳 (earned: a stamp's perforations and SAN
FRANCISCO · BAY), painted only in the card's outer ring (clipped even-odd, ≤ 60 % of the margin and ≤ 25 % of the band), so
the photo, caption and stamp are never covered. The orange items follow lane F's new International Orange tone (`#c44a31`).

**The notebook** (`stamps.ts` + `notebookRun.ts`): a landmark stamp = an arrival (the save's `arrivals`, or the paid
`arrive:`), or its place discovered (Alcatraz: its Pier 33 landing, or egg 11 round the island); journeys by goal or by a
ride (`rides` keys `powell-hyde · powell-mason · california · streetcar · sf-loop · n-judah · m-ocean-view`). Seen stamps
go into `play.g.stamp` (a trimmed `arrivals` list never un-stamps; nothing is persisted under `?discover=all`). Every 2 s
and after each ledger change a full page pays `page:<id>` once and grants its cosmetic (印章 → 邮戳相框, 小发现 → 寻宝金围巾,
看风景 → 金色时刻相框, plan §3.5) and BAYBAY says so. It registers lane A's `view` ids too (A's own append-only list). The
header (`today.ts`): `旧金山 9月28日 周一 · 日落 18:57 · 今晚约是亏凸月` + 明天可能不一样 (lane R's `sunTimes`,
`moonPhase`). New stamps land with a thud (CSS; none with reduced motion; per viewer in localStorage).

**The shop in the world** (`shopRun.ts`): the stall is the Ferry Plaza south stall nearest the Ferry gate (158.85, −3.76;
a district prop, 0 new geometry); its prompt 逛逛小铺 is offered while the market is not on (`world/clock isMarketOpen`, the
clock that tarps the canopies); in market hours the sheet says 今天集市，小铺在「更多」里。 The sheet holds
`holdLock('shop')` and, when BAYBAY is within 10 u, a two-shot (`holdFraming`, cover 0.42 phone / 0.5 desktop), and folds
lane C's goals card. Phone: a bottom sheet at 38 %, one row of big tiles; desktop: a counter along the bottom, left of the
round HUD buttons (the pill with 🪙 stays in view). 寻宝罗盘: a pill badge `🧭 ➤ 700米` (the arrow turned as the camera
sees the nearest unfound cache / egg / pebble; real metres from the city projection), ending at the next such `find`.
明信片放大镜: lane N's flag layer (`registerFlagSource('e-magnifier')`, gold, the Sparkles glyph) over the two nearest unfound
postcards beyond the flags' 60 u near ring, ending at the next postcard. 飞行券: BAYBAY's gift before the pelican (once
per save), the ask item 用飞行券飞一次 while one is held, the picker (the 16 must-sees, not visited first, then farthest), the
flight through `fastTravel.startTravel` (a first sight when not found yet), 10 back when the glide unlocks
(`subscribeGlide`). BAYBAY's 11 lines are in `economy/lines.ts` (voice ids `e-<key>`), said only in a quiet moment.

### Evidence

- **Checks**: `npx tsc -p tsconfig.app.json --noEmit` 0 errors · `npx eslint .` 0 errors (the 43 old warnings, none in
  economy/) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1120 / 1120** before rebasing on
  `0db1687`; after the rebase the lane's and related files (shop, notebook, ledger, contracts, w5-perf, play-acts) 82 / 82,
  and the full suite again before the push.
- **Tests** — `w5-shop`: the registry pinned (append-only indices), prices, and "nothing sells speed / access / places" (a
  grep: no unlock, discovery, goal or speed call anywhere in economy/), buy / wear / take off, earned items, the 飞行券
  rule (gift once, one held, refund once, hidden after), conveniences, a 200-round fuzz of `bitClear` / `bitList` against a
  set model (same string as bitSet's), the save round trip, the looks through a stub charApi (only changes, try-on and
  back, a new implementation), the hats (≤ 420 tris, the TOY_DYN key, the warm-up built from the real material), the frames
  (clipped even-odd before painting), E's lines (zh ≤ 45), the compass maths, the sheet rendered in node. `w5-notebook`: the
  16 stamps equal the rank-1 attractions (ids, place ids, short names, the island's landing), when a stamp is stamped,
  stamps kept in the save, nothing persisted under `?discover=all`, each page pays 30 + its cosmetic once (all three →
  62 / 62), the MF8 areas, the header against R's sun (Sep 28 18:5x, Dec 21 16:5x), the tab at order 7, the notebook
  rendered in node.
- **In the game** (dev 5507, headless Chrome `--force_high_performance_gpu --lang=zh-CN`, `?start=free&world=city&time=
  golden&save=off`; PERF-LOCK respected: I waited for lane V's 11:55Z gate), every image read:
  - desktop 1440 × 900: the shop from `openShop` and from the stall's E prompt; the Karl-grey scarf tried on (BAYBAY's GLB
    scarf turns grey) and bought (300 → 260, the tile ✓ 穿着, the pill 260); the beanie, sun hat and sailor cap on BAYBAY;
    the helpers shelf; the compass bought (pill `🧭 ➤ 700米`, target lane D's Emperor Norton egg 90 u away); the ticket
    picker and a real ticket flight to Golden Gate Park (landed at Overlook Drive; ticket used; shop and picker closed);
    the magnifier's two gold pennants over Pier 7 and the F-line stop (`guide.stats.picks` lists `extra:e-magnifier:*`);
    the frames shelf and the night frame on a card; the notebook's 印章 (Coit stamped), 小发现 (3 found, silhouettes +
    riddles) and 看风景 (带我去 rows).
  - phone 390 × 844 dpr 3 mid: 更多 → 拍照 · 小铺 · 设置; the shop sheet with the Karl-grey try-on; the compass badge in the
    pill; the notebook (tabs 手帐 · 明信片 · 目标 · 想去 · 足迹 fit, 56–95 px each).
  - **Programs**: 90 before and 90 after trying all three hats, a scarf and a hat colour (boot warm-up 25 → 44, live pass
    48 → 58, next-level pass 58 → 90, the same passes as before); `e-hats` is compiled in the boot pass.
  - Shots: `docs/opus-bay/qa/w5/E/` — `e5-notebook-{stamps,finds,views}-desktop.jpg`, `e5-notebook-finds-phone.jpg`,
    `e6-shop-try-karl-grey-{desktop,phone}.jpg`, `e6-more-menu-phone.jpg`, `e6-stall-prompt-desktop.jpg`,
    `e6-ticket-picker-desktop.jpg`, `e6-compass-pill-phone.jpg`, `e6-magnifier-pennants-desktop.jpg`,
    `e7-hat-{beanie,sailor}-desktop.jpg`, `e7-frames-shelf-desktop.jpg`; the rest in `C:/Users/willy/opus-qa/w5/w5-e/b/`.
    No fps numbers (lane V / the lead).
- **Facts** (checked on the web on 2026-09-28): the Golden Gate Bridge's colour is called International Orange —
  https://www.goldengate.org/bridge/history-research/bridge-features/color-art-deco-styling/ ; the dahlia became San
  Francisco's official flower in 1926 — https://www.dahliadell.org/history (also abc7news.com on the 100th anniversary).
  Each is a one-line note on its shop item, with the source link in the sheet.

### Decisions

1. **One module name per case**: the shop's logic is `wallet.ts` (a `shop.ts` beside `Shop.tsx` collides on Windows).
2. **Earned, never sold**: the three page cosmetics are not for sale (the plan's "the full 看风景 page → the golden-hour
   frame"); the frames for sale are 雾 and 夜. Their locked tiles say how to get them.
3. **BAYBAY's own teal is the default look** (no 海湾青 scarf to buy: 取下 gives it back); 5 scarves for sale, 1 earned.
4. **Conveniences are held, one at a time**: the `own` bit means "one held"; buying switches it on for one outing, which
   ends at the next matching find (a cache / egg / pebble for the compass, a postcard for the magnifier) and survives a
   reload. The 飞行券 likewise; BAYBAY's gift is remembered by a hidden marker item.
5. **The ticket flies to a must-see** (the 16 T1, not visited first): before the unlock 飞过去 goes only to discovered
   places, so the ticket takes you somewhere new; it calls `startTravel` directly (as lane R's venues do) instead of
   changing lane N's planner.
6. **The stall** is an existing Ferry Plaza stall (the south one nearest the Ferry gate; the plan says "back plaza", but
   the market kit stands on the front and south plazas), open while the market is not on, by the stall's own clock.
7. **The 印章 page** is the 16 must-sees and six journeys (22, can be completed); other arrivals and neighbourhoods are
   counted on the page with a link to 足迹. Event souvenirs are not on the page yet (see Not done).
8. **Stamps are kept** in `play.g.stamp` once seen (the `stamp` field of `reward` events is not needed: each stamp's
   source is already in the save).
9. **The desktop shop is a bottom counter** left of the round buttons, not the right side sheet: that would cover the pill
   (the balance) and the 更多 button, and the Overlay's `has-sheet` shift only follows panels.
10. **The magnifier's pennants start 60 u away** (the flag layer's near ring): a closer postcard already glints in view.

### Not done

- **W5-E8** (the scripted 60-minute economy run → prices) and **W5-E9** (城市之声 / 自然 pages, the toys shelf with lane A)
  were not in this part; the prices are the plan's.
- The tiles are drawn (SVG, lucide, a canvas preview for frames), not lane V's H5-1 painted tiles.
- BAYBAY's new lines and the shop were not listened to (headless); the lines have voice ids `e-<key>` but no clips yet.
- A photo taken in photo mode with a frame was not saved in the browser (the shutter downloads a PNG); the frame was
  checked on a card painted through the same decorator in the page, and in node.
- Not tried on a real iPhone (the lead's verify).
- Event souvenir stamps on the 印章 page: they need lane R's `event` id list (not registered yet); the ledger already keeps
  them in `play.g.souvenir`, the page will list them (never required for a full page: they are time-limited).

### Requests

- **Lane C** (Journal): in city mode the built-in 足迹 tab can go — it is the 手帐's last page now; with R's 今天 the plan's
  five tabs are 今天 · 手帐 · 目标 · 明信片 · 想去 (six do not fit 375 px).
- **Lane V**: H5-1 shop tiles keyed by the ids in `economy/items.ts` (26 for sale + 3 earned; a
  `public/opus-bay/w5/shop/<id>.webp` would need a small change on my side to show); voice clips for `economy/lines.ts` (11
  lines, ids `e-<key>`); a worn BAYBAY hat is +1 call and ≤ 342 tris.
- **Lane N**: the magnifier uses your flag source API as designed; the pennants stand ≈ 30 u tall, so from the follow camera
  the near ones (Pier 7 from the Ferry gate) are above the frame — perhaps a lower pole for extra flags within ≈ 150 u.
- **Lane F**: `charApi` covers everything E needs (tint, attach, vehiclePaint, emote pose / cheer); the phone pill wraps to
  three lines with the coin and compass badges (`明信片 0/24` · `🪙 220 · 🧭 ➤ 700米` · `目标`) — W5-F9's layout.
- **Lane R**: `registerRewardIds('event', …)` is still needed for event souvenirs.
- **Lead**: nothing frozen needs changing. `npx` resolved everywhere.
