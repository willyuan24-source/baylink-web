import assert from 'node:assert/strict';
import test from 'node:test';

// Wave 5 · lane D (W5-D1…D3) · the easter eggs (小发现): the registry (append-only ids, riddles, verified facts, short
// lines), the spots in the published city, and (below) the hosts, the date gates and the first twelve eggs.

// --- headless canvas stub (world modules create label atlases at import time; same as the content tests) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const R = await import('../src/opus-bay/eggs/registry');
const { EGGS, EGG_IDS, EGG_AREAS, EGG_AREA_NAMES, EGG_COINS, EGGS_VERIFIED_AT, FORTUNES, FORTUNE_SOURCES, eggById, eggIndex, eggRewardSource, eggsInArea, eggSpots } = R;
const { REWARD_SOURCE, rewardPrefix } = await import('../src/opus-bay/core/events');
const { MAX_PLAY_BITS } = await import('../src/opus-bay/data/playSave');

const zhLen = (s: string) => [...s].length;
const hasZh = (s: string) => /[一-鿿]/.test(s);
const bilingual = (b: { zh: string; en: string }, where: string) => {
  assert.ok(b.zh.trim() && b.en.trim(), `${where}: both languages`);
  assert.ok(hasZh(b.zh), `${where}: zh has Chinese`);
  assert.ok(!hasZh(b.en), `${where}: en has no Chinese`);
};

/** The append-only order (plan sf-w5-plan.md §3.1 table): bit i of play.g.egg. A new egg is appended, never inserted. */
const BATCH_1 = [
  'telegraph-hill-parrots', 'pier39-sea-lion-season', 'musee-laughing-lady', 'chinatown-telephone-exchange', 'fortune-cookie-trail',
  'emperor-norton-bridge-decree', 'wave-organ-high-tide', 'crissy-field-dusk-landing', 'baybay-otter-roots', 'octagon-house-time-capsule',
  'alcatraz-pelican-island', 'ggb-foghorn-duet', 'golden-gate-humpback', 'lands-end-labyrinth', 'china-beach-fishermen', 'dahlia-dell-100',
  'tiled-steps-sea-to-stars', 'karl-the-fog-diary', 'ingleside-sundial-real-time', 'golden-hydrant-1906', 'castro-rainbow-steps',
  'herons-head-from-above', 'sf-250-birthday-trail', 'alta-plaza-chipped-steps',
];

test('W5-D1 registry: the 24 ids are append-only (bit i of play.g.egg), numbered 1–24, each a well-formed reward source', () => {
  assert.deepEqual(EGG_IDS.slice(0, BATCH_1.length), BATCH_1, 'batch 1 keeps its order (a later batch appends)');
  assert.equal(new Set(EGG_IDS).size, EGG_IDS.length, 'unique ids');
  assert.ok(EGG_IDS.length <= MAX_PLAY_BITS, 'fits the play bitset');
  EGGS.forEach((e, i) => {
    assert.equal(e.n, i + 1, `${e.id}: n`);
    assert.equal(eggIndex(e.id), i);
    assert.equal(eggById(e.id), e);
    assert.match(e.id, /^[a-z0-9-]{3,40}$/);
    const source = eggRewardSource(e.id);
    assert.ok(REWARD_SOURCE.test(source), source);
    assert.equal(rewardPrefix(source), 'egg');
  });
  assert.equal(eggIndex('nope'), -1);
  assert.equal(EGG_COINS, 10);
});

