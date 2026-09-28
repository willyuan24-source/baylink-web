import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, CBOX, CONE, M } from '../../builder';
import { worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, bench, fence, gfill, siteGround } from './siteKit';

/**
 * Fort Funston (wave 4, P3 · map T3, the fort-funston site): the sandstone bluffs at the city's south-west corner where
 * hang-gliders launch over the Pacific, with the old Battery Davis (1936–39) bunker to the north; the only park of the
 * Golden Gate National Recreation Area where dogs may run off-leash (Wikipedia; the scouting). This site is the
 * Observation Deck at the bluff edge beside the parking lot (OSM node 3101265351): a railed timber deck, a bench, the
 * windsock the pilots read, and one toy hang-glider circling over the beach below (the animate part) — scenery only,
 * never player-flyable (hang gliding is for certified pilots). The bluffs erode and close in places: the rail keeps to
 * the deck.
 *
 * Frame: origin (98.3, 1862.4) at the viewpoint on the bluff top (walked 12.6), yaw −26.8°: local +z faces the ocean;
 * the edge runs along z ≈ 1.1 and the cliff drops 12 u to the sand by z 8; the parking lot is north-east (z ≤ −7).
 */

const ID = 'fort-funston';
const X0 = 98.3, Z0 = 1862.4, YAW = (-26.8 * Math.PI) / 180;
const g = siteGround(ID, 12.1);

const DECK: Vec2[] = [{ x: -2.8, z: -1.8 }, { x: 2.8, z: -1.8 }, { x: 2.8, z: 0.95 }, { x: -2.8, z: 0.95 }];
const RAIL: Vec2[] = [{ x: -2.9, z: -1.2 }, { x: -2.9, z: 1.05 }, { x: 2.9, z: 1.05 }, { x: 2.9, z: -1.2 }];
const SOCK = { x: -3.9, z: -1.6, h: 4.2 };
/** the glider's circle over the beach (local): centre, radius, height over the base */
const LOOP = { x: 0, z: 10, r: 7.5, y: 9.5 };

function build(b: BatchLike, lod: 0 | 2) {
  const y = g.at(0, 0);
  if (lod === 2) { b.add(BOX(), M(0, y - 0.1, -0.4, 0, 5.6, 0.3, 2.8), '#9a7454'); return; }
  fence(b, RAIL, g.at, 1.0, '#7a5a40');
  bench(b, 0.8, g.at(0.8, -1.2), -1.2, 0);
  // the windsock: a pole and the orange-and-white sock streaming inland
  const sy = g.at(SOCK.x, SOCK.z);
  b.add(BOX(), M(SOCK.x, sy - 0.1, SOCK.z, 0, 0.08, SOCK.h + 0.1, 0.08), '#d8d4ca');
  const ringOf = (k: number) => new THREE.Vector3(SOCK.x, sy + SOCK.h - 0.25 - k * 0.06, SOCK.z - 0.2 - k * 0.55);
  for (let k = 0; k < 3; k++) {
    const a = ringOf(k), c = ringOf(k + 1), r = 0.24 - k * 0.05;
    b.add(CONE(8), new THREE.Matrix4().compose(a, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.clone().sub(a).normalize()), new THREE.Vector3(r, 0.55, r)), k % 2 ? '#f4efe2' : '#e0662f');
  }
}

/** the hang-glider (the animate part, LOCAL to itself: nose +z): the delta wing, the keel, the pilot's pod */
function glider(b: BatchLike) {
  const wing = (s: number) => b.tri(new THREE.Vector3(0, 0.05, 1.3), new THREE.Vector3(s * 2.2, -0.1, -0.7), new THREE.Vector3(0, 0.15, -0.5), s > 0 ? '#e0b04e' : '#c9473a', [0, 0, 0, 0], new THREE.Vector3(0, 1, 0));
  wing(1); wing(-1);
  b.add(CBOX(), M(0, 0.0, 0.3, 0, 0.05, 0.05, 1.9), '#3f3a36');
  b.add(CBOX(), M(0, -0.65, 0.1, 0, 0.26, 0.26, 0.9), '#4f7fbf');
  b.add(CBOX(), M(0, -0.35, 0.3, 0, 0.03, 0.6, 0.03), '#3f3a36');
}

function ground(): SiteGroundPoly[] { return gfill(DECK, GC.deck, PAT.planks, g, 1.4, 0.12); }

export const fortFunston: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -4.8, z: -4.4 }, { x: -3.0, z: -4.4 }, { x: -3.0, z: -2.6 }, { x: 3.4, z: -2.6 }, { x: 3.4, z: 2.4 }, { x: -4.8, z: 2.4 }]) },
  build,
  animate: {
    build: glider,
    // a slow banked circle over the beach, riding the ridge lift up and down a little
    update(obj, t) {
      const a = t * 0.16, x = LOOP.x + Math.cos(a) * LOOP.r, z = LOOP.z + Math.sin(a) * LOOP.r;
      obj.position.set(x, LOOP.y + Math.sin(t * 0.37) * 0.8, z);
      obj.rotation.set(0, -a, 0.35);
    },
  },
  walk: {
    blockers: [{ poly: [{ x: -3.2, z: 1.1 }, { x: 3.2, z: 1.1 }, { x: 3.2, z: 2.4 }, { x: -3.2, z: 2.4 }] }, { x: SOCK.x, z: SOCK.z, r: 0.12 }],
    surfaces: [{ poly: DECK, y: 'terrain', surface: 'wood' }],
  },
  ground: ground(),
  plaza: [{ poly: DECK, surface: 'wood' }, { poly: [{ x: -4.4, z: -6.0 }, { x: 3.2, z: -6.0 }, { x: 3.2, z: -1.9 }, { x: -4.4, z: -1.9 }], surface: 'sand' }],
  w4: {
    placeId: 'osm-w404851503',
    attractions: ['fort-funston'],
    arrival: { x: 0.2, z: -0.6, heading: 0 },
    photo: { target: [0, 3, 6], distance: 15, elevation: 0.25, bearing: Math.PI + 0.7 },
    flag: { x: -0.6, z: -1.2, h: 30 },
    height: { realM: 4, u: 4.2, top: 7.2, rule: 'overlook' },
    osm: ['node/3101265351'],
    terrain: [-5, -7, 4, 3],
    terrainStep: 1,
    notes: 'The hang-glider is scenery, never player-flyable (certified pilots only). The bluffs erode and close in places: the rail keeps to the deck. Battery Davis is a card.',
  },
};
