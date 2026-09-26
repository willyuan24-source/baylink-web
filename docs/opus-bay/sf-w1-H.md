# Lane H report: Higgsfield assets, part 1 (whole-SF, week 1)

**Result.** Every item on the brief is done: S0, S1, L1, L2, L3, L4, V1, T1 (12 postcards), T3 (18 badges), T6 and T7 (6 portraits).
- **Spend:** 133.00 credits, against a part-1 cap of 280. That leaves 147 unspent.
- **Balance:** 748.48 → 615.48, confirmed with `transactions` (details in §6).
- **Bake-off winner:** SAM 3 3D, at 1 credit per mesh.
- **Stop rules:** none triggered, and no 3D retakes were needed.
- **Checks:** `tsc` reported 0 errors across the project when last run. ESLint is clean on `data/assets.ts`. `tests/opus-bay-*.test.ts` passed 142/142, including other lanes' new tests.
- **Commits:** nothing is committed.

---

## 1. Files built or changed

**Models, in `C:/Users/willy/baylink-opus/public/opus-bay/models/sf/`:**

| file | tris | bytes | size w × h × d (u) | notes |
|---|---|---|---|---|
| `victorian-a.glb` | 2,940 | 67,900 | 4.23 × 5.60 × 3.94 | Queen Anne row house: turret, gable, stoop. 512² texture. |
| `victorian-a-mask.webp` | – | 12,782 | 256² | R = glass (2.7 %), G = walls (50.7 %) |
| `victorian-b.glb` | 2,940 | 50,060 | 3.81 × 5.00 × 4.19 | Italianate: false-front cornice, angled bay, stoop. 512² texture. |
| `victorian-b-mask.webp` | – | 9,064 | 256² | R = glass (2.2 %), G = walls (60.7 %) |
| `palace-rotunda.glb` | 5,874 | 121,208 | 12.66 × 10.80 × 12.67 | Rotunda only. You can walk under it: the arches are 2.45 u wide with 3.27 u clear height. 1024² texture. |
| `dragon-gate.glb` | 5,880 | 124,200 | 9.60 × 5.85 × 2.45 | Central passage is 2.24 u wide with 2.57 u clear height, running along z. Blank plaque, no lions. 1024² texture. |
| `conservatory.glb` | 5,879 | 125,224 | 11.77 × 6.00 × 6.13 | Dome, two glass wings, end pavilions. 1024² texture. |
| `conservatory-mask.webp` | – | 22,854 | 256² | R = glass (31 %) |
| `draco/draco_decoder.wasm` + `draco/draco_wasm_wrapper.js` | – | 192,420 + 58,456 | – | Copied unchanged from three 0.186 `examples/jsm/libs/draco/gltf/`. |

- Model total: 488,592 B of GLB plus 44,700 B of masks. The per-model caps are ≤ 90 KB per house and ≤ 250 KB per hero. The plan's cap for all new GLBs together is 2.5 MB.
- Every GLB is one mesh with one material and a WebP texture (`EXT_texture_webp`). All use Draco (`KHR_draco_mesh_compression`, level 6, positions 14 / normals 10 / UVs 12). Origin is at the ground centre (y = 0), the front faces +Z, metalness is 0 and roughness 0.9.

**2D art:**
- **Postcards:** `public/opus-bay/postcards/sf-{golden-gate-fog, painted-ladies, palace-fine-arts, cable-car-hill, chinatown-lanterns, lombard-street, mission-murals, dolores-park, windmill, city-hall, twin-peaks-view, ocean-beach}-{1200,600}.webp`. That is 24 files, 1.2 MB in total: 45–96 KB at 1200 × 900 and 20–39 KB at 600 × 450, WebP q82.
- **Portraits:** `public/opus-bay/portraits/sf-npc-{gripman, baker, muralist, gardener, ranger, record-store}.webp`. They are 512² on flat #f3ecdf with a contact shadow, 9.6–15.0 KB each, in the same style as `npc-*.webp`.
- **Badges:** `public/opus-bay/badges/{nob-hill, chinatown, alamo-square, golden-gate-park, presidio, mission, castro, north-beach, twin-peaks, embarcadero, fishermans-wharf, marina, financial-district, civic-center, japantown, russian-hill, sunset, soma}.webp`. They are 256² RGBA (round clay disc, transparent corners), 9.8–17.0 KB each, 264 KB in total.

