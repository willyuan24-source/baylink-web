import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { Bilingual } from '../src/opus-bay/core/types';

// Lane V (wave 4, part 2 · W4-C9 / H-7): the four wave-4 postcards of data/sf/w4Postcards.ts — art on disk (1200 + 600
// WebP), bilingual text with a short hint and a https source, new ids, a real `near` / attraction, and spots that pass
// the checks of the shipped 12 (tests/opus-bay-sf-content.test.ts G2-2) with the wave-4 sites registered: standable,
// reachable from ferry-gate on the walking graph, clear of every card spot, apart from every other postcard.

// --- headless canvas stub (world modules create label atlases at import time; same as the content test) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { W4_POSTCARDS, W4_POSTCARD_IDS, W4_POSTCARD_ART, W4_POSTCARDS_VERIFIED_AT, w4PostcardDefs, w4PostcardUrls } = await import('../src/opus-bay/data/sf/w4Postcards');
const { CITY_POSTCARDS } = await import('../src/opus-bay/data/sf/postcards');
const { ASSETS, POSTCARD_ART, POSTCARD_ART_IDS, SF_POSTCARD_ART_IDS, listAssetUrls } = await import('../src/opus-bay/data/assets');
const { CITY_POIS } = await import('../src/opus-bay/data/sf/cityPois');
const { ATTRACTIONS } = await import('../src/opus-bay/data/sf/attractions');
const { PLACE_CARDS } = await import('../src/opus-bay/data/sf/placeCards');
const { PLACE_CARDS_2 } = await import('../src/opus-bay/data/sf/placeCards2');
const { project } = await import('../src/opus-bay/core/geo');
const { SF_LANDMARKS, sfLandmark } = await import('../src/opus-bay/world/sf/landmarks/index');
const { W4_SITES, w4Site } = await import('../src/opus-bay/world/sf/landmarks/w4sites');
const { DISTRICT } = await import('../src/opus-bay/data/district');

