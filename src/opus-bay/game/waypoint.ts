import type { Bilingual, Vec2 } from '../core/types';
import { onAlcatraz } from '../world/sf/alcatrazWalk';
import { STREET_FACTOR, TRIP_SPEED } from './tripPlan';

/**
 * Wave 4 · the waypoint (edge compass) and ground-chevron math (lane G, W4-G2 / W4-G6; plan sf-w4-plan.md §4.2
 * "Waypoint (edge compass)" and "Ground chevrons"). Pure: game/Systems.tsx's projector calls these in the integration
 * phase (today it uses game/hudLayout.ts placeWaypoint; this adds the route time, the safe area, the bubble rule that
 * collapses to arrow + time, the edge-arrow turn and the occluded notch).
 *
 *   waypointSeconds      remaining route length / 4.2 u/s on foot, or the trip plan's remaining seconds; straight × 1.25
 *                        only without a path
 *   routeRemaining       the length left along a route polyline from the player's projection on it
 *   waypointSafeArea     x ∈ [12, w − 12] (left of a docked button column), y ∈ [72, h − 124] on phones, [80, h − 120]
 *                        on desktop
 *   placeEdge            the pin on its target, or the arrow on the safe area's edge toward it (behind the camera: mirrored)
 *   layoutWaypoint       + the label under the pin, kept in the safe area and out of the fixed HUD; against BAYBAY's
 *                        bubble: the label drops below it, else collapses to arrow + time ("约 2 分钟"), else the pin shows
 *                        alone (an edge arrow slides along the edge first); occluded on-screen targets draw at 70 % with
 *                        a small "behind" notch
 *   turnYawToward / YawTurn   tap on the edge arrow: the camera turns to the target over 0.6 s ("转过去")
 *   occludedByTerrain    a ground ridge between the camera and the target
 *   freeHintSuppressed   the soft free hint waits during trips, tours and panoramas and for 60 s after an arrival
 *   chevronPoses         3 gold chevrons 2–6 u ahead along the route's next 20 u (manual walking toward a trip target)
 *
 * Screen boxes are CSS px of the canvas, { l, t, r, b } (game/hudLayout.ts Box).
 */

export interface Box { l: number; t: number; r: number; b: number }

export const overlaps = (a: Box, b: Box, pad = 0) => a.l < b.r + pad && a.r > b.l - pad && a.t < b.b + pad && a.b > b.t - pad;
const inside = (a: Box, area: Box) => a.l >= area.l - 1e-6 && a.r <= area.r + 1e-6 && a.t >= area.t - 1e-6 && a.b <= area.b + 1e-6;

export const WAYPOINT = {
  /** safe area insets (px): sides; top / bottom on phones and on desktop */
  side: 12,
  phone: { top: 72, bottom: 124 },
  desktop: { top: 80, bottom: 120 },
  /** gap kept to the dock column / bubble / fixed boxes (px) */
  gap: 6,
  /** pin radius and edge-arrow radius (px) */
  pinR: 9,
  arrowR: 19,
  /** label: its top below the pin / arrow centre, its height (px) */
  labelBelowPin: 16,
  labelBelowArrow: 24,
  labelH: 25,
  /** a label may drop at most this far below its default place to clear the bubble (px) */
  maxDrop: 90,
  /** the short label (arrow + time) width estimate (px) */
  shortW: 74,
  /** occluded on-screen targets draw at this opacity */
  occludedOpacity: 0.7,
  /** the edge arrow's camera turn (s) */
  turnSeconds: 0.6,
  /** the soft free hint stays quiet this long after an arrival moment (ms) */
  quietAfterArrivalMs: 60_000,
} as const;

// ---------------------------------------------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------------------------------------------

/**
 * What is left of a route polyline (flat [x0, z0, x1, z1, …]) from the player's position: the nearest point on the
 * route (searched from `fromSeg`, the last answer's segment, so a route crossing itself does not jump back) and the
 * length from there to the end, plus how far the player stands off the route.
 */
