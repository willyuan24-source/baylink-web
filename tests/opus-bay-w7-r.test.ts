import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { SF_MODELS } from '../src/opus-bay/data/assets';
import { buildLandmark, sfLandmark } from '../src/opus-bay/world/sf/landmarks/index';

/**
 * Wave 7 · lane R (docs/opus-bay/sf-w7-R-realism.md): the realism fixes stay fixed.
 * - the Fisherman's Wharf wheel is dark wood on a bundle of wooden pilings that rise above the rim (it was a blue ring on
 *   a grey steel post);
 * - City Hall's dome is lead-grey (not sage), Grace Cathedral cool grey with slate roofs, the Dutch Windmill grey-brown
 *   shingle (not cream): both the procedural models (lod 2 far view) and the recoloured AI textures (bytes pinned).
 */

const colours = (g: THREE.BufferGeometry) => {
  const c = g.getAttribute('color');
  const out: [number, number, number][] = [];
  for (let i = 0; i < c.count; i++) out.push([c.getX(i), c.getY(i), c.getZ(i)]);
  return out;
};
/** vertex colours may be stored linear or sRGB: compare against both encodings of a hex colour */
const near = (rgb: [number, number, number], hex: string, tol = 0.02) => {
  const s = new THREE.Color(hex), l = s.clone().convertSRGBToLinear();
  return [[s.r, s.g, s.b], [l.r, l.g, l.b]].some(t => t.every((v, k) => Math.abs(v - rgb[k]) <= tol));
};

test('W7-R the Wharf wheel: no blue ring, dark wooden rim, pilings above the rim', () => {
  const l = sfLandmark('fishermans-wharf')!;
  for (const lod of [0, 2] as const) {
    const g = buildLandmark(l, lod, 0);
    const cs = colours(g);
    assert.ok(!cs.some(c => near(c, '#2f6f96')), `lod ${lod}: the old blue ring colour is gone`);
    assert.ok(cs.some(c => near(c, '#5a3c29')), `lod ${lod}: the dark wooden rim`);
    g.computeBoundingBox();
    // the rim tops out at 3.1 + 1.35 + 0.13 = 4.58 u; the pilings stand above it
    assert.ok(g.boundingBox!.max.y > 5.2, `lod ${lod}: pilings reach ${g.boundingBox!.max.y.toFixed(2)} u`);
  }
});

test('W7-R procedural colours: City Hall dome not sage, Grace Cathedral not warm beige / green, the windmill not cream', () => {
  const cases: [string, string[]][] = [
    ['city-hall', ['#768d89']],
    ['grace-cathedral', ['#dcd6ca', '#7e968c']],
    ['dutch-windmill', ['#eee5d2']],
  ];
  for (const [id, old] of cases) {
    const l = sfLandmark(id)!;
    for (const lod of [0, 2] as const) {
      const cs = colours(buildLandmark(l, lod, 0));
      for (const hex of old) assert.ok(!cs.some(c => near(c, hex, 0.004)), `${id} lod ${lod} still has ${hex}`);
    }
  }
});

test('W7-R the recoloured AI textures: the GLBs are the published ones (bytes pinned in data/assets.ts) and still WebP', () => {
  const pinned: Record<string, number> = { 'sf-city-hall': 145_168, 'sf-grace-cathedral': 111_804, 'sf-windmill-body': 83_956 };
  for (const [id, bytes] of Object.entries(pinned)) {
    const a = SF_MODELS[id as keyof typeof SF_MODELS];
    assert.equal(a.bytes, bytes, `${id} registry bytes`);
    const buf = readFileSync(`public${a.url.replace(/^.*?\/opus-bay\//, '/opus-bay/')}`);
    assert.equal(buf.length, bytes, `${id} file bytes`);
    const len = buf.readUInt32LE(12);
    const json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8')) as { images: { mimeType: string; bufferView: number }[]; bufferViews: { byteOffset?: number; byteLength: number }[] };
    assert.equal(json.images[0].mimeType, 'image/webp');
    const bv = json.bufferViews[json.images[0].bufferView];
    const bin = 20 + len + 8 + (bv.byteOffset ?? 0);
    assert.equal(buf.subarray(bin + 8, bin + 12).toString('latin1'), 'WEBP', `${id}: the image chunk is a WebP`);
  }
});

