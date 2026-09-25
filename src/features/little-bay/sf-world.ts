import geography from './sf-geography.json';

/** World x is east, z is south. One unit is approximately 100 metres. */
export type SfPoint = [x: number, z: number];
export type SfCoordinate = [longitude: number, latitude: number];
export type SfRoad = {
  id: string;
  name: string;
  classCode: number;
  width: number;
  driveable: boolean;
  path: SfPoint[];
};
export type SfNeighborhood = { name: string; rings: SfPoint[][] };
export type SfLandmark = {
  id: string;
  title: string;
  titleEn: string;
  kind: 'bridge' | 'park' | 'palace' | 'street' | 'pier' | 'island' | 'gate' | 'market' | 'cable-car' | 'peak' | 'square' | 'rainbow' | 'wheel' | 'tower' | 'houses' | 'ruins';
  coordinate: SfCoordinate;
  position: SfPoint;
  arrivalRadius: number;
  plannerPlaceId?: string;
  guideSlug?: string;
  sourceUrl: string;
};

export function projectCoordinate([lng, lat]: readonly number[]): SfPoint {
  return [(lng + 122.45) * 880, (37.77 - lat) * 1113];
}

export function unprojectPosition([x, z]: readonly number[]): SfCoordinate {
  return [x / 880 - 122.45, 37.77 - z / 1113];
}

export const SF_GEOGRAPHY_ATTRIBUTION = geography.attribution;
export const SF_GEOGRAPHY_SOURCES = geography.sources;
export const SF_CITY_RINGS: SfPoint[][] = geography.land.map(land => land.ring as SfPoint[]);
export const SF_LAND_AREAS = geography.land.map(land => ({ name: land.name, ring: land.ring as SfPoint[] }));
export const SF_NEIGHBORHOODS: SfNeighborhood[] = geography.neighborhoods.map(area => ({ name: area.name, rings: area.rings as SfPoint[][] }));

export const SF_ROADS: SfRoad[] = geography.roads.map(packed => {
  const [id, nameIndex, classCode, walkOnly, path] = packed as [string, number, number, number, SfPoint[]];
  return {
    id, name: geography.streetNames[nameIndex], classCode, driveable: !walkOnly,
    width: walkOnly ? .22 : classCode <= 3 && classCode > 0 ? .62 : classCode === 4 ? .48 : .36,
    path,
  };
});

function landmark(data: Omit<SfLandmark, 'position' | 'arrivalRadius'> & { arrivalRadius?: number }): SfLandmark {
  return { arrivalRadius: 2.2, ...data, position: projectCoordinate(data.coordinate) };
}

