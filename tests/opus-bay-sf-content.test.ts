import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { Bilingual } from '../src/opus-bay/core/types';

// Lane G2, wave 2, part a-content: mode-resolved content (G2-0, CS-9), the 24 SF landmark cards (G2-1), the 12 SF
// postcards (G2-2), active-mode postcard counts (G2-3), city goals (G2-5) and the city onboarding copy (G2-8).

// --- headless canvas stub (world modules create label atlases at import time; same as the contracts test) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { CONTENT_MODE, byMode } = await import('../src/opus-bay/data/contentMode');
const pois = await import('../src/opus-bay/data/pois');
const postcards = await import('../src/opus-bay/data/postcards');
const script = await import('../src/opus-bay/data/script');
const { CITY_POIS, CITY_PHOTOS, CITY_POI_ZONES, SF_GUIDE_SLUG, ZH_GLOSSARY, cityPoiId, isMonthTagged } = await import('../src/opus-bay/data/sf/cityPois');
const { CITY_POSTCARDS, CITY_POSTCARD_NEAR } = await import('../src/opus-bay/data/sf/postcards');
const { CITY_FREE_GOALS, CITY_GOAL, HOOD_PREFIX, NEIGHBOURHOOD_TARGET, goalProgress } = await import('../src/opus-bay/data/sf/goals');
const { CITY_COPY, GRAND_TOUR: CITY_GRAND } = await import('../src/opus-bay/data/sf/copy');
const { SF_LANDMARK_INFO } = await import('../src/opus-bay/data/sf/landmarks');
const { SF_POSTCARD_ART_IDS } = await import('../src/opus-bay/data/assets');
const { SF_LANDMARKS, sfLandmark } = await import('../src/opus-bay/world/sf/landmarks/index');
const { sfLandmarkAnchor } = await import('../src/opus-bay/world/sf/landmarks/context');
const { contentFor, goalTargets } = await import('../src/opus-bay/game/cityContent');
// (wave 4: the detectors moved to game/cityDetectors.ts, lazy; the waypoints stay in game/cityGoals.ts)
const cityGoals = { ...(await import('../src/opus-bay/game/cityGoals')), ...(await import('../src/opus-bay/game/cityDetectors')) };
const { goalKeyOf } = await import('../src/opus-bay/game/flow');
const { DISTRICT } = await import('../src/opus-bay/data/district');

const root = path.resolve(import.meta.dirname, '..');
const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const PLACE_IDS = new Set((readJson('public/planner-catalog.json') as { places: { id: string }[] }).places.map(p => p.id));
const GUIDE_SLUGS = new Set((readJson('public/baybay-guides.json') as { slug: string }[]).map(g => g.slug));
const PHOTO_ASSETS = readJson('src/data/sf-landmark-photo-assets.json') as { id: string; srcSet?: string; creditUrl?: string }[];
const bubbleWidth = (text: string) => [...text].reduce((sum, ch) => sum + (ch === ' ' ? 0 : ch.charCodeAt(0) < 128 ? 0.5 : 1), 0);
const filled = (text: Bilingual | undefined, where: string) => {
  assert.ok(text && text.zh.trim() && text.en.trim(), `${where}: bilingual text`);
  assert.ok(/[一-鿿]/.test(text.zh), `${where}: zh has Chinese`);
  assert.ok(!/[一-鿿]/.test(text.en), `${where}: en has no Chinese`);
};
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
/** every zh string in a value (deep) */
const zhStrings = (value: unknown, out: string[] = []): string[] => {
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (typeof v.zh === 'string') out.push(v.zh);
    for (const item of Object.values(v)) zhStrings(item, out);
  }
  return out;
};

// ---------------------------------------------------------------------------
// G2-0 · mode resolution (CS-9)
// ---------------------------------------------------------------------------

