import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { buildPlanCatalog, fullStopCoverImage, PLAN_CATALOG_FILE, PLAN_EXTRAS_FILE } from '../scripts/generate-plan-catalog';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { PLANNER_EVENTS, PLANNER_PLACES } from '../src/data/planner-catalog';
import { currentFreebies } from '../src/data/october-offers';
import { SCENE3D_POSTCARD_FOR, SCENE3D_POSTCARD_IMAGES } from '../src/data/scene3d-postcards';
import { guides } from '../src/data/guides';
import { guideLoaders } from '../src/data/generated/guide-loaders';
import { stopCoverImage, stopCoverItem } from '../src/lib/plan-stop-cover';
import { offersForStop } from '../src/lib/planner-offers';
import { PLAN_COVER_IMAGES, PLAN_OFFERS, PLAN_REGIONS, type PlanCatalog, type PlanExtras } from '../src/lib/planner-source';
import { ATTRACTION_REGIONS } from '../src/data/attractions';
import type { Stop } from '../src/lib/planner-core';

/**
 * WEB-PLAN-DATA: 行程 (/plan) reads a generated copy of the planner catalog, loaded after its first paint, instead of
 * importing the catalog's sources; every other page keeps the full catalog, installed by lib/planner.ts. These tests keep
 * the generated file equal to the sources, its lookups equal to the full registries', the route's static graph free of
 * the sources, and every other page's (and lazy feature's) graph carrying the installer whenever it reads the catalog.
 */

test('the generated catalog is the planner catalog as the sources build it (run `npm run generate:home` after a content change)', () => {
  const file = { ...JSON.parse(readFileSync(PLAN_CATALOG_FILE, 'utf8')), ...JSON.parse(readFileSync(PLAN_EXTRAS_FILE, 'utf8')) } as PlanCatalog & PlanExtras;
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(PLAN_CATALOG_FILE, 'utf8'))), ['events', 'places'], 'the extras load on their own when the full catalog is in');
  const built = JSON.parse(JSON.stringify(buildPlanCatalog())) as PlanCatalog & PlanExtras;
  assert.equal(file.events.length, PLANNER_EVENTS.length);
  assert.equal(file.places.length, PLANNER_PLACES.length);
  assert.deepEqual(file, built);
  // eventFor on 行程 returns the planner's event record: every field the edition's record has, with the same value
  // (aliases aside: the planner adds its own), so every caller reads what it read from MONTHLY_EVENTS.
  assert.equal(file.events.length, MONTHLY_EVENTS.length);
  MONTHLY_EVENTS.forEach((event, index) => {
    const planned = file.events[index] as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(event)) if (key !== 'aliases') assert.deepEqual(planned[key], JSON.parse(JSON.stringify(value)), `${event.id}.${key}`);
  });
  assert.deepEqual(file.regions, ATTRACTION_REGIONS.map(({ id, label }) => ({ id, label })));
  assert.deepEqual(PLAN_REGIONS, file.regions, 'Node installs the generated catalog');
});

test('a stop’s cover reads the same image record as from the whole registry, for every key a stop can ask for', () => {
  const stops: Stop[] = [
    ...PLANNER_EVENTS.map(event => ({ kind: 'event' as const, id: event.id })),
    ...PLANNER_PLACES.map(place => ({ kind: 'place' as const, id: place.id })),
    // stops that are not in the catalog (an old saved plan, a stale link) and the postcards' own keys
    { kind: 'event', id: 'no-such-event' }, { kind: 'place', id: 'no-such-place' },
    ...Object.keys(SCENE3D_POSTCARD_FOR).map(id => ({ kind: 'place' as const, id })),
  ];
  const before = (key: string) => fullStopCoverImage(key) ?? (Object.hasOwn(SCENE3D_POSTCARD_IMAGES, key) ? SCENE3D_POSTCARD_IMAGES[key] : undefined);
  let keys = 0;
  for (const stop of stops) {
    const item = stopCoverItem(stop);
    for (const key of [item.imageKey, item.postcardKey]) if (key) { keys++; assert.deepEqual(stopCoverImage(key), before(key), `${stop.kind}:${stop.id} ${key}`); }
  }
  assert.ok(keys > 500, `${keys} keys`);
  assert.ok(Object.keys(PLAN_COVER_IMAGES).length > 100);
});

test('a place’s offers are the same as from the whole offer catalog', () => {
  assert.ok(PLAN_OFFERS.length > 0);
  for (const place of PLANNER_PLACES) for (const date of ['', '2026-10-17', '2026-11-20']) {
    const stop: Stop = { kind: 'place', id: place.id };
    assert.deepEqual(offersForStop(stop, date, undefined, '2026-10-12'), offersForStop(stop, date, currentFreebies, '2026-10-12'), `${place.id} ${date}`);
  }
});

test('the guide slugs that replace the guides corpus in the planner library and BayBay’s links are every guide', () => {
  assert.deepEqual(Object.keys(guideLoaders).sort(), guides.map(guide => guide.slug).sort());
});

/** Static imports of a module as the build keeps them: `import type` and `export type` are erased; an import whose named
 * bindings are all inline types stays as a side-effect import (verbatimModuleSyntax). Dynamic import() is a root. */
function imports(file: string): { static: string[]; dynamic: string[] } {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found = { static: [] as string[], dynamic: [] as string[] };
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly && ts.isStringLiteral(node.moduleSpecifier)) found.static.push(node.moduleSpecifier.text);
    else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) found.static.push(node.moduleSpecifier.text);
    else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) found.dynamic.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}
