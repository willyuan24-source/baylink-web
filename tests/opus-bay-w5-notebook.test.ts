import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 5 · lane E · W5-E5: the 旅行手帐 — the stamp registry against the published attractions, when a stamp is stamped,
 * stamps kept in the save, page completion paying 30 金币 and the page's cosmetic ONCE, no persistence under
 * `?discover=all`, every MF8 area on the pages, the header line (lane R's sun), the Journal tab registration and the
 * notebook rendered in node.
 */

const save = await import('../src/opus-bay/data/save');
const { bitCount, bitGet } = await import('../src/opus-bay/data/playSave');
const { __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
const L = await import('../src/opus-bay/economy/ledger');
const W = await import('../src/opus-bay/economy/wallet');
const S = await import('../src/opus-bay/economy/stamps');
const N = await import('../src/opus-bay/economy/notebookRun');
const I = await import('../src/opus-bay/economy/items');
const { todayLine } = await import('../src/opus-bay/economy/today');
const { ATTRACTIONS, ARRIVAL_PLACES } = await import('../src/opus-bay/data/sf/attractions');
const { EGG_AREAS, EGG_IDS, EGGS } = await import('../src/opus-bay/eggs/registry');
const { VIEW_SPOTS, VIEW_SPOT_IDS } = await import('../src/opus-bay/play/viewSpots');

function fresh() {
  save.resetSaveCache();
  save.clearSave();
  L.__resetLedgerForTests();
  __setBayNowForTests('2026-10-10T11:00');
  L.registerRewardIds('page', S.PAGE_IDS);
  L.registerRewardIds('view', VIEW_SPOT_IDS);
  L.registerRewardIds('egg', EGG_IDS);
}

/** A world where nothing is done yet, with overrides. */
function world(o: Partial<import('../src/opus-bay/economy/stamps').StampWorld> = {}): import('../src/opus-bay/economy/stamps').StampWorld {
  return { arrived: () => false, discovered: () => false, pelican: false, goals: new Set(), rides: {}, paid: L.isPaid, ...o };
}

test('W5-E5 stamps: the 16 must-sees are the attractions of rank 1 (ids, place ids, short names); six journeys; append-only', () => {
  const t1 = ATTRACTIONS.filter(a => a.rank === 1);
  const land = S.STAMPS.filter(s => s.group === 'landmark');
  assert.equal(land.length, 16);
  assert.deepEqual(land.map(s => s.id.slice(3)).sort(), t1.map(a => a.id).sort());
  for (const s of land) {
    const a = t1.find(x => x.id === s.id.slice(3))!;
    assert.ok(s.places!.includes(a.placeId ?? a.id), `${a.id}: its place id counts`);
    assert.equal(s.name.zh, a.short?.zh ?? a.name.zh, `${a.id}: the short name`);
    const island = ARRIVAL_PLACES[a.id];
    if (island) assert.ok(s.places!.includes(island.id), `${a.id}: the landing you can stand on counts`);
  }
  assert.deepEqual(S.STAMPS.filter(s => s.group === 'journey').map(s => s.id), ['pelican', 'golden-gate', 'cable-car', 'f-line', 'sightseeing', 'metro']);
  // APPEND-ONLY: the head never moves
  assert.deepEqual(S.STAMP_IDS.slice(0, 3), ['t1:golden-gate-bridge', 't1:alcatraz', 't1:fishermans-wharf']);
  assert.equal(S.STAMP_IDS.indexOf('pelican'), 16);
  assert.deepEqual([...S.PAGE_IDS], ['stamps', 'finds', 'views']);
  assert.equal(new Set(S.STAMP_IDS).size, S.STAMP_IDS.length);
});

test('W5-E5 when a stamp is stamped: an arrival, a discovery, the island by its landing or the pelican egg, journeys by goal or ride', () => {
  fresh();
  const byId = (id: string) => S.STAMPS.find(s => s.id === id)!;
  assert.equal(S.stampLive(byId('t1:coit-tower'), world()), false);
  assert.equal(S.stampLive(byId('t1:coit-tower'), world({ arrived: id => id === 'coit-tower' })), true);
  assert.equal(S.stampLive(byId('t1:golden-gate-bridge'), world({ discovered: id => id === 'ggb-deck-mid' })), true);
  assert.equal(S.stampLive(byId('t1:alcatraz'), world({ discovered: id => id === 'alcatraz-landing' })), true);
  assert.equal(S.stampLive(byId('t1:alcatraz'), world({ paid: s => s === 'egg:alcatraz-pelican-island' })), true);
  assert.equal(S.stampLive(byId('pelican'), world({ pelican: true })), true);
  assert.equal(S.stampLive(byId('golden-gate'), world({ goals: new Set(['golden-gate']) })), true);
  assert.equal(S.stampLive(byId('cable-car'), world({ rides: { california: 2 } })), true);
  assert.equal(S.stampLive(byId('f-line'), world({ rides: { streetcar: 1 } })), true);
  assert.equal(S.stampLive(byId('f-line'), world({ goals: new Set(['streetcar']) })), true);
  assert.equal(S.stampLive(byId('sightseeing'), world({ rides: { 'sf-loop': 1 } })), true);
  assert.equal(S.stampLive(byId('metro'), world({ rides: { 'm-ocean-view': 1 } })), true);
  assert.equal(S.stampLive(byId('metro'), world({ rides: { 'n-judah': 0 } })), false);
});

test('W5-E5 stamps are kept in the save once seen: a later world without them still shows them stamped', () => {
  fresh();
  N.checkNotebook(world({ arrived: id => id === 'coit-tower' || id === 'twin-peaks', pelican: true }), true);
  const p = L.playState();
  assert.equal(bitCount(p.g.stamp), 3);
  assert.ok(bitGet(p.g.stamp, S.STAMP_IDS.indexOf('t1:coit-tower')));
  assert.ok(bitGet(p.g.stamp, S.STAMP_IDS.indexOf('pelican')));
  const pages = N.checkNotebook(world(), true);
  assert.deepEqual(pages, []);
  assert.equal(N.notebookPages()!.stamps.got, 3, 'still stamped (a trimmed arrivals list loses nothing)');
});

test('W5-E5 ?discover=all (QA) stamps nothing into the save', () => {
  fresh();
  const all = world({ arrived: () => true, discovered: () => true, pelican: true, goals: new Set(['golden-gate', 'cable-car', 'streetcar', 'sightseeing', 'metro']) });
  N.checkNotebook(all, false);
  assert.equal(bitCount(L.playState().g.stamp), 0);
  assert.equal(L.coinsTotal(), 0, 'and pays no page');
});

test('W5-E5 a full page pays 30 金币 and gives its cosmetic, once', () => {
  fresh();
  const all = world({ arrived: () => true, pelican: true, goals: new Set(['golden-gate', 'cable-car', 'streetcar', 'sightseeing', 'metro']) });
  assert.deepEqual(N.checkNotebook(all, true), ['stamps']);
  assert.equal(L.coinsTotal(), S.PAGE_COINS);
  assert.equal(W.owns(I.PAGE_ITEM.stamps), true, 'the postmark frame');
  assert.deepEqual(N.checkNotebook(all, true), [], 'once');
  assert.equal(L.coinsTotal(), S.PAGE_COINS);
  // the views: lane A pays view:<id> as each spot is sat at
  for (const id of VIEW_SPOT_IDS.slice(0, -1)) L.pay(`view:${id}`, 5);
  assert.deepEqual(N.checkNotebook(all, true), [], 'one spot short');
  L.pay(`view:${VIEW_SPOT_IDS.at(-1)}`, 5);
  assert.deepEqual(N.checkNotebook(all, true), ['views']);
  assert.equal(W.owns('frame-golden'), true, 'the full 看风景 page → the golden-hour frame (plan §3.5)');
  // the finds: lane D pays egg:<id>
  for (const id of EGG_IDS) L.pay(`egg:${id}`, 10);
  assert.deepEqual(N.checkNotebook(all, true), ['finds']);
  assert.equal(W.owns('scarf-treasure'), true);
  assert.equal(L.coinsTotal(), 3 * S.PAGE_COINS + 16 * 5 + 24 * 10);
  const st = N.notebookPages()!;
  assert.deepEqual([st.stamps.got, st.stamps.total, st.finds.got, st.finds.total, st.views.got, st.views.total], [22, 22, 24, 24, 16, 16]);
  assert.equal(N.notebookCount(), String(22 + 24 + 16));
});

test('W5-E5 MF8: the pages list something in every area (the eight egg areas; view spots in five of the six attraction areas)', () => {
  for (const area of EGG_AREAS) assert.ok(EGGS.some(e => e.area === area), `eggs in ${area}`);
  const areas = new Set(VIEW_SPOTS.filter(v => !v.retired).map(v => v.area));
  assert.ok(areas.size >= 5, `${areas.size} view areas`);
});

test('W5-E5 the header: today\'s real San Francisco from lane R\'s sun and moon, never a streak', () => {
  __setBayNowForTests('2026-09-28T12:00');
  const l = todayLine();
  assert.match(l.zh, /^旧金山 9月28日 周一 · 日落 18:5\d · 今晚约是/);
  assert.match(l.en, /Mon 28 Sep · sunset 18:5\d/);
  __setBayNowForTests('2026-12-21T12:00');
  assert.match(todayLine().zh, /12月21日 周一 · 日落 16:5\d/, 'the winter solstice sunset ≈ 16:54 (plan §3.3)');
  __setBayNowForTests(null);
});

test('W5-E5 the Journal tab 手帐 is registered at order 7 (after 今天, before 明信片) with a lazy body; the shop overlays too', async () => {
  const slots = await import('../src/opus-bay/ui/slots');
  const economy = await import('../src/opus-bay/economy/index');
  fresh();
  const off = economy.init();
  try {
    const tab = slots.journalTabs.get('notebook');
    assert.ok(tab);
    assert.equal(tab!.order, 7);
    assert.deepEqual(tab!.label, { zh: '手帐', en: 'Notebook' });
    assert.ok(tab!.order < slots.JOURNAL_BUILTIN_ORDER.cards);
    assert.ok(slots.overlays.get('e-shop') && slots.overlays.get('e-ticket'));
  } finally { off(); }
  assert.equal(slots.journalTabs.get('notebook'), undefined, 'gone with the feature');
});

test('W5-E5 the notebook renders in node: the header, four pages, the stamps with their names, the page bar', async () => {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { registerHooks } = await import('node:module');
  const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
  const Notebook = (await import('../src/opus-bay/economy/Notebook')).default;
  styles.deregister();
  fresh();
  __setBayNowForTests('2026-09-28T12:00');
  N.checkNotebook(world({ arrived: id => id === 'coit-tower', pelican: true }), true);
  const html = renderToStaticMarkup(h(Notebook));
  assert.match(html, /旧金山 9月28日 周一/);
  assert.match(html, /明天可能不一样/);
  for (const p of ['印章', '小发现', '看风景', '足迹']) assert.match(html, new RegExp(`role="tab"[^>]*><span>${p}</span>`), p);
  assert.match(html, /<span>印章<\/span><small>2\/22<\/small>/);
  assert.match(html, /集满这一页：\+30 金币 · 邮戳相框/);
  assert.match(html, /ob-nb-disc is-on[^"]*"[^>]*>[^]*?科伊特塔/, 'Coit stamped');
  assert.doesNotMatch(html, /连续|签到/, 'never a streak');
  __setBayNowForTests(null);
});
