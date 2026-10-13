import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { localDiscoveries, discoveryShare } from '../src/data/local-discoveries';
import { detailBucket, DETAIL_BUCKET_COUNT, englishScopesForPath } from '../src/lib/english-loading';
import { recordFromBucket, detailKey, type DetailBucket } from '../src/features/detail/detail-record';
import aliases from '../src/data/event-id-aliases.json';

/**
 * ENGSEC-01 / RC-33 for the detail routes: /events/:id, /offers/:id and /openings/:id load one generated record bucket,
 * never the content corpus. These tests walk the page module's static imports (what Vite puts in the route's graph) and
 * check the generated buckets against the catalog.
 */

/** Static, non-type imports of a module (dynamic import() is a separate chunk and not followed). */
function staticImports(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: string[] = [];
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && !statement.importClause?.isTypeOnly && ts.isStringLiteral(statement.moduleSpecifier)) {
      const named = statement.importClause?.namedBindings;
      const onlyTypes = !!named && ts.isNamedImports(named) && !statement.importClause?.name && named.elements.length > 0 && named.elements.every(element => element.isTypeOnly);
      if (!onlyTypes) found.push(statement.moduleSpecifier.text);
    }
    if (ts.isExportDeclaration(statement) && !statement.isTypeOnly && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) found.push(statement.moduleSpecifier.text);
  }
  return found;
}
const resolveModule = (from: string, specifier: string) => {
  if (!specifier.startsWith('.')) return undefined;
  const base = join(dirname(from), specifier);
  return ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map(suffix => base + suffix).find(candidate => existsSync(candidate) && /\.(?:tsx?|json)$/.test(candidate));
};
function routeGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const visit = (file: string) => {
    const key = file.split('\\').join('/');
    if (seen.has(key)) return;
    seen.add(key);
    if (!/\.tsx?$/.test(file)) return;
    for (const specifier of staticImports(file)) { const next = resolveModule(file, specifier); if (next) visit(next); }
  };
  visit(entry);
  return seen;
}

test('the detail route imports no content catalog: its data is one generated bucket loaded by the page', () => {
  const graph = [...routeGraph('src/pages/LocalDiscoveryPage.tsx')].map(file => posix.normalize(file));
  const corpus = ['src/data/local-discoveries.ts', 'src/data/monthly-edition.ts', 'src/data/october-offers.ts', 'src/data/guides.ts', 'src/data/guide-media.ts',
    'src/data/planner-catalog.ts', 'src/features/detail/build-detail.ts', 'src/data/generated/events-index.json', 'src/data/generated/english.json'];
  for (const module of corpus) assert.ok(!graph.includes(module), `${module} is in the detail route's static graph`);
  assert.ok(!graph.some(file => file.startsWith('src/data/generated/details/')), 'buckets load dynamically, one per page');
  assert.ok(graph.includes('src/data/generated/detail-loaders.ts'));
  assert.ok(graph.includes('src/components/LocalDiscoveryDetail.tsx'));
});

test('every published detail and every old event link resolves from the bucket its URL hashes to', () => {
  const buckets = new Map<string, DetailBucket>();
  const bucket = (name: string) => {
    if (!buckets.has(name)) buckets.set(name, JSON.parse(readFileSync(`src/data/generated/details/bucket-${name}.json`, 'utf8')) as DetailBucket);
    return buckets.get(name)!;
  };
  for (const item of localDiscoveries) {
    const id = discoveryShare(item).id;
    const record = recordFromBucket(bucket(detailBucket(item.kind, id)), detailKey(item.kind, id));
    assert.ok(record, `${item.kind}:${id}`);
    assert.equal(record.item.kind, item.kind);
    assert.equal(record.metadata.path, discoveryShare(item).path);
    for (const event of record.rail) assert.ok(event.id && event.title, `${id}: rail events are filled in`);
  }
  for (const [alias, canonical] of Object.entries(aliases as Record<string, string>)) {
    const record = recordFromBucket(bucket(detailBucket('event', alias)), detailKey('event', alias));
    assert.equal(record?.item.kind === 'event' && record.item.event.id, canonical, alias);
  }
  const files = new Set(Array.from({ length: DETAIL_BUCKET_COUNT }, (_, index) => String(index).padStart(2, '0')));
  assert.equal(files.size, DETAIL_BUCKET_COUNT);
  for (const name of files) assert.ok(existsSync(`src/data/generated/details/bucket-${name}.json`), name);
});

test('an English detail loads the English pack of its own bucket, not the discovery and guide-index packs', () => {
  const loaders = readFileSync('src/data/generated/english-scope-loaders.ts', 'utf8');
  const full = JSON.parse(readFileSync('src/data/generated/english.json', 'utf8')) as Record<string, string>;
  const ui = JSON.parse(readFileSync('src/data/generated/english-scopes/ui.json', 'utf8')) as Record<string, string>;
  for (const item of localDiscoveries.filter((_, index) => index % 37 === 0)) {
    const share = discoveryShare(item);
    const scopes = englishScopesForPath(`/en${share.path}`, scope => loaders.includes(`"${scope}":`));
    assert.deepEqual(scopes, ['ui', `detail-${detailBucket(item.kind, share.id)}`], share.path);
    const pack = JSON.parse(readFileSync(`src/data/generated/english-scopes/detail-${detailBucket(item.kind, share.id)}.json`, 'utf8')) as Record<string, string>;
    const title = item.kind === 'offer' ? item.offer.title : share.title;
    if (Object.hasOwn(full, title)) assert.ok(Object.hasOwn(pack, title) || Object.hasOwn(ui, title), `${share.path}: the title's English is in its pack`);
  }
});