test('G2-0: node runs in district mode and every resolved export is the district (v1) value', () => {
  assert.equal(CONTENT_MODE, 'district');
  assert.equal(byMode('d', 'c'), 'd');
  assert.equal(byMode('d', 'c', 'city'), 'c');
  assert.equal(pois.POIS, pois.DISTRICT_POIS);
  assert.equal(pois.POI_OFFICIAL_URLS, pois.DISTRICT_POI_OFFICIAL_URLS);
  assert.equal(pois.POI_EXTRA_SOURCES, pois.DISTRICT_POI_EXTRA_SOURCES);
  assert.equal(pois.PHOTO_SOURCE_PAGES, pois.DISTRICT_PHOTO_SOURCE_PAGES);
  assert.equal(pois.SUBJECT_FACTS, pois.DISTRICT_SUBJECT_FACTS);
  assert.equal(postcards.POSTCARDS, postcards.DISTRICT_POSTCARDS);
  assert.equal(postcards.POSTCARD_FOR_POI, postcards.DISTRICT_POSTCARD_FOR_POI);
  assert.equal(script.FREE_GOALS, script.DISTRICT_FREE_GOALS);
  assert.equal(script.GUIDE_BARKS, script.DISTRICT_GUIDE_BARKS);
  assert.equal(script.SCRIPT_HOOKS, script.DISTRICT_SCRIPT_HOOKS);
  assert.equal(script.START_NODE, 'intro.hello');
  const d = contentFor('district');
  assert.equal(d.pois, pois.DISTRICT_POIS);
  assert.equal(d.postcards, postcards.DISTRICT_POSTCARDS);
  assert.deepEqual(d.freeGoals.map(goal => goal.id), ['postcards', 'streetcar', 'viewpoint', 'sea-lions', 'taste']);
  assert.equal(d.startNode, 'intro.hello');
  assert.equal(pois.DISTRICT_POIS.some(poi => poi.id.startsWith('sf:')), false, 'no city entry merges into district mode');
  assert.deepEqual(goalTargets(), [], 'no city goal targets in district mode');
});

test('G2-0: city mode = district waterfront + city content; no waterfront-only barks (CS-9)', () => {
  const c = contentFor('city');
  assert.equal(c.pois.length, pois.DISTRICT_POIS.length + 24);
  // wave 4 (lane C, W4-C9, on purpose): lane V's four postcards for the new areas (8 + 16 = 24)
  assert.equal(c.postcards.length, 24);
  assert.equal(new Set(c.postcards.map(card => card.id)).size, 24);
  // wave 4 (lane C, W4-C8, on purpose): the sightseeing bus, the Metro and the campuses join the seven (7 → 10)
  assert.deepEqual(c.freeGoals.map(goal => goal.id), ['postcards', 'cable-car', 'twin-peaks', 'golden-gate', 'painted-ladies', 'neighbourhoods', 'viewpoint', 'sightseeing', 'metro', 'campuses']);
  assert.equal(c.startNode, 'intro.hello.city');
  for (const kind of ['idle', 'day', 'night', 'edge']) {
    for (const line of c.guideBarks[kind]) assert.ok(!/海狮|码头|sea lion|pier/i.test(line.zh + line.en), `city ${kind} bark stays off the waterfront: ${line.zh}`);
  }
  for (const [kind, lines] of Object.entries(c.guideBarks)) lines.forEach(line => { filled(line, `city bark ${kind}`); assert.ok(bubbleWidth(line.zh) <= 45); });
  const hookIds = Object.values(c.scriptHooks).flatMap(value => (typeof value === 'string' ? [value] : Object.values(value)));
  for (const id of hookIds) assert.ok(script.NODES[id], `city hook ${id} exists`);
});

// ---------------------------------------------------------------------------
// G2-1 · the 24 landmark cards
// ---------------------------------------------------------------------------

