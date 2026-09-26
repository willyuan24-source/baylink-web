# SF research: GTA_SZ visual systems, what they cost, and how to use them in Opus Bay (KEY = gta-visuals)

Sources read: GTA_SZ `main @ 73603f3` (read-only clone at `C:/Users/willy/opus-qa/ref/GTA_SZ`). Paths below that start with `src/` or `docs/` are in that clone. `OB:` marks a path in `C:/Users/willy/baylink-opus/src/opus-bay/`. I also looked at the in-engine images (`docs/media/readme/futian-axis-day.jpg`, `luohu-night.jpg`, `street-walk-sunset.jpg`, `lianhua-hill-sunset.jpg`), their facade atlas, our baseline `opus-qa/sf0-baseline.png` and our key art `public/opus-bay/art/key-wide-1920.webp`. GTA_SZ is Babylon.js. Its code is MIT, so the ideas and short snippets below can be reused with attribution. Its textures, HDRs, GLBs and data can't be reused.

---

## 1. What GTA_SZ does, system by system (with cost)

### 1.1 Buildings

**Facade grammar: `src/city-facade-diversity.ts` (570 lines).** This is the main reason the city doesn't look like repeated boxes.
- **Per-building metadata in UV2.** An offline pass writes `TEXCOORD_1 = (family + 0.25, stable seed 0..65520)` on every ordinary wall vertex, and asserts that the values never vary within a triangle (`scripts/prepare_facade_diversity.mjs:114-115`). The shader reads it as a `flat varying` on WebGL2 (`:185-189`), so the seed never interpolates into "broken windows". The theme, glass tint, light colour and activity for each building are computed once in the vertex shader (`:152-181`, hook `:524`).
- **Themes.** There are 12 authored linear themes (`FACADE_THEMES`, `:17-30`), drawn from 4 weighted pools by use (`THEME_POOLS`, `:32-37`). Each building gets a wall shade of `.85 + mod(s*5,13)/12*.25` and a glass shade of `.91…1.07` (`:109`). Wall chroma was deliberately cut to 55% (glass to 75%), so that colour comes from light and signs rather than from every wall (`:10-16`, `docs/graphics/cinematic-finish-lookdev-2026-09-07.md`).
- **Atlas.** `facade-atlas.png` is 1024² RGBA with 8 families in a 4×2 grid of 256×512 tiles. Each tile has an 8 px gutter and 240×496 of content (`:276-279`). Alpha doubles as a roughness mixture: glass .333, wall .780. Glass coverage is recovered continuously after mip filtering: `glazing = (.780-a)/(.780-.333)` (`:337`).
- **World-metre UV.** The Blender export writes UV0 as `(edgeLength/24, z/24)` (`scripts/city_mesh.py:68`). The shader then computes `pattern = uv*24/period + phase`. `period` is metres per atlas repeat for each family, for example 14×19.2 (`:256-264`). `phase` is a hash of the seed and the quantised face normal (`:265-275`). Their own audit found that "every wall starts at U=0" made every building repeat the same window and the same lit pane (`docs/建筑重复审计-本轮.md`). The phase hash is the fix.
- **Mip-safe sampling.** Derivatives are taken on the continuous pattern before `fract`, then passed to `textureGrad`, so tile seams can't trigger a 200 px mip footprint (`:280-289`).
- **"Unresolved" fade to the mean.** `unresolved = smoothstep(.35,1.2,|d(cell)/dxy|)` (`:341-346`). Below pixel size, the surface fades to that family's precomputed mean albedo and glass coverage (`:400-412`; means hard-coded at `:402-404`). Emission filters horizontal suites and vertical floors separately (`:451-463`). This is what stops windows from shimmering or turning into moiré on distant towers. It costs a few ALU and no extra fetches.
- **Night occupancy is hierarchical, not per-pane noise.** A floor group is lit first, then a suite, then the whole floor, plus a sparse "normal fill" (`:125-147`, GLSL `:440-449`). Offices group 3–5 bays × 2 floors and homes group pairs of windows (`:127-128`). Probabilities: office floor `.36+.30a` and suite `.35+.20a`; home floor `.73+.15a` (`:113-115`). Normal fill is .06 at dusk and .10 at night (`:50`). Office and home colour-temperature sets are `OFFICE_LIGHTS`/`HOME_LIGHTS` (`:38-39`). Six HDR radiance levels run from 1.10 to 2.10 (`:88`). On top of that are rare saturated red/green/blue panes, 6 per 24×16 motif (`:40-45`). In `luohu-night.jpg` these read as confetti.
- **Cheap "architecture" on the same draw call.**
  - Ground-floor walls drop to 72% reflectance below 9 m.
  - Image-based light at the base is cut to 42% and recovers by 28 m (62% by day) (`:80, :353-362`).
  - 55% of offices get a louvred plant floor.
  - Glazing sits 10 cm behind the wall plane. A surface-gradient bump from `dFdx` of that height field (`:217-233`) plus a 1024² relief atlas (RG slope, B AO/streak, A frame; `:83`, `:383-399`) makes mullions catch low sun.
  - Each pane tilts up to ±0.45°, so glass towers reflect the sky as a mosaic.
  - 28% of panes show a daytime blind (`DAY_BLINDS`, `:87`, `:366-370`).
  - A 4-tap same-facade window bounce is added (`:493-497`).
- **Cost.** 0 new draw calls. There are 3–4 atlas fetches per wall pixel, plus 4 bounce taps at dusk and night. The extra texture memory with mips is about 12.6 MB (`:565`). The plugin attaches to the existing wall material (`:549-562`), and the textures sit on a fallback until they are ready (`:552`, defines `:510-516`).

**Other building materials: `src/city-architecture-materials.ts`.** The whole city uses at most 31 cached PBR materials: 28 profiles plus no-UV variants (`:16-47`). Loaded albedo textures over 1024² and window masks over 256² are rejected (`:148-154`, `:168-174`). A window mask may only emit when it matches its own albedo (`:198`, `:204-218`). Emission is 1.35 at night, .45 at dusk and 0 by day.

