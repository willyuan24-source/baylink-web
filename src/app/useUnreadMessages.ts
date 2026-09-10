import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from '../lib/api';
import type { UserData } from '../lib/types';

/** Opening the inbox is not reading a conversation. Only the server's read boundary clears it. */
export function useUnreadMessages(user: UserData | null, socket: Socket | null): number {
  const identity = user?.id && user.token ? `${user.id}:${user.token}` : '';
  const [result, setResult] = useState({ identity: '', count: 0 });

  useEffect(() => {
    if (!identity) return;
    const controller = new AbortController();
    let running = false;
    let queued = false;
    const refresh = async () => {
      if (controller.signal.aborted || document.visibilityState === 'hidden') return;
      if (running) { queued = true; return; }
      running = true;
      try {
        const rows: unknown = await api.request('/conversations', { signal: controller.signal });
        if (controller.signal.aborted || !Array.isArray(rows)) return;
        const counts = new Map<string, number>();
        for (const row of rows) {
          if (row && typeof row.id === 'string' && typeof row.unreadCount === 'number' && Number.isSafeInteger(row.unreadCount) && row.unreadCount >= 0) {
            counts.set(row.id, row.unreadCount);
          }
        }
        setResult({ identity, count: [...counts.values()].reduce((total, count) => total + count, 0) });
      } catch {
        // Keep the last confirmed count during a network interruption.
      } finally {
        running = false;
        if (queued && !controller.signal.aborted) { queued = false; void refresh(); }
      }
    };
    const onRefresh = () => { void refresh(); };
    onRefresh();
    const timer = window.setInterval(onRefresh, 30_000);
    document.addEventListener('visibilitychange', onRefresh);
    window.addEventListener('focus', onRefresh);
    window.addEventListener('online', onRefresh);
    window.addEventListener('baylink:messages-read', onRefresh);
    socket?.on('new_message', onRefresh);
    socket?.on('connect', onRefresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onRefresh);
      window.removeEventListener('focus', onRefresh);
      window.removeEventListener('online', onRefresh);
      window.removeEventListener('baylink:messages-read', onRefresh);
      socket?.off('new_message', onRefresh);
      socket?.off('connect', onRefresh);
    };
  }, [identity, socket]);

  return result.identity === identity ? result.count : 0;
}
