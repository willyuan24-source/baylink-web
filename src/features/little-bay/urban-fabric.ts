import { BAY_CITIES, type BayCity } from './bay-cities';
import { SF_NEIGHBORHOODS } from './sf-world';
import { sfVisualRoads } from './sf-city-scenery';
import { containsPoint, mapHash } from './san-francisco-geometry';
import {
  BAY_ROADS, UNIFIED_BAY_PLACES, bayContains, bayHeight, distanceToBaySegment, projectBay,
  type BayPoint, type UnifiedPlace,
} from './unified-bay-world';

export type UrbanBuilding = {
  id: string; cityId: string; x: number; z: number; base: number;
  width: number; depth: number; height: number; angle: number;
  color: string; roof: string; gabled: boolean;
};
export type UrbanTree = { x: number; z: number; y: number; scale: number };
export type UrbanStreet = { path: BayPoint[]; width: number };
export type UrbanGarden = { x: number; z: number; y: number; width: number; depth: number; angle: number };
export type UrbanFabric = { buildings: UrbanBuilding[]; trees: UrbanTree[]; streets: UrbanStreet[]; gardens: UrbanGarden[] };
export const URBAN_BUILDING_BUDGET = 4400;
export const URBAN_TREE_BUDGET = 1800;

const walls = ['#d9c6a7', '#bdccb4', '#a8c4b7', '#dfcfae', '#cfb49d', '#c4cbbb', '#87aaa2'];
const roofs = ['#bd8d70', '#9baf99', '#9b8067', '#6e9288'];
const sfParks = SF_NEIGHBORHOODS.filter(item => ['Golden Gate Park', 'Presidio', 'Lincoln Park', 'McLaren Park'].includes(item.name));
/** These broad authored reserves prevent decorative development inside known natural areas. */
const reserves = [
  [-122.492, 37.723, 9, 10], [-122.433, 37.693, 17, 13], // Lake Merced, San Bruno Mountain
  [-122.360, 37.545, 12, 22], [-122.328, 37.49, 15, 26], // Crystal Springs / watershed
  [-122.392, 37.424, 37, 31], [-122.270, 37.395, 30, 23], // coastal and Woodside open space
  [-122.117, 37.457, 19, 13], [-122.075, 37.429, 15, 8], // baylands / Shoreline
  [-121.996, 37.45, 16, 12], [-122.091, 37.54, 20, 13], // southern marshes
  [-122.18, 37.82, 23, 25], [-122.233, 37.89, 18, 20], // redwoods / Tilden
].map(([lng, lat, rx, rz]) => ({ point: projectBay([lng, lat]), rx, rz }));

export function urbanNatureAt(x: number, z: number, padding = 0): boolean {
  if (sfParks.some(park => park.rings.some(ring => containsPoint([x + 220, z + 189.21], ring)))) return true;
  return reserves.some(({ point, rx, rz }) => ((x - point[0]) / (rx + padding)) ** 2 + ((z - point[1]) / (rz + padding)) ** 2 < 1);
}

type Segment = { a: BayPoint; b: BayPoint; width: number };
const mainSegments: Segment[] = BAY_ROADS.flatMap(road => road.path.slice(1).map((b, i) => ({ a: road.path[i], b, width: road.width })));
// Preserve the street pattern already drawn in San Francisco, including its diagonals.
const sfSegments: Segment[] = sfVisualRoads().avenues.flatMap(road => road.path.slice(1).map((b, i) => ({
  a: [road.path[i][0] - 220, road.path[i][1] - 189.21] as BayPoint,
  b: [b[0] - 220, b[1] - 189.21] as BayPoint, width: road.width,
})));
const transportSegments = [...mainSegments, ...sfSegments];
const roadBuckets = new Map<string, Segment[]>();
for (const segment of transportSegments) {
  const padding = segment.width / 2 + 4;
  for (let x = Math.floor((Math.min(segment.a[0], segment.b[0]) - padding) / 12); x <= Math.floor((Math.max(segment.a[0], segment.b[0]) + padding) / 12); x++)
    for (let z = Math.floor((Math.min(segment.a[1], segment.b[1]) - padding) / 12); z <= Math.floor((Math.max(segment.a[1], segment.b[1]) + padding) / 12); z++) {
      const key = `${x}:${z}`;
      roadBuckets.set(key, [...(roadBuckets.get(key) ?? []), segment]);
    }
}

