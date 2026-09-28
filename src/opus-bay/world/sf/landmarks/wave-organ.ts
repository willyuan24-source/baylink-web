import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, CYL, M } from '../../builder';
import { worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, gstrip, plazaOf } from './siteKit';
import { bandPoly, box3, site3Ground } from './siteKit3';

/**
 * Wave Organ (wave 4, P4 · map T3, the Marina): at the end of the spit that runs out from the Golden Gate Yacht Club,
 * an acoustic sculpture opened in May 1986 — designed by the installation artist Peter Richards with the stonemason
 * George Gonzales for the Exploratorium, honouring its founder Frank Oppenheimer. 25 PVC pipes let the bay's waves
 * sound (rumbles, gurgles, sloshes, hisses) at listening stations among terraces built of granite and marble salvaged
 * from the demolished Laurel Hill Cemetery; it is best heard at high tide (Wikipedia "Wave Organ"; NBC Bay Area; it
 * turned 40 in 2026).
 *
 * Toy: the breakwater from Yacht Road to the tip under a walk the walkers stand on (walk surfaces over the water: the
 * city draws the spit as a thin path with gaps in its walk raster), and at its tip the stone terraces with the pipe
 * mouths at their rim and a few carved blocks as seats. No sound hook here (the pipes are stubs).
 *
 * Frame: origin (−412.3, 290) at the tip, yaw 0 (the city frame): the spit runs from the tip south-west to the West
 * Harbor's land at (−29, 55); water everywhere else. The arrival is lane P's viewing spot on the Marina Green shore
 * (local (18.9, 13.4), across the harbour mouth), where trips end; the walk out starts at Yacht Road.
 */

const ID = 'wave-organ';
const X0 = -412.3, Z0 = 290, YAW = 0;
const g = site3Ground(ID, 0);

const GRANITE = '#a09b92', GRANITE_DARK = '#86827a', PIPE = '#c9c4b8', MARBLE = '#e2ddd3';
/**
 * the spit's line from the terraces to the land of Yacht Road: the city's footway to (−13.2, 25.0), then past the west
 * side of the yacht club's pier (way 239024736 stays the city's) along the city's thin path to the West Harbor's land
 * at (−29, 55) (the city has no breakwater: its path is a 1.2 u corridor with gaps in the walk raster)
 */
const SPIT: Vec2[] = [{ x: -1.0, z: 1.2 }, { x: -0.52, z: 2.45 }, { x: -0.09, z: 4.48 }, { x: -0.55, z: 6.6 }, { x: -1.5, z: 8.63 }, { x: -6.11, z: 15.48 }, { x: -12.2, z: 23.7 }, { x: -13.9, z: 26.4 }, { x: -15.7, z: 29.8 }, { x: -18.9, z: 36.4 }, { x: -22.3, z: 43.6 }, { x: -25.4, z: 49.6 }, { x: -28.6, z: 54.6 }];
/** the deck's top over the water (local y), its nominal lift (the deck is at least this over the walked ground) and the
 *  walk's width (wider than the drawn 1.5 u path: the nav grid's stand clearance leaves about 2.3 u of it, 3 cells) */
