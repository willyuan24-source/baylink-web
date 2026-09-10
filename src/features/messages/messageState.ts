import type { Message } from '../../lib/types';

export type DisplayMessage = Message & { delivery?: 'sending' | 'failed' };
export const MESSAGE_REACTIONS = ['👍', '❤️', '😂', '🎉', '🙏', '👀'] as const;
export type MessageReaction = typeof MESSAGE_REACTIONS[number];
export const isReplyable = (message: DisplayMessage) => message.type === 'text' && message.messageType !== 'contact_card' && !message.delivery && !message.id.startsWith('local:');

/** Match server identities only: two legitimate messages may have identical text. */
export const mergeMessages = (
  current: DisplayMessage[], incoming: DisplayMessage[], replaceId?: string,
): DisplayMessage[] => {
  const messages = new Map<string, DisplayMessage>();
  for (const message of current) {
    if (message.id !== replaceId) messages.set(message.id, message);
  }
  for (const message of incoming) {
    const previous = messages.get(message.id);
    messages.set(message.id, previous && (previous.reactionVersion || 0) > (message.reactionVersion || 0)
      ? { ...message, reactions: previous.reactions, reactionVersion: previous.reactionVersion }
      : message);
  }
  return [...messages.values()].sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
};

export const readServerMessage = (value: unknown): Message | null => {
  if (!value || typeof value !== 'object') return null;
  const envelope = value as Record<string, unknown>;
  const candidate = envelope.message && typeof envelope.message === 'object' ? envelope.message : value;
  const message = candidate as Partial<Message>;
  if (typeof message.id !== 'string' || !message.id || typeof message.senderId !== 'string') return null;
  if (!['text', 'contact-request', 'contact-share', 'contact_card'].includes(message.type || '')) return null;
  return {
    id: message.id, senderId: message.senderId, conversationId: message.conversationId,
    type: message.type!, content: typeof message.content === 'string' ? message.content : '',
    createdAt: Number.isFinite(Number(message.createdAt)) && Number(message.createdAt) > 0 ? Number(message.createdAt) : Date.now(),
    messageType: message.messageType, contactCard: message.contactCard,
    ...(message.type === 'text' && message.messageType !== 'contact_card' && message.replyTo && typeof message.replyTo.id === 'string' && typeof message.replyTo.senderId === 'string' && typeof message.replyTo.content === 'string'
      ? { replyTo: { id: message.replyTo.id, senderId: message.replyTo.senderId, content: message.replyTo.content.slice(0, 2000) } } : {}),
    ...(Array.isArray(message.reactions) ? { reactions: message.reactions.filter(reaction => MESSAGE_REACTIONS.includes(reaction?.emoji as MessageReaction) && Array.isArray(reaction.userIds)).map(reaction => ({ emoji: reaction.emoji, userIds: [...new Set(reaction.userIds.filter(id => typeof id === 'string' && id))] })) } : {}),
    ...(typeof message.reactionVersion === 'number' && Number.isSafeInteger(message.reactionVersion) && message.reactionVersion >= 0 ? { reactionVersion: message.reactionVersion } : {}),
  };
};

export const messageText = (message: DisplayMessage) => {
  if (message.content) return message.content;
  if (message.type === 'contact-share') {
    return message.delivery === 'sending' ? '正在分享联系方式…' : message.delivery === 'failed' ? '联系方式未确认发送' : '已分享联系方式';
  }
  if (message.type === 'contact_card' || message.messageType === 'contact_card') return '联系方式卡片暂不可用';
  if (message.type === 'contact-request') return '请求交换联系方式';
  return '消息内容暂不可用';
};

export const restoreFailedDraft = (current: string, submitted: string, unchangedSinceSend: boolean) =>
  unchangedSinceSend ? submitted : current;

export const messageDraftKey = (userId: string, conversationId: string) => `baylink.message-draft.v1:${encodeURIComponent(userId)}:${encodeURIComponent(conversationId)}`;
export const messagePinsKey = (userId: string) => `baylink.message-pins.v1:${encodeURIComponent(userId)}`;
export const pendingMessagesKey = (userId: string, conversationId: string) => `baylink.message-pending.v1:${encodeURIComponent(userId)}:${encodeURIComponent(conversationId)}`;
export type PendingMessageDraft = { id: string; content: string; createdAt: number };
const pendingMemory = new Map<string, PendingMessageDraft[]>();

