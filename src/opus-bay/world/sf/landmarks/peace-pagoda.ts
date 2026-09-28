import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import type { SiteHooks } from '../sites';
import { type CornerDef, type CornerSign, awning, cornerMount, lantern, noren } from './cornerKit';
import { GLOW, NONE, box, cyl, lathe, pyramid, rect, worldPoly } from './kit';
import type { SfLandmark } from './index';
import { clearOf, streetStrips } from './setting';
import { standSpot } from './siteKit3';

/**
 * Japantown Peace Pagoda (T2), Yoshiro Taniguchi, 1968: a five-tier concrete stupa-pagoda on the Peace Plaza,
 * crowned by a bronze sōrin with nine rings. 30 m (100 ft) → H = 3.2 + 0.155·30 = 7.85 u; the sōrin is the top
 * quarter. OSM way 1458363734 (1.8 u footprint). Square plan, so the yaw only lines the plinth up with the plaza.
 */

const X0 = -63.06, Z0 = 450.01, YAW = (55 * Math.PI) / 180;
const CONC = '#ebe7df', ROOF = '#d6d2c9', UNDER = '#8f8a82', BRONZE = '#b08a4c';

function build(b: BatchLike, lod: 0 | 2) {
  // stepped plinth
  box(b, 0, -1.2, 0, 3.2, 1.45, 3.2, '#cfc8bb');
  if (lod === 2) {
    box(b, 0, 0.25, 0, 1.25, 5.3, 1.25, CONC);
    for (let i = 0; i < 5; i++) pyramid(b, 0, 1.55 + i * 0.96, 0, 2.7 - i * 0.28, 2.7 - i * 0.28, 0.34, ROOF);
    cyl(b, 0, 5.7, 0, 0.1, 2.15, BRONZE, NONE, 3);
    return;
  }
  box(b, 0, 0.25, 0, 2.5, 0.3, 2.5, '#ddd7cb');
  // five tiers: a short body under a wide thin concrete roof, each smaller than the last
  let y = 0.55;
  for (let i = 0; i < 5; i++) {
    const body = 1.25 - i * 0.12, h = i === 0 ? 1.0 : 0.62, roof = 2.7 - i * 0.28;
    box(b, 0, y, 0, body, h, body, CONC, GLOW(0.08));
    y += h;
    box(b, 0, y - 0.04, 0, roof - 0.1, 0.06, roof - 0.1, UNDER, NONE);
    pyramid(b, 0, y, 0, roof, roof, 0.34, ROOF);
    {
      box(b, 0, y, 0, roof, 0.1, roof, ROOF, NONE);
      // upturned eave corners and a slim railing band on the body
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(b, (sx * roof) / 2 - sx * 0.12, y + 0.02, (sz * roof) / 2 - sz * 0.12, 0.28, 0.16, 0.28, ROOF, NONE, Math.PI / 4);
      box(b, 0, y - h + 0.08, 0, body + 0.12, 0.1, body + 0.12, UNDER, NONE);
      for (let f = 0; f < 4; f++) box(b, Math.sin((f * Math.PI) / 2) * (body / 2 + 0.01), y - h + 0.22, Math.cos((f * Math.PI) / 2) * (body / 2 + 0.01), 0.36, h * 0.55, 0.04, '#6d665d', GLOW(0.6), (f * Math.PI) / 2);
    }
    y += 0.34;
  }
  // bronze sōrin: base block, nine rings, water-flame finial
  box(b, 0, y - 0.1, 0, 0.5, 0.25, 0.5, BRONZE);
  cyl(b, 0, y, 0, 0.07, 7.85 - y, BRONZE, NONE, 6);
  for (let k = 0; k < 9; k++) lathe(b, [[0.2 - k * 0.008, 0], [0.2 - k * 0.008, 0.06]], 0, y + 0.3 + k * 0.14, 0, BRONZE, NONE, 8);
  lathe(b, [[0.16, 0], [0.2, 0.15], [0.02, 0.45]], 0, 7.4, 0, BRONZE, GLOW(0.3), 6);
}

// ---------------------------------------------------------------------------
// W5-L5 · signature corner 6 (plan §3.6): Japantown's Post Street shops with their lanterns, window shoppers
// ---------------------------------------------------------------------------

/**
 * The shops on Post Street's north side, across from the Peace Plaza, either side of the Buchanan Mall (Osaka Way; its
 * renovation was to start in August 2026 for about a year, with plywood walkways: xpressmagazine.org, 14 May 2026 — so
 * the corner leaves the mall alone). Each gets a short awning, a noren over its door, a pair of paper lanterns glowing
 * at night (a shop's own, not a festival's) and a painted plaque of lane V's atlas (generic words: 茶 Tea reads the same
 * in Japanese, the others English until the atlas has Japanese plaques: Requests); window shoppers by day. Frame: the
 * pagoda's (yaw 55°): Post Street runs along local x at z −7.7 (4.4 u), its north shopfronts face +z at z −9.9, the
 * mall at x 0.6…3.0. The city draws these Edwardian fronts with ground-floor bay windows 0.53 u proud of the wall
 * (world/recipes/city.ts bay(); measured on the published city's L0: tests/opus-bay-w5-corners.test.ts): each shop's
 * dressing hangs on its bay's face, and the window shoppers stand in the gaps between the bays.
 */
