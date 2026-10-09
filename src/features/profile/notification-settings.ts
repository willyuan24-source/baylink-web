import { useEffect, useState } from 'react';
import { api, getStoredUser } from '../../lib/api';

export type Topic = 'message' | 'contact_request' | 'outing_request' | 'comment';
export type Channel = 'email' | 'sms';
export type NotificationSettings = {
  preferences: Record<Channel, Record<Topic, boolean>>;
  /** The topics this server accepts. Servers before API-NOTIFY-SEC do not report it and know the first three only. */
  topics: Topic[];
  emailVerified: boolean;
  phoneVerified: boolean;
  deliveryEnabled: boolean;
  emailDeliveryAvailable: boolean;
  smsDeliveryAvailable: boolean;
};
export const DEFAULT_TOPICS: Topic[] = ['message', 'contact_request', 'outing_request'];
export const KNOWN_TOPICS: Topic[] = [...DEFAULT_TOPICS, 'comment'];
export const channels: Channel[] = ['email', 'sms'];
export const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const serverTopics = (value: unknown): Topic[] => {
  if (!Array.isArray(value)) return DEFAULT_TOPICS;
  const topics = KNOWN_TOPICS.filter(topic => value.includes(topic));
  return topics.length ? topics : DEFAULT_TOPICS;
};
export const normalize = (value: unknown): NotificationSettings => {
  const source = record(value), preferences = record(source.preferences);
  return {
    preferences: Object.fromEntries(channels.map(channel => [channel,
      Object.fromEntries(KNOWN_TOPICS.map(topic => [topic, record(preferences[channel])[topic] === true])),
    ])) as NotificationSettings['preferences'],
    topics: serverTopics(source.topics),
    emailVerified: source.emailVerified === true,
    phoneVerified: source.phoneVerified === true,
    deliveryEnabled: source.deliveryEnabled === true,
    emailDeliveryAvailable: source.emailDeliveryAvailable === true,
    smsDeliveryAvailable: source.smsDeliveryAvailable === true,
  };
};
export const verifiedChannels = (settings: NotificationSettings) => channels.filter(channel => channel === 'email' ? settings.emailVerified : settings.phoneVerified);
/** True when every topic on every verified channel is on: the one-tap "enable all" has nothing left to do. */
export const allRemindersOn = (settings: NotificationSettings) => verifiedChannels(settings).length > 0
  && verifiedChannels(settings).every(channel => settings.topics.every(topic => settings.preferences[channel][topic]));
/** The PATCH body: only the topics the server reported, so an older API never sees an unknown topic. */
export const preferencePayload = (settings: NotificationSettings) => Object.fromEntries(channels.map(channel => [channel,
  Object.fromEntries(settings.topics.map(topic => [topic, settings.preferences[channel][topic]]))]));

/** Messages page prompt: null while unknown or unavailable (never nag on an error), false when every reminder is off. */
export function useAnyReminderOn(userId: string | undefined): boolean | null {
  const [state, setState] = useState<{ owner?: string; on: boolean | null }>({ on: null });
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    api.request('/notifications/preferences', { signal: controller.signal }).then(value => {
      if (controller.signal.aborted || getStoredUser()?.id !== userId) return;
      const settings = normalize(value);
      setState({ owner: userId, on: channels.some(channel => settings.topics.some(topic => settings.preferences[channel][topic])) });
    }).catch(() => { /* Unknown: no prompt. */ });
    return () => controller.abort();
  }, [userId]);
  return state.owner === userId ? state.on : null;
}
