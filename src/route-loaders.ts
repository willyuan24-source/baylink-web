import { matchRoute, routePathname, type PageKey } from './app/route-table';
import { settleChunk } from './lib/chunk-recovery';
import { pathLanguage } from './lib/language-path';

/** Shared promises let startup load the current page before replacing its prerendered content. settleChunk (WEB-SHELL2,
 * REG-15): a page chunk lost to a newer deploy waits for the recovery reload instead of reaching the error page. A loader
 * that picks a named export settles the module before picking (the pick would throw on `undefined` first). */
const cached = <T,>(load: () => Promise<T>) => {
  let promise: Promise<T> | undefined;
  return () => promise ||= load().then(settleChunk).catch(error => { promise = undefined; throw error; });
};
/** One loader per route-table page key (PAGE_MODULES; tests/route-table.test.ts checks the files match). */
export const pageLoaders = {
  home: cached(() => import('./pages/HomePage')),
  guides: cached(() => import('./pages/GuidesPage')),
  events: cached(() => import('./pages/EventsPage')),
  monthly: cached(() => import('./pages/MonthlyPage')),
  calendar: cached(() => import('./pages/CalendarPage')),
  discovery: cached(() => import('./pages/LocalDiscoveryPage')),
  tools: cached(() => import('./pages/ToolsPage')),
  explore: cached(() => import('./pages/ExplorePage')),
  plan: cached(() => import('./pages/PlannerPage')),
  myWeek: cached(() => import('./pages/MyWeekPage')),
  ai: cached(() => import('./pages/AiLocalPage')),
  guide: cached(() => import('./pages/GuideDetailPage')),
  messages: cached(() => import('./pages/MessagesPage')),
  profile: cached(() => import('./pages/ProfilePage')),
  bookings: cached(() => import('./pages/ServiceBookingsPage')),
  together: cached(() => import('./pages/TogetherPage')),
  about: cached(() => import('./pages/AboutPage')),
  archive: cached(() => import('./pages/ArchivePage')),
  notFound: cached(() => import('./pages/NotFoundPage')),
  privacy: cached(() => import('./components/PrivacyPolicyView').then(settleChunk).then(m => ({ default: m.PrivacyPolicyView }))),
  terms: cached(() => import('./components/TermsView').then(settleChunk).then(m => ({ default: m.TermsView }))),
  sms: cached(() => import('./components/SmsConsentView').then(settleChunk).then(m => ({ default: m.SmsConsentView }))),
  notificationToken: cached(() => import('./pages/NotificationTokenPage')),
  opus: cached(() => import('./opus-bay/OpusBayPage')),
} satisfies Record<PageKey, unknown>;

/** The page chunk for a URL path (language prefix already removed), loaded before the app replaces the prerender. A guide
 * article also waits for its own record (WEB-DATA-SPLIT: guide-store.ts), so the app replaces the prerender in one pass. */
export function currentPageLoader(path: string) {
  const route = matchRoute(path);
  const page = pageLoaders[route?.page || 'notFound'];
  // WEB-PERF-2: an events view past the route's own days waits for the rest of the catalog. The page module owns that step
  // (`prepare`, features/events/events-later.ts): a dynamic import of events-later here would make it an entry of its own,
  // and Rollup would split the events model and lib/senior-friendly.ts into extra chunks (more cold script requests, H44).
  if ((route?.page === 'events' || route?.page === 'calendar') && typeof window !== 'undefined') {
    const load = route.page === 'events' ? pageLoaders.events : pageLoaders.calendar;
    const search = window.location.search, language = pathLanguage(window.location.pathname);
    return () => load().then(module => module.prepare(search, language).then(() => module));
  }
  if (route?.page !== 'guide') return page;
  let slug = routePathname(path).slice('/guides/'.length);
  try { slug = decodeURIComponent(slug); } catch { return page; }
  return () => Promise.all([page(), import('./features/guides/guide-store').then(settleChunk).then(store => store.loadGuide(slug))]).then(([module]) => module);
}
