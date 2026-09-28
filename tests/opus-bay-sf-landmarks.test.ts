import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { buildingH, terrainY } from '../src/opus-bay/core/geo';
import type { Vec2 } from '../src/opus-bay/core/types';
import { SF_MODELS } from '../src/opus-bay/data/assets';
import { SF_LANDMARK_INFO, sfLandmarkInfo, sfLandmarkInfoByPlace } from '../src/opus-bay/data/sf/landmarks';
import { SF_ROUTES } from '../src/opus-bay/data/sf/routes';
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
  // the theatre stands on the EAST side of Castro St (OSM way 1206216224 spans lng −122.43504…−122.43445; Castro St's
  // centreline runs at −122.4352): its facade faces west onto the street (lane D2, D2-09; it faced east before)
  assert.ok(cosTo(facing('castro-theatre'), { x: -east.x, z: -east.z }) > Math.cos((15 * Math.PI) / 180), 'Castro Theatre faces Castro St (west)');
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
  // W4-IL13 (verify C6 / C7): zh text uses the game's zh names (lane C's cards, the map and VOICE.md), never the English
  // name of a place that has one (a gloss in （） is fine); Lands End is 天涯海角, never 海角 alone
  const EN_WITH_ZH = ['Grant Ave', 'North Beach', 'Washington Square', 'Twin Peaks', 'Ocean Beach', 'Dolores Park', 'Sutro Baths', 'Marina Green',
    'Crissy Field', 'Lands End', 'Ferry Building', 'Embarcadero', 'Aquatic Park', 'JFK Promenade', 'Music Concourse', 'Mount Sutro', 'Harvey Milk Plaza',
    'Alamo Square', 'Queen Wilhelmina', 'Christmas Tree Point', 'Coit Tower'];
  const zhTexts = [
    ...SF_LANDMARK_INFO.flatMap(i => [i.name, i.zone, i.bark, i.realInfo.summary, i.realInfo.hours, i.realInfo.cost, ...i.realInfo.tips, i.plaza].map(t => [i.id, t] as const)),
    ...SF_ROUTES.flatMap(r => [r.name, r.blurb, ...r.stops.flatMap(s => [s.name, s.line])].map(t => [r.id, t] as const)),
  ];
  for (const [id, t] of zhTexts) {
    if (!t) continue;
    const zh = t.zh.replace(/（[^）]*）/g, '');
    for (const w of EN_WITH_ZH) assert.ok(!zh.includes(w), `${id}: "${w}" in the zh text "${t.zh}"`);
    assert.ok(!/(^|[^涯])海角/.test(zh), `${id}: 海角 without 天涯 in "${t.zh}"`);
  }
  // verify C3: the Cliff House card says what lane C's status says (closed, restoring, the operator's target), no café date
  const cliff = sfLandmarkInfo('cliff-house')!.realInfo.summary;
  assert.ok(cliff.zh.includes('2026 年底') && !cliff.zh.includes('咖啡馆') && !/caf[eé]/i.test(cliff.en), cliff.zh);
  // verify C8: route R1 passes Portsmouth Square while it is fenced off for its rebuild (June 2026 – about 2028)
  const ports = SF_ROUTES.find(r => r.id === 'r1')!.stops.find(s => s.id === 'r1-portsmouth')!;
  assert.ok(ports.line.zh.includes('2028') && ports.line.en.includes('2028'), ports.line.zh);
  assert.equal(sfLandmarkInfo('cable-car-turntable')!.guideSlug, 'san-francisco-guide');
  assert.equal(sfLandmarkInfo('ghirardelli-square')!.plannerPlaceId, undefined, 'PIER 39 is not Ghirardelli Square');
  assert.equal(sfLandmarkInfo('twin-peaks')!.name.zh, '双峰观景台');
  // D2-04: the AI models name registry landmarks
  for (const [id, m] of Object.entries(SF_MODELS)) assert.ok(sfLandmark(m.landmarkId), `${id} → ${m.landmarkId}`);
});

// ---------------------------------------------------------------------------
// Wave-4 integration (lane L): the sites are registered and drawn
// ---------------------------------------------------------------------------

