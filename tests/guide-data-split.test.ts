import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { guides, getGuideBySlug } from '../src/data/guides';
import { getGuideMedia } from '../src/data/guide-media';
import { getGuideEditorial } from '../src/data/guide-editorial';
import { getGuideMetadata } from '../src/lib/guide-metadata';
import { discoverRelatedGuides } from '../src/lib/guide-discovery';
import { guideRegionsOf, keepInlineImage } from '../src/features/guides/guide-data';
import { guideReadMinutes, guideSourceCount } from '../src/features/guides/guide-facts';
import { coverFor, relatedForToday, type GuidesIndex } from '../src/features/guides/guide-records';
import { isGuideSlug, loadGuide, peekGuide, readGuide } from '../src/features/guides/guide-store';
import guidesIndex from '../src/data/generated/guides-index.json';

/**
 * WEB-DATA-SPLIT (ENGSEC-01): /guides and /guides/:slug render generated data (scripts/generate-guide-data.ts), not the
 * guide corpus. These checks keep the generated index and records equal to what the pages used to compute at runtime, and
 * keep the corpus out of both pages' static imports. A failure after a content change means: run `npm run generate:home`.
 */
const plain = <T,>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));
const index = guidesIndex as GuidesIndex;

test('the index lists every published guide in corpus order with the card facts the pages used to compute', () => {
  assert.deepEqual(index.guides.map(card => card.slug), guides.map(guide => guide.slug));
  for (const guide of guides) {
    const card = index.guides.find(item => item.slug === guide.slug)!;
    assert.equal(card.title, guide.title);
    assert.equal(card.category, guide.category);
    assert.equal(card.sourceCount, guideSourceCount(guide), guide.slug);
    assert.equal(card.readMinutes, guideReadMinutes(guide), guide.slug);
    assert.deepEqual(card.regions ?? [], guideRegionsOf(guide), guide.slug);
    assert.deepEqual(coverFor(card.covers, 'zh-Hans'), plain(getGuideMedia(guide).cover), guide.slug);
  }
});

test('every record carries its published guide, kept inline pictures, editorial aids and metadata unchanged', () => {
  for (const guide of guides) {
    const record = peekGuide(guide.slug);
    assert.ok(record, guide.slug);
    assert.deepEqual(record.guide, plain(getGuideBySlug(guide.slug)), guide.slug);
    assert.deepEqual(record.inline, plain(getGuideMedia(guide).inline.filter(item => keepInlineImage(item.image, guide, guides))), guide.slug);
    assert.deepEqual(record.editorial, plain(getGuideEditorial(guide.slug)), guide.slug);
    assert.deepEqual(record.metadata, plain(getGuideMetadata(guide)), guide.slug);
  }
});

test('"Read next" from a record equals discoverRelatedGuides on any reading day, editions past their month included', () => {
  for (const today of ['2026-09-15', '2026-10-12', '2026-11-20', '2027-02-01']) {
    for (const guide of guides) {
      const fromRecord = relatedForToday(peekGuide(guide.slug)!.related, today).map(card => card.slug);
      assert.deepEqual(fromRecord, discoverRelatedGuides(guide, 4, today).map(item => item.slug), `${guide.slug} on ${today}`);
    }
  }
});

test('the store knows published slugs only; an unknown slug is not found, never a download', async () => {
  assert.equal(isGuideSlug('bay-area-chinese-senior-services-referral-guide'), true);
  assert.equal(isGuideSlug('../secrets'), false);
  assert.deepEqual(readGuide('no-such-guide'), { missing: true });
  assert.equal(await loadGuide('no-such-guide'), undefined);
  const record = await loadGuide('bay-area-airport-arrival-guide');
  assert.equal(record?.guide.slug, 'bay-area-airport-arrival-guide');
  assert.equal(readGuide('bay-area-airport-arrival-guide').record, record);
});

/** The static (not lazy, not type-only) import chain from a page to a module, or undefined. */
function staticChain(entry: string, target: RegExp): string | undefined {
  const parent = new Map<string, string | undefined>([[resolve(entry), undefined]]);
  const queue = [resolve(entry)];
  while (queue.length) {
    const file = queue.shift()!;
    if (target.test(relative('.', file).split(sep).join('/'))) {
      const chain = [file];
      while (parent.get(chain[0])) chain.unshift(parent.get(chain[0])!);
      return chain.map(item => relative('.', item).split(sep).join('/')).join(' → ');
    }
    if (!/\.tsx?$/u.test(file)) continue;
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/^\s*(?:import|export)\s+(?!type\s)(?:[^'";]*?\bfrom\s+)?['"](\.[^'"]+)['"]/gmu)) {
      const base = resolve(dirname(file), match[1]);
      const found = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find(item => existsSync(item) && statSync(item).isFile());
      if (found && !parent.has(found)) { parent.set(found, file); queue.push(found); }
    }
  }
  return undefined;
}

test('neither guide page imports the guide corpus, the media registry, the attractions or the discoveries catalog', () => {
  const heavy = /^src\/data\/(?:guides|guide-media|attractions|local-discoveries|monthly-edition|october-offers)\.ts$/u;
  for (const page of ['src/pages/GuidesPage.tsx', 'src/pages/GuideDetailPage.tsx']) assert.equal(staticChain(page, heavy), undefined, page);
  // the walk does find the corpus where it is still imported
  assert.match(staticChain('src/features/guides/guide-data.ts', heavy) ?? '', /src\/data\/guides\.ts$/u);
});

// Review 10-14 (budget): the 3D link and the game’s arrival table load with the record of the SF outing guides that show it
// (guide-blocks.ts GuideOpusBlock), not with every article.
test('the guide page loads the 3D link only with the guides that show it', () => {
  assert.equal(staticChain('src/pages/GuideDetailPage.tsx', /^src\/(?:features\/guides\/GuideOpusEntry\.tsx|lib\/opus-bay-attraction-entry\.ts)$/u), undefined);
  assert.ok(staticChain('src/features/guides/GuideOpusEntry.tsx', /^src\/lib\/opus-bay-attraction-entry\.ts$/u), 'the walk finds it from the block itself');
});
