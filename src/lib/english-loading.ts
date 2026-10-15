export type EnglishDictionary = Record<string, string>;
export type EnglishScopeLoaders = Record<string, () => Promise<{ default: EnglishDictionary }>>;

const routePath = (value: string) => {
  const path = new URL(value, 'https://www.baylink.us').pathname.replace(/^\/(?:en|zh-Hant)(?=\/|$)/u, '') || '/';
  return path.replace(/\/$/u, '') || '/';
};

const DETAIL_PATH = /^\/(events|offers|openings)\/([^/]+)$/u;
const DETAIL_KINDS: Record<string, 'event' | 'offer' | 'opening'> = { events: 'event', offers: 'offer', openings: 'opening' };
const safeDecode = (value: string) => { try { return decodeURIComponent(value); } catch { return value; } };

/** Event, offer and opening details are generated in this many buckets (records and English packs alike). */
export const DETAIL_BUCKET_COUNT = 64;
/**
 * The bucket of one detail (`kind` + the id in its URL): FNV-1a of "kind:id", so the page, the generator and the English
 * gate agree without a lookup table. It lives here because this file stays import-free (see below).
 */
export function detailBucket(kind: 'event' | 'offer' | 'opening', id: string): string {
  let hash = 0x811c9dc5;
  const text = `${kind}:${id}`;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return String(hash % DETAIL_BUCKET_COUNT).padStart(2, '0');
}

/** Scope names describe displayed content, never preference or account data. Keep in step with the route table's
 * `english` field (tests/route-table.test.ts compares them); no import here, the 3D game's title chunk loads this file. */
export function englishScopesForPath(value: string, hasScope: (scope: string) => boolean = () => true): string[] {
  const path = routePath(value);
  const scopes = ['ui'];
  if (path === '/opus-bay' || path === '/play') scopes.push('game');
  else if (path.startsWith('/guides/')) {
    let slug = path.slice('/guides/'.length);
    try { slug = decodeURIComponent(slug); } catch { /* An invalid URL still gets translated not-found UI. */ }
    // The article's own scope covers its record, "Read next" cards included (generate-guide-data.ts): no catalog-wide pack.
    if (hasScope(`guide:${slug}`)) scopes.push(`guide:${slug}`);
    // City directories also show the next actual events, independently of article text.
    if (slug === 'bay-area-101-city-exploration-living-guide') scopes.push('discovery', 'explore');
  } else if (path === '/guides') scopes.push('guide-list');
  else if (DETAIL_PATH.test(path)) {
    // An event, offer or opening detail loads the pack of its own bucket (ENGSEC-01): the listing, its rails and its head.
    const [, section, id] = DETAIL_PATH.exec(path)!;
    const scope = `detail-${detailBucket(DETAIL_KINDS[section], safeDecode(id))}`;
    if (hasScope(scope)) scopes.push(scope);
    else scopes.push('discovery', 'guide-index');
  }
  // The events column renders the slim events index (WEB-EVENTS, RC-33): its own pack, not the whole catalog (WEB-DATA-SPLIT).
  else if (/^\/(?:events|this-week|calendar)$/u.test(path)) scopes.push('events-list');
  else if (/^\/(?:this-month|ai-in-the-bay|archive)$/u.test(path)) scopes.push('discovery', 'guide-index');
  // /plan (行程) is not listed: its header needs only the UI pack, and its workspace waits for its own pack, loaded with its
  // catalog after the first paint (feature 'plan', WEB-PLAN-DATA).
  else if (/^\/(?:my-week|together|me)$/u.test(path)) scopes.push('planning', 'discovery', 'guide-index');
  else if (path === '/explore') scopes.push('explore', 'guide-index');
  else if (path === '/' || path === '/reset-password' || /^\/(?:posts|users)\//u.test(path)) scopes.push('home');
  else if (path.startsWith('/category/')) scopes.push('home', 'guide-index');
  return [...new Set(scopes)].filter(hasScope);
}

/** The search dialog is opened from many routes; it needs English full-text matches too. The guide index's own search
 * ('guide-search') needs only the guides' full text: /guides loads it on the first search, not with the page. */
export function englishScopesForFeature(feature: EnglishFeature): string[] {
  return feature === 'search' ? ['ui', 'guide-index', 'guide-search', 'discovery', 'explore'] : feature === 'guide-search' ? ['ui', 'guide-search']
    // BayBay's answer cards show any event, offer, opening or guide, over any page.
    : feature === 'baybay' ? ['ui', 'discovery', 'guide-index']
    // 行程's workspace (WEB-PLAN-DATA): the generated planner catalog's text, loaded with the catalog after the first paint.
    : feature === 'plan' ? ['ui', 'plan-catalog']
    // The events column past its first screens (WEB-PERF-2): the text of events-later.json, loaded with it.
    : feature === 'events-later' ? ['ui', 'events-list', 'events-later'] : [];
}
export type EnglishFeature = 'search' | 'guide-search' | 'baybay' | 'plan' | 'events-later';

/**
 * Pages that never search: the homepage, what opens over it (posts, profiles, the password reset), the community board,
 * and the pages whose modules never reach simplifySearch (about, the legal pages, the token pages, the archive, tools,
 * the AI page, the account hub and its bookings). Every other page waits for the search dictionaries in its language
 * gate (i18n/locale.ts, WEB-HOMEPREP) and its JS budget counts them (scripts/route-budgets.mjs); tests/search-cold.test.ts
 * walks each listed page's imports so the list stays true. It sits with the English scopes, the other "what a path
 * loads" rule, in this import-free file that the budget script reads with Node's type stripping.
 */
export function searchFreePath(value: string): boolean {
  return /^\/(?:(?:posts|users|category)\/.*|reset-password|about|privacy|terms|sms-consent|verify-email|notifications\/unsubscribe|archive|tools|ai-in-the-bay|me|me\/bookings)?$/u.test(routePath(value));
}

/** Successful scopes are cached; rejected loads retry and do not mark a route ready. */
export function createEnglishScopeLoader(loaders: EnglishScopeLoaders, merge: (dictionary: EnglishDictionary) => void) {
  const loaded = new Set<string>();
  const pending = new Map<string, Promise<void>>();
  const has = (scope: string) => Object.hasOwn(loaders, scope);
  const loadOne = (scope: string): Promise<void> => {
    if (loaded.has(scope)) return Promise.resolve();
    if (!has(scope)) return Promise.reject(new Error(`Unknown English content scope: ${scope}`));
    const existing = pending.get(scope);
    if (existing) return existing;
    const promise = loaders[scope]().then(({ default: dictionary }) => {
      merge(dictionary);
      loaded.add(scope);
    }).finally(() => { pending.delete(scope); });
    pending.set(scope, promise);
    return promise;
  };
  return {
    has,
    isReady: (scopes: readonly string[]) => scopes.every(scope => loaded.has(scope)),
    load: async (scopes: readonly string[]) => { await Promise.all([...new Set(scopes)].map(loadOne)); },
  };
}
