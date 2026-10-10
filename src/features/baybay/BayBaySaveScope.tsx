import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePlannerLibrary } from '../../lib/planner-library';
import { favoriteKey } from '../../lib/planner';
import { BayBaySaveContext, type BayBaySaves } from './save-context';

/**
 * ♡ 想去 inside BayBay answers uses the save model that is on main today (planner favorites: server for members,
 * this browser for guests). Offers and openings join when WEB-SAVES' `useSave` lands. The library loads only once an
 * answer shows a card that can be saved, so a panel that never shows one makes no planner request.
 */
function Library({ ownerId, onChange }: { ownerId?: string; onChange: (saves: BayBaySaves) => void }) {
  const library = usePlannerLibrary(ownerId);
  const latest = useRef(library);
  useEffect(() => { latest.current = library; });
  const keys = library.data.favorites.map(favoriteKey).join('\n');
  const busy = library.loading || library.busy;
  useEffect(() => {
    const saved = new Set(keys ? keys.split('\n') : []);
    onChange({ ready: library.ready, busy, error: library.error, saved: favorite => saved.has(favoriteKey(favorite)), toggle: favorite => { void latest.current.toggleFavorite(favorite); } });
  }, [library.ready, busy, library.error, keys, onChange]);
  return null;
}

export function BayBaySaveScope({ ownerId, active, children }: { ownerId?: string; active: boolean; children: ReactNode }) {
  const [saves, setSaves] = useState<BayBaySaves | null>(null);
  const [loaded, setLoaded] = useState(active);
  if (active && !loaded) setLoaded(true);
  return <BayBaySaveContext.Provider value={saves}>{loaded && <Library ownerId={ownerId} onChange={setSaves} />}{children}</BayBaySaveContext.Provider>;
}
