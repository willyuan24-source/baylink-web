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
