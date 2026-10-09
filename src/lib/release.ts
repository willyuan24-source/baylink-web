/**
 * The web build a page is running: the commit scripts/generate-release.mjs wrote to public/release.json before
 * `vite build` (vite.config.ts `define`), or 'dev' outside a release build and in tests. Feedback rows and error
 * beacons carry it so a spike after a deploy points at the build the reader actually had, even in a stale tab.
 */
declare const __BAYLINK_RELEASE__: string | undefined;

const COMMIT = /^[0-9a-f]{7,40}$/;

export function releaseLabel(): string {
  const value = typeof __BAYLINK_RELEASE__ === 'string' ? __BAYLINK_RELEASE__ : '';
  // The API stores 12 hex digits of a commit; anything else is a short label.
  return COMMIT.test(value) ? value.slice(0, 12) : 'dev';
}
