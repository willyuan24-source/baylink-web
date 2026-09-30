/**
 * Wave-7 AI landmark meshes (lane V, W7-V4): SAM 3 3D meshes from nano_banana_pro concepts in the K6 toy style, cleaned
 * by the wave-4 pipeline (scripts/opus-sf/assets/w7v/build.py → ../w4/w4_cleanup.py in Blender 5.2: weld, flat base,
 * planar dissolve + collapse to the cap, texel re-bake onto fresh UVs, palette grade, Draco + WebP q82). Same
 * conventions as `SF_MODELS` in data/assets.ts (spread into it): one mesh, one matte material, origin at the ground
 * centre, front faces +Z, `size` = the GLB bounds in world units, `triangles` / `bytes` = the files. Provenance:
 * docs/opus-bay/ledger/w7-V.md; the gate: docs/opus-bay/sf-w7-V.md (part b).
 * Dependency-free at runtime (the type import is erased).
 */
import type { SfModelAsset } from '../assets';

const file = (name: string) => `/opus-bay/models/sf/${name}`;

export const W7V_MODEL_IDS = ['sf-de-young-tower'] as const;
export type W7VModelId = (typeof W7V_MODEL_IDS)[number];

export const W7V_MODELS: Record<W7VModelId, SfModelAsset> = {
  /**
   * The de Young's Hamon Observation Tower (the `de-young-tower` site, world/sf/landmarks/de-young-tower.ts): a slab
   * tower in dark dimpled, perforated copper that twists as it rises, long window slits, the glass observation floor
   * under a thin overhanging roof. Fitted to the procedural tower: 4.3 × 11.15 × 2.6 u (the depth squeezed from the mesh's own 3.45 so it stays a slab), placed by the site's swap.
   */
  'sf-de-young-tower': {
    url: file('w7v-de-young-tower.glb'), draco: true, kind: 'hero', landmarkId: 'de-young-tower',
    scale: 1, yOffset: 0, triangles: 3920, bytes: 101_296, size: [4.3, 11.15, 2.6],
  },
};
