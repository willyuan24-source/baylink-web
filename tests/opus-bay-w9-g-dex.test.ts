import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 9 · lane G · W9-G1 / W9-G2 · the 游乐图鉴 (review 2026-10-01 R§5 #13 "约 22 个小游戏没有目录，地图没有「玩」的筛选"):
 * the data (ui/playDexData.ts) against the games' own prompts, the nearest-three helper, medals / played from a save, the
 * journal tab and BAYBAY's 附近能玩什么？ (play/dexEntry.ts), the map's 玩 chip and pins (ui/mapFilterRules.ts,
 * ui/mapGames.tsx), and every spot reachable on the city's own ground (the goTo snap within its 40 u, the prompt in reach).
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const dex = await import('../src/opus-bay/ui/playDexData');
const { BEST_ROWS } = await import('../src/opus-bay/economy/records');
const zones = await import('../src/opus-bay/play/zones');
const sc = await import('../src/opus-bay/play/stairCourses');
const sf = await import('../src/opus-bay/play/sfgames');
const sf8 = await import('../src/opus-bay/play/sfgames8');
const z3 = await import('../src/opus-bay/play/zones3');
const kz = await import('../src/opus-bay/play/kiteZone');
const cc = await import('../src/opus-bay/play/crookedCourses');
const cs = await import('../src/opus-bay/play/crestSpots');
const { ATTRACTIONS } = await import('../src/opus-bay/data/sf/attractions');
const rules = await import('../src/opus-bay/ui/mapFilterRules');

const near = (a: { x: number; z: number }, b: { x: number; z: number }, tol = 0.5) => Math.hypot(a.x - b.x, a.z - b.z) <= tol;
const game = (id: string) => { const g = dex.dexGame(id); assert.ok(g, id); return g!; };
const HAN = /[㐀-鿿]/;

test('W9-G1 dex: ≈ 22 games, unique ids, bilingual words, every group used, every kit best row listed', () => {
  assert.ok(dex.DEX_GAMES.length >= 22, `${dex.DEX_GAMES.length} games`);
  assert.equal(new Set(dex.DEX_GAMES.map(g => g.id)).size, dex.DEX_GAMES.length);
  for (const g of dex.DEX_GAMES) {
    assert.match(g.id, /^[a-z0-9][a-z0-9-]{0,30}$/, g.id);
    for (const id of dex.dexMedalIds(g)) assert.match(id, /^[a-z0-9][a-z0-9-]{0,30}$/, `${g.id} medal id ${id}`);
    for (const k of ['name', 'where', 'rule', 'clue'] as const) {
      assert.ok(g[k].zh.trim() && HAN.test(g[k].zh), `${g.id}.${k}.zh`);
      assert.ok(g[k].en.trim() && !HAN.test(g[k].en), `${g.id}.${k}.en has Chinese`);
      // (lane L's 「What’ s that?」: no space inside a contraction)
      assert.doesNotMatch(g[k].en, /’ [st](?![a-z])/, `${g.id}.${k}.en`);
    }
    if (g.needs) assert.ok(HAN.test(g.needs.zh) && !HAN.test(g.needs.en), `${g.id}.needs`);
    assert.ok(g.spots.length > 0 || g.start, `${g.id}: a spot or a start from anywhere`);
    assert.ok(dex.DEX_GROUPS.some(gr => gr.id === g.group), g.group);
  }
  for (const gr of dex.DEX_GROUPS) assert.ok(dex.DEX_GAMES.some(g => g.group === gr.id), `group ${gr.id} empty`);
  // every activity the notebook keeps a best for is in the guide, under the same id (its medals and best read the same keys)
  for (const r of BEST_ROWS) assert.ok(dex.DEX_GAMES.some(g => dex.dexMedalIds(g).includes(r.key)), `BEST_ROWS ${r.key} missing from the dex`);
  // and every activity started in play/ (startActivity ids) — the first flight is the story's, not a game of the list
  const ids = new Set(dex.DEX_GAMES.flatMap(g => dex.dexMedalIds(g)));
  const KNOWN = ['slides', 'stairs-filbert', 'stairs-tiled', 'stairs-lyon', 'hide-seek', 'bell', 'kite', 'skyline', 'claw', 'fortune', 'crab', 'sourdough', 'grip', 'busk', 'foghorn', 'marshmallow', 'heave', 'sealions', 'frisbee', 'beachball', 'sled', 'crooked-lombard', 'crooked-vermont', 'crests', 'ggb-rings'];
  for (const id of KNOWN) assert.ok(ids.has(id), `activity ${id} not in the dex`);
  // the names: the notebook's 我的记录 words for its rows, else the kit's activity names (the result card's)
  for (const r of BEST_ROWS) { const g = dex.dexGame(r.key); if (g) assert.ok(r.name.zh.startsWith(g.name.zh) && r.name.en.startsWith(g.name.en), r.key); }
  const same: [string, { zh: string; en: string }][] = [['slides', zones.SLIDES_NAME], ['marshmallow', z3.FIRE_NAME], ['heave', z3.HEAVE_NAME], ['sealions', z3.LION_NAME], ['frisbee', z3.FRISBEE_NAME], ['beachball', z3.BALL_NAME], ['sled', z3.SLED_NAME]];
  for (const [id, name] of same) assert.deepEqual(game(id).name, name, id);
});

test('W9-G1 dex: every spot is its game\'s own prompt point (≤ 0.5 u), so 带我去 ends at the game', () => {
  assert.ok(near(game('claw').spots[0], sf.CLAW_SPOT));
  assert.ok(near(game('fortune').spots[0], sf.FORTUNE_SPOT));
  assert.ok(near(game('crab').spots[0], sf.CRAB_SPOT));
  assert.ok(near(game('sourdough').spots[0], sf.DOUGH_SPOT));
  assert.ok(near(game('busk').spots[0], sf8.buskAt(sf8.BUSK_HAIGHT)));
  assert.ok(near(game('busk').spots[1], sf8.buskAt(sf8.BUSK_MISSION)));
  assert.ok(near(game('foghorn').spots[0], sf8.FOG_SPOT));
  assert.ok(near(game('sealions').spots[0], z3.LION_SPOT));
  assert.ok(z3.FIRE_RINGS.some(r => near(game('marshmallow').spots[0], r)), 'a burning ring');
  assert.ok(near(game('slides').spots[0], { x: zones.slidesIt.x, z: zones.slidesIt.z }));
  for (const c of sc.STAIR_COURSES) assert.ok(near(game(`stairs-${c.id}`).spots[0], sc.courseFoot(c)), c.id);
  for (const [i, c] of cc.CROOKED.entries()) assert.ok(near(game('crooked').spots[i], cc.crookedTop(c)), c.id);
  assert.equal(game('crests').spots.length, cs.CREST_SPOTS.length);
  cs.CREST_SPOTS.forEach((s, i) => assert.ok(near(game('crests').spots[i], s), s.id));
  // the cable-car games: the Powell & Market turntable's trip end
  const pm = ATTRACTIONS.find(a => a.id === 'cable-car-powell-market')!;
  for (const id of ['bell', 'grip', 'heave']) assert.ok(near(game(id).spots[0], pm.arrival ?? pm), id);
  // the kite: on lane W2's kite lawns (the ask item shows there)
  for (const s of game('kite').spots) assert.ok(kz.onKiteLawn(s), `kite spot ${s.x},${s.z} on a kite lawn`);
  // the Golden Gate rings: the bridge's viewpoint (a ground trip; the rings start gliding by)
  const ggb = ATTRACTIONS.find(a => a.id === 'golden-gate-bridge')!;
  assert.ok(near(game('ggb-rings').spots[0], ggb.arrival ?? ggb));
  // the anywhere games start from the guide
  assert.equal(game('hide-seek').start, 'hide-seek');
  assert.equal(game('skyline').start, 'skyline');
});

test('W9-G1 dex: the nearest three, medals and played from a save', () => {
  // at the Musée Mécanique: the claw, the fortune teller and the sourdough are the three nearest
  const at = { x: -205.9, z: 73.9 };
  const n = dex.nearestGames(at, 3);
  assert.deepEqual(n.map(x => x.game.id).sort(), ['claw', 'fortune', 'sourdough']);
  assert.ok(n[0].d <= n[1].d && n[1].d <= n[2].d);
  // a game with several spots counts its nearest (the busker on 24th St from the Mission)
  const b = dex.nearestSpot(game('busk'), { x: 450, z: 640 })!;
  assert.ok(near(b.spot, game('busk').spots[1]));
  // anywhere games are not "nearest"
  assert.ok(!dex.nearestGames({ x: 0, z: 0 }, 30).some(x => x.game.spots.length === 0));
  // medals: the best tier paid under any of the row's ids
  const paid = new Set(['medal:crooked-vermont:1', 'medal:crooked-vermont:2', 'medal:claw:1']);
  const isPaid = (s: string) => paid.has(s);
  assert.equal(dex.dexMedal(game('crooked'), isPaid), 2);
  assert.equal(dex.dexMedal(game('claw'), isPaid), 1);
  assert.equal(dex.dexMedal(game('crab'), isPaid), 0);
  // played: a medal, a best, or the game's own key (the fortune teller pays no medal)
  assert.equal(dex.dexPlayed(game('claw'), {}, isPaid), true);
  assert.equal(dex.dexPlayed(game('crab'), { crab: 40 }, () => false), true);
  assert.equal(dex.dexPlayed(game('fortune'), { 'fortune-n': 2 }, () => false), true);
  assert.equal(dex.dexPlayed(game('fortune'), {}, () => false), false);
  assert.equal(dex.dexPlayed(game('crab'), { crab: Number.NaN }, () => false), false);
});

test('W9-G2 map: the 玩 chip (after 必看), its pins (one per spot, unique keys), the places dim, a pin\'s trip ends at the point', async () => {
  assert.ok((rules.MAP_FILTER_IDS as readonly string[]).includes('play'));
  const ids = rules.MAP_FILTERS.map(f => f.id);
  assert.equal(ids.indexOf('play'), ids.indexOf('must') + 1);
  assert.deepEqual(rules.filterAttraction('play', { cat: 'park', rank: 1 }), { show: true, alpha: 0.4, label: true });
  assert.deepEqual(rules.filterAttraction('play', { cat: 'museum', rank: 2 }), { show: true, alpha: 0.25, label: false });
  assert.deepEqual(rules.filterLines('play'), { lines: 'dim', stations: false });
  const mem = new Map<string, string>();
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
  rules.saveMapFilter('play', store);
  assert.equal(rules.loadMapFilter(store), 'play');
  const pins = dex.gamePins();
  assert.equal(pins.length, dex.DEX_GAMES.reduce((n, g) => n + g.spots.length, 0));
  assert.equal(new Set(pins.map(p => p.key)).size, pins.length);
  // the goTo target is a synthetic id (never an attraction / a place: resolveGoToTarget then takes the point)
  const { resolveGoToTarget } = await import('../src/opus-bay/game/goToRun');
  const claw = game('claw');
  const dest = resolveGoToTarget(dex.gameGoTarget(claw, claw.spots[0]), {
    attraction: id => (ATTRACTIONS.find(a => a.id === id) as never) ?? undefined, place: () => undefined, interactable: () => undefined,
  });
  assert.ok(dest && near(dest, claw.spots[0], 1e-6), 'the trip ends at the claw, not the Musée\'s arrival');
  assert.deepEqual(dest!.name, claw.name);
});

test('W9-G1 entry: the journal tab 游乐 (order 9) counts the games played, 问 BAYBAY → 附近能玩什么？ opens it', async () => {
  const slots = await import('../src/opus-bay/ui/slots');
  const entry = await import('../src/opus-bay/play/dexEntry');
  const off = entry.initDex();
  try {
    const tab = slots.journalTabs.get(entry.DEX_TAB)!;
    assert.ok(tab, 'tab registered');
    assert.equal(tab.order, 9);
    assert.deepEqual(tab.label, { zh: '游乐', en: 'Play' });
    assert.match(tab.count!()!, new RegExp(`^\\d+/${dex.DEX_GAMES.length}$`));
    const ask = slots.askItems.get(entry.DEX_ASK)!;
    assert.ok(ask, 'ask item registered');
    assert.deepEqual(ask.label, { zh: '附近能玩什么？', en: 'What can I play nearby?' });
    const seq = slots.lastJournalRequest().seq;
    assert.equal(slots.runAskItem(entry.DEX_ASK), true);
    assert.equal(slots.lastJournalRequest().seq, seq + 1);
    assert.equal(slots.lastJournalRequest().tab, entry.DEX_TAB);
  } finally { off(); }
  assert.equal(slots.journalTabs.get(entry.DEX_TAB), undefined);
  assert.equal(slots.askItems.get(entry.DEX_ASK), undefined);
  // the play core loads it (and the emote coach, moved into the pet chunk) lazily, through importRetry
  const core = fs.readFileSync(path.join(ROOT, 'src/opus-bay/play/index.ts'), 'utf8');
  assert.match(core, /importRetry\(\(\) => import\('\.\/dexEntry'\)\)/);
  assert.match(core, /m\.startEmoteCoach\(\)/);
  assert.doesNotMatch(core, /emote-coach/);
  const pet = fs.readFileSync(path.join(ROOT, 'src/opus-bay/play/pet.ts'), 'utf8');
  assert.match(pet, /'opus-bay:play:emote-coach:v1'/);
  // the guide's body is lazy: only the tab's load imports ui/PlayDex
  assert.match(fs.readFileSync(path.join(ROOT, 'src/opus-bay/play/dexEntry.ts'), 'utf8'), /importRetry\(\(\) => import\('\.\.\/ui\/PlayDex'\)\)/);
});

test('W9-G1 dex: on the city\'s own ground every spot snaps (goTo: within 40 u) to a point in its game\'s reach', async () => {
  const T = await import('../src/opus-bay/core/terrain');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const disk = sfDisk();
  const LMS = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(disk.manifest, { landmarks: LMS });
  city.setFar(await disk.far());
  const pins = dex.gamePins();
  for (const p of pins) await disk.attachAround(city, p.at.x, p.at.z, 24, LMS);
  T.setCityTerrain(city, { heroDropLots: new Set(disk.manifest.heroDropLots) });
  // how close the trip's end must be: the game's prompt radius (the crests and the crooked tops are ridden into: their own
  // reach; the ask games: the surface is what matters)
  const REACH: Record<string, number> = { claw: 1.8, fortune: 1.6, crab: 1.6, sourdough: 1.6, busk: 1.5, foghorn: 1.5, sealions: 2.6, marshmallow: 2.2, slides: 1.8, 'stairs-filbert': 2.4, 'stairs-tiled': 2.4, 'stairs-lyon': 2.4, crests: cs.CREST_R, crooked: 5 };
  const bad: string[] = [];
  for (const p of pins) {
    const snap = T.canStand(p.at.x, p.at.z) ? p.at : T.nearestWalkable(p.at, 40);
    if (!snap) { bad.push(`${p.key}: no ground within 40 u`); continue; }
    const d = Math.hypot(snap.x - p.at.x, snap.z - p.at.z), r = REACH[p.game.id] ?? 6;
    if (d > r) bad.push(`${p.key}: the trip ends ${d.toFixed(1)} u from the game (reach ${r})`);
  }
  // the ask games' surfaces (the ask item shows only there)
  for (const s of game('frisbee').spots) assert.ok(['grass', 'sand', 'dirt'].includes(T.surfaceAt(s.x, s.z) ?? ''), `frisbee ${s.x},${s.z}`);
  for (const s of game('beachball').spots) assert.equal(T.surfaceAt(s.x, s.z), 'sand');
  for (const s of game('sled').spots) assert.ok(z3.sledOffer(s.x, s.z), `a slide starts at ${s.x},${s.z}`);
  assert.deepEqual(bad, []);
});