/** Stable place anchors; dates change activity content, never the city's geography. */
export const SF_LANDMARKS: SfLandmark[] = [
  landmark({ id: 'bridge', title: '金门大桥', titleEn: 'Golden Gate Bridge', kind: 'bridge', coordinate: [-122.47484, 37.80779], plannerPlaceId: 'golden-gate', guideSlug: 'sf-golden-gate-bridge-fort-point-guide', sourceUrl: 'https://presidio.gov/explore/attractions/golden-gate-bridge' }),
  landmark({ id: 'presidio', title: 'Presidio · Tunnel Tops', titleEn: 'Presidio Tunnel Tops', kind: 'park', coordinate: [-122.456111, 37.8027778], plannerPlaceId: 'presidio', guideSlug: 'presidio-picnic-day-guide', sourceUrl: 'https://presidio.gov/explore/attractions/presidio-tunnel-tops' }),
  landmark({ id: 'palace', title: '艺术宫', titleEn: 'Palace of Fine Arts', kind: 'palace', coordinate: [-122.448333, 37.802778], plannerPlaceId: 'palace', guideSlug: 'sf-palace-fine-arts-marina-guide', sourceUrl: 'https://www.sfrecpark.org/Facilities/Facility/Details/Palace-of-Fine-Arts-423' }),
  landmark({ id: 'lombard', title: '九曲花街', titleEn: 'Lombard Street', kind: 'street', coordinate: [-122.418716, 37.8021196], sourceUrl: 'https://www.sftravel.com/things-to-do/attractions/iconic-sf/lombard-street' }),
  landmark({ id: 'pier', title: '渔人码头 · PIER 39', titleEn: 'PIER 39 · Fisherman’s Wharf', kind: 'pier', coordinate: [-122.410357, 37.809992], plannerPlaceId: 'pier39', guideSlug: 'sf-fishermans-wharf-pier39-guide', sourceUrl: 'https://www.pier39.com/' }),
  landmark({ id: 'alcatraz', title: '恶魔岛', titleEn: 'Alcatraz Island', kind: 'island', coordinate: [-122.4230122, 37.8266636], plannerPlaceId: 'alcatraz', guideSlug: 'sf-alcatraz-booking-day-guide', sourceUrl: 'https://www.nps.gov/alca/planyourvisit/directions.htm' }),
  landmark({ id: 'chinatown', title: '唐人街 · 龙门', titleEn: 'Chinatown · Dragon Gate', kind: 'gate', coordinate: [-122.405585, 37.790685], plannerPlaceId: 'chinatown', guideSlug: 'sf-chinatown-north-beach-walk-guide', sourceUrl: 'https://www.sftravel.com/neighborhoods/chinatown' }),
  landmark({ id: 'ferry', title: 'Ferry Building', titleEn: 'Ferry Building', kind: 'market', coordinate: [-122.3933798907, 37.7954865278], sourceUrl: 'https://www.ferrybuildingmarketplace.com/' }),
  landmark({ id: 'park', title: '金门公园 · 花房', titleEn: 'Golden Gate Park', kind: 'park', coordinate: [-122.46, 37.772], arrivalRadius: 2.8, plannerPlaceId: 'golden-gate-park', guideSlug: 'golden-gate-park-free-car-free-day-guide', sourceUrl: 'https://www.sfrecpark.org/770/Golden-Gate-Park' }),
  landmark({ id: 'cable-car', title: 'Cable Car · 缆车', titleEn: 'Cable Car · Powell & Market', kind: 'cable-car', coordinate: [-122.40768, 37.7848], sourceUrl: 'https://www.sfmta.com/routes/powell-hyde-cable-car' }),
  landmark({ id: 'twin-peaks', title: 'Twin Peaks · 双子峰', titleEn: 'Twin Peaks', kind: 'peak', coordinate: [-122.4473944, 37.7527278], arrivalRadius: 2.6, sourceUrl: 'https://www.sfrecpark.org/Facilities/Facility/Details/Twin-Peaks-384' }),
  landmark({ id: 'union-square', title: 'Union Square · 联合广场', titleEn: 'Union Square', kind: 'square', coordinate: [-122.406768, 37.788507], sourceUrl: 'https://www.sftravel.com/neighborhoods/union-square' }),
  landmark({ id: 'castro', title: 'Castro · 彩虹街区', titleEn: 'Castro · 18th Street', kind: 'rainbow', coordinate: [-122.435151, 37.760952], sourceUrl: 'https://www.sftravel.com/neighborhoods/castro' }),
  landmark({ id: 'skystar', title: 'SkyStar · 摩天轮', titleEn: 'SkyStar Wheel', kind: 'wheel', coordinate: [-122.4133332, 37.8086815], sourceUrl: 'https://www.skystarwheel.com/' }),
  landmark({ id: 'coit', title: 'Coit Tower · 科伊特塔', titleEn: 'Coit Tower', kind: 'tower', coordinate: [-122.405886, 37.8027116], sourceUrl: 'https://www.sfrecpark.org/Facilities/Facility/Details/Coit-Tower-290' }),
  landmark({ id: 'painted-ladies', title: 'Painted Ladies · 彩绘女士', titleEn: 'Painted Ladies', kind: 'houses', coordinate: [-122.432832, 37.77561], sourceUrl: 'https://www.sftravel.com/things-to-do/attractions/iconic-sf/painted-ladies' }),
  landmark({ id: 'sutro', title: 'Sutro Baths · 海岸遗迹', titleEn: 'Sutro Baths', kind: 'ruins', coordinate: [-122.5137777, 37.7806323], sourceUrl: 'https://www.nps.gov/places/000/sutro-baths.htm' }),
];

/** Pier 33 is a mainland departure point, never the island's world position. */
export const SF_ALCATRAZ_DEPARTURE = {
  title: 'Pier 33 · Alcatraz Landing',
  coordinate: [-122.404663, 37.80767] as SfCoordinate,
  position: projectCoordinate([-122.404663, 37.80767]),
};

const hills = [
  [-122.4476, 37.7522, 3.75, 4.5, 4.0], // Twin Peaks south
  [-122.4469, 37.7543, 2.1, 3.4, 2.9], // Twin Peaks north
  [-122.4535, 37.7597, 1.4, 4.7, 3.3], // Mount Sutro
  [-122.4181, 37.802, 2.1, 4.1, 3.9], // Russian Hill
  [-122.4132, 37.7932, 1.65, 4.3, 4.0], // Nob Hill
  [-122.4059, 37.8027, 1.8, 1.9, 2.2], // Telegraph Hill
  [-122.4421, 37.7912, 1.5, 7.5, 3.7], // Pacific Heights
  [-122.481, 37.785, 1.3, 6, 4.5], // Presidio / Richmond
  [-122.423, 37.8267, .58, 1.15, 1.6], // Alcatraz
].map(([lng, lat, height, sx, sz]) => ({ point: projectCoordinate([lng, lat]), height, sx, sz }));

/** Smooth art-directed hills. These are NOT surveyed elevation or route gradients. */
export function terrainHeight(x: number, z: number): number {
  let height = 0;
  for (const hill of hills) {
    const dx = (x - hill.point[0]) / hill.sx;
    const dz = (z - hill.point[1]) / hill.sz;
    height += hill.height * Math.exp(-.5 * (dx * dx + dz * dz));
  }
  return height;
}

