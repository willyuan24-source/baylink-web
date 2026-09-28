import type { Vec2 } from '../../../core/types';
import { type BatchLike, CBOX, CYL, M } from '../../builder';
import { GLOW, LIT, NONE, WIN, arch, box, cyl, rect, worldPoly } from './kit';
import { type W4Site, siteGround } from './siteKit';

/**
 * The Cable Car Museum, the Washington–Mason powerhouse and car barn (wave 4, P3 · map T2, downtown diet ≤ 1.0k, lod-0
 * ring 200 u): the brick building of 1907–08 that replaced the 1887–89 powerhouse lost in 1906; its winding machinery,
 * electric since 1911, still pulls the cables of all three cable-car lines — from the gallery you watch four cable
 * loops run round the massive sheaves — beside historic cars; the smokestack at the rear is left from the steam days;
 * admission is free (cablecarmuseum.org; Wikipedia; SFMTA). Toy version on the OSM footprint (way 30029681): the red
 * brick barn with its cornice, arched openings along Mason St — the middle one open on a big turning sheave (the animate
 * part) — the brick stack at the back and the low wing. No lettering.
 *
 * Frame: origin (−18.6, 186.3) inside the barn, yaw −34.7°: Mason St runs along z −6.1 (the front), Washington St
 * along x 5.5 (the east corner); both ribbons stay the city's. Two storeys, ≈ 12 m → 5.1 u; the stack to 8 u.
 */

const ID = 'cable-car-museum';
const X0 = -18.6, Z0 = 186.3, YAW = (-34.7 * Math.PI) / 180;
const g = siteGround(ID, 12.9);

const BRICK = '#a5553d', BRICK_DARK = '#8a4633', TRIM = '#e6d7bd', IRON = '#3f4a47', STEEL = '#8d938f';
const BARN = { x0: -3.0, x1: 4.0, z0: -4.3, z1: 3.1, h: 5.1 };
/** the big sheave in the middle opening (just out of the wall, against the dark doorway), its face to the street */
export const SHEAVES = { x: 0.5, z: -4.55, y: 1.55, r: 1.25 };

function build(b: BatchLike, lod: 0 | 2) {
  const cx = (BARN.x0 + BARN.x1) / 2, cz = (BARN.z0 + BARN.z1) / 2, w = BARN.x1 - BARN.x0, d = BARN.z1 - BARN.z0;
  const y = g.at(cx, BARN.z0);
  box(b, cx, y - 1.0, cz, w, BARN.h + 1.0, d, BRICK, lod === 0 ? WIN(4, y, 3) : GLOW(0.05));
  if (lod === 2) return;
  cyl(b, -1.8, y, 2.2, 0.38, 8.0, BRICK_DARK, NONE, 8);
  // tall arched upper windows on the Washington St side
  for (const z of [-2.4, -0.4, 1.6]) arch(b, BARN.x1 + 0.02, y + 2.6, z, 1.0, 1.8, Math.PI / 2, '#4a4038', LIT(y + 2.6));
  box(b, cx, y + BARN.h - 0.3, cz, w + 0.2, 0.35, d + 0.2, TRIM);
  box(b, -4.6, g.at(-4.6, 3.1) - 1.0, 3.1, 3.2, 4.4, 1.6, BRICK_DARK, WIN(4, y, 5));
  // the arched openings along Mason St: dark arches, the middle one lit, the sheave turning in it
  for (const [k, x] of [-2.0, SHEAVES.x, 3.0].entries()) arch(b, x, y, BARN.z0 - 0.02, k === 1 ? 2.8 : 1.4, k === 1 ? 3.3 : 2.4, Math.PI, k === 1 ? '#2d2a26' : '#4a4038', LIT(y));
  // the sheave's bearing post
  box(b, SHEAVES.x, y - 0.1, SHEAVES.z + 0.12, 0.35, SHEAVES.y, 0.2, IRON);
}

/** the big sheave (the animate part, LOCAL to its hub; its face looks out through the arch, the axle along z) with its
 *  spokes painted dark so the turning shows */
function sheaves(b: BatchLike) {
  b.add(CYL(14), M(0, 0, -0.1, 0, SHEAVES.r, 0.2, SHEAVES.r, Math.PI / 2), STEEL);
  for (let k = 0; k < 3; k++) b.add(CBOX(), M(0, 0, -0.14, 0, 0.14, SHEAVES.r * 1.9, 0.04, 0, (k * Math.PI) / 3), IRON);
}

const EXCLUDE: Vec2[] = [{ x: -3.2, z: -4.6 }, { x: 4.0, z: -4.6 }, { x: 4.0, z: 3.4 }, { x: -3.2, z: 3.4 }, { x: -3.2, z: 4.2 }, { x: -6.5, z: 4.2 }, { x: -6.5, z: 2.0 }, { x: -3.2, z: 2.0 }];

export const cableCarMuseum: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  animate: {
    build: sheaves,
    // the cables run at a steady speed: the sheave turns slowly and never stops
    update(obj, t) { obj.position.set(SHEAVES.x, g.at(SHEAVES.x, BARN.z0) + SHEAVES.y, SHEAVES.z); obj.rotation.set(0, 0, t * 0.6); },
  },
  walk: { blockers: [{ poly: rect((BARN.x0 + BARN.x1) / 2, (BARN.z0 + BARN.z1) / 2, BARN.x1 - BARN.x0, BARN.z1 - BARN.z0) }, { poly: rect(-4.6, 3.9, 3.2, 1.6) }] },
  lights: [{ x: SHEAVES.x, y: g.at(SHEAVES.x, BARN.z0) + 1.8, z: BARN.z0 - 0.4, size: 1.4, color: '#ffd9a0' }],
  // the sidewalks along Mason St (the front) and Washington St, and their corner
  plaza: [{ poly: [{ x: -6.0, z: -5.9 }, { x: 5.3, z: -5.9 }, { x: 5.3, z: -4.4 }, { x: -6.0, z: -4.4 }], surface: 'pavement' }, { poly: [{ x: 4.1, z: -4.4 }, { x: 5.4, z: -4.4 }, { x: 5.4, z: 7.0 }, { x: 4.1, z: 7.0 }], surface: 'pavement' }],
  w4: {
    placeId: 'cable-car-museum',
    attractions: ['cable-car-museum'],
    lod0R: 200,
    budget: 1000,
    arrival: { x: 0.8, z: -5.3, heading: 0 },
    photo: { target: [0.5, 2.5, -1], distance: 16, elevation: 0.2, bearing: Math.PI - 0.5 },
    flag: { x: 0.5, z: -0.6, h: 30 },
    height: { realM: 12, u: 5.1, top: 8.4, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/30029681'],
    terrain: [-7, -7, 7, 5],
    terrainStep: 1,
    ringMin: 0.6,
    notes: 'Downtown diet (plan §2.2): ≤ 1.0k, lod0R 200. A corner building between row houses: the walk-around ring crosses its neighbours. Free admission; hours on the card. No lettering on the barn.',
  },
};
