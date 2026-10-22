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
  assert.deepEqual(tierLabelOf(cover({ kind: 'offer', id: 'o', imageKey: 'official' })), { zh: '官方图', zhHant: '官方圖', en: 'Official image', enShort: 'Official' });
  assert.deepEqual(tierLabelOf(cover({ kind: 'event', id: 'e', imageKey: 'edition' })), { zh: '官方图 · 2025 往届', zhHant: '官方圖 · 2025 往屆', en: 'Official image · 2025 edition', enShort: 'Official · 2025' });
  assert.deepEqual(tierLabelOf(cover({ kind: 'opening', id: 's', imageKey: 'product' })), { zh: '官方图 · 产品图', zhHant: '官方圖 · 產品圖', en: 'Official product image', enShort: 'Product' });
  const venue = cover({ kind: 'event', id: 'e', imageKey: 'venue' });
  assert.equal(venue.tier, 'venue');
  assert.deepEqual(tierLabelOf(venue), { zh: '场馆照 · 2023', zhHant: '場館照 · 2023', en: 'Venue photo · 2023', enShort: 'Venue · 2023' });
  const stock = cover({ kind: 'event', id: 'e', imageKey: 'stock' });
  assert.equal(stock.tier, 'stock');
  assert.deepEqual(tierLabelOf(stock), { zh: '示意图', zhHant: '示意圖', en: 'Illustrative photo', enShort: 'Stock photo' });
  const ai = cover({ kind: 'event', id: 'e', imageKey: 'ai' });
  assert.equal(ai.tier, 'ai');
  assert.deepEqual(tierLabelOf(ai), { zh: 'AI 示意图', zhHant: 'AI 示意圖', en: 'AI illustration', enShort: 'AI image' });
  assert.equal(ai.label.zh, 'AI 示意图', 'getImageProvenance says the same');
});

// Advance widths of Helvetica / Arial (per 1000 em), the metrics the system UI font (SF, Segoe) is closest to.
const WIDTH: Record<string, number> = {
  ' ': 278, '·': 278, '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556, '8': 556, '9': 556,
  A: 667, D: 722, I: 278, O: 778, P: 667, S: 667, V: 667, a: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222,
  k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, r: 333, s: 500, t: 278, u: 556,
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
/** The chip on an 88 px thumbnail (cards.css .ui-row-card__thumb .ui-provenance) spans it with 4 px (--sp-1) each side. */
const THUMB_TEXT = 88 - 2 * 4;

test('on an 88 px thumbnail the ③④ chips fit one line at the site’s 13 px floor; a dated ①② chip wraps, never cut', async () => {
  // UI9-IMG-A1b: the A0 handoff proposed a 12 px thumbnail chip, but the site's text guard (scripts/check-editorial-styles.mjs,
  // tests/type-cover.test.tsx) keeps every text at 13 px or more. The chips that stay on a thumbnail in every mode — ③ 示意图 /
  // ④ AI 示意图 (DECISIONS 23) — fit at 13 px; a ①② picture's words move into the row's 13 px credit line where the row has
  // one (covers.css), and otherwise wrap onto a second line (cards.css white-space:normal), never an ellipsis.
  for (const label of [TIER_LABELS.stock.enShort, TIER_LABELS.ai.enShort, TIER_LABELS.official.enShort, TIER_LABELS.officialProduct.enShort, TIER_LABELS.venue().enShort, TIER_LABELS.scene3d.enShort]) {
    assert.ok(textWidth(label, 13) <= THUMB_TEXT, `${label}: ${textWidth(label, 13).toFixed(1)} px`);
  }
  assert.ok(textWidth(TIER_LABELS.officialEdition('2025').enShort, 13) > THUMB_TEXT, 'the dated official label wraps at 13 px');
  assert.ok(textWidth(TIER_LABELS.officialEdition('2025').en, 13) > THUMB_TEXT, 'the full version is the hero’s, not the thumbnail’s');
  const { readFileSync } = await import('node:fs');
  assert.match(readFileSync('src/components/ui/cards.css', 'utf8'), /\.ui-row-card__thumb \.ui-provenance\[data-chip\] \{ line-height:var\(--lh-snug\); white-space:normal; \}/);
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
