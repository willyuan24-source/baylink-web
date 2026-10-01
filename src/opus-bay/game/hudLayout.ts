/**
 * Where the projected DOM may go (lane G1, M1 / DR-3): BAYBAY's speech bubble and the objective waypoint follow things
 * in the world, the rest of the HUD is fixed (place and objective pills, the top stack with the night-view banner, the
 * ride banner, toasts and the goals card, the phone bar, the prompt, the coach mark …). The Canvas ticker
 * (game/Systems.tsx) asks for the fixed boxes at most 4 times a second (`scanHudBoxes`, one layout read) and places
 * the bubble and the waypoint around them with the pure helpers below:
 *
 *   placeBubble    push the bubble below a top box / above a bottom box it would cover, then clamp to the screen
 *   placeWaypoint  the pin / edge arrow + its label: kept out of the fixed boxes; against the bubble an edge arrow
 *                  slides along the edge (below the bubble, else above), a pin on its target keeps its place and
 *                  hides only its label
 *
 * Everything is in CSS px of the canvas; a box is { l, t, r, b }.
 */

export interface Box { l: number; t: number; r: number; b: number }

/**
 * The fixed HUD. Direct children of .ob-hud (pills, bar / buttons, prompt, E2's move chip), the top stack, the touch
 * movement buttons (Hop, bell, 下车, 起飞, 降落: E2 w3 a1), …
 */
export const HUD_BOX_SELECTOR = [
  '.ob-hud > *', '.ob-touch-action > span', '.ob-topstack > *', '.ob-toast', '.ob-goals-card', '.ob-coach', '.ob-lead-chip',
  '.ob-move-buttons > *',
  // wave 4 (lane G, city): the trip card and the arrival peek card
  '.ob-trip-card', '.ob-arrival-card',
  // (part b, verify-district F2) BAYBAY's "问我 / Ask me" badge hangs above her round button, outside its box: the
  // waypoint label sat under it at 1440 × 900 ("…IER 39 stop")
  '.ob-ask-me',
  // W5-N3: the auto-travel chip (BAYBAY 带路中) in the lead chip's place
  '.ob-go-chip',
  // W5-N7: the quiet discovery chip (+3 个地点) under the area pill, outside its box
  '.ob-found-chip',
  // lane F's request (part b): lane A's result card and first-flight chip keep the waypoint and the bubble off them
  '.ob-play-result', '.ob-play-flight',
  // W8-K4 (lane K): the play panels (claw / crab / sourdough / fortune, 那是什么？, the crest polaroid, the sea-lion
  // count) — the game's own lines (差一点点！, 新的纪念品！…) sat under the claw panel on a phone (bubble z 8, panel z 43) and
  // would be voiced with no text to read. A new panel: give its root `data-ob-hud-box` (or add its class here).
  '.ob-sfg-panel', '.ob-play-sky', '.ob-play-snap', '.ob-play-lion-badges', '[data-ob-hud-box]',
].join(', ');

/**
 * Decorations that are aria-hidden (the screen reader has the button's own name) but still cover the screen: scanned
 * although they sit under [aria-hidden="true"].
 */
export const HUD_DECOR = '.ob-ask-me';

const GAP = 6;

export const overlaps = (a: Box, b: Box, pad = 0) => a.l < b.r + pad && a.r > b.l - pad && a.t < b.b + pad && a.b > b.t - pad;

/**
 * The bubble hangs above its anchor point (x, y): box = [x ± w/2, y − 10 − h … y − 10]. Boxes in the upper half of the
 * screen push it down, boxes in the lower half push it up (3 passes), then it is clamped to [minY, maxY] (anchor y).
 * W8-K4b: when it still covers a box after that (a tall play panel above a round button: the passes swung between the
 * two and left the claw's 新的纪念品！ half under the panel on a phone), the free spot nearest the anchor wins — below /
 * above each box, also beside each box within [minX, maxX] (anchor x; the caller's on-screen range).
 */
