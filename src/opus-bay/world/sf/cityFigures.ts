import * as THREE from 'three';
import { BOX, Batch, CBOX, CONE, CYL, M, SPHERE } from '../builder';
import { cityFigures } from '../life';

/**
 * W9-P (lane P, w8 NEXT #7: GameRoot toward 255 KB) · two city-only figures of world/life.ts ride with the city chunk
 * (world/sf/cityMode.ts imports this module; it fills `cityFigures` in life.ts at load, before the city world is built):
 * the open sun deck of the rideable Bay ferry (lane F8) and the city's western gull (W7-X). Moved verbatim; the district
 * never used either (its enclosed ferry and its own gull stay in life.ts).
 */

/** The open sun deck (F8): plank floor at y 2.0–2.04, railings, outward benches, the wheelhouse / funnel / mast forward. */
export function sunDeck(b: Batch, stripe: string, white: string, glass: string, lit: [number, number, number, number]) {
  const wood = '#b98a5a', rail = '#f2eee6';
  b.add(BOX(), M(0, 2.0, -0.4, 0, 3.6, 0.04, 8.1), wood);
  // railings: posts round the edge and a top rail (open at nothing: the deck is a toy, you cannot fall off)
  const minZ = -4.4, maxZ = 3.7, hw = 1.82;
  for (let z = minZ; z <= maxZ + 1e-6; z += (maxZ - minZ) / 7) for (const sx of [-1, 1]) b.add(BOX(), M(sx * hw, 2.04, z, 0, 0.06, 0.72, 0.06), rail);
  for (const sx of [-1, 1]) b.add(BOX(), M(sx * hw, 2.74, (minZ + maxZ) / 2, 0, 0.07, 0.06, maxZ - minZ), rail);
  for (let x = -hw; x <= hw + 1e-6; x += hw / 2) b.add(BOX(), M(x, 2.04, minZ, 0, 0.06, 0.72, 0.06), rail);
  b.add(BOX(), M(0, 2.74, minZ, 0, hw * 2, 0.06, 0.07), rail);
  b.add(BOX(), M(0, 2.3, minZ, 0, hw * 2, 0.04, 0.05), rail);
  // two benches back to back down the middle, facing out to either rail
  for (const sx of [-1, 1]) {
    b.add(BOX(), M(sx * 0.95, 2.4, -2.2, 0, 0.5, 0.08, 2.8), wood);
    b.add(BOX(), M(sx * 0.95, 2.04, -2.2, 0, 0.36, 0.36, 2.6), '#8a6a4a');
    b.add(BOX(), M(sx * 0.66, 2.48, -2.2, 0, 0.07, 0.42, 2.8), wood);
  }
  // wheelhouse at the bow end of the deck: white box, a band of lit windows, roof, funnel in the line colour, mast
  b.add(BOX(), M(0, 2.04, 2.45, 0, 2.3, 1.15, 1.9), white);
  b.add(BOX(), M(0, 2.55, 2.45, 0, 2.34, 0.42, 1.7), glass, lit);
  b.add(BOX(), M(0, 3.19, 2.45, 0, 2.6, 0.12, 2.2), '#d9d4c7');
  b.add(CYL(8), M(0, 3.31, 2.0, 0, 0.3, 1.0, 0.3), stripe);
  b.add(CYL(5), M(0, 3.31, 1.8, 0, 0.05, 2.6, 0.05), '#e7e1d5');
}

/**
 * Wave 7 · lane X (W7-X): the city's gull (city mode only; the district keeps gullGeometry). A western gull as a toy:
 * white head, body and tail, a yellow bill, pale grey wings with a bent elbow — the arm raised a little and swept forward
 * to the wrist, the hand swept back and down — and black wing tips. Same instanced mesh, material and flap as before
 * (every wing part flaps, aInfo.z 1), ≈ 230 triangles (the old gull ≈ 200). The pigeons share the mesh (tinted).
 */
export function cityGullGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  const WHITE = '#ffffff', WING = '#cdd4d8', TIP = '#1d2023';
  b.add(SPHERE(8, 6), M(0, 0, 0, 0, 0.12, 0.11, 0.3), WHITE);
  b.add(SPHERE(6, 5), M(0, 0.07, 0.27, 0, 0.085, 0.085, 0.095), WHITE);
  b.add(CONE(5), M(0, 0.055, 0.37, 0, 0.026, 0.11, 0.026, Math.PI / 2), '#f2c230');
  b.add(CBOX(), M(0, 0.01, -0.34, 0, 0.15, 0.025, 0.14), WHITE);
  const wing = [0, 0, 1, 0] as const;
  for (const s of [-1, 1]) {
    // the arm: body → wrist, raised 0.2 rad and swept 0.3 rad forward (the wrist ends ≈ (0.40, 0.09, 0.09))
    b.add(CBOX(), M(s * 0.22, 0.05, 0.03, -s * 0.3, 0.38, 0.024, 0.22, 0, s * 0.2), WING, [...wing]);
    // the hand: from the wrist swept 0.45 rad back and 0.12 rad down — its grey inner half, then the black tip
    const dx = Math.cos(0.45) * Math.cos(0.12), dy = -Math.sin(0.12), dz = -Math.sin(0.45);
    const at = (t: number) => [s * (0.4 + dx * t), 0.088 + dy * t, 0.086 + dz * t] as const;
    const g = at(0.09), k = at(0.27);
    b.add(CBOX(), M(g[0], g[1], g[2], s * 0.45, 0.19, 0.02, 0.16, 0, -s * 0.12), WING, [...wing]);
    b.add(CBOX(), M(k[0], k[1], k[2], s * 0.45, 0.19, 0.018, 0.12, 0, -s * 0.12), TIP, [...wing]);
  }
  return b.build();
}

cityFigures.deck = sunDeck;
cityFigures.gull = cityGullGeometry;