const POST_WALL = -9.9, BAY_OUT = 0.53;
/** the shops = the bays on Post Street (local x from, to) */
const J_SHOPS: { x0: number; x1: number; sign: string; awn: string; cloth: string; lantern: string }[] = [
  { x0: -2.6, x1: -0.5, sign: 'market', awn: '#2e3f66', cloth: '#f1e6cf', lantern: '#f1e6cf' },
  { x0: 3.95, x1: 5.25, sign: 'tea', awn: '#8a2f3a', cloth: '#2e3f66', lantern: '#d8453a' },
  { x0: 6.95, x1: 8.25, sign: 'books-en', awn: '#3d5a4c', cloth: '#f1e6cf', lantern: '#d8453a' },
  { x0: 9.85, x1: 11.45, sign: 'cafe', awn: '#6b3f22', cloth: '#8a2f3a', lantern: '#f1e6cf' },
];
const WINDOW_SHOPPERS: { at: Vec2[]; face: Vec2 }[] = [
  { at: [{ x: 0.0, z: -9.4 }], face: { x: -1.5, z: -11.5 } },
  { at: [{ x: 6.15, z: -9.45 }, { x: 9.05, z: -9.45 }], face: { x: 7.6, z: -13 } },
];
/** Post Street's centreline: the crowd's clear lane */
const POST_LANE = { ax: -6, az: -7.7, bx: 15, bz: -7.7 };

export const JAPANTOWN_CORNER: CornerDef = {
  id: 'japantown',
  order: 6,
  site: 'peace-pagoda',
  frame: { x: X0, z: Z0, yaw: YAW },
  name: { zh: '日本城 · 邮政街', en: 'Japantown, Post Street' },
  ambient: { zh: '灯笼下看橱窗的行人', en: 'window shoppers under the lanterns' },
  box: [-4, -11, 12.5, -8.4],
  windows: { day: { from: 10 * 60, to: 20 * 60 } },
  signs: ground => J_SHOPS.map((s): CornerSign => {
    const x = (s.x0 + s.x1) / 2;
    return { id: s.sign, x, y: ground.at(x, POST_WALL + 0.3) + 2.62, z: POST_WALL + BAY_OUT + 0.03, ry: 0, w: Math.min(1.0, s.x1 - s.x0 - 0.3) };
  }),
  build: (b, ground) => {
    const face = POST_WALL + BAY_OUT;
    for (const s of J_SHOPS) {
      const x = (s.x0 + s.x1) / 2, y = ground.at(x, POST_WALL + 0.3);
      awning(b, x, face, s.x1 - s.x0, 0, y + 2.2, 0.36, s.awn, s.awn);
      noren(b, x + (s.x1 - s.x0) * 0.15, face, 0, y + 1.95, s.cloth, Math.min(0.72, s.x1 - s.x0 - 0.5));
      // the pair of lanterns at the bay's corners, on short brackets
      for (const lx of [s.x0 + 0.16, s.x1 - 0.16]) lantern(b, lx, y + 2.0, face + 0.2, s.lantern, 0.13);
    }
  },
  crowds: WINDOW_SHOPPERS.map((w, i) => ({ key: `window-${i}`, when: 'day', spots: w.at, face: w.face, lane: POST_LANE })),
  cache: 'japantown',
  plaza: WINDOW_SHOPPERS.flatMap(w => w.at.map(p => standSpot(p).poly)),
};

export const peacePagoda: SfLandmark & SiteHooks = {
  id: 'peace-pagoda',
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 'terrain',
  exclude: { poly: worldPoly(X0, Z0, YAW, rect(0, 0, 3.6, 3.6)) },
  build,
  walk: { blockers: [{ poly: rect(0, 0, 3.2, 3.2) }] },
  // D2-09: the Peace Plaza walk (clipped by the exclusion) runs on to the pagoda
  ground: streetStrips('peace-pagoda', clearOf([{ poly: rect(0, 0, 3.2, 3.2) }])),
  // W5-L5: the window shoppers' spots on Post Street's north sidewalk (the corner's crowd plaza)
  plaza: WINDOW_SHOPPERS.flatMap(w => w.at.map(p => standSpot(p))),
  // W5-L5: Japantown's corner on Post Street (landmarks/cornerKit.ts)
  mount: cornerMount(JAPANTOWN_CORNER),
};
