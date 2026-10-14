import { useEffect, useRef } from 'react';
import type { PostData, UserData } from '../lib/types';
import { setLoginIntent } from '../features/auth/login-intent';

export type ContactIntent = { targetId: string; nickname?: string; postTitle?: string; postId?: string };
export type ContactPost = Pick<PostData, 'id' | 'authorId' | 'title' | 'status'> & { author?: { nickname?: string } };

/** An explicit contact click resumes navigation after login; it never sends a message. */
export function useContactIntent({ user, onLoginNeeded, onOpen }: {
  user: UserData | null;
  onLoginNeeded: () => void;
  onOpen: (intent: ContactIntent, authenticatedUser: UserData) => void | Promise<void>;
}) {
  const pending = useRef<ContactIntent | null>(null);
  useEffect(() => { pending.current = null; setLoginIntent(null); }, [user?.id]);
  const openChat = (targetId: string, nickname?: string, postTitle?: string, postId?: string) => {
    if (!targetId || targetId === user?.id) return;
    const intent = { targetId, nickname, postTitle, postId };
    // H76: the sign-in sheet says this scene (私信 + the poster's name) and leads with 注册.
    if (!user) { pending.current = intent; setLoginIntent({ kind: 'message', name: nickname }); onLoginNeeded(); }
    else { pending.current = null; return onOpen(intent, user); }
  };
  return {
    openChat,
    requestPostContact: (post: ContactPost) => {
      if (post.status !== 'closed') openChat(post.authorId, post.author?.nickname, post.title, post.id);
    },
    completeContactLogin: (authenticatedUser: UserData) => {
      const intent = pending.current;
      pending.current = null; setLoginIntent(null);
      if (intent && intent.targetId !== authenticatedUser.id) onOpen(intent, authenticatedUser);
    },
    cancelPendingContact: () => { pending.current = null; setLoginIntent(null); },
  };
}
