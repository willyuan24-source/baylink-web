import { API_BASE_URL } from '../../lib/api';
import { getLocale } from '../../i18n/locale';
import { getReadingSize, validReadingSize } from '../../lib/reading-preferences';
import { releaseLabel } from '../../lib/release';
import type { FeedbackEntity, FeedbackKind } from './open-feedback';

/** Reason codes per kind, exactly the API's lists (lib/feedback.js FEEDBACK_REASONS); the web owns the labels. */
export const FEEDBACK_REASONS = {
  page: ['find-events', 'get-help', 'ask-baybay', 'plan', 'other'],
  content: ['outdated', 'wrong-time', 'wrong-place', 'wrong-price', 'broken-link', 'closed', 'other'],
  baybay: ['wrong-answer', 'too-slow', 'not-answered', 'other'],
} as const satisfies Record<FeedbackKind, readonly string[]>;
export type FeedbackReason = (typeof FEEDBACK_REASONS)[FeedbackKind][number];
export const FEEDBACK_TEXT_MAX = 500;
export const FEEDBACK_CONTACT_MAX = 80;

/** The §3.0 Feedback contract body. Nothing else is ever sent: no URL, query, account, conversation or page text. */
export type FeedbackPayload = {
  kind: FeedbackKind; routeTemplate: string; reason: string; text: string; contact?: string; entity?: FeedbackEntity;
  locale: 'zh-Hans' | 'zh-Hant' | 'en'; readingSize: 'standard' | 'large' | 'extra-large'; release: string; website: string;
};
export type FeedbackFailure = 'invalid' | 'rate' | 'daily' | 'global' | 'unavailable';
export type FeedbackResult = { ok: true } | { ok: false; failure: FeedbackFailure };

const length = (value: string) => [...value].length;
/** The size the page is shown at: a family link's ?reading= applies before paint without being saved. */
const appliedReadingSize = () => typeof document !== 'undefined' && document.documentElement.dataset.reading
  ? validReadingSize(document.documentElement.dataset.reading) : getReadingSize();
export const isFeedbackReason = (kind: FeedbackKind, reason: string | undefined): reason is FeedbackReason => !!reason && (FEEDBACK_REASONS[kind] as readonly string[]).includes(reason);

export function buildFeedbackPayload(input: { kind: FeedbackKind; routeTemplate: string; reason: string; text?: string; contact?: string; entity?: FeedbackEntity; website?: string }): FeedbackPayload {
  const text = (input.text || '').trim(), contact = (input.contact || '').trim();
  return {
    kind: input.kind, routeTemplate: input.routeTemplate, reason: input.reason,
    text: [...text].slice(0, FEEDBACK_TEXT_MAX).join(''),
    ...(contact ? { contact: [...contact].slice(0, FEEDBACK_CONTACT_MAX).join('') } : {}),
    ...(input.entity ? { entity: { kind: input.entity.kind, id: input.entity.id } } : {}),
    locale: getLocale(), readingSize: appliedReadingSize(), release: releaseLabel(),
    // The honeypot: a person never sees or fills it, so its value is whatever a bot typed (normally '').
    website: input.website || '',
  };
}

const FAILURES: Record<string, FeedbackFailure> = {
  FEEDBACK_INVALID: 'invalid', FEEDBACK_RATE_LIMIT: 'rate', FEEDBACK_DAILY_LIMIT: 'daily', FEEDBACK_GLOBAL_LIMIT: 'global', FEEDBACK_UNAVAILABLE: 'unavailable',
};

/** POST /api/feedback → 202. Never throws; every failure keeps the reader's text in the sheet. */
export async function submitFeedback(payload: FeedbackPayload, fetcher: typeof fetch = fetch): Promise<FeedbackResult> {
  if (length(payload.text) > FEEDBACK_TEXT_MAX || length(payload.contact || '') > FEEDBACK_CONTACT_MAX) return { ok: false, failure: 'invalid' };
  try {
    const response = await fetcher(`${API_BASE_URL}/feedback`, {
      method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (response.status === 202 || response.ok) return { ok: true };
    const body = await response.json().catch(() => ({})) as { code?: string };
    const failure = (body.code && FAILURES[body.code]) || (response.status === 429 ? 'rate' : response.status === 400 ? 'invalid' : 'unavailable');
    return { ok: false, failure };
  } catch {
    return { ok: false, failure: 'unavailable' };
  }
}
