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

/** Loads the board's chunk once for every caller (one retry after 1 s, as the app's other lazy chunks). Never rejects:
 * a failure is reported by communityBoardFailure() and the next call tries again. */
export const loadCommunityBoard = (): Promise<void> => boardLoad ||= import('./CommunityBoard')
  .catch(() => new Promise<void>(resolve => setTimeout(resolve, 1000)).then(() => import('./CommunityBoard')))
  .then(module => { LoadedCommunityBoard = module.default; boardError = undefined; })
  .catch(error => { boardLoad = undefined; boardError = error ?? new Error('The community board did not load'); });

/** Why the last load failed, while no other load is under way. */
export const communityBoardFailure = (): unknown => boardLoad ? undefined : boardError;
