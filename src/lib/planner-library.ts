import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { getStoredUser } from './session';
import { favoriteKey, cleanStops, EMPTY_LIBRARY, errorText, eventFor, MAX_PLAN_STOPS, placeFor, todayInBay, validDay, validStop, type Favorite, type Library, type Preferences, type SavedPlan, type Stop } from './planner';
import { guides } from '../data/guides';
import { recordProductEvent } from './product-events';
import { normalizePlanDetails } from './planner-itinerary';
import { guestServerSaves, importGuestSaves, loadPlannerAccount, SAVE_ERROR_COPY, toggleSave, useSavedEntries } from './saves';

export const GUEST_PLANNER_KEY = 'baylink.planner.guest.v1';
/** Fired after a plan changes outside a mounted library ("加入这天计划"), so open plan lists read it again. */
export const PLANNER_CHANGED_EVENT = 'baylink-planner-changed';
export const loadGuestLibrary = (): Library => {
  try {
    const data = JSON.parse(localStorage.getItem(GUEST_PLANNER_KEY) || 'null');
    if (!data || !Array.isArray(data.plans) || !Array.isArray(data.favorites)) return structuredClone(EMPTY_LIBRARY);
    const prefs = data.preferences;
    const regions = Array.isArray(prefs?.regions) ? [...new Set<string>(prefs.regions.filter((r: string) => ['sf', 'east-bay', 'south-bay', 'peninsula', 'north-bay'].includes(r)))] : [];
    const interests = Array.isArray(prefs?.interests) ? [...new Set<string>(prefs.interests.filter((i: unknown) => typeof i === 'string' && i.length <= 40))].slice(0, 12) : [];
    const travelMode = ['any', 'drive', 'transit', 'walk'].includes(prefs?.travelMode) ? prefs.travelMode : 'any';
    // The ♡ list lives in src/lib/saves.ts now; this older field is kept as stored so a previous build still finds it.
    const favorites = (data.favorites as Favorite[]).filter(f => f?.kind === 'event' ? !!eventFor(f.id) : f?.kind === 'place' ? !!placeFor(f.id) : f?.kind === 'guide' && guides.some(guide => guide.slug === f.id)).filter((f, i, all) => all.findIndex(other => favoriteKey(other) === favoriteKey(f)) === i).slice(0, 150);
    const plans = data.plans.filter((p: SavedPlan) => typeof p?.id === 'string' && typeof p.title === 'string' && typeof p.date === 'string' && validDay(p.date) && cleanStops(p.stops).length).slice(0, 30).map((p: SavedPlan) => ({ ...p, title: p.title.slice(0, 80), stops: cleanStops(p.stops), ...(p.details ? { details: normalizePlanDetails(p.details, cleanStops(p.stops)) } : {}) }));
    const admissionBudgetUsd = prefs?.admissionBudgetUsd === null || (typeof prefs?.admissionBudgetUsd === 'number' && Number.isFinite(prefs.admissionBudgetUsd) && prefs.admissionBudgetUsd >= 0 && prefs.admissionBudgetUsd <= 10000) ? prefs.admissionBudgetUsd : undefined;
    const setting = ['any', 'indoor', 'outdoor', 'mixed'].includes(prefs?.setting) ? prefs.setting : undefined;
    return { preferences: { regions, interests, travelMode, ...(admissionBudgetUsd !== undefined ? { admissionBudgetUsd } : {}), ...(setting ? { setting } : {}) }, favorites, plans };
  } catch { return structuredClone(EMPTY_LIBRARY); }
};
export const samePlan = (a: Pick<SavedPlan, 'title' | 'date' | 'stops' | 'details'>, b: Pick<SavedPlan, 'title' | 'date' | 'stops' | 'details'>) => a.title === b.title && a.date === b.date && JSON.stringify(a.stops) === JSON.stringify(b.stops) && JSON.stringify(a.details) === JSON.stringify(b.details);
/** Tell open plan lists to read again. A failed notice never undoes a completed save. */
const announceChange = () => { try { if (typeof window !== 'undefined') window.dispatchEvent(new window.Event(PLANNER_CHANGED_EVENT)); } catch { /* lists refresh on their next read */ } };

