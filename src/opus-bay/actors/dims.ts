/**
 * C2 · Character dimensions (polish round 1). Shared by actors (rig scale, camera focus), game (bubble anchor,
 * shots that aim at a character) and QA. Plain numbers only: this module must not import three.
 */

/** Visual scale applied to both hero rigs (the newcomer and BAYBAY). */
export const CHAR_SCALE = 1.15;
/** Player (newcomer) height in world units, feet to hat top. */
export const PLAYER_HEIGHT = 1.5 * CHAR_SCALE;
/** BAYBAY height in world units, feet to ear top. */
export const BAYBAY_HEIGHT = 1.3 * CHAR_SCALE;
/** A point just above the player's head (speech bubbles, "!" markers). */
export const PLAYER_HEAD_Y = PLAYER_HEIGHT + 0.25;
/** A point just above BAYBAY's head (speech bubbles). */
export const BAYBAY_HEAD_Y = BAYBAY_HEIGHT + 0.35;
