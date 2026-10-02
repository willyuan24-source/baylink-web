import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { sfDisk } from './opus-bay-sf-disk';

/**
 * Wave 9 · lane L · the map search (R§5 #11 + lane L (1)): 繁體 queries find what their Simplified spelling finds (the
 * input's own examples and the 4 chips first: they all said 沒找到 on the live build, planner/shots/035–036), the games
 * and the season's events are found by their words (crab / 螃蟹 / 釣螃蟹 → 捞螃蟹 at Pier 7, never "UC Law" for claw),
 * and every game's point is the play module's own.
 */

const { ATTRACTIONS } = await import('../src/opus-bay/data/sf/attractions');
const { applyW4Places } = await import('../src/opus-bay/data/sf/extraPlaces');
const { prepareSearch, rankSearch, groupHits, attractionEntries, lineEntries, stationEntries, placeEntries, spotEntries, SEARCH_SUGGESTIONS, normalizeSearch } = await import('../src/opus-bay/data/sf/placeSearch');
const { PLAY_SPOTS, TREAT_SPOTS, searchSpots, calendarSpots, dateWords } = await import('../src/opus-bay/data/sf/searchSpots');
const { LINE_STYLES, mapStations } = await import('../src/opus-bay/ui/mapLines');
const { setLocale, translateText } = await import('../src/i18n/locale');

const sf = sfDisk();
const places = JSON.parse(fs.readFileSync(path.join(sf.base, 'places.json'), 'utf8')) as import('../src/opus-bay/world/sf/format').PlacesFile;
function transitLines(): import('../src/opus-bay/world/sf/format').TransitLine[] {
  const main = JSON.parse(fs.readFileSync(path.join(sf.base, 'transit.json'), 'utf8')) as { lines: import('../src/opus-bay/world/sf/format').TransitLine[] };
  const inMain = main.lines.filter(l => l.kind === 'bus' || l.kind === 'light-rail');
  if (inMain.length) return inMain;
  return (JSON.parse(fs.readFileSync(path.join(sf.base, 'transit-w4.json'), 'utf8')) as { lines: import('../src/opus-bay/world/sf/format').TransitLine[] }).lines;
}

/** 15 October 2026, noon (Bay): inside the Halloween season */
const OCT_15 = new Date('2026-10-15T19:00:00Z');
/** 10 November 2026: the season and the festival are over */
const NOV_10 = new Date('2026-11-10T20:00:00Z');

function index(now = OCT_15) {
  const covered = new Set(ATTRACTIONS.map(a => a.placeId ?? a.id));
  const rows = applyW4Places(places);
  return prepareSearch([
    ...attractionEntries(ATTRACTIONS), ...lineEntries(Object.values(LINE_STYLES)), ...stationEntries(mapStations(transitLines())),
    ...placeEntries(rows.filter(r => !(r as { station?: unknown }).station), covered), ...spotEntries(searchSpots(now)),
  ]);
}
const ix = index();
const ids = (q: string, n = 8) => rankSearch(ix, q, n).map(h => h.entry.id);
const hant = (s: string) => translateText(s, 'zh-Hant');

test('W9-L 繁體 search: the input\'s examples, the 4 chips and the review\'s queries find what their Simplified spelling finds', async () => {
  await setLocale('zh-Hant', false);
  // the converter is loaded: these are the strings a zh-Hant player sees and types
  assert.equal(hant('金门大桥'), '金門大橋');
  assert.equal(normalizeSearch('金門大橋'), normalizeSearch('金门大桥'));
  assert.equal(normalizeSearch('N 線'), 'n线');
  // the placeholder 搜地方：金门大桥、大学、N 线… and the empty state's chips
  for (const w of ['金门大桥', '大学', 'N 线', ...SEARCH_SUGGESTIONS.map(s => s.zh)]) {
    const tw = hant(w);
    assert.notEqual(tw === w && /[门学线镇]/.test(w), true, `${w} converts`);
    const got = ids(tw, 5);
    assert.ok(got.length > 0, `${tw}: 沒找到`);
    assert.deepEqual(got, ids(w, 5), `${tw} ranks as ${w}`);
  }
  // the planner's list (planner/q-search.js): every one found, the obvious ones first
  const first: Record<string, string> = { 金門大橋: 'golden-gate-bridge', 漁人碼頭: 'fishermans-wharf', 雙峰: 'twin-peaks', 惡魔島: 'alcatraz', 市政廳: 'city-hall', 唐人街: 'chinatown-dragon-gate', 中國城: 'chinatown-dragon-gate', 'N 線': 'n-judah' };
  for (const q of ['金門大橋', '博物館', '美術館', '科學館', '亞洲藝術', '唐人街', '中國城', '纜車', '叮噹車', 'N 線', '惡魔島', '公園', '金門公園', '市政廳', '動物園', '漁人碼頭', '雙峰']) {
    const got = ids(q, 5);
    assert.ok(got.length > 0, `${q}: 沒找到`);
    if (first[q]) assert.equal(got[0], first[q], q);
  }
  // a category word in 繁體 is the category (博物館 = every museum)
  assert.ok(rankSearch(ix, '博物館', 30).filter(h => h.match === 'category').length >= 5);
});

