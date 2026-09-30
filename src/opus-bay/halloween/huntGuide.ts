import type { WorldLineKey } from './worldLines';

/**
 * Wave 7 · lane H (W7-H8) · helping players find the 40 hidden jack-o'-lanterns (the hunt postcard waits at all 40; the
 * compass hints of economy/hints.ts stay frozen to their four kinds): BAYBAY looks around and says which way the
 * nearest unfound lantern is, seen from the camera — 前面 / 左边 / 右边 / 后面 (four fixed, recordable lines, never a
 * template) — once a lantern a session, the first time the player comes within HUNT_RADAR of it, at most one every
 * SNIFF_GAP seconds, only when BAYBAY may speak (the same gates as the season's other lines). In the world, a little
 * orange wisp floats over every unfound lantern (halloween/hunt.ts) and BAYBAY points it out once a day
 * (worldLines.ts huntWisp, within WISP_LINE_NEAR).
 */

/** BAYBAY notices an unfound lantern within this (u) */
export const HUNT_RADAR = 60;
/** at most one "which way" line every this many seconds */
export const SNIFF_GAP = 40;
/** closer than this the glint and the wisp do it: no line */
export const SNIFF_MIN = 12;
/** the once-a-day wisp line within this (u) of an unfound lantern */
export const WISP_LINE_NEAR = 35;

export type SniffSide = 'ahead' | 'left' | 'right' | 'behind';
const LINE: Readonly<Record<SniffSide, WorldLineKey>> = { ahead: 'huntAhead', left: 'huntLeft', right: 'huntRight', behind: 'huntBehind' };
export const sniffLine = (side: SniffSide): WorldLineKey => LINE[side];

/**
 * Which way (lx, lz) lies from (px, pz) for a camera at orbit yaw `yaw` (the camera sits at the player + (sin yaw,
 * cos yaw) · distance, so it looks along (−sin yaw, −cos yaw) and its right is (cos yaw, −sin yaw)): ahead / behind
 * within ±45° of the view, else left / right.
 */
export function sniffSide(px: number, pz: number, yaw: number, lx: number, lz: number): SniffSide {
  const dx = lx - px, dz = lz - pz;
  const fwd = -Math.sin(yaw) * dx - Math.cos(yaw) * dz;
  const right = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
  if (Math.abs(fwd) >= Math.abs(right)) return fwd >= 0 ? 'ahead' : 'behind';
  return right > 0 ? 'right' : 'left';
}

export interface HuntGuide {
  /**
   * Every ≈ 0.5 s: `near` = the nearest unfound lantern within HUNT_RADAR (or null), `canSpeak` = BAYBAY may speak now.
   * Returns the line to say (and remembers the lantern), or null.
   */
  step(nowS: number, px: number, pz: number, yaw: number, near: { n: number; x: number; z: number } | null, canSpeak: boolean): WorldLineKey | null;
  /** lanterns already pointed out this session */
  told(): readonly number[];
}

export function createHuntGuide(): HuntGuide {
  const told = new Set<number>();
  let last = -Infinity;
  return {
    step: (nowS, px, pz, yaw, near, canSpeak) => {
      if (!near || !canSpeak || told.has(near.n) || nowS - last < SNIFF_GAP) return null;
      const d = Math.hypot(near.x - px, near.z - pz);
      if (d > HUNT_RADAR || d < SNIFF_MIN) return null;
      told.add(near.n);
      last = nowS;
      return sniffLine(sniffSide(px, pz, yaw, near.x, near.z));
    },
    told: () => [...told],
  };
}
