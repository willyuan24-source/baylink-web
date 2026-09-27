import type { BatchLike } from '../../builder';
import { GLOW, NONE, box, cyl, lathe, pyramid, rect, worldPoly } from './kit';
import type { SfLandmark } from './index';

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

export const peacePagoda: SfLandmark = {
  id: 'peace-pagoda',
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 'terrain',
  exclude: { poly: worldPoly(X0, Z0, YAW, rect(0, 0, 3.6, 3.6)) },
  build,
  walk: { blockers: [{ poly: rect(0, 0, 3.2, 3.2) }] },
};
