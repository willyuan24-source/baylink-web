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
gate: lit and shadowed by day, glowing at night; `ob-signs` had linked in the late pass before the mesh drew: 59 → 59),
`v4-signs-in-scene-phone.jpg` (390 × 844, mid: crisp).

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

## Part b

### 给主人的摘要

1. **外城的夜晚亮了**：除了金融区和 SoMa（那里本来就有地图上的路灯），日落区、列治文区等所有住宅区的街道晚上都立起了路灯，灯下有光圈，住宅街路面也微微发亮；晚上地上的金币会一闪一闪。没有多一次绘制。
2. **BAYBAY 会说第五波的新台词了**：141 句 × 中英文 = 282 条录音（还是 Pixie 的声音），她的气泡说到录过的句子就自动播放，电脑和手机都试过。试听单在 `docs/opus-bay/qa/w5/V/voice/listening.md`（每批一个连播文件）；英文 "Me first! Again?" 语速偏慢，先静音，等你听过再决定。
3. **六张彩蛋明信片画好了**（中国海滩的渔船、电报山的鹦鹉、海浪风琴、Lands End 石头迷宫、大丽花园、金门大桥的雾笛），还要 D 线把它们放进彩蛋卡片，游戏里才看得到。
4. **上线前查出一个真问题**：正式网站现在的安全设置（CSP）会拦住 AI 3D 模型的解码，正式网站上所有 AI 模型都会退回简易版（比如艺术宫）；加两处设置就好，改法和验证工具已交给总负责人（vercel.json 只有总负责人能改）。另外正式网站还没有 /opus-bay 这个地址的路由。
5. **性能**：电脑版 19 个测点、3 段乘车、夜景和活动日全部 60 帧、没有卡顿，最多 117 次绘制 / 35 万三角形（上限 150 / 40 万）。手机（4 倍降速）7 个市中心测点 6 个过关；唐人街走路时有 1 帧超过 100 毫秒——V5 之前的版本也一样，不是这次加的，请总负责人在安静的机器上复查。
6. Higgsfield 这部分共花 **22.90 分**（上限 130），余额 400.07 → 377.17；账本 `docs/opus-bay/ledger/w5-V.md`。

### What was built

| task | commit(s) | files |
|---|---|---|
| **W5-V5** nights: outer-district lamps, the residential glow, coin glints | `da331c9` | `src/opus-bay/world/sf/{look,build,lights}.ts` |
| **W5-V7** voice: the inventory, three recording batches, the binder, the owner's listening sheet | `82bf29b`, `2d8c7de`, `21c6c4d` | `scripts/opus-sf/voice/w5/{lines.ts,post.py}`, `src/opus-bay/data/sf/voiceW5.ts` (generated), `src/opus-bay/game/voiceW5.ts` (new), `src/opus-bay/world/sf/cityWorld.ts` (the lazy start), `public/opus-bay/w5/voice/` (282 × `.m4a` + `.ogg`), `docs/opus-bay/qa/w5/V/voice/` |
| **W5-V8** Higgsfield: the six secret postcards (H5-2) and the voice (H5-3), the ledger | `82bf29b` (ledger rows in every voice commit) | `scripts/opus-sf/assets/w5/{prompts.py,prompts.json,postcards.py}`, `public/opus-bay/w5/postcards/` (12 WebP, 752 KB), `src/opus-bay/data/sf/eggPostcards.ts` (new), `public/opus-bay/README.md`, `docs/opus-bay/ledger/w5-V.md` |
| **W5-V9** the production-header check | `bb7b843` | `scripts/opus-sf/qa/csp-serve.mjs` (new), `scripts/opus-sf/qa/perf/w4-perf.mjs` (`--date`) |
| **W5-V6** the gate after the lane batches; lane R's clock request | `41e3f13` + this report | `src/opus-bay/world/clock.ts` |
| tests | in the commits above | `tests/opus-bay-w5-perf.test.ts`: +9 (V5 × 4, V7 × 3, V8 × 1, the clock × 1; 18 in all) |

**Nights (W5-V5).** Wave 4 lit only the streets with mapped (OSM) lamps, which are almost all downtown; the Sunset, the
Richmond and the other hoods were dark at night.

- `look.ts`: `NIGHT_STREETS` and `litOuterZone(zone)` — every DataSF zone is lit except
  `financial-district-south-beach` and `south-of-market` (their mapped lamps stay as they were). In a lit zone the
  residential streets' ground glow is level **0.35** with the pattern stretched × 0.375 (one warm pool per side every
  24 u); arterials keep wave 4's glow.
- `build.ts outerLamps(ctx)` (chunk worker): lamp posts along the published streets of a lit zone, every **12 u** on
  residential streets and **9 u** on the main ones, on alternate kerbs, off every carriageway (half-width + 0.29 u),
  ≥ 10 u from a mapped lamp, ≥ 1.1 u from a tree, never on the hand-made district; deterministic. They are appended to
  the chunk's props as ordinary lamps, so wave 4's capped lamp layer draws them (the nearest 48 within 120 u, ≈ 24 in
  view, with their halos and pools): **no new draw call, material or program**.
- `lights.ts`: the night light field keeps **16 glint slots** after its lights (the same `THREE.Points` draw); at night
  `coinGlints()` fills them with the nearest coins lane E draws (`economy/coins.ts coinWorld`, imported lazily, so no
  economy code enters the main graph), refreshed ≤ 5 Hz, a small gold star 0.45 u over the coin that twinkles; by day the
  slots are cleared.

**Voice (W5-V7).**

- The inventory (`scripts/opus-sf/voice/w5/lines.ts`) reads the lanes' own sources — A `play/`, C's pelican / goals /
  rumours / welcome, flow's two nudges and the frozen `data/sf/linesW5.ts`, N `goTo`, E `economy/`, D `eggs/` and the
  registry, R's single-text lines — and keeps BAYBAY's spoken sentences only (no labels, templates, other speakers' lines,
  notes or scrolls). A line's id is `w5-<lane>-<sha1 of both texts>`, or the lane's own id (C's `w5c-*`, R's `realsf-*`).
- Recorded with `qwen_audio_tts`, preset **Pixie** (the wave-4 voice), zh and en; post (`post.py`): trim, two-pass loudness
  −18 LUFS / −1.5 dBTP, AAC 64k `.m4a` + Opus 48k `.ogg`; every pick passes the measured gates (no clipping or cut-off,
  pauses and pace normal; a one- or two-word call ≤ 1.5 s); the Windows recogniser's closed-grammar check is advisory.
  A line no source says any more is retired (out of the table, files deleted, kept in the report).
- The table `data/sf/voiceW5.ts`: **141 lines** (A 40, C 11, D 84, N 1, R 5) = **282 clips**, 281 through the gates,
  272 heard right by the recogniser, 21 minutes, 18.2 MB on disk (a player fetches one format of a clip, only when she says
  it). `W5_VOICE_CHECK` = `en-w5-a-2fe95a24` ("Me first! Again?", 1.4 words / s on both takes): text only until the owner
  approves it.
- The binder `game/voiceW5.ts`, started lazily by `world/sf/cityWorld.ts` (city chunk): every new **BAYBAY** bubble whose
  zh + en text is a recorded line emits `voice-line <id>` once (audio.ts plays `<lang>-<id>`, the chirp while it loads).
  No lane had to wire anything; a changed text simply stays text. Residents are never voiced. Lines a lane voices itself
  (`own`: R's `realsf-*` from `realsf/index.ts`, C's 11 paced `w5c-*` lines) are left to that lane — no double play.
- The owner's sheet `docs/opus-bay/qa/w5/V/voice/listening.md`: every clip with its text, length, gates, recogniser and an
  empty "你的判断" column; `w5-voice-preview-b{1,2,3}-{zh,en}.m4a` play each batch's picks in order.