test('W5-D1 registry: every egg has a verified https source (verifiedAt), bilingual text, a riddle ≤ 20, a 听说 rumour and lines ≤ 45 in zh', () => {
  assert.match(EGGS_VERIFIED_AT, /^2026-\d{2}-\d{2}$/);
  for (const e of EGGS) {
    bilingual(e.name, `${e.id} name`);
    bilingual(e.riddle, `${e.id} riddle`);
    assert.ok(zhLen(e.riddle.zh) <= 20, `${e.id}: riddle ≤ 20 (${zhLen(e.riddle.zh)})`);
    bilingual(e.rumour, `${e.id} rumour`);
    assert.ok(e.rumour.zh.startsWith('听说') && zhLen(e.rumour.zh) <= 45, `${e.id}: rumour 听说… ≤ 45 (${zhLen(e.rumour.zh)})`);
    assert.ok(/^They say /.test(e.rumour.en), `${e.id}: rumour en`);
    bilingual(e.how, `${e.id} how`);
    bilingual(e.stamp, `${e.id} stamp`);
    assert.ok(e.lines.length >= 1, `${e.id}: at least one line`);
    e.lines.forEach((l, i) => {
      bilingual(l, `${e.id} line ${i}`);
      assert.ok(zhLen(l.zh) <= 45, `${e.id} line ${i}: ≤ 45 in zh (${zhLen(l.zh)})`);
      assert.ok(l.en.length <= 110, `${e.id} line ${i}: en ≤ 110 (${l.en.length})`);
    });
    bilingual(e.fact, `${e.id} fact`);
    assert.ok(zhLen(e.fact.zh) <= 80 && e.fact.en.length <= 200, `${e.id}: the fact fits the card (${zhLen(e.fact.zh)} / ${e.fact.en.length})`);
    assert.ok(e.sources.length >= 1, `${e.id}: a source`);
    for (const s of e.sources) {
      assert.match(s.url, /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}\//, `${e.id}: https source`);
      assert.match(s.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(s.verifiedAt <= '2026-12-31' && s.verifiedAt >= '2026-09-27', `${e.id}: checked during wave 5`);
    }
    // wording rules (VOICE.md, plan D22–D24): no 硬币, no 彩蛋 in the player's words, no "the steepest", no feeding prompts
    const all = [e.name.zh, e.riddle.zh, e.rumour.zh, e.how.zh, e.fact.zh, ...e.lines.map(l => l.zh)].join(' ');
    assert.ok(!/硬币|彩蛋|最陡|喂它们吧|疯/.test(all), `${e.id}: wording`);
  }
  // the colonial-history egg always carries the Ohlone line; the Alcatraz egg speaks of the occupation respectfully
  assert.ok(eggById('sf-250-birthday-trail')!.lines.some(l => l.zh.includes('奥隆尼')), 'SF 250 pairs 1776 with the Ohlone');
  assert.ok(eggById('alcatraz-pelican-island')!.lines.some(l => l.zh.includes('原住民')), 'Alcatraz: the occupation line');
  // hedged where the sources hedge
  for (const id of ['fortune-cookie-trail', 'china-beach-fishermen', 'crissy-field-dusk-landing']) assert.ok(eggById(id)!.lines[0].zh.includes('据说'), `${id}: 据说`);
  assert.ok(eggById('golden-gate-humpback')!.lines[0].zh.includes('看缘分'), 'wildlife never guaranteed');
});

test('W5-D1 registry: every one of the eight areas (plan MF8) has at least one egg, and the fortunes are short and sourced', () => {
  for (const a of EGG_AREAS) {
    assert.ok(eggsInArea(a).length >= 1, `${a}: an egg`);
    assert.ok(EGG_AREA_NAMES[a].zh && EGG_AREA_NAMES[a].en, `${a}: name`);
  }
  assert.equal(EGGS.filter(e => !EGG_AREAS.includes(e.area)).length, 0);
  assert.ok(FORTUNES.length >= 7);
  for (const f of FORTUNES) { bilingual(f, 'fortune'); assert.ok(f.zh.startsWith('今日签：') && zhLen(f.zh) <= 45, f.zh); }
  assert.ok(FORTUNE_SOURCES.length >= 3 && FORTUNE_SOURCES.every(s => s.url.startsWith('https://')));
});

test('W5-D1 registry: every spot lies in the city bbox; ground spots stand in the published city (landmarks registered) and join its walking network', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { canStand, isWater, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const sf = sfDisk();
  const bb = sf.manifest.bbox;
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  for (const e of EGGS) for (const p of eggSpots(e)) await sf.attachAround(city, p.x, p.z, 16, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    const ix = await sf.graphIndex();
    for (const e of EGGS) {
      for (const p of eggSpots(e)) {
        assert.ok(p.x > bb.minX && p.x < bb.maxX && p.z > bb.minZ && p.z < bb.maxZ, `${e.id}: (${p.x}, ${p.z}) in the city bbox`);
        if (e.kind !== 'ground') continue;
        assert.ok(canStand(p.x, p.z), `${e.id}: (${p.x}, ${p.z}) standable`);
        assert.ok(!isWater(p.x, p.z), `${e.id}: not water`);
        // the Wave Organ's spit is walkable but has no graph node of its own (its tip is ≈ 25 u from the path)
        assert.ok(ix.nearestNode(p.x, p.z, e.id === 'wave-organ-high-tide' ? 40 : 20) >= 0, `${e.id}: a walking-graph node near (${p.x}, ${p.z})`);
      }
    }
  } finally { setCityTerrain(null); }
});

// ---------------------------------------------------------------------------------------------------------------
// W5-D2 · the hosts' kit: gates, props, flock, materials, reveal, beats
// ---------------------------------------------------------------------------------------------------------------

const { __setBayNowForTests, bayParts } = await import('../src/opus-bay/game/bayNow');
const gates = await import('../src/opus-bay/eggs/gates');
const P = await import('../src/opus-bay/eggs/props');
const H = await import('../src/opus-bay/eggs/hosts');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { game } = await import('../src/opus-bay/core/store');
const { onEvent } = await import('../src/opus-bay/core/events');
type GameEvent = import('../src/opus-bay/core/events').GameEvent;
const { TOY_DYN, TOY_INST } = await import('../src/opus-bay/world/materials');
const { lockHeld } = await import('../src/opus-bay/game/playerLock');
const { cinemaActive, stepCinema, skipCinema } = await import('../src/opus-bay/game/cinema');
const slots = await import('../src/opus-bay/ui/slots');
const ledger = await import('../src/opus-bay/economy/ledger');
const { clearSave } = await import('../src/opus-bay/data/save');

test('W5-D2 gates: months, a day window, the year, the ≈ 70 % day roll, sea-lion months and once-a-Bay-day — all on Bay time', () => {
  try {
    assert.ok(__setBayNowForTests('2026-04-18T05:30'));
    assert.ok(gates.onDay(4, 18, 5, 9));
    assert.ok(!gates.onDay(4, 18, 9, 12));
    assert.ok(gates.inMonths([4, 5, 6, 7, 8, 9, 10, 11]));
    assert.ok(gates.inYear(2026));
    assert.equal(gates.seaLionMonth(), 'home');
    __setBayNowForTests('2026-06-20T12:00');
    assert.equal(gates.seaLionMonth(), 'away');
    __setBayNowForTests('2026-08-02T12:00');
    assert.equal(gates.seaLionMonth(), 'returning');
    __setBayNowForTests('2026-12-01T12:00');
    assert.ok(!gates.inMonths([4, 5, 6, 7, 8, 9, 10, 11]), 'no humpbacks in December');
    // Bay time, not the machine's: 23:30 on 31 Oct in SF is already 1 Nov in UTC
    __setBayNowForTests('2026-10-31T23:30');
    assert.equal(bayParts().dateKey, '2026-10-31');
    assert.ok(gates.onDay(10, 31, 23, 24));
    // the labyrinth's day roll: present on ≈ 70 % of 365 days, stable per date
    let present = 0;
    const start = Date.UTC(2026, 0, 1);
    for (let d = 0; d < 365; d++) {
      const key = new Date(start + d * 86_400_000).toISOString().slice(0, 10);
      if (gates.presentToday('labyrinth', 0.7, key)) present++;
      assert.equal(gates.presentToday('labyrinth', 0.7, key), gates.presentToday('labyrinth', 0.7, key));
    }
    assert.ok(present >= 230 && present <= 280, `≈ 70 % of 365 days (${present})`);
    assert.notEqual(gates.dayRoll('a', '2026-10-01'), gates.dayRoll('a', '2026-10-02'));
    // once a Bay day (memory only in node)
    gates.__resetDailyForTests();
    assert.ok(!gates.usedToday('phone', '2026-10-01'));
    assert.ok(gates.markToday('phone', '2026-10-01'));
    assert.ok(!gates.markToday('phone', '2026-10-01'));
    assert.ok(gates.usedToday('phone', '2026-10-01') && !gates.usedToday('phone', '2026-10-02'));
  } finally { __setBayNowForTests(null); gates.__resetDailyForTests(); }
});

test('W5-D2 props: ≤ 200 triangles each; one mesh with only the props within range; downtown held; hidden (0 calls) when none is near', () => {
  for (const k of ['decree', 'tin', 'windsock', 'cookie'] as const) {
    const n = P.propTriangles(k);
    assert.ok(n > 0 && n <= 200, `${k}: ${n} triangles`);
  }
  const pool = new P.PropPool();
  pool.set('a', { kind: 'tin', x: -184.4, z: 290.7, y: 6 });
  pool.set('b', { kind: 'windsock', x: -558.5, z: 529.5, y: 0.2 });
  pool.set('down', { kind: 'decree', x: 240, z: 16, y: 0 });
  assert.equal(P.DOWNTOWN_PROPS_HELD, true);
  assert.ok(P.isDowntown(240, 16) && P.isDowntown(27, 134) && P.isDowntown(157, -21), 'Norton, Chinatown and the Ferry gate are downtown');
  assert.ok(!P.isDowntown(-30, 38) && !P.isDowntown(-184, 290), 'Telegraph Hill and Cow Hollow are not');
  assert.ok(!pool.has('down'), 'held downtown');
  pool.step(0, -180, 290);
  assert.deepEqual(pool.visibleKeys(), ['a']);
  assert.ok(pool.mesh.visible);
  const tris = (pool.mesh.geometry.getIndex()?.count ?? 0) / 3;
  assert.equal(tris, P.propTriangles('tin'));
  pool.step(1, 5000, 5000);
  assert.deepEqual(pool.visibleKeys(), []);
  assert.equal(pool.mesh.visible, false, 'no prop near: no draw call');
  pool.set('a', null);
  pool.dispose();
});

test('W5-D2 materials: our own instances, never TOY_DYN / TOY_INST themselves, on the SAME programs (cache key, flags) as the warm-up dummies', () => {
  const pool = new P.PropPool();
  const flock = new P.Flock();
  const pm = pool.mesh.material as import('three').MeshStandardMaterial;
  assert.notEqual(pm, TOY_DYN);
  assert.equal(pm.customProgramCacheKey(), TOY_DYN.customProgramCacheKey());
  assert.equal(pm.vertexColors, true);
  assert.equal(pool.mesh.receiveShadow, false, 'as the warm-up TOY_DYN dummy');
  // hidden, it still holds a real TOY geometry: the warm-up's live pass compiles hidden meshes, and an empty geometry
  // (no normals) would link a flat-shaded program of its own (seen in the browser: one extra program)
  for (const a of ['position', 'normal', 'color', 'aInfo']) assert.ok(pool.mesh.geometry.getAttribute(a), `idle geometry: ${a}`);
  assert.equal(pool.mesh.geometry.getAttribute('color').itemSize, 3, 'colour as TOY reads it (no vertex-alpha variant)');
  assert.equal(pool.mesh.castShadow, false);
  const birds = flock.group.children as import('three').InstancedMesh[];
  assert.equal(birds.length, 2);
  for (const b of birds) {
    const m = b.material as import('three').MeshStandardMaterial;
    assert.notEqual(m, TOY_INST);
    assert.equal(m.customProgramCacheKey(), TOY_INST.customProgramCacheKey());
    assert.equal(b.receiveShadow, true, 'as the warm-up TOY_INST dummy');
    assert.equal(b.castShadow, false);
    assert.equal(b.instanceColor, null, 'no instanceColor: the TOY_INST variant');
    assert.equal(b.visible, false, 'no flight: no draw call');
    assert.ok(b.geometry.getAttribute('aInfo'), 'TOY geometry carries aInfo');
  }
  // a flight shows one mesh for its length, then hides it
  flock.start('parrot', 12, 1, () => ({ x: 0, y: 5, z: 0, heading: 0, flap: 0 }));
  flock.step(0.1);
  assert.equal(birds[0].visible, true);
  assert.equal(birds[0].count, 12);
  assert.equal(birds[1].visible, false);
  flock.step(1);
  assert.equal(birds[0].visible, false);
  assert.equal(flock.active, null);
  pool.dispose(); flock.dispose();
});

test('W5-D2 reveal: the first find emits find + the egg reward once (the ledger pays 10), opens the card after the lines start; later finds are quiet', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const events: GameEvent[] = [];
  const off = onEvent(e => { if (e.type === 'find' || e.type === 'reward') events.push(e); });
  const offLedger = ledger.initLedger();
  const offIds = ledger.registerRewardIds('egg', EGG_IDS);
  const offCard = slots.registerOverlay({ id: 'egg-card', Component: () => null });
  try {
    clearSave();
    H.__resetHostsForTests();
    const before = ledger.coinsTotal();
    assert.equal(H.isFound('musee-laughing-lady'), false);
    assert.equal(H.reveal('musee-laughing-lady'), true);
    assert.deepEqual(events.filter(e => e.type === 'find'), [{ type: 'find', kind: 'egg', id: 'musee-laughing-lady', first: true }]);
    assert.deepEqual(events.filter(e => e.type === 'reward'), [{ type: 'reward', source: 'egg:musee-laughing-lady', coins: 10 }]);
    assert.equal(ledger.coinsTotal() - before, 10, 'lane E pays 10');
    assert.ok(ledger.isPaid('egg:musee-laughing-lady'));
    assert.ok(!slots.openOverlays().some(o => o.id === 'egg-card'), 'the card waits for the first line');
    t.mock.timers.tick(1700);
    const card = slots.openOverlays().find(o => o.id === 'egg-card');
    assert.deepEqual(card?.props, { id: 'musee-laughing-lady', coins: 10 });
    slots.closeOverlay('egg-card');
    // again: find (first: false), no reward, no card
    events.length = 0;
    assert.equal(H.reveal('musee-laughing-lady'), false);
    assert.deepEqual(events, [{ type: 'find', kind: 'egg', id: 'musee-laughing-lady', first: false }]);
    t.mock.timers.tick(3000);
    assert.ok(!slots.openOverlays().some(o => o.id === 'egg-card'));
    // found survives the session reset: it is the ledger's bit (play.g.egg, index 2)
    H.__resetHostsForTests();
    assert.ok(H.isFound('musee-laughing-lady'));
    assert.equal(H.reveal('not-an-egg'), false);
  } finally { off(); offLedger(); offIds(); offCard(); H.__resetHostsForTests(); clearSave(); }
});

