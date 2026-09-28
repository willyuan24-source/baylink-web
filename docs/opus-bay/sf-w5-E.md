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
  economy/) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1141 / 1141** on the head rebased on
  `0db1687` (1120 / 1120 before the rebase; 24 of them new: 15 shop, 9 notebook).
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

## Part c

### 给主人的摘要

1. 检查点找到的 9 个"金币卡住"的地方都修好了：市政码头和海浪风琴防波堤的远端寻路到不了，那两条金币路改到岸边步道和去风琴的路上；克兰湾、24 街等"金币小堆"挪到三面都走得开的地方。现在每个金币点都用 F 线同一套走路检测来放，静态检测 0 个卡住。
2. 用真实地图、真实账本跑了"一小时典型玩法"（快、普通、慢三种节奏）：普通玩家第一小时大约攒 450 金币，够买 5 件装扮，第一件 5 分钟内就买得起；23 件装扮全部买齐大约要玩 7 小时。
3. 价格按这个结果定了：BAYBAY 围巾 70、帽子 150，你的帽子和背包 50，单车/小车漆 110，鹈鹕丝带 90，相框 60；罗盘和放大镜 20、飞行券 10 不变。金币永远买不到速度、地方或交通。
4. 手帐新增「城市之声」页（D 线的 12 种城市声音，没听到时是谜语和去哪儿听，集满送"城市之声相框"），小发现页多了 6 张彩蛋明信片（找到彩蛋才出现，点开看大图）和 BAYBAY 的小石子数，印章页多了活动纪念章，足迹页多了「我的记录」（爬台阶级数、滑梯/摇铃/台阶赛最好成绩；只看今天，没有连续打卡）。
5. 电脑和手机上都实际打开看过；全部 1293 个测试通过，改动都已推上去。

### What was built

| task | commits | files |
|---|---|---|
| **CP-4** part b on origin | `7d43e5b` … `2d994f0` (the five part-b commits, rebased on `dfb02f3`, checks 1221 / 1221; the part-b table above names their pre-rebase ids) | — |
| **CP-5** stuck coin spots (W5-E2) | `58d674d`, `88722c2`, `3a8f086` | `scripts/opus-sf/coins-place.mts`, `economy/coinSpots.ts` (generated), `tests/opus-bay-w5-coins.test.ts` |
| **W5-E8** the economy run, prices locked | `8d71207` | `scripts/opus-sf/economy-run.mts`, `economy/items.ts` (prices), `tests/opus-bay-w5-economy.test.ts`, `tests/opus-bay-w5-shop.test.ts` |
| **W5-E9** the should pages | `08b5e1b`, `9b21f1a`, and the commits with this report (the pebbles row; lane D's batch-2 eggs) | `economy/{Notebook.tsx,records.ts,stamps.ts,notebookRun.ts,items.ts,frames.ts,lines.ts,economy.css}`, `tests/opus-bay-w5-notebook.test.ts` |

**CP-5 · every coin where the walker can leave it.** `coins-place.mts` now judges every ground spot the way lane F's
sweep does (`walkProblems`): the real `PlayerController` pushed 1.5 s in four directions (the most open first), the
game's path finder (`actors/nav findPath`) from the walking graph's main network, on the city as the game streams it
(`CitySites` walk inputs with their tops, sinks and measured bases; before, the script used the postcard test's
`landmarkWalkInputs`). A trail coin must move ≥ 3 u two ways (a pier, a stairway or a sidewalk is a corridor), never
snag, and be reached by the path finder within 1.1 u; a cache must move three ways **at two turns of the cross (0° and
45°)** (the live sweep pushes along the camera's axes, whatever way it faces), and a street-corner cache takes the most
open of its first 24 good points. A published spot that still passes every rule is **kept** (players learn where the
coins lie); only failing ones move (`--replace a,b` / `--fresh` force it; `COINS_DEBUG=<trail>` prints each refusal).
What moved:

- the checkpoint's nine: `lyon-street-steps:1` (the trail now starts one landing up), `municipal-pier` (the pier is off
  the walking network: its slot now leads along Aquatic Park's promenade to the pier's foot, 6 coins; its end cache sits
  at the foot), `wave-organ-jetty` (the jetty's far half is off the network too: Yacht Road out toward the Wave Organ, 6
  coins), `ina-coolbrith` (a boxed-in top terrace and paths that hold only 3–4 walkable coins: **retired**, its slot kept;
  `fort-mason-meadow` appended in its place), `crane-cove-end`, `calle-24`;
- lane N's request: every coin keeps **4 u from the trip ends and landings** (the attractions' arrivals and lane L's
  site arrivals, `data/sf/siteArrivals.ts`): buena-vista-park #5 / #6, bison-paddock #1, stop-haight #1, the caches
  sutro-heights-top and seward-slides-top moved (lane N wired four more site arrivals on it: `97012a6`);
