import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// Wave 4 · lane C · W4-C5: the place cards of the 124 new attractions (data/sf/placeCards.ts full cards for priorities
// 1–3, placeCards2.ts short cards for priority 4) and the refreshes of the 10 built landmarks that become stops.
// Every card resolves an attraction id of docs/opus-bay/sf-w4-attractions.json, carries its sources and the date
// checked, keeps the zh length limits (bubble ≤ 45), is cautious about hours, states closures, and never mentions what
// the plan forbids (pandas, the old name of UC Law SF, the Rivera mural as on show).

const ROOT = new URL('..', import.meta.url);
const readJson = (rel: string) => JSON.parse(fs.readFileSync(new URL(rel, ROOT), 'utf8'));

const { PLACE_CARDS, CARD_REFRESHES } = await import('../src/opus-bay/data/sf/placeCards');
const { PLACE_CARDS_2, CURATED_CARDS } = await import('../src/opus-bay/data/sf/placeCards2');
const { ATTRACTIONS } = await import('../src/opus-bay/data/sf/attractions');
const types = await import('../src/opus-bay/data/sf/placeCardTypes');
const { placeCardProblems, zhWidth, cardPoiId, placeCardPoi, indexPlaceCards, loadPlaceCards, placeCardNow, placeCardsNow, CARD_LIMITS, CARD_VERIFIED_AT } = types;
const { ARRIVAL_LINES, QUIET_LINES } = await import('../src/opus-bay/data/sf/tourLines');
const { SF_LANDMARK_INFO } = await import('../src/opus-bay/data/sf/landmarks');

type Card = (typeof PLACE_CARDS)[number];
interface JsonAttraction { id: string; priority: 1 | 2 | 3 | 4; treatment: string; mapRank: 1 | 2 | 3; placeId: string | null; lat: number; lng: number; category: string; zh: string; en: string }

const ATTR: JsonAttraction[] = readJson('docs/opus-bay/sf-w4-attractions.json').attractions;
const NEW = ATTR.filter(a => a.treatment !== 'stop');
const STOPS = ATTR.filter(a => a.treatment === 'stop');
const CARDS: Card[] = [...PLACE_CARDS, ...PLACE_CARDS_2];
const byId = new Map(CARDS.map(c => [c.id, c]));
const allText = (c: Card) => [c.name, c.zone, c.bark, c.summary, ...c.tips, c.hours, c.cost, c.status?.text].filter(Boolean).map(b => `${b!.zh} ${b!.en}`).join(' ');

test('one card per new attraction (124), keyed by its attractions.json id; full for priorities 1–3, short for 4', () => {
  assert.equal(NEW.length, 124);
  assert.equal(CARDS.length, 124);
  assert.equal(byId.size, CARDS.length, 'card ids are unique');
  for (const a of NEW) {
    const card = byId.get(a.id);
    assert.ok(card, `${a.id} has a card`);
    assert.equal(card.depth, a.priority <= 3 ? 'full' : 'short', `${a.id} depth`);
  }
  for (const c of CARDS) assert.ok(NEW.some(a => a.id === c.id), `${c.id} resolves an attraction id`);
  // part 1 holds priorities 1–3 in the plan's build order (owner requests first), part 2 priority 4
  assert.equal(PLACE_CARDS.length, NEW.filter(a => a.priority <= 3).length);
  assert.equal(PLACE_CARDS[0].id, 'stonestown-galleria');
  assert.equal(PLACE_CARDS[1].id, 'sf-state-university');
  assert.ok(PLACE_CARDS_2.every(c => NEW.find(a => a.id === c.id)!.priority === 4));
});

test('every card passes placeCardProblems (texts, limits, sources, https, dates, coordinates, forbidden words)', () => {
  const problems = CARDS.flatMap(c => placeCardProblems(c));
  assert.deepEqual(problems, []);
  for (const c of CARDS) {
    assert.ok(zhWidth(c.bark.zh) <= 45, `${c.id} bark ≤ 45 (${c.bark.zh})`);
    assert.ok(zhWidth(c.summary.zh) <= CARD_LIMITS.summary, `${c.id} summary`);
    assert.equal(c.verifiedAt, CARD_VERIFIED_AT);
    assert.ok(c.sourceUrl.startsWith('https://'), `${c.id} sourceUrl`);
    if (c.depth === 'full') assert.ok(c.sources.length >= 1, `${c.id} has a secondary source`);
  }
  // the validator catches what it claims to
  const bad = { ...CARDS[0], bark: { zh: '熊猫'.repeat(30), en: 'x' }, sourceUrl: 'http://x', lat: 0 };
  const p = placeCardProblems(bad);
  assert.ok(p.some(s => s.includes('bark: zh')), 'bark length');
  assert.ok(p.some(s => s.includes('sourceUrl')), 'https');
  assert.ok(p.some(s => s.includes('lat / lng')), 'coordinates');
  assert.ok(p.some(s => s.includes('forbidden')), 'forbidden word');
});