const DECK_Y = 0.5, DECK_LIFT = 0.42, DECK_W = 3.4;
/** the terraces at the tip: an upper platform and two steps down toward the harbour mouth (−z) */
const TERRACES = [
  { x: -0.7, z: -0.2, w: 3.0, d: 2.6, y: 0.7 },
  { x: -0.7, z: -1.9, w: 2.6, d: 0.9, y: 0.5 },
  { x: -0.7, z: -2.7, w: 2.0, d: 0.8, y: 0.3 },
];
const TERRACE_POLYS: Vec2[][] = TERRACES.map(t => [{ x: t.x - t.w / 2, z: t.z - t.d / 2 }, { x: t.x + t.w / 2, z: t.z - t.d / 2 }, { x: t.x + t.w / 2, z: t.z + t.d / 2 }, { x: t.x - t.w / 2, z: t.z + t.d / 2 }]);
const PIPES: [number, number, number][] = [[-2.3, -1.2, 0.9], [-2.1, 0.6, 0.6], [0.85, -1.0, 1.0], [0.8, 0.8, 0.7], [-1.5, -3.2, 0.5], [0.1, -3.2, 0.65], [-2.25, -2.4, 0.45], [0.7, -2.3, 0.55]];
const SEATS: [number, number, number][] = [[-1.85, -0.3, 0.3], [0.45, -0.4, -0.2]];

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    box3(b, -0.7, -0.8, -0.8, 3.2, 1.5, 4.6, GRANITE);
    return;
  }
  // the breakwater under the walk: one rubble block per stretch
  for (let i = 0; i + 1 < SPIT.length; i++) {
    const a = SPIT[i], c = SPIT[i + 1], L = Math.hypot(c.x - a.x, c.z - a.z);
    b.add(BOX(), M((a.x + c.x) / 2, -0.8, (a.z + c.z) / 2, Math.atan2(c.x - a.x, c.z - a.z), DECK_W, DECK_Y + 0.72, L + 0.4), i % 2 ? GRANITE : GRANITE_DARK);
  }
  // the terraces, the pipe mouths at their rim, the carved blocks used as seats
  for (const t of TERRACES) box3(b, t.x, -0.8, t.z, t.w, t.y + 0.8, t.d, GRANITE);
  for (const [x, z, h] of PIPES) b.add(CYL(6), M(x, -0.3, z, 0, 0.16, h + 0.7, 0.16), PIPE);
  for (const [x, z, ry] of SEATS) b.add(BOX(), M(x, 0.68, z, ry, 0.7, 0.4, 0.45), MARBLE);
}

function ground(): SiteGroundPoly[] {
  // the walk's top, flat at the deck height (its lift: the deck's least height over the water)
  return gstrip(SPIT, 1.5, GC.path, PAT.earth, g, 3, DECK_Y).map(q => ({ ...q, ys: q.poly.map(() => DECK_Y), y: DECK_Y, lift: DECK_LIFT }));
}

/** the walk deck over the water: one quad per stretch of the spit (local y = the deck) and the terraces */
function deckSurfaces() {
  const out: { poly: Vec2[]; y: number; surface: 'plaza' | 'dirt' }[] = TERRACES.map((t, i) => ({ poly: TERRACE_POLYS[i], y: t.y, surface: 'plaza' }));
  for (let i = 0; i + 1 < SPIT.length; i++) {
    const a = SPIT[i], c = SPIT[i + 1], L = Math.hypot(c.x - a.x, c.z - a.z), ux = (c.x - a.x) / L, uz = (c.z - a.z) / L;
    const px = -uz * (DECK_W / 2), pz = ux * (DECK_W / 2), ex = ux * 0.3, ez = uz * 0.3;
    out.push({ poly: [{ x: a.x - px - ex, z: a.z - pz - ez }, { x: c.x - px + ex, z: c.z - pz + ez }, { x: c.x + px + ex, z: c.z + pz + ez }, { x: a.x + px - ex, z: a.z + pz - ez }], y: DECK_Y, surface: 'dirt' });
  }
  return out;
}

/** exclusion: the terraces and the whole spit to the land (a 1.9 u band either side of its line) */
const EXCLUDE: Vec2[] = bandPoly([{ x: -0.7, z: -3.3 }, { x: -0.7, z: -0.5 }, ...SPIT], 1.9, 0.5);

export const waveOrgan: W4Site = {
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
    blockers: [...PIPES.map(([x, z]) => ({ x, z, r: 0.2 })), ...SEATS.map(([x, z]) => ({ x, z, r: 0.35 }))],
    surfaces: deckSurfaces(),
  },
  ground: ground(),
  plaza: [plazaOf(TERRACE_POLYS[0]), ...deckSurfaces().slice(TERRACES.length, TERRACES.length + 6).map(s => plazaOf(s.poly, 'dirt'))],
  w4: {
    placeId: 'wave-organ',
    attractions: ['wave-organ'],
    arrival: { x: 18.9, z: 13.4, heading: -2.19 },
    photo: { target: [-0.7, 0.6, -1.0], distance: 12, elevation: 0.35, bearing: 0.4 },
    flag: { x: -0.7, z: -0.2, h: 30 },
    height: { realM: 0, u: 1.0, top: 1.4, rule: 'overlook' },
    osm: [],
    terrain: [-31, -4, 2, 56],
    notes: 'The walk out along the spit is a deck over the water (walk surfaces). Heard best at high tide (the card says so).',
  },
};
