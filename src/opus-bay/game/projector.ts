/**
 * DOM elements that follow things in the 3D world (speech bubble over BAYBAY, objective waypoint,
 * debug readout). DOM components register their element here; the Canvas-side ticker writes their
 * transforms every frame — no React state involved.
 */
export const domAnchors = {
  bubble: null as HTMLElement | null,
  waypoint: null as HTMLElement | null,
  waypointLabel: null as HTMLElement | null,
  debug: null as HTMLElement | null,
  /** touch onboarding: pulsing tap marker on the ground between the player and BAYBAY */
  tapHint: null as HTMLElement | null,
  /** fishing "!" over the player's head */
  alert: null as HTMLElement | null,
};

export type DomAnchorKey = keyof typeof domAnchors;

export function registerAnchor(key: DomAnchorKey, el: HTMLElement | null) {
  domAnchors[key] = el;
}

/** Screen space covered by an open side sheet on the right (desktop), so projected DOM stays clear of it. */
export const overlayInsets = { right: 0 };
export function setRightInset(px: number) { overlayInsets.right = Math.max(0, px); }
