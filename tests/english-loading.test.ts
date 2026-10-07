import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createEnglishScopeLoader, englishScopesForFeature, englishScopesForPath } from '../src/lib/english-loading';
import { getGuideBySlug } from '../src/data/guides';
import { isLocaleReadyForPath, loadLocale, loadLocaleForPath, normalizeText, translateText } from '../src/i18n/locale';
import { LIFE_TOOLS, TOOLS_METADATA } from '../src/data/tool-catalog';
import { englishDictionaryForUiScope, englishDictionaryForUiValues, englishDictionaryForValues } from '../scripts/generate-english-scopes';
import { ATTRACTION_REGION_INTROS } from '../src/data/attraction-region-intros';
import { currentRegionalBulletins } from '../src/data/october-2026-bulletins';
import { EVENT_SCHEDULE_NOTES } from '../src/data/event-calendar-dates';

test('editorial prose in historical UI files stays in its content scope while shared UI and dynamic labels remain ready', () => {
  const full = { '攻略正文': 'Reviewed article body', '共用说明': 'Shared guidance', '新店 · 已开业': 'New opening · Open now' };
  const supplemental = { ...full, '攻略正文': 'Older article body', '共用说明': 'Older guidance' };
  const ui = englishDictionaryForUiScope(full, ['共用说明'], [supplemental], ['攻略正文', '共用说明']);
  assert.equal(Object.hasOwn(ui, '攻略正文'), false, 'the unrelated article is not part of every route');
  assert.equal(ui['共用说明'], full['共用说明'], 'a real UI reference keeps the final reviewed translation');
  assert.equal(ui['新店 · 已开业'], full['新店 · 已开业'], 'composed labels remain available without loading a catalog');
  const article = englishDictionaryForValues(full, ['攻略正文', '共用说明']);
  assert.deepEqual({ ...ui, ...article }, full, 'loading the owning content scope preserves every translation');
});

test('generated content scopes preserve prose moved out of global UI, including discovery and region planning', () => {
  const scope = (name: string) => JSON.parse(readFileSync(new URL(`../src/data/generated/english-scopes/${name}.json`, import.meta.url), 'utf8')) as Record<string, string>;
  const ui = scope('ui');
  const full = JSON.parse(readFileSync(new URL('../src/data/generated/english.json', import.meta.url), 'utf8')) as Record<string, string>;
  const intro = ATTRACTION_REGION_INTROS['east-bay'].text;
  assert.ok(!Object.hasOwn(ui, normalizeText(intro)), 'regional editorial prose must not increase every page load');
  for (const name of ['planning', 'explore']) assert.equal(scope(name)[normalizeText(intro)], full[normalizeText(intro)]);
  const discovery = { ...ui, ...scope('discovery') };
  for (const bulletin of currentRegionalBulletins) {
    const key = normalizeText(bulletin.summary);
    if (full[key]) assert.equal(discovery[key], full[key], bulletin.id);
  }
  for (const [id, note] of Object.entries(EVENT_SCHEDULE_NOTES)) {
    const key = normalizeText(note);
    assert.ok(full[key], `${id}: the calendar note needs a reviewed translation`);
    assert.equal(discovery[key], full[key], `${id}: calendar notes belong in discovery, not global UI`);
  }
  const guide = getGuideBySlug('bay-area-retail-freebies-family-deals')!;
  assert.ok(guide, 'the retailer article exercises prose formerly forced into UI');
  const article = { ...ui, ...scope('guide-index'), ...scope(`guide-${guide.slug}`) };
  const prose = [guide.summary, guide.sourceNote, ...guide.blocks.flatMap(block => block.type === 'paragraph' ? [block.text] : [])];
  for (const value of prose) {
    if (!value) continue;
    const key = normalizeText(value);
    if (full[key]) assert.equal(article[key], full[key], value);
  }
});

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
