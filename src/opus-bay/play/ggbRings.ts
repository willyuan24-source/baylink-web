import type { Bilingual } from '../core/types';

/**
 * Wave 5 · lane A · the Golden Gate rings (W5-A9, plan §3.2 A-flight "later ring courses: should (GGB-towers course)"):
 * 8 gold rings in a figure-eight round the bridge's two towers — up the bay side past the south tower, over the
 * sagging main cables to the ocean side, past the north tower, back over the north span, down the bay side, over the
 * cables again and out past the south tower on the ocean side. The first flight's machinery (play/firstFlight.ts,
 * course 'ggb'): the rings float to the flyer's height inside the glide's envelope, one instanced layer.
 *
 * Laid out in lane L's bridge frame (world/sf/landmarks/golden-gate-bridge.ts: X0 −865.81, Z0 508.555, yaw 2.4662;
 * s along the deck, the towers at s = ±89.29; c across, + = the bay side) and kept as world points: the towers 16 u
 * abeam (the glide's roof search never sees them there), the crossings over the cables where the glide's soft floor
 * lifts the pelican over them. Floors: max(ground, roofs and tall parts within the ring's reach) as the glide sees
 * them (tests recompute them). ≈ 556 u, 40 s at cruise.
 *
 * It starts by itself when you glide within GGB_NEAR of the bridge's middle and have not flown all 8 yet (once a visit:
 * again after leaving 2 × GGB_NEAR; 跳过 on the chip), the rings taken in the order whose first ring is nearer. It pays
 * by its medal (PlayKit 5 / 10 / 15): the rings have no coins (lane E's ring slots are theirs — Requests).
 *
 * Facts (Wikipedia, "Golden Gate Bridge", checked 2026-09-28): the towers rise 746 ft (227 m) above the water; the
 * bridge opened on May 27, 1937; the colour is "international orange".
 */

export const GGB_ID = 'ggb-rings';
export const GGB_NAME: Bilingual = { zh: '金门大桥金圈', en: 'Golden Gate rings' };
/** The bridge's middle (lane L's frame origin) and the glide radius that starts the course (u). */
export const GGB_MID = { x: -865.8, z: 508.6 };
export const GGB_NEAR = 240;
/** On foot this near the middle (u), BAYBAY's invite (once the pelican is unlocked). */
export const GGB_INVITE_R = 200;

export const GGB_COURSE: readonly { x: number; z: number; floor: number }[] = [
  { x: -728.7, z: 577.4, floor: 0 },   // s −150 c +32: the bay side, off Fort Point
  { x: -786.3, z: 551.7, floor: 0 },   // s −89 c +16: abeam the south tower
  { x: -875.8, z: 521, floor: 0 },     // s 0 c −16: over the cables to the ocean side, mid-span
  { x: -945.3, z: 465.4, floor: 0 },   // s +89 c −16: abeam the north tower
  { x: -982.9, z: 414.8, floor: 21 },  // s +150 c 0: over the north span, the turn
  { x: -925.3, z: 440.4, floor: 0 },   // s +89 c +16: the north tower, bay side
  { x: -855.8, z: 496.1, floor: 0 },   // s 0 c +16: mid-span, bay side
  { x: -806.4, z: 576.7, floor: 0 },   // s −89 c −16: over the cables again, the south tower's ocean side
];

export const GGB_LINES = {
  go: { zh: '金门大桥金圈！绕着两座桥塔飞～', en: 'Golden Gate rings! Round both towers!' },
  tower: { zh: '桥塔比海面高 227 米，1937 年就通车啦！', en: 'The towers stand 227 m over the water — open since 1937!' },
  colour: { zh: '大桥这种橙色，名字叫“国际橙”！', en: 'That orange has a name: International Orange!' },
  invite: { zh: '骑上鹈鹕飞到大桥边，有金圈等你！', en: 'Glide out to the bridge — there are rings!' },
} satisfies Record<string, Bilingual>;