**Code and ledger:**
- `src/opus-bay/data/assets.ts`: registration only (the API is in §2). The existing entries are unchanged.
- `src/opus-bay/ASSETS-LEDGER.md`: appended the section "Whole-SF assets, part 1 (lane H)". It has every job row (id, model, parameters, cost, file, status), the bake-off result, the post-processing steps, a QA table and the totals.

**Scratch, in `C:/Users/willy/opus-qa/assets-work/sf/`:**
- Scripts: `arch_cleanup.py` (Blender), `grade.py` (palette grade and masks), `iou.py`, `badtex.py`, `sheet.py`, `glbinfo.py`, `export_postcards.py`, `export_portraits_badges.py`, `qa-place.js` / `qa-facade.js` / `mkact.js` (in-game QA through `opus-shot` eval).
- Raw files are in `raw/`. Per-asset previews are in `house-a/`, `house-b/`, `rotunda/`, `dragon-gate/gate-1/` and `conservatory/cons-2/`.
- Bake-off material is in `bake/`. Other outputs are in `postcards/`, `badges/`, `portraits/`, `facade/` and `vehicles/`.
- A plain (non-Draco) twin of every GLB is next to its previews, e.g. `house-b/house-b.plain.glb`.

## 2. API for other lanes (`src/opus-bay/data/assets.ts`)

```ts
export const SF_DRACO_DECODER_PATH = '/opus-bay/models/sf/draco/';
export interface SfModelAsset extends ModelAsset {
  draco: true; mask?: string; tint?: 'walls'; kind: 'house' | 'hero'; landmarkId: string;
  passage?: { width: number; clearHeight: number };
}
export const SF_MODEL_IDS = ['sf-victorian-a', 'sf-victorian-b', 'sf-palace-rotunda', 'sf-dragon-gate', 'sf-conservatory'] as const;
export type SfModelId; export const SF_MODELS: Record<SfModelId, SfModelAsset>;
export const SF_POSTCARD_ART_IDS /* 12 'sf-…' ids */; export type SfPostcardArtId;
export const SF_POSTCARD_SUBJECTS: Record<SfPostcardArtId, { zh: string; en: string }>;
export const POSTCARD_ART: Record<PostcardArtId | SfPostcardArtId, PostcardArt>; // now includes the SF ids
export const BADGE_IDS /* 18 slugs */; export type BadgeId; export const BADGE_SIZE = 256;
export interface Badge { url: string; name: { zh: string; en: string }; symbol: string }
export const BADGES: Record<BadgeId, Badge>;
// PORTRAIT_IDS += 'sf-npc-gripman' | 'sf-npc-baker' | 'sf-npc-muralist' | 'sf-npc-gardener' | 'sf-npc-ranger' | 'sf-npc-record-store'
// ASSETS.portraits aliases: 'npc-gripman', 'npc-baker', 'npc-muralist', 'npc-gardener', 'npc-ranger', 'npc-record-store'
// ASSETS.postcards now includes the 12 sf-* ids; ASSETS.models = { ...MODELS, ...SF_MODELS }; listAssetUrls() lists every new file
```

**Loading the SF models.**
- Use `const d = new DRACOLoader(); d.setDecoderPath(SF_DRACO_DECODER_PATH); loader.setDRACOLoader(d)`.
- Today's `world/life.ts` `loadModel()` has no DRACOLoader, so it cannot open the SF GLBs.
- Decoding was verified in the running game (§3), using three 0.186's own DRACOLoader and the decoder from `/opus-bay/models/sf/draco/`.

**Masks.**
- A mask shares the base colour's UVs. Load it with `flipY = false`, like the GLB's own map.
- R = night glass: the GTA_SZ stencil `B−R ≥ 28 & G−R ≥ 18` on the raw texture (`[6, 12]` for house B, whose glass came out desaturated).
- G = the wall tint region on the houses. Walls are graded to the key `#cfe0d0`, so they can be recoloured per instance to `#f2c9b1 #cfe0d0 #f4e2a8 #c9d6e8 #e8c6cf` as luminance × tint.