test('W5-D2 beats: a camera beat plays only when the screen is free and always gives the feet back when it ends (MF1)', () => {
  const phase = game.get().phase;
  try {
    game.set({ phase: 'playing' });
    runtime.move.mode = 'foot';
    runtime.glide.active = false;
    let done = 0;
    assert.equal(H.beat([{ position: [0, 5, 10], target: [0, 1, 0], duration: 0.5, hold: 0.5 }], () => { done++; }), true);
    assert.ok(cinemaActive() && lockHeld(), 'held during the beat');
    for (let i = 0; i < 60 && cinemaActive(); i++) stepCinema(1 / 30);
    assert.equal(cinemaActive(), false);
    assert.equal(lockHeld(), false, 'released at the end');
    assert.equal(runtime.player.locked, false);
    assert.equal(done, 1);
    // skipped (Esc): released too
    H.beat([{ position: [0, 5, 10], target: [0, 1, 0], duration: 2 }]);
    stepCinema(1 / 30);
    skipCinema();
    assert.equal(lockHeld(), false);
    // not while gliding or riding
    runtime.glide.active = true;
    assert.equal(H.beat([{ position: [0, 5, 10], target: [0, 1, 0], duration: 1 }]), false);
    runtime.glide.active = false;
    runtime.move.mode = 'transit';
    assert.equal(H.beat([{ position: [0, 5, 10], target: [0, 1, 0], duration: 1 }]), false);
  } finally { runtime.move.mode = 'foot'; runtime.glide.active = false; game.set({ phase }); }
});