**Roofs: `src/city-roof-surface.ts` + `src/city-rooftop-plan.ts`.**
- Every building gets one of 8 finishes (membrane, concrete, pale cement, gravel, terracotta, green roof, TPO, red tile; `ROOF_FINISHES`, plan `:36-45`), chosen by footprint, height and use (`:130-137`).
- The finish is stored in a city-wide R8 lookup at 4 m/px (3399×1307), encoded as `1 + finish*16 + tint` (`:220-221`).
- The shader reads that lookup once, tiles a 512² detail texture (seams, grain, stains, height) in world XZ with an 8 m period, and adds a derivative bump (`roof-surface.ts:56-71`).
- 0 geometry.

**Rooftop props: `src/city-rooftops.ts`.**
- 14 prototypes live in one 266 KB GLB (3,634 triangles): helipads, plant rooms, cooling towers, tanks, antennas, solar, skylights, vents and crown screens.
- They are placed offline inside an inscribed rectangle on each roof (`plan :139-215`).
- At runtime they are thin instances selected from 200 m cells in ring order under a radius and count budget: large props 950/1750 m and 5000/9000 instances; small props 380/650 m and 2500/4000 instances (`:122-132`). Each instance gets a tint (`:134-140`).
- Buffers rebuild only after the camera moves 22 m (`:202-234`), and only large kinds cast shadows (`:236`).

**Signs.**
- `src/city-building-signs.ts` keeps one 2048×1024 `DynamicTexture` (8×8 cells of 256×128) and one merged mesh, so signs cost one draw call.
- Only the 64 best signs are live. Scoring is by projected letter height (≥ 2.4 px) and facing (≥ .16) (`:15-34`), and reselection runs at most every 350 ms (`:106`).
- The fragment shader discards back-facing signs and fades text in over 2→7 px of letter height (`:3`).
- Fictional brands carry a mandatory disclosure (`:41`).
- `src/landmark-signage.ts` handles 3 evidence-gated real signs: alpha-test .40, emissive only at dusk and night (`:16-20`, `:100-105`, `:186-191`).

### 1.2 Light, sky and post

- **Look presets (`src/city-cinematic.ts:74-84`).** The direct:fill ratio is held near 4–5:1 (`:67-73`).
  - Sunset: sun 1.4, hemi .12, environment .40, exp² fog .00011/m, bloom threshold 1.35, weight .19.
  - Night: sun .30, hemi .08, environment .55.
  - Day: sun 3.0, hemi .28, environment .78, fog .000045, bloom 2.5/.045.
  - The fog is tuned so that ridges 3–6 km away lose contrast (`:273-276`).
- **Photographic sky and IBL.**
  - Three HDRs, each decoded and prefiltered once: Belfast sunset 17.4 MB, Rustig blue sky 15.3 MB, rooftop night 6.5 MB (`:138, :155, :187`; `city-daylight.ts:5-11`; `city-sunset-environment.ts:7-13`).
  - The sunset cube is regraded on the CPU into a "fire hemisphere" with a deep-indigo anti-solar side, which also serves as the shade-side fill (`city-sunset-environment.ts:30-62`).
  - The display copy is an 18 MiB gamma-encoded RGB8 cube (`:64-91`).
  - The daylight sun is soft-clipped above luminance 8 (`city-daylight-environment.ts:8-11`).
  - The night sky is procedural (galaxy band, stars, moon with maria) in a single draw, plus a 32² neutral cube for night reflections (`city-night-sky.ts:9-90`).
- **Post.**
  - ACES tonemapping. Street view uses MSAA 4× with FXAA off. Grain 6.5, vignette 1.0 and edge-weighted chromatic aberration 1.8 are on at dusk and night only (`:36-45`).
  - The aerial view switches to MSAA 1 plus FXAA: "4× MSAA … ~7 ms of GPU at 1080p against ~1 ms for FXAA". From the air, shading shimmer on window grids is the visible aliasing, and MSAA doesn't fix it (`:46-51`).
  - The scene target is half-float. SSAO runs at half resolution with a 2.5 m radius.
  - Grain and chromatic aberration each cost a full 1080p pass.
  - Toggling AA used to trigger four material-dirty flushes of about 35 ms each; the fix batches them into one `prepare()` (`:52-66`, `docs/性能修复-2026-09-09-着色器重编译.md`).
- **Shader-stability contract.** In Babylon, toggling a light, a shadow or a light cap recompiled 73–121 programs and caused 0.6–1.1 s hitches with holes in the image. After the fix, lights stay enabled and fade by intensity only; receivers are classified once; the PCF slot stays compiled (`city-local-lighting.ts:56-65`). The same rule applies to three.js: never change the light count, shadow flags or defines while walking.
- **Local and public lamps.**
  - Two pooled spotlights jump between real fixtures: night intensity 600, dusk 60, range 46, one 1024 PCF shadow map refreshed every 2 frames, at most 48 casters (`city-local-lighting.ts:12-22`). Measured cost: GPU 12.27 → 14.87 ms, draw calls 1084 → 1106.
  - All other lamps go into a world-space irradiance clipmap: a 1024² `DynamicTexture` covering 2048 m at 2 m/texel. It is re-rasterised with canvas radial gradients (radius 20 m, colour [1,.65,.34], power .72) only when the camera enters a new 256 m cell. Ground materials add `albedo*lux*3.6*max(0,n.y)`, which is incident light rather than an emissive decal (`city-public-lighting.ts:13-19, 34, 38-46`). The cost is one fetch.
  - Night terrain gets a faint emissive floor of .07 (grass .05) (`city-landscape-lighting.ts:20, 26-35`).
- **Landmark windows without UVs.** Pane quads are recovered by union-find over the index buffer, and a vec4 attribute (uv, warmth, active) is baked once (`city-landmark-lighting.ts:12-40`).

### 1.3 Ground, water and vegetation

- **Water: `src/city-bay-water.ts`.**
  - A PBR plugin over a planar `MirrorTexture`. Mirror resolution is 256/384/512 by quality, refreshed every 1–3 frames (`city-graphics-quality.ts:5-7`).
  - Waves: 4 sine fronts on phases warped by 18 m at two scales (`:61-76`). Each frequency is faded before Nyquist with `1-smoothstep(.35,1.8,fwidth(phase))` (`:77-81`) and attenuated from 80 to 1100 m (`:84`). Slope energy that can no longer be resolved is added back as roughness (`:55-59, :89`).
  - Mirror lookups are perturbed by the wave normal (`:40-44`), with a footprint-based reflection LOD (`:45-54`).
  - Colour: shallows over 2–62 m (`:91`), foam over 1.5–6 m.
  - Far water blends into the sky-cube colour along a horizon ray, only at 1.8–14 km and only at grazing angles (`:20-38`).
  - A 4-quad ring extends the sea to ±50 km (`:116-122`).
