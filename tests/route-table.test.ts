import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { matchRoute, PAGE_MODULES, ROUTES, routeTemplate, type RouteSection } from '../src/app/route-table';
import { primaryNavigationPath } from '../src/lib/ui-navigation';
import { isKnownAppPath } from '../src/routing';
import { currentPageLoader, pageLoaders } from '../src/route-loaders';
import { englishScopesForPath } from '../src/lib/english-loading';
import { bayBayPageSearchContext } from '../src/lib/baybay-context';
import { generateSitemap } from '../scripts/generate-sitemap';

// Plan D2: src/app/route-table.ts is the one source for routes. These checks fail when a route is added in one place only.
const repo = (path: string) => new URL(`../${path}`, import.meta.url);
const sample = (path: string) => path.replace(/:[A-Za-z]+/g, 'sample-1');

test('App.tsx declares exactly the route table\'s paths, plus the catch-all 404', () => {
  const app = readFileSync(repo('src/App.tsx'), 'utf8');
  const declared = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(declared).size, declared.length, 'no path is declared twice');
  assert.deepEqual(declared.filter(path => path !== '*').sort(), ROUTES.map(route => route.path).sort());
  assert.ok(declared.includes('*'));
  // OPUS contract: the /play line stays exactly as it is
  assert.match(app, /<Route path="\/play" element=\{<PlayRedirect \/>\} \/>/);
  for (const route of ROUTES.filter(entry => entry.redirect)) assert.match(app, new RegExp(`<Route path="${route.path}" element=\\{<LegacyRedirect />\\} />`), route.path);
  for (const route of ROUTES.filter(entry => entry.bare)) assert.ok(app.indexOf(`<Route path="${route.path}"`) < app.indexOf('<Route element={<AppLayout'), `${route.path} renders outside the site chrome`);
});

test('every page key has a loader and an existing module; boot preloads the matching chunk', () => {
  assert.deepEqual(Object.keys(pageLoaders).sort(), Object.keys(PAGE_MODULES).sort());
  const loaders = readFileSync(repo('src/route-loaders.ts'), 'utf8');
  for (const [key, file] of Object.entries(PAGE_MODULES)) {
    assert.ok(existsSync(repo(file)), file);
    const specifier = `./${file.replace(/^src\//, '').replace(/\.tsx$/, '')}`;
    assert.ok(loaders.includes(`${key}: cached(() => import('${specifier}')`), `${key} loads ${specifier}`);
  }
  assert.equal(currentPageLoader('/events'), pageLoaders.events);
  assert.equal(currentPageLoader('/events/'), pageLoaders.events);
  assert.equal(currentPageLoader('/this-week'), pageLoaders.events, 'a redirect preloads its target');
  assert.equal(currentPageLoader('/events/fleet-week'), pageLoaders.discovery);
  assert.equal(currentPageLoader('/category/rent'), pageLoaders.home);
  assert.equal(currentPageLoader('/me/bookings'), pageLoaders.bookings);
  assert.equal(currentPageLoader('/privacy'), pageLoaders.privacy);
  for (const path of ['/not-a-page', '/posts/a/b', '/play']) assert.equal(currentPageLoader(path), pageLoaders.notFound, path);
});

test('every route has exactly one section, and no URL matches two routes', () => {
  const sections: RouteSection[] = ['home', 'events', 'guides', 'me', 'more', 'none'];
  for (const route of ROUTES) {
    assert.ok(sections.includes(route.section), route.path);
    assert.equal(ROUTES.filter(other => matchRoute(sample(other.path)) === route).length, 1, `${route.path} is reached by its own pattern only`);
    assert.equal(matchRoute(sample(route.path)), route, route.path);
  }
  assert.equal(new Set(ROUTES.map(route => route.path)).size, ROUTES.length);
});