test('W9-L the games: crab / claw / foghorn / busker / kite / sourdough / fortune land on the game, in zh, 繁體 and en', async () => {
  await setLocale('zh-Hant', false);
  const want: [string, string[]][] = [
    ['crab', ['crab', 'crabbing', '螃蟹', '捞螃蟹', '钓螃蟹', '釣螃蟹', '撈螃蟹']],
    ['claw', ['claw', 'claw machine', '抓娃娃', '夹娃娃', '夾娃娃', '娃娃机', '娃娃機']],
    ['foghorn', ['foghorn', 'fog horn', '雾笛', '霧笛']],
    ['kite', ['kite', '风筝', '風箏', '放风筝', '放風箏']],
    ['sourdough', ['sourdough', '酸面包', '酸麵包', '捏酸面包']],
    ['fortune', ['fortune', 'fortune teller', '算命', '算一卦']],
    ['sealions', ['sea lions', '数海狮', '數海獅']],
    ['marshmallow', ['marshmallow', '棉花糖', '篝火']],
    ['hide-seek', ['hide and seek', '捉迷藏']],
  ];
  for (const [id, qs] of want) for (const q of qs) {
    const hits = rankSearch(ix, q, 10);
    const g = groupHits(hits);
    assert.equal(g[0]?.group, 'play', `${q}: the games first (${g.map(x => x.group).join(' ')})`);
    assert.equal(g[0].hits[0].entry.id, id, `${q} → ${g[0].hits[0].entry.id}`);
  }
  for (const q of ['busker', '街头艺人', '街頭藝人', '弹吉他']) assert.deepEqual(ids(q, 2).sort(), ['busk-haight', 'busk-mission'], q);
  for (const q of ['台阶赛跑', 'stair race']) assert.ok(ids(q, 3).every(id => id.startsWith('stairs-')), q);
  // "claw" is never UC Law (the old substring across "UC Law"); "law" still finds it
  assert.ok(!ids('claw', 30).includes('uc-law-sf'));
  assert.ok(ids('law', 10).includes('uc-law-sf'));
  // a game never pushes a sight down when the sight is what was asked: 金门大桥 → the bridge first
  assert.equal(groupHits(rankSearch(ix, '金门大桥', 30))[0].group, 'attraction');
  assert.equal(ids('金门大桥', 1)[0], 'golden-gate-bridge');
  assert.equal(ids('Musée Mécanique', 1)[0], 'musee-mecanique');
  // every game spot is found by its own name (zh and en) and every alias
  for (const s of PLAY_SPOTS) {
    for (const q of [s.name.zh, s.name.en, ...s.aliases]) assert.ok(ids(q, 40).includes(s.id), `"${q}" does not find ${s.id}`);
  }
});

test('W9-L the season\'s events: 万圣 / 萬聖 / Halloween / 讨糖 find the six treat streets and the Chinatown festival in October only', () => {
  for (const q of ['万圣', '萬聖', '万圣节', 'Halloween', 'halloween', '讨糖', '討糖', 'trick or treat']) {
    const g = groupHits(rankSearch(ix, q, 30));
    const ev = g.find(x => x.group === 'event')?.hits.map(h => h.entry.id) ?? [];
    assert.equal(g[0]?.group, 'event', `${q}: the events first`);
    for (const s of TREAT_SPOTS) assert.ok(ev.includes(s.id), `${q} → ${s.id}`);
    if (q !== '讨糖' && q !== '討糖' && q !== 'trick or treat') assert.ok(ev.includes('cal:chinatown-halloween-festival-2026'), `${q} → the festival`);
  }
  // 10 November: the streets are packed away, the festival is over, the 2027 rows are not "ahead" yet
  const late = prepareSearch(spotEntries(searchSpots(NOV_10)));
  assert.equal(rankSearch(late, '讨糖', 30).filter(h => h.entry.group === 'event').length, 0);
  assert.ok(!rankSearch(late, 'halloween', 30).some(h => h.entry.id === 'cal:chinatown-halloween-festival-2026'));
  // the calendar rows: only visible ones with a place, from today through 60 days
  const oct = calendarSpots('2026-10-01');
  assert.ok(oct.some(s => s.id === 'cal:fleet-week-parade-of-ships-2026'));
  assert.ok(oct.every(s => s.at || s.go));
  assert.ok(!oct.some(s => s.id.includes('2027')));
  assert.deepEqual(dateWords('2026-10-31', '2026-10-31'), { zh: '10 月 31 日', en: '31 Oct' });
  assert.deepEqual(dateWords('2026-10-09', '2026-10-11'), { zh: '10 月 9–11 日', en: '9–11 Oct' });
});

