import assert from 'node:assert/strict';
import test from 'node:test';
import { BAY_CITIES } from '../src/features/little-bay/bay-cities';
import {
  makeUrbanFabric, urbanNatureAt, urbanRoadClearance, urbanLandmarkClearance, urbanBuildingOnStreet,
  URBAN_BUILDING_BUDGET, URBAN_TREE_BUDGET,
} from '../src/features/little-bay/urban-fabric';
import { BAY_ROADS, UNIFIED_BAY_PLACES, bayContains, bayHeight, projectBay, type UnifiedPlace } from '../src/features/little-bay/unified-bay-world';

const fabric = makeUrbanFabric();

test('inhabited city centres have a recognisable neighbourhood, with bounded deterministic population', () => {
  assert.ok(fabric.buildings.length > 1100, 'connected Bay cities need more than isolated landmark decorations');
  assert.ok(fabric.buildings.length <= URBAN_BUILDING_BUDGET);
  assert.ok(fabric.trees.length > 300 && fabric.trees.length <= URBAN_TREE_BUDGET);
  assert.ok(fabric.streets.length > 1000 && fabric.streets.length < 4000);
  assert.ok(fabric.gardens.length > 40);
  assert.equal(new Set(fabric.buildings.map(item => item.id)).size, fabric.buildings.length);
  assert.deepEqual(makeUrbanFabric(), fabric);
  for (const city of BAY_CITIES) {
    const count = fabric.buildings.filter(building => building.cityId === city.id).length;
    if (city.kind === 'area') assert.equal(count, 0, 'Mount Hamilton remains an undeveloped mountain');
    else assert.ok(count >= 5, `${city.nameEn} has only ${count} buildings`);
  }
});

test('downtown profiles stay distinct while most neighbourhoods remain low-rise', () => {
  for (const id of ['san-francisco', 'oakland', 'san-jose']) {
    const buildings = fabric.buildings.filter(item => item.cityId === id);
    assert.ok(buildings.length >= 55, id);
    assert.ok(Math.max(...buildings.map(item => item.height)) > 2.5, `${id} has a downtown silhouette`);
  }
  assert.ok(fabric.buildings.filter(item => item.height < 2).length > fabric.buildings.length * .8);
  assert.ok(new Set(fabric.buildings.map(item => item.color)).size >= 6);
  assert.ok(fabric.buildings.some(item => item.gabled) && fabric.buildings.some(item => !item.gabled));
});

test('buildings stay on land, outside reserves, roads, bridges and all current attraction approaches', () => {
  for (const building of fabric.buildings) {
    const radius = Math.hypot(building.width, building.depth) / 2;
    assert.ok(urbanRoadClearance(building.x, building.z) >= radius + .35, building.id);
    for (const place of UNIFIED_BAY_PLACES)
      assert.ok(Math.hypot(building.x - place.position[0], building.z - place.position[1]) >= urbanLandmarkClearance(place) + radius, `${building.id} blocks ${place.key}`);
    for (const [sx, sz] of [[0, 0], [-1, -1], [-1, 1], [1, 1], [1, -1]]) {
      const dx = sx * building.width / 2, dz = sz * building.depth / 2;
      const x = building.x + dx * Math.cos(building.angle) + dz * Math.sin(building.angle);
      const z = building.z - dx * Math.sin(building.angle) + dz * Math.cos(building.angle);
      assert.ok(bayContains(x, z), `${building.id} footprint reaches water`);
      assert.equal(urbanNatureAt(x, z), false, `${building.id} footprint reaches reserve`);
      assert.ok(building.base <= bayHeight(x, z) + .07, `${building.id} floats above terrain`);
      assert.ok(building.base + building.height > bayHeight(x, z), `${building.id} is buried`);
    }
    assert.equal(fabric.streets.some(street => urbanBuildingOnStreet(building, street)), false, `${building.id} blocks a local street`);
  }
});

test('new attractions clear their own space automatically without a fixed scenery allowlist', () => {
  const example = fabric.buildings.find(item => item.cityId === 'sunnyvale')!;
  const newPlace: UnifiedPlace = { ...UNIFIED_BAY_PLACES[0], key: 'test:new-attraction', id: 'new-attraction',
    position: [example.x, example.z], arrivalRadius: 5, sf: undefined, modelScale: 1 };
  const updated = makeUrbanFabric([...UNIFIED_BAY_PLACES, newPlace]);
  assert.ok(updated.buildings.length < fabric.buildings.length);
  for (const building of updated.buildings)
    assert.ok(Math.hypot(building.x - example.x, building.z - example.z) >= urbanLandmarkClearance(newPlace) + Math.hypot(building.width, building.depth) / 2);
  assert.ok(fabric.buildings.some(item => item.id === example.id), 'generation does not mutate existing layouts');
});

test('authored park, marsh and hillside reserves survive future density changes', () => {
  for (const coordinate of [[-122.483, 37.770], [-122.47, 37.798], [-122.433, 37.693], [-122.117, 37.457], [-122.18, 37.82]]) {
    const point = projectBay(coordinate);
    assert.equal(urbanNatureAt(...point), true, String(coordinate));
  }
  for (const road of BAY_ROADS.filter(item => item.kind === 'bridge')) for (const point of road.path)
    assert.ok(urbanRoadClearance(...point) <= 0, road.id);
  for (const street of fabric.streets) for (let part = 0; part <= 4; part++) {
    const a = street.path[0], b = street.path[1], t = part / 4;
    assert.ok(bayContains(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), 'local streets remain on land');
  }
});

test('street clipping handles rotated corners and parallel nearby roads', () => {
  const building = { ...fabric.buildings[0], x: 0, z: 0, angle: Math.PI / 4, width: 2, depth: 2 };
  assert.equal(urbanBuildingOnStreet(building, { path: [[-5, 0], [5, 0]], width: .8 }), true);
  assert.equal(urbanBuildingOnStreet(building, { path: [[-5, 1.2], [5, 1.2]], width: .4 }), true);
  assert.equal(urbanBuildingOnStreet(building, { path: [[-5, 3], [5, 3]], width: .8 }), false);
});
