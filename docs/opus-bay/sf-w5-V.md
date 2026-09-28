# Wave 5 · lane V · Visuals, performance, voice & assets

Worktree `C:/Users/willy/wt/w5-v` (branch `w5-v`), dev port 5506; a pinned gate tree `C:/Users/willy/wt/w5-v-gate`
(detached, dev port 5516, see Decisions) ; scratch `C:/Users/willy/opus-qa/w5/w5-v/`. Plan `sf-w5-plan.md` §2 MF9,
§3.6, §4.3, §4.9, §4.14, §6 (D15, D16, D20); lead note `sf-w5-lead.md` (§5 the hooks, §6 the baseline).

## Part a

### 给主人的摘要

1. **开工底数已测**：第五波第 0 天的版本上，电脑版 18 个测点 + 3 段乘车全部 60 帧、没有超过 100 毫秒的卡顿；市中心余量很小（渡轮大厦门口只剩约 3k 三角形、唐人街 24 次绘制）。手机模拟这次作废（十条线同时在跑，机器满载），三角形和绘制数有效，帧数以总负责人的安静复测为准。
2. **市中心"减负"已上线**：城市模式下，渡轮大厦一带的 6 位老区居民在你离开 250 米后隐藏；老区手工街区每 150 格一块，远处换成"远景版"——房子一模一样，只去掉长椅、路灯、栏杆、锁链这些远处看不清的小东西，棕榈树和树换成简化版。前后对比图肉眼几乎看不出差别。唐人街 393k → 334k，双峰顶 378k → 311k，渡轮大厦门口 397k → 384k。
3. **给其他线的工具已推**：新材质"提前编译"的做法和示例（金币、飞行圈、彩蛋、活动布景都已照做，没有新增卡顿）；地图旗子图标扩到 512（新增金币、日历、闪光、音乐，最多能放 64 个）；街角招牌图集（22 块中文/英文/西语手绘招牌，白天受光、晚上微亮，给 L 线的街角用）。
4. **首屏包**：GameRoot 现在约 301 KB（第五波各线加了约 7 KB），我先挪走 2.4 KB；最大的一块"城市数据"约 28 KB 要改 C 线和 N 线的文件，方案已写好，请总负责人安排时间一起挪。
5. **一个失误**：我扩旗子图集时着色器变量重名，城里的旗子有约 1 小时没显示；总负责人已修好，测试现在会拦住这类错误。
6. 这部分没有用 Higgsfield（0 分）。

### What was built

| task | commit(s) | files |
|---|---|---|
| **W5-V1** the wave-5 gate table + the baseline on the day-0 head | `eed45b4`, `9225571` (FiDi spot) | `scripts/opus-sf/qa/perf/{w5-spots.json,w4-perf.mjs}` |
| **W5-V6** the warm-up recipe (the hook) | `1f7629b` | `src/opus-bay/world/warmup.ts` |
| **W5-V4** flag glyphs 256² → 512² | `e276fe0` (+ the lead's fix `4fb3e6e`) | `src/opus-bay/world/sf/{flags,flagGlyphs}.ts`, `src/opus-bay/game/flags.ts` (FLAG_GLYPHS, append), `scripts/opus-sf/flag-glyphs.mjs` |
| **W5-V2** levers: the waterfront residents far away, the label atlas guard | `7ade613` | `src/opus-bay/actors/npcs.ts`, `src/opus-bay/world/labels.ts` |
| **W5-V2** the hero district's far detail, tile by tile | `7dad6a7`, `6112ba9`, `490022f` | `src/opus-bay/world/{builder,world,props}.ts`, `src/opus-bay/world/sf/{farHero,stream,cityWorld,cityMode,stats}.ts` |
| **W5-V3** bundle: the warm-up dummies off the city recipes; the P7 guard | `c9c9815`, `9225571` | `src/opus-bay/world/warmup.ts`, `tests/opus-bay-sf-budget.test.ts` |
| **W5-V4** the signs atlas | `cf3dd82` | `src/opus-bay/world/sf/signsAtlas.ts` |
| tests | in the commits above | `tests/opus-bay-w5-perf.test.ts` (new, 9 tests), `tests/opus-bay-sf-budget.test.ts` (P7) |

**The warm-up recipe (W5-V6, the hook other lanes wait for)** — the full text is at the top of `world/warmup.ts`:

1. one material instance per object kind, made once in your own lazy module, never shared with another kind;
2. the warm-up object built exactly like the real one (same material instance, object type, castShadow / receiveShadow,
   instanceColor or not, defines / program key, morph / skin / uv sets) — the helpers do it from the real material:
3. register from your feature's `init()` (after the boot warm-up: compiled in a late pass ≈ 30 ms later, again at every
   quality change and in the next-level pass); keep the unregister for your teardown;