test('G2-1: 24 landmark cards with verified info, live BAYLINK ids only, no stale guides', () => {
  assert.equal(CITY_POIS.length, 24);
  assert.deepEqual(CITY_POIS.map(poi => poi.id).sort(), SF_LANDMARKS.map(l => cityPoiId(l.id)).sort(), 'one card per registry landmark');
  const ids = new Set(pois.DISTRICT_POIS.map(poi => poi.id));
  for (const poi of CITY_POIS) {
    const lm = poi.id.slice(3);
    assert.ok(poi.id.startsWith('sf:') && sfLandmark(lm), `${poi.id}: an SF landmark`);
    assert.ok(!ids.has(poi.id), `${poi.id}: unique`); ids.add(poi.id);
    filled(poi.name, poi.id); filled(poi.bark, `${poi.id} bark`); filled(CITY_POI_ZONES[poi.id], `${poi.id} zone`);
    assert.equal(poi.interaction.kind, 'info', `${poi.id}: an info card, never the Coit viewpoint sweep`);
    assert.equal(poi.radius, 4);
    const at = sfLandmarkAnchor(lm)!;
    assert.ok(dist(poi.position, at) < 0.01, `${poi.id}: at D2's arrival spot`);
    const info = poi.realInfo!;
    assert.match(info.sourceUrl, /^https:\/\//);
    assert.match(info.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    filled(info.summary, `${poi.id} summary`);
    info.tips.forEach((tip, i) => filled(tip, `${poi.id} tip ${i}`));
    if (poi.plannerPlaceId) assert.ok(PLACE_IDS.has(poi.plannerPlaceId), `${poi.id}: planner place ${poi.plannerPlaceId} exists`);
    if (poi.guideSlug) {
      assert.ok(GUIDE_SLUGS.has(poi.guideSlug), `${poi.id}: guide ${poi.guideSlug} exists`);
      assert.ok(!isMonthTagged(poi.guideSlug), `${poi.id}: no month-tagged guide`);
    }
  }
  assert.equal(CITY_POIS.find(poi => poi.id === 'sf:cable-car-turntable')!.guideSlug, SF_GUIDE_SLUG, 'the October Muni guide falls back to the SF guide');
  assert.equal(CITY_POIS.find(poi => poi.id === 'sf:ghirardelli-square')!.plannerPlaceId, undefined, 'Ghirardelli is not PIER 39');
  assert.ok(isMonthTagged('bay-area-october-muni-clipper-payment-update-2026') && !isMonthTagged('san-francisco-guide'));
});

test('G2-1: reused photos are the site\'s licensed files and show the landmark; zh follows the HUD glossary', () => {
  for (const [id, photo] of Object.entries(CITY_PHOTOS)) {
    assert.ok(fs.existsSync(path.join(root, 'public', photo.src)), `${id}: ${photo.src} on disk`);
    const asset = PHOTO_ASSETS.find(a => a.srcSet?.includes(photo.src));
    assert.ok(asset, `${id}: photo is listed in src/data/sf-landmark-photo-assets.json`);
    assert.equal(asset.creditUrl, photo.page, `${id}: credit page`);
    assert.ok(photo.license && photo.licenseUrl?.startsWith('https://creativecommons.org/'));
    assert.equal(CITY_POIS.find(poi => poi.id === cityPoiId(id))!.realInfo!.photo!.src, photo.src);
  }
  const zh = [CITY_POIS, CITY_POI_ZONES, CITY_POSTCARDS, CITY_FREE_GOALS].map(v => zhStrings(v).join('\n')).join('\n');
  for (const [from] of ZH_GLOSSARY) assert.ok(!zh.includes(from), `city zh text uses the glossary instead of ${from}`);
  assert.ok(zh.includes('双峰') && zh.includes('叮当车') && zh.includes('唐人街') && zh.includes('要塞公园'));
});

test('G2-1 / CS-8: the glossary names match the neighbourhood labels in far.zones', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const far = await sfDisk().far();
  const names = new Set(far.zones.map(zone => zone.zh));
  for (const name of ['双峰', '马里纳区', '要塞公园', '唐人街', '卡斯特罗', '教会区', '日本城']) assert.ok(names.has(name), `${name} is a HUD label`);
  for (const [from, to] of ZH_GLOSSARY) if (names.has(to)) assert.ok(!names.has(from), `${from} is not a HUD label`);
});

// ---------------------------------------------------------------------------
// G2-2 · the 12 SF postcards
// ---------------------------------------------------------------------------

test('G2-2: 16 city postcards (wave 4: + lane V’s four) with art on disk, a verified fact and a short hint', async () => {
  const { W4_POSTCARD_IDS, W4_POSTCARDS } = await import('../src/opus-bay/data/sf/w4Postcards');
  const { ATTRACTIONS } = await import('../src/opus-bay/data/sf/attractions');
  const { loadPlaceCards, cardPoiId } = await import('../src/opus-bay/data/sf/placeCardTypes');
  const cards = await loadPlaceCards();
  assert.deepEqual(CITY_POSTCARDS.map(card => card.id), [...SF_POSTCARD_ART_IDS, ...W4_POSTCARD_IDS]);
  // the wave-4 four were checked on the web on W4_POSTCARDS_VERIFIED_AT (data/sf/w4Postcards.ts, lane V): their sources count
  const verified = new Set([...SF_LANDMARK_INFO.flatMap(info => [info.realInfo.sourceUrl, ...info.sources]), ...Object.values(W4_POSTCARDS).map(c => c.sourceUrl)]);
  for (const card of CITY_POSTCARDS) {
    for (const size of [600, 1200]) assert.ok(fs.existsSync(path.join(root, `public/opus-bay/postcards/${card.id}-${size}.webp`)), `${card.id}-${size}.webp`);
    assert.equal(card.image, `/opus-bay/postcards/${card.id}-600.webp`);
    filled(card.title, card.id); filled(card.fact, `${card.id} fact`); filled(card.hint, `${card.id} hint`);
    assert.ok(bubbleWidth(card.hint.zh) <= 45, `${card.id}: hint ≤ 45 (${bubbleWidth(card.hint.zh)})`);
    assert.ok(verified.has(card.sourceUrl!), `${card.id}: fact source ${card.sourceUrl} is one of D2's verified landmark sources`);
    const near = CITY_POSTCARD_NEAR[card.id];
    const w4 = (W4_POSTCARD_IDS as readonly string[]).includes(card.id) ? W4_POSTCARDS[card.id as keyof typeof W4_POSTCARDS] : null;
    // the card that shows the art: a landmark card, or (wave 4) a place card whose POI is sf:<near>
    assert.ok(sfLandmark(near) || cards.cards.some(pc => cardPoiId(pc) === cityPoiId(near)), `${card.id}: near a real card (${near})`);
    // near its landmark's arrival spot (the four: their attraction's arrival); the beach, the mural alley, the park and
    // Nob Hill are subjects of their own (their landmark is only the card that shows the art)
    const limit = ['sf-ocean-beach', 'sf-mission-murals', 'sf-dolores-park', 'sf-cable-car-hill'].includes(card.id) ? 400 : 70;
    const a = w4 ? ATTRACTIONS.find(x => x.id === w4.attraction) : undefined;
    const anchor = w4 ? (a?.arrival ?? a)! : sfLandmarkAnchor(near)!;
    assert.ok(dist(card.position, anchor) < limit, `${card.id}: within ${limit} u of ${near}`);
    for (const poi of CITY_POIS) assert.ok(dist(card.position, poi.position) >= 6.5, `${card.id}: ≥ 6.5 u from ${poi.id} (no competing prompts)`);
    for (const other of CITY_POSTCARDS) if (other !== card) assert.ok(dist(card.position, other.position) > 20, `${card.id} vs ${other.id}`);
  }
  // the card art strip on a landmark card without a photo
  assert.equal(contentFor('city').postcards.filter(card => card.id.startsWith('sf-')).length, 16);
});

test('G2-2: every city postcard spot stands in the published city and joins the walking network of ferry-gate', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { canStand, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_LANDMARKS);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  for (const card of CITY_POSTCARDS) await sf.attachAround(city, card.position.x, card.position.z, 20, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    const ix = await sf.graphIndex();
    const ferry = DISTRICT.anchors['ferry-gate'];
    const home = ix.component(ix.nearestNode(ferry.x, ferry.z, 60));
    for (const card of CITY_POSTCARDS) {
      assert.ok(canStand(card.position.x, card.position.z), `${card.id}: standable`);
      const n = ix.nearestNode(card.position.x, card.position.z, 12);
      assert.ok(n >= 0, `${card.id}: a walking-graph node within 12 u`);
      assert.equal(ix.component(n), home, `${card.id}: reachable from ferry-gate`);
    }
    for (const poi of CITY_POIS) {
      const n = ix.nearestNode(poi.position.x, poi.position.z, 30);
      assert.ok(n >= 0 && ix.component(n) === home, `${poi.id}: card spot reachable from ferry-gate`);
    }
  } finally { setCityTerrain(null); }
});