- **Roads: `src/city-road-surface.ts`.** A scanned asphalt normal map (1024²) and ORM map (2048², ×8 repeats), 26.7 MiB with mips (`:7-10, :146-148, :170`). Per-mode albedo, specular and roughness values change for rain (`:14-23`).
- **City-scale AO: `city-ambient-bake.ts` + `city-ambient-occlusion.ts`.**
  - An offline horizon scan over rasterised footprint heights: 4 m cells, 24 directions with 4 hashed rotation phases per cell, and 20 steps out to 200 m.
  - For each direction it keeps the maximum slope `tanθ` and computes Lambertian sky visibility as `1/(1+tan²θ)`. Cells inside a building ignore that building (`bake :8-20, :54-68`).
  - Three receiver heights (0 / 12 / 40 m) go into RGB (`occlusion.png`, 3399×1307, 2.6 MB), and the shader interpolates between them by height.
  - Strength is ground .85, walls .60 (sampled 2 m inside the wall), roof .70. It applies fully to image-based light, and to direct light at .30 by day, .24 at sunset and 0 at night (`occlusion :19-24, :62-71`).
  - Cost: one fetch, no pass.
- **Vegetation.**
  - *Planting.* Roadside trees are planned offline under hard budgets: at most 3000 in total and 16 per 200 m cell, spaced 17–23 m by road class. 28% become tall "skyline trees" scaled 1.42–1.70 at no geometry cost (`city-roadside-planting.ts:25-35, :163-214`).
  - *Canopy* (`city-canopy.ts`): 45,626 trees from 6 species × 3 LODs (1.9–4k, 0.5–1.7k and 80 triangles; 18 GLBs, 713 KB total). LOD switches at 170 and 650 m (`:15-25`). When a tier's budget is spent, trees are demoted to the next tier rather than dropped (`:101-104`). Each tree gets its own tint (`:118-119`), and only the near tiers cast shadows (`:127-130`). Measured cost is 1–5 fps, mostly in the shadow pass (`docs/graphics/canopy-trees-2026-09-17.md`).
  - *Grass* (`city-grass-material.ts`): the lawn texture is sampled twice with a rotated, scaled second lookup (`mat2(.8,.6,-.6,.8)*uv*.83`), which kills visible repetition (`:48-49`). Normals fade out between 24 and 110 m (`:45, :72-84`).
  - *Meadow* (`city-meadow.ts`): blade clumps whose size fades to zero in the vertex shader instead of popping (`:113-128`).
- **Street furniture.** Only the 12 nearest benches within 150 m are shown, as thin instances in 3 draw calls, rebuilt after an 18 m move (`city-street-furniture.ts:18-24`).

### 1.4 Far field, quality presets and asset weight

- **Distant shells: `src/city-distant-city.ts`.**
  - Footprints are extruded into 640 m tiles (`city-distant-geometry.ts:8`) with one PBR material. Windows are procedural in world space: 3.2 × 3.3 m cells, 3×2-cell rooms, about 52% occupied, fading to .18 when unresolved (`:22-37`).
  - Shells are shown only from the air, beyond 3300 m (`:6, :63-68`).
  - Cost: 462,533 triangles, 34 MiB of buffers, 155–292 ms to initialise.
  - The team later dropped the grey shells because they looked worse than the real buildings (`docs/graphics/distant-city-2026-09-06.md`, `city-quality-sport-2026-09-06.md`). **Lesson: far LOD must keep the palette and roofs, not just the silhouette.**
- **Coastline skirt.** The boundary edges of the terrain mesh are welded and extruded below the water line (`city-coastal-horizon.ts:15-60`).
- **Near-plane fix.** Land (y = 0) and sea (−0.25) flickered through each other from the drone. The fix raises the camera near plane with its clearance above the scene, up to 128 (`docs/graphics/sea-depth-2026-09-06.md`).
- **Quality presets** (`city-graphics-quality.ts:4-8, 22-26`):
  - Pixel cap 1600×900 or 1920×1080, DPR at most 1.5.
  - Shadows 1024 or 2048; MSAA 1, 2 or 4; bloom scale .25 or .5.
  - Tree budgets per tier.
- **Weight.** `public/city` is about 340 MB. `buildings.glb` alone is 49.8 MB for 16,076 buildings and 3.3 M triangles; `facades.glb` is 29.8 MB; `street-surfaces.json` is 36.6 MB. Our first-load budget is 3 MB, so none of their asset pipeline transfers. Only the techniques do.

### 1.5 What the images show

- **Strengths.**
  - Depth layering: city, then canopy, then hazy hills (`futian-axis-day.jpg`).
  - A night skyline full of plausible, grouped lit floors (`luohu-night.jpg`).
  - Dense park canopy as lollipop blobs (`lianhua-hill-sunset.jpg`).
  - Dramatic HDR skies.
- **Weaknesses.**
  - Close up, many buildings are still textured boxes with flat roofs.
  - The rare RGB panes read as noise.
  - Trees are identical blobs.
  - The street level (`street-walk-sunset.jpg`) is photographic and orange-graded. That is the opposite of our look.

What we should copy is the **systems**: per-building seeds, grammar atlases, hierarchical occupancy, unresolved fades, baked city fields, budgeted instancing and a far LOD that keeps colour. We should not copy the photo-real surface finish.

---

## 2. Where Opus Bay stands, and what breaks at whole-SF scale

- **Materials.**
  - Everything static goes through two `MeshStandardMaterial`s with vertex colours plus `onBeforeCompile` (OB:`world/materials.ts:98`, `:296-311`).
  - Windows are fully procedural from world position: `u = dot(xz, tangent)`, `v = y - base`. The six styles differ only in cell size and rectangle (`:248-281`).
  - Night occupancy runs 25–60% per building, with whole floors dark, three colour temperatures and curtains (`:272-280`).
  - Contact AO at the wall base (`:288`) and a baked distance field for ground contact shadows (`:188-194`, OB:`world/water.ts:87-112`).
