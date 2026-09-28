import { THIRD_STREET_CORNER } from './bayview-opera-house';
import { CALLE_24_CORNER } from './calle-24';
import { CLEMENT_CORNER } from './clement-street';
import type { CornerDef } from './cornerKit';
import { CHINATOWN_CORNER } from './dragon-gate';
import { HAIGHT_CORNER } from './haight-ashbury';
import { CASTRO_CORNER } from './harvey-milk-plaza';
import { IRVING_CORNER } from './irving-street';
import { NOE_CORNER } from './noe-valley-town-square';
import { JAPANTOWN_CORNER } from './peace-pagoda';

/**
 * Wave 5 · lane L · the signature corners (W5-L4 corners 1–4, W5-L5 corners 5–8, W5-L6 Chinatown; plan §3.6), in the
 * plan's order. Each corner's definition lives in the module of the site it dresses (its boards, stands and ground are
 * there) and is mounted through that site's `mount` (landmarks/cornerKit.ts cornerMount). This list is for the tests,
 * the ground baker (scripts/opus-sf/corners-ground.mts) and QA; the game never imports it.
 */
export const CORNERS: readonly CornerDef[] = [
  IRVING_CORNER, CLEMENT_CORNER, CALLE_24_CORNER, THIRD_STREET_CORNER,
  HAIGHT_CORNER, JAPANTOWN_CORNER, NOE_CORNER, CASTRO_CORNER,
  // W5-L6 (should, with lane V's measured downtown headroom): Chinatown's Grant Avenue
  CHINATOWN_CORNER,
];

export const cornerById = (id: string) => CORNERS.find(c => c.id === id);
