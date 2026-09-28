import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import { isFireRingLit } from '../../../realsf/seasons';
import { BOX, type BatchLike, M } from '../../builder';
import { NONE, lathe, worldPoly } from './kit';
import { type W4Site, siteGround } from './siteKit';

/**
 * Ocean Beach's fire rings (wave 4, P3 · a shared setting of the ocean-beach-west group; the Early review's open item
 * 16): the 16 concrete fire rings of the National Park Service's Ocean Beach Fire Program, on the sand between Stairwell
 * 15 (John F Kennedy Dr, by the Beach Chalet) and Stairwell 20 (Lincoln Way), where fires are allowed from 6 am to
 * 9:30 pm, 1 March to 31 October, in the rings only (nps.gov "Ocean Beach Fire Program"; the 2016 program went from 12
 * to 16 rings of 800-pound concrete; SFGate). Toy version: sixteen low concrete rings in a line along the sand with warm
 * embers in each (a glow in the evening), never the rules lettering. None at Lawton St (the ocean-beach site).
 *
 * W5-L2 (plan §3.3 item 4): the embers and their night lights follow the real program through lane R's
 * `isFireRingLit` (realsf/seasons.ts, the Bay clock: `?date=` moves it in DEV / QA builds): lit from 06:00 to 21:30
 * between 1 March and 31 October (the glow reads from dusk), cold grey ash otherwise. `buildKey` flips with it, so
 * sites.ts rebuilds the lod 0 (no extra draw call), and `lightsOn` takes the eight fire lights out of the city's night
 * light field (it polls the site lights every 4 s at night). Asked at most every 15 s.
 *
 * Frame: origin (−564.83, 1363.73) on the sand halfway between JFK Dr and Lincoln Way, yaw 38.5°: local z runs along
 * the beach toward Lincoln Way (the rings from z −28 — beyond it the Great Highway bends seaward toward JFK Dr — to z 44 near Lincoln Way), the surf west (x ≤ −7), the Great
 * Highway's promenade east (x ≥ 8). Its place row is the Murphy Windmill's (Lincoln Way's end of the park; the main
 * record of that row stays the windmill).
 */

const ID = 'ocean-beach-fire-rings';
const X0 = -564.83, Z0 = 1363.73, YAW = (38.5 * Math.PI) / 180;
const g = siteGround(ID, 0.5);

const N = 16, Z_0 = -28, STEP = 4.8;
const ring = (k: number) => { const z = Z_0 + k * STEP, x = k % 2 ? -0.6 : 0.6; return { x, z, y: g.at(x, z) }; };
const CONCRETE = '#c9c3b5', EMBER = '#e0662f', ASH = '#5d534a', COLD = '#8f877c';

/** how often the Bay clock is asked (ms): buildKey runs every frame while the rings' lod 0 is near */
const LIT_EVERY = 15_000;
let litAt = -Infinity, lit = false;
/** Fires may burn in the rings now (lane R's isFireRingLit on the Bay clock), cached for LIT_EVERY. */
export function fireRingsLit(now = Date.now()): boolean {
  if (now - litAt >= LIT_EVERY || now < litAt) { litAt = now; lit = isFireRingLit(); }
  return lit;
}
/** tests: forget the cached answer (after moving the Bay clock with __setBayNowForTests) */
export function resetFireRings() { litAt = -Infinity; }

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    for (let k = 1; k < N; k += 4) { const r = ring(k); b.add(BOX(), M(r.x, r.y - 0.1, r.z, 0, 1.1, 0.5, 1.1), CONCRETE); }
    return;
  }
  const on = fireRingsLit();
  for (let k = 0; k < N; k++) {
    const r = ring(k);
    // a low concrete ring, its inside falling to the ash (the concrete never glows: W5-L2 lights only the embers)
    lathe(b, [[0.55, -0.1], [0.55, 0.42], [0.38, 0.42], [0.36, 0.12], [0.02, 0.1]], r.x, r.y, r.z, (ly: number) => new THREE.Color(ly > 0.3 ? CONCRETE : ly > 0.15 ? ASH : COLD), NONE, 5);
    // in the fire season's hours a toy flame burns in every other ring (the ones the night lights stand over; the rings
    // are first come, first served), rising over the rim so it reads from the promenade
    if (on && k % 2) lathe(b, [[0.26, 0.12], [0.02, 0.78]], r.x, r.y, r.z, EMBER, [0, 0, 0, 0.9], 5);
  }
}

const EXCLUDE: Vec2[] = [{ x: -2.2, z: Z_0 - 1.4 }, { x: 2.2, z: Z_0 - 1.4 }, { x: 2.2, z: Z_0 + (N - 1) * STEP + 1.4 }, { x: -2.2, z: Z_0 + (N - 1) * STEP + 1.4 }];

export const oceanBeachFireRings: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  buildKey: () => (fireRingsLit() ? 1 : 0),
  walk: { blockers: Array.from({ length: N }, (_, k) => { const r = ring(k); return { x: r.x, z: r.z, r: 0.6 }; }) },
  // the evening fires (the city's night light field), only while fires may burn
  lights: Array.from({ length: N / 2 }, (_, i) => { const r = ring(i * 2 + 1); return { x: r.x, y: r.y + 0.7, z: r.z, size: 0.9, color: '#ff9a4a' }; }),
  lightsOn: () => fireRingsLit(),
  plaza: [{ poly: [{ x: -4.0, z: Z_0 - 2 }, { x: 4.0, z: Z_0 - 2 }, { x: 4.0, z: Z_0 + (N - 1) * STEP + 2 }, { x: -4.0, z: Z_0 + (N - 1) * STEP + 2 }], surface: 'sand' }],
  w4: {
    placeId: 'murphy-windmill',
    attractions: [],
    arrival: { x: 1.8, z: 38.5, heading: Math.PI },
    photo: { target: [0, 0.5, 0], distance: 26, elevation: 0.35, bearing: 1.9 },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 1, u: 0.5, top: 1.4, rule: 'overlook' },
    osm: [],
    terrain: [-4, -31, 4, 47],
    notes: 'Fires only in the rings, 6 am–9:30 pm, 1 March–31 October (lane C\'s Ocean Beach card says "at the north end"); the embers and the fire lights follow that through lane R\'s isFireRingLit (W5-L2). The rules lettering on the rings is never drawn. A shared setting: no attraction of its own.',
  },
};
