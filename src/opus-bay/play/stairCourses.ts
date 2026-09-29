import type { Bilingual } from '../core/types';

/**
 * Wave 5 · lane A · the stair races' courses (W5-A8, plan §3.2 A-stairs) — DATA ONLY (zones.ts places the 比赛？ prompts
 * from it; stairs.ts runs the race). `line` is the course from the foot to the finish, world (x, z) pairs, found on the
 * published city (scratch probe-via.mts: findPath through the flights) and checked by tests/opus-bay-w5-play-acts.test.ts:
 * every vertex and every 0.5 u between them standable, each leg a walk the nav grid takes (BAYBAY runs it), the foot and
 * the finish on open ground.
 *
 *   filbert   菲尔伯特台阶 → 科伊特塔: Levi's Plaza at the foot of the lower Filbert Steps (OSM way 30518788 "Filbert
 *             Steps"), up the flight to Montgomery St, round Montgomery's switchback and up the last flight to the
 *             plaza below Coit Tower — 68 u, ≈ 10.6 s at a full run.
 *   tiled     马赛克阶梯 → 龟山顶: from Moraga St at 16th Ave up the 16th Avenue Tiled Steps, along 15th Ave and up the
 *             steps to the top of Grand View Park (the 看风景 spot) — 31 u, ≈ 4.8 s.
 *

 *   lyon      里昂街台阶 (W6-W3, lane W): from the foot of the flights by Green St up the Lyon Street Steps between the
 *             clipped hedges and the Presidio's wall to the top landing on Broadway, where the view drops straight onto
 *             the Palace of Fine Arts' dome — 30 u, ≈ 4.6 s. The middle landing's bed used to close the steps (0.76 u
 *             either side, not standable round (−301.5, 507)); it stands along the hedge now
 *             (world/sf/landmarks/lyon-street-steps.ts), and every leg is walked.
 *
 * Facts (checked on the web 2026-09-28): "The Filbert Steps … climbs Telegraph Hill over a series of 400 steps, with
 * houses and public gardens on either side" (https://en.wikipedia.org/wiki/Filbert_Street_(San_Francisco)); the 16th
 * Avenue Tiled Steps: "163 steps", "over 2,000 unique tiles", opened 2005 (https://en.wikipedia.org/wiki/16th_Avenue_Tiled_Steps).
 * Never "the steepest street": Filbert St's block ties for sixth (same Wikipedia page).
 */

export type StairCourseId = 'filbert' | 'tiled' | 'lyon';

export interface StairCourse {
  id: StairCourseId;
  /** the course (the chip, the card) */
  name: Bilingual;
  /** from the foot to the finish: world x, z pairs */
  line: readonly number[];
  /** BAYBAY's line at the top the first time (the real flight) */
  fact: Bilingual;
  /** the real steps of the named flight (the fact) */
  steps: number;
  source: string;
  verifiedAt: string;
}

export const STAIR_COURSES: readonly StairCourse[] = [
  {
    id: 'filbert',
    name: { zh: '菲尔伯特台阶', en: 'Filbert Steps' },
    line: [-23.5, 24.5, -24, 26.5, -37.4, 47.8, -38.6, 54.4, -40.9, 59.6, -46.1, 62.6, -55.5, 62.8, -56.4, 58, -56, 54, -54, 50.5],
    fact: { zh: '菲尔伯特台阶大约 400 级，两边都是花园！', en: 'The Filbert Steps: about 400 steps, gardens on both sides!' },
    steps: 400,
    source: 'https://en.wikipedia.org/wiki/Filbert_Street_(San_Francisco)',
    verifiedAt: '2026-09-28',
  },
  {
    id: 'tiled',
    name: { zh: '马赛克阶梯', en: 'Tiled Steps' },
    line: [-117, 1147.5, -115.3, 1146, -114.4, 1144.1, -111.5, 1141, -109.1, 1140.4, -97.2, 1139.5, -97.1, 1136.6, -99.6, 1132.6],
    fact: { zh: '这 163 级台阶贴了 2000 多块手工瓷砖！', en: 'These 163 steps wear over 2,000 handmade tiles!' },
    steps: 163,
    source: 'https://en.wikipedia.org/wiki/16th_Avenue_Tiled_Steps',
    verifiedAt: '2026-09-28',
  },
  {
    // W6-W3 (lane W). Facts checked on the web 2026-09-29: 288 steps from Broadway down to Green St, manicured gardens,
    // the view of the Palace of Fine Arts (https://inspiredimperfection.com/adventures/lyon-street-steps/); 332 steps
    // Broadway to Vallejo on https://www.sftourismtips.com/lyon-street-steps.html — the count varies by source: about 300
    id: 'lyon',
    name: { zh: '里昂街台阶', en: 'Lyon Street Steps' },
    line: [-312.49, 498.05, -310.09, 499.85, -307.52, 501.42, -305.12, 503.22, -303.24, 504.89, -301.83, 506.33, -300.23, 507.53, -298.45, 508.5, -296.33, 509.84, -294.34, 511.35, -292.24, 513.05],
    fact: { zh: '里昂街台阶大约 300 级，一路修剪整齐的树篱，正对着艺术宫！', en: 'The Lyon Street Steps: about 300 of them, neat hedges, and the Palace of Fine Arts dead ahead!' },
    steps: 300,
    source: 'https://inspiredimperfection.com/adventures/lyon-street-steps/',
    verifiedAt: '2026-09-29',
  },
];

export const stairCourse = (id: string): StairCourse | undefined => STAIR_COURSES.find(c => c.id === id);
export const courseFoot = (c: StairCourse) => ({ x: c.line[0], z: c.line[1] });
export const courseTop = (c: StairCourse) => ({ x: c.line[c.line.length - 2], z: c.line[c.line.length - 1] });
/** The way up at the foot (yaw, three.js: facing (sin h, cos h)). */
export const courseHeading = (c: StairCourse) => Math.atan2(c.line[2] - c.line[0], c.line[3] - c.line[1]);

/**
 * The step counter (今天 412 级): the height a walker gains on stairs, in steps. One unit of rise on the city's stairs
 * counts 29 steps, so the Filbert course (13.6 u of stair rise) counts ≈ 400, the flight's real number; the other
 * flights count in the same toy measure.
 */
export const STEPS_PER_U = 29;