test('nav highlight follows the route section: 活动 for the events column, nothing (更多) for 邻里, never 首页 for a board', () => {
  const expected: Record<string, string | null> = {
    '/': '/', '/events': '/events', '/events/': '/events', '/en/events': '/events', '/calendar': '/events', '/this-month': '/events',
    '/this-week': '/events', '/events/fleet-week': '/events', '/offers/x': '/events', '/openings/x': '/events', '/plan': '/events',
    '/together': '/events', '/ai-in-the-bay': '/events', '/guides': '/guides', '/zh-Hant/guides/x': '/guides', '/explore': '/guides',
    '/tools': '/guides', '/archive': '/guides', '/me': '/me', '/me/bookings': '/me', '/my-week': '/me', '/messages': '/me',
    '/messages/thread': '/me', '/category/rent': null, '/posts/abc': null, '/users/abc': null, '/opus-bay': null, '/play': null,
    '/about': null, '/privacy': null, '/verify-email': null, '/not-a-page': null,
  };
  for (const [path, tab] of Object.entries(expected)) assert.equal(primaryNavigationPath(path), tab, path);
  for (const route of ROUTES.filter(entry => entry.path.startsWith('/category') || entry.path.startsWith('/posts'))) assert.notEqual(route.section, 'home');
});

test('known paths, analytics templates, English scopes and BayBay context come from the table', () => {
  for (const path of ['/events', '/events/', '/this-week', '/recommend', '/calendar', '/play', '/messages/abc', '/category/rent']) assert.equal(isKnownAppPath(path), true, path);
  for (const path of ['/event', '/events/a/b', '/category/unknown', '/category/constructor', '/play/x']) assert.equal(isKnownAppPath(path), false, path);
  assert.equal(routeTemplate('/events/san-francisco-fleet-week-2026?date=2026-10-11'), '/events/:id');
  assert.equal(routeTemplate('/en/guides/medicare'), '/guides/:slug');
  assert.equal(routeTemplate('/zh-Hant/events/'), '/events');
  assert.equal(routeTemplate('/wp-admin'), 'other');
  assert.deepEqual(englishScopesForPath('/en/events?when=today'), ['ui', 'discovery', 'guide-index']);
  assert.deepEqual(englishScopesForPath('/en/this-week'), ['ui', 'discovery', 'guide-index']);
  assert.deepEqual(englishScopesForPath('/en/me/bookings'), ['ui']);
  assert.deepEqual(bayBayPageSearchContext('/events?region=sf&from=card-sf'), { region: 'sf' });
  assert.deepEqual(bayBayPageSearchContext('/events?when=today', '2026-10-08'), { date: '2026-10-08' });
  assert.deepEqual(bayBayPageSearchContext('/this-week?region=east-bay'), { region: 'east-bay' });
  assert.deepEqual(bayBayPageSearchContext('/guides?region=sf'), {});
});

test('the sitemap lists the table\'s public pages in every language with x-default, and no redirect or game alias', () => {
  const { paths, xml } = generateSitemap();
  for (const path of ['/events', '/en/events', '/zh-Hant/events', '/calendar', '/this-month', '/opus-bay']) assert.ok(paths.includes(path), path);
  for (const path of ['/this-week', '/recommend', '/play', '/my-week', '/verify-email']) assert.ok(!paths.some(entry => entry.replace(/^\/(en|zh-Hant)/, '') === path), path);
  for (const route of ROUTES.filter(entry => entry.sitemap && !entry.path.includes(':'))) assert.ok(paths.includes(route.path), route.path);
  assert.equal((xml.match(/hreflang="x-default"/g) || []).length, paths.length, 'each URL names its default (Simplified) edition');
  assert.ok(xml.includes('<loc>https://www.baylink.us/en/events</loc>'));
  assert.match(xml, /<loc>https:\/\/www\.baylink\.us\/en\/events<\/loc>.*?hreflang="x-default" href="https:\/\/www\.baylink\.us\/events"/);
});