- **Anti-aliasing.** There is edge AA (`fwidth(g)*0.8`, `:263`) but **no fade to the mean**. Seen from Twin Peaks or Coit, every window grid, the ripple lines (OB:`water.ts:286`) and the glitter (`:295`) will alias.
- **Instancing bug.** `vWN` is computed at `#include <beginnormal_vertex>`, before three.js applies `instanceMatrix` (OB:`materials.ts:69`). Windows or facades on *instanced* houses would get the wrong tangent. It is harmless today only because `TOY_INST` draws floats, boats and dogs (`:317-321`).
- **Geometry.** All buildings are unique, merged geometry: 239 lots, rebuilt at load in about 0.5 s (OB:`STATUS.md`).
  - At toy scale, one toy house stands for about 4 real 25 ft lots: Victorian lots are about 4.6 u wide (OB:`data/district.ts:894`), windows are 1.15 × 2.35 u (`materials.ts:258`), and floors are 2.5 u.
  - Whole SF at 0.14 u/m is about 1,554 × 1,582 u (Ocean Beach to the Embarcadero, Fort Point to the county line). That is about 2.4 M u² of land, and about 2,220 u square once the −46° rotation is applied (`district.ts:43-44`).
  - With about 160–180k real footprints (DataSF) divided by about 4, that is **about 40k toy buildings**. Built the current way, that means about 80 s of build time and several million triangles.
- **Budgets and bounds that don't fit a whole-city view.**
  - Camera far plane 1600 (OB:`game/GameRoot.tsx:29`).
  - Table radius 2600, with darkening at 220–700 u (OB:`world/environment.ts:158-160`).
  - Fog `FogExp2` .0012 at golden hour (OB:`world/palette.ts:106`). At 1000 u that is already 76% fogged.
  - Shadow frustum ±24 u (`environment.ts:248`).
  - The skyline backdrop is 26 random boxes (OB:`world/backdrop.ts:392-407`).
  - Trees and palms are merged into the static batch at about 140 and 540 triangles each (OB:`world/props.ts:60-107`).
  - Each lamp adds two halos and a pool quad (`props.ts:123-139`).
- **Post** already matches GTA_SZ's street finish (OB:`world/post.ts`): a half-float MSAA 4× target, a quarter-resolution bloom (`:102, :151`), 14-tap tilt-shift, vignette and grade, with `NeutralToneMapping` (OB:`WorldScene.tsx:46`).

---

## 3. Translating the techniques to the warm toy-diorama look

### 3.1 Instanced archetype houses with an SF facade atlas (adopt and adapt the facade grammar)

Keep the silhouette in geometry: box, gable or parapet, a bay-window box and a stoop. Move the detail into a painted atlas, sampled on **instanced prototypes**. There is one `InstancedMesh` per archetype and LOD tier. Per instance: the matrix scale carries width, height and depth; `instanceColor` carries the body tint; and `aHouse` is a vec4 of (family, seed, accentIdx, roofFinish).

- **Atlas A.** 2048² sRGB RGBA. RGB is albedo detail; A is the body-paint mask.
- **Atlas B.** 1024² linear RGBA. R is glass, G the accent-paint mask, B cavity AO, A relief height.
- **Layout.** 8 low-rise families in a 4×2 grid of 512×1024 tiles at about 100 texels/u. The default camera (15 u, 42° vertical FOV, OB:`actors/camera.ts:26-28`) sees about 78 px/u, so this is roughly 1:1.
- **Tile zones, in texel rows from the bottom.**

  | zone | rows | toy size |
  |---|---|---|
  | ground: garage, stoop or storefront | 0–300 | 3.0 u |
  | floor A | 300–550 | 2.5 u |
  | floor B | 550–800 | 2.5 u |
  | cornice, false front or gable fascia | 800–1024 | 2.24 u |

  This is a 3-slice facade: each floor alternates A and B, so a building of any height from 2 to 5 floors reuses the same tile.
- **Gutters.** 16 px on each side (at 2048, mip 4 still has 1 px), as in GTA_SZ (`src/city-facade-diversity.ts:278`).

```glsl
// OB:world/facade.ts → appended to TOY_FRAG for families >= 9 (after '#include <color_fragment>')
uniform sampler2D uFacA, uFacB;      // bound to 1x1 placeholders until loaded → never recompiles
uniform float uFacOn;                // 0 → keep procedural windows (materials.ts:248-281)
uniform vec4  uFam[8];               // x module W, y ground G, z floor F, w cornice C (u)
uniform vec4  uFamMean[8];           // linear mean albedo, a = mean glass (offline, from the atlas)
varying vec3  vLocal;                // prototype-local position × instance scale (u), front face = +z
varying vec4  vHouse;                // family, seed, accent, roof
vec2 facUV(float fam, float u, float v, float H, out float floorId) {
  vec4 f = uFam[int(fam)]; floorId = -1.0; float tv;
  if (v < f.y)            tv = v / f.y * 300.0;
  else if (v > H - f.w)   tv = 800.0 + (v - (H - f.w)) / f.w * 224.0;
  else { float k = (v - f.y) / f.z; floorId = floor(k); tv = 300.0 + mod(floorId, 2.0) * 250.0 + fract(k) * 250.0; }
  vec2 tile = vec2(mod(fam, 4.0), floor(fam / 4.0)) * vec2(512.0, 1024.0);
  return (tile + vec2(16.0 + fract(u / f.x) * 480.0, tv)) / vec2(2048.0);
}
// in main: u = vLocal.x + 0.5*width (mirrored when hash(seed) > .5), v = vLocal.y
vec2 duvdx = vec2(dFdx(u) / uFam[fi].x * 480.0, dFdx(v) * 100.0) / 2048.0;  // derivatives BEFORE fract
vec2 duvdy = vec2(dFdy(u) / uFam[fi].x * 480.0, dFdy(v) * 100.0) / 2048.0;
vec4 A = textureGrad(uFacA, uv, duvdx, duvdy), B = textureGrad(uFacB, uv, duvdx, duvdy);
float unres = smoothstep(0.35, 1.2, max(length(vec2(dFdx(u), dFdy(u))) * bays / uFam[fi].x,
                                        length(vec2(dFdx(v), dFdy(v))) / uFam[fi].z));   // GTA_SZ :341-346
vec3 paint = mix(A.rgb, A.rgb * diffuseColor.rgb, A.a);            // diffuseColor already × instance tint
paint = mix(paint, A.rgb * uAccent[int(vHouse.z)], B.g) * mix(1.0, B.b, 0.8);
diffuseColor.rgb = mix(paint, uFamMean[fi].rgb * diffuseColor.rgb, unres * 0.85);
// night: reuse the existing per-building occupancy hashes, gated by glass, fading to expectation
vec2 cell = vec2(floor(fract(u / uFam[fi].x) * bays), floorId);
float lit = litCell(cell, vHouse.y);                                 // materials.ts:273-279 logic
totalEmissiveRadiance += temp * uNight * mix(B.r * lit, uFamMean[fi].a * occMean, unres) * 1.1;
```

