import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import type { HostingRoute } from '../scripts/sync-public-routes';
import { generateSitemap } from '../scripts/generate-sitemap';
import { discoveryShare, localDiscoveries } from '../src/data/local-discoveries';
import { guides } from '../src/data/guides';
import { SLUG_TO_CATEGORY } from '../src/routing';

// Every route the app renders must load directly from the host: a page that only
// works after client-side navigation 404s for anyone opening a shared link.
// This walks vercel.json the way Vercel's `routes` do (first terminal match wins;
// `continue` routes only add headers; `handle: filesystem` serves real files).
// The committed copy is checked against its generator by `npm run verify:hosting-routes`.

const repo = (path: string) => new URL(`../${path}`, import.meta.url);
const { routes } = JSON.parse(readFileSync(repo('vercel.json'), 'utf8')) as { routes: HostingRoute[] };
const compiled = routes.map(route => ({ route, pattern: route.src ? new RegExp(`^(?:${route.src.replace(/^\^/, '').replace(/\$$/, '')})$`) : undefined }));
type Outcome = { kind: 'page'; path: string } | { kind: 'function'; file: string; query: string } | { kind: 'redirect'; location: string } | { kind: 'missing'; by: string };

function resolveHosting(path: string, query: Record<string, string> = {}): Outcome {
  for (const { route, pattern } of compiled) {
    if (route.handle === 'filesystem') {
      if (path === '/') return { kind: 'page', path: '/index.html' };
      continue;
    }
    const match = pattern?.exec(path);
    if (!match) continue;
    const has = route.has as { type: string; key: string; value?: string }[] | undefined;
    if (has && !has.every(condition => condition.type === 'query' && query[condition.key] !== undefined && (!condition.value || new RegExp(`^(?:${condition.value})$`).test(query[condition.key])))) continue;
    if (route.continue) continue;
    const substitute = (text: string) => text.replace(/\$(\d+)/g, (_, index: string) => match[Number(index)] ?? '');
    if (route.status === 404) return { kind: 'missing', by: route.src! };
    const location = (route.headers as Record<string, string> | undefined)?.Location;
    if (typeof route.status === 'number' && route.status >= 300 && route.status < 400 && location) return { kind: 'redirect', location: substitute(location) };
    if (route.dest) {
      const dest = substitute(route.dest);
      if (dest.startsWith('/api/')) { const [file, search = ''] = dest.split('?'); return { kind: 'function', file: `${file.slice(1)}.ts`, query: search }; }
      return { kind: 'page', path: dest };
    }
  }
  return { kind: 'missing', by: 'end of routes' };
}

/** Paths in <Route path="…"> of src/App.tsx, with sample values for their parameters. */
function appPaths(): string[] {
  const app = readFileSync(repo('src/App.tsx'), 'utf8');
  const declared = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map(match => match[1]).filter(path => path !== '*');
  assert.ok(declared.length >= 30, 'App routes were found');
  const discoveryIds = (kind: string) => localDiscoveries.filter(item => item.kind === kind).map(item => discoveryShare(item).id);
  const samples: Record<string, string[]> = {
    '/category/:categorySlug': Object.keys(SLUG_TO_CATEGORY),
    '/events/:id': discoveryIds('event'),
    '/offers/:id': discoveryIds('offer'),
    '/openings/:id': discoveryIds('opening'),
    '/guides/:slug': guides.map(guide => guide.slug),
  };
  return declared.flatMap(path => {
    if (samples[path]) return samples[path].map(value => path.replace(/:[A-Za-z]+/, value));
    assert.ok(!path.includes(':') || /:(postId|userId|threadId)$/.test(path), `${path} needs sample values in tests/route-hosting.test.ts`);
    return [path.replace(/:[A-Za-z]+/g, 'sample-id-1')];
  });
}

// Pages the prerender writes: the sitemap plus the noindex and alias pages (scripts/prerender.tsx).
const pages = new Set(generateSitemap().paths.map(path => path.replace(/\/$/, '') || '/'));
for (const locale of ['', '/en', '/zh-Hant']) for (const path of ['/this-week', '/play', '/verify-email', '/notifications/unsubscribe', '/404']) pages.add(`${locale}${path}`);
const pageFor = (html: string) => html.replace(/\.html$/, '').replace(/(^|\/)index$/, '$1').replace(/\/$/, '') || '/';

test('every App route loads directly on the host in all three languages', () => {
  const failures: string[] = [];
  for (const path of appPaths()) {
    for (const prefix of ['', '/en', '/zh-Hant']) {
      for (const url of [`${prefix}${path === '/' ? '' : path}` || '/', `${prefix}${path === '/' ? '' : path}/`]) {
        const outcome = resolveHosting(url);
        if (outcome.kind === 'missing') { failures.push(`${url} → 404 (${outcome.by.slice(0, 60)})`); continue; }
        if (outcome.kind === 'page') {
          const page = pageFor(outcome.path);
          const spaShell = page === (prefix || '/');
          if (!spaShell && !pages.has(page)) failures.push(`${url} → ${outcome.path}, which the prerender does not write`);
          if (prefix && !outcome.path.startsWith(`${prefix}/`)) failures.push(`${url} → ${outcome.path} loses its language`);
        }
        if (outcome.kind === 'function') {
          if (!existsSync(repo(outcome.file))) failures.push(`${url} → missing function ${outcome.file}`);
          if (prefix && !outcome.query.includes(`siteLanguage=${prefix.slice(1)}`)) failures.push(`${url} → ${outcome.file} loses its language`);
        }
      }
    }
  }
  assert.deepEqual(failures.slice(0, 20), [], `${failures.length} App routes do not resolve on the host`);
});

test('the simulator keeps unknown URLs as 404s and follows query-gated and redirect routes', () => {
  for (const url of ['/not-a-route', '/en/not-a-route', '/zh-Hant/guides/not-a-guide', '/events/not-an-event']) assert.equal(resolveHosting(url).kind, 'missing', url);
  assert.deepEqual(resolveHosting('/play', { stops: 'a' }), { kind: 'page', path: '/plan.html' });
  assert.deepEqual(resolveHosting('/together', { outing: 'abc' }), { kind: 'function', file: 'api/outing-page.ts', query: '' });
  assert.deepEqual(resolveHosting('/n/sf'), { kind: 'redirect', location: '/this-week?region=sf&from=card-sf' });
  assert.deepEqual(resolveHosting('/me'), { kind: 'page', path: '/index.html' });
});