4. check: `window.__opusWarmLate` lists the late pass; walking there must not raise `renderer.info.programs.length`.

```ts
// world/warmup.ts (new)
export interface WarmupObjectOpts { geometry?: THREE.BufferGeometry; castShadow?: boolean; receiveShadow?: boolean; instanceColor?: boolean }
export function instancedWarmup(material: THREE.Material, opts?: WarmupObjectOpts): WarmupSet;   // one InstancedMesh, capacity 1
export function meshWarmup(material: THREE.Material, opts?: Omit<WarmupObjectOpts, 'instanceColor'>): WarmupSet;
// example (lane E did exactly this, b80ae63): registerWarmup('e-coins', () => instancedWarmup(COIN_MAT, { geometry: coinGeo(), receiveShadow: true }))
```

Registrations checked as the materials landed: E's coins (`e-coins`, instancedWarmup), A's first-flight rings
(`a-play-rings`, the real mesh at capacity 1), D's egg props + flock (`eggs`, the real kinds and flags, no instance colour
on either side), R's event kits (`r-event-kit`, meshWarmup with receiveShadow true — a TOY_DYN-keyed plain Mesh that
receives shadows is its own variant: registered), V's signs (`v-signs`). The gate's programs stayed 58 → 58.

**Flag glyphs (W5-V4)**: `ATLAS = { size: 512, cells: 8, block: 4, cell: 64, … }`; cells go in 4 × 4 blocks, so cells
0–15 keep the wave-4 pixels in the top-left quadrant and 16–63 fill the other three. `FLAG_GLYPHS` appends `Coins`,
`CalendarDays`, `Sparkles`, `Music` (cells 16–19; append only: the index is the cell). New helper
`atlasCellColRow(cell)`; the fragment shader mirrors it (the test evaluates the shader's formula for all 64 cells).
Lane N already uses them (`e4c17c0`).

**The signs atlas (W5-V4, for lane L's corners)** — `world/sf/signsAtlas.ts`, city chunk:

```ts
export const SIGNS: readonly SignSpec[];     // 22 plaques, append only: bakery, dim-sum, books, flowers, coffee, grocery, produce, tea,
                                             // noodles, hardware, taqueria, panaderia, mercado, cafe, books-en, records, vintage, barber,
                                             // market, deli, soul-food, laundry
export const SIGN_ATLAS = { size: 1024, cols: 4, rows: 8, cellW: 256, cellH: 128, margin: 6 };
export function signRect(id: string): { u0; v0; u1; v1 } | null;      // the plaque's uvs (2 : 1)
export class SignBatch { plaque(id, x, y, z, ry, w): boolean; build(): THREE.BufferGeometry }   // quads like LabelBatch
export function signsMaterial(): THREE.MeshStandardMaterial;          // one instance for every sign mesh; lit by day, glows × uNight at night
// warmed as 'v-signs' (a plain Mesh, receiveShadow true, castShadow false): build the corner's sign mesh that way
```

Generic trade words only (面包 Bakery, 点心 Dim Sum, 书店 Books, 花店 Flowers, 咖啡 Coffee, 杂货 Grocery, 蔬果 Produce, 茶
Tea, 面馆 Noodles, 五金 Hardware, 洗衣 Laundry; Taquería, Panadería, Mercado on 24th St; Café, Books, Records, Vintage,
Barber, Market, Deli, Soul Food): never a brand, a shop's name or a logo (the test holds the whole vocabulary). Seven
painted looks (enamel, lacquer, wood, teal, blue, mustard, rose), the page's own fonts (Noto Sans SC, Plus Jakarta Sans;
the system CJK fonts as fallback). One mesh per corner = one draw call for all its signs.

**The waterfront residents (W5-V2)**: `DISTRICT_NPC_HIDE = 250`, `DISTRICT_NPC_SHOW = 235` (actors/npcs.ts): in city mode
the six residents of `NPC_DEFS` hide beyond 250 u of the player (no update, obstacle, blob, draw or shadow); the city
residents keep their own rule; district mode never hides them. `Npc` takes the world mode as a second constructor
argument (default: the store's).

**The label atlas guard (W5-V2)**: the bottom `LABEL_RESERVE = 8` px stay free; a label that does not fit maps to a blank
strip of the base colour, is counted in `atlas.overflow` (DEV warning once); `atlas.used` reports the height taken
(district: 75.8 %, 0 overflow). Fitting labels are allocated exactly as before (the hero regression is unchanged).

**The hero's far detail (W5-V2)** — `world/sf/farHero.ts` (city chunk) and `stream.ts`:

- The hand-made district's toy geometry (≈ 122k triangles) was measured by builder: lots, sheds and facades **16.6k**;
  palms 21.1k; seawall curbs, bollards and chains 18.8k; pier pilings and railings 17.4k; garden bushes 7.3k; F-line wires
  5.5k; lamps 5k; trees 7k; benches, bins, signs … the rest. So a "stand-in for the buildings" would save little: the far
  chunk keeps **the same buildings triangle for triangle** (buildCity) and drops the street furniture; palms become six
  one-segment fronds on the same trunk and crown colours, trees one crown, bushes one blob, at the same spots (the gardens
  now list their plantings first: `props.ts gardenPlantings()`, district bytes unchanged). ≈ 24k for the whole district.
- `splitGeometryCells` (builder.ts) splits the near and far toy geometry on the same 150 u grid; `pairHeroTiles` pairs
  them (7 tiles have both). World (city mode only) adds the far chunks hidden, named `city-far#i`.
- The streamer (`hero.tiles`) shows a tile's far chunk while the focus is beyond `HERO_TILE_FAR` (high **135**, mid 125,
  low 115 u; 20 u hysteresis; re-run after 4 u of focus travel or a quality change), with the C2-10 dither cross-fade
  (TIER_FADE 0.3 s); the whole hero far keeps the L1 boxes as before; dispose restores the near chunks. `stats().heroTiles
  = { far, of }`; `?debug` shows `hero tiles far n/7`; the breakdown groups the far chunks as `hero.buildings.far`.
- 135 u on high: the streamed city near the hero already drops a quality step (L0 → L1 at 105–145 u on high), so a tile
  keeps its full detail at least as far out as the city around it; the camera trails the focus by ≈ 30 u.

**Bundle (W5-V3)**: the warm-up's dummies are plain `Batch` geometry (same program keys: position / normal / 3-component
colour / aInfo, no uv; storage formats are not part of a key), so `world/recipes/city.ts` and `world/typedBatch.ts` left
the GameRoot graph (−2.4 KB gzip of parts). The P7 test (`opus-bay-sf-budget`) now also fails on any module of
`economy/ play/ eggs/ realsf/` or on those two files in the main graph.

