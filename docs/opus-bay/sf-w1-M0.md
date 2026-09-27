# sf-w1 lane M0: renderer foundation for city scale

Worktree: `C:/Users/willy/baylink-opus` (branch opus-bay). Nothing was committed. District mode draws exactly what it drew before: the hero regression test proves it byte for byte after every refactor step.

**Checks**

| check | result |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | 0 errors in my files. The only errors belong to other lanes, who are mid-edit: `actors/moveSystem.ts` (lane E) and `world/sf/landmarks/legion-of-honor.ts` (lane D). |
| `npx eslint` on every file I touched | 0 problems |
| `npx tsx --test tests/opus-bay-*.test.ts` | 142 / 142 pass. This is the 104 earlier tests, my 11, and the new tests from other lanes. |

---

## 1. Files

### New files

| file | what it holds |
|---|---|
| `tests/opus-bay-hero-regression.test.ts` | the hero regression test, plus the tests for `TypedBatch`, the recipes, the enums and the shader patches |
| `src/opus-bay/world/typedBatch.ts` | `TypedBatch` |
| `src/opus-bay/world/warmup.ts` | shader warm-up |
| `src/opus-bay/world/recipes/shapes.ts` | shared building parts, moved from `city.ts` |
| `src/opus-bay/world/recipes/palettes.ts` | building colours |
| `src/opus-bay/world/recipes/district.ts` | the hero lot recipe, moved from `city.ts` |
| `src/opus-bay/world/recipes/city.ts` | the city L0 and L1 buildings |

### Changed files

| file | change |
|---|---|
| `world/builder.ts` | New `BatchBase`; `Batch` extends it. |
| `world/materials.ts` | Normal and position under batching and instancing, window fade, city ground flag. |
| `world/water.ts` | Nyquist fades only. |
| `world/city.ts` | Now only assembles the district and builds the pier sheds and facades. It re-exports `obb` and `gableRoof` for `world/landmarks.ts`. |
| `game/GameRoot.tsx` | Far plane per world mode, warm-up, audio loaded lazily, start gated on the first frame. |
| `OpusBayPage.tsx` | Owns the title screen and saved-progress setup; loads the game on idle. |
| `ui/TitleScreen.tsx` | No `game/flow` import; takes `onStart` and `waiting` props; owns its own Enter/Space keys. |
| `ui/Overlay.tsx` | No title screen; lazy panels; new `startRequested` prop. |

### QA harness (outside the repo)

Location: `C:/Users/willy/opus-qa/m0/`.

- `recipe-scene.js` and `recipe-shot.mjs`: the test row of city buildings.
- `batched-scene.js` and `batched-shot.mjs`: rotated `BatchedMesh` and `InstancedMesh` copies.
- `prog-check.mjs`: shader program count before and after adding city meshes.
- `seed-scene.js`

---

## 2. How it works, and the API for other lanes

### 2.1 Hero regression (step 1)

`new World()` builds headless in node. The test stubs `document.createElement('canvas')`, so the pixels of the label atlas and the board shadow are left out. The label quads, including their UVs, are still pinned.

What is pinned:
- For every **static** mesh: the vertex count, the triangle count, and a sha256 over its raw attribute and index bytes, its instance data, its matrix, its material name, its render order and its shadow flags.
- The static meshes are:
  - sky, table and board-shadow;
  - labels and blob-shadows;
  - `ground#` / `city#` / `water#` chunks;
  - `hero:*`;
  - the two market meshes;
  - halos and lamp pools;
  - cones, crates, buoys and small boats.
- The terrain grid bytes.
- `World.stats`.
- Two builds must produce identical hashes.

Moving actors are **not** pinned: streetcars, ferries, gulls, pedestrians and fx. Other lanes own them.

**Baseline (re-measured, matches opus-arch):**
- 375,899 vertices;
- 232,511 static triangles;
- 62 chunks (26 ground, 27 city, 9 water);
- 87 meshes pinned;
- terrain hash `b7489cf5811ae266`.