test('W9-L every game\'s point is its play module\'s own (the map chunk keeps a copy)', async () => {
  const { CLAW_SPOT, FORTUNE_SPOT, CRAB_SPOT, DOUGH_SPOT } = await import('../src/opus-bay/play/sfgames');
  const { FOG_SPOT, BUSK_HAIGHT, BUSK_MISSION, buskAt } = await import('../src/opus-bay/play/sfgames8');
  const { slidesIt, stairsIts } = await import('../src/opus-bay/play/zones');
  const { LION_SPOT, FIRE_RINGS } = await import('../src/opus-bay/play/zones3');
  const { MARINA_STRIP } = await import('../src/opus-bay/play/kiteZone');
  const { TREAT_DOORS } = await import('../src/opus-bay/halloween/treatDoors');
  const { KNOCK_OUT, TREAT_STREETS } = await import('../src/opus-bay/halloween/treatStreets');
  const by = new Map(PLAY_SPOTS.map(s => [s.id, s]));
  const near = (id: string, p: { x: number; z: number }, r = 0.02) => {
    const s = by.get(id) ?? TREAT_SPOTS.find(t => t.id === id);
    assert.ok(s?.at, id);
    assert.ok(Math.hypot(s.at.x - p.x, s.at.z - p.z) <= r, `${id} at ${s.at.x}, ${s.at.z} ≠ ${p.x}, ${p.z}`);
  };
  near('claw', CLAW_SPOT); near('fortune', FORTUNE_SPOT); near('crab', CRAB_SPOT); near('sourdough', DOUGH_SPOT);
  near('foghorn', FOG_SPOT); near('busk-haight', buskAt(BUSK_HAIGHT)); near('busk-mission', buskAt(BUSK_MISSION));
  near('slides', slidesIt); near('sealions', LION_SPOT); near('marshmallow', FIRE_RINGS[0]);
  near('kite', { x: (MARINA_STRIP.a.x + MARINA_STRIP.b.x) / 2, z: (MARINA_STRIP.a.z + MARINA_STRIP.b.z) / 2 });
  for (const it of stairsIts) near(`stairs-${it.id.split(':')[2]}`, it);
  // goTo resolves a `play:` id as an interactable: the ids are the registered ones
  const itIds = new Set(['play:claw', 'play:fortune', 'play:crab', 'play:sourdough', 'play:foghorn', 'play:busk-haight', 'play:busk-mission', 'play:slides', 'play:sealions', `play:fire:${FIRE_RINGS[0].k}`, ...stairsIts.map(i => i.id)]);
  for (const s of PLAY_SPOTS) if (s.go?.startsWith('play:')) assert.ok(itIds.has(s.go), s.go);
  for (const s of PLAY_SPOTS) if (s.go && !s.go.startsWith('play:')) assert.ok(ATTRACTIONS.some(a => a.id === s.go), s.go);
  // the treat streets: the street's first standing door's knock spot
  for (const st of TREAT_STREETS) {
    const d = TREAT_DOORS.find(x => x.street === st.id && !x.gone)!;
    near(`treat-${st.id}`, { x: d.x + Math.sin(d.f) * KNOCK_OUT, z: d.z + Math.cos(d.f) * KNOCK_OUT }, 0.02);
  }
});

test('W9-L the 小游戏 chip and the words for "a game" / "a festival" list every game / every event ahead (zh, 繁體, en)', async () => {
  await setLocale('zh-Hant', false);
  // the empty state's new chip (between 金门大桥 and 大学): 小游戏 / games, typed or tapped, in either script
  assert.ok(SEARCH_SUGGESTIONS.some(s => s.zh === '小游戏' && s.en === 'games'));
  const games = PLAY_SPOTS.map(s => s.id).sort();
  for (const q of ['小游戏', hant('小游戏'), '游戏', '玩什么', '好玩', 'games', 'game', 'minigames', 'play']) {
    const g = groupHits(rankSearch(ix, q, 60));
    assert.equal(g[0]?.group, 'play', `${q}: the games first (${g.map(x => x.group).join(' ')})`);
    assert.deepEqual(g[0].hits.map(h => h.entry.id).sort(), games, `${q}: every game`);
  }
  // the events ahead (15 Oct: the six streets + the calendar rows within 60 days)
  const events = searchSpots(OCT_15).filter(s => s.group === 'event').map(s => s.id).sort();
  assert.ok(events.length >= 7);
  for (const q of ['节日', '節日', '节日活动', '庆典', '慶典', 'festival', 'festivals', 'events']) {
    const g = groupHits(rankSearch(ix, q, 60));
    assert.equal(g[0]?.group, 'event', `${q}: the events first`);
    assert.deepEqual(g[0].hits.map(h => h.entry.id).sort(), events, `${q}: every event`);
  }
  // a word that is a name keeps its name: "playland" is not every game, 金门大桥 is still the bridge
  assert.notEqual(groupHits(rankSearch(ix, 'playland', 30))[0]?.hits.length, games.length);
  assert.equal(ids('金门大桥', 1)[0], 'golden-gate-bridge');
});