// ---------------------------------------------------------------------------------------------------------------
// W5-D3 · eggs 1–12: the hosts, their words, their triggers (simulated on the real host code)
// ---------------------------------------------------------------------------------------------------------------

// the card modules import their stylesheet: stub .css while loading (as tests/opus-bay-contracts.test.ts)
const { registerHooks } = await import('node:module');
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { makeHosts } = await import('../src/opus-bay/eggs/index');
const { FactCard, NoteCard, OperatorBubble } = await import('../src/opus-bay/eggs/FactCard');
styles.deregister();
const wharf = await import('../src/opus-bay/eggs/wharf');
const marina = await import('../src/opus-bay/eggs/marina');
const downtown = await import('../src/opus-bay/eggs/downtown');
const cookies = await import('../src/opus-bay/eggs/cookies');
const north = await import('../src/opus-bay/eggs/north');
const { KARL } = await import('../src/opus-bay/world/fogShader');
const { KARL_TIME } = await import('../src/opus-bay/world/sf/fog');

const shortZh = (b: { zh: string; en: string }, where: string) => { bilingual(b, where); assert.ok(zhLen(b.zh) <= 45, `${where}: ≤ 45 in zh (${zhLen(b.zh)})`); };

test('W5-D3 hosts: eggs 1–12 each have one host; prompts are find-source `egg:` ids with an act, within reach of their egg', () => {
  H.__resetHostsForTests();
  const hosts = makeHosts();
  try {
    assert.deepEqual(hosts.map(h => h.id).sort(), EGG_IDS.slice(0, 12).slice().sort());
    for (const h of hosts) {
      assert.ok(h.range > 0, `${h.id}: range`);
      assert.ok(typeof h.qa === 'function', `${h.id}: a QA trigger for the screenshots`);
      const egg = eggById(h.id)!;
      for (const it of h.interactables?.() ?? []) {
        assert.ok(it.id.startsWith(`egg:${h.id}`), it.id);
        assert.equal(it.source, 'find');
        assert.equal(typeof it.act, 'function');
        bilingual(it.verb, `${it.id} verb`);
        assert.ok(zhLen(it.verb.zh) <= 8, `${it.id}: a short button label`);
        const d = Math.min(...eggSpots(egg).map(s => Math.hypot(s.x - it.x, s.z - it.z)));
        assert.ok(d <= 3, `${it.id}: ${d.toFixed(1)} u from its egg`);
      }
    }
  } finally { for (const h of hosts) h.dispose?.(); }
});

