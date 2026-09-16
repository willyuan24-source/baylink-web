import type { Conversation } from './types';

/** A supplied title and destination form one context; never combine it with an older post. */
export function withConversationContext(conversation: Conversation, title?: string, postId?: string): Conversation {
  if (title === undefined && postId === undefined) return conversation;
  return { ...conversation, lastPostTitle: title, lastPostId: postId };
}