test('W4-IL1: SF_SITES = the 24 landmarks + every wave-4 record; sfLandmark finds each; CitySites draws, excludes and walks them all', async () => {
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { W4_ALL_SITES, W4_SITES, siteLod0R } = await import('../src/opus-bay/world/sf/landmarks/w4sites');
  const { W4_SITES_T3 } = await import('../src/opus-bay/world/sf/landmarks/w4list3');
  const { CitySites, LOD0 } = await import('../src/opus-bay/world/sf/sites');
  assert.equal(SF_LANDMARKS.length, 24, 'SF_LANDMARKS stays the 24 records with an info card (cards, arrivals, place rows)');
  assert.deepEqual(SF_SITES.map(l => l.id), [...SF_LANDMARKS, ...W4_SITES, ...W4_SITES_T3].map(l => l.id));
  assert.deepEqual(W4_ALL_SITES.map(l => l.id), [...W4_SITES, ...W4_SITES_T3].map(l => l.id));
  assert.equal(new Set(SF_SITES.map(l => l.id)).size, SF_SITES.length, 'unique ids across the landmarks and the sites');
  for (const l of SF_SITES) assert.equal(sfLandmark(l.id), l, l.id);
  const sites = new CitySites();
  try {
    assert.equal(sites.counts().sites, SF_SITES.length);
    assert.deepEqual(sites.excludes().map(e => e.id), SF_SITES.map(l => l.id), 'every site excludes its footprint from the city');
    const walk = sites.walkInputs();
    for (const s of W4_ALL_SITES) {
      const w = walk.find(q => q.id === s.id)!;
      assert.equal(w.sink, 0, `${s.id}: the city ground under a draped site is not sunk`);
      assert.equal(w.walk?.blockers.length, s.walk?.blockers.length ?? 0, `${s.id}: blockers reach the walk raster`);
      assert.ok((w.walk?.blockers ?? []).every(b => typeof b.top === 'number' && b.top > 0), `${s.id}: every blocker carries its measured top`);
    }
    // the lod-0 ring of each site: its w4.lod0R where set (the downtown diet), else the tier's
    const ring = (sites as unknown as { sites: { l: SfLandmark; lodK: number }[] }).sites;
    for (const s of ring) assert.equal(Math.round(LOD0[s.l.tier] * s.lodK), siteLod0R(s.l) ?? LOD0[s.l.tier], s.l.id);
  } finally { sites.dispose(); }
});

test('W4-IL1: no wave-4 site excludes ground another site does (every pair with a wave-4 or tier-3 site)', async () => {
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const ring = (l: SfLandmark): Vec2[] => ('poly' in l.exclude ? l.exclude.poly : Array.from({ length: 32 }, (_, k) => ({ x: l.x + Math.cos((k / 32) * Math.PI * 2) * (l.exclude as { r: number }).r, z: l.z + Math.sin((k / 32) * Math.PI * 2) * (l.exclude as { r: number }).r })));
  const cross = (a: Vec2, b: Vec2, c: Vec2, d: Vec2) => {
    const o = (p: Vec2, q: Vec2, r: Vec2) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  };
  const overlap = (A: Vec2[], B: Vec2[]) => A.some(p => inPoly(p, B)) || B.some(p => inPoly(p, A)) || A.some((p, i) => B.some((q, j) => cross(p, A[(i + 1) % A.length], q, B[(j + 1) % B.length])));
  const polys = SF_SITES.map(l => ({ l, p: ring(l), r: Math.max(...ring(l).map(q => Math.hypot(q.x - l.x, q.z - l.z))) }));
  for (let i = 0; i < polys.length; i++) for (let j = i + 1; j < polys.length; j++) {
    const a = polys[i], b = polys[j];
    // the 24 landmarks' own pairs are wave-2 decisions (the bridge's exclusion takes in Fort Point's bluff)
    if (SF_LANDMARKS.includes(a.l) && SF_LANDMARKS.includes(b.l)) continue;
    if (Math.hypot(a.l.x - b.l.x, a.l.z - b.l.z) > a.r + b.r) continue;
    assert.ok(!overlap(a.p, b.p), `${a.l.id} and ${b.l.id} exclude the same ground`);
  }
});