// ---------------------------------------------------------------------------
// G2-3 · active-mode postcard counts
// ---------------------------------------------------------------------------

test('G2-3: counts only the active world\'s cards (district here)', () => {
  const mixed = ['sea-lions', 'sf-painted-ladies', 'coit-tower', 'sf-windmill', 'nope'];
  assert.equal(postcards.activePostcardCount(mixed), 2);
  assert.equal(postcards.activePostcardTotal(), 8);
  assert.equal(postcards.allPostcardsFound([...postcards.POSTCARD_IDS, 'sf-city-hall']), true);
  assert.equal(postcards.allPostcardsFound(SF_POSTCARD_ART_IDS), false);
  assert.equal(postcards.CITY_POSTCARD_FOR_POI['sf:dutch-windmill'], 'sf-windmill');
});

// ---------------------------------------------------------------------------
// G2-5 · city goals
// ---------------------------------------------------------------------------

test('G2-5: goal ids — only the three shared keys map to a GoalKey', () => {
  assert.equal(goalKeyOf(CITY_GOAL.postcards), 'postcards');
  assert.equal(goalKeyOf(CITY_GOAL.cableCar), 'cable-car');
  assert.equal(goalKeyOf(CITY_GOAL.viewpoint), 'viewpoint');
  for (const id of [CITY_GOAL.twinPeaks, CITY_GOAL.goldenGate, CITY_GOAL.paintedLadies, CITY_GOAL.neighbourhoods, CITY_GOAL.sightseeing, CITY_GOAL.metro, CITY_GOAL.campuses]) assert.equal(goalKeyOf(id), null, `${id}: no other key completes it`);
  CITY_FREE_GOALS.forEach(goal => { filled(goal.label, goal.id); filled(goal.hint, goal.id); });
  assert.ok(CITY_FREE_GOALS[0].label.zh.includes('24'));
});

