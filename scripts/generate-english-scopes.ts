import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import ts from 'typescript';
import { guides, GUIDE_CATEGORY_TABS } from '../src/data/guides';
import { getGuideMedia, GUIDE_IMAGES } from '../src/data/guide-media';
import { MONTHLY_EDITION, MONTHLY_EVENTS, MONTHLY_PLACES } from '../src/data/monthly-edition';
import { currentFreebies } from '../src/data/october-offers';
import { currentOpenings } from '../src/data/local-discoveries';
import { currentRegionalBulletins } from '../src/data/october-2026-bulletins';
import { PLANNER_CATALOG } from '../src/data/planner-catalog';
import { ATTRACTIONS, ATTRACTION_COSTS, ATTRACTION_REGIONS, ATTRACTION_THEMES } from '../src/data/attractions';
import { ATTRACTION_REGION_INTROS } from '../src/data/attraction-region-intros';
import { READER_PATHS } from '../src/data/reader-paths';
import { perksPosters } from '../src/data/perks-posters';
import { LIFE_TOOLS, TOOLS_METADATA } from '../src/data/tool-catalog';
import type { EnglishDictionary } from '../src/lib/english-loading';

const normalize = (text: string) => text.trim().replace(/\s+/gu, ' ');
const chinese = /[\u3400-\u9fff]/u;