test('cards stand where the attraction is and decorate the place row attractions.json names', () => {
  for (const c of CARDS) {
    const a = ATTR.find(x => x.id === c.id)!;
    // ≤ 0.001° ≈ 100 m from the scouted point
    assert.ok(Math.abs(c.lat - a.lat) < 0.001 && Math.abs(c.lng - a.lng) < 0.001, `${c.id} lat/lng near the scouted point`);
    if (a.placeId) assert.equal(c.place, a.placeId, `${c.id} decorates ${a.placeId}`);
    else assert.equal(c.place, undefined, `${c.id} is a new place row (id = attraction id)`);
    assert.equal(cardPoiId(c), c.sharesPlace ? `sf:${c.id}` : `sf:${a.placeId ?? a.id}`);
  }
});

test('a card never takes a place row another card owns at runtime (landmark / district POI rows keep theirs)', async () => {
  // W4-C review: japan-center decorated the Peace Pagoda landmark's row and the marketplace the Ferry Building's
  // district row; "cards first" would have replaced those cards and their sf:<place> POI ids collided
  const { buildPlaceIndex, landmarkInputsFrom, poiInputs } = await import('../src/opus-bay/data/sf/places');
  const { SF_LANDMARKS } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { sfLandmarkAnchor } = await import('../src/opus-bay/world/sf/landmarks/context');
  const { sfLandmarkInfo } = await import('../src/opus-bay/data/sf/landmarks');
  const ix = buildPlaceIndex(readJson('public/opus-bay/sf/v1/places.json'), landmarkInputsFrom(SF_LANDMARKS, sfLandmarkInfo, sfLandmarkAnchor), poiInputs());
  const set = indexPlaceCards([...CARDS, ...CURATED_CARDS], CARD_REFRESHES);
  for (const c of [...CARDS, ...CURATED_CARDS]) {
    if (!c.place) continue;
    const row = ix.get(c.place);
    if (!row) continue; // lane P's extraPlaces rows (no landmark, no POI)
    const owned = !!(row.landmark || row.poi);
    assert.equal(!!c.sharesPlace, owned, `${c.id} on ${c.place}: sharesPlace ${!!c.sharesPlace}, row owned by ${row.landmark ?? row.poi ?? 'nobody'}`);
    assert.equal(types.placeCardForPlace(set, row)?.id ?? null, owned ? null : c.id, `${c.place} opens the right card`);
  }
  assert.deepEqual([...CARDS, ...CURATED_CARDS].filter(c => c.sharesPlace).map(c => c.id).sort(), ['ferry-building-marketplace', 'japan-center']);
  assert.equal(set.byPlace.get('japantown-peace-pagoda'), undefined, 'the Peace Pagoda row keeps its landmark card');
  assert.equal(set.byPlace.get('ferry-building'), undefined, 'the Ferry Building row keeps its district card');
  // every card POI id resolves back to its card, and no two cards share one
  const poiIds = [...CARDS, ...CURATED_CARDS].map(c => cardPoiId(c));
  assert.equal(new Set(poiIds).size, poiIds.length, 'card POI ids are unique');
  for (const c of [...CARDS, ...CURATED_CARDS]) assert.equal(types.placeCardByPoiId(set, cardPoiId(c))?.id, c.id);
  assert.equal(types.placeCardByPoiId(set, 'sf:japantown-peace-pagoda'), null);
  assert.equal(types.placeCardByPoiId(set, 'ferry-building'), null);
});

test('zh street names follow the Chinatown table: 企李街 is Clay St (never Clement St, 克莱门街)', () => {
  for (const c of [...CARDS, ...CURATED_CARDS]) {
    for (const b of [c.name, c.zone, c.bark, c.summary, ...c.tips]) if (b.zh.includes('企李街')) assert.match(b.en, /Clay St/, `${c.id}: 企李街 = Clay St (${b.zh})`);
  }
  assert.match(byId.get('clement-street')!.name.zh, /^克莱门街/);
});