test('G2-5: Twin Peaks counts only when climbed on your own (fast travel and the pelican disarm it)', () => {
  const summit = { x: 0, z: 0, y: 46 };
  const s = (x: number, y: number, mode: 'foot' | 'glide' | 'bike' = 'foot', epoch = 0, travelling = false) => ({ x, z: 0, y, mode, epoch, travelling });
  let d = cityGoals.createSummitDetector(summit);
  assert.equal(d.step(s(5, 47)), false, 'spawned on the summit: not armed');
  assert.equal(d.step(s(200, 10)), false); assert.ok(d.armed);
  assert.equal(d.step(s(60, 30, 'bike')), false);
  assert.equal(d.step(s(5, 47, 'bike')), true, 'rode up from the city');
  d = cityGoals.createSummitDetector(summit);
  d.step(s(200, 10));
  assert.equal(d.step(s(5, 47, 'foot', 1)), false, 'a fast travel (new epoch) disarms');
  d.step(s(200, 10, 'foot', 1)); d.step(s(100, 60, 'glide', 1));
  assert.equal(d.step(s(5, 47, 'foot', 1)), false, 'gliding in disarms');
  d.step(s(200, 10, 'foot', 1));
  assert.equal(d.step(s(5, 30, 'foot', 1)), false, 'below the overlook');
  assert.equal(d.step(s(5, 47, 'foot', 1)), true);
});

