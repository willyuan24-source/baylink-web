import { DISTRICT, LAND, polygonArea, project } from '../../../baylink-opus/src/opus-bay/data/district.ts';
const slab = polygonArea(DISTRICT.slab), land = polygonArea(LAND);
console.log('slab u2', Math.round(slab), 'land u2', Math.round(land), 'SF land u2', Math.round(121.4e6 * 0.0196), 'land share %', (100 * land / (121.4e6 * 0.0196)).toFixed(2));
const xs = DISTRICT.slab.map(p => p.x), zs = DISTRICT.slab.map(p => p.z);
console.log('slab x', Math.min(...xs), Math.max(...xs), 'z', Math.min(...zs), Math.max(...zs));
for (const [n, a, b] of [['Lands End', 37.7876, -122.505], ['Ocean Beach mid', 37.76, -122.5105], ['GG south tower', 37.81401, -122.47789], ['Twin Peaks', 37.75332, -122.44742], ['Ferry', 37.79552, -122.39365], ['Pier 39', 37.80867, -122.40982]] as const) console.log(n, project(a, b));
