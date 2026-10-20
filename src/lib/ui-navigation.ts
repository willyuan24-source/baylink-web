import { matchRoute } from '../app/route-table';

export type PrimaryNavigationPath = '/' | '/events' | '/guides' | '/me';
const PRIMARY = { home: '/', events: '/events', guides: '/guides', me: '/me' } as const;

/**
 * The bottom-bar / header tab a route belongs to (route-table `section`). Each URL has one owner; 邻里 (/category,
 * /posts, /users), 3D, about and legal pages live in 更多 and highlight no primary tab.
 */
export function primaryNavigationPath(pathname: string): PrimaryNavigationPath | null {
  const section = matchRoute(pathname)?.section;
  return section && section in PRIMARY ? PRIMARY[section as keyof typeof PRIMARY] : null;
}

/**
 * The site's promise in HOME's exact words (UI9-HOME: src/lib/check-dates.ts SITE_IDENTITY / FREE_NO_SIGN_IN /
 * METHOD_HREF, which are not on this lane's base). The footer prints the same strings; UI9-INT points these three at
 * HOME's exports once both lanes are on main.
 */
export const SITE_IDENTITY = { zh: '湾区华人家庭的周末活动与办事指南', en: 'Weekend outings and how-to guides for Chinese families in the Bay Area' } as const;
export const FREE_NO_SIGN_IN = { zh: '免费 · 不用登录', en: 'Free · no sign-in' } as const;
export const FREE_ONLY = { zh: '免费', en: 'Free' } as const;
/** The only 我们怎么核对 target (AboutContent.tsx, captain decision 10). */
export const METHOD_HREF = '/about#about-method-title';

/**
 * Captain decision 4: 不用登录 is printed only while a guest can browse, ♡ save (the guest list in this browser,
 * lib/saves.ts savesKey() without a user) and ask BayBay (guest mode: BayBayAssistantEntry without an ownerId). The
 * signed-out run that shows all three is recorded in the lane's PR.md; tests/ui9-nav-chrome.test.tsx pins the rule.
 */
export type GuestCapabilities = { browse: boolean; save: boolean; baybay: boolean };
export const GUEST_CAPABILITIES: GuestCapabilities = { browse: true, save: true, baybay: true };
export function footerClaim(guest: GuestCapabilities = GUEST_CAPABILITIES) {
  return guest.browse && guest.save && guest.baybay ? FREE_NO_SIGN_IN : FREE_ONLY;
}
