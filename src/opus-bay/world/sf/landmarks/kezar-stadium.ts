import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, M } from '../../builder';
import { worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, bench, gstrip, grect, plazaOf, resample, siteGround } from './siteKit';

/**
 * Kezar Stadium (wave 4, P3 · map T3, the park-east group with the Koret carousel and Hippie Hill): the park's
 * stadium in the south-east corner of Golden Gate Park, opened on 2 May 1925 (59,942 seats), the 49ers' home from 1946
 * to 1970 and the Raiders' first home in 1960; demolished in 1989 and rebuilt for 10,000 with a grass infield and an
 * eight-lane all-weather track, the field turned a few degrees away from Frederick St (Wikipedia). Toy version: the two
 * low concrete grandstands along the straights (OSM ways 476260391 and 476260390, same footprints), plain green seat
 * rows, the terracotta track ring with lane lines and the field markings. No team names, marks or colours.
 *
 * Frame: origin (−84.4, 877.1) at the stadium's OSM centre (way 30675203, the place row), yaw 46°: local x runs along
 * the straights, the north-west stand is −z (z −8.5…−6.2), the south-east stand +z (z 6.9…9.3); the city's footway ring
 * passes 0.4–0.6 u behind both stands and around the curved ends (x ±16.9), Kezar Drive beyond it on the north-west.
 * Stands 7 m in OSM → 4.2 u at the back row.
 */

const ID = 'kezar-stadium';
const X0 = -84.4, Z0 = 877.1, YAW = (46 * Math.PI) / 180;
const g = siteGround(ID, 18.2);

const CONCRETE = '#d8d1c3', CONCRETE_SHADE = '#c4bcad', SEAT = '#5f8a6c', SEAT_DARK = '#4d7559', RAIL = '#6d7571';
/** the grandstands: [x0, x1, field-side |z|, back |z|, side (−1 north-west, +1 south-east)] */
const STANDS: [number, number, number, number, -1 | 1][] = [[-9.7, 9.7, 6.2, 8.5, -1], [-9.6, 9.9, 6.9, 9.3, 1]];
const TIERS = 4;
/** the track's centre line: straights from x −5.75 to 5.75 at z 0.4 ± 5.85, round ends */
const TR = 5.85, TX = 5.75, TZ = 0.4;
const oval = (r: number): Vec2[] => {
  const pts: Vec2[] = [];
  for (let k = 0; k <= 12; k++) { const a = -Math.PI / 2 + (k / 12) * Math.PI; pts.push({ x: TX + Math.cos(a) * r, z: TZ + Math.sin(a) * r }); }
  for (let k = 0; k <= 12; k++) { const a = Math.PI / 2 + (k / 12) * Math.PI; pts.push({ x: -TX + Math.cos(a) * r, z: TZ + Math.sin(a) * r }); }
  pts.push(pts[0]);
  return pts;
};

function stand(b: BatchLike, [x0, x1, zf, zb, side]: (typeof STANDS)[number], lod: 0 | 2) {
  const w = x1 - x0, cx = (x0 + x1) / 2, depth = zb - zf;
  const y0 = Math.min(g.at(cx, side * zf), g.at(cx, side * zb));
  if (lod === 2) {
    b.add(BOX(), M(cx, y0 - 0.6, side * (zf + zb) / 2, 0, w, 3.6, depth), CONCRETE);
    return;
  }
  // stepped seating rising away from the field (each tier a concrete step with a seat row on it), a back wall
  const step = depth / TIERS;
  for (let k = 0; k < TIERS; k++) {
    const z = side * (zf + step * (k + 0.5)), h = 0.6 + k * 0.8;
    b.add(BOX(), M(cx, y0 - 0.6, z, 0, w, h + 0.6, step), k % 2 ? CONCRETE_SHADE : CONCRETE);
    b.add(BOX(), M(cx, y0 + h, z + side * 0.05, 0, w - 0.4, 0.22, step * 0.55), k % 2 ? SEAT_DARK : SEAT);
  }
  b.add(BOX(), M(cx, y0 - 0.6, side * (zb - 0.08), 0, w + 0.2, 4.8, 0.16), CONCRETE_SHADE);
  // the rail along the front
  b.add(BOX(), M(cx, y0 + 0.6, side * (zf - 0.05), 0, w, 0.5, 0.06), RAIL);
}

function build(b: BatchLike, lod: 0 | 2) {
  for (const s of STANDS) stand(b, s, lod);
  if (lod === 2) return;
  // benches along the running track's outer edge at the open ends
  for (const x of [-12.95, 12.95]) bench(b, x, g.at(x, TZ), TZ, x > 0 ? -Math.PI / 2 : Math.PI / 2);
}

function ground(): SiteGroundPoly[] {
  const track = gstrip(resample(oval(TR), 2.6), 1.3, '#c2714e', PAT.none, g, 2.6, 0.07);
  const lines = [TR - 0.33, TR + 0.33].flatMap(r => gstrip(resample(oval(r), 2.6), 0.07, GC.stripe, PAT.none, g, 2.6, 0.085));
  // the field's markings: touch lines, goal lines and the halfway line
  const field = [
    ...grect(0, TZ - 3.9, 13.4, 0.08, 0, GC.stripe, PAT.none, g, 14, 0.085),
    ...grect(0, TZ + 3.9, 13.4, 0.08, 0, GC.stripe, PAT.none, g, 14, 0.085),
    ...grect(-6.7, TZ, 0.08, 7.8, 0, GC.stripe, PAT.none, g, 8, 0.085),
    ...grect(6.7, TZ, 0.08, 7.8, 0, GC.stripe, PAT.none, g, 8, 0.085),
    ...grect(0, TZ, 0.08, 7.8, 0, GC.stripe, PAT.none, g, 8, 0.085),
  ];
  return [...track, ...lines, ...field];
}

/** exclusion: the stands and the oval (the footway ring behind the stands and the ends stays the city's) */
const EXCLUDE: Vec2[] = [{ x: -12.2, z: -9.0 }, { x: 12.4, z: -9.0 }, { x: 13.7, z: -4.5 }, { x: 13.7, z: 5.3 }, { x: 12.4, z: 9.7 }, { x: -12.2, z: 9.7 }, { x: -13.7, z: 5.3 }, { x: -13.7, z: -4.5 }];

export const kezarStadium: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: {
    blockers: STANDS.map(([x0, x1, zf, zb, side]) => ({ poly: [{ x: x0, z: side * zf }, { x: x1, z: side * zf }, { x: x1, z: side * zb }, { x: x0, z: side * zb }] })),
  },
  ground: ground(),
  plaza: [plazaOf([{ x: -6.7, z: TZ - 3.9 }, { x: 6.7, z: TZ - 3.9 }, { x: 6.7, z: TZ + 3.9 }, { x: -6.7, z: TZ + 3.9 }], 'grass')],
  w4: {
    placeId: 'osm-w30675203',
    attractions: ['kezar-stadium'],
    arrival: { x: 0, z: TZ, heading: Math.PI },
    photo: { target: [0, 1.5, 0], distance: 34, elevation: 0.55, bearing: 0.5 },
    flag: { x: -12.4, z: TZ, h: 30 },
    height: { realM: 7, u: 4.3, top: 4.9, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/30675203', 'way/476260391', 'way/476260390'],
    terrain: [-14, -10, 14, 11],
    notes: 'No team names, logos or colours (the 49ers and the Raiders are card text only).',
  },
};
