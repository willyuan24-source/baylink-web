/**
 * Trip ends for the attractions a wave-4 site models, where the attraction's own arrival fails the walk sweep (lane L,
 * W5-L1, plan MF2): exactly `sfLandmarkAnchor(site)` (world/sf/landmarks/context.ts: the site record's `w4.arrival`
 * placed with its x, z and yaw), written out like data/sf/arrivals.ts so data/sf/attractions.ts can use it without the
 * landmark library. Values in world units, heading in world yaw.
 *
 * An attraction is listed when its trip end (data/sf/attractions.ts `tripDestination`) stands inside a blocker, where no
 * walker can stand, in a driven street's lane (the toy traffic stops for the player there), or beyond the walking graph's
 * reach; or, for lane L3's tier-3 records (w4list3.ts), more than 8 u from the feature (the sundial, Mountain Lake's
 * overlook, McLaren's La Grande, Buena Vista's summit). Every listed spot is standable, clear of the site's blockers, off
 * the asphalt, reached by a path from the walking graph, and a fly-in (actors/nav arrivalSpot) lands on it within 3 u off
 * the asphalt, except Irving Street and Haight & Ashbury, whose sidewalks are thinner than a nav cell (the landing
 * snaps into the kerb lane: Requests to the nav; Clement Street keeps its own trip end, with the same landing).
 *
 * tests/opus-bay-w5-landmarks.test.ts checks every entry against `sfLandmarkAnchor` (±0.01 u) and runs the same sweep over
 * every site-backed attraction; it prints this table when a site moves: paste it here. Lane N wires it in
 * data/sf/attractions.ts (ARRIVAL_OVERRIDES win, then LANDMARK_ARRIVALS, then this table).
 */
export const SITE_ARRIVALS: Readonly<Record<string, { x: number; z: number; heading: number; site: string }>> = {
  'japanese-tea-garden': { x: -236, z: 962, heading: -1.571, site: 'japanese-tea-garden' },
  'union-square': { x: 96.84, z: 225.53, heading: 3.36, site: 'union-square' },
  'sfmoma': { x: 169.1, z: 188.6, heading: 1.649, site: 'sfmoma' },
  'haight-ashbury': { x: -42.2, z: 760.64, heading: 1.252, site: 'haight-ashbury' },
  'lands-end': { x: -699.81, z: 1227.26, heading: -0.426, site: 'lands-end' },
  'murphy-windmill': { x: -515.02, z: 1367.36, heading: -3.413, site: 'murphy-windmill' },
  'bison-paddock': { x: -464.9, z: 1220, heading: -1.571, site: 'bison-paddock' },
  'koret-carousel': { x: -111.5, z: 880.7, heading: -0.436, site: 'koret-carousel' },
  'hippie-hill': { x: -142.9, z: 852.1, heading: 1, site: 'hippie-hill' },
  'irving-street': { x: -248.1, z: 1124.99, heading: -0.71, site: 'irving-street' },
  'harvey-milk-plaza': { x: 143.27, z: 742.82, heading: -0.1, site: 'harvey-milk-plaza' },
  'war-memorial-opera-house': { x: 82.93, z: 432.08, heading: -0.609, site: 'war-memorial' },
  'asian-art-museum': { x: 104.15, z: 386.21, heading: 2.525, site: 'asian-art-museum' },
  'japan-center': { x: -70.91, z: 463.17, heading: -2.178, site: 'webster-bridge' },
  'haas-lilienthal-house': { x: -111.9, z: 311.65, heading: -0.113, site: 'haas-lilienthal-house' },
  'ingleside-terraces-sundial': { x: 277.85, z: 1444.9, heading: -2.249, site: 'ingleside-terraces-sundial' },
  'lyon-street-steps': { x: -292.6, z: 512.7, heading: -2.217, site: 'lyon-street-steps' },
  'octagon-house': { x: -184.14, z: 286.09, heading: -0.006, site: 'octagon-house' },
  'seward-street-slides': { x: 154.6, z: 838.9, heading: 3.142, site: 'seward-street-slides' },
  'vermont-street-crooked-block': { x: 446.93, z: 502.15, heading: 1.073, site: 'vermont-street-crooked-block' },
  'womens-building': { x: 263.58, z: 636.23, heading: -0.394, site: 'womens-building' },
  'buena-vista-park': { x: 29.62, z: 736.62, heading: 0, site: 'buena-vista-park' },
  'calle-24': { x: 452.55, z: 635.74, heading: 2.45, site: 'calle-24' },
  'lafayette-park': { x: -116.74, z: 355.1, heading: -2.6, site: 'lafayette-park' },
  'mclaren-park': { x: 672.39, z: 1067.18, heading: 2.07, site: 'mclaren-park' },
  'mountain-lake-park': { x: -434.2, z: 781.2, heading: -1.571, site: 'mountain-lake-park' },
  'noe-valley-town-square': { x: 318.47, z: 803.74, heading: 0.881, site: 'noe-valley-town-square' },
  'patricias-green': { x: 81.03, z: 494.1, heading: -0.607, site: 'patricias-green' },
  'sutro-heights-park': { x: -687.16, z: 1254.64, heading: 0.2, site: 'sutro-heights-park' },
  'wave-organ': { x: -442.3, z: 352, heading: 2.69, site: 'wave-organ' },
};