test('G2-5: Golden Gate crossing tower to tower on the deck', () => {
  const on = { y: 15.2, mode: 'foot' as const, epoch: 0, travelling: false };
  let d = cityGoals.createDeckCrossing();
  assert.equal(d.step({ x: -120, z: 0 }, on), false);
  assert.equal(d.step({ x: 0, z: 1 }, on), false);
  assert.equal(d.step({ x: 95, z: -1 }, on), true, 'south tower → north tower');
  d = cityGoals.createDeckCrossing();
  d.step({ x: 100, z: 0 }, on);
  assert.equal(d.step({ x: -95, z: 0 }, on), true, 'either direction');
  d = cityGoals.createDeckCrossing();
  d.step({ x: -95, z: 0 }, on);
  d.step({ x: 0, z: 0 }, { ...on, y: 2 });
  assert.equal(d.step({ x: 95, z: 0 }, on), false, 'leaving the deck resets');
  d.step({ x: -95, z: 0 }, on);
  assert.equal(d.step({ x: 95, z: 0 }, { ...on, epoch: 1 }), false, 'fast travel resets');
  d.step({ x: -95, z: 0 }, on);
  assert.equal(d.step({ x: 95, z: 0 }, { ...on, mode: 'glide' as never }), false, 'gliding over does not count');
});

test('G2-5: 8 of 41 neighbourhoods, hero zones not counted; progress text', () => {
  assert.equal(cityGoals.isNeighbourhoodId('mission'), true);
  assert.equal(cityGoals.isNeighbourhoodId('pier39'), false, 'a hero zone');
  assert.equal(cityGoals.isNeighbourhoodId(null), false);
  let done: string[] = [];
  const hoods = ['mission', 'castro-upper-market', 'chinatown', 'marina', 'presidio', 'twin-peaks', 'nob-hill', 'north-beach'];
  hoods.forEach((id, i) => {
    const ids = cityGoals.neighbourhoodVisit(done, id);
    assert.deepEqual(ids, i === hoods.length - 1 ? [`${HOOD_PREFIX}${id}`, CITY_GOAL.neighbourhoods] : [`${HOOD_PREFIX}${id}`]);
    done = [...done, ...ids];
    if (i === 2) assert.equal(goalProgress(CITY_GOAL.neighbourhoods, done), `3/${NEIGHBOURHOOD_TARGET}`);
  });
  assert.deepEqual(cityGoals.neighbourhoodVisit(done, 'mission'), [], 'a revisit adds nothing');
  assert.equal(goalProgress(CITY_GOAL.neighbourhoods, done), null, 'done: no progress text');
  assert.equal(goalProgress(CITY_GOAL.twinPeaks, done), null);
});

test('G2-5: goal waypoints resolve to landmark cards', () => {
  const targets = cityGoals.cityGoalTargets();
  assert.deepEqual(targets.map(t => t.goal), [CITY_GOAL.cableCar, CITY_GOAL.twinPeaks, CITY_GOAL.goldenGate, CITY_GOAL.paintedLadies]);
  for (const t of targets) {
    const poi = CITY_POIS.find(p => p.id === t.id);
    assert.ok(poi, `${t.id} is a city card (interactableById resolves it in city mode)`);
    assert.ok(dist(poi.position, t) < 1e-9);
    filled(t.name, t.id);
  }
});

// ---------------------------------------------------------------------------
// G2-8 · city onboarding copy
// ---------------------------------------------------------------------------