**Placement.**
- Rotate by the landmark's heading; the front is +Z.
- The gate passage runs through the model along z.
- If lane D wants other sizes, change `scale`; no regeneration is needed.
- Sizing choices:
  - Rotunda: height 10.8 u, per §7. Its width follows the squat concept, so the footprint is 12.7 u, not the scout's 8.
  - Gate: widened 1.2× in x only, so the central arch clears ≥ 2.2 u. At 6 u wide it only cleared 1.87 u.
  - Conservatory: height 6 u, which makes it 11.8 u long.

## 3. How it works, and the evidence (all images viewed)

**Pipeline per 3D asset.**
1. A concept image: nano_banana_pro 1:1 2k with ref K6, using the scout's add-on prompt and the style contract. Concepts with a base, text or clipped edges were rejected before any 3D spend (rotunda v2 had a teal floor disc).
2. SAM 3 3D (1 credit).
3. `arch_cleanup.py` in Blender 5.2, headless:
   - weld at 5e-4 × the bbox diagonal, then drop islands under 0.3 % of faces;
   - flatten the base (bisect at 1 % of height, then cap);
   - planar dissolve at 3°, then collapse to the triangle cap;
   - scale, and set the origin and orientation;
   - matte material;
   - `grade.py`: brand hue remaps with feathered selections (the first remap that claims a texel wins), a saturation clamp, a shadow lift, a cream white-lift, an 8 px gutter fill, and the masks;
   - export Draco + WebP;
   - previews (front, 3/4 from both sides, side, back, top) and a silhouette sweep.
4. QA gate:
   - **IoU:** best view in an azimuth/elevation sweep, against the concept's rembg mask. The local u2net model was already cached; colour thresholds failed because the lit sage walls are close to the cream table.
   - **Mesh:** non-manifold edges and island count.
   - **Palette:** share of texels within ΔE 12 of the DESIGN palette, over UV-covered texels only.
   - **In game:** a 64 px thumbnail check.

**S1 bake-off on house A** (the same cleanup and grade for all four):

| model | credits | IoU | non-manifold / islands | palette ΔE12 after grade | verdict |
|---|---|---|---|---|---|
| **SAM 3 3D** | 1 | 0.94 | 0 % / 1 | 0.85 | **pass.** Crispest modelled trim, clean back, 20k raw tris that decimate well. |
| Meshy image_to_3d | 30 | 0.956 | 0.43 % / 1 | 0.95 | Pass, but softer (trim is painted rather than modelled) and 30× the cost. Kept as the fallback. |
| Tripo H3.1 | 12 | 0.947 | 0 % / 1 | 0.54 | Fail: an olive/yellow smear over the unseen back wall. |
| Hunyuan3D v3 LowPoly | 14 | 0.95 | 0.68 % / 1 | 0.26 | Fail: muddy brown texture, no glass. The model also lay on its back and needed pitch +90°. |

- **Evidence:** `bake/z-bake-prev.png` (cleaned previews of all four), `bake/ingame-levis.png` (SAM and Meshy side by side in the game), `bake/thumb64-sam-a-x4.png` (64 px thumbnail, readable).
- **Why SAM won:** it was the cheapest model that passed the gate, and also the best-looking. That makes every later mesh cost 1 credit. Every SAM mesh after that passed, so the fallback was never used.

**Per-asset verdicts** (preview sheet with every view: `z-final-3d.png`):

| asset | concept / 3D jobs | IoU | palette ΔE12 | verdict |
|---|---|---|---|---|
| victorian-a | a5270ca9 / 4637c808 | 0.94 | 0.85 | **Good.** Reads as a Painted Lady at 64 px. The roof slate is a little dark. |
| victorian-b | cad51afe / 00ed9bb2 | 0.91 | 0.93 | **Good.** The trim is greyer than the concept's cream. |
| palace-rotunda | fba12f36 / f6e59516 | 0.88 | 0.91 | **Good**, and the strongest silhouette. There are a few terracotta streaks on the piers, and 14 islands (planter blocks and cornice parts are separate solids, not torn shells). |
| dragon-gate | 8a1bf0a0 / cce0f6d2 | 0.79 raw, 0.76 widened | 0.86 | **Pass with an IoU waiver.** SAM dropped the concept's lions, which counted against it, and the 1.2× widening is deliberate. Jade roofs and cream pillars read clearly. The red came out as brand terracotta. |
| conservatory | 15526d93 / ff3d372d | 0.86 | 0.87 | **Good.** The glass looks grey-teal in Blender but reads white/teal in the game; 31 % of it is night-glass masked. The alternate concept 4479ee05 / a09af4ce scored IoU 0.849. |

