import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { buildingH, terrainY } from '../src/opus-bay/core/geo';
import type { Vec2 } from '../src/opus-bay/core/types';
import { SF_MODELS } from '../src/opus-bay/data/assets';
import { SF_LANDMARK_INFO, sfLandmarkInfo, sfLandmarkInfoByPlace } from '../src/opus-bay/data/sf/landmarks';
import {
  SF_LANDMARKS, type SfLandmark, buildLandmark, buildLandmarkAnimated, landmarkMatrix, landmarkToWorld, landmarkWalkWorld, sfLandmark, triangleBudget, worldToLandmark,
} from '../src/opus-bay/world/sf/landmarks/index';
import { GGB } from '../src/opus-bay/world/sf/landmarks/golden-gate-bridge';
import { LOMBARD } from '../src/opus-bay/world/sf/landmarks/lombard-crooked-street';

const triCount = (g: THREE.BufferGeometry) => (g.getIndex()?.count ?? g.getAttribute('position').count) / 3;
const inPoly = (p: Vec2, poly: Vec2[]) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};
const blocked = (l: SfLandmark, p: Vec2) => (l.walk?.blockers ?? []).some(b => ('poly' in b ? inPoly(p, b.poly) : Math.hypot(p.x - b.x, p.z - b.z) < b.r));
const geoCache = new Map<string, { g0: THREE.BufferGeometry; g2: THREE.BufferGeometry }>();
const geos = (l: SfLandmark) => {
  let g = geoCache.get(l.id);
  if (!g) { g = { g0: buildLandmark(l, 0, 0), g2: buildLandmark(l, 2, 0) }; geoCache.set(l.id, g); }
  return g;
};

/**
 * Reference positions (world u, district.ts project()): opus-qa/sf-data/landmarks.json where it names the structure,
 * else the OSM feature the model is built from (Painted Ladies: the 710–722 Steiner row; Hamon Tower: its OSM part;
 * Twin Peaks: Christmas Tree Point; the wheel sign: its OSM artwork node).
 */
const REF: Record<string, Vec2> = {
  'golden-gate-bridge': { x: -865.86, z: 508.5 },
  'sutro-tower': { x: 73.19, z: 973.68 },
  'city-hall': { x: 92.31, z: 418.18 },
  'de-young-tower': { x: -246.98, z: 930.99 },
  'palace-of-fine-arts': { x: -420.26, z: 422.27 },
  'twin-peaks': { x: 128.86, z: 922.72 },
  'painted-ladies': { x: 10.19, z: 570.35 },
  'dragon-gate': { x: 81.92, z: 174.7 },
  'conservatory-of-flowers': { x: -184.19, z: 852.9 },
  'dutch-windmill': { x: -580.69, z: 1311.93 },
  'mission-dolores': { x: 195.46, z: 647.57 },
  'grace-cathedral': { x: 1.58, z: 232.4 },
  'legion-of-honor': { x: -663.59, z: 1083.44 },
  'fort-point': { x: -750.43, z: 595.06 },
  'castro-theatre': { x: 151.9, z: 741.35 },
  // the ballpark is authored in the frame of its OSM outline (relation 7325085, oriented-box centre); landmarks.json's
  // bbox point (352.96, 162.31) is 3.9 u west of it on the same polygon
  'oracle-park': { x: 356.81, z: 162.26 },
  'peace-pagoda': { x: -63.06, z: 450.0 },
  'ghirardelli-square': { x: -235.55, z: 165.21 },
  'fishermans-wharf': { x: -201.14, z: 74.81 },
  'sutro-baths': { x: -726.24, z: 1246.52 },
  'cliff-house': { x: -710.15, z: 1265.18 },
  'cable-car-turntable': { x: 129.28, z: 257.51 },
  'lombard-crooked-street': { x: -157.58, z: 168.04 },
  'chase-center': { x: 491.19, z: 258.83 },
};