test('W4-IL1: the landmark helpers answer for the wave-4 sites (anchor, frame, photo, flags, plaza spots, tall parts)', async () => {
  const ctx = await import('../src/opus-bay/world/sf/landmarks/context');
  const { W4_ALL_SITES } = await import('../src/opus-bay/world/sf/landmarks/w4sites');
  for (const s of W4_ALL_SITES) {
    const a = ctx.sfLandmarkAnchor(s.id)!, w = landmarkToWorld(s, s.w4.arrival);
    assert.ok(a && Math.hypot(a.x - w.x, a.z - w.z) < 1e-9 && Math.abs(a.heading - (s.w4.arrival.heading + s.yaw)) < 1e-9, `${s.id}: anchor = w4.arrival placed`);
    assert.deepEqual(ctx.sitePhoto(s.id), { ...s.w4.photo, target: [...s.w4.photo.target] }, `${s.id}: photo`);
    assert.deepEqual(ctx.siteFrame(s.id, l => (l.base as number) + 1), { x: s.x, y: s.base + 1, z: s.z, yaw: s.yaw }, `${s.id}: frame with the caller's base`);
    const f = ctx.siteFlagTop(s.id)!;
    assert.ok(f.h >= 28 && f.h <= 70, `${s.id}: flag ${f.h}`);
  }
  // the 24 landmarks keep their info poses
  const info = sfLandmarkInfo('city-hall')!;
  assert.deepEqual(ctx.sitePhoto('city-hall'), { ...info.photo, target: [...info.photo.target] });
  assert.equal(ctx.sitePhoto('no-such-site'), null);
  assert.equal(ctx.siteFrame('no-such-site', () => 0), null);
  // F's crowd stands on the new plazas too, never inside a site's blockers
  const spots = ctx.landmarkPlazaSpots();
  const withPlaza = W4_ALL_SITES.filter(s => s.plaza?.length);
  assert.ok(withPlaza.length >= 10, `${withPlaza.length} sites with plazas`);
  for (const s of withPlaza) assert.ok(spots.some(p => p.id === s.id), `${s.id}: plaza spots`);
  for (const p of spots) {
    const l = sfLandmark(p.id)!, walk = landmarkWalkWorld(l, 0);
    for (const b of walk.blockers) assert.ok('poly' in b ? !inPoly(p, b.poly) : Math.hypot(p.x - b.x, p.z - b.z) >= b.r, `${p.id}: spot (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) in a blocker`);
  }
  // the glide: a site taller than 10 u over its base without tall parts gets the day-0 circle over its measured top
  const tall = ctx.landmarkTallStructures(l => (typeof l.base === 'number' ? l.base : 0));
  const ucsf = tall.find(t => t.id === 'ucsf-parnassus');
  assert.ok(ucsf && ucsf.top >= (sfLandmark('ucsf-parnassus')!.base as number) + 17, 'the UCSF crane stands in the glide');
  assert.ok(!tall.some(t => t.id === 'dolores-park'), 'an overlook site is flown over');
});

test('W4-IL3: kit.pyramid caps the w × d rectangle (turned before the scale), turned by ry, apex at the centre', async () => {
  const { pyramid } = await import('../src/opus-bay/world/sf/landmarks/kit');
  const { Batch } = await import('../src/opus-bay/world/builder');
  const ext = (w: number, d: number, ry: number) => {
    const b = new Batch();
    pyramid(b, 0, 0, 0, w, d, 1, '#ffffff', ry);
    const p = b.build().getAttribute('position');
    let x = 0, z = 0, top = { x: 0, z: 0, y: -Infinity };
    for (let i = 0; i < p.count; i++) {
      x = Math.max(x, Math.abs(p.getX(i))); z = Math.max(z, Math.abs(p.getZ(i)));
      if (p.getY(i) > top.y) top = { x: p.getX(i), z: p.getZ(i), y: p.getY(i) };
    }
    return { x, z, top };
  };
  const a = ext(3.8, 1.2, 0);
  assert.ok(Math.abs(a.x - 1.9) < 1e-5 && Math.abs(a.z - 0.6) < 1e-5, `3.8 × 1.2 cap reaches ±${a.x.toFixed(3)} / ±${a.z.toFixed(3)} (a rhombus reached 1.9 on both)`);
  assert.ok(Math.abs(a.top.y - 1) < 1e-6 && Math.hypot(a.top.x, a.top.z) < 1e-6, 'apex over the centre');
  const t = ext(4, 1, Math.PI / 2);
  assert.ok(Math.abs(t.x - 0.5) < 1e-5 && Math.abs(t.z - 2) < 1e-5, 'turned by ry after the scale');
  const s = ext(2, 2, 0);
  assert.ok(Math.abs(s.x - 1) < 1e-5 && Math.abs(s.z - 1) < 1e-5, 'a square cap is unchanged');
});

