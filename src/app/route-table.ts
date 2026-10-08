/**
 * The one route table (plan D2, docs/routes.md). Everything that needs to know about a URL reads it here:
 * App.tsx <Route>s (tests/route-table.test.ts keeps them equal), the boot preloader (route-loaders.ts), the
 * known-path check (routing.ts), nav highlight (lib/ui-navigation.ts), English scopes (lib/english-loading.ts),
 * BayBay page context (lib/baybay-context.ts), prerender modules (scripts/prerender.tsx), the sitemap
 * (scripts/generate-sitemap.ts), vercel.json hosting routes (scripts/sync-public-routes.ts), the release page
 * list (scripts/verify-release.mjs) and analytics route templates (routeTemplate).
 *
 * Keep this file free of imports and side effects: the app shell bundles it (home budget) and node scripts load it.
 */

/** Page modules by loader key. route-loaders.ts imports exactly these files (checked by the route-table test). */
export const PAGE_MODULES = {
  home: 'src/pages/HomePage.tsx',
  guides: 'src/pages/GuidesPage.tsx',
  events: 'src/pages/EventsPage.tsx',
  monthly: 'src/pages/MonthlyPage.tsx',
  calendar: 'src/pages/CalendarPage.tsx',
  discovery: 'src/pages/LocalDiscoveryPage.tsx',
  tools: 'src/pages/ToolsPage.tsx',
  explore: 'src/pages/ExplorePage.tsx',
  plan: 'src/pages/PlannerPage.tsx',
  myWeek: 'src/pages/MyWeekPage.tsx',
  ai: 'src/pages/AiLocalPage.tsx',
  guide: 'src/pages/GuideDetailPage.tsx',
  messages: 'src/pages/MessagesPage.tsx',
  profile: 'src/pages/ProfilePage.tsx',
  bookings: 'src/pages/ServiceBookingsPage.tsx',
  together: 'src/pages/TogetherPage.tsx',
  about: 'src/pages/AboutPage.tsx',
  archive: 'src/pages/ArchivePage.tsx',
  notFound: 'src/pages/NotFoundPage.tsx',
  privacy: 'src/components/PrivacyPolicyView.tsx',
  terms: 'src/components/TermsView.tsx',
  sms: 'src/components/SmsConsentView.tsx',
  notificationToken: 'src/pages/NotificationTokenPage.tsx',
  opus: 'src/opus-bay/OpusBayPage.tsx',
} as const;
export type PageKey = keyof typeof PAGE_MODULES;

/** The one place a URL belongs. 'more' = the ••• / 更多 panel (邻里, 3D, about, legal); 'none' = no menu. */
export type RouteSection = 'home' | 'events' | 'guides' | 'me' | 'more' | 'none';

/**
 * How the host serves a direct load (scripts/sync-public-routes.ts):
 * - index: `/` → index.html
 * - page: prerendered `/<path>.html` in the static-page group, copied for /en and /zh-Hant
 * - ids: prerendered per published id (allowlists generated from the catalogs; categories from SLUG_TO_CATEGORY)
 * - token: prerendered noindex page with its own no-store / no-referrer route
 * - spa: the SPA shell (index.html), noindex and no-store
 * - function: a Vercel function writes the share head (posts)
 * - redirect: an edge redirect to `redirect.to`, which keeps the request's query (Vercel passes it through)
 */
export type RouteHosting = 'index' | 'page' | 'ids' | 'token' | 'spa' | 'function' | 'redirect';

export type AppRoute = {
  /** React Router pattern, exactly as in App.tsx */
  path: string;
  /** Loader key; for a redirect, the target's page so boot preloads the right chunk; null = rendered eagerly */
  page: PageKey | null;
  section: RouteSection;
  hosting: RouteHosting;
  redirect?: { to: string; status: 301 | 302 };
  /** listed in the sitemap (every language) */
  sitemap?: boolean;
  /** English dictionary scopes the page displays ('ui' is always loaded); /guides/:slug adds its own */
  english?: readonly string[];
  /** public route parameters may become BayBay search context */
  baybay?: boolean;
  /** outside the site chrome (AppLayout) */
  bare?: boolean;
  /** prerendered page checked by scripts/verify-release.mjs in every language */
  release?: boolean;
};

const DISCOVERY = ['discovery', 'guide-index'] as const;
const PLANNING = ['planning', 'discovery', 'guide-index'] as const;