export function routeRemaining(path: readonly number[], pos: Vec2, fromSeg = 0): { length: number; seg: number; off: number } {
  const n = Math.floor(path.length / 2);
  if (n < 2) return { length: n === 1 ? Math.hypot(path[0] - pos.x, path[1] - pos.z) : 0, seg: 0, off: 0 };
  let best = Infinity, bestSeg = Math.min(Math.max(0, fromSeg), n - 2), bestT = 0;
  for (let i = Math.min(Math.max(0, fromSeg), n - 2); i < n - 1; i++) {
    const ax = path[2 * i], az = path[2 * i + 1], bx = path[2 * i + 2], bz = path[2 * i + 3];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    const t = L2 > 1e-9 ? Math.min(1, Math.max(0, ((pos.x - ax) * dx + (pos.z - az) * dz) / L2)) : 0;
    const d = Math.hypot(ax + dx * t - pos.x, az + dz * t - pos.z);
    if (d < best - 1e-9) { best = d; bestSeg = i; bestT = t; }
  }
  const i = bestSeg;
  let length = Math.hypot(path[2 * i + 2] - path[2 * i], path[2 * i + 3] - path[2 * i + 1]) * (1 - bestT);
  for (let j = i + 1; j < n - 1; j++) length += Math.hypot(path[2 * j + 2] - path[2 * j], path[2 * j + 3] - path[2 * j + 1]);
  return { length, seg: i, off: best };
}

/**
 * The waypoint's time (s): the trip plan's remaining seconds when a trip runs (it knows the rides and waits), else the
 * remaining route length on foot (+ the way back onto the route), else the straight line × 1.25.
 */
export function waypointSeconds(o: { pos: Vec2; target: Vec2; path?: readonly number[] | null; tripLeft?: number | null; speed?: number }): number {
  if (typeof o.tripLeft === 'number' && Number.isFinite(o.tripLeft)) return Math.max(0, o.tripLeft);
  const v = o.speed ?? TRIP_SPEED.walk;
  if (o.path && o.path.length >= 4) {
    const r = routeRemaining(o.path, o.pos);
    return (r.length + r.off) / v;
  }
  return (Math.hypot(o.target.x - o.pos.x, o.target.z - o.pos.z) * STREET_FACTOR) / v;
}

/**
 * (W9-N2b, w8 W8I-D-4: on Alcatraz the chip offered "科伊特塔 · 约 2 分钟" on foot across the bay) the waypoint's words
 * when the water lies between the player and the target and no trip is planned: the ferry first, no walking time.
 */
export const FERRY_BACK: Bilingual = { zh: '先坐船回城', en: 'ferry back first' };
export const FERRY_OVER: Bilingual = { zh: '要坐船上岛', en: 'by ferry' };
export function acrossWaterLabel(pos: Vec2, target: Vec2, island: (x: number, z: number) => boolean = onAlcatraz): Bilingual | null {
  const here = island(pos.x, pos.z), there = island(target.x, target.z);
  return here === there ? null : here ? FERRY_BACK : FERRY_OVER;
}

// ---------------------------------------------------------------------------------------------------------------
// Screen layout
// ---------------------------------------------------------------------------------------------------------------

/** The safe area for the pin, arrow and label. `dockLeft` = the left edge of a docked button column on the right (px). */
export function waypointSafeArea(o: { w: number; h: number; phone: boolean; dockLeft?: number | null; inset?: { l: number; r: number } | null }): Box {
  const ins = o.phone ? WAYPOINT.phone : WAYPOINT.desktop;
  // (W9-Q, lane Q) `inset`: the device's safe-area insets left / right (an iPhone on its side: the notch, 47 px) — the edge
  // arrow (转过去) sat at x 12–50 inside the notch band
  const il = o.inset?.l ?? 0, ir = o.inset?.r ?? 0;
  const right = Math.min(o.w - WAYPOINT.side - ir, o.dockLeft != null ? o.dockLeft - WAYPOINT.gap : Infinity);
  return { l: WAYPOINT.side + il, t: ins.top, r: Math.max(WAYPOINT.side + il + 40, right), b: Math.max(ins.top + 40, o.h - ins.bottom) };
}

