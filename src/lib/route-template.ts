import { routeTemplate } from '../app/route-table';

/**
 * The analytics name of a page: its route-table pattern ('/events/:id', '/guides/:slug') without the language prefix,
 * query, hash or any id, or 'other' when the path is not an app route. Product events, feedback and error beacons send
 * only this, never the URL (the API maps the same patterns onto its allowlist, lib/routeTemplates.js).
 */
export { routeTemplate };

/** The current page's template; 'other' outside a browser. */
export const currentRouteTemplate = (): string => typeof window === 'undefined' ? 'other' : routeTemplate(window.location.pathname);
