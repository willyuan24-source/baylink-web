import type { BatchLike } from '../../builder';
import { GLOW, LIT, arch, box } from './kit';

/**
 * A Beaux-Arts civic block for the Civic Center sites (lane L, wave 4): a light stone box on a rusticated base, a
 * colonnade across one front under an entablature, a parapet, the ground-floor arches lit at night. `front`: +1 = the
 * +z face, −1 = the −z face; x0…x1, z0…z1 the footprint (local); `y` the ground at the front.
 */
export interface CivicBlock { x0: number; x1: number; z0: number; z1: number; h: number; front: 1 | -1; cols: number; stone: string; base: string }

export function civicBlock(b: BatchLike, k: CivicBlock, y: number, lod: 0 | 2) {
  const cx = (k.x0 + k.x1) / 2, cz = (k.z0 + k.z1) / 2, w = k.x1 - k.x0, d = k.z1 - k.z0;
  box(b, cx, y - 1.0, cz, w, k.h + 1.0, d, k.stone, lod === 0 ? LIT(y) : GLOW(0.1));
  if (lod === 2) return;
  const fz = k.front > 0 ? k.z1 : k.z0, ry = k.front > 0 ? 0 : Math.PI, out = k.front * 0.35;
  // the rusticated base band, the colonnade in front of the upper floors, the entablature and the parapet
  box(b, cx, y - 0.2, fz + out * 0.3, w + 0.1, k.h * 0.32, 0.25, k.base);
  const span = w - 1.6, n = k.cols;
  for (let i = 0; i < n; i++) box(b, k.x0 + 0.8 + (span * i) / (n - 1), y + k.h * 0.32, fz + out, 0.32, k.h * 0.5, 0.32, k.stone);
  box(b, cx, y + k.h * 0.82, fz + out * 0.6, w + 0.1, k.h * 0.12, 0.7, k.base);
  box(b, cx, y + k.h, cz, w + 0.3, 0.3, d + 0.3, k.base);
  for (let i = 0; i < n - 1; i++) arch(b, k.x0 + 0.8 + (span * (i + 0.5)) / (n - 1), y, fz + k.front * 0.02, 0.9, 1.5, ry, '#4a4a48', LIT(y));
}
