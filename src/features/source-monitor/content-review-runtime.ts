import { useEffect, useState } from 'react';
import { contentReviewToday } from '../../lib/content-review';

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
