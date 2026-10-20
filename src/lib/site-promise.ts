/**
 * The site's promise in one place (UI9-HOME G12 wording; UI9-INT): HOME's masthead, NAV's header / footer and the about link
 * of EVENTS' facts line print these. The module is tiny and the shell imports it (lib/ui-navigation.ts), so the strings
 * ship once, in the entry; lib/check-dates.ts re-exports them for the home and the events pages.
 * METHOD_HREF is the only "我们怎么核对" target (AboutContent.tsx, captain decision 10). FREE_NO_SIGN_IN is printed only
 * while a guest can browse, ♡ save (kept in the browser) and ask BayBay (guest mode; decision 4, ui-navigation footerClaim).
 */
export const SITE_IDENTITY = { zh: '湾区华人家庭的周末活动与办事指南', en: 'Weekend outings and how-to guides for Chinese families in the Bay Area' } as const;
export const FREE_NO_SIGN_IN = { zh: '免费 · 不用登录', en: 'Free · no sign-in' } as const;
export const METHOD_HREF = '/about#about-method-title';