**Vertex side (fixes the `materials.ts:69` issue).**
- Scale is `s = (|im[0]|, |im[1]|, |im[2]|)`, `vLocal = position * s`.
- `vWN = normalize(mat3(modelMatrix) * (mat3(instanceMatrix) * (objectNormal / (s*s))))`.
- Side and party walls, where the local normal is not +z, get a plain stucco or shingle band plus the occasional mural panel. Blank lot-line walls are a signature SF look on hills.

**Cost.**
- 2 fetches plus about 35 ALU per wall pixel. GTA_SZ pays 3–8 fetches (`:333, :377, :388, :467, :495`).
- Memory: A with mips is 21.3 MB on high and 5.3 MB for the 1024² version on mid and low; B is 5.3 MB.
- Download: about 1.2–1.8 MB of WebP, lazy-loaded after start. Until it arrives, procedural windows keep working, like GTA_SZ's fallback-until-ready (`city-architecture-materials.ts:141-193`).

**Towers (FiDi, SoMa, Mission Bay).** A second 1024² atlas holds 4 tiles of 512², each exactly 2 bays × 2 floors that repeat in both directions, with the GTA_SZ phase `hash(seed, quantised normal)`. Glass gets an analytic sky reflection in place of an environment map:

```glsl
vec3 R = reflect(-V, n);
mix(uHorizon, uTop, pow(smoothstep(0., .62, R.y), .75)) * fresnel
```

It uses the same function as the sky shader (OB:`environment.ts:56-100`), plus the ±0.45° pane tilt from GTA_SZ `:226-230`.

### 3.2 Per-building theme variety

Apply GTA_SZ's weighted pools per family, but in our palette. Tints are chosen on the CPU into `instanceColor`. Brightness jitter is ×0.94–1.06, which GTA_SZ widens to .85–1.10 (`:109`). An accent comes from a 16-entry uniform table.

| family | body pool (sRGB) | trim / accent |
|---|---|---|
| Victorian | PAL.victorian `#f2c9b1 #cfe0d0 #f4e2a8 #c9d6e8 #e8c6cf` + `#d9c8e6 #b9d3cf` | trim `#fbf6ec`; accent `#2f8f88 #d8744a #7a5a8c #c9a14a` |
| Edwardian | `#efe4d0 #e6d6bd #dfe3dc #e9d5c9` | white trim, dark door |
| Sunset "Doelger" | `#cfe6d8 #f6d7c3 #cfe0ee #f4e7b8 #f1d0d6 #efe7da` | cream relief, terracotta tiles |
| Marina | `#f3ead8 #f1dcc8 #e9e1d3` | `#c46a4a` tile, iron `#3b3f3c` |
| Chinatown | `#ece2cf #e6d0b8` | `#b8463c #2f7d5a #d9a441` |
| SoMa brick | `#b56e55 #a8644c #9b5b47 #c08463` | `#dcc6a8` stone |
| Mission | Victorian pool + `#f0b15a #e57b5e` | mural panels |
| Deco (Nob, Russian, North Beach) | `#efe6d6 #e6dccb #e9e2d4` | `#d9cdb8` |

High chroma is reserved for Victorian, Sunset and Mission. FiDi and SoMa stay neutral, as GTA_SZ's 55% chroma lesson suggests. Night light sets follow `HOME_LIGHTS` [1,.57,.26]–[1,.78,.58] and `OFFICE_LIGHTS` (GTA_SZ `:38-39`). Drop the RGB confetti. Instead, add a 1.5% cool "TV" pane `vec3(.55,.7,1.)` and, on high tier, a 28% daytime lace-curtain pale pane (`DAY_BLINDS` idea, `:87`).

**Archetype assignment.** Classify offline from (neighbourhood polygon, year built, floors, use), rather than from height alone. GTA_SZ's audit found tall residential towers mislabelled as offices because the class came from height.
- Pre-1906 → Victorian.
- 1906–1925 → Edwardian.
- Sunset or Parkside 1925–1955 → Doelger.
- Marina → Marina.
- Chinatown polygon → Chinatown.
- SoMa + industrial use → brick.
- Mission → Mission.
- Nob, Russian Hill and North Beach multi-unit → Deco.
- Over 8 floors → tower atlas.

### 3.3 Roofs and roof props

The camera looks down at 16–50° (`camera.ts:28`), and every viewpoint (Coit, Twin Peaks, Bernal) is a rooftop view. That makes roofs worth more to us than to GTA_SZ.
- **Finish.** Put the finish in `aHouse.w`. The TOY shader then branches when `vWN.y > .6`: tar-and-gravel noise, membrane seams, a dark light-well inset rectangle drawn procedurally at the roof centre for flats, solar-panel stripes, or terracotta courses for Marina and Doelger.
- **Detail texture.** Tile one 512² roof detail texture in world XZ with a 1.2 u period. Build it procedurally in Python (seams R, grain G, stains B, height A), like GTA_SZ's `roof-detail.png` (`city-roof-surface.ts:61-68`). This needs no lookup raster, because we own the per-instance attribute.
- **Props.** 8 instanced kinds: chimney pair, skylight, roof-deck rail, solar array, HVAC box, elevator penthouse, water tank (rare, SoMa only) and antenna. Place them offline into an inscribed rectangle (GTA_SZ `city-rooftop-plan.ts:71-122`). At runtime, budget them like `city-rooftops.ts:122-132`: large props within 120 u (1,500 instances), small within 60 u (600), rebuilt after a 16 u move. Only the large kinds cast shadows.

### 3.4 Instanced trees, lamps and furniture

