import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

export const ROUTE_LOCALES = ['zh-Hans', 'zh-Hant', 'en'];

/** Static module graph of the given manifest keys: the JS a visitor downloads before the route can render. */
export function moduleGraph(manifest, keys) {
  const files = new Set();
  const visit = key => {
    const item = manifest[key];
    if (!item) throw new Error(`Missing build module ${key}`);
    if (files.has(item.file)) return;
    files.add(item.file);
    for (const dependency of item.imports || []) visit(dependency);
  };
  for (const key of keys) visit(key);
  return files;
}

/** Scope name → manifest key, from the generated English scope registry. */
export function englishScopeModules(loaderSource) {
  return new Map([...loaderSource.matchAll(/"([^"]+)": \(\) => import\("\.\/(english-scopes\/[^"]+\.json)"\)/g)].map(match => [match[1], `src/data/generated/${match[2]}`]));
}

/**
 * Manifest keys each locale loads for one route: the shell and page graph, plus
 * the opencc converter for 繁體 and the scoped dictionaries for English
 * (src/i18n/locale.ts loadLocaleForPath).
 */
export function routeModules(manifest, { route, module }, locale, { englishScopesForPath, scopeModules }) {
  const keys = ['index.html', module];
  if (locale === 'zh-Hant') {
    const opencc = Object.keys(manifest).find(key => key.startsWith('node_modules/opencc-js/') && manifest[key].isDynamicEntry);
    if (!opencc) throw new Error('The 繁體 converter (opencc-js) is no longer a dynamic entry; update scripts/route-budgets.mjs');
    keys.push(opencc);
  }
  if (locale === 'en') {
    keys.push('src/data/generated/english-scope-loaders.ts');
    for (const scope of englishScopesForPath(route)) {
      const key = scopeModules.get(scope);
      if (!key) throw new Error(`English scope ${scope} for ${route} is missing from the scope registry`);
      keys.push(key);
    }
  }
  return keys;
}

/** Measure every budgeted route × locale in gzip bytes and compare with its KiB ceiling. */
export async function measureRouteBudgets(budgets, { dist = 'dist', root = '.', manifest } = {}) {
  manifest ||= JSON.parse(await readFile(join(dist, '.vite/manifest.json'), 'utf8'));
  let englishScopesForPath;
  try {
    ({ englishScopesForPath } = await import(pathToFileURL(join(root, 'src/lib/english-loading.ts')).href));
  } catch (error) {
    throw new Error(`Route budgets read English scopes from src/lib/english-loading.ts with Node's type stripping; keep that file free of imports and non-erasable syntax (${error.message})`);
  }
  const scopeModules = englishScopeModules(await readFile(join(root, 'src/data/generated/english-scope-loaders.ts'), 'utf8'));
  const sizes = new Map();
  const gzip = async file => {
    if (!sizes.has(file)) sizes.set(file, gzipSync(await readFile(join(dist, file))).length);
    return sizes.get(file);
  };
  const rows = [];
  for (const budget of budgets) {
    for (const locale of ROUTE_LOCALES) {
      const files = moduleGraph(manifest, routeModules(manifest, budget, locale, { englishScopesForPath, scopeModules }));
      let bytes = 0;
      for (const file of files) bytes += await gzip(file);
      const ceiling = budget.kib[locale];
      rows.push({ route: budget.route, locale, files: files.size, kib: bytes / 1024, ceiling, over: bytes / 1024 > ceiling });
    }
  }
  return rows;
}

/** Plain-text table for the release log; the suggestion is how far a ceiling can ratchet down. */
export function formatRouteBudgets(rows) {
  const width = Math.max(...rows.map(row => row.route.length));
  const lines = [`${'route'.padEnd(width)}  ${ROUTE_LOCALES.map(locale => `${locale} KiB / ceiling`.padStart(24)).join('')}`];
  for (const route of [...new Set(rows.map(row => row.route))]) {
    const cells = ROUTE_LOCALES.map(locale => {
      const row = rows.find(item => item.route === route && item.locale === locale);
      return `${row.over ? '!' : ' '}${row.kib.toFixed(1)} / ${row.ceiling.toFixed(1)}`.padStart(24);
    });
    lines.push(`${route.padEnd(width)}  ${cells.join('')}`);
  }
  const lower = rows.filter(row => !row.over && Math.ceil(row.kib * 1.02 * 10) / 10 + 1 <= row.ceiling);
  if (lower.length) lines.push(`Ceilings that can ratchet down (measured + 2%): ${lower.map(row => `${row.route} ${row.locale} → ${(Math.ceil(row.kib * 1.02 * 10) / 10).toFixed(1)}`).join('; ')}`);
  return lines.join('\n');
}
