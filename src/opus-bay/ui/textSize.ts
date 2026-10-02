import { useSyncExternalStore } from 'react';

/**
 * W9-A · Settings › 文字大小 / Text size (review R§6 技术: "设置里缺……字号调节"; the seniors and the phone reader of the
 * review): 100 / 115 / 130 %. A per-device display preference (like game/guidePrefs.ts), its own key `opus-bay:text:v1`
 * (no save bit; `?save=off` keeps it for this page; a blocked storage too). Applied as `data-ob-text` on the game's
 * `.ob-page` (opus-bay.css scales the reading surfaces — the dialogue box, the sheets' bodies, cards, toasts and bubbles —
 * with `zoom`; the HUD frame and the 3D view stay). The play layer applies the stored size at Start (ui/Dialogue.tsx);
 * Settings changes it live. Tiny and dependency-free apart from React (Settings' lazy chunk and the play layer share it).
 */

export const TEXT_SIZES = [100, 115, 130] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export const TEXT_SIZE_KEY = 'opus-bay:text:v1';

const savesOff = () => typeof window !== 'undefined' && /[?&]save=off(?:&|$)/.test(window.location?.search ?? '');
const valid = (v: unknown): v is TextSize => TEXT_SIZES.includes(v as TextSize);
/** A stored value read back (anything else: 100). */
export const parseTextSize = (raw: string | null | undefined): TextSize => { const n = Number(raw); return valid(n) ? n : 100; };

let size: TextSize | null = null;
const listeners = new Set<() => void>();

export function textSize(): TextSize {
  if (size === null) {
    let raw: string | null = null;
    try { raw = typeof window !== 'undefined' ? window.localStorage?.getItem(TEXT_SIZE_KEY) ?? null : null; } catch { /* blocked */ }
    size = parseTextSize(raw);
  }
  return size;
}

/** Put the size on the game's page element(s) (`.ob-page[data-ob-text]`); 100 removes it. */
export function applyTextSize(doc: Pick<Document, 'querySelectorAll'> | null = typeof document !== 'undefined' ? document : null, s: TextSize = textSize()): void {
  if (!doc) return;
  for (const el of doc.querySelectorAll<HTMLElement>('.ob-page')) {
    if (s === 100) el.removeAttribute('data-ob-text'); else el.setAttribute('data-ob-text', String(s));
  }
}

export function setTextSize(next: TextSize): void {
  if (!valid(next)) return;
  size = next;
  if (!savesOff()) { try { window.localStorage?.setItem(TEXT_SIZE_KEY, String(next)); } catch { /* full or blocked: this page only */ } }
  applyTextSize();
  for (const fn of [...listeners]) fn();
}

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
/** React: the size now (Settings' radio group). */
export const useTextSize = (): TextSize => useSyncExternalStore(subscribe, textSize, textSize);

/** (tests) forget the cached size */
export function resetTextSizeForTests(): void { size = null; }
