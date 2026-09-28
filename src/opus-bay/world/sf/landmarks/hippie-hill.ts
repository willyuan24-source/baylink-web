import type { Vec2 } from '../../../core/types';
import { type BatchLike, CBOX, M } from '../../builder';
import { NONE, cyl, worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, gpoly, siteGround } from './siteKit';

/**
 * Hippie Hill (wave 4, P3 · map T3, the park-east group): the sloping meadow above the John F. Kennedy Promenade near
 * the park's east end where the 1967 Summer of Love gathered; a drum circle that anyone can join still plays there on
 * weekend days (Wikipedia; the scouting). The meadow and its paths are the city's; this site is the drum circle: seven
 * toy drummers sitting in a ring on the grass with hand drums (their hands are the animate part, beating), two picnic
 * blankets and a guitar case. A sound hook for the drum loop (lane T) sits at the ring's centre. Never cannabis, never
 * a 4/20 prop (the family card; the official event was cancelled in 2024, 2025 and 2026: KQED, SFist 17 Apr 2026).
 *
 * Frame: origin (−141.8, 852.7) at the attraction, yaw 0 (local = world offsets): the drum ring is at (1.4, 1.8) on
 * the slope, the promenade (JFK Promenade, 2.4 wide) runs 7 u south-west, a footway 2 u west. The meadow rises ≈ 1.5 u
 * toward the north-east.
 */

const ID = 'hippie-hill';
const X0 = -141.8, Z0 = 852.7, YAW = 0;
const g = siteGround(ID, 16.9);

/** the drum circle's centre (local) */
export const DRUM_CIRCLE = { x: 1.4, z: 1.8 };
const N = 7, R = 1.55;
const SHIRTS = ['#c94f7c', '#e0a94a', '#4f7fbf', '#7a4fa0', '#2f8f88', '#d8744a', '#8aa35a'];
const SKIN = ['#e8c2a0', '#c8946a', '#8d5a3b', '#f0d0b0', '#b07850', '#e0b090', '#6f4a33'];

const seat = (k: number) => {
  const a = (k / N) * Math.PI * 2 + 0.3;
  const x = DRUM_CIRCLE.x + Math.sin(a) * R, z = DRUM_CIRCLE.z + Math.cos(a) * R;
  return { x, z, y: g.at(x, z), face: a + Math.PI };
};

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    cyl(b, DRUM_CIRCLE.x, g.at(DRUM_CIRCLE.x, DRUM_CIRCLE.z), DRUM_CIRCLE.z, R + 0.3, 0.7, '#9a7a8a', NONE, 5);
    return;
  }
  for (let k = 0; k < N; k++) {
    const { x, z, y, face } = seat(k), fx = Math.sin(face), fz = Math.cos(face);
    // a seated drummer: folded legs, the body, the head; the hand drum between the knees
    b.add(CBOX(), M(x + fx * 0.2, y + 0.12, z + fz * 0.2, face, 0.5, 0.22, 0.45), '#5d6a7a');
    b.add(CBOX(), M(x, y + 0.55, z, face, 0.46, 0.62, 0.3), SHIRTS[k]);
    b.add(CBOX(), M(x, y + 1.02, z, face, 0.26, 0.28, 0.26), SKIN[k]);
    cyl(b, x + fx * 0.52, y, z + fz * 0.52, 0.2, 0.55, k % 3 ? '#a4774d' : '#7a5a3e', NONE, 6);
  }
  // a guitar case left on the grass
  const gx = DRUM_CIRCLE.x - 2.6, gz = DRUM_CIRCLE.z + 1.2;
  b.add(CBOX(), M(gx, g.at(gx, gz) + 0.1, gz, 0.7, 0.5, 0.16, 1.2), '#3f3a36');
}

/** the beating hands (the animate part: two per drummer, over the drum head) */
function hands(b: BatchLike) {
  for (let k = 0; k < N; k++) {
    const { x, z, y, face } = seat(k), fx = Math.sin(face), fz = Math.cos(face), sx = Math.cos(face), sz = -Math.sin(face);
    for (const s of [-0.12, 0.12]) b.add(CBOX(), M(x + fx * 0.48 + sx * s, y + 0.68, z + fz * 0.48 + sz * s, face, 0.1, 0.08, 0.14), SKIN[k]);
  }
}

function ground(): SiteGroundPoly[] {
  const blanket = (x: number, z: number, w: number, d: number, ry: number, color: string) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    const P = (u: number, v: number): Vec2 => ({ x: x + u * c + v * s, z: z - u * s + v * c });
    return gpoly([P(-w / 2, -d / 2), P(w / 2, -d / 2), P(w / 2, d / 2), P(-w / 2, d / 2)], color, PAT.none, g, 0.08);
  };
  return [blanket(DRUM_CIRCLE.x + 2.9, DRUM_CIRCLE.z - 0.6, 1.8, 1.4, 0.4, '#d8744a'), blanket(DRUM_CIRCLE.x - 1.2, DRUM_CIRCLE.z + 3.0, 1.6, 1.3, -0.3, '#4f7fbf'), blanket(DRUM_CIRCLE.x + 0.4, DRUM_CIRCLE.z - 2.8, 1.5, 1.2, 0.9, GC.plazaWarm)];
}

/** exclusion: the drum ring and the blankets on the meadow (the paths around stay the city's) */
const EXCLUDE: Vec2[] = [{ x: -2.4, z: -1.9 }, { x: 3.4, z: -2.4 }, { x: 5.4, z: 1.2 }, { x: 4.4, z: 4.6 }, { x: 0.4, z: 6.0 }, { x: -1.9, z: 4.2 }];

export const hippieHill: W4Site = {
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
    build: hands,
    // the hands beat the drum heads (a quick up-down, about two beats a second)
    update(obj, t) { obj.position.set(0, Math.max(0, Math.sin(t * 13)) * 0.09, 0); },
  },
  walk: { blockers: [{ x: DRUM_CIRCLE.x, z: DRUM_CIRCLE.z, r: R + 0.45 }] },
  ground: ground(),
  plaza: [{ poly: [{ x: -2.0, z: -1.6 }, { x: 3.2, z: -2.1 }, { x: 5.0, z: 1.2 }, { x: 4.1, z: 4.3 }, { x: 0.4, z: 5.6 }, { x: -1.6, z: 4.0 }], surface: 'grass' }],
  w4: {
    placeId: 'osm-w272711313',
    attractions: ['hippie-hill'],
    arrival: { x: -1.1, z: -0.6, heading: 1.0 },
    photo: { target: [1.4, 0.6, 1.8], distance: 11, elevation: 0.35, bearing: -2.2 },
    flag: { x: DRUM_CIRCLE.x, z: DRUM_CIRCLE.z, h: 30 },
    height: { realM: 1.5, u: 1.2, top: 2.5, rule: 'overlook' },
    osm: ['way/272711313'],
    terrain: [-4, -4, 7, 7],
    notes: 'The weekend drum-loop sound hook (lane T, city audio) sits at DRUM_CIRCLE. Family card: no cannabis or 4/20 props.',
  },
};
