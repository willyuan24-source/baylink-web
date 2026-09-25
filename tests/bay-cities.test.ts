import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BAY_CITIES, bayCityAt, bayCityForPlace, createBayCityPresence, stepBayCityPresence,
  type BayCityPresence,
} from '../src/features/little-bay/bay-cities';
import { BAY_BRIDGES, UNIFIED_BAY_PLACES, bayBridgeAt, bayCanMove, getUnifiedPlace, projectBay } from '../src/features/little-bay/unified-bay-world';

const city = (id: string) => { const found = BAY_CITIES.find(item => item.id === id); assert.ok(found, id); return found; };
const tick = (state: BayCityPresence, id: string, now: number, flags: { active?: boolean; teleported?: boolean } = {}) => {
  const [x, z] = city(id).position;
  return stepBayCityPresence(state, { x, z, now, ...flags });
};

test('city centres keep their own focus, valid nearby recommendations and explicit community kinds', () => {
  assert.equal(BAY_CITIES.length, 31);
  assert.equal(new Set(BAY_CITIES.map(item => item.id)).size, BAY_CITIES.length);
  for (const item of BAY_CITIES) {
    assert.deepEqual(item.position, projectBay(item.coordinate));
    assert.ok(bayCanMove(...item.position), `${item.id} centre is playable land`);
    assert.equal(bayCityAt(...item.position)?.id, item.id, `${item.id} owns its centre`);
    assert.ok(getUnifiedPlace(item.focusKey), `${item.id} recommendation exists`);
    assert.ok(item.name && item.nameEn && item.subtitle.zh && item.subtitle.en);
  }
  assert.equal(city('stanford').kind, 'community');
  assert.equal(city('woodside').kind, 'town');
  assert.equal(city('mount-hamilton').kind, 'area');
  assert.notDeepEqual(city('sunnyvale').position, getUnifiedPlace(city('sunnyvale').focusKey)!.position);
});

test('every existing landmark keeps the known city, including shoreline and hill attractions', () => {
  for (const place of UNIFIED_BAY_PLACES) {
    const associated = bayCityForPlace(place);
    assert.ok(associated, place.key);
    assert.equal(associated.nameEn, place.regional?.city ?? 'San Francisco', place.key);
    assert.equal(bayCityForPlace(place.key), associated);
    if (!bayBridgeAt(...place.position)) assert.equal(bayCityAt(...place.position)?.id, associated.id, place.key);
  }
  assert.equal(bayCityForPlace('missing-place'), null);
  assert.equal(bayCityForPlace('peninsula:stanford')?.id, 'stanford');
  assert.equal(bayCityForPlace('south-bay:alviso')?.id, 'san-jose');
  assert.equal(bayCityForPlace('peninsula:coyote-point')?.id, 'san-mateo');
});

test('expanded cities recommend a real place in their own city instead of a distant neighbor', () => {
  for (const id of ['daly-city', 'south-san-francisco', 'san-bruno', 'millbrae', 'belmont', 'menlo-park', 'sunnyvale', 'santa-clara', 'milpitas', 'hayward', 'fremont', 'sfo-airport']) {
    const item = city(id);
    assert.equal(bayCityForPlace(item.focusKey)?.id, id, item.focusKey);
  }
  assert.equal(city('sfo-airport').kind, 'area');
});

test('water, bridges, nonfinite positions and distant countryside never claim a city', () => {
  for (const coordinates of [[-122.245, 37.69], [-122.22, 37.625], [-122.555, 37.741], [-122.5, 37.9], [-121.6, 37.91]])
    assert.equal(bayCityAt(...projectBay(coordinates)), null, String(coordinates));
  for (const bridge of BAY_BRIDGES) for (let index = 1; index < bridge.path.length; index++) {
    const a = bridge.path[index - 1], b = bridge.path[index];
    assert.equal(bayCityAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), null, bridge.id);
  }
  assert.equal(bayCityAt(NaN, 0), null);
  assert.equal(bayCityAt(Infinity, 0), null);
});

test('physical city entry requires a continuous second and fires only once per entry', () => {
  const original = createBayCityPresence();
  let result = tick(original, 'san-francisco', 0);
  assert.equal(result.entered, null);
  assert.equal(result.state.cityId, null);
  assert.deepEqual(original, createBayCityPresence(), 'pure reducer does not mutate caller state');
  result = tick(result.state, 'san-francisco', 999);
  assert.equal(result.entered, null);
  result = tick(result.state, 'san-francisco', 1000);
  assert.equal(result.entered?.id, 'san-francisco');
  assert.equal(result.state.cityId, 'san-francisco');
  result = tick(result.state, 'san-francisco', 9000);
  assert.equal(result.entered, null);
});

test('short boundary jitter does not replace the city or accumulate candidate dwell', () => {
  let state = tick(tick(createBayCityPresence(), 'sunnyvale', 0).state, 'sunnyvale', 1000).state;
  state = tick(state, 'mountain-view', 1100).state;
  assert.equal(state.cityId, 'sunnyvale');
  state = tick(state, 'sunnyvale', 1700).state;
  state = tick(state, 'mountain-view', 1900).state;
  assert.equal(tick(state, 'mountain-view', 2200).entered, null);
  const result = tick(state, 'mountain-view', 2900);
  assert.equal(result.entered?.id, 'mountain-view');
  assert.equal(result.state.cityId, 'mountain-view');
});

test('leaving into unlabelled space gets a 1.5 second buffer and permits a fresh later entry', () => {
  let state = tick(tick(createBayCityPresence(), 'san-francisco', 0).state, 'san-francisco', 1000).state;
  const [x, z] = projectBay([-122.245, 37.69]);
  state = stepBayCityPresence(state, { x, z, now: 1200 }).state;
  assert.equal(state.cityId, 'san-francisco');
  state = stepBayCityPresence(state, { x, z, now: 2699 }).state;
  assert.equal(state.cityId, 'san-francisco');
  state = stepBayCityPresence(state, { x, z, now: 2700 }).state;
  assert.equal(state.cityId, null);
  state = tick(state, 'san-francisco', 3000).state;
  assert.equal(tick(state, 'san-francisco', 4000).entered?.id, 'san-francisco');
});

test('overview and teleport cannot trigger entry or carry a nearly completed candidate', () => {
  for (const flags of [{ active: false }, { teleported: true }]) {
    let state = tick(createBayCityPresence(), 'oakland', 0).state;
    const result = tick(state, 'oakland', 2000, flags);
    assert.equal(result.entered, null);
    assert.equal(result.state.cityId, null);
    state = tick(result.state, 'oakland', 2100).state;
    assert.equal(tick(state, 'oakland', 3099).entered, null);
    assert.equal(tick(state, 'oakland', 3100).entered?.id, 'oakland');
  }
});

test('invalid positions and a backwards clock reset rather than fabricate elapsed dwell', () => {
  const state = tick(createBayCityPresence(), 'berkeley', 5000).state;
  for (const input of [{ x: NaN, z: 0, now: 8000 }, { x: 0, z: Infinity, now: 8000 }, { x: 0, z: 0, now: NaN }])
    assert.deepEqual(stepBayCityPresence(state, input), { state: createBayCityPresence(), entered: null });
  assert.equal(tick(state, 'berkeley', 4000).entered, null);
  assert.deepEqual(tick(state, 'berkeley', 4000).state, createBayCityPresence());
});