- **Trees.** 3 toy species: street round-crown, Monterey cypress/pine for the Presidio, Golden Gate Park and Sutro, and palm for the Embarcadero and Dolores. Each has 3 tiers:

  | tier | triangles | distance |
  |---|---|---|
  | full | 120 (palm LOD0 cut from 540 to 180) | ≤ 70 u |
  | mid lollipop | 20 | ≤ 250 u |
  | far | none (merged canopy blobs per park polygon, part of the far city) | beyond 250 u |

  Budgets are 300, 1,200 and "far". Demote to the next tier rather than drop (GTA_SZ `city-canopy.ts:101-104`). Each tree gets an `instanceColor` tint of ±12%.
- **Pop-in.** Instances "grow" instead of popping: scale `positionUpdated *= fade` over the last 15% of the ring radius, as GTA_SZ does for grass (`city-meadow.ts:117-127`). A pop-up-book grow is on-brand for a toy.
- **Placement.** Plan offline from the DataSF street tree list (about 190k records) downsampled to 1 per 4, plus park fill at about 1 per 30 u², with crown-clearance vetoes against roads, lots, the shore and junctions (GTA_SZ `city-roadside-planting.ts:136-159`). Mark 28% as "tall".
- **Furniture** (lamps, benches, hydrants, bins, Muni-style shelters, bollards). One `InstancedMesh` per kind. Keep the nearest N per kind within 60 u (lamps 64, benches 24, others 32), rebuilt after a 12 u move (`city-street-furniture.ts:18-24`).

### 3.5 Baked city rasters: sky-visibility AO plus baked sun shadows for the four presets

Bake offline with a Node script, over the toy lot heights *and* the terrain `heightAt`. Hills matter in SF: Noe Valley should sit darker than Twin Peaks. Use 2 u/texel on high tier and 4 on low, in the slab's own rotated frame, so the −46° rotation doesn't waste 40% of the raster.
- `uCityAO`, RGB: sky visibility at 0, 3 and 10 u above the ground. GTA_SZ's recipe applies: 24 directions × 4 phases, 20 steps to 60 u, `1/(1+tan²)` (`city-ambient-bake.ts:54-68`).
- `uCitySun`, RGBA: sun visibility for the morning, day, golden and moon directions. Our sun directions are fixed per preset (OB:`palette.ts:87, 95, 104, 113`) and blend linearly (`environment.ts:258`), so a preset blend is just `dot(sample, weights)`.
- Size at 2 u/texel is about 1,100²: roughly 5 MB of GPU for RGBA and 4.9 MB for AO (padded).
- This gives every roof and street in a 1,600 u overview a readable golden-hour shadow at the cost of one fetch, where the real-time map covers only ±24 u.

```glsl
vec2 cuv = (uCityXf * vec3(vWPos.xz - vWN.xz * 0.6, 1.0)).xy;   // rotated frame; walls sample 0.6 u inside
float sunVis = dot(texture2D(uCitySun, cuv), uSunW);            // uSunW = preset weights
vec3 ao3 = texture2D(uCityAO, cuv).rgb;
float ao = vWPos.y - base < 3.0 ? mix(ao3.r, ao3.g, (vWPos.y - base) / 3.0) : mix(ao3.g, ao3.b, clamp((vWPos.y - base - 3.0) / 7.0, 0.0, 1.0));
float nearPlayer = 1.0 - smoothstep(16.0, 22.0, distance(vWPos.xz, uPlayer.xz)); // real shadow map owns ±24 u
reflectedLight.directDiffuse *= mix(mix(1.0, sunVis, 0.85), 1.0, nearPlayer);  // at #include <lights_fragment_end>
reflectedLight.indirectDiffuse *= mix(1.0, ao, 0.8);
```

Where they overlap, this replaces the existing 2 u building-distance contact field (`materials.ts:188-194`); keep that field only as a crisp near term.

### 3.6 Night: a light field in place of thousands of pools

Keep the additive halos and pool quads (`materials.ts:363-426`, `world.ts:209-220`) only for the nearest 64 lamps. Everything else goes into a GTA_SZ-style clipmap:
- A 1024² `DataTexture`/`CanvasTexture` covering 512 u (0.5 u/texel) around the player.
- Re-rasterise it on entering a new 128 u cell (about 1–3 ms of canvas work), with gradients of radius 3.4 u and colour (1,.72,.42).
- Read it in GROUND and on TOY roofs: `diffuse += albedo * lux * 3.0 * max(0., n.y) * uNight`.
- The water's light-streak mask already works the same way, statically (OB:`water.ts:36-56`), so it can share this texture.

### 3.7 Far city LOD

Rings are complementary, with hysteresis:

| ring | distance | what is drawn | triangles |
|---|---|---|---|
| near | ≤ 80 u | instanced houses | ~90 per house |
| mid | 80–260 u | the same instances, 16-triangle prototype (box plus roof prism, no bay), atlas via unresolved means | 16 per house |
| far | > 260 u | per-block massing: block polygon extruded to the median height of its houses, with tops coloured by the average roof finish and walls by the average body tint | < 10 per block, ~40k total |

- **Keep colour at distance.** GTA_SZ's grey-shell lesson applies: walls take the average body tint, roofs the average finish, windows are procedural with the fade to the mean, and parks become canopy blobs.
- **Tiles.** 200 u tiles as one `BatchedMesh` (three 0.186 supports multi-draw). Keep identity per-batch matrices so `patchCommonVertex`'s world position stays valid. That gives 1 draw call, with visibility toggled per tile.
- **Selection.** Run at 10 Hz on the CPU over 64 u cells: about 1 ms for 40k houses, and a buffer upload of about 350 KB per rebuild.

### 3.8 Sky, fog and sun at city scale: add "Karl"

- **Far plane.** Raise it from 1600 to 3500 (`GameRoot.tsx:29`). Make the near plane dynamic, `clamp(0.5 + 0.02 × cameraHeightAboveGround, 0.5, 8)`, which is GTA_SZ's fix for land and sea flickering through each other.
- **Table.** Radius 6000, with darkening from 900 to 2600 u (`environment.ts:158-160`).
- **Fog per camera mode** (new `palette.ts` field):
  - Walk keeps .0011–.0022.
  - Overview and viewpoints use .00045 golden and .0005 day, which gives about 40% fog at 1,600 u: `1-exp(-(0.00045×1600)²) = 0.40`.
- **Karl the Fog: a western, height-limited marine layer.** SF heights are exaggerated about 1.7× (Telegraph Hill 84 m → 20 u), so Twin Peaks is about 67 u. A fog top around 40–60 u then drapes over Sutro and Twin Peaks the way the real layer does.

