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
  'golden-gate-bridge': { x: -678.75, z: 652.51, heading: 4.037 },
  'sutro-tower': { x: 68.43, z: 980.61, heading: 2.443 },
  'city-hall': { x: 99.29, z: 408.19, heading: 5.672 },
  'de-young-tower': { x: -243.9, z: 928.6, heading: -1.01 },
  'palace-of-fine-arts': { x: -409.64, z: 409.63, heading: 5.498 },
  'twin-peaks': { x: 128.86, z: 922.32, heading: 3.142 },
  'painted-ladies': { x: 4.38, z: 577.87, heading: 2.484 },
  'dragon-gate': { x: 86.7, z: 177.11, heading: -2.015 },
  'conservatory-of-flowers': { x: -177.51, z: 858.11, heading: 4.049 },
  'dutch-windmill': { x: -584.3, z: 1315.67, heading: 2.374 },
  'mission-dolores': { x: 198.99, z: 638.96, heading: 5.655 },
  'grace-cathedral': { x: 8.92, z: 218.02, heading: 5.544 },
  'legion-of-honor': { x: -663.12, z: 1074.83, heading: 6.229 },
  'fort-point': { x: -747.66, z: 598.89, heading: -2.147 },
  'castro-theatre': { x: 154.1, z: 747.12, heading: -2.443 },
  'oracle-park': { x: 345.02, z: 177.19, heading: 2.421 },
  'peace-pagoda': { x: -66.46, z: 447.02, heading: 0.85 },
  'ghirardelli-square': { x: -243.12, z: 160, heading: 0.967 },
  'fishermans-wharf': { x: -198.51, z: 76.63, heading: 4.109 },
  'sutro-baths': { x: -717.26, z: 1246.05, heading: -0.352 },
  'cliff-house': { x: -702.21, z: 1268.05, heading: -1.464 },
  'cable-car-turntable': { x: 131.58, z: 254.17, heading: -1.424 },
  'lombard-crooked-street': { x: -155.89, z: 158.94, heading: -0.228 },
  'chase-center': { x: 499.66, z: 241.83, heading: -0.461 },
};
