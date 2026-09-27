import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { GLOW, LIT, SF, arch, box, cbox, flowerBed, gable, pyramid, rect, worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, conifer, gfill, hedge, lamp, plazaOf, siteGround } from './siteKit';

/**
 * University of San Francisco · Lone Mountain (wave 4, P1 · map T2, the owner's request; USF, the city's Jesuit
 * university founded in 1855). The hilltop Main Building of 1932 (Henry A. Minton, Spanish Gothic, built for the San
 * Francisco College for Women; USF's since 1978) with its focal tower topped by an iron cross, and the garden stairway
 * ("the Spanish Steps") that climbs to it from Turk Blvd (USF news, FoundSF). St Ignatius Church and the lower campus
 * on Fulton St are the sibling record st-ignatius.ts.
 *
 * Frame: origin (−187.5, 705.4) at the Main Building's centre, yaw 47.8°: local +z faces south-east down the steps
 * to Turk Blvd (z ≈ 20), the block (OSM way 274298058) is x −9.5…9.6, z −5.4…5.4. Heights: OSM 15 m → 5.5 u walls
 * with red tile roofs, the tower to 12.2 u + the cross. The ground falls ≈ 2.7 u from the terrace to Turk Blvd.
 */

const ID = 'usf-lone-mountain';
const X0 = -187.5, Z0 = 705.4, YAW = (47.8 * Math.PI) / 180;
const g = siteGround(ID, 23.4);

const STUCCO = '#efe2c8', STUCCO_SHADE = '#dccbaa', TILE = SF.tileRed, TRIM = '#f7efdd', DARK = '#4d4640', IRON = '#3d3a36';
const MAIN = { x0: -9.5, x1: 9.6, z0: -5.4, z1: 5.4 };
const TOWER = { x: 0.05, z: 4.3, w: 2.6 };
/** the garden stairway: flights between landings from the terrace (z 6.4) down to Turk Blvd's kerb (z 17.8) */
const STAIR_X = -1.2, STAIR_W = 2.6;
const LANDINGS = [6.4, 10.2, 14.0, 17.4];

const top = () => g.at(0, 0) + 5.5;

