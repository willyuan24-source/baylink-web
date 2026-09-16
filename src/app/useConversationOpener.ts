import { useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { getStoredUser } from '../lib/session';
import type { Conversation, UserData } from '../lib/types';
import type { ContactIntent } from './useContactIntent';

/** Opening a contact is a navigation intent: only the latest click on this route may finish it. */
export function useConversationOpener({ routeKey, onOpened, onError }: {
  routeKey: string;
  onOpened: (conversation: Conversation, intent: ContactIntent) => void;
  onError: (error: unknown) => void;
}) {
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => {
    active.current?.abort();
    active.current = null;
  }, [routeKey]);

  return async (intent: ContactIntent, user: UserData) => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const isCurrent = () => {
      const stored = getStoredUser();
      return active.current === controller && !controller.signal.aborted && stored?.id === user.id && stored?.token === user.token;
    };
    try {
      const result = await api.request('/conversations/open-or-create', {
        method: 'POST', body: JSON.stringify({ targetUserId: intent.targetId }), signal: controller.signal,
      });
      if (!isCurrent()) return;
      if (!result || typeof result.id !== 'string' || !result.id || (result.otherUser && result.otherUser.id !== intent.targetId)) {
        throw new Error('无法打开聊天');
      }
      onOpened({
        id: result.id,
        otherUser: result.otherUser || { id: intent.targetId, nickname: intent.nickname || 'User' },
        lastMessage: '', updatedAt: result.updatedAt || Date.now(),
        lastPostTitle: intent.postTitle, lastPostId: intent.postId,
      }, intent);
    } catch (error) {
      if (isCurrent()) onError(error);
    } finally {
      if (active.current === controller) active.current = null;
    }
  };
}