test('W4-IL7 (W4-L7): Strawberry Hill is reached on foot over both footbridges (walk decks on the bridge ways)', async () => {
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { setCityTerrain, canStand } = await import('../src/opus-bay/core/terrain');
  const { findPath } = await import('../src/opus-bay/actors/nav');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  await sf.attachAround(city, -262, 1030, 160, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    // from the lake drive at each bridge's foot onto the island (beyond the south bridge's far end; the north bridge's
    // island end, where the island path climbs), and on to the Chinese Pavilion's arrival spot
    const heron = sfLandmark('blue-heron-lake')!, pav = landmarkToWorld(heron, (heron as unknown as { w4: { arrival: Vec2 } }).w4.arrival);
    for (const [from, to] of [[{ x: -274.15, z: 1011.0 }, { x: -270.9, z: 1019.5 }], [{ x: -270.0, z: 1051.8 }, { x: -271.5, z: 1045.0 }], [{ x: -274.15, z: 1011.0 }, pav]]) {
      assert.ok(canStand(from.x, from.z) && canStand(to.x, to.z), 'both ends standable');
      const r = findPath(from, to);
      assert.ok(r && !r.snapped, `over the bridge ${JSON.stringify(from)} → ${JSON.stringify(to)}: ${r ? `snapped at ${JSON.stringify(r.points.at(-1))}` : 'no path'}`);
    }
  } finally { setCityTerrain(null); }
});

test('W4-IL11 (verify D1): the Golden Gate Bridge deck over Fort Point walks through to the south tower; the fort still walls in at ground level', async () => {
  const { createCityTerrain, UNDER_DECK } = await import('../src/opus-bay/core/sfTerrain');
  const { setCityTerrain, canStand, heightAt, pushOutOfBlockers, standAt } = await import('../src/opus-bay/core/terrain');
  const { findPath } = await import('../src/opus-bay/actors/nav');
  const { CitySites } = await import('../src/opus-bay/world/sf/sites');
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const sf = sfDisk();
  const lms = new CitySites().walkInputs(); // what the game streams (blocker tops included)
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  await sf.attachAround(city, -760, 590, 120, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    // the verify repro: the deck from (-740, 607) toward BAYBAY's lead target by the south tower, over the fort's west part
    const a = { x: -740, z: 607 }, b = { x: -794.7, z: 565.4 };
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = heightAt(x, z);
      assert.ok(y > 14, `on the deck at t ${t.toFixed(2)} (y ${y.toFixed(2)})`);
      assert.ok(canStand(x, z, 0.4) && standAt(x, z) === 1, `the deck is standable at (${x.toFixed(1)}, ${z.toFixed(1)})`);
      const q = pushOutOfBlockers(x, z, 0.4);
      assert.ok(Math.hypot(q.x - x, q.z - z) < 1e-6, `no wall on the deck at (${x.toFixed(1)}, ${z.toFixed(1)})`);
    }
    const r = findPath(a, b);
    assert.ok(r && !r.snapped, `a walk along the deck: ${r ? `snapped at ${JSON.stringify(r.points.at(-1))}` : 'no path'}`);
    // Fort Point's own walls still stand where its ground is: the parade ground and the landward wall are not walkable
    const fp = sfLandmark('fort-point')!;
    let ground = 0, wall = 0;
    for (let lz = -5; lz <= 4; lz++) {
      for (let lx = -6; lx <= 5; lx++) {
        const p = landmarkToWorld(fp, { x: lx, z: lz });
        if (!blocked(fp, { x: lx, z: lz }) || heightAt(p.x, p.z) > 5) continue;
        ground++;
        if (!canStand(p.x, p.z, 0.4)) wall++;
      }
    }
    assert.ok(ground >= 30 && wall === ground, `the fort blocks at ground level (${wall} of ${ground} samples inside its outline)`);
    assert.equal(UNDER_DECK, 1);
  } finally { setCityTerrain(null); }
});

