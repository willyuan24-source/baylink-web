import assert from 'node:assert/strict';
import test from 'node:test';
import { searchQuickDestinations } from '../src/lib/quick-search';
import { normalizeGuideQuery } from '../src/lib/guide-search';
import { getLocale, setLocale, simplifySearch, type Locale } from '../src/i18n/locale';

// This file runs in its own test process, before any locale dictionary is loaded.
test('traditional queries work on a cold page and keep the same rules after every locale load', async () => {
  assert.equal(getLocale(), 'zh-Hans');
  const examples = [
    { query: '金門大橋', simplified: '金门大桥', kind: 'attractions', id: 'golden-gate' },
    { query: '房貸', simplified: '房贷', kind: 'tools', id: 'loan' },
    { query: '鋼琴', simplified: '钢琴', kind: 'events', id: 'flower-piano-2026' },
    { query: '淨灘', simplified: '净滩', kind: 'events', id: 'treasure-island-coastal-cleanup-2026' },
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