```glsl
// helper patchFog(shader) used by GROUND / TOY / water / sky (never patch THREE.ShaderChunk globally: the site's Little Bay shares three)
float d = length(vWPos - cameraPosition);
float karl = uKarl * smoothstep(uKarlEdge.x, uKarlEdge.y, dot(vWPos.xz, uKarlDir)) * exp(-max(vWPos.y - uKarlBase, 0.0) / uKarlFall);
float f = 1.0 - exp(-pow(fogDensity * d, 2.0) - karl * d * 0.004);
gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(fogColor, uKarlColor, karl), f);
```

Pair it with a *visible* toy fog bank: 40–80 instanced cotton-wool clusters, reusing the cloud builder (OB:`backdrop.ts:412-422`). They slide in from the Pacific edge in golden hour and morning. At about 12 ALU per pixel, this is our answer to GTA_SZ's HDR drama, and it is uniquely SF. Keep the analytic sky. The three HDRs cost 39 MB and are photographic, so they don't fit our look.

### 3.9 Water (Bay and Pacific)

1. **Nyquist fades** for the ripple lines, the glitter and the noise normals. This is GTA_SZ's `1-smoothstep(.35,1.8,fwidth(phase))` (`city-bay-water.ts:81`), applied to `water.ts:277-279, 286, 295`:

   ```glsl
   float lw = 1. - smoothstep(.35, 1.8, fwidth(dot(vW.xz, vec2(.55, .83)) * 1.3));
   ```
2. **Reflect the sky gradient** along the reflected ray instead of the constant `uSky` (`water.ts:291`). Add `uTop` and `uHorizon` to the uniforms set in `environment.ts:304-313`.
3. **Pacific mask.** Put it in the G channel of the shore-distance raster. Whole SF at 2 u/cell is about 1,100² R8G8, 2.4 MB. The Pacific gets a deeper `#2f6f86` and Ocean Beach surf bands:

   ```glsl
   smoothstep(.6, .95, sin(d * 1.2 - t * 1.1)) * (1. - smoothstep(1.5, 8., d)) * ocean
   ```
4. **Far water** beyond the slab: the existing skirt plus satellite boards. No planar mirror; a MirrorTexture would double scene cost.

### 3.10 Post