test('G2-8: city welcome mirrors the district choices; subs, goals line and edge line', () => {
  const d = script.NODES[script.DISTRICT_START_NODE], c = script.NODES[script.CITY_START_NODE];
  assert.equal(c.id, 'intro.hello.city');
  // wave 4 (lane C, W4-C7, on purpose): choice 1 starts the Grand Tour (the district's first lesson stays in the call menu)
  assert.deepEqual(c.choices?.map(ch => ch.action), [{ type: 'start-tour', tourId: 'sf-grand' }, ...(d.choices ?? []).slice(1).map(ch => ch.action)], 'the same four choices; the tour is the Grand Tour');
  assert.deepEqual(c.choices?.map(ch => ch.next), [undefined, 'week.intro', 'free.intro.city', 'local.intro']);
  assert.deepEqual(script.CHOICE_SUBS['intro.hello.city:1'], CITY_GRAND.subtitle, 'the welcome sub is the Grand Tour subtitle');
  for (const k of [1, 2, 3, 4]) filled(script.CHOICE_SUBS[`intro.hello.city:${k}`], `sub ${k}`);
  assert.equal(script.CHOICE_SUBS['intro.hello.city:3'].zh, '全城 24 张明信片 · 叮当车 · 双峰');
  assert.equal(script.NODES['free.intro.city'].next, 'free.goals.city');
  assert.ok(script.NODES['guide.edge.city']);
  assert.equal(script.CITY_SCRIPT_HOOKS.edge, 'guide.edge.city');
  filled(CITY_COPY.titleSub!, 'title sub');
  assert.ok(CITY_COPY.titleSub!.zh.includes('双峰') && CITY_COPY.titleSub!.zh.includes('叮当车'));
  const src = fs.readFileSync(path.join(root, 'src/opus-bay/data/sf/copy.ts'), 'utf8');
  for (const line of src.split('\n').filter(l => /^import /.test(l))) assert.match(line, /^import type /, 'copy.ts stays dependency-free (title chunk)');
});

// ---------------------------------------------------------------------------
// Wave 3 · the city hooks (call menu, card counts) and lane F's transit hooks
// ---------------------------------------------------------------------------

test('G2 w3: city hooks resolve; the city call menu / tour-after lead to the city goals; cards say 24 (wave 4)', async () => {
  const { fillText } = await import('../src/opus-bay/game/content');
  for (const [name, id] of Object.entries(script.CITY_SCRIPT_HOOKS)) {
    if (typeof id !== 'string') continue;
    assert.ok(script.NODES[id], `hook ${name} → node ${id}`);
  }
  const roam = (id: string) => script.NODES[id].choices?.find(ch => ch.action?.type === 'free-roam')?.next;
  assert.equal(roam('call.menu.city'), 'free.goals.city');
  assert.equal(roam('tour.after.city'), 'free.goals.city');
  assert.equal(roam('call.menu'), 'free.goals', 'district unchanged');
  assert.ok(script.NODES[script.CITY_SCRIPT_HOOKS.postcardFirst].text.zh.includes('24'));
  assert.ok(script.NODES[script.CITY_SCRIPT_HOOKS.postcardAll].text.zh.startsWith('24 张'));
  assert.equal(script.NODES[script.CITY_SCRIPT_HOOKS.postcardAll].next, 'handoff.plan');
  // lane F's hooks: 叮当车 in every cable-car line, `{station}` in the station greetings, crews are fictional names
  for (const id of Object.values(script.CITY_TRANSIT_HOOKS)) {
    const n = script.NODES[id];
    filled(n.text, id);
    assert.ok(!n.text.zh.includes('缆车'), `${id}: 叮当车, not 缆车`);
    assert.ok(bubbleWidth(n.text.zh) <= 45, `${id}: ≤ 45`);
  }
  for (const id of [script.CITY_TRANSIT_HOOKS.cablecarStation, script.CITY_TRANSIT_HOOKS.ferryStation]) {
    const t = fillText(script.NODES[id].text, { station: { zh: '海德街', en: 'Hyde St' } });
    assert.ok(t.zh.includes('海德街') && t.en.includes('Hyde St') && !/[{}]/.test(t.zh + t.en), `${id}: {station} filled`);
  }
  assert.deepEqual(script.CITY_NPC_LINES.map(l => l.key), ['gripman', 'deckhand']);
  for (const l of script.CITY_NPC_LINES) assert.ok(script.NODES[l.nodeId] && script.NODES[`${l.nodeId}.2`], `${l.key} has lines`);
  assert.deepEqual(script.NPC_LINES.map(l => l.key), script.DISTRICT_NPC_LINES.map(l => l.key), 'node tests resolve district: residents unchanged');
});