**The gate (W5-V1)**: `scripts/opus-sf/qa/perf/w5-spots.json` = the 13 wave-4 spots (same coordinates and facings) + the
GGB deck, Hellman Hollow (R's kit), Marina Green (jets), Castro (fair day), the Filbert Steps (coin trail), the Financial
District (Montgomery & California) and Irving St at night (`time: night`); the three rides. `w4-perf.mjs --file
w5-spots.json`; a timed spot runs only with its `--time`; each measure records the per-group breakdown (`bd`: the ten
biggest groups of the main and the shadow pass). Venue points projected from lat / lng with `core/geo projectCity`
(Hellman Hollow 37.7697, −122.4867 and Marina Green 37.8057, −122.4382 from the real-world scout's venue list; Castro & Market
37.7625, −122.4351; Montgomery & California 37.7929, −122.4027 — street corners, no facts shown to players).

### Evidence

**Baseline on the day-0 head** (`1965e3c`, the pinned gate tree; desktop 1440 × 900, quality high, RTX 3070 laptop with
`--force_high_performance_gpu`, Chrome headless, golden, 2026-09-28 09:28 UTC). The machine was busy (other lanes' suites
and Chromes, CPU 60–100 %): desktop fps are indicative (60 everywhere on the RTX); calls and triangles do not depend on
load. Max over the standing, aimed, idle and walking measures (rides: the max over the path).

| spot / ride | calls · triangles | headroom (150 · 400k) | fps idle / walk (ride) | phone 390 × 844 mid: calls · triangles |
|---|---|---|---|---|
| ferry-gate | 101 · 397k | 49 · **3k** | 60.1 / 60.1 | 82 · 319k |
| chinatown | 126 · 393k | **24** · 7k | 59.9 / 60.1 | 101 · 315k |
| twin-peaks | 121 · 378k | 29 · 22k | 60.1 / 60.1 | 93 · 258k |
| civic-center | 84 · 326k | 66 · 74k | 60.1 / 60.1 | — |
| union-square | 85 · 285k | 65 · 115k | 60.1 / 60.1 | 70 · 229k |
| music-concourse | 88 · 249k | 62 · 151k | 60.1 / 60.1 | — |
| stonestown-sfsu | 71 · 202k | 79 · 198k | 60.1 / 60.1 | — |
| haight-usf | 93 · 286k | 57 · 114k | 60.1 / 60.1 | — |
| ocean-beach | 47 · 106k | 103 · 294k | 59.9 / 60.1 | — |
| ggb-south | 52 · 111k | 98 · 289k | 60.1 / 60.1 | — |
| mission | 80 · 325k | 70 · 75k | 60.1 / 60.1 | — |
| grace-nob-hill | 111 · 396k | 39 · **4k** | 60.1 / 60.1 | 95 · 360k |
| powell-market | 108 · 396k | 42 · **4k** | 60.1 / 60.1 | 91 · 326k |
| ggb-deck (new) | 59 · 207k | 91 · 193k | 60.1 / 60.1 | — |
| hellman-hollow (new) | 67 · 222k | 83 · 178k | 60.1 / 60.1 | — |
| marina-green (new) | 77 · 198k | 73 · 202k | 60.1 / 60.1 | — |
| castro (new) | 67 · 304k | 83 · 96k | 60.1 / 60.1 | — |
| filbert-steps (new) | 89 · 332k | 61 · 68k | 60.1 / 60.1 | — |
| ride bus-palace | 103 · 421k (one frame; 265k on the next run) | — | (60) | — |
| ride n-duboce | 84 · 324k | 66 · 76k | (60.1) | — |
| ride m-west-portal | 84 · 309k | 66 · 91k | (60.1) | — |

Programs 58 → 58 (desktop), 55 → 55 (phone); 0 frames over 100 ms on the desktop. The phone subset (390 × 844, dpr 3,
mid, 4× CPU) ran at 09:35 UTC with the host at 100 %: fps 9–36, **void** (calls and triangles match the lead's W4-Z
quiet run within 2k); the phone fps gate stays the lead's quiet-machine run. The first desktop run (09:09) was voided
too: it ran on my own dev server while I edited files, and Vite's hot updates re-ran modules mid-run (programs 58 → 54,
the player sent back to the Ferry gate at Ocean Beach, a reload at the end); every gate since runs on the pinned tree.