**To update the baseline after an intended district change:**
```
OB_HERO_PRINT=1 npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-hero-regression.test.ts
```
Paste the printed table over `BASELINE`.

### 2.2 `world/builder.ts`

`BatchLike` is unchanged.

```ts
export abstract class BatchBase implements BatchLike {
  abstract get vertexCount(): number;
  abstract vert(x, y, z, nx, ny, nz, c: THREE.Color, info?: Info): number;
  protected abstract index3(a: number, b: number, c: number): void;
  protected abstract px(i: number): number;
  protected abstract pz(i: number): number;
  // add / addFlat / tri / quad / polygon / walls / prism / ribbon / beam are written once, here
}
export class Batch extends BatchBase  // same public pos / nor / col / inf / idx / uv / merge() / build()
```

### 2.3 `world/typedBatch.ts`: 36 B per vertex, safe to run in a worker

```ts
export interface TypedBatchArrays {
  vertexCount: number; indexCount: number;
  position: Float32Array;            // xyz
  normal: Int8Array;                 // xyzw (w = 0)
  color: Uint8Array;                 // rgba, linear, a = 255
  info: Float32Array;                // aInfo xyzw
  index: Uint16Array | Uint32Array;  // Uint16 when vertexCount ≤ 65535
  bounds: Float32Array;              // minX minY minZ maxX maxY maxZ
}
export class TypedBatch extends BatchBase {
  constructor(vertexCapacity = 4096, indexCapacity = vertexCapacity * 2); // grows by doubling
  get vertexCount(); get indexCount(); get triangleCount(); get byteLength();
  reset(): this;                                        // keeps capacity: one batch per worker job
  toArrays(): TypedBatchArrays;                         // trimmed copies, own buffers
  static transferables(a: TypedBatchArrays): ArrayBuffer[];
  static toGeometry(a: TypedBatchArrays): THREE.BufferGeometry; // no copies; bbox/sphere from bounds
}
```

**How the vertex data is packed.**
- **Position:** f32 × 3.
- **Normal:** i8 × 4, normalized. It is bound as a 4-component buffer to `vec3 normal`.
- **aInfo:** f32 × 4.
- **Colour:** u8 × 4 in memory, exposed to three as an `InterleavedBufferAttribute(itemSize 3, stride 4, normalized)`.

**Why three components for colour.** A 4-component `color` attribute makes three switch to its vertex-alpha program variant. With a 3-component view, TOY and GROUND compile the **same programs as the district**. I verified this: after adding city meshes built from `TypedBatch`, `renderer.info.programs` stayed at 44.

**Two costs to know about.**
- ANGLE's D3D11 backend converts 3-byte vertex formats on the CPU. It does this once per static buffer and then caches the result.
- `BatchedMesh.addGeometry` copies an interleaved colour one component at a time. Measure this in the L1/L2 pools.

**What was verified.**
- Positions and aInfo are exact float32.
- The normal error is at most 0.5/127 and the colour error at most 0.5/255 (colours are clamped to [0, 1]).
- Indices are identical to `Batch` output across all 13 styles, 60 district lots and a ribbon.
- The layout is exactly 36 B per vertex.

### 2.4 `world/materials.ts`

**Normal and position under instancing and batching (plan §1.6).**
- `vWN` = batching matrix, then instance matrix, then model matrix, with three's column-length correction for non-uniform scale.
- `vWPos` now also applies `batchingMatrix`.
- Plain meshes compute exactly what they did before.
- Checked visually: rotated `BatchedMesh` copies and rotated or non-uniformly scaled `InstancedMesh` copies show crisp, aligned windows by day and lit windows at night (`m0/batched-day.png`, `m0/batched-night.png`).

**Window fade (plan §5.5.2).**
- `unres = smoothstep(0.35, 1.2, max(fwidth(g)))`. When it is 0, the mask equals the old pattern exactly.
- As it rises, the mask moves to the mean coverage and the daytime glass colour moves to its mean.
- The night glow moves to its expected value: vacancy × 0.8 × 0.94 × 0.85 × the mean colour temperature.

