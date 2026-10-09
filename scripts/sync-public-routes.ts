import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localDiscoveries, discoveryShare } from '../src/data/local-discoveries';
import { guides } from '../src/data/guides';
import { CARD_REGIONS, LANG_REDIRECT_EXCLUDED, ROUTES } from '../src/app/route-table';

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

/** Sent with every response (route 0): the site uses none of these features. */
export const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=()';
/** public/reading-init.js runs before the first paint on every page and is not content-hashed (index.html names it): a short
 * browser cache that then revalidates, so a fix to the size or language redirect reaches readers within minutes. */
export const READING_INIT_SRC = String.raw`^/reading-init\.js$`;
export const READING_INIT_CACHE_CONTROL = 'public, max-age=600, must-revalidate';
const LOCALE_PREFIX = '(en|zh-Hant)';
/** Route-table pattern → hosting regex body: `/messages/:threadId` → `messages/[^/]+`. */
const routeSource = (path: string) => path.slice(1).replace(/:[A-Za-z]+/g, '[^/]+');
/** `$1` → `$2` when a language prefix capture comes first. */
const shiftCaptures = (text: string) => text.replace(/\$(\d)/g, (_, index: string) => `$${Number(index) + 1}`);

/**
 * Hosting routes that come from the route table (src/app/route-table.ts, plan D2): the prerendered static-page group,
 * the SPA shell paths (and their noindex headers), the legacy redirects and the `?lang=` redirects. Every redirect keeps
 * the request's query: Vercel passes it through to Location (vercel.json `redirects` compile to these same
 * {src, status, headers.Location} routes and keep it), so /this-week?region=sf&from=card-sf → /events?region=sf&from=card-sf.
 */
export function tableHostingRoutes() {
  const pages = ROUTES.filter(route => route.hosting === 'page').map(route => routeSource(route.path));
  const spa = ROUTES.filter(route => route.hosting === 'spa').map(route => routeSource(route.path));
  const redirect = (path: string, to: string, status: number, headers: Record<string, string> = {}): HostingRoute[] => [
    { src: `^/${path}/?$`, status, headers: { Location: to, ...headers } },
    { src: `^/${LOCALE_PREFIX}/${path}/?$`, status, headers: { Location: `/$1${shiftCaptures(to)}`, ...headers } },
  ];
  const legacy = [
    ...ROUTES.filter(route => route.redirect).flatMap(route => redirect(routeSource(route.path), route.redirect!.to, route.redirect!.status)),
    // The weekly share card's QR (scripts/generate-weekly.ts) prints /n/{region}: a 302, so printed cards can be retargeted.
    ...redirect(`n/(${CARD_REGIONS.join('|')})`, '/events?region=$1&from=card-$1', 302, { 'Cache-Control': 'no-store' }),
  ];
  // ?lang=en|zh-Hant on an unprefixed page → that language's own URL (links built by the 3D game and cityExplorationUrl).
  // Not the game (/opus-bay and /play read ?lang themselves) and not the email token pages.
  const langPaths = [
    ...ROUTES.filter(route => route.path !== '/' && route.hosting !== 'token' && !(LANG_REDIRECT_EXCLUDED as readonly string[]).includes(route.path)).map(route => routeSource(route.path)),
    `n/(?:${CARD_REGIONS.join('|')})`,
  ];
  // One route per language: plain `has` values, no named-capture interpolation in Location.
  const langRedirects: HostingRoute[] = (['en', 'zh-Hant'] as const).flatMap(locale => [
    { src: '^/$', has: [{ type: 'query', key: 'lang', value: locale }], status: 301, headers: { Location: `/${locale}` } },
    { src: `^/(${langPaths.join('|')})/?$`, has: [{ type: 'query', key: 'lang', value: locale }], status: 301, headers: { Location: `/${locale}/$1` } },
  ]);
  return {
    staticPages: { src: `^/(${pages.join('|')})/?$`, dest: '/$1.html' } as HostingRoute,
    spaShell: { src: `^/(?:${spa.join('|')})/?$`, dest: '/index.html' } as HostingRoute,
    spaHeaders: `^/(?:(?:en|zh-Hant)/)?(?:${spa.join('|')})/?$`,
    legacy, langRedirects,
  };
}

