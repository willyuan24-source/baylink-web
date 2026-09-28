/**
 * Wave 5 · lane C · W5-C1 (plan sf-w5-plan.md §3.4 "photos: frames", §4.3): the photo frame hook.
 *
 * Photo mode's shutter (game/photo.ts) composes a polaroid: the 3D frame on a cream card with a caption band under it.
 * A DECORATOR paints on that card after it is composed — lane E's shop frames (雾 fog · 金色时刻 golden hour · 夜 night),
 * later stamps or event marks. Every registered decorator runs, lowest `order` first (ties: registration order); each
 * decides for itself whether to draw (e.g. only the frame the player wears). A throwing decorator is skipped (the photo
 * is still saved).
 *
 *   registerFrameDecorator(id, draw, order = 0)   → unregister; the same id again replaces the earlier one
 *   draw(f: FrameCanvas)                           paint with f.ctx inside f.width × f.height; f.photo is where the 3D
 *                                                  picture sits, f.band the caption band (the caption and stamp are
 *                                                  already drawn: paint around them, not over them)
 *
 * Dependency-free: photo.ts (main graph) and the lanes' lazy chunks import it.
 */

export interface FrameRect { x: number; y: number; w: number; h: number }

export interface FrameCanvas {
  ctx: CanvasRenderingContext2D;
  /** the whole card (px) */
  width: number;
  height: number;
  /** the 3D picture on the card */
  photo: FrameRect;
  /** the caption band under it (caption left, stamp right) */
  band: FrameRect;
  /** the card's margin around the picture (px) */
  pad: number;
  caption: string;
  stamp: string;
  /** when the shot was taken (real time) */
  at: Date;
}

export type FrameDecorator = (f: FrameCanvas) => void;

interface Entry { id: string; draw: FrameDecorator; order: number; seq: number }
let entries: Entry[] = [];
let seq = 0;

/** Register a decorator (lane E's frames); returns the unregister. */
export function registerFrameDecorator(id: string, draw: FrameDecorator, order = 0): () => void {
  const entry: Entry = { id, draw, order: Number.isFinite(order) ? order : 0, seq: ++seq };
  entries = [...entries.filter(e => e.id !== id), entry].sort((a, b) => a.order - b.order || a.seq - b.seq);
  return () => { entries = entries.filter(e => e !== entry); };
}

/** The registered decorator ids, in the order they paint (tests, QA). */
export const frameDecorators = (): string[] => entries.map(e => e.id);

/** Run every decorator on a composed card; returns how many painted without throwing. */
export function decorateFrame(f: FrameCanvas): number {
  let ok = 0;
  for (const e of [...entries]) {
    f.ctx.save();
    try { e.draw(f); ok++; } catch (error) { if (import.meta.env?.DEV) console.warn(`[opus-bay photo] frame decorator "${e.id}" threw`, error); }
    finally { f.ctx.restore(); }
  }
  return ok;
}