**City ground flag (plan §5.5.4).**
- `export const GROUND_CITY = 1`.
- It goes in GROUND's `aInfo.w`, which is 0 on all district ground.
- A value ≥ 0.5 skips the hero-only `uBDist` contact-shadow lookup, in the same program. City ground should bake its contact AO into the vertex colour.
- TOY needs no flag: none of its lookups are hero-only.

### 2.5 `world/water.ts` (plan §5.5.3)

- The Nyquist fade `1 − smoothstep(.35, 1.8, fwidth(phase))` now applies to three things:
  - the fine normal ripples, which fade to 0;
  - the ripple lines, which fade to their mean of 0.082;
  - the glitter, which fades to its mean of 0.093.
- Up close there is no change: the fade factor is exactly 1.
- Far or grazing water is slightly smoother (`m0/cmp-far-golden.png`).
- Unchanged and worth knowing: a water vertex with `aDist ≥ 0` never samples the district shore texture. City water should supply `aDist`.

### 2.6 `world/recipes/`

All recipes are pure over `BatchLike` and safe to run in a worker. A test walks the import graph and allows only `three`, `builder`, `palette` and `core/geo`, and checks for no `document.` or `window.`.

**`shapes.ts`** exports:
- `WIN`, `winInfo(style, base, seed = 0)`;
- `obb(poly)`, `type Obb`;
- `gableRoof(b, r, y, rise, roof, gableWall, info, over = 0.22)`;
- `hipRoof(b, r, y, rise, roof)`;
- `flatRoof(b, poly, y, coping, roof, seed)`.

**`palettes.ts`** exports:
- the district sets `FACADES`, `RESID`, `ROOF_VIC`, `SHOP_*`;
- `CITY_WALLS[style]`: the fallback pools from visuals §3.2;
- the accents.

**`district.ts`** exports `districtBuilding(b: BatchLike, lot: BuildingLot, i: number, ground: GroundFn)`. The district passes `heightAt` as `ground`.

**`city.ts`**, aligned with lane A's `world/sf/format.ts`. A test keeps `STYLES`/`ROOFS` equal and checks that the flag bits don't overlap.

```ts
export const CITY_STYLES = ['victorian','edwardian','sunset','marina','chinatown','brick','deco','office','tower','industrial','civic','pier','residential'] as const; // = format.ts STYLES
export const CITY_ROOFS = ['flat','gable','hip'] as const;                                                                                                    // = format.ts ROOFS
export const CITY_FLAG = { shop: 1<<10, corner: 1<<11, glass: 1<<12, noClutter: 1<<13, front0: 1<<14 }; // hints in the free bits above BUILDING_FLAG (0–8)
export interface CityPalette { wall: string; roof?: string; trim?: string; accent?: string }
export interface CityBuildingSpec { poly: Vec2[]; baseY: number; H: number; style: CityStyle; roof: CityRoof;
  palette: number | CityPalette; seed: number; flags: number; front?: number }
export function cityLook(spec): CityLook;               // colours, window style, window seed (shared by both tiers)
export function toyBuildingL0(b: BatchLike, spec): void;
export function toyBuildingL1(b: BatchLike, spec): void; // oriented box + flat / gable / hip cap
```

**Style to recipe:**

| style | L0 recipe |
|---|---|
| victorian / edwardian | Bay windows on the street side (two on a wide front), eave trim and porch band (accent paint on some Victorians). A flat roof becomes an Italianate/Edwardian false front with a cornice ring. |
| sunset | Garage door, tile eyebrow, cream parapet. |
| marina | Iron balcony, tile hip roof. |
| chinatown | Painted balcony bands, accent parapet, sometimes a green pagoda pavilion on the roof. |
| brick | Stone cornice. |
| industrial / pier | Style-8 cargo doors and clerestory, trim band, gable with a skylight ridge, like the district's pier sheds. |
| deco / civic | Stepped crown; civic gets a heavier cornice and two steps. |
| office / tower | Setback tier, a crown on some, roof boxes. Towers add a penthouse, and a mast when H > 35. |
| residential | The district's plain lot. |

