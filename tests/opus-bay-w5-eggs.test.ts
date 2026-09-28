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
