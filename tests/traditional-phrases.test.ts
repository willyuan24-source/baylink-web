import assert from 'node:assert/strict';
import test from 'node:test';
import * as OpenCC from 'opencc-js';
import { taiwanConverter } from '../src/i18n/locale';
import { SITE_LOCALE, Trie } from '../src/i18n/traditional';
import { fullPhrases } from '../src/i18n/traditional-full';
import STCharacters from 'opencc-js/dict/STCharacters';
import { guides } from '../src/data/guides';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { currentFreebies } from '../src/data/october-offers';

/**
 * WEB-DATA-SPLIT: 繁體 pages convert with opencc's core and only the phrases the site's sources contain
 * (src/data/generated/zh-hant-phrases.json, scripts/generate-traditional-phrases.ts); the full table loads after the reader's
 * first tap. A failure here after a content change means the pruned table is stale: run `npm run generate:home`.
 */
const site = () => taiwanConverter({ Trie, Locale: SITE_LOCALE } as unknown as Parameters<typeof taiwanConverter>[0]);
const corpus = [
  ...guides.flatMap(guide => [guide.title, guide.summary, ...guide.blocks.flatMap(block => 'text' in block && typeof block.text === 'string' ? [block.text] : [])]),
  ...MONTHLY_EVENTS.flatMap(event => [event.title, event.venue, event.city, event.summary ?? '']),
  ...currentFreebies.flatMap(offer => [offer.title, offer.brand]),
];

test('the site converter turns the site’s own text into exactly what the full opencc build does, with and without the game words', () => {
  const full = taiwanConverter(OpenCC), pruned = site();
  assert.ok(corpus.length > 2000);
  for (const text of corpus) {
    assert.equal(pruned(text), full(text), text);
    assert.equal(pruned(text, true), full(text, true), text);
  }
});

test('the site table is a small part of the full one, and the full table built in slices equals the full build on text the site does not ship', () => {
  assert.ok(JSON.stringify(SITE_LOCALE.from.cn[0][0]).length * 10 < fullPhrases.length, 'the pruned table is far smaller');
  const prebuilt = new Trie();
  prebuilt.loadDict(STCharacters);
  for (const entry of fullPhrases.split('|')) { const space = entry.indexOf(' '); prebuilt.addWord(entry.slice(0, space), entry.slice(space + 1)); }
  const sliced = taiwanConverter({ Trie, Locale: { from: { cn: [[]] }, to: SITE_LOCALE.to } } as unknown as Parameters<typeof taiwanConverter>[0], prebuilt);
  const full = taiwanConverter(OpenCC);
  for (const text of ['她的头发很长，理发店在后面', '干净的面条和干燥的面包', '这只钟表准时', ...corpus.slice(0, 300)]) assert.equal(sliced(text), full(text), text);
  // Text the site does not ship may differ before the full table arrives (here 发 in 头发 → 髮 needs the phrase).
  assert.equal(full('头发'), '頭髮');
});
