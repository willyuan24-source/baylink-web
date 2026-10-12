import type { ReactNode } from 'react';
import { BayBayOwnerContext } from './save-context';

/**
 * ♡ 收藏 inside BayBay answers writes the one save model (SAVES' `useSave`, src/lib/saves.ts) for this owner: the
 * account's favorites when signed in, this browser's list for a guest. The store loads with the first card that shows
 * a ♡, so a panel that never shows one makes no save request.
 */
export function BayBaySaveScope({ ownerId, children }: { ownerId?: string; children: ReactNode }) {
  return <BayBayOwnerContext.Provider value={ownerId}>{children}</BayBayOwnerContext.Provider>;
}
