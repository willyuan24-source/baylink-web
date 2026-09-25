import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import test from 'node:test';
import { ATTRACTIONS } from '../src/data/attractions';
import {
  SF_ALCATRAZ_DEPARTURE, SF_CITY_RINGS, SF_LANDMARKS, SF_MAJOR_STREET_LABELS,
  SF_NEIGHBORHOODS, SF_ROADS, isOnLand, nearestRoad, projectCoordinate,
  terrainHeight, unprojectPosition,
} from '../src/features/little-bay/sf-world';

test('Mini SF retains real coordinate orientation and all 23 stable landmark anchors', () => {
  assert.equal(SF_LANDMARKS.length, 23);
  assert.equal(new Set(SF_LANDMARKS.map(place => place.id)).size, 23);
  const byId = (id: string) => SF_LANDMARKS.find(place => place.id === id)!;
  assert.ok(byId('bridge').position[0] < byId('pier').position[0]);
  assert.ok(byId('park').position[0] < byId('union-square').position[0]);
  assert.ok(byId('twin-peaks').position[1] > byId('union-square').position[1]);
  assert.ok(byId('alcatraz').position[1] < byId('pier').position[1]);
  for (const place of SF_LANDMARKS) {
    const restored = unprojectPosition(place.position);
    assert.ok(Math.abs(restored[0] - place.coordinate[0]) < 1e-10);
    assert.ok(Math.abs(restored[1] - place.coordinate[1]) < 1e-10);
    assert.ok(place.sourceUrl.startsWith('https://'));
    if (place.plannerPlaceId) {
      const attraction = ATTRACTIONS.find(item => item.id === place.plannerPlaceId);
      assert.ok(attraction, place.id);
      assert.equal(place.guideSlug, attraction.slug);
    }
  }
  assert.equal(SF_LANDMARKS.filter(place => place.plannerPlaceId).length, 7);
});

test('park museums keep their real campus spacing and coast attractions have land access', () => {
  const byId = (id: string) => SF_LANDMARKS.find(place => place.id === id)!;
  const tea = byId('japanese-tea-garden'), academy = byId('academy'), art = byId('de-young');
  assert.ok(tea.position[0] < art.position[0] && art.position[0] < academy.position[0]);
  assert.ok(art.position[1] < tea.position[1] && tea.position[1] < academy.position[1]);
  for (const place of [tea, academy, art]) {
    assert.ok(place.arrivalRadius <= 1.25, `${place.id} has an individual arrival area`);
    assert.equal(place.modelScale, 1, 'the close museum campus must not be enlarged into its neighbours');
    assert.ok(place.cameraDistance! <= 9, 'the compact detailed model has a closer camera');
    assert.ok(place.guideSlug?.includes('golden-gate-park'), 'broader park guide remains available');
  }
  for (const id of ['japanese-tea-garden', 'academy', 'de-young', 'ocean-beach', 'baker-beach', 'lands-end']) {
    const place = byId(id);
    assert.ok(isOnLand(...place.position), `${id} anchor is on the walkable land side`);
    assert.ok((place.sceneryRadius ?? 0) > 1);
  }
  assert.ok(byId('ocean-beach').position[0] < tea.position[0]);
  assert.ok(byId('lands-end').position[1] < byId('ocean-beach').position[1]);
  assert.ok(byId('baker-beach').position[1] < byId('lands-end').position[1]);
});

test('shoreline separates mainland, Alcatraz and ocean; departure stays at Pier 33', () => {
  assert.equal(SF_CITY_RINGS.length, 2);
  for (const ring of SF_CITY_RINGS) assert.deepEqual(ring[0], ring.at(-1));
  const land = (lng: number, lat: number) => isOnLand(...projectCoordinate([lng, lat]));
  assert.equal(land(-122.42, 37.78), true);
  assert.equal(land(-122.42295, 37.8267), true);
  assert.equal(land(-122.46, 37.825), false);
  assert.equal(land(-122.53, 37.77), false);
  const island = SF_LANDMARKS.find(place => place.id === 'alcatraz')!;
  assert.ok(Math.hypot(island.position[0] - SF_ALCATRAZ_DEPARTURE.position[0], island.position[1] - SF_ALCATRAZ_DEPARTURE.position[1]) > 20);
  assert.ok(SF_ALCATRAZ_DEPARTURE.coordinate[1] < island.coordinate[1]);
  for (const road of SF_ROADS) {
    for (const [x, z] of road.path) {
      assert.ok(!(x > 59 && z < -40), `${road.name} must not float above the omitted Treasure / Yerba Buena islands`);
    }
  }
  assert.ok(SF_ROADS.some(road => road.name === 'The Embarcadero'), 'legitimate mainland waterfront streets remain');
});

