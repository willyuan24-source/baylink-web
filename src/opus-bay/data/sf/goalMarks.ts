import { CAMPUS_PREFIX, CAMPUS_TARGET, CITY_GOAL, LOOP_PREFIX, SIGHTSEEING_STOPS, campusesVisited, loopStopsReached } from './goals';

/**
 * Wave 4 · lane C · W4-C8: the rules of the three wave-4 city goals (sightseeing, metro, campuses). Pure and LAZY (only
 * game/cityMoments.ts, the city chunk, imports it): data/sf/goals.ts keeps the list, the marks' prefixes and the
 * counts the goals card shows, in the main graph.
 */

/** The sightseeing bus (lane T's line id). */
export const LOOP_LINE = 'sf-loop';
/**
 * The metro goal: a real ride of at least METRO_MIN_ARC u (the cable cars' odometer rule) that gets off at the sea (the
 * N at Judah & La Playa) or at Stonestown / SF State (the M at 19th Ave & Winston / Holloway).
 */
export const METRO_ENDS: Readonly<Record<string, readonly string[]>> = {
  'n-judah': ['muni-judah-la-playa'],
  'm-ocean-view': ['muni-19th-winston', 'muni-19th-holloway'],
};
export const METRO_MIN_ARC = 150;
/** The campuses goal: arrival moments (game/arrival.ts, on foot or right after hopping off) at CAMPUS_TARGET of these. */
export const CAMPUS_IDS = ['sf-state-university', 'university-of-san-francisco', 'ucsf-parnassus', 'ucsf-mission-bay', 'ccsf-ocean-campus'] as const;

/** New goalsDone ids for a loop stop the sightseeing bus reached (the `loop:` mark, plus the goal at the 8th). */
export function loopStopReached(goalsDone: readonly string[], station: string): string[] {
  const mark = `${LOOP_PREFIX}${station}`;
  if (goalsDone.includes(mark)) return [];
  return !goalsDone.includes(CITY_GOAL.sightseeing) && loopStopsReached(goalsDone) + 1 >= SIGHTSEEING_STOPS ? [mark, CITY_GOAL.sightseeing] : [mark];
}

/** New goalsDone ids for an arrival moment at a campus (the `campus:` mark, plus the goal at the 3rd), else []. */
export function campusArrived(goalsDone: readonly string[], attraction: string): string[] {
  if (!(CAMPUS_IDS as readonly string[]).includes(attraction)) return [];
  const mark = `${CAMPUS_PREFIX}${attraction}`;
  if (goalsDone.includes(mark)) return [];
  return !goalsDone.includes(CITY_GOAL.campuses) && campusesVisited(goalsDone) + 1 >= CAMPUS_TARGET ? [mark, CITY_GOAL.campuses] : [mark];
}

/**
 * Does a Metro ride count for the metro goal? It got off at `alight` on `line` after boarding at `board`; `arc` = the
 * ride's length along the line when known (≥ METRO_MIN_ARC), else `stationsPassed` (stops made on the way) must be ≥ 2.
 */
export function metroRideCounts(line: string, board: string | null, alight: string, arc: number | null, stationsPassed: number): boolean {
  const ends = METRO_ENDS[line];
  if (!ends?.includes(alight) || !board || board === alight) return false;
  return arc !== null ? arc >= METRO_MIN_ARC : stationsPassed >= 2;
}