test('W4-IL12 (verify D3): no landmark card / arrival spot stands on a vehicle line (a car brakes for a person on its line ahead and never reaches its stop)', async () => {
  const { LANDMARK_ARRIVALS } = await import('../src/opus-bay/data/sf/arrivals');
  type Line = { id: string; kind: string; path: number[]; tunnels?: [number, number][] };
  const read = (f: string) => (JSON.parse(readFileSync(new URL(`../public/opus-bay/sf/v1/${f}`, import.meta.url), 'utf8')) as { lines: Line[] }).lines;
  // the side reach of each surface vehicle's "person ahead" rule (world/transitLine onTrackAhead 1.3, busSystem
  // onRoadAhead 1.5) + the player's radius (0.4) and a margin; light rail runs underground where the arrivals are near it
  const reach: Record<string, number> = { 'cable-car': 1.3 + 0.5, streetcar: 1.3 + 0.5, bus: 1.5 + 0.5 };
  const lines = [...read('transit.json'), ...read('transit-w4.json')].filter(l => reach[l.kind] !== undefined);
  assert.ok(lines.some(l => l.kind === 'cable-car') && lines.some(l => l.kind === 'bus'), 'the cable cars and the loop are read');
  const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
    const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L));
    return Math.hypot(px - ax - dx * t, pz - az - dz * t);
  };
  for (const [id, a] of Object.entries(LANDMARK_ARRIVALS)) {
    for (const l of lines) {
      let d = Infinity;
      for (let i = 0; i + 5 < l.path.length; i += 3) d = Math.min(d, segDist(a.x, a.z, l.path[i], l.path[i + 2], l.path[i + 3], l.path[i + 5]));
      assert.ok(d >= reach[l.kind], `${id}'s arrival is ${d.toFixed(2)} u from ${l.id}'s line (needs ${reach[l.kind]})`);
    }
  }
});

test('W4-L-int-review: a terrain-base landmark keeps its blockers in rasters streamed after the renderer pinned its base (the under-deck rule needs a known base)', async () => {
  const { createCityTerrain } = await import('../src/opus-bay/core/sfTerrain');
  const { CitySites } = await import('../src/opus-bay/world/sf/sites');
  const { SF_SITES, blockerTops } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { demSample } = await import('../src/opus-bay/world/sf/format');
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const sf = sfDisk(), far = await sf.far();
  // the game's order (world/sf/stream.ts): walk inputs at start (a 'terrain' site's baseY is still 0), the far DEM, the
  // renderer's first base estimate pinned (sites.attach → onBase → setLandmarkBase), then the chunk rasters stream in
  const sites = new CitySites(), lms = sites.walkInputs();
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(far);
  sites.onBase = (id, y) => { city.setLandmarkBase(id, y); };
  sites.attach(null as never, (x, z) => demSample(far.dem, x, z));
  const terrainSites = SF_SITES.filter(l => l.base === 'terrain' && blockerTops(l).some(t => t !== undefined));
  assert.ok(terrainSites.some(l => l.id === 'peace-pagoda') && terrainSites.some(l => l.id === 'mission-dolores'), 'the premise: terrain-base sites with measured tops');
  const lost: string[] = [];
  let n = 0;
  for (const l of terrainSites) {
    assert.equal(lms.find(w => w.id === l.id)!.baseY, 0, `${l.id}: the streamed walk input's baseY (premise)`);
    await sf.attachAround(city, l.x, l.z, 40, lms);
    const tops = blockerTops(l);
    for (const [i, b] of l.walk!.blockers.entries()) {
      if (tops[i] === undefined) continue;
      const c = 'poly' in b ? { x: b.poly.reduce((s, p) => s + p.x, 0) / b.poly.length, z: b.poly.reduce((s, p) => s + p.z, 0) / b.poly.length } : { x: b.x, z: b.z };
      const p = landmarkToWorld(l, c);
      n++;
      if (!city.blockedAt(p.x, p.z) || city.standAt(p.x, p.z) === 1 || !city.hitsBlocker(p.x, p.z, 0.3)) lost.push(`${l.id} #${i}`);
    }
  }
  assert.ok(n >= 10, `blockers checked: ${n}`);
  assert.deepEqual(lost, [], 'blockers standable in the rasters or passed by the queries');
});

