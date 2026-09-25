import { SF_CITY_RINGS, SF_LANDMARKS, SF_NEIGHBORHOODS, SF_ROADS, nearestRoad, terrainHeight } from './sf-world';
import type { SfLandmark, SfRoad } from './sf-world';
import { containsPoint, mapHash } from './san-francisco-geometry';
import type { MapPoint } from './san-francisco-geometry';

export type SfBuilding = { x: number; z: number; y: number; angle: number; width: number; depth: number; height: number; color: string };
export type SfCityTree = { x: number; z: number; y: number; scale: number };
export const SF_BUILDING_BUDGET = 4200;
export const SF_PARK_NAMES = new Set(['Golden Gate Park', 'Presidio', 'Lincoln Park', 'McLaren Park']);
const PALETTE = ['#dcc5a9', '#c7cdb3', '#a2beb3', '#e4d3aa', '#d8b8a6', '#dcd6ba', '#b6c7b5'];

export function sfSceneryClearance(landmark: SfLandmark) {
  return landmark.sceneryRadius ?? (landmark.kind === 'bridge' ? 4.5 : 2.7);
}

function onLand(point: MapPoint) { return SF_CITY_RINGS.some(ring => containsPoint(point, ring)); }
function inPark(point: MapPoint) {
  return SF_NEIGHBORHOODS.some(neighborhood => SF_PARK_NAMES.has(neighborhood.name)
    && neighborhood.rings.some(ring => containsPoint(point, ring)));
}
function clearOfLandmarks(x: number, z: number, extra = 0) {
  return SF_LANDMARKS.every(landmark => Math.hypot(landmark.position[0] - x, landmark.position[1] - z) >= sfSceneryClearance(landmark) + extra);
}

/** Visual hierarchy only; original streets remain intact for movement and street names. */
export function sfVisualRoads(roads: readonly SfRoad[] = SF_ROADS) {
  const avenues: SfRoad[] = [];
  const lanes: SfRoad[] = [];
  const paths: SfRoad[] = [];
  for (const road of roads) {
    if (!road.driveable) paths.push({ ...road, width: road.width * .68 });
    else if (road.classCode > 0 && road.classCode <= 4) avenues.push({ ...road, width: road.width * .95 });
    else lanes.push({ ...road, width: road.width * .72 });
  }
  return { avenues, lanes, paths };
}

/** Deterministic, spaced roadside miniatures; these are scenery, never business listings. */
export function makeSfCityScenery() {
  const candidates: SfBuilding[] = [];
  const trees: SfCityTree[] = [];
  const occupied = new Set<string>();
  for (const road of SF_ROADS) for (let index = 1; index < road.path.length; index++) {
    const a = road.path[index - 1]; const b = road.path[index];
    const dx = b[0] - a[0]; const dz = b[1] - a[1]; const length = Math.hypot(dx, dz);
    if (length < .55 || road.width > .95 || !road.driveable) continue;
    const angle = Math.atan2(dx, dz);
    for (let along = .45; along < length; along += 1.12) for (const side of [-1, 1]) {
      const offset = road.width / 2 + .47;
      const x = a[0] + dx * (along / length) + dz / length * offset * side;
      const z = a[1] + dz * (along / length) - dx / length * offset * side;
      const random = mapHash(x, z);
      if (random > .7) continue;
      const key = `${Math.round(x / .84)}:${Math.round(z / .84)}`;
      if (occupied.has(key) || !onLand([x, z]) || inPark([x, z]) || !clearOfLandmarks(x, z)) continue;
      const nearby = nearestRoad(x, z);
      if (nearby.distance < nearby.road.width / 2 + .24) continue;
      occupied.add(key);
      const variation = mapHash(x, z, 3);
      const downtown = x > 27 && z < -9 && z > -35;
      candidates.push({ x, z, y: terrainHeight(x, z), angle: angle - side * Math.PI / 2,
        width: .46 + variation * .14, depth: .46 + variation * .14,
        height: downtown ? .7 + variation * 1.65 : .38 + variation * .6,
        color: PALETTE[Math.floor(variation * PALETTE.length)] });
    }
  }
  // Cap after sampling the entire city, rather than stopping halfway across the map.
  const buildings = candidates.sort((a, b) => mapHash(a.x, a.z, 9) - mapHash(b.x, b.z, 9)).slice(0, SF_BUILDING_BUDGET);
  for (const building of buildings) {
    const random = mapHash(building.x, building.z, 4);
    if (random < .7) continue;
    const x = building.x + Math.cos(building.angle) * .4;
    const z = building.z - Math.sin(building.angle) * .4;
    const nearby = nearestRoad(x, z);
    if (onLand([x, z]) && clearOfLandmarks(x, z) && nearby.distance > nearby.road.width / 2 + .15)
      trees.push({ x, z, y: terrainHeight(x, z), scale: .32 + random * .18 });
  }
  for (const neighborhood of SF_NEIGHBORHOODS.filter(item => SF_PARK_NAMES.has(item.name))) {
    const points = neighborhood.rings.flat();
    const minX = Math.min(...points.map(p => p[0])); const maxX = Math.max(...points.map(p => p[0]));
    const minZ = Math.min(...points.map(p => p[1])); const maxZ = Math.max(...points.map(p => p[1]));
    for (let x = minX; x < maxX; x += 1.9) for (let z = minZ; z < maxZ; z += 1.9) {
      const tx = x + mapHash(x, z) * 1.1; const tz = z + mapHash(x, z, 1) * 1.1;
      if (!neighborhood.rings.some(ring => containsPoint([tx, tz], ring)) || !onLand([tx, tz]) || !clearOfLandmarks(tx, tz, .2)) continue;
      const nearby = nearestRoad(tx, tz);
      if (nearby.distance < nearby.road.width / 2 + .35) continue;
      trees.push({ x: tx, z: tz, y: terrainHeight(tx, tz), scale: .65 + mapHash(x, z, 2) * .5 });
    }
  }
  return { buildings, trees };
}

/** Short foam strokes follow the real coastline on the water side of each segment. */
export function makeSfShoreFoam() {
  const strokes: { x: number; z: number; angle: number; length: number; phase: number }[] = [];
  for (const ring of SF_CITY_RINGS) for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1]; const b = ring[i];
    const dx = b[0] - a[0]; const dz = b[1] - a[1]; const length = Math.hypot(dx, dz);
    if (length < .15) continue;
    const steps = Math.max(1, Math.ceil(length / 1.7));
    for (let step = 0; step < steps; step++) {
      const t = (step + .5) / steps;
      const centerX = a[0] + dx * t; const centerZ = a[1] + dz * t;
      const nx = -dz / length; const nz = dx / length;
      const side = onLand([centerX + nx * .28, centerZ + nz * .28]) ? -1 : 1;
      const x = centerX + nx * .3 * side; const z = centerZ + nz * .3 * side;
      if (onLand([x, z])) continue;
      strokes.push({ x, z, angle: Math.atan2(dz, dx), length: Math.min(1.35, length / steps * .78), phase: mapHash(x, z, 6) });
    }
  }
  return strokes;
}