function main(b: BatchLike, lod: 0 | 2) {
  const y0 = g.at(0, 0), t = top();
  const cx = (MAIN.x0 + MAIN.x1) / 2, cz = (MAIN.z0 + MAIN.z1) / 2, w = MAIN.x1 - MAIN.x0, d = MAIN.z1 - MAIN.z0;
  box(b, cx, -1.2, cz, w, t + 1.2, d, STUCCO, GLOW(0.1));
  // red tile roofs: the long central range and the two end pavilions stepping forward
  gable(b, cx, t, cz, w - 5.2, d - 0.6, 1.5, TILE, STUCCO, 0, 0.25);
  for (const sx of [-1, 1]) {
    const px = sx > 0 ? MAIN.x1 - 1.9 : MAIN.x0 + 1.9;
    box(b, px, -1.2, cz + 0.3, 3.8, t + 1.2 + 0.6, d + 0.6, STUCCO_SHADE, GLOW(0.1));
    gable(b, px, t + 0.6, cz + 0.3, d + 0.6, 3.8, 1.3, TILE, STUCCO_SHADE, Math.PI / 2, 0.2);
  }
  // the focal tower: square shaft, belfry with pointed openings, pinnacles, a tiled spire and the iron cross
  const tb = TOWER, th = t + 3.9;
  box(b, tb.x, -1.2, tb.z, tb.w, th + 1.2, tb.w, STUCCO, GLOW(0.14));
  pyramid(b, tb.x, th + 1.4, tb.z, tb.w - 0.4, tb.w - 0.4, 1.7, TILE);
  if (lod === 2) return;
  box(b, tb.x, th, tb.z, tb.w - 0.3, 1.4, tb.w - 0.3, STUCCO_SHADE, GLOW(0.14));
  for (let f = 0; f < 4; f++) {
    const a = (f * Math.PI) / 2;
    arch(b, tb.x + Math.sin(a) * (tb.w / 2 - 0.13), th + 0.15, tb.z + Math.cos(a) * (tb.w / 2 - 0.13), 0.7, 1.15, a, DARK, LIT(th));
  }
  for (const [ox, oz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const x = tb.x + (ox * (tb.w - 0.2)) / 2, z = tb.z + (oz * (tb.w - 0.2)) / 2;
    box(b, x, th, z, 0.3, 1.9, 0.3, TRIM);
    pyramid(b, x, th + 1.9, z, 0.3, 0.3, 0.45, TRIM);
  }
  box(b, tb.x, th + 1.3, tb.z, tb.w + 0.1, 0.18, tb.w + 0.1, TRIM);
  cbox(b, tb.x, th + 3.45, tb.z, 0.07, 0.7, 0.07, IRON);
  cbox(b, tb.x, th + 3.6, tb.z, 0.42, 0.07, 0.07, IRON);
  // Spanish Gothic front: pointed windows on two floors, buttress piers, the entrance under the tower
  for (let k = -3; k <= 3; k++) {
    if (k === 0) continue;
    const x = k * 1.25;
    for (const fl of [0, 1]) arch(b, x, y0 + 0.6 + fl * 2.1, MAIN.z1 + 0.02, 0.55, 1.3, 0, '#5f6770', LIT(y0 + 0.6 + fl * 2.1));
    if (Math.abs(k) < 3) box(b, x + 0.62, -1.2, MAIN.z1 + 0.12, 0.28, t - 0.6 + 1.2, 0.24, TRIM);
  }
  for (const sx of [-1, 1]) for (const fl of [0, 1]) arch(b, sx * 7.65, y0 + 0.6 + fl * 2.2, MAIN.z1 + 0.32, 0.6, 1.4, 0, '#5f6770', LIT(y0 + 0.6 + fl * 2.2));
  arch(b, tb.x, y0, tb.z + tb.w / 2 + 0.02, 1.2, 2.3, 0, DARK, LIT(y0));
  box(b, tb.x, y0 + 2.5, tb.z + tb.w / 2 + 0.05, 1.8, 0.2, 0.2, TRIM);
}

/** the garden stairway: flights of steps on the slope, landings, hedged planting and cypresses either side */
function stairs(b: BatchLike) {
  for (let i = 0; i + 1 < LANDINGS.length; i++) {
    const z0 = LANDINGS[i] + 0.8, z1 = LANDINGS[i + 1] - 0.8, n = Math.max(3, Math.round((z1 - z0) / 0.45));
    for (let k = 0; k < n; k++) {
      const z = z0 + ((k + 0.5) * (z1 - z0)) / n, y = g.at(STAIR_X, z);
      box(b, STAIR_X, y - 0.35, z, STAIR_W, 0.42, (z1 - z0) / n + 0.02, '#d8ccb6');
    }
    for (const sx of [-1, 1]) {
      const x = STAIR_X + sx * (STAIR_W / 2 + 0.25);
      hedge(b, { x, z: z0 }, { x, z: z1 }, g.at(x, (z0 + z1) / 2), 0.55, 0.35, TRIM);
    }
  }
  for (const [k, z] of [7.4, 11.4, 15.2].entries()) for (const sx of [-1, 1]) {
    const x = STAIR_X + sx * 3.4;
    conifer(b, x, g.at(x, z), z, 1.05 + (k % 2) * 0.15);
    flowerBed(b, STAIR_X + sx * 2.3, g.at(STAIR_X + sx * 2.3, z + 1), z + 1, 1.2, 1.6, k * 2 + (sx > 0 ? 1 : 0));
  }
  for (const l of LAMPS) lamp(b, l.x, g.at(l.x, l.z), l.z);
  for (const [x0, x1] of WALLS) {
    const n = Math.max(1, Math.round((x1 - x0) / 1.5));
    for (let k = 0; k < n; k++) {
      const a = x0 + ((x1 - x0) * k) / n, c = x0 + ((x1 - x0) * (k + 1)) / n, xm = (a + c) / 2;
      const lo = Math.min(g.at(xm, 17.5), g.at(xm, 16.9)) - 0.3, hi = g.at(xm, 16.8) + 0.4;
      box(b, xm, lo, 17.0, c - a + 0.02, hi - lo, 0.35, '#d6c9ad');
    }
  }
}

const LAMPS: Vec2[] = [{ x: STAIR_X - 2.0, z: 6.4 }, { x: STAIR_X + 2.0, z: 10.2 }, { x: STAIR_X - 2.0, z: 14.0 }, { x: STAIR_X + 2.0, z: 17.2 }];

function build(b: BatchLike, lod: 0 | 2) {
  main(b, lod);
  if (lod === 0) stairs(b);
}

/** the terrace in front of the building and the landings; the flights are stairs */
const TERRACE: Vec2[] = [{ x: -5.2, z: 5.5 }, { x: 5.2, z: 5.5 }, { x: 5.2, z: 7.2 }, { x: -5.2, z: 7.2 }];
const GARDEN: Vec2[] = [{ x: -5.0, z: 7.2 }, { x: 3.6, z: 7.2 }, { x: 3.6, z: 16.8 }, { x: -5.0, z: 16.8 }];
/** the garden's retaining wall above Turk Blvd, open where the stairs come down */
const WALLS: [number, number][] = [[-5.0, STAIR_X - STAIR_W / 2], [STAIR_X + STAIR_W / 2, 3.6]];
const FLIGHT: Vec2[] = [{ x: STAIR_X - STAIR_W / 2, z: 7.2 }, { x: STAIR_X + STAIR_W / 2, z: 7.2 }, { x: STAIR_X + STAIR_W / 2, z: 17.6 }, { x: STAIR_X - STAIR_W / 2, z: 17.6 }];

function ground(): SiteGroundPoly[] {
  return [
    ...gfill(TERRACE, GC.plazaWarm, PAT.stone, g, 3),
    ...gfill(GARDEN, GC.lawnDeep, PAT.grass, g, 2),
    ...LANDINGS.slice(1).map(z => gfill([{ x: STAIR_X - STAIR_W / 2, z: z - 0.8 }, { x: STAIR_X + STAIR_W / 2, z: z - 0.8 }, { x: STAIR_X + STAIR_W / 2, z: z + 0.8 }, { x: STAIR_X - STAIR_W / 2, z: z + 0.8 }], GC.plazaWarm, PAT.stone, g, 3, 0.075)).flat(),
  ];
}

const BLOCKERS = [
  { poly: rect((MAIN.x0 + MAIN.x1) / 2, (MAIN.z0 + MAIN.z1) / 2 + 0.3, MAIN.x1 - MAIN.x0, MAIN.z1 - MAIN.z0 + 0.6) },
  { poly: rect(TOWER.x, TOWER.z + 0.2, TOWER.w, TOWER.w) },
  // hedged edges of the stairway (the planting either side is open lawn)
  ...[-1, 1].map(sx => ({ poly: rect(STAIR_X + sx * (STAIR_W / 2 + 0.25), 12.4, 0.4, 7.6) })),
  ...WALLS.map(([x0, x1]) => ({ poly: rect((x0 + x1) / 2, 17.0, x1 - x0, 0.4) })),
];

/** exclusion: the Main Building and the stairway garden (Lone Mountain North, the loop drive and Turk Blvd stay) */
const EXCLUDE: Vec2[] = [
  { x: -10.2, z: -5.9 }, { x: 10.3, z: -5.9 }, { x: 10.3, z: 5.8 }, { x: 3.9, z: 5.8 }, { x: 3.9, z: 17.9 }, { x: -5.3, z: 17.9 },
  { x: -5.3, z: 5.8 }, { x: -10.2, z: 5.8 },
];

export const usfLoneMountain: W4Site = {
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
    blockers: BLOCKERS,
    surfaces: [{ poly: FLIGHT, y: 'terrain', surface: 'stairs' }, { poly: TERRACE, y: 'terrain', surface: 'plaza' }, { poly: GARDEN, y: 'terrain', surface: 'grass' }],
  },
  ground: ground(),
  lights: [
    ...LAMPS.map(l => ({ x: l.x, y: g.at(l.x, l.z) + 3.8, z: l.z, size: 1, color: '#ffd9a0' })),
    { x: TOWER.x, y: top() + 4.5, z: TOWER.z + 2, size: 2.4, color: '#ffe3b0' },
  ],
  plaza: [plazaOf(TERRACE), plazaOf(GARDEN, 'grass')],
  w4: {
    placeId: 'university-of-san-francisco',
    attractions: ['university-of-san-francisco'],
    arrival: { x: STAIR_X, z: 16.6, heading: Math.PI },
    photo: { target: [0, 6, 2], distance: 36, elevation: 0.28, bearing: 0.4 },
    flag: { x: TOWER.x, z: TOWER.z, h: 30 },
    height: { realM: 58, u: 12.8, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/274298058'],
    terrain: [-11, -7, 11, 19],
  },
};