test('W7-R Lombard: round hydrangea clumps (blue / pink / purple) in the hairpin beds, within the T2 budget', () => {
  const l = sfLandmark('lombard-crooked-street')!;
  const g = buildLandmark(l, 0, 0);
  const cs = colours(g);
  for (const hex of ['#8fa6dc', '#e59bb9', '#a88bd3']) assert.ok(cs.some(c => near(c, hex)), `hydrangea ${hex}`);
  const tris = (g.getIndex()?.count ?? g.getAttribute('position').count) / 3;
  assert.ok(tris <= 2500, `lod 0 ${tris} ≤ 2500`);
});

test('W7-R the famous cards carry what a visitor asks first (hours / price / status), hedged, re-checked 2026-09-29', async () => {
  const { PLACE_CARDS, CARD_REFRESHES } = await import('../src/opus-bay/data/sf/placeCards');
  const { CURATED_CARDS } = await import('../src/opus-bay/data/sf/placeCards2');
  const card = (id: string) => [...PLACE_CARDS, ...CURATED_CARDS].find(c => c.id === id)!;
  // Alcatraz: the NPS day-tour fares (nps.gov/alca/planyourvisit/fees.htm)
  assert.match(card('alcatraz').cost!.zh, /\$47\.95/);
  assert.match(card('alcatraz').cost!.en, /\$47\.95.*\$29\.15.*\$45\.15/);
  // hours where there were none
  for (const id of ['pier-39', 'golden-gate-park', 'union-square', 'dolores-park', 'marina-green', 'transamerica-pyramid', 'presidio']) {
    const c = card(id);
    assert.ok(c.hours, `${id} has hours`);
    assert.match(c.hours!.zh, /约|官网|确认|现场/, `${id} hedged`);
    assert.equal(c.verifiedAt, '2026-09-29', `${id} re-checked`);
  }
  // Japantown: the Peace Plaza renovation (peaceplaza.org, Sept 2026 update) on both cards of the plaza
  assert.equal(card('japan-center').status?.kind, 'works');
  assert.equal(CARD_REFRESHES['peace-pagoda'].status?.kind, 'works');
  // the built landmarks' new hours
  for (const id of ['painted-ladies', 'palace-of-fine-arts', 'cable-car-turntable', 'twin-peaks', 'de-young-tower']) assert.ok(CARD_REFRESHES[id]?.hours, `${id} hours`);
});

test('W7-R-review City Hall: the dome is a mid lead-grey (as the real one in sun), not near-black, both lods', () => {
  // the real dome (Commons "San Francisco City Hall September 2013 panorama 2.jpg"): mid grey with gold-leaf ribs.
  // W7-R2's #6a7176 (HSL l 0.44) rendered near-black at the photo pose: the procedural dome keeps the old sage's
  // lightness in grey (the AI texture was regenerated the same way: recolour-glb.py city-hall, from the original GLB)
  const l = sfLandmark('city-hall')!;
  for (const lod of [0, 2] as const) {
    const cs = colours(buildLandmark(l, lod, 0));
    // dome candidates: cool greys (low saturation, blue >= red) that are not the white / cream stone
    const hsl = { h: 0, s: 0, l: 0 };
    const domes = cs.filter(([r, g, b]) => {
      const c = new THREE.Color(r, g, b);
      c.getHSL(hsl, THREE.SRGBColorSpace);
      return hsl.s < 0.12 && b >= r && hsl.l > 0.15 && hsl.l < 0.8;
    });
    assert.ok(domes.length > 0, `lod ${lod}: a grey dome`);
    for (const [r, g, b] of domes) {
      new THREE.Color(r, g, b).getHSL(hsl, THREE.SRGBColorSpace);
      assert.ok(hsl.l >= 0.5, `lod ${lod}: the dome grey is mid, not near-black (l ${hsl.l.toFixed(2)})`);
    }
  }
});

test('W7-R-review Peace Plaza: the works note claims no completion date the sources do not give', async () => {
  // peaceplaza.org (update 2 Sep 2026) and Rec & Park's construction updates (checked 2026-09-30): the works go on
  // "intermittently throughout September and October"; no completion date is published
  const { PLACE_CARDS, CARD_REFRESHES } = await import('../src/opus-bay/data/sf/placeCards');
  const texts = [PLACE_CARDS.find(c => c.id === 'japan-center')!.status!.text, CARD_REFRESHES['peace-pagoda'].status!.text];
  for (const t of texts) {
    assert.doesNotMatch(t.zh, /完工|竣工/, t.zh);
    assert.doesNotMatch(t.en, /finish|complete/i, t.en);
    assert.match(t.zh, /商场照常营业/);
  }
});
