import assert from 'node:assert/strict';
import test from 'node:test';
import { compareWithBaseline, englishDictionaryKeys, measureEnglishUi, measureRepository, readBaseline } from '../scripts/check-style-ratchet.mjs';

test('Chinese UI literals count unless the dictionary or the same expression supplies English', () => {
  const source = `
    import picture from './图片.png';
    const translated = <p>已翻译</p>;
    const paired = t('首页', 'Home');
    const ternary = locale === 'en' ? 'Loading' : locale === 'zh-Hant' ? '載入中' : '加载中';
    const keyed = { zh: '活动', en: 'Events' };
    const pattern = \`\${count} 场活动\`;
    const missing = <p>没有英文</p>;
    const template = \`共 \${count} 条\`;
    const english = 'Only English';
  `;
  const result = measureEnglishUi([{ file: 'src/components/Example.tsx', text: source }], { 已翻译: 'Translated' }, { '{0} 场活动': '{0} events' });
  assert.deepEqual(result.strings, ['共 {0} 条', '没有英文']);
  assert.deepEqual(result.occurrences.map(item => `${item.file}:${item.line}`), ['src/components/Example.tsx:8', 'src/components/Example.tsx:9']);
});

test('an id-like neighbour argument is not English unless the callee translates', () => {
  const source = `
    track('点击', 'cta');
    showToast('已保存', 'error');
    showToast('已复制', 'Copied to clipboard');
    text('人', 'people');
    ui.t('站', 'stops');
    const again = <p>没有英文</p>;
    const twice = <span>没有英文</span>;
  `;
  const result = measureEnglishUi([{ file: 'src/components/Example.tsx', text: source }], {});
  assert.deepEqual(result.strings, ['已保存', '没有英文', '点击']);
  // Distinct strings: a second use of an already-listed literal does not raise the count.
  assert.equal(result.count, 3);
  assert.equal(result.occurrences.length, 4);
});

test('the dictionary is read from its sources, not the generated copy', () => {
  const keys = englishDictionaryKeys();
  assert.ok(Object.keys(keys).length > 10000);
  assert.ok(Object.hasOwn(keys, '首页') || Object.keys(keys).some(key => /[㐀-鿿]/.test(key)));
});

test('untranslated UI literals in app, components, features and pages never increase', () => {
  const baseline = readBaseline();
  assert.ok(baseline, 'the ratchet baseline is committed');
  const measured = measureRepository();
  assert.ok(measured.englishUi.count <= baseline.counts.englishUiUntranslated,
    compareWithBaseline(measured, baseline).filter(problem => problem.startsWith('englishUiUntranslated')).join('\n'));
});