/**
 * The pin on its target when that is inside the area (inset by the arrow's radius and the label), else an arrow on the
 * area's edge in the target's direction from the centre. `behind` (projected z > 1): the direction is mirrored, as a
 * point behind the camera projects through the centre. `angle` = the arrow's screen angle (rad, atan2(dy, dx)).
 */
export function placeEdge(x: number, y: number, behind: boolean, area: Box): { x: number; y: number; edge: boolean; angle: number } {
  const cx = (area.l + area.r) / 2, cy = (area.t + area.b) / 2;
  let px = x, py = y;
  if (behind) { px = 2 * cx - x; py = 2 * cy - y; }
  // an arrow needs its radius inside the area; the label hangs below the pin
  const r = WAYPOINT.arrowR;
  const inner: Box = { l: area.l + r, t: area.t + r, r: area.r - r, b: area.b - (WAYPOINT.labelBelowArrow + WAYPOINT.labelH) };
  const onScreen = !behind && px >= area.l + WAYPOINT.pinR && px <= area.r - WAYPOINT.pinR && py >= area.t + WAYPOINT.pinR && py <= area.b - (WAYPOINT.labelBelowPin + WAYPOINT.labelH);
  if (onScreen) return { x: px, y: py, edge: false, angle: Math.atan2(py - cy, px - cx) };
  const dx = px - cx;
  let dy = py - cy;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) dy = 1;
  const icx = (inner.l + inner.r) / 2, icy = (inner.t + inner.b) / 2;
  const hx = Math.max(1, (inner.r - inner.l) / 2), hy = Math.max(1, (inner.b - inner.t) / 2);
  const k = Math.min(hx / Math.max(1e-6, Math.abs(dx)), hy / Math.max(1e-6, Math.abs(dy)));
  return { x: icx + dx * k, y: icy + dy * k, edge: true, angle: Math.atan2(dy, dx) };
}

export type LabelMode = 'full' | 'short' | 'none';

export interface WaypointLayoutInput {
  /** projected target (CSS px of the canvas) and whether it is behind the camera */
  x: number;
  y: number;
  behind: boolean;
  area: Box;
  /** full label width (name · time) and the short one (time only) (px) */
  labelW: number;
  shortW?: number;
  /** BAYBAY's bubble (docked or over her), null when none */
  bubble: Box | null;
  /** the fixed HUD boxes (hudLayout scanHudBoxes) */
  boxes?: readonly Box[];
  /** the target is on screen but hidden behind terrain / a building */
  occluded?: boolean;
}

export interface WaypointLayout {
  /** pin / arrow centre */
  x: number;
  y: number;
  edge: boolean;
  angle: number;
  label: { mode: LabelMode; box: Box | null };
  /** the pin / arrow box */
  pin: Box;
  opacity: number;
  /** the small "behind" notch on an occluded on-screen pin */
  notch: boolean;
  /** no free place at all (the waypoint waits a frame) */
  hidden: boolean;
}

const pinBox = (x: number, y: number, edge: boolean): Box => setPin({ l: 0, t: 0, r: 0, b: 0 }, x, y, edge);

// The layout runs on every projection change (every frame while the camera moves): the candidate search below writes
// into these scratch boxes and a precomputed slide table instead of allocating arrays and boxes per candidate; only the
// returned layout is new (review: up to ≈ 600 boxes a call before).
const S_PIN: Box = { l: 0, t: 0, r: 0, b: 0 };
const S_LABEL: Box = { l: 0, t: 0, r: 0, b: 0 };
const S_SPOT = { x: 0, y: 0 };
/** Slides along an arrow's own edge, nearest first: 0, +16, −16, +32, … ±400 px. */
const EDGE_SLIDES: readonly number[] = (() => { const t = [0]; for (let s = 16; s <= 400; s += 16) t.push(s, -s); return t; })();
/** Steps round the nearer corner, down / up the side edge: 16 … 320 px. */
const CORNER_STEPS = 20;

