import assert from 'node:assert/strict';
import test from 'node:test';
import { titleBreakPieces } from '../src/lib/title-breaks';
import { localDiscoveries, discoveryShare } from '../src/data/local-discoveries';
import { loadLocale, translateText } from '../src/i18n/locale';

const units = (text: string, locale: 'zh-Hans' | 'zh-Hant' = 'zh-Hans') => titleBreakPieces(text, locale)!.filter(piece => piece.keep).map(piece => piece.text);

test('detail titles break between words: festival names, Chinese compounds and Latin place names stay whole', () => {
  assert.deepEqual(units('Marinwood 万圣节收获庆典'), ['万圣节', '收获', '庆典']);
  assert.deepEqual(units('Santana Row 玻璃南瓜艺术节'), ['Santana Row', '玻璃', '南瓜', '艺术节']);
  assert.deepEqual(units('San Francisco Fleet Week：海湾与城市活动周'), ['San Francisco', 'Fleet Week', '海湾', '城市', '活动周']);
  assert.ok(units('San Leandro 不吓人的亲子游戏日').includes('不吓人的'), 'single characters stay together instead of cutting 吓人');
  assert.ok(units('Santa Rosa Ross Street 周日市集').includes('周日市集'));
  assert.ok(units('South San Francisco 节日手作市集').includes('San Francisco'), 'San binds to the next word');
  assert.deepEqual(units('Marinwood 萬聖節收穫慶典', 'zh-Hant'), ['萬聖節', '收穫', '慶典']);
});

test('a long run of English words is grouped in linear time', () => {
  const words = Array.from({ length: 30 }, (_, index) => ['a', 'of', 'Bay', 'Art', 'the', 'Fair'][index % 6]).join(' ');
  titleBreakPieces('Marinwood 万圣节', 'zh-Hans');
  const started = performance.now();
  const pieces = titleBreakPieces(`${words} 活动`, 'zh-Hans')!;
  const elapsed = performance.now() - started;
  // Trying every grouping took about 5 s at 24 words and doubled with each word; one plan per start word takes well under 1 ms.
  assert.ok(elapsed < 50, `${elapsed.toFixed(1)}ms`);
  assert.equal(pieces.map(piece => piece.text).join(''), `${words} 活动`);
  assert.ok(pieces.filter(piece => piece.keep && !/\p{Script=Han}/u.test(piece.text)).every(piece => piece.text.length <= 14));
});

test('pieces join back to the exact title and units stay within the phone width', async () => {
  await loadLocale('zh-Hant');
  for (const item of localDiscoveries) {
    const title = item.kind === 'offer' ? item.offer.title : discoveryShare(item).title;
    for (const [locale, text] of [['zh-Hans', title], ['zh-Hant', translateText(title, 'zh-Hant')]] as const) {
      const pieces = titleBreakPieces(text, locale);
      if (!pieces) { assert.doesNotMatch(text, /\p{Script=Han}/u, `${title}: Chinese titles are segmented`); continue; }
      assert.equal(pieces.map(piece => piece.text).join(''), text, `${locale} ${title}`);
      for (const { text: unit } of pieces.filter(piece => piece.keep)) {
        assert.ok(/\p{Script=Han}/u.test(unit) ? unit.length <= 8 : unit.length <= 14, `${locale} ${title}: ${unit}`);
      }
    }
  }
});

test('English, Latin-only titles and engines without a Chinese word dictionary keep plain text', t => {
  assert.equal(titleBreakPieces('Marinwood Halloween Harvest Festival', 'en'), null);
  assert.equal(titleBreakPieces('Marinwood 万圣节收获庆典', 'en'), null, 'an English page whose dictionary has not loaded yet');
  assert.equal(titleBreakPieces('Dead Letter', 'zh-Hans'), null);
  const Segmenter = Intl.Segmenter;
  const stub = (value: unknown) => Object.defineProperty(Intl, 'Segmenter', { value, configurable: true, writable: true });
  t.after(() => stub(Segmenter));
  // A per-character engine (no CJK dictionary) would turn every guess into a nowrap unit.
  stub(class extends Segmenter {
    segment(input: string) { return Array.from(input, (segment, index) => ({ segment, index, input, isWordLike: true })) as unknown as Intl.Segments; }
  });
  assert.equal(titleBreakPieces('Marinwood 万圣节收获庆典', 'zh-Hans'), null);
  stub(undefined);
  assert.equal(titleBreakPieces('Marinwood 万圣节收获庆典', 'zh-Hans'), null);
  stub(Segmenter);
  assert.ok(titleBreakPieces('Marinwood 万圣节收获庆典', 'zh-Hans'));
});
