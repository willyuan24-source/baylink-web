// The signed-in reader (WEB-SHELL2, split out of AppLayout): the stored session, the message socket, the unread and
// pending-contact counts behind the 我的 / 消息 badges, the block list, and the three ways a session ends locally (sign-out
// in this tab, another tab, the server's "session expired"). The layout reacts through the callbacks.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api, SOCKET_URL } from '../lib/api';
import { getStoredUser, removeStoredUser, SESSION_KEY } from '../lib/session';
import { clearFeedCache } from '../lib/feedCache';
import { clearMessageDrafts } from '../features/messages/messageState';
import type { UserData } from '../lib/types';
import { useUnreadMessages } from './useUnreadMessages';
import { usePendingContacts } from './usePendingContacts';

export type SessionEvents = {
  /** A private message arrived over the socket. `threadId` is a safe conversation id, or null. */
  onNewMessage: (threadId: string | null) => void;
  /** The local session was cleared: drop everything that belonged to the previous reader. */
  onCleared: () => void;
  /** The server said the session expired (after the local session was cleared). */
  onExpired: () => void;
  /** The reader's block list loaded. */
  onBlocksLoaded: (ids: string[]) => void;
};

const THREAD_ID = /^[A-Za-z0-9_-]{1,200}$/;

export function useSession(events: SessionEvents) {
  const eventsRef = useRef(events);
  useEffect(() => { eventsRef.current = events; });
  const [user, setUser] = useState<UserData | null>(getStoredUser);
  const [socket, setSocket] = useState<Socket | null>(null);
  const unreadMessageCount = useUnreadMessages(user, socket);
  const [contactRequestRefreshKey, setContactRequestRefreshKey] = useState(0);
  const [pendingContactRequestCount, setPendingContactRequestCount] = usePendingContacts(user, contactRequestRefreshKey);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const sessionExpiredHandledRef = useRef(false);

  // The socket handshake carries the JWT; the server only lets a reader join their own room. socket.io-client loads on
  // demand, so a guest's first page never carries it.
  useEffect(() => {
    if (!user?.token) {
      setSocket((previous) => { previous?.disconnect(); return null; });
      return;
    }
    let cancelled = false;
    let created: Socket | null = null;
    (async () => {
      const { io } = await import('socket.io-client');
      if (cancelled) return;
      const newSocket = io(SOCKET_URL, { auth: { token: user.token } });
      created = newSocket;
      newSocket.on('connect', () => { newSocket.emit('join_room'); });
      newSocket.on('connect_error', () => { /* An authentication failure must not break the page. */ });
      newSocket.on('new_message', (message?: { conversationId?: unknown }) => {
        window.dispatchEvent(new Event('baylink:messages-changed'));
        const threadId = typeof message?.conversationId === 'string' && THREAD_ID.test(message.conversationId) ? message.conversationId : null;
        eventsRef.current.onNewMessage(threadId);
      });
      setSocket(newSocket);
    })();
    return () => { cancelled = true; created?.disconnect(); };
  }, [user?.id, user?.token]);

  useEffect(() => {
    if (!user) {
      // Keep the same empty list: a new [] would re-create the feed query and fetch the feed twice for a guest.
      setBlockedUserIds(previous => previous.length ? [] : previous);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getMyBlocks();
        if (cancelled) return;
        const ids: string[] = (res.blocks || []).map((b: { id: string }) => b.id).filter(Boolean);
        setBlockedUserIds(ids);
        eventsRef.current.onBlocksLoaded(ids);
      } catch { /* The page works without the block list. */ }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const clearLocalSession = useCallback(() => {
    clearFeedCache();
    setUser(null);
    setSocket((previous) => { previous?.disconnect(); return null; });
    setBlockedUserIds(previous => previous.length ? [] : previous);
    eventsRef.current.onCleared();
  }, []);

  // Another tab signed in or out.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_KEY && event.key !== null) return;
      clearLocalSession();
      setUser(getStoredUser());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [clearLocalSession]);

  useEffect(() => {
    const onSessionExpired = () => {
      if (!localStorage.getItem(SESSION_KEY)) return;
      if (sessionExpiredHandledRef.current) return;
      sessionExpiredHandledRef.current = true;
      const expiringUser = getStoredUser();
      if (expiringUser) clearMessageDrafts(expiringUser.id);
      removeStoredUser();
      clearLocalSession();
      eventsRef.current.onExpired();
      window.setTimeout(() => { sessionExpiredHandledRef.current = false; }, 3000);
    };
    window.addEventListener('session-expired', onSessionExpired);
    return () => window.removeEventListener('session-expired', onSessionExpired);
  }, [clearLocalSession]);

  /** Signs this browser out: drafts, stored session and local state. The caller navigates and tells the reader. */
  const endLocalSession = useCallback(() => {
    if (user) clearMessageDrafts(user.id);
    removeStoredUser();
    clearLocalSession();
  }, [user, clearLocalSession]);

  return {
    user, setUser, socket,
    /** Unread messages plus pending contact requests, capped at 99: the 我的 / 消息 badges (G1). */
    messagesBadgeCount: Math.min(unreadMessageCount + pendingContactRequestCount, 99),
    blockedUserIds, setBlockedUserIds,
    contactRequestRefreshKey, setContactRequestRefreshKey, setPendingContactRequestCount,
    clearLocalSession, endLocalSession,
  };
}