**Secret postcards (W5-V8, H5-2).** One per egg with a card in lane D's registry: `china-beach-fishermen`,
`telegraph-hill-parrots`, `wave-organ-high-tide`, `lands-end-labyrinth`, `dahlia-dell-100`, `ggb-foghorn-duet`. The
shipped postcards' recipe verbatim (nano_banana_pro 4:3 2k, refs P5 + P13, the style contract, "no text"); two draws were
rejected for a visible base edge and redrawn full-frame. 1200 × 900 and 600 × 450 WebP q82;
`data/sf/eggPostcards.ts`: `eggPostcard(egg) → { title (zh / en), alt, large, small } | null`. Generic scenes only: no
person, logo, insignia, lettering or copy of a real artwork (the Wave Organ is "carved stones and pipes", not the
installation).

**The production-header check (W5-V9).** `scripts/opus-sf/qa/csp-serve.mjs --dir <dist> --port <p> --vercel vercel.json
[--spa /opus-bay] --log <json>` serves a built `dist` the way Vercel would from `vercel.json`'s `routes` (headers with
`continue`, rewrites, `handle: filesystem`, the final 404), adds `report-uri` to the CSP and collects every report and every
failed request (`/__csp-stats`). Played for 5–7 minutes in headless Chrome through the UI only (six to eight `?at=` spots, day
and night, walking, the map, the journal, a click for audio):

- **Today's CSP breaks every AI model in production.** three's `DRACOLoader` compiles its WASM decoder in a blob worker
  (`script-src` has no `'wasm-unsafe-eval'`), and `GLTFLoader` reads a model's embedded WebP textures with `fetch(blob:)`
  (`connect-src` has no `blob:`). Each AI model then falls back to its procedural stand-in — the Palace of Fine Arts
  shows its procedural stand-in. Nothing else was blocked; the fonts, tiles, voice and images load.
