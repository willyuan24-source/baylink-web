import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, getStoredUser } from './api';
import { eventDraftError, parseImportedEvents, type ImportedEvent, type EventDraft } from './imported-events';

export const GUEST_EVENTS_KEY = 'baylink.imported-events.guest.v1';
const CHANGED = 'baylink-imported-events-changed';
type Snapshot = { events: ImportedEvent[]; revision: number };
const empty = (): Snapshot => ({ events: [], revision: 0 });
function parseSnapshot(value: unknown): Snapshot {
  const input = value as Snapshot;
  const events = parseImportedEvents(input?.events);
  if (!events || !Number.isSafeInteger(input.revision) || input.revision < 0) throw new Error('活动记录暂时无法读取，请重新加载。');
  return { events, revision: input.revision };
}
export function useImportedEvents(userId?: string) {
  const [state, setState] = useState<{ owner?: string; data: Snapshot }>({ owner: userId, data: empty() });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const owner = useRef(userId);
  const sequence = useRef(0);
  const snapshot = useRef(empty());
  const mutating = useRef<symbol>();
  const ready = useRef(false);
  const identity = useRef(Symbol());
  useLayoutEffect(() => { owner.current = userId; ready.current = false; mutating.current = undefined; sequence.current++; setBusy(false); }, [userId]);
  const current = useCallback((epoch: number) => sequence.current === epoch && owner.current === userId && (!userId || getStoredUser()?.id === userId), [userId]);
  const refresh = useCallback(async () => {
    const epoch = ++sequence.current;
    ready.current = false; setLoading(true); setError(''); snapshot.current = empty(); setState({ owner: userId, data: empty() });
    try {
      const raw = userId ? await api.request('/planner/imported-events') : JSON.parse(localStorage.getItem(GUEST_EVENTS_KEY) || '{"events":[],"revision":0}');
      const next = parseSnapshot(raw);
      if (current(epoch)) { ready.current = true; snapshot.current = next; setState({ owner: userId, data: next }); }
    } catch { if (current(epoch)) setError('活动记录暂时无法读取，请重新加载。'); }
    finally { if (current(epoch)) setLoading(false); }
  }, [userId, current]);
  useEffect(() => {
    void refresh();
    const changed = (event: Event) => { if ((event as CustomEvent).detail !== identity.current) void refresh(); };
    const storage = (event: StorageEvent) => { if (!userId && event.key === GUEST_EVENTS_KEY) void refresh(); };
    window.addEventListener(CHANGED, changed); window.addEventListener('storage', storage);
    const invalidate = () => { sequence.current++; ready.current = false; };
    return () => { invalidate(); window.removeEventListener(CHANGED, changed); window.removeEventListener('storage', storage); };
  }, [refresh, userId]);
  const commit = async (events: ImportedEvent[]) => {
    const epoch = sequence.current;
    if (!ready.current || mutating.current || !current(epoch)) return false;
    const mutation = Symbol(); mutating.current = mutation; setBusy(true); setError('');
    try {
      let next: Snapshot;
      if (userId) next = parseSnapshot(await api.request('/planner/imported-events', { method: 'PUT', body: JSON.stringify({ events, revision: snapshot.current.revision }) }));
      else {
        const latest = parseSnapshot(JSON.parse(localStorage.getItem(GUEST_EVENTS_KEY) || '{"events":[],"revision":0}'));
        if (latest.revision !== snapshot.current.revision) throw { status: 409 };
        next = { events, revision: latest.revision + 1 };
        localStorage.setItem(GUEST_EVENTS_KEY, JSON.stringify(next));
      }
      if (!current(epoch)) return false;
      snapshot.current = next; setState({ owner: userId, data: next });
      window.dispatchEvent(new CustomEvent(CHANGED, { detail: identity.current }));
      return true;
    } catch (e) {
      if (current(epoch)) {
        if ((e as { status?: number })?.status === 409) { await refresh(); if (owner.current === userId) setError('日程已在别处更新，请核对后再次保存。你填写的内容仍保留。'); }
        else setError('保存失败，内容仍保留。请检查连接或浏览器存储后重试。');
      }
      return false;
    } finally { if (mutating.current === mutation) { mutating.current = undefined; if (owner.current === userId) setBusy(false); } }
  };
  const save = async (draft: EventDraft, id?: string) => {
    const problem = eventDraftError(draft);
    if (problem) { setError(problem); return undefined; }
    const events = snapshot.current.events;
    if (!id && events.some(event => event.title === draft.title && event.date === draft.date && event.startTime === draft.startTime && event.venue === draft.venue)) { setError('这场活动已在你的日程里。'); return undefined; }
    if (!events.some(event => event.id === id) && events.length >= 60) { setError('最多保存 60 场私人活动，请先整理已结束的活动。'); return undefined; }
    const event = { id: id || crypto.randomUUID(), ...draft };
    return await commit([event, ...events.filter(event => event.id !== id)]) ? event : undefined;
  };
  return { events: state.owner === userId ? state.data.events : [], loading, busy, error, refresh, save, remove: (id: string) => commit(snapshot.current.events.filter(event => event.id !== id)) };
}
