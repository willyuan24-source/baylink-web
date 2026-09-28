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
