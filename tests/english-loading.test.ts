import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createEnglishScopeLoader, englishScopesForFeature, englishScopesForPath } from '../src/lib/english-loading';
import { getGuideBySlug } from '../src/data/guides';
import { isLocaleReadyForPath, loadLocale, loadLocaleForPath, normalizeText, translateText } from '../src/i18n/locale';
import { LIFE_TOOLS, TOOLS_METADATA } from '../src/data/tool-catalog';
import { englishDictionaryForUiValues } from '../scripts/generate-english-scopes';

test('the compact UI dictionary includes all eight tools catalog labels and page metadata without loading editorial bodies', () => {
  const full = JSON.parse(readFileSync(new URL('../src/data/generated/english.json', import.meta.url), 'utf8')) as Record<string, string>;
  const selected = englishDictionaryForUiValues(full, []);
  assert.equal(LIFE_TOOLS.length, 8);
  for (const tool of LIFE_TOOLS) for (const field of ['title', 'short', 'description', 'tag'] as const) {
    const key = normalizeText(tool[field]);
    assert.ok(full[key], `missing reviewed translation for ${tool.id}.${field}`);
    assert.equal(selected[key], full[key], `${tool.id}.${field} must be in the tools route's UI pack`);
    assert.doesNotMatch(selected[key], /[\u3400-\u9fff]/u);
  }
  for (const field of ['title', 'description'] as const) assert.equal(selected[normalizeText(TOOLS_METADATA[field])], full[normalizeText(TOOLS_METADATA[field])]);
  assert.deepEqual(englishScopesForPath('/en/tools?tool=split'), ['ui'], 'the controlled catalog belongs in the small UI pack');
  assert.ok(!Object.hasOwn(selected, normalizeText(getGuideBySlug('bay-area-medicare-hicap-medi-cal-guide')!.summary)), 'tools do not import unrelated guide text');
});

test('English home and article navigation request only their displayed content, including language prefixes', () => {
  assert.deepEqual(englishScopesForPath('/en/?lang=en#weekend'), ['ui', 'home']);
  assert.deepEqual(englishScopesForPath('/zh-Hant/calendar?cost=free'), ['ui', 'discovery', 'guide-index']);
  assert.deepEqual(englishScopesForPath('/en/guides/medicare?q=help', scope => scope !== 'guide:missing'), ['ui', 'guide-index', 'guide:medicare']);
  assert.deepEqual(englishScopesForPath('/en/guides/missing', scope => scope !== 'guide:missing'), ['ui', 'guide-index']);
  assert.deepEqual(englishScopesForPath('/guides'), ['ui', 'guide-index', 'guide-search']);
  assert.ok(!englishScopesForPath('/').includes('guide-search'));
  assert.ok(englishScopesForFeature('search').includes('guide-search'));
  assert.ok(englishScopesForPath('/category/housing').includes('guide-index'));
});

test('English scope readiness waits for every body, coalesces requests and retries failures without losing loaded UI', async () => {
  let uiCalls = 0, bodyCalls = 0;
  let resolveBody!: (value: { default: Record<string, string> }) => void;
  const merged: Record<string, string> = {};
  const loader = createEnglishScopeLoader({
    ui: async () => { uiCalls++; return { default: { '返回': 'Back' } }; },
    'guide:one': async () => {
      bodyCalls++;
      if (bodyCalls === 1) throw new Error('Offline');
      return new Promise(resolve => { resolveBody = resolve; });
    },
  }, dictionary => Object.assign(merged, dictionary));
  await assert.rejects(loader.load(['ui', 'guide:one']), /Offline/u);
  assert.equal(loader.isReady(['ui']), true);
  assert.equal(loader.isReady(['ui', 'guide:one']), false);
  const first = loader.load(['ui', 'guide:one']);
  const second = loader.load(['ui', 'guide:one']);
  assert.equal(bodyCalls, 2);
  assert.equal(loader.isReady(['guide:one']), false);
  resolveBody({ default: { '正文': 'Full article' } });
  await Promise.all([first, second]);
  assert.equal(loader.isReady(['ui', 'guide:one']), true);
  assert.equal(uiCalls, 1);
  assert.equal(bodyCalls, 2);
  assert.deepEqual(merged, { '返回': 'Back', '正文': 'Full article' });
  await assert.rejects(loader.load(['unknown']), /Unknown English/u);
});

test('actual scoped runtime leaves other articles unloaded, then supplies the complete requested body and preserves full export loading', async () => {
  const path = '/en/guides/bay-area-medicare-hicap-medi-cal-guide';
  const guide = getGuideBySlug('bay-area-medicare-hicap-medi-cal-guide')!;
  const full = JSON.parse(readFileSync(new URL('../src/data/generated/english.json', import.meta.url), 'utf8')) as Record<string, string>;
  assert.equal(isLocaleReadyForPath('en', '/en'), false);
  await loadLocaleForPath('en', '/en');
  assert.equal(isLocaleReadyForPath('en', '/en'), true);
  assert.equal(translateText('邻里信息', 'en'), 'Neighborhood board', 'the controlled board heading must be English before loading any article');
  assert.equal(translateText('正在打开搜索…', 'en'), 'Opening search…');
  assert.equal(translateText('正在打开 BayBay…', 'en'), 'Opening BayBay…');
  assert.equal(translateText('新店 · 已开业', 'en'), 'New opening · Open now', 'composed opening labels belong in the UI pack');
  assert.equal(translateText('用这家店开始出游计划', 'en'), 'Plan a day around this place');
  assert.equal(translateText('当前筛选结果 1 条，近 30 天发布 0 条。', 'en'), 'Matching listings: 1; posted in the past 30 days: 0. ');
  assert.equal(translateText('当前已加载 20 条，近 30 天发布 3 条。', 'en'), 'Listings loaded so far: 20; posted in the past 30 days: 3. ');
  assert.equal(translateText('正在读取当前邻里信息…', 'en'), 'Loading current neighborhood listings…');
  assert.doesNotMatch(translateText('这里还在起步，旧帖请先联系发布者确认有效。', 'en'), /[\u3400-\u9fff]/u);
  assert.equal(isLocaleReadyForPath('en', path), false, 'home readiness cannot unlock an untranslated article');
  await loadLocaleForPath('en', ['/en', path]);
  assert.equal(isLocaleReadyForPath('en', path), true);
  const visit = (value: unknown): string[] => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(visit) : [];
  const known = visit(guide).filter(text => /[\u3400-\u9fff]/u.test(text) && full[normalizeText(text)]);
  assert.ok(known.length > 30, 'exercise the whole article, including sources, templates and eligibility notes');
  for (const text of known) assert.equal(translateText(text, 'en').trim(), full[normalizeText(text)].trim(), text);
  assert.equal(isLocaleReadyForPath('en', '/en/guides/bay-area-free-tax-help-vita-calfile-guide'), false, 'another article is still lazy');
  await loadLocale('en');
  assert.equal(isLocaleReadyForPath('en', '/en/guides/bay-area-free-tax-help-vita-calfile-guide'), true, 'full loading remains available for SSR/export/tests');
});