/**
 * Plans, preferences and the ♡ list of one owner. Plans and preferences belong to this hook; favorites are the one
 * save model (src/lib/saves.ts), so the planner, My Week and every ♡ button show one list. No signed-in data is
 * written to browser storage by this hook. Account changes invalidate pending work.
 */
export function usePlannerLibrary(userId?: string) {
  const [state, setState] = useState<{ owner?: string; data: Library }>({ owner: userId, data: EMPTY_LIBRARY });
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [guestPlans, setGuestPlans] = useState(0);
  const saves = useSavedEntries(userId ?? null);
  const owner = useRef(userId);
  useEffect(() => { owner.current = userId; }, [userId]);
  const revision = useRef(0);
  const loaded = useRef(false);
  const mutation = useRef<symbol | null>(null);
  const own = state.owner === userId ? state.data : EMPTY_LIBRARY;
  const favorites = useMemo(() => saves.entries.flatMap((entry): Favorite[] => entry.kind === 'post' ? [] : [{ kind: entry.kind, id: entry.id }]), [saves.entries]);
  const data = useMemo<Library>(() => ({ ...own, favorites }), [own, favorites]);
  const dataRef = useRef(own);
  const isCurrent = (id: string | undefined, sequence: number) => owner.current === id && revision.current === sequence && (!id || getStoredUser()?.id === id);
  const refresh = useCallback(async () => {
    const sequence = ++revision.current;
    loaded.current = false;
    setReady(false);
    setLoading(true); setError(''); setBusy(false);
    setState({ owner: userId, data: EMPTY_LIBRARY });
    dataRef.current = EMPTY_LIBRARY;
    const guest = loadGuestLibrary(); setGuestPlans(guest.plans.length);
    try {
      // The ♡ store shares this read (one /planner/me request per account at a time).
      const next = userId ? await loadPlannerAccount(userId) as Library : guest;
      if (isCurrent(userId, sequence)) { loaded.current = true; setReady(true); dataRef.current = next; setState({ owner: userId, data: next }); }
    } catch (e) { if (isCurrent(userId, sequence)) setError(errorText(e)); }
    finally { if (isCurrent(userId, sequence)) setLoading(false); }
  }, [userId]);
  const invalidate = useCallback(() => { revision.current++; }, []);
  useEffect(() => { void refresh(); return invalidate; }, [refresh, invalidate]);
  /** Counts the library's own writes, so a re-read that started before one never overwrites its result. */
  const writes = useRef(0);
  /**
   * A plan changed outside this library ("加入这天计划"): read again, but keep what is on screen until the new read
   * lands. Clearing first (as `refresh` does) would drop the preferences and plans for the length of the read, so
   * rows filtered by them, and the confirmation of the button just tapped, would unmount. A failed re-read keeps
   * what is shown.
   */
  const reread = useCallback(async () => {
    if (!loaded.current) { void refresh(); return; }
    const sequence = revision.current, before = writes.current;
    try {
      const next = userId ? await loadPlannerAccount(userId) as Library : loadGuestLibrary();
      if (isCurrent(userId, sequence) && writes.current === before && !mutation.current) { dataRef.current = next; setState({ owner: userId, data: next }); }
    } catch { /* keep what is shown; the next full read reports a lasting failure */ }
  }, [userId, refresh]);
  useEffect(() => {
    const changed = () => { if (!mutation.current) void reread(); };
    window.addEventListener(PLANNER_CHANGED_EVENT, changed);
    return () => window.removeEventListener(PLANNER_CHANGED_EVENT, changed);
  }, [reread]);
  const commitGuest = (next: Library) => {
    // A failed write is an error, never a successful save banner.
    localStorage.setItem(GUEST_PLANNER_KEY, JSON.stringify(next));
    dataRef.current = next;
    setState({ owner: undefined, data: next });
  };
  const run = async <T,>(task: (sequence: number) => Promise<T>): Promise<T | undefined> => {
    const sequence = revision.current;
    if (mutation.current || loading || !loaded.current || state.owner !== userId || !isCurrent(userId, sequence)) return;
    const operation = Symbol(); mutation.current = operation; writes.current++;
    setBusy(true); setError('');
    try { return await task(sequence); }
    catch (e) { if (isCurrent(userId, sequence)) setError(errorText(e)); return undefined; }
    finally { if (mutation.current === operation) mutation.current = null; if (isCurrent(userId, sequence)) setBusy(false); }
  };
  const savePlan = (input: Pick<SavedPlan, 'title' | 'date' | 'stops' | 'details'>, existing?: SavedPlan) => run(async sequence => {
    if (!userId && !existing && dataRef.current.plans.length >= 30) throw new Error('最多保存 30 份计划，请先移除不再需要的计划。');
    const body = { ...input, stops: cleanStops(input.stops), ...(existing ? { version: existing.version } : {}) };
    let plan: SavedPlan;
    if (userId) ({ plan } = await api.request(`/planner/plans${existing ? '/' + encodeURIComponent(existing.id) : ''}`, { method: existing ? 'PUT' : 'POST', body: JSON.stringify(body) }));
    else { const now = new Date().toISOString(); plan = { ...body, id: existing?.id || crypto.randomUUID(), createdAt: existing?.createdAt || now, updatedAt: now, version: (existing?.version || 0) + 1 }; }
    if (!isCurrent(userId, sequence)) return;
    const next = { ...dataRef.current, plans: [plan, ...dataRef.current.plans.filter(p => p.id !== plan.id)] };
    if (userId) { dataRef.current = next; setState({ owner: userId, data: next }); } else commitGuest(next);
    recordProductEvent('plan_saved');
    return plan;
  });
  const deletePlan = (plan: SavedPlan) => run(async sequence => {
    if (userId) await api.request(`/planner/plans/${encodeURIComponent(plan.id)}`, { method: 'DELETE', body: JSON.stringify({ version: plan.version }) });
    if (!isCurrent(userId, sequence)) return;
    const next = { ...dataRef.current, plans: dataRef.current.plans.filter(p => p.id !== plan.id) };
    if (userId) { dataRef.current = next; setState({ owner: userId, data: next }); } else commitGuest(next);
    return true;
  });
  /** The same ♡ as every other save button (src/lib/saves.ts). */
  const toggleFavorite = (favorite: Favorite) => run(async sequence => {
    const result = await toggleSave(userId, favorite);
    if ('error' in result) throw { error: SAVE_ERROR_COPY[result.error].zh };
    return isCurrent(userId, sequence) ? true : undefined;
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
        const result = await api.request('/planner/plans', { method: 'POST', body: JSON.stringify({ title: plan.title, date: plan.date, stops: plan.stops, ...(plan.details ? { details: plan.details } : {}) }) });
        current.plans.push(result.plan);
      }
    }
    if (!isCurrent(userId, sequence)) return;
    await importGuestSaves(userId);
    if (!isCurrent(userId, sequence)) return;
    localStorage.removeItem(GUEST_PLANNER_KEY); setGuestPlans(0); dataRef.current = current; setState({ owner: userId, data: current });
    return true;
  });
  const guestCount = userId ? guestPlans + guestServerSaves().length : 0;
  return { data, loading, ready: !loading && state.owner === userId && ready, busy, error, guestCount, refresh, savePlan, deletePlan, toggleFavorite, savePreferences, importGuest };
}

