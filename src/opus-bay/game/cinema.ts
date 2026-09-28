import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { flow, type Cinematic } from './flowStore';
import { holdLock } from './playerLock';

/**
 * Camera shot sequencer. Flow code queues shots; the Canvas-side `CinemaSystem` steps them every frame
 * by writing `runtime.camera.shot` (the camera rig eases to it) and clears it at the end.
 */

export interface Shot {
  position: [number, number, number];
  target: [number, number, number];
  /** ease time handed to the camera rig (s) */
  duration: number;
  /** extra time to hold after easing (s) */
  hold?: number;
  /** caption shown while this shot plays */
  caption?: { zh: string; en: string } | null;
  /** second caption line (e.g. a verified one-line fact) */
  sub?: { zh: string; en: string } | null;
}

interface Sequence { kind: Exclude<Cinematic, null>; shots: Shot[]; index: number; elapsed: number; onDone?: () => void; release: () => void }

let sequence: Sequence | null = null;

export function playShots(kind: Exclude<Cinematic, null>, shots: Shot[], onDone?: () => void) {
  if (sequence) finish(false);
  if (!shots.length) { onDone?.(); return; }
  const reduced = game.get().settings.reducedMotion;
  const list = reduced ? shots.map(shot => ({ ...shot, duration: Math.min(shot.duration, 0.35), hold: (shot.hold ?? 0) + Math.max(0, shot.duration - 0.35) * 0.5 })) : shots;
  // (W5-0b) the feet are held through game/playerLock: however the sequence ends — the last shot, a skip, another
  // sequence taking over — finish() releases the hold, which re-derives the lock (flow's refreshLock). Before, the lock
  // was written here and never recomputed at the end: the first-arrival reveal left the player stuck until the next
  // dialogue closed (owner F1).
  sequence = { kind, shots: list, index: -1, elapsed: 0, onDone, release: () => {} };
  flow.set({ cinematic: kind });
  sequence.release = holdLock('cinema', kind);
}

export const cinemaActive = () => sequence !== null;
export const cinemaKind = () => sequence?.kind ?? null;

function finish(callDone = true) {
  const seq = sequence;
  sequence = null;
  runtime.camera.shot = null;
  flow.set({ cinematic: null, caption: null, captionSub: null });
  // the lock first (the refresher sees the cinema gone), then `done` (which may open a dialogue and lock again)
  seq?.release();
  if (callDone) seq?.onDone?.();
}

/** Skip to the end (Esc / Skip button). */
export function skipCinema() {
  if (sequence) finish(true);
}

/** Called every frame from the Canvas. */
export function stepCinema(dt: number) {
  const seq = sequence;
  if (!seq) return;
  if (seq.index < 0) { seq.index = 0; seq.elapsed = 0; applyShot(seq.shots[0]); return; }
  seq.elapsed += dt;
  const shot = seq.shots[seq.index];
  if (seq.elapsed >= shot.duration + (shot.hold ?? 0)) {
    seq.index++;
    seq.elapsed = 0;
    if (seq.index >= seq.shots.length) { finish(true); return; }
    applyShot(seq.shots[seq.index]);
  }
}

function applyShot(shot: Shot) {
  runtime.camera.shot = { position: shot.position, target: shot.target, duration: shot.duration };
  if (shot.caption !== undefined) flow.set({ caption: shot.caption, captionSub: shot.sub ?? null });
}

/**
 * One-shot request to turn the follow camera toward a point (photo subjects…); consumed by actors/camera.ts.
 * `seconds`: how long the turn takes (default ≈ 1 s, the camera's usual assist); `uncapped`: turn all the way (the
 * waypoint's edge arrow, W4-G2: "转过去" over 0.6 s, even to a target behind you) instead of at most 100°.
 */
export interface FaceRequest { x: number; z: number; seconds?: number; uncapped?: boolean; open?: boolean }
let faceRequest: FaceRequest | null = null;
/**
 * `open` (wave 5, W5-F7, actors/faceOpen): an arrival / landing turn — it also wins over the camera's own arrival yaw
 * (the teleport snap and the city settle look) for a moment, so the player looks at the open ground they turned to.
 */
export function faceCameraToward(x: number, z: number, opts: { seconds?: number; uncapped?: boolean; open?: boolean } = {}) { faceRequest = { x, z, ...opts }; }
export function takeFaceRequest(): FaceRequest | null { const r = faceRequest; faceRequest = null; return r; }

// ---------------------------------------------------------------------------
// C1 · Framing API (polish round 1). Game flow HOLDS a framing for as long as a moment lasts; the camera
// (actors/camera.ts) reads `currentFraming()` every frame and eases in (0.8 s) / out (0.9 s).
// Camera priority: photo mode → runtime.camera.shot → currentFraming() → automatic dialogue two-shot → follow.
// ---------------------------------------------------------------------------

export type Framing =
  /** BAYBAY (or the speaking NPC) + player; `subject` (a world point) rises behind BAYBAY. `bottomCover` = fraction of
   *  the viewport height covered by the dialogue card / sheet (camera applies a view offset so the pair sits above it). */
  | { kind: 'two-shot'; subject?: [number, number, number] | null; bottomCover?: number }
  /** Behind the player, facing `toward` (fishing, telescope approach). */
  | { kind: 'over-shoulder'; toward: { x: number; z: number }; dist?: number; pitch?: number }
  /** An explicit orbit around the player. */
  | { kind: 'view'; yaw: number; pitch: number; dist: number; lookUp?: number; fov?: number };

let framing: Framing | null = null;
let framingSeq = 0;

/** Hold a framing until released (`null`). Returns a token; `releaseFraming(token)` only releases that hold. */
export function holdFraming(f: Framing | null): number {
  framing = f;
  return ++framingSeq;
}
/** Release the framing only if it is still the one taken with `token` (a later hold wins). */
export function releaseFraming(token: number) {
  if (token === framingSeq) framing = null;
}
/** Read every frame by the camera rig. */
export function currentFraming(): Framing | null { return framing; }

/**
 * Fraction of the viewport height covered by the bottom dialogue card (or a bottom sheet), measured from the DOM.
 * Defaults: 0.30 desktop, 0.42 portrait (C1).
 */
export function measureBottomCover(): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 0.3;
  const h = window.innerHeight || 1;
  const portrait = window.innerWidth < window.innerHeight;
  const card = document.querySelector('.ob-dialogue') as HTMLElement | null;
  const top = card?.getBoundingClientRect().top;
  if (top && top > 0 && top < h) return Math.min(0.6, Math.max(0.12, 1 - top / h));
  return portrait ? 0.42 : 0.3;
}