- lane L's request: the corner caches `castro` and `haight` appended (lane L's corners use them: `2a474f1`);
- the stricter cache rule moved 11 caches (lands-end-overlook, crane-cove-end, india-basin, clarion-alley,
  irving-street, clement-street, calle-24, noe-valley, japantown, haight, castro).

Now: 60 trails (1 retired) with **363 coins**, **42 caches**, 15 rings (unchanged).

**W5-E8 · the scripted economy run** (`scripts/opus-sf/economy-run.mts`; `runEconomy()`, `priceCheck()` and `supply()`
are exported for the test). What is real: the published city and walking graph (the player walks graph paths at 0.95 ×
`WALK_SPEED` = 4.0 u/s; the GGB deck walker measured 4.16), lane E's coin spots and `CoinWorld` pickup (radii, heights,
the Bay-day refill), lane C's `ArrivalWatcher` over `ATTRACTIONS` (a first arrival pays T1 10 · T2 5 · T3 3, as
`game/cityMoments.ts` does), lane D's egg spots and `EGG_COINS`, lane A's view spots and `VIEW_COINS`, the first flight
(8 × `RING_COINS` + the three medals, 45 s as lane A measured), lane C's `REWARD_COINS`, lane R's `dailyThree` for each
Bay date over `public/planner-catalog.json`, and the ledger paying each source once. What is a model (three profiles
bracket it): 飞过去 6 s for a place farther than `walkMax`, the arrival card (T1 20 s · T2 10 s · T3 5 s) and a stay
(typical T1 120 s · T2 45 s · T3 20 s) with a short wander at each place, the must-sees first; noticing a trail or cache
within 40 u and an egg, postcard or view within 45 u (at most 2 eggs, 2 postcards, 2 views an hour); 15 coin-free
minutes an hour for the typical player (a bus leg (the lap is 17.8 min), a ride, chatting, emotes, photos; 5 brisk,
18 relaxed); one hour a day. Hour 1 opens as the checkpoint's phone script did (the goals step, carried up the Filbert
Steps with the parrots egg, the pelican, the first flight, PIER 39 and its end cache, the cable car). Favours, the Metro
/ campus / sightseeing goals, activities other than the first flight, souvenirs and notebook pages are left out, so the
run is on the low side.

| profile | hour 1 | by minute (5′ · 15′ · 30′ · 60′) | after 2 h · 4 h · 8 h | places in hour 1 |
|---|---|---|---|---|
| typical | **449** (arrivals 134, goals 80, trail coins 61, the first flight 54, caches 50, eggs 20, postcards 20, the daily three 20, views 10) | 115 · 206 · 285 · 449 | 743 · 1,292 · 2,018 | 23 |
| brisk | 559 | 115 · 206 · 303 · 559 | 970 · 1,691 · 1,804 (runs out of places after hour 4) | 32 |
| relaxed | 404 | 115 · 206 · 257 · 404 | 647 · 1,086 · 1,878 | 18 |

