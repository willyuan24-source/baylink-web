// W9-E · ui/entrySource.ts (the wave-9 contract, sf-w9-lead.md §4): where a visit came from, read once from ?from=, kept for
// the tab, removed from the address bar (every other parameter, the hash and the history state kept).
import assert from 'node:assert/strict';
import test from 'node:test';
import { ENTRY_SOURCES, __resetEntrySourceForTests, entrySource, parseEntrySource, searchWithoutFrom, withEntrySource, type EntryEnv } from '../src/opus-bay/ui/entrySource';

function fakeEnv(href: string, store: Record<string, string> = {}) {
  const u = new URL(href, 'https://www.baylink.us');
  const replaced: string[] = [];
  const location = { pathname: u.pathname, search: u.search, hash: u.hash };
  const env: EntryEnv = {
    location,
    replace: (url: string) => { replaced.push(url); const n = new URL(url, 'https://www.baylink.us'); location.search = n.search; location.hash = n.hash; },
    storage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } },
  };
  return { env, replaced, store, location };
}

test('W9-E entrySource: the nine sources; unknown words are direct; no parameter is null (parse)', () => {
  assert.deepEqual([...ENTRY_SOURCES], ['home', 'nav', 'play', 'photo', 'family', 'share', 'guide', 'promo', 'direct']);
  for (const s of ENTRY_SOURCES) assert.equal(parseEntrySource(`?from=${s}`), s);
  assert.equal(parseEntrySource('?from=HOME'), 'home');
  assert.equal(parseEntrySource('?from=%20nav%20'), 'nav');
  assert.equal(parseEntrySource('?from=wechat-group'), 'direct');
  assert.equal(parseEntrySource('?from='), 'direct');
  assert.equal(parseEntrySource('?lang=en'), null);
  assert.equal(parseEntrySource(''), null);
});

test('W9-E entrySource: read once, removed from the URL with lang / other params / hash kept, then the same answer', () => {
  __resetEntrySourceForTests();
  const { env, replaced, store, location } = fakeEnv('/opus-bay?lang=en&from=home&halloween=1#x');
  assert.equal(entrySource(env), 'home');
  assert.deepEqual(replaced, ['/opus-bay?lang=en&halloween=1#x']);
  assert.equal(location.search, '?lang=en&halloween=1');
  assert.equal(store['opus-bay:from'], 'home');
  assert.equal(entrySource(env), 'home', 'later callers (metrics) get the same source');
  assert.equal(replaced.length, 1, 'nothing more to strip');
});

test('W9-E entrySource: no parameter → direct; a reload in the same tab keeps the stored source; a new from= wins', () => {
  __resetEntrySourceForTests();
  assert.equal(entrySource(fakeEnv('/opus-bay').env), 'direct');
  __resetEntrySourceForTests();
  const store: Record<string, string> = {};
  assert.equal(entrySource(fakeEnv('/opus-bay?from=nav', store).env), 'nav');
  __resetEntrySourceForTests(); // the page reloaded (GameRoot's one reload after a lost chunk)
  assert.equal(entrySource(fakeEnv('/opus-bay', store).env), 'nav');
  assert.equal(entrySource(fakeEnv('/opus-bay?from=photo', store).env), 'photo', 'an SPA re-entry with a new source');
  assert.equal(entrySource(fakeEnv('/opus-bay', store).env), 'photo');
  __resetEntrySourceForTests();
  assert.equal(entrySource(fakeEnv('/opus-bay', { 'opus-bay:from': 'not-a-source' }).env), 'direct');
});

test('W9-E entrySource: never throws (no window, storage blocked, replaceState refused)', () => {
  __resetEntrySourceForTests();
  assert.equal(entrySource({ location: null, replace: null, storage: null }), 'direct');
  __resetEntrySourceForTests();
  const boom = () => { throw new Error('SecurityError'); };
  const env: EntryEnv = { location: { pathname: '/opus-bay', search: '?from=promo', hash: '' }, replace: boom, storage: { getItem: boom, setItem: boom } };
  assert.equal(entrySource(env), 'promo');
  __resetEntrySourceForTests();
  assert.equal(entrySource({ location: { pathname: '/opus-bay', search: '', hash: '' }, replace: boom, storage: { getItem: boom, setItem: boom } }), 'direct');
  __resetEntrySourceForTests();
});

test('W9-E entrySource helpers: searchWithoutFrom and withEntrySource keep the other parameters and the hash', () => {
  assert.equal(searchWithoutFrom('?from=home'), '');
  assert.equal(searchWithoutFrom('?a=1&from=home&b=2'), '?a=1&b=2');
  assert.equal(withEntrySource('/opus-bay', 'home'), '/opus-bay?from=home');
  assert.equal(withEntrySource('/opus-bay?lang=en', 'nav'), '/opus-bay?lang=en&from=nav');
  assert.equal(withEntrySource('/opus-bay?from=home&at=coit#map', 'photo'), '/opus-bay?at=coit&from=photo#map');
  assert.equal(withEntrySource('https://www.baylink.us/opus-bay?from=x', 'direct'), 'https://www.baylink.us/opus-bay');
});