const resolveModule = (from: string, specifier: string) => {
  if (!specifier.startsWith('.')) return undefined;
  const base = posix.normalize(join(dirname(from), specifier).split('\\').join('/'));
  return ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map(suffix => base + suffix).find(candidate => existsSync(candidate) && statSync(candidate).isFile() && /\.(?:tsx?|json)$/.test(candidate));
};
const parsed = new Map<string, { static: string[]; dynamic: string[] }>();
const edges = (file: string) => {
  if (!parsed.has(file)) {
    const found = /\.tsx?$/.test(file) ? imports(file) : { static: [], dynamic: [] };
    parsed.set(file, { static: found.static.flatMap(spec => resolveModule(file, spec) ?? []), dynamic: found.dynamic.flatMap(spec => resolveModule(file, spec) ?? []) });
  }
  return parsed.get(file)!;
};
function closure(entry: string): Set<string> {
  const seen = new Set<string>();
  const visit = (file: string) => { if (seen.has(file)) return; seen.add(file); for (const next of edges(file).static) visit(next); };
  visit(entry);
  return seen;
}
const sourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sourceFiles(posix.join(directory, entry.name)) : /\.tsx?$/.test(entry.name) ? [posix.join(directory, entry.name)] : []);

const SOURCE = 'src/lib/planner-source.ts';
const INSTALLER = 'src/data/planner-catalog.ts';

test('the 行程 route’s static graph carries no catalog source: the generated catalog loads after the first paint', () => {
  const graph = closure('src/pages/PlannerPage.tsx');
  assert.ok(graph.has(SOURCE) && graph.has('src/features/plan/plan-catalog.ts'));
  for (const module of [INSTALLER, 'src/lib/planner.ts', 'src/data/monthly-edition.ts', 'src/data/local-discoveries.ts', 'src/data/guides.ts', 'src/data/guide-media.ts',
    'src/data/october-offers.ts', 'src/data/attractions.ts', PLAN_CATALOG_FILE, PLAN_EXTRAS_FILE, 'src/data/generated/english.json']) assert.ok(!graph.has(module), `${module} is in /plan's static graph`);
  assert.ok(![...graph].some(file => file.includes('/english-scopes/')), 'English packs load by scope, never with the route');
  assert.ok(edges('src/features/plan/plan-catalog.ts').dynamic.includes(PLAN_CATALOG_FILE), 'the catalog is a chunk of its own');
  assert.ok(edges('src/features/plan/plan-catalog.ts').dynamic.includes(PLAN_EXTRAS_FILE), 'and so are the extras');
});

test('every other page and lazy feature that reads the planner catalog also loads the full catalog’s installer', async () => {
  const { PAGE_MODULES } = await import('../src/app/route-table');
  const files = sourceFiles('src');
  const dynamicTargets = new Map<string, string[]>();
  for (const file of files) for (const target of edges(file).dynamic) dynamicTargets.set(target, [...(dynamicTargets.get(target) || []), file]);
  const roots = new Set<string>(['src/main.tsx', ...Object.values(PAGE_MODULES), ...dynamicTargets.keys()]);
  // 行程 waits for the generated catalog (features/plan/plan-catalog.ts) before its workspace reads it; the workspace's own
  // chunk (H20) is loaded by plan-catalog.ts in the same Promise.all as the generated catalog.
  const generated = new Set(['src/pages/PlannerPage.tsx', 'src/features/plan/PlannerWorkspace.tsx']);
  // Loaded on demand next to lib/planner (Promise.all): the caller loads the installer too.
  const loadedWithInstaller = new Set(['src/lib/planner-library.ts']);
  const missing: string[] = [];
  for (const root of [...roots].sort()) {
    const graph = closure(root);
    if (!graph.has(SOURCE) || graph.has(INSTALLER) || generated.has(root)) continue;
    if (loadedWithInstaller.has(root)) {
      for (const caller of dynamicTargets.get(root) || []) {
        if (!closure(caller).has(INSTALLER) && !edges(caller).dynamic.includes('src/lib/planner.ts')) missing.push(`${caller} loads ${root} without lib/planner`);
      }
      continue;
    }
    missing.push(root);
  }
  assert.deepEqual(missing, [], 'these read the planner catalog without installing it: import lib/planner (not planner-core) there');
  // the walk sees both sides
  assert.ok(closure('src/pages/MyWeekPage.tsx').has(INSTALLER));
  assert.ok(!closure('src/pages/PlannerPage.tsx').has(INSTALLER));
  assert.ok(roots.has('src/lib/planner-library.ts'), 'AddToDayControl loads the library on demand');
});

test('the workspace’s English pack is a subset of the packs My Week, /together and /me load, so arriving from them loads no pack', () => {
  const pack = (scope: string) => JSON.parse(readFileSync(`src/data/generated/english-scopes/${scope}.json`, 'utf8')) as Record<string, string>;
  const plan = pack('plan-catalog');
  const theirs = Object.assign({}, ...['ui', 'planning', 'discovery', 'guide-index'].map(pack)) as Record<string, string>;
  assert.ok(Object.keys(plan).length > 1000);
  assert.deepEqual(Object.entries(plan).filter(([key, value]) => theirs[key] !== value).map(([key]) => key), [], 'plan-catalog entries those packs lack (features/plan/plan-catalog.ts englishReady relies on this)');
});