The city holds **2,637 one-off coins** (arrivals 667, caches 420, eggs 330 (lane D's two batches), event souvenirs 270,
goals 200, postcards 160, favours 150, ring coins 120, medals ≈ 120, pages 120) plus 351 trail coins and the daily three's 50 each Bay day.

**Prices locked** (the plan's ratios × ≈ 1.8, round numbers): BAYBAY scarves **70**, BAYBAY hats **150**, your hat /
backpack colours **50**, bike / toy-car paints **110**, the pelican ribbon **90**, frames **60**; the compass and the
magnifier stay **20** (one outing each, not cosmetics), the 飞行券 **10** (its refund stays 10). The wardrobe is **1,970**
coins for 23 wearables (average 85.7): the typical first hour buys **5.2** of them (relaxed 4.7, brisk 6.5), one about
every **11–13 minutes**, the first within **five minutes** (115 coins at 5′); the typical player has bought everything
after **about 7 hours** (1,998 after hour 7; the relaxed run 1,878 after 8, with the sources the run leaves out ≈ 8–9 h).
The wardrobe is 75 % of the one-off coins: nobody needs the daily refills to buy it all. Coins still never buy speed,
access or places (the grep test in `w5-shop`).

**W5-E9 · the should pages and the ladder.**

- **城市之声** (lane D's W5-D6, delivered during this part): a fifth notebook page with the twelve sounds grouped by lane
  D's eight areas; until heard, the riddle and where / when to listen (lane D's `how`); once heard, the name and its
  fact. A full page pays `page:sounds` (30 金币; `PAGE_IDS` bit 3, append-only) and gives a new earned cosmetic, the
  **城市之声相框** (item 30: a bay-teal ring with a foghorn's sound rings and little notes, painted only in the polaroid's
  border like the others); BAYBAY says 城市之声都听全啦！送你一个城市之声相框。 (zh 20). The notebook registers lane D's
  `sound` ids too (the same append-only list).
- **小发现**: both of lane D's egg batches (`ALL_EGGS`: 24 + the nine of batch 2 that landed during this part, each with a
  silhouette glyph; the page is now 33), with lane V's six secret postcards (W5-V8) on top: a blank card until its egg is found, then the 600 × 450
  picture and its title; a tap shows the 1200 × 900 one. Then **BAYBAY 的小石子 n/48** (lane D's pebbles: a count, never a
  page to fill).
- **印章**: lane R's event souvenirs (`SOUVENIR_IDS`, names from `EVENT_SAY`) as stamps once earned at a real event in its
  window, never part of the full page (22 stamps stay 22).
- **足迹**: **我的记录** above lane N's page: lane A's stair steps (today's count only for today's Bay date, and in all)
  and the activity bests (纸板滑梯 · 台阶赛跑 × 2 · 缆车摇铃); nothing is compared, nothing is a streak.
- A new page opens at its top (the Journal kept the scroll between pages).
- **The unlock ladder** (plan §3.5): the four pages each unlock an earned cosmetic (邮戳相框, 寻宝金围巾, 金色时刻相框,
  城市之声相框), shown locked in the shop with how to get them; souvenirs are never sold; no street, line or place is locked
  by coins. The toys shelf ("lent free the first time, then sold") waits for lane A's toys (none exist; the Seward
  slides' cardboard stays free: coins never buy access).

### Evidence

- **Checks** on the pushed head `9b21f1a` (rebased on `508d4f0`): `npx tsc -p tsconfig.app.json --noEmit` 0 errors ·
  `npx eslint .` 0 errors (the 43 old warnings, none in economy/) · `npx tsx --tsconfig tsconfig.app.json --test
  tests/opus-bay-*.test.ts` **1291 / 1291**; on the report's head (rebased on `ead7e08`, lane D's batch 2) **1293 / 1293**
  (one wall-clock flake, `sf-transit-review` R5, passed alone and in the next full run). New or changed tests: `w5-economy` (2: hour 1
  of the typical profile on the real ledger buys 3–5.5 cosmetics, the first within ten minutes, each source paid once,
  what hour 1 is made of; the one-off coins cover the wardrobe with room to spare and the wardrobe is 6–8 hours at the
  run's pace), `w5-shop` (the locked prices, the wardrobe 1,970, item 30, the sounds frame clipped to the ring),
  `w5-notebook` (`PAGE_IDS`, the sounds page pays once with its frame, 我的记录 from `play.b` with yesterday's count
  hidden, the souvenir, the secret postcards and the pebbles rendered in node, never a streak), `w5-coins` (every ground
  spot passes the walk rule: two ways for trail coins, three ways at two turns for caches; the append-only order with
  `fort-mason-meadow`, `castro`, `haight`; Ina Coolbrith retired).
- **Lane F's static sweep** (`scripts/opus-sf/qa/sweep-static.mts --only coin,cache`) on E's targets: before, 5 BOXED,
  2 SNAG and 5 UNREACHABLE (the checkpoint's list); now coins 140 ok + 40 CORRIDOR (stairways, piers, sidewalks), caches
  **40 ok**, **0 BOXED / SNAG / UNREACHABLE / OFF**.
- **Lane F's live walker** (`walker-sweep.mjs`, dev 5507, desktop, headless Chrome `--force_high_performance_gpu`,
  PERF-LOCK respected, `--only all`; stuck = fewer than 3 of 4 camera-relative directions moving 3 u):
  - the moved trails and caches (61 targets): the checkpoint's nine are no longer boxed; 3 flags were the walker's own
    artifact (after 8 neighbourhoods the goals step opened and held the player: 0 u, or 712 u once it closed),
    `crane-cove-end` moved only one way (a strip between a wall and the water: then moved by the stricter cache rule),
    the rest were two-way corridors (stairway and promenade coins, the Haight stop's sidewalk);
  - all 40 ground caches in batches of ≤ 6 (to stay under the neighbourhood goal): 33 moved three or four ways, 7 two
    ways (none boxed); the two-turn rule then moved india-basin and irving-street and the open-spot rule calle-24; the six
    moved caches walked again: 5 pass, `calle-24` two ways (a 24th Street sidewalk where the live traffic lane, which the
    static city does not have, closes the kerb side). Contact sheets in `C:/Users/willy/opus-qa/w5/w5-e/c/walk-*`.
- **In the game** (dev 5507, `?start=free&world=city&time=golden&save=off`, `--lang=zh-CN`, every image read; QA copies
  in `docs/opus-bay/qa/w5/E/c-*.jpg`):
  - desktop 1440 × 900: the shop with a first hour's balance (430 when the shot was taken): scarves 70, hats 150
    (`c-e8-shop-hour1-balance-desktop.jpg`); the frames shelf with the locked 城市之声 frame (`c-e9-shop-frames-desktop.jpg`);
    小发现 with the parrots' secret postcard opened big (`c-e9-notebook-postcard-big-desktop.jpg`); 印章 with the Fleet Week
    jets' souvenir (`c-e9-notebook-souvenir-desktop.jpg`); 城市之声 2/12 with two heard (`c-e9-notebook-sounds-desktop.jpg`).
  - phone 390 × 844 dpr 3: the shop's 坐骑 shelf at 110 (`c-e8-shop-rides-phone.jpg`); 小发现 with two secret postcards
    (`c-e9-notebook-secret-postcards-phone.jpg`); 我的记录 (`c-e9-notebook-records-phone.jpg`); 城市之声, the five page tabs
    fitting at 66 px each (`c-e9-notebook-sounds-phone.jpg`); the Journal's own six tabs fit too (今天 · 手帐 · 明信片 · 目标 ·
    想去 · 足迹). The `c-cp5-walker-crane-cove-end-before.jpg` shot is the one-way cache before it moved. No fps numbers
    (lane V / the lead).
- **Sizes** (vite build to scratch, gzip): Notebook 7.7 KB (was 6.0: the souvenir names, the postcards, the sounds and
  the records), notebookRun 2.7, Shop 5.4, shopRun 6.2, wear 3.0, coins 7.7, economy.css 3.1; nothing of lane E in
  GameRoot (searched the chunk). The run and the placement are scripts (not shipped).
- **Facts**: no new real-world fact of lane E's in part c; the sounds' and souvenirs' facts and names are lane D's and
  lane R's, shown as they wrote them, with their sources.

### Decisions

1. **The walk rule is lane F's verdicts**, not a new one: trail coins may lie on corridors (the plan's stairways and piers
   are corridors by nature); caches, being single spots, must be leavable three ways at two turns of the cross.