Add an overview/aerial mode, following GTA_SZ `city-cinematic.ts:46-51`:
- `samples 4 → 0` plus a cheap FXAA pass (three's `FXAAShader`) when the camera distance is over 45 u or at viewpoints.
- Bloom threshold per preset: .9 day, .8 golden, .65 night.
- Weaken the tilt-shift band in overview (`uBand` .15 → .28), so the whole-city view stays readable.
- Never switch passes by rebuilding materials.

---

## 4. Higgsfield texture plan (≤ 500 credits)

**General approach.**
- Generate *orthographic elevations*, not atlases. Slice, pad and derive masks offline in Python/PIL, in new scripts under `scripts/opus-sf/`.
- Every painted image gets a second pass: an **ID map** made by image edit (`nano_banana_2` with the painted image as reference). Masks come from its flat colours, not from guessing.
- The per-image credit cost isn't exposed by `models_explore`, so run one job first, read its cost, and scale the counts below. Hard stop at 450 credits spent.

**Shared prompt suffix:**
> "orthographic front elevation, perfectly flat head-on view, no perspective, even soft studio light, no cast shadows, isolated on plain #f3ecdf background, hand-painted miniature diorama / clay toy model style, soft matte paint, simple readable shapes, crisp edges, BODY WALLS PAINTED NEUTRAL LIGHT GREY #d6d3cc, trim white, window glass flat dark teal #2b4a55, no text, no letters, no logos, no people, no cars, no trees in front"

The neutral grey body is deliberate: the tint comes from `instanceColor`.

**ID-map prompt:**
> "recolor this exact image to a flat ID map, keep every edge pixel-aligned: body wall #808080, trim and moldings #ffffff, glass #000000, doors and accent panels #ff0000, roof and cornice top #0000ff, background #00ff00, no shading"

| # | asset | model / aspect | generations | output after processing |
|---|---|---|---|---|
| 1–8 | low-rise elevations (8 families below) | `nano_banana_pro` 2k, 2:3 (~1365×2048) | 8 × 2 candidates | 512×1024 tile (4 zones, 16 px gutter) → atlas A 2048² and B 1024² |
| 9–16 | ID maps for the chosen 8 | `nano_banana_2` edit, `auto` | 8 (+2 retries) | masks: A.a body, B.r glass, B.g accent; B.b = blurred glass/trim edges as AO |
| 17–20 | tower modules: FiDi granite piers, FiDi blue-green curtain glass, deco setback stone, white-panel residential with balconies | `seedream_v4_5` basic, 1:1 | 4 × 2 | crop exactly 2×2 bays (detect mullions by PIL row/column projections) → 512² seamless in both directions; atlas 1024² |
| 21–24 | original murals for side walls (folk-art flowers, birds, sun, bay waves; **not** copies of real Balmy/Clarion Alley works) | `nano_banana_pro` 2k, 1:1 | 4 + 2 | 512², clamp, no tiling; for Mission side walls |
| 25–26 | horizon strips: Marin Headlands + Mt Tamalpais + Golden Gate headlands; East Bay hills + Mt Diablo; layered paper-cut pastel ridges on plain background | `nano_banana_pro` 21:9, then `flux_2_pro_outpaint` to about 6:1 | 2 + 4 outpaints | 4096×682 RGBA (`remove_background`); cylindrical cards at radius ~2,400 u behind the table, fogged |
| — | ground / roof detail | procedural (Python) | 0 | 512² roof detail and paving macro noise; our procedural ground patterns (`materials.ts:138-186`) stay |

**Per-family content prompts** (prefix to the suffix):
1. **Victorian** Italianate/Queen Anne: "a single narrow three-storey San Francisco Victorian row house, two-storey angled bay window on the left, tall narrow sash windows with ornate trim, bracketed cornice and false front, stoop stairs and arched door on the right".
2. **Edwardian flats**: "three-storey Edwardian flats, two stacked box bays, flat roof with simple dentil cornice, garage door at street level, recessed entry with three doors".
3. **Sunset "Doelger"**: "two-storey 1940s Sunset District stucco row house, street-level garage door and side stair, one large picture window upstairs framed by Spanish-revival relief trim, small clay-tile eave band".
4. **Marina**: "three-storey Mediterranean-revival stucco apartment, arched windows, small wrought-iron balconies, red clay tile eave, two garage doors".
5. **Chinatown**: "four-storey Chinatown mixed-use building, ground-floor shop with plain awning and display windows (no lettering), painted iron balconies, paired windows, green-glazed tile eave, red lantern hooks".
6. **SoMa**: "three-storey 1910s brick warehouse loft, red-brown brick, large arched steel-mullion windows, loading doors, stepped parapet".
7. **Mission**: "two-storey Mission District corner building, plain storefront with awning, Victorian upper floor with one bay window".
8. **Deco**: "five-storey 1920s Art Deco apartment, cream stucco, vertical fluting, zig-zag fire escape, entry canopy".

**Tiling rules.**
- **Low-rise tiles.** One house per module horizontally. Pilasters or quoins must sit at both edges so repeats on wide buildings seam cleanly. Zone boundaries must fall on full-width horizontal trim bands (belt courses or sill lines); slice exactly there and resample each zone to its row count. Floor A and floor B must share window column positions, so any A/B stack is seamless.
- **Towers.** Periodic in both directions. If the crop leaves a seam, offset the image by half and repair the cross with `nano_banana_2` inpainting (`is_inpaint`), or by a PIL cross-fade.
- **Per-family constants.** Precompute `uFamMean` (the linear mean of the resolved tile and its glass coverage) and bays per module. These replace GTA_SZ's hard-coded means (`:402-404`).
- **Encoding.** A as WebP q88 sRGB, B as lossless WebP, loaded lazily after start.

---

## 5. Recommendations for Opus Bay (whole SF)

### Performance targets (DESIGN §9 stays: ≤ 150 draw calls, ≤ 400k triangles including shadows, ≥ 45 fps at 4× throttle)

| layer | draw calls | triangles |
|---|---|---|
| sky, table, board shadow | 4 | 1k |
| ground and road chunks (150 u, within 600 u) | 16 | 45k |
| water chunks | 4 | 20k |
| houses near (≤ 80 u, ≤ 700 × 90 tris) | 8 | 63k |
| houses mid (80–260 u, ≤ 3,000 × 16 tris) | 8 | 48k |
| towers (≤ 150) | 4 | 9k |
| far massing `BatchedMesh` | 1 | 40k |
| trees, 3 species × 3 tiers (near 300, mid 800) | 9 | 52k |
| furniture and roof props | 14 | 25k |
| hero landmarks (culled) | ~12 | 40k |
| life, streetcars, cable cars | ~16 | 20k |
| labels, signs, halos, pools | 4 | 2k |
| shadow pass (near houses, trees and actors, ±24 u) | ~14 | 30k |
| **total** | **~115** | **~395k** |

**Mobile and low tier.** Halve the house, tree and prop counts; use the 1024² atlas and 4 u/texel rasters; no MSAA.

**Memory and download.**

| item | GPU memory |
|---|---|
| atlases | 32 MB high / 11 MB low |
| rasters (AO, sun, roof, shore) | ~12 MB |
| light-field clipmap | 4 MB |

- Download after start: about 3.5 MB (atlases 1.8 MB, rasters as lossless WebP ~1.2 MB, horizon strips 0.5 MB).
- First load is unchanged: the title and procedural fallbacks.
- House, tree and furniture data: 40k × 12 B ≈ 0.5 MB binary.

### File-level plan

**New files in `src/opus-bay/world/`:**
- `facade.ts`: atlas loader with 1×1 placeholders and a `uFacOn` uniform (no recompiles, following the GTA_SZ stability contract), the family table, the GLSL chunk from §3.1, and tower glass sky reflection.
- `houses.ts`: archetype prototypes (near about 90 triangles, mid 16), one `InstancedMesh` per archetype and tier, ring selection at 10 Hz with a 16 u gate, and the grow-in fade.
- `farcity.ts`: `BatchedMesh` block massing in 200 u tiles, complementary to `houses.ts`.
- `roofs.ts`: the roof-finish branch and instanced roof props.
- `trees.ts` and `furniture.ts`: instanced tiers with demote-not-drop budgets.
- `cityRasters.ts`: loads the AO, sun, roof and shore rasters and injects the §3.5 chunk into GROUND and TOY.
- `lightfield.ts`: the night clipmap (§3.6), shared with the water light mask.
- `fog.ts`: `patchFog()` for Karl plus the cotton fog-bank instances.

**Edits to existing files:**
- `materials.ts:69`: compute `vWN` with `instanceMatrix`.
- `materials.ts:248-281`: fade the procedural windows to the mean when unresolved, and route families ≥ 9 to `facade.ts`.
- `materials.ts:317-321`: `TOY_INST` gets the facade, raster and fog patches.
- `environment.ts:138-171, 248, 299`: table size and darkening, fog by camera mode, Karl uniforms, a ±60 u shadow frustum in overview.
- `palette.ts`: `fogOverview`, `karl{density, base, fall, edge, color}`, `bloomThreshold` per preset.
- `water.ts:277-295`: Nyquist fades, sky-gradient reflection, Pacific mask and surf.
- `post.ts`: overview mode (MSAA 0 + FXAA), per-preset threshold, `uBand` by mode.
- `world.ts:31-118`: stop merging row houses, trees and furniture into the static toy batch (keep merged geometry for landmarks and near hand-made detail); wire the new systems into `update()` with 10 Hz selection.
- `game/GameRoot.tsx:29`: far plane 3500 and dynamic near.

**Offline scripts in `scripts/opus-sf/`:**
- `lots.mjs`: DataSF and OSM footprints → toy lots, aggregated about 4:1, with archetype classification (§3.2).
- `bake-rasters.mjs`: AO (24 directions × 4 phases × 20 steps), sun visibility for the 4 presets, roof codes, shore distance and Pacific mask.
- `trees.mjs`: planting with clearance vetoes.
- `atlas.py` (PIL): zone slicing, gutters, ID-map masks, means, WebP encoding.

**QA.**
- Run `opus-shot.mjs` from Coit, Twin Peaks, Ocean Beach and Alamo Square at golden hour and at night.
- Check with `?debug=1` that draw calls, triangles and fps stay within the targets above.
- Check for shimmer by capturing two frames while panning slowly and diffing them.
