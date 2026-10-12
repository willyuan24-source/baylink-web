import assert from 'node:assert/strict';
import test from 'node:test';
import { englishScopeModules, formatRouteBudgets, moduleGraph, routeModules, SEARCH_DICTIONARIES, TRADITIONAL } from '../scripts/route-budgets.mjs';
import { searchFreePath } from '../src/lib/english-loading.ts';

const manifest = {
  'index.html': { file: 'assets/index.js', imports: ['_react.js'] },
  '_react.js': { file: 'assets/react.js' },
  'src/pages/GuidesPage.tsx': { file: 'assets/guides-page.js', imports: ['_react.js', '_guides.js'] },
  '_guides.js': { file: 'assets/guides.js' },
  'node_modules/opencc-js/dist/esm-lib/core.js': { file: 'assets/opencc-core.js' },
  'node_modules/opencc-js/dist/esm/full.js': { file: 'assets/full.js', isDynamicEntry: true },
  [TRADITIONAL]: { file: 'assets/traditional.js', isDynamicEntry: true, imports: ['node_modules/opencc-js/dist/esm-lib/core.js'] },
  [SEARCH_DICTIONARIES]: { file: 'assets/search-dictionaries.js', isDynamicEntry: true, imports: ['node_modules/opencc-js/dist/esm-lib/core.js'] },
  'src/pages/HomePage.tsx': { file: 'assets/home-page.js', imports: ['_react.js'] },
  'src/data/generated/english-scope-loaders.ts': { file: 'assets/loaders.js' },
  'src/data/generated/english-scopes/ui.json': { file: 'assets/ui.js' },
  'src/data/generated/english-scopes/guide-index.json': { file: 'assets/guide-index.js' },
};
const scopeModules = englishScopeModules('export const englishScopeLoaders = {\n  "ui": () => import("./english-scopes/ui.json"),\n  "guide-index": () => import("./english-scopes/guide-index.json"),\n};\n');
const budget = { route: '/guides', module: 'src/pages/GuidesPage.tsx' };
const graph = (locale, page = budget) => [...moduleGraph(manifest, routeModules(manifest, page, locale, { englishScopesForPath: () => ['ui', 'guide-index'], scopeModules, searchFreePath }))].sort();

test('each locale budget counts the shared shell once, plus the converter or dictionaries that locale loads', () => {
  assert.deepEqual(graph('zh-Hans'), ['assets/guides-page.js', 'assets/guides.js', 'assets/index.js', 'assets/opencc-core.js', 'assets/react.js', 'assets/search-dictionaries.js']);
  // 繁體: the site's converter (WEB-DATA-SPLIT) and, on a page that searches, the same search dictionaries; never the full build.
  assert.deepEqual(graph('zh-Hant'), ['assets/guides-page.js', 'assets/guides.js', 'assets/index.js', 'assets/opencc-core.js', 'assets/react.js', 'assets/search-dictionaries.js', 'assets/traditional.js']);
  assert.deepEqual(graph('en'), ['assets/guide-index.js', 'assets/guides-page.js', 'assets/guides.js', 'assets/index.js', 'assets/loaders.js', 'assets/opencc-core.js', 'assets/react.js', 'assets/search-dictionaries.js', 'assets/ui.js']);
});

test('the homepage does not count the search dictionaries (it loads them on the first search); 繁體 takes the site converter', () => {
  const home = { route: '/', module: 'src/pages/HomePage.tsx' };
  assert.deepEqual(graph('zh-Hans', home), ['assets/home-page.js', 'assets/index.js', 'assets/react.js']);
  assert.deepEqual(graph('zh-Hant', home), ['assets/home-page.js', 'assets/index.js', 'assets/opencc-core.js', 'assets/react.js', 'assets/traditional.js']);
  assert.ok(!graph('en', home).includes('assets/search-dictionaries.js'));
  const { [SEARCH_DICTIONARIES]: _dictionaries, ...withoutSearch } = manifest;
  assert.throws(() => routeModules(withoutSearch, budget, 'zh-Hans', { englishScopesForPath: () => [], scopeModules, searchFreePath }), /search dictionaries/);
});

test('a page that loads its data before rendering counts that data chunk too (a guide article and its record)', () => {
  const withRecord = { ...manifest, 'src/data/generated/guides/a.json': { file: 'assets/a.js', isDynamicEntry: true } };
  const article = { route: '/guides/a', module: 'src/pages/GuidesPage.tsx', data: ['src/data/generated/guides/a.json'] };
  assert.ok([...moduleGraph(withRecord, routeModules(withRecord, article, 'zh-Hans', { englishScopesForPath: () => [], scopeModules, searchFreePath }))].includes('assets/a.js'));
  assert.throws(() => moduleGraph(manifest, routeModules(manifest, article, 'zh-Hans', { englishScopesForPath: () => [], scopeModules, searchFreePath })), /Missing build module/);
});

test('a missing page module or English scope fails loudly instead of measuring less', () => {
  assert.throws(() => moduleGraph(manifest, ['src/pages/Missing.tsx']), /Missing build module/);
  assert.throws(() => routeModules(manifest, budget, 'en', { englishScopesForPath: () => ['ui', 'planning'], scopeModules }), /planning/);
});

test('the release table marks routes over their ceiling and shows how far others can ratchet down', () => {
  const table = formatRouteBudgets([
    { route: '/guides', locale: 'zh-Hans', kib: 900, ceiling: 1000, over: false },
    { route: '/guides', locale: 'zh-Hant', kib: 1100, ceiling: 1000, over: true },
    { route: '/guides', locale: 'en', kib: 999, ceiling: 1000, over: false },
  ]);
  assert.match(table, /!1100\.0 \/ 1000\.0/);
  assert.match(table, /\/guides zh-Hans → 918\.0/);
  assert.doesNotMatch(table, /\/guides en →/);
});
