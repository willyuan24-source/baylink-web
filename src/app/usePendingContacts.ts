import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { UserData } from '../lib/types';

/** Counts belong to an authenticated session, including callbacks from an old inbox. */
export function usePendingContacts(user: UserData | null, refreshKey: number) {
  const identity = user?.id && user.token ? `${user.id}:${user.token}` : '';
  const currentIdentity = useRef(identity);
  useLayoutEffect(() => {
    currentIdentity.current = identity;
    return () => { currentIdentity.current = ''; };
  }, [identity]);
  const revision = useRef(0);
  const [result, setResult] = useState({ identity: '', count: 0 });
  const setCount = useCallback((count: number) => {
    if (identity === currentIdentity.current && Number.isSafeInteger(count) && count >= 0) {
      revision.current += 1;
      setResult({ identity, count });
    }
  }, [identity]);

  useEffect(() => {
    if (!identity) return;
    const controller = new AbortController();
    let running = false;
    let queued = false;
    const refresh = async () => {
      if (controller.signal.aborted || document.visibilityState === 'hidden') return;
      if (running) { queued = true; return; }
      running = true;
      const startedAtRevision = revision.current;
      try {
        const response = await api.request('/contact-requests?role=owner&status=pending', { signal: controller.signal });
        if (!controller.signal.aborted && startedAtRevision === revision.current && Array.isArray(response?.requests)) {
          setResult({ identity, count: response.requests.length });
        }
      } catch {
        // A temporary connection failure is not confirmation that requests disappeared.
      } finally {
        running = false;
        if (queued && !controller.signal.aborted) { queued = false; void refresh(); }
      }
    };
    const onRefresh = () => { void refresh(); };
    onRefresh();
    const timer = window.setInterval(onRefresh, 30_000);
    window.addEventListener('focus', onRefresh);
    window.addEventListener('online', onRefresh);
    document.addEventListener('visibilitychange', onRefresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', onRefresh);
      window.removeEventListener('online', onRefresh);
      document.removeEventListener('visibilitychange', onRefresh);
    };
  }, [identity, refreshKey, setCount]);

  return [result.identity === identity ? result.count : 0, setCount] as const;
}
