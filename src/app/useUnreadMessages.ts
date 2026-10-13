import { useEffect, useMemo } from 'react';
import type { Socket } from 'socket.io-client';
import type { UserData } from '../lib/types';
import { conversationIdentity, refreshConversations, useConversationFeed } from './conversation-feed';

/**
 * Opening the inbox is not reading a conversation. Only the server's read boundary clears it. The list comes from the
 * one shared /conversations poll (conversation-feed.ts, G91), every 30 s here; a new message or a reconnect refreshes it.
 * During a network interruption the last confirmed count stays.
 */
export function useUnreadMessages(user: UserData | null, socket: Socket | null): number {
  const identity = conversationIdentity(user);
  const feed = useConversationFeed(identity, 30_000);
  useEffect(() => {
    if (!identity || !socket) return;
    socket.on('new_message', refreshConversations);
    socket.on('connect', refreshConversations);
    return () => { socket.off('new_message', refreshConversations); socket.off('connect', refreshConversations); };
  }, [identity, socket]);
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of feed.rows || []) {
      const item = row as { id?: unknown; unreadCount?: unknown } | null;
      if (item && typeof item.id === 'string' && typeof item.unreadCount === 'number' && Number.isSafeInteger(item.unreadCount) && item.unreadCount >= 0) counts.set(item.id, item.unreadCount);
    }
    return [...counts.values()].reduce((total, count) => total + count, 0);
  }, [feed.rows]);
}
