import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { getStoredUser } from './session';
import { cleanStops, EMPTY_LIBRARY, errorText, eventFor, placeFor, validDay, type Favorite, type Library, type Preferences, type SavedPlan } from './planner';
import { guides } from '../data/guides';

export const GUEST_PLANNER_KEY = 'baylink.planner.guest.v1';
export const loadGuestLibrary = (): Library => {
  try {
    const data = JSON.parse(localStorage.getItem(GUEST_PLANNER_KEY) || 'null');
    if (!data || !Array.isArray(data.plans) || !Array.isArray(data.favorites)) return structuredClone(EMPTY_LIBRARY);
    const prefs = data.preferences;
    const regions = Array.isArray(prefs?.regions) ? [...new Set<string>(prefs.regions.filter((r: string) => ['sf', 'east-bay', 'south-bay', 'peninsula', 'north-bay'].includes(r)))] : [];
    const interests = Array.isArray(prefs?.interests) ? [...new Set<string>(prefs.interests.filter((i: unknown) => typeof i === 'string' && i.length <= 40))].slice(0, 12) : [];
    const travelMode = ['any', 'drive', 'transit', 'walk'].includes(prefs?.travelMode) ? prefs.travelMode : 'any';
    const favorites = (data.favorites as Favorite[]).filter(f => f?.kind === 'event' ? !!eventFor(f.id) : f?.kind === 'place' ? !!placeFor(f.id) : f?.kind === 'guide' && guides.some(guide => guide.slug === f.id)).filter((f, i, all) => all.findIndex(other => other.kind === f.kind && other.id === f.id) === i).slice(0, 150);
    const plans = data.plans.filter((p: SavedPlan) => typeof p?.id === 'string' && typeof p.title === 'string' && typeof p.date === 'string' && validDay(p.date) && cleanStops(p.stops).length).slice(0, 30).map((p: SavedPlan) => ({ ...p, title: p.title.slice(0, 80), stops: cleanStops(p.stops) }));
    return { preferences: { regions, interests, travelMode }, favorites, plans };
  } catch { return structuredClone(EMPTY_LIBRARY); }
};
export const samePlan = (a: Pick<SavedPlan, 'title' | 'date' | 'stops'>, b: Pick<SavedPlan, 'title' | 'date' | 'stops'>) => a.title === b.title && a.date === b.date && JSON.stringify(a.stops) === JSON.stringify(b.stops);

