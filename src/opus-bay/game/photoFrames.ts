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

// --- wave 5 · W5-C7: photo tags (the album) -------------------------------------------------------------------------------

/** Where the shot was taken (the player's spot and area id when the shutter fired). */
export interface PhotoContext { x: number; z: number; area: string; at: Date }
export type PhotoTagger = (c: PhotoContext) => readonly string[] | null | undefined;

const taggers = new Map<string, PhotoTagger>();
/** a tag: lowercase words joined by `:` / `-` (`view:twin-peaks`), ≤ 60 characters */
export const PHOTO_TAG = /^[a-z0-9][a-z0-9:-]{0,59}$/;

/**
 * Register a tagger (lane A's view spots: `view:<spot>` when the shot is taken there; lane D's nature finds): every
 * photo kept in the album (game/album.ts, the city) carries the tags the taggers return, and `photosTagged(tag)` finds
 * them. Returns the unregister; the same id replaces the earlier one; a throwing tagger or a bad tag is skipped.
 */
export function registerPhotoTagger(id: string, fn: PhotoTagger): () => void {
  taggers.set(id, fn);
  return () => { if (taggers.get(id) === fn) taggers.delete(id); };
}

/** The tags for a shot (≤ 16, unique, in registration order). */
export function photoTags(c: PhotoContext): string[] {
  const out: string[] = [];
  for (const fn of [...taggers.values()]) {
    let tags: readonly string[] | null | undefined;
    try { tags = fn(c); } catch { tags = null; }
    for (const tag of tags ?? []) if (typeof tag === 'string' && PHOTO_TAG.test(tag) && !out.includes(tag) && out.length < 16) out.push(tag);
  }
  return out;
}