const isStaticGroup = (route: HostingRoute) => route.dest === '/$1.html' && !route.has && !route.src?.includes('verify-email') && /^\^\/\([a-z|/-]+\)\/\?\$$/.test(route.src || '');
const isSpaShell = (route: HostingRoute) => route.dest === '/index.html' && !!route.src?.startsWith('^/(?:');
const isSpaHeaders = (route: HostingRoute) => (route.headers as Record<string, string> | undefined)?.['X-Robots-Tag'] === 'noindex, follow' && !!route.continue && !!route.src?.startsWith('^/(?:');
const isRedirect = (route: HostingRoute) => typeof route.status === 'number' && route.status >= 300 && route.status < 400;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = JSON.parse(await readFile('vercel.json', 'utf8')) as { routes: HostingRoute[] };
  const functionConfig = config as typeof config & { functions: Record<string, { includeFiles: string; maxDuration: number }> };
  functionConfig.functions ||= {};
  for (const file of ['api/outing-page.ts', 'api/user-card-page.ts']) functionConfig.functions[file] = { includeFiles: 'dist/index.html', maxDuration: 15 };
  const catalog: PublicCatalog = { events: [], offers: [], openings: [], guides: guides.map(guide => guide.slug) };
  for (const item of localDiscoveries) catalog[item.kind === 'event' ? 'events' : item.kind === 'offer' ? 'offers' : 'openings'].push(discoveryShare(item).id);
  const table = tableHostingRoutes();
  const security = config.routes.find(route => (route.headers as Record<string, string> | undefined)?.['Content-Security-Policy']);
  if (!security) throw new Error('vercel.json lost its security headers route');
  (security.headers as Record<string, string>)['Permissions-Policy'] = PERMISSIONS_POLICY;
  const baseRoutes = config.routes
    .filter(route => !route.src?.startsWith('^/en/') && !route.src?.startsWith('^/zh-Hant/') && !route.src?.startsWith('^/(en|zh-Hant)') && route.dest !== '/en/index.html' && route.dest !== '/zh-Hant/index.html' && route.dest !== '/this-week.html' && !isRedirect(route) && !String(route.dest || '').startsWith('/api/outing-page') && !String(route.dest || '').startsWith('/api/user-card-page'))
    .map(route => isStaticGroup(route) ? { ...route, ...table.staticPages } : isSpaShell(route) ? { ...route, ...table.spaShell } : isSpaHeaders(route) ? { ...route, src: table.spaHeaders } : route);
  if ([isStaticGroup, isSpaShell, isSpaHeaders].some(kind => baseRoutes.filter(kind).length !== 1)) throw new Error('vercel.json must keep exactly one static-page group, SPA shell route and SPA header route');
  config.routes = syncPublicRoutes(baseRoutes, catalog);
  config.routes.splice(1, 0,
    // Rewrites forward the original query. Do not interpolate an unnamed has capture.
    { src: '^/together/?$', has: [{ type: 'query', key: 'outing', value: '[a-zA-Z0-9_-]{1,128}' }], dest: '/api/outing-page' },
    { src: '^/(en|zh-Hant)/together/?$', has: [{ type: 'query', key: 'outing', value: '[a-zA-Z0-9_-]{1,128}' }], dest: '/api/outing-page?siteLanguage=$1' },
    { src: '^/users/([a-zA-Z0-9_-]{1,128})/?$', dest: '/api/user-card-page?userId=$1' },
    { src: '^/(en|zh-Hant)/users/([a-zA-Z0-9_-]{1,128})/?$', dest: '/api/user-card-page?userId=$2&siteLanguage=$1' });
  config.routes = config.routes.filter(route => !route.src?.startsWith('^/(?:(?:en|zh-Hant)/)?(?:verify-email') && route.src !== '^/(verify-email|notifications/unsubscribe)/?$');
  config.routes.splice(1, 0,
    { src: '^/(?:(?:en|zh-Hant)/)?(?:verify-email|notifications/unsubscribe)/?$', headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }, continue: true },
    { src: '^/(verify-email|notifications/unsubscribe)/?$', dest: '/$1.html' });
  config.routes = config.routes.filter(route => route.src !== READING_INIT_SRC);
  config.routes.splice(1, 0, { src: READING_INIT_SRC, headers: { 'Cache-Control': READING_INIT_CACHE_CONTROL }, continue: true });
  // The ?lang= redirects precede every page route: the first terminal match wins.
  config.routes.splice(1, 0, ...table.langRedirects);
  const localize = config.routes.filter(route => typeof route.dest === 'string' && route.dest.endsWith('.html') && route.src?.startsWith('^/') && route.status !== 404);
  const translated = (['en', 'zh-Hant'] as const).flatMap(locale => localize.map(route => ({ ...route, src: (route.src || '').replace('^/', '^/' + locale + '/'), dest: '/' + locale + route.dest })));
  const existing = config.routes.findIndex(route => route.handle === 'filesystem');
  config.routes.splice(existing < 0 ? 1 : existing, 0, ...translated,
    { src: '^/(en|zh-Hant)/posts/([a-zA-Z0-9_-]{1,128})/?$', dest: '/api/post-page?postId=$2&siteLanguage=$1' },
    ...table.legacy,
    { src: '^/en/?$', dest: '/en/index.html' }, { src: '^/zh-Hant/?$', dest: '/zh-Hant/index.html' },
    { src: '^/(en|zh-Hant)/(?:.*)$', dest: '/$1/404.html', status: 404 });
  await writeFile('vercel.json', `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Hosting routes cover ${guides.length} guides, ${localDiscoveries.length} individual local discoveries and ${ROUTES.length} route-table paths; each public src is at most ${PUBLIC_ROUTE_SRC_LIMIT} characters.`);
}
