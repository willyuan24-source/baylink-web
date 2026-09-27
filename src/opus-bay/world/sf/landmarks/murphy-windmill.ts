import type { BatchLike } from '../../builder';
import { LIT, NONE, box, cbox, lathe, worldPoly } from './kit';
import { type W4Site, siteGround } from './siteKit';

/**
 * Murphy Windmill (wave 4, P2 · map T3, the Ocean Beach west site): the south-west windmill of Golden Gate Park by
 * Lincoln Way and the Great Highway, completed in 1908 to pump groundwater for the park, restored and reopened in 2012
 * (Wikipedia). The plan's recipe: the Dutch Windmill's tapering octagonal tower and reefing stage, in other colours so
 * the two mills tell apart (a darker body, a brown dome cap, red-brown sail frames), the sails turning slowly (animate).
 * The Millwright Cottage beside it (OSM way 287927007) stays the city's.
 *
 * Frame: origin (−514.1, 1364.1) on the mill (OSM way 287927026, an octagon of r 1.6), yaw −50°: local +z faces the
 * ocean (the sails' side); the park footway passes east of the foot (local x ≈ 2). Drawn at the Dutch Windmill's
 * recipe size (cap ring 5.1 u, sail radius 4.0) so the park's two mills read as a pair (see `notes`).
 */

const ID = 'murphy-windmill';
const X0 = -514.1, Z0 = 1364.1, YAW = (-50 * Math.PI) / 180;
const g = siteGround(ID, 1.0);

const BODY = '#7f766a', TRIM = '#f4efe4', CAP = '#9a6444', FRAME = '#6e4434', CLOTH = '#efe3cc';
const SAIL_R = 4.0;
const HUB = { y: 5.45, z: 1.2 };

function build(b: BatchLike, lod: 0 | 2) {
  const y0 = g.at(0, 0);
  if (lod === 2) {
    lathe(b, [[1.5, -1.2], [0.95, 5.5]], 0, y0, 0, BODY, NONE, 6);
    lathe(b, [[1.2, 0], [0.05, 1.2]], 0, y0 + 5.1, 0, CAP, NONE, 6);
    return;
  }
  // stone plinth, the shingled octagonal body, a white ring, the dome cap
  lathe(b, [[1.6, -1.2], [1.6, 0.6]], 0, y0, 0, '#a89886', NONE, 8);
  lathe(b, [[1.4, 0], [1.2, 2.2], [0.98, 4.35], [0.92, 4.5]], 0, y0 + 0.6, 0, BODY, [5, y0 + 0.6, -9, 0], 8);
  lathe(b, [[1.05, 0], [1.05, 0.2]], 0, y0 + 4.95, 0, TRIM, NONE, 8);
  // (8 sides like the body: the T3 cap of 800 counts the turning sails too)
  lathe(b, [[1.15, 0], [1.1, 0.35], [0.85, 0.85], [0.45, 1.1], [0.05, 1.2]], 0, y0 + 5.1, 0, CAP, NONE, 8);
  // the reefing stage with its rail and struts
  lathe(b, [[2.05, 0], [2.05, 0.12], [1.25, 0.12]], 0, y0 + 2.55, 0, FRAME, NONE, 8);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    box(b, Math.sin(a) * 1.95, y0 + 2.67, Math.cos(a) * 1.95, 0.08, 0.55, 0.08, FRAME, NONE, a);
    cbox(b, Math.sin(a) * 1.55, y0 + 2.2, Math.cos(a) * 1.55, 0.08, 0.95, 0.08, FRAME, NONE, a, 0.6);
  }
  // door and windows (white frames), the windshaft housing
  box(b, 0, y0 + 0.6, 1.35, 0.6, 1.1, 0.12, '#5a4636', LIT(y0 + 0.6));
  for (const y of [3.3, 4.1]) {
    box(b, 0, y0 + y - 0.05, 1.1 - (y - 3.3) * 0.12, 0.44, 0.55, 0.08, TRIM);
    box(b, 0, y0 + y, 1.14 - (y - 3.3) * 0.12, 0.3, 0.44, 0.08, '#4f5d63', LIT(y0 + y));
  }
  cbox(b, 0, y0 + HUB.y, 0.75, 0.42, 0.42, 0.9, CAP);
}

/** Sails around the hub (local to it): stocks, cloth panels, lattice rails (the Dutch recipe, this mill's colours). */
function buildSails(b: BatchLike) {
  cbox(b, 0, 0, 0.05, 0.36, 0.36, 0.5, CAP);
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    const dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
    const at = (r: number, o: number) => [dx * r + px * o, dy * r + py * o] as const;
    const [sx, sy] = at(SAIL_R / 2 + 0.1, 0);
    cbox(b, sx, sy, -0.05, 0.14, SAIL_R + 0.2, 0.12, FRAME, NONE, 0, 0, a - Math.PI / 2);
    const [cx, cy] = at((SAIL_R + 0.9) / 2, 0.42);
    cbox(b, cx, cy, -0.1, 0.62, SAIL_R - 0.9, 0.03, CLOTH, NONE, 0, 0, a - Math.PI / 2);
    for (const o of [0.1, 0.76]) {
      const [rx, ry] = at((SAIL_R + 0.9) / 2, o);
      cbox(b, rx, ry, -0.08, 0.06, SAIL_R - 0.85, 0.07, FRAME, NONE, 0, 0, a - Math.PI / 2);
    }
    for (let i = 0; i < 3; i++) {
      const [bx, by] = at(1.2 + i * 1.1, 0.43);
      cbox(b, bx, by, -0.08, 0.72, 0.05, 0.06, FRAME, NONE, 0, 0, a - Math.PI / 2);
    }
  }
}

/** exclusion: the mill's octagon and a little more (the footway east of it and the cottage north stay) */
const EXCLUDE = Array.from({ length: 8 }, (_, k) => ({ x: Math.sin((k / 8) * Math.PI * 2 + Math.PI / 8) * 1.75, z: Math.cos((k / 8) * Math.PI * 2 + Math.PI / 8) * 1.75 }));

export const murphyWindmill: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  animate: {
    build: buildSails,
    // a slow turn, the other way round from the Dutch mill
    update(obj, t) {
      obj.position.set(0, g.at(0, 0) + HUB.y, HUB.z);
      obj.rotation.set(0, 0, t * 0.4);
    },
  },
  walk: { blockers: [{ x: 0, z: 0, r: 1.65 }] },
  tall: [{ x: 0, z: HUB.z, r: SAIL_R + 0.3 }],
  plaza: [{ poly: [{ x: 1.4, z: -2.6 }, { x: 3.4, z: -2.2 }, { x: 2.6, z: 6.0 }, { x: 0.6, z: 5.8 }], surface: 'pavement' }, { poly: [{ x: -2.6, z: 1.8 }, { x: 1.4, z: 1.8 }, { x: 1.2, z: 5.8 }, { x: -2.6, z: 5.8 }], surface: 'grass' }],
  w4: {
    placeId: 'murphy-windmill',
    attractions: ['murphy-windmill'],
    arrival: { x: 1.9, z: 2.8, heading: -2.54 },
    photo: { target: [0, 3.5, 0.5], distance: 22, elevation: 0.2, bearing: 0.5 },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 10, u: 6.3, top: 6.4, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/287927026'],
    terrain: [-4, -4, 4, 4],
    notes: 'Height: the OSM tag (10 m) gives 4.75 u by the rule, but the plan asks for the Dutch Windmill recipe, so the tower is drawn at its size (6.3 u to the cap top, sail radius 4.0; the real sails are 114 ft long, Wikipedia).',
  },
};
