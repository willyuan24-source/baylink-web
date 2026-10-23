import assert from 'node:assert/strict';
import test from 'node:test';
import { createCoverPage, getCover, resolveCovers, type CoverAsset, type CoverItem, type ImageCover } from '../src/lib/cover';
import { TIER_LABELS, tierLabelOf } from '../src/lib/cover-labels';

// UI9-IMAGES DECISIONS 23: one badge per tier, in both scripts, with a full English version for a hero and a short one
// for an 88 px thumbnail. A0 adds the vocabulary (cover-labels.ts tierLabelOf); the pages switch to it in A1.
const today = '2026-10-21';
const asset = (overrides: Partial<CoverAsset>): CoverAsset => ({
  src: `/guides/test/${Math.random().toString(36).slice(2)}.webp`, alt: 'alt', caption: '2024 年照片', credit: 'Example · CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', kind: 'photo', width: 1200, height: 800, ...overrides,
});
const images: Record<string, CoverAsset> = {
  official: asset({ credit: 'Brand · 官方宣传图', caption: '官方宣传图', licenseUrl: undefined, rights: { basis: 'official' } }),
  edition: asset({ credit: 'Organiser', caption: '2025 年往届活动官方照片', licenseUrl: undefined, rights: { basis: 'press-kit' } }),
  product: asset({ credit: 'Brand', caption: 'Brand 官网的饮品产品图；不是门店实景。', licenseUrl: undefined, rights: { basis: 'official' } }),
  venue: asset({ caption: '分馆外观，2023 年照片', subject: 'venue' }),
  stock: asset({ credit: 'A Photographer · Unsplash', caption: '图书馆故事会示意', subject: 'category', rights: { basis: 'stock' } }),
  ai: asset({ kind: 'illustration', credit: 'BAYLINK · AI 原创插图', caption: '情境插图', subject: 'category', aiCoverApproved: true }),
  aiPending: asset({ kind: 'illustration', credit: 'BAYLINK · AI 原创插图', caption: '情境插图' }),
};
const ctx = { images, today };
const cover = (item: CoverItem) => { const resolved = getCover(item, ctx); assert.notEqual(resolved.tier, 'type', item.imageKey); return resolved as ImageCover; };

test('the four-tier vocabulary is the owner’s table', () => {
  assert.deepEqual(tierLabelOf(cover({ kind: 'offer', id: 'o', imageKey: 'official' })), { zh: '官方图', zhHant: '官方圖', en: 'Official image', zhShort: '官方图', zhHantShort: '官方圖', enShort: 'Official' });
  assert.deepEqual(tierLabelOf(cover({ kind: 'event', id: 'e', imageKey: 'edition' })), { zh: '官方图 · 2025 往届', zhHant: '官方圖 · 2025 往屆', en: 'Official image · 2025 edition', zhShort: '2025 往届', zhHantShort: '2025 往屆', enShort: 'Official 2025' });
  assert.deepEqual(tierLabelOf(cover({ kind: 'opening', id: 's', imageKey: 'product' })), { zh: '官方图 · 产品图', zhHant: '官方圖 · 產品圖', en: 'Official product image', zhShort: '官方产品图', zhHantShort: '官方產品圖', enShort: 'Official' });
  const venue = cover({ kind: 'event', id: 'e', imageKey: 'venue' });
  assert.equal(venue.tier, 'venue');
  assert.deepEqual(tierLabelOf(venue), { zh: '场馆照 · 2023', zhHant: '場館照 · 2023', en: 'Venue photo · 2023', zhShort: '场馆照 · 2023', zhHantShort: '場館照 · 2023', enShort: 'Venue 2023' });
  const stock = cover({ kind: 'event', id: 'e', imageKey: 'stock' });
  assert.equal(stock.tier, 'stock');
  assert.deepEqual(tierLabelOf(stock), { zh: '示意图', zhHant: '示意圖', en: 'Illustrative photo', zhShort: '示意图', zhHantShort: '示意圖', enShort: 'Stock photo' });
  const ai = cover({ kind: 'event', id: 'e', imageKey: 'ai' });
  assert.equal(ai.tier, 'ai');
  assert.deepEqual(tierLabelOf(ai), { zh: 'AI 示意图', zhHant: 'AI 示意圖', en: 'AI illustration', zhShort: 'AI 示意图', zhHantShort: 'AI 示意圖', enShort: 'AI image' });
  assert.equal(ai.label.zh, 'AI 示意图', 'getImageProvenance says the same');
});