test('W4-L-int-review: every site\'s arrival stands on walkable pavement off the traffic\'s asphalt, and no crowd spot stands on it', async () => {
  const { createCityTerrain } = await import('../src/opus-bay/core/sfTerrain');
  const { canStand, setCityTerrain, surfaceAt } = await import('../src/opus-bay/core/terrain');
  const { CURB_BAND } = await import('../src/opus-bay/core/geo');
  const { CitySites } = await import('../src/opus-bay/world/sf/sites');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { landmarkPlazaSpots, sfLandmarkAnchor } = await import('../src/opus-bay/world/sf/landmarks/context');
  const { arrivalSpot } = await import('../src/opus-bay/actors/nav');
  const card = new Set(SF_LANDMARK_INFO.map(i => i.id));
  const { ROAD_CLASSES, demSample } = await import('../src/opus-bay/world/sf/format');
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const sf = sfDisk(), far = await sf.far();
  const sites = new CitySites(), lms = sites.walkInputs();
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(far);
  sites.onBase = (id, y) => { city.setLandmarkBase(id, y); };
  sites.attach(null as never, (x, z) => demSample(far.dem, x, z));
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  // The toy traffic (world/sf/traffic.ts) stops for the player only where the terrain says 'road' (cityLife people:
  // surfaceAt === 'road'), and never for a standing sightseer (crowd.ts spawnStander puts one exactly on a landmark
  // plaza spot, the roadway check skipped). A point is in the traffic when the rasters paint it 'road' AND it lies on a
  // driven street's asphalt as they paint it (core/sfTerrain roads: the CURB_BAND edge of a street ≥ 3 u is pavement).
  const DRIVEN = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential']);
  const chunks = new Map<string, Awaited<ReturnType<typeof sf.chunk>>>();
  const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
    const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L));
    return Math.hypot(px - ax - dx * t, pz - az - dz * t);
  };
  const inTraffic = async (p: Vec2): Promise<string | null> => {
    await sf.attachAround(city, p.x, p.z, 8, lms);
    if (surfaceAt(p.x, p.z) !== 'road') return null;
    for (let cz = Math.floor((p.z - 8) / 128); cz <= Math.floor((p.z + 8) / 128); cz++) for (let cx = Math.floor((p.x - 8) / 128); cx <= Math.floor((p.x + 8) / 128); cx++) {
      const k = `${cx}_${cz}`;
      if (!chunks.has(k)) chunks.set(k, await sf.chunk(cx, cz));
      const rd = chunks.get(k)?.roads;
      for (let i = 0; rd && i < rd.count; i++) {
        if (!DRIVEN.has(ROAD_CLASSES[rd.cls[i]])) continue;
        const w = rd.width[i], asphalt = w >= 3 ? w / 2 - CURB_BAND : w / 2;
        for (let q = rd.pStart[i]; q + 1 < rd.pStart[i + 1]; q++) {
          const d = segDist(p.x, p.z, rd.xyz[q * 3], rd.xyz[q * 3 + 2], rd.xyz[q * 3 + 3], rd.xyz[q * 3 + 5]);
          if (d <= asphalt) return `${ROAD_CLASSES[rd.cls[i]]} street, ${d.toFixed(2)} u from its centre line (asphalt ${asphalt.toFixed(1)})`;
        }
      }
    }
    return null;
  };
  // Balmy Alley is the site's own alley (its murals are on the garage doors either side: the crowd stands in it); Holy
  // Virgin left the list in W5-L1 (lane V's swap test allows the frontage beside the doors since 5a5523b)
  const OPEN = new Set(['balmy-alley']);
  // the Dragon Gate's arrival is on Grant Ave's 0.6 u east sidewalk (the only spot that frames the gate up the street): its
  // fly-in landing snaps 0.4 u onto the kerb lane (actors/nav arrivalSpot keeps the nearest 0.75 u cell centre, not p;
  // lane L's Request to the nav's owner). Any other card landing on the asphalt fails.
  const LANDING_OPEN = new Set(['dragon-gate']);
  const spots = landmarkPlazaSpots(), bad: string[] = [];
  try {
    for (const l of SF_SITES) {
      if (OPEN.has(l.id)) continue;
      const a = sfLandmarkAnchor(l.id);
      if (a) {
        const t = await inTraffic(a);
        if (t) bad.push(`${l.id} arrival: ${t}`);
        if (!canStand(a.x, a.z, 0.4)) bad.push(`${l.id} arrival (${a.x.toFixed(2)}, ${a.z.toFixed(2)}) is not standable`);
        // a card's landing (fast travel, ?at=, the trip's fly leg: game/fastTravel arrivalSpot → actors/nav, the nearest
        // 0.75 u nav cell of a large open area) must not snap onto the asphalt either: a 0.6 u sidewalk often has no cell
        if (card.has(l.id) && !LANDING_OPEN.has(l.id)) {
          const s = arrivalSpot(a, 30), t = s ? await inTraffic(s) : 'no landing';
          if (t) bad.push(`${l.id} landing${s ? ` (${s.x.toFixed(2)}, ${s.z.toFixed(2)})` : ''}: ${t}`);
        }
      }
      for (const p of spots.filter(s => s.id === l.id)) { const t = await inTraffic(p); if (t) bad.push(`${l.id} crowd spot (${p.x.toFixed(2)}, ${p.z.toFixed(2)}): ${t}`); }
    }
  } finally { setCityTerrain(null); }
  assert.deepEqual(bad, []);
});
