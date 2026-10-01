import type { Bilingual, Vec2 } from '../../core/types';
import { LAKE_CENTRE } from './westLakePose';
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
 * read 2026-09-30); Blue Heron Lake — the boathouse rents "American-Made row and pedal boats", "In operation since 1893"
 * (https://blueheronboathouse.com/ , read 2026-09-30), the lake is named after the great blue heron (OSM relation 12908
 * name:etymology; renamed from Stow Lake: world/sf/landmarks/blue-heron-lake.ts).
 */

export interface WestLine { id: string; text: Bilingual }

export const WEST_LINES: Record<'surf1' | 'surf2' | 'kelly' | 'seal1' | 'seal2', WestLine> = {
  surf1: { id: 'w8-w2-surf-1', text: { zh: '看海里！冲浪的人坐在板上等浪呢。', en: 'Look out there — surfers sitting on their boards, waiting for a wave!' } },
  surf2: { id: 'w8-w2-surf-2', text: { zh: '海洋海滩浪大水冷，只有老练的冲浪手才下水。', en: 'Ocean Beach has big waves and cold water — only experienced surfers go out.' } },
  kelly: { id: 'w8-w2-kelly', text: { zh: '旧金山的冲浪，上世纪四十年代就是从这片凯利湾开始的。', en: "San Francisco surfing began right here at Kelly's Cove, back in the 1940s." } },
  seal1: { id: 'w8-w2-seal-1', text: { zh: '那几块礁石叫海豹岩，海狮会爬上去休息。', en: 'Those rocks are Seal Rocks — sea lions climb up there to rest.' } },
  seal2: { id: 'w8-w2-seal-2', text: { zh: '礁石顶上白白的，是鸬鹚留下的鸟粪！', en: "See the white on top? That's cormorant guano!" } },
};

/** Blue Heron Lake (world/sf/westLake.ts) */
export const LAKE_LINES: Record<'boats' | 'heron' | 'since', WestLine> = {
  boats: { id: 'w8-w2-lake-boats', text: { zh: '湖上有人踩脚踏船、有人划船，好悠闲。', en: 'People are out on the lake in pedal boats and rowboats — so peaceful.' } },
  heron: { id: 'w8-w2-lake-heron', text: { zh: '这片湖叫蓝鹭湖。看，岸边就站着一只大蓝鹭！', en: "It's called Blue Heron Lake — look, there's a great blue heron on the shore!" } },
  since: { id: 'w8-w2-lake-1893', text: { zh: '从1893年起，这座船屋就一直租船给游客。', en: 'This boathouse has been renting out boats since 1893.' } },
};

/** a spot: where, how near (u), its lines in order, by day only */
export interface WestSpot { id: string; at: Vec2; r: number; lines: readonly WestLine[]; day: boolean }
export const WEST_SPOTS: readonly WestSpot[] = [
  { id: 'kelly', at: seaPoint(32, 0), r: 60, lines: [WEST_LINES.kelly, WEST_LINES.surf1, WEST_LINES.surf2], day: true },
  { id: 'judah', at: seaPoint(245, 0), r: 70, lines: [WEST_LINES.surf1, WEST_LINES.surf2], day: true },
  { id: 'seal', at: SEAL_ROCKS_CENTRE, r: 60, lines: [WEST_LINES.seal1, WEST_LINES.seal2], day: false },
];
/**
 * W8-W2-review (C2): the heron line has its own small spot on the outer shore path south of the heron, across the narrow
 * channel by the south footbridge (≈ 10 u from it, the sight line clear from the published terrain: scratch
 * opus-qa/w8/w2-rev/heronspot.mts) — from the lake spot's far side Strawberry Hill hid the heron she said "look" at.
 */
export const HERON_SPOT: Vec2 = { x: -263, z: 1002 };
export const LAKE_SPOTS: readonly WestSpot[] = [
  { id: 'lake', at: LAKE_CENTRE, r: 48, lines: [LAKE_LINES.boats], day: true },
  { id: 'heron', at: HERON_SPOT, r: 7, lines: [LAKE_LINES.heron], day: true },
  { id: 'boathouse', at: { x: -306.3, z: 1024.0 }, r: 14, lines: [LAKE_LINES.since], day: false },
];
/** a spot is left again this much beyond its radius (no flicker on its edge) */
export const SPOT_HYSTERESIS = 15;
/** the sky's night factor above which the surf spots stay quiet (the surfers are gone) */
export const LINE_NIGHT_MAX = 0.35;

/** The spots the player is in, each with the line chosen on entering it (null: nothing left to say there). */
export type WestVisits = Map<string, WestLine | null>;

/** The player at (x, z) is still at the spot (inside its radius plus the hysteresis). */
export const atSpot = (s: WestSpot, x: number, z: number): boolean => Math.hypot(x - s.at.x, z - s.at.z) <= s.r + SPOT_HYSTERESIS;

/**
 * Update the visits for the player at (x, z) (W8-W2-review, C3 / P1 / P3): entering a spot (`onFoot`: walking, cycling
 * or sitting — not on a ride; a day spot by day) starts a visit with the first of its lines not said this session;
 * leaving it by r + SPOT_HYSTERESIS ends the visit. Every spot entered counts (two spots entered in one check each get
 * their line). The caller (westToy.ts) keeps offering each visit's line until BAYBAY says it, and the pacer drops a
 * waiting line once the player has left the spot (`atSpot`).
 */
export function westVisits(x: number, z: number, night: number, visits: WestVisits, said: ReadonlySet<string>, onFoot: boolean, spots: readonly WestSpot[] = WEST_SPOTS): void {
  for (const s of spots) {
    if (visits.has(s.id)) { if (!atSpot(s, x, z)) visits.delete(s.id); continue; }
    if (Math.hypot(x - s.at.x, z - s.at.z) > s.r || !onFoot || (s.day && night > LINE_NIGHT_MAX)) continue;
    visits.set(s.id, s.lines.find(l => !said.has(l.id)) ?? null);
  }
}

/** The lines due now: each visit's line not said yet, in the spots' order (tests; westToy.ts walks the same loop). */
export function westLinesDue(visits: WestVisits, said: ReadonlySet<string>, spots: readonly WestSpot[]): WestLine[] {
  const out: WestLine[] = [];
  for (const s of spots) { const l = visits.get(s.id); if (l && !said.has(l.id)) out.push(l); }
  return out;
}