Where the triangles go (day-0, the biggest groups): the Ferry gate — hero buildings 81k, hero ground 47k, **T's life 47k**,
city pools 74k, actors 35k + 24k shadow; Chinatown — hero buildings **97k**, hero ground 47k, actors 38k, life 37k; Twin
Peaks — city L0 78k, **actors 64k (23 calls: the six waterfront residents 930 u away were 33k of it)**.

**After the levers** (the pushed head `9225571`, same setup, 12:03 UTC; the downtown subset):

| spot | day-0 | now | headroom now (calls · triangles) | note |
|---|---|---|---|---|
| ferry-gate | 101 · 397k | 104 · 384k | 46 · 16k | hero buildings 81k → 50k (walking toward downtown: 401k at 155 u, `490022f` took Telegraph Hill's tiles out) |
| chinatown | 126 · 393k | 125 · 334k | 25 · **66k** | hero buildings 97k → 39k near + far; actors 38k → 28k |
| twin-peaks | 121 · 378k | 107 · 311k | 43 · 89k | actors 23 → 15 calls, 64k → 33k |
| union-square | 85 · 285k | 85 · 338k | 65 · 62k | this run's walking camera looked 172° away (the aimed view counts): not the same view as day-0 |
| grace-nob-hill | 111 · 396k | 96 · 325k | 54 · 75k | |
| powell-market | 108 · 396k | 123 · 371k | 27 · 29k | aimed view (39° off); 7 far chunks in view (25k) |
| fidi (new) | — | 88 · 291k | 62 · 109k | |
| filbert-steps | 89 · 332k | 91 · 280k | 59 · 120k | |

Programs 58 → 58, 0 frames over 100 ms, fps 60. The same spot measured twice varies by 10–25k (which way the camera looks
after the arrival, the streaming state, crowds): read the headroom with a 15k margin.

**The downtown headroom (plan MF9 / D15), published**: after the levers, new things may go downtown within these
allowances at quality high (per view, shadows included): **the Ferry gate ≤ 1 call and ≤ 2k** (still the tightest: T's
life 47k and the actors' 35k + 24k shadow are the next levers there), **Chinatown ≈ 50k**, **Union Square ≈ 45k**,
**Powell & Market ≈ 15k**, **Grace / Nob Hill ≈ 60k**, **the Financial District ≈ 90k**, **North Beach / the Filbert
Steps ≈ 100k**; calls ≥ 25 everywhere but the Ferry gate. Chinatown and North Beach clear the plan's 20k for corners.
D's egg props (`DOWNTOWN_PROPS_HELD`, one pool mesh, a few hundred triangles) and E's downtown coins (one instanced layer,
< 1.6k) fit everywhere, the Ferry gate included.

**What the far detail looks like** (the same QA cameras, before / after; every image read):
`qa/w5/V/v2-far-detail-nob-hill-to-coit-before-after.jpg` (Nob Hill → Coit, 97k → 47k in the district groups),
`v2-far-detail-fidi-high-before-after.jpg` (over the FiDi: 109k → 44k), `v2-far-detail-135u-ferry-to-telegraph-155-vs-135.jpg`
and `v2-far-detail-135u-embarcadero-north-155-vs-135.jpg` (the Ferry at walking height, 155 u vs 135 u: −20k / −35k),
`v2-far-detail-phone-nob-hill-to-coit.jpg` (390 × 844, 6 of 7 tiles far). The skyline, the houses, the palms along the
Embarcadero and the hill's trees read the same; only the street furniture is gone at that distance.

**Flags and signs in the game**: `v4-flag-glyphs-desktop-zoom.jpg` (coin, calendar and sparkle pennants from a registered
source at Union Square, cells 16–18 drawn), `v4-flag-glyph-phone.jpg` (the calendar pennant, 390 × 844); `v4-signs-atlas.jpg`
(the 22 plaques as painted in Chrome with the page's fonts); `v4-signs-in-scene-day-night.jpg` (four plaques at the Ferry
gate: lit and shadowed by day, glowing at night; `ob-signs` had linked in the late pass before the mesh drew: 59 → 59).

**Bundle** (`vite build --sourcemap` of each tree, gzip -9 of the chunk):

| tree | GameRoot gzip | note |
|---|---|---|
| day-0 `1965e3c` | 294,434 B | the wave-4 end measured 292,396 B (capacity scout); the day-0 glue is the difference |
| head `cf3dd82` | 301,053 B | +6.6 KB in wave 5 so far, V's −2.4 KB included |

The wave-5 growth by file (gzip of parts): F `actors/charImpl.ts` +1,955, `recolor.ts` +567, `faceOpen.ts` +486,
`anim.ts` +606, `system.ts` +670, `glide.ts` +430, `vehicles/models.ts` +550, `models.ts` +244; C `game/flow.ts` +755,
`rewards.ts` +326, `welcome.ts` +213, `photoFrames.ts` +128; the day-0 glue (`audio/hooks.ts` 553, `w5Features`, `slots`,
`playerLock` ≈ 280); N `fastTravel.ts` +240; T `transit.ts` +206; V −2,390 (recipes/city, typedBatch) +370 (labels, world,
props, npcs, warmup). The city data still in GameRoot: `data/sf/landmarks.ts` 16.7 KB, `postcards` 3.6, `cityPois` 3.1,
`places` 2.4, `residents` 2.3, `goals` 1.8, `arrivals` 0.6 (≈ 27.7 KB real).

**Checks** (the last push `9225571` after its rebase): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .`
0 errors (43 old warnings) · the full suite on the tree before the last rebase 1,102 / 1,102; after the rebase (lane F's
commits only) tsc 0, eslint 0 errors and the affected tests (w5-char, w5-feet, contracts, w5-perf, sf-budget, actors,
sf-hud) 83 / 83. The earlier pushes: 948 / 948, 1,077 / 1,077; one run had the known wall-clock flake (sf-move2 "E2-5 …
a cached cell is cheap") that passed alone. Hero regression and contracts green throughout (the district World is byte
for byte unchanged: the far detail, the tile split and the residents' rule are city-mode only).

### Decisions

- **The far "stand-in" keeps the buildings.** The plan named a stand-in for the hand-made buildings (81–97k at
  Chinatown); measured, the buildings are 16.6k of the district's 122k and the rest is street furniture and planting, so
  the far chunk keeps every building triangle and simplifies the rest. No L1 boxes at 135 u (they would be visibly
  different at walking height); the existing L1 proxy still takes over beyond 300 u of the slab.
- **Tiles, not lots.** The near and far chunks split on the same 150 u grid by triangle centroid, so a building's
  triangles fall in the same tile in both (they are the same triangles); a palm on a tile edge can split across two tiles
  (a frond at ≥ 135 u, never seen). The cross-fade is the city's own (C2-10); a tile with no far content (furniture
  only) never swaps.
- **135 / 125 / 115 u** (high / mid / low) from the focus: the city's own L0 → L1 distance near the hero; 155 left the
  Ferry gate at 401k while walking toward downtown.
- **Flag atlas in blocks** of 4 × 4 so lane N's wave-4 test (cell 5 at 72, 72) and the wave-4 pixels stay; FLAG_GLYPHS
  (N's file) got one appended line, the generator its list (the plan: "the flag glyph set (N + V)").
- **Signs painted in canvas**, not by an image model (plan §3.6): real fonts, generic words, seven looks. No Higgsfield
  plaque texture yet (H5-5 is optional; the painted boards read well in the scene).
- **A pinned gate tree** (`C:/Users/willy/wt/w5-v-gate`, detached at the measured commit, its own dev server on **5516**,
  a port no lane uses): editing the lane's worktree while its own server served a gate voided the first run (Vite's hot
  updates). The node_modules junction was made with `mklink /J` (drop it with `cmd //c rmdir` first).
- **The residents' rule reads the world mode in the constructor** (the ActorSystem, lane F's file, calls `new Npc(def)`
  unchanged; lane C's test pins `npcDefsFor('city')` unchanged).

### Known gaps

- The phone fps gate on the day-0 head is void (host at 100 %); the lead's quiet runs (W4-Z, W5-Z) stay the phone numbers.
- The Ferry gate keeps ≈ 16k of headroom at best (T's life 47k, the actors' 35k + 24k shadow are there).
- Run-to-run variance of a spot is 10–25k (camera direction after the arrival, streaming, crowds); the gate takes the
  max of four measures, so a view that looks away can hide a heavy one (Union Square this time).
- The far chunks add ≈ 24k triangles of geometry memory in city mode and 47–60 ms to the city World's build (measured in
  Chrome: the World builds in 955 ms, far chunks included; buildCity runs twice), once at boot behind the title.
- The flag glyphs read soft on desktop at quality high (the tilt-shift blur at 80–100 u); crisp on the phone (mid).

### Not done (part a)

- **W5-V3, the city data out of GameRoot (≈ 27.7 KB)**: the importers are lane C's and N's files (`data/pois.ts`,
  `data/postcards.ts`, `game/{cityContent,cityGoals,flow}.ts`, `ui/{PoiCard,Moments}.tsx`, `data/script.ts`,
  `game/{resume,discovery}.ts`) and lane L's `data/sf/landmarks.ts`, all being edited today; the move needs a window
  (Requests). GameRoot is 301 KB against 265 at W5-Z.
- W5-V5 (nights), V7 (voice), V8 (Higgsfield), V9 (the header check), V10 (shoulds): later parts, as planned.

### Requests

- **Lead — the city-data move (W5-V3)**: please schedule a window after build 1 (e.g. Fri Oct 2 morning) in which lanes
  C and N push first and lane V then moves the city data in one commit: a lazy barrel `data/sf/cityDataChunk.ts`
  (landmarks, cityPois, the SF postcards; residents / goals / places next) loaded with the city chunk
  (`world/cityLoader.ts loadCity` awaits both; `suspendForCity` already holds the World for it), read in the main graph
  through a tiny `data/cityData.ts` (`cityData(): CityData | null`), and the importers above switched to it (district
  mode never loads it). ≈ −23 KB for the first three files. Lane V does the edits in C's and N's files only with their OK.
- **Lead**: flip D's `DOWNTOWN_PROPS_HELD` and E's downtown coin hold — both fit the published headroom (above).
- **Lane F** (optional, bundle): `actors/charImpl.ts` + `recolor.ts` + `faceOpen.ts` (≈ 3 KB gzip) could register from a
  lazy import (`setCharApi` from a chunk loaded in city mode) — the four feature lanes only call `charApi()` from their
  own lazy chunks.
- **Lane T** (optional, the Ferry gate): the hero life (pedestrians, sailboats, gulls: 47k at the Ferry gate) is the
  biggest lever left at the tightest spot.
- **Lane L**: the signs atlas is ready for the corners (API above); the plaque ids are append only — ask for new words
  under Requests (generic trade words only).
- **Every lane with a new material**: the recipe in `world/warmup.ts`; the helpers `instancedWarmup` / `meshWarmup`.

### Checks

- `npx tsc -p tsconfig.app.json --noEmit`: 0 errors.
- `npx eslint .`: 0 errors (43 warnings, none in lane V's files).
- `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts`: 1,102 / 1,102 before the last rebase; after it
  the affected tests 83 / 83 (see Evidence). Lane V's new tests: `opus-bay-w5-perf` (9), `opus-bay-sf-budget` P7 (extended).
- Higgsfield: 0 credits in part a (no job run; the ledger `docs/opus-bay/ledger/w5-V.md` starts with part b's first batch).