export function placeBubble(x: number, y: number, w: number, h: number, boxes: readonly Box[], screenH: number, minY: number, maxY: number, minX = -Infinity, maxX = Infinity): { x: number; y: number } {
  let ay = Math.min(maxY, Math.max(minY, y));
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const o of boxes) {
      const me: Box = { l: x - w / 2, r: x + w / 2, t: ay - 10 - h, b: ay - 10 };
      if (!overlaps(me, o, GAP)) continue;
      const next = (o.t + o.b) / 2 < screenH / 2 ? o.b + GAP + 10 + h : o.t - GAP + 10;
      if (Math.abs(next - ay) > 0.5) { ay = next; moved = true; }
    }
    if (!moved) break;
  }
  ay = Math.min(maxY, Math.max(minY, ay));
  if (!bubbleHits(x, ay, w, h, boxes)) return { x, y: ay };
  // (W8-K4b) the nearest free candidate: rows below / above each box (and the anchor's own), columns beside each box
  const y0 = Math.min(maxY, Math.max(minY, y));
  let bx = x, by = ay, best = Infinity;
  for (let i = -1; i < boxes.length * 2; i++) {
    const cy = i < 0 ? y0 : i % 2 === 0 ? boxes[i >> 1].b + GAP + 10 + h + 0.5 : boxes[i >> 1].t - GAP + 10 - 0.5;
    if (cy < minY || cy > maxY) continue;
    for (let j = -1; j < boxes.length * 2; j++) {
      const raw = j < 0 ? x : j % 2 === 0 ? boxes[j >> 1].l - GAP - w / 2 - 0.5 : boxes[j >> 1].r + GAP + w / 2 + 0.5;
      const cx = Math.min(maxX, Math.max(minX, raw));
      const cost = Math.abs(cy - y) + 2 * Math.abs(cx - x);
      if (cost < best && !bubbleHits(cx, cy, w, h, boxes)) { best = cost; bx = cx; by = cy; }
    }
  }
  return { x: bx, y: by };
}

/** The bubble anchored at (x, y) covers (or comes within GAP of) one of the boxes. */
function bubbleHits(x: number, y: number, w: number, h: number, boxes: readonly Box[]): boolean {
  const l = x - w / 2, r = x + w / 2, t = y - 10 - h, b = y - 10;
  for (const o of boxes) if (l < o.r + GAP && r > o.l - GAP && t < o.b + GAP && b > o.t - GAP) return true;
  return false;
}

export interface WaypointBox {
  /** pin / arrow centre */
  x: number; y: number;
  /** edge arrow (true) or the pin on its target */
  edge: boolean;
  /** label half width and its horizontal shift (the label slides to stay on screen) */
  labelHalf: number; labelDx: number;
}

/** The waypoint's box: the pin (±9) or edge arrow (±19) plus its label under it (top +16 / +24, 25 tall). */
export function waypointBox(p: WaypointBox): Box {
  const r = p.edge ? 19 : 9;
  const top = p.edge ? 24 : 16;
  return { l: Math.min(p.x - r, p.x + p.labelDx - p.labelHalf), r: Math.max(p.x + r, p.x + p.labelDx + p.labelHalf), t: p.y - r, b: p.y + top + 25 };
}

/**
 * Keep the waypoint out of the fixed boxes (vertically, like the old top-row clamp) and clear of the bubble.
 * Returns the new centre y, whether the label must hide (a pin on its target under the bubble) and whether the whole
 * waypoint must wait (no free spot between the fixed boxes, e.g. under a tall goals card on a small phone).
 */
export function placeWaypoint(p: WaypointBox, boxes: readonly Box[], bubble: Box | null, screenH: number, minY: number, maxY: number): { y: number; hideLabel: boolean; hidden: boolean } {
  let y = Math.min(maxY, Math.max(minY, p.y));
  const r = p.edge ? 19 : 9, below = (p.edge ? 24 : 16) + 25;
  const blocked = (yy: number) => boxes.some(o => overlaps(waypointBox({ ...p, y: yy }), o, GAP));
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const o of boxes) {
      if (!overlaps(waypointBox({ ...p, y }), o, GAP)) continue;
      const next = (o.t + o.b) / 2 < screenH / 2 ? o.b + GAP + r : o.t - GAP - below;
      if (Math.abs(next - y) > 0.5) { y = next; moved = true; }
    }
    if (!moved) break;
  }
  y = Math.min(maxY, Math.max(minY, y));
  if (blocked(y)) return { y, hideLabel: true, hidden: true };
  if (!bubble || !overlaps(waypointBox({ ...p, y }), bubble, GAP)) return { y, hideLabel: false, hidden: false };
  if (!p.edge) return { y, hideLabel: true, hidden: false };
  // an edge arrow slides along the edge: below the bubble if that is clear of the fixed boxes, else above it
  const under = bubble.b + GAP + r, over = bubble.t - GAP - below;
  const clear = (yy: number) => yy >= minY && yy <= maxY && !blocked(yy);
  if (clear(under)) return { y: under, hideLabel: false, hidden: false };
  if (clear(over)) return { y: over, hideLabel: false, hidden: false };
  return { y, hideLabel: true, hidden: false };
}

