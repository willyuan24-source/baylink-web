import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localDiscoveries, discoveryShare } from '../src/data/local-discoveries';
import { guides } from '../src/data/guides';

// Vercel limits each route's src to 4096 characters; leave room for future syntax changes.
export const PUBLIC_ROUTE_SRC_LIMIT = 3500;
export type PublicFolder = 'events' | 'offers' | 'openings' | 'guides';
export type HostingRoute = { src?: string; dest?: string; handle?: string; [key: string]: unknown };
export type PublicCatalog = Record<PublicFolder, string[]>;
const folders: PublicFolder[] = ['events', 'offers', 'openings', 'guides'];
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Exact, disjoint allowlists: never broaden matching to an arbitrary slug. */
export function publicRouteGroups(folder: PublicFolder, ids: string[], limit = PUBLIC_ROUTE_SRC_LIMIT): HostingRoute[] {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 4096) throw new Error('Route source limit must be between 1 and 4096');
  if (new Set(ids).size !== ids.length || ids.some(id => !id)) throw new Error(`Invalid or duplicate ${folder} identifiers`);
  const prefix = `^/${folder}/(`;
  const suffix = ')/?$';
  const groups: HostingRoute[] = [];
  let alternatives: string[] = [];
  let length = prefix.length + suffix.length;
  const flush = () => {
    if (alternatives.length) groups.push({ src: `${prefix}${alternatives.join('|')}${suffix}`, dest: `/${folder}/$1.html` });
    alternatives = [];
    length = prefix.length + suffix.length;
  };
  for (const id of ids) {
    const literal = escape(id);
    if (prefix.length + literal.length + suffix.length > limit) throw new Error(`${folder} identifier exceeds route source limit: ${id}`);
    if (length + literal.length + (alternatives.length ? 1 : 0) > limit) flush();
    length += literal.length + (alternatives.length ? 1 : 0);
    alternatives.push(literal);
  }
  flush();
  return groups;
}

/** Replace every old group at its first position, preserving all unrelated routes verbatim. */
export function syncPublicRoutes(routes: HostingRoute[], catalog: PublicCatalog, limit = PUBLIC_ROUTE_SRC_LIMIT): HostingRoute[] {
  let updated = [...routes];
  for (const folder of folders) {
    const dest = `/${folder}/$1.html`;
    const generated = publicRouteGroups(folder, catalog[folder], limit);
    const first = updated.findIndex(route => route.dest === dest);
    if (first >= 0) {
      const template = updated[first];
      updated = updated.flatMap((route, index) => route.dest !== dest ? [route]
        : index === first ? generated.map(group => ({ ...template, ...group })) : []);
    } else {
      const guide = updated.findIndex(route => route.dest === '/guides/$1.html');
      const filesystem = updated.findIndex(route => route.handle === 'filesystem');
      updated.splice(guide >= 0 ? guide : filesystem >= 0 ? filesystem : updated.length, 0, ...generated);
    }
  }
  return updated;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = JSON.parse(await readFile('vercel.json', 'utf8')) as { routes: HostingRoute[] };
  const functionConfig = config as typeof config & { functions: Record<string, { includeFiles: string; maxDuration: number }> };
  functionConfig.functions ||= {};
  for (const file of ['api/outing-page.ts', 'api/user-card-page.ts']) functionConfig.functions[file] = { includeFiles: 'dist/index.html', maxDuration: 15 };
  const catalog: PublicCatalog = { events: [], offers: [], openings: [], guides: guides.map(guide => guide.slug) };
  for (const item of localDiscoveries) catalog[item.kind === 'event' ? 'events' : item.kind === 'offer' ? 'offers' : 'openings'].push(discoveryShare(item).id);
  const baseRoutes = config.routes.filter(route => !route.src?.startsWith('^/en/') && !route.src?.startsWith('^/zh-Hant/') && !route.src?.startsWith('^/(en|zh-Hant)') && route.dest !== '/en/index.html' && route.dest !== '/zh-Hant/index.html' && route.dest !== '/this-week.html' && !route.src?.startsWith('^/n/') && !String(route.dest || '').startsWith('/api/outing-page') && !String(route.dest || '').startsWith('/api/user-card-page'));
  config.routes = syncPublicRoutes(baseRoutes, catalog);
  config.routes.splice(1, 0,
    // Rewrites forward the original query. Do not interpolate an unnamed has capture.
    { src: '^/together/?$', has: [{ type: 'query', key: 'outing', value: '[a-zA-Z0-9_-]{1,128}' }], dest: '/api/outing-page' },
    { src: '^/(en|zh-Hant)/together/?$', has: [{ type: 'query', key: 'outing', value: '[a-zA-Z0-9_-]{1,128}' }], dest: '/api/outing-page?siteLanguage=$1' },
    { src: '^/users/([a-zA-Z0-9_-]{1,128})/?$', dest: '/api/user-card-page?userId=$1' },
    { src: '^/(en|zh-Hant)/users/([a-zA-Z0-9_-]{1,128})/?$', dest: '/api/user-card-page?userId=$2&siteLanguage=$1' });
  // Privacy headers cover every language variant of authenticated pages.
  for (const route of config.routes) {
    if ((route.headers as Record<string, string> | undefined)?.['X-Robots-Tag'] === 'noindex, follow' && route.src?.startsWith('^/(?:me')) {
      route.src = route.src.replace('^/', '^/(?:(?:en|zh-Hant)/)?');
    }
  }
  config.routes = config.routes.filter(route => !route.src?.startsWith('^/(?:(?:en|zh-Hant)/)?(?:verify-email') && route.src !== '^/(verify-email|notifications/unsubscribe)/?$');
  config.routes.splice(1, 0,
    { src: '^/(?:(?:en|zh-Hant)/)?(?:verify-email|notifications/unsubscribe)/?$', headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }, continue: true },
    { src: '^/(verify-email|notifications/unsubscribe)/?$', dest: '/$1.html' });
  const localize = config.routes.filter(route => typeof route.dest === 'string' && route.dest.endsWith('.html') && route.src?.startsWith('^/') && route.status !== 404);
  const translated = (['en', 'zh-Hant'] as const).flatMap(locale => localize.map(route => ({ ...route, src: (route.src || '').replace('^/', '^/' + locale + '/'), dest: '/' + locale + route.dest })));
  const existing = config.routes.findIndex(route => route.handle === 'filesystem');
  config.routes.splice(existing < 0 ? 1 : existing, 0, ...translated,
    { src: '^/(en|zh-Hant)/posts/([a-zA-Z0-9_-]{1,128})/?$', dest: '/api/post-page?postId=$2&siteLanguage=$1' },
    { src: '^/n/(all|sf|east-bay|peninsula|south-bay|north-bay)/?$', status: 302, headers: { Location: '/this-week?region=$1&from=card-$1', 'Cache-Control': 'no-store' } },
    { src: '^/en/?$', dest: '/en/index.html' }, { src: '^/zh-Hant/?$', dest: '/zh-Hant/index.html' },
    { src: '^/this-week/?$', dest: '/this-week.html' }, { src: '^/(en|zh-Hant)/this-week/?$', dest: '/$1/this-week.html' },
    { src: '^/(en|zh-Hant)/(?:.*)$', dest: '/$1/404.html', status: 404 });
  await writeFile('vercel.json', `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Hosting routes cover ${guides.length} guides and ${localDiscoveries.length} individual local discoveries; each public src is at most ${PUBLIC_ROUTE_SRC_LIMIT} characters.`);
}
