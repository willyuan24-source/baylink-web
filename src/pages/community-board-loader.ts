import type { ReactNode } from 'react';
import type { CommunityBoardProps } from './CommunityBoard';

// The community board (category pages, /?q= searches, the expanded 邻里信息 and the background of /posts/:id deep links)
// is its own chunk, so the homepage's first load stays light (WEB-HOMEPREP, RC-17). HomePage renders it from this
// loader rather than through React.lazy: once loaded it renders synchronously, so a page that needs it never shows an
// empty frame.

/** The board's component once its chunk is in (a live binding: importers see it arrive). */
export let LoadedCommunityBoard: ((props: CommunityBoardProps) => ReactNode) | undefined;
let boardLoad: Promise<void> | undefined;
let boardError: unknown;

/** Loads the board's chunk once for every caller. Never rejects: a failure is reported by communityBoardFailure(), and
 * the next call imports again. No in-page retry: Chrome answers a repeated import() of a chunk that failed in the page
 * from its module map, with no new request (the lane's retry-probe), so only an engine that refetches (Node, in the
 * tests) gets anything from asking again; HomePage's 重新加载 reloads the page instead. Online, a failed chunk also
 * fires vite:preloadError, and the app's chunk recovery (lib/chunk-recovery.ts) reloads the page once per path per five
 * minutes — on the homepage too when the board was shown on its own (≥ 4 recent posts, or the feed's error state). */
export const loadCommunityBoard = (): Promise<void> => boardLoad ||= import('./CommunityBoard')
  .then(module => { LoadedCommunityBoard = module.default; boardError = undefined; })
  .catch(error => { boardLoad = undefined; boardError = error ?? new Error('The community board did not load'); });

/** Why the last load failed, while no other load is under way. */
export const communityBoardFailure = (): unknown => boardLoad ? undefined : boardError;
