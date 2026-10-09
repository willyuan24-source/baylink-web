/**
 * Pages that never search: the homepage, what opens over it (posts, profiles, the password reset) and the community
 * board. Every other page waits for the search dictionaries in its language gate (src/i18n/locale.ts), and its JS
 * budget counts them (scripts/route-budgets.mjs). No imports here: the budget script loads this file with Node's type
 * stripping.
 */
export function searchFreePath(path: string): boolean {
  const pathname = new URL(path, 'https://www.baylink.us').pathname.replace(/^\/(?:en|zh-Hant)(?=\/|$)/u, '') || '/';
  return /^\/(?:(?:posts|users|category)\/.*|reset-password)?$/u.test(pathname);
}
