import type { Message } from '../../lib/types';

export type DisplayMessage = Message & { delivery?: 'sending' | 'failed' };

/** Match server identities only: two legitimate messages may have identical text. */
export const mergeMessages = (
  current: DisplayMessage[], incoming: DisplayMessage[], replaceId?: string,
): DisplayMessage[] => {
  const messages = new Map<string, DisplayMessage>();
  for (const message of current) {
    if (message.id !== replaceId) messages.set(message.id, message);
  }
  for (const message of incoming) messages.set(message.id, message);
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
    createdAt: Number(message.createdAt) || Date.now(),
    messageType: message.messageType, contactCard: message.contactCard,
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