function setPin(out: Box, x: number, y: number, edge: boolean): Box {
  const r = edge ? WAYPOINT.arrowR : WAYPOINT.pinR;
  out.l = x - r; out.t = y - r; out.r = x + r; out.b = y + r;
  return out;
}

/** The label box under a pin / arrow at (x, y), `drop` px lower than the default, slid sideways to stay in the area. */
function setLabel(out: Box, x: number, y: number, edge: boolean, w: number, area: Box, drop = 0): Box {
  const top = y + (edge ? WAYPOINT.labelBelowArrow : WAYPOINT.labelBelowPin) + drop;
  const half = w / 2;
  const cx = Math.min(area.r - half, Math.max(area.l + half, x));
  out.l = cx - half; out.t = top; out.r = cx + half; out.b = top + WAYPOINT.labelH;
  return out;
}

/** A label beside an edge arrow (vertically centred on it), to its right or left. */
function setSide(out: Box, x: number, y: number, w: number, right: boolean): Box {
  const gap = WAYPOINT.arrowR + WAYPOINT.gap;
  const l = right ? x + gap : x - gap - w;
  out.l = l; out.t = y - WAYPOINT.labelH / 2; out.r = l + w; out.b = y + WAYPOINT.labelH / 2;
  return out;
}

function isBlocked(b: Box, area: Box, boxes: readonly Box[], bubble: Box | null): boolean {
  if (!inside(b, area)) return true;
  for (let k = 0; k < boxes.length; k++) if (overlaps(b, boxes[k], WAYPOINT.gap)) return true;
  return !!bubble && overlaps(b, bubble, WAYPOINT.gap);
}

const copyBox = (b: Box): Box => ({ l: b.l, t: b.t, r: b.r, b: b.b });

/**
 * The whole waypoint: pin / arrow + label, inside the safe area, out of the fixed HUD boxes, never under BAYBAY's
 * bubble. Order of retreat (plan §4.2, "fixes M1 for good"): the label under the pin → an edge arrow slides along its
 * edge (below the bubble, else above), its label under it or beside it → the label drops below the bubble (≤ 90 px) →
 * the label collapses to the time alone → the pin / arrow alone. A pin that itself sits under the bubble or a fixed box hides (`hidden`).
 *
 * `x`, `y` = the RAW projection of the target (CSS px of the canvas, NOT mirrored for a target behind the camera) and
 * `behind` = projected z > 1: placeEdge mirrors it itself (mirroring before the call would point the arrow backwards).
 */
