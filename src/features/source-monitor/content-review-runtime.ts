import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { contentReviewToday, parseFreshnessRows, type FreshnessSourceRow } from '../../lib/content-review';
import type { Locale } from '../../i18n/locale';

/** Source rows for one content id, and when they arrived. `rows: null` = unknown or unreachable. */
export type SourceFreshnessAnswer = { rows: FreshnessSourceRow[] | null; receivedAt: number };
const UNKNOWN: SourceFreshnessAnswer = { rows: null, receivedAt: 0 };

/* A detail page mounts several readers of one answer (notice, soft line, trust row) and a list
 * page mounts one per card, so ids requested in the same tick share one GET of at most 100 ids.
 * Answers live for two minutes, matching the endpoint's Cache-Control. A failed or malformed
 * answer reads as OK everywhere and is not kept. */
const TTL_MS = 120_000, BATCH = 100;
const answers = new Map<string, { at: number; answer: SourceFreshnessAnswer; promise: Promise<SourceFreshnessAnswer> }>();
let waiting = new Map<string, (rows: FreshnessSourceRow[] | null) => void>();

function flush() {
  const batch = waiting; waiting = new Map();
  const ids = [...batch.keys()];
  for (let start = 0; start < ids.length; start += BATCH) {
    const chunk = ids.slice(start, start + BATCH);
    void api.request(`/sources/freshness?ids=${chunk.map(encodeURIComponent).join(',')}`).then(parseFreshnessRows, () => null).then(rows => {
      for (const id of chunk) {
        const own = rows && (chunk.length === 1 ? rows : rows.filter(row => row.sourceId === id || row.contentIds?.includes(id)));
        if (!own) answers.delete(id);
        batch.get(id)!(own);
      }
    });
  }
}

const cachedAnswer = (id: string) => { const entry = answers.get(id); return entry && Date.now() - entry.at < TTL_MS ? entry : undefined; };

function requestFreshness(id: string): Promise<SourceFreshnessAnswer> {
  const cached = cachedAnswer(id);
  if (cached) return cached.promise;
  const entry = { at: Date.now(), answer: UNKNOWN, promise: Promise.resolve(UNKNOWN) };
  entry.promise = new Promise(resolve => {
    if (!waiting.size) queueMicrotask(flush);
    waiting.set(id, rows => { entry.answer = { rows, receivedAt: Date.now() }; resolve(entry.answer); });
  });
  answers.set(id, entry);
  return entry.promise;
}

/** Test seam: forget cached answers between scenarios. */
export function resetSourceFreshnessCache() { answers.clear(); waiting = new Map(); }

/** Live source state for one content id; pass `null` to skip the request (guides). */
export function useSourceFreshness(contentId: string | null | undefined): SourceFreshnessAnswer {
  const [answer, setAnswer] = useState<SourceFreshnessAnswer>(() => (contentId && cachedAnswer(contentId)?.answer) || UNKNOWN);
  useEffect(() => {
    setAnswer((contentId && cachedAnswer(contentId)?.answer) || UNKNOWN);
    if (!contentId) return;
    let active = true;
    void requestFreshness(contentId).then(value => { if (active) setAnswer(value); });
    return () => { active = false; };
  }, [contentId]);
  return answer;
}

/** Pacific calendar day like the editorial dates; the year only when it is not this year. */
export function readerDate(value: string | number, locale: Locale, today: string): string {
  const day = typeof value === 'number' ? contentReviewToday(new Date(value)) : value;
  const [year, month, date] = day.split('-').map(Number);
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  if (locale === 'en') return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC' }).format(Date.UTC(year, month - 1, date, 12));
  return sameYear ? `${month}/${date}` : `${year}/${month}/${date}`;
}

export const pageNames = {
  event: { zh: '主办方页面', en: 'The organizer’s page' },
  offer: { zh: '官方页面', en: 'The official page' },
  opening: { zh: '商家页面', en: 'The business’s page' },
  guide: { zh: '官方页面', en: 'The official page' },
  bulletin: { zh: '官方页面', en: 'The official page' },
} as const;

/** Recalculate at midnight without fetching the full editorial inventory on a reader page. */
export function useContentReviewToday(supplied?: string): string {
  const [day, setDay] = useState(contentReviewToday);
  useEffect(() => {
    if (supplied) return;
    const timer = window.setInterval(() => setDay(contentReviewToday()), 60_000);
    return () => window.clearInterval(timer);
  }, [supplied]);
  return supplied || day;
}

const MAX_BYTES = 2 * 1024 * 1024;
/** Same-origin read only. No queue row initiates a source fetch or changes a reviewed date. */
export async function readEditorialReviewManifest(signal: AbortSignal): Promise<unknown> {
  const response = await fetch('/content-review-manifest.json', { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]), credentials: 'omit', cache: 'no-store', redirect: 'error' });
  if (!response.ok || Number(response.headers.get('content-length') || 0) > MAX_BYTES || !response.body) throw new Error('Review queue unavailable');
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) { const result = await reader.read(); if (result.done) break; size += result.value.byteLength; if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Review queue too large'); } chunks.push(result.value); }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
