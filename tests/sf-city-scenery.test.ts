import assert from 'node:assert/strict';
import test from 'node:test';
import { makeSfCityScenery, makeSfShoreFoam, SF_BUILDING_BUDGET, sfSceneryClearance, sfVisualRoads } from '../src/features/little-bay/sf-city-scenery';
import { isOnLand, SF_LANDMARKS, SF_ROADS } from '../src/features/little-bay/sf-world';

const scenery = makeSfCityScenery();

test('miniature scenery has a true citywide budget, open landmark space and lower residential roofs', () => {
  assert.ok(scenery.buildings.length > 1200, 'neighborhoods still feel inhabited');
  assert.ok(scenery.buildings.length <= SF_BUILDING_BUDGET);
  assert.ok(scenery.buildings.some(building => building.x < -35), 'western neighborhoods retained');
  assert.ok(scenery.buildings.some(building => building.x > 35), 'eastern neighborhoods retained');
  assert.ok(scenery.buildings.some(building => building.z > 45), 'southern neighborhoods retained');
  for (const building of scenery.buildings) {
    assert.ok(isOnLand(building.x, building.z));
    assert.ok(building.height > 0 && building.height < 2.36);
    const downtown = building.x > 27 && building.z < -9 && building.z > -35;
    if (!downtown) assert.ok(building.height < 1);
    for (const landmark of SF_LANDMARKS)
      assert.ok(Math.hypot(landmark.position[0] - building.x, landmark.position[1] - building.z) >= sfSceneryClearance(landmark), landmark.id);
  }
  for (const tree of scenery.trees) assert.ok(isOnLand(tree.x, tree.z));
});

test('visual road hierarchy preserves every original path and never changes driving data', () => {
  const originalWidths = SF_ROADS.map(road => road.width);
  const { avenues, lanes, paths } = sfVisualRoads();
  assert.equal(avenues.length + lanes.length + paths.length, SF_ROADS.length);
  assert.ok(avenues.some(road => road.name === 'Market St'));
  assert.ok(lanes.length > avenues.length);
  assert.ok(paths.every(road => !road.driveable));
  for (const road of [...avenues, ...lanes, ...paths]) {
    const original = SF_ROADS.find(item => item.id === road.id)!;
    assert.equal(road.path, original.path, road.id);
    assert.ok(road.width < original.width, road.id);
  }
  assert.deepEqual(SF_ROADS.map(road => road.width), originalWidths);
});

test('shore surf follows the published coastline and remains on water', () => {
  const foam = makeSfShoreFoam();
  assert.ok(foam.length > 100);
  for (const stroke of foam) {
    assert.equal(isOnLand(stroke.x, stroke.z), false);
    assert.ok(stroke.length > 0 && stroke.length <= 1.35);
    assert.ok(Number.isFinite(stroke.angle));
  }
});