test('W5-D3 words: month lines, operator replies, the notes and the cookie slips are short, bilingual and claim only what the sources say', () => {
  for (const [k, l] of Object.entries(wharf.SEA_LION_MONTH_LINES)) shortZh(l, `sea lions ${k}`);
  assert.ok(!/\d{2,}/.test(Object.values(wharf.SEA_LION_MONTH_LINES).map(l => l.zh).join('')), 'never a count');
  assert.deepEqual(Object.values(wharf.SEA_LION_LOUDNESS).every(v => v > 0 && v <= 1), true);
  for (const l of downtown.OPERATOR_REPLIES) shortZh(l, 'operator reply');
  for (const l of downtown.OPERATOR_CHOICES) shortZh(l, 'operator choice');
  for (const l of [downtown.NORTON_NOTE.title, ...downtown.NORTON_NOTE.lines, downtown.NORTON_NOTE.sign]) shortZh(l, 'Norton note');
  assert.ok(!/疯/.test(JSON.stringify(downtown.NORTON_NOTE)), 'affectionate, never "crazy"');
  for (const l of [marina.CAPSULE_NOTE.title, ...marina.CAPSULE_NOTE.lines, marina.CAPSULE_NOTE.sign]) shortZh(l, 'capsule note');
  assert.ok(marina.CAPSULE_NOTE.title.zh.includes('仿写'), 'the 1861 note says it is our own words');
  shortZh(cookies.TOMORROW_LINE, 'cookie tomorrow');
  assert.ok(cookies.TOMORROW_LINE.zh.includes('明天可能不一样'), 'no pressure: 明天可能不一样');
  // the slip is stable for a Bay date and a spot, one of the fortunes
  for (const spot of ['tea', 'ross'] as const) {
    const a = cookies.fortuneFor(spot, '2026-10-01');
    assert.equal(cookies.fortuneFor(spot, '2026-10-01'), a);
    assert.ok(FORTUNES.includes(a));
  }
  const week = new Set(Array.from({ length: 7 }, (_, i) => cookies.fortuneFor('tea', `2026-10-0${i + 1}`)));
  assert.ok(week.size >= 3, 'the slips change from day to day');
  const stats = marina.capsuleStats();
  assert.equal(stats.length, 4);
  for (const s of stats) { bilingual(s.label, 'capsule stat'); assert.match(s.value, /^\d+$/); }
});

test('W5-D3 Alcatraz: a full loop round the island (either way) closes; cutting across or leaving the band resets', () => {
  const c = new wharf.LoopCounter(0, 0, { min: 20, max: 200 });
  let closed = 0;
  for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2 * 1.02; if (c.step(Math.cos(a) * 80, Math.sin(a) * 80)) closed++; }
  assert.equal(closed, 1, 'one loop anticlockwise');
  c.reset();
  closed = 0;
  for (let i = 0; i <= 64; i++) { const a = -(i / 64) * Math.PI * 2 * 1.02; if (c.step(Math.cos(a) * 120, Math.sin(a) * 120)) closed++; }
  assert.equal(closed, 1, 'one loop clockwise');
  c.reset();
  // three quarters, then over the island (inside the band's hole): no loop
  for (let i = 0; i <= 48; i++) { const a = (i / 64) * Math.PI * 2; c.step(Math.cos(a) * 80, Math.sin(a) * 80); }
  c.step(0, 5);
  closed = 0;
  for (let i = 0; i <= 20; i++) { const a = Math.PI * 1.5 + (i / 64) * Math.PI * 2; if (c.step(Math.cos(a) * 80, Math.sin(a) * 80)) closed++; }
  assert.equal(closed, 0);
  // the island's own band keeps the loop round it: from the Wharf a loop is ≈ 60–230 u out
  assert.ok(wharf.LOOP_BAND.min >= 20 && wharf.LOOP_BAND.max <= 260);
});

