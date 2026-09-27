/**
 * World arrival spots of the 24 SF landmarks (lane G2, P7): exactly lane D2's `sfLandmarkAnchor(id)`
 * (world/sf/landmarks/context.ts: data/sf/landmarks `arrival` placed with the landmark's x, z and yaw), written out so
 * that the main graph (the landmark cards in data/sf/cityPois.ts and the goal waypoints in game/cityGoals.ts) does not
 * pull the landmark library (≈ 25 KB gzip of recipes) into GameRoot. Values in world units, heading in world yaw.
 *
 * tests/opus-bay-sf-content.test.ts checks every entry against `sfLandmarkAnchor` (±0.01 u) and prints the new table
 * when D2 moves a landmark or its arrival: paste it here.
 */
export const LANDMARK_ARRIVALS: Readonly<Record<string, { x: number; z: number; heading: number }>> = {
  'golden-gate-bridge': { x: -680.06, z: 654.15, heading: 4.037 },
  'sutro-tower': { x: 68.43, z: 980.61, heading: 2.443 },
  'city-hall': { x: 99.29, z: 408.19, heading: 5.672 },
  'de-young-tower': { x: -235.6, z: 938.6, heading: -1.571 },
  'palace-of-fine-arts': { x: -409.36, z: 407.23, heading: 5.498 },
  'twin-peaks': { x: 128.86, z: 922.32, heading: 3.142 },
  'painted-ladies': { x: 4.38, z: 577.87, heading: 2.484 },
  'dragon-gate': { x: 86.29, z: 178.06, heading: 4.056 },
  'conservatory-of-flowers': { x: -177.51, z: 858.11, heading: 4.049 },
  'dutch-windmill': { x: -584.3, z: 1315.67, heading: 2.374 },
  'mission-dolores': { x: 198.74, z: 641.87, heading: 5.655 },
  'grace-cathedral': { x: 7.38, z: 223.67, heading: 5.669 },
  'legion-of-honor': { x: -663.12, z: 1074.83, heading: 6.229 },
  'fort-point': { x: -744.02, z: 598.99, heading: -2.147 },
  'castro-theatre': { x: 157.21, z: 734.76, heading: 5.59 },
  'oracle-park': { x: 343.37, z: 179.07, heading: 2.421 },
  'peace-pagoda': { x: -59.62, z: 452.42, heading: 4.102 },
  'ghirardelli-square': { x: -242.3, z: 160.56, heading: 0.967 },
  'fishermans-wharf': { x: -198.51, z: 76.63, heading: 4.109 },
  'sutro-baths': { x: -717.26, z: 1246.05, heading: -0.352 },
  'cliff-house': { x: -711.12, z: 1261.59, heading: -0.323 },
  'cable-car-turntable': { x: 134.9, z: 261.01, heading: 4.058 },
  'lombard-crooked-street': { x: -151.33, z: 159.48, heading: 5.653 },
  'chase-center': { x: 483.33, z: 270.61, heading: 2.55 },
};
