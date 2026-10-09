import { routeTemplate } from '../app/route-table';

/**
 * The analytics name of a page: its route-table pattern ('/events/:id', '/guides/:slug') without the language prefix,
 * query, hash or any id, or 'other' when the path is not an app route. Product events, feedback and error beacons send
 * only this, never the URL (the API maps the same patterns onto its allowlist, lib/routeTemplates.js).
 */
export { routeTemplate };

/**
 * The template of a page the app renders. App.tsx answers every path outside the route table with NotFoundPage
 * (<Route path="*">; the route-table test keeps the two equal), so those count as '/not-found', which the API allowlists.
 */
export const pageTemplate = (pathname: string): string => {
  const template = routeTemplate(pathname);
  return template === 'other' ? '/not-found' : template;
};

/** The current page's template; 'other' outside a browser. */
export const currentRouteTemplate = (): string => typeof window === 'undefined' ? 'other' : pageTemplate(window.location.pathname);