export function pointInRing(x: number, z: number, ring: readonly SfPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function isOnLand(x: number, z: number): boolean {
  return SF_CITY_RINGS.some(ring => pointInRing(x, z, ring));
}

export type SfRoadHit = { road: SfRoad; point: SfPoint; distance: number; segmentIndex: number; t: number; heading: number };
type Segment = { road: SfRoad; index: number; a: SfPoint; b: SfPoint };
const GRID_SIZE = 3;
const roadGrid = new Map<string, Segment[]>();
const allSegments: Segment[] = [];
for (const road of SF_ROADS) {
  for (let i = 0; i < road.path.length - 1; i++) {
    const a = road.path[i], b = road.path[i + 1];
    if (a[0] === b[0] && a[1] === b[1]) continue;
    const segment: Segment = { road, index: i, a, b };
    allSegments.push(segment);
    for (let gx = Math.floor(Math.min(a[0], b[0]) / GRID_SIZE); gx <= Math.floor(Math.max(a[0], b[0]) / GRID_SIZE); gx++) {
      for (let gz = Math.floor(Math.min(a[1], b[1]) / GRID_SIZE); gz <= Math.floor(Math.max(a[1], b[1]) / GRID_SIZE); gz++) {
        const key = `${gx},${gz}`;
        const items = roadGrid.get(key);
        if (items) items.push(segment); else roadGrid.set(key, [segment]);
      }
    }
  }
}

/** Grid-indexed closest centreline. Heading is atan2(dx,dz), compatible with +z car forward. */
export function nearestRoad(x: number, z: number, driveableOnly = false): SfRoadHit {
  if (!Number.isFinite(x) || !Number.isFinite(z)) throw new RangeError('A road query requires finite world coordinates');
  let best: SfRoadHit | undefined;
  const seen = new Set<Segment>();
  const inspect = (segment: Segment) => {
    if (seen.has(segment) || (driveableOnly && !segment.road.driveable)) return;
    seen.add(segment);
    const dx = segment.b[0] - segment.a[0], dz = segment.b[1] - segment.a[1];
    const t = Math.max(0, Math.min(1, ((x - segment.a[0]) * dx + (z - segment.a[1]) * dz) / (dx * dx + dz * dz)));
    const point: SfPoint = [segment.a[0] + dx * t, segment.a[1] + dz * t];
    const distance = Math.hypot(x - point[0], z - point[1]);
    if (!best || distance < best.distance) best = { road: segment.road, point, distance, segmentIndex: segment.index, t, heading: Math.atan2(dx, dz) };
  };
  const cx = Math.floor(x / GRID_SIZE), cz = Math.floor(z / GRID_SIZE);
  for (let radius = 0; radius < 16; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
        for (const segment of roadGrid.get(`${cx + dx},${cz + dz}`) || []) inspect(segment);
      }
    }
    const distanceToUnsearched = Math.min(x - (cx - radius) * GRID_SIZE, (cx + radius + 1) * GRID_SIZE - x, z - (cz - radius) * GRID_SIZE, (cz + radius + 1) * GRID_SIZE - z);
    if (best && best.distance <= distanceToUnsearched) return best;
  }
  // Distant overview queries still get the true closest road, never a partial search.
  for (const segment of allSegments) inspect(segment);
  return best!;
}

export function distanceToRoad(x: number, z: number, driveableOnly = false): number {
  return nearestRoad(x, z, driveableOnly).distance;
}

export function pointAlongRoad(road: SfRoad, fraction = .5): { point: SfPoint; heading: number } {
  const lengths = road.path.slice(1).map((point, index) => Math.hypot(point[0] - road.path[index][0], point[1] - road.path[index][1]));
  let remaining = lengths.reduce((sum, length) => sum + length, 0) * Math.max(0, Math.min(1, fraction));
  for (let index = 0; index < lengths.length; index++) {
    if (remaining <= lengths[index] || index === lengths.length - 1) {
      const a = road.path[index], b = road.path[index + 1], t = remaining / lengths[index];
      return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], heading: Math.atan2(b[0] - a[0], b[1] - a[1]) };
    }
    remaining -= lengths[index];
  }
  return { point: road.path[0], heading: 0 };
}

const labelNames = ['Market St', 'Van Ness Ave', 'Geary Blvd', 'California St', 'Lombard St', 'Columbus Ave', 'Powell St', 'Hyde St', 'Castro St', '18th St', 'Mission St', 'Fillmore St', 'Divisadero St', 'Fulton St', 'Lincoln Way', 'John F Kennedy Dr', 'Sunset Blvd', '19th Ave', 'Great Hwy', 'Twin Peaks Blvd', 'The Embarcadero', 'Bay St', 'Chestnut St', 'Broadway', 'Irving St'];
export const SF_MAJOR_STREET_LABELS = labelNames.flatMap(name => {
  const roads = SF_ROADS.filter(road => road.name === name);
  roads.sort((a, b) => {
    const length = (road: SfRoad) => road.path.slice(1).reduce((sum, point, i) => sum + Math.hypot(point[0] - road.path[i][0], point[1] - road.path[i][1]), 0);
    return length(b) - length(a);
  });
  return roads[0] ? [{ name, ...pointAlongRoad(roads[0]) }] : [];
});
