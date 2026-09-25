/** Measured by the movement controller, rather than inferred from held keys. */
export type BayBayLocomotion = {
  /** Ground speed in world units per second. Negative values may walk backwards. */
  speed: number;
  /** Accumulated ground distance in world units; teleports should not add distance. */
  distance: number;
  /** Turn rate in radians per second. */
  turn: number;
};

export const BAYBAY_STRIDE = 0.78;
const STANCE_FRACTION = 0.62;

/**
 * The planted paw moves backwards at exactly the character's ground speed.
 * The other paw lifts and returns, so the gait has a real ground-contact phase.
 * Distances are in the unscaled model's units.
 */
export function bayBayPawPose(cycle: number, side: 0 | 1) {
  const phase = ((cycle + side * 0.5) % 1 + 1) % 1;
  const reach = BAYBAY_STRIDE * STANCE_FRACTION / 2;
  if (phase < STANCE_FRACTION) {
    return { lift: 0, travel: reach - BAYBAY_STRIDE * phase, swing: 0 };
  }
  const swing = (phase - STANCE_FRACTION) / (1 - STANCE_FRACTION);
  const returnEase = swing * swing * (3 - 2 * swing);
  return {
    lift: Math.sin(swing * Math.PI) * 0.115,
    travel: -reach + 2 * reach * returnEase,
    swing: Math.sin(swing * Math.PI),
  };
}

/** Model scale determines stride length; a large BayBay does not shuffle faster. */
export function bayBayStrideAdvance(worldDistance: number, scale: number) {
  return worldDistance / (BAYBAY_STRIDE * Math.max(0.05, scale));
}
