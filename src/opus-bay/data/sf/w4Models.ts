/**
 * Wave-4 AI landmark meshes (lane V, W4-V4): four SAM 3 3D meshes from nano_banana_pro concepts in the K6 toy style,
 * cleaned by scripts/opus-sf/assets/w4 (Blender 5.2: weld, flat base, planar dissolve + collapse to the cap, texel
 * re-bake onto fresh UVs, palette grade, Draco + WebP q82). Same conventions as `SF_MODELS` in data/assets.ts: one mesh,
 * one matte material, origin at the ground centre, front faces +Z, `size` = the GLB bounds in world units, `triangles` /
 * `bytes` = the files. Provenance and QA numbers: docs/opus-bay/ledger/w4-V.md, docs/opus-bay/sf-w4-V.md.
 *
 * Not registered yet (early phase: new files only). Integration (lane V, data/assets.ts): append `W4_MODEL_IDS` to
 * `SF_MODEL_IDS` and spread `W4_MODELS` into `SF_MODELS`; lane L then swaps them in through the SoloView gate.
 * Dependency-free at runtime (the type import is erased).
 */
import type { SfModelAsset } from '../assets';

const file = (name: string) => `/opus-bay/models/sf/${name}`;

export const W4_MODEL_IDS = ['sf-cal-academy', 'sf-st-ignatius', 'sf-holy-virgin', 'sf-chinese-pavilion'] as const;
export type W4ModelId = (typeof W4_MODEL_IDS)[number];

export const W4_MODELS: Record<W4ModelId, SfModelAsset> = {
  /**
   * California Academy of Sciences (music-concourse site): a long low glass hall under a thin white roof slab on slim
   * columns, the green living roof with its two porthole domes and small humps. Fitted to lane L's procedural block
   * and canopy (world/sf/landmarks/cal-academy.ts, OSM way 28695389): place it at the procedural origin with scale 1.
   * 1024 px texture; mask R = the glass walls.
   */
  'sf-cal-academy': {
    url: file('w4-cal-academy.glb'), mask: file('w4-cal-academy-mask.webp'), draco: true, kind: 'hero', landmarkId: 'music-concourse',
    scale: 1, yOffset: 0, triangles: 5880, bytes: 93_120, size: [24.4, 7.9, 16.6],
  },
  /**
   * St Ignatius Church (usf-lone-mountain site): twin four-stage towers with domed lanterns and crosses, the columned
   * front and pediment, the tile-roofed nave and the dome on its drum over the crossing; warm buff walls. Fitted to lane
   * L's procedural church (world/sf/landmarks/st-ignatius.ts, OSM way 225193440; towers by the landmark rule
   * H = 3.2 + 0.155 · h): place it at (x 0.35, z −0.18) of the procedural frame (the footprint's centre) with scale 1. 1024 px texture.
   */
  'sf-st-ignatius': {
    url: file('w4-st-ignatius.glb'), draco: true, kind: 'hero', landmarkId: 'usf-lone-mountain',
    scale: 1, yOffset: 0, triangles: 5879, bytes: 152_988, size: [7.5, 13.2, 11.15],
  },
  /**
   * Holy Virgin Cathedral (geary-west site): the white body with rounded arched gables and red trim (the 2018 colour
   * scheme), five gold onion domes on drums with small crosses. 38.1 m → H = 9.1 u. 1024 px texture. An active place
   * of worship: no gameplay objects on or in it.
   */
  'sf-holy-virgin': {
    url: file('w4-holy-virgin.glb'), draco: true, kind: 'hero', landmarkId: 'geary-west',
    scale: 1, yOffset: 0, triangles: 5880, bytes: 184_596, size: [6.1, 9.1, 6.686],
  },
  /**
   * The Chinese Pavilion on Blue Heron Lake (blue-heron-lake site; a 1981 gift from Taipei): an open octagonal pavilion,
   * eight red columns on a low stone floor, the grey-green glazed tile roof with upturned corners and a finial.
   * 8.5 m → H = 4.5 u, so the eaves clear the player; walk-in (no blockers inside the columns). 512 px texture.
   */
  'sf-chinese-pavilion': {
    url: file('w4-chinese-pavilion.glb'), draco: true, kind: 'hero', landmarkId: 'blue-heron-lake',
    scale: 1, yOffset: 0, triangles: 2940, bytes: 71_388, size: [5.62, 4.5, 5.61],
  },
};

/** Every file of the wave-4 models (GLBs + masks), for `listAssetUrls()` at integration. */
export function w4ModelUrls(): string[] {
  return Object.values(W4_MODELS).flatMap(m => (m.mask ? [m.url, m.mask] : [m.url]));
}
