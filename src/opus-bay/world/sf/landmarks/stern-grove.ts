import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, CBOX, M } from '../../builder';
import { GLOW, LIT, box, worldPoly } from './kit';
import { PAT, type SiteGroundPoly, type W4Site, conifer, gpoly, siteGround } from './siteKit';

/**
 * Stern Grove, the Sigmund Stern Recreation Grove (wave 4, P3 · map T2, the stern-grove site): a eucalyptus, redwood
 * and fir ravine given to the city in 1931 by Rosalie M. Stern in memory of her husband, home since 1938 of the Stern
 * Grove Festival, the country's longest-running free summer music festival (sterngrove.org; PR Newswire 2026). This
 * site is the Rhoda Goldman Concert Meadow at the bottom of the ravine (OSM node 3100972029, the stage way 1513240352):
 * the timber stage with its back wall and a canopy on posts, speaker stacks, the lawn in front with picnic blankets,
 * and log benches along the first two terrace paths on the slope. No performer names, no posters.
 *
 * Frame: origin (60.5, 1416.0) on the lawn, yaw 24°: local +z faces the stage (its deck z 2.0…4.2, replacing the small
 * stage buildings OSM ways 288860176 / 288860177), −z climbs the terraces (paths at z −5.7, ground 8.3; −7.2, 9.4;
 * −8.6, 10.5); the backstage building east (x 6.2…9.5) and the service road stay the city's.
 */

const ID = 'stern-grove';
const X0 = 60.5, Z0 = 1416.0, YAW = (24 * Math.PI) / 180;
const g = siteGround(ID, 6.8);

const WOOD = '#8a6446', WOOD_DARK = '#6b4c35', STONE = '#b7aa94';
const DECK = { x0: -3.6, x1: 3.9, z0: 2.0, z1: 4.4, h: 0.9 };
/** log benches along the terrace paths: [x0, x1, z] */
const BENCH_ROWS: [number, number, number][] = [[-7.6, 3.6, -5.15], [-6.4, 4.2, -6.55]];

function stage(b: BatchLike, lod: 0 | 2) {
  const y = g.at(0, DECK.z0), cx = (DECK.x0 + DECK.x1) / 2, w = DECK.x1 - DECK.x0, d = DECK.z1 - DECK.z0;
  box(b, cx, y - 0.6, (DECK.z0 + DECK.z1) / 2, w, DECK.h + 0.6, d, STONE);
  box(b, cx, y + DECK.h, DECK.z1 - 0.15, w, 3.2, 0.3, WOOD, lod === 0 ? LIT(y + DECK.h) : GLOW(0.1));
  if (lod === 2) return;
  box(b, cx, y + DECK.h - 0.02, (DECK.z0 + DECK.z1) / 2, w - 0.2, 0.05, d - 0.3, '#a07a52');
  // the canopy: two front posts and a roof sloping down to the back wall
  for (const x of [DECK.x0 + 0.3, DECK.x1 - 0.3]) box(b, x, y + DECK.h, DECK.z0 + 0.25, 0.2, 3.3, 0.2, WOOD_DARK);
  b.add(CBOX(), M(cx, y + DECK.h + 3.55, (DECK.z0 + DECK.z1) / 2, 0, w + 0.8, 0.14, d + 0.7, -0.12), '#5f6663');
  // speaker stacks at the front corners, stage lights on the canopy beam
  for (const x of [DECK.x0 - 0.2, DECK.x1 + 0.2]) box(b, x, y - 0.2, DECK.z0 + 0.3, 0.7, 2.4, 0.6, '#2f2f33');
  b.add(BOX(), M(cx, y + DECK.h + 3.1, DECK.z0 + 0.25, 0, w - 0.4, 0.2, 0.2), '#3f3a36', [0, 0, 0, 0.8]);
}

