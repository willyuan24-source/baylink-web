import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 7 · lane P (first-load size): the stand-ins GameRoot's graph keeps for the modules that left it answer exactly
 * what those modules answer in district mode until they load, and delegate once they have registered; the district
 * cards' texts fill in place, the city copies in the city's words. (The static-graph walk: opus-bay-sf-budget "W7-P".)
 */

test('W7-P1: citySlots — before deckSteer / viewField load: no deck, the hero view rule (the district values); after: they delegate', async () => {
  const slots = await import('../src/opus-bay/actors/citySlots');
  // this file imports the stand-ins first: nothing has registered yet
  assert.deepEqual(slots.citySlots(), { deck: false, view: false });
  assert.equal(slots.deckAt(0, 0), null);
  assert.equal(slots.onDeck(0, 0), false);
  assert.equal(slots.heroRelaxed('ggb-tower-s', 0, 0), false);
  assert.equal(slots.deckDip(0, 0, 0, 1, 1), null);
  assert.equal(slots.heroView(10, 20), true);
  const spots = [[150, -2], [16, 34], [-128, 0], [60, -2]] as const;
  const before = spots.map(([x, z]) => [slots.preferredViewDir(x, z), slots.preferredCameraYaw(x, z)]);
  const wish = slots.deckWish({ deck: { id: 'd', x: 0, z: 0, heading: 0, length: 10, half: 2, y: 0 }, s: 1, l: 0 }, 0.6, 0.8);
  assert.deepEqual(wish, { x: 0.6, z: 0.8, steered: false });
  // the modules register themselves when they load
  const deck = await import('../src/opus-bay/actors/deckSteer');
  const view = await import('../src/opus-bay/actors/viewField');
  assert.deepEqual(slots.citySlots(), { deck: true, view: true });
  // district (no city terrain): the real view field answers what the stand-in answered
  assert.deepEqual(spots.map(([x, z]) => [view.preferredViewDir(x, z), view.preferredCameraYaw(x, z)]), before);
  assert.deepEqual(spots.map(([x, z]) => [slots.preferredViewDir(x, z), slots.preferredCameraYaw(x, z)]), before);
  // a registered deck is seen through the stand-ins
  const d = { id: 'w7p-test', x: 0, z: 0, heading: 0, length: 40, half: 2.6, y: 0 };
  deck.registerDeck('w7p-test', d);
  try {
    const at = slots.deckAt(0, 10, 0);
    assert.ok(at && at.deck === d && Math.abs(at.s - 10) < 1e-9);
    assert.equal(slots.onDeck(0, 10, 0), true);
    for (const dir of [1, -1]) assert.equal(slots.deckCameraYaw(d, dir), deck.deckCameraYaw(d, dir));
  } finally { deck.registerDeck('w7p-test', null); }
});

test('W7-P1: hudLayoutSlot — before the play layer is in: no boxes, the anchor clamped, the waypoint shown (what the real functions answer with no boxes)', async () => {
  const hud = await import('../src/opus-bay/game/hudLayoutSlot');
  const { playParts } = await import('../src/opus-bay/ui/playLayer');
  assert.equal(playParts(), null, 'node never fetches the play layer here');
  assert.deepEqual(hud.scanHudBoxes({} as HTMLElement, 0, true, 1), []);
  assert.deepEqual(hud.hudBoxes(), []);
  assert.equal(hud.hudBoxesVersion(), 0);
  assert.equal(hud.hudScanCount(), 0);
  hud.releaseHudLayout();
  assert.deepEqual(hud.placeBubble(100, 20, 200, 40, [], 800, 90, 700), { x: 100, y: 90 });
  assert.deepEqual(hud.placeWaypoint({ x: 50, y: 900, edge: false, labelHalf: 40, labelDx: 0 }, [], null, 800, 60, 740), { y: 740, hideLabel: false, hidden: false });
  const real = await import('../src/opus-bay/game/hudLayout');
  assert.deepEqual(real.placeBubble(100, 20, 200, 40, [], 800, 90, 700), { x: 100, y: 90 });
  assert.deepEqual(real.placeWaypoint({ x: 50, y: 900, edge: false, labelHalf: 40, labelDx: 0 }, [], null, 800, 60, 740), { y: 740, hideLabel: false, hidden: false });
});

