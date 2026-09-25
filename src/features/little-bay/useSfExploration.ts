import { useCallback, useEffect, useState } from 'react';
import { collectSfExplorationStamp, emptySfExploration, parseSfExploration, SF_EXPLORATION_ROUTES, sfExplorationStorageKey, sfRouteProgress, type SfExplorationProgress } from './sf-exploration';

function readProgress(key: string) {
  if (typeof window === 'undefined') return emptySfExploration();
  try { return parseSfExploration(window.localStorage.getItem(key)); } catch { return emptySfExploration(); }
}

/** Personal game memories stay in this browser; they never assert real attendance or rewards. */
export function useSfExploration(ownerId?: string) {
  const key = sfExplorationStorageKey(ownerId);
  const [save, setSave] = useState(() => ({ key, progress: readProgress(key) }));
  // Account changes must never flash or overwrite the previous person's journal.
  const progress = save.key === key ? save.progress : readProgress(key);
  useEffect(() => { setSave({ key, progress: readProgress(key) }); }, [key]);
  useEffect(() => {
    if (save.key !== key) return;
    try { window.localStorage.setItem(key, JSON.stringify(save.progress)); } catch { /* Exploration remains playable with storage disabled. */ }
  }, [key, save]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === key || event.key === null) setSave({ key, progress: readProgress(key) });
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [key]);

  const update = useCallback((change: (current: SfExplorationProgress) => SfExplorationProgress) => {
    setSave(current => ({ key, progress: change(current.key === key ? current.progress : readProgress(key)) }));
  }, [key]);
  const startRoute = useCallback((routeId: string) => {
    if (!SF_EXPLORATION_ROUTES.some(route => route.id === routeId)) return;
    update(current => ({ ...current, activeRouteId: routeId }));
  }, [update]);
  const clearRoute = useCallback(() => update(current => ({ ...current, activeRouteId: null })), [update]);
  const collect = useCallback((landmarkId: string, currentNearId: string | null, choiceId?: string) => {
    const now = new Date();
    if (collectSfExplorationStamp(progress, landmarkId, currentNearId, choiceId, now) === progress) return false;
    update(current => collectSfExplorationStamp(current, landmarkId, currentNearId, choiceId, now));
    return true;
  }, [progress, update]);
  const activeRoute = SF_EXPLORATION_ROUTES.find(route => route.id === progress.activeRouteId) ?? null;
  return { progress, activeRoute, nextStopId: activeRoute ? sfRouteProgress(progress, activeRoute).nextStopId : null, collectedCount: Object.keys(progress.stamps).length, startRoute, collect, clearRoute };
}