function build(b: BatchLike, lod: 0 | 2) {
  stage(b, lod);
  if (lod === 2) return;
  // log benches on the terraces (a split log on two stumps, every 1.9 u)
  for (const [x0, x1, z] of BENCH_ROWS) {
    for (let x = x0; x + 1.4 <= x1 + 0.01; x += 1.9) {
      const y = g.at(x + 0.7, z);
      b.add(BOX(), M(x + 0.7, y + 0.28, z, 0, 1.5, 0.16, 0.36), WOOD);
      for (const s of [0.25, 1.15]) b.add(BOX(), M(x + s, y - 0.1, z, 0, 0.26, 0.4, 0.26), WOOD_DARK);
    }
  }
  // two tall eucalyptus framing the stage
  conifer(b, DECK.x0 - 1.6, g.at(DECK.x0 - 1.6, 3.4), 3.4, 1.7);
  conifer(b, DECK.x1 + 1.5, g.at(DECK.x1 + 1.5, 1.2), 1.2, 1.5);
}

function ground(): SiteGroundPoly[] {
  const blanket = (x: number, z: number, w: number, d: number, ry: number, color: string) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    const P = (u: number, v: number): Vec2 => ({ x: x + u * c + v * s, z: z - u * s + v * c });
    return gpoly([P(-w / 2, -d / 2), P(w / 2, -d / 2), P(w / 2, d / 2), P(-w / 2, d / 2)], color, PAT.none, g, 0.08);
  };
  return [blanket(-3.4, -1.2, 1.8, 1.4, 0.2, '#c9473a'), blanket(-0.2, -2.6, 1.6, 1.3, -0.3, '#4f7fbf'), blanket(2.6, -0.8, 1.7, 1.3, 0.5, '#e0b04e'), blanket(-5.6, -3.2, 1.5, 1.2, -0.1, '#2f8f88'), blanket(4.6, -3.4, 1.6, 1.2, 0.35, '#7a4fa0')];
}

/** exclusion: the stage (its two small buildings), the lawn and the first two terraces (the backstage building stays) */
const EXCLUDE: Vec2[] = [{ x: -8.6, z: -7.3 }, { x: 5.4, z: -7.3 }, { x: 7.2, z: -1.5 }, { x: 7.2, z: 2.2 }, { x: 5.6, z: 5.0 }, { x: -5.6, z: 5.0 }, { x: -8.6, z: 1.0 }];

export const sternGrove: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: {
    blockers: [
      { poly: [{ x: DECK.x0 - 0.1, z: DECK.z0 }, { x: DECK.x1 + 0.1, z: DECK.z0 }, { x: DECK.x1 + 0.1, z: DECK.z1 }, { x: DECK.x0 - 0.1, z: DECK.z1 }] },
      { x: DECK.x0 - 1.6, z: 3.4, r: 0.3 }, { x: DECK.x1 + 1.5, z: 1.2, r: 0.3 },
    ],
  },
  ground: ground(),
  lights: [{ x: 0.15, y: g.at(0, DECK.z0) + DECK.h + 2.9, z: DECK.z0 + 0.3, size: 2.2, color: '#ffe3b0' }],
  plaza: [{ poly: [{ x: -7.5, z: -4.6 }, { x: 5.2, z: -4.6 }, { x: 5.2, z: 1.6 }, { x: -7.5, z: 1.6 }], surface: 'grass' }],
  w4: {
    placeId: 'osm-w103637554',
    attractions: ['stern-grove'],
    arrival: { x: 0.2, z: -1.4, heading: 0 },
    photo: { target: [0, 2, 1.5], distance: 20, elevation: 0.3, bearing: Math.PI + 0.3 },
    flag: { x: 0.15, z: 3.2, h: 30 },
    height: { realM: 12, u: 5.1, top: 8.0, rule: 'overlook' },
    osm: ['node/3100972029', 'way/1513240352', 'way/288860176', 'way/288860177'],
    terrain: [-10, -9, 8, 7],
    terrainStep: 1,
    notes: 'No performer names or posters (the festival line-up changes every summer: lane C\'s card says 出发前查官网确认).',
  },
};