- The fix (a request: `vercel.json` is the lead's): `script-src 'self' 'wasm-unsafe-eval'` and
  `connect-src 'self' blob: https://baylink-api.onrender.com wss://baylink-api.onrender.com https://tiles.openfreemap.org`.
  `'wasm-unsafe-eval'` allows WebAssembly compilation only (not `eval`); `blob:` in connect-src allows reading the page's
  own blob URLs.
- `vercel.json` has no route for `/opus-bay`: behind the filesystem it falls to the 404 page. The run served it with
  `--spa /opus-bay` (like `/me` → `/index.html`).

**The world clock (lane R's request 3).** `world/clock.ts bayClock / isMarketDay / isMarketOpen` default `now` to
`game/bayNow.ts bayNow()` (dependency-free, already in the main graph): with `?date=` in DEV / QA builds the Ferry clock
hands and the market stalls follow the dated time like the rest of wave 5; production and every explicit date read as
before.

### Evidence

**The gate after the lane batches** — the pinned gate tree at `21c6c4d` (the part-b work of lanes A, C, D, F, L, N, R, T
and V's voice; lane E's part b was not pushed yet; `bb7b843` changes no runtime code, `41e3f13` only the clock's default),
dev server 5516, 2026-09-28 14:54–15:35 UTC, CPU 11–17 % when checked between runs; desktop 1440 × 900, quality high,
RTX 3070 laptop (`--force_high_performance_gpu`), golden. Max over the standing, aimed, idle and walking measures.

| spot / ride | calls · triangles | headroom (150 · 400k) | fps idle / walk (ride) | p95 ms | > 100 ms | part a (after the levers) |
|---|---|---|---|---|---|---|
| ferry-gate | 104 · 352k | 46 · 48k | 60.1 / 60.1 | 16.7 | 0 | 104 · 384k |
| chinatown | 113 · 272k | 37 · 128k | 60.1 / 60.1 | 16.8 | 0 | 125 · 334k |
| twin-peaks | 108 · 293k | 42 · 107k | 60.1 / 60.1 | 16.7 | 0 | 107 · 311k |
| civic-center | 76 · 239k | 74 · 161k | 60.1 / 60.1 | 16.7 | 0 | 84 · 326k (day-0) |
| union-square | 75 · 279k | 75 · 121k | 60.1 / 60.1 | 16.7 | 0 | 85 · 338k |
| music-concourse | 85 · 221k | 65 · 179k | 60.1 / 60.1 | 16.7 | 0 | 88 · 249k (day-0) |
| stonestown-sfsu | 67 · 215k | 83 · 185k | 60.1 / 60.1 | 16.7 | 0 | 71 · 202k (day-0) |
| haight-usf | 91 · 294k | 59 · 106k | 60.1 / 60.1 | 16.7 | 0 | 93 · 286k (day-0) |
| ocean-beach | 43 · 104k | 107 · 296k | 60.1 / 60.1 | 16.7 | 0 | 47 · 106k (day-0) |
| ggb-south | 59 · 100k | 91 · 300k | 60.1 / 60.1 | 16.7 | 0 | 52 · 111k (day-0) |
| mission | 85 · 317k | 65 · 83k | 60.1 / 60.1 | 16.7 | 0 | 80 · 325k (day-0) |
| grace-nob-hill | 93 · 258k | 57 · 142k | 60.1 / 60.1 | 16.7 | 0 | 96 · 325k |
| powell-market | 117 · 319k | 33 · 81k | 60.1 / 60.1 | 16.7 | 0 | 123 · 371k |
| fidi | 82 · 261k | 68 · 139k | 60.1 / 60.1 | 16.7 | 0 | 88 · 291k |
| ggb-deck | 43 · 80k | 107 · 320k | 60.1 / 60.1 | 16.7 | 0 | 59 · 207k (day-0) |
| hellman-hollow | 63 · 195k | 87 · 205k | 60.1 / 60.1 | 16.8 | 0 | 67 · 222k (day-0) |
| marina-green | 70 · 300k | 80 · 100k | 60.1 / 60.1 | 16.7 | 0 | 77 · 198k (day-0) |
| castro | 73 · 296k | 77 · 104k | 60.1 / 60.1 | 16.7 | 0 | 67 · 304k (day-0) |
| filbert-steps | 70 · 236k | 80 · 164k | 60.1 / 60.1 | 16.7 | 0 | 91 · 280k |
| ride bus-palace | 69 · 222k | 81 · 178k | (60.1) | 16.7 | 0 | 103 · 421k (one frame) |
| ride n-duboce | 77 · 247k | 73 · 153k | (60.1) | 16.7 | 0 | 84 · 324k |
| ride m-west-portal | 66 · 221k | 84 · 179k | (60.1) | 16.7 | 0 | 84 · 309k |
| **night** irving-night (`--time night`: V5's lamps, L's Irving corner) | 96 · 295k | 54 · 105k | 60.1 / 60.1 | 16.7 | 0 | — |
| **event** hellman-hollow, `--date 2026-10-04T12:00` (R's bluegrass stage and crowds) | 69 · 222k | 81 · 178k | 60.1 / 60.1 | 16.7 | 0 | — |
| **event** castro, `--date 2026-10-04T12:00` (the fair day) | 73 · 293k | 77 · 107k | 60.1 / 60.1 | 16.8 | 0 | — |
| **event** marina-green, `--date 2026-10-09T12:40` (Fleet Week) | 76 · 145k | 74 · 255k | 60.1 / 60.1 | 16.7 | 0 | — |

Programs **60 → 60** in every desktop run (first = last: everything compiled before the first measure; 58 at part a —
the lanes' part-b materials; V5 itself measured 58 → 58 when it landed). 0 frames over 100 ms anywhere on the desktop.
The event shots (`qa/w5/V/v6-gate-event-days.jpg`): the bluegrass stage, pennants and crowd at Hellman Hollow, the Castro
banners; the Marina Green spot's view is the Marina streets (the jets are not in that frame). The downtown headroom grew
since part a (Chinatown 66k → 128k, Grace / Nob Hill 75k → 142k, Powell & Market 29k → 81k: the lanes' part-b work
plus a different arrival view; read with the 15k margin of part a).

**The phone subset** (390 × 844, dpr 3, quality mid, 4× CPU, same tree, 15:28 UTC, the host quiet):

| spot | calls · triangles | fps idle / walk | p95 ms | > 100 ms | gate |
|---|---|---|---|---|---|
| ferry-gate | 85 · 273k | 60 / **46.7** (re-run 47.4) | 33.4 | 0 | pass (≥ 45) |
| chinatown | 92 · 231k | 59.8 / 54.2 (re-run 54.1) | 33.3 | **1** (re-run 1) | fail: one frame > 100 ms while walking |
| twin-peaks | 78 · 202k | 60.1 / 60.1 | 16.7 | 0 | pass |
| union-square | 62 · 225k | 60 / 60.1 | 16.7 | 0 | pass |
| grace-nob-hill | 81 · 261k | 59.8 / 60 | 16.7 | 0 | pass |
| powell-market | 77 · 255k | 59.9 / 59.1 | 16.7 | 0 | pass |
| filbert-steps | 76 · 226k | 60.1 / 59.7 | 16.7 | 0 | pass |

Programs 58 → 58. The Chinatown long frame is **not new**: the same run on the tree just before V5 (`a26d35f`, 15:34 UTC)
shows it too (1 frame > 100 ms, walk 52.4 fps, 93 calls · 246k). Not profiled (Requests). The Ferry gate walks at
46.7–47.4 fps: 2 fps above the floor.

**Nights (V5)**: `qa/w5/V/v5-nights-before-after-desktop.jpg` (the Sunset, the Richmond, the Haight and Glen Park at
night, before (`0db1687`) / after: a post with its halo and pool beside BAYBAY where the street was dark), `v5-nights-phone.jpg` (390 × 844),
`v5-coin-glints.jpg` (the glints on a coin trail at night), and the production build at night in
`v9-csp-fixed-production-run.jpg` (Sunset / Parkside, top right). Tests: the glow levels by zone; the lamps on four
published outer chunks (−3_10, −4_8, −1_6, 3_5: ≥ 20 each, ≥ 150 together, inside their chunk, in a lit zone, off every
carriageway, clear of mapped lamps and trees, deterministic) and none in the downtown chunks 1_0, 1_−1, 1_1, 1_2 or
without zones; the lamp layer's cap (≤ 3.5k triangles); the 16 glint slots filled at night and cleared by day.

**Voice (V7)** in the game (`qa/w5/V/v7-voice-in-game.json`, `v7-voice-bubbles-desktop-phone.jpg`; dev server on
`bb7b843`, 15:45–15:52 UTC): desktop 1440 × 900 zh — a batch-1 line (一起跳！左一步，右一步～) and a batch-3 fortune
(今日签：找张长椅坐五分钟，什么都不用做。) each played their clip once (`voice-clip:zh-w5-a-eced2a17`,
`zh-w5-d-1c245e27`); a resident saying the same text and an unrecorded BAYBAY line played nothing. Phone 390 × 844 en:
the same, `en-…` clips. Lane R's own emit (`realsf-daily-all`) played `zh-realsf-daily-all`; lane C's paced line said as a
bubble (欢迎回来！) was left to lane C (nothing played by V). Tests: the inventory's rules; the table against the report
and the files (bytes, sha256, durations, the muted clip); the binder (BAYBAY only, once per bubble, not `own`, not
`W5_VOICE_CHECK`, off after teardown). The report `qa/w5/V/voice/w5-voice-report.json` keeps every take with its job id.

**Postcards (V8)**: `qa/w5/V/v8-secret-postcards.jpg` (the six at 600 px, read at full size before use); the test reads
each WebP's header (1200 × 900 / 600 × 450, ids = the registry's egg ids, ≤ 160 / 60 KB).

**The header check (V9)**: `qa/w5/V/v9-csp-today-run.json` (today's `vercel.json`, 4.9 min, 6 spots, 7 page loads: 21
reports — 7 × `connect-src blob:` and 14 × `script-src wasm-eval`, one blob read and two WASM compiles per page load —
0 failed requests),
`v9-csp-fixed-run.json` (the two additions, **6.5 min, 8 spots, 422 requests: 0 reports, 0 failed**, 15:34–15:41 UTC),
`v9-csp-palace-today-vs-fixed.jpg` (the Palace, left today's headers: the smooth procedural rotunda; right the fix: the
AI model's carved rotunda), `v9-csp-fixed-production-run.jpg` (four of the fixed run's spots). One `vite build` of the
lane's tree at `21c6c4d` for both runs. (The message of
`bb7b843` says "a 5.7-minute run"; the file it committed was the 1-minute Palace-only run. This report replaces it with
the full run above.)

**The clock (lane R's request)**: in the game (dev, `?date=`): 2026-10-03T10:30 → `bayClock()` Sat 10:30, market stalls
shown, tarps hidden; 2026-10-05T15:00 → Mon 15:00, stalls hidden, tarps shown. Test: the same, explicit instants
unchanged, no shift without a date.

**Bundle**: GameRoot **307,689 B** gzip -9 at `21c6c4d` (part a `cf3dd82`: 301,053 B; +6.6 KB from the lanes' part b).
Lane V's part b adds nothing to it: the lamps, glints, binder and voice table live in the city chunk and the lazy imports
(the P7 test stays green); `world/clock.ts` now imports `game/bayNow.ts`, which the main graph already had.

**Higgsfield** (ledger `docs/opus-bay/ledger/w5-V.md`, every batch with the balance before and the transactions after):

| batch | what | credits |
|---|---|---|
| 1 | H5-3 voice, 95 lines × zh / en (190 takes) | 4.54 |
| 2 | H5-2 the six secret postcards (8 draws, 2 rejected for a base edge) | 16.00 |
| 3 | H5-3 10 retakes | 0.18 |
| 4 | H5-3 the lines frozen since batch 1 (86 takes + 8 retakes) | 1.75 |
| 5 | H5-3 the lines the first filter missed (20 takes) | 0.43 |
| **total** | of the 130 cap | **22.90** (balance 400.07 → 377.17) |

### Decisions

1. **The outer lamps reuse wave 4's lamp layer** (positions from the chunk worker, drawn by the capped instanced layer
   with its halos and pools) instead of a new night-only mesh: no draw call, no program, the cap keeps the triangles
   flat. Downtown (FiDi / SoMa) keeps its mapped lamps only; the rest of the city is lit, including the zones with a few
   mapped lamps (the 10 u clearance avoids doubles).
2. **Glints live in the night light field** (16 slots at the end of its buffer, the same Points draw) rather than a sprite
   per coin; the coins are read through a lazy import so the economy stays out of the main graph.
3. **Voice by text match, not by wiring**: the lanes kept saying bubbles; the binder recognises a recorded text. A lane
   that changes a line gets text only (never a wrong clip); nothing in another lane's file changed.
4. **Lane C's 11 paced lines are recorded but not played yet.** Lane C's pacer reads `TOUR_VOICE_CLIPS`, and lane C's own
   test pins `lineRecorded('w5c-pelican-ask') === false`; merging the table into `data/sf/voiceTour.ts` would have broken
   that test. The clips and `W5_PACED_CLIPS` (with their seconds for the pacer) are ready (Requests).
5. **The recogniser is advisory, the gates are not.** 10 clips the recogniser missed after retakes play (they pass the
   gates and sound right on the sheet); the one clip that missed a gate twice (a slow "Me first! Again?") is muted for the
   owner's ear.
6. **The postcards follow the shipped recipe** (P5 + P13 refs, the style contract) so the six sit with the 24 in the
   notebook; a draw with a base edge is rejected and redrawn with a full-frame line, per the stop rules.
7. **H5-1 (shop icons) held**: lane E's shop item ids are not frozen, and drawing icons for ids that may change would waste
   credits. **H5-4 / H5-5 / H5-6 not spent**: the signs are canvas-painted (part a), and no reference sheet or texture
   was needed this part.
8. **The CSP fix is a tested diff, not an edit**: `vercel.json` is frozen; `csp-serve.mjs` lets the lead check the change
   before a deploy (the same run, one flag).
9. **Event runs use R's `?date=`** (the runner's new `--date`), and one dated run per event day, so the normal gate stays
   the everyday city.

### Not done (part b)

- **W5-V3, the city data out of GameRoot** (≈ 23–28 KB; GameRoot 307.7 KB against 265): lane N gave its OK in its
  report, but lanes C's and L's files were still moving and no window was set; still a request to the lead.
- **W5-V10** (the shoulds): not started.
- **H5-1 shop icons** (held, above); **Japanese plaques** for lane L's Japantown corner (`ramen` ラーメン, `sweets` 和菓子,
  `hon` 本): not done (the atlas has room: 22 of 32 cells).
- **The postcards are not shown in the game yet**: `eggPostcard(egg)` is ready; the card / notebook are lanes D / E's
  files (Requests).
- **The Chinatown phone hitch** (one frame > 100 ms while walking at 4× CPU, pre-existing): not profiled.
- **A crowd-wave gate run** (lane T's request, after lane A's emote wheel): not run.
- The phone fps above are one quiet run each (two at the Ferry gate and Chinatown); the lead's quiet run stays the gate.

### Requests

1. **Lead — `vercel.json` (frozen)**: in the CSP, `script-src 'self' 'wasm-unsafe-eval'` and add `blob:` to `connect-src`
   (the line in full under "The production-header check"); and a route for the game before the final 404, e.g.
   `{ "src": "^/opus-bay/?$", "dest": "/index.html" }` next to `/me`'s. Check: `npm run build`, then `node
   scripts/opus-sf/qa/csp-serve.mjs --dir dist --port 5517 --vercel vercel.json --log csp.json`, play the city, read
   `http://localhost:5517/__csp-stats` (expect 0 violations, 0 failed).
2. **Lead — W5-V3**: a window for the city-data move (plan in part a's Requests; N's OK is in its report).
3. **Lead — the phone gate**: the quiet phone run at Chinatown (one frame > 100 ms while walking, also on `a26d35f`).
4. **Lane C**: read `W5_PACED_CLIPS` (`data/sf/voiceW5.ts`, `{ '<lang>-w5c-…': seconds }`) in `game/cityMoments.ts`
   next to `TOUR_VOICE_CLIPS` and flip `tests/opus-bay-w5-tours.test.ts`'s `lineRecorded('w5c-pelican-ask')` pin; the 11
   `w5c-*` lines then speak through your pacer. Also `game/flow.ts marketOpenNow(now = new Date())` → `bayNow()` so
   BAYBAY's taste lines agree with the stalls under `?date=` (DEV only).
5. **Lane R**: the key `jets-day` carries two texts (`JETS_DAY_LINE` before the window, `JETS_NOW_LINE` in it), so
   neither can have a clip under `realsf-jets-day`; give `JETS_NOW_LINE` its own key (e.g. `jets-now`) and lane V records
   both with the next batch.
6. **Lane D (and E for the notebook)**: show the secret postcard on the egg's card and in the 手帐 —
   `eggPostcard(egg)?.large` (1200 × 900) / `.small` (600 × 450), `title` zh / en, `alt`.
7. **Lane E**: freeze the shop item ids; lane V then draws the H5-1 icons (plan §5, within the cap).
8. **Lane L**: confirm you still want the Japanese plaques; lane V adds them to the signs atlas (append only).
9. **Owner**: the listening sheet `docs/opus-bay/qa/w5/V/voice/listening.md` — mark ✗ or 重录 where a clip sounds wrong;
   say yes / no to the muted `en-w5-a-2fe95a24` ("Me first! Again?").

### Checks

- `npx tsc -p tsconfig.app.json --noEmit`: 0 errors · `npx eslint .`: 0 errors (43 old warnings).
- `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts`: 1,196 / 1,196 on `bb7b843`; **1,197 / 1,197** on
  `41e3f13` (the clock test added), before this report's commit.
- Higgsfield: 22.90 credits (ledger above), balance 377.17 (never under 250).

## Part c

### 给主人的摘要

1. **首屏包瘦身（检查点 CP-10）**：24 张地标卡的文字、12 张旧金山明信片的文字和地标照片表，搬进一个"城市数据包"——只有城市模式才下载，街区模式完全不下。我这边一共挪走约 21 KB；但这几天其他线又加了约 10 KB，现在 GameRoot 约 300 KB（目标 265）。剩下的都在别的线的代码里，清单和大小写在下面"请求"里。
2. **夜晚的旧金山更像真的了**：海湾大桥西段北侧的吊索上亮起一串串 LED 小灯，慢慢流动闪烁（真实的 Bay Lights 2026 年 3 月 20 日重新点亮）；Salesforce 塔顶的灯会慢慢变色（近看塔顶本身、远看灯点都会变）；天上的月亮按旧金山当晚真实的月相显示（新月那几天星星更多）；Karl 雾按月份浓淡：7 月最浓，9–10 月最淡。只在城市模式，不多一次绘制。
3. **BAYBAY 又会说 53 句新话**（中英文 106 条录音）：烤棉花糖、捡小石子、城市之声、小铺和手帐的台词；电脑中文和手机英文都在游戏里听到了。两条语速不合格的先静音，等你听过再定（试听单里第 4 批）。
4. 日本町街角的三块日文招牌做好了：ラーメン、和菓子、本。
5. **性能检查**：电脑版 20 个测点、3 段乘车、夜景和活动日全部 60 帧、0 次卡顿，最多 120 次绘制 / 36.6 万三角形（上限 150 / 40 万）。手机 4 倍降速这次机器太忙（其他线在跑测试），帧数不作数；我把同一个地方新旧两版的 CPU 分析对比过，没有发现新代码变慢。请总负责人在安静的机器上复测手机。
6. Higgsfield 这部分只花了 2.17 分（语音），第五波共 25.07 分（上限 130），余额 375.00。

### What was built

| task | commit(s) | files |
|---|---|---|
| **W5-V3 (CP-10)** the city's text tables in a lazy data chunk: the 24 landmark cards (`SF_LANDMARK_INFO`), the 12 SF postcards' texts, the landmark photos | `b0bf1e3f`, `2bda42fb` | `src/opus-bay/data/sf/{cityData,cityDataChunk,postcardCards,cityPhotos}.ts` (new), `data/sf/{cityPois,postcards}.ts` (lane C's: the reads switched), `tests/opus-bay-sf-budget.test.ts` |
| **W5-V10** The Bay Lights, the Salesforce crown's drift, tonight's moon, Karl by month | `cef43f9b` | `src/opus-bay/world/sf/{lights,cityWorld,fog}.ts`, `world/{environment,backdrop,world}.ts`, `tests/opus-bay-w5-perf.test.ts`, `tests/opus-bay-sf-atmos.test.ts` |
| **W5-V4** (lane L's request) three Japanese plaques; W5-V1 lane D's Pier 45 spot | `2506d3c4` | `src/opus-bay/world/sf/signsAtlas.ts`, `scripts/opus-sf/qa/perf/w5-spots.json` |
| **W5-V11** the gate runner: long tables over several Chrome sessions; a 3 s settle before a ride | `af0c8e30`, `03ee807b` | `scripts/opus-sf/qa/perf/w4-perf.mjs` |
| **W5-V7** voice batch 4 (the lanes' part-c lines) | `d8b2c26f` | `scripts/opus-sf/voice/w5/lines.ts`, `src/opus-bay/data/sf/voiceW5.ts` (generated), `public/opus-bay/w5/voice/` (+212 files), `docs/opus-bay/qa/w5/V/voice/`, `docs/opus-bay/ledger/w5-V.md` |

**The city data chunk (W5-V3).** `data/sf/cityData.ts` (in the main graph, 150 B) exports `CITY_DATA`, the awaited
`import('./cityDataChunk')` — a top-level await. The content modules resolve their tables at import time
(`data/contentMode.ts`: the world mode is fixed per page), so in city mode GameRoot's chunk pauses there for one small
request and every table then resolves as before; district mode never fetches it (`CITY_DATA` null, the city tables empty:
district reads them nowhere, `byMode`); node (tests, QA scripts: no `import.meta.env`) always loads it, so every `CITY_*`
export stays whole in tests. `cityPois.ts` reads `SF_LANDMARK_INFO` and `CITY_PHOTOS`, `postcards.ts` the 12 cards' texts
from it; every export keeps its name and shape. The one rule that makes it safe: nothing the data chunk reaches at runtime
may be in GameRoot's static graph (a shared module would stay in GameRoot's chunk, the data chunk would import it from
there and the two would wait on each other for ever) — a test walks both graphs. Checked on a production build served
with the fixed CSP: district mode loads no data chunk (Postcards 0/8), city mode loads `cityDataChunk` + `landmarks` and
shows the Palace card, the turntable card, Postcards 0/24 and Ray at the turntable (`qa/w5/V/v3-production-district-city.jpg`).

**The Bay Lights, the crown, the moon, Karl (W5-V10)**, city mode only, 0 draw calls, 0 triangles, 0 programs:
- *The Bay Lights*: the city Bay Bridge (`world/backdrop.ts`) hands its suspender strands (every 3 u, both cable planes)
  to the night light field; `bayLights()` puts an LED dot every 1 u up each strand of the **northern** plane (true north
  from `core/geo.ts`) — 1,209 points in the existing Points draw, level band `BAY_LIGHTS` (4 + position along the
  crossing). The shader draws them as small cool-white dots with two soft waves drifting across the strands and a faint
  sparkle (our own pattern, never the installation's sequences), energy-kept when a dot is smaller than a pixel far away.
  Facts (checked 2026-09-28): relit 20 March 2026 with 48,000 LEDs on the northern cable plane of the west span, nightly
  from dusk (illuminate.org/projects/thebaylights, illuminate.org/2026/02/19/the-bay-lights-to-return-friday-march-20-2026);
  on the vertical cables, seen mostly from the north side / the waterfront (en.wikipedia.org/wiki/The_Bay_Lights).
- *The Salesforce crown*: its light-field points take their own band (`CROWN_DRIFT`, 5 + height) and drift through a soft
  palette (one turn ≈ 2 min, a band rising up the crown), and the hero tower's own glowing crown faces take the same
  colours through their vertex colours (`CrownDrift`, ≤ 5 Hz, mixed by the night level; by day as built; restored on
  dispose) — the floodlit crown was a white glow at every distance, so points alone never showed. Our own abstract drift:
  the real "Day for Night" shows low-resolution moving pictures of the city from 11,000 LEDs (salesforcetower.com/artwork,
  checked 2026-09-28), never copied.
- *Tonight's moon*: the sky shader gains `uMoonPhase` (−1 = the district's full moon, byte for byte as before); the city's
  `realSky` system sets it from lane R's `moonPhase(bayNow())` at once and every 60 s: an elliptic terminator (waxing lit
  on the right), a faint ashen dark side, the glow round the lit part and as bright as it, and more stars as the lit
  fraction falls. `?date=` moves it (DEV / QA builds).
- *Karl by month*: `karlTarget(tod, flag, month)`; the time table is July (factor 1); a clearer month thins the level
  (× 0.55 in October), keeps the western front up to 160 u further offshore and shortens the Gate lobe; the `?karl` flags
  ignore it; the first month applies at once, a new month slides like a new time.

**Voice batch 4 (W5-V7, part c).** 53 new lines (lane A's marshmallow and fire rings 13, lane D's pebbles, city sounds,
batch-2 eggs and the renamed Wave Organ rumour 26, lane E's 12 `E_LINES` under lane E's own ids `e-<key>` — lane E plays
them with its own `voice-line` event —, one shop line), 106 Pixie clips + 18 retakes; 104 through the gates, 2 muted
(`zh-e-bought` 好看！买下啦。 too slow, `en-w5-a-dbc137fe` "Golden! Crisp outside, gooey inside!" too slow) until the
owner's ear; 100 heard right by the recogniser (advisory). The inventory now skips paper under `riddle` / `how` / `name` /
`hint` … keys (lane D's city-sound riddles and hints) and three lane-A button labels, and reads `E_LINES` (written with
`bi()`). One recorded line retired (the old 码头区 wording of the Wave Organ rumour). Table: 386 clips, 383 pass.

**Japanese plaques (W5-V4, lane L's request).** `ramen` ラーメン Ramen (lacquer), `sweets` 和菓子 Sweets (rose), `hon` 本
Books (enamel) in cells 22–24 (append only), a Japanese font stack (Hiragino on iOS, Yu Gothic / Meiryo on Windows);
painted in Chrome with the page's fonts (`qa/w5/V/v4-signs-atlas-c.jpg`).

**The gate runner (W5-V11).** 20 spots + 3 rides no longer fit one Windows command line (`spawn ENAMETOOLONG`): the runner
splits the table over as few Chrome sessions as fit and prints programs first → last per session. A ride now stands the
camera at its start for 3 s before it measures: after Pier 45 the rides read 367k / 394k on their first frames (the
Wharf's chunks still loaded), 248–257k settled.

### Evidence

**The gate on the part-c tree** — pinned `2506d3c4` (the part-c work of lanes C, E, F, L, N, R, T and V pushed by 13:20 PT;
lanes A's and D's later batches not in it), gate tree `C:/Users/willy/wt/w5-v-gate`, dev server 5516, PERF-LOCK held
20:34–21:30 UTC; desktop 1440 × 900, quality high, RTX, golden; the host at 80–100 % CPU during the desktop run (the
desktop numbers held at 60 fps anyway). Raw: `C:/Users/willy/opus-qa/w5/w5-v/gate-c/{desk,rides2,night,fair,jets,phone,phoneA,phoneB}`.

| spot / ride | calls · triangles | fps idle / walk (ride) | p95 ms | > 100 ms | part b |
|---|---|---|---|---|---|
| ferry-gate | 103 · 353k | 60.1 / 60 | 16.8 | 0 | 104 · 352k |
| chinatown | 120 · 278k | 60.1 / 60 | 16.8 | 0 | 113 · 272k |
| twin-peaks | 95 · 273k | 60.1 / 60.1 | 16.8 | 0 | 108 · 293k |
| civic-center | 81 · 245k | 59.9 / 59.9 | 16.8 | 0 | 76 · 239k |
| union-square | 74 · 220k | 59.9 / 59.9 | 16.8 | 0 | 75 · 279k |
| music-concourse | 103 · 304k | 59.7 / 59.9 | 16.8 | 0 | 85 · 221k |
| stonestown-sfsu | 68 · 183k | 59.8 / 59.8 | 16.8 | 0 | 67 · 215k |
| haight-usf | 82 · 295k | 60.1 / 60.1 | 16.8 | 0 | 91 · 294k |
| ocean-beach | 89 · 305k | 60.1 / 60 | 16.8 | 0 | 43 · 104k (no aimed view then) |
| ggb-south | 72 · 132k | 59.9 / 59.9 | 16.8 | 0 | 59 · 100k |
| mission | 84 · 315k | 60 / 60.1 | 16.8 | 0 | 85 · 317k |
| grace-nob-hill | 99 · 294k | 60.1 / 59.9 | 16.8 | 0 | 93 · 258k |
| powell-market | 97 · 310k | 59.9 / 59.8 | 16.8 | 0 | 117 · 319k |
| fidi | 93 · 268k | 60 / 59.9 | 16.8 | 0 | 82 · 261k |
| ggb-deck | 76 · 203k | 60.1 / 60 | 16.8 | 0 | 43 · 80k |
| hellman-hollow | 95 · 233k | 59.9 / 59.6 | 16.8 | 0 | 63 · 195k |
| marina-green | 92 · 334k | 59.9 / 60 | 16.8 | 0 | 70 · 300k |
| castro | 72 · 299k | 60.1 / 60.1 | 16.8 | 0 | 73 · 296k |
| filbert-steps | 86 · 290k | 60.1 / 60 | 16.8 | 0 | 70 · 236k |
| **pier45** (new, lane D's request) | 113 · 366k (two runs: 104 · 366k, 113 · 328k) | 60.1 / 60.1 | 16.8 | 0 | — |
| ride bus-palace (settled) | 72 · 254k | (60) | 16.8 | 0 | 69 · 222k |
| ride n-duboce (settled) | 84 · 257k | (60.1) | 16.8 | 0 | 77 · 247k |
| ride m-west-portal (settled) | 65 · 225k | (60.1) | 16.8 | 0 | 66 · 221k |
| **night** irving-night | 95 · 296k | 60.1 / 60.1 | 16.8 | 0 | 96 · 295k |
| **event** hellman-hollow `--date 2026-10-04T12:00` | 68 · 225k | 60.1 / 60.1 | 16.8 | 0 | 69 · 222k |
| **event** castro `--date 2026-10-04T12:00` | 73 · 291k | 60.1 / 60.1 | 16.7 | 0 | 73 · 293k |
| **event** marina-green `--date 2026-10-09T12:40` | 77 · 148k | 60.1 / 60.1 | 16.7 | 0 | 76 · 145k |

Programs **60 → 60** in every desktop session (first = last). Max 120 calls (Chinatown) and 366k triangles (Pier 45):
headroom 30 calls / 34k at the tightest. The first ride row of the one-session run read 104 · 367k and 107 · 394k:
the transition from Pier 45, fixed in the runner (above). A 78-program reading in some dev runs is the warm-up's
background pass for the next quality level (the base set compiled twice, by design), not a leak.

**The phone subset** (390 × 844, dpr 3, mid, 4× CPU, same tree): **void — the host was loaded** (other lanes' suites;
10 Chrome processes seen). Ferry gate 85 · 273k, walk 31.8 then 23.3 fps; Music Concourse walk 33.9 then 41.9. An A/B
back to back on the part-b tree `21c6c4d` gave the Ferry gate 45.8 / 39.9 and the Music Concourse 60 / 60 in the same
window; the CPU profiles of the Music Concourse walking at 4× (`gate-c/prof{A,B}.cpuprofile`, 8 s) differ by 2.5 % of
busy time, spread over three.js (+100 ms), the driver (+97 ms) and lane T's crowd (+56 ms); no new module shows (lane
D's pebbles 5 ms). Calls, triangles and programs (58 → 58) are valid; the fps are the lead's quiet run to make.

**GameRoot** (`vite build`, gzip as vite reports it):

| tree | GameRoot | note |
|---|---|---|
| checkpoint head `dfb02f3` | 310.52 KB | CP-10's 310.48 |
| + landmarks out | 295.14 KB | `cityDataChunk` 16.78 KB |
| part-c gate tree `2506d3c4` | 299.29 KB | + postcards / photos out (−5.5 KB); the lanes' part c +10.2 KB (lane C's residents' second favours +3.2, photo album +0.7, lane F's controller / move / glide +1.4, lane T's life +0.6 …) |

The data chunks: `cityDataChunk` 4.33 KB + `landmarks` 16.63 KB gzip (the landmark library is shared with the city's lazy
chunks), fetched only in city mode. On the pushed head `d8b2c26f` (the lanes' reviews in): **GameRoot 299.98 KB**.

**Shots** (every image read): `qa/w5/V/v10-bay-lights-desktop-phone.jpg` (the Bay Lights from the Embarcadero at night,
desktop and 390 × 844), `v10-crown-drift-desktop-phone.jpg` (the crown tinted from Coit Tower, desktop and phone),
`v10-moon-phases.jpg` (10-10 thin crescent, 10-14 waxing crescent, 10-18 first quarter, 10-25 full, 11-01 last quarter,
over the Bay), `v10-karl-october-july.jpg` (8 am from Twin Peaks: October's bank over the outer Sunset, July's over the
whole Sunset), `v3-production-district-city.jpg`, `v4-signs-atlas-c.jpg`, `obs-journal-tabs-en-desktop.jpg` (Requests).

**Voice in the game** (dev server on this tree, 21:58 UTC): desktop 1440 × 900 zh and phone 390 × 844 en — lane D's
我闻到小石子的味道啦！ / "I can smell a pebble!", lane A's 再来一个！ / "Another one!" and lane E's own `e-ticketFly` event
each played their clip once; an unrecorded BAYBAY line stayed text.

**Routed V items** (plan §4.9 V10): all landed in wave 4 and are still in place — Strawberry Hill's water holes
(`9340000` W4-V-I1), the mural boards at 0.06 u (`scripts/opus-sf/murals/place.ts` PANEL.clear), `opus-prof.mjs`'s own
debugging port (W4-V-I2), the `?debug` panel on phones (W4-V-I3, tested in sf-budget), the route warm-up drift
(W4-V-I5, late passes). **Lane N's flag render-target variant**: not reproduced on this tree — `ob-flags` stays one program
before, with and after the map sheet (desktop high 60, desktop mid 58, phone mid), so nothing to warm.

**Tests** (new in part c): sf-budget "W5-V3" (the data chunk: out of the main graph, disjoint from it, the loader rule,
the tables resolve); w5-perf "W5-V10" × 5 (the Bay Lights north plane and count, the crown bands, the hero crown drift,
Karl by month, tonight's moon), the V4 atlas test (the Japanese cells), the V7 inventory (E_LINES ids, the city-sound
riddles are paper, lane A's facts are spoken).

### Decisions

1. **A top-level await, not a mutable registry**, for the city data: the content tables resolve at import time; awaiting the
   chunk before they evaluate keeps every export's shape and every consumer unchanged (a two-line switch in lane C's files),
   and node loads it too, so no test changed. Safe only while the data chunk shares nothing with GameRoot's graph (tested).
2. **The residents' rows stay put** — moved and then undone within the hour: lane C was adding the second favours to the
   same rows (a rebase conflict in lane C's file: stopped, as the protocol says). ≈ 3.5 KB when lane C is done (Requests).
3. **The Bay Lights on the northern plane only**, dots 1 u apart (the real LEDs are 30 cm apart on cables ≈ 15 m apart:
   ours are the toy's scale); white LEDs brighter than 1 so the small additive dots read as the brightest lights on the Bay.
4. **The crown drifts on the hero mesh too** (vertex colours of one mesh, city mode only) — the plan named the Points draw
   only, but the floodlit crown hid the points at every distance; no shader changed for it (the TOY program is shared by
   the district: untouched).
5. **The moon's glow is centred on its lit part** (not masked by the terminator): a masked glow drew rays out of the
   horns into the sky.
6. **Karl's table is July.** September and October are SF's clearest months (lane R's source); an October morning still
   pools over the outer Sunset. The owner's usual fog comes back in June–August.
7. **No H5-1 shop tiles.** Lane E's shop shows live try-on previews in the exact item colours; a painted tile per colour
   would not match the in-game recolours exactly, and the plan's fallback is those previews. 0 credits.
8. **Voice for lane E under lane E's ids** (`e-<key>`, `own`): lane E already emits `voice-line e-<key>`, so the clip plays
   without a change on its side and the binder never doubles it.
9. **Phone fps not claimed** under a loaded host; the A/B and the profiles are the evidence that nothing regressed.

### Not done

- **GameRoot ≤ 265 KB**: 299.98 KB on `d8b2c26f` (299.29 on `2506d3c4`) (−21 KB of city data moved; the lanes added +10 KB meanwhile). What is
  left is other lanes' code (Requests, with sizes).
- **The residents' rows** in the data chunk (Decisions 2).
- **The phone gate** under a quiet host (the lead's W5-Z run).
- **H5-1 shop tiles** (Decisions 7); H5-4, H5-5, H5-6: nothing spent.
- Lanes A's and D's batches pushed after 13:20 PT (A9's new activities, D's batch-2 eggs) are not in the gate tree; lines
  they added after the voice inventory (21:00 UTC) are text only until a next batch.

### Requests

1. **Lead — GameRoot to 265 KB** (gzip of parts on `2506d3c4`, ×0.91 ≈ real): lane F's city-only actor modules
   (`charImpl` 2.0, `feet` 1.2, `stuckHelper` 1.2, `glideTall` 1.0, `viewField` 0.9, `deckSteer` 0.8, `recolor` 0.6,
   `faceOpen` 0.5 ≈ 8.2 KB) through a lazy city chunk, and the district vehicles (`actors/vehicles` 12.8 KB) on the first
   ride; lane C's `data/pois.ts` card bodies (`realInfo`, most of its 12.1 KB) loaded when a card opens and the district
   tour's dialogue in `data/script.ts` (13.6 KB); lane C's residents' rows into `CITY_DATA` (≈ 3.5 KB, the recipe is
   `data/sf/cityDataChunk.ts`'s header; lane V can do it with lane C's OK); lane N's city-only `discovery` 1.8,
   `fastTravel` 2.2, `hudLayout` 1.5, `cityZones` 1.4. Lanes F + C alone would reach ≈ 265.
2. **Lead — `vercel.json`** (still open from part b): `script-src 'self' 'wasm-unsafe-eval'`, `blob:` in `connect-src`, a
   route for `/opus-bay`. Without them every AI model falls back to its procedural stand-in in production.
3. **Lead — the phone gate** on a quiet host: the Ferry gate, Chinatown, Twin Peaks, the Music Concourse, Ocean Beach, the
   bus (`node scripts/opus-sf/qa/perf/w4-perf.mjs --file w5-spots.json --mobile --dpr 3 --quality mid --throttle 4 --spots
   ferry-gate,chinatown,twin-peaks,music-concourse,ocean-beach,bus-palace`).
4. **Lane C**: (a) the Journal's six tabs overlap on desktop in English (`Today 0/3Notebook`, `Postcards 0/24Goals`,
   `WishlistFootprints 1`: `qa/w5/V/obs-journal-tabs-en-desktop.jpg`, a production build at 1440 × 900); (b) read
   `W5_PACED_CLIPS` in `game/cityMoments.ts` (the 11 `w5c-*` clips are still silent); (c) the residents' rows (Request 1).
5. **Lane R**: `JETS_NOW_LINE` still shares the key `jets-day` with `JETS_DAY_LINE`: give it its own key and the next voice
   batch records both.
6. **Lanes A and D**: lines added after 21:00 UTC today are text only until the next batch (ask lane V).
7. **Lane L**: `ramen`, `sweets` and `hon` are in the signs atlas for the Japantown corner.
8. **Owner**: the listening sheet's batch 4 (`docs/opus-bay/qa/w5/V/voice/listening.md`, `w5-voice-preview-b4-{zh,en}.m4a`);
   say yes / no to the muted `zh-e-bought` and `en-w5-a-dbc137fe` (and part b's `en-w5-a-2fe95a24`).

### Checks

- `npx tsc -p tsconfig.app.json --noEmit`: 0 errors · `npx eslint .`: 0 errors (43 old warnings).
- `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts`: before each push fail 0 (1,203 / 1,203;
  1,231 / 1,231; 1,291 / 1,291; 1,324 / 1,324); on the pushed head `d8b2c26f` **1,331 / 1,331**. Wall-clock flakes seen under load and passed alone: the audio
  "P1" asserts, sf-move2 "E2-5 … cached per 16 u cell", actors "A* … planned in 499 ms".
- Higgsfield: **25.07 credits** in wave 5 (ledger `docs/opus-bay/ledger/w5-V.md`), balance 375.00 (never under 250).
- The PERF-LOCK was held 20:34–21:30 UTC and removed; the dev servers on 5506 and 5516 are stopped.

## Review

Adversarial review of lane V's wave 5 (the 29 `W5-V*` commits from `1f7629b` to `cf5168de`), 2026-09-28 22:10–23:40 UTC,
worktree `C:/Users/willy/wt/w5-v` rebased on `origin/opus-bay` (`cf5168de`: nothing new upstream), dev server 5506,
scratch `C:/Users/willy/opus-qa/w5/w5-v/review/`.

### 给主人的摘要

1. V 线这一波做的东西在游戏里都能用：BAYBAY 的新录音跟着气泡播放、夜里金币会闪、海湾大桥的 Bay Lights、今晚真实的月相、远处街区的"远景版"、城市数据包（街区模式完全不下载）；电脑和手机（390×844）都实际看过，12 条现实事实上网复核全部对得上。
2. 修了一个小问题：金门大桥雾笛彩蛋的明信片和城里那张"雾里的金门大桥"同名，手帐里会出现两张同名卡片；已改名"雾笛响起的时候"，大丽花那张改成"市花大丽花一百岁"，并加了测试防止以后重名。
3. 还需要总负责人安排的：首屏包 GameRoot 仍是 300 KB（目标 265，剩下的在其他线的代码里）；手机 4 倍降速的帧数这次又被别的线的无头浏览器干扰，仍要安静机器复测；正式站的安全设置（CSP）和 /opus-bay 路由要改 vercel.json；鹈鹕解锁时 BAYBAY 那几句录音（C 线的 11 句）还没接上，仍然没有声音。

### What was checked

- **Every lane V commit read** with the code around it: the gate table and runner (`w4-perf.mjs`, `w5-spots.json`), the
  warm-up helpers, the flag atlas and its shader mirror, `splitGeometryCells`, the waterfront residents' hide, the label
  guard, the far hero tiles (`farHero.ts`, the streamer's tile swap, cross-fade and dispose), the signs atlas, the outer
  lamps and residential glow, the glints, the voice inventory / table / binder, the secret postcards, `csp-serve.mjs`, the
  clock default, the city data chunk (top-level await), the Bay Lights, the crown drift, tonight's moon, Karl by month.
- **In the real game** (dev server, a fresh Chrome profile per run, every image read):
  - phone 390 × 844 dpr 3 touch, city: a BAYBAY bubble with a recorded text emits `voice-line w5-a-b058d5c1` once; the
    same text from a resident emits nothing; lane D's foghorn egg revealed → "The story & postcard" opens its secret
    postcard (the name clash below was seen there); night at the Filbert Steps: 16 coin glints drawn, the light field
    14,378 points, the crown drift on 240 hero vertices; night at the Ferry gate: the lamps and halos.
  - phone, district mode at night: `uMoonPhase` −1, no `city-far#` chunk, no city streamer, no request for
    `cityDataChunk` / `landmarks` / `voiceW5` / `signsAtlas`: the district is untouched.
  - desktop 1440 × 900 high, city, `?date=2026-10-09T12:40`, at the Marina Green spot, a QA camera aimed at lane R's lead
    jet six times as the formation loops: **max 91 calls · 235k triangles**, programs 59 → 59 (the gate's own Marina Green
    view looks over the Marina roofs and never had the jets in frame; now measured with them).
  - the label atlas in city mode: `used` 0.758, `overflow` 0 (the far detail's second `buildCity` draws no new label).
- **Production build** (`vite build` into scratch, plus a `--sourcemap` build for the per-module breakdown): GameRoot
  **299.98 KB gzip**, as reported; `cityDataChunk` 4.33 KB + `landmarks` 16.63 KB; GameRoot's
  `await import("./cityDataChunk")` preloads exactly those two chunks and `landmarks` imports nothing, so no module is
  shared with GameRoot (no deadlock). The moved postcard texts and photo table are byte-identical to `2bda42fb~1`. The
  city worker's graph (an esbuild walk from `world/sf/worker.ts`: 17 modules) holds none of the city data modules.
- **Budgets**: every desktop figure reported, and the jets view above, within 150 calls / 400k triangles; programs stable
  (58 → 58 phone, 59 → 59 desktop). Every new material has its warm-up (`v-signs`; the far chunks, lamps, glints, Bay
  Lights and crown reuse TOY, the lamp layer and the light field). The other lanes' registrations were checked against
  their real meshes (the jets with their geometry's colour attribute, smoke, pumpkins, spray, wrecks, event kit): flags
  and geometry match.
- **Teardown and frames**: CrownDrift restores the vertex colours on dispose; the light field ignores its late economy
  import after dispose; the binder unsubscribes on detach; the hero tiles go back to their near chunks. Per frame: the
  tile test exits early (4 u / quality), the crown and glints run at ≤ 5 Hz (the glints build a ≤ 16-item list at 5 Hz,
  harmless), the real sky once a minute. Lane V's code writes nothing to the economy (the glints only read `coinWorld`).
- **Voice overlap**: no recorded wave-5 text (non-`own`) is also a wave-4 voiced line (`data/sf/lines.ts`,
  `tourLines.ts`: 180 texts), so the binder never doubles `baybayLines`' own `voice-line`; lanes E, R and C's `own`
  lines are skipped as designed. The longest recorded zh line is 35 characters (≤ 45).
- **Higgsfield**: `balance` 375.00 now; the newest transactions are batch 4's TTS at 21:43–21:52 UTC: the ledger's 25.07
  of 130 and 400.07 → 375.00 are right. Nothing spent in this review.

**Facts re-checked on the web (2026-09-28):**

| fact (where) | result | source |
|---|---|---|
| The Bay Lights returned Fri 20 Mar 2026 with 48,000 LEDs (lights.ts, the report) | ✓ | illuminate.org/projects/thebaylights/ ; illuminate.org/2026/02/19/the-bay-lights-to-return-friday-march-20-2026/ |
| on the northern cable plane of the west span (`bayLights`) | ✓ (the 2026 strands add the plane's inward face, so they show from the south too; the dots are billboards, seen both ways) | illuminate.org/projects/thebaylights/ ; en.wikipedia.org/wiki/The_Bay_Lights |
| lit from dusk to dawn (the light field at night) | ✓ | en.wikipedia.org/wiki/The_Bay_Lights |
| Salesforce Tower crown: Jim Campbell's "Day for Night", 11,000 LEDs, low-resolution moving images (not copied) | ✓ | salesforcetower.com/artwork/ ; 7x7.com (Campbell installation) |
| Moon, Oct 2026: new 10th, first quarter 18th, full 25th 21:12 PDT, last quarter 1 Nov (the five-date shot) | ✓ | astronomy.com full-moon calendar 2026 ; timeanddate.com moon phases |
| Karl: July the foggiest, September–October the clearest (fog.ts with R's factor) | ✓ | sfbayweather.com/learn/when-does-sf-fog-peak ; sfbayweather.com/learn/best-time-to-visit-san-francisco-no-fog |
| Ferry Plaza market Tue & Thu 10–14, Sat 8–14 (clock.ts) | ✓ | foodwise.org/markets/ferry-plaza-farmers-market/ |
| The dahlia named SF's official flower on 4 Oct 1926, 100 in 2026 (secret postcard) | ✓ | kqed.org/news/12094987 ; dahliadell.org/history |
| The Dahlia Dell lies east of the Conservatory of Flowers (postcard alt) | ✓ | dahliadell.org |
| The wild parrots voted SF's official animal in 2023 (recorded line `w5-d-064b2e94`) | ✓ (June 2023) | sfchronicle.com (wild parrots official animal) ; hoodline.com 2023/06 |
| The Wave Organ sounds best at high tide (postcard, recorded line) | ✓ | exploratorium.edu/visit/wave-organ ; en.wikipedia.org/wiki/Wave_Organ |
| GGB foghorns: the south tower pier's long low tone, the two-toned mid-span horns (the "duet" postcard) | ✓ | goldengate.org foghorns page (lane D's source) ; parksconservancy.org fog facts |

### Defects found and fixed

1. **Two cards with one name** (`data/sf/eggPostcards.ts`, W5-V8). The foghorn egg's secret postcard was titled
   雾里的金门大桥 / "The Golden Gate in the fog", the exact title of the city postcard `sf-golden-gate-fog`
   (`data/sf/postcardCards.ts`). The 手帐's secret-postcard shelf (lane E) and the Journal's postcards (lane C) then named
   two different pictures alike, and the egg card read "The foghorn duet · Secret postcard · The Golden Gate in the fog"
   (seen on the phone). Renamed **雾笛响起的时候 / When the foghorns sound**. Its zh alt said 红色桥塔 where the en says
   orange: now 橙红色. The dahlia card's 大丽花一百岁 / "The dahlia turns 100" read as the plant's age: now **市花大丽花一百岁 /
   The city flower turns 100** (lane D's egg says 市花大丽花 100 岁). New test in `tests/opus-bay-w5-perf.test.ts`
   ("W5-V-review: a secret postcard never shares its name …"): the six are named apart and never like any of the city's
   16 art postcards or the district's 8, in zh and in en; red on the old titles, green now.

No other defect in lane V's code survived verification: the far tiles, the residents' hide, the guard, the atlases, the
lamps, the glints, the binder, the data chunk and the V10 shoulds behave as the report says, and district mode is
unchanged (the sky shader is pixel-identical at `uMoonPhase` −1; the garden refactor and `splitGeometryCells` keep the
district bytes: the hero regression is green). The report's claims checked above hold.

### Open (not fixed here; owners named)

1. **GameRoot 299.98 KB vs ≤ 265** (plan MF9 / D16). Lane V moved ≈ 21 KB; its remaining main-graph code is district code
   (world/*, `actors/npcs.ts`, `warmup.ts`). The levers are other lanes' (part c Requests 1: F's city-only actor modules
   ≈ 8 KB and vehicles 12.8 KB, C's `pois.ts` bodies / `script.ts` / residents ≈ 29 KB, N's city-only modules ≈ 7 KB):
   the lead's call.
2. **The phone fps gate is still unproven on this head.** My phone subset (PERF-LOCK held 22:55:45–23:01 UTC; 390 × 844
   dpr 3, mid, 4× CPU; raw `C:/Users/willy/opus-qa/w5/w5-v/review/gate-phone/`) ran while lane F's `opus-walker` headless
   Chrome (started 22:55:33 UTC, just before the lock) played the game in parallel: the fps are **void** (Ferry gate walk
   38.6, Chinatown 35.4, Music Concourse idle 14.4 with 25 frames > 100 ms). Calls / triangles / programs are valid and
   match lane V's: Ferry gate 85 · 272k, Chinatown 96 · 230k, Twin Peaks 81 · 211k, Music Concourse 70 · 169k, Ocean Beach
   52 · 108k, the bus 53 · 164k; programs 58 → 58. The lead's quiet W5-Z run decides (part b's quiet run: Ferry gate 46.7).
3. **`vercel.json`** (frozen): the CSP (`'wasm-unsafe-eval'`, `blob:` in connect-src) and an `/opus-bay` route, still open
   from part b; confirmed: the route list ends with the SPA routes and the 404, with no `/opus-bay`.
4. **The pelican moment is still silent**: lane C's 11 paced `w5c-*` clips are recorded, but `game/cityMoments.ts` reads
   only `TOUR_VOICE_CLIPS` and `tests/opus-bay-w5-tours.test.ts` still pins `lineRecorded('w5c-pelican-ask') === false`
   (lane C's files; part b / c request 4b).
5. **The Marina Green gate spot** stands 18 u east of lane R's venue (`realsf/eventVenues.ts` −382.1, 300.7): the arrival
   snaps it onto Retiro Way and its view is roofs, not the air show. The numbers with the jets in view are above
   (91 · 235k); the runner can aim at the lead jet (`realsf/jets.ts jetPoses`) as this review did.
6. **Risk note (no change)**: in city mode `data/sf/cityData.ts` awaits the data chunk while GameRoot evaluates, so a failed
   request for `cityDataChunk` / `landmarks` now fails the whole city page (that text used to be inside GameRoot). A
   fallback to `null` would run the city without its landmark cards and with 0 of its 16 art postcards, so the hard failure
   stays (the same failure class as GameRoot's own chunk); named for the lead.
7. Report wording (part c 摘要 2): "9–10 月最淡". Lane R's table has October and November as the clearest (0.35) and
   September at 0.45; the game follows the table.

### Checks

- `npx tsc -p tsconfig.app.json --noEmit`: 0 errors · `npx eslint .`: 0 errors (43 old warnings).
- `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts`: 1,331 / 1,331 on `cf5168de` before the fix;
  **1,332 / 1,332** with it (the new review test included); **1,342 / 1,342** after the rebase on `5989563a` (lanes A and F).
- The dev server on 5506 stopped at the end; the PERF-LOCK released at 23:01 UTC; no Higgsfield spend.