test('the card loader is retried after a failed chunk load (a stale hash or a flaky phone network)', async () => {
  let calls = 0;
  const set = indexPlaceCards(CARDS.slice(0, 2));
  const loader = types.createCardLoader(async () => { calls++; if (calls === 1) throw new Error('chunk failed'); return set; });
  await assert.rejects(loader.load(), /chunk failed/);
  assert.equal(loader.now(), null);
  assert.equal(await loader.load(), set, 'the second call loads');
  assert.equal(await loader.load(), set);
  assert.equal(calls, 2, 'loaded once after the retry');
  assert.equal(loader.now(), set);
});

test('BAYLINK links and photos only where they exist (guides, planner places, licensed photos)', () => {
  const guides = readJson('public/baybay-guides.json');
  const guideSlugs = new Set<string>((Array.isArray(guides) ? guides : guides.guides).map((g: { slug: string }) => g.slug));
  const plannerIds = new Set<string>(readJson('public/planner-catalog.json').places.map((p: { id: string }) => p.id));
  const photos = new Set<string>(readJson('src/data/sf-landmark-photo-assets.json').map((p: { id: string }) => p.id));
  for (const c of CARDS) {
    if (c.guideSlug) {
      assert.ok(guideSlugs.has(c.guideSlug), `${c.id} guide ${c.guideSlug} exists`);
      assert.ok(!/(january|february|march|april|may|june|july|august|september|october|november|december)|-20\d\d(-|$)/i.test(c.guideSlug), `${c.id} guide is not month-tagged`);
    }
    if (c.plannerPlaceId) assert.ok(plannerIds.has(c.plannerPlaceId), `${c.id} planner ${c.plannerPlaceId} exists`);
    if (c.photoKey) assert.ok(photos.has(c.photoKey), `${c.id} photo ${c.photoKey} is licensed`);
  }
  // the four campus / mall photos the plan names are used
  for (const [id, key] of [['sf-state-university', 'sf-state'], ['stonestown-galleria', 'stonestown'], ['ucsf-parnassus', 'ucsf-parnassus'], ['ucsf-mission-bay', 'ucsf-mission-bay']]) assert.equal(byId.get(id)!.photoKey, key);
});

test('cautious hours, stated closures, quiet places, and the plan\'s never-say list', () => {
  for (const c of CARDS) {
    if (c.hours) assert.match(c.hours.zh, /约|官网|确认|现场/, `${c.id} hours are hedged (${c.hours.zh})`);
    if (c.cost && /\d/.test(c.cost.zh)) assert.match(c.cost.zh, /约|官网|现场|确认/, `${c.id} a price is hedged (${c.cost.zh})`);
    const text = allText(c);
    assert.ok(!/panda|熊猫/i.test(text), `${c.id}: no pandas`);
    assert.ok(!/Hastings|黑斯廷斯/i.test(text), `${c.id}: never the old UC Law name`);
    if (/Rivera|里维拉/.test(text)) assert.match(text, /仓库|storage/i, `${c.id}: the Rivera mural is never "on show"`);
  }
  const status = (id: string) => byId.get(id)!.status?.kind;
  assert.equal(status('hyde-street-pier'), 'closed');
  assert.equal(status('portsmouth-square'), 'closed');
  assert.equal(status('ccsf-ocean-campus'), 'works');
  assert.equal(status('california-college-of-the-arts'), 'changing');
  assert.equal(status('sunset-dunes'), 'changing');
  assert.equal(status('harvey-milk-plaza'), 'works');
  assert.equal(status('moad'), 'changing');
  // memorials and places of worship speak softly
  for (const a of NEW.filter(x => x.category === 'religious')) assert.equal(byId.get(a.id)!.quiet, true, `${a.id} is quiet`);
  for (const id of ['national-aids-memorial-grove', 'mount-davidson']) assert.equal(byId.get(id)!.quiet, true, `${id} is quiet`);
  // brands and artworks only in text: the Yoda card is text-only, the Stonestown card names no stores
  assert.ok(!/Target|Whole Foods|Regal|Macy|Nordstrom/.test(allText(byId.get('stonestown-galleria')!)));
});