/** No signed-in data is written to browser storage. Account changes invalidate pending work. */
export function usePlannerLibrary(userId?: string) {
  const [state, setState] = useState<{ owner?: string; data: Library }>({ owner: userId, data: EMPTY_LIBRARY });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [guestCount, setGuestCount] = useState(0);
  const owner = useRef(userId);
  useEffect(() => { owner.current = userId; }, [userId]);
  const revision = useRef(0);
  const mutation = useRef<symbol | null>(null);
  const data = state.owner === userId ? state.data : EMPTY_LIBRARY;
  const dataRef = useRef(data);
  const isCurrent = (id: string | undefined, sequence: number) => owner.current === id && revision.current === sequence && (!id || getStoredUser()?.id === id);
  const refresh = useCallback(async () => {
    const sequence = ++revision.current;
    setLoading(true); setError(''); setBusy(false);
    setState({ owner: userId, data: EMPTY_LIBRARY });
    dataRef.current = EMPTY_LIBRARY;
    const guest = loadGuestLibrary(); setGuestCount(guest.plans.length + guest.favorites.length);
    try {
      const next: Library = userId ? await api.request('/planner/me') : guest;
      if (isCurrent(userId, sequence)) { dataRef.current = next; setState({ owner: userId, data: next }); }
    } catch (e) { if (isCurrent(userId, sequence)) setError(errorText(e)); }
    finally { if (isCurrent(userId, sequence)) setLoading(false); }
  }, [userId]);
  const invalidate = useCallback(() => { revision.current++; }, []);
  useEffect(() => { void refresh(); return invalidate; }, [refresh, invalidate]);
  const commitGuest = (next: Library) => {
    // A failed write is an error, never a successful save banner.
    localStorage.setItem(GUEST_PLANNER_KEY, JSON.stringify(next));
    dataRef.current = next;
    setState({ owner: undefined, data: next });
  };
  const run = async <T,>(task: (sequence: number) => Promise<T>): Promise<T | undefined> => {
    const sequence = revision.current;
    if (mutation.current || loading || !isCurrent(userId, sequence)) return;
    const operation = Symbol(); mutation.current = operation;
    setBusy(true); setError('');
    try { return await task(sequence); }
    catch (e) { if (isCurrent(userId, sequence)) setError(errorText(e)); return undefined; }
    finally { if (mutation.current === operation) mutation.current = null; if (isCurrent(userId, sequence)) setBusy(false); }
  };
  const savePlan = (input: Pick<SavedPlan, 'title' | 'date' | 'stops'>, existing?: SavedPlan) => run(async sequence => {
    const body = { ...input, stops: cleanStops(input.stops), ...(existing ? { version: existing.version } : {}) };
    let plan: SavedPlan;
    if (userId) ({ plan } = await api.request(`/planner/plans${existing ? '/' + encodeURIComponent(existing.id) : ''}`, { method: existing ? 'PUT' : 'POST', body: JSON.stringify(body) }));
    else { const now = new Date().toISOString(); plan = { ...body, id: existing?.id || crypto.randomUUID(), createdAt: existing?.createdAt || now, updatedAt: now, version: (existing?.version || 0) + 1 }; }
    if (!isCurrent(userId, sequence)) return;
    const next = { ...dataRef.current, plans: [plan, ...dataRef.current.plans.filter(p => p.id !== plan.id)] };
    if (userId) { dataRef.current = next; setState({ owner: userId, data: next }); } else commitGuest(next);
    return plan;
  });
  const deletePlan = (plan: SavedPlan) => run(async sequence => {
    if (userId) await api.request(`/planner/plans/${encodeURIComponent(plan.id)}`, { method: 'DELETE', body: JSON.stringify({ version: plan.version }) });
    if (!isCurrent(userId, sequence)) return;
    const next = { ...dataRef.current, plans: dataRef.current.plans.filter(p => p.id !== plan.id) };
    if (userId) { dataRef.current = next; setState({ owner: userId, data: next }); } else commitGuest(next);
    return true;
  });
  const toggleFavorite = (favorite: Favorite) => run(async sequence => {
    const found = dataRef.current.favorites.some(f => f.kind === favorite.kind && f.id === favorite.id);
    let favorites = found ? dataRef.current.favorites.filter(f => f.kind !== favorite.kind || f.id !== favorite.id) : [...dataRef.current.favorites, favorite];
    if (userId) ({ favorites } = await api.request(`/planner/favorites/${favorite.kind}/${encodeURIComponent(favorite.id)}`, { method: found ? 'DELETE' : 'PUT' }));
    if (!isCurrent(userId, sequence)) return;
    const next = { ...dataRef.current, favorites };
    if (userId) { dataRef.current = next; setState({ owner: userId, data: next }); } else commitGuest(next);
    return true;
  });
  const savePreferences = (preferences: Preferences) => run(async sequence => {
    if (userId) ({ preferences } = await api.request('/planner/preferences', { method: 'PATCH', body: JSON.stringify(preferences) }));
    if (!isCurrent(userId, sequence)) return;
    const next = { ...dataRef.current, preferences };
    if (userId) { dataRef.current = next; setState({ owner: userId, data: next }); } else commitGuest(next);
    return true;
  });
  const importGuest = () => run(async sequence => {
    if (!userId || !isCurrent(userId, sequence)) return;
    const guest = loadGuestLibrary();
    const current: Library = await api.request('/planner/me');
    for (const plan of guest.plans) {
      if (!isCurrent(userId, sequence)) return;
      if (!current.plans.some(p => samePlan(p, plan))) {
        const result = await api.request('/planner/plans', { method: 'POST', body: JSON.stringify({ title: plan.title, date: plan.date, stops: plan.stops }) });
        current.plans.push(result.plan);
      }
    }
    for (const favorite of guest.favorites) {
      if (!isCurrent(userId, sequence)) return;
      const result = await api.request(`/planner/favorites/${favorite.kind}/${encodeURIComponent(favorite.id)}`, { method: 'PUT' }); current.favorites = result.favorites;
    }
    if (!isCurrent(userId, sequence)) return;
    localStorage.removeItem(GUEST_PLANNER_KEY); setGuestCount(0); dataRef.current = current; setState({ owner: userId, data: current });
    return true;
  });
  return { data, loading, busy, error, guestCount, refresh, savePlan, deletePlan, toggleFavorite, savePreferences, importGuest };
}
