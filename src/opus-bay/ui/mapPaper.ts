import { MAP_PAPER, type MapFrame } from '../data/mapPaper';

/**
 * Painted map loader and canvas painter (lane H2b owns this file from wave 2; plan H2b-5). Day-0 stub: no paper yet.
 *
 *   loadMapPaper(width)          cached Promise of the decoded image for a target pixel width (null: no paper / error /
 *                                ?paper=0)
 *   drawMapPaper(ctx, img, toPx) draw it UNDER the vector layers; toPx maps world (x, z) → canvas px
 */

export function loadMapPaper(width: number): Promise<HTMLImageElement | null> {
  if (!MAP_PAPER || !(width > 0)) return Promise.resolve(null);
  return Promise.resolve(null);
}

export function drawMapPaper(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, toPx: (x: number, z: number) => [number, number], frame?: MapFrame) {
  if (!img || !MAP_PAPER) return;
  const f = frame ?? MAP_PAPER.bounds;
  const [x0, y0] = toPx(f.minX, f.minZ), [x1, y1] = toPx(f.maxX, f.maxZ);
  ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0);
}
