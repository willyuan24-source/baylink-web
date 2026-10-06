import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { publicRouteGroups, syncPublicRoutes, PUBLIC_ROUTE_SRC_LIMIT, type HostingRoute, type PublicCatalog } from '../scripts/sync-public-routes';
import { localDiscoveries, discoveryShare } from '../src/data/local-discoveries';
import { guides } from '../src/data/guides';

const catalog: PublicCatalog = { events: [], offers: [], openings: [], guides: guides.map(guide => guide.slug) };
for (const item of localDiscoveries) catalog[item.kind === 'event' ? 'events' : item.kind === 'offer' ? 'offers' : 'openings'].push(discoveryShare(item).id);
const publicDestinations = new Set(Object.keys(catalog).map(folder => `/${folder}/$1.html`));

test('the complete content directory reaches its prerender before locale 404 routes without admitting nested paths', () => {
  const { routes } = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as { routes: HostingRoute[] };
  for (const prefix of ['', '/en', '/zh-Hant']) {
    for (const suffix of ['', '/']) {
      const path = `${prefix}/archive${suffix}`;
      const terminal = routes.find(route => route.dest && route.src && new RegExp(route.src).test(path));
      assert.ok(terminal, path);
      assert.notEqual(terminal.status, 404, path);
      assert.equal(path.replace(new RegExp(terminal.src!), terminal.dest!), `${prefix}/archive.html`);
    }
    const missing = `${prefix}/archive/not-a-directory`;
    assert.equal(routes.find(route => route.dest && route.src && new RegExp(route.src).test(missing))?.status, 404, missing);
  }
});

test('public route groups enforce the source limit at the boundary and escape literal identifiers', () => {
  const exact = '^/events/(a)/?$'.length;
  assert.equal(publicRouteGroups('events', ['a'], exact)[0].src!.length, exact);
  assert.equal(publicRouteGroups('events', ['a', 'b'], exact).length, 2);
  assert.throws(() => publicRouteGroups('events', ['too-long'], exact), /exceeds/);
  assert.throws(() => publicRouteGroups('events', ['a', 'a']), /duplicate/);
  assert.throws(() => publicRouteGroups('events', ['a'], 4097), /4096/);
  const literal = new RegExp(publicRouteGroups('events', ['a.b', 'a+b', '(special)'])[0].src!);
  for (const id of ['a.b', 'a+b', '(special)']) assert.equal(literal.exec(`/events/${id}/`)?.[1], id);
  for (const id of ['axb', 'aaab', 'special', 'unknown']) assert.equal(literal.test(`/events/${id}`), false);
  assert.deepEqual(publicRouteGroups('events', []), []);
});

test('sync replaces every stale group, is idempotent, and leaves unrelated routes unchanged in order', () => {
  const routes: HostingRoute[] = [
    { src: '/(.*)', headers: { 'Content-Security-Policy': "default-src 'self'" }, continue: true },
    { src: '^/events/(old-a)/?$', dest: '/events/$1.html' },
    { src: '^/assets/(.*)$', headers: { 'Cache-Control': 'immutable' }, continue: true },
    { src: '^/events/(old-b)/?$', dest: '/events/$1.html' },
    { src: '^/guides/(old-guide)/?$', dest: '/guides/$1.html' },
    { handle: 'filesystem' },
    { src: '/(.*)', dest: '/404.html', status: 404 },
  ];
  const original = structuredClone(routes);
  const tiny: PublicCatalog = { events: ['one', 'two', 'three'], offers: ['benefit'], openings: ['store'], guides: ['guide'] };
  const result = syncPublicRoutes(routes, tiny, 25);
  assert.deepEqual(syncPublicRoutes(result, tiny, 25), result);
  assert.deepEqual(routes, original, 'the caller config is not mutated');
  assert.deepEqual(result.filter(route => !publicDestinations.has(route.dest || '')), routes.filter(route => !publicDestinations.has(route.dest || '')));
  for (const route of result.filter(route => publicDestinations.has(route.dest || ''))) {
    assert.ok(route.src!.length <= 25);
    assert.doesNotMatch(route.src!, /old-a|old-b|old-guide/);
  }
});

test('published guides and discoveries each resolve once; every source fits Vercel and unknown IDs remain 404', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as { routes: HostingRoute[] };
  assert.deepEqual(syncPublicRoutes(config.routes, catalog), config.routes, 'checked-in config is generated and idempotent');
  for (const route of config.routes) if (route.src) assert.ok(route.src.length <= 4096, `Vercel src length: ${route.src.length}`);
  for (const [folder, ids] of Object.entries(catalog)) {
    const rules = config.routes.filter(route => route.dest === `/${folder}/$1.html`);
    assert.ok(rules.length);
    for (const route of rules) assert.ok(route.src!.length <= PUBLIC_ROUTE_SRC_LIMIT);
    for (const id of ids) for (const path of [`/${folder}/${id}`, `/${folder}/${id}/`]) {
      const matches = rules.filter(route => new RegExp(route.src!).test(path));
      assert.equal(matches.length, 1, `${path} resolves exactly once`);
      assert.equal(path.replace(new RegExp(matches[0].src!), matches[0].dest!), `/${folder}/${id}.html`);
    }
    for (const path of [`/${folder}/not-a-published-id`, `/${folder}/${ids[0]}/nested`, `/${folder}/../this-month`]) {
      assert.equal(rules.some(route => new RegExp(route.src!).test(path)), false);
      const terminal = config.routes.find(route => route.dest && route.src && new RegExp(route.src).test(path));
      assert.equal(terminal?.status, 404, `${path} retains the explicit missing-page response`);
    }
  }
});