test('W5-D3 foghorns: the real pattern (south 2 s on / 18 s off; mid-span 9 s, 1-2-1, 36 s), the deck test and Karl at the bridge', () => {
  const south: number[] = [], mid: number[] = [];
  for (let t = 0; t < 130; t += 0.1) {
    const s = marina.hornStarts(t === 0 ? -0.001 : t, t + 0.1);
    if (s.south) south.push(Math.round(t + 0.1));
    if (s.mid) mid.push(Math.round(t + 0.1));
  }
  assert.deepEqual(south, [0, 20, 40, 60, 80, 100, 120]);
  assert.deepEqual(mid, [9, 12, 49, 52, 89, 92, 129]);
  // on the deck: between the anchorages, on its width, up at deck height
  const M = { x: (marina.GGB.south.x + marina.GGB.north.x) / 2, z: (marina.GGB.south.z + marina.GGB.north.z) / 2 };
  assert.ok(marina.onDeck(M.x, 15.4, M.z));
  assert.ok(marina.onDeck(marina.GGB.south.x, 15.4, marina.GGB.south.z));
  assert.ok(!marina.onDeck(M.x, 1, M.z), 'in a boat under the span');
  assert.ok(!marina.onDeck(M.x + 20, 15.4, M.z - 20), 'off the deck');
  assert.ok(!marina.onDeck(-560, 15.4, 530), 'Crissy Field');
  // Karl: thick in the Gate in the morning and at golden hour, gone by day (district: never)
  const lvl = KARL.uKarl.value, a = KARL.uKarlA.value.clone();
  try {
    for (const [tod, want] of [['morning', true], ['golden', true], ['day', false], ['night', false]] as const) {
      const k = KARL_TIME[tod];
      KARL.uKarl.value = k.level;
      KARL.uKarlA.value.set(k.front, k.top, k.gate, k.gateLen);
      assert.equal(marina.fogAtBridge() >= marina.FOG_ON, want, `${tod}: ${marina.fogAtBridge().toFixed(2)}`);
    }
    KARL.uKarl.value = 0;
    assert.equal(marina.fogAtBridge(), 0);
  } finally { KARL.uKarl.value = lvl; KARL.uKarlA.value.copy(a); }
});

/** Step the hosts like the frame system for `seconds`. */
const run = (seconds: number, each?: (t: number) => void) => { for (let t = 0; t < seconds; t += 1 / 30) { each?.(t); H.stepHosts(1 / 30); } };