**In-game evidence** (all loaded with the DRACOLoader, all 5 reported `ok`, `draco: true`, with the expected triangle counts):
- `ingame-all-day.png`: an overview.
- `ingame-final-golden.png`: loaded from the production decoder path, placed beside the district's procedural city.
- `z-thumbs64.png`: 64 px thumbnails. All five are recognisable; the conservatory is weakest when placed over water.

**2D evidence:**
- **Postcards:** `z-postcards-a.jpg` (all 12 raw) and `z-postcards-final.jpg` (the shipped crops).
  - Rejected: Dolores Park v-a, because it was a floating slab with a ghost duplicate skyline. The retake v-b is full-bleed.
  - Checked at full size for text: the cable car front panel is decoration only, and the Chinatown signs are blank.
- **Badges:** `z-badges.jpg` (sheets) and `z-badges-cut.png` (the 18 cuts). On sheet 2, u2net missed the pale Transamerica disc, so the 3×3 grid was rebuilt from the other eight.
- **Portraits:** `z-portraits-final.png`, compared with the existing `npc-vendor`. The style matches, and the edges are clean (`sf-npc-muralist.webp` viewed at 512).

## 4. T6 facade A/B and V1 reference sheets

**T6 facade A/B.** The decision is the lead's.
- Four seamless tiles from gpt_image_2_5 medium (2 credits in total): `facade/{victorian, soma-brick, sunset-stucco, chinatown}.png`, plus 512 px WebP copies.
- They were placed in the running game as textured boxes in front of the procedural TOY city: `facade/ab-day.png`, `ab-golden.png`, `ab-night.png`.
- **Observation:**
  - In daylight and at golden hour, the textured tiles look richer up close: trim, arched windows, balconies.
  - At night they go completely dark, while the shader windows glow.
  - Without the `OB_MAP` mask path they would also lose the dither-fade.
  - Each style needs its own texture and material.
- **My recommendation:** keep shader windows city-wide. Only consider textured strips for a few hero streets once `OB_MAP` exists (T5 shopfronts, part 2).

**V1 reference sheets** are in `vehicles/`, with a README giving the target sizes from plan §6:
- `ref-cable-car.webp`: use the side view as the master, because the front and back ends differ between views.
- `ref-toy-car.webp`: the front view wrongly shows a hard top; follow the side and top views.
- `ref-bike.webp`: consistent across views.

## 5. Known gaps

- **Draco has no loader in the codebase yet.** The models only load where a DRACOLoader is set up (see Requests). Plain twins exist in scratch but exceed the size caps: house A is 181 KB and the heroes are 286–312 KB.
- **Masks are not wired up.** Nothing uses them until `makeToy` gains `OB_MAP`. Until then the GLBs render with a plain standard material: no night glow and no occlusion fade.
- **Dragon gate:** misses the IoU target, as noted above; add procedural lions if they are wanted.
- **Proportions:**
  - The rotunda footprint is larger than the scout's 8 u, because it was scaled to the §7 height.
  - The houses are 3.8–4.2 u wide, not the scout's 3.0. They fit today's 4.6 u toy lot, so there is no non-uniform squash.
- **Colour drift in previews:** the workbench previews for house B and the bake-off were rendered with AgX, which greys them; later previews use the Standard view transform. The shipped textures are the same either way.
- **Badge slugs are my choice** (DataSF-style neighbourhood names). Lane G may want to map them to its own zone ids.
- **`public/opus-bay/README.md` is not updated.** It isn't in my paths; the ledger has the full provenance.

## 6. Credits

**133.00 credits in total:**

| item | credits |
|---|---|
| S0 concepts: 4 × nano_banana_pro | 8 |
| S1 bake-off: SAM 1 + Tripo 12 + Hunyuan 14 + Meshy 30 | 57 |
| House B mesh: SAM | 1 |
| Landmark concepts (6) + V1 sheets (3): nano_banana_pro | 18 |
| Landmark meshes: 5 × SAM | 5 |
| Postcards: 12 × nano_banana_pro | 24 |
| Dolores retake + 2 badge sheets + 6 portraits: 9 × nano_banana_pro | 18 |
| Facade tiles: 4 × gpt_image_2_5 medium | 2 |

