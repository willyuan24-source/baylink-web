import { useCallback, useLayoutEffect, useRef } from 'react';
import type { UserData } from '../../lib/types';

/** A completed request belongs to the editor and login that started it. */
export function useProfileSessionGuard(user: Pick<UserData, 'id' | 'token'> | null) {
  const mounted = useRef(true);
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return useCallback(() => {
    if (!mounted.current || !user) return false;
    let raw: string | null;
    try { raw = localStorage.getItem('currentUser'); }
    catch { return true; } // Restricted storage still permits updates to the mounted React session.
    if (!raw) return !user.token;
    try {
      const current = JSON.parse(raw);
      return current?.id === user.id && current?.token === user.token;
    } catch { return false; }
  }, [user]);
}
