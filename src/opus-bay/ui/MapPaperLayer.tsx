import { MAP_PAPER } from '../data/mapPaper';

/**
 * SVG layer of the painted map, in world coordinates (lane H2b owns this file from wave 2; plan H2b-5). G1's city map
 * renders `<MapPaperLayer />` inside its world-space <svg> (viewBox in world x / z), under the vector layers.
 * Day-0 stub: renders nothing until MAP_PAPER exists.
 */
export function MapPaperLayer({ width = 2048 }: { width?: 1024 | 2048 | 4096 }) {
  const paper = MAP_PAPER;
  if (!paper) return null;
  const href = (width === 4096 ? paper.sizes[4096] : undefined) ?? (width === 1024 ? paper.sizes[1024] : paper.sizes[2048]);
  const b = paper.bounds;
  return <image href={href} x={b.minX} y={b.minZ} width={b.maxX - b.minX} height={b.maxZ - b.minZ} preserveAspectRatio="none" />;
}
