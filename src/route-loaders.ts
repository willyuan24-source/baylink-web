import { matchRoute, type PageKey } from './app/route-table';

/** Shared promises let startup load the current page before replacing its prerendered content. */
const cached = <T,>(load: () => Promise<T>) => {
  let promise: Promise<T> | undefined;
  return () => promise ||= load().catch(error => { promise = undefined; throw error; });
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
  privacy: cached(() => import('./components/PrivacyPolicyView').then(m => ({ default: m.PrivacyPolicyView }))),
  terms: cached(() => import('./components/TermsView').then(m => ({ default: m.TermsView }))),
  sms: cached(() => import('./components/SmsConsentView').then(m => ({ default: m.SmsConsentView }))),
  notificationToken: cached(() => import('./pages/NotificationTokenPage')),
  opus: cached(() => import('./opus-bay/OpusBayPage')),
} satisfies Record<PageKey, unknown>;

/** The page chunk for a URL path (language prefix already removed), loaded before the app replaces the prerender. */
export function currentPageLoader(path: string) {
  return pageLoaders[matchRoute(path)?.page || 'notFound'];
}
