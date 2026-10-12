/**
 * G70 (CW-03, I18N-SEO-14): the signed-in pages open on a neutral first paint instead of the homepage's prerender.
 * scripts/prerender.tsx writes ACCOUNT_SHELL_FILE in each language (the site chrome around a fixed-height skeleton; noindex,
 * no canonical or hreflang) and scripts/sync-public-routes.ts serves it for these route-table paths, ahead of the SPA
 * route to index.html (which still lists them; the first match wins on Vercel). The app then renders the real page.
 */
export const ACCOUNT_SHELL_FILE = 'account-shell.html';
export const ACCOUNT_SHELL_PATHS = ['/me', '/me/bookings', '/my-week', '/messages', '/messages/:threadId', '/together'] as const;