test('official roads cover residential districts and recognizable main streets within the data budget', () => {
  assert.ok(statSync(new URL('../src/features/little-bay/sf-geography.json', import.meta.url)).size < 700_000);
  assert.ok(SF_NEIGHBORHOODS.some(area => area.name === 'Golden Gate Park'));
  assert.ok(SF_NEIGHBORHOODS.some(area => area.name === 'Presidio'));
  assert.ok(SF_NEIGHBORHOODS.some(area => area.name === 'Sunset/Parkside'));
  assert.equal(SF_NEIGHBORHOODS.length, 40);
  for (const name of ['Market St', 'Van Ness Ave', 'Lombard St', 'Castro St', '19th Ave', 'Twin Peaks Blvd', 'Lincoln Way', 'Irving St']) {
    assert.ok(SF_ROADS.some(road => road.name === name), name);
    assert.ok(SF_MAJOR_STREET_LABELS.some(label => label.name === name), `${name} label`);
  }
  assert.ok(SF_ROADS.filter(road => road.classCode === 5).length > 1000);
  assert.equal(new Set(SF_ROADS.map(road => road.id)).size, SF_ROADS.length);
  for (const road of SF_ROADS) {
    assert.ok(road.path.length >= 2);
    assert.ok(road.width > 0 && road.width < 1);
    assert.ok(road.path.every(point => point.length === 2 && point.every(Number.isFinite)));
  }
});

test('nearest road returns valid collision projection and excludes walking-only JFK when driving', () => {
  const parkWalk = SF_ROADS.find(road => road.name === 'John F Kennedy Dr' && !road.driveable)!;
  assert.ok(parkWalk);
  assert.equal(nearestRoad(...parkWalk.path[1], true).road.driveable, true);
  for (const landmark of SF_LANDMARKS.filter(place => place.kind !== 'island')) {
    const hit = nearestRoad(...landmark.position, true);
    assert.ok(hit.road.driveable, landmark.id);
    assert.ok(hit.distance < 3.6, `${landmark.id} remains near its real access road: ${hit.distance}`);
    assert.ok(hit.t >= 0 && hit.t <= 1);
    const a = hit.road.path[hit.segmentIndex], b = hit.road.path[hit.segmentIndex + 1];
    assert.ok(Math.abs(hit.point[0] - a[0] - (b[0] - a[0]) * hit.t) < 1e-9);
    assert.ok(Math.abs(hit.point[1] - a[1] - (b[1] - a[1]) * hit.t) < 1e-9);
    assert.ok(Math.abs(hit.distance - Math.hypot(hit.point[0] - landmark.position[0], hit.point[1] - landmark.position[1])) < 1e-9);
  }
  assert.throws(() => nearestRoad(Number.NaN, 0), RangeError);
});

test('road index finds the global closest segment near grid edges and far outside the city', () => {
  for (const [x, z] of [[0, 0], [2.999, -3.001], [-27, -18], [64.8, 51.3], [-70, -75], [19, -62]]) {
    const hit = nearestRoad(x, z);
    let minimum = Infinity;
    for (const road of SF_ROADS) {
      for (let i = 1; i < road.path.length; i++) {
        const [ax, az] = road.path[i - 1], [bx, bz] = road.path[i];
        const length = (bx - ax) ** 2 + (bz - az) ** 2;
        if (length === 0) continue;
        const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / length));
        minimum = Math.min(minimum, Math.hypot(x - ax - t * (bx - ax), z - az - t * (bz - az)));
      }
    }
    assert.ok(Math.abs(hit.distance - minimum) < 1e-8, `${x},${z}`);
  }
});

test('art-directed hills rise at Twin Peaks and stay smooth enough for miniature streets', () => {
  const peak = SF_LANDMARKS.find(place => place.id === 'twin-peaks')!.position;
  const waterfront = SF_LANDMARKS.find(place => place.id === 'ferry')!.position;
  assert.ok(terrainHeight(...peak) > 4);
  assert.ok(terrainHeight(...waterfront) < .5);
  for (const place of SF_LANDMARKS) {
    const [x, z] = place.position;
    assert.ok(Number.isFinite(terrainHeight(x, z)));
    assert.ok(Math.abs(terrainHeight(x + .1, z) - terrainHeight(x, z)) < .25);
  }
});