/** Private drafts live only in this browser tab's session, never in shared account data. */
export function readMessageDraft(userId: string, conversationId: string): string {
  try { return sessionStorage.getItem(messageDraftKey(userId, conversationId))?.slice(0, 2000) || ''; } catch { return ''; }
}
export function saveMessageDraft(userId: string, conversationId: string, text: string): boolean {
  try {
    const key = messageDraftKey(userId, conversationId);
    if (text) sessionStorage.setItem(key, text.slice(0, 2000)); else sessionStorage.removeItem(key);
    return true;
  } catch { return false; }
}
export function readPendingMessages(userId: string, conversationId: string): PendingMessageDraft[] {
  const key = pendingMessagesKey(userId, conversationId);
  const cached = pendingMemory.get(key);
  if (cached) return cached;
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is PendingMessageDraft => !!item && typeof item.id === 'string' && typeof item.content === 'string' && Number.isFinite(item.createdAt)).map(item => ({ id: item.id, content: item.content.slice(0, 2000), createdAt: item.createdAt })) : [];
  } catch { return []; }
}
export function savePendingMessage(userId: string, conversationId: string, draft: PendingMessageDraft): boolean {
  const key = pendingMessagesKey(userId, conversationId);
  const items = [...readPendingMessages(userId, conversationId).filter(item => item.id !== draft.id), draft];
  pendingMemory.set(key, items);
  try {
    sessionStorage.setItem(key, JSON.stringify(items));
    return true;
  } catch { return false; }
}
export function removePendingMessage(userId: string, conversationId: string, id: string): boolean {
  const remaining = readPendingMessages(userId, conversationId).filter(item => item.id !== id);
  const key = pendingMessagesKey(userId, conversationId);
  pendingMemory.set(key, remaining);
  try {
    if (remaining.length) sessionStorage.setItem(key, JSON.stringify(remaining)); else sessionStorage.removeItem(key);
    return true;
  } catch { return false; }
  finally { window.dispatchEvent(new Event('baylink:message-draft-updated')); }
}
/** Signing out clears this account's private session text; optional omission clears all accounts. */
export function clearMessageDrafts(userId?: string): void {
  for (const key of pendingMemory.keys()) if (!userId || key.startsWith(`baylink.message-pending.v1:${encodeURIComponent(userId)}:`)) pendingMemory.delete(key);
  try {
    const prefixes = ['baylink.message-draft.v1:', 'baylink.message-pending.v1:'].map(prefix => userId ? `${prefix}${encodeURIComponent(userId)}:` : prefix);
    const keys = Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index)).filter((key): key is string => !!key && prefixes.some(prefix => key.startsWith(prefix)));
    keys.forEach(key => sessionStorage.removeItem(key));
  } catch { /* Session storage may already be unavailable or cleared. */ }
}
export function readMessagePins(userId: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(messagePinsKey(userId)) || '[]');
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === 'string' && !!id && id.length <= 200))].slice(0, 20) : [];
  } catch { return []; }
}
export function saveMessagePins(userId: string, ids: string[]): boolean {
  try { localStorage.setItem(messagePinsKey(userId), JSON.stringify([...new Set(ids)].slice(0, 20))); return true; } catch { return false; }
}
export const isNearMessageBottom = (element: Pick<HTMLElement, 'scrollHeight' | 'scrollTop' | 'clientHeight'> | null) => !!element && element.scrollHeight - element.scrollTop - element.clientHeight <= 64;
export function messageReadBatches(messages: DisplayMessage[], alreadyRead: ReadonlySet<string>): string[][] {
  const ids = [...new Set(messages.filter(message => !message.delivery && !message.id.startsWith('local:') && !alreadyRead.has(message.id)).map(message => message.id))];
  return Array.from({ length: Math.ceil(ids.length / 500) }, (_, index) => ids.slice(index * 500, index * 500 + 500));
}
