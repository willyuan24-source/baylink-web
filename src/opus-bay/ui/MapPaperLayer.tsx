import { useEffect, useState } from 'react';
import { MAP_PAPER, type PaperWidth } from '../data/mapPaper';
import { PAPER_FADE_MS, isPhoneLike, paperLayers, paperLoaded, paperUrl, paperWidthFor, preloadPaper } from './mapPaper';

/**
 * SVG layer of the painted map, in world coordinates (lane H2b owns this file from wave 2; plan H2b-5). G1's city map
 * renders `<MapPaperLayer width={…} />` inside its world-space <svg> (viewBox in world x / z), under the vector
 * layers. Nothing without paper (`?paper=0`).
 *
 * Progressive: while the requested paper loads, the sharpest smaller one already decoded (at first the 1024, ≈ 110 KB)
 * shows; once the requested one is decoded it fades in OVER that one, and the smaller one leaves the DOM only when the
 * fade has ended (one decoded image at a time once it settles). A paper that is already decoded when it becomes the
 * target (a second opening, zooming back out) shows at once, alone. Phones and tablets stop at 2048 (paperWidthFor):
 * the 4096 paper is for desktop zoom only. Past the paper's edges the view shows the same cream table the paper is
 * painted on (a map frame wider or taller than the square paper).
 */

/** The table colour the paper is painted on (world/palette PAL.table; paper_post.py grades the paper's table to it). */
const TABLE = '#f3ecdf';
const FAR = 1e5;
let phone: boolean | null = null;
/** isPhoneLike() once per page (the layer renders on every pan / zoom step) */
const phoneLike = () => (phone ??= isPhoneLike());

export function MapPaperLayer({ width = 2048 }: { width?: PaperWidth }) {
  const paper = MAP_PAPER;
  const target = paperWidthFor(width, phoneLike());
  const targetUrl = paperUrl(target);
  const [, setTick] = useState(0);
  // the fade state of the current target (reset during render when the target changes: React's "adjust state on a
  // prop change" pattern, so the first render of a new target already knows whether it has to fade in)
  const [fade, setFade] = useState(() => ({ url: targetUrl, settled: !!targetUrl && paperLoaded(targetUrl) }));
  if (fade.url !== targetUrl) setFade({ url: targetUrl, settled: !!targetUrl && paperLoaded(targetUrl) });
  const done = !!targetUrl && paperLoaded(targetUrl);
  const settled = fade.url === targetUrl && fade.settled;
  useEffect(() => {
    if (!targetUrl || paperLoaded(targetUrl)) return;
    let live = true;
    void preloadPaper(targetUrl).then(img => { if (live && img) setTick(t => t + 1); });
    return () => { live = false; };
  }, [targetUrl]);
  // the fade-in has ended: the paper under it may go (a timer, not transitionend: that never fires while the sheet is
  // hidden or the transition is interrupted)
  useEffect(() => {
    if (!targetUrl || !done || settled) return;
    const id = window.setTimeout(() => setFade(f => (f.url === targetUrl ? { url: targetUrl, settled: true } : f)), PAPER_FADE_MS + 50);
    return () => window.clearTimeout(id);
  }, [targetUrl, done, settled]);
  if (!paper || !targetUrl) return null;
  const b = paper.bounds;
  const box = { x: b.minX, y: b.minZ, width: b.maxX - b.minX, height: b.maxZ - b.minZ, preserveAspectRatio: 'none' } as const;
  const l = paperLayers(target, targetUrl, done, settled);
  return (
    <g className="ob-map-paper">
      <rect x={b.minX - FAR} y={b.minZ - FAR} width={b.maxX - b.minX + 2 * FAR} height={b.maxZ - b.minZ + 2 * FAR} fill={TABLE} />
      {l.under && <image key={l.under} href={l.under} {...box} />}
      <image key={targetUrl} href={targetUrl} {...box} style={{ opacity: l.opacity, transition: l.fade ? `opacity ${PAPER_FADE_MS}ms ease` : undefined }} />
    </g>
  );
}
