import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { flow } from '../game/flowStore';
import { setPuppet } from './puppet';

/**
 * Wave 5 · lane A · part c: what the should activities share (one chunk with play/toyMesh.ts and play/sounds3.ts, split
 * out by the build for the activities that import it): the held-key capture, the "can a game start here" check, BAYBAY
 * pinned to a spot, and two easings.
 */

export const approach = (v: number, to: number, k: number) => (v < to ? Math.min(to, v + k) : Math.max(to, v - k));
export const smooth = (k: number) => k * k * (3 - 2 * k);

/** Playing on foot with nothing modal (no dialogue, photo mode, ride or cinematic): a game may start. */
export function freeOnFoot(): boolean {
  const s = game.get();
  return s.phase === 'playing' && !s.dialogue.nodeId && !s.photoMode && s.riding === null && runtime.move.mode === 'foot' && !flow.get().cinematic;
}

export interface HeldKeys { held(): boolean; isDown(code: string): boolean; off(): void }
/**
 * While an activity runs, `codes` are its own (captured at the window, so the HUD never sees them: E does not open
 * BAYBAY's menu, Space is no hop): `held()` is true while one is down. `onPress` runs on each fresh press.
 */
export function holdKeys(codes: readonly string[], onPress?: (code: string) => void): HeldKeys {
  const down = new Set<string>();
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return { held: () => false, isDown: () => false, off: () => {} };
  const keyDown = (e: KeyboardEvent) => {
    if (!codes.includes(e.code) || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON' || el.isContentEditable)) return;
    // (immediate: a key event aimed at the window itself reaches its other listeners at the target otherwise — input.ts
    // counted such an E and opened BAYBAY's menu once the rally was over)
    e.preventDefault(); e.stopImmediatePropagation();
    if (!e.repeat && !down.has(e.code)) onPress?.(e.code);
    down.add(e.code);
  };
  const keyUp = (e: KeyboardEvent) => { if (codes.includes(e.code)) { down.delete(e.code); e.stopImmediatePropagation(); } };
  const blur = () => down.clear();
  window.addEventListener('keydown', keyDown, true);
  window.addEventListener('keyup', keyUp, true);
  window.addEventListener('blur', blur);
  return {
    held: () => down.size > 0,
    isDown: code => down.has(code),
    off: () => { window.removeEventListener('keydown', keyDown, true); window.removeEventListener('keyup', keyUp, true); window.removeEventListener('blur', blur); down.clear(); },
  };
}

/** BAYBAY's feet and her drawn body at a spot, facing `heading` (call every frame while an activity keeps her there). */
export function pinBaybay(p: { x: number; y: number; z: number; heading: number }) {
  const g = runtime.guide;
  g.x = p.x; g.z = p.z; g.y = p.y; g.heading = p.heading; g.target = null;
  setPuppet('baybay', p);
}
