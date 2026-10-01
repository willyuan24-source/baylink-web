import type { Box, WaypointBox } from './hudLayout';
import { playParts } from '../ui/playLayer';

/**
 * W7-P1 · `game/hudLayout.ts` rides with the play layer's chunk (lane P, sf-w6-P.md Request 4: GameRoot ≤ 265 KB gzip).
 *
 * The Canvas ticker (game/Systems.tsx) places BAYBAY's bubble and the waypoint around the fixed HUD. Both are DOM parts
 * of the play layer (ui/playParts.tsx: SpeechBubble, Waypoint) and the HUD they keep out of is too, so until that chunk
 * is in there is nothing to place and nothing to scan. The ticker imports these same-named stand-ins: each one calls the
 * real function once the chunk is in (`playParts().hudLayout`); before that they answer what an empty HUD answers (no
 * boxes, the anchor clamped to the screen, the waypoint shown) — never reached in play (GameRoot holds Start until the
 * chunk is in).
 */
export type { Box };

const NO_BOXES: readonly Box[] = [];
const real = () => playParts()?.hudLayout;

export const hudBoxesVersion = (): number => real()?.hudBoxesVersion() ?? 0;
export const hudScanCount = (): number => real()?.hudScanCount() ?? 0;
export const hudBoxes = (): readonly Box[] => real()?.hudBoxes() ?? NO_BOXES;
export function scanHudBoxes(canvas: HTMLElement, now: number, needed: boolean, sizeKey: number): readonly Box[] {
  const m = real();
  return m ? m.scanHudBoxes(canvas, now, needed, sizeKey) : NO_BOXES;
}
export function releaseHudLayout(): void { real()?.releaseHudLayout(); }
export function placeBubble(x: number, y: number, w: number, h: number, boxes: readonly Box[], screenH: number, minY: number, maxY: number, minX?: number, maxX?: number): { x: number; y: number } {
  const m = real();
  return m ? m.placeBubble(x, y, w, h, boxes, screenH, minY, maxY, minX, maxX) : { x, y: Math.min(maxY, Math.max(minY, y)) };
}
export function placeWaypoint(p: WaypointBox, boxes: readonly Box[], bubble: Box | null, screenH: number, minY: number, maxY: number): { y: number; hideLabel: boolean; hidden: boolean } {
  const m = real();
  return m ? m.placeWaypoint(p, boxes, bubble, screenH, minY, maxY) : { y: Math.min(maxY, Math.max(minY, p.y)), hideLabel: false, hidden: false };
}
