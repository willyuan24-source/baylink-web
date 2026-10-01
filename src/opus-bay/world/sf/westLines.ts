import type { Bilingual, Vec2 } from '../../core/types';
import { SEAL_ROCKS_CENTRE, seaPoint } from './westSeaPose';

/**
 * Wave 8 · lane W2 · BAYBAY's fixed lines on the west side (sf-w8-lead §4: fixed zh + en, no templates, so lane X can
 * voice them by their exact text). world/sf/westSea.ts says them through her pacer when the player walks into a spot.
 *
 * Facts: Ocean Beach — "strong, dangerous currents and powerful waves", cold water (upwelling), "In the 1940s, surfing
 * first began at Kelly's Cove (a section of the beach that is south of the Cliff House)"
 * (https://en.wikipedia.org/wiki/Ocean_Beach,_San_Francisco , read 2026-09-30); Seal Rocks — Steller and California sea
 * lions haul out there (https://en.wikipedia.org/wiki/Seal_Rocks_(San_Francisco) , read 2026-09-30); Brandt's cormorants
 * nest on Seal Rocks, "turning the rocks bright white" with their guano (https://nps.gov/goga/learn/nature/birds.htm ,
 * read 2026-09-30).
 */

export interface WestLine { id: string; text: Bilingual }

export const WEST_LINES: Record<'surf1' | 'surf2' | 'kelly' | 'seal1' | 'seal2', WestLine> = {
  surf1: { id: 'w8-w2-surf-1', text: { zh: '看海里！冲浪的人坐在板上等浪呢。', en: 'Look out there — surfers sitting on their boards, waiting for a wave!' } },
  surf2: { id: 'w8-w2-surf-2', text: { zh: '海洋海滩浪大水冷，只有老练的冲浪手才下水。', en: 'Ocean Beach has big waves and cold water — only experienced surfers go out.' } },
  kelly: { id: 'w8-w2-kelly', text: { zh: '旧金山的冲浪，上世纪四十年代就是从这片凯利湾开始的。', en: "San Francisco surfing began right here at Kelly's Cove, back in the 1940s." } },
  seal1: { id: 'w8-w2-seal-1', text: { zh: '那几块礁石叫海豹岩，海狮会爬上去休息。', en: 'Those rocks are Seal Rocks — sea lions climb up there to rest.' } },
  seal2: { id: 'w8-w2-seal-2', text: { zh: '礁石顶上白白的，是鸬鹚留下的鸟粪！', en: "See the white on top? That's cormorant guano!" } },
};

/** a spot: where, how near (u), its lines in order, by day only */
export interface WestSpot { id: string; at: Vec2; r: number; lines: readonly WestLine[]; day: boolean }
export const WEST_SPOTS: readonly WestSpot[] = [
  { id: 'kelly', at: seaPoint(32, 0), r: 60, lines: [WEST_LINES.kelly, WEST_LINES.surf1, WEST_LINES.surf2], day: true },
  { id: 'judah', at: seaPoint(245, 0), r: 70, lines: [WEST_LINES.surf1, WEST_LINES.surf2], day: true },
  { id: 'seal', at: SEAL_ROCKS_CENTRE, r: 60, lines: [WEST_LINES.seal1, WEST_LINES.seal2], day: false },
];
/** a spot is left again this much beyond its radius (no flicker on its edge) */
export const SPOT_HYSTERESIS = 15;
/** the sky's night factor above which the surf spots stay quiet (the surfers are gone) */
export const LINE_NIGHT_MAX = 0.35;

/**
 * The line to say now, or null: on entering a spot (`onFoot`: walking, cycling or sitting — not on a ride; a day spot
 * by day) the first of its lines not said this session. `inside` (the spots the player is in) is updated; `said` is the caller's (ids it managed to say).
 */
export function westLineDue(x: number, z: number, night: number, inside: Set<string>, said: ReadonlySet<string>, onFoot: boolean): WestLine | null {
  let due: WestLine | null = null;
  for (const s of WEST_SPOTS) {
    const d = Math.hypot(x - s.at.x, z - s.at.z);
    if (inside.has(s.id)) { if (d > s.r + SPOT_HYSTERESIS) inside.delete(s.id); continue; }
    if (d > s.r || !onFoot || (s.day && night > LINE_NIGHT_MAX)) continue;
    inside.add(s.id);
    due ??= s.lines.find(l => !said.has(l.id)) ?? null;
  }
  return due;
}
