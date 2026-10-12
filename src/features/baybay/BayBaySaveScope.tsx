import { useState, type ReactNode } from 'react';
import { BayBaySaveContext, type BayBaySaves } from './save-context';
import { useBayBayCardsModule } from './cards-loader';

/**
 * 收藏 inside BayBay answers uses the save model that is on main today (planner favorites, i.e. 我的这周: server for
 * members, this browser for guests). Offers and openings join, and the button can become ♡ 想去, when WEB-SAVES'
 * `useSave` lands. The library loads (with the card chunk) only once an answer shows a card that can be saved, so a
 * panel that never shows one makes no planner request. If the chunk cannot load, the cards fall back to plain links.
 */
export function BayBaySaveScope({ ownerId, active, children }: { ownerId?: string; active: boolean; children: ReactNode }) {
  const [saves, setSaves] = useState<BayBaySaves | null>(null);
  const [loaded, setLoaded] = useState(active);
  if (active && !loaded) setLoaded(true);
  const { module } = useBayBayCardsModule(loaded);
  const Library = loaded && module ? module.BayBaySaveLibrary : null;
  return <BayBaySaveContext.Provider value={saves}>{Library && <Library ownerId={ownerId} onChange={setSaves} />}{children}</BayBaySaveContext.Provider>;
}
