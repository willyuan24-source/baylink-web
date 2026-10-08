import assert from 'node:assert/strict';
import test from 'node:test';
import { englishScopeModules, formatRouteBudgets, moduleGraph, routeModules } from '../scripts/route-budgets.mjs';

const manifest = {
  'index.html': { file: 'assets/index.js', imports: ['_react.js'] },
  '_react.js': { file: 'assets/react.js' },
  'src/pages/GuidesPage.tsx': { file: 'assets/guides-page.js', imports: ['_react.js', '_guides.js'] },
  '_guides.js': { file: 'assets/guides.js' },
  'node_modules/opencc-js/dist/esm/full.js': { file: 'assets/full.js', isDynamicEntry: true },
  'src/data/generated/english-scope-loaders.ts': { file: 'assets/loaders.js' },
  'src/data/generated/english-scopes/ui.json': { file: 'assets/ui.js' },
  'src/data/generated/english-scopes/guide-index.json': { file: 'assets/guide-index.js' },
};
const scopeModules = englishScopeModules('export const englishScopeLoaders = {\n  "ui": () => import("./english-scopes/ui.json"),\n  "guide-index": () => import("./english-scopes/guide-index.json"),\n};\n');
const budget = { route: '/guides', module: 'src/pages/GuidesPage.tsx' };
const graph = locale => [...moduleGraph(manifest, routeModules(manifest, budget, locale, { englishScopesForPath: () => ['ui', 'guide-index'], scopeModules }))].sort();

test('each locale budget counts the shared shell once, plus the converter or dictionaries that locale loads', () => {
  assert.deepEqual(graph('zh-Hans'), ['assets/guides-page.js', 'assets/guides.js', 'assets/index.js', 'assets/react.js']);
  assert.deepEqual(graph('zh-Hant'), ['assets/full.js', 'assets/guides-page.js', 'assets/guides.js', 'assets/index.js', 'assets/react.js']);
  assert.deepEqual(graph('en'), ['assets/guide-index.js', 'assets/guides-page.js', 'assets/guides.js', 'assets/index.js', 'assets/loaders.js', 'assets/react.js', 'assets/ui.js']);
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
