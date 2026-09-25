import { useCallback, useEffect, useState } from 'react';
import { acceptBayAdventure, adventureFor, adventureNextKey, bayAdventuresKey, checkInBayAdventure, emptyBayAdventures, parseBayAdventures, type BayAdventureProgress } from './bay-adventures';

function read(key: string): BayAdventureProgress {
  if (typeof window === 'undefined') return emptyBayAdventures();
  try { return parseBayAdventures(window.localStorage.getItem(key)); } catch { return emptyBayAdventures(); }
}

/** Guest and account journals are independent; changing owners never copies the previous journal. */
export function useBayAdventures(owner?: string) {
  const key = bayAdventuresKey(owner);
  const [saved, setSaved] = useState(() => ({ key, progress: read(key) }));
  const [persistent, setPersistent] = useState(true);
  const progress = saved.key === key ? saved.progress : read(key);
  useEffect(() => { setSaved(current => current.key === key ? current : { key, progress: read(key) }); }, [key]);
  useEffect(() => {
    if (saved.key !== key) return;
    try { window.localStorage.setItem(key, JSON.stringify(saved.progress)); setPersistent(true); } catch { setPersistent(false); }
  }, [key, saved]);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === key || event.key === null) setSaved({ key, progress: read(key) }); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [key]);
  const update = useCallback((operation: (value: BayAdventureProgress) => BayAdventureProgress) => setSaved(current => {
    const previous = current.key === key ? current.progress : read(key), next = operation(previous);
    return current.key === key && previous === next ? current : { key, progress: next };
  }), [key]);
  const accept = useCallback((id: string) => update(value => acceptBayAdventure(value, id)), [update]);
  const checkIn = useCallback((nearKey: string | null) => update(value => checkInBayAdventure(value, nearKey)), [update]);
  const cancel = useCallback(() => update(value => value.activeId ? { ...value, activeId: null } : value), [update]);
  return { progress, activeQuest: adventureFor(progress.activeId), nextKey: adventureNextKey(progress), accept, checkIn, cancel, persistent };
}
