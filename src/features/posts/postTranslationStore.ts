import { api, getStoredUser } from '../../lib/api';
import type { PostData } from '../../lib/types';

export type PostTranslationText = Pick<PostData, 'title' | 'description' | 'budget' | 'timeInfo'>;
export type PostTranslationResult = { status: 'translated'; text: PostTranslationText } | { status: 'unavailable' };
const fields = ['title', 'description', 'budget', 'timeInfo'] as const;
const MAX_ENTRIES = 128;
const MAX_CONCURRENT = 3;
const FAILURE_BACKOFF = 30_000;
const SUCCESS_TTL = 5 * 60_000;
const unavailable: PostTranslationResult = { status: 'unavailable' };

export const postTranslationText = (post: PostTranslationText): PostTranslationText => ({
  title: post.title, description: post.description, budget: post.budget, timeInfo: post.timeInfo,
});
export const postTranslationSession = (): string => {
  const user = getStoredUser();
  // This key is only used in memory. A new login must not reuse another session's
  // visibility decision, even when it belongs to the same account.
  return JSON.stringify([user?.id || '', user?.token || '']);
};
export const postTranslationKey = (id: string, source: PostTranslationText, session: string) =>
  JSON.stringify([session, id, ...fields.map(field => source[field])]);

type Entry = {
  promise: Promise<PostTranslationResult>;
  settled: boolean;
  translated: boolean;
  expires: number;
};
const cache = new Map<string, Entry>();
const queue: Array<() => void> = [];
let active = 0;
let cacheSession: string | undefined;

const pump = () => {
  while (active < MAX_CONCURRENT && queue.length) queue.shift()!();
};

const validatedTranslation = (value: unknown, source: PostTranslationText): PostTranslationText | null => {
  if (!value || typeof value !== 'object') return null;
  const result = value as Record<string, unknown>;
  if (result.ok !== true || result.target !== 'en' || !result.source || typeof result.source !== 'object'
    || !result.translation || typeof result.translation !== 'object') return null;
  const original = result.source as Record<string, unknown>;
  const translated = result.translation as Record<string, unknown>;
  if (!fields.every(field => original[field] === source[field] && typeof translated[field] === 'string')) return null;
  // Copy only plain strings from the response. Extra response properties never
  // become post data, markup, author information or contact information.
  return Object.fromEntries(fields.map(field => [field, translated[field]])) as PostTranslationText;
};

/** Shared, bounded, memory-only single flight for cards and the reading modal. */
export function requestPostTranslation(id: string, source: PostTranslationText, session: string, retry = false): Promise<PostTranslationResult> {
  if (session !== postTranslationSession()) return Promise.resolve(unavailable);
  if (cacheSession !== session) {
    cache.clear();
    cacheSession = session;
  }
  const key = postTranslationKey(id, source, session);
  const now = Date.now();
  const existing = cache.get(key);
  if (existing && (!existing.settled || (existing.expires > now && (!retry || existing.translated)))) {
    cache.delete(key);
    cache.set(key, existing);
    return existing.promise;
  }
  cache.delete(key);
  for (const [oldKey, entry] of cache) {
    if (entry.settled && (entry.expires <= now || cache.size >= MAX_ENTRIES)) cache.delete(oldKey);
  }
  // A very long visible list cannot create an unbounded queue. Entries that have
  // not started remain counted, and a later explicit retry can obtain a slot.
  if (cache.size >= MAX_ENTRIES || queue.length >= MAX_ENTRIES) return Promise.resolve(unavailable);

  let resolve!: (result: PostTranslationResult) => void;
  const entry: Entry = {
    promise: new Promise<PostTranslationResult>(done => { resolve = done; }), settled: false, translated: false, expires: Infinity,
  };
  cache.set(key, entry);
  queue.push(() => {
    active++;
    void (async () => {
      let result: PostTranslationResult = unavailable;
      try {
        if (postTranslationSession() === session) {
          const response: unknown = await api.request(`/posts/${encodeURIComponent(id)}/translation`, {
            method: 'POST', body: JSON.stringify({ target: 'en' }),
          });
          const text = validatedTranslation(response, source);
          if (text && postTranslationSession() === session) result = { status: 'translated', text };
        }
      } catch { /* The original post remains readable on missing, limited or unavailable service. */ }
      finally {
        entry.settled = true;
        entry.translated = result.status === 'translated';
        entry.expires = Date.now() + (result.status === 'translated' ? SUCCESS_TTL : FAILURE_BACKOFF);
        resolve(result);
        active--;
        pump();
      }
    })();
  });
  pump();
  return entry.promise;
}
