import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { mock } from 'node:test';

/**
 * Wave 4 · lane C · integration part b: the verify findings on lane C's files (the content / facts sweep C1–C14, the
 * desktop playtest D5 / D7 / D8 / D12–D14, the phone playtest m2 / m4), one test per finding.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
let clock = 300_000;
mock.method(performance, 'now', () => clock);
const tick = (ms: number) => { clock += ms; };

const src = (path: string) => readFileSync(new URL(`../src/opus-bay/${path}`, import.meta.url), 'utf8');

test('verify C3: a refreshed landmark card never says a thing twice (castro, sutro, cliff house) nor two tulip windows or car-free spans', async () => {
  const cards = await import('../src/opus-bay/game/cityCards');
  const { CARD_REFRESHES } = await import('../src/opus-bay/data/sf/placeCards');
  const { CITY_POIS } = await import('../src/opus-bay/data/sf/cityPois');
  const merged = new Map(Object.entries(CARD_REFRESHES).map(([id, r]) => {
    const poi = CITY_POIS.find(p => p.id === `sf:${id}`)!;
    // every replaceTips match hits a tip of the built card today (a match that went stale would append instead)
    for (const { match } of r.replaceTips ?? []) assert.ok(poi.realInfo!.tips.some(tip => tip.zh.includes(match)), `${id}: "${match}" matches a built tip`);
    return [id, cards.refreshedPoi(poi, r)] as const;
  }));
  const text = (id: string) => { const i = merged.get(id)!.realInfo!; return [i.summary, ...i.tips].map(b => b.zh); };
  const count = (id: string, re: RegExp) => text(id).filter(s => re.test(s)).length;
  assert.equal(count('castro-theatre', /重新开放/), 1, 'the reopening once (the summary)');
  assert.equal(count('sutro-tower', /双峰/), 1, 'see it from Twin Peaks once');
  assert.equal(count('sutro-baths', /湿滑/), 1, 'slippery once');
  assert.equal(count('cliff-house', /暗箱/), 1, 'the Camera Obscura once');
  assert.match(merged.get('cliff-house')!.realInfo!.tips[0].zh, /2026 年底重开/, 'the status says what the source says: late 2026, no date');
  assert.equal(count('dutch-windmill', /郁金香一般|郁金香.*盛开|花期/), 1, 'one tulip window');
  assert.equal(count('twin-peaks', /不走汽车|只让行人|禁止汽车/), 1, 'one car-free tip');
  assert.match(merged.get('twin-peaks')!.realInfo!.tips.map(t => t.zh).join(' '), /东侧一段.*北边 Burnett/, 'both car-free stretches in that one tip');
  // no refresh tip repeats a built tip word for word
  for (const [id, r] of Object.entries(CARD_REFRESHES)) {
    const built = CITY_POIS.find(p => p.id === `sf:${id}`)!.realInfo!.tips.map(tip => tip.zh);
    for (const tip of r.addTips ?? []) assert.ok(!built.includes(tip.zh), `${id}: ${tip.zh}`);
  }
  // a stale match appends instead of losing the line
  const poi = CITY_POIS.find(p => p.id === 'sf:twin-peaks')!;
  const stale = cards.refreshedPoi(poi, { sources: [], verifiedAt: '2026-09-27', replaceTips: [{ match: '不存在的字', text: { zh: '新', en: 'new' } }] });
  assert.equal(stale.realInfo!.tips.length, poi.realInfo!.tips.length + 1);
  assert.equal(stale.realInfo!.tips.at(-1)!.zh, '新');
});

test('verify C9: a status past its `until` is dropped when the cards are indexed (MoAD has none; the Sunset Dunes vote note ends with Nov 2026)', async () => {
  const { indexPlaceCards, statusLive } = await import('../src/opus-bay/data/sf/placeCardTypes');
  const { PLACE_CARDS, CARD_REFRESHES } = await import('../src/opus-bay/data/sf/placeCards');
  const { PLACE_CARDS_2, CURATED_CARDS } = await import('../src/opus-bay/data/sf/placeCards2');
  const all = [...PLACE_CARDS, ...PLACE_CARDS_2, ...CURATED_CARDS];
  const text = { zh: '闭馆', en: 'Closed' };
  assert.equal(statusLive({ kind: 'closed', text, until: '2026-09' }, new Date('2026-09-30T20:00:00Z')), true, 'the last day of the month (Bay time) still counts');
  assert.equal(statusLive({ kind: 'closed', text, until: '2026-09' }, new Date('2026-10-01T09:00:00Z')), false);
  assert.equal(statusLive({ kind: 'works', text, until: '2027' }, new Date('2027-12-31T12:00:00Z')), true);
  assert.equal(statusLive({ kind: 'works', text, until: '2027' }, new Date('2028-01-01T09:00:00Z')), false);
  assert.equal(statusLive({ kind: 'closed', text }, new Date('2099-01-01')), true, 'no until: kept until someone re-checks');
  assert.equal(all.find(c => c.id === 'moad')!.status, undefined, 'MoAD reopened on 30 Sep 2026');
  const dunes = all.find(c => c.id === 'sunset-dunes')!;
  assert.equal(dunes.status?.until, '2026-11');
  const now = indexPlaceCards(all, CARD_REFRESHES, new Date('2026-09-27T12:00:00Z'));
  const later = indexPlaceCards(all, CARD_REFRESHES, new Date('2026-12-02T12:00:00Z'));
  assert.ok(now.byId.get('sunset-dunes')!.status, 'the vote note today');
  assert.equal(later.byId.get('sunset-dunes')!.status, undefined, 'gone after November');
  assert.equal(later.byId.get('sunset-dunes')!.summary, dunes.summary, 'the rest of the card stays');
  assert.equal(later.refreshes['twin-peaks'].status?.kind, 'works', 'the Promenade works run to 2027');
  assert.equal(now.byId.get('sunset-dunes'), dunes, 'a live card is the same object');
  for (const c of all) if (c.status?.until) assert.match(c.status.until, /^\d{4}(-\d{2})?$/, c.id);
});

test('verify C1 / D7: a city card links only its own official site; the plan button names the place in English and wraps', async () => {
  const { cardOfficialUrl, CITY_POI_OFFICIAL_URLS } = await import('../src/opus-bay/data/sf/cityPois');
  const planner = 'https://www.goldengate.org/bridge/visiting-the-bridge/bikes-pedestrians/';
  assert.equal(cardOfficialUrl('sf:fort-point', planner, CITY_POI_OFFICIAL_URLS), 'https://www.nps.gov/fopo/', 'the landmark’s own site, not the planner place’s page');
  assert.equal(cardOfficialUrl('sf:no-such-landmark', planner, CITY_POI_OFFICIAL_URLS), undefined, 'no official site: no 官网 button');
  assert.equal(cardOfficialUrl('pier39', 'https://www.pier39.com/', {}), 'https://www.pier39.com/', 'district cards keep the planner link first');
  assert.equal(cardOfficialUrl('pier39', undefined, { pier39: 'https://x.org/' }), 'https://x.org/');
  for (const id of ['fort-point', 'de-young-tower', 'conservatory-of-flowers', 'palace-of-fine-arts', 'dragon-gate', 'fishermans-wharf-sign']) {
    assert.notEqual(cardOfficialUrl(`sf:${id}`, 'https://planner.example/', CITY_POI_OFFICIAL_URLS), 'https://planner.example/', id);
  }
  assert.match(src('ui/PoiCardBody.tsx'), /cardOfficialUrl\(poi\.id, place\?\.officialUrl, POI_OFFICIAL_URLS\)/);
  // D7: the English label never prints the zh-only planner title; the label wraps (content-ui.css)
  assert.match(src('ui/PoiCardBody.tsx'), /`Put \$\{poi\.name\.en\} in a BAYLINK plan`/);
  assert.match(src('ui/PlaceCard.tsx'), /`Put \$\{name\.en\} in a BAYLINK plan`/);
  assert.match(src('ui/content-ui.css'), /\.ob-poi \.ob-lede \+ \.ob-btn,[^{]*\{[^}]*white-space: normal/);
});

test('verify C4 / C5 / C10 / C11: Union Square’s cable cars, the HUD’s neighbourhood names, no dead sources, the biggest city-run park', async () => {
  const { PLACE_CARDS } = await import('../src/opus-bay/data/sf/placeCards');
  const { PLACE_CARDS_2, CURATED_CARDS } = await import('../src/opus-bay/data/sf/placeCards2');
  const all = [...PLACE_CARDS, ...PLACE_CARDS_2, ...CURATED_CARDS];
  const us = all.find(c => c.id === 'union-square')!;
  assert.ok(us.tips.some(t => /广场西边的鲍威尔街/.test(t.zh) && /west side/.test(t.en)));
  assert.ok(!us.tips.some(t => /one block west|往西一个路口/.test(`${t.zh} ${t.en}`)));
  // the zone eyebrows use the HUD's names (scripts/opus-sf/lib/zones.ts ZH): 湖岸区, 维西塔西翁谷, 英格尔赛德
  const zones = src('../../scripts/opus-sf/lib/zones.ts');
  for (const name of ['湖岸区', '维西塔西翁谷', '英格尔赛德']) assert.ok(zones.includes(name), `the HUD says ${name}`);
  for (const c of all) assert.ok(!/湖滨区|访谷|英格塞德/.test(c.zone.zh), `${c.id} zone ${c.zone.zh}`);
  for (const id of ['stonestown-galleria', 'sf-state-university', 'sf-zoo', 'lake-merced', 'fort-funston']) assert.match(all.find(c => c.id === id)!.zone.zh, /^湖岸区/, id);
  // the three dead links (verify-content url-status.txt) are gone
  const urls = all.flatMap(c => [c.sourceUrl, ...c.sources, c.officialUrl ?? '']);
  for (const dead of ['maritime.org/home/parkinfo', 'goldengatepark.com/golden-gate-park-carousel']) assert.ok(!urls.some(u => u.includes(dead)), dead);
  assert.ok(all.find(c => c.id === 'koret-carousel')!.sources.length >= 1);
  // C11: the Presidio is bigger; Golden Gate Park is the biggest city-run park (text after the recorded phrase only)
  const { neighbourhoodLine } = await import('../src/opus-bay/data/sf/lines');
  const ggp = neighbourhoodLine('golden-gate-park')!.text;
  assert.ok(ggp.zh.startsWith('你好，金门公园！') && /最大的市立公园/.test(ggp.zh), ggp.zh);
  assert.ok(/biggest city-run park/.test(ggp.en), ggp.en);
});

test('verify C2 / C6 / C7: zh card text uses the game’s zh names (天涯海角, 双峰, 都板街 …); place-card titles gloss 中国城; the Coit goal', async () => {
  const { CITY_POIS, CITY_POI_ZONES, ZH_TEXT_NAMES, glossZhText, placeCardName } = await import('../src/opus-bay/data/sf/cityPois');
  const zh = (id: string) => { const p = CITY_POIS.find(x => x.id === id)!; const i = p.realInfo!; return [p.bark!, i.summary, ...i.tips, i.hours, i.cost].filter(Boolean).map(b => b!.zh); };
  const all = [...CITY_POIS.flatMap(p => zh(p.id)), ...Object.values(CITY_POI_ZONES).map(z => z.zh)];
  for (const [from] of ZH_TEXT_NAMES) for (const s of all) assert.ok(!s.includes(from), `"${from}" in ${s}`);
  assert.ok(zh('sf:dragon-gate').includes('BAYLINK 攻略：从龙门沿都板街一路走到北滩的华盛顿广场。'), 'no space left where an English name was');
  assert.ok(zh('sf:sutro-tower').some(s => s.includes('最好的观景点在旁边的双峰。')));
  assert.equal(CITY_POI_ZONES['sf:sutro-baths'].zh, '天涯海角');
  assert.equal(CITY_POI_ZONES['sf:legion-of-honor'].zh, '林肯公园 · 天涯海角');
  assert.equal(CITY_POI_ZONES['sf:cliff-house'].zh, '天涯海角 · 海洋海滩北端');
  assert.equal(glossZhText('天涯海角 Lands End'), '天涯海角', 'a label lane L already fixed is not doubled');
  assert.equal(glossZhText('约 925 英尺'), '约 925 英尺', 'text without a name keeps its spacing');
  assert.equal(CITY_POIS.find(p => p.id === 'sf:fort-point')!.name.zh, 'Fort Point 炮台', 'names are never rewritten');
  assert.equal(placeCardName({ zh: '中国城', en: 'Chinatown' }).zh, '唐人街');
  assert.equal(placeCardName({ zh: '西索玛', en: 'SoMa West' }).zh, '西南市场');
  const { CITY_FREE_GOALS, CITY_GOAL } = await import('../src/opus-bay/data/sf/goals');
  // wave 5 (W5-C2, on purpose): the Coit goal is the pelican goal now; its zh text uses the game's zh names
  const coit = CITY_FREE_GOALS.find(goal => goal.id === CITY_GOAL.pelican)!;
  assert.equal(coit.label.zh, '先去科伊特塔找鹈鹕朋友');
  assert.ok(!/[A-Z]/.test(coit.hint.zh), coit.hint.zh);
  const voice = src('data/VOICE.md');
  for (const row of ['| Lands End | 天涯海角 |', '| Marina Green | 码头绿地 |', '湖岸区 · 维西塔西翁谷 · 英格尔赛德', '科伊特塔 · 菲尔伯特台阶']) assert.ok(voice.includes(row), row);
});

// ---------------------------------------------------------------------------
// behaviour: the flow, the brain, the save (the running modules)
// ---------------------------------------------------------------------------

const store = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const flowMod = await import('../src/opus-bay/game/flow');
const { flow, initialFlowState } = await import('../src/opus-bay/game/flowStore');
const inter = await import('../src/opus-bay/game/interactables');
const brain = await import('../src/opus-bay/game/brain');
const save = await import('../src/opus-bay/data/save');
const { setStorageForTests } = await import('../src/opus-bay/data/wishlist');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const { POSTCARDS } = await import('../src/opus-bay/data/postcards');
const { FREE_GOALS } = await import('../src/opus-bay/data/script');
setStorageForTests(null);

function reset(world: 'city' | 'district' = 'city') {
  if (flow.get().trip) flowMod.endTrip();
  store.game.set({ ...store.initialGameState(), phase: 'playing', worldMode: world, mode: 'free' });
  flow.set(initialFlowState());
  Object.assign(runtime.player, { x: 0, y: 0, z: 0, heading: 0, moving: false, running: false, locked: false, pendingInteract: null, pathTarget: null });
  Object.assign(runtime.guide, { x: 0, y: 0, z: 0, state: 'follow', target: null, run: false, emote: 'none', arrived: false });
  brain.resetBrain();
  inter.setInteractables(inter.buildInteractables());
  tick(5000);
}
const verb = { zh: 'x', en: 'x' };

test('verify D5: in the city a postcard in reach beats BAYBAY at your side and a ride parked on it; the district keeps its weights', () => {
  reset('city');
  Object.assign(runtime.guide, { x: 0.8, z: 0 });
  const card = { id: 'postcard:sf-mission-murals', source: 'postcard' as const, action: 'postcard' as const, verb, name: verb, x: 2.2, z: 0, radius: 2.4, refId: 'sf-mission-murals' };
  const bike = { id: 'ride:bike-dolores', source: 'vehicle' as const, action: 'info' as const, verb, name: verb, x: 1.5, z: 0.6, radius: 2.2 };
  const bay = { id: inter.BAYBAY_ID, source: 'baybay' as const, action: 'talk' as const, verb, name: verb, x: 0.8, z: 0, radius: 2.4 };
  inter.setInteractables([card, bike, bay]);
  brain.updateFocus();
  assert.equal(store.game.get().focus, card.id, 'E picks up the card (Luz’s favour is not stuck behind the bike)');
  inter.setInteractables([bike, bay]);
  brain.updateFocus();
  assert.equal(store.game.get().focus, inter.BAYBAY_ID, 'without the card BAYBAY at your side still wins over the parked bike');
  reset('district');
  Object.assign(runtime.guide, { x: 0.8, z: 0 });
  inter.setInteractables([card, bay]);
  brain.updateFocus();
  assert.equal(store.game.get().focus, inter.BAYBAY_ID, 'district weights unchanged');
});

test('verify D8: Karl’s “called in sick” joke only in the city’s daytime pool (never at golden hour with his bank on screen)', async () => {
  const { CITY_GUIDE_BARKS } = await import('../src/opus-bay/data/script');
  const sick = /请假|called in sick/;
  for (const kind of ['idle', 'morning', 'golden', 'night'] as const) assert.ok(!CITY_GUIDE_BARKS[kind].some(b => sick.test(`${b.zh} ${b.en}`)), kind);
  assert.ok(CITY_GUIDE_BARKS.day.some(b => sick.test(b.zh)), 'still said on a clear day');
  assert.ok(CITY_GUIDE_BARKS.idle.length >= 3, 'the idle pool keeps its other lines');
});

test('verify D12: a lead to the Golden Gate deck goes through the deck’s south end first (never under the bridge to Fort Point)', async () => {
  const { leadStep, ELEVATED_WALKS } = brain;
  const { GGB_SOUTH_TOWER } = await import('../src/opus-bay/data/sf/residents');
  const { sfLandmark, worldToLandmark } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { GGB } = await import('../src/opus-bay/world/sf/landmarks/golden-gate-bridge');
  const deck = ELEVATED_WALKS.find(w => w.id === 'ggb-deck')!;
  // the numbers are the bridge model's: the entry 4 u onto the deck from its south end; the span to END_N; the targets
  // from local −100 to +100 (the south tower at −TOWER inside, Fort Point's apron under the deck outside)
  const bridge = sfLandmark('golden-gate-bridge')!;
  const local = (p: { x: number; z: number }) => worldToLandmark(bridge, p);
  const near = (p: { x: number; z: number }, x: number) => { const l = local(p); assert.ok(Math.abs(l.x - x) < 0.2 && Math.abs(l.z) < 0.2, `${JSON.stringify(l)} vs ${x}`); };
  near(deck.entry, GGB.END_S + 4); near(deck.span.a, GGB.END_S + 4); near(deck.span.b, GGB.END_N); near(deck.targets.a, -100); near(deck.targets.b, 100);
  assert.equal(deck.y, GGB.DECK);
  const tower = { x: GGB_SOUTH_TOWER.x, z: GGB_SOUTH_TOWER.z };
  assert.ok(local(tower).x > -100 && local(tower).x < 100);
  assert.deepEqual(leadStep(tower, { x: -563, y: 1, z: 550 }), deck.entry, 'from Crissy Field: to the deck’s end first');
  assert.deepEqual(leadStep(tower, { x: -757, y: 3, z: 596 }), deck.entry, 'under the deck by Fort Point: the entry, not straight up');
  const onDeck = { x: deck.entry.x + (deck.span.b.x - deck.entry.x) * 0.2, y: 15.2, z: deck.entry.z + (deck.span.b.z - deck.entry.z) * 0.2 };
  assert.equal(leadStep(tower, onDeck), tower, 'on the deck: straight to the tower');
  assert.equal(leadStep(tower, { x: deck.entry.x + 1, y: 13, z: deck.entry.z }), tower, 'at the entry: on to the tower');
  // Fort Point's apron lies right under the deck's south end (local −149): a ground target, led straight (QA part b)
  const { LANDMARK_ARRIVALS } = await import('../src/opus-bay/data/sf/arrivals');
  const fort = { x: LANDMARK_ARRIVALS['fort-point'].x, z: LANDMARK_ARRIVALS['fort-point'].z };
  assert.ok(local(fort).x < -100 && Math.abs(local(fort).z) < 4, JSON.stringify(local(fort)));
  assert.equal(leadStep(fort, { x: -680, y: 15, z: 654 }), fort, 'from the Welcome Center down to Fort Point');
  const ground = { x: -600, z: 500 };
  assert.equal(leadStep(ground, { x: -563, y: 1, z: 550 }), ground, 'a target on the ground is led straight');
});

test('verify D14: a city postcard clue leads to a spot ≈ 8 u short of the card, named for the place it hides next to', () => {
  reset('city');
  const { clueSpot, CLUE_OFFSET, CLUE_PREFIX, nextFreeGoal } = flowMod;
  const card = { x: 35.2, z: 188.9 }, grace = { x: 7.4, z: 223.7 };
  const raw = clueSpot(card, grace, () => null);
  assert.ok(Math.abs(Math.hypot(raw.x - card.x, raw.z - card.z) - CLUE_OFFSET) < 1e-6, 'CLUE_OFFSET from the card');
  assert.equal(raw.snapped, false);
  const snapped = clueSpot(card, grace, p => ({ x: p.x + 1, z: p.z }));
  assert.ok(snapped.snapped && Math.abs(snapped.x - raw.x - 1) < 1e-9, 'moved onto walkable ground');
  const close = clueSpot(card, { x: card.x + 3, z: card.z });
  assert.deepEqual({ x: close.x, z: close.z }, { x: card.x + 3, z: card.z }, 'a place closer than that: the place');
  // the free-roam hint (node tests see the district's cards; the mechanism is the same): with only the postcards left,
  // the city hint is a clue id that resolves near its card (the waypoint, 带我去 and the free lead use interactableById)
  store.game.set({ goalsDone: [...FREE_GOALS.map(goal => goal.id).filter(id => id !== 'postcards'), 'pelican'] });
  const next = nextFreeGoal({ x: 0, z: 0 })!;
  assert.ok(next.id.startsWith(CLUE_PREFIX), next.id);
  assert.match(next.name.zh, /^明信片线索 · .+附近$/);
  const pc = POSTCARDS.find(c => `${CLUE_PREFIX}${c.id}` === next.id)!;
  const it = inter.interactableById(next.id)!;
  assert.ok(Math.hypot(it.x - pc.position.x, it.z - pc.position.z) <= CLUE_OFFSET + 6.01, 'close to its card');
  assert.equal(it.refId, pc.id);
  // the district keeps the old clue (the nearest real place)
  reset('district');
  store.game.set({ goalsDone: [...FREE_GOALS.map(goal => goal.id).filter(id => id !== 'postcards'), 'pelican'] });
  const d = nextFreeGoal({ x: 0, z: 0 })!;
  assert.ok(!d.id.startsWith(CLUE_PREFIX), d.id);
});

test('verify m4: the city’s soft goal chip drops while you ride and once you stand at it; the district keeps it', () => {
  reset('city');
  flow.set({ freeHint: { id: 'sf:cable-car-turntable', x: 134.9, z: 261, name: { zh: '叮当车 · Powell & Market 转车台', en: 'Cable car' } } });
  runtime.player.x = 60; runtime.player.z = 200;
  assert.equal(flowMod.objectiveTarget()?.soft, true, 'on foot: the soft chip');
  store.game.set({ move: { mode: 'transit', line: 'powell-hyde', spot: 'rail' } });
  assert.equal(flowMod.objectiveTarget(), null, 'riding the cable car: no chip on the rider');
  store.game.set({ move: { mode: 'foot' } });
  runtime.player.x = 133; runtime.player.z = 259;
  assert.equal(flowMod.objectiveTarget(), null, 'standing at it: done');
  reset('district');
  flow.set({ freeHint: { id: 'coit-tower', x: 10, z: 10, name: { zh: 'x', en: 'x' } } });
  store.game.set({ move: { mode: 'transit', line: 'streetcar', spot: 'rail' } });
  assert.equal(flowMod.objectiveTarget()?.soft, true, 'district unchanged');
});

test('QA (the Palace loop stop): in the city BAYBAY’s small talk waits after a ride, so the stop’s arrive line and hop-off tip come first', () => {
  reset('city');
  store.game.set({ timeOfDay: 'golden', mode: 'free' });
  const said = () => flow.get().bubble?.text.zh ?? null;
  // riding for 30 s (the time-of-day line never plays on a ride)
  store.game.set({ move: { mode: 'transit', line: 'sf-loop', spot: 'deck' } });
  for (let i = 0; i < 30; i++) { tick(1000); brain.updateGuide(clock); }
  store.game.set({ move: { mode: 'foot' } });
  flow.set({ bubble: null });
  // just off the bus: quiet for SMALL_TALK_QUIET_MS
  for (let i = 0; i < 12; i++) { tick(1000); brain.updateGuide(clock); assert.equal(said(), null, `quiet ${i + 1} s after the ride`); }
  for (let i = 0; i < 6; i++) { tick(1000); brain.updateGuide(clock); }
  assert.match(said() ?? '', /金色时刻/, 'then the golden-hour line');
  // the district keeps its timing (no settling window)
  reset('district');
  store.game.set({ timeOfDay: 'golden', mode: 'free' });
  store.game.set({ move: { mode: 'transit', line: 'streetcar', spot: 'rail' } });
  for (let i = 0; i < 30; i++) { tick(1000); brain.updateGuide(clock); }
  store.game.set({ move: { mode: 'foot' } });
  flow.set({ bubble: null });
  tick(1000); brain.updateGuide(clock);
  assert.ok(said(), 'district: at once, as before');
});

test('part b · the Grand Tour: a photo moment waits for the shutter; the express points at 直接到站 on long Metro legs', async () => {
  const tour = await import('../src/opus-bay/game/cityTour');
  const { dwellOver, wantsSkipHint, photoPrompt, PHOTO_AFTER_S, PHOTO_HOLD_MAX_S, DWELL_S, LONG_METRO_U } = tour;
  const at = { x: 0, z: 0 };
  const photo = { dwellAt: 100, dwell: DWELL_S.photo, at, moment: 'photo' as const, shotAt: 0 };
  const still = { photoMode: false, player: at }, framing = { photoMode: true, player: at };
  assert.equal(dwellOver(photo, 100 + DWELL_S.photo - 1, still), false);
  assert.equal(dwellOver(photo, 100 + DWELL_S.photo, still), true, 'no shot: the usual 25 s');
  assert.equal(dwellOver(photo, 100 + 60, framing), false, 'framing a shot holds the stop');
  assert.equal(dwellOver(photo, 100 + PHOTO_HOLD_MAX_S, framing), true, '… up to a cap');
  const shot = { ...photo, shotAt: 108 };
  assert.equal(dwellOver(shot, 108 + PHOTO_AFTER_S - 0.5, still), false);
  assert.equal(dwellOver(shot, 108 + PHOTO_AFTER_S, still), true, 'the shot ends it 3 s later');
  assert.equal(dwellOver({ ...shot, moment: 'arrive' as const, dwell: DWELL_S.arrive }, 108 + PHOTO_AFTER_S, framing), false, 'only photo moments');
  assert.equal(dwellOver({ ...photo, moment: 'arrive' as const, dwell: DWELL_S.arrive }, 100 + DWELL_S.arrive, framing), true, 'photo mode does not hold other moments');
  // the express hint: your own LRV leaving on a long tour ride, once
  const leg = { via: 'line' as const, line: 'n-judah', board: 'a', alight: 'b', wait: 30, stops: 6, from: at, to: at, seconds: 300, length: LONG_METRO_U + 200 };
  const trip = { placeId: 'x', option: { mode: 'line' as const, legs: [leg], seconds: 300 }, legs: [leg], leg: 0, startedAt: 0, source: 'tour' as const };
  const depart = { type: 'transit' as const, what: 'depart' as const, line: 'n-judah', kind: 'light-rail' as const };
  const r = { express: true, phase: 'leading' as const, hinted: false };
  assert.equal(wantsSkipHint(depart, r, trip), true);
  assert.equal(wantsSkipHint({ ...depart, strength: 0.6 }, r, trip), false, 'another train heard nearby');
  assert.equal(wantsSkipHint(depart, { ...r, hinted: true }, trip), false, 'once per stop');
  assert.equal(wantsSkipHint(depart, { ...r, express: false }, trip), false, 'the full tour rides it');
  assert.equal(wantsSkipHint(depart, r, { ...trip, legs: [{ ...leg, length: 300 }] }), false, 'a short leg');
  assert.equal(wantsSkipHint({ ...depart, kind: 'bus' as const, line: 'sf-loop' }, r, trip), false, 'the bus');
  // words for the device; the express intro names the button as the English UI does
  assert.match(photoPrompt('touch', 390).zh, /更多/);
  assert.match(photoPrompt('keyboard', 1440).en, /Press P/);
  const src = readFileSync(new URL('../src/opus-bay/game/cityTour.ts', import.meta.url), 'utf8');
  assert.ok(src.includes("you can tap Skip to stop.'") && !/en: '[^']*直接到站/.test(src), 'no zh button name in English text');
});

test('verify F5: Settings → reset progress forgets lane C’s arrival stamps and stops a running Grand Tour without writing it back', async () => {
  reset('city');
  save.resetSaveCache();
  let heard = 0;
  const off = save.onSaveCleared(() => { heard++; });
  save.clearSave();
  assert.equal(heard, 1, 'clearSave tells its listeners');
  off();
  // the arrival stamps
  const moments = await import('../src/opus-bay/game/cityMoments');
  const { ArrivalWatcher, arrivalAnchors } = await import('../src/opus-bay/game/arrival');
  const { ATTRACTIONS } = await import('../src/opus-bay/data/sf/attractions');
  const offMoments = moments.initCityMoments();
  const sfsu = ATTRACTIONS.find(a => a.id === 'sf-state-university')!;
  const p = sfsu.arrival ?? sfsu;
  const w = new ArrivalWatcher(arrivalAnchors(ATTRACTIONS));
  runtime.player.x = p.x; runtime.player.z = p.z;
  for (let i = 0; i < 8; i++) { tick(250); stepFrameSystems(0.25, clock); }
  if (!moments.arrivalSeen('sf-state-university')) moments.applyArrival(w.step({ x: p.x, z: p.z, now: clock, onFoot: true, busy: false, travelling: false })!, clock);
  assert.equal(moments.arrivalSeen('sf-state-university'), true, 'stamped');
  save.clearSave();
  assert.equal(moments.arrivalSeen('sf-state-university'), false, 'the stamp is gone with the save');
  assert.equal(save.readSave()?.arrivals, undefined);
  // a running Grand Tour: Settings sets the tour off and resets; the tour's tick must not save its progress again
  const tripRun = await import('../src/opus-bay/game/tripRun');
  const offTrips = tripRun.initTripRun();
  const cityTour = await import('../src/opus-bay/game/cityTour');
  const { GRAND_TOUR } = await import('../src/opus-bay/data/sf/copy');
  cityTour.initCityTour();
  runtime.player.x = 0; runtime.player.z = 0;
  flowMod.startTour(GRAND_TOUR.id);
  flowMod.chooseDialogue(0);
  flowMod.closeDialogue();
  tripRun.dispatchTrip({ type: 'leg-arrived' });
  assert.ok(cityTour.cityTourRun(), 'the tour runs');
  save.clearSave();
  store.game.set({ postcards: [], goalsDone: [], viewpointUnlocked: false, tour: { active: false, stop: 0, completed: [] } });
  flowMod.restartOnboarding();
  for (let i = 0; i < 4; i++) { tick(500); stepFrameSystems(0.5, clock); }
  assert.equal(cityTour.cityTourRun(), null, 'the tour stopped');
  assert.equal(save.readSave()?.tours, undefined, 'and wrote nothing back');
  offTrips(); offMoments();
});