const ROOT = path.resolve(import.meta.dirname, '..');
const bubbleWidth = (text: string) => [...text].reduce((sum, ch) => sum + (ch === ' ' ? 0 : ch.charCodeAt(0) < 128 ? 0.5 : 1), 0);
const filled = (text: Bilingual, where: string) => {
  assert.ok(text.zh.trim() && text.en.trim(), `${where}: bilingual text`);
  assert.ok(/[一-鿿]/.test(text.zh), `${where}: zh has Chinese`);
  assert.ok(!/[一-鿿]/.test(text.en), `${where}: en has no Chinese`);
};
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
function webpSize(file: string): [number, number] {
  const b = fs.readFileSync(file);
  assert.equal(b.subarray(8, 12).toString(), 'WEBP', `${file} is WebP`);
  const kind = b.subarray(12, 16).toString();
  if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (kind === 'VP8L') { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}

test('W4 postcards: four new ids with art on disk (1200 × 900 + 600 × 450 WebP), text, hint ≤ 45, a https source', () => {
  assert.deepEqual([...W4_POSTCARD_IDS], ['sf-state-quad', 'sf-music-concourse', 'sf-lands-end', 'sf-west-portal']);
  for (const id of W4_POSTCARD_IDS) {
    assert.ok(!(SF_POSTCARD_ART_IDS as readonly string[]).includes(id) && !(POSTCARD_ART_IDS as readonly string[]).includes(id), `${id} is new`);
    // integration (lane V): the art is in the manifest like the other 20 (lane C's cards join CARDS)
    assert.equal(POSTCARD_ART[id].large, W4_POSTCARD_ART[id].large);
    assert.equal(POSTCARD_ART[id].small, W4_POSTCARD_ART[id].small);
    assert.ok([W4_POSTCARD_ART[id].large, W4_POSTCARD_ART[id].small].includes(ASSETS.postcards[id]), `${id} in ASSETS.postcards`);
    assert.ok(listAssetUrls().includes(W4_POSTCARD_ART[id].large) && listAssetUrls().includes(W4_POSTCARD_ART[id].small), `${id} files listed`);
    for (const [url, size, max] of [[W4_POSTCARD_ART[id].large, [1200, 900], 120_000], [W4_POSTCARD_ART[id].small, [600, 450], 50_000]] as const) {
      const file = path.join(ROOT, 'public', url);
      assert.deepEqual(webpSize(file), [...size], url);
      const bytes = fs.statSync(file).size;
      assert.ok(bytes > 15_000 && bytes <= max, `${url}: ${bytes} B (the shipped 12 are 45–96 KB / 20–39 KB)`);
    }
    const c = W4_POSTCARDS[id];
    filled(c.title, id); filled(c.fact, `${id} fact`); filled(c.hint, `${id} hint`);
    assert.ok(bubbleWidth(c.hint.zh) <= 45, `${id}: hint ≤ 45 (${bubbleWidth(c.hint.zh)})`);
    // as long as the shipped 12 at most (zh ≤ 39, en ≤ 120)
    assert.ok(bubbleWidth(c.fact.zh) <= 40 && c.fact.en.length <= 120, `${id}: fact fits the card (${bubbleWidth(c.fact.zh)} / ${c.fact.en.length})`);
    assert.match(c.sourceUrl, /^https:\/\//);
  }
  assert.equal(W4_POSTCARDS_VERIFIED_AT, '2026-09-27');
  const defs = w4PostcardDefs();
  assert.deepEqual(defs.map(d => d.id), [...W4_POSTCARD_IDS]);
  for (const d of defs) assert.equal(d.image, `/opus-bay/postcards/${d.id}-600.webp`);
  assert.equal(w4PostcardUrls().length, 8);
  // the ledger lists each file with its bytes (the lead merges it into ASSETS-LEDGER.md)
  const ledger = fs.readFileSync(path.join(ROOT, 'docs/opus-bay/ledger/w4-V.md'), 'utf8');
  for (const u of w4PostcardUrls()) {
    const rel = u.replace('/opus-bay/', '');
    const row = ledger.split(/\r?\n/).find(l => l.startsWith(`| ${rel} `));
    assert.ok(row, `ledger row for ${rel}`);
    assert.ok(row.includes(fs.statSync(path.join(ROOT, 'public', u)).size.toLocaleString('en-US')), `${rel}: ledger bytes`);
  }
});

test('W4 postcards: near a real card (a landmark, a wave-4 site or an attraction) and within reach of it', () => {
  const attractionIds = new Set(ATTRACTIONS.map(a => a.id));
  for (const id of W4_POSTCARD_IDS) {
    const c = W4_POSTCARDS[id];
    assert.ok(attractionIds.has(c.attraction), `${id}: attraction ${c.attraction}`);
    const lm = sfLandmark(c.near), site = w4Site(c.near);
    assert.ok(lm || site || attractionIds.has(c.near), `${id}: near ${c.near}`);
    const a = ATTRACTIONS.find(x => x.id === c.attraction)!;
    const anchor = a.arrival ?? { x: a.x, z: a.z };
    assert.ok(dist(c.position, anchor) < 70, `${id}: ${dist(c.position, anchor).toFixed(1)} u from ${c.attraction}`);
  }
});

test('W4 postcards: every spot stands in the published city (wave-4 sites registered), joins the walking network of ferry-gate and keeps clear of the cards and the other postcards', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { canStand, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const sf = sfDisk();
  const lms = landmarkWalkInputs([...SF_LANDMARKS, ...W4_SITES]);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  const cards = w4PostcardDefs();
  for (const card of cards) await sf.attachAround(city, card.position.x, card.position.z, 20, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  const spots = [
    ...CITY_POIS.map(p => ({ id: `poi ${p.id}`, ...p.position })),
    ...[...PLACE_CARDS, ...PLACE_CARDS_2].filter(c => c.lat !== undefined && c.lng !== undefined).map(c => ({ id: `card ${c.id}`, ...project(c.lat!, c.lng!) })),
    ...ATTRACTIONS.flatMap(a => [{ id: `attraction ${a.id}`, x: a.x, z: a.z }, ...(a.arrival ? [{ id: `arrival ${a.id}`, ...a.arrival }] : [])]),
  ];
  try {
    const ix = await sf.graphIndex();
    const ferry = DISTRICT.anchors['ferry-gate'];
    const home = ix.component(ix.nearestNode(ferry.x, ferry.z, 60));
    for (const card of cards) {
      assert.ok(canStand(card.position.x, card.position.z), `${card.id}: standable`);
      const n = ix.nearestNode(card.position.x, card.position.z, 12);
      assert.ok(n >= 0, `${card.id}: a walking-graph node within 12 u`);
      assert.equal(ix.component(n), home, `${card.id}: reachable from ferry-gate`);
      for (const s of spots) assert.ok(dist(card.position, s) >= 6.5, `${card.id}: ≥ 6.5 u from ${s.id} (${dist(card.position, s).toFixed(1)})`);
      for (const other of [...CITY_POSTCARDS, ...cards]) if (other.id !== card.id) assert.ok(dist(card.position, other.position) > 20, `${card.id} vs ${other.id}`);
    }
  } finally { setCityTerrain(null); }
});
