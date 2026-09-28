import type { Bilingual } from '../core/types';

/**
 * Wave 5 · lane A · the 12 crest hops (W5-A9, plan §3.2 A-crest): where the toy car or the bike, driven over the hill
 * crest at speed, leaves the ground (actors/vehicles/collide.ts: the grade under the hull drops by > 0.25 within
 * `crestAhead`), found by a drive sweep of the published city (every drivable centreline with that rule in both ways,
 * then the car and the bike simulated over each candidate at full throttle, keeping the crests where the hop fires within
 * 6 u of the spot and the ride carries on; 2026-09-28, lane A's scratch scan-crests / sim-all). Picked across the city,
 * one street each.
 *
 * APPEND-ONLY (bit i of `play.b['crests']` is spot i). `x, z` the crest on the street's centreline, `heading` the way you
 * drive over it (three.js: facing (sin h, cos h)), `kerbR` / `kerbL` how far the kerbs are to the right / left (u; the
 * pennants stand there), `bike` whether the bike hops there too (the car always does).
 */

export interface CrestSpot { id: string; name: Bilingual; x: number; z: number; heading: number; kerbR: number; kerbL: number; bike: boolean }

const bi = (zh: string, en: string): Bilingual => ({ zh, en });

export const CREST_SPOTS: readonly CrestSpot[] = [
  { id: 'union', name: bi('联合街', 'Union Street'), x: -154.2, z: 240.4, heading: -0.611, kerbR: 1.5, kerbL: 1.75, bike: true },
  { id: 'broadway', name: bi('百老汇街', 'Broadway'), x: -25.1, z: 132.5, heading: 2.531, kerbR: 2.5, kerbL: 2, bike: true },
  { id: 'filbert', name: bi('菲尔伯特街', 'Filbert Street'), x: -107.5, z: 147.4, heading: -0.611, kerbR: 1.25, kerbL: 1.25, bike: false },
  { id: 'divisadero', name: bi('迪维萨德罗街', 'Divisadero Street'), x: -206.4, z: 498.3, heading: 0.961, kerbR: 1.75, kerbL: 1.5, bike: true },
  { id: 'buchanan', name: bi('布坎南街', 'Buchanan Street'), x: -201.8, z: 351.1, heading: -2.179, kerbR: 1.25, kerbL: 1.5, bike: true },
  { id: 'haight', name: bi('海特街', 'Haight Street'), x: 20.6, z: 674, heading: 2.533, kerbR: 1.75, kerbL: 1.75, bike: true },
  { id: 'castro', name: bi('卡斯特罗街', 'Castro Street'), x: 208.9, z: 794.7, heading: -2.264, kerbR: 1.75, kerbL: 2.25, bike: true },
  { id: 'diamond', name: bi('钻石街', 'Diamond Street'), x: 292.4, z: 899.2, heading: -2.264, kerbR: 1.5, kerbL: 1, bike: true },
  { id: 'kansas', name: bi('堪萨斯街', 'Kansas Street'), x: 424.7, z: 465.7, heading: -2.262, kerbR: 1.25, kerbL: 1.5, bike: true },
  { id: 'crescent', name: bi('新月大道', 'Crescent Avenue'), x: 609.7, z: 871.4, heading: 2.31, kerbR: 1.25, kerbL: 1.25, bike: true },
  { id: 'mangels', name: bi('曼格尔斯大道', 'Mangels Avenue'), x: 371.1, z: 1158.7, heading: -0.765, kerbR: 1.25, kerbL: 1.25, bike: true },
  { id: '45th-ave', name: bi('45 大道', '45th Avenue'), x: -616.9, z: 1218.3, heading: 0.861, kerbR: 1.5, kerbL: 1, bike: true },
];

export const CREST_IDS: readonly string[] = CREST_SPOTS.map(s => s.id);
/** A crest hop counts for the spot when it fires within this many u of it. */
export const CREST_R = 9;
/** play.b key: the crests hopped so far (a mask, bit i = spot i). */
export const CREST_KEY = 'crests';

/**
 * A hop up to CREST_LEAD u before the spot on its street (within CREST_LANE of the line) counts too: a long crest has more
 * than one brow, and a fast car leaves the ground at the first (Castro St at full speed in the game hopped 23 u before the
 * spot, at the plateau's edge, 2026-09-28).
 */
export const CREST_LEAD = 26, CREST_LANE = 4;

/** The spot a crest hop at (x, z) belongs to (the nearest within CREST_R, else one whose run-up it is on), or −1. */
export function crestAt(x: number, z: number): number {
  let best = -1, bd = CREST_R;
  CREST_SPOTS.forEach((s, i) => { const d = Math.hypot(s.x - x, s.z - z); if (d <= bd) { bd = d; best = i; } });
  if (best >= 0) return best;
  let lead = CREST_LEAD;
  CREST_SPOTS.forEach((s, i) => {
    const along = (x - s.x) * Math.sin(s.heading) + (z - s.z) * Math.cos(s.heading), lat = (x - s.x) * Math.cos(s.heading) - (z - s.z) * Math.sin(s.heading);
    if (along < 0 && -along <= lead && Math.abs(lat) <= CREST_LANE) { lead = -along; best = i; }
  });
  return best;
}