**Storefront.** `CITY_FLAG.shop` adds a shop-glass band, a trim ledge and a striped awning on the street side. Each awning is 4 triangles per stripe. `CITY_FLAG.corner` wraps the awning onto the next side as well.

**Other rules.**
- Windows always come from the TOY shader, with a per-building seed (−seed in `aInfo.z`).
- Walls start at `baseY − WALL_SINK`, using `core/geo`.
- The street side is chosen in this order: `spec.front`, then `CITY_FLAG.front0` (edge 0), then a short end chosen by seed.

**Building a spec from lane A's `BuildingSet` (for lane C's worker):**
```ts
const p = manifest.palettes[set.palette[i]];
toyBuildingL0(batch, { poly, baseY: set.baseY[i], H: set.height[i], style: CITY_STYLES[set.style[i]], roof: CITY_ROOFS[set.roof[i]],
  palette: { wall: p.wall, trim: p.trim, roof: p.roof }, seed: set.osmId[i], flags: set.flags[i] });
```

### 2.7 `world/warmup.ts` (plan §5.5)

```ts
export interface WarmupResult { ms: number; before: number; after: number }
export function programsCount(renderer: THREE.WebGLRenderer): number;
export async function warmPrograms(renderer, scene, camera, opts?: { offscreen?: boolean }): Promise<WarmupResult>;
```

- It runs `compileAsync` on a hidden set of dummy meshes that is never added to the scene. The real scene is passed as `targetScene`, so its lights, fog and shadow state go into each program's key.
- The dummy set:
  - TOY on a plain `Mesh` with `TypedBatch` geometry, `receiveShadow` on;
  - TOY on a `BatchedMesh`, `receiveShadow` off;
  - GROUND on a plain `Mesh` with city-flagged geometry;
  - GROUND on a `BatchedMesh`;
  - TOY_INST on an `InstancedMesh`, once with and once without `instanceColor`.
- `offscreen` means "render into a target", which is how the tilt-shift pass renders. It changes the tone-mapping key.
- `GameRoot` calls it about 250 ms after the world mounts, in both world modes. It calls it again when quality or reduced-motion changes.
- In DEV it exposes `window.__opusBay.warmup`.
- Measured in dev: +2 to +5 programs in 25–360 ms. That timing comes from the shared GPU and is not a performance number.

### 2.8 `GameRoot.tsx`

- `export default function GameRoot({ startRequested?: boolean })`.
- `camera.far` is 3000 when `worldMode === 'city'` and 1600 in district mode. Checked with an eval: 3000 in city mode, 1600 in district mode, near 0.5.
- `audio/audio` is imported dynamically when the module runs, so it becomes its own chunk.
- `<FirstFrame>` gates the title's Start: `startGame` runs only after the world has drawn a frame.

### 2.9 Bundle split (STATUS known issue #1)

- `OpusBayPage` renders `<TitleScreen onStart waiting>` inside `.ob-overlay.ob-title-layer` (z-index 3), so the existing CSS applies.
- It also initialises saved progress once, in a layout effect, so "welcome back" is right on the first paint.
- It loads `GameRoot` on `requestIdleCallback` after the first paint, or at once for `?start=` and `?solo=`, which skip the title.
- Start sets `startRequested`. The button shows a pulsing dot until the game starts.
- Map, journal, week and settings are `lazy()` chunks, prefetched 4 s into play.

Production build (`vite build --config vite.opus.config.ts`):