2. **Keep what passes**: re-running the placement moves only failing spots, so a new rule never reshuffles the city.
3. **Off-network piers are not coin places**: the municipal pier and the Wave Organ jetty's far half cannot be reached
   by the path finder (lane L's sites); their trail slots were re-laid on reachable ground next to them instead of
   retired; the Ina Coolbrith trail was retired (append-only) and replaced.
4. **The run is a model with real parts**, bracketed by three profiles; it leaves sources out rather than invent them,
   so its totals are a floor. The checkpoint's live sessions (phone 188 in ≈ 50 min of QA, desktop 161 in 35 min) sit
   below the model's typical hour because they were mostly testing time.
5. **Prices: 5 cosmetics in hour 1 and everything after ≈ 7 h**: the plan's two targets pull against each other (the
   first hour is front-loaded: the pelican, the first flight and the first arrivals give 115 coins in five minutes);
   these prices meet both for the typical player and keep the first purchase within minutes.
6. **Souvenirs and pebbles never fill a page** (time-limited / a count of 48); the 城市之声 page does, with an earned frame.

### Not done

- The toys shelf (needs lane A's toys); a real 60-minute live run by hand (the lead's verify; the model and the
  checkpoint's live data stand in).
- `calle-24` stays a two-way sidewalk spot in the live walk (24th Street's kerb lane is traffic); the lead's standard
  (BOXED / UNREACHABLE) passes.
- The shop tiles are still drawn (lane V's H5-1 painted tiles not delivered); BAYBAY's `pageSounds` line has no clip yet.
- Not tried on a real iPhone (the lead's verify).

### Requests

- **Lane F**: the live walker could close the goals step when it opens (after 8 neighbourhoods the modal held the
  player: 0 u in every direction).
- **Lane L**: the Aquatic Park municipal pier and the Wave Organ jetty's far half are not reached by `findPath` from the
  walking graph (lane A's `view:wave-organ` moved for the same reason); if they should be walkable, a graph edge out
  along each would let the coins go back.
- **Lane V**: a voice clip for `e-pageSounds` (城市之声都听全啦！送你一个城市之声相框。); the shop item ids are frozen
  (append-only, `economy/items.ts`, 31 items: 26 for sale + 4 earned + 1 hidden) for H5-1.
- **Lane A**: toys for the ladder when they exist (lent free the first time, then 15–25 on a 玩具 shelf).
- **Lead**: nothing frozen needs changing; `npx` resolved everywhere. The dev server on 5507 is stopped.

## Review

Adversarial review of lane E's wave-5 work (W5-E1 … E10, parts a–c), written 2026-09-28 (PDT) in the lane's worktree
after rebasing on `origin/opus-bay`. Read: every W5-E commit, every file under `economy/`, `scripts/opus-sf/{coins-place,
economy-run}.mts` where the claims rest on them, the six test files, plan §1, §2 (MF5), §3.4, §3.5, §4.1–4.3, §4.10, §6
(D2–D4, D21), the lead note, the owner's feedback, and the other lanes' code that feeds the ledger (lane C's
`game/rewards.ts`, lane A's first flight and view spots, lane D's registries, lane R's souvenirs and daily three).

### 给主人的摘要

1. 金币、小铺、手帐整体可靠：每个奖励只发一次、余额不会变负、重置进度会清零；我在电脑和手机（390×844）上实际捡了金币、试戴并买了围巾、用飞行券飞到恶魔岛码头、打开手帐，都正常；默认的街区模式完全没变。
2. 修了 8 个问题：手机上开着小铺时点右上角，旅行本会被压在小铺下面、人还被定住（现在打开旅行本、地图或拍照会先关小铺）；手帐页头的日落有时比天文台和 BAYBAY 说的早 1 分钟；飞行券目的地少了恶魔岛（现在 16 个都在）；重置进度后 BAYBAY 的第一张飞行券要刷新才给；手机上小铺货架和手帐页签按钮太小；还有金币每帧的小垃圾、暂停时还能捡金币、罗盘箭头会绕一整圈。
3. 重新上网核对了 11 条事实（国际橘、市花大丽花 1926 年、9 月 28 日日落 18:57、9 月 26 日满月、农夫市集时间等），只有万圣节那天的日落显示差 1 分钟，已修。

### What I did in the real game

Dev 5507, headless Chrome `--force_high_performance_gpu --lang=zh-CN`, `?start=free&world=city&time=golden&save=off`;
PERF-LOCK respected (I waited for lane V's 20:34Z gate to end at 21:30Z); every image read.

- **Desktop 1440 × 900**: at the Filbert Steps the trail is ONE InstancedMesh `ob-coins` (16 instances, 768 triangles:
  +1 call, 0.8k tris, inside §3.4's budget); four coins walked → pill `🪙4`, `coinWorld.stats.picked` 4. The shop: the
  Karl-grey scarf tried on BAYBAY and bought (400 → 340, worn), the helpers shelf, 用飞行券 → the picker, now with
  恶魔岛渡轮码头 · 33 号码头 (15 rows at Filbert: Coit is within 60 u). **A ticket flight to the Alcatraz landing**: in the air
  `move = travel` and the ticket used; landed at (−98, −21) under the Pier 33 canopy with no lock held, 用望远镜看恶魔岛
  offered, and W walked 3 u at once (`review-ticket-alcatraz-landing-desktop.jpg`). The 手帐: 旧金山 9月28日 周一 · 日落 18:57 ·
  今晚约是亏凸月 / 明天可能不一样; pages 印章 0/22 · 小发现 1/33 · 看风景 0/16 · 城市之声 0/12 · 足迹.
- **Settings → 重置游戏进度 → 确定**, played: coins 123 → 0 and BAYBAY's 飞行券 held again at once (before the fix it waited
  for a reload).
- **Phone 390 × 844 dpr 3, quality mid**: the pill `目标 0/10 · 🪙 3`; the shop sheet (shelf chips now 44 px high, 买下 44 px,
  tiles 86 × 113). **The defect**: tapping the pill with the shop open put the Journal *under* the shop's sheet, the feet
  still held (`review-before-shop-under-journal-phone.jpg`); after the fix the same tap closes the shop, the Journal shows,
  no lock is held (`review-after-pill-closes-shop-phone.jpg`). The ticket picker; the 手帐 with its five page tabs
  66 × 44 px (`review-notebook-header-phone.jpg`).
- **District mode** (`?start=free`, no `world=city`): no `__opusBay.e`, no coin badge, no 小铺, no economy CSS rule loaded; the
  pill reads 明信片 0/8 · 目标 0/5 as before.
- No fps numbers (lane V / the lead). Programs read 58–61 at load and rose with the lead's late warm-up passes whatever the
  coins did (the lane's `e-coins` pass 44 → 44 stands).

### Defects found and fixed (commits `b1749cb`, `70187aa`)

| # | where | what was wrong | now | test |
|---|---|---|---|---|
| 1 | `economy/Shop.tsx` | a panel or photo mode opened over the 小铺 (phone: the pill → the Journal; the map; settings; J / M on desktop) stacked under or beside it, the feet still held by `holdLock('shop')` | the shop and the 飞行券 picker close when a panel or photo mode takes over (openShop already closed panels first: one sheet at a time) | `w5-e-review-dom` 7, 7b (jsdom); played on the phone |
| 2 | `economy/today.ts` | the 手帐 header truncated the sunset (`bayHm`): a minute early on about half the days, e.g. 2026-10-31 18:11 while USNO and BAYBAY's own sunset line say 18:12 (lane R's review asked for it); 今晚约是… used the hour the page was opened | `sunHm` (rounded; equal to BAYBAY's line on every day for half a year); the moon at today's sunset | `w5-e-review` 1 |
| 3 | `economy/shopRun.ts`, `Shop.tsx` | the ticket picker dropped Alcatraz (`!offWalk`) though `tripDestination` gives its Pier 33 landing: "the 16 must-sees" were 15 | all 16 (`ticketDestinations`); flown to in the game | `w5-e-review` 3 |
| 4 | `economy/shopRun.ts` | after Settings → reset progress, BAYBAY's first 飞行券 waited for the next page load | the ticket rule also runs after a reset (and on the glide change the reset makes) | `w5-e-review` 4; played |
| 5 | `economy/economy.css` | the shop's shelf chips (36 px) and the 手帐's page tabs (40 px) were under the game's 44 px touch rule | 44 px on `pointer: coarse` | measured in the phone run |
| 6 | `economy/coins.ts` | the 30 Hz pickup step allocated every time (an array, a picker object, a Bay-date object, bucket-key strings); coins were picked up while the game was paused (settings open); photo mode was excluded only by accident of `move.mode` | nothing allocated when nothing is picked (numeric bucket keys, one picker object, the day looked at once a second, a keyed sort for the ≤ 5 Hz draw list); paused and photo mode pick nothing | `w5-e-review` 2 |
| 7 | `economy/notebookRun.ts` | each ledger change queued its own full notebook check (a ring flown through = 8 checks in one frame); a check queued just before a teardown ran after it | one check per burst; none after the off | `w5-e-review` 5 |
| 8 | `economy/CompassBadge.tsx`, `compass.ts` | the arrow's CSS transition spun a full turn whenever the target crossed behind you (atan2 jumps by 2π); the pill re-rendered 4 × a second with nothing changed | turns the short way (`nearestTurn`); no re-render when nothing changed | `w5-e-review` 6 |

Also: `items.ts`' shelf comments still carried part b's prices (40 / 80 / 30 / 60 / 30); they now say the locked W5-E8 ones.

### Checked and sound

- **The ledger** (`ledger.ts`): every well-formed source is paid at most once — fixed sources in `play.g.coin` (200: all 158
  arrivals, the goals and favours; nothing missing on today's data), registered kinds in their bitsets, trails in `play.t`
  (a new Bay day only), dailies in `play.d` (never a past date), the rest in `play.e` (never when full); coins are capped
  per prefix, whole, ≥ 0, ≤ 999,999; `spend` / `commitPlay` never go below 0 (`buy` re-checks inside the write). Lane C
  emits on the live first-time event only; lane A's `ring:first-flight:<n>` sits in ring slot 0 and is flown once per save.
  `?date=` is DEV / QA only (no farming trails or the daily three in production).
- **Save**: `play` stays small (≈ 60 bytes of trail bits, 16 × 8 ring bits, 31 item bits) and round-trips; stamps persist in
  `play.g.stamp`, so a trimmed `arrivals` never un-stamps; Settings → reset clears it and every subscriber hears.
- **Budgets**: +1 call and ≤ 1.5k tris for the coins (768 at the Filbert gate spot); a worn hat +1 call, ≤ 342 tris on the
  TOY_DYN program; warm-ups `e-coins` (from initCoins, before the layer mounts) and `e-hats`; each material instance used by
  one object kind; nothing of lane E in GameRoot (the P7 walk in the suite).
- **Teardown**: every timer, subscription, registration, hint source, flag source, pill badge, overlay and look is undone
  (the looks go back to the defaults); the hat and coin geometries and materials are kept for the page on purpose.
- **Nothing sells speed, access or places**: the 飞行券 is the plan's one flight before the pelican (D2); the conveniences
  only point (the lane's grep test). No real money, loot boxes or streaks (records show today only).
- **zh**: E's 12 BAYBAY lines ≤ 45 characters, the glossary words (金币, 小铺, 手帐, 飞行券 …), Karl as VOICE.md writes it.
- **Prices**: the scripted hour gives 5.2 cosmetics at the average price (plan MF5: 3–5; D21: about one per 15 min) — at
  the edge; the run leaves favours, activities, souvenirs and pages out, so a real hour gives a little more (see Open).

### Facts re-checked on the web (2026-09-28)

| fact in the game | source | result |
|---|---|---|
| the Golden Gate Bridge's colour is (Golden Gate Bridge) International Orange — the 国际橘 notes | https://www.goldengate.org/bridge/history-research/bridge-features/color-art-deco-styling/ | correct |
| the dahlia became San Francisco's official flower in 1926 (Board of Supervisors) — the 大丽花粉 note | https://www.dahliadell.org/history | correct |
| sunset in SF on 2026-09-28 is 18:57 (the 手帐 header) | https://aa.usno.navy.mil/api/rstt/oneday?date=2026-09-28&coords=37.7749,-122.4194&tz=-7 | correct |
| sunset on 2026-10-31 is 18:12 | the same USNO API for 2026-10-31 | the header said **18:11** (truncated): fixed |
| the moon on 2026-09-28 is waning gibbous (亏凸月); full moon 2026-09-26 09:49 PDT | USNO rstt/oneday (curphase, closestphase); https://www.almanac.com/content/full-moon-september | correct |
| Ferry Plaza Farmers Market Tue & Thu 10–2, Sat 8–2 (the stall says 逛逛小铺 only outside these hours) | https://foodwise.org/markets/ferry-plaza-farmers-market/ | correct |
| the Alcatraz ferry leaves from Pier 33, Alcatraz Landing (the island stamp, the ticket's 16th destination) | https://alcatrazcitycruises.com/plan-your-visit/directions | correct |
| the Powell cable cars are painted maroon (缆车栗红) | https://www.streetcar.org/seeing_red_again_on_powell_str/ | correct |
| San Francisco's fog is nicknamed Karl (和 Karl 一个颜色) | https://www.kqed.org/news/11682057/how-the-bay-areas-fog-came-to-be-named-karl | correct |
| the Filbert Steps climb Telegraph Hill from Sansome St to Coit Tower (the first coin trail) | https://en.wikipedia.org/wiki/Filbert_Street_(San_Francisco) | correct |
| the Wave Organ is on the jetty at the end of Yacht Road (the trail re-laid along Yacht Road) | https://www.exploratorium.edu/visit/wave-organ | correct |

### Open (not fixed here)

- **Lead / lane C**: a `reward` emitted before the economy chunk's ledger listener is live is not paid, and lane C pays only
  on the live first-time event — e.g. an arrival moment in the first second of a resumed session if lane C's
  `cityMoments` chunk lands before `economy/index` (both lazy, loaded in parallel by `initCityContent`). Rare; the fix is
  ordering (the moments after `initW5Features().ready`) or the emitter re-checking `isPaid` later. Not changed: C's file
  and C's rule ("a goal done in an old save is never paid on load").
- **Lead (W5-Z)**: prices — if the live hour buys more than 5 cosmetics, raise the scarves and frames a notch (70 → 80,
  60 → 70); the scripted run is a floor.
- **Lead (audio/hooks is frozen)**: the ring's eight coins are picked in one step, so their eight chimes ring together (a
  chord, not the climbing ladder the report describes); a stagger needs `playSound` with a delay. Not listened to (headless).
- **Lane N + E** (lane L's review): if N wires Haight & Ashbury's site arrival at the open spot 0.35 u from the old one,
  the `stop-haight` trail's first coin (within 4 u of it) moves with `coins-place.mts --replace stop-haight` (the rule keeps
  every coin 4 u from trip ends); nothing to do until N moves it.
- The toys shelf (needs lane A's toys), H5-1 painted tiles and E's voice clips: as the lane reported.

### Checks

`npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (the 43 old warnings, none in `economy/`) ·
`npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1331 / 1331**, fail 0, on the pushed head `b9b40eb` (after lane N's review; 1326 / 1326 before it)
(rebased on `88056a7`, after lane A's W5-A9 and lane L's review; 1316 / 1316 on `cb9e653`; one run before it had the known wall-clock flake `sf-nav` "local A* window", which passed alone
and in the next full run; 1314 / 1314 on `b1749cb`). New: `tests/opus-bay-w5-e-review.test.ts` (6) and
`tests/opus-bay-w5-e-review-dom.test.ts` (2, jsdom). `npx` resolved normally. The dev server on 5507 is stopped and no
Chrome of mine is running.