/** Select from the reviewed complete dictionary; never manufacture translations. */
export function englishDictionaryForValues(dictionary: EnglishDictionary, values: unknown): EnglishDictionary {
  const selected: EnglishDictionary = {};
  const visit = (value: unknown) => {
    if (typeof value === 'string') {
      if (!chinese.test(value)) return;
      const key = normalize(value);
      if (Object.hasOwn(dictionary, key)) selected[key] = dictionary[key];
      for (const part of value.split(/\n| · | \/ |｜|：/u)) {
        const fragment = normalize(part);
        if (fragment !== key && Object.hasOwn(dictionary, fragment)) selected[fragment] = dictionary[fragment];
      }
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(values);
  return selected;
}

/** Catalog fields rendered as UI are controlled labels, not editorial bodies or user drafts. */
export function englishDictionaryForUiValues(dictionary: EnglishDictionary, sourceStrings: unknown): EnglishDictionary {
  return englishDictionaryForValues(dictionary, [sourceStrings, LIFE_TOOLS, TOOLS_METADATA]);
}

/** Historical UI source files also contain editorial prose; its owning content packs supply it. */
export function englishDictionaryForUiScope(dictionary: EnglishDictionary, sourceStrings: unknown, supplementalDictionaries: EnglishDictionary[], editorialValues: unknown): EnglishDictionary {
  const requiredUi = englishDictionaryForUiValues(dictionary, sourceStrings);
  const editorial = englishDictionaryForValues(dictionary, editorialValues);
  const ui = { ...requiredUi };
  for (const supplemental of supplementalDictionaries) {
    for (const [key, value] of Object.entries(supplemental)) {
      // Actual UI references take priority even when they share an editorial string.
      // Keep supplemental dynamic labels that cannot be found as complete AST literals.
      if (Object.hasOwn(requiredUi, key) || !Object.hasOwn(editorial, key)) ui[key] = value;
    }
  }
  // Keep final source precedence identical across full and scoped loads.
  for (const key of Object.keys(ui)) if (Object.hasOwn(dictionary, key)) ui[key] = dictionary[key];
  return ui;
}

async function uiStrings(directories = ['app', 'components', 'features', 'lib', 'pages', 'i18n', 'utils']): Promise<string[]> {
  const strings: string[] = [];
  const scan = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await scan(path);
      else if (/\.tsx?$/u.test(entry.name)) {
        const source = ts.createSourceFile(path, await readFile(path, 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
        const visit = (node: ts.Node) => {
          if (ts.isStringLiteralLike(node) || ts.isJsxText(node) || node.kind === ts.SyntaxKind.TemplateHead || node.kind === ts.SyntaxKind.TemplateMiddle || node.kind === ts.SyntaxKind.TemplateTail) {
            const text = (node as ts.StringLiteral).text;
            if (chinese.test(text)) strings.push(text);
          }
          ts.forEachChild(node, visit);
        };
        visit(source);
      }
    }
  };
  // The 3D world and editorial data have independent content packs.
  await Promise.all(directories.map(directory => scan(`src/${directory}`)));
  // Parallel file reads must not change dictionary order or asset hashes.
  return strings.sort();
}

export async function generateEnglishScopes(dictionary: EnglishDictionary, dictionarySources: string[]) {
  const directory = 'src/data/generated/english-scopes';
  await mkdir(directory, { recursive: true });
  const uiDictionaries = await Promise.all(dictionarySources.filter(path => /(?:-ui-en|audit-runtime-en|public-service-media-en)\.json$/u.test(path)).map(async path => JSON.parse(await readFile(path, 'utf8')) as EnglishDictionary));
  // These fields are already covered by the guide, discovery, planning and explore packs below.
  // Home selects any of them it actually displays from its own materialized catalog.
  const editorialProse = [
    guides.map(guide => [guide.summary, guide.sourceNote, guide.blocks.flatMap(block => block.type === 'paragraph' ? [block.text] : [])]),
    currentRegionalBulletins.map(bulletin => bulletin.summary),
    Object.values(ATTRACTION_REGION_INTROS).map(intro => [intro.text, intro.planning]),
  ];
  const ui = englishDictionaryForUiScope(dictionary, await uiStrings(), uiDictionaries, editorialProse);
  const remaining = (values: unknown) => Object.fromEntries(Object.entries(englishDictionaryForValues(dictionary, values)).filter(([key]) => !Object.hasOwn(ui, key)));
  const guideIndex = [guides.map(guide => ({ ...Object.fromEntries(Object.entries(guide).filter(([key]) => key !== 'blocks')), media: getGuideMedia(guide).cover })), GUIDE_CATEGORY_TABS, READER_PATHS];
  const scopeValues: Record<string, unknown> = {
    game: await uiStrings(['opus-bay']),
    home: JSON.parse(await readFile('src/data/generated/home-catalog.json', 'utf8')),
    'guide-index': guideIndex,
    'guide-search': [guides, guides.map(getGuideMedia), perksPosters],
    discovery: [MONTHLY_EDITION, MONTHLY_EVENTS, MONTHLY_PLACES, currentFreebies, currentOpenings, currentRegionalBulletins, GUIDE_IMAGES, perksPosters],
    planning: [PLANNER_CATALOG, ATTRACTION_REGION_INTROS],
    explore: [ATTRACTIONS, ATTRACTION_COSTS, ATTRACTION_REGIONS, ATTRACTION_THEMES, ATTRACTION_REGION_INTROS, ATTRACTIONS.map(place => { const guide = guides.find(item => item.slug === place.slug); return guide ? getGuideMedia(guide) : undefined; })],
  };
  const registry: Record<string, string> = { ui: 'ui.json' };
  const sizes: Record<string, number> = { ui: gzipSync(JSON.stringify(ui)).length };
  await writeFile(`${directory}/ui.json`, JSON.stringify(ui));
  for (const [scope, values] of Object.entries(scopeValues)) {
    registry[scope] = `${scope}.json`;
    const serialized = JSON.stringify(remaining(values));
    sizes[scope] = gzipSync(serialized).length;
    await writeFile(`${directory}/${scope}.json`, serialized);
  }
  for (const guide of guides) {
    if (!/^[a-z0-9][a-z0-9-]*$/u.test(guide.slug)) throw new Error(`Unsafe guide scope slug: ${guide.slug}`);
    const values = [guide, getGuideMedia(guide), guide.blocks.some(block => block.type === 'freebies') ? perksPosters : undefined];
    const file = `guide-${guide.slug}.json`;
    registry[`guide:${guide.slug}`] = file;
    await writeFile(`${directory}/${file}`, JSON.stringify(remaining(values)));
  }
  const lines = Object.entries(registry).map(([scope, file]) => `  ${JSON.stringify(scope)}: () => import(${JSON.stringify(`./english-scopes/${file}`)}),`);
  await writeFile('src/data/generated/english-scope-loaders.ts', `// Generated by scripts/generate-english-scopes.ts; imports run only for requested content.\nexport const englishScopeLoaders = {\n${lines.join('\n')}\n};\n`);
  console.log(`English scopes gzip bytes: ${JSON.stringify(sizes)}; ${guides.length} separate article packs.`);
}