// Advance widths of Helvetica / Arial (per 1000 em), the metrics the system UI font (SF, Segoe) is closest to.
const WIDTH: Record<string, number> = {
  ' ': 278, '·': 278, '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556, '8': 556, '9': 556,
  A: 667, D: 722, I: 278, O: 778, P: 667, S: 667, V: 667, a: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222,
  k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, r: 333, s: 500, t: 278, u: 556, v: 500,
};
/**
 * Text width in px. The advances above are Helvetica's; the site's system-ui (SF on macOS / iOS, Segoe on Windows) runs
 * about 7.5% wider (Chrome on macOS, 13 px: 'Official · 2025' 85.5 px, 'Venue · 2023' 80.4 px), so 8% is added.
 */
const SYSTEM_UI = 1.08;
const textWidth = (text: string, px: number) => [...text].reduce((sum, char) => {
  assert.ok(WIDTH[char], `no width for ${JSON.stringify(char)}`);
  return sum + WIDTH[char];
}, 0) * px / 1000 * SYSTEM_UI;
/** CJK glyphs are one em wide. */
const glyphWidth = (text: string, px: number) => [...text].reduce((sum, char) => sum + (/[\u3400-\u9fff]/.test(char) ? px : textWidth(char, px)), 0);
/** R2-03 (covers.css): on a picture ≤ 200 px (a phone's 2-up card, 173 px) the chip sits 4 px in with 4 px of padding a
 *  side, at most 75% of the picture wide at 13 px; on an 88 px thumbnail (≤ 120 px) at most 100% − 8 px wide with 2 px of
 *  padding a side at 12 px. */
const THUMB_TEXT = 88 - 8 - 4;
/** The model runs 0–5% wider than Chrome ('Venue photo · 2023' at 13 px: 117.1 px measured, 122.6 modelled): 1 px of slack. */
const CARD_TEXT = 173 * .75 - 8 + 1;

test('every label fits one line: its short words at 12 px on an 88 px thumbnail; on a 2-up card the full words, or the short ones when long', async () => {
  // UI9-R2-FOUNDATION: one label component at every size, bottom-left, one line (white-space:nowrap), never a strip or a
  // credit line under the thumbnail. The short words keep the year, and the tier word or a past edition's 往届 (DECISIONS 23).
  const labels = [TIER_LABELS.official, TIER_LABELS.officialEdition('2025'), TIER_LABELS.officialProduct, TIER_LABELS.venue(2023), TIER_LABELS.venue(), TIER_LABELS.stock, TIER_LABELS.ai];
  for (const label of labels) for (const [full, short] of [[label.zh, label.zhShort], [label.zhHant, label.zhHantShort], [label.en, label.enShort]]) {
    assert.ok(glyphWidth(short, 12) <= THUMB_TEXT, `${short}: ${glyphWidth(short, 12).toFixed(1)} px at 12 px`);
    // Badges.tsx data-long (> 18 characters): a picture ≤ 200 px draws the short words instead (covers.css).
    const card = full.length > 18 ? short : full;
    assert.ok(glyphWidth(card, 13) <= CARD_TEXT, `${card}: ${glyphWidth(card, 13).toFixed(1)} px at 13 px on a 173 px card`);
  }
  assert.ok(glyphWidth(TIER_LABELS.officialEdition('2025').en, 13) > CARD_TEXT, 'the long English words are the larger pictures’');
  const { readFileSync } = await import('node:fs');
  const covers = readFileSync('src/components/ui/covers.css', 'utf8');
  assert.match(covers, /\.ui-cover>\.ui-provenance\[data-chip\] \{ top:auto; right:auto; bottom:var\(--sp-2\); left:var\(--sp-2\); max-width:75%;[^}]*white-space:nowrap;/);
  assert.match(covers, /@container ui-cover \(max-width:120px\) \{\n {2}\.ui-cover>\.ui-provenance\[data-chip\] \{ max-width:calc\(100% - var\(--sp-2\)\); padding:0 2px; font-size:var\(--fs-label-tiny\); \}/);
  assert.doesNotMatch(readFileSync('src/components/ui/cards.css', 'utf8'), /\.ui-row-card__thumb \.ui-provenance/, 'no strip variant on a row thumbnail');
  assert.doesNotMatch(covers, /\.ui-row-card__credit\) \.ui-row-card__thumb \.ui-provenance/, 'no rule hides a thumbnail label for a credit line');
});

