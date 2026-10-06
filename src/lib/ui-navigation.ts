export type PrimaryNavigationPath = '/' | '/calendar' | '/guides' | '/me';

/** A route belongs to one user task, independently of the legacy layout tabs. */
export function primaryNavigationPath(pathname: string): PrimaryNavigationPath | null {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path === '/' || path.startsWith('/category/') || path.startsWith('/posts/')) return '/';
  if (/^\/(calendar|events|offers|openings|this-month|this-week|ai-in-the-bay|plan|together)(\/|$)/.test(path)) return '/calendar';
  if (/^\/(guides|explore|tools|recommend)(\/|$)/.test(path)) return '/guides';
  if (/^\/(me|my-week|messages|users)(\/|$)/.test(path)) return '/me';
  return null;
}