test('G1 request 3: sf:<placeId> resolves to the landmark card, the merged POI card or a place card', async () => {
  const { buildPlaceIndex, landmarkInputsFrom, poiInputs } = await import('../src/opus-bay/data/sf/places');
  const { sfLandmarkInfo } = await import('../src/opus-bay/data/sf/landmarks');
  const { PLACE_KIND_NAMES, placeCardTarget, placeCardName } = await import('../src/opus-bay/data/sf/cityPois');
  const file = readJson('public/opus-bay/sf/v1/places.json');
  const ix = buildPlaceIndex(file, landmarkInputsFrom(SF_LANDMARKS, sfLandmarkInfo, sfLandmarkAnchor), poiInputs());
  const lookup = (id: string) => ix.get(id);
  const cityIds = new Set(CITY_POIS.map(p => p.id)), districtIds = new Set(pois.DISTRICT_POIS.map(p => p.id));
  let cards = 0, landmarks = 0, merged = 0;
  for (const p of ix.list) {
    const target = placeCardTarget(`sf:${p.id}`, lookup);
    assert.ok(target, `${p.id} resolves`);
    if ('poi' in target) {
      if (p.landmark) { landmarks++; assert.ok(cityIds.has(target.poi), `${p.id} → its landmark card ${target.poi}`); }
      else { merged++; assert.ok(districtIds.has(target.poi), `${p.id} → the district card ${target.poi}`); }
    } else {
      cards++;
      assert.ok(PLACE_KIND_NAMES[target.place.kind], `${p.id}: kind ${target.place.kind} has a name`);
      assert.match(target.place.sourceUrl, /^https:\/\//);
      const name = placeCardName(target.place.name);
      assert.ok(name.zh.trim() && name.en.trim(), `${p.id}: a title in both languages`);
    }
  }
  assert.equal(landmarks, 24, 'every landmark place opens its landmark card');
  assert.ok(merged >= 5 && cards > 900, `merged ${merged}, own cards ${cards}`);
  assert.equal(placeCardTarget('sf:no-such-place', lookup), null);
  assert.equal(placeCardTarget('ferry-building', lookup), null, 'not an sf: id');
  for (const kind of new Set(ix.list.map(p => p.kind))) assert.ok(PLACE_KIND_NAMES[kind], `kind ${kind} named`);
});

test('P7: data/sf/arrivals.ts is D2’s sfLandmarkAnchor, written out (the landmark library stays out of GameRoot)', async () => {
  const { LANDMARK_ARRIVALS } = await import('../src/opus-bay/data/sf/arrivals');
  const r = (v: number, k = 100) => Math.round(v * k) / k;
  const table = SF_LANDMARKS.map(l => { const a = sfLandmarkAnchor(l.id)!; return `  '${l.id}': { x: ${r(a.x)}, z: ${r(a.z)}, heading: ${r(a.heading, 1000)} },`; }).join('\n');
  const hint = `D2 moved a landmark or its arrival: paste this into data/sf/arrivals.ts\n${table}`;
  assert.deepEqual(Object.keys(LANDMARK_ARRIVALS).sort(), SF_LANDMARKS.map(l => l.id).sort(), hint);
  for (const l of SF_LANDMARKS) {
    const a = sfLandmarkAnchor(l.id)!, b = LANDMARK_ARRIVALS[l.id];
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.01 && Math.abs(a.heading - b.heading) < 0.001, `${l.id}\n${hint}`);
  }
});

test('P7: game/cityLive.ts (lazy) registers the SF landmark subjects and the goal detectors, and unregisters them', async () => {
  const { initCityLive } = await import('../src/opus-bay/game/cityLive');
  const { subjectPosition } = await import('../src/opus-bay/game/interactables');
  assert.equal(subjectPosition('golden-gate-bridge'), null, 'no SF subjects before city mode loads them');
  const off = initCityLive({ done: () => {}, heightAt: () => 5 });
  try {
    const p = subjectPosition('golden-gate-bridge')!, l = sfLandmark('golden-gate-bridge')!;
    assert.ok(p && Math.hypot(p.x - l.x, p.z - l.z) < 1e-6 && p.y > 2, 'the bridge resolves to a point up its model');
    assert.ok(subjectPosition('dragon-gate')!.y >= 5 + 2, 'terrain-based landmarks stand on the ground');
  } finally { off(); }
  assert.equal(subjectPosition('golden-gate-bridge'), null, 'disposed');
});
