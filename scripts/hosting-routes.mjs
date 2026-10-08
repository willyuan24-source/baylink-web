import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Walks vercel.json `routes` the way Vercel answers a direct load: the first terminal match wins; `continue` routes only
 * add headers; `has` query conditions must all match (named captures become `$name`); `handle: filesystem` serves real
 * files (only `/` → index.html is modelled). Redirects and rewrites keep the request's query (Vercel passes it through:
 * a `redirects` entry compiles to the same {src, status, headers.Location} route and keeps it).
 * Used by tests/legacy-urls.test.ts, scripts/verify-release.mjs and the post-deploy check below.
 */
export function resolveHosting(routes, url) {
  const request = new URL(url, 'https://www.baylink.us');
  const headers = {};
  const withQuery = target => {
    const next = new URL(target, 'https://www.baylink.us');
    for (const [key, value] of request.searchParams) if (!next.searchParams.has(key)) next.searchParams.append(key, value);
    return `${next.pathname}${next.search}`;
  };
  for (const route of routes) {
    if (route.handle === 'filesystem') {
      if (request.pathname === '/') return { kind: 'page', file: '/index.html', headers };
      continue;
    }
    const match = new RegExp(route.src).exec(request.pathname);
    if (!match) continue;
    const named = {};
    if (route.has && !route.has.every(condition => {
      if (condition.type !== 'query' || !request.searchParams.has(condition.key)) return false;
      if (!condition.value) return true;
      const value = new RegExp(`^(?:${condition.value})$`).exec(request.searchParams.get(condition.key));
      Object.assign(named, value?.groups || {});
      return !!value;
    })) continue;
    if (route.continue) { Object.assign(headers, route.headers || {}); continue; }
    const substitute = text => text.replace(/\$(\d+|[A-Za-z]+)/g, (_, key) => /^\d+$/.test(key) ? match[Number(key)] ?? '' : named[key] ?? '');
    Object.assign(headers, route.headers || {});
    if (route.status === 404) return { kind: 'missing', by: route.src, headers };
    if (route.status >= 300 && route.status < 400 && route.headers?.Location) return { kind: 'redirect', status: route.status, location: withQuery(substitute(route.headers.Location)), headers };
    if (route.dest) {
      const dest = substitute(route.dest);
      if (dest.startsWith('/api/')) return { kind: 'function', file: `${dest.split('?')[0].slice(1)}.ts`, query: dest.split('?')[1] || '', headers };
      return { kind: 'page', file: dest, headers };
    }
  }
  return { kind: 'missing', by: 'end of routes', headers };
}

const FLEET_WEEK = '/events/san-francisco-fleet-week-2026';
/**
 * Legacy and shared URLs that must keep working (plan D3, RC-11 iii, RC-24): QR codes, the 3D game's links, old shares.
 * `page` = served by that prerendered file (or the SPA shell); `redirect` = status and Location, query kept.
 */