export const ROUTES: readonly AppRoute[] = [
  { path: '/', page: 'home', section: 'home', hosting: 'index', sitemap: true, english: ['home'], release: true },
  { path: '/category/:categorySlug', page: 'home', section: 'more', hosting: 'ids', sitemap: true, english: ['home', 'guide-index'] },
  { path: '/posts/:postId', page: 'home', section: 'more', hosting: 'function', english: ['home'] },
  // a user card: the user-card function serves valid ids first (share head); any other id gets the shell. Both noindex.
  { path: '/users/:userId', page: 'home', section: 'more', hosting: 'spa', english: ['home'] },
  { path: '/reset-password', page: 'home', section: 'none', hosting: 'spa', english: ['home'] },
  { path: '/guides', page: 'guides', section: 'guides', hosting: 'page', sitemap: true, english: ['guide-index', 'guide-search'], release: true },
  { path: '/guides/:slug', page: 'guide', section: 'guides', hosting: 'ids', sitemap: true },
  { path: '/events', page: 'events', section: 'events', hosting: 'page', sitemap: true, english: DISCOVERY, baybay: true, release: true },
  { path: '/this-month', page: 'monthly', section: 'events', hosting: 'page', sitemap: true, english: DISCOVERY, baybay: true, release: true },
  { path: '/this-week', page: 'events', section: 'events', hosting: 'redirect', redirect: { to: '/events', status: 301 }, english: DISCOVERY, baybay: true },
  { path: '/calendar', page: 'calendar', section: 'events', hosting: 'page', sitemap: true, english: DISCOVERY, baybay: true, release: true },
  { path: '/events/:id', page: 'discovery', section: 'events', hosting: 'ids', sitemap: true, english: DISCOVERY },
  { path: '/offers/:id', page: 'discovery', section: 'events', hosting: 'ids', sitemap: true, english: DISCOVERY },
  { path: '/openings/:id', page: 'discovery', section: 'events', hosting: 'ids', sitemap: true, english: DISCOVERY },
  { path: '/ai-in-the-bay', page: 'ai', section: 'events', hosting: 'page', sitemap: true, english: DISCOVERY },
  { path: '/plan', page: 'plan', section: 'events', hosting: 'page', sitemap: true, english: PLANNING, baybay: true, release: true },
  { path: '/together', page: 'together', section: 'events', hosting: 'spa', english: PLANNING, baybay: true },
  { path: '/recommend', page: 'events', section: 'events', hosting: 'redirect', redirect: { to: '/events', status: 301 }, english: DISCOVERY },
  { path: '/tools', page: 'tools', section: 'guides', hosting: 'page', sitemap: true },
  { path: '/explore', page: 'explore', section: 'guides', hosting: 'page', sitemap: true, english: ['explore', 'guide-index'] },
  { path: '/archive', page: 'archive', section: 'guides', hosting: 'page', sitemap: true, english: DISCOVERY, release: true },
  { path: '/me', page: 'profile', section: 'me', hosting: 'spa', english: PLANNING },
  { path: '/me/bookings', page: 'bookings', section: 'me', hosting: 'spa' },
  { path: '/my-week', page: 'myWeek', section: 'me', hosting: 'spa', english: PLANNING },
  { path: '/messages', page: 'messages', section: 'me', hosting: 'spa' },
  { path: '/messages/:threadId', page: 'messages', section: 'me', hosting: 'spa' },
  { path: '/about', page: 'about', section: 'more', hosting: 'page', sitemap: true },
  { path: '/privacy', page: 'privacy', section: 'more', hosting: 'page', sitemap: true },
  { path: '/terms', page: 'terms', section: 'more', hosting: 'page', sitemap: true },
  { path: '/sms-consent', page: 'sms', section: 'more', hosting: 'page', sitemap: true },
  { path: '/opus-bay', page: 'opus', section: 'more', hosting: 'page', sitemap: true, english: ['game'], bare: true, release: true },
  // /play: PlayRedirect sends the visitor on (OPUS contract); play.html is the game's shell, never in the sitemap
  { path: '/play', page: null, section: 'more', hosting: 'page', english: ['game'], bare: true },
  { path: '/verify-email', page: 'notificationToken', section: 'none', hosting: 'token' },
  { path: '/notifications/unsubscribe', page: 'notificationToken', section: 'none', hosting: 'token' },
];

/** The weekly share card's QR regions: /n/{region} → 302 /events?region=…&from=card-… (printed cards keep working). */
export const CARD_REGIONS = ['all', 'sf', 'east-bay', 'peninsula', 'south-bay', 'north-bay'] as const;
/** `?lang=en|zh-Hant` on an unprefixed URL → 301 to the language's own URL (query kept). The game reads ?lang itself. */
export const LANG_REDIRECT_EXCLUDED = ['/opus-bay', '/play'] as const;

const compiled = ROUTES.map(route => ({ route, pattern: new RegExp(`^${route.path === '/' ? '/' : route.path.replace(/:[A-Za-z]+/g, '[^/]+')}$`) }));
/** Pathname without its /en or /zh-Hant prefix, query, hash or trailing slash. */
export const routePathname = (value: string) => (value.split(/[?#]/)[0].replace(/^\/(?:en|zh-Hant)(?=\/|$)/, '').replace(/\/+$/, '') || '/');
/** The table entry for a URL path (language prefix allowed), or undefined (a 404 or not an app page). */
export const matchRoute = (pathname: string): AppRoute | undefined => {
  const path = routePathname(pathname);
  return compiled.find(({ pattern }) => pattern.test(path))?.route;
};
/** Analytics route template, e.g. '/events/:id'; 'other' when the path is not an app route. Never the raw URL. */
export const routeTemplate = (pathname: string) => matchRoute(pathname)?.path ?? 'other';
/** Prerendered static pages served from `/<path>.html` (the vercel.json static group, sitemap and prerender). */
export const staticPagePaths = () => ROUTES.filter(route => route.hosting === 'page').map(route => route.path);
