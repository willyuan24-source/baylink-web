/**
 * W6-G-review · the phone pill's candy bag (halloween/treatBadge.tsx): whether a trick-or-treat street is built round the
 * player (set by treatRun.ts), and the phone rules that hide the badge away from the streets and give it a line of its own
 * near them (injected by play.ts). Kept apart from the component (react-refresh: a .tsx exports components only).
 */

let near = false;
const nearFns = new Set<() => void>();
/** A trick-or-treat street is built round the player now (treatRun.ts). */
export const treatNear = (): boolean => near;
export function setTreatNear(v: boolean): void {
  if (v === near) return;
  near = v;
  for (const fn of [...nearFns]) fn();
}
export function onTreatNear(fn: () => void): () => void {
  nearFns.add(fn);
  return () => { nearFns.delete(fn); };
}

/** The phone rules (the breakpoint of ui/Hud.tsx `badgesBelow`). */
export const CANDY_PHONE_CSS = `
@media (max-width: 600px) {
  .ob-pill-badge:has(> .ob-candy[data-far]) { display: none; }
  .ob-objective-text small .ob-pill-badges:has(.ob-candy:not([data-far])) { display: flex; margin-left: 0; }
  .ob-objective-text small .ob-pill-badges:has(.ob-candy:not([data-far])) > .ob-pill-badge:first-child::before { content: none; }
}
`;

/** Add the phone rules to the page (browser only); returns the off. */
export function injectCandyCss(): () => void {
  if (typeof document === 'undefined' || typeof document.head?.appendChild !== 'function') return () => undefined;
  const el = document.createElement('style');
  el.setAttribute('data-ob', 'g-candy');
  el.textContent = CANDY_PHONE_CSS;
  document.head.appendChild(el);
  return () => { el.remove(); };
}
