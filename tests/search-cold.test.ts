import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// This file runs in its own test process, before any locale dictionary is loaded, and takes the browser's path: the
// search dictionaries are not in the shell (WEB-HOMEPREP, RC-8 iii) and load with the first page that searches.
process.env.BAYLINK_LAZY_SEARCH = '1';
const { getLocale, isLocaleReadyForPath, isSearchConversionReady, loadLocaleForPath, setLocale, simplifySearch } = await import('../src/i18n/locale');
type Locale = import('../src/i18n/locale').Locale;
const { searchQuickDestinations } = await import('../src/lib/quick-search');
const { normalizeGuideQuery } = await import('../src/lib/guide-search');
const { bayBayLocationMentions } = await import('../src/lib/baybay-context');

test('the shell does not carry the search dictionaries: before they load, search is exact and only pages that search wait', async () => {
  const source = readFileSync('src/i18n/locale.ts', 'utf8');
  assert.doesNotMatch(source, /^import (?!type )[^;]*from 'opencc-js/mu, 'no value import of opencc in the shell module');
  assert.equal(isSearchConversionReady(), false);
  // the homepage and what opens over it never wait; every other page (and the search dialog's paths) does
  for (const path of ['/', '/en', '/zh-Hant/', '/posts/1781462578200', '/users/u1', '/category/rent', '/reset-password']) assert.equal(isLocaleReadyForPath('zh-Hans', path), true, path);
  for (const path of ['/guides', '/calendar', '/explore', '/opus-bay', '/events/san-francisco-fleet-week-2026', '/en/guides']) assert.equal(isLocaleReadyForPath('zh-Hans', path), false, path);
  assert.equal(isLocaleReadyForPath('zh-Hans', ['/', '/guides']), false, 'a gate with any searching path waits');
  // synchronous throughout: the input comes back unchanged, and the first Chinese text starts the load
  assert.equal(simplifySearch('金門大橋'), '金門大橋');
  assert.equal(simplifySearch('BAYLINK Fort Point 🌉 2026'), 'BAYLINK Fort Point 🌉 2026');
  // BayBay's place names (keys built through simplifySearch) resolve before and after the dictionaries arrive
  assert.deepEqual(bayBayLocationMentions('我住在費利蒙，想去東灣').map(item => item.city || item.region), ['Fremont', 'east-bay']);
  await loadLocaleForPath('zh-Hans', '/guides');
  assert.equal(isSearchConversionReady(), true);
  assert.equal(isLocaleReadyForPath('zh-Hans', '/guides'), true);
  assert.equal(simplifySearch('金門大橋'), '金门大桥');
  assert.deepEqual(bayBayLocationMentions('我住在費利蒙，想去東灣').map(item => item.city || item.region), ['Fremont', 'east-bay']);
});

test('traditional queries work as soon as a searching page is ready and keep the same rules after every locale load', async () => {
  assert.equal(getLocale(), 'zh-Hans');
  const examples = [
    { query: '金門大橋', simplified: '金门大桥', kind: 'attractions', id: 'golden-gate' },
    { query: '房貸', simplified: '房贷', kind: 'tools', id: 'loan' },
    { query: 'Petaluma 迷宮', simplified: 'Petaluma 迷宫', kind: 'events', id: 'petaluma-pumpkin-patch-2026' },
    { query: 'Mill Valley 電影', simplified: 'Mill Valley 电影', kind: 'events', id: 'mill-valley-film-festival-2026' },
    { query: '攝氏', simplified: '摄氏', kind: 'tools', id: 'units' },
  ] as const;
  const locales: Locale[] = ['zh-Hans', 'en', 'zh-Hant'];
  const snapshot = () => examples.map(example => {
    assert.equal(normalizeGuideQuery(example.query), normalizeGuideQuery(example.simplified));
    return locales.map(locale => {
      const result = searchQuickDestinations(example.query, locale, '2026-09-09')[example.kind].map(item => item.id);
      const canonical = searchQuickDestinations(example.simplified, locale, '2026-09-09')[example.kind].map(item => item.id);
      assert.deepEqual(result, canonical, `${example.query}: ${locale}`);
      assert.ok(result.includes(example.id), `${example.query} was not found on ${locale}`);
      return result;
    });
  });
  const cold = snapshot();
  for (const locale of ['en', 'zh-Hant', 'zh-Hans'] as const) {
    await setLocale(locale, false);
    assert.deepEqual(snapshot(), cold);
  }
});

test('search normalization preserves phrase exceptions, plain English and emoji', () => {
  assert.equal(simplifySearch('乾隆 著名 乾燥 金門大橋'), '乾隆 著名 干燥 金门大桥');
  assert.equal(simplifySearch('BAYLINK Fort Point 🌉 2026'), 'BAYLINK Fort Point 🌉 2026');
  assert.equal(simplifySearch(''), '');
});

test('繁體 readers search with the full opencc build: the same conversion as the search chunk, character for character', async () => {
  const full = await import('opencc-js');
  const { ConverterFactory, searchPhrases, searchCharacters } = await import('../src/i18n/search-dictionaries');
  const fromFull = full.ConverterFactory(full.Locale.to.cn);
  const fromChunk = ConverterFactory([searchPhrases, searchCharacters]);
  const toTraditional = full.ConverterFactory(full.Locale.from.cn, full.Locale.to.tw);
  const { guides } = await import('../src/data/guides');
  const { MONTHLY_EVENTS } = await import('../src/data/monthly-edition');
  const corpus = [...guides.flatMap(guide => [guide.title, guide.summary]), ...MONTHLY_EVENTS.flatMap(event => [event.title, event.venue, event.city])];
  assert.ok(corpus.length > 500);
  for (const text of corpus) for (const sample of [text, toTraditional(text)]) assert.equal(fromFull(sample), fromChunk(sample), sample);
});