test('registry: unique kebab-case ids, tiers, T1 cast shadows, one info record per landmark', () => {
  const ids = SF_LANDMARKS.map(l => l.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const l of SF_LANDMARKS) {
    assert.match(l.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok([1, 2, 3].includes(l.tier), l.id);
    assert.ok(Number.isFinite(l.x) && Number.isFinite(l.z) && Number.isFinite(l.yaw), l.id);
    assert.ok(l.base === 'terrain' || Number.isFinite(l.base), l.id);
    if (l.tier === 1 && l.id !== 'twin-peaks') assert.equal(l.castShadow, true, `${l.id} casts shadows`);
    assert.ok(sfLandmarkInfo(l.id), `${l.id} has info`);
    assert.equal(sfLandmark(l.id), l);
  }
  assert.deepEqual(SF_LANDMARK_INFO.map(i => i.id).sort(), [...ids].sort());
  for (const id of ['golden-gate-bridge', 'sutro-tower', 'city-hall', 'de-young-tower', 'palace-of-fine-arts', 'painted-ladies', 'dragon-gate', 'lombard-crooked-street']) assert.ok(sfLandmark(id), id);
});

test('every landmark builds at lod 0 and lod 2 within its triangle budget; lod 2 is ≤ 10 % of lod 0', () => {
  for (const l of SF_LANDMARKS) {
    const { g0, g2 } = geos(l);
    const t0 = triCount(g0), t2 = triCount(g2);
    assert.ok(t0 > 0 && t2 > 0, l.id);
    assert.ok(t0 <= triangleBudget(l), `${l.id} lod0 ${t0} ≤ ${triangleBudget(l)}`);
    assert.ok(t2 <= t0 * 0.1 + 1e-9, `${l.id} lod2 ${t2} ≤ 10 % of ${t0}`);
    for (const g of [g0, g2]) {
      const p = g.getAttribute('position').array as Float32Array;
      for (let i = 0; i < p.length; i++) assert.ok(Number.isFinite(p[i]), `${l.id} finite positions`);
      assert.equal(g.getAttribute('aInfo').itemSize, 4);
      assert.equal(g.getAttribute('color').count, g.getAttribute('position').count);
    }
  }
});

test('positions: every landmark sits within 3 u of its reference point (the GGB towers within 0.5 u)', () => {
  for (const l of SF_LANDMARKS) {
    const r = REF[l.id];
    assert.ok(r, `${l.id} has a reference`);
    assert.ok(Math.hypot(l.x - r.x, l.z - r.z) <= 3, `${l.id} is ${Math.hypot(l.x - r.x, l.z - r.z).toFixed(2)} u from its reference`);
  }
  const ggb = sfLandmark('golden-gate-bridge')!;
  const south = landmarkToWorld(ggb, { x: -GGB.TOWER, z: 0 }), north = landmarkToWorld(ggb, { x: GGB.TOWER, z: 0 });
  assert.ok(Math.hypot(south.x + 796.12, south.z - 564.38) < 0.5, 'south tower');
  assert.ok(Math.hypot(north.x + 935.5, north.z - 452.73) < 0.5, 'north tower');
  const anchorS = landmarkToWorld(ggb, { x: GGB.ANCH_S, z: 0 }), anchorN = landmarkToWorld(ggb, { x: GGB.ANCH_N, z: 0 });
  assert.ok(Math.hypot(anchorS.x + 740.63, anchorS.z - 608.73) < 1, 'south anchorage');
  assert.ok(Math.hypot(anchorN.x + 978.84, anchorN.z - 418.75) < 1, 'north anchorage');
});

test('height policy: model heights follow plan §2.2 / §2.3 (H = 3.2 + 0.155·h, GGB on terrainY)', () => {
  const g = geos(sfLandmark('golden-gate-bridge')!).g0;
  g.computeBoundingBox();
  assert.ok(Math.abs(g.boundingBox!.max.y - GGB.TOP) < 0.4, `GGB top ${g.boundingBox!.max.y}`);
  // the bridge is tied to the terrain curve (core/geo.ts, plan §2.2): towers 227 m, mid-span deck 67 m
  assert.ok(Math.abs(GGB.TOP - terrainY(227)) < 0.1, `tower top ${GGB.TOP} vs terrainY(227) ${terrainY(227)}`);
  assert.ok(Math.abs(GGB.DECK - terrainY(67)) < 0.1, `deck ${GGB.DECK} vs terrainY(67) ${terrainY(67)}`);
  // mid-span cable dips close to the deck, and reaches the saddles at the towers
  assert.ok(GGB.cableY(0) > GGB.DECK && GGB.cableY(0) < GGB.DECK + 2);
  assert.ok(Math.abs(GGB.cableY(GGB.TOWER) - (GGB.TOP - 0.25)) < 1e-6);
  const H = buildingH;
  const expect: Record<string, number> = { 'sutro-tower': H(298), 'city-hall': H(94), 'palace-of-fine-arts': H(49), 'grace-cathedral': H(75), 'peace-pagoda': H(30), 'chase-center': H(38.1), 'de-young-tower': H(51) };
  for (const [id, h] of Object.entries(expect)) {
    const geo = geos(sfLandmark(id)!).g0;
    geo.computeBoundingBox();
    const top = geo.boundingBox!.max.y;
    assert.ok(Math.abs(top - h) / h < 0.08, `${id}: top ${top.toFixed(2)} vs H ${h.toFixed(2)}`);
  }
  for (const info of SF_LANDMARK_INFO) assert.ok(info.height.u >= 0 && Number.isFinite(info.height.realM), info.id);
});

test('orientation: local +z maps to (sin yaw, cos yaw); world ↔ local round trip; placement matrix agrees', () => {
  for (const l of SF_LANDMARKS) {
    const f = landmarkToWorld(l, { x: 0, z: 1 });
    assert.ok(Math.abs(f.x - l.x - Math.sin(l.yaw)) < 1e-9 && Math.abs(f.z - l.z - Math.cos(l.yaw)) < 1e-9, l.id);
    const p = { x: 3.3, z: -1.7 }, q = worldToLandmark(l, landmarkToWorld(l, p));
    assert.ok(Math.hypot(q.x - p.x, q.z - p.z) < 1e-9, l.id);
    const v = new THREE.Vector3(p.x, 0, p.z).applyMatrix4(landmarkMatrix(l, 5)), w = landmarkToWorld(l, p);
    assert.ok(Math.abs(v.x - w.x) < 1e-6 && Math.abs(v.z - w.z) < 1e-6 && Math.abs(v.y - 5) < 1e-6, l.id);
  }
  // facing checks against the real streets: the Dragon Gate looks south down Grant Ave, the Painted Ladies west over
  // Alamo Square, City Hall east to Civic Center Plaza (map north in world = (−0.719, −0.695), east = (0.695, −0.719))
  const north = { x: -0.719, z: -0.695 }, east = { x: 0.695, z: -0.719 };
  const facing = (id: string) => { const l = sfLandmark(id)!; return { x: Math.sin(l.yaw), z: Math.cos(l.yaw) }; };
  const cosTo = (a: Vec2, b: Vec2) => a.x * b.x + a.z * b.z;
  assert.ok(cosTo(facing('dragon-gate'), { x: -north.x, z: -north.z }) > Math.cos((15 * Math.PI) / 180), 'Dragon Gate faces south');
  assert.ok(cosTo(facing('painted-ladies'), { x: -east.x, z: -east.z }) > Math.cos((15 * Math.PI) / 180), 'Painted Ladies face west');
  assert.ok(cosTo(facing('city-hall'), east) > Math.cos((15 * Math.PI) / 180), 'City Hall faces east');
  assert.ok(cosTo(facing('castro-theatre'), east) > Math.cos((15 * Math.PI) / 180), 'Castro Theatre faces Castro St (east)');
});

test('exclude zones contain the landmark, arrival anchors are clear of blockers and inside a sane radius', () => {
  for (const l of SF_LANDMARKS) {
    if ('poly' in l.exclude) {
      assert.ok(l.exclude.poly.length >= 3, l.id);
      assert.ok(inPoly({ x: l.x, z: l.z }, l.exclude.poly), `${l.id} exclude contains the origin`);
    } else assert.ok(l.exclude.r > 0, l.id);
    const info = sfLandmarkInfo(l.id)!;
    assert.ok(!blocked(l, info.arrival), `${l.id} arrival ${JSON.stringify(info.arrival)} is not inside a blocker`);
    const d = Math.hypot(info.arrival.x, info.arrival.z);
    assert.ok(d < (l.id === 'golden-gate-bridge' ? 260 : 30), `${l.id} arrival within reach (${d.toFixed(1)} u)`);
    assert.ok(info.photo.distance > 0 && Math.abs(info.photo.elevation) < 1.5 && info.photo.target.every(Number.isFinite), l.id);
  }
});

test('walk data: valid blockers / surfaces; the Dragon Gate and the Legion gateway are walk-through; GGB deck', () => {
  for (const l of SF_LANDMARKS) {
    for (const b of l.walk?.blockers ?? []) {
      if ('poly' in b) assert.ok(b.poly.length >= 3 && b.poly.every(p => Number.isFinite(p.x) && Number.isFinite(p.z)), l.id);
      else assert.ok(b.r > 0, l.id);
    }
    for (const s of l.walk?.surfaces ?? []) assert.ok(s.poly.length >= 3 && (s.y === 'terrain' || Number.isFinite(s.y)), l.id);
  }
  const gate = sfLandmark('dragon-gate')!;
  for (let x = -1.1; x <= 1.1; x += 0.1) assert.ok(!blocked(gate, { x, z: 0 }), `Dragon Gate central opening clear at x=${x.toFixed(1)}`);
  const legion = sfLandmark('legion-of-honor')!;
  assert.ok(!blocked(legion, { x: 0, z: 6.2 }), 'Legion gateway opening');
  const ggb = sfLandmark('golden-gate-bridge')!;
  const deck = ggb.walk!.surfaces!.find(s => s.surface === 'road')!;
  assert.equal(deck.y, GGB.DECK);
  assert.ok(inPoly({ x: 0, z: 0 }, deck.poly) && inPoly({ x: -150, z: 1 }, deck.poly));
  assert.ok(blocked(ggb, { x: -GGB.TOWER, z: 2.55 }), 'tower leg blocks');
  // world-space conversion keeps numeric deck heights relative to the base
  const w = landmarkWalkWorld(ggb, 0);
  assert.equal(w.surfaces.length, ggb.walk!.surfaces!.length);
  assert.ok(w.surfaces.every(s => s.y === 'terrain' || Number.isFinite(s.y)));
});

test('Lombard: 8 hairpins, lane slices step gently, stairs rise ≤ 0.55 u per tread', () => {
  const l = sfLandmark('lombard-crooked-street')!;
  assert.equal(LOMBARD.TURNS.length, 8);
  const road = l.walk!.surfaces!.filter(s => s.surface === 'road').map(s => s.y as number);
  assert.ok(road.length > 20);
  for (let i = 1; i < road.length; i++) assert.ok(Math.abs(road[i] - road[i - 1]) < 0.3, `lane step ${i}`);
  assert.ok(road[0] - road[road.length - 1] > 6, 'Hyde end is well above Leavenworth');
  for (const sx of [-1, 1]) {
    const stairs = l.walk!.surfaces!.filter(s => s.surface === 'stairs' && Math.sign(s.poly[0].x) === sx).map(s => s.y as number);
    for (let i = 1; i < stairs.length; i++) assert.ok(Math.abs(stairs[i] - stairs[i - 1]) <= 0.55, 'tread rise');
  }
});

test('buildLandmark lifts TOY base heights by the placed base; the windmill sails turn', () => {
  const l = sfLandmark('city-hall')!;
  const a = buildLandmark(l, 2, 0).getAttribute('aInfo'), b = buildLandmark(l, 2, 7.5).getAttribute('aInfo');
  for (let i = 0; i < a.count; i++) assert.ok(Math.abs(b.getY(i) - a.getY(i) - 7.5) < 1e-5);
  const mill = sfLandmark('dutch-windmill')!;
  const sails = buildLandmarkAnimated(mill);
  assert.ok(sails && triCount(sails) > 50);
  const o = new THREE.Object3D();
  mill.animate!.update(o, 0);
  const r0 = o.rotation.z;
  mill.animate!.update(o, 2);
  assert.ok(o.position.y > 4 && Math.abs(o.rotation.z - r0) > 0.5);
  assert.equal(buildLandmarkAnimated(sfLandmark('city-hall')!), null);
});

test('info: bilingual names, verified real facts, BAYLINK links only to ids that exist', () => {
  const catalog = JSON.parse(readFileSync(new URL('../public/planner-catalog.json', import.meta.url), 'utf8')) as { places: { id: string }[] };
  const guides = JSON.parse(readFileSync(new URL('../public/baybay-guides.json', import.meta.url), 'utf8')) as { slug: string }[];
  const places = new Set(catalog.places.map(p => p.id)), slugs = new Set(guides.map(g => g.slug));
  for (const i of SF_LANDMARK_INFO) {
    for (const t of [i.name, i.zone, i.bark, i.realInfo.summary, ...i.realInfo.tips]) assert.ok(t.zh.trim() && t.en.trim(), `${i.id} bilingual`);
    assert.match(i.realInfo.sourceUrl, /^https:\/\//, i.id);
    for (const s of i.sources) assert.match(s, /^https:\/\//, i.id);
    if (i.officialUrl) assert.match(i.officialUrl, /^https:\/\//, i.id);
    assert.match(i.realInfo.verifiedAt, /^\d{4}-\d{2}-\d{2}$/, i.id);
    assert.ok(i.realInfo.tips.length >= 2, i.id);
    if (i.plannerPlaceId) assert.ok(places.has(i.plannerPlaceId), `${i.id}: planner place ${i.plannerPlaceId}`);
    if (i.guideSlug) assert.ok(slugs.has(i.guideSlug), `${i.id}: guide ${i.guideSlug}`);
    // lat/lng inside San Francisco and close to the model (≤ 60 m ≈ 8.4 u on the ground)
    assert.ok(i.lat > 37.70 && i.lat < 37.84 && i.lng > -122.52 && i.lng < -122.35, i.id);
    assert.equal(i.realInfo.lat, i.lat);
    assert.equal(i.realInfo.lng, i.lng);
  }
  // the routes the plan gates on (§7) carry their BAYLINK anchors
  assert.equal(sfLandmarkInfo('golden-gate-bridge')!.plannerPlaceId, 'golden-gate');
  assert.equal(sfLandmarkInfo('palace-of-fine-arts')!.plannerPlaceId, 'palace');
  assert.equal(sfLandmarkInfo('dragon-gate')!.plannerPlaceId, 'chinatown');
  assert.equal(sfLandmarkInfo('conservatory-of-flowers')!.plannerPlaceId, 'golden-gate-park');
});

test('D2-12: every landmark names its places.json row; zh follows the city glossary; no stale links', () => {
  const places = JSON.parse(readFileSync(new URL('../public/opus-bay/sf/v1/places.json', import.meta.url), 'utf8')) as { places: { id: string; x: number; z: number }[] };
  const byId = new Map(places.places.map(p => [p.id, p]));
  const seen = new Set<string>();
  for (const i of SF_LANDMARK_INFO) {
    const p = byId.get(i.placeId), l = sfLandmark(i.id)!;
    assert.ok(p, `${i.id}: place ${i.placeId} exists`);
    assert.ok(!seen.has(i.placeId), `${i.id}: place ${i.placeId} is not shared`);
    seen.add(i.placeId);
    // the place is the landmark (the bridge: its south tower, 89 u from the mid-span origin)
    assert.ok(Math.hypot(p.x - l.x, p.z - l.z) < (i.id === 'golden-gate-bridge' ? 95 : 30), `${i.id}: place near the model`);
    assert.equal(sfLandmarkInfoByPlace(i.placeId), i);
    if (i.plaza) assert.ok(i.plaza.zh.trim() && i.plaza.en.trim(), i.id);
  }
  const renamed: Record<string, string> = {
    'golden-gate-bridge': 'ggb-south-tower', 'de-young-tower': 'de-young', 'painted-ladies': 'alamo-square-painted-ladies',
    'dragon-gate': 'chinatown-dragon-gate', 'peace-pagoda': 'japantown-peace-pagoda', 'cable-car-turntable': 'cable-car-powell-market',
    'lombard-crooked-street': 'lombard-crooked',
  };
  for (const i of SF_LANDMARK_INFO) assert.equal(i.placeId, renamed[i.id] ?? i.id, i.id);
  // the words the HUD's neighbourhood labels and BAYBAY use (lane G2's glossary): never the old ones in a zh string
  const OLD = ['双子峰', '码头区', '缆车', '卡斯楚', 'Presidio'];
  for (const i of SF_LANDMARK_INFO) {
    for (const t of [i.name, i.zone, i.bark, i.realInfo.summary, i.realInfo.hours, i.realInfo.cost, ...i.realInfo.tips, i.plaza]) {
      if (t) for (const w of OLD) assert.ok(!t.zh.includes(w), `${i.id}: "${w}" in "${t.zh}"`);
    }
    // a guide tied to one month or year goes stale on a permanent card
    if (i.guideSlug) assert.ok(!/(january|february|march|april|may|june|july|august|september|october|november|december)|-20\d\d(-|$)/i.test(i.guideSlug), `${i.id}: ${i.guideSlug}`);
  }
  assert.equal(sfLandmarkInfo('cable-car-turntable')!.guideSlug, 'san-francisco-guide');
  assert.equal(sfLandmarkInfo('ghirardelli-square')!.plannerPlaceId, undefined, 'PIER 39 is not Ghirardelli Square');
  assert.equal(sfLandmarkInfo('twin-peaks')!.name.zh, '双峰观景台');
  // D2-04: the AI models name registry landmarks
  for (const [id, m] of Object.entries(SF_MODELS)) assert.ok(sfLandmark(m.landmarkId), `${id} → ${m.landmarkId}`);
});