test('W5-D3 triggers: standing still with the parrots, watching the sea lions, BAYBAY at Fort Point, the deck in fog, a loop round Alcatraz, a dusk landing on Crissy Field', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const finds: string[] = [];
  const off = onEvent(e => { if (e.type === 'find' && e.first) finds.push(e.id); });
  const phase = game.get().phase, tod = game.get().timeOfDay;
  const lvl = KARL.uKarl.value, a = KARL.uKarlA.value.clone();
  clearSave();
  H.__resetHostsForTests();
  const stop = H.startHosts(makeHosts());
  const p = runtime.player, g = runtime.guide;
  const put = (x: number, z: number, y = 0) => { p.x = x; p.z = z; p.y = y; p.speed = 0; p.pathTarget = null; };
  try {
    game.set({ phase: 'playing', timeOfDay: 'morning' });
    runtime.move.mode = 'foot';
    // 1 · parrots: 4 s still in the stair garden → the flock perches, the find
    const parrots = eggById('telegraph-hill-parrots')!;
    put(parrots.at.x + 2, parrots.at.z);
    run(3);
    assert.ok(!finds.includes(parrots.id), 'not before 4 s');
    run(1.6);
    assert.ok(finds.includes(parrots.id), 'parrots found');
    assert.equal(H.flock.active, 'parrot');
    assert.ok(north.PARROTS_STILL.seconds === 4);
    run(14);
    assert.equal(H.flock.active, null, 'the flock leaves');
    // 2 · sea lions: 1.5 s at the rail
    const sea = eggById('pier39-sea-lion-season')!;
    put(sea.at.x, sea.at.z);
    run(2);
    assert.ok(finds.includes(sea.id), 'sea lions found');
    // 9 · Fort Point: BAYBAY beside you at the water
    const otter = eggById('baybay-otter-roots')!;
    put(otter.at.x, otter.at.z);
    g.x = otter.at.x + 3; g.z = otter.at.z;
    run(0.5);
    assert.ok(finds.includes(otter.id), 'otter roots found');
    // 12 · the deck in fog: both horns heard within 45 s
    const k = KARL_TIME.morning;
    KARL.uKarl.value = k.level; KARL.uKarlA.value.set(k.front, k.top, k.gate, k.gateLen);
    const deck = { x: -840, z: 529 };
    put(deck.x, deck.z, 15.4);
    assert.ok(marina.onDeck(deck.x, 15.4, deck.z));
    run(8);
    assert.ok(!finds.includes('ggb-foghorn-duet'), 'the south horn alone is not the duet');
    run(6);
    assert.ok(finds.includes('ggb-foghorn-duet'), 'the duet on the deck');
    KARL.uKarl.value = 0;
    // 11 · a loop round Alcatraz on the pelican
    const island = eggById('alcatraz-pelican-island')!;
    runtime.move.mode = 'glide';
    runtime.glide.active = true;
    put(island.at.x + 90, island.at.z, 30);
    run(8, tt => { const ang = (tt / 7.5) * Math.PI * 2 * 1.05; runtime.glide.x = island.at.x + Math.cos(ang) * 90; runtime.glide.z = island.at.z + Math.sin(ang) * 90; runtime.glide.y = 30; runtime.glide.heading = ang; p.x = runtime.glide.x; p.z = runtime.glide.z; });
    assert.ok(finds.includes(island.id), 'the loop round Alcatraz');
    assert.equal(H.flock.active, 'pelican', 'pelicans join');
    runtime.glide.active = false;
    runtime.move.mode = 'foot';
    // 8 · a glide landing on Crissy Field: only at dusk
    const crissy = eggById('crissy-field-dusk-landing')!;
    put(crissy.at.x, crissy.at.z);
    run(0.2);
    game.set({ timeOfDay: 'day' });
    emitLand(crissy.at.x + 5, crissy.at.z);
    t.mock.timers.tick(1000);
    assert.ok(!finds.includes(crissy.id), 'not at midday');
    game.set({ timeOfDay: 'golden' });
    emitLand(crissy.at.x + 5, crissy.at.z);
    t.mock.timers.tick(1000);
    assert.ok(finds.includes(crissy.id), 'landed before dusk');
    assert.ok(H.props.has('egg:crissy-field-dusk-landing'), 'the windsock stays');
  } finally {
    stop(); off(); H.__resetHostsForTests(); clearSave();
    KARL.uKarl.value = lvl; KARL.uKarlA.value.copy(a);
    runtime.move.mode = 'foot'; runtime.glide.active = false;
    game.set({ phase, timeOfDay: tod });
  }
});

const { emit } = await import('../src/opus-bay/core/events');
function emitLand(x: number, z: number) { emit({ type: 'glide:land', x, z }); }

test('W5-D3 prompts: the laughing lady, the ringing phone (once a Bay day until answered), the cookie (one a Bay day per spot), Norton, the Wave Organ, the tin', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const finds: string[] = [];
  const off = onEvent(e => { if (e.type === 'find' && e.first) finds.push(e.id); });
  const phase = game.get().phase;
  clearSave();
  gates.__resetDailyForTests();
  H.__resetHostsForTests();
  const hosts = makeHosts();
  const stop = H.startHosts(hosts);
  const offOverlays = ['egg-card', 'egg-note', 'egg-operator'].map(id => slots.registerOverlay({ id, Component: () => null }));
  const p = runtime.player;
  const put = (x: number, z: number) => { p.x = x; p.z = z; p.y = 0; p.speed = 0; };
  const prompt = (id: string) => hosts.flatMap(h => h.interactables?.() ?? []).find(i => i.id === id);
  try {
    __setBayNowForTests('2026-10-01T11:00');
    game.set({ phase: 'playing' });
    runtime.move.mode = 'foot';
    prompt('egg:musee-laughing-lady')!.act!();
    assert.ok(finds.includes('musee-laughing-lady'));
    // the phone rings only when you come by, and offers 接电话 while it rings
    const phone = eggById('chinatown-telephone-exchange')!;
    assert.equal(prompt('egg:chinatown-telephone-exchange'), undefined, 'silent from afar');
    put(phone.at.x + 6, phone.at.z);
    run(0.3);
    const answer = prompt('egg:chinatown-telephone-exchange');
    assert.ok(answer, 'it rings');
    answer!.act!();
    const op = slots.openOverlays().find(o => o.id === 'egg-operator');
    assert.ok(op, 'the operator asks 你找谁？');
    (op!.props as { onPick: (i: number) => void }).onPick(0);
    t.mock.timers.tick(4000);
    assert.ok(finds.includes('chinatown-telephone-exchange'));
    assert.ok(gates.usedToday('phone'), 'answered: not again today');
    put(0, 0); run(0.3); put(phone.at.x + 6, phone.at.z); run(0.3);
    assert.equal(prompt('egg:chinatown-telephone-exchange'), undefined, 'no second ring on the same Bay day');
    __setBayNowForTests('2026-10-02T11:00');
    put(0, 0); run(0.3); put(phone.at.x + 6, phone.at.z); run(0.3);
    assert.ok(prompt('egg:chinatown-telephone-exchange'), 'rings again the next day');
    // cookies: one a Bay day per spot
    prompt('egg:fortune-cookie-trail:tea')!.act!();
    assert.ok(finds.includes('fortune-cookie-trail'));
    assert.ok(gates.usedToday('cookie:tea') && !gates.usedToday('cookie:ross'));
    prompt('egg:fortune-cookie-trail:ross')!.act!();
    assert.ok(gates.usedToday('cookie:ross'));
    // Norton: the scroll note first; the find (lines, card) once it is put away
    prompt('egg:emperor-norton-bridge-decree')!.act!();
    assert.equal((slots.openOverlays().find(o => o.id === 'egg-note')?.props as { style: string }).style, 'scroll');
    assert.ok(!finds.includes('emperor-norton-bridge-decree'), 'nothing is read under the paper');
    slots.closeOverlay('egg-note');
    assert.ok(finds.includes('emperor-norton-bridge-decree'));
    // the Wave Organ: a camera beat, then the find when it ends
    const organ = eggById('wave-organ-high-tide')!;
    put(organ.at.x, organ.at.z);
    run(0.2);
    prompt('egg:wave-organ-high-tide')!.act!();
    assert.ok(cinemaActive(), 'ear-level beat');
    for (let i = 0; i < 200 && cinemaActive(); i++) stepCinema(1 / 30);
    assert.equal(lockHeld(), false);
    assert.ok(finds.includes('wave-organ-high-tide'));
    // the tin: the capsule page with the player's numbers
    prompt('egg:octagon-house-time-capsule')!.act!();
    const note = slots.openOverlays().filter(o => o.id === 'egg-note').at(-1)?.props as { style: string; stats: unknown[] };
    assert.equal(note.style, 'letter');
    assert.equal(note.stats.length, 4);
    // Escape closes the newest overlay (ui/slots closeTopOverlay): the note → the find
    assert.ok(slots.closeTopOverlay());
    assert.ok(finds.includes('octagon-house-time-capsule'));
  } finally {
    stop(); off(); for (const o of offOverlays) o();
    H.__resetHostsForTests(); gates.__resetDailyForTests(); clearSave(); __setBayNowForTests(null);
    game.set({ phase });
  }
});