- **Transactions:** every row from 10:46 to 11:20 UTC matches these jobs: 34 × Nano Banana Pro at −2, 7 × "3D Objects" at −1, Tripo −12, Hunyuan −14, Image to 3D −30, and 4 × GPT Image 2.5 Flare at −0.5. There were no refunds.
- **Failed submission:** the first postcard batch was rejected at submission because the P13 reference id was mistyped (see §7), and it charged nothing.
- **Balance:** 748.48 → **615.48**. The floor of 468.48 was never approached.
- **Saved:** doing the background removal with local rembg saved 6 credits against the plan.

## 7. Requests for other lanes

1. **Lead or the lane that owns `world/models.ts`:**
   - Create the shared GLB loader with `DRACOLoader`, calling `setDecoderPath(SF_DRACO_DECODER_PATH)`.
   - Optionally move the two decoder files to `public/opus-bay/draco/`, as the plan says, and update that one constant. Right now they sit in `models/sf/draco/` because that is inside my paths.
   - Warm the decoder at boot, so the first landmark load doesn't stall.
   - Do not route SF ids through `life.ts loadModel()` as it stands.
2. **Lane C (`world/materials.ts`):** add `OB_MAP` in `makeToy`:
   - `map` multiplies the diffuse;
   - `mask.r` adds night emission with per-instance occupancy;
   - `mask.g` mixes luminance × instance tint (walls on `sf-victorian-a` and `-b`);
   - load the mask with `flipY = false`;
   - synthesize `aInfo` so these meshes get contact AO and the dither-fade.
3. **Lane D (landmarks):**
   - Use `SF_MODELS['sf-palace-rotunda' | 'sf-dragon-gate' | 'sf-conservatory']` via `landmarkId`, and `sf-victorian-a` / `-b` for the Painted Ladies row (7 instances with tints).
   - Gate collision: two outer pillar blocks plus two inner pillars, keeping the 2.24 u central passage free.
   - The rotunda arches are walkable, so leave the interior open.
   - Use `scale` rather than regenerating if you need other sizes.
4. **Lane G (flow/UI):**
   - Add `data/postcards.ts` entries for the 12 `sf-*` ids. `POSTCARD_ART[id]` and `ASSETS.postcards[id]` already resolve them, and `SF_POSTCARD_SUBJECTS` has working captions.
   - Badges are `BADGES[slug]`, with bilingual names.
   - New NPC portraits resolve as `npc-gripman`, `npc-baker`, `npc-muralist`, `npc-gardener`, `npc-ranger` and `npc-record-store`.
5. **Lanes E and F (vehicles, transit):** the procedural cable car, toy car and bike references are in `C:/Users/willy/opus-qa/assets-work/sf/vehicles/`; see its `README.md`.
6. **Lead:**
   - Correct the P13 id in `sf-research-asset-scout.md` §7 and the tech plan: it is `d756b0c4-46f1-4761-9e58-0d5d78bc2433`, not `…-56f1-…`.
   - Add a whole-SF section to `public/opus-bay/README.md`, pointing at the ledger.
   - T6 decision: see §4.

## 8. Recommendations for part 2

- **3D:** now that SAM is the winner, each remaining mesh costs about 5 credits: 4 for two concepts plus 1 for SAM. The windmill body, Mission Dolores and the bison together come to about 15 credits, against the plan's 48.
  - Keep Meshy (30) only as the fallback for a SAM failure.
  - A SAM try on the cable car from the V1 side view would cost 1 credit, but the plan (D10) keeps the cable car procedural, which I agree with.
- **T2 map repaint:** needs the whole-SF base render first. Lane G should export a 2048² PNG of the city map SVG, with labels off, using the same `bounds()`/viewBox as `ui/MapPanel.tsx`. Then run nano_banana_pro 4k img2img ×2 (8) and seedream (2.5), and apply the plan's 1.5 % coastline check.
- **A1 barks:** need the line list from the flow lane: mode firsts and neighbourhood arrivals, zh and en. Use qwen_audio_tts with the "Pixie" preset (≤ 10 credits).
- **T4 murals (18) and T5 shopfronts (12):** T5 only if the lead picks textured facades after `OB_MAP` exists.
- **Budget:** at least 147 credits remain under the part-1 cap alone. The whole of part 2 at plan prices (about 50–60 credits) fits easily within the 450 lead cap.