| chunk | before (min / gzip) | after (min / gzip) |
|---|---|---|
| OpusBayPage (the title now paints with the site shell plus this chunk) | 1.46 / 0.95 kB | 38.06 / 15.71 kB |
| GameRoot | 656.74 / 239.28 kB | 542.47 / 200.09 kB |
| audio | (in GameRoot) | 57.46 / 19.42 kB |
| MapPanel / Journal / WeekPanel / Settings | (in GameRoot) | 5.42 / 3.71 / 3.39 / 3.27 kB gzip |
| react-three-fiber + three | 233.62 kB gzip, needed before the title | unchanged, but no longer needed before the title |

**Effect on first paint.** Before, the title waited for about 473 kB gzip of JS beyond the site shell (GameRoot plus R3F). Now it waits for 15.7 kB. In dev, GameRoot was requested about 0.7 s after navigation.

**QA flows checked.**
- Title, then Enter, then the arrival cinematic.
- Clicking Start before the game chunk had loaded: the waiting dot showed, then the game started.
- `?start=free` at golden hour, night and mobile.
- The map opened with M, which uses the lazy chunk.

---

## 3. Evidence

All paths are under `C:/Users/willy/opus-qa/m0/`. I viewed every screenshot listed.

**District unchanged.**
- `before-*.png` and `after-*.png` for ferry-gate golden, coit-view golden, ferry-gate night, and far and low QA cameras.
- `cmp-far-golden.png`: before/after crops.
- `after-far2-night.png`.
- `final-district-coit.png`: the same composition as `before-coit-view-golden.png`.
- `final-mobile.png`.

**Recipes.**
- `recipes-golden-{0..4}.png`, `recipes-day-{0,1}.png`: the `Batch` and `TypedBatch` pair looks identical.
- `shop-day-{0,2}.png`: awnings and the aerial row.
- `styles-day-0.png`: industrial, civic, pier and residential next to the district's own pier sheds.
- `recipes-night-{0,1}.png`.

**Instancing and batching.** `batched-day.png`, `batched-night.png`.

**Bundle split.** `split-title.png`, `split-early-waiting.png`, `split-arrival.png`, `split-direct-night.png`, `split-map.png`, `split-title-mobile.png`.

**City mode.** `final-city-coit.png`.

**Tests** in `tests/opus-bay-hero-regression.test.ts`:
- district totals pinned;
- terrain grid byte-identical;
- every district mesh byte-identical;
- World builds deterministically;
- `TypedBatch` writes the same geometry as `Batch`;
- `TypedBatch` arrays and geometry layout, including the `BatchedMesh` round trip;
- budgets: house ≤ 250 and tower ≤ 600 for footprints up to 12 vertices with storefront and corner, L1 10–14;
- deterministic output, and L0/L1 share one look;
- enums match `format.ts`;
- worker-safe import graph;
- TOY and GROUND patches apply to three's standard shader.

**Triangles per building** (4-vertex footprint; "+shop" means shop and front0):

| style | roof | L0 | L0 +shop | L1 |
|---|---|---|---|---|
| victorian | gable | 58 | 82 | 14 |
| edwardian | flat | 84 | 96 | 10 |
| sunset | flat | 68 | 64 | 10 |
| marina | hip | 34 | 66 | 14 |
| chinatown | flat | 58 | 94 | 10 |
| brick | flat | 44 | 68 | 10 |
| deco | flat | 54 | 78 | 10 |
| office | flat | 68 | 92 | 10 |
| tower (45 u) | flat | 92 | 116 | 10 |
| industrial | gable | 38 | 70 | 14 |
| civic | flat | 64 | 88 | 10 |
| pier | gable | 38 | 70 | 14 |
| residential | gable | 18 | 50 | 14 |

**Worst case** (12-vertex footprint with storefront and corner):

| victorian / edwardian | chinatown | deco / civic | office | tower |
|---|---|---|---|---|
| 248 | 206 | 210 | 216 | 260 |

---

## 4. Decisions made without asking