export function layoutWaypoint(i: WaypointLayoutInput): WaypointLayout {
  const { area } = i;
  const boxes = i.boxes ?? [];
  const bubble = i.bubble;
  const g = WAYPOINT.gap;
  const e = placeEdge(i.x, i.y, i.behind, area);
  let { x, y } = e;
  const opacity = i.occluded && !e.edge ? WAYPOINT.occludedOpacity : 1;
  const notch = !!i.occluded && !e.edge;
  const shortW = i.shortW ?? WAYPOINT.shortW;
  const result = (mode: LabelMode, box: Box | null): WaypointLayout => ({ x, y, edge: e.edge, angle: e.angle, label: { mode, box: box && copyBox(box) }, pin: pinBox(x, y, e.edge), opacity, notch, hidden: false });

  // an edge arrow may slide along its edge: find a y (or x on the top / bottom edges) where the arrow + label fit
  if (e.edge) {
    const R = WAYPOINT.arrowR;
    const vertical = Math.abs(x - (area.l + R)) < 1 || Math.abs(x - (area.r - R)) < 1;
    const yMax = area.b - WAYPOINT.labelBelowArrow - WAYPOINT.labelH, yMin = area.t + R;
    // candidate arrow spots: along its own edge (nearest first), then round the nearer corner down / up the side edge
    const x0 = x, y0 = y;
    const cornerX = x0 < (area.l + area.r) / 2 ? area.l + R : area.r - R;
    const down = y0 < (area.t + area.b) / 2 ? 1 : -1;
    const nSpots = EDGE_SLIDES.length + (vertical ? 0 : CORNER_STEPS);
    const spot = (k: number) => {
      if (k < EDGE_SLIDES.length) {
        const s = EDGE_SLIDES[k];
        if (vertical) { S_SPOT.x = x0; S_SPOT.y = Math.min(yMax, Math.max(yMin, y0 + s)); } else { S_SPOT.x = Math.min(area.r - R, Math.max(area.l + R, x0 + s)); S_SPOT.y = y0; }
      } else { S_SPOT.x = cornerX; S_SPOT.y = Math.min(yMax, Math.max(yMin, y0 + down * 16 * (k - EDGE_SLIDES.length + 1))); }
    };
    for (let wi = 0; wi < 2; wi++) {
      const w = wi === 0 ? i.labelW : shortW;
      for (let k = 0; k < nSpots; k++) {
        spot(k);
        const nx = S_SPOT.x, ny = S_SPOT.y;
        if (isBlocked(setPin(S_PIN, nx, ny, true), area, boxes, bubble)) continue;
        // the label under the arrow, else beside it (toward the screen centre first: a top-edge arrow under a docked
        // bubble keeps its words on the row beside it)
        const toRight = nx < (area.l + area.r) / 2;
        for (let c = 0; c < 3; c++) {
          const l = c === 0 ? setLabel(S_LABEL, nx, ny, true, w, area) : setSide(S_LABEL, nx, ny, w, c === 1 ? toRight : !toRight);
          if (!isBlocked(l, area, boxes, bubble)) { x = nx; y = ny; return result(w === i.labelW ? 'full' : 'short', l); }
        }
      }
    }
    // no place with a label: the arrow alone where it is, else slid
    for (let k = 0; k < nSpots; k++) {
      spot(k);
      if (!isBlocked(setPin(S_PIN, S_SPOT.x, S_SPOT.y, true), area, boxes, bubble)) { x = S_SPOT.x; y = S_SPOT.y; return result('none', null); }
    }
    return { ...result('none', null), hidden: true };
  }

  // a pin on its target keeps its place: the pin itself under the bubble / HUD → hidden this frame
  if (isBlocked(setPin(S_PIN, x, y, false), area, boxes, bubble)) return { ...result('none', null), hidden: true };
  // the label: under the pin, else dropped below the bubble, else short (time only), else none
  if (!isBlocked(setLabel(S_LABEL, x, y, false, i.labelW, area), area, boxes, bubble)) return result('full', S_LABEL);
  for (let wi = 0; wi < 2; wi++) {
    const w = wi === 0 ? i.labelW : shortW;
    if (bubble) {
      const drop = bubble.b + g - (y + WAYPOINT.labelBelowPin) + 1;
      if (drop > 0 && drop <= WAYPOINT.maxDrop && !isBlocked(setLabel(S_LABEL, x, y, false, w, area, drop), area, boxes, bubble)) return result(w === i.labelW ? 'full' : 'short', S_LABEL);
    }
    if (w !== i.labelW && !isBlocked(setLabel(S_LABEL, x, y, false, w, area), area, boxes, bubble)) return result('short', S_LABEL);
  }
  return result('none', null);
}

// ---------------------------------------------------------------------------------------------------------------
// Camera turn, occlusion, the soft hint
// ---------------------------------------------------------------------------------------------------------------