/** Exact clearance within four units; distant roads can safely return Infinity. */
export function urbanRoadClearance(x: number, z: number): number {
  let clearance = Infinity;
  for (const { a, b, width } of roadBuckets.get(`${Math.floor(x / 12)}:${Math.floor(z / 12)}`) ?? []) clearance = Math.min(clearance, distanceToBaySegment([x, z], a, b) - width / 2);
  return clearance;
}

export function urbanLandmarkClearance(place: UnifiedPlace): number {
  return Math.max(6.5, place.arrivalRadius + 3, (place.sf?.sceneryRadius ?? 0) * place.modelScale + 1.5);
}

/** Segment/footprint clipping also catches rotated streets passing through a corner. */
export function urbanBuildingOnStreet(building: UrbanBuilding, street: UrbanStreet): boolean {
  const cosine = Math.cos(building.angle), sine = Math.sin(building.angle);
  const local = ([x, z]: BayPoint): BayPoint => [(x - building.x) * cosine - (z - building.z) * sine, (x - building.x) * sine + (z - building.z) * cosine];
  const hx = building.width / 2 + street.width / 2 + .1, hz = building.depth / 2 + street.width / 2 + .1;
  for (let index = 1; index < street.path.length; index++) {
    const a = local(street.path[index - 1]), b = local(street.path[index]);
    let minimum = 0, maximum = 1;
    for (let axis = 0; axis < 2; axis++) {
      const half = axis ? hz : hx, delta = b[axis] - a[axis];
      if (Math.abs(delta) < 1e-10) { if (Math.abs(a[axis]) > half) { maximum = -1; break; } }
      else {
        const first = (-half - a[axis]) / delta, second = (half - a[axis]) / delta;
        minimum = Math.max(minimum, Math.min(first, second)); maximum = Math.min(maximum, Math.max(first, second));
      }
    }
    if (minimum <= maximum) return true;
  }
  return false;
}

type District = { city: BayCity; rx: number; rz: number; cell: number; angle: number; density: number };
const dimensions: Record<string, [number, number, number, number, number]> = {
  'san-francisco': [52, 55, 3.2, 0, .95], 'oakland': [39, 45, 6.4, -.24, .94],
  'san-jose': [53, 49, 6.5, -.22, .91], 'berkeley': [29, 30, 5.8, -.16, .87],
  'hayward': [30, 39, 6.4, -.35, .8], 'fremont': [36, 48, 6.8, -.38, .77],
  'milpitas': [26, 33, 6.8, -.2, .76], 'alameda': [29, 18, 5.8, .24, .82],
  'mountain-view': [27, 28, 6.6, -.26, .83], 'sunnyvale': [29, 31, 6.8, -.18, .82],
  'santa-clara': [31, 31, 6.8, -.22, .86], 'cupertino': [26, 26, 6.8, 0, .78],
  'palo-alto': [21, 25, 4.8, -.37, .8], 'stanford': [18, 20, 5.2, -.37, .7],
  'woodside': [11, 15, 5.5, -.25, .55], 'saratoga': [18, 19, 6, -.1, .64],
  'half-moon-bay': [12, 25, 5.2, -.12, .68], 'pacifica': [11, 25, 5.2, -.1, .65],
  'daly-city': [26, 26, 4.8, -.12, .84], 'south-san-francisco': [24, 22, 4.8, -.25, .85],
};
const districts: District[] = BAY_CITIES.filter(city => city.kind !== 'area').map(city => {
  const [rx, rz, cell, angle, density] = dimensions[city.id] ?? [20, 23, 4.8, -.35, .82];
  return { city, rx, rz, cell, angle, density };
});
const toWorld = (district: District, x: number, z: number): BayPoint => [
  district.city.position[0] + x * Math.cos(district.angle) - z * Math.sin(district.angle),
  district.city.position[1] + x * Math.sin(district.angle) + z * Math.cos(district.angle),
];
const downtowns = [
  { cityId: 'san-francisco', position: projectBay([-122.405, 37.789]), radius: 18, height: 5.5 },
  { cityId: 'oakland', position: projectBay([-122.27, 37.804]), radius: 16, height: 4.3 },
  { cityId: 'san-jose', position: projectBay([-121.891, 37.334]), radius: 30, height: 4.3 },
];

