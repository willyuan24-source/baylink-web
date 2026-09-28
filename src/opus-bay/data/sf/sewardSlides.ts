/**
 * Seward Street Slides for lane A's slide activity (W5-L3): the two chute lines, where a rider stands at each chute head
 * on the top deck, where they stand up at the foot, the site's arrival (on the deck) and the foot of the slides on the
 * Seward Street sidewalk, in WORLD coordinates (y = world height of the
 * chute bed / the deck), pasted from world/sf/landmarks/seward-street-slides.ts (`SEWARD_SLIDES`, the site's base
 * 20.71, origin (154.7, 832.4), yaw 0) so that lane A's chunk never pulls the landmark library.
 * tests/opus-bay-w5-landmarks.test.ts checks every number against the record (±0.01 u) and the walk data (the deck and
 * each `start` standable and reached on foot from the foot, each `runout` standable) and prints this table to paste
 * when the record moves.
 *
 * A chute runs from `top` (its head at the deck) down to `bottom` (its end on the slope above the sidewalk), facing
 * `heading` (world yaw, downhill toward Seward Street). The walls keep a rider inside; the site's blocker covers the chutes,
 * so a ride moves the rider along the line itself (lane A's cinema / PlayKit), then puts them on `runout`.
 *
 * Facts for BAYBAY's lines (sfrecpark.org "Seward Mini Park", https://sfrecpark.org/facilities/facility/details/sewardminipark-203,
 * checked 2026-09-28): the slides are open 10 am – 5 pm Tuesday to Sunday; bring a piece of cardboard; adults must come
 * with a child; the park closes at sunset. Visitors take the stairs beside the slides up to the top.
 */
export interface SlidePoint { x: number; y: number; z: number }
export interface SewardChute { id: 'west' | 'east'; top: SlidePoint; bottom: SlidePoint; start: SlidePoint; runout: { x: number; z: number }; heading: number }
export const SEWARD_SLIDES_WORLD: {
  site: 'seward-street-slides';
  attraction: 'seward-street-slides';
  arrival: { x: number; z: number; heading: number };
  foot: { x: number; z: number };
  deck: SlidePoint;
  chutes: readonly SewardChute[];
  hours: { days: readonly number[]; open: number; close: number; sourceUrl: string; verifiedAt: string };
} = {
  site: 'seward-street-slides',
  attraction: 'seward-street-slides',
  arrival: { x: 154.6, z: 838.9, heading: 3.142 },
  foot: { x: 154.9, z: 829.8 },
  deck: { x: 154.57, y: 23.99, z: 838.6 },
  chutes: [
    { id: 'west', top: { x: 154.34, y: 23.77, z: 838.1 }, bottom: { x: 154.34, y: 21.09, z: 830.5 }, start: { x: 154.34, y: 23.99, z: 838.5 }, runout: { x: 154.34, z: 830.05 }, heading: 3.142 },
    { id: 'east', top: { x: 154.84, y: 23.79, z: 838.1 }, bottom: { x: 154.84, y: 21.19, z: 830.5 }, start: { x: 154.74, y: 23.99, z: 838.5 }, runout: { x: 154.84, z: 830.05 }, heading: 3.142 },
  ],
  /** Bay weekday numbers (0 = Sunday) and minutes after Bay midnight */
  hours: { days: [2, 3, 4, 5, 6, 0], open: 600, close: 1020, sourceUrl: 'https://sfrecpark.org/facilities/facility/details/sewardminipark-203', verifiedAt: '2026-09-28' },
};
