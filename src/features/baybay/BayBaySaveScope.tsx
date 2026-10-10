import { useEffect, useState, type ReactNode } from 'react';
import { BayBaySaveContext, type BayBaySaves } from './save-context';
import { bayBayCardsModule, loadBayBayCards } from './cards-loader';

/**
 * ♡ 想去 inside BayBay answers uses the save model that is on main today (planner favorites: server for members,
 * this browser for guests). Offers and openings join when WEB-SAVES' `useSave` lands. The library loads (with the card
 * chunk) only once an answer shows a card that can be saved, so a panel that never shows one makes no planner request.
 */
export function BayBaySaveScope({ ownerId, active, children }: { ownerId?: string; active: boolean; children: ReactNode }) {
  const [saves, setSaves] = useState<BayBaySaves | null>(null);
  const [module, setModule] = useState(bayBayCardsModule);
  const [loaded, setLoaded] = useState(active);
  if (active && !loaded) setLoaded(true);
  useEffect(() => { if (loaded && !module) void loadBayBayCards().then(setModule, () => {}); }, [loaded, module]);
  const Library = loaded && module ? module.BayBaySaveLibrary : null;
  return <BayBaySaveContext.Provider value={saves}>{Library && <Library ownerId={ownerId} onChange={setSaves} />}{children}</BayBaySaveContext.Provider>;
}