/** Pure and deterministic: computed once per scene, never from a frame callback. */
export function makeUrbanFabric(places: readonly UnifiedPlace[] = UNIFIED_BAY_PLACES): UrbanFabric {
  const fabric: UrbanFabric = { buildings: [], trees: [], streets: [], gardens: [] };
  const occupied = new Map<string, UrbanBuilding[]>();
  const roadKeys = new Set<string>();
  const clearGround = (x: number, z: number, radius: number, nature = true) => {
    if (nature && urbanNatureAt(x, z, radius)) return false;
    for (const [dx, dz] of [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius], ...[-1, 1].flatMap(sx => [-1, 1].map(sz => [sx * radius * .7072, sz * radius * .7072]))])
      if (!bayContains(x + dx, z + dz) || (nature && urbanNatureAt(x + dx, z + dz))) return false;
    return places.every(place => Math.hypot(x - place.position[0], z - place.position[1]) >= urbanLandmarkClearance(place) + radius);
  };
  const clearBuilding = (x: number, z: number, radius: number) => {
    if (!clearGround(x, z, radius) || urbanRoadClearance(x, z) < radius + .35) return false;
    const gx = Math.floor(x / 6), gz = Math.floor(z / 6);
    for (let ix = gx - 1; ix <= gx + 1; ix++) for (let iz = gz - 1; iz <= gz + 1; iz++)
      if (occupied.get(`${ix}:${iz}`)?.some(b => Math.hypot(x - b.x, z - b.z) < radius + Math.hypot(b.width, b.depth) / 2 + .35)) return false;
    return true;
  };
  const addBuilding = (city: BayCity, x: number, z: number, angle: number, random: number, id: string, corridor = false) => {
    if (fabric.buildings.length >= URBAN_BUILDING_BUDGET) return;
    const compact = city.id === 'san-francisco', smallTown = city.region === 'peninsula';
    const width = compact ? .7 + random * .38 : smallTown ? 1.15 + random * .6 : corridor ? 1.65 + random * .65 : 1.6 + random * 1.05;
    const depth = compact ? .76 + mapHash(x, z, 8) * .38 : smallTown ? 1.3 + mapHash(x, z, 8) * .65 : corridor ? 1.45 + mapHash(x, z, 8) * .7 : 1.7 + mapHash(x, z, 8) * 1.0;
    const radius = Math.hypot(width, depth) / 2;
    if (!clearBuilding(x, z, radius)) return;
    const heights = [bayHeight(x, z), ...[-1, 1].flatMap(sx => [-1, 1].map(sz => bayHeight(x + sx * radius * .71, z + sz * radius * .71)))];
    const relief = Math.max(...heights) - Math.min(...heights);
    if (relief > .65) return;
    const core = downtowns.find(core => core.cityId === city.id);
    const intensity = core ? Math.max(0, 1 - Math.hypot(x - core.position[0], z - core.position[1]) / core.radius) : 0;
    const height = .7 + random * .95 + (core ? intensity * core.height * (.5 + random * .5) : 0) + relief;
    const building: UrbanBuilding = { id, cityId: city.id, x, z, angle, width, depth, height,
      base: Math.min(...heights) - .025, color: walls[Math.floor(random * walls.length)],
      roof: roofs[Math.floor(mapHash(x, z, 9) * roofs.length)], gabled: height < 1.75 && mapHash(x, z, 7) > .4 };
    fabric.buildings.push(building);
    const key = `${Math.floor(x / 6)}:${Math.floor(z / 6)}`;
    occupied.set(key, [...(occupied.get(key) ?? []), building]);
  };
  const addTree = (x: number, z: number, scale: number) => {
    if (fabric.trees.length >= URBAN_TREE_BUDGET || !clearGround(x, z, .7) || urbanRoadClearance(x, z) < .75) return;
    fabric.trees.push({ x, z, y: bayHeight(x, z), scale });
  };
  for (const district of districts) {
    const { city, rx, rz, cell, density } = district;
    for (let ix = -Math.ceil(rx / cell); ix <= Math.ceil(rx / cell); ix++) for (let iz = -Math.ceil(rz / cell); iz <= Math.ceil(rz / cell); iz++) {
      const lx = ix * cell, lz = iz * cell;
      if ((lx / rx) ** 2 + (lz / rz) ** 2 > 1) continue;
      const [x, z] = toWorld(district, lx, lz);
      // Adjacent towns meet cleanly; each block belongs to its nearest reference centre.
      if (districts.some(other => other !== district && Math.hypot(x - other.city.position[0], z - other.city.position[1]) < Math.hypot(x - city.position[0], z - city.position[1]) - .1)) continue;
      const random = mapHash(x, z, 2);
      if (random > density) continue;
      const garden = random < .075;
      if (garden && clearGround(x, z, 2.6) && urbanRoadClearance(x, z) > 3) {
        fabric.gardens.push({ x, z, y: bayHeight(x, z), width: 3.8, depth: 3.6, angle: -district.angle });
        for (const [dx, dz] of [[-1.05, -1], [1.05, 1], [1, -1]]) { const p = toWorld(district, lx + dx, lz + dz); addTree(...p, .75 + random * 3); }
      } else {
        for (const side of [-1, 1]) {
          const p = toWorld(district, lx + side * (city.id === 'san-francisco' ? .8 : city.region === 'peninsula' ? 1 : 1.4), lz + (mapHash(ix, iz, 6) - .5) * .35);
          addBuilding(city, ...p, -district.angle, mapHash(p[0], p[1], 4), `${city.id}:${ix}:${iz}:${side}`);
        }
        if (random < .28) { const p = toWorld(district, lx, lz + 2.2); addTree(...p, .72 + random); }
      }
      // SF already has a measured avenue layer. Elsewhere the quiet local grid makes a city footprint readable.
      if (city.id === 'san-francisco') continue;
      for (const vertical of [false, true]) {
        const a = toWorld(district, lx - cell / 2, lz - cell / 2);
        const b = toWorld(district, lx + (vertical ? -cell / 2 : cell / 2), lz + (vertical ? cell / 2 : -cell / 2));
        const middle: BayPoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (![a, middle, b].every(p => clearGround(...p, .75))) continue;
        const key = [...a, ...b].map(n => n.toFixed(2)).join(':');
        if (!roadKeys.has(key)) { roadKeys.add(key); fabric.streets.push({ path: [a, b], width: .85 }); }
      }
    }
  }
  // Low roadside neighbourhoods join the long inhabited corridors, without developing hill roads or marshes.
  for (const road of BAY_ROADS.filter(road => ['el-camino', 'i-880'].includes(road.id))) for (let i = 1; i < road.path.length; i++) {
    const a = road.path[i - 1], b = road.path[i], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    for (let t = 2; t < length - 1; t += 5.6) for (const side of [-1, 1]) for (const lane of [1, 2]) {
      const offset = side * (road.width / 2 + 2.7 + (lane - 1) * 4.2);
      const x = a[0] + dx * t / length + dz / length * offset, z = a[1] + dz * t / length - dx / length * offset;
      const closest = districts.reduce((best, next) => Math.hypot(x - next.city.position[0], z - next.city.position[1]) < Math.hypot(x - best.city.position[0], z - best.city.position[1]) ? next : best);
      if (Math.hypot(x - closest.city.position[0], z - closest.city.position[1]) > 72 || mapHash(x, z, 1) > .68) continue;
      addBuilding(closest.city, x, z, Math.atan2(dx, dz), mapHash(x, z, 4), `${road.id}:${i}:${t}:${side}:${lane}`, true);
    }
  }
  // Grids from neighbouring cities and the long corridor rows can meet at an angle.
  // Final clipping preserves every rendered local street without adding movement collisions.
  fabric.buildings = fabric.buildings.filter(building => !fabric.streets.some(street => {
    const a = street.path[0], b = street.path[1], margin = Math.max(building.width, building.depth) + street.width;
    if (building.x < Math.min(a[0], b[0]) - margin || building.x > Math.max(a[0], b[0]) + margin || building.z < Math.min(a[1], b[1]) - margin || building.z > Math.max(a[1], b[1]) + margin) return false;
    return urbanBuildingOnStreet(building, street);
  }));
  return fabric;
}