// ---------------------------------------------------------------------------
// DOM: the fixed boxes, re-read only when the HUD changed (P8: one layout read per change, none while it is still)
// ---------------------------------------------------------------------------

/** at most this often */
const SCAN_MS = 250;
/** a change is read again once its CSS animation has settled (pills pop, toasts slide in) */
const SETTLE_MS = 450;
/** and a slow safety re-read (4 s) while something needs the boxes (a size change without a DOM mutation, …) */
const SAFETY_MS = 4000;
/** mutations inside the projected elements themselves (written every frame) or the debug readout do not count */
const IGNORE = '.ob-bubble-anchor, .ob-waypoint, .ob-tap-hint, .ob-fish-alert, .ob-debug, .ob-sr, .ob-pano';

let scanned: Box[] = [];
let scannedAt = -Infinity;
let dirtyAt = 0;
let settleAt = 0;
let version = 0;
let observed: Element | null = null;
let observer: MutationObserver | null = null;

/** A number that changes whenever the fixed boxes changed (the ticker's "anything to redo?" signature). */
export const hudBoxesVersion = () => version;

function watch(now: number) {
  if (observed?.isConnected || typeof MutationObserver === 'undefined') return;
  const root = document.querySelector('.ob-overlay:not(.ob-title-layer)');
  if (!root) return;
  observer?.disconnect();
  observed = root;
  observer = new MutationObserver(list => {
    for (const m of list) {
      const el = m.target instanceof Element ? m.target : m.target.parentElement;
      if (el?.closest(IGNORE)) continue;
      dirtyAt = settleAt = performance.now();
      return;
    }
  });
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'aria-expanded', 'data-show'] });
  dirtyAt = settleAt = now;
}

/**
 * The visible fixed HUD boxes relative to `canvas`. `needed` = a bubble or the waypoint is on screen; without it
 * nothing is read. Re-read after a HUD mutation (throttled to 4 Hz, plus once more when its animation has settled),
 * after a canvas size change, and every 4 s as a safety net.
 */
export function scanHudBoxes(canvas: HTMLElement, now: number, needed: boolean, sizeKey: number): readonly Box[] {
  if (!needed) return scanned;
  watch(now);
  if (sizeKey !== lastSize) { lastSize = sizeKey; dirtyAt = settleAt = now; }
  const due = dirtyAt > scannedAt || (settleAt && now - settleAt > SETTLE_MS && settleAt >= scannedAt - SETTLE_MS) || now - scannedAt > SAFETY_MS;
  if (!due || now - scannedAt < SCAN_MS) return scanned;
  if (settleAt && now - settleAt > SETTLE_MS) settleAt = 0;
  scannedAt = now;
  const origin = canvas.getBoundingClientRect();
  const out: Box[] = [];
  let moving = false;
  document.querySelectorAll<HTMLElement>(HUD_BOX_SELECTOR).forEach(el => {
    // a box still sliding / popping in (the goals card slides in over 0.5 s) is read again once it has settled
    // (looping pulses do not count: they never settle and do not move the box)
    if (!moving && el.getAnimations?.().some(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity)) moving = true;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.05 || (el.closest('[aria-hidden="true"]') && !el.matches(HUD_DECOR))) return;
    out.push({ l: r.left - origin.left, t: r.top - origin.top, r: r.right - origin.left, b: r.bottom - origin.top });
  });
  const key = out.map(b => `${b.l | 0},${b.t | 0},${b.r | 0},${b.b | 0}`).join(';');
  const before = scanned.map(b => `${b.l | 0},${b.t | 0},${b.r | 0},${b.b | 0}`).join(';');
  if (key !== before) version++;
  if (moving) settleAt = now;
  scanned = out;
  scans++;
  return scanned;
}
let lastSize = 0;
let scans = 0;
/** QA: how many layout reads the scanner made */
export const hudScanCount = () => scans;
/** QA: the fixed boxes as last read */
export const hudBoxes = (): readonly Box[] => scanned;

/**
 * The Canvas went away (leaving /opus-bay, a remount): stop watching the old overlay and forget its boxes. Without
 * this the module kept the detached overlay (and the React tree hanging off its nodes) alive until the next scan
 * (G1-review).
 */
export function releaseHudLayout() {
  observer?.disconnect();
  observer = null;
  observed = null;
  scanned = [];
  scannedAt = -Infinity;
  dirtyAt = settleAt = 0;
  lastSize = 0;
}