test('W7-P2: the district cards\' texts — one per card, filled in place in node, the city copies in the city\'s words, once', async () => {
  const pois = await import('../src/opus-bay/data/pois');
  const { DISTRICT_POI_TEXTS } = await import('../src/opus-bay/data/poiTexts');
  const { cityDistrictZh } = await import('../src/opus-bay/data/sf/cityPois');
  assert.equal(pois.poiTextsFilled(), true, 'node fills the texts when data/pois.ts loads');
  const withCard = pois.DISTRICT_POIS.filter(p => p.realInfo).map(p => p.id).sort();
  assert.deepEqual(Object.keys(DISTRICT_POI_TEXTS).sort(), withCard, 'a text for every card, no stray id');
  assert.equal(withCard.length, 15);
  for (const poi of pois.DISTRICT_POIS) {
    const t = DISTRICT_POI_TEXTS[poi.id];
    if (!t) continue;
    const info = poi.realInfo!;
    assert.equal(info.summary, t.summary, poi.id);
    assert.deepEqual(info.tips, t.tips, poi.id);
    assert.equal(info.hours, t.hours, poi.id);
    assert.equal(info.cost, t.cost, poi.id);
    assert.ok(info.summary.zh && info.summary.en && info.tips.length >= 2, poi.id);
    const city = pois.CITY_DISTRICT_POIS.find(p => p.id === poi.id)!.realInfo!;
    assert.notEqual(city, info, 'the city copy is its own object');
    assert.deepEqual(city.summary, { zh: cityDistrictZh(t.summary.zh), en: t.summary.en }, poi.id);
    assert.deepEqual(city.tips.map(x => x.zh), t.tips.map(x => cityDistrictZh(x.zh)), poi.id);
  }
  // the city says 科伊特塔 in the card text, the district as it wrote it
  const coit = pois.CITY_DISTRICT_POIS.find(p => p.id === 'coit-tower')!.realInfo!;
  assert.doesNotMatch([coit.summary.zh, ...coit.tips.map(t => t.zh)].join(' '), /Coit Tower/);
  // the three F-line stops share one text, each card keeps its own arrays
  const f = ['streetcar-ferry', 'streetcar-green', 'streetcar-pier39'].map(id => pois.DISTRICT_POIS.find(p => p.id === id)!.realInfo!);
  assert.ok(f.every(i => i.summary === f[0].summary) && f[0].tips !== f[1].tips);
  // once per page: a second fill changes nothing
  const snapshot = JSON.stringify(pois.POIS);
  pois.fillPoiTexts({ 'ferry-building': { summary: { zh: 'x', en: 'x' }, tips: [] } });
  assert.equal(JSON.stringify(pois.POIS), snapshot);
});

test('W7-P3: data/scriptSlot — node loads the script at once; the bindings are the script\'s own tables, live for flow / content', async () => {
  const slot = await import('../src/opus-bay/data/scriptSlot');
  const script = await import('../src/opus-bay/data/script');
  assert.equal(slot.scriptLoaded(), true);
  const names = ['NODES', 'START_NODE', 'DISTRICT_START_NODE', 'CITY_START_NODE', 'FREE_GOALS', 'DISTRICT_FREE_GOALS', 'STOP_PROMPTS', 'SCRIPT_HOOKS', 'DISTRICT_SCRIPT_HOOKS', 'CITY_SCRIPT_HOOKS', 'GUIDE_BARKS', 'DISTRICT_GUIDE_BARKS', 'CITY_GUIDE_BARKS', 'NPC_LINES'] as const;
  for (const n of names) assert.equal(slot[n], script[n], n);
  assert.ok(Object.keys(slot.NODES).length > 100 && slot.START_NODE && slot.FREE_GOALS.length >= 5);
  // content.ts reads the slot's namespace at call time: a rebinding is seen at once (the play layer's registration)
  const content = await import('../src/opus-bay/game/content');
  const { nodeById } = await import('../src/opus-bay/game/flow');
  const hookName = Object.keys(script.SCRIPT_HOOKS).find(k => typeof (script.SCRIPT_HOOKS as Record<string, unknown>)[k] === 'string')!;
  const before = content.hook(hookName);
  assert.ok(before && nodeById(slot.START_NODE));
  const empty = { ...script, NODES: {}, SCRIPT_HOOKS: {} } as unknown as typeof script;
  slot.registerScript(empty);
  try {
    assert.equal(content.hook(hookName), undefined, 'no script: no hook (the caller\'s own fallback)');
    assert.equal(nodeById(slot.START_NODE), undefined);
  } finally { slot.registerScript(script); }
  assert.equal(content.hook(hookName), before);
});
