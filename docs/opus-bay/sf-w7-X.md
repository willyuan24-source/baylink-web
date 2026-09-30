# Wave 7 · lane X · Visuals, sound, voice (+ Higgsfield)

Worktree `C:/Users/willy/wt/w7-x` (branch `w7-x`), dev port 5710, scratch `C:/Users/willy/opus-qa/w7/x/`, ledger
`docs/opus-bay/ledger/w7-X.md`, QA files `docs/opus-bay/qa/w7/X/`. The only Higgsfield spender of wave 7 (cap 800,
floor 1400).

## 给主人的摘要

1. 市中心和唐人街不再是"灰蓝盒子楼"：金融区一带的老楼换成奶油色/石头色，立面有竖向壁柱和成对的窄窗（战前老楼的样子）；唐人街的楼每层窗下有红色、绿色（少数金色）的铁艺小阳台，一些楼正面挂着黑色消防梯（之字形楼梯）。夜里窗户照样会亮灯。
2. 城市模式白天的天空变蓝了，还飘着几朵圆滚滚的玩具云（在天空贴图里，不会"压在"楼上），会很慢地往东飘；黄昏和夜晚的天空保持原样；街区模式不变。
3. 城市里的海鸥换成真正海鸥的样子：白身体、黄嘴、灰色翅膀带"折肘"、黑色翼尖（还是同一个绘制调用）。
4. 手机性能：城市路人近处的精细小人在手机档（mid）上更早切换成远景小人、最多 8 个（原来 18 个），省下约 6–7 千个三角形。
5. （后续部分：语音与海滩冲浪者，见下文。）

## Part a · the downtown façades, the city's day sky, the gull, the phone's crowd (2026-09-29 20:25–21:50 PDT)

### What was built (W7-X1)

| file | change |
|---|---|
| `src/opus-bay/world/sf/look.ts` | `Facade` (`'prewar' \| 'chinatown'`), `facadeFor(b)`, `PREWAR_ZONES` (per DataSF zone: height caps and shares), `CHINATOWN_MAX_H`, `PREWAR_WALLS` (cream / white glazed terra-cotta / limestone / sandstone / buff), `CHINATOWN_FACADE_WALLS`; `sfLook` returns `facade` and the façade's wall / trim |
| `src/opus-bay/world/recipes/city.ts` | `CityPalette.facade`, `CityLook.facade`; `cityLook` paints `WIN.prewar` / `WIN.chinatown` (never over a glass curtain wall); L0's office / tower branch: a projecting cornice ring (pre-war, walls ≥ 6 u) or a coloured parapet (Chinatown) |
| `src/opus-bay/world/recipes/shapes.ts` (surgical, named) | `WIN.prewar = 9`, `WIN.chinatown = 10` |
| `src/opus-bay/world/materials.ts` (surgical, named) | TOY_FRAG: one new branch for styles 9 / 10 — pre-war bays (a light continuous pier with its shadow edge, a recessed column, two narrow lights split by a stone mullion, a spandrel panel and a sill line) and Chinatown walk-up windows with painted iron balcony railings (red / green / a little gold per building, 60 % of the upper windows) and, on half the buildings, a black fire escape down one column in three (platforms, rails, a zig-zag ladder); unresolved cells fade to their mean like the other styles; night occupancy / colour temperatures as the other styles. Styles 1–8 keep their exact code (test) |
| `src/opus-bay/world/sf/build.ts` (surgical, one line, named) | `specOf` passes `look.facade` into the palette |
| `src/opus-bay/world/environment.ts` | the city's day sky: `CITY_DAY_SKY` (morning 0.6, day 1, golden 0, night 0) blended like the presets into `uCityDay`; the sky shader mixes a bluer gradient (the horizon keeps the fog's haze) and `obPuffs` — toy cumulus of four round puffs with a flat belly, white top / blue-grey underside, in two rows of cells around the horizon (el ≈ 4°–27°), drifting slowly east. `uCityDay` is 0 in district mode (test) |
| `src/opus-bay/world/life.ts` | `cityGullGeometry()` (white head / body / tail, yellow bill, grey arm raised and swept forward to the wrist, the hand swept back and down, black tips; ≈ 230 triangles, every wing part flaps); `pickGullFigure(city)` swaps the gull mesh's geometry in city mode (the district keeps `gullGeometry`), shares its `aFlap` / `aPhase` |
| `src/opus-bay/world/sf/crowd.ts` + `world/sf/cityLife.ts` (one line, named) | `CROWD.nearBy` per quality (high 24 u / 18 — as before; **mid 16 u / 8**; low 12 u / 4), `CrowdLayer.setQuality(q)` called with the crowd count in `applyQuality` |
| `tests/opus-bay-w7-x.test.ts` (new) | 6 tests: façade zones / shares / walls, the recipe's window style on L0 + L1 and the triangle cost, the shader's untouched district branches, the sky weight per time of day (district 0, a blend with no pop), the gull's shape and colours, the crowd table |