export type AppendToDayResult = { plan: SavedPlan; created: boolean; alreadyThere: boolean };
type AppendError = { error: string; code: 'date' | 'stop' | 'full' | 'session' };

/** Account adds run one at a time per account, so a second quick add reads the plan the first one created. */
const appendQueues = new Map<string, Promise<void>>();

/**
 * "加入这天计划" (plan D19): add one stop to the owner's plan for that date, or create that plan, and save it right
 * away. A plan that already has six stops gets a second plan for the day. Open plan lists read again afterwards.
 */
export function appendToDay(userId: string | undefined, date: string, stop: Stop, title: string, today = todayInBay()): Promise<AppendToDayResult> {
  if (!userId) return appendNow(userId, date, stop, title, today);
  const run = (appendQueues.get(userId) ?? Promise.resolve()).then(() => appendNow(userId, date, stop, title, today));
  const settled = run.then(() => {}, () => {});
  appendQueues.set(userId, settled);
  void settled.then(() => { if (appendQueues.get(userId) === settled) appendQueues.delete(userId); });
  return run;
}

async function appendNow(userId: string | undefined, date: string, stop: Stop, title: string, today: string): Promise<AppendToDayResult> {
  if (!validDay(date) || date < today) throw { error: '请选择今天或之后的日期。', code: 'date' } satisfies AppendError;
  const [clean] = cleanStops([stop]);
  if (!clean || !validStop(clean)) throw { error: '这一站暂时不能加入计划。', code: 'stop' } satisfies AppendError;
  const key = favoriteKey(clean);
  // Every plan of that day, newest first: a stop already in any of them is not added again; new stops go to the newest.
  const sameDay = (plans: SavedPlan[]) => plans.filter(plan => plan.date === date).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const holding = (plans: SavedPlan[]) => plans.find(plan => plan.stops.some(item => favoriteKey(item) === key));
  const withStop = (plan: SavedPlan) => {
    const stops = [...plan.stops, clean];
    return { title: plan.title, date, stops, ...(plan.details ? { details: normalizePlanDetails(plan.details, stops) } : {}) };
  };
  const done = (result: AppendToDayResult) => { if (!result.alreadyThere) { recordProductEvent('plan_saved'); announceChange(); } return result; };
  if (!userId) {
    const library = loadGuestLibrary();
    const dayPlans = sameDay(library.plans), existing = dayPlans[0];
    const already = holding(dayPlans);
    if (already) return { plan: already, created: false, alreadyThere: true };
    const reuse = existing && existing.stops.length < MAX_PLAN_STOPS ? existing : undefined;
    if (!reuse && library.plans.length >= 30) throw { error: '最多保存 30 份计划，请先移除不再需要的计划。', code: 'full' } satisfies AppendError;
    const now = new Date().toISOString();
    const plan: SavedPlan = reuse
      ? { ...reuse, ...withStop(reuse), updatedAt: now, version: reuse.version + 1 }
      : { id: crypto.randomUUID(), title, date, stops: [clean], createdAt: now, updatedAt: now, version: 1 };
    // Only plans change here; the stored older ♡ field is written back as it was.
    let stored: { favorites?: unknown } | null;
    try { stored = JSON.parse(localStorage.getItem(GUEST_PLANNER_KEY) || 'null'); } catch { stored = null; }
    localStorage.setItem(GUEST_PLANNER_KEY, JSON.stringify({ ...library, favorites: Array.isArray(stored?.favorites) ? stored.favorites : [], plans: [plan, ...library.plans.filter(item => item.id !== plan.id)] }));
    return done({ plan, created: !reuse, alreadyThere: false });
  }
  for (let attempt = 0; ; attempt++) {
    if (getStoredUser()?.id !== userId) throw { error: SAVE_ERROR_COPY.session.zh, code: 'session' } satisfies AppendError;
    const library = await loadPlannerAccount(userId) as Partial<Library>;
    const dayPlans = sameDay(Array.isArray(library?.plans) ? library.plans : []), existing = dayPlans[0];
    const already = holding(dayPlans);
    if (already) return { plan: already, created: false, alreadyThere: true };
    const reuse = existing && existing.stops.length < MAX_PLAN_STOPS ? existing : undefined;
    try {
      const { plan } = reuse
        ? await api.request(`/planner/plans/${encodeURIComponent(reuse.id)}`, { method: 'PUT', body: JSON.stringify({ ...withStop(reuse), version: reuse.version }) })
        : await api.request('/planner/plans', { method: 'POST', body: JSON.stringify({ title, date, stops: [clean] }) });
      return done({ plan, created: !reuse, alreadyThere: false });
    } catch (error) {
      // Another device changed that plan meanwhile: read it again once and retry on the newer version.
      if (attempt === 0 && (error as { status?: number })?.status === 409) continue;
      throw error;
    }
  }
}
