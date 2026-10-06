export type EnglishDictionary = Record<string, string>;
export type EnglishScopeLoaders = Record<string, () => Promise<{ default: EnglishDictionary }>>;

const routePath = (value: string) => {
  const path = new URL(value, 'https://www.baylink.us').pathname.replace(/^\/(?:en|zh-Hant)(?=\/|$)/u, '') || '/';
  return path.replace(/\/$/u, '') || '/';
};

/** Scope names describe displayed content, never preference or account data. */
export function englishScopesForPath(value: string, hasScope: (scope: string) => boolean = () => true): string[] {
  const path = routePath(value);
  const scopes = ['ui'];
  if (path === '/opus-bay' || path === '/play') scopes.push('game');
  else if (path.startsWith('/guides/')) {
    let slug = path.slice('/guides/'.length);
    try { slug = decodeURIComponent(slug); } catch { /* An invalid URL still gets translated not-found UI. */ }
    scopes.push('guide-index');
    if (hasScope(`guide:${slug}`)) scopes.push(`guide:${slug}`);
    // City directories also show the next actual events, independently of article text.
    if (slug === 'bay-area-101-city-exploration-living-guide') scopes.push('discovery', 'explore');
  } else if (path === '/guides') scopes.push('guide-index', 'guide-search');
  else if (/^\/(?:this-month|this-week|calendar|ai-in-the-bay)$/u.test(path) || /^\/(?:events|offers|openings)\//u.test(path)) scopes.push('discovery', 'guide-index');
  else if (/^\/(?:plan|my-week|together|me)$/u.test(path)) scopes.push('planning', 'discovery', 'guide-index');
  else if (path === '/explore') scopes.push('explore', 'guide-index');
  else if (path === '/' || path === '/reset-password' || /^\/(?:posts|users)\//u.test(path)) scopes.push('home');
  else if (path.startsWith('/category/')) scopes.push('home', 'guide-index');
  return [...new Set(scopes)].filter(hasScope);
}

/** The search dialog is opened from many routes; it needs English full-text matches too. */
export function englishScopesForFeature(feature: 'search'): string[] {
  return feature === 'search' ? ['ui', 'guide-index', 'guide-search', 'discovery', 'explore'] : [];
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
