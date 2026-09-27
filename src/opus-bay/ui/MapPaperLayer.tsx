import { useEffect, useState } from 'react';
import { MAP_PAPER, type PaperWidth } from '../data/mapPaper';
import { bestLoadedPaper, isPhoneLike, paperLoaded, paperUrl, paperWidthFor, preloadPaper } from './mapPaper';

/**
 * SVG layer of the painted map, in world coordinates (lane H2b owns this file from wave 2; plan H2b-5). G1's city map
 * renders `<MapPaperLayer width={…} />` inside its world-space <svg> (viewBox in world x / z), under the vector
 * layers. Nothing without paper (`?paper=0`).
 *
 * Progressive: the sharpest paper already decoded (at first the 1024, ≈ 110 KB) stays underneath while the requested
 * one loads, then that one fades in and the smaller one leaves the DOM (one decoded image at a time once it settles).
 * Phones and tablets stop at 2048 (paperWidthFor): the 4096 paper is for desktop zoom only. Past the paper's edges
 * the view shows the same cream table the paper is painted on (a map frame wider or taller than the square paper).
 */

/** The table colour the paper is painted on (world/palette PAL.table; paper_post.py grades the paper's table to it). */
const TABLE = '#f3ecdf';
const FAR = 1e5;
export function MapPaperLayer({ width = 2048 }: { width?: PaperWidth }) {
  const paper = MAP_PAPER;
  const target = paperWidthFor(width, isPhoneLike());
  const targetUrl = paperUrl(target);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!targetUrl || paperLoaded(targetUrl)) return;
    let live = true;
    void preloadPaper(targetUrl).then(img => { if (live && img) setTick(t => t + 1); });
    return () => { live = false; };
  }, [targetUrl]);
  if (!paper || !targetUrl) return null;
  const b = paper.bounds;
  const box = { x: b.minX, y: b.minZ, width: b.maxX - b.minX, height: b.maxZ - b.minZ, preserveAspectRatio: 'none' } as const;
  const done = paperLoaded(targetUrl);
  const under = done ? null : paperUrl(bestLoadedPaper(target) ?? 1024);
  return (
    <g className="ob-map-paper">
      <rect x={b.minX - FAR} y={b.minZ - FAR} width={b.maxX - b.minX + 2 * FAR} height={b.maxZ - b.minZ + 2 * FAR} fill={TABLE} />
      {under && under !== targetUrl && <image href={under} {...box} />}
      <image key={targetUrl} href={targetUrl} {...box} style={{ opacity: done ? 1 : 0, transition: 'opacity .3s ease' }} />
    </g>
  );
}
