/**
 * G70 (CW-03, I18N-SEO-14): the signed-in pages open on a neutral first paint instead of the homepage's prerender.
 * scripts/prerender.tsx writes the shell files of ACCOUNT_SHELLS below in each language (the site chrome around a
 * fixed-height skeleton; noindex, no canonical or hreflang) and scripts/sync-public-routes.ts serves each one for its
 * route-table paths, ahead of the SPA route to index.html (which still lists them; the first match wins on Vercel). The app
 * then renders the real page.
 */
export const ACCOUNT_SHELL_FILE = 'account-shell.html';
export const ACCOUNT_SHELL_PATHS = ['/me', '/me/bookings', '/my-week', '/messages', '/messages/:threadId', '/together'] as const;

/**
 * DECISIONS 41 (NAV PR B, UI9-R2-ACCOUNT-UTILITY): the shell is shaped like the page it stands for, so there is one file per
 * shape (components/AccountShell.tsx): /me keeps ACCOUNT_SHELL_FILE (the page header and its four tiles), /my-week and
 * /together have their own, and the two list pages (/me/bookings, /messages) share the rows. Together they cover exactly
 * ACCOUNT_SHELL_PATHS (tests/account-shell.test.tsx). A shape is static HTML: the page is known from the file the host
 * serves, before any script runs.
 */
export type AccountShellPage = 'me' | 'week' | 'together' | 'list';
export const ACCOUNT_SHELLS: readonly { page: AccountShellPage; file: string; paths: readonly (typeof ACCOUNT_SHELL_PATHS)[number][] }[] = [
  { page: 'me', file: ACCOUNT_SHELL_FILE, paths: ['/me'] },
  { page: 'week', file: 'account-shell-week.html', paths: ['/my-week'] },
  { page: 'together', file: 'account-shell-together.html', paths: ['/together'] },
  { page: 'list', file: 'account-shell-list.html', paths: ['/me/bookings', '/messages', '/messages/:threadId'] },
];

/**
 * A shell file stands for every page of its shape (the list file for three paths), so it names none of them: the prerender
 * renders it, then takes out the canonical link and og:url that renderHtmlDocument writes for every page (noindex already
 * leaves out hreflang).
 */
export const withoutPageAddress = (html: string): string =>
  html.replace(/\s*<link rel="canonical" href="[^"]*" \/>/, '').replace(/\s*<meta property="og:url" content="[^"]*" \/>/, '');