test('④ only with the owner’s approval and never on a lead; ③④ pictures repeat only 8 cards apart, never an info card', () => {
  const pending = getCover({ kind: 'event', id: 'e', imageKey: 'aiPending' }, ctx);
  assert.equal(pending.tier === 'type' && pending.reason, 'ai-illustration');
  const next = getCover({ kind: 'event', id: 'e', imageKeys: ['aiPending', 'stock'] }, ctx);
  assert.equal(next.tier, 'stock', 'an unapproved AI candidate moves on to the next one');
  assert.equal(getCover({ kind: 'event', id: 'e', imageKeys: ['ai', 'stock'], lead: true }, ctx).tier, 'stock', 'a lead skips AI (DECISIONS 24)');
  const items = Array.from({ length: 10 }, (_, i): CoverItem => ({ kind: 'event', id: `e${i}`, imageKeys: ['stock', 'ai'] }));
  const tiers = resolveCovers(items, { ...ctx, page: createCoverPage() }).map(c => c.tier);
  assert.deepEqual(tiers, ['stock', 'ai', 'stock', 'ai', 'stock', 'ai', 'stock', 'ai', 'stock', 'ai'], 'a pool smaller than the run reuses the picture shown farthest away');
  const roomy = Array.from({ length: 10 }, (_, i): CoverItem => ({ kind: 'event', id: `r${i}`, imageKeys: ['stock', ...(i ? ['ai'] : [])] }));
  const spread = resolveCovers([...roomy.slice(0, 9).map(item => ({ ...item, imageKeys: item.imageKeys!.slice(-1) })), roomy[9]], { ...ctx, page: createCoverPage() });
  assert.equal(spread[9].tier, 'stock', 'the picture comes back once it is 8 cards away');
  const page = createCoverPage();
  const first = getCover({ kind: 'event', id: 'x', imageKey: 'stock' }, { ...ctx, page });
  assert.equal(getCover({ kind: 'event', id: 'x', imageKey: 'stock' }, { ...ctx, page }).tier, first.tier, 'a re-render keeps its picture');
});

test('a venue photo serves offers and new shops too, within 8 years; a stock picture has no age rule', () => {
  assert.equal(cover({ kind: 'offer', id: 'o', imageKey: 'venue' }).tier, 'venue');
  assert.equal(cover({ kind: 'opening', id: 's', imageKey: 'venue' }).tier, 'venue');
  const old = getCover({ kind: 'offer', id: 'o', imageKey: 'old' }, { ...ctx, images: { old: { ...images.venue, caption: '2009 年照片' } } });
  assert.equal(old.tier === 'type' && old.reason, 'too-old');
  const oldStock = getCover({ kind: 'offer', id: 'o', imageKey: 'old' }, { ...ctx, images: { old: { ...images.stock, caption: '2009 年照片' } } });
  assert.equal(oldStock.tier, 'stock');
});