test('W5-D3 props in the world: each egg prop stands on open ground within 3 u of its egg (off the stand spot), never in water', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { canStand, isWater, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  const spots = [
    { id: 'decree', egg: 'emperor-norton-bridge-decree', x: 238.9 + 1.4, z: 17.1 - 0.6 },
    { id: 'tin', egg: 'octagon-house-time-capsule', x: -184.4, z: 290.7 },
    { id: 'cookie', egg: 'fortune-cookie-trail', x: -239.2 + 1.2, z: 963.3 + 0.8 },
  ];
  for (const s of spots) await sf.attachAround(city, s.x, s.z, 16, lms);
  await sf.attachAround(city, -558.5, 529.5, 16, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    for (const s of spots) {
      const egg = eggById(s.egg)!;
      const d = Math.hypot(s.x - egg.at.x, s.z - egg.at.z);
      assert.ok(d > 0.3 && d <= 3, `${s.id}: ${d.toFixed(2)} u from the stand spot`);
      assert.ok(canStand(s.x, s.z, 0.2) && !isWater(s.x, s.z), `${s.id}: on ground`);
    }
    assert.ok(canStand(-558.5, 529.5) && !isWater(-558.5, 529.5), 'the windsock on the lawn');
    assert.ok(Math.hypot(-558.5 - -566, 529.5 - 536) < marina.CRISSY_LAWN_R);
  } finally { setCityTerrain(null); }
});

test('W5-D2 cards: the find card (compact: 小发现 · +10 金币, the name, "the story"), the notes and the operator render', async () => {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const close = () => {};
  const card = renderToStaticMarkup(h(FactCard, { props: { id: 'ggb-foghorn-duet', coins: 10 }, close }));
  assert.match(card, /ob-egg-card/);
  assert.match(card, /小发现/);
  assert.match(card, /\+10 金币/);
  assert.match(card, /金门大桥的雾笛二重唱/);
  assert.match(card, /看看故事/);
  assert.doesNotMatch(card, /goldengate\.org/, 'the sources wait until it is opened');
  assert.equal(renderToStaticMarkup(h(FactCard, { props: { id: 'nope' }, close })), '');
  const scroll = renderToStaticMarkup(h(NoteCard, { props: { style: 'scroll', title: downtown.NORTON_NOTE.title, lines: downtown.NORTON_NOTE.lines, sign: downtown.NORTON_NOTE.sign }, close }));
  assert.match(scroll, /is-scroll/);
  assert.match(scroll, /诺顿一世/);
  const letter = renderToStaticMarkup(h(NoteCard, { props: { style: 'letter', title: marina.CAPSULE_NOTE.title, lines: marina.CAPSULE_NOTE.lines, statsTitle: { zh: '你的时间胶囊', en: 'Your time capsule' }, stats: marina.capsuleStats() }, close }));
  assert.match(letter, /你的时间胶囊/);
  assert.equal((letter.match(/<li>/g) ?? []).length, 4);
  const op = renderToStaticMarkup(h(OperatorBubble, { props: { choices: downtown.OPERATOR_CHOICES, onPick: () => {} }, close }));
  assert.match(op, /你找谁/);
  assert.equal((op.match(/ob-btn-soft/g) ?? []).length, 3);
});
