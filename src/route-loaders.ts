/** Shared promises let startup load the current page before replacing its prerendered content. */
const cached = <T,>(load: () => Promise<T>) => {
  let promise: Promise<T> | undefined;
  return () => promise ||= load().catch(error => { promise = undefined; throw error; });
};
export const pageLoaders = {
  home: cached(() => import('./pages/HomePage')),
  guides: cached(() => import('./pages/GuidesPage')),
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
  recommend: cached(() => import('./pages/RecommendPage')),
  profile: cached(() => import('./pages/ProfilePage')),
  bookings: cached(() => import('./pages/ServiceBookingsPage')),
  together: cached(() => import('./pages/TogetherPage')),
  about: cached(() => import('./pages/AboutPage')),
  notFound: cached(() => import('./pages/NotFoundPage')),
  privacy: cached(() => import('./components/PrivacyPolicyView').then(m => ({ default: m.PrivacyPolicyView }))),
  terms: cached(() => import('./components/TermsView').then(m => ({ default: m.TermsView }))),
  sms: cached(() => import('./components/SmsConsentView').then(m => ({ default: m.SmsConsentView }))),
  notificationToken: cached(() => import('./pages/NotificationTokenPage')),
  opus: cached(() => import('./opus-bay/OpusBayPage')),
};
export function currentPageLoader(path: string) {
  if (/^\/(category|posts|users)\//.test(path) || path === '/' || path === '/reset-password') return pageLoaders.home;
  if (path.startsWith('/guides/')) return pageLoaders.guide;
  if (/^\/(events|offers|openings)\//.test(path)) return pageLoaders.discovery;
  if (path.startsWith('/messages')) return pageLoaders.messages;
  if (path === '/me/bookings') return pageLoaders.bookings;
  const route: Record<string, keyof typeof pageLoaders> = {
    '/guides': 'guides', '/this-month': 'monthly', '/this-week': 'monthly', '/calendar': 'calendar',
    '/tools': 'tools', '/explore': 'explore', '/plan': 'plan', '/my-week': 'myWeek',
    '/ai-in-the-bay': 'ai', '/recommend': 'recommend', '/me': 'profile', '/together': 'together',
    '/about': 'about', '/privacy': 'privacy', '/terms': 'terms', '/sms-consent': 'sms', '/opus-bay': 'opus',
    '/verify-email': 'notificationToken', '/notifications/unsubscribe': 'notificationToken',
  };
  return pageLoaders[route[path.replace(/\/$/, '')] || 'notFound'];
}
