import type { Bilingual } from '../core/types';
import { closeOverlay, openOverlay } from '../ui/slots';

/**
 * Wave 5 · lane A · the activity chip (overlay 'play-chip', PlayChip.tsx): one line at the top of the screen while an
 * activity runs — the slides' countdown and 按住趴低, the stair race's clock and 放弃. A tiny store with no React runtime;
 * the overlay itself is registered by play/zones.ts (the zones chunk every activity loads behind).
 */

export interface ChipState {
  /** the activity (hideChip(id) only hides its own chip) */
  id: string;
  title: Bilingual;
  /** a short hint after the title (按住 空格 趴低更快) */
  line?: Bilingual;
  /** a big number or word (3 · 2 · 1 · 冲！, the race clock 6.4) */
  big?: string;
  /** a second status (你领先！ / BAYBAY 在前面) */
  status?: Bilingual;
  /** a quiet button (放弃) */
  action?: { label: Bilingual; run: () => void };
  /** a press-and-hold button (phones: 趴低) */
  hold?: { label: Bilingual; set: (down: boolean) => void };
  /** the glyph before the title */
  icon?: 'slide' | 'stairs' | 'fire' | 'play';
  /** a small gauge (the marshmallow's toast): value 0…1 with a marked band [lo, hi] (shape + a word: colour-blind safe) */
  meter?: { value: number; lo: number; hi: number };
}

export const CHIP_OVERLAY = 'play-chip';

let state: ChipState | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const changed = () => { seq++; for (const fn of [...listeners]) fn(); };

/** The chip showing now (or null). */
export const chipState = (): Readonly<ChipState> | null => state;
/** A number that changes with every update (useSyncExternalStore snapshot). */
export const chipSeq = () => seq;
export function subscribeChip(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }

export function showChip(next: ChipState) {
  const wasOpen = !!state;
  state = next;
  if (!wasOpen) openOverlay(CHIP_OVERLAY);
  changed();
}

/** Change a few fields of the chip showing (nothing when `id` is not the chip's). */
export function patchChip(id: string, patch: Partial<ChipState>) {
  if (!state || state.id !== id) return;
  state = { ...state, ...patch };
  changed();
}

/** Hide the chip (only when it is `id`'s, if given). */
export function hideChip(id?: string) {
  if (!state || (id && state.id !== id)) return;
  state = null;
  closeOverlay(CHIP_OVERLAY);
  changed();
}