Why these zones: the DataSF neighbourhood grid (the far data) puts the Dragon Gate, Union Square and most of the FiDi in
`financial-district-south-beach`; Chinatown proper (Grant / Stockton north of Bush) is `chinatown`. The pre-war share is
per zone (FiDi: 90 % of offices ≤ 12 u, 60 % up to 20 u; Tenderloin / Nob Hill similar; SoMa, North Beach, Russian Hill
lower). Lane A's data has no build year, so this is a look rule, not a claim about a given building.

### Evidence

- Fixed QA cameras (`C:/Users/willy/opus-qa/w7/x/shoot.mjs`: the same camera before and after; "before" = the files at
  `origin/opus-bay` checked out into the worktree, shot, then restored), desktop 1440 × 900 high:
  - `qa/w7/X/x1-dragon-gate-before-after.jpg` — the Dragon Gate's blocks: grey-blue office grids → cream / stone
    pre-war fronts with piers and paired windows. Phone 390 × 844 dpr 3 (mid): `x1-dragon-gate-phone-before-after.jpg`.
  - `x1-chinatown-before-after.jpg` and `x1-chinatown-balconies-crop.jpg` — Chinatown from above Grant Ave: railings and
    fire escapes read; the grey office boxes at the left edge are cream now.
  - `x1-coit-sky-before-after.jpg` (Coit Tower's terrace toward downtown) and `x1-ocean-beach-sky-before-after.jpg` — the
    flat beige sky → blue with toy puffs; the horizon haze and Karl's bank stay. `x1-ferry-sky-gulls.jpg` — the Bay
    Bridge from the Ferry plaza with a puff and the new gulls in flight.
  - `x1-night-chinatown-golden-coit.jpg` — night: the façade windows light like the others; golden hour: the palette's
    golden sky, no puffs (uCityDay 0).
- Calls / triangles (dev QA hook, desktop high, includes the shadow pass), before → after at the fixed cameras: Ferry
  plaza toward the Bay 67 / 212.4k → 67 / 210.8k · Dragon Gate 102 / 267.4k → 103 / 273.5k · Market St at Powell 123 /
  313.9k → 123 / 324.5k (the cornice rings; with the ≥ 6 u rule) · Chinatown 104 / 378.6k → 101 / 372.9k · FiDi from
  above 81 / 299.5k → 80 / 306.6k · Coit 90 / 333.7k → 87 / 331.4k · Ocean Beach 48 / 94.0k → 48 / 96.7k. The W5 perf
  spot `ferry-gate` (the triangle maximum, 35k headroom) with the player's own camera: 99 / 340.6k → 100 / 341.1k. **No
  new draw call, material or program** (the TOY program only grew a branch; the sky is the same mesh).
  Phone (mid) at the Dragon Gate: 75 / 211.0k → 75 / 212.3k.
- Checks before the push: `tsc` 0 · `eslint .` 0 errors (43 old warnings) · opus-bay suite (below).

### Decisions

- Shader styles and palettes before geometry (the brief; ferry-gate has 35k triangles free, Chinatown 28 calls): the only
  geometry is a cornice ring on pre-war walls ≥ 6 u and a parapet ring on Chinatown's offices (2 triangles an edge).
- The hero district (the hand-made Embarcadero slab: x −246…244, z −104…114, its 53 office lots) is **not** changed: it
  is built by `recipes/district.ts` exactly as in district mode, and the district must not change. So the brown-banded
  office boxes in the foreground from Coit Tower (Levi's Plaza) stay; see Requests.
- No Higgsfield asset for the façades: a texture would be a new material / program per kind and would not beat a
  resolution-free shader pattern at every distance.
- The cloud puffs live in the sky shader (infinitely far, never resting on the waterfront); they drift ≈ 0.034°/s.

### Known gaps

- The far tier (L2 prisms, > 520 u) keeps lane A's averaged wall colours, so a FiDi block turns a little greyer when it
  drops to L2 (at that distance windows are a mean tone either way).
- Pre-war vs modern is a seeded share per zone (no build year in the data): a few modern towers under 20 u get piers.
- The gull shape was checked in flight from the Ferry plaza (the tilt-shift blur softens birds at that distance); there
  is no close-up shot of a gull (the QA camera could not hold one in frame).

### Not done (part a)

- The hero district's own offices (see Decisions).

### Requests (part a)

- **Lead / W7-Z**: the façades add cornice / parapet rings downtown: at the fixed Market St camera +10.6k triangles
  (desktop high, incl. the shadow pass); the ferry-gate spot is unchanged (+0.5k). Please read the powell-market and
  chinatown rows of the gate with this in mind.
- **Lead (a later wave)**: the hero district's office lots (Levi's Plaza, the Embarcadero Center side) still wear the
  district's key-art pastels with the big office grid. A city-only pass over the hero batch (rewrite `aInfo.x` 2 → 9 on
  the hero's office walls when `mode === 'city'`, in `World.ts` before `toy.build()`) would give them the same pre-war
  face without touching district mode; it needs the lead's OK (World.ts / the hero build are frozen-adjacent).
