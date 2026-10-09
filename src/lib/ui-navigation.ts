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