export const LEGACY_URLS = [
  { url: '/events', page: '/events.html' },
  { url: '/en/events', page: '/en/events.html' },
  { url: '/zh-Hant/events/', page: '/zh-Hant/events.html' },
  { url: '/calendar', page: '/calendar.html' },
  { url: '/calendar?date=2026-10-10&region=sf&from=opus-title', page: '/calendar.html' },
  { url: '/this-month', page: '/this-month.html' },
  { url: '/zh-Hant/this-month', page: '/zh-Hant/this-month.html' },
  { url: '/this-week', redirect: [301, '/events'] },
  { url: '/this-week?region=sf&from=card-sf', redirect: [301, '/events?region=sf&from=card-sf'] },
  { url: '/en/this-week', redirect: [301, '/en/events'] },
  { url: '/zh-Hant/this-week/?region=east-bay', redirect: [301, '/zh-Hant/events?region=east-bay'] },
  ...['all', 'sf', 'east-bay', 'peninsula', 'south-bay', 'north-bay'].map(region => ({ url: `/n/${region}`, redirect: [302, `/events?region=${region}&from=card-${region}`] })),
  { url: '/en/n/sf', redirect: [302, '/en/events?region=sf&from=card-sf'] },
  { url: '/recommend', redirect: [301, '/events'] },
  { url: '/en/recommend', redirect: [301, '/en/events'] },
  { url: '/plan?stops=event%3Asan-francisco-fleet-week-2026&date=2026-10-10', page: '/plan.html' },
  { url: '/my-week', page: '/index.html' },
  { url: '/me/bookings', page: '/index.html' },
  { url: '/play', page: '/play.html' },
  { url: '/play?date=2026-10-10&stops=place%3Agolden-gate', page: '/plan.html' },
  { url: '/play?lang=en', page: '/play.html' },
  { url: '/opus-bay', page: '/opus-bay.html' },
  { url: '/opus-bay?lang=zh-Hant&from=home', page: '/opus-bay.html' },
  { url: FLEET_WEEK, page: `${FLEET_WEEK}.html` },
  { url: `${FLEET_WEEK}?date=2026-10-11`, page: `${FLEET_WEEK}.html` },
  { url: '/category/rent', page: '/category/rent.html' },
  { url: '/posts/sample-post-1', function: 'api/post-page.ts' },
  { url: '/users/sample-user-1', function: 'api/user-card-page.ts' },
  // ?lang= on an unprefixed URL → that language's URL, keeping date, region, from and stops (RC-11 iii)
  { url: '/?lang=en', redirect: [301, '/en?lang=en'] },
  { url: '/calendar?lang=en&date=2026-10-10&region=sf&from=opus-title', redirect: [301, '/en/calendar?lang=en&date=2026-10-10&region=sf&from=opus-title'] },
  { url: '/this-month?lang=zh-Hant&from=opus', redirect: [301, '/zh-Hant/this-month?lang=zh-Hant&from=opus'] },
  { url: '/plan?lang=en&stops=place%3Agolden-gate', redirect: [301, '/en/plan?lang=en&stops=place%3Agolden-gate'] },
  { url: '/guides/bay-area-101-city-exploration-living-guide?city=oakland&lang=en', redirect: [301, '/en/guides/bay-area-101-city-exploration-living-guide?city=oakland&lang=en'] },
  { url: '/en/calendar?lang=en', page: '/en/calendar.html' },
  { url: '/calendar?lang=zh-Hans', page: '/calendar.html' },
];

/** One mismatch per failing URL against a vercel.json route list (empty when every legacy URL behaves). */
export function checkLegacyUrls(routes) {
  return LEGACY_URLS.flatMap(item => {
    const outcome = resolveHosting(routes, item.url);
    const got = outcome.kind === 'redirect' ? `${outcome.status} → ${outcome.location}` : outcome.kind === 'page' ? `page ${outcome.file}` : outcome.kind === 'function' ? `function ${outcome.file}` : `404 (${outcome.by.slice(0, 50)})`;
    const want = item.redirect ? `${item.redirect[0]} → ${item.redirect[1]}` : item.page ? `page ${item.page}` : `function ${item.function}`;
    return got === want ? [] : [`${item.url}: expected ${want}, got ${got}`];
  });
}

/**
 * Post-deploy check (read-only GETs, no redirects followed): `node scripts/hosting-routes.mjs https://www.baylink.us`.
 * Pages must answer 200; redirects must answer the status and Location above.
 */
export async function checkLive(base) {
  const failures = [];
  for (const item of LEGACY_URLS.filter(entry => !entry.function)) {
    const response = await fetch(new URL(item.url, base), { redirect: 'manual', headers: { 'user-agent': 'baylink-route-check' } });
    const location = response.headers.get('location');
    const relative = location && (() => { const next = new URL(location, base); return `${next.pathname}${next.search}`; })();
    const ok = item.redirect ? response.status === item.redirect[0] && relative === item.redirect[1] : response.status === 200;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${response.status} ${item.url}${location ? ` → ${location}` : ''}`);
    if (!ok) failures.push(item.url);
  }
  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = process.argv[2];
  if (base) {
    const failures = await checkLive(base);
    if (failures.length) { console.error(`${failures.length} URL(s) differ from the route table: ${failures.join(', ')}`); process.exitCode = 1; }
  } else {
    const failures = checkLegacyUrls(JSON.parse(await readFile('vercel.json', 'utf8')).routes);
    for (const failure of failures) console.error(failure);
    if (failures.length) process.exitCode = 1; else console.log(`vercel.json answers all ${LEGACY_URLS.length} legacy and shared URLs as expected.`);
  }
}