/** The orbit yaw that puts the camera behind the player looking at the target (runtime.camera.yaw convention). */
export const turnYawToward = (player: Vec2, target: Vec2) => Math.atan2(player.x - target.x, player.z - target.z);

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** The 0.6 s "转过去" turn: eased from the current yaw along the shorter way round. */
export class YawTurn {
  readonly from: number;
  readonly delta: number;
  readonly duration: number;
  private t = 0;
  constructor(from: number, to: number, duration: number = WAYPOINT.turnSeconds) {
    this.from = from;
    this.delta = wrap(to - from);
    this.duration = Math.max(1e-3, duration);
  }
  /** advance by dt (s); returns the yaw now */
  step(dt: number): number { this.t = Math.min(this.duration, this.t + dt); return this.yaw; }
  get done(): boolean { return this.t >= this.duration; }
  get yaw(): number { const k = this.t / this.duration; const e = k * k * (3 - 2 * k); return wrap(this.from + this.delta * e); }
}

/** Does the ground rise above the eye → target sight line anywhere between them (`heightAt` = terrain, null = unknown)? */
export function occludedByTerrain(eye: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }, heightAt: (x: number, z: number) => number | null, steps = 24): boolean {
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = eye.x + (target.x - eye.x) * t, z = eye.z + (target.z - eye.z) * t, y = eye.y + (target.y - eye.y) * t;
    const h = heightAt(x, z);
    if (h !== null && h > y + 0.5) return true;
  }
  return false;
}

/** The soft free-roam hint waits during trips, tours and panoramas and for 60 s after an arrival moment (plan §4.2). */
export function freeHintSuppressed(o: { trip?: boolean; tour?: boolean; panorama?: boolean; lastArrivalMs?: number | null; nowMs: number }): boolean {
  if (o.trip || o.tour || o.panorama) return true;
  return typeof o.lastArrivalMs === 'number' && o.nowMs - o.lastArrivalMs < WAYPOINT.quietAfterArrivalMs;
}

// ---------------------------------------------------------------------------------------------------------------
// Ground chevrons (W4-G6)
// ---------------------------------------------------------------------------------------------------------------

export const CHEVRONS = { count: 3, from: 2, to: 6, look: 20 } as const;

/**
 * Where the gold chevrons stand while the player walks by hand toward a trip target: `count` points from 2 to 6 u
 * ahead along the route (after the player's projection on it), each with the route's heading there (three.js yaw:
 * faces (sin h, cos h)). Fewer near the end of the route; none off a route.
 */
export function chevronPoses(path: readonly number[], pos: Vec2, seg = 0, c: { count: number; from: number; to: number } = CHEVRONS): { x: number; z: number; heading: number }[] {
  const n = Math.floor(path.length / 2);
  if (n < 2) return [];
  const r = routeRemaining(path, pos, seg);
  // the start: the projection on segment r.seg
  const i0 = r.seg;
  const ax = path[2 * i0], az = path[2 * i0 + 1], bx = path[2 * i0 + 2], bz = path[2 * i0 + 3];
  const L = Math.hypot(bx - ax, bz - az) || 1;
  const t0 = Math.min(1, Math.max(0, ((pos.x - ax) * (bx - ax) + (pos.z - az) * (bz - az)) / (L * L)));
  const out: { x: number; z: number; heading: number }[] = [];
  const count = Math.max(1, c.count);
  for (let k = 0; k < count; k++) {
    const ahead = count === 1 ? c.from : c.from + ((c.to - c.from) * k) / (count - 1);
    if (ahead > r.length + 1e-6) break;
    // walk `ahead` along the route from (i0, t0)
    let i = i0, t = t0, left = ahead;
    for (;;) {
      const px = path[2 * i], pz = path[2 * i + 1], qx = path[2 * i + 2], qz = path[2 * i + 3];
      const sl = Math.hypot(qx - px, qz - pz), rem = sl * (1 - t);
      if (left <= rem || i >= n - 2) {
        const tt = sl > 1e-9 ? Math.min(1, t + left / sl) : 1;
        out.push({ x: px + (qx - px) * tt, z: pz + (qz - pz) * tt, heading: Math.atan2(qx - px, qz - pz) });
        break;
      }
      left -= rem; i++; t = 0;
    }
  }
  return out;
}