test('the 10 built landmarks that become stops get refreshes (status / hours / tips) with sources', () => {
  assert.deepEqual(Object.keys(CARD_REFRESHES).sort(), STOPS.map(a => a.id).sort());
  const landmarkIds = new Set(SF_LANDMARK_INFO.map(l => l.id));
  for (const [id, r] of Object.entries(CARD_REFRESHES)) {
    assert.ok(landmarkIds.has(id), `${id} is an SF_LANDMARK_INFO id`);
    assert.ok(r.sources.length >= 1 && r.sources.every(s => /^https?:\/\//.test(s)), `${id} sources`);
    assert.equal(r.verifiedAt, CARD_VERIFIED_AT);
    for (const b of [r.status?.text, r.hours, r.cost, ...(r.addTips ?? [])].filter(Boolean)) {
      assert.ok(zhWidth(b!.zh) <= CARD_LIMITS.hours && b!.en.length <= 180, `${id}: ${b!.zh}`);
    }
  }
  assert.equal(CARD_REFRESHES['cliff-house'].status?.kind, 'closed');
  assert.equal(CARD_REFRESHES['twin-peaks'].status?.kind, 'works');
});

test('the arrival lines recorded in tourLines are the card barks, word for word', () => {
  for (const [id, line] of Object.entries(ARRIVAL_LINES)) {
    const card = byId.get(id);
    assert.ok(card, `${id} arrival line has a card`);
    assert.equal(line.zh, card.bark.zh, `${id} zh`);
    assert.equal(line.en, card.bark.en, `${id} en`);
    assert.ok((NEW.find(a => a.id === id)!.mapRank) <= 2, `${id} is a tier-1 / tier-2 attraction`);
  }
  // every new T1 / T2 attraction has its recorded arrival line (Salesforce Park etc. included)
  for (const a of NEW.filter(x => x.mapRank <= 2)) assert.ok(ARRIVAL_LINES[a.id], `${a.id} has an arrival line`);
  for (const [id, line] of Object.entries(QUIET_LINES)) {
    const card = byId.get(id);
    if (card) { assert.equal(card.quiet, true, `${id} quiet`); assert.equal(line.zh, card.bark.zh); }
    assert.equal(line.mood, 'thinking');
  }
});

test('placeCardPoi: a PoiDef for PoiCard (status first among the tips), and the lazy loader indexes both chunks', async () => {
  const card = byId.get('ccsf-ocean-campus')!;
  const poi = placeCardPoi(card, { x: 421.9, z: 1268.3 });
  assert.equal(poi.id, 'sf:ccsf-ocean-campus');
  assert.equal(poi.interaction.kind, 'info');
  assert.deepEqual(poi.realInfo!.tips[0], card.status!.text);
  assert.equal(poi.realInfo!.sourceUrl, card.sourceUrl);
  assert.equal(poi.bark, card.bark);
  const idx = indexPlaceCards(CARDS, CARD_REFRESHES);
  assert.equal(idx.byPlace.get('stow-lake')?.id, 'blue-heron-lake');
  assert.equal(idx.byPlace.get('japan-center')?.id, 'japan-center', 'a shared-row card still opens by its own id');
  assert.equal(idx.byPlace.get('blue-heron-lake')?.id, 'blue-heron-lake');
  assert.equal(placeCardsNow(), null, 'nothing loaded before loadPlaceCards()');
  const loaded = await loadPlaceCards();
  assert.equal(loaded.cards.length, 124 + CURATED_CARDS.length);
  assert.equal(placeCardNow('alcatraz')?.plannerPlaceId, 'alcatraz');
  assert.equal(placeCardNow('sf-state-university')?.name.zh, '旧金山州立大学');
  assert.equal(await loadPlaceCards(), loaded, 'loaded once');
  // the eager module never imports the card texts statically (they stay lazy chunks)
  const src = fs.readFileSync(new URL('src/opus-bay/data/sf/placeCardTypes.ts', ROOT), 'utf8');
  assert.ok(!/^import .* from '\.\/placeCards2?'/m.test(src), 'placeCardTypes.ts has no static import of the cards');
});

test('the famous curated places get full cards too (Alcatraz, Golden Gate Park, Presidio, Crissy Field, PIER 39)', () => {
  assert.deepEqual(CURATED_CARDS.map(c => c.id), ['alcatraz', 'golden-gate-park', 'presidio', 'crissy-field', 'pier-39']);
  const ids = new Set(ATTRACTIONS.map(a => a.id));
  const photos = new Set<string>(readJson('src/data/sf-landmark-photo-assets.json').map((p: { id: string }) => p.id));
  for (const c of CURATED_CARDS) {
    assert.deepEqual(placeCardProblems(c), []);
    assert.equal(c.depth, 'full');
    assert.ok(ids.has(c.id), `${c.id} is a lane P Attraction id`);
    assert.ok(!byId.has(c.id), `${c.id} does not collide with a new attraction`);
    assert.equal(cardPoiId(c), `sf:${c.id}`);
    if (c.photoKey) assert.ok(photos.has(c.photoKey));
  }
  // the Alcatraz card sends people to the right pier
  assert.match(byIdCurated('alcatraz').bark.zh, /33 号码头/);
});
const byIdCurated = (id: string) => CURATED_CARDS.find(c => c.id === id)!;
