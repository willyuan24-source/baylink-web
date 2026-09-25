import { useCallback, useEffect, useState } from 'react';
import { bayDiscoveriesKey, collectBayDiscovery, emptyBayDiscoveries, parseBayDiscoveries, type BayDiscoveryContext, type BayDiscoveryProgress } from './bay-discoveries';

function read(key: string): BayDiscoveryProgress {
  if (typeof window === 'undefined') return emptyBayDiscoveries();
  try { return parseBayDiscoveries(window.localStorage.getItem(key)); } catch { return emptyBayDiscoveries(); }
}

export function useBayDiscoveries(ownerId?: string) {
  const key = bayDiscoveriesKey(ownerId);
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
  const collect = useCallback((id: string, choiceId: string, context: BayDiscoveryContext) => setSaved(current => {
    const previous = current.key === key ? current.progress : read(key);
    const next = collectBayDiscovery(previous, id, choiceId, context);
    return current.key === key && previous === next ? current : { key, progress: next };
  }), [key]);
  return { progress, collect, persistent };
}