- **The regression test runs headless in node,** with a canvas stub, rather than as a CDP script. It is fast (about 1.6 s) and needs no dev server.
- **Colour uses 3 of 4 bytes** so that TOY and GROUND keep one program each across district and city geometry. The alternative was a vertex-alpha program variant.
- **Recipe enums follow lane A.** Lane A published `STYLES` in `format.ts`, so the brief's `stucco` is `sunset`, and industrial, civic, pier and residential have recipes. The recipe hints use flag bits 10–14 so they never collide with `BUILDING_FLAG`.
- **Awnings are two quads per stripe,** not a box. This keeps the worst case for a house at 248 triangles, under 250.
- **The title's Start waits for the world's first frame,** so the arrival cinematic never plays over an empty canvas.
- **Saved-progress setup moved from `Overlay`'s `useBoot` to the page,** so it runs once, before the title paints.

## 5. Known gaps

- **No performance numbers.** Other lanes were sharing the GPU during my runs. The checkpoint should measure programs, warm-up time and upload cost.
- **Batched colour copy.** `BatchedMesh` copies the interleaved colour one component at a time. If lane C's L1 attach blows its 2 ms budget, I can add a variant of `toGeometry` with a plain colour attribute.
- **Warm-up covers only the current render path.** It re-runs when quality or motion changes; the first frame after a quality downgrade compiles the district's variants anyway, as it does today.
- **The street side is guessed by seed** when lane A gives neither a front edge nor `front0`. A storefront awning can end up on the back.
- **L1 gables have no eave overhang** (L0 has 0.22 u). The tier cross-fade should hide the swap.
- **Rotated district props look slightly different, correctly.** Instanced district props on TOY_INST now get the instance rotation in `vWN`. This changes contact AO on rotated cones, buoys and boats slightly. It is correct behaviour, and those instance matrices are pinned by the test.
- **The arrival foghorn can be lost.** If the audio chunk has not loaded when Start is pressed, the foghorn does not play. Audio then boots on the next gesture (existing fallback).
- **QA pitfall.** A page eval that does `import('/src/opus-bay/world/materials.ts')` gets a second module copy, because Vite adds `?t=` to modules after HMR. That copy's uniforms never update, so `uNight` stays 0 and windows look unlit. Take the app's own instances from scene objects instead, as my `m0/*-scene.js` scripts do.

## 6. Requests for other lanes

**Lane C (world):**
1. City L0 cells: plain `Mesh` on the shared TOY/GROUND with `receiveShadow = true` and `castShadow = false`.
2. L1/L2 `BatchedMesh` pools: `receiveShadow = false`.
3. Props: TOY_INST with `receiveShadow = true`.

   These three settings match the programs the warm-up compiles. If you need other variants, tell me and I will add dummies to `warmup.ts`.
4. City ground vertices: `aInfo.w = GROUND_CITY`.
5. City water: pass `aDist ≥ 0`.
6. Keep `tests/opus-bay-hero-regression.test.ts` green when you take `world.ts`, `WorldScene.tsx` and `environment.ts`. City mode may differ; district mode must not. If you mean to change district mode (for example the table), regenerate the baseline and say why.
7. You can call `warmPrograms` again after the first city cell attaches, as an assert: `after` should equal `before`.

**Lane A (data):**
1. Rotate each footprint ring so edge 0 faces the street and set `1 << 14` (`CITY_FLAG.front0`). It costs no bytes.
2. Set `1 << 10` shop (OSM shop, amenity, building=retail or commercial ground floor).
3. Set `1 << 11` corner.
4. Set `1 << 12` glass, for glass towers.
5. Keep `STYLES` and `ROOFS` append-only. A test compares them with `CITY_STYLES` and `CITY_ROOFS`.

**Lane G (UI):** show `programsCount` and `window.__opusBay.warmup` in the `?debug` overlay (`ui/Floating.tsx`). `world.stats().programs` already exists.

**Integrator:**
1. `STATUS.md` known issue #1 (page weight) is addressed; update the bundle table with §2.9.
2. The plan's "at most 2 headless Chromes" rule held: I ran one at a time.
