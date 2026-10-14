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
  /**
   * H14 (api #44, additive; false when an older server leaves them out). `defaults`: what a verified email gets when the
   * member has never chosen. `defaultsActive`: that preset is switched on, so copy may promise it. `defaultsApplied`: it was
   * applied to this account once (it may have been turned off since). `customized`: the member saved settings or used an
   * unsubscribe link; the defaults never change their settings again.
   */
  defaults: Record<Channel, Record<Topic, boolean>>;
  defaultsActive: boolean;
  defaultsApplied: boolean;
  customized: boolean;
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
const switches = (value: unknown) => Object.fromEntries(channels.map(channel => [channel,
  Object.fromEntries(KNOWN_TOPICS.map(topic => [topic, record(record(value)[channel])[topic] === true])),
])) as NotificationSettings['preferences'];
export const normalize = (value: unknown): NotificationSettings => {
  const source = record(value);
  return {
    preferences: switches(source.preferences),
    topics: serverTopics(source.topics),
    emailVerified: source.emailVerified === true,
    phoneVerified: source.phoneVerified === true,
    deliveryEnabled: source.deliveryEnabled === true,
    emailDeliveryAvailable: source.emailDeliveryAvailable === true,
    smsDeliveryAvailable: source.smsDeliveryAvailable === true,
    defaults: switches(source.defaults),
    defaultsActive: source.defaultsActive === true,
    defaultsApplied: source.defaultsApplied === true,
    customized: source.customized === true,
  };
};
/** The email topics a verified address gets by default (新的私信, 新的联系请求 today), in the server's topic order. */
export const defaultEmailTopics = (settings: NotificationSettings): Topic[] => KNOWN_TOPICS.filter(topic => settings.defaults.email[topic]);
/** Any reminder on, on any channel: the API's own test for an account that already made a choice (`anyPreferenceOn`). */
export const anyReminderOn = (settings: NotificationSettings) => channels.some(channel => KNOWN_TOPICS.some(topic => settings.preferences[channel][topic]));
/**
 * Which sentence about defaults is true for this account (H14), following the API's settleDefaults rules:
 * 'applied' — the defaults were turned on for this account and the member has not chosen since (true even after the owner's
 * kill switch NOTIFICATION_EMAIL_DEFAULTS=off, which leaves those accounts as they are); 'off' — the preset is off and this
 * account never got it, so nothing is on unless chosen; 'pending' — the preset is on and verifying this email will turn
 * the defaults on (an untouched, unverified account: never customized and no reminder on anywhere); 'chosen' — the preset
 * is on but this account follows its own choice (saved settings, an unsubscribe link, or a reminder it already had on).
 */
export type DefaultsState = 'off' | 'pending' | 'applied' | 'chosen';
export const defaultsState = (settings: NotificationSettings): DefaultsState => {
  if (!defaultEmailTopics(settings).length) return 'off';
  if (settings.defaultsApplied && !settings.customized) return 'applied';
  if (!settings.defaultsActive) return 'off';
  return settings.customized || settings.emailVerified || anyReminderOn(settings) ? 'chosen' : 'pending';
};
/** The page language for the API's optional `locale` (verification email and reminder language, api #44). */
export const verificationBody = (locale: string) => JSON.stringify({ locale: locale === 'en' || locale === 'zh-Hant' ? locale : 'zh-Hans' });
export const verifiedChannels = (settings: NotificationSettings) => channels.filter(channel => channel === 'email' ? settings.emailVerified : settings.phoneVerified);
/** True when every topic on every verified channel is on: the one-tap "enable all" has nothing left to do. */
export const allRemindersOn = (settings: NotificationSettings) => verifiedChannels(settings).length > 0
  && verifiedChannels(settings).every(channel => settings.topics.every(topic => settings.preferences[channel][topic]));
/** The PATCH body: only the topics the server reported, so an older API never sees an unknown topic. */
export const preferencePayload = (settings: NotificationSettings) => Object.fromEntries(channels.map(channel => [channel,
  Object.fromEntries(settings.topics.map(topic => [topic, settings.preferences[channel][topic]]))]));

/**
 * Messages page: this account's settings, read once; null while unknown or unavailable (never nag on an error). The page
 * passes them to its reminder offer, so /messages reads the preferences once.
 */
export function useReminderSettings(userId: string | undefined): NotificationSettings | null {
  const [state, setState] = useState<{ owner?: string; settings: NotificationSettings | null }>({ settings: null });
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    api.request('/notifications/preferences', { signal: controller.signal }).then(value => {
      if (controller.signal.aborted || getStoredUser()?.id !== userId) return;
      setState({ owner: userId, settings: normalize(value) });
    }).catch(() => { /* Unknown: no prompt. */ });
    return () => controller.abort();
  }, [userId]);
  return state.owner === userId ? state.settings : null;
}
